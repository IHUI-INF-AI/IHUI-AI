// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 号池手机号补全功能单测(2026-10-28 立)。
 *
 * 锁死的行为契约:
 * 1. completeAccountPhone:全号形态校验;掩码名必须前3后2吻合才归位(防张冠李戴);
 *    现名已是全号且不一致 → already_full;改名 = name + cred_version+1 + phoneMask 归档;
 * 2. 签到传播:改名必须带新版本号重推(否则被签到侧防降级 CAS 吞掉);推送失败落
 *    pending,绝不阻塞改名;
 * 3. matchPhoneCandidates:双向唯一命中才自动改名,歧义/无命中如实挂报告;
 * 4. 导入侧:掩码名落 extraMetadata.phoneMask 待补全标记。
 *
 * 测试模式:vi.mock 掉 db / crypto / checkin-sync / proxy-pool(对齐
 * relay-workbuddy-import.test.ts),不发网络。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  /** dbRead.select().from().where()[.limit()] 的行源(complete 取单行,match 取掩码行集) */
  readRows: [] as unknown[],
  /** db.update(...).set(patch) 捕获 */
  updateSets: [] as Record<string, unknown>[],
  /** db.insert(...).values(row) 捕获(导入侧测试用) */
  insertValues: [] as Record<string, unknown>[],
  pushPoolSync: vi.fn(async (_platform: string, accounts: unknown[]) => ({
    ok: true,
    pushed: accounts.length,
    skipped: 0,
    failed: 0,
    failedIds: [] as string[],
    error: null,
  })),
  markCheckinSyncPending: vi.fn(async () => {}),
  clearCheckinSyncPending: vi.fn(async () => {}),
}))

vi.mock('../src/db/index.js', () => {
  const rows = () => hoisted.readRows
  const makeChain = () => {
    const chain: Record<string, unknown> = {
      limit: () => Promise.resolve(rows()),
      then: (res: (v: unknown[]) => unknown) => res(rows()),
    }
    return chain
  }
  return {
    db: {
      select: () => ({
        // 导入路径的既有行探测恒为空 = 全部按新行插入
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          hoisted.insertValues.push(row)
          return { returning: () => Promise.resolve([{ id: 'row-new', credVersion: 1 }]) }
        },
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          hoisted.updateSets.push(patch)
          return {
            where: () => ({
              returning: () => Promise.resolve([{ id: 'row-1', credVersion: 42 }]),
            }),
          }
        },
      }),
    },
    dbRead: {
      select: () => ({ from: () => ({ where: () => makeChain() }) }),
    },
    dbClient: {},
  }
})

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

import {
  completeAccountPhone,
  matchPhoneCandidates,
  importAccounts,
} from '../src/services/relay-account-pool-service.js'

function poolRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'row-1',
    ownerUserId: null,
    providerCode: 'trae',
    uid: 'uid-1',
    name: '180******69',
    tokenEnc: 'enc:tok-1',
    refreshTokenEnc: 'enc:ref-1',
    cookiesEnc: null,
    secretsEnc: null,
    proxyUrl: null,
    deviceId: null,
    machineId: null,
    isEnabled: true,
    credVersion: 7,
    tokenExpiresAt: null,
    extraMetadata: {},
    ...overrides,
  }
}

beforeEach(() => {
  hoisted.readRows = []
  hoisted.updateSets.length = 0
  hoisted.insertValues.length = 0
  hoisted.pushPoolSync.mockClear()
  hoisted.markCheckinSyncPending.mockClear()
  hoisted.clearCheckinSyncPending.mockClear()
})

describe('completeAccountPhone — 单账号人工补全', () => {
  it('掩码名 + 前3后2吻合的全号 → 改名 + cred_version 前进 + 签到传播', async () => {
    hoisted.readRows = [poolRow()]
    const r = await completeAccountPhone('row-1', '18012345669')
    expect(r.code).toBe('ok')
    expect(r.changed).toBe(true)
    expect(r.oldName).toBe('180******69')
    expect(r.name).toBe('18012345669')
    expect(hoisted.updateSets).toHaveLength(1)
    const patch = hoisted.updateSets[0]!
    expect(patch.name).toBe('18012345669')
    // 改名必须带版本前进:签到副本 CAS 判据 incoming<=existing 即跳过
    expect(patch.credVersion).toBeDefined()
    expect(r.checkinSync.pushed).toBe(1)
    expect(hoisted.pushPoolSync).toHaveBeenCalledTimes(1)
    const [platform, accounts] = hoisted.pushPoolSync.mock.calls[0]!
    expect(platform).toBe('trae')
    const acc = (accounts as Record<string, unknown>[])[0]!
    expect(acc.name).toBe('18012345669')
    expect(acc.credVersion).toBe(42) // returning 的新版本,而非行上的旧值 7
    expect(acc.token).toBe('tok-1') // 凭证现值解密重建(载荷不出测试面)
    expect(hoisted.clearCheckinSyncPending).toHaveBeenCalledWith(['row-1'])
  })

  it('掩码名 + 前3后2不吻合 → mask_mismatch 拒收,不落库不推送', async () => {
    hoisted.readRows = [poolRow()]
    const r = await completeAccountPhone('row-1', '18012345670')
    expect(r.code).toBe('mask_mismatch')
    expect(r.message).toContain('180******69')
    expect(hoisted.updateSets).toHaveLength(0)
    expect(hoisted.pushPoolSync).not.toHaveBeenCalled()
  })

  it('非全号形态(掩码/短号)入参 → invalid_phone', async () => {
    const r = await completeAccountPhone('row-1', '180******69')
    expect(r.code).toBe('invalid_phone')
    expect(hoisted.updateSets).toHaveLength(0)
  })

  it('现名已是同一全号 → ok 且 changed=false(幂等,不空转版本)', async () => {
    hoisted.readRows = [poolRow({ name: '18612345678' })]
    const r = await completeAccountPhone('row-1', '18612345678')
    expect(r.code).toBe('ok')
    expect(r.changed).toBe(false)
    expect(hoisted.updateSets).toHaveLength(0)
    expect(hoisted.pushPoolSync).not.toHaveBeenCalled()
  })

  it('现名已是全号且不一致 → already_full(换绑须重导入)', async () => {
    hoisted.readRows = [poolRow({ name: '18612345678' })]
    const r = await completeAccountPhone('row-1', '13900000000')
    expect(r.code).toBe('already_full')
    expect(hoisted.updateSets).toHaveLength(0)
  })

  it('占位/昵称名(非掩码非全号)允许直接落成全号', async () => {
    hoisted.readRows = [poolRow({ name: 'trae-web-2026-10-23' })]
    const r = await completeAccountPhone('row-1', '13900000000')
    expect(r.code).toBe('ok')
    expect(r.changed).toBe(true)
    expect(hoisted.updateSets[0]!.name).toBe('13900000000')
  })

  it('账号不存在 → not_found', async () => {
    hoisted.readRows = []
    const r = await completeAccountPhone('ghost', '13900000000')
    expect(r.code).toBe('not_found')
  })

  it('签到推送失败 → 改名照常生效,落 pending 待重推', async () => {
    hoisted.readRows = [poolRow()]
    hoisted.pushPoolSync.mockImplementationOnce(async () => ({
      ok: false,
      pushed: 0,
      skipped: 0,
      failed: 1,
      failedIds: ['row-1'],
      error: 'pool-sync HTTP 503',
    }))
    const r = await completeAccountPhone('row-1', '18012345669')
    expect(r.code).toBe('ok')
    expect(r.changed).toBe(true)
    expect(r.checkinSync.pending).toBe(true)
    expect(r.checkinSync.error).toContain('503')
    expect(hoisted.markCheckinSyncPending).toHaveBeenCalledWith(
      ['row-1'],
      'cred',
      null,
      expect.stringContaining('503'),
    )
  })

  it('平台无签到引擎(qoder 映射在 mock 里为 null)→ 不推送不报错', async () => {
    hoisted.readRows = [poolRow({ providerCode: 'qoder', name: '136******71' })]
    const r = await completeAccountPhone('row-1', '13600000071')
    expect(r.code).toBe('ok')
    expect(r.checkinSync.pushed).toBe(0)
    expect(hoisted.pushPoolSync).not.toHaveBeenCalled()
  })
})

describe('matchPhoneCandidates — 批量候选号自动归位', () => {
  it('双向唯一命中才改名;歧义/无命中/非法号各归各栏', async () => {
    hoisted.readRows = [
      poolRow({ id: 'a', name: '180******69' }), // 唯一候选 18012345669 → matched
      poolRow({ id: 'b', name: '136******71' }), // 两个候选 → ambiguous
      poolRow({ id: 'c', name: '187******54' }), // 无候选 → unmatched
      poolRow({ id: 'd', name: 'trae-web-2026-10-23' }), // 非掩码名不扫
    ]
    const report = await matchPhoneCandidates([
      '18012345669',
      '13600000071',
      '13611111171',
      '180******69', // 掩码形态入参 → rejected
    ])
    expect(report.scannedMasked).toBe(3)
    expect(report.matched).toHaveLength(1)
    expect(report.matched[0]).toMatchObject({
      id: 'a',
      oldName: '180******69',
      name: '18012345669',
    })
    expect(report.ambiguous).toEqual([
      { id: 'b', name: '136******71', candidates: ['13600000071', '13611111171'] },
    ])
    expect(report.unmatched).toEqual([{ id: 'c', name: '187******54' }])
    expect(report.rejected).toEqual([{ phone: '180******69', reason: '非 11 位大陆全号形态' }])
    // 只有唯一命中那条落库/推送
    expect(hoisted.updateSets).toHaveLength(1)
    expect(hoisted.updateSets[0]!.name).toBe('18012345669')
    expect(hoisted.pushPoolSync).toHaveBeenCalledTimes(1)
  })

  it('两个掩码行争同一个候选号 → 双双 ambiguous(绝不猜)', async () => {
    hoisted.readRows = [
      poolRow({ id: 'a', name: '180******69' }),
      poolRow({ id: 'b', name: '180*****669' }), // 前3后3,同样只被 18012345669 命中
    ]
    const report = await matchPhoneCandidates(['18012345669'])
    expect(report.matched).toHaveLength(0)
    expect(report.ambiguous.map((x) => x.id).sort()).toEqual(['a', 'b'])
    expect(hoisted.updateSets).toHaveLength(0)
  })

  it('重复候选去重后仍唯一命中 → matched', async () => {
    hoisted.readRows = [poolRow({ id: 'a', name: '180******69' })]
    const report = await matchPhoneCandidates(['18012345669', ' 18012345669 '])
    expect(report.matched).toHaveLength(1)
    expect(report.ambiguous).toHaveLength(0)
  })
})

describe('导入侧掩码待补全标记', () => {
  it('导入名是掩码形态 → extraMetadata.phoneMask 落待补全线索', async () => {
    const r = await importAccounts('trae', [
      { name: '180******69', token: 'trae-opaque-token-1', uid: 'uid-import-1' },
    ])
    expect(r.imported).toBe(1)
    const row = hoisted.insertValues[0]!
    expect(row.name).toBe('180******69')
    const extra = row.extraMetadata as Record<string, unknown>
    expect(extra.phoneMask).toMatchObject({
      mask: '180******69',
      prefix: '180',
      suffix: '69',
    })
  })

  it('导入名已是全号 → 不产 phoneMask 键(待补全态自然解除)', async () => {
    const r = await importAccounts('trae', [
      { name: '18612345678', token: 'trae-opaque-token-2', uid: 'uid-import-2' },
    ])
    expect(r.imported).toBe(1)
    const extra = hoisted.insertValues[0]!.extraMetadata as Record<string, unknown>
    expect(extra.phoneMask).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
