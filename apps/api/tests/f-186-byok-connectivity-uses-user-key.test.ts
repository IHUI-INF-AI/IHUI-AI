// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-186 回归锁(2026-11-13)。
 *
 * 病灶:BYOK 的「连通性测试」把用户 apiKey/baseUrl 丢弃,改用 ai-service 的
 * system-worker 身份(system_owner_uuid)打平台 Key ⇒ 填错 Key 也显示「连通成功」,
 * 每次测试还消耗平台额度。
 *
 * 本夹具用桩替身捕获真实下游请求的 URL 与请求头,钉住三点:
 *  1. 测试链路必须直连用户自己的 baseUrl,并带上用户自己的 apiKey;
 *  2. 用户未配置 Key/BaseUrl 时返回明确 4xx,而不是静默改走平台身份;
 *  3. 系统身份 token 不得出现在任何出站请求里,响应也不回显完整密钥。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const SYSTEM_TOKEN = 'system-worker-token-must-never-be-used'

const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  probes: [] as Array<{ url: string; init: RequestInit }>,
  systemTokenFn: vi.fn(async () => 'system-worker-token-must-never-be-used'),
}))

vi.mock('../src/utils/system-access-token.js', () => ({
  getSystemAccessToken: h.systemTokenFn,
}))

vi.mock('../src/db/index.js', () => {
  const chain: Record<string, unknown> = {}
  chain.from = () => chain
  chain.where = () => chain
  chain.orderBy = () => chain
  chain.limit = async () => h.rows
  chain.set = () => ({ where: async () => undefined })
  return {
    db: {
      select: () => chain,
      update: () => chain,
      insert: () => chain,
      execute: async () => [],
    },
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'user-1'
  },
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: async (request: { userId?: string }) => {
    request.userId = 'user-1'
  },
  isSystemAdmin: () => false,
  requireAdmin: vi.fn(),
}))

// 桩替身:截获真实下游请求的 URL/请求头,不发起网络调用
vi.mock('../src/utils/ssrf-guard.js', () => ({
  safeFetch: async (url: string, init: RequestInit = {}) => {
    h.probes.push({ url, init })
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: 'upstream-echo-model' }),
      text: async () => '{}',
    } as unknown as Response
  },
  assertSafeFetchUrl: async () => ({ safe: true }),
}))

const { userLlmConfigRoutes } = await import('../src/routes/user-llm-configs.js')
const { userLlmConfigV2Routes } = await import('../src/routes/user-llm-configs-v2.js')

function headersOf(probe: { init: RequestInit }): Record<string, string> {
  return (probe.init.headers ?? {}) as Record<string, string>
}

describe('F-186 BYOK 连通性测试必须使用用户自己的 Key/BaseUrl', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    h.rows = []
    h.probes.length = 0
    h.systemTokenFn.mockClear()
    app = Fastify({ logger: false })
    await app.register(userLlmConfigRoutes, { prefix: '/api/user' })
    await app.register(userLlmConfigV2Routes, { prefix: '/api/v2/user' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('preview-test 直连用户 baseUrl 并携带用户 apiKey', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/user/llm-configs/preview-test',
      payload: {
        templateCode: 'deepseek',
        apiKey: 'sk-user-preview-key',
        modelId: 'deepseek-chat',
        baseUrlOverride: 'https://user-llm.example.com/v1',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(h.probes).toHaveLength(1)
    const probe = h.probes[0]!
    expect(probe.url).toBe('https://user-llm.example.com/v1/chat/completions')
    expect(headersOf(probe).authorization).toBe('Bearer sk-user-preview-key')
    // 系统身份 token 不得出现在任何出站内容里
    expect(JSON.stringify({ url: probe.url, headers: probe.init.headers })).not.toContain(
      SYSTEM_TOKEN,
    )
    // 响应不得回显完整密钥
    expect(res.body).not.toContain('sk-user-preview-key')
  })

  it('已保存配置的 /:id/test 使用库里的用户 Key 与 BaseUrl', async () => {
    h.rows = [
      {
        id: 7,
        baseUrl: 'https://byok.example.com/v1',
        apiKeyEnc: 'sk-user-stored-key',
        modelIdForTest: 'gpt-4o-mini',
        providerCode: 'openai',
        apiFormat: 'openai_chat',
        name: 'my-byok',
        ownerUuid: 'user-1',
      },
    ]

    const res = await app.inject({ method: 'POST', url: '/api/user/llm-configs/7/test' })

    expect(res.statusCode).toBe(200)
    expect(h.probes).toHaveLength(1)
    const probe = h.probes[0]!
    expect(probe.url).toBe('https://byok.example.com/v1/chat/completions')
    expect(headersOf(probe).authorization).toBe('Bearer sk-user-stored-key')
    expect(JSON.stringify(probe.init.headers)).not.toContain(SYSTEM_TOKEN)
  })

  it('未配置 apiKey ⇒ 明确 400,且不发起任何下游请求', async () => {
    h.rows = [
      {
        id: 8,
        baseUrl: 'https://byok.example.com/v1',
        apiKeyEnc: null,
        modelIdForTest: 'gpt-4o-mini',
        providerCode: 'openai',
        apiFormat: 'openai_chat',
        name: 'no-key',
        ownerUuid: 'user-1',
      },
    ]

    const res = await app.inject({ method: 'POST', url: '/api/user/llm-configs/8/test' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('API Key')
    expect(h.probes).toHaveLength(0)
    expect(h.systemTokenFn).not.toHaveBeenCalled()
  })

  it('未配置 baseUrl ⇒ 明确 400,且不发起任何下游请求', async () => {
    h.rows = [
      {
        id: 9,
        baseUrl: '',
        apiKeyEnc: 'sk-user-stored-key',
        modelIdForTest: 'gpt-4o-mini',
        providerCode: 'openai',
        apiFormat: 'openai_chat',
        name: 'no-base-url',
        ownerUuid: 'user-1',
      },
    ]

    const res = await app.inject({ method: 'POST', url: '/api/user/llm-configs/9/test' })

    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('Base URL')
    expect(h.probes).toHaveLength(0)
  })

  it('v2 provider 测试同样使用用户 Key/BaseUrl', async () => {
    h.rows = [
      {
        id: 11,
        baseUrl: 'https://v2-byok.example.com/v1',
        apiKeyEnc: 'sk-user-v2-key',
        modelIdForTest: 'qwen-plus',
        providerCode: 'alibaba',
        apiFormat: 'openai_chat',
        name: 'v2-provider',
        ownerUuid: 'user-1',
      },
    ]

    const res = await app.inject({ method: 'POST', url: '/api/v2/user/llm-providers/11/test' })

    expect(res.statusCode).toBe(200)
    expect(h.probes).toHaveLength(1)
    const probe = h.probes[0]!
    expect(probe.url).toBe('https://v2-byok.example.com/v1/chat/completions')
    expect(headersOf(probe).authorization).toBe('Bearer sk-user-v2-key')
    expect(JSON.stringify(probe.init.headers)).not.toContain(SYSTEM_TOKEN)
  })
})
