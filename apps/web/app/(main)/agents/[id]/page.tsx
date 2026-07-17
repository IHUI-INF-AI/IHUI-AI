'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations, useLocale } from 'next-intl'
import { Loader2, ArrowLeft, Pencil, Sparkles, Tag } from 'lucide-react'
import Image from 'next/image'

import { fetchApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { DescriptionList } from '@/components/data/DescriptionList'
import { AgentProgressPanel } from '@/components/ai/agent-progress-panel'
import { PlanReviewPanel } from '@/components/ai/plan-review-panel'
import { TaskListPanel } from '@/components/ai/task-list-panel'
import { SubAgentActivityFeed } from '@/components/ai/sub-agent-activity-feed'
import { BackgroundAgentsPanel } from '@/components/ai/background-agents-panel'
import { AgentSwarmMonitor } from '@/components/ai/agent-swarm-monitor'
import { PermissionConfirmDialog } from '@/components/ai/permission-confirm-dialog'
import { CheckpointHistoryPanel } from '@/components/ai/checkpoint-history-panel'

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
          <Button size="sm" onClick={() => router.push(`/agents/edit/${id}`)}>
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
            <div className="relative h-32 w-full bg-muted">
              {agent.cover ? (
                <Image src={agent.cover} alt={agent.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground/40">
                  <Sparkles className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <Avatar
                  src={agent.avatar ?? undefined}
                  name={agent.name ?? 'A'}
                  size="lg"
                  shape="square"
                  className="-mt-8 h-16 w-16 text-xl border-4 border-background rounded-xl"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h1 className="break-words text-xl font-bold tracking-tight">{agent.name}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
                        statusClass,
                      )}
                    >
                      {t(statusKey)}
                    </span>
                    {agent.categoryId && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <Tag className="h-3 w-3" />
                        {t('category')}
                      </span>
                    )}
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        agent.isFree ? 'text-emerald-600 dark:text-emerald-500' : 'text-primary',
                      )}
                    >
                      {agent.isFree ? t('free') : priceFmt.format(agent.price)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {agent.description || t('noDescription')}
              </p>
              <div className="border-t pt-3">
                <DescriptionList
                  column={3}
                  items={[
                    { label: t('fieldAgentId'), value: agent.agentId },
                    { label: t('fieldCategory'), value: agent.categoryId ?? '—' },
                    { label: t('fieldWorkspace'), value: agent.workspaceId ?? '—' },
                    { label: t('fieldStatus'), value: t(statusKey) },
                    {
                      label: t('fieldPrice'),
                      value: agent.isFree ? t('free') : priceFmt.format(agent.price),
                    },
                    { label: t('fieldSort'), value: agent.sort },
                    {
                      label: t('fieldCreatedAt'),
                      value: dateFmt.format(new Date(agent.createdAt)),
                    },
                    {
                      label: t('fieldUpdatedAt'),
                      value: dateFmt.format(new Date(agent.updatedAt)),
                    },
                    { label: t('fieldRemark'), value: agent.remark ?? '—' },
                  ]}
                />
              </div>
            </div>
          </div>

          <Tabs defaultValue="progress" className="w-full">
            <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="progress">{t('tabProgress')}</TabsTrigger>
              <TabsTrigger value="swarm">{t('tabSwarm')}</TabsTrigger>
              <TabsTrigger value="checkpoint">{t('tabCheckpoint')}</TabsTrigger>
              <TabsTrigger value="plan">{t('tabPlan')}</TabsTrigger>
              <TabsTrigger value="activity">{t('tabActivity')}</TabsTrigger>
              <TabsTrigger value="background">{t('tabBackground')}</TabsTrigger>
              <TabsTrigger value="permission">{t('tabPermission')}</TabsTrigger>
            </TabsList>
            <TabsContent value="progress" className="space-y-4">
              <AgentProgressPanel steps={[]} />
              <TaskListPanel tasks={[]} />
            </TabsContent>
            <TabsContent value="swarm">
              <AgentSwarmMonitor swarmId={agent.agentId} swarmData={null} />
            </TabsContent>
            <TabsContent value="checkpoint">
              <CheckpointHistoryPanel checkpoints={[]} />
            </TabsContent>
            <TabsContent value="plan">
              <PlanReviewPanel plan={{ steps: [] }} />
            </TabsContent>
            <TabsContent value="activity">
              <SubAgentActivityFeed swarmId={agent.agentId} activities={[]} />
            </TabsContent>
            <TabsContent value="background">
              <BackgroundAgentsPanel agents={[]} />
            </TabsContent>
            <TabsContent value="permission" className="space-y-3">
              <Button variant="outline" size="sm" onClick={() => setPermOpen(true)}>
                {t('viewPermissionExample')}
              </Button>
              <PermissionConfirmDialog open={permOpen} onOpenChange={setPermOpen} toolCall={null} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
