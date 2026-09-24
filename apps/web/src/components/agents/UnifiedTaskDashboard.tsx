// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * UnifiedTaskDashboard — 统一任务运行时看板(D25,2026-09-19 立)。
 *
 * 收敛四源任务视图为单入口(对标 Codex 0.149 agents dashboard + Qoder Quest 看板,G-32):
 *   - kanban:DB 持久任务(GET /agents/kanban/tasks,与 KanbanBoard 共享 ['agents-kanban'] 缓存)
 *   - background:后台派单(内存,useActiveDispatches)
 *   - local:agentLoop 内存任务(GET /workspace/agent/tasks,与 AgentTasksPanel 同源)
 *   - cloud:云端运行(GET /cloud-runs)
 * 能力:跨源搜索/源过滤、启动(kanban ready→in_progress)、停止(kanban in_progress→blocked /
 *       后台派单 cancel)、改名(PATCH,成功后手动失效 ['agents-kanban']——PATCH 不广播 SSE)、
 *       @任务引用跨任务发消息(task_messages,仅 kanban 源可挂消息)。
 * 与 D6 协同:swarm/orchestration 监控视图仍在原 tab(D6 half-merge 在途,勿在此收敛)。
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AtSign,
  Boxes,
  Check,
  Loader2,
  MessageSquare,
  Pencil,
  Play,
  RefreshCw,
  Search,
  Send,
  Square,
  X,
} from 'lucide-react'
import { Badge, Button, Input } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import { isTopOverlay, popOverlay, pushOverlay } from '@/lib/overlay-stack'
import { fetchApi } from '@/lib/api'
import { formatTimeOnly } from '@/lib/date-utils'
import { Tooltip } from '@/components/feedback'
import { useToast } from '@/hooks/use-toast'
import { useActiveDispatches, useCancelDispatch } from '@/hooks/use-subagent-dispatch'
import {
  fetchKanbanTasks,
  transitionKanbanTask,
  renameKanbanTask,
  listTaskMessages,
  sendTaskMessage,
  type TaskMessageRow,
  type TaskMessageMention,
} from '@/lib/agent-kanban-api'
import type { KanbanTask } from '@ihui/types'

// ---------------------------------------------------------------------------
// 查询 key
// ---------------------------------------------------------------------------

/** kanban 任务查询 key(与 KanbanBoard 共享缓存:'all' = 无团队过滤) */
const KANBAN_TASKS_KEY = ['agents-kanban', 'all'] as const
const LOCAL_TASKS_KEY = ['workspace-agent-tasks'] as const
const CLOUD_RUNS_KEY = ['cloud-runs', 'latest'] as const

/** 任务消息时间线 key(按 taskId 分片) */
function taskMessagesKey(taskId: string) {
  return ['task-messages', taskId] as const
}

// ---------------------------------------------------------------------------
// 四源 → 统一行模型
// ---------------------------------------------------------------------------

type UnifiedSource = 'kanban' | 'background' | 'local' | 'cloud'
type UnifiedKind = 'running' | 'pending' | 'blocked' | 'done' | 'error'

interface UnifiedTaskRow {
  key: string
  source: UnifiedSource
  id: string
  name: string
  status: string
  kind: UnifiedKind
  updatedAt?: string
  /** 仅 local(agentLoop)源:迭代数 */
  iterations?: number
  /** 仅 kanban 源:原始任务对象(启动/停止/改名操作对象) */
  kanbanTask?: KanbanTask
}

/** cloud-runs 行形状(与 CloudRunsView 对齐的最小字段) */
interface CloudRunItem {
  run_id: string
  task: string
  status: 'running' | 'done' | 'error'
  started_at?: string
}

/** 本地 agentLoop 任务行形状(与 AgentTasksPanel 对齐) */
interface LocalAgentTaskItem {
  taskId: string
  goal: string
  status: string
  iterations: number
  startedAt?: string
}

function kanbanKind(status: string): UnifiedKind {
  if (status === 'in_progress') return 'running'
  if (status === 'done') return 'done'
  if (status === 'blocked') return 'blocked'
  return 'pending' // triage / todo / ready
}

function dispatchKind(status: string): UnifiedKind {
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'error'
  if (status === 'cancelled' || status === 'paused') return 'blocked'
  if (status === 'pending') return 'pending'
  return 'running'
}

function localKind(status: string): UnifiedKind {
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'error'
  if (status === 'canceled') return 'blocked'
  if (status === 'running') return 'running'
  return 'pending'
}

function cloudKind(status: string): UnifiedKind {
  if (status === 'done') return 'done'
  if (status === 'error') return 'error'
  return 'running'
}

/** 状态徽标配色(与 AgentTasksPanel STATUS_CLASS 同风格) */
const KIND_CLASS: Record<UnifiedKind, string> = {
  running: 'border-transparent bg-amber-500/15 text-amber-600 hover:bg-amber-500/15',
  pending: 'border-transparent bg-sky-500/15 text-sky-600 hover:bg-sky-500/15',
  blocked: 'border-transparent bg-muted text-muted-foreground hover:bg-muted',
  done: 'border-transparent bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15',
  error: 'border-transparent bg-destructive/15 text-destructive hover:bg-destructive/15',
}

/** 运行态排序优先级(running 最前) */
const KIND_RANK: Record<UnifiedKind, number> = {
  running: 0,
  pending: 1,
  blocked: 2,
  error: 3,
  done: 4,
}

// 源过滤 chips(静态 i18n 映射,消除动态拼接)
const SOURCE_FILTERS = ['all', 'kanban', 'background', 'local', 'cloud'] as const
type SourceFilter = (typeof SOURCE_FILTERS)[number]
const SOURCE_LABEL_KEY: Record<SourceFilter, string> = {
  all: 'filterAll',
  kanban: 'sourceKanban',
  background: 'sourceBackground',
  local: 'sourceLocal',
  cloud: 'sourceCloud',
}
const SOURCE_BADGE_KEY: Record<UnifiedSource, string> = {
  kanban: 'sourceKanban',
  background: 'sourceBackground',
  local: 'sourceLocal',
  cloud: 'sourceCloud',
}

/** 层栈 id(见 @/lib/overlay-stack):看板行内改名的 Esc 只在栈顶时被消费 */
const RENAME_OVERLAY_ID = 'unified-task-dashboard-rename'

/**
 * UnifiedTaskDashboard - 统一任务运行时看板(四源聚合 + 搜索/启动/停止/改名 + @任务消息)
 */
export function UnifiedTaskDashboard() {
  const t = useTranslations('unifiedDashboard')
  const tA11y = useTranslations('a11y')
  const toast = useToast()
  const queryClient = useQueryClient()

  // ---- 四源查询 ----
  const kanban = useQuery({
    queryKey: KANBAN_TASKS_KEY,
    // 包一层箭头函数:fetchKanbanTasks 带可选参数,直接引用会与 QueryFunction context 签名冲突
    queryFn: () => fetchKanbanTasks(),
    refetchInterval: 15000,
  })
  const activeDispatches = useActiveDispatches()
  const cancelDispatch = useCancelDispatch()
  const localTasks = useQuery({
    queryKey: LOCAL_TASKS_KEY,
    queryFn: async (): Promise<LocalAgentTaskItem[]> => {
      try {
        // 次要源失败静默降级(不阻塞其余源展示)
        const res = await fetchApi<{ tasks: Record<string, LocalAgentTaskItem> }>(
          '/api/workspace/agent/tasks',
        )
        return res.success && res.data ? Object.values(res.data.tasks ?? {}) : []
      } catch {
        return []
      }
    },
    refetchInterval: 10000,
  })
  const cloudRuns = useQuery({
    queryKey: CLOUD_RUNS_KEY,
    queryFn: async (): Promise<CloudRunItem[]> => {
      try {
        const res = await fetchApi<{ list: CloudRunItem[] }>('/api/cloud-runs?page=1&page_size=20')
        return res.success && res.data ? (res.data.list ?? []) : []
      } catch {
        return []
      }
    },
    refetchInterval: 15000,
  })

  // ---- 聚合 ----
  const rows = React.useMemo<UnifiedTaskRow[]>(() => {
    const list: UnifiedTaskRow[] = []
    for (const task of kanban.data ?? []) {
      list.push({
        key: `kanban:${task.id}`,
        source: 'kanban',
        id: task.id,
        name: task.name,
        status: task.status,
        kind: kanbanKind(task.status),
        updatedAt: task.updatedAt,
        kanbanTask: task,
      })
    }
    for (const d of activeDispatches.data ?? []) {
      list.push({
        key: `background:${d.id}`,
        source: 'background',
        id: d.id,
        name: d.goal,
        status: d.status,
        kind: dispatchKind(d.status),
        updatedAt: d.updatedAt,
      })
    }
    for (const lt of localTasks.data ?? []) {
      list.push({
        key: `local:${lt.taskId}`,
        source: 'local',
        id: lt.taskId,
        name: lt.goal,
        status: lt.status,
        kind: localKind(lt.status),
        updatedAt: lt.startedAt,
        iterations: lt.iterations,
      })
    }
    for (const r of cloudRuns.data ?? []) {
      list.push({
        key: `cloud:${r.run_id}`,
        source: 'cloud',
        id: r.run_id,
        name: r.task,
        status: r.status,
        kind: cloudKind(r.status),
        updatedAt: r.started_at,
      })
    }
    return list
  }, [kanban.data, activeDispatches.data, localTasks.data, cloudRuns.data])

  const stats = React.useMemo(() => {
    const s = { running: 0, error: 0 }
    for (const r of rows) {
      if (r.kind === 'running') s.running++
      if (r.kind === 'error') s.error++
    }
    return s
  }, [rows])

  // ---- 搜索 + 源过滤 ----
  const [search, setSearch] = React.useState('')
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>('all')

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => sourceFilter === 'all' || r.source === sourceFilter)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      .sort((a, b) => {
        const byKind = KIND_RANK[a.kind] - KIND_RANK[b.kind]
        if (byKind !== 0) return byKind
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      })
  }, [rows, search, sourceFilter])

  // ---- 操作 mutation ----
  // 启动:kanban ready → in_progress(状态机 ALLOWED_TRANSITIONS)
  const startTask = useMutation({
    mutationFn: (taskId: string) => transitionKanbanTask(taskId, 'in_progress'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      toast.success(t('toastStarted'))
    },
    onError: (e) => toast.error(e.message),
  })

  // 停止:kanban in_progress → blocked(后台派单走 cancelDispatch.mutate,不经此 mutation)
  const stopKanban = useMutation({
    mutationFn: (taskId: string) => transitionKanbanTask(taskId, 'blocked', t('stopReason')),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      toast.success(t('toastStopped'))
    },
    onError: (e) => toast.error(e.message),
  })

  // 改名:PATCH 后手动失效 ['agents-kanban'](PATCH 不广播 SSE,无 task_updated 事件)
  const renameTask = useMutation({
    mutationFn: (input: { taskId: string; name: string }) =>
      renameKanbanTask(input.taskId, { name: input.name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      toast.success(t('toastRenamed'))
    },
    onError: (e) => toast.error(e.message),
  })

  // ---- 改名行内编辑 ----
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [editDraft, setEditDraft] = React.useState('')
  // jsx-a11y/no-autofocus 禁用 autoFocus prop,进入编辑态改由 effect 聚焦
  const renameInputRef = React.useRef<HTMLInputElement | null>(null)
  React.useEffect(() => {
    if (!editingKey) return
    // 层栈:进入行内改名态即入栈为栈顶,此态下的 Esc 只由本层消费(不再连带关掉外层浮层)
    pushOverlay(RENAME_OVERLAY_ID)
    renameInputRef.current?.focus()
    return () => {
      popOverlay(RENAME_OVERLAY_ID)
    }
  }, [editingKey])

  const submitRename = (row: UnifiedTaskRow) => {
    const name = editDraft.trim()
    if (!name) return
    renameTask.mutate({ taskId: row.id, name })
    setEditingKey(null)
  }

  // ---- 消息区(仅 kanban 源) ----
  const [selected, setSelected] = React.useState<UnifiedTaskRow | null>(null)
  const [draft, setDraft] = React.useState('')
  const [mentions, setMentions] = React.useState<TaskMessageMention[]>([])
  const [mentionPickerOpen, setMentionPickerOpen] = React.useState(false)

  const selectedTaskId = selected?.source === 'kanban' ? selected.id : null
  const messages = useQuery({
    queryKey: taskMessagesKey(selectedTaskId ?? ''),
    queryFn: () => listTaskMessages(selectedTaskId!),
    enabled: selectedTaskId !== null,
  })

  const sendMessage = useMutation({
    mutationFn: (input: { taskId: string; content: string; mentions: TaskMessageMention[] }) =>
      sendTaskMessage(input),
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: ['task-messages', row.taskId] })
      setDraft('')
      setMentions([])
      toast.success(t('toastSent'))
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSend = () => {
    if (!selectedTaskId) return
    const content = draft.trim()
    if (!content) return
    sendMessage.mutate({ taskId: selectedTaskId, content, mentions })
  }

  const toggleMention = (task: KanbanTask) => {
    setMentions((cur) =>
      cur.some((m) => m.taskId === task.id)
        ? cur.filter((m) => m.taskId !== task.id)
        : [...cur, { type: 'task', taskId: task.id, name: task.name }],
    )
  }

  const mentionCandidates = React.useMemo(
    () => (kanban.data ?? []).filter((task) => task.id !== selectedTaskId),
    [kanban.data, selectedTaskId],
  )

  // ---- 整体刷新 ----
  const refreshAll = () => {
    void kanban.refetch()
    void activeDispatches.refetch()
    void localTasks.refetch()
    void cloudRuns.refetch()
  }
  const refreshing =
    kanban.isFetching ||
    activeDispatches.isFetching ||
    localTasks.isFetching ||
    cloudRuns.isFetching

  return (
    <div className="flex flex-col gap-2 px-1 py-2" data-testid="unified-task-dashboard">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t('title')}</span>
        </div>
        <Button variant="outline" size="xs" onClick={refreshAll} disabled={refreshing}>
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          {t('refresh')}
        </Button>
      </div>

      {/* 搜索 */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          maxLength={200}
          className="h-8 pl-7 text-xs"
          data-testid="unified-task-search"
        />
      </div>

      {/* 源过滤 chips */}
      <div className="flex flex-wrap items-center gap-1">
        {SOURCE_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSourceFilter(s)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
              sourceFilter === s
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
            data-testid={`unified-source-${s}`}
          >
            {t(SOURCE_LABEL_KEY[s])}
          </button>
        ))}
      </div>

      {/* 统计行 */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{t('total', { count: rows.length })}</span>
        {stats.running > 0 && <span>{t('runningCount', { count: stats.running })}</span>}
        {stats.error > 0 && <span>{t('errorCount', { count: stats.error })}</span>}
      </div>

      {/* kanban 主源错误(其余源静默降级) */}
      {kanban.isError && (
        <div
          className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
          data-testid="unified-task-error"
        >
          {kanban.error.message}
        </div>
      )}

      {/* 任务列表 */}
      {filtered.length === 0 && (kanban.isLoading || activeDispatches.isLoading) ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((row) => (
            <li
              key={row.key}
              className="rounded-md border border-border bg-card p-2.5"
              data-testid={`unified-task-${row.source}`}
            >
              {editingKey === row.key ? (
                /* 改名行内编辑 */
                <div className="flex items-center gap-1.5">
                  <Input
                    ref={renameInputRef}
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(row)
                      if (e.key === 'Escape') {
                        if (!isTopOverlay(RENAME_OVERLAY_ID)) return
                        setEditingKey(null)
                      }
                    }}
                    maxLength={200}
                    className="h-7 flex-1 text-xs"
                    data-testid="unified-rename-input"
                  />
                  <Button
                    variant="outline"
                    size="icon-2xs"

                    disabled={renameTask.isPending || !editDraft.trim()}
                    onClick={() => submitRename(row)}
                    data-testid="unified-rename-confirm"
                  >
                    {renameTask.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon-2xs" onClick={() => setEditingKey(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={cn('px-1.5 py-0 text-[10px]', KIND_CLASS[row.kind])}>
                      {row.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[10px] text-muted-foreground"
                    >
                      {t(SOURCE_BADGE_KEY[row.source])}
                    </Badge>
                    {row.iterations !== undefined && (
                      <span className="text-[10px] text-muted-foreground">
                        {t('iterations', { count: row.iterations })}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {row.updatedAt ? formatTimeOnly(row.updatedAt) : ''}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 break-words text-xs">{row.name}</p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {/* 启动:kanban ready → in_progress */}
                    {row.source === 'kanban' && row.status === 'ready' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-600"
                        disabled={startTask.isPending}
                        onClick={() => startTask.mutate(row.id)}
                        data-testid="unified-start-btn"
                      >
                        <Play className="h-3 w-3" />
                        {t('start')}
                      </Button>
                    )}
                    {/* 停止:kanban in_progress → blocked */}
                    {row.source === 'kanban' && row.status === 'in_progress' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-xs text-red-600 hover:text-red-600"
                        disabled={stopKanban.isPending}
                        onClick={() => stopKanban.mutate(row.id)}
                        data-testid="unified-stop-btn"
                      >
                        <Square className="h-3 w-3" />
                        {t('stop')}
                      </Button>
                    )}
                    {/* 停止:后台派单 cancel(复用 useCancelDispatch,含双 key 失效) */}
                    {row.source === 'background' && row.kind === 'running' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-xs text-red-600 hover:text-red-600"
                        onClick={() => cancelDispatch.mutate(row.id)}
                        data-testid="unified-stop-btn"
                      >
                        <Square className="h-3 w-3" />
                        {t('stop')}
                      </Button>
                    )}
                    {/* 改名:仅 kanban(DB 持久任务) */}
                    {row.source === 'kanban' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          setEditingKey(row.key)
                          setEditDraft(row.name)
                        }}
                        data-testid="unified-rename-btn"
                      >
                        <Pencil className="h-3 w-3" />
                        {t('rename')}
                      </Button>
                    )}
                    {/* 消息:仅 kanban(task_messages 依赖 DB agentTasks) */}
                    {row.source === 'kanban' && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className={cn(
                          'h-6 px-2 text-xs',
                          selected?.key === row.key && 'text-primary',
                        )}
                        onClick={() => setSelected((cur) => (cur?.key === row.key ? null : row))}
                        data-testid="unified-messages-btn"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {t('messages')}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 消息区:选中 kanban 任务 → 时间线 + @ 引用发消息 */}
      {selectedTaskId && (
        <div
          className="rounded-md border border-border bg-muted/20 px-2.5 py-2"
          data-testid="unified-task-messages"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {t('messagesTitle')}
          </div>

          <div className="mt-1.5 max-h-52 space-y-1.5 overflow-y-auto">
            {messages.isLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            ) : (messages.data?.messages ?? []).length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">{t('messagesEmpty')}</p>
            ) : (
              (messages.data?.messages ?? []).map((m: TaskMessageRow) => (
                <div
                  key={m.id}
                  className="rounded bg-card px-2 py-1.5 text-xs"
                  data-testid="unified-task-message-item"
                >
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted px-1 py-0.5 font-mono">{m.fromType}</span>
                    {m.mentions.length > 0 && (
                      <span className="text-sky-600">
                        {m.mentions.map((mm) => `@${mm.name ?? mm.taskId.slice(0, 8)}`).join(' ')}
                      </span>
                    )}
                    <span className="ml-auto">{formatTimeOnly(m.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ))
            )}
          </div>

          {/* 已选 @ 引用 chips */}
          {mentions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {mentions.map((m) => (
                <span
                  key={m.taskId}
                  className="inline-flex items-center gap-0.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-600"
                >
                  @{m.name ?? m.taskId.slice(0, 8)}
                  <button
                    type="button"
                    onClick={() => setMentions((cur) => cur.filter((x) => x.taskId !== m.taskId))}
                    aria-label={tA11y('close')}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 输入行 */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend()
              }}
              placeholder={t('messagePlaceholder')}
              maxLength={8000}
              className="h-7 flex-1 text-xs"
              data-testid="unified-message-input"
            />
            <Tooltip content={t('mention')} side="bottom">
              <Button
                variant="outline"
                size="icon-2xs"

                onClick={() => setMentionPickerOpen((o) => !o)}
                data-testid="unified-mention-btn"
              >
                <AtSign className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
            <Button
              variant="outline"
              size="xs"
              disabled={!draft.trim() || sendMessage.isPending}
              onClick={handleSend}
              data-testid="unified-send-btn"
            >
              {sendMessage.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {t('send')}
            </Button>
          </div>

          {/* @ 任务选择列表(排除当前选中任务自身) */}
          {mentionPickerOpen && (
            <div className="mt-1.5 max-h-36 overflow-y-auto rounded border border-border bg-card p-1">
              {mentionCandidates.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('mentionEmpty')}</p>
              ) : (
                mentionCandidates.map((task) => {
                  const picked = mentions.some((m) => m.taskId === task.id)
                  return (
                    <button
                      key={task.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted',
                        picked && 'bg-sky-500/10',
                      )}
                      onClick={() => toggleMention(task)}
                      data-testid={`unified-mention-option-${task.id}`}
                    >
                      {picked ? (
                        <Check className="h-3 w-3 shrink-0 text-sky-600" />
                      ) : (
                        <AtSign className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                      <span className="line-clamp-1">{task.name}</span>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default UnifiedTaskDashboard
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
