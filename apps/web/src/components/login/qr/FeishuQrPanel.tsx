'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getPlatformConfig } from '@/lib/third-party-config'
import { generateState, saveOAuthState } from '@/lib/oauth-utils'
import { loadFeishuQrSdk, type FeishuQrInstance } from './sdk-loader'
import { UnconfiguredState, ErrorState } from './WechatQrPanel'

interface FeishuQrPanelProps {
  refreshKey: number
}

export function FeishuQrPanel({ refreshKey }: FeishuQrPanelProps) {
  const t = useTranslations('auth')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const qrRef = React.useRef<FeishuQrInstance | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  const [errorMsg, setErrorMsg] = React.useState('')

  React.useEffect(() => {
    const container = containerRef.current
    const config = getPlatformConfig('feishu')
    const clientId = config.clientId || config.appId
    if (!config.enabled || !clientId) {
      setStatus('unconfigured')
      return
    }

    let cancelled = false
    setStatus('loading')

    const state = generateState()
    saveOAuthState('feishu', state)

    // redirect_uri 必须与当前访问域名+端口一致,否则飞书 OAuth 校验失败
    const redirectUri = `${window.location.origin}/callback?platform=feishu`

    // 飞书 QRLogin SDK 通过 goto 参数指定完整 OAuth 授权 URL,
    // 扫码成功后 SDK 通过 postMessage 通知父窗口跳转(不会自动整页跳转)
    const gotoUrl = `https://passport.feishu.cn/suite/passport/oauth/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: config.scope || 'contact:user.base:readonly',
    }).toString()}`

    // 飞书 SDK 扫码成功后 postMessage 通知父窗口,不同版本消息格式可能不同:
    // { type: 'redirect', url: 'xxx' } / { proto: 'redirect', data: { redirect_uri: 'xxx' } } 等
    // 通用监听器:从消息中提取包含 code= 的 URL 并跳转
    const handleMessage = (event: MessageEvent) => {
      if (cancelled) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      const url: unknown =
        data.url ?? data.redirect_uri ?? data.data?.url ?? data.data?.redirect_uri
      if (typeof url === 'string' && (url.includes('code=') || url.includes('state='))) {
        try {
          const u = new URL(url, window.location.origin)
          if (u.searchParams.get('code')) {
            window.location.href = url
          }
        } catch {
          /* ignore invalid url */
        }
      }
    }
    window.addEventListener('message', handleMessage)

    loadFeishuQrSdk()
      .then(() => {
        if (cancelled || !window.QRLogin || !container) return
        container.innerHTML = ''
        try {
          qrRef.current = new window.QRLogin({
            id: containerId,
            goto: gotoUrl,
            width: '280',
            height: '280',
            style: 'width:280px;height:280px;border:none;',
          })
          if (!cancelled) setStatus('ready')
        } catch (e) {
          if (cancelled) return
          const msg = e instanceof Error ? e.message : String(e)
          setErrorMsg(msg)
          setStatus('error')
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : String(e)
        setErrorMsg(msg)
        setStatus('error')
      })

    return () => {
      cancelled = true
      window.removeEventListener('message', handleMessage)
      try {
        qrRef.current?.destroy?.()
      } catch {
        /* ignore */
      }
      qrRef.current = null
      if (container) container.innerHTML = ''
    }
  }, [containerId, refreshKey])

  if (status === 'unconfigured') {
    return <UnconfiguredState platform={t('feishuLogin')} />
  }

  if (status === 'error') {
    return <ErrorState message={errorMsg} />
  }

  // React 18 严格模式 + 第三方 SDK DOM 操作冲突修复(2026-07-22)
  // 详见 WechatQrPanel.tsx 同名注释
  return (
    <div className="relative mx-auto flex h-[280px] w-full max-w-[280px] items-center justify-center overflow-hidden rounded-md border bg-card">
      <div ref={containerRef} id={containerId} className="absolute inset-0" />
      {status === 'loading' && (
        <Loader2 className="relative h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
