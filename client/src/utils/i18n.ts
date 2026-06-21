/**
 * 全局 i18n 工具
 * 用于在非 Vue 组件环境中（API、服务、工具类等）使用国际化
 */
import { getI18nGlobal } from '@/locales'

/**
 * 全局翻译函数
 * @param key - i18n 键
 * @param params - 可选的参数
 * @returns 翻译后的字符串
 */
export function t(key: string, params?: Record<string, string | number>): string {
  try {
    const i18n = getI18nGlobal()
    return i18n.t(key, params)
  } catch {
    // 如果 i18n 未初始化，返回 key 本身
    return key
  }
}

/**
 * 获取当前语言
 */
export function getCurrentLocale(): string {
  try {
    const i18n = getI18nGlobal()
    return typeof i18n.locale === 'object' ? i18n.locale.value : i18n.locale
  } catch {
    return 'zh-CN'
  }
}

/**
 * 检查是否为中文环境
 */
export function isChineseLocale(): boolean {
  const locale = getCurrentLocale()
  return locale.startsWith('zh')
}

// 导出默认的 t 函数
export default t
