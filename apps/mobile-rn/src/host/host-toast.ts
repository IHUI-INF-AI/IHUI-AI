// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 全局轻提示通道(mobile-rn 宿主实现,M4 B1)。
 *
 * 共享屏只消费 `OnToast` 端口,不知道 RN 用哪种载体出图;本模块是端内唯一中转:
 * 任意屏调用 `showHostToast`,由 `HostToastLayer` 单点渲染,避免每个壳各自维护一份 toast 态。
 * fire-and-forget:本函数不抛错、不返回 Promise(见 app-host-ports.ts 的 OnToast 契约)。
 */
import type { ToastKind } from '@ihui/types'

type HostToastListener = (message: string, kind: ToastKind, duration?: number) => void

let listener: HostToastListener | null = null

/** 渲染层未挂载时的落点:dev 明确记录,prod 静默丢弃(轻提示不是关键路径)。 */
export function showHostToast(
  message: string,
  options?: { kind?: ToastKind; duration?: number },
): void {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) {
    if (__DEV__) console.warn('[host-toast] 收到空白文案,已丢弃')
    return
  }
  if (listener) {
    listener(text, options?.kind ?? 'info', options?.duration)
    return
  }
  if (__DEV__) console.warn('[host-toast] 渲染层未挂载,轻提示被丢弃:', text)
}

export function subscribeHostToast(fn: HostToastListener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}
