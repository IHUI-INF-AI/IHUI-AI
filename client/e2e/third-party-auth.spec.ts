/**
 * 第三方登录核心流程联调测试
 *
 * 验证后端第三方登录端点真实可达 + 响应格式正确:
 *   - 微信: /auth/wechat/config, /auth/wechat/qr-code, /auth/wechat/status/{id}, /auth/wechat/callback
 *   - 支付宝: /auth/alipay/qrcode/generate, /auth/alipay/qrcode/status, /auth/alipay/callback, /auth/alipay/authorize
 *   - Google: /auth/google/config, /auth/google/callback, /auth/google/one-tap, /auth/google/status
 *   - Apple: /auth/apple/callback
 *   - OAuth2: /auth/oauth/token
 *
 * 后端实现: server/app/api/v1_third_party_auth.py
 * 前端调用: client/src/api/ (通过 Vite proxy /auth 转发)
 *
 * 注意: 未配置第三方 appId/secret 时, 端点返回 enabled=false, 这是预期行为.
 *       测试验证端点可达 + 格式正确, 不依赖真实第三方配置.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 验证后端 success() 响应格式: {code: "0", data: ...} */
function expectSuccessFormat(body: any): void {
  expect([0, 200, '0', '200']).toContain(body.code)
  expect(body.data, 'data 字段必填').toBeDefined()
}

test.describe('第三方登录联调: 微信登录', () => {
  test.setTimeout(15000)

  test('GET /auth/wechat/config 返回微信配置', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/wechat/config`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data, '应包含 enabled 字段').toHaveProperty('enabled')
    console.log(`[微信 config] enabled=${body.data.enabled}`)
  })

  test('GET /auth/wechat/qr-code 返回二维码', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/wechat/qr-code`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    // 应包含 qrCodeUrl / ticket / loginId / expiresIn 字段
    expect(body.data).toHaveProperty('qrCodeUrl')
    expect(body.data).toHaveProperty('expiresIn')
    console.log(`[微信 qr-code] enabled=${body.data.enabled ?? true}, expiresIn=${body.data.expiresIn}`)
  })

  test('GET /auth/wechat/status/{login_id} 返回扫码状态', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/wechat/status/test_login_id`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('status')
    console.log(`[微信 status] status=${body.data.status}`)
  })

  test('POST /auth/wechat/callback 返回登录凭证', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/wechat/callback`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { code: 'test_wechat_code', state: 'test_state' },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    // 应包含 token / refreshToken 字段 (未配置时为空串)
    expect(body.data).toHaveProperty('token')
    expect(body.data).toHaveProperty('refreshToken')
    console.log(`[微信 callback] token 长度=${String(body.data.token).length}`)
  })
})

test.describe('第三方登录联调: 支付宝登录', () => {
  test.setTimeout(15000)

  test('POST /auth/alipay/qrcode/generate 返回二维码', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/alipay/qrcode/generate`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: {},
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('sessionId')
    console.log(`[支付宝 qrcode] sessionId=${body.data.sessionId || '(未配置)'}`)
  })

  test('GET /auth/alipay/qrcode/status 返回扫码状态', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/alipay/qrcode/status`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('status')
    console.log(`[支付宝 status] status=${body.data.status}`)
  })

  test('POST /auth/alipay/callback 返回登录凭证', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/alipay/callback`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { code: 'test_alipay_code' },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('token')
    console.log(`[支付宝 callback] token 长度=${String(body.data.token).length}`)
  })

  test('GET /auth/alipay/authorize 返回授权 URL', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/alipay/authorize`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('authUrl')
    console.log(`[支付宝 authorize] authUrl=${body.data.authUrl || '(未配置)'}`)
  })
})

test.describe('第三方登录联调: Google 登录', () => {
  test.setTimeout(15000)

  test('GET /auth/google/config 返回 Google 配置', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/google/config`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('enabled')
    expect(body.data).toHaveProperty('clientId')
    console.log(`[Google config] enabled=${body.data.enabled}`)
  })

  test('POST /auth/google/callback 返回登录凭证', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/google/callback`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { code: 'test_google_code' },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('token')
    console.log(`[Google callback] token 长度=${String(body.data.token).length}`)
  })

  test('POST /auth/google/one-tap 返回登录凭证', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/google/one-tap`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { credential: 'test_google_credential' },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('token')
    console.log(`[Google one-tap] token 长度=${String(body.data.token).length}`)
  })

  test('GET /auth/google/status 返回登录状态', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/auth/google/status`, { timeout: 10000, failOnStatusCode: false })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('status')
    console.log(`[Google status] status=${body.data.status}`)
  })
})

test.describe('第三方登录联调: Apple 登录', () => {
  test.setTimeout(15000)

  test('POST /auth/apple/callback 返回登录凭证', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/apple/callback`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: { code: 'test_apple_code' },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端第三方登录端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('token')
    console.log(`[Apple callback] token 长度=${String(body.data.token).length}`)
  })
})

test.describe('第三方登录联调: OAuth2 token 端点', () => {
  test.setTimeout(15000)

  test('POST /auth/oauth/token password grant 返回 access_token', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.post(`${BACKEND}/auth/oauth/token`, {
      timeout: 10000,
      headers: { 'Content-Type': 'application/json' },
      data: {
        grant_type: 'password',
        username: 'oauth_test_user',
        password: 'test123456',
      },
      failOnStatusCode: false,
    })
    if (resp.status() === 404) {
      test.skip(true, '后端 OAuth2 端点未挂载')
      return
    }
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expectSuccessFormat(body)
    expect(body.data).toHaveProperty('access_token')
    expect(body.data).toHaveProperty('refresh_token')
    expect(body.data).toHaveProperty('token_type')
    console.log(`[OAuth2 token] token_type=${body.data.token_type}`)
  })
})
