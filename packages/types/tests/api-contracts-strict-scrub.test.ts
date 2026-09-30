// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-01 票1:跨边界/落库载荷的 strict 未知字段策略 + 读前 scrub。
 *
 * 判据对齐票面验收草案:
 *   ① parseX({ known: 1, unexpected: 2 }) 必须失败(抛 ContractValidationError);
 *   ② 带 legacy 键的历史载荷 parseX({ kind:'tool-result', ok:true }) —— scrub 后 success,
 *      输出对象不含 legacy 键;未列出的兄弟 kind 原样通过;缺席字段未被补成 `undefined`。
 * schema 唯一真相:packages/types/src/api-contracts.ts(CrossEndEventSchema /
 * ApiResponseEnvelopeSchema + scrubRevokedKeys)。
 */
import { describe, it, expect } from 'vitest'
import {
  ContractValidationError,
  scrubRevokedKeys,
  CROSS_END_EVENT_REVOKED_KEYS,
  parseCrossEndEvent,
  parseApiResponseEnvelope,
  safeParseApiResponseEnvelope,
} from '../src/api-contracts.js'

describe('票1 · strict 未知字段策略', () => {
  it('已知字段齐全 + 未知字段 → 整包判失败(ContractValidationError)', () => {
    expect(() =>
      parseCrossEndEvent({ kind: 'tool-result', traceId: 't', at: 1, unexpected: 2 }),
    ).toThrow(ContractValidationError)
  })

  it('纯未知载荷 parseX({ known: 1, unexpected: 2 }) 必须失败,不返回成功', () => {
    expect(() => parseCrossEndEvent({ known: 1, unexpected: 2 })).toThrow(
      ContractValidationError,
    )
  })

  it('包络面同理:未知顶层字段判失败', () => {
    const result = safeParseApiResponseEnvelope({ code: 0, message: 'ok', data: 1, junk: 'x' })
    expect(result.success).toBe(false)
    expect(() => parseApiResponseEnvelope({ code: 0, message: 'ok', data: 1, junk: 'x' })).toThrow(
      ContractValidationError,
    )
  })

  it('已知字段齐全、无未知字段 → 通过', () => {
    const out = parseCrossEndEvent({ kind: 'tool-result', traceId: 't', at: 1 })
    expect(out).toEqual({ kind: 'tool-result', traceId: 't', at: 1 })
  })
})

describe('票1 · kind 定向读前 scrub(stripper 三语义)', () => {
  it('带 legacy 键的历史载荷:scrub 后 strict 通过,输出不含 legacy 键', () => {
    const out = parseCrossEndEvent({ kind: 'tool-result', ok: true })
    expect(out).toEqual({ kind: 'tool-result' })
    expect('ok' in out).toBe(false)
  })

  it('只删在场的键:缺席的 legacy 键绝不被补成 undefined', () => {
    const input: Record<string, unknown> = { kind: 'tool-result' }
    const out = scrubRevokedKeys(input, 'kind', CROSS_END_EVENT_REVOKED_KEYS)
    expect('ok' in out).toBe(false)
    expect(Object.keys(out)).toEqual(['kind'])
    expect(Object.values(out).every((v) => v !== undefined)).toBe(true)
  })

  it('未列出的兄弟 kind 原样通过,一个字节都不动', () => {
    const sibling: Record<string, unknown> = { kind: 'sse-frame', ok: 1, extra: 'keep' }
    const out = scrubRevokedKeys(sibling, 'kind', CROSS_END_EVENT_REVOKED_KEYS)
    expect(out).toBe(sibling)
    expect(out.ok).toBe(1)
    expect(out.extra).toBe('keep')
  })
})

describe('票1 · 响应包络面(ApiResponseEnvelopeSchema)', () => {
  it('干净包络通过;缺席的可选 errorCode 不被补成 undefined 键', () => {
    const parsed = parseApiResponseEnvelope({ code: 0, message: 'ok', data: { a: 1 } })
    expect(parsed.code).toBe(0)
    expect(parsed.data).toEqual({ a: 1 })
    expect('errorCode' in parsed).toBe(false)
    expect('kind' in parsed).toBe(false)
  })

  it('带 legacy `ok` 的历史包络:kind=envelope 时读前剥掉,strict 通过', () => {
    const parsed = parseApiResponseEnvelope({ kind: 'envelope', code: 0, message: '', data: 1, ok: true })
    expect(parsed.code).toBe(0)
    expect('ok' in parsed).toBe(false)
  })

  it('非对象 / 缺 code 的载荷不冒充包络:判失败', () => {
    expect(safeParseApiResponseEnvelope(null).success).toBe(false)
    expect(safeParseApiResponseEnvelope('text').success).toBe(false)
    expect(safeParseApiResponseEnvelope({ hello: 1 }).success).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
