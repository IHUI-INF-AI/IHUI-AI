/**
 * SQL 注入运行时检测插件(P0-4 安全加固)。
 *
 * preHandler 阶段扫描 request.body / request.query / request.params 的所有字符串值,
 * 调用 security-service.ts 的 InputValidator.checkSqlInjection 做关键字 + 引号/分号组合检测。
 *
 * 命中策略:
 * - 400 拒绝 + 通用消息(不泄露检测规则细节)
 * - 告警日志:ip / userId / requestId / 命中值(截断)
 * - IP 信誉扣分:调用 ip-reputation.recordBadEvent
 *
 * 跳过场景:
 * - 健康检查 / 监控路径(/api/health, /api/metrics, /business-metrics)
 * - 文件上传(multipart,已由 upload-scanner 处理)
 * - 路由级关闭:routeOptions.config.sqliGuard = { enabled: false }
 *
 * 设计为防御纵深:xss-protection(onRequest)先做 HTML 实体编码,本插件(preHandler)
 * 再做 SQL 注入检测,两层独立工作互不依赖。
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import type { Redis } from 'ioredis'
import { InputValidator } from '../services/security-service.js'
import { logger } from '../utils/logger.js'
import { getIpReputationService } from '../services/ip-reputation.js'

export interface SqliGuardRouteConfig {
  /** 是否启用本插件,默认 true */
  enabled?: boolean
}

declare module 'fastify' {
  interface FastifyContextConfig {
    sqliGuard?: SqliGuardRouteConfig
  }
}

/** 健康检查 / 监控路径白名单(不检测 SQL 注入)。 */
const SKIP_PATHS = new Set(['/api/health', '/api/metrics', '/business-metrics'])

/**
 * P2 修复(2026-08-06):AI 内容端点白名单。
 *
 * 背景:全局关键字检测(SELECT/UNION/OR 等)对 AI 类端点是误杀源——
 * 用户 prompt 是自由文本,天然可能包含 "select/union/or/where" 等词,配合引号/分号
 * 即命中 InputValidator.checkSqlInjection,导致正常 AI 请求被 400 拒绝。
 *
 * 方案:命中以下路径前缀的请求跳过关键字检测,但仍做强特征检测
 * (SQL 注释符 `--`/`/*`/`#`,以及分号后的堆叠查询 `; SELECT ...`)。
 * 这些端点接收的是交给 LLM 的自由文本而非 SQL,关键字本身无注入能力;
 * 真正危险的注释符/堆叠语句特征仍会被拦截。路径按前缀匹配(小写)。
 */
const AI_CONTENT_PREFIXES = [
  '/api/llm/',
  '/api/ai/',
  '/api/chat/',
  '/api/langchain/',
  '/api/ai-ext/',
  '/api/ai-feed/',
  '/api/ai-education/',
  '/api/ai-video-compose/',
  '/api/ai-vendors/',
  '/api/workspace-ai/',
  '/api/workspace/ai/',
  '/v1/',
  // 2026-08-10:访问埋点,body 是用户浏览的 URL 文本(可能含 -- / ; 等字符),
  // 仅写 visit_logs 一条记录,无 SQL 拼接风险,按自由文本处理
  '/api/visit-tracking/',
  // 2026-08-10:行为埋点,body 含自由文本(label/关键词),按自由文本处理
  '/api/analytics/track',
]

/**
 * 强 SQL 注入特征(非 AI 路径完整检测):
 * - `--`(后跟空白/行尾,PostgreSQL 注释;`--` 后跟数字如 `1--2` 是减法,非注释)
 * - 斜杠星号 ... 星号斜杠(PostgreSQL 块注释)
 * - 分号后的堆叠查询语句(; SELECT/UNION/... )
 *
 * 2026-08-06 P2 修复(生产故障):移除 `#` 单字符特征。
 * PostgreSQL 中 `#` 不是注释符(MySQL/MariaDB 才用),且 `#1`/`#tag`/`C#` 等
 * 在用户正常文本中出现频率极高,导致 AI 对话内容被误杀(线上用户消息
 * "[Advisor consultation #1]" 被 400 拦截 → 前端无限重连)。堆叠查询正则
 * 与关键字检测已足够覆盖真实注入,`#` 对 PG 无威胁。
 */
const SQLI_STRONG_PATTERN =
  /(--\s|--$|\/\*[\s\S]*?\*\/)|;\s*(select|union|insert|update|delete|drop|alter|create|exec|truncate)\b/im

/**
 * AI 内容路径强特征(2026-08-06 生产故障修复):去掉 `--\s`/`--$`。
 * 根因:Markdown 表格分隔行 `| --- |` 含 "-- " 被误判为 PG 注释 →
 * 历史消息里只要有表格,之后任何对话(携带完整历史)都被 400 拦截 → 前端无限重连
 * (实测:AI 回复架构表格后,用户发"架构怎么优化"连续 4 次被拦)。
 * AI 端点内容交给 LLM 不拼 SQL,仅保留块注释与分号堆叠查询两个真正危险特征。
 */
const SQLI_STRONG_PATTERN_AI =
  /(\/\*[\s\S]*?\*\/)|;\s*(select|union|insert|update|delete|drop|alter|create|exec|truncate)\b/im

/** 递归扫描对象/数组中的字符串值,检测强 SQL 注入特征(供豁免路径使用)。 */
function detectStrongSqli(data: unknown, pattern: RegExp = SQLI_STRONG_PATTERN): string | null {
  if (typeof data === 'string') {
    return pattern.test(data) ? data.slice(0, 200) : null
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const hit = detectStrongSqli(item, pattern)
      if (hit) return hit
    }
    return null
  }
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const hit = detectStrongSqli(v, pattern)
      if (hit) return hit
    }
  }
  return null
}

/** 递归扫描对象/数组中的字符串值,返回首个命中 SQL 注入的值(截断 200 字符),未命中返回 null。 */
function detectSqlInjection(data: unknown): string | null {
  if (typeof data === 'string') {
    return InputValidator.checkSqlInjection(data) ? data.slice(0, 200) : null
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const hit = detectSqlInjection(item)
      if (hit) return hit
    }
    return null
  }
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const hit = detectSqlInjection(v)
      if (hit) return hit
    }
  }
  return null
}

const sqliGuardPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null
  const ipRep = getIpReputationService(redis)

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 路由级开关
    const cfg = request.routeOptions.config?.sqliGuard
    if (cfg?.enabled === false) return

    // 健康检查 / 监控路径跳过
    const path = (request.url.split('?')[0] ?? request.url).toLowerCase()
    if (SKIP_PATHS.has(path)) return

    // 文件上传跳过(已由 upload-scanner 处理)
    if (typeof request.isMultipart === 'function' && request.isMultipart()) return

    // P2 修复(2026-08-06):AI 内容端点跳过关键字检测,仅做强特征检测,
    // 避免用户 prompt 含 "select/union" 等词被误杀。
    // 2026-08-06 二次修复:AI 路径强特征用 SQLI_STRONG_PATTERN_AI(不含 --\s),
    // 否则 Markdown 表格分隔行 "| --- |" 被误判 PG 注释 → 历史含表格的对话全被 400 拦。
    const isAiContentPath = AI_CONTENT_PREFIXES.some((prefix) => path.startsWith(prefix))
    const hit = isAiContentPath
      ? (detectStrongSqli(request.body, SQLI_STRONG_PATTERN_AI) ??
        detectStrongSqli(request.query, SQLI_STRONG_PATTERN_AI) ??
        detectStrongSqli(request.params, SQLI_STRONG_PATTERN_AI))
      : (detectSqlInjection(request.body) ??
        detectSqlInjection(request.query) ??
        detectSqlInjection(request.params))

    if (!hit) return

    const ip = request.ip
    const userId = request.userId
    const requestId = request.id

    logger.warn('sqli-guard: SQL injection pattern detected, blocking request', {
      ip,
      userId,
      requestId,
      path,
      matchedValue: hit,
    })

    // IP 信誉扣分(异步,不阻塞响应)
    ipRep.recordBadEvent(ip, 'sqli-detected').catch(() => {})

    // 通用消息,不泄露检测规则细节
    reply.status(400).send({ code: 400, message: '请求包含不合法字符' })
  })
}

export default fp(sqliGuardPlugin, {
  name: 'sqli-guard-plugin',
  fastify: '5.x',
})
