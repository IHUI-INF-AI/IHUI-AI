// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B04「证据级可追溯执行流水」明细账原文清除器回归(2026-10-27)。
 *
 * 测试形状逐字镜像 tests/audit-evidence-retention.test.ts(86D 先例):
 * 假事务按 SQL 文本路由、记录全部语句,UPDATE/DELETE 数**数出来**而不是"没报错"。
 *
 * 钉五件事(拍板口径的有牙锁):
 * 1. **摘掉 apply 开关必须零写入**:dry-run 只报数,一条 UPDATE/DELETE 都不发;
 *    且干跑不受规模闸拦(201 候选照报数)—— 闸只拦真清;
 * 2. **账行永不 DELETE**:apply 全程零 DELETE 语句;清除只 UPDATE 置空
 *    raw_input/raw_output + raw_retained=false + raw_purged_at=now();
 * 3. **规模闸**:候选 > TOOL_LEDGER_RAW_PURGE_MAX(默认 200)⇒ 整轮拒跑、
 *    reason 带实数、零改写;
 * 4. **到期判据**:行级 raw_retention_days 覆盖 > 全局 env 默认(30 档,
 *    import DEFAULT_RAW_RETENTION_DAYS 单源)—— COALESCE 谓词形态 + 参数实值钉;
 * 5. **降级**:db 异常 ⇒ status error 告警不外抛(与 86D/O5 同口径)。
 *
 * 全程 mock db/logger/config/@ihui/database,喂内存行,绝不连 8810/8811(§5 铁律)。
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

// mock @ihui/database:job 文件经 ledger service 的 import 链会触到这两个表对象(§5 不触库)
vi.mock('@ihui/database', () => ({
  llmCallLogs: { id: 'llm_call_logs_id' },
  toolInvocationLedger: {
    id: 'tool_invocation_ledger_id',
    invocationId: 'tool_invocation_ledger_invocation_id',
    createdAt: 'tool_invocation_ledger_created_at',
  },
}))

import {
  resolveToolLedgerRawPurgePolicy,
  runToolLedgerRawPurge,
  type EvidenceTx,
} from '../src/jobs/audit-evidence-retention.js'
import { DEFAULT_RAW_RETENTION_DAYS } from '../src/services/audit-log-service.js'

const dialect = new PgDialect()

// =============================================================================
// 假事务:按 SQL 文本路由(COUNT 报候选数 / 取批与 UPDATE 都返回 min(候选, batch) 行)
// =============================================================================

function makeFakeLedgerTx(opts: { candidates: number; batch?: number }) {
  const statements: Array<{ text: string; params: unknown[] }> = []
  const planned = Math.min(opts.candidates, opts.batch ?? 50)
  const targetRows = Array.from({ length: planned }, (_, i) => ({ id: `l-${i}` }))
  const tx: EvidenceTx = {
    async execute(q: SQL) {
      const query = dialect.sqlToQuery(q)
      const text = query.sql.replace(/\s+/g, ' ').trim()
      const params = query.params
      statements.push({ text, params })
      if (text.includes('COUNT(*)::int AS cnt FROM tool_invocation_ledger')) {
        return [{ cnt: opts.candidates }]
      }
      if (text.startsWith('SELECT id FROM tool_invocation_ledger')) return targetRows
      if (text.startsWith('UPDATE tool_invocation_ledger')) return targetRows
      throw new Error(`假事务收到未预期 SQL: ${text.slice(0, 80)}`)
    },
  }
  return { tx, statements }
}

function depsFor(fake: { tx: EvidenceTx }) {
  return {
    transaction: async <T>(fn: (tx: EvidenceTx) => Promise<T>): Promise<T> => fn(fake.tx),
  }
}

const countWrites = (statements: Array<{ text: string }>) =>
  statements.filter((s) => /^(UPDATE|DELETE)/.test(s.text)).length

// =============================================================================

describe('B04 ledger 档 env 策略(30 天档 = 机主拍板口径)', () => {
  it('默认 = 全局 30 天 / 批次 50 / 规模闸 200;30 引 DEFAULT_RAW_RETENTION_DAYS 单源', () => {
    expect(resolveToolLedgerRawPurgePolicy({})).toEqual({
      defaultDays: 30,
      batch: 50,
      maxPurge: 200,
    })
    expect(resolveToolLedgerRawPurgePolicy({}).defaultDays).toBe(DEFAULT_RAW_RETENTION_DAYS)
  })
  it('env 可覆盖;0 是合法档(不留存原文);非法/负值回落默认', () => {
    const p = resolveToolLedgerRawPurgePolicy({
      TOOL_LEDGER_RAW_RETENTION_DAYS: '7',
      TOOL_LEDGER_RAW_PURGE_BATCH: '10',
      TOOL_LEDGER_RAW_PURGE_MAX: '5',
    })
    expect(p).toEqual({ defaultDays: 7, batch: 10, maxPurge: 5 })
    expect(
      resolveToolLedgerRawPurgePolicy({ TOOL_LEDGER_RAW_RETENTION_DAYS: '0' }).defaultDays,
    ).toBe(0)
    expect(
      resolveToolLedgerRawPurgePolicy({ TOOL_LEDGER_RAW_RETENTION_DAYS: '-2' }).defaultDays,
    ).toBe(30)
    expect(
      resolveToolLedgerRawPurgePolicy({ TOOL_LEDGER_RAW_RETENTION_DAYS: 'abc' }).defaultDays,
    ).toBe(30)
  })
})

describe('B04 判据 1 — 摘掉 apply 开关必须零写入(数 mock 调用)', () => {
  it('不带 apply:一条 UPDATE/DELETE 都不发,但报全候选与"将清"实数', async () => {
    const fake = makeFakeLedgerTx({ candidates: 5 })
    const r = await runToolLedgerRawPurge({ deps: depsFor(fake), env: {} })
    expect(countWrites(fake.statements)).toBe(0)
    expect(r.mode).toBe('dry-run')
    expect(r.status).toBe('ok')
    expect(r.candidates).toBe(5)
    expect(r.purged).toBe(5)
    // 到期谓词形态钉死:判别列 + COALESCE 行级覆盖(默认参数 30)
    const count = fake.statements.find((s) => s.text.includes('COUNT(*)'))
    expect(count?.text).toContain('raw_retained = true')
    expect(count?.text).toContain('COALESCE(raw_retention_days,')
    expect(count?.params).toContain(30)
  })

  it('干跑不受规模闸拦:201 候选照报数、仍零写入(闸只拦真清)', async () => {
    const fake = makeFakeLedgerTx({ candidates: 201 })
    const r = await runToolLedgerRawPurge({ deps: depsFor(fake), env: {} })
    expect(r.status).toBe('ok')
    expect(r.candidates).toBe(201)
    expect(r.purged).toBe(50) // 干跑的"将清"数同样受 batch 上限约束,报的是本轮实数
    expect(countWrites(fake.statements)).toBe(0)
  })
})

describe('B04 判据 2 — 账行永不 DELETE:清除只置空原文列并置位', () => {
  it('apply:全程零 DELETE;UPDATE 置空 raw_input/raw_output + raw_retained=false + raw_purged_at', async () => {
    const fake = makeFakeLedgerTx({ candidates: 3 })
    const r = await runToolLedgerRawPurge({ apply: true, deps: depsFor(fake), env: {} })
    expect(r.status).toBe('ok')
    expect(r.mode).toBe('apply')
    expect(r.purged).toBe(3)
    expect(fake.statements.some((s) => /^DELETE/.test(s.text))).toBe(false)
    const updates = fake.statements.filter((s) => s.text.startsWith('UPDATE'))
    expect(updates).toHaveLength(1)
    const upd = updates[0] as { text: string; params: unknown[] }
    expect(upd.text).toContain('UPDATE tool_invocation_ledger')
    expect(upd.text).toContain('raw_input = NULL')
    expect(upd.text).toContain('raw_output = NULL')
    expect(upd.text).toContain('raw_retained = false')
    expect(upd.text).toContain('raw_purged_at = now()')
    // 与在线摄入互不阻塞的 O5 同形锁 + 幂等谓词复核 + 实数回读
    expect(upd.text).toContain('FOR UPDATE SKIP LOCKED')
    expect(upd.text).toContain('RETURNING id')
    expect(upd.text).toContain('COALESCE(raw_retention_days,')
  })
})

describe('B04 判据 3 — 规模闸:候选超阈值整轮拒跑并打印实数', () => {
  beforeEach(() => {
    mockLoggerWarn.mockClear()
  })
  it('apply 档 candidates=201 > maxPurge=200 ⇒ refused-mass,零改写', async () => {
    const fake = makeFakeLedgerTx({ candidates: 201 })
    const r = await runToolLedgerRawPurge({ apply: true, deps: depsFor(fake), env: {} })
    expect(r.status).toBe('refused-mass')
    expect(r.reason).toContain('201')
    expect(r.reason).toContain('200')
    expect(countWrites(fake.statements)).toBe(0)
    expect(fake.statements.some((s) => /^UPDATE/.test(s.text))).toBe(false)
    expect(mockLoggerWarn).toHaveBeenCalled()
  })
  it('闸值可经 env 收紧:TOOL_LEDGER_RAW_PURGE_MAX=3 时 4 候选即拒', async () => {
    const fake = makeFakeLedgerTx({ candidates: 4 })
    const r = await runToolLedgerRawPurge({
      apply: true,
      deps: depsFor(fake),
      env: { TOOL_LEDGER_RAW_PURGE_MAX: '3' },
    })
    expect(r.status).toBe('refused-mass')
    expect(countWrites(fake.statements)).toBe(0)
  })
})

describe('B04 判据 4 — 行级覆盖 > 全局默认(单一谓词三处共用不漂移)', () => {
  it('env 默认 7 天时,COUNT/取批/UPDATE 子查询三处参数都带 7(谓词同一份)', async () => {
    const fake = makeFakeLedgerTx({ candidates: 2, batch: undefined })
    const r = await runToolLedgerRawPurge({
      apply: true,
      deps: depsFor(fake),
      env: { TOOL_LEDGER_RAW_RETENTION_DAYS: '7' },
    })
    expect(r.status).toBe('ok')
    const predicated = fake.statements.filter((s) =>
      s.text.includes('COALESCE(raw_retention_days,'),
    )
    expect(predicated).toHaveLength(3) // COUNT / 取批 SELECT / UPDATE 内子查询
    for (const s of predicated) expect(s.params).toContain(7)
  })
})

describe('B04 判据 5 — 无候选与降级(与 86D/O5 同口径)', () => {
  beforeEach(() => {
    mockLoggerWarn.mockClear()
  })
  it('无候选 ⇒ no-candidates 零写', async () => {
    const fake = makeFakeLedgerTx({ candidates: 0 })
    const r = await runToolLedgerRawPurge({ apply: true, deps: depsFor(fake), env: {} })
    expect(r.status).toBe('no-candidates')
    expect(countWrites(fake.statements)).toBe(0)
  })
  it('db 异常 ⇒ error 降级告警不外抛', async () => {
    const boom = {
      transaction: async <T>(_fn: (tx: EvidenceTx) => Promise<T>): Promise<T> => {
        throw new Error('db down')
      },
    }
    const r = await runToolLedgerRawPurge({ apply: true, deps: boom, env: {} })
    expect(r.status).toBe('error')
    expect(r.reason).toContain('db down')
    expect(mockLoggerWarn).toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
