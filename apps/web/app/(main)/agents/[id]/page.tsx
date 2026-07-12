'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Pencil, Sparkles, Tag } from 'lucide-react'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { AgentProgressPanel } from '@/components/ai/agent-progress-panel'
import { PlanReviewPanel } from '@/components/ai/plan-review-panel'
import { TaskListPanel } from '@/components/ai/task-list-panel'
import { SubAgentActivityFeed } from '@/components/ai/sub-agent-activity-feed'
import { BackgroundAgentsPanel, AgentSwarmMonitor, PermissionConfirmDialog } from '@/components/ai'
import type { PendingToolCall, SubAgentActivity } from '@/components/ai/types'

const MOCK_STEPS = [
  { id: 's1', title: '分析需求', status: 'done' as const, duration: 320 },
  {
    id: 's2',
    title: '生成方案',
    status: 'running' as const,
    detail: '正在调用工具检索相关文档...',
  },
  { id: 's3', title: '执行修改', status: 'pending' as const },
]

const MOCK_PLAN = {
  summary: '重构用户认证模块，拆分为独立服务',
  steps: [
    { id: 'p1', description: '梳理现有认证逻辑', tools: ['grep', 'read_file'] },
    { id: 'p2', description: '抽取 AuthService', tools: ['edit_file'] },
    { id: 'p3', description: '补充单元测试', tools: ['run_test'] },
  ],
}

const MOCK_TASKS = [
  {
    id: 't1',
    title: '编写接口文档',
    status: 'in-progress' as const,
    priority: 'high' as const,
    assignee: 'Agent',
  },
  { id: 't2', title: '回归测试', status: 'todo' as const, priority: 'medium' as const },
]

const MOCK_ACTIVITIES: SubAgentActivity[] = [
  {
    agentId: 'a1',
    name: '检索 Agent',
    type: 'researcher',
    status: 'completed',
    currentStep: '',
    completedSteps: [{ stepAction: '搜索相关代码', createdAt: '', status: 'completed' }],
  },
  {
    agentId: 'a2',
    name: '编码 Agent',
    type: 'coder',
    status: 'running',
    currentStep: '编辑 auth.ts',
    completedSteps: [],
  },
]

const MOCK_TOOL_CALL: PendingToolCall = {
  id: 'tc1',
  name: 'edit_file',
  input: { path: 'src/auth.ts', action: 'overwrite' },
  reason: '需要修改认证逻辑',
  iteration: 1,
}

interface Agent {
  agentId: string
  name: string
  description: string | null
  avatar: string | null
  cover: string | null
  categoryId: string | null
  workspaceId: string | null
  status: string
  price: number
  isFree: boolean
  sort: number
  remark: string | null
  createdAt: string
  updatedAt: string
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

const STATUS_KEY: Record<string, string> = {
  pending: 'statusPending',
  published: 'statusPublished',
  rejected: 'statusRejected',
  offline: 'statusOffline',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
  published: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  rejected: 'bg-destructive/10 text-destructive',
  offline: 'bg-muted text-muted-foreground',
}

export default function AgentDetailPage() {
  const t = useTranslations('agents')
  const tc = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [permOpen, setPermOpen] = React.useState(false)

  const {
    data: agent,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agents', 'detail', id],
    queryFn: () => api<Agent>(`/api/agents/${id}`),
    enabled: !!id,
  })

  const priceFmt = new Intl.NumberFormat(locale, { style: 'currency', currency: 'CNY' })
  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusKey = agent ? (STATUS_KEY[agent.status] ?? 'statusPending') : ''
  const statusClass = agent ? (STATUS_CLASS[agent.status] ?? STATUS_CLASS.pending) : ''

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push('/agents')}>
          <ArrowLeft className="h-4 w-4" />
          {tc('back')}
        </Button>
        {agent && (
          <Button size="sm" onClick={() => router.push(`/agents/${id}/edit`)}>
            <Pencil className="h-4 w-4" />
            {tc('edit')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : !agent ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-20 text-center">
          <Sparkles className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t('notFound')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border">
            <div className="relative h-48 w-full bg-muted">
              {agent.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={agent.cover} alt={agent.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/40">
                  <Sparkles className="h-12 w-12" />
                </div>
              )}
            </div>

            <div className="space-y-4 p-6">
              <div className="flex items-start gap-4">
                <Avatar
                  src={agent.avatar ?? undefined}
                  name={agent.name ?? 'A'}
                  size="xl"
                  shape="square"
                  className="-mt-12 h-20 w-20 text-2xl border-4 border-background rounded-xl"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h1 className="break-words text-2xl font-bold tracking-tight">{agent.name}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        statusClass,
                      )}
                    >
                      {t(statusKey)}
                    </span>
                    {agent.categoryId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        {t('category')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('fieldPrice')}</span>
                  <span
                    className={cn(
                      'text-lg font-semibold',
                      agent.isFree ? 'text-emerald-600 dark:text-emerald-500' : 'text-primary',
                    )}
                  >
                    {agent.isFree ? t('free') : priceFmt.format(agent.price)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-medium text-muted-foreground">
                  {t('fieldDescription')}
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {agent.description || t('noDescription')}
                </p>
              </div>

              {agent.remark && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-muted-foreground">{tc('remark')}</h2>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {agent.remark}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('fieldCreatedAt')}</span>
                  <p className="mt-0.5 font-medium">{dateFmt.format(new Date(agent.createdAt))}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('fieldUpdatedAt')}</span>
                  <p className="mt-0.5 font-medium">{dateFmt.format(new Date(agent.updatedAt))}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 运行时预览（示例数据） */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground">运行时预览</h2>
            <AgentProgressPanel steps={MOCK_STEPS} />
            <PlanReviewPanel plan={MOCK_PLAN} />
            <SubAgentActivityFeed swarmId={agent.agentId} activities={MOCK_ACTIVITIES} />
            <TaskListPanel tasks={MOCK_TASKS} />
            <div className="grid gap-4 md:grid-cols-2">
              <BackgroundAgentsPanel agents={[]} />
              <AgentSwarmMonitor swarmData={null} />
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={() => setPermOpen(true)}>
                查看权限确认示例
              </Button>
              <PermissionConfirmDialog
                open={permOpen}
                onOpenChange={setPermOpen}
                toolCall={MOCK_TOOL_CALL}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}
