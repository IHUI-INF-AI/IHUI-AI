// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-192 回归锁(2026-11-08)。
 *
 * 病灶:/chat/multi/multi 的 vendors 只做 split(','),无去重、无条数上限,
 *       一次请求可放大成数千次平台 Key 上游调用。
 * 判据:去重后上限 8;超限/空列表 400;重复厂商只调用一次。
 */
import { describe, it, expect } from 'vitest'
import { parseVendorList, MULTI_VENDOR_LIMIT } from '../src/routes/chat-models.js'

describe('F-192 多厂商编排输入上限', () => {
  it('去空、trim、去重', () => {
    const r = parseVendorList(' openai, openai ,, gemini,gemini ')
    expect(r).toEqual({ ok: true, list: ['openai', 'gemini'] })
  })

  it('上限 8 个(去重后计数)', () => {
    expect(MULTI_VENDOR_LIMIT).toBe(8)
    const atLimit = Array.from({ length: 8 }, (_, i) => `v${i}`).join(',')
    expect(parseVendorList(atLimit).ok).toBe(true)
    const over = Array.from({ length: 9 }, (_, i) => `v${i}`).join(',')
    expect(parseVendorList(over)).toEqual({ ok: false, error: '最多支持 8 个厂商' })
  })

  it('重复 100 次也只算 1 个,不会触顶', () => {
    const r = parseVendorList(Array.from({ length: 100 }, () => 'openai').join(','))
    expect(r).toEqual({ ok: true, list: ['openai'] })
  })

  it('空串/全逗号 → 400 语义', () => {
    expect(parseVendorList(' , , ').ok).toBe(false)
  })
})
