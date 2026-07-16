import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { logger } from '../utils/logger.js'

/**
 * 金丝雀路由插件：根据请求头 X-Canary-Tag 或用户标识 hash 决定请求路由到金丝雀版本还是稳定版。
 *
 * 配置（env）：
 * - CANARY_ENABLED     是否启用（默认 false，不启用时插件空操作，不影响现有流量）
 * - CANARY_PERCENTAGE  金丝雀流量百分比 0-100（默认 0）
 * - CANARY_VERSION     金丝雀版本标签（默认 "1"）
 *
 * 路由规则：
 * 1. X-Canary-Tag: canary → 强制金丝雀
 * 2. X-Canary-Tag: stable → 强制稳定版
 * 3. 有 Authorization header → 对 token 做 hash，hash % 100 < percentage → 金丝雀（保证同一用户路由一致）
 * 4. 无 Authorization → 对客户端 IP 做 hash（同上）
 *
 * 响应头：
 * - 金丝雀 → X-Served-By: canary-v{version}
 * - 稳定版 → X-Served-By: stable
 */

export interface CanaryRouterOptions {
  enabled?: boolean
  percentage?: number
  version?: string
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0
  }
  return h
}

function getRoutingKey(request: FastifyRequest): string {
  const auth = request.headers.authorization
  if (auth) return auth
  return request.ip
}

function shouldRouteToCanary(
  tag: string | string[] | undefined,
  routingKey: string,
  percentage: number,
): boolean {
  if (tag === 'canary') return true
  if (tag === 'stable') return false
  return hashString(routingKey) % 100 < percentage
}

const canaryRouterInner: FastifyPluginAsync<CanaryRouterOptions> = async (
  server: FastifyInstance,
  opts,
) => {
  const enabled = opts.enabled ?? process.env.CANARY_ENABLED === 'true'
  const percentage = Number(opts.percentage ?? process.env.CANARY_PERCENTAGE ?? 0)
  const version = opts.version ?? process.env.CANARY_VERSION ?? '1'

  if (!enabled || percentage <= 0) {
    logger.info('[canary-router] disabled (CANARY_ENABLED or percentage=0)')
    return
  }

  logger.info('[canary-router] enabled', { percentage, version })

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const tag = request.headers['x-canary-tag']
    const routingKey = getRoutingKey(request)
    const routeToCanary = shouldRouteToCanary(tag, routingKey, percentage)
    reply.header('X-Served-By', routeToCanary ? `canary-v${version}` : 'stable')
  })
}

export default fp(canaryRouterInner, {
  name: 'canary-router',
  fastify: '5.x',
})
