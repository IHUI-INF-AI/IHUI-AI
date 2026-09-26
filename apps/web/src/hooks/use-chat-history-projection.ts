// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D35 长会话分页投影 — web 端消费钩子(2026-09-26)。
 *
 * 平台特有:依赖 React 生命周期(useCallback/useMemo/useRef/useState)与浏览器端
 * `@ihui/api-client` 单例注入(setTokenProvider 在 apps/web/src/lib/api.ts 完成),
 * 因此留在端内(AGENTS §3)。投影本身的**全部判据**(游标编解码 / 序数判定 /
 * 重叠页整轮替换 / 边界)住在 `@ihui/shared/chat` 的 history-projection,本文件只做
 * 状态编排,一行分页算术都不重写 —— 重写一份就是小程序/RN 接上时无从对齐。
 *
 * 接线现状(如实登记,不是已完成):本钩子是投影层的**唯一生产面消费者**,
 * **尚未挂进聊天主列表**(message-list / MessageItem 为并行会话长期持有的热文件,
 * 本票禁止改动 ⇒ 无限滚动的 UI 落点是遗留项)。接入形态:
 * `const { turns, boundary, needsReload, loadLatest, loadOlder, refreshNewer } =
 *   useChatHistoryProjection(id)`。
 *
 * projectionState 的消费(O82续四·投影消费段①收口):服务端每页响应携带的 rollout
 * 断点 `nextRolloutOrdinal` 被解析为 direction='newer' 的续读起点 —— 在此之前
 * `refreshNewer` 结构上永不触发(newerCursor 只由 'newer' 响应产生,而发起 'newer'
 * 需要先有它;首屏 'newest' 页的 newer 端恒 null)。接上后:中途进入流式会话看到的
 * "半截最新轮"可被增量续读补全,流结束后的补拉也有权威起点(断点前轮次已收口不变)。
 * 断点**倒退**唯一对应写入侧 `replaceMessages` 的 reset(自动压缩整段重写 + 重编号),
 * 此时投影与服务端行集失配 ⇒ 清空并要求 `loadLatest`(needsReload)。
 * `nextRolloutByteOffset` 不消费:它是写入侧 rollout 量具,读侧端点无按字节续读参数。
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import { getConversationHistory } from '@ihui/api-client'
import type { ConversationMessage } from '@ihui/api-client'
import {
  advanceHistoryPagingCursors,
  decodeHistoryTurnCursor,
  deriveHistoryBoundary,
  mergeHistoryTurnPages,
  projectHistoryPage,
  resolveHistoryRolloutSeed,
} from '@ihui/shared/chat'
import type { HistoryBoundary, HistoryPageWire, HistoryTurnWire } from '@ihui/shared/chat'

/** 服务端一页在本钩子里的形态(与 api-client 的 ConversationHistoryResult 同构)。 */
type HistoryPage = HistoryPageWire<ConversationMessage>

/** 可变时间线元素:共享层一律回 readonly(投影不该被调用方原地改),state 要副本。 */
type MutableTurn = { turnOrdinal: number; messages: ConversationMessage[] }

function toMutableTurns(turns: readonly HistoryTurnWire<ConversationMessage>[]): MutableTurn[] {
  return turns.map((t) => ({ turnOrdinal: t.turnOrdinal, messages: [...t.messages] }))
}

/** 空边界(未加载任何页时的取值;唯一构造点,避免各分支各写一份字面量)。 */
const EMPTY_BOUNDARY: HistoryBoundary = {
  hasOlder: false,
  hasNewer: false,
  olderCursor: null,
  newerCursor: null,
  oldestTurnOrdinal: null,
  newestTurnOrdinal: null,
}

/**
 * 加载失败码(不是文案)。**刻意不在本层写中文字面量**:守门 70 扫 apps/web/src/hooks
 * 的硬编码中文,而文案归 i18n —— 渲染位把码映射成
 * `ai.pane.historyCursorInvalid` / `ai.pane.historyLoadFailed`
 * (键值已登记 `.ihui-agent/tmp/i18n-d35.json`,messages 由主会话单写)。
 */
export type ChatHistoryErrorCode = 'cursor-invalid' | 'load-failed'

export interface ChatHistoryProjectionSummary {
  /** 被丢弃的序数缺失分片数(必须可见,绝不静默)。 */
  droppedUnordained: number
  /** 最近一次合并里被整轮替换的重叠轮数。 */
  lastReplacedTurns: number
}

export interface UseChatHistoryProjectionResult {
  /** turnOrdinal 升序的连贯时间线。 */
  turns: MutableTurn[]
  boundary: HistoryBoundary
  summary: ChatHistoryProjectionSummary
  /** 服务端投影状态原样透传(null = 尚未投影);其断点语义已由本层解析消费(见 needsReload)。 */
  projectionState: unknown
  /**
   * 断点倒退(= 自动压缩整段重写历史)后为 true:时间线已清空、两端游标已作废,
   * 任何翻页都不再发起请求,直到调用方执行 `loadLatest` 整段重建。
   * 这是**状态**不是错误码:它没有对应文案,也不该被渲染成失败 —— 唯一处置是重拉。
   */
  needsReload: boolean
  loading: boolean
  /** null = 未加载过/正常;非 null 是失败**码**,由渲染位翻成文案。 */
  error: ChatHistoryErrorCode | null
  /** 首屏 / 重新进会话:取最新 N turn 并重置整条投影。 */
  loadLatest: (limit?: number) => Promise<void>
  /** 上翻:取断点之前的一页并并入既有时间线(旧 cursor 追加后仍有效)。 */
  loadOlder: (limit?: number) => Promise<void>
  /** 增量续读:取断点之后的页(流结束后补拉,与本地追加幂等)。 */
  refreshNewer: (limit?: number) => Promise<void>
}

interface FoldedPage {
  turns: MutableTurn[]
  boundary: HistoryBoundary
  droppedUnordained: number
  replacedTurns: number
}

/** 三个动作共用的折叠口径。各写一遍必然在"hasMore 归哪一端"上漂移。 */
function foldPage(
  page: HistoryPage,
  direction: 'newest' | 'older' | 'newer',
  existing: readonly HistoryTurnWire<ConversationMessage>[],
): FoldedPage {
  if (direction === 'newest') {
    const projection = projectHistoryPage(page, 'newest')
    return {
      turns: toMutableTurns(projection.turns),
      boundary: projection.boundary,
      droppedUnordained: projection.droppedUnordained,
      replacedTurns: projection.replacedTurns,
    }
  }
  const merged = mergeHistoryTurnPages<ConversationMessage>(existing, page.turns)
  return {
    turns: toMutableTurns(merged.turns),
    boundary: deriveHistoryBoundary(page, direction),
    droppedUnordained: merged.droppedUnordained,
    replacedTurns: merged.replacedTurns,
  }
}

export function useChatHistoryProjection(
  conversationId: string | null,
): UseChatHistoryProjectionResult {
  const [turns, setTurns] = useState<MutableTurn[]>([])
  const [boundary, setBoundary] = useState<HistoryBoundary>(EMPTY_BOUNDARY)
  const [summary, setSummary] = useState<ChatHistoryProjectionSummary>({
    droppedUnordained: 0,
    lastReplacedTurns: 0,
  })
  const [projectionState, setProjectionState] = useState<unknown>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ChatHistoryErrorCode | null>(null)
  // 上一次成功页的两端游标。放 ref 而非 state:并发触发时要读到最新值,
  // 而 React setState 是异步的 —— 读旧闭包会用已作废的断点再发一次请求。
  const cursorsRef = useRef<{ older: string | null; newer: string | null }>({
    older: null,
    newer: null,
  })
  // 上一次采用的 rollout 断点序号(null = 尚未投影)。它只服务一件事:
  // 判"断点倒退 ⇒ 历史被压缩重写"。跨会话必须作废(不同会话的序号空间无关,
  // 拿 A 会话的断点比 B 会话会把正常首屏误判成重写),故与 conversationId 绑定。
  const breakpointRef = useRef<number | null>(null)
  const scopeRef = useRef<string | null | undefined>(undefined)

  const syncConversationScope = useCallback(() => {
    if (scopeRef.current === conversationId) return
    scopeRef.current = conversationId
    breakpointRef.current = null
    cursorsRef.current = { older: null, newer: null }
  }, [conversationId])

  const fetchPage = useCallback(
    async (
      direction: 'newest' | 'older' | 'newer',
      limit: number | undefined,
      cursor: string | null,
    ): Promise<HistoryPage | null> => {
      if (!conversationId) return null
      // 坏游标先本地判掉:服务端对非法 cursor 回 400,带着它重试等于空转撞墙。
      if (cursor !== null && decodeHistoryTurnCursor(cursor) === null) {
        setError('cursor-invalid')
        return null
      }
      setLoading(true)
      setError(null)
      try {
        const res = await getConversationHistory(conversationId, {
          ...(limit !== undefined ? { limit } : {}),
          ...(cursor ? { cursor } : {}),
          direction,
        })
        // fetchApi 回 ApiResult 判别联合:success=false 不是抛错,必须显式分流,
        // 否则 `res.data` 在失败分支是 undefined ⇒ 投影空着却报告"加载成功"。
        if (!res.success) {
          setError('load-failed')
          return null
        }
        return res.data as HistoryPage
      } catch {
        setError('load-failed')
        return null
      } finally {
        setLoading(false)
      }
    },
    [conversationId],
  )

  /**
   * 三个动作共用的唯一落点:断点解析 → 游标推进 → 状态写回。
   * 断点消费(此前 projectionState 存而不读)全部集中在这里 ——
   * 起点推导与"倒退丢弃"的判据在 @ihui/shared/chat 纯函数内,本层只接线。
   */
  const applyFolded = useCallback(
    (folded: FoldedPage, page: HistoryPage, direction: 'newest' | 'older' | 'newer') => {
      const seed = resolveHistoryRolloutSeed(page.projectionState, breakpointRef.current)
      breakpointRef.current = seed.breakpointOrdinal
      const { cursors, discardFolded } = advanceHistoryPagingCursors({
        direction,
        boundary: folded.boundary,
        seed,
        previous: cursorsRef.current,
      })
      cursorsRef.current = cursors
      setProjectionState(page.projectionState)
      if (discardFolded) {
        // 历史被整段重写:已合并时间线与服务端行集无对应关系(轮次按 1 重编号),
        // 整轮替换修不了"旧序号行在服务端已不存在"——只剩整段重建一条路。
        setTurns([])
        setBoundary(EMPTY_BOUNDARY)
        setSummary({ droppedUnordained: 0, lastReplacedTurns: 0 })
        setNeedsReload(true)
        return
      }
      setTurns(folded.turns)
      setBoundary(folded.boundary)
      setSummary({
        droppedUnordained: folded.droppedUnordained,
        lastReplacedTurns: folded.replacedTurns,
      })
      if (direction === 'newest') setNeedsReload(false)
    },
    [],
  )

  const loadLatest = useCallback(
    async (limit?: number) => {
      syncConversationScope()
      const page = await fetchPage('newest', limit, null)
      if (!page) return
      applyFolded(foldPage(page, 'newest', []), page, 'newest')
    },
    [fetchPage, applyFolded, syncConversationScope],
  )

  const loadOlder = useCallback(
    async (limit?: number) => {
      syncConversationScope()
      const cursor = cursorsRef.current.older
      if (!cursor) return
      const page = await fetchPage('older', limit, cursor)
      if (!page) return
      applyFolded(foldPage(page, 'older', turns), page, 'older')
    },
    [fetchPage, applyFolded, turns, syncConversationScope],
  )

  const refreshNewer = useCallback(
    async (limit?: number) => {
      syncConversationScope()
      const cursor = cursorsRef.current.newer
      if (!cursor) return
      const page = await fetchPage('newer', limit, cursor)
      if (!page) return
      applyFolded(foldPage(page, 'newer', turns), page, 'newer')
    },
    [fetchPage, applyFolded, turns, syncConversationScope],
  )

  return useMemo(
    () => ({
      turns,
      boundary,
      summary,
      projectionState,
      needsReload,
      loading,
      error,
      loadLatest,
      loadOlder,
      refreshNewer,
    }),
    [
      turns,
      boundary,
      summary,
      projectionState,
      needsReload,
      loading,
      error,
      loadLatest,
      loadOlder,
      refreshNewer,
    ],
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
