// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-31 夹具：池上限必须可配置（DB_POOL_MAX），不再写死 40；
 * 非法/非正数回退默认 40，显式 config.max 优先。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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

import { resolvePoolMax, buildPoolOptions } from '../src/pool-options.js'
import { createDb } from '../src/client.js'
import { createReadWriteDb } from '../src/read-replica.js'

describe('DB-31 池上限可配置', () => {
  beforeEach(() => {
    postgresCalls.length = 0
    delete process.env.DB_POOL_MAX
  })

  afterEach(() => {
    delete process.env.DB_POOL_MAX
  })

  it('默认 40，DB_POOL_MAX 覆盖', () => {
    expect(resolvePoolMax()).toBe(40)
    process.env.DB_POOL_MAX = '12'
    expect(resolvePoolMax()).toBe(12)
    expect(buildPoolOptions().max).toBe(12)
  })

  it('非法/非正数回退默认 40', () => {
    process.env.DB_POOL_MAX = 'abc'
    expect(resolvePoolMax()).toBe(40)
    process.env.DB_POOL_MAX = '0'
    expect(resolvePoolMax()).toBe(40)
    process.env.DB_POOL_MAX = '-3'
    expect(resolvePoolMax()).toBe(40)
  })

  it('显式 config.max 优先于 env', () => {
    process.env.DB_POOL_MAX = '12'
    expect(resolvePoolMax(20)).toBe(20)
  })

  it('createDb / createReadWriteDb 实际建池使用 env 上限', () => {
    process.env.DB_POOL_MAX = '12'
    createDb('postgres://localhost/main')
    createReadWriteDb({ url: 'postgres://localhost/writer' })
    expect(postgresCalls).toHaveLength(2)
    for (const call of postgresCalls) expect(call.options.max).toBe(12)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
