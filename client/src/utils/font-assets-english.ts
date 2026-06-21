/**
 * 英文字体资源加载
 */

import { logger } from './logger'

/**
 * 加载英文字体
 */
export function loadEnglishFont(): Promise<void> {
  return new Promise((resolve) => {
    // 占位实现
    logger.info('Loading English font...')
    resolve()
  })
}
