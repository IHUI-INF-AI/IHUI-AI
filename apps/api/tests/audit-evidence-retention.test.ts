// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86D「证据流水的保留策略与墓碑」apps/api 回归(2026-09-28)。
 *
 * 钉五件事(对应票面判据 1-5):
 * 1. **dry-run 默认零写入**:不带 apply 时 UPDATE/DELETE 调用数**恒为 0**(数 mock 调用,
 *    不是"看起来没报错");
 * 2. **原文 0 天**:到期行的 metadata 原文三族键被剥、rawRetained=false、rawPurgedAt 有值、
 *    墓碑带前锚点 prevCurrentHash;**行仍在**(全文件无 DELETE FROM audit_logs_chain 形态);
 * 3. **墓碑可分辨(核心)**:同一把尺子 auditEvidenceIntegrityReport 对
 *    ①未清理 / ②合规清理 / ③删一行·改一字节 三张面必须给出**三种不同结论**,
 *    且 ③ 永不 valid=true;
 * 4. **规模闸**:候选 > AUDIT_EVIDENCE_MAX_PURGE 时 apply 档整轮拒跑并打印实数,零改写;
 * 5. **变异**:把 ② 的墓碑判定改坏 —— 篡改者仿造墓碑字段 / 篡改已清理行 ——
 *    判据必须翻红(证明结论由哈希校验背书,不是"见标记就绿"的恒真式)。
 *
 * 全程 mock db/logger/config/@ihui/database,不触任何真实库(§5 测试隔离铁律);
 * 链的构造与重算走与生产同一份 computeAuditHash / verifyAuditLogIntegrity(§22c 直接 import,零镜像)。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'

const { mockLoggerWarn, mockLoggerInfo } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerInfo: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: mockLoggerInfo, warn: mockLoggerWarn, error: vi.fn() },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(64),
    NODE_ENV: 'test',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: vi.fn(), execute: vi.fn() },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  llmCallLogs: { id: 'llm_call_logs_id' },
}))

import { computeAuditHash, verifyAuditLogIntegrity } from '../src/services/audit-log-service.js'
import {
  RAW_EVIDENCE_METADATA_FIELDS,
  resolveAuditEvidencePolicy,
  collectRawEvidenceKeys,
  buildPurgedEvidenceMetadata,
  isCompliantEvidenceTombstone,
  planEvidenceRechain,
  applyEvidenceUpdatesToRows,
  auditEvidenceIntegrityReport,
  runAuditEvidenceRetention,
  type EvidenceChainRow,
  type EvidenceTx,
} from '../src/jobs/audit-evidence-retention.js'

const dialect = new PgDialect()
const GENESIS = '0'.repeat(64)

// =============================================================================
// 夹具:与 recordAuditLog 逐字同形的链构造器(同一把 computeAuditHash)
// =============================================================================

interface HashInput {
  timestamp: string
  userId: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  result: string | null
  metadata: Record<string, unknown> | null
}

function inputOf(
  row: Partial<EvidenceChainRow> & { metadata: Record<string, unknown> | null },
): HashInput {
  return {
    timestamp: row.timestamp as string,
    userId: row.userId ?? null,
    action: row.action as string,
    resourceType: row.resourceType ?? null,
    resourceId: row.resourceId ?? null,
    result: row.result ?? null,
    metadata: row.metadata,
  }
}

/** n 行明文链:每行 metadata 都带原文三族键(body/params/query)⇒ 全部是 0 天档候选。 */
function buildChain(n: number): EvidenceChainRow[] {
  const rows: EvidenceChainRow[] = []
  let prev = GENESIS
  for (let i = 0; i < n; i++) {
    const base = {
      timestamp: new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString(),
      userId: null,
      action: 'data.write',
      resourceType: 'chat',
      resourceId: `res-${i}`,
      result: 'success',
      metadata: {
        method: 'POST',
        body: `RAW-BODY-${i}`,
        params: { prompt: `PROMPT-${i}` },
        query: { q: `QUERY-${i}` },
      } as Record<string, unknown>,
    }
    const currentHash = computeAuditHash(prev, inputOf(base))
    rows.push({
      id: `id-${i}`,
      ip: '10.0.0.1',
      userAgent: 'ua',
      ...base,
      prevHash: prev,
      currentHash,
    })
    prev = currentHash
  }
  return rows
}

// =============================================================================
// 假事务:按 SQL 文本路由 SELECT 结果、记录全部语句(UPDATE/DELETE 零与否直接可数)
// =============================================================================

interface FakeTxOptions {
  chain: EvidenceChainRow[]
  structExpired: number
  rawCandidates: number
  /** 首批候选 id(模拟 SQL 谓词命中集)。 */
  targetIds: string[]
}

function sqlOf(q: SQL): { text: string; params: unknown[] } {
  const query = dialect.sqlToQuery(q)
  return { text: query.sql.replace(/\s+/g, ' ').trim(), params: query.params }
}

function makeFakeTx(opts: FakeTxOptions) {
  const statements: Array<{ text: string; params: unknown[] }> = []
  const tx: EvidenceTx = {
    async execute(q: SQL) {
      const { text, params } = sqlOf(q)
      statements.push({ text, params })
      if (text.includes('pg_advisory_xact_lock')) return []
      if (text.includes('COUNT(*)::int AS cnt')) {
        // 结构超期计数带 180 参数,原文候选计数带 0 参数 —— 按参数区分两条 COUNT。
        return [{ cnt: params[0] === 180 ? opts.structExpired : opts.rawCandidates }]
      }
      if (text.startsWith('SELECT id, timestamp FROM')) {
        return opts.targetIds.map((id) => {
          const row = opts.chain.find((r) => r.id === id)
          return { id, timestamp: new Date(row ? row.timestamp : Date.now()) }
        })
      }
      if (text.startsWith('SELECT id, timestamp, user_id')) {
        const first = opts.chain.find((r) => r.id === opts.targetIds[0])
        const from = first ? new Date(first.timestamp).getTime() : 0
        return opts.chain
          .filter((r) => new Date(r.timestamp).getTime() >= from)
          .map((r) => ({
            id: r.id,
            timestamp: new Date(r.timestamp),
            user_id: r.userId,
            action: r.action,
            resource_type: r.resourceType,
            resource_id: r.resourceId,
            ip: r.ip,
            user_agent: r.userAgent,
            result: r.result,
            metadata: r.metadata,
            prev_hash: r.prevHash,
            current_hash: r.currentHash,
          }))
      }
      if (text.startsWith('UPDATE')) return []
      throw new Error(`假事务收到未预期 SQL: ${text.slice(0, 80)}`)
    },
  }
  return { tx, statements }
}

function depsFor(fake: { tx: EvidenceTx }, auditWrite = vi.fn(async () => 'audit-write-id')) {
  return {
    transaction: async <T>(fn: (tx: EvidenceTx) => Promise<T>): Promise<T> => fn(fake.tx),
    auditWrite,
  }
}

const countWrites = (statements: Array<{ text: string }>) =>
  statements.filter((s) => /^(UPDATE|DELETE)/.test(s.text)).length

// =============================================================================

describe('86D 审计证据保留策略(env 口径照抄 retentionOf 形态)', () => {
  it('默认 = 拍板口径:原文 0 天 / 结构 180 天 / 批次 50 / 规模闸 200', () => {
    expect(resolveAuditEvidencePolicy({})).toEqual({
      rawDays: 0,
      structDays: 180,
      batch: 50,
      maxPurge: 200,
    })
  })
  it('env 可覆盖;0 是合法天数;非法/负值回落默认', () => {
    const p = resolveAuditEvidencePolicy({
      AUDIT_EVIDENCE_RAW_RETENTION_DAYS: '3',
      AUDIT_EVIDENCE_STRUCT_RETENTION_DAYS: '90',
      AUDIT_EVIDENCE_MAX_PURGE: '10',
    })
    expect(p).toMatchObject({ rawDays: 3, structDays: 90, maxPurge: 10 })
    expect(resolveAuditEvidencePolicy({ AUDIT_EVIDENCE_RAW_RETENTION_DAYS: '-1' }).rawDays).toBe(0)
    expect(
      resolveAuditEvidencePolicy({ AUDIT_EVIDENCE_STRUCT_RETENTION_DAYS: 'abc' }).structDays,
    ).toBe(180)
  })
  it('原文字段族登记在案:body(历史行)/params/query(站内带原值)', () => {
    expect([...RAW_EVIDENCE_METADATA_FIELDS]).toEqual(['body', 'params', 'query'])
  })
})

describe('86D 判据 1 — dry-run 默认零写入(数 mock 调用,不是"没报错")', () => {
  it('不带 apply:一条 UPDATE/DELETE 都不发,但报全三个数', async () => {
    const chain = buildChain(3)
    const fake = makeFakeTx({
      chain,
      structExpired: 7,
      rawCandidates: 3,
      targetIds: ['id-0', 'id-1'],
    })
    const r = await runAuditEvidenceRetention({ deps: depsFor(fake), env: {} })
    expect(countWrites(fake.statements)).toBe(0)
    expect(r.mode).toBe('dry-run')
    expect(r.status).toBe('ok')
    expect(r.structExpiredRows).toBe(7)
    expect(r.rawCandidates).toBe(3)
    expect(r.rawPurged).toBe(2)
    // 从首个候选(id-0)起到链尾全在重算射程:3 行
    expect(r.rechainUpdates).toBe(3)
    // dry-run 不得带 FOR UPDATE(不锁在线写入),apply 才锁 —— 顺带钉切片语句形态
    const slice = fake.statements.find((s) => s.text.startsWith('SELECT id, timestamp, user_id'))
    expect(slice?.text).not.toContain('FOR UPDATE')
    // 与唯一写入器同一把 advisory lock
    expect(fake.statements[0]?.text).toContain("pg_advisory_xact_lock(hashtext('audit_log_chain'))")
  })
})

describe('86D 判据 2 — 原文 0 天:字段被清、rawRetained=false、rawPurgedAt 有值、行仍在', () => {
  it('apply:只 UPDATE、全链无 DELETE;被清行的 metadata 携完整墓碑', async () => {
    const chain = buildChain(3)
    const fake = makeFakeTx({ chain, structExpired: 7, rawCandidates: 3, targetIds: ['id-1'] })
    const auditWrite = vi.fn(async () => 'x')
    const r = await runAuditEvidenceRetention({
      apply: true,
      deps: depsFor(fake, auditWrite),
      env: {},
    })
    expect(r.status).toBe('ok')
    expect(fake.statements.some((s) => /^DELETE/.test(s.text))).toBe(false)
    const updates = fake.statements.filter((s) => s.text.startsWith('UPDATE'))
    expect(updates).toHaveLength(2) // id-1 擦除 + id-2 前向重算(行 id-0 在候选之前,不动)
    // UPDATE 必带 prev_hash/current_hash;被擦行额外带 metadata::jsonb
    expect(updates[0]?.text).toContain('prev_hash')
    expect(updates[0]?.text).toContain('current_hash')
    const metaParam = updates[0]?.params.find(
      (p) => typeof p === 'string' && p.includes('"rawRetained":false'),
    )
    expect(typeof metaParam).toBe('string')
    const meta = JSON.parse(metaParam as string) as Record<string, unknown>
    for (const k of RAW_EVIDENCE_METADATA_FIELDS) expect(k in meta).toBe(false)
    expect(meta.rawRetained).toBe(false)
    expect(typeof meta.rawPurgedAt).toBe('string')
    const purge = meta.purge as Record<string, unknown>
    expect(purge.purged).toBe(true)
    expect(purge.reason).toBe('retention-0d')
    // 前锚点 = 擦除前的 current_hash(墓碑可复核)
    expect(purge.prevCurrentHash).toBe(chain[1]?.currentHash)
    // 自审进链:经唯一写入器 recordAuditLog(注入侧验证调用即证明不绕链自拼 insert)
    expect(auditWrite).toHaveBeenCalledTimes(1)
    expect(auditWrite.mock.calls[0]?.[0]).toMatchObject({ action: 'audit.evidence.retention' })
  })
})

describe('86D 判据 3(核心)— 三张面三种结论,且删行/改字节永不 valid=true', () => {
  it('①未清理=intact ②合规清理=compliant-purged ③删行/改字节=tampered,三者两两不同', () => {
    const chain = buildChain(4)
    const face1 = auditEvidenceIntegrityReport(chain)
    expect(face1.valid).toBe(true)
    expect(face1.conclusion).toBe('intact')
    expect(face1.tombstonedRows).toBe(0)
    expect(face1.rawRetainedRows).toBe(4)

    const plan = planEvidenceRechain(chain, {
      purgeIds: new Set(['id-1']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    expect(plan.blockedReason).toBeUndefined()
    const face2Chain = applyEvidenceUpdatesToRows(chain, plan.updates)
    expect(face2Chain).toHaveLength(4) // 行仍在
    const face2 = auditEvidenceIntegrityReport(face2Chain)
    expect(face2.valid).toBe(true)
    expect(face2.conclusion).toBe('compliant-purged')
    expect(face2.tombstonedRows).toBe(1)
    const purgedRow = face2Chain[1] as EvidenceChainRow
    expect(collectRawEvidenceKeys(purgedRow.metadata)).toEqual([])
    expect(isCompliantEvidenceTombstone(purgedRow.metadata)).toBe(true)

    // ③a 被人删一行 ⇒ 后行 prev 不接 ⇒ 红,且不得 valid=true
    const deleted = [chain[0] as EvidenceChainRow, ...chain.slice(2)]
    const face3a = auditEvidenceIntegrityReport(deleted)
    expect(face3a.valid).toBe(false)
    expect(face3a.conclusion).toBe('tampered')
    expect(face3a.reason).toContain('prev_hash')

    // ③b 改一个字节(action 尾字符)⇒ 重算哈希不匹配 ⇒ 红
    const byteChanged = chain.map((r) =>
      r.id === 'id-2' ? { ...r, action: r.action.slice(0, -1) + 'x' } : r,
    )
    const face3b = auditEvidenceIntegrityReport(byteChanged)
    expect(face3b.valid).toBe(false)
    expect(face3b.conclusion).toBe('tampered')
    expect(face3b.reason).toContain('current_hash')

    // 三(四)种结论两两可分辨
    expect(
      new Set([face1.conclusion, face2.conclusion, face3a.conclusion, face3b.conclusion]).size,
    ).toBe(3)
    expect(face3a.reason).not.toBe(face3b.reason)
    // 贴一次实际读数到测试输出(票面要求"贴三次实际读数"的载体)
    console.info(
      '[86D 三面对照]',
      JSON.stringify(
        {
          face1: {
            valid: face1.valid,
            conclusion: face1.conclusion,
            tombstonedRows: face1.tombstonedRows,
          },
          face2: {
            valid: face2.valid,
            conclusion: face2.conclusion,
            tombstonedRows: face2.tombstonedRows,
          },
          face3a_deleted: {
            valid: face3a.valid,
            conclusion: face3a.conclusion,
            reason: face3a.reason,
          },
          face3b_byte: {
            valid: face3b.valid,
            conclusion: face3b.conclusion,
            reason: face3b.reason,
          },
        },
        null,
        1,
      ),
    )
  })

  it('verifier 本体对 ② 依然 valid=true(重哈希+前向重算与既有校验语义兼容,未改一列哈希输入)', () => {
    const chain = buildChain(3)
    const plan = planEvidenceRechain(chain, {
      purgeIds: new Set(['id-0']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    const after = applyEvidenceUpdatesToRows(chain, plan.updates)
    expect(verifyAuditLogIntegrity(after).valid).toBe(true)
    expect(verifyAuditLogIntegrity(after).totalChecked).toBe(3)
  })
})

describe('86D 判据 4 — 规模闸:候选超阈值整轮拒跑并打印实数', () => {
  it('apply 档 candidates=201 > maxPurge=200 ⇒ refused-mass,零改写', async () => {
    const chain = buildChain(3)
    const fake = makeFakeTx({ chain, structExpired: 999, rawCandidates: 201, targetIds: [] })
    const r = await runAuditEvidenceRetention({ apply: true, deps: depsFor(fake), env: {} })
    expect(r.status).toBe('refused-mass')
    expect(r.reason).toContain('201')
    expect(r.reason).toContain('200')
    expect(countWrites(fake.statements)).toBe(0)
    // 拒跑发生在取批之前:不应发出任何 UPDATE/DELETE
    expect(fake.statements.some((s) => /^UPDATE/.test(s.text))).toBe(false)
  })
})

describe('86D 判据 5 — 变异:墓碑判定不是恒真,仿造/篡改必翻红', () => {
  it('篡改者只贴墓碑字段不重链 ⇒ valid=false,tampered 压过 compliant-purged', () => {
    const chain = buildChain(3)
    const target = chain[1] as EvidenceChainRow
    const forged = chain.map((r) =>
      r.id === target.id
        ? {
            ...r,
            metadata: buildPurgedEvidenceMetadata(r.metadata, {
              purgedAt: '2026-09-28T00:00:00.000Z',
              reason: 'retention-0d',
              removedFields: [...RAW_EVIDENCE_METADATA_FIELDS],
              prevCurrentHash: r.currentHash,
            }),
          }
        : r,
    )
    // 形状判据确实认这枚假墓碑"像清理过的"……
    expect(isCompliantEvidenceTombstone((forged[1] as EvidenceChainRow).metadata)).toBe(true)
    // ……但结论必须红:没有一致的重算链,墓碑不能洗白内容改写。
    const report = auditEvidenceIntegrityReport(forged)
    expect(report.valid).toBe(false)
    expect(report.conclusion).toBe('tampered')
  })

  it('已清理链再被改一个字节 ⇒ 红(若判据坏成"见标记即绿",这一支会假绿)', () => {
    const chain = buildChain(3)
    const plan = planEvidenceRechain(chain, {
      purgeIds: new Set(['id-1']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    const cleaned = applyEvidenceUpdatesToRows(chain, plan.updates)
    expect(auditEvidenceIntegrityReport(cleaned).conclusion).toBe('compliant-purged')
    const tampered = cleaned.map((r) => (r.id === 'id-1' ? { ...r, action: r.action + '!' } : r))
    const report = auditEvidenceIntegrityReport(tampered)
    expect(report.valid).toBe(false)
    expect(report.conclusion).toBe('tampered')
  })
})

describe('86D 规划器的安全边界(幂等 / 已断链拒修)', () => {
  it('链在更前处已断 ⇒ blocked,不产出任何改写(拒绝顺手重链洗现场)', () => {
    const chain = buildChain(3)
    const broken = chain.map((r) => (r.id === 'id-2' ? { ...r, prevHash: 'f'.repeat(64) } : r))
    const plan = planEvidenceRechain(broken, {
      purgeIds: new Set(['id-0']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    expect(plan.blockedReason).toContain('prev_hash')
    expect(plan.updates).toEqual([])
  })

  it('幂等:无候选时零改写;对已清行重复下刀不伪造第二枚墓碑', () => {
    const chain = buildChain(3)
    const noop = planEvidenceRechain(chain, { purgeIds: new Set(), purgedAt: 'x', reason: 'r' })
    expect(noop.updates).toEqual([])
    const first = planEvidenceRechain(chain, {
      purgeIds: new Set(['id-1']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    const cleaned = applyEvidenceUpdatesToRows(chain, first.updates)
    const again = planEvidenceRechain(cleaned, {
      purgeIds: new Set(['id-1']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    expect(again.purgedCount).toBe(0)
    expect(again.updates).toEqual([]) // 链已一致 ⇒ 一行都不该动
  })

  it('切片首行的入链关系原样保留(本票不追溯 minTs 之前的历史断点)', () => {
    const chain = buildChain(2)
    const plan = planEvidenceRechain([chain[1] as EvidenceChainRow], {
      purgeIds: new Set(['id-1']),
      purgedAt: '2026-09-28T00:00:00.000Z',
      reason: 'retention-0d',
    })
    expect(plan.blockedReason).toBeUndefined()
    expect(plan.updates[0]?.prevHash).toBe(chain[1]?.prevHash)
  })
})

describe('86D SQL 形态与降级(镜像判据,防"函数在而 SQL 漂")', () => {
  beforeEach(() => {
    mockLoggerWarn.mockClear()
    mockLoggerInfo.mockClear()
  })
  it('apply 档切片 SELECT 带 FOR UPDATE;UPDATE 语句按 id 逐行改写', async () => {
    const chain = buildChain(2)
    const fake = makeFakeTx({ chain, structExpired: 2, rawCandidates: 2, targetIds: ['id-1'] })
    await runAuditEvidenceRetention({ apply: true, deps: depsFor(fake), env: {} })
    const slice = fake.statements.find((s) => s.text.startsWith('SELECT id, timestamp, user_id'))
    expect(slice?.text).toContain('FOR UPDATE')
    const updates = fake.statements.filter((s) => s.text.startsWith('UPDATE'))
    for (const u of updates) {
      expect(u.text).toContain('UPDATE audit_logs_chain')
      expect(u.text).toContain('WHERE id = ')
    }
  })
  it('无候选 ⇒ no-candidates 零写;db 异常 ⇒ error 降级告警不外抛(与 recordAuditLog 同口径)', async () => {
    const chain = buildChain(2)
    const fake = makeFakeTx({ chain, structExpired: 0, rawCandidates: 0, targetIds: [] })
    const r = await runAuditEvidenceRetention({ apply: true, deps: depsFor(fake), env: {} })
    expect(r.status).toBe('no-candidates')
    expect(countWrites(fake.statements)).toBe(0)

    const boom = {
      transaction: async <T>(_fn: (tx: EvidenceTx) => Promise<T>): Promise<T> => {
        throw new Error('db down')
      },
      auditWrite: vi.fn(),
    }
    const r2 = await runAuditEvidenceRetention({ apply: true, deps: boom, env: {} })
    expect(r2.status).toBe('error')
    expect(r2.reason).toContain('db down')
    expect(mockLoggerWarn).toHaveBeenCalled()
  })
  it('被清理行之外只动哈希列:非清理 UPDATE 不携带 metadata 参数', async () => {
    const chain = buildChain(2)
    const fake = makeFakeTx({ chain, structExpired: 0, rawCandidates: 1, targetIds: ['id-0'] })
    await runAuditEvidenceRetention({ apply: true, deps: depsFor(fake), env: {} })
    const updates = fake.statements.filter((s) => s.text.startsWith('UPDATE'))
    const tail = updates[updates.length - 1]
    expect(tail?.text).not.toContain('metadata =')
    expect(tail?.params.some((p) => typeof p === 'string' && p.includes('"purged":true'))).toBe(
      false,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
