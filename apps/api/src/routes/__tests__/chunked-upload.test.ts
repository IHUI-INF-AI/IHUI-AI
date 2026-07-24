import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { rmSync } from 'node:fs'

const TEST_UPLOAD_DIR = `${process.env.TEMP || process.env.TMP || '/tmp'}/ihui-test-uploads`

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.UPLOAD_DIR = `${process.env.TEMP || process.env.TMP || '/tmp'}/ihui-test-uploads`
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi
    .fn()
    .mockResolvedValue({
      userId: 'mock-user-id',
      phone: '13800000000',
      familyId: '11111111-1111-1111-1111-111111111111',
      roleId: 1,
    }),
}))

// 修复(2026-07-24):authenticate 内部调用 jose.decodeJwt(token) 检查 challenge token,
// 'mock-admin-token' 非有效 JWT 会抛异常 → 401。mock decodeJwt 返回非 challenge payload 绕过。
vi.mock('jose', () => ({
  decodeJwt: vi.fn(() => ({ type: 'access' })),
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
    onConflictDoUpdate: () => DbChain
    onConflictDoNothing: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
      onConflictDoUpdate: () => chain,
      onConflictDoNothing: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { chunkedUploadRoutes } from '../chunked-upload.js'
import { verifyAccessToken } from '@ihui/auth'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }

describe('Chunked Upload API', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(chunkedUploadRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    try {
      rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('Route registration', () => {
    it('should register the route plugin without throwing', () => {
      expect(app).toBeDefined()
    })
  })

  describe('401 未授权', () => {
    it('POST /api/chunked-upload/init 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/init',
        body: { fileName: 'test.txt', totalChunks: 3 },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/chunked-upload/upload 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/upload',
        headers: { 'content-type': 'application/octet-stream' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('POST /api/chunked-upload/merge 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/merge',
        body: { uploadId: 'test-upload-id' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('DELETE /api/chunked-upload/cancel 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/chunked-upload/cancel',
        body: { uploadId: 'test-upload-id' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('GET /api/chunked-upload/status 未登录返回 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chunked-upload/status?uploadId=test-upload-id',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('Zod 校验', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-user-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 0,
      })
    })

    it('POST /api/chunked-upload/init 缺少 fileName 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/init',
        headers: AUTH_HEADERS,
        body: { totalChunks: 3 },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/chunked-upload/init 缺少 totalChunks 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/init',
        headers: AUTH_HEADERS,
        body: { fileName: 'test.txt' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('POST /api/chunked-upload/merge uploadId 为空返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/merge',
        headers: AUTH_HEADERS,
        body: { uploadId: '' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('uploadId')
    })

    it('DELETE /api/chunked-upload/cancel uploadId 为空返回 400', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/chunked-upload/cancel',
        headers: AUTH_HEADERS,
        body: { uploadId: '' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json().message).toContain('uploadId')
    })

    it('GET /api/chunked-upload/status 缺少 uploadId 返回 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chunked-upload/status',
        headers: AUTH_HEADERS,
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('业务逻辑', () => {
    beforeEach(() => {
      vi.mocked(verifyAccessToken).mockResolvedValue({
        userId: 'mock-user-id',
        phone: '13800000000',
        familyId: '11111111-1111-1111-1111-111111111111',
        roleId: 0,
      })
    })

    it('POST /api/chunked-upload/init 成功返回 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/init',
        headers: AUTH_HEADERS,
        body: {
          fileName: 'test.txt',
          fileSize: 1024,
          totalChunks: 3,
        },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.uploadId).toBeDefined()
      expect(body.data.uploadedChunks).toBe(0)
      expect(body.data.chunkSize).toBeGreaterThan(0)
    })

    it('POST /api/chunked-upload/init 带可选字段成功返回 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chunked-upload/init',
        headers: AUTH_HEADERS,
        body: {
          fileName: 'test.png',
          fileSize: 2048,
          totalChunks: 2,
          fileMd5: 'abc123def456',
          mimeType: 'image/png',
          chunkSize: 1024,
        },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.chunkSize).toBe(1024)
    })

    it('DELETE /api/chunked-upload/cancel 成功返回 200', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/chunked-upload/cancel',
        headers: AUTH_HEADERS,
        body: { uploadId: 'test-upload-id' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.cancelled).toBe(true)
    })
  })
})
