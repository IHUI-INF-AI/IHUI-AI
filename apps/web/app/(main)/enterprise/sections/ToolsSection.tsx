'use client'

import {
  FileText,
  Image,
  Mic,
  Video,
  Factory,
  GraduationCap,
  Stethoscope,
  Building2,
  Headphones,
  Settings,
  Lightbulb,
  Briefcase,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Card, CardContent } from '@ihui/ui-react'

interface ToolItem {
  icon: React.ComponentType<{ className?: string }>
  labelKey: string
}

const CATEGORIES: { titleKey: string; items: ToolItem[] }[] = [
  {
    titleKey: 'general',
    items: [
      { icon: FileText, labelKey: 'textGeneration' },
      { icon: Image, labelKey: 'imageGeneration' },
      { icon: Mic, labelKey: 'voiceProcessing' },
      { icon: Video, labelKey: 'videoGeneration' },
    ],
  },
  {
    titleKey: 'industry',
    items: [
      { icon: Factory, labelKey: 'manufacturing' },
      { icon: GraduationCap, labelKey: 'education' },
      { icon: Stethoscope, labelKey: 'healthcare' },
      { icon: Building2, labelKey: 'government' },
    ],
  },
  {
    titleKey: 'function',
    items: [
      { icon: Headphones, labelKey: 'marketingService' },
      { icon: Settings, labelKey: 'productionManufacturing' },
      { icon: Lightbulb, labelKey: 'rdInnovation' },
      { icon: Briefcase, labelKey: 'officeCollaboration' },
    ],
  },
]

const PARTNERS = [
  '火山引擎',
  '阿里云',
  '腾讯云',
  '九章智算云',
  '致远互联',
  'OpenAI',
  '百度智能云',
  '华为云',
]

export function ToolsSection() {
  const t = useTranslations('enterpriseTools')

  return (
    <section className="space-y-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t('sectionLabel')}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <Card key={cat.titleKey}>
            <CardContent className="space-y-3 p-5">
              <h3 className="text-sm font-semibold tracking-tight">
                {t(`categories.${cat.titleKey}`)}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {cat.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <div
                      key={item.labelKey}
                      className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{t(`items.${item.labelKey}`)}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="mb-3 text-sm font-semibold tracking-tight">{t('partnersTitle')}</h3>
          <div className="flex flex-wrap gap-2">
            {PARTNERS.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {name[0]}
                </span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
