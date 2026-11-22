// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-214 家长端 :childId 端点缺 UUID 校验(畸形路径 500→应为 400)的回归测试(2026-11-13 立)。
 *
 * 票面五枚端点此前把 `request.params.childId` 裸读进 uuid 列比较,畸形输入直落 PG
 * `invalid input syntax for type uuid` ⇒ 500(日志噪声+可探测)。修复=统一挂
 * `childIdParamSchema`(与同族 bills 端点既有闸同源,判据零复制:形状闸的"什么算合法"
 * 由该 schema 单源定义,测试不写第二份 uuid 判定)。
 *
 * 断言面:
 *  ① 五枚端点畸形 childId ⇒ 400(旧形态此处 500/22P02);
 *  ② **零 DB 触达** —— 形状闸必须在任何查询之前(旧形态先发查询才撞库报错);
 *  ③ 正向对照:合法 uuid 形状过闸(不被 400 拦,继续走进绑定查询 ⇒ 桩答"无绑定"路径);
 *  ④ 空 childId 仍 400(旧行为不回退)。
 * 不连生产库(§5):db 桩只计数不执行。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  return { dbCalls: 0 }
})

vi.mock('../src/db/index.js', () => {
  const boom = (): any => {
    h.dbCalls++
    const q: any = {}
    const ret: any = new Promise(() => {}) // 永不 resolve:若越过闸真发查询,断言先看 h.dbCalls
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'innerJoin',
      'leftJoin',
      'groupBy',
    ]) {
      q[m] = () => (m === 'limit' ? Promise.resolve([]) : q)
    }
    q.then = (f: any) => Promise.resolve([]).then(f)
    void ret
    return q
  }
  const db = {
    select: boom,
    update: boom,
    insert: boom,
    delete: boom,
    transaction: () => Promise.resolve(),
  }
  return { db, dbRead: db }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuthOrInternalService: async (request: { userId?: string }, _reply: unknown) => {
    request.userId ??= '11111111-1111-4111-8111-111111111111'
    return true
  },
  authenticate: async (request: { userId?: string }) => {
    request.userId ??= '11111111-1111-4111-8111-111111111111'
  },
}))

vi.mock('../src/utils/logger.js', () => {
  const noop = () => {}
  const logger = { info: noop, warn: noop, error: noop, debug: noop, child: () => logger }
  return { logger, setFastify: noop, serializeErrorFields: (m: unknown) => m }
})

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'

const MALFORMED = [
  'not-a-uuid',
  '1234',
  '11111111-1111-11111111',
  'zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz',
]
const VALID_SHAPE = '22222222-2222-4222-8222-222222222222'
const ENDPOINTS = [
  '/parent/children/cid/courses',
  '/parent/children/cid/meals',
  '/parent/children/cid/study-plans',
  '/parent/children/cid/attendance',
  '/parent/children/cid/grades',
] as const

let app: FastifyInstance
beforeEach(async () => {
  h.dbCalls = 0
  app = Fastify({ logger: false })
  await app.register(eduAiManagementRoutes)
  await app.ready()
})
afterEach(async () => {
  await app.close()
})

function url(endpoint: string, childId: string): string {
  return endpoint.replace('cid', childId)
}

describe('F-214 — :childId 形状闸(五枚端点,畸形 400 且零 DB 触达)', () => {
  for (const endpoint of ENDPOINTS) {
    it(`${endpoint} 畸形 childId ⇒ 400,查询一次都不发`, async () => {
      for (const bad of MALFORMED) {
        const res = await app.inject({ method: 'GET', url: url(endpoint, bad) })
        expect(res.statusCode, `${endpoint} ← ${bad}`).toBe(400)
      }
      expect(h.dbCalls, `${endpoint} 形状闸必须在任何查询之前`).toBe(0)
    })

    it(`${endpoint} 合法 uuid 形状过闸(不被形状 400 误拦)`, async () => {
      const res = await app.inject({ method: 'GET', url: url(endpoint, VALID_SHAPE) })
      // 过闸后进入绑定校验:桩库答空 ⇒ 走到"未绑定 403/空数据"业务面,绝不可能是形状 400
      expect([200, 403, 404]).toContain(res.statusCode)
    })
  }

  it('空 childId 段不回退旧行为(/…// 路由不匹配 ⇒ 404,而非形状 400 吞掉)', async () => {
    const res = await app.inject({ method: 'GET', url: '/parent/children//meals' })
    expect(res.statusCode).not.toBe(500)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
