import {
  Building,
  Workflow,
  UserCheck,
  ArrowRight,
  UserPlus,
  UsersRound,
  Sparkles,
} from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'

const PHYSICAL_ITEMS = [
  { icon: Building, title: '组织架构', desc: '帮助企业梳理组织结构,定义数字员工岗位' },
  { icon: Workflow, title: '流程梳理', desc: '正向与逆向流程分析,优化业务运转效率' },
  { icon: UserCheck, title: '人本价值', desc: '企业文化、使命愿景、批判性思维与谦卑态度' },
]

const INFO_BASIC = ['信息化', '物联网', '自动化']
const INFO_ADVANCED = ['感知AI', '生成式AI', '智能体AI', '物理AI']

const EFFECT_FLOW = [
  { icon: UserPlus, label: '超级员工' },
  { icon: UsersRound, label: '超级团队' },
  { icon: Sparkles, label: '超级产品/服务' },
]

const EFFECT_METRICS = ['成本优化', '效率提升', '体验升级']

export function ArchitectureSection() {
  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        企业AI化服务架构
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">
          从物理世界到信息世界,构建人机协同的超级企业
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                LAYER 01
              </span>
              <h3 className="text-base font-semibold">物理世界</h3>
            </div>
            <div className="space-y-3">
              {PHYSICAL_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                LAYER 02
              </span>
              <h3 className="text-base font-semibold">信息世界</h3>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground">初级信息世界</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {INFO_BASIC.map((item) => (
                    <span key={item} className="rounded-md bg-muted px-2 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">高级信息世界</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {INFO_ADVANCED.map((item) => (
                    <span
                      key={item}
                      className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                LAYER 03
              </span>
              <h3 className="text-base font-semibold">AI化效果</h3>
            </div>
            <div className="flex items-center justify-between gap-1">
              {EFFECT_FLOW.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex flex-1 items-center gap-1">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                    {i < EFFECT_FLOW.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {EFFECT_METRICS.map((m) => (
                <span key={m} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {m}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
