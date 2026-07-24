/**
 * SIEM 导出器 — 将链式审计日志格式化为 SIEM 平台兼容格式。
 *
 * 支持三种格式:
 * - CEF  (Common Event Format, ArcSight):  CEF:0|IHUI|API|1.0|Name|Severity|Extension
 * - LEEF (Log Event Extended Format, QRadar): LEEF:1.0|IHUI|API|EventClassID|Severity|key=val\t...
 * - JSON (结构化,默认)
 *
 * 流式导出 streamExport:分页拉取 + AsyncGenerator 逐行 yield,
 * 避免一次性加载全量日志导致内存爆炸。
 */
import type { AuditLogChainRow, AuditLogFilters } from '../db/audit-queries.js'
import { selectAuditLogs } from '../db/audit-queries.js'

export type SiemFormat = 'json' | 'cef' | 'leef'

const VENDOR = 'IHUI'
const PRODUCT = 'API'
const VERSION = '1.0'

/** action → CEF Name / LEEF EventClassID 映射。 */
function eventName(action: string): string {
  switch (action) {
    case 'auth.login':
      return 'UserLogin'
    case 'auth.logout':
      return 'UserLogout'
    case 'user.create':
      return 'UserCreate'
    case 'user.update':
      return 'UserUpdate'
    case 'user.delete':
      return 'UserDelete'
    case 'data.read':
      return 'DataAccess'
    case 'data.write':
      return 'DataWrite'
    case 'admin.op':
      return 'AdminOperation'
    default:
      return action || 'Unknown'
  }
}

/** action + result → CEF Severity (0-10,ArcSight 标准)。 */
function severityOf(log: AuditLogChainRow): number {
  if (log.result === 'failure' || log.result === 'denied') {
    // 失败的认证/鉴权是高优先级(可能是攻击)
    if (log.action === 'auth.login' || log.action === 'admin.op') return 8
    return 6
  }
  switch (log.action) {
    case 'auth.login':
      return 3
    case 'auth.logout':
      return 2
    case 'admin.op':
      return 6
    case 'user.create':
    case 'user.update':
    case 'user.delete':
      return 5
    case 'data.write':
      return 4
    case 'data.read':
      return 2
    default:
      return 3
  }
}

/** CEF Extension 字段:act/dst/duser/suser/msg/proto/rt 等标准 key。 */
function cefExtension(log: AuditLogChainRow): string {
  const parts = [
    `act=${log.action}`,
    `rt=${log.timestamp}`,
    `dst=${log.ip ?? '0.0.0.0'}`,
    log.userId ? `suser=${log.userId}` : '',
    log.resourceType ? `cs1=${log.resourceType}` : '',
    log.resourceId ? `cs2=${log.resourceId}` : '',
    log.result ? `outcome=${log.result}` : '',
    log.userAgent ? `requestContext=${cefEscape(log.userAgent)}` : '',
  ]
  return parts.filter(Boolean).join(' ')
}

/** CEF 值转义:管道/反斜杠/等号/换行需转义。 */
function cefEscape(v: string): string {
  return v.replace(/[\\|=]/g, '\\$&').replace(/[\r\n]/g, ' ')
}

/** LEEF 值转义:管道需转义为 \|,等号在 value 中需转义。 */
function leefEscape(v: string): string {
  return v.replace(/[\\|]/g, '\\$&').replace(/[\r\n]/g, ' ')
}

/** 格式化为 CEF 单行。 */
export function formatCEF(log: AuditLogChainRow): string {
  const name = eventName(log.action)
  const sev = severityOf(log)
  const ext = cefExtension(log)
  return `CEF:0|${VENDOR}|${PRODUCT}|${VERSION}|${name}|${sev}|${ext}`
}

/** 格式化为 LEEF 单行。 */
export function formatLEEF(log: AuditLogChainRow): string {
  const eventClass = eventName(log.action)
  const sev = severityOf(log)
  const kvs = [
    `act=${leefEscape(log.action)}`,
    `rt=${log.timestamp}`,
    `src=${leefEscape(log.ip ?? '')}`,
    log.userId ? `usr=${leefEscape(log.userId)}` : '',
    log.resourceType ? `resource=${leefEscape(log.resourceType)}` : '',
    log.resourceId ? `rid=${leefEscape(log.resourceId)}` : '',
    log.result ? `result=${leefEscape(log.result)}` : '',
    log.userAgent ? `ua=${leefEscape(log.userAgent)}` : '',
    log.metadata ? `meta=${leefEscape(JSON.stringify(log.metadata))}` : '',
  ].filter(Boolean)
  return `LEEF:1.0|${VENDOR}|${PRODUCT}|${eventClass}|${sev}|${kvs.join('\t')}`
}

/** 格式化为 JSON 单行(JSON Lines,每行一个独立 JSON 对象)。 */
export function formatJSON(log: AuditLogChainRow): string {
  return JSON.stringify({
    id: log.id,
    timestamp: log.timestamp,
    userId: log.userId,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: log.resourceId,
    ip: log.ip,
    userAgent: log.userAgent,
    result: log.result,
    metadata: log.metadata,
    prevHash: log.prevHash,
    currentHash: log.currentHash,
  })
}

/** 按格式分发格式化函数。 */
export function formatLog(log: AuditLogChainRow, format: SiemFormat): string {
  switch (format) {
    case 'cef':
      return formatCEF(log)
    case 'leef':
      return formatLEEF(log)
    case 'json':
    default:
      return formatJSON(log)
  }
}

/** 流式导出格式化头部(部分格式有 header 行)。 */
export function formatHeader(format: SiemFormat): string {
  // CEF/LEEF/JSON Lines 均无独立 header;预留扩展点。
  return format === 'json' ? '' : ''
}

/**
 * 流式导出审计日志。
 *
 * 分页拉取(每页 PAGE_SIZE 条),逐条 yield 格式化后的行。
 * 受 maxItems 上限保护(默认 10000,防止超大导出拖垮内存)。
 *
 * 用法:
 *   for await (const line of streamExport(filters, 'cef')) {
 *     reply.raw.write(line + '\n')
 *   }
 */
export async function* streamExport(
  filters: AuditLogFilters,
  format: SiemFormat,
  maxItems = 10000,
): AsyncGenerator<string> {
  const PAGE_SIZE = 500
  let page = 1
  let emitted = 0

  while (emitted < maxItems) {
    const need = Math.min(PAGE_SIZE, maxItems - emitted)
    const { list } = await selectAuditLogs(filters, page, need)
    if (list.length === 0) break
    for (const row of list) {
      if (emitted >= maxItems) break
      yield formatLog(row, format)
      emitted++
    }
    if (list.length < need) break // 已到末页
    page++
  }
}
