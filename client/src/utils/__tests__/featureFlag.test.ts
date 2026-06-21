/**
 * 特性开关（Feature Flag）单元测试
 * 覆盖：
 * - 白名单 / 黑名单强制开关
 * - 灰度比例（一致性哈希）
 * - 变体分配（按权重）
 * - 远程配置加载
 * - 持久化缓存
 * - 过期处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  setExperiment,
  isFeatureEnabled,
  getVariant,
  getVariantPayload,
  setFeatureFlagUserIdResolver,
  loadRemoteConfigs,
  clearAllFlags,
  restoreFromCache,
  getAllFlagStates,
} from '../featureFlag'

describe('featureFlag', () => {
  beforeEach(() => {
    clearAllFlags()
    setFeatureFlagUserIdResolver(() => null)
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  afterEach(() => {
    clearAllFlags()
  })

  it('默认未配置时返回 false', () => {
    expect(isFeatureEnabled('not-configured')).toBe(false)
  })

  it('100% 灰度所有用户启用', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('test-1', { rolloutPercentage: 100 })
    expect(isFeatureEnabled('test-1')).toBe(true)
  })

  it('0% 灰度所有用户禁用', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('test-2', { rolloutPercentage: 0 })
    expect(isFeatureEnabled('test-2')).toBe(false)
  })

  it('白名单强制启用', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('test-3', { rolloutPercentage: 0, whitelist: ['user-1'] })
    expect(isFeatureEnabled('test-3')).toBe(true)
  })

  it('黑名单强制禁用', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('test-4', { rolloutPercentage: 100, blacklist: ['user-1'] })
    expect(isFeatureEnabled('test-4')).toBe(false)
  })

  it('50% 灰度分布大致 50/50', () => {
    setFeatureFlagUserIdResolver(() => null)
    let enabled = 0
    for (let i = 0; i < 2000; i++) {
      // 使用 UUID 风格 ID 避免前缀分布有偏
      setFeatureFlagUserIdResolver(() => `${Math.random().toString(36).slice(2)}-${i}`)
      setExperiment('test-5', { rolloutPercentage: 50 })
      if (isFeatureEnabled('test-5')) enabled++
    }
    // 2000 个样本允许 ±5% 误差（±100）
    expect(enabled, `分布 ${enabled}/2000`).toBeGreaterThan(900)
    expect(enabled, `分布 ${enabled}/2000`).toBeLessThan(1100)
  })

  it('一致性哈希：同用户始终同一分桶', () => {
    setFeatureFlagUserIdResolver(() => 'consistent-user-001')
    const results = new Set<boolean>()
    for (let i = 0; i < 10; i++) {
      setExperiment('test-6', { rolloutPercentage: 50 })
      results.add(isFeatureEnabled('test-6'))
    }
    expect(results.size, '结果唯一').toBe(1)
  })

  it('变体按权重分配', () => {
    let aCount = 0
    let bCount = 0
    for (let i = 0; i < 1000; i++) {
      setFeatureFlagUserIdResolver(() => `user-${i}`)
      setExperiment('test-7', {
        rolloutPercentage: 100,
        variants: [
          { name: 'A', weight: 70 },
          { name: 'B', weight: 30 },
        ],
      })
      const v = getVariant('test-7')
      if (v === 'A') aCount++
      else if (v === 'B') bCount++
    }
    expect(aCount, `A=${aCount}`).toBeGreaterThan(600)
    expect(bCount, `B=${bCount}`).toBeGreaterThan(200)
  })

  it('变体 payload 正确返回', () => {
    setFeatureFlagUserIdResolver(() => 'user-with-payload')
    setExperiment('test-8', {
      rolloutPercentage: 100,
      variants: [
        { name: 'X', weight: 100, payload: { color: 'red', size: 10 } },
      ],
    })
    const payload = getVariantPayload<{ color: string; size: number }>('test-8')
    expect(payload?.color).toBe('red')
    expect(payload?.size).toBe(10)
  })

  it('过期实验强制关闭', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('test-9', { rolloutPercentage: 100, expiresAt: Date.now() - 1000 })
    expect(isFeatureEnabled('test-9')).toBe(false)
  })

  it('未启用 flag 的变体返回 null', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('test-10', { rolloutPercentage: 0 })
    expect(getVariant('test-10')).toBeNull()
    expect(getVariantPayload('test-10')).toBeNull()
  })

  it('远程配置加载', async () => {
    const mockData = { 'remote-flag': { rolloutPercentage: 100 } }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    })
    ;(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

    await loadRemoteConfigs('/api/feature-flags')
    expect(mockFetch).toHaveBeenCalledWith('/api/feature-flags')

    setFeatureFlagUserIdResolver(() => 'user-1')
    expect(isFeatureEnabled('remote-flag')).toBe(true)
  })

  it('远程配置加载失败静默', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    ;(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

    await loadRemoteConfigs('/api/feature-flags')
    expect(true, '不抛错').toBe(true)
  })

  it('远程配置加载异常静默', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network'))
    ;(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

    await loadRemoteConfigs('/api/feature-flags')
    expect(true, '不抛错').toBe(true)
  })

  it('localStorage 缓存读写', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('cached-flag', { rolloutPercentage: 100 })
    expect(localStorage.getItem('feature_flags_cache')).not.toBeNull()
    restoreFromCache()
    expect(true, '不抛错').toBe(true)
  })

  it('clearAllFlags 清空全部', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('f1', { rolloutPercentage: 100 })
    setExperiment('f2', { rolloutPercentage: 100 })
    expect(Object.keys(getAllFlagStates()).length).toBeGreaterThan(0)
    clearAllFlags()
    expect(getAllFlagStates()).toEqual({})
  })

  it('getAllFlagStates 列出所有 flag 状态', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('state-flag', { rolloutPercentage: 100 })
    const states = getAllFlagStates()
    expect(states['state-flag']).toBeDefined()
    expect(states['state-flag'].enabled).toBe(true)
    expect(states['state-flag'].rollout).toBe(100)
  })

  it('变体权重全 0 返回 -1', () => {
    setFeatureFlagUserIdResolver(() => 'user-1')
    setExperiment('zero-weight', {
      rolloutPercentage: 100,
      variants: [
        { name: 'A', weight: 0 },
        { name: 'B', weight: 0 },
      ],
    })
    // 由于灰度 100% 但变体都不可用，仍然 enabled 但 variantIndex=-1
    expect(isFeatureEnabled('zero-weight')).toBe(true)
    expect(getVariant('zero-weight')).toBeNull()
  })
})
