import { getLocale, getTranslations } from 'next-intl/server'
import { Sparkles, Cpu, Zap } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ihui/ui-react'
import type { Model } from './types'

interface Props {
  list: Model[]
}

export async function ModelsGrid({ list }: Props) {
  const t = await getTranslations('models')
  const locale = await getLocale()

  const priceFmt = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
  const ctxFmt = new Intl.NumberFormat(locale, { notation: 'compact' })

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((m) => (
        <Card key={m.id} className="flex flex-col transition-colors hover:bg-accent">
          <CardHeader>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-xs text-muted-foreground">{t(`providers.${m.provider}`)}</span>
            </div>
            <CardTitle className="text-base">
              {m.name.startsWith('model.') ? t(m.name) : m.name}
            </CardTitle>
            <CardDescription>{m.description ? t(m.description) : ''}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto space-y-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5" />
                {t('contextLength')}
              </span>
              <span className="font-medium text-foreground">{ctxFmt.format(m.contextLength)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" />
                {t('price')}
              </span>
              <span className="font-medium text-foreground">
                {m.inputPrice === 0
                  ? t('free')
                  : `${priceFmt.format(m.inputPrice)}${t('perMillion')}`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {m.features.map((f) => (
                <span
                  key={f}
                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
