// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Square, Zap, Wand2, ListFilter, ListTodo, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { VoiceToolbar } from './voice-toolbar'
import { readHandsFree } from '@/components/chat/voice-stream-speaker'
import { ModelSelector } from '@/components/chat/model-selector'
import { ContextUsageRing } from '@/components/ai/context-usage-ring'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import type { SelectedToolItem } from '@/components/chat/selected-tools-panel'
import { ContextChipsRow } from '@/components/chat/context-chips-row'
import { useContextMentionStore } from '@/stores/context-mention'
import { useMentionWiring } from '@/hooks/use-mention-wiring'
// D68 统一多源建议面板(2026-09-26):六源聚合 + 逐源来源标注 + 部分失败三句降级 +
// 粘贴引用有效性预览;"旧三浮层入口不回归"为硬验收,FileMentionPopover /
// ContextSelectorPopover / SlashCommandPalette 的挂载与触发一律原样保留。
import { UnifiedSuggestionPanel } from '@/components/chat/unified-suggestion-panel'
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
// P3 #30 diff 意见条 / D154 MCP 状态行(2026-09-30 起)由 InputStatusSlot 统一按优先级挂载
// 任务进度常驻状态条:输入框上方动态显示"在做什么 / 第几步 / 改了多少文件",plan_updated 驱动
import { TaskStatusBar } from '@/components/ai/task-status-bar'
import { AddMenuPopover } from '@/components/chat/add-menu-popover'
import { INPUT_ATTACHMENT_BAR_CLASS } from '@/lib/nav-styles'
import { usePermissionAutoRevert } from '@/hooks/use-permission-auto-revert'
import { useSlashCommands } from '@/hooks/use-slash-commands'
import { usePermissionModeCycle } from '@/hooks/use-permission-mode-cycle'
import { useSlashAction } from '@/hooks/use-slash-action'
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MAX_FILES,
  canSendReferences,
  useMessageReferences,
} from '@/hooks/use-message-references'
import { useContextSelector } from '@/hooks/use-context-selector'
// V3 第 61 票:`@` 与 `#` 的「有哪些维度」与「触发符怎么解」都归到引擎那一份表,
// 本组件不再自写触发正则、不再自持九类目表、也不再自持一份 # 侧 chip 局部 state。
import { parseMentionTrigger } from '@ihui/shared/chat/mention-engine'
import { ContextSelectorPopover } from '@/components/ai/context-selector-popover'
import { useAgentMdReference, AGENT_REF_PREFIX } from '@/hooks/use-agent-md-reference'
import { useMessageSend } from '@/hooks/use-message-send'
// D166 链接预览(承 V4 §9.4③):粘贴 http(s) 链接的发送前可达性提示卡
import { useLinkPreview } from '@/hooks/use-link-preview'
import { LinkPreviewCard } from './link-preview-card'
import { peekInitialDraft, usePromptDrafts } from '@/hooks/use-prompt-drafts'
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
// V3 #69 额度条 / D155 下行告警条 / D131 连接状态位(2026-09-30 起)由 InputStatusSlot 统一挂载
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
  canStartPolish,
  createPolishState,
  polishPhaseKey,
  type PolishPhase,
  type PromptPolishState,
} from '@ihui/shared/chat/prompt-polish'

// A 节单状态槽(2026-09-30 深度对标二轮):六源通知按优先级单槽展开 + +N 弹层
import { InputStatusSlot } from './input-status-slot'

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
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {phaseLabel[state.phase]}
        </span>
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
  // 2026-10-06(O59⑤):改走加密通道。桌面端值是密文、peekSync 恒返 null ⇒ 初值先空,
  // 由 usePromptDrafts 内部解密完成后一次性回填(机主拍板:不闪旧明文)。
  const [value, setValue] = React.useState(() => {
    if (typeof window === 'undefined') return ''
    const convId = useChatStore.getState().conversationId
    return peekInitialDraft(convId ? `chat:draft:${convId}` : 'chat:draft')
  })
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [mentionOpen, setMentionOpen] = React.useState(false)
  // D68 统一多源建议面板:单一聚合入口(工具栏按钮),旧三浮层入口原样保留不回归。
  const tSuggest = useTranslations('unifiedSuggestion')
  const [unifiedOpen, setUnifiedOpen] = React.useState(false)
  const [unifiedCapRejected, setUnifiedCapRejected] = React.useState(false)
  // D 节(2026-09-30 深度对标二轮):空态 followup 建议行的关闭记忆 —— 用户点 X 后
  // 本挂载周期(切会话会重挂)不再自动出现;点任一 chip 填入内容后行自然消失。
  const [followupDismissed, setFollowupDismissed] = React.useState(false)
  const [pastedRefPreviews, setPastedRefPreviews] = React.useState<PastedReferencePreview[]>([])
  // D166 链接预览(2026-10-02 接线):粘贴文本带 http(s) 链接时轻量探测一次(同 URL
  // 单实例只发一次,后端 3s 时限),输入区上方三态卡呈现 —— 读到了(标题/摘要)/
  // 读不到(404/410/5xx)/未判定(需登录/超时/内网,未判定 ≠ 读不到)。
  // fire-and-forget:预览失败绝不阻断发送(票面显式断言,探测侧已自证)。
  const linkPreview = useLinkPreview()
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
    retryReference,
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
  // G-845:空输入框上按 Backspace 删最后一个附件(判据与消费在 WebInputCore 内部,
  // 这里是附件清单与 remove 出口的接线;removeReference 由 use-message-references 提供,只调用不改)。
  // 取 references(用户添加的附件)而非 allReferences:后者还并了自动加载的 agent 规则块,
  // 那是工作区上下文、不是附件,Backspace 不该删它。
  const handleRemoveLastAttachment = React.useCallback(() => {
    const last = references[references.length - 1]
    if (!last) return false
    removeReference(last.id)
    return true
  }, [references, removeReference])

  const allReferences = React.useMemo(() => {
    const visibleAgentRefs = agentMdRefs.filter((r) => !dismissedAgentIds.has(r.id))
    return [...visibleAgentRefs, ...references]
  }, [agentMdRefs, dismissedAgentIds, references])
  // 共享层 WebInputCore 内部托管 textarea ref + 自动高度(forwardRef 暴露 focus/setSelectionRange/resize)
  const inputCoreRef = React.useRef<WebInputCoreHandle>(null)
  // V3 第 61 票:`@` / `#` 提及的唯一落点(写那份 store + 把 insertText 顶进正文 + 摘 chip 删正文)。
  // 判定的那一份实现在 @ihui/shared/chat/mention-engine,这里只是接线(可被 renderHook 直接验)。
  const mentionWiring = useMentionWiring({ setValue, inputRef: inputCoreRef })
  // 统一上下文容器「全空不渲染」判定用(渲染仍由容器内 MentionChips 订阅 store 自理)
  const hasMentions = useContextMentionStore((s) => s.mentions.length > 0)
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
  // D166:发送即收卡 —— 包装保持 submit 原签名 `(overrideValue?: string) => Promise<void>`,
  // 发送动作与结果零变更,仅在发送链启动后关闭链接预览卡(探测失败本就不阻断发送)。
  const submitAndDismissLinkPreview = (overrideValue?: string): Promise<void> => {
    const result = submit(overrideValue)
    result.catch(() => {}).finally(() => linkPreview.reset())
    return result
  }
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
  // D 节(2026-09-30 深度对标二轮):空输入且建议未加载时也触发同一懒加载链(open 条件
  // 并上 followupWanted),加载完成后 chips 行出现在输入卡正上方;面板与空态共用一份数据,
  // loadedRef 保证不重复请求。file 源仍只随 @/# 入口加载(空态文件建议价值低,不扩触发面)。
  const isInputEmpty = value.trim().length === 0
  const followupWanted = isInputEmpty && !unifiedOpen && !followupDismissed
  const unifiedSuggestions = useUnifiedSuggestions(unifiedOpen || followupWanted, unifiedFileItems)
  // 空态建议取数:按六源固定顺序,取 ready 源条目的前 4 条;未就绪/全空则不渲染(零占位)。
  const followupItems = React.useMemo<UnifiedSuggestionItem[]>(() => {
    if (!followupWanted) return []
    const picked: UnifiedSuggestionItem[] = []
    for (const state of unifiedSuggestions.states) {
      if (state.status !== 'ready') continue
      for (const item of state.items) {
        picked.push(item)
        if (picked.length >= 4) return picked
      }
    }
    return picked
  }, [followupWanted, unifiedSuggestions.states])
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
  // D184(2026-09-29 立,对标竞品 chatSession.selectionActions):选中文本作为附件 ——
  // MessageItem「作为附件添加」按钮派发 ihui:add-selection-attachment,此处包装为
  // "选中的文本.txt" 附件文件走 addFileReferences 三档校验(G-833)通道;容量满(max_files)
  // 时以 attachmentLimitReached 文案回报(竞品串"附件已达 {limit} 个,请先移除一个再添加选中文本。")。
  React.useEffect(() => {
    const onAddSelectionAttachment = (e: Event) => {
      const text = (e as CustomEvent<{ text?: string }>).detail?.text
      const trimmed = typeof text === 'string' ? text.trim() : ''
      if (!trimmed) return
      const file = new File([trimmed], `${t('selectionActions.attachmentName')}.txt`, {
        type: 'text/plain',
      })
      const rejections = addFileReferences([file])
      if (rejections.some((r) => r.code === 'max_files')) {
        toast.error(
          t('selectionActions.attachmentLimitReached', { limit: CHAT_ATTACHMENT_MAX_FILES }),
        )
      }
    }
    window.addEventListener(
      'ihui:add-selection-attachment',
      onAddSelectionAttachment as EventListener,
    )
    return () =>
      window.removeEventListener(
        'ihui:add-selection-attachment',
        onAddSelectionAttachment as EventListener,
      )
  }, [addFileReferences, t])
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
  // b75-5#1:附件未到 ready(uploading/error/terminal)时阻发,防附件断链
  const refsReady = canSendReferences(references).canSend
  const canSend = value.trim().length > 0 && refsReady
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
        void submitAndDismissLinkPreview(draftInput)
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
    // D166:粘贴文本带链接时探测可达性(同 URL 只发一次;粘贴行为本身零变更)
    linkPreview.probeFromPaste(text)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, localComposing = false) => {
    // G-862 IME 组合守卫**必须在 contextSelector 之前**。原先它落在
    // `contextSelector.handleKeyDown(e)` 之后(只在 ↑↓ 历史那档的条件下被读到),
    // 于是中文输入法候选窗开着时按 Enter、且 # 面板有匹配项:第一行先被
    // contextSelector 消费成"选中",守卫根本没机会跑 ⇒ 行为变成"选中"而非
    // "发送/保留候选"。两条腿取或(事件腿 nativeEvent.isComposing ‖ 本地腿
    // localComposing —— 后者由 WebInputCore 的 compositionstart/end 经 onKeyDown
    // 第二参透传,住在子组件 state 里,外部单腿读事件腿会在"候选窗已关、
    // compositionend 未落"那一次 keydown 上漏判)。
    // 放在最前面 = 组合期整段键盘交还输入法,面板与提交都不得消费。
    if (e.nativeEvent.isComposing || localComposing) return
    // W20 九类 # 上下文选择器:键盘导航(↑/↓/Enter/Tab/Esc)前置拦截,消费则短路
    if (contextSelector.handleKeyDown(e)) return
    // G-816019:此处刻意**没有**外部 Enter 提交支 —— 本地 composition 腿住在 WebInputCore
    // 的 state 里,外部 handler 取不到;外部若自判提交就是单腿判定,"候选窗已关、
    // compositionend 未落"的边界会把半截中文发出去。Enter 提交完全交内部裁决
    // (shouldSubmitOnEnter 双腿判据,经 onSend={submitAndDismissLinkPreview} 同一出口),
    // 本 handler 只留 ↑↓ 历史 / Shift+Tab / Esc 三类与 Enter 无关的分支。
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
      <div className="mx-auto max-w-3xl px-4 pt-3 pb-px">
        {/* 高风险模式持久化视觉警告(2026-07-25 深化,深度对标 Codex 高风险提示)
            - 提取到 HighRiskWarningBanner 子组件(2026-07-30),行为零变更
            - 内部消费 useAiPanelStore 计算 isHighRisk + useTranslations('chat')
            - autoRevert 由主组件透传(标题栏倒计时与横幅倒计时共享同一份 tick) */}
        <HighRiskWarningBanner autoRevert={autoRevert} />
        {/* 任务进度常驻状态条:此刻最该被看到的动态信息(流式时自动展开明细,空闲时零占位) */}
        <TaskStatusBar />
        {/* A 节单状态槽(2026-09-30 深度对标二轮):断连/下行告警/MCP/润色保稿/diff 意见/
            额度 六源按优先级只展开一条,其余折叠 +N 徽章弹层;全 inactive 整体不渲染。
            高风险横幅与任务条是行动号召,保持槽外独立。 */}
        <InputStatusSlot
          isStreaming={isStreaming}
          threadId={conversationId}
          polish={polish}
          onPolishRetry={handlePolish}
        />
        {/* 统一上下文容器(2026-09-30 深度对标二轮):引用卡 / 已选工具卡 / 引用回复条 /
            提及 chips / 粘贴预览条 / 输入队列收进一个分组,间距由容器统一接管;
            全空时整体不渲染零占位。状态类通知不进容器(走下方状态区)。 */}
        <ContextChipsRow
          references={allReferences}
          onRemoveReference={handleRemoveReference}
          onRetryReference={retryReference}
          tools={selectedToolItems}
          onRemoveTool={removeSelectedTool}
          quoted={quotedMessage}
          onClearQuoted={() => setQuotedMessage(null)}
          hasMentions={hasMentions}
          onRemoveMention={mentionWiring.removeSelection}
          pastePreviews={pastedRefPreviews}
          onDismissPastePreviews={() => setPastedRefPreviews([])}
          // D185:模拟预览编辑器一键发送,走 composer 既有 submit(overrideValue) 通道
          onSendPastePreview={(text) => void submitAndDismissLinkPreview(text)}
          queueItems={pendingMessages}
          onQueueRemove={handleQueueRemove}
        />
        {/* D166 链接预览卡(2026-10-02 接线):粘贴 URL 的可达性三态提示 —— 竞品
            previewLoading / previewUnavailable 之外补"未判定"态(需登录/超时/内网,
            未判定 ≠ 读不到)。未探测/已关闭时零占位;发送或点 × 关闭。 */}
        <LinkPreviewCard preview={linkPreview.preview} onDismiss={linkPreview.reset} />
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
        {/* D 节(2026-09-30 深度对标二轮):空态 followup 建议行 —— 输入为空且建议数据就绪时,
            输入卡正上方给一条可关闭的建议 chips(对标 Cursor 空态引导);点击复用面板选中逻辑
            (填充不发送:skill → /skill 模板,其余 → 反引号引用);零占位情形:未就绪 /
            已关闭 / 有输入 / 面板开着。 */}
        {followupItems.length > 0 && (
          <div
            data-testid="input-followup-chips"
            aria-label={tSuggest('followupRowLabel')}
            className="mb-2 flex flex-wrap items-center gap-1.5"
          >
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {tSuggest('followupRowLabel')}
            </span>
            {followupItems.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-testid={`input-followup-chip-${i}`}
                title={item.detail ?? item.label}
                onClick={() => handleUnifiedSelect(item)}
                className="max-w-56 truncate rounded-sm border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              data-testid="input-followup-chips-dismiss"
              aria-label={tSuggest('followupDismiss')}
              onClick={() => setFollowupDismissed(true)}
              className="ml-auto shrink-0 rounded-sm p-1 text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )}
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
              暗色下 22% vs 卡片 10% 仅 12% 差距,输入框边界感丢失。
              2026-09-30 补:上面这段"设计意图"在此前**从未真的渲染过** —— Tailwind 的 border-* 颜色
              类名被 globals.css 那条未分层的 `*{border-color}` 整族压制,四态描边一直落在同一个灰。
              现描边色由 .ai-input-shell* 语义类在 globals.css 里给(见该处注释),此处只留结构类。*/}
          <div
            onDragOver={handleDragOverWithConversation}
            onDragLeave={handleDragLeaveWithConversation}
            onDrop={handleDropWithConversation}
            className={cn(
              // 聚焦反馈对标 Cursor:墨档描边(AGENTS §4「描边不得取墨档」的唯一例外位)
              // + 1px ring-ring/30 外圈 + 轻阴影;transition 扩到 box-shadow 让 ring 柔和浮现。
              // ring/shadow 属 box-shadow 轴,不受 `*{border-color}` 影响,故保留工具类写法。
              'ai-input-shell flex flex-col rounded-xl border bg-card transition-[border-color,box-shadow]',
              // 互斥的边框逻辑:拖拽(文件或会话) > 高风险 > 默认。
              // ring/shadow 聚焦反馈只加在默认分支 —— 高风险分支的琥珀 glow 与拖拽分支的
              // ring-2 各有专属视觉,focus-within 不去覆盖它们。
              isDragOver || isConvDragOver
                ? 'ai-input-shell--dragging ring-2 ring-ring/20'
                : isHighRisk
                  ? 'ai-input-shell--high-risk shadow-[0_0_0_1px_rgba(245,158,11,0.08)] animate-pulse-soft'
                  : 'ai-input-shell--idle focus-within:ring-1 focus-within:ring-ring/30 focus-within:shadow-sm',
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
              onSend={submitAndDismissLinkPreview}
              onStop={onStop}
              onClear={() => setValue('')}
              t={t}
              sendLabel={sendLabel}
              stopLabel={stopLabel}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onRemoveLastAttachment={handleRemoveLastAttachment}
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
                        data-testid="stop-button"
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
                        onClick={() => void submitAndDismissLinkPreview()}
                        disabled={!canSend}
                        className={cn(
                          'inline-flex h-9 w-9 items-center justify-center rounded-sm transition-colors',
                          canSend
                            ? 'bg-cta text-cta-foreground hover:bg-cta/90'
                            : 'cursor-not-allowed bg-muted text-muted-foreground/50',
                        )}
                        aria-label={sendLabel ?? t('send')}
                        data-testid="send-button"
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
        {/* AI 免责提示行放输入卡片外(2026-09-30 用户指定:对标 ChatGPT "can make mistakes" 在框外,
            不进圆角描边卡内;字号 text-[9px] + muted;上下间距对称各 1px:上方 mt-px(卡→字),
            下方由 wrapper pb-px 承担(字→底),2026-09-30 用户指定 6px→1px) */}
        <p className="mt-px text-center text-[9px] text-muted-foreground">{t('aiDisclaimer')}</p>
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
