// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BankCard 并发夹具（2026-11-27）。
 *
 * 只验证进程内 per-user 串行队列：同一用户两个并发 POST 不能都先读到空列表。
 * 跨进程/多实例仍需要数据库唯一键，不在本夹具的承诺范围。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({
  store: new Map<string, string>(),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
}))

vi.mock('../../db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { bankCards: 'bank_cards' },
  findUserPreferences: async (userId: string, group?: string) => {
    await fixture.sleep(8)
    const prefix = `${userId}|${group ?? ''}|`
    const list = [...fixture.store.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => ({ key: key.slice(prefix.length), value }))
    return { list, total: list.length }
  },
  upsertUserPreference: async (userId: string, group: string, key: string, value: string | null) => {
    await fixture.sleep(8)
    fixture.store.set(`${userId}|${group}|${key}`, value ?? '')
  },
  deleteUserPreference: async (userId: string, group: string, key: string) => {
    await fixture.sleep(8)
    return fixture.store.delete(`${userId}|${group}|${key}`)
  },
}))

import {
  BANK_CARD_GROUP,
  BankCardStoreError,
  addStoredBankCard,
  listStoredBankCards,
} from '../bank-card-store.js'

const input = {
  number: '4111 1111 1111 1111',
  holder: '张三',
  bankName: '测试银行',
  isDefault: true,
}

beforeEach(() => {
  fixture.store.clear()
})

describe('BankCard per-user 串行队列', () => {
  it('同一用户并发新增同一卡号只成功一张，另一张报 exists', async () => {
    const results = await Promise.allSettled([
      addStoredBankCard('user-1', input),
      addStoredBankCard('user-1', input),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
    expect(rejected.reason).toBeInstanceOf(BankCardStoreError)
    expect((rejected.reason as BankCardStoreError).code).toBe('exists')

    const cards = await listStoredBankCards('user-1')
    expect(cards).toHaveLength(1)
    expect(cards[0]?.number).toBe('4111111111111111')
    expect(cards[0]?.isDefault).toBe(true)
    expect([...fixture.store.keys()].filter((key) => key.startsWith(`user-1|${BANK_CARD_GROUP}|`))).toHaveLength(1)
  })

  it('不同用户不互相阻塞', async () => {
    const results = await Promise.all([
      addStoredBankCard('user-a', input),
      addStoredBankCard('user-b', { ...input, number: '5555 5555 5555 4444' }),
    ])
    expect(results.map((card) => card.isDefault)).toEqual([true, true])
    expect(await listStoredBankCards('user-a')).toHaveLength(1)
    expect(await listStoredBankCards('user-b')).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
