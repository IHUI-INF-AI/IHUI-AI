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
  /**
   * 宿主接管超时(ms):入队后若 <ConfirmServiceHost /> 在这段时间内没把请求渲染出来,
   * 视为宿主缺失/渲染失败,以安全默认 false 结算,杜绝 Promise 永久悬挂。
   * 默认 2000ms —— 对齐 Cursor quit-confirm 的 WINDOW_SHOWN_MS(问询发出后窗口须在
   * 2s 内显示,否则降级),这里因 AGENTS.md 禁原生弹窗,降级口径取"取消"而非原生框。
   * 传 0 或负数关闭兜底(保留给确实需要无限等待的调用方)。
   */
  timeoutMs?: number
}

interface ConfirmRequest {
  options: ConfirmServiceOptions
  resolve: (v: boolean) => void
  /** 宿主是否已把该请求设为 current(真正渲染);渲染后撤销超时兜底。 */
  claimed: boolean
  /** 是否已结算:超时与用户点击竞态时只允许第一次生效。 */
  settled: boolean
  /** 幂等结算入口。 */
  settle: (v: boolean) => void
  timer: ReturnType<typeof setTimeout> | null
}

/** 默认宿主接管超时;可由测试临时改写,不改调用方默认行为。 */
let defaultTimeoutMs = 2000
export function __setConfirmHostTimeoutForTest(ms: number): void {
  defaultTimeoutMs = ms
}

let queue: ConfirmRequest[] = []
let notifyListeners: (() => void) | null = null

/**
 * 命令式确认:返回 Promise<boolean>,确认 true / 取消 false。
 *
 * 防悬挂(竞品对标 Cursor quit-confirm/quit-ready 的超时兜底范式):
 * 若 <ConfirmServiceHost /> 未挂载或渲染异常,入队请求永远不会被结算,调用方
 * `.then(delete)` 永不执行 —— 进程退出问询在 Cursor 侧用 2s 超时强制放行兜底。
 * 这里同型兜底:超时仍未 claimed ⇒ 以 false(取消)结算并出队。取消是安全默认,
 * 绝不把"宿主缺失"误判成"用户确认",避免误删。
 */
export function confirmDialog(options: ConfirmServiceOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const req: ConfirmRequest = {
      options,
      resolve,
      claimed: false,
      settled: false,
      settle: (v: boolean) => {
        if (req.settled) return
        req.settled = true
        if (req.timer) {
          clearTimeout(req.timer)
          req.timer = null
        }
        queue = queue.filter((r) => r !== req)
        resolve(v)
        // 队列推进:若宿主已挂载,让下一个请求顶上来。
        notifyListeners?.()
      },
      timer: null,
    }
    const timeoutMs = options.timeoutMs ?? defaultTimeoutMs
    if (timeoutMs > 0) {
      req.timer = setTimeout(() => {
        req.timer = null
        // 只有宿主从未接管(未渲染)才兜底;已渲染的请求交还用户交互,不强制取消。
        if (!req.claimed) req.settle(false)
      }, timeoutMs)
    }
    queue.push(req)
    notifyListeners?.()
  })
}

/** 全局单例挂载(app/layout.tsx)——渲染当前确认请求,复用应用上下文 */
export function ConfirmServiceHost() {
  const [current, setCurrent] = React.useState<ConfirmRequest | null>(null)

  React.useEffect(() => {
    // 宿主挂载即证明能渲染:接管时把请求标记为 claimed 并撤销超时兜底。
    const claim = (req: ConfirmRequest | null): ConfirmRequest | null => {
      if (req) req.claimed = true
      return req
    }
    notifyListeners = () => {
      setCurrent((c) => c ?? claim(queue[0] ?? null))
    }
    if (queue.length > 0) setCurrent(claim(queue[0] ?? null))
    return () => {
      notifyListeners = null
    }
  }, [])

  const finish = React.useCallback(
    (result: boolean) => {
      const req = current
      setCurrent(null)
      // 走幂等 settle:超时与点击竞态时只有第一次生效;settle 内部出队 + 推进。
      req?.settle(result)
      const next = queue[0]
      if (next) {
        next.claimed = true
        setCurrent(next)
      }
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
