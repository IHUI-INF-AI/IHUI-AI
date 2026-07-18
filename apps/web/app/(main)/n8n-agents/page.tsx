import type { Metadata } from 'next'
import { Bot, Plus, Workflow } from 'lucide-react'

import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Badge } from '@/components/data'
import { Container } from '@/components/layout'

export const metadata: Metadata = {
  title: 'N8N Agents',
  description: 'N8N 工作流集成：自动化编排 AI agent，含客服机器人、内容审核、数据同步等。',
}

interface N8nAgent {
  id: string
  name: string
  description: string
  active: boolean
  lastRunAt: string
  runCount: number
  icon: typeof Bot
}

const AGENTS: N8nAgent[] = [
  {
    id: 'customer-service',
    name: '客服机器人',
    description: '自动回复用户咨询，依据知识库匹配答案并支持人工转接。',
    active: true,
    lastRunAt: '2026-07-18 14:32',
    runCount: 18234,
    icon: Bot,
  },
  {
    id: 'content-moderation',
    name: '内容审核',
    description: '自动审核 UGC 内容，识别违规文本/图片并触发处置流程。',
    active: true,
    lastRunAt: '2026-07-18 14:08',
    runCount: 9821,
    icon: Bot,
  },
  {
    id: 'data-sync',
    name: '数据同步',
    description: '定期同步外部数据源至本地数据库，支持增量与全量同步。',
    active: false,
    lastRunAt: '2026-07-17 22:00',
    runCount: 412,
    icon: Bot,
  },
  {
    id: 'report-generation',
    name: '报表生成',
    description: '每日生成业务报表并推送到指定渠道，含邮件、IM 与对象存储。',
    active: true,
    lastRunAt: '2026-07-18 09:00',
    runCount: 326,
    icon: Bot,
  },
  {
    id: 'alert-notify',
    name: '告警通知',
    description: '监控异常指标并自动通知值班人员，支持多级升级策略。',
    active: false,
    lastRunAt: '2026-07-16 03:14',
    runCount: 87,
    icon: Bot,
  },
]

export default function N8nAgentsPage() {
  const activeCount = AGENTS.filter((a) => a.active).length

  return (
    <Container maxWidth="xl" padding={false} className="space-y-6 py-6">
      <header className="space-y-1 px-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <Workflow className="h-7 w-7 text-primary" />
          N8N Agents
        </h1>
        <p className="text-sm text-muted-foreground">
          N8N 工作流集成 - 通过 N8N 自动化编排 AI agent
        </p>
      </header>

      {/* 介绍卡片 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">N8N 工作流集成</h2>
              <Badge variant="primary">共 {AGENTS.length} 个 Agent</Badge>
              <Badge variant="success">{activeCount} 运行中</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              通过 N8N 自动化编排 AI
              agent，串联客服、审核、同步、报表与告警等场景，实现端到端流程自动化。
            </p>
          </div>
          <Button className="shrink-0">
            <Plus className="h-4 w-4" />
            创建新 Agent
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
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">ID: {agent.id}</p>
                  </div>
                </div>
                <Badge variant={agent.active ? 'success' : 'default'}>
                  {agent.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">{agent.description}</p>
              <div className="flex items-center justify-between border-t pt-3 text-xs">
                <div className="space-y-0.5">
                  <div className="text-muted-foreground">最后执行</div>
                  <div className="font-medium text-foreground">{agent.lastRunAt}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <div className="text-muted-foreground">执行次数</div>
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
