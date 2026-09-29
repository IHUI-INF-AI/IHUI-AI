// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌‌​‌‌‍‍​‌​‌‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌‌​‌‌‌‍‍​‌​‌‌‌‍‍‌​‌​‌‌​‌‍‍​‌‌‌​‌‌‍‍‌​‌‌​​‌⁠

/**
 * 任务状态轮询引擎(机制吸收 G-937981;上游出处 zcode
 * packages/ui/src/lib/cuaPermissionStatusStore.ts 的 settled/fresh 快照分离 + 有界退避)。
 *
 * 从 use-ai-helpers 的 getaudio/getvideo 孪生轮询中抽出(两份 2000ms×60 的复制粘贴),
 * 并补上上游的两条核心纪律:
 *
 * 1. **settled / fresh 三态分离**:
 *    - settled = 终态(succeed/failed)已达成,只升不降;settled 命中即终态 ——
 *      不再产生任何计时器,后续 start() 是空动作(展示态不会从终态抖回"进行中");
 *    - fresh = 最近一次查询是否刚成功确认;每次查询开始落 false(决策口径),
 *      拿到 pending 结果重新置 true。展示可沿用 settled,决策必须等 fresh。
 * 2. **有界退避 [1000,2000,4000]ms**:查询 throw(网络异常/熔断等瞬态)不再像旧实现
 *    那样一枪打死整个轮询(任务可能还在服务端跑,把瞬态查询故障渲染成"生成失败"
 *    正是"不知道"≠"有问题"的误读),改走有界退避;额度用尽如实 onFailed。
 *    **retry 模式不重置额度** —— 否则每次重试都拿回满额度,有界退避退化成固定间隔
 *    的无限轮询;真实事件(start,新任务)才重置。
 *
 * 查询合并:上一发查询还在飞时到点的计时器直接跳过(in-flight 去重),不并发叠请求。
 */

/** 瞬态查询失败的有界退避间隔(毫秒);累计约 7s,用尽如实报错,稳态不产生计时器 */
export const TRANSIENT_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000]

/** 常规轮询间隔(毫秒);与抽离前 getaudio/getvideo 的 2000ms 一致 */
export const BASE_POLL_INTERVAL_MS = 2000

/** 常规轮询次数上限(2000ms × 60 = 2 分钟);与抽离前一致 */
export const MAX_POLL_ATTEMPTS = 60

/** 单次查询的三态判定结果 */
export type TaskPollOutcome<T> =
  | { kind: 'pending' }
  | { kind: 'succeed'; data: T }
  | { kind: 'failed'; error: string }

export interface TaskStatusPollerCallbacks<T> {
  /** 一次状态查询(网络/解析异常直接 throw,引擎按瞬态处理) */
  query: () => Promise<TaskPollOutcome<T>>
  /** 终态成功(整个 poller 生命周期至多一次) */
  onSucceed: (data: T) => void
  /** 终态失败:业务失败 / 轮询超时 / 瞬态重试额度用尽(整个生命周期至多一次) */
  onFailed: (error: string) => void
}

export interface TaskStatusPoller {
  start: () => void
  stop: () => void
  /** settled:终态已达成(只升不降);true 后不再产生任何计时器 */
  isSettled: () => boolean
  /** fresh:最近一次查询是否刚确认(查询进行中 / 瞬态退避中为 false) */
  isFresh: () => boolean
}

interface TimerHandle {
  clear: () => void
}

function scheduleTimer(delay: number, fn: () => void): TimerHandle {
  const id = setTimeout(fn, delay)
  return {
    clear: () => clearTimeout(id),
  }
}

/**
 * 创建一个任务状态轮询器。同一实例只服务一次任务;新任务 = 新实例
 * (实例创建本身就是"真实事件",退避额度随实例天然归零)。
 */
export function createTaskStatusPoller<T>(callbacks: TaskStatusPollerCallbacks<T>): TaskStatusPoller {
  let settled = false
  let fresh = false
  let inFlight = false
  let stopped = false
  let pendingAttempts = 0
  let retryAttempt = 0
  let timer: TimerHandle | null = null

  const clearTimer = (): void => {
    timer?.clear()
    timer = null
  }

  const settle = (): void => {
    settled = true
    clearTimer()
  }

  const finishFailed = (error: string): void => {
    settle()
    fresh = false
    callbacks.onFailed(error)
  }

  const runQuery = (): void => {
    if (settled || stopped || inFlight) return
    inFlight = true
    // 查询期间旧值不可作决策依据:任务状态可能刚翻转(fresh 落 false,settled 不动)
    fresh = false
    void Promise.resolve()
      .then(() => callbacks.query())
      .then((outcome) => {
        inFlight = false
        if (settled || stopped) return
        if (outcome.kind === 'succeed') {
          settle()
          fresh = true
          callbacks.onSucceed(outcome.data)
          return
        }
        if (outcome.kind === 'failed') {
          // 服务端明确判失败是终态,不是"不知道"
          finishFailed(outcome.error)
          return
        }
        pendingAttempts += 1
        if (pendingAttempts >= MAX_POLL_ATTEMPTS) {
          finishFailed('轮询超时')
          return
        }
        fresh = true
        timer = scheduleTimer(BASE_POLL_INTERVAL_MS, runQuery)
      })
      .catch((err: unknown) => {
        inFlight = false
        if (settled || stopped) return
        // 瞬态查询故障:走有界退避;retry 不重置额度,额度用尽如实报错不再产生计时器
        const delay = TRANSIENT_RETRY_DELAYS_MS[retryAttempt]
        if (delay === undefined) {
          finishFailed(err instanceof Error ? err.message : '查询失败(重试额度已用尽)')
          return
        }
        retryAttempt += 1
        timer = scheduleTimer(delay, runQuery)
      })
  }

  return {
    start: () => {
      // settled 命中即终态:重启不产生任何计时器(展示不抖)
      if (settled || stopped) return
      // 真实事件接管采样:清排队中的重试并归还全部额度
      clearTimer()
      retryAttempt = 0
      runQuery()
    },
    stop: () => {
      stopped = true
      clearTimer()
    },
    isSettled: () => settled,
    isFresh: () => fresh,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍​‌‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌‌​‌‌‍‍​‌​‌‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌‌​‌‌‌‍‍​‌​‌‌‌‍‍‌​‌​‌‌​‌‍‍​‌‌‌​‌‌‍‍‌​‌‌​​‌⁠
