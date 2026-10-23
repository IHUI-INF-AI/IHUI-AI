// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86 明细账写入口 recordToolInvocationLedger 回归(2026-10-24)。
 *
 * 钉六件事:
 * 1. **身份只能从 principal 形参进,body 自带必拒**:payload 混入 userId/user_id
 *    (strictObject)当场抛错且零写入;"客户端自报身份"是结构不可能(AGENTS §5);
 * 2. **principal 非 UUID 入口即拒**,不外溢成 DB 故障;缺 input 同样拒(摘要证据的本体);
 * 3. **不绕链**:默认写入口 = recordAuditLog(HMAC 链唯一写入器),用例经 mock 的
 *    db.transaction 证明走 INSERT INTO audit_logs_chain;链失败 ⇒ 账一行都不落;
 * 4. **复用不复制**:inputDigest 逐字 = digestToolArgsStructure(@ihui/shared 单源);
 *    outcome 逐字 = toolInvokeAuditResult 的输出集(state×ok 四档映射);
 *    决策/成因词汇 = TOOL_APPROVAL_ROUTES/TOOL_APPROVAL_DENY_CAUSES 同集,越词汇即拒;
 * 5. **原文纪律**:默认只落摘要(raw_retained=false);includeRaw 显式开才落原文;
 *    链行 metadata 永不含入参原值(与 86A2「args 不出现在链上」同条禁令);
 * 6. **幂等与诚实计数**:invocationId 已存在 ⇒ duplicate 且链不补写;
 *    insert 竞态空回 ⇒ duplicate 不冒记 recorded。
 *
 * 全程 mock db/logger/config/@ihui/database,不触任何真实库(§5 测试隔离铁律,
 * 尤其禁止连生产 PG 8810 / Redis 8811)。
 */
import { createHash } from 'node:crypto'

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { digestToolArgsStructure } from '@ihui/shared'

const { mockLoggerWarn, mockTransaction, mockExecute, mockSelect, mockInsert } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockTransaction: vi.fn(),
  mockExecute: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
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
  db: { transaction: mockTransaction, select: mockSelect, insert: mockInsert },
  dbRead: {},
}))

// mock @ihui/database:避免真实导入该 workspace 包导致 vitest 退出码非 0(仓库既有问题)
vi.mock('@ihui/database', () => ({
  llmCallLogs: { id: 'llm_call_logs_id' },
  toolInvocationLedger: {
    id: 'tool_invocation_ledger_id',
    invocationId: 'tool_invocation_ledger_invocation_id',
    createdAt: 'tool_invocation_ledger_created_at',
  },
}))

import {
  recordToolInvocationLedger,
  toolInvocationLedgerEntrySchema,
  TOOL_INVOCATION_LEDGER_OUTCOMES,
  TOOL_LEDGER_RAW_RETENTION_ENV,
  type RecordToolInvocationLedgerDeps,
} from '../src/services/tool-invocation-ledger-service.js'
import {
  TOOL_INVOKE_AUDIT_ACTION,
  TOOL_INVOKE_AUDIT_RESOURCE_TYPE,
  toolInvokeAuditResult,
  DEFAULT_RAW_RETENTION_DAYS,
  type RecordAuditLogParams,
} from '../src/services/audit-log-service.js'
import {
  TOOL_APPROVAL_ROUTES,
  TOOL_APPROVAL_DENY_CAUSES,
} from '../src/services/tool-approval-audit.js'

// 变体位必须 8/9/a/b:zod v4 的 z.uuid() 校 version/variant nibble(严于形状正则),
// 服务层入口用的就是这把尺子 —— 测试主体必须过它(与 cli-tool-invoke-audit 路由同形)。
const USER_ID = '11111111-2222-4333-8444-555555555555'
const SECRET_ARG = 'sk-sup3rs3cret-arg-value'

function entry(overrides?: Record<string, unknown>) {
  return {
    invocationId: 'a'.repeat(16) + '#1',
    sessionId: 'sess-1',
    toolName: 'bash',
    permissionDecision: 'approved',
    state: 'settled',
    ok: true,
    input: { command: SECRET_ARG },
    output: 'done',
    turn: 1,
    seq: 1,
    ...overrides,
  }
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

describe('身份纪律(§5 归属型记录主体由承载层显式入参)', () => {
  it('payload 混入 userId ⇒ 当场抛错且零写入(strict schema 结构性拒绝)', async () => {
    const writeChain = vi.fn()
    const findExisting = vi.fn()
    const deps: RecordToolInvocationLedgerDeps = { writeChain, findExisting }
    await expect(
      recordToolInvocationLedger({ userId: USER_ID }, entry({ userId: 'evil' }), {}, deps),
    ).rejects.toThrow(/invalid tool-invocation-ledger entry/)
    expect(writeChain).not.toHaveBeenCalled()
    expect(findExisting).not.toHaveBeenCalled()
  })

  it('payload 混入 user_id ⇒ 同样拒且零写入', async () => {
    const writeChain = vi.fn()
    await expect(
      recordToolInvocationLedger(
        { userId: USER_ID },
        entry({ user_id: 'evil' }),
        {},
        { writeChain, findExisting: vi.fn(), insertLedger: vi.fn() },
      ),
    ).rejects.toThrow(/invalid tool-invocation-ledger entry/)
    expect(writeChain).not.toHaveBeenCalled()
  })

  it('principal 非 UUID ⇒ 入口即拒(错误归位,不外溢成 ::uuid cast 故障)', async () => {
    const writeChain = vi.fn()
    await expect(
      recordToolInvocationLedger({ userId: 'not-a-uuid' }, entry(), {}, { writeChain }),
    ).rejects.toThrow(/must be a UUID/)
    expect(writeChain).not.toHaveBeenCalled()
  })

  it('缺 input 键 ⇒ 拒(摘要证据的本体必须在)', async () => {
    const bare = entry()
    delete (bare as Record<string, unknown>).input
    // zod v4 的 z.unknown() 是 nonoptional:缺键在 shape 层即拒(refine 只兜"键在而值为 undefined")
    await expect(
      recordToolInvocationLedger({ userId: USER_ID }, bare, {}, { writeChain: vi.fn() }),
    ).rejects.toThrow(/invalid tool-invocation-ledger entry.*input|input is required/)
  })
})

describe('词汇复用(零新造,逐值对单源)', () => {
  it('permissionDecision 值集 = TOOL_APPROVAL_ROUTES 同集;越词汇即拒', () => {
    expect(
      toolInvocationLedgerEntrySchema.safeParse(entry({ permissionDecision: 'allow' })).success,
    ).toBe(false)
    for (const route of TOOL_APPROVAL_ROUTES) {
      expect(
        toolInvocationLedgerEntrySchema.safeParse(entry({ permissionDecision: route })).success,
      ).toBe(true)
    }
  })

  it('permissionCause 值集 = TOOL_APPROVAL_DENY_CAUSES 同集;越词汇即拒', () => {
    expect(
      toolInvocationLedgerEntrySchema.safeParse(entry({ permissionCause: 'timeout' })).success,
    ).toBe(false)
    for (const cause of TOOL_APPROVAL_DENY_CAUSES) {
      expect(
        toolInvocationLedgerEntrySchema.safeParse(entry({ permissionCause: cause })).success,
      ).toBe(true)
    }
  })

  it('outcome 落列值 = toolInvokeAuditResult 的 state×ok 映射四档,不抄第二份', async () => {
    const cases = [
      { state: 'settled', ok: true, want: 'success' },
      { state: 'settled', ok: false, want: 'failure' },
      { state: 'lost', want: 'lost' },
      { state: 'started', want: 'unknown' },
    ] as const
    // 导出值集与映射函数输出一一对账(两半缺一:清单漂了没人知 / 映射换了清单没换)
    expect(TOOL_INVOCATION_LEDGER_OUTCOMES).toHaveLength(4)
    expect([...TOOL_INVOCATION_LEDGER_OUTCOMES].sort()).toEqual(
      [
        ...new Set(cases.map((c) => toolInvokeAuditResult({ state: c.state, ok: c.ok } as never))),
      ].sort(),
    )
    for (const c of cases) {
      const params: RecordAuditLogParams[] = []
      await recordToolInvocationLedger(
        { userId: USER_ID },
        entry({ state: c.state, ok: c.ok }),
        {},
        {
          writeChain: async (p) => {
            params.push(p)
            return 'chain-1'
          },
          findExisting: async () => undefined,
          insertLedger: async () => 'ledger-1',
        },
      )
      expect(params[0]!.result).toBe(c.want)
    }
  })

  it('留存词汇三列形状沿用 O5;全局默认常量不新写 30 字面量(引 DEFAULT_RAW_RETENTION_DAYS)', () => {
    expect(TOOL_LEDGER_RAW_RETENTION_ENV).toBe('TOOL_LEDGER_RAW_RETENTION_DAYS')
    expect(DEFAULT_RAW_RETENTION_DAYS).toBe(30)
  })
})

describe('落库形态(复用链,不绕链)', () => {
  it('默认 writeChain = recordAuditLog:INSERT INTO audit_logs_chain 真实发生,账行才落', async () => {
    let n = 0
    mockExecute.mockImplementation(async () => {
      n += 1
      if (n % 3 === 2) return [{ current_hash: 'f'.repeat(64) }]
      if (n % 3 === 0) return [{ id: 'chain-row-1' }]
      return []
    })
    mockSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    })
    let inserted: Record<string, unknown> | undefined
    mockInsert.mockImplementation(() => ({
      // db.insert(table) 收的是表对象,行值在 .values(row) 那一层 —— 捕获这层
      values: (row: Record<string, unknown>) => {
        inserted = row
        return {
          onConflictDoNothing: () => ({ returning: async () => [{ id: 'ledger-1' }] }),
        }
      },
    }))

    const result = await recordToolInvocationLedger(
      { userId: USER_ID },
      entry({ execBudget: { ms: 120000 }, traceId: 'b'.repeat(32) }),
      { ip: '10.0.0.1', userAgent: 'ihui-cli/test' },
    )
    expect(result).toEqual({
      status: 'recorded',
      ledgerId: 'ledger-1',
      chainEntryId: 'chain-row-1',
    })
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    const inserts = [1, 2].map((i) => inspectSql(mockExecute.mock.calls[i]![0]))
    for (const ins of inserts) expect(ins).not.toBeNull()
    expect(inserts[1]!.text).toContain('INSERT INTO audit_logs_chain')
    // 链步内绝不出现对账表本身的 INSERT(账行由独立 insert 落,链先账后)
    expect(inserts[1]!.text).not.toContain('INSERT INTO "tool_invocation_ledger"')
    // 链行带 action/resourceId,但**不带入参原值**(86A2 同条禁令)
    const chainJoined = inserts.map((i) => `${i!.text}|${JSON.stringify(i!.params)}`).join('\n')
    expect(chainJoined).toContain(TOOL_INVOKE_AUDIT_ACTION)
    expect(chainJoined).toContain(TOOL_INVOKE_AUDIT_RESOURCE_TYPE)
    expect(chainJoined).toContain(USER_ID)
    expect(chainJoined).not.toContain(SECRET_ARG)
    // 账行:摘要逐字 = 86B 单源;execBudget 原样投影;默认不带原文
    expect(inserted).toBeDefined()
    expect(inserted!['inputDigest']).toBe(digestToolArgsStructure({ command: SECRET_ARG }))
    expect(inserted!['outputDigest']).toBe(
      createHash('sha256').update('done', 'utf8').digest('hex'),
    )
    expect(inserted!['execBudgetMs']).toBe(120000)
    expect(inserted!['execBudgetNotInterruptibleReason']).toBeNull()
    expect(inserted!['permissionDecision']).toBe('approved')
    expect(inserted!['userId']).toBe(USER_ID)
    expect(inserted!['chainEntryId']).toBe('chain-row-1')
    expect(inserted!['rawRetained']).toBe(false)
    expect(inserted!['rawInput']).toBeNull()
    expect(inserted!['rawRetentionDays']).toBeNull() // NULL = 全局默认(O5 同形,写侧不代钉策略)
    expect(inserted!['traceId']).toBe('b'.repeat(32))
  })

  it('链写失败 ⇒ 账不落,status=chain_failed(不绕链、不记绿)', async () => {
    const insertLedger = vi.fn()
    const result = await recordToolInvocationLedger(
      { userId: USER_ID },
      entry(),
      {},
      { writeChain: async () => undefined, findExisting: async () => undefined, insertLedger },
    )
    expect(result).toEqual({ status: 'chain_failed' })
    expect(insertLedger).not.toHaveBeenCalled()
  })

  it('invocationId 已存在 ⇒ duplicate,链一行都不补', async () => {
    const writeChain = vi.fn()
    const result = await recordToolInvocationLedger(
      { userId: USER_ID },
      entry(),
      {},
      { writeChain, findExisting: async () => 'ledger-old' },
    )
    expect(result).toEqual({ status: 'duplicate', ledgerId: 'ledger-old' })
    expect(writeChain).not.toHaveBeenCalled()
  })

  it('insert 空回(onConflictDoNothing 竞态收敛)⇒ duplicate,不冒记 recorded', async () => {
    const result = await recordToolInvocationLedger(
      { userId: USER_ID },
      entry(),
      {},
      {
        writeChain: async () => 'chain-2',
        findExisting: async () => undefined,
        insertLedger: async () => undefined,
      },
    )
    expect(result).toEqual({ status: 'duplicate', chainEntryId: 'chain-2' })
  })
})

describe('原文纪律(includeRaw 显式开才落)', () => {
  it('includeRaw=true ⇒ raw 列落文本、rawRetained=true;字符串 input 原样存', async () => {
    let row: Record<string, unknown> | undefined
    await recordToolInvocationLedger(
      { userId: USER_ID },
      entry({ input: 'plain-text-arg', includeRaw: true, rawRetentionDays: 0 }),
      {},
      {
        writeChain: async () => 'chain-3',
        findExisting: async () => undefined,
        insertLedger: async (r) => {
          row = r as Record<string, unknown>
          return 'ledger-3'
        },
      },
    )
    expect(row!['rawInput']).toBe('plain-text-arg')
    expect(row!['rawOutput']).toBe('done')
    expect(row!['rawRetained']).toBe(true)
    expect(row!['rawRetentionDays']).toBe(0)
  })

  it('未收尾(lost)⇒ outputDigest 为 NULL,摘要列只存摘要绝不冒原文', async () => {
    let row: Record<string, unknown> | undefined
    await recordToolInvocationLedger(
      { userId: USER_ID },
      entry({ state: 'lost', output: 'leak-me-please' }),
      {},
      {
        writeChain: async () => 'chain-4',
        findExisting: async () => undefined,
        insertLedger: async (r) => {
          row = r as Record<string, unknown>
          return 'ledger-4'
        },
      },
    )
    expect(row!['outputDigest']).toBeNull()
    expect(String(row!['rawOutput'])).not.toContain('leak-me-please')
    expect(row!['outcome']).toBe(toolInvokeAuditResult({ state: 'lost', ok: undefined } as never))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
