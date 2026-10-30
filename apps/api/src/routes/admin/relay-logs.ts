// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/relay/logs 中转站调用日志查询(P0-5b 配套,2026-07-29 立)。
 *
 * 端点清单:
 * 1. GET /admin/relay/logs — 调用日志列表(筛选 userId/model/status/apiKeyId/provider/clientIp/latency/httpStatus/cost/时间范围,分页)
 * 2. GET /admin/relay/logs/stats — 聚合统计(按模型/按日 统计 token + 成本 + 调用次数)
 * 3. GET /admin/relay/logs/error-clusters — 错误聚类(按 error_message 前 80 字符 group by,定位错误突增)
 * 4. GET /admin/relay/logs/:id — 单条请求详情(2026-10-29 立):**恒定脱敏**,含 prompt/response
 *    正文读数与原文留存状态;本条**不提供** raw 旁路(列表的 raw=1 只影响列表投影)
 *
 * 复用 llm_call_logs 表(apiKeyId 关联到 developerApiKeys)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, gte, lte, desc, sql, ilike, or, like, type SQL } from 'drizzle-orm'
import { dbRead } from '../../db/index.js'
import { llmCallLogs, users } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { paginationSchema } from './_shared.js'
import {
  resolveSanitizeInputCap,
  sanitizeLogEntry,
  sanitizeText,
} from '../../services/log-sanitizer.js'
import { redactCredentialText } from '../../plugins/log-sanitizer.js'
import { buildSensitiveKeySet, sanitizeData } from '../../plugins/response-sanitizer.js'

const listQuerySchema = paginationSchema.extend({
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  model: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  status: z.transform(emptyToUndefined).pipe(z.enum(['success', 'error']).optional()),
  apiKeyId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
  /** 渠道筛选,精确匹配 provider_code */
  provider: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  /** 客户端 IP 筛选,支持 LIKE 通配符(如 '192.168.%')*/
  clientIp: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  /** 最小耗时毫秒,筛选 latency_ms >= minLatency(慢调用分析)*/
  minLatency: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** 最大耗时毫秒 */
  maxLatency: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** HTTP 状态码筛选(如 429 限流/500 错误专项)*/
  httpStatus: z
    .transform(emptyToUndefined)
    .pipe(z.coerce.number().int().min(100).max(599).optional()),
  /** 最小成本分 */
  minCost: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** 最大成本分 */
  maxCost: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(0).optional()),
  /** 起始日期 YYYY-MM-DD */
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 结束日期 YYYY-MM-DD */
  endDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 返回原始日志(不脱敏),仅 admin(roleId>=1)可用 */
  raw: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

/** 错误聚类查询 schema(仅支持时间范围筛选)*/
const errorClustersQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  endDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
})

const statsQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  endDate: z.transform(emptyToUndefined).pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  ),
  /** 分组维度:model / day / user */
  groupBy: z.enum(['model', 'day', 'user']).default('model'),
})

/**
 * 单条详情路径参数:id 是 uuid 主键,非 UUID 提前 400
 * (否则打到 PG uuid 列会 500,把"请求写错了"报成"服务坏了")。
 */
const detailParamSchema = z.object({ id: z.uuid({ error: '无效的日志 ID' }) })

/**
 * 详情面额外遮蔽的**凭据类键名**(与 response-sanitizer 的默认清单合并后交给
 * `buildSensitiveKeySet` 这一个出口,匹配规则/掩码形态都不在本文件重写,AGENTS.md §0.6)。
 * 默认清单只有 password/phone/idcard/bankcard/email/token(secret)/apikey,
 * 而落库的 metadata 里可能原样存着请求头名 —— authorization/cookie 这类**不含上述子串**
 * 的凭据键必须在这里显式补上,否则"凭据不回吐"这条承诺结构上不成立。
 */
const DETAIL_CREDENTIAL_EXTRA_KEYS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'api-key',
  'access-key',
  'private-key',
  'secret-key',
  'credential',
  'bearer',
] as const

/**
 * 写入侧截断标记:recordCall 落库前把 prompt/response 截到 5000 字符并追加该字面量
 * (apps/api/src/services/relay-billing-service.ts 的 `truncatedPrompt`/`truncatedResponse`)。
 * 本路由**只识别、不重新实现**截断;不 import billing 模块只为读一个字面量——它会拖入
 * 10+ 个服务,让一条只读详情路由背上计费依赖。收口建议(常量提纯到原文留存策略唯一源
 * audit-log-service.ts)已写进交付报告,由主席决定是否同批做。
 */
const WRITER_TRUNCATION_MARKER = '...[truncated]'

/** 正文列读数状态:五态互斥,禁止把 null 渲染成空字符串冒充"读过了"(AGENTS.md §0.3) */
type RawTextState = 'present' | 'absent' | 'empty' | 'purged' | 'never-written' | 'unjudged'

/** 单列正文的读数(值 + 长度 + 两处截断事实) */
interface RawTextReadout extends Record<string, unknown> {
  state: RawTextState
  /** 库中原文字符数;未取到列时 null(不是 0) */
  storedChars: number | null
  /** 本次回吐字符数;未回吐正文时 null */
  returnedChars: number | null
  /** 脱敏后的正文;无正文/已清除/未判定一律 null,由面板按 state 显示文案 */
  text: string | null
  /** 读取侧脱敏上限是否吃掉了尾巴(sanitizeText 的入口封顶) */
  readSideCapped: boolean
  /** 库中原文尾部带写入侧截断标记 ⇒ 这份正文入库时就已经不是全文 */
  writerTruncated: boolean
  /** 当次生效的读取侧封顶值(env IHUI_LOG_SANITIZE_MAX_CHARS 可覆盖,现读回显) */
  readerCap: number
}

/**
 * 把 prompt/response 一列的**全部可得事实**压成一个诚实读数。
 *
 * 判定序(缺一档都不许往下走):
 * 1. `undefined` ⇒ 未判定(该列没进投影),text/storedChars 都为 null;
 * 2. `rawRetained=false` ⇒ 无正文可读,再按 `rawPurgedAt` 分「到期已清除」与
 *    「写入侧就关闭了留存(本行从未落原文)」——两者对运维是两件不同的事;
 * 3. `null` ⇒ 该调用没有文本产出(错误/未回写 response);
 * 4. `''` ⇒ 空正文;
 * 5. 其余 ⇒ 先走 sanitizeText(入口封顶 → 自有正则),再走 redactCredentialText
 *    (共享层 SECRET_RULES:PEM 块 / URL 内联凭据 / ≥16 位 Bearer)。
 *    顺序不可颠倒:封顶必须排在任何正则之前(services/log-sanitizer.ts A9E-1 纪律)。
 */
function presentRawTextColumn(
  value: string | null | undefined,
  face: { retained: boolean; purgedAt: Date | null },
): RawTextReadout {
  const readerCap = resolveSanitizeInputCap()
  const noText = {
    storedChars: null as number | null,
    returnedChars: null as number | null,
    text: null as string | null,
    readSideCapped: false,
    writerTruncated: false,
    readerCap,
  }
  if (value === undefined) return { ...noText, state: 'unjudged' }
  if (!face.retained) {
    return {
      ...noText,
      storedChars: value === null ? null : value.length,
      state: face.purgedAt ? 'purged' : 'never-written',
    }
  }
  if (value === null) return { ...noText, state: 'absent' }
  if (value === '') return { ...noText, storedChars: 0, state: 'empty' }
  const text = redactCredentialText(sanitizeText(value))
  return {
    state: 'present',
    storedChars: value.length,
    returnedChars: text.length,
    text,
    readSideCapped: value.length > readerCap,
    writerTruncated: value.endsWith(WRITER_TRUNCATION_MARKER),
    readerCap,
  }
}

const relayLogsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ===== 1. GET /admin/relay/logs — 调用日志列表 =====
  server.get('/admin/relay/logs', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const {
      page,
      pageSize,
      search,
      userId,
      model,
      status,
      startDate,
      endDate,
      apiKeyId,
      provider,
      clientIp,
      minLatency,
      maxLatency,
      httpStatus,
      minCost,
      maxCost,
      raw,
    } = q.data

    const conds: SQL[] = []
    if (userId) conds.push(eq(llmCallLogs.userId, userId))
    if (model) conds.push(eq(llmCallLogs.model, model))
    if (status) conds.push(eq(llmCallLogs.status, status))
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    if (apiKeyId) conds.push(eq(llmCallLogs.apiKeyId, apiKeyId))
    if (provider) conds.push(eq(llmCallLogs.providerCode, provider))
    if (clientIp) conds.push(like(llmCallLogs.clientIp, clientIp))
    if (minLatency !== undefined) conds.push(gte(llmCallLogs.latencyMs, minLatency))
    if (maxLatency !== undefined) conds.push(lte(llmCallLogs.latencyMs, maxLatency))
    if (httpStatus !== undefined) conds.push(eq(llmCallLogs.httpStatus, httpStatus))
    if (minCost !== undefined) conds.push(gte(llmCallLogs.costCents, minCost))
    if (maxCost !== undefined) conds.push(lte(llmCallLogs.costCents, maxCost))
    const where = conds.length > 0 ? and(...conds) : undefined

    // search 搜 model 或 errorMessage
    const searchCond = search
      ? or(ilike(llmCallLogs.model, `%${search}%`), ilike(llmCallLogs.errorMessage, `%${search}%`))
      : undefined
    const finalWhere = searchCond && where ? and(where, searchCond) : (where ?? searchCond)

    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select({
            id: llmCallLogs.id,
            userId: llmCallLogs.userId,
            model: llmCallLogs.model,
            promptTokens: llmCallLogs.promptTokens,
            completionTokens: llmCallLogs.completionTokens,
            totalTokens: llmCallLogs.totalTokens,
            latencyMs: llmCallLogs.latencyMs,
            status: llmCallLogs.status,
            errorMessage: llmCallLogs.errorMessage,
            metadata: llmCallLogs.metadata,
            createdAt: llmCallLogs.createdAt,
            username: users.username,
            email: users.email,
            // 高级筛选配套返回字段(字段由 schema subagent 同步添加)
            apiKeyId: llmCallLogs.apiKeyId,
            providerCode: llmCallLogs.providerCode,
            clientIp: llmCallLogs.clientIp,
            costCents: llmCallLogs.costCents,
            httpStatus: llmCallLogs.httpStatus,
            ttftMs: llmCallLogs.ttftMs,
          })
          .from(llmCallLogs)
          .leftJoin(users, eq(llmCallLogs.userId, users.id))
          .where(finalWhere)
          .orderBy(desc(llmCallLogs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ c: sql<number>`count(*)::int` })
          .from(llmCallLogs)
          .where(finalWhere),
      ])
      // 日志脱敏集成(2026-07-31 立):默认对所有日志条目调用 sanitizeLogEntry,
      // raw=true 时传 keepOriginalForAdmin:true 跳过脱敏(仅 admin roleId>=1 可用)
      const keepOriginal = raw === 'true' || raw === '1'
      const sanitizedList = list.map((entry) =>
        sanitizeLogEntry(entry, { keepOriginalForAdmin: keepOriginal }),
      )
      reply.header('X-Log-Sanitized', keepOriginal ? 'false' : 'true')
      return reply.send(
        success({ list: sanitizedList, total: totalRows[0]?.c ?? 0, page, pageSize }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志失败'))
    }
  })

  // ===== 1b. GET /admin/relay/logs/:id — 单条请求详情(2026-10-29 立,恒定脱敏)=====
  // 与列表面的三条纪律差别:
  //  1) 不走列表的 `raw=1` 旁路:详情面的正文列一旦被"原始"读出,凭据就随 prompt/response
  //     原文一起出仓;本路由始终 sanitize,且响应头如实声明 X-Log-Sanitized: true。
  //  2) 键名维与自由文本维**两条都要**:sanitizeLogEntry 只按值打正则(看不见"键叫
  //     authorization 时整值就是凭据"这一维),buildSensitiveKeySet+sanitizeData 只按键名打码
  //     (看不见嵌在正文里的 sk-/Bearer/PEM)。两处都是既有唯一出口,本文件零复算。
  //  3) 字段名必须避开 response-sanitizer 的 "token"/"apikey" 子串规则:全局 onSend 钩子
  //     会把 `promptTokens` 这类 camelCase 计量字段整值洗成 "***"(SAFE_KEYS 只登记了
  //     snake_case 的 prompt_tokens),所以 token 计数收进 usage 子块、调用方 key id 改名
  //     callerKeyId —— 不是风格选择,是让读数真能读到人。
  server.get('/admin/relay/logs/:id', async (request, reply) => {
    const p = detailParamSchema.safeParse(request.params)
    if (!p.success)
      return reply.status(400).send(error(400, p.error.issues[0]?.message ?? '参数错误'))

    try {
      const found = await dbRead
        .select({
          id: llmCallLogs.id,
          userId: llmCallLogs.userId,
          model: llmCallLogs.model,
          prompt: llmCallLogs.prompt,
          response: llmCallLogs.response,
          promptTokens: llmCallLogs.promptTokens,
          completionTokens: llmCallLogs.completionTokens,
          totalTokens: llmCallLogs.totalTokens,
          cacheReadTokens: llmCallLogs.cacheReadTokens,
          cacheCreationTokens: llmCallLogs.cacheCreationTokens,
          latencyMs: llmCallLogs.latencyMs,
          ttftMs: llmCallLogs.ttftMs,
          status: llmCallLogs.status,
          errorMessage: llmCallLogs.errorMessage,
          retryable: llmCallLogs.retryable,
          conversationId: llmCallLogs.conversationId,
          traceId: llmCallLogs.traceId,
          metadata: llmCallLogs.metadata,
          createdAt: llmCallLogs.createdAt,
          callerKeyId: llmCallLogs.apiKeyId,
          providerCode: llmCallLogs.providerCode,
          configId: llmCallLogs.configId,
          accountKeyPoolId: llmCallLogs.keyPoolId,
          clientIp: llmCallLogs.clientIp,
          costCents: llmCallLogs.costCents,
          httpStatus: llmCallLogs.httpStatus,
          callType: llmCallLogs.callType,
          refunded: llmCallLogs.refunded,
          rawRetentionDays: llmCallLogs.rawRetentionDays,
          rawRetained: llmCallLogs.rawRetained,
          rawPurgedAt: llmCallLogs.rawPurgedAt,
          username: users.username,
          email: users.email,
        })
        .from(llmCallLogs)
        .leftJoin(users, eq(llmCallLogs.userId, users.id))
        .where(eq(llmCallLogs.id, p.data.id))
        .limit(1)

      const row = found[0]
      if (!row) return reply.status(404).send(error(404, '调用日志不存在'))

      const retention = { retained: row.rawRetained, purgedAt: row.rawPurgedAt }
      const keys = buildSensitiveKeySet(DETAIL_CREDENTIAL_EXTRA_KEYS)
      // metadata 是 jsonb,写入口把计费/审计之外的上游细节也塞进来 ⇒ 先按键名剥凭据,
      // 再按值打码(顺序:键名维在前,免得凭据整值只被当普通字符串留进文本维输出)。
      const metadataMasked =
        row.metadata === undefined ? null : sanitizeLogEntry(sanitizeData(row.metadata, keys))
      const detail = {
        id: row.id,
        createdAt: row.createdAt,
        userId: row.userId,
        username: row.username,
        email: row.email,
        model: row.model,
        callType: row.callType,
        providerCode: row.providerCode,
        status: row.status,
        httpStatus: row.httpStatus,
        latencyMs: row.latencyMs,
        ttftMs: row.ttftMs,
        costCents: row.costCents,
        refunded: row.refunded,
        /** 失败档位读的是库里的判定列(0=不可重试 / 1=可重试),本路由不另立分类学 */
        retryable: row.retryable,
        errorMessage:
          row.errorMessage === undefined || row.errorMessage === null
            ? null
            : redactCredentialText(sanitizeText(row.errorMessage)),
        conversationId: row.conversationId,
        traceId: row.traceId,
        callerKeyId: row.callerKeyId,
        configId: row.configId,
        accountKeyPoolId: row.accountKeyPoolId,
        clientIp: row.clientIp,
        /** token 计量集中在 usage 子块:键名避开 "token" 子串,免得被全局钩子洗成 "***" */
        usage: {
          prompt: row.promptTokens ?? 0,
          completion: row.completionTokens ?? 0,
          total: row.totalTokens ?? 0,
          cacheRead: row.cacheReadTokens ?? 0,
          cacheCreation: row.cacheCreationTokens ?? 0,
        },
        rawRetention: {
          retained: row.rawRetained,
          retentionDays: row.rawRetentionDays,
          purgedAt: row.rawPurgedAt,
        },
        prompt: presentRawTextColumn(row.prompt, retention),
        response: presentRawTextColumn(row.response, retention),
        metadata: metadataMasked,
        /** metadata 是否真读到了列:jsonb 列缺失时不拿 null 冒充"这行没有元数据" */
        metadataState: row.metadata === undefined ? ('unjudged' as const) : ('read' as const),
        sanitized: true,
      }
      reply.header('X-Log-Sanitized', 'true')
      return reply.send(success(detail))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志详情失败'))
    }
  })

  // ===== 2. GET /admin/relay/logs/stats — 聚合统计 =====
  server.get('/admin/relay/logs/stats', async (request, reply) => {
    const q = statsQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate, groupBy } = q.data

    const conds: SQL[] = []
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = conds.length > 0 ? and(...conds) : undefined

    try {
      let groupCol: SQL
      if (groupBy === 'model') {
        groupCol = sql<string>`${llmCallLogs.model}`
      } else if (groupBy === 'day') {
        groupCol = sql<string>`to_char(${llmCallLogs.createdAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`
      } else {
        groupCol = sql<string>`${llmCallLogs.userId}`
      }

      const rows = await dbRead
        .select({
          groupKey: groupCol.as('group_key'),
          callCount: sql<number>`count(*)::int`,
          totalTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`,
          promptTokens: sql<number>`coalesce(sum(${llmCallLogs.promptTokens}), 0)::bigint::int`,
          completionTokens: sql<number>`coalesce(sum(${llmCallLogs.completionTokens}), 0)::bigint::int`,
          successCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'success')::int`,
          errorCount: sql<number>`count(*) filter (where ${llmCallLogs.status} = 'error')::int`,
          avgLatencyMs: sql<number>`coalesce(avg(${llmCallLogs.latencyMs}), 0)::int`,
          totalCostCents: sql<number>`coalesce(sum(((${llmCallLogs.metadata}->>'costCents')::numeric)::int), 0)::int`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(groupCol)
        .orderBy(desc(sql`count(*)::int`))
        .limit(100)

      return reply.send(success({ groupBy, rows }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询调用日志统计失败'))
    }
  })

  // ===== 3. GET /admin/relay/logs/error-clusters — 错误聚类(2026-07-31 立)=====
  // 按 error_message 前 80 字符 group by,返回 top 20 错误类型 + count + 最近发生时间 + 示例 logId
  // 用于快速定位"今天为什么 500 错误突增"
  server.get('/admin/relay/logs/error-clusters', async (request, reply) => {
    const q = errorClustersQuerySchema.safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate } = q.data

    const conds: SQL[] = [
      eq(llmCallLogs.status, 'error'),
      sql`${llmCallLogs.errorMessage} IS NOT NULL`,
    ]
    if (startDate) conds.push(gte(llmCallLogs.createdAt, new Date(`${startDate}T00:00:00Z`)))
    if (endDate) conds.push(lte(llmCallLogs.createdAt, new Date(`${endDate}T23:59:59Z`)))
    const where = and(...conds)

    try {
      const errorPrefix = sql<string>`left(${llmCallLogs.errorMessage}, 80)`
      const rows = await dbRead
        .select({
          errorPrefix: errorPrefix.as('error_prefix'),
          count: sql<number>`count(*)::int`,
          lastSeen: sql<Date>`max(${llmCallLogs.createdAt})`,
          sampleLogId: sql<string>`(array_agg(${llmCallLogs.id} ORDER BY ${llmCallLogs.createdAt} DESC))[1]`,
        })
        .from(llmCallLogs)
        .where(where)
        .groupBy(errorPrefix)
        .orderBy(desc(sql`count(*)::int`))
        .limit(20)

      return reply.send(success({ clusters: rows, total: rows.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询错误聚类失败'))
    }
  })
}

export default relayLogsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
