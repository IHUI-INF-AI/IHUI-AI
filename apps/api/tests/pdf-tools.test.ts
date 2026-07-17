import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { frontendStubOtherRoutes } from '../src/routes/frontend-stub-other-routes.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const PREFIX = '/api'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('pdf-tools routes — /api/tools/pdf/*', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockAuthenticate.mockReset()
  })

  it('未登录 GET /tools/pdf/convert 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/tools/pdf/convert` })
    expect(res.statusCode).toBe(401)
  })

  it('GET /tools/pdf/convert → 200 + operation:convert + endpoint 元数据', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/tools/pdf/convert` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('convert')
    expect(body.data.status).toBe('available')
    expect(body.data.endpoint).toBe('/pdf-service/convert (POST)')
  })

  it('GET /tools/pdf/merge → 200 + operation:merge', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/tools/pdf/merge` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('merge')
  })

  it('GET /tools/pdf/split → 200 + operation:split', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/tools/pdf/split` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('split')
  })

  it('GET /tools/pdf/watermark → 200 + operation:watermark', async () => {
    mockAuthed()
    const res = await server.inject({ method: 'GET', url: `${PREFIX}/tools/pdf/watermark` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('watermark')
  })

  it('GET /tools/pdf/convert?fileId=invalid → 400 (Zod 校验失败)', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/tools/pdf/convert?fileId=not-a-uuid`,
    })
    expect(res.statusCode).toBe(400)
  })
})
