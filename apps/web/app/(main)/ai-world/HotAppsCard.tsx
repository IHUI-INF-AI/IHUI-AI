'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button, Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'

interface Props {
  hotApps: Array<{ id: string; name: string; href: string }>
  onNavigate: (href: string) => void
}

export function HotAppsCard({ hotApps, onNavigate }: Props) {
  const t = useTranslations('common.aiWorld')
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t('hotApps')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {hotApps.map((app) => (
            <Button key={app.id} variant="secondary" size="sm" onClick={() => onNavigate(app.href)}>
              {app.name}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
