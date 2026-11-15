// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { FallbackEvent } from '@ihui/api-client'
import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo, SubAgentActivity } from '@/components/ai/types'
import {
  MessageContextMenu,
  MessageSearchBar,
} from '@/components/ai/progress-sections/message-context-menu'
import { useProgressJumpStoreForPane } from '@/stores/progress-jump-store'
import { matchesPaneEvent, useOptionalPaneId, usePaneChatStore } from '@/stores/chat-pane-context'
import { useAuthStore } from '@/stores/auth'

import { MessageItem } from './MessageItem'
import { QueryThumbRail } from './query-thumb-rail'
import { StreamingSkeleton, shouldShowStreamingSkeleton } from './streaming-skeleton'
import { ScrollJumpButtons } from './scroll-jump-buttons'
import { AmbientSuggestions } from '@/components/ai/ambient-suggestions'
import { useAppearanceStore } from '@/stores/appearance-settings'
// 轮次呈现投影层(2026-10-29 立,对标 Qoder 0.4.11 第六层):UI 不直接渲染 messages,
// 先投影成 presentation rows 再按行语义分流。本文件是它的**唯一生产消费方**
// (装车证明见 `__tests__/presentation-wiring.test.tsx`)。
import { createPresentationCache, type PresentationCache } from './turn-presentation'
// 投影行 → 渲染分组:窗口化坐标系(一条消息 = 一个窗口行)在这一层保持不变,
// 投影只贡献"归属附注"与零布局影响的语义容器。理由见该文件头注 ①②③。
import {
  blockIsProcessNarration,
  buildPresentationGroups,
  groupIsExploring,
} from './presentation-units'
import type { PresentationBlock } from './presentation-units'
// 票64(2026-10-18 立):版本族读投影 —— regenerate/edit 的多版本 sibling
// 只渲染激活版本,否则"点一次编辑出两个气泡"(纯函数在 @/lib/message-version-family)。
// 票59 2/3(2026-10-22):投影吃用户手动切换态(activeVersionByRoot),并给出每条
// 消息的版本位置(versionFamilyPosition)供气泡上的版本菜单渲染。
import { projectActiveMessages, versionFamilyPosition } from '@/lib/message-version-family'
// 差距⑤(2026-10-30):「分享此回合」深链的轮次序号投影 —— id → turnOrdinal 的
// 唯一计算点在本组件(与版本族位置同一处置),MessageItem 只消费透传的序号。
import { projectTurnOrdinals } from '@/lib/turn-deeplink'
import { useFocusArtifactScroll } from '@/components/media/artifact-turn-badge'
import { CanvasOverlay } from '@/components/chat/canvas-overlay'
import { EmptyState } from './EmptyState'
import { FallbackBanner } from './FallbackBanner'
// D71 十态轮次状态徽章(2026-10-29 装车):`TurnStatusLine` 自 2026-09-28 建好起
// 零生产消费(`TurnStatusBadge` 建好、词包五语言齐、单测全绿,用户屏幕上仍是空白)。
// 挂在**消息流尾部**而不是某条消息内部 —— 状态取自 store 的会话级事实
// (`isStreaming` / 最后一条助手消息的工具态与错误态 / 审批待决),与"哪一条消息"无关:
// 挂进 MessageItem 会变成"每条消息各挂一枚",同一次流式里 N 条历史消息同时声称自己在跑。
import { TurnStatusLine } from './turn-status-line'
// 批次 3(2026-11-06):会话级旁路提示 —— 预算硬停止与压缩边界回看。
// 挂在消息流尾部（与 TurnStatusLine 同一挂载位置），避免改 MessageItem 的工具卡区域。
import { SessionBudgetStopNotice } from '../budget-stop-notice'
import { CompactionBoundaryReview } from '../compaction-boundary-review'
// 2026-11:对话内「提示留痕」—— sonner 光条 4s 即消,用户无法回看/复盘。
// 挂在消息流尾部(与 TurnStatusLine 同位置,对齐 RN 的 `messageListSlots.orphanTailNode`),
// 把本次会话弹出过的提示按时间列出来。记录不进后端上下文,只是客户端可视 trace。
import { ChatNoticeLog } from '../notice-log'
// G-828(2026-10-04):窗口化的纯判据(区间 + 窗口外占位高度)单点住在 ../windowing,
// 本组件不再手算 `offsets[len] - offsets[end+1]`。
import { listItemEntranceMotion, windowPaddings } from '../windowing'
import { useMessageListScroll } from './use-message-list-scroll'
import { useMessageListDerivations } from './use-message-list-derivations'
import { useMessageListSearch } from './use-message-list-search'
import { useMessageListContextMenu } from './use-message-list-context-menu'
// V3 #62(2026-09-27 立):既有搜索条的「结果预览列表」投影(输入框/快捷键/上一个
// 下一个仍唯一归 use-message-list-search,本件只补"看得见命中了什么")。
import { SearchResultList } from './search-result-list'
import { useChatSearch } from '@/hooks/use-chat-search'
// V3 #63(2026-09-27 立):form_request 帧的对话流宿主 —— 卡片本体与应答上行
// 在 @/components/ai/business-form-*,本处只补那条一直没装车的连线。
import { BusinessFormSection } from '@/components/ai/business-form-section'
import { useBusinessFormStore } from '@/stores/business-forms'
import { toast } from '@/components/common'
import {
  regenerateMessage,
  branchMessage,
  editMessageAndRerun,
  editAiMessageAsVersion,
} from '@/hooks/use-chat/send-message'
import { ToolApprovalDialog } from '@/components/ai/tool-approval-dialog'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  isLoading?: boolean
  emptyTitle: string
  emptyHint: string
  /** 深链锚点失败时用 anchor-unresolved:空态不渲染「开始新任务」模板。 */
  emptyKind?: 'welcome' | 'anchor-unresolved'
  assistantLabel: string
  loadingLabel?: string
  onTemplateSelect?: (content: string) => void
  /** Inline Diff Accept 回调:把 edit_file/write_file 的 diff 写入文件系统
   *  2026-07-22 立,P3 Inline Diff 卡片 Apply 工作流 */
  onApplyDiff?: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  /** Inline Diff Reject 回调:纯前端标记为 rejected */
  onRejectDiff?: (messageId: string, toolCallId: string) => void
  /** W5(2026-09-18 立):hunk 级部分应用回调,newContent 为已接受 hunk 重组后的最终内容 */
  onApplyPartialDiff?: (
    messageId: string,
    toolCallId: string,
    diffInfo: InlineDiffInfo,
    newContent: string,
  ) => Promise<void>
  /** #14 批量 Accept 回调(2026-09-13 立):消息内全部待决 diff 卡逐文件顺序应用 */
  onApplyAllDiffs?: (messageId: string) => Promise<void>
  /** #14 批量 Reject 回调(2026-09-13 立):消息内全部待决 diff 卡整体标记 rejected */
  onRejectAllDiffs?: (messageId: string) => void
  /** #8 是否还有更早的历史消息可加载(滚动到顶部时触发 onLoadMoreHistory) */
  hasMoreHistory?: boolean
  /** #8 是否正在加载更早的历史消息(显示顶部 loading 指示器) */
  loadingMoreHistory?: boolean
  /** #8 滚动到顶部时触发加载更多历史消息 */
  onLoadMoreHistory?: () => void
  /** P4-2: fallback 通知(主模型失败切换到备用模型时非 null,展示横幅) */
  fallbackNotice?: FallbackEvent | null
  /** P4-2: 清除 fallback 通知(用户点击横幅关闭按钮时调用) */
  onClearFallbackNotice?: () => void
  /** Phase 18.2: SubAgent 活动列表(2026-07-28,可选覆盖 useChatStore 内部读取)
   *  对话流 inline 渲染在最后一条 AI 消息下方(而非 AI 面板底部)。
   *  不传则从 useChatStore 内部派生 */
  subAgentActivities?: SubAgentActivity[]
  /** Phase 18.4: step budget 显示(从 store 派生,目前用固定 60 上限) */
  stepBudget?: { used: number; total: number }
  /** 代码块默认折叠行数，<=0 表示不折叠 */
  codeCollapseLines?: number
  /**
   * 消息流尾部插槽(2026-11-08 立):渲染在滚动区内、最后一条消息之后,
   * 供内联提问卡(InlineQuestionCard)等非模态卡片跟随消息流滚动,而非 fixed 浮层。
   */
  trailing?: React.ReactNode
}

export function MessageList({
  messages,
  isStreaming,
  isLoading,
  emptyTitle,
  emptyHint,
  emptyKind = 'welcome',
  assistantLabel,
  loadingLabel,
  onTemplateSelect,
  onApplyDiff,
  onRejectDiff,
  onApplyPartialDiff,
  onApplyAllDiffs,
  onRejectAllDiffs,
  hasMoreHistory,
  loadingMoreHistory,
  onLoadMoreHistory,
  fallbackNotice,
  onClearFallbackNotice,
  subAgentActivities: subAgentActivitiesProp,
  codeCollapseLines,
  trailing,
}: MessageListProps) {
  const t = useTranslations('chat')

  // 票60 步序四:窗格寻址。根窗格无 Provider ⇒ 单例;非根窗格读各自实例。
  const chatStore = usePaneChatStore()
  const paneId = useOptionalPaneId()

  // D39 免费额度心智边界:非 VIP 即免费档可用 → 不向该用户渲染付费诱导
  const user = useAuthStore((s) => s.user)
  const freeTierAvailable = !user?.isVip

  // 2026-11-15:去掉「步骤/命令/叙述」档位切换与过滤 —— 思考、工具调用、正文
  // 统一按同一条流式时间线完整呈现,不再按档位裁掉活动条目。
  // 外观设置(2026-11-15):思考过程 / 工具调用的显示开关由设置页统一管理。
  // 只在这两个开关关闭时才做浅拷贝过滤 ⇒ 默认路径返回原数组,零额外开销。
  const showReasoning = useAppearanceStore((s) => s.showReasoning)
  const showToolCalls = useAppearanceStore((s) => s.showToolCalls)
  // 票59 2/3:版本族手动切换态(按窗格寻址 —— 两窗格各看各的选择)
  const activeVersionByRoot = chatStore((s) => s.activeVersionByRoot)
  // 差距⑤:当前列表是否来自 around 居中窗口(窗口头部不是 turn 1 ⇒ 未盖章行不给号)
  const messagesTurnWindowed = chatStore((s) => s.messagesTurnWindowed)
  const visibleMessages = React.useMemo(() => {
    const projected = projectActiveMessages(messages, activeVersionByRoot)
    if (showReasoning && showToolCalls) return projected
    return projected.map((m) => {
      if (m.role !== 'assistant') return m
      const next = { ...m }
      if (!showReasoning) next.reasoning = undefined
      if (!showToolCalls) {
        next.toolCalls = undefined
        next.planSteps = undefined
        next.subagentActivities = undefined
        next.terminalTasks = undefined
      }
      return next
    })
  }, [messages, activeVersionByRoot, showReasoning, showToolCalls])

  // 票59 2/3:每条带族坐标消息的版本位置(一次渲染算一遍)。
  // Map 的 value 引用在 messages 不变时保持稳定 ⇒ React.memo 的消息行不乱重渲染。
  const versionInfoByMessageId = React.useMemo(() => {
    const map = new Map<
      string,
      {
        rootId: string
        index: number
        total: number
        entries: { id: string; ordinal: number; summary: string }[]
      }
    >()
    for (const m of messages) {
      const pos = versionFamilyPosition(messages, m.id)
      if (!pos) continue
      map.set(m.id, {
        rootId: pos.rootId,
        index: pos.index,
        total: pos.total,
        entries: pos.members.map((member, i) => ({
          id: member.id,
          ordinal: i + 1,
          summary: typeof member.content === 'string' ? member.content.slice(0, 60) : '',
        })),
      })
    }
    return map
  }, [messages])

  // 差距⑤(2026-10-30):id → turnOrdinal 投影(口径见 @/lib/turn-deeplink)。
  // 吃全量 messages(不受呈现过滤影响),续算不被打断。
  const turnOrdinalById = React.useMemo(
    () => projectTurnOrdinals(messages, { windowed: messagesTurnWindowed }),
    [messages, messagesTurnWindowed],
  )

  // 切换只改读投影的激活版本,不写库、不发请求(判族口径在 lib/message-version-family.ts)
  const onSelectMessageVersion = React.useCallback(
    (rootId: string, messageId: string) =>
      chatStore.getState().setActiveMessageVersion(rootId, messageId),
    [chatStore],
  )

  const scroll = useMessageListScroll({
    messages: visibleMessages,
    isStreaming,
    hasMoreHistory,
    loadingMoreHistory,
    onLoadMoreHistory,
  })
  const {
    containerRef,
    bottomRef,
    enableVirtual,
    visibleRange,
    computeCumulative,
    measureItem,
    handleScroll,
    scrollToBottom,
    pinWindowToIndex,
    userScrolledUp,
    focusedIndex,
    isFarFromTop,
    isFarFromBottom,
  } = scroll

  // 外观 v2(2026-11-15):阅读标尺 —— 指针移动直接改 DOM 样式,不进 React state,
  // 避免每次 pointermove 触发整列消息重渲染。指针离开消息视口即隐藏。
  const readingRuler = useAppearanceStore((s) => s.readingRuler)
  const rulerRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    if (!readingRuler) return
    const onMove = (event: PointerEvent) => {
      const host = containerRef.current
      const ruler = rulerRef.current
      if (!host || !ruler) return
      const rect = host.getBoundingClientRect()
      if (event.clientY < rect.top || event.clientY > rect.bottom) {
        ruler.style.opacity = '0'
        return
      }
      ruler.style.opacity = '1'
      ruler.style.transform = `translateY(${Math.round(event.clientY - 28)}px)`
    }
    const hide = () => {
      if (rulerRef.current) rulerRef.current.style.opacity = '0'
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', hide)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', hide)
      hide()
    }
  }, [readingRuler, containerRef])

  // D2(2026-09-18 立):流式骨架屏显隐 —— 该轮尚无任何 AI 首帧时显示,首帧到达即卸载
  const showSkeleton = shouldShowStreamingSkeleton(messages, isStreaming)

  useMessageListDerivations({ messages, isStreaming, subAgentActivitiesProp, t })

  const search = useMessageListSearch({ messages, containerRef })
  const {
    searchBarVisible,
    searchResultIds,
    searchCurrentIndex,
    searchResultSet,
    searchCurrentId,
    handleSearch,
    handleSearchNavigate,
    handleSearchClose,
    openSearch,
  } = search

  const { contextMenu, handleContextMenuAction } = useMessageListContextMenu({
    t,
    onRequestSearch: openSearch,
  })

  // ── V3 #62(2026-09-27 立)搜索结果预览列表 ────────────────────────────
  // 唯一查询源仍是上面那条搜索条;这里把同一份查询喂给 useChatSearch,只为拿到
  // 「命中消息的摘要 + 时间」列表并可点选定位。匹配规则两侧共用
  // @ihui/shared 的 searchMessages,不存在第二套判定。
  const tSearch = useTranslations('chatSearchBar')
  const preview = useChatSearch({
    messages,
    messagesContainerRef: containerRef,
    notFoundMessage: tSearch('messageNotFound'),
    showWarning: (msg) => toast.info(msg),
  })
  const { setSearchQuery: setPreviewQuery, debouncedSearch: searchPreview, clearSearch } = preview
  /** 搜索条每次输入:既有逻辑跳首个匹配 + 预览列表按同一查询重建(200ms 防抖) */
  const onSearchQuery = React.useCallback(
    (query: string) => {
      handleSearch(query)
      setPreviewQuery(query)
      searchPreview(query)
    },
    [handleSearch, setPreviewQuery, searchPreview],
  )
  /** 关闭搜索条:两份态一起收(只收一份会留下一个悬着的命中列表) */
  const onSearchClose = React.useCallback(() => {
    handleSearchClose()
    clearSearch()
  }, [handleSearchClose, clearSearch])

  // ── V3 #63(2026-09-27 立)切会话回收待应答表单 ────────────────────────
  // 表单请求按 messageId 键控挂在 store 上,不回收就是一份"看不见但永不出队"的
  // 内存滞留(上一个会话里没填完的批准/拒绝,在新会话里既无处显示也无从应答)。
  // 挂在这里而不是各跳转点:MessageList 是所有会话视图的唯一宿主,URL 参数换会话
  // 那条路径(不在本票写面内)同样被这一格覆盖。
  const conversationId = chatStore((s) => s.conversationId)
  const lastConversationIdRef = React.useRef(conversationId)
  // 票60 普查@2026-10-21:回收范围 = **本组件实例见过的消息集**,而不是整张表。
  // 多窗格并存时每个窗格各自在切会话,整表 clear 等于"任一窗格一切换就把别窗格
  // 填到一半的业务表单一起抹掉"(用户可见的数据丢失);键本来就是 messageId。
  const ownedFormMessageIdsRef = React.useRef<string[]>([])
  React.useEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId
      useBusinessFormStore.getState().clearFormsForMessages(ownedFormMessageIdsRef.current)
    }
    ownedFormMessageIdsRef.current = messages.map((m) => m.id)
  }, [conversationId, messages])

  // ── 轮次呈现投影层装载(2026-10-29 立,`turn-presentation.ts` 的第一个生产消费方)──
  // 立因:投影层交付时零生产消费(本仓 §0.9「造好没装车」= 没有)。此前渲染路径是
  // `renderItems.map(m => <MessageItem/>)`,即"UI 直接渲染 messages 数组";接入后改由
  // 投影层先给出 `PresentationRow[]`,渲染按行语义分流。
  //
  // cache 实例必须住 ref:**每渲染新建 = 零缓存**,而"源消息未变就不重算"正是本层存在的
  // 唯一理由。用 useMemo 依赖 messages 数组来替代同样不行 —— store 每帧替换被追加的那一条
  // 消息对象,数组引用随之每帧变,useMemo 每帧全量重算,失效形态与没有这层完全一样。
  const presentationCacheRef = React.useRef<PresentationCache | null>(null)
  if (presentationCacheRef.current === null) {
    presentationCacheRef.current = createPresentationCache()
  }
  const presentationCache = presentationCacheRef.current
  // 换会话时清一次缓存:引用判等本身已能防串会话(不同会话的消息对象完全不同 ⇒ 全段重算),
  // 这里清的是**滞留** —— 不清的话上一会话的段表会一直握着它那批消息对象不放。
  const presentationConversationRef = React.useRef(conversationId)
  React.useEffect(() => {
    if (presentationConversationRef.current === conversationId) return
    presentationConversationRef.current = conversationId
    presentationCache.reset()
  }, [conversationId, presentationCache])
  // 投影输入是 `visibleMessages`(已过版本族投影 + 详情档位过滤)——
  // 渲染面看到哪一份消息,投影就必须吃哪一份,否则行会指向不存在的消息。
  const presentation = presentationCache.project(visibleMessages)

  // ── Phase 19 集成(2026-07-28 立)────────────────────────────────────
  // ProgressJumpStore:PlanStep ↔ Message 双向跳转 + 联动高亮
  // 票60 残余(2026-10-21):这一份按窗格寻址 —— 根窗格仍是单例,非根窗格各一份,
  // 于是别窗格消费后的 clearPendingJump 不再抢走本窗格这次跳转,高亮也不再跨窗格串。
  const jumpStore = useProgressJumpStoreForPane()
  const pendingJump = jumpStore((s) => s.pendingJumpToMessage)
  const highlightedMessageId = jumpStore((s) => s.highlightedMessageId)
  const messageToPlanStepIds = jumpStore((s) => s.messageToPlanStepIds)
  const flashHighlight = jumpStore((s) => s.flashHighlight)
  const clearPendingJump = jumpStore((s) => s.clearPendingJump)
  const setHoveredMessage = jumpStore((s) => s.setHoveredMessage)
  const setHoveredPlanStep = jumpStore((s) => s.setHoveredPlanStep)
  // 已处理的 pendingJump nonce(防止同一次 jump 重复触发 scrollIntoView)
  const handledJumpNonceRef = React.useRef<number>(-1)

  // Phase 19(2026-07-28 立):反向联动 — hover AI 消息时同步高亮 plan step
  // messageToPlanStepIds 由 pane 的 linkPlanStepToMessage 维护,本组件只读
  const handleMessageHover = React.useCallback(
    (messageId: string, planStepId: string | null) => {
      setHoveredMessage(planStepId ? messageId : null)
      setHoveredPlanStep(planStepId)
    },
    [setHoveredMessage, setHoveredPlanStep],
  )

  // 监听 pendingJump:滚动到目标消息 + flashHighlight
  // PlanStepItem 点击 → ProgressJumpStore.requestJumpToMessage(id) → 此 effect 响应
  // 深链锚点:行不在挂载窗口里时先 pin 到中部,下一帧再定位;around 窗口用 auto,
  // 避免先贴底再平滑滚过去的那一跳。装饰入场(listItemEntranceMotion)恒为 none,不接动画。
  React.useEffect(() => {
    if (!pendingJump) return
    if (handledJumpNonceRef.current === pendingJump.nonce) return
    const el = containerRef.current?.querySelector(
      `[data-message-id="${pendingJump.messageId}"]`,
    ) as HTMLElement | null
    if (!el) {
      const idx = visibleMessages.findIndex((m) => m.id === pendingJump.messageId)
      if (idx >= 0 && (idx < visibleRange.start || idx > visibleRange.end)) {
        pinWindowToIndex(idx)
        return
      }
    }
    handledJumpNonceRef.current = pendingJump.nonce
    if (el) {
      el.scrollIntoView({
        behavior: messagesTurnWindowed ? 'auto' : 'smooth',
        block: 'center',
      })
    }
    // 即便目标暂未渲染也调用 flashHighlight(目标出现时会读到高亮状态)
    flashHighlight(pendingJump.messageId)
    // 600ms 后清空 pending(让 UI 跳转完成后回归稳态)
    const timer = window.setTimeout(() => {
      clearPendingJump()
    }, 600)
    return () => window.clearTimeout(timer)
  }, [
    pendingJump,
    flashHighlight,
    clearPendingJump,
    containerRef,
    visibleMessages,
    visibleRange.start,
    visibleRange.end,
    pinWindowToIndex,
    messagesTurnWindowed,
  ])

  // 监听自定义事件 'ihui:scroll-to-message' (agent-task-progress-pane 兼容路径)
  React.useEffect(() => {
    const onScrollTo = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string; paneId?: string | null }>).detail
      if (!detail?.messageId) return
      if (!matchesPaneEvent(detail.paneId, paneId)) return
      const el = containerRef.current?.querySelector(
        `[data-message-id="${detail.messageId}"]`,
      ) as HTMLElement | null
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      flashHighlight(detail.messageId)
    }
    window.addEventListener('ihui:scroll-to-message', onScrollTo as EventListener)
    return () => window.removeEventListener('ihui:scroll-to-message', onScrollTo as EventListener)
  }, [flashHighlight, containerRef, paneId])

  // D76 反向联动(2026-09-24 立):产物面板/画布导航 → ihui:focus-artifact →
  // 滚动定位消息流里的产物卡并描边高亮。挂本容器(长期存活节点),
  // 禁挂会被卸载的深层组件(dead dispatch 教训)。
  useFocusArtifactScroll(containerRef)

  // 2026-08-30 立:重新生成 / 分支事件监听(MessageItem 按钮 + 右键菜单派发)。
  // 2026-09-12 立:编辑重跑事件监听(四竞品对标 P0-1,MessageItem 编辑 Dialog 派发)。
  // 完整闭环在 send-message.ts 的 regenerateMessage / branchMessage / editMessageAndRerun(复用既有流式发送逻辑)。
  // D22(2026-09-19 立):引用回复事件监听(MessageItem Reply 按钮派发)——
  // 从 store 查找目标消息快照写入 quotedMessage,MessageInput 渲染引用 chip,doSend 附加正文。
  // 2026-09-22 修:重试事件(MessageItem 错误气泡「重试」按钮派发)此前全仓零监听 → 点击后
  // dispatch 成功但无副作用,只弹 toast 却不真的重跑(与桌面托盘菜单同型的"派发到空气"缺陷)。
  // 语义上"重试一条失败的 AI 回复" == "重新生成该消息",故复用 onRegenerate 的 regenerateMessage 闭环。
  React.useEffect(() => {
    type PaneEventDetail = { paneId?: string | null }
    const onRegenerate = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string } & PaneEventDetail>).detail
      if (!detail?.messageId || !matchesPaneEvent(detail.paneId, paneId)) return
      void regenerateMessage(detail.messageId, chatStore)
    }
    const onBranch = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string } & PaneEventDetail>).detail
      if (!detail?.messageId || !matchesPaneEvent(detail.paneId, paneId)) return
      void branchMessage(detail.messageId, chatStore)
    }
    const onEdit = (e: Event) => {
      // W16(2026-09-14):detail 新增 rollbackFiles(编辑 Dialog 勾选「同时回滚文件改动」时为 true)
      const detail = (
        e as CustomEvent<
          {
            messageId: string
            content: string
            rollbackFiles?: boolean
          } & PaneEventDetail
        >
      ).detail
      if (!detail?.messageId || !detail.content || !matchesPaneEvent(detail.paneId, paneId)) return
      void editMessageAndRerun(
        detail.messageId,
        detail.content,
        detail.rollbackFiles === true,
        chatStore,
      )
    }
    // 票64(2026-10-18 立):AI 消息编辑(MessageItem 的「保存为新版本」Dialog 派发)。
    // 与用户消息的编辑重跑是两条链 —— 这条只落新 sibling,不重跑、不截断后续消息。
    const onEditAi = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string; content: string } & PaneEventDetail>)
        .detail
      if (!detail?.messageId || !detail.content || !matchesPaneEvent(detail.paneId, paneId)) return
      void editAiMessageAsVersion(detail.messageId, detail.content, chatStore)
    }
    const onReply = (e: Event) => {
      const detail = (e as CustomEvent<{ messageId: string } & PaneEventDetail>).detail
      if (!detail?.messageId || !matchesPaneEvent(detail.paneId, paneId)) return
      const target = chatStore.getState().messages.find((mm) => mm.id === detail.messageId)
      if (!target) return
      // 引用快照截断到 500 字符:超长 AI 回复只取开头摘要,完整正文 AI 上下文里本就有
      chatStore.getState().setQuotedMessage({
        id: target.id,
        role: target.role,
        content: target.content.length > 500 ? `${target.content.slice(0, 500)}…` : target.content,
      })
    }
    window.addEventListener('ihui:regenerate-message', onRegenerate as EventListener)
    window.addEventListener('ihui:branch-message', onBranch as EventListener)
    window.addEventListener('ihui:edit-message', onEdit as EventListener)
    window.addEventListener('ihui:edit-ai-message', onEditAi as EventListener)
    window.addEventListener('ihui:reply-message', onReply as EventListener)
    // 2026-09-22:错误气泡「重试」接同一闭环(regenerateMessage:调后端 /regenerate 截断历史
    // + 复用 sendMessage 重跑前一条用户提问),此前该事件无任何监听方。
    window.addEventListener('ihui:retry-message', onRegenerate as EventListener)
    return () => {
      window.removeEventListener('ihui:regenerate-message', onRegenerate as EventListener)
      window.removeEventListener('ihui:branch-message', onBranch as EventListener)
      window.removeEventListener('ihui:edit-message', onEdit as EventListener)
      window.removeEventListener('ihui:edit-ai-message', onEditAi as EventListener)
      window.removeEventListener('ihui:reply-message', onReply as EventListener)
      window.removeEventListener('ihui:retry-message', onRegenerate as EventListener)
    }
  }, [paneId, chatStore])

  // AI 工作台 对齐(2026-07-28):timeline 事件可点击跳转到对话流
  // 监听 planStepId / toolCallId 自定义事件 → 翻译为 messageId → 派发 ihui:scroll-to-message
  React.useEffect(() => {
    const scrollToMessage = (messageId: string): void => {
      window.dispatchEvent(
        new CustomEvent('ihui:scroll-to-message', { detail: { messageId, paneId } }),
      )
    }
    const onPlanStep = (e: Event) => {
      const detail = (e as CustomEvent<{ planStepId: string; paneId?: string | null }>).detail
      if (!detail?.planStepId || !matchesPaneEvent(detail.paneId, paneId)) return
      const messageId = jumpStore.getState().planStepToMessageId[detail.planStepId]
      if (messageId) scrollToMessage(messageId)
    }
    const onToolCall = (e: Event) => {
      const detail = (e as CustomEvent<{ toolCallId: string; paneId?: string | null }>).detail
      if (!detail?.toolCallId || !matchesPaneEvent(detail.paneId, paneId)) return
      const messages = chatStore.getState().messages
      const found = messages.find((m) => m.toolCalls?.some((tc) => tc.id === detail.toolCallId))
      if (found) scrollToMessage(found.id)
    }
    window.addEventListener('ihui:scroll-to-plan-step', onPlanStep as EventListener)
    window.addEventListener('ihui:scroll-to-tool-call', onToolCall as EventListener)
    return () => {
      window.removeEventListener('ihui:scroll-to-plan-step', onPlanStep as EventListener)
      window.removeEventListener('ihui:scroll-to-tool-call', onToolCall as EventListener)
    }
  }, [chatStore, jumpStore, paneId])

  // #7 虚拟滚动:窗口化渲染,仅挂载可见范围 + buffer,窗口外用占位高度顶住滚动条
  // - 未窗口化(消息数 <= WINDOW_THRESHOLD):全量渲染,保留原逻辑
  // - 窗口化:用 measureItem ref 测量真实高度,handleScroll 按 windowing.ts 的纯判据定区间
  // G-828(2026-10-04):占位高度改由 windowing.windowPaddings 计算(与区间判据同一份
  // offsets,不再在这侧手算 `offsets[len] - offsets[end+1]`);容器与行上补三个 data-* 数值
  // 钩子(window-start/window-end/window-padding-*、window-index)——窗口化是否**真的生效**
  // 只能靠读挂载行数与占位高度来判,截图判不出来(也判不了"未生效 vs 被裁剪")。
  //
  // 2026-10-29:这一段整体上移到早退之前 —— 下面的投影分组/渲染块用到 useMemo/useCallback,
  // 放在 `messages.length === 0` 早退之后就违反 Rules of Hooks(本仓 2026-08-16 同型事故)。
  const renderItems = enableVirtual
    ? visibleMessages.slice(visibleRange.start, visibleRange.end + 1)
    : visibleMessages

  const offsets = enableVirtual ? computeCumulative().offsets : []
  const paddings = enableVirtual
    ? windowPaddings({
        offsets,
        count: visibleMessages.length,
        start: visibleRange.start,
        end: visibleRange.end,
      })
    : { paddingTop: 0, paddingBottom: 0 }
  const paddingTop = paddings.paddingTop
  const paddingBottom = paddings.paddingBottom

  // 投影分组:输入是**本帧窗口内**的消息(`renderItems`,未窗口化时即全集),
  // 输出只是"这些消息怎么分组"。窗口 count / offsets / measureItem 全部仍按消息算,
  // 因此窗口化语义与接入前逐字节一致(兼容性论证见 `presentation-units.ts` 头注 ①)。
  const presentationGroups = React.useMemo(
    () => buildPresentationGroups(presentation.rows, renderItems),
    [presentation, renderItems],
  )
  // 消息 → 它在整表里的下标。`isLast` / `isFocused` / 键盘导航都以这个下标为准,
  // 与窗口化前的 `visibleRange.start + idx` 完全同义。
  const realIndexById = React.useMemo(() => {
    const map = new Map<string, number>()
    for (let i = 0; i < visibleMessages.length; i += 1) {
      const m = visibleMessages[i]
      if (m) map.set(m.id, i)
    }
    return map
  }, [visibleMessages])

  // 单条消息块渲染 —— 与接入前的 `<MessageItem/> + BusinessFormSection` 逐 props 等价,
  // 抽出来只为让"游离消息"与"容器内消息"共用同一份(不产生第二套渲染口径)。
  const renderMessageBlock = React.useCallback(
    (block: PresentationBlock) => {
      const m = block.message
      const realIdx = realIndexById.get(m.id) ?? -1
      // 差距⑥(2026-10-30 立):过程文本折叠类目的两个事实位,全部由投影既有形状 +
      // 既有 store 事实(`isStreaming`/消息位序)投影,不新增状态源。
      // 终态判据:本轮**不再有任何正在流式的消息**即为流收口 ——
      // 回合内只有末条消息可能处于流式中(流式追加只动整表最后一条),
      // 故 `isStreaming ∧ 容器末条=整表末条` 成立 ⇒ 本轮进行中,否则终态已确认。
      const isProcessText = blockIsProcessNarration(block)
      const containerLast = block.container
        ? block.container.messages[block.container.messages.length - 1]
        : undefined
      const turnFinalTextConfirmed = !(
        isStreaming &&
        containerLast !== undefined &&
        realIndexById.get(containerLast.id) === visibleMessages.length - 1
      )
      return (
        <>
          {/* P0 流式性能优化(2026-07-23):React.memo 避免非目标消息重渲染 */}
          <MessageItem
            message={m}
            isLast={realIdx === visibleMessages.length - 1}
            isStreaming={isStreaming}
            assistantLabel={assistantLabel}
            onApplyDiff={onApplyDiff}
            onRejectDiff={onRejectDiff}
            onApplyPartialDiff={onApplyPartialDiff}
            onApplyAllDiffs={onApplyAllDiffs}
            onRejectAllDiffs={onRejectAllDiffs}
            isHighlighted={highlightedMessageId === m.id}
            isFocused={focusedIndex === realIdx}
            linkedPlanStepId={messageToPlanStepIds[m.id]?.[0] ?? null}
            onMessageHover={handleMessageHover}
            isSearchMatch={searchResultSet.has(m.id)}
            isSearchCurrent={searchCurrentId === m.id}
            onContextMenu={(e) => {
              contextMenu.setData(m)
              contextMenu.contextMenuHandlers.onContextMenu(e)
            }}
            codeCollapseLines={codeCollapseLines}
            versionInfo={versionInfoByMessageId.get(m.id)}
            onSelectMessageVersion={onSelectMessageVersion}
            turnOrdinal={turnOrdinalById.get(m.id) ?? null}
            isProcessText={isProcessText}
            turnFinalTextConfirmed={turnFinalTextConfirmed}
          />
          {/* V3 #63(2026-09-27 立):该条 assistant 消息上的 form_request 宿主。
              BusinessFormSection 内部无请求即整段返回 null(不占位),所以这里
              对每条 assistant 消息都挂一次即可 —— 用户批准/拒绝经
              postFormResponse 走同一条会话通道回传(与 tool-delegate 同族)。 */}
          {m.role === 'assistant' ? <BusinessFormSection messageId={m.id} /> : null}
          {/* Phase 19: 最后一个 assistant 消息下挂载 PlanStepsCard + SubAgentTaskTree
            2026-08-01 Phase 4d:消息级 inline 后,仅当消息级数据为空时显示全局块(降级兼容旧后端)
            2026-08-02 隐藏:对话流底部不再渲染 PlanStepsCard/SubAgentTaskTree(冗余可视化,与 主流 IDE 简洁风格不一致)
            功能保留在右侧 AI 面板(PlanStepsCard + TimelineTab 独立入口) */}
        </>
      )
    },
    [
      realIndexById,
      visibleMessages.length,
      isStreaming,
      assistantLabel,
      onApplyDiff,
      onRejectDiff,
      onApplyPartialDiff,
      onApplyAllDiffs,
      onRejectAllDiffs,
      highlightedMessageId,
      focusedIndex,
      messageToPlanStepIds,
      handleMessageHover,
      searchResultSet,
      searchCurrentId,
      contextMenu,
      codeCollapseLines,
      versionInfoByMessageId,
      onSelectMessageVersion,
      turnOrdinalById,
    ],
  )

  if (messages.length === 0) {
    return (
      <EmptyState
        isLoading={isLoading}
        loadingLabel={loadingLabel}
        emptyTitle={emptyTitle}
        emptyHint={emptyHint}
        onTemplateSelect={emptyKind === 'anchor-unresolved' ? undefined : onTemplateSelect}
        t={t}
      />
    )
  }

  // 2026-08-16 移除:DEBUG useEffect 在 early return 之后调用(违反 Rules of Hooks,
  // lint error),且 console.log 为调试残留——删除,虚拟滚动 padding 信息无需打印。

  // 单一整合对话流视图(2026-07-31 立,彻底整合,对标 主流 IDE 单一对话流)
  // - 移除 tablist 切换(对话流/时间线/全部 三 tab)
  // - 移除独立时间线面板(对话流已内联工具调用/子代理/计划等,时间线是冗余汇总)
  // - 只保留对话流一个视图,工具调用/子代理/思考过程已内联在消息气泡内
  const inlinePanelNode = (
    <div
      ref={containerRef}
      onScroll={() => handleScroll()}
      id="message-list-panel-inline"
      role="tabpanel"
      className="hover-scroll min-h-0 flex-1 overflow-y-auto"
      data-testid="message-list-inline-panel"
      data-window-active={enableVirtual ? 'true' : 'false'}
      data-list-entrance={listItemEntranceMotion()}
      // 投影结构版本号(生产可观测面):投影结果(行集合与行引用)真的变了才 +1。
      // 流式中只改最后一条消息内容时,若段内该条被重算,版本会前进;整表原样重投影则不动。
      // e2e/单测据此判"投影层在跑且缓存生效",不必读内部实现。
      data-presentation-structure-revision={presentation.presentationStructureRevision}
      data-presentation-reused-rows={presentation.stats.reusedRows}
      data-presentation-recomputed-rows={presentation.stats.recomputedRows}
      data-window-start={enableVirtual ? visibleRange.start : 0}
      data-window-end={enableVirtual ? visibleRange.end : visibleMessages.length - 1}
      data-window-mounted={renderItems.length}
      data-window-total={visibleMessages.length}
      data-window-padding-top={paddingTop}
      data-window-padding-bottom={paddingBottom}
    >
      <div
        className="mx-auto flex flex-col px-4 py-6"
        style={{
          maxWidth: 'var(--chat-content-width, 48rem)',
          rowGap: 'var(--chat-message-gap, 2px)',
        }}
      >
        {/* P4-2: fallback 通知横幅(主模型失败切换到备用模型时展示,amber 警告色) */}
        {fallbackNotice && (
          <FallbackBanner
            fallbackNotice={fallbackNotice}
            onClearFallbackNotice={onClearFallbackNotice}
            t={t}
            freeTierAvailable={freeTierAvailable}
          />
        )}
        {/* #8 顶部加载更多历史指示器 */}
        {loadingMoreHistory && (
          <div className="flex items-center justify-center gap-2 py-2 text-label text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('loading')}
          </div>
        )}
        {/* #7 虚拟滚动顶部占位(未渲染消息的高度填充) */}
        {paddingTop > 0 && <div style={{ height: paddingTop, flexShrink: 0 }} />}
        {/* 轮次呈现投影(2026-10-29 装车):渲染按投影分组分流,而不是直接 map 消息数组。
            - `group.container === null` ⇒ 游离消息(用户 / system / 不该聚合的助手消息),原样一行;
            - `group.container !== null` ⇒ 一条助手轮次的 `thinkingAgent` 容器。它渲染成
              `display:contents`(零盒模型 ⇒ 不改变 offsets 与视觉),内部每条消息仍各自
              一个测高块 ⇒ **窗口化坐标系(一条消息 = 一个窗口行)一字不动**。
              视觉壳仍是 MessageItem 内部的 StreamGroup,N 个步骤的折叠不在这里重造。
            data-* 三件套给 e2e/单测判"投影层真的在生产路径上"(而不是只测纯函数)。 */}
        {presentationGroups.map((group) => {
          if (group.container === null) {
            const block = group.blocks[0]
            if (!block) return null
            return (
              <div
                key={group.key}
                ref={enableVirtual ? measureItem(block.messageId) : undefined}
                data-presentation-row={group.key}
                data-presentation-row-type="message"
                data-presentation-exploring={block.isExploring ? 'true' : 'false'}
              >
                {renderMessageBlock(block)}
              </div>
            )
          }
          const exploring = groupIsExploring(group)
          return (
            <div
              key={group.key}
              // 零布局影响:容器只表达语义归属,不参与盒模型(见 presentation-units.ts 头注 ③)
              className="contents"
              data-presentation-row={group.key}
              data-presentation-row-type="thinkingAgent"
              data-presentation-turn={group.container.turnId}
              data-presentation-message-count={group.blocks.length}
              // isExploring 语义位落地(任务三):「正在探索」与「正在思考」两态在 DOM 上可判。
              // 文案待 i18n 解锁(语言包被并行会话持有),故此处只给机器可读差异,不造半套文案。
              data-presentation-exploring={exploring ? 'true' : 'false'}
            >
              {group.blocks.map((block) => (
                <div
                  key={block.messageId}
                  ref={enableVirtual ? measureItem(block.messageId) : undefined}
                  data-presentation-block={block.messageId}
                  data-presentation-block-kind={block.activity ? 'activity-group' : 'message'}
                  data-presentation-exploring={block.isExploring ? 'true' : 'false'}
                >
                  {renderMessageBlock(block)}
                </div>
              ))}
            </div>
          )
        })}
        {/* #7 虚拟滚动底部占位 */}
        {paddingBottom > 0 && (
          <div
            style={{ height: paddingBottom, flexShrink: 0 }}
            data-testid="virtual-scroll-padding-bottom"
          />
        )}
        {/* D2(2026-09-18 立):流式骨架屏占位 —— 用户发消息后、AI 首帧到达前显示,首帧到达即卸载 */}
        {showSkeleton && <StreamingSkeleton />}
        {/* D71 十态轮次状态徽章(2026-10-29 装车):流尾一行,只对**活跃轮次**出现
            (判据 `shouldShowTurnStatusLine` 复用 shared 的 `isActiveTurnState`)。
            空闲/已完成/已终止时整段不渲染 —— 历史消息不该满屏"已完成"。 */}
        <SessionBudgetStopNotice conversationId={conversationId} />
        <CompactionBoundaryReview conversationId={conversationId} />
        <TurnStatusLine />
        {/* 内联提问卡等尾部插槽:跟随最后一条消息,处于滚动区之内(非浮层) */}
        {trailing}
        {/* 2026-11 提示留痕:本次会话弹出过的 toast 按时间留在流尾(可回看/可复制)。
            位置刻意放在 `trailing` 之后、`bottomRef` 之前 —— 与 RN 的 orphanTailNode 同语义:
            随内容滚动、恒在最后一条消息之后,不遮挡输入区。 */}
        <ChatNoticeLog conversationId={conversationId} />
        <div ref={bottomRef} />
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <MessageSearchBar
        visible={searchBarVisible}
        onClose={onSearchClose}
        onSearch={onSearchQuery}
        resultCount={searchResultIds.length}
        currentIndex={searchCurrentIndex}
        onNavigate={handleSearchNavigate}
      />
      {/* V3 #62:命中摘要列表 —— 只在搜索条可见且有命中时出现,点选即定位那条消息 */}
      {searchBarVisible ? (
        <SearchResultList
          results={preview.searchResults}
          selectedId={preview.selectedMessageId}
          onPick={preview.scrollToMessage}
        />
      ) : null}
      {/* relative 包裹层:浮动控件(跳顶/跳底箭头、阅读尺)绝对定位锚到消息滚动视口,
          不随内容滚动;滚动由消息容器自身 overflow-y-auto 承担 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {inlinePanelNode}
        {readingRuler ? (
          <div
            ref={rulerRef}
            aria-hidden="true"
            data-testid="reading-ruler"
            className="pointer-events-none fixed inset-x-0 top-0 z-30 h-14 border-y border-stroke-selected bg-primary/5 opacity-0"
          />
        ) : null}
        {/* D3(2026-09-18 立):跳顶 / 跳到最新浮动箭头。
            2026-11-15:容器移入本 relative 包裹层 ⇒ 绝对定位锚到消息滚动视口而不是整个
            聊天面板;上箭头贴视口上方、下箭头贴视口下方,不再双双堆在右下角。
            2026-09-22 归一:原先此处另有一枚底部居中的「跳到最新」,与列内「跳底」同义重复,
            现合并进 ScrollJumpButtons,行为沿用 scrollToBottom(滚到底 + 复位 userScrolledUp)。 */}
        <ScrollJumpButtons
          isFarFromTop={isFarFromTop}
          isFarFromBottom={isFarFromBottom}
          userScrolledUp={userScrolledUp}
          hasMessages={messages.length > 0}
          isStreaming={isStreaming}
          onJumpTop={() => {
            const el = containerRef.current
            if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onJumpLatest={scrollToBottom}
        />
      </div>
      {/* D45(2026-09-24 立,G-54):ambient suggestions 环境建议条。
          2026-11-04 第三轮:从滚动内容尾部移到滚动容器**下方**的常驻带。
          旧落点的问题:建议条是消息流最后一行,会话变窄/变长时这一行会被滚动视口底边
          切一半,切掉的那半截正好压在 cost-estimate-bar 上(280 命中 40% / 390 命中 20%)。
          建议条是「下一步做什么」的即时动作,本就不该藏进历史记录末尾;移出滚动容器后
          它恒在视口内、恒在成本条之上,命中区域由结构分离而非 z-index。
          2026-11-14:建议改为服务端模型基于最近对话生成的真实指令,点击即发送;
          写入的是本窗格 store(非根单例),多窗格并存时不会串到别的窗格。
          派生仍用原始 messages(建议独立于档位过滤的呈现粒度)。 */}
      <AmbientSuggestions
        messages={messages}
        conversationId={conversationId}
        isStreaming={isStreaming}
        onAdopt={(prompt) => chatStore.setState({ draftInput: prompt, draftAutoSend: true })}
      />
      {/* W18 对话流缩略导航(2026-09-13 立):右侧 Query 刻度条,点击跳转任一提问。
          2026-09-21 归一:并入 D3 定位器的滚动联动高亮,删除 ConversationLocatorRail,
          右侧只保留这一条 rail(此前两 rail 并挂,用户反馈"怎么有两个 nav") */}
      <QueryThumbRail messages={visibleMessages} containerRef={containerRef} />
      {/* Phase 19: MessageContextMenu(全局单实例,visible/position 由 hook 控制) */}
      <MessageContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        items={contextMenu.items}
        onAction={(action) => {
          void handleContextMenuAction(action)
        }}
        onClose={contextMenu.close}
        data-testid="message-list-context-menu"
      />
      {/* 工具调用审批弹窗(2026-08-30 立):高危工具执行前请求用户批准/拒绝。
          全局单实例,通过 EventSource 订阅 tool-approval SSE 事件自驱动弹窗。 */}
      <ToolApprovalDialog />
      {/* P0-4(2026-09-13):全屏画布 overlay(全局单实例,store.open 驱动;
          入口:ArtifactCanvas 卡片 Maximize2 / 消息内 html|svg 代码块「在画布打开」) */}
      <CanvasOverlay />
    </div>
  )
}

export default MessageList
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
