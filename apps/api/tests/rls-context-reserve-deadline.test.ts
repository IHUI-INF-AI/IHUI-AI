// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-221 根治判据(2026-11-17):`reserve()` 无界等待 + 迟到连接泄漏 + 健康探针被牵连。
 *
 * 三条判据均为纯单元(mock client),不依赖真库,任何环境可跑:
 *   ① 正常 reserve 直接返回同一句柄,不被 deadline 误伤;
 *   ② reserve 永不 settle ⇒ 在 deadline 内 reject(不永久 hang);
 *   ③ 超时后迟到的 reserve 一旦拿到连接**立即 release**(降级不得加剧泄漏);
 *   ④ reserve 自身快速失败 ⇒ 原样抛出,不误判为 deadline;
 *   ⑤ /api/health 及其子路径豁免 rls-context;普通 /api/* 与 /v1/* 仍注入(反向牙)。
 */
import { describe, expect, it, vi } from 'vitest'
import { isScopedContextUrl, reserveWithDeadline } from '../src/plugins/rls-context.js'

interface FakeHandle {
  release: () => void
}

describe('F-221 根治:reserve 有界等待与迟到归还', () => {
  it('① 正常 reserve 直接返回同一句柄', async () => {
    const handle: FakeHandle = { release: vi.fn() }
    const got = await reserveWithDeadline({ reserve: async () => handle }, 1000)
    expect(got).toBe(handle)
    expect(handle.release).not.toHaveBeenCalled()
  })

  it('② reserve 永不 settle ⇒ deadline 内 reject,不永久 hang', async () => {
    const never = () => new Promise<FakeHandle>(() => undefined)
    const started = Date.now()
    await expect(reserveWithDeadline({ reserve: never }, 30)).rejects.toThrow(/deadline/)
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('③ 迟到的 reserve 拿到连接立即 release(降级不加剧泄漏)', async () => {
    let resolveLate!: (handle: FakeHandle) => void
    const handle: FakeHandle = { release: vi.fn() }
    const late = new Promise<FakeHandle>((resolve) => {
      resolveLate = resolve
    })
    await expect(reserveWithDeadline({ reserve: () => late }, 20)).rejects.toThrow(/deadline/)
    expect(handle.release).not.toHaveBeenCalled()
    resolveLate(handle)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(handle.release).toHaveBeenCalledTimes(1)
  })

  it('④ reserve 快速失败原样抛出,不误判为 deadline', async () => {
    await expect(
      reserveWithDeadline(
        { reserve: async () => { throw new Error('pool closed') } },
        1000,
      ),
    ).rejects.toThrow('pool closed')
  })
})

describe('F-221 根治:健康探针豁免(反向牙)', () => {
  it('/api/health 及其子路径、带查询串均豁免', () => {
    expect(isScopedContextUrl('/api/health')).toBe(false)
    expect(isScopedContextUrl('/api/health/live')).toBe(false)
    expect(isScopedContextUrl('/api/health/ready?verbose=1')).toBe(false)
  })

  it('普通 /api/* 与 /v1/* 仍注入,未误伤数据面', () => {
    expect(isScopedContextUrl('/api/users')).toBe(true)
    expect(isScopedContextUrl('/api/healthcheck')).toBe(true)
    expect(isScopedContextUrl('/v1/chat/completions')).toBe(true)
    expect(isScopedContextUrl('/health')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
