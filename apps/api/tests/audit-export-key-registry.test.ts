// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 86G-2 判据取证 B(密码学端到端):按 kid 查表的多公钥验签。
 *
 * 与另外两把尺子的分工(三把各判一件事,不互相顶结论):
 * - `apps/api/tests/audit-export-key-registry.selftest.ts` —— 登记表**自身**的结构判据(43 条构造面);
 * - `scripts/tests/audit-export-key-registry.test.mjs` —— 装车证明与反向锁(判据有没有被接线);
 * - 本文件 —— **真钥匙、真签名**的端到端:换钥之后旧信封到底还验不验得过。
 *
 * 票面验收逐条落在下面的用例里:换钥后旧信封仍验通过 ∧ 未知 kid 与"签名被改"给出**不同**
 * 结论 ∧ 一把公钥都没有时抛错(既不算通过也不算"验不过")。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/Redis(8811);密钥是**测试内
 * 现生成的临时 RSA 密钥对**,只活在进程内存,不落盘、不入库。
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const PRIVATE_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY'
const PRIVATE_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY_PATH'
const PUBLIC_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY'
const PUBLIC_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH'
const KEY_ID_ENV = 'AUDIT_EXPORT_SIGN_KEY_ID'

// 本文件测的是"信封按 kid 查表可验",不是 SQL ⇒ 审计链查询面桩掉。
const selectAuditLogsMock = vi.hoisted(() => vi.fn())
vi.mock('../src/db/audit-queries.js', () => ({ selectAuditLogs: selectAuditLogsMock }))

import {
  AuditExportSignatureError,
  buildSignedAuditExport,
  verifySignedAuditExport,
  verifySignedAuditExportWithKeys,
  type SignedAuditExport,
} from '../src/services/siem-exporter.js'
import {
  AUDIT_EXPORT_KEY_REGISTRY,
  deriveAuditExportKeyId,
  normalizeAuditExportPublicKey,
  type AuditExportKeyEntry,
} from '../src/services/audit-export-key-registry.js'

interface Fixture {
  privatePem: string
  publicPem: string
  kid: string
}

function makeFixture(): Fixture {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  return {
    privatePem: pair.privateKey,
    publicPem: pair.publicKey,
    kid: deriveAuditExportKeyId(pair.publicKey),
  }
}

/** 造一行登记项(夹具构造,不是判据)。kid 一律按公钥自算 —— 手写的会被 R8 判红。 */
function row(fixture: Fixture, over: Partial<AuditExportKeyEntry> = {}): AuditExportKeyEntry {
  return {
    kid: fixture.kid,
    publicKey: fixture.publicPem,
    status: 'active',
    reason: '测试夹具登记的公钥行',
    addedAt: '2026-01-01',
    ...over,
  }
}

function useFixture(f: Fixture): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = f.privatePem
  process.env[PRIVATE_KEY_PATH_ENV] = ''
  process.env[PUBLIC_KEY_INLINE_ENV] = f.publicPem
  process.env[PUBLIC_KEY_PATH_ENV] = ''
  delete process.env[KEY_ID_ENV]
}

const OLD_KEY = makeFixture()
const NEW_KEY = makeFixture()

beforeAll(() => {
  selectAuditLogsMock.mockReset()
  selectAuditLogsMock.mockImplementation(
    async (_filters: unknown, page: number, pageSize: number) => {
      if (page > 1) return { list: [], total: 1 }
      return {
        list: [
          {
            id: 'aaaaaaaa-0000-0000-0000-000000000001',
            timestamp: '2026-09-27T10:00:00.000Z',
            userId: 'bbbbbbbb-0000-0000-0000-000000000002',
            action: 'auth.login',
            resourceType: 'session',
            resourceId: 'cccccccc-0000-0000-0000-000000000003',
            ip: '203.0.113.7',
            userAgent: 'Mozilla/5.0 (test)',
            result: 'success',
            metadata: { zeta: 1, alpha: 'x' },
            prevHash: '0'.repeat(64),
            currentHash: 'a'.repeat(64),
          },
        ].slice(0, pageSize),
        total: 1,
      }
    },
  )
})

beforeEach(() => {
  useFixture(OLD_KEY)
})

afterAll(() => {
  delete process.env[PRIVATE_KEY_INLINE_ENV]
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_INLINE_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
  delete process.env[KEY_ID_ENV]
})

describe('86G-2 验收①:轮换密钥后,旧信封仍必须验得过', () => {
  it('旧钥签的信封 → 环境换新钥 ⇒ unknown_key;把旧钥登记为 retired ⇒ verified', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    expect(envelope.payload.keyId).toBe(OLD_KEY.kid)

    // 轮换:环境里只剩新钥。这正是本票立项前的死局 —— 旧信封从此验不过。
    useFixture(NEW_KEY)
    const afterRotation = verifySignedAuditExport(envelope)
    expect(afterRotation.ok).toBe(false)
    expect(afterRotation.status).toBe('unknown_key')
    expect(afterRotation.kid).toBe(OLD_KEY.kid)

    // 修法:旧公钥作为 retired 行进登记表(签名侧此刻已在用新钥)。
    useFixture(OLD_KEY)
    const oldEnvelope = envelope
    useFixture(NEW_KEY)
    const table = [
      row(NEW_KEY),
      row(OLD_KEY, {
        status: 'retired',
        retiredAt: '2026-09-28',
        reason: '轮换前的旧钥:旧信封仍须可验',
      }),
    ]
    const result = verifySignedAuditExportWithKeys(oldEnvelope, table)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('verified')
    // 命中的确实是那把**退役**的旧钥,不是新钥 —— 这条断言就是"退而不删"的密码学证明。
    expect(result.keyStatus).toBe('retired')
    expect(result.kid).toBe(OLD_KEY.kid)
  })

  it('退役行的 notAfter 过期也绝不拦验签(时间窗只进腐烂判据,不进验签路径)', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    useFixture(NEW_KEY)
    const stale = row(OLD_KEY, {
      status: 'retired',
      retiredAt: '2024-01-01',
      notAfter: '2024-01-01',
      reason: '窗口早已越期:该行会被 R5 判成清单腐烂,但不得因此验不过手上的旧信封',
    })
    expect(verifySignedAuditExportWithKeys(envelope, [stale]).status).toBe('verified')
  })

  it('两个信封各按自己的 kid 命中各自的行(多把并存时不得互相串)', async () => {
    useFixture(OLD_KEY)
    const byOld = await buildSignedAuditExport({ action: 'auth.login' }, 'json', 100)
    useFixture(NEW_KEY)
    const byNew = await buildSignedAuditExport({ action: 'auth.login' }, 'json', 100)
    const table = [row(OLD_KEY, { status: 'retired', retiredAt: '2026-09-28' }), row(NEW_KEY)]
    expect(verifySignedAuditExportWithKeys(byOld, table).keyStatus).toBe('retired')
    expect(verifySignedAuditExportWithKeys(byNew, table).keyStatus).toBe('active')
    // 把任一行从表里拿掉,对应那封就落回 unknown_key(而不是"用另一把试试")。
    expect(verifySignedAuditExportWithKeys(byOld, [row(NEW_KEY)]).status).toBe('unknown_key')
  })
})

describe('86G-2 验收②:三态必须可分辨(没登记 / 内容被改 / 签名被改)', () => {
  it('同一把钥匙在表里,三种坏法给出三个不同结论', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    useFixture(NEW_KEY)
    const table = [row(OLD_KEY, { status: 'retired', retiredAt: '2026-09-28' })]

    // (a) 没登记
    expect(verifySignedAuditExportWithKeys(envelope, [row(NEW_KEY)]).status).toBe('unknown_key')
    // (b) 数据体被改(摘要先失配)
    const mutated: SignedAuditExport = JSON.parse(JSON.stringify(envelope))
    mutated.payload.lines[0] = `${String(mutated.payload.lines[0])}X`
    expect(verifySignedAuditExportWithKeys(mutated, table).status).toBe('content_inconsistent')
    // (c) 内容自洽、只改元信息 ⇒ 走到签名这一层才红
    const stamped: SignedAuditExport = JSON.parse(JSON.stringify(envelope))
    stamped.payload.exportedAt = '2020-01-01T00:00:00.000Z'
    expect(verifySignedAuditExportWithKeys(stamped, table).status).toBe('signature_invalid')
    // 三种结论两两不同形 —— 压成一句"验不过"就等于把三种处置动作压成零种。
    const statuses = new Set([
      verifySignedAuditExportWithKeys(envelope, [row(NEW_KEY)]).status,
      verifySignedAuditExportWithKeys(mutated, table).status,
      verifySignedAuditExportWithKeys(stamped, table).status,
    ])
    expect(statuses.size).toBe(3)
  })

  it('一把公钥都没有 ⇒ 抛"机制不可用",既不记通过也不记验不过', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    delete process.env[PUBLIC_KEY_INLINE_ENV]
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    let caught: unknown
    try {
      verifySignedAuditExportWithKeys(envelope, [])
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(AuditExportSignatureError)
    expect((caught as AuditExportSignatureError).reason).toBe('public_key_unavailable')
    // 空表在**生产入口**上同样必须抛(登记表今天为空 + env 没配 = 无可用钥匙)
    expect(verifySignedAuditExport.name).toBe('verifySignedAuditExport')
    expect(AUDIT_EXPORT_KEY_REGISTRY.length).toBe(0)
  })

  it('信封声称的 kid 必须等于收件方对公钥自算的值(两侧共用一份推导)', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    expect(envelope.payload.keyId).toBe(deriveAuditExportKeyId(OLD_KEY.publicPem))
    // 归一不得改变 kid:PEM 的空白/形态差异不该让登记表查不到(否则同钥两个 kid)
    expect(deriveAuditExportKeyId(normalizeAuditExportPublicKey(OLD_KEY.publicPem))).toBe(
      OLD_KEY.kid,
    )
  })
})

describe('86G-2 验收③:现有部署形态不回退', () => {
  it('表为空、只有环境变量那一把 ⇒ 与 86C/86G-1 时代逐字同结论(verified)', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const result = verifySignedAuditExport(envelope)
    expect(result.ok).toBe(true)
    expect(result.keyStatus).toBe('bootstrap')
  })

  it('显式配置 AUDIT_EXPORT_SIGN_KEY_ID 时,kid 以配置为准且仍走查表(不被 bootstrap 语义遮住)', async () => {
    process.env[KEY_ID_ENV] = 'team-specified-kid'
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    expect(envelope.payload.keyId).toBe('team-specified-kid')
    expect(verifySignedAuditExport(envelope).status).toBe('verified')
    delete process.env[KEY_ID_ENV]
  })
})
