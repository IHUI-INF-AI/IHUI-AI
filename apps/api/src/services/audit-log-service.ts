// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 国安级审计日志服务 — HMAC-SHA256 链式防篡改核心。
 *
 * 链式结构(类 Git commit / 区块链):
 * - 每条日志的 current_hash = HMAC-SHA256(SECRET, canonicalJSON([prev_hash, timestamp, userId, action, resourceType, resourceId, result, metadata]))
 * - prev_hash = 上一条日志的 current_hash(首条为 "0"*64 创世哈希)
 * - 任一条日志被篡改 → 后续所有 hash 校验失败,可定位篡改位置
 *
 * secret 管理:
 * - 优先从 config.AUDIT_LOG_HMAC_SECRET 读取(>= 32 字符)
 * - 生产环境缺失/长度不足 → throw 拒绝启动(防止链断裂无法验证)
 * - 非生产环境缺失 → logger.warn 警告 + 降级为随机内存 secret
 *   (重启后链断裂无法验证历史,但运行期内链可验证;仅供开发使用)
 *
 * canonicalJSON:递归排序对象 key,确保 metadata 序列化稳定,
 * 避免 JSONB 读取后 key 顺序变化导致 hash 误报。
 */
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { canonicalStringify } from '@ihui/shared'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { hmacSHA256, secureRandomBytes } from '../utils/crypto-extra.js'
import { db } from '../db/index.js'
import { llmCallLogs } from '@ihui/database'
import {
  selectAuditLogs,
  selectAuditLogChain,
  selectAuditLogsRange,
  countAuditLogs,
  groupByAction,
  groupByUser,
  type AuditLogChainRow,
  type AuditLogFilters,
} from '../db/audit-queries.js'
import { streamExport, type SiemFormat } from './siem-exporter.js'

/** 记录审计日志入参(由调用方填充,service 负责算 hash + 落库)。 */
export interface RecordAuditLogParams {
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  ip?: string
  userAgent?: string
  result?: string
  metadata?: Record<string, unknown>
}

/** 链完整性验证结果。 */
/**
 * 链验证的两种输入形态(判据的隐含前提必须写成显式档位,否则子集输入会被当成区间输入判)。
 *
 * - `span`:传入的是链上**连续的一段**(时间范围查询就是这一档,它以首行自身的
 *   `prev_hash` 起算,所以区间内每一行都参与邻接判定)。
 * - `subset`:传入的是链的**子序列**(按用户查就是这一档 —— 见 `verifyUserChain`)。
 */
export type AuditChainVerificationMode = 'span' | 'subset'

export interface IntegrityVerificationResult {
  valid: boolean
  totalChecked: number
  /**
   * 本次输入按哪种形态判的(缺省 `span`)。写进结论而不是只留在参数里,是因为
   * `valid:true` 在两种档下**含义不同**,而响应体的读者拿不到调用栈。
   */
  mode?: AuditChainVerificationMode
  /**
   * 区间连续性是否被证明。`false` **不是**篡改信号,它只说明"输入是子序列,
   * 链上还有没被带进来的行" —— 把它读成告警会让人去查一个不存在的攻击者。
   */
  continuityProven?: boolean
  /** 邻接不成立的次数(仅 `subset` 档会 >0 而不判红)。 */
  adjacencyBreaks?: number
  /** 首个篡改位置(0-based),valid=true 时为 undefined。 */
  tamperedIndex?: number
  /** 失败原因。 */
  reason?: string
  /** 篡改行的 id(若适用)。 */
  tamperedId?: string
}

/** 统计结果。 */
export interface AuditLogStatsResult {
  total: number
  byAction: { action: string; count: number }[]
  byUser: { userId: string; count: number }[]
}

// =============================================================================
// Secret 管理
// =============================================================================

const GENESIS_HASH = '0'.repeat(64)

/**
 * 读取 HMAC secret。
 *
 * config.AUDIT_LOG_HMAC_SECRET 已在 config/index.ts 声明(>= 32 字符或空字符串)。
 * - 生产环境缺失/长度不足 → throw 拒绝启动(防止重启后链断裂 + 多实例 secret 不一致)
 * - 非生产环境缺失 → logger.warn 警告 + 降级为随机内存 secret(仅供开发使用)
 */
function resolveAuditSecret(): string {
  const secret = config.AUDIT_LOG_HMAC_SECRET
  if (secret && secret.length >= 32) return secret

  // G-998138:生产守卫档位经 config 唯一出口(缺省 fail-safe 当生产 ⇒ 缺 secret 拒启动;
  // 旧测试 mock 的 config 缺 isProductionGuard ⇒ 旧判据回退)
  if (config.isProductionGuard ?? config.NODE_ENV === 'production') {
    throw new Error(
      '[audit-log-service] AUDIT_LOG_HMAC_SECRET must be configured in production (>= 32 chars). ' +
        'Without a stable secret, the audit log chain cannot be verified after restart or across instances.',
    )
  }

  // 非生产环境保留降级:随机 32 字节 hex(64 字符)。运行期可验证,重启后链断裂。
  logger.warn(
    '[audit-log-service] AUDIT_LOG_HMAC_SECRET 未配置或长度 < 32,降级为随机内存 secret(仅限非生产环境)。' +
      '重启后历史链将无法验证,生产环境必须显式配置 config.AUDIT_LOG_HMAC_SECRET(>= 32 字符)。',
  )
  return secureRandomBytes(32).toString('hex')
}

let auditSecret: string | null = null
function getAuditSecret(): string {
  if (auditSecret === null) auditSecret = resolveAuditSecret()
  return auditSecret
}

// =============================================================================
// Canonical JSON(递归排序 key,保证序列化稳定)
// =============================================================================
// 86F(2026-09-28):本文件曾有私有 `canonicalStringify`,与 siem-exporter 那份
// 同义双实现 —— 已合一到 `@ihui/shared` 唯一出口(行为逐字 = 原私有版,链上存量
// current_hash 的重算输入因此零变化);反向锁见 tests/canonical-single-source.test.ts。

/**
 * 计算单条日志的 current_hash。
 *
 * 输入为 [prevHash, timestamp, userId, action, resourceType, resourceId, result, metadata]
 * 的 canonical JSON 数组,确保字段边界清晰、key 顺序稳定。
 */
export function computeAuditHash(
  prevHash: string,
  log: {
    timestamp: string
    userId: string | null
    action: string
    resourceType: string | null
    resourceId: string | null
    result: string | null
    metadata: Record<string, unknown> | null
  },
): string {
  const payload = canonicalStringify([
    prevHash,
    log.timestamp,
    log.userId ?? '',
    log.action,
    log.resourceType ?? '',
    log.resourceId ?? '',
    log.result ?? '',
    log.metadata ?? {},
  ])
  return hmacSHA256(getAuditSecret(), payload)
}

// =============================================================================
// 核心方法
// =============================================================================

/** 安全提取 db.execute / tx.execute 结果为数组行。 */
function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

/**
 * 记录一条审计日志:事务内取链尾 hash → 算 current_hash → 落库。
 *
 * P0 修复:用 pg_advisory_xact_lock 串行化审计日志写入,防止并发 check-then-act
 * 导致链分叉(两个并发调用读到相同 prevHash)。advisory lock 在事务结束时自动释放。
 *
 * @returns 新日志 id;落库失败(表未建等)返回 undefined
 */
export async function recordAuditLog(params: RecordAuditLogParams): Promise<string | undefined> {
  const timestamp = new Date().toISOString()

  try {
    return await db.transaction(async (tx) => {
      // 串行化审计日志写入,固定 lock key
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('audit_log_chain'))`)

      // 在事务内获取链尾 hash(表不存在时降级为创世哈希)
      let prevHash = GENESIS_HASH
      try {
        const raw = await tx.execute(sql`
          SELECT current_hash FROM audit_logs_chain ORDER BY timestamp DESC LIMIT 1
        `)
        const h = toRows(raw)[0]?.['current_hash']
        prevHash = h === null || h === undefined ? GENESIS_HASH : String(h)
      } catch {
        prevHash = GENESIS_HASH
      }

      const currentHash = computeAuditHash(prevHash, {
        timestamp,
        userId: params.userId ?? null,
        action: params.action,
        resourceType: params.resourceType ?? null,
        resourceId: params.resourceId ?? null,
        result: params.result ?? null,
        metadata: params.metadata ?? null,
      })

      const metadataJson = JSON.stringify(params.metadata ?? {})
      const insertRaw = await tx.execute(sql`
        INSERT INTO audit_logs_chain
          (timestamp, user_id, action, resource_type, resource_id, ip, user_agent, result, metadata, prev_hash, current_hash)
        VALUES
          (${timestamp}::timestamptz, ${params.userId ?? null}::uuid, ${params.action},
           ${params.resourceType ?? null}, ${params.resourceId ?? null}, ${params.ip ?? null},
           ${params.userAgent ?? null}, ${params.result ?? null}, ${metadataJson}::jsonb,
           ${prevHash}, ${currentHash})
        RETURNING id
      `)
      const id = toRows(insertRaw)[0]?.['id']
      return id === null || id === undefined ? undefined : String(id)
    })
  } catch (e) {
    logger.warn('[audit-log-service] recordAuditLog transaction failed', {
      error: (e as Error).message,
    })
    return undefined
  }
}

/** 分页查询审计日志(委托 audit-queries)。 */
export async function queryAuditLogs(
  filters: AuditLogFilters,
  page: number,
  pageSize: number,
): Promise<{ list: AuditLogChainRow[]; total: number }> {
  return selectAuditLogs(filters, page, pageSize)
}

// =============================================================================
// CLI 工具账本 → 审计链(86A「证据流水的写入源投影」,2026-09-28)
// =============================================================================
//
// 要钉的缺口:CLI 的流式工具账本(apps/cli/src/stream-tool-ledger.ts)每轮都
// 产出快照,但快照出口在生产面**零消费者** —— 工具调用从未进入审计链。
// 本节是服务端侧的落库出口,复用既有 audit_logs_chain + HMAC 链写入器
// (recordAuditLog),**0 新表 0 新列**:
//   - action='tool.invoke' / resourceType='agent_tool_call' / resourceId=callId
//     (= 账本 dedupeKey,`fingerprint#occurrence`,与 CLI 侧幂等口径同形)
//   - metadata 只装无归因的对账字段:turn / streamId / seq / fingerprint /
//     toolName / state / early / ok / skipReason / 两个时刻。**刻意不落 args 原文**
//     (跨流辨认靠 fingerprint 指纹;入参摘要的唯一出口在 86B 建设,落地前
//     不得在此自造第二份 —— 两处算同一件事必漂移)。
//
// 身份纪律(§5「已登录不等于可以动这条数据」的读法):`userId` 只能由调用它的
// 路由从**令牌主体**(request.userId)传入,客户端上报体一律不得自带身份 ——
// 下面的 strictObject 会在 schema 层拒掉任何混入 userId/user_id 的 body,
// 让"自带身份"成为不可能形态而不是靠自觉。

/** 与 CLI 侧 TOOL_LEDGER_AUDIT_MAX_FACTS 同值;改一处必须两处同改(两侧各有超限用例钉)。 */
export const TOOL_LEDGER_AUDIT_MAX_FACTS = 100

/** user_id 列是 ::uuid cast,入口先按 uuid 形状把关(错误归位,不外溢成 DB 故障)。 */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

/** 工具账本审计事件在链上的固定形状(action/resourceType),导出供测试与后续导出器对齐。 */
export const TOOL_INVOKE_AUDIT_ACTION = 'tool.invoke'
export const TOOL_INVOKE_AUDIT_RESOURCE_TYPE = 'agent_tool_call'

const toolLedgerAuditFactSchema = z.strictObject({
  callId: z.string().min(1).max(160),
  turn: z.number().int().min(1),
  streamId: z.string().min(1).max(128),
  seq: z.number().int().min(1),
  fingerprint: z.string().regex(/^[0-9a-f]{16}$/),
  toolName: z.string().min(1).max(80),
  state: z.enum(['registered', 'started', 'settled', 'lost']),
  early: z.boolean(),
  ok: z.boolean().optional(),
  skipReason: z.string().max(200).optional(),
  startedAtMs: z.number().int().nonnegative().optional(),
  settledAtMs: z.number().int().nonnegative().optional(),
})

/** 一轮上报的请求体(由 CLI buildToolLedgerAuditIngest 产出)。刻意无 userId 字段。 */
export const toolLedgerAuditIngestSchema = z.strictObject({
  version: z.literal(1),
  turn: z.number().int().min(1),
  streamId: z.string().min(1).max(128),
  createdAtMs: z.number().int().nonnegative(),
  endOfStreamAtMs: z.number().int().nonnegative().optional(),
  facts: z.array(toolLedgerAuditFactSchema).min(1).max(TOOL_LEDGER_AUDIT_MAX_FACTS),
})

export type ToolLedgerAuditFact = z.infer<typeof toolLedgerAuditFactSchema>
export type ToolLedgerAuditIngest = z.infer<typeof toolLedgerAuditIngestSchema>

/** 单条事实的落库结果档(映射为 audit_logs_chain.result)。 */
export function toolInvokeAuditResult(fact: ToolLedgerAuditFact): string {
  if (fact.state === 'settled') return fact.ok === false ? 'failure' : 'success'
  if (fact.state === 'lost') return 'lost'
  // registered/started:请求已登记/在途但未观测到收尾 ⇒ 副作用状态未知
  return 'unknown'
}

/** 摄入结果:写成功条数 + 逐条落库失败(undefined=事务降级)计数。 */
export interface ToolLedgerAuditIngestResult {
  recorded: number
  failed: number
}

/**
 * 写入口可注入(仅测试用):默认值就是带 HMAC 链的唯一写入器 recordAuditLog。
 * 注入不是为了"绕开链"——生产调用方从不传 deps;它让"逐条字段映射 / 失败计数"
 * 这类判据可以在不触碰 DB 的单测里被逐参数断言(§5 测试隔离铁律)。
 */
export interface RecordToolLedgerAuditDeps {
  write?: (params: RecordAuditLogParams) => Promise<string | undefined>
}

/**
 * 把一轮 CLI 工具账本上报落进审计链(每条 fact 一行,沿用带 HMAC 链的
 * recordAuditLog 唯一写入口 —— 禁止在这里另起 insert 绕链)。
 *
 * @param userId **令牌主体**,由调用侧路由传入;本函数不接受任何来自
 *               请求体的身份字段(schema 为 strict,带了会被拒)。
 * @param ip / userAgent 透传进链行的对应列(与其它审计入口同形)。
 * @returns 写入/失败计数;body 不合法时抛 Error(调用侧按 400 处理)。
 */
export async function recordToolLedgerAuditIngest(
  userId: string,
  body: unknown,
  meta: { ip?: string; userAgent?: string } = {},
  deps: RecordToolLedgerAuditDeps = {},
): Promise<ToolLedgerAuditIngestResult> {
  // 主体形状先行硬校验:audit_logs_chain.user_id 是 ::uuid cast,坏 uuid 会在
  // recordAuditLog 内部被吞成"落库失败",把**接线错误**伪装成 DB 故障。
  if (!UUID_RE.test(userId)) {
    throw new Error('recordToolLedgerAuditIngest: userId must be a UUID (token principal)')
  }
  const parsed = toolLedgerAuditIngestSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn('[audit-log-service] recordToolLedgerAuditIngest rejected body', {
      issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    })
    throw new Error(
      `invalid tool-ledger audit body: ${parsed.error.issues[0]?.message ?? 'schema'}`,
    )
  }
  const ingest = parsed.data
  const write = deps.write ?? recordAuditLog
  let recorded = 0
  let failed = 0
  for (const fact of ingest.facts) {
    const id = await write({
      userId,
      action: TOOL_INVOKE_AUDIT_ACTION,
      resourceType: TOOL_INVOKE_AUDIT_RESOURCE_TYPE,
      resourceId: fact.callId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      result: toolInvokeAuditResult(fact),
      metadata: {
        turn: ingest.turn,
        streamId: ingest.streamId,
        seq: fact.seq,
        fingerprint: fact.fingerprint,
        toolName: fact.toolName,
        state: fact.state,
        early: fact.early,
        ok: fact.ok ?? null,
        skipReason: fact.skipReason ?? null,
        startedAtMs: fact.startedAtMs ?? null,
        settledAtMs: fact.settledAtMs ?? null,
        snapshotCreatedAtMs: ingest.createdAtMs,
        endOfStreamAtMs: ingest.endOfStreamAtMs ?? null,
      },
    })
    if (id === undefined) failed += 1
    else recorded += 1
  }
  return { recorded, failed }
}

/**
 * 验证日志链完整性:逐条重算 HMAC,比对 prev_hash 链式关系 + current_hash。
 *
 * 检测项:
 * 1. prev_hash 链式关系:第 i 条的 prev_hash 应等于第 i-1 条的 current_hash
 * 2. current_hash 重算:HMAC(SECRET, payload) 应与存储的 current_hash 一致
 *
 * 任一不匹配 → 返回篡改位置 + 原因。
 *
 * @param logs 按时间升序排列的日志链
 * @param mode 输入形态(缺省 `span`,即"这是一段连续的链")。**判链之前必须先问这一维**:
 *   链是全局的(`recordAuditLog` 取链尾用 `ORDER BY timestamp DESC LIMIT 1` 全表),
 *   而按用户查回来的只是子序列 —— 把子序列当区间判,任何与别人行交错的用户都会
 *   被报"prev_hash 链断裂",而那个"断裂"根本不是篡改(数据是好的,只是没全带进来)。
 *   `subset` 档因此照常重算每条 HMAC(内容自洽照判),但邻接不成立**只计数不判红**,
 *   并把 `continuityProven:false` 写进结论,让读响应的人知道哪些事没被证明。
 */
export function verifyAuditLogIntegrity(
  logs: AuditLogChainRow[],
  mode: AuditChainVerificationMode = 'span',
): IntegrityVerificationResult {
  if (logs.length === 0) {
    return { valid: true, totalChecked: 0, mode, continuityProven: true }
  }

  let expectedPrev = logs[0]?.prevHash ?? GENESIS_HASH
  let adjacencyBreaks = 0

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]
    if (!log) break

    // 检查 1:prev_hash 链式关系
    if (log.prevHash !== expectedPrev) {
      if (mode === 'span') {
        return {
          valid: false,
          totalChecked: i,
          mode,
          continuityProven: false,
          adjacencyBreaks,
          tamperedIndex: i,
          tamperedId: log.id,
          reason: `prev_hash 链断裂:期望 ${expectedPrev.slice(0, 16)}…,实际 ${log.prevHash.slice(0, 16)}…`,
        }
      }
      // subset 档:邻接不成立只说明链上有没带进来的行,继续按本行自身 prev_hash 重算
      adjacencyBreaks += 1
    }

    // 检查 2:current_hash 重算
    const recomputed = computeAuditHash(log.prevHash, {
      timestamp: log.timestamp,
      userId: log.userId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      result: log.result,
      metadata: log.metadata,
    })
    if (recomputed !== log.currentHash) {
      return {
        valid: false,
        totalChecked: i + 1,
        mode,
        continuityProven: adjacencyBreaks === 0,
        adjacencyBreaks,
        tamperedIndex: i,
        tamperedId: log.id,
        reason: `current_hash 不匹配:期望 ${recomputed.slice(0, 16)}…,实际 ${log.currentHash.slice(0, 16)}…`,
      }
    }

    expectedPrev = log.currentHash
  }

  return {
    valid: true,
    totalChecked: logs.length,
    mode,
    continuityProven: adjacencyBreaks === 0,
    adjacencyBreaks,
    ...(mode === 'subset' && adjacencyBreaks > 0
      ? {
          reason: `本次输入是子序列(${String(adjacencyBreaks)} 处邻接不成立 = 链上有未纳入的行),内容自洽已证、区间连续性未证 —— 这不是篡改告警`,
        }
      : {}),
  }
}

/**
 * 验证某用户最近 N 条日志链(委托查询 + 验证)。
 *
 * 刻意走 `subset` 档:`selectAuditLogChain` 的 SQL 带 `WHERE user_id = ?`,回的是全局链的
 * 子序列,按区间判必然假报断裂(见 `verifyAuditLogIntegrity` 的 @param mode)。
 * 要证区间连续性,请用 `verifyRangeChain`(时间范围 = 连续区间)。
 */
export async function verifyUserChain(
  userId: string,
  limit = 1000,
): Promise<IntegrityVerificationResult> {
  const logs = await selectAuditLogChain(userId, limit)
  return verifyAuditLogIntegrity(logs, 'subset')
}

/** 验证时间范围内的日志链。 */
export async function verifyRangeChain(
  startDate?: string,
  endDate?: string,
  limit = 10000,
): Promise<IntegrityVerificationResult> {
  const logs = await selectAuditLogsRange(startDate, endDate, limit)
  return verifyAuditLogIntegrity(logs)
}

/** 流式导出(委托 siem-exporter)。 */
export function exportAuditLogs(
  filters: AuditLogFilters,
  format: SiemFormat,
  maxItems = 10000,
): AsyncGenerator<string> {
  return streamExport(filters, format, maxItems)
}

/** 统计(总数 + 按 action 分组 + 按 user 分组)。 */
export async function getAuditLogStats(filters: AuditLogFilters): Promise<AuditLogStatsResult> {
  const [total, byAction, byUser] = await Promise.all([
    countAuditLogs(filters),
    groupByAction(filters),
    groupByUser(filters),
  ])
  return { total, byAction, byUser }
}

// =============================================================================
// llm_call_logs 原文留存治理(O5,2026-09-21)
// =============================================================================
//
// 为什么放在本 service:本批允许改动的文件清单里没有 services/llm-call-log-retention.ts,
// 也不允许新建该文件;而"原文留存多久 / 到期清除"与审计留痕同属数据治理面,
// 与本文件的定位(审计与留痕的不可篡改 + 生命周期)一致。后续若拆独立文件,
// 只需整段搬移,导出的 4 个符号签名不变。
//
// 口径:
//  - 计费/统计只看 token 计数列(llm_call_logs.prompt_tokens 等),清除原文不影响任何聚合;
//  - 站内会话与开放面**都不在审计日志里落 prompt 正文**(见 plugins/audit-logger.ts 的形状摘要);
//  - 这里治理的是 llm_call_logs 表本身存的那两份原文。
//  - 默认 30 天而非 0:保留失败复现能力(排障要看真实请求),同时把"永久留存"收敛为"有期限"。
//    要彻底不落原文,设 LLM_CALL_LOG_RAW_RETENTION_DAYS=0,或把具体 key id 写进
//    LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS(该 key 的全部行按下限 0 天立即清除)。

/** 全局默认留存天数(与迁移 20260921130000 的注释口径一致)。 */
export const DEFAULT_RAW_RETENTION_DAYS = 30

/** 单批清除行数上限:避免一次 UPDATE 锁住过多行、把计费写入挤出去。 */
const DEFAULT_PURGE_BATCH = 500

/** 生效的留存策略(已由 env 解析、钳制)。 */
export interface RawRetentionPolicy {
  /** 未显式指定 raw_retention_days 的行使用的天数(>=0;0 = 不留存原文)。 */
  defaultDays: number
  /** 按 key 关闭原文留存的 key id 列表(命中即视为 0 天)。`all=true` 时忽略列表。 */
  disabledApiKeyIds: string[]
  /** LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS='*' → 对所有行关闭原文留存。 */
  all: boolean
}

/** 解析一个非负整数 env 值;非法/缺失回落到 fallback。 */
function parseNonNegativeInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    logger.warn('[audit-log-service] 非法留存天数,已回落默认', { raw, fallback })
    return fallback
  }
  return Math.floor(n)
}

/**
 * 从环境变量解析原文留存策略(纯函数,便于单测;不读 config 是为了不改 config/index.ts)。
 * - LLM_CALL_LOG_RAW_RETENTION_DAYS:全局默认天数,缺省 30
 * - LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS:逗号分隔 key id;`*` 表示全量关闭
 */
export function resolveRawRetentionPolicy(
  env: NodeJS.ProcessEnv = process.env,
): RawRetentionPolicy {
  const disabled = (env.LLM_CALL_LOG_RAW_RETENTION_DISABLED_KEY_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const all = disabled.includes('*')
  const defaultDays = all
    ? 0
    : parseNonNegativeInt(env.LLM_CALL_LOG_RAW_RETENTION_DAYS, DEFAULT_RAW_RETENTION_DAYS)
  return {
    defaultDays,
    disabledApiKeyIds: all ? [] : disabled,
    all,
  }
}

/** 单行生效天数(行内显式覆盖优先于全局默认)。 */
export function effectiveRetentionDays(
  row: { rawRetentionDays: number | null },
  policy: RawRetentionPolicy,
): number {
  if (policy.all) return 0
  return row.rawRetentionDays ?? policy.defaultDays
}

/** 写入口的原文列取值(O5,2026-09-21 收尾补:留存关闭时**根本不写原文**)。 */
export interface RawTextColumns {
  /** 写入 prompt 列的原文(关闭留存时为空串 —— 该列 NOT NULL,不允许写 NULL 破坏旧读端) */
  prompt: string
  /** 写入 response 列的原文(关闭留存时置 NULL,与清除器口径一致) */
  response: string | null
  /** 本行原文是否留存(=false 时上面两列即无正文;清除器也因此跳过本行) */
  rawRetained: boolean
}

/**
 * 判定一次计费写入应落到 llm_call_logs 原文列的内容。
 *
 * 为什么要写在入口侧:环境变量把某把 key(或 '*')关掉原文留存后,若只靠
 * 定时清除器,新行会带着正文存活到下一个批次 —— 对明确要求不留正文的 key,
 * 这段窗口就是违背承诺。入口侧判定让"关闭"从"迟到清除"变成"永不落盘"。
 *
 * - 关闭时 prompt 落空串(列 NOT NULL,旧读端 SELECT 路径不变,读到空即无原文),
 *   response 落 NULL(与 purgeExpiredLlmCallLogRawText 的置空口径一致);
 * - token 计数、成本、apiKeyId 等归因/计费列与本法无关,调用方照常写。
 */
export function buildRawTextColumns(
  input: { apiKeyId: string | null; prompt: string; response: string | null },
  policy: RawRetentionPolicy = resolveRawRetentionPolicy(),
): RawTextColumns {
  const disabled =
    policy.all || (input.apiKeyId !== null && policy.disabledApiKeyIds.includes(input.apiKeyId))
  if (disabled) return { prompt: '', response: null, rawRetained: false }
  return { prompt: input.prompt, response: input.response, rawRetained: true }
}

/** 清除结果。 */
export interface PurgeRawResult {
  /** 本次被清除原文的行数 */
  purged: number
  /** 使用的策略(回显便于审计日志留痕) */
  policy: RawRetentionPolicy
  /** 是否可能还有到期行(达到 batch 上限时为 true,调用方应继续下一批) */
  hasMore: boolean
}

/**
 * 清除到期(或按 key 关闭留存)的 llm_call_logs 原文。
 *
 * 语义:
 *  - 只动 prompt / response 两列原文;token 计数、成本、状态、apiKeyId 等**全部保留**
 *    → 计费与"哪把 key 调了哪个模型"的归因不受影响;
 *  - prompt 是 NOT NULL 列,清成空串(不改列的空约束,旧行照旧可读);response 直接置 NULL;
 *  - 置 raw_retained=false + raw_purged_at=now() → 幂等,重复执行 0 行受影响;
 *  - FOR UPDATE SKIP LOCKED + LIMIT:与在线计费写入互不阻塞,单批规模可控。
 *
 * ✅ 调度接线(2026-09-21 收尾补齐):plugins/scheduler.ts 已注册每日任务
 *    'llm-call-log-purge-daily'(workers/scheduler-worker.ts 调
 *    purgeAllExpiredLlmCallLogRawText(),循环至 hasMore=false)。
 *    写入口侧的"按 key 关闭"见 buildRawTextColumns(),在
 *    services/relay-billing-service.ts 的 recordCall 落库前生效。
 *
 * @param opts.batch 单批行数上限(默认 500)
 * @param opts.policy 覆盖 env 解析结果(单测/手工运维用)
 */
export async function purgeExpiredLlmCallLogRawText(
  opts: { batch?: number; policy?: RawRetentionPolicy } = {},
): Promise<PurgeRawResult> {
  const policy = opts.policy ?? resolveRawRetentionPolicy()
  const batch = opts.batch && opts.batch > 0 ? opts.batch : DEFAULT_PURGE_BATCH

  // 到期判定:行内 raw_retention_days 优先,NULL 落全局默认。
  // 注意 raw_retention_days=0 时 cutoff = now(),同事务刚插入的行(created_at = now())
  // 本轮不命中,下一轮清除 —— 可接受,避免"写入即看不到自己那行"的边界。
  const expired = sql`${llmCallLogs.createdAt} < now() - COALESCE(${llmCallLogs.rawRetentionDays}, ${policy.defaultDays})::int * interval '1 day'`
  const scopes: SQL[] = [expired]
  if (policy.all) {
    // 全量关闭:任意行都视为到期
    scopes.push(sql`true`)
  } else if (policy.disabledApiKeyIds.length > 0) {
    scopes.push(inArray(llmCallLogs.apiKeyId, policy.disabledApiKeyIds))
  }
  const scopeCond = scopes.length === 1 ? (scopes[0] as SQL) : (or(...scopes) as SQL)
  const where = and(eq(llmCallLogs.rawRetained, true), scopeCond)

  try {
    const raw = await db.execute(sql`
      UPDATE ${llmCallLogs}
         SET prompt = '', response = NULL, raw_retained = false, raw_purged_at = now()
       WHERE id IN (
         SELECT id FROM ${llmCallLogs}
          WHERE ${where}
          ORDER BY created_at
          LIMIT ${batch}
          FOR UPDATE SKIP LOCKED
       )
      RETURNING id
    `)
    const purged = toRows(raw).length
    return { purged, policy, hasMore: purged >= batch }
  } catch (e) {
    // 表未建 / 权限不足 / 迁移未跑:与 recordAuditLog 同口径 —— 降级告警,不抛出打断调用方定时任务
    logger.warn('[audit-log-service] purgeExpiredLlmCallLogRawText failed', {
      error: (e as Error).message,
    })
    return { purged: 0, policy, hasMore: false }
  }
}

/**
 * 循环清除直到无到期行(定时任务入口)。
 * 上限 maxRounds 防止表规模异常时把定时任务钉死;剩余量在下一轮调度继续。
 */
export async function purgeAllExpiredLlmCallLogRawText(
  opts: { batch?: number; maxRounds?: number; policy?: RawRetentionPolicy } = {},
): Promise<PurgeRawResult> {
  const maxRounds = opts.maxRounds ?? 200
  const policy = opts.policy ?? resolveRawRetentionPolicy()
  let purged = 0
  let hasMore = false
  for (let i = 0; i < maxRounds; i++) {
    const r = await purgeExpiredLlmCallLogRawText({ batch: opts.batch, policy })
    purged += r.purged
    hasMore = r.hasMore
    if (!hasMore) break
  }
  return { purged, policy, hasMore }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
