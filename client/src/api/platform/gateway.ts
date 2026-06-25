import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse as ApiResponseType, PaginationParams, PaginationResponse } from '@/types'
import { DEVELOPER_PATHS } from '@/config/backend-paths'

// API网关配置
export interface GatewayConfig {
  id: string
  name: string
  baseUrl: string
  description?: string
  authType: 'apikey' | 'oauth2' | 'jwt' | 'bearer'
  rateLimit: {
    qps: number
    burst: number
    quota: {
      daily: number
      monthly: number
    }
  }
  caching: {
    enabled: boolean
    ttl: number
  }
  monitoring: {
    enabled: boolean
    logLevel: 'info' | 'warn' | 'error'
  }
  enabled: boolean
  createTime?: string
  updateTime?: string
}

// API端点配置
export interface ApiEndpoint {
  id: string
  gatewayId: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  description?: string
  parameters?: ApiParameter[]
  requestBody?: ApiRequestBody
  responses?: ApiResponse[]
  authRequired: boolean
  rateLimit?: {
    qps: number
    burst: number
  }
  enabled: boolean
}

export interface ApiParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description?: string
  defaultValue?: unknown
  enum?: unknown[]
  min?: number
  max?: number
  pattern?: string
}

export interface ApiRequestBody {
  contentType: 'application/json' | 'application/xml' | 'multipart/form-data'
  schema: Record<string, unknown>
  required?: string[]
}

export interface ApiResponse {
  statusCode: number
  description?: string
  schema: Record<string, unknown>
}

// API调用统计
export interface ApiCallStats {
  endpointId: string
  endpointPath: string
  totalCalls: number
  successCalls: number
  errorCalls: number
  avgResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  lastCalled?: string
}

// 获取API网关列表
export async function getGateways(
  params?: PaginationParams
): Promise<ApiResponseType<PaginationResponse<GatewayConfig>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.gateways.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.gateway.获取成功'),
      data: response.data || {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取API网关列表失败',
      data: {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 创建API网关
export async function createGateway(
  gateway: Partial<GatewayConfig>
): Promise<ApiResponseType<GatewayConfig>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.gateways.list, gateway)
    return {
      code: 200,
      success: true,
      message: t('api.gateway.创建成功1'),
      data: response.data || ({} as GatewayConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建API网关失败',
      data: {} as GatewayConfig,
      timestamp: Date.now(),
    }
  }
}

// 更新API网关
export async function updateGateway(
  id: string,
  gateway: Partial<GatewayConfig>
): Promise<ApiResponseType<GatewayConfig>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.gateways.byId(id), gateway)
    return {
      code: 200,
      success: true,
      message: t('api.gateway.更新成功2'),
      data: response.data || ({} as GatewayConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新API网关失败',
      data: {} as GatewayConfig,
      timestamp: Date.now(),
    }
  }
}

// 删除API网关
export async function deleteGateway(id: string): Promise<ApiResponseType<boolean>> {
  try {
    await request.delete(DEVELOPER_PATHS.gateways.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.gateway.删除成功3'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除API网关失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取API端点列表
export async function getApiEndpoints(
  gatewayId: string,
  params?: PaginationParams
): Promise<ApiResponseType<PaginationResponse<ApiEndpoint>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.gateways.endpoints(gatewayId), { params })
    return {
      code: 200,
      success: true,
      message: t('api.gateway.获取成功4'),
      data: response.data || {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取API端点列表失败',
      data: {
        list: [],
        pagination: {
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 创建API端点
export async function createApiEndpoint(
  gatewayId: string,
  endpoint: Partial<ApiEndpoint>
): Promise<ApiResponseType<ApiEndpoint>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.gateways.endpoints(gatewayId), endpoint)
    return {
      code: 200,
      success: true,
      message: t('api.gateway.创建成功5'),
      data: response.data || ({} as ApiEndpoint),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建API端点失败',
      data: {} as ApiEndpoint,
      timestamp: Date.now(),
    }
  }
}

// 更新API端点
export async function updateApiEndpoint(
  gatewayId: string,
  endpointId: string,
  endpoint: Partial<ApiEndpoint>
): Promise<ApiResponseType<ApiEndpoint>> {
  try {
    const response = await request.put(
      DEVELOPER_PATHS.gateways.endpointDelete(gatewayId, endpointId),
      endpoint
    )
    return {
      code: 200,
      success: true,
      message: t('api.gateway.更新成功6'),
      data: response.data || ({} as ApiEndpoint),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新API端点失败',
      data: {} as ApiEndpoint,
      timestamp: Date.now(),
    }
  }
}

// 删除API端点
export async function deleteApiEndpoint(
  gatewayId: string,
  endpointId: string
): Promise<ApiResponseType<boolean>> {
  try {
    await request.delete(DEVELOPER_PATHS.gateways.endpointDelete(gatewayId, endpointId))
    return {
      code: 200,
      success: true,
      message: t('api.gateway.删除成功7'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除API端点失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取API调用统计
export async function getApiCallStats(
  gatewayId: string,
  params?: {
    startDate?: string
    endDate?: string
    endpointId?: string
  }
): Promise<ApiResponseType<ApiCallStats[]>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.gateways.stats(gatewayId), { params })
    return {
      code: 200,
      success: true,
      message: t('api.gateway.获取成功8'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取统计信息失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 测试API端点
export async function testApiEndpoint(
  gatewayId: string,
  endpointId: string,
  params?: Record<string, unknown>
): Promise<
  ApiResponseType<{
    success: boolean
    statusCode: number
    response: unknown
    duration: number
  }>
> {
  try {
    const response = await request.post(
      DEVELOPER_PATHS.gateways.endpointTest(gatewayId, endpointId),
      params
    )
    return {
      code: 200,
      success: true,
      message: t('api.gateway.测试成功9'),
      data: response.data || {
        success: false,
        statusCode: 500,
        response: {},
        duration: 0,
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '测试API端点失败',
      data: {
        success: false,
        statusCode: 500,
        response: {},
        duration: 0,
      },
      timestamp: Date.now(),
    }
  }
}
