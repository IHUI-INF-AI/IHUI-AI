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
export interface IntegrityVerificationResult {
  valid: boolean
  totalChecked: number
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

  // 生产环境强制要求配置,缺失时拒绝启动
  if (config.NODE_ENV === 'production') {
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

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']'
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}'
}

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
 */
export function verifyAuditLogIntegrity(logs: AuditLogChainRow[]): IntegrityVerificationResult {
  if (logs.length === 0) {
    return { valid: true, totalChecked: 0 }
  }

  let expectedPrev = logs[0]?.prevHash ?? GENESIS_HASH

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]
    if (!log) break

    // 检查 1:prev_hash 链式关系
    if (log.prevHash !== expectedPrev) {
      return {
        valid: false,
        totalChecked: i,
        tamperedIndex: i,
        tamperedId: log.id,
        reason: `prev_hash 链断裂:期望 ${expectedPrev.slice(0, 16)}…,实际 ${log.prevHash.slice(0, 16)}…`,
      }
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
        tamperedIndex: i,
        tamperedId: log.id,
        reason: `current_hash 不匹配:期望 ${recomputed.slice(0, 16)}…,实际 ${log.currentHash.slice(0, 16)}…`,
      }
    }

    expectedPrev = log.currentHash
  }

  return { valid: true, totalChecked: logs.length }
}

/** 验证某用户最近 N 条日志链(委托查询 + 验证)。 */
export async function verifyUserChain(
  userId: string,
  limit = 1000,
): Promise<IntegrityVerificationResult> {
  const logs = await selectAuditLogChain(userId, limit)
  return verifyAuditLogIntegrity(logs)
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
  const defaultDays = all ? 0 : parseNonNegativeInt(env.LLM_CALL_LOG_RAW_RETENTION_DAYS, DEFAULT_RAW_RETENTION_DAYS)
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
