// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-282 回归锁(2026-11-13)。
 *
 * 病灶:GET /api/oss/download/:id 是"假下载" —— 真实下载代理从未实现,旧处理器却以 200
 * 返回驱动 config;读取走 findOssDriverById(注释写明「含 credentials 仅 admin 自动解密」),
 * 且不校验 isEnabled / 管理员 ⇒ 任意登录用户可读未启用驱动的配置(含密钥即泄露),
 * 客户端也无法区分"成功但空"与真下载。
 *
 * 本文件锁(票面选方案 A:端点如实返回 501,不查驱动表):
 *   ① 普通登录用户请求不是 200(501),响应体不含 config / credentials / accessKey / secret;
 *   ② 端点完全不访问数据库(驱动查询与 db.select 调用数均为 0),不存在的 id 也一律 501;
 *   ③ 管理员同样拿不到 config —— 特权也不能读到本端点本不该暴露的字段;
 *   ④ 未启用驱动(isEnabled=false)不可能被当成成功下载返回;
 *   ⑤ 既有语义不回归:未登录 401、非法 id 400;
 *   ⑥ 源锁:oss.ts 该端点段落不再出现 config 投影,也不再调用 findOssDriverById。
 *
 * 只 mock 鉴权 / 驱动查询层 / db,不连 PG、Redis 与真实 OSS。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-0000000000a1'
const ADMIN_ID = '00000000-0000-4000-8000-0000000000a2'
const DRIVER_ID = '00000000-0000-4000-8000-000000000282'
const MISSING_ID = '00000000-0000-4000-8000-000000000404'

const { dbState } = vi.hoisted(() => ({ dbState: { selectCalls: 0 } }))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = USER_ID
    return { userId: USER_ID, roleId: 0 }
  }),
  checkAuth: vi.fn(
    async (
      request: { headers: Record<string, unknown>; userId?: string },
      reply: { status: (code: number) => { send: (body: unknown) => unknown } },
    ) => {
      if (!request.headers.authorization) {
        reply.status(401).send({ code: 401, message: 'Authentication required' })
        return false
      }
      request.userId = request.headers['x-test-role'] === 'admin' ? ADMIN_ID : USER_ID
      return true
    },
  ),
  checkAuthOrInternalService: vi.fn(async () => true),
  hasHumanJwtCredential: vi.fn(() => true),
  requireActiveUser: vi.fn(async () => undefined),
  requireApiKeyOrJwt: vi.fn(),
  revokeAccessToken: vi.fn(async () => undefined),
  isAccessTokenRevoked: vi.fn(async () => false),
  getTokenBlacklist: vi.fn(() => null),
}))

vi.mock('../src/db/index.js', () => {
  const record = (op: string) => () => {
    dbState.selectCalls += 1
    throw new Error(`F-282:下载代理端点不得访问数据库(${op})`)
  }
  return {
    db: {
      select: vi.fn(record('select')),
      insert: vi.fn(record('insert')),
      update: vi.fn(record('update')),
      delete: vi.fn(record('delete')),
      execute: vi.fn(record('execute')),
    },
    dbRead: { select: vi.fn(record('dbRead.select')) },
    dbClient: {},
  }
})

// 驱动查询层:全部返回"带密钥的未启用驱动",任何一次被调用都会让泄露断言失败。
vi.mock('../src/db/oss-queries.js', () => ({
  findOssDrivers: vi.fn(async () => []),
  findOssDriverById: vi.fn(async () => ({
    id: DRIVER_ID,
    name: 'prod-disabled',
    driver: 'aliyun',
    isEnabled: false,
    isDefault: false,
    sort: 0,
    description: null,
    config: { endpoint: 'oss-cn-hangzhou.aliyuncs.com', bucket: 'leaky-bucket' },
    credentials: { accessKeyId: 'LEAKED-ACCESS-KEY', accessKeySecret: 'LEAKED-SECRET' },
    createdAt: new Date(0),
    updatedAt: new Date(0),
  })),
  findOssDriverByName: vi.fn(),
  createOssDriver: vi.fn(),
  updateOssDriver: vi.fn(),
  deleteOssDriver: vi.fn(),
  findDefaultOssDriver: vi.fn(),
  clearOtherDefaults: vi.fn(async () => undefined),
}))

import { ossRoutes } from '../src/routes/oss.js'
import { findOssDriverById } from '../src/db/oss-queries.js'

const DOWNLOAD_URL = `/api/oss/download/${DRIVER_ID}`

const LEAK_MARKERS = [
  'config',
  'credentials',
  'accessKey',
  'accessKeySecret',
  'secret',
  'LEAKED',
  'leaky-bucket',
]

function expectNoConfigLeak(body: string): void {
  for (const marker of LEAK_MARKERS) {
    expect(body).not.toContain(marker)
  }
}

describe('F-282 /api/oss/download/:id 不得以 200 伪装下载、不得回传 config', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(ossRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    dbState.selectCalls = 0
    vi.mocked(findOssDriverById).mockClear()
  })

  it('① 普通登录用户:不是 200(501),且响应体不含 config/credentials/密钥', async () => {
    const res = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: 'Bearer user-token' },
    })

    expect(res.statusCode).not.toBe(200)
    expect(res.statusCode).toBe(501)
    const body = res.json() as Record<string, unknown>
    expect(body.code).toBe(501)
    expect(typeof body.message).toBe('string')
    // 旧实现:200 + data.config ⇒ 修好后既不成功也不带配置字段
    expectNoConfigLeak(res.body)
  })

  it('② 端点不查驱动表:驱动查询与 db 查询均为零调用', async () => {
    const res = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: 'Bearer user-token' },
    })

    expect(res.statusCode).toBe(501)
    expect(vi.mocked(findOssDriverById)).not.toHaveBeenCalled()
    expect(dbState.selectCalls).toBe(0)
  })

  it('②b 不存在的 id 也走同一语义(501),不查库、不虚构 404 假成功', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/oss/download/${MISSING_ID}`,
      headers: { authorization: 'Bearer user-token' },
    })

    expect(res.statusCode).toBe(501)
    expect(vi.mocked(findOssDriverById)).not.toHaveBeenCalled()
    expect(dbState.selectCalls).toBe(0)
    expectNoConfigLeak(res.body)
  })

  it('③ 管理员同样拿不到 config(特权不扩大本端点暴露面)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: 'Bearer admin-token', 'x-test-role': 'admin' },
    })

    expect(res.statusCode).not.toBe(200)
    expect(res.statusCode).toBe(501)
    expectNoConfigLeak(res.body)
  })

  it('④ 未启用驱动(isEnabled=false)不被当成成功下载', async () => {
    // mock 里的驱动恒为 isEnabled=false 且带密钥;若端点仍读驱动表就会命中它
    const res = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { authorization: 'Bearer user-token' },
    })

    expect(res.statusCode).toBe(501)
    expect(res.body).not.toContain('"isEnabled"')
    expectNoConfigLeak(res.body)
  })

  it('⑤a 未登录仍 401(鉴权语义不回归)', async () => {
    const res = await app.inject({ method: 'GET', url: DOWNLOAD_URL })
    expect(res.statusCode).toBe(401)
  })

  it('⑤b 非法 uuid 仍 400(参数校验不回归)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/oss/download/not-a-uuid',
      headers: { authorization: 'Bearer user-token' },
    })
    expect(res.statusCode).toBe(400)
    expect(dbState.selectCalls).toBe(0)
  })

  it('⑥ 源锁:oss.ts 该端点段落不再投影 config、不再调用 findOssDriverById', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../src/routes/oss.ts', import.meta.url)),
      'utf8',
    )
    const start = source.indexOf("'/oss/download/:id'")
    const end = source.indexOf("'/oss/sts'", start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)

    const segment = source.slice(start, end)
    expect(segment).not.toMatch(/config\s*:/)
    expect(segment).not.toContain('findOssDriverById')
    expect(segment).toContain('501')
  })
})
