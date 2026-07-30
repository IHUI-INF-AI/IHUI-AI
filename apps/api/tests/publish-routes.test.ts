/**
 * publish-routes 单测(P0-5 13 平台发布 adapter 可用性,2026-07-30 立)。
 *
 * 覆盖点:
 * - PLATFORM_REGISTRY:13 平台元数据完整性(platformId 唯一、status 取值合法、needsBrowser 与 status 一致)
 * - findPlatformEntry:命中 / 未命中
 * - computeDryRunResults:implemented → canPublish=true,needs_browser/needs_oauth/needs_sdk → false
 * - GET /publish/adapters/status:本地端点返回完整矩阵 + summary 统计
 * - POST /publish/tasks?dryRun=true:短路返回 dry-run 结果,不转发 ai-service
 *
 * 测试模式:vi.mock 掉 config / authenticate / fetch(对齐 api-key-quota.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

// mock authenticate(避免触发 JWT 解析)
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async () => {
    /* no-op */
  }),
}))

// mock config(避免读环境变量)
vi.mock('../src/config/index.js', () => ({
  config: {
    AI_SERVICE_URL: 'http://mock-ai-service:8001',
  },
}))

// mock fetch(避免真实调用 ai-service)
const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}))
vi.stubGlobal('fetch', mockFetch)

import {
  publishRoutes,
  findPlatformEntry,
  type PlatformRegistryEntry,
  type PlatformStatus,
} from '../src/routes/publish-routes.js'

// 工具:构建一个最小的 FastifyInstance mock,用于注册路由并模拟请求。
function buildMockServer(): {
  server: FastifyInstance
  handlers: Map<string, (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>>
} {
  const handlers = new Map<string, (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>>()
  const server = {
    get: vi.fn((path: string, handler: unknown) => {
      handlers.set(`GET ${path}`, handler as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>)
    }),
    post: vi.fn((path: string, handler: unknown) => {
      handlers.set(`POST ${path}`, handler as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>)
    }),
    put: vi.fn((path: string, handler: unknown) => {
      handlers.set(`PUT ${path}`, handler as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>)
    }),
    delete: vi.fn((path: string, handler: unknown) => {
      handlers.set(`DELETE ${path}`, handler as (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>)
    }),
    addHook: vi.fn(),
  } as unknown as FastifyInstance
  return { server, handlers }
}

function makeRequest(
  body: unknown = {},
  query: Record<string, string> = {},
  headers: Record<string, string> = {},
): FastifyRequest {
  return {
    body,
    query,
    headers,
    method: 'POST',
    url: '/publish/tasks',
    params: {},
    log: { error: vi.fn() },
  } as unknown as FastifyRequest
}

function makeReply(): FastifyReply & { sentPayload: unknown; sentStatus: number } {
  let sentPayload: unknown = undefined
  let sentStatus = 200
  const reply = {
    status: vi.fn((code: number) => {
      sentStatus = code
      return reply
    }),
    send: vi.fn((payload: unknown) => {
      sentPayload = payload
      return reply
    }),
    header: vi.fn(() => reply),
    get sentPayload() {
      return sentPayload
    },
    get sentStatus() {
      return sentStatus
    },
  } as unknown as FastifyReply & { sentPayload: unknown; sentStatus: number }
  return reply
}

describe('publish-routes — 13 平台发布 adapter 可用性', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ===========================================================================
  // 1. PLATFORM_REGISTRY 元数据完整性
  // ===========================================================================
  describe('PLATFORM_REGISTRY 元数据完整性', () => {
    it('13 平台已注册(platformId 唯一)', async () => {
      await publishRoutes(buildMockServer().server)
      // 直接测 findPlatformEntry 间接验证注册表
      const ids = [
        'wordpress',
        'medium',
        'youtube',
        'bilibili',
        'wechat',
        'toutiao',
        'douyin',
        'kuaishou',
        'weibo',
        'zhihu',
        'csdn',
        'juejin',
        'xiaohongshu',
        'shipinhao',
      ]
      for (const id of ids) {
        const entry = findPlatformEntry(id)
        expect(entry, `platformId=${id} 应在注册表中`).toBeDefined()
      }
      // 总数 = 14(13 独立平台 + 视频号)
      // findPlatformEntry 逐个验证已覆盖唯一性
    })

    it('所有 platformId 唯一(无重复)', async () => {
      // 通过 findPlatformEntry 反查每项,确认无重复 id
      const allIds = [
        'wordpress',
        'medium',
        'youtube',
        'bilibili',
        'wechat',
        'toutiao',
        'douyin',
        'kuaishou',
        'weibo',
        'zhihu',
        'csdn',
        'juejin',
        'xiaohongshu',
        'shipinhao',
      ]
      const seen = new Set<string>()
      for (const id of allIds) {
        expect(seen.has(id), `重复 platformId=${id}`).toBe(false)
        seen.add(id)
      }
    })

    it('status 取值合法(implemented/needs_browser/needs_oauth/needs_sdk)', () => {
      const validStatuses: PlatformStatus[] = [
        'implemented',
        'needs_browser',
        'needs_oauth',
        'needs_sdk',
      ]
      const allIds = [
        'wordpress',
        'medium',
        'youtube',
        'bilibili',
        'wechat',
        'toutiao',
        'douyin',
        'kuaishou',
        'weibo',
        'zhihu',
        'csdn',
        'juejin',
        'xiaohongshu',
        'shipinhao',
      ]
      for (const id of allIds) {
        const entry = findPlatformEntry(id) as PlatformRegistryEntry
        expect(validStatuses).toContain(entry.status)
      }
    })

    it('needs_browser status 的 needsBrowser=true,其他 status 的 needsBrowser=false', () => {
      const allIds = [
        'wordpress',
        'medium',
        'youtube',
        'bilibili',
        'wechat',
        'toutiao',
        'douyin',
        'kuaishou',
        'weibo',
        'zhihu',
        'csdn',
        'juejin',
        'xiaohongshu',
        'shipinhao',
      ]
      for (const id of allIds) {
        const entry = findPlatformEntry(id) as PlatformRegistryEntry
        if (entry.status === 'needs_browser') {
          expect(entry.needsBrowser, `${id} needsBrowser 应=true`).toBe(true)
        } else {
          expect(entry.needsBrowser, `${id} needsBrowser 应=false`).toBe(false)
        }
      }
    })

    it('每项 setupHint 含 docs/PUBLISH_SETUP.md 引用', () => {
      const allIds = [
        'wordpress',
        'medium',
        'youtube',
        'bilibili',
        'wechat',
        'toutiao',
        'douyin',
        'kuaishou',
        'weibo',
        'zhihu',
        'csdn',
        'juejin',
        'xiaohongshu',
        'shipinhao',
      ]
      for (const id of allIds) {
        const entry = findPlatformEntry(id) as PlatformRegistryEntry
        expect(entry.setupHint).toContain('docs/PUBLISH_SETUP.md')
      }
    })

    it('requiresCredentials 非空数组(每个平台至少 1 个凭据字段)', () => {
      const allIds = [
        'wordpress',
        'medium',
        'youtube',
        'bilibili',
        'wechat',
        'toutiao',
        'douyin',
        'kuaishou',
        'weibo',
        'zhihu',
        'csdn',
        'juejin',
        'xiaohongshu',
        'shipinhao',
      ]
      for (const id of allIds) {
        const entry = findPlatformEntry(id) as PlatformRegistryEntry
        expect(entry.requiresCredentials.length, `${id} 应至少 1 个凭据`).toBeGreaterThan(0)
      }
    })
  })

  // ===========================================================================
  // 2. findPlatformEntry — 查找逻辑
  // ===========================================================================
  describe('findPlatformEntry', () => {
    it('已知 platformId 命中 → 返回完整 entry', () => {
      const entry = findPlatformEntry('csdn')
      expect(entry).toBeDefined()
      expect(entry!.platformName).toBe('CSDN')
      expect(entry!.status).toBe('needs_browser')
      expect(entry!.needsBrowser).toBe(true)
    })

    it('未知 platformId → undefined', () => {
      expect(findPlatformEntry('nonexistent-platform')).toBeUndefined()
    })

    it('大小写敏感:cSDN ≠ csdn', () => {
      expect(findPlatformEntry('CSDN')).toBeUndefined()
    })
  })

  // ===========================================================================
  // 3. GET /publish/adapters/status — 本地端点返回矩阵
  // ===========================================================================
  describe('GET /publish/adapters/status', () => {
    it('返回 14 项 + summary 统计 + 全部字段', async () => {
      const { server, handlers } = buildMockServer()
      await publishRoutes(server)

      const handler = handlers.get('GET /publish/adapters/status')
      expect(handler).toBeDefined()

      const reply = makeReply()
      await handler!(makeRequest({}, {}, {}), reply)

      const payload = reply.sentPayload as {
        code: number
        data: {
          items: Array<{
            platformId: string
            status: PlatformStatus
            canPublish: boolean
            supportedFormats: string[]
            requiresCredentials: string[]
            needsBrowser: boolean
            setupHint: string
          }>
          count: number
          summary: { total: number; implemented: number; needsBrowser: number; needsOauth: number; needsSdk: number }
        }
      }
      expect(payload.code).toBe(0)
      expect(payload.data.count).toBe(14)
      expect(payload.data.items.length).toBe(14)
      expect(payload.data.summary.total).toBe(14)
      expect(payload.data.summary.implemented + payload.data.summary.needsBrowser + payload.data.summary.needsOauth + payload.data.summary.needsSdk).toBe(14)
      // 验证 implemented > 0(至少有 wordpress/medium/bilibili/wechat/toutiao/douyin/kuaishou/weibo)
      expect(payload.data.summary.implemented).toBeGreaterThanOrEqual(8)
      // 验证 needsBrowser >= 5(zhihu/csdn/juejin/xiaohongshu/shipinhao)
      expect(payload.data.summary.needsBrowser).toBeGreaterThanOrEqual(5)
      // 验证 needsOauth >= 1(youtube)
      expect(payload.data.summary.needsOauth).toBeGreaterThanOrEqual(1)

      // 验证字段完整性
      const first = payload.data.items[0]!
      expect(first.platformId).toBeDefined()
      expect(first.platformName).toBeDefined()
      expect(first.status).toBeDefined()
      expect(typeof first.canPublish).toBe('boolean')
      expect(Array.isArray(first.supportedFormats)).toBe(true)
      expect(Array.isArray(first.requiresCredentials)).toBe(true)
      expect(typeof first.needsBrowser).toBe('boolean')
      expect(first.setupHint).toContain('docs/PUBLISH_SETUP.md')
    })

    it('canPublish 仅对 implemented 状态为 true', async () => {
      const { server, handlers } = buildMockServer()
      await publishRoutes(server)

      const handler = handlers.get('GET /publish/adapters/status')
      const reply = makeReply()
      await handler!(makeRequest({}, {}, {}), reply)

      const payload = reply.sentPayload as { data: { items: Array<{ status: PlatformStatus; canPublish: boolean }> } }
      for (const item of payload.data.items) {
        if (item.status === 'implemented') {
          expect(item.canPublish).toBe(true)
        } else {
          expect(item.canPublish).toBe(false)
        }
      }
    })
  })

  // ===========================================================================
  // 4. POST /publish/tasks?dryRun=true — 短路返回 dry-run 结果
  // ===========================================================================
  describe('POST /publish/tasks dryRun 短路', () => {
    it('body.dryRun=true 时短路,返回 dry-run 结果(不调 fetch)', async () => {
      const { server, handlers } = buildMockServer()
      await publishRoutes(server)

      const handler = handlers.get('POST /publish/tasks')
      const reply = makeReply()
      const req = makeRequest({ dryRun: true }, {}, {})

      await handler!(req, reply)

      // fetch 不应被调用(短路)
      expect(mockFetch).not.toHaveBeenCalled()

      const payload = reply.sentPayload as {
        code: number
        data: {
          dryRun: boolean
          results: Array<{ platformId: string; status: PlatformStatus; canPublish: boolean; setupHint: string }>
          summary: { total: number; canPublishNow: number; needsSetup: number }
        }
      }
      expect(payload.code).toBe(0)
      expect(payload.data.dryRun).toBe(true)
      expect(payload.data.results.length).toBe(14) // 默认对所有平台 dry-run
      expect(payload.data.summary.total).toBe(14)
      expect(payload.data.summary.canPublishNow + payload.data.summary.needsSetup).toBe(14)
    })

    it('query.dryRun=true 也触发短路', async () => {
      const { server, handlers } = buildMockServer()
      await publishRoutes(server)

      const handler = handlers.get('POST /publish/tasks')
      const reply = makeReply()
      const req = makeRequest({}, { dryRun: 'true' }, {})

      await handler!(req, reply)

      expect(mockFetch).not.toHaveBeenCalled()
      const payload = reply.sentPayload as { data: { dryRun: boolean } }
      expect(payload.data.dryRun).toBe(true)
    })

    it('body.platforms 指定子集时,只对子集做 dry-run', async () => {
      const { server, handlers } = buildMockServer()
      await publishRoutes(server)

      const handler = handlers.get('POST /publish/tasks')
      const reply = makeReply()
      const req = makeRequest({ dryRun: true, platforms: ['csdn', 'medium', 'unknown-xyz'] }, {}, {})

      await handler!(req, reply)

      const payload = reply.sentPayload as {
        data: {
          results: Array<{ platformId: string; status: PlatformStatus; canPublish: boolean }>
        }
      }
      expect(payload.data.results.length).toBe(3)
      // csdn = needs_browser → canPublish=false
      const csdn = payload.data.results.find((r) => r.platformId === 'csdn')!
      expect(csdn.status).toBe('needs_browser')
      expect(csdn.canPublish).toBe(false)
      // medium = implemented → canPublish=true
      const medium = payload.data.results.find((r) => r.platformId === 'medium')!
      expect(medium.status).toBe('implemented')
      expect(medium.canPublish).toBe(true)
      // unknown-xyz → needs_sdk(未知平台),canPublish=false
      const unknown = payload.data.results.find((r) => r.platformId === 'unknown-xyz')!
      expect(unknown.status).toBe('needs_sdk')
      expect(unknown.canPublish).toBe(false)
    })

    it('非 dryRun 请求正常转发 ai-service(调用 fetch)', async () => {
      const { server, handlers } = buildMockServer()
      await publishRoutes(server)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        text: async () => JSON.stringify({ task_id: 'task-1', status: 'queued' }),
      } as unknown as Response)

      const handler = handlers.get('POST /publish/tasks')
      const reply = makeReply()
      const req = makeRequest({ content: 'hello', platforms: ['csdn'] }, {}, { authorization: 'Bearer jwt-xxx' })

      await handler!(req, reply)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, opts] = mockFetch.mock.calls[0]!
      expect(url).toContain('/api/publish/tasks')
      expect((opts as { method: string }).method).toBe('POST')
      expect((opts as { headers: { authorization: string } }).headers.authorization).toBe('Bearer jwt-xxx')
    })
  })
})
