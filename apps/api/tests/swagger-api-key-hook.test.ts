// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * /docs 鉴权回归锁(2026-10-28 立)。
 *
 * 背景:`buildSwaggerApiKeyHook` 原先把 `/docs/json` 从鉴权里豁免了(理由是"方便 CI 拉
 * schema"),但仓内唯一的 spec 消费方 `scripts/export-openapi.ts` 走进程内
 * `server.swagger()`,不发 HTTP;`.github/workflows/` 与 `scripts/` 也无一处在拉该端点。
 * 于是那个豁免只剩一个效果:配置了 SWAGGER_API_KEY 也挡不住 spec 泄露,且与
 * `/docs/yaml`(一直要 key)口径不一致。本文件守:
 *   1) 未配置 key ⇒ 全放行(开发模式);
 *   2) 配置 key ⇒ /docs、/docs/json、/docs/yaml 一律要 key;
 *   3) swagger-ui 静态资源与非 /docs 路径不受影响(别把门关到全站)。
 */
import { afterEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { buildSwaggerApiKeyHook } from '../src/plugins/swagger-theme.js'

const API_KEY = 'k'.repeat(64)

function makeReply() {
  const reply = {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      reply.statusCode = code
      return reply
    },
    send(payload: unknown) {
      reply.payload = payload
      return reply
    },
  }
  return reply
}

async function run(hook: ReturnType<typeof buildSwaggerApiKeyHook>, url: string, headers = {}) {
  const reply = makeReply()
  await hook({ url, headers } as unknown as FastifyRequest, reply as unknown as FastifyReply)
  return reply
}

describe('未配置 SWAGGER_API_KEY ⇒ 全放行(开发模式)', () => {
  const hook = buildSwaggerApiKeyHook('')

  it.each(['/docs', '/docs/json', '/docs/yaml', '/docs/static/swagger-ui.css'])(
    '%s 无需 key',
    async (url) => {
      expect((await run(hook, url)).statusCode).toBe(200)
    },
  )
})

describe('配置 SWAGGER_API_KEY ⇒ 文档面一律要 key', () => {
  const hook = buildSwaggerApiKeyHook(API_KEY)
  const ok = { 'x-api-key': API_KEY }

  it.each(['/docs', '/docs/json', '/docs/yaml'])('%s 缺 key 返回 401', async (url) => {
    const reply = await run(hook, url)
    expect(reply.statusCode).toBe(401)
    expect(reply.payload).toMatchObject({ code: 401 })
  })

  it.each(['/docs', '/docs/json', '/docs/yaml'])('%s 带正确 key 放行', async (url) => {
    expect((await run(hook, url, ok)).statusCode).toBe(200)
  })

  it('/docs/json 带查询串仍要 key(查询串不得成为绕过面)', async () => {
    expect((await run(hook, '/docs/json?foo=1')).statusCode).toBe(401)
    expect((await run(hook, '/docs/json?foo=1', ok)).statusCode).toBe(200)
  })

  it('等长但错误的 key ⇒ 401(时序安全比较路径)', async () => {
    expect((await run(hook, '/docs/json', { 'x-api-key': 'x'.repeat(64) })).statusCode).toBe(401)
  })

  it('长度不同的 key ⇒ 401(长度先行拒绝)', async () => {
    expect((await run(hook, '/docs', { 'x-api-key': 'short' })).statusCode).toBe(401)
  })

  it('重复 header 解析成数组 ⇒ 401(只接受字符串形态)', async () => {
    expect(
      (await run(hook, '/docs', { 'x-api-key': [API_KEY, API_KEY] as unknown as string }))
        .statusCode,
    ).toBe(401)
  })
})

describe('不得误伤:静态资源与非文档路径', () => {
  const hook = buildSwaggerApiKeyHook(API_KEY)

  it.each([
    '/docs/static/swagger-ui-bundle.js',
    '/docs/static/swagger-ui.css',
    '/api/health',
    '/health',
    '/documentation',
  ])('%s 无需 key', async (url) => {
    expect((await run(hook, url)).statusCode).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// 装车验证:上面的用例直接调 hook,证明不了"hook 真的挂在 /docs/json 上"。
// 这里起真实 @fastify/swagger + @fastify/swagger-ui,用 inject 打真实路由。
// 依据:@fastify/swagger-ui/lib/routes.js 的 `/json` 路由带 `...hooks`。
// ---------------------------------------------------------------------------
describe('装车验证:真实 swagger-ui 路由受同一道闸保护', () => {
  const apps: FastifyInstance[] = []

  afterEach(async () => {
    while (apps.length > 0) await apps.pop()!.close()
  })

  async function buildDocsApp(apiKey: string) {
    const app = Fastify({ logger: false })
    await app.register(swagger, {
      openapi: { info: { title: 'hook-test', version: '1.0.0' } },
    })
    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiHooks: { onRequest: buildSwaggerApiKeyHook(apiKey) },
    })
    app.get('/ping', async () => ({ ok: true }))
    await app.ready()
    apps.push(app)
    return app
  }

  it('未配置 key:/docs 与 /docs/json 都直接 200', async () => {
    const app = await buildDocsApp('')
    expect((await app.inject('/docs')).statusCode).toBe(200)
    expect((await app.inject('/docs/json')).statusCode).toBe(200)
  })

  it('配置 key:/docs/json 无 key 必须 401(旧实现此处是 200)', async () => {
    const app = await buildDocsApp(API_KEY)
    expect((await app.inject('/docs/json')).statusCode).toBe(401)
    expect((await app.inject('/docs/json')).json()).toMatchObject({ code: 401 })
  })

  it('配置 key:/docs/json 带正确 key 返回 200 且是 OpenAPI 文档', async () => {
    const app = await buildDocsApp(API_KEY)
    const res = await app.inject({ url: '/docs/json', headers: { 'x-api-key': API_KEY } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ openapi: expect.stringContaining('3.') })
  })

  it('配置 key:/docs/yaml 与 /docs 同样 401(三面口径一致)', async () => {
    const app = await buildDocsApp(API_KEY)
    expect((await app.inject('/docs/yaml')).statusCode).toBe(401)
    expect((await app.inject('/docs')).statusCode).toBe(401)
  })

  it('配置 key:/docs/static/* 仍公开(UI 能加载,页面不会白屏)', async () => {
    const app = await buildDocsApp(API_KEY)
    expect((await app.inject('/docs/static/swagger-ui.css')).statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
