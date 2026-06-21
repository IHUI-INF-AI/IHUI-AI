/**
 * 字体资源加载
 */

import { logger } from './logger'

/**
 * 从资源加载字体
 */
export function loadFontFromAssets(fontName?: string): Promise<void> {
  return new Promise((resolve) => {
    logger.info(`Loading font from assets: ${fontName || 'default'}`)
    resolve()
  })
}
