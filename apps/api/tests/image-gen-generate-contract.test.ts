// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/image-gen/generate 契约收口用例(票:两端发 {prompt,size} 而后端只认
 * {content,agentId} ⇒ 该功能全端 400)。
 *
 * 2026-10-18 机主拍板「先修契约 + 显式报未接通」(不新增生成能力,§24):本文件锁四件事 ——
 *   ① 两端现发的形态(prompt + size)不再 400;
 *   ② 请求不带可渲染 imageUrl 时 ⇒ 503 + 稳定码 CAPABILITY_UNAVAILABLE + message 原文
 *      (不伪造"已生成",成功路径结构性进不来);
 *   ③ 旧 content 形态不带可渲染 imageUrl ⇒ **一并显式报未接通**(票面"响应侧同错"的另一半:
 *      旧实现回 201+{item},两端把 data.imageUrl=undefined 当成功用 ⇒ 渲染空图/保存失败;
 *      仓内除两端外无 content 形态调用方,假成功不是要兼容的行为,是要修的行为)。
 *      带 imageUrl 的请求才落库,且响应回 imageUrl 键(生成链路接通后的正向通路)。
 *   ④ 未接通那条路径**不得落库**(§5「身份/副作用不成对」同一条纪律的反面:被拒的请求
 *      不能留下半截 aiGcContent 行)。
 * 夹具形态与同目录 image-gen-favorites.test.ts 逐字同族(mockAuthenticate + 链式 db 队列),
 * 不另造第二套判据(§22c)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, insertCalls, dbQueue } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  insertCalls: { count: 0 },
  dbQueue: { items: [] as unknown[][] },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
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
    server.setErrorHandler((err, _request, reply) => {
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
  })

  it('两端现发形态 {prompt,size} 不带图 → 不再 400,而是 503 + CAPABILITY_UNAVAILABLE', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1024x1024' },
    })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.code).toBe(503)
    expect(body.errorCode).toBe('CAPABILITY_UNAVAILABLE')
    // message 必须原文含「未接通」:端上直接透出这句话,用户看到的不是"参数错误"也不是空toast
    expect(body.message).toContain('未接通')
  })

  it('未接通路径不得落库(反向锁:被拒的请求不能留下半截生成记录)', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { prompt: '一只猫', size: '1024x1024' },
    })
    expect(res.statusCode).toBe(503)
    expect(insertCalls.count).toBe(0)
  })

  it('旧 {content} 形态不带可渲染 imageUrl → 同样显式报未接通 503(不再假成功 201 让端上把 undefined 当图)', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/image-gen/generate`,
      payload: { content: '画一座山' },
    })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.errorCode).toBe('CAPABILITY_UNAVAILABLE')
    // 被拒的请求不得留下半截 aiGcContent 行
    expect(insertCalls.count).toBe(0)
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
