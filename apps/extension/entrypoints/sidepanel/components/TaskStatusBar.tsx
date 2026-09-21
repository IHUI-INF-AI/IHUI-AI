// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TaskStatusBar —— 侧边栏对话页输入框上方的任务进度状态条。
 *
 * 与 web 端 apps/web/src/components/ai/task-status-bar.tsx 同一份语义:
 * 视图推导一律走共享纯函数 `deriveTaskStatusBar`
 * (packages/shared/src/chat/task-status.ts,单一真相源),本文件只渲染,
 * **不得**在此数步骤 / 数文件 / 算百分比(AGENTS.md §3 共享层优先 + §40 守门)。
 *
 * 文案走 @ihui/i18n/messages/shared/*.json 的 `taskStatus` 命名空间(跨端共用,
 * extension 的 I18nProvider 已 mergeMessages(shared, extension))。
 *
 * 空闲(无步骤、无文件变更、非流式)时 derive 返回 null,本组件直接不挂载任何节点。
 */
import { useMemo, useState, type ComponentType } from 'react'
import { Check, ChevronDown, ChevronUp, CircleDashed, Loader2, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@ihui/ui-react'
import {
  deriveTaskStatusBar,
  humanizeToolText,
  toolDisplayKey,
  type TaskStatusKind,
  type TaskStatusStepView,
} from '@ihui/shared/chat'
import type { PlanStep, PlanStepStatus, TerminalTask } from '@ihui/types'
import type { ToolCall } from '@ihui/types/chat'
import { useI18n } from '../../../src/i18n'

/** 步骤状态图标:与消息流内 plan 块同一套语义(对齐 web 端) */
const STEP_ICON: Record<PlanStepStatus, ComponentType<{ className?: string }>> = {
  pending: CircleDashed,
  in_progress: Loader2,
  completed: Check,
  failed: X,
  skipped: CircleDashed,
}

const STEP_ICON_CLS: Record<PlanStepStatus, string> = {
  pending: 'text-muted-foreground/40',
  in_progress: 'text-primary animate-spin',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
  skipped: 'text-muted-foreground/50',
}

const KIND_GLYPH: Record<
  TaskStatusKind,
  { icon: ComponentType<{ className?: string }>; cls: string }
> = {
  running: { icon: Loader2, cls: 'text-primary animate-spin' },
  completed: { icon: Check, cls: 'text-emerald-500' },
  failed: { icon: X, cls: 'text-red-500' },
  interrupted: { icon: CircleDashed, cls: 'text-amber-600 dark:text-amber-400' },
  idle: { icon: CircleDashed, cls: 'text-muted-foreground' },
}

export interface TaskStatusBarProps {
  /** plan_updated 权威快照(取自最后一条带 planSteps 的 assistant 消息) */
  planSteps: readonly PlanStep[]
  /** 同一条消息的工具调用:文件变更由共享层 computeFileChanges 折叠,端内不数行 */
  toolCalls?: readonly ToolCall[]
  /** 同一条消息的终端任务:仅用于流式期间"此刻在做什么"的文案 */
  terminalTasks?: readonly TerminalTask[]
  /** 该页的流式状态 */
  isStreaming: boolean
}

function StepRow({
  step,
  translate,
}: {
  step: TaskStatusStepView
  translate: (key: string) => string
}) {
  const Icon = STEP_ICON[step.status]
  return (
    <li className="flex items-start gap-2 py-0.5">
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${STEP_ICON_CLS[step.status]}`} aria-hidden />
      <span
        className={`min-w-0 flex-1 truncate text-xs ${
          step.status === 'completed'
            ? 'text-muted-foreground line-through'
            : step.status === 'in_progress'
              ? 'font-medium text-foreground'
              : 'text-muted-foreground'
        }`}
      >
        {humanizeToolText(step.title, translate)}
      </span>
    </li>
  )
}

export function TaskStatusBar({
  planSteps,
  toolCalls,
  terminalTasks,
  isStreaming,
}: TaskStatusBarProps) {
  const { t } = useI18n()
  // null = 用户未干预,跟随流式状态自动展开/收起
  const [userOpen, setUserOpen] = useState<boolean | null>(null)
  const open = userOpen ?? isStreaming

  const view = useMemo(
    () => deriveTaskStatusBar({ planSteps, toolCalls, isStreaming }),
    [planSteps, toolCalls, isStreaming],
  )

  // 流式期间"此刻在做什么":优先展示正在跑的工具 / 终端命令,拿不到名称时留空,
  // 让 view.headline(当前步骤标题)顶上 —— 与 web 端 activityLabel 同一优先级。
  // 界面禁止直显英文工具码名:已映射的工具显示本地化功能名(如 read_file → "读取文件内容"),
  // 插件/MCP 动态名回落 activityTool/activityMcp/activityPlugin。
  const activityLabel = useMemo(() => {
    if (!isStreaming) return ''
    const runningTool = (toolCalls ?? []).find((call) => call.status === 'running')
    if (runningTool) {
      if (runningTool.serverSource === 'mcp') {
        return t('taskStatus.activityMcp', {
          mcp: runningTool.serverName ?? runningTool.toolName,
        })
      }
      if (runningTool.serverSource === 'plugin') {
        return t('taskStatus.activityPlugin', {
          plugin: runningTool.serverName ?? runningTool.toolName,
        })
      }
      const displayKey = toolDisplayKey(runningTool.toolName)
      if (displayKey) return t(`taskStatus.${displayKey}`)
      return t('taskStatus.activityTool', { tool: runningTool.toolName })
    }
    if ((terminalTasks ?? []).some((task) => task.status === 'running')) {
      return t('taskStatus.activityTerminal')
    }
    return ''
  }, [isStreaming, toolCalls, terminalTasks, t])

  if (!view) return null

  const { icon: Glyph, cls: glyphCls } = KIND_GLYPH[view.kind]
  const headline =
    activityLabel ||
    (view.headline ? humanizeToolText(view.headline, t) : '') ||
    (view.active ? t('taskStatus.activityRunning') : t('taskStatus.waiting'))
  const stepText =
    view.stepTotal > 0
      ? t('taskStatus.steps', { current: view.stepCurrent, total: view.stepTotal })
      : t('taskStatus.idle')
  const filesText =
    view.changedFiles > 0 ? t('taskStatus.filesChanged', { n: view.changedFiles }) : ''

  return (
    <div className="px-2.5 pt-2" data-testid="task-status-bar" data-kind={view.kind}>
      <div
        className={`rounded-lg border bg-muted/40 transition-colors ${
          view.active ? 'border-primary/30' : 'border-border/60'
        }`}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setUserOpen(!open)}
                aria-expanded={open}
                aria-label={open ? t('taskStatus.collapseDetail') : t('taskStatus.expandDetail')}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left"
              >
                <Glyph className={`h-3.5 w-3.5 shrink-0 ${glyphCls}`} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs font-medium" aria-live="polite">
                  {headline}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {stepText}
                </span>
                {filesText ? (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {filesText}
                  </span>
                ) : null}
                {view.linesKnown && view.changedFiles > 0 ? (
                  <span className="shrink-0 text-xs tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{view.addedLines}
                    </span>{' '}
                    <span className="text-red-600 dark:text-red-400">-{view.removedLines}</span>
                  </span>
                ) : null}
                {open ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] break-words text-xs">
              {headline}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {open && view.stepTotal > 0 ? (
          <ul
            className="px-3 pb-2"
            aria-label={t('taskStatus.steps', { current: view.stepCurrent, total: view.stepTotal })}
          >
            {view.steps.map((step) => (
              <StepRow key={step.id} step={step} translate={t} />
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export default TaskStatusBar
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
