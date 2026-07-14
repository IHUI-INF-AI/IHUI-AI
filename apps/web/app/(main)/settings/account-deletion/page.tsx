'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Send } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'
import { Alert } from '@/components/feedback'
import { Container } from '@/components/layout'
import { Switch, Input } from '@/components/form'

export default function AccountDeletionPage() {
  const t = useTranslations('settings')
  const [confirmed, setConfirmed] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [sending, setSending] = React.useState(false)

  const handleSendCode = () => {
    setSending(true)
    setTimeout(() => setSending(false), 2000)
  }

  return (
    <Container maxWidth="md" padding={false} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('accountDeletionTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('accountDeletionDesc')}</p>
      </div>

      <Alert variant="warning" title={t('accountDeletionWarning')} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            {t('accountDeletionConfirm')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('accountDeletionConfirm')}</span>
            <Switch checked={confirmed} onChange={setConfirmed} />
          </div>

          <div className="space-y-2">
            <Input
              label={t('accountDeletionCodeLabel')}
              placeholder={t('accountDeletionCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button variant="outline" size="sm" onClick={handleSendCode} disabled={sending}>
              <Send className="h-4 w-4" />
              {t('accountDeletionSendCode')}
            </Button>
          </div>

          <Button variant="destructive" className="w-full" disabled={!confirmed || !code}>
            {t('accountDeletionSubmit')}
          </Button>
        </CardContent>
      </Card>
    </Container>
  )
}
