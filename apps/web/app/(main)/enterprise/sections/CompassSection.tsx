import { Zap, Brain, Layers, TrendingUp, Compass } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui'

interface Quadrant {
  tag: string
  title: string
  description: string
  examples: string[]
}

const QUADRANT_ICONS = [Zap, Brain, Layers, TrendingUp]
const QUADRANT_ADOPTION = [78, 45, 52, 60]

export function CompassSection() {
  const t = useTranslations('enterprise')
  const quadrants = t.raw('compass.quadrants') as Quadrant[]

  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('compass.label')}
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">{t('compass.title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t('compass.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quadrants.map((q, i) => {
          const Icon = QUADRANT_ICONS[i] ?? Zap
          const adoption = QUADRANT_ADOPTION[i] ?? 0
          return (
            <Card key={q.tag} className="transition-colors hover:bg-accent">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {q.tag}
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-semibold tracking-tight">{q.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{q.description}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {q.examples.map((ex) => (
                    <span key={ex} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {ex}
                    </span>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded-md bg-primary transition-all"
                      style={{ width: `${adoption}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('compass.adoptionLabel', { percent: adoption })}
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
