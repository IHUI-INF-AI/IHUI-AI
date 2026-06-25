import { DEVELOPER_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

// 插件类型
export type PluginType = 'function' | 'tool' | 'integration' | 'custom'

// 插件状态
export type PluginStatus = 'draft' | 'published' | 'deprecated' | 'reviewing'

// 插件接口
export interface Plugin {
  id: string
  name: string
  type: PluginType
  description: string
  version: string
  author: string
  icon?: string
  category?: string
  tags?: string[]
  status: PluginStatus
  config?: Record<string, unknown>
  manifest?: Record<string, unknown> // 插件清单
  apiEndpoint?: string
  webhookUrl?: string
  enabled: boolean
  installCount?: number
  rating?: number
  ratingCount?: number
  createTime?: string
  updateTime?: string
}

// 获取插件列表
export async function getPluginsList(
  params?: PaginationParams & {
    type?: PluginType
    status?: PluginStatus
    category?: string
  }
): Promise<ApiResponse<PaginationResponse<Plugin>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.plugins.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.plugins.获取成功'),
      data: response.data || {
        list: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取插件列表失败',
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

// 获取插件详情
export async function getPluginDetail(id: string): Promise<ApiResponse<Plugin>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.plugins.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.plugins.获取成功1'),
      data: response.data || ({} as Plugin),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取插件详情失败',
      data: {} as Plugin,
      timestamp: Date.now(),
    }
  }
}

// 创建插件
export async function createPlugin(plugin: Partial<Plugin>): Promise<ApiResponse<Plugin>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.plugins.list, plugin)
    return {
      code: 200,
      success: true,
      message: t('api.plugins.创建成功2'),
      data: response.data || ({} as Plugin),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建插件失败',
      data: {} as Plugin,
      timestamp: Date.now(),
    }
  }
}

// 更新插件
export async function updatePlugin(
  id: string,
  plugin: Partial<Plugin>
): Promise<ApiResponse<Plugin>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.plugins.byId(id), plugin)
    return {
      code: 200,
      success: true,
      message: t('api.plugins.更新成功3'),
      data: response.data || ({} as Plugin),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新插件失败',
      data: {} as Plugin,
      timestamp: Date.now(),
    }
  }
}

// 删除插件
export async function deletePlugin(id: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.delete(DEVELOPER_PATHS.plugins.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.plugins.删除成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除插件失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 发布插件
export async function publishPlugin(id: string): Promise<ApiResponse<Plugin>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.plugins.publish(id))
    return {
      code: 200,
      success: true,
      message: t('api.plugins.发布成功5'),
      data: response.data || ({} as Plugin),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '发布插件失败',
      data: {} as Plugin,
      timestamp: Date.now(),
    }
  }
}

// 测试插件
export async function testPlugin(
  id: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.plugins.test(id), params)
    return {
      code: 200,
      success: true,
      message: t('api.plugins.测试成功6'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '测试插件失败',
      data: null,
      timestamp: Date.now(),
    }
  }
}
