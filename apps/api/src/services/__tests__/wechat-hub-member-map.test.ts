// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 成员映射下发编排单测：联系人昵称回退 remark、群成员带会话标题、空昵称跳过、
 * 同群同名两人保留；manager.pushMemberMap 收到完整数组，桥失败不抛错。
 * 全部 mock，不连真实数据库。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  pushMemberMap: vi.fn(),
  assertAccountForUser: vi.fn(),
  dbReadSelect: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {},
  dbRead: { select: (...args: unknown[]) => mocks.dbReadSelect(...args) },
}))

vi.mock('@ihui/database', () => ({
  wechatHubContacts: new Proxy({} as Record<string, unknown>, {
    get: (cache, prop) => (cache[prop as string] ??= { name: String(prop) }),
  }),
  wechatHubConversations: new Proxy({} as Record<string, unknown>, {
    get: (cache, prop) => (cache[prop as string] ??= { name: String(prop) }),
  }),
  wechatHubGroupMembers: new Proxy({} as Record<string, unknown>, {
    get: (cache, prop) => (cache[prop as string] ??= { name: String(prop) }),
  }),
}))

vi.mock('../wechat-hub/manager.js', () => ({
  wechatHubManager: { pushMemberMap: mocks.pushMemberMap },
}))

vi.mock('../wechat-hub/guards.js', () => ({
  assertAccountForUser: mocks.assertAccountForUser,
}))

import { pushMemberMapForAccount } from '../wechat-hub/member-map-sync'
import type { WechatMemberMapEntry } from '../wechat-hub/types'

/** 按查询列名区分三张表，返回 thenable 查询链。 */
function chainByColumns(rowsByColumns: Record<string, unknown[]>) {
  mocks.dbReadSelect.mockImplementation((columns: Record<string, unknown>) => {
    const rows = rowsByColumns[Object.keys(columns).sort().join('|')] ?? []
    return {
      from: () => ({
        where: () => Promise.resolve(rows),
        then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
      }),
      then: (res: (v: unknown) => unknown) => Promise.resolve(rows).then(res),
    }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.assertAccountForUser.mockResolvedValue(undefined)
  mocks.pushMemberMap.mockResolvedValue({
    ok: true,
    status: 'accepted',
    data: {},
    reason: null,
  })
})

describe('pushMemberMapForAccount 成员映射编排', () => {
  it('联系人 displayName 为空时回退 remark，空昵称跳过；群成员带会话标题', async () => {
    chainByColumns({
      // 联系人查询列：displayName|platformUserId|remark
      'displayName|platformUserId|remark': [
        { platformUserId: 'wxid_a', displayName: '张三', remark: '备注A' },
        { platformUserId: 'wxid_b', displayName: '', remark: '备注B' },
        { platformUserId: 'wxid_c', displayName: '   ', remark: '' },
      ],
      // 会话查询列：id|title
      'id|title': [{ id: 'conv-1', title: '项目群' }],
      // 群成员查询列：conversationId|memberId|nickname
      'conversationId|memberId|nickname': [
        { conversationId: 'conv-1', memberId: 'wxid_g1', nickname: '群友甲' },
        { conversationId: 'conv-1', memberId: 'wxid_g2', nickname: '群友甲' },
        { conversationId: 'conv-1', memberId: 'wxid_g3', nickname: '  ' },
      ],
    })

    const summary = await pushMemberMapForAccount('user-1', 'account-1')

    const contacts = summary.entries.filter((entry) => entry.source === 'contact')
    const groupMembers = summary.entries.filter((entry) => entry.source === 'group-member')

    expect(contacts).toEqual([
      { memberId: 'wxid_a', nickname: '张三', source: 'contact', chatTitle: null },
      { memberId: 'wxid_b', nickname: '备注B', source: 'contact', chatTitle: null },
    ])
    expect(groupMembers).toEqual([
      { memberId: 'wxid_g1', nickname: '群友甲', source: 'group-member', chatTitle: '项目群' },
      { memberId: 'wxid_g2', nickname: '群友甲', source: 'group-member', chatTitle: '项目群' },
    ])
    expect(summary.contactCount).toBe(2)
    expect(summary.groupMemberCount).toBe(2)
    expect(summary.pushed).toBe(true)
  })

  it('同群同名两人都保留，不去重；manager 收到完整条目数组', async () => {
    chainByColumns({
      'displayName|platformUserId|remark': [],
      'id|title': [{ id: 'conv-2', title: '内测群' }],
      'conversationId|memberId|nickname': [
        { conversationId: 'conv-2', memberId: 'wxid_x1', nickname: '同名' },
        { conversationId: 'conv-2', memberId: 'wxid_x2', nickname: '同名' },
      ],
    })

    await pushMemberMapForAccount('user-1', 'account-1')

    expect(mocks.pushMemberMap).toHaveBeenCalledOnce()
    const [, accountId, entries] = mocks.pushMemberMap.mock.calls[0] as [
      string,
      string,
      WechatMemberMapEntry[],
    ]
    expect(accountId).toBe('account-1')
    expect(entries).toHaveLength(2)
    const sameName = entries.filter((entry) => entry.nickname === '同名')
    expect(sameName).toHaveLength(2)
    expect(sameName.map((entry) => entry.memberId)).toEqual(['wxid_x1', 'wxid_x2'])
  })

  it('桥回执失败时不抛错，明细保留失败原因与计数', async () => {
    chainByColumns({
      'displayName|platformUserId|remark': [
        { platformUserId: 'wxid_a', displayName: '李四', remark: '' },
      ],
      'id|title': [],
      'conversationId|memberId|nickname': [],
    })
    mocks.pushMemberMap.mockResolvedValue({
      ok: false,
      status: 'failed',
      data: {},
      reason: 'HTTP 502: bridge down',
    })

    const summary = await pushMemberMapForAccount('user-1', 'account-1')

    expect(summary.pushed).toBe(false)
    expect(summary.contactCount).toBe(1)
    expect(summary.groupMemberCount).toBe(0)
    expect(summary.result.reason).toBe('HTTP 502: bridge down')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
