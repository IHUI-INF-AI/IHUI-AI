// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 埋点写入的身份降级取证(2026-10-26 立)。
 *
 * 立因(生产实测):`/admin/*` 页面带着一个已不存在的用户 id 上报,insert 撞
 * `visit_logs_user_id_fkey` ⇒ 500 ⇒ **整条访问丢失**,而前端埋点失败静默 ——
 * 表现就是「明明有人用,大屏却一个数都没有」。
 *
 * 三条断言:
 * 1. 外键违约 ⇒ 降级为匿名(user_id=null)重插,请求仍 200;
 * 2. 其它写库错误 ⇒ 照抛(不能把真故障藏成"匿名成功");
 * 3. 无 userId 时不多打一次 insert。
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const h = vi.hoisted(() => {
  const state = {
    calls: [] as Array<Record<string, unknown>>,
    failMode: 'none' as 'none' | 'fk' | 'other',
  }
  const db = {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.calls.push(values)
        const first = state.calls.length === 1
        const shouldFail = first && state.failMode !== 'none'
        return {
          returning: () => {
            if (!shouldFail) return Promise.resolve([{ id: 'row', ...values }])
            if (state.failMode === 'fk') {
              return Promise.reject(
                Object.assign(new Error('fk violation'), {
                  cause: { code: '23503', constraint: 'visit_logs_user_id_fkey' },
                }),
              )
            }
            return Promise.reject(
              Object.assign(new Error('connection failure'), { cause: { code: '08006' } }),
            )
          },
        }
      },
    }),
  }
  return { state, db }
})

vi.mock('../src/db/index.js', () => ({ db: h.db, dbRead: h.db }))

// 公开埋点端点不经过鉴权;但模块顶层 import 了 requireAdmin(供管理员路由用)⇒ 该链会拉进
// packages/auth。这里把它 mock 掉:本用例与鉴权无关,也避免被并发会话的 shared 包半截落地绊倒。
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => undefined }))

import { visitTrackingRoutes } from '../src/routes/visit-tracking'

const USER_ID = '00000000-0000-4000-8000-000000000001'

let server: FastifyInstance

beforeAll(async () => {
  server = Fastify({ logger: false })
  await server.register(visitTrackingRoutes, { prefix: '/api' })
  await server.ready()
})

beforeEach(() => {
  h.state.calls.length = 0
  h.state.failMode = 'none'
})

function postVisit(userId?: string) {
  return server.inject({
    method: 'POST',
    url: '/api/visit-tracking/visit-log',
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (test)' },
    payload: { url: '/admin/monitor/wallboard', sessionId: 'sid-1', ...(userId ? { userId } : {}) },
  })
}

describe('saveVisitLog 身份降级', () => {
  it('外键违约 ⇒ 匿名重插,请求仍 200', async () => {
    h.state.failMode = 'fk'
    const res = await postVisit(USER_ID)
    expect(res.statusCode).toBe(200)
    expect(h.state.calls).toHaveLength(2)
    expect(h.state.calls[0]?.userId).toBe(USER_ID)
    expect(h.state.calls[1]?.userId).toBeNull()
    // 降级那一条仍保留页面事实
    expect(h.state.calls[1]?.url).toBe('/admin/monitor/wallboard')
    expect(h.state.calls[1]?.sessionId).toBe('sid-1')
  })

  it('其它写库错误照抛(不把真故障藏成匿名成功)', async () => {
    h.state.failMode = 'other'
    const res = await postVisit(USER_ID)
    expect(res.statusCode).toBeGreaterThanOrEqual(500)
    expect(h.state.calls).toHaveLength(1)
  })

  it('无 userId 时不多打一次 insert', async () => {
    const res = await postVisit()
    expect(res.statusCode).toBe(200)
    expect(h.state.calls).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
