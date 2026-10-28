// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * G-248 R2(2026-10-16 立):小程序端**消费**帧级 traceId 的装车证明(非视觉通道 = 客户端日志)。
 *
 * 三条腿:
 *  A. **运行时派发**:喂真帧字节序列给真实共享解析面(parseSSEChunk 是 traceId 的唯一认领点),
 *     经真实 `chatStream` dispatch ⇒ 端上投影出口 `onTraceId` 收到的值与上游给的值**逐字节相同**;
 *     上游没给(或给了被判废的值)⇒ 一次都不回调,消费侧保持"未知",不伪装成空串。
 *  B. **接线自证(摘牙对照)**:源码级证明「解析层认领 → 端内 dispatch 透传 → 会话页注册回调 →
 *     进 logger」这条链每一环都真在位,把任一环摘掉本用例必红。
 *  C. **零重复判据**:端内两个文件不得自己再解一次帧或重写 trace 合法性判据(§0.6/§22c)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { parseSSEChunk, type SSEEvent } from '@ihui/shared/utils/sse-parse'

const { mockStreamSSE } = vi.hoisted(() => ({ mockStreamSSE: vi.fn() }))

vi.mock('@/lib/sse', () => ({ streamSSE: mockStreamSSE }))
vi.mock('@/lib/ui-control-tools', () => ({
  resolveAgentTools: (tools: unknown) => tools,
}))
vi.mock('@tarojs/taro', () => ({
  default: {
    getEnv: () => 'WEB',
    ENV_TYPE: { WEB: 'WEB' },
    request: vi.fn(),
    getStorageSync: () => '',
    setStorageSync: () => undefined,
  },
  getEnv: () => 'WEB',
  ENV_TYPE: { WEB: 'WEB' },
  request: vi.fn(),
  getStorageSync: () => '',
  setStorageSync: () => undefined,
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { chatStream, type StreamEventCallbacks } from '@/api'

const HERE = dirname(fileURLToPath(import.meta.url))
const END_ROOT = resolve(HERE, '..', '..', '..', '..')
/**
 * 取被审源码并剥掉行注释:接线自证判的是"这行代码真在位",注释掉不算接上
 * (摘掉接线 ⇒ 本用例必须翻红,否则锁是空的)。
 */
const src = (rel: string): string =>
  readFileSync(join(END_ROOT, rel), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, '')
const API_SRC = src('src/api/index.ts')
const CHAT_SRC = src('src/pkg-ai/ai/chat.tsx')

/** 合法帧级 trace(小写 32 hex、非全 0) */
const TRACE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
/** 全 0 = W3C 判废值 */
const ALL_ZERO = '0'.repeat(32)

const frame = (payload: Record<string, unknown>): string => `data: ${JSON.stringify(payload)}\n\n`

/** 夹具输入的服务端线格式键名(真值住在 @ihui/shared/sse/contract.ts;此处只是喂字节,不重写判据) */
const TRACE_KEY = 'traceId'

const FRAMES_WITH_TRACE =
  frame({ type: 'chunk', content: '正文一', [TRACE_KEY]: TRACE }) +
  frame({ type: 'chunk', content: '正文二', [TRACE_KEY]: TRACE }) +
  frame({ type: 'done', usage: { total_tokens: 12 } })

const FRAMES_WITHOUT_TRACE =
  frame({ type: 'chunk', content: '正文一' }) + frame({ type: 'done', usage: { total_tokens: 3 } })

const FRAMES_WITH_INVALID_TRACE =
  frame({ type: 'chunk', content: '正文一', [TRACE_KEY]: ALL_ZERO }) +
  frame({ type: 'chunk', content: '正文二', [TRACE_KEY]: 'short' }) +
  frame({ type: 'done', usage: { total_tokens: 3 } })

function armTransport(raw: string): void {
  mockStreamSSE.mockImplementation(
    async (opts: {
      onEvent: (evt: SSEEvent) => void
      onReconnect?: (attempt: number, delayMs: number) => void
    }) => {
      const { events } = parseSSEChunk(raw)
      for (const evt of events) opts.onEvent(evt)
    },
  )
}

async function runStream(callbacks: StreamEventCallbacks): Promise<void> {
  await (chatStream as unknown as (...args: unknown[]) => Promise<void>)(
    [],
    'sess-trace-1',
    {},
    vi.fn(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    callbacks,
  )
}

describe('G-248 R2 A. chatStream 运行时投影帧级 traceId', () => {
  beforeEach(() => {
    mockStreamSSE.mockReset()
  })

  it('上游给了 ⇒ onTraceId 收到同一个值,且逐字节相同、本轮只回调一次', async () => {
    armTransport(FRAMES_WITH_TRACE)
    const onTraceId = vi.fn()
    await runStream({ onTraceId })
    expect(onTraceId).toHaveBeenCalledTimes(1)
    expect(onTraceId.mock.calls[0]?.[0]).toBe(TRACE)
  })

  it('上游没给 ⇒ 一次都不回调(消费侧保持未知态,不得伪装成空串)', async () => {
    armTransport(FRAMES_WITHOUT_TRACE)
    const onTraceId = vi.fn()
    await runStream({ onTraceId })
    expect(onTraceId).not.toHaveBeenCalled()
    const emptyish = onTraceId.mock.calls.flat()
    expect(emptyish).not.toContain('')
    expect(emptyish).not.toContain('unknown')
  })

  it('上游给的是判废值(全 0 / 非 32 hex)⇒ 同样不回调,端内不自造兜底值', async () => {
    armTransport(FRAMES_WITH_INVALID_TRACE)
    const onTraceId = vi.fn()
    await runStream({ onTraceId })
    expect(onTraceId).not.toHaveBeenCalled()
  })

  it('未注册 onTraceId 的端内调用方不炸流', async () => {
    armTransport(FRAMES_WITH_TRACE)
    await expect(runStream({})).resolves.toBeUndefined()
  })

  it('重连是一条新请求 ⇒ 复位本轮 trace,新 attempt 的值可再被认领(不记到上一轮头上)', async () => {
    const NEXT = 'fffffffffffffffffffffffffffffff1'
    mockStreamSSE.mockImplementation(
      async (opts: {
        onEvent: (evt: SSEEvent) => void
        onReconnect?: (attempt: number, delayMs: number) => void
      }) => {
        for (const evt of parseSSEChunk(FRAMES_WITH_TRACE).events) opts.onEvent(evt)
        opts.onReconnect?.(1, 1000)
        for (const evt of parseSSEChunk(
          frame({ type: 'chunk', content: '续传正文', [TRACE_KEY]: NEXT }),
        ).events) {
          opts.onEvent(evt)
        }
      },
    )
    const onTraceId = vi.fn()
    await runStream({ onTraceId })
    expect(onTraceId.mock.calls.map((c) => c[0])).toEqual([TRACE, NEXT])
  })
})

describe('G-248 R2 B. 消费链接线自证(任一环摘线即红)', () => {
  it('解析层认领 → 端内 dispatch 透传 evt.traceId', () => {
    expect(API_SRC).toMatch(/if \(seenTraceId === undefined && evt\.traceId\)/)
    expect(API_SRC).toMatch(/callbacks\?\.onTraceId\?\.\(evt\.traceId\)/)
    expect(API_SRC).toMatch(/onTraceId\?: \(traceId: string\) => void/)
  })

  it('会话页注册 onTraceId 并把原值写进本轮 ref', () => {
    expect(CHAT_SRC).toMatch(/onTraceId: \(traceId\) => \{/)
    expect(CHAT_SRC).toMatch(/roundTraceIdRef\.current = traceId/)
  })

  it('值进客户端日志既有通道(@/utils/logger),info 与失败轮 error 都带上', () => {
    expect(CHAT_SRC).toMatch(/import \{ logger \} from '@\/utils\/logger'/)
    expect(CHAT_SRC).toMatch(/logger\.info\('pkg-ai\/ai\/chat', 'stream traceId', traceId\)/)
    expect(CHAT_SRC).toMatch(/logger\.error\(\s*'pkg-ai\/ai\/chat',\s*'stream failed',/)
    expect(CHAT_SRC).toMatch(/traceId: roundTraceId/)
  })

  it('三态纪律:没见过 ⇒ 不写 traceId 键(不折空串)', () => {
    expect(CHAT_SRC).toMatch(
      /roundTraceId === undefined\s*\n?\s*\? \{ code: formatted\.code, message: formatted\.message \}/,
    )
  })

  it('新一轮开始复位本轮 trace(旧 trace 不得挂到新轮次)', () => {
    expect(CHAT_SRC).toMatch(/roundTraceIdRef\.current = undefined/)
  })
})

describe('G-248 R2 C. 端内零重复判据', () => {
  it('端内不重写 trace 合法性判据,也不再解一次帧', () => {
    for (const [name, code] of [
      ['src/api/index.ts', API_SRC],
      ['src/pkg-ai/ai/chat.tsx', CHAT_SRC],
    ]) {
      expect(code, name).not.toMatch(/\[0-9a-f\]\{32\}/i)
      expect(code, name).not.toMatch(/normalizeSSEFrameTraceId/)
      expect(code, name).not.toMatch(/JSON\.parse\(.*data:/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
