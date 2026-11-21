// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/image-gen/generate 契约收口用例(票:两端发 {prompt,size} 而后端只认
 * {content,agentId} ⇒ 该功能全端 400)。
 *
 * 2026-11-21 出图链路接通后(无现成 imageUrl 的请求真调 Agnes /v1/images/generations),
 * 本文件锁四件事:
 *   ① 两端现发的形态(prompt + size)不再 400,成功路径回 201 + 可渲染 imageUrl;
 *   ② 上游失败(返回 error / 没有可渲染地址)⇒ 502,message 原文含「图像生成失败」,
 *      绝不伪造地址冒充成功;
 *   ③ 失败路径**不得落库、不得扣费**(被拒的请求不能留下半截 aiGcContent 行或扣掉积分);
 *   ④ 显式带 imageUrl 的请求(转存/引用)不调上游、不预检不计费,只落库回 201。
 * 上游与计费两条外部腿用 vi.mock 换可控替身 —— 打真网络会把"上游失败回 502"变成
 * 取决于 AGNES_API_KEY 与网络,那不是被测的行为。
 * 夹具形态与同目录 image-gen-favorites.test.ts 逐字同族(mockAuthenticate + 链式 db 队列),
 * 不另造第二套判据(§22c)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyError } from 'fastify'

const { mockAuthenticate, insertCalls, dbQueue, mockCallVendor, mockRecordUsage, mockCharge, mockEnsure } =
  vi.hoisted(() => ({
    mockAuthenticate: vi.fn(),
    insertCalls: { count: 0 },
    dbQueue: { items: [] as unknown[][] },
    mockCallVendor: vi.fn(),
    mockRecordUsage: vi.fn(),
    mockCharge: vi.fn(async () => true),
    mockEnsure: vi.fn(async () => true),
  }))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 上游与计费两条外部腿换成可控替身:打真网络会让"上游失败回 502"这条判据变成
// 取决于 AGNES_API_KEY 与网络,而那不是被测的行为(2026-11-21 出图链路接通后必须锁它)。
vi.mock('../src/routes/ai-vendors/_shared.js', () => ({
  callVendor: mockCallVendor,
  recordUsage: mockRecordUsage,
  VENDORS: { agnes: { baseUrl: 'https://agnes.example.test/v1' } },
}))

vi.mock('../src/services/media-billing.js', () => ({
  ensureMediaPointsBalance: mockEnsure,
  chargeMediaPoints: mockCharge,
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
    mockCharge.mockClear()
    mockEnsure.mockClear()
  })

  it('两端现发形态 {prompt,size} → 真调上游出图,回 201 + 可渲染 imageUrl', async () => {
    mockAuthed()
    const item = { id: 'gc-1', gcType: 'image', content: '一只猫', status: 1 }
    enqueue([item])
    mockCallVendor.mockResolvedValue({ data: [{ url: 'https://agnes.example.test/out.png' }] })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1K' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.code).toBe(0)
    // 两端各自声明的是 GenResult{imageUrl},这里必须回该键(票面"响应侧同错"的另一半)
    expect(body.data.imageUrl).toBe('https://agnes.example.test/out.png')
    expect(body.data.item).toEqual(item)
    expect(insertCalls.count).toBe(1)
    // 尺寸档只透传上游认识的 1K/2K/3K/4K;1024x1024 这类会被上游 400
    expect(mockCallVendor).toHaveBeenCalledTimes(1)
    const arg = mockCallVendor.mock.calls[0]!
    expect(String(arg[1])).toBe('https://agnes.example.test/v1/images/generations')
    expect(JSON.parse(String((arg[3] as { body: string }).body)).size).toBe('1K')
  })

  it('上游返回 error → 502,且零落库、零扣费(绝不伪造地址冒充成功)', async () => {
    mockAuthed()
    mockCallVendor.mockResolvedValue({ error: { message: 'upstream quota exceeded' } })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫' },
    })
    expect(res.statusCode).toBe(502)
    expect(res.json().message).toContain('图像生成失败')
    expect(insertCalls.count).toBe(0)
    expect(mockCharge).not.toHaveBeenCalled()
  })

  it('上游没给出可渲染地址 → 502,零落库(空 data 不是成功)', async () => {
    mockAuthed()
    mockCallVendor.mockResolvedValue({ data: [] })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫' },
    })
    expect(res.statusCode).toBe(502)
    expect(insertCalls.count).toBe(0)
  })

  it('旧 {content} 形态同样走出图链路并回 imageUrl(不再假成功让端上把 undefined 当图)', async () => {
    mockAuthed()
    const item = { id: 'gc-3', gcType: 'image', content: '画一座山', status: 1 }
    enqueue([item])
    mockCallVendor.mockResolvedValue({ data: [{ b64_json: 'iVBORw0KGgo=' }] })
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { content: '画一座山' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.imageUrl).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(body.data.item).toEqual(item)
    // b64 也要落库(content 存的是提示词,不是地址)
    expect(insertCalls.count).toBe(1)
  })

  it('显式带 imageUrl → 不调上游、不预检不计费,直接落库回 201', async () => {
    mockAuthed()
    const item = { id: 'gc-2', gcType: 'image', content: '一只猫', status: 1 }
    enqueue([item])
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', imageUrl: 'https://cdn.example.com/cat.png' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().data.imageUrl).toBe('https://cdn.example.com/cat.png')
    expect(insertCalls.count).toBe(1)
    expect(mockCallVendor).not.toHaveBeenCalled()
    expect(mockCharge).not.toHaveBeenCalled()
  })

  it('prompt 与 content 同给 → content 优先(归一化口径有唯一答案)', async () => {
    mockAuthed()
    const item = { id: 'gc-4', gcType: 'image', content: '权威侧文案', status: 1 }
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

  it('两形态皆缺提示词 → 仍按参数错误回 400(不能把"没内容"也归进上游失败)', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { size: '1024x1024' },
    })
    expect(res.statusCode).toBe(400)
    expect(insertCalls.count).toBe(0)
    expect(mockCallVendor).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
