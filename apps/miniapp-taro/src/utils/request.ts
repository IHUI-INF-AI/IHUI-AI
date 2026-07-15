/**
 * 请求封装 - 指向新架构后端
 * 新架构 API: http://localhost:3000/api
 */
import Taro from '@tarojs/taro'
import { getToken, clearAuth } from './auth'

/** 后端 API 基础地址 */
export const BASE_URL = 'http://localhost:3000/api'

/** 请求超时时间（毫秒） */
const TIMEOUT = 15000

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  data?: unknown
  header?: Record<string, string>
  /** 是否跳过自动 token 注入 */
  skipAuth?: boolean
}

export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

/** 统一请求函数 */
export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header = {}, skipAuth = false } = options

  if (!skipAuth) {
    const token = getToken()
    if (token) {
      header['Authorization'] = `Bearer ${token}`
    }
  }

  return new Promise<T>((resolve, reject) => {
    Taro.request({
      url: url.startsWith('http') ? url : `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header,
      },
      timeout: TIMEOUT,
      success: (res) => {
        const statusCode = res.statusCode
        const body = res.data as ApiResponse<T>

        if (statusCode === 401) {
          // token 失效，清理登录态并跳转登录
          clearAuth()
          Taro.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
          setTimeout(() => {
            Taro.reLaunch({ url: '/pages/login/login' })
          }, 800)
          reject(new Error('未授权'))
          return
        }

        if (statusCode < 200 || statusCode >= 300) {
          const msg = (body && body.msg) || `请求失败(${statusCode})`
          Taro.showToast({ title: msg, icon: 'none' })
          reject(new Error(msg))
          return
        }

        // 兼容后端统一返回 { code, msg, data } 结构
        if (body && typeof body.code === 'number') {
          if (body.code === 0 || body.code === 200) {
            resolve(body.data)
          } else {
            Taro.showToast({ title: body.msg || '请求失败', icon: 'none' })
            reject(new Error(body.msg || '请求失败'))
          }
          return
        }

        resolve(body as unknown as T)
      },
      fail: (err) => {
        Taro.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        reject(err)
      },
    })
  })
}

/** GET 请求 */
export const get = <T = unknown>(url: string, data?: unknown, header?: Record<string, string>) =>
  request<T>({ url, method: 'GET', data, header })

/** POST 请求 */
export const post = <T = unknown>(url: string, data?: unknown, header?: Record<string, string>) =>
  request<T>({ url, method: 'POST', data, header })

/** PUT 请求 */
export const put = <T = unknown>(url: string, data?: unknown, header?: Record<string, string>) =>
  request<T>({ url, method: 'PUT', data, header })

/** PATCH 请求 */
export const patch = <T = unknown>(url: string, data?: unknown, header?: Record<string, string>) =>
  request<T>({ url, method: 'PATCH', data, header })

/** DELETE 请求 */
export const del = <T = unknown>(url: string, data?: unknown, header?: Record<string, string>) =>
  request<T>({ url, method: 'DELETE', data, header })
