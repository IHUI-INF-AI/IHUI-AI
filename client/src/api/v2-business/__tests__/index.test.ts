// v2-business/index.ts 单元测试
// 2026-06-21: v2-business 已简化为纯 v1 调用, 测试改为验证 v1 转发逻辑
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api/agent/agent/agents', () => ({
  getAgentsList: vi.fn(() => Promise.resolve({ list: [], total: 0 })),
  getAgentDetail: vi.fn(() => Promise.resolve({ id: 'a1' })),
}))

vi.mock('@/api/course/course/courses', () => ({
  getCoursesList: vi.fn(() => Promise.resolve({ list: [], total: 0 })),
  getCourseDetail: vi.fn(() => Promise.resolve({ id: 'c1' })),
  enrollCourse: vi.fn(() => Promise.resolve({ ok: true })),
}))

vi.mock('@/api/payment/orders', () => ({
  getOrders: vi.fn(() => Promise.resolve({ list: [], total: 0 })),
  getOrderDetail: vi.fn(() => Promise.resolve({ id: 'o1' })),
  cancelOrder: vi.fn(() => Promise.resolve({ ok: true })),
  confirmOrder: vi.fn(() => Promise.resolve({ ok: true })),
  createOrder: vi.fn(() => Promise.resolve({ id: 'o1' })),
}))

vi.mock('@/api/user/user', () => ({
  getUserInfo: vi.fn(() => Promise.resolve({ id: 'u1' })),
  updateUserInfo: vi.fn(() => Promise.resolve({ ok: true })),
  uploadAvatar: vi.fn(() => Promise.resolve({ url: 'x' })),
}))

import * as api from '../index'
import * as v1Agents from '@/api/agent/agent/agents'
import * as v1Courses from '@/api/course/course/courses'
import * as v1Orders from '@/api/payment/orders'
import * as v1User from '@/api/user/user'

describe('v2-business (纯 v1 调用)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('v2Agents.list 转发到 v1Agents.getAgentsList', async () => {
    await api.v2Agents.list({ page: 2, size: 10, keyword: 'x', category: 'y' })
    expect(v1Agents.getAgentsList).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      keyword: 'x',
      category: 'y',
    })
  })

  it('v2Agents.list 使用默认值', async () => {
    await api.v2Agents.list()
    expect(v1Agents.getAgentsList).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      keyword: undefined,
      category: undefined,
    })
  })

  it('v2Agents.info 转发到 v1Agents.getAgentDetail', async () => {
    await api.v2Agents.info('a1')
    expect(v1Agents.getAgentDetail).toHaveBeenCalledWith('a1')
  })

  it('v2Courses.list 转发到 v1Courses.getCoursesList', async () => {
    await api.v2Courses.list({ page: 2, size: 5, keyword: 'k' })
    expect(v1Courses.getCoursesList).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
      keyword: 'k',
    })
  })

  it('v2Courses.detail 转发到 v1Courses.getCourseDetail', async () => {
    await api.v2Courses.detail('c1')
    expect(v1Courses.getCourseDetail).toHaveBeenCalledWith('c1')
  })

  it('v2Courses.enroll 转发到 v1Courses.enrollCourse', async () => {
    await api.v2Courses.enroll('c1')
    expect(v1Courses.enrollCourse).toHaveBeenCalledWith('c1')
  })

  it('v2Orders.list 转发到 v1Orders.getOrders', async () => {
    await api.v2Orders.list({ page: 1, pageSize: 10, status: 'paid' })
    expect(v1Orders.getOrders).toHaveBeenCalledWith({ page: 1, pageSize: 10, status: 'paid' })
  })

  it('v2Orders.detail 转发到 v1Orders.getOrderDetail', async () => {
    await api.v2Orders.detail('o1')
    expect(v1Orders.getOrderDetail).toHaveBeenCalledWith('o1')
  })

  it('v2Orders.cancel 转发到 v1Orders.cancelOrder', async () => {
    await api.v2Orders.cancel('o1')
    expect(v1Orders.cancelOrder).toHaveBeenCalledWith('o1')
  })

  it('v2Orders.confirm 转发到 v1Orders.confirmOrder', async () => {
    await api.v2Orders.confirm('o1')
    expect(v1Orders.confirmOrder).toHaveBeenCalledWith('o1')
  })

  it('v2Orders.create 转发到 v1Orders.createOrder', async () => {
    const body = { productId: 'p1', amount: 100, paymentMethod: 'alipay', remark: 'r' }
    await api.v2Orders.create(body)
    expect(v1Orders.createOrder).toHaveBeenCalledWith(body)
  })

  it('v2User.profile 转发到 v1User.getUserInfo', async () => {
    await api.v2User.profile()
    expect(v1User.getUserInfo).toHaveBeenCalled()
  })

  it('v2User.updateProfile 转发到 v1User.updateUserInfo', async () => {
    const body = { name: 'a' }
    await api.v2User.updateProfile(body)
    expect(v1User.updateUserInfo).toHaveBeenCalledWith(body)
  })

  it('v2User.updateAvatar 转发到 v1User.uploadAvatar', async () => {
    const file = new File([], 'a.txt')
    await api.v2User.updateAvatar(file)
    expect(v1User.uploadAvatar).toHaveBeenCalledWith(file)
  })

  it('probeV2Available 始终返回 false', async () => {
    const r = await api.probeV2Available()
    expect(r).toBe(false)
  })

  it('probeV2Available 忽略参数', async () => {
    const r = await api.probeV2Available('/any/path')
    expect(r).toBe(false)
  })
})
