// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/image-gen/generate 契约收口用例(票:两端发 {prompt,size} 而后端只认
 * {content,agentId} ⇒ 该功能全端 400)。
 *
 * 2026-10-18 机主拍板「先修契约」。契约在 2026-11-21 又推进了一格:出图链路真接通
 * Agnes(/v1/images/generations),503 CAPABILITY_UNAVAILABLE 的"未接通"档已撤销 ⇒ 本文件改锁:
 *   ① 两端现发的形态(prompt + size)不再 400,而是真调上游、回 201 + 可渲染 imageUrl;
 *   ② 上游报错 / 上游没回可渲染地址 ⇒ 502(唯一剩下的 5xx 形态),且**绝不伪造 imageUrl**
 *      冒充成功、**不得落库**(被拒的请求不能留下半截 aiGcContent 行);
 *   ③ 旧 content 形态随之走同一条生成链路(假成功 201+undefined 不是要兼容的行为,是要修的行为);
 *   ④ 显式给 imageUrl 的请求不调上游、不扣费(转存/引用不是生成)。
 * 夹具形态与同目录 image-gen-favorites.test.ts 逐字同族(mockAuthenticate + 链式 db 队列),
 * 上游与计费各自换成可控替身 —— 不另造第二套判据(§22c)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

const { mockAuthenticate, insertCalls, dbQueue, mockCallVendor } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  insertCalls: { count: 0 },
  dbQueue: { items: [] as unknown[][] },
  mockCallVendor: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 出图链路自 2026-11-21 起真调 Agnes(/v1/images/generations):测试必须把上游换成可控替身,
// 否则每条用例都会打到真网络 —— 结果取决于凭据与配额,不是取决于被审的判据。
vi.mock('../src/routes/ai-vendors/_shared.js', () => ({
  callVendor: mockCallVendor,
  recordUsage: vi.fn(),
  VENDORS: { agnes: { baseUrl: 'https://agnes.example.test/v1' } },
}))

// 计费预检/扣分只在文档层面属于本票:余额不足时它自己回 402(另一条判据),
// 本用例集合只管"入参形态 → 上游 → 落库"的契约,故固定返回放行。
vi.mock('../src/services/media-billing.js', () => ({
  ensureMediaPointsBalance: vi.fn(async () => true),
  chargeMediaPoints: vi.fn(async () => true),
}))

vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'innerJoin',
      'select',
    ]) {
      chain[m] = () => chain
    }
    return chain
  }
  const factory = () => createChain()
  const dbMock = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(factory),
    // insert 单独计次:未接通路径必须证明"一次都没落库",而队列取空只能证明"没读到东西"。
    insert: vi.fn(() => {
      insertCalls.count += 1
      return factory()
    }),
    update: vi.fn(factory),
    delete: vi.fn(factory),
  }
  return { db: dbMock, dbRead: dbMock }
})

import { imageGenRoutes } from '../src/routes/other/image-gen-routes.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const PREFIX = '/api'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function enqueue(...results: unknown[][]) {
  dbQueue.items.push(...results)
}

describe('image-gen generate route — POST /api/image-gen/generate', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err: FastifyError, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    // 直挂本路由(不挂整个 other/index.ts):其余兄弟路由各有自己的 import-time db 依赖,
    // 本票只测 generate 一条,挂整簇会把别的面的在飞问题读进本用例(与立因无关的噪声)。
    await server.register(imageGenRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    dbQueue.items.length = 0
    insertCalls.count = 0
    mockAuthenticate.mockReset()
    mockCallVendor.mockReset()
  })

  it('两端现发形态 {prompt,size} 不带图 → 不再 400,真调上游出图并回 201 + imageUrl', async () => {
    mockAuthed()
    mockCallVendor.mockResolvedValueOnce({ data: [{ url: 'https://cdn.example.com/gen.png' }] })
    const item = { id: 'gc-1', gcType: 'image', content: '一只猫', status: 1 }
    enqueue([item])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1024x1024' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.imageUrl).toBe('https://cdn.example.com/gen.png')
    expect(body.data.item).toEqual(item)
    expect(insertCalls.count).toBe(1)
  })

  it('上游报错 → 502 且不落库(被拒的请求不能留下半截生成记录)', async () => {
    mockAuthed()
    mockCallVendor.mockResolvedValueOnce({ error: { message: 'quota exceeded' } })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1024x1024' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('图像生成失败')
    expect(insertCalls.count).toBe(0)
  })

  it('上游没回可渲染地址 → 502 且不落库(绝不伪造 imageUrl 冒充成功)', async () => {
    mockAuthed()
    mockCallVendor.mockResolvedValueOnce({ data: [] })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1024x1024' },
    })
    expect(res.statusCode).toBe(502)
    expect(insertCalls.count).toBe(0)
  })

  it('旧 {content} 形态同样走出图链路(不再假成功 201 让端上把 undefined 当图)', async () => {
    mockAuthed()
    mockCallVendor.mockResolvedValueOnce({ data: [{ url: 'https://cdn.example.com/gen2.png' }] })
    const item = { id: 'gc-2', gcType: 'image', content: '画一座山', status: 1 }
    enqueue([item])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { content: '画一座山' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.imageUrl).toBe('https://cdn.example.com/gen2.png')
    expect(insertCalls.count).toBe(1)
  })

  it('新形态带可渲染 imageUrl → 放行落库,且响应带 imageUrl(生成链路接通后的正向通路)', async () => {
    mockAuthed()
    const item = { id: 'gc-2', gcType: 'image', content: '一只猫', status: 1 }
    enqueue([item])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1024x1024', imageUrl: 'https://cdn.example.com/cat.png' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    // 两端各自声明的是 GenResult{imageUrl},这里必须回该键(票面"响应侧同错"的另一半)
    expect(body.data.imageUrl).toBe('https://cdn.example.com/cat.png')
    expect(body.data.item).toEqual(item)
    expect(insertCalls.count).toBe(1)
    // 显式给了 imageUrl(转存/引用)就不该再去调上游 —— 那不是生成,也不该扣费。
    expect(mockCallVendor).not.toHaveBeenCalled()
  })

  it('prompt 与 content 同给 → content 优先(不被 prompt 顶掉,归一化口径有唯一答案)', async () => {
    mockAuthed()
    const item = { id: 'gc-3', gcType: 'image', content: '权威侧文案', status: 1 }
    enqueue([item])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: {
        prompt: '被忽略的文案',
        content: '权威侧文案',
        imageUrl: 'https://cdn.example.com/x.png',
      },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.item).toEqual(item)
  })

  it('两形态皆缺提示词 → 仍按参数错误回 400(不能把"没内容"也归进"未接通")', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { size: '1024x1024' },
    })
    expect(res.statusCode).toBe(400)
    expect(insertCalls.count).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
