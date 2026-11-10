// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「预检 uid == 入库 uid」收口用例(2026-11-06 立)。
 *
 * 缺陷(主会话一手复现):同一份豆包输入
 * - 预检 `node scripts/relay-account-pool.mjs --from doubao --dry-run` 恒报
 *   `auto:2972051ce702a817dee382ef3007437f`(= relay-account-format.ts:366 `extractUid(token)`,seed 只有 token);
 * - 实际入库那一行是 `auto:acc3bb70ad6c6d7ff9c41b5b528fc3a2`(= relay-account-pool-service.ts:527
 *   `mapSessionEntryImport` → `autoUid(`${source}:${key}:${token}`)`,seed 多了 source/key)。
 * 两枚键永不相差 ⇒ 服务层"同 provider+uid 覆盖"在预检面完全命中不到旧行,换一次票就在池里
 * 多留一行孤儿(正是刚清理过的豆包那一型的放大器)。
 *
 * 本套件钉死两件事(交付的实质):
 * - **T1/T4/T7 键源同一**:预检出口 `resolveImportAccountUidProbe` 报出的 uid,与
 *   `importAccounts` 真正写进 `(provider_code, uid)` 那一列的枚**逐字相等**(12 平台逐型);
 * - **T2 第二次导入=更新而非新增**:同一份输入重导入,第二次 `updated=1 / imported=0`,
 *   池内行数不增(以 fake db 的 insert 捕获计数为证)。
 *
 * 另附 T3 反向牙(证明旧分叉真实存在,不是臆想)、T5 批内重复口径、T6 取不到键不冒充、
 * T8 CLI 接线锁(预检面确实走这枚出口,不再回读 format 层的键)。
 *
 * 测试模式:vi.mock db/crypto/签到同步(对齐 relay-account-import-preserve-refresh.test.ts),
 * 零真实 IO、零写库、零凭据(夹具全用合成串,输出只含哈希与键名)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const hoisted = vi.hoisted(() => ({
  /** fake db 的「池内既有行」:select(existing 查询)固定返回这批 */
  mockSelectRows: [] as Array<Record<string, unknown>>,
  /** insert 落库值捕获(= 真正写进 ai_relay_account_pool 的行) */
  mockInsertValues: [] as Array<Record<string, unknown>>,
  /** update 的 set 载荷捕获 */
  mockUpdateSets: [] as Array<Record<string, unknown>>,
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
      set: (set: Record<string, unknown>) => {
        hoisted.mockUpdateSets.push(set)
        return {
          where: () => ({ returning: () => Promise.resolve([{ id: 'row-1', credVersion: 2 }]) }),
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
  buildPoolSyncAccount: (x: unknown) => x,
  checkinPlatformFor: () => null,
  extractCosy: () => null,
  pushPoolSync: async () => ({ ok: true, pushed: 0, skipped: 0, pending: 0, error: null }),
  markCheckinSyncPending: async () => {},
  clearCheckinSyncPending: async () => {},
}))

import {
  importAccounts,
  resolveImportAccountUid,
  resolveImportAccountUidProbe,
  type ImportAccountInput,
} from '../src/services/relay-account-pool-service.js'
import { extractUid, type RelayProviderCode } from '../src/services/relay-account-format.js'

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url')
}
function jwt(payload: Record<string, unknown>): string {
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}
const FUTURE = Math.floor(Date.UTC(2027, 0, 1) / 1000)
const autoHash = (seed: string): string =>
  `auto:${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`

beforeEach(() => {
  hoisted.mockSelectRows.length = 0
  hoisted.mockInsertValues.length = 0
  hoisted.mockUpdateSets.length = 0
})

/** 走一遍落库并返回「真正写进 uid 列的那枚」 */
async function importedUid(
  providerCode: RelayProviderCode,
  accounts: ImportAccountInput[],
): Promise<string | null> {
  const r = await importAccounts(providerCode, accounts)
  const item = r.items[0]
  if (!item || (item.status !== 'imported' && item.status !== 'updated')) return null
  return item.uid
}

/** 豆包形状(复现票面那一型):cookie 会话条目 {source,key,value} */
const DOUBAO: ImportAccountInput = {
  source: 'chrome-cookie',
  key: 'sessionid',
  value: 'synthetic-doubao-cookie-value-1',
  cookies: [{ name: 'sessionid', value: 'synthetic-doubao-cookie-value-1' }],
}

describe('T1 预检 uid 与入库 uid 同一枚(豆包复现型)', () => {
  it('resolveImportAccountUidProbe 的 uid === importAccounts 写进 uid 列的值', async () => {
    const probe = resolveImportAccountUidProbe('doubao', [DOUBAO])
    expect(probe[0]?.uid).toMatch(/^auto:[0-9a-f]{32}$/)
    const written = await importedUid('doubao', [DOUBAO])
    expect(written).not.toBeNull()
    expect(probe[0]?.uid).toBe(written)
    // fake db 的实际插入列也必须同一枚(不是只在结果对象里自洽)
    expect(String(hoisted.mockInsertValues[0]?.['uid'])).toBe(probe[0]?.uid)
  })

  it('单行出口 resolveImportAccountUid 与批探针同值', () => {
    expect(resolveImportAccountUid('doubao', DOUBAO)).toBe(
      resolveImportAccountUidProbe('doubao', [DOUBAO])[0]?.uid,
    )
  })
})

describe('T2 同一份输入重导入 = 更新而非新增(本票实质交付)', () => {
  it('第一次 imported=1;第二次命中同一行 updated=1、imported=0、insert 次数不再增加', async () => {
    // 第一次:池内无既有行 ⇒ 走新增通道
    const first = await importAccounts('doubao', [DOUBAO])
    expect(first.imported).toBe(1)
    expect(first.updated).toBe(0)
    const uidFirst = String(hoisted.mockInsertValues[0]?.['uid'])
    expect(hoisted.mockInsertValues).toHaveLength(1)

    // 预检口径必须先报出同一枚,否则操作员永远查不到旧行(= 缺陷本体)
    const probe = resolveImportAccountUidProbe('doubao', [DOUBAO])
    expect(probe[0]?.uid).toBe(uidFirst)

    // 第二次:fake db 现在"库里已有这一行"(按落库口径 uid 命中)
    hoisted.mockSelectRows.push({ id: 'row-1', hasRefreshToken: false })
    const second = await importAccounts('doubao', [DOUBAO])
    expect(second.updated).toBe(1)
    expect(second.imported).toBe(0)
    expect(second.items[0]?.uid).toBe(uidFirst)
    // 池内行数不增:insert 一次都没有再发生
    expect(hoisted.mockInsertValues).toHaveLength(1)
    expect(hoisted.mockUpdateSets).toHaveLength(1)
  })

  it('反向对照:若按预检旧口径(format 层 extractUid)查行,第二次就会新增一行', async () => {
    const legacyKey = extractUid(String(DOUBAO['value']))
    const poolKey = resolveImportAccountUid('doubao', DOUBAO)
    expect(poolKey).not.toBeNull()
    expect(legacyKey).not.toBe(poolKey)
    // 旧口径命中不到池内行 ⇒ existing 查询空 ⇒ 走新增通道(缺陷的可执行复现)
    hoisted.mockSelectRows.length = 0
    const r = await importAccounts('doubao', [DOUBAO])
    expect(r.imported).toBe(1)
    expect(r.items[0]?.uid).toBe(poolKey)
    expect(r.items[0]?.uid).not.toBe(legacyKey)
  })
})

describe('T3 seed 构成差异取证(为什么两枚键本来就不等)', () => {
  it('落库 seed = source:key:token;预检旧 seed = token', () => {
    const token = String(DOUBAO['value'])
    const key = String(DOUBAO['key'])
    const source = String(DOUBAO['source'])
    // 落库那枚(relay-account-pool-service.ts mapSessionEntryImport 的 autoUid)
    expect(resolveImportAccountUid('doubao', DOUBAO)).toBe(autoHash(`${source}:${key}:${token}`))
    // 预检旧那枚(relay-account-format.ts extractUid 的兜底哈希)
    expect(extractUid(token)).toBe(autoHash(token))
    expect(autoHash(token)).not.toBe(autoHash(`${source}:${key}:${token}`))
  })
})

describe('T4 12 平台逐型键源同一(预检探针 === 落库 uid 列)', () => {
  const cases: Array<{ providerCode: RelayProviderCode; account: ImportAccountInput }> = [
    { providerCode: 'doubao', account: DOUBAO },
    {
      providerCode: 'loomy',
      account: { source: 'leveldb', key: 'loomy-token', value: 'synthetic-loomy-value' },
    },
    {
      providerCode: 'codex',
      account: { tokens: { access_token: 'syn-ocx', account_id: 'acct-9' } },
    },
    {
      providerCode: 'opencode',
      account: {
        providerID: 'anthropic',
        auth: { type: 'oauth', key: 'syn-oke', accountId: 'oa-1' },
      },
    },
    {
      providerCode: 'minimax',
      account: { recordKey: 'minimax:cn', accessToken: 'syn-mmx', refreshToken: 'syn-mmx-rt' },
    },
    { providerCode: 'zcode', account: { 'oauth:bigmodel:access_token': 'syn-zc' } },
    {
      providerCode: 'lingma',
      account: { user_id: 'lm-7', accessToken: 'syn-lm' },
    },
    {
      providerCode: 'codearts',
      account: {
        securitytoken: 'syn-sts',
        accessKey: 'syn-ak',
        secretKey: 'syn-sk',
        account: { id: 'ca-1', label: 'CA 一号' },
      },
    },
    {
      providerCode: 'codearts',
      account: { securitytoken: 'syn-sts', accessKey: 'syn-ak-2', secretKey: 'syn-sk-2' },
    },
    {
      providerCode: 'qoder',
      account: { token: 'synthetic-opaque-token-27chars', nickname: 'Q 昵称' },
    },
    { providerCode: 'trae', account: { token: jwt({ sub: 'trae-u1', exp: FUTURE }) } },
    {
      providerCode: 'workbuddy',
      account: { token: jwt({ sub: 'wb-u1', exp: FUTURE, preferred_username: '13800000001' }) },
    },
  ]

  for (const { providerCode, account } of cases) {
    it(`${providerCode}:预检报的 uid 就是入库那一行的 uid`, async () => {
      const probe = resolveImportAccountUidProbe(providerCode, [account])
      const written = await importedUid(providerCode, [account])
      expect(written, `${providerCode} 未落库(形状闸门或凭据为空)`).not.toBeNull()
      expect(probe[0]?.uid).toBe(written)
    })
  }
})

describe('T5 批内重复口径与 seenInBatch 一致', () => {
  it('同两份豆包条目:探针点名第二份重复 ⇒ 落库第二份 skipped(不是两行)', async () => {
    const probe = resolveImportAccountUidProbe('doubao', [DOUBAO, { ...DOUBAO }])
    expect(probe[0]?.duplicateOf).toBeNull()
    expect(probe[1]?.duplicateOf).toBe(0)
    const r = await importAccounts('doubao', [DOUBAO, { ...DOUBAO }])
    expect(r.imported).toBe(1)
    expect(r.skipped).toBe(1)
    expect(hoisted.mockInsertValues).toHaveLength(1)
    expect(String(r.items[1]?.reason)).toContain('批次内重复 uid')
  })
})

describe('T6 取不到键一律 null(§0.3 不冒充"不重复")', () => {
  it('GrokBot 密封串:形状认得但没有明文 ⇒ 探针 null,落库 failed', async () => {
    const sealed: ImportAccountInput = { credential: { sandSealedFile: 'synthetic-sealed' } }
    expect(resolveImportAccountUid('grokbot', sealed)).toBeNull()
    const probe = resolveImportAccountUidProbe('grokbot', [sealed])
    expect(probe[0]?.uid).toBeNull()
    expect(probe[0]?.duplicateOf).toBeNull()
    const r = await importAccounts('grokbot', [sealed])
    expect(r.failed).toBe(1)
    expect(r.items[0]?.uid).toBeNull()
  })

  it('非对象条目 / 无凭据条目:探针 null,且不抛', () => {
    expect(resolveImportAccountUid('doubao', null as unknown as ImportAccountInput)).toBeNull()
    expect(resolveImportAccountUid('doubao', [] as unknown as ImportAccountInput)).toBeNull()
    expect(resolveImportAccountUid('doubao', { key: 'no-value-here' })).toBeNull()
    const probe = resolveImportAccountUidProbe('doubao', [
      null as unknown as ImportAccountInput,
      { key: 'no-value-here' },
    ])
    expect(probe.map((p) => p.uid)).toEqual([null, null])
  })

  it('显式 uid 平台仍优先载荷 uid(未被收口改动打翻)', () => {
    expect(
      resolveImportAccountUid('trae', {
        uid: 'given-uid-1',
        token: jwt({ sub: 'sub-should-lose', exp: FUTURE }),
      }),
    ).toBe('given-uid-1')
  })
})

describe('T8 CLI 预检面接线锁(键源只此一枚,不许回潮)', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const cliPath = resolve(HERE, '../scripts/relay-account-import.ts')
  const servicePath = resolve(HERE, '../src/services/relay-account-pool-service.ts')

  it('CLI 走 resolveImportAccountUidProbe,且不再把 validateAccountExport 的 uid 当预检出口', () => {
    const src = readFileSync(cliPath, 'utf8')
    expect(src).toContain('resolveImportAccountUidProbe')
    // 预检摘要里的 uid 必须来自落库口径探针,不再是 report 自带的那枚
    expect(src).not.toMatch(/uid:\s*a\.uid/)
    expect(src).toContain('uid: uidOf(a.index)')
    // 落库后逐行自证的牙也必须在位(键源再分叉时运行时就要喊)
    expect(src).toContain('预检 uid 与入库 uid 不一致')
  })

  it('服务层映射分派与 uid 推导各只有一处(第二份必然漂移,§0.6)', () => {
    const src = readFileSync(servicePath, 'utf8')
    // 三元分派链只许住在 mapImportedAccount 里:分派站点计数必须为 1
    const dispatchSites = (src.match(/\?\s*mapCodeartsImport\(acc\)/g) ?? []).length
    expect(dispatchSites).toBe(1)
    // 落库循环不得再自带第二句 uid 推导(必须经 uidFromImportPayload)
    expect(
      (src.match(/normalizeCredentialValue\(mapped \? mapped\.uid : acc\.uid\)/g) ?? []).length,
    ).toBe(0)
    expect((src.match(/return uidFromImportPayload\(/g) ?? []).length).toBe(1)
    expect(
      (src.match(/const uid = uidFromImportPayload\(mapped, acc\.uid, token\)/g) ?? []).length,
    ).toBe(1)
  })

  it('runHealth 出口代理必须经 pickProxyForAccount(信封直喂 = Invalid URL 误判未判定)', () => {
    // 立因(2026-11-10):proxy_url 列可能存 encryptField 信封({"iv","ciphertext","tag"}),
    // 把库内原文直接当代理 URL 喂给 ProxyAgent 会抛 Invalid URL ⇒ 健康检查误判未判定。
    // 出口必须与转发链路同源:pickProxyForAccount 负责解密 + 池内轮换回退。
    const src = readFileSync(cliPath, 'utf8')
    expect(src).toContain('await pickProxyForAccount({ id: row.id, proxyUrl: row.proxyUrl })')
    // checkHealth 只许吃解出来的明文,不许再碰库内原文
    expect(src).toContain('proxyUrl: proxyUrl ?? undefined')
    // 反向牙:row.proxyUrl 作为实参只许出现在 pickProxyForAccount 那一处(第二处=又有人直喂)
    const rawFeeds = (src.match(/proxyUrl:\s*row\.proxyUrl/g) ?? []).length
    expect(rawFeeds).toBe(1)
  })
})

/**
 * T9 —— Y-24 稳定身份键(2026-11-06)。
 *
 * 席把键源从"含 token"收成"账号级稳定材料",但死在落码之后、写用例之前 ⇒ 这三把锁由主会话补。
 * 缺陷实证(本机 dev 库现读):`minimax:cn` 一名占 3 行 3 枚 uid,而三行 extra_metadata.recordKey
 * 的 sha 同为 `95f3a1fe` 且等于本机 mcode auth.json 当下那条记录键 ⇒ 唯一变量就是票。
 * 缺材料时实现刻意回落 token 哈希(不硬造伪稳定键),所以退化档也要有锁,否则将来有人"顺手"
 * 把回落改成常量,这把套件不会有任何一声响。
 */
describe('T9 Y-24 稳定身份键:换票不换键、换账号必换键、缺材料才退化', () => {
  const mmx = (over: Record<string, unknown> = {}) =>
    ({
      recordKey: 'rec-95f3a1fe',
      accessToken: 'syn-token-A',
      refreshToken: 'syn-rt-A',
      ...over,
    }) as never

  it('minimax:同一 recordKey、两枚不同的票 ⇒ uid 必须相同(旧口径在此必分叉)', async () => {
    const uidA = await importedUid('minimax', [mmx()])
    const uidB = await importedUid('minimax', [
      mmx({ accessToken: 'syn-token-B', refreshToken: 'syn-rt-B' }),
    ])
    expect(uidA).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(uidB).toBe(uidA)
  })

  it('minimax:recordKey 变了 ⇒ uid 必变(不许把两枚账号并成一枚)', async () => {
    const one = await importedUid('minimax', [mmx()])
    const other = await importedUid('minimax', [mmx({ recordKey: 'rec-00000002' })])
    expect(other).not.toBe(one)
  })

  it('minimax:recordKey 内嵌 NUL/首尾空白 ⇒ 与消毒后的同键(键与值不得两套消毒)', async () => {
    const plain = await importedUid('minimax', [mmx({ recordKey: 'rec-a' })])
    const dirty = await importedUid('minimax', [mmx({ recordKey: '  rec-a\u0000  ' })])
    expect(dirty).toBe(plain)
  })

  it('minimax:没有 recordKey ⇒ 如实回落 token 哈希(两枚票两枚键,退化档不冒充稳定)', async () => {
    const a = await importedUid('minimax', [mmx({ recordKey: '' })])
    const b = await importedUid('minimax', [
      mmx({ recordKey: '', accessToken: 'syn-token-Z', refreshToken: 'syn-rt-Z' }),
    ])
    expect(a).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(b).not.toBe(a)
  })

  it('doubao:uid_tt 相同而会话票(sessionid)不同 ⇒ uid 相同(本票最初报障的那一支)', async () => {
    const withUid = (sid: string, uidTt: string) =>
      ({
        source: 'chrome-cookie',
        key: 'sessionid',
        value: sid,
        cookies: [
          { name: 'sessionid', value: sid },
          { name: 'uid_tt', value: uidTt },
        ],
      }) as never
    const a = await importedUid('doubao', [withUid('syn-sid-A', 'syn-uidtt-1')])
    const b = await importedUid('doubao', [withUid('syn-sid-B', 'syn-uidtt-1')])
    expect(a).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(b).toBe(a)
    // 换账号 ⇒ 必换键(不许把两枚豆包号并成一枚)
    const other = await importedUid('doubao', [withUid('syn-sid-A', 'syn-uidtt-2')])
    expect(other).not.toBe(a)
  })

  it('doubao:载荷里没有 uid_tt 族 ⇒ 如实回落旧口径,不硬造伪稳定键', async () => {
    const bare = (sid: string) =>
      ({ source: 'chrome-cookie', key: 'sessionid', value: sid, cookies: [] }) as never
    const a = await importedUid('doubao', [bare('syn-sid-A')])
    const b = await importedUid('doubao', [bare('syn-sid-B')])
    expect(a).toMatch(/^auto:[0-9a-f]{32}$/)
    expect(b).not.toBe(a)
  })

  it('zcode:声明 customer_id 相同而票不同 ⇒ uid 相同;声明缺失才回落', async () => {
    const b = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const jwt = (claims: Record<string, unknown>) => `${b({ alg: 'none' })}.${b(claims)}.syn`
    const same = { 'oauth:bigmodel:access_token': jwt({ customer_id: 'cust-1' }) }
    const rotated = { 'oauth:bigmodel:access_token': jwt({ customer_id: 'cust-1', exp: 9999999 }) }
    const uidSame = await importedUid('zcode', [same as never])
    const uidRot = await importedUid('zcode', [rotated as never])
    // zcode 的 uid 直接取声明值明文(与 qoder/codearts/workbuddy 的明文 uid 同形态),
    // 不是 auto: 哈希 —— 断言按实现事实写,不按"uid 必带前缀"的想当然。
    expect(uidSame).toBe('cust-1')
    expect(uidRot).toBe(uidSame)
    const noClaim = await importedUid('zcode', [
      { 'oauth:bigmodel:access_token': jwt({ sub: 'x' }) } as never,
    ])
    expect(noClaim).not.toBe(uidSame)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
