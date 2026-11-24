// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 探活别名族 —— 端点行为测试(轻量 Fastify,零依赖、不出网)。
 *
 * 2026-11-17 立(对标 qoder2api-hub 的 `/ping /healthz /livez /readyz`)。
 * 钉住三件事:
 *   L1 四个别名全部 200,body 恰为约定的纯文本(pong/ok)。
 *   L2 readyz 的 X-Ready-Scope=liveness-only(不冒充「依赖全通」)。
 *   L3 全组不查依赖:注册实例没有任何 DB/Redis 调用(靠零 mock 也能跑通证明)。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

import { livenessRoutes, LIVENESS_ALIASES } from '../src/routes/liveness.js'

describe('探活别名族', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(livenessRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('L1 四个别名全部 200 且 body 为约定纯文本', async () => {
    for (const alias of LIVENESS_ALIASES) {
      const res = await app.inject({ method: 'GET', url: alias.path })
      expect(res.statusCode).toBe(200)
      expect(res.body).toBe(alias.text)
      expect(res.headers['content-type']).toContain('text/plain')
    }
  })

  it('/ping 恰为 pong(不返回 JSON)', async () => {
    const res = await app.inject({ method: 'GET', url: '/ping' })
    expect(res.body).toBe('pong')
    expect(() => JSON.parse(res.body)).toThrow()
  })

  it('L2 readyz 头 X-Ready-Scope=liveness-only;其余为 liveness', async () => {
    for (const alias of LIVENESS_ALIASES) {
      const res = await app.inject({ method: 'GET', url: alias.path })
      expect(res.headers['x-ready-scope']).toBe(alias.scope)
      expect(res.headers['cache-control']).toBe('no-store')
    }
  })

  it('L3 别名清单恰为四个(新增别名必须同笔更新清单与白名单)', () => {
    expect(LIVENESS_ALIASES.map((a) => a.path)).toEqual(['/ping', '/healthz', '/livez', '/readyz'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
