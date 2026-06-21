import { request as sharedRequest } from '@/composables/shared-logic'
import { API_BASE_URLS } from '@/config/apiConfig.js'

const baseUrlMap: Record<number, string> = {
  1: API_BASE_URLS.BASE_URL_1,
  2: API_BASE_URLS.BASE_URL_2,
  3: API_BASE_URLS.BASE_URL_3,
  4: API_BASE_URLS.BASE_URL_4,
  5: API_BASE_URLS.BASE_URL_5,
}

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'delete'
  data?: any
  header?: Record<string, string>
  timeout?: number
  base?: number
}

export async function request<T = any>(options: RequestOptions) {
  const { url, method = 'GET', data, header, timeout = 500000, base = 1 } = options
  const baseUrl = baseUrlMap[base] || baseUrlMap[1]
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`

  const storageData = uni.getStorageSync('data')
  const zhsTokenInfo = storageData?.thirdPartyAccounts

  const defaultHeaders: Record<string, string> = {
    'content-type': 'application/json',
  }

  if (zhsTokenInfo?.accessToken) {
    defaultHeaders['Authorization'] = `Bearer ${zhsTokenInfo.accessToken}`
  }

  const loginType = uni.getStorageSync('loginType') || 'android'
  defaultHeaders['platform-type'] = loginType

  return sharedRequest({
    url: fullUrl,
    method: method === 'delete' ? 'DELETE' : method,
    data,
    header: { ...defaultHeaders, ...header },
    timeout,
  })
}

export function get<T = any>(url: string, data?: any, base?: number) {
  return request<T>({ url, method: 'GET', data, base })
}

export function post<T = any>(url: string, data?: any, base?: number) {
  return request<T>({ url, method: 'POST', data, base })
}

export function put<T = any>(url: string, data?: any, base?: number) {
  return request<T>({ url, method: 'PUT', data, base })
}

export function del<T = any>(url: string, data?: any, base?: number) {
  return request<T>({ url, method: 'DELETE', data, base })
}
