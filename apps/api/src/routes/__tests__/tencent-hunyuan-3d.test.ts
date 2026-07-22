import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac, createHash } from 'node:crypto'
import type * as VendorAuth from '../../services/vendor-auth-strategies.js'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:8810/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate, mockDbInsert, mockBuildHeaders } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'test-user-id'
    return { userId: 'test-user-id' } as never
  }),
  mockDbInsert: vi.fn(),
  mockBuildHeaders: vi.fn(),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.mock('@ihui/database', () => ({
  videoGenerationTasks: {
    taskId: 'task_id',
    userUuid: 'user_uuid',
    chatId: 'chat_id',
    status: 'status',
    message: 'message',
  },
}))

vi.mock('../../db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    orderBy: () => DbChain
    limit: () => DbChain
    offset: () => DbChain
    set: () => DbChain
    returning: () => DbChain
    values: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      set: () => chain,
      returning: () => chain,
      values: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => ({ values: mockDbInsert })),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
    dbRead: {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn(() => createChain()),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

vi.mock('../../services/vendor-auth-strategies.js', () => ({
  authStrategyFactory: {
    getStrategy: vi.fn(() => ({
      authType: 'tencent_tc3',
      buildHeaders: mockBuildHeaders,
      validateCredentials: vi.fn(() => true),
    })),
  },
  TencentTc3AuthStrategy: vi.fn(),
}))

import { tencentHunyuan3dRoutes } from '../tencent-hunyuan-3d.js'

describe('Tencent Hunyuan 3D API (P1 R81 真实化端点)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(tencentHunyuan3dRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = 'test-user-id'
      return { userId: 'test-user-id' } as never
    })
    mockDbInsert.mockResolvedValue(undefined)
    mockBuildHeaders.mockReturnValue({
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'X-TC-Action': 'SubmitHunyuanTo3DJob',
        Authorization: 'TC3-HMAC-SHA256 Credential=mock/xxx',
      },
      body: '{}',
    })
  })

  afterEach(() => {
    delete process.env.TENCENT_SECRET_ID
    delete process.env.TENCENT_SECRET_KEY
    vi.restoreAllMocks()
  })

  describe('路由注册', () => {
    it('插件注册成功不抛错', () => {
      expect(app).toBeDefined()
    })
  })

  describe('未鉴权 (401)', () => {
    it('POST /api/tencent/hunyuan3d/submit 无 auth 返回 401', async () => {
      mockAuthenticate.mockImplementation(async () => {
        const err = new Error('Authentication required')
        ;(err as Error & { statusCode: number }).statusCode = 401
        throw err
      })
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { user_uuid: 'u1', Prompt: 'a cube' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/tencent/hunyuan3d/submit', () => {
    it('hasTencentConfig=false 分支: 返回 stub JobId, message 含 stub', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { user_uuid: 'u1', Prompt: 'a cube' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.stub).toBe(true)
      expect(body.data.live).toBe(false)
      expect(body.data.data.JobId).toMatch(/^stub-/)
      expect(body.data.data.Status).toBe('PENDING')
      expect(body.data.data.tencentConfig).toBe(false)
      expect(body.data.message).toContain('stub')
      expect(body.data.data.persistence).toBe('video_generation_tasks')
      expect(mockBuildHeaders).not.toHaveBeenCalled()
    })

    it('hasTencentConfig=true + 腾讯返回 JobId: 用真实 JobId 替换 stub (live=true)', async () => {
      process.env.TENCENT_SECRET_ID = 'test-secret-id'
      process.env.TENCENT_SECRET_KEY = 'test-secret-key'
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ JobId: 'tencent-real-job-1', Status: 'PENDING' }),
      } as Response)

      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { user_uuid: 'u1', Prompt: 'a cube' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.live).toBe(true)
      expect(body.data.stub).toBe(false)
      expect(body.data.data.JobId).toBe('tencent-real-job-1')
      expect(body.data.data.Status).toBe('PENDING')
      expect(body.data.data.tencentConfig).toBe(true)
      expect(body.data.message).toContain('SubmitHunyuanTo3DJob')
      expect(mockBuildHeaders).toHaveBeenCalledTimes(1)
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('hasTencentConfig=true + 腾讯调用失败: 降级 stub JobId, 端点不 500', async () => {
      process.env.TENCENT_SECRET_ID = 'test-secret-id'
      process.env.TENCENT_SECRET_KEY = 'test-secret-key'
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { user_uuid: 'u1', Prompt: 'a cube' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.stub).toBe(true)
      expect(body.data.live).toBe(false)
      expect(body.data.data.JobId).toMatch(/^stub-/)
      expect(body.data.message).toContain('降级')
    })

    it('参数校验: 缺少 user_uuid 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { Prompt: 'a cube' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('参数校验: Prompt 和 ImageUrl 同时存在返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: {
          user_uuid: 'u1',
          Prompt: 'a cube',
          ImageUrl: 'https://example.com/img.png',
        },
      })
      expect(res.statusCode).toBe(400)
    })

    it('参数校验: Prompt/ImageBase64/ImageUrl/MultiViewImages 全缺返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { user_uuid: 'u1' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('持久化失败时不阻塞: db.insert 抛错, 端点仍返回 200 + memory_only', async () => {
      mockDbInsert.mockRejectedValue(new Error('db connection failed'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/submit',
        payload: { user_uuid: 'u1', Prompt: 'a cube' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.data.persistence).toBe('memory_only')
      expect(body.data.data.persistedTaskId).toBeNull()
    })
  })

  describe('POST /api/tencent/hunyuan3d/query', () => {
    it('stub- JobId 守卫: 不调用腾讯 API, 仅查 DB+内存', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/query',
        payload: { JobId: 'stub-123' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.code).toBe(0)
      expect(body.data.stub).toBe(true)
      expect(body.data.data.Status).toBe('UNKNOWN')
      expect(mockBuildHeaders).not.toHaveBeenCalled()
    })

    it('真实 JobId + hasTencentConfig=true: 调用腾讯 QueryHunyuanTo3DJob, 状态以腾讯返回为准', async () => {
      process.env.TENCENT_SECRET_ID = 'test-secret-id'
      process.env.TENCENT_SECRET_KEY = 'test-secret-key'
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          Response: {
            JobId: 'real-job-1',
            Status: 'SUCCESS',
            ResultFile3Ds: [{ Url: 'https://example.com/model.glb' }],
            ErrorMsg: '',
            RequestId: 'req-1',
          },
        }),
      } as Response)

      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/query',
        payload: { JobId: 'real-job-1' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.data.Status).toBe('SUCCESS')
      expect(body.data.data.ResultFile3Ds).toEqual([{ Url: 'https://example.com/model.glb' }])
      expect(body.data.data.tencent_response).toBeTruthy()
      expect(body.data.message).toContain('QueryHunyuanTo3DJob')
      expect(mockBuildHeaders).toHaveBeenCalledTimes(1)
    })

    it('真实 JobId + 腾讯调用失败: 降级到 DB+内存查询, 不 500', async () => {
      process.env.TENCENT_SECRET_ID = 'test-secret-id'
      process.env.TENCENT_SECRET_KEY = 'test-secret-key'
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/query',
        payload: { JobId: 'real-job-2' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.data.tencent_response).toBeNull()
      expect(body.data.data.Status).toBe('UNKNOWN')
      expect(body.data.message).toContain('降级')
    })

    it('参数校验: 缺少 JobId 返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tencent/hunyuan3d/query',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/tencent/hunyuan3d/job/:job_id (与 query 端点对称)', () => {
    it('stub- JobId 守卫: 不调用腾讯 API', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tencent/hunyuan3d/job/stub-xyz',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.stub).toBe(true)
      expect(body.data.data.JobId).toBe('stub-xyz')
      expect(mockBuildHeaders).not.toHaveBeenCalled()
    })

    it('真实 JobId + 腾讯返回: 状态以腾讯返回为准', async () => {
      process.env.TENCENT_SECRET_ID = 'test-secret-id'
      process.env.TENCENT_SECRET_KEY = 'test-secret-key'
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          Response: {
            JobId: 'real-job-3',
            Status: 'RUNNING',
            ErrorMsg: '',
          },
        }),
      } as Response)

      const res = await app.inject({
        method: 'GET',
        url: '/api/tencent/hunyuan3d/job/real-job-3',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.data.Status).toBe('RUNNING')
      expect(body.data.data.JobId).toBe('real-job-3')
      expect(mockBuildHeaders).toHaveBeenCalledTimes(1)
    })

    it('真实 JobId + 腾讯失败: 降级不 500', async () => {
      process.env.TENCENT_SECRET_ID = 'test-secret-id'
      process.env.TENCENT_SECRET_KEY = 'test-secret-key'
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('timeout'))

      const res = await app.inject({
        method: 'GET',
        url: '/api/tencent/hunyuan3d/job/real-job-4',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.data.Status).toBe('UNKNOWN')
    })
  })

  describe('TencentTc3AuthStrategy 签名 (TC3-HMAC-SHA256 各步骤)', () => {
    // 直接测试真实的 TencentTc3AuthStrategy (绕过 mock, 用 vi.importActual 取真实模块)
    type StrategyCtor = typeof VendorAuth.TencentTc3AuthStrategy
    let StrategyClass: StrategyCtor

    beforeAll(async () => {
      const mod = await vi.importActual<typeof VendorAuth>(
        '../../services/vendor-auth-strategies.js',
      )
      StrategyClass = mod.TencentTc3AuthStrategy
    })

    it('validateCredentials: 缺 key 或 secret 返回 false', () => {
      const s = new StrategyClass()
      expect(s.validateCredentials({})).toBe(false)
      expect(s.validateCredentials({ key: 'k' })).toBe(false)
      expect(s.validateCredentials({ secret: 's' })).toBe(false)
      expect(s.validateCredentials({ key: 'k', secret: 's' })).toBe(true)
    })

    it('buildHeaders: 缺凭据抛错', () => {
      const s = new StrategyClass()
      expect(() =>
        s.buildHeaders({}, { method: 'POST', url: 'https://ai3d.tencentcloudapi.com/' }),
      ).toThrow(/Secret ID and Secret Key/)
    })

    it('buildHeaders: 返回完整 TC3-HMAC-SHA256 签名 header', () => {
      const s = new StrategyClass()
      const result = s.buildHeaders(
        { key: 'AKIDxxxxxxxxxxxx', secret: 'SSSSxxxxxxxxxxxx' },
        {
          method: 'POST',
          url: 'https://ai3d.tencentcloudapi.com/',
          body: { JobId: 'job-1' },
          config: {
            service: 'ai3d',
            host: 'ai3d.tencentcloudapi.com',
            version: '2025-05-13',
            region: 'ap-guangzhou',
            action: 'QueryHunyuanTo3DJob',
          },
        },
      )
      expect(result.headers['X-TC-Action']).toBe('QueryHunyuanTo3DJob')
      expect(result.headers['X-TC-Version']).toBe('2025-05-13')
      expect(result.headers['X-TC-Region']).toBe('ap-guangzhou')
      expect(result.headers['X-TC-Timestamp']).toMatch(/^\d{10}$/)
      expect(result.headers['Content-Type']).toBe('application/json; charset=utf-8')
      const auth = result.headers.Authorization
      expect(auth).toMatch(
        /^TC3-HMAC-SHA256 Credential=AKIDxxxxxxxxxxxx\/\d{4}-\d{2}-\d{2}\/ai3d\/tc3_request, SignedHeaders=content-type;host;x-tc-action, Signature=[0-9a-f]{64}$/,
      )
      expect(result.body).toBe(JSON.stringify({ JobId: 'job-1' }))
    })

    it('buildHeaders: 无显式 action 时从 URL 末段推断 (转大写)', () => {
      const s = new StrategyClass()
      const result = s.buildHeaders(
        { key: 'k', secret: 's' },
        {
          method: 'POST',
          url: 'https://ai3d.tencentcloudapi.com/ai3d',
          body: {},
          config: { service: 'ai3d', host: 'ai3d.tencentcloudapi.com' },
        },
      )
      expect(result.headers['X-TC-Action']).toBe('AI3D')
    })

    it('buildHeaders: 签名算法各步骤可独立复现 (canonicalRequest→stringToSign→signature)', () => {
      // 用固定输入手动复现签名各步骤, 与策略输出对比, 验证算法一致性
      const key = 'AKIDtest'
      const secret = 'Gu5t9xGARNpq86cd98joQYCN3xxxxxx'
      const body = { JobId: 'job-X' }
      const service = 'ai3d'
      const host = 'ai3d.tencentcloudapi.com'
      const action = 'QueryHunyuanTo3DJob'

      const s = new StrategyClass()
      const result = s.buildHeaders(
        { key, secret },
        {
          method: 'POST',
          url: 'https://ai3d.tencentcloudapi.com/',
          body,
          config: { service, host, version: '2025-05-13', region: 'ap-guangzhou', action },
        },
      )

      // 复现签名各步骤
      const payloadStr = JSON.stringify(body)
      const timestamp = Number(result.headers['X-TC-Timestamp'])
      const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
      const contentType = 'application/json; charset=utf-8'
      const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
      const signedHeaders = 'content-type;host;x-tc-action'
      const hashedPayload = createHash('sha256').update(payloadStr).digest('hex')
      const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`
      const credentialScope = `${date}/${service}/tc3_request`
      const hashedRequest = createHash('sha256').update(canonicalRequest).digest('hex')
      const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${hashedRequest}`
      const secretDate = createHmac('sha256', `TC3${secret}`).update(date).digest()
      const secretService = createHmac('sha256', secretDate).update(service).digest()
      const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest()
      const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

      const expectedAuth = `TC3-HMAC-SHA256 Credential=${key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
      expect(result.headers.Authorization).toBe(expectedAuth)
    })
  })
})
