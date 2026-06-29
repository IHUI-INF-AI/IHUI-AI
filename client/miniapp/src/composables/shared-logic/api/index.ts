import { isUniApp, getStorage } from '../utils/index'

const BASE_URL = 'https://api.example.com'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  timeout?: number
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

function getToken(): string {
  const raw = getStorage('token')
  return typeof raw === 'string' ? raw : ''
}

function buildHeaders(custom?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return { ...headers, ...custom }
}

export async function request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header, timeout = 15000 } = options
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
  const headers = buildHeaders(header)

  if (isUniApp()) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: fullUrl,
        method: method as any,
        data,
        header: headers,
        timeout,
        success: (res: { data: unknown }) => {
          const result = res.data as ApiResponse<T>
          if (result.code === 0 || result.code === 200) {
            resolve(result)
          } else if (result.code === 401) {
            handleUnauthorized()
            reject(new Error('Unauthorized'))
          } else {
            reject(new Error(result.message || 'Request failed'))
          }
        },
        fail: (err: unknown) => {
          const errMsg = typeof err === 'object' && err !== null && 'errMsg' in err ? (err as { errMsg?: string }).errMsg : 'Network error'
          reject(new Error(errMsg))
        },
      })
    })
  }

  const response = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    signal: AbortSignal.timeout(timeout),
  })

  if (response.status === 401) {
    handleUnauthorized()
    throw new Error('Unauthorized')
  }

  const result: ApiResponse<T> = await response.json()
  if (result.code !== 0 && result.code !== 200) {
    throw new Error(result.message || 'Request failed')
  }
  return result
}

function handleUnauthorized() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { removeStorage } = require('../utils/index')
  removeStorage('token')
  removeStorage('userInfo')
  if (isUniApp()) {
    void uni.reLaunch({ url: '/pages/login/index' })
  } else {
    window.location.href = '/login'
  }
}

export function get<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  return request({ url, method: 'GET', data })
}

export function post<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  return request({ url, method: 'POST', data })
}

export function put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  return request({ url, method: 'PUT', data })
}

export function del<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
  return request({ url, method: 'DELETE', data })
}
