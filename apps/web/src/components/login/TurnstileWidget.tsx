'use client'

/**
 * Cloudflare Turnstile 人机验证 Widget。
 *
 * 使用隐式渲染模式:
 * 1. next/script 动态加载 Turnstile JS SDK(api.js)
 * 2. 渲染 <div class="cf-turnstile" data-sitekey data-callback ... />
 * 3. Turnstile SDK 自动扫描 .cf-turnstile div 并渲染验证 widget
 * 4. data-callback 属性值为全局函数名,SDK 验证通过后调用 window[name](token)
 *
 * 回调注入:用 React.useId() 生成唯一函数名,在 useEffect 中挂到 window,
 * 卸载时清理,避免全局污染 + 多实例冲突。
 *
 * siteKey 来源:props.siteKey > NEXT_PUBLIC_TURNSTILE_SITE_KEY。
 * 未配置 siteKey 时不渲染(自动跳过验证)。
 */

import * as React from 'react'
import Script from 'next/script'

export interface TurnstileWidgetProps {
  /** 验证通过回调,接收 Turnstile token */
  onVerify: (token: string) => void
  /** 验证出错回调 */
  onError?: (error: string) => void
  /** token 过期回调 */
  onExpire?: () => void
  /** 容器额外 className */
  className?: string
  /** 自定义 siteKey,未传则读 NEXT_PUBLIC_TURNSTILE_SITE_KEY */
  siteKey?: string
}

/* -------------------------------------------------------------------------- */
/* 全局回调注册(类型安全,无 any)                                               */
/* -------------------------------------------------------------------------- */

type GlobalCallbackStore = Record<string, ((...args: unknown[]) => void) | undefined>

function setGlobalCallback(name: string, fn: (...args: unknown[]) => void): void {
  ;(window as unknown as GlobalCallbackStore)[name] = fn
}

function deleteGlobalCallback(name: string): void {
  delete (window as unknown as GlobalCallbackStore)[name]
}

/* -------------------------------------------------------------------------- */
/* 组件                                                                         */
/* -------------------------------------------------------------------------- */

export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  className,
  siteKey: siteKeyProp,
}: TurnstileWidgetProps): React.ReactElement | null {
  const envSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const siteKey = siteKeyProp ?? envSiteKey

  // 生成唯一回调函数名(React.useId 保证 SSR/CSR 一致 + 多实例不冲突)
  const rawId = React.useId()
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '')
  const verifyName = `tsVerify${id}`
  const errorName = `tsError${id}`
  const expireName = `tsExpire${id}`

  // 用 ref 保持最新回调,避免 effect 频繁重注册
  const verifyRef = React.useRef(onVerify)
  const errorRef = React.useRef(onError)
  const expireRef = React.useRef(onExpire)
  verifyRef.current = onVerify
  errorRef.current = onError
  expireRef.current = onExpire

  React.useEffect(() => {
    setGlobalCallback(verifyName, (token: unknown) => {
      verifyRef.current(token as string)
    })
    setGlobalCallback(errorName, () => {
      errorRef.current?.('turnstile-error')
    })
    setGlobalCallback(expireName, () => {
      expireRef.current?.()
    })
    return () => {
      deleteGlobalCallback(verifyName)
      deleteGlobalCallback(errorName)
      deleteGlobalCallback(expireName)
    }
  }, [verifyName, errorName, expireName])

  // 未配置 siteKey 时不渲染(自动跳过验证)
  if (!siteKey) return null

  // 不设 min-h:SDK 未加载/不可见模式时 div 高度 0 不占空间,
  // SDK 接管后由 Cloudflare widget 自适应高度(约 65px)
  const containerClass = ['cf-turnstile', className].filter(Boolean).join(' ')

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        async
        defer
      />
      <div
        className={containerClass}
        data-sitekey={siteKey}
        data-callback={verifyName}
        data-error-callback={errorName}
        data-expired-callback={expireName}
      />
    </>
  )
}
