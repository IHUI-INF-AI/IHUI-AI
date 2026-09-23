// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Send, Square, Info, Zap, MessageCircle, X, Wand2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceToolbar } from './voice-toolbar'
import { readHandsFree } from '@/components/chat/voice-stream-speaker'
import { ModelSelector } from '@/components/chat/model-selector'
import { ContextUsageRing } from '@/components/ai/context-usage-ring'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { SelectedToolsPanel, type SelectedToolItem } from '@/components/chat/selected-tools-panel'
import { MentionChips } from '@/components/chat/mention-popover'
import { WebInputCore, MAX_LENGTH, type WebInputCoreHandle } from './web-input-core'
import {
  PermissionModePopover,
  isHighRiskPermissionMode,
} from '@/components/ai/permission-mode-popover'
import { PermissionShortcutsModal } from '@/components/ai/permission-shortcuts-modal'
import { PermissionModeInfoModal } from '@/components/ai/permission-mode-info-modal'
import { PermissionHistoryPanel } from '@/components/ai/permission-history-panel'
import { AgentProgressTrigger } from '@/components/ai/agent-progress-trigger'
import { ModeSwitcher } from '@/components/chat/mode-switcher'
import { SamplingParamsButton } from '@/components/chat/sampling-params-panel'
import { FullAccessConfirmBridge } from '@/components/chat/full-access-confirm-bridge'
import { HighRiskWarningBanner } from '@/components/chat/high-risk-warning-banner'
// P3 #30(2026-09-16 立):待发送 diff 评审意见提示条(输入框上方常驻提示 + 一键清空)
import { DiffCommentsBar } from '@/components/chat/diff-comments-bar'
// 任务进度常驻状态条:输入框上方动态显示"在做什么 / 第几步 / 改了多少文件",plan_updated 驱动
import { TaskStatusBar } from '@/components/ai/task-status-bar'
import { AddMenuPopover } from '@/components/chat/add-menu-popover'
import { INPUT_ATTACHMENT_BAR_CLASS } from '@/lib/nav-styles'
import { usePermissionAutoRevert, formatRemaining } from '@/hooks/use-permission-auto-revert'
import { useSlashCommands } from '@/hooks/use-slash-commands'
import { usePermissionModeCycle } from '@/hooks/use-permission-mode-cycle'
import { useSlashAction } from '@/hooks/use-slash-action'
import { useMessageReferences } from '@/hooks/use-message-references'
import { useContextSelector, type ContextSelectorCategory } from '@/hooks/use-context-selector'
import {
  ContextSelectorPopover,
  ContextSelectorChips,
} from '@/components/ai/context-selector-popover'
import { useAgentMdReference, AGENT_REF_PREFIX } from '@/hooks/use-agent-md-reference'
import { useMessageSend } from '@/hooks/use-message-send'
import { usePromptHistory } from '@/hooks/use-prompt-history'
import { useMentionFiles, useAiSkills } from '@/hooks/use-lazy-resource-hooks'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import { Tooltip } from '@/components/feedback'
import { toast } from '@/components/common'
import { useChatStore, type SideQueueItem } from '@/stores/chat'
import { answerSideQuestion } from '@/hooks/use-chat/slash-commands'
import { useAiPanelStore } from '@/stores/ai-panel'
import { compactConversation, getMessages } from '@ihui/api-client'
import { MARKET_PLUGINS, PROJECT_PLUGINS, getPluginIntegration } from '@plugins-data'
import { AiSkillInvokeDialog, AiSkillResultDialog } from '@/components/chat/skill-library'
import type { AiSkillMeta, AiSkillInvokeResponse } from '@ihui/api-client/endpoints/ai-skills'
import { permissionTierText } from '@/lib/permission-tier-text'
// 权限档取词(G-166):档位归一与词表键的共享真相源,见 packages/shared/src/chat/permission-tier.ts
// D82 就地润色与失败保稿(G-95):单次生成复用既有 /api/best-of-n/run 通道
// (与 /btw、/side、/commit 同一条 REST),提示词复用既有 /polish 命令文案(`chat.cmdPolish`),
// **不新建提示词栈**;状态迁移一律走共享判定层。
import { runBestOfN } from '@/api/best-of-api'
import {
  applyPolishResult,
  beginPolish,
  canRetry,
  canStartPolish,
  createPolishState,
  polishPhaseKey,
  type PolishPhase,
  type PolishRejection,
  type PromptPolishState,
} from '@ihui/shared/chat/prompt-polish'

/** D82:从失败对象里取「需重启生效」原因码。后端未给则 null —— **不臆造**重启提示。 */
function polishRestartReasonOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : null
}

export interface PromptPolishEntryProps {
  /** 判定层状态(草稿 = 当前输入框内容);空 / 纯空白草稿时入口禁用(canStartPolish 同源) */
  state: PromptPolishState
  /** 外部禁用(如流式生成中) */
  disabled?: boolean
  onPolish: () => void
}

/**
 * D82 润色入口按钮(工具栏)。
 * 判定与取词都走共享层 / 词包:`disabled` 由 `canStartPolish(state.draft)` 决定,
 * 文案走 `ai.pane.promptPolish.*`,**不硬编码中文**。
 */
export function PromptPolishEntry({ state, disabled, onPolish }: PromptPolishEntryProps) {
  const t = useTranslations('ai.pane.promptPolish')
  // next-intl 要求静态键字面量:四相位集中映射一次,与判定层 polishPhaseKey 同源
  const phaseLabel: Record<PolishPhase, string> = {
    idle: t('phase.idle'),
    polishing: t('phase.polishing'),
    succeeded: t('phase.succeeded'),
    failed: t('phase.failed'),
  }
  const busy = state.phase === 'polishing'
  const emptyDraft = !canStartPolish(state.draft)
  return (
    <button
      type="button"
      data-testid="prompt-polish-entry"
      data-polish-phase={state.phase}
      data-polish-key={polishPhaseKey(state.phase)}
      data-polish-disabled-reason={emptyDraft ? 'emptyDraft' : 'none'}
      disabled={disabled === true || busy || emptyDraft}
      onClick={onPolish}
      aria-label={t('ariaLabel')}
      title={`${t('entryLabel')} · ${phaseLabel[state.phase]}`}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{t('entryLabel')}</span>
    </button>
  )
}

export interface PromptPolishNoticeProps {
  state: PromptPolishState
  onRetry: () => void
}

/**
 * D82 保稿提示条(输入卡上方,无内容时返回 null 零占位)。
 * - 失败:`failureDraftKept`(「暂时无法润色提示词，草稿已保留。」同族)+ 「重试」(`canRetry` 为真才渲染);
 * - 空草稿被拒:`rejection.emptyDraft`;
 * - 需重启生效:`restartHint`(同样强调草稿已保留)。
 */
export function PromptPolishNotice({ state, onRetry }: PromptPolishNoticeProps) {
  const t = useTranslations('ai.pane.promptPolish')
  const rejection: PolishRejection | null = state.rejection
  const failed = state.phase === 'failed'
  if (!rejection && !failed && !state.restartHint) return null
  return (
    <div
      data-testid="prompt-polish-notice"
      data-polish-phase={state.phase}
      className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      {rejection ? (
        <span data-testid="prompt-polish-empty" data-polish-reject={rejection}>
          {t('rejection.emptyDraft')}
        </span>
      ) : null}
      {failed ? (
        <span data-testid="prompt-polish-failure" data-polish-error={state.error ?? 'none'}>
          {t('failureDraftKept')}
        </span>
      ) : null}
      {state.restartHint ? (
        <span data-testid="prompt-polish-restart">{t('restartHint')}</span>
      ) : null}
      {canRetry(state) ? (
        <button
          type="button"
          data-testid="prompt-polish-retry"
          onClick={onRetry}
          className="shrink-0 rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] text-amber-800 transition-colors hover:bg-amber-500/25 dark:text-amber-200"
        >
          {t('action.retry')}
        </button>
      ) : null}
    </div>
  )
}

// 模板源统一为 5 个核心模板,与 message-list 空状态共用同一组 i18n key,
// 避免 email/report/review/refactor 4 个无 i18n key 的项显示原始 key 的问题。
// PROMPT_TEMPLATE_IDS / TPL_NAME_KEY_MAP / TPL_CONTENT_KEY_MAP / promptTemplates
// 已提取到 useSlashAction hook(2026-07-29),组件内不再持有模板常量。
// DANGEROUS_PATTERN_KEY 已提取到 useMessageSend hook(2026-07-30)。
// mimeToLabel / useMentionFiles / useAiSkills 已提取到 use-lazy-resource-hooks(2026-07-30)。


interface MessageInputProps {
  /** onSend 返回 true=已提交可清空输入框,false=未发送需保留输入内容(如未登录/创建会话失败) */
  onSend: (content: string) => Promise<boolean> | boolean
  onStop: () => void
  isStreaming: boolean
  placeholder: string
  sendLabel: string
  stopLabel: string
  model: string
  onModelChange: (model: string) => void
  modelLabel: string
  /** 浮窗折叠态头部按钮(展开/停靠/最小化),与 AgentProgressTrigger 同行渲染在输入卡片内 */
  floatHeader?: React.ReactNode
  /** 浮窗折叠态拖拽回调,绑定在合并行上 */
  onFloatDragStart?: (e: React.PointerEvent) => void
  /** 浮窗折叠态点击 AgentProgressTrigger 时展开面板(setFloatCollapsed(false)) */
  onTriggerClick?: () => void
}

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  placeholder,
  sendLabel,
  stopLabel,
  model,
  onModelChange,
  modelLabel,
  floatHeader,
  onFloatDragStart,
}: MessageInputProps) {
  const t = useTranslations('chat')
  // G-166:权限档徽章的档名走跨端共享词表(permissionTier),不再用 chat.permission.mode.* 私有键
  const tTier = useTranslations()
  // 2026-08-02 修复: Bug 3 — useRouter 替代 window.location.href,避免整页刷新丢失状态
  const router = useRouter()
  // 权限模式循环切换 hook(2026-07-29 提取自本文件,深度对标 Codex CLI Shift+Tab 循环):
  // - shortcutsOpen: ? 键唤起/关闭 PermissionShortcutsModal
  // - cyclePermissionMode: Shift+Tab 在 3 个模式间循环切(default → accept-edits → bypass-permissions)
  // hook 同时暴露 openShortcuts(供外部按钮触发),本组件未消费故不解构
  // 详见 apps/web/src/hooks/use-permission-mode-cycle.ts
  const { shortcutsOpen, closeShortcuts, cyclePermissionMode } = usePermissionModeCycle()
  // 当前工作区权限模式(2026-07-25 深化,高风险模式持久化视觉警告)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const activeWorkspaceMode = activeWorkspace?.mode
  const isHighRisk = isHighRiskPermissionMode(activeWorkspaceMode)
  // 高风险模式自动撤销倒计时(2026-07-25 深化,深度对标 Codex CLI 安全护栏):
  // - 切到 bypass-permissions 时启动 1h 倒计时,显示剩余时间
  // - 倒计时归零 → 自动切回 default
  // - 用户可点"取消自动撤销"维持当前模式(但视觉警告仍存在)
  // - 用户主动切走其他模式 → 自动清掉计时
  const autoRevert = usePermissionAutoRevert()
  // 当前会话 ID(W27 草稿 per-conversation 化;手动压缩上下文按钮也消费;未持久化会话按钮禁用)
  const conversationId = useChatStore((s) => s.conversationId)
  // W27(2026-09-14):草稿 key 按会话隔离 —— 新会话(未持久化)共用 'chat:draft',
  // 已持久化会话用 'chat:draft:{id}',切换会话时草稿互不串扰
  const draftKey = conversationId ? `chat:draft:${conversationId}` : 'chat:draft'
  // P1 草稿自动保存(2026-07-23):刷新/路由切换不丢失未发送内容
  // W27 升级:初始读取按当前 conversationId 对应的草稿 key
  const [value, setValue] = React.useState(() => {
    if (typeof window === 'undefined') return ''
    const convId = useChatStore.getState().conversationId
    return localStorage.getItem(convId ? `chat:draft:${convId}` : 'chat:draft') ?? ''
  })
  // W27:当前草稿 key 的 ref(防抖写入用;会话切换 effect 同步维护)
  const draftKeyRef = React.useRef<string | null>(null)
  // 防抖写入 localStorage(避免每个 keystroke 写入)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const key = draftKeyRef.current
      if (typeof window !== 'undefined' && key) {
        localStorage.setItem(key, value)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [value])
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [mentionOpen, setMentionOpen] = React.useState(false)
  // W20 九类 # 上下文选择器(2026-09-14 立,对标 Trae):
  // - 正文行首/空格后 `#` 触发浮层(open 状态由 value 派生,见 use-context-selector.ts)
  // - 选中类目 → 正文尾部 `#query` 替换为类目 token(如 `#Problems `)随消息发送
  // - chips 仅作类型徽章展示,去重添加;移除时同步删掉正文中的 token
  const [contextChips, setContextChips] = React.useState<ContextSelectorCategory[]>([])
  const addContextChip = React.useCallback((category: ContextSelectorCategory) => {
    setContextChips((prev) =>
      prev.some((c) => c.token === category.token) ? prev : [...prev, category],
    )
  }, [])
  const removeContextChip = React.useCallback((token: string) => {
    setContextChips((prev) => prev.filter((c) => c.token !== token))
    setValue((prev) => prev.replace(`${token} `, '').replace(token, ''))
  }, [])
  // references 状态管理(2026-07-29 提取到 useMessageReferences hook):
  // - addFileReference / addTextReference / addCodeReference 三种类型添加
  // - removeReference 移除 + 释放 objectURL
  // - resetReferences 发送后清空
  const { references, addFileReference, addTextReference, removeReference, resetReferences } =
    useMessageReferences()
  // 强制加载工作区所有 agent 规则文件(AGENTS.md/CLAUDE.md 等,任意层级)作为可见参考块(2026-08-29)
  const agentMdRefs = useAgentMdReference()
  // 被用户手动移除的 agent 参考块 id(仅隐藏展示,不影响 workspaceContext 注入)
  const [dismissedAgentIds, setDismissedAgentIds] = React.useState<Set<string>>(new Set())
  const handleRemoveReference = React.useCallback(
    (id: string) => {
      if (id.startsWith(AGENT_REF_PREFIX)) {
        setDismissedAgentIds((prev) => {
          const next = new Set(prev)
          next.add(id)
          return next
        })
        return
      }
      removeReference(id)
    },
    [removeReference],
  )
  const allReferences = React.useMemo(() => {
    const visibleAgentRefs = agentMdRefs.filter((r) => !dismissedAgentIds.has(r.id))
    return [...visibleAgentRefs, ...references]
  }, [agentMdRefs, dismissedAgentIds, references])
  // 共享层 WebInputCore 内部托管 textarea ref + 自动高度(forwardRef 暴露 focus/setSelectionRange/resize)
  const inputCoreRef = React.useRef<WebInputCoreHandle>(null)
  // D36 会话内输入历史栈接线(纯逻辑在 @ihui/shared/chat,本组件只做 DOM 接线):
  // - getHistoryKey 按 conversationId 分桶(chat:prompt-history:{id}),未持久化会话共用 chat:prompt-history
  // - applyHistoryText 仅回填文本并把光标移到行尾,绝不触碰 references(附件保持不动)
  // - handleArrowKey 内部判定多行首行 / 草稿态,未消费时交还 textarea 默认光标移动
  const getHistoryKey = React.useCallback(
    () => (conversationId ? `chat:prompt-history:${conversationId}` : 'chat:prompt-history'),
    [conversationId],
  )
  const applyHistoryText = React.useCallback(
    (text: string) => {
      setValue(text)
      requestAnimationFrame(() => {
        const len = text.length
        inputCoreRef.current?.focus()
        inputCoreRef.current?.setSelectionRange(len, len)
        inputCoreRef.current?.resize()
      })
    },
    [setValue],
  )
  const promptHistory = usePromptHistory({
    getHistoryKey,
    getCaretPosition: () => inputCoreRef.current?.getCaretPosition() ?? 0,
    applyText: applyHistoryText,
  })
  // 发送 / 拖拽 / 粘贴 / 文件输入 handler(2026-07-30 提取到 useMessageSend hook):
  // - isDragOver 状态由 hook 内部管理(原 React.useState(false))
  // - submit / doSend(内部)/ handleDragOver / handleDragLeave / handleDrop / handlePaste
  //   / handleFileInputChange 全部内聚到 hook,主组件只消费返回值
  // - 危险命令检测(DANGEROUS_PATTERN_KEY)随同迁移,主组件不再持有
  const {
    isDragOver,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleFileInputChange,
    submit,
    pendingMessages,
    removePendingMessage,
    sendPendingMessage,
    steer,
  } = useMessageSend({
    value,
    setValue,
    isStreaming,
    isHighRisk,
    // 注意:agent 参考块仅用于展示,不参与发送。
    // doSend 会把 references 转成 "> 📎 label" 附加到消息正文,
    // agent 文件内容已通过 workspaceContext 注入 system prompt,重复传入会污染消息。
    references,
    resetReferences,
    addFileReference,
    addTextReference,
    onSend,
    inputCoreRef,
    draftKey,
    onSent: promptHistory.pushSent,
  })
  // W20 九类 # 上下文选择器(2026-09-14 立,对标 Trae):键盘导航在 textarea 层拦截,
  // 选中类目 → 正文尾部插入 #token 并渲染类型徽章 chip
  const contextSelector = useContextSelector({
    value,
    setValue,
    inputRef: inputCoreRef,
    onAddChip: addContextChip,
  })
  // AI Skills 列表 + @ 提及文件列表:懒加载逻辑已提取到 use-lazy-resource-hooks(2026-07-30)
  const { aiSkills, skillsLoading } = useAiSkills(slashOpen)
  const { mentionFiles } = useMentionFiles(mentionOpen)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // 输入区容器锚点:FileMentionPopover 的 PortalPanel 以它做定位(2026-09-15 对齐浮层收敛契约)
  const inputAreaRef = React.useRef<HTMLDivElement>(null)
  // /permission 切换 toast 首弹记录(2026-07-29 提取到 useSlashAction hook):
  // - permissionToastShownRef / markPermissionToastShown / localStorage 持久化
  // - 已在 hook 内部管理,组件不再持有
  // "添加"下拉菜单状态(2026-07-25 合并):收纳"提示词模板 / 添加引用 / Skill 库 / 添加附件 / 插件市场"5 类动作
  // addMenuMode 决定 Popover content:
  // - menu:5 项主菜单(模板/引用/Skill 库/附件/插件)
  // - prompt:PromptTemplates 弹层
  // - skill:SkillLibrary 弹层
  const [addMenuOpen, setAddMenuOpen] = React.useState(false)
  const [addMenuMode, setAddMenuMode] = React.useState<'menu' | 'prompt' | 'skill' | 'voice'>(
    'menu',
  )
  // D28 /side 快速侧问(2026-09-20 立):当前会话侧问队列(store 持久化,切会话不丢)
  const sideQueue = useChatStore((s) =>
    conversationId ? s.sideQueueByConversation[conversationId] : undefined,
  )
  const removeSideQuestion = useChatStore((s) => s.removeSideQuestion)
  const shiftSideQuestion = useChatStore((s) => s.shiftSideQuestion)
  // 补答一条侧问文本(runBestOfN 单候选,回答以 sidechat 消息入本地流,不入主线历史);
  // 失败仅 toast 提示,不打断主流程
  const answerWithToast = React.useCallback(
    (text: string) => {
      void answerSideQuestion(text, t).catch((error: unknown) => {
        toast.error(
          t('sideAnswerFailed', {
            error: error instanceof Error ? error.message : String(error),
          }),
        )
      })
    },
    [t],
  )
  // 从当前会话队列出队一条并补答(流结束自动补答 / 「立即补答」共用)
  const answerCurrentSideQuestion = React.useCallback(() => {
    if (!conversationId) return
    const item = shiftSideQuestion(conversationId)
    if (item) answerWithToast(item.text)
  }, [conversationId, shiftSideQuestion, answerWithToast])
  // 流式结束后自动发送预备消息(2026-08-14 立,对标 Cursor/ChatGPT 流式期间输入下一条行为)
  // D28(2026-09-20):流结束后预备消息优先(W27);无预备消息时补答当前会话队首侧问
  // (每轮流结束最多补答一条,与 W27 队列同节奏)
  const wasStreamingRef = React.useRef(isStreaming)
  React.useEffect(() => {
    // isStreaming 从 true 变为 false:流式结束,发送队首预备消息
    if (wasStreamingRef.current && !isStreaming) {
      wasStreamingRef.current = false
      if (pendingMessages.length > 0) {
        void sendPendingMessage()
      } else if (sideQueue && sideQueue.length > 0) {
        answerCurrentSideQuestion()
      }
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, pendingMessages, sendPendingMessage, sideQueue, answerCurrentSideQuestion])
  // W27(2026-09-14):会话切换时草稿迁移 —— 当前输入写回旧会话 key,载入目标会话草稿
  const valueRef = React.useRef(value)
  React.useEffect(() => {
    valueRef.current = value
  }, [value])
  React.useEffect(() => {
    if (draftKeyRef.current === null) {
      // 首次挂载:仅记录当前 key(初始 value 已按该 key 读取)
      draftKeyRef.current = draftKey
      return
    }
    if (draftKeyRef.current === draftKey) return
    const prevKey = draftKeyRef.current
    draftKeyRef.current = draftKey
    if (typeof window !== 'undefined') {
      if (valueRef.current) localStorage.setItem(prevKey, valueRef.current)
      else localStorage.removeItem(prevKey)
      setValue(localStorage.getItem(draftKey) ?? '')
    }
    requestAnimationFrame(() => inputCoreRef.current?.resize())
  }, [draftKey])

  // 消费 chat store 中的 draftInput(由 PromptTemplates 等外部触发),填充到 textarea 后清空
  // draftAutoSend(2026-09-08 立,首页「立即体验」CTA):预填后立即自动发送发起对话
  const draftInput = useChatStore((s) => s.draftInput)
  const clearDraftInput = useChatStore((s) => s.clearDraftInput)
  const draftAutoSend = useChatStore((s) => s.draftAutoSend)
  const clearDraftAutoSend = useChatStore((s) => s.clearDraftAutoSend)
  // 已选工具(用户从插件市场点击"+"添加到对话的 pluginId 列表)
  const selectedToolsIds = useChatStore((s) => s.selectedTools)
  const removeSelectedTool = useChatStore((s) => s.removeSelectedTool)
  // D22 引用回复(2026-09-19 立,对标 Qoder 0.2.x):待引用消息快照 chip + 清除
  // (store 只暴露 setQuotedMessage,以 setQuotedMessage(null) 充当清除)
  const quotedMessage = useChatStore((s) => s.quotedMessage)
  const setQuotedMessage = useChatStore((s) => s.setQuotedMessage)
  // D22 圈选 AI 回复入上下文:MessageItem 内选中文本后浮现「引用选中」按钮,
  // 派发 ihui:add-text-reference,输入框统一消费转成文本引用 chip
  React.useEffect(() => {
    const onAddTextRef = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text
      if (text) addTextReference(text)
    }
    window.addEventListener('ihui:add-text-reference', onAddTextRef as EventListener)
    return () =>
      window.removeEventListener('ihui:add-text-reference', onAddTextRef as EventListener)
  }, [addTextReference])
  // D22 会话拖入输入框引用(2026-09-19 立,对标 Qoder 0.2.x):侧栏会话行 draggable,
  // dataTransfer 携带 application/x-ihui-conversation JSON;drop 后拉取会话消息
  // 拼成对话快照文本引用(失败回退用标题),与文件拖拽通道互不影响。
  const CONVERSATION_DRAG_TYPE = 'application/x-ihui-conversation'
  const [isConvDragOver, setIsConvDragOver] = React.useState(false)
  const handleDragOverWithConversation = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!isStreaming && e.dataTransfer.types.includes(CONVERSATION_DRAG_TYPE)) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setIsConvDragOver(true)
        return
      }
      setIsConvDragOver(false)
      handleDragOver(e)
    },
    [isStreaming, handleDragOver],
  )
  const handleDragLeaveWithConversation = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (e.currentTarget === e.target) setIsConvDragOver(false)
      handleDragLeave(e)
    },
    [handleDragLeave],
  )
  const handleDropWithConversation = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (isStreaming || !e.dataTransfer.types.includes(CONVERSATION_DRAG_TYPE)) {
        setIsConvDragOver(false)
        handleDrop(e)
        return
      }
      e.preventDefault()
      setIsConvDragOver(false)
      try {
        const conv = JSON.parse(e.dataTransfer.getData(CONVERSATION_DRAG_TYPE)) as {
          id: string
          title?: string
        }
        if (!conv?.id) return
        void (async () => {
          try {
            const result = await getMessages(conv.id, { direction: 'initial', pageSize: 50 })
            const msgs = result.success && result.data ? result.data.messages : []
            if (msgs.length === 0) throw new Error('empty')
            // 对话快照:role 标注 + 内容逐条拼接,整体截断 4000 字符防超长
            const snapshot = msgs
              .map((m) => `${m.role === 'user' ? '👤' : '🤖'}: ${m.content}`)
              .join('\n\n')
              .slice(0, 4000)
            addTextReference(`【${conv.title ?? '会话'}】\n${snapshot}`)
            toast.success(t('conversationDragReferenced'))
          } catch {
            // 拉取失败回退:仅引用会话标题
            addTextReference(`【${conv.title ?? '会话'}】`)
            toast.success(t('conversationDragReferenced'))
          }
        })()
      } catch {
        // JSON 解析失败静默忽略(非本应用拖拽源)
      }
    },
    [isStreaming, handleDrop, addTextReference, t],
  )
  // 发送按钮可用态(2026-07-30:清除按钮已挪回 WebInputCore 内部悬浮呈现,canClear 不再需要)
  // 2026-08-14 修改:流式期间也允许发送(保存为 pending 消息,流式结束后自动发出)
  const canSend = value.trim().length > 0
  // 斜杠命令选中技能时触发的调用流程状态(2026-08-08 立)
  const [skillInvokeSkill, setSkillInvokeSkill] = React.useState<AiSkillMeta | null>(null)
  const [skillInvokeResult, setSkillInvokeResult] = React.useState<AiSkillInvokeResponse | null>(
    null,
  )
  const [skillInvokeError, setSkillInvokeError] = React.useState<string | null>(null)
  // 把 pluginId 解析成 chip 展示所需的 SelectedToolItem(name + integration 标记)
  const selectedToolItems: SelectedToolItem[] = React.useMemo(() => {
    const all = [...PROJECT_PLUGINS, ...MARKET_PLUGINS]
    const byId = new Map(all.map((p) => [p.id, p]))
    return selectedToolsIds.map((id) => {
      const p = byId.get(id)
      return {
        id,
        name: p?.name ?? id,
        integration: getPluginIntegration(id),
      }
    })
  }, [selectedToolsIds])
  React.useEffect(() => {
    if (draftInput) {
      setValue(draftInput)
      clearDraftInput()
      if (draftAutoSend) {
        // 自动发送:显式传 draftInput 文本绕开 value state 异步更新的闭包旧值问题
        clearDraftAutoSend()
        void submit(draftInput)
        requestAnimationFrame(() => inputCoreRef.current?.focus())
        return
      }
      requestAnimationFrame(() => inputCoreRef.current?.focus())
    }
  }, [draftInput, clearDraftInput, draftAutoSend, clearDraftAutoSend, submit])

  // 权限模式可发现性增强(2026-07-25 深化,深度对标 Codex CLI /help):
  // - infoMode: 标题栏 ⓘ 按钮点击后展示该模式的详细说明 modal
  // shortcutsOpen / cyclePermissionMode 已提取到 usePermissionModeCycle hook(2026-07-29)
  const [infoMode, setInfoMode] = React.useState<WorkspacePermissionMode | null>(null)

  // 斜杠命令列表(2026-07-29 提取到 useSlashCommands,运行时构造逻辑下沉到 hooks/ 目录)
  const slashCommands = useSlashCommands(aiSkills, skillsLoading)

  // 斜杠命令动作 hook(2026-07-29 提取自 message-input.tsx)
  // - promptTemplates:供 <PromptTemplates templates={...} /> 使用
  // - handleCommandSelect / handleCommandArgsSelect:供 <SlashCommandPalette> 的 onSelect / onSelectArgs 使用
  // 内部封装了 commandTemplates 静态映射 + fillInput 行为 + 动作型命令 onSend 拦截 + /permission toast
  // 注意:fillInput 仍由本组件持有(handleTemplateSelect + SkillLibrary onSelect 复用),
  // hook 内部有独立的 fillInput(不导出),两者职责清晰分离
  const { promptTemplates, handleCommandSelect, handleCommandArgsSelect } = useSlashAction(
    setValue,
    inputCoreRef,
    onSend,
    React.useCallback(
      (skillId: string) => {
        const skill = aiSkills.find((s) => s.id === skillId)
        if (!skill) return
        setSkillInvokeSkill(skill)
        setSkillInvokeResult(null)
        setSkillInvokeError(null)
      },
      [aiSkills],
    ),
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, MAX_LENGTH)
    // D36:用户手动编辑即脱离翻历史态,清空游标 / 草稿备份(避免 ↑ 误用旧游标)
    promptHistory.resetCursor()
    setValue(next)
    // 输入 / 作为首个字符时弹出斜杠命令面板
    if (next === '/' && !slashOpen) {
      setSlashOpen(true)
    }
    // @ 触发文件提及
    if (next.endsWith('@') && !mentionOpen) {
      setMentionOpen(true)
    } else if (mentionOpen && !next.match(/@[\w./-]*$/)) {
      setMentionOpen(false)
    }
  }

  const handleMentionSelect = (file: { id: string; name: string; path: string }) => {
    setValue((prev) => prev.replace(/@$/, `\`${file.path}\` `).slice(0, MAX_LENGTH))
    setMentionOpen(false)
    requestAnimationFrame(() => {
      inputCoreRef.current?.focus()
      inputCoreRef.current?.resize()
    })
  }

  const fillInput = (text: string) => {
    setValue(text)
    requestAnimationFrame(() => {
      inputCoreRef.current?.focus()
      inputCoreRef.current?.setSelectionRange(text.length, text.length)
      inputCoreRef.current?.resize()
    })
  }

  const handleTemplateSelect = (content: string) => {
    fillInput(content)
  }

  const handleVoiceTranscript = (text: string) => {
    // P3 #46 阶段3-a 连续语音会话:免手模式开 → 转写段落直接自动发送
    // (说→自动发→自动朗读;发送失败回填输入框由用户手动发)
    if (readHandsFree()) {
      void Promise.resolve(onSend(text)).then((sent) => {
        if (!sent) {
          setValue((prev) => {
            const merged = prev && !prev.endsWith(' ') ? `${prev} ${text}` : `${prev}${text}`
            return merged.slice(0, MAX_LENGTH)
          })
          requestAnimationFrame(() => inputCoreRef.current?.resize())
        }
      })
      return
    }
    setValue((prev) => {
      const merged = prev && !prev.endsWith(' ') ? `${prev} ${text}` : `${prev}${text}`
      return merged.slice(0, MAX_LENGTH)
    })
    requestAnimationFrame(() => inputCoreRef.current?.resize())
  }

  // D82 就地润色与失败保稿(G-95 重定义):草稿仍由 value 单一持有,
  // 这里只镜像草稿 + 持有相位 / 拒绝 / 重启提示(判定层状态机在 @ihui/shared/chat/prompt-polish)。
  const [polish, setPolish] = React.useState<PromptPolishState>(() => createPolishState(''))
  // 草稿是唯一真相源:value 变化即单向同步进判定层(绝不反向覆盖 value)
  React.useEffect(() => {
    setPolish((prev) => (prev.draft === value ? prev : { ...prev, draft: value }))
  }, [value])
  // 一键润色:空 / 纯空白草稿由判定层直接拒绝(不进入 polishing、不发请求);
  // 失败只回写相位与诊断,草稿字节级不变(保稿);二次失败仍可点「重试」(canRetry 在同处复用)。
  const handlePolish = React.useCallback(async () => {
    const started = beginPolish({ ...polish, draft: value })
    if (started.phase !== 'polishing') {
      // 空草稿被拒:写 rejection 后返回,绝不触碰草稿
      setPolish(started)
      return
    }
    setPolish(started)
    try {
      // 复用既有 /polish 命令文案(chat.cmdPolish)+ 既有 best-of-n 单副本通道(不新建提示词栈)
      const result = await runBestOfN(`${t('cmdPolish')}\n\n${value}`, 1)
      const text = result.candidates[0]?.content ?? ''
      setPolish((prev) => applyPolishResult(prev, { kind: 'succeeded', text, restartReason: null }))
      // 就地改写:成功替换草稿(判定层对空结果另有「不覆盖原稿」守护)
      if (text.trim()) setValue(text)
    } catch (error: unknown) {
      setPolish((prev) =>
        applyPolishResult(prev, {
          kind: 'failed',
          error: error instanceof Error ? error.message : String(error),
          restartReason: polishRestartReasonOf(error),
        }),
      )
    }
  }, [polish, value, t, setValue])

  // 截图入口:Web 无系统级截图 API(Tauri 未暴露截图命令),退化为文件选择,
  // 并提示可直接 Ctrl+V 粘贴剪贴板截图(粘贴链路见 useMessageSend.handlePaste)
  const handleScreenshot = React.useCallback(() => {
    if (isStreaming) return
    fileInputRef.current?.click()
    toast.info(t('screenshotHint'))
  }, [isStreaming, t])

  // 全局快捷键消费者(2026-09-18 用户规则:"这里这么多按钮都重合了 用快捷命令就能呼出使用"):
  // 输入工具栏的 / / @ / 截图 三个独立按钮已移除,改用 use-global-shortcuts.ts 派发的
  // 三个 window CustomEvent 触发等价行为(见 DEFAULT_SHORTCUTS 新增项):
  //   · Ctrl+Shift+/  → open-slash  → 打开 SlashCommandPalette
  //   · Ctrl+Shift+U  → mention-file → 末尾插入 @ 字符 + 打开 FileMentionPopover
  //   · Ctrl+Shift+M  → screenshot  → 复用 handleScreenshot(file 选择器 + toast)
  // 监听挂载在 window:整个 message-input 生命周期内始终可用,不受 textarea 是否聚焦影响
  // (与 ai-side-panel 的 Alt+P 处理一致,均用 window.addEventListener 消费事件)。
  React.useEffect(() => {
    const onOpenSlash = () => {
      if (isStreaming) return
      setSlashOpen(true)
    }
    const onMentionFile = () => {
      if (isStreaming) return
      const next = (value.endsWith(' ') || value === '' ? `${value}@` : `${value} @`).slice(
        0,
        MAX_LENGTH,
      )
      setValue(next)
      setMentionOpen(true)
      requestAnimationFrame(() => {
        inputCoreRef.current?.focus()
        const pos = next.length
        inputCoreRef.current?.setSelectionRange(pos, pos)
        inputCoreRef.current?.resize()
      })
    }
    const onScreenshot = () => {
      handleScreenshot()
    }
    window.addEventListener('global-shortcut:open-slash', onOpenSlash)
    window.addEventListener('global-shortcut:mention-file', onMentionFile)
    window.addEventListener('global-shortcut:screenshot', onScreenshot)
    return () => {
      window.removeEventListener('global-shortcut:open-slash', onOpenSlash)
      window.removeEventListener('global-shortcut:mention-file', onMentionFile)
      window.removeEventListener('global-shortcut:screenshot', onScreenshot)
    }
  }, [isStreaming, value, handleScreenshot])

  // 手动压缩上下文(2026-09-02 立):点击触发 POST /api/chat/compact
  // - 请求进行中 loading + 禁用;compressed=true → 成功 toast + 重新拉取当前会话消息列表
  //   (刷新跟随 use-chat/send-message.ts 压缩兜底的 getMessages 机制,仅仍在原会话时写回 store)
  // - reason=too_few_messages / incompressible → info toast
  // - 404/其他错误 → 统一错误 toast(Toaster 自动中文化)
  const [compacting, setCompacting] = React.useState(false)
  const handleCompact = React.useCallback(async () => {
    const id = useChatStore.getState().conversationId
    if (!id || compacting || isStreaming) return
    setCompacting(true)
    try {
      const res = await compactConversation(id)
      if (res.success && res.data) {
        if (res.data.compressed) {
          toast.success(
            t('compaction.compactSuccess', {
              before: res.data.originalTokens,
              after: res.data.compressedTokens,
              saved: Math.max(0, res.data.originalTokens - res.data.compressedTokens),
            }),
          )
          const result = await getMessages(id, { direction: 'initial', pageSize: 100 })
          if (result.success && result.data && useChatStore.getState().conversationId === id) {
            useChatStore.getState().setMessages(
              result.data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: new Date(m.createdAt).getTime(),
                model: '',
                reasoning: m.reasoning,
              })),
            )
          }
        } else if (res.data.reason === 'too_few_messages') {
          toast.info(t('compaction.compactTooFew'))
        } else {
          toast.info(t('compaction.compactIncompressible'))
        }
      } else {
        toast.error(t('compaction.compactFailed'), {
          description: res.success ? undefined : res.error,
        })
      }
    } catch (e) {
      const msg = (e as Error).message || t('compaction.compactFailed')
      toast.error(t('compaction.compactFailed'), { description: msg })
    } finally {
      setCompacting(false)
    }
  }, [compacting, isStreaming, t])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // W20 九类 # 上下文选择器:键盘导航(↑/↓/Enter/Tab/Esc)前置拦截,消费则短路
    if (contextSelector.handleKeyDown(e)) return
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
      return
    }
    // D36 会话内输入历史上翻(对标 Codex prompt-history):
    // ↑ 回填上一条发送文本 / ↓ 返回原始草稿;斜杠 / 提及面板打开时不抢(让面板用 ↑/↓)。
    // 未消费(草稿态 ↓ / 多行非首行 ↑)时不 preventDefault,交还 textarea 默认光标移动。
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
      !slashOpen &&
      !mentionOpen &&
      !e.nativeEvent.isComposing
    ) {
      const handled = promptHistory.handleArrowKey(e, { value })
      if (handled) {
        e.preventDefault()
        return
      }
    }
    // Shift+Tab 全局循环切权限模式(2026-07-25 深化,深度对标 Codex CLI)
    // - 斜杠面板/提及面板打开时不抢(让面板用 Tab)
    // - 阻止默认焦点切换(浏览器默认 Shift+Tab 是反向 focus)
    // - 即使 textarea 内有输入也直接切换(Codex 行为:全局生效,非 textarea 局部)
    if (e.key === 'Tab' && e.shiftKey && !slashOpen && !mentionOpen) {
      e.preventDefault()
      void cyclePermissionMode()
    }
    // Esc 清空草稿(2026-07-31 对标 主流 AI IDE):
    // - 斜杠/提及面板打开时 Esc 由面板自己处理(不清空)
    // - 流式生成中禁用(避免误清下一条草稿)
    // - 有内容时清空并 resize textarea 高度
    if (e.key === 'Escape' && !slashOpen && !mentionOpen && !isStreaming && value.length > 0) {
      e.preventDefault()
      setValue('')
      requestAnimationFrame(() => inputCoreRef.current?.resize())
    }
  }

  // W27:队列条目「取消」—— 移除该条并把文本退回主输入框(已有内容则换行拼接)
  const handleQueueRemove = (i: number) => {
    const item = pendingMessages[i]
    if (!item) return
    removePendingMessage(i)
    setValue((prev) => (prev ? `${prev}\n${item.text}` : item.text))
    requestAnimationFrame(() => inputCoreRef.current?.resize())
  }

  // D28:侧问队列条目「删除」—— 直接移除不回填输入框(与 W27 取消回填行为区分)
  const handleSideQueueRemove = (id: string) => {
    if (!conversationId) return
    removeSideQuestion(conversationId, id)
  }
  // D28:侧问「立即补答」(仅非流式渲染)—— 出队该条并立即请求补答
  const handleSideQueueAnswerNow = (item: SideQueueItem) => {
    if (!conversationId) return
    removeSideQuestion(conversationId, item.id)
    answerWithToast(item.text)
  }

  // #18 流式中输入框保持可输入(2026-07-25 立):流式中 textarea 不再 disabled,用户可输入下一条消息草稿(对标 Cursor/ChatGPT 行为)。
  // 发送按钮已移入 WebInputCore(由 !isStreaming 守门,流式中显示 Stop 按钮)。
  // 流式占位符(2026-07-25 立,2026-07-29 简化):直接读 i18n key,5 语言文件齐备;末尾省略号统一加 "…" 提示持续生成。
  const streamingHint = t('streamingIndicatorHint')
  const effectivePlaceholder = isStreaming ? `${streamingHint}…` : placeholder

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 py-3">
        {/* 高风险模式持久化视觉警告(2026-07-25 深化,深度对标 Codex 高风险提示)
            - 提取到 HighRiskWarningBanner 子组件(2026-07-30),行为零变更
            - 内部消费 useAiPanelStore 计算 isHighRisk + useTranslations('chat')
            - autoRevert 由主组件透传(标题栏倒计时与横幅倒计时共享同一份 tick) */}
        <HighRiskWarningBanner autoRevert={autoRevert} />
        {/* 任务进度常驻状态条:此刻最该被看到的动态信息(流式时自动展开明细,空闲时零占位) */}
        <TaskStatusBar />
        {/* P3 #30:diff 待发送意见提示条(有意见时才渲染,无意见时返回 null 零占位) */}
        <DiffCommentsBar />
        {/* D82 润色保稿提示(失败 / 空草稿被拒 / 需重启生效;均带「草稿已保留」语义,无内容零占位) */}
        <PromptPolishNotice state={polish} onRetry={handlePolish} />
        {allReferences.length > 0 && (
          <div className="mb-2">
            <ContextReferencePanel references={allReferences} onRemove={handleRemoveReference} />
          </div>
        )}
        {selectedToolItems.length > 0 && (
          <div className="mb-2">
            <SelectedToolsPanel tools={selectedToolItems} onRemove={removeSelectedTool} />
          </div>
        )}
        {/* D22 引用回复 chip(2026-09-19 立,对标 Qoder 0.2.x):MessageList 监听
            ihui:reply-message 后写入 store,此处渲染快照 chip,点击 X 清除 */}
        {quotedMessage && (
          <div
            data-testid="quoted-reply-chip"
            className="mb-2 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-primary">
                {quotedMessage.role === 'user' ? t('quotedReplyUser') : t('quotedReplyAssistant')}
              </p>
              <p className="truncate text-xs text-muted-foreground">{quotedMessage.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setQuotedMessage(null)}
              data-testid="quoted-reply-clear"
              aria-label={t('cancel')}
              className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}
        {/* 多维 @ 提及 chips(2026-07-22 立,对标 Qoder Context Engineering) */}
        <MentionChips />
        {/* W20 九类 # 上下文选择器 chips(2026-09-14 立,对标 Trae Context Engineering):
            选中类目的类型徽章行,token 已随正文发送,chips 仅作可视化展示 */}
        {contextChips.length > 0 && (
          <div className="mb-2">
            <ContextSelectorChips chips={contextChips} onRemove={removeContextChip} />
          </div>
        )}
        {/* W27 输入队列(2026-09-14,对标 Codex/Cursor 多条排队):流式期间排队的消息
            逐条显示,每次流式结束自动出队发送队首;点「取消」把该条文本退回主输入框 */}
        {pendingMessages.length > 0 && (
          <div data-testid="input-queue" className="mb-2 space-y-1">
            {pendingMessages.map((pm, i) => (
              <div
                key={i}
                data-testid={`input-queue-item-${i}`}
                className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate text-amber-700 dark:text-amber-300">
                  {pm.text}
                </span>
                <button
                  type="button"
                  data-testid={`input-queue-remove-${i}`}
                  onClick={() => handleQueueRemove(i)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('cancel') ?? '取消'}
                </button>
              </div>
            ))}
          </div>
        )}
        {/* D28 /side 侧问队列(2026-09-20):流式期间排队的侧问逐条显示,流结束后自动补答
            队首一条;「立即补答」仅非流式渲染,「删除」直接移除不回填输入框 */}
        {sideQueue && sideQueue.length > 0 && (
          <div data-testid="side-queue" className="mb-2 space-y-1">
            {sideQueue.map((sq) => (
              <div
                key={sq.id}
                data-testid={`side-queue-item-${sq.id}`}
                className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300">
                  💬 {t('sideQueued')}
                </span>
                <span className="min-w-0 flex-1 truncate text-amber-700 dark:text-amber-300">
                  {sq.text}
                </span>
                {!isStreaming && (
                  <button
                    type="button"
                    data-testid={`side-queue-answer-${sq.id}`}
                    onClick={() => handleSideQueueAnswerNow(sq)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t('sideAnswerNow')}
                  </button>
                )}
                <button
                  type="button"
                  data-testid={`side-queue-remove-${sq.id}`}
                  onClick={() => handleSideQueueRemove(sq.id)}
                  className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {t('cancel') ?? '取消'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div ref={inputAreaRef} className="relative">
          <FileMentionPopover
            files={mentionFiles}
            open={mentionOpen}
            anchorRef={inputAreaRef}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
          {/* W20 九类 # 上下文选择器浮层(2026-09-14 立,对标 Trae):键盘导航在 textarea 层 */}
          <ContextSelectorPopover
            open={contextSelector.open}
            query={contextSelector.query}
            filtered={contextSelector.filtered}
            activeIndex={contextSelector.activeIndex}
            anchorRef={inputAreaRef}
            onHover={contextSelector.setActiveIndex}
            onSelect={contextSelector.select}
          />
          {/* 极简风格输入容器:描边卡片 + textarea 主区 + 底部工具栏。拖拽文件时高亮边框。
              高风险模式(bypass-permissions)时,边框使用琥珀色 + 轻微阴影以视觉警告
              2026-07-31 升级:默认边框从 border-border 改为 border-input,
              对齐 tokens.css --color-input 设计意图(亮色 91% L 更柔和,暗色 26% L 与卡片 10% L 区分更明显)。
              之前 border-border(89.8% L / 22% L)在亮色下与白底卡片几乎无可见边界,
              暗色下 22% vs 卡片 10% 仅 12% 差距,输入框边界感丢失。*/}
          <div
            onDragOver={handleDragOverWithConversation}
            onDragLeave={handleDragLeaveWithConversation}
            onDrop={handleDropWithConversation}
            className={cn(
              'flex flex-col rounded-xl border bg-card transition-colors focus-within:border-foreground/20',
              // 互斥的边框逻辑:拖拽(文件或会话) > 高风险 > 默认
              isDragOver || isConvDragOver
                ? 'border-primary ring-2 ring-ring/20'
                : isHighRisk
                  ? 'border-amber-500/50 focus-within:border-amber-500/70 shadow-[0_0_0_1px_rgba(245,158,11,0.08)] animate-pulse-soft'
                  : 'border-input',
            )}
          >
            {/* 拖拽提示遮罩:仅在 isDragOver 时显示 */}
            {(isDragOver || isConvDragOver) && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/10">
                <p className="text-sm font-medium text-primary">{t('dropAttachmentHint')}</p>
              </div>
            )}
            {/* 浮窗折叠态:floatHeader(展开/停靠/最小化)并入顶部工具栏右侧(ml-auto),
                拖拽回调绑定在工具栏上(handleFloatDragStart 自身排除 button 目标:
                点按钮仍是点击,拖空白处/按钮间隙才是拖动),工具栏重新成为卡片首行(圆角自然恢复) */}
            <div
              onPointerDown={onFloatDragStart}
              className={INPUT_ATTACHMENT_BAR_CLASS}
              data-toolbar-float-merged="v2"
            >
              {!floatHeader && <AgentProgressTrigger iconOnly />}
              <PermissionModePopover disabled={isStreaming} />
              {/* 权限模式历史(2026-07-25 深化,放在附加栏跟盾牌按钮成组,与 popover 内"查看历史"互斥):
                  - trigger 按钮(Clock4 图标)作为 Popover 锚点,定位弹层
                  - 高度走 INPUT_ATTACHMENT_BAR_BTN_BASE(h-7)+ w-7(28×28 正方形),与权限/添加按钮严丝合缝
                  - 通过 window.__IHUI_OPEN_HISTORY__?.() 由外部组件触发,自身不渲染任何重复入口 */}
              <PermissionHistoryPanel />
              {/* "添加"下拉菜单(2026-07-25 终极整合,2026-07-30 提取到 AddMenuPopover 子组件)
                  收纳 5 类动作,内部按 mode 切换 content(menu/prompt/skill 三态)
                  高度由 AddMenuPopover 内部 button className 走 INPUT_ATTACHMENT_BAR_BTN_BASE 统一(h-7)
                  行为零变更:关闭时重置 menu 态 / disabled 状态 / 所有回调透传 */}
              <AddMenuPopover
                open={addMenuOpen}
                onOpenChange={setAddMenuOpen}
                mode={addMenuMode}
                onModeChange={setAddMenuMode}
                isStreaming={isStreaming}
                inputValue={value}
                promptTemplates={promptTemplates}
                onTemplateSelect={(content) => {
                  handleTemplateSelect(content)
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                }}
                onSkillSelect={(template) => {
                  fillInput(template)
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                }}
                onSkillClose={() => {
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                }}
                onSkillSendToChat={(content) => {
                  useChatStore.setState({ draftInput: content })
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                }}
                onAddFile={() => {
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                  fileInputRef.current?.click()
                }}
                onVoiceRecordComplete={(blob) => {
                  // 语音录制完成(2026-09-14 接线 VoiceRecord):Blob 转 File 走统一附件引用链路,
                  // 上传/入列/移除全部复用既有附件 chip 体系,误录可在引用区删除
                  const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
                  addFileReference(file)
                  toast(t('voiceRecord.added'))
                }}
                onAddTextReference={() => {
                  const text = value.trim()
                  if (!text) return
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                  addTextReference(text)
                  setValue('')
                  requestAnimationFrame(() => inputCoreRef.current?.resize())
                }}
                onOpenPluginMarket={() => {
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                  // 插件/MCP 入口:跳转到 /plugins 页面
                  // 2026-08-02 修复: Bug 3 — 改用 router.push 避免整页刷新丢失输入/状态
                  router.push('/plugins')
                }}
                onOpenDeepResearch={() => {
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                  // 深度研究入口(2026-09-07 工作线 B):跳转 /deep-research 页面
                  router.push('/deep-research')
                }}
                onCompactContext={handleCompact}
                compacting={compacting}
                compactDisabled={!conversationId}
              />
              {allReferences.length > 0 && (
                <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {allReferences.length} 个引用
                </span>
              )}
              {/* 浮窗折叠态按钮组(展开/停靠/最小化):推到工具栏右侧,cursor-move 提示可拖拽浮窗 */}
              {floatHeader && (
                <div className="ml-auto flex cursor-move items-center gap-1">{floatHeader}</div>
              )}
            </div>
            {/* 当前 ChatMode 徽章(2026-07-28 立,移除 4 按钮后改用小徽章显示):
                模式切换入口:
                · 斜杠命令 /build /plan /review /spec(message-input.tsx tryHandleChatModeSlash 拦截)
                · Ctrl+1/2/3/4 全局快捷键(ai-side-panel.tsx keydown handler)
                · AI 自动判断(用户输入发送时由 use-chat.ts suggestMode 触发)
                视觉风格对齐右侧权限模式徽章:compact (h-6 px-2 text-xs)、subtle bg-muted、
                圆角 6px(rounded-md),与 4 按钮时代风格统一。
                权限模式徽章(2026-07-25 深化):在模式徽章右侧持续显示当前权限模式,
                高风险时附倒计时(与顶部高风险警告横幅同步),透明性 + 时效性双指标。
                CurrentModeBadge 已整合到 AgentProgressTrigger 按钮前部(2026-07-29)。 */}
            {/* 权限模式标题栏(2026-08-06 修复):仅在 activeWorkspaceMode 有值时渲染,
                避免空模式时也占用 pt-2 + flex 行高(原实现始终渲染但内容为空,
                视觉上是无内容的 8-12px 空白条,被用户反馈"啥也没显示 + 高度太高")。
                ml-auto 保证徽章右对齐(与底部工具栏右对齐基线一致)。 */}
            {activeWorkspaceMode && (
              <div className="flex items-center gap-2 px-3 pt-2">
                <div
                  className="ml-auto flex items-center gap-1.5"
                  data-testid="titlebar-permission-mode"
                >
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors',
                      isHighRisk
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : activeWorkspaceMode === 'accept-edits'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                      aria-hidden="true"
                    />
                    {permissionTierText(activeWorkspaceMode, tTier).title}
                  </span>
                  {/* 高风险模式 ⓘ 详细说明按钮(2026-07-25 深化,可解释性增强):
                    只在 bypass-permissions 模式显示,点击唤起 PermissionModeInfoModal
                    展示 4 条该模式的详细说明 bullet,底部"知道了"关闭 */}
                  {activeWorkspaceMode === 'bypass-permissions' && (
                    <Tooltip content={t('permission.infoButtonTitle')}>
                      <button
                        type="button"
                        onClick={() => setInfoMode('bypass-permissions')}
                        className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
                        aria-label={t('permission.infoButtonLabel')}
                        data-testid="permission-mode-info-button"
                      >
                        <Info className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Tooltip>
                  )}
                  {/* 高风险 + 倒计时激活 → 在徽章右侧追加倒计时(2026-07-25 深化)
                    复用 autoRevert hook 的同一份 1s tick,保证顶部警告和标题栏倒计时一致 */}
                  {isHighRisk && autoRevert.isActive && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-700 dark:text-amber-400"
                      data-testid="titlebar-auto-revert"
                    >
                      {t('permission.titleBarAutoRevert', {
                        time: formatRemaining(autoRevert.remainingMs),
                      })}
                    </span>
                  )}
                </div>
              </div>
            )}
            {/* 共享层 WebInputCore(textarea + 字符计数 + 清除 + 发送/停止),契约对齐 packages/types MessageInputProps */}
            <WebInputCore
              ref={inputCoreRef}
              text={value}
              placeholder={effectivePlaceholder}
              isStreaming={isStreaming}
              onTextChange={setValue}
              onSend={submit}
              onStop={onStop}
              onClear={() => setValue('')}
              t={t}
              sendLabel={sendLabel}
              stopLabel={stopLabel}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
            {/* 底部工具栏:左侧 / @ 触发按钮,右侧 ContextUsageRing + ModelSelector + VoiceInput
                + 流式指示(发送/停止按钮已上移至 WebInputCore)
                ai-input-toolbar + globals.css 原生 CSS container query:
                面板宽度 320-720px(默认 400px),容器内容宽 288-688px;
                容器 <= 359px(面板 <= 391px)时隐藏 ModelSelector 文字 + 徽章只显示图标,
                防止左侧 2 按钮 + ModelSelector + VoiceInput 总宽超过容器右边界。
                用原生 CSS 不依赖 Tailwind v4 container variant 编译(实测 Tailwind v4
                仅编译 .@container 类不编译 @sm: 断点规则)。 */}
            <div className="ai-input-toolbar flex min-w-0 items-center gap-1 overflow-hidden px-2 pb-2 pt-1">
              {/* 附件入口已合并到上方"添加"下拉菜单第 4 项(2026-07-25 合并),此处不再保留独立按钮,
                  避免和"添加 → 添加附件"重复造成用户认知负担。
                  若需要触发 file input,在"添加"菜单中点击"添加附件"项即可(fileInputRef 共享)。 */}
              {/* 斜杠 / @ / 截图 三个独立按钮已移除(2026-09-18 用户规则:"这里这么多按钮都重合了"):
                  改用全局快捷键呼出(见 use-global-shortcuts.ts DEFAULT_SHORTCUTS):
                    · Ctrl+Shift+/  → global-shortcut:open-slash  → 打开 SlashCommandPalette
                    · Ctrl+Shift+U  → global-shortcut:mention-file → 插入 @ 并弹出 FileMentionPopover
                    · Ctrl+Shift+M  → global-shortcut:screenshot  → 触发 fileInputRef + 提示 Ctrl+V
                  SlashCommandPalette 仍挂载但换用隐藏 anchor:面板 PortalPanel 需要 anchor 定位,
                  这里挂一个 0 尺寸的绝对定位 span 锚定在工具栏左上角,视觉不占位。 */}
              <SlashCommandPalette
                commands={slashCommands}
                onSelect={handleCommandSelect}
                onSelectArgs={handleCommandArgsSelect}
                open={slashOpen}
                onOpenChange={setSlashOpen}
              >
                <span
                  aria-hidden="true"
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                  }}
                />
              </SlashCommandPalette>
              {/* 模式选择器(2026-09-13 矩阵 A #24):同会话模式切换的可见控件,
                  与 / 命令、Ctrl+1-5、AI 自动判断三通道共用 useModeStore 单一状态源 */}
              <ModeSwitcher disabled={isStreaming} />
              {/* D21 折叠策略、D22 网页搜索两个入口均已迁入设置页「偏好设置」卡片
                  (2026-09-21 用户裁决:偏好类开关归位设置页,工具栏只留会话级控件);
                  状态链路不变(chat store + mergeAgentTools 消费)。 */}
              {/* 高级参数入口(P1-7,2026-09-13):temperature/top_p/top_k/max_tokens +
                  自定义 system prompt,会话级持久化,随请求下发 LLM 网关 */}
              <SamplingParamsButton disabled={isStreaming} />
              {/* D82 一键润色入口:对当前草稿**就地改写**(空草稿禁用),失败保稿见输入卡上方提示条 */}
              <PromptPolishEntry state={polish} disabled={isStreaming} onPolish={handlePolish} />
              <input
                ref={fileInputRef}
                type="file"
                // 矩阵 A #19:与 use-message-references UPLOADABLE_EXTENSIONS 白名单对齐
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.zip,.odt,.rtf,.epub"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1">
                {/* 手动压缩上下文入口已整合到"添加"下拉菜单(2026-09-06),工具栏不再保留独立按钮 */}
                <ContextUsageRing model={model} isStreaming={isStreaming} />
                <ModelSelector
                  value={model}
                  onChange={onModelChange}
                  disabled={isStreaming}
                  label={modelLabel}
                />
                {/* 语音入口整合:单一 Mic 按钮直接触发语音转文字,挨着发送键 */}
                <VoiceToolbar onTranscript={handleVoiceTranscript} disabled={isStreaming} />
                {/* 发送/停止按钮(2026-07-30 用户规则:清除按钮已挪回 WebInputCore 内部 textarea 右上角悬浮呈现,
                    不再占用 toolbar 槽位)
                    - 流式中切 Stop(天蓝底 sky-500),否则 Send(主色,空输入/流式中禁用) */}
                {isStreaming ? (
                  <>
                    {/* Steer 中途引导(2026-09-19 立):流式期间闪电按钮,不打断当前工具执行,
                        将输入框文本经 /chat/steer 注入 ai-service 队列,下一轮 LLM 调用前生效。
                        Enter 仍走 W27 FIFO 排队(两者互不影响);空输入禁用。 */}
                    <Tooltip content={t('steer')}>
                      <span className="inline-flex">
                        <button
                          type="button"
                          onClick={() => void steer()}
                          disabled={!value.trim()}
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                            value.trim()
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                          )}
                          aria-label={t('steer')}
                          data-testid="steer-button"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </Tooltip>
                    <Tooltip content={stopLabel ?? t('stop')}>
                      <button
                        type="button"
                        onClick={onStop}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-sky-500 text-white hover:bg-sky-600"
                        aria-label={stopLabel ?? t('stop')}
                      >
                        <Square className="h-3.5 w-3.5" fill="currentColor" />
                      </button>
                    </Tooltip>
                  </>
                ) : (
                  <Tooltip content={sendLabel ?? t('send')}>
                    <span className="inline-flex">
                      <button
                        type="button"
                        // 包一层避免把 MouseEvent 传成 submit 的 overrideValue(TS2322)
                        onClick={() => void submit()}
                        disabled={!canSend}
                        className={cn(
                          'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                          canSend
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                        )}
                        aria-label={sendLabel ?? t('send')}
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </Tooltip>
                )}
                {/* 流式生成指示已移除(2026-08-01 立,用户规则):
                    不在输入区右侧显示"AI 正在生成中"文字 + 脉冲点。
                    AI 生成状态由对话框内 TypingIndicator(三个跳动点,message-list showTyping)承担,
                    停止操作由上方 stop 按钮承担(替换 send 按钮,大小一致)。 */}
              </div>
            </div>
          </div>
        </div>
        {/* 2026-07-28 用户规则调整:删除外层 hint 行,字符数已迁移至输入框内右下角,
            整体更紧凑、外层不再留空条;Enter 发送 · Shift+Enter 换行 用 textarea placeholder 承担(已有)。 */}
      </div>
      {/* 首次启用高风险模式确认弹窗(2026-07-25 深化,深度对标 Codex CLI safety guard)
          - 由 ai-panel store.pendingFullAccess 控制 open 状态
          - popover / Shift+Tab / /permission full 三处切到 bypass-permissions 时共用
          - 用户勾选"我了解"后才能点"继续启用"(内部 markFullAccessSuppressed/Acknowledged)
          - 确认后调 cyclePermissionMode(再次切到 bypass,此时 isFullAccessConfirmSuppressed=true,直走切换) */}
      <FullAccessConfirmBridge />
      {/* 权限模式快捷键帮助面板(2026-07-25 深化,深度对标 Codex CLI /help):
          - ? 键(Shift+/)全局唤起/关闭,由本组件内 useEffect 监听
          - 排除 textarea/input/contenteditable 内,用户打字不误触
          - 3 分组:模式切换 / 高风险护栏 / 撤销与审计 */}
      <PermissionShortcutsModal open={shortcutsOpen} onClose={closeShortcuts} />
      {/* 权限模式详细说明 modal(2026-07-25 深化,可解释性增强):
          - 只在高风险模式(bypass-permissions)显示 ⓘ 按钮时唤起
          - 4 条该模式详细行为 bullet,底部"知道了"关闭 */}
      <PermissionModeInfoModal mode={infoMode} onClose={() => setInfoMode(null)} />
      {/* 斜杠命令选中技能时触发的内联调用对话框(2026-08-08 立) */}
      {skillInvokeSkill && !skillInvokeResult && (
        <div className="mx-auto mt-2 max-w-3xl px-4">
          <AiSkillInvokeDialog
            skill={skillInvokeSkill}
            error={skillInvokeError}
            onCancel={() => {
              setSkillInvokeSkill(null)
              setSkillInvokeResult(null)
              setSkillInvokeError(null)
            }}
            onSuccess={(result) => {
              setSkillInvokeResult(result)
              setSkillInvokeError(null)
            }}
            onError={(err) => {
              setSkillInvokeError(err)
              setSkillInvokeResult(null)
            }}
          />
        </div>
      )}
      {skillInvokeResult && (
        <div className="mx-auto mt-2 max-w-3xl px-4">
          <AiSkillResultDialog
            result={skillInvokeResult}
            onClose={() => {
              setSkillInvokeResult(null)
              setSkillInvokeSkill(null)
            }}
            onFillInput={(text) => {
              setValue(text)
              setSkillInvokeResult(null)
              setSkillInvokeSkill(null)
              requestAnimationFrame(() => {
                inputCoreRef.current?.focus()
                inputCoreRef.current?.setSelectionRange(text.length, text.length)
                inputCoreRef.current?.resize()
              })
            }}
          />
        </div>
      )}
    </div>
  )
}

export default MessageInput
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
