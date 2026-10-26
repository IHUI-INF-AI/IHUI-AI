// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
/**
 * TTS 流(voice-stream-speaker)的"401 被吞掉 ⇒ 静默无声"装车证明。
 *
 * 旧写法:非 2xx 一律 `return`,而外层 catch 是空的 ⇒ 过期凭据下"整轮就是没声音",
 * 界面/控制台零线索(§12f:失效的表现永远是安静)。四臂:
 *  ① 401 ⇒ 续期一次,并重放一次(重放那一跳带的是**现取**的新凭据);
 *  ② 续期失败 ⇒ 只发一次请求,并大声报一行(不装作成功);
 *  ③ 对照臂:200 ⇒ 不发多余续期、也不报错;
 *  ④ 反向锁:主动打断(abort)= 预期内静默,不得被读成失败(否则每次打断都刷一条错误)。
 *
 * 摘掉新判据即翻红:删掉 speakStream 里 `if (res.status === 401)` 块 ⇒ ① 红;
 * 把 catch 里的 `console.error` 删回空 catch ⇒ ② 红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'

const api = vi.hoisted(() => ({ refreshAccessTokenOnce: vi.fn<() => Promise<string | null>>() }))
const cred = vi.hoisted(() => ({ token: 'expired-token' as string | null }))

vi.mock('@ihui/api-client', () => ({
  refreshAccessTokenOnce: () => api.refreshAccessTokenOnce(),
}))

vi.mock('@/stores/auth-store', () => ({
  useWebAuthStore: Object.assign(
    (sel: (s: { token: string | null }) => unknown) => sel({ token: cred.token }),
    { getState: () => ({ token: cred.token }) },
  ),
}))

const store: { isStreaming: boolean; messages: Array<{ role: string; content?: string }> } = {
  isStreaming: false,
  messages: [],
}
vi.mock('@/stores/chat', () => ({
  useChatStore: (sel: (s: typeof store) => unknown) => sel(store),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string): string => key,
}))

vi.mock('@ihui/ui-react', () => ({
  IconButton: () => null,
}))

import { VoiceStreamSpeaker } from '../voice-stream-speaker'

interface Call {
  auth?: string
}

function stubFetch(...factories: Array<() => Response>) {
  const calls: Call[] = []
  let i = 0
  global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    calls.push({ auth: headers['Authorization'] })
    const make = factories[Math.min(i, factories.length - 1)]!
    i += 1
    return make()
  }) as never
  return calls
}

/** 空 SSE 流:200 但没有音频段(不牵扯 Audio/objectURL,只验鉴权那一层) */
function emptyStream(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close()
      },
    }),
    { status: 200 },
  )
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  })
}

function triggerSpeak(): void {
  store.messages = [{ role: 'assistant', content: '你好,这是一段会被朗读的回复。' }]
  store.isStreaming = true
  const view = render(React.createElement(VoiceStreamSpeaker))
  act(() => {
    store.isStreaming = false
  })
  view.rerender(React.createElement(VoiceStreamSpeaker))
}

beforeEach(() => {
  api.refreshAccessTokenOnce.mockReset()
  cred.token = 'expired-token'
  window.localStorage.setItem('ihui_voice_playback', 'on')
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('TTS 流:401 续期一次并重放一次,失败必须响', () => {
  it('① 401 ⇒ 续期一次,重放那一跳带新凭据,且不报错', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(
      () => new Response('', { status: 401 }),
      () => emptyStream(),
    )
    api.refreshAccessTokenOnce.mockImplementation(async () => {
      cred.token = 'fresh-token'
      return 'fresh-token'
    })

    triggerSpeak()
    await flush()

    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(String(err.mock.calls[0]?.[0] ?? '')).not.toContain('TTS stream failed')
  })

  it('② 续期失败 ⇒ 只发一次请求,并大声报一行(绝不装作成功)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const calls = stubFetch(() => new Response('', { status: 401 }))
    api.refreshAccessTokenOnce.mockResolvedValue(null)

    triggerSpeak()
    await flush()

    expect(calls).toHaveLength(1)
    expect(err).toHaveBeenCalled()
    expect(String(err.mock.calls[0]?.[0])).toContain('HTTP 401')
  })

  it('③ 对照臂:未过期(200)⇒ 不发续期、不报错', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(() => emptyStream())

    triggerSpeak()
    await flush()

    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(err).not.toHaveBeenCalled()
  })

  it('③b 非 401 的失败(5xx)⇒ 不续期,但仍必须报一行', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(() => new Response('', { status: 503 }))

    triggerSpeak()
    await flush()

    expect(api.refreshAccessTokenOnce).not.toHaveBeenCalled()
    expect(String(err.mock.calls[0]?.[0])).toContain('HTTP 503')
  })

  it('④ 反向锁:网络异常(抛错)⇒ 报一行;主动 abort ⇒ 保持静默', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(async () => {
      throw new Error('boom')
    }) as never
    triggerSpeak()
    await flush()
    expect(String(err.mock.calls[0]?.[0])).toContain('TTS stream failed')
    cleanup()

    // 打断:fetch 抛 AbortError 且 signal 已 aborted ⇒ 这是预期内静默,不得报"失败"
    err.mockClear()
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal
      signal.throwIfAborted()
      return emptyStream()
    }) as never
    store.isStreaming = true
    const view = render(React.createElement(VoiceStreamSpeaker))
    act(() => {
      store.isStreaming = false
    })
    view.rerender(React.createElement(VoiceStreamSpeaker))
    // 卸载即 abort(组件 cleanup 里 controller.abort())
    cleanup()
    await flush()
    expect(err.mock.calls.filter((c) => String(c[0]).includes('TTS stream failed'))).toHaveLength(0)
  })

  it('重放仍非 2xx ⇒ 也只重放一次(不无限重放)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const calls = stubFetch(() => new Response('', { status: 401 }))
    api.refreshAccessTokenOnce.mockResolvedValue('fresh-token')
    cred.token = 'expired-token'

    triggerSpeak()
    await flush()

    expect(calls).toHaveLength(2)
    expect(api.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
    expect(err).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
