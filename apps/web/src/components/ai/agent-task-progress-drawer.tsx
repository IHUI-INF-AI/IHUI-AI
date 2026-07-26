'use client'

import * as React from 'react'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Ban,
  Circle,
  Play,
  Square,
  Eraser,
  Bot,
  FileText,
  Wrench,
  GitPullRequest,
} from 'lucide-react'
import { Drawer } from '@/components/feedback/Drawer'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui-react'
import { Button } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { useAgentProgressDrawerStore } from '@/stores/agent-progress-drawer'
import { useAgentProgress } from '@/hooks/use-agent-progress'
import type { AgentProgressTab } from '@/stores/agent-progress-drawer'
import type {
  AgentOverview,
  AgentStep,
  AgentToolCall,
  AgentChange,
} from '@/hooks/use-agent-progress'
import { ToolCallCard } from './tool-call-card'
import { DiffPreview } from './diff-preview'

/**
 * AgentTaskProgressDrawer — Codex 风格 Agent 任务进度查看弹窗(2026-07-27 立)
 *
 * 设计参考:OpenAI Codex 的 task progress panel
 *  - 4 tab 分区:概览 / 步骤 / 工具 / 变更
 *  - 实时状态指示(spinner / paused / error / cleared)
 *  - SSE 流式更新(通过 useAgentProgress hook 聚合)
 *  - 可折叠条目(节点 / 工具调用)
 *
 * 触发:AgentProgressTrigger 浮动按钮 / Ctrl+Shift+J 快捷键 / 编程式 openDrawer(threadId)
 * 关闭:Esc / 遮罩点击 / 关闭按钮
 */

const STATUS_META: Record<
  AgentOverview['status'],
  { icon: React.ComponentType<{ className?: string }>; label: string; cls: string }
> = {
  idle: { icon: Circle, label: '空闲', cls: 'text-muted-foreground' },
  running: { icon: Loader2, label: '执行中', cls: 'text-primary' },
  completed: { icon: CheckCircle2, label: '已完成', cls: 'text-emerald-500' },
  failed: { icon: AlertCircle, label: '失败', cls: 'text-red-500' },
  interrupted: { icon: Ban, label: '已暂停', cls: 'text-amber-500' },
}

const STEP_STATUS_ICON: Record<AgentStep['status'], React.ComponentType<{ className?: string }>> = {
  running: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
}

function formatDuration(ms?: number): string {
  if (ms === undefined) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

/** 概览 tab */
function OverviewTab({ overview }: { overview: AgentOverview }) {
  const meta = STATUS_META[overview.status]
  const StatusIcon = meta.icon

  return (
    <div className="space-y-3 py-2">
      <div className="rounded-md border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn('h-4 w-4', meta.cls, overview.status === 'running' && 'animate-spin')}
          />
          <span className="text-sm font-medium">{meta.label}</span>
          {overview.currentNode && (
            <span className="truncate text-xs text-muted-foreground" title={overview.currentNode}>
              · {overview.currentNode}
            </span>
          )}
        </div>
        {overview.sessionStart && (
          <div className="mt-1 text-xs text-muted-foreground">
            开始时间:{formatTime(overview.sessionStart)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <CounterCard label="步骤" done={overview.completedSteps} total={overview.totalSteps} />
        <CounterCard label="工具" done={overview.completedTools} total={overview.totalTools} />
        <CounterCard label="变更" total={overview.totalChanges} />
      </div>

      {overview.plan !== null && overview.plan !== undefined && (
        <Section title="执行计划" icon={FileText}>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-xs leading-relaxed">
            {typeof overview.plan === 'string'
              ? overview.plan
              : JSON.stringify(overview.plan, null, 2)}
          </pre>
        </Section>
      )}

      {overview.content && (
        <Section title="输出" icon={Bot}>
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-2 text-xs leading-relaxed">
            {overview.content}
          </div>
        </Section>
      )}

      {overview.error && (
        <Section title="错误" icon={AlertCircle}>
          <pre className="whitespace-pre-wrap break-words rounded-md bg-red-500/10 p-2 text-xs text-red-500">
            {overview.error}
          </pre>
        </Section>
      )}

      {overview.status === 'idle' && !overview.content && !overview.error && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          输入 threadId 后开始查看 Agent 任务进度
        </div>
      )}
    </div>
  )
}

function CounterCard({ label, done, total }: { label: string; done?: number; total: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">
        {done !== undefined ? (
          <span>
            <span className="text-emerald-500">{done}</span>
            <span className="text-muted-foreground">/{total}</span>
          </span>
        ) : (
          total
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      {children}
    </div>
  )
}

/** 步骤 tab */
function StepsTab({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) {
    return <EmptyState icon={Circle} text="暂无步骤" />
  }
  return (
    <ol className="space-y-1 py-2">
      {steps.map((step) => {
        const Icon = STEP_STATUS_ICON[step.status]
        return (
          <li
            key={step.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40"
          >
            <Icon
              className={cn(
                'h-3.5 w-3.5 shrink-0',
                step.status === 'running' && 'animate-spin text-primary',
                step.status === 'done' && 'text-emerald-500',
                step.status === 'error' && 'text-red-500',
              )}
            />
            <span className="flex-1 break-words text-xs font-medium">{step.nodeId}</span>
            {step.durationMs !== undefined && (
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {formatDuration(step.durationMs)}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** 工具 tab */
function ToolsTab({ tools }: { tools: AgentToolCall[] }) {
  if (tools.length === 0) {
    return <EmptyState icon={Wrench} text="暂无工具调用" />
  }
  return (
    <div className="space-y-2 py-2">
      {tools.map((tool) => (
        <ToolCallCard
          key={tool.id}
          toolName={tool.toolName}
          args={tool.args}
          result={tool.result}
          status={
            tool.status === 'running' ? 'running' : tool.status === 'error' ? 'error' : 'success'
          }
          duration={tool.durationMs}
          error={tool.error}
          iteration={tool.iteration}
        />
      ))}
    </div>
  )
}

/** 变更 tab */
function ChangesTab({ changes }: { changes: AgentChange[] }) {
  if (changes.length === 0) {
    return <EmptyState icon={GitPullRequest} text="暂无文件变更" />
  }
  return (
    <div className="space-y-3 py-2">
      {changes.map((change) => (
        <div key={change.id} className="overflow-hidden rounded-md border border-border">
          <div className="flex items-center gap-2 bg-muted/40 px-2.5 py-1.5">
            <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 break-words text-xs font-medium">{change.filePath}</span>
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {change.toolName}
            </span>
          </div>
          <DiffPreview
            oldContent={change.diffInfo.old_content}
            newContent={change.diffInfo.new_content}
            filename={change.diffInfo.file_path}
          />
        </div>
      ))}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

/** 主 Drawer 组件 */
export function AgentTaskProgressDrawer() {
  const open = useAgentProgressDrawerStore((s) => s.open)
  const threadId = useAgentProgressDrawerStore((s) => s.threadId)
  const activeTab = useAgentProgressDrawerStore((s) => s.activeTab)
  const threadIdInput = useAgentProgressDrawerStore((s) => s.threadIdInput)
  const closeDrawer = useAgentProgressDrawerStore((s) => s.closeDrawer)
  const setActiveTab = useAgentProgressDrawerStore((s) => s.setActiveTab)
  const setThreadIdInput = useAgentProgressDrawerStore((s) => s.setThreadIdInput)
  const submitThreadId = useAgentProgressDrawerStore((s) => s.submitThreadId)
  const setThreadId = useAgentProgressDrawerStore((s) => s.setThreadId)

  const progress = useAgentProgress(threadId)
  const { overview, steps, tools, changes, isStreaming } = progress

  const handleStart = React.useCallback(() => {
    if (threadId) {
      progress.start()
    }
  }, [threadId, progress])

  const handleStop = React.useCallback(() => {
    progress.stop()
  }, [progress])

  const handleClear = React.useCallback(() => {
    progress.clear()
    setThreadId(null)
  }, [progress, setThreadId])

  const handleInputSubmit = React.useCallback(() => {
    submitThreadId()
  }, [submitThreadId])

  const title = (
    <div className="flex items-center gap-2">
      <Bot className="h-4 w-4 text-primary" />
      <span>Agent 任务进度</span>
      {threadId && (
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          #{threadId.slice(0, 8)}
        </span>
      )}
      {isStreaming && (
        <Loader2 data-testid="drawer-streaming" className="h-3 w-3 animate-spin text-primary" />
      )}
    </div>
  )

  return (
    <Drawer open={open} onClose={closeDrawer} side="right" title={title} width="32rem">
      {/* ThreadId 输入栏 */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card p-2">
        <input
          type="text"
          value={threadIdInput}
          onChange={(e) => setThreadIdInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleInputSubmit()
            }
          }}
          placeholder="输入 threadId..."
          className="min-w-0 flex-1 bg-transparent px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none"
          data-testid="thread-id-input"
        />
        <Button
          size="sm"
          variant="default"
          onClick={handleInputSubmit}
          className="h-7 px-2.5 text-xs"
        >
          查看
        </Button>
      </div>

      {/* 控制按钮 */}
      {threadId && (
        <div className="mb-3 flex items-center gap-2">
          {isStreaming ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStop}
              className="h-7 gap-1.5 px-2.5 text-xs"
              data-testid="stop-btn"
            >
              <Square className="h-3 w-3" />
              停止
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={handleStart}
              className="h-7 gap-1.5 px-2.5 text-xs"
              data-testid="start-btn"
            >
              <Play className="h-3 w-3" />
              启动
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-7 gap-1.5 px-2.5 text-xs"
            data-testid="clear-btn"
          >
            <Eraser className="h-3 w-3" />
            清空
          </Button>
        </div>
      )}

      {/* 4 Tab 区 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AgentProgressTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-1 text-xs">
            概览
          </TabsTrigger>
          <TabsTrigger value="steps" className="gap-1 text-xs">
            步骤
            {steps.length > 0 && (
              <span className="rounded-sm bg-muted px-1 text-[10px] tabular-nums">
                {steps.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="tools" className="gap-1 text-xs">
            工具
            {tools.length > 0 && (
              <span className="rounded-sm bg-muted px-1 text-[10px] tabular-nums">
                {tools.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="changes" className="gap-1 text-xs">
            变更
            {changes.length > 0 && (
              <span className="rounded-sm bg-muted px-1 text-[10px] tabular-nums">
                {changes.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab overview={overview} />
        </TabsContent>
        <TabsContent value="steps">
          <StepsTab steps={steps} />
        </TabsContent>
        <TabsContent value="tools">
          <ToolsTab tools={tools} />
        </TabsContent>
        <TabsContent value="changes">
          <ChangesTab changes={changes} />
        </TabsContent>
      </Tabs>
    </Drawer>
  )
}

export default AgentTaskProgressDrawer
