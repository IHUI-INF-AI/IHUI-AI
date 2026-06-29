import { describe, it, expect, vi } from 'vitest'
import { t, getCurrentLocale, isChineseLocale } from '../i18n'

vi.mock('@/locales', () => ({
  getI18nGlobal: vi.fn(() => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params) {
        return `translated_${key}_${JSON.stringify(params)}`
      }
      return `translated_${key}`
    },
    locale: { value: 'zh-CN' },
  })),
}))

describe('i18n', () => {
  describe('t', () => {
    it('应该翻译key', () => {
      const result = t('common.hello')
      expect(result).toBe('translated_common.hello')
    })

    it('应该支持参数', () => {
      const result = t('common.greeting', { name: 'World' })
      expect(result).toContain('translated_common.greeting')
      expect(result).toContain('World')
    })
  })

  describe('getCurrentLocale', () => {
    it('应该返回当前语言', () => {
      const result = getCurrentLocale()
      expect(result).toBe('zh-CN')
    })
  })

  describe('isChineseLocale', () => {
    it('应该在中文环境返回true', () => {
      expect(isChineseLocale()).toBe(true)
    })
  })
})
