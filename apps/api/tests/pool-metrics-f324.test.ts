// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-324 夹具:连接池 usage 指标不允许"不可采样还报 0"。
 *
 * 改前(红):
 * - postgres.js 3.4.9 的 sql 对象没有 state;旧采样器 continue → 池 40/40 打满仍报
 *   db_pool_in_use 0,checkedout 永空;
 * - 没有"指标不可用"状态位,面板无法区分"0 连接"与"采样坏了"。
 *
 * 改后(绿):
 * - 无 state → available=false,size 仍可读(options.max),usage 三项**不输出**,
 *   /metrics 只暴露 db_pool_metrics_available 0;
 * - 有真实 state → 上报真实 in_use/checkedout,available 1。
 *
 * 为什么不是 NaN:Grafana 面板 `100 * db_pool_in_use / clamp_min(db_pool_size,1)`
 * 会把 NaN 一路传播成 NaN 面板;多实例 avg 聚合也会被单个 NaN 整条污染。故不可用时
 * 直接省略 usage 序列,由 available 状态位承担「采样坏了」的表达。
 *
 * 零真实 DB:用形状对象模拟 postgres.js 的公开面。
 */
import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import {
  reportPoolMetricsToSink,
  samplePostgresPoolMetrics,
} from '../src/utils/pool-metrics.js'
import { metricsPlugin } from '../src/plugins/metrics.js'

/** postgres.js 3.4.9 的真实公开面:只有 options(含 max),没有 state */
function postgres349Like() {
  return { options: { max: 40 } }
}

/** 池打满:max=40,active=40,idle=0 */
function saturatedPoolLike() {
  const conns = Array.from({ length: 40 }, (_, i) => ({ id: i }))
  return {
    options: { max: 40 },
    state: { connections: conns, idle: [] as object[], active: conns },
  }
}

async function scrapeMetrics(setup: (server: Fastify) => void): Promise<string> {
  const server = Fastify({ logger: false })
  await server.register(metricsPlugin)
  setup(server)
  const res = await server.inject({ method: 'GET', url: '/metrics' })
  await server.close()
  expect(res.statusCode).toBe(200)
  return res.body
}

describe('F-324 连接池指标显式可用性', () => {
  it('postgres.js 3.4.9 无 state → 显式不可用,size 仍可读,绝不返回伪造的 0', () => {
    const sample = samplePostgresPoolMetrics(postgres349Like())
    expect(sample.available).toBe(false)
    expect(sample.size).toBe(40)
    if (!sample.available) expect(sample.reason).toContain('state')
    expect(sample).not.toMatchObject({ inUse: 0 })
  })

  it('池打满 40/40 且内部状态可得 → 报真实 in_use=40,checkedout=40', () => {
    const sample = samplePostgresPoolMetrics(saturatedPoolLike())
    expect(sample).toMatchObject({
      available: true,
      size: 40,
      inUse: 40,
      checkedOut: 40,
    })
  })

  it('reportDbPoolMetrics:不可采样只报 available=false + size,不写 usage 数值', () => {
    const calls: Array<Record<string, unknown>> = []
    const sample = reportPoolMetricsToSink((opts) => calls.push(opts), postgres349Like())
    expect(sample.available).toBe(false)
    expect(calls).toEqual([{ available: false, size: 40 }])
    expect(calls[0]).not.toHaveProperty('inUse')
  })

  it('/metrics:不可采样 → 只留 db_pool_metrics_available 0,不输出 usage 序列', async () => {
    const body = await scrapeMetrics((server) => {
      server.setDbPoolMetrics({ available: false, size: 40 })
    })
    expect(body).toContain('db_pool_metrics_available 0')
    expect(body).not.toMatch(/db_pool_in_use/)
    expect(body).not.toMatch(/db_pool_checkedout/)
    expect(body).not.toMatch(/db_pool_overflow/)
    expect(body).toContain('db_pool_size 40')
    // 整条 /metrics 不得出现 NaN/Inf 字面量(否则消费端聚合会被污染)
    expect(body).not.toMatch(/\bNaN\b/)
  })

  it('/metrics:可采样 → available 1,真实 in_use/checkedout', async () => {
    const body = await scrapeMetrics((server) => {
      const sample = reportPoolMetricsToSink(
        (opts) => server.setDbPoolMetrics(opts),
        saturatedPoolLike(),
      )
      expect(sample.available).toBe(true)
    })
    expect(body).toContain('db_pool_metrics_available 1')
    expect(body).toContain('db_pool_in_use 40')
    expect(body).toContain('db_pool_checkedout 40')
    expect(body).not.toMatch(/db_pool_in_use NaN/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
