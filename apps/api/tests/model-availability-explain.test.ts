// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型可用性判据(2026-11-17)。
 *
 * 钉住两件事:
 * ① 停用优先于测试失败优先于未上架 —— 同一行同时命中时,用户看到的必须是"这个模型停了";
 * ② 库内没写原因时只能说"未记录原因",绝不拿"额度不足"之类从未被记录的说法顶上去。
 */
import { describe, expect, it } from 'vitest'
import { explainModelAvailability } from '../src/services/model-availability-explain.js'

describe('模型可用性判据', () => {
  it('M1 三项全绿 ⇒ 可见', () => {
    const r = explainModelAvailability({
      enabled: true,
      isRelayPublic: true,
      lastTestStatus: 'PASS',
    })
    expect(r.visible).toBe(true)
    expect(r.category).toBe('ok')
  })

  it('M2 停用且有错误原文 ⇒ 取原文,source=last_test_error', () => {
    const r = explainModelAvailability({
      enabled: false,
      isRelayPublic: true,
      lastTestError: 'upstream says: model not activated',
    })
    expect(r.category).toBe('disabled')
    expect(r.reason).toContain('model not activated')
    expect(r.reason_source).toBe('last_test_error')
  })

  it('M3 停用且无原因 ⇒ 明说未记录,不编造', () => {
    const r = explainModelAvailability({ enabled: false, isRelayPublic: true })
    expect(r.category).toBe('disabled')
    expect(r.reason).toContain('未记录')
    expect(r.reason_source).toBe('enabled_flag')
  })

  it('M4 启用但测试失败 ⇒ test_failed(不可见)', () => {
    const r = explainModelAvailability({
      enabled: true,
      isRelayPublic: true,
      lastTestStatus: 'FAIL',
      lastTestError: '401 unauthorized',
    })
    expect(r.category).toBe('test_failed')
    expect(r.visible).toBe(false)
    expect(r.reason).toContain('401 unauthorized')
  })

  it('M5 可用但未上架 ⇒ not_public(不可见,原因来自上架开关)', () => {
    const r = explainModelAvailability({ enabled: true, isRelayPublic: false })
    expect(r.category).toBe('not_public')
    expect(r.reason_source).toBe('not_public_flag')
  })

  it('M6 停用 + 未上架 + 测试失败 ⇒ 取停用(优先级最高)', () => {
    const r = explainModelAvailability({
      enabled: false,
      isRelayPublic: false,
      lastTestStatus: 'FAIL',
    })
    expect(r.category).toBe('disabled')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
