// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池凭证回写 CAS 单测(applied / conflict / not_found + 过期时刻三形态)。
 * db 链式 mock(select 按序供数、update 捕获 set 值);drizzle and/eq 用真实现。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({
  selectResults: [] as unknown[],
  updateResults: [] as unknown[][],
  updateSets: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (store.selectResults.length > 0 ? store.selectResults.shift() : []),
        }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        store.updateSets.push(values)
        return {
          where: () => ({
            returning: async () =>
              store.updateResults.length > 0 ? (store.updateResults.shift() ?? []) : [],
          }),
        }
      },
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (store.selectResults.length > 0 ? store.selectResults.shift() : []),
        }),
      }),
    }),
  },
}))

vi.mock('../../utils/crypto.js', () => ({
  encryptField: (v: string) => `enc:${v}`,
  decryptField: (v: string) => v.replace(/^enc:/, ''),
}))

// drizzle-orm 用真实现(and/eq 对任意列对象运行期可构造);@ihui/database 只提供列占位
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))

import { applyPoolCredentialWriteback, parseExpiresAt } from '../relay-account-pool-credential.js'

beforeEach(() => {
  store.selectResults = []
  store.updateResults = []
  store.updateSets = []
})

describe('parseExpiresAt', () => {
  it('epoch 秒(可为 float 字符串)→ Date', () => {
    expect(parseExpiresAt('1792000000')?.getTime()).toBe(1792000000000)
    expect(parseExpiresAt('1792000000.5')?.getTime()).toBe(1792000000500)
  })
  it('epoch 毫秒(>1e12)不重复乘', () => {
    expect(parseExpiresAt('1792000000000')?.getTime()).toBe(1792000000000)
  })
  it('ISO 8601 正常解析', () => {
    expect(parseExpiresAt('2026-10-23T12:00:00.000Z')?.toISOString()).toBe(
      '2026-10-23T12:00:00.000Z',
    )
  })
  it.each([
    ['null', null],
    ['空串', ''],
    ['空白串', '   '],
    ['零(哨兵缺失)', '0'],
    ['负 epoch(qoder 侧缺失哨兵)', '-1'],
    ['坏 ISO', 'not-a-date'],
  ])('无法解析 → null(%s)', (_label, raw) => {
    expect(parseExpiresAt(raw as string | null)).toBeNull()
  })
})

describe('applyPoolCredentialWriteback', () => {
  it('applied:版本匹配 → CAS 更新 +1,凭证加密落库,返回新版本', async () => {
    store.selectResults.push([{ credVersion: 7 }])
    store.updateResults.push([{ credVersion: 8 }])
    const r = await applyPoolCredentialWriteback({
      poolAccountId: 'pool-1',
      baseVersion: 7,
      refreshToken: 'ref-new',
      expiresAt: '1792000000',
    })
    expect(r).toEqual({ status: 'applied', credVersion: 8 })
    expect(store.updateSets).toHaveLength(1)
    const patch = store.updateSets[0]!
    expect(patch.credVersion).toBe(8)
    expect(patch.refreshTokenEnc).toBe('enc:ref-new')
    expect(patch.tokenExpiresAt).toBeInstanceOf(Date)
    expect((patch.tokenExpiresAt as Date).getTime()).toBe(1792000000000)
    expect(patch.lastRefreshAt).toBeInstanceOf(Date)
    expect(patch.updatedAt).toBeInstanceOf(Date)
  })

  it('applied:refreshToken/expiresAt 缺省(undefined)→ 不动对应列', async () => {
    store.selectResults.push([{ credVersion: 3 }])
    store.updateResults.push([{ credVersion: 4 }])
    const r = await applyPoolCredentialWriteback({ poolAccountId: 'p', baseVersion: 3 })
    expect(r.status).toBe('applied')
    const patch = store.updateSets[0]!
    expect('refreshTokenEnc' in patch).toBe(false)
    expect('tokenExpiresAt' in patch).toBe(false)
  })

  it('applied:refreshToken 显式 null → 列清空', async () => {
    store.selectResults.push([{ credVersion: 1 }])
    store.updateResults.push([{ credVersion: 2 }])
    await applyPoolCredentialWriteback({ poolAccountId: 'p', baseVersion: 1, refreshToken: null })
    expect(store.updateSets[0]!.refreshTokenEnc).toBeNull()
  })

  it('conflict:版本不匹配 → 丢弃,带号池当前版本', async () => {
    store.selectResults.push([{ credVersion: 9 }])
    const r = await applyPoolCredentialWriteback({
      poolAccountId: 'pool-1',
      baseVersion: 7,
      refreshToken: 'ref-stale',
    })
    expect(r).toEqual({ status: 'conflict', currentVersion: 9 })
    expect(store.updateSets).toHaveLength(0) // 不写
  })

  it('conflict:CAS 0 行(读后并发写)→ 再查现值报 conflict', async () => {
    store.selectResults.push([{ credVersion: 7 }]) // 首查匹配
    store.updateResults.push([]) // CAS 更新 0 行
    store.selectResults.push([{ credVersion: 10 }]) // 再查现值
    const r = await applyPoolCredentialWriteback({
      poolAccountId: 'pool-1',
      baseVersion: 7,
      refreshToken: 'ref-new',
    })
    expect(r).toEqual({ status: 'conflict', currentVersion: 10 })
    expect(store.selectResults).toHaveLength(0) // 两次 select 都消费了
  })

  it('not_found:号池行不存在', async () => {
    store.selectResults.push([])
    const r = await applyPoolCredentialWriteback({
      poolAccountId: 'gone',
      baseVersion: 1,
      refreshToken: 'x',
    })
    expect(r).toEqual({ status: 'not_found' })
    expect(store.updateSets).toHaveLength(0)
  })

  it('applied:expiresAt 为 null → tokenExpiresAt 清空', async () => {
    store.selectResults.push([{ credVersion: 5 }])
    store.updateResults.push([{ credVersion: 6 }])
    await applyPoolCredentialWriteback({ poolAccountId: 'p', baseVersion: 5, expiresAt: null })
    expect(store.updateSets[0]!.tokenExpiresAt).toBeNull()
  })
})
