<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({ name: String })

const scene = ref(null)
const original = ref(null)  // 原始数据（用于"还原"按钮）
const loading = ref(true)
const route = useRoute()
const router = useRouter()

// 编辑状态
const editing = ref(false)
const draft = ref({ sceneMeta: {}, stations: [] })  // 草稿
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    const name = decodeURIComponent(props.name || route.params.name)
    const { data } = await api.get(`/scenes/${encodeURIComponent(name)}`)
    scene.value = data
    original.value = JSON.parse(JSON.stringify(data))
    resetDraft()
  } finally {
    loading.value = false
  }
}

function resetDraft() {
  if (!scene.value) return
  draft.value = {
    sceneMeta: {
      采集内容概述: scene.value['采集内容概述'],
      采集位置: scene.value['采集位置'],
    },
    stations: scene.value['工位列表'].map(s => ({
      '报备编号': s['报备编号'],
      '工位清单': s['工位清单'],
      '工作内容明细': s['工作内容明细'],
      '采集人': s['采集人'],
    })),
  }
}

onMounted(load)

const allImages = computed(() => {
  if (!scene.value) return []
  return scene.value['工位列表'].flatMap(s => s['图片列表'].map(f => ({
    url: `/static/images/${f}`,
    station: s['工位清单'],
    task: s['工作内容明细'],
  })))
})

const previewIdx = ref(null)
function preview(i) { previewIdx.value = i }

// 进入编辑模式
function startEdit() {
  resetDraft()
  editing.value = true
}

// 取消编辑
function cancelEdit() {
  editing.value = false
}

// 保存编辑（提交覆盖到后端）
async function saveEdit() {
  saving.value = true
  try {
    // 1. 保存场景级覆盖
    const sceneName = scene.value['场景名称']
    const metaChanges = {}
    if (draft.value.sceneMeta['采集内容概述'] !== scene.value['采集内容概述']) {
      metaChanges['采集内容概述'] = draft.value.sceneMeta['采集内容概述']
    }
    if (draft.value.sceneMeta['采集位置'] !== scene.value['采集位置']) {
      metaChanges['采集位置'] = draft.value.sceneMeta['采集位置']
    }
    if (Object.keys(metaChanges).length) {
      await api.put(`/api/edits/scene/${encodeURIComponent(sceneName)}`, metaChanges)
    } else {
      // 清掉旧的场景级覆盖（如果有变更被还原）
      try { await api.delete(`/api/edits/scene/${encodeURIComponent(sceneName)}`) } catch {}
    }

    // 2. 逐条保存记录级覆盖
    for (const draftStation of draft.value.stations) {
      const originalStation = scene.value['工位列表'].find(s => s['报备编号'] === draftStation['报备编号'])
      const changes = {}
      for (const field of ['工位清单', '工作内容明细', '采集人']) {
        if (draftStation[field] !== originalStation[field]) {
          changes[field] = draftStation[field]
        }
      }
      if (Object.keys(changes).length) {
        await api.put(`/api/edits/record/${encodeURIComponent(draftStation['报备编号'])}`, changes)
      } else {
        // 没有变更则清掉这条的覆盖
        try { await api.delete(`/api/edits/record/${encodeURIComponent(draftStation['报备编号'])}`) } catch {}
      }
    }

    ElMessage.success('已保存')
    editing.value = false
    await load()  // 重新加载刷新数据
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.error || e.message))
  } finally {
    saving.value = false
  }
}

// 还原该场景的所有编辑
async function resetScene() {
  try {
    await ElMessageBox.confirm('确定要还原该场景的所有编辑吗？', '确认', { type: 'warning' })
    const sceneName = scene.value['场景名称']
    try { await api.delete(`/api/edits/scene/${encodeURIComponent(sceneName)}`) } catch {}
    for (const s of scene.value['工位列表']) {
      try { await api.delete(`/api/edits/record/${encodeURIComponent(s['报备编号'])}`) } catch {}
    }
    ElMessage.success('已还原')
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('还原失败: ' + (e.response?.data?.error || e.message))
  }
}
</script>

<template>
  <div v-loading="loading">
    <el-page-header @back="router.push('/scenes')" style="margin-bottom: 16px">
      <template #content>
        <span style="font-size: 16px; font-weight: 600">返回列表</span>
      </template>
    </el-page-header>

    <div v-if="scene" class="page-card">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px">
        <h2 style="margin: 0">{{ scene['场景名称'] }}</h2>
        <div>
          <el-button v-if="!editing" type="primary" @click="startEdit">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <template v-else>
            <el-button @click="cancelEdit">取消</el-button>
            <el-button type="success" :loading="saving" @click="saveEdit">
              <el-icon><Check /></el-icon> 保存
            </el-button>
          </template>
          <el-button v-if="!editing" type="warning" plain @click="resetScene">
            <el-icon><RefreshLeft /></el-icon> 还原编辑
          </el-button>
        </div>
      </div>

      <!-- 场景元信息 -->
      <el-descriptions :column="3" border>
        <el-descriptions-item label="业态">{{ scene['一级分类'] }} / {{ scene['细分业态'] }}</el-descriptions-item>
        <el-descriptions-item label="采集人">{{ scene['采集人列表'].join('、') }}</el-descriptions-item>
        <el-descriptions-item label="报备日期">{{ scene['报备日期'] }}</el-descriptions-item>

        <!-- 采集位置 -->
        <el-descriptions-item label="采集位置" :span="3">
          <template v-if="editing">
            <el-input v-model="draft.sceneMeta['采集位置']" />
          </template>
          <template v-else>{{ scene['采集位置'] }}</template>
        </el-descriptions-item>

        <!-- 概述 -->
        <el-descriptions-item label="概述" :span="3">
          <template v-if="editing">
            <el-input v-model="draft.sceneMeta['采集内容概述']" type="textarea" :rows="2" />
          </template>
          <template v-else>{{ scene['采集内容概述'] }}</template>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div v-if="scene" class="page-card">
      <div class="section-title">📍 工位明细（{{ scene['工位总数'] }} 个）</div>
      <el-table :data="editing ? draft.stations : scene['工位列表']" stripe>
        <el-table-column type="index" label="#" width="60" />

        <!-- 工位名称 -->
        <el-table-column label="工位名称" width="180">
          <template v-if="editing" #default="{ row }">
            <el-input v-model="row['工位清单']" size="small" />
          </template>
          <template v-else #default="{ row }">
            {{ row['工位清单'] }}
          </template>
        </el-table-column>

        <!-- 工作内容 -->
        <el-table-column label="工作内容">
          <template v-if="editing" #default="{ row }">
            <el-input v-model="row['工作内容明细']" type="textarea" :rows="2" size="small" />
          </template>
          <template v-else #default="{ row }">
            {{ row['工作内容明细'] }}
          </template>
        </el-table-column>

        <!-- 采集人 -->
        <el-table-column label="采集人" width="120">
          <template v-if="editing" #default="{ row }">
            <el-input v-model="row['采集人']" size="small" />
          </template>
          <template v-else #default="{ row }">
            {{ row['采集人'] }}
          </template>
        </el-table-column>

        <el-table-column prop="报备编号" label="编号" width="140" />
        <el-table-column label="图片数" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ row['图片列表']?.length || 0 }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div v-if="scene && allImages.length" class="page-card">
      <div class="section-title">🖼️ 全部图片（{{ allImages.length }} 张）</div>
      <el-image-list :cols="4" :gap="8">
        <el-image
          v-for="(img, i) in allImages" :key="i"
          :src="img.url" fit="cover"
          style="height: 160px; border-radius: 4px; cursor: pointer"
          @click="previewIdx = i"
        />
      </el-image-list>

      <el-image-viewer
        v-if="previewIdx !== null"
        :url-list="allImages.map(i => i.url)"
        :initial-index="previewIdx"
        @close="previewIdx = null"
      />
    </div>
  </div>
</template>