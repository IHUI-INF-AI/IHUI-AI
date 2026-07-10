'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck, Loader2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label } from '@ihui/ui'
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

/**
 * 双因素认证：TOTP 绑定 / 验证码校验 / 恢复码展示。
 * 后端负责生成 secret、QR、备份码与最终校验；前端含本地 TOTP 演示生成。
 */
export function TwoFactorAuth() {
  const t = useTranslations('settings')
  const [step, setStep] = React.useState<Step>('status')
  const [enabled, setEnabled] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [setup, setSetup] = React.useState<SetupData | null>(null)
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [previewCode, setPreviewCode] = React.useState('')

  React.useEffect(() => {
    void fetch('/api/auth/2fa/status')
      .then((r) => r.json())
      .then((j: { code: number; data?: TwoFactorStatus }) => {
        if (j.code === 0 && j.data) setEnabled(j.data.enabled)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 演示：本地生成当前 30s 窗口的 TOTP（便于无 authenticator 时测试）
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
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' })
      const json = (await res.json()) as { code: number; data?: SetupData }
      if (json.code === 0 && json.data) {
        setSetup(json.data)
        setStep('qr')
      }
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
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = (await res.json()) as { code: number; data?: { backupCodes: string[] }; message?: string }
      if (json.code !== 0) {
        setError(json.message || t('twofa.codeInvalid'))
        return
      }
      if (json.data?.backupCodes) setSetup((prev) => (prev ? { ...prev, backupCodes: json.data!.backupCodes } : prev))
      setStep('backup')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDisable = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/2fa/disable', { method: 'POST' })
      const json = (await res.json()) as { code: number }
      if (json.code === 0) {
        setEnabled(false)
        setStep('status')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const copySecret = () => {
    if (setup?.secret) {
      navigator.clipboard.writeText(setup.secret)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const copyCodes = () => {
    if (setup?.backupCodes.length) {
      navigator.clipboard.writeText(setup.backupCodes.join('\n'))
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
                className={`inline-flex h-2.5 w-2.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={setup.qrCodeUrl} alt="2FA QR" className="h-40 w-40 rounded-lg border" />
            </div>
            <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs">
              <span className="font-mono break-all">{setup.secret}</span>
              <Button variant="ghost" size="sm" onClick={copySecret} className="shrink-0">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {previewCode && (
              <p className="text-center text-xs text-muted-foreground">
                {t('twofa.previewCode')}: <code className="font-mono font-bold text-primary">{previewCode}</code>
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
            <Button className="w-full" disabled={submitting || code.length !== 6} onClick={handleVerify}>
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
