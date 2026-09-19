<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const mode = ref('unit')  // 'unit' 单位模式 | 'scene' 场景模式

// 单位模式
const units = ref([])
const selectedUnits = ref([])
const generatingUnit = ref(false)

// 场景模式
const scenes = ref([])
const selectedScenes = ref([])
const generatingScene = ref(false)

// 输出文件
const outputFiles = ref([])

async function loadUnits() {
  const { data } = await api.get('/units')
  units.value = data.units
}

async function loadScenes() {
  const { data } = await api.get('/scenes')
  scenes.value = data.scenes
}

async function loadOutput() {
  try {
    const { data } = await api.get('/output')
    outputFiles.value = data.files.sort((a, b) => b.mtime - a.mtime)
  } catch (e) {}
}

onMounted(() => { loadUnits(); loadScenes(); loadOutput() })

// 全选
const allSelectedUnits = computed({
  get: () => selectedUnits.value.length === units.value.length,
  set: v => { selectedUnits.value = v ? units.value.map(u => u['单位名称']) : [] }
})

const allSelectedScenes = computed({
  get: () => selectedScenes.value.length === scenes.value.length,
  set: v => { selectedScenes.value = v ? scenes.value.map(s => s['场景名称']) : [] }
})

const generating = computed(() => mode.value === 'unit' ? generatingUnit.value : generatingScene.value)

async function doGenerate() {
  if (mode.value === 'unit') {
    if (!selectedUnits.value.length) return ElMessage.warning('请至少选择一个单位')
    generatingUnit.value = true
    ElMessage.info(`正在按"单位"生成 ${selectedUnits.value.length} 个 Word...`)
    try {
      const { data } = await api.post('/generate', { byUnit: true, units: selectedUnits.value })
      ElMessage.success(`生成完成：${data.files.length} 个文件`)
      outputFiles.value = data.files.map(f => ({ ...f, mtime: Date.now() }))
      loadOutput()
    } catch (e) {
      ElMessageBox.alert(e.response?.data?.stderr || e.message, '生成失败', { type: 'error' })
    } finally {
      generatingUnit.value = false
    }
  } else {
    if (!selectedScenes.value.length) return ElMessage.warning('请至少选择一个场景')
    generatingScene.value = true
    ElMessage.info(`正在按"场景"生成 ${selectedScenes.value.length} 个 Word...`)
    try {
      const { data } = await api.post('/generate', { scenes: selectedScenes.value })
      ElMessage.success(`生成完成：${data.files.length} 个文件`)
      outputFiles.value = data.files.map(f => ({ ...f, mtime: Date.now() }))
      loadOutput()
    } catch (e) {
      ElMessageBox.alert(e.response?.data?.stderr || e.message, '生成失败', { type: 'error' })
    } finally {
      generatingScene.value = false
    }
  }
}
</script>

<template>
  <div>
    <!-- 顶部：模式切换 -->
    <div class="page-card">
      <el-radio-group v-model="mode" size="large">
        <el-radio-button value="unit">
          🏢 按单位生成（{{ units.length }} 个单位）
        </el-radio-button>
        <el-radio-button value="scene">
          🎬 按场景生成（{{ scenes.length }} 个场景）
        </el-radio-button>
      </el-radio-group>

      <el-alert
        v-if="mode === 'unit'"
        type="success"
        :closable="false"
        style="margin: 16px 0 0"
        show-icon
      >
        <strong>按单位模式</strong>：同一门店/公司的多个子场景会合并成一份 Word。
        例如"周末砂锅羊肉粉店用餐区"+"周末砂锅羊肉粉店后厨" → <code>周末砂锅羊肉粉店.docx</code>
      </el-alert>
      <el-alert
        v-else
        type="info"
        :closable="false"
        style="margin: 16px 0 0"
        show-icon
      >
        <strong>按场景模式</strong>：每个子场景生成一份独立的 Word（不合并）。
      </el-alert>
    </div>

    <!-- 单位模式 -->
    <div v-if="mode === 'unit'" class="page-card">
      <div class="section-title">🏢 单位列表（同门店/公司合并）</div>
        <div style="margin-bottom: 12px">
          <el-checkbox v-model="allSelectedUnits">全选</el-checkbox>
          <el-tag style="margin-left: 12px">已选 {{ selectedUnits.length }} / {{ units.length }}</el-tag>
        </div>

        <el-table :data="units" @selection-change="(rows) => selectedUnits = rows.map(r => r['单位名称'])" stripe>
          <el-table-column type="selection" width="50" />
          <el-table-column label="单位名称" min-width="220">
            <template #default="{ row }">
              <strong>{{ row['单位名称'] }}</strong>
            </template>
          </el-table-column>
          <el-table-column label="业态" width="160">
            <template #default="{ row }">
              <el-tag size="small">{{ row['一级分类'] }} / {{ row['细分业态'] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="子场景" min-width="300">
            <template #default="{ row }">
              <el-tag
                v-for="s in row['子场景列表']" :key="s"
                size="small" type="info"
                style="margin: 2px 4px 2px 0"
              >{{ s }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="工位" width="80" align="center">
            <template #default="{ row }">
              <el-tag type="success" size="small">{{ row['工位总数'] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="80" align="center">
            <template #default="{ row }">
              <el-tag type="warning" size="small">{{ row['图片总数'] }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div style="margin-top: 20px">
          <el-button type="primary" size="large" :loading="generating" @click="doGenerate">
            <el-icon><Download /></el-icon>
            一键生成 {{ selectedUnits.length }} 个单位 Word
          </el-button>
          <el-button @click="loadOutput">刷新输出列表</el-button>
        </div>
    </div>

    <!-- 场景模式 -->
    <div v-else class="page-card">
      <div class="section-title">🎬 场景列表</div>
        <div style="margin-bottom: 12px">
          <el-checkbox v-model="allSelectedScenes">全选</el-checkbox>
          <el-tag style="margin-left: 12px">已选 {{ selectedScenes.length }} / {{ scenes.length }}</el-tag>
        </div>

        <el-table :data="scenes" @selection-change="(rows) => selectedScenes = rows.map(r => r['场景名称'])" stripe>
          <el-table-column type="selection" width="50" />
          <el-table-column prop="场景名称" label="场景名称" min-width="240" />
          <el-table-column label="业态" width="160">
            <template #default="{ row }">
              <el-tag size="small">{{ row['一级分类'] }} / {{ row['细分业态'] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="工位" width="80" align="center">
            <template #default="{ row }">
              <el-tag type="success" size="small">{{ row['工位总数'] }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="图片" width="80" align="center">
            <template #default="{ row }">
              <el-tag type="warning" size="small">{{ row['图片总数'] }}</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div style="margin-top: 20px">
          <el-button type="primary" size="large" :loading="generating" @click="doGenerate">
            <el-icon><Download /></el-icon>
            一键生成 {{ selectedScenes.length }} 个场景 Word
          </el-button>
          <el-button @click="loadOutput">刷新输出列表</el-button>
        </div>
    </div>

    <!-- 已生成文件 -->
    <div class="page-card">
      <div class="section-title">📁 已生成文件</div>
      <el-empty v-if="!outputFiles.length" description="暂未生成文件" />
      <el-table v-else :data="outputFiles" stripe>
        <el-table-column label="文件名" prop="name" />
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            {{ (row.size / 1024).toFixed(0) }} KB
          </template>
        </el-table-column>
        <el-table-column label="生成时间" width="200">
          <template #default="{ row }">
            {{ new Date(row.mtime).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link @click="window.open(row.downloadUrl, '_blank')">
              <el-icon><Download /></el-icon> 下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>