'use client'

import { Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'

interface Props {
  t: (k: string) => string
  mounted: boolean
  theme: string | undefined
  onSelect: (key: 'light' | 'dark' | 'system') => void
}

const THEMES = [
  { key: 'light' as const, icon: Sun, labelKey: 'themeLight' },
  { key: 'dark' as const, icon: Moon, labelKey: 'themeDark' },
  { key: 'system' as const, icon: Monitor, labelKey: 'themeSystem' },
]

export function ThemeCard({ t, mounted, theme, onSelect }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sun className="h-4 w-4" />
          {t('theme')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((item) => {
            const Icon = item.icon
            const active = mounted && theme === item.key
            return (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors',
                  active
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.labelKey)}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
