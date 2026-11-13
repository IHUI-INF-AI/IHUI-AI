// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-197 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/oss/resource/file 返回 uploadUrl='/api/chunked-upload/chunk',而真实注册
 * 路径是 '/api/chunked-upload/upload' ⇒ 客户端照返回值调用恒 404;且该入口自己 db.insert,
 * 绕过了 /chunked-upload/init 的大小/分片数上界、参数自洽性、单用户活跃会话预算(429)
 * 与分片临时目录创建。
 *
 * 本文件锁:
 *   ① 返回的 uploadUrl 来自 createUploadSession(与 CHUNKED_UPLOAD_ENDPOINTS 同源),
 *      且该地址在本 app 内真实可路由(按它发分片得到的是"缺请求头"的 400,不是 404);
 *   ② fileSize / totalChunks 超协议上限 ⇒ 4xx,且一次会话行都不创建;
 *   ③ 非法类型字段(mimeType)⇒ 4xx,且不建会话;
 *   ④ 正常请求状态码与响应结构不变(201 + 六个字段),merge/status 地址同样可用。
 *
 * 只 mock authenticate / db,不连真实 PG、不触达真实 OSS;分片目录落在临时目录并在收尾清理。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { rmSync } from 'node:fs'

const TEST_UPLOAD_DIR = `${process.env.TEMP || process.env.TMP || '/tmp'}/ihui-test-uploads-f197`

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.UPLOAD_DIR = `${process.env.TEMP || process.env.TMP || '/tmp'}/ihui-test-uploads-f197`
})

const USER_ID = '00000000-0000-4000-8000-0000000000f7'

const { dbState } = vi.hoisted(() => ({
  dbState: {
    /** select 返回值队列:每调用一次 shift 一批,空则 []。 */
    selectRows: [] as unknown[][],
    /** insert().values() 收到的会话行,用来判"有没有真的建会话"。 */
    insertedRows: [] as unknown[],
  },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = '00000000-0000-4000-8000-0000000000f7'
  }),
  checkAuth: vi.fn(async () => true),
}))

vi.mock('../src/db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    values: (row: unknown) => DbChain
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
      values: (row) => {
        dbState.insertedRows.push(row)
        return chain
      },
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
      select: vi.fn(() => createChain(dbState.selectRows.shift() ?? [])),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
    dbRead: { select: vi.fn(() => createChain()) },
  }
})

import { authenticate } from '../src/plugins/auth.js'
import { ossResourceRoutes } from '../src/routes/other/oss-resource-routes.js'
import { CHUNKED_UPLOAD_ENDPOINTS, chunkedUploadRoutes } from '../src/routes/chunked-upload.js'
import { PROTOCOL_UPLOAD_LIMITS } from '../src/services/upload-integrity.js'

const OSS_INIT_URL = '/api/oss/resource/file'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  // 与 routes/other/index.ts 同一形态:统一 authenticate preHandler 后再挂子路由。
  await app.register(
    async (instance) => {
      instance.addHook('preHandler', async (request, reply) => {
        try {
          await authenticate(request)
        } catch (e) {
          const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
          return reply.status(statusCode).send({ code: statusCode, message: '操作失败,请稍后重试' })
        }
      })
      await instance.register(ossResourceRoutes)
      // 同时挂上 chunked-upload:① 要按返回的 uploadUrl 真发一次请求,证明它不是 404。
      await instance.register(chunkedUploadRoutes)
    },
    { prefix: '/api' },
  )
  await app.ready()
})

afterAll(async () => {
  await app?.close()
  try {
    rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true })
  } catch {
    // ignore
  }
})

beforeEach(() => {
  dbState.selectRows.length = 0
  dbState.insertedRows.length = 0
})

describe('F-197 /api/oss/resource/file 必须走 chunked-upload 的初始化装配', () => {
  it('① 返回的 uploadUrl 来自初始化结果,且该地址真实可路由(不是 404)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: OSS_INIT_URL,
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

    // 地址与 createUploadSession 的出口常量同源,不再是手拼的 /chunk
    expect(body.data.uploadUrl).toBe(CHUNKED_UPLOAD_ENDPOINTS.upload)
    expect(body.data.uploadUrl).toBe('/api/chunked-upload/upload')
    expect(body.data.uploadUrl).not.toBe('/api/chunked-upload/chunk')
    expect(body.data.mergeUrl).toBe(CHUNKED_UPLOAD_ENDPOINTS.merge)
    expect(body.data.statusUrl).toBe(CHUNKED_UPLOAD_ENDPOINTS.status)

    // 按返回的地址发分片:拿到"缺 x-upload-id"的 400 = 路由真实存在(旧地址回 404)
    const probe = await app.inject({
      method: 'POST',
      url: body.data.uploadUrl,
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from([1, 2, 3]),
    })
    expect(probe.statusCode).toBe(400)
    expect(probe.json().message).toContain('x-upload-id')

    // 会话确实由共享装配函数建立:属主 + uploading 状态 + TTL
    expect(dbState.insertedRows).toHaveLength(1)
    const row = dbState.insertedRows[0] as Record<string, unknown>
    expect(row.userId).toBe(USER_ID)
    expect(row.status).toBe('uploading')
    expect(row.totalChunks).toBe(2)
    expect(row.fileSize).toBe(1024)
    expect(row.expiresAt).toBeInstanceOf(Date)
  })

  it('② fileSize 超协议上限 ⇒ 4xx,且一次会话都不创建', async () => {
    const res = await app.inject({
      method: 'POST',
      url: OSS_INIT_URL,
      payload: {
        fileName: 'huge.png',
        fileSize: PROTOCOL_UPLOAD_LIMITS.maxFileBytes + 1,
        totalChunks: 1,
      },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
    expect(dbState.insertedRows).toHaveLength(0)
  })

  it('②b totalChunks 超协议上限 ⇒ 4xx,且一次会话都不创建(旧实现无上界)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: OSS_INIT_URL,
      payload: {
        fileName: 'oom.png',
        fileSize: 0,
        totalChunks: PROTOCOL_UPLOAD_LIMITS.maxTotalChunks + 1,
      },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
    expect(dbState.insertedRows).toHaveLength(0)
  })

  it('③ 非法类型(mimeType 超长/非白名单形态)⇒ 4xx,且不建会话', async () => {
    const res = await app.inject({
      method: 'POST',
      url: OSS_INIT_URL,
      payload: {
        fileName: 'evil.png',
        fileSize: 1024,
        totalChunks: 1,
        mimeType: `${'x'.repeat(200)}/plain`,
      },
    })
    expect(res.statusCode).toBeGreaterThanOrEqual(400)
    expect(res.statusCode).toBeLessThan(500)
    expect(dbState.insertedRows).toHaveLength(0)
  })

  it('④ 正常请求状态码与响应结构不变(201 + 六字段)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: OSS_INIT_URL,
      payload: { fileName: 'a.png', fileSize: 1024, totalChunks: 2 },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.uploadId).toMatch(/^[0-9a-f-]{36}$/)
    expect(Object.keys(body.data).sort()).toEqual(
      ['uploadId', 'uploadUrl', 'mergeUrl', 'statusUrl', 'totalChunks', 'chunkSize'].sort(),
    )
    expect(body.data.totalChunks).toBe(2)
    expect(body.data.chunkSize).toBe(5 * 1024 * 1024)

    // status 地址同样真实存在:缺 uploadId 查询参数 ⇒ 400(不是 404)
    const statusProbe = await app.inject({ method: 'GET', url: body.data.statusUrl })
    expect(statusProbe.statusCode).toBe(400)
  })
})
