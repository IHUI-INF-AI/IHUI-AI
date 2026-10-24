// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SQLWrapper } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

/**
 * D125 协作撤销的终态守卫(queries 层直测,2026-10-24 立)。
 *
 * 为什么不能只靠路由测试:路由面把 `revokeCollaborator` 整层 mock 掉,守卫被删掉也
 * 照样绿 —— 那正是"测试拦不住回归"的形状。这里直接测 `../src/db/chat-collab-queries.js`,
 * 零连接(链式假 db,与 voice-note-predicate.test.ts 同款)。
 *
 * 判据三条:
 *  ① **终态守卫必须在 SQL 谓词里**:`status <> 'revoked'`(ne),而不是把行捞回来再在 JS 里判
 *     —— 后者会先发出 UPDATE,二次撤销照样盖 updatedAt、照样回吐行 ⇒ 路由会再广播一次 revoked。
 *     反向对照:同一次调用的 where 里**不得**出现 `= 'revoked'`(那是"只撤销已撤销的",方向反了)。
 *  ② **已 revoked 的行再次撤销 ⇒ 受影响行数 0**:库确认集为空(路由据此 404、不广播),
 *     且整笔只发一次 UPDATE —— 不发第二条写、不读其它表(撤销没有"附带清理")。
 *  ③ **正向对照**:非 revoked 行可正常撤销,落 status='revoked' + 新 updatedAt,
 *     set 里除这两列外一个字段都不许有(不许顺手写归属列)。
 */
const state = vi.hoisted(() => ({
  updates: 0,
  sets: [] as Record<string, unknown>[],
  wheres: [] as unknown[],
  rows: [] as Record<string, unknown>[],
  extraCalls: [] as string[],
}))

function makeApi() {
  const api: Record<string, unknown> = {
    set: (v: Record<string, unknown>) => {
      state.sets.push(v)
      return api
    },
    where: (w: unknown) => {
      state.wheres.push(w)
      return api
    },
    // 桩必须模拟 `UPDATE ... RETURNING` 返回**更新后**的行:真实 PG 的 returning 给的是写入后的值,
    // 直接回 state.rows 会把"守卫是否真写了 status"这一维读成假红(G4 即此型)。
    returning: () => Promise.resolve(appliedRows()),
    then: (res?: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(appliedRows()).then(res, rej),
  }
  return api
}

/** 把最后一次 `set` 的列值套到在册行上,等价于 UPDATE...RETURNING 的结果集。 */
function appliedRows(): Record<string, unknown>[] {
  const last = state.sets.at(-1)
  return last ? state.rows.map((r) => ({ ...r, ...last })) : state.rows
}

vi.mock('../src/db/index.js', () => ({
  db: {
    update: () => {
      state.updates += 1
      return makeApi()
    },
    select: () => {
      state.extraCalls.push('select')
      return makeApi()
    },
    insert: () => {
      state.extraCalls.push('insert')
      return makeApi()
    },
    delete: () => {
      state.extraCalls.push('delete')
      return makeApi()
    },
  },
}))

/** 谓词渲染口径唯一:交给方言器;取不到必须显式报错(判据失明比红更糟)。 */
function render(condition: unknown): { sql: string; params: unknown[] } {
  const wrapper = condition as SQLWrapper | undefined
  if (!wrapper || typeof wrapper.getSQL !== 'function') {
    throw new Error('where 片段取不到 getSQL ⇒ 判据失效方向必须是显式报错,而不是静默通过')
  }
  const q = dialect.sqlToQuery(wrapper.getSQL())
  return { sql: q.sql, params: q.params as unknown[] }
}

const { revokeCollaborator } = await import('../src/db/chat-collab-queries.js')

const CONV = '11111111-1111-4111-8111-111111111111'
const TARGET = '22222222-2222-4222-8222-222222222222'

function collaboratorRow(over: Record<string, unknown> = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    conversationId: CONV,
    userId: TARGET,
    invitedBy: '44444444-4444-4444-8444-444444444444',
    tier: 'plan',
    status: 'accepted',
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...over,
  }
}

function lastWhere() {
  return render(state.wheres[state.wheres.length - 1])
}

beforeEach(() => {
  state.updates = 0
  state.sets.length = 0
  state.wheres.length = 0
  state.rows.length = 0
  state.extraCalls.length = 0
})

describe('revokeCollaborator 终态守卫', () => {
  it('G1 谓词面:status <> revoked 与归属维同时在场,且不是 = revoked', async () => {
    await revokeCollaborator(CONV, TARGET)
    const { sql, params } = lastWhere()
    // 守卫:不等于(ne)—— 方向反了就是"只撤销已撤销的"
    expect(sql).toContain('<>')
    expect(sql).toContain('"status"')
    expect(params).toContain('revoked')
    // 反向对照:status 这一维不得写成等值(那是"只撤销已撤销的",方向反了)
    expect(sql).not.toMatch(/"status"\s*=\s*/)

    // 归属维:会话 + 目标用户都在 where 里,少一个就是拿别人的关系做状态迁移
    expect(sql).toContain('"conversation_id"')
    expect(sql).toContain('"user_id"')
    expect(params).toContain(CONV)
    expect(params).toContain(TARGET)
  })

  it('G2 有牙:同一组归属条件去掉守卫后,渲染面必须判红(不是恒真断言)', async () => {
    await revokeCollaborator(CONV, TARGET)
    const guarded = lastWhere()
    expect(guarded.sql).toContain('<>')

    // 变异对照:把守卫拿掉(只留归属等值),判据必须读得出差别
    const { and, eq } = await import('drizzle-orm')
    const { chatConversationCollaborators } = await import('@ihui/database')
    const unguarded = render(
      and(
        eq(chatConversationCollaborators.conversationId, CONV),
        eq(chatConversationCollaborators.userId, TARGET),
      ),
    )
    expect(unguarded.sql).not.toContain('<>')
    expect(unguarded.params).not.toContain('revoked')
    expect(guarded.sql).not.toBe(unguarded.sql)
  })

  it('G3 已 revoked 行再次撤销 ⇒ 库确认集为空,且整笔只有一次 UPDATE、无附带写', async () => {
    // 假库按"谓词不命中"回吐空集 —— 谓词确实不含 revoked 行由 G1 钉住,
    // 这里测的是函数对空确认集的处置:不抛、不伪造行、不补第二条写。
    state.rows = []
    const removed = await revokeCollaborator(CONV, TARGET)
    expect(removed).toEqual([])
    expect(state.updates).toBe(1)
    expect(state.extraCalls).toEqual([])
    // 二次撤销的目标行从未被写回正,set 里也不会出现"复活"语义
    expect(state.sets[0]).toEqual({ status: 'revoked', updatedAt: expect.any(Date) })
  })

  it('G4 正向对照:非 revoked 行可正常撤销,只写 status + updatedAt 两列', async () => {
    state.rows = [collaboratorRow({ status: 'pending' })]
    const removed = await revokeCollaborator(CONV, TARGET)
    expect(removed).toHaveLength(1)
    expect(removed[0]!.status).toBe('revoked')
    expect(state.updates).toBe(1)
    const set = state.sets[0]!
    expect(Object.keys(set).sort()).toEqual(['status', 'updatedAt'])
    expect(set['status']).toBe('revoked')
    expect(set['updatedAt']).toBeInstanceOf(Date)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
