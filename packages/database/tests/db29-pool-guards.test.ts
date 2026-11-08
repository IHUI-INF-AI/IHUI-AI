// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-29 夹具：四个连接池必须带 statement_timeout / connect_timeout /
 * idle_timeout / max_lifetime 护栏。
 *
 * 不连真实库：postgres 与 drizzle 均被 mock，只检查建池时实际交给 postgres()
 * 的选项；受控出口 scoped 池在 apps/api 里，用源码接线断言（它无法在纯单测里
 * 无依赖地实例化）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { postgresCalls } = vi.hoisted(() => ({
  postgresCalls: [] as Array<{ url: string; options: Record<string, unknown> }>,
}))

vi.mock('postgres', () => ({
  default: vi.fn((url: string, options: Record<string, unknown>) => {
    postgresCalls.push({ url, options: options ?? {} })
    return { end: vi.fn(async () => undefined) }
  }),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({ __drizzle: true })),
}))

import { buildPoolOptions } from '../src/pool-options.js'
import { createDb } from '../src/client.js'
import { createReadWriteDb } from '../src/read-replica.js'

function expectGuards(options: Record<string, unknown>): void {
  expect(options.connect_timeout).toBe(5)
  expect(options.idle_timeout).toBe(30)
  expect(options.max_lifetime).toBe(1800)
  expect(options.statement_timeout).toBe(30_000)
  expect(options.prepare).toBe(false)
}

describe('DB-29 连接池超时护栏', () => {
  beforeEach(() => {
    postgresCalls.length = 0
    delete process.env.DB_POOL_MAX
    delete process.env.DB_STATEMENT_TIMEOUT_MS
    delete process.env.TENANT_T9_DATABASE_URL
  })

  afterEach(() => {
    delete process.env.DB_POOL_MAX
    delete process.env.DB_STATEMENT_TIMEOUT_MS
    delete process.env.TENANT_T9_DATABASE_URL
  })

  it('buildPoolOptions 默认带齐四道护栏', () => {
    expectGuards(buildPoolOptions())
  })

  it('createDb 建池时把护栏传给 postgres()', () => {
    createDb('postgres://localhost/main')
    expect(postgresCalls).toHaveLength(1)
    expectGuards(postgresCalls[0].options)
  })

  it('createReadWriteDb 的 writer 与每个 replica 都带护栏', () => {
    createReadWriteDb({
      url: 'postgres://localhost/writer',
      replicas: [{ id: 'r1', url: 'postgres://localhost/r1', priority: 1 }],
    })
    expect(postgresCalls).toHaveLength(2)
    for (const call of postgresCalls) expectGuards(call.options)
  })

  it('租户池同样带护栏', async () => {
    vi.resetModules()
    process.env.TENANT_T9_DATABASE_URL = 'postgres://localhost/t9'
    const mod = await import('../src/tenant-router.js')
    mod.setDefaultDatabase({} as never)
    mod.getTenantDatabase('t9')
    const tenantCall = postgresCalls.at(-1)
    expect(tenantCall).toBeDefined()
    expectGuards(tenantCall!.options)
  })

  it('受控出口 scoped 池走同一护栏构造器（源码接线断言）', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../apps/api/src/db/index.ts', import.meta.url)),
      'utf8',
    )
    expect(source).toMatch(/buildPoolOptions\(\s*\{\s*max:\s*SCOPED_POOL_MAX/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
