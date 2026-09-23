// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D39 错误重试可观测 · 倒计时纯函数 + 定时器 hook(2026-09-23 立)。
//
// 设计纪律(与 D108 的 ai/progress-sections/retry-notice.tsx 分工):
// - D108 的 RetryNotice 是"流内一行提示"(静态秒数,挂在 ai.pane 命名空间)。
// - 本文件服务"错误卡 / FallbackBanner"表面,提供**实时倒计时**(Xs 后重试逐秒递减)
//   + HTTP 状态 + 无响应超时三态,且严格"帧缺失时优雅降级"。
// - 帧(retry_scheduled)由 D34/d34-contract 在 api-client 分发,本层只消费 prop(retryInfo),
//   字段缺失即不渲染对应片段,绝不因缺字段而崩或空白整块。

import * as React from 'react'

/** 与 SSE retry_scheduled 契约同名的消费面(字段可选 → 优雅降级) */
export interface RetryCountdownInfo {
  /** 当前第几次重试(≥1) */
  attempt: number
  /** 最大重试次数(≥1) */
  maxRetries: number
  /** 距下次重试的毫秒数 */
  retryInMs: number
  /** HTTP 状态码(缺省表示非 HTTP 错误/无响应) */
  httpStatus?: number
  /** 是否为"无响应超时"(请求无 HTTP 响应而超时) */
  noResponse?: boolean
}

/** next-intl 风格的取词函数签名(与 FallbackBanner 的 t 一致) */
export type TFunction = (
  key: string,
  values?: Record<string, string | number | Date>,
) => string

/** 纯函数产出的三态视图(任一为 null = 该态不渲染) */
export interface RetryCountdownView {
  /** "第 N/M 次 · Xs 后重试" / "第 N/M 次 · 立即重试" */
  scheduleLabel: string | null
  /** "HTTP 429" 等状态码标签 */
  httpStatusLabel: string | null
  /** "无响应超时" 标签 */
  noResponseLabel: string | null
}

/** 毫秒 → 向上取整的秒数(≤0 归一为 0) */
export function secondsFromMs(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.ceil(ms / 1000)
}

/** 把剩余毫秒夹到 [0, retryInMs],非有限值(缺失)回退为 retryInMs */
export function clampRemaining(remainingMs: number, retryInMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs < 0) return Math.max(0, retryInMs)
  return Math.min(remainingMs, Math.max(0, retryInMs))
}

/**
 * 纯函数:把 retry_scheduled 帧字段 + 实时剩余毫秒编译成三态视图。
 * 字段缺失时对应标签返回 null(组件据此不渲染该片段)。
 * 无响应超时仅在**没有** HTTP 状态码时才显示(二选一,避免重复陈述)。
 */
export function buildRetryCountdownView(
  info: RetryCountdownInfo,
  t: TFunction,
  remainingMs: number,
): RetryCountdownView {
  const attempt = Number.isFinite(info.attempt) ? info.attempt : 0
  const max = Number.isFinite(info.maxRetries) ? info.maxRetries : 0
  const seconds = secondsFromMs(clampRemaining(remainingMs, info.retryInMs))

  let scheduleLabel: string | null = null
  if (attempt > 0 && max > 0) {
    scheduleLabel =
      seconds > 0
        ? t('errorRetry.schedule', { attempt, max, seconds })
        : t('errorRetry.scheduleNow', { attempt, max })
  }

  let httpStatusLabel: string | null = null
  if (typeof info.httpStatus === 'number' && Number.isFinite(info.httpStatus)) {
    httpStatusLabel = t('errorRetry.httpStatus', { status: info.httpStatus })
  }

  let noResponseLabel: string | null = null
  if (info.noResponse === true && httpStatusLabel === null) {
    noResponseLabel = t('errorRetry.noResponse')
  }

  return { scheduleLabel, httpStatusLabel, noResponseLabel }
}

/**
 * 实时倒计时 hook:每 250ms 递减剩余毫秒,归零后停止并清理定时器。
 * 组件卸载时 clearInterval,杜绝内存泄漏。retryInMs 非法/缺失 → 直接 0(不渲染倒计时)。
 */
export function useRetryCountdown(retryInMs: number | undefined): number {
  const [remaining, setRemaining] = React.useState<number>(() =>
    retryInMs && retryInMs > 0 ? retryInMs : 0,
  )

  React.useEffect(() => {
    if (!retryInMs || retryInMs <= 0) {
      setRemaining(0)
      return
    }
    setRemaining(retryInMs)
    const start = Date.now()
    const id = window.setInterval(() => {
      const left = retryInMs - (Date.now() - start)
      if (left <= 0) {
        setRemaining(0)
        window.clearInterval(id)
      } else {
        setRemaining(left)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [retryInMs])

  return remaining
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
