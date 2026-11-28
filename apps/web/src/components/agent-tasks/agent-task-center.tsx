// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * AgentTaskCenter — 普通用户能看懂的 AI 任务中心。
 *
 * 这里刻意不复用工具抽屉里的技术视图：
 * - 主视线只显示「目标任务 / 当前状态 / 人话步骤 / 结果」
 * - taskId、tool 名、原始 JSON 全部收进「技术详情」
 * - 桌面宽屏：任务列表 + 详情双栏；窄屏：单栏，列表在上、详情在下
 *
 * 视图零件拆到 agent-task-center-view.tsx；本文件只保留状态、请求编排与布局。
 */

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ihui/ui-react'
import {
  ensureAgentDefaultWorkspace,
  getRecentWorkspaces,
  getWorkspacePermission,
  setWorkspacePermission,
} from '@ihui/api-client/endpoints/workspace'
import { createConversation } from '@ihui/api-client/endpoints/chat'

import { AuthGatePrompt } from '@/components/common'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { useToast } from '@/hooks/use-toast'
import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { normalizeTaskList } from '@/lib/task-view-model'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'
import { type AgentTaskView, isDefaultWorkspacePath, workspaceLabel } from '@/lib/agent-task-view'
import {
  EmptyState,
  GuideCard,
  type Mode,
  TaskDetail,
  TaskRow,
  WorkspaceCard,
} from './agent-task-center-view'

export interface AgentTaskCenterProps {
  /**
   * page = 独立页面（保留给兼容路由/测试）；
   * panel = AI 面板里的任务中心主视图，单列、紧凑、不再自动关闭面板。
   */
  variant?: 'page' | 'panel'
  /** panel 模式下打开既有技术视图（四源聚合看板），只在明确点击时进入 */
  onToggleTechnical?: () => void
}

export function AgentTaskCenter({ variant = 'page', onToggleTechnical }: AgentTaskCenterProps) {
  const t = useTranslations('agentTaskCenter')
  const ta = useTranslations('agentTasks')
  const { allow } = useAuthGate()
  const toast = useToast()
  const isPanel = variant === 'panel'
  const activeWorkspace = useAiPanelStore((state) => state.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((state) => state.setActiveWorkspace)
  const closePanel = useAiPanelStore((state) => state.closePanel)
  const conversationId = useChatStore((state) => state.conversationId)

  /**
   * 独立页面在 ≤1366 时会被 AI 面板压窄/盖住，进入页面时先收起面板。
   * panel 模式本身就在面板里，绝不触发这个 effect，否则会把自己关掉。
   */
  React.useEffect(() => {
    if (isPanel) return
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 1366px)')
    const sync = () => {
      if (query.matches) closePanel()
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [closePanel, isPanel])

  const [mode, setMode] = React.useState<Mode>('current')
  const [tasks, setTasks] = React.useState<AgentTaskView[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState(false)
  const [stoppingId, setStoppingId] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [goal, setGoal] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const loadSeq = React.useRef(0)

  const load = React.useCallback(
    async (options: { mode?: Mode; silent?: boolean } = {}) => {
      const targetMode = options.mode ?? mode
      const requestId = loadSeq.current + 1
      loadSeq.current = requestId
      if (!options.silent) setLoading(true)
      setLoadError(false)
      try {
        let incoming: AgentTaskView[] = []
        if (targetMode === 'history') {
          const res = await fetchApi<{ tasks: AgentTaskView[] }>(
            '/api/workspace/agent/history?limit=50',
          )
          if (requestId !== loadSeq.current) return
          if (!res.success) throw new Error(res.error || 'load failed')
          incoming = res.data?.tasks ?? []
        } else {
          const res = await fetchApi<{ tasks: Record<string, AgentTaskView> }>(
            '/api/workspace/agent/tasks',
          )
          if (requestId !== loadSeq.current) return
          if (!res.success) throw new Error(res.error || 'load failed')
          incoming = Object.values(res.data?.tasks ?? {})
          // “进行中”只放真正还会继续执行的任务；completed/failed/canceled 只在历史里出现。
          const activeStatuses = new Set(['running', 'queued', 'pending', 'waiting-approval'])
          incoming = incoming.filter((task) => activeStatuses.has(task.status))
        }
        const normalized = normalizeTaskList(incoming, {
          mergeByConversation: targetMode === 'current',
        })
        setTasks(normalized)
      } catch {
        if (requestId !== loadSeq.current) return
        setLoadError(true)
      } finally {
        if (requestId === loadSeq.current) setLoading(false)
      }
    },
    [mode],
  )

  React.useEffect(() => {
    if (!allow) return
    void load()
    // 只按「登录态 / 当前数据源」重载；toast/翻译变化不触发请求
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allow, mode])

  // 运行中的任务每 3 秒静默刷新；历史模式不轮询。
  React.useEffect(() => {
    if (!allow || mode !== 'current' || !tasks.some((task) => task.status === 'running')) return
    const timer = setInterval(() => void load({ silent: true }), 3000)
    return () => clearInterval(timer)
  }, [allow, mode, tasks, load])

  React.useEffect(() => {
    setSelectedId((current) => {
      if (tasks.length === 0) return null
      if (current && tasks.some((task) => task.taskId === current)) return current
      return tasks[0]?.taskId ?? null
    })
  }, [tasks])

  const selectedTask = tasks.find((task) => task.taskId === selectedId) ?? null

  const changeMode = (next: Mode) => {
    if (next === mode) return
    setMode(next)
    setSelectedId(null)
    setTasks([])
    setLoadError(false)
  }

  const openCreate = (prefill = '') => {
    setGoal(prefill)
    setCreateError(null)
    setDialogOpen(true)
  }

  /**
   * 新建后台任务不再要求用户先选目录：
   * 1. 已有工作区直接用，但默认工作区若是旧 default 档会先走幂等迁移；
   * 2. 最近工作区取第一个（已经登记过权限，默认工作区同样补迁移）；
   * 3. 都没有就请求服务端在已登记根内创建专用默认目录，并初始化 accept-edits。
   * 任何一步失败都回退到明确错误，绝不静默落到 API 进程 cwd。
   */
  const prepareWorkspace = async (): Promise<{ path: string; name: string }> => {
    if (activeWorkspace?.path) {
      // activeWorkspace 可能只是浏览器记住的目录，未必真的授权过。
      // 先查权限，已授权才直接用；否则继续走最近工作区 / 默认工作区。
      const permission = await getWorkspacePermission(activeWorkspace.path).catch(() => null)
      if (permission?.success && permission.data.permission) {
        let name = activeWorkspace.name || workspaceLabel(activeWorkspace.path)
        // 2026-11-28: 老账号的默认工作区可能还是 default 档，不重新建目录也要补迁移。
        if (
          isDefaultWorkspacePath(activeWorkspace.path) &&
          permission.data.permission.mode === 'default'
        ) {
          const ensured = await ensureAgentDefaultWorkspace().catch(() => null)
          if (ensured?.success) name = ensured.data.name || name
        }
        return { path: activeWorkspace.path, name }
      }
    }

    const recent = await getRecentWorkspaces().catch(() => null)
    const recentWorkspace = recent?.success ? recent.data.workspaces[0] : undefined
    if (recentWorkspace?.path) {
      let name = recentWorkspace.name
      if (isDefaultWorkspacePath(recentWorkspace.path)) {
        const ensured = await ensureAgentDefaultWorkspace().catch(() => null)
        if (ensured?.success) name = ensured.data.name || name
      }
      setActiveWorkspace({ path: recentWorkspace.path, name })
      return { path: recentWorkspace.path, name }
    }

    const created = await ensureAgentDefaultWorkspace()
    if (!created.success) {
      throw new Error(created.error || t('workspaceAutoFailed'))
    }
    const name = t('defaultWorkspaceName')
    // 2026-11-28:默认工作区是应用自建的后台落点，初始化成 accept-edits：
    // 文件写/改按预置模板自动放行，任意 shell 仍审计。服务端 default-workspace 路由
    // 已做过同一初始化，这里再写一次是为了兼容旧服务端/首次创建，幂等且只发生一次。
    const permission = await setWorkspacePermission({
      workspacePath: created.data.workspacePath,
      name,
      mode: 'accept-edits',
      initializeDefaults: true,
    })
    if (!permission.success) {
      throw new Error(permission.error || t('workspaceAutoFailed'))
    }
    setActiveWorkspace({ path: created.data.workspacePath, name })
    return { path: created.data.workspacePath, name }
  }

  const handleCreate = async () => {
    const trimmed = goal.trim()
    if (!trimmed) {
      setCreateError(t('goalRequired'))
      return
    }
    setCreating(true)
    setCreateError(null)
    try {
      const workspace = await prepareWorkspace()
      // 产品口径：用户任务 = 会话。没有当前会话时先建一个，任务与它绑定；
      // 否则任务会变成没有会话归属的孤儿，侧栏也看不到执行记录。
      let taskConversationId = conversationId
      if (!taskConversationId) {
        const chatState = useChatStore.getState()
        const createdConversation = await createConversation({
          title: trimmed.slice(0, 24),
          ...(chatState.currentModel ? { model: chatState.currentModel } : {}),
        })
        if (!createdConversation.success || !createdConversation.data?.conversation?.id) {
          throw new Error(
            createdConversation.success
              ? t('createFailed')
              : createdConversation.error || t('createFailed'),
          )
        }
        taskConversationId = createdConversation.data.conversation.id
        chatState.setConversationId(taskConversationId)
      }
      // 任务 = 会话：把刚确认的工作区绑定到这条会话，避免切回会话时
      // AI 面板把工作区状态重置成「未选择」。
      if (taskConversationId) {
        useAiPanelStore.getState().bindWorkspaceToConversation?.(taskConversationId)
      }
      const res = await fetchApi<{ taskId: string; status: string }>('/api/workspace/agent/run', {
        method: 'POST',
        body: JSON.stringify({
          goal: trimmed,
          workspacePath: workspace.path,
          ...(taskConversationId ? { conversationId: taskConversationId } : {}),
          background: true,
          maxIterations: 10,
        }),
      })
      if (!res.success || !res.data?.taskId) {
        throw new Error(res.success ? t('createFailed') : res.error || t('createFailed'))
      }
      setDialogOpen(false)
      setGoal('')
      setMode('current')
      setSelectedId(res.data.taskId)
      toast.success(t('started'))
      await load({ mode: 'current', silent: true })
    } catch (e) {
      setCreateError((e as Error).message || t('createFailed'))
    } finally {
      setCreating(false)
    }
  }

  const handleStop = async (taskId: string) => {
    setStoppingId(taskId)
    try {
      const res = await fetchApi<{ canceled: boolean }>(
        `/api/workspace/agent/tasks/${encodeURIComponent(taskId)}/cancel`,
        { method: 'POST' },
      )
      if (!res.success) throw new Error(res.error || 'cancel failed')
      toast.success(t('stopped'))
      await load({ silent: true })
    } catch {
      toast.error(t('stopFailed'))
    } finally {
      setStoppingId(null)
    }
  }

  const handleInject = async (taskId: string, content: string): Promise<boolean> => {
    try {
      const res = await fetchApi<{ accepted: boolean }>(
        `/api/workspace/agent/tasks/${encodeURIComponent(taskId)}/inject`,
        {
          method: 'POST',
          body: JSON.stringify({ content }),
        },
      )
      if (!res.success || !res.data?.accepted) {
        throw new Error(res.success ? t('injectFailed') : res.error || t('injectFailed'))
      }
      toast.success(t('injected'))
      return true
    } catch {
      toast.error(t('injectFailed'))
      return false
    }
  }

  const openConversation = (id: string) => {
    useChatStore.getState().setConversationId(id)
    useAiPanelStore.getState().openPanel()
  }

  const historyMode = mode === 'history'
  const count = tasks.length

  return (
    <div
      className={cn(
        'w-full space-y-5',
        isPanel
          ? 'relative z-10 space-y-3 rounded-xl bg-background p-2'
          : 'mx-auto max-w-[1180px] px-4 py-5 pb-20 sm:pb-5',
      )}
      data-testid="agent-task-center"
      data-variant={variant}
    >
      {isPanel ? (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-label font-semibold">{t('panelTitle')}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{t('panelSubtitle')}</p>
          </div>
          {allow ? (
            <div className="flex shrink-0 items-center gap-1">
              {onToggleTechnical ? (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onToggleTechnical}
                  data-testid="task-center-technical-toggle"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {t('technicalView')}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => openCreate()} data-testid="agent-task-new">
                <Plus className="h-3.5 w-3.5" />
                {t('newTask')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title={t('pageTitle')}
          subtitle={t('pageSubtitle')}
          actions={
            allow ? (
              <Button onClick={() => openCreate()} data-testid="agent-task-new">
                <Plus className="h-4 w-4" />
                {t('newTask')}
              </Button>
            ) : null
          }
        />
      )}

      {!allow ? (
        <AuthGatePrompt message={t('loginRequired')} className="my-auto" />
      ) : (
        <>
          <div className={cn('grid gap-5', !isPanel && '2xl:grid-cols-[minmax(0,1fr)_360px]')}>
            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1">
                  <button
                    type="button"
                    onClick={() => changeMode('current')}
                    data-testid="agent-task-mode-current"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-medium transition-colors',
                      !historyMode
                        ? 'bg-background text-foreground shadow-elevation-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t('currentTab')}
                    {!historyMode ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {count}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => changeMode('history')}
                    data-testid="agent-task-mode-history"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-label font-medium transition-colors',
                      historyMode
                        ? 'bg-background text-foreground shadow-elevation-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t('historyTab')}
                    {historyMode ? (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {count}
                      </span>
                    ) : null}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {loading ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {t('loading')}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void load()}
                    disabled={loading}
                    className="text-muted-foreground"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    {t('refresh')}
                  </Button>
                </div>
              </div>

              {loadError ? (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-label text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{t('loadFailed')}</p>
                    <p className="mt-0.5 text-[11px] opacity-80">{t('loadFailedHint')}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => void load()}
                    disabled={loading}
                  >
                    {t('retry')}
                  </Button>
                </div>
              ) : null}

              {!loadError && loading ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/10 text-label text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t('loading')}
                </div>
              ) : null}

              {!loadError && !loading && count === 0 ? (
                <EmptyState mode={mode} onNew={() => openCreate()} />
              ) : null}

              {!loadError && count > 0 ? (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <TaskRow
                      key={task.taskId}
                      task={task}
                      selected={task.taskId === selectedId}
                      onSelect={() => setSelectedId(task.taskId)}
                    />
                  ))}
                </div>
              ) : null}

              {historyMode && count > 0 ? (
                <p className="pt-1 text-[11px] text-muted-foreground">{t('historyFootnote')}</p>
              ) : null}
            </section>

            <aside
              className={cn('min-w-0 space-y-3', !isPanel && '2xl:sticky 2xl:top-4 2xl:self-start')}
            >
              {selectedTask ? (
                <TaskDetail
                  task={selectedTask}
                  stopping={stoppingId === selectedTask.taskId}
                  onStop={() => void handleStop(selectedTask.taskId)}
                  onRerun={() => openCreate(selectedTask.goal)}
                  onOpenConversation={
                    selectedTask.conversationId
                      ? () => openConversation(selectedTask.conversationId!)
                      : undefined
                  }
                  onInject={(content) => handleInject(selectedTask.taskId, content)}
                />
              ) : (
                <>
                  <WorkspaceCard compact={isPanel} />
                  {!isPanel ? <GuideCard /> : null}
                </>
              )}
            </aside>
          </div>

          {!isPanel ? (
            <p className="flex items-center justify-center gap-1 pt-1 text-[11px] text-muted-foreground">
              {t('footerHint')}
              <Link
                href="/chat"
                className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
              >
                {t('openChat')}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          ) : null}
        </>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (creating) return
          setDialogOpen(next)
          if (!next) setCreateError(null)
        }}
      >
        <DialogContent
          className="max-h-[90vh] grid-cols-1 overflow-y-auto data-[state=closed]:hidden sm:max-w-lg"
          overlayClassName="data-[state=closed]:hidden"
        >
          <DialogHeader>
            <DialogTitle>{t('createTitle')}</DialogTitle>
            <DialogDescription>{t('createDesc')}</DialogDescription>
          </DialogHeader>

          {createError ? (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-label text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{createError}</p>
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-label font-medium">{t('goalLabel')}</label>
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder={ta('goalPlaceholder')}
                maxLength={20_000}
                rows={4}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-body outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
                data-testid="agent-task-goal"
              />
              <p className="text-right text-[10px] text-muted-foreground">{goal.length} / 20000</p>
            </div>

            <div className="space-y-2">
              <p className="text-label font-medium">{t('examplesLabel')}</p>
              <div className="flex flex-wrap gap-1.5">
                {[t('example1'), t('example2'), t('example3')].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setGoal(example)}
                    className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-stroke-strong hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-label font-medium">{t('workspace')}</p>
              <WorkspaceCard compact />
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="min-w-0 flex-1">{t('permissionNote')}</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
              type="button"
            >
              {t('cancel')}
            </Button>
            <Button
              onClick={() => void handleCreate()}
              disabled={creating || !goal.trim()}
              data-testid="agent-task-start"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {creating ? t('starting') : t('start')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AgentTaskCenter
