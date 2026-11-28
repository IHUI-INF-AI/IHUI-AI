// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-270:Coze access_token 曾是全局单槽缓存 —— 先取 A 的 token,再取 B 时直接命中返回 A 的,
 * 越权/身份错配而响应完全同形。缓存必须按 clientId|userUuid|scope 分槽。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'

vi.mock('jose', () => ({
  SignJWT: class {
    private payload: Record<string, unknown>
    constructor(payload: Record<string, unknown>) {
      this.payload = payload
    }
    setProtectedHeader(): this {
      return this
    }
    async sign(): Promise<string> {
      return `jwt-${String(this.payload.session_name ?? 'app')}`
    }
  },
}))

const fetchMock = vi.hoisted(() =>
  vi.fn(async (_url: unknown, init?: { headers?: Record<string, string> }) => {
    const auth = init?.headers?.Authorization ?? ''
    const subject = auth.replace('Bearer jwt-', '')
    return {
      ok: true,
      json: async () => ({ access_token: `token-${subject}`, expires_in: 3600 }),
    }
  }),
)

vi.stubGlobal('fetch', fetchMock)

import { clearTokenCache, getCozeAccessToken } from '../src/services/coze-auth-utils.js'

/** jose v6 会真实解析 PEM，测试必须给合法 RSA 私钥而不是任意字符串。 */
const TEST_PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
}).privateKey

beforeEach(() => {
  clearTokenCache()
  fetchMock.mockClear()
  process.env.COZE_OAUTH_APP_ID = 'app-1'
  process.env.COZE_PUBLIC_KEY_ID = 'kid-1'
  process.env.COZE_PRIVATE_KEY = TEST_PRIVATE_KEY
  delete process.env.COZE_PRIVATE_KEY_PATH
})

describe('F-270 Coze token 缓存按主体分槽', () => {
  it('不同 userUuid 各拿各的 token,不会复用对方的', async () => {
    const tokenA = await getCozeAccessToken({ userUuid: 'user-a' })
    const tokenB = await getCozeAccessToken({ userUuid: 'user-b' })

    expect(tokenA).toBe('token-user-a')
    expect(tokenB).toBe('token-user-b')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('同一 userUuid 第二次命中缓存,不再请求上游', async () => {
    await getCozeAccessToken({ userUuid: 'user-a' })
    const again = await getCozeAccessToken({ userUuid: 'user-a' })
    expect(again).toBe('token-user-a')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('应用级(Null userUuid)与用户级是不同槽位', async () => {
    const app = await getCozeAccessToken()
    const user = await getCozeAccessToken({ userUuid: 'user-a' })
    expect(app).toBe('token-app')
    expect(user).toBe('token-user-a')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('scope 不同不得命中同一槽位', async () => {
    await getCozeAccessToken({ userUuid: 'user-a', scope: 'read' })
    await getCozeAccessToken({ userUuid: 'user-a', scope: 'write' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('forceRefresh 绕过缓存', async () => {
    await getCozeAccessToken({ userUuid: 'user-a' })
    await getCozeAccessToken({ userUuid: 'user-a', forceRefresh: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('expires_in 是绝对 Unix 时间戳时，到期后会重新签发而不是长期缓存', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-28T00:00:00Z'))
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({
        access_token: 'token-epoch',
        expires_in: Math.floor(Date.now() / 1000) + 3600,
      }),
    }))
    const first = await getCozeAccessToken({ userUuid: 'user-a' })
    expect(first).toBe('token-epoch')
    vi.advanceTimersByTime(3600 * 1000)
    const second = await getCozeAccessToken({ userUuid: 'user-a' })
    expect(second).toBe('token-epoch')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
