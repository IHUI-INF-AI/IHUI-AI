// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 上行 tool-result 帧的 error 字段归一回归(2026-09-26 立)。
 *
 * 事故形态:调用方在 catch 里把 Error 本体(as 强转)塞进 postToolResult 的
 * error:string|null 参数 → JSON.stringify 得 "{}" → ai-service 的 tool loop
 * 收到空对象事故现场。经唯一出口 serializeError 压成单行链后 message 必须可见,
 * 而合规 string 输入必须逐字节原样(不破坏任何既有调用方)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { postToolResult } from '../src/client.js'

interface Sent {
  url: string
  body: string
}

function stubFetchCapturingBodies(calls: Sent[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: unknown): Promise<Response> => {
      calls.push({ url: String(url), body: String((init as { body?: unknown }).body ?? '') })
      return new Response('', { status: 200 })
    }),
  )
}

describe('postToolResult error 字段上线路径', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Error 对象经我方出口后 message 在请求体可见(旧行为是 "{}")', async () => {
    const calls: Sent[] = []
    stubFetchCapturingBodies(calls)
    const err = new Error('fs read failed')
    await postToolResult('s1', 'tc1', null, err as unknown as string)
    const first = calls.at(-1)
    expect(first).toBeDefined()
    const payload = JSON.parse(first?.body ?? '{}') as { error: unknown }
    expect(typeof payload.error).toBe('string')
    expect(String(payload.error)).toContain('fs read failed')
    expect(payload.error).not.toBe('{}')
  })

  it('cause 链在 wire 上逐层可见', async () => {
    const calls: Sent[] = []
    stubFetchCapturingBodies(calls)
    const inner = new Error('root cause')
    const outer = new Error('wrapper') as Error & { cause?: unknown }
    outer.cause = inner
    await postToolResult('s2', 'tc2', null, outer as unknown as string)
    const payload = JSON.parse(calls.at(-1)?.body ?? '{}') as { error: string }
    expect(payload.error).toContain('wrapper')
    expect(payload.error).toContain('<- Error: root cause')
  })

  it('合规 string 输入逐字节原样(零行为变化)', async () => {
    const calls: Sent[] = []
    stubFetchCapturingBodies(calls)
    await postToolResult('s3', 'tc3', null, 'No active workspace')
    const payload = JSON.parse(calls.at(-1)?.body ?? '{}') as { error: string | null }
    expect(payload.error).toBe('No active workspace')
  })

  it('null 保持 null(不把"无错误"写成空串)', async () => {
    const calls: Sent[] = []
    stubFetchCapturingBodies(calls)
    await postToolResult('s4', 'tc4', 'ok', null)
    const payload = JSON.parse(calls.at(-1)?.body ?? '{}') as { error: string | null }
    expect(payload.error).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
