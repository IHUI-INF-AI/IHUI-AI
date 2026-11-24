// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * HostToastLayer — 全局轻提示渲染层(M4 B1)。
 *
 * 单点订阅 `host-toast` 通道并复用 FloatBox 出图;由 App.tsx 在 I18nProvider 子树内挂一次。
 * 共享屏从不直接依赖本组件,只经 `OnToast` 端口调用。
 *
 * 时长口径(2026-11-05 收口):默认时长单源 = 共享通道的 `HOST_TOAST_DEFAULT_DURATION_MS`
 * (小程序端口 1500 / 小程序渲染层 2000 / 本层经 FloatBox 兜底 3000 的三份已并成一枚)。
 * `FloatBox` 自己的 3000 只服务**不经本通道**的直接调用点(如 RegisterScreen 的浮层),
 * 走通道的提示一律显式拿到时长,不得再吃 FloatBox 的兜底 —— 故这里把时长写死透传,
 * 不写 `?? undefined`。
 */
import { useEffect, useState } from 'react'
import type { ToastKind } from '@ihui/types'
import { FloatBox, type FloatBoxType } from '../components/FloatBox'
import { subscribeHostToast, HOST_TOAST_DEFAULT_DURATION_MS } from '@ihui/shared/utils/host-toast'

interface HostToastState {
  message: string
  kind: FloatBoxType
  duration: number
}

const KIND_OF: Readonly<Record<ToastKind, FloatBoxType>> = {
  success: 'success',
  error: 'error',
  info: 'info',
}

export function HostToastLayer() {
  const [state, setState] = useState<HostToastState | null>(null)

  useEffect(
    () =>
      subscribeHostToast((message, kind, duration) =>
        // 通道已在唯一真相源补好时长;取不到(旧订阅方/直接调用)才回落到同一枚常量,
        // 绝不回落到 FloatBox 的 3000 —— 那等于把刚并掉的三份再拆成两份。
        setState({ message, kind: KIND_OF[kind], duration: duration ?? HOST_TOAST_DEFAULT_DURATION_MS }),
      ),
    [],
  )

  return (
    <FloatBox
      visible={state !== null}
      type={state?.kind ?? 'info'}
      message={state?.message ?? ''}
      duration={state?.duration}
      onHide={() => setState(null)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
