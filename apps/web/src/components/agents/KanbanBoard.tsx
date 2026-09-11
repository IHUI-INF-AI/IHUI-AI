// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Loader2, Plus, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  cn,
} from '@ihui/ui-react'
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
  fetchKanbanTasks,
  fetchMyTeams,
  createKanbanTask,
  getKanbanStreamUrl,
} from '@/lib/agent-kanban-api'
import type { KanbanColumn as KanbanColumnData, KanbanTask } from '@ihui/types'
import { KanbanColumn } from './KanbanColumn'
import { TaskDetailDialog } from './TaskDetailDialog'

const COLUMN_STATUSES = ['triage', 'todo', 'ready', 'in_progress', 'blocked', 'done'] as const
const PRIORITY_OPTIONS = [
  { value: '10', labelKey: 'high' },
  { value: '5', labelKey: 'medium' },
  { value: '0', labelKey: 'low' },
] as const

/** i18n 静态映射表 — 用于消除 `t(\`kanban.${var}\`)` 动态拼接 */
const KANBAN_LABEL_KEY: Record<string, string> = {
  high: 'kanban.high',
  medium: 'kanban.medium',
  low: 'kanban.low',
}

export function KanbanBoard() {
  const t = useTranslations('agent')
  const tc = useTranslations('common')
  const queryClient = useQueryClient()
  const { success } = useToast()

  // 2-2 团队任务板过滤('all' = 全部任务)
  const [teamFilter, setTeamFilter] = React.useState('all')
  const activeTeamId = teamFilter !== 'all' ? teamFilter : undefined

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents-kanban', activeTeamId ?? 'all'],
    queryFn: async (): Promise<KanbanColumnData[]> => {
      // 2-2 团队过滤:选了团队时走 tasks?teamId= 再前端组列;未选走默认 6 列视图
      if (!activeTeamId) return fetchKanbanColumns()
      const tasks = await fetchKanbanTasks(undefined, activeTeamId)
      return COLUMN_STATUSES.map((status) => ({
        status,
        titleKey: `agents.kanban.${status}`,
        tasks: tasks.filter((task) => task.status === status),
      }))
    },
  })

  // 2-2 团队过滤下拉数据源(失败静默降级为无团队可选)
  const { data: myTeams } = useQuery({
    queryKey: ['my-teams'],
    queryFn: fetchMyTeams,
  })
  const teams = myTeams ?? []

  const streamUrl = React.useMemo(() => getKanbanStreamUrl(), [])
  const { connected } = useAgentSSE(streamUrl)

  const [selectedTask, setSelectedTask] = React.useState<KanbanTask | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createName, setCreateName] = React.useState('')
  const [createDesc, setCreateDesc] = React.useState('')
  const [createPriority, setCreatePriority] = React.useState('5')
  const [createAgentId, setCreateAgentId] = React.useState('')
  const [createWorkspace, setCreateWorkspace] = React.useState('')
  const [createTeamId, setCreateTeamId] = React.useState('none')
  const [createError, setCreateError] = React.useState<string | null>(null)

  // 切换团队过滤时,创建表单的团队默认跟随
  const handleTeamFilterChange = (value: string) => {
    setTeamFilter(value)
    setCreateTeamId(value !== 'all' ? value : 'none')
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createKanbanTask({
        name: createName.trim(),
        description: createDesc.trim() || undefined,
        priority: parseInt(createPriority, 10),
        agentId: createAgentId.trim(),
        workspacePath: createWorkspace.trim() || undefined,
        teamId: createTeamId !== 'none' && createTeamId ? createTeamId : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents-kanban'] })
      success(t('kanban.newTask'))
      setCreateOpen(false)
      setCreateName('')
      setCreateDesc('')
      setCreatePriority('5')
      setCreateAgentId('')
      setCreateWorkspace('')
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
      setCreateWorkspace('')
      setCreateError(null)
    }
  }

  const columns = data ?? []

  return (
    <div className="px-4 py-4 flex h-full flex-col space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* 2-2 团队过滤(无团队时隐藏) */}
          {teams.length > 0 && (
            <Select value={teamFilter} onValueChange={handleTeamFilterChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder={t('kanban.allTeams')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('kanban.allTeams')}</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
            <CenteredText>
              {connected ? t('kanban.connected') : t('kanban.disconnected')}
            </CenteredText>
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
                            {t(KANBAN_LABEL_KEY[opt.labelKey] ?? 'kanban.unknown')}
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

                {/* 2-2 工作区路径(进入 in_progress 时据此抢工作区锁) */}
                <div className="space-y-2">
                  <Label htmlFor="task-workspace">{t('kanban.workspace')}</Label>
                  <Input
                    id="task-workspace"
                    value={createWorkspace}
                    onChange={(e) => setCreateWorkspace(e.target.value)}
                    maxLength={512}
                    placeholder="/workspaces/demo"
                  />
                </div>

                {/* 2-2 归属团队(团队任务板) */}
                {teams.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('kanban.team')}</Label>
                    <Select value={createTeamId} onValueChange={setCreateTeamId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('kanban.noTeam')}</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
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
              return <KanbanColumn key={status} column={column} onSelectTask={handleSelectTask} />
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
