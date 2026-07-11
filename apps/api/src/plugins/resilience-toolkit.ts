/**
 * 韧性工具集插件：将补建的关键基础设施工具统一注册为 Fastify 装饰器。
 *
 * 注册的装饰器：
 * - server.distributedLock  分布式锁 (bug188)，依赖 Redis
 * - server.refundDlq        退款失败 DLQ，依赖 Redis
 * - server.riskEngine       风控规则引擎 (Bug-127)，复用单例
 * - server.hotConfig        热配置中心 (bug183)，复用单例
 * - server.dlq              通用死信队列 (bug165)，复用单例
 * - server.tenantAuditor    租户隔离审计，复用单例
 *
 * Redis 不可用时，distributedLock / refundDlq 的方法调用会抛错，
 * 调用方需 try-catch 降级（与 redis plugin 的连接失败降级策略一致）。
 */
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

import { DistributedLock } from '../utils/distributed-lock.js'
import { RefundDlq } from '../utils/refund-dlq.js'
import { getDefaultRiskEngine, type RiskRuleEngine } from '../services/risk-engine-service.js'
import { hotConfig, type HotConfigCenter } from '../utils/hot-config.js'
import { deadLetterQueue, type DeadLetterQueue } from '../utils/dead-letter-queue.js'
import { tenantAuditor, type TenantAuditor } from '../utils/tenant-audit.js'

declare module 'fastify' {
  interface FastifyInstance {
    distributedLock: DistributedLock
    riskEngine: RiskRuleEngine
    hotConfig: HotConfigCenter
    dlq: DeadLetterQueue
    refundDlq: RefundDlq
    tenantAuditor: TenantAuditor
  }
}

const resilienceToolkitPlugin: FastifyPluginAsync = async (server) => {
  // 依赖 Redis 的工具：redis plugin 已注册 server.redis 装饰器
  server.decorate('distributedLock', new DistributedLock(server.redis))
  server.decorate('refundDlq', new RefundDlq(server.redis))

  // 复用模块级单例，避免多实例状态分裂
  server.decorate('riskEngine', getDefaultRiskEngine())
  server.decorate('hotConfig', hotConfig)
  server.decorate('dlq', deadLetterQueue)
  server.decorate('tenantAuditor', tenantAuditor)
}

export const resilienceToolkit = fp(resilienceToolkitPlugin, {
  name: 'resilience-toolkit',
  fastify: '5.x',
  dependencies: ['redis'],
})
