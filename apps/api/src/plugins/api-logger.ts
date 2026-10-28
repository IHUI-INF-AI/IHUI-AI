// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { addApiLogsBatch } from '../db/system-queries.js'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
// O5 归因(2026-09-21):复用 audit-logger 的同一套归因口径,不在此另写一份字段提取。
import {
  OPEN_SURFACE_PREFIXES,
  buildRequestAttribution,
  isOpenSurfacePath,
} from './audit-logger.js'
// 5xx 摘要的打码走日志面唯一出口(见 log-sanitizer.ts 的具名导出注释),不落第二份规则。
import { redactCredentialText } from './log-sanitizer.js'

/**
 * API 日志中间件：记录请求到 api_logs 表。
 *
 * 覆盖范围(O5 修正 2026-09-21):此前只匹配 `/api/` 前缀,对外开放面
 * (/v1/、/v1beta/)整段落在表外 —— 中转站的流量/耗时/错误在 api_logs 里完全不可见。
 * 现同时覆盖 `/api/` + `/v1/` + `/v1beta/`。
 *
 * 采样策略：
 * - 2xx 响应：按采样率记录（默认 100%，可用 API_LOG_SAMPLE_RATE 调低）
 * - 4xx/5xx 响应：全量记录（排查问题）
 * - 健康检查/指标端点：不记录
 * - 配置 API_LOG_ENABLED=false 可完全关闭
 *
 * 关于 apiKeyId:api_logs 表没有 api_key_id 列(建列需改 packages/database/src/schema/system.ts
 * 与 db/system-queries.ts 的插入函数,不在本子任务允许改动的文件范围)。
 * 因此**持久化归因以 audit_logs_chain / audit_logs 的 JSONB 为准**(见 plugins/audit-logger.ts);
 * 本表做的是流量/耗时/错误口径,已按"key 归属人"补齐 userId 维度,使网关流量不再是一排 null。
 * 开放面的 4xx/5xx(401/403/429 这类安全事件)额外打一条结构化 stdout 日志,
 * 让 ELK/pino 侧能直接按 apiKeyId 检索。注意:该行走模块级 logger,不经过
 * log-sanitizer 插件的 request.log Proxy 链 —— 其字段集本身即归因安全:只有
 * id / 脱敏路径 / 状态码 / 耗时 / ip,不含凭据原文与任何请求正文(见
 * audit-logger.ts 的 buildRequestAttribution)。
 *
 * 批量写入策略(#18 修复):
 * - 内存缓冲,满 API_LOG_BATCH_SIZE(默认 100)或每 API_LOG_FLUSH_INTERVAL_MS(默认 5000ms)批量 flush
 * - 进程退出时 onClose 钩子强制 flush 剩余日志
 * - 高 QPS 下减少 DB 往返次数,4xx/5xx 全量记录也不再逐条写库
 */
interface BufferedLog {
  userId?: string
  method: string
  path: string
  statusCode: number
  duration: number
  ip?: string
  userAgent?: string
  error?: string
}

/** 记录范围前缀:站内会话 API + 对外开放面网关(与 nginx 被限流的前缀一一对应)。 */
const LOGGED_PREFIXES: readonly string[] = ['/api/', ...OPEN_SURFACE_PREFIXES]

/**
 * 5xx 摘要(2026-10-28 立,治"api_logs 里的 500 无法追责")。
 *
 * 一手现场:生产 `api_logs` 近 24h 有 18 次 `GET /api/memory -> 500`,而 `error` 列
 * 逐字就是那一行状态码 —— 异常类型、SQLSTATE、堆栈**一个字节都没进表**(它们只落在
 * pino stdout:`server.ts` 的 errorHandler 里 `logger.error({ err })`)。
 * 也就是说这不是"记了被截断",而是**中间件本来就没记**:onResponse 这一刻手里只有
 * 状态码,拿不到那次抛出的错误对象。定位只能靠把同一形请求在本机重放一遍(本次即如此)。
 *
 * 最小修法 = 在**同一个落库出口**里补一条摘要,而不是新建一条链路:
 *   ① `onError` 钩子先于响应结束触发,是"错误对象还带在手上"的最后一个时刻 ——
 *      抓一份存进 WeakMap(以 request 为键,进程内、无跨请求串味、随请求对象回收);
 *   ② `onResponse` 落库时,只对 **>=500** 拼接到原状态码行之后。
 *
 * 为什么只给 5xx:4xx 绝大多数是框架的入参/体校验错误,其 message 会**带上请求体片段**
 * (PII 面),而那一级别本来就能靠状态码定位;5xx 才是"没人知道为什么坏了"的那一格。
 * 脱敏:摘要文本先过日志面唯一出口 `redactCredentialText`(共享层 SECRET_RULES + redactUrl),
 * 再钳到 `ERROR_SUMMARY_LIMIT` 字符、折成单行 —— 不写 token/cookie 原文,也不落多行堆栈。
 */
const ERROR_SUMMARY_LIMIT = 300

/** request → 单行异常摘要(WeakMap:不落全局累积,请求对象回收即消失)。 */
const errorSummaries = new WeakMap<object, string>()

/** 从错误对象取"类名 [+SQLSTATE] + 首行 message",折成一行并钳长。 */
function buildErrorSummary(error: unknown): string {
  const e = error as { name?: unknown; code?: unknown; message?: unknown } | undefined
  const name = typeof e?.name === 'string' && e.name ? e.name : 'Error'
  const sqlState =
    typeof e?.code === 'string' && /^[A-Za-z0-9]{2,6}$/.test(e.code) ? `[${e.code}]` : ''
  const rawMessage = String(e?.message ?? error ?? '')
  const firstLine = rawMessage.split('\n')[0] ?? ''
  const oneLine = `${name}${sqlState ? ' ' + sqlState : ''}: ${firstLine}`
    .replace(/\s+/g, ' ')
    .trim()
  const clipped =
    oneLine.length > ERROR_SUMMARY_LIMIT ? `${oneLine.slice(0, ERROR_SUMMARY_LIMIT)}…` : oneLine
  return redactCredentialText(clipped)
}

/** 落库用的 error 列:状态码行是既有契约(下游按 `-> <code>` 计数),摘要只在 5xx 追加。 */
function composeErrorColumn(
  request: FastifyRequest,
  method: string,
  url: string,
  statusCode: number,
): string {
  const base = `${method} ${url} -> ${statusCode}`
  if (statusCode < 500) return base
  const summary = errorSummaries.get(request)
  return summary ? `${base} | ${summary}` : base
}

const apiLoggerPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  if (!config.API_LOG_ENABLED) return

  const skipPaths = ['/api/health', '/api/metrics', '/health', '/metrics']
  const batchSize = config.API_LOG_BATCH_SIZE ?? 100
  const flushIntervalMs = config.API_LOG_FLUSH_INTERVAL_MS ?? 5000

  // 内存缓冲区
  let buffer: BufferedLog[] = []
  let flushing = false

  /** 批量 flush 缓冲区到 DB。 */
  async function flush(): Promise<void> {
    if (flushing || buffer.length === 0) return
    flushing = true
    const batch = buffer
    buffer = []
    try {
      await addApiLogsBatch(batch)
    } catch (e) {
      logger.warn('[api-logger] flush failed', { error: e })
      // flush 失败丢弃当前批次,避免无限累积(日志写入失败不影响业务)
    } finally {
      flushing = false
    }
  }

  // 定时 flush
  const timer = setInterval(() => {
    flush().catch(() => {})
  }, flushIntervalMs)
  timer.unref?.()

  // 进程退出时强制 flush
  server.addHook('onClose', async () => {
    clearInterval(timer)
    await flush()
  })

  // 错误对象只在 onError 这一刻还带在手上(onResponse 时已被 errorHandler 消费掉),
  // 所以摘要必须在这里抓 —— 这是"5xx 能落到表里"的唯一时机。
  server.addHook('onError', async (request, _reply, error) => {
    try {
      errorSummaries.set(request, buildErrorSummary(error))
    } catch {
      // 摘要抓取本身不得把业务请求带崩;失败时落库退回旧的"只有状态码行"形态(不冒假数据)
    }
  })

  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0] ?? ''
    if (!LOGGED_PREFIXES.some((p) => url.startsWith(p))) return

    // 跳过健康检查和指标端点
    if (skipPaths.some((p) => url === p || url.startsWith(p + '/'))) return

    const method = request.method.toUpperCase()
    const statusCode = reply.statusCode

    // 采样：2xx 按采样率，4xx/5xx 全量
    if (statusCode < 400) {
      if (Math.random() > config.API_LOG_SAMPLE_RATE) return
    }

    const attribution = buildRequestAttribution(request, reply, reply.elapsedTime)
    // 会话用户优先;开放面没有 JWT,则归因到 key 的归属人 —— 否则网关流量的 userId 全为 null
    const userId = attribution.userId ?? attribution.apiKeyOwnerId ?? undefined
    const userAgent = request.headers['user-agent']
    const error =
      statusCode >= 400 ? composeErrorColumn(request, method, url, statusCode) : undefined

    buffer.push({
      userId,
      method,
      path: url.slice(0, 512),
      statusCode,
      duration: Math.round(reply.elapsedTime),
      ip: request.ip,
      userAgent: userAgent ? userAgent.slice(0, 512) : undefined,
      error,
    })

    // 开放面的失败请求(401/403/429 等安全事件)带完整归因打一条 stdout 日志。
    // 只在开放面 + >=400 时输出,正常流量零额外日志量;字段本身不含任何正文。
    if (statusCode >= 400 && isOpenSurfacePath(url)) {
      logger.warn('[api-logger] open-surface request failed', {
        apiKeyId: attribution.apiKeyId,
        apiKeyOwnerId: attribution.apiKeyOwnerId,
        userId: attribution.userId,
        capabilityScope: attribution.capabilityScope,
        capabilityDataClass: attribution.capabilityDataClass,
        method: attribution.method,
        url: attribution.url,
        routePattern: attribution.routePattern,
        statusCode,
        durationMs: attribution.durationMs,
        ip: request.ip,
      })
    }

    // 缓冲满立即 flush(异步,不阻塞响应)
    if (buffer.length >= batchSize) {
      setImmediate(() => flush().catch(() => {}))
    }
  })
}

export default fp(apiLoggerPlugin, {
  name: 'api-logger-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
