import type { RouteRecordRaw } from 'vue-router'
import { safeImport } from '../utils/componentLoader'

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
  },
]
