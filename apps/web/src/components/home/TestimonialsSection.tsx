import { Card, CardContent } from '@ihui/ui'

const TESTIMONIALS = [
  {
    name: '张明',
    company: '科技初创公司 CEO',
    avatar: '张',
    text: '使用 IHUI-AI 后,团队内容产出效率提升了 5 倍,AI 辅助创作质量远超预期。',
  },
  {
    name: '李华',
    company: '高校教师',
    avatar: '李',
    text: '在线教学模块非常完善,学生反馈积极,AI 答疑功能极大减轻了我的工作负担。',
  },
  {
    name: '王芳',
    company: '产品经理',
    avatar: '王',
    text: '从需求分析到原型设计,整个流程都被 AI 优化了。强烈推荐给所有产品团队。',
  },
]

export function TestimonialsSection() {
  return (
    <section className="py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">用户评价</h2>
          <p className="mt-4 text-muted-foreground">来自各行业用户的真实反馈</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="transition-colors hover:bg-accent">
              <CardContent className="p-6">
                <p className="text-sm leading-relaxed text-foreground/90">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {t.avatar}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.company}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
