import Link from 'next/link'
import { Button } from '@ihui/ui'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">立即开启你的 AI 之旅</h2>
          <p className="mt-4 text-primary-foreground/80">注册即送免费额度,无需信用卡,随时取消</p>
          <div className="mt-8">
            <Button asChild size="lg" variant="secondary">
              <Link href="/register">
                免费注册
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
