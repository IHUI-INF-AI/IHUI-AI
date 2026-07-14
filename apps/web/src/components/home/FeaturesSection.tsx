import { Sparkles, Users, BookOpen, MessageSquare } from 'lucide-react'

const FEATURES = [
  { icon: Sparkles, title: 'AI 智能创作', desc: '一键生成文章、图片、视频,释放创意潜能' },
  { icon: Users, title: '团队协作', desc: '实时共享与协同编辑,团队效率倍增' },
  { icon: BookOpen, title: '在线学习', desc: '海量课程资源,AI 辅助个性化学习路径' },
  { icon: MessageSquare, title: '智能对话', desc: '多模型支持,精准理解你的需求' },
]

export function FeaturesSection() {
  return (
    <section className="py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">核心功能</h2>
          <p className="mt-4 text-muted-foreground">全方位覆盖你的 AI 使用场景</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-6 transition-colors hover:bg-accent"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
