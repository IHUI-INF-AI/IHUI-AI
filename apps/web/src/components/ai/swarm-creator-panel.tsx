'use client'

import * as React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Input, Label,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@ihui/ui'

import { cn } from '@/lib/utils'
import { fetchApi } from '@/lib/api'
import { AgentSwarmMonitor } from './agent-swarm-monitor'

type CoordinationMode = 'hierarchical' | 'peer-to-peer' | 'market-based'

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

interface SwarmFormState {
  task: string
  coordination: CoordinationMode
  maxIterations: number
  autoOptimize: boolean
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

/** SwarmCreatorPanel - Agent Swarm 创建 + 列表 + 监控(迁移自 Vue AgenticAIPage) */
export function SwarmCreatorPanel() {
  const t = useTranslations('agenticAI')
  const [form, setForm] = React.useState<SwarmFormState>({
    task: '',
    coordination: 'hierarchical',
    maxIterations: 10,
    autoOptimize: false,
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

  // 创建 Swarm
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchApi<SwarmRaw>('/api/workspace/swarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: form.task,
          coordination: form.coordination,
          maxIterations: form.maxIterations,
          autoOptimize: form.autoOptimize,
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
    createMutation.mutate()
  }

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

            <Button
              className="w-full"
              disabled={!form.task.trim() || createMutation.isPending}
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
