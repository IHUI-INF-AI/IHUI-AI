// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-269 注销 PII 擦除夹具。
 *
 * 改前:多邮箱/安全日志/设备/配对码/设备任务不在清理清单;单表失败只 warn,接口仍
 * 返回「已删除」;users 匿名化不落 gender/birthday。改后:五表纳入清单、整体事务、
 * 任一表失败抛 PurgeUserPiiError 且不留任何半截删除、gender=0/birthday=null。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({
  deletes: [] as string[],
  updates: [] as Array<Record<string, unknown>>,
  failTable: '',
  revoked: 0,
  failRevoke: false,
  reset() {
    this.deletes.length = 0
    this.updates.length = 0
    this.failTable = ''
    this.revoked = 0
    this.failRevoke = false
  },
}))

vi.mock('../../db/queries.js', () => ({
  revokeAllUserRefreshTokens: vi.fn(async () => {
    if (state.failRevoke) throw new Error('redis down')
    state.revoked++
  }),
}))

vi.mock('../../db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  type Buffer = { deletes: string[]; updates: Array<Record<string, unknown>> }

  const makeDb = (buffer: Buffer) => ({
    // SDB-29:注销前先查该用户的 Key / 分享 id 再逐条吊销；本夹具无凭据行，返回空集。
    select: () => ({ from: () => ({ where: async () => [] }) }),
    delete: (table: unknown) => ({
      where: async () => {
        const name = getTableName(table as Parameters<typeof getTableName>[0])
        if (state.failTable === name) throw new Error(`delete ${name} failed`)
        buffer.deletes.push(name)
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            buffer.updates.push(values)
            return [{ id: 'u1' }]
          },
        }),
      }),
    }),
  })

  const rootBuffer: Buffer = {
    get deletes() {
      return state.deletes
    },
    get updates() {
      return state.updates
    },
  } as Buffer

  const db = {
    ...makeDb(rootBuffer),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const txBuffer: Buffer = { deletes: [], updates: [] }
      const result = await fn(makeDb(txBuffer))
      state.deletes.push(...txBuffer.deletes)
      state.updates.push(...txBuffer.updates)
      return result
    },
  }
  return { db, dbRead: db }
})

import { purgeUserPii, PurgeUserPiiError } from '../purge-user-pii.js'

describe('F-269 注销擦除', () => {
  beforeEach(() => state.reset())

  it('补齐五类 PII 表,且 gender/birthday 一并匿名化', async () => {
    const result = await purgeUserPii('u1')
    for (const name of [
      'user_emails',
      'security_logs',
      'devices',
      'device_pair_codes',
      'device_tasks',
    ]) {
      expect(state.deletes).toContain(name)
    }
    expect(state.updates).toHaveLength(1)
    expect(state.updates[0]!.gender).toBe(0)
    expect(state.updates[0]!.birthday).toBeNull()
    expect(state.updates[0]!.status).toBe(3)
    expect(result.userRowAnonymized).toBe(true)
    expect(state.revoked).toBe(1)
  })

  it('中途单表失败 → 抛错并整体回滚,不再静默「已删除」', async () => {
    state.failTable = 'security_logs'
    await expect(purgeUserPii('u1')).rejects.toBeInstanceOf(PurgeUserPiiError)
    expect(state.deletes).toEqual([])
    expect(state.updates).toEqual([])
    expect(state.revoked).toBe(0)
  })

  it('refresh token 吊销失败必须上抛', async () => {
    state.failRevoke = true
    await expect(purgeUserPii('u1')).rejects.toMatchObject({ stage: 'refresh_tokens' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
