// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 主对话 SSE(use-agent-stream)的"access 过期"分档装车证明。
 *
 * 三条臂(缺一不算修好):
 *  ① 401 ⇒ 续期一次,并**用新凭据**重放一次(证明重放不是把旧 token 再发一遍);
 *  ② 续期失败 ⇒ 一次都不重放、不再进指数退避重连阶梯、并给出可见错误;
 *  ③ 对照臂:未过期(200)⇒ 一个多余的续期请求都不发;500(瞬态)⇒ 重连阶梯照旧放行
 *     (反向锁:防止把"该重试的"一起拦死,也防止做出"逢失败都先刷 token"的假尺子)。
 *
 * 摘掉新判据即翻红的取法:把 use-agent-stream.ts 里 `if (res.status === 401)` 那一整块
 * 删掉 ⇒ ①② 红(不会续期、也不会停阶梯);把 `if (authGaveUpRef.current) return` 删掉
 * ⇒ ② 红(3.6s 后出现第二次请求)。
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentStream } from '@/hooks/use-agent-stream'

const api = vi.hoisted(() => ({
  refreshAccessTokenOnce: vi.fn<() => Promise<string | null>>(),
  getToken: vi.fn<() => string | null>(),
}))

vi.mock('@ihui/api-client', () => ({
  refreshAccessTokenOnce: () => api.refreshAccessTokenOnce(),
}))

vi.mock('@/lib/api', () => ({
  getStreamBaseUrl: () => 'http://127.0.0.1:0',
  getToken: () => api.getToken(),
}))

const enc = new TextEncoder()

function sseResponse(lines: string[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const l of lines) controller.enqueue(enc.encode(l + '\n'))
        controller.close()
      },
    }),
    { status: 200 },
  )
}

interface Call {
  url: string
  auth?: string
}

/** 按序返回响应(用尽后复读最后一枚),并把每次请求的 Authorization 头记下来。 */
function stubResponses(...responses: Array<() => Response>) {
  const calls: Call[] = []
  let i = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url: String(_input), auth: headers['Authorization'] })
      const make = responses[Math.min(i, responses.length - 1)]!
      i += 1
      return make()
    }),
  )
  return calls
}

const settle = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

/** 真实等到第一次退避(3000ms)之后 —— 阶梯有没有被拦,只能量出来,不能推断。 */
const pastFirstBackoff = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 3_600))
  })
}

beforeEach(() => {
  api.refreshAccessTokenOnce.mockReset()
  api.getToken.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Agent 主对话 SSE:401 只续期一次并重放一次', () => {
  it('401 ⇒ 续期一次,重放那一跳带的是新凭据,且不报错', async () => {
    api.getToken.mockReturnValueOnce('expired-token').mockReturnValue('fresh-token')
    api.refreshAccessTokenOnce.mockResolvedValue('fresh-token')
    const calls = stubResponses(
      () => new Response('', { status: 401 }),
      () => sseResponse(['event: token\ndata: {"type":"token","data":"a"}\n\n']),
    )

    const { result } = renderHook(() => useAgentStream({ threadId: 't-auth-1' }))
    act(() => result.current.start({ input: 'x' }))
    await settle()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.auth).toBe('Bearer expired-token')
    expect(calls[1]?.auth).toBe('Bearer fresh-token')
    expect(result.current.error).toBeNull()
    expect(result.current.content).toBe('a')
  })

  it('续期失败 ⇒ 不重放、错误可见、重连阶梯整批让路', async () => {
    api.getToken.mockReturnValue('expired-token')
    api.refreshAccessTokenOnce.mockResolvedValue(null)
    const calls = stubResponses(() => new Response('', { status: 401 }))
    const onError = vi.fn()

    const { result } = renderHook(() =>
      useAgentStream({ threadId: 't-auth-2', autoReconnect: true, onError }),
    )
    act(() => result.current.start({ input: 'x' }))
    await settle()

    expect(calls).toHaveLength(1)
    expect(result.current.reconnectAttempt).toBe(0)
    expect(String(result.current.error)).toContain('401')
    expect(onError).toHaveBeenCalledTimes(1)

    // 3.6s 后仍未出现第二次请求:证明"不再重连"是量出来的,不是只读了个计数
    await pastFirstBackoff()
    expect(calls).toHaveLength(1)
  })

  it('重放后仍 401 ⇒ 也只重放一次,然后停下报错(绝不无限重放)', async () => {
    api.getToken.mockReturnValue('expired-token')
    api.refreshAccessTokenOnce.mockResolvedValue('fresh-token')
    const calls = stubResponses(() => new Response('', { status: 401 }))

    const { result } = renderHook(() =>
      useAgentStream({ threadId: 't-auth-3', autoReconnect: true }),
    )
    act(() => result.current.start({ input: 'x' }))
    await settle()
    expect(calls).toHaveLength(2)
    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)

    await pastFirstBackoff()
    expect(calls).toHaveLength(2)
    expect(String(result.current.error)).toContain('401')
  })

  it('对照臂:200 直接成功 ⇒ 一个续期请求都不发', async () => {
    api.getToken.mockReturnValue('fresh-token')
    const calls = stubResponses(
      () => sseResponse(['event: token\ndata: {"type":"token","data":"ok"}\n\n']),
    )

    const { result } = renderHook(() => useAgentStream({ threadId: 't-auth-4' }))
    act(() => result.current.start({ input: 'x' }))
    await settle()

    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
    expect(result.current.content).toBe('ok')
  })

  it('反向锁:500(瞬态)⇒ 续期不发、但重连阶梯照旧放行', async () => {
    api.getToken.mockReturnValue('fresh-token')
    const calls = stubResponses(() => new Response('', { status: 500 }))

    const { result } = renderHook(() =>
      useAgentStream({ threadId: 't-auth-5', autoReconnect: true }),
    )
    act(() => result.current.start({ input: 'x' }))
    await settle()
    await pastFirstBackoff()

    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(result.current.reconnectAttempt).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
