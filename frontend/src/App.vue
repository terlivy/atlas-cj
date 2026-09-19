<script setup>
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()
const router = useRouter()

const activeMenu = computed(() => {
  if (route.path.startsWith('/scenes/')) return '/scenes'
  return route.path
})

const menuItems = [
  { path: '/dashboard', label: '数据看板', icon: 'DataAnalysis' },
  { path: '/scenes',     label: '场景列表', icon: 'Grid' },
  { path: '/records',    label: '报备明细', icon: 'List' },
  { path: '/categories', label: '业态字典', icon: 'Files' },
  { path: '/generate',   label: '生成 Word', icon: 'Document' },
]
</script>

<template>
  <el-container style="height: 100vh">
    <el-aside width="220px" style="background: #001529; color: #fff">
      <div style="padding: 20px; font-size: 16px; font-weight: 700; color: #fff">
        📋 ATL 场景报备
      </div>
      <el-menu
        :default-active="activeMenu"
        background-color="#001529"
        text-color="#bfcbd9"
        active-text-color="#ffd04b"
        @select="(p) => router.push(p)"
      >
        <el-menu-item v-for="m in menuItems" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.label }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header style="background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.05); display: flex; align-items: center">
        <h2 style="margin: 0; font-size: 18px; color: #303133">
          {{ menuItems.find(m => m.path === activeMenu)?.label || '场景详情' }}
        </h2>
        <div style="margin-left: auto; font-size: 13px; color: #909399">
          数据源：飞书 Excel 自动读取
        </div>
      </el-header>
      <el-main style="background: var(--bg); padding: 20px; overflow: auto">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>