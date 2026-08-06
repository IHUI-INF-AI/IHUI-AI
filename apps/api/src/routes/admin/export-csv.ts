/**
 * /api/admin/export CSV 导出(财务对账刚需,2026-07-31 立)。
 *
 * 端点清单:
 * 1. GET /admin/export/orders.csv     — 充值订单导出(join users 拿 username/email)
 * 2. GET /admin/export/relay-logs.csv — 调用日志导出(复用 relay-logs.ts 13 个筛选维度)
 *
 * 约束:
 * - admin 鉴权(roleId >= 1),复用 requireAdmin preHandler
 * - 限流:每 admin 每分钟最多 5 次导出(防大数据量拖垮 DB)
 * - 单次最多 100000 行,超过返回 400 + 提示缩小时间范围
 * - 超过 10000 行响应头 X-Export-Warning: large_dataset
 * - UTF-8 with BOM(Excel 中文兼容)
 *
 * 复用 orders(billing) + llm_call_logs + users + developer_api_keys 表。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, like, sql, type SQL } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { orders, llmCallLogs, users, developerApiKeys } from '@ihui/database'
import { error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { sanitizeCsvCell } from '../../utils/csv-utils.js'

// =============================================================================
// 常量
// =============================================================================

/** 单次导出最大行数(防拖垮 DB + 内存) */
const MAX_EXPORT_ROWS = 100000

/** 大数据量警告阈值(超过在响应头提示) */
const LARGE_DATASET_THRESHOLD = 10000

/** 每 admin 每分钟最多导出次数 */
const RATE_LIMIT_MAX = 5

/** 限流窗口(毫秒) */
const RATE_LIMIT_WINDOW_MS = 60_000

/** UTF-8 BOM(Excel 中文兼容) */
const CSV_BOM = '\uFEFF'

// =============================================================================
// 类型定义
// =============================================================================

/** CSV 列定义 */
interface CsvColumn {
  key: string
  header: string
  formatter?: (value: unknown) => string
}

/** 限流记录:userId → 时间戳数组(滑动窗口) */
const exportRateLimiter = new Map<string, number[]>()

// =============================================================================
// CSV 生成
// =============================================================================

/**
 * 把单个字段值转义为 CSV 安全字符串。
 * - 空字符串保持空
 * - 含逗号/引号/换行 → 双引号包裹,内部双引号转义为两个双引号
 * - P2 修复(2026-08-06):先做公式注入防护——以 `=`/`+`/`-`/`@` 开头的值前缀 `'`,
 *   防止导出单元格被 Excel 当公式执行(用户名/邮箱/订单号等字段用户可控)。
 *   金额等数字字段由程序生成不受影响。
 */
function escapeCsvField(value: string): string {
  const safe = sanitizeCsvCell(value)
  if (safe === '') return ''
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * 通用 CSV 生成函数。
 * - 表头:列 header 用逗号拼接
 * - 每行:按 columns.key 取值,经 formatter 转换后转义
 * - null/undefined 输出空字符串
 * - 时间字段格式化为 ISO 8601(formatter 负责)
 * - 行分隔符 \r\n(Excel 兼容)
 */
function generateCsv(rows: Record<string, unknown>[], columns: CsvColumn[]): string {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(',')
  const bodyLines = rows.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key]
        const formatted = col.formatter
          ? col.formatter(raw)
          : raw === null || raw === undefined
            ? ''
            : String(raw)
        return escapeCsvField(formatted)
      })
      .join(','),
  )
  return (
    CSV_BOM + headerLine + '\r\n' + bodyLines.join('\r\n') + (bodyLines.length > 0 ? '\r\n' : '')
  )
}

/** Date/时间字段 → ISO 8601 字符串(null/undefined → 空字符串) */
function formatIsoDate(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/** 订单类型映射(orders.order_type 整数 → 中文标签) */
function formatOrderType(value: unknown): string {
  const map: Record<number, string> = {
    0: '未分类',
    1: '会员',
    2: 'Token',
    3: '活动',
    4: '身份',
    6: 'API订阅',
  }
  if (typeof value === 'number') return map[value] ?? String(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? value : (map[n] ?? value)
  }
  return value === null || value === undefined ? '' : String(value)
}

// =============================================================================
// CSV 列定义(const 数组)
// =============================================================================

const orderColumns: CsvColumn[] = [
  { key: 'orderNo', header: '订单号' },
  { key: 'userId', header: '用户ID' },
  { key: 'username', header: '用户名' },
  { key: 'email', header: '邮箱' },
  { key: 'orderType', header: '订单类型', formatter: formatOrderType },
  { key: 'amount', header: '金额(分)' },
  { key: 'paymentMethod', header: '支付方式' },
  { key: 'status', header: '状态' },
  { key: 'createdAt', header: '创建时间', formatter: formatIsoDate },
  { key: 'paidAt', header: '支付时间', formatter: formatIsoDate },
]

const relayLogColumns: CsvColumn[] = [
  { key: 'id', header: '日志ID' },
  { key: 'userId', header: '用户ID' },
  { key: 'username', header: '用户名' },
  { key: 'apiKeyId', header: 'API Key ID' },
  { key: 'apiKeyName', header: 'API Key 名' },
  { key: 'model', header: '模型' },
  { key: 'providerCode', header: 'Provider' },
  { key: 'status', header: '状态' },
  { key: 'promptTokens', header: 'Prompt Tokens' },
  { key: 'completionTokens', header: 'Completion Tokens' },
  { key: 'totalTokens', header: 'Total Tokens' },
  { key: 'costCents', header: '成本(分)' },
  { key: 'latencyMs', header: '延迟(ms)' },
  { key: 'ttftMs', header: 'TTFT(ms)' },
  { key: 'httpStatus', header: 'HTTP 状态' },
  { key: 'clientIp', header: '客户端IP' },
  { key: 'createdAt', header: '创建时间', formatter: formatIsoDate },
]

// =============================================================================
// 限流
// =============================================================================

/**
 * 检查导出限流。返回 true 表示允许,false 表示超限。
 * 滑动窗口:保留最近 60s 内的时间戳,超过 RATE_LIMIT_MAX 次拒绝。
 */
function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const cutoff = now - RATE_LIMIT_WINDOW_MS
  const arr = exportRateLimiter.get(userId) ?? []
  const recent = arr.filter((t) => t > cutoff)
  if (recent.length >= RATE_LIMIT_MAX) {
    exportRateLimiter.set(userId, recent)
    return false
  }
  recent.push(now)
  exportRateLimiter.set(userId, recent)
  return true
}

// =============================================================================
// Zod 校验 schema
// =============================================================================

const dateStrSchema = z.transform(emptyToUndefined).pipe(
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
)

const ordersExportQuerySchema = z.object({
  startDate: dateStrSchema,
  endDate: dateStrSchema,
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(
    z.enum(['pending', 'paid', 'cancelled', 'refunded']).optional(),
  ),
  paymentMethod: z.transform(emptyToUndefined).pipe(
    z.enum(['wechat', 'alipay', 'stripe', 'paypal', 'usdc']).optional(),
  ),
})

/** 复用 relay-logs.ts 的 13 个筛选维度 */
const relayLogsExportQuerySchema = z.object({
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  model: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  status: z.transform(emptyToUndefined).pipe(z.enum(['success', 'error']).optional()),
  apiKeyId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  provider: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  clientIp: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  minLatency: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  maxLatency: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  httpStatus: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(100).max(599).optional()),
  minCost: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  maxCost: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  startDate: dateStrSchema,
  endDate: dateStrSchema,
})

// =============================================================================
// 响应辅助
// =============================================================================

/** 生成带时间戳的文件名,如 orders_20260731_120000.csv */
function buildFilename(prefix: string): string {
  const d = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${prefix}_${ts}.csv`
}

/** 统一发送 CSV 响应(UTF-8 with BOM + 大数据量警告头) */
function sendCsv(reply: FastifyReply, csv: string, filename: string, rowCount: number): void {
  const csvBuffer = Buffer.from(csv, 'utf-8')
  reply.header('Content-Type', 'text/csv; charset=utf-8')
  reply.header('Content-Disposition', `attachment; filename="${filename}"`)
  reply.header('Content-Length', csvBuffer.byteLength)
  if (rowCount > LARGE_DATASET_THRESHOLD) {
    reply.header('X-Export-Warning', 'large_dataset')
  }
  reply.send(csvBuffer)
}

// =============================================================================
// 路由
// =============================================================================

const exportCsvRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/export/orders.csv — 充值订单导出 =====
  server.get('/export/orders.csv', async (request: FastifyRequest, reply) => {
    const adminUserId = request.userId
    if (!adminUserId) return reply.status(401).send(error(401, '未登录'))
    if (!checkRateLimit(adminUserId)) {
      return reply.status(429).send(error(429, '导出过于频繁,每分钟最多 5 次,请稍后再试'))
    }

    const q = ordersExportQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    const { startDate, endDate, userId, status, paymentMethod } = q.data

    const conds: SQL[] = []
    if (userId) conds.push(eq(orders.userId, userId))
    if (status) conds.push(eq(orders.status, status))
    if (paymentMethod) conds.push(eq(orders.paymentMethod, paymentMethod))
    if (startDate) conds.push(gte(orders.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(orders.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = conds.length > 0 ? and(...conds) : undefined

    try {
      // 先 count,超限直接拒绝(避免拉取超大结果集)
      const [countRow] = await dbRead
        .select({ c: sql<number>`count(*)::int` })
        .from(orders)
        .where(where)
      const total = countRow?.c ?? 0
      if (total > MAX_EXPORT_ROWS) {
        return reply
          .status(400)
          .send(
            error(400, `筛选结果 ${total} 行超过最大导出行数 ${MAX_EXPORT_ROWS},请缩小时间范围`),
          )
      }

      const rows = await dbRead
        .select({
          orderNo: orders.orderNo,
          userId: orders.userId,
          username: users.username,
          email: users.email,
          orderType: orders.orderType,
          amount: orders.amount,
          paymentMethod: orders.paymentMethod,
          status: orders.status,
          createdAt: orders.createdAt,
          paidAt: orders.paidAt,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(MAX_EXPORT_ROWS)

      const csv = generateCsv(rows as Record<string, unknown>[], orderColumns)
      sendCsv(reply, csv, buildFilename('orders'), rows.length)
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '导出订单失败'))
    }
  })

  // ===== 2. GET /admin/export/relay-logs.csv — 调用日志导出 =====
  server.get('/export/relay-logs.csv', async (request: FastifyRequest, reply) => {
    const adminUserId = request.userId
    if (!adminUserId) return reply.status(401).send(error(401, '未登录'))
    if (!checkRateLimit(adminUserId)) {
      return reply.status(429).send(error(429, '导出过于频繁,每分钟最多 5 次,请稍后再试'))
    }

    const q = relayLogsExportQuerySchema.safeParse(request.query)
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    }
    const {
      userId,
      model,
      status,
      apiKeyId,
      provider,
      clientIp,
      minLatency,
      maxLatency,
      httpStatus,
      minCost,
      maxCost,
      startDate,
      endDate,
    } = q.data

    const conds: SQL[] = []
    if (userId) conds.push(eq(llmCallLogs.userId, userId))
    if (model) conds.push(eq(llmCallLogs.model, model))
    if (status) conds.push(eq(llmCallLogs.status, status))
    if (apiKeyId) conds.push(eq(llmCallLogs.apiKeyId, apiKeyId))
    if (provider) conds.push(eq(llmCallLogs.providerCode, provider))
    if (clientIp) conds.push(like(llmCallLogs.clientIp, clientIp))
    if (minLatency !== undefined) conds.push(gte(llmCallLogs.latencyMs, minLatency))
    if (maxLatency !== undefined) conds.push(lte(llmCallLogs.latencyMs, maxLatency))
    if (httpStatus !== undefined) conds.push(eq(llmCallLogs.httpStatus, httpStatus))
    if (minCost !== undefined) conds.push(gte(llmCallLogs.costCents, minCost))
    if (maxCost !== undefined) conds.push(lte(llmCallLogs.costCents, maxCost))
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = conds.length > 0 ? and(...conds) : undefined

    try {
      const [countRow] = await dbRead
        .select({ c: sql<number>`count(*)::int` })
        .from(llmCallLogs)
        .where(where)
      const total = countRow?.c ?? 0
      if (total > MAX_EXPORT_ROWS) {
        return reply
          .status(400)
          .send(
            error(400, `筛选结果 ${total} 行超过最大导出行数 ${MAX_EXPORT_ROWS},请缩小时间范围`),
          )
      }

      const rows = await dbRead
        .select({
          id: llmCallLogs.id,
          userId: llmCallLogs.userId,
          username: users.username,
          apiKeyId: llmCallLogs.apiKeyId,
          apiKeyName: developerApiKeys.name,
          model: llmCallLogs.model,
          providerCode: llmCallLogs.providerCode,
          status: llmCallLogs.status,
          promptTokens: llmCallLogs.promptTokens,
          completionTokens: llmCallLogs.completionTokens,
          totalTokens: llmCallLogs.totalTokens,
          costCents: llmCallLogs.costCents,
          latencyMs: llmCallLogs.latencyMs,
          ttftMs: llmCallLogs.ttftMs,
          httpStatus: llmCallLogs.httpStatus,
          clientIp: llmCallLogs.clientIp,
          createdAt: llmCallLogs.createdAt,
        })
        .from(llmCallLogs)
        .leftJoin(users, eq(llmCallLogs.userId, users.id))
        .leftJoin(developerApiKeys, eq(llmCallLogs.apiKeyId, developerApiKeys.id))
        .where(where)
        .orderBy(desc(llmCallLogs.createdAt))
        .limit(MAX_EXPORT_ROWS)

      const csv = generateCsv(rows as Record<string, unknown>[], relayLogColumns)
      sendCsv(reply, csv, buildFilename('relay-logs'), rows.length)
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '导出调用日志失败'))
    }
  })
}

export default exportCsvRoutes
