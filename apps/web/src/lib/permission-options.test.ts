// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  getPermissionOptionDisplayKind,
  PERMISSION_FULL_ACCESS_OPTION_ID,
  shouldPreferPermissionOptionName,
  sortPermissionOptions,
  type PermissionOptionLike,
} from './permission-options'

function option(partial: Partial<PermissionOptionLike>): PermissionOptionLike {
  return {
    optionId: partial.optionId ?? 'opt',
    kind: partial.kind ?? '',
    name: partial.name ?? '',
  }
}

describe('getPermissionOptionDisplayKind', () => {
  it('allow/approve × always 词典归一', () => {
    expect(getPermissionOptionDisplayKind('allow')).toBe('allowOnce')
    expect(getPermissionOptionDisplayKind('allow_once')).toBe('allowOnce')
    expect(getPermissionOptionDisplayKind('Approve')).toBe('allowOnce')
    expect(getPermissionOptionDisplayKind('allow_always')).toBe('allowAlways')
    expect(getPermissionOptionDisplayKind('always approve')).toBe('allowAlways')
    expect(getPermissionOptionDisplayKind('reject')).toBe('rejectOnce')
    expect(getPermissionOptionDisplayKind('deny_once')).toBe('rejectOnce')
    expect(getPermissionOptionDisplayKind('reject always')).toBe('rejectAlways')
    expect(getPermissionOptionDisplayKind('always deny')).toBe('rejectAlways')
  })

  it('未知词面归为 custom', () => {
    expect(getPermissionOptionDisplayKind('run_command')).toBe('custom')
    expect(getPermissionOptionDisplayKind('')).toBe('custom')
  })
})

describe('shouldPreferPermissionOptionName', () => {
  it('模型输出的泛化名称不顶替标准文案', () => {
    expect(shouldPreferPermissionOptionName({ kind: 'allow_once', name: 'Allow once' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'allow_once', name: '  Allow  once ' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'allow_once', name: 'Allow' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'allow_once', name: 'Approve' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'allow_always', name: 'Always allow' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'reject_once', name: 'Deny' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'reject_always', name: 'Always reject' })).toBe(false)
  })

  it('非 generic 名称与 custom kind 保留模型输出名称', () => {
    expect(shouldPreferPermissionOptionName({ kind: 'allow_once', name: 'Allow this file only' })).toBe(true)
    expect(shouldPreferPermissionOptionName({ kind: 'custom_command', name: 'Run tests' })).toBe(true)
  })

  it('空名称不优先(回退稳定文案)', () => {
    expect(shouldPreferPermissionOptionName({ kind: 'custom_command', name: '' })).toBe(false)
    expect(shouldPreferPermissionOptionName({ kind: 'custom_command', name: '   ' })).toBe(false)
  })
})

describe('sortPermissionOptions', () => {
  it('full access(custom kind)占 1.5 槽位,排在 rejectOnce 前', () => {
    const sorted = sortPermissionOptions([
      option({ optionId: 'ro', kind: 'reject_once', name: '' }),
      option({ optionId: PERMISSION_FULL_ACCESS_OPTION_ID, kind: 'run_anything', name: 'Full access' }),
      option({ optionId: 'aa', kind: 'allow_always', name: '' }),
      option({ optionId: 'ao', kind: 'allow_once', name: '' }),
    ])
    expect(sorted.map((item) => item.optionId)).toEqual([
      'ao',
      'aa',
      PERMISSION_FULL_ACCESS_OPTION_ID,
      'ro',
    ])
  })

  it('完整固定序:allowOnce→allowAlways→rejectOnce→rejectAlways→custom', () => {
    const custom = option({ optionId: 'c', kind: 'run_command', name: 'Run' })
    const sorted = sortPermissionOptions([
      custom,
      option({ optionId: 'ra', kind: 'reject_always', name: '' }),
      option({ optionId: 'ro', kind: 'reject_once', name: '' }),
      option({ optionId: 'aa', kind: 'allow_always', name: '' }),
      option({ optionId: 'ao', kind: 'allow_once', name: '' }),
    ])
    expect(sorted.map((item) => item.optionId)).toEqual(['ao', 'aa', 'ro', 'ra', 'c'])
  })

  it('同序保原 index(排序稳定快照)', () => {
    const first = option({ optionId: 'first', kind: 'allow_once', name: '' })
    const second = option({ optionId: 'second', kind: 'allow', name: '' })
    const third = option({ optionId: 'third', kind: 'approve', name: '' })
    // 三者同为 allowOnce:排序稳定,输出与输入顺序一致(快照不抖动)
    expect(sortPermissionOptions([third, first, second]).map((item) => item.optionId)).toEqual([
      'third',
      'first',
      'second',
    ])
  })

  it('不修改原数组', () => {
    const original = [option({ optionId: 'b', kind: 'allow_once', name: '' }), option({ optionId: 'a', kind: 'reject', name: '' })]
    const snapshot = [...original]
    sortPermissionOptions(original)
    expect(original).toEqual(snapshot)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
