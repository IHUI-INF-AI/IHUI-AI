'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getPlatformConfig } from '@/lib/third-party-config'
import { generateState, saveOAuthState } from '@/lib/oauth-utils'
import { loadWecomQrSdk, type WecomLoginPanelInstance } from './sdk-loader'
import { UnconfiguredState, ErrorState } from './WechatQrPanel'

interface WecomQrPanelProps {
  refreshKey: number
}

export function WecomQrPanel({ refreshKey }: WecomQrPanelProps) {
  const t = useTranslations('auth')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const panelRef = React.useRef<WecomLoginPanelInstance | null>(null)
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
        if (cancelled || !window.ww?.createWWLoginPanel || !container) return
        container.innerHTML = ''
        try {
          panelRef.current = window.ww.createWWLoginPanel({
            el: `#${containerId}`,
            params: {
              login_type: 'CorpApp',
              appid: config.appId!,
              agentid: config.agentId!,
              redirect_uri: config.redirectUri,
              state,
              redirect_type: 'top',
              lang: 'zh',
            },
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
        panelRef.current?.destroy?.()
      } catch {
        /* ignore */
      }
      panelRef.current = null
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
