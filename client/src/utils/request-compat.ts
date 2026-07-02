/**
 * 兼容的请求工具
 * 兼容源项目的 request 函数签名，内部使用 axios
 * 用于平滑迁移源项目的 service 文件
 */

import requestService from './request'
import type { AxiosRequestConfig } from 'axios'

export interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'delete'
  data?: unknown
  header?: Record<string, string>
  headers?: Record<string, string>
  timeout?: number
  base?: number // 1=BASE_URL_1, 2=BASE_URL_2, 3=BASE_URL_3, 4=BASE_URL_4, 0=空（特殊API）
}

/**
 * 兼容源项目的 request 函数
 * 将 uni.request 风格的调用转换为 axios 调用
 */
export default function compatRequest<T = unknown>(options: RequestOptions): Promise<T> {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    headers = {},
    timeout = 20 * 60 * 1000, // 默认 20 分钟，与 request.ts 一致
    base = 1,
  } = options

  // 合并 header 和 headers
  const mergedHeaders = { ...header, ...headers }

  // 处理 DELETE 方法（源项目可能使用小写）
  const normalizedMethod = method.toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

  // 构建 axios 配置
  const config: AxiosRequestConfig = {
    url,
    method: normalizedMethod,
    timeout,
    base, // 使用 base 参数来选择 baseURL（request.ts 的拦截器会处理）
    headers: mergedHeaders,
  }

  // 处理请求数据
  if (normalizedMethod === 'GET') {
    config.params = data
  } else {
    config.data = data
  }

  // 调用 axios request（使用 request.ts 中已经配置好的 service）
  return requestService(config)
    .then((response: unknown) => {
      // 兼容源项目的响应格式
      // 源项目期望返回 { code, data, message } 格式
      // axios 返回的是 AxiosResponse，提取 data
      if (response && typeof response === 'object' && 'data' in response) {
        return (response as { data: T }).data as T
      }
      return response as T
    })
    .catch((error: unknown) => {
      // 错误处理：如果响应中有 data，返回 data，否则抛出错误
      const axiosError = error as { response?: { data?: unknown } }
      if (axiosError?.response?.data) {
        // 返回错误响应数据，让调用方可以处理
        return Promise.reject(axiosError.response.data)
      }
      throw error
    })
}
