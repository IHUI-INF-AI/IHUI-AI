// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Z66 第 1 件 + 第 2 件 —— 校验 CLI 键源与落库键源同源 + 豆包档位上锁(2026-11-06 立)。
 *
 * 第 1 件缺陷(Y-24 交回):`scripts/relay-account-import-validate.ts` 的逐行 `uid=` 与
 * `重复uid=` 吃的是 format 层 `cstr(acc['uid']) || extractUid(token)`(seed 只有票),
 * 而入库那一行的去重键住在服务层 `resolveImportAccountUidProbe` ⇒ 两枚键永不相等,
 * 预检报出的键指不到"真导入后会覆盖哪一行"。姊妹 CLI `relay-account-import.ts` 已收口,本枚漏网。
 *
 * 第 2 件(豆包采集面):载荷 cookies 带 `name:'uid_tt'` ⇒ 键源走**声明档**(与票无关),
 * 不带 ⇒ 走**退化档**(seed 含票,换票即换键)。两档各自钉死,免得将来把回落改成常量。
 *
 * 模式:vi.mock db/crypto/签到同步(对齐 relay-account-import-uid-parity.test.ts),
 * 零真实 IO、零写库、零凭据(夹具全用合成串,输出只含哈希)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const hoisted = vi.hoisted(() => ({
  mockSelectRows: [] as Array<Record<string, unknown>>,
  mockInsertValues: [] as Array<Record<string, unknown>>,
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
      set: () => ({
        where: () => ({ returning: () => Promise.resolve([{ id: 'row-1', credVersion: 2 }]) }),
      }),
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

const { importAccounts, resolveImportAccountUidProbe } =
  await import('../src/services/relay-account-pool-service.js')
const { validateAccountExport } = await import('../src/services/relay-account-format.js')
const { loadKeySource, accountsFromRaw, uidText } =
  await import('../scripts/relay-account-import-validate.js')
type Account = Parameters<typeof importAccounts>[1][number]

const auto = (s: string) => `auto:${createHash('sha256').update(s).digest('hex').slice(0, 32)}`
/** 声明档算式(服务层 mapSessionEntryImport 里那一支的字面复写,只用于反向对照) */
const declared = (uidTt: string) => auto(`doubao:uid:${uidTt}`)
/** 退化档算式:seed 含票 ⇒ 换票换键 */
const degraded = (key: string, token: string) => auto(`doubao:${key}:${token}`)

function doubao(token: string, uidTt?: string): Account {
  const cookies: Array<Record<string, unknown>> = [
    { source: 'cookies', key: 'sessionid', host: '.doubao.com', value: token, name: 'sessionid' },
  ]
  if (uidTt)
    cookies.push({
      source: 'cookies',
      key: 'uid_tt',
      host: '.doubao.com',
      value: uidTt,
      name: 'uid_tt',
    })
  return {
    name: '豆包本机(sessionid,12票)',
    token,
    uid: 'auto:bundle-seed',
    cookies,
    enabled: true,
  } as Account
}

beforeEach(() => {
  hoisted.mockSelectRows.length = 0
  hoisted.mockInsertValues.length = 0
})

describe('K1 同一票在 CLI 校验面与 service 入库面算出同一个键(正向对账)', () => {
  it('声明档豆包:CLI uid === 探针 uid === 真正写进 uid 列的那枚', async () => {
    const accounts = [doubao('ticket-A', 'UIDTT-SYN-1')]
    const key = await loadKeySource('doubao', { accounts })
    expect(key.error).toBeNull()
    const probe = resolveImportAccountUidProbe('doubao', accounts)
    expect(key.rows[0]?.uid).toBe(probe[0]?.uid)

    const res = await importAccounts('doubao', accounts)
    expect(res.items[0]?.uid).toBe(key.rows[0]?.uid)
    expect(String(hoisted.mockInsertValues[0]?.['uid'])).toBe(key.rows[0]?.uid)
    expect(uidText(key, 0)).toBe(String(key.rows[0]?.uid))
  })

  it('一批三型(声明豆包 / 退化豆包 / 不写行的坏形状)逐行都对齐', async () => {
    const accounts = [doubao('ticket-A', 'UIDTT-SYN-1'), doubao('ticket-B'), { junk: true }]
    const key = await loadKeySource('doubao', { accounts })
    const probe = resolveImportAccountUidProbe('doubao', accounts)
    expect(key.rows.map((r) => r.uid)).toEqual(probe.map((r) => r.uid))
    expect(uidText(key, 2)).toContain('不写行')
  })
})

describe('K2 反向牙:键源若改回 format 层就翻红', () => {
  it('format 层那枚与落库口径**必然不同**(前提),CLI 报的是落库口径那一枚', async () => {
    const accounts = [doubao('ticket-A', 'UIDTT-SYN-1')]
    const report = validateAccountExport({ accounts }, { providerCode: 'doubao' })
    const key = await loadKeySource('doubao', { accounts })
    const formatUid = report.accounts[0]?.uid
    expect(formatUid).not.toBeNull()
    expect(formatUid).not.toBe(key.rows[0]?.uid)
    expect(uidText(key, 0)).toBe(declared('UIDTT-SYN-1'))
  })

  it('重复枚数口径也换边:同票不同 uid_tt ⇒ 落库口径 0 重复,format 层 1 重复', async () => {
    const accounts = [doubao('ticket-SAME', 'UIDTT-1'), doubao('ticket-SAME', 'UIDTT-2')]
    const report = validateAccountExport({ accounts }, { providerCode: 'doubao' })
    const key = await loadKeySource('doubao', { accounts })
    expect(report.duplicateUids).toBe(1)
    expect(key.duplicateUids).toBe(0)
    expect(key.rows[1]?.duplicateOf).toBeNull()
  })

  it('接线锁:CLI 源码必须 import 落库口径出口,且不得再拿 report 的 uid 当展示键', () => {
    const HERE = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(resolve(HERE, '../scripts/relay-account-import-validate.ts'), 'utf8')
    expect(src).toContain('resolveImportAccountUidProbe')
    expect(src).not.toMatch(/uid=\$\{acc\.uid/)
    expect(src).toContain('重复uid=${key.error ? ')
    expect(src).toContain('uidKeySource')
  })
})

describe('K3 豆包档位:声明档与票无关,退化档随票轮换(第 2 件)', () => {
  it('带 uid_tt ⇒ 声明档;两枚不同票同 uid_tt 算同一枚键(重导入命中旧行,不多留孤儿)', async () => {
    const a = await loadKeySource('doubao', { accounts: [doubao('ticket-A', 'UIDTT-SYN-1')] })
    const b = await loadKeySource('doubao', { accounts: [doubao('ticket-B', 'UIDTT-SYN-1')] })
    expect(a.rows[0]?.uid).toBe(declared('UIDTT-SYN-1'))
    expect(b.rows[0]?.uid).toBe(a.rows[0]?.uid)
    expect(a.rows[0]?.uid).not.toBe(degraded('', 'ticket-A'))
  })

  it('缺 uid_tt ⇒ 退化档(seed 含票),两枚票两枚键;退化档不冒充稳定', async () => {
    const a = await loadKeySource('doubao', { accounts: [doubao('ticket-A')] })
    const b = await loadKeySource('doubao', { accounts: [doubao('ticket-B')] })
    expect(a.rows[0]?.uid).toBe(degraded('', 'ticket-A'))
    expect(b.rows[0]?.uid).not.toBe(a.rows[0]?.uid)
  })
})

describe('K4 顶层形状取法与未判定', () => {
  it('裸数组 / {accounts} / 其它 ⇒ 取法与 format 层同形', () => {
    expect(accountsFromRaw([doubao('t')])).toHaveLength(1)
    expect(accountsFromRaw({ accounts: [doubao('t')] })).toHaveLength(1)
    expect(accountsFromRaw({ nope: 1 })).toEqual([])
    expect(accountsFromRaw(null)).toEqual([])
  })

  it('空批 ⇒ 零行零重复(枚举到 0 不冒充"全通过")', async () => {
    const key = await loadKeySource('doubao', { accounts: [] })
    expect(key.rows).toEqual([])
    expect(key.duplicateUids).toBe(0)
    expect(key.error).toBeNull()
  })

  it('键源不可用时 uidText 显式点名未判定(绝不回落 format 层键)', async () => {
    const key = await loadKeySource('doubao', { accounts: [doubao('t')] })
    const broken = { ...key, error: '缺 DATABASE_URL', rows: [] }
    expect(uidText(broken, 0)).toContain('未判定(缺 DATABASE_URL)')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
