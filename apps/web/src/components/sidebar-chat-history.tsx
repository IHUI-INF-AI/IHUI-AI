// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import {
  Loader2,
  Trash2,
  MessageCirclePlus,
  MoreVertical,
  Download,
  Archive,
  ArchiveRestore,
  Pencil,
  FileText,
  FileCode,
  FileJson,
  FileDown,
  Camera,
  Image as ImageIcon,
  Link2,
  LogIn,
  ListFilter,
  FolderOpen,
  Tags,
  Pin,
  PinOff,
  // D187:侧栏「标记为未读」菜单图标(信封=未读语义)
  Mail,
  // D189:侧栏排序切换器图标
  ArrowUpDown,
  // V3 #62:侧栏会话搜索开关图标(放大镜=收起态,X=激活态,点击收起并清空)
  Search,
  X,
  // V3 #62:侧栏批量选择开关(多选态)
  ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { downloadText, slugifyForFilename, buildTimestamp } from '@/lib/download'
import {
  archiveConversation,
  unarchiveConversation,
  exportConversation,
  compressConversation,
  setConversationPinned,
  // V3 #62:侧栏批量动作走 api-client 唯一出口(§3 禁止端内裸 fetch 调后端)
  batchOperateConversations,
  type BatchConversationAction,
} from '@ihui/api-client'
import {
  filterByFolder,
  getOrgMeta,
  listFolderNames,
  sortPinnedFirst,
  type ConversationOrgMap,
} from '@ihui/shared'
import { useChatStore } from '@/stores/chat'
import { useConversationOrgMap, useConversationOrgStore } from '@/stores/conversation-org'
// D187:侧栏「标记为未读」客户端标记 store(localStorage 按 userId 分桶,打开即清)
import {
  useConversationUnreadMarks,
  useConversationUnreadMarkStore,
} from '@/stores/conversation-unread-mark'
import {
  ConversationOrgDialog,
  type ConversationOrgSubmitValue,
} from '@/components/chat/conversation-org-dialog'
import {
  ConversationAttentionBadges,
  type ConversationAttentionById,
} from '@/components/chat/conversation-list'
import { isWaitingForConversation, resolveConversationAttention } from '@/hooks/use-sidebar'
import {
  downloadConversationJson,
  downloadConversationSnapshot,
  downloadConversationShareCard,
  copyConversationShareLink,
  printConversationPdf,
  type ExportRoleLabel,
} from '@/components/chat/conversation-export'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useAuthStore } from '@/stores/auth'
import { useAuthBootstrap } from '@/hooks/use-auth-bootstrap'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
// D187:标记未读圆点悬停提示(§4 禁原生提示窗,与 conversation-list 未读徽章同款)
import { Tooltip } from '@/components/feedback'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Button,
  // D191:重命名对话框 helper 描述行(对齐 Dialog a11y 语义,关联 title)
  DialogDescription,
  // V3 #62:侧栏搜索框复用全项目统一搜索井(/chat/history 页同款)
  SearchInput,
  // V3 #62:批量选择复选框(与 /chat/history 同一控件)
  Checkbox,
} from '@ihui/ui-react'
// V3 #62:侧栏批量选择的选中集唯一持有者 + 动作条(动作条不持有选中集,只读 props)
import { useConversationSelection } from '@/components/sidebar/use-conversation-selection'
import { ConversationBatchBar } from '@/components/sidebar/conversation-batch-bar'
// D186:归档「不再提示」偏好(勾选后持久化到 localStorage,后续归档跳过二次确认)
import { useArchivePrefsStore } from '@/stores/archive-prefs'

interface ConversationItem {
  id: string
  title: string
  model: string
  lastMessageAt: string
  messageCount: number
  archivedAt?: string | null
  /** 2026-08-30 立:会话置顶标记(后端已排序置顶优先;侧栏展示 + 菜单切换) */
  pinned?: boolean
  /** D53 会话注意力态(G-64):该行未读更新数(>0 显示未读徽章);后端暂无字段时由 attentionById 覆盖 */
  unreadCount?: number
  /** D53:该行显式等待态(备用通道,主链路走 attentionById + pendingQuestion 联动) */
  hasPendingQuestion?: boolean
}

interface ConversationsResponse {
  conversations: ConversationItem[]
  total: number
  page: number
  pageSize: number
}

async function fetchConversations(page = 1): Promise<ConversationsResponse> {
  const res = await fetchApi<ConversationsResponse>(`/api/chat/conversations?page=${page}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

type GroupKey = 'today' | 'thisWeek' | 'thisMonth'

function groupByDate(items: ConversationItem[]): { key: GroupKey; items: ConversationItem[] }[] {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const DAY = 24 * 60 * 60 * 1000
  const startOfWeek = startOfToday - 7 * DAY

  const buckets: Record<GroupKey, ConversationItem[]> = {
    today: [],
    thisWeek: [],
    thisMonth: [],
  }
  for (const item of items) {
    const t = item.lastMessageAt ? new Date(item.lastMessageAt).getTime() : 0
    if (t >= startOfToday) buckets.today.push(item)
    else if (t >= startOfWeek) buckets.thisWeek.push(item)
    else buckets.thisMonth.push(item)
  }
  return (Object.keys(buckets) as GroupKey[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, items: buckets[k] }))
}

/** V3 #62:可搜索会话的最小结构(仅声明搜索所需字段,便于纯函数单测与泛型复用) */
export interface SearchableConversation {
  id: string
  title: string
}

/**
 * V3 #62:侧栏会话关键词过滤(纯函数,导出供单测)。
 * 匹配面以侧栏真实数据结构为准:会话标题 + 文件夹名 + 标签名(D20 客户端元数据 orgMap)。
 * 检索面为本地过滤,无后端接口 —— 与 /chat/history 页已验证的
 * `title.toLowerCase().includes(keyword)` 模式同款,并按侧栏元数据自然扩展两个匹配面。
 * 关键词为空白时返回原列表的浅拷贝(不返回原引用,保证 React 渲染语义稳定)。
 */
export function filterConversationsByKeyword<T extends SearchableConversation>(
  items: readonly T[],
  keyword: string,
  orgMap?: ConversationOrgMap | null,
): T[] {
  const q = keyword.trim().toLowerCase()
  if (!q) return [...items]
  return items.filter((item) => {
    if (item.title?.toLowerCase().includes(q)) return true
    const meta = orgMap ? getOrgMeta(orgMap, item.id) : undefined
    if (meta?.folder?.toLowerCase().includes(q)) return true
    if (meta?.tags?.some((tag) => tag.toLowerCase().includes(q))) return true
    return false
  })
}

/**
 * 侧边栏内嵌的任务列表卡片(对齐旧架构 SidebarChatHistory.vue 视觉设计)。
 * - 卡片容器:border + rounded-md + bg-card,宽度与上方"新建任务"按钮一致(w-full,无 mx-2)
 * - 列表 max-h-220px 滚动
 * - hover/active 用 ::before 伪元素 inset-x-2 实现悬浮胶囊效果
 * - active 左侧 2px 高亮条
 * - 操作按钮:MoreVertical 三点菜单 + DropdownMenu(重命名 / 归档 / 导出 / 压缩 / 删除)
 * - 删除确认:用 ConfirmDialog,删除成功/失败用 sonner toast 反馈
 * - 重命名:用 Dialog + Input
 * - 按时间分组:今天 / 本周(7天内)/ 本月(30天内)
 * - 空状态:图标 + 文案 + "新建任务"引导按钮
 * - 折叠态完全不渲染(避免无文字宽度)
 */
export function SidebarChatHistory({
  collapsed,
  attentionById,
}: {
  collapsed: boolean
  /** D53 注意力覆盖表(可选,派生输入,不碰 store) */
  attentionById?: ConversationAttentionById
}) {
  const t = useTranslations('chatHistory')
  const tc = useTranslations('aiChat')
  // D188:运行中徽标文案复用 shared taskStatus.activityRunning(既有词汇,不新建键)
  const tTask = useTranslations('taskStatus')
  const te = useTranslations('chat.exportMenu')
  // V3 #62:复用 chatSearchBar.searchAriaLabel(旧孤儿件 ChatSearchBar 仍在库内未接线,
  // D149 三分法处置=保留;该文件删除前本键在此与它双消费,此处不是唯一消费者)
  const t2 = useTranslations('chatSearchBar')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  // 2026-09-02 ready 来源补充:bootstrap 未就绪时 isAuthenticated 可能是 localStorage
  // 残留的 true,需等 ready 后再按真实登录态渲染(与 LoginDialog/PageClient 同模式)。
  const { ready } = useAuthBootstrap()
  const currentConversationId = useChatStore((s) => s.conversationId)
  // D53 联动(store 只读):挂起的提问归属当前会话 → 当前行自动进入等待态
  const pendingQuestion = useChatStore((s) => s.pendingQuestion)
  // D188:运行中徽标(单流架构,仅当前会话可能处于流式运行态)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const openPanel = useAiPanelStore((s) => s.openPanel)

  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  const [pendingRenameId, setPendingRenameId] = React.useState<string | null>(null)
  const [renameValue, setRenameValue] = React.useState<string>('')
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const renameInputRef = React.useRef<HTMLInputElement>(null)
  const isNavigatingRef = React.useRef(false)

  // D20 会话组织(G-11):文件夹/标签客户端元数据 store(v1,localStorage 按 userId 分桶)
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const orgMap = useConversationOrgMap(userId)
  const setOrgFolder = useConversationOrgStore((s) => s.setFolder)
  const setOrgTags = useConversationOrgStore((s) => s.setTags)
  const orgFolders = React.useMemo(() => listFolderNames(orgMap), [orgMap])
  // D187:当前用户的「标记为未读」集合(只读快照;动作经 store 单独取,引用稳定)
  const unreadMarks = useConversationUnreadMarks(userId)
  const markUnread = useConversationUnreadMarkStore((s) => s.markUnread)
  const clearUnreadMark = useConversationUnreadMarkStore((s) => s.clearMark)
  /** 文件夹筛选:undefined=全部,null=未分组,字符串=指定文件夹 */
  const [folderFilter, setFolderFilter] = React.useState<string | null | undefined>(undefined)
  // D189:排序方式(pinnedFirst=置顶优先=既有默认行为;byTime=后端返回序=按时间)
  const [sortMode, setSortMode] = React.useState<'pinnedFirst' | 'byTime'>('pinnedFirst')
  const [pendingOrgItem, setPendingOrgItem] = React.useState<ConversationItem | null>(null)

  // V3 #62:侧栏会话搜索(收起态=放大镜按钮,展开态=SearchInput;纯本地过滤,无后端接口)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  // 展开时自动聚焦(对齐旧孤儿件 ChatSearchBar 的 show→focus 交互;该文件仍在库内
  // 未接线、D149 处置保留 —— 此前注释误称"已删除",按磁盘现状更正)
  React.useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])
  /** 收起搜索:必须同步清空关键词,否则隐藏的输入框会残留旧过滤条件导致列表"消失" */
  const closeSearch = React.useCallback(() => {
    setSearchOpen(false)
    setSearchQuery('')
  }, [])

  React.useEffect(() => {
    if (pendingRenameId) {
      const id = requestAnimationFrame(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      })
      return () => cancelAnimationFrame(id)
    }
  }, [pendingRenameId])

  const {
    data,
    isLoading,
    error: queryError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['chat', 'conversations', 'infinite'],
    queryFn: ({ pageParam = 1 }) => fetchConversations(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const totalPages = Math.ceil(last.total / last.pageSize)
      return last.page < totalPages ? last.page + 1 : undefined
    },
    enabled: isAuthenticated && !collapsed,
    staleTime: 30 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchApi(`/api/chat/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error)
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      success(tc('deleteSuccess'))
      setPendingDeleteId(null)
    },
    onError: (err: Error) => {
      error(err.message || tc('deleteFailed'))
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await archiveConversation(id)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await unarchiveConversation(id)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })

  // D20 置顶/取消置顶(G-11;后端 2026-08-30 已支持 pinned 排序,侧栏补齐入口)
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      setConversationPinned(id, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
    onError: () => error(tc('toast.pinFailed')),
  })

  const exportMutation = useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'txt' | 'md' }) =>
      exportConversation(id, format),
  })

  const compressMutation = useMutation({
    mutationFn: async ({ id, targetChars }: { id: string; targetChars: 200000 | 1000000 }) => {
      const res = await compressConversation(id, targetChars)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
  })

  const renameMutation = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const res = await fetchApi<{ conversation: ConversationItem }>(
        `/api/chat/conversations/${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify({ title }) },
      )
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
    },
  })

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  // V3 #62:搜索/筛选管道必须提到条件早退之前算完 —— useConversationSelection 是
  // hook,摆在 `if (collapsed) return null` / 未登录 return 之后就违反 Rules of Hooks
  // (折叠与展开两条路径的 hook 数量不同)。管道本身与移动前逐字同形,只是换了位置。
  const rawItems = React.useMemo(
    // items: flatten 所有已加载页的 conversations(infinite scroll 累积)
    () => data?.pages.flatMap((p) => p.conversations) ?? [],
    [data],
  )
  // D20(G-11) + V3 #62 + D189:管道 = 文件夹筛选 → 关键词过滤(标题/文件夹名/标签名)
  // → 排序(D189 切换器:置顶优先=既有稳定排序;按时间=保持后端返回序,不再重排)
  const items = React.useMemo(() => {
    const filtered = filterConversationsByKeyword(
      filterByFolder(rawItems, orgMap, folderFilter),
      searchQuery,
      orgMap,
    )
    return sortMode === 'pinnedFirst' ? sortPinnedFirst(filtered) : filtered
  }, [rawItems, orgMap, folderFilter, searchQuery, sortMode])
  /** 当前**可见**会话 id:全选/反选的取值面(不得拿未筛的全量 rawItems,否则会勾上用户看不见的项) */
  const visibleIds = React.useMemo(() => items.map((item) => item.id), [items])
  // V3 #62:选中集的唯一持有者。行内复选框与批量动作条都只读这一份,不分叉。
  const selection = useConversationSelection(visibleIds)
  const [batchBusy, setBatchBusy] = React.useState(false)
  // D186:批量在飞动作(批量归档在途时动作条按钮文案切「正在归档任务...」)
  const [lastBatchAction, setLastBatchAction] = React.useState<BatchConversationAction | null>(null)
  // D186:归档二次确认(打开中的待归档会话 + 确认钮在途态 + 不再提示勾选)
  const [pendingArchive, setPendingArchive] = React.useState<ConversationItem | null>(null)
  const [archiveConfirmPending, setArchiveConfirmPending] = React.useState(false)
  const [archiveNoAsk, setArchiveNoAsk] = React.useState(false)

  // V3 #62:批量动作(删除/归档/取消归档)。走 api-client 唯一出口;
  // !success 必须 throw —— 否则后端 400(如单次 >100 项)会被当成成功、界面无反馈。
  const batchMutation = useMutation({
    mutationFn: async ({ action, ids }: { action: BatchConversationAction; ids: string[] }) => {
      const res = await batchOperateConversations(action, ids)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      const msgMap: Record<BatchConversationAction, string> = {
        delete: t('batchDeleteSuccess'),
        archive: t('batchArchiveSuccess'),
        unarchive: t('batchUnarchiveSuccess'),
        favorite: t('batchFavoriteSuccess'),
        unfavorite: t('batchUnfavoriteSuccess'),
      }
      success(msgMap[action])
      // 删除成功后显式清空:可见集裁剪已让残留不可见,但选中态本身不该继续挂着
      if (action === 'delete') selection.clear()
    },
    onError: (err: Error) => error(err.message || tc('deleteFailed')),
  })

  const runBatch = (action: BatchConversationAction) => {
    const ids = [...selection.orderedSelectedIds]
    if (ids.length === 0) return
    setBatchBusy(true)
    setLastBatchAction(action)
    batchMutation.mutate({ action, ids }, { onSettled: () => setBatchBusy(false) })
  }

  if (collapsed) return null

  // 2026-09-02 修复:bootstrap 未就绪时,即使 localStorage 残留 isAuthenticated=true,
  // token 仍为 null,直接渲染对话列表会导致 401 或空状态闪现。
  // 等待 ready 后再按真实登录态渲染。
  if (!ready || !isAuthenticated) {
    return (
      <div
        role="region"
        aria-label={t('title')}
        className="mb-1 w-full rounded-lg border border-border bg-card p-1.5"
      >
        <div className="flex items-center justify-between px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span>{tc('history')}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-3 text-xs text-muted-foreground">
          <LogIn className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t('loginRequired')}</span>
        </div>
      </div>
    )
  }

  // total: 后端真实总数(首页返回,所有页一致)
  // items / rawItems / 管道已上移到条件早退之前(V3 #62,Rules of Hooks)
  const total = data?.pages[0]?.total ?? 0
  // V3 #62:搜索关键词(小写包含匹配);searching 标记搜索态,渲染层据此降级为平铺
  const searchKeyword = searchQuery.trim().toLowerCase()
  const searching = searchKeyword.length > 0
  const filteredOut = rawItems.length > 0 && items.length === 0

  const handleSelect = (item: ConversationItem) => {
    // D187:打开会话 = 已读,清掉「标记为未读」标记
    if (userId) clearUnreadMark(userId, item.id)
    if (currentConversationId === item.id) {
      openPanel()
      return
    }
    if (isNavigatingRef.current) return

    isNavigatingRef.current = true
    useChatStore.getState().setConversationId(item.id)
    openPanel()

    setTimeout(() => {
      isNavigatingRef.current = false
    }, 400)
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setPendingDeleteId(id)
  }

  const confirmDelete = () => {
    if (pendingDeleteId) {
      setBusyId(pendingDeleteId)
      deleteMutation.mutate(pendingDeleteId, {
        onSettled: () => setBusyId(null),
      })
    }
  }

  const handleRename = (item: ConversationItem) => {
    setPendingRenameId(item.id)
    setRenameValue(item.title)
  }

  const confirmRename = () => {
    if (!pendingRenameId) return
    const title = renameValue.trim()
    if (!title) {
      error(tc('toast.renameEmpty'))
      return
    }
    setBusyId(pendingRenameId)
    renameMutation.mutate(
      { id: pendingRenameId, title },
      {
        onSettled: () => setBusyId(null),
        onSuccess: () => {
          setPendingRenameId(null)
          success(tc('toast.renamed'))
        },
        onError: () => error(tc('toast.renameFailed')),
      },
    )
  }

  // D186:归档/取消归档的执行体(从确认弹层与行内菜单两条路径收敛到这里)
  const runArchiveToggle = (item: ConversationItem, onSettledExtra?: () => void) => {
    setBusyId(item.id)
    const mutation = item.archivedAt ? unarchiveMutation : archiveMutation
    mutation.mutate(item.id, {
      onSettled: () => {
        setBusyId(null)
        onSettledExtra?.()
      },
      onSuccess: () => {
        success(item.archivedAt ? tc('toast.unarchived') : tc('toast.archived'))
      },
      onError: () => error(tc('toast.archiveFailed')),
    })
  }

  // D186(对标竞品 nav.archiveChatTitle/archiveChatDoNotAskAgain):归档前二次确认;
  // 勾过「不再提示」(或取消归档)走原直达路径,确认弹层只拦归档方向。
  const handleArchiveToggle = (item: ConversationItem) => {
    if (!item.archivedAt && !useArchivePrefsStore.getState().skipArchiveConfirm) {
      setPendingArchive(item)
      return
    }
    runArchiveToggle(item)
  }

  // D186:确认归档(勾选「不再提示」则持久化偏好;确认钮在途时由弹层显示「正在归档...」)
  const confirmArchive = () => {
    if (!pendingArchive) return
    if (archiveNoAsk) useArchivePrefsStore.getState().setSkipArchiveConfirm(true)
    setArchiveConfirmPending(true)
    const target = pendingArchive
    runArchiveToggle(target, () => {
      setArchiveConfirmPending(false)
      setPendingArchive(null)
      setArchiveNoAsk(false)
    })
  }

  // D20 置顶切换(G-11):成功文案区分 pinned/unpinned
  const handlePinToggle = (item: ConversationItem) => {
    setBusyId(item.id)
    pinMutation.mutate(
      { id: item.id, pinned: !item.pinned },
      {
        onSettled: () => setBusyId(null),
        onSuccess: () => success(item.pinned ? tc('toast.unpinned') : tc('toast.pinned')),
      },
    )
  }

  // D187:侧栏「标记为未读」入口(成功 toast 文案即竞品 nav.markUnreadSuccess 对标串)
  const handleMarkUnread = (item: ConversationItem) => {
    if (!userId) return
    markUnread(userId, item.id)
    success(t('markUnreadSuccess'))
  }

  // D20 文件夹/标签提交(G-11):写客户端元数据 store(v1),关对话框 + toast
  const handleOrgSubmit = (next: ConversationOrgSubmitValue) => {
    if (!pendingOrgItem || !userId) return
    setOrgFolder(userId, pendingOrgItem.id, next.folder)
    setOrgTags(userId, pendingOrgItem.id, next.tags)
    setPendingOrgItem(null)
    success(tc('toast.orgSaved'))
  }

  const handleExport = (item: ConversationItem, format: 'txt' | 'md') => {
    setBusyId(item.id)
    exportMutation.mutate(
      { id: item.id, format },
      {
        onSettled: () => setBusyId(null),
        onSuccess: (content) => {
          downloadText(
            content,
            `${slugifyForFilename(item.title)}-${buildTimestamp()}.${format}`,
            format === 'md' ? 'text/markdown' : 'text/plain',
          )
          success(tc('toast.exported'))
        },
        onError: () => error(tc('toast.exportFailed')),
      },
    )
  }

  const handleCompress = (item: ConversationItem, targetChars: 200000 | 1000000) => {
    setBusyId(item.id)
    compressMutation.mutate(
      { id: item.id, targetChars },
      {
        onSettled: () => setBusyId(null),
        onSuccess: (data) => {
          downloadText(
            data.content,
            `${slugifyForFilename(item.title)}-compressed-${targetChars}-${buildTimestamp()}.md`,
            'text/markdown',
          )
          success(tc('toast.compressed'))
        },
        onError: () => error(tc('toast.compressFailed')),
      },
    )
  }

  const exportRoleLabel: ExportRoleLabel = {
    user: te('roleUser'),
    assistant: te('roleAssistant'),
  }

  // 导出/分享动作:按会话 ID 拉全量消息后本地生成,不依赖面板当前加载的会话
  const runExportAction = (id: string, successMsg: string, action: () => Promise<boolean>) => {
    setBusyId(id)
    void action()
      .then((done) => {
        if (done) success(successMsg)
      })
      .catch((err: unknown) => {
        error(err instanceof Error && err.message ? err.message : tc('toast.exportFailed'))
      })
      .finally(() => setBusyId(null))
  }

  const handleExportJson = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      downloadConversationJson(item.id, item.title),
    )
  }

  const handleSnapshot = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      downloadConversationSnapshot(item.id, item.title, exportRoleLabel),
    )
  }

  const handleShareCard = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      downloadConversationShareCard(item.id, item.title, te('shareCardUser')),
    )
  }

  const handleShareLink = (item: ConversationItem) => {
    runExportAction(item.id, te('shareLinkCopied'), () =>
      copyConversationShareLink(item.id, te('shareFailed')).then(() => true),
    )
  }

  // D20(G-11):导出 PDF —— 打印通道(隐藏 iframe 调起系统打印,用户选"另存为 PDF")
  const handleExportPdf = (item: ConversationItem) => {
    runExportAction(item.id, te('exportStarted'), () =>
      printConversationPdf(item.id, item.title, exportRoleLabel),
    )
  }

  const renderItem = (item: ConversationItem) => {
    const active = item.id === currentConversationId
    // D20 会话组织(G-11):行内展示所属文件夹与标签(最多 2 枚,余量计 +N)
    const orgMeta = getOrgMeta(orgMap, item.id)
    const orgTags = orgMeta.tags ?? []
    // D53:每行注意力态独立派生,pendingQuestion 只联动当前会话行
    const unreadRaw = attentionById?.[item.id]?.unread ?? item.unreadCount ?? 0
    const unread = Number.isFinite(unreadRaw) && unreadRaw > 0 ? Math.floor(unreadRaw) : 0
    const waiting = isWaitingForConversation({
      conversationId: item.id,
      currentConversationId,
      hasPendingQuestion: pendingQuestion !== null,
      explicitWaiting: attentionById?.[item.id]?.waiting ?? item.hasPendingQuestion,
    })
    const attentionState = resolveConversationAttention({
      hasPendingQuestion: waiting,
      unreadCount: unread,
    })
    // D187:手动标记未读(真实未读计数在位时让位给既有计数徽章,避免双占)
    const markedUnread = !!unreadMarks[item.id] && unread === 0
    // D188:运行中(单流架构,仅当前打开的会话可能处于流式运行态)
    const running = item.id === currentConversationId && isStreaming
    return (
      <li key={item.id} className="group relative">
        {/* V3 #62:多选态下行内复选框。aria-label 带会话标题 —— 只写"选择"的无障碍名称
            脱离上下文不成立(读屏器逐个念过一遍时分不清勾的是哪一行)。 */}
        {selection.selectionMode && (
          <Checkbox
            checked={selection.isSelected(item.id)}
            onCheckedChange={(checked) => selection.toggleSelected(item.id, checked === true)}
            aria-label={`${t('select')} ${item.title}`}
            data-testid={`conversation-checkbox-${item.id}`}
            className="absolute left-0.5 top-2 z-10 h-3.5 w-3.5"
          />
        )}
        <button
          type="button"
          // 多选态下点击整行 = 勾选/取消,不再跳转对话(否则"批量勾选"会一路换页)
          onClick={() =>
            selection.selectionMode ? selection.toggleSelected(item.id) : handleSelect(item)
          }
          aria-current={active ? 'true' : undefined}
          // D22 会话拖入输入框引用(2026-09-19 立,对标 Qoder 0.2.x):会话行可拖拽,
          // dataTransfer 携带会话 JSON,输入框 handleDropWithConversation 消费
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/x-ihui-conversation',
              JSON.stringify({ id: item.id, title: item.title }),
            )
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className={cn(
            'relative block w-full rounded-sm px-2.5 py-1.5 pr-7 text-left transition-colors',
            'before:absolute before:inset-x-2 before:inset-y-0 before:rounded-sm before:transition-colors',
            'before:content-[""] before:-z-10',
            // 多选态给左侧复选框让出 20px,否则行首文字被压在框下
            selection.selectionMode && 'pl-7',
            active
              ? 'text-primary before:bg-primary/10'
              : 'hover:text-foreground hover:before:bg-muted',
          )}
        >
          {active && (
            <span
              aria-hidden
              className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary"
            />
          )}
          <span className="relative flex min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{item.title}</span>
            {item.pinned && (
              <Pin className="h-3 w-3 shrink-0 fill-current text-primary" aria-hidden />
            )}
            {orgMeta.folder && (
              <span className="inline-flex min-w-0 max-w-[72px] shrink-0 items-center gap-0.5 rounded-sm bg-muted px-1 text-[9px] leading-4 text-muted-foreground">
                <FolderOpen className="h-2.5 w-2.5 shrink-0" />
                <span className="min-w-0 truncate">{orgMeta.folder}</span>
              </span>
            )}
            {orgTags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex min-w-0 max-w-[64px] shrink-0 items-center rounded-sm bg-primary/10 px-1 text-[9px] leading-4 text-primary"
              >
                <span className="min-w-0 truncate">{tag}</span>
              </span>
            ))}
            {orgTags.length > 2 && (
              <span className="shrink-0 whitespace-nowrap text-[9px] leading-4 tabular-nums text-muted-foreground">
                +{orgTags.length - 2}
              </span>
            )}
          </span>
          <span className="relative mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="min-w-0 truncate">{item.model}</span>
            {item.lastMessageAt && (
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {dateFmt.format(new Date(item.lastMessageAt))}
              </span>
            )}
            {/* D187:手动标记未读 —— 圆点标记,悬停出项目 Tooltip(§4 禁原生提示窗) */}
            {markedUnread && (
              <Tooltip content={t('markUnreadSuccess')}>
                <span
                  data-testid="conversation-marked-unread"
                  role="status"
                  aria-label={t('markUnreadSuccess')}
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
                >
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
              </Tooltip>
            )}
            {/* D188:运行中徽标(绿点脉冲 + 复用 shared「执行中」词汇) */}
            {running && (
              <span
                data-testid="attention-badge-running"
                role="status"
                aria-label={tTask('activityRunning')}
                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-500/10 px-1 py-px text-[10px] font-medium leading-4 text-emerald-700 dark:text-emerald-400"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
                />
                {tTask('activityRunning')}
              </span>
            )}
            <ConversationAttentionBadges state={attentionState} unreadCount={unread} />
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              disabled={busyId === item.id}
              aria-label={tc('actions.menu')}
              data-testid="conversation-more-menu"
              className={cn(
                'absolute right-0.5 top-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-all',
                'text-muted-foreground opacity-0 group-hover:opacity-100',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'data-[state=open]:opacity-100 data-[state=open]:bg-accent',
              )}
            >
              {busyId === item.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MoreVertical className="h-3 w-3" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleRename(item)
              }}
              disabled={busyId === item.id}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.rename')}</span>
            </DropdownMenuItem>
            {/* D20(G-11):置顶/取消置顶 —— 与会话历史页同款语义,复用既有 toast 键 */}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handlePinToggle(item)
              }}
              disabled={busyId === item.id}
              data-testid="conversation-pin-action"
            >
              {item.pinned ? (
                <>
                  <PinOff className="mr-2 h-3.5 w-3.5" />
                  <span>{tc('actions.unpin')}</span>
                </>
              ) : (
                <>
                  <Pin className="mr-2 h-3.5 w-3.5" />
                  <span>{tc('actions.pin')}</span>
                </>
              )}
            </DropdownMenuItem>
            {/* D187:标记为未读(客户端标记,打开该会话即清除) */}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleMarkUnread(item)
              }}
              disabled={busyId === item.id || !userId}
              data-testid="conversation-mark-unread-action"
            >
              <Mail className="mr-2 h-3.5 w-3.5" />
              <span>{t('markUnread')}</span>
            </DropdownMenuItem>
            {/* D20(G-11):文件夹/标签编辑(客户端元数据 v1) */}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setPendingOrgItem(item)
              }}
              disabled={busyId === item.id || !userId}
              data-testid="conversation-org-action"
            >
              <Tags className="mr-2 h-3.5 w-3.5" />
              <span>{tc('org.title')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleArchiveToggle(item)
              }}
              disabled={busyId === item.id}
              data-testid="conversation-archive-action"
            >
              {item.archivedAt ? (
                <>
                  <ArchiveRestore className="mr-2 h-3.5 w-3.5" />
                  <span>{tc('actions.unarchive')}</span>
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-3.5 w-3.5" />
                  <span>{tc('actions.archive')}</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExport(item, 'md')
              }}
              disabled={busyId === item.id}
            >
              <FileCode className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.exportMd')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExport(item, 'txt')
              }}
              disabled={busyId === item.id}
            >
              <FileText className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.exportTxt')}</span>
            </DropdownMenuItem>
            {/* D20(G-11):导出 PDF(打印通道,用户侧"另存为 PDF") */}
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExportPdf(item)
              }}
              disabled={busyId === item.id}
              data-testid="conversation-export-pdf"
            >
              <FileDown className="mr-2 h-3.5 w-3.5" />
              <span>{te('exportPdf')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleExportJson(item)
              }}
              disabled={busyId === item.id}
            >
              <FileJson className="mr-2 h-3.5 w-3.5" />
              <span>{te('exportJson')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleSnapshot(item)
              }}
              disabled={busyId === item.id}
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              <span>{te('snapshot')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleShareCard(item)
              }}
              disabled={busyId === item.id}
            >
              <ImageIcon className="mr-2 h-3.5 w-3.5" />
              <span>{te('exportCard')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleShareLink(item)
              }}
              disabled={busyId === item.id}
            >
              <Link2 className="mr-2 h-3.5 w-3.5" />
              <span>{te('share')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleCompress(item, 200000)
              }}
              disabled={busyId === item.id}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.compressTo200k')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleCompress(item, 1000000)
              }}
              disabled={busyId === item.id}
            >
              <Download className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.compressTo1m')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteClick(e, item.id)
              }}
              disabled={busyId === item.id}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              data-testid="conversation-delete-action"
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              <span>{tc('actions.delete')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </li>
    )
  }

  return (
    <>
      <div
        role="region"
        aria-label={t('title')}
        className="mb-1 w-full rounded-lg border border-border bg-card p-1.5"
      >
        <div className="flex items-center justify-between px-1.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          <span className="min-w-0 truncate">{tc('history')}</span>
          <span className="ml-1 flex shrink-0 items-center gap-1">
            {total > 0 && (
              <span className="rounded-sm bg-muted px-2 py-1 text-[10px] font-medium whitespace-nowrap tabular-nums leading-none text-muted-foreground">
                {total}
              </span>
            )}
            {/* V3 #62:搜索开关(收起态放大镜,激活态 X + 高亮;展开的输入框渲染在标题行下方) */}
            <button
              type="button"
              aria-label={t2('searchAriaLabel')}
              aria-expanded={searchOpen}
              data-testid="conversation-search-toggle"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-sm transition-colors hover:bg-accent',
                searchOpen && 'bg-primary/10 text-primary',
              )}
            >
              {searchOpen ? <X className="h-3 w-3" /> : <Search className="h-3 w-3" />}
            </button>
            {/* V3 #62:多选态开关(与搜索开关同档 20x20)。aria-pressed 而非 aria-expanded ——
                它开的是一条动作条而不是输入框,且再点一次是"退出并清空选中"。 */}
            <button
              type="button"
              aria-label={t('selectModeAriaLabel')}
              aria-pressed={selection.selectionMode}
              data-testid="conversation-select-toggle"
              onClick={selection.toggleSelectionMode}
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-sm transition-colors hover:bg-accent',
                selection.selectionMode && 'bg-primary/10 text-primary',
              )}
            >
              <ListChecks className="h-3 w-3" />
            </button>
            {/* D20(G-11):文件夹筛选器(仅在已建文件夹时出现,undefined=不过滤) */}
            {orgFolders.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={tc('org.filterLabel')}
                    data-testid="conversation-folder-filter"
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-sm transition-colors hover:bg-accent',
                      folderFilter !== undefined && 'bg-primary/10 text-primary',
                    )}
                  >
                    <ListFilter className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setFolderFilter(undefined)}
                    data-testid="conversation-folder-filter-all"
                  >
                    <span>{tc('org.filterAll')}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFolderFilter(null)}>
                    <span className="min-w-0 truncate">{tc('org.folderNone')}</span>
                  </DropdownMenuItem>
                  {orgFolders.map((f) => (
                    <DropdownMenuItem key={f} onClick={() => setFolderFilter(f)}>
                      <span className="min-w-0 truncate">{f}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* D189:排序方式切换器(置顶优先=既有默认;按时间=后端返回序) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('sorting.label')}
                  data-testid="conversation-sort-toggle"
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-sm transition-colors hover:bg-accent',
                    sortMode !== 'pinnedFirst' && 'bg-primary/10 text-primary',
                  )}
                >
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setSortMode('pinnedFirst')}
                  data-testid="conversation-sort-pinned-first"
                >
                  <span>{t('sorting.pinnedFirst')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setSortMode('byTime')}
                  data-testid="conversation-sort-by-time"
                >
                  <span>{t('sorting.byTime')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>

        {/* V3 #62:搜索输入框(仅展开态渲染;Esc 收起并清空,恢复完整列表) */}
        {searchOpen && (
          <div className="px-1 pb-1">
            <SearchInput
              ref={searchInputRef}
              size="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch()
              }}
              placeholder={t('searchPlaceholder')}
              aria-label={t2('searchAriaLabel')}
              data-testid="conversation-search-input"
            />
          </div>
        )}

        {/* V3 #62:多选态动作条。选中集只从 selection 读(唯一持有者),本组件不另存一份 */}
        {selection.selectionMode && (
          <ConversationBatchBar
            selectedCount={selection.selectedCount}
            totalCount={items.length}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            busy={batchBusy || batchMutation.isPending}
            busyAction={batchBusy || batchMutation.isPending ? lastBatchAction : null}
            onToggleAll={(checked) => selection.selectAll(checked, visibleIds)}
            onInvert={() => selection.invert(visibleIds)}
            onBatch={runBatch}
            onCancel={selection.clear}
          />
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t('loading')}</span>
          </div>
        ) : queryError && rawItems.length === 0 ? (
          // D190:仅首屏失败(无任何已加载数据)才整块显示加载失败;
          // 翻页失败时 data 仍在(react-query v5 置 error 但保留 data),列表保持 + 底部重试入口
          <div className="px-2 py-3 text-xs text-muted-foreground">{tCommon('loadFailed')}</div>
        ) : filteredOut ? (
          // D20(G-11)+V3 #62:有会话、但被文件夹筛选或关键词筛到空 —— 必须走"未找到匹配"
          // 而不是"暂无任务记录"。此前判据顺序是 items.length===0 在前,所以搜不到时
          // 界面喊的是"你没有任何任务",清空关键词后文案又变回来 —— 两个完全不同的事实
          // 被同一句文案覆盖(判据 1 的"空态有明确文案"要求正是这一格)。
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            {t('noResults')}
          </div>
        ) : items.length === 0 ? (
          // 真的一条会话都没有(首屏空库),给新建引导而不是"未找到"
          <div className="flex flex-col items-center gap-1.5 px-2 py-4 text-center">
            <MessageCirclePlus className="h-5 w-5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">{tc('noHistory')}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            <div
              className="thin-scroll max-h-[220px] overflow-y-auto pr-0.5 pb-2"
              onScroll={(e) => {
                const el = e.currentTarget
                if (
                  el.scrollTop + el.clientHeight >= el.scrollHeight - 24 &&
                  hasNextPage &&
                  !isFetchingNextPage
                ) {
                  fetchNextPage()
                }
              }}
            >
              {/* V3 #62:搜索态平铺(自然降级) —— 时间分组(今天/本周/本月)是浏览型导航,
                  搜索时用户目标是快速定位匹配项,分组头反而稀释结果、增加扫视成本,
                  故搜索中平铺展示全部匹配项(置顶优先仍保留),清空关键词即恢复分组 */}
              {searching ? (
                <ul>{items.map(renderItem)}</ul>
              ) : (
                groupByDate(items).map((group) => (
                  <div key={group.key} className="mb-0.5 last:mb-0">
                    <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                      {tc(group.key)}
                    </div>
                    <ul>{group.items.map(renderItem)}</ul>
                  </div>
                ))
              )}
              {isFetchingNextPage ? (
                // D190:翻页加载态补文案(此前仅 Loader 图标,对标竞品 sidebarView.loadingMore)
                <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{t('loadingMore')}</span>
                </div>
              ) : queryError && hasNextPage ? (
                // D190:翻页失败重试入口(react-query v5:fetchNextPage 失败置 error 且保留 data)
                <div className="flex justify-center py-1.5">
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    data-testid="conversation-load-more-retry"
                    className="text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {t('retryLoadMore')}
                  </button>
                </div>
              ) : null}
            </div>
            <Link
              href="/chat/history"
              className="mt-1 flex items-center justify-center gap-1 whitespace-nowrap rounded-sm px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span>{t('viewAll')}</span>
              {total > 0 && <span className="tabular-nums">{total}</span>}
            </Link>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={tc('deleteConversation')}
        content={tc('confirmDeleteConversation')}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />

      {/* D186:归档二次确认(对标竞品 nav.archiveChatTitle「归档“{title}”?」+「不再提示」+ 在途「正在归档...」) */}
      <ConfirmDialog
        open={pendingArchive !== null}
        title={t('archiveChatTitle', { title: pendingArchive?.title ?? '' })}
        content={
          <label
            className="flex items-center gap-2 text-xs text-muted-foreground"
            data-testid="archive-confirm-no-ask"
          >
            <Checkbox
              checked={archiveNoAsk}
              onCheckedChange={(v) => setArchiveNoAsk(v === true)}
              data-testid="archive-confirm-no-ask-checkbox"
            />
            <span>{t('archiveChatDoNotAskAgain')}</span>
          </label>
        }
        confirmText={tc('actions.archive')}
        cancelText={tCommon('cancel')}
        loading={archiveConfirmPending}
        loadingText={t('archivingChat')}
        onConfirm={confirmArchive}
        onCancel={() => setPendingArchive(null)}
      />

      <Dialog
        open={pendingRenameId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRenameId(null)
        }}
      >
        <DialogContent className="min-[640px]:max-w-sm">
          <DialogHeader>
            <DialogTitle>{tc('renameDialog.title')}</DialogTitle>
            {/* D191:helper 描述行(对标竞品 nav.renameChatDescription"保持简短且易于识别") */}
            <DialogDescription>{tc('renameDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {tc('renameDialog.label')}
            </label>
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={tc('renameDialog.placeholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmRename()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="bg-muted" onClick={() => setPendingRenameId(null)}>
              {tc('renameDialog.cancel')}
            </Button>
            <Button onClick={confirmRename} disabled={renameMutation.isPending}>
              {tc('renameDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* D20(G-11):文件夹/标签编辑对话框(受控组件,读写客户端元数据 store) */}
      <ConversationOrgDialog
        open={pendingOrgItem !== null}
        onOpenChange={(open) => {
          if (!open) setPendingOrgItem(null)
        }}
        conversationTitle={pendingOrgItem?.title ?? ''}
        meta={pendingOrgItem ? getOrgMeta(orgMap, pendingOrgItem.id) : {}}
        folders={orgFolders}
        onSubmit={handleOrgSubmit}
      />
    </>
  )
}

export default SidebarChatHistory
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
