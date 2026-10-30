// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 渲染层平滑度守门(组件级,假定时器驱动)
//
// 直接验证 MarkdownStream 收到"逐帧增长的 content"(即 smooth-delta-batcher 的输出)后,
// 自身节流是否仍保持逐帧平滑:
//   - 修复后(THROTTLE_MS=16,无 useDeferredValue):每帧 content 抖一下,渲染文本长度呈
//     多次小步增长,单次最大跳变 ≪ 总长;
//   - 回退到旧 400ms 自适应节流:相邻 25 帧被合并成一次大跳,单次跳变 ≈ 总长(整坨蹦)。
// 用被注入的大步长 delta 模拟批处理泵"落后越多追越快"的首帧大步,使判别成立。
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import React from 'react'
import MarkdownStream from '../markdown-stream'

beforeAll(() => {
  // jsdom 无 rAF,补一个(走 setTimeout,与假定时器一致)
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 16) as unknown as number) as typeof requestAnimationFrame
  }
  if (typeof globalThis.cancelAnimationFrame !== 'function') {
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('MarkdownStream 流式平滑度', () => {
  it('逐帧 content 增长应呈逐帧小步渲染,无整坨蹦', () => {
    vi.useFakeTimers()
    const FRAMES = 14
    const STEP = 700 // 模拟批处理泵首帧大步(delta 注入)
    let content = ''
    const { container, rerender } = render(<MarkdownStream content={content} isStreaming />)
    const lengths: number[] = []
    for (let i = 0; i < FRAMES; i++) {
      content += '流式'.repeat(STEP / 2)
      act(() => {
        rerender(<MarkdownStream content={content} isStreaming />)
      })
      // 推进一帧的节流时间,触发 MarkdownStream 的 setTimeout 尾沿
      act(() => {
        vi.advanceTimersByTime(16)
      })
      lengths.push(container.textContent?.length ?? 0)
    }

    const nonZero = lengths.filter((x) => x > 0)
    const distinct = [...new Set(nonZero)]
    const sorted = [...distinct].sort((a, b) => a - b)
    // 索引访问在 noUncheckedIndexedAccess 下是 T | undefined;此处两者都由上方的
    // length 守卫保证存在,`?? 0` 只是把「不可能发生」写进类型里,不改判定语义。
    const total = sorted.length ? (sorted[sorted.length - 1] ?? 0) : 0
    const maxStep =
      sorted.length > 1 ? Math.max(...sorted.slice(1).map((v, idx) => v - (sorted[idx] ?? 0))) : 0

    // eslint-disable-next-line no-console
    console.log(
      `[md-stream-smoothness] total=${total} distinctSteps=${distinct.length} maxStep=${maxStep} maxStepRatio=${
        total ? (maxStep / total).toFixed(3) : 'n/a'
      }`,
    )

    expect(total).toBeGreaterThan(2000)
    // 平滑:出现过多次(≥ FRAMES-2)不同的渲染长度台阶
    expect(distinct.length).toBeGreaterThanOrEqual(FRAMES - 2)
    // 关键:单次最大跳变不得超过总长一半(整坨蹦时这一项 ≈ 总长)
    expect(maxStep).toBeLessThanOrEqual(Math.ceil(total * 0.5))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
