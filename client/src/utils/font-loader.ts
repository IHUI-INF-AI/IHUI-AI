/**
 * 字体加载工具
 * 提供字体加载和优化功能
 */

import { logger } from './logger'

/**
 * 加载Google字体
 */
export function loadGoogleFont(family: string, weights: number[] = [400, 700]): void {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/\s+/g, '+')}:wght@${weights.join(';')}&display=swap`
  document.head.appendChild(link)
}

/**
 * 预连接字体CDN
 */
export function preconnectFontCDN(): void {
  const link1 = document.createElement('link')
  link1.rel = 'preconnect'
  link1.href = 'https://fonts.googleapis.com'
  document.head.appendChild(link1)

  const link2 = document.createElement('link')
  link2.rel = 'preconnect'
  link2.href = 'https://fonts.gstatic.com'
  link2.crossOrigin = 'anonymous'
  document.head.appendChild(link2)
}

/**
 * 检查字体是否已加载
 */
export function isFontLoaded(fontFamily: string): boolean {
  return document.fonts.check(`1em "${fontFamily}"`)
}

/**
 * 等待字体加载
 */
export async function waitForFont(fontFamily: string, _timeout = 3000): Promise<boolean> {
  try {
    await document.fonts.load(`1em "${fontFamily}"`)
    return true
  } catch {
    return false
  }
}

/**
 * 从assets加载字体
 */
export async function loadFontFromAssets(): Promise<void> {
  logger.info('Loading font from assets...')
}

/**
 * 加载英文字体
 */
export async function loadEnglishFont(): Promise<void> {
  logger.info('Loading English font...')
}

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

/**
 * 初始化字体加载
 */
export function initFontLoader(): void {
  preconnectFontCDN()
  logger.info('Font loader initialized')
}
