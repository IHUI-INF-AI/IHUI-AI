// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Square, Zap, MessageCircle, X, Wand2, ListFilter, ListTodo } from 'lucide-react'
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
import { useMentionWiring } from '@/hooks/use-mention-wiring'
// D68 统一多源建议面板(2026-09-26):六源聚合 + 逐源来源标注 + 部分失败三句降级 +
// 粘贴引用有效性预览;"旧三浮层入口不回归"为硬验收,FileMentionPopover /
// ContextSelectorPopover / SlashCommandPalette 的挂载与触发一律原样保留。
import {
  UnifiedSuggestionPanel,
  UnifiedPasteReferencePreview,
} from '@/components/chat/unified-suggestion-panel'
import {
  capReferences,
  previewPastedReferences,
  type PastedReferencePreview,
  type UnifiedSuggestionItem,
} from '@/components/chat/unified-suggestion-sources'
import { useUnifiedSuggestions } from '@/hooks/use-unified-suggestions'
import { WebInputCore, MAX_LENGTH, type WebInputCoreHandle } from './web-input-core'
import {
  PermissionModePopover,
  isHighRiskPermissionMode,
} from '@/components/ai/permission-mode-popover'
import { PermissionShortcutsModal } from '@/components/ai/permission-shortcuts-modal'
import { PermissionModeInfoModal } from '@/components/ai/permission-mode-info-modal'
import { AgentProgressTrigger } from '@/components/ai/agent-progress-trigger'
import { ModeSwitcher } from '@/components/chat/mode-switcher'
import { SamplingParamsButton } from '@/components/chat/sampling-params-panel'
// D130(2026-09-30 立):推理强度第三轴 —— 输入区的档位控件。摘掉下面 JSX 里那一行挂载,
// 档位就永远进不了请求(展示件、store、发送链全都还在,typecheck/lint 一路绿),
//  apps/web/src/components/chat/__tests__/reasoning-effort-axis-mount.test.tsx 的①③正是守这一行。
import { ReasoningEffortInputAxis } from '@/components/chat/reasoning-effort-input-axis'
import { FullAccessConfirmBridge } from '@/components/chat/full-access-confirm-bridge'
import { HighRiskWarningBanner } from '@/components/chat/high-risk-warning-banner'
// D117(2026-09-27):/diff 会话改动总览弹窗(全局单实例,useSessionDiffStore 驱动)
import { SessionDiffDialog } from '@/components/ai/session-diff-dialog'
import { runManualCompact } from '@/hooks/use-chat/manual-compact'
// P3 #30(2026-09-16 立):待发送 diff 评审意见提示条(输入框上方常驻提示 + 一键清空)
import { DiffCommentsBar } from '@/components/chat/diff-comments-bar'
// D154(2026-09-30 立):MCP 连接状态行 —— 连不上/重连中在对话里给一句可操作的话(数据来自 WS 常连)
import { McpStatusNotice } from '@/components/chat/mcp-status-notice'
// 任务进度常驻状态条:输入框上方动态显示"在做什么 / 第几步 / 改了多少文件",plan_updated 驱动
import { TaskStatusBar } from '@/components/ai/task-status-bar'
import { AddMenuPopover } from '@/components/chat/add-menu-popover'
import { INPUT_ATTACHMENT_BAR_CLASS } from '@/lib/nav-styles'
import { usePermissionAutoRevert } from '@/hooks/use-permission-auto-revert'
import { useSlashCommands } from '@/hooks/use-slash-commands'
import { usePermissionModeCycle } from '@/hooks/use-permission-mode-cycle'
import { useSlashAction } from '@/hooks/use-slash-action'
import { CHAT_ATTACHMENT_ACCEPT, useMessageReferences } from '@/hooks/use-message-references'
import { useContextSelector } from '@/hooks/use-context-selector'
// V3 第 61 票:`@` 与 `#` 的「有哪些维度」与「触发符怎么解」都归到引擎那一份表,
// 本组件不再自写触发正则、不再自持九类目表、也不再自持一份 # 侧 chip 局部 state。
import { parseMentionTrigger } from '@ihui/shared/chat/mention-engine'
import { ContextSelectorPopover } from '@/components/ai/context-selector-popover'
import { useAgentMdReference, AGENT_REF_PREFIX } from '@/hooks/use-agent-md-reference'
import { useMessageSend } from '@/hooks/use-message-send'
import { usePromptDrafts } from '@/hooks/use-prompt-drafts'
import { usePromptHistory } from '@/hooks/use-prompt-history'
import { useMentionFiles, useAiSkills } from '@/hooks/use-lazy-resource-hooks'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import { Tooltip } from '@/components/feedback'
import { toast } from '@/components/common'
import { useChatStore } from '@/stores/chat'
import { answerSideQuestion } from '@/hooks/use-chat/slash-commands'
// D38 队列语义完整交互(G-42):交互条只做展示与回调上抛,许可判定一律走 D69 的
// queueInteractionPerms(与本文件下方 queueCtx 同一对象),动作落 store 的四个新 action。
import { QueueInteractionBar } from '@/components/chat/queue-interaction-bar'
// V3 #69(2026-09-27):输入框上方的会话窗口额度实时进度条(budget 帧驱动,与压缩状态条同族同位)
import { ContextBudgetBar } from '@/components/chat/context-budget-bar'
// D155(2026-09-29):输入框上方的下行告警条(config-warning/deprecation-notice/guardian-warning
// 三档帧驱动,与额度进度条同族同位;未收到帧不渲染不占位)
import { StreamAlertBar } from '@/components/chat/stream-alert-bar'
import { ConnectionStatusBar } from '@/components/chat/connection-status-bar'
import { queueInteractionPerms } from '@ihui/shared/chat/input-notices'
import type { FollowUpMode } from '@ihui/shared/chat/queue-interactions'
import { useAiPanelStore } from '@/stores/ai-panel'
import { getMessages } from '@ihui/api-client'
import { MARKET_PLUGINS, PROJECT_PLUGINS, getPluginIntegration } from '@plugins-data'
import { AiSkillInvokeDialog, AiSkillResultDialog } from '@/components/chat/skill-library'
import type { AiSkillMeta, AiSkillInvokeResponse } from '@ihui/api-client/endpoints/ai-skills'
// 权限档取词(G-166):档位归一与词表键的共享真相源,见 packages/shared/src/chat/permission-tier.ts
// (2026-09-30 底栏单行化:权限徽章标题行删除,permissionTierText 直读点迁入
//  permission-mode-popover / permission-history-panel,本文件不再直读)
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
  /** 形态(2026-09-30 底栏单行化):
   *  - 'toolbar'(默认):原工具栏紧凑按钮,单测 Harness 直接渲染的就是这一形态;
   *  - 'menu-item':"添加"菜单内的菜单项行(带相位说明,menuitem 语义) */
  variant?: 'toolbar' | 'menu-item'
}

/**
 * D82 润色入口按钮。
 * 判定与取词都走共享层 / 词包:`disabled` 由 `canStartPolish(state.draft)` 决定,
 * 文案走 `ai.pane.promptPolish.*`,**不硬编码中文**。
 */
export function PromptPolishEntry({
  state,
  disabled,
  onPolish,
  variant = 'toolbar',
}: PromptPolishEntryProps) {
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
  const disabledReason = emptyDraft ? 'emptyDraft' : 'none'
  if (variant === 'menu-item') {
    return (
      <button
        type="button"
        role="menuitem"
        data-testid="prompt-polish-entry"
        data-polish-phase={state.phase}
        data-polish-key={polishPhaseKey(state.phase)}
        data-polish-disabled-reason={disabledReason}
        disabled={disabled === true || busy || emptyDraft}
        onClick={onPolish}
        aria-label={t('ariaLabel')}
        className={cn(
          'flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors',
          'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <Wand2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t('entryLabel')}</span>
        <span className="shrink-0 text-[10px] text-muted-foreground">{phaseLabel[state.phase]}</span>
      </button>
    )
  }
  return (
    <button
      type="button"
      data-testid="prompt-polish-entry"
      data-polish-phase={state.phase}
      data-polish-key={polishPhaseKey(state.phase)}
      data-polish-disabled-reason={disabledReason}
      disabled={disabled === true || busy || emptyDraft}
      onClick={onPolish}
      aria-label={t('ariaLabel')}
      title={`${t('entryLabel')} · ${phaseLabel[state.phase]}`}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
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
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [mentionOpen, setMentionOpen] = React.useState(false)
  // D68 统一多源建议面板:单一聚合入口(工具栏按钮),旧三浮层入口原样保留不回归。
  const tSuggest = useTranslations('unifiedSuggestion')
  const [unifiedOpen, setUnifiedOpen] = React.useState(false)
  const [unifiedCapRejected, setUnifiedCapRejected] = React.useState(false)
  const [pastedRefPreviews, setPastedRefPreviews] = React.useState<PastedReferencePreview[]>([])
  const unifiedAddedIdsRef = React.useRef<Set<string>>(new Set())
  // V3 第 61 票(2026-09-27):`@` 与 `#` 的提及状态与正文落点都收进 useMentionWiring(下方,
  // 需在 inputCoreRef 之后构造)—— 这里原先是一份 contextChips 局部 state + addContextChip +
  // removeContextChip,与 stores/context-mention 并存的第二份提及状态,正是票面「两套引擎」的一半。
  // references 状态管理(2026-07-29 提取到 useMessageReferences hook):
  // - addFileReference / addTextReference / addCodeReference 三种类型添加
  // - removeReference 移除 + 释放 objectURL
  // - resetReferences 发送后清空
  // G-833(2026-09-29):附件三档校验批量入口与预筛/提交拆分(选/拖/贴入口聚合提示用)
  const {
    references,
    addFileReference,
    addFileReferences,
    screenAttachments,
    commitFileReference,
    addTextReference,
    removeReference,
    resetReferences,
  } = useMessageReferences()
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
  // V3 第 61 票:`@` / `#` 提及的唯一落点(写那份 store + 把 insertText 顶进正文 + 摘 chip 删正文)。
  // 判定的那一份实现在 @ihui/shared/chat/mention-engine,这里只是接线(可被 renderHook 直接验)。
  const mentionWiring = useMentionWiring({ setValue, inputRef: inputCoreRef })
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
    // G-833:批量校验 + 预筛/提交拆分入口,供选/拖/贴三入口"先聚合再报"
    addFileReferences,
    screenAttachments,
    commitFileReference,
    addTextReference,
    onSend,
    inputCoreRef,
    draftKey,
    onSent: promptHistory.pushSent,
  })
  // W20 九类 # 上下文选择器(键盘导航在 textarea 层拦截);
  // V3 第 61 票:选中结果的落点从局部 chip state 改成那份唯一的 mention engine store。
  const contextSelector = useContextSelector({
    value,
    setValue,
    inputRef: inputCoreRef,
    onSelect: mentionWiring.addMention,
  })
  // AI Skills 列表 + @ 提及文件列表:懒加载逻辑已提取到 use-lazy-resource-hooks(2026-07-30)
  const { aiSkills, skillsLoading } = useAiSkills(slashOpen)
  const { mentionFiles } = useMentionFiles(mentionOpen || unifiedOpen)
  // D68:把 @ 提及文件映射为建议面板 file 源条目(复用 useMentionFiles 懒加载链,
  // 不新建第二条取数出口;provenance 取 file 源默认档 userRemote —— 文件经服务端资产库)
  const unifiedFileItems = React.useMemo<UnifiedSuggestionItem[]>(
    () =>
      mentionFiles.map((f) => ({
        id: `file:${f.id}`,
        source: 'file' as const,
        label: f.name,
        detail: f.path,
      })),
    [mentionFiles],
  )
  const unifiedSuggestions = useUnifiedSuggestions(unifiedOpen, unifiedFileItems)
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
  const shiftSideQuestion = useChatStore((s) => s.shiftSideQuestion)
  // D38 队列模式偏好(steer=插话优先 / queue=排队优先),持久化在 chat store
  const followUpQueueMode = useChatStore((s) => s.followUpQueueMode)
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
  // W27(2026-09-14)→ D36(2026-09-28):草稿持久化收编进 usePromptDrafts hook ——
  // 防抖写入、会话切换回写/载入、超长截断、桶配额淘汰都在 hook + shared 纯逻辑里,
  // 本组件只保留 draftKey 计算(与 useMessageSend 清稿同源)与 resize 回调接线。
  usePromptDrafts({
    draftKey,
    value,
    setValue,
    onRestored: React.useCallback(() => {
      requestAnimationFrame(() => inputCoreRef.current?.resize())
    }, []),
  })

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
    // V3 第 61 票:`@` / `#` 的触发态一律问引擎(parseMentionTrigger),本文件不再自写正则。
    // 行为与收口前逐字一致:光杆 `@` 才打开文件浮层,`@` 触发态消失才关。
    const trigger = parseMentionTrigger(next)
    if (trigger?.sigil === '@' && trigger.bare && !mentionOpen) {
      setMentionOpen(true)
    } else if (mentionOpen && trigger?.sigil !== '@') {
      setMentionOpen(false)
    }
  }

  // D68 建议面板选中:引用上限判定(拒收必须可见回显,不静默丢)+ 按源插入形态。
  // file → 反引号 path(与 @ 提及既有插入同形态);skill → /skill 模板(与斜杠面板同形态);
  // 其余源 → 反引号 label 引用标签。引用标签只是上下文引用,不新增执行授权
  // (面板底部有可见声明,见 unified-suggestion-panel.tsx)。
  const handleUnifiedSelect = (item: UnifiedSuggestionItem) => {
    const { kept, rejected } = capReferences(unifiedAddedIdsRef.current.size, [item])
    if (rejected.length > 0) {
      setUnifiedCapRejected(true)
      return
    }
    setUnifiedCapRejected(false)
    for (const k of kept) unifiedAddedIdsRef.current.add(k.id)
    const snippet =
      item.source === 'skill'
        ? `/skill ${item.label} `
        : `\`${item.source === 'file' ? (item.detail ?? item.label) : item.label}\` `
    setValue((prev) => {
      const merged = prev && !prev.endsWith(' ') ? `${prev} ${snippet}` : `${prev}${snippet}`
      return merged.slice(0, MAX_LENGTH)
    })
    setUnifiedOpen(false)
    requestAnimationFrame(() => {
      inputCoreRef.current?.focus()
      inputCoreRef.current?.resize()
    })
  }

  // D68 粘贴引用有效性预览:在既有 handlePaste 之前把剪贴板文本里的 @token / 反引号
  // path 与当前已知文件集比对,结果可见呈现在输入区上方(可关闭);粘贴行为本身零变更。
  const handlePasteWithReferencePreview = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData?.getData('text') ?? ''
    const previews = previewPastedReferences(text, {
      paths: mentionFiles.map((f) => f.path),
      labels: mentionFiles.map((f) => f.name),
    })
    if (previews.length > 0) setPastedRefPreviews(previews)
    handlePaste(e)
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
  // D117(2026-09-27):实现抽到 use-chat/manual-compact.ts 的 runManualCompact 单一实现,
  // /compact 斜杠命令复用同一函数;此处只保留按钮 loading 态与流式守卫。
  const [compacting, setCompacting] = React.useState(false)
  const handleCompact = React.useCallback(async () => {
    const id = useChatStore.getState().conversationId
    if (!id || compacting || isStreaming) return
    setCompacting(true)
    try {
      await runManualCompact(id, t)
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

  // D38 起:侧问队列的「删除/立即补答」入口由 QueueInteractionBar 的 undo 与
  // interruptAndRun 两动词承担,故删去 D28 的两个本地 handler(不留第二条移除路径)。
  // D38「打断并执行」:计划由判定层产出(只含 stopFirst/thenRun),停流走 W2 既有 onStop
  // (abortRef.abort 链),取队首走 store 的 interruptAndRun —— 与 shiftSideQuestion 同为
  // queue[0] 读取路径,宿主与组件都不写第三种队首语义。
  const handleInterruptAndRun = React.useCallback(
    (plan: { readonly stopFirst: boolean; readonly thenRun: string | null }) => {
      if (!conversationId || !plan.thenRun) return
      if (plan.stopFirst) onStop()
      const head = useChatStore.getState().interruptAndRun(conversationId)
      if (head && head.id === plan.thenRun) answerWithToast(head.text)
    },
    // answerWithToast 是 useCallback 稳定引用,列入依赖防闭包读旧 conversationId
    [conversationId, onStop, answerWithToast],
  )

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
        {/* D154:MCP 连不上/重连中的对话内状态行(帧来自 /ws/broadcast,常态零占位) */}
        <McpStatusNotice />
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
        {/* 多维提及 chips(V3 第 61 票收口):`@` 与 `#` 两条路的已选提及都在
            stores/context-mention 那一份状态里,由这一个面渲染;摘 chip 同步删正文。 */}
        <MentionChips onRemove={mentionWiring.removeSelection} />
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
        {/* D38(G-42)接管 D28 侧问队列渲染:五动词交互条(重排/撤回/编辑/打断并执行/模式切换)。
            许可判定复用 D69 queueInteractionPerms(与 InputNoticeBanner 同一函数,不另立第二套);
            runtimeSupportsInterjection 暂恒 false —— 全仓尚无该能力协商的生产者(D69 banner 亦未挂载),
            诚实降级为"回落排队优先 + 打断入口显式渲染被拒原因",不得端内自建能力判定。
            D162:blockCtx 只喂本面**真实已知**的条件(Runtime 不支持插话 / 流式中 Turn 在跑 /
            队列非空即有等待请求);queueChanged / 控制命令 / 来源匹配现无生产者,恒 false,
            待各自回传链路落地后接线 —— 不臆造状态。 */}
        <QueueInteractionBar
          items={(sideQueue ?? []).map((sq) => ({ id: sq.id, text: sq.text }))}
          perms={queueInteractionPerms({
            runtimeSupportsInterjection: false,
            streaming: isStreaming,
            hasQueuedMessages: (sideQueue?.length ?? 0) > 0,
          })}
          blockCtx={{
            runtimeSupportsInterjection: false,
            hasRunningTurn: isStreaming,
            hasWaitingRequests: isStreaming && (sideQueue?.length ?? 0) > 0,
            isControlCommand: false,
            queueChanged: false,
            sourceMatches: false,
          }}
          mode={followUpQueueMode}
          runtimeSupportsInterjection={false}
          streaming={isStreaming}
          onReorder={(from, to) => {
            if (conversationId) useChatStore.getState().requeue(conversationId, from, to)
          }}
          onUndo={(id) => {
            if (conversationId) useChatStore.getState().removeQueued(conversationId, id)
          }}
          onEdit={(id, text) => {
            if (conversationId) useChatStore.getState().editQueued(conversationId, id, text)
          }}
          onModeChange={(mode: FollowUpMode) => useChatStore.getState().setFollowUpQueueMode(mode)}
          onInterruptAndRun={handleInterruptAndRun}
        />
        {/* V3 #69:额度实时进度条(warning 琥珀 / critical 红);未收到 budget 帧时整条不渲染不占位 */}
        <ContextBudgetBar />
        {/* D155:下行告警条(配置告警/弃用预告/守护告警三档);未收到告警帧时整条不渲染不占位 */}
        <StreamAlertBar />
        {/* D131:连接状态位(仅异常态常驻)—— 正常"已连接/连接中"不渲染不占位,
            只有重连中 / 已断开才在这一行 chrome 里出现;状态推导复用
            progress-sections/connection-status 的同一份 deriveConnectionState。 */}
        <ConnectionStatusBar isStreaming={isStreaming} threadId={conversationId} />
        {/* D68 粘贴引用有效性预览条(可见、可关闭;无可预览引用时不渲染不占位) */}
        <UnifiedPasteReferencePreview
          previews={pastedRefPreviews}
          onDismiss={() => setPastedRefPreviews([])}
        />
        <div ref={inputAreaRef} className="relative">
          <FileMentionPopover
            files={mentionFiles}
            open={mentionOpen}
            anchorRef={inputAreaRef}
            onSelect={mentionWiring.applyAtSelection}
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
          {/* D68 统一多源建议面板:六源(任务/技能/插件/连接器/Agent/文件)聚合为单一建议面。
              上方 @ / # / 斜杠 三个旧浮层挂载一律保留(硬验收「旧三浮层入口不回归」)。 */}
          <UnifiedSuggestionPanel
            open={unifiedOpen}
            anchorRef={inputAreaRef}
            onClose={() => setUnifiedOpen(false)}
            states={unifiedSuggestions.states}
            onSelect={handleUnifiedSelect}
            onRetry={unifiedSuggestions.retry}
            capRejected={unifiedCapRejected}
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
                ? 'border-brand-accent-deep ring-2 ring-ring/20'
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
            {/* 浮窗折叠态:窄拖拽条(2026-09-30 底栏单行化)—— 仅 floatHeader(展开/停靠/最小化)
                存在时才渲染,只剩拖拽热区把手 + 浮窗按钮组;原顶部控件栏(任务进度/权限/历史/添加)
                全部降位到底部工具栏,输入卡恒 2 行(textarea 行 + 唯一底栏),对标 Trae/Qoder/Codex。
                拖拽回调绑定在条上(handleFloatDragStart 自身排除 button 目标:点按钮仍是点击,
                拖空白处/按钮间隙才是拖动) */}
            {floatHeader && (
              <div
                onPointerDown={onFloatDragStart}
                className={INPUT_ATTACHMENT_BAR_CLASS}
                data-toolbar-float-merged="v3"
              >
                <span className="h-1 w-10 rounded-full bg-border/70" aria-hidden="true" />
                <div className="ml-auto flex cursor-move items-center gap-1">{floatHeader}</div>
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
              onPaste={handlePasteWithReferencePreview}
            />
            {/* 底部工具栏(2026-09-30 底栏单行化,深度对标 Trae/Qoder/Codex 输入卡):
                单行两簇 —— 左簇"任务进度 + 添加",右簇"权限 + 模式 + 上下文 + 模型 + 语音 + 发送"。
                相比旧版(顶部栏 5 控件 + 权限标题行 + 底栏 9 控件,三处堆叠):
                - 顶部栏控件全部降位:任务进度→底栏左簇;权限→底栏右簇 icon-only;
                  历史→权限弹层内嵌;权限标题行/徽章行整行删除
                - 多源建议 / 一键润色 → "添加"菜单收纳(extraMenuItems);
                - 推理强度轴(D130)+ 采样参数 → 模型弹层 footer(footer prop)。
                容器降级阶梯见 globals.css .ai-input-toolbar(原生 CSS container query)。 */}
            <div className="ai-input-toolbar flex min-w-0 items-center gap-1 overflow-hidden px-2 pb-2 pt-1">
              {/* ── 左簇:任务进度 + 添加 ───────────────────────────────────── */}
              {/* leftIcon 固定为任务清单语义(2026-09-30 用户指出双锤子:
                  默认跟随当前模式取图标 → build 档与 ModeSwitcher 的 Hammer 同屏撞脸;
                  本入口语义是"任务进度面板",对标 Trae/Qoder 任务列表用 ListTodo) */}
              <AgentProgressTrigger iconOnly leftIcon={ListTodo} />
              {/* "添加"下拉菜单(2026-07-25 终极整合,2026-07-30 提取到 AddMenuPopover 子组件)
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
                extraMenuItems={
                  <>
                    {/* D68 统一多源建议面板入口(2026-09-30 底栏单行化收纳):单一聚合建议面。
                        不新增全局快捷键,复用面板内 ↑↓/Enter/ESC 键位。 */}
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={tSuggest('title')}
                      aria-haspopup="dialog"
                      data-testid="unified-suggestion-entry"
                      disabled={isStreaming}
                      onClick={() => {
                        setAddMenuOpen(false)
                        setAddMenuMode('menu')
                        setUnifiedOpen(true)
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-xs transition-colors',
                        'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <ListFilter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{tSuggest('title')}</span>
                    </button>
                    {/* D82 一键润色入口(2026-09-30 底栏单行化收纳):对当前草稿**就地改写**
                        (空草稿禁用),失败保稿见输入卡上方提示条 */}
                    <PromptPolishEntry
                      state={polish}
                      disabled={isStreaming}
                      variant="menu-item"
                      onPolish={() => {
                        handlePolish()
                        setAddMenuOpen(false)
                        setAddMenuMode('menu')
                      }}
                    />
                  </>
                }
              />
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
              <input
                ref={fileInputRef}
                type="file"
                // G-833:accept 不再写死串 —— 由 use-message-references 的 UPLOADABLE_EXTENSIONS
                // 唯一白名单派生(CHAT_ATTACHMENT_ACCEPT),两处漂移即消除;拖拽/粘贴路径的
                // 同口径校验(浏览器 accept 可被拖拽绕过)已由 screenAttachmentFiles 三档判据兜住
                accept={CHAT_ATTACHMENT_ACCEPT}
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              {/* ── 右簇:权限 + 模式 + 上下文 + 模型 + 语音 + 发送 ─────────────── */}
              <div className="ml-auto flex min-w-0 items-center justify-end gap-1">
                {/* 权限模式(2026-09-30 icon-only 化):盾/手/罗盘/警盾图标 + 档位色语义,
                    档名走 Tooltip;弹层内含模式卡片 + 高危说明 ⓘ + 历史内嵌段 */}
                <PermissionModePopover
                  disabled={isStreaming}
                  onExplainMode={(mode) => setInfoMode(mode)}
                />
                {/* 模式选择器(2026-09-13 矩阵 A #24):同会话模式切换的可见控件,
                    与 / 命令、Ctrl+1-5、AI 自动判断三通道共用 useModeStore 单一状态源 */}
                <ModeSwitcher disabled={isStreaming} />
                {/* 高级参数入口(P1-7)与推理强度轴收纳进模型弹层 footer,见 ModelSelector */}
                <ContextUsageRing model={model} isStreaming={isStreaming} />
                {/* 模型选择器 + footer(推理强度轴 D130 + 采样参数 P1-7):
                    D130 守门判据要求 <ReasoningEffortInputAxis model={model} 挂载行留在本文件,
                    footer 节点即该挂载点 —— 摘掉它档位就永远进不了请求(测试①③) */}
                <ModelSelector
                  value={model}
                  onChange={onModelChange}
                  label={modelLabel}
                  footer={
                    <>
                      <ReasoningEffortInputAxis model={model} disabled={isStreaming} />
                      {/* 高级参数入口(P1-7,2026-09-13):temperature/top_p/top_k/max_tokens +
                          自定义 system prompt,会话级持久化,随请求下发 LLM 网关 */}
                      <SamplingParamsButton disabled={isStreaming} />
                    </>
                  }
                />
                {/* 语音入口整合:单一 Mic 按钮直接触发语音转文字,挨着发送键 */}
                <VoiceToolbar onTranscript={handleVoiceTranscript} disabled={isStreaming} />
                {/* 发送/停止(2026-09-30 修订,用户规则:项目禁止圆形发送按钮,改方形 rounded-sm;
                    空输入禁用(灰),有内容 bg-cta 主色 + ArrowUp;
                    流式中切 Steer(琥珀,中途引导)+ Stop(天蓝),同规格方形 */}
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
                            'inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors',
                            value.trim()
                              ? 'bg-amber-500 text-white hover:bg-amber-600'
                              : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                          )}
                          aria-label={t('steer')}
                          data-testid="steer-button"
                        >
                          <Zap className="h-4 w-4" />
                        </button>
                      </span>
                    </Tooltip>
                    <Tooltip content={stopLabel ?? t('stop')}>
                      <button
                        type="button"
                        onClick={onStop}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-sm bg-sky-500 text-white hover:bg-sky-600"
                        aria-label={stopLabel ?? t('stop')}
                      >
                        <Square className="h-4 w-4" fill="currentColor" />
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
                          'inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors',
                          canSend
                            ? 'bg-cta text-cta-foreground hover:bg-cta/90'
                            : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                        )}
                        aria-label={sendLabel ?? t('send')}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                    </span>
                  </Tooltip>
                )}
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
      {/* D117:/diff 会话改动总览弹窗(全局单实例) */}
      <SessionDiffDialog />
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
