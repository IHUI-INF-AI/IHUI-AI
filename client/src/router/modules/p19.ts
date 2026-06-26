import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'
import { loadModule, getCurrentLocale } from '@/locales'

// 2026-06-26: 路由级 i18n 模块预加载辅助函数
function preloadI18n(modules: string[]) {
  return async () => {
    if (modules.length === 0) return
    const locale = getCurrentLocale()
    await Promise.all(modules.map((m) => loadModule(locale, m).catch(() => undefined)))
  }
}

export const p19Routes: Array<RouteRecordRaw> = [
  {
    path: '/p19/admin-dashboard',
    name: 'p19AdminDashboard',
    component: safeImport(
      () => import('@/views/p19/P19AdminDashboard.vue'),
      'P19AdminDashboard'
    ),
    meta: {
      title: 'P19 Admin 仪表盘',
      description: '管理员仪表盘 (P19 业务组件)',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['p19AdminDashboard']),
  },
  {
    path: '/p19/courses',
    name: 'p19CoursesList',
    component: safeImport(
      () => import('@/views/p19/P19CoursesList.vue'),
      'P19CoursesList'
    ),
    meta: {
      title: 'P19 课程列表',
      description: '课程展示 + 报名 (P19 业务组件)',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['p19CoursesList']),
  },
  {
    path: '/p19/agents',
    name: 'p19AgentsList',
    component: safeImport(
      () => import('@/views/p19/P19AgentsList.vue'),
      'P19AgentsList'
    ),
    meta: {
      title: 'P19 智能体',
      description: '智能体展示 + 调用 (P19 业务组件)',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['p19AgentsList']),
  },
  {
    path: '/p19/payment',
    name: 'p19PaymentMethods',
    component: safeImport(
      () => import('@/views/p19/P19PaymentMethods.vue'),
      'P19PaymentMethods'
    ),
    meta: {
      title: 'P19 支付方式',
      description: '支付方式 + 余额 (P19 业务组件)',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['p19PaymentMethods']),
  },
]
