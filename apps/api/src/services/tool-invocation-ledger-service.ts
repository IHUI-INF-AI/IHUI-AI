// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86「证据级可追溯执行流水」写入口 service(明细账表 tool_invocation_ledger 的唯一落库出口)。
 *
 * 与既有面的分工(复用清单,回报里逐条对上):
 *  - **链式可验证引用同一机制,不复制**:先经 `recordAuditLog`(audit-log-service
 *    唯一写入器,HMAC prev_hash/current_hash 链 + pg_advisory_xact_lock)落一条
 *    `action='tool.invoke'` 链行,拿到 id 后才插账行 `chain_entry_id` —— 链写失败
 *    整笔不落(`status:'chain_failed'`),不存在"绕过链先落账"的形态。
 *  - **输入摘要引 86B 单源**:`digestToolArgsStructure`(@ihui/shared),写侧不自算;
 *    **输出摘要**用 `canonicalStringify`(@ihui/shared,86F 合一的那份)归一后
 *    SHA-256 hex —— 序列化单源沿用,哈希用 apps/api 既有 node:crypto 直算先例。
 *  - **权限决策词汇零新造**:zod 枚举直接 import `TOOL_APPROVAL_ROUTES` /
 *    `TOOL_APPROVAL_DENY_CAUSES`(86H),DB CHECK 是同一集镜像,由本文件测试逐值钉。
 *  - **结果档派生复用 `toolInvokeAuditResult`**(86A2 的 state×ok 映射),不抄第二份。
 *  - **execBudget 只投影不解释**:{ms} / {notInterruptible, reason} 两档原样落列,
 *    预算判据唯一解析面仍是 scripts/lib/tool-exec-budget.mjs(本文件不复算封顶/默认档)。
 *  - **留存词汇照抄 O5 三列形状**;全局默认天数 import `DEFAULT_RAW_RETENTION_DAYS`
 *    (仓内既有先例常量),不新写 30 字面量。
 *
 * 身份纪律(AGENTS §5「归属型记录的身份由承载层显式入参传入」):
 *  `userId` 只走 `principal` 形参(上游必须是令牌主体,如 request.userId);
 *  payload 是 strictObject —— 混入 userId/user_id 等任何未声明键在 schema 层即拒,
 *  "客户端自报身份"是结构不可能,不是靠自觉(与 86A2 路由同型)。
 *
 * 刻意不做(归下一格):导出路由(牵他席在飞的 apps/api/src/routes/index.ts,
 *  签名导出机制复用 siem-exporter 的 RSA-SHA256 那套,接上时引用不复制)、
 *  到期原文清除批次(purgeExpiredLlmCallLogRawText 同族)。
 */
import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { canonicalStringify, digestToolArgsStructure } from '@ihui/shared'
import { toolInvocationLedger, type NewToolInvocationLedger } from '@ihui/database'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import {
  recordAuditLog,
  toolInvokeAuditResult,
  TOOL_INVOKE_AUDIT_ACTION,
  TOOL_INVOKE_AUDIT_RESOURCE_TYPE,
  DEFAULT_RAW_RETENTION_DAYS,
  type RecordAuditLogParams,
  type ToolLedgerAuditFact,
} from './audit-log-service.js'
import { TOOL_APPROVAL_ROUTES, TOOL_APPROVAL_DENY_CAUSES } from './tool-approval-audit.js'

/** 全局默认原文留存天数的表专属环境变量(形状逐字仿 LLM_CALL_LOG_RAW_RETENTION_DAYS)。 */
export const TOOL_LEDGER_RAW_RETENTION_ENV = 'TOOL_LEDGER_RAW_RETENTION_DAYS'

/** 与 86A2 fact schema 的 state 同集(登记时镜像;两侧对齐由本文件测试逐值钉)。 */
const LEDGER_STATES = ['registered', 'started', 'settled', 'lost'] as const

/** execBudget 声明的原样投影(两档并集,与 apps/cli tools/index.ts 的 ToolExecBudget 同形;判据在 scripts/lib/tool-exec-budget.mjs,此处不解释)。 */
const execBudgetDeclarationSchema = z.union([
  z.strictObject({ ms: z.number().int().positive() }),
  z.strictObject({ notInterruptible: z.literal(true), reason: z.string().min(1).max(500) }),
])

const ledgerUuidPrincipal = z.uuid()

/**
 * 单条调用事实。刻意无 userId/user_id 字段:strictObject 把"自带身份"拒在门外。
 * input 必给(哪怕是 null = 无参调用)——摘要是本表的证据本体,缺输入无法产摘要。
 */
export const toolInvocationLedgerEntrySchema = z
  .strictObject({
    invocationId: z.string().min(1).max(160),
    sessionId: z.string().min(1).max(128),
    toolName: z.string().min(1).max(80),
    permissionDecision: z.enum(TOOL_APPROVAL_ROUTES),
    permissionCause: z.enum(TOOL_APPROVAL_DENY_CAUSES).optional(),
    state: z.enum(LEDGER_STATES),
    ok: z.boolean().optional(),
    input: z.unknown(),
    output: z.unknown().optional(),
    turn: z.number().int().min(1).optional(),
    streamId: z.string().min(1).max(128).optional(),
    seq: z.number().int().min(1).optional(),
    startedAtMs: z.number().int().nonnegative().optional(),
    settledAtMs: z.number().int().nonnegative().optional(),
    /** D172 同款:只接受 32 位小写 hex 的 W3C trace id,脏值在入口即拒(不外溢成 DB 错)。 */
    traceId: z
      .string()
      .regex(/^[0-9a-f]{32}$/)
      .optional(),
    execBudget: execBudgetDeclarationSchema.optional(),
    /** 原文落库是显式 opt-in(默认 false = 只存摘要);为 true 时才写 raw_input/raw_output。 */
    includeRaw: z.boolean().optional(),
    /** 本行原文留存天数;NULL=全局默认(见 TOOL_LEDGER_RAW_RETENTION_ENV,兜底引 DEFAULT_RAW_RETENTION_DAYS);0=不留存。 */
    rawRetentionDays: z.number().int().min(0).max(3650).optional(),
  })
  .refine((e) => 'input' in e, {
    message: 'input is required (digest evidence needs the input value)',
  })

export type ToolInvocationLedgerEntry = z.infer<typeof toolInvocationLedgerEntrySchema>

/** 结果档导出给测试与后续导出器对齐(值集 = toolInvokeAuditResult 输出集)。 */
export const TOOL_INVOCATION_LEDGER_OUTCOMES = ['success', 'failure', 'lost', 'unknown'] as const

export interface RecordToolInvocationLedgerMeta {
  ip?: string
  userAgent?: string
}

export interface RecordToolInvocationLedgerDeps {
  /** 默认 = recordAuditLog(HMAC 链唯一写入器)。注入只为不触库单测(§5 测试隔离),生产调用方从不传。 */
  writeChain?: (params: RecordAuditLogParams) => Promise<string | undefined>
  findExisting?: (invocationId: string) => Promise<string | undefined>
  insertLedger?: (row: NewToolInvocationLedger) => Promise<string | undefined>
}

export interface ToolInvocationLedgerRecordResult {
  status: 'recorded' | 'duplicate' | 'chain_failed'
  ledgerId?: string
  chainEntryId?: string
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** 值 → 摘要输入的唯一文本形态:字符串原样,其余走 canonicalStringify(86F 单源)。 */
function digestibleText(value: unknown): string {
  return typeof value === 'string' ? value : canonicalStringify(value as Record<string, unknown>)
}

export async function recordToolInvocationLedger(
  principal: { userId: string },
  payload: unknown,
  meta: RecordToolInvocationLedgerMeta = {},
  deps: RecordToolInvocationLedgerDeps = {},
): Promise<ToolInvocationLedgerRecordResult> {
  const userId = principal.userId
  if (!ledgerUuidPrincipal.safeParse(userId).success) {
    throw new Error('recordToolInvocationLedger: principal.userId must be a UUID (token principal)')
  }

  const parsed = toolInvocationLedgerEntrySchema.safeParse(payload)
  if (!parsed.success) {
    logger.warn('[tool-invocation-ledger] entry rejected', {
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    })
    throw new Error(
      `invalid tool-invocation-ledger entry: ${parsed.error.issues[0]?.message ?? 'schema'}`,
    )
  }
  const entry = parsed.data

  const find =
    deps.findExisting ??
    (async (invocationId: string) => {
      const [row] = await db
        .select({ id: toolInvocationLedger.id })
        .from(toolInvocationLedger)
        .where(eq(toolInvocationLedger.invocationId, invocationId))
        .limit(1)
      return row?.id
    })

  const existingId = await find(entry.invocationId)
  if (existingId) {
    // 重复摄入:链一行都不补(否则同事实两链行随重试无限增殖),账行幂等保留原样。
    return { status: 'duplicate', ledgerId: existingId }
  }

  const inputDigest = digestToolArgsStructure(entry.input)
  const outputDigest =
    entry.state === 'settled' ? sha256Hex(digestibleText(entry.output ?? null)) : null
  // 复用 86A2 的 state×ok 映射;其函数体只读 state/ok 两键(镜像测试钉住,上游读新键即翻红)。
  const outcome = toolInvokeAuditResult({ state: entry.state, ok: entry.ok } as ToolLedgerAuditFact)
  const includeRaw = entry.includeRaw === true

  const writeChain = deps.writeChain ?? recordAuditLog
  const chainEntryId = await writeChain({
    userId,
    action: TOOL_INVOKE_AUDIT_ACTION,
    resourceType: TOOL_INVOKE_AUDIT_RESOURCE_TYPE,
    resourceId: entry.invocationId,
    ip: meta.ip,
    userAgent: meta.userAgent,
    result: outcome,
    metadata: {
      projection: 'tool_invocation_ledger',
      sessionId: entry.sessionId,
      toolName: entry.toolName,
      state: entry.state,
      permissionDecision: entry.permissionDecision,
      permissionCause: entry.permissionCause ?? null,
      inputDigest,
      outputDigest,
      turn: entry.turn ?? null,
      streamId: entry.streamId ?? null,
      seq: entry.seq ?? null,
      traceId: entry.traceId ?? null,
    },
  })
  if (chainEntryId === undefined) {
    // 链不成 ⇒ 账不落(§0.3:不记绿;86A2 头注「禁止另起 insert 绕链」的镜像面)。
    return { status: 'chain_failed' }
  }

  const insert =
    deps.insertLedger ??
    (async (row: NewToolInvocationLedger) => {
      const [created] = await db
        .insert(toolInvocationLedger)
        .values(row)
        .onConflictDoNothing({ target: toolInvocationLedger.invocationId })
        .returning({ id: toolInvocationLedger.id })
      return created?.id
    })

  const ledgerId = await insert({
    invocationId: entry.invocationId,
    userId,
    permissionDecision: entry.permissionDecision,
    permissionCause: entry.permissionCause ?? null,
    inputDigest,
    outputDigest,
    outcome,
    execBudgetMs: entry.execBudget && 'ms' in entry.execBudget ? entry.execBudget.ms : null,
    execBudgetNotInterruptibleReason:
      entry.execBudget && 'notInterruptible' in entry.execBudget ? entry.execBudget.reason : null,
    toolName: entry.toolName,
    sessionId: entry.sessionId,
    traceId: entry.traceId ?? null,
    turn: entry.turn ?? null,
    streamId: entry.streamId ?? null,
    seq: entry.seq ?? null,
    startedAtMs: entry.startedAtMs ?? null,
    settledAtMs: entry.settledAtMs ?? null,
    rawInput: includeRaw ? digestibleText(entry.input) : null,
    rawOutput: includeRaw && entry.output !== undefined ? digestibleText(entry.output) : null,
    rawRetentionDays: entry.rawRetentionDays ?? null,
    rawRetained: includeRaw,
    chainEntryId,
    metadata: {
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      defaultRetentionDays: DEFAULT_RAW_RETENTION_DAYS,
    },
  })
  if (ledgerId === undefined) {
    // 与并发写入者的罕见竞态(find 后、insert 前被别席抢占):链允许多行(事实各记一次),
    // 账由唯一索引收敛;计数如实返回 duplicate,不冒记 recorded。
    return { status: 'duplicate', chainEntryId }
  }
  return { status: 'recorded', ledgerId, chainEntryId }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
