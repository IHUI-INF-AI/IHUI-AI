// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * G-248 R2(2026-10-18 补 RN 腿):RN 端**消费**帧级 traceId 的装车证明(非视觉通道 = 客户端日志)。
 *
 * 三条腿,口径逐条照小程序参照件 `apps/miniapp-taro/src/pkg-ai/ai/__tests__/chat-stream-trace-id-consume.test.ts`:
 *  A. 运行时派发:喂真帧字节给真实 `streamChat`(api-client 是 traceId 的唯一认领点)⇒ 端上注册的
 *     `onTraceId` 收到的值与上游给的值逐字节相同;上游没给 ⇒ 一次都不回调(未知不得伪装成空串)。
 *  B. 接线自证:屏内「注册回调 → 每轮复位 → 失败轮把 trace 交给 logger」三环都真在位(注释掉不算接上)。
 *  C. 零重复判据 + 摘牙对照:屏内不得再解帧/再写一份 trace 合法性判据;把注册那一环摘掉,判据必红。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { setBaseUrl, setStreamBaseUrl, streamChat } from '@ihui/api-client'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 剥行注释与块注释:接线自证判的是"这行代码真在位",注释掉不算接上。 */
const strip = (s: string): string =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, '')
const SCREEN = strip(readFileSync(join(HERE, '../src/screens/ChatScreen.tsx'), 'utf8'))

const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(`${c}\n`))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: { get: () => null },
    text: async () => '',
  } as unknown as Response
}

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user' as const, content: 'hi' }],
  // StreamChatOptions 里 onDelta 是必填(缺席 = 正文没人接),本用例不关心正文,只观察 trace 派发
  onDelta: () => {},
}

describe('A 运行时派发:真实 streamChat 把帧级 traceId 交给端上注册的回调', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('帧带合法 traceId ⇒ onTraceId 收到逐字节相同的值', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `data: {"type":"delta","content":"x","traceId":"${TRACE}"}`,
        '',
        'data: {"type":"done"}',
        '',
        'data: [DONE]',
        '',
      ]),
    )
    const onTraceId = vi.fn()
    await streamChat({ ...baseOpts, onTraceId, signal: new AbortController().signal })
    expect(onTraceId).toHaveBeenCalledWith(TRACE)
  })

  it('帧不带 traceId ⇒ 一次都不回调(消费侧保持"未知",不折成空串)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse(['data: {"type":"delta","content":"x"}', '', 'data: [DONE]', '']),
    )
    const onTraceId = vi.fn()
    await streamChat({ ...baseOpts, onTraceId, signal: new AbortController().signal })
    expect(onTraceId).not.toHaveBeenCalled()
  })

  it('全 0 的 trace 被判废 ⇒ 不派发(合法性只由 api-client 一处判,端内不得二次放行)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `data: {"type":"delta","content":"x","traceId":"${'0'.repeat(32)}"}`,
        '',
        'data: [DONE]',
        '',
      ]),
    )
    const onTraceId = vi.fn()
    await streamChat({ ...baseOpts, onTraceId, signal: new AbortController().signal })
    expect(onTraceId).not.toHaveBeenCalled()
  })
})

describe('B 接线自证:屏内三环都在位', () => {
  it('注册 onTraceId 出口,且只认本轮第一个值(不得被后续帧顶掉)', () => {
    expect(SCREEN).toMatch(/onTraceId: \(traceId\) => \{/)
    expect(SCREEN).toMatch(/if \(roundTraceIdRef\.current !== undefined\) return/)
    expect(SCREEN).toMatch(/roundTraceIdRef\.current = traceId/)
  })

  it('每轮开始复位上一轮的 trace(旧账不得挂到新消息上)', () => {
    expect(SCREEN).toMatch(
      /abortRef\.current = controller\s*\n\s*roundTraceIdRef\.current = undefined/,
    )
  })

  it('失败轮把 trace 交给 logger:没见过就不写这个键(绝不写空串/undefined 顶掉"无键"这一态)', () => {
    expect(SCREEN).toMatch(/const roundTraceId = roundTraceIdRef\.current/)
    expect(SCREEN).toMatch(
      /roundTraceId === undefined\s*\n?\s*\?\s*\{[^}]*\}\s*:\s*\{[^}]*traceId: roundTraceId/,
    )
    expect(SCREEN).not.toMatch(/traceId: roundTraceIdRef\.current \?\? ''/)
  })
})

describe('C 零重复判据 + 摘牙对照', () => {
  it('屏内不再解帧、不再写第二份 trace 合法性判据(§0.6/§22c)', () => {
    expect(SCREEN).not.toMatch(/\[\s*32\s*\]|\\1[0-9a-f]\{32\}/)
    expect(SCREEN).not.toMatch(/traceId[^;\n]{0,40}readStreamTraceId/)
    expect(SCREEN).not.toMatch(/const\s+\w*TRACE\w*VALID/)
  })

  it('摘牙对照:把注册那一环摘掉后,B 段判据必须读成"没接上"', () => {
    const withoutRegistration = SCREEN.replace(
      /\n\s*onTraceId: \(traceId\) => \{[\s\S]*?\n\s*\},\n/,
      '\n',
    )
    expect(withoutRegistration).not.toBe(SCREEN)
    expect(withoutRegistration).not.toMatch(/onTraceId: \(traceId\) => \{/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
