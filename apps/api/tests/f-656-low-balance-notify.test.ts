// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-656 回归锁(2026-11-13)。
 *
 * 病灶:`checkAndNotifyLowBalance` 先写冷却再发送 —— 一次 SMTP 失败即静默 24h;
 * 且 `Number(process.env...)` 无校验,非法 COOLDOWN 退化成 0(每次扣费都发,邮件风暴)、
 * 非法阈值退化成 NaN/0(告警永久失效)。
 *
 * 本文件锁:
 *   ① 发送失败不写冷却:下一次调用仍会重试发送;
 *   ② 发送成功才写冷却:紧接着的调用被冷却拦截;
 *   ③ 冷却期满(24h)后恢复发送;
 *   ④ 阈值 env 非法 → 回退默认 1000 分,告警不失效且只 warn 一次;
 *   ⑤ 冷却 env 非法 → 回退默认 24h,冷却仍生效(不产生邮件风暴)。
 *
 * 只 mock nodemailer / db / logger,时钟用 vi.useFakeTimers,不触达真实 SMTP、PG。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// =============================================================================
// Mock 声明(hoisted)
// =============================================================================

const { mockDbReadSelect, mockSendMail, mockCreateTransport, mockLoggerWarn } = vi.hoisted(() => ({
  mockDbReadSelect: vi.fn(),
  mockSendMail: vi.fn(),
  mockCreateTransport: vi.fn(),
  mockLoggerWarn: vi.fn(),
}))

// 链式查询 mock(口径同 mail-relay-notifier.test.ts)
function chain(returnValue: unknown): { from: ReturnType<typeof vi.fn> } {
  const promise: any = Promise.resolve(returnValue)
  promise.limit = vi.fn().mockReturnValue(promise)
  promise.where = vi.fn().mockReturnValue(promise)
  promise.from = vi.fn().mockReturnValue(promise)
  return { from: promise.from }
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
  default: { createTransport: mockCreateTransport },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: mockLoggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

interface NotifyParams {
  userId: string
  keyId: string
  keyName: string
  tokenBalance: number
  costBalanceCents: number
}

function makeParams(userId: string): NotifyParams {
  return {
    userId,
    keyId: `${userId}-key`,
    keyName: `${userId}-key`,
    tokenBalance: 0,
    costBalanceCents: 0,
  }
}

/** env 在模块加载期解析 ⇒ 每个用例前 resetModules 再动态 import,拿到干净的模块状态(冷却 Map)。 */
async function loadNotifier() {
  vi.resetModules()
  return import('../src/services/mail-relay-notifier.js')
}

const DAY_MS = 86_400_000

describe('F-656 余额不足邮件:发送成功才写冷却 / env 安全解析', () => {
  const ORIG_ENV = { ...process.env }

  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.test'
    process.env.SMTP_PORT = '465'
    process.env.SMTP_USER = 'user@test'
    process.env.SMTP_PASS = 'pass'
    process.env.SMTP_FROM = 'noreply@aizhs.top'
    delete process.env.LOW_BALANCE_NOTIFY_COOLDOWN_MS
    delete process.env.LOW_BALANCE_NOTIFY_THRESHOLD_CENTS
    mockDbReadSelect.mockReset().mockReturnValue(chain([{ email: 'low@example.com' }]))
    mockSendMail.mockReset()
    mockCreateTransport.mockReset().mockReturnValue({ sendMail: mockSendMail })
    mockLoggerWarn.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...ORIG_ENV }
  })

  // ① SMTP 失败不占冷却窗口 —— 一次失败曾让该用户静默 24h
  it('① 发送失败不写冷却:下一次调用仍会重试发送', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('smtp down'))
    const { checkAndNotifyLowBalance } = await loadNotifier()

    expect(await checkAndNotifyLowBalance(makeParams('u-fail'))).toBe(false)
    expect(mockSendMail).toHaveBeenCalledTimes(1)

    mockSendMail.mockResolvedValueOnce({ messageId: 'ok' })
    expect(await checkAndNotifyLowBalance(makeParams('u-fail'))).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(2)
  })

  // ② 发送成功才写冷却:紧接的调用直接 false 且不再查库/发信
  it('② 发送成功才写冷却:成功后冷却期内拦截', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'ok' })
    const { checkAndNotifyLowBalance } = await loadNotifier()

    expect(await checkAndNotifyLowBalance(makeParams('u-ok'))).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockDbReadSelect).toHaveBeenCalledTimes(2) // 主邮箱 + 附加邮箱

    expect(await checkAndNotifyLowBalance(makeParams('u-ok'))).toBe(false)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockDbReadSelect).toHaveBeenCalledTimes(2) // 冷却内不查库
  })

  // ③ 冷却窗口默认 24h,到期后恢复提醒
  it('③ 冷却期满 24h 后可再次发送', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'ok' })
    const { checkAndNotifyLowBalance } = await loadNotifier()

    expect(await checkAndNotifyLowBalance(makeParams('u-expire'))).toBe(true)
    vi.setSystemTime(Date.now() + DAY_MS - 1)
    expect(await checkAndNotifyLowBalance(makeParams('u-expire'))).toBe(false)
    vi.setSystemTime(Date.now() + 1)
    expect(await checkAndNotifyLowBalance(makeParams('u-expire'))).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(2)
  })

  // ④ 阈值非法(非数字)→ 回退 1000 分,不能退化成 0/NaN 导致告警永久失效
  it('④ 阈值 env 非法 → 回退默认 1000 分,告警不失效且 warn 一次', async () => {
    process.env.LOW_BALANCE_NOTIFY_THRESHOLD_CENTS = 'not-a-number'
    mockSendMail.mockResolvedValue({ messageId: 'ok' })
    const { checkAndNotifyLowBalance } = await loadNotifier()

    const res = await checkAndNotifyLowBalance({
      ...makeParams('u-env-threshold'),
      tokenBalance: 10,
      costBalanceCents: 500, // < 默认阈值 1000 ⇒ 应告警
    })
    expect(res).toBe(true)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[mail-notify] 环境变量非法,回退默认值',
      expect.objectContaining({
        name: 'LOW_BALANCE_NOTIFY_THRESHOLD_CENTS',
        fallback: 1000,
      }),
    )
  })

  // ⑤ 冷却非法(非数字)→ 回退 24h,不能退化成 0 造成每次扣费都发
  it('⑤ 冷却 env 非法 → 回退默认 24h,冷却仍生效', async () => {
    process.env.LOW_BALANCE_NOTIFY_COOLDOWN_MS = 'bogus'
    mockSendMail.mockResolvedValue({ messageId: 'ok' })
    const { checkAndNotifyLowBalance } = await loadNotifier()

    expect(await checkAndNotifyLowBalance(makeParams('u-env-cooldown'))).toBe(true)
    vi.setSystemTime(Date.now() + 60 * 60 * 1000) // 1h 后仍在默认 24h 冷却内
    expect(await checkAndNotifyLowBalance(makeParams('u-env-cooldown'))).toBe(false)
    expect(mockSendMail).toHaveBeenCalledTimes(1)
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[mail-notify] 环境变量非法,回退默认值',
      expect.objectContaining({
        name: 'LOW_BALANCE_NOTIFY_COOLDOWN_MS',
        fallback: 86400000,
      }),
    )
  })
})
