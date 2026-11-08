// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-384:被移出团队的用户仍保留知识空间权限。
 *
 * 旧行为:removeTeamMember 只删 team_members 一行,team_knowledge_space_members 里
 * 该用户在本团队各空间的授权行原样留着 —— 被踢的人继续能读写敏感知识库。
 *
 * 夹具要点(不连库:mock db/tx 链式调用,真表对象 + PgDialect 解析 where 参数):
 *  - 正常移除:同一事务内先按本团队空间范围删授权行,再删成员行;两个 delete 都发生且参数正确;
 *  - 授权删除失败:错误向上抛出,成员删除不执行(事务整体回滚,不留半截权限);
 *  - 团队下无空间:不发出越权的授权删除,成员删除仍只带 teamId + userId 双条件。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { teamKnowledgeSpaceMembers, teamMembers } from '@ihui/database'

const TEAM_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const SPACE_A = '33333333-3333-4333-8333-333333333333'
const SPACE_B = '44444444-4444-4444-8444-444444444444'

interface DeleteRecord {
  scope: 'db' | 'tx'
  table: unknown
  where: unknown
}

const { state } = vi.hoisted(() => ({
  state: {
    spaceRows: [] as Array<{ id: string }>,
    removedIds: [] as string[],
    deleteCalls: [] as DeleteRecord[],
    transactionCalls: 0,
    failOnDeleteIndex: 0,
  },
}))

vi.mock('../src/db/index.js', () => {
  function makeReadChain(resolve: () => unknown) {
    const chain: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve()
        .then(() => resolve())
        .then(onFulfilled, onRejected)
    return chain
  }

  function makeDelete(scope: 'db' | 'tx') {
    return vi.fn((table: unknown) => {
      if (state.failOnDeleteIndex === state.deleteCalls.length + 1) {
        throw new Error('授权回收失败')
      }
      const record: DeleteRecord = { scope, table, where: undefined }
      state.deleteCalls.push(record)
      const chain = makeReadChain(() => [])
      chain.where = vi.fn((arg: unknown) => {
        record.where = arg
        return chain
      })
      chain.returning = vi.fn(async () => state.removedIds.map((id) => ({ id })))
      return chain
    })
  }

  const tx = {
    select: vi.fn(() => makeReadChain(() => state.spaceRows)),
    delete: makeDelete('tx'),
  }

  return {
    db: {
      select: vi.fn(() => makeReadChain(() => [])),
      insert: vi.fn(() => makeReadChain(() => [])),
      update: vi.fn(() => makeReadChain(() => [])),
      delete: makeDelete('db'),
      transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => {
        state.transactionCalls += 1
        return fn(tx)
      }),
    },
  }
})

import { removeTeamMember } from '../src/db/team-queries.js'

const dialect = new PgDialect()

function paramsOf(where: unknown): unknown[] {
  return dialect.sqlToQuery(where as Parameters<PgDialect['sqlToQuery']>[0]).params as unknown[]
}

function txDeletesOf(table: unknown): DeleteRecord[] {
  return state.deleteCalls.filter((c) => c.scope === 'tx' && c.table === table)
}

beforeEach(() => {
  state.spaceRows = []
  state.removedIds = []
  state.deleteCalls.length = 0
  state.transactionCalls = 0
  state.failOnDeleteIndex = 0
})

describe('removeTeamMember:移除成员必须同事务回收知识空间授权(F-384)', () => {
  it('正常移除:先删本团队空间授权,再删成员关系,两者参数正确', async () => {
    state.spaceRows = [{ id: SPACE_A }, { id: SPACE_B }]
    state.removedIds = ['member-row-1']

    const removed = await removeTeamMember(TEAM_ID, USER_ID)

    // 1) 知识空间授权 delete 必须发生(旧码只删成员关系,这里为 0)
    const revokeCalls = state.deleteCalls.filter(
      (c) => c.table === teamKnowledgeSpaceMembers,
    )
    expect(revokeCalls).toHaveLength(1)
    expect(revokeCalls[0]?.scope).toBe('tx')

    // 2) 成员关系 delete 也必须发生,且两次都在事务内(不能是裸 db.delete)
    const memberCalls = state.deleteCalls.filter((c) => c.table === teamMembers)
    expect(memberCalls).toHaveLength(1)
    expect(memberCalls[0]?.scope).toBe('tx')
    expect(state.transactionCalls).toBe(1)
    expect(state.deleteCalls.filter((c) => c.scope === 'db')).toHaveLength(0)

    // 3) 授权删除只命中本团队空间 + 目标用户
    expect(paramsOf(revokeCalls[0]?.where)).toEqual(
      expect.arrayContaining([SPACE_A, SPACE_B, USER_ID]),
    )

    // 4) 成员删除仍受 teamId + userId 双条件约束,不会跨团队误删
    expect(paramsOf(memberCalls[0]?.where)).toEqual(
      expect.arrayContaining([TEAM_ID, USER_ID]),
    )

    // 5) 返回值语义不变
    expect(removed).toEqual(['member-row-1'])
  })

  it('授权删除失败:错误向上抛出,成员删除不执行(不回滚成半截权限)', async () => {
    state.spaceRows = [{ id: SPACE_A }]
    state.failOnDeleteIndex = 1

    await expect(removeTeamMember(TEAM_ID, USER_ID)).rejects.toThrow('授权回收失败')

    expect(state.deleteCalls).toHaveLength(0)
    expect(txDeletesOf(teamMembers)).toHaveLength(0)
  })

  it('团队下无空间:不发授权删除,成员删除仍带 teamId + userId', async () => {
    state.spaceRows = []

    const removed = await removeTeamMember(TEAM_ID, USER_ID)

    expect(txDeletesOf(teamKnowledgeSpaceMembers)).toHaveLength(0)
    expect(txDeletesOf(teamMembers)).toHaveLength(1)
    expect(paramsOf(txDeletesOf(teamMembers)[0]?.where)).toEqual(
      expect.arrayContaining([TEAM_ID, USER_ID]),
    )
    expect(removed).toEqual([])
  })
})
