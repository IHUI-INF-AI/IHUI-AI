// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * Cloudflare Turnstile 人机验证 Widget（显式渲染版，2026-11-28 重写）
 *
 * 为什么放弃隐式渲染（<div class="cf-turnstile"> + SDK 全页扫描）:
 * 1) 落点不可控 —— 隐式模式只是「把 iframe 画进容器」，容器本身落在文档流的哪个位置由页面结构
 *    决定。/sso/login 的 children 根节点是 position:fixed 的 AuthShellPage（全屏遮罩），它脱离
 *    文档流；于是 LoginWithTurnstile 里排在 children 之后的 widget 变成「容器内唯一的在流内
 *    元素」，被顶到页面最顶端、遮罩后面 —— 用户实测的「弹窗后右上角孤零零一个 CF 验证窗」。
 * 2) 时机不可控 —— 隐式扫描只在 api.js 载入那一刻跑一遍。组件晚于脚本挂载时（弹窗二次打开、
 *    路由切换、WebView2 命中缓存）可能永远画不出来，也可能把上一轮 iframe 留在原地。
 *
 * 显式渲染把这两件事都钉死:画在哪个节点由 containerRef 决定（React 生命周期说了算），
 * 卸载时 turnstile.remove(widgetId) 精确回收，页面上不会再有孤儿 iframe。
 *
 * siteKey 来源:props.siteKey > NEXT_PUBLIC_TURNSTILE_SITE_KEY。未配置时不渲染（自动跳过验证）。
 */

import * as React from 'react'
import Script from 'next/script'

export interface TurnstileWidgetProps {
  /** 验证通过回调，接收 Turnstile token */
  onVerify: (token: string) => void
  /** 验证出错回调 */
  onError?: (error: string) => void
  /** token 过期回调 */
  onExpire?: () => void
  /** 容器额外 className */
  className?: string
  /** 自定义 siteKey，未传则读 NEXT_PUBLIC_TURNSTILE_SITE_KEY */
  siteKey?: string
  /**
   * 外部重置信号（2026-11-28 增）：值每变化一次，就对已渲染的 widget 调 SDK `reset()`。
   *
   * 为什么需要:Turnstile token 是**一次性票据** —— 前端每把它发给一个会做 siteverify 的端点
   * （登录三端点、发码闸），Cloudflare 就把它核销掉；同一枚 token 再发第二次，siteverify 返回
   * `timeout-or-duplicate`，用户看到的是「人机验证失败,请重试」，而他明明刚验证过。
   * 上游表单在「token 已出手」的那次请求结束后发一次重置信号，widget 原地重挑战并回调新 token，
   * 下一轮提交才有票可用。
   */
  resetSignal?: number
}

/* -------------------------------------------------------------------------- */
/* Cloudflare Turnstile 全局 API（最小类型面，不引 any）                        */
/* -------------------------------------------------------------------------- */

interface TurnstileRenderOptions {
  sitekey: string
  theme?: 'auto' | 'light' | 'dark'
  size?: 'normal' | 'compact' | 'flexible'
  language?: string
  retry?: 'auto' | 'never'
  callback?: (token: string) => void
  'error-callback'?: (errorCode?: string) => void
  'expired-callback'?: () => void
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string
  remove: (widgetId: string) => void
  reset: (widgetId: string) => void
}

type TurnstileHost = Window & { turnstile?: Partial<TurnstileApi> }

function readTurnstileApi(): TurnstileApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as TurnstileHost).turnstile
  if (!api || typeof api.render !== 'function' || typeof api.remove !== 'function') return null
  return api as TurnstileApi
}

/* -------------------------------------------------------------------------- */
/* 组件                                                                        */
/* -------------------------------------------------------------------------- */

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className,
  siteKey: siteKeyProp,
  resetSignal,
}: TurnstileWidgetProps): React.ReactElement | null {
  const siteKey = siteKeyProp ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const widgetIdRef = React.useRef<string | null>(null)
  // api.js 是否就绪（window.turnstile 可用）
  const [sdkReady, setSdkReady] = React.useState(false)
  // api.js 加载失败标记（网络不可达 / challenges.cloudflare.com 被拦截）
  const [loadError, setLoadError] = React.useState(false)

  // 用 ref 保持最新回调，避免回调引用变化触发 widget 重渲染
  const verifyRef = React.useRef(onVerify)
  const errorRef = React.useRef(onError)
  const expireRef = React.useRef(onExpire)
  verifyRef.current = onVerify
  errorRef.current = onError
  expireRef.current = onExpire

  /** 精确回收:先 remove(widgetId) 再清空容器。两步都容错（SDK 已自行回收时 remove 是 no-op） */
  const teardown = React.useCallback((): void => {
    const api = readTurnstileApi()
    const widgetId = widgetIdRef.current
    widgetIdRef.current = null
    if (api && widgetId) {
      try {
        api.remove(widgetId)
      } catch {
        /* SDK 已回收 / 容器已随页面树销毁:忽略 */
      }
    }
    const host = containerRef.current
    if (host) host.replaceChildren()
  }, [])

  /** 显式渲染:只往 containerRef 指向的节点里画，不触发任何全页扫描 */
  const mount = React.useCallback((): void => {
    const api = readTurnstileApi()
    const host = containerRef.current
    if (!api || !host || !siteKey) return
    // StrictMode 双挂载 / 上一轮残留:已渲染过就复用，不重复 render
    if (widgetIdRef.current) return
    try {
      host.replaceChildren()
      widgetIdRef.current = api.render(host, {
        sitekey: siteKey,
        theme: 'auto',
        size: 'normal',
        retry: 'auto',
        callback: (token: string) => verifyRef.current(token),
        'error-callback': () => errorRef.current?.('turnstile-error'),
        'expired-callback': () => expireRef.current?.(),
      })
    } catch {
      // 同容器被 SDK 标记为已渲染（竞态）/ iframe 被浏览器拦下
      errorRef.current?.('turnstile-render-failed')
    }
  }, [siteKey])

  // api.js 可能在本组件挂载前就已加载完成（同页多个 widget / WebView 内二次进入）:
  // 先认现成的 window.turnstile，onReady 只作补位。
  React.useEffect(() => {
    if (!siteKey) return
    if (readTurnstileApi()) setSdkReady(true)
  }, [siteKey])

  React.useEffect(() => {
    if (!siteKey || !sdkReady) return
    mount()
    return teardown
  }, [siteKey, sdkReady, mount, teardown])

  // 外部重置:token 已被服务端核销后，由上游表单发信号让 widget 原地重挑战。
  // 只对"值发生变化"生效（首挂载不回放，避免把刚拿到的 token 白扔）；没渲染出 widget 时静默跳过，
  // 等 mount 完成自然拿到新 token。
  const lastResetSignalRef = React.useRef(resetSignal)
  React.useEffect(() => {
    if (resetSignal === undefined) return
    if (resetSignal === lastResetSignalRef.current) return
    lastResetSignalRef.current = resetSignal
    const api = readTurnstileApi()
    const widgetId = widgetIdRef.current
    if (!api || !widgetId) return
    try {
      api.reset(widgetId)
    } catch {
      // SDK 已回收 / iframe 已卸载:交给下一次 mount，不把错误弹给用户
    }
  }, [resetSignal])

  if (!siteKey) return null

  const containerClass = ['cf-turnstile', className].filter(Boolean).join(' ')

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        async
        defer
        onReady={() => {
          if (readTurnstileApi()) setSdkReady(true)
        }}
        onError={() => setLoadError(true)}
      />
      {loadError ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-label leading-relaxed text-amber-700"
          role="alert"
        >
          人机验证组件加载失败（多为网络无法访问验证服务）。请检查网络后刷新页面重试；若仍失败，可改用登录弹窗中的「在浏览器中登录」按钮（走系统浏览器，不依赖本窗口的验证环境）。
        </div>
      ) : (
        <div className="flex w-full justify-center">
          <div ref={containerRef} className={containerClass} data-testid="turnstile-container" />
        </div>
      )}
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
