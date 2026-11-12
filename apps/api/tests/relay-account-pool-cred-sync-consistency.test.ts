// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-46 回归单测(2026-11-12 立):共享标记 / 手机号补全的签到推送载荷必须「凭证与版本同源」。
 *
 * 缺陷原状:行快照取自 dbRead(配 DATABASE_READ_REPLICA_URL 时连副本,可能是旧凭证),
 * 主库 UPDATE ... RETURNING 只取新 credVersion → 推送载荷 = 旧凭证 + 更高版本,
 * 击穿签到侧 incoming_ver <= existing_ver 防降级,把旧票写回成更高版本。
 *
 * 锁死契约:载荷的凭证与版本号都来自主库 UPDATE ... RETURNING 的整行,
 * 副本快照里的旧凭证绝不出现。测试模式:vi.mock db / crypto / checkin-sync / proxy-pool,
 * 不发网络不连库(对齐 relay-phone-complete.test.ts)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type PoolSyncResult = {
  ok: boolean
  pushed: number
  skipped: number
  failed: number
  failedIds: string[]
  error: string | null
}

const hoisted = vi.hoisted(() => ({
  /** dbRead 快照行(模拟读副本滞后,仍持旧凭证/旧版本) */
  readRows: [] as unknown[],
  /** 主库 UPDATE ... RETURNING 回写的整行(新凭证 + 新版本) */
  returningRows: [] as unknown[],
  pushPoolSync: vi.fn(
    async (_platform: string, accounts: unknown[]): Promise<PoolSyncResult> => ({
      ok: true,
      pushed: accounts.length,
      skipped: 0,
      failed: 0,
      failedIds: [] as string[],
      error: null,
    }),
  ),
  markCheckinSyncPending: vi.fn(async () => {}),
  clearCheckinSyncPending: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    update: () => ({
      set: () => ({
        where: () => ({ returning: () => Promise.resolve(hoisted.returningRows) }),
      }),
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(hoisted.readRows) }),
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
  checkinPlatformFor: (code: string) => (code === 'trae' ? 'trae' : null),
  buildPoolSyncAccount: (src: Record<string, unknown>) => src,
  extractCosy: () => null,
  pemFromSecrets: () => null,
  pushPoolSync: hoisted.pushPoolSync,
  markCheckinSyncPending: hoisted.markCheckinSyncPending,
  clearCheckinSyncPending: hoisted.clearCheckinSyncPending,
}))

vi.mock('../src/services/relay-proxy-pool.js', () => ({
  encryptAccountProxyUrl: (v: string | null) => v,
  resolveAccountProxyUrl: (v: string | null) => v,
}))

import { completeAccountPhone, setAccountShared } from '../src/services/relay-account-pool-service.js'

/** 行骨架:token/refreshToken/version 由各测试分别给新旧值。 */
function poolRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'row-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '180******69',
    tokenEnc: 'enc:OLD-token',
    refreshTokenEnc: 'enc:OLD-refresh',
    cookiesEnc: null,
    secretsEnc: null,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    isEnabled: true,
    sharedToOps: false,
    credVersion: 7,
    tokenExpiresAt: null,
    extraMetadata: {},
    ...overrides,
  }
}

beforeEach(() => {
  hoisted.readRows = []
  hoisted.returningRows = []
  hoisted.pushPoolSync.mockClear()
  hoisted.markCheckinSyncPending.mockClear()
  hoisted.clearCheckinSyncPending.mockClear()
})

describe('SDB-46 — 手机号补全的签到载荷与主库回写同源', () => {
  it('副本快照是旧凭证 → 载荷取 RETURNING 的新凭证 + 新版本,旧凭证不得出现', async () => {
    hoisted.readRows = [poolRow()]
    hoisted.returningRows = [
      poolRow({
        name: '18012345669',
        tokenEnc: 'enc:NEW-token',
        refreshTokenEnc: 'enc:NEW-refresh',
        credVersion: 8,
      }),
    ]
    const r = await completeAccountPhone('row-1', '18012345669')
    expect(r.code).toBe('ok')
    expect(r.checkinSync.pushed).toBe(1)

    const [platform, accounts] = hoisted.pushPoolSync.mock.calls[0]!
    expect(platform).toBe('trae')
    const acc = (accounts as Record<string, unknown>[])[0]!
    expect(acc.token).toBe('NEW-token')
    expect(acc.refreshToken).toBe('NEW-refresh')
    expect(acc.credVersion).toBe(8)
    // 旧凭证绝不能随更高版本推给签到侧(否则击穿防降级 CAS)
    expect(acc.token).not.toBe('OLD-token')
    expect(acc.refreshToken).not.toBe('OLD-refresh')
    expect(acc.name).toBe('18012345669')
  })
})

describe('SDB-46 — 共享标记的签到载荷与主库回写同源', () => {
  it('副本快照是旧凭证 → 载荷取 RETURNING 的新凭证 + 新版本,旧凭证不得出现', async () => {
    hoisted.readRows = [poolRow({ name: '18612345678', sharedToOps: false })]
    hoisted.returningRows = [
      poolRow({
        name: '18612345678',
        tokenEnc: 'enc:NEW-token',
        refreshTokenEnc: 'enc:NEW-refresh',
        credVersion: 9,
        sharedToOps: true,
      }),
    ]
    const r = await setAccountShared('row-1', true)
    expect(r.code).toBe('ok')
    expect(r.sharedToOps).toBe(true)
    expect(r.checkinSync.pushed).toBe(1)

    const [, accounts] = hoisted.pushPoolSync.mock.calls[0]!
    const acc = (accounts as Record<string, unknown>[])[0]!
    expect(acc.token).toBe('NEW-token')
    expect(acc.refreshToken).toBe('NEW-refresh')
    expect(acc.credVersion).toBe(9)
    expect(acc.token).not.toBe('OLD-token')
    expect(acc.refreshToken).not.toBe('OLD-refresh')
  })
})
