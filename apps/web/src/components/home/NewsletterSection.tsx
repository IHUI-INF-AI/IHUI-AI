'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import { Button, Input } from '@ihui/ui'

export function NewsletterSection() {
  const [email, setEmail] = React.useState('')
  const [submitted, setSubmitted] = React.useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setSubmitted(true)
    setEmail('')
  }

  return (
    <section className="py-20">
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight">订阅最新动态</h2>
          <p className="mt-2 text-sm text-muted-foreground">获取产品更新、AI 技巧与独家优惠</p>
          {submitted ? (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-600">
              <Check className="h-4 w-4" />
              订阅成功,感谢关注!
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                placeholder="输入你的邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="sm:w-auto">
                立即订阅
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
