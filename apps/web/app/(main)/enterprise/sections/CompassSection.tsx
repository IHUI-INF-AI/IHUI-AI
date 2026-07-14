import { Zap, Brain, Layers, TrendingUp, Compass } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'

interface Quadrant {
  id: string
  tag: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  examples: string[]
  adoption: number
}

const QUADRANTS: Quadrant[] = [
  {
    id: 'q1',
    tag: 'Q1',
    icon: Zap,
    title: '高效助手',
    description: '简单决策 + 简单执行,快速部署高频应用',
    examples: ['知识问答', '流程自动化'],
    adoption: 78,
  },
  {
    id: 'q2',
    tag: 'Q2',
    icon: Brain,
    title: '智慧顾问',
    description: '复杂决策 + 简单执行,提供深度分析与建议',
    examples: ['数据分析', '决策支持'],
    adoption: 45,
  },
  {
    id: 'q3',
    tag: 'Q3',
    icon: Layers,
    title: '执行专家',
    description: '简单决策 + 复杂执行,处理跨系统复杂任务',
    examples: ['会议安排', '审批流程'],
    adoption: 52,
  },
  {
    id: 'q4',
    tag: 'Q4',
    icon: TrendingUp,
    title: '全能专家',
    description: '复杂决策 + 复杂执行,自主规划与多智能体协作',
    examples: ['营销自动化', '多智能体协同'],
    adoption: 60,
  },
]

export function CompassSection() {
  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        智能体场景罗盘
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">基于任务复杂度与自主决策度的场景规划</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          帮助企业识别和规划智能体应用场景,从简单到复杂逐步推进AI化
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {QUADRANTS.map((q) => {
          const Icon = q.icon
          return (
            <Card key={q.id} className="transition-colors hover:bg-accent">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {q.tag}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{q.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {q.examples.map((ex) => (
                    <span key={ex} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {ex}
                    </span>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${q.adoption}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{q.adoption}% 企业已采用</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
