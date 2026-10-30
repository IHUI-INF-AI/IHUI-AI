// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { getPlatformConfig } from '@/lib/third-party-config'
import { generateState, saveOAuthState } from '@/lib/oauth-utils'
import { loadFeishuQrSdk, type FeishuQrInstance } from './sdk-loader'
import { UnconfiguredState, ErrorState, QR_PANEL_BOX } from './WechatQrPanel'

interface FeishuQrPanelProps {
  refreshKey: number
}

/** 扫码 iframe 的唯一合法来源;passport 之外的任何 frame/window 发来的"带 code 的 URL"一律丢弃 */
const FEISHU_PASSPORT_ORIGIN = 'https://passport.feishu.cn'

export function FeishuQrPanel({ refreshKey }: FeishuQrPanelProps) {
  const t = useTranslations('auth')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const qrRef = React.useRef<FeishuQrInstance | null>(null)
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error' | 'unconfigured'>(
    'loading',
  )
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

    // redirect_uri 优先读 env(生产配 bsm.aizhs.top 分域 SSO),env 留空时 fallback 到当前 origin(localhost dev)
    const redirectUri = config.redirectUri

    // 飞书 QRLogin SDK 通过 goto 参数指定完整 OAuth 授权 URL,
    // 扫码成功后 SDK 通过 postMessage 通知父窗口跳转(不会自动整页跳转)
    const gotoUrl = `https://passport.feishu.cn/suite/passport/oauth/authorize?${new URLSearchParams(
      {
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        state,
        scope: config.scope || 'contact:user.base:readonly',
      },
    ).toString()}`

    // 飞书 SDK 扫码成功后 postMessage 通知父窗口,不同版本消息格式可能不同:
    // { type: 'redirect', url: 'xxx' } / { proto: 'redirect', data: { redirect_uri: 'xxx' } } 等
    // 通用监听器:从消息中提取包含 code= 的 URL 并跳转
    const handleMessage = (event: MessageEvent) => {
      if (cancelled) return
      // 消息必须来自这张扫码 iframe 自己:frame-src 含 `https:` 通配,页面上任何第三方
      // iframe 都能 parent.postMessage({url:'…code=…'}) 把用户导航走(带假 code)。
      const frame = container?.querySelector('iframe') ?? null
      if (event.source !== (frame as HTMLIFrameElement | null)?.contentWindow) return
      if (event.origin !== FEISHU_PASSPORT_ORIGIN) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      const url: unknown =
        data.url ?? data.redirect_uri ?? data.data?.url ?? data.data?.redirect_uri
      if (typeof url === 'string' && (url.includes('code=') || url.includes('state='))) {
        try {
          const u = new URL(url, window.location.origin)
          // 只接受回本源的落点:否则一条消息就成了开放重定向,把带 code 的 URL 整条送给外站。
          if (u.searchParams.get('code') && u.origin === window.location.origin) {
            window.location.href = u.toString()
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
            // 2026-10-27:与外框 QR_PANEL_BOX 同为 300×300 正方形
            // (原 280×260 非正方形,且 style 里又写成 260×260,与 width/height 参数自相矛盾)
            width: '300',
            height: '300',
            style: 'width:300px;height:300px;border:none;',
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
    <div className={QR_PANEL_BOX}>
      <div ref={containerRef} id={containerId} className="absolute inset-0" />
      {status === 'loading' && (
        <Loader2 className="relative h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
