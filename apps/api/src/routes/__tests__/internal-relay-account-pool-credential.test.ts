// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池凭证回写内网端点单测:密钥三态(503/401/放行)+ 三结果 HTTP 映射 + 400 校验。
 * service 层 CAS 已由 relay-account-pool-credential.test.ts 测透,这里 mock service。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const configState = vi.hoisted(() => ({ callbackSecret: 'test-callback-secret' }))

vi.mock('../../config/index.js', () => ({
  config: {
    get AI_CALLBACK_SECRET() {
      return configState.callbackSecret
    },
  },
}))

const svc = vi.hoisted(() => ({
  outcome: { status: 'applied', credVersion: 8 } as {
    status: string
    credVersion?: number
    currentVersion?: number
  },
}))

vi.mock('../../services/relay-account-pool-credential.js', () => ({
  applyPoolCredentialWriteback: vi.fn(async () => svc.outcome),
  parseExpiresAt: vi.fn(() => null),
}))

import internalRelayAccountPoolCredentialRoutes from '../internal-relay-account-pool-credential.js'

let app: FastifyInstance

beforeEach(async () => {
  configState.callbackSecret = 'test-callback-secret'
  svc.outcome = { status: 'applied', credVersion: 8 }
  app = Fastify()
  app.register(internalRelayAccountPoolCredentialRoutes)
  await app.ready()
})

const VALID_BODY = {
  poolAccountId: 'pool-1',
  baseVersion: 7,
  refreshToken: 'ref-new',
  expiresAt: '1792000000',
}

describe('POST /api/internal/relay/account-pool/credential', () => {
  it('密钥未配置 → 503(不裸奔)', async () => {
    configState.callbackSecret = ''
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'test-callback-secret' },
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(503)
  })

  it('密钥不匹配 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'wrong-secret' },
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺密钥头 → 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(401)
  })

  it('密钥正确 + applied → 200 {status,credVersion}', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'test-callback-secret' },
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: unknown }).data).toMatchObject({
      status: 'applied',
      credVersion: 8,
    })
  })

  it('conflict → 200 {status,currentVersion}(非错误,号池侧已有更新)', async () => {
    svc.outcome = { status: 'conflict', currentVersion: 12 }
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'test-callback-secret' },
      payload: { ...VALID_BODY, baseVersion: 7 },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { data: unknown }).data).toMatchObject({
      status: 'conflict',
      currentVersion: 12,
    })
  })

  it('not_found → 404', async () => {
    svc.outcome = { status: 'not_found' }
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/relay/account-pool/credential',
      headers: { 'x-internal-secret': 'test-callback-secret' },
      payload: VALID_BODY,
    })
    expect(res.statusCode).toBe(404)
  })

  it('缺 poolAccountId / baseVersion 非整数 → 400', async () => {
    for (const bad of [
      { baseVersion: 7 },
      { poolAccountId: 'p' },
      { ...VALID_BODY, baseVersion: -1 },
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/internal/relay/account-pool/credential',
        headers: { 'x-internal-secret': 'test-callback-secret' },
        payload: bad,
      })
      expect(res.statusCode).toBe(400)
    }
  })
})
