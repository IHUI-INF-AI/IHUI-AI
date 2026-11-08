// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-646 判据取证:审计证据导出必须走 ASC + (timestamp,id) 键集游标。
 *
 * 这条夹具同时钉住四件事(缺一即"改回旧实现仍绿"):
 *  ① 导出只调用**导出专用**查询(两页共 2 条 SQL,不是展示查询的 DESC + COUNT ×2);
 *  ② SQL 必须 `ORDER BY timestamp ASC, id ASC`,且不含 `DESC` / `OFFSET`;
 *  ③ 第二页把第 1 页末行的 (timestamp, id) 作为游标传入(键集,不是偏移);
 *  ④ 两页之间插入的新行也会被继续取到:行不重复、不跳过,链锚按升序哈希连续成立。
 *
 * 全程不连库:db 只做 SQL 文本/参数采集并按页返回内存行;密钥是测试内现生成的临时 RSA。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createHash, generateKeyPairSync } from 'node:crypto'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const PRIVATE_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY'
const PUBLIC_KEY_INLINE_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY'
const PRIVATE_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PRIVATE_KEY_PATH'
const PUBLIC_KEY_PATH_ENV = 'AUDIT_EXPORT_SIGN_PUBLIC_KEY_PATH'

const { dbReadExecute } = vi.hoisted(() => ({ dbReadExecute: vi.fn() }))
vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([]) },
  dbRead: { execute: dbReadExecute, select: vi.fn() },
}))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { buildSignedAuditExport } from '../src/services/siem-exporter.js'

const GENESIS = '0'.repeat(64)
const PAGE_SIZE = 500
const INITIAL_ROWS = 520
const NEW_ROW_INDEX = INITIAL_ROWS
const BASE_TS = Date.UTC(2026, 8, 28, 0, 0, 0)

let privateKey = ''
let publicKey = ''

interface ChunkLike {
  constructor?: { name?: string }
  value?: unknown
  queryChunks?: unknown[]
}

function idFor(i: number): string {
  return `11111111-0000-4000-8000-${String(i).padStart(12, '0')}`
}

function timestampFor(i: number): string {
  return new Date(BASE_TS + i * 1000).toISOString()
}

function hashFor(i: number): string {
  return createHash('sha256').update(`audit-row-${i}`).digest('hex')
}

function rawRow(i: number): Record<string, unknown> {
  return {
    id: idFor(i),
    timestamp: timestampFor(i),
    user_id: '22222222-0000-4000-8000-000000000001',
    action: 'auth.login',
    resource_type: 'session',
    resource_id: null,
    ip: '203.0.113.7',
    user_agent: 'Mozilla/5.0 (test)',
    result: 'success',
    metadata: {},
    prev_hash: i === 0 ? GENESIS : hashFor(i - 1),
    current_hash: hashFor(i),
  }
}

/** 递归采集 drizzle SQL 里的字面片段与参数(不执行、不碰数据库)。 */
function collectSql(chunk: unknown, acc: { text: string; params: unknown[] }): void {
  if (!chunk || typeof chunk !== 'object') {
    acc.params.push(chunk)
    return
  }
  const c = chunk as ChunkLike
  if (Array.isArray(c.value) && !Array.isArray(c.queryChunks)) {
    acc.text += c.value.join('')
    return
  }
  if (Array.isArray(c.queryChunks)) {
    for (const child of c.queryChunks) collectSql(child, acc)
    return
  }
  // drizzle 把插值原样放进 queryChunks(Date/string/number),由 buildQuery 参数化。
  acc.params.push(chunk)
}

function sqlOf(query: unknown): { text: string; params: unknown[] } {
  const acc = { text: '', params: [] as unknown[] }
  collectSql(query, acc)
  return acc
}

function primeEnv(): void {
  process.env[PRIVATE_KEY_INLINE_ENV] = privateKey
  process.env[PUBLIC_KEY_INLINE_ENV] = publicKey
  delete process.env[PRIVATE_KEY_PATH_ENV]
  delete process.env[PUBLIC_KEY_PATH_ENV]
}

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  privateKey = pair.privateKey
  publicKey = pair.publicKey
})

afterAll(() => {
  delete process.env[PRIVATE_KEY_INLINE_ENV]
  delete process.env[PUBLIC_KEY_INLINE_ENV]
})

const initialRows = Array.from({ length: INITIAL_ROWS }, (_, i) => rawRow(i))
const newRow = rawRow(NEW_ROW_INDEX)

let queries: { text: string; params: unknown[] }[]

beforeEach(() => {
  queries = []
  dbReadExecute.mockReset()
  dbReadExecute.mockImplementation(async (query: unknown) => {
    queries.push(sqlOf(query))
    if (queries.length === 1) return initialRows.slice(0, PAGE_SIZE)
    if (queries.length === 2) {
      // 第 1 页取完后,导出期间新写入一行(时间戳排在所有已读行之后)。
      return [...initialRows.slice(PAGE_SIZE), newRow]
    }
    return []
  })
  primeEnv()
})

describe('F-646 导出链路:ASC + 键集游标,链锚与升序哈希一致', () => {
  it('两页导出只用导出专用查询,游标续页且新写入行不被跳过', async () => {
    const envelope = await buildSignedAuditExport({}, 'json', 10000)

    // ① 两页 = 2 条 SQL。旧展示查询每页还要一次 COUNT(共 4 条),这里会直接翻红。
    expect(queries).toHaveLength(2)

    // ② 升序 + 无偏移;旧实现是 ORDER BY timestamp DESC LIMIT/OFFSET。
    for (const q of queries) {
      expect(q.text).toContain('ORDER BY timestamp ASC, id ASC')
      expect(q.text).not.toContain('DESC')
      expect(q.text).not.toContain('OFFSET')
    }
    expect(queries[0]?.text).not.toContain('(timestamp, id) >')

    // ③ 第二页游标恰为第 1 页末行 (timestamp, id),不是 page=2/offset=500。
    expect(queries[1]?.text).toContain('(timestamp, id) >')
    expect(queries[1]?.params).toContain(idFor(PAGE_SIZE - 1))
    const cursorDates = (queries[1]?.params ?? []).filter((p): p is Date => p instanceof Date)
    expect(cursorDates.map((d) => d.toISOString())).toContain(timestampFor(PAGE_SIZE - 1))

    // ④ 521 行按升序逐行衔接,新行被取到,且没有任何行重复/缺失。
    const parsed = envelope.payload.lines.map(
      (line) =>
        JSON.parse(line) as {
          id: string
          timestamp: string
          prevHash: string
          currentHash: string
        },
    )
    const expectedIds = [...initialRows, newRow].map((r) => String(r['id']))
    expect(parsed.map((r) => r.id)).toEqual(expectedIds)
    expect(parsed.map((r) => r.timestamp)).toEqual(expectedIds.map((_, i) => timestampFor(i)))
    for (let i = 1; i < parsed.length; i++) {
      expect(parsed[i]?.prevHash).toBe(parsed[i - 1]?.currentHash)
    }

    // 链锚必须按升序首尾哈希生成(旧 DESC 序下 buildChainAnchor 会直接不挂锚)。
    expect(envelope.payload.chainAnchor).toEqual({
      startHash: hashFor(0),
      endHash: hashFor(NEW_ROW_INDEX),
      rowCount: INITIAL_ROWS + 1,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
