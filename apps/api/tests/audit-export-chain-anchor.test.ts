// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86F ① 判据取证:导出信封的链锚(chainAnchor)绑定。
 *
 * 票面判据逐条落成本文件里的用例:
 *  ① 正向 —— 连续区间 json 导出的信封带 chainAnchor{起始 currentHash/结束
 *     currentHash/区间行数},且端点与行数**从数据体独立复算**对得上;验签通过。
 *  ② 新判据 —— 篡改区间端点(startHash/endHash/rowCount)⇒ `chain_anchor_invalid`;
 *     并且用"换行序 + 重算锚 + 用真私钥重签"证明这条判据**独立于签名**:
 *     签名一切正常,区间不衔接照样红。
 *  ③ 既有判据不回归 —— 改任一行数据仍是 `content_inconsistent`(摘要/行数自证
 *     排在链锚之前),改元信息仍是 `signature_invalid`。
 *  ④ 收件方兼容底线 —— 旧信封(无 chainAnchor,含"删锚重签"模拟的 86F 前导出)
 *     验签行为逐字不变,绝不因新字段判红;cef/leef 与过滤子集(链上不连续)导出
 *     不挂锚、走既有路径。
 *
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL/Redis —— `selectAuditLogs`
 * 用 vi.mock 桩掉;密钥是测试内现生成的临时 RSA 密钥对,只活在进程内存。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
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

// 审计链查询面桩掉:本票测的是"信封与链的锚定",不是 SQL。
const selectAuditLogsMock = vi.hoisted(() => vi.fn())
vi.mock('../src/db/audit-queries.js', () => ({
  selectAuditLogs: selectAuditLogsMock,
}))

import {
  buildSignedAuditExport,
  canonicalAuditExportPayload,
  verifyAuditExportChainAnchor,
  verifySignedAuditExport,
  type AuditExportPayload,
  type SignedAuditExport,
} from '../src/services/siem-exporter.js'
import type { AuditLogChainRow } from '../src/db/audit-queries.js'

const GENESIS = '0'.repeat(64)
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)

let primaryPrivate = ''
let primaryPublic = ''

function makeRow(over: Partial<AuditLogChainRow>): AuditLogChainRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    timestamp: '2026-09-28T10:00:00.000Z',
    userId: '22222222-2222-2222-2222-222222222222',
    action: 'auth.login',
    resourceType: 'session',
    resourceId: '33333333-3333-3333-3333-333333333333',
    ip: '203.0.113.7',
    userAgent: 'Mozilla/5.0 (test)',
    result: 'success',
    metadata: { zeta: 1, alpha: 'x' },
    prevHash: GENESIS,
    currentHash: HASH_A,
    ...over,
  }
}

/** 三行**真实连续**的链段:第 i 行 prevHash = 第 i-1 行 currentHash。 */
const CONTIGUOUS_ROWS: AuditLogChainRow[] = [
  makeRow({ prevHash: GENESIS, currentHash: HASH_A }),
  makeRow({
    id: '44444444-4444-4444-4444-444444444444',
    action: 'admin.op',
    timestamp: '2026-09-28T10:00:01.000Z',
    result: 'failure',
    metadata: { alpha: 'x', zeta: 1 },
    prevHash: HASH_A,
    currentHash: HASH_B,
  }),
  makeRow({
    id: '55555555-5555-5555-5555-555555555555',
    action: 'tool.invoke',
    resourceType: 'agent_tool_call',
    resourceId: 'call-1#1',
    timestamp: '2026-09-28T10:00:02.000Z',
    prevHash: HASH_B,
    currentHash: HASH_C,
  }),
]

/** 两行**链上不连续**的行(过滤子集的形状:各自的 prevHash 接不上上一行)。 */
const NON_CONTIGUOUS_ROWS: AuditLogChainRow[] = [
  makeRow({ prevHash: GENESIS, currentHash: HASH_A }),
  makeRow({
    id: '66666666-6666-6666-6666-666666666666',
    timestamp: '2026-09-28T10:05:00.000Z',
    prevHash: GENESIS, // 接不上第一行
    currentHash: HASH_C,
  }),
]

function primeEnv(): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = primaryPrivate
  process.env[PUBLIC_KEY_INLINE_ENV] = primaryPublic
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
  delete process.env[KEY_ID_ENV]
}

function mockRows(rows: AuditLogChainRow[]): void {
  selectAuditLogsMock.mockReset()
  selectAuditLogsMock.mockImplementation(
    async (_filters: unknown, page: number, pageSize: number) => {
      if (page > 1) return { list: [], total: rows.length }
      return { list: rows.slice(0, pageSize), total: rows.length }
    },
  )
}

/** 深拷贝信封:篡改用例不得污染原对象,否则"改坏即红"会被测成"什么都没改"。 */
function cloneEnvelope(e: SignedAuditExport): SignedAuditExport {
  return JSON.parse(JSON.stringify(e)) as SignedAuditExport
}

/**
 * 用测试私钥对**给定载荷**重签(模拟"签名侧交出一段不连续区间"这一型:
 * 签名合法、自证合法,唯独链锚证明不成立 —— 新判据必须与签名分开归因)。
 */
function resign(payload: AuditExportPayload): string {
  const signer = createSign('RSA-SHA256')
  signer.update(canonicalAuditExportPayload(payload), 'utf8')
  return signer.sign(primaryPrivate, 'base64')
}

/** 从数据体独立复算每行的两列哈希(不复用被测实现,§22c 反镜像复读)。 */
function hashesOf(lines: readonly string[]): { prevHash: string; currentHash: string }[] {
  return lines.map((line) => {
    const parsed = JSON.parse(line) as { prevHash: string; currentHash: string }
    return { prevHash: parsed.prevHash, currentHash: parsed.currentHash }
  })
}

beforeAll(() => {
  const primary = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  primaryPrivate = primary.privateKey
  primaryPublic = primary.publicKey
})

beforeEach(() => {
  mockRows(CONTIGUOUS_ROWS)
  primeEnv()
})

afterAll(() => {
  delete process.env[PRIVATE_KEY_INLINE_ENV]
  delete process.env[PUBLIC_KEY_INLINE_ENV]
})

describe('86F ① 正向:连续区间导出挂链锚,端点与行数从数据体复算对得上', () => {
  it('chainAnchor{startHash/endHash/rowCount} 恰好锚住导出的链段,验签通过', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const anchor = envelope.payload.chainAnchor
    expect(anchor).toBeDefined()
    // 独立复算:锚的三个量必须与 lines 里的哈希逐一对上(不是复读 buildChainAnchor)
    const hashes = hashesOf(envelope.payload.lines)
    expect(anchor?.startHash).toBe(hashes[0]?.currentHash)
    expect(anchor?.startHash).toBe(HASH_A)
    expect(anchor?.endHash).toBe(hashes[hashes.length - 1]?.currentHash)
    expect(anchor?.endHash).toBe(HASH_C)
    expect(anchor?.rowCount).toBe(envelope.payload.lines.length)
    expect(anchor?.rowCount).toBe(3)
    // 区间逐行衔接(正向用例自己也要钉住"数据体确实是连续的",否则红在别处)
    for (let i = 1; i < hashes.length; i++) {
      expect(hashes[i]?.prevHash).toBe(hashes[i - 1]?.currentHash)
    }
    const result = verifySignedAuditExport(envelope)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('verified')
  })

  it('单行区间同样挂锚(startHash === endHash,rowCount=1)', async () => {
    mockRows(CONTIGUOUS_ROWS.slice(0, 1))
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    expect(envelope.payload.chainAnchor).toEqual({
      startHash: HASH_A,
      endHash: HASH_A,
      rowCount: 1,
    })
    expect(verifySignedAuditExport(envelope).status).toBe('verified')
  })

  it('空导出不挂锚(没有区间可锚),验签走既有路径通过', async () => {
    mockRows([])
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    expect(envelope.payload.chainAnchor).toBeUndefined()
    expect(verifySignedAuditExport(envelope).status).toBe('verified')
  })

  it('verifyAuditExportChainAnchor 对无锚载荷直接返回 undefined(旧信封整步跳过)', () => {
    const payload: AuditExportPayload = {
      algorithm: 'RSA-SHA256',
      keyId: 'k',
      format: 'json',
      exportedAt: '2026-09-28T10:00:00.000Z',
      rowCount: 0,
      dataDigest: 'x',
      filters: { userId: '', action: '', resourceType: '', startDate: '', endDate: '' },
      lines: [],
    }
    expect(verifyAuditExportChainAnchor(payload)).toBeUndefined()
  })
})

describe('86F ① 新判据:篡改区间端点 ⇒ chain_anchor_invalid', () => {
  it('改 startHash ⇒ 判"链锚起点不符"(新判据,先于验签)', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.chainAnchor = { ...tampered.payload.chainAnchor!, startHash: HASH_B }
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('chain_anchor_invalid')
    expect(result.reason).toContain('链锚起点不符')
    expect(result.kid).toBe(envelope.payload.keyId)
  })

  it('改 endHash ⇒ 判"链锚终点不符"', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.chainAnchor = { ...tampered.payload.chainAnchor!, endHash: 'f'.repeat(64) }
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('chain_anchor_invalid')
    expect(result.reason).toContain('链锚终点不符')
  })

  it('改 rowCount ⇒ 判"链锚行数与数据体对不上"', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.chainAnchor = { ...tampered.payload.chainAnchor!, rowCount: 2 }
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('chain_anchor_invalid')
    expect(result.reason).toContain('链锚行数与数据体对不上')
  })

  it('签名合法也救不了不连续的区间(链锚判据独立于签名)', async () => {
    // 模拟"签名侧自己交出一段断掉的区间":交换第 2/3 行的行序,
    // 并把锚的端点与行数重算成**交换后**的样子 —— 锚自洽、数据体自洽(摘要重算)、
    // 签名用真私钥重签 ⇒ 唯独逐行衔接断在第 2 行。判红必须来自链锚,不是签名。
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const swapped = cloneEnvelope(envelope)
    const [l1, l2, l3] = swapped.payload.lines
    swapped.payload.lines = [l1 ?? '', l3 ?? '', l2 ?? '']
    swapped.payload.rowCount = swapped.payload.lines.length
    swapped.payload.dataDigest = 'recompute' // 占位,下面用被测同一序列化重算
    const hashes = hashesOf(swapped.payload.lines)
    swapped.payload.chainAnchor = {
      startHash: hashes[0]?.currentHash ?? '',
      endHash: hashes[hashes.length - 1]?.currentHash ?? '',
      rowCount: swapped.payload.lines.length,
    }
    // dataDigest 按既有口径重算(sha256 of canonical lines)——用 canonical 出口独立复算
    const { createHash } = await import('node:crypto')
    swapped.payload.dataDigest = createHash('sha256')
      .update(
        // 与生产同一 canonical 序列化:直接借被测文件的具名出口对 [lines] 做 canonical
        (await import('@ihui/shared')).canonicalStringify(swapped.payload.lines),
        'utf8',
      )
      .digest('hex')
    swapped.signature = resign(swapped.payload)
    const result = verifySignedAuditExport(swapped)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('chain_anchor_invalid')
    expect(result.reason).toContain('链锚区间不连续')
  })

  it('挂锚但行不携带哈希(cef 行形态)⇒ 证明不成立,判红不判绿', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const forged = cloneEnvelope(envelope)
    forged.payload.lines = ['CEF:0|IHUI|API|1.0|UserLogin|3|act=auth.login']
    forged.payload.rowCount = 1
    forged.payload.chainAnchor = {
      startHash: HASH_A,
      endHash: HASH_A,
      rowCount: 1,
    }
    const { createHash } = await import('node:crypto')
    const { canonicalStringify } = await import('@ihui/shared')
    forged.payload.dataDigest = createHash('sha256')
      .update(canonicalStringify(forged.payload.lines), 'utf8')
      .digest('hex')
    forged.signature = resign(forged.payload)
    const result = verifySignedAuditExport(forged)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('chain_anchor_invalid')
    expect(result.reason).toContain('不是 JSON 行')
  })

  it('chainAnchor 形状不合法(非对象/字段类型错)⇒ malformed_envelope,不进内容判定', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const badShape = cloneEnvelope(envelope) as unknown as {
      payload: Record<string, unknown>
      signature: string
    }
    badShape.payload.chainAnchor = { startHash: 123, endHash: HASH_C, rowCount: 3 }
    const result = verifySignedAuditExport(badShape)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('malformed_envelope')
    expect(result.reason).toContain('chainAnchor.startHash')
  })
})

describe('86F ① 既有判据不回归(链锚不得抢走/掩盖旧归因)', () => {
  it('改任一行数据 ⇒ 仍是 content_inconsistent(摘要自证排在链锚之前)', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    const last = tampered.payload.lines[0] ?? ''
    tampered.payload.lines[0] = last.slice(0, -1) + 'X'
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('content_inconsistent')
    expect(result.reason).toContain('数据体摘要不匹配')
  })

  it('删一行 ⇒ 仍是 content_inconsistent(行数不自洽),不被链锚改口', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.lines.pop()
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('content_inconsistent')
    expect(result.reason).toContain('行数不自洽')
  })

  it('只改元信息(exportedAt)而签名照抄 ⇒ 仍是 signature_invalid', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const tampered = cloneEnvelope(envelope)
    tampered.payload.exportedAt = '2020-01-01T00:00:00.000Z'
    const result = verifySignedAuditExport(tampered)
    expect(result.ok).toBe(false)
    expect(result.status).toBe('signature_invalid')
  })
})

describe('86F ① 收件方兼容底线:旧信封(无 chainAnchor)验签行为逐字不变', () => {
  it('删掉 chainAnchor 并用私钥重签(模拟 86F 之前的导出)⇒ verified,不因新字段判红', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const legacy = cloneEnvelope(envelope)
    delete legacy.payload.chainAnchor
    legacy.signature = resign(legacy.payload)
    // 结构上确实回到旧形状:序列化后的签名字节里不再有 chainAnchor 键
    expect(canonicalAuditExportPayload(legacy.payload)).not.toContain('chainAnchor')
    const result = verifySignedAuditExport(legacy)
    expect(result.ok).toBe(true)
    expect(result.status).toBe('verified')
  })

  it('cef 导出:数据体不带哈希 ⇒ 不挂锚,验签走既有路径(与 86C 行为同形)', async () => {
    const envelope = await buildSignedAuditExport({}, 'cef', 100)
    expect(envelope.payload.chainAnchor).toBeUndefined()
    expect(verifySignedAuditExport(envelope).status).toBe('verified')
  })

  it('过滤子集(链上不连续)json 导出 ⇒ 不挂锚、不判红(既有路径)', async () => {
    mockRows(NON_CONTIGUOUS_ROWS)
    const envelope = await buildSignedAuditExport(
      { userId: NON_CONTIGUOUS_ROWS[0]?.userId },
      'json',
      100,
    )
    expect(envelope.payload.chainAnchor).toBeUndefined()
    expect(verifySignedAuditExport(envelope).status).toBe('verified')
  })

  it('新信封过 JSON 往返后仍 verified(链锚判定不依赖内存对象身份)', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 100)
    const roundTripped: unknown = JSON.parse(JSON.stringify(envelope))
    expect(verifySignedAuditExport(roundTripped).status).toBe('verified')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
