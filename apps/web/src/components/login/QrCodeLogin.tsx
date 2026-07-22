'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Check } from 'lucide-react'

import { Button } from '@ihui/ui'
import { useAuthStore } from '@/stores/auth'
import { loadLocalLoginPrefs, saveLocalLoginPrefs } from '@/lib/login-preferences'

type QrStatus = 'pending' | 'scanned' | 'confirming' | 'success' | 'failed' | 'expired'

type QrData = { qrCodeUrl: string; ticket: string }

type StatusResp = {
  status: QrStatus
  token?: string
  message?: string
}

/**
 * 二维码登录：从后端获取二维码 → 轮询扫码状态 → 成功写入 token 跳转。
 */
export function QrCodeLogin({ onSwitchMethod }: { onSwitchMethod?: () => void }) {
  const t = useTranslations('auth')
  const router = useRouter()
  const setToken = useAuthStore((s) => s.setToken)

  const [qr, setQr] = React.useState<QrData | null>(null)
  const [status, setStatus] = React.useState<QrStatus>('pending')
  const [loading, setLoading] = React.useState(true)
  const [countdown, setCountdown] = React.useState(120)
  const [autoLogin, setAutoLogin] = React.useState(loadLocalLoginPrefs().autoLogin)

  const generate = React.useCallback(async () => {
    setLoading(true)
    setStatus('pending')
    setCountdown(120)
    try {
      const res = await fetch('/api/auth/qr/generate')
      const json = (await res.json()) as { code: number; data?: QrData }
      if (res.ok && json.code === 0 && json.data) setQr(json.data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void generate()
  }, [generate])

  // 倒计时
  React.useEffect(() => {
    if (countdown <= 0) {
      setStatus('expired')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // 状态轮询
  React.useEffect(() => {
    if (!qr || status === 'success' || status === 'expired') return
    let active = true
    const poll = async () => {
      try {
        const res = await fetch(`/api/auth/qr/status?ticket=${encodeURIComponent(qr.ticket)}`)
        const json = (await res.json()) as { code: number; data?: StatusResp }
        if (!active) return
        const st = json.data?.status
        if (st) {
          setStatus(st)
          if (st === 'success' && json.data?.token) {
            setToken(json.data.token)
            router.push('/')
          }
        }
      } catch {
        /* ignore */
      }
    }
    const timer = setInterval(poll, 2000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [qr, status, setToken, router])

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0')
  const ss = String(countdown % 60).padStart(2, '0')

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative">
        {loading ? (
          <div className="flex h-[160px] w-[160px] items-center justify-center rounded-lg border">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="relative h-[160px] w-[160px] overflow-hidden rounded-lg border">
            {qr?.qrCodeUrl ? (
              <Image src={qr.qrCodeUrl} alt="QR" fill unoptimized className="object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t('qrLoadFailed')}
              </div>
            )}
            {(status === 'scanned' || status === 'confirming') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
                <CheckCircle2 className="h-8 w-8" />
                <span className="mt-1 text-xs">
                  {status === 'confirming' ? t('qrConfirming') : t('qrScanned')}
                </span>
              </div>
            )}
            {(status === 'expired' || status === 'failed') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 text-white">
                <XCircle className="h-8 w-8" />
                <span className="text-xs">
                  {status === 'expired' ? t('qrExpired') : t('loginFailed')}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={generate}
                  className="mt-1"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  {t('qrRefresh')}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {status === 'pending' && <Clock className="h-4 w-4" />}
          {status === 'pending' && <span>{t('qrScanTip', { time: `${mm}:${ss}` })}</span>}
          {status === 'scanned' && <span className="text-emerald-600">{t('qrScanned')}</span>}
          {status === 'confirming' && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        <MiniCheckbox
          checked={autoLogin}
          onChange={(v) => {
            setAutoLogin(v)
            saveLocalLoginPrefs({ autoLogin: v })
          }}
          label={t('autoLogin')}
        />
      </div>

      {onSwitchMethod && (
        <Button type="button" variant="link" size="sm" onClick={onSwitchMethod}>
          {t('qrSwitchMethod')}
        </Button>
      )}
    </div>
  )
}

function MiniCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="group flex cursor-pointer items-center gap-2 select-none">
      <span
        onClick={(e) => { e.preventDefault(); onChange(!checked) }}
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background group-hover:border-foreground/60',
        ].join(' ')}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked) } }}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <input type="checkbox" className="sr-only" tabIndex={-1} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-xs leading-5 text-muted-foreground">{label}</span>
    </label>
  )
}
