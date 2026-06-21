// locales/index.ts 单元测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 用 vi.hoisted 在 vi.mock 被提升前准备好共享 mock 状态
const mocks = vi.hoisted(() => {
  const i18nMessagesStore: Record<string, Record<string, unknown>> = {}
  const i18nLocaleRef = { value: 'zh-CN' }
  const mockI18nGlobal = {
    locale: i18nLocaleRef,
    messages: { value: i18nMessagesStore },
    setLocaleMessage: vi.fn((locale: string, messages: Record<string, unknown>) => {
      i18nMessagesStore[locale] = messages
    }),
    mergeLocaleMessage: vi.fn((locale: string, messages: Record<string, unknown>) => {
      i18nMessagesStore[locale] = { ...(i18nMessagesStore[locale] || {}), ...messages }
    }),
    t: vi.fn((key: string) => key),
  }
  const mockI18n = { global: mockI18nGlobal }
  const mockStorageGetItem = vi.fn()
  const mockStorageSetItem = vi.fn()
  const mockLogger = {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  return { i18nMessagesStore, i18nLocaleRef, mockI18nGlobal, mockI18n, mockStorageGetItem, mockStorageSetItem, mockLogger }
})

const { i18nMessagesStore, i18nLocaleRef, mockI18nGlobal, mockI18n, mockStorageGetItem, mockStorageSetItem, mockLogger } = mocks

vi.mock('vue-i18n', () => ({
  createI18n: vi.fn(() => mocks.mockI18n),
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: (key: string) => mocks.mockStorageGetItem(key),
    setItem: (key: string, value: unknown) => mocks.mockStorageSetItem(key, value),
  },
  STORAGE_KEYS: {
    LANGUAGE: 'language',
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: mocks.mockLogger,
}))

// 模拟 element-plus 语言包
vi.mock('element-plus/es/locale/lang/zh-cn', () => ({ default: { name: 'zh-cn' } }))
vi.mock('element-plus/es/locale/lang/zh-tw', () => ({ default: { name: 'zh-tw' } }))
vi.mock('element-plus/es/locale/lang/en', () => ({ default: { name: 'en' } }))
vi.mock('element-plus/es/locale/lang/ja', () => ({ default: { name: 'ja' } }))
vi.mock('element-plus/es/locale/lang/ko', () => ({ default: { name: 'ko' } }))

// 模拟 element-plus 包以兼容多种导入路径
vi.mock('element-plus', () => ({}))

import {
  languages,
  setLanguage,
  loadModule,
  loadModules,
  getCurrentLocale,
  getLoadedModules,
  asyncModules,
  getI18nGlobal,
  getElementPlusLocale,
  initI18n,
  default as i18nDefault,
} from '../index'

describe('locales/index.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // 清空 mock i18n 状态
    Object.keys(i18nMessagesStore).forEach(k => delete i18nMessagesStore[k])
    i18nLocaleRef.value = 'zh-CN'
    // 设置默认浏览器语言
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('常量与类型', () => {
    // 测试导出的 languages 数组
    it('languages 应包含 5 种语言', () => {
      expect(languages).toHaveLength(5)
      expect(languages.map(l => l.code)).toEqual(['zh-CN', 'zh-TW', 'en', 'ja', 'ko'])
    })

    it('languages 各项包含 code 与 name', () => {
      languages.forEach(lang => {
        expect(lang).toHaveProperty('code')
        expect(lang).toHaveProperty('name')
        expect(typeof lang.code).toBe('string')
        expect(typeof lang.name).toBe('string')
      })
    })

    // 测试 asyncModules 导出
    it('asyncModules 应为非空字符串数组', () => {
      expect(Array.isArray(asyncModules)).toBe(true)
      expect(asyncModules.length).toBeGreaterThan(0)
      asyncModules.forEach(m => expect(typeof m).toBe('string'))
    })

    // 测试默认导出
    it('default 应为 i18n 实例', () => {
      expect(i18nDefault).toBeDefined()
      expect(i18nDefault).toBe(mockI18n)
    })
  })

  describe('getCurrentLocale', () => {
    // 测试获取当前语言
    it('应返回当前 locale', () => {
      i18nLocaleRef.value = 'en'
      expect(getCurrentLocale()).toBe('en')
    })

    it('默认 locale 应为 zh-CN', () => {
      i18nLocaleRef.value = 'zh-CN'
      expect(getCurrentLocale()).toBe('zh-CN')
    })
  })

  describe('getLoadedModules', () => {
    // 测试获取已加载模块列表
    it('未加载任何模块时返回空数组', () => {
      expect(getLoadedModules('zh-CN')).toEqual([])
    })

    it('加载模块后能查询到', async () => {
      await loadModule('zh-CN', 'account')
      const loaded = getLoadedModules('zh-CN')
      expect(loaded).toContain('account')
    })

    it('不同 locale 的模块列表相互独立', async () => {
      await loadModule('zh-CN', 'account')
      await loadModule('en', 'account')
      expect(getLoadedModules('zh-CN')).toContain('account')
      expect(getLoadedModules('en')).toContain('account')
    })
  })

  describe('getI18nGlobal', () => {
    // 测试获取 i18n global 对象
    it('应返回带 t 与 locale 的对象', () => {
      const g = getI18nGlobal()
      expect(g).toHaveProperty('t')
      expect(g).toHaveProperty('locale')
    })

    it('t 函数应可调用', () => {
      const g = getI18nGlobal()
      // 由于内部 mock t 是 vi.fn，默认会返回 key 字符串
      expect(typeof g.t).toBe('function')
    })
  })

  describe('getElementPlusLocale', () => {
    // 测试 Element Plus 语言包映射
    it('zh-CN 与 zh 应返回中文简体', () => {
      expect(getElementPlusLocale('zh-CN')).toEqual({ name: 'zh-cn' })
      expect(getElementPlusLocale('zh')).toEqual({ name: 'zh-cn' })
    })

    it('zh-TW 与 zh-tw 应返回繁体', () => {
      expect(getElementPlusLocale('zh-TW')).toEqual({ name: 'zh-tw' })
      expect(getElementPlusLocale('zh-tw')).toEqual({ name: 'zh-tw' })
    })

    it('en 与 EN 应返回英文', () => {
      expect(getElementPlusLocale('en')).toEqual({ name: 'en' })
      expect(getElementPlusLocale('EN')).toEqual({ name: 'en' })
    })

    it('ja 应返回日文', () => {
      expect(getElementPlusLocale('ja')).toEqual({ name: 'ja' })
    })

    it('ko 应返回韩文', () => {
      expect(getElementPlusLocale('ko')).toEqual({ name: 'ko' })
    })

    it('空字符串应回退为 zh-CN', () => {
      // 源码实现：lang || 'zh-CN'
      expect(getElementPlusLocale('')).toEqual({ name: 'zh-cn' })
    })

    it('未传入参数应回退为 zh-CN', () => {
      // @ts-expect-error 故意不传参测试默认行为
      expect(getElementPlusLocale()).toEqual({ name: 'zh-cn' })
    })

    it('不识别的语言应返回英文', () => {
      expect(getElementPlusLocale('xx-XX')).toEqual({ name: 'en' })
    })
  })

  describe('setLanguage', () => {
    // 测试设置语言功能
    it('应写入 localStorage 与 StorageManager', async () => {
      await setLanguage('en')
      expect(localStorage.getItem('language')).toBe('en')
      expect(mockStorageSetItem).toHaveBeenCalledWith('language', 'en')
    })

    it('应切换 i18n locale', async () => {
      await setLanguage('ja')
      expect(i18nLocaleRef.value).toBe('ja')
    })

    it('zh 开头应设置 lang=zh-CN', async () => {
      await setLanguage('zh-TW')
      expect(document.documentElement.getAttribute('lang')).toBe('zh-CN')
    })

    it('非 zh 应设置 lang=en', async () => {
      await setLanguage('en')
      expect(document.documentElement.getAttribute('lang')).toBe('en')
    })

    it('应设置 dir=ltr', async () => {
      await setLanguage('en')
      expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    })

    it('应发送 SET_LANGUAGE 消息', async () => {
      const postSpy = vi.spyOn(window, 'postMessage')
      await setLanguage('en')
      expect(postSpy).toHaveBeenCalledWith(
        { type: 'SET_LANGUAGE', lang: 'en' },
        '*',
      )
    })

    it('不支持的语言应回退到 zh-CN', async () => {
      await setLanguage('xx-XX')
      expect(localStorage.getItem('language')).toBe('zh-CN')
      expect(i18nLocaleRef.value).toBe('zh-CN')
    })

    it('localStorage 写入失败不应抛错', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
      })
      await expect(setLanguage('en')).resolves.toBeUndefined()
      setItemSpy.mockRestore()
    })

    it('StorageManager.setItem 失败不应影响主流程', async () => {
      mockStorageSetItem.mockImplementation(() => {
        throw new Error('storage err')
      })
      await expect(setLanguage('en')).resolves.toBeUndefined()
      // 仍然切换了 locale
      expect(i18nLocaleRef.value).toBe('en')
    })
  })

  describe('loadModule', () => {
    // 测试按需加载模块
    it('应能加载 zh-CN/account 模块', async () => {
      await loadModule('zh-CN', 'account')
      expect(getLoadedModules('zh-CN')).toContain('account')
    })

    it('已加载模块不应重复加载', async () => {
      await loadModule('zh-CN', 'account')
      await loadModule('zh-CN', 'account')
      const calls = mockI18nGlobal.mergeLocaleMessage.mock.calls.length
      // 重复调用应当不再触发 merge
      await loadModule('zh-CN', 'account')
      expect(mockI18nGlobal.mergeLocaleMessage.mock.calls.length).toBe(calls)
    })

    it('缺失的 zh-CN 模块应返回 null（不抛错）', async () => {
      // 不存在的模块名
      await expect(loadModule('zh-CN', 'this_module_does_not_exist_xyz')).resolves.toBeUndefined()
    })

    it('非 zh-CN 缺失模块回退路径不应抛错', async () => {
      // 加载一个不存在的模块：先尝试 en、再回退到 zh-CN，都不存在时不应抛错
      await expect(
        loadModule('en', 'this_module_does_not_exist_xyz'),
      ).resolves.toBeUndefined()
    })

    it('非 zh-CN 与 zh-CN 都缺失时应记录 warn', async () => {
      await loadModule('en', 'this_module_does_not_exist_xyz_2')
      // 至少调用了 warn 记录失败
      expect(mockLogger.warn).toHaveBeenCalled()
    })
  })

  describe('loadModules', () => {
    // 测试批量加载模块
    it('应批量加载多个模块', async () => {
      await loadModules('zh-CN', ['account', 'article'])
      const loaded = getLoadedModules('zh-CN')
      expect(loaded).toContain('account')
      expect(loaded).toContain('article')
    })

    it('全部已加载时应直接返回', async () => {
      await loadModules('zh-CN', ['account'])
      const beforeCalls = mockI18nGlobal.mergeLocaleMessage.mock.calls.length
      await loadModules('zh-CN', ['account'])
      // 不应再次调用 merge
      expect(mockI18nGlobal.mergeLocaleMessage.mock.calls.length).toBe(beforeCalls)
    })

    it('空模块列表应直接返回', async () => {
      await expect(loadModules('zh-CN', [])).resolves.toBeUndefined()
    })

    it('含不存在模块时应不抛错', async () => {
      await expect(
        loadModules('zh-CN', ['account', 'this_module_does_not_exist_xyz_3']),
      ).resolves.toBeUndefined()
    })
  })

  describe('initI18n', () => {
    // 测试初始化 i18n
    it('应完成初始化流程', async () => {
      await initI18n()
      // 核心模块加载完成后 mergeLocaleMessage 应被调用过
      expect(mockI18nGlobal.mergeLocaleMessage).toHaveBeenCalled()
    })

    it('初始化后 zh-CN 应加载核心模块', async () => {
      await initI18n()
      const loaded = getLoadedModules('zh-CN')
      expect(loaded.length).toBeGreaterThan(0)
    })
  })
})
