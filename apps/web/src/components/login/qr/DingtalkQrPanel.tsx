'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { getPlatformConfig } from '@/lib/third-party-config'
import { generateState, saveOAuthState } from '@/lib/oauth-utils'
import { loadDingtalkQrSdk, type DingtalkFrameInstance } from './sdk-loader'
import { UnconfiguredState, ErrorState } from './WechatQrPanel'

interface DingtalkQrPanelProps {
  refreshKey: number
}

export function DingtalkQrPanel({ refreshKey }: DingtalkQrPanelProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const frameRef = React.useRef<DingtalkFrameInstance | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error' | 'unconfigured'>('loading')
  const [errorMsg, setErrorMsg] = React.useState('')

  React.useEffect(() => {
    const container = containerRef.current
    const config = getPlatformConfig('dingtalk')
    const clientId = config.clientId || config.appId
    if (!config.enabled || !clientId || !config.redirectUri) {
      setStatus('unconfigured')
      return
    }

    let cancelled = false
    setStatus('loading')

    const state = generateState()
    saveOAuthState('dingtalk', state)

    // 钉钉 OAuth2 授权 URL(DTFrameLogin 通过 iframe 内嵌此 URL 显示扫码二维码)
    const gotoUrl = `https://login.dingtalk.com/oauth2/auth?${new URLSearchParams({
      redirect_uri: config.redirectUri,
      response_type: 'code',
      client_id: clientId,
      scope: config.scope || 'openid',
      state,
      prompt: 'consent',
    }).toString()}`

    loadDingtalkQrSdk()
      .then(() => {
        if (cancelled || !window.DTFrameLogin || !container) return
        container.innerHTML = ''
        try {
          frameRef.current = new window.DTFrameLogin(
            {
              id: containerId,
              width: 280,
              height: 280,
              goto: gotoUrl,
              style: 'border:none;background:transparent;',
            },
            (loginResult) => {
              if (cancelled) return
              // 钉钉 SDK 通过 postMessage 把 authCode 传给父页面,
              // 不需要整页跳转,直接路由到 /callback?platform=dingtalk&code=xxx&state=xxx
              const { authCode, state: returnedState } = loginResult
              const cbUrl = `/callback?platform=dingtalk&code=${encodeURIComponent(authCode)}&state=${encodeURIComponent(returnedState)}`
              router.push(cbUrl)
            },
            (errMsg) => {
              if (cancelled) return
              setErrorMsg(errMsg)
              setStatus('error')
            },
          )
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
        frameRef.current?.destroy?.()
      } catch {
        /* ignore */
      }
      frameRef.current = null
      if (container) container.innerHTML = ''
    }
  }, [containerId, refreshKey, router])

  if (status === 'unconfigured') {
    return <UnconfiguredState platform={t('dingtalkLogin')} />
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
