// edits 存储 — 持久化用户对 Excel 内容的编辑修改
// 结构:
// {
//   "record_overrides": {
//     "BP-2026-0014": {        // 报备编号
//       "工位清单": "新工位名",
//       "工作内容明细": "新任务",
//       "采集人": "新采集人"
//     }
//   },
//   "scene_overrides": {
//     "周末砂锅羊肉粉店后厨": {
//       "采集内容概述": "新概述",
//       "采集位置": "新位置"
//     }
//   },
//   "meta": {
//     "updated_at": "2026-09-05T18:30:00.000Z"
//   }
// }

import fs from 'fs'
import path from 'path'

const DATA_DIR = path.resolve(process.env.HOME, 'Desktop/ATL数据采集场景报备/web/backend/data')
const EDITS_FILE = path.join(DATA_DIR, 'edits.json')

fs.mkdirSync(DATA_DIR, { recursive: true })

function load() {
  if (!fs.existsSync(EDITS_FILE)) {
    return { record_overrides: {}, scene_overrides: {}, meta: {} }
  }
  try {
    return JSON.parse(fs.readFileSync(EDITS_FILE, 'utf-8'))
  } catch (e) {
    console.error('edits.json 解析失败，使用空配置', e)
    return { record_overrides: {}, scene_overrides: {}, meta: {} }
  }
}

function save(data) {
  data.meta = { ...(data.meta || {}), updated_at: new Date().toISOString() }
  fs.writeFileSync(EDITS_FILE, JSON.stringify(data, null, 2), 'utf-8')
  return data
}

export function getAll() {
  return load()
}

// 应用覆盖到单条记录
export function applyToRecord(record) {
  const data = load()
  const overrides = data.record_overrides[record['报备编号']] || {}
  return { ...record, ...overrides }
}

// 应用覆盖到一组同场景的记录（修改场景级字段）
export function applyToSceneGroup(items) {
  const data = load()
  const sceneName = items[0]?.['场景名称']
  const sceneOverrides = data.scene_overrides[sceneName] || {}
  return items.map(it => ({
    ...applyToRecord(it),
    ...sceneOverrides,
  }))
}

export function setRecordOverride(id, fields) {
  const data = load()
  if (!data.record_overrides[id]) data.record_overrides[id] = {}
  data.record_overrides[id] = { ...data.record_overrides[id], ...fields }
  save(data)
  return data.record_overrides[id]
}

export function deleteRecordOverride(id) {
  const data = load()
  delete data.record_overrides[id]
  save(data)
}

export function setSceneOverride(name, fields) {
  const data = load()
  if (!data.scene_overrides[name]) data.scene_overrides[name] = {}
  data.scene_overrides[name] = { ...data.scene_overrides[name], ...fields }
  save(data)
  return data.scene_overrides[name]
}

export function deleteSceneOverride(name) {
  const data = load()
  delete data.scene_overrides[name]
  save(data)
}

// 给定一组"原始 Excel 行"，应用所有覆盖并返回新数组
export function applyAll(records) {
  const data = load()
  return records.map(rec => {
    const r = { ...rec, ...(data.record_overrides[rec['报备编号']] || {}) }
    const s = data.scene_overrides[r['场景名称']] || {}
    return { ...r, ...s }
  })
}

// 是否有任何编辑
export function hasAny() {
  const data = load()
  return Object.keys(data.record_overrides).length > 0 ||
         Object.keys(data.scene_overrides).length > 0
}