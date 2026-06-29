/**
 * 统一的API客户端
 * 提供标准化的HTTP请求功能
 * 支持多个baseURL，兼容Ai-WXMiniVue项目
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { t } from '@/utils/i18n'
import { logger, ConfigManager, ErrorHandler } from '@/utils/core'
import { TokenStorage } from '@/utils/storage'
import { retryPromise, withTimeout } from '@/utils/promise-utils'
import { getCurrentPlatform } from '@/router/utils/routeMerger'
import { COZE_PREFIX, LOGIN_PWD_PATHS } from '@/config/backend-paths'
import { API_WHITE_LIST } from '@/config/api-white-list'
import { isTokenExpired, isSuccess } from '@/config/error-codes'
import type { ApiResponse, ApiRequestConfig, ApiClientConfig, ApiError } from './types'

// 基础URL配置 (2026-06-20 全部迁移到 Python 后端, 无 Java 依赖)
// 生产环境通过 VITE_API_BASE_URL 环境变量配置, 默认相对路径走同源代理
const _prodBase = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL) || ''
const BASE_URLS = {
  BASE_URL_1: _prodBase,  // 原 kou.aizhs.top, 现走 Python 后端
  BASE_URL_2: _prodBase,  // 原 bsm.aizhs.top/prod-api/ai, 现走 Python 后端
  BASE_URL_3: _prodBase,  // 原 zca.aizhs.top, 现走 Python 后端
  BASE_URL_4: _prodBase,  // 原 bsm.aizhs.top/prod-api, 现走 Python 后端
  BASE_URL_5: _prodBase,  // 原 kou.aizhs.top, 现走 Python 后端
}

// 开发模式下所有请求走 Vite 代理 (相对路径), 不直连生产
const _isDev = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV
const _devBase = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL) || '/api'

// 根据URL选择合适的baseURL
function getBaseUrl(url: string): string {
  // 开发模式: 所有请求走 Vite 代理, 由 vite.config.ts 的 proxy 规则路由
  if (_isDev) {
    return _devBase
  }
  // 生产模式: 按路径前缀路由到不同后端
  if (url.startsWith('/remote/agent') || url.startsWith(`${COZE_PREFIX}/agent`)) {
    return BASE_URLS.BASE_URL_4
  }
  if (url.startsWith(`${COZE_PREFIX}/dashscope`) || url.startsWith(`${COZE_PREFIX}/hunyuan`) ||
      url.startsWith(`${COZE_PREFIX}/luyala`) || url.startsWith(`${COZE_PREFIX}/doubao`) ||
      url.startsWith(`${COZE_PREFIX}/search`)) {
    return BASE_URLS.BASE_URL_2
  }
  if (url.startsWith('/kling/')) {
    return BASE_URLS.BASE_URL_3
  }
  if (url.startsWith('/ali/')) {
    return BASE_URLS.BASE_URL_3
  }
  if (url.startsWith('/jianyi/')) {
    return BASE_URLS.BASE_URL_3
  }
  return BASE_URLS.BASE_URL_1
}

export class ApiClient {
  private instance: AxiosInstance
  private config: ApiClientConfig
  // 2026-06-28 联调修复: 并发 401 刷新去重, 避免多次 refresh 触发后端重放检测
  // (后端 rotate_refresh 对同 jti 二次使用判定为重放攻击, 会拉黑整个 family)
  private static isRefreshing = false
  private static failedQueue: Array<{
    resolve: (value: AxiosResponse) => void
    reject: (reason: unknown) => void
    config: AxiosRequestConfig
  }> = []

  constructor(config?: Partial<ApiClientConfig>) {
    this.config = {
      baseURL: ConfigManager.getApiConfig().baseURL,
      timeout: 60000, // 统一为60秒超时，适配大多数API场景
      retryCount: ConfigManager.getApiConfig().retryCount,
      ...config,
    }

    this.instance = this.createInstance()
    this.setupInterceptors()
  }

  /**
   * 创建axios实例
   */
  private createInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'platform-type': 'web',
        ...this.config.headers,
      },
    })
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.instance.interceptors.request.use(
      config => {
        // 检查是否在白名单中
        const isWhitelisted = API_WHITE_LIST.some(whiteUrl => config.url?.includes(whiteUrl))
        
        // 如果不在白名单中，添加认证token
        if (!isWhitelisted) {
          const token = TokenStorage.getToken()
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }

        // 添加平台类型头部
        const platform = getCurrentPlatform()
        config.headers['platform-type'] = platform

        // 根据URL选择合适的baseURL
        if (config.url) {
          config.baseURL = getBaseUrl(config.url)
        }

        logger.debug('API request:', {
          url: config.url,
          method: config.method,
          params: config.params,
          data: config.data,
          baseURL: config.baseURL,
        })

        return config
      },
      error => {
        logger.error('Request interceptor error:', error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      response => {
        logger.debug('API response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        })

        // 检查业务状态码
        const data = response.data as { code?: number; message?: string; data?: unknown }
        if (data.code !== undefined && !isSuccess(data.code)) {
          // 处理业务错误
          if (isTokenExpired(data.code)) {
            // Token过期，触发刷新
            return this.handleTokenExpired(response)
          }
          
          // 其他业务错误
          const error = new Error(data.message || '请求失败')
          logger.error('[API] Business error', {
            code: data.code,
            message: data.message,
            url: response.config.url,
          })
          return Promise.reject(error)
        }

        return response
      },
      async error => {
        logger.error('Response interceptor error:', error)

        // 处理401未授权错误：复用token刷新逻辑
        if (error.response?.status === 401 && error.response.config) {
          return this.handleTokenExpired(error.response)
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * 统一处理token过期：刷新token并重试原始请求
   *
   * 2026-06-28 联调修复: 加入 isRefreshing 锁 + failedQueue 等待队列,
   * 并发 401 时只发一次 refresh 请求, 避免后端 rotate_refresh 把同 jti
   * 二次使用判定为重放攻击而拉黑整个 family.
   */
  private async handleTokenExpired(response: AxiosResponse): Promise<AxiosResponse> {
    const originalConfig = response.config

    // 已有刷新在进行: 挂起当前请求, 等待刷新结果
    if (ApiClient.isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        ApiClient.failedQueue.push({ resolve, reject, config: originalConfig })
      })
    }

    ApiClient.isRefreshing = true
    let refreshSucceeded = false
    try {
      const refreshToken = TokenStorage.getRefreshToken()
      if (refreshToken) {
        const refreshResponse = await this.post<{ accessToken: string; refreshToken: string }>(LOGIN_PWD_PATHS.refreshToken, {
          refreshToken,
          uuid: TokenStorage.getItem<string>('uuid') || '',
        }, { silent: true })

        if (refreshResponse.success && refreshResponse.data) {
          const newAccessToken = refreshResponse.data.accessToken
          TokenStorage.setToken(newAccessToken)
          if (refreshResponse.data.refreshToken) {
            TokenStorage.setRefreshToken(refreshResponse.data.refreshToken)
          }
          // 重试原请求
          originalConfig.headers = originalConfig.headers || {}
            ; (originalConfig.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`
          if (originalConfig.url && !originalConfig.baseURL) {
            originalConfig.baseURL = getBaseUrl(originalConfig.url)
          }
          const retried = await this.instance.request(originalConfig)
          // 刷新成功: 释放等待队列, 用新 token 重试
          refreshSucceeded = true
          ApiClient.failedQueue.forEach(item => {
            const cfg = item.config
            cfg.headers = cfg.headers || {}
            ; (cfg.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`
            this.instance.request(cfg).then(item.resolve).catch(item.reject)
          })
          ApiClient.failedQueue = []
          return retried
        }
      }
    } catch (error) {
      logger.error('Token refresh failed:', error)
    } finally {
      ApiClient.isRefreshing = false
    }

    // 刷新失败: 清 auth + 释放等待队列(reject) + 派发 auth:expired
    if (!refreshSucceeded) {
      TokenStorage.clearAuth()
      ApiClient.failedQueue.forEach(item => item.reject(new Error('登录已过期，请重新登录')))
      ApiClient.failedQueue = []

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
    }

    return Promise.reject(new Error('登录已过期，请重新登录'))
  }

  /**
   * 通用请求方法
   */
  private async request<T>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
    const requestConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      params: config.params,
      data: config.data,
      headers: config.headers,
      timeout: config.timeout || this.config.timeout,
    }

    try {
      // 使用重试机制和超时控制
      const timeoutMs = requestConfig.timeout || this.config.timeout || 30000
      const retries = config.retryCount ?? this.config.retryCount ?? 0
      const response = await retryPromise(
        () =>
          withTimeout(
            this.instance.request<ApiResponse<T>>(requestConfig),
            timeoutMs
          ),
        retries
      )

      return this.normalizeResponse(response)
    } catch (error) {
      const apiError = this.createApiError(error as { response?: { status?: number; data?: { message?: string } }; message?: string; request?: unknown })

      if (!config.silent) {
        ErrorHandler.handleAndShow(apiError)
      }

      throw apiError
    }
  }

  /**
   * 标准化响应数据
   */
  private normalizeResponse<T>(response: AxiosResponse<unknown>): ApiResponse<T> {
    const data = response.data

    // 如果响应已经是标准格式
    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      const standardData = data as { code: unknown; message: unknown; data?: unknown; success?: boolean; timestamp?: unknown }
      return {
        code: typeof standardData.code === 'number' ? standardData.code : response.status,
        message: typeof standardData.message === 'string' ? standardData.message : 'success',
        data: standardData.data as T | undefined,
        success: standardData.success ?? isSuccess(typeof standardData.code === 'number' ? standardData.code : response.status),
        timestamp: typeof standardData.timestamp === 'number' ? standardData.timestamp : Date.now(),
      }
    }

    // 标准化非标准响应
    return {
      code: response.status,
      message: 'success',
      data: data as T | undefined,
      success: response.status >= 200 && response.status < 300,
      timestamp: Date.now(),
    }
  }

  /**
   * 创建API错误
   */
  private createApiError(error: { response?: { status?: number; data?: { message?: string } }; message?: string; request?: unknown }): ApiError {
    if (error.response) {
      // 服务器响应错误
      return {
        code: error.response.status ?? 'UNKNOWN_ERROR',
        message: error.response.data?.message || error.message || '未知错误',
        details: error.response.data,
        type: 'business',
      }
    } else if (error.request) {
      // 网络错误
      return {
        code: 'NETWORK_ERROR',
        message: t('api.client.网络连接失败'),
        details: error,
        type: 'network',
      }
    } else if (error.message?.includes('timeout')) {
      // 超时错误
      return {
        code: 'TIMEOUT',
        message: t('api.client.请求超时1'),
        details: error,
        type: 'timeout',
      }
    } else {
      // 其他错误
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message || '未知错误',
        details: error,
        type: 'system',
      }
    }
  }

  /**
   * GET请求
   */
  async get<T>(url: string, params?: Record<string, unknown>, options?: { silent?: boolean }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'GET',
      params,
      silent: options?.silent,
    })
  }

  /**
   * POST请求
   */
  async post<T>(url: string, data?: unknown, options?: { silent?: boolean; headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      data,
      silent: options?.silent,
      headers: options?.headers,
    })
  }

  /**
   * PUT请求
   */
  async put<T>(url: string, data?: unknown, options?: { silent?: boolean }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      data,
      silent: options?.silent,
    })
  }

  /**
   * DELETE请求
   */
  async delete<T>(url: string, options?: { silent?: boolean; params?: Record<string, unknown> }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'DELETE',
      silent: options?.silent,
      params: options?.params,
    })
  }

  /**
   * PATCH请求
   */
  async patch<T>(url: string, data?: unknown, options?: { silent?: boolean }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PATCH',
      data,
      silent: options?.silent,
    })
  }

  /**
   * 分页GET请求
   */
  async getPaginated<T>(url: string, params?: { page?: number; pageSize?: number; [key: string]: unknown } | undefined, options?: { silent?: boolean }): Promise<ApiResponse<{
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>> {
    return this.request<{
      items: T[]
      total: number
      page: number
      pageSize: number
      totalPages: number
    }>({
      url,
      method: 'GET',
      params: {
        page: params?.page || 1,
        pageSize: params?.pageSize || 20,
        ...params,
      },
      silent: options?.silent,
    })
  }

  /**
   * 设置Token
   */
  setToken(token: string, _remember?: boolean): void {
    TokenStorage.setToken(token)
  }

  /**
   * 获取Token
   */
  getToken(): string | null {
    return TokenStorage.getToken()
  }

  /**
   * 清除Token
   */
  clearToken(): void {
    TokenStorage.clearAuth()
  }
}

// 创建默认的API客户端实例
export const apiClient = new ApiClient()
