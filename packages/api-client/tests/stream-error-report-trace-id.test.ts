// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-916415 R1(2026-10-07):帧级 traceId 的**端上消费方 = 错误上报**(拍板)。
//
// 流失败时 streamChat 走 onError(message, info) —— 那个 info 就是跨端共用的**错误上报体**
// (SSEErrorInfo:web / mobile-rn / desktop / extension / CLI / miniapp 都从它取结构化
// 字段再渲染/上报)。本文件钉两件事:
//   1. 行为:失败前**本轮 attempt** 见过帧级 traceId ⇒ 上报体带 traceId(经 readStreamTraceId
//      判过的合法值),把客户端这一轮与 ai-service 日志的 trace 串起来;
//   2. 挑字段镜像锁:上报体字段集 = SSEErrorInfo 白名单 —— 运行面按 Object.keys 钉死
//      (防把原始 Error 的 stack 等敏感面整包展开出去),合同面把接口字段集与白名单对账
//      (谁动上报体形状谁过锁,不许静默漂)。
// 与 stream-trace-id-parity.test.ts 分工:那份管"帧里怎么判出 traceId"(值规则对账),
// 本份管"判出的 traceId 进不进错误上报体、上报体允许多胖"。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setBaseUrl, setStreamBaseUrl, streamChat } from '../src/client.js'

const CLIENT_SRC = fileURLToPath(new URL('../src/client.ts', import.meta.url))

const TRACE_ID = '0af7651916cd43dd8448eb211c80319c'
/** 上报体允许携带的字段全集(= SSEErrorInfo;白名单,多一键即红)。 */
const REPORT_BODY_ALLOWED = ['code', 'errorCode', 'recoverable', 'retryAfter', 'traceId']

let responses: Array<{ status: number; body?: string }> = []
let errorInfos: Array<Record<string, unknown> | undefined> = []

function sseResponse(body: string): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body))
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

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, _init: unknown) => {
      const next = responses.shift()
      if (!next) throw new Error('测试夹具:响应队列已空')
      if (next.status >= 300) {
        return {
          ok: false,
          status: next.status,
          headers: { get: () => null },
          text: async () => next.body ?? 'no route',
        } as unknown as Response
      }
      return sseResponse(next.body ?? '')
    }),
  )
}

const TRACE_FRAME = `data: {"traceId":"${TRACE_ID}"}\n\n`
/** 无 code/errorCode/retryAfter 的流内 error 帧 ⇒ 非业务错误,走"重试耗尽后抛"那一支。 */
const ERROR_FRAME = 'data: {"type":"error","message":"provider quota exhausted"}\n\n'

beforeEach(() => {
  responses = []
  errorInfos = []
  setBaseUrl('http://localhost:8803')
  setStreamBaseUrl('http://localhost:8803')
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function runFailingStream(maxRetries: number): Promise<void> {
  await streamChat({
    model: 'test-model',
    messages: [{ role: 'user', content: 'hi' }],
    onDelta: () => {},
    maxRetries,
    onError: (_message: string, info?: unknown) => {
      errorInfos.push(info as Record<string, unknown> | undefined)
    },
  } as never)
}

describe('G-916415 R1:流失败的错误上报体带帧级 traceId', () => {
  it('正例:本轮见过帧级 traceId 后流失败 ⇒ 上报体带 traceId', async () => {
    responses.push({ status: 200, body: TRACE_FRAME + ERROR_FRAME })
    await runFailingStream(0)
    expect(errorInfos).toHaveLength(1)
    expect(errorInfos[0]?.traceId).toBe(TRACE_ID)
    expect(errorInfos[0]?.recoverable).toBe(true)
  })

  it('挑字段镜像锁(运行面):该场景上报体恰为两键,且全部落在白名单内(多一键即红)', async () => {
    responses.push({ status: 200, body: TRACE_FRAME + ERROR_FRAME })
    await runFailingStream(0)
    const keys = Object.keys(errorInfos[0] ?? {}).sort()
    expect(keys).toEqual(['recoverable', 'traceId'])
    for (const key of keys) {
      expect(REPORT_BODY_ALLOWED, `上报体多传了白名单外的字段: ${key}`).toContain(key)
    }
  })

  it('反例:本轮从未见过 traceId 帧 ⇒ 上报体不得出现 traceId 键(连 undefined 值也不行)', async () => {
    responses.push({ status: 200, body: ERROR_FRAME })
    await runFailingStream(0)
    expect(errorInfos).toHaveLength(1)
    const info = errorInfos[0] ?? {}
    expect('traceId' in info).toBe(false)
    expect(Object.keys(info).sort()).toEqual(['recoverable'])
  })

  it('attempt 复位锁:上一轮的 traceId 不得记到下一轮失败的头上', async () => {
    // 第 1 轮:见 traceId 后失败 → 重连;第 2 轮:502 终态 ⇒ 上报体不得再带第 1 轮的 trace。
    responses.push({ status: 200, body: TRACE_FRAME + ERROR_FRAME })
    responses.push({ status: 502 })
    await runFailingStream(1)
    expect(errorInfos).toHaveLength(1)
    const info = errorInfos[0] ?? {}
    expect('traceId' in info).toBe(false)
    expect(Object.keys(info).sort()).toEqual(['code', 'recoverable'])
    expect(info.code).toBe(502)
  }, 15_000)
})

describe('挑字段镜像锁(合同面):SSEErrorInfo 字段集 == 上报体白名单', () => {
  const src = readFileSync(CLIENT_SRC, 'utf8')

  it('接口存在且字段集与白名单逐一对账(谁动上报体形状谁过锁)', () => {
    const start = src.indexOf('export interface SSEErrorInfo {')
    expect(start, 'client.ts 里找不到 SSEErrorInfo 接口').toBeGreaterThan(0)
    const end = src.indexOf('\n}', start)
    expect(end, 'SSEErrorInfo 接口块没找到收口').toBeGreaterThan(start)
    const block = src.slice(start, end)
    const fields = [...block.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]).sort()
    expect(fields).toEqual([...REPORT_BODY_ALLOWED].sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
