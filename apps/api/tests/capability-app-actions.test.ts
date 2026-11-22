// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力应用 · 只读能力运行时:三闸门 + 类型强转。
 *
 * 钉住的不是 happy path,而是"越权与漂移都过不去":
 *  - 白名单外的名字不执行;
 *  - 应用没声明的名字哪怕在白名单里也不执行;
 *  - 参数错一个键就整单拒绝,且 handler 一次都不被调用;
 *  - 字符串参数不会被"看起来像数字"误转(搜索词 "2024" 必须还是字符串)。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findConversationsByUser: vi.fn(),
  countUnread: vi.fn(),
  findNotificationsByUser: vi.fn(),
  getDailyCreditsUsage: vi.fn(),
}))

vi.mock('../src/db/chat-queries.js', () => ({
  findConversationsByUser: mocks.findConversationsByUser,
}))
vi.mock('../src/db/notification-queries.js', () => ({
  countUnread: mocks.countUnread,
  findNotificationsByUser: mocks.findNotificationsByUser,
}))
vi.mock('../src/services/credits-usage-service.js', () => ({
  getDailyCreditsUsage: mocks.getDailyCreditsUsage,
}))

import { coerceCallArgs, invokeCapabilityAppCall } from '../src/services/capability-app-actions.js'
import type { CapabilityAppCallName } from '@ihui/types'

const declaration = new Set<CapabilityAppCallName>([
  'conversations.recent',
  'notifications.recent',
  'usage.daily',
])

beforeEach(() => {
  vi.clearAllMocks()
})

describe('invokeCapabilityAppCall', () => {
  it('白名单外的能力名直接拒绝', async () => {
    const outcome = await invokeCapabilityAppCall({
      userId: 'u1',
      call: 'fs.readFile',
      args: { path: '/etc/passwd' },
      declaration,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.failure.code).toBe('unknown_call')
    expect(mocks.findConversationsByUser).not.toHaveBeenCalled()
  })

  it('应用未声明的能力即使白名单内也拒绝', async () => {
    const outcome = await invokeCapabilityAppCall({
      userId: 'u1',
      call: 'usage.daily',
      args: { days: '7' },
      declaration: new Set<CapabilityAppCallName>(['conversations.recent']),
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.failure.code).toBe('undeclared_call')
    expect(mocks.getDailyCreditsUsage).not.toHaveBeenCalled()
  })

  it('参数不合法时整单拒绝,handler 不被调用', async () => {
    const outcome = await invokeCapabilityAppCall({
      userId: 'u1',
      call: 'conversations.recent',
      args: { limit: '999', userId: 'someone-else' },
      declaration,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.failure.code).toBe('invalid_args')
    expect(mocks.findConversationsByUser).not.toHaveBeenCalled()
  })

  it('成功时把用户作用域注入查询,并只回白名单字段', async () => {
    mocks.findConversationsByUser.mockResolvedValue({
      total: 3,
      list: [
        {
          id: 'c1',
          title: '会话一',
          model: 'gpt-5',
          messageCount: 4,
          lastMessageAt: new Date('2026-11-01T00:00:00.000Z'),
          updatedAt: new Date('2026-11-01T00:00:00.000Z'),
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
        },
      ],
    })

    const outcome = await invokeCapabilityAppCall({
      userId: 'u1',
      call: 'conversations.recent',
      args: { limit: '5', search: '项目' },
      declaration,
    })

    expect(outcome.ok).toBe(true)
    const [userId, opts] = mocks.findConversationsByUser.mock.calls[0]!
    expect(userId).toBe('u1')
    expect(opts).toMatchObject({ page: 1, pageSize: 5, search: '项目' })
    if (outcome.ok) {
      const result = outcome.result as { total: number; items: Array<Record<string, unknown>> }
      expect(result.total).toBe(3)
      expect(result.items[0]).toMatchObject({ id: 'c1', title: '会话一', messageCount: 4 })
      expect(result.items[0]).not.toHaveProperty('systemPrompt')
    }
  })

  it('usage.daily 的 days 被夹到白名单范围', async () => {
    mocks.getDailyCreditsUsage.mockResolvedValue({
      days: 90,
      startDate: '2026-08-15',
      endDate: '2026-11-12',
      timezone: 'Asia/Shanghai',
      buckets: [{ date: '2026-11-12', count: 1, points: 10, sessions: 2 }],
    })

    const outcome = await invokeCapabilityAppCall({
      userId: 'u1',
      call: 'usage.daily',
      args: { days: '90' },
      declaration,
    })

    expect(outcome.ok).toBe(true)
    expect(mocks.getDailyCreditsUsage).toHaveBeenCalledWith({ userId: 'u1', days: 90 })
    if (outcome.ok) {
      const result = outcome.result as { buckets: Array<Record<string, unknown>> }
      expect(result.buckets[0]).toEqual({ date: '2026-11-12', count: 1, points: 10, sessions: 2 })
    }
  })
})

describe('coerceCallArgs', () => {
  it('按参数元数据强转,搜索词里的数字仍是字符串', () => {
    const resolved = coerceCallArgs('conversations.recent', {
      limit: '20',
      search: '2024',
      includeArchived: 'true',
    })
    expect(resolved.limit).toBe(20)
    expect(resolved.search).toBe('2024')
    expect(resolved.includeArchived).toBe(true)
  })

  it('布尔 "false" 不被当成真值', () => {
    const resolved = coerceCallArgs('notifications.recent', { unreadOnly: 'false' })
    expect(resolved.unreadOnly).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
