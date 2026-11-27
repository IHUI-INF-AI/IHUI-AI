// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一主题卡(2026-11-27 三字主题色版)
 *
 * 验证「一行选完」:随系统 / 珍珠白 / 曜石黑 = 中性皮肤 + next-themes 明暗档,
 * 芭比粉 = 粉色皮肤色板 + 玫瑰主色(固定亮档);切回中性只关 customTheme、不动排版配置。
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const hoisted = vi.hoisted(() => ({ theme: 'system', setTheme: vi.fn() }))
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: hoisted.theme, setTheme: hoisted.setTheme }),
}))

import { PINK_SKIN, isPinkSkin } from '@/lib/theme-skins'
import { APPEARANCE_DEFAULTS, useAppearanceStore } from '@/stores/appearance-settings'

import { ThemeCard } from '../theme-card'

beforeEach(() => {
  useAppearanceStore.getState().resetAll()
  hoisted.theme = 'system'
  hoisted.setTheme.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('ThemeCard(统一主题)', () => {
  it('点击芭比粉:开启粉色皮肤并选中玫瑰主色,固定亮档,不碰排版字段', () => {
    render(<ThemeCard />)
    fireEvent.click(screen.getByTestId('appearance-skin-pink'))
    const state = useAppearanceStore.getState()
    expect(state.customTheme.enabled).toBe(true)
    expect(isPinkSkin(state.customTheme)).toBe(true)
    expect(state.accentColor).toBe('rose')
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('light')
    expect(state.uiScale).toBe(APPEARANCE_DEFAULTS.uiScale)
    expect(state.fontFamily).toBe(APPEARANCE_DEFAULTS.fontFamily)
    for (const mode of ['light', 'dark'] as const) {
      for (const value of Object.values(PINK_SKIN[mode])) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('粉色选中后再点珍珠白:关闭自定义主题、切浅色,排版配置原样保留', () => {
    useAppearanceStore.getState().update({ uiScale: 1.1 })
    render(<ThemeCard />)
    fireEvent.click(screen.getByTestId('appearance-skin-pink'))
    fireEvent.click(screen.getByTestId('appearance-skin-pearl'))
    const state = useAppearanceStore.getState()
    expect(state.customTheme.enabled).toBe(false)
    expect(state.accentColor).toBe('default')
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('light')
    expect(state.uiScale).toBe(1.1)
  })

  it('曜石黑与随系统:中性皮肤 + 对应明暗档', () => {
    render(<ThemeCard />)
    fireEvent.click(screen.getByTestId('appearance-skin-obsidian'))
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('dark')
    expect(useAppearanceStore.getState().customTheme.enabled).toBe(false)
    fireEvent.click(screen.getByTestId('appearance-skin-system'))
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('system')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
