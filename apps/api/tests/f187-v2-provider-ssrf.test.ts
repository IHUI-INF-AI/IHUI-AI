// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-187 夹具:v2 创建/更新 LLM provider 时,用户自定义 baseUrlOverride 必须过 SSRF 守卫。
 *
 * 原缺陷:v1 保存链已接 assertSafeFetchUrl,v2 的 POST/PUT /llm-providers 保存链全程无守卫,
 * 内网/云元数据地址原样落库并成为 ai-service 的 api_base。
 * 本夹具用字面 IP(169.254.169.254 / 127.0.0.1 / 10.0.0.5)触发 ssrf-guard 的解析级拦截
 * (字面 IP 不发起 DNS),断言保存被 400 拒绝且不落库。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const store = vi.hoisted(() => ({
  inserted: [] as Array<Record<string, unknown>>,
  updated: [] as Array<Record<string, unknown>>,
}))

vi.mock('../src/db/index.js', () => {
  const existingRow = { id: 9, userUuid: 'u1', providerCode: 'custom', baseUrl: 'https://api.example.com/v1', apiFormat: 'openai' }
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    chain.values = (v: Record<string, unknown>) => {
      store.inserted.push(v)
      return { returning: async () => [{ id: 1, ...v }] }
    }
    chain.set = (v: Record<string, unknown>) => {
      store.updated.push(v)
      return { where: () => Promise.resolve([]) }
    }
    chain.where = () => chain
    chain.from = () => chain
    chain.returning = async () => [existingRow]
    chain.limit = async () => [existingRow]
    return chain
  }
  return { db: { insert: () => makeChain(), update: () => makeChain(), select: () => makeChain() } }
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u1'
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: { userId?: string }) => {
    request.userId = 'u1'
  }),
  isSystemAdmin: () => false,
  requireAdmin: vi.fn(),
}))

import { userLlmConfigV2Routes } from '../src/routes/user-llm-configs-v2.js'

describe('F-187 v2 provider 保存链 SSRF 守卫', () => {
  let app: FastifyInstance
  beforeEach(async () => {
    store.inserted.length = 0
    store.updated.length = 0
    app = Fastify({ logger: false })
    await app.register(userLlmConfigV2Routes)
    await app.ready()
  })

  it('创建 provider 填云元数据地址被 400 拒绝且不落库', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/llm-providers',
      payload: { providerCode: 'custom', name: 'x', apiKey: 'sk-test', baseUrlOverride: 'http://169.254.169.254/v1' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('SSRF blocked')
    expect(store.inserted.length).toBe(0)
  })

  it('创建 provider 填回环地址被拒绝', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/llm-providers',
      payload: { providerCode: 'custom', name: 'x', apiKey: 'sk-test', baseUrlOverride: 'http://127.0.0.1:6379' },
    })
    expect(res.statusCode).toBe(400)
    expect(store.inserted.length).toBe(0)
  })

  it('更新 provider baseUrl 为内网地址被拒绝且不写库', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/llm-providers/9',
      payload: { baseUrlOverride: 'http://10.0.0.5/v1' },
    })
    if (res.statusCode !== 400) {
      console.error('UPDATE_DEBUG', res.statusCode, res.body)
    }
    expect(res.statusCode).toBe(400)
    expect(res.body).toContain('SSRF blocked')
    expect(store.updated.length).toBe(0)
  })
})
