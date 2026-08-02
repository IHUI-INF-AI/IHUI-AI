/**
 * 异常行为检测插件(国安级风控核心)。
 *
 * 与 threat-detector 互补:
 * - threat-detector:基于 IP 信誉评分(reactive,事件累积触发封禁)
 * - anomaly-detector:基于 6 维度行为评分(proactive,实时分析)
 *
 * 6 维度(详见 services/anomaly-detector.ts):
 * 1. 请求频率(同 IP/用户 1 分钟 > 60 次)
 * 2. 时间分布(凌晨密集 + 历史不活跃)
 * 3. 地理位置(5 分钟跨网段)
 * 4. 设备指纹突变(1 小时 ≥3 新设备)
 * 5. 请求模式(扫描器路径)
 * 6. 行为基线(+3σ)
 *
 * recommendation 处理:
 * - allow(<30):放行不记日志
 * - monitor(30-60):放行 + server.log.info 记录原因
 * - challenge(60-80):403 + 提示需 CAPTCHA(暂 403 阻断,P1 再接 CAPTCHA 页面)
 * - block(>80):403 拒绝
 *
 * fail-open:detectAnomaly 抛错时放行,不阻塞业务(与 threat-detector 同模式)
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import type { Redis } from 'ioredis'
import { getAnomalyDetector, type AnomalyResult } from '../services/anomaly-detector.js'
import { isPrivateIp } from '../services/ip-reputation.js'

/** 健康检查 / 监控路径白名单(避免监控系统高频探活被误判) */
const SKIP_PATHS = new Set(['/api/health', '/api/healthz', '/health'])

/** 静态资源前缀(不检测异常行为) */
const SKIP_PREFIXES = ['/uploads/', '/static/']

declare module 'fastify' {
  interface FastifyRequest {
    /** 异常行为评分(0-100),供下游 audit-logger 记录 */
    anomalyScore?: number
    /** 命中的异常维度(score>0 的 dimensions,格式 name:score),供下游 audit-logger 记录 */
    anomalyReasons?: string[]
  }
}

/** 把 header 值(string | string[] | undefined)归一化为 string | undefined */
function pickHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/** 从 AnomalyResult.dimensions 派生命中的维度名(name:score 格式) */
function extractReasons(result: AnomalyResult): string[] {
  return result.dimensions.filter((d) => d.score > 0).map((d) => `${d.name}:${d.score}`)
}

const anomalyDetectorPluginRaw: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null
  const detector = getAnomalyDetector(redis)

  server.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = (request.url.split('?')[0] ?? request.url).toLowerCase()
    if (SKIP_PATHS.has(path)) return
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return

    const ip = request.ip
    if (!ip) return
    // 内网跳过(开发环境友好,与 threat-detector 同模式)
    if (isPrivateIp(ip)) return

    // 提取请求上下文(userId 由 authPlugin 装饰,onRequest 阶段未登录时为 undefined)
    const userId = request.userId
    const userAgent = pickHeader(request.headers['user-agent'])
    const deviceFingerprint = pickHeader(request.headers['x-device-fingerprint'])

    let result: AnomalyResult
    try {
      result = await detector.detectAnomaly({
        ip,
        userId,
        userAgent,
        url: request.url,
        method: request.method,
        deviceFingerprint,
        timestamp: Date.now(),
      })
    } catch (err) {
      // fail-open:评分失败放行,不阻塞业务
      server.log.error({ err }, 'anomaly-detector: detectAnomaly failed (fail-open)')
      return
    }

    // 挂到 request 上,供下游 audit-logger 记录
    request.anomalyScore = result.score
    request.anomalyReasons = extractReasons(result)

    switch (result.recommendation) {
      case 'allow':
        // 放行不记日志(避免噪音)
        return
      case 'monitor':
        // 放行 + info 日志(便于事后分析)
        server.log.info(
          {
            ip,
            userId,
            path,
            method: request.method,
            score: result.score,
            reasons: request.anomalyReasons,
          },
          'anomaly-detector: suspicious behavior (monitor)',
        )
        return
      case 'challenge':
        // 暂用 403 阻断,P1 再接 CAPTCHA 挑战页面
        reply.status(403).send({
          code: -1,
          message: '请求异常,需完成人机验证',
          data: { challenge: 'captcha', reasons: request.anomalyReasons },
        })
        return
      case 'block':
        reply.status(403).send({
          code: -1,
          message: '请求被拒绝',
          data: { reasons: request.anomalyReasons },
        })
        return
    }
  })
}

export const anomalyDetectorPlugin = fp(anomalyDetectorPluginRaw, {
  name: 'anomaly-detector',
  fastify: '5.x',
})

export default anomalyDetectorPlugin
