// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-20 回归:流式结束的 stop() 收尾必须有超时兜底。
 *
 * 缺陷:withStopCleanup 在 finally 里 await stop(),而 stop() 的 fetch 无 signal/超时,
 * 上游 stop 端点挂起时生成器永不结束 ⇒ SSE 悬挂 + 账号并发槽位长期占用。
 * 本用例全部走注入的假 fetchImpl,不发任何真实网络请求。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { traeAdapter } from '../src/services/upstream-adapters/trae-adapter.js'
import type {
  AdapterAccountContext,
  NormalizedChatRequest,
} from '../src/services/relay-upstream-adapters.js'

const SSE_TEXT =
  'event: message\ndata: {"delta":"你好"}\n\nevent: done\ndata: {}\n\n'

function makeCtx(): AdapterAccountContext {
  return {
    row: { uid: 'acc-sdb20' } as unknown as AdapterAccountContext['row'],
    credentials: { token: 'jwt-sdb20', refreshToken: 'rt-sdb20', cookies: [], secrets: {} },
  }
}

function makeReq(overrides: Partial<NormalizedChatRequest> = {}): NormalizedChatRequest {
  return {
    model: 'glm-5.3',
    messages: [{ role: 'user', content: '你好' }],
    stream: true,
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sseResponse(text: string): Response {
  return new Response(text, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

type StopBehavior = (init: RequestInit | undefined) => Promise<Response>

/** 打桩 fetch:model_list → 空元数据;chat_sessions → 固定 ids;events → 固定 SSE;stop → 剧本 */
function makeFetchStub(stopBehavior: StopBehavior) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('model_list')) return jsonResponse({ model_configs: [] })
    if (url.endsWith('/stop')) return stopBehavior(init)
    if (url.includes('/events')) return sseResponse(SSE_TEXT)
    return jsonResponse({ data: { chat_session_id: 'cs-sdb20', message_id: 'msg-sdb20' } })
  })
}

async function collectChunks(
  stream: AsyncIterable<Record<string, unknown>>,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for await (const chunk of stream) out.push(chunk)
  return out
}

function deltaContents(chunks: Record<string, unknown>[]): string[] {
  return chunks
    .map((c) => {
      const choices = c.choices
      if (!Array.isArray(choices) || choices.length === 0) return null
      const delta = (choices[0] as { delta?: { content?: unknown } }).delta
      return typeof delta?.content === 'string' ? delta.content : null
    })
    .filter((s): s is string => s !== null)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SDB-20 收尾 stop 超时兜底', () => {
  it('stop 挂起 → 超时 signal 触发后 withStopCleanup 仍返回,SSE 不悬挂', async () => {
    const stopSignalCtrl = new AbortController()
    // 用可控 signal 替代 3s 真等待:钉住"stop 的 fetch 拿到了超时 signal 且会被 abort"
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(stopSignalCtrl.signal)

    let stopInit: RequestInit | undefined
    const fetchImpl = makeFetchStub((init) => {
      stopInit = init
      // 模拟挂起的上游:只有 signal abort 才让 fetch 失败
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('aborted', 'AbortError')),
          { once: true },
        )
      })
    })

    const result = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl })
    const collecting = collectChunks(result.stream!)

    await vi.waitFor(() => expect(stopInit).toBeDefined())
    expect(timeoutSpy).toHaveBeenCalledWith(3000)
    expect(stopInit?.signal).toBe(stopSignalCtrl.signal)
    expect(stopSignalCtrl.signal.aborted).toBe(false)

    stopSignalCtrl.abort()
    const chunks = await collecting
    expect(deltaContents(chunks)).toEqual(['你好'])
  })

  it('stop 抛错被吞,不冒泡到生成器收尾路径', async () => {
    const fetchImpl = makeFetchStub(async () => {
      throw new Error('stop boom')
    })
    const result = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl })

    const chunks = await collectChunks(result.stream!)
    expect(deltaContents(chunks)).toEqual(['你好'])
    expect(
      fetchImpl.mock.calls.some(([url]) => String(url).endsWith('/stop')),
    ).toBe(true)
  })

  it('正常 stop 成功路径行为不变:带 signal、method 与 body 形状不变', async () => {
    const fetchImpl = makeFetchStub(async () => jsonResponse({ ok: true }))
    const result = await traeAdapter.executeChat!(makeCtx(), makeReq(), { fetchImpl })

    const chunks = await collectChunks(result.stream!)
    expect(deltaContents(chunks)).toEqual(['你好'])
    const last = chunks[chunks.length - 1] as {
      choices: Array<{ finish_reason: string | null }>
    }
    expect(last.choices[0]?.finish_reason).toBe('stop')

    const stopCall = fetchImpl.mock.calls.find(([url]) => String(url).endsWith('/stop'))
    expect(stopCall).toBeDefined()
    const init = stopCall![1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.signal?.aborted).toBe(false)
    expect(JSON.parse(String(init.body))).toEqual({
      chat_session_id: 'cs-sdb20',
      user_message_id: 'msg-sdb20',
    })
  })
})
