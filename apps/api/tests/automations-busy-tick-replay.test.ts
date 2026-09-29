// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { createSingleFlightTick } from '../src/services/automations/index.js'

/** 手工受控的"一轮工作":await 由测试释放。 */
function manualRun(): { run: () => Promise<void>; release: () => void; runs: number[] } {
  let runs = 0
  const started: number[] = []
  let release: () => void = () => {}
  const run = (): Promise<void> => {
    runs += 1
    started.push(runs)
    return new Promise<void>((resolve) => {
      release = resolve
    })
  }
  return { run, release: (): void => { release() }, runs: started }
}

describe('G-668 忙时收到的 tick 不得丢(调度器单飞工厂)', () => {
  it('busy 期再 tick ⇒ 记账;本轮一结束立即补跑,不等下个 interval', async () => {
    const m = manualRun()
    const flight = createSingleFlightTick(m.run)
    const p1 = flight.tick() // 第 1 轮开始,挂起
    expect(flight.isBusy()).toBe(true)
    expect(flight.hasPendingReplay()).toBe(false)

    void flight.tick() // busy 期的请求 —— 旧行为是直接 return(用户白等一个 interval)
    expect(flight.hasPendingReplay()).toBe(true)

    m.release() // 第 1 轮结束
    await p1
    // 补跑必须"立即"发生:释放后无需任何再触发,第 2 轮已在飞
    expect(flight.isBusy()).toBe(true)
    expect(flight.hasPendingReplay()).toBe(false)
    expect(m.runs).toEqual([1, 2])

    m.release()
    await Promise.resolve()
    expect(flight.isBusy()).toBe(false)
    expect(m.runs).toEqual([1, 2])
  })

  it('busy 期多次 tick 只补跑一次(记账去重,不是排队 N 次)', async () => {
    const m = manualRun()
    const flight = createSingleFlightTick(m.run)
    const p1 = flight.tick()
    void flight.tick()
    void flight.tick()
    void flight.tick()
    expect(flight.hasPendingReplay()).toBe(true)
    m.release()
    await p1
    expect(flight.isBusy()).toBe(true) // 唯一一次补跑在飞
    expect(m.runs).toEqual([1, 2])
    m.release()
    await Promise.resolve()
    expect(m.runs).toEqual([1, 2]) // 没有第 3 次
  })

  it('stop 之后:已记账的补跑作废、后续 tick 一律不跑(优雅关停不等补跑)', async () => {
    const m = manualRun()
    const flight = createSingleFlightTick(m.run)
    const p1 = flight.tick()
    void flight.tick()
    expect(flight.hasPendingReplay()).toBe(true)
    flight.stop()
    m.release()
    await p1
    expect(m.runs).toEqual([1]) // 补跑被作废
    void flight.tick()
    await Promise.resolve()
    expect(m.runs).toEqual([1]) // 后续 tick 也不再跑
  })

  it('run 抛错 ⇒ 走 onError 且补跑照常记账(失败不吞掉用户的下一次请求)', async () => {
    let calls = 0
    let seenErr: unknown = null
    const flight = createSingleFlightTick(
      async (): Promise<void> => {
        calls += 1
        if (calls === 1) throw new Error('boom')
      },
      (err: unknown): void => { seenErr = err },
    )
    const p1 = flight.tick()
    void flight.tick() // busy 期请求:即使本轮注定失败,也必须补跑
    await p1
    expect((seenErr as Error).message).toBe('boom')
    // 失败那轮结束后,补跑立即开始
    expect(calls).toBe(2)
    await new Promise<void>((r) => { setTimeout(r, 0) })
    expect(calls).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
