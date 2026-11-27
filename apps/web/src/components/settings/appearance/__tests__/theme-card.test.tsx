// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一主题卡(2026-11-27)
 *
 * 验证「一张卡切全部」:明暗走 next-themes、主题色(默认/粉色)走 appearance store 的 customTheme,
 * 粉色 = 粉色皮肤色板 + 玫瑰主色,切回默认只关 customTheme、不动排版配置。
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
  it('点击粉色主题色:开启粉色皮肤并选中玫瑰主色,不碰排版字段', () => {
    render(<ThemeCard />)
    fireEvent.click(screen.getByTestId('appearance-skin-pink'))
    const state = useAppearanceStore.getState()
    expect(state.customTheme.enabled).toBe(true)
    expect(isPinkSkin(state.customTheme)).toBe(true)
    expect(state.accentColor).toBe('rose')
    expect(state.uiScale).toBe(APPEARANCE_DEFAULTS.uiScale)
    expect(state.fontFamily).toBe(APPEARANCE_DEFAULTS.fontFamily)
    for (const mode of ['light', 'dark'] as const) {
      for (const value of Object.values(PINK_SKIN[mode])) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('粉色选中后再点默认:只关闭自定义主题,排版配置原样保留', () => {
    useAppearanceStore.getState().update({ uiScale: 1.1 })
    render(<ThemeCard />)
    fireEvent.click(screen.getByTestId('appearance-skin-pink'))
    fireEvent.click(screen.getByTestId('appearance-skin-default'))
    const state = useAppearanceStore.getState()
    expect(state.customTheme.enabled).toBe(false)
    expect(state.accentColor).toBe('default')
    expect(state.uiScale).toBe(1.1)
  })

  it('明暗三种模式直接写 next-themes', () => {
    render(<ThemeCard />)
    fireEvent.click(screen.getByTestId('appearance-mode-dark'))
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('dark')
    fireEvent.click(screen.getByTestId('appearance-mode-light'))
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('light')
    fireEvent.click(screen.getByTestId('appearance-mode-system'))
    expect(hoisted.setTheme).toHaveBeenLastCalledWith('system')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
