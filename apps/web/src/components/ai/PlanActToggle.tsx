'use client'

import * as React from 'react'
import { ClipboardList, Zap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export interface PlanActToggleProps {
  mode: 'plan' | 'act'
  onModeChange: (mode: 'plan' | 'act') => void
  className?: string
}

type Mode = 'plan' | 'act'

interface ModeOption {
  mode: Mode
  labelKey: string
  fallbackLabel: string
  icon: React.ComponentType<{ className?: string }>
}

const OPTIONS: readonly ModeOption[] = [
  { mode: 'plan', labelKey: 'ai.panel.modePlan', fallbackLabel: '规划', icon: ClipboardList },
  { mode: 'act', labelKey: 'ai.panel.modeAct', fallbackLabel: '执行', icon: Zap },
]

export function PlanActToggle({ mode, onModeChange, className }: PlanActToggleProps) {
  const t = useTranslations()
  return (
    <div
      role="group"
      aria-label="plan act 模式切换"
      className={cn('inline-flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5', className)}
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.mode === mode
        const Icon = opt.icon
        const translated = t(opt.labelKey)
        const text = translated === opt.labelKey ? opt.fallbackLabel : translated
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => onModeChange(opt.mode)}
            aria-pressed={isActive}
            title={text}
            className={cn(
              'flex h-6 items-center gap-1 rounded px-2 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{text}</span>
          </button>
        )
      })}
    </div>
  )
}

export default PlanActToggle
