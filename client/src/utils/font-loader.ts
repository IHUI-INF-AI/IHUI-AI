/**
 * 字体加载工具
 * 提供字体加载和优化功能
 */

import { logger } from './logger'

/**
 * 应用字体到文档
 */
export function applyFontToDocument(fontFamily?: string): void {
  const defaultFont = fontFamily || "'HarmonyOS Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  document.documentElement.style.fontFamily = defaultFont
}

/**
 * 强制刷新字体
 */
export function forceRefreshFont(silent = false): void {
  if (!silent) {
    logger.info('Force refreshing font...')
  }
}
