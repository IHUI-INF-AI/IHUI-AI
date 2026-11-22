// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SDB-36:promoteCanary / rollbackCanary 的状态迁移必须是 CAS(compare-and-set)。
 *
 * 旧实现只按 name 无条件 UPDATE:自动回滚先把配置置 off/rolled_back,随后并发的 promote
 * 读到旧快照再写回 canary_5pct/is_active=true ⇒ 已回滚的坏版本重新接流量。
 *
 * 夹具:mock db.execute,按 SQL 骨架分流(SELECT 快照 / UPDATE 命中行 / 审计 INSERT),
 * 用 selectQueue 模拟"读取后被并发改写",用 updateRows 模拟 CAS 命中或 0 行。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({ db: { execute: mocks.execute } }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: mocks.info, warn: mocks.warn, error: mocks.error },
}))

const { promoteCanary, rollbackCanary } = await import('../src/services/canary-service.js')

const NAME = 'sdb36-canary'

interface FakeRow {
  id: string
  name: string
  target: string | null
  currentStage: string
  targetStage: string
  failureThreshold: number
  cooldownMinutes: number
  autoRollback: boolean
  status: string
  startedAt: Date | null
  lastPromotedAt: Date | null
  failureCount: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function fakeRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: 'cfg-sdb36',
    name: NAME,
    target: null,
    currentStage: 'canary_1pct',
    targetStage: 'full',
    failureThreshold: 5,
    cooldownMinutes: 0,
    autoRollback: true,
    status: 'active',
    startedAt: new Date('2026-01-01T00:00:00Z'),
    lastPromotedAt: null,
    failureCount: 0,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

// ---------- drizzle SQL 对象解构:取骨架文本与参数(用于断言 CAS 谓词) ----------
// sql`` 的 queryChunks 交错存放 StringChunk(值形如 string[])与原始参数值。
function sqlChunks(query: unknown): unknown[] {
  return (query as { queryChunks?: unknown[] }).queryChunks ?? []
}

function isStringChunk(chunk: unknown): chunk is { value: string[] } {
  return typeof chunk === 'object' && chunk !== null && Array.isArray((chunk as { value?: unknown }).value)
}

function sqlText(query: unknown): string {
  return sqlChunks(query)
    .map((c) => (isStringChunk(c) ? c.value.join('') : ''))
    .join('')
}

function sqlParams(query: unknown): unknown[] {
  return sqlChunks(query)
    .filter((c) => !isStringChunk(c))
    .map((c) =>
      typeof c === 'object' && c !== null && 'value' in c
        ? (c as { value: unknown }).value
        : c,
    )
}

let selectQueue: FakeRow[]
let updateRows: Array<{ id: string }>
let updateTexts: string[]
let updateParams: unknown[][]
let auditInserts: number

beforeEach(() => {
  selectQueue = []
  updateRows = []
  updateTexts = []
  updateParams = []
  auditInserts = 0
  mocks.execute.mockReset()
  mocks.warn.mockReset()
  mocks.execute.mockImplementation(async (query: unknown) => {
    const text = sqlText(query)
    if (text.includes('CREATE TABLE')) return []
    if (text.includes('FROM canary_configs')) {
      const next = selectQueue.shift()
      return next ? [next] : []
    }
    if (text.includes('UPDATE canary_configs')) {
      updateTexts.push(text)
      updateParams.push(sqlParams(query))
      return updateRows
    }
    if (text.includes('INSERT INTO canary_audit_logs')) {
      auditInserts += 1
      return []
    }
    return []
  })
})

describe('SDB-36 canary 状态迁移 CAS', () => {
  it('① promote 读到 canary_1pct 但库已被并发置 off ⇒ 命中 0 行,不覆盖并报冲突', async () => {
    // 第一次读:promote 拿到的旧快照;第二次读:冲突后重读到的真实状态(已被自动回滚)。
    selectQueue = [
      fakeRow({ currentStage: 'canary_1pct', isActive: true, status: 'active' }),
      fakeRow({ currentStage: 'off', isActive: false, status: 'rolled_back' }),
    ]
    updateRows = []

    await expect(promoteCanary(NAME)).rejects.toMatchObject({
      statusCode: 409,
      errorCode: 'CONFLICT',
    })

    // UPDATE 带 CAS 谓词,且谓词值来自读取时的快照(而不是无条件按 name 写)。
    expect(updateTexts).toHaveLength(1)
    expect(updateTexts[0]).toContain('AND current_stage =')
    expect(updateTexts[0]).toContain('AND is_active =')
    expect(updateTexts[0]).toContain('RETURNING id')
    expect(updateParams[0]?.slice(-2)).toEqual(['canary_1pct', true])

    // 冲突后重新读取了当前状态,并发写入没有被覆盖。
    expect(selectQueue).toHaveLength(0)
    expect(mocks.warn).toHaveBeenCalledWith(
      '[canary] state transition conflict, concurrent update detected',
      expect.objectContaining({ actualStage: 'off', actualActive: false }),
    )
    // 没有落 promote 审计日志。
    expect(auditInserts).toBe(0)
  })

  it('② rollback 正常命中 ⇒ 置 off/rolled_back 并写审计', async () => {
    selectQueue = [fakeRow({ currentStage: 'canary_5pct', isActive: true, status: 'active' })]
    updateRows = [{ id: 'cfg-sdb36' }]

    const result = await rollbackCanary(NAME, 'manual rollback')

    expect(updateTexts).toHaveLength(1)
    expect(updateTexts[0]).toContain('AND current_stage =')
    expect(updateTexts[0]).toContain('AND is_active =')
    expect(updateParams[0]?.slice(-2)).toEqual(['canary_5pct', true])
    expect(result.currentStage).toBe('off')
    expect(result.isActive).toBe(false)
    expect(auditInserts).toBe(1)
  })

  it('③ promote 正常命中 ⇒ 推进到下一阶段并保持活跃', async () => {
    selectQueue = [fakeRow({ currentStage: 'canary_1pct', isActive: true, status: 'active' })]
    updateRows = [{ id: 'cfg-sdb36' }]

    const result = await promoteCanary(NAME)

    expect(updateTexts).toHaveLength(1)
    expect(updateParams[0]?.slice(-2)).toEqual(['canary_1pct', true])
    expect(result.currentStage).toBe('canary_5pct')
    expect(result.isActive).toBe(true)
    expect(result.failureCount).toBe(0)
    expect(auditInserts).toBe(1)
    expect(mocks.warn).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
