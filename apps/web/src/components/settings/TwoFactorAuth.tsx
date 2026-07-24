'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { ShieldCheck, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui-react'
import { fetchApi } from '@/lib/api'
import { useClipboard } from '@/hooks/use-clipboard'
import { generateTotp } from './totp'

interface TwoFactorStatus {
  enabled: boolean
}

interface SetupData {
  secret: string
  qrCodeUrl: string
  backupCodes: string[]
}

type Step = 'status' | 'qr' | 'verify' | 'backup'

export function TwoFactorAuth() {
  const t = useTranslations('settings')
  const [step, setStep] = React.useState<Step>('status')
  const [enabled, setEnabled] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [setup, setSetup] = React.useState<SetupData | null>(null)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const { copied, copy } = useClipboard()
  const [previewCode, setPreviewCode] = React.useState('')

  React.useEffect(() => {
    let active = true
    fetchApi<TwoFactorStatus>('/api/auth/2fa/status')
      .then((res) => {
        if (active && res.success && res.data) setEnabled(res.data.enabled)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    if (step !== 'qr' || !setup) return
    let active = true
    const gen = async () => {
      try {
        const c = await generateTotp(setup.secret)
        if (active) setPreviewCode(c)
      } catch {
        /* ignore */
      }
    }
    void gen()
    const timer = setInterval(gen, 5000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [step, setup])

  const startSetup = async () => {
    setSubmitting(true)
    try {
      const res = await fetchApi<SetupData>('/api/auth/2fa/setup', { method: 'POST' })
      if (!res.success) {
        toast.error(res.error || t('twofa.codeInvalid'))
        return
      }
      if (res.data) {
        setSetup(res.data)
        setStep('qr')
      }
    } catch {
      toast.error(t('twofa.codeInvalid'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async () => {
    setError(null)
    if (code.length !== 6) {
      setError(t('twofa.codeInvalid'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetchApi<{ backupCodes: string[] }>('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (!res.success) {
        setError(res.error || t('twofa.codeInvalid'))
        return
      }
      if (res.data?.backupCodes)
        setSetup((prev) => (prev ? { ...prev, backupCodes: res.data!.backupCodes } : prev))
      setStep('backup')
    } catch {
      setError(t('twofa.codeInvalid'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable = async () => {
    setSubmitting(true)
    try {
      const res = await fetchApi('/api/auth/2fa/disable', { method: 'POST' })
      if (!res.success) {
        toast.error(res.error || t('twofa.codeInvalid'))
        return
      }
      setEnabled(false)
      setStep('status')
    } catch {
      toast.error(t('twofa.codeInvalid'))
    } finally {
      setSubmitting(false)
    }
  }

  const copySecret = () => {
    if (setup?.secret) {
      void copy(setup.secret)
    }
  }

  const copyCodes = () => {
    if (setup?.backupCodes.length) {
      void copy(setup.backupCodes.join('\n'))
      toast.success(t('twofa.codesCopied'))
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          {t('twofa.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'status' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-2.5 w-2.5 rounded-sm ${enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
              />
              <span className="text-sm">{enabled ? t('twofa.enabled') : t('twofa.disabled')}</span>
            </div>
            {enabled ? (
              <Button variant="outline" size="sm" disabled={submitting} onClick={handleDisable}>
                {t('twofa.disable')}
              </Button>
            ) : (
              <Button size="sm" disabled={submitting} onClick={startSetup}>
                {t('twofa.enable')}
              </Button>
            )}
          </div>
        )}

        {step === 'qr' && setup && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('twofa.scanQR')}</p>
            <div className="flex justify-center">
              <Image
                src={setup.qrCodeUrl}
                alt="2FA QR"
                width={160}
                height={160}
                unoptimized
                className="h-40 w-40 rounded-lg border"
              />
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
              <span className="font-mono break-all">{setup.secret}</span>
              <Button variant="ghost" size="sm" onClick={copySecret} className="shrink-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {previewCode && (
              <p className="text-center text-xs text-muted-foreground">
                {t('twofa.previewCode')}:{' '}
                <code className="font-mono font-bold text-primary">{previewCode}</code>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="tfa-code">{t('twofa.enterCode')}</Label>
              <Input
                id="tfa-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              className="w-full"
              disabled={submitting || code.length !== 6}
              onClick={handleVerify}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('twofa.verify')}
            </Button>
          </div>
        )}

        {step === 'backup' && setup && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('twofa.backupDesc')}</p>
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
              {setup.backupCodes.map((c) => (
                <code key={c} className="font-mono text-sm">
                  {c}
                </code>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyCodes}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                {t('twofa.copyCodes')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEnabled(true)
                  setStep('status')
                  setCode('')
                }}
              >
                {t('twofa.done')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
