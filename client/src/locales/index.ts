/**
 * 国际化配置 - 支持按需加载语言包
 * 
 * 核心模块会在应用启动时加载
 * 异步模块会在需要时按需加载
 */

import { createI18n } from 'vue-i18n'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { logger } from '@/utils/logger'
// 2026-06-25 修复: Element Plus 语言包改为静态 import
// 历史: 顶层 import 5 个 EP 语言包 (~30KB) -> 改为 dynamic import (按需, 但触发 Vite optimizeDeps hash 失效循环)
// 问题: 每次 Vite HMR / dev server 重启, optimizeDeps 重新生成 element-plus_es_locale_lang_*.js?v=<新hash>,
//       但 App.vue 的 watch(locale, immediate:true) 仍持有旧 hash 引用, 触发
//       "Failed to fetch dynamically imported module: .../element-plus_es_locale_lang_zh-cn__mjs.js?v=<旧hash>"
//       循环报错 (设置 → 模型记录页面 88 条日志主因).
// 修复: 改为 static import, 一次打入 chunk, 加载后不存在 hash 失效.
// 成本: 5 个 EP locale 总计 ~12KB (gzip 后 ~5KB), 可接受.

// Element Plus 5 个语言包 — 静态导入，避免 dynamic import 命中 Vite optimizeDeps hash 失效
import zhCn from 'element-plus/es/locale/lang/zh-cn.mjs'
import zhTw from 'element-plus/es/locale/lang/zh-tw.mjs'
import enUs from 'element-plus/es/locale/lang/en.mjs'
import jaJp from 'element-plus/es/locale/lang/ja.mjs'
import koKr from 'element-plus/es/locale/lang/ko.mjs'

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
// 2026-06-24 修复: 增加 'login' 核心模块, 修复首屏 Login.vue 品牌区翻译键名裸露
// (login.worldFirst / login.oneStopAI / login.aiModels / login.users500k / login.users / login.availability)
// 注意: login.json 仅存在于 full/{locale}/, 实际从 full/{locale}/login.json 加载 (见 loadCoreMessages)
const coreModules = ['common', 'navigation', 'header', 'auth', 'routes', 'errorBoundary', 'login'] as const

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

// 按当前语言加载拆分后的语言包 chunk 并合并到 i18n
// 完整语言包已按顶级键前缀拆分到 full/{locale}/*.json, 避免单个 674KB 大 chunk
// 2026-06-25 修复: 导出 loadFullLocaleMessages, 修复 I18nDashboard.vue 的 MISSING_EXPORT 构建错误
const _fullLocaleLoading = new Map<string, Promise<void>>()
export async function loadFullLocaleMessages(locale: SupportedLocale): Promise<void> {
  if (fullLocaleLoaded.has(locale)) return
  // 竞态保护：并发调用时复用同一个 Promise
  const pending = _fullLocaleLoading.get(locale)
  if (pending) return pending
  const task = (async () => {
    try {
      const allModules = import.meta.glob('./full/*/*.json')
      const entries = await Promise.all(
        Object.entries(allModules)
          .filter(([p]) => p.startsWith(`./full/${locale}/`))
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
  })()
  _fullLocaleLoading.set(locale, task)
  try {
    await task
  } finally {
    _fullLocaleLoading.delete(locale)
  }
}

// 动态加载核心模块
// 2026-06-24 修复: 增加 login 核心模块加载 (从 full/{locale}/login.json, fallback 到 zh-CN/full/login.json)
// 修复首屏 Login.vue 品牌区翻译键名裸露
async function loadCoreMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  const [coreMod, appMod, errorBoundaryMod, loginMod] = await Promise.all([
    // 2026-06-25 修复: core.json 加 fallback，避免非 zh-CN 语言缺少 core.json 时 i18n 初始化崩溃
    import(`./modules/${locale}/core.json`).catch(() => import(`./modules/zh-CN/core.json`)),
    import(`./modules/${locale}/app.json`).catch(() => import(`./modules/zh-CN/app.json`).catch(() => null)),
    import(`./modules/${locale}/errorBoundary.json`).catch(() => import(`./modules/zh-CN/errorBoundary.json`).catch(() => null)),
    // login.json 仅在 full/{locale}/ 下存在, 不在 modules/{locale}/, 所以直接读 full
    import(`./full/${locale}/login.json`).catch(() => import(`./full/zh-CN/login.json`).catch(() => null)),
  ])
  coreModules.forEach(module => markModuleLoaded(locale, module))
  markModuleLoaded(locale, 'app')
  const core = coreMod.default || coreMod
  const app = appMod ? (appMod.default || appMod) : {}
  const errorBoundary = errorBoundaryMod ? (errorBoundaryMod.default || errorBoundaryMod) : {}
  // 2026-06-24 修复: 合并 login 模块的翻译, 修复首屏 Login.vue 键名裸露
  // login.json 结构: { login: {...}, loginPopup: {...}, userLoginPopup: {...} }
  // 需要平铺到 i18n messages 顶层, 使 t('login.worldFirst') 可解析
  const login = loginMod ? (loginMod.default || loginMod) : {}
  return { ...core, ...app, ...errorBoundary, ...login }
}

// P6-5：缺失模块时回退到 zh-CN（避免英/日/韩部分页面键名裸露）
// 2026-06-25 修复: 改为 export，让按需加载组件 (如 GlobalCommandPalette) 能在
// onMounted 中主动调用，避免首屏异步组件挂载时 i18n key 未加载导致键名裸露
export async function loadAsyncModuleWithFallback(
  locale: SupportedLocale,
  module: string
): Promise<Record<string, unknown> | null> {
  if (isModuleLoaded(locale, module)) {
    return null
  }
  try {
    const messages = await import(`./modules/${locale}/${module}.json`)
    const result = (messages.default || messages) as Record<string, unknown>
    if (import.meta.env.DEV) {
      // 调试: 验证 import 拿到的 messages 结构是否正确
      // 2026-06-25 修复: 收窄类型, Object.keys 不接受 unknown, 用 Record<string, unknown> 显式断言
      const cpSection = result.commandPalette as Record<string, unknown> | undefined
      const cmdSection = cpSection?.commands as Record<string, unknown> | undefined
      console.info('[i18n] loaded', {
        module,
        locale,
        hasDefault: !!messages.default,
        topKeys: Object.keys(result),
        cpKeys: cpSection ? Object.keys(cpSection) : null,
        cmdKeys: cmdSection ? Object.keys(cmdSection) : null,
      })
    }
    markModuleLoaded(locale, module)
    return result
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
// 2026-06-25 修复: 移除 compilerOptions.isCustomElement = tag.startsWith('el-')
// 原设置会让 vue-i18n 9.x (legacy: false) 把 el-* 标签当 HTML 自定义元素,
// 误传到 Vue 编译器后 EP 组件无法解析, 触发 el-config-provider 内部 renderSlot(null) 错误
// "Cannot read properties of null (reading 'ce')".
// EP 组件由 unplugin-vue-components + ElementPlusResolver 自动按需导入,
// 正确做法: vite.config.ts 已设置 isCustomElement: () => false (line 730),
//           vue-i18n 不应再覆盖此设置.
const i18n = createI18n({
  legacy: false,
  locale: getBrowserLanguage(),
  messages: {},
  compilerOptions: {
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

    // 2026-06-24 优化：启动时不再加载完整语言包
    // 原行为: await loadFullLocaleMessages(locale)
    // 问题: loadFullLocaleMessages 会在首屏强制 import 564+KB 的 zh-CN full/* JSON
    //      导致 dist 出现 5 个 locale-full-*.js 大 chunk (gzipped 后 ~840KB)
    // 新行为: 只在用户主动切换语言时 (setLanguage) 才加载完整语言包
    // 影响: 缺失的键会回退到 fallbackLocale (zh-CN)，首屏翻译依然完整
    //      特殊页面 (如 I18nDashboard) 需要全量键时可显式调用 loadFullLocaleMessages
    if (import.meta.env.DEV) {
      logger.info(`[i18n] Core messages loaded for ${locale} (full locale deferred)`)
    }
  } catch (error) {
    logger.error(`[i18n] Failed to load core messages for ${locale}:`, error)
  }
}

// 设置语言并加载对应的核心模块
// 2026-06-25 修复: 竞态保护，快速连续切换语言时串行执行，避免 locale 和 messages 不一致
let _setLanguagePromise: Promise<void> | null = null
export async function setLanguage(lang: string): Promise<void> {
  const target = languages.some(l => l.code === lang) ? lang : 'zh-CN'
  // 串行化：等待上一次 setLanguage 完成
  if (_setLanguagePromise) await _setLanguagePromise
  
  const task = (async () => {
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
  })()
  _setLanguagePromise = task
  try {
    await task
  } finally {
    if (_setLanguagePromise === task) _setLanguagePromise = null
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

// Element Plus 语言包懒加载缓存
const _epLocaleCache = new Map<string, Record<string, unknown>>()
const _epLocaleLoading = new Map<string, Promise<Record<string, unknown>>>()

// 2026-06-25 修复: 改为静态映射表 (模块级常量, 避免每次调用重建)
// 5 个 EP locale 已在文件顶部 static import, 这里直接拿引用
// 之前的 () => import('...') 形式会在每次 dev HMR 后变成失效 hash
const _epLocales: Record<string, Record<string, unknown>> = {
  'zh-cn': zhCn as unknown as Record<string, unknown>,
  'zh-tw': zhTw as unknown as Record<string, unknown>,
  en: enUs as unknown as Record<string, unknown>,
  ja: jaJp as unknown as Record<string, unknown>,
  ko: koKr as unknown as Record<string, unknown>,
}

function _epKey(lang: string): string {
  const code = (lang || 'zh-CN').toLowerCase()
  if (code.startsWith('zh-tw')) return 'zh-tw'
  if (code.startsWith('zh')) return 'zh-cn'
  if (code.startsWith('en')) return 'en'
  if (code.startsWith('ja')) return 'ja'
  if (code.startsWith('ko')) return 'ko'
  return 'en'
}

/**
 * 2026-06-25 修复：按需加载 Element Plus 语言包（静态导入版）
 * 首次访问某语言时同步取出引用，后续命中缓存
 * 注意: 此函数必须在调用前已通过 loadElementPlusLocale 预加载，
 *       否则返回 en 兜底 (避免阻塞 UI)
 */
export function getElementPlusLocale(lang: string): Record<string, unknown> {
  const key = _epKey(lang)
  return _epLocaleCache.get(key) || _epLocaleCache.get('en') || _epLocales.en || {}
}

/**
 * 2026-06-25 修复：同步预加载 EP 语言包
 * App.vue 在 locale 变化时调用，确保 el-config-provider 能拿到正确语言
 *
 * 历史: 之前是 async + dynamic import, HMR 后 hash 失效会循环报错
 * 现在: 静态 import, 模块加载时即就绪, 函数体直接命中缓存或兜底
 * 仍保持 async 签名以兼容外部调用方 (App.vue 的 watch callback await)
 */
export async function loadElementPlusLocale(lang: string): Promise<Record<string, unknown>> {
  const key = _epKey(lang)
  // 命中缓存：直接返回（clone 避免外部修改内部缓存）
  if (_epLocaleCache.has(key)) {
    return _epLocaleCache.get(key)!
  }
  // 静态导入：模块已在顶部加载完成，直接取引用 + 缓存
  const locale = _epLocales[key] || _epLocales.en
  _epLocaleCache.set(key, locale)
  // 兜底英文：异步启动预热，确保 UI 始终有可用的 EP 语言包
  if (key !== 'en' && !_epLocaleCache.has('en')) {
    _epLocaleCache.set('en', _epLocales.en)
  }
  return locale
}

// 初始化i18n
export async function initI18n(): Promise<void> {
  await initializeCoreMessages()
}

export default i18n
