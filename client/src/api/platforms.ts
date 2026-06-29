import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { DEVELOPER_PATHS } from '@/config/backend-paths'

// 支持的平台类型
export type PlatformType = 'coze' | 'n8n' | 'dify' | 'make' | 'dashscope' | 'internal'

// 平台配置接口
export interface PlatformConfig {
  id?: string
  platform: PlatformType
  name: string
  enabled: boolean
  apiKey?: string
  apiSecret?: string
  baseUrl?: string
  // Coze平台配置
  cozeBotId?: string
  // N8N平台配置
  n8nInstanceUrl?: string
  n8nWebhookId?: string
  // Dify平台配置
  difyApiKey?: string
  difyAppId?: string
  difyBaseUrl?: string
  // Make平台配置
  makeApiKey?: string
  makeWebhookUrl?: string
  // 阿里云百炼平台配置
  dashscopeApiKey?: string
  dashscopeBaseUrl?: string
  // 其他通用配置
  timeout?: number
  retryCount?: number
  headers?: Record<string, string>
  extraConfig?: Record<string, unknown>
  createTime?: string
  updateTime?: string
}

// 平台配置表单接口
export interface PlatformConfigForm {
  platform: PlatformType
  name: string
  enabled: boolean
  // 基础配置
  apiKey: string
  apiSecret?: string
  baseUrl?: string
  // Coze配置
  cozeBotId?: string
  // N8N配置
  n8nInstanceUrl?: string
  n8nWebhookId?: string
  // Dify配置
  difyApiKey?: string
  difyAppId?: string
  difyBaseUrl?: string
  // Make配置
  makeApiKey?: string
  makeWebhookUrl?: string
  // 阿里云百炼配置
  dashscopeApiKey?: string
  dashscopeBaseUrl?: string
  // 高级配置
  timeout?: number
  retryCount?: number
  headers?: Record<string, string>
  extraConfig?: Record<string, unknown>
}

// 获取平台配置列表
export async function getPlatformConfigs(): Promise<ApiResponse<PlatformConfig[]>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.platforms.list)
    return {
      code: 200,
      success: true,
      message: t('api.platforms.获取成功'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取平台配置失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取单个平台配置
export async function getPlatformConfig(id: string): Promise<ApiResponse<PlatformConfig>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.platforms.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.platforms.获取成功1'),
      data: response.data || ({} as PlatformConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取平台配置失败',
      data: {} as PlatformConfig,
      timestamp: Date.now(),
    }
  }
}

// 创建平台配置
export async function createPlatformConfig(
  config: PlatformConfigForm
): Promise<ApiResponse<PlatformConfig>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.platforms.list, config)
    return {
      code: 200,
      success: true,
      message: t('api.platforms.创建成功2'),
      data: response.data || ({} as PlatformConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建平台配置失败',
      data: {} as PlatformConfig,
      timestamp: Date.now(),
    }
  }
}

// 更新平台配置
export async function updatePlatformConfig(
  id: string,
  config: Partial<PlatformConfigForm>
): Promise<ApiResponse<PlatformConfig>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.platforms.byId(id), config)
    return {
      code: 200,
      success: true,
      message: t('api.platforms.更新成功3'),
      data: response.data || ({} as PlatformConfig),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新平台配置失败',
      data: {} as PlatformConfig,
      timestamp: Date.now(),
    }
  }
}

// 删除平台配置
export async function deletePlatformConfig(id: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.delete(DEVELOPER_PATHS.platforms.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.platforms.删除成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除平台配置失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 测试平台连接
export async function testPlatformConnection(
  config: PlatformConfigForm
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.platforms.test, config)
    return {
      code: 200,
      success: true,
      message: t('api.platforms.测试成功5'),
      data: response.data || { success: false, message: t('api.platforms.未知错误6') },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '测试连接失败',
      data: { success: false, message: error instanceof Error ? error.message : String(error) },
      timestamp: Date.now(),
    }
  }
}

// 获取平台统计信息
export async function getPlatformStats(platform?: PlatformType): Promise<
  ApiResponse<{
    totalAgents: number
    totalCalls: number
    successRate: number
    avgResponseTime: number
    platformStats: Array<{
      platform: PlatformType
      agents: number
      calls: number
      successRate: number
    }>
  }>
> {
  try {
    const response = await request.get(DEVELOPER_PATHS.platforms.stats, {
      params: { platform },
    })
    return {
      code: 200,
      success: true,
      message: t('api.platforms.获取成功7'),
      data: response.data || {
        totalAgents: 0,
        totalCalls: 0,
        successRate: 0,
        avgResponseTime: 0,
        platformStats: [],
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取统计信息失败',
      data: {
        totalAgents: 0,
        totalCalls: 0,
        successRate: 0,
        avgResponseTime: 0,
        platformStats: [],
      },
      timestamp: Date.now(),
    }
  }
}

// 同步平台智能体
export async function syncPlatformAgents(
  platformId: string
): Promise<ApiResponse<{ synced: number; failed: number }>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.platforms.sync(platformId))
    return {
      code: 200,
      success: true,
      message: t('api.platforms.同步成功8'),
      data: response.data || { synced: 0, failed: 0 },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '同步失败',
      data: { synced: 0, failed: 0 },
      timestamp: Date.now(),
    }
  }
}

// 平台信息常量
export const PLATFORM_INFO: Record<
  PlatformType,
  {
    name: string
    icon: string
    description: string
    officialUrl: string
    requiredFields: string[]
    optionalFields: string[]
  }
> = {
  coze: {
    name: '扣子（Coze）',
    icon: '🤖',
    description: t('text.platforms.字节跳动的AI智9'),
    officialUrl: 'https://www.coze.cn',
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'cozeBotId'],
  },
  n8n: {
    name: 'N8N',
    icon: '⚙️',
    description: t('text.platforms.开源的工作流自动10'),
    officialUrl: 'https://n8n.io',
    requiredFields: ['n8nInstanceUrl', 'apiKey'],
    optionalFields: ['n8nWebhookId'],
  },
  dify: {
    name: 'Dify',
    icon: '🎯',
    description: t('text.platforms.开源的LLM应用11'),
    officialUrl: 'https://dify.ai',
    requiredFields: ['difyApiKey', 'difyBaseUrl'],
    optionalFields: ['difyAppId'],
  },
  make: {
    name: 'Make（原Integromat）',
    icon: '🔧',
    description: t('text.platforms.强大的自动化平台12'),
    officialUrl: 'https://www.make.com',
    requiredFields: ['makeApiKey'],
    optionalFields: ['makeWebhookUrl'],
  },
  dashscope: {
    name: '阿里云百炼',
    icon: '☁️',
    description: t('text.platforms.阿里云的AI服务13'),
    officialUrl: 'https://dashscope.aliyun.com',
    requiredFields: ['dashscopeApiKey'],
    optionalFields: ['dashscopeBaseUrl'],
  },
  internal: {
    name: '内部平台',
    icon: '🏠',
    description: t('text.platforms.系统自建的智能体14'),
    officialUrl: '',
    requiredFields: [],
    optionalFields: ['baseUrl'],
  },
}
