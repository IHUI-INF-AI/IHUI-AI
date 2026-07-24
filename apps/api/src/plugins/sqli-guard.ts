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

        // 扫描 body / query / params
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
