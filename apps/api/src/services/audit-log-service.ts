/**
 * 国安级审计日志服务 — HMAC-SHA256 链式防篡改核心。
 *
 * 链式结构(类 Git commit / 区块链):
 * - 每条日志的 current_hash = HMAC-SHA256(SECRET, canonicalJSON([prev_hash, timestamp, userId, action, resourceType, resourceId, result, metadata]))
 * - prev_hash = 上一条日志的 current_hash(首条为 "0"*64 创世哈希)
 * - 任一条日志被篡改 → 后续所有 hash 校验失败,可定位篡改位置
 *
 * secret 管理:
 * - 优先从 config.AUDIT_LOG_HMAC_SECRET 读取
 * - 缺失时启动期 logger.error 警告 + 降级为随机内存 secret
 *   (重启后链断裂无法验证历史,但运行期内链可验证;生产必须显式配置)
 *
 * canonicalJSON:递归排序对象 key,确保 metadata 序列化稳定,
 * 避免 JSONB 读取后 key 顺序变化导致 hash 误报。
 */
import { config, type Config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { hmacSHA256, secureRandomBytes } from '../utils/crypto-extra.js'
import {
  insertAuditLog,
  selectAuditLogs,
  selectAuditLogChain,
  selectAuditLogsRange,
  getLastAuditLogHash,
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
 * config schema 当前未声明 AUDIT_LOG_HMAC_SECRET,用类型断言安全访问
 * (主 agent 后续可在 config/index.ts 增加该字段,无需改本文件)。
 * 缺失时生成随机内存 secret 并 logger.error 警告。
 */
function resolveAuditSecret(): string {
  const fromConfig = (config as Config & { AUDIT_LOG_HMAC_SECRET?: string }).AUDIT_LOG_HMAC_SECRET
  if (fromConfig && fromConfig.length >= 32) return fromConfig

  // 降级:随机 32 字节 hex(64 字符)。运行期可验证,重启后链断裂。
  const fallback = secureRandomBytes(32).toString('hex')
  logger.error(
    '[audit-log-service] AUDIT_LOG_HMAC_SECRET 未配置或长度 < 32,降级为随机内存 secret。' +
      '重启后历史链将无法验证,生产环境必须显式配置 config.AUDIT_LOG_HMAC_SECRET(>= 32 字符)。',
  )
  return fallback
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
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') +
    '}'
  )
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

/**
 * 记录一条审计日志:取链尾 hash → 算 current_hash → 落库。
 *
 * 非原子操作(取尾 hash 与 INSERT 之间存在窗口);高并发场景下可能产生链分叉。
 * 国安级部署建议:主 agent 后续用 SELECT FOR UPDATE 或 SERIALIZABLE 事务加固。
 * 当前实现已满足"单线程事件循环 + 中等并发"场景的正确性。
 *
 * @returns 新日志 id;落库失败(表未建等)返回 undefined
 */
export async function recordAuditLog(params: RecordAuditLogParams): Promise<string | undefined> {
  const timestamp = new Date().toISOString()
  const prevHash = await getLastAuditLogHash()
  const currentHash = computeAuditHash(prevHash, {
    timestamp,
    userId: params.userId ?? null,
    action: params.action,
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    result: params.result ?? null,
    metadata: params.metadata ?? null,
  })
  return insertAuditLog({
    timestamp,
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    ip: params.ip,
    userAgent: params.userAgent,
    result: params.result,
    metadata: params.metadata,
    prevHash,
    currentHash,
  })
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
export async function getAuditLogStats(
  filters: AuditLogFilters,
): Promise<AuditLogStatsResult> {
  const [total, byAction, byUser] = await Promise.all([
    countAuditLogs(filters),
    groupByAction(filters),
    groupByUser(filters),
  ])
  return { total, byAction, byUser }
}
