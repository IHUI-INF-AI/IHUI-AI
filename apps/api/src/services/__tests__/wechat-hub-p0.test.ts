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
import { selectBroadcastTargets } from '../wechat-hub/broadcast'
import { normalizeBridgeContacts, normalizeBridgeGroupMembers } from '../wechat-hub/operations'
import { normalizeImportRow } from '../wechat-hub/import'

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

  it('agent 模式：空关键词接管全部，有关键词只在这些词出现时触发', () => {
    expect(
      matchAutoReply(
        { matchType: 'agent', keywords: [], scope: 'all' },
        { content: '在吗', conversationKind: 'private' },
      ),
    ).toBe(true)
    expect(
      matchAutoReply(
        { matchType: 'agent', keywords: ['报价'], scope: 'all' },
        { content: '在吗', conversationKind: 'private' },
      ),
    ).toBe(false)
    expect(
      matchAutoReply(
        { matchType: 'agent', keywords: ['报价'], scope: 'all' },
        { content: '发下最新报价', conversationKind: 'private' },
      ),
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

describe('normalizeBridgeContacts', () => {
  it('吃下 contacts/list/items/members 与 wxid 别名', () => {
    expect(
      normalizeBridgeContacts({
        contacts: [
          { wxid: 'wxid-a', nickname: '张三', remark: 'A 客户', tags: ['vip', 1] },
          { userName: 'wxid-b', name: '李四' },
        ],
      }),
    ).toEqual([
      { platformUserId: 'wxid-a', displayName: '张三', remark: 'A 客户', tags: ['vip'] },
      { platformUserId: 'wxid-b', displayName: '李四', remark: '', tags: [] },
    ])
    expect(
      normalizeBridgeContacts({ members: [{ memberId: 'wxid-c', nickname: '群友' }] })[0],
    ).toEqual({ platformUserId: 'wxid-c', displayName: '群友', remark: '', tags: [] })
  })

  it('没有可用 id 的条目丢弃，不造空联系人', () => {
    expect(normalizeBridgeContacts({ list: [{ nickname: '无 id' }, null, 'wxid-x'] })).toEqual([])
  })
})

describe('normalizeBridgeGroupMembers', () => {
  it('吃下 members/list 与 wxid/memberId/id 别名，并按 wxid 去重', () => {
    expect(
      normalizeBridgeGroupMembers({
        members: [
          { wxid: 'wxid-owner', nickname: '群主', role: 'owner' },
          { memberId: 'wxid-2', name: '成员二' },
          { id: 'wxid-3', displayName: '成员三', isAdmin: true },
          { wxid: 'wxid-2', nickname: '成员二新' },
        ],
      }),
    ).toEqual([
      { memberId: 'wxid-owner', nickname: '群主', role: 'owner' },
      { memberId: 'wxid-2', nickname: '成员二新', role: 'member' },
      { memberId: 'wxid-3', nickname: '成员三', role: 'admin' },
    ])
  })

  it('没有成员列表返回空，不造空成员', () => {
    expect(normalizeBridgeGroupMembers({ data: { chatId: 'room-1' } })).toEqual([])
  })
})

describe('normalizeImportRow', () => {
  it('兼容秒级时间戳、群会话、出站方向和媒体类型', () => {
    const result = normalizeImportRow(
      {
        platformChatId: 'room-1@chatroom',
        platformMessageId: 'm-1',
        conversationTitle: '客户群',
        direction: 'outbound',
        kind: 'image',
        content: '[图片]',
        sentAt: '1700000000',
      },
      0,
    )
    expect('value' in result).toBe(true)
    if (!('value' in result)) throw new Error(result.error)
    expect(result.value.conversationKind).toBe('group')
    expect(result.value.direction).toBe('outbound')
    expect(result.value.kind).toBe('image')
    expect(result.value.sentAt.toISOString()).toBe('2023-11-14T22:13:20.000Z')
  })

  it('缺少 platformChatId 报错，不造空会话', () => {
    const result = normalizeImportRow({ platformChatId: '', content: 'hi' }, 3)
    expect('error' in result).toBe(true)
    if ('error' in result) expect(result.error).toBe('缺少 platformChatId')
  })

  it('没有 platformMessageId 时生成稳定内容 id，重复导入不会翻倍', () => {
    const a = normalizeImportRow(
      { platformChatId: 'wxid-a', senderId: 'wxid-b', content: '你好', sentAt: 1_700_000_000 },
      0,
    )
    const b = normalizeImportRow(
      { platformChatId: 'wxid-a', senderId: 'wxid-b', content: '你好', sentAt: 1_700_000_000 },
      1,
    )
    if (!('value' in a) || !('value' in b)) throw new Error('归一化失败')
    expect(a.value.platformMessageId).toBe(b.value.platformMessageId)
    expect(a.value.platformMessageId.startsWith('import:')).toBe(true)
  })

  it('没有 sentAt 时也生成稳定 id，重复导入不会翻倍', () => {
    const a = normalizeImportRow({ platformChatId: 'wxid-a', content: '没时间字段' }, 0)
    const b = normalizeImportRow({ platformChatId: 'wxid-a', content: '没时间字段' }, 1)
    if (!('value' in a) || !('value' in b)) throw new Error('归一化失败')
    expect(a.value.platformMessageId).toBe(b.value.platformMessageId)
  })
})

describe('selectBroadcastTargets', () => {
  const contacts = [
    { platformUserId: 'wxid-a', tags: ['vip', 'old'], blocked: false },
    { platformUserId: 'wxid-b', tags: ['old'], blocked: true },
    { platformUserId: 'wxid-c', tags: [], blocked: false },
  ]

  it('无标签取全部未拉黑，并按目标去重', () => {
    expect(selectBroadcastTargets(contacts, [], false)).toEqual(['wxid-a', 'wxid-c'])
    expect(selectBroadcastTargets([...contacts, contacts[0]!], [], false)).toEqual([
      'wxid-a',
      'wxid-c',
    ])
  })

  it('标签任一命中；includeBlocked 才放行拉黑联系人', () => {
    expect(selectBroadcastTargets(contacts, ['old'], false)).toEqual(['wxid-a'])
    expect(selectBroadcastTargets(contacts, ['old'], true)).toEqual(['wxid-a', 'wxid-b'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
