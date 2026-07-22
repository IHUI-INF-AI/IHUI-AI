'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getPlatformConfig } from '@/lib/third-party-config'
import { generateState, saveOAuthState } from '@/lib/oauth-utils'
import { loadWecomQrSdk, type WecomLoginInstance } from './sdk-loader'
import { UnconfiguredState, ErrorState } from './WechatQrPanel'

interface WecomQrPanelProps {
  refreshKey: number
}

export function WecomQrPanel({ refreshKey }: WecomQrPanelProps) {
  const t = useTranslations('auth')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const instanceRef = React.useRef<WecomLoginInstance | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  const [errorMsg, setErrorMsg] = React.useState('')

  React.useEffect(() => {
    const container = containerRef.current
    const config = getPlatformConfig('enterpriseWechat')
    if (!config.enabled || !config.appId || !config.agentId || !config.redirectUri) {
      setStatus('unconfigured')
      return
    }

    let cancelled = false
    setStatus('loading')

    const state = generateState()
    saveOAuthState('enterpriseWechat', state)

    loadWecomQrSdk()
      .then(() => {
        if (cancelled || !window.WwLogin || !container) return
        container.innerHTML = ''
        try {
          // 企业微信 wwLogin-1.2.7.js API:new WwLogin(options)
          // SDK 内部创建 iframe 指向 https://open.work.weixin.qq.com/wwopen/sso/qrConnect?...
          // 扫码成功后通过 postMessage 通知父窗口,SDK 自动整页跳转到 redirect_uri
          instanceRef.current = new window.WwLogin({
            id: containerId,
            appid: config.appId!,
            agentid: config.agentId!,
            redirect_uri: config.redirectUri,
            state,
            lang: 'zh',
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
      try {
        instanceRef.current?.destroyed?.()
      } catch {
        /* ignore */
      }
      instanceRef.current = null
      if (container) container.innerHTML = ''
    }
  }, [containerId, refreshKey])

  if (status === 'unconfigured') {
    return <UnconfiguredState platform={t('enterpriseWechat')} />
  }

  if (status === 'error') {
    return <ErrorState message={errorMsg} />
  }

  return (
    <div
      ref={containerRef}
      id={containerId}
      className="flex h-[280px] w-full items-center justify-center overflow-hidden rounded-md border bg-card"
    >
      {status === 'loading' && (
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
