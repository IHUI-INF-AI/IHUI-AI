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
 * - AI 内容端点(/api/ai/、/api/llm/、/api/chat/ 等,见 AI_CONTENT_PREFIXES):
 *   自由文本无 SQL 注入面,完全跳过(2026-08-06 根治)
 *
 * 设计为防御纵深:xss-protection(onRequest)先做 HTML 实体编码,本插件(preHandler)
 * 再做 SQL 注入检测,两层独立工作互不依赖。
 */

import type {
    FastifyInstance,
    FastifyPluginAsync,
    FastifyRequest,
    FastifyReply,
} from 'fastify'
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
 * AI 内容端点前缀白名单(2026-08-06 根治:完全跳过 sqli-guard 检测)。
 *
 * 背景:本插件对 AI 对话路径做过两轮"豁免但仍检测强特征"的折中修复,
 * 均被误杀打回 ——
 *  1. `#` 单字符当 SQL 注释符,误杀用户消息 "#1"(400 拦截 → 无限重连)
 *  2. `--\s` 当 PG 注释,误杀 Markdown 表格分隔行 "| --- |",
 *     历史一旦含表格,之后所有对话(携带完整历史)都被 400 拦截
 * 结论:AI 端点 body 是自由文本(用户 prompt + 对话历史),最终交给 LLM
 * 或参数化入库(chat_messages),**不拼 SQL,无注入面**。对其做任何
 * 关键字/注释符检测都是误杀源。
 *
 * 设计决策:命中以下路径前缀的请求**完全跳过**本插件的所有检测。
 * SQL 注入防护能力不受影响:非 AI 端点(查询参数/表单字段等拼 SQL 场景)
 * 仍走完整检测(SQLI_STRONG_PATTERN + InputValidator.checkSqlInjection);
 * 数据库层 Drizzle/postgres-js 参数化查询是注入防护的根基。
 * 路径按前缀匹配(小写)。
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
]

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

        // 2026-08-06 根治:AI 内容端点完全跳过 sqli-guard —— 自由文本(body 为
        // prompt + 对话历史)交给 LLM / 参数化入库,不拼 SQL 无注入面。
        // 曾做两轮"豁免但仍检测强特征"均被误杀(#1、Markdown 表格 | --- |),
        // 直接跳过是唯一不会误伤的方案,详见 AI_CONTENT_PREFIXES 注释。
        if (AI_CONTENT_PREFIXES.some((prefix) => path.startsWith(prefix))) return

        const hit =
            detectSqlInjection(request.body) ??
            detectSqlInjection(request.query) ??
            detectSqlInjection(request.params)

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
