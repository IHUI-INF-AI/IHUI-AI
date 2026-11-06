// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo, useSyncExternalStore } from 'react'
import { formatDateByTemplate } from '@ihui/shared'
// D153b(2026-09-30 立)会话元数据广播账本的读取口:跨端判据在 @ihui/shared/chat,
// 本页只做「把已知行交进去 + 渲染时取覆盖值」两件事(AGENTS §3 共享层优先)
import { conversationMetaLedger } from '@ihui/shared/chat'
// D20 会话列表补齐:数据源与 web / RN 同一份 api-client 出口(AGENTS §3 共享层优先,
// 守门 73 拦端内裸 Taro.request/fetch)。置顶动作只经共享 togglePinnedItem,
// 排序只经共享 sortPinnedFirst —— 端内不再写第二份 filter+sort。
import {
  listConversations,
  setConversationPinned,
  // D20 服务端来源下的删除唯一出口(端内不得裸 Taro.request,守门 73)
  deleteConversation,
  type ConversationDetail,
  type ListConversationsResult,
} from '@ihui/api-client'
import { togglePinnedItem } from '@ihui/shared/chat/conversation-pin'
// 2026-11-05 日历制对齐:日期分桶不再端内自写「滚动 7 天」,与 web 侧栏消费同一份
// 共享实现(@ihui/shared/chat/conversation-date-group:自然日/自然周(周一起)/自然月(1 号起))。
import {
  groupConversationByDate,
  resolveConversationTimestamp,
  type ConversationDateGroupKey,
} from '@ihui/shared/chat/conversation-date-group'
import type { ApiResult } from '@ihui/types'
import { REMOTE_ICONS } from '@/constants/remote-icons'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
// A2(2026-11-05)薄壳化:列表 UI 的渲染真相源迁到共享屏(RN / 小程序消费同一份);
// 唯一标准 packages/app/src/features/chat/ConversationHistoryScreen.tsx;
// 排序出口随 UI 一同迁走,端内不再写第二处 sort(见本文件 orderHistoryRows 的再导出)。
import {
  ConversationHistoryScreen as SharedConversationHistoryScreen,
  orderHistoryRows,
} from '@ihui/rn-app/features/chat/ConversationHistoryScreen'
import { onToast } from '@/host/on-toast'

// 对外导出面保持不变(3 个既有测试从这里 import orderHistoryRows)
export { orderHistoryRows }

/**
 * 远程图标静态注册表:noUncheckedIndexedAccess 下 Record 点号访问返回 string | undefined,
 * 此处断言为具体接口类型(所用 key 均为静态已确认存在),保证点号访问返回 string。
 */
const ICONS = REMOTE_ICONS as {
  message: string
  imageOr: string
  aimusic: string
  jiqiren: string
  search: string
}

type FilterType = 'all' | 'chat' | 'image' | 'voice' | 'agent'
/** 与 web 侧栏同源的日历桶键(today / thisWeek(周一起) / thisMonth(1 号起) / earlier) */
type GroupKey = ConversationDateGroupKey
/** 列表当前的数据来源:server=服务端会话(可置顶);local=本机快照(兜底,不可置顶) */
export type HistorySource = 'server' | 'local'

export interface HistoryItem {
  id: string
  title: string
  time: string
  type?: FilterType
  timestamp?: number
  messages: Array<{ content: string }>
  messageCount?: number
  /**
   * 置顶态。只有服务端来源行会带(true / false);
   * 本机快照行的 id 形如 hist_<ts>,不是 chat_conversations 主键 ⇒ 刻意留 undefined,
   * 排序与置顶入口都按「非 true 即不可置顶」处理,不给必失败的动作留口子。
   */
  pinned?: boolean
}

/**
 * 服务端会话列表行的实际载荷。
 *
 * ConversationDetail 没声明 messageCount,而 apps/api/src/db/chat-queries.ts
 * findConversationsByUser 对本页会话做了聚合并按字段透传(chat.ts serializeConversation),
 * 所以运行时确实带。这里显式建模交叉类型,不得退化成 any / 不得为此改共享类型。
 */
export type ConversationRow = ConversationDetail & { messageCount?: number }

const HISTORY_KEY = 'ai_chat_history'
const PAGE_SIZE = 20
/**
 * 服务端一页取的条数。取 50 是为了与本机快照的既有上限对齐(chat.tsx MAX_HISTORY_COUNT=50),
 * 让页面的分页/「没有更多了」语义在两个数据源下长得一样;第 2 页起由 fetchNextServerPage 续取。
 */
const SERVER_PAGE_SIZE = 50

const FILTERS = (
  tt: TtFn,
): Array<{ key: FilterType; labelKey: string; fallback: string; icon: string }> => [
  {
    key: 'all',
    labelKey: 'common.all',
    fallback: tt('common.all', '全部'),
    icon: ICONS.message,
  },
  {
    key: 'chat',
    labelKey: 'toolbar.ai',
    fallback: tt('toolbar.ai', 'AI对话'),
    icon: ICONS.message,
  },
  {
    key: 'image',
    labelKey: 'aiHistory.d1',
    fallback: tt('aiHistory.d1', 'AI绘图'),
    icon: ICONS.imageOr,
  },
  {
    key: 'voice',
    labelKey: 'aiHistory.d2',
    fallback: tt('aiHistory.d2', 'AI语音'),
    icon: ICONS.aimusic,
  },
  {
    key: 'agent',
    labelKey: 'agent.title',
    fallback: tt('agent.title', '智能体'),
    icon: ICONS.jiqiren,
  },
]

/**
 * 残格④:筛选芯片由数据派生 —— image/voice/agent 三类从无任何写入方
 * (服务端 chat_messages 无类型列,本机快照写入也不设 type),恒空芯片是死 UI。
 * 只有当前列表真存在该类型时才渲染对应芯片;无 type 的行归 'chat'。
 */
export function availableFilterTypes(items: ReadonlyArray<{ type?: FilterType }>): Set<FilterType> {
  const s = new Set<FilterType>(['all', 'chat'])
  for (const x of Array.isArray(items) ? items : []) s.add(x.type || 'chat')
  return s
}

/** 数据重载后当前筛选可能失效(该类型已不存在)⇒ 回落『全部』,不渲染空列表 */
export function resolveActiveFilter(filter: FilterType, available: Set<FilterType>): FilterType {
  return available.has(filter) ? filter : 'all'
}

/**
 * 分组标题(顺序即渲染顺序,与共享层的 CONVERSATION_DATE_GROUP_ORDER 一致)。
 * 「本月」复用 live.calendar.monthStat(取值已是「本月 / This month / 今月 / 이번 달」),
 * 与同页 today 借用 live.calendar.today 是同一套借用口径 —— 小程序词包无 aiHistory 本月键,
 * 不为一个标题新增五语言词条。
 */
const GROUP_LABELS = (tt: TtFn): Record<GroupKey, { labelKey: string; fallback: string }> => ({
  today: { labelKey: 'live.calendar.today', fallback: tt('live.calendar.today', '今天') },
  thisWeek: { labelKey: 'aiHistory.d3', fallback: tt('aiHistory.d3', '本周') },
  thisMonth: {
    labelKey: 'live.calendar.monthStat',
    fallback: tt('live.calendar.monthStat', '本月'),
  },
  earlier: { labelKey: 'aiHistory.d4', fallback: tt('aiHistory.d4', '更早') },
})

/** 读本机快照(兜底副本)。读失败=没有兜底数据,返回空数组而不是抛错。 */
export function readLocalHistory(): HistoryItem[] {
  try {
    const raw = Taro.getStorageSync(HISTORY_KEY)
    return Array.isArray(raw) ? (raw as HistoryItem[]) : []
  } catch {
    return []
  }
}

/** 服务端会话行 → 页面行。消息体不在列表接口里 ⇒ messages 留空、摘要行不渲染。 */
export function mapServerConversation(c: ConversationRow): HistoryItem {
  const raw = c.lastMessageAt ?? c.updatedAt ?? c.createdAt
  const ts = raw ? new Date(raw).getTime() : Number.NaN
  return {
    id: c.id,
    title: c.title,
    time: raw ?? '',
    type: 'chat',
    timestamp: Number.isNaN(ts) ? undefined : ts,
    messages: [],
    messageCount: typeof c.messageCount === 'number' ? c.messageCount : 0,
    pinned: c.pinned === true,
  }
}

/**
 * 服务端还有没有下一页 —— 只认后端给的 total,量不到时按"满页即可能还有"保守判。
 *
 * 为什么允许这一条启发式:它只会**多问一次**(下一轮拿到空页 ⇒ merged 不变 ⇒ 再次判 false),
 * 不会把"还有"洗成"没有";反过来,total 缺失就一律判 false 才是会丢数据的错判。
 */
export function serverHasMoreFromPage(
  loadedCount: number,
  total: unknown,
  pageSize: number = SERVER_PAGE_SIZE,
): boolean {
  if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
    return loadedCount < total
  }
  return loadedCount >= pageSize
}

/**
 * 追加服务端下一页:按 id 去重、保持已有顺序、新行接在后面。
 *
 * 去重不是可选项 —— 服务端按时间倒序分页,两页之间若有人新建/置顶会话,同一条会
 * 同时出现在第 1 页尾与第 2 页头;不去重就是列表里长出双胞胎。
 */
export function mergeHistoryRows(
  prev: readonly HistoryItem[],
  next: readonly HistoryItem[],
): HistoryItem[] {
  const seen = new Set(prev.map((x) => x.id))
  return [...prev, ...next.filter((x) => !seen.has(x.id))]
}

/** 「上拉加载更多」该做的三件事之一(noop=本轮无事可做,finish=到此为止并收起手) */
export type LoadMoreAction = 'noop' | 'advance-page' | 'fetch-server' | 'finish'

/**
 * 上拉时该做什么 —— 本侧还没展示完就先展示,展示完了且服务端还有才去取,
 * 两头都没有才落「没有更多了」。顺序不能反:先问服务端就会在"本机还有一屏没露出"
 * 时白打一次接口,而兜底态(source='local')结构上不该再打服务端。
 */
export function decideLoadMore(s: {
  hasMore: boolean
  loadingMore: boolean
  source: HistorySource
  serverHasMore: boolean
  shownCount: number
  filteredCount: number
}): LoadMoreAction {
  if (!s.hasMore || s.loadingMore) return 'noop'
  if (s.shownCount < s.filteredCount) return 'advance-page'
  if (s.source === 'server' && s.serverHasMore) return 'fetch-server'
  return 'finish'
}

/**
 * 删除一个服务端会话(D20 服务端源下唯一删除出口)。
 *
 * 判序与取列表同形,三条同时成立才算删掉:不抛 ∧ success===true ∧ data.deleted===true。
 * 调用方失败必须回滚列表 + 给可见提示,不得"发了请求就当删好了"—— 那是假成功。
 */
export async function deleteServerConversation(deps: {
  remove: () => Promise<ApiResult<{ deleted: boolean }>>
}): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const res = await deps.remove()
    if (res.success === true && res.data?.deleted === true) return { ok: true }
    return { ok: false, error: res }
  } catch (error) {
    return { ok: false, error }
  }
}

/**
 * 服务端源「清空全部」的并发上界(D20 留尾)。3 路够快又不至于把删除接口打成洪峰。
 * 逐条走单条删除端点 —— 后端没有批量端点,不新增接口,批量语义由端内工作池拼出来。
 */
export const SERVER_CLEAR_CONCURRENCY = 3

/** clearServerConversations 的执行结果:成功/失败按会话 id 分桶(失败桶原样保留、可重试) */
export interface ServerClearOutcome {
  okIds: string[]
  failedIds: string[]
}

/**
 * 服务端源「清空全部」:逐条删除、并发有界、进度可回吐。
 *
 * 每一条的成败都按 deleteServerConversation 的同一判序落桶
 * (不抛 ∧ success===true ∧ data.deleted===true),拒绝"发了请求就当删掉了"。
 * onProgress 每落定一条回吐 (done, total),调用方拿去刷新 showLoading 计数;
 * 全部落定后按 okIds / failedIds 分桶交给调用方做诚实交代。
 */
export async function clearServerConversations(deps: {
  ids: readonly string[]
  remove: (id: string) => Promise<ApiResult<{ deleted: boolean }>>
  onProgress?: (done: number, total: number) => void
  concurrency?: number
}): Promise<ServerClearOutcome> {
  const total = deps.ids.length
  const okIds: string[] = []
  const failedIds: string[] = []
  let done = 0
  let cursor = 0
  const width = Math.max(1, Math.min(deps.concurrency ?? SERVER_CLEAR_CONCURRENCY, total || 1))
  const worker = async () => {
    while (cursor < total) {
      const id = deps.ids[cursor]
      cursor += 1
      if (id === undefined) break
      const outcome = await deleteServerConversation({ remove: () => deps.remove(id) })
      if (outcome.ok) okIds.push(id)
      else failedIds.push(id)
      done += 1
      deps.onProgress?.(done, total)
    }
  }
  await Promise.all(Array.from({ length: width }, () => worker()))
  return { okIds, failedIds }
}

/**
 * 把「清空全部」的执行结果落回列表:成功删掉的行摘除,失败的行原样保留
 * (长按行可单条重试),幸存行保持原有相对顺序。全失败 ⇒ 列表一字不动 ——
 * 不得把"没删掉"渲染成"已清空"。
 */
export function applyServerClearResult(
  prev: readonly HistoryItem[],
  result: ServerClearOutcome,
): { items: HistoryItem[]; allCleared: boolean } {
  const removed = new Set(result.okIds)
  return {
    items: prev.filter((x) => !removed.has(x.id)),
    allCleared: result.failedIds.length === 0,
  }
}

/**
 * 取列表:服务端优先,取不到才回落本机快照。
 *
 * 判序是 fail-closed 的,三条都要成立才算「拿到服务端数据」
 * (口径对齐 packages/api-client/src/client.ts fetchApi:5xx 与网络故障抛 HttpError,
 *  4xx / 2xx 但业务 code!==0 返回 success=false,未登录 401 也落在后者):
 *   ① 调用没抛;
 *   ② `success === true`;
 *   ③ `conversations` 真是数组。
 * 任何一条不满足 ⇒ 用 localStorage 快照并把 source 标成 'local',由页面显式喊出
 * 「当前显示本机历史记录」—— 不得把旧数据当新数据静默呈现。
 *
 * 一并回传 serverHasMore:兜底态没有"服务端下一页"这件事,必须是 false。
 */
export async function loadHistoryRows(deps: {
  fetchServer: () => Promise<ApiResult<ListConversationsResult>>
  readLocal: () => HistoryItem[]
}): Promise<{ items: HistoryItem[]; source: HistorySource; serverHasMore: boolean }> {
  let serverItems: HistoryItem[] | null = null
  let serverTotal: unknown
  try {
    const res = await deps.fetchServer()
    if (res.success === true) {
      const rows = res.data.conversations
      if (Array.isArray(rows)) {
        serverItems = (rows as ConversationRow[]).map(mapServerConversation)
        serverTotal = res.data.total
      }
    }
  } catch {
    serverItems = null
  }
  if (serverItems) {
    return {
      items: serverItems,
      source: 'server',
      serverHasMore: serverHasMoreFromPage(serverItems.length, serverTotal),
    }
  }
  return { items: deps.readLocal(), source: 'local', serverHasMore: false }
}

function itemTimestamp(h: HistoryItem): number {
  if (h.timestamp) return h.timestamp
  const parsed = new Date(h.time).getTime()
  return isNaN(parsed) ? Date.now() : parsed
}

/**
 * 分桶用的时间锚点(2026-11-05 对齐 web):timestamp → time 依次回退,两者都不可用 ⇒ null,
 * 由共享层归入「更早」。
 *
 * 旧实现用 `Date.now()` 兜底 ⇒ 没有时间戳的行冒领「今天」,与 web 的「不拿默认值占位」
 * 口径相反。**展示/排序仍走 itemTimestamp**(那里的兜底只影响这一行显示成什么时刻,
 * 不参与分桶,改它会顺带改动既有列表顺序 —— 不在本次语义对齐面内)。
 */
export function itemGroupTime(h: HistoryItem): number | null {
  return resolveConversationTimestamp([h.timestamp, h.time])
}

const fmtTime = (ts: number) => formatDateByTemplate(ts, 'MM-DD HH:mm')

/* ──────────────── D153b 广播覆盖口(账本 → 本页行;不发 HTTP) ──────────────── */

/** useSyncExternalStore 的两个口必须是稳定引用,所以提在模块级而不是每次渲染新建 */
const subscribeConversationMeta = (onStoreChange: () => void): (() => void) =>
  conversationMetaLedger.subscribe(onStoreChange)
const getConversationMetaVersion = (): number => conversationMetaLedger.version()

/**
 * 把账本里的新标题盖到本页行上。
 *
 * 只盖 `title`:本页这一族的行没有 model / 归档列(HistoryItem 的字段面就是这些),
 * 所以"这两档也变了"在小程序界面上结构上无处呈现 —— 正因如此才必须喊
 * `chat.meta.pullOnly`,而不是静默盖一半就当同步完成。
 */
export function overlayBroadcastTitle(item: HistoryItem): HistoryItem {
  const title = conversationMetaLedger.titleFor(item.id, item.title)
  return title === item.title ? item : { ...item, title }
}

export function overlayBroadcastTitles(items: readonly HistoryItem[]): HistoryItem[] {
  return items.map(overlayBroadcastTitle)
}

export default function HistoryPage() {
  const gate = useAuthReadyGate()
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const [list, setList] = useState<HistoryItem[]>([])
  const [source, setSource] = useState<HistorySource>('local')
  const [degraded, setDegraded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // 服务端续页状态:page=1 由 load 取;serverHasMore 由后端 total 判(兜底态恒 false)
  const [serverPage, setServerPage] = useState(1)
  const [serverHasMore, setServerHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  // 服务端「清空全部」在途锁:批量删除进行中不得二次触发(防止并发出两轮删除)
  const [clearingAll, setClearingAll] = useState(false)
  // D153b:广播改过账本 ⇒ 本版本递增 ⇒ 下面的 filtered 重算(列表值就地变,零 HTTP 请求)
  const metaVersion = useSyncExternalStore(subscribeConversationMeta, getConversationMetaVersion)

  const load = useCallback(async () => {
    const result = await loadHistoryRows({
      fetchServer: () => listConversations({ page: 1, pageSize: SERVER_PAGE_SIZE }),
      readLocal: readLocalHistory,
    })
    setList(result.items)
    setSource(result.source)
    setDegraded(result.source === 'local')
    // D153b:只有服务端行才交进账本(本机快照行的 id 形如 hist_<ts>,不是 chat_conversations
    // 主键 ⇒ 广播永远对不上它;记进"已知"只会让 pullOnly 的判定读成"这行归本端显示")
    if (result.source === 'server') {
      conversationMetaLedger.remember(result.items.map((item) => item.id))
    }
    setPage(1)
    setHasMore(true)
    setServerPage(1)
    setServerHasMore(result.serverHasMore)
    setLoading(false)
    // 回传本次结果:下拉刷新要不要报「刷新成功」取决于真拿到的是哪一路数据,
    // 兜底态报成功就是对失败作假交代。
    return result
  }, [])

  useDidShow(() => {
    // G-933 冷启动抢跑门:listConversations → GET /api/chat/conversations
    // (apps/api/src/routes/chat.ts 的 server.get('/conversations') 处理器内
    // await requireAuth(request, reply) + findConversationsByUser 属主过滤)需鉴权;
    // 判定落定前不发,免得首屏先吃一次 401 再落回本机快照兜底态(那是"降级"被读成"数据就这么点")。
    // 落定后未登录仍会走一次 —— 由本页既有的本机快照分支去呈现,不新增文案、不改空态。
    gate.waitUntilReady(() => {
      void load()
    })
  })

  // 筛选芯片由数据派生(D20 残格④):image/voice/agent 三类从无任何写入方
  // (服务端 chat_messages 无类型列,本机快照写入也不设 type),恒空芯片是死 UI ——
  // 只有当前列表真存在该类型时才渲染对应芯片;数据重载后失效的筛选自动回落『全部』。
  const availableTypes = useMemo(() => availableFilterTypes(list), [list])
  const activeFilter: FilterType = resolveActiveFilter(filter, availableTypes)

  const filtered = useMemo(() => {
    // D153b:先用广播账本盖过标题,再走筛选/搜索 —— 搜索也要能命中另一端改成后的新标题,
    // 所以覆盖必须在 filter 之前(放渲染层盖值会让搜索仍按旧词过滤,那是第二种分叉)。
    let arr = overlayBroadcastTitles(list)
    if (activeFilter !== 'all') arr = arr.filter((x) => (x.type || 'chat') === activeFilter)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      arr = arr.filter(
        (x) =>
          x.title.toLowerCase().includes(kw) ||
          (x.messages?.[x.messages.length - 1]?.content || '').toLowerCase().includes(kw),
      )
    }
    // 时间倒序打底 + 置顶优先(唯一排序出口 orderHistoryRows,页面内不再写第二处 sort)
    return orderHistoryRows(arr)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- metaVersion 是「置顶/分组等元数据变更」的失效计数器:排序出口 orderHistoryRows 只吃 arr,不写这个计数就看不到新的置顶态
  }, [list, activeFilter, keyword, metaVersion])

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page])

  /** 降级提示条上的「重试」:重新走一次真实取数(先回到加载态,失败会再次落回降级提示) */
  const retryLoad = useCallback(() => {
    setLoading(true)
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load().then((result) => {
      setRefreshing(false)
      // 兜底态不报「刷新成功」—— 那是对失败的假交代(§5e「失败必须响」同一条禁令),
      // 此时上方的兜底提示条就是可见反馈;服务端拿到才照 HEAD 的原有行为提示成功。
      if (result?.source === 'server') {
        onToast(tt('ai.historyPage.refreshSuccess', '刷新成功'), { kind: 'info' })
      }
    })
  }, [load, tt])

  /**
   * 取服务端下一页并并进列表(D20 第三格:此前一次只取 50、无续页)。
   *
   * 失败判序同取列表(不抛 ∧ success ∧ 数组),任一不成立 ⇒
   * 列表原样(绝不把"没取到"渲染成"就这么多")+ toast 点名 + 收掉 hasMore,
   * 否则一次失败会变成每次上拉都重打同一页的死循环。
   */
  const fetchNextServerPage = useCallback(async () => {
    setLoadingMore(true)
    const nextPage = serverPage + 1
    let items: HistoryItem[] | null = null
    let total: unknown
    try {
      const res = await listConversations({ page: nextPage, pageSize: SERVER_PAGE_SIZE })
      if (res.success === true && Array.isArray(res.data.conversations)) {
        items = (res.data.conversations as ConversationRow[]).map(mapServerConversation)
        total = res.data.total
      }
    } catch {
      items = null
    }
    if (!items) {
      setLoadingMore(false)
      setHasMore(false)
      onToast(tt('ai.historyPage.loadMoreFailed', '加载更多失败,请下拉刷新重试'), { kind: 'error' })
      return
    }
    const merged = mergeHistoryRows(list, items)
    setList(merged)
    setServerPage(nextPage)
    setServerHasMore(serverHasMoreFromPage(merged.length, total))
    setLoadingMore(false)
  }, [list, serverPage, tt])

  const onLoadMore = useCallback(() => {
    const action = decideLoadMore({
      hasMore,
      loadingMore,
      source,
      serverHasMore,
      shownCount: page * PAGE_SIZE,
      filteredCount: filtered.length,
    })
    if (action === 'advance-page') setPage((p) => p + 1)
    else if (action === 'fetch-server') void fetchNextServerPage()
    else if (action === 'finish') setHasMore(false)
  }, [hasMore, loadingMore, source, serverHasMore, page, filtered.length, fetchNextServerPage])

  const goChat = useCallback((h?: HistoryItem) => {
    Taro.navigateTo({ url: `/pkg-ai/ai/chat${h ? `?sessionId=${h.id}` : ''}` })
  }, [])

  /** 打开会话导入页;导入成功后新会话落在本页列表里,故返回时由 useDidShow 重新拉取 */
  const goConversationImport = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-ai/ai/conversation-import' })
  }, [])

  /**
   * 置顶/取消置顶(D20 端内接线,与 mobile-rn MessageCenterScreen 同形):
   * 网络出口唯一 = @ihui/api-client setConversationPinned;重排唯一 = 共享 togglePinnedItem
   * (内部复用 conversation-org 的 sortPinnedFirst)。
   * 失败必须响:列表原样 + toast 点名原因,不得静默。
   * 兜底态(source='local')直接不开这个口子 —— 本机快照 id 不是会话主键,发了必失败。
   */
  const onTogglePin = useCallback(
    async (h: HistoryItem) => {
      if (source !== 'server') return
      const next = h.pinned !== true
      const outcome = await togglePinnedItem(list, h.id, next, setConversationPinned)
      if (outcome.ok) {
        setList(outcome.items)
      } else {
        onToast(
          next
            ? tt('ai.historyPage.pinFailed', '置顶失败,请重试')
            : tt('ai.historyPage.unpinFailed', '取消置顶失败,请重试'),
          { kind: 'error' },
        )
      }
    },
    [list, source, tt],
  )

  // 「清空全部」在两个来源下各有出口(D20 留尾:此前服务端源没有清空能力):
  // 兜底态只写本机快照(setStorageSync);服务端源逐条走 api-client deleteConversation
  // (有界并发 + 进度反馈,不新增端点)。入口按 source 分发,两路互不越界。
  const onDeleteOne = useCallback(
    (h: HistoryItem) => {
      Taro.showModal({
        title: tt('ai.historyPage.deleteOne', '删除该对话'),
        content: h.title || h.id,
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (!res.confirm) return
          setList((prev) => {
            const next = prev.filter((x) => x.id !== h.id)
            Taro.setStorageSync(HISTORY_KEY, next)
            return next
          })
          onToast(t('success.deleted'), { kind: 'info' })
        },
      })
    },
    [t, tt],
  )

  /**
   * 删除一个**服务端**会话(D20 第二格:此前服务端来源下根本没有删除入口)。
   *
   * 乐观移除 + 失败回滚:先按快照摘掉这一行,删除请求没被后端确认(deleted!==true)
   * 就把整表还原并 toast 点名 —— 两个方向都不留"看着删了其实没删"的中间态。
   * 刻意不写本机快照:服务端会话 id 与快照的 hist_* 不是一回事,顺手写快照等于
   * 把一条并不存在的本机记录删了个空。
   */
  const onDeleteServerConversation = useCallback(
    (h: HistoryItem) => {
      Taro.showModal({
        title: tt('ai.historyPage.deleteOne', '删除该对话'),
        content: h.title || h.id,
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (!res.confirm) return
          const snapshot = list
          setList(snapshot.filter((x) => x.id !== h.id))
          void deleteServerConversation({ remove: () => deleteConversation(h.id) }).then(
            (outcome) => {
              if (outcome.ok) {
                onToast(t('success.deleted'), { kind: 'info' })
                return
              }
              setList(snapshot)
              onToast(tt('ai.historyPage.deleteFailed', '删除失败,请重试'), { kind: 'error' })
            },
          )
        },
      })
    },
    [list, t, tt],
  )

  const onClearAll = useCallback(() => {
    if (list.length === 0) return
    Taro.showModal({
      title: tt('ai.historyPage.clearAll', '清空全部'),
      content: tt('ai.historyPage.clearConfirm', '确定要清空全部对话历史吗?'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return
        Taro.setStorageSync(HISTORY_KEY, [])
        setList([])
        onToast(tt('ai.historyPage.cleared', '已清空'), { kind: 'info' })
      },
    })
  }, [list.length, t, tt])

  /**
   * 服务端源「清空全部」(D20 留尾:此前服务端来源下没有清空能力)。
   *
   * 确认语义如实:服务端可能有未加载完的更多页(serverHasMore),这个动作只删
   * **当前已加载**的 N 条、不翻页续删 —— 确认框写明条数与"不可恢复",
   * 不把"已加载"谎报成"全部"。
   * 执行:逐条走 deleteConversation(唯一出口,复用 deleteServerConversation 判序),
   * 3 路有界并发,showLoading 按 (done/total) 刷新进度。
   * 结果诚实:全成 ⇒ 清列表;有失败 ⇒ 失败行原样保留(长按行可单条重试),
   * toast 点名成功/失败条数。本机快照一律不写(服务端会话 id ≠ 快照的 hist_*)。
   */
  const onClearServerAll = useCallback(async () => {
    if (source !== 'server' || clearingAll) return
    const snapshot = list
    const total = snapshot.length
    if (total === 0) return
    const confirmed = await new Promise<boolean>((resolve) => {
      Taro.showModal({
        title: tt('ai.historyPage.clearAll', '清空全部'),
        content: t('ai.historyPage.clearServerConfirm', { n: total }),
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => resolve(res.confirm === true),
        fail: () => resolve(false),
      })
    })
    if (!confirmed) return
    setClearingAll(true)
    Taro.showLoading({ title: t('ai.historyPage.clearServerProgress', { done: 0, n: total }) })
    const result = await clearServerConversations({
      ids: snapshot.map((x) => x.id),
      remove: (id) => deleteConversation(id),
      onProgress: (done) => {
        Taro.showLoading({ title: t('ai.historyPage.clearServerProgress', { done, n: total }) })
      },
    })
    Taro.hideLoading()
    setClearingAll(false)
    if (result.failedIds.length === 0) {
      // 全成:清列表并把翻页游标归零。若服务端还有未加载的更多页,下拉刷新会如实取回,
      // 这里不主动续取 —— 用户确认删的就是"当前已加载的 N 条"。
      setList([])
      setPage(1)
      setServerPage(1)
      setServerHasMore(false)
      onToast(t('ai.historyPage.clearServerDone', { n: total }), { kind: 'info' })
      return
    }
    // 有失败:失败行原样保留(长按可单条重试),toast 点名 X/Y,不谎报清空。
    // 函数式更新基于当前列表摘掉成功行,中途被刷新改写过的列表也不会被旧快照整表盖回。
    setList((prev) => applyServerClearResult(prev, result).items)
    Taro.showModal({
      title: t('common.hint'),
      content: t('ai.historyPage.clearServerPartial', {
        ok: result.okIds.length,
        fail: result.failedIds.length,
      }),
      showCancel: false,
      confirmText: t('common.confirm'),
    })
  }, [source, clearingAll, list, t, tt])

  const isFiltered = Boolean(keyword.trim() || filter !== 'all')
  const iconFor = (h: HistoryItem) =>
    FILTERS(tt).find((f) => f.key === (h.type || 'chat'))?.icon || ICONS.message

  /** 共享屏要的展示行:时间/条数/图标换展示值;排序与取词仍在共享屏 */
  const groups = useMemo(
    () =>
      groupConversationByDate(visible, itemGroupTime).map((g) => {
        const label = GROUP_LABELS(tt)[g.key]
        return {
          key: g.key,
          label: tt(label.labelKey, label.fallback),
          items: g.items.map((h) => ({
            id: h.id,
            title: h.title,
            preview: h.messages?.[h.messages.length - 1]?.content,
            timeLabel: fmtTime(itemTimestamp(h)),
            messageCount: h.messageCount || h.messages?.length || 0,
            iconSrc: iconFor(h),
            pinned: h.pinned === true,
          })),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- iconFor/FILTERS 只依赖 tt,与 visible 同步
    [visible, tt],
  )

  const filters = useMemo(
    () =>
      FILTERS(tt)
        .filter((f) => availableTypes.has(f.key))
        .map((f) => ({ key: f.key, label: tt(f.labelKey, f.fallback), iconSrc: f.icon })),
    [tt, availableTypes],
  )

  const findRow = (row: { id: string }) => list.find((x) => x.id === row.id)

  return (
    <SharedConversationHistoryScreen
      t={t}
      tt={tt}
      groups={groups}
      itemCount={filtered.length}
      loading={loading}
      isFiltered={isFiltered}
      keyword={keyword}
      onKeywordChange={(v) => {
        setKeyword(v)
        setPage(1)
        setHasMore(true)
      }}
      filters={filters}
      activeFilter={activeFilter}
      onFilterChange={(key) => {
        setFilter(key as FilterType)
        setPage(1)
        setHasMore(true)
      }}
      showClearAll={list.length > 0}
      // 入口按 source 分发(服务端逐条删 / 兜底只写快照),两路互不越界
      onClearAll={source === 'server' ? () => void onClearServerAll() : onClearAll}
      onImport={goConversationImport}
      degraded={degraded}
      onRetry={retryLoad}
      canPin={source === 'server'}
      onOpen={(row) => goChat(findRow(row))}
      onTogglePin={(row) => {
        const h = findRow(row)
        if (h) void onTogglePin(h)
      }}
      onLongPress={(row) => {
        const h = findRow(row)
        if (!h) return
        if (source === 'server') void onDeleteServerConversation(h)
        else onDeleteOne(h)
      }}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onStartNew={() => goChat()}
      emptyIconSrc={isFiltered ? ICONS.search : ICONS.message}
      colorScheme="light"
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
