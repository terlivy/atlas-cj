<script setup>
import { ref, onMounted } from 'vue'
import api from '@/api'

const records = ref([])
const search = ref('')
const statusFilter = ref('')

async function load() {
  const { data } = await api.get('/records')
  records.value = data.records
}

onMounted(load)

const filtered = () => records.value.filter(r => {
  if (search.value) {
    const q = search.value.toLowerCase()
    if (!r['场景名称'].toLowerCase().includes(q) &&
        !r['工位清单'].toLowerCase().includes(q) &&
        !r['采集人'].toLowerCase().includes(q)) return false
  }
  if (statusFilter.value && r['报备状态'] !== statusFilter.value) return false
  return true
})
</script>

<template>
  <div>
    <div class="page-card">
      <el-row :gutter="16" align="middle">
        <el-col :span="10">
          <el-input v-model="search" placeholder="搜索场景/工位/采集人" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-col>
        <el-col :span="6">
          <el-select v-model="statusFilter" placeholder="全部状态" clearable>
            <el-option label="待审批" value="待审批" />
            <el-option label="已通过" value="已通过" />
            <el-option label="已驳回" value="已驳回" />
          </el-select>
        </el-col>
        <el-col :span="8" style="text-align: right">
          <el-tag>共 {{ filtered().length }} 条</el-tag>
        </el-col>
      </el-row>
    </div>

    <div class="page-card">
      <el-table :data="filtered()" stripe height="600">
        <el-table-column prop="报备编号" label="编号" width="140" />
        <el-table-column label="业态" width="140">
          <template #default="{ row }">
            {{ row['一级分类'] }} / {{ row['细分业态'] }}
          </template>
        </el-table-column>
        <el-table-column prop="场景名称" label="场景" width="200" show-overflow-tooltip />
        <el-table-column prop="工位清单" label="工位" width="180" show-overflow-tooltip />
        <el-table-column prop="工作内容明细" label="工作内容" show-overflow-tooltip />
        <el-table-column prop="采集人" label="采集人" width="100" />
        <el-table-column prop="报备日期" label="日期" width="110" />
        <el-table-column label="图片" width="80">
          <template #default="{ row }">
            <el-tag size="small">{{ row['图片列表'].length }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="报备状态" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row['报备状态'] === '已通过' ? 'success' : row['报备状态'] === '已驳回' ? 'danger' : 'warning'" size="small">
              {{ row['报备状态'] }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>