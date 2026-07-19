'use client'

import * as React from 'react'
import { Crown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MembershipBenefit {
  title: string
  desc?: string
  included?: boolean
}

export interface UserMembershipBenefitsProps {
  level?: string
  benefits?: MembershipBenefit[]
  className?: string
}

const DEFAULT_BENEFITS: MembershipBenefit[] = [
  { title: '专属客服', desc: '优先响应', included: true },
  { title: '无限对话', desc: '不限次数', included: true },
  { title: '高级模型', desc: 'GPT-4 等可选', included: true },
  { title: '专属内容', desc: '会员专享', included: false },
]

export default function UserMembershipBenefits({
  level = '普通会员',
  benefits = DEFAULT_BENEFITS,
  className,
}: UserMembershipBenefitsProps): React.JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card shadow', className)}>
      <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-amber-500/5 px-4 py-3">
        <Crown className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-medium">{level}权益</h3>
      </div>
      <ul className="divide-y">
        {benefits.map((b) => (
          <li key={b.title} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-md',
                b.included ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
              )}
            >
              <Check className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{b.title}</div>
              {b.desc && <div className="text-xs text-muted-foreground">{b.desc}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
