// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-46 回归:anti-automation Redis 降级计数器的 memFreq 键永不删除。
 *
 * 历史缺陷:降级路径(server.redis 缺失)只裁剪数组内过期时间戳、从不 delete 键,
 * 键空间等于进程生命周期内见过的独立 IP/用户数 → 长期运行内存单调增长。
 * 修复后:滑出窗口的键即时摘除 + 每 N 次写入一次清扫 + MAX_MEM_ENTRIES 上限 FIFO 淘汰。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn(async () => {
    throw new Error('unused in this suite')
  }),
}))

import { __test__, __memFreqSizeForTest } from '../src/plugins/anti-automation.js'

const { incrCounter, memFreqGet, memFreqReset, memLimits } = __test__
const WINDOW_MS = 60_000

beforeEach(() => {
  memFreqReset()
})

describe('F-46 memFreq 降级计数器不再泄漏', () => {
  it('同一键在窗口内的计数语义不变(含本次)', async () => {
    expect(await incrCounter(null, 'ip:a', 1_000, WINDOW_MS)).toBe(1)
    expect(await incrCounter(null, 'ip:a', 1_001, WINDOW_MS)).toBe(2)
    expect(memFreqGet('ip:a')).toEqual([1_000, 1_001])
  })

  it('时间戳全部滑出窗口后不累计旧记录:数组只保留本次', async () => {
    await incrCounter(null, 'ip:b', 1_000, WINDOW_MS)
    await incrCounter(null, 'ip:b', 1_500, WINDOW_MS)
    expect(memFreqGet('ip:b')).toEqual([1_000, 1_500])

    const later = 1_500 + WINDOW_MS + 1
    expect(await incrCounter(null, 'ip:b', later, WINDOW_MS)).toBe(1)
    expect(memFreqGet('ip:b')).toEqual([later])
  })

  it('过期键由周期性清扫删除,未过期键保留', async () => {
    const sweepEvery = memLimits().MEM_SWEEP_EVERY
    // 第 1 次写入:窗口很短的键,稍后整体过期
    await incrCounter(null, 'ip:stale', 0, 1_000)
    // 凑满 MEM_SWEEP_EVERY 次写入,最后一次触发清扫(now=5000, cutoff=4000)
    for (let i = 0; i < sweepEvery - 1; i++) {
      await incrCounter(null, `ip:fresh-${i}`, 5_000, 1_000)
    }
    expect(memFreqGet('ip:stale')).toBeUndefined()
    expect(memFreqSize()).toBe(sweepEvery - 1)
    expect(memFreqGet('ip:fresh-0')).toEqual([5_000])
  })

  it('清扫是定期而非每写一次:单次写入不会遍历整表', async () => {
    // 先放一个已过期的键,再只写一次新键(远未达到清扫阈值)
    await incrCounter(null, 'ip:stale-early', 0, 1_000)
    await incrCounter(null, 'ip:fresh-early', 5_000, 1_000)
    expect(memFreqGet('ip:stale-early')).toEqual([0])
    expect(memFreqSize()).toBe(2)
  })

  it('键数超过 MAX_MEM_ENTRIES 时按插入顺序 FIFO 淘汰最旧键', async () => {
    const { MAX_MEM_ENTRIES } = memLimits()
    for (let i = 0; i < MAX_MEM_ENTRIES + 50; i++) {
      await incrCounter(null, `ip:${i}`, 1_000, WINDOW_MS)
    }
    expect(__memFreqSizeForTest()).toBeLessThanOrEqual(MAX_MEM_ENTRIES)
    expect(memFreqGet('ip:0')).toBeUndefined()
    expect(memFreqGet(`ip:${MAX_MEM_ENTRIES + 49}`)).toEqual([1_000])
  })

  it('源码保留 delete 与上限淘汰(防止回退成只裁剪数组)', async () => {
    const fs = await import('node:fs/promises')
    const src = await fs.readFile(new URL('../src/plugins/anti-automation.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/if \(kept\.length === 0\) memFreq\.delete\(key\)/)
    expect(src).toMatch(/sweepExpiredMemFreq\(now, windowMs\)/)
    expect(src).toMatch(/evictOldest\(memFreq, MAX_MEM_ENTRIES\)/)
  })
})

function memFreqSize(): number {
  return __memFreqSizeForTest()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
