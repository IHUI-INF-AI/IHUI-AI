import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Bot, Plus, Workflow } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Badge } from '@/components/data'
import { Container } from '@/components/layout'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('n8nAgentsPage')
  return {
    title: 'N8N Agents',
    description: t('metaDescription'),
  }
}

interface N8nAgent {
  id: string
  active: boolean
  lastRunAt: string
  runCount: number
  icon: typeof Bot
}

const AGENTS: N8nAgent[] = [
  {
    id: 'customer-service',
    active: true,
    lastRunAt: '2026-07-18 14:32',
    runCount: 18234,
    icon: Bot,
  },
  {
    id: 'content-moderation',
    active: true,
    lastRunAt: '2026-07-18 14:08',
    runCount: 9821,
    icon: Bot,
  },
  {
    id: 'data-sync',
    active: false,
    lastRunAt: '2026-07-17 22:00',
    runCount: 412,
    icon: Bot,
  },
  {
    id: 'report-generation',
    active: true,
    lastRunAt: '2026-07-18 09:00',
    runCount: 326,
    icon: Bot,
  },
  {
    id: 'alert-notify',
    active: false,
    lastRunAt: '2026-07-16 03:14',
    runCount: 87,
    icon: Bot,
  },
]

export default async function N8nAgentsPage() {
  const t = await getTranslations('n8nAgentsPage')
  const activeCount = AGENTS.filter((a) => a.active).length

  return (
    <Container maxWidth="xl" padding={false} className="space-y-6 py-6">
      <header className="space-y-1 px-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Workflow className="h-7 w-7 text-primary" />
          N8N Agents
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 介绍卡片 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{t('cardTitle')}</h2>
              <Badge variant="primary">{t('totalBadge', { n: AGENTS.length })}</Badge>
              <Badge variant="success">{t('activeBadge', { n: activeCount })}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t('cardDescription')}</p>
          </div>
          <Button className="shrink-0">
            <Plus className="h-4 w-4" />
            {t('createButton')}
          </Button>
        </CardContent>
      </Card>

      {/* Agent 列表 */}
      <div className="grid gap-4 md:grid-cols-2">
        {AGENTS.map((agent) => (
          <Card key={agent.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <agent.icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <CardTitle className="text-base">{t(`agents.${agent.id}.name`)}</CardTitle>
                    <p className="text-xs text-muted-foreground">ID: {agent.id}</p>
                  </div>
                </div>
                <Badge variant={agent.active ? 'success' : 'default'}>
                  {agent.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t(`agents.${agent.id}.description`)}
              </p>
              <div className="flex items-center justify-between border-t pt-3 text-xs">
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">{t('lastRunLabel')}</div>
                  <div className="font-medium text-foreground">{agent.lastRunAt}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <div className="text-muted-foreground">{t('runCountLabel')}</div>
                  <div className="font-medium tabular-nums text-foreground">
                    {agent.runCount.toLocaleString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Container>
  )
}
