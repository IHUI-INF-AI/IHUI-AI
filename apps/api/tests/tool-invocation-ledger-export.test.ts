// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86(B04 收口格)明细账签名导出取证:tool_invocation_ledger 记录→导出→验签闭环。
 *
 * 判据逐条落用例:
 *  ① 正向闭环 —— 注入账行 → buildSignedToolInvocationLedgerExport →
 *     verifySignedAuditExport(siem-exporter 既有验签,零第二份)⇒ verified;
 *     数据体逐行可解,证据四要素(invocationId/权限决策/操作者身份/结果档)在行上。
 *  ② 原文纪律 —— 导出行永不含 rawInput/rawOutput/留存列(证据=摘要,不是原文旁路)。
 *  ③ 阳性对照 —— 数据体改一字节 ⇒ content_inconsistent。
 *  ④ 换签名对照 —— 同载荷用另一把私钥重签 ⇒ signature_invalid。
 *  ⑤ 可复现 —— 同内容 + 同 exportedAt 两次导出,签名与 dataDigest 逐字全等。
 *  ⑥ 过滤维度进签名 —— 同数据不同 filters ⇒ 信封不同(裁剪子集重签不再隐身)。
 *  ⑦ 空集 —— rowCount=0 且验签仍通过(不冒红也不假绿)。
 *  ⑧ 无静默 —— 私钥缺失 ⇒ 抛 AuditExportSignatureError,绝不返回未签名信封。
 *  ⑨ 参数即拒 —— filters 形状非法 ⇒ 入口即抛且不触库。
 *  ⑩ 路由层 —— admin 闸门(匿名 401)、Zod 400(非法 outcome / limit 越界)、
 *     出口自证 200、私钥缺失 503(不回未签名数据)。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/Redis(8811)——
 * db.select 用链式桩,密钥是测试内现生成的临时 RSA 对,只活在进程内存。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { createSign, generateKeyPairSync } from 'node:crypto'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const PRIVATE_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY'
const PRIVATE_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY_PATH'
const PUBLIC_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY'
const PUBLIC_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH'
const KEY_ID_ENV = 'AUDIT_EXPORT_SIGN_KEY_ID'

// db 面桩掉:本票测的是"导出信封的签名与验签",不是 SQL(§5 测试隔离)。
const ledgerRowsFixture = vi.hoisted(() => ({ rows: [] as unknown[] }))

vi.mock('../src/config/index.js', () => ({
  config: { AUDIT_LOG_HMAC_SECRET: 'k'.repeat(64), NODE_ENV: 'test' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => chain,
        limit: () => Promise.resolve(ledgerRowsFixture.rows),
      }
      return chain
    },
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
}))

// mock @ihui/database:真实导入该 workspace 包当前不可行(在飞 schema 缺件,仓库既有
// 问题),按加载链上实际消费的导出逐一 stub(缺一个 vitest 会点名,补上即可)。
vi.mock('@ihui/database', () => ({
  toolInvocationLedger: {
    id: 'id',
    invocationId: 'invocation_id',
    userId: 'user_id',
    permissionDecision: 'permission_decision',
    permissionCause: 'permission_cause',
    inputDigest: 'input_digest',
    outputDigest: 'output_digest',
    outcome: 'outcome',
    execBudgetMs: 'exec_budget_ms',
    execBudgetNotInterruptibleReason: 'exec_budget_not_interruptible_reason',
    toolName: 'tool_name',
    sessionId: 'session_id',
    traceId: 'trace_id',
    turn: 'turn',
    streamId: 'stream_id',
    seq: 'seq',
    startedAtMs: 'started_at_ms',
    settledAtMs: 'settled_at_ms',
    chainEntryId: 'chain_entry_id',
    createdAt: 'created_at',
  },
  llmCallLogs: { id: 'llm_call_logs_id' },
  developerApiKeys: { id: 'developer_api_keys_id' },
  keyRateWindowCounts: { id: 'key_rate_window_counts_id' },
  users: { id: 'users_id' },
  roles: { id: 'roles_id' },
  permissions: { id: 'permissions_id' },
  rolePermissions: { id: 'role_permissions_id' },
  userRoles: { id: 'user_roles_id' },
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-admin-id', roleId: 1 }),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

import { verifySignedAuditExport, type SignedAuditExport } from '../src/services/siem-exporter.js'
import {
  TOOL_LEDGER_EXPORT_FORMAT,
  buildSignedToolInvocationLedgerExport,
  type ToolInvocationLedgerExportRow,
} from '../src/services/tool-invocation-ledger-export.js'
import { auditEvidenceExportRoutes } from '../src/routes/audit-evidence-export.js'

/** 两把测试密钥:主钥用于签名/验签,副钥用来构造"换签名"那一型。 */
let primaryPrivate = ''
let primaryPublic = ''
let secondaryPrivate = ''

let USER_SEQ = 0

/** 造一行账行形状(与 DB select 返回同形;createdAt 是 Date)。 */
function makeLedgerRow(over: Partial<ToolInvocationLedgerExportRow> = {}): Record<string, unknown> {
  USER_SEQ += 1
  const n = String(USER_SEQ).padStart(2, '0')
  return {
    id: `00000000-0000-4000-8000-0000000000${n}`,
    invocationId: `fp#${n}`,
    userId: `11111111-1111-4111-8111-1111111111${n}`,
    permissionDecision: 'approved',
    permissionCause: null,
    inputDigest: `args-sha256-v1-${'a'.repeat(64)}`,
    outputDigest: 'b'.repeat(64),
    outcome: 'success',
    execBudgetMs: 30000,
    execBudgetNotInterruptibleReason: null,
    toolName: 'read_file',
    sessionId: `session-${n}`,
    traceId: 'c'.repeat(32),
    turn: 1,
    streamId: null,
    seq: 1,
    startedAtMs: 1730000000000,
    settledAtMs: 1730000001000,
    chainEntryId: `22222222-2222-4222-8222-2222222222${n}`,
    createdAt: new Date(1730000000000 + USER_SEQ * 1000),
    metadata: { ip: '203.0.113.9', userAgent: 'vitest' },
    ...over,
  }
}

function primeEnv(): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = primaryPrivate
  process.env[PUBLIC_KEY_INLINE_ENV] = primaryPublic
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
  delete process.env[KEY_ID_ENV]
}

/** 深拷贝信封:篡改用例不得污染原对象,否则"改坏即红"会被测成"什么都没改"。 */
function cloneEnvelope(envelope: SignedAuditExport): SignedAuditExport {
  return JSON.parse(JSON.stringify(envelope)) as SignedAuditExport
}

async function buildTwoRowEnvelope(): Promise<SignedAuditExport> {
  return buildSignedToolInvocationLedgerExport({}, 100, {
    selectRows: async () =>
      [
        makeLedgerRow(),
        makeLedgerRow({
          outcome: 'failure',
          outputDigest: null,
          permissionDecision: 'denied',
          permissionCause: 'prompt-declined',
        }),
      ] as unknown as ToolInvocationLedgerExportRow[],
    exportedAt: '2026-10-27T00:00:00.000Z',
  })
}

beforeAll(async () => {
  const primary = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const secondary = generateKeyPairSync('rsa', { modulusLength: 2048 })
  primaryPrivate = primary.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  primaryPublic = primary.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  secondaryPrivate = secondary.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  primeEnv()
})

afterAll(() => {
  delete process.env[PRIVATE_KEY_INLINE_ENV]
  delete process.env[PUBLIC_KEY_INLINE_ENV]
})

describe('86 B04 明细账签名导出(service 层:记录→导出→验签闭环)', () => {
  it('① 正向:注入账行 → 签名信封 → 既有 verifySignedAuditExport 判 verified,四要素在行上', async () => {
    const envelope = await buildTwoRowEnvelope()
    expect(envelope.payload.format).toBe(TOOL_LEDGER_EXPORT_FORMAT)
    expect(envelope.payload.rowCount).toBe(2)

    const verdict = verifySignedAuditExport(envelope)
    expect(verdict.ok).toBe(true)
    expect(verdict.status).toBe('verified')

    const first = JSON.parse(envelope.payload.lines[0] ?? '{}') as Record<string, unknown>
    expect(first['invocationId']).toBe('fp#01')
    expect(first['permissionDecision']).toBe('approved')
    expect(first['userId']).toBe('11111111-1111-4111-8111-111111111101')
    expect(first['outcome']).toBe('success')
    expect(first['chainEntryId']).toBe('22222222-2222-4222-8222-222222222201')
    const second = JSON.parse(envelope.payload.lines[1] ?? '{}') as Record<string, unknown>
    expect(second['permissionDecision']).toBe('denied')
    expect(second['permissionCause']).toBe('prompt-declined')
  })

  it('② 原文纪律:导出行不含 rawInput/rawOutput/留存列(证据=摘要,不是原文旁路)', async () => {
    const envelope = await buildTwoRowEnvelope()
    for (const line of envelope.payload.lines) {
      expect(line).not.toMatch(/rawInput|rawOutput|rawRetention|rawPurged/)
    }
  })

  it('③ 阳性对照:数据体改一个字节 ⇒ content_inconsistent', async () => {
    const envelope = cloneEnvelope(await buildTwoRowEnvelope())
    envelope.payload.lines[0] = `${envelope.payload.lines[0] ?? ''} `
    const verdict = verifySignedAuditExport(envelope)
    expect(verdict.ok).toBe(false)
    expect(verdict.status).toBe('content_inconsistent')
  })

  it('④ 换签名对照:同载荷用另一把私钥重签 ⇒ signature_invalid', async () => {
    const envelope = cloneEnvelope(await buildTwoRowEnvelope())
    const { canonicalAuditExportPayload } = await import('../src/services/siem-exporter.js')
    const forged = createSign('RSA-SHA256')
      .update(canonicalAuditExportPayload(envelope.payload), 'utf8')
      .sign(secondaryPrivate, 'base64')
    envelope.signature = forged
    const verdict = verifySignedAuditExport(envelope)
    expect(verdict.ok).toBe(false)
    expect(verdict.status).toBe('signature_invalid')
  })

  it('⑤ 可复现:同内容 + 同 exportedAt 两次导出,签名与 dataDigest 逐字全等', async () => {
    const rows = [makeLedgerRow()] as unknown as ToolInvocationLedgerExportRow[]
    const deps = { selectRows: async () => rows, exportedAt: '2026-10-27T00:00:00.000Z' }
    const a = await buildSignedToolInvocationLedgerExport({}, 100, deps)
    const b = await buildSignedToolInvocationLedgerExport({}, 100, deps)
    expect(a.signature).toBe(b.signature)
    expect(a.payload.dataDigest).toBe(b.payload.dataDigest)
    expect(verifySignedAuditExport(a).ok).toBe(true)
  })

  it('⑥ 过滤维度进签名:同数据不同 filters ⇒ 信封不同(裁剪重签不再隐身)', async () => {
    const rows = [makeLedgerRow()] as unknown as ToolInvocationLedgerExportRow[]
    const deps = { selectRows: async () => rows, exportedAt: '2026-10-27T00:00:00.000Z' }
    const all = await buildSignedToolInvocationLedgerExport({}, 100, deps)
    const filtered = await buildSignedToolInvocationLedgerExport({ outcome: 'success' }, 100, deps)
    expect(all.signature).not.toBe(filtered.signature)
    expect(filtered.payload.filters['outcome']).toBe('success')
    expect(verifySignedAuditExport(filtered).ok).toBe(true)
  })

  it('⑦ 空集:rowCount=0 且验签仍通过(不冒红也不假绿)', async () => {
    const envelope = await buildSignedToolInvocationLedgerExport({}, 100, {
      selectRows: async () => [],
      exportedAt: '2026-10-27T00:00:00.000Z',
    })
    expect(envelope.payload.rowCount).toBe(0)
    expect(envelope.payload.lines).toEqual([])
    const verdict = verifySignedAuditExport(envelope)
    expect(verdict.ok).toBe(true)
    expect(verdict.status).toBe('verified')
  })

  it('⑧ 无静默:私钥缺失 ⇒ 抛 AuditExportSignatureError,绝不返回未签名信封', async () => {
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    delete process.env[PRIVATE_KEY_PATH_ENV]
    try {
      await expect(
        buildSignedToolInvocationLedgerExport({}, 100, {
          selectRows: async () => [],
          exportedAt: '2026-10-27T00:00:00.000Z',
        }),
      ).rejects.toMatchObject({ name: 'AuditExportSignatureError' })
    } finally {
      primeEnv()
    }
  })

  it('⑨ 参数即拒:filters 形状非法(userId 非 UUID)⇒ 入口即抛且不触库', async () => {
    const selectRows = vi.fn(async () => [])
    await expect(
      buildSignedToolInvocationLedgerExport({ userId: 'not-a-uuid' }, 100, {
        selectRows,
        exportedAt: '2026-10-27T00:00:00.000Z',
      }),
    ).rejects.toThrow(/invalid tool-invocation-ledger export filters/)
    expect(selectRows).not.toHaveBeenCalled()
  })
})

describe('86 B04 明细账签名导出(路由层:鉴权 / 参数 / 出口自证 / 503)', () => {
  const buildApp = async (): Promise<ReturnType<typeof Fastify>> => {
    const app = Fastify()
    await app.register(auditEvidenceExportRoutes)
    return app
  }

  it('⑩ 正向:admin 请求走默认查询桩 → 200,信封可被既有验签通过', async () => {
    ledgerRowsFixture.rows = [makeLedgerRow()]
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/tool-invocations/signed',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { data: SignedAuditExport }
      expect(body.data.payload.rowCount).toBe(1)
      expect(verifySignedAuditExport(body.data).ok).toBe(true)
    } finally {
      await app.close()
      ledgerRowsFixture.rows = []
    }
  })

  it('⑪ 匿名(无凭据)⇒ 401,不回任何数据体', async () => {
    const app = await buildApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/tool-invocations/signed' })
      expect(res.statusCode).toBe(401)
      expect(res.body).not.toContain('invocationId')
    } finally {
      await app.close()
    }
  })

  it('⑫ 非法 outcome / limit 越界 ⇒ 400(Zod 判据,非 ajv 500 同型)', async () => {
    const app = await buildApp()
    try {
      const badOutcome = await app.inject({
        method: 'GET',
        url: '/tool-invocations/signed?outcome=whatever',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(badOutcome.statusCode).toBe(400)
      const badLimit = await app.inject({
        method: 'GET',
        url: '/tool-invocations/signed?limit=50001',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(badLimit.statusCode).toBe(400)
    } finally {
      await app.close()
    }
  })

  it('⑬ 私钥缺失 ⇒ 503 可归因文案,不返回未签名数据', async () => {
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    delete process.env[PRIVATE_KEY_PATH_ENV]
    const app = await buildApp()
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/tool-invocations/signed',
        headers: { authorization: 'Bearer test-token' },
      })
      expect(res.statusCode).toBe(503)
      expect(res.body).toContain('AUDIT_EXPORT_SIGN_PRIVATE_KEY')
    } finally {
      await app.close()
      primeEnv()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
