// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { env } from 'node:process'

/**
 * SDB-47 回归:未配置任何推送通道(FCM/个推)时,stub 不能把「一条都没发出」记成成功,
 * 且管理端群发响应必须能看出这一次走的是 stub。已配置通道的正常投放路径保持不变。
 */

const USER_ID = '00000000-0000-4000-8000-0000000000aa'

const { dbSelectMock, authenticateMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  authenticateMock: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: dbSelectMock, execute: vi.fn() },
}))
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: authenticateMock,
  checkAuth: vi.fn(async () => true),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(async () => true),
}))

import { sendPush, detectPushProvider } from '../src/services/push-provider.js'
import { adminPushRoutes } from '../src/routes/push.js'

const CONFIG_KEYS = [
  'FCM_PROJECT_ID',
  'FCM_SERVICE_ACCOUNT_KEY',
  'GETUI_APP_ID',
  'GETUI_APP_KEY',
  'GETUI_MASTER_SECRET',
] as const

const savedEnv: Record<string, string | undefined> = {}
for (const k of CONFIG_KEYS) savedEnv[k] = env[k]

function clearChannels(): void {
  for (const k of CONFIG_KEYS) delete env[k]
}

/** 生成一份可被 signJwtRS256 使用的临时 RSA 私钥,让 FCM 分支真跑到 HTTP 层。 */
async function buildFcmServiceAccountKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign'],
  )
  const der = await crypto.subtle.exportKey('pkcs8', privateKey)
  const b64 = Buffer.from(der).toString('base64').replace(/(.{64})/g, '$1\n')
  const sa = {
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`,
    token_uri: 'https://oauth2.example/token',
  }
  return Buffer.from(JSON.stringify(sa)).toString('base64')
}

describe('SDB-47 push stub 不得报成功', () => {
  let app: FastifyInstance
  let fcmServiceAccountKey: string

  beforeAll(async () => {
    fcmServiceAccountKey = await buildFcmServiceAccountKey()
    app = Fastify({ logger: false })
    await app.register(adminPushRoutes, { prefix: '/api/admin' })
    await app.ready()
    authenticateMock.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const k of CONFIG_KEYS) {
      if (savedEnv[k] === undefined) delete env[k]
      else env[k] = savedEnv[k]
    }
  })

  it('无通道 ⇒ detectPushProvider=stub,sendPush 返回 success=false + push_not_configured', async () => {
    clearChannels()
    expect(detectPushProvider()).toBe('stub')

    const result = await sendPush({ token: 'device-token-1' }, { title: 't', body: 'b' })

    expect(result.provider).toBe('stub')
    expect(result.success).toBe(false)
    expect(result.error).toBe('push_not_configured')
    // 桩不是真实投递,不应返回可被误当作回执的 messageId
    expect(result.messageId).toBeUndefined()
  })

  it('POST /api/admin/push/send 在 stub 下:failed=total 且响应顶层 provider=stub', async () => {
    clearChannels()
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: { authorization: 'Bearer mock-access-token' },
      body: { title: 't', body: 'b', tokens: ['tok-a', 'tok-b'] },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.provider).toBe('stub')
    expect(data.total).toBe(2)
    expect(data.success).toBe(0)
    expect(data.failed).toBe(2)
    expect(data.results.map((r: { error?: string }) => r.error)).toEqual([
      'push_not_configured',
      'push_not_configured',
    ])
  })

  it('已配置 FCM 时正常投放路径不变:逐 token 成功且 provider=fcm', async () => {
    clearChannels()
    env.FCM_PROJECT_ID = 'ihui-test'
    env.FCM_SERVICE_ACCOUNT_KEY = fcmServiceAccountKey
    expect(detectPushProvider()).toBe('fcm')

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'at-1' }), { status: 200 })
      }
      return new Response(JSON.stringify({ name: 'projects/ihui-test/messages/1' }), {
        status: 200,
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/push/send',
      headers: { authorization: 'Bearer mock-access-token' },
      body: { title: 't', body: 'b', tokens: ['tok-a'] },
    })

    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data.provider).toBe('fcm')
    expect(data.success).toBe(1)
    expect(data.failed).toBe(0)
    expect(data.results[0]).toMatchObject({
      provider: 'fcm',
      success: true,
      messageId: 'projects/ihui-test/messages/1',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
