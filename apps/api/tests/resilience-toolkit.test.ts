/**
 * resilience-toolkit 插件集成测试。
 *
 * 验证 server.register(resilienceToolkit) 后 6 个 decorate 是否全部就绪：
 * - server.distributedLock (bug188)
 * - server.refundDlq
 * - server.riskEngine (Bug-127)
 * - server.hotConfig (bug183)
 * - server.dlq (bug165)
 * - server.tenantAuditor
 */
import { describe, it, expect, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { resilienceToolkit } from '../src/plugins/resilience-toolkit.js'
import { hotConfig } from '../src/utils/hot-config.js'
import { deadLetterQueue } from '../src/utils/dead-letter-queue.js'
import { tenantAuditor } from '../src/utils/tenant-audit.js'
import { getDefaultRiskEngine } from '../src/services/risk-engine-service.js'

type MockRedis = Record<string, ReturnType<typeof vi.fn>>

function makeMockRedis(): MockRedis {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    eval: vi.fn().mockResolvedValue(1),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    hset: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    zadd: vi.fn().mockResolvedValue(1),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zcard: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
  }
}

/** 替代真实 redis plugin 的 fake — 必须以 name='redis' 注册才能被 resilienceToolkit 识别为依赖。 */
const fakeRedisPlugin = fp(
  async (s) => {
    s.decorate('redis', makeMockRedis())
  },
  { name: 'redis', fastify: '5.x' },
)

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(fakeRedisPlugin)
  await server.register(resilienceToolkit)
  await server.ready()
  return server
}

describe('resilienceToolkit 插件 — 6 个 decorate', () => {
  it('distributedLock 已注册', async () => {
    const server = await buildServer()
    expect(server.distributedLock).toBeDefined()
    expect(typeof server.distributedLock.tryLock).toBe('function')
    expect(typeof server.distributedLock.acquire).toBe('function')
    await server.close()
  })

  it('refundDlq 已注册', async () => {
    const server = await buildServer()
    expect(server.refundDlq).toBeDefined()
    expect(typeof server.refundDlq.recordRefundFailure).toBe('function')
    expect(typeof server.refundDlq.performAction).toBe('function')
    await server.close()
  })

  it('riskEngine 已注册', async () => {
    const server = await buildServer()
    expect(server.riskEngine).toBeDefined()
    expect(typeof server.riskEngine.evaluateRisk).toBe('function')
    expect(typeof server.riskEngine.listRules).toBe('function')
    await server.close()
  })

  it('hotConfig 已注册', async () => {
    const server = await buildServer()
    expect(server.hotConfig).toBeDefined()
    expect(typeof server.hotConfig.get).toBe('function')
    expect(typeof server.hotConfig.set).toBe('function')
    await server.close()
  })

  it('dlq 已注册', async () => {
    const server = await buildServer()
    expect(server.dlq).toBeDefined()
    expect(typeof server.dlq.push).toBe('function')
    expect(typeof server.dlq.replay).toBe('function')
    await server.close()
  })

  it('tenantAuditor 已注册', async () => {
    const server = await buildServer()
    expect(server.tenantAuditor).toBeDefined()
    expect(typeof server.tenantAuditor.check).toBe('function')
    expect(typeof server.tenantAuditor.stats).toBe('function')
    await server.close()
  })
})

describe('resilienceToolkit 插件 — 单例身份', () => {
  it('复用模块级单例 (hotConfig/dlq/tenantAuditor/riskEngine)', async () => {
    const server = await buildServer()
    expect(server.hotConfig).toBe(hotConfig)
    expect(server.dlq).toBe(deadLetterQueue)
    expect(server.tenantAuditor).toBe(tenantAuditor)
    expect(server.riskEngine).toBe(getDefaultRiskEngine())
    await server.close()
  })
})
