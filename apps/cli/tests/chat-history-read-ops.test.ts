// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D35 消费方(CLI)回归 —— 游标增量读取 + 增量回放对账(2026-09-27)。
 *
 * 这份文件存在的理由不是"CLI 多了个命令",而是:**投影层此前没有任何可执行入口**。
 * 共享层那条"生产面至少一个 importer"的锁能被一个从未挂载的钩子满足,于是能力可以
 * 一直躺在库里而没人走过。这里把整条读路径(首屏 → 中间页 → 末页 → 从断点续读)
 * 真走一遍,并把**每一次请求的 direction/cursor 与收到的字节**写成断言 ——
 * "没有全量重传"必须是一句可复算的算术,不是一句形容词。
 *
 * 零网络 / 零 DB(AGENTS §5 测试隔离铁律):`fetchPage` 是注入点;假服务端按内存轮次表
 * 回答三种 direction,并**照实复刻**服务端两条护栏 —— limit 夹到 [1,100] + limit+1 探边,
 * 以及"游标那一轮已不存在 ⇒ stale + 空页"。所以本文件同时是 stale 语义的消费侧回归。
 *
 * 判不了的一格如实说:假服务端不是 PostgreSQL,`turn_ordinal > / < 断点` 在真库上的
 * 生效与否只能在有 DB 的机器上验(本机 8810 无监听)—— 那一条由
 * `apps/api/tests/chat-history-turn-page.test.ts` 的"未发出窗口查询"断言 + 离线迁移
 * 判据共同兜,不得把本文件的绿读成"SQL 边界已验证"。
 */
import { describe, it, expect } from 'vitest'
import type { ApiResult } from '@ihui/types'
import type {
  ConversationHistoryResult,
  ConversationMessage,
  GetConversationHistoryParams,
} from '@ihui/api-client'
import { encodeHistoryTurnCursor } from '@ihui/shared/chat'

import {
  addHistoryTally,
  formatHistoryReplayCheckLine,
  historyTallyDelta,
  messageContentBytes,
  readConversationHistory,
  resumeConversationHistory,
} from '../src/commands/history-read-ops.js'

const CONV_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_ID = '22222222-2222-2222-2222-222222222222'
const OWNER = 'user-1'

function message(turnOrdinal: number, seq: number, content: string): ConversationMessage {
  return {
    id: `t${turnOrdinal}-${seq}`,
    conversationId: CONV_ID,
    role: seq === 0 ? 'user' : 'assistant',
    content,
    tokens: null,
    metadata: null,
    createdAt: `2026-09-27T00:00:00.${String(turnOrdinal % 1000).padStart(3, '0')}Z`,
  }
}

function turnMessages(turnOrdinal: number): ConversationMessage[] {
  return [
    message(turnOrdinal, 0, `${'u'.repeat(40)}turn-${turnOrdinal}`),
    message(turnOrdinal, 1, `${'a'.repeat(40)}turn-${turnOrdinal}`),
  ]
}

/** 假服务端看到的会话:轮次表(缺号 = 那一轮已不存在)+ 属主。 */
interface FakeStore {
  turns: Map<number, ConversationMessage[]>
  owner: string
}

function storeWithTurns(count: number): FakeStore {
  const turns = new Map<number, ConversationMessage[]>()
  for (let t = 1; t <= count; t += 1) turns.set(t, turnMessages(t))
  return { turns, owner: OWNER }
}

function bytesOf(store: FakeStore, ordinals: readonly number[]): number {
  let bytes = 0
  for (const o of ordinals) {
    for (const m of store.turns.get(o) ?? []) bytes += messageContentBytes(m)
  }
  return bytes
}

/** 最后一个**已收口**轮次:与写入侧 `advanceHistoryProjection` 同规则(最大轮不计)。 */
function breakpointOf(store: FakeStore): number {
  const all = [...store.turns.keys()].sort((a, b) => a - b)
  return all.length > 1 ? (all[all.length - 2] as number) : 0
}

function projectionStateOf(store: FakeStore): ConversationHistoryResult['projectionState'] {
  const bp = breakpointOf(store)
  return {
    nextRolloutByteOffset: bytesOf(
      store,
      [...store.turns.keys()].filter((o) => o <= bp),
    ),
    nextRolloutOrdinal: bp,
    lastRolledAt: '2026-09-27T00:00:00.000Z',
  }
}

interface FakeCall {
  direction: 'newest' | 'older' | 'newer'
  cursorOrdinal: number | null
  limit: number
}

function decodeCursor(raw: string | undefined): number | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      turnOrdinal?: unknown
    }
    return typeof parsed.turnOrdinal === 'number' ? parsed.turnOrdinal : null
  } catch {
    return null
  }
}

/**
 * 假服务端。三种 direction 各按 keyset 规则回答:
 * - `newest` / `older`:DESC 取 limit+1 探边,页内升序输出,nextCursor = 页内最小轮;
 * - `newer`:ASC 取 limit+1,nextCursor = 页内最大轮;
 * - 带游标而那一轮已不在 ⇒ `cursorState.stale` + 空页(复刻锚点探测)。
 */
function makeFakeFetch(store: FakeStore) {
  const calls: FakeCall[] = []
  // 形参类型必须与注入点**同一份**(`GetConversationHistoryParams`,direction 可省):
  // 在假服务端里把 direction 收成必填,是它被赋给 `HistoryFetch` 时的**逆变**违规。
  // 本文件不在 apps/cli/tsconfig.json 的 include 里(该包排除了 tests),所以这条错误
  // 在包级 typecheck 上看不见 —— 只有把测试文件直接喂 tsc 才红,已就地补上。
  const fetchPage = async (
    conversationId: string,
    params?: GetConversationHistoryParams,
  ): Promise<ApiResult<ConversationHistoryResult>> => {
    const direction: FakeCall['direction'] = params?.direction ?? 'newest'
    // 记账必须在归属判定**之前**:`calls` 量的是"消费体发出了几次请求",而真实端点
    // (chat.ts 的 ensureOwnedConversation → findConversationById → 403)同样是"先收到请求、
    // 再由服务端 SQL 判归属"—— 见 apps/api/tests/chat-history-projection.test.ts 的
    // 「别人的会话 → 403 且未发出翻页查询」(它断言的正是"请求到了服务端、翻页查询没发出")。
    // 放在归属分支之后就等于把"被拒的那一次"从账上抹掉,而本文件的判据要看的就是那一次。
    const limit = Math.min(Math.max(Math.trunc(params?.limit ?? 20) || 1, 1), 100)
    const cursorOrdinal = decodeCursor(params?.cursor)
    calls.push({ direction, cursorOrdinal, limit })
    if (conversationId !== CONV_ID || store.owner !== OWNER) {
      return { success: false, error: '无权访问该对话', status: 403 }
    }
    const all = [...store.turns.keys()].sort((a, b) => a - b)

    if (params?.cursor && cursorOrdinal === null) {
      return { success: false, error: '游标格式非法', status: 400 }
    }
    if (cursorOrdinal !== null && !store.turns.has(cursorOrdinal)) {
      return {
        success: true,
        data: {
          turns: [],
          limit,
          hasMore: false,
          nextCursor: null,
          projectionState: projectionStateOf(store),
          cursorState: { status: 'stale', reason: 'anchor-missing' },
        },
      }
    }

    let window: number[]
    let hasMore: boolean
    if (direction === 'newer') {
      const ahead = all.filter((o) => (cursorOrdinal === null ? true : o > cursorOrdinal))
      hasMore = ahead.length > limit
      window = ahead.slice(0, limit)
    } else {
      const behind =
        direction === 'older' && cursorOrdinal !== null
          ? all.filter((o) => o < cursorOrdinal)
          : all
      const desc = behind.slice(-limit - 1).reverse()
      hasMore = desc.length > limit
      window = desc.slice(0, limit).reverse()
    }
    const first = window[0]
    const last = window[window.length - 1]
    return {
      success: true,
      data: {
        turns: window.map((ordinal) => ({
          turnOrdinal: ordinal,
          messages: store.turns.get(ordinal) ?? [],
        })),
        limit,
        hasMore,
        nextCursor:
          hasMore && (direction === 'newer' ? last : first) !== undefined
            ? encodeHistoryTurnCursor({
                turnOrdinal: (direction === 'newer' ? last : first) as number,
              })
            : null,
        projectionState: projectionStateOf(store),
        cursorState: { status: 'ok' },
      },
    }
  }
  return { calls, fetchPage }
}

describe('首屏 / 中间页 / 末页(三型都按请求链判,不按"最后看起来对"判)', () => {
  it('500 轮 × 50 轮/页翻到底:时间线连贯、逐轮唯一,且没有任何一页是全量', async () => {
    const store = storeWithTurns(500)
    const fake = makeFakeFetch(store)
    const out = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 50,
      maxPages: 20,
      fetchPage: fake.fetchPage,
    })
    expect(out.ok).toBe(true)
    expect(out.stop).toBe('exhausted')
    const ordinals = out.projection.turns.map((t) => t.turnOrdinal)
    expect(ordinals).toEqual(Array.from({ length: 500 }, (_, i) => i + 1))
    for (let i = 1; i < ordinals.length; i += 1) {
      expect((ordinals[i] as number) - (ordinals[i - 1] as number)).toBe(1)
    }
    expect(out.tally.receivedTurns).toBe(500)
    expect(out.perPage.map((p) => p.turns)).toEqual(Array.from({ length: 10 }, () => 50))
    // 首屏一页 = 请求 1 次、收 50 轮,不是 500 轮:这就是"不再一次倒给客户端"
    expect(fake.calls[0]).toEqual({ direction: 'newest', cursorOrdinal: null, limit: 50 })
    expect(out.perPage[0]?.turns).toBe(50)
    expect(out.tally.requests).toBe(10)
    expect(fake.calls.slice(1).every((c) => c.direction === 'older' && c.cursorOrdinal !== null)).toBe(
      true,
    )
    expect(out.projection.boundary.oldestTurnOrdinal).toBe(1)
    expect(out.projection.boundary.newestTurnOrdinal).toBe(500)
  })

  it('中间页:第 k 页的游标必须是第 k-1 页的最小轮(链不能自己猜)', async () => {
    const store = storeWithTurns(300)
    const fake = makeFakeFetch(store)
    const out = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 20,
      maxPages: 3,
      fetchPage: fake.fetchPage,
    })
    expect(out.stop).toBe('max-pages')
    // 第 1 页 281..300,第 2 页 261..280,第 3 页 241..260
    expect(fake.calls.map((c) => c.cursorOrdinal)).toEqual([null, 281, 261])
    expect(out.projection.boundary.oldestTurnOrdinal).toBe(241)
    expect(out.projection.boundary.newestTurnOrdinal).toBe(300)
    expect(out.tally.receivedTurns).toBe(60)
  })

  it('末页(不足一页):一次请求走完,不再多发探边请求', async () => {
    const store = storeWithTurns(7)
    const fake = makeFakeFetch(store)
    const out = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 20,
      fetchPage: fake.fetchPage,
    })
    expect(out.ok).toBe(true)
    expect(fake.calls).toHaveLength(1)
    expect(out.projection.turns).toHaveLength(7)
    expect(out.projection.boundary.hasOlder).toBe(false)
  })

  it('limit 越界先由共享层夹取:不发注定 400 的请求', async () => {
    const store = storeWithTurns(30)
    const fake = makeFakeFetch(store)
    await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 5000,
      maxPages: 1,
      fetchPage: fake.fetchPage,
    })
    expect(fake.calls[0]?.limit).toBe(100)
  })
})

describe('游标越界 / 断点已死 / 别人的会话(三类都必须立刻停)', () => {
  it('游标越界(序号在现存轮之外)⇒ stale,并停在已拿到的部分', async () => {
    const store = storeWithTurns(100)
    const fake = makeFakeFetch(store)
    const initial = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 20,
      fetchPage: fake.fetchPage,
    })
    expect(initial.ok).toBe(true)
    const before = fake.calls.length
    const out = await resumeConversationHistory({
      conversationId: CONV_ID,
      // 客户端攥着一个"以后"的断点(库里最大轮 100,断点 5000)
      previous: {
        ...initial,
        projectionState: {
          nextRolloutByteOffset: 0,
          nextRolloutOrdinal: 5000,
          lastRolledAt: '2026-09-27T00:00:00.000Z',
        },
      },
      fetchPage: fake.fetchPage,
    })
    expect(fake.calls.length).toBe(before + 1)
    expect(out.stop).toBe('stale-cursor')
    expect(out.ok).toBe(false)
    expect(out.cursorState).toEqual({ status: 'stale', reason: 'anchor-missing' })
    // 已拿到的部分不得被清空,也不得被拼上任何新东西
    expect(out.projection.turns).toEqual(initial.projection.turns)
    expect(out.tally.receivedTurns).toBe(0)
  })

  it('断点那一轮被删掉(压缩重编号同型)⇒ 续读判死,不返回半真窗口', async () => {
    const store = storeWithTurns(100)
    const initial = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 100,
      fetchPage: makeFakeFetch(store).fetchPage,
    })
    const bp = breakpointOf(store)
    expect(bp).toBe(99)
    store.turns.delete(bp) // 断点所在轮整轮消失
    const fake = makeFakeFetch(store)
    const out = await resumeConversationHistory({
      conversationId: CONV_ID,
      previous: initial,
      fetchPage: fake.fetchPage,
    })
    expect(out.stop).toBe('stale-cursor')
    expect(fake.calls.map((c) => c.cursorOrdinal)).toEqual([bp])
    expect(out.tally.receivedTurns).toBe(0)
    expect(out.projection.turns.length).toBe(100)
  })

  it('没有 rollout 断点时一个请求都不发(续读不是全量重拉的别名)', async () => {
    const store = storeWithTurns(0)
    const fake = makeFakeFetch(store)
    const initial = await readConversationHistory({
      conversationId: CONV_ID,
      fetchPage: fake.fetchPage,
    })
    const before = fake.calls.length
    const resumed = await resumeConversationHistory({
      conversationId: CONV_ID,
      previous: { ...initial, projectionState: null },
      fetchPage: fake.fetchPage,
    })
    expect(resumed.ok).toBe(false)
    expect(resumed.stop).toBe('no-start')
    expect(fake.calls.length).toBe(before)
    expect(resumed.tally.requests).toBe(0)
  })

  it('别人的会话 ⇒ 一次请求后立刻停:不翻页、不投影任何字节', async () => {
    const store = storeWithTurns(30)
    const fake = makeFakeFetch(store)
    const out = await readConversationHistory({
      conversationId: OTHER_ID,
      fetchPage: fake.fetchPage,
    })
    expect(out.ok).toBe(false)
    expect(out.stop).toBe('denied')
    expect(out.status).toBe(403)
    expect(fake.calls).toHaveLength(1)
    expect(out.projection.turns).toEqual([])
    expect(out.tally.receivedBytes).toBe(0)
  })
})

describe('增量回放对账(追加 N 轮之后的第二次拉取)', () => {
  it('追加 5 轮 ⇒ 第二次只取断点之后的窗口:5 轮新增 + 至多 1 轮进行中轮重发', async () => {
    const store = storeWithTurns(100)
    const fake = makeFakeFetch(store)
    const initial = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 50,
      maxPages: 20,
      fetchPage: fake.fetchPage,
    })
    expect(initial.ok).toBe(true)
    const initialBytes = initial.tally.receivedBytes
    const initialRequests = initial.tally.requests

    // 断点 = 最后一条**已收口**轮(写入侧规则:最大轮不计)⇒ 首屏已持有的第 100 轮
    // 在断点之后,`direction=newer` 的 keyset 取 `turn_ordinal > 断点` 会把它再发一遍。
    // 这是已入库的契约,不是本用例可以收紧的东西:
    // - 共享层 nextRolloutOrdinal 文档:「`direction=newer` 的 keyset 起点(服务端取 > 断点)
    //   恰好覆盖"进行中轮 + 其后全部新轮",配合整轮替换幂等」
    // - 写入侧 advanceHistoryProjection:`rolled = closed.filter(s => s.turnOrdinal < maxSeen)`
    // - 取数侧 findHistoryTurnPage:新侧条件 gt(chatMessages.turnOrdinal, cursorTurnOrdinal)
    // 所以"增量"的可核验定义是 **5 轮新增正文 + 恰好 1 轮边界重发**,不是"一个字都不重发";
    // 而时间线只增长 5 轮、重发那一轮被整轮替换(不重复累加),才是"没有全量重传"的证据。
    const added = [101, 102, 103, 104, 105]
    for (const t of added) store.turns.set(t, turnMessages(t))
    const addedBytes = bytesOf(store, added)
    const resent: number[] = [breakpointOf(storeWithTurns(100)) + 1] // 首个未计入断点的轮 = 100
    expect(resent).toEqual([100])
    const resumeBytes = addedBytes + bytesOf(store, resent)

    const resumed = await resumeConversationHistory({
      conversationId: CONV_ID,
      previous: initial,
      turnsPerPage: 50,
      fetchPage: fake.fetchPage,
    })
    expect(resumed.ok).toBe(true)
    expect(resumed.projection.turns.map((t) => t.turnOrdinal)).toEqual(
      Array.from({ length: 105 }, (_, i) => i + 1),
    )
    // 收到的窗口就是断点之后的连续尾段:6 轮,不是 105 轮
    expect(resumed.perPage).toHaveLength(1)
    expect(resumed.perPage[0]?.turns).toBe(added.length + resent.length)
    expect(resumed.tally.requests).toBe(1)
    expect(resumed.tally.receivedTurns).toBe(added.length + resent.length)
    expect(resumed.tally.receivedBytes).toBe(resumeBytes)
    // 时间线只增长 5 轮,重发那一轮走整轮替换 ⇒ 1 轮被替换、0 轮被重复计进时间线
    expect(resumed.projection.turns.length - initial.projection.turns.length).toBe(added.length)
    expect(resumed.projection.replacedTurns - initial.projection.replacedTurns).toBe(resent.length)
    expect(resumed.perPage[0]?.direction).toBe('newer')
    expect(resumed.perPage[0]?.bytes).toBe(resumeBytes)

    const combined = addHistoryTally(initial.tally, resumed.tally)
    expect(historyTallyDelta(initial.tally, combined)).toEqual(resumed.tally)

    const check = formatHistoryReplayCheckLine(resumed.tally, initial.tally)
    // 验收证据:整段重取的代价 = initialBytes;实际付的 = 新增正文 + 一轮边界重发
    console.info(
      `[D35 replay evidence] turns 100->105 initialRequests=${initialRequests}` +
        ` initialBytes=${initialBytes} resumeRequests=${resumed.tally.requests}` +
        ` resumeBytes=${resumed.tally.receivedBytes} addedBytes=${addedBytes}` +
        ` resentBytes=${resumeBytes - addedBytes}` +
        ` ${check.line} savedRatio=${check.savedRatio.toFixed(4)}`,
    )
    expect(resumed.tally.receivedBytes).toBeLessThan(initialBytes)
    expect(check.savedRatio).toBeGreaterThan(0.9)
  })

  it('服务端重发同一页 ⇒ 时间线逐字不变(整轮替换幂等,所以旧页可安全重投)', async () => {
    // 固定应答同一个重叠页:第二次、第三次都必须不增长时间线
    let hits = 0
    const fixedFetch = async (): Promise<ApiResult<ConversationHistoryResult>> => {
      hits += 1
      return {
        success: true,
        data: {
          turns: [3, 4, 5].map((turnOrdinal) => ({
            turnOrdinal,
            messages: turnMessages(turnOrdinal),
          })),
          limit: 3,
          hasMore: true,
          nextCursor: encodeHistoryTurnCursor({ turnOrdinal: 3 }),
          projectionState: {
            nextRolloutByteOffset: 1,
            nextRolloutOrdinal: 4,
            lastRolledAt: '2026-09-27T00:00:00.000Z',
          },
          cursorState: { status: 'ok' },
        },
      }
    }
    const out = await readConversationHistory({
      conversationId: CONV_ID,
      turnsPerPage: 3,
      maxPages: 4,
      fetchPage: fixedFetch,
    })
    expect(hits).toBe(4)
    expect(out.projection.turns.map((t) => t.turnOrdinal)).toEqual([3, 4, 5])
    // 后 3 页每页都整页重叠 ⇒ replacedTurns 累计 9(3 页 × 3 轮),且没有一轮被记两次
    expect(out.projection.replacedTurns).toBe(9)
    expect(out.tally.receivedTurns).toBe(12)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
