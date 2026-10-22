// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 账号导入映射单测(2026-10-23 立)。
 *
 * 覆盖 importAccounts 的 providerCode==='qoder' 分支:
 * - 显式 uid(auth.v1.dat 的 user.id)+ ISO 8601 expiresAt → 原样落库
 * - user.id 兜底(无顶层 uid);全缺 → auto: 哈希 uid(不阻塞,诚实退化)
 * - refreshTokenExpiresAt 落 extraMetadata + refresh_expires_at 列
 * - Cosy 头族(machineToken 等)落 extraMetadata.cosy
 * - 缺 token → failed;name 兜底 nickname → phone
 *
 * 测试模式:vi.mock 掉 db / crypto(对齐 relay-codearts-import.test.ts),不发网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInsertValues } = vi.hoisted(() => ({
  mockInsertValues: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }),
    insert: () => ({ values: mockInsertValues.mockImplementation(() => Promise.resolve()) }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
  dbClient: {},
}))

// 直通式假加密:enc: 前缀,便于断言落库内容
vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

import { importAccounts } from '../src/services/relay-account-pool-service.js'

function lastInsert(): Record<string, unknown> {
  expect(mockInsertValues).toHaveBeenCalled()
  return mockInsertValues.mock.calls[mockInsertValues.mock.calls.length - 1]![0] as Record<
    string,
    unknown
  >
}

function extraOf(row: Record<string, unknown>): Record<string, unknown> {
  return (row['extraMetadata'] ?? {}) as Record<string, unknown>
}

beforeEach(() => {
  mockInsertValues.mockClear()
})

describe('Qoder 导入映射', () => {
  it('显式 uid + ISO expiresAt 原样落库(真机 auth.v1.dat 形态)', async () => {
    const r = await importAccounts('qoder', [
      {
        name: 'Qoder · 15330637579',
        token: 'dt-lHpaPB9p7cSvTrsA1FEAoaci',
        refreshToken: 'drt-7nB5JVVDDBFezao2OEdPvaey',
        uid: '01a16367-b9e2-7ac3-9943-8974fb16ca2d',
        expiresAt: '2026-11-21T11:38:26Z',
        refreshTokenExpiresAt: '2027-10-17T11:38:26Z',
        deviceId: 'dev-1',
        machineId: 'mac-1',
      },
    ])
    expect(r.imported).toBe(1)
    expect(r.items[0]!.uid).toBe('01a16367-b9e2-7ac3-9943-8974fb16ca2d')
    const row = lastInsert()
    expect(row['providerCode']).toBe('qoder')
    expect(row['uid']).toBe('01a16367-b9e2-7ac3-9943-8974fb16ca2d')
    expect((row['tokenExpiresAt'] as Date).toISOString()).toBe('2026-11-21T11:38:26.000Z')
    expect((row['refreshExpiresAt'] as Date).toISOString()).toBe('2027-10-17T11:38:26.000Z')
    expect(row['tokenEnc']).toBe('enc:dt-lHpaPB9p7cSvTrsA1FEAoaci')
    expect(row['refreshTokenEnc']).toBe('enc:drt-7nB5JVVDDBFezao2OEdPvaey')
    expect(row['deviceId']).toBe('dev-1')
    expect(row['machineId']).toBe('mac-1')
    expect(extraOf(row)['refreshTokenExpiresAt']).toBe('2027-10-17T11:38:26.000Z')
  })

  it('无顶层 uid 时按 user.id 兜底', async () => {
    const r = await importAccounts('qoder', [
      {
        token: 'dt-abc',
        user: { id: 'uid-from-user' },
        expiresAt: '2026-12-01T00:00:00+08:00',
      },
    ])
    expect(r.imported).toBe(1)
    expect(lastInsert()['uid']).toBe('uid-from-user')
    // +08:00 偏移按字面换算成 UTC
    expect((lastInsert()['tokenExpiresAt'] as Date).toISOString()).toBe('2026-11-30T16:00:00.000Z')
  })

  it('uid 与 expiresAt 全缺 → auto: 哈希 uid + 无过期(诚实退化,不阻塞)', async () => {
    const r = await importAccounts('qoder', [{ token: 'dt-opaque-only' }])
    expect(r.imported).toBe(1)
    const row = lastInsert()
    expect(row['uid']).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(row['tokenExpiresAt']).toBeNull()
  })

  it('epoch 秒 expiresAt 也认(与 checkin_qoder._parse_expiry_value 同判据)', async () => {
    const r = await importAccounts('qoder', [
      { token: 'dt-epoch', uid: 'u-epoch', expiresAt: 1769505600 },
    ])
    expect(r.imported).toBe(1)
    // 1769505600 = 2026-01-27T09:20:00Z
    expect((lastInsert()['tokenExpiresAt'] as Date).toISOString()).toBe('2026-01-27T09:20:00.000Z')
  })

  it('Cosy 设备头族落 extraMetadata.cosy', async () => {
    await importAccounts('qoder', [
      {
        token: 'dt-cosy',
        uid: 'u-cosy',
        machineToken: 'mt-1',
        machineCode: 'mc-1',
        machineType: 'mty-1',
        version: '1.2.3',
      },
    ])
    const cosy = extraOf(lastInsert())['cosy'] as Record<string, string>
    expect(cosy).toEqual({
      machineToken: 'mt-1',
      machineCode: 'mc-1',
      machineType: 'mty-1',
      version: '1.2.3',
    })
  })

  it('缺 token → failed(不落库)', async () => {
    const r = await importAccounts('qoder', [{ uid: 'u-no-token', name: 'x' }])
    expect(r.failed).toBe(1)
    expect(r.imported).toBe(0)
    expect(r.items[0]!.reason).toBe('Qoder 导入缺少 token')
    expect(mockInsertValues).not.toHaveBeenCalled()
  })

  it('name 缺省按 nickname → phone 兜底', async () => {
    await importAccounts('qoder', [{ token: 'dt-n', uid: 'u-n', nickname: 'nick6870552894' }])
    expect(lastInsert()['name']).toBe('nick6870552894')
    await importAccounts('qoder', [{ token: 'dt-p', uid: 'u-p', phone: '15330637579' }])
    expect(lastInsert()['name']).toBe('15330637579')
  })
})
