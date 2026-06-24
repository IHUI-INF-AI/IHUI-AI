/**
 * 统一的API客户端
 * 提供标准化的HTTP请求功能
 * 支持多个baseURL，兼容Ai-WXMiniVue项目
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { t } from '@/utils/i18n'
import { logger, TokenManager, ConfigManager, ErrorHandler } from '@/utils/core'
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
          const token = TokenManager.getToken()
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
   * 注意：若当前请求本身就是刷新 token 接口返回 401，说明 refreshToken 也已失效，
   * 直接清理并拒绝，避免再次调用 handleTokenExpired 形成递归死循环。
   */
  private async handleTokenExpired(response: AxiosResponse): Promise<AxiosResponse> {
    // 防止刷新接口自身 401 导致递归死循环
    if (response.config.url && response.config.url.includes(LOGIN_PWD_PATHS.refreshToken)) {
      TokenManager.clearTokens()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
      return Promise.reject(new Error('登录已过期，请重新登录'))
    }

    try {
      const refreshToken = TokenManager.getRefreshToken()
      if (refreshToken) {
        const refreshResponse = await this.post<{ accessToken: string; refreshToken: string }>(LOGIN_PWD_PATHS.refreshToken, {
          refreshToken,
          uuid: TokenManager.getUuid(),
        }, { silent: true })

        if (refreshResponse.success && refreshResponse.data) {
          TokenManager.setToken(refreshResponse.data.accessToken, refreshResponse.data.refreshToken)
          const originalConfig = response.config
          originalConfig.headers = originalConfig.headers || {}
            ; (originalConfig.headers as Record<string, string>).Authorization = `Bearer ${refreshResponse.data.accessToken}`
          if (originalConfig.url && !originalConfig.baseURL) {
            originalConfig.baseURL = getBaseUrl(originalConfig.url)
          }
          return this.instance.request(originalConfig)
        }
      }
    } catch (error) {
      logger.error('Token refresh failed:', error)
    }

    TokenManager.clearTokens()

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:expired'))
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
      // 透传 AbortSignal，支持请求取消
      signal: config.signal,
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
  async get<T>(url: string, params?: Record<string, unknown>, options?: { silent?: boolean; signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'GET',
      params,
      silent: options?.silent,
      signal: options?.signal,
    })
  }

  /**
   * POST请求
   */
  async post<T>(url: string, data?: unknown, options?: { silent?: boolean; headers?: Record<string, string>; signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      data,
      silent: options?.silent,
      headers: options?.headers,
      signal: options?.signal,
    })
  }

  /**
   * PUT请求
   */
  async put<T>(url: string, data?: unknown, options?: { silent?: boolean; signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      data,
      silent: options?.silent,
      signal: options?.signal,
    })
  }

  /**
   * DELETE请求
   */
  async delete<T>(url: string, options?: { silent?: boolean; params?: Record<string, unknown>; signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'DELETE',
      silent: options?.silent,
      params: options?.params,
      signal: options?.signal,
    })
  }

  /**
   * PATCH请求
   */
  async patch<T>(url: string, data?: unknown, options?: { silent?: boolean; signal?: AbortSignal }): Promise<ApiResponse<T>> {
    return this.request<T>({
      url,
      method: 'PATCH',
      data,
      silent: options?.silent,
      signal: options?.signal,
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
    TokenManager.setToken(token)
  }

  /**
   * 获取Token
   */
  getToken(): string | null {
    return TokenManager.getToken()
  }

  /**
   * 清除Token
   */
  clearToken(): void {
    TokenManager.clearTokens()
  }
}

// 创建默认的API客户端实例
export const apiClient = new ApiClient()
