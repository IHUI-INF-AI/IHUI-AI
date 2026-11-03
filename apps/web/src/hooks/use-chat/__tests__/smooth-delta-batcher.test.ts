// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// P1(2026-10-13 对标 Trae 词速率限流)平滑 batcher 行为单测:
// 覆盖对外契约 batch/flush/cancel/onProgress 与缓冲追平。
// rAF 用受控队列替身 + 可注入时钟,逐帧拨针,全部确定性断言。
// (速率公式 FLOOR/CAP/掉帧时间基的断言待 P1 实现落地后另立。)
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createSmoothDeltaBatcher } from '../smooth-delta-batcher'

type FrameCb = (ts: number) => void

function installRaf() {
  const frames: FrameCb[] = []
  let nextId = 0
  const cancelSpy = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameCb): number => {
    frames.push(cb)
    return ++nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (): void => {
    cancelSpy()
  })
  return {
    frames,
    cancelSpy,
    /** 按固定帧率推进 ms 毫秒,每帧派发当前队列快照 */
    pump(ms: number, clock: { now: number }, fps = 60): void {
      const step = 1000 / fps
      let elapsed = 0
      while (elapsed < ms - 1e-9) {
        const dt = Math.min(step, ms - elapsed)
        clock.now += dt
        elapsed += dt
        const snapshot = frames.splice(0, frames.length)
        for (const cb of snapshot) cb(clock.now)
      }
    },
  }
}

describe('createSmoothDeltaBatcher', () => {
  let raf: ReturnType<typeof installRaf>
  let clock: { now: number }
  const FRAME = 1000 / 60

  beforeEach(() => {
    clock = { now: 1_000_000 }
    raf = installRaf()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const make = (out: string[]) => createSmoothDeltaBatcher((d) => out.push(d))

  it('深缓冲:按窗口产速匀速推进,不一次性喷完', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('x'.repeat(2000))
    clock.now += 400 // 样本窗口跨 400ms → 产速 2000/0.4 = 5000c/s
    raf.pump(FRAME, clock)
    const first = out.join('').length
    expect(first).toBeGreaterThan(10)
    expect(first).toBeLessThan(2000)
  })

  it('停产兜底:窗口样本老化后,FLOOR 让残留缓冲继续打完,不冻屏', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('z'.repeat(100))
    raf.pump(5000, clock)
    expect(out.join('')).toBe('z'.repeat(100))
  })

  it('flush 立即清空剩余并停帧', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('abc')
    b.flush()
    expect(out.join('')).toBe('abc')
    raf.pump(100, clock)
    expect(out.join('')).toBe('abc')
    expect(raf.cancelSpy).toHaveBeenCalled()
  })

  it('cancel 丢弃缓冲,后续帧零追加', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('abc')
    b.cancel()
    raf.pump(100, clock)
    expect(out.join('')).toBe('')
  })

  it('onProgress 报告累计收到字符数(非已显示数)', () => {
    const out: string[] = []
    const seen: number[] = []
    const b = createSmoothDeltaBatcher((d) => out.push(d), {
      onProgress: (n) => seen.push(n),
    })
    b.batch('hello')
    raf.pump(500, clock)
    expect(seen).toContain(5)
    expect(out.join('')).toBe('hello')
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
