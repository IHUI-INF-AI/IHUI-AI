import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider, useI18n, LOCALES } from '../src/i18n'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(I18nProvider, null, children)
}

describe('i18n', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('LOCALES contains all 5 supported locales', () => {
    expect(LOCALES).toEqual(['zh-CN', 'en', 'ja', 'ko', 'zh-TW'])
  })

  it('defaults to zh-CN when no saved locale', () => {
    const { result } = renderHook(() => useI18n(), { wrapper })
    expect(result.current.locale).toBe('zh-CN')
  })

  it('t() translates a key in zh-CN', () => {
    const { result } = renderHook(() => useI18n(), { wrapper })
    expect(result.current.t('nav.chat')).toBe('AI 对话')
  })

  it('t() returns the key itself when translation is missing', () => {
    const { result } = renderHook(() => useI18n(), { wrapper })
    expect(result.current.t('nonexistent.deep.key')).toBe('nonexistent.deep.key')
  })

  it('setLocale changes locale and t() returns translated text', () => {
    const { result } = renderHook(() => useI18n(), { wrapper })
    act(() => result.current.setLocale('en'))
    expect(result.current.locale).toBe('en')
    expect(result.current.t('nav.chat')).toBe('Chat')
  })

  it('setLocale ignores invalid locale values', () => {
    const { result } = renderHook(() => useI18n(), { wrapper })
    act(() => result.current.setLocale('fr' as never))
    expect(result.current.locale).toBe('zh-CN')
  })

  it('locale is persisted to localStorage on change', () => {
    const { result } = renderHook(() => useI18n(), { wrapper })
    act(() => result.current.setLocale('ja'))
    expect(localStorage.getItem('ihui_locale')).toBe('ja')
  })

  it('initial locale is read from localStorage', () => {
    localStorage.setItem('ihui_locale', 'ko')
    const { result } = renderHook(() => useI18n(), { wrapper })
    expect(result.current.locale).toBe('ko')
    expect(result.current.t('nav.settings')).toBe('설정')
  })
})
