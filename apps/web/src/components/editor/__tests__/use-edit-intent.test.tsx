// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 编辑器内预测式编辑钩子单测(Trae CUE 对齐,2026-10-31)。
 *
 * 钉住的行为:
 * ① enabled=false(readOnly)⇒ 零请求;
 * ② 停笔超过 debounce ⇒ 一次 edit-intent 请求(带全文与光标偏移);
 * ③ 三态消费:只有 suggested 上屏,no_action / undetermined 不渲染、不上报 accepted;
 * ④ 忽略(展示中消失)⇒ 恰好一条 dismissed 上报(scene=edit_intent);
 * ⑤ 应用终点 settleAccepted ⇒ 恰好一条 accepted 上报,且同一条不再记 dismissed。
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  useEditorEditIntent,
  EDITOR_EDIT_INTENT_DEBOUNCE_MS,
} from '@/components/editor/use-edit-intent'

function envelope(data: unknown) {
  return { code: 0, message: 'ok', data }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const SUGGESTED_BODY = {
  disposition: 'suggested',
  actions: [{ kind: 'replace', start: 0, end: 1, text: 'A', anchor: 'a' }],
  model: 'm1',
  latency_ms: 100,
}

/** 桩:edit-intent 回指定体;metrics 上报记录 body。 */
function stubFetch(editIntentBody: unknown) {
  const metricBodies: Array<Record<string, unknown>> = []
  const editIntentRequests: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/llm/fim/metrics')) {
        metricBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return jsonResponse(envelope({ model: 'm1', scene: 'edit_intent' }))
      }
      editIntentRequests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return jsonResponse(envelope(editIntentBody))
    }),
  )
  return { metricBodies, editIntentRequests }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function renderIntent(text: string, enabled = true) {
  return renderHook(
    ({ value }: { value: string }) =>
      useEditorEditIntent({
        text: value,
        getCursorOffset: () => value.length,
        language: 'ts',
        enabled,
      }),
    { initialProps: { value: text } },
  )
}

describe('useEditorEditIntent — 编辑器内编辑意图预测', () => {
  it('enabled=false ⇒ 零请求(readOnly 链路静默停转)', async () => {
    const { editIntentRequests } = stubFetch(SUGGESTED_BODY)
    const { result } = renderIntent('const a = 1', false)
    await new Promise((r) => setTimeout(r, EDITOR_EDIT_INTENT_DEBOUNCE_MS + 400))
    expect(editIntentRequests).toHaveLength(0)
    expect(result.current.prediction).toBeNull()
  })

  it('停笔超过 debounce ⇒ 一次请求(全文+光标),suggested 上屏', async () => {
    const { editIntentRequests } = stubFetch(SUGGESTED_BODY)
    const { result } = renderIntent('const a = 1')
    await waitFor(() => expect(result.current.predictionVisible).toBe(true), {
      timeout: EDITOR_EDIT_INTENT_DEBOUNCE_MS + 2000,
    })
    expect(editIntentRequests).toHaveLength(1)
    expect(editIntentRequests[0]).toMatchObject({ content: 'const a = 1', cursor: 11 })
    expect(result.current.prediction?.actions).toHaveLength(1)
  })

  it('no_action 不上屏、无任何终点上报', async () => {
    const { metricBodies, editIntentRequests } = stubFetch({ disposition: 'no_action' })
    const { result } = renderIntent('const a = 1')
    await waitFor(() => expect(editIntentRequests).toHaveLength(1), { timeout: 4000 })
    await new Promise((r) => setTimeout(r, 200))
    expect(result.current.prediction).toBeNull()
    expect(result.current.predictionVisible).toBe(false)
    expect(metricBodies).toHaveLength(0)
  })

  it('展示后 dismiss ⇒ 恰好一条 dismissed 上报(scene=edit_intent)', async () => {
    const { metricBodies } = stubFetch(SUGGESTED_BODY)
    const { result } = renderIntent('const a = 1')
    await waitFor(() => expect(result.current.predictionVisible).toBe(true), { timeout: 4000 })
    act(() => result.current.dismiss())
    await waitFor(() => expect(metricBodies).toHaveLength(1), { timeout: 2000 })
    expect(metricBodies[0]).toMatchObject({
      scene: 'edit_intent',
      suggestionCount: 1,
      acceptedCount: 0,
      dismissedCount: 1,
      model: 'm1',
    })
  })

  it('settleAccepted ⇒ 恰好一条 accepted 上报,同一条不再记 dismissed', async () => {
    const { metricBodies } = stubFetch(SUGGESTED_BODY)
    const { result } = renderIntent('const a = 1')
    await waitFor(() => expect(result.current.predictionVisible).toBe(true), { timeout: 4000 })
    const shown = result.current.prediction
    expect(shown).not.toBeNull()
    act(() => {
      if (shown) result.current.settleAccepted(shown)
    })
    await waitFor(() => expect(metricBodies).toHaveLength(1), { timeout: 2000 })
    expect(metricBodies[0]).toMatchObject({
      scene: 'edit_intent',
      suggestionCount: 1,
      acceptedCount: 1,
      dismissedCount: 0,
    })
  })
})
