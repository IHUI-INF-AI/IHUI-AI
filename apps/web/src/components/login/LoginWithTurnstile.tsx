// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 登录表单 + Cloudflare Turnstile 人机验证包装器。
 *
 * - 未配置 `NEXT_PUBLIC_TURNSTILE_SITE_KEY` 时:直接渲染 children（向后兼容，无副作用）。
 * - 配置后:建立 TurnstileContext，通过 capture 阶段拦截表单提交；验证 widget 的落点由
 *   `widgetPlacement` 决定:
 *
 *   · `'inline'`（默认）—— widget 渲染在 children 之后。前提是 children 在正常文档流里
 *     （登录弹窗 LoginDialog 的卡片表单就是这一档）。
 *   · `'slot'` —— widget 不跟 children 走，改由页面在卡片内部放一个 `<TurnstileSlot />` 落位。
 *     给「children 根节点是 position:fixed 全屏遮罩」的页面用（/sso/login 的 AuthShellPage）。
 *
 *   为什么必须区分（2026-11-28 用户实测）:fixed 根节点脱离文档流，inline 的 widget 就成了容器
 *   里唯一的在流内元素，被顶到页面最顶端、压在遮罩后面 —— 看上去就是「弹窗右上方凭空多出
 *   一个独立的 CF 人机验证窗」。落点必须由真正承载表单的卡片决定，不能交给文档流碰运气。
 *
 * 深层表单可通过 `useTurnstile()` 读取 token，将验证 token 附带到登录请求。
 */

import * as React from 'react'
import { toast } from '@/components/common'
import { TurnstileWidget } from './TurnstileWidget'

/* -------------------------------------------------------------------------- */
/* Turnstile Context                                                           */
/* -------------------------------------------------------------------------- */

interface TurnstileContextValue {
  /** Turnstile token，null = 未验证，string = 已验证 */
  token: string | null
  /** 是否已通过人机验证 */
  verified: boolean
  /**
   * 人机验证在本卡片里是否**真实可用**（2026-11-28 增）。
   *
   * true = 外层套了 LoginWithTurnstile 且 siteKey 已配置，卡片里有 widget 可做；
   * false = 没套 provider / 本地未配 siteKey —— 此时"请先完成人机验证"这类提示毫无意义
   * （用户没有控件可点），表单应保持原有的降级路径。
   */
  enabled: boolean
  /**
   * 让 widget 重新挑战、并立刻把本地 token 置空（2026-11-28 增）。
   *
   * 调用时机:凡是把这个 token **发出去了**的请求，结束后都应调一次 —— Turnstile token 一次性，
   * 服务端 siteverify 成功即核销，复用会被 Cloudflare 判 `timeout-or-duplicate`。
   * 典型:登录失败重试、同页重发验证码。
   */
  reset: () => void
}

const noopReset = (): void => {}

const TurnstileContext = React.createContext<TurnstileContextValue>({
  token: null,
  verified: false,
  enabled: false,
  reset: noopReset,
})

/**
 * 读取当前 Turnstile 验证状态，供深层表单提交按钮拿到 token。
 * - `token` 为 null 表示未验证，表单提交应被拦截。
 * - `token` 为 string 表示已验证，可将 token 附带到登录请求体。
 * - 发出 token 后调 `reset()`，下一轮才有新票。
 */
export function useTurnstile(): TurnstileContextValue {
  return React.useContext(TurnstileContext)
}

/**
 * widget 落点上下文:只给 `<TurnstileSlot />` 用。
 * 与上面的公开 Context 分开，避免把内部回调泄漏给业务组件。
 */
interface TurnstileSlotContextValue {
  placement: TurnstileWidgetPlacement
  handleVerify: (token: string) => void
  handleExpire: () => void
  handleError: (error: string) => void
  /** 透传给 widget 的重置信号（见 TurnstileWidgetProps.resetSignal） */
  resetSignal: number
}

const TurnstileSlotContext = React.createContext<TurnstileSlotContextValue | null>(null)

/**
 * 人机验证 widget 的显式落点（仅 `widgetPlacement="slot"` 时生效）。
 *
 * 放在真正承载登录表单的卡片内部（表单下方）。页面没放 slot = 这一屏不需要验证 widget，
 * 也就不会再有"widget 自己找了个地方冒出来"的情况。
 */
export function TurnstileSlot({ className }: { className?: string }): React.ReactElement | null {
  const slot = React.useContext(TurnstileSlotContext)
  if (!slot || slot.placement !== 'slot') return null
  return (
    <div className={['flex w-full justify-center', className].filter(Boolean).join(' ')}>
      <TurnstileWidget
        onVerify={slot.handleVerify}
        onExpire={slot.handleExpire}
        onError={slot.handleError}
        resetSignal={slot.resetSignal}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

/** widget 落点模式，见文件头注释 */
export type TurnstileWidgetPlacement = 'inline' | 'slot'

export interface LoginWithTurnstileProps {
  /** 原始登录表单 */
  children: React.ReactNode
  /** Turnstile 验证通过回调，接收 token */
  onTurnstileVerified?: (token: string) => void
  /** Turnstile token 过期回调 */
  onTurnstileExpired?: () => void
  /** Turnstile 验证出错回调 */
  onTurnstileError?: (error: string) => void
  /**
   * widget 落点。
   * - inline（默认）:跟在 children 后面，要求 children 在文档流内（登录弹窗）
   * - slot:不自动渲染，由 `<TurnstileSlot />` 在卡片内部落位（/sso/login 这类 fixed 遮罩页）
   */
  widgetPlacement?: TurnstileWidgetPlacement
  /**
   * 是否用「未验证就拦提交」（默认 true）。
   *
   * 关掉它的场景（2026-11-28 增）:注册 / 找回密码这些卡片的**提交**动作，服务端不校验 token
   * （`/api/auth/register`、`/api/auth/reset-password` 都没有 siteverify 钩子），只有它们里面的
   * 「发送验证码」才可能被发码闸要求验证。把闸套在提交上只是平白多一道摩擦，
   * 所以这两张卡片只借 provider 的 token/控件，不接管提交。
   */
  enforceSubmitGate?: boolean
}

/* -------------------------------------------------------------------------- */
/* 启用态 Shell（独立组件，避免主组件 early return 违反 hooks 规则）            */
/* -------------------------------------------------------------------------- */

interface TurnstileEnabledShellProps {
  children: React.ReactNode
  onTurnstileVerified?: (token: string) => void
  onTurnstileExpired?: () => void
  onTurnstileError?: (error: string) => void
  placement: TurnstileWidgetPlacement
  enforceSubmitGate: boolean
}

function TurnstileEnabledShell({
  children,
  onTurnstileVerified,
  onTurnstileExpired,
  onTurnstileError,
  placement,
  enforceSubmitGate,
}: TurnstileEnabledShellProps): React.ReactElement {
  const [token, setToken] = React.useState<string | null>(null)
  // SDK 加载失败标记（网络问题/api.js 不可达时，降级放行不阻塞登录）
  const [sdkFailed, setSdkFailed] = React.useState(false)

  // ref 保持最新回调，避免 widget 因回调引用变化重渲染
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
    setSdkFailed(true) // SDK/widget 错误 → 标记失败，降级放行后续提交
    errorCbRef.current?.(err)
  }, [])

  /**
   * 主动重置（2026-11-28 增）：token 一次性，被服务端核销后必须换新的。
   * 置空本地 token（让提交闸重新拦住下一发），并递增信号让 widget 原地重挑战。
   */
  const [resetSignal, setResetSignal] = React.useState(0)
  const reset = React.useCallback((): void => {
    setToken(null)
    setResetSignal((n) => n + 1)
  }, [])

  // 拦截子表单提交（capture 阶段优先于 form 自身 onSubmit）:
  // 未验证 → preventDefault + stopPropagation + 提示
  // 降级:SDK 加载失败（网络问题/api.js 不可达）或 window.turnstile 不存在时放行
  const handleSubmitCapture = React.useCallback(
    (e: React.FormEvent): void => {
      if (!enforceSubmitGate) return
      if (sdkFailed) return
      if (
        typeof window !== 'undefined' &&
        !(window as unknown as { turnstile?: unknown }).turnstile
      )
        return
      if (!token) {
        e.preventDefault()
        e.stopPropagation()
        toast.error('请先完成人机验证')
      }
    },
    [enforceSubmitGate, sdkFailed, token],
  )

  const contextValue = React.useMemo<TurnstileContextValue>(
    () => ({ token, verified: Boolean(token), enabled: true, reset }),
    [token, reset],
  )

  const slotValue = React.useMemo<TurnstileSlotContextValue>(
    () => ({ placement, handleVerify, handleExpire, handleError, resetSignal }),
    [placement, handleVerify, handleExpire, handleError, resetSignal],
  )

  return (
    <TurnstileSlotContext.Provider value={slotValue}>
      <TurnstileContext.Provider value={contextValue}>
        {/* 2026-09-19 紧凑化:px-4 py-4 space-y-4 → px-4。原 space-y-4 对 0 高 TurnstileWidget
            仍会产生 16px 幽灵 margin（滚动容器 scrollHeight 虚增）；纵向节奏由表单自身
            space-y/pt 控制，此处不再叠加。 */}
        <div onSubmitCapture={handleSubmitCapture} className="px-4">
          {children}
          {placement === 'inline' && (
            <TurnstileWidget
              onVerify={handleVerify}
              onExpire={handleExpire}
              onError={handleError}
              resetSignal={resetSignal}
            />
          )}
        </div>
      </TurnstileContext.Provider>
    </TurnstileSlotContext.Provider>
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
  widgetPlacement = 'inline',
  enforceSubmitGate = true,
}: LoginWithTurnstileProps): React.ReactElement {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  // 未配置 siteKey → 向后兼容，直接渲染原始表单（不包裹额外结构）
  if (!siteKey) {
    return <>{children}</>
  }

  return (
    <TurnstileEnabledShell
      onTurnstileVerified={onTurnstileVerified}
      onTurnstileExpired={onTurnstileExpired}
      onTurnstileError={onTurnstileError}
      placement={widgetPlacement}
      enforceSubmitGate={enforceSubmitGate}
    >
      {children}
    </TurnstileEnabledShell>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
