<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api'

const scenes = ref([])
const search = ref('')
const categoryFilter = ref('')
const router = useRouter()

async function load() {
  const { data } = await api.get('/scenes')
  scenes.value = data.scenes
}

onMounted(load)

const categories = ref([])
function unique(arr) { return [...new Set(arr)] }

const filtered = () => {
  return scenes.value.filter(s => {
    if (search.value && !s['场景名称'].includes(search.value)) return false
    if (categoryFilter.value && `${s['一级分类']}-${s['细分业态']}` !== categoryFilter.value) return false
    return true
  })
}

function thumbOf(scene) {
  const first = scene['工位列表'][0]
  if (!first || !first['图片列表'].length) return null
  return `/static/images/${first['图片列表'][0]}`
}
</script>

<template>
  <div>
    <div class="page-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="8">
          <el-input v-model="search" placeholder="搜索场景名" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-col>
        <el-col :span="6">
          <el-select v-model="categoryFilter" placeholder="全部业态" clearable>
            <el-option
              v-for="c in unique(scenes.map(s => `${s['一级分类']}-${s['细分业态']}`))"
              :key="c"
              :label="c"
              :value="c"
            />
          </el-select>
        </el-col>
        <el-col :span="10" style="text-align: right">
          <el-tag>共 {{ filtered().length }} 个场景</el-tag>
        </el-col>
      </el-row>
    </div>

    <el-row :gutter="16">
      <el-col v-for="s in filtered()" :key="s['场景名称']" :span="8" style="margin-bottom: 16px">
        <el-card class="scene-card" shadow="hover" @click="router.push(`/scenes/${encodeURIComponent(s['场景名称'])}`)">
          <img v-if="thumbOf(s)" :src="thumbOf(s)" class="thumb" />
          <div v-else class="thumb" style="display:flex;align-items:center;justify-content:center;color:#909399">无图</div>
          <div style="margin-top: 12px">
            <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px">
              {{ s['场景名称'] }}
            </div>
            <el-tag size="small">{{ s['一级分类'] }} / {{ s['细分业态'] }}</el-tag>
            <div style="margin-top: 10px; font-size: 13px; color: #606266">
              <el-icon><User /></el-icon> {{ s['采集人列表'].join('、') || '-' }}
            </div>
            <div style="margin-top: 4px; font-size: 13px; color: #606266">
              📍 {{ s['采集位置'] || '-' }}
            </div>
            <div style="margin-top: 8px; display:flex; gap: 8px">
              <el-tag type="success" size="small">{{ s['工位总数'] }} 工位</el-tag>
              <el-tag type="warning" size="small">{{ s['图片总数'] }} 图片</el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>