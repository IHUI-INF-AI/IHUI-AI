// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「捆绑载荷形状 → 账号级稳定键」闭环锁(Y-25,2026-11-06 立)。
 *
 * 缺陷本体(主会话一手读数 + 本席复量):号池里那枚豆包行 uid 恒等于回落档那一枚
 * (`--from doubao --dry-run` 现算 == 库里逐字相同),而 dev 库该行的
 * `extra_metadata.cookieCount = 12` ⇒ cookies 数组**确实带过去了**,只是生产者出界时
 * 用的是内部形状 {source,key,host,value},而两处消费方读的都是 `name`
 * (`mapSessionEntryImport` 的稳定键分支、`doubao-adapter.buildCookieHeader`)
 * ⇒ 稳定分支永不命中,换一次 sessionid 换一枚 uid,重导入即多留一行孤儿。
 *
 * 既有 `relay-account-import-uid-parity.test.ts` / 本文件的对照夹具之所以没抓到,
 * 是因为它们的夹具是**手挑形状** `{name,value}`(与本票缺陷无关的另一族失效型:
 * 测试自己造的形状 ≠ 真实生产者形状)。本锁的正解 = 夹具由**真实生产者**当场产出
 * (`extractDoubaoAccounts` 吃临时 sqlite Cookies 库),再把它的出界载荷整份喂给落库口径
 * 的 uid 探针 ⇒ 生产者哪天把 `name` 改回 `key`,本锁当场翻红,无需第二份判据。
 *
 * 零真凭据:夹具全用合成串;判据全走 service 既有的 `stableKeyMaterial`(本文件不复算)。
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, it, expect, vi, afterEach } from 'vitest'

const require = createRequire(import.meta.url)
const REPO_SCRIPTS = fileURLToPath(new URL('../../../scripts/', import.meta.url))
const scratch = await import(
  pathToFileURL(path.join(REPO_SCRIPTS, 'lib', 'scratch-dir.mjs')).href
) as { mkScratch: (p: string) => string; rmScratch: (d: string, o?: object) => void }
const doubaoExtract = (await import(
  pathToFileURL(path.join(REPO_SCRIPTS, 'lib', 'doubao-auth-extract.mjs')).href
)) as {
  extractDoubaoAccounts: (opts?: { userDataDir?: string; profile?: string }) => Promise<{
    providerCode: string
    accounts: Array<Record<string, unknown>>
  }>
}

// 服务层要连 db:与 relay-pool-uid-keysource-rotation.test.ts 同法打桩(本文件零写库)
vi.mock('../src/db/index.js', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }) },
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

const { resolveImportAccountUidProbe } = await import(
  '../src/services/relay-account-pool-service.js'
)
const { buildCookieHeader } = await import('../src/services/upstream-adapters/doubao-adapter.js')

const dirs: string[] = []
afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.shift()
    if (d) scratch.rmScratch(d, { force: true })
  }
})

/** 由真实生产者造载荷:写一枚临时 Cookies 库 → extractDoubaoAccounts → 出界账号 */
async function realDoubaoPayload(rows: Array<[string, string]>): Promise<Record<string, unknown>> {
  const dir = scratch.mkScratch('y25-doubao-')
  dirs.push(dir)
  const net = path.join(dir, 'Default', 'Network')
  const { mkdirSync } = await import('node:fs')
  mkdirSync(net, { recursive: true })
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (p: string) => {
      exec: (sql: string) => void
      prepare: (sql: string) => { run: (...a: unknown[]) => void }
      close: () => void
    }
  }
  const db = new DatabaseSync(path.join(net, 'Cookies'))
  db.exec('CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB)')
  const ins = db.prepare(
    'INSERT INTO cookies (host_key, name, value, encrypted_value) VALUES (?, ?, ?, ?)',
  )
  for (const [name, value] of rows) ins.run('.doubao.com', name, value, null)
  db.close()
  const out = await doubaoExtract.extractDoubaoAccounts({ userDataDir: dir })
  return out.accounts[0] as Record<string, unknown>
}

const ticketA: Array<[string, string]> = [
  ['sessionid', 'synthetic-sess-A'],
  ['sessionid_ss', 'synthetic-sess-A-ss'],
  ['uid_tt', 'synthetic-uid-7'],
  ['ttwid', 'synthetic-ttw-1'],
  ['sid_guard', 'synthetic-guard-1'],
]

function probeUid(account: Record<string, unknown>): string {
  const probes = resolveImportAccountUidProbe('doubao', [
    account as never,
  ] as unknown as Parameters<typeof resolveImportAccountUidProbe>[1])
  const uid = probes[0]?.uid
  expect(uid, '真实豆包捆绑载荷必须过形状闸门并算出落库口径 uid').not.toBeNull()
  return String(uid)
}

describe('① 真实生产者出界形状 ⇒ cookies 带出 name(本票缺陷的直接锁)', () => {
  it('每一枚 cookie 的 name 与内部 key 逐字同值,uid_tt 族在载荷里可见', async () => {
    const acc = await realDoubaoPayload(ticketA)
    const cookies = acc['cookies'] as Array<Record<string, string>>
    expect(cookies).toHaveLength(5)
    for (const c of cookies) {
      expect(c['name'], `条目 ${c['key']} 缺 name ⇒ 稳定分支与转发头都会瞎`).toBe(c['key'])
    }
    expect(cookies.map((c) => c['name']).sort()).toEqual(
      ['sid_guard', 'sessionid', 'sessionid_ss', 'ttwid', 'uid_tt'].sort(),
    )
  })
})

describe('② 稳定分支真被命中 ⇒ 换票不换 uid', () => {
  it('同一 uid_tt、两枚不同 sessionid ⇒ 落库口径 uid 逐字相同(重导入命中旧行)', async () => {
    const first = probeUid(await realDoubaoPayload(ticketA))
    const again = probeUid(
      await realDoubaoPayload(ticketA.map(([n, v]) => (n === 'sessionid' || n === 'sessionid_ss' ? [n, `synthetic-re-${n}`] : [n, v]))),
    )
    expect(first).toMatch(/^auto:/)
    expect(again).toBe(first)
  })

  it('换 uid_tt(账号级稳定标识)⇒ uid 必变(不许把稳定键写死)', async () => {
    const one = probeUid(await realDoubaoPayload(ticketA))
    const other = probeUid(await realDoubaoPayload(ticketA.map(([n, v]) => (n === 'uid_tt' ? [n, 'synthetic-uid-8'] : [n, v]))))
    expect(other).not.toBe(one)
  })
})

describe('③ 消毒口径复用 service 既有实现(本文件零复算)', () => {
  it('uid_tt 带首尾空白 ⇒ 与干净值同一枚 uid,且这一枚 ≠ 无 uid_tt 的回落档', async () => {
    const clean = probeUid(await realDoubaoPayload(ticketA))
    const padded = probeUid(
      await realDoubaoPayload(ticketA.map(([n, v]) => (n === 'uid_tt' ? [n, `  ${v}  `] : [n, v]))),
    )
    expect(padded).toBe(clean)
    // 反向牙:去掉 uid_tt(票不变)⇒ 必须落到另一枚键,否则"相等"可能只是两侧都走回落档
    const noStable = probeUid(
      await realDoubaoPayload(ticketA.filter(([n]) => n !== 'uid_tt' && n !== 'uid_tt_ss')),
    )
    expect(noStable).not.toBe(clean)
  })
})

describe('④ 反证:载荷缺 uid_tt 族 ⇒ 仍落回落档,换票必换键(不许改成常量)', () => {
  it('无 uid_tt/uid_tt_ss 时两枚不同 sessionid 算出两枚不同 uid', async () => {
    const without = ticketA.filter(([n]) => n !== 'uid_tt' && n !== 'uid_tt_ss')
    const a = probeUid(await realDoubaoPayload(without))
    const b = probeUid(
      await realDoubaoPayload(without.map(([n, v]) => (n === 'sessionid' ? [n, 'synthetic-sess-B'] : [n, v]))),
    )
    expect(a).toMatch(/^auto:/)
    expect(b).not.toBe(a)
  })
})

describe('⑤ 第二消费方:转发适配器按真实载荷拼 Cookie 头(不再静默回落 token 推断)', () => {
  it('buildCookieHeader 逐条直通 name=value,含 uid_tt 与 sessionid', async () => {
    const acc = await realDoubaoPayload(ticketA)
    const header = buildCookieHeader({
      row: { id: 'row-1', providerCode: 'doubao', uid: 'u', name: 'n' },
      credentials: {
        token: String(acc['token']),
        refreshToken: null,
        cookies: acc['cookies'],
        secrets: {},
      },
    } as never)
    expect(header).toContain('uid_tt=synthetic-uid-7')
    expect(header).toContain('sessionid=synthetic-sess-A')
    expect(header.split(';')).toHaveLength(5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
