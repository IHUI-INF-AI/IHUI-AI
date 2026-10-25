// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池 PUT「换 Key」的端到端 handler 测试(2026-10-24 立,配 admin-relay-key-pool-rotate.test.ts 的形状锁)。
 *
 * 形状锁只能证明"源码里写了这几行",本文件证的是**真起路由、真过 zod、真落库集合**:
 * 断言落库的密文能解回新明文(而不是把旧密文原样交回去),且健康态与连续失败计数
 * 与密文在**同一次 set** 里 —— 分两次写就会出现"密文已换、读数还红"的那个现场。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const KEY_ID = '11111111-1111-4111-8111-111111111111'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'unit-test-credentials-encryption-key-0123456789ab'
  process.env.NODE_ENV = 'test'
  return { writes: [] as Record<string, unknown>[], selectResult: [] as unknown[], reads: 0 }
})

vi.mock('../src/db/index.js', () => {
  const chain = () => ({
    from: () => ({
      where: () => ({ limit: () => Promise.resolve(h.selectResult) }),
    }),
    set: (d: Record<string, unknown>) => {
      h.writes.push(d)
      return {
        where: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: KEY_ID,
                name: d.name ?? 'mimo-备用key#2',
                keyPrefix: d.keyPrefix ?? 'tp-o***1234',
                priority: 0,
                weight: 1,
                isEnabled: true,
                remark: null,
                updatedAt: new Date('2026-01-01T00:00:00Z'),
              },
            ]),
        }),
      }
    },
    update: () => chain(),
    select: () => {
      h.reads++
      return chain()
    },
  })
  return { db: chain(), dbRead: chain(), dbClient: {} }
})

// 管理员闸门与本票机制无关,放行为 no-op(不加载 auth/rbac 链)
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))
// 保留 CF_KEY 真值(不复制第二份字面量),只把"真敲上游"这一步换成桩
vi.mock('../src/services/relay-health-check-service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof RelayHealthCheckService>()),
  checkSingleKey: vi.fn(async () => ({ keyId: KEY_ID, status: 'healthy', latencyMs: null })),
}))

import type * as RelayHealthCheckService from '../src/services/relay-health-check-service.js'
import { decryptJSON, encryptJSON, type EncryptedPayload } from '../src/utils/crypto.js'
import relayKeyPoolRoutes from '../src/routes/admin/relay-key-pool.js'

const NEW_KEY = 'sk-new-9f2c4a7b1e8d3056aabbccddeeff0011'
const PUT_URL = `/admin/relay/key-pool/${KEY_ID}`

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(relayKeyPoolRoutes)
  await app.ready()
  return app
}

beforeEach(() => {
  h.writes.length = 0
  h.reads = 0
  h.selectResult = [
    { extraMetadata: { note: '保留字段', consecutiveFailures: 3, latencyTrusted: true } },
  ]
})

describe('号池 PUT 换 Key(handler 端到端)', () => {
  it('给了 apiKey ⇒ 密文可解回新值,且健康态/计数与密文同一次 set 复位', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: PUT_URL, payload: { apiKey: NEW_KEY } })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.keyPrefix).toBe(`${NEW_KEY.slice(0, 4)}***${NEW_KEY.slice(-4)}`)

    expect(h.writes).toHaveLength(1) // 分两次写 = 会出现"密文已换、读数还红"的窗口
    const w = h.writes[0]
    expect(decryptJSON(JSON.parse(String(w.apiKeyEnc)) as EncryptedPayload)).toBe(NEW_KEY)
    expect(w.healthStatus).toBe('unknown')
    expect(w.healthCheckedAt).toBe(null)
    expect(w.lastErrorMessage).toBe(null)
    const meta = w.extraMetadata as Record<string, unknown>
    expect(meta.consecutiveFailures).toBe(0)
    expect(meta.note).toBe('保留字段') // 复位计数不得顺手清掉别人的 metadata 字段
    expect(meta.latencyTrusted).toBe(true)
    await app.close()
  })

  it('不给 apiKey ⇒ 原语义不变,一个健康态字段都不碰', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: PUT_URL, payload: { name: '改名' } })
    expect(res.statusCode).toBe(200)
    const w = h.writes[0]
    expect(w.name).toBe('改名')
    for (const untouched of [
      'apiKeyEnc',
      'keyPrefix',
      'healthStatus',
      'healthCheckedAt',
      'extraMetadata',
    ]) {
      expect(w, `不带 apiKey 却写了 ${untouched}`).not.toHaveProperty(untouched)
    }
    await app.close()
  })

  it('空串 apiKey ⇒ 400 且不落库(等于用一把空 key 覆盖能用的那把)', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: PUT_URL, payload: { apiKey: '' } })
    expect(res.statusCode).toBe(400)
    expect(h.writes).toHaveLength(0)
    await app.close()
  })

  it('行不存在 ⇒ 404 且不落库(存在性先验,不靠 update 的 returning 兜)', async () => {
    h.selectResult = []
    const app = await buildApp()
    const res = await app.inject({ method: 'PUT', url: PUT_URL, payload: { apiKey: NEW_KEY } })
    expect(res.statusCode).toBe(404)
    expect(h.writes).toHaveLength(0)
    await app.close()
  })

  it('反向对照:加密器本身可逆(排除"测试自己骗自己"这一型)', () => {
    expect(decryptJSON(encryptJSON(NEW_KEY) as EncryptedPayload)).toBe(NEW_KEY)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
