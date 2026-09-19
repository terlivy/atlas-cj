<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/api'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
  TitleComponent, TooltipComponent, LegendComponent, GridComponent,
} from 'echarts/components'

use([CanvasRenderer, PieChart, BarChart, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent])

const stats = ref({})
const source = ref('')

async function load() {
  const { data } = await api.get('/stats')
  stats.value = data
  source.value = data.source || ''
}

onMounted(load)

const categoryOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: Object.entries(stats.value.byCategory || {}).map(([k, v]) => ({ name: k, value: v })),
    label: { formatter: '{b}\n{c}个 ({d}%)' },
  }],
}))

const collectorOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 20, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: Object.keys(stats.value.byCollector || {}) },
  yAxis: { type: 'value' },
  series: [{
    type: 'bar',
    data: Object.values(stats.value.byCollector || {}),
    itemStyle: { color: '#409eff', borderRadius: [4, 4, 0, 0] },
    label: { show: true, position: 'top' },
  }],
}))

const statusOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: '70%',
    data: Object.entries(stats.value.byStatus || {}).map(([k, v]) => ({ name: k, value: v })),
    label: { formatter: '{b}: {c}' },
  }],
}))
</script>

<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #409eff"><el-icon><Grid /></el-icon></div>
          <div>
            <div class="stat-value">{{ stats.场景数 || 0 }}</div>
            <div class="stat-label">场景总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #67c23a"><el-icon><Histogram /></el-icon></div>
          <div>
            <div class="stat-value">{{ stats.工位数 || 0 }}</div>
            <div class="stat-label">报备工位</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #e6a23c"><el-icon><Picture /></el-icon></div>
          <div>
            <div class="stat-value">{{ stats.图片数 || 0 }}</div>
            <div class="stat-label">采集图片</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon" style="background: #f56c6c"><el-icon><User /></el-icon></div>
          <div>
            <div class="stat-value">{{ stats.采集人数 || 0 }}</div>
            <div class="stat-label">采集人数</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top: 16px">
      <el-col :span="12">
        <div class="page-card">
          <div class="section-title">📊 业态分布</div>
          <v-chart :option="categoryOption" style="height: 320px" autoresize />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-card">
          <div class="section-title">👤 采集人贡献</div>
          <v-chart :option="collectorOption" style="height: 320px" autoresize />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="page-card">
          <div class="section-title">📋 报备状态</div>
          <v-chart :option="statusOption" style="height: 280px" autoresize />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="page-card">
          <div class="section-title">ℹ️ 数据说明</div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="数据源">飞书 Excel 自动同步</el-descriptions-item>
            <el-descriptions-item label="读取目录">~/Desktop/ATL数据采集场景报备/</el-descriptions-item>
            <el-descriptions-item label="图片目录">作业场景采集报备/</el-descriptions-item>
            <el-descriptions-item label="后端地址">http://localhost:3001</el-descriptions-item>
          </el-descriptions>
        </div>
      </el-col>
    </el-row>
  </div>
</template>