// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上下文/记忆族:归属只认令牌主体(2026-11-01 安全强化)。
 *
 * 立因:`apps/api/src/routes/context-mentions.ts` 有四格写成
 * `userId || request.userId` —— 左半边来自**请求体/查询串**,是客户端可整写的字段。
 * 于是"认证过了"被当成"归属成立":填别人的 uuid 就能读他人的会话记忆(含压缩 summary 与
 * 长期偏好)、读他人压缩统计/可视化、并把检索结果写进他人的上下文桶。这正是 AGENTS §5
 * 「身份不得住客户端可整写字段」「承载层必须显式入参传入令牌主体」两条禁令的形状。
 *
 * 请求形状**未动**(schema 仍接受 userId 字段,老客户端不炸),但那个值不再参与归属。
 * 每组都配正向对照(令牌主体确实传给了服务层),否则"整片写死空串"也能骗过越权断言。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ROUTE_FILE = 'apps/api/src/routes/context-mentions.ts'

const { calls, mockAuthenticate } = vi.hoisted(() => ({
  calls: [] as Array<[string, unknown]>,
  mockAuthenticate: vi.fn(),
}))

function rec(name: string, ret: unknown = { ok: true }) {
  return (...args: unknown[]) => {
    calls.push([name, args])
    return Promise.resolve(ret)
  }
}

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mockAuthenticate }))
vi.mock('../src/services/context-engine-service.js', () => ({
  contextEngineService: {
    search: rec('search'),
    enrich: rec('enrich'),
    getVisualization: rec('getVisualization'),
    getCompressionStats: rec('getCompressionStats'),
    getSessionMemory: rec('getSessionMemory'),
    getSources: rec('getSources'),
    updateSources: rec('updateSources'),
    clearSessionMemory: rec('clearSessionMemory'),
  },
}))

import { contextMentionRoutes } from '../src/routes/context-mentions.js'

const OWNER = 'u-owner'
const VICTIM = 'u-victim-00000000'

async function build(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(contextMentionRoutes, { prefix: '/api/context' })
  await app.ready()
  return app
}

function argsOf(name: string): unknown[] {
  const hit = calls.find((c) => c[0] === name)
  if (!hit) throw new Error(`服务层没被问过:${name}`)
  return hit[1] as unknown[]
}

describe('上下文/记忆族的身份来源', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    calls.length = 0
    mockAuthenticate.mockReset()
    mockAuthenticate.mockImplementation(
      async (request: { userId?: string; jwtPayload?: object }) => {
        request.userId = OWNER
        request.jwtPayload = { userId: OWNER, roleId: 0 }
      },
    )
    app = await build()
  })

  it('GET /memory 带别人的 userId:服务层拿到的是令牌主体', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/context/memory?conversationId=c-1&userId=${VICTIM}`,
    })
    expect(res.statusCode).toBe(200)
    expect(argsOf('getSessionMemory')).toEqual(['c-1', OWNER])
  })

  it('GET /compression-stats 带别人的 userId:同上', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/context/compression-stats?userId=${VICTIM}`,
    })
    expect(res.statusCode).toBe(200)
    expect(argsOf('getCompressionStats')).toEqual([OWNER])
  })

  it('GET /visualization 带别人的 userId:同上', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/context/visualization?conversationId=c-1&userId=${VICTIM}`,
    })
    expect(res.statusCode).toBe(200)
    expect(argsOf('getVisualization')).toEqual(['c-1', OWNER])
  })

  it('POST /enrich 请求体里的 userId 不参与归属', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/context/enrich',
      payload: {
        userMessage: 'hi',
        conversationId: 'c-1',
        mentions: [],
        messages: [],
        userId: VICTIM,
      },
    })
    expect(res.statusCode).toBe(200)
    const arg = argsOf('enrich')[0] as { userId?: string }
    expect(arg.userId).toBe(OWNER)
  })

  it('未鉴权:四格一律不到服务层(失效方向是拒,不是回落到空身份)', async () => {
    const err = new Error('no token') as Error & { statusCode?: number }
    err.statusCode = 401
    mockAuthenticate.mockRejectedValue(err)
    for (const url of [
      '/api/context/memory',
      '/api/context/compression-stats',
      '/api/context/visualization',
    ]) {
      calls.length = 0
      const res = await app.inject({ method: 'GET', url: `${url}?conversationId=c-1` })
      expect(res.statusCode, url).toBe(401)
      expect(calls, `${url} 未鉴权不得问服务层`).toEqual([])
    }
  })

  it('接线锁:源码里不得再出现 `x.userId || request.userId` 的归属写法', () => {
    const code = readFileSync(join(ROOT, ROUTE_FILE), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')
    expect(code).not.toMatch(/userId \|\| request\.userId/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
