// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 外观设置页的通用控件(2026-11-15 立)。
 *
 * 三种形态覆盖全部设置项,避免每个卡片各画一套:
 *   - SectionCard:带图标/标题/说明的卡片外壳;
 *   - OptionGrid :2–5 档等宽按钮组(语义 = radiogroup,键盘可 Tab + Enter);
 *   - RangeField :带数值读数的滑杆(字号/宽度这类连续值);
 *   - ToggleField:说明 + Switch 的单行开关。
 *
 * 视觉沿用 ThemeCard/FoldPolicyCard 的既有口径(rounded-sm 边框 + 选中 primary 底),
 * 不引入第二套设置页样式。
 */

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, Switch } from '@ihui/ui-react'
import { cn } from '@/lib/utils'

export function SectionCard({
  icon: Icon,
  title,
  desc,
  children,
  testId,
}: {
  icon: LucideIcon
  title: string
  desc?: string
  children: React.ReactNode
  testId?: string
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="whitespace-nowrap">{title}</span>
        </CardTitle>
        {desc ? (
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">{desc}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export interface OptionItem<T extends string> {
  value: T
  label: string
  desc?: string
}

export function OptionGrid<T extends string>({
  value,
  options,
  onChange,
  columns = 3,
  ariaLabel,
  testIdPrefix,
}: {
  value: T
  options: readonly OptionItem<T>[]
  onChange: (value: T) => void
  columns?: 2 | 3 | 4 | 5
  ariaLabel: string
  testIdPrefix?: string
}) {
  const cols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 min-[640px]:grid-cols-4',
    5: 'grid-cols-2 min-[640px]:grid-cols-5',
  }[columns]

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-2', cols)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            data-testid={testIdPrefix ? `${testIdPrefix}-${option.value}` : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-sm border px-2 py-2.5 text-body transition-colors',
              active
                ? 'border-brand-accent-deep bg-primary/5 text-primary'
                : 'hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <span className="whitespace-nowrap font-medium">{option.label}</span>
            {option.desc ? (
              <span className="text-center text-[11px] leading-snug text-muted-foreground">
                {option.desc}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function RangeField({
  label,
  hint,
  value,
  min,
  max,
  step,
  valueText,
  onChange,
  testId,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  valueText: string
  onChange: (value: number) => void
  testId?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body font-medium">{label}</span>
        <span className="shrink-0 text-body tabular-nums text-muted-foreground">{valueText}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--color-primary)]"
      />
      {hint ? <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function ToggleField({
  label,
  hint,
  checked,
  onCheckedChange,
  testId,
}: {
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  testId?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3" data-testid={testId}>
      <div className="min-w-0 flex-1">
        <div className="text-body font-medium">{label}</div>
        {hint ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
