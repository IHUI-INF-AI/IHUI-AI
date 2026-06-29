import { t } from '@/utils/i18n'

import { getCurrentPlatform, PlatformType } from '../router/utils/routeMerger'
import { logger } from './logger'

/**
 * 剪贴板操作结果接口
 */
export interface ClipboardResult {
  success: boolean
  platform: PlatformType
  message?: string
}

/**
 * 跨平台剪贴板工具
 */
export class ClipboardManager {
  /**
   * 复制文本到剪贴板
   * @param text 要复制的文本
   * @returns 复制结果
   */
  static async copy(text: string): Promise<ClipboardResult> {
    const platform = getCurrentPlatform()

    try {
      switch (platform) {
        case 'web':
        case 'h5':
        case 'electron':
          return this.copyToWeb(text)
        case 'alipay':
          return this.copyToAlipay(text)
        default:
          logger.warn(`Unsupported clipboard platform: ${platform}`)
          return {
            success: false,
            platform,
            message: `Unsupported clipboard platform: ${platform}`,
          }
      }
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error)
      return {
        success: false,
        platform,
        message: error instanceof Error ? error.message : t('api.clipboard.复制失败'),
      }
    }
  }

  /**
   * 从剪贴板读取文本
   * @returns 读取的文本和结果
   */
  static async paste(): Promise<{ text: string | null } & ClipboardResult> {
    const platform = getCurrentPlatform()

    try {
      switch (platform) {
        case 'web':
        case 'h5':
        case 'electron':
          return this.pasteFromWeb()
        case 'alipay':
          return this.pasteFromAlipay()
        default:
          logger.warn(`Unsupported clipboard platform: ${platform}`)
          return {
            text: null,
            success: false,
            platform,
            message: `Unsupported clipboard platform: ${platform}`,
          }
      }
    } catch (error) {
      logger.error('Failed to read from clipboard:', error)
      return {
        text: null,
        success: false,
        platform,
        message: error instanceof Error ? error.message : t('api.clipboard.读取失败1'),
      }
    }
  }

  /**
   * 复制到Web/H5/Electron平台剪贴板
   * @param text 要复制的文本
   * @returns 复制结果
   */
  private static async copyToWeb(text: string): Promise<ClipboardResult> {
    const platform = getCurrentPlatform()

    // 优先使用现代Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        return {
          success: true,
          platform,
          message: t('api.clipboard.复制成功2'),
        }
      } catch (error) {
        logger.warn('Modern Clipboard API failed, falling back to legacy method:', error)
        // 降级到传统方法
        return this.copyToWebLegacy(text)
      }
    } else {
      // 直接使用传统方法
      return this.copyToWebLegacy(text)
    }
  }

  /**
   * 传统的Web复制方法（降级方案）
   * @param text 要复制的文本
   * @returns 复制结果
   */
  private static copyToWebLegacy(text: string): ClipboardResult {
    const platform = getCurrentPlatform()

    // 创建临时文本区域
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.opacity = '0'
    textArea.style.left = '-9999px'
    textArea.style.top = '-9999px'

    document.body.appendChild(textArea)
    textArea.select()

    try {
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)

      if (success) {
        return {
          success: true,
          platform,
          message: t('api.clipboard.复制成功3'),
        }
      } else {
        return {
          success: false,
          platform,
          message: t('api.clipboard.复制失败4'),
        }
      }
    } catch (error) {
      document.body.removeChild(textArea)
      logger.error('Legacy copy method failed:', error)
      return {
        success: false,
        platform,
        message: error instanceof Error ? error.message : t('api.clipboard.复制失败5'),
      }
    }
  }

  /**
   * 从Web/H5/Electron平台剪贴板读取
   * @returns 读取的文本和结果
   */
  private static async pasteFromWeb(): Promise<{ text: string | null } & ClipboardResult> {
    const platform = getCurrentPlatform()

    // 优先使用现代Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        const text = await navigator.clipboard.readText()
        return {
          text,
          success: true,
          platform,
          message: t('api.clipboard.读取成功6'),
        }
      } catch (error) {
        logger.warn('Modern Clipboard API read failed:', error)
        return {
          text: null,
          success: false,
          platform,
          message: t('api.clipboard.读取失败7'),
        }
      }
    } else {
      return {
        text: null,
        success: false,
        platform,
        message: t('api.clipboard.剪贴板读取功能不8'),
      }
    }
  }

  /**
   * 复制到支付宝平台剪贴板
   * @param text 要复制的文本
   * @returns 复制结果
   */
  private static async copyToAlipay(text: string): Promise<ClipboardResult> {
    const platform = 'alipay'
    type AlipayMy = { setClipboard?: (opts: { text: string; success: () => void; fail: (error: unknown) => void }) => void; getClipboard?: (opts: { success: (res: { text: string }) => void; fail: (error: unknown) => void }) => void }
    const my = (window as Window & { my?: AlipayMy }).my

    if (!my) {
      return {
        success: false,
        platform,
        message: t('api.clipboard.支付宝SDK未初9'),
      }
    }

    if (!my.setClipboard) {
      return {
        success: false,
        platform,
        message: t('api.clipboard.支付宝剪贴板功能10'),
      }
    }

    const setClipboard = my.setClipboard
    return new Promise(resolve => {
      setClipboard({
        text,
        success: () => {
          // 支付宝会自动提示复制成功，不需要额外提示
          logger.info('Alipay clipboard copy successful')
          resolve({
            success: true,
            platform,
            message: t('api.clipboard.复制成功11'),
          })
        },
        fail: (error: unknown) => {
          logger.error('Alipay clipboard copy failed:', error)
          resolve({
            success: false,
            platform,
            message: error instanceof Error ? error.message : t('api.clipboard.复制失败12'),
          })
        },
      })
    })
  }

  /**
   * 从支付宝平台剪贴板读取
   * @returns 读取的文本和结果
   */
  private static async pasteFromAlipay(): Promise<{ text: string | null } & ClipboardResult> {
    const platform = 'alipay'
    type AlipayMy = { setClipboard?: (opts: { text: string; success: () => void; fail: (error: unknown) => void }) => void; getClipboard?: (opts: { success: (res: { text: string }) => void; fail: (error: unknown) => void }) => void }
    const my = (window as Window & { my?: AlipayMy }).my

    if (!my) {
      return {
        text: null,
        success: false,
        platform,
        message: t('api.clipboard.支付宝SDK未初13'),
      }
    }

    if (!my.getClipboard) {
      return {
        text: null,
        success: false,
        platform,
        message: t('api.clipboard.支付宝剪贴板读取14'),
      }
    }

    const getClipboard = my.getClipboard
    return new Promise(resolve => {
      getClipboard({
        success: (res: { text: string }) => {
          logger.info('Alipay clipboard read successful')
          resolve({
            text: res.text,
            success: true,
            platform,
            message: t('api.clipboard.读取成功15'),
          })
        },
        fail: (error: unknown) => {
          logger.error('Alipay clipboard read failed:', error)
          resolve({
            text: null,
            success: false,
            platform,
            message: error instanceof Error ? error.message : t('api.clipboard.读取失败16'),
          })
        },
      })
    })
  }
}

// 导出简化的剪贴板函数
export const copyToClipboard = ClipboardManager.copy
export const pasteFromClipboard = ClipboardManager.paste
