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
 * ⑥ 多邮箱合并去重(主邮箱 + 附加邮箱,主邮箱优先)
 * ⑦ 附加邮箱(user_emails)查询失败 → 降级仅主邮箱
 * ⑧ 无主邮箱但有附加邮箱 → 仍发送到附加邮箱
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

// db 异常链:where 阶段 reject(模拟无 limit 的列表查询失败,如 user_emails)
function rejectAtWhere(err: Error): { from: ReturnType<typeof vi.fn> } {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockRejectedValue(err),
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
  userEmails: { userId: 'user_id', email: 'email' },
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

  // ⑥ 多邮箱合并去重(主邮箱优先)
  it('⑥ 多邮箱 → 主邮箱 + 附加邮箱合并去重且主邮箱优先', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(chain([{ email: 'main@example.com' }]))
      .mockReturnValueOnce(
        chain([
          { email: 'extra2@example.com' },
          { email: 'main@example.com' }, // 与主邮箱重复,应去重
          { email: 'extra1@example.com' },
        ]),
      )
    const res = await checkAndNotifyLowBalance({
      userId: 'user-multi',
      keyId: 'key-multi',
      keyName: 'key-multi',
      tokenBalance: 10,
      costBalanceCents: 500,
    })
    expect(res).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const arg = mockSendMail.mock.calls[0]?.[0]
    expect(arg?.to).toBe('main@example.com,extra2@example.com,extra1@example.com')
  })

  // ⑦ 附加邮箱(user_emails)查询失败 → 降级仅主邮箱
  it('⑦ 附加邮箱查询失败 → 降级仅主邮箱发送', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(chain([{ email: 'main@example.com' }]))
      .mockReturnValueOnce(rejectAtWhere(new Error('user_emails down')))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-degrade',
      keyId: 'key-degrade',
      keyName: 'key-degrade',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    expect(res).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const arg = mockSendMail.mock.calls[0]?.[0]
    expect(arg?.to).toBe('main@example.com')
  })

  // ⑧ 无主邮箱但有附加邮箱 → 仍发送到附加邮箱
  it('⑧ 无主邮箱但有附加邮箱 → 发送到附加邮箱', async () => {
    mockDbReadSelect
      .mockReturnValueOnce(chain([{ email: null }]))
      .mockReturnValueOnce(chain([{ email: 'extra-only@example.com' }]))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-extra-only',
      keyId: 'key-eo',
      keyName: 'key-eo',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    expect(res).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    const arg = mockSendMail.mock.calls[0]?.[0]
    expect(arg?.to).toBe('extra-only@example.com')
  })

  // ⑨ From 必须是品牌身份（2026-11-10 定案）
  //
  // 此前这里是 `const from = process.env.SMTP_FROM` 整串直传：配置里写什么显示名就寄什么，
  // 写裸地址时收件箱显示 `noreply`，与告警派发器的身份口径完全脱节。
  it('⑨ From 恒为品牌名，配置里的显示名不生效', async () => {
    // SMTP_USER=user@test（beforeEach），配置里给另一个地址 ⇒ 地址回落登录账号。
    // 两条老路一次堵死：显示名不采用配置里的「智汇AI官方」，地址也不采用不一致的 noreply。
    process.env.SMTP_FROM = '智汇AI官方 <noreply@aizhs.top>'
    mockDbReadSelect.mockReturnValueOnce(chain([{ email: 'u@example.com' }]))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-from',
      keyId: 'key-from',
      keyName: 'key-from',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    expect(res).toBe(true)
    const arg = mockSendMail.mock.calls[0]?.[0]
    expect(arg?.from).toBe('"智汇AI" <user@test>')
    expect(String(arg?.from)).not.toContain('智汇AI官方')
  })

  // ⑩ 地址段必须等于登录账号（否则 QQ 中继 550 拒信 → 用户永远收不到余额预警）
  it('⑩ SMTP_FROM 地址与 SMTP_USER 不一致 → 回落登录账号', async () => {
    process.env.SMTP_USER = '502319984@qq.com'
    process.env.SMTP_FROM = '智汇AI <noreply@aizhs.top>'
    mockDbReadSelect.mockReturnValueOnce(chain([{ email: 'u@example.com' }]))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-from2',
      keyId: 'key-from2',
      keyName: 'key-from2',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    expect(res).toBe(true)
    expect(mockSendMail.mock.calls[0]?.[0]?.from).toBe('"智汇AI" <502319984@qq.com>')
  })

  // ⑪ SMTP_FROM 缺省不再等于"未配置"：地址可由 SMTP_USER 补足
  it('⑪ SMTP_FROM 留空 → 用 SMTP_USER 作地址，仍照常投递', async () => {
    delete process.env.SMTP_FROM
    mockDbReadSelect.mockReturnValueOnce(chain([{ email: 'u@example.com' }]))
    const res = await checkAndNotifyLowBalance({
      userId: 'user-from3',
      keyId: 'key-from3',
      keyName: 'key-from3',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    expect(res).toBe(true)
    expect(mockSendMail.mock.calls[0]?.[0]?.from).toBe('"智汇AI" <user@test>')
  })

  // ⑫ transporter 必须钉住 IPv4 + 三段超时（IPv6 ENETUNREACH 曾让通知静默失败）
  it('⑫ transporter 带 family:4 与三段超时', async () => {
    mockDbReadSelect.mockReturnValueOnce(chain([{ email: 'u@example.com' }]))
    await checkAndNotifyLowBalance({
      userId: 'user-opts',
      keyId: 'key-opts',
      keyName: 'key-opts',
      tokenBalance: 0,
      costBalanceCents: 0,
    })
    const opts = mockCreateTransport.mock.calls[0]?.[0]
    expect(opts?.family).toBe(4)
    expect(opts?.connectionTimeout).toBeGreaterThan(0)
    expect(opts?.greetingTimeout).toBeGreaterThan(0)
    expect(opts?.socketTimeout).toBeGreaterThan(0)
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
