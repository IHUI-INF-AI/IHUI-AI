// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86C 判据取证:审计证据导出的非对称签名与离线验签。
 *
 * 四条交付判据逐条落成本文件里的用例:
 *  ① 正向 —— 只持公钥即可验签通过(不需要任何对称密钥)
 *  ② 阳性对照 —— 导出内容改一个字节 ⇒ 验签必须失败
 *  ③ 反向对照 —— 把签名换成 HMAC(对称)算出来的 ⇒ 验签路径必须拒绝
 *  ④ 无静默 —— 私钥缺失必须抛错 / 路由 503,绝不返回未签名的导出
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/Redis(8811)——
 * `selectAuditLogs` 用 vi.mock 桩掉,路由的 db / auth 依赖面同样按 mock 注入;
 * 密钥是**测试内现生成的临时 RSA 密钥对**,只活在进程内存,不落盘、不入库。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
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

// 审计链查询面桩掉:本票测的是"导出信封的签名与验签",不是 SQL。
const selectAuditLogsMock = vi.hoisted(() => vi.fn())

vi.mock('../src/db/audit-queries.js', () => ({
  selectAuditLogs: selectAuditLogsMock,
}))
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: 'mock-admin-id', roleId: 1 }),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))
vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(() => []), execute: vi.fn().mockResolvedValue([]) },
  dbRead: { select: vi.fn(() => []) },
}))

import { verifyAccessToken } from '@ihui/auth'
import {
  AuditExportSignatureError,
  buildSignedAuditExport,
  verifySignedAuditExport,
  type AuditExportPayload,
  type SignedAuditExport,
} from '../src/services/siem-exporter.js'
import { auditEvidenceExportRoutes } from '../src/routes/audit-evidence-export.js'
import { hmacSHA256 } from '../src/utils/crypto-extra.js'
import type { AuditLogChainRow } from '../src/db/audit-queries.js'

/** 两把测试密钥:主钥用于签名/验签,副钥用来构造"kid 不匹配"那一型。 */
let primaryPrivate = ''
let primaryPublic = ''
let secondaryPublic = ''

function makeRow(over: Partial<AuditLogChainRow>): AuditLogChainRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    timestamp: '2026-09-27T10:00:00.000Z',
    userId: '22222222-2222-2222-2222-222222222222',
    action: 'auth.login',
    resourceType: 'session',
    resourceId: '33333333-3333-3333-3333-333333333333',
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0 (test)',
    result: 'success',
    metadata: { zeta: 1, alpha: 'x' },
    prevHash: '0'.repeat(64),
    currentHash: 'a'.repeat(64),
    ...over,
  }
}

const ROWS: AuditLogChainRow[] = [
  makeRow({}),
  makeRow({
    id: '44444444-4444-4444-4444-444444444444',
    action: 'admin.op',
    timestamp: '2026-09-27T10:00:01.000Z',
    result: 'failure',
    // metadata 的 key 插入顺序与上一条**故意相反**:序列化必须与此无关
    metadata: { alpha: 'x', zeta: 1 },
  }),
]

function primeEnv(): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = primaryPrivate
  process.env[PUBLIC_KEY_INLINE_ENV] = primaryPublic
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
  delete process.env[KEY_ID_ENV]
}

/** 深拷贝一份信封:篡改用例不得污染原对象,否则"改坏即红"会被测成"什么都没改"。 */
function cloneEnvelope(e: SignedAuditExport): SignedAuditExport {
  return JSON.parse(JSON.stringify(e)) as SignedAuditExport
}

beforeAll(() => {
  const primary = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  const secondary = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  primaryPrivate = primary.privateKey
  primaryPublic = primary.publicKey
  secondaryPublic = secondary.publicKey
})

beforeEach(() => {
  selectAuditLogsMock.mockReset()
  selectAuditLogsMock.mockImplementation(
    async (_filters: unknown, page: number, pageSize: number) => {
      if (page > 1) return { list: [], total: ROWS.length }
      return { list: ROWS.slice(0, pageSize), total: ROWS.length }
    },
  )
  primeEnv()
})

afterAll(() => {
  delete process.env[PRIVATE_KEY_INLINE_ENV]
  delete process.env[PUBLIC_KEY_INLINE_ENV]
})

describe('86C 判据①:只持公钥即可离线验签通过', () => {
  it('buildSignedAuditExport 产出的信封,用公钥验签通过', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    // 验签侧只喂公钥(不持私钥、不持链内 HMAC secret):
    // 私钥此刻从进程环境里彻底摘掉 —— 验签仍必须通过,这才叫"非对称"。
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    delete process.env[PRIVATE_KEY_PATH_ENV]
    expect(process.env[PRIVATE_KEY_INLINE_ENV]).toBeUndefined()
    // 链内那把对称密钥在本测试进程里从未配置 ⇒ 通过不可能是靠它
    expect(process.env.AUDIT_LOG_HMAC_SECRET ?? '').toBe('')
    const result = verifySignedAuditExport(envelope)
    expect(result).toEqual({ ok: true })
    primeEnv()
    expect(envelope.payload.algorithm).toBe('RSA-SHA256')
    expect(envelope.payload.rowCount).toBe(2)
    expect(envelope.payload.lines).toHaveLength(2)
    expect(envelope.payload.filters).toEqual({
      userId: '',
      action: '',
      resourceType: '',
      startDate: '',
      endDate: '',
    })
    expect(envelope.signature.length).toBeGreaterThan(100)
  })

  it('同一份内容 + 同一时刻两次导出,签名字节与摘要全等(键序归一生效)', async () => {
    const at = '2026-09-27T10:00:00.000Z'
    const first = await buildSignedAuditExport({}, 'json', 100, at)
    // 真的把 metadata 的 key 插入顺序翻过来再导一次。不改这一处的话,
    // "两次调用全等"只证明了时钟被固定,证明不了键序归一 —— 那正是本判据的靶子。
    const flipped = { ...(ROWS[1]?.metadata ?? {}) }
    ROWS[1] = { ...ROWS[1]!, metadata: Object.fromEntries(Object.entries(flipped).reverse()) }
    const second = await buildSignedAuditExport({}, 'json', 100, at)
    expect(second.signature).toBe(first.signature)
    expect(second.payload.dataDigest).toBe(first.payload.dataDigest)
    expect(second.payload.lines).toEqual(first.payload.lines)
  })

  it('CEF 格式同样可验签(签名对象覆盖三种格式的交付内容)', async () => {
    const envelope = await buildSignedAuditExport({ action: 'auth.login' }, 'cef', 100)
    expect(envelope.payload.format).toBe('cef')
    expect(verifySignedAuditExport(envelope).ok).toBe(true)
  })
})

describe('86C 判据②:阳性对照 —— 改一个字节必须验不过', () => {
  it('数据体改一个字节 ⇒ 验签失败并点名摘要', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    const last = tampered.payload.lines[0] ?? ''
    tampered.payload.lines[0] = last.slice(0, -1) + 'X' // 恰好一个字符
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('数据体摘要不匹配')
  })

  it('删掉一行(不改摘要)⇒ 行数不自洽被点名', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.lines.pop()
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('行数不自洽')
  })

  it('只改元信息(exportedAt / filters)而签名照抄 ⇒ 签名验不过', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.filters = { ...tampered.payload.filters, userId: 'someone-else' }
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('RSA-SHA256 验签未通过')
  })

  it('换一把公钥来验(kid 不匹配)⇒ 明确拒绝而不是静默通过', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    process.env[PUBLIC_KEY_INLINE_ENV] = secondaryPublic
    const result = verifySignedAuditExport(envelope)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('密钥标识不匹配')
  })
})

describe('86C 判据③:反向对照 —— 对称签名这一型必须被挡住', () => {
  it('把签名换成 HMAC-SHA256(链内那类对称算法)算出来的值 ⇒ 验签拒绝', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const forged = cloneEnvelope(envelope)
    // 模拟"拿了 HMAC 密钥的人自签":内容一字未改,签名却是 MAC 值
    forged.signature = hmacSHA256(
      'symmetric-secret-that-would-leak-self-signing-capability',
      JSON.stringify(forged.payload),
    )
    const result = verifySignedAuditExport(forged)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('验签未通过')
  })

  it('信封结构不合法(缺 payload)⇒ 判不通过并点名,不抛成"验过了"', async () => {
    expect(verifySignedAuditExport({ signature: 'x' })).toEqual({
      ok: false,
      reason: '信封缺少 payload 对象',
    })
    expect(verifySignedAuditExport('not-json-object').ok).toBe(false)
  })
})

describe('86C 判据④:无静默 —— 签名机制不可用必须响亮失败', () => {
  it('私钥缺失 ⇒ buildSignedAuditExport 抛 AuditExportSignatureError', async () => {
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    const err = await buildSignedAuditExport({}, 'json', 100).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuditExportSignatureError)
    expect((err as AuditExportSignatureError).reason).toBe('private_key_unavailable')
  })

  it('公钥缺失 ⇒ 验签路径抛错(不得把"验不了"写成"验过了")', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    delete process.env[PUBLIC_KEY_INLINE_ENV]
    let caught: unknown
    try {
      verifySignedAuditExport(envelope)
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(AuditExportSignatureError)
    expect((caught as AuditExportSignatureError).reason).toBe('public_key_unavailable')
  })

  it('私钥文件路径配了但文件不存在 ⇒ 归因到"文件不存在",不是"未配置"', async () => {
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    process.env[PRIVATE_KEY_PATH_ENV] = 'Z:/definitely/not/here/audit-export-signing-key.pem'
    const err = (await buildSignedAuditExport({}, 'json', 100).catch(
      (e: unknown) => e,
    )) as AuditExportSignatureError
    expect(err).toBeInstanceOf(AuditExportSignatureError)
    expect(err.message).toContain('指向的密钥文件不存在')
    delete process.env[PRIVATE_KEY_PATH_ENV]
  })
})

describe('86C 路由面:requireAdmin 鉴权 + 只读 + 不泄露私钥', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(auditEvidenceExportRoutes, { prefix: '/api/admin/audit-evidence' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
  })

  const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

  it('GET /signed 返回的信封在公钥侧可验通过(出口自证不是装饰品)', async () => {
    primeEnv()
    const res = await server.inject({ method: 'GET', url: '/api/admin/audit-evidence/signed', headers: AUTH_HEADERS })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { code: number; message: string; data: SignedAuditExport }
    expect(body.code).toBe(0)
    expect(verifySignedAuditExport(body.data).ok).toBe(true)
  })

  it('GET /public-key 只发布公钥与 kid;整段响应不含任何私钥材料', async () => {
    primeEnv()
    const res = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/public-key',
      headers: AUTH_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data: { keyId: string; algorithm: string; publicKey: string }
    }
    expect(body.data.algorithm).toBe('RSA-SHA256')
    expect(body.data.publicKey).toContain('PUBLIC KEY')
    expect(body.data.keyId.length).toBeGreaterThan(0)
    // 反向锁:私钥字符串与其 BEGIN 标记都不得出现在响应里
    expect(res.body).not.toContain('PRIVATE KEY')
    expect(res.body).not.toContain(primaryPrivate)
  })

  it('私钥不可用 ⇒ 503 且响应体里没有数据体(不返回未签名导出)', async () => {
    primeEnv()
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    const res = await server.inject({ method: 'GET', url: '/api/admin/audit-evidence/signed', headers: AUTH_HEADERS })
    expect(res.statusCode).toBe(503)
    const body = res.json() as { code: number; message: string; data?: unknown }
    expect(body.code).toBe(503)
    expect(body.message).toContain('AUDIT_EXPORT_SIGN_PRIVATE_KEY')
    expect(body.data).toBeUndefined()
    expect(res.body).not.toContain('"lines"')
    primeEnv()
  })

  it('非管理员(roleId 0)→ 403;未带凭据 → 401', async () => {
    primeEnv()
    const mockVerify = vi.mocked(verifyAccessToken)
    const original = mockVerify.getMockImplementation()
    mockVerify.mockResolvedValue({ userId: 'u-x', roleId: 0 } as never)
    const denied = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/signed',
      headers: AUTH_HEADERS,
    })
    expect(denied.statusCode).toBe(403)
    if (original) mockVerify.mockImplementation(original as never)

    const anonymous = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/signed',
    })
    expect(anonymous.statusCode).toBe(401)
  })

  it('非法参数一律 400(由 Zod 产出错误形状),不得被掩盖成 500', async () => {
    primeEnv()
    const bad = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/signed?userId=not-a-uuid',
      headers: AUTH_HEADERS,
    })
    expect(bad.statusCode).toBe(400)
    const over = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/signed?limit=999999',
      headers: AUTH_HEADERS,
    })
    expect(over.statusCode).toBe(400)
    const zero = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/signed?limit=0',
      headers: AUTH_HEADERS,
    })
    expect(zero.statusCode).toBe(400)
    const badFormat = await server.inject({
      method: 'GET',
      url: '/api/admin/audit-evidence/signed?format=xml',
      headers: AUTH_HEADERS,
    })
    expect(badFormat.statusCode).toBe(400)
    // 错误体形状必须是 { code: number, message: string }(与 errorResponseSchema 一致)
    const body = bad.json() as { code: unknown; message: unknown }
    expect(typeof body.code).toBe('number')
    expect(typeof body.message).toBe('string')
  })

  it('payload 类型收窄:验签函数接收 unknown,信封可原样过 JSON 往返', async () => {
    primeEnv()
    const envelope = await buildSignedAuditExport({ action: 'auth.login' }, 'json', 100)
    const roundTripped: unknown = JSON.parse(JSON.stringify(envelope))
    expect(verifySignedAuditExport(roundTripped).ok).toBe(true)
    // 篡改往返后的数据体一个字节 —— 必须再次失败(证明判定不依赖内存对象身份)
    const mutated = roundTripped as { payload: AuditExportPayload }
    mutated.payload.lines[0] = `${mutated.payload.lines[0]}!`
    expect(verifySignedAuditExport(roundTripped).ok).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
