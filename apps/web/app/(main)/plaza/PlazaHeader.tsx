'use client'

import { Circle, HelpCircle, LayoutGrid } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/lib/utils'
import type { Tab } from './types'

interface Props {
  tab: Tab
  setTab: (t: Tab) => void
  circlesTotal?: number
  asksTotal?: number
}

export function PlazaHeader({ tab, setTab, circlesTotal, asksTotal }: Props) {
  const t = useTranslations('plaza')
  return (
    <>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <LayoutGrid className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <div className="flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        <button
          onClick={() => setTab('circles')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'circles'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Circle className="h-4 w-4" />
          {t('circlesTab')}
          {circlesTotal !== undefined && (
            <span className="text-xs text-muted-foreground">{circlesTotal}</span>
          )}
        </button>
        <button
          onClick={() => setTab('asks')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
            tab === 'asks'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <HelpCircle className="h-4 w-4" />
          {t('asksTab')}
          {asksTotal !== undefined && (
            <span className="text-xs text-muted-foreground">{asksTotal}</span>
          )}
        </button>
      </div>
    </>
  )
}
