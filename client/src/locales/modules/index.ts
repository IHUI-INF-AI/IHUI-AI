/**
 * 语言模块索引
 * 支持按需加载语言包
 */

import { logger } from '@/utils/logger'

type LocaleMessages = Record<string, unknown>

// 支持的语言列表
export const supportedLocales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
export type SupportedLocale = typeof supportedLocales[number]

// 核心模块列表
export const coreModules = ["common","navigation","header","auth","routes"] as const

// 异步模块列表
export const asyncModules = ["home","open","openPlatform","openPlatformDocs","dashboard","agentCategory","agentExamine","settlement","agentIncome","agentDetail","orderDetail","orders","models","knowledgeDetail","toolsStore","aiWorld","aiCommunity","community","voiceInput","wxUserCenter","wxMiniprogram","wxLogin","webOnlyFeature","desktopExperience","qrScanner","mobileOptimized","systemTray","desktopSettings","qrCode","unifiedQRLogin","register","app","errorBoundary","connectionStatus","pwa","tour","progress","markdown","commandPalette","aiGeneration","footer","developer","workspace","purchase","apiTest","settlementStats","cmpindex","dramaScript","edu"] as const

// 已加载的模块缓存
const loadedModules = new Map<string, Set<string>>()

// 获取核心模块路径
export function getCoreModulePath(locale: SupportedLocale): string {
  return `./${locale}/core.json`
}

// 获取异步模块路径
export function getAsyncModulePath(locale: SupportedLocale, module: string): string {
  return `./${locale}/${module}.json`
}

// 检查模块是否已加载
export function isModuleLoaded(locale: SupportedLocale, module: string): boolean {
  const loaded = loadedModules.get(locale)
  return loaded ? loaded.has(module) : false
}

// 标记模块为已加载
export function markModuleLoaded(locale: SupportedLocale, module: string): void {
  if (!loadedModules.has(locale)) {
    loadedModules.set(locale, new Set())
  }
  loadedModules.get(locale)!.add(module)
}

// 动态加载核心模块
export async function loadCoreMessages(locale: SupportedLocale): Promise<LocaleMessages> {
  const messages = await import(`./${locale}/core.json`)
  coreModules.forEach(module => markModuleLoaded(locale, module))
  return messages.default || messages
}

// 动态加载异步模块
export async function loadAsyncModule(
  locale: SupportedLocale,
  module: string
): Promise<LocaleMessages | null> {
  if (isModuleLoaded(locale, module)) {
    return null
  }
  
  try {
    const messages = await import(`./${locale}/${module}.json`)
    markModuleLoaded(locale, module)
    return messages.default || messages
  } catch (error) {
    logger.warn(`[i18n] Failed to load module ${module} for ${locale}:`, error)
    return null
  }
}

// 批量加载异步模块
export async function loadAsyncModules(
  locale: SupportedLocale,
  modules: string[]
): Promise<LocaleMessages> {
  const results = await Promise.all(
    modules.map(module => loadAsyncModule(locale, module))
  )
  
  return results.reduce((acc: LocaleMessages, messages: LocaleMessages | null) => {
    if (messages) {
      Object.assign(acc, messages)
    }
    return acc
  }, {} as LocaleMessages)
}

export default {
  supportedLocales,
  coreModules,
  asyncModules,
  loadCoreMessages,
  loadAsyncModule,
  loadAsyncModules,
}
