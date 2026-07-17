import {
  FileText,
  Image,
  Mic,
  Video,
  Factory,
  GraduationCap,
  Stethoscope,
  Building2,
  Headphones,
  Settings,
  Lightbulb,
  Briefcase,
} from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'

interface ToolItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
}

const CATEGORIES: { title: string; items: ToolItem[] }[] = [
  {
    title: '通用AI工具',
    items: [
      { icon: FileText, label: '文本生成' },
      { icon: Image, label: '图像生成' },
      { icon: Mic, label: '语音处理' },
      { icon: Video, label: '视频生成' },
    ],
  },
  {
    title: '行业智能体',
    items: [
      { icon: Factory, label: '制造业' },
      { icon: GraduationCap, label: '教育行业' },
      { icon: Stethoscope, label: '医疗健康' },
      { icon: Building2, label: '政务服务' },
    ],
  },
  {
    title: '职能智能体',
    items: [
      { icon: Headphones, label: '营销客服' },
      { icon: Settings, label: '生产制造' },
      { icon: Lightbulb, label: '研发创新' },
      { icon: Briefcase, label: '办公协作' },
    ],
  },
]

const PARTNERS = [
  '火山引擎',
  '阿里云',
  '腾讯云',
  '九章智算云',
  '致远互联',
  'OpenAI',
  '百度智能云',
  '华为云',
]

export function ToolsSection() {
  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        企业AI工具一览
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">从通用AI工具到行业专属智能体</h2>
        <p className="text-sm text-muted-foreground">全方位满足企业AI化需求</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <Card key={cat.title}>
            <CardContent className="space-y-3 p-5">
              <h3 className="text-sm font-semibold tracking-tight">{cat.title}</h3>
              <div className="grid grid-cols-2 gap-2">
                {cat.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{item.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold tracking-tight">生态合作伙伴</h3>
          <div className="flex flex-wrap gap-2">
            {PARTNERS.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {name[0]}
                </span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
