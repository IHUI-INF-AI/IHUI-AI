import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 动态 mock @/locales 后再导入 i18n 模块
 * @param overrides 覆盖默认行为
 */
const importFreshI18n = async (overrides: {
  tImpl?: (key: string, params?: Record<string, string | number>) => string
  localeValue?: string | { value: string }
  throwOnGet?: boolean
} = {}) => {
  const tImpl = overrides.tImpl ?? ((key: string, params?: Record<string, string | number>) => {
    if (params) return `translated_${key}_${JSON.stringify(params)}`
    return `translated_${key}`
  })
  const localeValue = overrides.localeValue ?? { value: 'zh-CN' }
  vi.resetModules()
  vi.doMock('@/locales', () => ({
    getI18nGlobal: () => {
      if (overrides.throwOnGet) throw new Error('i18n not ready')
      return {
        t: tImpl,
        locale: localeValue,
      }
    },
  }))
  return await import('../i18n')
}

describe('utils/i18n', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('t', () => {
    it('应返回翻译后的字符串（无参数）', async () => {
      const mod = await importFreshI18n()
      expect(mod.t('common.hello')).toBe('translated_common.hello')
    })

    it('应返回翻译后的字符串（带参数）', async () => {
      const mod = await importFreshI18n()
      const result = mod.t('common.greeting', { name: 'World' })
      expect(result).toContain('translated_common.greeting')
      expect(result).toContain('World')
    })

    it('i18n 未初始化时应回退到 key 本身', async () => {
      const mod = await importFreshI18n({ throwOnGet: true })
      expect(mod.t('common.hello')).toBe('common.hello')
      expect(mod.t('any.key', { x: 1 })).toBe('any.key')
    })
  })

  describe('getCurrentLocale', () => {
    it('应返回 locale ref 的 value', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'en-US' } })
      expect(mod.getCurrentLocale()).toBe('en-US')
    })

    it('应支持 locale 是 string 类型（非 ref）', async () => {
      const mod = await importFreshI18n({ localeValue: 'ja' })
      expect(mod.getCurrentLocale()).toBe('ja')
    })

    it('i18n 未初始化时应回退到 zh-CN', async () => {
      const mod = await importFreshI18n({ throwOnGet: true })
      expect(mod.getCurrentLocale()).toBe('zh-CN')
    })
  })

  describe('isChineseLocale', () => {
    it('zh-CN 应返回 true', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'zh-CN' } })
      expect(mod.isChineseLocale()).toBe(true)
    })

    it('zh-TW 应返回 true（中文变体）', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'zh-TW' } })
      expect(mod.isChineseLocale()).toBe(true)
    })

    it('zh 应返回 true（无地区后缀）', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'zh' } })
      expect(mod.isChineseLocale()).toBe(true)
    })

    it('en-US 应返回 false', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'en-US' } })
      expect(mod.isChineseLocale()).toBe(false)
    })

    it('ja 应返回 false', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'ja' } })
      expect(mod.isChineseLocale()).toBe(false)
    })

    it('ar 应返回 false（RTL 也不属于中文）', async () => {
      const mod = await importFreshI18n({ localeValue: { value: 'ar' } })
      expect(mod.isChineseLocale()).toBe(false)
    })

    it('i18n 未初始化时应基于 zh-CN 回退判断（true）', async () => {
      const mod = await importFreshI18n({ throwOnGet: true })
      expect(mod.isChineseLocale()).toBe(true)
    })
  })
})
