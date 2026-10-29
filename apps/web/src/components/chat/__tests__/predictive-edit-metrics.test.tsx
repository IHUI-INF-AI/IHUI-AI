// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Predictive Edit 接受率埋点单测(B01 票挖出的缺口,2026-10-27)。
 *
 * 立因:全仓此前唯一 `/api/llm/fim/metrics` 上报点(CodeEditor.tsx)body 不带 scene,
 * 落缺省 completion 桶;预测式编辑链路零上报 ⇒ 看板 summary 的 `scene=edit_intent`
 * 桶没有生产者、接受率恒空(后端 `rate = accepted/suggestions`)。
 *
 * 覆盖:
 *   ① 「应用」终点 ⇒ 一条 acceptedCount=1 ∧ scene='edit_intent' 载荷;
 *   ② 「忽略」终点(建议展示后未经应用而消失)⇒ acceptedCount=0 ∧ dismissedCount=1;
 *   ③ 上报通道抛错 ⇒ 静默,onTextChange 照常拿到改写后的草稿(埋点绝不阻塞输入)。
 *
 * 只桩 global fetch,不发真请求;载荷断言读 fetch 实参的 body,不复制上报判据。
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

import { WebInputCore } from '@/components/chat/web-input-core'

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode; content?: string }) => <>{children}</>,
}))

function envelope(data: unknown) {
  return { code: 0, message: 'ok', data }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** 一次成功预测的响应体(model/latency_ms 由后端 `finish(...)` 回显,现读 fim.py:503)。 */
const SUGGESTED_BODY = {
  disposition: 'suggested',
  actions: [{ kind: 'replace', start: 6, end: 11, text: 'there', anchor: 'world' }],
  model: 'gpt-test',
  latency_ms: 310,
}

/**
 * fetch 桩:edit-intent 恒回 suggested;metrics 上报逐条记录解析后的 body。
 * `metricsMode`: 'ok' 正常回执;'throw' 传输层抛错;'http-500' 后端 500。
 */
function stubFetch(metricsMode: 'ok' | 'throw' | 'http-500' = 'ok') {
  const metricBodies: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/llm/fim/metrics')) {
        if (metricsMode === 'throw') throw new Error('ECONNREFUSED (metrics)')
        if (metricsMode === 'http-500') return new Response('boom', { status: 500 })
        metricBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return jsonResponse(envelope({ model: 'gpt-test', scene: 'edit_intent' }))
      }
      return jsonResponse(envelope(SUGGESTED_BODY))
    }),
  )
  return metricBodies
}

function Harness({
  initial,
  onTextChange,
}: {
  initial: string
  onTextChange?: (v: string) => void
}) {
  const [text, setText] = React.useState(initial)
  return (
    <WebInputCore
      text={text}
      placeholder="请输入消息"
      isStreaming={false}
      t={(k) => k}
      onTextChange={(v) => {
        setText(v)
        onTextChange?.(v)
      }}
      onSend={() => {}}
      onStop={() => {}}
      onClear={() => setText('')}
    />
  )
}

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement

async function awaitSuggestionBar() {
  await screen.findByTestId('predictive-edit-suggestion', {}, { timeout: 3000 })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Predictive Edit — 接受率埋点(scene=edit_intent)', () => {
  it('「应用」⇒ 上报一条 acceptedCount=1 ∧ scene=edit_intent,且不带 dismissed', async () => {
    const metricBodies = stubFetch('ok')
    render(<Harness initial="hello world" />)
    await awaitSuggestionBar()

    fireEvent.click(screen.getByRole('button', { name: 'predictiveEditApply' }))

    await waitFor(() => expect(metricBodies.length).toBe(1), { timeout: 3000 })
    expect(metricBodies[0]).toMatchObject({
      scene: 'edit_intent',
      model: 'gpt-test',
      suggestionCount: 1,
      acceptedCount: 1,
      dismissedCount: 0,
      latencyMs: [310],
    })
    // 「应用」不得再被同一条建议的「忽略」重复计数(pendingMetricRef 先消费再上报)。
    await new Promise((r) => setTimeout(r, 100))
    expect(metricBodies.length).toBe(1)
  })

  it('「忽略」(建议展示后用户继续输入而消失)⇒ 上报 acceptedCount=0 ∧ dismissedCount=1', async () => {
    const metricBodies = stubFetch('ok')
    render(<Harness initial="hello world" />)
    await awaitSuggestionBar()

    // 用户没点应用而是继续打字 ⇒ 建议条因 document!==text 消失,即「忽略」终点。
    fireEvent.change(textarea(), { target: { value: 'hello world and more' } })

    await waitFor(() => expect(metricBodies.length).toBe(1), { timeout: 3000 })
    expect(metricBodies[0]).toMatchObject({
      scene: 'edit_intent',
      model: 'gpt-test',
      suggestionCount: 1,
      acceptedCount: 0,
      dismissedCount: 1,
    })
  })

  it('上报传输层抛错 ⇒ 静默,「应用」仍照常改写草稿', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    stubFetch('throw')
    const onTextChange = vi.fn()
    render(<Harness initial="hello world" onTextChange={onTextChange} />)
    await awaitSuggestionBar()

    fireEvent.click(screen.getByRole('button', { name: 'predictiveEditApply' }))

    expect(onTextChange).toHaveBeenCalledWith('hello there')
    expect(textarea().value).toBe('hello there')
    await waitFor(() => expect(debugSpy).toHaveBeenCalled(), { timeout: 3000 })
  })

  it('上报 HTTP 500 ⇒ 静默,不影响输入与草稿', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    stubFetch('http-500')
    const onTextChange = vi.fn()
    render(<Harness initial="hello world" onTextChange={onTextChange} />)
    await awaitSuggestionBar()

    fireEvent.click(screen.getByRole('button', { name: 'predictiveEditApply' }))

    expect(onTextChange).toHaveBeenCalledWith('hello there')
    await waitFor(() => expect(debugSpy).toHaveBeenCalled(), { timeout: 3000 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
