// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「换票不换键 ⇒ 重导入命中旧行」端到端锁(Y-24 Z47 席,2026-11-06 立)。
 *
 * 既有 `relay-account-import-uid-parity.test.ts` 把键源本身钉住了(T9 族:同 recordKey
 * 两枚票 ⇒ 同 uid),但那条链的**下半格**没有锁:uid 稳定之后,重导入到底命中不到旧行?
 * 本票缺陷本体正是「命中不到 ⇒ 每重导出一次多留一行孤儿」,所以必须把
 * 「票旋转 → 同一个键 → 同一行被更新而非新增」合在一枚用例里,零写库(fake db)。
 *
 * 反向对照同样上锁:recordKey 变 = 另一枚账号,第二次必须**新增**,不许并成一行。
 * 退化档同样上锁:没有稳定材料时换票必新增(不冒充稳定),且这条只能由实现事实说话。
 *
 * 另锁 §5「认证不等于授权」在本面的落点:归属(ownerUserId)必须进既有行查询的 WHERE,
 * 运营池导入结构上命中不到个人池行 ⇒ 个人池行不会被重导入静默打回运营池。
 *
 * 测试模式对齐 relay-account-import-uid-parity.test.ts:vi.mock db/crypto/签到同步,
 * 夹具全用合成串,零真实 IO、零凭据。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const hoisted = vi.hoisted(() => ({
  /** fake db「池内既有行」:existing 查询固定返回这批(测试手动投放 = 模拟上一轮已落库) */
  mockSelectRows: [] as Array<Record<string, unknown>>,
  /** 真正写进 ai_relay_account_pool 的新增行 */
  mockInsertValues: [] as Array<Record<string, unknown>>,
  /** 覆盖通道 set 载荷 */
  mockUpdateSets: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve(hoisted.mockSelectRows) }) }),
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
      set: (set: Record<string, unknown>) => {
        hoisted.mockUpdateSets.push(set)
        return {
          where: () => ({
            returning: () => Promise.resolve([{ id: 'row-1', credVersion: 2 }]),
          }),
        }
      },
    }),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
  dbClient: {},
}))

vi.mock('../src/utils/crypto.js', () => ({
  encryptField: (s: string) => `enc:${s}`,
  decryptField: (s: string) => (s.startsWith('enc:') ? s.slice(4) : s),
}))

vi.mock('../src/services/relay-account-pool-checkin-sync.js', () => ({
  zcodePlanJwtFromSecrets: () => null,
  buildPoolSyncAccount: (x: unknown) => x,
  checkinPlatformFor: () => null,
  extractCosy: () => null,
  pushPoolSync: async () => ({ ok: true, pushed: 0, skipped: 0, pending: 0, error: null }),
  markCheckinSyncPending: async () => {},
  clearCheckinSyncPending: async () => {},
}))

import {
  importAccounts,
  resolveImportAccountUidProbe,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'

const b64 = (o: unknown): string => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (payload: Record<string, unknown>): string =>
  `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`

const mmx = (recordKey: string, token: string): ImportAccountInput =>
  ({ recordKey, accessToken: token, refreshToken: `rt-${token}` }) as ImportAccountInput

const zcode = (customerId: string | null, nonce: string): ImportAccountInput =>
  ({
    'oauth:bigmodel:access_token': jwt(
      customerId === null ? { exp: 9999999, nonce } : { customer_id: customerId, nonce },
    ),
  }) as ImportAccountInput

/** 把「上一轮已落库」投放给 fake db:按落库口径 uid 命中的那一行 */
function seedExistingRow(): void {
  hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: true, secretsEnc: null })
}

beforeEach(() => {
  hoisted.mockSelectRows.length = 0
  hoisted.mockInsertValues.length = 0
  hoisted.mockUpdateSets.length = 0
})

describe('① 换票不换键 ⇒ 重导入命中已有行(本票缺陷本体的端到端锁)', () => {
  it('minimax:同一 recordKey、两张不同票 ⇒ 第一次新增、第二次更新;insert 次数不增', async () => {
    const first = await importAccounts('minimax', [mmx('rec-95f3a1fe', 'ticket-A')])
    expect(first.imported).toBe(1)
    const uidFirst = String(hoisted.mockInsertValues[0]?.['uid'])
    expect(uidFirst).toBeTruthy()
    expect(hoisted.mockInsertValues).toHaveLength(1)

    seedExistingRow()
    const second = await importAccounts('minimax', [mmx('rec-95f3a1fe', 'ticket-B')])
    expect(second.updated).toBe(1)
    expect(second.imported).toBe(0)
    expect(hoisted.mockInsertValues).toHaveLength(1) // 池内行数不增 = 不再留孤儿
    expect(String(hoisted.mockUpdateSets[0]?.['uid'])).toBe(uidFirst)
  })

  it('minimax:换票后的预检探针 uid 与首次入库那一枚逐字相同(操作员能指到旧行)', async () => {
    const a = resolveImportAccountUidProbe('minimax', [mmx('rec-95f3a1fe', 'ticket-A')])
    const b = resolveImportAccountUidProbe('minimax', [mmx('rec-95f3a1fe', 'ticket-B')])
    expect(b[0]?.uid).toBe(a[0]?.uid)
  })

  it('zcode:选中票非 JWT(api key 档)⇒ 键仍取 zcodejwttoken / user_info.id,不落 token 哈希', () => {
    // 立因(2026-11-11 生产实证):同一账号 zcode:cn(customer_id 键)与 zcode:global
    // (api key 档 ⇒ 旧口径 token 哈希)各占一行。三份等价材料必须算出同一枚键。
    const payload = (accessToken: string, extra: Record<string, unknown> = {}) =>
      ({ 'oauth:bigmodel:access_token': accessToken, ...extra }) as ImportAccountInput
    const fixtures = [
      payload('apikey-A', { zcodejwttoken: jwt({ user_id: '83881793407924603' }) }),
      payload('apikey-B', {
        'oauth:bigmodel:user_info': JSON.stringify({ id: '83881793407924603' }),
      }),
      payload(jwt({ customer_id: '83881793407924603' })),
    ]
    for (const f of fixtures) {
      expect(resolveImportAccountUidProbe('zcode', [f])[0]?.uid).toBe('83881793407924603')
    }
  })

  it('zcode:user_info 为已解析对象(非 JSON 串)时同样取到账号级键;坏 JSON 与全缺材料不误判', () => {
    // ③ 档两形态都是本机现读实见(提取器直通 = 串;其它导入通道可能已解析)。
    const objectShape = resolveImportAccountUidProbe('zcode', [
      {
        'oauth:bigmodel:access_token': 'apikey-C',
        'oauth:bigmodel:user_info': { id: '70000000000000001' },
      } as unknown as ImportAccountInput,
    ])
    expect(objectShape[0]?.uid).toBe('70000000000000001')
    // 坏 JSON:该档判不出 ⇒ 继续回落,不猜号、不抛(与"零命中判死"相反的方向是照实回落)
    const broken = resolveImportAccountUidProbe('zcode', [
      {
        'oauth:bigmodel:access_token': 'apikey-D',
        'oauth:bigmodel:user_info': '{not json',
      } as unknown as ImportAccountInput,
    ])
    expect(String(broken[0]?.uid).startsWith('auto:')).toBe(true)
  })

  it('zcode 反向对照:两张 api key 且材料全缺 ⇒ 两枚不同键(阶梯不误合不同账号)', () => {
    const a = resolveImportAccountUidProbe('zcode', [
      { 'oauth:bigmodel:access_token': 'apikey-1' } as unknown as ImportAccountInput,
    ])
    const b = resolveImportAccountUidProbe('zcode', [
      { 'oauth:bigmodel:access_token': 'apikey-2' } as unknown as ImportAccountInput,
    ])
    expect(String(a[0]?.uid).startsWith('auto:')).toBe(true)
    expect(a[0]?.uid).not.toBe(b[0]?.uid)
  })
})

describe('② 真不同账号不误合(反向对照)', () => {
  it('minimax:recordKey 不同 ⇒ uid 不同 ⇒ 第二次走新增通道,不覆盖第一枚账号的行', async () => {
    await importAccounts('minimax', [mmx('rec-00000001', 'ticket-A')])
    const uidA = String(hoisted.mockInsertValues[0]?.['uid'])
    hoisted.mockSelectRows.length = 0 // 另一枚账号:库里没有它的行
    const second = await importAccounts('minimax', [mmx('rec-00000002', 'ticket-A')])
    expect(second.imported).toBe(1)
    expect(second.updated).toBe(0)
    const uidB = String(hoisted.mockInsertValues[1]?.['uid'])
    expect(uidB).not.toBe(uidA)
  })

  it('zcode:customer_id 不同 ⇒ uid 不同(账号级声明才是键,不是票)', () => {
    const one = resolveImportAccountUidProbe('zcode', [zcode('cust-1', 'n1')])
    const other = resolveImportAccountUidProbe('zcode', [zcode('cust-2', 'n1')])
    expect(other[0]?.uid).not.toBe(one[0]?.uid)
  })
})

describe('③ 命中已有键的行为具名(不静默覆盖)', () => {
  it('命中 ⇒ status="updated" 且 reason 点名"已覆盖凭证";未命中 ⇒ status="imported"', async () => {
    const fresh = await importAccounts('minimax', [mmx('rec-00000003', 'ticket-A')])
    expect(fresh.items[0]?.status).toBe('imported')

    seedExistingRow()
    const hit = await importAccounts('minimax', [mmx('rec-00000003', 'ticket-B')])
    expect(hit.items[0]?.status).toBe('updated')
    expect(hit.items[0]?.reason ?? '').toMatch(/已覆盖凭证/)
    expect(hit.items[0]?.uid).toBe(String(hoisted.mockInsertValues[0]?.['uid']))
  })
})

describe('④ 幂等:同一载荷重放不累积行数(迁移跑两次行数不变的等价锁,零写库)', () => {
  it('minimax/zcode 各连导三次 ⇒ insert 只发生一次,uid 三枚同值', async () => {
    for (const [provider, account] of [
      ['minimax', mmx('rec-00000004', 'ticket-A')] as const,
      ['zcode', zcode('cust-9', 'n9')] as const,
    ]) {
      hoisted.mockInsertValues.length = 0
      hoisted.mockSelectRows.length = 0
      const r1 = await importAccounts(provider, [account])
      expect(r1.imported).toBe(1)
      seedExistingRow()
      for (const round of [2, 3]) {
        const again = await importAccounts(provider, [account])
        expect(again.updated, `第 ${round} 次重放`).toBe(1)
        expect(again.imported, `第 ${round} 次重放`).toBe(0)
      }
      expect(hoisted.mockInsertValues).toHaveLength(1)
    }
  })

  it('退化档如实:无稳定材料 ⇒ 换票必新增(不许把回落改成常量)', async () => {
    const a = resolveImportAccountUidProbe('minimax', [mmx('', 'ticket-A')])
    const b = resolveImportAccountUidProbe('minimax', [mmx('', 'ticket-B')])
    expect(a[0]?.uid).toMatch(/^auto:/)
    expect(b[0]?.uid).not.toBe(a[0]?.uid)
  })
})

describe('⑤ 归属谓词在 WHERE 里(§5:运营池导入不得命中个人池行)', () => {
  const src = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../src/services/relay-account-pool-service.ts',
    ),
    'utf8',
  )
  const block = src.slice(
    src.indexOf('const existing = await db'),
    src.indexOf('let existingSecrets'),
  )

  it('既有行查询按 (ownerUserId, providerCode, uid) 三键定位,owner 两档都在源里', () => {
    expect(block).toContain('ownerUserId === null')
    expect(block).toMatch(/isNull\(aiRelayAccountPool\.ownerUserId\)/)
    expect(block).toMatch(/eq\(aiRelayAccountPool\.ownerUserId,\s*ownerUserId\)/)
    expect(block).toMatch(/eq\(aiRelayAccountPool\.uid,\s*uid\)/)
  })

  it('覆盖通道只按上一步查出的 id 定位(不盲写、不按 uid 广播)', () => {
    expect(src).toMatch(
      /\.update\(aiRelayAccountPool\)[\s\S]{0,400}?\.where\(eq\(aiRelayAccountPool\.id,\s*existing\[0\]\.id\)\)/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
