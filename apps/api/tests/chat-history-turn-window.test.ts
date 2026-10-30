// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 差距⑤(2026-10-30 立)网关侧数据层:findHistoryTurnWindow 居中窗口编排。
 *
 * 判的是编排,不是 SQL 边界(假执行器与 chat-history-turn-page.test.ts 同纪律,
 * 不解释 `turn_ordinal > / <`):
 * - 两次 selectDistinct 的**调用次序**即方向契约 —— 第 1 次=上侧(DESC 候选,
 *   'older' 折叠出升序),第 2 次=下侧(ASC 候选,'newer' 折叠不反转);
 *   distinctQueue 逐次 shift 把这两格分开喂,窗口折叠本身复用既有纯函数判据
 *   (selectHistoryTurnWindow 的 15 型正反例在 turn-page 文件,不重复判)。
 * - 锚点探测为空 ⇒ 返回 null 且**不发任何窗口/明细查询**(404 语义的查询面证据)。
 * - 头/尾 turn:一侧候选为空 ⇒ 该侧 hasMore=false、cursor=null(各自到头)。
 * - cursor 只指向真正进了本页的轮(第 window+1 条候选仅探边,不得成为断点)。
 *
 * 零 DB 副作用(AGENTS §5):`../src/db/index.js` 整模块换成记录型假执行器。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

type Row = Record<string, unknown>

interface FakeStateShape {
  /** 两次 selectDistinct 的候选队列(按调用次序 shift:第 1 次=上侧 DESC,第 2 次=下侧 ASC) */
  distinctQueue: number[][]
  /** 假消息表行(loadTurnGroups 第二步取回的明细) */
  messages: Row[]
  /** 游标锚点探测的返回值:[] = 该轮不存在 ⇒ findHistoryTurnWindow 回 null */
  anchorRows: Row[]
  /** 发过的查询痕迹(kind + limit),用于断"哪条查询根本没发" */
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
    distinctQueue: [],
    messages: [],
    anchorRows: [],
    queries: [],
  }
  const clear = (): void => {
    state.distinctQueue = []
    state.messages.length = 0
    state.anchorRows = []
    state.queries.length = 0
  }

  const api = {
    /**
     * select 的两种形状按 fields 的键区分(与 turn-page 测试同纪律):
     * - `{id}` ⇒ 锚点探测(historyTurnAnchorExists)
     * - 无 fields ⇒ 消息明细(loadTurnGroups)
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
          // 按调用次序取该侧候选(编排保证:第 1 次=上侧,第 2 次=下侧)
          const candidates = isTurnOrdinal ? (state.distinctQueue.shift() ?? []) : []
          state.queries.push({ kind: 'distinct', limit: takenLimit })
          return Promise.resolve(candidates.map((turnOrdinal) => ({ turnOrdinal }))).then(onf, onr)
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

import { findHistoryTurnWindow } from '../src/db/chat-queries.js'

const CONV_ID = '11111111-1111-1111-1111-111111111111'

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

/** 会话共 7 轮(1..7),每轮一条消息 */
function fullSevenTurns(): void {
  fakeState.messages = [1, 2, 3, 4, 5, 6, 7].map((t) => msgRow(`m${t}`, t, `t${t}`))
}

beforeEach(() => {
  reset()
})

describe('findHistoryTurnWindow:居中窗口编排', () => {
  it('中间轮 around=4/window=2:前后各 2 轮 + 中心,双 cursor 指向页内沿,第 window+1 条只探边', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    // 上侧 DESC 候选(limit=window+1=3):3,2,1 —— 1 只探边,不进页也不做断点
    // 下侧 ASC 候选:5,6,7 —— 7 同理
    fakeState.distinctQueue = [
      [3, 2, 1],
      [5, 6, 7],
    ]
    fullSevenTurns()
    const res = await findHistoryTurnWindow(CONV_ID, { around: 4, window: 2 })
    expect(res).not.toBeNull()
    const win = res!
    expect(win.turns.map((t) => t.turnOrdinal)).toEqual([2, 3, 4, 5, 6])
    expect(win.turns.flatMap((t) => t.messages.map((m) => m.id))).toEqual([
      'm2',
      'm3',
      'm4',
      'm5',
      'm6',
    ])
    expect(win.hasMoreBefore).toBe(true)
    expect(win.hasMoreAfter).toBe(true)
    // cursor 只指向真正进了本页的轮:上沿 2(配 older 续翻),下沿 6(配 newer 续读)
    expect(win.beforeCursor).toEqual({ turnOrdinal: 2 })
    expect(win.afterCursor).toEqual({ turnOrdinal: 6 })
    // 编排痕迹:探测 → 上侧候选 → 下侧候选 → 一次明细(limit 均为 window+1 探边)
    expect(win && fakeState.queries.map((q) => q.kind)).toEqual([
      'anchor',
      'distinct',
      'distinct',
      'messages',
    ])
    expect(fakeState.queries.filter((q) => q.kind === 'distinct').map((q) => q.limit)).toEqual([
      3, 3,
    ])
  })

  it('边界:首 turn(around=1)⇒ 上侧无候选,hasMoreBefore=false 且 beforeCursor=null', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    fakeState.distinctQueue = [[], [2, 3, 4]]
    fullSevenTurns()
    const res = await findHistoryTurnWindow(CONV_ID, { around: 1, window: 2 })
    expect(res).not.toBeNull()
    const win = res!
    expect(win.turns.map((t) => t.turnOrdinal)).toEqual([1, 2, 3])
    expect(win.hasMoreBefore).toBe(false)
    expect(win.beforeCursor).toBeNull()
    expect(win.hasMoreAfter).toBe(true)
    expect(win.afterCursor).toEqual({ turnOrdinal: 3 })
  })

  it('边界:尾 turn(around=7)⇒ 下侧无候选,hasMoreAfter=false 且 afterCursor=null', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    fakeState.distinctQueue = [[6, 5, 4], []]
    fullSevenTurns()
    const res = await findHistoryTurnWindow(CONV_ID, { around: 7, window: 2 })
    expect(res).not.toBeNull()
    const win = res!
    expect(win.turns.map((t) => t.turnOrdinal)).toEqual([5, 6, 7])
    expect(win.hasMoreBefore).toBe(true)
    expect(win.beforeCursor).toEqual({ turnOrdinal: 5 })
    expect(win.hasMoreAfter).toBe(false)
    expect(win.afterCursor).toBeNull()
  })

  it('全覆盖(窗口罩住全历史)⇒ 两端 hasMore 皆假、双 cursor 皆 null', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    fakeState.distinctQueue = [
      [3, 2, 1],
      [5, 6, 7],
    ]
    fullSevenTurns()
    const res = await findHistoryTurnWindow(CONV_ID, { around: 4, window: 10 })
    expect(res).not.toBeNull()
    const win = res!
    expect(win.turns.map((t) => t.turnOrdinal)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(win.hasMoreBefore).toBe(false)
    expect(win.hasMoreAfter).toBe(false)
    expect(win.beforeCursor).toBeNull()
    expect(win.afterCursor).toBeNull()
  })

  it('turn 不存在 ⇒ null 且只发一条锚点探测(不切窗口、不发明细查询)', async () => {
    fakeState.anchorRows = []
    fakeState.distinctQueue = [
      [3, 2, 1],
      [5, 6, 7],
    ]
    fullSevenTurns()
    const res = await findHistoryTurnWindow(CONV_ID, { around: 99, window: 2 })
    expect(res).toBeNull()
    // 断"未发出查询":先切窗口再判 404 也是 null 结果,所以必须看查询痕迹
    expect(fakeState.queries.map((q) => q.kind)).toEqual(['anchor'])
    expect(fakeState.queries[0]).toEqual({ kind: 'anchor', limit: 1 })
  })

  it('中心轮行存在但窗口内某候选轮无明细行 ⇒ 空轮剔除,中心轮必在页内', async () => {
    fakeState.anchorRows = [{ id: 'anchor' }]
    fakeState.distinctQueue = [[3, 2], [5]]
    fakeState.messages = [msgRow('m2', 2, 'two'), msgRow('m4', 4, 'four'), msgRow('m5', 5, 'five')]
    const res = await findHistoryTurnWindow(CONV_ID, { around: 4, window: 2 })
    expect(res).not.toBeNull()
    const win = res!
    // turn 3 被剔除(无明细行),但 beforeCursor 仍指向页内实际最小轮 2
    expect(win.turns.map((t) => t.turnOrdinal)).toEqual([2, 4, 5])
    expect(win.hasMoreBefore).toBe(false)
    expect(win.beforeCursor).toBeNull()
    expect(win.afterCursor).toBeNull()
  })
})
