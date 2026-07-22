'use client'

import * as React from 'react'
import { Loader2, Plus, RefreshCw, Search, Sparkles, AlertCircle } from 'lucide-react'
import { Button, Card, CardContent, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, cn } from '@ihui/ui'
import { fetchApi } from '@/lib/api'
import { AgentCard, AgentDetailCard, normalizeAgent, type Agent, type RawAgent } from './components/AgentCard'
import { AgentCreator } from './components/AgentCreator'
import { AgentRuntimeLog } from './components/AgentRuntimeLog'
import { AgentSessionList } from './components/AgentSessionList'

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'running', label: '运行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'stopped', label: '已停止' },
  { value: 'error', label: '异常' },
]

const MODEL_FILTERS = [
  { value: 'all', label: '全部模型' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'claude-3-5-sonnet', label: 'claude-3-5-sonnet' },
  { value: 'glm-4.5', label: 'glm-4.5' },
  { value: 'default', label: 'default' },
]

type Action = 'start' | 'stop' | 'pause' | 'copy' | 'delete'

export default function AgentWorkbenchPage() {
  const [agents, setAgents] = React.useState<Agent[]>([])
  const [loading, setLoading] = React.useState(false)
  const [err, setErr] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState('all')
  const [modelFilter, setModelFilter] = React.useState('all')
  const [search, setSearch] = React.useState('')
  const [creatorOpen, setCreatorOpen] = React.useState(false)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [toast, setToast] = React.useState<string | null>(null)

  const loadAgents = React.useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await fetchApi<{ list?: RawAgent[]; data?: RawAgent[] }>('/api/agents?pageSize=200')
      if (res.success) {
        const normalized = (res.data.list ?? res.data.data ?? []).map(normalizeAgent)
        setAgents(normalized)
        setSelectedId((prev) => (prev && normalized.find((a) => a.id === prev) ? prev : null))
      } else {
        setErr(res.error || '加载失败')
        setAgents([])
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '网络异常')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void loadAgents() }, [loadAgents])

  const filtered = agents.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (modelFilter !== 'all' && a.model !== modelFilter) return false
    const kw = search.trim().toLowerCase()
    if (kw && !a.name.toLowerCase().includes(kw) && !a.role.toLowerCase().includes(kw)) return false
    return true
  })

  const selected = agents.find((a) => a.id === selectedId) ?? null
  const isEmptyFilter = !!(search || statusFilter !== 'all' || modelFilter !== 'all')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const handleAction = async (action: Action, agent: Agent) => {
    if (action === 'copy') {
      const config = {
        name: agent.name, role: agent.role, model: agent.model,
        tools: agent.tools ?? [], permissionMode: agent.permissionMode ?? 'default',
        maxIterations: agent.maxIterations ?? 25, systemPrompt: agent.systemPrompt ?? '',
      }
      try {
        await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
        showToast(`已复制 ${agent.name} 配置到剪贴板`)
      } catch {
        showToast('剪贴板不可用')
      }
      return
    }
    setActionLoading(true)
    const endpoint = action === 'delete'
      ? `/api/agents/${encodeURIComponent(agent.id)}`
      : `/api/agents/${encodeURIComponent(agent.id)}/${action}`
    try {
      const res = await fetchApi<unknown>(endpoint, { method: action === 'delete' ? 'DELETE' : 'POST' })
      if (res.success) {
        const label = action === 'start' ? '启动' : action === 'stop' ? '停止' : '暂停'
        showToast(`${agent.name} 已${label}`)
        await loadAgents()
      } else {
        showToast(res.error || '操作失败')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : '网络异常')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agent 工作台</h1>
            <p className="mt-1 text-sm text-muted-foreground">可视化创建、管理和监控 AI Agent</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAgents} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              刷新
            </Button>
            <Button size="sm" onClick={() => setCreatorOpen(true)}>
              <Plus className="h-4 w-4" />
              新建 Agent
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索 Agent 名字或角色..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
            </SelectContent>
          </Select>
          <Select value={modelFilter} onValueChange={setModelFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODEL_FILTERS.map((f) => (<SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-3">
          {loading && agents.length === 0 ? (
            <Card><CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
            </CardContent></Card>
          ) : err ? (
            <Card><CardContent className="space-y-2 py-8 text-center text-sm text-destructive">
              <AlertCircle className="mx-auto h-6 w-6" />
              <p>{err}</p>
              <Button variant="outline" size="sm" onClick={loadAgents}>重试</Button>
            </CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Sparkles className="h-8 w-8 opacity-40" />
              <p className="text-sm">{isEmptyFilter ? '没有匹配的 Agent' : '还没有 Agent,点击右上角新建'}</p>
            </CardContent></Card>
          ) : (
            <>
              {filtered.map((a) => (
                <AgentCard key={a.id} agent={a} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)} onAction={(action) => handleAction(action, a)} />
              ))}
              {actionLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> 操作中...
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4 lg:col-span-6">
          {selected ? (
            <>
              <AgentDetailCard agent={selected} />
              <div className="h-[480px]">
                <AgentRuntimeLog agentId={selected.id} running={selected.status === 'running'} />
              </div>
            </>
          ) : (
            <Card><CardContent className="flex min-h-[400px] items-center justify-center text-sm text-muted-foreground">
              从左侧选择一个 Agent 查看详情和运行日志
            </CardContent></Card>
          )}
        </div>

        <div className="lg:col-span-3">
          <div className="h-[600px] lg:h-full lg:min-h-[540px]">
            <AgentSessionList agentId={selectedId} />
          </div>
        </div>
      </div>

      <AgentCreator open={creatorOpen} onOpenChange={setCreatorOpen} onCreated={loadAgents} />

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
