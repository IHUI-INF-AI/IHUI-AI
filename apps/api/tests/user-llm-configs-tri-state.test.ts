// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

/**
 * G-644 分层配置的三态补丁:PUT /llm-configs/:id 的 apiKey
 *   undefined=未触碰 / null=显式清除 / ''=沿用;
 * 且存量 extraConfig 为坏 JSON 时**点名 500 拒绝**,不得静默 ignore 后整体覆写。
 */

const selectChain = { from: () => selectChain, where: () => selectChain, limit: () => selectChain, orderBy: () => selectChain }
const updateCaptured: { set: Record<string, unknown>; where: unknown }[] = []
const updateChain = { set: (s: Record<string, unknown>) => { updateCaptured.push({ set: s, where: null }); return updateChain }, where: () => updateChain }
const insertChain = { values: () => insertChain, returning: () => [{ id: 1 }] }

let existingRow: Record<string, unknown> | null = null

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({ ...selectChain, from: () => ({ ...selectChain, where: () => ({ ...selectChain, limit: () => (existingRow ? [existingRow] : []) }) }) }),
    update: () => ({ ...updateChain }),
    insert: () => ({ ...insertChain }),
  },
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => { request.userId = 'user-1' },
}))
vi.mock('../src/utils/ai-service-fetch.js', () => ({ aiServiceSystemFetch: async () => ({ ok: true }) }))

const { userLlmConfigRoutes } = await import('../src/routes/user-llm-configs.js')

describe('G-644 PUT /llm-configs/:id 三态补丁', () => {
  const server = Fastify({ logger: false })
  beforeAll(async () => {
    await server.register(userLlmConfigRoutes, { prefix: '/api/user' })
    await server.ready()
  })
  afterAll(async () => { await server.close() })

  const put = (body: unknown) =>
    server.inject({ method: 'PUT', url: '/api/user/llm-configs/1', payload: body })

  it('apiKey:null ⇒ 显式清除(写 null,不是"未触碰")', async () => {
    updateCaptured.length = 0
    existingRow = { id: 1, ownerUuid: 'user-1', apiKeyEnc: 'enc-old', extraConfig: null }
    const r = await put({ apiKey: null })
    expect(r.statusCode).toBe(200)
    expect(updateCaptured).toHaveLength(1)
    expect(updateCaptured[0].set.apiKeyEnc).toBeNull()
  })

  it("apiKey:'' ⇒ 沿用(set 里不得出现 apiKeyEnc 键)", async () => {
    updateCaptured.length = 0
    existingRow = { id: 1, ownerUuid: 'user-1', apiKeyEnc: 'enc-old', extraConfig: null }
    const r = await put({ apiKey: '' })
    expect(r.statusCode).toBe(200)
    expect(updateCaptured).toHaveLength(1)
    expect('apiKeyEnc' in updateCaptured[0].set).toBe(false)
  })

  it('apiKey 非空串 ⇒ 加密写入(值是 encryptJSON 的 JSON 串)', async () => {
    updateCaptured.length = 0
    existingRow = { id: 1, ownerUuid: 'user-1', apiKeyEnc: null, extraConfig: null }
    const r = await put({ apiKey: 'sk-new-value' })
    expect(r.statusCode).toBe(200)
    expect(typeof updateCaptured[0].set.apiKeyEnc).toBe('string')
    expect(updateCaptured[0].set.apiKeyEnc).not.toContain('sk-new-value')
  })

  it('不传 apiKey ⇒ 未触碰(set 里无该键)——三态的另一半', async () => {
    updateCaptured.length = 0
    existingRow = { id: 1, ownerUuid: 'user-1', apiKeyEnc: 'enc-old', extraConfig: null }
    const r = await put({ name: '新名字' })
    expect(r.statusCode).toBe(200)
    expect('apiKeyEnc' in updateCaptured[0].set).toBe(false)
  })

  it('存量 extraConfig 是坏 JSON 且要改 contextLength ⇒ 点名 500 拒绝,不静默整体覆写', async () => {
    updateCaptured.length = 0
    existingRow = { id: 1, ownerUuid: 'user-1', apiKeyEnc: 'enc-old', extraConfig: '{not-json' }
    const r = await put({ contextLength: 8192 })
    expect(r.statusCode).toBe(500)
    expect(r.json().message).toContain('损坏')
    expect(updateCaptured).toHaveLength(0) // 关键:一次 update 都没发
  })

  it('存量 extraConfig 合法 ⇒ 正常合并 contextLength 后写入', async () => {
    updateCaptured.length = 0
    existingRow = { id: 1, ownerUuid: 'user-1', apiKeyEnc: 'enc-old', extraConfig: '{"foo":"keep-me"}' }
    const r = await put({ contextLength: 8192 })
    expect(r.statusCode).toBe(200)
    const extra = JSON.parse(String(updateCaptured[0].set.extraConfig))
    expect(extra).toEqual({ foo: 'keep-me', contextLength: 8192 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
