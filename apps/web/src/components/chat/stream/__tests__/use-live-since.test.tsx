// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 深化M(2026-11-17):useLiveSince —— 基于**指定起点**(spawnedAt)的实时耗时 hook。
// 区别于 useLiveElapsed(起点=hook 挂载时刻):useLiveSince 起点是外部给定的 ISO 时间,
// 保证批次瓶颈"已跑X"与单行秒表同基准(spawnedAt),消除"批次瓶颈冻结 vs 单行跳动"的矛盾。
// 钉住:① 运行中从 spawnedAt 起算而非挂载时刻;② spawnedAt 无效回落;③ 非运行回落 fallbackMs。
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useLiveSince } from '../stream-ui'

afterEach(() => {
  vi.useRealTimers()
})

/** 把 useLiveSince 包一层,便于渲染成可断言的 hook */
function renderLiveSince(
  running: boolean,
  startedAtIso: string | undefined,
  fallbackMs?: number | null,
) {
  return renderHook(({ r, s, f }) => useLiveSince(r, s, f), {
    initialProps: { r: running, s: startedAtIso, f: fallbackMs },
  })
}

describe('useLiveSince 深化M:基于 spawnedAt 的实时耗时', () => {
  it('运行中:起点是 spawnedAt(而非 hook 挂载时刻)—— 用未来时间得 0,过去时间得正值', () => {
    vi.useFakeTimers()
    const futureIso = new Date(Date.now() + 60_000).toISOString() // 起点 60s 后
    const { result } = renderLiveSince(true, futureIso, 999)
    // 起点在未来 ⇒ elapsed 钳到 0(证明基准是 spawnedAt,不是挂载时刻)
    expect(result.current).toBe(0)
  })

  it('运行中:spawnedAt 在过去 ⇒ elapsed 为正且随时间增长', () => {
    vi.useFakeTimers()
    const pastIso = new Date(Date.now() - 5_000).toISOString() // 5s 前起跑
    const { result, rerender } = renderLiveSince(true, pastIso, 999)
    expect(result.current).not.toBeNull()
    expect(result.current as number).toBeGreaterThanOrEqual(5_000)
    // 推进 1s ⇒ elapsed 至少 +1s(实时 tick)
    vi.advanceTimersByTime(1_000)
    rerender({ r: true, s: pastIso, f: 999 })
    expect(result.current as number).toBeGreaterThanOrEqual(6_000)
  })

  it('spawnedAt 无效(非 ISO)⇒ 返回 null,不造残标', () => {
    const { result } = renderLiveSince(true, 'not-a-date', 999)
    expect(result.current).toBeNull()
  })

  it('spawnedAt 缺席 ⇒ 返回 null', () => {
    const { result } = renderLiveSince(true, undefined, 999)
    expect(result.current).toBeNull()
  })

  it('非运行(running=false)⇒ 回落 fallbackMs', () => {
    const { result } = renderLiveSince(false, new Date().toISOString(), 42_000)
    expect(result.current).toBe(42_000)
  })

  it('非运行且 fallbackMs 缺席 ⇒ 返回 null', () => {
    const { result } = renderLiveSince(false, new Date().toISOString())
    expect(result.current).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
