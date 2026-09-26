// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, type TtFn } from '@/i18n'
import { View, Text, Button, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { formatDateByTemplate } from '@ihui/shared'
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
import { sortPinnedFirst } from '@ihui/shared/chat/conversation-org'
import type { ApiResult } from '@ihui/types'
import { REMOTE_ICONS } from '@/constants/remote-icons'
import ThemeRoot from '@/components/ThemeRoot'
import SearchBar from '@/components/SearchBar'
import ConversationHistoryItem from '@/components/ConversationHistoryItem'

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
type GroupKey = 'today' | 'yesterday' | 'thisWeek' | 'earlier'
/** 列表当前的数据来源:server=服务端会话(可置顶);local=本机快照(兜底,不可置顶) */
export type HistorySource = 'server' | 'local'

interface HistoryItem {
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
export function availableFilterTypes(
  items: ReadonlyArray<{ type?: FilterType }>,
): Set<FilterType> {
  const s = new Set<FilterType>(['all', 'chat'])
  for (const x of Array.isArray(items) ? items : []) s.add(x.type || 'chat')
  return s
}

/** 数据重载后当前筛选可能失效(该类型已不存在)⇒ 回落『全部』,不渲染空列表 */
export function resolveActiveFilter(filter: FilterType, available: Set<FilterType>): FilterType {
  return available.has(filter) ? filter : 'all'
}

const GROUP_LABELS = (tt: TtFn): Array<{ key: GroupKey; labelKey: string; fallback: string }> => [
  { key: 'today', labelKey: 'live.calendar.today', fallback: tt('live.calendar.today', '今天') },
  {
    key: 'yesterday',
    labelKey: 'index.mock.yesterday',
    fallback: tt('index.mock.yesterday', '昨天'),
  },
  { key: 'thisWeek', labelKey: 'aiHistory.d3', fallback: tt('aiHistory.d3', '本周') },
  { key: 'earlier', labelKey: 'aiHistory.d4', fallback: tt('aiHistory.d4', '更早') },
]

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

function getGroupKey(ts: number): GroupKey {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const day = 86400000
  if (ts >= today) return 'today'
  if (ts >= today - day) return 'yesterday'
  if (ts >= today - day * 7) return 'thisWeek'
  return 'earlier'
}

function itemTimestamp(h: HistoryItem): number {
  if (h.timestamp) return h.timestamp
  const parsed = new Date(h.time).getTime()
  return isNaN(parsed) ? Date.now() : parsed
}

/**
 * 派生顺序:时间倒序打底,再走共享 sortPinnedFirst 做置顶优先稳定重排。
 *
 * 页面不再自己写「pinned 在前」的比较器 —— 置顶排序的出口全仓只有
 * packages/shared/src/chat/conversation-org.ts 一份(AGENTS §3 共享层优先)。
 * 本机快照行 pinned 恒为 undefined ⇒ 这一趟对兜底态是无操作,不改原顺序。
 */
export function orderHistoryRows(items: readonly HistoryItem[]): HistoryItem[] {
  return sortPinnedFirst([...items].sort((a, b) => itemTimestamp(b) - itemTimestamp(a)))
}

const fmtTime = (ts: number) => formatDateByTemplate(ts, 'MM-DD HH:mm')

export default function HistoryPage() {
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

  const load = useCallback(async () => {
    const result = await loadHistoryRows({
      fetchServer: () => listConversations({ page: 1, pageSize: SERVER_PAGE_SIZE }),
      readLocal: readLocalHistory,
    })
    setList(result.items)
    setSource(result.source)
    setDegraded(result.source === 'local')
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
    void load()
  })

  // 筛选芯片由数据派生(D20 残格④):image/voice/agent 三类从无任何写入方
  // (服务端 chat_messages 无类型列,本机快照写入也不设 type),恒空芯片是死 UI ——
  // 只有当前列表真存在该类型时才渲染对应芯片;数据重载后失效的筛选自动回落『全部』。
  const availableTypes = useMemo(() => availableFilterTypes(list), [list])
  const activeFilter: FilterType = resolveActiveFilter(filter, availableTypes)

  const filtered = useMemo(() => {
    let arr = list
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
  }, [list, activeFilter, keyword])

  const visible = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page])

  const groups = useMemo(() => {
    const m: Record<GroupKey, HistoryItem[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      earlier: [],
    }
    visible.forEach((item) => {
      m[getGroupKey(itemTimestamp(item))].push(item)
    })
    return m
  }, [visible])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load().then((result) => {
      setRefreshing(false)
      // 兜底态不报「刷新成功」—— 那是对失败的假交代(§5e「失败必须响」同一条禁令),
      // 此时上方的兜底提示条就是可见反馈;服务端拿到才照 HEAD 的原有行为提示成功。
      if (result?.source === 'server') {
        Taro.showToast({
          title: tt('ai.historyPage.refreshSuccess', '刷新成功'),
          icon: 'none',
        })
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
      Taro.showToast({
        title: tt('ai.historyPage.loadMoreFailed', '加载更多失败,请下拉刷新重试'),
        icon: 'none',
      })
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
  }, [
    hasMore,
    loadingMore,
    source,
    serverHasMore,
    page,
    filtered.length,
    fetchNextServerPage,
  ])

  const goChat = useCallback((h?: HistoryItem) => {
    Taro.navigateTo({ url: `/pkg-ai/ai/chat${h ? `?sessionId=${h.id}` : ''}` })
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
        Taro.showToast({
          title: next
            ? tt('ai.historyPage.pinFailed', '置顶失败,请重试')
            : tt('ai.historyPage.unpinFailed', '取消置顶失败,请重试'),
          icon: 'none',
        })
      }
    },
    [list, source, tt],
  )

  // 「清空全部」只写本机快照 ⇒ 仅兜底态给这个动作;行级删除在两个来源下各有出口
  // (本机快照走 setStorageSync,服务端会话走 api-client deleteConversation)。
  const canManageLocal = source === 'local'

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
          Taro.showToast({ title: t('success.deleted'), icon: 'none' })
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
                Taro.showToast({ title: t('success.deleted'), icon: 'none' })
                return
              }
              setList(snapshot)
              Taro.showToast({
                title: tt('ai.historyPage.deleteFailed', '删除失败,请重试'),
                icon: 'none',
              })
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
        Taro.showToast({ title: tt('ai.historyPage.cleared', '已清空'), icon: 'none' })
      },
    })
  }, [list.length, t, tt])

  const isFiltered = keyword.trim() || filter !== 'all'
  const iconFor = (h: HistoryItem) =>
    FILTERS(tt).find((f) => f.key === (h.type || 'chat'))?.icon || ICONS.message

  return (
    <View className="flex flex-col h-screen bg-background">
      <View className="flex items-center gap-[16rpx] pt-[120rpx] px-[32rpx] pb-[16rpx] bg-card">
        {/* 搜索栏(统一圆角输入井,共享 SearchBar) */}
        <SearchBar
          className="flex-1"
          value={keyword}
          placeholder={tt('ai.historyPage.searchPlaceholder', '搜索对话历史')}
          onInput={(v) => {
            setKeyword(v)
            setPage(1)
            setHasMore(true)
          }}
          onClear={() => setKeyword('')}
        />
        {canManageLocal && list.length > 0 ? (
          <Text className="text-[length:26rpx] text-destructive flex-shrink-0" onClick={onClearAll}>
            {tt('ai.historyPage.clearAll', '清空全部')}
          </Text>
        ) : null}
      </View>

      {/* 兜底提示:服务端没取到才出现。可见、不谎报,给「重试」出口 */}
      {degraded && !loading ? (
        <View className="flex items-center justify-between gap-[16rpx] px-[32rpx] py-[16rpx] bg-card">
          <Text className="flex-1 text-[length:24rpx] text-muted-foreground">
            {tt('ai.historyPage.fallbackNotice', '服务端会话加载失败,当前显示本机历史记录')}
          </Text>
          {/* 重试:命中块用 View(hoverClass 只在 View 上受支持),文案用 Text */}
          <View
            className="flex items-center flex-shrink-0 py-[8rpx] px-[16rpx] rounded-sm bg-background"
            onClick={onRefresh}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:24rpx] text-foreground font-semibold">
              {tt('common.retry', '重试')}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="flex gap-[12rpx] py-[16rpx] px-[32rpx] bg-card overflow-x-auto whitespace-nowrap">
        {FILTERS(tt)
          .filter((f) => availableTypes.has(f.key))
          .map((f) => (
            <View
              key={f.key}
              className={`inline-flex items-center gap-[6rpx] py-[8rpx] px-[24rpx] bg-background rounded-sm flex-shrink-0 ${activeFilter === f.key ? 'bg-primary text-foreground' : 'text-muted-foreground'}`}
            onClick={() => {
              setFilter(f.key)
              setPage(1)
              setHasMore(true)
            }}
            hoverClass="opacity-60"
          >
            <Image src={f.icon} className="w-[28rpx] h-[28rpx]" mode="aspectFit" />
            <Text className="text-[length:24rpx]">{tt(f.labelKey, f.fallback)}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        className="flex-1 h-0"
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={onRefresh}
        onScrollToLower={onLoadMore}
        lowerThreshold={80}
      >
        {loading ? (
          <View className="flex items-center justify-center py-[160rpx]">
            <Text className="text-[length:28rpx] text-muted-foreground">
              {tt('common.loading', '加载中')}
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View className="flex flex-col items-center justify-center py-[160rpx] px-[32rpx]">
            <Image
              src={isFiltered ? ICONS.search : ICONS.message}
              className="w-[120rpx] h-[120rpx]"
              mode="aspectFit"
            />
            <Text className="text-[length:28rpx] text-muted-foreground mt-[24rpx]">
              {isFiltered
                ? tt('ai.historyPage.noResult', '未找到相关对话')
                : t('ai.historyPage.empty')}
            </Text>
            {!isFiltered ? (
              <Button
                className="mt-[40rpx] px-[64rpx] h-[100rpx] leading-[100rpx] bg-primary text-[var(--color-surface-light)] rounded-xl text-[length:32rpx] font-semibold"
                onClick={() => goChat()}
              >
                {tt('ai.historyPage.startNew', '开始新对话')}
              </Button>
            ) : null}
          </View>
        ) : (
          <View className="py-[24rpx] px-[32rpx]">
            {GROUP_LABELS(tt).map((g) => {
              const items = groups[g.key]
              if (!items || items.length === 0) return null
              return (
                <View key={g.key} className="mb-[32rpx]">
                  <Text className="block text-[length:24rpx] text-muted-foreground mb-[16rpx] pl-[8rpx]">
                    {tt(g.labelKey, g.fallback)}
                  </Text>
                  {items.map((h) => {
                    const ts = itemTimestamp(h)
                    const count = h.messageCount || h.messages?.length || 0
                    const preview = h.messages?.[h.messages.length - 1]?.content
                    return (
                      <ThemeRoot
                        key={h.id}
                        className="flex items-center p-[24rpx] mb-[16rpx] bg-card rounded-lg"
                      >
                        <ConversationHistoryItem
                          id={h.id}
                          title={h.title}
                          preview={preview}
                          time={fmtTime(ts)}
                          countLabel={t('ai.historyPage.msgCount', { n: count })}
                          iconSrc={iconFor(h)}
                          canPin={source === 'server'}
                          pinned={h.pinned === true}
                          pinLabel={tt('ai.historyPage.pin', '置顶')}
                          pinnedLabel={tt('ai.historyPage.pinned', '已置顶')}
                          onOpen={() => goChat(h)}
                          onTogglePin={() => void onTogglePin(h)}
                          onLongPress={
                            source === 'server'
                              ? () => void onDeleteServerConversation(h)
                              : () => onDeleteOne(h)
                          }
                        />
                      </ThemeRoot>
                    )
                  })}
                </View>
              )
            })}
            {loadingMore ? (
              // 「加载更多」必须看得见在取,否则用户以为到底了 —— 复用既有 common.loading 档
              <Text className="block text-center p-[32rpx] text-[length:24rpx] text-muted-foreground">
                {tt('common.loading', '加载中')}
              </Text>
            ) : null}
            {!hasMore ? (
              <Text className="block text-center p-[32rpx] text-[length:24rpx] text-muted-foreground">
                {tt('ai.historyPage.noMore', '没有更多了')}
              </Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
