// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 扫码面板外框统一尺寸(2026-10-27 修正)。
 *
 * 旧值 `h-[260px] w-full max-w-[280px]`(280×260)有两个硬伤:
 *  1. **不是 1:1 正方形** —— 宽高写死成两个互不相干的数,永远凑不出正方形;
 *  2. **必然裁掉二维码** —— 微信 wxLogin.js / 企微 wwLogin-1.2.7.js 生成的 iframe
 *     尺寸在 SDK 里写死为 `width=300px height=400px`(已抓源码验证),塞进 280×260
 *     的框 + `overflow-hidden`,横向被 max-w-full 压窄、纵向被裁掉 140px。
 *
 * 现用 `aspect-square` 强制 1:1,边长默认 300(与 SDK iframe 原生宽度对齐,不缩放、
 * 不模糊),窄屏由 w-full 自适应为「可用宽 × 可用宽」。
 *
 * 为什么 300 高就够(iframe 明明是 400 高):iframe 内二维码经 /qr-styles/*.css
 * 强制垂直居中,上下各留 60px 空白;容器只要 ≥ 二维码边长,裁掉的就是空白不是码。
 * 尺寸关系与推导见 `public/qr-styles/wecom-qr.css` 头部注释。
 */
export const QR_PANEL_BOX =
  'relative mx-auto flex aspect-square w-full max-w-[300px] items-center justify-center overflow-hidden rounded-xl border bg-card shadow-sm'

/**
 * 状态态外框(未配置 / 加载 / 成功 / 失败):与 QR_PANEL_BOX 同尺寸 1:1,内容纵向排列。
 * 不含 gap —— 调用方按需自带 gap-2 / gap-3,避免同一元素上两个 gap-* 互相打架。
 */
export const QR_PANEL_STATE_BOX =
  'mx-auto flex aspect-square w-full max-w-[300px] flex-col items-center justify-center rounded-xl border bg-card px-4 text-center shadow-sm'

export function WechatQrPanel({ refreshKey }: WechatQrPanelProps) {
  const t = useTranslations('auth')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const containerId = React.useId().replace(/[:]/g, '')
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error' | 'unconfigured'>(
    'loading',
  )
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

    // redirect_uri 优先读 env(生产配 bsm.aizhs.top 分域 SSO),env 留空时 fallback 到当前 origin(localhost dev)
    // 微信开放平台"授权回调域"只接受一个域名,必须与 redirect_uri 域名完全一致
    const redirectUri = config.redirectUri

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
            // 2026-07-25 隐藏 SDK 默认顶部"微信登录"标题 + 底部提示,二维码居中
            // SDK 会把 href 指向的 CSS 通过 <link> 注入到跨域 iframe 内部
            href: `${window.location.origin}/qr-styles/wechat-qr.css`,
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
    <div className={QR_PANEL_BOX}>
      <div
        ref={containerRef}
        id={containerId}
        className="absolute inset-0 flex items-center justify-center [&_iframe]:block [&_iframe]:mx-auto [&_iframe]:static [&_iframe]:max-w-full"
      />
      {status === 'loading' && (
        <Loader2 className="relative h-6 w-6 animate-spin text-muted-foreground" />
      )}
    </div>
  )
}

export function UnconfiguredState({ platform }: { platform: string }) {
  const t = useTranslations('auth')
  return (
    <div className={`${QR_PANEL_STATE_BOX} gap-2 bg-muted/30`}>
      <p className="text-sm text-muted-foreground">{t('qrNotConfigured', { platform })}</p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  const t = useTranslations('auth')
  return (
    <div className={`${QR_PANEL_STATE_BOX} gap-2 border-destructive/30 bg-destructive/5`}>
      <p className="text-sm text-destructive">{t('qrSdkLoadFailed')}</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
