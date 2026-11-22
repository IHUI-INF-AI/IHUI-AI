// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax(mcode)OAuth 续票单腿(2026-11-06 立,与 relay-minimax-adapter.test.ts 分文件以免相互污染 mockFetch)。
 *
 * 判据出处 = 本机 MiniMax Code 3.1.10 的字符串取证(@mavis/oauth-core:
 * endpoint-config.js / contracts.js / oauth-client.js / auth-core.js)。本文件钉的是**我方复现的
 * 协议行为**:端点落点、请求面、五条响应硬校验、失败分档、零凭据外溢。
 * fetch 全部打桩,绝不发真实网络请求;所有票面都是合成假值。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AdapterAccountContext } from '../src/services/relay-upstream-adapters.js'
import {
  minimaxAdapter,
  isDeadGrantError,
  parseMinimaxTokenGrant,
} from '../src/services/upstream-adapters/minimax-adapter.js'

const mockFetch = vi.fn()

function refreshCtx(secrets: Record<string, unknown> = {}, rt = 'old-rt'): AdapterAccountContext {
  return {
    row: { id: 'r', providerCode: 'minimax', uid: 'u', name: 'n', extraMetadata: null },
    credentials: { token: 'old-at', refreshToken: rt, cookies: [], secrets },
  } as unknown as AdapterAccountContext
}

const okPayload = {
  access_token: 'new-at',
  refresh_token: 'new-rt',
  token_type: 'Bearer',
  expires_in: 7200,
  scope: 'agent.default',
}

function mockJson(status: number, body: unknown, raw?: string) {
  mockFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => raw ?? JSON.stringify(body),
  })
}

beforeEach(() => mockFetch.mockReset())

describe('请求面(端点/头/字段)', () => {
  it('无 refresh token ⇒ 返回 null 且一个请求都不发(不猜、不打上游)', async () => {
    const r = await minimaxAdapter.refreshToken!(refreshCtx({}, null), {
      fetchImpl: mockFetch as never,
    })
    expect(r).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('POST account.minimax.cn/oauth2/token;除 Accept/Content-Type 外不带任何头,尤其不带 Authorization', async () => {
    mockJson(200, okPayload)
    await minimaxAdapter.refreshToken!(refreshCtx(), { fetchImpl: mockFetch as never })
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://account.minimax.cn/oauth2/token')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(
      Object.keys(headers).every(
        (k) => k.toLowerCase() === 'content-type' || k.toLowerCase() === 'accept',
      ),
    ).toBe(true)
    const form = new URLSearchParams(String(init.body))
    expect(form.get('grant_type')).toBe('refresh_token')
    expect(form.get('refresh_token')).toBe('old-rt')
    expect(form.get('client_id')).toBe('mcode-public')
    expect(form.get('scope')).toBe('agent.default')
    expect(form.get('audience')).toBe('agent-backend')
  })

  it('池内 secrets 自带的 clientId / scopes / audience 优先于常量档', async () => {
    mockJson(
      200,
      { access_token: 'a', token_type: 'Bearer', expires_in: 60, scope: 'agent.default' },
      undefined,
    )
    await minimaxAdapter.refreshToken!(
      refreshCtx({
        clientId: 'cid-from-pool',
        scopes: ['agent.default', 'extra.scope'],
        audience: 'aud-from-pool',
      }),
      { fetchImpl: mockFetch as never },
    )
    const form = new URLSearchParams(
      String((mockFetch.mock.calls[0] as [string, RequestInit])[1].body),
    )
    expect(form.get('client_id')).toBe('cid-from-pool')
    expect(form.get('audience')).toBe('aud-from-pool')
    expect(form.get('scope')).toBe('agent.default extra.scope')
  })

  it('region=global ⇒ 落 account.minimax.io;env 显式给端点时整体接管(客户端自己有这一档)', async () => {
    mockJson(200, {
      access_token: 'a',
      token_type: 'Bearer',
      expires_in: 60,
      scope: 'agent.default',
    })
    await minimaxAdapter.refreshToken!(refreshCtx({ region: 'global' }), {
      fetchImpl: mockFetch as never,
    })
    expect(mockFetch.mock.calls[0][0]).toBe('https://account.minimax.io/oauth2/token')
    vi.stubEnv('MCODE_OAUTH_TOKEN_ENDPOINT', 'https://override.example/token')
    await minimaxAdapter.refreshToken!(refreshCtx(), { fetchImpl: mockFetch as never })
    expect(mockFetch.mock.calls[1][0]).toBe('https://override.example/token')
    vi.unstubAllEnvs()
  })
})

describe('响应判定(五条硬校验 + 失败分档 + 零凭据外溢)', () => {
  it('合格 grant ⇒ 新票 + expiresIn 原样上交 + 到期 = now+expires_in(只认当场给的值)', async () => {
    mockJson(200, okPayload)
    const r = await minimaxAdapter.refreshToken!(refreshCtx(), { fetchImpl: mockFetch as never })
    expect(r?.token).toBe('new-at')
    expect(r?.refreshToken).toBe('new-rt')
    expect(r?.expiresIn).toBe(7200)
    const delta = (r?.expiresAt as Date).getTime() - Date.now()
    expect(delta).toBeGreaterThan(7_100_000)
    expect(delta).toBeLessThan(7_300_000)
  })

  it('上游不回新 rt ⇒ 沿用旧值(取证到上游允许不回;池侧不得因此清空 rt)', async () => {
    mockJson(200, {
      access_token: 'a',
      token_type: 'bearer',
      expires_in: 60,
      scope: 'agent.default',
    })
    const r = await minimaxAdapter.refreshToken!(refreshCtx(), { fetchImpl: mockFetch as never })
    expect(r?.refreshToken).toBe('old-rt')
  })

  const badGrants: Array<[string, Record<string, unknown>]> = [
    ['缺 access_token', { token_type: 'Bearer', expires_in: 60, scope: 'agent.default' }],
    [
      'token_type 不是 bearer',
      { access_token: 'a', token_type: 'mac', expires_in: 60, scope: 'agent.default' },
    ],
    [
      'expires_in 非正数',
      { access_token: 'a', token_type: 'Bearer', expires_in: 0, scope: 'agent.default' },
    ],
    [
      'scope 不含 agent.default',
      { access_token: 'a', token_type: 'Bearer', expires_in: 60, scope: 'other' },
    ],
    ['scope 字段缺失', { access_token: 'a', token_type: 'Bearer', expires_in: 60 }],
  ]
  it.each(badGrants)(
    '200 但 %s ⇒ invalid_token_response(不当成功、不写票)',
    async (_why, payload) => {
      mockJson(200, payload)
      await expect(
        minimaxAdapter.refreshToken!(refreshCtx(), { fetchImpl: mockFetch as never }),
      ).rejects.toMatchObject({ code: 'invalid_token_response' })
    },
  )

  it('200 但不是 JSON ⇒ 同样 invalid_token_response(HTML 登录页不能当票)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html>login</html>',
      json: async () => {
        throw new Error('not json')
      },
    })
    await expect(
      minimaxAdapter.refreshToken!(refreshCtx(), { fetchImpl: mockFetch as never }),
    ).rejects.toMatchObject({ code: 'invalid_token_response' })
  })

  it('HTTP 400 + invalid_grant ⇒ 判「票已死」(isAuthError=true)', async () => {
    mockJson(400, { error: 'invalid_grant', error_description: 'refresh token expired' })
    const dead = await minimaxAdapter.refreshToken!(refreshCtx(), {
      fetchImpl: mockFetch as never,
    }).catch((e: unknown) => e)
    expect(minimaxAdapter.isAuthError?.(dead)).toBe(true)
  })

  it('HTTP 500 ⇒ 不算鉴权失效(未判定 ≠ 失效,§0.3)', async () => {
    mockJson(500, { error: 'server_error' })
    const soft = await minimaxAdapter.refreshToken!(refreshCtx(), {
      fetchImpl: mockFetch as never,
    }).catch((e: unknown) => e)
    expect(minimaxAdapter.isAuthError?.(soft)).toBe(false)
  })

  // 「请求未送达 ⇒ code=network」这一支不在这里用拒绝型 mock 演(本仓 vitest 会把内层
  // 拒绝记成用例失败原因,与实现无关);改成直接钉它的判据函数 —— 同一张表,零 promise 陷阱。
  it('票死判定表:只有 (400, invalid_grant) 为真;network/500/形状不符全为假', async () => {
    expect(isDeadGrantError(400, 'invalid_grant')).toBe(true)
    expect(isDeadGrantError(0, 'network')).toBe(false)
    expect(isDeadGrantError(500, 'server_error')).toBe(false)
    expect(isDeadGrantError(200, 'invalid_token_response')).toBe(false)
    // 反向牙:401 也不是「票已死」(那是 api 面的鉴权失效,归 isAuthFailure 管,别串门)
    expect(isDeadGrantError(401, 'invalid_grant')).toBe(false)
  })

  it('parseMinimaxTokenGrant 单独可判:合格票 + 缺 rt 回落旧值(不写票面也不清空)', () => {
    const now = Date.parse('2026-11-06T00:00:00.000Z')
    const ok = parseMinimaxTokenGrant(
      { access_token: 'a', token_type: 'Bearer', expires_in: 100, scope: 'agent.default' },
      now,
      'old-rt',
    )
    expect(ok.token).toBe('a')
    expect(ok.expiresAt?.getTime()).toBe(now + 100_000)
    expect(
      parseMinimaxTokenGrant(
        { access_token: 'a', token_type: 'Bearer', expires_in: 100, scope: 'agent.default' },
        now,
        null,
      ).refreshToken,
    ).toBeNull()
  })

  it('错误信息零凭据:不含 rt/at 明文,也不转述上游 error_description', async () => {
    mockJson(400, { error: 'invalid_grant', error_description: 'token old-rt leaked old-at' })
    const msg = await minimaxAdapter.refreshToken!(refreshCtx(), {
      fetchImpl: mockFetch as never,
    }).catch((e: Error) => e.message)
    expect(String(msg)).not.toContain('old-rt')
    expect(String(msg)).not.toContain('old-at')
    expect(String(msg)).not.toContain('leaked')
    expect(String(msg)).toContain('invalid_grant')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
