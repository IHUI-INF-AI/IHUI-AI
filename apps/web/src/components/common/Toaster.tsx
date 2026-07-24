'use client'

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import { useEffect } from 'react'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Sonner Toaster + toast 统一入口(2026-07-24 立)。
 *
 * 问题:Next.js Turbopack 对 'sonner' 模块创建了多个实例,导致 toast()(在 use-chat.ts
 * 等 Client Component 中调用)与 <SonnerToaster/>(在本文件中渲染)使用不同的 Observer
 * 单例。toast 调用后事件发布到 Observer A,但 Toaster 订阅的是 Observer B,toast 不显示。
 *
 * 方案:用 window 自定义事件作为全局事件总线,绕过模块实例问题:
 * 1. 导出的 toast 是一个代理,调用时派发 window CustomEvent
 * 2. <Toaster/> 在 useEffect 中监听该事件,在自己的模块上下文中调用真正的 sonnerToast
 * 3. 这样无论 toast() 在哪个模块中被调用,Toaster 都能收到并用自己的 Observer 渲染
 */

const TOAST_EVENT = '__ihui_toast__'

type ToastMethod = 'message' | 'success' | 'error' | 'warning' | 'info' | 'loading' | 'dismiss' | 'promise' | 'custom'

function dispatchToast(method: ToastMethod, args: unknown[]) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { method, args } }))
  }
}

// 创建 toast 代理:所有方法调用都派发 window 事件,由 Toaster 统一处理
const toastProxy = Object.assign(
  (message: string, data?: unknown) => dispatchToast('message', [message, data]),
  {
    success: (message: string, data?: unknown) => dispatchToast('success', [message, data]),
    error: (message: string, data?: unknown) => dispatchToast('error', [message, data]),
    warning: (message: string, data?: unknown) => dispatchToast('warning', [message, data]),
    info: (message: string, data?: unknown) => dispatchToast('info', [message, data]),
    loading: (message: string, data?: unknown) => dispatchToast('loading', [message, data]),
    dismiss: (id?: unknown) => dispatchToast('dismiss', [id]),
    promise: <T,>(promise: Promise<T> | (() => Promise<T>), data: unknown) =>
      dispatchToast('promise', [promise, data]),
    custom: (jsx: ReactNode, data?: unknown) => dispatchToast('custom', [jsx, data]),
  },
) as typeof sonnerToast

export { toastProxy as toast }
export type ToasterProps = ComponentProps<typeof SonnerToaster>

export function Toaster(props: ToasterProps) {
  useEffect(() => {
    const handler = (e: Event) => {
      const { method, args } = (e as CustomEvent).detail as { method: ToastMethod; args: unknown[] }
      const fn = (sonnerToast as Record<string, (...a: unknown[]) => unknown>)[method]
      if (typeof fn === 'function') {
        fn.apply(sonnerToast, args)
      }
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
  }, [])
  return <SonnerToaster {...props} />
}
