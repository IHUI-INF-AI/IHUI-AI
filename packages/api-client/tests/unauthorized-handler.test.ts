// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 401 处理器注册口 `setUnauthorizedHandler` 的行为验证(2026-09-25 立)。
 *
 * 与 `fetch-api-baseline.test.ts` 的分工:那一支证明"没注册时行为逐字不变",
 * 这一支证明"注册后触发时机正确"。两条合起来才是本票的验收 ——
 * 只测后者会放过"顺手改了返回值/重试次数"这类回归,只测前者根本测不到新能力。
 *
 * 触发时机的定义(与实现一一对应):
 *   收到 401 → 尝试静默续期 → **续期后仍拿不到 token** ⇒ 通知(恰好一次)
 *   收到 401 → 续期拿到 token → 重试 ⇒ 不通知(否则 bootstrap 静默刷新期间会误弹)
 *   认证端点自身的 401(登录密码错等)⇒ 不通知(那是最终结果,且会递归)
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  fetchApi,
  setTokenProvider,
  setUnauthorizedHandler,
  getUnauthorizedHandler,
  setCircuitBreaker,
  __resetRefreshStateForTest,
  type UnauthorizedContext,
} from '../src/client.js'
import { setTransport, type Transport, type TransportResponse } from '../src/transport.js'
import { CircuitBreaker } from '../src/circuit-breaker.js'

function jsonResponse(status: number, body: unknown): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as TransportResponse
}

/** 每次都回同一个状态码的传输桩(测触发次数时不需要区分重试前后) */
function always(status: number, body: unknown): Transport {
  return (async () => jsonResponse(status, body)) as unknown as Transport
}

interface Harness {
  contexts: UnauthorizedContext[]
  refresh: ReturnType<typeof vi.fn>
}

/** 装一个必然 401 的传输层 + 可控续期结果的 tokenProvider + 记录型处理器 */
function harness(opts: { refreshReturns: string | null }): Harness {
  const contexts: UnauthorizedContext[] = []
  const refresh = vi.fn(async () => opts.refreshReturns)
  setTransport(always(401, { code: 40101, message: '登录已过期' }))
  setTokenProvider({ getToken: () => 'expired-token', refreshAccessToken: refresh })
  setUnauthorizedHandler((ctx) => {
    contexts.push(ctx)
  })
  return { contexts, refresh }
}

describe('setUnauthorizedHandler 触发时机', () => {
  afterEach(() => {
    setTransport(undefined as unknown as Transport)
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler(null)
    setCircuitBreaker(null)
    __resetRefreshStateForTest()
  })

  it('401 且续期失败 ⇒ 回调被调用恰好一次,ApiResult 形态不变', async () => {
    const { contexts, refresh } = harness({ refreshReturns: null })

    const result = await fetchApi<{ id: string }>('/skills', { method: 'DELETE' })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toEqual({ url: '/api/skills', method: 'DELETE' })
    // 返回值仍是既有的失败分支形态:本票没有往里塞任何字段
    expect(result).toEqual({
      success: false,
      error: '登录已过期',
      status: 401,
      errorCode: undefined,
      retryAfter: undefined,
    })
  })

  it('401 且续期成功 ⇒ 不调用回调(静默续期不得被当成掉线)', async () => {
    const { contexts, refresh } = harness({ refreshReturns: 'fresh-token' })

    const result = await fetchApi<{ id: string }>('/skills', { method: 'POST' })

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(contexts).toHaveLength(0)
    // 续期成功后走的是重试路径 —— 传输桩恒 401,所以最终仍是 401,但那一次不通知
    expect(result.success).toBe(false)
  })

  it('未注入 refreshAccessToken 的端(拿不到凭据)⇒ 401 也通知一次', async () => {
    const contexts: UnauthorizedContext[] = []
    setTransport(always(401, { code: 40101, message: 'gone' }))
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler((ctx) => contexts.push(ctx))

    await fetchApi('/things', { method: 'POST' })

    expect(contexts).toEqual([{ url: '/api/things', method: 'POST' }])
  })

  it('认证端点的 401 不通知(那是最终结果,通知会造成弹窗递归)', async () => {
    const contexts: UnauthorizedContext[] = []
    setTransport(always(401, { code: 40101, message: 'bad credentials' }))
    setTokenProvider({ getToken: () => null, refreshAccessToken: async () => 'never' })
    setUnauthorizedHandler((ctx) => contexts.push(ctx))

    const result = await fetchApi('/auth/login', { method: 'POST' })

    expect(result.success).toBe(false)
    expect(contexts).toHaveLength(0)
  })

  it('GET 的 401 同样通知并带出 method:策略由各端决定,共享层不写死', async () => {
    const contexts: UnauthorizedContext[] = []
    setTransport(always(401, { code: 40101, message: 'gone' }))
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler((ctx) => contexts.push(ctx))

    await fetchApi('/things') // 不写 method ⇒ fetch 默认 GET

    expect(contexts).toEqual([{ url: '/api/things', method: 'GET' }])
  })

  it('小写 method 归一为大写(端内按 method !== "GET" 判定时不能漏掉 post)', async () => {
    const contexts: UnauthorizedContext[] = []
    setTransport(always(401, { code: 40101, message: 'gone' }))
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler((ctx) => contexts.push(ctx))

    await fetchApi('/things', { method: 'post' })

    expect(contexts[0]?.method).toBe('POST')
  })

  it('带熔断器的路径同样恰好通知一次(两条 401 出口都在射程内)', async () => {
    const contexts: UnauthorizedContext[] = []
    const breaker = new CircuitBreaker('unauthorized-handler-test', { failureThreshold: 50 })
    setCircuitBreaker(breaker)
    setTransport(always(401, { code: 40101, message: 'gone' }))
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler((ctx) => contexts.push(ctx))

    await fetchApi('/things', { method: 'PATCH' })

    expect(contexts).toEqual([{ url: '/api/things', method: 'PATCH' }])
    setCircuitBreaker(null)
  })

  it('处理器抛错 ⇒ 不影响 fetchApi 返回,且留下可诊断日志(不静默吞)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    setTransport(always(401, { code: 40101, message: 'gone' }))
    setTokenProvider({ getToken: () => null })
    setUnauthorizedHandler(() => {
      throw new Error('端内弹窗逻辑炸了')
    })

    const result = await fetchApi<{ id: string }>('/things', { method: 'POST' })

    expect(result).toEqual({
      success: false,
      error: 'gone',
      status: 401,
      errorCode: undefined,
      retryAfter: undefined,
    })
    expect(errSpy).toHaveBeenCalledTimes(1)
    const logged = String(errSpy.mock.calls[0]?.[0]) + String(errSpy.mock.calls[0]?.[1])
    expect(logged).toContain('api-client')
    expect(logged).toContain('端内弹窗逻辑炸了')
    errSpy.mockRestore()
  })

  it('传 null 可撤销注入(端内卸载/测试隔离)', async () => {
    setUnauthorizedHandler(() => undefined)
    expect(getUnauthorizedHandler()).not.toBeNull()
    setUnauthorizedHandler(null)
    expect(getUnauthorizedHandler()).toBeNull()
  })
})

describe('反向对照:client.ts 里不得长出第二套弹窗实现', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/client.ts', import.meta.url)), 'utf8')
  /**
   * 行级粗筛:跳过纯注释行(以 `//`、`*`、`/*` 开头)。
   * 够用于本断言 —— 我们要否证的是"代码里实现了弹窗",那必然落在非注释行上;
   * 而注释里提到 `apps/web/src/lib/api.ts`(实现说明)是正当的,已由本筛排除。
   */
  const code = source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n')

  for (const token of [
    'openLoginDialog',
    'document.',
    'window.',
    'localStorage',
    'sessionStorage',
    'location.href',
    'navigateTo',
    '@ihui/ui-react',
    'apps/web',
  ]) {
    it(`代码面不含 "${token}"(共享包只通知,不实现 UI)`, () => {
      expect(code).not.toContain(token)
    })
  }

  it('通知出口只有一个私有 notifyUnauthorized,且调用点恰好 2 处(无熔断 / 有熔断)', () => {
    expect(code.match(/function notifyUnauthorized\(/g)).toHaveLength(1)
    // 未 export:端内只能通过 setUnauthorizedHandler 接进来,不存在第二条口子
    expect(code).not.toMatch(/export\s+(const|function)\s+notifyUnauthorized/)
    expect(code.match(/notifyUnauthorized\(normalizedUrl/g)).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
