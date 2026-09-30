// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-01 票1:api-client 响应体入站 strict 校验 + 读前 scrub。
 *
 * 测试打在真正进生产的那份数据上:fetchOnce 的 2xx 分支(fetchApi 端到端走注入的
 * transport),判据在 packages/api-client/src/client.ts 的 validateEnvelopeInbound
 * (权威 schema 面在 @ihui/types/api-contracts,包内逐字移植,沿 error-serialize 收口先例)。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { fetchApi, validateEnvelopeInbound, ContractValidationError } from '../src/client.js'
import { setTransport, type Transport, type TransportResponse } from '../src/transport.js'

function jsonResponse(status: number, body: unknown): TransportResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: new Map<string, string>(),
  } as unknown as TransportResponse

}

afterEach(() => {
  setTransport(undefined as unknown as Transport)
})

describe('票1 · validateEnvelopeInbound(纯函数面)', () => {
  it('包络带未知字段 → 抛 ContractValidationError(整包判失败,不静默剥掉)', () => {
    expect(() => validateEnvelopeInbound({ code: 0, message: 'ok', data: 1, junk: 'x' })).toThrow(
      ContractValidationError,
    )
  })

  it('干净包络 matched,数据与可选 errorCode 原样携带', () => {
    const r = validateEnvelopeInbound({ code: 0, message: 'ok', data: { a: 1 }, errorCode: 'E_X' })
    expect(r.matched).toBe(true)
    if (r.matched) {
      expect(r.envelope.code).toBe(0)
      expect(r.envelope.data).toEqual({ a: 1 })
      expect(r.envelope.errorCode).toBe('E_X')
    }
  })

  it('kind=envelope 的历史载荷:legacy `ok` 读前剥掉后通过,输出不含该键', () => {
    const raw: Record<string, unknown> = { kind: 'envelope', code: 0, message: '', data: 1, ok: true }
    const r = validateEnvelopeInbound(raw)
    expect(r.matched).toBe(true)
    if (r.matched) expect('ok' in r.envelope).toBe(false)
  })

  it('缺席的 legacy 键不被补成 undefined;未列出 kind 的键不被 scrub 静默放行(交 strict 裁决)', () => {
    const absent: Record<string, unknown> = { kind: 'envelope', code: 0, message: '', data: 1 }
    expect(validateEnvelopeInbound(absent).matched).toBe(true)
    expect('ok' in absent).toBe(false)

    const sibling: Record<string, unknown> = { kind: 'ws-frame', code: 0, message: '', data: 1, ok: true }
    expect(() => validateEnvelopeInbound(sibling)).toThrow(ContractValidationError)
    expect(sibling.ok).toBe(true) // scrub 未动兄弟 kind 的键,由 strict 面统一判失败
  })

  it('裸 JSON(无 code 包装,ai-service 直返体)不归包络管:matched=false', () => {
    expect(validateEnvelopeInbound({ hello: 1 }).matched).toBe(false)
    expect(validateEnvelopeInbound(null).matched).toBe(false)
    expect(validateEnvelopeInbound('text').matched).toBe(false)
  })
})

describe('票1 · fetchOnce 2xx 入站(端到端,真生产路径)', () => {
  it('2xx 包络带未知字段 → fetchApi 返回失败,错误可读地指认未知字段', async () => {
    setTransport((async () =>
      jsonResponse(200, { code: 0, message: 'ok', data: { id: 'x' }, junk: 1 })) as unknown as Transport)
    const result = await fetchApi('/things')
    // 票面口径:parseX 必须返回失败(或抛 ContractValidationError)。2xx 分支的失败
    // 走 ApiResult 归一化(不计 breaker 服务不可用),message 必须携带逐条判据。
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toMatch(/契约校验失败[\s\S]*未知字段: junk/)
  })

  it('带 legacy `ok` 的历史包络端到端:scrub 后照常返回 data', async () => {
    setTransport((async () =>
      jsonResponse(200, { kind: 'envelope', code: 0, message: 'ok', data: { v: 1 }, ok: true })) as unknown as Transport)
    const result = await fetchApi<{ v: number }>('/things')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ v: 1 })
  })

  it('裸 JSON 2xx(ai-service 直返)维持原语义:整个响应视作 data', async () => {
    setTransport((async () => jsonResponse(200, { hello: 1 })) as unknown as Transport)
    const result = await fetchApi<{ hello: number }>('/ai/thing')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ hello: 1 })
  })

  it('code!==0:失败分支原语义保持;errorCode 值为缺席(undefined)', async () => {
    setTransport((async () => jsonResponse(200, { code: 1, message: ' boom ' })) as unknown as Transport)
    const result = await fetchApi('/things')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('boom')
      // 判"值缺席"而非判键不在:失败分支对象字面量恒含 errorCode 键(undefined 值),
      // 该形态已被 fetch-api-baseline 逐字快照钉死(<<undefined>>),动它即造恒红门。
      expect(result.errorCode).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
