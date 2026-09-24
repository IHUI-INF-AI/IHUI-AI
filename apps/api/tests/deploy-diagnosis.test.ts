// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// P2-13 管理台 AI 部署诊断路由回归。
// 这枚路由是从孤儿工作树迁回来的，迁回时仓里对它零测试 —— 本文件同时是"迁来的代码
// 真按契约跑"的证据，而不只是编译通过。两条最容易被迁移抹掉的性质单独钉死：
// ① 鉴权必须先于参数校验（§5 鉴权面纪律，fail-open 会崩在鉴权层后面）；
// ② 参数被拒时**不得**触达 ai-service（否则未登录者可拿它当付费模型的放大器）。
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockRequireAdmin, capturedFetch } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  capturedFetch: { calls: [] as { path: string; body: string }[] },
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// requireAdmin 替身：抛错即路由映射 401/403；记录调用顺序用于"鉴权前置"断言
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: mockRequireAdmin,
}))

// ai-service 出口替身：按队列吐 Response，并留下游实际收到的 path/body
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(async (_req: unknown, path: string, init: { body?: string }) => {
    capturedFetch.calls.push({ path, body: String(init.body ?? '') })
    const next = capturedFetch.queue.shift()
    if (next instanceof Error) throw next
    return new Response(JSON.stringify(next), {
      status: next?.__status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }),
}))

// 让 queue 挂到 mock 上（vi.hoisted 里不能引用后面的变量）
const queue: unknown[] = []
capturedFetch.queue = queue

import { deployDiagnosisRoutes } from '../src/routes/deploy-diagnosis'

interface DiagnosisResponse {
  code: number
  message: string
  data?: {
    report: {
      rootCause: string
      impact: string
      fixCommands: string[]
      summary: string
      parseOk: boolean
      raw?: string
    }
    model: string | null
    durationMs: number
  }
}

const UPSTREAM = '/api/llm/complete'

describe('deploy-diagnosis 路由（管理台 AI 部署诊断，迁自孤儿工作树）', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(deployDiagnosisRoutes, { prefix: '/api/admin' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    queue.length = 0
    capturedFetch.calls.length = 0
    mockRequireAdmin.mockReset()
    mockRequireAdmin.mockImplementation(async () => {})
  })

  it('非管理员：preHandler 拒掉，且一次都不碰 ai-service', async () => {
    mockRequireAdmin.mockImplementation(async () => {
      throw Object.assign(new Error('需要管理员权限'), { statusCode: 403 })
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { logTail: 'boom' },
    })
    expect(res.statusCode).toBe(403)
    expect(capturedFetch.calls).toHaveLength(0)
  })

  it('四项输入全空 → 400，且不进上游（否则空 body 也烧一次模型调用）', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect((res.json() as DiagnosisResponse).code).toBe(400)
    expect(capturedFetch.calls).toHaveLength(0)
  })

  it('字段超长 / 类型错 → 400 且不进上游（长度上限必须在转发前生效）', async () => {
    for (const payload of [
      { logTail: 'x'.repeat(50_001) },
      { deployResult: 123 },
      { fix: '未知键不参与但类型须合法' },
    ]) {
      const bad = 'logTail' in payload ? { logTail: 'x'.repeat(50_001) } : payload
      const res = await server.inject({
        method: 'POST',
        url: '/api/admin/deploy-diagnosis',
        payload: bad as Record<string, unknown>,
      })
      // 第三例是"无有效输入"，同样必须 400
      expect(res.statusCode).toBe(400)
    }
    expect(capturedFetch.calls).toHaveLength(0)
  })

  it('正常路径：剥 ```json 围栏后解析，回 report/model/durationMs，且只打一次上游', async () => {
    queue.push({
      content:
        '```json\n{"rootCause":"镜像层缓存失效","impact":"api 启动慢","fixCommands":["docker compose build --no-cache api","docker compose up -d api"],"summary":"重建镜像"}\n```',
      model: 'gpt-4o-mini',
    })
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { logTail: 'Error: image not found', containerLogs: 'restart loop' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as DiagnosisResponse
    expect(body.code).toBe(0)
    expect(body.data?.report.parseOk).toBe(true)
    expect(body.data?.report.rootCause).toBe('镜像层缓存失效')
    expect(body.data?.report.fixCommands).toEqual([
      'docker compose build --no-cache api',
      'docker compose up -d api',
    ])
    expect(body.data?.model).toBe('gpt-4o-mini')
    expect(typeof body.data?.durationMs).toBe('number')
    expect(capturedFetch.calls).toHaveLength(1)
    expect(capturedFetch.calls[0]?.path).toBe(UPSTREAM)
  })

  it('缺失的输入段以 [缺失] 显式标注送给模型，而不是留空串（模型要能区分"没采到"与"内容为空"）', async () => {
    queue.push({
      content: '{"rootCause":"a","impact":"b","fixCommands":[],"summary":"c"}',
      model: null,
    })
    await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { healthJson: '{"ok":true}' },
    })
    const sent = capturedFetch.calls[0]?.body ?? ''
    expect(sent).toContain('健康检查输出')
    // 未提供的三项各自那一行必须标 [缺失]，而不是整段消失（数总数会被开头说明行里的
    // "（标注 [缺失] 的源取不到…）"多算一次，逐段点名才是本意）
    expect(sent).toContain('=== 部署结果 === [缺失]')
    expect(sent).toContain('=== 部署日志尾部 === [缺失]')
    expect(sent).toContain('=== 容器日志 === [缺失]')
    expect(sent).not.toContain('=== 健康检查输出 === [缺失]')
  })

  it('模型返回不可解析文本 → parseOk:false 且原文落 raw，仍是 200（不塌成 500）', async () => {
    queue.push({ content: '部署看起来是正常的', model: 'x' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { logTail: 'x' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as DiagnosisResponse
    expect(body.data?.report.parseOk).toBe(false)
    expect(body.data?.report.raw).toBe('部署看起来是正常的')
    expect(body.data?.report.fixCommands).toEqual([])
  })

  it('fixCommands 里的垃圾条目必须丢掉：null / 布尔 / 对象 / 空串都不许变成"看着像命令"的文案', async () => {
    queue.push({ content: '{"fixCommands":[123,"",null,true,{"a":1}," systemctl restart api "]}' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { logTail: 'x' },
    })
    const body = res.json() as DiagnosisResponse
    // 曾经的行为是 String() 一切 ⇒ ["123","null","true","[object Object]", …]，
    // 管理员照抄就会往服务器上敲一条 "null"。
    expect(body.data?.report.fixCommands).toEqual(['123', ' systemctl restart api '])
  })

  it('上游返回 error 字段 → 502 并带上游给的原因（不得冒 200）', async () => {
    queue.push({ __status: 200, error: 'quota exceeded', error_message: '额度耗尽' })
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { logTail: 'x' },
    })
    expect(res.statusCode).toBe(502)
    expect((res.json() as DiagnosisResponse).message).toBe('额度耗尽')
  })

  it('ai-service 抛错（不可达）→ 502 且原因写清是"不可达"，不是静默 500', async () => {
    queue.push(new Error('connect ECONNREFUSED 127.0.0.1:8803'))
    const res = await server.inject({
      method: 'POST',
      url: '/api/admin/deploy-diagnosis',
      payload: { logTail: 'x' },
    })
    expect(res.statusCode).toBe(502)
    expect((res.json() as DiagnosisResponse).message).toContain('ai-service 不可达')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
