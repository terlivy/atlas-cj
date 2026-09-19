<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'
import { ElMessage } from 'element-plus'

const categories = ref([])
const businessTypes = ref([])
const search = ref('')
const filterCategory = ref('')
const source = ref('')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/categories')
    categories.value = data.categories || []
    businessTypes.value = data.businessTypes || []
    source.value = data.source || ''
  } catch (e) {
    ElMessage.error('加载业态字典失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

async function refresh() {
  ElMessage.info('刷新中...')
  const { data } = await api.post('/categories/refresh')
  categories.value = data.categories || []
  businessTypes.value = data.businessTypes || []
  source.value = data.source || ''
  ElMessage.success('已刷新')
}

onMounted(load)

// 业务采集表筛选
const filtered = computed(() => businessTypes.value.filter(b => {
  if (filterCategory.value && b['一级分类（中英文）'] !== filterCategory.value) return false
  if (search.value) {
    const q = search.value.toLowerCase()
    const hay = [b['业态分类（细分）'] || '', b['一级分类（中英文）'] || ''].join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}))

// 业态分类（Sheet 1）按一级分类分组
const categoriesWithCount = computed(() => categories.value.map(c => ({
  ...c,
  count: c['细分业态列表'].length,
})))
</script>

<template>
  <div v-loading="loading">
    <!-- 头部统计卡 -->
    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #409eff"><el-icon><Files /></el-icon></div>
          <div>
            <div class="stat-value">{{ categories.length }}</div>
            <div class="stat-label">一级业态分类</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #67c23a"><el-icon><Grid /></el-icon></div>
          <div>
            <div class="stat-value">{{ businessTypes.length }}</div>
            <div class="stat-label">细分业态模板</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #e6a23c"><el-icon><DataLine /></el-icon></div>
          <div>
            <div class="stat-value">{{ categories.reduce((s, c) => s + c['细分业态列表'].length, 0) }}</div>
            <div class="stat-label">业态细分总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #909399"><el-icon><Document /></el-icon></div>
          <div style="font-size: 13px; color: #303133">
            <div style="font-weight: 600">{{ source }}</div>
            <div class="stat-label">数据源：飞书 Excel</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 一级业态分类 -->
    <div class="page-card" style="margin-top: 16px">
      <div class="section-title">
        📚 一级业态分类（Sheet 1：业态分类）
        <el-button size="small" @click="refresh" style="margin-left: auto">
          <el-icon><Refresh /></el-icon> 刷新
        </el-button>
      </div>
      <el-table :data="categoriesWithCount" stripe border>
        <el-table-column prop="序号" label="序号" width="80" align="center" />
        <el-table-column prop="一级分类" label="一级分类（中英文）" min-width="280" />
        <el-table-column label="细分业态" min-width="500">
          <template #default="{ row }">
            <el-tag
              v-for="(s, i) in row['细分业态列表']" :key="i"
              size="small"
              style="margin: 2px 4px 2px 0"
            >{{ s }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="细分业态数" width="120" align="center">
          <template #default="{ row }">
            <el-tag type="success" size="small">{{ row['count'] }} 个</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 业务采集表（26 行业态模板） -->
    <div class="page-card">
      <div class="section-title">📋 业务采集表（Sheet 2：26 类业态模板）</div>

      <el-row :gutter="16" style="margin-bottom: 12px">
        <el-col :span="8">
          <el-input v-model="search" placeholder="搜索业态名" clearable>
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-col>
        <el-col :span="8">
          <el-select v-model="filterCategory" placeholder="全部一级分类" clearable>
            <el-option
              v-for="c in categories" :key="c['一级分类']"
              :label="c['一级分类']" :value="c['一级分类']"
            />
          </el-select>
        </el-col>
        <el-col :span="8" style="text-align: right">
          <el-tag>共 {{ filtered.length }} 行</el-tag>
        </el-col>
      </el-row>

      <el-table :data="filtered" stripe border max-height="600">
        <el-table-column prop="序号" label="序号" width="60" align="center" fixed="left" />
        <el-table-column prop="一级分类（中英文）" label="一级分类" width="180" show-overflow-tooltip fixed="left" />
        <el-table-column prop="业态分类（细分）" label="细分业态" width="140" show-overflow-tooltip fixed="left" />
        <el-table-column label="客单价/人均消费" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['客单价/人均消费区间（元）'] }}
          </template>
        </el-table-column>
        <el-table-column label="线上预约/外卖渠道" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['线上预约/外卖渠道'] }}
          </template>
        </el-table-column>
        <el-table-column label="面积要求" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="color: #909399; font-size: 12px">
              {{ row['备餐面积（㎡）\n（物流类请填仓库/配送中心面积）'] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="维修工位/检测台" width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <span style="color: #909399; font-size: 12px">
              {{ row['维修工位/检测台（个）\n（物流类可填车辆/叉车数）'] }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="主营服务范围" width="200" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row['主营服务范围（可多选）'] }}
          </template>
        </el-table-column>
        <el-table-column label="是否上门" width="100" align="center">
          <template #default="{ row }">
            {{ row['是否上门服务'] }}
          </template>
        </el-table-column>
        <el-table-column prop="备注" label="备注" min-width="120" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>