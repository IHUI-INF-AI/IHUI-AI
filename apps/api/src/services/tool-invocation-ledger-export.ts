// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 86「证据级可追溯执行流水」明细账(tool_invocation_ledger)的签名导出 service(B04 收口格)。
 *
 * 记录面(写入口)已由 `tool-invocation-ledger-service.ts` 承载;本文件只做**导出**:
 * 把账行转成确定性 JSON Lines,装进与审计链导出同形状的信封并 RSA-SHA256 签名。
 *
 * 与既有面的分工(复用清单):
 *  - **签名机制零复制**:私钥读取、RSA-SHA256 签名、kid 推导全部 import
 *    `services/siem-exporter.ts` 的既有出口(`signCanonicalExportPayload` /
 *    `canonicalAuditExportPayload` / `getAuditExportPublicKeyInfo`)—— 同一把签名私钥、
 *    同一套失败归因,本文件不出现第二个 createSign。
 *  - **验签复用**:产出的信封形状与 `AuditExportPayload` 逐字段同形(algorithm/keyId/
 *    format/exportedAt/rowCount/dataDigest/filters/lines),收件方仍走
 *    `verifySignedAuditExport` 一把尺子验两种信封;本文件的端到端测试也用它自证。
 *  - **确定性序列化单源**:`canonicalStringify`(@ihui/shared),同一次导出内容重放
 *    字节逐字一致(签名可复现的前提)。
 *  - **账行词汇零新造**:outcome 枚举直接 import 记录面导出的
 *    `TOOL_INVOCATION_LEDGER_OUTCOMES`,不写第二份值集。
 *
 * 刻意不带 chainAnchor:链式可验证性住在 audit_logs_chain(每行 chainEntryId 回指链行),
 * 链锚(区间 prevHash→currentHash 连续性证明)只对携带哈希列的数据体有意义 —— 账行
 * JSON Lines 不带链哈希,挂锚等于"声称了但无法证明"(siem-exporter buildChainAnchor
 * 同一条判据),故信封保持 86C 旧形状,验签路径整步跳过链锚。
 *
 * 刻意不导出原文列(rawInput/rawOutput/留存三列):原文受保留策略管控(rawRetentionDays
 * /rawPurgedAt),证据导出只交**摘要**(inputDigest/outputDigest)+ 四要素
 * (invocationId/权限决策/操作者身份/结果档)——"可导出"(票面拍板)指的是证据,
 * 不是绕过原文留存纪律的旁路。
 *
 * 身份纪律:`filters.userId` 只是查询维度(同 audit 导出口径),权限由挂载路由的
 * requireAdmin 判;操作者身份作为**数据**(每行 userId)随账行导出,那是记录面在
 * 落库时从令牌主体写入的,本文件不新增任何身份来源。
 */
import { createHash } from 'node:crypto'

import { and, asc, eq, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { canonicalStringify } from '@ihui/shared'
import { toolInvocationLedger, type ToolInvocationLedger } from '@ihui/database'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { TOOL_INVOKE_AUDIT_ACTION, TOOL_INVOKE_AUDIT_RESOURCE_TYPE } from './audit-log-service.js'
import {
  AUDIT_EXPORT_SIGNATURE_ALGORITHM,
  canonicalAuditExportPayload,
  getAuditExportPublicKeyInfo,
  signCanonicalExportPayload,
  type AuditExportFilterSnapshot,
  type AuditExportPayload,
  type SignedAuditExport,
} from './siem-exporter.js'
import { TOOL_INVOCATION_LEDGER_OUTCOMES } from './tool-invocation-ledger-service.js'

/** 明细账导出固定 JSON Lines(账行没有 CEF/LEEF 映射,不扩需求)。 */
export const TOOL_LEDGER_EXPORT_FORMAT = 'json' as const

/** 导出行形状:证据四要素 + 摘要 + 预算投影 + 链回指;永不含原文列。 */
export interface ToolInvocationLedgerExportRow {
  id: string
  invocationId: string
  /** 操作者身份(令牌主体,记录面落库时写入)。 */
  userId: string
  permissionDecision: string
  permissionCause: string | null
  inputDigest: string
  outputDigest: string | null
  outcome: string
  execBudgetMs: number | null
  execBudgetNotInterruptibleReason: string | null
  toolName: string
  sessionId: string
  traceId: string | null
  turn: number | null
  streamId: string | null
  seq: number | null
  startedAtMs: number | null
  settledAtMs: number | null
  /** 回指 audit_logs_chain.id(链式可验证性的入口)。 */
  chainEntryId: string
  /** 账行落库时刻(ISO 8601)。 */
  createdAt: string
  metadata: Record<string, unknown> | null
}

export interface ToolInvocationLedgerExportFilters {
  userId?: string
  toolName?: string
  sessionId?: string
  outcome?: (typeof TOOL_INVOCATION_LEDGER_OUTCOMES)[number]
  /** 账行 createdAt 窗口(ISO 8601;闭区间两端)。 */
  startDate?: string
  endDate?: string
}

export const toolInvocationLedgerExportFiltersSchema = z
  .object({
    userId: z.uuid().optional(),
    toolName: z.string().min(1).max(80).optional(),
    sessionId: z.string().min(1).max(128).optional(),
    outcome: z.enum(TOOL_INVOCATION_LEDGER_OUTCOMES).optional(),
    startDate: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'startDate 必须是可解析时间' })
      .optional(),
    endDate: z
      .string()
      .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'endDate 必须是可解析时间' })
      .optional(),
  })
  .strict()

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/** DB 行 → 导出行:唯一允许的形状变换点(createdAt 转 ISO,原文列在此被丢弃)。 */
function toExportRow(row: ToolInvocationLedger): ToolInvocationLedgerExportRow {
  return {
    id: row.id,
    invocationId: row.invocationId,
    userId: row.userId,
    permissionDecision: row.permissionDecision,
    permissionCause: row.permissionCause ?? null,
    inputDigest: row.inputDigest,
    outputDigest: row.outputDigest ?? null,
    outcome: row.outcome,
    execBudgetMs: row.execBudgetMs ?? null,
    execBudgetNotInterruptibleReason: row.execBudgetNotInterruptibleReason ?? null,
    toolName: row.toolName,
    sessionId: row.sessionId,
    traceId: row.traceId ?? null,
    turn: row.turn ?? null,
    streamId: row.streamId ?? null,
    seq: row.seq ?? null,
    startedAtMs: row.startedAtMs ?? null,
    settledAtMs: row.settledAtMs ?? null,
    chainEntryId: row.chainEntryId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    metadata: asRecord(row.metadata),
  }
}

async function defaultSelectRows(
  filters: ToolInvocationLedgerExportFilters,
  limit: number,
): Promise<ToolInvocationLedgerExportRow[]> {
  const conditions = []
  if (filters.userId !== undefined) {
    conditions.push(eq(toolInvocationLedger.userId, filters.userId))
  }
  if (filters.toolName !== undefined) {
    conditions.push(eq(toolInvocationLedger.toolName, filters.toolName))
  }
  if (filters.sessionId !== undefined) {
    conditions.push(eq(toolInvocationLedger.sessionId, filters.sessionId))
  }
  if (filters.outcome !== undefined) {
    conditions.push(eq(toolInvocationLedger.outcome, filters.outcome))
  }
  if (filters.startDate !== undefined) {
    conditions.push(gte(toolInvocationLedger.createdAt, new Date(filters.startDate)))
  }
  if (filters.endDate !== undefined) {
    conditions.push(lte(toolInvocationLedger.createdAt, new Date(filters.endDate)))
  }

  const rows = await db
    .select()
    .from(toolInvocationLedger)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    // 行序确定性:createdAt 同值时由 id 定序 —— 同一份数据两次导出行序必然一致,
    // 否则 dataDigest 会漂,签名可复现落空。
    .orderBy(asc(toolInvocationLedger.createdAt), asc(toolInvocationLedger.id))
    .limit(limit)

  return rows.map(toExportRow)
}

export interface ToolInvocationLedgerExportDeps {
  /** 默认 = 直查 tool_invocation_ledger;注入只为不触库单测(§5 测试隔离),生产调用方从不传。 */
  selectRows?: (
    filters: ToolInvocationLedgerExportFilters,
    limit: number,
  ) => Promise<ToolInvocationLedgerExportRow[]>
  /** 覆盖导出时刻(仅供单测做"同内容两次导出签名全等"判据;生产不传)。 */
  exportedAt?: string
}

/**
 * 过滤快照(未设置落空串,避免 undefined 在 JSON 里整键消失;与审计导出同口径)。
 *
 * `AuditExportFilterSnapshot` 的必填维度补齐:action/resourceType 不是明细账的查询维度,
 * 而是记录面的固定词汇 —— 每条账行都写一行 `action='tool.invoke'` /
 * `resourceType='agent_tool_call'` 的链行(chainEntryId 回指),明细账导出恒为该链段的
 * 明细面,常量就是它最贴切的取值(import 记录面同一份词汇,不写第二份)。
 * toolName/sessionId/outcome 是明细账原生查询维度,作为快照附加字段随签名进信封 ——
 * 判据⑥"过滤维度进签名"(同数据不同 filters ⇒ 信封不同)靠它们;信封因此与审计链
 * 导出保持 `AuditExportPayload` 逐字段同形,收件方一把尺子验两种信封。
 */
function snapshotFilters(
  filters: ToolInvocationLedgerExportFilters,
): AuditExportFilterSnapshot & { toolName: string; sessionId: string; outcome: string } {
  return {
    userId: filters.userId ?? '',
    action: TOOL_INVOKE_AUDIT_ACTION,
    resourceType: TOOL_INVOKE_AUDIT_RESOURCE_TYPE,
    toolName: filters.toolName ?? '',
    sessionId: filters.sessionId ?? '',
    outcome: filters.outcome ?? '',
    startDate: filters.startDate ?? '',
    endDate: filters.endDate ?? '',
  }
}

/**
 * 生成已签名的明细账导出信封(形状与 siem-exporter 的 SignedAuditExport 同形)。
 *
 * @param filters 查询维度(Zod 校验,非法即抛;查询面不是权限面)
 * @param limit 行数上限(路由侧再限 50000)
 * @throws zod 错误(filters 形状非法)/ AuditExportSignatureError(私钥不可用 / 签名失败)
 *   —— 绝不返回未签名信封(§5e 失败必须响)。
 */
export async function buildSignedToolInvocationLedgerExport(
  filters: unknown,
  limit = 10000,
  deps: ToolInvocationLedgerExportDeps = {},
): Promise<SignedAuditExport> {
  const parsed = toolInvocationLedgerExportFiltersSchema.safeParse(filters)
  if (!parsed.success) {
    const detail = parsed.error.issues[0]?.message ?? 'filters'
    throw new Error(`invalid tool-invocation-ledger export filters: ${detail}`)
  }
  const selectRows = deps.selectRows ?? defaultSelectRows
  const rows = await selectRows(parsed.data, limit)
  const lines = rows.map((row) => canonicalStringify(row as unknown as Record<string, unknown>))

  const payload: AuditExportPayload = {
    algorithm: AUDIT_EXPORT_SIGNATURE_ALGORITHM,
    // kid 由公钥推导 ⇒ 信封自证"该用哪把公钥验我"(与审计链导出同一把钥匙)。
    keyId: getAuditExportPublicKeyInfo().keyId,
    format: TOOL_LEDGER_EXPORT_FORMAT,
    exportedAt: deps.exportedAt ?? new Date().toISOString(),
    rowCount: lines.length,
    dataDigest: sha256Hex(canonicalStringify(lines)),
    filters: snapshotFilters(parsed.data),
    lines,
  }
  const signature = signCanonicalExportPayload(canonicalAuditExportPayload(payload))
  logger.debug('[tool-invocation-ledger-export] signed envelope built', { rowCount: lines.length })
  return { payload, signature }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
