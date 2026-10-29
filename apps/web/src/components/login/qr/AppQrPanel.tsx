// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'

import { fetchApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { resolvePostLoginLanding } from '@/lib/post-login-landing'
import { requestWallboardChoice } from '../WallboardChoiceDialog'
import { QR_PANEL_STATE_BOX } from './WechatQrPanel'

interface AppQrPanelProps {
  /** 父组件传入,变化时重新生成二维码 */
  refreshKey: number
  /**
   * 访客已同意用户协议与隐私政策(由扫码面板的协议弹窗采集)。
   * 必须随 /qr/generate 写进后端扫码会话 —— 后端只在会话已同意时才允许
   * /qr/confirm 签发 token、/qr/status 交付 token。未同意时不出码。
   */
  agreementAccepted: boolean
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
/**
 * 状态轮询的瞬失容忍帧数。服务端 /qr/status 限流与轮询频率贴近(2s = 30 次/分钟),
 * 一次 429 / 代理抖动并不代表这张码废了 —— 原实现把任何一次失败当终态,直接停轮并把
 * 一张名义还有效 300s 的二维码判死。连续这么多帧都取不到才进 error 态。
 */
const STATUS_POLL_FAIL_TOLERANCE = 3
// 2026-10-27:外框改 300×300 正方形后同步放大(原 184 在正方形框里显得过小、四周空太多)
const QR_SIZE = 220

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
export function AppQrPanel({ refreshKey, agreementAccepted }: AppQrPanelProps) {
  const t = useTranslations('auth')
  const qc = useQueryClient()
  const setToken = useAuthStore((s) => s.setToken)
  const setUser = useAuthStore((s) => s.setUser)
  const closeDialog = useLoginDialogStore((s) => s.close)

  const [status, setStatus] = React.useState<QrStatus>('loading')
  const [qrContent, setQrContent] = React.useState('')
  const [errorMsg, setErrorMsg] = React.useState('')
  // 本地刷新计数:expired / error 态点击"重试"时自增,触发 effect 重新生成
  const [localRefresh, setLocalRefresh] = React.useState(0)

  React.useEffect(() => {
    // 未同意协议不出码:即使调用方绕过协议弹窗直接挂载本面板,也不让后端拿到可被确认的会话。
    if (!agreementAccepted) return

    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    setStatus('loading')
    setQrContent('')
    setErrorMsg('')

    async function generateAndPoll() {
      try {
        // 2026-09-18 修复 App 扫码不出码:此接口原先无业务 body,但 fetchApi 无 body 的 POST
        // 不带 Content-Type,经生产代理链路到达 Fastify 5 时被判为不支持媒体类型 → 415,
        // 面板进入 error 态不渲染二维码。带 JSON body 使请求携带 application/json 头。
        // 2026-10-27:body 必须带 agreementAccepted —— 后端把它写入扫码会话,
        // 未同意的会话在 /qr/confirm 与 /qr/status 都会被拒。
        const genRes = await fetchApi<QrGenerateData>('/api/auth/qr/generate', {
          method: 'POST',
          body: JSON.stringify({ agreementAccepted: true }),
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

        const stopPolling = () => {
          if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
          }
        }
        // 连续瞬失帧数(见 STATUS_POLL_FAIL_TOLERANCE 头注)
        let pollFails = 0

        const poll = async () => {
          try {
            const res = await fetchApi<QrStatusData>(
              `/api/auth/qr/status?ticket=${encodeURIComponent(ticket)}`,
            )
            if (cancelled) return

            if (!res.success) {
              pollFails += 1
              if (pollFails < STATUS_POLL_FAIL_TOLERANCE) return
              stopPolling()
              setErrorMsg(res.error)
              setStatus('error')
              return
            }
            pollFails = 0

            const data = res.data
            if (data.status === 'confirmed') {
              stopPolling()
              if (data.accessToken && data.refreshToken) {
                setToken(data.accessToken, data.refreshToken)
                qc.invalidateQueries({ queryKey: ['header'] })
                qc.invalidateQueries({ queryKey: ['announcements'] })
                // 扫码接口只回 token(不带 roleId),补拉一次身份供落点判据使用;
                // 取不到时按当前身份(通常为 null,非 admin)判定,保留"仅关弹窗"的既有行为。
                try {
                  const me = await fetchApi<{ user: unknown }>('/auth/me')
                  if (!cancelled && me.success && me.data?.user) setUser(me.data.user as never)
                } catch {
                  // 身份补拉失败不影响登录完成
                }
              }
              const landing = resolvePostLoginLanding(useAuthStore.getState().user)
              setStatus('confirmed')
              window.setTimeout(() => {
                if (cancelled) return
                closeDialog()
                // 2026-10-18(用户要求"让我自己选择"):不再自动跳大屏,交给常驻
                // WallboardChoiceDialog 二选一(「看大屏」/「先不用」);选择窗挂在
                // LoginDialog(常驻根布局)里,不随本面板因登录弹窗 close() 卸载而丢失。
                if (landing) requestWallboardChoice(landing)
              }, SUCCESS_CLOSE_DELAY_MS)
            } else if (data.status === 'expired') {
              stopPolling()
              setStatus('expired')
            }
            // status === 'pending' → 继续轮询
          } catch {
            // 忽略轮询错误,下次重试
          }
        }

        poll()
        pollTimer = setInterval(poll, POLL_INTERVAL_MS)
      } catch {
        if (!cancelled) {
          setErrorMsg('二维码生成失败,请重试')
          setStatus('error')
        }
      }
    }

    generateAndPoll()

    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [refreshKey, localRefresh, agreementAccepted, setToken, setUser, qc, closeDialog])

  const handleRetry = React.useCallback(() => {
    setLocalRefresh((n) => n + 1)
  }, [])

  // ---- 渲染 ----

  if (status === 'loading') {
    return (
      <div className={QR_PANEL_STATE_BOX}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'confirmed') {
    return (
      <div className={`${QR_PANEL_STATE_BOX} gap-2`}>
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-sm text-muted-foreground">{t('loginSuccess')}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={`ui-card ${QR_PANEL_STATE_BOX} gap-2 border-destructive/30 bg-destructive/5`}>
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{t('appQrFailed')}</p>
        {errorMsg && <p className="text-xs text-muted-foreground">{errorMsg}</p>}
        <button
          type="button"
          onClick={handleRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
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
    <div className={`${QR_PANEL_STATE_BOX} gap-3`}>
      <div
        className={`relative rounded-lg border border-border bg-popover p-3${isExpired ? ' opacity-30' : ''}`}
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
          className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
