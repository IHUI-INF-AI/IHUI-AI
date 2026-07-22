'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getPlatformConfig } from '@/lib/third-party-config'
import { generateState, saveOAuthState } from '@/lib/oauth-utils'
import { loadWechatQrSdk } from './sdk-loader'

interface WechatQrPanelProps {
  /** 父组件传入,变化时重新生成二维码 */
  refreshKey: number
}

export function WechatQrPanel({ refreshKey }: WechatQrPanelProps) {
  const t = useTranslations('auth')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  const [errorMsg, setErrorMsg] = React.useState('')

  React.useEffect(() => {
    const container = containerRef.current
    const config = getPlatformConfig('wechat')
    if (!config.enabled || !config.appId) {
      setStatus('unconfigured')
      return
    }

    let cancelled = false
    setStatus('loading')

    const state = generateState()
    saveOAuthState('wechat', state)

    // redirect_uri 必须与当前访问域名+端口一致,否则微信开放平台校验失败报"redirect_uri 参数错误"
    // 不读 env 死值(env 配的端口可能与实际 dev server 端口不符,如 3000 vs 3001)
    const redirectUri = `${window.location.origin}/callback?platform=wechat`

    loadWechatQrSdk()
      .then(() => {
        if (cancelled || !window.WxLogin || !container) return
        container.innerHTML = ''
        try {
          new window.WxLogin({
            self_redirect: false,
            id: containerId,
            appid: config.appId!,
            scope: 'snsapi_login',
            redirect_uri: redirectUri,
            state,
            style: 'black',
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
      if (container) container.innerHTML = ''
    }
  }, [containerId, refreshKey])

  if (status === 'unconfigured') {
    return <UnconfiguredState platform={t('wechatLogin')} />
  }

  if (status === 'error') {
    return <ErrorState message={errorMsg} />
  }

  // React 18 严格模式 + 第三方 SDK DOM 操作冲突修复(2026-07-22):
  // 旧实现把 <Loader2> 作为容器子节点,SDK 用 container.innerHTML='' 清空时把 React 的子节点也清了,
  // React cleanup 试图 removeChild 时节点已不存在 → "Failed to execute 'removeChild' on 'Node'"
  // 修复:SDK 挂载点(sdkContainerRef)与 React 子节点(Loader2)分层渲染,互不干扰
  return (
    <div className="relative flex h-[280px] w-full items-center justify-center overflow-hidden rounded-md border bg-card">
      <div ref={containerRef} id={containerId} className="absolute inset-0" />
      {status === 'loading' && (
        <Loader2 className="relative h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

export function UnconfiguredState({ platform }: { platform: string }) {
  const t = useTranslations('auth')
  return (
    <div className="flex h-[280px] w-full flex-col items-center justify-center gap-2 rounded-md border bg-muted/30 px-4 text-center">
      <p className="text-sm text-muted-foreground">
        {t('qrNotConfigured', { platform })}
      </p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  const t = useTranslations('auth')
  return (
    <div className="flex h-[280px] w-full flex-col items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 text-center">
      <p className="text-sm text-destructive">{t('qrSdkLoadFailed')}</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
