'use client'

import * as React from 'react'
import { Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'

interface AppQrPanelProps {
  /** 父组件传入,变化时重新生成二维码 */
  refreshKey: number
}

type QrStatus = 'loading' | 'pending' | 'confirmed' | 'expired' | 'error'

interface QrGenerateData {
  ticket: string
  qrContent: string
  expiresAt: string
}

interface QrStatusData {
  status: 'pending' | 'confirmed' | 'expired'
  accessToken?: string
  refreshToken?: string
  userId?: string
}

const POLL_INTERVAL_MS = 2000
const SUCCESS_CLOSE_DELAY_MS = 800
const QR_SIZE = 200

/**
 * 本站 App 扫码登录面板。
 *
 * 流程:
 * 1. POST /api/auth/qr/generate → 获取 { ticket, qrContent, expiresAt }
 * 2. QRCodeSVG 渲染 qrContent(ticket 字符串)为二维码
 * 3. 每 2s GET /api/auth/qr/status?ticket=xxx 轮询:
 *    - pending → 继续轮询
 *    - confirmed → setToken + invalidateQueries + 关闭弹窗
 *    - expired → 显示"已过期",提供刷新按钮
 */
export function AppQrPanel({ refreshKey }: AppQrPanelProps) {
  const t = useTranslations('auth')
  const qc = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  const closeDialog = useLoginDialogStore((s) => s.close)

  const [status, setStatus] = React.useState<QrStatus>('loading')
  const [qrContent, setQrContent] = React.useState('')
  const [errorMsg, setErrorMsg] = React.useState('')
  // 本地刷新计数:expired / error 态点击"重试"时自增,触发 effect 重新生成
  const [localRefresh, setLocalRefresh] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    setStatus('loading')
    setQrContent('')
    setErrorMsg('')

    async function generateAndPoll() {
      const genRes = await fetchApi<QrGenerateData>('/api/auth/qr/generate', {
        method: 'POST',
      })
      if (cancelled) return

      if (!genRes.success) {
        setErrorMsg(genRes.error)
        setStatus('error')
        return
      }

      const { ticket, qrContent: content, expiresAt } = genRes.data
      if (cancelled) return

      // 轮询前先检查是否已过期
      if (new Date(expiresAt).getTime() <= Date.now()) {
        setStatus('expired')
        return
      }

      setQrContent(content)
      setStatus('pending')

      const poll = async () => {
        const res = await fetchApi<QrStatusData>(
          `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
        )
        if (cancelled) return

        if (!res.success) {
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
          setErrorMsg(res.error)
          setStatus('error')
          return
        }

        const data = res.data
        if (data.status === 'confirmed') {
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
          if (data.accessToken && data.refreshToken) {
            setToken(data.accessToken, data.refreshToken)
            qc.invalidateQueries({ queryKey: ['header'] })
            qc.invalidateQueries({ queryKey: ['announcements'] })
          }
          setStatus('confirmed')
          window.setTimeout(() => {
            if (!cancelled) closeDialog()
          }, SUCCESS_CLOSE_DELAY_MS)
        } else if (data.status === 'expired') {
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
          setStatus('expired')
        }
        // status === 'pending' → 继续轮询
      }

      poll()
      pollTimer = setInterval(poll, POLL_INTERVAL_MS)
    }

    generateAndPoll()

    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [refreshKey, localRefresh, setToken, qc, closeDialog])

  const handleRetry = React.useCallback(() => {
    setLocalRefresh((n) => n + 1)
  }, [])

  // ---- 渲染 ----

  if (status === 'loading') {
    return (
      <div className="mx-auto flex h-[280px] w-full max-w-[280px] items-center justify-center rounded-md border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'confirmed') {
    return (
      <div className="mx-auto flex h-[280px] w-full max-w-[280px] flex-col items-center justify-center gap-2 rounded-md border bg-card">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-sm text-muted-foreground">{t('loginSuccess')}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto flex h-[280px] w-full max-w-[280px] flex-col items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 text-center">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{t('appQrFailed')}</p>
        {errorMsg && <p className="text-xs text-muted-foreground">{errorMsg}</p>}
        <button
          type="button"
          onClick={handleRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('appQrRetry')}
        </button>
      </div>
    )
  }

  // status === 'pending' | 'expired' → 渲染二维码
  const isExpired = status === 'expired'
  return (
    <div className="mx-auto flex h-[280px] w-full max-w-[280px] flex-col items-center justify-center gap-3 rounded-md border bg-card px-4">
      <div
        className={`relative rounded-lg border border-border bg-white p-3${isExpired ? ' opacity-30' : ''}`}
      >
        {qrContent && <QRCodeSVG value={qrContent} size={QR_SIZE} level="M" />}
        {isExpired && (
          <div className="absolute inset-0 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
        )}
      </div>
      {isExpired ? (
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t('appQrExpired')}
        </button>
      ) : (
        <p className="text-sm text-muted-foreground">{t('appQrWaiting')}</p>
      )}
    </div>
  )
}
