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
import {
  AGENT_TASK_STATUSES,
  UNRECOGNIZED_STATUS_LABEL_KEY,
  countUnrecognizedTasks,
  i18nLeafKey,
} from '@ihui/types'
import { KanbanColumn } from './KanbanColumn'
import { TaskDetailDialog } from './TaskDetailDialog'

// 列序 = 单一真相源 `@ihui/types` 的 AGENT_TASK_STATUSES(2026-09-27 D6/G3 收口)。
// 这里曾是一份逐字复制的第六处成员清单(与 @ihui/types、apps/api 的 zod enum、
// ai-service 的 dag_scheduler 各一份),而六态值是落库列 + REST + SSE 三重对外契约,
// 改任一侧即静默分叉且全仓无判据 —— 取证见 docs/d6-convergence-audit-2026-09-27.md §2.3。
// 尺子:scripts/check-agent-status-vocabulary-parity.mjs(SV3 判"端内第二份成员清单")。
const COLUMN_STATUSES = AGENT_TASK_STATUSES

/**
 * "未识别"档的文案键末段(2026-09-28 立)。键名住在 @ihui/types,端内只取末段 ——
 * 在这里再抄一份裸字面量当键名就是第二份真相(它漂移时界面只显示键名)。
 * 这一档刻意**不进 COLUMN_STATUSES**:枚举是对外契约,未识别项也不得被塞进任何已知列,
 * 它只以一枚计数存在(AGENTS §30「没有终态就写已完成是本仓最高频的失效型」)。
 */
const UNRECOGNIZED_LABEL_LEAF = i18nLeafKey(UNRECOGNIZED_STATUS_LABEL_KEY)
const PRIORITY_OPTIONS = [
  { value: '10', labelKey: 'high' },
  { value: '5', labelKey: 'medium' },
  { value: '0', labelKey: 'low' },
] as const

/** i18n 静态映射表 — 用于消除 `t(\`kanban.${var}\`)` 动态拼接。
 *  键集闭集于 PRIORITY_OPTIONS 的 labelKey(G-415/A7):开放 Record<string,string>
 *  下新增档会静默落 unknown 兜底,闭集让 tsc 在两侧任一侧加档时强制表态。 */
const KANBAN_LABEL_KEY: Record<(typeof PRIORITY_OPTIONS)[number]['labelKey'], string> = {
  high: 'kanban.high',
  medium: 'kanban.medium',
  low: 'kanban.low',
}

export function KanbanBoard() {
  const t = useTranslations('agent')
  const tc = useTranslations('common')
  // 未识别档的徽章文案与列头同命名空间(agents.kanban.*),不另开一套键(AGENTS §19)
  const tk = useTranslations('agents.kanban')
  const queryClient = useQueryClient()
  const { success } = useToast()

  // 2-2 团队任务板过滤('all' = 全部任务)
  const [teamFilter, setTeamFilter] = React.useState('all')
  const activeTeamId = teamFilter !== 'all' ? teamFilter : undefined

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agents-kanban', activeTeamId ?? 'all'],
    // 列数组 + "未识别"计数:计数与列**分家带**,绝不混进任何一列的 tasks(那等于按已知档统计)。
    queryFn: async (): Promise<{ columns: KanbanColumnData[]; unrecognizedCount: number }> => {
      // 2-2 团队过滤:选了团队时走 tasks?teamId= 再前端组列;未选走默认 6 列视图
      if (!activeTeamId) {
        const columns = await fetchKanbanColumns()
        return {
          columns,
          unrecognizedCount: countUnrecognizedTasks(columns.flatMap((column) => column.tasks)),
        }
      }
      const tasks = await fetchKanbanTasks(undefined, activeTeamId)
      return {
        columns: COLUMN_STATUSES.map((status) => ({
          status,
          titleKey: `agents.kanban.${status}`,
          tasks: tasks.filter((task) => task.status === status),
        })),
        // 未识别项刻意不进上面任何一列,只在这一维计数
        unrecognizedCount: countUnrecognizedTasks(tasks),
      }
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
      setCreateError(t('kanban.agentIdRequired'))
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

  const columns = data?.columns ?? []
  const unrecognizedCount = data?.unrecognizedCount ?? 0

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
                    className="flex w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                            {/* labelKey 是闭集,KANBAN_LABEL_KEY 全键覆盖:不再需要
                                unknown 兜底(原兜底键 'kanban.unknown' 在语言包里本就不存在) */}
                            {t(KANBAN_LABEL_KEY[opt.labelKey])}
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
                    placeholder={t('kanban.workspacePlaceholder')}
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

      {/* 未识别档只报数(2026-09-28 立):库里被写进六档之外的状态值,
          既不能被静默当成某个已知档(含"完成/失败"),也不能不吭声地不进任何列。
          计数与列分开渲染,原始状态串不进界面文案位(它是外部可写的值 —— 文案位即注入面)。 */}
      {unrecognizedCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground"
          data-testid="kanban-unrecognized-summary"
        >
          {/* 数字计数徽章按 AGENTS §4 的确定性居中模板(inline-flex + justify-center +
              leading-none + min-w + tabular-nums),否则位数一变就在色块里偏位 */}
          <span
            className="inline-flex h-4 min-w-4 items-center justify-center rounded-md bg-background px-1 text-[10px] font-semibold leading-none tabular-nums"
            data-testid="kanban-unrecognized-count"
          >
            {unrecognizedCount}
          </span>
          <span>{tk(UNRECOGNIZED_LABEL_LEAF)}</span>
        </div>
      )}

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
