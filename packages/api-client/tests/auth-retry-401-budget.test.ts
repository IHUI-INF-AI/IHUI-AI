// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「只续一次」的边界格:网络异常 × 401 续期重放 交叉时,两者各自的预算不许互相挤掉
 * (2026-10-26 立,起因:api-client 跨腿续期闸评估)。
 *
 * 病灶(现读 `packages/api-client/src/client.ts` 的 fetchApi 无熔断分支):
 * 网络重试与 401 续期重放**共用同一个循环计数**。于是「先网络异常、后 401、
 * 续期成功」这一格里,续期重放的 continue 把计数推过循环上限 ⇒ 循环直接退出 ⇒
 * **新 token 与 401 结果双双丢弃**,还返回**上一跳的网络错误文案**——
 * 刷新明明成功了,这次请求却失败(用户侧表现为"又要重新登录",正是本条线的原始诉求)。
 *
 * 本文件钉四件事:
 *  - ①「网络异常 → 401 → 续期成功」⇒ 必须用新 token 重放并**拿到成功结果**
 *    (改前:返回网络错误文案,刷新成功却请求失败);
 *  - ② 同场景下重放后仍 401 ⇒ 通知端内**恰好一次**,且**不二次续期**;
 *  - ③ 网络异常自身的预算仍是 1 次(不许被本次修复顺手放宽成无限重试);
 *  - ④ fetchText 这条腿的 401 续期契约(此前只有实现、**没有**任何用例钉住:
 *    `auth-retry-401.test.ts` 的头注释声称覆盖 fetchText,实际 import 里并没有它)。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTransport, type Transport, type TransportInit } from '../src/transport.js'
import {
  __resetRefreshStateForTest,
  fetchApi,
  fetchText,
  setBaseUrl,
  setTokenProvider,
  setUnauthorizedHandler,
} from '../src/client.js'

const OLD = 'old-access'
const NEW = 'new-access'

/**
 * 记录每次请求的 Authorization 与调用序号;按脚本抛错或返回响应。
 * `respond` 抛出的错误 = 网络异常(无 status),这正是本文件要踩的那一格。
 */
function scriptedTransport(
  respond: (call: number) => {
    ok: boolean
    status: number
    headers: { get: (name: string) => string | null }
    text: () => Promise<string>
    json?: () => Promise<unknown>
  },
): { auths: string[]; calls: () => number } {
  const auths: string[] = []
  let call = 0
  const transport = vi.fn(async (_url: string, init: TransportInit) => {
    auths.push(init.headers?.Authorization ?? '')
    call++
    return respond(call)
  }) as unknown as Transport
  setTransport(transport)
  return { auths, calls: () => call }
}

/**
 * 响应替身:`fetchOnce` 读的是 `response.text()` 与 `response.headers.get('retry-after')`
 * (401 的文案/错误码由正文派生),故这两个口都必须有 —— 少一个会在 fetchOnce 里炸成
 * TypeError,被外层读成"网络异常",用例测的就不是它想测的那一格了。
 */
function jsonResponse(
  status: number,
  body: unknown,
): {
  ok: boolean
  status: number
  headers: { get: (name: string) => string | null }
  text: () => Promise<string>
  json: () => Promise<unknown>
} {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  }
}

beforeEach(() => {
  __resetRefreshStateForTest()
  setBaseUrl('')
})

afterEach(() => {
  __resetRefreshStateForTest()
  setTransport(undefined as unknown as Transport)
  setTokenProvider({ getToken: () => null })
  setUnauthorizedHandler(null)
  setBaseUrl('')
})

describe('fetchApi:网络异常 × 401 续期重放的交叉格(预算不互相挤掉)', () => {
  it('① 网络异常 → 401 → 续期成功 ⇒ 用新 token 重放并拿到成功结果', async () => {
    // 脚本:第 1 跳网络异常,第 2 跳 401(access 过期),第 3 跳 200(带新 token)。
    const { auths, calls } = scriptedTransport((call) => {
      if (call === 1) throw new Error('boom')
      if (call === 2) return jsonResponse(401, { code: 40101, message: '登录已过期' })
      return jsonResponse(200, { code: 0, message: 'ok', data: { id: 'x' } })
    })
    const refresh = vi.fn(async () => NEW)
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })

    const result = await fetchApi<{ id: string }>('/things', { method: 'POST' })

    // 关键断言:刷新成功了,这次请求就必须拿到**成功结果**,而不是网络错误文案。
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: 'x' })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls()).toBe(3)
    // 第 3 跳必须带新 token —— 新 token 被拿到了却没被用上,就是改前那个病灶。
    expect(auths).toEqual([`Bearer ${OLD}`, `Bearer ${OLD}`, `Bearer ${NEW}`])
  })

  it('② 同场景重放后仍 401 ⇒ 通知端内恰好一次,且不二次续期', async () => {
    const { auths, calls } = scriptedTransport((call) => {
      if (call === 1) throw new Error('boom')
      return jsonResponse(401, { code: 40101, message: 'gone' })
    })
    const refresh = vi.fn(async () => NEW)
    const contexts: unknown[] = []
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })
    setUnauthorizedHandler((ctx) => contexts.push(ctx))

    const result = await fetchApi('/things', { method: 'POST' })

    expect(result.success).toBe(false)
    // 只续一次(红线:一次请求只续一次,新凭据也被拒 = 会话真死)
    expect(refresh).toHaveBeenCalledTimes(1)
    // 新凭据也被拒 ⇒ 通知端内恰好一次(否则端内永远进不了登录页)
    expect(contexts).toHaveLength(1)
    expect(auths).toEqual([`Bearer ${OLD}`, `Bearer ${OLD}`, `Bearer ${NEW}`])
    expect(calls()).toBe(3)
  })

  it('③ 网络异常自身的预算仍是 1 次(连续两次网络异常 ⇒ 直接失败,不无限重试)', async () => {
    const { calls } = scriptedTransport(() => {
      throw new Error('boom')
    })
    const refresh = vi.fn(async () => NEW)
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })

    const result = await fetchApi('/things', { method: 'POST' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('boom')
    // 既有语义:网络异常重试 1 次 ⇒ 共 2 次尝试
    expect(calls()).toBe(2)
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('fetchText:401 续期一次并重放(此前无任何用例钉住这条腿)', () => {
  it('首次 401 ⇒ 续期后用新 Bearer 重放,拿到文本', async () => {
    const { auths, calls } = scriptedTransport((call) =>
      call === 1
        ? { ok: false, status: 401, text: async () => 'expired' }
        : { ok: true, status: 200, text: async () => 'exported-text' },
    )
    const refresh = vi.fn(async () => NEW)
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })

    const out = await fetchText('/api/chat/conversations/1/export')

    expect(out).toBe('exported-text')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(auths).toEqual([`Bearer ${OLD}`, `Bearer ${NEW}`])
    expect(calls()).toBe(2)
  })

  it('续期失败 ⇒ 原错误上抛(status 保留 401),不无限重放', async () => {
    const { auths, calls } = scriptedTransport(() => ({
      ok: false,
      status: 401,
      text: async () => 'expired',
    }))
    const refresh = vi.fn(async () => null)
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })

    await expect(fetchText('/api/chat/conversations/1/export')).rejects.toMatchObject({
      status: 401,
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    // 续期失败 ⇒ 不重放(只发一次)
    expect(auths).toEqual([`Bearer ${OLD}`])
    expect(calls()).toBe(1)
  })

  it('重放后仍 401 ⇒ 原错误上抛,不再二次续期', async () => {
    const { calls } = scriptedTransport(() => ({
      ok: false,
      status: 401,
      text: async () => 'expired',
    }))
    const refresh = vi.fn(async () => NEW)
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })

    await expect(fetchText('/api/chat/conversations/1/export')).rejects.toMatchObject({
      status: 401,
    })
    // 红线:一条腿只续一次
    expect(refresh).toHaveBeenCalledTimes(1)
    // 首发 + 重放共 2 次,不再续期、不再重放
    expect(calls()).toBe(2)
  })

  it('非 401(5xx)⇒ 不触发续期', async () => {
    const { calls } = scriptedTransport(() => ({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    }))
    const refresh = vi.fn(async () => NEW)
    setTokenProvider({ getToken: () => OLD, refreshAccessToken: refresh })

    await expect(fetchText('/api/chat/conversations/1/export')).rejects.toMatchObject({
      status: 503,
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(calls()).toBe(1)
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‍‍‌‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‌‌‌‌‍‍‌‍‍‌‌‌‍‍‌‌‌‌‌‍‍‌‍‍‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‍‍‌‌‍‍** ⁠
