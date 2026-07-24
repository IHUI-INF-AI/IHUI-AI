'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, cn } from '@ihui/ui-react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@ihui/ui-react'
import { CenteredText } from '@/components/common/CenteredText'
import { useToast } from '@/hooks/use-toast'
import { useAgentSSE } from '@/hooks/useAgentSSE'
import {
  fetchKanbanColumns,
  createKanbanTask,
  getKanbanStreamUrl,
} from '@/lib/agent-kanban-api'
import type { KanbanTask } from '@ihui/types'
import { KanbanColumn } from './KanbanColumn'
import { TaskDetailDialog } from './TaskDetailDialog'

const COLUMN_STATUSES = ['triage', 'todo', 'ready', 'in_progress', 'blocked', 'done'] as const
const PRIORITY_OPTIONS = [
  { value: '10', labelKey: 'high' },
  { value: '5', labelKey: 'medium' },
  { value: '0', labelKey: 'low' },
] as const

export function KanbanBoard() {
  const t = useTranslations('agents')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()
  const { success } = useToast()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents-kanban'],
    queryFn: fetchKanbanColumns,
  })

  const streamUrl = React.useMemo(() => getKanbanStreamUrl(), [])
  const { connected } = useAgentSSE(streamUrl)

  const [selectedTask, setSelectedTask] = React.useState<KanbanTask | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createName, setCreateName] = React.useState('')
  const [createDesc, setCreateDesc] = React.useState('')
  const [createPriority, setCreatePriority] = React.useState('5')
  const [createAgentId, setCreateAgentId] = React.useState('')
  const [createError, setCreateError] = React.useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createKanbanTask({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
        priority: parseInt(createPriority, 10),
        agentId: createAgentId.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      success(t('kanban.newTask'))
      setCreateOpen(false)
      setCreateName('')
      setCreateDesc('')
      setCreatePriority('5')
      setCreateAgentId('')
      setCreateError(null)
    },
    onError: (e: Error) => setCreateError(e.message),
  })

  const handleSelectTask = (task: KanbanTask) => {
    setSelectedTask(task)
    setDetailOpen(true)
  }

  const handleTaskChanged = () => {
    queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    if (!createName.trim()) {
      setCreateError(tc('errorTitle'))
      return
    }
    if (!createAgentId.trim()) {
      setCreateError('Agent ID is required')
      return
    }
    createMutation.mutate()
  }

  const handleCreateOpenChange = (open: boolean) => {
    if (!open && createMutation.isPending) return
    setCreateOpen(open)
    if (!open) {
      setCreateName('')
      setCreateDesc('')
      setCreatePriority('5')
      setCreateAgentId('')
      setCreateError(null)
    }
  }

  const columns = data ?? []

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* SSE 状态 */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium',
              connected
                ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <CenteredText>{connected ? t('kanban.connected') : t('kanban.disconnected')}</CenteredText>
          </span>

          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>

          <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t('kanban.newTask')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>{t('kanban.newTask')}</DialogTitle>
                  <DialogDescription>{t('title')}</DialogDescription>
                </DialogHeader>

                {createError && (
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {createError}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="task-name">{tc('add')}</Label>
                  <Input
                    id="task-name"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-desc">{tc('remark')}</Label>
                  <textarea
                    id="task-desc"
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t('kanban.priority')}</Label>
                    <Select value={createPriority} onValueChange={setCreatePriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {t(`kanban.${opt.labelKey}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-agent">Agent ID</Label>
                    <Input
                      id="task-agent"
                      value={createAgentId}
                      onChange={(e) => setCreateAgentId(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleCreateOpenChange(false)}
                    disabled={createMutation.isPending}
                  >
                    {t('kanban.cancel')}
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {createMutation.isPending ? tc('submit') : tc('create')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 看板区域 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">{tc('errorTitle')}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {tc('retry')}
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-3 pb-2">
            {COLUMN_STATUSES.map((status) => {
              const column = columns.find((c) => c.status === status) ?? {
                status,
                titleKey: `agents.kanban.${status}`,
                tasks: [],
              }
              return (
                <KanbanColumn
                  key={status}
                  column={column}
                  onSelectTask={handleSelectTask}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* 任务详情对话框 */}
      <TaskDetailDialog
        task={selectedTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTaskChanged={handleTaskChanged}
      />
    </div>
  )
}
