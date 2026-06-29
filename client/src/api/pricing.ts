import { DEVELOPER_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import type { PricingConfig, ProxyConfig } from '@/api/models'

// 定价相关API

// 获取模型定价配置
export async function getModelPricing(modelId: string): Promise<ApiResponse<PricingConfig>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.models.pricing(modelId))
    return {
      code: 200,
      success: true,
      message: t('api.pricing.获取成功'),
      data: response.data || ({} as PricingConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取定价配置失败',
      data: {} as PricingConfig,
      timestamp: Date.now(),
    }
  }
}

// 更新模型定价配置
export async function updateModelPricing(
  modelId: string,
  pricing: PricingConfig
): Promise<ApiResponse<PricingConfig>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.models.pricing(modelId), pricing)
    return {
      code: 200,
      success: true,
      message: t('api.pricing.更新成功1'),
      data: response.data || ({} as PricingConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新定价配置失败',
      data: {} as PricingConfig,
      timestamp: Date.now(),
    }
  }
}

// 计算调用成本
export async function calculateCost(params: {
  modelId: string
  inputTokens: number
  outputTokens: number
  region?: string
  quantity?: number
}): Promise<
  ApiResponse<{
    inputCost: number
    outputCost: number
    totalCost: number
    discount: number
    finalCost: number
  }>
> {
  try {
    const response = await request.post(DEVELOPER_PATHS.pricing.calculate, params)
    return {
      code: 200,
      success: true,
      message: t('api.pricing.计算成功2'),
      data: response.data || {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        discount: 0,
        finalCost: 0,
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '计算成本失败',
      data: {
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
        discount: 0,
        finalCost: 0,
      },
      timestamp: Date.now(),
    }
  }
}

// 中转服务相关API

// 获取模型中转配置
export async function getModelProxy(modelId: string): Promise<ApiResponse<ProxyConfig>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.models.proxy(modelId))
    return {
      code: 200,
      success: true,
      message: t('api.pricing.获取成功3'),
      data: response.data || ({} as ProxyConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取中转配置失败',
      data: {} as ProxyConfig,
      timestamp: Date.now(),
    }
  }
}

// 更新模型中转配置
export async function updateModelProxy(
  modelId: string,
  proxy: ProxyConfig
): Promise<ApiResponse<ProxyConfig>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.models.proxy(modelId), proxy)
    return {
      code: 200,
      success: true,
      message: t('api.pricing.更新成功4'),
      data: response.data || ({} as ProxyConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新中转配置失败',
      data: {} as ProxyConfig,
      timestamp: Date.now(),
    }
  }
}

// 测试中转服务
export async function testProxy(modelId: string): Promise<
  ApiResponse<{
    success: boolean
    message: string
    latency?: number
  }>
> {
  try {
    const response = await request.post(DEVELOPER_PATHS.models.proxyTest(modelId))
    return {
      code: 200,
      success: true,
      message: t('api.pricing.测试成功5'),
      data: response.data || { success: false, message: t('api.pricing.未知错误6') },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '测试中转服务失败',
      data: { success: false, message: error instanceof Error ? error.message : String(error) },
      timestamp: Date.now(),
    }
  }
}

// 获取中转服务健康状态
export async function getProxyHealth(modelId: string): Promise<
  ApiResponse<{
    status: 'healthy' | 'unhealthy' | 'unknown'
    latency: number
    lastCheck: string
    successRate: number
  }>
> {
  try {
    const response = await request.get(DEVELOPER_PATHS.models.proxyHealth(modelId))
    return {
      code: 200,
      success: true,
      message: t('api.pricing.获取成功7'),
      data: response.data || {
        status: 'unknown',
        latency: 0,
        lastCheck: '',
        successRate: 0,
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取健康状态失败',
      data: {
        status: 'unknown',
        latency: 0,
        lastCheck: '',
        successRate: 0,
      },
      timestamp: Date.now(),
    }
  }
}
