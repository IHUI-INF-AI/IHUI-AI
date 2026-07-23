import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { otherRoutes as frontendStubOtherRoutes } from '../src/routes/other/index.js'

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

const VALID_FILE_ID_A = '00000000-0000-0000-0000-000000000aaa'
const VALID_FILE_ID_B = '00000000-0000-0000-0000-000000000bbb'

describe('pdf-service routes — /api/pdf-service/*', () => {
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

  it('未登录 POST /pdf-service/merge 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [VALID_FILE_ID_A, VALID_FILE_ID_B] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /pdf-service/merge → 201 + taskId + fileCount', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [VALID_FILE_ID_A, VALID_FILE_ID_B] },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.taskId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.data.operation).toBe('merge')
    expect(body.data.status).toBe('pending')
    expect(body.data.fileCount).toBe(2)
  })

  it('POST /pdf-service/merge fileIds 不足 2 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/merge`,
      payload: { fileIds: [VALID_FILE_ID_A] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /pdf-service/split → 201 + ranges 透传', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/split`,
      payload: { fileId: VALID_FILE_ID_A, ranges: '1-3,5,7-9' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('split')
    expect(body.data.ranges).toBe('1-3,5,7-9')
  })

  it('POST /pdf-service/split ranges 非法 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/split`,
      payload: { fileId: VALID_FILE_ID_A, ranges: 'abc' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /pdf-service/print → 201 + operation:print', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/print`,
      payload: { fileId: VALID_FILE_ID_A },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('print')
  })

  it('POST /pdf-service/sign → 201 + operation:sign', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/sign`,
      payload: { fileId: VALID_FILE_ID_A, signature: 'data:image/png;base64,iVBOR...' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('sign')
  })

  it('POST /pdf-service/watermark → 201 + operation:watermark', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/watermark`,
      payload: { fileId: VALID_FILE_ID_A },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.operation).toBe('watermark')
  })

  it('POST /pdf-service/print fileId 非法 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/pdf-service/print`,
      payload: { fileId: 'not-a-uuid' },
    })
    expect(res.statusCode).toBe(400)
  })
})
