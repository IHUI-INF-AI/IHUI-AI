'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { GenerationTypeSelector } from '@/components/ai-generation/generation-type-selector'
import type { GenerationType } from '@/components/ai/types'

import { SUB_TABS } from './helpers'

interface Props {
  type: GenerationType
  setType: (v: GenerationType) => void
  currentMode: string
  onSubTabClick: (v: string) => void
}

export function AiGenerationHeader({ type, setType, currentMode, onSubTabClick }: Props) {
  const t = useTranslations('aiGeneration')
  const subTabs = SUB_TABS[type] ?? null

  return (
    <>
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <GenerationTypeSelector value={type} onChange={setType} />
          {subTabs && (
            <div className="flex flex-wrap gap-1.5">
              {subTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => onSubTabClick(tab.value)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    tab.value === currentMode
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
