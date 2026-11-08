// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-30 夹具：createReadWriteDb 必须把主池/副本池句柄暴露成 close()，
 * 关闭幂等且逐个 .end()；apps/api 的 onClose 必须 await 这个 close。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { clients } = vi.hoisted(() => ({
  clients: [] as Array<{ end: ReturnType<typeof vi.fn> }>,
}))

vi.mock('postgres', () => ({
  default: vi.fn(() => {
    const client = { end: vi.fn(async () => undefined) }
    clients.push(client)
    return client
  }),
}))

vi.mock('drizzle-orm/postgres-js', () => ({
  drizzle: vi.fn(() => ({ __drizzle: true })),
}))

import { createReadWriteDb } from '../src/read-replica.js'

describe('DB-30 池关闭钩子', () => {
  beforeEach(() => {
    clients.length = 0
  })

  it('createReadWriteDb 返回 close()，关闭 writer 与全部副本各一次', async () => {
    const handle = createReadWriteDb({
      url: 'postgres://localhost/writer',
      replicas: [
        { id: 'r1', url: 'postgres://localhost/r1', priority: 2 },
        { id: 'r2', url: 'postgres://localhost/r2', priority: 1 },
      ],
    })
    expect(typeof handle.close).toBe('function')
    expect(clients).toHaveLength(3)

    await handle.close()
    for (const client of clients) expect(client.end).toHaveBeenCalledTimes(1)

    // 幂等：重复关闭不再 end
    await handle.close()
    for (const client of clients) expect(client.end).toHaveBeenCalledTimes(1)
  })

  it('无副本时只关主池', async () => {
    const handle = createReadWriteDb({ url: 'postgres://localhost/writer' })
    await handle.close()
    expect(clients).toHaveLength(1)
    expect(clients[0].end).toHaveBeenCalledTimes(1)
  })

  it('apps/api onClose 必须 await closeDbPools（源码接线断言）', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../../apps/api/src/db/index.ts', import.meta.url)),
      'utf8',
    )
    expect(source).toMatch(/export\s+async\s+function\s+closeDbPools/)
    expect(source).toMatch(/await\s+closeDbPools\(\)/)
  })
})
