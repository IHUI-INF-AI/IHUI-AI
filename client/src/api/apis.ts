import { DEVELOPER_PATHS } from '@/config/backend-paths'
import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'

// API方法类型
export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// API接口
export interface DeveloperAPI {
  id: string
  name: string
  path: string
  method: ApiMethod
  description: string
  version: string
  category?: string
  tags?: string[]
  requestParams?: Array<{
    name: string
    type: string
    required: boolean
    description?: string
    example?: unknown
  }>
  responseSchema?: Record<string, unknown>
  authRequired: boolean
  rateLimit?: {
    requests: number
    period: string // 如 "1m", "1h"
  }
  enabled: boolean
  callCount?: number
  successCount?: number
  errorCount?: number
  createTime?: string
  updateTime?: string
}

// API版本
export interface APIVersion {
  id: string
  apiId: string
  version: string
  description?: string
  changelog?: string
  isDefault: boolean
  enabled: boolean
  createTime?: string
}

// API测试用例
export interface APITestCase {
  id: string
  apiId: string
  name: string
  description?: string
  params: Record<string, unknown>
  expectedResponse?: unknown
  enabled: boolean
  createTime?: string
}

// API测试历史
export interface APITestHistory {
  id: string
  apiId: string
  testCaseId?: string
  params: Record<string, unknown>
  response: unknown
  status: 'success' | 'error'
  duration: number
  timestamp: string
}

// 获取API列表
export async function getAPIsList(
  params?: PaginationParams & {
    method?: ApiMethod
    category?: string
    enabled?: boolean
  }
): Promise<ApiResponse<PaginationResponse<DeveloperAPI>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.apis.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.apis.获取成功'),
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
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取API列表失败',
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

// 获取API详情
export async function getAPIDetail(id: string): Promise<ApiResponse<DeveloperAPI>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.apis.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.apis.获取成功1'),
      data: response.data || ({} as DeveloperAPI),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取API详情失败',
      data: {} as DeveloperAPI,
      timestamp: Date.now(),
    }
  }
}

// 创建API
export async function createAPI(api: Partial<DeveloperAPI>): Promise<ApiResponse<DeveloperAPI>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apis.list, api)
    return {
      code: 200,
      success: true,
      message: t('api.apis.创建成功2'),
      data: response.data || ({} as DeveloperAPI),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建API失败',
      data: {} as DeveloperAPI,
      timestamp: Date.now(),
    }
  }
}

// 更新API
export async function updateAPI(
  id: string,
  api: Partial<DeveloperAPI>
): Promise<ApiResponse<DeveloperAPI>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.apis.byId(id), api)
    return {
      code: 200,
      success: true,
      message: t('api.apis.更新成功3'),
      data: response.data || ({} as DeveloperAPI),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新API失败',
      data: {} as DeveloperAPI,
      timestamp: Date.now(),
    }
  }
}

// 删除API
export async function deleteAPI(id: string): Promise<ApiResponse<boolean>> {
  try {
    await request.delete(DEVELOPER_PATHS.apis.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.apis.删除成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除API失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 测试API
export async function testAPI(
  id: string,
  params?: Record<string, unknown>
): Promise<ApiResponse<unknown>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apis.test(id), params)
    return {
      code: 200,
      success: true,
      message: t('api.apis.测试成功5'),
      data: response.data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '测试API失败',
      data: null,
      timestamp: Date.now(),
    }
  }
}

// 获取API文档
export async function getAPIDocumentation(id: string): Promise<ApiResponse<string>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.apis.documentation(id))
    return {
      code: 200,
      success: true,
      message: t('api.apis.获取成功6'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取API文档失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// 生成API文档
export async function generateAPIDocumentation(id: string): Promise<ApiResponse<string>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apis.documentationGenerate(id))
    return {
      code: 200,
      success: true,
      message: t('api.apis.生成成功7'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '生成API文档失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// 导出API文档
export async function exportAPIDocumentation(
  id: string,
  options?: {
    format?: 'markdown' | 'openapi' | 'postman' | 'html'
    includeExamples?: boolean
    includeSchemas?: boolean
  }
): Promise<ApiResponse<string>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apis.documentationExport(id), options)
    return {
      code: 200,
      success: true,
      message: t('api.apis.导出成功8'),
      data: response.data || '',
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '导出API文档失败',
      data: '',
      timestamp: Date.now(),
    }
  }
}

// 获取API版本列表
export async function getAPIVersions(apiId: string): Promise<ApiResponse<APIVersion[]>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.apis.versions(apiId))
    return {
      code: 200,
      success: true,
      message: t('api.apis.获取成功9'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取API版本失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 创建API版本
export async function createAPIVersion(
  apiId: string,
  version: Partial<APIVersion>
): Promise<ApiResponse<APIVersion>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apis.versions(apiId), version)
    return {
      code: 200,
      success: true,
      message: t('api.apis.创建成功10'),
      data: response.data || ({} as APIVersion),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建API版本失败',
      data: {} as APIVersion,
      timestamp: Date.now(),
    }
  }
}

// 切换API版本
export async function switchAPIVersion(
  apiId: string,
  versionId: string
): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.post(
      DEVELOPER_PATHS.apis.versionSwitch(apiId, versionId)
    )
    return {
      code: 200,
      success: true,
      message: t('api.apis.切换成功11'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '切换API版本失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取API测试用例
export async function getAPITestCases(apiId: string): Promise<ApiResponse<APITestCase[]>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.apis.testCases(apiId))
    return {
      code: 200,
      success: true,
      message: t('api.apis.获取成功12'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取测试用例失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 保存API测试用例
export async function saveAPITestCase(
  apiId: string,
  testCase: Partial<APITestCase>
): Promise<ApiResponse<APITestCase>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.apis.testCases(apiId), testCase)
    return {
      code: 200,
      success: true,
      message: t('api.apis.保存成功13'),
      data: response.data || ({} as APITestCase),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '保存测试用例失败',
      data: {} as APITestCase,
      timestamp: Date.now(),
    }
  }
}

// 删除API测试用例
export async function deleteAPITestCase(
  apiId: string,
  testCaseId: string
): Promise<ApiResponse<boolean>> {
  try {
    await request.delete(DEVELOPER_PATHS.apis.testCaseById(apiId, testCaseId))
    return {
      code: 200,
      success: true,
      message: t('api.apis.删除成功14'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除测试用例失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取API测试历史
export async function getAPITestHistory(
  apiId: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginationResponse<APITestHistory>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.apis.testHistory(apiId), { params })
    return {
      code: 200,
      success: true,
      message: t('api.apis.获取成功15'),
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
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取测试历史失败',
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
