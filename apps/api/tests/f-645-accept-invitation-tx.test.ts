// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-645 回归锁(2026-11-13)。
 *
 * 病灶:acceptInvitation 先插 team_members 再单独 UPDATE 邀请,两步不在同一事务;
 * 且 UPDATE 只按 id 过滤(`status-guard-exempt`),路由层 pending 校验与写库之间存在
 * TOCTOU —— 已被撤销/已接受的邀请仍能加成员,并发接受可重复加成员。
 *
 * 本文件锁:
 *   ① 邀请已是 accepted / cancelled:拒绝,不写成员;
 *   ② 邀请已过期:拒绝,不写成员;
 *   ③ pending 且未过期:成员插入与邀请状态更新在同一事务内,UPDATE 条件含
 *      status='pending' 与 expires_at > now;
 *   ④ 已是团队成员:幂等复用成员行,不重复插入,判定同样在事务内;
 *   ⑤ 并发两个接受:条件更新只有一个命中,另一个 0 行失败。
 *
 * 不连库:mock db/tx 链式调用,用 PgDialect 解析真实 where 参数模拟行级守卫。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { teamMembers, type TeamInvitation } from '@ihui/database'

const INVITATION_ID = '11111111-1111-4111-8111-111111111111'
const TEAM_ID = '22222222-2222-4222-8222-222222222222'
const USER_ID = '33333333-3333-4333-8333-333333333333'
const INVITER_ID = '44444444-4444-4444-8444-444444444444'

interface UpdateRecord {
  scope: 'db' | 'tx'
  where: unknown
}

interface InsertRecord {
  scope: 'db' | 'tx'
  table: unknown
  values: unknown
}

interface SelectRecord {
  scope: 'db' | 'tx'
  where: unknown
}

const { state } = vi.hoisted(() => ({
  state: {
    invitation: null as null | { id: string; status: string; expiresAt: Date },
    existingMember: null as null | Record<string, unknown>,
    transactionCalls: 0,
    updateCalls: [] as UpdateRecord[],
    insertCalls: [] as InsertRecord[],
    selectCalls: [] as SelectRecord[],
    writeOrder: [] as string[],
  },
}))

vi.mock('../src/db/index.js', () => {
  const dialect = new PgDialect()

  // 模拟行级守卫:id 命中、状态等于条件字面量、且未过期才视为命中。
  function guardMatches(where: unknown): boolean {
    const inv = state.invitation
    if (!inv) return false
    const query = dialect.sqlToQuery(where as Parameters<PgDialect['sqlToQuery']>[0])
    const params = query.params as unknown[]
    const statusLiteral = params.find(
      (p) => p === 'pending' || p === 'accepted' || p === 'rejected' || p === 'cancelled',
    )
    // drizzle 会把 timestamp 映射成 ISO 字符串,这里 Date / string 都接受
    const cutoffRaw = params.find(
      (p) => p instanceof Date || (typeof p === 'string' && !Number.isNaN(Date.parse(p))),
    )
    const cutoffMs =
      cutoffRaw instanceof Date
        ? cutoffRaw.getTime()
        : typeof cutoffRaw === 'string'
          ? Date.parse(cutoffRaw)
          : Number.NaN
    return (
      params.includes(inv.id) &&
      statusLiteral === inv.status &&
      !Number.isNaN(cutoffMs) &&
      inv.expiresAt.getTime() > cutoffMs
    )
  }

  function makeThenable(resolve: () => unknown) {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'orderBy', 'offset']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => resolve())
        .then(onFulfilled, onRejected)
    return chain
  }

  function makeSelect(scope: 'db' | 'tx') {
    const chain = makeThenable(() => (state.existingMember ? [state.existingMember] : []))
    chain.where = vi.fn((where: unknown) => {
      state.selectCalls.push({ scope, where })
      return chain
    })
    return chain
  }

  function makeUpdate(scope: 'db' | 'tx') {
    const chain: Record<string, unknown> = {}
    const record: UpdateRecord = { scope, where: undefined }
    chain.set = vi.fn(() => chain)
    chain.where = vi.fn((where: unknown) => {
      record.where = where
      return chain
    })
    chain.returning = vi.fn(async () => {
      state.updateCalls.push(record)
      state.writeOrder.push('update')
      const inv = state.invitation
      if (!inv || !guardMatches(record.where)) return []
      inv.status = 'accepted'
      return [{ id: inv.id, teamId: TEAM_ID, status: inv.status, expiresAt: inv.expiresAt }]
    })
    return chain
  }

  function makeInsert(scope: 'db' | 'tx', table: unknown) {
    const chain: Record<string, unknown> = {}
    const record: InsertRecord = { scope, table, values: undefined }
    chain.values = vi.fn((values: unknown) => {
      record.values = values
      return chain
    })
    chain.returning = vi.fn(async () => {
      state.insertCalls.push(record)
      state.writeOrder.push('insert')
      const values = record.values as { teamId: string; userId: string; role: string }
      return [{ id: 'member-new', joinedAt: new Date(), ...values }]
    })
    return chain
  }

  const tx = {
    select: vi.fn(() => makeSelect('tx')),
    insert: vi.fn((table: unknown) => makeInsert('tx', table)),
    update: vi.fn(() => makeUpdate('tx')),
    delete: vi.fn(),
  }

  return {
    db: {
      select: vi.fn(() => makeSelect('db')),
      insert: vi.fn((table: unknown) => makeInsert('db', table)),
      update: vi.fn(() => makeUpdate('db')),
      delete: vi.fn(),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => {
        state.transactionCalls += 1
        return fn(tx)
      }),
    },
  }
})

import { acceptInvitation } from '../src/db/team-queries.js'

const dialect = new PgDialect()

function sqlOf(where: unknown) {
  return dialect.sqlToQuery(where as Parameters<PgDialect['sqlToQuery']>[0])
}

function invitationRow(overrides: Partial<TeamInvitation> = {}): TeamInvitation {
  return {
    id: INVITATION_ID,
    teamId: TEAM_ID,
    inviterId: INVITER_ID,
    inviteeId: USER_ID,
    email: null,
    token: 'token-f645',
    status: 'pending',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  state.invitation = null
  state.existingMember = null
  state.transactionCalls = 0
  state.updateCalls.length = 0
  state.insertCalls.length = 0
  state.selectCalls.length = 0
  state.writeOrder.length = 0
})

describe('acceptInvitation:终态邀请一律拒绝(F-645)', () => {
  it.each(['accepted', 'cancelled'])('邀请已是 %s:拒绝且不写成员', async (status) => {
    state.invitation = {
      id: INVITATION_ID,
      status,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }

    await expect(
      acceptInvitation(invitationRow({ status }), USER_ID),
    ).rejects.toThrow('邀请已失效或已被处理')

    expect(state.transactionCalls).toBe(1)
    expect(state.insertCalls).toHaveLength(0)
  })

  it('邀请已过期:拒绝且不写成员', async () => {
    state.invitation = {
      id: INVITATION_ID,
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000),
    }

    await expect(
      acceptInvitation(invitationRow({ expiresAt: new Date(Date.now() - 1000) }), USER_ID),
    ).rejects.toThrow('邀请已失效或已被处理')

    expect(state.transactionCalls).toBe(1)
    expect(state.insertCalls).toHaveLength(0)
  })
})

describe('acceptInvitation:正常接受两写同事务(F-645)', () => {
  it('pending 且未过期:先条件更新邀请,再插成员,两者都在事务内', async () => {
    state.invitation = {
      id: INVITATION_ID,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }

    const result = await acceptInvitation(invitationRow(), USER_ID)

    expect(result.invitation.status).toBe('accepted')
    expect(result.member).toMatchObject({ teamId: TEAM_ID, userId: USER_ID, role: 'member' })

    expect(state.transactionCalls).toBe(1)
    expect(state.updateCalls).toHaveLength(1)
    expect(state.insertCalls).toHaveLength(1)
    expect(state.updateCalls[0]?.scope).toBe('tx')
    expect(state.insertCalls[0]?.scope).toBe('tx')
    expect(state.insertCalls[0]?.table).toBe(teamMembers)
    expect(state.writeOrder).toEqual(['update', 'insert'])

    // 终态守卫必须真实出现在 SQL 里:status='pending' 且 expires_at > now
    const guard = sqlOf(state.updateCalls[0]?.where)
    expect(guard.sql).toContain('"status" = ')
    expect(guard.sql).toContain('"expires_at" > ')
    expect(guard.params).toContain('pending')
    expect(guard.params).toContain(INVITATION_ID)
  })

  it('已是团队成员:事务内幂等复用成员行,不重复插入', async () => {
    state.invitation = {
      id: INVITATION_ID,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }
    state.existingMember = {
      id: 'member-existing',
      teamId: TEAM_ID,
      userId: USER_ID,
      role: 'member',
      joinedAt: new Date(),
    }

    const result = await acceptInvitation(invitationRow(), USER_ID)

    expect(result.member).toEqual(state.existingMember)
    expect(state.insertCalls).toHaveLength(0)
    expect(state.transactionCalls).toBe(1)
    expect(state.selectCalls).toHaveLength(1)
    expect(state.selectCalls[0]?.scope).toBe('tx')
    expect(sqlOf(state.selectCalls[0]?.where).params).toEqual(
      expect.arrayContaining([TEAM_ID, USER_ID]),
    )
  })

  it('并发两个接受:条件更新只有一个命中,另一个 0 行失败', async () => {
    state.invitation = {
      id: INVITATION_ID,
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    }

    const results = await Promise.allSettled([
      acceptInvitation(invitationRow(), USER_ID),
      acceptInvitation(invitationRow(), USER_ID),
    ])

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )
    expect(rejected).toHaveLength(1)
    expect(String(rejected[0]?.reason)).toContain('邀请已失效或已被处理')

    expect(state.transactionCalls).toBe(2)
    expect(state.updateCalls).toHaveLength(2)
    expect(state.insertCalls).toHaveLength(1)
    expect(state.insertCalls[0]?.scope).toBe('tx')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
