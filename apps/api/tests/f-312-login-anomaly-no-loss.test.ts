// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-312 回归锁(2026-11-14 立)。
 *
 * 病灶:notifyLoginAnomaly 原实现先 markNotified(占位 6h)再发送;四个通道各自吞错、
 * 失败不抛。基础设施抖动时通道全失败 ⇒ key 已占位 ⇒ 期间被盗/撞库告警静默丢失且不再重试。
 *
 * 本文件锁:
 *   ① 通道全失败 ⇒ 不写去重键(下一 tick 可重试);
 *   ② 至少一个通道成功 ⇒ 写去重键(正常去重语义保留);
 *   ③ senders 返回布尔(不靠抛错),全成功时不重复通知第二遍(去重生效)。
 *
 * mock 所有出站依赖(db/email/webhook/sms),不连真实基础设施。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockDbReadSelect, mockDbTransaction, mockDbInsertValues, mockDbInsert } = vi.hoisted(
  () => ({
    mockDbReadSelect: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockDbInsertValues: vi.fn(),
    mockDbInsert: vi.fn(),
  }),
)
const { mockSendEmail, mockNotifyRelayEvent } = vi.hoisted(() => ({
  mockSendEmail: vi.fn(),
  mockNotifyRelayEvent: vi.fn(),
}))
const { mockSendNoticeSms } = vi.hoisted(() => ({ mockSendNoticeSms: vi.fn() }))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
    transaction: mockDbTransaction,
  },
  dbRead: { select: mockDbReadSelect },
  dbClient: {},
}))
vi.mock('../src/services/email-service.js', () => ({ sendEmail: mockSendEmail }))
vi.mock('../src/services/webhook-relay-notifier.js', () => ({
  notifyRelayEvent: mockNotifyRelayEvent,
}))
vi.mock('../src/services/sms-notify.js', () => ({ sendNoticeSmsToUser: mockSendNoticeSms }))

import {
  notifyLoginAnomaly,
  configureLoginAnomalyNotifier,
} from '../src/services/login-anomaly-notifier.js'

/** 去重用 Redis:内存 set/get,便于断言「有没有占位」。 */
function memRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    },
    exists: async (k: string) => (store.has(k) ? 1 : 0),
    del: async (k: string) => {
      store.delete(k)
      return 1
    },
  }
}

/** 站内信 insert 链:成功 resolve;失败可编程 reject。 */
function installInsert(mode: 'ok' | 'fail') {
  mockDbInsert.mockReturnValue({
    values: (values: Record<string, unknown>) => {
      mockDbInsertValues(values)
      return {
        then: (r: (v: unknown) => unknown, j?: (e: unknown) => unknown) =>
          (mode === 'ok'
            ? Promise.resolve({ id: 'n1' })
            : Promise.reject(new Error('db down'))
          ).then(r, j),
      }
    },
  })
}

const BASE_INPUT = {
  userId: 'user-f312',
  eventType: 'new_device_login' as const,
  ip: '203.0.113.9',
  userEmail: 'user@example.com',
  deviceFingerprint: 'fp-f312',
}

describe('F-312 登录异常告警不丢失', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    configureLoginAnomalyNotifier(memRedis() as never)
  })

  it('① 通道全失败 ⇒ 不写去重键(可重试)', async () => {
    const redis = memRedis()
    configureLoginAnomalyNotifier(redis as never)
    installInsert('fail') // 站内信失败
    mockSendEmail.mockRejectedValue(new Error('smtp down')) // 邮件失败
    mockNotifyRelayEvent.mockRejectedValue(new Error('webhook down')) // webhook 失败
    mockSendNoticeSms.mockRejectedValue(new Error('sms gateway down')) // 短信失败(new_device_login 会发)

    await notifyLoginAnomaly(BASE_INPUT)

    // 不得占位 —— 全失败时去重键必须为空,下一 tick 才会重试
    const keys = [...redis.store.keys()].filter((k) => k.includes('notified'))
    expect(keys).toHaveLength(0)
  })

  it('② 至少一个通道成功 ⇒ 写去重键', async () => {
    const redis = memRedis()
    configureLoginAnomalyNotifier(redis as never)
    installInsert('ok') // 站内信成功
    mockSendEmail.mockRejectedValue(new Error('smtp down'))
    mockNotifyRelayEvent.mockRejectedValue(new Error('webhook down'))

    await notifyLoginAnomaly(BASE_INPUT)

    const keys = [...redis.store.keys()].filter((k) => k.includes('notified'))
    expect(keys).toHaveLength(1)
  })

  it('③ 去重生效:占位后第二次调用不再发送', async () => {
    const redis = memRedis()
    configureLoginAnomalyNotifier(redis as never)
    installInsert('ok')
    mockSendEmail.mockResolvedValue(undefined)
    mockNotifyRelayEvent.mockResolvedValue(undefined)

    await notifyLoginAnomaly(BASE_INPUT)
    const insertCountAfterFirst = mockDbInsertValues.mock.calls.length
    expect(insertCountAfterFirst).toBe(1)

    // 第二次同类事件:已占位 ⇒ 不再 insert
    await notifyLoginAnomaly(BASE_INPUT)
    expect(mockDbInsertValues.mock.calls.length).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
