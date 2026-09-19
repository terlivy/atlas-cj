import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue') },
  { path: '/scenes', name: 'Scenes', component: () => import('@/views/Scenes.vue') },
  { path: '/scenes/:name', name: 'SceneDetail', component: () => import('@/views/SceneDetail.vue'), props: true },
  { path: '/generate', name: 'Generate', component: () => import('@/views/Generate.vue') },
  { path: '/records', name: 'Records', component: () => import('@/views/Records.vue') },
  { path: '/categories', name: 'Categories', component: () => import('@/views/Categories.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})