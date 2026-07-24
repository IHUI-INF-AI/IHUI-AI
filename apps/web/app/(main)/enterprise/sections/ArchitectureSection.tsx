import {
  Building,
  Workflow,
  UserCheck,
  ArrowRight,
  UserPlus,
  UsersRound,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui-react'

interface PhysicalItem {
  title: string
  desc: string
}

const PHYSICAL_ICONS = [Building, Workflow, UserCheck]
const EFFECT_ICONS = [UserPlus, UsersRound, Sparkles]

export function ArchitectureSection() {
  const t = useTranslations('enterprise')
  const physicalItems = t.raw('architecture.physicalItems') as PhysicalItem[]
  const infoBasic = t.raw('architecture.infoBasic') as string[]
  const infoAdvanced = t.raw('architecture.infoAdvanced') as string[]
  const effectFlow = t.raw('architecture.effectFlow') as string[]
  const effectMetrics = t.raw('architecture.effectMetrics') as string[]

  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('architecture.label')}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">{t('architecture.title')}</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                LAYER 01
              </span>
              <h3 className="text-base font-semibold">{t('architecture.physicalTitle')}</h3>
            </div>
            <div className="space-y-3">
              {physicalItems.map((item, i) => {
                const Icon = PHYSICAL_ICONS[i] ?? Building
                return (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                LAYER 02
              </span>
              <h3 className="text-base font-semibold">{t('architecture.infoTitle')}</h3>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  {t('architecture.infoBasicLabel')}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {infoBasic.map((item) => (
                    <span key={item} className="rounded-md bg-muted px-2 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">
                  {t('architecture.infoAdvancedLabel')}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {infoAdvanced.map((item) => (
                    <span
                      key={item}
                      className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                LAYER 03
              </span>
              <h3 className="text-base font-semibold">{t('architecture.effectTitle')}</h3>
            </div>
            <div className="flex items-center justify-between gap-1">
              {effectFlow.map((label, i) => {
                const Icon = EFFECT_ICONS[i] ?? UserPlus
                return (
                  <div key={label} className="flex flex-1 items-center gap-1">
                    <div className="flex flex-col items-center gap-1 text-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-medium">{label}</span>
                    </div>
                    {i < effectFlow.length - 1 && (
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {effectMetrics.map((m) => (
                <span key={m} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                  {m}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
