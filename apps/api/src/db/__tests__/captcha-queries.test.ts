// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * captcha-queries 的默认面单测（门 250 缺口示范）。
 *
 * 路径 A：把 `src/db/index.ts` 换成链式替身 —— 该模块只用到
 * insert().values() / select().from().where().limit() / delete().where()，
 * 无需真实连接。断言不靠"不抛错"：
 *  · 条件语义：半 mock drizzle-orm 的 eq/lt，直接断言传给它们的列对象与参数；
 *  · 返回值语义：给定替身行集，断言 findCaptcha 取首行、空集返回 undefined；
 *  · 默认值语义：saveCaptcha 计算 expiresAt = now + 5min，cleanup 用当前时间。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

const mocks = vi.hoisted(() => {
  const state = {
    insertTable: undefined as unknown,
    insertValues: undefined as unknown,
    selectTable: undefined as unknown,
    selectWhere: undefined as unknown,
    selectLimit: undefined as unknown,
    selectRows: [] as unknown[],
    deleteTable: undefined as unknown,
    deleteWhere: undefined as unknown,
  }

  const reset = (): void => {
    state.insertTable = undefined
    state.insertValues = undefined
    state.selectTable = undefined
    state.selectWhere = undefined
    state.selectLimit = undefined
    state.selectRows = []
    state.deleteTable = undefined
    state.deleteWhere = undefined
  }

  function select() {
    return {
      from(table: unknown) {
        state.selectTable = table
        return {
          where(cond: unknown) {
            state.selectWhere = cond
            // 与 drizzle 一致：where 返回可继续 .limit() 的链对象（本身也可被 await）。
            return {
              async limit(n: number) {
                state.selectLimit = n
                return state.selectRows
              },
              then(resolve: (value: unknown[]) => unknown) {
                return Promise.resolve(state.selectRows).then(resolve)
              },
            }
          },
        }
      },
    }
  }

  function insert(table: unknown) {
    state.insertTable = table
    return {
      async values(values: unknown) {
        state.insertValues = values
        return []
      },
    }
  }

  function remove(table: unknown) {
    state.deleteTable = table
    return {
      async where(cond: unknown) {
        state.deleteWhere = cond
        return []
      },
    }
  }

  return { state, reset, select, insert, remove }
})

vi.mock('../index.js', () => ({
  db: {
    select: () => mocks.select(),
    insert: (table: unknown) => mocks.insert(table),
    delete: (table: unknown) => mocks.remove(table),
  },
  dbRead: {
    select: () => mocks.select(),
  },
}))

// 半 mock：保留 drizzle-orm 全部实现，只把 eq/lt 包成 spy 以便断言条件构造。
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return {
    ...actual,
    eq: vi.fn(actual.eq),
    lt: vi.fn(actual.lt),
  }
})

import { eq, lt } from 'drizzle-orm'
import { captchas } from '@ihui/database'
import {
  saveCaptcha,
  findCaptcha,
  deleteCaptcha,
  cleanupExpiredCaptchas,
} from '../captcha-queries.js'

const eqMock = vi.mocked(eq)
const ltMock = vi.mocked(lt)

beforeEach(() => {
  mocks.reset()
  eqMock.mockClear()
  ltMock.mockClear()
})

describe('saveCaptcha', () => {
  it('向 captchas 表插入 key/code，且 expiresAt 默认为当前时间 + 5 分钟', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-28T00:00:00.000Z'))
      await saveCaptcha('login:13800000000', '123456')

      expect(mocks.state.insertTable).toBe(captchas)
      expect(mocks.state.insertValues).toEqual({
        captchaKey: 'login:13800000000',
        code: '123456',
        expiresAt: new Date('2026-10-28T00:05:00.000Z'),
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('expiresAt 是一个 Date，且晚于「调用时刻 + 4 分 58 秒」', async () => {
    const before = Date.now()
    await saveCaptcha('k', 'c')
    const inserted = mocks.state.insertValues as { expiresAt: Date }
    expect(inserted.expiresAt).toBeInstanceOf(Date)
    expect(inserted.expiresAt.getTime()).toBeGreaterThan(before + 298_000)
    expect(inserted.expiresAt.getTime()).toBeLessThan(before + 302_000)
  })
})

describe('findCaptcha', () => {
  it('按 captchaKey 等值过滤 + limit(1)，并返回结果集首行', async () => {
    const row = { captchaKey: 'k1', code: '999999' }
    mocks.state.selectRows = [row, { captchaKey: 'k2', code: '000000' }]

    const found = await findCaptcha('k1')

    expect(mocks.state.selectTable).toBe(captchas)
    expect(mocks.state.selectLimit).toBe(1)
    expect(eqMock).toHaveBeenCalledTimes(1)
    expect(eqMock.mock.calls[0]?.[0]).toBe(captchas.captchaKey)
    expect(eqMock.mock.calls[0]?.[1]).toBe('k1')
    expect(mocks.state.selectWhere).toBe(eqMock.mock.results[0]?.value)
    expect(found).toBe(row)
  })

  it('结果集为空时返回 undefined（而非 null / 抛错）', async () => {
    mocks.state.selectRows = []
    await expect(findCaptcha('missing')).resolves.toBeUndefined()
  })
})

describe('deleteCaptcha', () => {
  it('对 captchas 按 captchaKey 等值删除', async () => {
    await deleteCaptcha('k1')

    expect(mocks.state.deleteTable).toBe(captchas)
    expect(eqMock).toHaveBeenCalledTimes(1)
    expect(eqMock.mock.calls[0]?.[0]).toBe(captchas.captchaKey)
    expect(eqMock.mock.calls[0]?.[1]).toBe('k1')
    expect(mocks.state.deleteWhere).toBe(eqMock.mock.results[0]?.value)
  })
})

describe('cleanupExpiredCaptchas', () => {
  it('对 captchas 按 expiresAt < 现在 删除（传入当前时刻）', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-10-28T01:02:03.000Z'))
      await cleanupExpiredCaptchas()

      expect(mocks.state.deleteTable).toBe(captchas)
      expect(ltMock).toHaveBeenCalledTimes(1)
      expect(ltMock.mock.calls[0]?.[0]).toBe(captchas.expiresAt)
      expect(ltMock.mock.calls[0]?.[1]).toEqual(new Date('2026-10-28T01:02:03.000Z'))
      expect(mocks.state.deleteWhere).toBe(ltMock.mock.results[0]?.value)
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
