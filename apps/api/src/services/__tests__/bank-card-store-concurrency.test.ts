// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * BankCard 事务级 per-user 锁的单测夹具（2026-11-28）。
 *
 * 行为契约已从“进程内 Map 队列”升级为“数据库事务内 pg_advisory_xact_lock”：
 * 这里用 mock db.transaction + 进程内互斥模拟同一把事务锁，验证 store 的
 * 读-改-写确实被串行化；真实的跨连接/跨进程锁由 wallet-routes.real.test.ts 覆盖。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => {
  const store = new Map<string, string>()
  let tail: Promise<void> = Promise.resolve()
  let lockCalls = 0

  const tx = {
    execute: async (query: unknown) => {
      if (query !== 'upsert' && query !== 'delete') lockCalls += 1
      return []
    },
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () =>
            [...store.entries()].map(([composite, value]) => ({
              key: composite.slice(composite.lastIndexOf('|') + 1),
              value,
            })),
        }),
      }),
    }),
  }

  const acquire = async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const previous = tail
    tail = previous.then(() => gate)
    await previous
    return release
  }

  return {
    store,
    tx,
    get lockCalls() {
      return lockCalls
    },
    reset() {
      store.clear()
      tail = Promise.resolve()
      lockCalls = 0
    },
    acquire,
  }
})

vi.mock('../../db/index.js', () => ({
  db: {
    select: fixture.tx.select,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const release = await fixture.acquire()
      try {
        return await fn(fixture.tx)
      } finally {
        release()
      }
    },
  },
}))

vi.mock('../../db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { bankCards: 'bank_cards' },
  upsertUserPreference: async (
    userId: string,
    group: string,
    key: string,
    value: string | null,
    executor: { execute: (query: unknown) => Promise<unknown> },
  ) => {
    await executor.execute('upsert')
    fixture.store.set(`${userId}|${group}|${key}`, value ?? '')
  },
  deleteUserPreference: async (
    userId: string,
    group: string,
    key: string,
    executor: { execute: (query: unknown) => Promise<unknown> },
  ) => {
    await executor.execute('delete')
    return fixture.store.delete(`${userId}|${group}|${key}`)
  },
}))

import {
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
  fixture.reset()
})

describe('BankCard 事务级 per-user 锁', () => {
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
    expect(fixture.lockCalls).toBe(2)
  })

  it('并发新增两张默认卡后仍只有一张默认', async () => {
    const results = await Promise.all([
      addStoredBankCard('user-1', { ...input, number: '4111 1111 1111 1111', holder: '甲' }),
      addStoredBankCard('user-1', { ...input, number: '5555 5555 5555 4444', holder: '乙' }),
    ])
    expect(results).toHaveLength(2)

    const cards = await listStoredBankCards('user-1')
    expect(cards).toHaveLength(2)
    expect(cards.filter((card) => card.isDefault)).toHaveLength(1)
    expect(fixture.lockCalls).toBe(2)
  })
})
