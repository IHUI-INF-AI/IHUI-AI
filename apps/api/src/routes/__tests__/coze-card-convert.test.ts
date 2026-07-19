import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'test-user-id'
    return { userId: 'test-user-id' } as never
  }),
}))

vi.mock('../../plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

import { cozeRoutes } from '../coze.js'

describe('Coze Card Convert API (POST /api/coze/card/convert)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cozeRoutes, { prefix: '/api/coze' })
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
  })

  it('未登录返回 401', async () => {
    mockAuthenticate.mockImplementation(async () => {
      const err = new Error('Authentication required')
      ;(err as Error & { statusCode: number }).statusCode = 401
      throw err
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: {} },
    })
    expect(res.statusCode).toBe(401)
  })

  it('空 payload {}: z.unknown() 接受 undefined, 返回 error="Invalid card data"', async () => {
    // z.object({ card: z.unknown() }) 中 z.unknown() 接受任意值含 undefined,
    // 因此 {} 通过校验, card=undefined, 函数走 else 分支返回 Invalid card data
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: {},
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.error).toBe('Invalid card data')
  })

  it('payload 为非对象 (string) 返回 400 参数错误', async () => {
    // Fastify 默认仅解析 application/json / text/plain; 显式声明 text/plain 后,
    // 请求体为字符串, Zod z.object() 拒绝非对象输入 -> 路由返回 400
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      headers: { 'content-type': 'text/plain' },
      payload: 'not-an-object',
    })
    expect(res.statusCode).toBe(400)
  })

  it('正常卡片转换: elements Text 提取文本 (type=text)', async () => {
    const card = {
      x_properties: { card_id: 'cid-1', card_version_code: 'v1' },
      data: JSON.stringify({
        elements: {
          el1: {
            type: '@flowpd/cici-components/Text',
            props: { content: { type: 'expression', value: 'Hello World' } },
          },
        },
        variables: {},
      }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.type).toBe('text')
    expect(body.data.content).toBe('Hello World')
    expect(body.data.metadata).toEqual({ card_id: 'cid-1', card_version: 'v1' })
  })

  it('elements NewImage 提取图片 URL (type=multimodal)', async () => {
    const card = {
      data: JSON.stringify({
        elements: {
          img1: {
            type: '@flowpd/cici-components/NewImage',
            props: { src: 'https://example.com/img.png' },
          },
        },
        variables: {},
      }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.type).toBe('multimodal')
    expect(body.data.content).toContain('图片: https://example.com/img.png')
  })

  it('variables video_url 提取 (type=multimodal, content 含 "视频: ...")', async () => {
    const card = {
      data: JSON.stringify({
        elements: {},
        variables: {
          v1: { name: 'video_url', defaultValue: 'https://example.com/v.mp4' },
        },
      }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.type).toBe('multimodal')
    expect(body.data.content).toContain('视频: https://example.com/v.mp4')
  })

  it('info_in_card fallback: variables 中无 video_url 时从 info_in_card 提取', async () => {
    const card = {
      info_in_card: 'title, https://example.com/info-video.mp4',
      data: JSON.stringify({ elements: {}, variables: {} }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.type).toBe('multimodal')
    expect(body.data.content).toContain('视频: https://example.com/info-video.mp4')
  })

  it('response_for_model fallback: 无 elements/variables/media 时使用第二段', async () => {
    const card = {
      response_for_model: '描述文本, https://example.com/fallback-url',
      data: JSON.stringify({ elements: {}, variables: {} }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.content).toBe('https://example.com/fallback-url')
    expect(body.data.type).toBe('text')
  })

  it('response_for_model fallback: 单段时使用第一段', async () => {
    const card = {
      response_for_model: 'only-part',
      data: JSON.stringify({ elements: {}, variables: {} }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.content).toBe('only-part')
  })

  it('card_type==3 视频卡片特殊处理 (type=url, content=videoUrl)', async () => {
    const card = {
      card_type: 3,
      data: JSON.stringify({
        elements: {},
        variables: {
          v1: { name: 'video_url', defaultValue: 'https://example.com/video-card.mp4' },
        },
      }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.type).toBe('url')
    expect(body.data.content).toBe('https://example.com/video-card.mp4')
  })

  it('stream_plugin_finish 嵌套结构: 提取内嵌 card_type JSON 后用 response_for_model fallback', async () => {
    // 嵌套 JSON 内必须含 data 字段(值为可解析为空对象的字符串),让函数进入内容提取块;
    // elements/variables 均空 -> contentParts 为空 -> 触发 response_for_model fallback
    const streamCard = {
      msg_type: 'stream_plugin_finish',
      data: 'plugin output: {"card_type":1,"x_properties":{"card_id":"cid-stream"},"response_for_model":"text, https://example.com/stream-url","data":"{}"}',
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: streamCard },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.metadata).toEqual({ card_id: 'cid-stream', card_version: undefined })
    expect(body.data.content).toBe('https://example.com/stream-url')
  })

  it('无效 JSON 字符串输入返回 error="Invalid JSON data"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: 'not-a-json-string' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.error).toBe('Invalid JSON data')
    expect(body.data.content).toBe('')
  })

  it('JSON 字符串解析为数组返回 error="Invalid JSON data"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: '[1,2,3]' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.error).toBe('Invalid JSON data')
  })

  it('无效 card 类型 (number) 返回 error="Invalid card data"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: 12345 },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.error).toBe('Invalid card data')
  })

  it('无效 card 类型 (null) 返回 error="Invalid card data"', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: null },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.error).toBe('Invalid card data')
  })

  it('data 字段为非 JSON 字符串返回 error="Failed to parse card data"', async () => {
    const card = { data: 'not-a-json' }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.error).toBe('Failed to parse card data')
  })

  it('空 elements/variables 返回默认消息 "卡片内容处理完成"', async () => {
    const card = {
      data: JSON.stringify({ elements: {}, variables: {} }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.content).toBe('卡片内容处理完成')
    expect(body.data.type).toBe('text')
  })

  it('card 输入为合法 JSON 字符串 (object 形式) 正常解析', async () => {
    const cardObj = {
      data: JSON.stringify({
        elements: {
          el1: {
            type: '@flowpd/cici-components/Text',
            props: { content: { type: 'expression', value: 'From String' } },
          },
        },
        variables: {},
      }),
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/coze/card/convert',
      payload: { card: JSON.stringify(cardObj) },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.content).toBe('From String')
  })
})
