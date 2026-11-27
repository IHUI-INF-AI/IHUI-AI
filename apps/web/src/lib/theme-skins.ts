// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * theme-skins — 主题色(皮肤)定义(2026-11-27 立)。
 *
 * 皮肤 = 一套 customTheme 色板(亮/暗各一),走既有 --custom-* 通道;
 * 这里只放数据与判等,不写 CSS、不新增主题系统。
 * 新增皮肤:在此加常量,并在外观设置的主题卡里加一个入口。
 */

import type { CustomThemeConfig } from '@/stores/appearance-settings'

export const PINK_SKIN: CustomThemeConfig = {
  enabled: true,
  light: {
    primary: '#c23a72',
    background: '#fff5f8',
    foreground: '#3f1f2d',
    card: '#ffffff',
    muted: '#fde7f0',
    border: '#f3c8db',
  },
  dark: {
    primary: '#f472b6',
    background: '#1b1016',
    foreground: '#fbe9f1',
    card: '#251722',
    muted: '#33202c',
    border: '#4a2c3b',
  },
}

/** 当前自定义主题是否就是粉色皮肤(亮/暗两套逐键相等才算,用户自定义过的颜色不算) */
export function isPinkSkin(theme: CustomThemeConfig): boolean {
  if (!theme.enabled) return false
  return (['light', 'dark'] as const).every((mode) =>
    (Object.keys(PINK_SKIN[mode]) as (keyof CustomThemeConfig['light'])[]).every(
      (key) => theme[mode][key].toLowerCase() === PINK_SKIN[mode][key].toLowerCase(),
    ),
  )
}

/** 主题卡四选一(2026-11-27 起):中性皮肤 × 明暗档 + 粉色皮肤,设置页与头像菜单共用这一份判定 */
export type SkinChoice = 'system' | 'pearl' | 'obsidian' | 'pink'

export type SkinThemeMode = 'system' | 'light' | 'dark'

/** 当前生效的皮肤选择:粉色皮肤优先(它覆盖明暗两套),否则按 next-themes 的明暗档映射中性皮肤 */
export function resolveSkinChoice(
  customTheme: CustomThemeConfig,
  theme: string | undefined,
): SkinChoice {
  if (isPinkSkin(customTheme)) return 'pink'
  if (theme === 'light') return 'pearl'
  if (theme === 'dark') return 'obsidian'
  return 'system'
}

/** 应用皮肤选择:中性档关闭 customTheme 并同步明暗档;粉色档套 PINK_SKIN 并跟随系统明暗 */
export function applySkinChoice(
  choice: SkinChoice,
  deps: {
    update: (patch: { accentColor: 'default' | 'rose'; customTheme: CustomThemeConfig }) => void
    setTheme: (mode: SkinThemeMode) => void
    customTheme: CustomThemeConfig
  },
): void {
  const { update, setTheme, customTheme } = deps
  if (choice === 'pink') {
    update({ accentColor: 'rose', customTheme: { ...PINK_SKIN } })
    setTheme('system')
    return
  }
  update({ accentColor: 'default', customTheme: { ...customTheme, enabled: false } })
  setTheme(choice === 'pearl' ? 'light' : choice === 'obsidian' ? 'dark' : 'system')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
