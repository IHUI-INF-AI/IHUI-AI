// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D111/G-164⑥:权限档展示取词逻辑(三端共用)。
// 核心不变量:未配置如实显示 default;认不出的值显示 unknown —— **绝不静默显示成 default**
// (用户配置的高危档被显示成"默认模式"是授权误导)。
import { describe, expect, it } from 'vitest'

import { PERMISSION_MODE_WIRE, permissionModeDisplayKey } from '@ihui/types/permission-mode'
import { PERMISSION_TIER_WORD_KEYS, permissionTierWordKeys } from '../permission-tier'

describe('permissionModeDisplayKey(展示档键)', () => {
  it('未配置(null/undefined)如实显示为 default', () => {
    expect(permissionModeDisplayKey(null)).toBe('default')
    expect(permissionModeDisplayKey(undefined)).toBe('default')
  })

  it('历史/跨端拼写归一到 wire 键', () => {
    expect(permissionModeDisplayKey('default')).toBe('default')
    expect(permissionModeDisplayKey('plan')).toBe('plan')
    expect(permissionModeDisplayKey('acceptEdits')).toBe('accept-edits')
    expect(permissionModeDisplayKey('accept-edits')).toBe('accept-edits')
    expect(permissionModeDisplayKey('bypass-permissions')).toBe('bypass-permissions')
  })

  it('认不出的值 → unknown,绝不静默显示成 default', () => {
    expect(permissionModeDisplayKey('yolo')).toBe('unknown')
    expect(permissionModeDisplayKey('')).toBe('unknown')
  })
})

describe('permissionTierWordKeys(取词键映射)', () => {
  it('五档 + unknown 的词表键齐备且为静态字面量', () => {
    const keys = Object.keys(PERMISSION_TIER_WORD_KEYS)
    expect(keys.sort()).toEqual(
      ['accept-edits', 'bypass-permissions', 'default', 'plan', 'unknown'].sort(),
    )
    for (const [, v] of Object.entries(PERMISSION_TIER_WORD_KEYS)) {
      expect(typeof v.title).toBe('string')
      expect(typeof v.desc).toBe('string')
      expect(v.title.startsWith('permissionTier.mode.')).toBe(true)
      expect(v.desc.startsWith('permissionTier.mode.')).toBe(true)
    }
  })

  it('wire 值域全部有对应取词键(注册表加档漏词表 = 这里红)', () => {
    for (const wire of Object.values(PERMISSION_MODE_WIRE)) {
      expect(PERMISSION_TIER_WORD_KEYS[wire]).toBeDefined()
    }
  })

  it('映射函数对各类输入都给得出键(不崩)', () => {
    expect(permissionTierWordKeys(null).title).toContain('default')
    expect(permissionTierWordKeys(undefined).title).toContain('default')
    expect(permissionTierWordKeys('acceptEdits').title).toContain('accept-edits')
    expect(permissionTierWordKeys('garbage-mode').title).toContain('unknown')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
