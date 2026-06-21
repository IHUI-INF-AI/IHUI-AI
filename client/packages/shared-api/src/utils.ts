import { API_BASE_URLS } from './base-urls'
import { API_WHITE_LIST } from './constants'
import { ERROR_CODES } from './constants'

/** 开发环境 Coze 代理前缀（官网 Vite proxy） */
export const COZE_DEV_PROXY_PREFIX = '/cozeZhsApi'

/**
 * 根据 base 编号获取基础 URL
 * @param base - 1~5
 * @param isDevelopment - 是否开发环境（官网走代理）
 */
export function getBaseUrl(base: number = 1, isDevelopment: boolean = false): string {
  switch (base) {
    case 1:
      return API_BASE_URLS.BASE_URL_1
    case 2:
      return isDevelopment ? '/prod-api/ai' : API_BASE_URLS.BASE_URL_2
    case 3:
      return isDevelopment ? COZE_DEV_PROXY_PREFIX : API_BASE_URLS.BASE_URL_3
    case 4:
      return isDevelopment ? '/prod-api' : API_BASE_URLS.BASE_URL_4
    case 5:
      return API_BASE_URLS.BASE_URL_5
    default:
      return API_BASE_URLS.BASE_URL_1
  }
}

export function isWhiteListUrl(url: string): boolean {
  return API_WHITE_LIST.some(whiteUrl => {
    return url === whiteUrl || url.startsWith(`${whiteUrl}/`) || url.startsWith(`${whiteUrl}?`)
  })
}

export function isTokenExpiredError(code: number): boolean {
  return (ERROR_CODES.TOKEN_EXPIRED as readonly number[]).includes(code)
}

export function isSuccessCode(code: number): boolean {
  return (ERROR_CODES.SUCCESS as readonly number[]).includes(code)
}
