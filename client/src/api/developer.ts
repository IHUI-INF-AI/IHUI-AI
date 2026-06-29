import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { DEVELOPER_PATHS } from '@/config/backend-paths'

// API密钥接口
export interface ApiKey {
  id: string
  name: string
  description?: string
  key: string
  expiresAt?: string
  permissions: string[]
  enabled: boolean
  createTime?: string
  updateTime?: string
}

// 创建API密钥
export async function createApiKey(apiKey: Partial<ApiKey>): Promise<ApiResponse<ApiKey>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apiKeys, apiKey)
    return {
      code: 200,
      success: true,
      message: t('api.developer.创建成功'),
      data: response.data || ({} as ApiKey),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建API密钥失败',
      data: {} as ApiKey,
      timestamp: Date.now(),
    }
  }
}
