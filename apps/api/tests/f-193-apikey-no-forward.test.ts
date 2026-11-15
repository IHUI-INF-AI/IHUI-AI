// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-193「/v1/threads/:threadId/runs 把开发者 API Key 当 Bearer 转发给 ai-service」回归测试。
 *
 * 根因: aiServiceFetch 在 authHeader 缺省时复用入站 Authorization;/v1* 网关的入站
 * 凭证是开发者 API Key(ihui_...),不是用户 JWT,而 ai-service 的 jwt_auth 只接受
 * JWT ⇒ 请求恒定 401/502,Assistants 运行链路整体不可用。
 *
 * 修复: helper 识别 ihui_ 前缀的 API Key,改为注入内部系统票据(与
 * aiServiceSystemFetch 同语义),用户 JWT 仍原样透传。
 *
 * 本文件钉住:
 *  ① API Key 入站 → 出站 Authorization 是系统票据,绝不含 ihui_ 明文;
 *  ② 用户 JWT 入站 → 原样透传(不破坏正常登录链路);
 *  ③ 调用方显式传 headers.Authorization → 以显式为准,不被改写。
 *
 * 隔离:只 mock 全局 fetch 与系统票据签发,不触达真实 ai-service / PG / Redis。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'

const { mockGetSystemToken } = vi.hoisted(() => ({
  mockGetSystemToken: vi.fn(async () => 'system-access-token-f193'),
}))

vi.mock('../src/utils/system-access-token.js', () => ({
  getSystemAccessToken: mockGetSystemToken,
}))

import * as aiFetch from '../src/utils/ai-service-fetch.js'

const SYSTEM_TOKEN = 'system-access-token-f193'
const mockFetch = vi.fn<typeof fetch>()

function reqWithAuth(authorization: string): FastifyRequest {
  return { headers: { authorization }, query: {} } as unknown as FastifyRequest
}

/** 取第一次出站 fetch 的 Authorization 头 */
function outboundAuth(): string | null {
  const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined
  const headers = init?.headers as Record<string, string> | undefined
  return headers?.Authorization ?? headers?.authorization ?? null
}

describe('aiServiceFetch 不透传开发者 API Key — F-193', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetSystemToken.mockClear()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('① 入站 ihui_ API Key → 出站改注入系统票据,不透传 API Key 明文', async () => {
    await aiFetch.aiServiceFetch(reqWithAuth('Bearer ihui_devkey_abc123'), '/api/llm/complete', {
      method: 'POST',
    })
    const auth = outboundAuth()
    expect(auth).toBe(`Bearer ${SYSTEM_TOKEN}`)
    expect(auth).not.toContain('ihui_devkey')
    expect(mockGetSystemToken).toHaveBeenCalledTimes(1)
  })

  it('② 入站用户 JWT → 原样透传,不取系统票据', async () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMSJ9.signature'
    await aiFetch.aiServiceFetch(reqWithAuth(`Bearer ${jwt}`), '/api/llm/complete', {
      method: 'POST',
    })
    expect(outboundAuth()).toBe(`Bearer ${jwt}`)
    expect(mockGetSystemToken).not.toHaveBeenCalled()
  })

  it('③ 调用方显式 headers.Authorization → 以显式为准,helper 不改写', async () => {
    await aiFetch.aiServiceFetch(reqWithAuth('Bearer ihui_devkey'), '/api/llm/complete', {
      method: 'POST',
      headers: { Authorization: 'Bearer explicit-internal-token' },
    })
    expect(outboundAuth()).toBe('Bearer explicit-internal-token')
    expect(mockGetSystemToken).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
