// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86G-2 的第二半:**匿名面按 kid 取公钥**(HTTP 端到端,不是 service 单测的复读)。
 *
 * 为什么必须有这一档:86C 把 `kid` 写进信封,就是要收件方**自取**对应公钥;86G-1 开了
 * 免鉴权公钥端点,却只会回"当前那一把"。于是轮换之后,外部审计方拿着旧信封的 kid 来取钥匙,
 * 取到的是新钥匙 ⇒ 验不过 —— 登记表里明明登着旧公钥(退而不删),公开面却递不出来。
 * 那一半只在 service 层被测过(见 audit-export-key-registry.test.ts 的验收①),
 * **HTTP 面上当时零判据**:把路由改回"永远回当前公钥",所有既有测试照绿。
 *
 * 六条判据:
 *  ① 正向闭环 —— `?kid=` 命中已登记的 retired 键 ⇒ 200 + `keyStatus:'retired'`,并且
 *     用它返回的那串公钥**独立验签**一份由该旧私钥签好的真信封必须通过(用 node:crypto
 *     自己验,不复用被测实现 ⇒ 不是复读机);
 *  ② 反回落(本票的牙齿)—— 未登记 kid ⇒ 404 且**响应体里不得出现当前公钥的任何一个字节**:
 *     回落成"给你当前这把"就是把"没登记"伪装成"钥匙不对",两种处置动作相反;
 *  ③ 空值 `?kid=` ⇒ 400,并说明要么不带要么带信封里的 kid;
 *  ④ 不带 kid ⇒ 响应字段集与 86G-1 逐字同形(三键),本票不得悄悄给老形状加键;
 *  ⑤ 匿名路由**仍只有一条**(新增能力用 query 参数,不用第二条匿名路由 —— §5 鉴权面
 *     公开化必须显式列举);admin 面共用同一 handler,同样支持 kid;
 *  ⑥ 整段响应不含私钥材料(含注入那把旧钥匙的私钥原文)。
 *
 * 测试隔离:全程不连生产库;密钥是**测试内现生成**的临时 RSA 密钥对,只活在进程内存。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { createPublicKey, verify } from 'node:crypto'

// 注入一把"已轮换的旧钥匙"到登记表:登记表本体刻意保持为空(真实台账不许为不存在的
// 钥匙写占位行,见 audit-export-key-registry.test.ts:229),所以轮换场景只能在
// **本文件的模块替身**里造 —— 它不改动仓内那一份清单。
const oldKey = vi.hoisted(() => ({ public: '', private: '', kid: '' }))

vi.mock('../src/services/audit-export-key-registry.js', async (importOriginal) => {
  const real = (await importOriginal()) as typeof AuditExportKeyRegistry
  const { generateKeyPairSync } = await import('node:crypto')
  const kp = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  oldKey.public = kp.publicKey
  oldKey.private = kp.privateKey
  oldKey.kid = real.deriveAuditExportKeyId(kp.publicKey)
  return {
    ...real,
    AUDIT_EXPORT_KEY_REGISTRY: [
      {
        kid: oldKey.kid,
        publicKey: kp.publicKey,
        status: 'retired',
        reason: '取证:轮换期内旧信封仍需可验',
        addedAt: '2026-01-01',
        retiredAt: '2026-06-01',
      },
    ],
  }
})

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const PRIVATE_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY'
const PRIVATE_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY_PATH'
const PUBLIC_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY'
const PUBLIC_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH'
const KEY_ID_ENV = 'AUDIT_EXPORT_SIGN_KEY_ID'

const selectAuditLogsMock = vi.hoisted(() => vi.fn())
vi.mock('../src/db/audit-queries.js', () => ({ selectAuditLogs: selectAuditLogsMock }))
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

import { buildSignedAuditExport, canonicalAuditExportPayload } from '../src/services/siem-exporter.js'
import {
  auditEvidenceExportRoutes,
  auditEvidencePublicKeyRoutes,
} from '../src/routes/audit-evidence-export.js'
import type { AuditLogChainRow } from '../src/db/audit-queries.js'
import type * as AuditExportKeyRegistry from '../src/services/audit-export-key-registry.js'

let currentPrivate = ''
let currentPublic = ''

function makeRow(over: Partial<AuditLogChainRow>): AuditLogChainRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    timestamp: '2026-09-28T10:00:00.000Z',
    userId: '22222222-2222-2222-2222-222222222222',
    action: 'auth.login',
    resourceType: 'session',
    resourceId: '33333333-3333-3333-3333-333333333333',
    ip: '203.0.113.9',
    userAgent: 'Mozilla/5.0 (test)',
    result: 'success',
    metadata: { alpha: 'x' },
    prevHash: '0'.repeat(64),
    currentHash: 'a'.repeat(64),
    ...over,
  }
}

function useCurrentKey(): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = currentPrivate
  process.env[PUBLIC_KEY_INLINE_ENV] = currentPublic
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
  delete process.env[KEY_ID_ENV]
}

function useOldKey(): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = oldKey.private
  process.env[PUBLIC_KEY_INLINE_ENV] = oldKey.public
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
  delete process.env[KEY_ID_ENV]
}

describe('86G-2 第二半:匿名/admin 公钥面按 kid 取钥匙(轮换期外部可验)', () => {
  const server = Fastify({ logger: false })
  const ANON_URL = '/api/audit-evidence/public-key'
  const ADMIN_URL = '/api/admin/audit-evidence/public-key'
  const ADMIN_HEADERS = { authorization: 'Bearer mock-access-token' }

  beforeAll(async () => {
    const { generateKeyPairSync } = await import('node:crypto')
    const kp = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    currentPrivate = kp.privateKey
    currentPublic = kp.publicKey
    await server.register(rateLimit, { max: 1000, timeWindow: '1 minute' })
    await server.register(auditEvidencePublicKeyRoutes, { prefix: '/api/audit-evidence' })
    await server.register(auditEvidenceExportRoutes, { prefix: '/api/admin/audit-evidence' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
    delete process.env[PRIVATE_KEY_INLINE_ENV]
    delete process.env[PUBLIC_KEY_INLINE_ENV]
  })

  beforeEach(() => {
    selectAuditLogsMock.mockReset()
    selectAuditLogsMock.mockImplementation(async () => ({
      list: [makeRow({})],
      total: 1,
    }))
    useCurrentKey()
  })

  it('① 正向闭环:?kid 命中已登记的 retired 键 ⇒ 200 + keyStatus,返回的公钥能独立验旧信封', async () => {
    // 先用**旧钥匙**签一份真信封(kid 由旧公钥派生),再轮换环境到当前钥匙 ——
    // 这就是轮换后审计方手里的东西:旧信封 + 信封里记的 kid。
    useOldKey()
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    expect(envelope.payload.keyId).toBe(oldKey.kid)
    useCurrentKey()

    const res = await server.inject({ method: 'GET', url: `${ANON_URL}?kid=${oldKey.kid}` })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { keyId: string; algorithm: string; publicKey: string; keyStatus: string }
    }
    expect(body.data.keyId).toBe(oldKey.kid)
    expect(body.data.algorithm).toBe('RSA-SHA256')
    expect(body.data.publicKey).toBe(oldKey.public)
    // retired 必须照样递得出来,并且**如实标注**它是已轮换的键(不标注就让人以为在用它签新东西)
    expect(body.data.keyStatus).toBe('retired')

    // 独立验签:不复用被测实现,按签名对象规则(canonicalStringify 的等价物)自己验一次。
    const signature = envelope.signature
    const canonical = canonicalAuditExportPayload(envelope.payload)
    const ok = verify(
      'RSA-SHA256',
      Buffer.from(canonical, 'utf8'),
      createPublicKey(body.data.publicKey),
      Buffer.from(signature, 'base64'),
    )
    expect(ok, '匿名面给出的旧公钥验不过旧信封 ⇒ 交付的材料不可用').toBe(true)
  })

  it('② 反回落:?kid 未登记 ⇒ 404 点名该 kid,且响应体里绝不出现当前公钥', async () => {
    const res = await server.inject({ method: 'GET', url: `${ANON_URL}?kid=ihui-audit-export-ffffffffffffffff` })
    expect(res.statusCode).toBe(404)
    const text = res.body
    expect(text).toContain('ihui-audit-export-ffffffffffffffff')
    // 这一条是本票的牙齿:把实现改回"查不到就回当前公钥",这里必红。
    expect(text).not.toContain(currentPublic.trim())
    expect(text).not.toContain('-----BEGIN PUBLIC KEY-----')
    // 也绝不被当成"当前这把能用"
    const body = res.json() as { code: number }
    expect(body.code).not.toBe(0)
  })

  it('③ 空值 ?kid= ⇒ 400 并给出处置动作,不回 200 也不回当前公钥', async () => {
    const res = await server.inject({ method: 'GET', url: `${ANON_URL}?kid=` })
    expect(res.statusCode).toBe(400)
    expect(res.body).not.toContain('-----BEGIN PUBLIC KEY-----')
    expect(res.json() as { code: number }).toMatchObject({ code: 400 })
  })

  it('④ 不带 kid ⇒ 字段集与 86G-1 逐字同形(三键),本票没给老形状偷偷加键', async () => {
    const res = await server.inject({ method: 'GET', url: ANON_URL })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data: Record<string, unknown> }
    expect(Object.keys(body.data).sort()).toEqual(['algorithm', 'keyId', 'publicKey'])
    expect(body.data.publicKey).toBe(currentPublic)
  })

  it('⑤ 匿名面仍只有一条路由;admin 面共用同一实现(两侧对同一 kid 逐字同答)', async () => {
    // commonPrefix:false ⇒ 每行都是完整路径。默认(树状 + 公共前缀折叠)会把
    // `/api/audit-evidence/` 与 `public-key` 拆在两行,按"行内含完整前缀"筛就是 0 命中 ——
    // 那不是路由不存在,是筛法与输出形态不同形(本条第一版就是这样误红的)。
    const routes = server
      .printRoutes({ commonPrefix: false })
      .split('\n')
      .filter((line) => line.includes('public-key'))
    expect(routes.length).toBe(2) // 匿名 1 条 + admin 1 条,不多不少
    expect(routes.filter((line) => line.includes('/api/audit-evidence/')).length).toBe(1)
    expect(routes.filter((line) => line.includes('/api/admin/audit-evidence/')).length).toBe(1)

    const anon = await server.inject({ method: 'GET', url: `${ANON_URL}?kid=${oldKey.kid}` })
    const admin = await server.inject({
      method: 'GET',
      url: `${ADMIN_URL}?kid=${oldKey.kid}`,
      headers: ADMIN_HEADERS,
    })
    expect(admin.statusCode).toBe(200)
    // 两侧差别只允许存在于"挂在哪个作用域(要不要过 requireAdmin)",响应形状必须逐字同形
    expect(admin.json()).toEqual(anon.json())

    const anonUnknown = await server.inject({
      method: 'GET',
      url: `${ANON_URL}?kid=ihui-audit-export-0000000000000000`,
    })
    const adminUnknown = await server.inject({
      method: 'GET',
      url: `${ADMIN_URL}?kid=ihui-audit-export-0000000000000000`,
      headers: ADMIN_HEADERS,
    })
    expect(adminUnknown.statusCode).toBe(anonUnknown.statusCode)
    expect(adminUnknown.body).toBe(anonUnknown.body)
  })

  it('⑥ 反向锁:两侧响应都不含任何私钥材料(含注入那把旧钥匙的私钥原文)', async () => {
    for (const url of [`${ANON_URL}?kid=${oldKey.kid}`, ANON_URL]) {
      const res = await server.inject({ method: 'GET', url })
      expect(res.body).not.toMatch(/PRIVATE KEY/)
      expect(res.body).not.toContain(oldKey.private)
      expect(res.body).not.toContain(currentPrivate)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
