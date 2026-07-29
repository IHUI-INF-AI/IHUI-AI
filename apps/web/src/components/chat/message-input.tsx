'use client'

import * as React from 'react'
import {
  AlertTriangle,
  Clock3,
  Send,
  Square,
  SquareSlash,
  FileText,
  Hammer,
  BookOpen,
  Search,
  Plus,
  AtSign,
  Sparkles,
  Package,
  X,
  Info,
  Target,
  Repeat,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Power,
  Timer,
  Bug,
  Wand2,
  TestTube,
  BookMarked,
  Code,
  RefreshCw,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import { formatFileSize } from '@ihui/shared/utils/format'
import { SlashCommandPalette, type ArgSuggestion } from '@/components/ai/slash-command-palette'
import { SLASH_COMMAND_IDS } from '@/components/chat/slash-command-data'
import { listAiSkills, type AiSkillMeta } from '@ihui/api-client/endpoints/ai-skills'
import { ContextReferencePanel } from '@/components/ai/context-reference-panel'
import { VoiceInput } from '@/components/ai/voice-input'
import { PromptTemplates } from '@/components/ai/prompt-templates'
import { ModelSelector } from '@/components/chat/model-selector'
import { ContextUsageRing } from '@/components/ai/context-usage-ring'
import { FileMentionPopover } from '@/components/ai/file-mention-popover'
import { SkillLibrary } from '@/components/chat/skill-library'
import { SelectedToolsPanel, type SelectedToolItem } from '@/components/chat/selected-tools-panel'
import { MentionChips } from '@/components/chat/mention-popover'
import { CurrentModeBadge } from '@/components/chat/current-mode-badge'
import {
  PermissionModePopover,
  isHighRiskPermissionMode,
  switchPermissionMode,
} from '@/components/ai/permission-mode-popover'
import { PermissionShortcutsModal } from '@/components/ai/permission-shortcuts-modal'
import { PermissionModeInfoModal } from '@/components/ai/permission-mode-info-modal'
import { PermissionHistoryPanel } from '@/components/ai/permission-history-panel'
import { AgentProgressTrigger } from '@/components/ai/agent-progress-trigger'
import { FullAccessConfirmBridge } from '@/components/chat/full-access-confirm-bridge'
import { isFullAccessConfirmSuppressed } from '@/components/ai/full-access-confirm-dialog'
import { detectDangerousCommands } from '@/lib/dangerous-command-detector'
import { recordModeChange, updateLatestRecordSource } from '@/lib/permission-mode-history'
import { usePermissionAutoRevert, formatRemaining } from '@/hooks/use-permission-auto-revert'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import { Popover, Tooltip } from '@/components/feedback'
import { useTextareaAutoHeight } from '@/hooks/use-textarea-auto-height'
import { getRecentFilesForMention } from '@ihui/api-client'
import { useChatStore } from '@/stores/chat'
import { useAiPanelStore } from '@/stores/ai-panel'
import { MARKET_PLUGINS, PROJECT_PLUGINS, getPluginIntegration } from '@plugins-data'
import { toast } from 'sonner'

const MAX_LENGTH = 10000
const MAX_HEIGHT_PX = 320 // 最大约 16 行,超出后滚动
const MIN_HEIGHT_PX = 96 // rows=3 基础高度,与 hook threeLinePx 阈值一致

/** 模式循环顺序(2026-07-25 深化,深度对标 Codex CLI Shift+Tab 循环切换)
 * default(请求批准) → accept-edits(替我审批) → bypass-permissions(完全访问) → default
 * 注意:bypass-permissions 是高风险,放在最后便于"按 3 次回正" */
const PERMISSION_CYCLE: WorkspacePermissionMode[] = [
  'default',
  'accept-edits',
  'bypass-permissions',
]

/** localStorage 键(2026-07-25 深化,跨刷新记忆用户上次主动选择的权限模式)
 * 仅记忆非默认模式;首次绑定工作区时如果 store 没指定,优先用这个值 */
const PERMISSION_MEMORY_KEY = 'ihui:preferred-permission-mode'

type ReferenceType = 'file' | 'url' | 'text' | 'image' | 'video'

interface ReferenceItem {
  id: string
  type: ReferenceType
  label: string
  preview?: string
  /** 图片/视频缩略图 URL(objectURL),用于在引用面板中显示视觉缩略图 */
  thumbnail?: string
  /** 原始文件大小(字节),用于在 label 中显示尺寸信息 */
  size?: number
}

/** /goal 命令参数候选模板(2026-07-29 二次深化,内置常见 goal 目标条件)
 * 参考 AGENTS.md §8 goal 模式工作流示例 + AI 编程主流场景
 * label:候选标签(简短)
 * description:候选描述(详细说明目标条件)
 * insertText:选中后填充到 textarea 的完整文本(含 /goal 前缀)
 * icon:候选图标(覆盖默认 Sparkles) */
const GOAL_ARG_TEMPLATES: ArgSuggestion[] = [
  {
    label: '修复所有 TypeScript 错误',
    description: '运行 pnpm typecheck,修复所有报错直到全绿(命令退出码 0)',
    insertText: '/goal 运行 pnpm typecheck 修复所有 TypeScript 错误,直到命令退出码为 0',
    icon: <Bug className="h-3.5 w-3.5" />,
  },
  {
    label: '通过所有单元测试',
    description: '运行 pnpm test,修复失败用例直到全部通过',
    insertText: '/goal 运行 pnpm test,修复所有失败的单元测试用例直到全部通过',
    icon: <TestTube className="h-3.5 w-3.5" />,
  },
  {
    label: '重构模块消除重复',
    description: '识别重复代码,抽取共享工具函数,保持行为不变',
    insertText: '/goal 识别项目中的重复代码,抽取共享工具函数,保持行为不变',
    icon: <RefreshCw className="h-3.5 w-3.5" />,
  },
  {
    label: '完成 lint 全绿',
    description: '运行 pnpm lint,修复所有 lint 错误和警告',
    insertText: '/goal 运行 pnpm lint,修复所有 lint 错误和警告直到全绿',
    icon: <Wand2 className="h-3.5 w-3.5" />,
  },
  {
    label: '迁移功能到共享层',
    description: '把端独占组件上提到 packages/app,多端复用,保持行为一致',
    insertText: '/goal 把端独占组件上提到 packages/app 共享层,多端复用,保持行为一致',
    icon: <Package className="h-3.5 w-3.5" />,
  },
  {
    label: '深度对标某产品交互',
    description: '参考目标产品交互细节,逐项对齐实现,自验 4 状态',
    insertText:
      '/goal 深度对标目标产品的交互细节,逐项对齐实现,自验默认/hover/active/dark mode 4 状态',
    icon: <BookMarked className="h-3.5 w-3.5" />,
  },
  {
    label: '清理死代码',
    description: '扫描未引用的导出/组件/工具函数,确认无依赖后删除',
    insertText: '/goal 扫描项目中未引用的导出/组件/工具函数,确认无依赖后删除',
    icon: <X className="h-3.5 w-3.5" />,
  },
  {
    label: '补全 E2E 测试',
    description: '为关键路径补全 E2E 测试,覆盖率提升到 80%+',
    insertText: '/goal 为关键路径补全 E2E 测试,覆盖率提升到 80% 以上',
    icon: <Code className="h-3.5 w-3.5" />,
  },
]

/** /loop 命令参数候选(2026-07-29 二次深化,on/off/N 三选项 + 常用迭代次数) */
const LOOP_ARG_OPTIONS: ArgSuggestion[] = [
  {
    label: '开启循环',
    description: '开启循环执行模式,AI 将持续迭代直到目标达成',
    insertText: '/loop on',
    icon: <Power className="h-3.5 w-3.5" />,
  },
  {
    label: '关闭循环',
    description: '关闭循环执行模式,恢复单次执行',
    insertText: '/loop off',
    icon: <Power className="h-3.5 w-3.5" />,
  },
  {
    label: '循环 5 次',
    description: '设置最大迭代次数为 5',
    insertText: '/loop 5',
    icon: <Timer className="h-3.5 w-3.5" />,
  },
  {
    label: '循环 10 次',
    description: '设置最大迭代次数为 10',
    insertText: '/loop 10',
    icon: <Timer className="h-3.5 w-3.5" />,
  },
  {
    label: '循环 20 次',
    description: '设置最大迭代次数为 20(高风险,需人工监督)',
    insertText: '/loop 20',
    icon: <Timer className="h-3.5 w-3.5" />,
  },
]

// 模板源统一为 5 个核心模板,与 message-list 空状态共用同一组 i18n key,
// 避免 email/report/review/refactor 4 个无 i18n key 的项显示原始 key 的问题。
const PROMPT_TEMPLATE_IDS = ['summary', 'translate', 'explain', 'code', 'polish'] as const

const SLASH_CMD_KEY_MAP: Record<string, string> = {
  summary: 'slashCmd.summary',
  translate: 'slashCmd.translate',
  explain: 'slashCmd.explain',
  code: 'slashCmd.code',
  polish: 'slashCmd.polish',
  'wechat-article': 'slashCmd.wechat-article',
  'koubo-script': 'slashCmd.koubo-script',
}

const TPL_NAME_KEY_MAP: Record<string, string> = {
  summary: 'tplSummary',
  translate: 'tplTranslate',
  explain: 'tplExplain',
  code: 'tplCode',
  polish: 'tplPolish',
}

const TPL_CONTENT_KEY_MAP: Record<string, string> = {
  summary: 'tplSummaryContent',
  translate: 'tplTranslateContent',
  explain: 'tplExplainContent',
  code: 'tplCodeContent',
  polish: 'tplPolishContent',
}

/**
 * i18n 静态映射表 — 用于消除 `t(`permission.dangerousPattern.${pattern}`)` 单变量动态拼接。
 * key 集合与 apps/web/src/lib/dangerous-command-detector.ts 的 DANGEROUS_PATTERNS[].id 一一对应;
 * 若 detector 新增 pattern 而本表漏改,运行时回退到 'permission.dangerousPattern.unknown'。
 */
const DANGEROUS_PATTERN_KEY: Record<string, string> = {
  rmRrfRoot: 'permission.dangerousPattern.rmRrfRoot',
  ddToDisk: 'permission.dangerousPattern.ddToDisk',
  mkfsDisk: 'permission.dangerousPattern.mkfsDisk',
  redirectToDevice: 'permission.dangerousPattern.redirectToDevice',
  chmodRoot: 'permission.dangerousPattern.chmodRoot',
  sudoAny: 'permission.dangerousPattern.sudoAny',
  curlPipeSh: 'permission.dangerousPattern.curlPipeSh',
  forkBomb: 'permission.dangerousPattern.forkBomb',
  mvRootToNull: 'permission.dangerousPattern.mvRootToNull',
  rmEnv: 'permission.dangerousPattern.rmEnv',
  rmGit: 'permission.dangerousPattern.rmGit',
  forcePushMain: 'permission.dangerousPattern.forcePushMain',
}

/**
 * 把后端返回的 mimeType 转换为短标签(image/png → PNG,application/pdf → PDF)。
 * 没有 mimeType 时回退为 "FILE"。
 */
function mimeToLabel(mimeType: string): string {
  if (!mimeType) return 'FILE'
  const sep = mimeType.indexOf('/')
  if (sep < 0) return mimeType.toUpperCase()
  return mimeType.slice(sep + 1).toUpperCase()
}

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

/** WebInputCore 句柄 — 与原 textareaRef 等价(主组件通过 inputCoreRef.current 访问) */
interface WebInputCoreHandle {
  focus: () => void
  setSelectionRange: (start: number, end: number) => void
  resize: () => void
}

/** WebInputCore props(契约对齐 packages/types MessageInputProps 核心字段)
 * 共享层 `<MessageInput>`(rn/taro)用相同 props 名,本组件是 web 端实现(react-native-web 未配置,
 * 不能直接 import @ihui/app;详细论证见 2026-07-29 方案 A)。
 * 职责:渲染 textarea + 字符计数 + 清除按钮 + 发送/停止按钮
 * 不包含:slash 触发按钮、@ 文件提及、模型选择、语音输入(由主组件工具栏承担) */
interface WebInputCoreProps {
  text: string
  placeholder: string
  isStreaming: boolean
  onTextChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  onClear: () => void
  /** 错误提示(可选,空字符串/null/undefined 时不渲染) */
  error?: string
  /** 翻译函数(主组件已 useTranslations('chat'),传入 t 即可) */
  t: (key: string) => string
  /** 原生 change 事件(用于触发 slash/mention 面板) */
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  /** 原生 keydown 事件(用于 Shift+Tab 切换权限模式) */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  /** 原生 paste 事件(用于图片粘贴) */
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  /** 发送按钮 tooltip(主组件传入对齐 aria-label) */
  sendLabel?: string
  /** 停止按钮 tooltip */
  stopLabel?: string
}

/** Web 端 MessageInput 实现(forwardRef,契约对齐 SharedMessageInputProps)
 * 渲染 textarea + 字符计数 + 清除按钮 + 发送/停止按钮。
 * 内部托管 textarea ref + 自动高度,主组件通过 forwarded ref 调用 focus/setSelectionRange/resize。 */
const WebInputCore = React.forwardRef<WebInputCoreHandle, WebInputCoreProps>(function WebInputCore(
  {
    text,
    placeholder,
    isStreaming,
    onTextChange,
    onSend,
    onStop,
    onClear,
    error,
    t,
    onChange,
    onKeyDown,
    onPaste,
    sendLabel,
    stopLabel,
  },
  ref,
) {
  const innerRef = React.useRef<HTMLTextAreaElement>(null)
  const { resize } = useTextareaAutoHeight<HTMLTextAreaElement>(text, {
    threeLinePx: MIN_HEIGHT_PX,
    maxHeightPx: MAX_HEIGHT_PX,
  })
  React.useImperativeHandle(
    ref,
    (): WebInputCoreHandle => ({
      focus: () => innerRef.current?.focus(),
      setSelectionRange: (s, e) => innerRef.current?.setSelectionRange(s, e),
      resize,
    }),
    [resize],
  )
  const canSend = !isStreaming && text.trim().length > 0
  const canClear = !isStreaming && text.length > 0
  return (
    <div className="relative px-3 pt-2 pb-2">
      <textarea
        ref={innerRef}
        value={text}
        onChange={(e) => {
          const v = e.target.value.slice(0, MAX_LENGTH)
          onTextChange(v)
          onChange?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSend()
          } else {
            onKeyDown?.(e)
          }
        }}
        onPaste={onPaste}
        placeholder={placeholder}
        rows={3}
        aria-label={placeholder}
        style={{ maxHeight: MAX_HEIGHT_PX, minHeight: MIN_HEIGHT_PX }}
        className={cn(
          'thin-scroll block w-full resize-none bg-transparent text-sm leading-snug outline-none',
          'placeholder:text-muted-foreground/70',
          'pb-7',
        )}
      />
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-between">
        <span
          aria-live="polite"
          className={cn(
            'text-[10px] tabular-nums text-muted-foreground/60',
            text.length >= MAX_LENGTH && 'text-destructive',
          )}
        >
          {text.length}/{MAX_LENGTH}
        </span>
        <div className="pointer-events-auto flex items-center gap-1">
          {canClear && (
            <Tooltip content={t('clear')}>
              <button
                type="button"
                aria-label={t('clear')}
                onClick={onClear}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              >
                ×
              </button>
            </Tooltip>
          )}
          {isStreaming ? (
            <Tooltip content={stopLabel ?? t('stop')}>
              <button
                type="button"
                onClick={onStop}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
                aria-label={stopLabel ?? t('stop')}
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            </Tooltip>
          ) : (
            <Tooltip content={sendLabel ?? t('send')}>
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
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
        </div>
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
})

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
  const tNav = useTranslations('nav')
  // 当前工作区权限模式(2026-07-25 深化,高风险模式持久化视觉警告)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)
  const setPendingFullAccess = useAiPanelStore((s) => s.setPendingFullAccess)
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
  const [references, setReferences] = React.useState<ReferenceItem[]>([])
  const [isDragOver, setIsDragOver] = React.useState(false)
  // AI Skills 列表(2026-07-29 二次深化,从 /api/ai-skills 拉取,接入斜杠命令弹窗 skill 分组)
  // 懒加载:首次打开弹窗时拉取,成功后缓存到 state,关闭再打开不重新拉
  const [aiSkills, setAiSkills] = React.useState<AiSkillMeta[]>([])
  const [skillsLoading, setSkillsLoading] = React.useState(false)
  const skillsLoadedRef = React.useRef(false)
  // @ 提及面板文件列表:首次打开时从 /api/files/recent 懒加载,避免无谓请求
  const [mentionFiles, setMentionFiles] = React.useState<
    { id: string; name: string; path: string }[]
  >([])
  const mentionLoadedRef = React.useRef(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  // /permission 切换 toast 首弹记录(2026-07-25 深化):每个子命令模式只 toast 一次,
  // 持久化到 localStorage(跨刷新/跨标签页也只弹一次)。
  // 用 set 序列化存,key 形如 "ask,auto,full" 表示已提示过的模式集合
  // React.useRef 不支持 lazy initializer(那是 useState 才有的),改用空 set + useEffect mount 填充
  const PERMISSION_TOAST_KEY = 'ihui:permission-toast-shown'
  const permissionToastShownRef = React.useRef<Set<string>>(new Set())
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(PERMISSION_TOAST_KEY)
      if (!raw) return
      permissionToastShownRef.current = new Set(raw.split(',').filter(Boolean))
    } catch {
      // 静默
    }
  }, [])
  const markPermissionToastShown = React.useCallback((mode: string) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        PERMISSION_TOAST_KEY,
        [...permissionToastShownRef.current, mode].join(','),
      )
    } catch {
      // 静默
    }
  }, [])
  // "添加"下拉菜单状态(2026-07-25 合并):收纳"提示词模板 / 添加引用 / Skill 库 / 添加附件 / 插件市场"5 类动作
  // addMenuMode 决定 Popover content:
  // - menu:5 项主菜单(模板/引用/Skill 库/附件/插件)
  // - prompt:PromptTemplates 弹层
  // - skill:SkillLibrary 弹层
  const [addMenuOpen, setAddMenuOpen] = React.useState(false)
  const [addMenuMode, setAddMenuMode] = React.useState<'menu' | 'prompt' | 'skill'>('menu')
  // 共享层 WebInputCore 内部托管 textarea ref + 自动高度(forwardRef 暴露 focus/setSelectionRange/resize)
  const inputCoreRef = React.useRef<WebInputCoreHandle>(null)
  // 消费 chat store 中的 draftInput(由 PromptTemplates 等外部触发),填充到 textarea 后清空
  const draftInput = useChatStore((s) => s.draftInput)
  const clearDraftInput = useChatStore((s) => s.clearDraftInput)
  // 已选工具(用户从插件市场点击"+"添加到对话的 pluginId 列表)
  const selectedToolsIds = useChatStore((s) => s.selectedTools)
  const removeSelectedTool = useChatStore((s) => s.removeSelectedTool)
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

  // 首次打开 @ 提及面板时拉取最近文件列表;失败静默(留空数组,Popover 显示"无匹配文件")
  React.useEffect(() => {
    if (!mentionOpen || mentionLoadedRef.current) return
    mentionLoadedRef.current = true
    getRecentFilesForMention(30)
      .then((res) => {
        if (res.success && res.data?.files) {
          setMentionFiles(
            res.data.files.map((f) => ({
              id: f.id,
              name: f.name,
              // API 不返回 path,用 mimeType · size 作为次要展示文本
              path: `${mimeToLabel(f.mimeType)} · ${formatFileSize(f.size)}`,
            })),
          )
        }
      })
      .catch(() => {
        // 静默失败:未登录/网络错误时保持空数组,Popover 显示"无匹配文件"
      })
  }, [mentionOpen])

  // 首次打开斜杠命令弹窗时拉取 AI Skills 列表(2026-07-29 二次深化,接入 skill 分组)
  // 2026-07-29 三次深化:兼容后端两种响应结构 + 控制台错误日志便于调试
  // 2026-07-29 四次深化:失败时重置 skillsLoadedRef 允许下次重试
  // (根因:首次打开时若 8803 未启动,fetch 失败但 ref 已锁 true,后续永不重试 → skill 分组永远空)
  // - 结构A(标准):{ code: 0, data: AiSkillMeta[] } → res.data 是数组
  // - 结构B(兼容):{ code: 0, data: { skills: AiSkillMeta[], count: N } } → res.data.skills 是数组
  // 失败静默 UI(保持空数组),但 console.error 输出错误便于排查
  React.useEffect(() => {
    if (!slashOpen || skillsLoadedRef.current) return
    skillsLoadedRef.current = true
    setSkillsLoading(true)
    listAiSkills()
      .then((res) => {
        if (!res.success) {
          // 失败:重置 ref 允许下次打开时重试(避免一次性失败永久锁死)
          skillsLoadedRef.current = false
           
          console.warn('[slash-cmd] listAiSkills failed:', res.error, res.status)
          return
        }
        // 兼容两种响应结构(后端标准是数组,但防御性处理嵌套结构)
        const skills = Array.isArray(res.data)
          ? res.data
          : res.data && Array.isArray((res.data as { skills?: unknown[] }).skills)
            ? (res.data as { skills: AiSkillMeta[] }).skills
            : []
        if (skills.length > 0) {
          setAiSkills(skills)
        } else {
          // 空响应:重置 ref 允许下次重试(后端可能临时返回空)
          skillsLoadedRef.current = false
           
          console.warn('[slash-cmd] listAiSkills returned empty or unexpected shape:', res.data)
        }
      })
      .catch((err) => {
        // 网络错误:重置 ref 允许下次重试
        skillsLoadedRef.current = false
        // 静默失败 UI,但记录错误便于排查(生产环境不影响用户体验)
         
        console.error('[slash-cmd] listAiSkills network error:', err)
      })
      .finally(() => {
        setSkillsLoading(false)
      })
  }, [slashOpen])

  // 权限模式可发现性增强(2026-07-25 深化,深度对标 Codex CLI /help):
  // - shortcutsOpen: ? 键唤起/关闭 PermissionShortcutsModal
  // - infoMode: 标题栏 ⓘ 按钮点击后展示该模式的详细说明 modal
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)
  const [infoMode, setInfoMode] = React.useState<WorkspacePermissionMode | null>(null)

  // 全局 ? 键监听(2026-07-25 深化,Codex CLI 风格):
  // - Shift+/ 也算,避免不同键盘布局下 ? 在不同位置
  // - 排除 textarea/input/contenteditable 内,用户打字时不应该误触
  // - 再按一次关闭(toggle),与常见 ? 文档快捷键行为一致
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        return
      }
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // 权限模式快捷切换(2026-07-25 深化,深度对标 Codex CLI Shift+Tab 循环):
  // - 模式改变时同步到 localStorage(只记忆非默认,避免污染用户)
  // - Shift+Tab 在 3 个模式间循环切,跳过斜杠面板/提及面板打开时
  // - 切到 bypass-permissions 复用 PermissionModePopover 同一撤销 toast
  // 监听 mode 变化 → localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (activeWorkspaceMode) {
        window.localStorage.setItem(PERMISSION_MEMORY_KEY, activeWorkspaceMode)
      } else {
        // 解除绑定时清掉记忆(避免下次自动套用过时模式)
        window.localStorage.removeItem(PERMISSION_MEMORY_KEY)
      }
    } catch {
      // 隐私模式/localStorage 不可用静默
    }
  }, [activeWorkspaceMode])

  // 权限模式切换历史记录(2026-07-25 立,深度对标 Codex CLI 审计能力):
  // - activeWorkspaceMode 变化时追加 1 条记录到 localStorage
  // - source 暂用 'popover' 作为默认,具体来源由调用方通过 __IHUI_RECORD_MODE_CHANGE__ 句柄覆盖
  // - 不在 message-input 内做来源判断(避免 popover/Shift+Tab/slash 三处分别改 1 个 if)
  // - 主动撤销 1h 计时器归零 → auto-revert 来源,由 use-permission-auto-revert 内 hook 句柄写入
  React.useEffect(() => {
    if (!activeWorkspaceMode) return
    // 首次 mount 时不记录(用户可能刚打开页面看到默认 default,记录无意义)
    // 只在 mode 真正变化时记录 —— 通过 ref 缓存上次值判断
    const w = window as unknown as {
      __IHUI_LAST_RECORDED_MODE__?: WorkspacePermissionMode | null
    }
    const last = w.__IHUI_LAST_RECORDED_MODE__
    if (last === activeWorkspaceMode) return
    w.__IHUI_LAST_RECORDED_MODE__ = activeWorkspaceMode
    recordModeChange({
      mode: activeWorkspaceMode,
      workspacePath: activeWorkspace?.path ?? '',
      timestamp: Date.now(),
      // 默认识别为 popover 来源;popover/shift-tab/slash 各自的代码路径在切完模式后会
      // 通过 __IHUI_RECORD_MODE_CHANGE__ 句柄覆盖最近一条的 source(见下)
      source: 'popover',
    })
  }, [activeWorkspaceMode, activeWorkspace?.path])

  // 切到下一个模式(Shift+Tab 循环)
  const cyclePermissionMode = React.useCallback(async () => {
    const current = (activeWorkspaceMode ?? 'default') as WorkspacePermissionMode
    const idx = PERMISSION_CYCLE.indexOf(current)
    const next = PERMISSION_CYCLE[(idx + 1) % PERMISSION_CYCLE.length] ?? 'default'
    if (next === current) return
    // 切到 bypass-permissions + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化)
    // 与 popover 走同一条 FullAccessConfirmDialog(共享 store.pendingFullAccess)
    if (next === 'bypass-permissions' && !isFullAccessConfirmSuppressed()) {
      setPendingFullAccess(true)
      return
    }
    const previousMode = current
    // 乐观更新 store
    if (activeWorkspace) {
      setActiveWorkspace({ ...activeWorkspace, mode: next })
    }
    const result = await switchPermissionMode(next)
    if (!result.ok) {
      // 回滚
      if (activeWorkspace && previousMode) {
        setActiveWorkspace({ ...activeWorkspace, mode: previousMode })
      }
      toast.error(t('permission.cycleError', { error: result.error ?? '未知错误' }))
      return
    }
    // 切完模式 → 把刚被 useEffect 占位为 'popover' 的最新一条记录 source 改为 'shift-tab'
    // 避免在 useEffect 内的 source 写死 'popover' 让历史面板误把 Shift+Tab 记成 popover
    updateLatestRecordSource('shift-tab', (e) => e.mode === next)
    // 切到完全访问 → 5s 撤销 toast(与 popover 一致体验)
    if (next === 'bypass-permissions') {
      toast(t('permission.switchedToFull'), {
        description: t('permission.switchedToFullDesc', { prev: previousMode }),
        duration: 5000,
        action: {
          label: t('permission.undo'),
          onClick: () => void cyclePermissionMode(),
        },
      })
    } else {
      // default / accept-edits → 短提示
      const labelKey = next === 'default' ? 'permission.mode.ask' : 'permission.mode.auto'
      toast.success(t('permission.cycledTo', { mode: t(labelKey) }), {
        duration: 2000,
      })
    }
  }, [activeWorkspace, activeWorkspaceMode, setActiveWorkspace, setPendingFullAccess, t])

  const slashCommands = [
    // 🎯 目标与循环(2026-07-29 立,置顶重点:AI 编程最主流的命令)
    // 2026-07-29 二次深化:加 argsSuggestions,点击后进入参数补全模式
    // /goal <目标条件>:设定当前会话目标,AI 围绕目标执行(对标 AGENTS.md §8 goal 模式工作流)
    // /loop on|off|N:设置循环执行模式(对标 ai-service slash_commands.py _loop_handler)
    {
      id: 'goal',
      label: '/goal',
      description: t('slashCmd.goal'),
      usage: '/goal <目标>',
      kind: 'template' as const,
      category: 'goal' as const,
      icon: <Target className="h-4 w-4" />,
      hasArgs: true,
      argsTitle: t('slashCmd.goalArgTitle'),
      argsSuggestions: GOAL_ARG_TEMPLATES,
    },
    {
      id: 'loop',
      label: '/loop',
      description: t('slashCmd.loop'),
      usage: '/loop on|off|N',
      kind: 'template' as const,
      category: 'goal' as const,
      icon: <Repeat className="h-4 w-4" />,
      hasArgs: true,
      argsTitle: t('slashCmd.loopArgTitle'),
      argsSuggestions: LOOP_ARG_OPTIONS,
    },
    // ⚡ 模式切换(2026-07-25 立,对标 Trae SOLO Plan 模式):切换 plan/act 模式
    {
      id: 'plan',
      label: '/plan',
      description: t('slashCmd.plan'),
      kind: 'action' as const,
      category: 'mode' as const,
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: 'act',
      label: '/act',
      description: t('slashCmd.act'),
      kind: 'action' as const,
      category: 'mode' as const,
      icon: <Hammer className="h-4 w-4" />,
    },
    // 对话模式动作型命令(2026-07-28 立,补全 ChatMode 4态三通道):
    // /build /review /spec 切换 ChatMode,/plan /act 同时联动 ChatMode 和 Plan/Act
    {
      id: 'build',
      label: '/build',
      description: t('slashCmd.build'),
      kind: 'action' as const,
      category: 'mode' as const,
      icon: <Hammer className="h-4 w-4" />,
    },
    {
      id: 'review',
      label: '/review',
      description: t('slashCmd.review'),
      kind: 'action' as const,
      category: 'mode' as const,
      icon: <Search className="h-4 w-4" />,
    },
    {
      id: 'spec',
      label: '/spec',
      description: t('slashCmd.spec'),
      kind: 'action' as const,
      category: 'mode' as const,
      icon: <FileText className="h-4 w-4" />,
    },
    // 🔐 权限管理(2026-07-25 深化,深度对标 Codex approvalMode CLI):
    // /permission ask|auto|full 切换工作区权限模式(不进入 LLM 流,纯本地 UI 状态)
    // description 用 \n 拼接短描述 + 用法提示(2026-07-25 深化,提示用户支持的 3 个子命令)
    {
      id: 'permission-ask',
      label: '/permission ask',
      description: `${t('slashCmd.permissionAsk')}\n${t('permission.usageHint')}`,
      kind: 'action' as const,
      category: 'permission' as const,
      icon: <Shield className="h-4 w-4" />,
    },
    {
      id: 'permission-auto',
      label: '/permission auto',
      description: `${t('slashCmd.permissionAuto')}\n${t('permission.usageHint')}`,
      kind: 'action' as const,
      category: 'permission' as const,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      id: 'permission-full',
      label: '/permission full',
      description: `${t('slashCmd.permissionFull')}\n${t('permission.usageHint')}`,
      kind: 'action' as const,
      category: 'permission' as const,
      icon: <ShieldAlert className="h-4 w-4" />,
    },
    // ✨ AI 技能(2026-07-29 二次深化,从 /api/ai-skills 异步拉取,接入斜杠命令弹窗)
    // 每个 skill 一项,点击后填充 /skill <name> 到 textarea,后端 _skill_handler 处理
    // loading 状态:skillsLoading=true 时所有 skill 项标记 loading,弹窗分组标题显示 spinner
    ...aiSkills.map((skill) => ({
      id: `skill-${skill.id}`,
      label: `/skill ${skill.name}`,
      description: skill.description,
      usage: `/skill ${skill.name}`,
      kind: 'template' as const,
      category: 'skill' as const,
      icon: <Sparkles className="h-4 w-4" />,
      hasArgs: false,
      loading: skillsLoading,
    })),
    // 📝 内容模板:选命令后填充模板到 textarea
    ...SLASH_COMMAND_IDS.map((id) => ({
      id,
      label: `/${id}`,
      description: t(SLASH_CMD_KEY_MAP[id] ?? id),
      kind: 'template' as const,
      category: 'template' as const,
      icon: <Sparkles className="h-4 w-4" />,
    })),
  ]

  const commandTemplates: Record<string, string> = {
    // /goal /loop 命令(2026-07-29 立,重点命令:填充命令到 textarea 让用户继续输入参数)
    // 点击后 textarea 内容为 "/goal " 或 "/loop ",光标在末尾,用户输入参数后 Enter 发送
    // 后端 ai-service slash_commands.py 的 _goal_handler / _loop_handler 负责实际处理
    goal: '/goal ',
    loop: '/loop ',
    summary: t('cmdSummary'),
    translate: t('cmdTranslate'),
    explain: t('cmdExplain'),
    code: t('cmdCode'),
    polish: t('cmdPolish'),
    'wechat-article': t('cmdWechatArticle'),
    'koubo-script': t('cmdKouboScript'),
  }

  // i18n key 为扁平结构(tplSummary / tplSummaryContent),与 message-list 空状态共用同一组 key,
  // 保证附加栏弹窗与空状态 chips 显示的模板内容完全一致。
  const promptTemplates = PROMPT_TEMPLATE_IDS.map((id) => {
    return {
      id,
      name: t(TPL_NAME_KEY_MAP[id] ?? id),
      content: t(TPL_CONTENT_KEY_MAP[id] ?? id),
    }
  })

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

  const handleCommandSelect = (id: string) => {
    // 动作型命令(2026-07-25 立):直接走 onSend 流程,由 use-chat.ts 的 tryHandlePlanModeSlash 拦截。
    // 不填充 textarea,避免用户看到 "/plan" 文字再手动按发送(多余操作)。
    if (
      id === 'plan' ||
      id === 'act' ||
      // ChatMode 4态动作型命令(2026-07-28 立,补全三通道):
      // /build /review /spec 走 onSend,由 use-chat.ts 的 tryHandleChatModeSlash 拦截
      id === 'build' ||
      id === 'review' ||
      id === 'spec' ||
      // 权限模式动作型命令(2026-07-25 深化):/permission ask|auto|full 走 onSend
      // 由 use-chat.ts 的 tryHandlePermissionSlash 拦截(纯本地 UI 状态切换,无 LLM)
      id === 'permission-ask' ||
      id === 'permission-auto' ||
      id === 'permission-full'
    ) {
      // /permission 切换 toast(2026-07-25 深化):仅每个模式首次弹一次,
      // 提醒用户已切换并显示完整模式名,避免反复刷屏。用 useRef 跨渲染持久,
      // 用户后续再用同一子命令不再弹(避免噪音)。
      if (id.startsWith('permission-')) {
        const mode = id.replace('permission-', '')
        if (!permissionToastShownRef.current.has(mode)) {
          permissionToastShownRef.current.add(mode)
          // 持久化到 localStorage(2026-07-25 二次深化):跨刷新/跨标签页也只弹一次
          markPermissionToastShown(mode)
          const key =
            mode === 'ask'
              ? 'permission.switchedToModeAsk'
              : mode === 'auto'
                ? 'permission.switchedToModeAuto'
                : 'permission.switchedToModeFull'
          toast.success(t(key), { duration: 2500 })
        }
      }
      // 清空当前 textarea 内容再发送,避免与已有内容拼接
      setValue('')
      requestAnimationFrame(() => inputCoreRef.current?.resize())
      void onSend(`/${id.replace('-', ' ')}`)
      return
    }
    // skill 命令(2026-07-29 二次深化):id 形如 "skill-<skillId>",
    // 填充 "/skill <skillName> " 到 textarea 让用户确认或追加参数
    if (id.startsWith('skill-')) {
      const skillName = id.slice('skill-'.length)
      fillInput(`/skill ${skillName} `)
      return
    }
    fillInput(commandTemplates[id] ?? '')
  }

  /** 参数补全模式选择回调(2026-07-29 二次深化)
   * 用户在参数补全模式下选中候选项时触发,直接填充 insertText 到 textarea
   * 不自动发送,让用户确认后按 Enter 发送(避免误触)
   * commandId 参数保留以匹配 SlashCommandPalette onSelectArgs 签名,当前实现不使用 */
  const handleCommandArgsSelect = (_commandId: string, insertText: string) => {
    fillInput(insertText)
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

  const addTextReference = () => {
    const text = value.trim()
    if (!text) return
    const ref: ReferenceItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'text',
      label: text.length > 30 ? `${text.slice(0, 30)}...` : text,
      preview: text,
    }
    setReferences((prev) => [...prev, ref])
    setValue('')
    requestAnimationFrame(() => inputCoreRef.current?.resize())
  }

  const addFileReference = (file: File) => {
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    if (!isImage && !isVideo) return
    const objectUrl = URL.createObjectURL(file)
    const ref: ReferenceItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: isImage ? 'image' : 'video',
      label: file.name,
      preview: `${file.name} · ${formatFileSize(file.size)}`,
      thumbnail: objectUrl,
      size: file.size,
    }
    setReferences((prev) => [...prev, ref])
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach(addFileReference)
    // 重置 value,允许重复选择同一文件
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isStreaming) return
    // 仅在拖入文件时阻止默认行为(否则浏览器会打开文件)
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      if (!isDragOver) setIsDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // 仅当离开外层容器时才清除高亮(避免子元素 dragenter/dragleave 抖动)
    if (e.currentTarget === e.target) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (isStreaming) return
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
    e.preventDefault()
    setIsDragOver(false)
    Array.from(e.dataTransfer.files).forEach(addFileReference)
    requestAnimationFrame(() => inputCoreRef.current?.focus())
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isStreaming) return
    const items = e.clipboardData?.items
    if (!items) return
    const imageItems = Array.from(items).filter(
      (item) => item.kind === 'file' && item.type.startsWith('image/'),
    )
    if (imageItems.length === 0) return
    e.preventDefault()
    imageItems.forEach((item) => {
      const file = item.getAsFile()
      if (file) {
        // 粘贴的图片无文件名,用时间戳生成
        const renamed = new File([file], `pasted-${Date.now()}.png`, { type: file.type })
        addFileReference(renamed)
      }
    })
  }

  const removeReference = (id: string) => {
    setReferences((prev) => {
      const removed = prev.find((r) => r.id === id)
      // 释放 objectURL 避免内存泄漏
      if (removed?.thumbnail) URL.revokeObjectURL(removed.thumbnail)
      return prev.filter((r) => r.id !== id)
    })
  }

  const submit = async () => {
    const text = value.trim()
    if (!text || isStreaming) return
    // 危险命令检测(2026-07-25 立,深度对标 OpenAI Codex CLI safety guard):
    // - 仅在高风险模式(bypass-permissions)下拦截,其他模式不阻断(用户已选择低风险)
    // - critical/high → 弹确认 toast(带「仍要发送」action),用户点 action 才真发
    // - medium → 普通 toast 警告(不阻断,只提醒)
    if (isHighRisk) {
      const detection = detectDangerousCommands(text)
      if (detection.hasDangerous) {
        // 找出最严重的 critical/high 命中的 pattern + reason 展示
        const top = detection.matches.find(
          (m) => m.severity === 'critical' || m.severity === 'high',
        )
        if (top) {
          const patternLabel = t(
            DANGEROUS_PATTERN_KEY[top.pattern] ?? 'permission.dangerousPattern.unknown',
          )
          toast(t('permission.dangerousCommandTitle'), {
            description: t('permission.dangerousCommandDesc', {
              pattern: patternLabel,
              reason: top.reason,
            }),
            duration: 10_000,
            action: {
              label: t('permission.dangerousCommandProceed'),
              onClick: () => {
                void doSend(text, references)
              },
            },
            cancel: {
              label: t('permission.dangerousCommandCancel'),
              onClick: () => {
                // 仅关闭 toast,保留输入内容
              },
            },
          })
          return
        }
      }
      // 仅 medium → 警告但不阻断
      if (detection.matches.length > 0) {
        const medium = detection.matches[0]!
        const patternLabel = t(
          DANGEROUS_PATTERN_KEY[medium.pattern] ?? 'permission.dangerousPattern.unknown',
        )
        toast.warning(t('permission.dangerousCommandWarningOnly', { pattern: patternLabel }), {
          duration: 5_000,
        })
      }
    }
    await doSend(text, references)
  }

  /** 实际发送逻辑(2026-07-25 立,危险命令检测拆分):供 submit / toast action 复用 */
  const doSend = async (text: string, refs: ReferenceItem[]) => {
    // 附件作为引用文本随消息发送:图片用 markdown image 语法,视频/其他文件用引用块
    const attachmentMarkdown = refs
      .map((r) => {
        if (r.type === 'image' && r.thumbnail) {
          return `![${r.label}](${r.thumbnail})`
        }
        if (r.type === 'video' && r.thumbnail) {
          return `<video src="${r.thumbnail}" controls></video>`
        }
        return `> 📎 ${r.label}`
      })
      .join('\n')
    const finalContent = attachmentMarkdown ? `${text}\n\n${attachmentMarkdown}` : text
    // onSend 返回 false 表示未发送(如未登录/创建会话失败),保留输入内容不清空
    const ok = await onSend(finalContent)
    if (!ok) return
    // 释放所有 objectURL
    refs.forEach((r) => {
      if (r.thumbnail) URL.revokeObjectURL(r.thumbnail)
    })
    setValue('')
    if (typeof window !== 'undefined') localStorage.removeItem(DRAFT_KEY)
    setReferences([])
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
            - bypass-permissions 模式时,输入框上方加琥珀色横幅
            - 提醒用户 AI 当前可执行任何操作(无法撤回的破坏性操作的预防)
            - 倒计时(2026-07-25 深化):显示"X 分钟后自动切回请求批准",可手动取消
            - 非高风险模式时不渲染(零开销) */}
        {isHighRisk && (
          <div
            role="status"
            aria-live="polite"
            className="mb-2 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 animate-pulse-soft"
          >
            <AlertTriangle
              className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 leading-snug">
              <div>{t('permission.inputWarning')}</div>
              {autoRevert.isActive ? (
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                  <Clock3 className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>
                    {t('permission.autoRevertIn', {
                      time: formatRemaining(autoRevert.remainingMs),
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={autoRevert.cancelRevert}
                    className="ml-1 inline-flex items-center gap-0.5 rounded-sm border border-amber-500/30 px-1.5 py-px text-[10px] font-medium transition-colors hover:bg-amber-500/10"
                    aria-label={t('permission.cancelAutoRevert')}
                  >
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                    {t('permission.cancelAutoRevert')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => autoRevert.extendRevert()}
                  className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
                >
                  {t('permission.reEnableAutoRevert')}
                </button>
              )}
            </div>
          </div>
        )}
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
              {/* "添加"下拉菜单(2026-07-25 终极整合):唯一附加栏功能入口
                  收纳 5 类动作,内部按 addMenuMode 切换 content:
                  - menu:5 项主菜单(模板/引用/Skill 库/附件/插件)
                  - prompt:PromptTemplates 弹层
                  - skill:SkillLibrary 弹层
                  避免嵌套弹层,trigger 始终是"添加"按钮,焦点/坐标/ESC 行为统一 */}
              <Popover
                open={addMenuOpen}
                onOpenChange={(next) => {
                  setAddMenuOpen(next)
                  // 关闭时重置为菜单态,下次打开从 menu 开始
                  if (!next) setAddMenuMode('menu')
                }}
                content={
                  addMenuMode === 'prompt' ? (
                    <div className="w-72">
                      <PromptTemplates
                        templates={promptTemplates}
                        onSelect={(content) => {
                          handleTemplateSelect(content)
                          setAddMenuOpen(false)
                          setAddMenuMode('menu')
                        }}
                      />
                    </div>
                  ) : addMenuMode === 'skill' ? (
                    <SkillLibrary
                      onSelect={(template) => {
                        fillInput(template)
                        setAddMenuOpen(false)
                        setAddMenuMode('menu')
                      }}
                      onClose={() => {
                        setAddMenuOpen(false)
                        setAddMenuMode('menu')
                      }}
                    />
                  ) : (
                    <div
                      role="menu"
                      aria-label={t('addMenuDesc')}
                      className="flex w-60 flex-col gap-0.5"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isStreaming}
                        onClick={() => {
                          setAddMenuMode('prompt')
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{t('promptTemplate')}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground/60">→</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isStreaming || !value.trim()}
                        onClick={() => {
                          setAddMenuOpen(false)
                          setAddMenuMode('menu')
                          addTextReference()
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{t('addContextReference')}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isStreaming}
                        onClick={() => {
                          setAddMenuMode('skill')
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{t('skillLibrary.title')}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground/60">→</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isStreaming}
                        onClick={() => {
                          setAddMenuOpen(false)
                          setAddMenuMode('menu')
                          fileInputRef.current?.click()
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{tA11y('addAttachment')}</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isStreaming}
                        onClick={() => {
                          setAddMenuOpen(false)
                          setAddMenuMode('menu')
                          // 插件/MCP 入口:跳转到 /plugins 页面
                          window.location.href = '/plugins'
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors',
                          'text-popover-foreground hover:bg-accent hover:text-accent-foreground',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{tNav('pluginMarket')}</span>
                      </button>
                    </div>
                  )
                }
                position="bottom"
                trigger="click"
                portal
                align="start"
                tooltip={addMenuOpen ? undefined : t('addMenuLabel')}
              >
                <button
                  type="button"
                  aria-label={t('addMenuLabel')}
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                  disabled={isStreaming}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all',
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:-translate-y-px',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t('addMenuLabel')}</span>
                </button>
              </Popover>
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
                {/* 语音入口整合:单一 Mic 按钮直接触发语音转文字,挨着发送键(发送键已移入 WebInputCore) */}
                <VoiceInput onTranscript={handleVoiceTranscript} disabled={isStreaming} />
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
      <PermissionShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      {/* 权限模式详细说明 modal(2026-07-25 深化,可解释性增强):
          - 只在高风险模式(bypass-permissions)显示 ⓘ 按钮时唤起
          - 4 条该模式详细行为 bullet,底部"知道了"关闭 */}
      <PermissionModeInfoModal mode={infoMode} onClose={() => setInfoMode(null)} />
    </div>
  )
}

export default MessageInput
