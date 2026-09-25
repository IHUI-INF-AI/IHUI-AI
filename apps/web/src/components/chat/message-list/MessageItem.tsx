// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import * as React from 'react'
import {
  Copy,
  Check,
  RefreshCw,
  Share2,
  Pencil,
  Trash2,
  MessageCircle,
  Eye,
  EyeOff,
  Download,
  Code,
  Megaphone,
  RotateCcw,
  Volume2,
  Square,
  CheckCheck,
  Ban,
  AlertTriangle,
  Quote,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@ihui/ui-react'
import type { ChatMessage } from '@/stores/chat'
import type { InlineDiffInfo } from '@/components/ai/types'
import { CommunityPublishDialog } from '@/components/chat/community-publish-dialog'
import CheckpointRewindPanel from '@/components/checkpoint/CheckpointRewindPanel'
import { MarkdownStream } from '@/components/ai/markdown-stream'
// D87(2026-09-23 立):AI 回复文本批注双向锚点(圈选回复选区 → 持久锚点 + 失效态 + 再编辑/删除)
import { ReplyAnnotationLayer } from '@/components/ai/reply-annotation'
import { ToolCallCard, deriveDiffInfo } from '@/components/ai/tool-call-card'
import { StreamGroup } from '@/components/chat/stream/stream-ui'
import { describeToolCall, humanizeToolText } from '@ihui/shared/chat'
import {
  resolveViewFailure,
  VIEW_FAILURE_NAMESPACE,
  VIEW_FAILURE_ERROR_CODE_KEY,
} from '@ihui/shared/utils/view-failure-taxonomy'
import { FALLBACK_REASON_QUOTA_EQUIVALENT } from '@ihui/api-client'
import { ArtifactCanvas, type Artifact } from '@/components/chat/artifact-canvas'
import { ThinkingSection } from '@/components/ai/progress-sections/thinking-section'
import { ToolCallSummaryCard } from '@/components/ai/progress-sections/tool-call-summary-card'
import { SubAgentActivityFeed } from '@/components/ai/sub-agent-activity-feed'
import { TerminalSection } from '@/components/ai/progress-sections/terminal-section'
import { PlanStepsCard } from '@/components/ai/progress-sections/plan-steps-card'
import { CitationBar } from '@/components/ai/progress-sections/citation-bar'
import { ContextAssemblyBar } from '@/components/ai/injection-bar'
import { RetryNotice } from '@/components/ai/progress-sections/retry-notice'
import { MemoryNoticeBar } from '@/components/ai/progress-sections/memory-notice-bar'
// Steer(中途引导,2026-09-19 立):消息级「已引导」提示条(store 旁路 steerNoticesByMessageId)
import { SteerNoticeBar } from '@/components/ai/progress-sections/steer-notice-bar'
// 2026-09-19 立:上下文压缩分隔线(compaction 命名帧 → onCompaction → store setMessageCompaction)
import { CompressionDivider } from '@/components/ai/progress-sections/compression-divider'
// P3 #36(2026-09-16 立):消息流内 best-of 并排对比卡(按 meta.bestOfRunId 关联)
import { BestOfCompare } from '@/components/ai/best-of-compare'
import { plainTextForClipboard } from '@/components/ai/progress-sections/message-context-menu'
import { MessageFileChips } from '@/components/chat/message-list/file-chips'
import { TurnChangesCard } from '@/components/chat/message-list/turn-changes-card'
// P3 #39(2026-09-16 立):执行轨迹回放(toolCalls 时序重演)
import { TraceReplay } from '@/components/ai/trace-replay'
import { useChatStore } from '@/stores/chat'
import { useTts } from '@/hooks/use-tts'
// D60(2026-09-23 渲染位):失败轮草稿保留提示与 toast 同源取词,不另立文案/状态
import { resolvePersistTexts } from '@/hooks/use-chat/persistence'
import { fetchApi } from '@/lib/api'
import { toast } from '@/components/common'
import { Tooltip } from '@/components/feedback'
import { cn } from '@/lib/utils'
import { formatDuration } from '@/lib/permission-mode-history'
import {
  TypingIndicator,
  formatMessageTimestamp,
  MessageUsageBadge,
  MessageUsageMetrics,
  UsageBreakdown,
  ACTION_BTN_CLASS,
} from './message-item-parts'
// D21(2026-09-19 立):中间步骤折叠策略 — 自适应(字数/工具数/耗时)+ 用户可配置
// (auto/collapsed/expanded,localStorage + 事件广播,复用 voice-toolbar 模板)
import {
  readFoldPolicyMode,
  resolveInitialStepsOpen,
  FOLD_POLICY_EVENT,
  type FoldPolicyMode,
} from './fold-policy'

// W16(2026-09-13):文件修改类工具集合(与 tool-call-summary-card 口径一致,前后端并集)。
// 用于编辑重跑 Dialog 判断"该消息之后是否产生了文件改动",决定是否展示文件回滚勾选项。
const FILE_MODIFY_TOOLS = new Set([
  'edit_file',
  'file_edit',
  'write_file',
  'create_file',
  'delete_file',
])

interface MessageItemProps {
  message: ChatMessage
  isLast: boolean
  isStreaming: boolean
  assistantLabel: string
  onApplyDiff?: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
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
  isHighlighted?: boolean
  isFocused?: boolean
  onContextMenu?: (e: React.MouseEvent) => void
  linkedPlanStepId?: string | null
  onMessageHover?: (messageId: string, planStepId: string | null) => void
  /** Phase 23: 搜索匹配的消息(ring-1 ring-yellow-400/40) */
  isSearchMatch?: boolean
  /** Phase 23: 搜索当前定位的消息(ring-2 ring-yellow-400) */
  isSearchCurrent?: boolean
  /** 代码块默认折叠行数,<=0 表示不折叠 */
  codeCollapseLines?: number
}

const MessageItem = React.memo(function MessageItem({
  message: m,
  isLast,
  isStreaming,
  onApplyDiff,
  onRejectDiff,
  onApplyPartialDiff,
  onApplyAllDiffs,
  onRejectAllDiffs,
  isHighlighted = false,
  isFocused = false,
  onContextMenu,
  linkedPlanStepId = null,
  onMessageHover,
  isSearchMatch = false,
  isSearchCurrent = false,
  codeCollapseLines,
}: MessageItemProps) {
  const t = useTranslations('chat')
  // 2026-09-12 立:Checkpoint/Rewind 相关文案走 aiChat 命名空间(与 CheckpointRewindPanel 保持一致)
  const tAiChat = useTranslations('aiChat')
  // 消息流活动区统一文面(与 stream-ui 基元同一命名空间)
  const tStream = useTranslations('taskStatus')
  // diff 卡取不到路径时的占位(工具卡同一文案源)
  const tTool = useTranslations('ai.toolCall')
  // D92(2026-09-24):错误卡与 MCP 面板共用同一张失败分类表(单一真相,禁止另起)
  const tFailure = useTranslations(VIEW_FAILURE_NAMESPACE)
  const failureResolution = m.error
    ? resolveViewFailure({ errorCode: m.errorCode, message: m.content })
    : null
  // 回落态(unknown)刻意不套表的标题/动作:分类不到就不要把"未判定"说成结论。
  const errorViewFailure =
    failureResolution && !failureResolution.isFallback ? failureResolution : null
  // 单独提出:errorCodeText 类型是 `string | null`,直接塞给 t() 会撞 TS2322(参数不收 null)
  const errorCodeText = errorViewFailure?.errorCodeText ?? null
  const errorCardTitle = errorViewFailure
    ? tFailure(errorViewFailure.entry.titleKey)
    : t('errorCardTitle')
  const isUser = m.role === 'user'
  // D22(2026-09-19 立):system 角色独立渲染分支 — /chat 请求侧已拒绝 system(防上下文注入),
  // 渲染侧仅服务历史会话回放/恢复场景后端下发的只读 system 条目:居中灰字提示条,无操作栏。
  const isSystem = m.role === 'system'
  const showTyping = !isUser && m.content === '' && isStreaming
  const streamingThis = !isUser && isStreaming && isLast
  // 2026-09-12 立:Checkpoint 面板按会话维度的 session_id 查询,
  // 前端当前可用的会话标识即 chat store 的 conversationId(详见交付说明)。
  const conversationId = useChatStore((s) => s.conversationId)
  // P1 #27 记忆更新可视化(2026-09-16 立):按 messageId 取本轮「已记住」条目。
  // 用叶子布尔/数组选择器订阅(memoryUpdateNotices 引用仅在 appendMemoryNotice 时变更),
  // 避免整棵树因无关 store 变更重渲染。
  const memoryNoticeItems = useChatStore(
    React.useCallback(
      (s) => s.memoryUpdateNotices.find((n) => n.messageId === m.id)?.items ?? null,
      [m.id],
    ),
  )
  // Steer(中途引导,2026-09-19 立):按 messageId 取本轮已注入的引导记录。
  // 叶子数组选择器订阅(steerNoticesByMessageId 引用仅在 appendSteerNotice 时变更),
  // 与 memoryNoticeItems 同款模式,避免无关 store 变更触发重渲染。
  const steerNotices = useChatStore(
    React.useCallback((s) => s.steerNoticesByMessageId[m.id] ?? null, [m.id]),
  )
  // D60(2026-09-23 渲染位):persist 失败保存的草稿(store 层早已落,此前无组件消费)。
  // 叶子选择器订阅 string|null,值比较天然防无关变更重渲染;仅失败卡消费,
  // 文案经 resolvePersistTexts 与 toast 同源(TRANSITIONAL 英文口径,零新键)。
  const failedDraft = useChatStore((s) => s.failedDraft)
  const failedDraftStatus = useChatStore((s) => s.failedDraftStatus)
  // 2026-09-12 立:Checkpoint 回退弹窗开关
  const [rewindDialogOpen, setRewindDialogOpen] = React.useState(false)
  // #17:折叠中间步骤(工具卡 + plan 步骤)。D21(2026-09-19 立):初始态改由折叠策略驱动 —
  // 用户配置 auto(自适应:字数/工具数/耗时)/ collapsed(强制折叠)/ expanded(强制展开,
  // 参考 Qoder 0.2.1);竞品默认口径已分化故不强制。用户显式展开/收起后 stepsOverrideRef
  // 锁定,策略与配置变更不再覆盖用户选择;FoldPolicyButton 切换配置经事件广播实时同步。
  const stepsOverrideRef = React.useRef<boolean | null>(null)
  const [foldPolicyMode, setFoldPolicyMode] = React.useState<FoldPolicyMode>(() =>
    readFoldPolicyMode(),
  )
  // 自适应三维输入:正文字数(正文未到时用 reasoning 字数兜底,覆盖"先想后答"场景)/
  // 工具调用数/工具耗时求和(BaseToolCall.durationMs)
  const stepDims = React.useMemo(
    () => ({
      contentChars: isUser ? 0 : m.content.length || (m.reasoning?.length ?? 0),
      toolCallCount: m.toolCalls?.length ?? 0,
      durationMs: (m.toolCalls ?? []).reduce((sum, tc) => sum + (tc.durationMs ?? 0), 0),
    }),
    [isUser, m.content.length, m.reasoning, m.toolCalls],
  )
  const [showSteps, setShowStepsState] = React.useState<boolean>(() =>
    resolveInitialStepsOpen(foldPolicyMode, stepDims),
  )
  // 统一 set 入口:任何显式展开/收起都登记 override(含 onOpenChange 的函数式更新)
  const setShowSteps = React.useCallback((action: boolean | ((prev: boolean) => boolean)) => {
    if (typeof action === 'function') {
      setShowStepsState((prev) => {
        const next = action(prev)
        stepsOverrideRef.current = next
        return next
      })
    } else {
      stepsOverrideRef.current = action
      setShowStepsState(action)
    }
  }, [])
  // D21:监听配置变更事件(FoldPolicyButton 写入 localStorage + 广播)→
  // 未被用户显式操作过的消息按新策略重解析;操作过的保持用户选择不被覆盖
  React.useEffect(() => {
    const sync = () => {
      const mode = readFoldPolicyMode()
      setFoldPolicyMode(mode)
      if (stepsOverrideRef.current === null) {
        setShowStepsState(resolveInitialStepsOpen(mode, stepDims))
      }
    }
    window.addEventListener(FOLD_POLICY_EVENT, sync)
    return () => window.removeEventListener(FOLD_POLICY_EVENT, sync)
  }, [stepDims])
  // Copy 按钮短暂"已复制"状态(2026-07-28 立),1.5s 后自动隐藏
  const [copied, setCopied] = React.useState(false)
  const copyTimerRef = React.useRef<number | null>(null)
  // AI 回复朗读(TTS):speaking 时按钮显示停止态
  const { speaking, speak, stop } = useTts()
  // 2026-07-28 立:Reasoning 折叠状态(2026-07-28 抽出为独立 state,供外部事件如键盘 Enter 切换)
  // 默认 false(折叠),点击展开按钮 / 收到 'ihui:toggle-reasoning' 事件时切换
  const [reasoningExpanded, setReasoningExpanded] = React.useState(false)

  // #17 折叠中间步骤区总数(2026-09-14 修正):
  // 原 gate 仅判 `m.toolCalls.length > 0`,导致"只有 planSteps / 终端任务 / subagent 活动
  // 而没有工具调用"的消息完全不渲染折叠区 —— plan 步骤永久不可见(tests/message-list
  // 的 PlanStepsCard 用例实证:纯 planSteps 消息 queryByTestId 恒为 null)。
  // 现取四类区段总数:既做折叠区 gate,也做组头「N 个步骤」计数,语义一致。
  const stepSectionsCount =
    (m.toolCalls?.length ?? 0) +
    (m.planSteps?.length ?? 0) +
    (m.terminalTasks?.length ?? 0) +
    (m.subagentActivities?.length ?? 0)

  // 流式期间组头 = 此刻正在做的这一行(对标 Qoder / Trae / Codex:过程组头就是最新活动行,
  // 而不是一句"展开查看更多步骤"的哑标题);结束后组头回落到步数摘要(由 StreamGroup 渲染)。
  // 头行禁止出现英文工具码名 —— 映射不到的插件/MCP 名走 "调用 {tool}" 措辞。
  const activeToolCall =
    m.toolCalls?.find((tc) => tc.status === 'running') ?? m.toolCalls?.[m.toolCalls.length - 1]
  const activeCallView = activeToolCall
    ? describeToolCall({
        toolName: activeToolCall.toolName,
        args: activeToolCall.args,
        status: activeToolCall.status,
      })
    : null
  const activeCallTitle = activeCallView
    ? activeCallView.nameKey
      ? tStream(activeCallView.nameKey)
      : tStream('activityTool', { tool: activeCallView.codeName })
    : ''
  const activeStepTitle = m.planSteps?.find((s) => s.status === 'in_progress')?.step
  const stepsHeadline = !streamingThis
    ? undefined
    : activeCallTitle !== ''
      ? `${activeCallTitle}${activeCallView?.subject ? ` ${activeCallView.subject}` : ''}`
      : activeStepTitle
        ? humanizeToolText(activeStepTitle, (key) => tStream(key))
        : tStream('statusRunning')

  // #14 批量 Accept/Reject 派生统计(2026-09-13 立):
  // 统计消息内 diff 卡(hasDiffCard)的 applyStatus 分布,驱动消息级批量按钮条与聚合徽章
  const diffStats = React.useMemo(() => {
    const cards = (m.toolCalls ?? []).filter(
      (tc) => !!tc.diffInfo || (tc.applyStatus !== undefined && tc.applyStatus !== null),
    )
    let pending = 0
    let applied = 0
    let rejected = 0
    let applying = false
    for (const tc of cards) {
      if (tc.applyStatus === 'applied') applied++
      else if (tc.applyStatus === 'rejected') rejected++
      else if (tc.applyStatus === 'applying') applying = true
      else pending++
    }
    return { total: cards.length, pending, applied, rejected, applying }
  }, [m.toolCalls])
  // 2026-08-29 修复:思考过程自动展开/收起生命周期
  // - 思考中(reasoning 流式)自动展开;思考结束(正文开始输出或流结束)自动收起
  // - autoExpandedRef 标记"本次展开是自动的":用户手动 toggle 过则不再自动收起
  // - userTouchedRef 标记"用户手动操作过":手动收起后流式期间不再被自动展开打扰
  const autoExpandedRef = React.useRef(false)
  const userTouchedRef = React.useRef(false)
  // 统一手动 toggle 入口:清除自动标记,后续思考结束不再自动收起
  const toggleReasoning = React.useCallback(() => {
    userTouchedRef.current = true
    autoExpandedRef.current = false
    setReasoningExpanded((prev) => !prev)
  }, [])
  // 监听全局 'ihui:toggle-reasoning' 事件:键盘 Enter 聚焦消息触发,只响应本条消息
  React.useEffect(() => {
    // 2026-08-02 修复: Bug 6 — 把 if (!m.reasoning) return 移到 listener 内部,
    // 否则 m.reasoning 后到达时才注册 listener,之前 toggle 事件已丢失。
    const onToggle = (e: Event) => {
      if (!m.reasoning) return
      const detail = (e as CustomEvent<{ messageId: string }>).detail
      if (detail?.messageId !== m.id) return
      toggleReasoning()
    }
    window.addEventListener('ihui:toggle-reasoning', onToggle as EventListener)
    return () => window.removeEventListener('ihui:toggle-reasoning', onToggle as EventListener)
  }, [m.id, m.reasoning, toggleReasoning])

  // 自动展开仅用于"正文输出中新思考交错到达"场景(思考区已挂载,用户可感知新思考);
  // "先想后答"模型的思考在 TypingIndicator 阶段(content 为空)已完成,
  // 思考区挂载时思考已结束,直接折叠 — 不做"先展开再收起",避免闪烁(用户手动操作过则不干预)
  // 判据:正文开始时刻的 reasoning 长度基线,基线之后新增的思考才视为"新思考"
  const reasoningBaselineRef = React.useRef<number | null>(null)

  // 维护基线:正文开始时快照当前 reasoning 长度;content 清空(regenerate)时重置
  React.useEffect(() => {
    if (m.content.length === 0) {
      reasoningBaselineRef.current = null
    } else if (reasoningBaselineRef.current === null) {
      reasoningBaselineRef.current = m.reasoning?.length ?? 0
    }
  }, [m.content, m.reasoning])

  // 流式正文中检测到基线之外新增的 reasoning → 自动展开
  React.useEffect(() => {
    if (
      streamingThis &&
      m.reasoning &&
      m.content.length > 0 &&
      reasoningBaselineRef.current !== null &&
      m.reasoning.length > reasoningBaselineRef.current &&
      !reasoningExpanded &&
      !userTouchedRef.current
    ) {
      autoExpandedRef.current = true
      setReasoningExpanded(true)
    }
  }, [streamingThis, m.reasoning, reasoningExpanded, m.content])

  // 2026-08-29:流结束后 — 自动展开的思考区收起(让位正文);
  // 同时重置手动标记,使 regenerate 能恢复完整自动生命周期
  React.useEffect(() => {
    if (streamingThis) return
    if (autoExpandedRef.current) {
      autoExpandedRef.current = false
      setReasoningExpanded(false)
    }
    userTouchedRef.current = false
  }, [streamingThis])

  // 2026-08-29 立:交错思考增长指示 — 正文流式输出期间 reasoning 超出基线继续增长,
  // 传给 ThinkingSection 显示脉冲光标/"思考中"loader;流结束(streamingThis=false)自动消失。
  // 渲染期读 ref 安全:m.reasoning 变化本身就会触发本组件重渲染(memo 比较失败)。
  const reasoningGrowing =
    streamingThis &&
    m.content.length > 0 &&
    !!m.reasoning &&
    reasoningBaselineRef.current !== null &&
    m.reasoning.length > reasoningBaselineRef.current
  // D64③ 双态(G-75):无思考却有引用时,引用条**收进思考卡**(标题即计数),
  // 而不是在卡下方再列一份 —— 引用集合仍只有 `m.citations` 一处真相源。
  const citationsCount = m.citations?.length ?? 0
  // 卡片是否该以"引用态"出现(无思考但有引用)
  const refsThinkingCardEligible = !m.reasoning && citationsCount > 0
  // 引用条**展开后**才收进思考卡(标题即计数);折叠态留在卡外 ——
  // 否则不点卡片就完全看不到来源，等于把信息藏进默认收起的容器里。
  const refsRenderedInsideThinkingCard = refsThinkingCardEligible && reasoningExpanded

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const text = isUser ? m.content : plainTextForClipboard(m.content) // assistant 内容用简化纯文本(与右键菜单行为一致)
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          // 兜底:旧浏览器无 Clipboard API → 用临时 textarea
          const ta = document.createElement('textarea')
          ta.value = text
          ta.setAttribute('readonly', '')
          ta.style.position = 'absolute'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        setCopied(true)
        // 用 i18n key(chat.copy/copied),缺失时回退到英文(任务约束:不硬编码中文)
        const successLabel = t('copied') === 'copied' ? 'Copied' : t('copied')
        if (successLabel === 'copied') {
          console.warn('[i18n] Missing translation for key: chat.copied')
        }
        toast.success(successLabel)
        if (copyTimerRef.current !== null) {
          window.clearTimeout(copyTimerRef.current)
        }
        copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
      } catch (err) {
        const errLabel = t('copyFailed') === 'copyFailed' ? 'Copy failed' : t('copyFailed')
        if (errLabel === 'copyFailed') {
          console.warn('[i18n] Missing translation for key: chat.copyFailed')
        }
        toast.error(errLabel, {
          description: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [isUser, m.content, t],
  )

  // 2026-08-02:AI 消息交互按钮回调(完全复用原项目 AIChat.vue 按钮清单)
  // 优先用全局 CustomEvent 派发(与右键菜单一致),由 message-input / 父组件监听
  // 回调缺失的用 toast 兜底(与右键菜单 feedback 一致)

  // 重新生成(对应原项目 regenerateMessage)
  const handleRegenerate = React.useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('ihui:regenerate-message', { detail: { messageId: m.id } }),
    )
    toast.info(t('regenerating') === 'regenerating' ? 'Regenerating...' : t('regenerating'))
  }, [m.id, t])

  // 删除消息(对应原项目 deleteMessage,逻辑从右键菜单提取)
  const handleDelete = React.useCallback(() => {
    const store = useChatStore.getState()
    const next = store.messages.filter((msg) => msg.id !== m.id)
    if (next.length !== store.messages.length) {
      useChatStore.setState({ messages: next })
      toast.success(t('messageDeleted') === 'messageDeleted' ? 'Deleted' : t('messageDeleted'))
    }
  }, [m.id, t])

  // 分享 — 获取分享链接并复制到剪贴板
  const handleShare = React.useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const convId = useChatStore.getState().conversationId
      if (!convId) return

      let shareToken: string | null = null
      try {
        const r = await fetchApi<{ token: string }>(`/api/chat/conversations/${convId}/share`, {
          method: 'POST',
        })
        if (!r.success || !r.data?.token) throw new Error(r.error || '获取分享链接失败')
        shareToken = r.data.token
      } catch (err: unknown) {
        // API 错误：直接显示后端返回的具体信息
        if (err instanceof Error) toast.error(err.message)
        else toast.error(t('copyFailed'))
        return
      }

      try {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
        const shareUrl = `${baseUrl}/chat/share/${shareToken}`
        const bodyLines = [plainTextForClipboard(m.content).trimEnd(), '', shareUrl]
        const finalText = bodyLines.join('\n')

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(finalText)
        } else {
          const ta = document.createElement('textarea')
          ta.value = finalText
          ta.setAttribute('readonly', '')
          ta.style.position = 'absolute'
          ta.style.left = '-9999px'
          document.body.appendChild(ta)
          ta.select()
          document.execCommand('copy')
          document.body.removeChild(ta)
        }
        toast.success(t('message.shareLinkCopied'))
      } catch {
        toast.error(t('copyFailed'))
      }
    },
    [m.content, t],
  )

  // 回复(对应原项目 replyToMessage)— 预留事件
  const handleReply = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent('ihui:reply-message', { detail: { messageId: m.id } }))
  }, [m.id])

  // 编辑(2026-09-12 立,四竞品对标 P0-1,替换原 editComingSoon 占位):
  // 打开编辑 Dialog,保存时派发 ihui:edit-message,由 MessageList → editMessageAndRerun 闭环。
  // W16(2026-09-13):若该消息之后有文件修改类工具调用,提供"同时回滚文件改动"选项(对标 Qoder)。
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editDraft, setEditDraft] = React.useState('')
  const [editRollbackFiles, setEditRollbackFiles] = React.useState(true)
  // 该消息之后是否存在已成功的文件修改工具调用(决定是否展示回滚勾选项)。
  // 每次渲染直接计算(开销极小):编辑 Dialog 打开 / 消息列表变化时自然取到最新值
  const hasFileChangesAfter = ((): boolean => {
    const all = useChatStore.getState().messages
    const idx = all.findIndex((mm) => mm.id === m.id)
    if (idx === -1) return false
    return all
      .slice(idx + 1)
      .some((mm) =>
        mm.toolCalls?.some((tc) => FILE_MODIFY_TOOLS.has(tc.toolName) && tc.status === 'success'),
      )
  })()
  const handleEdit = React.useCallback(() => {
    if (isStreaming) return
    setEditDraft(m.content)
    setEditRollbackFiles(true)
    setEditDialogOpen(true)
  }, [m.content, isStreaming])
  // 保存并重跑:派发编辑事件,关闭 Dialog;由 MessageList 监听后走 editMessageAndRerun 闭环
  const handleEditSave = React.useCallback(() => {
    const text = editDraft.trim()
    if (!text || text === m.content || isStreaming) return
    window.dispatchEvent(
      new CustomEvent('ihui:edit-message', {
        detail: {
          messageId: m.id,
          content: text,
          // W16:勾选时编辑重跑前先回滚该消息之后产生的文件改动
          rollbackFiles: hasFileChangesAfter && editRollbackFiles,
        },
      }),
    )
    setEditDialogOpen(false)
    setEditDraft('')
  }, [editDraft, m.content, m.id, isStreaming, hasFileChangesAfter, editRollbackFiles])

  // 2026-08-02:补建原项目 AIChat.vue 4 个缺失 AI 消息按钮
  // 1. 内容可见性切换(Eye/EyeOff)— 原项目 toggleAssistantContentVisibility
  const [contentVisible, setContentVisible] = React.useState(true)
  const handleToggleVisibility = React.useCallback(() => {
    setContentVisible((prev) => !prev)
  }, [])

  // 2. 下载图片(Download)— 原项目 downloadAssistantImages
  // 从 toolCalls 提取所有 image_url,触发浏览器下载
  const messageImages = React.useMemo(() => {
    if (!m.toolCalls) return []
    return m.toolCalls
      .map((tc) => tc.image_url)
      .filter((url): url is string => typeof url === 'string' && url.length > 0)
  }, [m.toolCalls])
  const handleDownloadImages = React.useCallback(() => {
    if (messageImages.length === 0) return
    messageImages.forEach((url, idx) => {
      const a = document.createElement('a')
      a.href = url
      a.download = `ai-image-${m.id}-${idx + 1}`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    })
    toast.success(
      t('downloadStarted') === 'downloadStarted' ? 'Download started' : t('downloadStarted'),
    )
  }, [messageImages, m.id, t])

  // 3. 元数据 toggle(Code)— 原项目 toggleMetadata,展开/折叠 usage 细分面板
  const [metadataExpanded, setMetadataExpanded] = React.useState(false)
  const handleToggleMetadata = React.useCallback(() => {
    setMetadataExpanded((prev) => !prev)
  }, [])
  const hasMetadata =
    Boolean(m.meta) && typeof m.meta === 'object' && 'usage' in (m.meta as Record<string, unknown>)

  // 4. 发布到社区(Megaphone)— 原项目 publishToCommunity
  const [publishDialogOpen, setPublishDialogOpen] = React.useState(false)

  // 卸载清理 timer
  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  // 重试(2026-07-28 立,深度对标 AI 工作台):m.error 时气泡底部显示"重试"按钮,
  // 通过 window CustomEvent 'ihui:retry-message' 派发,由 message-input 监听后触发重新发送。
  // 不直接调用 chat store(任务约束),保持组件解耦。
  const handleRetry = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('ihui:retry-message', { detail: { messageId: m.id } }))
      const retryLabel = t('retry') === 'retry' ? 'Retrying…' : t('retry')
      if (retryLabel === 'retry') {
        console.warn('[i18n] Missing translation for key: chat.retry')
      }
      toast.info(retryLabel)
    },
    [m.id, t],
  )

  // Phase 19(2026-07-28 立):反向联动 — hover 消息时同步高亮 plan step,
  // 通过 onMessageHover 回调通知父组件 → ProgressJumpStore.setHoveredPlanStep
  const handleMouseEnter = React.useCallback(() => {
    onMessageHover?.(m.id, linkedPlanStepId)
  }, [onMessageHover, m.id, linkedPlanStepId])
  const handleMouseLeave = React.useCallback(() => {
    onMessageHover?.(m.id, null)
  }, [onMessageHover, m.id])

  // D22(2026-09-19 立,对标 Qoder 0.2.x):圈选 AI 回复入上下文 —
  // selectionchange 监听(仅 assistant 非 error 消息):选区锚点落在本消息内容区内且非空时,
  // 记录选中文本并在消息尾部浮现「引用选中」按钮;点击经 ihui:add-text-reference 事件
  // 投递到 MessageInput(监听方调 useMessageReferences.addTextReference 入引用 chips),
  // 同时清除原生选区。setState 同值时 React 自动 bail out,selectionchange 高频触发无渲染开销。
  const contentAreaRef = React.useRef<HTMLDivElement>(null)
  const [selectionText, setSelectionText] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (isUser || isSystem || m.error) return
    const onSelectionChange = () => {
      const sel = window.getSelection()
      const anchor = sel?.anchorNode ?? null
      if (!sel || sel.isCollapsed || !anchor || !contentAreaRef.current?.contains(anchor)) {
        setSelectionText(null)
        return
      }
      const text = sel.toString().trim()
      setSelectionText(text || null)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    return () => document.removeEventListener('selectionchange', onSelectionChange)
  }, [isUser, isSystem, m.error])
  const handleQuoteSelection = React.useCallback(() => {
    if (!selectionText) return
    window.dispatchEvent(
      new CustomEvent('ihui:add-text-reference', { detail: { text: selectionText } }),
    )
    window.getSelection()?.removeAllRanges()
    setSelectionText(null)
    toast.success(t('quoteSelectionAdded'))
  }, [selectionText, t])

  // 时间戳移到按钮区内部，这里不再常驻计算

  // Copy 按钮 a11y label(优先用 i18n,缺失回退英文)
  const copyLabel = t('copy') === 'copy' ? '复制' : t('copy')
  if (copyLabel === 'copy') {
    console.warn('[i18n] Missing translation for key: chat.message.copy')
  }

  // D22(2026-09-19 立):system 角色独立渲染分支 — 居中灰字只读提示条。
  // 注意:此 early return 位于组件全部 hooks 之后,符合 Rules of Hooks;
  // system 条目不提供 Reply/重试等任何操作(防上下文注入通道,请求侧已同步拒绝)。
  if (isSystem) {
    return (
      <div
        className="mx-auto my-1 max-w-[80%] rounded-md bg-muted/60 px-3 py-1.5 text-center text-xs text-muted-foreground"
        data-message-id={m.id}
        data-role="system"
        data-testid={`message-system-${m.id}`}
      >
        <span className="whitespace-pre-wrap break-words">{m.content}</span>
      </div>
    )
  }

  // D79 接线(此前 TypingIndicator 只传 reasoning/toolCalls ⇒ 生产恒走固定串 "等待响应…"):
  // 对话流的等待对象就是智能体 ⇒ quadrant=agent;阶段按"本条之前是否已有用户消息"分首轮/追问;
  // seed 取"最近一条用户输入长度 + 4s 时间桶"⇒ 同一次等待内稳定(不 flicker、不与读屏 announcer 抢播报),
  // 跨轮/跨等待期会轮换。缺省语义由 parts 组件兜底(不传即回退固定串),故这里只在要显示时算。
  const typingTurn = showTyping
    ? (() => {
        const all = useChatStore.getState().messages
        const mine = all.findIndex((x) => x.id === m.id)
        const before = mine < 0 ? all : all.slice(0, mine)
        const priorUser = before.filter((x) => x.role === 'user')
        const lastUser = priorUser[priorUser.length - 1]
        return {
          phase: (priorUser.length === 0 ? 'first' : 'followup') as 'first' | 'followup',
          seed: (lastUser?.content ?? '').length + Math.floor(Date.now() / 4000),
        }
      })()
    : null

  return (
    <div
      className={cn(
        'group/msg relative flex w-full flex-col gap-1 px-1',
        isUser ? 'items-end' : 'items-start',
        isHighlighted && 'ring-1 ring-ring/30 animate-message-highlight-pulse',
        // Phase 23: 搜索匹配高亮(当前匹配 ring-2 优先于普通匹配 ring-1)
        isSearchMatch && !isSearchCurrent && 'ring-1 ring-yellow-400/40',
        isSearchCurrent && 'ring-2 ring-yellow-400',
      )}
      data-message-id={m.id}
      data-message-focused={isFocused ? 'true' : 'false'}
      data-search-match={isSearchMatch ? 'true' : 'false'}
      data-search-current={isSearchCurrent ? 'true' : 'false'}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 2026-08-02:用户消息保留气泡(rounded-lg),AI 消息无气泡平铺 */}
      {/* 2026-08-06:用户消息气泡 bg-primary → bg-muted + text-foreground(亮色浅灰黑字/暗色深灰白字,降低视觉突兀感) */}
      {/* 2026-08-06:AI 消息 w-full 占满可用宽度 —— 原 max-w-[85%] 导致右侧 15% 留白、
          表格(如架构表)被压缩到 85% 内显示不全;表格自身 overflow-x-auto 已保证超宽可横滚 */}
      <div
        className={cn(
          isUser
            ? 'relative max-w-[85%] rounded-lg rounded-br-sm bg-muted px-4 py-2.5 text-foreground'
            : 'w-full text-left',
        )}
      >
        {showTyping ? (
          // P0 修复(2026-08-02):TypingIndicator 加 fade-in,流式开始时平滑出现;
          // 内容区(下方 div)也加 fade-in,第一个 token 到达时平滑替换 TypingIndicator,
          <div className="animate-in fade-in-0 duration-(--duration-unified) ease-unified fill-mode-both">
            <TypingIndicator
              reasoning={m.reasoning}
              toolCalls={m.toolCalls}
              waitQuadrant={typingTurn ? 'agent' : undefined}
              waitPhase={typingTurn?.phase}
              waitSeed={typingTurn?.seed}
            />
          </div>
        ) : m.error ? (
          // D22(2026-09-19 立):error 独立消息类型渲染 — 红色边框错误卡片(替代原纯红文本),
          // 头部警示图标 + 独立标题,正文纯文本(剥离 shared 层附加的 ⚠ 前缀),
          // 重试按钮内聚卡片底部(原气泡外置 retry 按钮随本次改造移除)。
          <div
            className="w-full overflow-hidden rounded-lg border border-destructive/40 bg-destructive/5"
            data-testid={`message-error-card-${m.id}`}
          >
            <div className="flex items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {/* D92(2026-09-24 接线):有后端业务错误码时按**统一分类表**取标题/建议动作
                  (`@ihui/shared/utils/view-failure-taxonomy`,与 MCP 面板同一张表,不另起);
                  分类不到(unknown)时保留原 `chat.errorCardTitle` 笼统标题 —— 回落态不得
                  把"未判定"包装成确定性结论。 */}
              <span className="text-xs font-medium">{errorCardTitle}</span>
            </div>
            <p className="whitespace-pre-wrap break-words px-3 py-2 text-sm text-destructive/90">
              {m.content.replace(/^⚠\s*/, '')}
            </p>
            {errorViewFailure && (
              <>
                {errorCodeText && (
                  <div
                    className="break-all px-3 pb-1 font-mono text-[11px] text-muted-foreground tabular-nums"
                    data-testid={`message-error-code-${m.id}`}
                  >
                    {tFailure(VIEW_FAILURE_ERROR_CODE_KEY, { errorCode: errorCodeText })}
                  </div>
                )}
                <p
                  className="px-3 pb-1 text-xs leading-relaxed text-muted-foreground"
                  data-testid={`message-error-action-${m.id}`}
                >
                  {tFailure(errorViewFailure.entry.actionKey)}
                </p>
              </>
            )}
            <div className="px-3 pb-2 pt-0.5">
              <button
                type="button"
                onClick={handleRetry}
                data-testid={`message-retry-${m.id}`}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                <span>{t('retry') === 'retry' ? 'Retry' : t('retry')}</span>
              </button>
            </div>
            {/* D60(2026-09-23):输入正文已存 store.failedDraft → 明示"草稿已保留,可重发"。
                archived/deleted 终态文案不含重发承诺(resolvePersistTexts 逐态给词),不误导。 */}
            {failedDraft !== null && (
              <p
                className="px-3 pb-2 text-xs text-muted-foreground"
                data-testid={`message-draft-preserved-${m.id}`}
              >
                {resolvePersistTexts(failedDraftStatus ?? 'failed_retryable').title}
              </p>
            )}
          </div>
        ) : isUser ? (
          // 2026-08-02:用户消息字号同步调整 14px → 15px(text-[15px]),与 AI 消息对齐
          <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.content}</p>
        ) : (
          <div
            ref={contentAreaRef}
            className={cn(
              'space-y-0 animate-in fade-in-0 duration-(--duration-unified) ease-unified fill-mode-both',
              // 2026-08-02:内容可见性切换(Eye/EyeOff)— 折叠时限高,仅显示前几行
              !contentVisible && 'max-h-20 overflow-hidden',
            )}
          >
            {/* 2026-09-19 立:上下文压缩分隔线 — 本消息生成前发生了上下文压缩
                (compaction 命名帧 → onCompaction → store setMessageCompaction 写入),
                置于消息内容区顶部(思考区之前),提示"上方历史已压缩为摘要"。 */}
            {m.compaction && <CompressionDivider compaction={m.compaction} />}
            {(m.reasoning || refsThinkingCardEligible) && (
              <ThinkingSection
                content={m.reasoning ?? ''}
                currentNode={null}
                // 2026-08-29:isStreaming 收紧为"思考进行中" — 正文开始输出后思考区
                // 立即进入已完成态(停掉"思考中..."loader / 闪烁光标 / 耗时 tick)
                isStreaming={streamingThis && !m.content}
                // 2026-08-29:正文流式期间 reasoning 交错到达 → 增长指示(脉冲光标)
                isGrowing={reasoningGrowing}
                // D64③:标题双态判定在共享层(有思考→"思考过程" / 无思考有引用→"使用了 N 个引用")
                refsCount={citationsCount}
                refsSlot={
                  refsRenderedInsideThinkingCard ? (
                    <CitationBar citations={m.citations ?? []} />
                  ) : undefined
                }
                expanded={reasoningExpanded}
                onToggle={toggleReasoning}
              />
            )}
            {/* 2026-09-13 批次 2 #17:折叠中间步骤(工具卡 + plan 步骤 + 终端任务)
                初始态由折叠策略驱动(D21,2026-09-19 立),点击组头「N 个步骤」展开后显示完整内容
                2026-09-14 修正:gate 由"仅 toolCalls"改为四类区段总数(见 stepSectionsCount)
                D21:key={foldPolicyMode} — 配置变更时重挂载,动画状态与新初始态一致 */}
            {stepSectionsCount > 0 && (
              <StreamGroup
                key={foldPolicyMode}
                active={streamingThis}
                stepCount={stepSectionsCount}
                headline={stepsHeadline}
                elapsedMs={typeof m.meta?.durationMs === 'number' ? m.meta.durationMs : null}
                open={showSteps}
                onOpenChange={setShowSteps}
                testId={`message-steps-group-${m.id}`}
                className="mt-1"
              >
                <div className="ml-[7px] space-y-1 pl-3">
                  {/* #14 批量 Accept/Reject 按钮条(2026-09-13 立):
                      仅当消息含 ≥2 个 diff 卡且已注册批量回调时显示;左侧聚合徽章展示应用进度 */}
                  {diffStats.total >= 2 && (onApplyAllDiffs || onRejectAllDiffs) && (
                    <div
                      className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-1.5"
                      data-testid={`batch-diff-bar-${m.id}`}
                    >
                      <span className="text-xs text-muted-foreground">
                        {diffStats.applying
                          ? t('batchDiff.applying')
                          : diffStats.pending === 0
                            ? t('batchDiff.done', {
                                applied: diffStats.applied,
                                rejected: diffStats.rejected,
                              })
                            : t('batchDiff.pendingCount', {
                                count: diffStats.pending,
                                total: diffStats.total,
                              })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onApplyAllDiffs && diffStats.pending > 0 && !diffStats.applying && (
                          <Button
                            size="xs"
                            className="px-2 text-xs"
                            onClick={() => void onApplyAllDiffs(m.id)}
                            data-testid={`batch-diff-accept-all-${m.id}`}
                          >
                            <CheckCheck className="mr-1 h-3.5 w-3.5" />
                            {t('batchDiff.acceptAll')}
                          </Button>
                        )}
                        {onRejectAllDiffs && diffStats.pending > 0 && !diffStats.applying && (
                          <Button
                            size="xs"
                            variant="outline"
                            className="px-2 text-xs"
                            onClick={() => onRejectAllDiffs(m.id)}
                            data-testid={`batch-diff-reject-all-${m.id}`}
                          >
                            <Ban className="mr-1 h-3.5 w-3.5" />
                            {t('batchDiff.rejectAll')}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  {m.toolCalls?.map((tc) => {
                    // edit_file/write_file:为 Accept/Reject 回调构造 diffInfo
                    // 优先用 store 中的 tc.diffInfo,否则从 args 推导(与 ToolCallCard 内部逻辑一致)
                    const effectiveDiffInfo =
                      tc.diffInfo ??
                      deriveDiffInfo(tc.toolName, tc.args, tTool('toolUnknownFile')) ??
                      undefined
                    const hasDiff = !!effectiveDiffInfo

                    // image_generation/summarize_artifacts:从 tc 显式字段或 result 推导 imageUrl/summaryData
                    // 优先用 tc.image_url / tc.summary_data(SSE 推送已填充时),
                    // 否则从 tc.result 兜底推导(适配旧后端不显式推 image_url 字段的场景)
                    const tcResult =
                      tc.result && typeof tc.result === 'object'
                        ? (tc.result as Record<string, unknown>)
                        : null
                    const effectiveImageUrl: string | undefined =
                      tc.image_url ||
                      (typeof tcResult?.image_url === 'string' ? tcResult.image_url : undefined) ||
                      (typeof tcResult?.imageUrl === 'string' ? tcResult.imageUrl : undefined)
                    // music_generation/video_generation:从 result 兜底推导播放地址
                    // (完成后 result 顶层含 audio_url/video_url;未完成时无 URL 走通用 result 展示)
                    const effectiveAudioUrl: string | undefined =
                      (typeof tcResult?.audio_url === 'string' ? tcResult.audio_url : undefined) ||
                      (typeof tcResult?.audioUrl === 'string' ? tcResult.audioUrl : undefined)
                    const effectiveVideoUrl: string | undefined =
                      (typeof tcResult?.video_url === 'string' ? tcResult.video_url : undefined) ||
                      (typeof tcResult?.videoUrl === 'string' ? tcResult.videoUrl : undefined)
                    // 2026-09-09 长任务 task_id:后端 SSE tool-result 顶层扁平化已填充 tc.task_id,
                    // 无 URL 时透传给 ToolCallCard 渲染"任务进行中"状态
                    const effectiveTaskId: string | undefined =
                      tc.task_id ||
                      (typeof tcResult?.task_id === 'string' ? tcResult.task_id : undefined)
                    const effectiveSummaryData =
                      tc.summary_data ??
                      (tcResult &&
                      (tcResult.plans ||
                        tcResult.sources ||
                        tcResult.artifacts ||
                        tcResult.tool_calls_summary)
                        ? ({
                            plans: Array.isArray(tcResult.plans) ? tcResult.plans : undefined,
                            sources: Array.isArray(tcResult.sources) ? tcResult.sources : undefined,
                            artifacts: Array.isArray(tcResult.artifacts)
                              ? tcResult.artifacts
                              : undefined,
                            tool_calls_summary:
                              tcResult.tool_calls_summary &&
                              typeof tcResult.tool_calls_summary === 'object'
                                ? tcResult.tool_calls_summary
                                : undefined,
                          } as unknown as React.ComponentProps<typeof ToolCallCard>['summaryData'])
                        : undefined)

                    // 内联 content 型 artifact(html/css/js 等)→ Artifact 画布渲染对象
                    const effectiveArtifacts: Artifact[] | undefined =
                      tcResult && Array.isArray(tcResult.artifacts)
                        ? (tcResult.artifacts as Array<Record<string, unknown>>).map((a) => ({
                            type: typeof a.type === 'string' ? a.type : undefined,
                            content: typeof a.content === 'string' ? a.content : undefined,
                            path: typeof a.path === 'string' ? a.path : undefined,
                            name: typeof a.name === 'string' ? a.name : undefined,
                            created_at: typeof a.created_at === 'string' ? a.created_at : undefined,
                          }))
                        : undefined

                    return (
                      <React.Fragment key={tc.id}>
                        <ToolCallCard
                          toolName={tc.toolName}
                          args={tc.args}
                          result={tc.result}
                          status={tc.status}
                          duration={tc.duration ?? tc.durationMs}
                          error={tc.error}
                          iteration={tc.iteration}
                          toolCallId={tc.id}
                          diffInfo={tc.diffInfo}
                          applyStatus={tc.applyStatus}
                          applyError={tc.applyError}
                          repeated={tc.repeated}
                          retryCount={tc.retryCount}
                          imageUrl={effectiveImageUrl}
                          audioUrl={effectiveAudioUrl}
                          videoUrl={effectiveVideoUrl}
                          taskId={effectiveTaskId}
                          summaryData={effectiveSummaryData}
                          serverSource={tc.serverSource}
                          serverId={tc.serverId}
                          serverName={tc.serverName}
                          onApply={
                            hasDiff && onApplyDiff
                              ? () => onApplyDiff(m.id, tc.id, effectiveDiffInfo!)
                              : undefined
                          }
                          onReject={
                            hasDiff && onRejectDiff ? () => onRejectDiff(m.id, tc.id) : undefined
                          }
                          onApplyPartial={
                            hasDiff && onApplyPartialDiff
                              ? (newContent) =>
                                  onApplyPartialDiff(m.id, tc.id, effectiveDiffInfo!, newContent)
                              : undefined
                          }
                        />
                        {/* 内联 content 型 artifact:HTML 走沙箱 iframe 预览,代码型走代码视图 */}
                        {effectiveArtifacts?.map((art, i) => (
                          <ArtifactCanvas
                            key={`${tc.id}-${i}`}
                            artifact={art}
                            turnMessageId={m.id}
                          />
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {/* 2026-07-31 立,AI 对话可视化深度接入:工具调用汇总卡片 inline 到 AI 回复末尾 */}
                  <ToolCallSummaryCard
                    summary={m.toolCallSummary}
                    toolCalls={m.toolCalls}
                    isStreaming={streamingThis}
                    data-testid={`message-tool-call-summary-${m.id}`}
                  />
                  {/* 2026-08-01 Phase 4b/4c/4d:消息级 subagent/terminal/plan inline 到消息气泡 */}
                  {m.subagentActivities && m.subagentActivities.length > 0 && (
                    <SubAgentActivityFeed
                      swarmId={m.id}
                      activities={m.subagentActivities}
                      completed={!streamingThis}
                    />
                  )}
                  {/* W1(2026-09-12 立):终端区外层套一层纯定位容器 */}
                  {m.terminalTasks && m.terminalTasks.length > 0 && (
                    <div data-testid={`message-terminal-${m.id}`}>
                      <TerminalSection terminals={m.terminalTasks} />
                    </div>
                  )}
                  {m.planSteps && m.planSteps.length > 0 && (
                    <PlanStepsCard
                      steps={m.planSteps}
                      isStreaming={streamingThis}
                      data-testid={`message-plan-steps-${m.id}`}
                    />
                  )}
                </div>
              </StreamGroup>
            )}
            <ReplyAnnotationLayer messageId={m.id} conversationId={conversationId}>
              <MarkdownStream
                content={m.content}
                isStreaming={streamingThis}
                collapseLines={codeCollapseLines}
              />
            </ReplyAnnotationLayer>
            {/* D33 消息级降级交代行:顶部 FallbackBanner 是瞬态,历史态由水合把 metadata.fallback
                挂到消息上(见 stores/chat.ts 的 fallback 字段注释),词与横幅同源(chat ns 既有两键)。 */}
            {!isUser && m.fallback && (
              <p
                data-testid={`message-fallback-${m.id}`}
                className="px-3 pb-1 text-xs text-muted-foreground"
              >
                {m.fallback.reason === FALLBACK_REASON_QUOTA_EQUIVALENT
                  ? t('fallbackNoticeQuota', {
                      primary: m.fallback.primaryModel,
                      backup: m.fallback.backupModel,
                    })
                  : t('fallbackNotice', {
                      primary: m.fallback.primaryModel,
                      backup: m.fallback.backupModel,
                    })}
              </p>
            )}
            {/* #11 Citations 全链路(2026-09-13 立):引用溯源条 inline 到消息正文下方。
                D64③ 起:无思考时该条已收进思考卡(同一集合只呈现一次),故此处让位。 */}
            {!refsRenderedInsideThinkingCard && m.citations && m.citations.length > 0 && (
              <CitationBar citations={m.citations} />
            )}
            {/* D34 上下文注入交代(2026-09-22 立) + D37 聚合装配查看器(2026-09-24 立):
                聚合条默认收起(计数徽章,与 D21 fold-policy 联动),点击展开逐条 kind
                本地化交代 + fullText 可展开,收编原 InjectionBar 的散列单条渲染 */}
            {m.injections && m.injections.length > 0 && (
              <ContextAssemblyBar injections={m.injections} />
            )}
            {/* D39/D108 上游重试交代:换 key / 退避重试时给一行"第 N/M 次重试,X 秒后继续" */}
            {m.retryNotice && <RetryNotice notice={m.retryNotice} />}
            {/* P1 #27 记忆更新可视化(2026-09-16 立):本轮新增长期记忆「已记住」提示条。
                数据来自 done 事件 memoryUpdates(store 旁路,不落 ChatMessage 字段),
                每轮限 1 条摘要 + 计数 + 管理入口。 */}
            {memoryNoticeItems && memoryNoticeItems.length > 0 && (
              <MemoryNoticeBar items={memoryNoticeItems} />
            )}
            {/* Steer(中途引导,2026-09-19 立):流式期间用户注入的引导记录提示条。
                数据来自 SSE steer 事件回执(tool loop 边界已生效确认,store 旁路,
                不落 ChatMessage 字段),展开可回看每条引导文本预览。 */}
            {steerNotices && steerNotices.length > 0 && <SteerNoticeBar notices={steerNotices} />}
            {/* P3 #36 多模型并排对比(2026-09-16 立):/bestof 的 assistant 消息按
                meta.bestOfRunId 关联结果,消息流内直接渲染并排对比卡(可改选/落盘),
                不再只能切到工具面板查看;刷新后 store 映射仍在,历史消息可回看。 */}
            {!isStreaming && typeof m.meta?.bestOfRunId === 'string' && (
              <BestOfCompare
                runId={m.meta.bestOfRunId}
                onAdopt={(content) => {
                  useChatStore.getState().addMessage({
                    role: 'assistant',
                    content,
                    model: m.model,
                  })
                }}
              />
            )}
            {/* #19 + #20 流结束后:turn 级变更汇总卡 + 文件引用 chip(先卡后 chips) */}
            {!isStreaming && (
              <>
                {/* P3 #39 执行轨迹即文档(2026-09-16 立):toolCalls≥2 时提供时序重演回放
                    (播放/单步/重置,每步停留按真实耗时温和加权),静态工具卡片之外的节奏视角 */}
                {!isStreaming && m.toolCalls && m.toolCalls.length >= 2 && (
                  <TraceReplay toolCalls={m.toolCalls} />
                )}
                <TurnChangesCard message={m} conversationId={conversationId} />
                <MessageFileChips toolCalls={m.toolCalls} />
              </>
            )}
          </div>
        )}
      </div>
      {/* D1 消息级计量徽章行(2026-09-19 立):AI 回复底部紧凑用量,无 usage 数据不渲染 */}
      {!isUser && <MessageUsageMetrics messageId={m.id} fallbackModel={m.model} />}
      {/* 2026-08-02:消息交互按钮区(完全复用原项目 AIChat.vue 9 按钮 + _message-list.scss 样式)
          - 2026-08-06 修正:从气泡容器内挪到气泡外(与气泡容器同级,作为消息项子节点)
            避免被 bg-primary 包裹导致按钮显示在气泡内部
          - opacity:1 始终显示(原项目 _message-list.scss line 199-205)
          - gap:8px(原项目 .message-actions gap:8px)
          - 按钮 28x28px / 6px 圆角 / 16px 图标(原项目 --fcd-btn-size/--fcd-btn-radius/--fcd-btn-icon-size)
          - AI 消息(9按钮): Eye/EyeOff / Like / Copy / Download(条件) / Share / Code(条件) / Regenerate / Megaphone / Reply
          - 用户消息(4按钮): Copy / Edit / Reply / Delete */}
      {!streamingThis && m.content.length > 0 && (
        <div className="msg-hover-reveal flex items-center gap-1">
          {/* 时间戳 — 随按钮一起 hover 显示,所有消息都展示 */}
          {(() => {
            const label = formatMessageTimestamp(m.createdAt) || '--'
            // 2026-09-13 批次 2 #16:消息级运行时长 + 工具调用计数
            const durationMs = m.meta?.durationMs as number | undefined
            const toolCallCount = m.meta?.toolCallCount as number | undefined
            return (
              <span
                className="text-xs text-muted-foreground shrink-0 mr-auto flex items-center gap-1"
                data-testid={`message-timestamp-${m.id}`}
              >
                <span>{label}</span>
                {durationMs !== undefined && durationMs > 0 && (
                  <span className="text-muted-foreground/70">· {formatDuration(durationMs)}</span>
                )}
                {toolCallCount !== undefined && toolCallCount > 0 && (
                  <span className="text-muted-foreground/70">
                    · {tStream('toolCallCount', { n: toolCallCount })}
                  </span>
                )}
                {/* W12(2026-09-13 立):AI 消息 token/成本内联徽章 `· 1.2k tok · ¥0.0034` */}
                {!isUser && (
                  <MessageUsageBadge usage={m.meta?.usage} model={m.model} messageId={m.id} />
                )}
              </span>
            )
          })()}
          <div className="flex items-center gap-1" data-testid={`message-actions-${m.id}`}>
            {/* AI 消息:Eye/EyeOff(内容可见性切换)— 原项目 toggleAssistantContentVisibility */}
            {!isUser && (
              <Tooltip
                content={contentVisible ? t('message.hideContent') : t('message.showContent')}
              >
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  data-testid={`message-visibility-${m.id}`}
                  aria-label={contentVisible ? t('message.hideContent') : t('message.showContent')}
                  className={ACTION_BTN_CLASS}
                >
                  {contentVisible ? (
                    <Eye className="h-4 w-4" aria-hidden />
                  ) : (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </Tooltip>
            )}
            {/* Copy(复制)— AI + 用户,原项目 copyMessage */}
            <Tooltip content={copyLabel} side="top">
              <button
                type="button"
                onClick={handleCopy}
                data-testid={`message-copy-${m.id}`}
                aria-label={copyLabel}
                className={ACTION_BTN_CLASS}
              >
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
              </button>
            </Tooltip>
            {/* AI 消息:朗读(TTS)/停止朗读 — 走 ai-service /api/voice/tts */}
            {!isUser && (
              <Tooltip
                content={speaking ? t('message.stopReadAloud') : t('message.readAloud')}
                side="top"
              >
                <button
                  type="button"
                  onClick={() => (speaking ? stop() : void speak(m.content))}
                  disabled={streamingThis}
                  data-testid={`message-read-aloud-${m.id}`}
                  aria-label={speaking ? t('message.stopReadAloud') : t('message.readAloud')}
                  className={cn(
                    ACTION_BTN_CLASS,
                    speaking && 'text-primary bg-muted/60',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  {speaking ? (
                    <Square className="h-4 w-4" aria-hidden />
                  ) : (
                    <Volume2 className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Download(下载图片)— 原项目 downloadAssistantImages,有图片时显示 */}
            {!isUser && messageImages.length > 0 && (
              <Tooltip content={t('message.downloadImages')} side="top">
                <button
                  type="button"
                  onClick={handleDownloadImages}
                  data-testid={`message-download-${m.id}`}
                  aria-label={t('message.downloadImages')}
                  className={ACTION_BTN_CLASS}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Share(分享)— 原项目 shareAssistantMessage */}
            {!isUser && (
              <Tooltip content={t('message.share')} side="top">
                <button
                  type="button"
                  onClick={handleShare}
                  data-testid={`message-share-${m.id}`}
                  aria-label={t('message.share')}
                  className={ACTION_BTN_CLASS}
                >
                  <Share2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Code(元数据 toggle)— 原项目 toggleMetadata,有 metadata 时显示 */}
            {!isUser && hasMetadata && (
              <Tooltip content={t('message.toggleMetadata')} side="top">
                <button
                  type="button"
                  onClick={handleToggleMetadata}
                  data-testid={`message-metadata-${m.id}`}
                  aria-label={t('message.toggleMetadata')}
                  className={cn(ACTION_BTN_CLASS, metadataExpanded && 'text-primary bg-muted/60')}
                >
                  <Code className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Regenerate(重新生成)— 原项目 regenerateMessage,streaming 时禁用 */}
            {!isUser && (
              <Tooltip content={t('message.regenerate')} side="top">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={streamingThis}
                  data-testid={`message-regenerate-${m.id}`}
                  aria-label={t('message.regenerate')}
                  className={cn(
                    ACTION_BTN_CLASS,
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Rewind(回退到此处)— 2026-09-12 立,修复 D9:接入 Checkpoint/Rewind 面板。
                无会话 id 时禁用;点击后打开面板,由面板自行加载 checkpoint 列表(空态不报错)。 */}
            {!isUser && (
              <Tooltip content={tAiChat('checkpoint.rewindHere')} side="top">
                <button
                  type="button"
                  onClick={() => setRewindDialogOpen(true)}
                  disabled={!conversationId}
                  data-testid={`message-rewind-${m.id}`}
                  aria-label={tAiChat('checkpoint.rewindHere')}
                  className={cn(
                    ACTION_BTN_CLASS,
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* AI 消息:Megaphone(发布到社区)— 原项目 publishToCommunity,Promotion 图标不在 lucide-react 用 Megaphone 替代 */}
            {!isUser && (
              <Tooltip content={t('message.publishToCommunity')} side="top">
                <button
                  type="button"
                  onClick={() => setPublishDialogOpen(true)}
                  data-testid={`message-publish-${m.id}`}
                  aria-label={t('message.publishToCommunity')}
                  className={ACTION_BTN_CLASS}
                >
                  <Megaphone className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* 用户消息:Edit(编辑)— 2026-09-12 立,四竞品对标 P0-1,打开编辑 Dialog(保存后从该条重跑) */}
            {isUser && (
              <Tooltip content={t('message.edit')} side="top">
                <button
                  type="button"
                  onClick={handleEdit}
                  disabled={isStreaming}
                  data-testid={`message-edit-${m.id}`}
                  aria-label={t('message.edit')}
                  className={cn(
                    ACTION_BTN_CLASS,
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
            {/* Reply(回复)— AI + 用户,原项目 replyToMessage */}
            <Tooltip content={t('message.reply')} side="top">
              <button
                type="button"
                onClick={handleReply}
                data-testid={`message-reply-${m.id}`}
                aria-label={t('message.reply')}
                className={ACTION_BTN_CLASS}
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
              </button>
            </Tooltip>
            {/* 用户消息:Delete(删除)— 原项目 deleteMessage,hover 红色 */}
            {isUser && (
              <Tooltip content={t('message.delete')} side="top">
                <button
                  type="button"
                  onClick={handleDelete}
                  data-testid={`message-delete-${m.id}`}
                  aria-label={t('message.delete')}
                  className={cn(ACTION_BTN_CLASS, 'hover:text-destructive hover:bg-destructive/10')}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      )}
      {/* AI 消息:元数据展开面板(Code 按钮切换)— 原项目 metadata 详情
            展示 promptTokens / completionTokens / totalTokens 细分 */}
      {!isUser && hasMetadata && metadataExpanded && (
        <div
          className="mt-1.5 rounded-md border border-border bg-muted/30 p-2 text-xs"
          data-testid={`message-metadata-panel-${m.id}`}
        >
          <UsageBreakdown usage={m.meta?.usage} model={m.model} />
        </div>
      )}

      {/* D22(2026-09-19 立):圈选 AI 回复入上下文 — 选中本消息文本后在尾部浮现
            「引用选中」按钮,点击把选中文本投递到输入区引用 chips(useMessageReferences)。
            置于操作按钮区之前,与 hover 操作栏解耦(选区操作时鼠标不在 hover 态也能点到)。 */}
      {!isUser && !m.error && selectionText && (
        <button
          type="button"
          onClick={handleQuoteSelection}
          data-testid={`message-quote-selection-${m.id}`}
          className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Quote className="h-3 w-3" aria-hidden />
          <span>{t('quoteSelection')}</span>
        </button>
      )}

      {/* 2026-08-02:社区发布对话框(Megaphone 按钮触发)— 原项目 publishToCommunity */}
      {!isUser && (
        <CommunityPublishDialog
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
          content={plainTextForClipboard(m.content)}
          images={messageImages}
        />
      )}
      {/* 2026-09-12 立(修复 D9):Checkpoint/Rewind 面板(RotateCcw 按钮触发)。
          面板为纯内容组件 + 自带网络调用,故用项目既有 Dialog 包裹;无 checkpoint 时面板显示空态。 */}
      {!isUser && (
        <Dialog open={rewindDialogOpen} onOpenChange={setRewindDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{tAiChat('checkpoint.title')}</DialogTitle>
            </DialogHeader>
            <CheckpointRewindPanel sessionId={conversationId ?? ''} />
          </DialogContent>
        </Dialog>
      )}
      {/* 2026-09-12 立(四竞品对标 P0-1):消息编辑 Dialog(Edit 按钮触发)。
          保存并重跑 → 派发 ihui:edit-message → MessageList → editMessageAndRerun:
          后端事务更新用户消息内容 + 删除其后消息,前端截断后以新内容流式重跑。 */}
      {isUser && (
        <Dialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setEditDraft('')
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('message.edit')}</DialogTitle>
            </DialogHeader>
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              onKeyDown={(e) => {
                // Ctrl/Cmd+Enter 快捷保存;Escape 由 Dialog 默认关闭行为处理
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  handleEditSave()
                }
              }}
              rows={5}
              data-testid={`message-edit-textarea-${m.id}`}
              className={cn(
                'w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm',
                'text-foreground placeholder:text-muted-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              )}
              placeholder={t('message.edit')}
            />
            {/* W16(2026-09-13):编辑重跑可选文件回滚(对标 Qoder)。
                仅当该消息之后存在已成功的文件修改工具调用时展示,默认勾选。 */}
            {hasFileChangesAfter && (
              <label
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                data-testid={`message-edit-rollback-${m.id}`}
              >
                <input
                  type="checkbox"
                  checked={editRollbackFiles}
                  onChange={(e) => setEditRollbackFiles(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                  data-testid={`message-edit-rollback-checkbox-${m.id}`}
                />
                {t('message.editRollbackFiles')}
              </label>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                data-testid={`message-edit-cancel-${m.id}`}
              >
                {t('cancel')}
              </Button>
              <Button
                size="sm"
                disabled={!editDraft.trim() || editDraft.trim() === m.content || isStreaming}
                onClick={handleEditSave}
                data-testid={`message-edit-save-${m.id}`}
              >
                {t('message.editAndRerun')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
})

export { MessageItem }
export type { MessageItemProps }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
