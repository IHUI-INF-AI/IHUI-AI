// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useThemeStore } from '../theme'

describe('useThemeStore', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
    useThemeStore.setState({ theme: 'system', accentColor: 'blue', fontSize: 'medium' })
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-accent')
    document.documentElement.removeAttribute('data-font-size')
  })

  it('初始状态为system/blue/medium', () => {
    const s = useThemeStore.getState()
    expect(s.theme).toBe('system')
    expect(s.accentColor).toBe('blue')
    expect(s.fontSize).toBe('medium')
  })

  it('setTheme更新state为dark', () => {
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('setTheme(dark)为documentElement添加dark类', () => {
    useThemeStore.getState().setTheme('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme(light)移除dark类', () => {
    useThemeStore.getState().setTheme('dark')
    useThemeStore.getState().setTheme('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('setAccentColor更新state和data-accent属性', () => {
    useThemeStore.getState().setAccentColor('red')
    expect(useThemeStore.getState().accentColor).toBe('red')
    expect(document.documentElement.getAttribute('data-accent')).toBe('red')
  })

  it('setFontSize更新state和data-font-size属性', () => {
    useThemeStore.getState().setFontSize('large')
    expect(useThemeStore.getState().fontSize).toBe('large')
    expect(document.documentElement.getAttribute('data-font-size')).toBe('large')
  })

  it('setTheme(system)在prefers-color-scheme:dark时添加dark类', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    useThemeStore.getState().setTheme('system')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
