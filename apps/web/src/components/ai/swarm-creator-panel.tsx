'use client'

import * as React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import {
  Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@ihui/ui'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { useAiPanelStore } from '@/stores/ai-panel'
import { AgentSwarmMonitor } from './agent-swarm-monitor'

type CoordinationMode = 'hierarchical' | 'peer-to-peer' | 'market-based'
type AgentRole = 'coordinator' | 'worker' | 'reviewer'

/** Swarm 列表项(export 给外部使用) */
export interface SwarmItem {
  swarmId: string
  task: string
  status: string
}

/** 后端原始 Swarm(兼容 snake_case / camelCase) */
interface SwarmRaw {
  swarmId?: string
  swarm_id?: string
  task?: string
  status?: string
}

interface AgentFormItem {
  role: AgentRole
  name: string
  model: string
}

interface SwarmFormState {
  task: string
  coordination: CoordinationMode
  maxIterations: number
  autoOptimize: boolean
  workspacePath: string
  modelId: string
  agents: AgentFormItem[]
}

/** 状态颜色:pending 灰 / running 琥珀 / completed 绿 / failed 红 */
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-amber-500/10 text-amber-600',
  completed: 'bg-emerald-500/10 text-emerald-600',
  failed: 'bg-red-500/10 text-red-600',
}

const TEXTAREA_CLS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none'

const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  coordinator: '协调者',
  worker: '执行者',
  reviewer: '审查者',
}

/** SwarmCreatorPanel - Agent Swarm 创建 + 列表 + 监控(迁移自 Vue AgenticAIPage) */
export function SwarmCreatorPanel() {
  const t = useTranslations('agenticAI')
  // 默认 workspacePath 取 ai-panel store 中绑定的本地工作区
  const initialWorkspacePath = useAiPanelStore.getState().activeWorkspace?.path ?? ''
  const [form, setForm] = React.useState<SwarmFormState>({
    task: '',
    coordination: 'hierarchical',
    maxIterations: 10,
    autoOptimize: false,
    workspacePath: initialWorkspacePath,
    modelId: 'default',
    agents: [{ role: 'worker', name: 'Worker Agent', model: 'default' }],
  })
  const [selectedSwarmId, setSelectedSwarmId] = React.useState<string>('')

  // 拉取 Swarm 列表(分页 page=1 pageSize=20)
  const { data: swarmList = [], isLoading, error } = useQuery<SwarmItem[]>({
    queryKey: ['swarms', 'list', 1, 20],
    queryFn: async () => {
      const res = await fetchApi<{ swarms: SwarmRaw[] }>(
        '/api/workspace/swarms?page=1&pageSize=20',
      )
      if (!res.success) throw new Error(res.error)
      return (res.data?.swarms ?? []).map((item): SwarmItem => ({
        swarmId: item.swarmId ?? item.swarm_id ?? '',
        task: item.task ?? '',
        status: item.status ?? 'pending',
      }))
    },
  })

  // 创建 Swarm — 严格按后端 createSwarmSchema 发送 camelCase 字段
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchApi<SwarmRaw>('/api/workspace/swarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: form.task,
          workspacePath: form.workspacePath,
          modelId: form.modelId,
          agents: form.agents.map((a) => ({
            role: a.role,
            name: a.name,
            model: a.model,
          })),
          // coordination / maxIterations / autoOptimize 作为附加元数据一并下发
          metadata: {
            coordination: form.coordination,
            maxIterations: form.maxIterations,
            autoOptimize: form.autoOptimize,
          },
        }),
      })
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    onSuccess: (data) => {
      toast.success(t('createAndExecute'))
      const newId = data?.swarmId ?? data?.swarm_id ?? ''
      if (newId) setSelectedSwarmId(newId)
      setForm((f) => ({ ...f, task: '' }))
    },
    onError: (err: Error) => toast.error(err.message),
  })

  /** 状态文案(未知状态归入 pending) */
  const statusLabel = (status: string): string => {
    switch (status) {
      case 'running': return t('status.running')
      case 'completed': return t('status.completed')
      case 'failed': return t('status.failed')
      default: return t('status.pending')
    }
  }

  const onCreate = () => {
    if (!form.task.trim()) {
      toast.error(t('enterTaskDescription'))
      return
    }
    if (!form.workspacePath.trim()) {
      toast.error('工作空间路径不能为空')
      return
    }
    if (form.agents.length === 0) {
      toast.error('至少需要一个 Agent')
      return
    }
    createMutation.mutate()
  }

  /** 新增 Agent(默认 worker) */
  const addAgent = () => {
    setForm((f) => ({
      ...f,
      agents: [...f.agents, { role: 'worker', name: `Agent ${f.agents.length + 1}`, model: 'default' }],
    }))
  }

  /** 删除指定 Agent(保证至少保留 1 个) */
  const removeAgent = (idx: number) => {
    setForm((f) => {
      if (f.agents.length <= 1) return f
      return { ...f, agents: f.agents.filter((_, i) => i !== idx) }
    })
  }

  /** 更新指定 Agent 的字段 */
  const updateAgent = (idx: number, patch: Partial<AgentFormItem>) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }))
  }

  const canCreate =
    form.task.trim().length > 0 &&
    form.workspacePath.trim().length > 0 &&
    form.agents.length >= 1 &&
    !createMutation.isPending

  return (
    <div className="flex flex-wrap gap-5">
      <div className="w-full space-y-5 md:w-1/3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('createSwarm')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="swarm-task" className="text-sm font-medium">{t('taskDescription')}</Label>
              <textarea
                id="swarm-task"
                rows={4}
                value={form.task}
                onChange={(e) => setForm((f) => ({ ...f, task: e.target.value }))}
                placeholder={t('taskDescriptionPlaceholder')}
                className={TEXTAREA_CLS}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="swarm-workspace" className="text-sm font-medium">工作空间路径</Label>
              <Input
                id="swarm-workspace"
                value={form.workspacePath}
                onChange={(e) => setForm((f) => ({ ...f, workspacePath: e.target.value }))}
                placeholder="/path/to/workspace"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="swarm-model" className="text-sm font-medium">模型 ID</Label>
              <Input
                id="swarm-model"
                value={form.modelId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                placeholder="default"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t('coordinationMode')}</Label>
              <Select
                value={form.coordination}
                onValueChange={(v) => setForm((f) => ({ ...f, coordination: v as CoordinationMode }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hierarchical">{t('coordinationHierarchical')}</SelectItem>
                  <SelectItem value="peer-to-peer">{t('coordinationPeerToPeer')}</SelectItem>
                  <SelectItem value="market-based">{t('coordinationMarketBased')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="swarm-max-iter" className="text-sm font-medium">{t('maxIterations')}</Label>
              <Input
                id="swarm-max-iter"
                type="number"
                min={1}
                max={20}
                value={form.maxIterations}
                onChange={(e) => {
                  const v = Math.min(20, Math.max(1, Number(e.target.value) || 1))
                  setForm((f) => ({ ...f, maxIterations: v }))
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="swarm-auto-opt" checked={form.autoOptimize} onCheckedChange={(v) => setForm((f) => ({ ...f, autoOptimize: v === true }))} />
              <Label htmlFor="swarm-auto-opt" className="text-sm">{t('autoOptimize')}</Label>
            </div>

            {/* Agents 列表 — 每行 3 字段(role/name/model)+ 删除按钮 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Agents</Label>
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={addAgent}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  <span>添加 Agent</span>
                </Button>
              </div>
              <div className="space-y-2">
                {form.agents.map((agent, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={agent.role}
                      onValueChange={(v) => updateAgent(idx, { role: v as AgentRole })}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AGENT_ROLE_LABELS) as AgentRole[]).map((r) => (
                          <SelectItem key={r} value={r}>{AGENT_ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      className="h-8 flex-1"
                      value={agent.name}
                      onChange={(e) => updateAgent(idx, { name: e.target.value })}
                      placeholder="名称"
                    />
                    <Input
                      className="h-8 w-[120px]"
                      value={agent.model}
                      onChange={(e) => updateAgent(idx, { model: e.target.value })}
                      placeholder="default"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={form.agents.length <= 1}
                      onClick={() => removeAgent(idx)}
                      aria-label="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!canCreate}
              onClick={onCreate}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {t('createAndExecute')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">{t('mySwarm')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {error ? (
              <p className="px-4 py-6 text-center text-sm text-destructive">
                {(error as Error).message}
              </p>
            ) : isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading...</p>
            ) : swarmList.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t('selectSwarmHint')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">{t('id')}</TableHead>
                    <TableHead>{t('task')}</TableHead>
                    <TableHead className="w-[100px]">{t('status.title')}</TableHead>
                    <TableHead className="w-[100px]">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {swarmList.map((swarm) => (
                    <TableRow key={swarm.swarmId}>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs" title={swarm.swarmId}>
                        {swarm.swarmId}
                      </TableCell>
                      <TableCell className="max-w-[400px] truncate" title={swarm.task}>
                        {swarm.task}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-xs font-medium',
                            STATUS_CLS[swarm.status] ?? STATUS_CLS.pending,
                          )}
                        >
                          {statusLabel(swarm.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => setSelectedSwarmId(swarm.swarmId)}
                        >
                          {t('view')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="w-full md:w-2/3">
        {selectedSwarmId ? (
          <AgentSwarmMonitor swarmId={selectedSwarmId} swarmData={null} />
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              {t('selectSwarmHint')}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default SwarmCreatorPanel
