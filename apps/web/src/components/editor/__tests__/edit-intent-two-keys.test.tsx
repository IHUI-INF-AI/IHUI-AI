// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 预测式编辑「两把钥匙」用例(V3 #82,2026-11-01)。
 *
 * 票面硬约束:前端必须同时有「开关」(用户意志位,store)与「门槛」
 * (机器条件位,threshold helper)两个**互相独立**的控制位,缺任何一个
 * 都会把服务端三态(suggested/no_action/undetermined)折回两态。
 * 本文件钉住:
 *  T1 开关关 ⇒ 零请求、零终点上报(前置抑制不得冒充任何后端判定);
 *  T2 低于门槛 ⇒ 零请求(与开关关是**不同**的控制位,互不遮蔽);
 *  T3 开关开 + 过门槛 ⇒ 恰一次请求(两把钥匙齐开才放行,缺一不放行);
 *  T4 开关与门槛的判据实现各自唯一(store 位 / passesEditIntentThreshold),
 *     消费面(useEditorEditIntent)只 import,不复写。
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  useEditorEditIntent,
  EDITOR_EDIT_INTENT_DEBOUNCE_MS,
} from '@/components/editor/use-edit-intent'
import { PREDICTIVE_EDIT_MIN_CHARS, passesEditIntentThreshold } from '@/lib/predictive-edit-api'
import { usePredictiveEditPrefsStore } from '@/stores/predictive-edit'

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

/** 桩 fetch:记录 edit-intent 请求与 metrics 上报两个面。 */
function stubFetch() {
  const metricBodies: Array<Record<string, unknown>> = []
  const editIntentRequests: Array<Record<string, unknown>> = []
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/llm/fim/metrics')) {
      metricBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return jsonResponse(envelope({ model: 'm1', scene: 'edit_intent' }))
    }
    editIntentRequests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
    return jsonResponse(envelope(SUGGESTED_BODY))
  }
  return { metricBodies, editIntentRequests }
}

/** 真计时等待(本目录惯例:不用 fake timers)。 */
function waitBeyondDebounce(extraMs = 300): Promise<void> {
  return new Promise((r) => setTimeout(r, EDITOR_EDIT_INTENT_DEBOUNCE_MS + extraMs))
}

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

afterEach(() => {
  cleanup()
  // 复位开关位:用例之间不共享用户意志状态(默认开 = 接线以来的常开现状)。
  usePredictiveEditPrefsStore.getState().setEnabled(true)
  delete (globalThis as { fetch?: unknown }).fetch
})

describe('预测式编辑两把钥匙 — 开关位与门槛位各自独立', () => {
  it('T1 开关关 ⇒ 零请求、零终点上报(关闭态绝不冒充 no_action/dismissed)', async () => {
    const { metricBodies, editIntentRequests } = stubFetch()
    usePredictiveEditPrefsStore.getState().setEnabled(false)
    const { result } = renderIntent('const a = 1')
    await waitBeyondDebounce()
    expect(editIntentRequests).toHaveLength(0)
    expect(metricBodies).toHaveLength(0)
    expect(result.current.prediction).toBeNull()
    expect(result.current.predictionVisible).toBe(false)
  })

  it('T2 低于门槛(全空白)⇒ 零请求;开关位此时不构成放行理由', async () => {
    const { editIntentRequests } = stubFetch()
    usePredictiveEditPrefsStore.getState().setEnabled(true)
    const { result } = renderIntent('   \n  ')
    await waitBeyondDebounce()
    expect(editIntentRequests).toHaveLength(0)
    expect(result.current.prediction).toBeNull()
    // 门槛判据本身:非空白达到最小档才算过
    expect(passesEditIntentThreshold('   ')).toBe(false)
    expect(passesEditIntentThreshold('x'.repeat(PREDICTIVE_EDIT_MIN_CHARS))).toBe(true)
  })

  it('T3 开关开 ∧ 过门槛 ∧ 宿主能力在 ⇒ 恰一次请求,suggested 上屏', async () => {
    const { editIntentRequests } = stubFetch()
    const { result } = renderIntent('const a = 1')
    await waitFor(() => expect(result.current.predictionVisible).toBe(true), {
      timeout: EDITOR_EDIT_INTENT_DEBOUNCE_MS + 2000,
    })
    expect(editIntentRequests).toHaveLength(1)
  })

  it('T3b 展示中关掉开关 ⇒ 建议撤下且不再发新请求(开关即时生效)', async () => {
    const { editIntentRequests, metricBodies } = stubFetch()
    // 不用 rerender:开关位由 store 直接翻转(组件订阅该 store),rerender 在本例里是空转
    const { result } = renderIntent('const a = 1')
    await waitFor(() => expect(result.current.predictionVisible).toBe(true), {
      timeout: EDITOR_EDIT_INTENT_DEBOUNCE_MS + 2000,
    })
    act(() => usePredictiveEditPrefsStore.getState().setEnabled(false))
    await waitFor(() => expect(result.current.prediction).toBeNull(), { timeout: 2000 })
    await waitBeyondDebounce(100)
    // 关前 1 次;关后不得再有 edit-intent 请求
    expect(editIntentRequests).toHaveLength(1)
    // 撤下展示 ⇒ 未应用的那条按忽略终点结算(展示过就必须有终点,不悬空)
    expect(metricBodies.at(-1)).toMatchObject({ scene: 'edit_intent', dismissedCount: 1 })
  })

  it('T4 宿主能力位(enabled=false)与开关位互不遮蔽:任一关即不请求', async () => {
    const { editIntentRequests } = stubFetch()
    // 开关开、门槛过,但宿主能力关 ⇒ 零请求
    const a = renderIntent('const a = 1', false)
    await waitBeyondDebounce(100)
    expect(editIntentRequests).toHaveLength(0)
    a.unmount()
    // 宿主能力开、开关关 ⇒ 仍零请求(两把钥匙独立,不能互相顶替)
    usePredictiveEditPrefsStore.getState().setEnabled(false)
    const b = renderIntent('const a = 1', true)
    await waitBeyondDebounce(100)
    expect(editIntentRequests).toHaveLength(0)
    b.unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
