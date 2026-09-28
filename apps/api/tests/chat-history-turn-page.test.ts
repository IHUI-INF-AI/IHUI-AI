// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * D35 turn 分片**查询层**回归(2026-09-27,游标增量读取 + 断点存续性)。
 *
 * 为什么要单独一份:既有 `chat-history-projection.test.ts` 把 `findHistoryTurnPage`
 * **整模块 mock 掉了**(它判的是路由那层的 401/404/400 与字段透传),所以"翻页窗口
 * 本身对不对"从来没被任何用例判过 —— 首页/中间页/末页/游标越界这四型全部住在
 * `selectHistoryTurnWindow` 与 `findHistoryTurnPage` 的编排里,而那一格是空的。
 * 本文件补的就是这一格,外加 D35 验收第二条"上翻不丢帧"的服务端判据:
 * **游标指向的那一轮已经不存在 ⇒ 不再往下切窗口,直接回 stale + 空页**。
 *
 * 零 DB 副作用(AGENTS §5 测试隔离铁律):`../src/db/index.js` 整模块换成记录型假
 * 执行器,全程不建连接池;`queries` 数组留下"发过哪几条查询"的痕迹 —— stale 那一型
 * 的断言是**未发出窗口查询**,不是"状态码对"(只断状态码会放过"先切了窗口再判 stale")。
 *
 * 假执行器不解释 SQL 的 `turn_ordinal > / < 断点` 边界
 * (与 writer 测试同纪律)。那两条边界是取数优化,本页窗口与存续性判据都在
 * `selectHistoryTurnWindow` / `evaluateHistoryCursorState` 这两个纯函数里,因此本文件
 * 判的是:纯函数自身 + 编排(哪条查询该发、不该发)。**SQL 边界生效与否只能在有库的
 * 机器上判,本机 8810 无监听 ⇒ 不在本文件的合格证范围内。**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type Row = Record<string, unknown>

interface FakeStateShape {
  /** 假 `selectDistinct` 返回的候选轮次序列(按测试给定的顺序原样返回,模拟 SQL 的 orderBy) */
  candidates: number[]
  /** 假消息表行(findHistoryTurnPage 第二步取回的明细) */
  messages: Row[]
  /** 游标锚点探测的返回值:[] = 那一轮已不存在 */
  anchorRows: Row[]
  /** 发过的查询痕迹(kind + 参数),用于断言"某条查询根本没发" */
  queries: { kind: 'anchor' | 'distinct' | 'messages'; limit: number | null }[]
}

interface Chain {
  from(table: unknown): Chain
  where(cond: unknown): Chain
  orderBy(...cols: unknown[]): Chain
  limit(n: number): Chain
  offset(n: number): Chain
  groupBy(...cols: unknown[]): Chain
  values(v: unknown): Chain
  set(obj: Row): Chain
  returning(): Chain
  then(
    onfulfilled: ((value: Row[]) => unknown) | undefined,
    onrejected?: ((reason: unknown) => unknown) | undefined,
  ): Promise<unknown>
}

const { fakeState, fakeDb, reset } = vi.hoisted(() => {
  const state: FakeStateShape = {
    candidates: [],
    messages: [],
    anchorRows: [],
    queries: [],
  }
  const clear = (): void => {
    state.candidates = []
    state.messages.length = 0
    state.anchorRows = []
    state.queries.length = 0
  }

  const api = {
    /**
     * 三种查询形状按 **fields 的键**区分:
     * - `{id}` ⇒ 锚点探测(`historyTurnAnchorExists`)
     * - `{turnOrdinal}` ⇒ 候选轮次窗口(`selectDistinct` 走的是另一个方法,见下)
     * - 无 fields ⇒ 消息明细
     * 假执行器不解释 where:本页判的是编排与纯函数判据。
     */
    select: (fields?: Row) => {
      const isAnchor = Boolean(fields && 'id' in fields)
      let takenLimit: number | null = null
      const self: Chain = {
        from: () => self,
        where: () => self,
        orderBy: () => self,
        limit: (n) => {
          takenLimit = n
          return self
        },
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        set: () => self,
        returning: () => self,
        then: (onf, onr) => {
          if (isAnchor) {
            state.queries.push({ kind: 'anchor', limit: takenLimit })
            return Promise.resolve([...state.anchorRows]).then(onf, onr)
          }
          state.queries.push({ kind: 'messages', limit: takenLimit })
          return Promise.resolve(state.messages.map((m) => ({ ...m }))).then(onf, onr)
        },
      }
      return self
    },
    selectDistinct: (fields?: Row) => {
      const isTurnOrdinal = Boolean(fields && 'turnOrdinal' in fields)
      let takenLimit: number | null = null
      const self: Chain = {
        from: () => self,
        where: () => self,
        orderBy: () => self,
        limit: (n) => {
          takenLimit = n
          return self
        },
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        set: () => self,
        returning: () => self,
        then: (onf, onr) => {
          const rows = isTurnOrdinal ? state.candidates.map((turnOrdinal) => ({ turnOrdinal })) : []
          state.queries.push({ kind: 'distinct', limit: takenLimit })
          return Promise.resolve(rows).then(onf, onr)
        },
      }
      return self
    },
    insert: () => {
      throw new Error('insert is out of scope for this read-path test')
    },
    update: () => {
      throw new Error('update is out of scope for this read-path test')
    },
    delete: () => {
      throw new Error('delete is out of scope for this read-path test')
    },
    transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(api as unknown),
  }

  return { fakeState: state, fakeDb: api, reset: clear }
})

vi.mock('../src/db/index.js', () => ({ db: fakeDb, dbRead: fakeDb }))

import {
  evaluateHistoryCursorState,
  findHistoryTurnPage,
  historyTurnAnchorExists,
  selectHistoryTurnWindow,
} from '../src/db/chat-queries.js'

const CONV_ID = '11111111-1111-1111-1111-111111111111'

function descRange(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i >= to; i -= 1) out.push(i)
  return out
}

function msgRow(id: string, turnOrdinal: number, content: string): Row {
  return {
    id,
    conversationId: CONV_ID,
    role: 'user',
    content,
    reasoning: null,
    tokens: null,
    metadata: null,
    createdAt: new Date(Date.UTC(2026, 0, 1)),
    turnOrdinal,
  }
}

beforeEach(() => {
  reset()
})

describe('selectHistoryTurnWindow:本页窗口折叠(首页/中间页/末页/越界)', () => {
  it('首页(newest):500 轮里 DESC 取 21 条候选 ⇒ 输出 20 轮、升序、hasMore', () => {
    fakeState.candidates = descRange(500, 480) // 21 条,降序(服务端 DESC + limit+1)
    const win = selectHistoryTurnWindow(fakeState.candidates, 20, 'newest')
    expect(win.hasMore).toBe(true)
    expect(win.ordinals).toHaveLength(20)
    // 升序输出:第 21 条候选(480)只用来判 hasMore,不进页;页内是 481..500
    expect(win.ordinals[0]).toBe(481)
    expect(win.ordinals[19]).toBe(500)
    const sorted = [...win.ordinals].sort((a, b) => a - b)
    expect(win.ordinals).toEqual(sorted)
  })

  it('中间页(older):断点之下 DESC 取满一页 ⇒ 升序、hasMore 仍为真', () => {
    fakeState.candidates = descRange(479, 458) // 恰好 22 条候选(21 页 + 1 探边)
    const win = selectHistoryTurnWindow(fakeState.candidates, 20, 'older')
    expect(win.hasMore).toBe(true)
    expect(win.ordinals[0]).toBe(460)
    expect(win.ordinals[19]).toBe(479)
  })

  it('末页:候选不足一页 ⇒ hasMore=false 且整段都是本页(不多切、不漏切)', () => {
    fakeState.candidates = descRange(20, 1) // 恰好 limit 条,没有第 limit+1 条
    const win = selectHistoryTurnWindow(fakeState.candidates, 20, 'older')
    expect(win.hasMore).toBe(false)
    expect(win.ordinals).toEqual(descRange(20, 1).slice().sort((a, b) => a - b))
  })

  it('游标越界 / 空历史:零候选 ⇒ 空窗口 + hasMore=false(不是"还有更早")', () => {
    const win = selectHistoryTurnWindow([], 20, 'older')
    expect(win).toEqual({ ordinals: [], hasMore: false })
  })

  it('增量续读(newer):升序候选不得被反转,页内取前 limit 条', () => {
    fakeState.candidates = [11, 12, 13, 14, 15] // ASC + limit+1
    const win = selectHistoryTurnWindow(fakeState.candidates, 4, 'newer')
    expect(win.hasMore).toBe(true)
    expect(win.ordinals).toEqual([11, 12, 13, 14])
  })

  it('重放同一组候选两次结果全等(窗口折叠必须是纯函数,幂等)', () => {
    const cands = descRange(30, 11)
    expect(selectHistoryTurnWindow(cands, 20, 'newest')).toEqual(
      selectHistoryTurnWindow(cands, 20, 'newest'),
    )
    // 入参不被原地改写:调用方还拿着它当"下一页的候选"用
    expect(cands).toEqual(descRange(30, 11))
  })
})

describe('evaluateHistoryCursorState:断点存续性判据', () => {
  it('未消费游标 ⇒ ok(且不得被读成"断点已验证")', () => {
    expect(evaluateHistoryCursorState({ cursorConsumed: false, anchorExists: false })).toEqual({
      status: 'ok',
    })
  })
  it('消费游标 + 锚点在 ⇒ ok', () => {
    expect(evaluateHistoryCursorState({ cursorConsumed: true, anchorExists: true })).toEqual({
      status: 'ok',
    })
  })
  it('消费游标 + 锚点已消失 ⇒ stale/anchor-missing(理由必须点名,不能只回布尔)', () => {
    expect(evaluateHistoryCursorState({ cursorConsumed: true, anchorExists: false })).toEqual({
      status: 'stale',
      reason: 'anchor-missing',
    })
  })
})

describe('historyTurnAnchorExists:单条索引探测', () => {
  it('有行 ⇒ true 且只发一条 limit 1 的查询', async () => {
    fakeState.anchorRows = [{ id: 'm1' }]
    expect(await historyTurnAnchorExists(CONV_ID, 7)).toBe(true)
    expect(fakeState.queries).toEqual([{ kind: 'anchor', limit: 1 }])
  })
  it('无行 ⇒ false(锚点那一轮已被删除/重编号)', async () => {
    fakeState.anchorRows = []
    expect(await historyTurnAnchorExists(CONV_ID, 7)).toBe(false)
  })
})

describe('findHistoryTurnPage:编排(哪条查询该发、哪条不该发)', () => {
  it('stale:锚点探测为空 ⇒ 不发窗口查询、不发明细查询,直接空页 + stale', async () => {
    fakeState.anchorRows = []
    const res = await findHistoryTurnPage(CONV_ID, {
      limit: 20,
      cursorTurnOrdinal: 42,
      direction: 'older',
    })
    expect(res.cursorState).toEqual({ status: 'stale', reason: 'anchor-missing' })
    expect(res.turns).toEqual([])
    expect(res.nextCursor).toBeNull()
    expect(res.hasMore).toBe(false)
    // 断"未发出查询":先切窗口再判 stale 也是这个结果,所以必须看查询痕迹
    expect(fakeState.queries.map((q) => q.kind)).toEqual(['anchor'])
  })

  it('newest 不消费游标 ⇒ 一条探测都不发(SQL 本就没界)', async () => {
    fakeState.candidates = descRange(21, 1)
    fakeState.messages = [msgRow('m1', 2, 'hi'), msgRow('m2', 1, 'yo')]
    const res = await findHistoryTurnPage(CONV_ID, {
      limit: 20,
      cursorTurnOrdinal: 999,
      direction: 'newest',
    })
    expect(fakeState.queries.map((q) => q.kind)).toEqual(['distinct', 'messages'])
    expect(res.cursorState).toEqual({ status: 'ok' })
  })

  it('合法 older 页:探测通过 → 窗口 → 按轮分组升序,nextCursor 指页内最小轮', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    fakeState.candidates = descRange(5, 1) // 断点 6 之下共 5 轮候选(limit 4 ⇒ 第 5 条只探边)
    fakeState.messages = [
      msgRow('m6', 6, 'later'),
      msgRow('m5', 5, 'five'),
      msgRow('m4', 4, 'four'),
      msgRow('m3', 3, 'three'),
      msgRow('m2', 2, 'two'),
      msgRow('m1', 1, 'one'),
    ]
    const res = await findHistoryTurnPage(CONV_ID, {
      limit: 4,
      cursorTurnOrdinal: 6,
      direction: 'older',
    })
    expect(res.cursorState).toEqual({ status: 'ok' })
    expect(res.turns.map((t) => t.turnOrdinal)).toEqual([2, 3, 4, 5])
    expect(res.hasMore).toBe(true)
    // newest/older 的续翻游标指向**页内最小**轮(继续往更早翻)
    expect(res.nextCursor).toEqual({ turnOrdinal: 2 })
    // 断点之外的行(6)与未入本页的行(1)都不得混进响应
    expect(res.turns.flatMap((t) => t.messages.map((m) => m.id))).toEqual([
      'm2',
      'm3',
      'm4',
      'm5',
    ])
    expect(fakeState.queries.map((q) => q.kind)).toEqual(['anchor', 'distinct', 'messages'])
  })

  it('newer 续读:nextCursor 指向页内最大轮(与上翻方向相反,两端不得共用一条口径)', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    fakeState.candidates = [8, 9, 10, 11] // ASC
    fakeState.messages = [msgRow('m9', 9, 'nine'), msgRow('m8', 8, 'eight')]
    const res = await findHistoryTurnPage(CONV_ID, {
      limit: 2,
      cursorTurnOrdinal: 7,
      direction: 'newer',
    })
    expect(res.turns.map((t) => t.turnOrdinal)).toEqual([8, 9])
    expect(res.hasMore).toBe(true)
    expect(res.nextCursor).toEqual({ turnOrdinal: 9 })
  })

  it('turnOrdinal 为 NULL 的存量行不得混进任何一轮', async () => {
    fakeState.candidates = [1]
    fakeState.messages = [msgRow('m1', 1, 'one'), msgRow('mx', 1, 'x')]
    const noOrdain: Row = { ...msgRow('mNull', 1, 'orphan'), turnOrdinal: null }
    fakeState.messages.push(noOrdain)
    const res = await findHistoryTurnPage(CONV_ID, { limit: 20, direction: 'newest' })
    expect(res.turns).toHaveLength(1)
    expect(res.turns[0]?.messages.map((m) => m.id)).toEqual(['m1', 'mx'])
  })
})
