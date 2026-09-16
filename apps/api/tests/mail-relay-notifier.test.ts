// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 余额不足邮件通知服务单测(2026-09-16 立)。
 *
 * 覆盖点:
 * ① SMTP 未配置 → false 且不抛
 * ② 24h 冷却内第二次 → false 不重发
 * ③ 余额低于阈值 → 调用 transporter.sendMail 一次且收件人正确
 * ④ 余额充足 → false 不发送
 * ⑤ checkAndNotify 内部 db 异常 → false 不抛
 *
 * 测试模式:vi.mock 掉 db / @ihui/database / nodemailer(对齐 api-subscription-service.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// =============================================================================
// Mock 声明(hoisted)
// =============================================================================

const { mockDbReadSelect, mockSendMail, mockCreateTransport } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockSendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  mockCreateTransport: vi.fn(),
}))

// 链式查询 mock(对齐 api-subscription-service.test.ts)
function chain(returnValue: unknown): { from: ReturnType<typeof vi.fn> } {
  const promise: any = Promise.resolve(returnValue)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.offset = vi.fn().mockReturnValue(promise)
  promise.orderBy = vi.fn().mockReturnValue(promise)
  promise.groupBy = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.leftJoin = vi.fn().mockReturnValue(promise)
  promise.from = vi.fn().mockReturnValue(promise)
  return { from: promise.from }
}

// db 异常链:limit 阶段 reject(模拟查询失败)
function rejectChain(err: Error): { from: ReturnType<typeof vi.fn> } {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockRejectedValue(err),
      }),
    }),
  }
}

vi.mock('../src/db/index.js', () => ({
  db: { insert: vi.fn(), update: vi.fn(), transaction: vi.fn() },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))

vi.mock('@ihui/database', () => ({
  users: { id: 'id', email: 'email' },
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}))

import {
  sendLowBalanceMail,
  checkAndNotifyLowBalance,
} from '../src/services/mail-relay-notifier.js'

// createTransport 返回带 sendMail 的 transporter
beforeEach(() => {
  mockCreateTransport.mockReturnValue({ sendMail: mockSendMail })
})

// =============================================================================
// 测试
// =============================================================================

describe('mail-relay-notifier', () => {
  const ORIG_ENV = { ...process.env }

  beforeEach(() => {
    // 默认打开 SMTP 配置
    process.env.SMTP_HOST = 'smtp.test'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_USER = 'user@test'
    process.env.SMTP_PASS = 'pass'
    process.env.SMTP_FROM = 'noreply@aizhs.top'
    mockSendMail.mockClear()
    mockCreateTransport.mockClear()
    mockDbReadSelect.mockReset()
  })

  afterEach(() => {
    process.env = { ...ORIG_ENV }
  })

  // ① SMTP 未配置 → false 且不抛
  it('① SMTP 未配置 → 返回 false 且不抛错', async () => {
    delete process.env.SMTP_HOST
    const res = await sendLowBalanceMail({
      to: ['u@example.com'],
      keyName: 'key-1',
      tokenBalance: 0,
      costBalanceCents: 0,
      thresholdCents: 1000,
    })
    expect(res).toBe(false)
    expect(mockSendMail).not.toHaveBeenCalled()
  })

  // ② 24h 冷却内第二次 → false 不重发
  it('② 24h 冷却内第二次调用 → 返回 false 且不再发送', async () => {
    mockDbReadSelect.mockReturnValue(chain([{ email: 'u2@example.com' }]))
    const p: CheckAndNotifyLowBalanceParams = {
      userId: 'user-cooldown',
      keyId: 'key-cd',
      keyName: 'key-cooldown',
      tokenBalance: 0,
      costBalanceCents: 0,
    }
    const first = await checkAndNotifyLowBalance(p)
    expect(first).toBe(true)
    const second = await checkAndNotifyLowBalance(p)
    expect(second).toBe(false)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
  })

  // ③ 余额低于阈值 → 调用 sendMail 一次且收件人正确
  it('③ 余额低于阈值 → 发送一次且收件人正确', async () => {
    mockDbReadSelect.mockReturnValue(chain([{ email: 'low@example.com' }]))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-low',
      keyId: 'key-low',
      keyName: 'key-low',
      tokenBalance: 10,
      costBalanceCents: 500, // < 1000 阈值
    })
    expect(res).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const arg = mockSendMail.mock.calls[0]?.[0]
    expect(arg?.to).toBe('low@example.com')
  })

  // ④ 余额充足 → false 不发送
  it('④ 余额充足 → 返回 false 且不发送', async () => {
    const res = await checkAndNotifyLowBalance({
      userId: 'user-ok',
      keyId: 'key-ok',
      keyName: 'key-ok',
      tokenBalance: 99999,
      costBalanceCents: 5000, // >= 1000 阈值
    })
    expect(res).toBe(false)
    expect(mockSendMail).not.toHaveBeenCalled()
    expect(mockDbReadSelect).not.toHaveBeenCalled()
  })

  // ⑤ checkAndNotify 内部 db 异常 → false 不抛
  it('⑤ checkAndNotify 内部 db 异常 → 返回 false 且不抛', async () => {
    mockDbReadSelect.mockReturnValue(rejectChain(new Error('db down')))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-dberr',
      keyId: 'key-err',
      keyName: 'key-err',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    expect(res).toBe(false)
    expect(mockSendMail).not.toHaveBeenCalled()
  })
})

// 测试内复用参数类型(避免重复 import,保持文件自洽)
interface CheckAndNotifyLowBalanceParams {
  userId: string
  keyId: string
  keyName: string
  tokenBalance: number
  costBalanceCents: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
