// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'

import { toUserFriendlyMessage } from '@ihui/shared'

import { boundedAppend } from '@/lib/bounded-append'

/**
 * 全局错误通知 store(2026-08-01 立)。
 *
 * 设计目标:
 * - 替代 toast.error 的短暂提示(4s 消失),错误常驻直到用户关闭
 * - 从页面顶部滑下(由 GlobalErrorBanner 组件实现动画)
 * - 任意错误(string / Error / ApiResult 失败分支 / unknown)自动中文化
 * - 多条错误堆叠,每条可独立关闭
 *
 * 使用:
 * - React 组件内:const pushError = useErrorBannerStore((s) => s.pushError)
 * - 非 React 场景:import { pushError } from '@/stores/error-banner'
 */
export interface ErrorItem {
  id: string
  message: string
  timestamp: number
}

/** 最多保留条数,避免无限堆积 */
const MAX_ERRORS = 5

interface ErrorBannerState {
  errors: ErrorItem[]
  /** G-641:因上限溢出被丢弃的错误累计条数(0 = 从未丢;静默变短 = 伪造完整性) */
  dropped: number
  /** 推入错误(自动中文化),返回 id 便于后续清除 */
  pushError: (error: unknown) => string
  /** 清除指定错误 */
  clearError: (id: string) => void
  /** 清除全部错误 */
  clearAll: () => void
}

let errorIdCounter = 0

function genId(): string {
  errorIdCounter += 1
  return `err-${Date.now()}-${errorIdCounter}`
}

export const useErrorBannerStore = create<ErrorBannerState>((set) => ({
  errors: [],
  dropped: 0,

  pushError: (error) => {
    const id = genId()
    const message = toUserFriendlyMessage(error)
    set((s) => {
      // G-641:溢出丢最旧但丢弃条数必须入账,消费面(GlobalErrorBanner)据 dropped
      // 渲染 "…(dropped N)" 计数行,不许残缺被读成完整。
      const { items, dropped } = boundedAppend(
        s.errors,
        { id, message, timestamp: Date.now() },
        MAX_ERRORS,
      )
      return { errors: items, dropped: s.dropped + dropped }
    })
    return id
  },

  clearError: (id) => set((s) => ({ errors: s.errors.filter((e) => e.id !== id) })),

  clearAll: () => set({ errors: [], dropped: 0 }),
}))

/** 非 hook 场景便捷函数 */
export const pushError = (error: unknown): string => useErrorBannerStore.getState().pushError(error)
export const clearError = (id: string): void => useErrorBannerStore.getState().clearError(id)
export const clearAllErrors = (): void => useErrorBannerStore.getState().clearAll()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
