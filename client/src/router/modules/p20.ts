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

export const p20Routes: Array<RouteRecordRaw> = [
  {
    path: '/p20/dashboard-echarts',
    name: 'p20DashboardEcharts',
    component: safeImport(
      () => import('@/views/p20/P20DashboardEcharts.vue'),
      'P20DashboardEcharts'
    ),
    meta: {
      title: 'P20 业务图表仪表盘',
      description: 'echarts 集成 - 营收趋势/订单分布/智能体活跃度 (P20)',
      requiresAuth: true,
    },
    beforeEnter: preloadI18n(['p20DashboardEcharts']),
  },
]
