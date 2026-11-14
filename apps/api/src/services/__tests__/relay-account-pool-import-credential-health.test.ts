// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 导入侧「凭据形态准入闸门」单测(2026-11-15 立)。
 *
 * 立因(生产实证):号池「永久保活」告警链的根因之一 —— 残票在导入/自动入池时就被
 * 默认登记成 keepAliveForever。workbuddy 两枚是「裸 token:既无 refresh_token_enc 也无
 * cookies_enc」,codearts 三枚的 rt 在导出前已被消费,doubao 一枚 sessionid 被上游拒收;
 * 这类残票进保活档后每 6h 空撞上游鉴权、连续 3 次失败被摘除、每 24h 发一封
 * 「号池保活摘除」邮件。
 *
 * 本代理只治「凭据形态」这一路:仅当默认登记窗口内、且 rt/cookies/secrets 三者全无
 * (明显无法续期的裸残票)时,不登记 keepAliveForever。错误码判据由另一路集中实现,
 * 本判据绝不碰上游错误码(避免单一真相源分裂)。
 *
 * 钉住的语义:
 * - 窄判据 + 反向牙:合法凭据(有 rt / 有 cookie / 有 secrets)一律照旧登记 true,
 *   行为逐字节不变;每个「被拦」用例都配一个只差一个凭据字段的同形正例。
 * - keepAliveForever 显式设置(true/false)时,判据完全不介入(默认登记窗口外)。
 * - 覆盖时保留旧票 / 既有 secrets、codearts 永久密钥等形态一律不误伤。
 * - 跨池重复闸门与 23505 兜底是刚加的既有逻辑,本改动不得覆盖掉(回归牙)。
 *
 * 测试模式对齐同目录 relay-account-pool-import-cross-pool.test.ts:vi.mock 掉 db/crypto/
 * logger/签到同步,零真实 IO;db.select().from().where().limit() 按序供数,并额外捕获
 * insert().values()/update().set() 落库的 extraMetadata 以断言 keepAliveForever 登记面。
 * 判据纯函数经 __test__ 直用生产实现(不在测试里重写判据,改坏即红)。
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => ({
  /** 每次 select(...).limit() 消费一格;缺省为空数组(= 查无此行) */
  selectQueue: [] as Array<Array<Record<string, unknown>>>,
  /** insert 自增行 id */
  insertSeq: 0,
  /** 捕获 insert().values(v):断言落库 extraMetadata 里的 keepAliveForever 登记面 */
  insertValues: [] as Array<Record<string, unknown>>,
  /** 捕获 update().set(v):覆盖路径同样断言 extraMetadata */
  updateSets: [] as Array<Record<string, unknown>>,
  /** 置非空 ⇒ 本次 insert 以该错误拒绝(模拟数据库唯一索引 23505) */
  insertError: null as null | { code: string; constraint?: string },
  /** update().set().where().returning() 的回写行(覆盖成功路径需要非空) */
  updateReturning: [{ id: 'row-existing', credVersion: 2 }] as Array<Record<string, unknown>>,
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(hoisted.selectQueue.shift() ?? []) }),
      }),
    }),
    insert: () => ({
      values: (v: Record<string, unknown>) => {
        hoisted.insertValues.push(v)
        return {
          returning: () => {
            if (hoisted.insertError) return Promise.reject(hoisted.insertError)
            hoisted.insertSeq += 1
            return Promise.resolve([{ id: `row-${hoisted.insertSeq}`, credVersion: 1 }])
          },
        }
      },
    }),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        hoisted.updateSets.push(v)
        return {
          where: () => ({ returning: () => Promise.resolve(hoisted.updateReturning) }),
        }
      },
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    }),
  },
  dbClient: {},
}))

vi.mock('../../utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../relay-account-pool-checkin-sync.js', () => ({
  buildPoolSyncAccount: (x: Record<string, unknown>) => ({ ...x, poolAccountId: x['id'] }),
  checkinPlatformFor: () => null,
  extractCosy: () => null,
  pemFromSecrets: () => null,
  zcodePlanJwtFromSecrets: () => null,
  pushPoolSync: vi.fn(async () => ({
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  })),
  clearCheckinSyncPending: vi.fn(async () => undefined),
  markCheckinSyncPending: vi.fn(async () => undefined),
}))

import { importAccounts, __test__ } from '../relay-account-pool-service.js'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}
const FUTURE = Math.floor(Date.UTC(2027, 0, 1) / 1000)

/** workbuddy 原生形状:{name, token};uid 由 JWT sub 解析,票未过期 */
function wb(n: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: `wb-${n}`, token: jwt({ sub: `u-${n}`, exp: FUTURE }), ...extra }
}
/** trae 原生形状:{name, token};加设备 PEM 才有 secrets 图 */
function trae(n: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { name: `trae-${n}`, token: jwt({ sub: `t-${n}`, exp: FUTURE }), ...extra }
}

/** 新建号:两格供数(池内查无此行 + 跨池查无此行) */
function queueInsert(): void {
  hoisted.selectQueue.push([], [])
}
/** 覆盖号:一格供数(既有行命中,不走跨池闸门) */
function queueExisting(row: Record<string, unknown>): void {
  hoisted.selectQueue.push([row])
}

function insertedExtra(): Record<string, unknown> {
  return (hoisted.insertValues[0]?.['extraMetadata'] ?? {}) as Record<string, unknown>
}
function updatedExtra(): Record<string, unknown> {
  return (hoisted.updateSets[0]?.['extraMetadata'] ?? {}) as Record<string, unknown>
}

beforeEach(() => {
  hoisted.selectQueue.length = 0
  hoisted.insertSeq = 0
  hoisted.insertValues.length = 0
  hoisted.updateSets.length = 0
  hoisted.insertError = null
  // 打点文件落临时目录,别污染真实 ~/.wb-switch
  process.env['IHUI_POOL_SYNC_DIRTY_FILE'] = join(tmpdir(), 'ihui-test-import-cred-health-dirty')
})

// =============================================================================
// 判据纯函数:真值表(同形正例 + 反向牙,一次钉死「三者全无才算残票」)
// =============================================================================
describe('isNonRenewableResidualTicket 判据纯函数(经 __test__ 直用生产实现)', () => {
  it.each([
    { hasRefreshToken: false, hasCookies: false, hasSecrets: false, expected: true, label: '三者全无 = 裸残票' },
    { hasRefreshToken: true, hasCookies: false, hasSecrets: false, expected: false, label: '仅 rt' },
    { hasRefreshToken: false, hasCookies: true, hasSecrets: false, expected: false, label: '仅 cookies' },
    { hasRefreshToken: false, hasCookies: false, hasSecrets: true, expected: false, label: '仅 secrets' },
    { hasRefreshToken: true, hasCookies: true, hasSecrets: false, expected: false, label: 'rt + cookies' },
    { hasRefreshToken: true, hasCookies: false, hasSecrets: true, expected: false, label: 'rt + secrets' },
    { hasRefreshToken: false, hasCookies: true, hasSecrets: true, expected: false, label: 'cookies + secrets' },
    { hasRefreshToken: true, hasCookies: true, hasSecrets: true, expected: false, label: '三者齐备' },
  ])('$label ⇒ $expected', ({ hasRefreshToken, hasCookies, hasSecrets, expected }) => {
    expect(__test__.isNonRenewableResidualTicket({ hasRefreshToken, hasCookies, hasSecrets })).toBe(
      expected,
    )
  })
})

// =============================================================================
// importAccounts 集成:闸门只拦裸残票,合法凭据逐字节不变
// =============================================================================
describe('importAccounts 凭据形态准入闸门(默认登记窗口内)', () => {
  it('裸残票(workbuddy 裸 token,无 rt/cookies/secrets)被拦:号仍入库,但不登记 keepAliveForever', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [wb('bare')])

    // 仍能入库(不是靠整条 skip 蒙混):这是「拒绝登记」而非「拒绝入池」
    expect(r.imported).toBe(1)
    expect(r.skipped).toBe(0)
    expect(r.failed).toBe(0)
    expect(hoisted.insertValues).toHaveLength(1)
    // 凭据形态确凿:三类续期材料全空
    expect(hoisted.insertValues[0]?.['refreshTokenEnc']).toBeNull()
    expect(hoisted.insertValues[0]?.['cookiesEnc']).toBeNull()
    expect(hoisted.insertValues[0]?.['secretsEnc']).toBeNull()
    // 关键:extra 里根本没有 keepAliveForever 键 ⇒ keepAliveForeverOf() 读 false
    expect('keepAliveForever' in insertedExtra()).toBe(false)
    expect(insertedExtra()['keepAliveForever']).toBeUndefined()
  })

  it('同形正例 + 反向牙:同一裸载荷 + refreshToken ⇒ 放行,照旧登记 true', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [wb('rt', { refreshToken: 'drt-live' })])

    expect(r.imported).toBe(1)
    expect(hoisted.insertValues[0]?.['refreshTokenEnc']).toBe('enc:drt-live')
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('同形正例 + 反向牙:同一裸载荷 + cookies ⇒ 放行,照旧登记 true', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [
      wb('cookie', { cookies: [{ name: 'sessionid', value: 'v' }] }),
    ])

    expect(r.imported).toBe(1)
    expect(hoisted.insertValues[0]?.['cookiesEnc']).toBe('enc:[{"name":"sessionid","value":"v"}]')
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('trae 裸残票(无设备材料)同样被拦:与下一用例构成同形基底', async () => {
    queueInsert()
    const r = await importAccounts('trae', [trae('bare')])

    expect(r.imported).toBe(1)
    expect('keepAliveForever' in insertedExtra()).toBe(false)
  })

  it('同形正例 + 反向牙:同一 trae 裸载荷 + 设备 PEM(secrets) ⇒ 放行,照旧登记 true', async () => {
    queueInsert()
    const r = await importAccounts('trae', [
      trae('pem', { deviceKeyPem: '-----BEGIN KEY-----', devicePubPem: '-----BEGIN PUB-----' }),
    ])

    expect(r.imported).toBe(1)
    expect(hoisted.insertValues[0]?.['secretsEnc']).toContain('deviceKeyPem')
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('空凭据边界:refreshToken=\'\' 且 cookies=[] (字段在但为空)⇒ 仍算残票被拦', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [
      wb('empty', { refreshToken: '', cookies: [] }),
    ])

    expect(r.imported).toBe(1)
    expect(hoisted.insertValues[0]?.['refreshTokenEnc']).toBeNull()
    expect(hoisted.insertValues[0]?.['cookiesEnc']).toBeNull()
    expect('keepAliveForever' in insertedExtra()).toBe(false)
  })

  it('空凭据边界反向牙:同上但 cookies 真有 1 枚 ⇒ 放行,照旧登记 true', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [
      wb('one-cookie', { refreshToken: '', cookies: [{ name: 'sid', value: 'v' }] }),
    ])

    expect(r.imported).toBe(1)
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('keepAliveForever 未显式设置 + 合法号(有 rt)⇒ 判据不产生拦截,照旧登记 true', async () => {
    queueInsert()
    // 载荷完全不带 keepAliveForever 键 = 走默认登记窗口;形态正常 ⇒ 判据放行
    const r = await importAccounts('workbuddy', [wb('default', { refreshToken: 'drt-ok' })])

    expect(r.imported).toBe(1)
    expect(__test__.isNonRenewableResidualTicket({
      hasRefreshToken: true,
      hasCookies: false,
      hasSecrets: false,
    })).toBe(false) // 判据纯函数对该形态恒返回 false
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('已有保活标记(true)且形态正常 ⇒ 不受影响,仍 true(判据不介入显式意图)', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [
      wb('marked', { keepAliveForever: true, refreshToken: 'drt-ok' }),
    ])

    expect(r.imported).toBe(1)
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('合法改动仍绿:显式 keepAliveForever=false 仍被尊重,不被单向下压成 true', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [
      wb('off', { keepAliveForever: false, refreshToken: 'drt-ok' }),
    ])

    expect(r.imported).toBe(1)
    expect(insertedExtra()['keepAliveForever']).toBe(false)
  })

  it('窗口边界反向牙:显式 true + 裸残票 ⇒ 尊重显式意图,判据不介入(仍 true)', async () => {
    queueInsert()
    const r = await importAccounts('workbuddy', [wb('explicit', { keepAliveForever: true })])

    expect(r.imported).toBe(1)
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })

  it('防误伤:覆盖时 preserve 保留旧 rt ⇒ 不拦(号仍可自续),登记 true', async () => {
    queueExisting({ id: 'row-existing', hasRefreshToken: true, secretsEnc: null })
    const r = await importAccounts('workbuddy', [wb('preserve')], null, {
      preserveMissingRefresh: true,
    })

    expect(r.updated).toBe(1)
    expect(r.failed).toBe(0)
    expect(updatedExtra()['keepAliveForever']).toBe(true)
  })

  it('防误伤:覆盖时既有 secrets 列被保留 ⇒ 不拦,登记 true', async () => {
    queueExisting({
      id: 'row-existing',
      hasRefreshToken: false,
      secretsEnc: 'enc:{"sessionTemplate":{"k":"v"}}',
    })
    const r = await importAccounts('workbuddy', [wb('old-secrets')])

    expect(r.updated).toBe(1)
    expect(r.failed).toBe(0)
    expect(updatedExtra()['keepAliveForever']).toBe(true)
  })

  it('防误伤:codearts 永久 AK/SK(恒带 secrets 图,token 为空)⇒ 放行,登记 true', async () => {
    queueInsert()
    const r = await importAccounts('codearts', [
      { name: 'ca-permanent', accessKey: 'AK', secretKey: 'SK' },
    ])

    expect(r.imported).toBe(1)
    expect(hoisted.insertValues[0]?.['secretsEnc']).toContain('accessKeyId')
    expect(insertedExtra()['keepAliveForever']).toBe(true)
  })
})

// =============================================================================
// 回归牙:本改动不得覆盖掉刚加的跨池闸门与 23505 兜底
// =============================================================================
describe('既有闸门回归牙(本改动不得覆盖)', () => {
  it('跨池重复闸门:运营池导入命中个人池同 uid ⇒ skipped,不插入第二行', async () => {
    hoisted.selectQueue.push(
      [], // 运营池内查无此行
      [{ id: 'aaaaaaaa-1', sharedToOps: true, healthStatus: 'healthy' }], // 个人池已有
    )
    const r = await importAccounts('trae', [trae('cross')])

    expect(r.skipped).toBe(1)
    expect(r.imported).toBe(0)
    expect(hoisted.insertValues).toHaveLength(0)
    expect(r.items[0]?.reason).toContain('只保留一条续期链')
  })

  it('23505 兜底:并发插队撞唯一索引 ⇒ skipped 而非 failed,不覆盖任何既有凭证', async () => {
    queueInsert()
    hoisted.insertError = { code: '23505', constraint: 'ai_relay_account_pool_provider_uid_uniq' }
    const r = await importAccounts('trae', [trae('uq')])

    expect(r.skipped).toBe(1)
    expect(r.failed).toBe(0)
    expect(r.imported).toBe(0)
    expect(hoisted.updateSets).toHaveLength(0)
    expect(r.items[0]?.reason).toContain('唯一索引')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
