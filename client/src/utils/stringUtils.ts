import { logger } from '@/utils/logger'

// 安全的字符串分割函数
export const safeSplit = (str: any, separator: string | RegExp, limit?: number): string[] => {
  // 确保str是字符串
  if (typeof str !== 'string') {
    logger.error('String expected for safeSplit, got:', typeof str, str)
    return []
  }

  // 确保separator是有效的
  if (typeof separator !== 'string' && !(separator instanceof RegExp)) {
    logger.error('Invalid separator for safeSplit:', separator)
    return []
  }

  try {
    return str.split(separator, limit)
  } catch (error) {
    logger.error('Error in safeSplit:', error)
    return []
  }
}

// 安全的获取字符串属性函数
export const safeGetProperty = (obj: any, path: string | string[]): any => {
  try {
    if (!obj || typeof obj !== 'object') {
      return null
    }

    const keys = Array.isArray(path) ? path : safeSplit(path, '.')
    let value = obj

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (value && typeof value === 'object' && key in value) {
        const nextValue = (value as Record<string, unknown>)[key]
        // 如果不是最后一个键，检查下一个值是否为对象
        if (i < keys.length - 1) {
          if (nextValue !== null && typeof nextValue === 'object') {
            value = nextValue
          } else {
            // 中间值不是对象，路径不存在
            return null
          }
        } else {
          // 最后一个键，直接返回值
          return nextValue
        }
      } else {
        return null
      }
    }

    return value
  } catch (error) {
    logger.error('Error in safeGetProperty:', error)
    return null
  }
}

// 安全的获取字符串属性并返回字符串值函数
export const safeGetStringProperty = (obj: any, path: string | string[]): string => {
  const value = safeGetProperty(obj, path)
  return typeof value === 'string' ? value : String(value || '')
}

// 替换国际化文本中的 @ 符号占位符
// vue-i18n 会将 @ 符号解析为 linked message，所以需要用 {'@'} 转义
// 此函数将转义后的 {'@'} 替换回 @ 符号
export const replaceAtSymbol = (value: any): string => {
  if (typeof value !== 'string') {
    return String(value || '')
  }
  return value.replace(/{'@'}/g, '@')
}
