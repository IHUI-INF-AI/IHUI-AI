import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { I18nProvider, useI18n } from '../src/i18n'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
)

function renderI18n() {
  return renderHook(() => useI18n(), { wrapper })
}

describe('i18n / I18nProvider', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
  })

  it('默认 locale 为 zh-CN', () => {
    const { result } = renderI18n()
    expect(result.current.locale).toBe('zh-CN')
  })

  it('t() 通过点分路径返回对应文案', () => {
    const { result } = renderI18n()
    expect(result.current.t('common.save')).toBe('保存')
    expect(result.current.t('nav.home')).toBe('首页')
    expect(result.current.t('auth.login')).toBe('登录')
  })

  it('t() 未知 key 返回 key 本身', () => {
    const { result } = renderI18n()
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key')
    expect(result.current.t('common.unknown')).toBe('common.unknown')
  })

  it('t() 支持 {{name}} 参数插值', () => {
    const { result } = renderI18n()
    expect(result.current.t('common.save', { name: 'X' })).toBe('保存')
    expect(result.current.t('hello {{name}}', { name: 'IHUI' })).toBe('hello IHUI')
    expect(result.current.t('{{count}} items', { count: 3 })).toBe('3 items')
  })

  it('setLocale 切换后 t() 返回新 locale 文案', async () => {
    const { result } = renderI18n()
    await act(async () => {
      await result.current.setLocale('en')
    })
    expect(result.current.locale).toBe('en')
    expect(result.current.t('common.save')).toBe('Save')
    expect(result.current.t('nav.home')).toBe('Home')
  })

  it('未在当前 locale 的 key fallback 到 zh-CN', async () => {
    const { result } = renderI18n()
    await act(async () => {
      await result.current.setLocale('ja')
    })
    expect(result.current.t('common.save')).toBe('保存')
    expect(result.current.t('favorites.title')).toBe('我的收藏')
  })

  it('setLocale 持久化到 AsyncStorage', async () => {
    const { result } = renderI18n()
    await act(async () => {
      await result.current.setLocale('ko')
    })
    expect(await AsyncStorage.getItem('ihui_locale')).toBe('ko')
  })

  it('I18nProvider 从 AsyncStorage 恢复已保存的 locale', async () => {
    await AsyncStorage.setItem('ihui_locale', 'en')
    const { result } = renderI18n()
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current.locale).toBe('en')
    expect(result.current.t('common.save')).toBe('Save')
  })

  it('useI18n 在 Provider 外调用抛错', () => {
    expect(() => renderHook(() => useI18n())).toThrow('useI18n must be used within I18nProvider')
  })
})
