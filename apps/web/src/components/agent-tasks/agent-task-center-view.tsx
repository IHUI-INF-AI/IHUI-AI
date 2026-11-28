// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * AgentTaskCenter 的纯展示层：状态徽标、任务行、工作区卡、详情轨迹、空态。
 * 容器状态/请求编排留在 agent-task-center.tsx，避免单文件超过项目 800 行守门。
 */

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  Folder,
  Info,
  ListChecks,
  Loader2,
  MessageSquare,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Wrench,
  XCircle,
} from 'lucide-react'

import { Badge, Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback'
import { LocalFolderPicker } from '@/components/workspace/local-folder-picker'
import { cn } from '@/lib/utils'
import { useAiPanelStore } from '@/stores/ai-panel'
import {
  type AgentStepView,
  type AgentTaskView,
  type StepKind,
  formatTaskTime,
  isDefaultWorkspacePath,
  pendingApprovalStep,
  stepKind,
  stepTarget,
  stepsJson,
  taskOutcome,
  taskStepCount,
  truncateText,
  workspaceLabel,
} from '@/lib/agent-task-view'

export type Mode = 'current' | 'history'

const STATUS_META = {
  running: {
    labelKey: 'statusRunning',
    dot: 'bg-amber-500',
    chip: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  completed: {
    labelKey: 'statusCompleted',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  failed: {
    labelKey: 'statusFailed',
    dot: 'bg-destructive',
    chip: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  canceled: {
    labelKey: 'statusCanceled',
    dot: 'bg-muted-foreground',
    chip: 'border-border bg-muted text-muted-foreground',
  },
} satisfies Record<
  string,
  {
    labelKey: 'statusRunning' | 'statusCompleted' | 'statusFailed' | 'statusCanceled'
    dot: string
    chip: string
  }
>

type Translate = ReturnType<typeof useTranslations>

function statusMeta(status: string) {
  return STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.canceled
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('agentTasks')
  const meta = statusMeta(status)
  return (
    <Badge className={cn('shrink-0 border font-medium', meta.chip)}>
      <span className={cn('mr-1 inline-block h-1.5 w-1.5 rounded-full', meta.dot)} />
      {t(meta.labelKey)}
    </Badge>
  )
}

/** 把 taskOutcome 的机器结构翻成一句人话。 */
function outcomeText(task: AgentTaskView, t: Translate): string {
  const outcome = taskOutcome(task)
  if (outcome.kind === 'result') return outcome.text || t('summaryCompleted')
  if (outcome.kind === 'error') return friendlyError(outcome.text, t)
  if (outcome.kind === 'canceled') return t('summaryCanceled')
  if (outcome.phase === 'preparing') return t('summaryPreparing')
  if (outcome.phase === 'thinking') return t('summaryThinking')
  return outcome.target ? t('summaryToolTarget', { target: outcome.target }) : t('summaryTool')
}

/** 原始错误常常是服务端日志；主视线只给人能懂的一句话，原文留给“技术详情”。 */
function friendlyError(raw: string, t: Translate): string {
  const text = raw.trim()
  if (!text) return t('summaryFailed')
  if (/401|unauthori[sz]ed|llm\/complete/i.test(text)) return t('errorAiUnavailable')
  if (/ECONNREFUSED|ECONNRESET|ENOTFOUND|fetch failed|network/i.test(text)) return t('errorNetwork')
  if (/timeout|timed out|超时/i.test(text)) return t('errorTimeout')
  if (/权限|permission|denied|forbidden/i.test(text)) return t('errorPermission')
  return text.length > 140 ? `${text.slice(0, 140)}…` : text
}

function StepIcon({ kind }: { kind: StepKind }) {
  const className = 'h-4 w-4'
  if (kind === 'read') return <FileText className={className} />
  if (kind === 'write') return <PencilLine className={className} />
  if (kind === 'command') return <Terminal className={className} />
  if (kind === 'list') return <Folder className={className} />
  if (kind === 'search') return <Search className={className} />
  if (kind === 'think') return <Sparkles className={className} />
  if (kind === 'done') return <Check className={className} />
  return <Wrench className={className} />
}

function stepIconTone(kind: StepKind): string {
  if (kind === 'write') return 'bg-sky-500/10 text-sky-600'
  if (kind === 'read') return 'bg-blue-500/10 text-blue-600'
  if (kind === 'command') return 'bg-amber-500/10 text-amber-600'
  if (kind === 'done') return 'bg-emerald-500/10 text-emerald-600'
  if (kind === 'think') return 'bg-violet-500/10 text-violet-600'
  return 'bg-muted text-muted-foreground'
}

function stepTitle(step: AgentStepView, t: Translate): string {
  const kind = stepKind(step)
  const target = stepTarget(step)
  if (kind === 'read') return target ? `${t('toolRead')} ${target}` : t('toolRead')
  if (kind === 'write') return target ? `${t('toolWrite')} ${target}` : t('toolWrite')
  if (kind === 'command') return target ? `${t('toolCommand')} ${target}` : t('toolCommand')
  if (kind === 'list') return target ? `${t('toolList')} ${target}` : t('toolList')
  if (kind === 'search') return target ? `${t('toolSearch')} ${target}` : t('toolSearch')
  if (kind === 'think') return t('toolThink')
  if (kind === 'done') return t('toolDone')
  return t('toolOther')
}

function stepDescription(step: AgentStepView, t: Translate): string {
  if (step.type === 'tool_call') {
    const kind = stepKind(step)
    if (kind === 'write') return t('stepWriteHint')
    if (kind === 'read') return t('stepReadHint')
    if (kind === 'command') return t('stepCommandHint')
    if (kind === 'search') return t('stepSearchHint')
    if (kind === 'list') return t('stepListHint')
    return t('stepToolHint')
  }
  if (step.type === 'tool_result') {
    const text = truncateText(step.content, 180).trim()
    // 旧任务的 tool_result 常只回一个 "ok"；不要把这个开发态回执原样端给普通用户。
    if (!text || /^(ok|success|done|true|completed)$/i.test(text)) return t('stepDoneHint')
    return text
  }
  if (step.type === 'llm') return truncateText(step.content, 220) || t('toolThink')
  return truncateText(step.content, 180)
}

/** 列表卡片：只展示目标、状态、结果一句话、工作区、步骤数和时间。 */
export function TaskRow({
  task,
  selected,
  onSelect,
}: {
  task: AgentTaskView
  selected: boolean
  onSelect: () => void
}) {
  const t = useTranslations('agentTaskCenter')
  const steps = taskStepCount(task)
  const workplace = isDefaultWorkspacePath(task.workspacePath)
    ? t('defaultWorkspaceName')
    : workspaceLabel(task.workspacePath)

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`agent-task-row-${task.taskId}`}
      className={cn(
        'group w-full rounded-xl border bg-card p-4 text-left transition-colors',
        'hover:border-stroke-strong hover:bg-accent/30',
        selected ? 'border-stroke-selected ring-1 ring-stroke-selected' : 'border-border',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full',
            statusMeta(task.status).dot,
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1 truncate text-body font-medium">{task.goal}</span>
            <StatusBadge status={task.status} />
          </div>
          <p className="mt-1 line-clamp-2 text-label text-muted-foreground">
            {outcomeText(task, t)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1">
              <Folder className="h-3 w-3 shrink-0" />
              <span className="truncate">{workplace || t('workspaceUnknown')}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <ListChecks className="h-3 w-3" />
              {t('stepsCount', { count: steps })}
            </span>
            {task.startedAt ? (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTaskTime(task.startedAt)}
              </span>
            ) : null}
          </div>
        </div>
        <ChevronDown className="-rotate-90 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

export function WorkspaceCard({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('agentTaskCenter')
  const workspace = useAiPanelStore((state) => state.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((state) => state.setActiveWorkspace)
  const [pickerOpen, setPickerOpen] = React.useState(false)

  return (
    <div className={cn('rounded-xl border border-border bg-card p-3', compact && 'p-2.5')}>
      <div className="flex items-start gap-2.5">
        <span className="rounded-md bg-amber-500/10 p-1.5 text-amber-600">
          <Folder className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {workspace?.path ? (
            <>
              <p className="truncate text-label font-medium">
                {workspace.name || workspaceLabel(workspace.path)}
              </p>
              <p
                className="truncate font-mono text-[11px] text-muted-foreground"
              >
                <Tooltip content={workspace.path}>
                  <span className="block w-full truncate">{workspace.path}</span>
                </Tooltip>
              </p>
            </>
          ) : (
            <>
              <p className="text-label font-medium">{t('noWorkspaceTitle')}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t('noWorkspaceDesc')}</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          {workspace?.path ? t('changeWorkspace') : t('bindWorkspace')}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
      <LocalFolderPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onWorkspaceOpened={(path, name, perm) => {
          setActiveWorkspace({
            path,
            name,
            mode: perm?.mode,
            techStack: perm?.techStack
              ? perm.techStack
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean)
              : undefined,
          })
        }}
      />
    </div>
  )
}

export function GuideCard() {
  const t = useTranslations('agentTaskCenter')
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-primary/10 p-2 text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-body font-semibold">{t('guideTitle')}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t('guideSubtitle')}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {[
          ['1', t('guide1Title'), t('guide1Desc')],
          ['2', t('guide2Title'), t('guide2Desc')],
          ['3', t('guide3Title'), t('guide3Desc')],
        ].map(([number, title, desc]) => (
          <div key={number} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
              {number}
            </span>
            <div className="min-w-0">
              <p className="text-label font-medium">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>{t('guidePendingHint')}</p>
      </div>
    </div>
  )
}

function ApprovalChip({ state }: { state: NonNullable<AgentStepView['approval']>['state'] }) {
  const t = useTranslations('agentTasks')
  const meta =
    state === 'pending'
      ? {
          label: t('approvalPending'),
          className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
        }
      : state === 'allowed'
        ? {
            label: t('approvalAllowed'),
            className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          }
        : { label: t('approvalDenied'), className: 'bg-destructive/10 text-destructive' }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  )
}

function Timeline({ task }: { task: AgentTaskView }) {
  const t = useTranslations('agentTaskCenter')
  const steps = (task.steps ?? []).filter(
    (step) => step.type === 'tool_call' || step.type === 'tool_result',
  )
  if (steps.length === 0) {
    return (
      <p className="rounded-lg bg-muted/30 px-3 py-4 text-label text-muted-foreground">
        {t('noSteps')}
      </p>
    )
  }

  return (
    <div className="relative space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-border">
      {steps.map((step, index) => {
        const kind = stepKind(step)
        return (
          <div key={`${task.taskId}-${step.type}-${index}`} className="relative flex gap-3">
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card',
                stepIconTone(kind),
              )}
            >
              <StepIcon kind={kind} />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-stroke-default bg-background px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-label font-medium">{stepTitle(step, t)}</p>
                {step.approval ? <ApprovalChip state={step.approval.state} /> : null}
              </div>
              <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                {stepDescription(step, t)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TaskDetail({
  task,
  stopping,
  onStop,
  onRerun,
  onOpenConversation,
  onInject,
}: {
  task: AgentTaskView
  stopping: boolean
  onStop: () => void
  onRerun: () => void
  onOpenConversation?: () => void
  onInject: (content: string) => Promise<boolean>
}) {
  const t = useTranslations('agentTaskCenter')
  const ta = useTranslations('agentTasks')
  const [injectText, setInjectText] = React.useState('')
  const [injecting, setInjecting] = React.useState(false)
  React.useEffect(() => {
    setInjectText('')
    setInjecting(false)
  }, [task.taskId])
  const pending =
    task.status === 'running' || task.status === 'waiting-approval'
      ? pendingApprovalStep(task)
      : undefined
  const outcome = taskOutcome(task)
  const workplace = isDefaultWorkspacePath(task.workspacePath)
    ? t('defaultWorkspaceName')
    : workspaceLabel(task.workspacePath)

  const submitInjection = async () => {
    const content = injectText.trim()
    if (!content || injecting) return
    setInjecting(true)
    const ok = await onInject(content)
    setInjecting(false)
    if (ok) setInjectText('')
  }

  return (
    <div className="space-y-4" data-testid="agent-task-detail">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">{t('detailTitle')}</p>
            <h2 className="mt-1 break-words text-heading font-semibold leading-snug">
              {task.goal}
            </h2>
          </div>
          <StatusBadge status={task.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-3 text-[11px]">
          <div className="min-w-0">
            <p className="text-muted-foreground">{t('detailWorkspace')}</p>
            <p className="mt-0.5 truncate font-medium">
              <Tooltip content={task.workspacePath}>
                <span className="block w-full truncate">{workplace || t('workspaceUnknown')}</span>
              </Tooltip>
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">{t('detailStarted')}</p>
            <p className="mt-0.5 font-medium">
              {formatTaskTime(task.startedAt) || t('workspaceUnknown')}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">{t('detailSteps')}</p>
            <p className="mt-0.5 font-medium">{t('stepsCount', { count: taskStepCount(task) })}</p>
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground">{t('detailPlatform')}</p>
            <p className="mt-0.5 font-medium">{t('detailPlatformValue')}</p>
          </div>
        </div>

        {pending ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 text-[11px] leading-relaxed">
              <p className="font-medium">{t('approvalBannerTitle')}</p>
              <p className="mt-0.5">{t('approvalBannerDesc')}</p>
            </div>
            <Link href="/chat" className="shrink-0 text-[11px] font-semibold underline">
              {t('goConfirm')}
            </Link>
          </div>
        ) : null}

        {outcome.kind === 'result' ? (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {ta('result')}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-label leading-relaxed">{outcome.text}</p>
          </div>
        ) : null}

        {outcome.kind === 'error' ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              {ta('error')}
            </p>
            <p className="mt-1 break-words text-label text-destructive">
              {friendlyError(outcome.text, t)}
            </p>
          </div>
        ) : null}

        {task.status === 'running' ? (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-label text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              {outcome.kind === 'running' ? outcomeText(task, t) : t('summaryRunning')}
            </div>
            {/* 保留原 AgentTasksPanel 的“中途插话”能力：运行中的任务不必切到技术面板。 */}
            <div className="flex items-center gap-2">
              <input
                value={injectText}
                onChange={(event) => setInjectText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitInjection()
                  }
                }}
                placeholder={t('injectPlaceholder')}
                maxLength={2000}
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 text-label outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                data-testid="agent-task-inject-input"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void submitInjection()}
                disabled={!injectText.trim() || injecting}
                data-testid="agent-task-inject"
              >
                {injecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {t('injectAction')}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-end gap-2">
          {task.conversationId && onOpenConversation ? (
            <Button variant="ghost" size="sm" onClick={onOpenConversation}>
              <MessageSquare className="h-3.5 w-3.5" />
              {t('openConversation')}
            </Button>
          ) : null}
          {task.status === 'running' ? (
            <Button variant="outline" size="sm" onClick={onStop} disabled={stopping}>
              {stopping ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {stopping ? t('stopping') : t('stop')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onRerun}>
              <RefreshCw className="h-3.5 w-3.5" />
              {t('rerun')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-body font-semibold">{t('timeline')}</h3>
          <span className="text-[11px] text-muted-foreground">{t('timelineHint')}</span>
        </div>
        <div className="mt-4">
          <Timeline task={task} />
        </div>
      </div>

      <details className="group rounded-xl border border-border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-label font-medium">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          {t('technicalDetails')}
          <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-border px-4 py-3 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="w-20 shrink-0 text-muted-foreground">{t('taskIdLabel')}</span>
            <span className="min-w-0 break-all font-mono">{task.taskId}</span>
          </div>
          {task.workspacePath ? (
            <div className="flex items-start gap-2">
              <span className="w-20 shrink-0 text-muted-foreground">{t('workspacePathLabel')}</span>
              <span className="min-w-0 break-all font-mono">{task.workspacePath}</span>
            </div>
          ) : null}
          {task.error || task.errorCode ? (
            <div>
              <p className="mb-1 text-muted-foreground">{t('errorReasonLabel')}</p>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed">
                {[task.errorCode, task.error].filter(Boolean).join(' — ')}
              </pre>
            </div>
          ) : null}
          <div>
            <p className="mb-1 text-muted-foreground">{t('rawTraceLabel')}</p>
            <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-2 font-mono text-[10px] leading-relaxed">
              {stepsJson(task)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  )
}

export function EmptyState({ mode, onNew }: { mode: Mode; onNew: () => void }) {
  const t = useTranslations('agentTaskCenter')
  const isCurrent = mode === 'current'
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-elevation-sm">
        <ListChecks className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-body font-semibold">
        {isCurrent ? t('emptyCurrentTitle') : t('emptyHistoryTitle')}
      </h2>
      <p className="mt-1 max-w-sm text-label leading-relaxed text-muted-foreground">
        {isCurrent ? t('emptyCurrentDesc') : t('emptyHistoryDesc')}
      </p>
      {isCurrent ? (
        <Button className="mt-4" size="sm" onClick={onNew}>
          <Plus className="h-3.5 w-3.5" />
          {t('newTask')}
        </Button>
      ) : (
        <p className="mt-4 text-[11px] text-muted-foreground">{t('emptyHistoryHint')}</p>
      )}
    </div>
  )
}
