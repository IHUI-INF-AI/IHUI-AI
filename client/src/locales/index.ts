/**
 * 国际化配置 - 支持按需加载语言包
 * 
 * 核心模块会在应用启动时加载
 * 异步模块会在需要时按需加载
 */

import { createI18n } from 'vue-i18n'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
import zhCnEp from 'element-plus/es/locale/lang/zh-cn'
import zhTwEp from 'element-plus/es/locale/lang/zh-tw'
import enEp from 'element-plus/es/locale/lang/en'
import jaEp from 'element-plus/es/locale/lang/ja'
import koEp from 'element-plus/es/locale/lang/ko'

// 支持的语言列表
export const languages = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
]

export type SupportedLocale = 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko'

// 核心模块列表 - 应用启动时加载
const coreModules = ['common', 'navigation', 'header', 'auth', 'routes'] as const

// 异步模块列表 - 按需加载
const asyncModules = [
  'home', 'open', 'openPlatform', 'openPlatformDocs', 'dashboard',
  'agentCategory', 'agentExamine', 'settlement', 'agentIncome', 'agentDetail',
  'orderDetail', 'orders', 'models', 'knowledgeDetail', 'toolsStore',
  'aiWorld', 'aiCommunity', 'community', 'voiceInput', 'wxUserCenter',
  'wxMiniprogram', 'wxLogin', 'webOnlyFeature', 'desktopExperience',
  'qrScanner', 'mobileOptimized', 'systemTray', 'desktopSettings',
  'qrCode', 'unifiedQRLogin', 'register', 'app', 'errorBoundary',
  'connectionStatus', 'pwa', 'tour', 'progress', 'markdown',
  'commandPalette', 'aiGeneration', 'footer', 'developer', 'workspace',
  'purchase', 'apiTest', 'settlementStats', 'cmpindex', 'vip', 'search',
  'dramaScript'
] as const

// 已加载的模块缓存
const loadedModules = new Map<string, Set<string>>()

// 已加载完整语言包的 locale 缓存（用于按当前语言从对应文件反显翻译）
const fullLocaleLoaded = new Set<string>()

// 模块消息缓存
const moduleMessages = new Map<string, Record<string, unknown>>()

// 按当前语言加载拆分后的语言包 chunk 并合并到 i18n
// 完整语言包已按顶级键前缀拆分到 full/{locale}/*.json, 避免单个 674KB 大 chunk
async function loadFullLocaleMessages(locale: SupportedLocale): Promise<void> {
  if (fullLocaleLoaded.has(locale)) return
  try {
    const allModules = import.meta.glob('./full/*/*.json')
    const entries = await Promise.all(
      Object.entries(allModules)
        .filter(([path]) => path.startsWith(`./full/${locale}/`))
        .map(([, loader]) => loader())
    )
    const merged: Record<string, unknown> = {}
    for (const entry of entries) {
      const msg = (entry as { default?: Record<string, unknown> }).default || entry as Record<string, unknown>
      Object.assign(merged, msg)
    }
    if (Object.keys(merged).length > 0) {
      mergeI18nMessages(locale, merged)
      fullLocaleLoaded.add(locale)
      if (import.meta.env.DEV) {
        logger.info(`[i18n] Full locale messages loaded for ${locale} from ${entries.length} chunks`)
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load full locale for ${locale}:`, error)
    }
  }
}

// 动态加载核心模块
async function loadCoreMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  const [coreMod, appMod] = await Promise.all([
    import(`./modules/${locale}/core.json`),
    import(`./modules/${locale}/app.json`).catch(() => import(`./modules/zh-CN/app.json`).catch(() => null)),
  ])
  coreModules.forEach(module => markModuleLoaded(locale, module))
  markModuleLoaded(locale, 'app')
  const core = coreMod.default || coreMod
  const app = appMod ? (appMod.default || appMod) : {}
  return { ...core, ...app }
}

// P6-5：缺失模块时回退到 zh-CN（避免英/日/韩部分页面键名裸露）
async function loadAsyncModuleWithFallback(
  locale: SupportedLocale,
  module: string
): Promise<Record<string, unknown> | null> {
  if (isModuleLoaded(locale, module)) {
    return null
  }
  try {
    const messages = await import(`./modules/${locale}/${module}.json`)
    markModuleLoaded(locale, module)
    return messages.default || messages
  } catch (primaryError) {
    if (locale === 'zh-CN') return null
    try {
      const fallback = await import(`./modules/zh-CN/${module}.json`)
      markModuleLoaded(locale, module)
      if (import.meta.env.DEV) {
        logger.debug(`[i18n] Module ${module} missing for ${locale}, using zh-CN fallback`)
      }
      return fallback.default || fallback
    } catch {
      if (import.meta.env.DEV) {
        logger.warn(`[i18n] Failed to load module ${module} for ${locale}:`, primaryError)
      }
      return null
    }
  }
}

// 动态加载异步模块
async function loadAsyncModule(
  locale: SupportedLocale,
  module: string
): Promise<Record<string, unknown> | null> {
  if (isModuleLoaded(locale, module)) {
    return null
  }
  
  try {
    const messages = await import(`./modules/${locale}/${module}.json`)
    markModuleLoaded(locale, module)
    return messages.default || messages
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load module ${module} for ${locale}:`, error)
    }
    return null
  }
}

// 批量加载异步模块
async function _loadAsyncModules(
  locale: SupportedLocale,
  modules: readonly string[]
): Promise<Record<string, unknown>> {
  const results = await Promise.all(
    modules.map(module => loadAsyncModule(locale, module))
  )
  
  const merged: Record<string, unknown> = {}
  for (const messages of results) {
    if (messages) {
      Object.assign(merged, messages)
    }
  }
  return merged
}

// 检查模块是否已加载
function isModuleLoaded(locale: SupportedLocale, module: string): boolean {
  const loaded = loadedModules.get(locale)
  return loaded ? loaded.has(module) : false
}

// 标记模块为已加载
function markModuleLoaded(locale: SupportedLocale, module: string): void {
  if (!loadedModules.has(locale)) {
    loadedModules.set(locale, new Set())
  }
  loadedModules.get(locale)!.add(module)
}

// 获取浏览器默认语言
function getBrowserLanguage(): SupportedLocale {
  const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem('language') : null
  if (savedLanguage && languages.some(l => l.code === savedLanguage)) {
    return savedLanguage as SupportedLocale
  }
  
  try {
    const stored = StorageManager.getItem<string>(STORAGE_KEYS.LANGUAGE)
    if (stored) {
      const mapped = stored === 'zh' ? 'zh-CN' : stored === 'en' ? 'en' : stored
      if (languages.some(l => l.code === mapped)) {
        return mapped as SupportedLocale
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn('[locales] Failed to read language from localStorage:', error)
    }
  }
  
  const browserLang = navigator.language
  if (languages.some(l => l.code === browserLang)) {
    return browserLang as SupportedLocale
  }
  
  const langPrefix = browserLang.split('-')[0]
  for (const lang of languages) {
    if (lang.code.startsWith(langPrefix)) {
      return lang.code as SupportedLocale
    }
  }
  
  return 'zh-CN'
}

// 创建i18n实例 - 初始时只加载核心模块
const i18n = createI18n({
  legacy: false,
  locale: getBrowserLanguage(),
  messages: {},
  compilerOptions: {
    isCustomElement: (tag: string) => tag.startsWith('el-'),
    whitespace: 'condense',
  },
  fallbackWarn: false,
  missingWarn: false,
} as Parameters<typeof createI18n>[0])

// P6-5：缺翻译时回退中文，避免键名裸露
;(i18n.global as unknown as { fallbackLocale: { value: string } }).fallbackLocale = { value: 'zh-CN' }

// 类型定义：i18n全局实例
type _I18nGlobal = typeof i18n.global & {
  messages: { value: Record<string, Record<string, unknown>> }
  setLocaleMessage: (locale: string, messages: Record<string, unknown>) => void
  mergeLocaleMessage: (locale: string, messages: Record<string, unknown>) => void
}

// 获取i18n全局实例的类型安全访问
function getI18nMessages(locale: string): Record<string, unknown> {
  const global = i18n.global as unknown as _I18nGlobal
  if (typeof global.messages === 'object' && 'value' in global.messages) {
    return global.messages.value[locale] || {}
  }
  return {}
}

function setI18nMessages(locale: string, messages: Record<string, unknown>): void {
  const global = i18n.global as unknown as _I18nGlobal
  if (typeof global.setLocaleMessage === 'function') {
    global.setLocaleMessage(locale, messages)
  } else if (typeof global.messages === 'object' && 'value' in global.messages) {
    global.messages.value[locale] = messages
  }
}

function mergeI18nMessages(locale: string, messages: Record<string, unknown>): void {
  const global = i18n.global as unknown as _I18nGlobal
  if (typeof global.mergeLocaleMessage === 'function') {
    global.mergeLocaleMessage(locale, messages)
  } else {
    const existing = getI18nMessages(locale)
    setI18nMessages(locale, { ...existing, ...messages })
  }
}

function getI18nLocale(): string {
  const locale = i18n.global.locale
  return typeof locale === 'string' ? locale : locale.value
}

function setI18nLocale(locale: string): void {
  const globalLocale = i18n.global.locale
  if (typeof globalLocale === 'object' && globalLocale !== null && 'value' in globalLocale) {
    globalLocale.value = locale
  }
}

// 初始化核心模块
async function initializeCoreMessages(): Promise<void> {
  const locale = getI18nLocale() as SupportedLocale
  
  try {
    const coreMessages = await loadCoreMessages(locale)
    
    // 使用 mergeLocaleMessage 合并消息
    mergeI18nMessages(locale, coreMessages)
    
    // 缓存模块消息
    moduleMessages.set(locale, { ...coreMessages })
    
    // 加载完整语言包，使 floatingChat 等键能根据当前语言从对应文件反显
    await loadFullLocaleMessages(locale)
    
    if (import.meta.env.DEV) {
      logger.info(`[i18n] Core messages loaded for ${locale}`)
    }
  } catch (error) {
    logger.error(`[i18n] Failed to load core messages for ${locale}:`, error)
  }
}

// 设置语言并加载对应的核心模块
export async function setLanguage(lang: string): Promise<void> {
  const target = languages.some(l => l.code === lang) ? lang : 'zh-CN'
  
  try {
    localStorage.setItem('language', target)
    try {
      StorageManager.setItem(STORAGE_KEYS.LANGUAGE, target)
    } catch (storageError) {
      if (import.meta.env.DEV) {
        logger.debug('[Locales] StorageManager setItem failed:', storageError)
      }
    }
  } catch (langError) {
    if (import.meta.env.DEV) {
      logger.debug('[Locales] Language set failed:', langError)
    }
  }
  
  try {
    const targetLocale = target as SupportedLocale
    // 加载目标语言的核心模块
    if (!isModuleLoaded(targetLocale, 'common')) {
      const coreMessages = await loadCoreMessages(targetLocale)
      mergeI18nMessages(target, coreMessages)
    }
    // 加载目标语言的完整语言包，保证切换语言后 t() 从对应语言文件取键值反显
    await loadFullLocaleMessages(targetLocale)
    
    // 设置locale
    setI18nLocale(target)
    
    document.documentElement.setAttribute('lang', target.startsWith('zh') ? 'zh-CN' : 'en')
    document.documentElement.setAttribute('dir', 'ltr')
    window.postMessage({ type: 'SET_LANGUAGE', lang: target }, '*')
  } catch (error) {
    logger.error('Language setting failed:', error)
  }
}

// 按需加载模块
export async function loadModule(locale: SupportedLocale, module: string): Promise<void> {
  if (isModuleLoaded(locale, module)) {
    return
  }

  try {
    const messages = await loadAsyncModuleWithFallback(locale, module)
    if (messages) {
      mergeI18nMessages(locale, messages)

      if (import.meta.env.DEV) {
        logger.debug(`[i18n] Module ${module} loaded for ${locale}`)
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load module ${module}:`, error)
    }
  }
}

// 批量加载模块
export async function loadModules(locale: SupportedLocale, modules: string[]): Promise<void> {
  const modulesToLoad = modules.filter(m => !isModuleLoaded(locale, m))
  if (modulesToLoad.length === 0) {
    return
  }

  try {
    const results = await Promise.all(
      modulesToLoad.map(module => loadAsyncModuleWithFallback(locale, module))
    )
    const merged: Record<string, unknown> = {}
    for (const messages of results) {
      if (messages) {
        Object.assign(merged, messages)
      }
    }
    mergeI18nMessages(locale, merged)

    if (import.meta.env.DEV) {
      logger.debug(`[i18n] ${modulesToLoad.length} modules loaded for ${locale}`)
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      logger.warn(`[i18n] Failed to load modules:`, error)
    }
  }
}

// 获取当前语言
export function getCurrentLocale(): SupportedLocale {
  return getI18nLocale() as SupportedLocale
}

// 获取已加载的模块列表
export function getLoadedModules(locale: SupportedLocale): string[] {
  const loaded = loadedModules.get(locale)
  return loaded ? Array.from(loaded) : []
}

// 导出异步模块列表供外部使用
export { asyncModules }

// 类型辅助函数：获取 i18n.global 的类型安全版本
export function getI18nGlobal() {
  return i18n.global as {
    t: (key: string, params?: Record<string, string | number>) => string
    locale: { value: string } | string
  }
}

// 获取Element Plus语言包
export function getElementPlusLocale(lang: string) {
  const code = (lang || 'zh-CN').toLowerCase()
  if (code.startsWith('zh-tw')) return zhTwEp
  if (code.startsWith('zh')) return zhCnEp
  if (code.startsWith('en')) return enEp
  if (code.startsWith('ja')) return jaEp
  if (code.startsWith('ko')) return koEp
  return enEp
}

// 初始化i18n
export async function initI18n(): Promise<void> {
  await initializeCoreMessages()
}

export default i18n
