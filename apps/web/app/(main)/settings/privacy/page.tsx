'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Target, Sparkles } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui'
import { Container } from '@/components/layout'

export default function PrivacyPage() {
  const t = useTranslations('settings')
  const [dataVisible, setDataVisible] = React.useState(true)
  const [adTracking, setAdTracking] = React.useState(false)
  const [personalized, setPersonalized] = React.useState(true)

  const items = [
    {
      icon: Eye,
      title: t('dataVisibility'),
      desc: t('dataVisibilityDesc'),
      checked: dataVisible,
      onChange: setDataVisible,
    },
    {
      icon: Target,
      title: t('adTracking'),
      desc: t('adTrackingDesc'),
      checked: adTracking,
      onChange: setAdTracking,
    },
    {
      icon: Sparkles,
      title: t('personalizedRecommendation'),
      desc: t('personalizedRecommendationDesc'),
      checked: personalized,
      onChange: setPersonalized,
    },
  ]

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('privacyTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('privacyDesc')}</p>
      </div>

      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{item.desc}</span>
                <Switch checked={item.checked} onCheckedChange={item.onChange} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </Container>
  )
}
