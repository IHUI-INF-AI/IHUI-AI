import { t } from '@/utils/i18n'

import type { ApiResponse } from '@/types/api'
export type { ApiResponse }

/**
 * 统一API响应处理工具
 * 确保所有API调用都使用一致的响应格式处理
 */

/**
 * 标准化API响应格式
 * @param response 原始响应数据
 * @returns 标准化后的响应数据
 */
export function normalizeApiResponse<T = unknown>(response: unknown): ApiResponse<T> {
  // 处理带有msg字段的格式
  if (
    response &&
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    'msg' in response
  ) {
    const resp = response as { code?: number; msg?: string; data?: T; timestamp?: number }
    // ⚠️ 重要：如果 code 是 401，说明需要 token，不应该返回 success
    const code = resp.code ?? 200
    // 兼容部分接口使用 code=10000 表示成功；同时仍需排除 401
    const isSuccess = (code === 200 || code === 0 || code === 10000) && (code as number) !== 401
    return {
      code: code,
      message: resp.msg || '',
      data: resp.data as T,
      success: isSuccess,
      timestamp: resp.timestamp || Date.now(),
    }
  }

  // 如果已经是标准格式，直接返回（保留原有的success值）
  if (
    response &&
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    'message' in response &&
    'data' in response &&
    'success' in response
  ) {
    const resp = response as ApiResponse<T>
    return resp
  }

  // 如果已经是标准格式但没有success字段，计算success
  if (
    response &&
    typeof response === 'object' &&
    response !== null &&
    'code' in response &&
    'message' in response &&
    'data' in response
  ) {
    const resp = response as { code?: number; message?: string; data?: T; timestamp?: number }
    return {
      code: resp.code ?? 200,
      message: resp.message || '',
      data: resp.data as T,
      success: resp.code === 200 || resp.code === 0 || resp.code === 10000,
      timestamp: resp.timestamp || Date.now(),
    }
  }

  // 处理直接返回数据的情况
  if (response && typeof response === 'object' && !('code' in response)) {
    return {
      code: 200,
      message: 'success',
      data: response as T,
      success: true,
      timestamp: Date.now(),
    }
  }

  // 处理其他格式
  return {
    code: 200,
    message: 'success',
    data: response as T,
    success: true,
    timestamp: Date.now(),
  }
}

/**
 * 检查API响应是否成功
 * @param response API响应数据
 * @returns 是否成功
 */
export function isApiSuccess(response: unknown): boolean {
  if (!response) return false

  // 检查标准格式
  if (typeof response === 'object' && 'code' in response) {
    return response.code === 200 || response.code === 0
  }

  // 检查HTTP状态码
  if (typeof response === 'object' && response !== null && 'status' in response) {
    const status = (response as { status?: number }).status
    return typeof status === 'number' && status >= 200 && status < 300
  }

  return true // 默认认为成功
}

/**
 * 提取API响应中的数据
 * @param response API响应数据
 * @returns 提取的数据
 */
export function extractApiData<T = unknown>(response: unknown): T {
  if (!response) return null as T

  // 标准格式
  if (typeof response === 'object' && response !== null && 'data' in response) {
    return (response as { data: T }).data
  }

  // 直接返回数据
  return response as T
}

/**
 * 提取API响应中的错误信息
 * @param response API响应数据
 * @returns 错误信息
 */
export function extractApiError(response: unknown): string {
  if (!response) return t('text.api_response_handler.未知错误')

  // 处理 axios 错误对象
  if (typeof response === 'object' && response !== null && 'response' in response) {
    const axiosError = response as { response?: { data?: unknown } }
    if (axiosError.response?.data) {
      const errorData = axiosError.response.data
      if (typeof errorData === 'object' && errorData !== null) {
        const errorObj = errorData as { message?: string; msg?: string; error?: string }
        if (errorObj.message) return errorObj.message
        if (errorObj.msg) return errorObj.msg
        if (errorObj.error) return errorObj.error
      }
      if (typeof errorData === 'string') {
        return errorData
      }
    }
  }

  // 标准格式
  if (typeof response === 'object' && response !== null) {
    const resp = response as { message?: string; msg?: string; error?: string }
    return resp.message || resp.msg || resp.error || '请求失败'
  }

  // 如果是 Error 对象
  if (response instanceof Error) {
    return response.message
  }

  return String(response)
}

/**
 * 处理分页响应数据
 * @param response 分页响应数据
 * @returns 标准化的分页数据
 */
export function normalizePaginationResponse<T = unknown>(
  response: unknown
): {
  list: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
} {
  const data = extractApiData(response)

  // 如果已经是标准分页格式
  if (data && typeof data === 'object' && data !== null && 'list' in data && 'pagination' in data) {
    return data as {
      list: T[]
      pagination: {
        page: number
        pageSize: number
        total: number
        totalPages: number
      }
    }
  }

  // 如果是数组格式
  if (Array.isArray(data)) {
    const dataLength = data.length
    return {
      list: data,
      pagination: {
        page: 1,
        pageSize: dataLength || 10, // 防止空数组时pageSize为0
        total: dataLength,
        totalPages: dataLength > 0 ? 1 : 0,
      },
    }
  }

  // 其他格式尝试解析
  if (data && typeof data === 'object' && data !== null) {
    const dataObj = data as Record<string, unknown>
    const list = (
      Array.isArray(dataObj.list)
        ? dataObj.list
        : Array.isArray(dataObj.items)
          ? dataObj.items
          : Array.isArray(dataObj.records)
            ? dataObj.records
            : []
    ) as T[]
    const total =
      typeof dataObj.total === 'number'
        ? dataObj.total
        : typeof dataObj.totalCount === 'number'
          ? dataObj.totalCount
          : typeof dataObj.count === 'number'
            ? dataObj.count
            : list.length
    const page =
      typeof dataObj.page === 'number'
        ? dataObj.page
        : typeof dataObj.current === 'number'
          ? dataObj.current
          : typeof dataObj.pageNum === 'number'
            ? dataObj.pageNum
            : 1
    const pageSize =
      typeof dataObj.pageSize === 'number'
        ? dataObj.pageSize
        : typeof dataObj.size === 'number'
          ? dataObj.size
          : typeof dataObj.limit === 'number'
            ? dataObj.limit
            : 10

    const safePageSize = Number(pageSize) || 10 // 防止除零错误
    const safeTotal = Number(total) || 0
    return {
      list: Array.isArray(list) ? list : [],
      pagination: {
        page: Number(page) || 1,
        pageSize: safePageSize,
        total: safeTotal,
        totalPages: safePageSize > 0 ? Math.ceil(safeTotal / safePageSize) : 0,
      },
    }
  }

  return {
    list: [],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 0,
    },
  }
}

/**
 * 创建标准错误响应
 * @param code 错误码
 * @param message 错误信息
 * @returns 标准错误响应
 */
export function createErrorResponse<T = null>(
  code: number = 500,
  message: string = '请求失败'
): ApiResponse<T> {
  return {
    code,
    message,
    data: null as T,
    success: false,
    timestamp: Date.now(),
  }
}

/**
 * 统一的API响应处理装饰器
 * 自动处理错误、格式化响应并提供重试机制
 * @param fn 原始API调用函数
 * @param options 配置选项
 * @returns 包装后的API调用函数
 */
export function withApiResponseHandler<
  TArgs extends unknown[],
  TReturn extends Promise<ApiResponse<unknown>>
>(
  fn: (...args: TArgs) => TReturn,
  options: { retryTimes?: number; retryDelay?: number; silent?: boolean } = {}
): (...args: TArgs) => TReturn {
  const { retryTimes = 1, retryDelay = 1000, silent = false } = options

  return (async function (...args: TArgs): Promise<ApiResponse<unknown>> {
    let lastError: unknown = new Error('未知错误')

    for (let attempt = 0; attempt <= retryTimes; attempt++) {
      try {
        // 尝试调用原始函数
        const result = await fn(...args)

        // 标准化响应
        return normalizeApiResponse(result)
      } catch (error) {
        lastError = error

        // 如果不是最后一次尝试，则等待并重试
        if (attempt < retryTimes) {
          // 指数退避策略，确保延迟不为负数
          const delay = Math.max(0, retryDelay * Math.pow(2, attempt))
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // 最后一次尝试失败，创建错误响应
        if (!silent) {
          import('@/utils/logger')
            .then(({ logger }) => {
              logger.error(
                `API调用失败: ${String(error)}`,
                error instanceof Error ? error : new Error(String(error))
              )
            })
            .catch(() => {
              // 日志系统未加载，静默处理
            })
        }

        const errorObj = error as { response?: { status?: number } }
        const errorResponse = createErrorResponse(
          errorObj?.response?.status || 500,
          extractApiError(error)
        )
        // createErrorResponse 已经返回标准格式，不需要再次标准化
        return errorResponse
      }
    }

    // 理论上不会走到这里，但为了TypeScript类型安全
    // 确保lastError不为undefined
    if (!lastError) {
      lastError = new Error('请求失败：未知错误')
    }
    return createErrorResponse(500, extractApiError(lastError)) as Awaited<TReturn>
  } as (...args: TArgs) => TReturn)
}

/**
 * 处理多个并发API请求
 * @param requests API请求数组
 * @returns 所有请求的结果数组
 */
export async function handleConcurrentRequests<T>(
  requests: Array<() => Promise<ApiResponse<T>>>
): Promise<(ApiResponse<T> | ApiResponse<null>)[]> {
  return Promise.all(
    requests.map(request =>
      request().catch(error => createErrorResponse(500, extractApiError(error)))
    )
  )
}

/**
 * API数据缓存工具
 */
export class ApiCache {
  private cache: Map<string, { value: unknown; timestamp: number }> = new Map()
  private defaultTtl: number

  constructor(defaultTtl: number = 60000) {
    this.defaultTtl = defaultTtl
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存数据或undefined
   */
  get<T>(key: string): T | undefined {
    const cached = this.cache.get(key)
    if (!cached) return undefined

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.defaultTtl) {
      this.delete(key)
      return undefined
    }

    return cached.value as T
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param value 缓存值
   * @param _ttl 过期时间（毫秒）
   */
  set<T>(key: string, value: T, _ttl?: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  /**
   * 删除缓存数据
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * 检查缓存是否存在且未过期
   * @param key 缓存键
   * @returns 是否有效
   */
  hasValid(key: string): boolean {
    return this.get(key) !== undefined
  }
}

/**
 * 创建带缓存的API调用
 * @param fn 原始API函数
 * @param cache 缓存实例
 * @param keyGenerator 缓存键生成器
 * @returns 带缓存的API函数
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  cache: ApiCache,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cachedFn = async function (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    // 生成缓存键，如果fn.name为空，使用函数体的hash或默认值
    const fnName = fn.name || 'anonymous'
    const key = keyGenerator ? keyGenerator(...args) : `${fnName}:${JSON.stringify(args)}`

    // 检查缓存
    const cached = cache.get<Awaited<ReturnType<T>>>(key)
    if (cached) {
      return cached as Awaited<ReturnType<T>>
    }

    // 调用原始函数
    const result = await fn(...args)

    // 如果成功，缓存结果
    if (result && typeof result === 'object' && 'success' in result && result.success) {
      cache.set(key, result)
    }

    return result as Awaited<ReturnType<T>>
  }
  // 确保返回的函数具有正确的类型和属性
  return cachedFn as T
}

/**
 * 防抖API调用
 * @param fn 原始API函数
 * @param delay 延迟时间（毫秒）
 * @returns 防抖后的API函数
 */
export function debounceApi<T, R>(
  fn: (...args: T[]) => Promise<ApiResponse<R>>,
  delay: number = 300
): (...args: T[]) => Promise<ApiResponse<R>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastPromise: Promise<ApiResponse<R>> | null = null

  return function (...args: T[]): Promise<ApiResponse<R>> {
    // 清除之前的定时器
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    // 创建新的Promise
    lastPromise = new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args)
          resolve(result)
        } catch (error) {
          reject(error)
        }
      }, delay)
    })

    return lastPromise
  }
}

/**
 * 节流API调用
 * @param fn 原始API函数
 * @param interval 时间间隔（毫秒）
 * @returns 节流后的API函数
 */
export function throttleApi<T, R>(
  fn: (...args: T[]) => Promise<ApiResponse<R>>,
  interval: number = 500
): (...args: T[]) => Promise<ApiResponse<R>> {
  let lastCallTime = 0
  let lastPromise: Promise<ApiResponse<R>> | null = null

  return function (...args: T[]): Promise<ApiResponse<R>> {
    const now = Date.now()

    // 如果距离上次调用的时间小于间隔，返回上次的Promise
    if (now - lastCallTime < interval && lastPromise) {
      return lastPromise
    }

    // 更新最后调用时间
    lastCallTime = now

    // 调用原始函数
    lastPromise = fn(...args)

    return lastPromise
  }
}

/**
 * API调用批量处理工具
 * 将多个小型API调用合并为一个批量调用
 */
export class ApiBatcher<T, R> {
  private batchSize: number
  private delay: number
  private items: T[] = []
  private callbacks: Array<(results: R[], error?: Error) => void> = []
  private timeout: ReturnType<typeof setTimeout> | null = null
  private processBatchFn: (items: T[]) => Promise<R[]>

  constructor(
    processBatchFn: (items: T[]) => Promise<R[]>,
    options: { batchSize?: number; delay?: number } = {}
  ) {
    this.processBatchFn = processBatchFn
    this.batchSize = options.batchSize || 10
    this.delay = options.delay || 100
  }

  /**
   * 添加项目到批次中
   * @param item 要处理的项目
   * @returns Promise解析为处理结果
   */
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      // 添加项目和回调
      const currentIndex = this.items.length
      this.items.push(item)
      this.callbacks.push((results, error) => {
        // 如果有错误，直接reject
        if (error) {
          reject(error)
          return
        }
        // 使用保存的索引，因为this.items可能在processBatch中被清空
        if (currentIndex < results.length) {
          resolve(results[currentIndex])
        } else {
          // 如果结果数组长度不足，返回错误而不是让Promise永远pending
          reject(
            new Error(
              `批量处理结果索引越界: 期望索引 ${currentIndex}, 但结果数组长度为 ${results.length}`
            )
          )
        }
      })

      // 如果达到批次大小，立即处理
      if (this.items.length >= this.batchSize) {
        // 不等待processBatch完成，让它异步执行
        this.processBatch().catch(() => {
          // 错误已经在processBatch中处理
        })
      } else if (!this.timeout) {
        // 否则设置延迟处理
        this.timeout = setTimeout(() => {
          this.processBatch().catch(() => {
            // 错误已经在processBatch中处理
          })
        }, this.delay)
      }
    })
  }

  /**
   * 处理当前批次
   */
  private async processBatch(): Promise<void> {
    // 清除超时
    if (this.timeout) {
      clearTimeout(this.timeout)
      this.timeout = null
    }

    // 保存当前批次的数据
    const items = [...this.items]
    const callbacks = [...this.callbacks]

    // 清空批次
    this.items = []
    this.callbacks = []

    try {
      // 处理批次
      const results = await this.processBatchFn(items)

      // 确保结果数组长度与items数组长度一致
      if (results.length !== items.length) {
        throw new Error(
          `批量处理结果数量不匹配: 期望 ${items.length} 个结果，但得到 ${results.length} 个`
        )
      }

      // 调用所有回调，传递成功的结果
      callbacks.forEach((callback, index) => {
        try {
          callback(results, undefined)
        } catch (callbackError) {
          // 如果回调执行失败，记录错误但不影响其他回调
          import('@/utils/logger')
            .then(({ logger }) => {
              logger.error(`Batch processing callback failed (index ${index})`, callbackError)
            })
            .catch(() => {
              // 日志系统未加载，静默处理
            })
        }
      })
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      import('@/utils/logger')
        .then(({ logger }) => {
          logger.error('Batch processing failed', errorObj)
        })
        .catch(() => {
          // 日志系统未加载，静默处理
        })
      // 对每个项目传递错误，让Promise reject
      callbacks.forEach(callback => {
        try {
          callback([], errorObj)
        } catch {
          // 如果callback执行失败，错误已经在Promise的reject中处理
        }
      })
    }
  }
}

/**
 * API请求重试策略
 */
export enum RetryStrategy {
  FIXED = 'fixed', // 固定间隔
  EXPONENTIAL = 'exponential', // 指数退避
  LINEAR = 'linear', // 线性增长
}

/**
 * 创建带重试逻辑的API调用
 * @param fn 原始API函数
 * @param options 重试选项
 * @returns 带重试逻辑的API函数
 */
export function withRetry<T, R>(
  fn: (...args: T[]) => Promise<ApiResponse<R>>,
  options: {
    retryTimes?: number
    initialDelay?: number
    strategy?: RetryStrategy
    shouldRetry?: (error: unknown) => boolean
  } = {}
): (...args: T[]) => Promise<ApiResponse<R>> {
  const {
    retryTimes = 3,
    initialDelay = 1000,
    strategy = RetryStrategy.EXPONENTIAL,
    shouldRetry = () => true,
  } = options

  return async function (...args: T[]): Promise<ApiResponse<R>> {
    let lastError: unknown = new Error('未知错误')

    for (let attempt = 0; attempt <= retryTimes; attempt++) {
      try {
        const result = await fn(...args)
        // 确保返回的是标准化的响应
        return normalizeApiResponse(result)
      } catch (error) {
        lastError = error

        // 检查是否应该重试
        // 如果这是最后一次尝试（attempt === retryTimes），不应该重试，直接break
        // 如果attempt < retryTimes，可以继续重试
        if (!shouldRetry(error) || attempt === retryTimes) {
          break
        }

        // 根据策略计算延迟时间
        let delay: number
        switch (strategy) {
          case RetryStrategy.FIXED:
            delay = initialDelay
            break
          case RetryStrategy.EXPONENTIAL:
            delay = initialDelay * Math.pow(2, attempt)
            break
          case RetryStrategy.LINEAR:
            delay = initialDelay * (attempt + 1)
            break
          default:
            delay = initialDelay
        }

        // 增加一些随机抖动，确保延迟不为负数
        const jitter = delay * 0.2 * (Math.random() - 0.5)
        const finalDelay = Math.max(0, delay + jitter)
        await new Promise(resolve => setTimeout(resolve, finalDelay))
      }
    }

    // 所有尝试都失败，确保lastError不为undefined
    if (!lastError) {
      lastError = new Error('请求失败：未知错误')
    }

    const errorObj =
      lastError && typeof lastError === 'object' && 'response' in lastError
        ? (lastError as { response?: { status?: number } })
        : null
    const statusCode =
      errorObj?.response?.status && typeof errorObj.response.status === 'number'
        ? errorObj.response.status
        : 500
    return createErrorResponse(statusCode, extractApiError(lastError))
  }
}
