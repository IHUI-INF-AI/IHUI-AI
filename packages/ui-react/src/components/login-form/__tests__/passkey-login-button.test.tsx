// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Passkey 登录入口三态断言(G-874,2026-10-22 立)
 *
 * 覆盖:成功(options → startAuthentication → verify → onSuccess)、用户取消
 * (NotAllowedError,不再发 verify)、浏览器不支持(PublicKeyCredential 缺失,不发任何请求)。
 * 夹具与同目录 agreement-prechecked-default 一致:react-dom/client + React.act(本包无
 * @testing-library 依赖);fetch 与 @simplewebauthn/browser 走 vi mock。
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { PasskeyLoginButton } from '../passkey-login-button'
import type { ApiResult, LoginApiClient, LoginResult } from '../types'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const startAuthenticationMock = vi.hoisted(() => vi.fn())
vi.mock('@simplewebauthn/browser', () => ({
  startAuthentication: startAuthenticationMock,
}))

/* ── 夹具 ────────────────────────────────────────────────────────────────── */

const t = (key: string) => key
const roots: Root[] = []

/** vitest 环境没有真实 Response 构造器依赖,给 fetch 一份最小 json() 响应。 */
function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

/**
 * 与 web 端 LoginFormContent 同形的 passkey 调用点:真正走 fetch 打后端两个端点,
 * 再把 `{ code, message, data }` 归一成共享包认识的 ApiResult。
 */
async function fetchApi<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  const res = await (fetch as unknown as (u: string, i?: RequestInit) => Promise<Response>)(
    url,
    init,
  )
  const json = (await res.json()) as { code: number; message: string; data?: T }
  if (json.code === 0 && json.data !== undefined) return { success: true, data: json.data }
  return { success: false, error: json.message }
}

function makeApiClient(): LoginApiClient {
  const unused = async () => ({ success: false as const, error: 'unused-in-this-test' })
  return {
    loginByAccount: unused,
    loginByEmailCode: unused,
    loginBySms: unused,
    sendEmailCode: unused,
    sendSmsCode: unused,
    passkeyAuthOptions: () =>
      fetchApi<{ options: unknown; challengeId: string }>('/api/auth/passkey/auth/options', {
        method: 'POST',
      }),
    passkeyAuthVerify: (challengeId, response) =>
      fetchApi<LoginResult>('/api/auth/passkey/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, response }),
      }),
  }
}

function enableWebAuthn() {
  vi.stubGlobal('PublicKeyCredential', class FakePublicKeyCredential {})
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { get: vi.fn(), create: vi.fn() },
  })
}

const originalCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials')

beforeEach(() => {
  startAuthenticationMock.mockReset()
  vi.stubGlobal('fetch', vi.fn())
  enableWebAuthn()
})

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop()
    React.act(() => {
      root?.unmount()
    })
  }
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  if (originalCredentials) Object.defineProperty(navigator, 'credentials', originalCredentials)
  else Reflect.deleteProperty(navigator, 'credentials')
})

function render(node: React.ReactElement): HTMLElement {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  React.act(() => {
    root.render(node)
  })
  return host
}

async function clickPasskey(host: HTMLElement) {
  const button = host.querySelector<HTMLButtonElement>('[data-testid="login-passkey-button"]')
  expect(button, '必须渲染 Passkey 入口').not.toBeNull()
  await React.act(async () => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

/* ── 三态 ────────────────────────────────────────────────────────────────── */

describe('Passkey 登录入口', () => {
  it('成功:options → startAuthentication → verify → onSuccess', async () => {
    const onSuccess = vi.fn()
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          message: 'ok',
          data: { options: { challenge: 'challenge-1' }, challengeId: 'cid-1' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          message: 'ok',
          data: {
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresIn: 900,
            user: { id: 'u1' },
          },
        }),
      )
    startAuthenticationMock.mockResolvedValue({ id: 'cred-1', type: 'public-key' })

    const host = render(
      <PasskeyLoginButton t={t} apiClient={makeApiClient()} onSuccess={onSuccess} />,
    )
    await clickPasskey(host)

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/passkey/auth/options')
    expect(startAuthenticationMock).toHaveBeenCalledWith({
      optionsJSON: { challenge: 'challenge-1' },
    })
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/passkey/auth/verify')
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"challengeId":"cid-1"')
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'access', user: { id: 'u1' } }),
    )
    expect(host.querySelector('[data-testid="login-passkey-error"]')).toBeNull()
  })

  it('用户取消:NotAllowedError → 可见取消提示,且不再发 verify', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        code: 0,
        message: 'ok',
        data: { options: { challenge: 'challenge-1' }, challengeId: 'cid-1' },
      }),
    )
    startAuthenticationMock.mockRejectedValue(new DOMException('user cancelled', 'NotAllowedError'))

    const host = render(<PasskeyLoginButton t={t} apiClient={makeApiClient()} />)
    await clickPasskey(host)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[data-testid="login-passkey-error"]')?.textContent).toBe(
      'auth.thirdParty.loginCancelled',
    )
  })

  it('浏览器不支持:PublicKeyCredential 缺失 → passkeyNotSupported,不发任何请求', async () => {
    vi.stubGlobal('PublicKeyCredential', undefined)
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: undefined })
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>

    const host = render(<PasskeyLoginButton t={t} apiClient={makeApiClient()} />)
    await clickPasskey(host)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(host.querySelector('[data-testid="login-passkey-error"]')?.textContent).toBe(
      'eduAi.security.passkeyNotSupported',
    )
  })
})
