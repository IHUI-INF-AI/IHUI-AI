// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Predictive Edit(V3 #82)web 请求出口单测(2026-10-25)。
 *
 * 覆盖:
 *   ① 请求体形状与端点(不依赖真后端 —— 只把 global fetch 打桩);
 *   ② 响应三态原样透出(undetermined 不得折叠成 no_action),动作落到草稿的正确位置;
 *   ③ 失败静默(fetch 抛网络错误 ⇒ failed,只留一次 console.debug,不 throw)。
 *
 * 刻意用**真** `fetchApi`(只桩 fetch):请求出口的价值就在信封解包与 URL 归一化,
 * 把 fetchApi 一起 mock 掉会让"端点/请求体"这条验收变成自证。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyPredictedEditActions,
  fetchPredictiveEdit,
  PREDICTIVE_EDIT_ENDPOINT,
  type PredictiveEditAction,
} from '../predictive-edit-api'

function envelope(data: unknown) {
  return { code: 0, message: 'ok', data }
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('fetchPredictiveEdit — 端点与请求体', () => {
  it('POST /api/llm/fim/edit-intent,body = {content,cursor,language}', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(envelope({ disposition: 'no_action' })))
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await fetchPredictiveEdit({
      content: 'hello world',
      cursor: 5,
      language: 'markdown',
    })

    expect(outcome).toEqual({ status: 'no_action' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(String(url)).toBe(PREDICTIVE_EDIT_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      content: 'hello world',
      cursor: 5,
      language: 'markdown',
    })
  })
})

describe('fetchPredictiveEdit — 三态透出与落位', () => {
  it('suggested ⇒ 动作原样返回,且能落到草稿的正确偏移', async () => {
    const actions: PredictiveEditAction[] = [
      { kind: 'replace', start: 6, end: 11, text: 'there', anchor: 'world' },
      { kind: 'insert', start: 0, end: 0, text: '>> ' },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(envelope({ disposition: 'suggested', actions }))),
    )

    const outcome = await fetchPredictiveEdit({ content: 'hello world', cursor: 11 })

    expect(outcome).toEqual({ status: 'suggested', actions })
    if (outcome.status !== 'suggested') throw new Error('unreachable')
    expect(applyPredictedEditActions('hello world', outcome.actions)).toBe('>> hello there')
  })

  it('undetermined 带原因码返回,不折叠成 no_action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(envelope({ disposition: 'undetermined', reason: 'model_timeout' })),
      ),
    )

    const outcome = await fetchPredictiveEdit({ content: 'hello', cursor: 0 })

    expect(outcome).toEqual({ status: 'undetermined', reason: 'model_timeout' })
  })

  it('锚点与草稿切片不符 ⇒ 整体不落位(半套编辑比不改更危险)', () => {
    const actions: PredictiveEditAction[] = [
      { kind: 'replace', start: 6, end: 11, text: 'there', anchor: 'planet' },
    ]
    expect(applyPredictedEditActions('hello world', actions)).toBeNull()
  })
})

describe('fetchPredictiveEdit — 失败静默', () => {
  it('网络异常 ⇒ failed 不 throw,且只留一次 console.debug', async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED')
      }),
    )

    const outcome = await fetchPredictiveEdit({ content: 'hello', cursor: 0 })

    expect(outcome.status).toBe('failed')
    expect(debugSpy).toHaveBeenCalledTimes(1)
  })
})
