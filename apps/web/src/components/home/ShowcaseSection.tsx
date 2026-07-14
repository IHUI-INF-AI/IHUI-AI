import { Check } from 'lucide-react'

const HIGHLIGHTS = [
  '可视化拖拽编辑,零代码上手',
  '多模型并行调用,智能路由',
  '实时协作,变更自动同步',
  '一键发布,多端自适应',
]

export function ShowcaseSection() {
  return (
    <section className="bg-muted/30 py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              强大而易用的
              <br />
              AI 工作台
            </h2>
            <p className="mt-4 text-muted-foreground">
              集成对话、创作、分析于一体,可视化界面让你轻松驾驭 AI
              能力。无需编程,即可构建专属工作流。
            </p>
            <ul className="mt-6 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="aspect-video rounded-xl border bg-muted shadow-lg" />
        </div>
      </div>
    </section>
  )
}
