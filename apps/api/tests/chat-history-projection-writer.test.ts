// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 历史投影状态**写入侧**回归(2026-09-26,O82续三·D35后续①)。
 *
 * 本票要消灭的形态:读侧 `GET /conversations/:id/history` 的 `projectionState`
 * 永远由默认值(null)填充,因为写侧(迁移注释自称"投影器写入在后续段落接线")
 * 从未落地。所以本文件的判据不是"字段存在",而是**写侧推进一次、读侧就看见一次**:
 * 同一条读路径上,未收口时读到 null、多写一条用户消息后读到 ordinal=1 的真状态。
 * 只改读侧不改写侧 ⇒ 这一组断言必红(写侧不产出,读侧就没有变化可观测)。
 *
 * 零 DB 副作用(AGENTS §5 测试隔离铁律):`../src/db/index.js` 整模块被换成
 * 记录型假执行器,全程不建连接池。假 select 刻意**忽略 SQL 里的
 * `turn_ordinal > 断点` 上界、返回全部行** —— 判据本体在纯函数
 * `advanceHistoryProjection` 的 JS 过滤里(SQL 那条只是取数优化),所以"已收口轮次
 * 被重复累加"这一类错,恰恰只能在多给行的假数据上暴露出来。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const CONV_ID = 'conv-1'
const ROLLED_AT = new Date('2026-09-26T08:00:00.000Z')

type Row = Record<string, unknown>

interface FakeStateShape {
  conversation: Row
  messages: Row[]
  /** 每一次 UPDATE 的 set 载荷,按发生顺序留痕(证明落库经 UPDATE,不是只在内存算了一遍) */
  updates: Row[]
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
  const state: FakeStateShape = { conversation: {}, messages: [], updates: [] }
  const clear = (): void => {
    state.conversation = {
      id: 'conv-1',
      userId: 'user-1',
      title: '会话',
      historyProjectionState: null,
    }
    state.messages.length = 0
    state.updates.length = 0
  }

  /**
   * 表身份按列名判定(hoisted 里不 import @ihui/database,避免求值顺序问题)。
   * 实测本仓 drizzle 0.38 的表对象**没有** `.columns` 属性:列的 JS 键是表自身的
   * own keys,SQL 列名在 `Symbol.for('drizzle:Columns')` 的映射值里。两种都吃下 ——
   * 只认 `.columns` 时整张表会被误判成 chat_messages,"会话行"读成"消息行",
   * 投影状态永远看不见(本测试第一版就是这样恒红的)。
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
    // 含投影器要的 { turnOrdinal, content } —— 刻意不按 SQL 上界过滤(见文件头注)
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
      let pending: Row[] = []
      let materialized: Row[] | null = null
      const apply = (): Row[] => {
        if (materialized) return materialized
        const rows = pending.map((v, i) => ({
          id: `m${state.messages.length + i + 1}`,
          conversationId: 'conv-1',
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
        // 无 returning 的批量插入(压缩重插)在执行点落库
        then: (onf, onr) => {
          const rows = pending.length > 0 ? apply() : []
          return Promise.resolve(rows).then(onf, onr)
        },
      }
      return self
    },
    update: (table) => {
      const kind = tableKind(table)
      const self: Chain = {
        from: () => self,
        where: () => self,
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        returning: () => self,
        set: (obj) => {
          state.updates.push({ ...obj })
          // 只把落给 chat_conversations 的补丁写进会话行;写别的表的更新不得串台
          if (kind === 'conversation') Object.assign(state.conversation, obj)
          return self
        },
        then: (onf, onr) => Promise.resolve([] as Row[]).then(onf, onr),
      }
      return self
    },
    delete: (table) => {
      const kind = tableKind(table)
      const self: Chain = {
        from: () => self,
        where: () => {
          if (kind === 'messages') state.messages.length = 0
          return self
        },
        orderBy: () => self,
        limit: () => self,
        offset: () => self,
        groupBy: () => self,
        values: () => self,
        set: () => self,
        returning: () => self,
        then: (onf, onr) => Promise.resolve([] as Row[]).then(onf, onr),
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
  createMessage,
  findConversationById,
  parseHistoryProjectionState,
  replaceMessages,
  type HistoryProjectionState,
  type HistoryTurnSlice,
} from '../src/db/chat-queries.js'

const slice = (turnOrdinal: number, byteLength: number): HistoryTurnSlice => ({
  turnOrdinal,
  byteLength,
})

const bytes = (...texts: string[]): number =>
  texts.reduce((sum, t) => sum + Buffer.byteLength(t, 'utf8'), 0)

/** 读回会话上已落库的投影状态(读侧唯一的真值来源) */
async function readStoredState(): Promise<HistoryProjectionState | null> {
  const conversation = await findConversationById(CONV_ID)
  return parseHistoryProjectionState(conversation?.historyProjectionState)
}

const projectionWrites = (): Row[] => fakeState.updates.filter((u) => 'historyProjectionState' in u)

describe('advanceHistoryProjection(投影断点纯判据)', () => {
  it('只有最新一轮时不推进:最新一轮仍可能被追加,写进断点=回放读到半截轮', () => {
    expect(advanceHistoryProjection(null, [slice(1, 10)], ROLLED_AT)).toBeNull()
  })

  it('开第二轮即闭合第一轮:断点=1,字节量按 UTF-8 实际字节(中文 3 B/字)累计', () => {
    const next = advanceHistoryProjection(
      null,
      [slice(1, bytes('你好')), slice(2, bytes('hi'))],
      ROLLED_AT,
    )
    expect(next).toEqual({
      nextRolloutByteOffset: 6,
      nextRolloutOrdinal: 1,
      lastRolledAt: '2026-09-26T08:00:00.000Z',
    })
  })

  it('断点只前进:同一批切片再喂一次必须原样返回 prev(同一引用 ⇒ 调用方跳过写入)', () => {
    const slices = [slice(1, 6), slice(2, 6), slice(3, 6)]
    const prev = advanceHistoryProjection(null, slices, ROLLED_AT)
    expect(prev?.nextRolloutOrdinal).toBe(2)
    expect(advanceHistoryProjection(prev, slices, ROLLED_AT)).toBe(prev)
  })

  it('轮次序号有缺口时断点不得越过缺口:切片 [1,3] ⇒ 计入 1,断点停在 1 而非 2', () => {
    const next = advanceHistoryProjection(null, [slice(1, 4), slice(3, 99)], ROLLED_AT)
    expect(next?.nextRolloutOrdinal).toBe(1)
    expect(next?.nextRolloutByteOffset).toBe(4)
  })

  it('累计口径:已有断点 1 时新闭合的轮次只加自己那份字节', () => {
    const prev: HistoryProjectionState = {
      nextRolloutByteOffset: 100,
      nextRolloutOrdinal: 1,
      lastRolledAt: '2026-01-01T00:00:00.000Z',
    }
    const next = advanceHistoryProjection(prev, [slice(2, 7), slice(3, 5)], ROLLED_AT)
    expect(next).toEqual({
      nextRolloutByteOffset: 107,
      nextRolloutOrdinal: 2,
      lastRolledAt: '2026-09-26T08:00:00.000Z',
    })
  })
})

describe('parseHistoryProjectionState(jsonb 读回守卫)', () => {
  const broken: ReadonlyArray<readonly [string, unknown]> = [
    ['null', null],
    ['数组', [1, 2]],
    ['断点非整数', { nextRolloutByteOffset: 1, nextRolloutOrdinal: 1.5, lastRolledAt: 'x' }],
    ['缺 lastRolledAt', { nextRolloutByteOffset: 1, nextRolloutOrdinal: 1 }],
    [
      '字节量为 NaN',
      { nextRolloutByteOffset: Number.NaN, nextRolloutOrdinal: 1, lastRolledAt: 'x' },
    ],
  ]
  for (const [label, raw] of broken) {
    it(`残缺形态(${label})一律按"尚未投影"处理 —— 把坏值当断点会让断点永久卡死`, () => {
      expect(parseHistoryProjectionState(raw)).toBeNull()
    })
  }

  it('完整形态原样取回', () => {
    const ok: HistoryProjectionState = {
      nextRolloutByteOffset: 9,
      nextRolloutOrdinal: 1,
      lastRolledAt: 'x',
    }
    expect(parseHistoryProjectionState(ok)).toEqual(ok)
  })
})

describe('createMessage 接线:写侧推进断点(真 chat-queries + 记录型假执行器)', () => {
  beforeEach(() => reset())

  it('一轮未闭合时读侧仍是 null;开下一轮后同一条读路径立刻看见真状态', async () => {
    await createMessage({ conversationId: CONV_ID, role: 'user', content: '你好' })
    await createMessage({ conversationId: CONV_ID, role: 'assistant', content: 'hi!' })

    // 写侧未推进 ⇒ 读侧此刻仍是 null(排除"常量填充"这一骗法)
    expect(await readStoredState()).toBeNull()
    expect(projectionWrites()).toHaveLength(0)

    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'q2' })

    const written = await readStoredState()
    expect(written).toEqual({
      nextRolloutByteOffset: bytes('你好', 'hi!'),
      nextRolloutOrdinal: 1,
      lastRolledAt: written?.lastRolledAt,
    })
    expect(written?.lastRolledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    // 确实经由 UPDATE chat_conversations 落库,不是只在内存里算了一遍
    expect(projectionWrites()).toHaveLength(1)
  })

  it('不开新轮的写入不得重复累加(假执行器无视 SQL 上界,只靠 JS 判据)', async () => {
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'a' })
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'b' })
    const first = await readStoredState()
    expect(first?.nextRolloutOrdinal).toBe(1)
    expect(first?.nextRolloutByteOffset).toBe(Buffer.byteLength('a', 'utf8'))
    const writesBefore = projectionWrites().length

    await createMessage({ conversationId: CONV_ID, role: 'assistant', content: 'c' })
    expect(await readStoredState()).toEqual(first)
    expect(projectionWrites()).toHaveLength(writesBefore)
  })

  it('连续开三轮:断点逐轮前进且字节累计等于已收口轮次之和(不含仍开放的一轮)', async () => {
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'u1' })
    await createMessage({ conversationId: CONV_ID, role: 'assistant', content: 'a1' })
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'u2' })
    await createMessage({ conversationId: CONV_ID, role: 'assistant', content: 'a2' })
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'u3' })

    const written = await readStoredState()
    expect(written?.nextRolloutOrdinal).toBe(2)
    expect(written?.nextRolloutByteOffset).toBe(bytes('u1', 'a1', 'u2', 'a2'))
  })
})

describe('rollHistoryProjection:reset 与坏存量', () => {
  beforeEach(() => reset())

  it('replaceMessages 重写历史后从 0 重算,既不沿用旧累计也不因旧断点而卡死', async () => {
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'old-1' })
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'old-2' })
    const legacy = await readStoredState()
    expect(legacy?.nextRolloutOrdinal).toBe(1)
    expect(legacy?.nextRolloutByteOffset).toBe(bytes('old-1'))

    await replaceMessages(CONV_ID, [
      { role: 'system', content: '压缩摘要' },
      { role: 'user', content: '保留轮' },
      { role: 'assistant', content: '保留答' },
      { role: 'user', content: '新轮' },
    ])

    const next = await readStoredState()
    // turn 1 = system+user+assistant,turn 2 = 末条 user ⇒ 断点 1,字节量是**新行集**的量
    expect(next?.nextRolloutOrdinal).toBe(1)
    expect(next?.nextRolloutByteOffset).toBe(bytes('压缩摘要', '保留轮', '保留答'))
    expect(next?.nextRolloutByteOffset).not.toBe(legacy?.nextRolloutByteOffset)
  })

  it('存量是坏 jsonb 时按"尚未投影"重算,不冒坏值也不卡死', async () => {
    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'a' })
    fakeState.conversation.historyProjectionState = {
      nextRolloutByteOffset: 5,
      nextRolloutOrdinal: 1.25,
      lastRolledAt: 'nonsense',
    }

    await createMessage({ conversationId: CONV_ID, role: 'user', content: 'bb' })
    const next = await readStoredState()
    expect(next).not.toBeNull()
    expect(next?.nextRolloutOrdinal).toBe(1)
    expect(next?.nextRolloutByteOffset).toBe(bytes('a'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
