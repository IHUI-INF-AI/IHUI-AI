// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-605 回归夹具:异常检测必须在路由 authenticate 之后评估。
 *
 * 原实现挂全局 onRequest,request.userId 恒为 undefined —— 时间/地理/设备/基线
 * 四个用户维度全部短路。改为 onRoute 把钩子追加到每条路由 preHandler 末尾,
 * 这里用一个「handler 之前才写 userId」的路由验证检测器确实看到了身份。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyRequest } from 'fastify'

const detect = vi.hoisted(() => ({
  result: {
    score: 0,
    recommendation: 'allow',
    reasons: [] as string[],
    dimensions: [] as unknown[],
  },
  calls: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../services/anomaly-detector.js', () => ({
  getAnomalyDetector: () => ({
    detectAnomaly: async (ctx: Record<string, unknown>) => {
      detect.calls.push(ctx)
      return detect.result
    },
  }),
}))

vi.mock('../../services/ip-reputation.js', () => ({
  isPrivateIp: () => false,
}))

import anomalyDetectorPlugin from '../anomaly-detector-plugin.js'

describe('F-605 异常检测身份上下文', () => {
  beforeEach(() => {
    detect.calls.length = 0
    detect.result = { score: 0, recommendation: 'allow', reasons: [], dimensions: [] }
  })

  it('钩子排在 authenticate 之后:检测器拿到真实 userId', async () => {
    const app = Fastify({ logger: false })
    app.decorateRequest('anomalyScore', 0)
    app.decorateRequest('anomalyReasons', [] as string[])
    await app.register(anomalyDetectorPlugin)
    app.get(
      '/api/protected',
      {
        preHandler: [
          async (request: FastifyRequest) => {
            ;(request as unknown as { userId?: string }).userId = 'user-605'
          },
        ],
      },
      async () => ({ ok: true }),
    )
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/api/protected' })
    expect(res.statusCode, res.body).toBe(200)
    expect(detect.calls).toHaveLength(1)
    expect(detect.calls[0]!.userId).toBe('user-605')
    await app.close()
  })

  it('challenge 仍能在 handler 前 403 阻断', async () => {
    detect.result = { score: 70, recommendation: 'challenge', reasons: ['geo'], dimensions: [] }
    const app = Fastify({ logger: false })
    app.decorateRequest('anomalyScore', 0)
    app.decorateRequest('anomalyReasons', [] as string[])
    await app.register(anomalyDetectorPlugin)
    let handlerRuns = 0
    app.get(
      '/api/protected',
      {
        preHandler: [
          async (request: FastifyRequest) => {
            ;(request as unknown as { userId?: string }).userId = 'user-605'
          },
        ],
      },
      async () => {
        handlerRuns++
        return { ok: true }
      },
    )
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/api/protected' })
    expect(res.statusCode).toBe(403)
    expect(handlerRuns).toBe(0)
    expect(detect.calls[0]!.userId).toBe('user-605')
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
