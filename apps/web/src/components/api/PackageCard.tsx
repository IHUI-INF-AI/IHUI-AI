'use client'

import * as React from 'react'
import { Check, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PackageFeature {
  text: string
  included?: boolean
}

export interface PackageItem {
  id: string
  name: string
  price: number | string
  unit?: string
  desc?: string
  features?: PackageFeature[]
  popular?: boolean
}

export interface PackageCardProps {
  pkg?: PackageItem
  onBuy?: (id: string) => void
  className?: string
}

const DEFAULT_PKG: PackageItem = {
  id: 'pro',
  name: '专业版',
  price: 99,
  unit: '/月',
  desc: '适合个人开发者',
  popular: true,
  features: [
    { text: '100万次调用/月', included: true },
    { text: '100 QPS', included: true },
    { text: '技术支持', included: true },
    { text: 'SLA 保障', included: false },
  ],
}

export default function PackageCard({
  pkg = DEFAULT_PKG,
  onBuy,
  className,
}: PackageCardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-card p-5 text-card-foreground shadow',
        pkg.popular && 'border-primary shadow-md',
        className,
      )}
    >
      {pkg.popular && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          <Crown className="mr-1 inline h-3 w-3" />
          热门
        </span>
      )}
      <h3 className="text-base font-semibold">{pkg.name}</h3>
      {pkg.desc && <p className="mt-0.5 text-xs text-muted-foreground">{pkg.desc}</p>}
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-bold">¥{pkg.price}</span>
        {pkg.unit && <span className="text-xs text-muted-foreground">{pkg.unit}</span>}
      </div>
      <ul className="mt-4 flex-1 space-y-2">
        {(pkg.features ?? []).map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded-full',
                f.included !== false
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground/40',
              )}
            >
              <Check className="h-3 w-3" />
            </span>
            <span className={cn(f.included === false && 'text-muted-foreground line-through')}>
              {f.text}
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onBuy?.(pkg.id)}
        className={cn(
          'mt-5 w-full rounded-md px-4 py-2 text-sm transition-colors',
          pkg.popular
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'border hover:bg-muted',
        )}
      >
        立即购买
      </button>
    </div>
  )
}
