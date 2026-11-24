// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * runShutdownPhases 离线回归(2026-09-27 有序相可靠性票)。
 * 全程零 DB / 零网络 / 零信号:只喂构造相位,断言清单与 exitCode。
 * 用例 ② 是旧实现"disposer 挂死 ⇒ 进程假死"那一格的正面形状。
 */

import { describe, expect, it, vi } from 'vitest'
import {
  defaultShutdownBudgetMs,
  runShutdownPhases,
  type ShutdownPhase,
} from '../src/utils/shutdown-phases.js'

function mkLog() {
  return { info: vi.fn(), warn: vi.fn() }
}

/** 永不 resolve 的相位(真挂死形状:旧代码里 await 它就是无限等) */
function hangPhase(name: string, timeoutMs: number): ShutdownPhase {
  return { name, timeoutMs, run: () => new Promise(() => {}) }
}

const quick = (name: string, sink: string[]): ShutdownPhase => ({
  name,
  timeoutMs: 200,
  run: () => {
    sink.push(name)
  },
})

describe('runShutdownPhases', () => {
  it('① 某相抛错 ⇒ 后续相仍执行、failedPhases 记名、exitCode 非 0', async () => {
    const order: string[] = []
    const log = mkLog()
    const res = await runShutdownPhases({
      phases: [
        {
          name: 'boom',
          timeoutMs: 200,
          run: () => {
            order.push('boom')
            throw new Error(' disposer blew up')
          },
        },
        { name: 'async-reject', timeoutMs: 200, run: () => Promise.reject(new Error('nope')) },
        quick('after', order),
      ],
      log,
    })
    order.push('marker')
    expect(order).toEqual(['boom', 'after', 'marker']) // 红相不拦截后续相
    expect(res.failedPhases).toEqual(['boom', 'async-reject'])
    expect(res.timedOutPhases).toEqual([])
    expect(res.exitCode).toBe(1)
    const boom = res.outcomes.find((o) => o.phase === 'boom')
    expect(boom?.status).toBe('failed')
    expect(boom?.reason).toContain('disposer blew up') // 原因入账,不静默
    // 逐相 warn + 收尾一行摘要:info 恰一次(③ 之外此处也应只有一行 summary info=0)
    expect(log.info).not.toHaveBeenCalled()
    expect(log.warn).toHaveBeenCalledTimes(3) // 2 相失败告警 + 1 行 summary
  })

  it('② 某相永不 resolve ⇒ 该相 timedOut 且其后的相照样跑完(旧假死格)', async () => {
    const order: string[] = []
    const log = mkLog()
    const res = await runShutdownPhases({
      phases: [hangPhase('hang', 60), quick('after-1', order), quick('after-2', order)],
      log,
    })
    expect(order).toEqual(['after-1', 'after-2']) // 超时不阻塞后续相
    expect(res.timedOutPhases).toEqual(['hang'])
    expect(res.failedPhases).toEqual([])
    expect(res.exitCode).toBe(1) // 不得静默 exit 0
    const hang = res.outcomes.find((o) => o.phase === 'hang')
    expect(hang?.status).toBe('timedOut')
    expect(hang?.durationMs).toBeGreaterThanOrEqual(55) // 耗时入账
  })

  it('②b 挂死相超时后迟到 reject 不得冒成 unhandledRejection', async () => {
    const seen: unknown[] = []
    const onUnhandled = (e: unknown) => seen.push(e)
    process.on('unhandledRejection', onUnhandled)
    try {
      let rejectLate: (e: Error) => void = () => {}
      const late = new Promise<never>((_, rej) => {
        rejectLate = rej
      })
      const res = await runShutdownPhases({
        phases: [{ name: 'late-reject', timeoutMs: 30, run: () => late }],
        log: mkLog(),
      })
      rejectLate(new Error('late'))
      await new Promise((r) => setTimeout(r, 30)) // 给微任务/事件循环一次冲刷机会
      expect(res.timedOutPhases).toEqual(['late-reject'])
      expect(seen).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('③ 全部正常 ⇒ 单行摘要 + exitCode 0', async () => {
    const order: string[] = []
    const log = mkLog()
    const res = await runShutdownPhases({
      phases: [quick('a', order), quick('b', order)],
      log,
    })
    expect(res.exitCode).toBe(0)
    expect(res.outcomes.every((o) => o.status === 'ok')).toBe(true)
    expect(log.warn).not.toHaveBeenCalled()
    expect(log.info).toHaveBeenCalledTimes(1) // 摘要恰一行
    const [msg, meta] = log.info.mock.calls[0] as [string, Record<string, unknown>]
    expect(msg).toBe('shutdown-phases-summary')
    expect((meta.outcomes as unknown[]).length).toBe(2) // 相位/结果/耗时全量
    expect(meta.failedPhases).toEqual([])
    expect(meta.timedOutPhases).toEqual([])
    expect(meta.notRunPhases).toEqual([])
    expect(typeof meta.totalDurationMs).toBe('number')
  })

  it('④ 总预算超时 ⇒ 点名未跑完的相、不得静默 exit 0', async () => {
    const order: string[] = []
    const log = mkLog()
    // 预算 250ms:a 满 200 超时 ⇒ 剩 50,b 裁剪到 50 超时 ⇒ 剩 ≤0,c 起全部 notRun
    const res = await runShutdownPhases({
      phases: [hangPhase('a', 200), hangPhase('b', 200), quick('c', order), quick('d', order)],
      totalBudgetMs: 250,
      log,
    })
    expect(order).toEqual([]) // 预算耗尽后不再起跑
    expect(res.timedOutPhases).toEqual(['a', 'b'])
    expect(res.notRunPhases).toEqual(['c', 'd']) // 逐相点名,不省略清单
    const c = res.outcomes.find((o) => o.phase === 'c')
    expect(c?.reason).toContain('总预算') // 未跑原因写明
    expect(res.exitCode).toBe(1)
    expect(log.warn).toHaveBeenCalledTimes(3) // a、b 各一次 + summary 一行
  })

  it('默认总预算 = 各相之和再加一档', () => {
    const phases: ShutdownPhase[] = [
      { name: 'x', timeoutMs: 1000, run: () => {} },
      { name: 'y', timeoutMs: 300, run: () => {} },
    ]
    expect(defaultShutdownBudgetMs(phases)).toBe(2300) // Σ(1000+300) + 一档 max(1000)
  })
})
