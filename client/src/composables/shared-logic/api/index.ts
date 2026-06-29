import { isUniApp, getStorage, removeStorage } from '../utils/index'

const BASE_URL = 'https://api.example.com'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  header?: Record<string, string>
  timeout?: number
}

export interface ApiResponse<T = unknown> {
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

export async function request<T = unknown>(options: RequestOptions): Promise<ApiResponse<T>> {
  const { url, method = 'GET', data, header, timeout = 15000 } = options
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`
  const headers = buildHeaders(header)

  if (isUniApp()) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: fullUrl,
        method: method as unknown as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'HEAD' | 'TRACE' | 'CONNECT',
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
  removeStorage('token')
  removeStorage('userInfo')
  if (isUniApp()) {
    uni.reLaunch({ url: '/pages/login/index' })
  } else {
    // 改用登录弹窗, 避免整页刷新循环 (与 request.ts 统一策略)
    // 动态 import 避免循环依赖
    void import('@/composables/useLoginDialog')
      .then(({ useLoginDialog }) => {
        const loginDialog = useLoginDialog()
        const currentPath = window.location.pathname + window.location.search
        if (currentPath !== '/login' && !loginDialog.visible.value) {
          loginDialog.open('login', currentPath)
        }
      })
      .catch((e) => {
        // 弹窗失败兜底: 降级为硬跳转
        console.warn('[shared-logic] Failed to open login dialog:', e)
        window.location.href = '/login'
      })
  }
}

export function get<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  return request({ url, method: 'GET', data })
}

export function post<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  return request({ url, method: 'POST', data })
}

export function put<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  return request({ url, method: 'PUT', data })
}

export function del<T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> {
  return request({ url, method: 'DELETE', data })
}
