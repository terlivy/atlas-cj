// ATL 场景报备 Web 后端
// 提供：
//   GET  /api/records          解析 Excel，返回全部记录
//   GET  /api/scenes           按场景分组
//   GET  /api/scenes/:name     单场景详情
//   GET  /api/stats            Dashboard 统计
//   GET  /api/image/:filename  图片代理（前端 <img> 直接显示）
//   POST /api/generate         调用 Python 脚本生成 Word 并返回下载链接
//   GET  /api/download/:file   下载生成的 Word

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'
import * as store from './store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============== 配置 ==============
// 默认从 web 的父目录（即 ~/Desktop/ATL数据采集场景报备/）找 Excel 和图片
const PROJECT_ROOT = path.resolve(__dirname, '..')          // ~/Desktop/ATL数据采集场景报备/web
const DATA_ROOT = path.resolve(PROJECT_ROOT, '..')          // ~/Desktop/ATL数据采集场景报备
const GENERATOR_DIR = path.join(process.env.HOME, '作业场景报备生成器')
const PYTHON_BIN = '/opt/homebrew/bin/python3.14'
const PYTHON_SCRIPT = path.join(GENERATOR_DIR, 'main.py')
const TEMPLATE_PATH = path.join(DATA_ROOT, '场景报备文档-模版docx.docx')
const IMAGES_DIR = path.join(DATA_ROOT, '作业场景采集报备')
const OUTPUT_DIR = path.join(DATA_ROOT, new Date().toISOString().slice(0, 10).replace(/-/g, ''))

// 上传 Excel 用
const UPLOAD_DIR = path.join(PROJECT_ROOT, 'uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const upload = multer({ dest: UPLOAD_DIR })

// 业态范围表（来自 ATL项目采集范围.xlsx）
const CATEGORIES_FILE = path.join(DATA_ROOT, 'ATL项目采集范围.xlsx')

// ============== Excel 解析 ==============
const COLUMNS = [
  '报备编号', '一级分类', '细分业态', '场景名称', '采集内容概述',
  '工位清单', '工作内容明细', '工位数量', '图片数量', '报备状态',
  '采集人', '报备日期', '审批意见', '备注', '工位图片', '采集位置',
]

let CACHE = { records: [], mtime: 0, source: null }

function findLatestExcel(root) {
  const files = fs.readdirSync(root)
    .filter(f => f.startsWith('作业场景采集报备管理系统') && f.endsWith('.xlsx') && !f.startsWith('~$'))
  if (!files.length) return null
  const sorted = files
    .map(f => ({ f, m: fs.statSync(path.join(root, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m)
  return path.join(root, sorted[0].f)
}

function loadExcel() {
  // 优先用 DATA_ROOT 下的 Excel，否则看上传目录里最新的
  let excelPath = findLatestExcel(DATA_ROOT)
  if (!excelPath) {
    // 看上传目录
    const upDir = UPLOAD_DIR
    if (fs.existsSync(upDir)) {
      const ups = fs.readdirSync(upDir).filter(f => f.endsWith('.xlsx'))
      if (ups.length) {
        excelPath = path.join(upDir, ups.sort((a, b) =>
          fs.statSync(path.join(upDir, b)).mtimeMs - fs.statSync(path.join(upDir, a)).mtimeMs)[0])
      }
    }
  }

  if (!excelPath || !fs.existsSync(excelPath)) {
    return { records: [], source: null, error: '未找到 Excel 文件' }
  }

  const mtime = fs.statSync(excelPath).mtimeMs
  if (CACHE.source === excelPath && CACHE.mtime === mtime) {
    return { records: CACHE.records, source: excelPath }
  }

  const wb = XLSX.readFile(excelPath, { cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const records = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row[3]) continue
    const rec = {}
    for (let c = 0; c < COLUMNS.length; c++) {
      rec[COLUMNS[c]] = row[c] ?? ''
    }
    // 解析图片列表（逗号分隔）
    const raw = String(rec['工位图片'] || '')
    rec['图片列表'] = raw.split(',').map(s => s.trim()).filter(Boolean)
    // 解析报备日期为字符串
    if (rec['报备日期'] instanceof Date) {
      rec['报备日期'] = rec['报备日期'].toISOString().slice(0, 10)
    }
    records.push(rec)
  }

  CACHE = { records, mtime, source: excelPath }

  // 应用编辑覆盖（用户在前端修改的内容）
  const finalRecords = store.applyAll(records)
  return { records: finalRecords, source: excelPath }
}

function groupByScene(records) {
  const map = new Map()
  for (const r of records) {
    if (!map.has(r['场景名称'])) map.set(r['场景名称'], [])
    map.get(r['场景名称']).push(r)
  }
  return Array.from(map.entries()).map(([name, items]) => ({
    场景名称: name,
    一级分类: items[0]['一级分类'],
    细分业态: items[0]['细分业态'],
    工位列表: items,
    工位总数: items.length,
    图片总数: items.reduce((sum, it) => sum + it['图片列表'].length, 0),
    采集人列表: [...new Set(items.map(i => i['采集人']).filter(Boolean))],
    报备日期: items[0]['报备日期'],
    采集位置: items[0]['采集位置'],
    采集内容概述: items[0]['采集内容概述'],
  }))
}

// ============== 路由 ==============
const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/static/images', express.static(IMAGES_DIR, { maxAge: '1h' }))
app.use('/static/output', express.static(OUTPUT_DIR, { maxAge: 0 }))

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.get('/api/records', (req, res) => {
  const { records, source, error } = loadExcel()
  if (error) return res.status(404).json({ error })
  res.json({ count: records.length, source: path.basename(source), records })
})

app.get('/api/scenes', (req, res) => {
  const { records, source, error } = loadExcel()
  if (error) return res.status(404).json({ error })
  const scenes = groupByScene(records)
  res.json({ count: scenes.length, source: path.basename(source), scenes })
})

app.get('/api/scenes/:name', (req, res) => {
  const { records } = loadExcel()
  const name = decodeURIComponent(req.params.name)
  const scenes = groupByScene(records)
  const scene = scenes.find(s => s['场景名称'] === name)
  if (!scene) return res.status(404).json({ error: '场景不存在' })
  res.json(scene)
})

// ============== 按单位聚类 ==============
// 同 Python 脚本的 group_by_unit 逻辑
function extractEntity(sceneName) {
  let name = sceneName
  const suffixes = ['后厨', '用餐区', '前厅', '吧台', '收银区', '大厅',
                    '汽车维修区', '汽车美容区', '洗车区', '维修区', '美容区']
  for (const sfx of suffixes) {
    if (name.endsWith(sfx)) {
      name = name.slice(0, -sfx.length)
      break
    }
  }
  const m = name.match(/(.+?(?:店|公司|食堂))/)
  return m ? m[1] : name
}

function getPosUnit(position) {
  if (!position) return ''
  const m = String(position).match(/(.+?区.+?街道)/)
  return m ? m[1] : String(position)
}

function groupByUnit(records) {
  const buckets = new Map()
  for (const rec of records) {
    const entity = extractEntity(rec['场景名称'])
    const posUnit = getPosUnit(rec['采集位置'])
    const key = `${entity}|||${posUnit}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(rec)
  }
  const units = []
  for (const [key, recs] of buckets) {
    const [entity, posUnit] = key.split('|||')
    const subScenes = [...new Set(recs.map(r => r['场景名称']))].sort()
    units.push({
      单位名称: entity || '(未识别门店)',
      一级分类: recs[0]['一级分类'],
      细分业态: recs[0]['细分业态'],
      子场景列表: subScenes,
      工位总数: recs.length,
      图片总数: recs.reduce((s, r) => s + r['图片列表'].length, 0),
      采集人列表: [...new Set(recs.map(r => r['采集人']).filter(Boolean))],
      报备日期: recs[0]['报备日期'],
      采集位置: recs[0]['采集位置'],
      采集内容概述: recs[0]['采集内容概述'],
      _allRecords: recs,  // 内部用，生成时展开
    })
  }
  units.sort((a, b) => a['单位名称'].localeCompare(b['单位名称']))
  return units
}

app.get('/api/units', (req, res) => {
  const { records, source, error } = loadExcel()
  if (error) return res.status(404).json({ error })
  const units = groupByUnit(records)
  // 不返回 _allRecords
  const cleanUnits = units.map(({ _allRecords, ...rest }) => rest)
  res.json({
    count: cleanUnits.length,
    source: path.basename(source),
    units: cleanUnits,
  })
})

app.get('/api/stats', (req, res) => {
  const { records } = loadExcel()
  const scenes = groupByScene(records)

  // 按一级分类
  const byCategory = {}
  for (const s of scenes) {
    const k = `${s['一级分类']}-${s['细分业态']}`
    byCategory[k] = (byCategory[k] || 0) + 1
  }

  // 按采集人
  const byCollector = {}
  for (const r of records) {
    if (r['采集人']) byCollector[r['采集人']] = (byCollector[r['采集人']] || 0) + 1
  }

  // 按状态
  const byStatus = {}
  for (const r of records) {
    if (r['报备状态']) byStatus[r['报备状态']] = (byStatus[r['报备状态']] || 0) + 1
  }

  res.json({
    场景数: scenes.length,
    工位数: records.length,
    图片数: records.reduce((s, r) => s + r['图片列表'].length, 0),
    采集人数: Object.keys(byCollector).length,
    byCategory,
    byCollector,
    byStatus,
  })
})

// 上传新 Excel
app.post('/api/upload', upload.single('excel'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未上传文件' })
  // 触发缓存失效
  CACHE = { records: [], mtime: 0, source: null }
  res.json({
    ok: true,
    filename: req.file.filename,
    originalname: req.file.originalname,
  })
})

// 生成 Word
app.post('/api/generate', async (req, res) => {
  const { scenes: selectedScenes, units: selectedUnits, byUnit, outputDir } = req.body

  // byUnit=true 时用 selectedUnits（单位名），否则用 selectedScenes（场景名）
  let filterNames = []
  let useByUnit = !!byUnit
  if (useByUnit) {
    if (!Array.isArray(selectedUnits) || !selectedUnits.length) {
      return res.status(400).json({ error: '请指定至少一个单位' })
    }
    filterNames = selectedUnits
  } else {
    if (!Array.isArray(selectedScenes) || !selectedScenes.length) {
      return res.status(400).json({ error: '请指定至少一个场景' })
    }
    filterNames = selectedScenes
  }

  if (!fs.existsSync(PYTHON_SCRIPT)) {
    return res.status(500).json({ error: `Python 脚本不存在: ${PYTHON_SCRIPT}` })
  }

  // 默认输出目录：OUTPUT_DIR (今天日期)
  const targetOut = outputDir
    ? path.resolve(outputDir)
    : OUTPUT_DIR

  fs.mkdirSync(targetOut, { recursive: true })

  // 构造临时 Excel：原始 Excel 数据 + 应用 edits + 仅选中的场景/单位
  const sourceExcel = findLatestExcel(DATA_ROOT)
  let excelToUse = sourceExcel
  let tempExcel = null
  if (sourceExcel) {
    const wb = XLSX.readFile(sourceExcel, { cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const header = rows[0]

    // 计算 filterNames 对应的子场景集合
    let sceneSet = new Set(filterNames)
    if (useByUnit) {
      const { records } = loadExcel()
      const units = groupByUnit(records)
      sceneSet = new Set()
      for (const u of units) {
        if (filterNames.includes(u['单位名称'])) {
          for (const s of u['子场景列表']) sceneSet.add(s)
        }
      }
    }

    // 应用所有 edits
    const editsData = store.getAll()
    const ro = editsData.record_overrides || {}
    const so = editsData.scene_overrides || {}
    const updated = rows.slice(1)
      .filter(r => r[3] && sceneSet.has(String(r[3])))
      .map(r => {
        const id = String(r[0] || '').trim()
        const sceneName = String(r[3] || '').trim()
        const o = { ...(so[sceneName] || {}), ...(ro[id] || {}) }
        if (!Object.keys(o).length) return r
        const newRow = [...r]
        for (let i = 0; i < COLUMNS.length; i++) {
          if (o[COLUMNS[i]] !== undefined) {
            newRow[i] = o[COLUMNS[i]]
          }
        }
        return newRow
      })
    const newWb = XLSX.utils.book_new()
    const newWs = XLSX.utils.aoa_to_sheet([header, ...updated])
    XLSX.utils.book_append_sheet(newWb, newWs, wb.SheetNames[0])
    tempExcel = path.join(UPLOAD_DIR, `tmp_${Date.now()}.xlsx`)
    XLSX.writeFile(newWb, tempExcel)
    excelToUse = tempExcel
    console.log(`📋 临时 Excel: ${tempExcel}（${updated.length} 条，${useByUnit ? `按单位 ${filterNames.length} 个` : `按场景 ${filterNames.length} 个`}，已应用 edits）`)
  }

  const args = [
    PYTHON_SCRIPT,
    '--excel', excelToUse || '',
    '--template', TEMPLATE_PATH,
    '--images', IMAGES_DIR,
    '--out', targetOut,
  ]
  if (useByUnit) args.push('--by-unit')

  console.log('🐍 Spawning:', PYTHON_BIN, args.join(' '))

  const py = spawn(PYTHON_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })

  let stdout = '', stderr = ''
  py.stdout.on('data', d => stdout += d.toString())
  py.stderr.on('data', d => stderr += d.toString())

  py.on('close', code => {
    // 清理临时 Excel
    if (tempExcel && fs.existsSync(tempExcel)) {
      try { fs.unlinkSync(tempExcel) } catch {}
    }

    if (code !== 0) {
      console.error('Python error:', stderr)
      return res.status(500).json({ error: 'Python 生成失败', stderr: stderr.slice(-2000), stdout })
    }
    // 列出输出文件
    const files = fs.readdirSync(targetOut).filter(f => f.endsWith('.docx'))
    res.json({
      ok: true,
      outputDir: targetOut,
      files: files.map(f => ({
        name: f,
        scene: f.replace(/\.docx$/, ''),
        size: fs.statSync(path.join(targetOut, f)).size,
        downloadUrl: `/api/download/${encodeURIComponent(f)}`,
      })),
    })
  })
})

app.get('/api/download/:filename', (req, res) => {
  const fn = decodeURIComponent(req.params.filename)
  // 安全检查：防止路径穿越
  if (fn.includes('..') || fn.includes('/')) {
    return res.status(400).json({ error: '非法文件名' })
  }
  const p = path.join(OUTPUT_DIR, fn)
  if (!fs.existsSync(p)) return res.status(404).json({ error: '文件不存在' })
  res.download(p, fn)
})

// ============== 编辑覆盖 API ==============
// 获取全部 edits
app.get('/api/edits', (req, res) => {
  res.json(store.getAll())
})

// 设置单条记录的字段覆盖
app.put('/api/edits/record/:id', (req, res) => {
  const id = decodeURIComponent(req.params.id)
  const fields = req.body || {}
  if (typeof fields !== 'object' || Array.isArray(fields)) {
    return res.status(400).json({ error: 'fields 必须是对象' })
  }
  const result = store.setRecordOverride(id, fields)
  CACHE = { records: [], mtime: 0, source: null }  // 失效缓存
  res.json({ ok: true, id, fields: result })
})

// 删除单条记录的所有覆盖
app.delete('/api/edits/record/:id', (req, res) => {
  store.deleteRecordOverride(decodeURIComponent(req.params.id))
  CACHE = { records: [], mtime: 0, source: null }
  res.json({ ok: true })
})

// 设置场景级字段覆盖
app.put('/api/edits/scene/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name)
  const fields = req.body || {}
  if (typeof fields !== 'object' || Array.isArray(fields)) {
    return res.status(400).json({ error: 'fields 必须是对象' })
  }
  const result = store.setSceneOverride(name, fields)
  CACHE = { records: [], mtime: 0, source: null }
  res.json({ ok: true, name, fields: result })
})

// 删除场景级覆盖
app.delete('/api/edits/scene/:name', (req, res) => {
  store.deleteSceneOverride(decodeURIComponent(req.params.name))
  CACHE = { records: [], mtime: 0, source: null }
  res.json({ ok: true })
})

// 重置所有 edits
app.delete('/api/edits', (req, res) => {
  const data = store.getAll()
  data.record_overrides = {}
  data.scene_overrides = {}
  store.save(data)
  CACHE = { records: [], mtime: 0, source: null }
  res.json({ ok: true })
})

// ============== 业态字典 API ==============
let CATEGORIES_CACHE = null

function loadCategories() {
  if (CATEGORIES_CACHE) return CATEGORIES_CACHE
  if (!fs.existsSync(CATEGORIES_FILE)) {
    CATEGORIES_CACHE = { categories: [], businessTypes: [], error: '未找到 ATL项目采集范围.xlsx' }
    return CATEGORIES_CACHE
  }
  try {
    const wb = XLSX.readFile(CATEGORIES_FILE, { cellDates: true })

    // Sheet 1: 业态分类（4 行一级分类 + 细分业态清单）
    const catSheet = wb.Sheets['业态分类']
    const catRows = XLSX.utils.sheet_to_json(catSheet, { header: 1, defval: '' })
    const categories = catRows.slice(1).map((r, idx) => ({
      序号: r[0] || idx + 1,
      一级分类: String(r[1] || '').trim(),
      细分业态: String(r[2] || '').trim(),
      // 把细分业态字符串拆成数组
      细分业态列表: String(r[2] || '').split(/[、，,]/).map(s => s.trim()).filter(Boolean),
    })).filter(c => c['一级分类'])

    // Sheet 2: 业务采集表（26 行业态模板）
    const bizSheet = wb.Sheets['业务采集表']
    const bizRows = XLSX.utils.sheet_to_json(bizSheet, { header: 1, defval: '' })
    // 第 2 行是字段头，第 3 行起是数据
    const headers = bizRows[1] || []
    const businessTypes = bizRows.slice(2).map(r => {
      const obj = {}
      headers.forEach((h, i) => {
        if (h) obj[String(h).trim()] = r[i] !== undefined ? String(r[i]).trim() : ''
      })
      return obj
    }).filter(b => b['业态分类（细分）'] || b['一级分类（中英文）'])

    CATEGORIES_CACHE = {
      categories,
      businessTypes,
      totalCategories: categories.length,
      totalBusinessTypes: businessTypes.length,
      source: path.basename(CATEGORIES_FILE),
      mtime: fs.statSync(CATEGORIES_FILE).mtimeMs,
    }
    return CATEGORIES_CACHE
  } catch (e) {
    console.error('业态表解析失败:', e)
    CATEGORIES_CACHE = { categories: [], businessTypes: [], error: e.message }
    return CATEGORIES_CACHE
  }
}

app.get('/api/categories', (req, res) => {
  const data = loadCategories()
  res.json(data)
})

// 刷新缓存（Excel 文件更新后调用）
app.post('/api/categories/refresh', (req, res) => {
  CATEGORIES_CACHE = null
  res.json({ ok: true, data: loadCategories() })
})

// 列出已生成的文件
app.get('/api/output', (req, res) => {
  if (!fs.existsSync(OUTPUT_DIR)) return res.json({ files: [] })
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.docx'))
  res.json({
    outputDir: OUTPUT_DIR,
    files: files.map(f => ({
      name: f,
      scene: f.replace(/\.docx$/, ''),
      size: fs.statSync(path.join(OUTPUT_DIR, f)).size,
      mtime: fs.statSync(path.join(OUTPUT_DIR, f)).mtimeMs,
      downloadUrl: `/api/download/${encodeURIComponent(f)}`,
    })),
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`🚀 ATL 后端: http://localhost:${PORT}`)
  console.log(`   数据目录: ${DATA_ROOT}`)
  console.log(`   Excel:    ${findLatestExcel(DATA_ROOT) || '(未找到)'}`)
  console.log(`   Python:   ${PYTHON_BIN}`)
  console.log(`   生成脚本: ${PYTHON_SCRIPT}`)
})