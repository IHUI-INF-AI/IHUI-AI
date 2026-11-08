// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-41 夹具。
 *
 * 缺陷：租户池 max 写死 10，容量按「每租 10」独立规划，未与全局连接预算合并核算。
 * 判据：TENANT_POOL_MAX 可配；缓存条目数 = min(缓存上限, floor(全局预算 / 单池 max))。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { postgresMock } = vi.hoisted(() => ({ postgresMock: vi.fn() }))

vi.mock('postgres', () => ({
  default: (url: string, options: Record<string, unknown>) => postgresMock(url, options),
}))
vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: (client: unknown) => ({ __client: client }),
}))

const ENV_KEYS = [
  'TENANT_POOL_MAX',
  'TENANT_TOTAL_CONNECTION_BUDGET',
  'TENANT_CACHE_MAX_ENTRIES',
  'TENANT_A_DATABASE_URL',
  'TENANT_B_DATABASE_URL',
  'TENANT_C_DATABASE_URL',
] as const

describe('DB-41 租户池全局预算', () => {
  const saved = new Map<string, string | undefined>()

  beforeEach(() => {
    vi.resetModules()
    postgresMock.mockReset()
    postgresMock.mockImplementation((url: string, options: Record<string, unknown>) => ({
      url,
      options,
      end: vi.fn(async () => {}),
    }))
    for (const key of ENV_KEYS) saved.set(key, process.env[key])
    process.env.TENANT_POOL_MAX = '20'
    process.env.TENANT_TOTAL_CONNECTION_BUDGET = '40'
    process.env.TENANT_CACHE_MAX_ENTRIES = '32'
    process.env.TENANT_A_DATABASE_URL = 'postgres://tenant-a'
    process.env.TENANT_B_DATABASE_URL = 'postgres://tenant-b'
    process.env.TENANT_C_DATABASE_URL = 'postgres://tenant-c'
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const value = saved.get(key)
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it('TENANT_POOL_MAX 可配且缓存条目受全局连接预算约束', async () => {
    const mod = await import('../src/tenant-router.js')
    mod.setDefaultDatabase({} as Parameters<typeof mod.setDefaultDatabase>[0])

    mod.getTenantDatabase('a')
    expect(postgresMock).toHaveBeenCalledTimes(1)
    expect(postgresMock.mock.calls[0]?.[1]).toMatchObject({ max: 20 })

    mod.getTenantDatabase('b')
    mod.getTenantDatabase('c')

    // 全局预算 40 / 单池 20 = 2 个租户条目；第三个到达时淘汰最旧的 a。
    expect(mod.getTenantPoolSize()).toBe(2)
    expect(mod.getTenantPoolConfig()).toEqual({ poolMax: 20, connectionBudget: 40, cacheMax: 2 })
  })
})
