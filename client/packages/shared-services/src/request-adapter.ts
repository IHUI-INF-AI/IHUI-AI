import type { ApiResponse } from '@aizhs/shared-types'

export type SharedRequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface SharedRequestConfig<TData = unknown> {
  url: string
  method?: SharedRequestMethod
  data?: TData
  params?: Record<string, unknown>
  headers?: Record<string, string>
  base?: number
  timeout?: number
}

export interface SharedRequestAdapter {
  request<TResponse = unknown, TData = unknown>(config: SharedRequestConfig<TData>): Promise<TResponse>
}

export function normalizeApiResponse<T>(response: unknown): ApiResponse<T> {
  const maybeResponse = response as Record<string, unknown> | null
  const isObject = maybeResponse && typeof maybeResponse === 'object'
  const isApiEnvelope =
    isObject &&
    ('code' in maybeResponse ||
      'success' in maybeResponse ||
      'msg' in maybeResponse ||
      'message' in maybeResponse)
  const raw =
    isObject && !isApiEnvelope && 'data' in maybeResponse
      ? maybeResponse.data
      : response

  if (raw && typeof raw === 'object') {
    const data = raw as Record<string, unknown>
    const code = (data.code ?? data.statusCode ?? 200) as number | string
    return {
      code,
      msg: data.msg as string | undefined,
      message: (data.message ?? data.msg) as string | undefined,
      data: data.data as T | undefined,
      success: data.success as boolean | undefined,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
      traceId: data.traceId as string | undefined,
    }
  }

  return {
    code: 200,
    data: raw as T,
    success: true,
    timestamp: Date.now(),
  }
}
