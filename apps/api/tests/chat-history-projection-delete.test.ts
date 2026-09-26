// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 投影断点 **删除段**(O82续四·投影删除段①)回归。
 *
 * 这一票要消灭的形态:四条删除类写入路径(regenerateConversationMessages /
 * editMessageAndTruncateAfter / deleteMessage / clearMessages)不碰投影断点,
 * 于是删除之后断点仍指着已经消失的轮次。
 *
 * 语义结论(四条一律 reset,不做"回退到不超过现存最大轮"),判据在本文件
 * describe('为什么只能是 reset') 两组用例里,不在注释里自证:
 *  1. 投影状态是 { ordinal 断点, 字节累计 } 一对,字节累计的定义就是"断点及之前所有轮次
 *     的字节和"。单独把 ordinal 调小而不动字节量,下一次 roll 的取数窗口
 *     `turn_ordinal > 新断点` 会把仍然存在的轮次再加一遍 ⇒ "回退"产出的不是保守值,是错账。
 *  2. 要把字节量也改对,就必须重读断点之前的全部行 —— 那已经是 reset。
 *  3. editMessageAndTruncateAfter 更硬:它原地改**已计入断点**那一轮的正文,不 reset 就是
 *     永久错账(roll 结构上永不回看断点之前的行),连"滞后到下一次开新轮"都算不上。
 *
 * 读侧对断点变小/归零不敏感(所以回退是安全的,不需要读侧配合改动):
 * projectionState 全程 opaque,且客户端 mergeHistoryTurnPages 按 turnOrdinal 用 Map
 * 整轮替换(last-write-wins) ⇒ 从更小断点重放只会覆盖已见过的轮次,不会重复累加。
 *
 * 零 DB 副作用(AGENTS §5 测试隔离铁律):`../src/db/index.js` 整模块换成记录型假执行器,
 * 全程不建连接池、不连任何库。
 *
 * 假执行器的两处刻意约定(读数依赖它们,故写在这里而不是埋在代码里):
 *  - `findMessageById` / 消息表整行 select 一律"按数组顺序返回",所以**每个用例把目标消息
 *    放在 messages[0]**,`update(chatMessages)` 的补丁同样落在 messages[0];
 *  - `delete` 无法解析 drizzle 的不透明 where,改由用例声明 `deletePlan(survivors)` 精确
 *    指定哪些行活下来。本文件判的是"删除发生之后断点接没接对",删除谓词本身的正确性
 *    不在此射程(那是各路径既有测试的活)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const CONV_ID = 'conv-1'

type Row = Record<string, unknown>

interface FakeStateShape {
  conversation: Row
  messages: Row[]
  /** 每一次 UPDATE 的 set 载荷,按发生顺序留痕(证明落库经 UPDATE,不是只在内存算了一遍) */
  updates: Row[]
  /** 用例声明的删除语义:返回存活的行;缺省 = 整表清空(clearMessages 那一型) */
  deletePlan: ((rows: Row[]) => Row[]) | null
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

interface FakeDb {
  select(fields?: Row): Chain
  insert(table: unknown): Chain
  update(table: unknown): Chain
  delete(table: unknown): Chain
  transaction(cb: (tx: unknown) => Promise<unknown>): Promise<unknown>
}

const { fakeState, fakeDb, reset } = vi.hoisted(() => {
  const state: FakeStateShape = {
    conversation: {},
    messages: [],
    updates: [],
    deletePlan: null,
  }
  const clear = (): void => {
    state.conversation = {
      id: 'conv-1',
      userId: 'user-1',
      title: '会话',
      historyProjectionState: null,
    }
    state.messages.length = 0
    state.updates.length = 0
    state.deletePlan = null
  }

  /**
   * 表身份按列名判定(hoisted 里不 import @ihui/database,避免求值顺序问题)。
   * drizzle 0.38 的表对象没有 `.columns`:列的 JS 键是 own keys,SQL 列名在
   * `Symbol.for('drizzle:Columns')` 的映射值里,两种都吃下。
   */
  const tableKind = (table: unknown): 'conversation' | 'messages' => {
    if (!table || typeof table !== 'object') return 'messages'
    const t = table as Record<string | symbol, unknown>
    const names = new Set<string>(Object.keys(t))
    const bySymbol = t[Symbol.for('drizzle:Columns')]
    if (bySymbol && typeof bySymbol === 'object') {
      for (const col of Object.values(bySymbol as Record<string, unknown>)) {
        const name = (col as { name?: unknown } | undefined)?.name
        if (typeof name === 'string') names.add(name)
      }
    }
    return names.has('history_projection_state') || names.has('historyProjectionState')
      ? 'conversation'
      : 'messages'
  }

  const selectRows = (fields: Row | undefined, kind: 'conversation' | 'messages'): Row[] => {
    if (kind === 'conversation') {
      if (fields && 'historyProjectionState' in fields) {
        return [{ historyProjectionState: state.conversation.historyProjectionState ?? null }]
      }
      return [{ ...state.conversation }]
    }
    if (fields && 'maxTurn' in fields) {
      const ords = state.messages
        .map((m) => m.turnOrdinal)
        .filter((v): v is number => typeof v === 'number')
      return [{ maxTurn: ords.length > 0 ? Math.max(...ords) : null }]
    }
    if (fields && 'count' in fields) return [{ count: state.messages.length }]
    // 投影器要的 { turnOrdinal, content } / deleteMessage 要的 { conversationId } /
    // lastMessageAt 要的 { createdAt } / findMessageById 的整行 —— 一律按数组顺序给全量
    return state.messages.map((m) => ({ ...m }))
  }

  const api = {
    select: (fields?: Row) => {
      let kind: 'conversation' | 'messages' = 'messages'
      const self: Chain = {
        from: (t) => {
          kind = tableKind(t)
          return self
        },
        where: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        set: () => self,
        returning: () => self,
        then: (onf, onr) => Promise.resolve(selectRows(fields, kind)).then(onf, onr),
      }
      return self
    },
    insert: () => {
      // 本文件不经插入造数据(用例直接 seed messages),但仍要能承接 createMessage 的写入
      let pending: Row[] = []
      let materialized: Row[] | null = null
      const apply = (): Row[] => {
        if (materialized) return materialized
        const rows = pending.map((v, i) => ({
          id: `m${state.messages.length + i + 1}`,
          conversationId: CONV_ID,
          role: 'user',
          content: '',
          reasoning: null,
          tokens: null,
          metadata: null,
          createdAt: new Date(Date.UTC(2026, 0, 1)),
          turnOrdinal: null,
          ...v,
        }))
        state.messages.push(...rows)
        materialized = rows
        return rows
      }
      const self: Chain = {
        from: () => self,
        where: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        set: () => self,
        returning: () => {
          apply()
          return self
        },
        values: (v) => {
          pending = Array.isArray(v) ? (v as Row[]) : [v as Row]
          return self
        },
        then: (onf, onr) => Promise.resolve(pending.length > 0 ? apply() : []).then(onf, onr),
      }
      return self
    },
    update: (table) => {
      const kind = tableKind(table)
      let patch: Row | null = null
      let withReturning = false
      const self: Chain = {
        from: () => self,
        where: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        returning: () => {
          withReturning = true
          return self
        },
        set: (obj) => {
          state.updates.push({ ...obj })
          patch = obj
          if (kind === 'conversation') Object.assign(state.conversation, obj)
          return self
        },
        then: (onf, onr) => {
          // 消息表带 returning 的更新:补丁落在 messages[0](即本文件的"目标消息")
          if (kind === 'messages' && withReturning && patch) {
            const target = state.messages[0]
            if (target) Object.assign(target, patch)
            return Promise.resolve(target ? [target] : []).then(onf, onr)
          }
          return Promise.resolve([] as Row[]).then(onf, onr)
        },
      }
      return self
    },
    delete: (table) => {
      const kind = tableKind(table)
      const self: Chain = {
        from: () => self,
        where: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        set: () => self,
        returning: () => self,
        then: (onf, onr) => {
          if (kind === 'messages') {
            state.messages = state.deletePlan
              ? state.deletePlan(state.messages.map((m) => ({ ...m })))
              : []
            state.deletePlan = null
          }
          return Promise.resolve([] as Row[]).then(onf, onr)
        },
      }
      return self
    },
    transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(api),
  } as unknown as FakeDb
  clear()
  return { fakeState: state, fakeDb: api, reset: clear }
})

vi.mock('../src/db/index.js', () => ({ db: fakeDb, dbRead: fakeDb }))

import {
  advanceHistoryProjection,
  clearMessages,
  deleteMessage,
  editMessageAndTruncateAfter,
  findConversationById,
  parseHistoryProjectionState,
  regenerateConversationMessages,
  type HistoryProjectionState,
  type HistoryTurnSlice,
} from '../src/db/chat-queries.js'

const slice = (turnOrdinal: number, byteLength: number): HistoryTurnSlice => ({
  turnOrdinal,
  byteLength,
})

const bytes = (...texts: string[]): number =>
  texts.reduce((sum, t) => sum + Buffer.byteLength(t, 'utf8'), 0)

/** 一条已分轮的消息行;id 供 deletePlan 挑选,ordinal/role/content 供投影与断言 */
const msg = (id: string, turnOrdinal: number, role: string, content: string): Row => ({
  id,
  conversationId: CONV_ID,
  role,
  content,
  reasoning: null,
  tokens: null,
  metadata: null,
  createdAt: new Date(Date.UTC(2026, 0, 1, 0, turnOrdinal)),
  turnOrdinal,
})

/** 旧断点形态:删除前已经推进过的存量 */
const legacyState = (byteOffset: number, ordinal: number): HistoryProjectionState => ({
  nextRolloutByteOffset: byteOffset,
  nextRolloutOrdinal: ordinal,
  lastRolledAt: '2026-01-01T00:00:00.000Z',
})

async function readStoredState(): Promise<HistoryProjectionState | null> {
  const conversation = await findConversationById(CONV_ID)
  return parseHistoryProjectionState(conversation?.historyProjectionState)
}

const projectionWrites = (): Row[] => fakeState.updates.filter((u) => 'historyProjectionState' in u)

/** 让 id 集合之外的消息活下来(等价"删掉这一批") */
const keepOnly = (...ids: string[]) => {
  fakeState.deletePlan = (rows) => rows.filter((r) => ids.includes(String(r.id)))
}

describe('为什么只能是 reset(回退断点而保留字节累计 = 重复累加)', () => {
  const ROLLED_AT = new Date('2026-09-26T08:00:00.000Z')

  it('把断点从 2 调到 1 却不动字节量 ⇒ 下一轮把仍然存在的第 2 轮再加一遍', () => {
    // 真值:turn1=4B、turn2=2B ⇒ 断点 2 的字节累计应是 6
    const clampedWithoutRecompute = legacyState(6, 1)
    const next = advanceHistoryProjection(
      clampedWithoutRecompute,
      [slice(2, 2), slice(3, 5)],
      ROLLED_AT,
    )
    // 6 里已含 turn2 的 2B,再滚一轮 ⇒ 8B(虚高),而它看起来只是一次"正常推进"
    expect(next).toEqual({
      nextRolloutByteOffset: 8,
      nextRolloutOrdinal: 2,
      lastRolledAt: '2026-09-26T08:00:00.000Z',
    })
    expect(next?.nextRolloutByteOffset).not.toBe(6)
  })

  it('同一批行走 reset(prev=null 重算)⇒ 字节量与现存行集同源', () => {
    const next = advanceHistoryProjection(null, [slice(1, 4), slice(2, 2), slice(3, 5)], ROLLED_AT)
    expect(next).toEqual({
      nextRolloutByteOffset: 6,
      nextRolloutOrdinal: 2,
      lastRolledAt: '2026-09-26T08:00:00.000Z',
    })
  })
})

describe('regenerateConversationMessages:删尾部后断点不得越过现存轮次', () => {
  beforeEach(() => {
    reset()
    // messages[0] = 目标(t3 的 assistant 回复),其余按轮次铺开
    fakeState.messages = [
      msg('t3a', 3, 'assistant', 'a3'),
      msg('t1u', 1, 'user', 'u1'),
      msg('t1a', 1, 'assistant', 'a1'),
      msg('t2u', 2, 'user', 'u2'),
      msg('t2a', 2, 'assistant', 'a2'),
      msg('t3u', 3, 'user', 'u3'),
      msg('t4u', 4, 'user', 'u4'),
    ]
    fakeState.conversation.historyProjectionState = legacyState(12, 3)
  })

  it('删掉 t3a 与 t4u 后:断点回落到重算值(3→2),字节量按剩余行集 8B 而非旧累计 12B', async () => {
    keepOnly('t1u', 't1a', 't2u', 't2a', 't3u')
    const result = await regenerateConversationMessages(CONV_ID, 't3a')
    expect(result.remainingCount).toBe(5)

    const next = await readStoredState()
    expect(next?.nextRolloutOrdinal).toBe(2)
    expect(next?.nextRolloutByteOffset).toBe(bytes('u1', 'a1', 'u2', 'a2'))
    expect(next?.nextRolloutByteOffset).toBe(8)
    // 确实经由一次 UPDATE chat_conversations 落库
    expect(projectionWrites()).toHaveLength(1)
  })

  it('删到只剩一轮:无收口轮次是结论 ⇒ 断点写回 null,而不是留在越过现存轮次的旧值', async () => {
    keepOnly('t1u', 't1a')
    await regenerateConversationMessages(CONV_ID, 't3a')

    expect(await readStoredState()).toBeNull()
    // 关键反证:不发 UPDATE 的实现也会读到 null 吗?不会 —— 存量还挂在会话行上。
    // 所以"写过一次"必须单独断言,否则这条判据会退化成为恒真的读侧检查。
    expect(projectionWrites()).toHaveLength(1)
  })
})

describe('editMessageAndTruncateAfter:原地改已计入断点那一轮的正文', () => {
  beforeEach(() => {
    reset()
    fakeState.messages = [
      msg('t2u', 2, 'user', 'q2'),
      msg('t1u', 1, 'user', 'q1'),
      msg('t1a', 1, 'assistant', 'a1'),
      msg('t2a', 2, 'assistant', 'a2'),
      msg('t3u', 3, 'user', 'q3'),
    ]
    // turn1 = 4B、turn2 = 4B ⇒ 旧断点 2 的累计 8B(含即将被改写的 t2u)
    fakeState.conversation.historyProjectionState = legacyState(8, 2)
  })

  it('断点未越过现存最大轮(仍是 2),但字节量必须按改后正文重算:6B,既非旧 8B 也非 8+新', async () => {
    keepOnly('t1u', 't1a', 't2u')
    const message = await editMessageAndTruncateAfter(CONV_ID, 't2u', 'qqq')
    expect(message).toMatchObject({ id: 't2u', content: 'qqq' })

    const next = await readStoredState()
    // 现存 turn1=4B、turn2='qqq'=3B,maxSeen=2 ⇒ 只收口 turn1
    expect(next?.nextRolloutOrdinal).toBe(1)
    expect(next?.nextRolloutByteOffset).toBe(bytes('q1', 'a1'))
    expect(next?.nextRolloutByteOffset).not.toBe(8)
    expect(projectionWrites()).toHaveLength(1)
  })
})

describe('deleteMessage:删一条已计入断点轮次里的消息', () => {
  beforeEach(() => {
    reset()
    fakeState.messages = [
      msg('t2a', 2, 'assistant', 'a2'),
      msg('t1u', 1, 'user', 'u1'),
      msg('t1a', 1, 'assistant', 'a1'),
      msg('t2u', 2, 'user', 'u2'),
      msg('t3u', 3, 'user', 'u3'),
      msg('t3a', 3, 'assistant', 'a3'),
      msg('t4u', 4, 'user', 'u4'),
    ]
    fakeState.conversation.historyProjectionState = legacyState(12, 3)
  })

  it('ordinal 没变(仍是 3)但字节账必须修回:turn2 少一条 ⇒ 12B → 10B', async () => {
    keepOnly('t1u', 't1a', 't2u', 't3u', 't3a', 't4u')
    await deleteMessage('t2a')

    const next = await readStoredState()
    expect(next?.nextRolloutOrdinal).toBe(3)
    expect(next?.nextRolloutByteOffset).toBe(bytes('u1', 'a1', 'u2', 'u3', 'a3'))
    expect(next?.nextRolloutByteOffset).toBe(10)
    expect(projectionWrites()).toHaveLength(1)
  })

  it('消息本就不存在 ⇒ 查不到所属会话,不得给任何会话刷状态(护栏)', async () => {
    // 存量故意留一份非空断点:一旦对本路径误发 reset,它会被清成 null 并留下一条 UPDATE 痕迹
    const before = legacyState(12, 3)
    fakeState.messages = []
    await deleteMessage('missing-1')
    expect(projectionWrites()).toHaveLength(0)
    expect(await readStoredState()).toEqual(before)
  })
})

describe('clearMessages:清空后不得留下指向已不存在轮次的断点', () => {
  beforeEach(() => {
    reset()
    fakeState.messages = [
      msg('t1u', 1, 'user', 'u1'),
      msg('t1a', 1, 'assistant', 'a1'),
      msg('t2u', 2, 'user', 'u2'),
      msg('t2a', 2, 'assistant', 'a2'),
    ]
    fakeState.conversation.historyProjectionState = legacyState(4, 1)
  })

  it('整表清空 ⇒ 断点写回 null 且确实发了一次 UPDATE', async () => {
    await clearMessages(CONV_ID)
    expect(fakeState.messages).toHaveLength(0)
    expect(await readStoredState()).toBeNull()
    expect(projectionWrites()).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
