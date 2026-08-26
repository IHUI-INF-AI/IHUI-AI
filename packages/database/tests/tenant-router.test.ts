/**
 * tenant-router 单元测试。
 *
 * 验证:
 * - LRU 上限淘汰:超过 TENANT_CACHE_MAX_ENTRIES 时淘汰最久未访问的租户并关闭其连接池
 * - 访问命中会刷新 LRU 顺序(最近访问的不被淘汰)
 * - 未配置租户 URL 时 fallback 默认库
 * - closeAllTenantDatabases 关闭全部连接
 *
 * 通过 vi.mock 替换 postgres / drizzle,不建立真实连接;
 * 模块级状态(pool/defaultDb/env 读取的上限)用 vi.resetModules + 动态 import 隔离。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { endMocks } = vi.hoisted(() => ({
  endMocks: [] as { end: ReturnType<typeof vi.fn> }[],
}))

vi.mock('postgres', () => ({
  default: vi.fn((_url: string, _opts: unknown) => {
    const entry = { end: vi.fn().mockResolvedValue(undefined) }
    endMocks.push(entry)
    return entry
  }),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn((client: unknown) => ({ __client: client })),
}))

vi.mock('../src/schema/index.js', () => ({ default: {}, __esModule: true }))

const ENV_KEYS = [
  'TENANT_CACHE_MAX_ENTRIES',
  ...Array.from({ length: 6 }, (_, i) => `TENANT_T${i + 1}_DATABASE_URL`),
]

async function loadModule() {
  const mod = await import('../src/tenant-router')
  const db = { __default: true } as unknown as Database
  mod.setDefaultDatabase(db)
  return { mod, defaultDb: db }
}

describe('tenant-router', () => {
  beforeEach(() => {
    vi.resetModules()
    endMocks.length = 0
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key]
  })

  it('未配置租户 URL 时 fallback 到默认库且不建池', async () => {
    const { mod, defaultDb } = await loadModule()
    expect(mod.getTenantDatabase('t1')).toBe(defaultDb)
    expect(mod.getTenantDatabase(null)).toBe(defaultDb)
    expect(mod.getTenantPoolSize()).toBe(0)
  })

  it('配置租户 URL 时懒加载建池并缓存复用', async () => {
    process.env.TENANT_T1_DATABASE_URL = 'postgres://localhost/t1'
    const { mod } = await loadModule()
    const db1 = mod.getTenantDatabase('t1')
    const db2 = mod.getTenantDatabase('t1')
    expect(db1).toBe(db2)
    expect(mod.getTenantPoolSize()).toBe(1)
    expect(mod.listTenantIds()).toEqual(['t1'])
  })

  it('超过缓存上限时淘汰最旧租户并关闭其连接池', async () => {
    process.env.TENANT_CACHE_MAX_ENTRIES = '2'
    for (let i = 1; i <= 3; i++) {
      process.env[`TENANT_T${i}_DATABASE_URL`] = `postgres://localhost/t${i}`
    }
    const { mod } = await loadModule()
    mod.getTenantDatabase('t1')
    mod.getTenantDatabase('t2')
    expect(mod.getTenantPoolSize()).toBe(2)

    mod.getTenantDatabase('t3')
    // t1 最旧被淘汰,池中剩 t2、t3
    expect(mod.listTenantIds().sort()).toEqual(['t2', 't3'])
    // t1 的连接池(t1 端)是第一个创建的,应被关闭
    expect(endMocks[0]!.end).toHaveBeenCalledTimes(1)
    expect(endMocks[1]!.end).not.toHaveBeenCalled()
    expect(endMocks[2]!.end).not.toHaveBeenCalled()
  })

  it('命中访问刷新 LRU,最近访问的租户不被淘汰', async () => {
    process.env.TENANT_CACHE_MAX_ENTRIES = '2'
    for (let i = 1; i <= 3; i++) {
      process.env[`TENANT_T${i}_DATABASE_URL`] = `postgres://localhost/t${i}`
    }
    const { mod } = await loadModule()
    mod.getTenantDatabase('t1')
    mod.getTenantDatabase('t2')
    mod.getTenantDatabase('t1') // 刷新 t1 为最新
    mod.getTenantDatabase('t3') // 触发淘汰,此时最旧是 t2
    expect(mod.listTenantIds().sort()).toEqual(['t1', 't3'])
    expect(endMocks[1]!.end).toHaveBeenCalledTimes(1) // t2 的端被关
    expect(endMocks[0]!.end).not.toHaveBeenCalled() // t1 仍在池中
  })

  it('被淘汰的租户再次访问会重建连接池', async () => {
    process.env.TENANT_CACHE_MAX_ENTRIES = '1'
    process.env.TENANT_T1_DATABASE_URL = 'postgres://localhost/t1'
    process.env.TENANT_T2_DATABASE_URL = 'postgres://localhost/t2'
    const { mod } = await loadModule()
    mod.getTenantDatabase('t1')
    mod.getTenantDatabase('t2') // t1 被淘汰
    expect(mod.getTenantPoolSize()).toBe(1)
    const db1again = mod.getTenantDatabase('t1') // t2 被淘汰,t1 重建
    expect(mod.listTenantIds()).toEqual(['t1'])
    expect(db1again).toBeDefined()
    expect(mod.getTenantPoolSize()).toBe(1)
  })

  it('closeAllTenantDatabases 关闭全部连接并清空池', async () => {
    for (let i = 1; i <= 2; i++) {
      process.env[`TENANT_T${i}_DATABASE_URL`] = `postgres://localhost/t${i}`
    }
    const { mod } = await loadModule()
    mod.getTenantDatabase('t1')
    mod.getTenantDatabase('t2')
    await mod.closeAllTenantDatabases()
    expect(mod.getTenantPoolSize()).toBe(0)
    expect(mod.listTenantIds()).toEqual([])
    for (const m of endMocks) expect(m.end).toHaveBeenCalledTimes(1)
  })

  it('未注入默认库且无租户 URL 时抛出明确错误', async () => {
    const mod = await import('../src/tenant-router')
    expect(() => mod.getTenantDatabase('t9')).toThrow(/setDefaultDatabase/)
  })
})
