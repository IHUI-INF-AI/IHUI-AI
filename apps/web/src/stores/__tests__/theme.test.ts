// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useThemeStore } from '../theme'

describe('useThemeStore', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    )
    useThemeStore.setState({ theme: 'system', accentColor: 'green', fontSize: 'medium' })
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-accent')
    document.documentElement.removeAttribute('data-font-size')
  })

  it('初始状态为system/green/medium', () => {
    const s = useThemeStore.getState()
    expect(s.theme).toBe('system')
    expect(s.accentColor).toBe('green')
    expect(s.fontSize).toBe('medium')
  })

  it('setTheme更新state为dark', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('setTheme(dark)不再直接操作 .dark 类(由 next-themes 管理)', () => {
    useThemeStore.getState().setTheme('dark')
    // stores/theme.ts 已移除 .dark 类 toggle 逻辑,交给 next-themes 统一管理
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setTheme(light)移除dark类(由 next-themes 管理,store 不操作)', () => {
    useThemeStore.getState().setTheme('dark')
    useThemeStore.getState().setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setAccentColor只更新state,不再设置 data-accent 属性(死代码已移除)', () => {
    useThemeStore.getState().setAccentColor('red')
    expect(useThemeStore.getState().accentColor).toBe('red')
    expect(document.documentElement.getAttribute('data-accent')).toBe(null)
  })

  it('setFontSize只更新state,不再设置 data-font-size 属性(死代码已移除)', () => {
    useThemeStore.getState().setFontSize('large')
    expect(useThemeStore.getState().fontSize).toBe('large')
    expect(document.documentElement.getAttribute('data-font-size')).toBe(null)
  })

  it('setTheme(system)不再自动解析 prefers-color-scheme(由 next-themes 管理)', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    )
    useThemeStore.getState().setTheme('system')
    // resolveDark 已移除,system 主题不再自动 toggle .dark 类
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggleHighContrast切换high-contrast类', () => {
    expect(useThemeStore.getState().highContrast).toBe(false)
    useThemeStore.getState().toggleHighContrast()
    expect(useThemeStore.getState().highContrast).toBe(true)
    expect(document.documentElement.classList.contains('high-contrast')).toBe(true)
    useThemeStore.getState().toggleHighContrast()
    expect(useThemeStore.getState().highContrast).toBe(false)
    expect(document.documentElement.classList.contains('high-contrast')).toBe(false)
  })
})
