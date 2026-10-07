// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

function one(line: string) {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

/** G-425(2026-10-07 立,默认档"只提示"):done 帧携带上游 finish/stop reason。
 *  生产点:ai-service provider 层(gemini/openai 原生适配器)+ llm_gateway LiteLLM
 *  路径,经 llm.py /llm/complete/stream 的 done 重建点透传;契约:shared sse
 *  contract.ts 的 done 帧 finishReason 字段与 api-client tryParseFinishReason 同口径
 *  —— 缺席不带键,绝不把"没采到"折成"stop",语义解释(截断判定)不在解析层。 */
describe('sse-parse done 帧 finishReason 透传(G-425)', () => {
  it('阳性:done 帧带 finishReason ⇒ 原样透传(OpenAI 系 length 不归一)', () => {
    const evt = one(
      '{"type":"done","model":"gpt-x","usage":{"total_tokens":9},"finishReason":"length"}',
    )
    expect(evt?.type).toBe('done')
    expect(evt?.finishReason).toBe('length')
  })

  it('Gemini 原生值(MAX_TOKENS/STOP)同样原样透传,不做大小写归一', () => {
    expect(one('{"type":"done","finishReason":"MAX_TOKENS"}')?.finishReason).toBe('MAX_TOKENS')
    expect(one('{"type":"done","finishReason":"STOP"}')?.finishReason).toBe('STOP')
  })

  it('阴性:done 帧无 finishReason ⇒ 不带键(缺席 ≠ stop)', () => {
    const evt = one('{"type":"done","model":"gpt-x","usage":{"total_tokens":3}}')
    expect(evt?.type).toBe('done')
    expect('finishReason' in (evt ?? {})).toBe(false)
  })

  it('阴性:finishReason 非字符串或空串 ⇒ 不带键,不造值', () => {
    expect('finishReason' in (one('{"type":"done","finishReason":123}') ?? {})).toBe(false)
    expect('finishReason' in (one('{"type":"done","finishReason":null}') ?? {})).toBe(false)
    expect('finishReason' in (one('{"type":"done","finishReason":""}') ?? {})).toBe(false)
  })

  it('解析层只透传不解释:stop 原样带出,截断判定住在消费端', () => {
    expect(one('{"type":"done","finishReason":"stop"}')?.finishReason).toBe('stop')
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
