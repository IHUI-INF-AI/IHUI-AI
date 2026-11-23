// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联 P0 纯函数回归：
 *  - 自动回复匹配（contains/exact/prefix + 作用域）
 *  - 日报跨时区判定与"当天只跑一次"
 *  - 日报文本裁剪
 *  - 桥群成员快照归一化
 */

import { describe, expect, it } from 'vitest'
import type { WechatAnalysisRunView } from '@ihui/types'
import { formatDigestText, isDigestDue, localParts } from '../wechat-hub/digest'
import { matchAutoReply } from '../wechat-hub/automation'
import { normalizeBridgePayload } from '../wechat-hub/bridge-adapter'

describe('matchAutoReply', () => {
  const base = { matchType: 'contains' as const, keywords: ['报价', '发票'], scope: 'all' as const }

  it('contains 命中任一关键词，大小写不敏感', () => {
    expect(
      matchAutoReply(base, { content: '麻烦发下 QUOTE 报价单', conversationKind: 'private' }),
    ).toBe(true)
    expect(
      matchAutoReply(
        { ...base, keywords: ['QUOTE'] },
        { content: 'quote 多少', conversationKind: 'private' },
      ),
    ).toBe(true)
  })

  it('exact 只认全等，prefix 只认前缀', () => {
    expect(
      matchAutoReply(
        { matchType: 'exact', keywords: ['你好'], scope: 'all' },
        { content: '你好', conversationKind: 'private' },
      ),
    ).toBe(true)
    expect(
      matchAutoReply(
        { matchType: 'exact', keywords: ['你好'], scope: 'all' },
        { content: '你好呀', conversationKind: 'private' },
      ),
    ).toBe(false)
    expect(
      matchAutoReply(
        { matchType: 'prefix', keywords: ['订单'], scope: 'all' },
        { content: '订单 123 到哪了', conversationKind: 'private' },
      ),
    ).toBe(true)
  })

  it('作用域过滤群聊/私聊', () => {
    expect(
      matchAutoReply({ ...base, scope: 'group' }, { content: '报价', conversationKind: 'private' }),
    ).toBe(false)
    expect(
      matchAutoReply({ ...base, scope: 'group' }, { content: '报价', conversationKind: 'group' }),
    ).toBe(true)
  })
})

describe('isDigestDue', () => {
  it('按 Asia/Shanghai 判 9:00，UTC 01:00 命中', () => {
    expect(localParts(new Date('2026-11-23T01:00:00Z'), 'Asia/Shanghai')).toEqual({
      dayKey: '2026-11-23',
      hour: 9,
      minute: 0,
    })
  })

  it('当天已跑过不再命中，隔天再命中', () => {
    const schedule = {
      enabled: true,
      hour: 9,
      minute: 0,
      timezone: 'Asia/Shanghai',
      lastRunAt: '2026-11-23T01:00:00.000Z',
    }
    expect(isDigestDue(schedule, new Date('2026-11-23T01:00:30Z'))).toBe(false)
    expect(isDigestDue(schedule, new Date('2026-11-24T01:00:00Z'))).toBe(true)
  })

  it('未启用永远不命中', () => {
    expect(
      isDigestDue(
        { enabled: false, hour: 9, minute: 0, timezone: 'Asia/Shanghai', lastRunAt: null },
        new Date('2026-11-23T01:00:00Z'),
      ),
    ).toBe(false)
  })
})

describe('formatDigestText', () => {
  it('包含摘要/重点/待办，并截到 4500 字以内', () => {
    const run = {
      result: {
        title: null,
        summary: '今天有 3 个客户询价。',
        highlights: ['A 客户要报价', 'B 客户要发票'],
        todos: [{ text: '回 A 客户', owner: '张三', due: null, messageId: null }],
        keywords: [],
        participants: [],
        risks: [],
        stats: { messageCount: 12, participantCount: 3, startAt: null, endAt: null },
        generatedBy: 'local' as const,
      },
    } as unknown as WechatAnalysisRunView
    const text = formatDigestText('销售号', run)
    expect(text).toContain('【微信日报】销售号')
    expect(text).toContain('重点：')
    expect(text).toContain('待办：')
    expect(text.length).toBeLessThanOrEqual(4_500)
  })
})

describe('normalizeBridgePayload 群成员', () => {
  it('读取 root.members 并归一化角色', () => {
    const events = normalizeBridgePayload({
      members: [
        { wxid: 'wxid-owner', nickname: '群主', role: 'owner' },
        { memberId: 'wxid-2', name: '成员二' },
        'wxid-3',
      ],
      messages: [
        {
          id: 'm-group-1',
          roomId: 'room-9',
          roomName: '测试群',
          sender: 'wxid-2',
          content: '大家好',
        },
      ],
    })
    expect(events[0]?.groupMembers).toEqual([
      { memberId: 'wxid-owner', nickname: '群主', role: 'owner' },
      { memberId: 'wxid-2', nickname: '成员二', role: 'member' },
      { memberId: 'wxid-3', nickname: '', role: 'member' },
    ])
  })

  it('私聊不带群成员', () => {
    const events = normalizeBridgePayload({
      members: [{ wxid: 'wxid-a' }],
      message: { id: 'm-private', chatId: 'wxid-a', sender: 'wxid-a', content: 'hi' },
    })
    expect(events[0]?.groupMembers).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
