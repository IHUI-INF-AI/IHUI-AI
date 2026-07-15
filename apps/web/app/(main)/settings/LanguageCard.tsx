'use client'

import { Languages, Globe, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Props {
  t: (k: string) => string
  locale: string
  onSelect: (l: string) => void
}

const LOCALES = [
  { key: 'zh-CN', labelKey: 'langZh' },
  { key: 'en', labelKey: 'langEn' },
]

export function LanguageCard({ t, locale, onSelect }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-4 w-4" />
          {t('language')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {LOCALES.map((item) => {
            const active = locale === item.key
            return (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                className={cn(
                  'flex items-center justify-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Globe className="h-4 w-4" />
                {t(item.labelKey)}
                {active && <Check className="h-4 w-4" />}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
