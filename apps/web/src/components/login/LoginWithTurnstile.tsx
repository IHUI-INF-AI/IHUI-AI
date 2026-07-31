'use client'

/**
 * 登录表单 + Cloudflare Turnstile 人机验证包装器。
 *
 * - 未配置 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 时:直接渲染 children(向后兼容,无副作用)。
 * - 配置后:在 children 下方渲染 TurnstileWidget,并通过 capture 阶段拦截表单提交,
 *   未通过人机验证时阻止提交并 toast 提示。
 *
 * 深层表单可通过 `useTurnstile()` 读取 token,将验证 token 附带到登录请求。
 */

import * as React from 'react'
import { toast } from 'sonner'
import { TurnstileWidget } from './TurnstileWidget'

/* -------------------------------------------------------------------------- */
/* Turnstile Context                                                           */
/* -------------------------------------------------------------------------- */

interface TurnstileContextValue {
  /** Turnstile token,null = 未验证,string = 已验证 */
  token: string | null
  /** 是否已通过人机验证 */
  verified: boolean
}

const TurnstileContext = React.createContext<TurnstileContextValue>({
  token: null,
  verified: false,
})

/**
 * 读取当前 Turnstile 验证状态,供深层表单提交按钮拿到 token。
 * - `token` 为 null 表示未验证,表单提交应被拦截。
 * - `token` 为 string 表示已验证,可将 token 附带到登录请求体。
 */
export function useTurnstile(): TurnstileContextValue {
  return React.useContext(TurnstileContext)
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

export interface LoginWithTurnstileProps {
  /** 原始登录表单 */
  children: React.ReactNode
  /** Turnstile 验证通过回调,接收 token */
  onTurnstileVerified?: (token: string) => void
  /** Turnstile token 过期回调 */
  onTurnstileExpired?: () => void
  /** Turnstile 验证出错回调 */
  onTurnstileError?: (error: string) => void
}

/* -------------------------------------------------------------------------- */
/* 启用态 Shell(独立组件,避免主组件 early return 违反 hooks 规则)             */
/* -------------------------------------------------------------------------- */

interface TurnstileEnabledShellProps {
  children: React.ReactNode
  onTurnstileVerified?: (token: string) => void
  onTurnstileExpired?: () => void
  onTurnstileError?: (error: string) => void
}

function TurnstileEnabledShell({
  children,
  onTurnstileVerified,
  onTurnstileExpired,
  onTurnstileError,
}: TurnstileEnabledShellProps): React.ReactElement {
  const [token, setToken] = React.useState<string | null>(null)
  // SDK 加载失败标记(网络问题/api.js 不可达时,降级放行不阻塞登录)
  const [sdkFailed, setSdkFailed] = React.useState(false)

  // ref 保持最新回调,避免 widget 因回调引用变化重渲染
  const verifiedCbRef = React.useRef(onTurnstileVerified)
  const expiredCbRef = React.useRef(onTurnstileExpired)
  const errorCbRef = React.useRef(onTurnstileError)
  verifiedCbRef.current = onTurnstileVerified
  expiredCbRef.current = onTurnstileExpired
  errorCbRef.current = onTurnstileError

  const handleVerify = React.useCallback((tk: string): void => {
    setToken(tk)
    verifiedCbRef.current?.(tk)
  }, [])

  const handleExpire = React.useCallback((): void => {
    setToken(null)
    expiredCbRef.current?.()
  }, [])

  const handleError = React.useCallback((err: string): void => {
    setToken(null)
    setSdkFailed(true) // SDK/widget 错误 → 标记失败,降级放行后续提交
    errorCbRef.current?.(err)
  }, [])

  // 拦截子表单提交(capture 阶段优先于 form 自身 onSubmit):
  // 未验证 → preventDefault + stopPropagation + 提示
  // 降级:SDK 加载失败(网络问题/api.js 不可达)或 window.turnstile 不存在时放行
  const handleSubmitCapture = React.useCallback(
    (e: React.FormEvent): void => {
      if (sdkFailed) return
      if (typeof window !== 'undefined' && !(window as unknown as { turnstile?: unknown }).turnstile) return
      if (!token) {
        e.preventDefault()
        e.stopPropagation()
        toast.error('请先完成人机验证')
      }
    },
    [token],
  )

  const contextValue = React.useMemo<TurnstileContextValue>(
    () => ({ token, verified: Boolean(token) }),
    [token],
  )

  return (
    <TurnstileContext.Provider value={contextValue}>
      <div onSubmitCapture={handleSubmitCapture} className="space-y-4">
        {children}
        <TurnstileWidget
          onVerify={handleVerify}
          onExpire={handleExpire}
          onError={handleError}
        />
      </div>
    </TurnstileContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/* 主组件                                                                      */
/* -------------------------------------------------------------------------- */

export function LoginWithTurnstile({
  children,
  onTurnstileVerified,
  onTurnstileExpired,
  onTurnstileError,
}: LoginWithTurnstileProps): React.ReactElement {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // 未配置 siteKey → 向后兼容,直接渲染原始表单(不包裹额外结构)
  if (!siteKey) {
    return <>{children}</>
  }

  return (
    <TurnstileEnabledShell
      onTurnstileVerified={onTurnstileVerified}
      onTurnstileExpired={onTurnstileExpired}
      onTurnstileError={onTurnstileError}
    >
      {children}
    </TurnstileEnabledShell>
  )
}
