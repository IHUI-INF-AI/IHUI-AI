// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import { useEffect } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { toUserFriendlyMessage } from '@ihui/shared'
import { rnRadiusFor } from '@ihui/design-tokens'
import { recordNotice } from '@/lib/notice-log-store'

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
 *
 * 2026-08-01 错误中文化:在 handler 接收事件处,对 error/warning 的 message + description
 * 自动调用 toUserFriendlyMessage 转中文。所有走 toastProxy 的错误提示都会被中文化,
 * 432 处 toast 调用无需逐个修改。
 */

const TOAST_EVENT = '__ihui_toast__'

type ToastMethod =
  | 'message'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'loading'
  | 'dismiss'
  | 'promise'
  | 'custom'

function dispatchToast(method: ToastMethod, args: unknown[]) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { method, args } }))
  }
}

/**
 * 对 error/warning 的 args 做中文化处理。
 * args[0] 是 message,args[1] 可能是 string / { description: string } / undefined / 其他对象。
 */
function localizeErrorArgs(args: unknown[]): unknown[] {
  const newArgs = [...args]
  // message 中文化
  if (typeof newArgs[0] === 'string') {
    newArgs[0] = toUserFriendlyMessage(newArgs[0])
  } else if (newArgs[0] instanceof Error) {
    newArgs[0] = toUserFriendlyMessage(newArgs[0])
  }
  // description / data 中文化
  const data = newArgs[1]
  if (typeof data === 'string') {
    newArgs[1] = toUserFriendlyMessage(data)
  } else if (data && typeof data === 'object' && 'description' in data) {
    const obj = data as { description?: unknown; [key: string]: unknown }
    if (typeof obj.description === 'string') {
      newArgs[1] = { ...obj, description: toUserFriendlyMessage(obj.description) }
    }
  }
  return newArgs
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
) as unknown as typeof sonnerToast

export { toastProxy as toast }
export type ToasterProps = ComponentProps<typeof SonnerToaster>

/**
 * 从 toast 实参里取出「要留痕的那句话」。
 *
 * 只认 4 类用户可见提示(message/success/error/warning/info):`loading` 是进度态、
 * `dismiss` 是撤销动作、`promise`/`custom` 是自绘内容,都不该进对话留痕。
 * 有 description 时拼在正文后(留痕是给"回头查"用的,少一半信息等于没留)。
 */
function noticeTextFor(
  method: ToastMethod,
  args: unknown[],
): { kind: 'success' | 'error' | 'warning' | 'info'; text: string } | null {
  const kind = method === 'message' ? 'info' : method
  if (kind !== 'success' && kind !== 'error' && kind !== 'warning' && kind !== 'info') return null
  const raw = args[0]
  const main =
    typeof raw === 'string' ? raw : raw instanceof Error ? toUserFriendlyMessage(raw) : ''
  if (!main.trim()) return null
  const data = args[1]
  let extra = ''
  if (typeof data === 'string') extra = data
  else if (data && typeof data === 'object' && 'description' in data) {
    const desc = (data as { description?: unknown }).description
    if (typeof desc === 'string') extra = desc
  }
  const text = extra.trim() ? `${main.trim()} · ${extra.trim()}` : main.trim()
  return { kind, text }
}

export function Toaster(props: ToasterProps) {
  useEffect(() => {
    const handler = (e: Event) => {
      const { method, args } = (e as CustomEvent).detail as { method: ToastMethod; args: unknown[] }
      // error/warning 自动中文化(2026-08-01 立)
      const finalArgs = method === 'error' || method === 'warning' ? localizeErrorArgs(args) : args
      // 2026-11 对话内留痕:在**唯一出口**记一份,432 处 toast 调用点无需逐个改。
      // 用中文化之后的文案(用户看到什么就留什么),且记失败绝不影响 toast 本身。
      try {
        const notice = noticeTextFor(method, finalArgs)
        if (notice) recordNotice(notice.kind, notice.text)
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[toaster] 留痕记录失败(不影响提示本身):', err)
        }
      }
      const fn = (sonnerToast as unknown as Record<string, (...a: unknown[]) => unknown>)[method]
      if (typeof fn === 'function') {
        fn.apply(sonnerToast, finalArgs)
      }
    }
    window.addEventListener(TOAST_EVENT, handler)
    return () => window.removeEventListener(TOAST_EVENT, handler)
  }, [])
  // 深度对标 主流 AI IDE 通知细节(2026-07-31):
  // - richColors: success/error/warning 用语义色背景,而非统一灰白
  // - closeButton: 每条通知可手动关闭(对标程序标配)
  // - theme: 跟随系统主题(light/dark/system)
  // - duration: 4s(对标程序默认值,比 sonner 默认 3s 多 1s 保证可读)
  // - position: top-center(对标 主流 IDE 通知位置,避免遮挡底部输入框)
  // - toastOptions: 圆角对齐 §4 规范(rounded-lg=8px)
  return (
    <SonnerToaster
      richColors
      closeButton
      theme="system"
      duration={4000}
      position="top-center"
      toastOptions={{
        style: {
          borderRadius: rnRadiusFor.panel,
        },
      }}
      {...props}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
