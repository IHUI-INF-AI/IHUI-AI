// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Check, ChevronDown, ChevronUp, CircleDashed, Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  computeFileChanges,
  computeFileChangesFromDiff,
  deriveTaskStatusBar,
  humanizeToolText,
  describeMcpToolActivity,
  type TaskStatusKind,
  type TaskStatusStepView,
} from '@ihui/shared/chat'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import { useChatStore } from '@/stores/chat'
import type { PlanStepStatus } from '@ihui/types/ai'

/** 步骤状态图标:与消息流内 PlanStepsCard 同一套语义 */
const STEP_ICON: Record<PlanStepStatus, React.ComponentType<{ className?: string }>> = {
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
  { icon: React.ComponentType<{ className?: string }>; cls: string }
> = {
  running: { icon: Loader2, cls: 'text-primary animate-spin' },
  completed: { icon: Check, cls: 'text-emerald-500' },
  failed: { icon: X, cls: 'text-red-500' },
  interrupted: { icon: CircleDashed, cls: 'text-amber-600 dark:text-amber-400' },
  idle: { icon: CircleDashed, cls: 'text-muted-foreground' },
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
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', STEP_ICON_CLS[step.status])} aria-hidden />
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs',
          step.status === 'completed' && 'text-muted-foreground line-through',
          step.status === 'in_progress' && 'font-medium text-foreground',
          step.status === 'pending' && 'text-muted-foreground',
        )}
      >
        {humanizeToolText(step.title, translate)}
      </span>
    </li>
  )
}

/**
 * TaskStatusBar —— AI 对话输入框上方的常驻任务进度条。
 *
 * 承载"此刻最该被看到"的三件事:在做什么、进行到第几步、改了多少文件多少行。
 * 数据由 ai-service 的 plan_updated SSE 事件驱动;视图推导全部走共享纯函数
 * `deriveTaskStatusBar`(packages/shared/src/chat/task-status.ts),本文件只渲染。
 *
 * 空闲(无步骤、无变更、非流式)时返回 null,不占任何高度。
 */
export function TaskStatusBar() {
  const t = useTranslations('taskStatus')
  const conversationId = useChatStore((s) => s.conversationId)
  const chatStreaming = useChatStore((s) => s.isStreaming)
  const messages = useChatStore((s) => s.messages)
  const agentProgress = useAgentProgress(conversationId)

  // 两条互斥的数据来源:
  // ① Agent 运行时(LangGraph 线程)—— useAgentProgress 订阅 /agent-langgraph/:threadId/stream,
  //    有会话级 planSteps / changes / currentTask;
  // ② 普通对话 —— plan_updated 由 send-answer 写进"那一条 assistant 消息"的 planSteps,
  //    useAgentProgress 在此模式下是空的。只接①会让状态条在绝大多数对话里永不出现。
  const planMessage = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message?.role === 'assistant' && (message.planSteps?.length ?? 0) > 0) return message
    }
    return null
  }, [messages])

  // 线程在流式即视为运行时模式:此时 planSteps 可能尚未生成,但 currentTask 已可用
  const fromAgentRuntime =
    agentProgress.isStreaming ||
    agentProgress.planSteps.length > 0 ||
    agentProgress.changes.length > 0
  const planSteps = fromAgentRuntime ? agentProgress.planSteps : (planMessage?.planSteps ?? [])
  const isStreaming = chatStreaming || agentProgress.isStreaming

  // null = 用户未干预,跟随流式状态自动展开/收起
  const [userOpen, setUserOpen] = React.useState<boolean | null>(null)
  const open = userOpen ?? isStreaming

  const fileChanges = React.useMemo(() => {
    if (fromAgentRuntime && agentProgress.changes.length > 0) {
      return computeFileChangesFromDiff(
        agentProgress.changes.map((c) => ({
          path: c.diffInfo.file_path,
          oldContent: c.diffInfo.old_content,
          newContent: c.diffInfo.new_content,
        })),
      )
    }
    return computeFileChanges(planMessage?.toolCalls)
  }, [fromAgentRuntime, agentProgress.changes, planMessage])

  const view = React.useMemo(
    () =>
      deriveTaskStatusBar({
        planSteps,
        fileChanges,
        isStreaming,
        overviewStatus: fromAgentRuntime ? agentProgress.overview.status : undefined,
      }),
    [planSteps, fileChanges, isStreaming, fromAgentRuntime, agentProgress.overview.status],
  )

  // 活动文案按 kind + 名称本地化,不回落到 hook 内硬编码的中文 label。
  // 普通对话(非 agent 线程)流式时 currentTask 为 idle kind → 走默认"执行中",
  // 不能把"等待任务开始"当流式标题(那是空闲态文案)。
  const currentTask = agentProgress.currentTask
  const activityLabel = React.useMemo(() => {
    if (!isStreaming) return ''
    switch (currentTask.kind) {
      case 'tool':
        // 界面禁止直显英文工具码名:走双时态活动措辞(本条只在流式期间出现 → 恒为进行时)。
        // D83 接线:MCP 调用带 mcpName 时先走共享层 server×tool 定制措辞,
        // 非 MCP(mcpName 缺省)时定制级按回落链整体不命中,行为与旧 describeToolActivity 等价。
        if (currentTask.toolName) {
          const activity = describeMcpToolActivity({
            serverName: currentTask.mcpName ?? null,
            toolName: currentTask.toolName,
            state: 'running',
            translate: (key, params) => t(key, params),
          })
          // 兜底会回原始码名,码名不得上界面 → 落到下面的 mcp/plugin/通用句式分支
          if (activity !== currentTask.toolName) return activity
        }
        if (currentTask.mcpName) return t('activityMcp', { mcp: currentTask.mcpName })
        if (currentTask.pluginName) return t('activityPlugin', { plugin: currentTask.pluginName })
        return t('activityTool', { tool: currentTask.toolName ?? '' })
      case 'subagent':
        return t('activitySubagent', { name: currentTask.label })
      case 'terminal':
        return t('activityTerminal')
      case 'planning':
        return t('activityPlanning')
      default:
        return t('activityRunning')
    }
  }, [isStreaming, currentTask, t])

  if (!view) return null

  const { icon: Glyph, cls: glyphCls } = KIND_GLYPH[view.kind]
  const headline =
    activityLabel || (view.headline ? humanizeToolText(view.headline, t) : '') || t('waiting')
  // 无步骤时不渲染计数(否则流式中会出现"执行中 · 空闲"的矛盾文案)
  const stepText =
    view.stepTotal > 0 ? t('steps', { current: view.stepCurrent, total: view.stepTotal }) : ''
  const filesText = view.changedFiles > 0 ? t('filesChanged', { n: view.changedFiles }) : ''

  return (
    <div className="mx-4 mb-2" data-testid="task-status-bar" data-kind={view.kind}>
      <div
        className={cn(
          'rounded-lg border bg-muted/40 transition-colors',
          view.active ? 'border-primary/30' : 'border-border/60',
        )}
      >
        <button
          type="button"
          onClick={() => setUserOpen(!open)}
          aria-expanded={open}
          aria-label={open ? t('collapseDetail') : t('expandDetail')}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
        >
          <Glyph className={cn('h-3.5 w-3.5 shrink-0', glyphCls)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-xs font-medium" aria-live="polite">
            {headline}
          </span>
          {stepText ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{stepText}</span>
          ) : null}
          {filesText ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{filesText}</span>
          ) : null}
          {view.linesKnown && view.changedFiles > 0 ? (
            <span className="shrink-0 text-xs tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">+{view.addedLines}</span>{' '}
              <span className="text-red-600 dark:text-red-400">-{view.removedLines}</span>
            </span>
          ) : null}
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </button>

        {open && view.stepTotal > 0 ? (
          <ul className="px-3 pb-2" aria-label={t('steps')}>
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
