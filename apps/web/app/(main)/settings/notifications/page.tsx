'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Mail, MessageSquare, Bell, Volume2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from '@ihui/ui'
import { Container } from '@/components/layout'
import { Switch } from '@/components/form'
import { useNotification } from '@/hooks/use-notification'

export default function NotificationsPage() {
  const t = useTranslations('settings')
  const { soundEnabled, setSoundEnabled } = useNotification()

  const [emailEnabled, setEmailEnabled] = React.useState(true)
  const [systemNotif, setSystemNotif] = React.useState(true)
  const [marketingEmail, setMarketingEmail] = React.useState(false)
  const [smsEnabled, setSmsEnabled] = React.useState(false)
  const [pushEnabled, setPushEnabled] = React.useState(true)

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('notificationsTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('notificationsDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            {t('emailNotif')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('emailNotifDesc')}</span>
            <Switch checked={emailEnabled} onChange={setEmailEnabled} />
          </div>
          {emailEnabled && (
            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('systemNotif')}</span>
                <Switch checked={systemNotif} onChange={setSystemNotif} size="sm" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">{t('marketingEmail')}</span>
                <Switch checked={marketingEmail} onChange={setMarketingEmail} size="sm" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            {t('smsNotif')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">{t('smsNotifDesc')}</span>
              <p className="font-mono text-xs text-muted-foreground">+86 138****8888</p>
            </div>
            <Switch checked={smsEnabled} onChange={setSmsEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            {t('pushNotif')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('pushNotifDesc')}</span>
            <Switch checked={pushEnabled} onChange={setPushEnabled} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Volume2 className="h-4 w-4" />
            {t('labels.notificationSound')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('desc.notificationSound')}</span>
            <Switch checked={soundEnabled} onChange={setSoundEnabled} />
          </div>
        </CardContent>
      </Card>
    </Container>
  )
}
