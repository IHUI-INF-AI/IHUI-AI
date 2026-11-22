// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 命令式确认对话框服务(2026-09-06 立)。
 *
 * 目的:根治 AGENTS.md §4 违规 —— 替代散落各页面的 window.confirm 原生弹窗。
 * 用法(无需在页面内声明 state/JSX):
 *   import { confirmDialog } from '@/components/feedback'
 *   void confirmDialog({ title: t('deleteConfirm') }).then((ok) => {
 *     if (ok) deleteMut.mutate(id)
 *   })
 *
 * 实现:模块级请求队列 + <ConfirmServiceHost /> 单例挂载点(app/layout.tsx,
 * 应用树内以复用 next-intl / 主题上下文),确认交互统一走项目自有 ConfirmDialog。
 */

import * as React from 'react'
import { ConfirmDialog } from './ConfirmDialog'

export interface ConfirmServiceOptions {
  title?: string
  content?: React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
}

interface ConfirmRequest {
  options: ConfirmServiceOptions
  resolve: (v: boolean) => void
}

let queue: ConfirmRequest[] = []
let notifyListeners: (() => void) | null = null

/** 命令式确认:返回 Promise<boolean>,确认 true / 取消 false */
export function confirmDialog(options: ConfirmServiceOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    queue.push({ options, resolve })
    notifyListeners?.()
  })
}

/** 全局单例挂载(app/layout.tsx)——渲染当前确认请求,复用应用上下文 */
export function ConfirmServiceHost() {
  const [current, setCurrent] = React.useState<ConfirmRequest | null>(null)

  React.useEffect(() => {
    notifyListeners = () => {
      setCurrent((c) => c ?? queue[0] ?? null)
    }
    if (queue.length > 0) setCurrent(queue[0] ?? null)
    return () => {
      notifyListeners = null
    }
  }, [])

  const finish = React.useCallback(
    (result: boolean) => {
      const req = current
      setCurrent(null)
      queue = queue.filter((r) => r !== req)
      req?.resolve(result)
      const next = queue[0]
      if (next) setCurrent(next)
    },
    [current],
  )

  if (!current) return null
  return (
    <ConfirmDialog
      open
      title={current.options.title}
      content={current.options.content}
      confirmText={current.options.confirmText}
      cancelText={current.options.cancelText}
      variant={current.options.variant}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
