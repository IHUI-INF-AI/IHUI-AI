// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O72#4 号池导入设备指纹碰撞报告用例(2026-10-28 立)。
 *
 * 立因:同一真实客户端导出 N 个账号批量导入 ⇒ N 行共用同一 device_id(跨账号直接
 * 关联的暴露面),而导入面此前零信号。整改口径 = **报告不改写**(点名碰撞行供运营区分;
 * 不加迁移/唯一索引,存量池硬失败需机主签字)。
 * 判据直用生产实现(§22c):relay-account-pool-service 的 __test__.computeDeviceCollisions。
 * 测试模式:vi.mock db/crypto/签到同步(对齐 relay-account-import-preserve-refresh.test.ts),零真实 IO。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  // 主查(existing 行)固定返回空 = 全部走新增通道
  mockSelectRows: [] as Array<Record<string, unknown>>,
  // dbRead 的池面碰撞查询返回行(可注入"池内既有同设备行")
  mockPoolDeviceRows: [] as Array<{ uid: string; deviceId: string | null }>,
  mockInsertValues: [] as Array<Record<string, unknown>>,
  dbReadSelectCalls: 0,
  dbReadThrows: false,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(hoisted.mockSelectRows) }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        hoisted.mockInsertValues.push(values)
        return {
          returning: () =>
            Promise.resolve([{ id: `row-${hoisted.mockInsertValues.length}`, credVersion: 1 }]),
        }
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{ id: 'row-x', credVersion: 2 }]) }),
      }),
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => {
          hoisted.dbReadSelectCalls++
          if (hoisted.dbReadThrows) return Promise.reject(new Error('boom: 池面查询失败'))
          return Promise.resolve(hoisted.mockPoolDeviceRows)
        },
      }),
    }),
  },
  dbClient: {},
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

vi.mock('../src/services/relay-account-pool-checkin-sync.js', () => ({
  buildPoolSyncAccount: (x: unknown) => x,
  checkinPlatformFor: () => null,
  extractCosy: () => null,
  pushPoolSync: async () => ({ ok: true, pushed: 0, skipped: 0, pending: 0, error: null }),
  markCheckinSyncPending: async () => {},
  clearCheckinSyncPending: async () => {},
}))

import {
  importAccounts,
  __test__ as poolServiceTest,
} from '../src/services/relay-account-pool-service.js'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

const FUTURE = Math.floor(Date.UTC(2027, 0, 1) / 1000)

beforeEach(() => {
  hoisted.mockSelectRows.length = 0
  hoisted.mockPoolDeviceRows.length = 0
  hoisted.mockInsertValues.length = 0
  hoisted.dbReadSelectCalls = 0
  hoisted.dbReadThrows = false
})

describe('__test__.computeDeviceCollisions 纯判据', () => {
  it('同 deviceId 多 uid ⇒ 点名;单 uid 不算碰撞', () => {
    const out = poolServiceTest.computeDeviceCollisions([
      { uid: 'u1', deviceId: 'dev-shared' },
      { uid: 'u2', deviceId: 'dev-shared' },
      { uid: 'u3', deviceId: 'dev-alone' },
    ])
    expect(out).toEqual([{ deviceId: 'dev-shared', uids: ['u1', 'u2'] }])
  })

  it('空/纯空白 deviceId 不参与;同 uid 重复出现只算一枚(批内+池面并集去重)', () => {
    const out = poolServiceTest.computeDeviceCollisions([
      { uid: 'u1', deviceId: null },
      { uid: 'u2', deviceId: '  ' },
      { uid: 'u1', deviceId: 'dev-shared' },
      { uid: 'u1', deviceId: 'dev-shared' },
      { uid: 'u2', deviceId: 'dev-shared' },
    ])
    expect(out).toEqual([{ deviceId: 'dev-shared', uids: ['u1', 'u2'] }])
  })
})

describe('importAccounts 设备指纹碰撞报告(只报告不改写)', () => {
  it('同批两账号共用 deviceId ⇒ deviceCollisions 点名两枚 uid,scope=checked', async () => {
    const r = await importAccounts('trae', [
      { name: 'A', token: jwt({ sub: 'u1', exp: FUTURE }), deviceId: 'dev-shared' },
      { name: 'B', token: jwt({ sub: 'u2', exp: FUTURE }), deviceId: 'dev-shared' },
    ])
    expect(r.imported).toBe(2)
    expect(r.deviceCollisionScope).toBe('checked')
    expect(r.deviceCollisions).toEqual([{ deviceId: 'dev-shared', uids: ['u1', 'u2'] }])
    // 只报告不改写:落库载荷里 deviceId 原样逐字节保留,没有被动过
    expect(hoisted.mockInsertValues.map((v) => v['deviceId'])).toEqual(['dev-shared', 'dev-shared'])
  })

  it('池内既有第三方行同 deviceId ⇒ 一并点名(跨批信号)', async () => {
    hoisted.mockPoolDeviceRows.push({ uid: 'legacy-9', deviceId: 'dev-shared' })
    const r = await importAccounts('trae', [
      { name: 'A', token: jwt({ sub: 'u1', exp: FUTURE }), deviceId: 'dev-shared' },
      { name: 'B', token: jwt({ sub: 'u2', exp: FUTURE }), deviceId: 'dev-shared' },
    ])
    expect(r.deviceCollisions).toEqual([{ deviceId: 'dev-shared', uids: ['legacy-9', 'u1', 'u2'] }])
  })

  it('本批无任何 deviceId ⇒ scope=none,池面一次查询都不发起', async () => {
    const r = await importAccounts('trae', [
      { name: 'A', token: jwt({ sub: 'u1', exp: FUTURE }) },
      { name: 'B', token: jwt({ sub: 'u2', exp: FUTURE }) },
    ])
    expect(r.deviceCollisionScope).toBe('none')
    expect(r.deviceCollisions).toEqual([])
    expect(hoisted.dbReadSelectCalls).toBe(0)
  })

  it('deviceId 各不相同 ⇒ 无碰撞但 scope 仍为 checked(判过,不是没判)', async () => {
    const r = await importAccounts('trae', [
      { name: 'A', token: jwt({ sub: 'u1', exp: FUTURE }), deviceId: 'dev-1' },
      { name: 'B', token: jwt({ sub: 'u2', exp: FUTURE }), deviceId: 'dev-2' },
    ])
    expect(r.deviceCollisions).toEqual([])
    expect(r.deviceCollisionScope).toBe('checked')
  })

  it('池面查询失败 ⇒ scope=unjudged(§0.3 不记绿),批内碰撞照样报,导入本身不受累', async () => {
    hoisted.dbReadThrows = true
    const r = await importAccounts('trae', [
      { name: 'A', token: jwt({ sub: 'u1', exp: FUTURE }), deviceId: 'dev-shared' },
      { name: 'B', token: jwt({ sub: 'u2', exp: FUTURE }), deviceId: 'dev-shared' },
    ])
    expect(r.imported).toBe(2)
    expect(r.deviceCollisionScope).toBe('unjudged')
    expect(r.deviceCollisions).toEqual([{ deviceId: 'dev-shared', uids: ['u1', 'u2'] }])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
