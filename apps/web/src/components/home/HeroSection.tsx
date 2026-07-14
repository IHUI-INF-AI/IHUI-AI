import Link from 'next/link'
import { Button } from '@ihui/ui'
import { ArrowRight, Sparkles } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 to-muted">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3 w-3" />
            全新 AI 驱动的智能平台
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            让 AI 成为你的
            <br />
            <span className="text-primary">超级助手</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            一站式 AI 平台,集成智能对话、内容创作、数据分析,助力效率提升 10 倍
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                免费开始
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/about">了解更多</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
