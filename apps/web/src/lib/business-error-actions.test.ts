// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  getBusinessErrorMessageId,
  getBusinessErrorUiAction,
  isBusinessErrorCode,
  resolveBusinessCodeFromWrapperCopy,
} from './business-error-actions'

describe('business-error-actions(G-977970 码→UI 动作表 + 包装码兜底)', () => {
  it('表驱动:每个已知码都有 i18n 文案位', () => {
    for (const code of ['4291', '4292', '4293', '5001', '5002', '5003']) {
      expect(isBusinessErrorCode(code)).toBe(true)
      expect(getBusinessErrorMessageId(code)).toBe(`ihui.error.business.${code}`)
    }
    expect(isBusinessErrorCode('9999')).toBe(false)
    expect(getBusinessErrorMessageId('9999')).toBeUndefined()
  })

  it('示例码 5001(安全校验拒绝)无动作:显式 null,不是丢给未知码兜底', () => {
    expect(getBusinessErrorUiAction('5001')).toBeNull()
    // 文案仍在:没按钮 ≠ 没提示
    expect(getBusinessErrorMessageId('5001')).toBe('ihui.error.business.5001')
  })

  it('动作位表驱动抽查', () => {
    expect(getBusinessErrorUiAction('4291')).toBe('upgrade')
    expect(getBusinessErrorUiAction('4292')).toBe('switch-model')
    expect(getBusinessErrorUiAction('4293')).toBe('retry-later')
    expect(getBusinessErrorUiAction('5002')).toBe('refresh-quota')
    expect(getBusinessErrorUiAction('5003')).toBe('relogin')
    expect(getBusinessErrorUiAction('9999')).toBeNull()
  })

  it('模型级并发文案命中 4292(切模型可恢复),不误升级为账号级阻断码 4291', () => {
    expect(
      resolveBusinessCodeFromWrapperCopy(
        'SEND_FAILED',
        'model concurrency limit exceeded',
        'ihui_relay',
      ),
    ).toBe('4292')
    expect(
      resolveBusinessCodeFromWrapperCopy('unknown_error', '模型并发上限,请稍后再试', 'ihui_relay'),
    ).toBe('4292')
  })

  it('无 model 限定词的并发文案按账号级恢复 4291(升级型)', () => {
    expect(
      resolveBusinessCodeFromWrapperCopy(
        'PROVIDER_BUSINESS_ERROR',
        'concurrency limit exceeded',
        'ihui_relay',
      ),
    ).toBe('4291')
    expect(
      resolveBusinessCodeFromWrapperCopy('SEND_FAILED', '并发上限,请升级套餐', 'ihui_relay'),
    ).toBe('4291')
  })

  it('非目标 provider 边界不兜底(同名文案语义不可迁移)', () => {
    expect(
      resolveBusinessCodeFromWrapperCopy(
        'SEND_FAILED',
        'model concurrency limit exceeded',
        'user_custom',
      ),
    ).toBeUndefined()
    expect(resolveBusinessCodeFromWrapperCopy(undefined, '并发上限', '')).toBeUndefined()
  })

  it('证据不足不兜底:已是业务码透传;外层码不在包装名单/无并发文案/无文案均拒绝', () => {
    expect(resolveBusinessCodeFromWrapperCopy('4293', undefined, 'ihui_relay')).toBe('4293')
    expect(
      resolveBusinessCodeFromWrapperCopy('TOTALLY_OTHER', '并发上限', 'ihui_relay'),
    ).toBeUndefined()
    expect(
      resolveBusinessCodeFromWrapperCopy('SEND_FAILED', 'disk full', 'ihui_relay'),
    ).toBeUndefined()
    expect(
      resolveBusinessCodeFromWrapperCopy('SEND_FAILED', undefined, 'ihui_relay'),
    ).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
