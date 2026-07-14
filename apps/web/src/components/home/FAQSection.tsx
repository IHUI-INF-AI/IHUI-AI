'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const FAQS = [
  { q: '如何开始使用 IHUI-AI?', a: '注册账号后即可免费体验所有基础功能,无需信用卡。' },
  {
    q: '支持哪些 AI 模型?',
    a: '我们支持 GPT、Claude、通义千问、文心一言等主流模型,专业版用户可自由切换。',
  },
  { q: '数据安全性如何保障?', a: '采用企业级加密传输与存储,通过 SOC2 认证,数据完全归用户所有。' },
  { q: '可以随时取消订阅吗?', a: '可以,订阅可随时取消,取消后继续使用至当前计费周期结束。' },
  { q: '是否提供 API 接口?', a: '专业版及以上方案均提供完整的 API 接口,支持程序化调用。' },
  { q: '企业版支持定制吗?', a: '企业版支持专属模型部署、SSO 集成、定制开发等,请联系销售团队。' },
]

export function FAQSection() {
  const [openIdx, setOpenIdx] = React.useState<number | null>(0)

  return (
    <section className="py-20">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">常见问题</h2>
          <p className="mt-4 text-muted-foreground">还有疑问?随时联系我们</p>
        </div>
        <div className="mt-12 space-y-3">
          {FAQS.map((item, idx) => {
            const isOpen = openIdx === idx
            return (
              <div key={item.q} className="rounded-lg border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent"
                >
                  <span className="text-sm font-medium">{item.q}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
                {isOpen && <div className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
