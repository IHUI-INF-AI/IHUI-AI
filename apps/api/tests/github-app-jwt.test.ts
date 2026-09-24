// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { importSPKI, jwtVerify } from 'jose'

import {
  APP_JWT_LIFETIME_SECONDS,
  GithubAppError,
  createAppJwt,
  createGithubTransport,
  createInstallationTokenProvider,
  decodeAppJwt,
  exchangeInstallationToken,
  normalizePrivateKeyPem,
  readGithubAppEnv,
  readGithubAppIdentity,
} from '../src/services/github-app/jwt'
import type {
  GithubApiRequest,
  GithubApiResponse,
  GithubTransport,
} from '../src/services/github-app/jwt'

// GitHub App 控制台下载的私钥是 PKCS#1(`BEGIN RSA PRIVATE KEY`),
// 用同形态做夹具才能证明"归一到 PKCS#8"这一段真的被覆盖。
const keys = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})
const PRIVATE_KEY_PEM = String(keys.privateKey).trim()
const PUBLIC_KEY_PEM = String(keys.publicKey).trim()
const APP_ID = '1234567'

function fakeTokenResponse(expiresInSeconds = 3600): GithubApiResponse {
  return {
    status: 201,
    body: {
      token: 'ghs_installation_token_value',
      expires_at: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
      permissions: { pull_requests: 'write' },
    },
  }
}

function recordingTransport(
  reply: GithubApiResponse | ((req: GithubApiRequest) => GithubApiResponse),
): {
  calls: GithubApiRequest[]
  transport: GithubTransport
} {
  const calls: GithubApiRequest[] = []
  const transport: GithubTransport = async (request) => {
    calls.push(request)
    return typeof reply === 'function' ? reply(request) : reply
  }
  return { calls, transport }
}

describe('github-app jwt:App 身份 JWT', () => {
  it('签出的 JWT 可被公钥验签,alg=RS256、iss=appId', async () => {
    const token = await createAppJwt({ appId: APP_ID, privateKeyPem: PRIVATE_KEY_PEM })
    const key = await importSPKI(PUBLIC_KEY_PEM, 'RS256')
    const { payload, protectedHeader } = await jwtVerify(token, key)
    expect(protectedHeader.alg).toBe('RS256')
    expect(payload.iss).toBe(APP_ID)
  })

  it('生命周期落在 GitHub 允许的窗口内(exp - iat ≤ 600 且 > 0)', async () => {
    const token = await createAppJwt({ appId: APP_ID, privateKeyPem: PRIVATE_KEY_PEM })
    const decoded = decodeAppJwt(token)
    expect(decoded.iss).toBe(APP_ID)
    expect(decoded.iat).not.toBeNull()
    expect(decoded.exp).not.toBeNull()
    const lifetime = (decoded.exp ?? 0) - (decoded.iat ?? 0)
    expect(lifetime).toBeGreaterThan(0)
    expect(lifetime).toBeLessThanOrEqual(600)
    expect(lifetime).toBeLessThanOrEqual(APP_JWT_LIFETIME_SECONDS + 1)
  })

  it('注入时钟后 iat 逐字等于给定时间(可复现,不依赖墙钟)', async () => {
    const now = new Date('2026-09-25T00:00:00.000Z')
    const decoded = decodeAppJwt(
      await createAppJwt({ appId: APP_ID, privateKeyPem: PRIVATE_KEY_PEM }, { now }),
    )
    expect(decoded.iat).toBe(Math.floor(now.getTime() / 1000))
  })

  it('env 里被压成单行字面量 \\n 的私钥照样能用', async () => {
    const flattened = PRIVATE_KEY_PEM.replace(/\n/g, '\\n')
    expect(flattened.includes('\n')).toBe(false)
    const decoded = decodeAppJwt(await createAppJwt({ appId: APP_ID, privateKeyPem: flattened }))
    expect(decoded.iss).toBe(APP_ID)
  })

  it('私钥垃圾 → invalid_private_key;凭据缺失 → app_credentials_not_configured', async () => {
    await expect(createAppJwt({ appId: APP_ID, privateKeyPem: 'not-a-key' })).rejects.toMatchObject(
      {
        failure: 'invalid_private_key',
      },
    )
    await expect(
      createAppJwt({ appId: '', privateKeyPem: PRIVATE_KEY_PEM }),
    ).rejects.toBeInstanceOf(GithubAppError)
    await expect(createAppJwt({ appId: ' ', privateKeyPem: '' })).rejects.toMatchObject({
      failure: 'app_credentials_not_configured',
    })
  })
})

describe('github-app jwt:installation token 换取(全程 mock transport,零网络)', () => {
  it('打到正确端点并带上 App JWT', async () => {
    const { calls, transport } = recordingTransport(fakeTokenResponse())
    const result = await exchangeInstallationToken({
      appId: APP_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      installationId: 4242,
      transport,
    })
    expect(calls).toHaveLength(1)
    const call = calls[0]
    expect(call?.method).toBe('POST')
    expect(call?.path).toBe('/app/installations/4242/access_tokens')
    expect(call?.headers['Authorization'] ?? '').toMatch(/^Bearer /)
    expect(decodeAppJwt((call?.headers['Authorization'] ?? '').replace('Bearer ', '')).iss).toBe(
      APP_ID,
    )
    expect(result.installationId).toBe(4242)
    expect(result.token).toBe('ghs_installation_token_value')
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('传 permissions 时才带请求体(不给 GitHub 传 undefined 字段)', async () => {
    const noPerms = recordingTransport(fakeTokenResponse())
    await exchangeInstallationToken({
      appId: APP_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      installationId: 1,
      transport: noPerms.transport,
    })
    expect(noPerms.calls[0]?.body).toBeUndefined()

    const withPerms = recordingTransport(fakeTokenResponse())
    await exchangeInstallationToken({
      appId: APP_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      installationId: 1,
      transport: withPerms.transport,
      permissions: { pull_requests: 'write' },
    })
    expect(withPerms.calls[0]?.body).toEqual({ permissions: { pull_requests: 'write' } })
  })

  it('非 2xx 抛错且 message 不回显上游响应体(防凭据/内部信息外泄)', async () => {
    const { transport } = recordingTransport({
      status: 404,
      body: { message: 'Not Found', documentation_url: 'https://docs.example/secret-hint' },
    })
    const caught = await exchangeInstallationToken({
      appId: APP_ID,
      privateKeyPem: PRIVATE_KEY_PEM,
      installationId: 999,
      transport,
    }).catch((error: unknown) => error)
    expect(caught).toBeInstanceOf(GithubAppError)
    const err = caught as GithubAppError
    expect(err.status).toBe(404)
    expect(err.failure).toBe('installation_token_rejected')
    expect(err.message).not.toContain('Not Found')
    expect(err.message).not.toContain('secret-hint')
  })

  it('2xx 但缺 token / expires_at 不合形 → malformed_token_response', async () => {
    const cases: GithubApiResponse[] = [
      { status: 201, body: { token: 'x' } },
      { status: 201, body: { expires_at: '2026-01-01T00:00:00Z' } },
      { status: 201, body: null },
      { status: 201, body: { token: 'x', expires_at: '完全不是时间' } },
    ]
    for (const reply of cases) {
      const err = (await exchangeInstallationToken({
        appId: APP_ID,
        privateKeyPem: PRIVATE_KEY_PEM,
        installationId: 7,
        transport: async () => reply,
      }).catch((error: unknown) => error)) as GithubAppError
      expect(err).toBeInstanceOf(GithubAppError)
      expect(err.failure).toBe('malformed_token_response')
    }
  })

  it('provider 缓存未过期 token,不重复换;invalidate 后重换', async () => {
    let hits = 0
    const transport: GithubTransport = async () => {
      hits += 1
      return fakeTokenResponse()
    }
    const provider = createInstallationTokenProvider(
      { appId: APP_ID, privateKeyPem: PRIVATE_KEY_PEM },
      transport,
    )
    const first = await provider.get(11)
    const second = await provider.get(11)
    expect(hits).toBe(1)
    expect(second.token).toBe(first.token)
    expect(provider.peek(11)?.token).toBe(first.token)

    provider.invalidate(11)
    expect(provider.peek(11)).toBeNull()
    await provider.get(11)
    expect(hits).toBe(2)

    // 剩余寿命不足刷新阈值的 token 必须换新,不能把过期边缘交给调用方
    provider.invalidate()
    const nearExpiry = createInstallationTokenProvider(
      { appId: APP_ID, privateKeyPem: PRIVATE_KEY_PEM },
      async () => fakeTokenResponse(60),
    )
    await nearExpiry.get(12)
    await nearExpiry.get(12)
    expect(nearExpiry.peek(12)).not.toBeNull()
  })
})

describe('github-app jwt:createGithubTransport(注入 fetch,零网络)', () => {
  it('拼 URL、带 GitHub 必备头、JSON 化请求体', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = []
    const transport = createGithubTransport({
      baseUrl: 'https://ghe.internal/api/v3/',
      fetchImpl: (async (url: string | URL, init?: RequestInit) => {
        seen.push({ url: String(url), init: init ?? {} })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }) as unknown as typeof globalThis.fetch,
    })
    const response = await transport({
      method: 'POST',
      path: '/repos/a/b/issues/1/comments',
      headers: { Authorization: 'Bearer t' },
      body: { body: 'hi' },
    })
    expect(response).toEqual({ status: 200, body: { ok: true } })
    const call = seen[0]
    expect(call?.url).toBe('https://ghe.internal/api/v3/repos/a/b/issues/1/comments')
    expect((call?.init.headers as Record<string, string>)['Accept']).toContain('github')
    expect((call?.init.headers as Record<string, string>)['User-Agent']).toBe(
      'IHUI-AI-GitHubApp/1.0',
    )
    expect((call?.init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect((call?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer t')
    expect(call?.init.body).toBe(JSON.stringify({ body: 'hi' }))
  })

  it('GET 不带 body 也不设 Content-Type', async () => {
    let captured: RequestInit | null = null
    const transport = createGithubTransport({
      fetchImpl: (async (_url: string | URL, init?: RequestInit) => {
        captured = init ?? null
        return new Response('[]', { status: 200 })
      }) as unknown as typeof globalThis.fetch,
    })
    const response = await transport({ method: 'GET', path: '/x', headers: {} })
    expect(response.body).toEqual([])
    expect(captured?.body).toBeUndefined()
    expect((captured?.headers as Record<string, string>)?.['Content-Type']).toBeUndefined()
  })

  it('204 空体与非 JSON 响应体都降级成 null,不抛', async () => {
    const cases = [
      { status: 204, body: null },
      { status: 502, body: '<html>bad gateway</html>' },
    ] as const
    for (const item of cases) {
      const transport = createGithubTransport({
        fetchImpl: (async () =>
          new Response(item.body, { status: item.status })) as unknown as typeof globalThis.fetch,
      })
      expect(await transport({ method: 'GET', path: '/p', headers: {} })).toEqual({
        status: item.status,
        body: null,
      })
    }
  })

  it('不注入 fetchImpl 时也不该被本套件触发(用 baseUrl 指不到真实主机的实现兜不住,故显式断言参数存在)', async () => {
    const transport = createGithubTransport({
      fetchImpl: async () => new Response('{}', { status: 200 }),
    })
    await expect(transport({ method: 'GET', path: '/anything', headers: {} })).resolves.toEqual({
      status: 200,
      body: {},
    })
  })
})

describe('github-app jwt:env 读取', () => {
  it('normalizePrivateKeyPem 还原字面量换行,并顺带 trim(幂等)', () => {
    const flattened = PRIVATE_KEY_PEM.replace(/\n/g, '\\n')
    const expected = PRIVATE_KEY_PEM.trim()
    expect(normalizePrivateKeyPem(flattened)).toBe(expected)
    // 已是多行 PEM 时只做 trim,不得再动内部换行
    expect(normalizePrivateKeyPem(PRIVATE_KEY_PEM)).toBe(expected)
    expect(normalizePrivateKeyPem(normalizePrivateKeyPem(flattened))).toBe(expected)
    expect(normalizePrivateKeyPem(`  ${flattened}  `)).toBe(expected)
  })

  it('两项齐备才 configured;只有一项一律 false', () => {
    expect(
      readGithubAppEnv({ GITHUB_APP_ID: APP_ID, GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY_PEM })
        .configured,
    ).toBe(true)
    expect(readGithubAppEnv({ GITHUB_APP_ID: APP_ID }).configured).toBe(false)
    expect(readGithubAppEnv({ GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY_PEM }).configured).toBe(false)
    expect(readGithubAppEnv({}).configured).toBe(false)
  })

  it('readGithubAppIdentity 未配置给 null(调用方据此跳过而不是抛)', () => {
    expect(readGithubAppIdentity({})).toBeNull()
    const identity = readGithubAppIdentity({
      GITHUB_APP_ID: ` ${APP_ID} `,
      GITHUB_APP_PRIVATE_KEY: PRIVATE_KEY_PEM,
    })
    expect(identity?.appId).toBe(APP_ID)
    expect(identity?.privateKeyPem).toBe(PRIVATE_KEY_PEM)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
