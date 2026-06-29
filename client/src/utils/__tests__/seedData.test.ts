// seedData.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

import * as api from '../seedData'

describe('seedData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('querySeed 正常', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.querySeed('users', { page: 1, size: 10 })
    expect(r.code).toBe(0)
    expect(r.data.list.length).toBe(2)
    expect(r.data.total).toBe(2)
  })

  it('querySeed page 2', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(Array.from({ length: 25 }, (_, i) => ({ id: i }))),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.querySeed('users', { page: 2, size: 10 })
    expect(r.data.list.length).toBe(10)
    expect(r.data.total).toBe(25)
  })

  it('querySeed keyword 搜索', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'apple' }, { id: 2, name: 'banana' }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.querySeed('fruits', { keyword: 'app' })
    expect(r.data.total).toBe(1)
  })

  it('querySeed filter', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, v: 1 }, { id: 2, v: 2 }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.querySeed('items', { filter: (it: Record<string, unknown>) => it.v === 1 })
    expect(r.data.total).toBe(1)
  })

  it('querySeed fetch 失败返回空', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve([]) })) as ReturnType<typeof vi.fn>
    const r = await api.querySeed('items')
    expect(r.data.list).toEqual([])
    expect(r.data.total).toBe(0)
  })

  it('getSeed 找到', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.getSeed('users', 1)
    expect(r?.id).toBe(1)
  })

  it('getSeed 字符串 id', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'a' }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.getSeed('users', '1')
    expect(r?.id).toBe(1)
  })

  it('getSeed 找不到', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.getSeed('users', 999)
    expect(r).toBeNull()
  })

  it('getConfig 正常', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ config: 'data' }),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.getConfig('cfg')
    expect(r.config).toBe('data')
  })

  it('getConfig 失败', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) })) as ReturnType<typeof vi.fn>
    const r = await api.getConfig('cfg')
    expect(r).toBeNull()
  })

  it('SEED_NAMES 长度', () => {
    expect(api.SEED_NAMES.length).toBeGreaterThan(10)
  })

  it('seedFallbackB 默认', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.seedFallbackB('orders')
    expect(r.success).toBe(true)
    expect(r.data.list.length).toBe(2)
  })

  it('seedFallbackB 带参数', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.seedFallbackB('orders', { page: 1, pageSize: 10, keyword: 'a' })
    expect(r.success).toBe(true)
  })

  it('seedFallbackB current/size', async () => {
    ;(globalThis as unknown as { fetch: ReturnType<typeof vi.fn> }).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([{ id: 1 }, { id: 2 }]),
      })
    ) as ReturnType<typeof vi.fn>
    const r = await api.seedFallbackB('orders', { current: 1, size: 5 })
    expect(r).toBeDefined()
  })
})
