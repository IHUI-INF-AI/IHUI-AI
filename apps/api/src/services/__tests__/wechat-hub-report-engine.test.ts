// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 报告引擎回归：数字必须可复算。
 * 这里用固定消息集验证消息量、活跃天数、连续天数、回复中位数与活跃榜排序，
 * 避免「报告很好看但数字是错的」这种最难发现的问题。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ select: vi.fn() }))

vi.mock('../../db/index.js', () => ({ db: {}, dbRead: { select: hoisted.select } }))
vi.mock('../wechat-hub/guards', () => ({
  assertAccountForUser: async () => ({ id: 'acc-1', label: '测试号' }),
}))

import { buildReport, zonedYearRange } from '../wechat-hub/reports'

const conversationRow = { id: 'conv-1', title: '项目群', kind: 'group' }

const rows = [
  {
    conversationId: 'conv-1',
    direction: 'inbound',
    kind: 'text',
    content: '报价单什么时候给？',
    senderId: 'wxid_a',
    senderName: '张三',
    sentAt: new Date('2026-11-23T02:00:00Z'),
  },
  {
    conversationId: 'conv-1',
    direction: 'outbound',
    kind: 'text',
    content: '今天下午发你',
    senderId: null,
    senderName: null,
    sentAt: new Date('2026-11-23T02:00:30Z'),
  },
  {
    conversationId: 'conv-1',
    direction: 'inbound',
    kind: 'text',
    content: '好的，另外合同条款再确认下',
    senderId: 'wxid_a',
    senderName: '张三',
    sentAt: new Date('2026-11-24T03:00:00Z'),
  },
  {
    conversationId: 'conv-1',
    direction: 'outbound',
    kind: 'text',
    content: '条款我看过，没问题',
    senderId: null,
    senderName: null,
    sentAt: new Date('2026-11-24T03:01:00Z'),
  },
]

function chain(result: unknown) {
  const node = {
    from: () => node,
    where: () => node,
    orderBy: () => node,
    limit: () => node,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return node
}

beforeEach(() => {
  hoisted.select.mockReset()
  hoisted.select.mockReturnValueOnce(chain([conversationRow])).mockReturnValueOnce(chain(rows))
})

describe('buildReport', () => {
  it('zonedYearRange 用目标时区的自然年边界', () => {
    const { start, end } = zonedYearRange(2026, 'Asia/Shanghai')
    expect(start.toISOString()).toBe('2025-12-31T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })

  it('群聊报告：消息量、活跃天数、连续天数、回复中位数', async () => {
    const report = await buildReport('u1', 'acc-1', {
      kind: 'group',
      conversationId: 'conv-1',
      year: 2026,
    })
    expect(report.stats.messageCount).toBe(4)
    expect(report.stats.inboundCount).toBe(2)
    expect(report.stats.outboundCount).toBe(2)
    expect(report.stats.participantCount).toBe(2)
    // 11-23 与 11-24 各两条：两个活跃日，且连续
    expect(report.stats.activeDays).toBe(2)
    expect(report.stats.longestStreakDays).toBe(2)
    // 间隔 30s 与 60s 计入；跨天的 25h 超过 24h 上限被剔除 → 中位数 (30+60)/2 = 45
    expect(report.stats.medianReplySeconds).toBe(45)
    expect(report.stats.peakDay?.count).toBe(2)
    expect(report.range.startAt).toBe('2026-11-23T02:00:00.000Z')
    expect(report.range.endAt).toBe('2026-11-24T03:01:00.000Z')
  })

  it('活跃榜按消息数排序，标题带会话名', async () => {
    const report = await buildReport('u1', 'acc-1', {
      kind: 'group',
      conversationId: 'conv-1',
      year: 2026,
    })
    expect(report.participants[0]?.messageCount).toBe(2)
    expect(report.title).toContain('项目群')
    expect(report.markdown).toContain('## 活跃榜')
    expect(report.markdown).toContain('| 张三 | 2 |')
  })

  it('pair/group 缺 conversationId 直接 400', async () => {
    await expect(buildReport('u1', 'acc-1', { kind: 'pair' })).rejects.toMatchObject({
      errorCode: 'WECHAT_REPORT_NO_CONVERSATION',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
