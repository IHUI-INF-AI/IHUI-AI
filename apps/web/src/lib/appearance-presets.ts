// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内置外观预设(2026-11-15 v4 立)。
 *
 * 预设 = 一组 Partial<AppearanceConfig> 覆盖值,应用时经 store.update() 合并进全局配置。
 * 这里只声明数据,不持有状态、不写 CSS —— 用户自定义预设住在 appearance-presets store。
 */

import {
  APPEARANCE_DEFAULTS,
  SIZE_PRESETS,
  type AppearanceConfig,
} from '@/stores/appearance-settings'

export type BuiltInPresetId = 'default' | 'reading' | 'compact' | 'focus' | 'accessible'

export interface BuiltInAppearancePreset {
  id: BuiltInPresetId
  /** 名称/说明走 i18n(命名空间 appearanceSettings),不在此写死文案 */
  nameKey:
    | 'presetBuiltinDefault'
    | 'presetBuiltinReading'
    | 'presetBuiltinCompact'
    | 'presetBuiltinFocus'
    | 'presetBuiltinAccessible'
  descKey:
    | 'presetBuiltinDefaultDesc'
    | 'presetBuiltinReadingDesc'
    | 'presetBuiltinCompactDesc'
    | 'presetBuiltinFocusDesc'
    | 'presetBuiltinAccessibleDesc'
  overrides: Partial<AppearanceConfig>
}

export const BUILT_IN_APPEARANCE_PRESETS: readonly BuiltInAppearancePreset[] = [
  {
    id: 'default',
    nameKey: 'presetBuiltinDefault',
    descKey: 'presetBuiltinDefaultDesc',
    // 恢复出厂:完整覆盖一份默认值,与 DataCard 的「恢复默认」等价(但不删除自定义预设)
    overrides: APPEARANCE_DEFAULTS,
  },
  {
    id: 'reading',
    nameKey: 'presetBuiltinReading',
    descKey: 'presetBuiltinReadingDesc',
    overrides: {
      fontFamily: 'serif',
      lineHeight: 'relaxed',
      letterSpacing: 'wide',
      chatFontScale: 1.1,
      contentWidth: 'narrow',
      messageDensity: 'spacious',
      paragraphGap: true,
      showTimestamps: false,
      userBubbleWidth: 80,
    },
  },
  {
    id: 'compact',
    nameKey: 'presetBuiltinCompact',
    descKey: 'presetBuiltinCompactDesc',
    overrides: {
      ...SIZE_PRESETS.compact,
      contentWidth: 'wide',
      letterSpacing: 'tight',
      showTimestamps: false,
    },
  },
  {
    id: 'focus',
    nameKey: 'presetBuiltinFocus',
    descKey: 'presetBuiltinFocusDesc',
    overrides: {
      contentWidth: 'narrow',
      messageDensity: 'cozy',
      chatFontScale: 1.05,
      showTimestamps: false,
      showUsage: false,
      showActions: false,
      showReasoning: false,
      showToolCalls: false,
    },
  },
  {
    id: 'accessible',
    nameKey: 'presetBuiltinAccessible',
    descKey: 'presetBuiltinAccessibleDesc',
    overrides: {
      legibilityFont: true,
      highContrast: true,
      focusRing: true,
      linkUnderline: true,
      lineHeight: 'relaxed',
      letterSpacing: 'wide',
      uiScale: 1.1,
      chatFontScale: 1.1,
      mobileFontBoost: true,
      reduceMotion: true,
      userBubbleWidth: 90,
    },
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
