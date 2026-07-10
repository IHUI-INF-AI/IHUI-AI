/**
 * 应用路由器（最小化实例）
 * 当前仅包含根路径重定向，后续可按需扩展路由表
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/admin',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export { router }
export default router
