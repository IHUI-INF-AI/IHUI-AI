'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, XCircle, ScanLine } from 'lucide-react'

import { Button, Card } from '@ihui/ui'

type ConfirmState = 'idle' | 'submitting' | 'success' | 'error'

export default function QrConfirmPage() {
  const t = useTranslations('auth')
  const params = useSearchParams()
  const ticket = params.get('ticket') ?? ''

  const [state, setState] = React.useState<ConfirmState>('idle')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  const onConfirm = async () => {
    if (!ticket) {
      setState('error')
      setErrorMsg(t('qrConfirmInvalid'))
      return
    }
    setState('submitting')
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/auth/qr/confirm?ticket=${encodeURIComponent(ticket)}`, {
        method: 'POST',
      })
      const json = (await res.json()) as { code: number; message?: string }
      if (!res.ok || json.code !== 0) {
        setState('error')
        setErrorMsg(json.message || t('qrConfirmInvalid'))
        return
      }
      setState('success')
    } catch {
      setState('error')
      setErrorMsg(t('qrConfirmInvalid'))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ScanLine className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold">{t('qrConfirmTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('qrConfirmPrompt')}</p>

          {state === 'success' && (
            <div className="flex flex-col items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-4 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
              <p className="text-sm">{t('qrConfirmSuccess')}</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive">
              <XCircle className="h-8 w-8" />
              <p className="text-sm">{errorMsg ?? t('qrConfirmInvalid')}</p>
            </div>
          )}

          {state !== 'success' && (
            <Button
              type="button"
              className="h-10 w-full"
              onClick={onConfirm}
              disabled={state === 'submitting' || !ticket}
            >
              {state === 'submitting' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {state === 'submitting' ? t('qrConfirming') : t('qrConfirmBtn')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
