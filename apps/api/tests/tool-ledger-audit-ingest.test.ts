// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86A「证据流水的写入源投影」apps/api 侧回归(2026-09-28)。
 *
 * 钉五件事:
 * 1. **字段映射**:每条 fact 一行,action='tool.invoke'、
 *    resourceType='agent_tool_call'、resourceId=callId、result 由 state×ok 映射;
 * 2. **身份只能从参数进,不能从 body 进**:userId 非 uuid 直接拒;
 *    body 里混入 userId/user_id(strict schema)必拒且零写入 ——
 *    "客户端自带身份"从靠自觉变成结构不可能;
 * 3. **不绕链**:默认写入口就是 recordAuditLog(HMAC 链 + advisory lock 事务),
 *    用例通过 mock 的 db.transaction 证明落库走 INSERT INTO audit_logs_chain
 *    那条既有写入器,而不是另起 insert;
 * 4. **args 不出现在链上**:metadata 只有对账字段(投影侧已剔除入参原文);
 * 5. **失败如实计数**:写入器返回 undefined(事务内降级)计入 failed,不冒记 recorded。
 *
 * 全程 mock db/logger/config/@ihui/database,不触任何真实库(§5 测试隔离铁律)。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockLoggerWarn, mockTransaction, mockExecute } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockTransaction: vi.fn(),
  mockExecute: vi.fn(),
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: mockLoggerWarn, error: vi.fn() },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(64),
    NODE_ENV: 'test',
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: { transaction: mockTransaction },
  dbRead: {},
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  llmCallLogs: { id: 'llm_call_logs_id' },
}))

import {
  recordToolLedgerAuditIngest,
  toolInvokeAuditResult,
  TOOL_INVOKE_AUDIT_ACTION,
  TOOL_INVOKE_AUDIT_RESOURCE_TYPE,
  TOOL_LEDGER_AUDIT_MAX_FACTS,
  type RecordAuditLogParams,
  type ToolLedgerAuditFact,
} from '../src/services/audit-log-service.js'

const USER_ID = '11111111-2222-3333-4444-555555555555'

function fact(overrides?: Partial<ToolLedgerAuditFact>): ToolLedgerAuditFact {
  return {
    callId: 'a'.repeat(16) + '#1',
    turn: 1,
    streamId: 't1-uuidish',
    seq: 1,
    fingerprint: 'a'.repeat(16),
    toolName: 'read_file',
    state: 'settled',
    early: true,
    ok: true,
    ...overrides,
  } as ToolLedgerAuditFact
}

function ingestBody(facts: ToolLedgerAuditFact[]) {
  return { version: 1, turn: 1, streamId: 't1-uuidish', createdAtMs: 1, facts }
}

/** 把 drizzle SQL 模板对象摊平成 { text, params };摊不出时返回 null 由断言喊未判定。 */
function inspectSql(raw: unknown): { text: string; params: unknown[] } | null {
  const chunks = (raw as { queryChunks?: unknown[] } | null)?.queryChunks
  if (!Array.isArray(chunks)) return null
  const text: string[] = []
  const walk = (list: unknown[]): void => {
    for (const c of list) {
      if (typeof c === 'string') {
        text.push(c)
      } else if (c && typeof c === 'object') {
        const inner = (c as { queryChunks?: unknown[]; value?: unknown }).queryChunks
        if (Array.isArray(inner)) walk(inner)
        else if ('value' in (c as object)) text.push(String((c as { value: unknown }).value))
      }
    }
  }
  walk(chunks)
  const params = (raw as { params?: unknown[] }).params
  return { text: text.join(''), params: Array.isArray(params) ? params : [] }
}

beforeEach(() => {
  vi.clearAllMocks()
  // recordAuditLog 的事务形态:execute 依次为 advisory lock / 链尾查询 / INSERT
  mockTransaction.mockImplementation(
    (cb: (tx: { execute: typeof mockExecute }) => Promise<unknown>) => cb({ execute: mockExecute }),
  )
})

describe('recordToolLedgerAuditIngest 的落库形态(默认链入口)', () => {
  it('两条 settled 事实 ⇒ 两行 INSERT INTO audit_logs_chain,列值携带 action/resourceId/fingerprint', async () => {
    let insertCount = 0
    mockExecute.mockImplementation(async () => {
      insertCount += 1
      if (insertCount % 3 === 2) return [{ current_hash: 'f'.repeat(64) }] // 链尾
      if (insertCount % 3 === 0) return [{ id: `audit-${insertCount}` }] // INSERT RETURNING
      return [] // advisory lock
    })
    const result = await recordToolLedgerAuditIngest(
      USER_ID,
      ingestBody([
        fact(),
        fact({ callId: 'b'.repeat(16) + '#1', seq: 2, fingerprint: 'b'.repeat(16) }),
      ]),
      { ip: '10.0.0.1', userAgent: 'ihui-cli/test' },
    )
    expect(result).toEqual({ recorded: 2, failed: 0 })
    // 每条事实 3 次 execute(lock/链尾/INSERT)⇒ 共 6 次
    expect(mockExecute).toHaveBeenCalledTimes(6)
    const inserts = [2, 5].map((i) => inspectSql(mockExecute.mock.calls[i]![0]))
    for (const ins of inserts) {
      expect(ins).not.toBeNull() // 摊不出结构必须红,不得静默当"通过"
      expect(ins!.text).toContain('INSERT INTO audit_logs_chain')
    }
    const joined = inserts.map((i) => `${i!.text}|${JSON.stringify(i!.params)}`).join('\n')
    expect(joined).toContain(TOOL_INVOKE_AUDIT_ACTION)
    expect(joined).toContain(TOOL_INVOKE_AUDIT_RESOURCE_TYPE)
    expect(joined).toContain(USER_ID)
    expect(joined).toContain('a'.repeat(16)) // metadata 里带 fingerprint 摘要
    expect(joined).not.toContain('args') // 投影侧不带入参原文
  })

  it('写入器降级(返回 undefined)⇒ failed 计数,不冒记 recorded', async () => {
    mockTransaction.mockRejectedValue(new Error('db gone'))
    const result = await recordToolLedgerAuditIngest(USER_ID, ingestBody([fact()]))
    expect(result).toEqual({ recorded: 0, failed: 1 })
  })
})

describe('身份纪律与入参把关(经 deps.write 精确观察映射)', () => {
  let writes: RecordAuditLogParams[]

  beforeEach(() => {
    writes = []
    mockTransaction.mockImplementation(async () => {
      throw new Error('默认链入口不该被走到:本组用例全部注入 deps.write')
    })
  })

  const deps = {
    write: async (p: RecordAuditLogParams) => {
      writes.push(p)
      return 'row-1'
    },
  }

  it('字段映射逐条对账:userId 来自函数参数、result 由 state×ok 映射、metadata 只装对账字段', async () => {
    const ok = fact()
    const failure = fact({ callId: 'c#1', state: 'settled', ok: false, seq: 2 })
    const inFlight = fact({ callId: 'd#1', state: 'started', ok: undefined, seq: 3 })
    const lost = fact({
      callId: 'e#1',
      state: 'lost',
      ok: undefined,
      skipReason: 'end-of-stream before dispatch',
      seq: 4,
    })
    const r = await recordToolLedgerAuditIngest(
      USER_ID,
      ingestBody([ok, failure, inFlight, lost]),
      {},
      deps,
    )
    expect(r).toEqual({ recorded: 4, failed: 0 })
    expect(writes.map((w) => w.result)).toEqual(['success', 'failure', 'unknown', 'lost'])
    // 逐条精确断言 resourceId(= 账本 dedupeKey,审计链上的稳定调用标识)
    expect(writes[0]!.resourceId).toBe('a'.repeat(16) + '#1')
    expect(writes[1]!.resourceId).toBe('c#1')
    expect(writes[2]!.resourceId).toBe('d#1')
    expect(writes[3]!.resourceId).toBe('e#1')
    for (const w of writes) {
      expect(w.userId).toBe(USER_ID)
      expect(w.action).toBe('tool.invoke')
      expect(w.resourceType).toBe('agent_tool_call')
    }
    expect(writes[3]!.metadata).toMatchObject({
      skipReason: 'end-of-stream before dispatch',
      state: 'lost',
    })
    expect('args' in (writes[0]!.metadata as object)).toBe(false)
  })

  it('body 自带 userId/user_id ⇒ 必拒且零写入(客户端不得自带身份)', async () => {
    const withUserId = { ...ingestBody([fact()]), userId: '22222222-2222-3333-4444-555555555555' }
    await expect(recordToolLedgerAuditIngest(USER_ID, withUserId, {}, deps)).rejects.toThrow(
      /invalid tool-ledger audit body/,
    )
    const withSnake = { ...ingestBody([fact()]), user_id: 'other' }
    await expect(recordToolLedgerAuditIngest(USER_ID, withSnake, {}, deps)).rejects.toThrow(
      /invalid tool-ledger audit body/,
    )
    expect(writes).toHaveLength(0)
    expect(mockLoggerWarn).toHaveBeenCalled()
  })

  it('userId 非 uuid(令牌主体没取对/取错列)⇒ 入口即拒,不外溢成 ::uuid cast 失败', async () => {
    await expect(
      recordToolLedgerAuditIngest('not-a-uuid', ingestBody([fact()]), {}, deps),
    ).rejects.toThrow(/userId must be a UUID/)
    await expect(recordToolLedgerAuditIngest('', ingestBody([fact()]), {}, deps)).rejects.toThrow(
      /userId must be a UUID/,
    )
    expect(writes).toHaveLength(0)
  })

  it('facts 空数组 / 超上限 ⇒ 拒(0 调用的轮次不该发工件;上限防审计链灌洪)', async () => {
    await expect(recordToolLedgerAuditIngest(USER_ID, ingestBody([]), {}, deps)).rejects.toThrow()
    const many = Array.from({ length: TOOL_LEDGER_AUDIT_MAX_FACTS + 1 }, (_, i) =>
      fact({ callId: `x${i}#1`, seq: i + 1 }),
    )
    await expect(recordToolLedgerAuditIngest(USER_ID, ingestBody(many), {}, deps)).rejects.toThrow()
    expect(writes).toHaveLength(0)
  })
})

describe('toolInvokeAuditResult 映射表(审计读端按 result 分类,映射不得随写手抖)', () => {
  it('四态 × ok 三值穷举', () => {
    expect(toolInvokeAuditResult(fact({ state: 'settled', ok: true }))).toBe('success')
    expect(toolInvokeAuditResult(fact({ state: 'settled', ok: false }))).toBe('failure')
    expect(toolInvokeAuditResult(fact({ state: 'settled' }))).toBe('success')
    expect(toolInvokeAuditResult(fact({ state: 'started' }))).toBe('unknown')
    expect(toolInvokeAuditResult(fact({ state: 'registered' }))).toBe('unknown')
    expect(toolInvokeAuditResult(fact({ state: 'lost' }))).toBe('lost')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
