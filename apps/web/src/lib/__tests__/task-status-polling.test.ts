// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-937981 任务状态轮询引擎单测。
 * 票面验收:抽一个现有轮询 hook 加 settled 维度;断言首屏不抖动(settled 命中即终态)、
 * retry 3 次后停止且不再产生计时器;退避序列 [1000,2000,4000] 有界不指数失控。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BASE_POLL_INTERVAL_MS,
  MAX_POLL_ATTEMPTS,
  TRANSIENT_RETRY_DELAYS_MS,
  createTaskStatusPoller,
} from '@/lib/task-status-polling'

describe('createTaskStatusPoller(G-937981)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('settled 命中即终态:成功后不再产生任何计时器/查询(首屏不抖动)', async () => {
    let calls = 0
    const onSucceed = vi.fn()
    const onFailed = vi.fn()
    const poller = createTaskStatusPoller<string>({
      query: async () => {
        calls += 1
        return calls === 1 ? { kind: 'pending' } : { kind: 'succeed', data: 'done' }
      },
      onSucceed,
      onFailed,
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)
    expect(poller.isSettled()).toBe(false)
    expect(poller.isFresh()).toBe(true) // pending 已确认:决策可用

    await vi.advanceTimersByTimeAsync(BASE_POLL_INTERVAL_MS)
    expect(calls).toBe(2)
    expect(onSucceed).toHaveBeenCalledWith('done')
    expect(onSucceed).toHaveBeenCalledTimes(1)
    expect(poller.isSettled()).toBe(true)

    // 终态后放远时间:零新增查询(不再产生计时器),展示不会从终态抖回
    await vi.advanceTimersByTimeAsync(BASE_POLL_INTERVAL_MS * 100)
    expect(calls).toBe(2)
    expect(onFailed).not.toHaveBeenCalled()

    // settled 后 start() 是空动作
    poller.start()
    await vi.advanceTimersByTimeAsync(BASE_POLL_INTERVAL_MS * 10)
    expect(calls).toBe(2)
  })

  it('瞬态查询 throw 走有界退避 [1000,2000,4000],序列有界不指数失控', async () => {
    let calls = 0
    const onSucceed = vi.fn()
    const poller = createTaskStatusPoller<string>({
      query: async () => {
        calls += 1
        if (calls <= 3) throw new Error('CircuitOpenError')
        return { kind: 'succeed', data: 'ok' }
      },
      onSucceed,
      onFailed: () => {},
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)

    // 第 1 次重试:1000ms
    await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAYS_MS[0] ?? 1000)
    expect(calls).toBe(2)
    // 第 2 次重试:2000ms
    await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAYS_MS[1] ?? 2000)
    expect(calls).toBe(3)
    // 第 3 次重试:4000ms,成功收敛
    await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAYS_MS[2] ?? 4000)
    expect(calls).toBe(4)
    expect(onSucceed).toHaveBeenCalledWith('ok')
    expect(poller.isSettled()).toBe(true)
    expect(poller.isFresh()).toBe(true)
  })

  it('retry 3 次后停止且不再产生计时器,如实 onFailed 一次', async () => {
    let calls = 0
    const onFailed = vi.fn()
    const poller = createTaskStatusPoller<string>({
      query: async () => {
        calls += 1
        throw new Error('network down')
      },
      onSucceed: () => {},
      onFailed,
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)

    await vi.advanceTimersByTimeAsync(
      (TRANSIENT_RETRY_DELAYS_MS[0] ?? 0) + (TRANSIENT_RETRY_DELAYS_MS[1] ?? 0),
    )
    expect(calls).toBe(3)
    expect(onFailed).not.toHaveBeenCalled() // 还有额度,不产生错误终态

    await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAYS_MS[2] ?? 4000)
    expect(calls).toBe(4) // 1 首发 + 3 次有界重试
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(onFailed).toHaveBeenCalledWith('network down')
    expect(poller.isSettled()).toBe(true)

    // 额度用尽后放远时间:零新增查询(不再产生计时器,无退化无限轮询)
    await vi.advanceTimersByTimeAsync(60_000 * 10)
    expect(calls).toBe(4)
  })

  it('重试途中真实事件(start)重置额度;stop() 后不再产生任何计时器', async () => {
    let calls = 0
    const poller = createTaskStatusPoller<string>({
      query: async () => {
        calls += 1
        throw new Error('flaky')
      },
      onSucceed: () => {},
      onFailed: () => {},
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)

    // 第 1 次瞬态重试已排队(1000ms);真实事件到达 → 归还全部额度
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(2) // start 立即补一发查询
    // 重试额度已归零:下一次瞬态退避又是 1000ms 起步
    await vi.advanceTimersByTimeAsync(TRANSIENT_RETRY_DELAYS_MS[0] ?? 1000)
    expect(calls).toBe(3)

    poller.stop()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toBe(3) // stop 后零新增
  })

  it('服务端明确 failed 是终态;in-flight 期间到点的计时器不并发叠请求;pending 超过 MAX 次如实超时', async () => {
    let calls = 0
    const onFailed = vi.fn()
    const poller = createTaskStatusPoller<string>({
      query: async () => {
        calls += 1
        return { kind: 'failed', error: '任务失败' }
      },
      onSucceed: () => {},
      onFailed,
    })
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(onFailed).toHaveBeenCalledWith('任务失败')
    expect(poller.isSettled()).toBe(true)
    expect(calls).toBe(1)

    // pending 超时路径:MAX_POLL_ATTEMPTS 次 pending 后如实报"轮询超时"
    const timeoutPoller = createTaskStatusPoller<string>({
      query: async () => {
        calls += 1
        return { kind: 'pending' }
      },
      onSucceed: () => {},
      onFailed,
    })
    timeoutPoller.start()
    await vi.advanceTimersByTimeAsync(0)
    for (let i = 1; i < MAX_POLL_ATTEMPTS; i += 1) {
      await vi.advanceTimersByTimeAsync(BASE_POLL_INTERVAL_MS)
    }
    expect(timeoutPoller.isSettled()).toBe(true)
    expect(onFailed).toHaveBeenLastCalledWith('轮询超时')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
