// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-269 回归锁(2026-11-08)。
 *
 * 缺陷:注销擦除清单漏掉 user_emails / security_logs / devices / device_pair_codes /
 *      device_tasks,且 users 行未清 gender/birthday;单表失败还被静默吞掉。
 * 判据:5 张表都进入删除;users SET 含 gender=0/birthday=null;失败表名回传 failedTables。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleted: [] as string[],
  setValues: undefined as unknown,
  failOn: '',
}))

vi.mock('@ihui/database', () => {
  const stub = new Proxy(
    {},
    {
      has: () => true,
      get: (_t, key) => {
        if (typeof key !== 'string') return undefined
        const name = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        return {
          __table: name,
          id: `${key}.id`,
          userId: `${key}.userId`,
          userUuid: `${key}.userUuid`,
          createdBy: `${key}.createdBy`,
        }
      },
    },
  )
  return stub
})
vi.mock('../src/db/index.js', () => ({
  db: {
    delete: (table: { __table: string }) => ({
      where: async () => {
        if (table.__table === mocks.failOn) throw new Error('table unavailable')
        mocks.deleted.push(table.__table)
      },
    }),
    update: () => ({
      set: (vals: unknown) => {
        mocks.setValues = vals
        return { where: () => ({ returning: async () => [{ id: 'u1' }] }) }
      },
    }),
  },
}))
vi.mock('../src/db/queries.js', () => ({
  revokeAllUserRefreshTokens: vi.fn(async () => undefined),
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('drizzle-orm', () => ({
  eq: (col: unknown, val: unknown) => ({ col, val }),
}))

import { purgeUserPii } from '../src/services/purge-user-pii.js'

beforeEach(() => {
  mocks.deleted.length = 0
  mocks.setValues = undefined
  mocks.failOn = ''
})

describe('F-269 注销擦除补表', () => {
  it('删除 user_emails/security_logs/device_* /devices 五张表', async () => {
    const result = await purgeUserPii('u1')
    expect(result.failedTables).toEqual([])
    for (const label of [
      'user_emails',
      'security_logs',
      'device_tasks',
      'device_pair_codes',
      'devices',
    ]) {
      expect(mocks.deleted).toContain(label)
    }
  })

  it('users 主行匿名化包含 gender=0 与 birthday=null', async () => {
    await purgeUserPii('u1')
    expect(mocks.setValues).toMatchObject({ gender: 0, birthday: null, status: 3 })
  })

  it('单表失败不阻断整体,并把表名回传 failedTables', async () => {
    mocks.failOn = 'security_logs'
    const result = await purgeUserPii('u1')
    expect(result.failedTables).toEqual(['security_logs'])
    expect(mocks.deleted).toContain('devices')
    expect(result.userRowAnonymized).toBe(true)
  })
})
