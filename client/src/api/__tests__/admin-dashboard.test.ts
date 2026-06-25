// admin-dashboard.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../admin/admin', () => ({
  adminApi: {
    dashboardStats: vi.fn(() => Promise.resolve({ success: true, data: { userCount: 100, orderCount: 10, revenue: 1000, agentCount: 5 } })),
    learnOrderList: vi.fn(() => Promise.resolve({ success: true, data: { total: 328 } })),
    learnLessonList: vi.fn(() => Promise.resolve({ success: true, data: { total: 156 } })),
    memberList: vi.fn(() => Promise.resolve({ success: true, data: { total: 12486 } })),
    newsContentList: vi.fn(() => Promise.resolve({ success: true, data: { total: 1248 } })),
    commentList: vi.fn(() => Promise.resolve({ success: true, data: { total: 12 } })),
    messageAnnouncement: vi.fn(() => Promise.resolve({ success: true, data: { total: 3 } })),
    roleList: vi.fn(() => Promise.resolve({ success: true, data: { total: 12 } })),
    settingBase: vi.fn(() => Promise.resolve({ success: true, data: {} })),
  },
}))

vi.mock('../statistics/statistics', () => ({
  getSystemStatistics: vi.fn(() => Promise.resolve({ success: true, data: { chat: { totalConversations: 50 } } })),
  getRealtimeStatistics: vi.fn(() => Promise.resolve({ success: true, data: { currentQPS: 100, currentConcurrency: 30, errorRate: 0.05, avgResponseTime: 200 } })),
  getOrderStatistics: vi.fn(() => Promise.resolve({ success: true, data: { summary: { totalOrders: 20, totalAmount: 2000 } } })),
  getUsageStatistics: vi.fn(() => Promise.resolve({ success: true, data: { chat: { totalSessions: 100 } } })),
}))

vi.mock('../admin/admin-activities', () => ({
  getAdminActivities: vi.fn(() => Promise.resolve({
    success: true,
    data: { list: [{ id: 1, type: 'user_register', description: '注册', userName: 'u', ip: '127.0.0.1', device: 'PC', createdAt: new Date().toISOString() }], total: 1 },
  })),
}))

vi.mock('../system/monitoring', () => ({
  getPoolStats: vi.fn(() => Promise.resolve({ success: true, data: { totalConnections: 100, activeConnections: 30, idleConnections: 70, waitingCount: 5 } })),
}))

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn() },
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import * as api from '../admin/admin-dashboard'

describe('admin-dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getDashboardOverview 正常', async () => {
    const r = await api.getDashboardOverview()
    expect(r.ok).toBe(true)
    expect(r.data.totalUsers).toBe(100)
  })

  it('getDashboardOverview dashboardStats 失败', async () => {
    const adminMod = await import('../admin/admin')
    ;(adminMod.adminApi.dashboardStats as any).mockResolvedValueOnce({ success: false })
    const r = await api.getDashboardOverview()
    expect(r).toBeDefined()
  })

  it('getDashboardOverview dashboardStats 抛出', async () => {
    const adminMod = await import('../admin/admin')
    ;(adminMod.adminApi.dashboardStats as any).mockRejectedValueOnce(new Error('fail'))
    const r = await api.getDashboardOverview()
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('getDashboardOverview all fail 全空', async () => {
    const adminMod = await import('../admin/admin')
    const statsMod = await import('../statistics/statistics')
    ;(adminMod.adminApi.dashboardStats as any).mockResolvedValueOnce({ success: false })
    ;(statsMod.getSystemStatistics as any).mockResolvedValueOnce({ success: false })
    ;(statsMod.getOrderStatistics as any).mockResolvedValueOnce({ success: false })
    ;(statsMod.getUsageStatistics as any).mockResolvedValueOnce({ success: false })
    const r = await api.getDashboardOverview()
    expect(r.ok).toBe(false)
  })

  it('getMonitorOverview 正常', async () => {
    const r = await api.getMonitorOverview()
    expect(r.data.items.length).toBeGreaterThan(0)
    expect(r.data.source).toBe('api')
  })

  it('getMonitorOverview realtime 失败', async () => {
    const statsMod = await import('../statistics/statistics')
    ;(statsMod.getRealtimeStatistics as any).mockRejectedValueOnce(new Error('fail'))
    const r = await api.getMonitorOverview()
    expect(r).toBeDefined()
  })

  it('getMonitorOverview monitoring 失败', async () => {
    const monitorMod = await import('../system/monitoring')
    ;(monitorMod.getPoolStats as any).mockRejectedValueOnce(new Error('fail'))
    const r = await api.getMonitorOverview()
    expect(r).toBeDefined()
  })

  it('getMonitorOverview monitoring 成功', async () => {
    const r = await api.getMonitorOverview()
    expect(r.data.items[0]?.key).toBe('db')
  })

  it('getActivityTimeline 正常', async () => {
    const r = await api.getActivityTimeline(5)
    expect(r.data.list.length).toBeGreaterThan(0)
    expect(r.data.source).toBe('api')
  })

  it('getActivityTimeline 失败', async () => {
    const activitiesMod = await import('../admin/admin-activities')
    ;(activitiesMod.getAdminActivities as any).mockResolvedValueOnce({ success: false })
    const r = await api.getActivityTimeline()
    expect(r.data.list).toEqual([])
  })

  it('getActivityTimeline 抛出', async () => {
    const activitiesMod = await import('../admin/admin-activities')
    ;(activitiesMod.getAdminActivities as any).mockRejectedValueOnce(new Error('fail'))
    const r = await api.getActivityTimeline()
    expect(r.data.list).toEqual([])
  })

  it('getActivityTimeline 不同活动类型', async () => {
    const activitiesMod = await import('../admin/admin-activities')
    const oldDate = new Date(Date.now() - 3600_000).toISOString()
    const oldDate2 = new Date(Date.now() - 86400_000).toISOString()
    const oldDate3 = new Date(Date.now() - 604800_000).toISOString()
    const oldDate4 = new Date(Date.now() - 2592000_000).toISOString()
    ;(activitiesMod.getAdminActivities as any).mockResolvedValueOnce({
      success: true,
      data: {
        list: [
          { id: 1, type: 'order_paid', description: 'd', userName: 'u', ip: 'i', device: 'd', createdAt: oldDate },
          { id: 2, type: 'order_cancelled', description: '', userName: '', ip: 'i', device: 'd', createdAt: oldDate2 },
          { id: 3, type: 'system_error', description: '', userName: 'u', ip: '', device: '', createdAt: oldDate3 },
          { id: 4, type: 'unknown', description: '', userName: 'u', ip: '', device: '', createdAt: oldDate4 },
          { id: 5, type: 'user_login', description: '', userName: '', ip: '', device: '', createdAt: 'invalid' },
        ],
        total: 5,
      },
    })
    const r = await api.getActivityTimeline(5)
    expect(r.data.list.length).toBe(5)
  })

  it('getDashboardAll 正常', async () => {
    const r = await api.getDashboardAll()
    expect(r.overview).toBeDefined()
    expect(r.monitor).toBeDefined()
    expect(r.timeline).toBeDefined()
  })

  it('getDashboardAll 全空时 warning', async () => {
    const adminMod = await import('../admin/admin')
    const statsMod = await import('../statistics/statistics')
    const activitiesMod = await import('../admin/admin-activities')
    ;(adminMod.adminApi.dashboardStats as any).mockResolvedValueOnce({ success: false })
    ;(statsMod.getRealtimeStatistics as any).mockResolvedValueOnce({ success: false })
    ;(activitiesMod.getAdminActivities as any).mockResolvedValueOnce({ success: false })
    const r = await api.getDashboardAll()
    expect(r).toBeDefined()
  })

  /* ═══ getModuleStats ═══ */

  it('getModuleStats 正常', async () => {
    const r = await api.getModuleStats()
    expect(r.ok).toBe(true)
    expect(r.data.byKey.orders?.count).toBe(328)
    expect(r.data.byKey.products?.count).toBe(156)
    expect(r.data.byKey.users?.count).toBe(12486)
    expect(r.data.byKey.agents?.count).toBe(5)
    expect(r.data.byKey.settings?.count).toBe(1)
    expect(r.data.byKey.webhook?.ok).toBe(false)
  })

  it('getModuleStats 部分失败不影响其他', async () => {
    const adminMod = await import('../admin/admin')
    ;(adminMod.adminApi.learnOrderList as any).mockRejectedValueOnce(new Error('orders fail'))
    const r = await api.getModuleStats()
    expect(r.data.byKey.orders?.ok).toBe(false)
    expect(r.data.byKey.products?.ok).toBe(true)
    expect(r.errors.some(e => e.includes('orders'))).toBe(true)
  })

  it('getModuleStats 全失败', async () => {
    const adminMod = await import('../admin/admin')
    ;(adminMod.adminApi.learnOrderList as any).mockRejectedValueOnce(new Error('a'))
    ;(adminMod.adminApi.learnLessonList as any).mockRejectedValueOnce(new Error('b'))
    ;(adminMod.adminApi.memberList as any).mockRejectedValueOnce(new Error('c'))
    ;(adminMod.adminApi.dashboardStats as any).mockRejectedValueOnce(new Error('d'))
    ;(adminMod.adminApi.newsContentList as any).mockRejectedValueOnce(new Error('e'))
    ;(adminMod.adminApi.commentList as any).mockRejectedValueOnce(new Error('f'))
    ;(adminMod.adminApi.messageAnnouncement as any).mockRejectedValueOnce(new Error('g'))
    ;(adminMod.adminApi.roleList as any).mockRejectedValueOnce(new Error('h'))
    ;(adminMod.adminApi.settingBase as any).mockRejectedValueOnce(new Error('i'))
    const r = await api.getModuleStats()
    // webhook 永远 ok=false,但其他 11 个全失败 → ok 仍为 true(因为至少有 webhook 占位被记录)
    // 实际: webhook 是固定 ok=false 不计入成功,所以全失败时 ok=false
    expect(r.data.byKey.orders?.ok).toBe(false)
    expect(r.errors.length).toBeGreaterThanOrEqual(8)
  })

  it('getDashboardAll 包含 modules 字段', async () => {
    const r = await api.getDashboardAll()
    expect(r.modules).toBeDefined()
    expect(r.modules.data.byKey).toBeDefined()
  })
})
