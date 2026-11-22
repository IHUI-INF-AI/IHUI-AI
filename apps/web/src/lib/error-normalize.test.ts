// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { normalizeError } from './error-normalize'

describe('error-normalize(G-977987 错误归一路径阶梯)', () => {
  it('外层 Internal error + data.zcode.error.message 真实根因 → 主提示取根因,泛化词降权进 detail', () => {
    const normalized = normalizeError({
      message: 'Internal error',
      data: { zcode: { error: { message: '模型连接被上游重置' } } },
    })
    expect(normalized.message).toBe('模型连接被上游重置')
    expect(normalized.detail).toBe('Internal error')
  })

  it('detail 含 provider_code=1302 → 业务码优先于外层包装 code', () => {
    const normalized = normalizeError({
      message: 'Internal error',
      code: 'PROVIDER_BUSINESS_ERROR',
      detail: 'quota exceeded (provider_code=1302)',
    })
    expect(normalized.code).toBe('1302')
    expect(normalized.message).toBe('quota exceeded (provider_code=1302)')
  })

  it('对象字段里嵌 JSON 字符串 → 递归解析取结构化根因,裸串不占主提示位', () => {
    const normalized = normalizeError({
      message: 'Internal error',
      data: { detail: '{"message":"上游 TLS 握手失败","detail":"handshake timeout"}' },
    })
    expect(normalized.message).toBe('上游 TLS 握手失败')
    expect(normalized.detail).toBe('handshake timeout')
  })

  it('整段错误就是 JSON 字符串 → 先取结构化字段而非整段原文', () => {
    const normalized = normalizeError('{"message":"Inner root","detail":"Inner detail"}')
    expect(normalized.message).toBe('Inner root')
    expect(normalized.detail).toBe('Inner detail')
  })

  it('JSON 字符串解析失败 → 回退整段原文', () => {
    const raw = 'not a json { broken'
    expect(normalizeError(raw).message).toBe(raw)
  })

  it('data.details 复数路径命中(只认 detail 会丢可执行提示的历史坑)', () => {
    const normalized = normalizeError({
      message: 'Internal error',
      data: { details: '请降低并发后重试' },
    })
    expect(normalized.message).toBe('请降低并发后重试')
  })

  it('候选去重保序:同文案只收一次,先到先得', () => {
    const normalized = normalizeError({
      message: '同一句',
      detail: '同一句',
      data: { message: '同一句', detail: '补充句' },
    })
    expect(normalized.message).toBe('同一句')
    expect(normalized.detail).toBe('补充句')
  })

  it('全部候选都是泛化包装 → 主提示退回首个候选;空候选走 fallbackMessage', () => {
    const allGeneric = normalizeError({ message: 'Internal error' })
    expect(allGeneric.message).toBe('Internal error')
    expect(allGeneric.detail).toBeUndefined()
    const empty = normalizeError('', { fallbackMessage: '连接中断' })
    expect(empty.message).toBe('连接中断')
  })

  it('Error 实例走 message 候选', () => {
    expect(normalizeError(new Error('裸 Error 文案')).message).toBe('裸 Error 文案')
  })

  it('attribution 4 条路径提取 + 轻量校验(代替上游 zod safeParse)', () => {
    const valid = { errorSource: 'provider', failureReason: 'quota_exhausted' }
    expect(normalizeError({ attribution: valid }).attribution).toEqual(valid)
    expect(normalizeError({ data: { attribution: valid } }).attribution).toEqual(valid)
    expect(normalizeError({ data: { error: { attribution: valid } } }).attribution).toEqual(valid)
    expect(
      normalizeError({ data: { zcode: { error: { attribution: valid } } } }).attribution,
    ).toEqual(valid)
    // 非法 errorSource 不采信
    expect(
      normalizeError({ attribution: { errorSource: 'bogus', failureReason: 'x' } }).attribution,
    ).toBeUndefined()
    // 空 failureReason 不采信
    expect(
      normalizeError({ attribution: { errorSource: 'provider', failureReason: '  ' } }).attribution,
    ).toBeUndefined()
  })

  it('code 路径阶梯:外层缺席时深层 context.providerCode 位命中,provider_code 提取优先', () => {
    expect(
      normalizeError({
        data: { zcode: { error: { context: { providerCode: '1310' } } } },
      }).code,
    ).toBe('1310')
    expect(normalizeError({ context: { providerCode: '1311' } }).code).toBe('1311')
    // detail 里的 provider_code 压过路径阶梯首位的外层 code
    expect(normalizeError({ code: '8001', detail: 'provider_code=999' }).code).toBe('999')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
