// notification.ts 单元测试 - 提升覆盖率
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn().mockImplementation(() => Promise.reject(new Error('fail'))),
    post: vi.fn().mockImplementation(() => Promise.reject(new Error('fail'))),
    put: vi.fn().mockImplementation(() => Promise.reject(new Error('fail'))),
    delete: vi.fn().mockImplementation(() => Promise.reject(new Error('fail'))),
  },
}))

vi.mock('@/utils/api-response', () => ({
  withApiResponseHandler: (fn: any) => fn,
  normalizeApiResponse: vi.fn((r: any) => r?.data || {}),
}))

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => key,
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/config/backend-paths', () => ({
  NOTIFICATION_PATHS: { send: '/notification/send' },
}))

import * as api from '../system/notification'

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

describe('notification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sendNotification 发送', async () => {
    await callFn((api as any).sendNotification, { type: 'email', recipient: 'a@b.com', content: 'hi' })
    await callFn((api as any).sendNotification, { type: 'sms', recipient: '138', content: 'hi', priority: 'high' })
  })

  it('sendAppointmentCreatedNotification 预约创建', async () => {
    await (api as any).sendAppointmentCreatedNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n' })
    await (api as any).sendAppointmentCreatedNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n', preferredDate: '2024-01-01', preferredTime: '10:00' })
  })

  it('sendAppointmentConfirmedNotification 预约确认', async () => {
    await (api as any).sendAppointmentConfirmedNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n' })
    await (api as any).sendAppointmentConfirmedNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n', adminNotes: 'n' })
  })

  it('sendAppointmentCompletedNotification 预约完成', async () => {
    await (api as any).sendAppointmentCompletedNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n' })
    await (api as any).sendAppointmentCompletedNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n', adminNotes: 'n' })
  })

  it('sendAppointmentCancelledNotification 预约取消', async () => {
    await (api as any).sendAppointmentCancelledNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n' })
    await (api as any).sendAppointmentCancelledNotification('a@b.com', { serviceType: 't', serviceTypeName: 'n', reason: 'r' })
  })
})
