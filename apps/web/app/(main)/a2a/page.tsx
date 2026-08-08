'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Activity,
  Bot,
  CheckCircle2,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8803'

type TabKey = 'agents' | 'register' | 'tasks'

type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

/** 后端 /api/a2a/agents 返回的智能体 */
interface Agent {
  agent_id: string
  name: string
  capabilities: string[]
  endpoint?: string
  description?: string
}

/** GET /api/a2a/agents 响应 */
interface AgentListResponse {
  agents: Agent[]
  count: number
}

/** POST /api/a2a/agents/register 请求体 */
interface RegisterAgentPayload {
  id: string
  name: string
  description?: string
  capabilities?: string[]
  endpoint?: string
}

/** 注册表单(能力为逗号分隔字符串,提交时转数组) */
interface RegisterForm {
  id: string
  name: string
  description: string
  capabilities: string
  endpoint: string
}

/** POST /api/a2a/tasks 与 GET /api/a2a/tasks/{id}/status 返回的任务 */
interface Task {
  task_id?: string
  id?: string
  name?: string
  status: TaskStatus
  assigned_agent_id?: string
  input?: Record<string, unknown>
  result?: unknown
  error?: string
  created_at?: string
  updated_at?: string
}

const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'running', 'completed', 'failed']

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value)
}

function isTask(value: unknown): value is Task {
  return (
    typeof value === 'object' && value !== null && 'status' in value && isTaskStatus((value as Task).status)
  )
}

function isAgentList(value: unknown): value is AgentListResponse {
  return (
    typeof value === 'object' && value !== null && Array.isArray((value as AgentListResponse).agents)
  )
}

/** 解析 JSON 任务输入,空串返回 undefined,非法 JSON 或非对象时抛错 */
function parseTaskInput(raw: string): Record<string, unknown> | undefined {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'JSON 解析失败')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('JSON 必须为对象')
  }
  return parsed as Record<string, unknown>
}

/** 逗号分隔字符串转数组(去空白、去空项) */
function parseCapabilities(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** AI 服务直连请求(AI_SERVICE_URL + JWT Bearer) */
async function apiFetch<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${AI_SERVICE_URL}${path}`, { ...init, headers })
  let json: unknown = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  if (!res.ok) {
    const message =
      typeof json === 'object' && json !== null && 'message' in json
        ? String((json as Record<string, unknown>).message)
        : undefined
    throw new Error(message ?? `A2A 请求失败:${res.status}`)
  }
  return json as T
}

const STATUS_LABEL_KEYS: Record<TaskStatus, 'pending' | 'running' | 'completed' | 'failed'> = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
}

const STATUS_CLASSES: Record<TaskStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-600',
  running: 'bg-sky-500/10 text-sky-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-rose-500/10 text-rose-600',
}

export default function A2APage() {
  const t = useTranslations('eduAi.a2a')
  const ct = useTranslations('common')
  const token = useAuthStore((s) => s.token)

  const [tab, setTab] = React.useState<TabKey>('agents')

  // ---- 智能体列表 ----
  const [agents, setAgents] = React.useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = React.useState(false)
  const [agentsError, setAgentsError] = React.useState<string | null>(null)

  // ---- 注册表单 ----
  const [form, setForm] = React.useState<RegisterForm>({
    id: '',
    name: '',
    description: '',
    capabilities: '',
    endpoint: '',
  })
  const [registerLoading, setRegisterLoading] = React.useState(false)
  const [registerError, setRegisterError] = React.useState<string | null>(null)
  const [registerSuccess, setRegisterSuccess] = React.useState(false)

  // ---- 任务派发 ----
  const [taskName, setTaskName] = React.useState('')
  const [taskDescription, setTaskDescription] = React.useState('')
  const [assignedAgentId, setAssignedAgentId] = React.useState('')
  const [taskInput, setTaskInput] = React.useState('')
  const [currentTask, setCurrentTask] = React.useState<Task | null>(null)
  const [sendLoading, setSendLoading] = React.useState(false)
  const [taskError, setTaskError] = React.useState<string | null>(null)

  // 轮询清理
  const stoppedRef = React.useRef(false)
  const pollTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    stoppedRef.current = false
    return () => {
      stoppedRef.current = true
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [])

  async function loadAgents() {
    setAgentsLoading(true)
    setAgentsError(null)
    try {
      const data = await apiFetch<unknown>('/api/a2a/agents', useAuthStore.getState().token)
      if (!isAgentList(data)) throw new Error('智能体列表返回格式异常')
      setAgents(data.agents)
    } catch (e) {
      setAgentsError((e as Error).message)
    } finally {
      setAgentsLoading(false)
    }
  }

  React.useEffect(() => {
    void loadAgents()
    }, [])

  function handleTabChange(key: TabKey) {
    setTab(key)
    if (key === 'agents') void loadAgents()
  }

  // ---- 注册 ----
  async function handleRegister() {
    if (!form.id.trim() || !form.name.trim()) {
      setRegisterError(t('error'))
      return
    }
    setRegisterLoading(true)
    setRegisterError(null)
    setRegisterSuccess(false)
    try {
      const payload: RegisterAgentPayload = {
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        capabilities: parseCapabilities(form.capabilities),
        endpoint: form.endpoint.trim() || undefined,
      }
      await apiFetch<unknown>('/api/a2a/agents/register', token, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setRegisterSuccess(true)
      setForm({ id: '', name: '', description: '', capabilities: '', endpoint: '' })
      await loadAgents()
    } catch (e) {
      setRegisterError((e as Error).message)
    } finally {
      setRegisterLoading(false)
    }
  }

  // ---- 任务派发 ----
  async function pollTask(taskId: string) {
    if (stoppedRef.current) return
    try {
      const task = await apiFetch<unknown>(
        `/api/a2a/tasks/${encodeURIComponent(taskId)}/status`,
        useAuthStore.getState().token,
      )
      if (stoppedRef.current) return
      if (!isTask(task)) throw new Error('任务状态返回格式异常')
      setCurrentTask(task)
      if (task.status === 'completed' || task.status === 'failed') {
        setSendLoading(false)
        return
      }
    } catch (e) {
      if (stoppedRef.current) return
      setTaskError((e as Error).message)
      setSendLoading(false)
      return
    }
    pollTimerRef.current = window.setTimeout(() => {
      pollTimerRef.current = null
      void pollTask(taskId)
    }, 3000)
  }

  async function handleSendTask() {
    if (!taskName.trim()) {
      setTaskError(t('error'))
      return
    }
    setSendLoading(true)
    setTaskError(null)
    setCurrentTask(null)
    try {
      const created = await apiFetch<unknown>('/api/a2a/tasks', token, {
        method: 'POST',
        body: JSON.stringify({
          name: taskName.trim(),
          description: taskDescription.trim() || undefined,
          input: parseTaskInput(taskInput),
          assigned_agent_id: assignedAgentId || undefined,
        }),
      })
      if (!isTask(created)) throw new Error('任务创建返回格式异常')
      const taskId = created.task_id ?? created.id
      if (!taskId) throw new Error('任务缺少 ID')
      setCurrentTask(created)
      await pollTask(taskId)
    } catch (e) {
      setTaskError((e as Error).message)
      setSendLoading(false)
    }
  }

  const tabs: Array<{ key: TabKey; icon: React.ComponentType<{ className?: string }>; label: string }> = [
    { key: 'agents', icon: Bot, label: t('tabAgents') },
    { key: 'register', icon: Plus, label: t('tabRegister') },
    { key: 'tasks', icon: Send, label: t('tabTasks') },
  ]

  const selectClassName =
    'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  const textareaClassName =
    'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

  return (
    <div className="space-y-4 px-4 py-6">
      <BackButton fallbackHref="/edu" />
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Network className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, icon: Icon, label }) => (
          <Button
            key={key}
            type="button"
            variant={tab === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleTabChange(key)}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      {/* Tab1 智能体列表 */}
      {tab === 'agents' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('tabAgents')} ({agents.length})
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={agentsLoading}
              onClick={() => void loadAgents()}
            >
              <RefreshCw className={cn('h-4 w-4', agentsLoading && 'animate-spin')} />
              {ct('refresh')}
            </Button>
          </div>

          {agentsLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : agentsError ? (
            <Alert variant="danger" description={agentsError} />
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
              <Bot className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('noAgents')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.agent_id} className="transition-colors hover:bg-accent">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium">{agent.name}</h3>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                        {agent.agent_id}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {agent.description}
                      </p>
                    )}
                    {agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {agent.capabilities.map((cap, i) => (
                          <span
                            key={`${agent.agent_id}-${i}-${cap}`}
                            className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    )}
                    {agent.endpoint && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {agent.endpoint}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Tab2 注册智能体 */}
      {tab === 'register' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              {t('tabRegister')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a2a-agent-id">{t('agentId')}</Label>
                <Input
                  id="a2a-agent-id"
                  value={form.id}
                  onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                  placeholder="my-agent"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a2a-agent-name">{t('agentName')}</Label>
                <Input
                  id="a2a-agent-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="a2a-agent-desc">{t('description')}</Label>
              <textarea
                id="a2a-agent-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className={textareaClassName}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="a2a-agent-caps">{t('capabilities')}</Label>
                <Input
                  id="a2a-agent-caps"
                  value={form.capabilities}
                  onChange={(e) => setForm((f) => ({ ...f, capabilities: e.target.value }))}
                  placeholder={t('capabilitiesHint')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="a2a-agent-endpoint">{t('endpoint')}</Label>
                <Input
                  id="a2a-agent-endpoint"
                  value={form.endpoint}
                  onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => void handleRegister()} disabled={registerLoading}>
                {registerLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('register')}
              </Button>
              {registerError && <Alert variant="danger" description={registerError} className="flex-1" />}
              {registerSuccess && <Alert variant="success" description={t('success')} className="flex-1" />}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Tab3 任务派发 */}
      {tab === 'tasks' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {t('tabTasks')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="a2a-task-name">{t('taskName')}</Label>
                  <Input
                    id="a2a-task-name"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a2a-task-agent">{t('assignAgent')}</Label>
                  <select
                    id="a2a-task-agent"
                    value={assignedAgentId}
                    onChange={(e) => setAssignedAgentId(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="">-</option>
                    {agents.map((agent) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.name} ({agent.agent_id})
                      </option>
                    ))}
                  </select>
                  {agents.length === 0 && (
                    <p className="text-xs text-muted-foreground">{t('noAgents')}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="a2a-task-desc">{t('description')}</Label>
                <textarea
                  id="a2a-task-desc"
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className={textareaClassName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="a2a-task-input">{t('taskInput')}</Label>
                <textarea
                  id="a2a-task-input"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  rows={4}
                  placeholder='{"question": "..."}'
                  className={cn(textareaClassName, 'font-mono text-xs')}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void handleSendTask()} disabled={sendLoading}>
                  {sendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('sendTask')}
                </Button>
                {taskError && <Alert variant="danger" description={taskError} className="flex-1" />}
              </div>
            </CardContent>
          </Card>

          {currentTask ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {t('taskStatus')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{currentTask.name ?? '-'}</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                      STATUS_CLASSES[currentTask.status],
                    )}
                  >
                    {currentTask.status === 'completed' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : currentTask.status === 'failed' ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Loader2 className={cn('h-3.5 w-3.5', 'animate-spin')} />
                    )}
                    {t(STATUS_LABEL_KEYS[currentTask.status])}
                  </span>
                </div>

                {currentTask.assigned_agent_id && (
                  <p className="text-xs text-muted-foreground">
                    {t('assignAgent')}: {currentTask.assigned_agent_id}
                  </p>
                )}

                {(currentTask.status === 'pending' || currentTask.status === 'running') && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('pollHint')}
                  </p>
                )}

                {currentTask.status === 'failed' && currentTask.error && (
                  <Alert variant="danger" description={currentTask.error} />
                )}

                {currentTask.status === 'completed' &&
                  currentTask.result !== undefined &&
                  currentTask.result !== null && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">{t('result')}</p>
                      <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap">
                        {JSON.stringify(currentTask.result, null, 2)}
                      </pre>
                    </div>
                  )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
