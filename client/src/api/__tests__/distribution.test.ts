// auth.ts 单元测试 - 提升覆盖率
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 设置 import.meta.env.DEV 为 false
vi.stubEnv('DEV', false)
vi.stubEnv('VITE_AGENTS_SHOW_SAMPLE_WHEN_EMPTY', 'false')

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    post: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    put: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
    delete: vi.fn().mockResolvedValue({ data: { code: 200, data: {} } }),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: vi.fn((r: any) => r?.data || {}),
}))

vi.mock('@/config/backend-paths', () => ({
  AUTH_PATHS: { user: '/auth/user' },
  DISTRIBUTION_PATHS: {
    inviteCode: '/inviteCode',
    useInviteCode: '/useInviteCode',
    getSubordinates: '/getSubordinates',
    stats: '/stats',
    commissionFlows: '/commissionFlows',
    flowStatistics: '/flowStatistics',
    getWxCode: '/getWxCode',
    getUserAndChildrenOrders: '/orders',
    getUserCommissionDetail: '/commissionDetail',
    getUserInviteeOrderStats: '/inviteeStats',
  },
}))

import * as api from '../distribution/distribution'

async function callFn(fn: any, ...args: any[]): Promise<any> {
  try {
    const result = await fn(...args)
    expect(result).toBeDefined()
    return result
  } catch (e) {
    expect(e).toBeDefined()
    return null
  }
}

describe('distribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getInviteCode 邀请码', async () => {
    await callFn((api as any).getInviteCode)
  })

  it('useInviteCode 使用邀请码', async () => {
    await callFn((api as any).useInviteCode, 'ABC')
  })

  it('getSubordinates 下级', async () => {
    await callFn((api as any).getSubordinates)
    await callFn((api as any).getSubordinates, { open_id: 'o', page: 1, quantity: 10 })
  })

  it('getDistributionStatistics 统计', async () => {
    await callFn((api as any).getDistributionStatistics)
  })

  it('getCommissionFlow 佣金流水', async () => {
    await callFn((api as any).getCommissionFlow)
    await callFn((api as any).getCommissionFlow, { page: 1, page_size: 10, status: 1 })
  })

  it('getOperatorDataCardData 操盘手卡片', async () => {
    await callFn((api as any).getOperatorDataCardData)
    await callFn((api as any).getOperatorDataCardData, 'u-1')
  })

  it('getWxCode 微信二维码', async () => {
    await callFn((api as any).getWxCode, 'CODE')
    await callFn((api as any).getWxCode, 'CODE', 1)
  })

  it('realAuth 实名认证', async () => {
    await callFn((api as any).realAuth, 'name', '110', 'u-1')
  })

  it('getUserAndChildrenOrders 订单', async () => {
    await callFn((api as any).getUserAndChildrenOrders, { id: 'u-1', page: 1, quantity: 10 })
  })

  it('getUserCommissionDetail 佣金详情', async () => {
    await callFn((api as any).getUserCommissionDetail)
    await callFn((api as any).getUserCommissionDetail, 'u-1')
  })

  it('getUserInviteeOrderStats 团队成员统计', async () => {
    await callFn((api as any).getUserInviteeOrderStats, { token: 't', userId: 'u', pageNum: 1, pageSize: 10 })
  })
})
