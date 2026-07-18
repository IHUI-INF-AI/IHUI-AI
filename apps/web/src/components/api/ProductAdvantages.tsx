'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface Advantage {
  icon?: React.ReactNode
  title: string
  desc: string
}

export interface ProductAdvantagesProps {
  advantages?: Advantage[]
  className?: string
}

const DEFAULT_ADVANTAGES: Advantage[] = [
  { title: '高可用', desc: '99.99% SLA 保障，多地域部署' },
  { title: '低延迟', desc: '全球加速，毫秒级响应' },
  { title: '易接入', desc: 'RESTful 风格，多语言 SDK' },
  { title: '安全合规', desc: '通过等保三级认证' },
]

export default function ProductAdvantages({
  advantages = DEFAULT_ADVANTAGES,
  className,
}: ProductAdvantagesProps): React.JSX.Element {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {advantages.map((a, i) => (
        <div key={i} className="rounded-xl border bg-card p-5 text-card-foreground shadow">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {a.icon ?? <span className="text-base font-bold">{i + 1}</span>}
          </div>
          <h3 className="text-sm font-semibold">{a.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
        </div>
      ))}
    </div>
  )
}
