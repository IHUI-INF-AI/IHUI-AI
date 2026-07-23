import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockValues } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockValues: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('../src/db/index.js', () => ({
  db: { insert: () => ({ values: mockValues }) },
  dbRead: { insert: () => ({ values: mockValues }) },
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

describe('oss-resource routes — /api/oss/resource/file', () => {
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
    mockValues.mockClear()
  })

  it('未登录 POST /oss/resource/file 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/oss/resource/file`,
      payload: { fileName: 'a.png', totalChunks: 1 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('已登录 POST /oss/resource/file → 201 + uploadId + 三件套 URL', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/oss/resource/file`,
      payload: {
        fileName: 'photo.png',
        fileSize: 1024,
        totalChunks: 2,
        fileMd5: 'abc123',
        mimeType: 'image/png',
        chunkSize: 5 * 1024 * 1024,
      },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.uploadId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.data.uploadUrl).toBe('/api/chunked-upload/chunk')
    expect(body.data.mergeUrl).toBe('/api/chunked-upload/merge')
    expect(body.data.statusUrl).toBe('/api/chunked-upload/status')
    expect(body.data.totalChunks).toBe(2)
    expect(body.data.chunkSize).toBe(5 * 1024 * 1024)
    expect(mockValues).toHaveBeenCalledOnce()
  })

  it('POST /oss/resource/file 缺 fileName → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/oss/resource/file`,
      payload: { totalChunks: 1 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /oss/resource/file totalChunks=0 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/oss/resource/file`,
      payload: { fileName: 'a.png', totalChunks: 0 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /oss/resource/file fileName 超 255 字符 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/oss/resource/file`,
      payload: { fileName: 'a'.repeat(256), totalChunks: 1 },
    })
    expect(res.statusCode).toBe(400)
  })
})
