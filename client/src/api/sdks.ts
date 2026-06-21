import { t } from '@/utils/i18n'

 
import request from '@/utils/request'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { DEVELOPER_PATHS } from '@/config/backend-paths'

// SDK类型
export type SdkLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'php'
  | 'ruby'
  | 'csharp'

// SDK配置
export interface SdkConfig {
  id: string
  name: string
  language: SdkLanguage
  version: string
  description?: string
  packageName?: string
  repositoryUrl?: string
  downloadUrl?: string
  installCommand?: string
  apiVersion: string
  enabled: boolean
  autoGenerate: boolean
  generateConfig?: {
    includeExamples: boolean
    includeTests: boolean
    includeDocs: boolean
  }
  createTime?: string
  updateTime?: string
  installation?: string
  quickStart?: string
  apiKey?: string
}

// SDK生成结果
export interface SdkGenerateResult {
  success: boolean
  packagePath?: string
  downloadUrl?: string
  files?: Array<{
    path: string
    content: string
  }>
  error?: string
}

// 获取SDK列表
export async function getSdks(
  params?: PaginationParams & {
    language?: SdkLanguage
  }
): Promise<ApiResponse<PaginationResponse<SdkConfig>>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.sdks.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.sdks.获取成功'),
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
      message: (error instanceof Error ? error.message : String(error)) || '获取SDK列表失败',
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

// 获取SDK详情
export async function getSdkDetail(id: string): Promise<ApiResponse<SdkConfig>> {
  try {
    const response = await request.get(DEVELOPER_PATHS.sdks.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.sdks.获取成功1'),
      data: response.data || ({} as SdkConfig),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取SDK详情失败',
      data: {} as SdkConfig,
      timestamp: Date.now(),
    }
  }
}

// 创建SDK
export async function createSdk(sdk: Partial<SdkConfig>): Promise<ApiResponse<SdkConfig>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.sdks.list, sdk)
    return {
      code: 200,
      success: true,
      message: t('api.sdks.创建成功2'),
      data: response.data || ({} as SdkConfig),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '创建SDK失败',
      data: {} as SdkConfig,
      timestamp: Date.now(),
    }
  }
}

// 更新SDK
export async function updateSdk(
  id: string,
  sdk: Partial<SdkConfig>
): Promise<ApiResponse<SdkConfig>> {
  try {
    const response = await request.put(DEVELOPER_PATHS.sdks.byId(id), sdk)
    return {
      code: 200,
      success: true,
      message: t('api.sdks.更新成功3'),
      data: response.data || ({} as SdkConfig),
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新SDK失败',
      data: {} as SdkConfig,
      timestamp: Date.now(),
    }
  }
}

// 删除SDK
export async function deleteSdk(id: string): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.delete(DEVELOPER_PATHS.sdks.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.sdks.删除成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '删除SDK失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 生成SDK
export async function generateSdk(
  id: string,
  options?: {
    includeExamples?: boolean
    includeTests?: boolean
    includeDocs?: boolean
  }
): Promise<ApiResponse<SdkGenerateResult>> {
  try {
    const response = await request.post(DEVELOPER_PATHS.sdks.generate(id), options)
    return {
      code: 200,
      success: true,
      message: t('api.sdks.生成成功5'),
      data: response.data || {
        success: false,
        error: '未知错误',
      },
      timestamp: Date.now(),
    }
  } catch (error: any) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '生成SDK失败',
      data: {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      timestamp: Date.now(),
    }
  }
}

// 下载SDK
export async function downloadSdk(id: string, version?: string): Promise<Blob> {
  try {
    const response = await request.get(DEVELOPER_PATHS.sdks.download(id), {
      params: { version },
      responseType: 'blob',
    })
    return response.data
  } catch (error: any) {
    throw new Error((error instanceof Error ? error.message : String(error)) || '下载SDK失败')
  }
}

// SDK语言信息
export const SDK_LANGUAGES: Record<
  SdkLanguage,
  {
    name: string
    icon: string
    packageManager: string
    fileExtension: string
  }
> = {
  javascript: {
    name: 'JavaScript',
    icon: '📜',
    packageManager: 'npm',
    fileExtension: '.js',
  },
  typescript: {
    name: 'TypeScript',
    icon: '📘',
    packageManager: 'npm',
    fileExtension: '.ts',
  },
  python: {
    name: 'Python',
    icon: '🐍',
    packageManager: 'pip',
    fileExtension: '.py',
  },
  java: {
    name: 'Java',
    icon: '☕',
    packageManager: 'maven',
    fileExtension: '.java',
  },
  go: {
    name: 'Go',
    icon: '🐹',
    packageManager: 'go mod',
    fileExtension: '.go',
  },
  php: {
    name: 'PHP',
    icon: '🐘',
    packageManager: 'composer',
    fileExtension: '.php',
  },
  ruby: {
    name: 'Ruby',
    icon: '💎',
    packageManager: 'gem',
    fileExtension: '.rb',
  },
  csharp: {
    name: 'C#',
    icon: '🔷',
    packageManager: 'nuget',
    fileExtension: '.cs',
  },
}
