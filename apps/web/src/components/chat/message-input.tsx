'use client'

import * as React from 'react'
import {
  Send,
  Square,
  SquareSlash,
  AtSign,
  X,
  Info,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { SlashCommandPalette } from '@/components/ai/slash-command-palette'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceInput } from '@/components/ai/voice-input'
import { ModelSelector } from '@/components/chat/model-selector'
import { ContextUsageRing } from '@/components/ai/context-usage-ring'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { SelectedToolsPanel, type SelectedToolItem } from '@/components/chat/selected-tools-panel'
import { MentionChips } from '@/components/chat/mention-popover'
import { CurrentModeBadge } from '@/components/chat/current-mode-badge'
import { WebInputCore, MAX_LENGTH, type WebInputCoreHandle } from './web-input-core'
import { PermissionModePopover, isHighRiskPermissionMode } from '@/components/ai/permission-mode-popover'
import { PermissionShortcutsModal } from '@/components/ai/permission-shortcuts-modal'
import { PermissionModeInfoModal } from '@/components/ai/permission-mode-info-modal'
import { PermissionHistoryPanel } from '@/components/ai/permission-history-panel'
import { AgentProgressTrigger } from '@/components/ai/agent-progress-trigger'
import { FullAccessConfirmBridge } from '@/components/chat/full-access-confirm-bridge'
import { HighRiskWarningBanner } from '@/components/chat/high-risk-warning-banner'
import { AddMenuPopover } from '@/components/chat/add-menu-popover'
import { usePermissionAutoRevert, formatRemaining } from '@/hooks/use-permission-auto-revert'
import { useSlashCommands } from '@/hooks/use-slash-commands'
import { usePermissionModeCycle } from '@/hooks/use-permission-mode-cycle'
import { useSlashAction } from '@/hooks/use-slash-action'
import { useMessageReferences } from '@/hooks/use-message-references'
import { useMessageSend } from '@/hooks/use-message-send'
import { useMentionFiles, useAiSkills } from '@/hooks/use-lazy-resource-hooks'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import { Tooltip } from '@/components/feedback'
import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { MARKET_PLUGINS, PROJECT_PLUGINS, getPluginIntegration } from '@plugins-data'

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
}: MessageInputProps) {
  const t = useTranslations('chat')
  const tA11y = useTranslations('a11y')
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
  // P1 草稿自动保存(2026-07-23):刷新/路由切换不丢失未发送内容
  const DRAFT_KEY = 'chat:draft'
  const [value, setValue] = React.useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(DRAFT_KEY) ?? ''
  })
  // 防抖写入 localStorage(避免每个 keystroke 写入)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DRAFT_KEY, value)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [value])
  const [slashOpen, setSlashOpen] = React.useState(false)
  const [mentionOpen, setMentionOpen] = React.useState(false)
  // references 状态管理(2026-07-29 提取到 useMessageReferences hook):
  // - addFileReference / addTextReference / addCodeReference 三种类型添加
  // - removeReference 移除 + 释放 objectURL
  // - resetReferences 发送后清空
  const {
    references,
    addFileReference,
    addTextReference,
    removeReference,
    resetReferences,
  } = useMessageReferences()
  // 共享层 WebInputCore 内部托管 textarea ref + 自动高度(forwardRef 暴露 focus/setSelectionRange/resize)
  const inputCoreRef = React.useRef<WebInputCoreHandle>(null)
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
  } = useMessageSend({
    value,
    setValue,
    isStreaming,
    isHighRisk,
    references,
    resetReferences,
    addFileReference,
    onSend,
    inputCoreRef,
    draftKey: DRAFT_KEY,
  })
  // AI Skills 列表 + @ 提及文件列表:懒加载逻辑已提取到 use-lazy-resource-hooks(2026-07-30)
  const { aiSkills, skillsLoading } = useAiSkills(slashOpen)
  const { mentionFiles } = useMentionFiles(mentionOpen)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // /permission 切换 toast 首弹记录(2026-07-29 提取到 useSlashAction hook):
  // - permissionToastShownRef / markPermissionToastShown / localStorage 持久化
  // - 已在 hook 内部管理,组件不再持有
  // "添加"下拉菜单状态(2026-07-25 合并):收纳"提示词模板 / 添加引用 / Skill 库 / 添加附件 / 插件市场"5 类动作
  // addMenuMode 决定 Popover content:
  // - menu:5 项主菜单(模板/引用/Skill 库/附件/插件)
  // - prompt:PromptTemplates 弹层
  // - skill:SkillLibrary 弹层
  const [addMenuOpen, setAddMenuOpen] = React.useState(false)
  const [addMenuMode, setAddMenuMode] = React.useState<'menu' | 'prompt' | 'skill'>('menu')
  // 消费 chat store 中的 draftInput(由 PromptTemplates 等外部触发),填充到 textarea 后清空
  const draftInput = useChatStore((s) => s.draftInput)
  const clearDraftInput = useChatStore((s) => s.clearDraftInput)
  // 已选工具(用户从插件市场点击"+"添加到对话的 pluginId 列表)
  const selectedToolsIds = useChatStore((s) => s.selectedTools)
  const removeSelectedTool = useChatStore((s) => s.removeSelectedTool)
  // 发送/清除按钮可用态(2026-07-29 用户规则:与外层 toolbar 同行显示,沿用 WebInputCore 旧逻辑)
  const canSend = !isStreaming && value.trim().length > 0
  const canClear = !isStreaming && value.length > 0
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
      requestAnimationFrame(() => inputCoreRef.current?.focus())
    }
  }, [draftInput, clearDraftInput])

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
    aiSkills,
    inputCoreRef,
    onSend,
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value.slice(0, MAX_LENGTH)
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
    setValue((prev) => {
      const merged = prev && !prev.endsWith(' ') ? `${prev} ${text}` : `${prev}${text}`
      return merged.slice(0, MAX_LENGTH)
    })
    requestAnimationFrame(() => inputCoreRef.current?.resize())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
      return
    }
    // Shift+Tab 全局循环切权限模式(2026-07-25 深化,深度对标 Codex CLI)
    // - 斜杠面板/提及面板打开时不抢(让面板用 Tab)
    // - 阻止默认焦点切换(浏览器默认 Shift+Tab 是反向 focus)
    // - 即使 textarea 内有输入也直接切换(Codex 行为:全局生效,非 textarea 局部)
    if (e.key === 'Tab' && e.shiftKey && !slashOpen && !mentionOpen) {
      e.preventDefault()
      void cyclePermissionMode()
    }
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
        {references.length > 0 && (
          <div className="mb-2">
            <ContextReferencePanel references={references} onRemove={removeReference} />
          </div>
        )}
        {selectedToolItems.length > 0 && (
          <div className="mb-2">
            <SelectedToolsPanel tools={selectedToolItems} onRemove={removeSelectedTool} />
          </div>
        )}
        {/* 多维 @ 提及 chips(2026-07-22 立,对标 Qoder Context Engineering) */}
        <MentionChips />
        <div className="relative">
          <FileMentionPopover
            files={mentionFiles}
            open={mentionOpen}
            onSelect={handleMentionSelect}
            onClose={() => setMentionOpen(false)}
          />
          {/* Agent 任务进度触发按钮(2026-07-28 v8 零窜位最终版,用户规则:
              trigger 在输入容器 div 外面上方居中,点击切换 store.open。
              v8 关键修复:trigger 永远渲染(删除原 v6 return null),
              open=true 时用 invisible pointer-events-none 占位 → inline 流位置零变化。
              popover 仍按 v6 原设计用 absolute right-2 top-2 浮在消息区右上角
              (用户特意要求,2026-07-28 立不可改),浮层不占流 → 周围内容零窜位。
              empty:hidden 兜底保留(防御未来回归)。 */}
          <div className="flex justify-center pb-1 empty:hidden">
            <AgentProgressTrigger />
          </div>
          {/* Trae 风格输入容器:描边卡片 + textarea 主区 + 底部工具栏。拖拽文件时高亮边框。
              高风险模式(bypass-permissions)时,边框使用琥珀色 + 轻微阴影以视觉警告 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'rounded-xl border bg-card transition-colors focus-within:border-foreground/20',
              // 互斥的边框逻辑:拖拽 > 高风险 > 默认
              isDragOver
                ? 'border-primary ring-2 ring-primary/20'
                : isHighRisk
                  ? 'border-amber-500/50 focus-within:border-amber-500/70 shadow-[0_0_0_1px_rgba(245,158,11,0.08)] animate-pulse-soft'
                  : 'border-border',
            )}
          >
            {/* 拖拽提示遮罩:仅在 isDragOver 时显示 */}
            {isDragOver && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-primary/5">
                <p className="text-sm font-medium text-primary">释放鼠标以添加附件(图片/视频)</p>
              </div>
            )}
            <div className="flex items-center gap-1 bg-muted/30 px-2 py-1.5">
              {/* Agent 任务进度触发按钮已移至上方居中(v6) */}
              {/* 权限模式切换(2026-07-25 立,深度对标 Codex approval mode):
                  盾牌图标 + 当前模式短名(完全访问 / 请求批准 / 替我审批),
                  点击弹 Codex 风格 popover,详见 PermissionModePopover 组件。 */}
              <PermissionModePopover disabled={isStreaming} />
              {/* 权限模式历史(2026-07-25 深化,放在附加栏跟盾牌按钮成组,与 popover 内"查看历史"互斥):
                  - trigger 按钮(Clock4 图标)作为 Popover 锚点,定位弹层
                  - 通过 window.__IHUI_OPEN_HISTORY__?.() 由外部组件触发,自身不渲染任何重复入口 */}
              <PermissionHistoryPanel />
              {/* "添加"下拉菜单(2026-07-25 终极整合,2026-07-30 提取到 AddMenuPopover 子组件)
                  收纳 5 类动作,内部按 mode 切换 content(menu/prompt/skill 三态)
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
                onAddFile={() => {
                  setAddMenuOpen(false)
                  setAddMenuMode('menu')
                  fileInputRef.current?.click()
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
                  window.location.href = '/plugins'
                }}
              />
              {references.length > 0 && (
                <span className="ml-auto rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {references.length} 个引用
                </span>
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
                高风险时附倒计时(与顶部高风险警告横幅同步),透明性 + 时效性双指标。 */}
            <div className="flex items-center gap-2 px-3 pt-2">
              <CurrentModeBadge />
              <div
                className="ml-auto flex items-center gap-1.5"
                data-testid="titlebar-permission-mode"
              >
                {activeWorkspaceMode && (
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
                    {activeWorkspaceMode === 'bypass-permissions'
                      ? t('permission.mode.full')
                      : activeWorkspaceMode === 'accept-edits'
                        ? t('permission.mode.auto')
                        : t('permission.mode.ask')}
                  </span>
                )}
                {/* 高风险模式 ⓘ 详细说明按钮(2026-07-25 深化,可解释性增强):
                    只在 bypass-permissions 模式显示,点击唤起 PermissionModeInfoModal
                    展示 4 条该模式的详细说明 bullet,底部"知道了"关闭 */}
                {activeWorkspaceMode === 'bypass-permissions' && (
                  <button
                    type="button"
                    onClick={() => setInfoMode('bypass-permissions')}
                    className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-amber-700 hover:bg-amber-500/15 dark:text-amber-400"
                    aria-label={t('permission.infoButtonLabel')}
                    title={t('permission.infoButtonTitle')}
                    data-testid="permission-mode-info-button"
                  >
                    <Info className="h-3 w-3" aria-hidden="true" />
                  </button>
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
              {/* / 独立按钮:点击弹出 SlashCommandPalette(锚定按钮上方,无遮罩轻弹出) */}
              <SlashCommandPalette
                commands={slashCommands}
                onSelect={handleCommandSelect}
                onSelectArgs={handleCommandArgsSelect}
                open={slashOpen}
                onOpenChange={setSlashOpen}
                tooltip={tA11y('slashCommand')}
              >
                <button
                  type="button"
                  disabled={isStreaming}
                  aria-label={tA11y('slashCommand')}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                    'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <SquareSlash className="h-4 w-4" />
                </button>
              </SlashCommandPalette>
              {/* @ 独立按钮:点击在 textarea 末尾插入 @ 字符并触发 FileMentionPopover */}
              <Tooltip content={tA11y('mentionFile')}>
                <button
                  type="button"
                  onClick={() => {
                    if (isStreaming) return
                    const next = (
                      value.endsWith(' ') || value === '' ? `${value}@` : `${value} @`
                    ).slice(0, MAX_LENGTH)
                    setValue(next)
                    setMentionOpen(true)
                    requestAnimationFrame(() => {
                      inputCoreRef.current?.focus()
                      const pos = next.length
                      inputCoreRef.current?.setSelectionRange(pos, pos)
                      inputCoreRef.current?.resize()
                    })
                  }}
                  disabled={isStreaming}
                  aria-label={tA11y('mentionFile')}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors',
                    'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <AtSign className="h-4 w-4" />
                </button>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileInputChange}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1">
                <ContextUsageRing model={model} isStreaming={isStreaming} />
                <ModelSelector
                  value={model}
                  onChange={onModelChange}
                  disabled={isStreaming}
                  label={modelLabel}
                />
                {/* 语音入口整合:单一 Mic 按钮直接触发语音转文字,挨着发送键 */}
                <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming} />
                {/* 清除 + 发送/停止按钮(2026-07-29 用户规则:与 toolbar 其他动作按钮同一行,
                    修复原 WebInputCore 内部 absolute 浮层把发送按钮挤到 textarea 右下角的问题)
                    - 清除:有输入时显示(灰底 hover)
                    - 发送/停止:流式中切 Stop(红底),否则 Send(主色,空输入/流式中禁用) */}
                {canClear && (
                  <Tooltip content={t('clear')}>
                    <button
                      type="button"
                      aria-label={t('clear')}
                      onClick={() => {
                        setValue('')
                        requestAnimationFrame(() => inputCoreRef.current?.resize())
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
                {isStreaming ? (
                  <Tooltip content={stopLabel ?? t('stop')}>
                    <button
                      type="button"
                      onClick={onStop}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      aria-label={stopLabel ?? t('stop')}
                    >
                      <Square className="h-3.5 w-3.5" fill="currentColor" />
                    </button>
                  </Tooltip>
                ) : (
                  <Tooltip content={sendLabel ?? t('send')}>
                    <button
                      type="button"
                      onClick={submit}
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
                  </Tooltip>
                )}
                {isStreaming ? (
                  <Tooltip content={t('streamingIndicatorHint')}>
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2"
                    >
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-sm bg-primary"
                      />
                      <span
                        className="whitespace-nowrap text-xs font-medium text-primary"
                        style={{ transform: 'translateY(0.7px)' }}
                      >
                        {t('streamingIndicator')}
                      </span>
                    </div>
                  </Tooltip>
                ) : null}
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
    </div>
  )
}

export default MessageInput
