// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  PERMISSION_TIER_FALLBACK_LABEL,
  PERMISSION_TIER_FALLBACK_TEXT,
  resolvePermissionTierText,
  type TranslateWithFallback,
} from '../permission-tier-text'

// D111:档位行文案解析 — "档位与后果文案出现且本地化、未知档回退不崩、
// 无词表也能跑"(逻辑层,不依赖 Taro 运行时与真实语言包)。

/** 模拟"词表完备"的 tt:命中返回本地化值,缺键返回 fallback。 */
function fakeTt(dict: Record<string, string>): TranslateWithFallback {
  return (key: string, fallback: string) => dict[key] ?? fallback
}

const LOCALIZED: Record<string, string> = {
  'permissionTier.label': '权限档(fake)',
  'permissionTier.mode.accept-edits.title': '接受编辑(fake)',
  'permissionTier.mode.accept-edits.desc': '白名单放行(fake)',
  'permissionTier.mode.unknown.title': '未知模式(fake)',
  'permissionTier.mode.unknown.desc': '未识别(fake)',
  'permissionTier.mode.default.title': '默认模式(fake)',
  'permissionTier.mode.default.desc': '需确认(fake)',
}

describe('resolvePermissionTierText(D111 小程序档位行)', () => {
  it('已知档走词表键(本地化值出现,非硬编码中文)', () => {
    const text = resolvePermissionTierText('accept-edits', fakeTt(LOCALIZED))
    expect(text.label).toBe('权限档(fake)')
    expect(text.title).toBe('接受编辑(fake)')
    expect(text.desc).toBe('白名单放行(fake)')
  })

  it('历史 camel 拼写归一到同一档(acceptEdits → accept-edits)', () => {
    const text = resolvePermissionTierText('acceptEdits', fakeTt(LOCALIZED))
    expect(text.title).toBe('接受编辑(fake)')
  })

  it('未知档回退 unknown(不崩、绝不显示成 default)', () => {
    const text = resolvePermissionTierText('garbage-mode', fakeTt(LOCALIZED))
    expect(text.title).toBe('未知模式(fake)')
    expect(text.desc).toBe('未识别(fake)')
    expect(text.title).not.toBe('默认模式(fake)')
  })

  it('未配置(null)如实显示 default', () => {
    const text = resolvePermissionTierText(null, fakeTt(LOCALIZED))
    expect(text.title).toBe('默认模式(fake)')
  })

  it('词表缺键时端内中文兜底(不渲染 raw key)', () => {
    const text = resolvePermissionTierText('plan', fakeTt({}))
    expect(text.label).toBe(PERMISSION_TIER_FALLBACK_LABEL)
    expect(text.title).toBe(PERMISSION_TIER_FALLBACK_TEXT.plan.title)
    expect(text.desc).toBe(PERMISSION_TIER_FALLBACK_TEXT.plan.desc)
    expect(text.title).not.toContain('permissionTier.mode')
  })

  it('兜底常量完备:五档 title/desc 均非空', () => {
    expect(PERMISSION_TIER_FALLBACK_LABEL.length).toBeGreaterThan(0)
    for (const tier of Object.values(PERMISSION_TIER_FALLBACK_TEXT)) {
      expect(tier.title.length).toBeGreaterThan(0)
      expect(tier.desc.length).toBeGreaterThan(0)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
