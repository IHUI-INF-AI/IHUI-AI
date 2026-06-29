import { t } from '@/utils/i18n'
import { logger } from '@/utils/logger'
import { TokenStorage } from '@/utils/storage'

/**
 * 知识库管理API
 * 提供知识库的CRUD操作和文档管理
 * 
 * ⚠️ 注意：知识库接口使用教育平台 API（/api/edu），
 * 对应教育平台的 resource 模块接口
 */

import axios from 'axios'
import type { ApiResponse, PaginationParams } from '@/types'

/**
 * 教育平台 API 客户端
 * 通过 /api/edu 代理转发到教育平台后端
 */
const eduApiClient = axios.create({
  baseURL: '/api/edu',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// 请求拦截器：添加认证信息
eduApiClient.interceptors.request.use(
  (config) => {
    // 从 TokenStorage 获取认证 token
    // 优先级：accessToken > user_token > token
    const token = TokenStorage.getToken() || ''
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器：统一处理响应格式
eduApiClient.interceptors.response.use(
  (response) => {
    const data = response.data
    // 适配教育平台的响应格式
    // 教育平台 API 成功状态码是 code: 0（不是 200）
    if (data && typeof data === 'object') {
      return {
        code: data.code === 0 ? 200 : (data.code || 200),
        success: data.code === 0 || data.code === 200 || data.success === true,
        message: data.msg || data.message || 'success',
        data: data.data || data.rows || data,
        timestamp: Date.now(),
      } as ApiResponse<unknown>
    }
    return data
  },
  (error) => {
    const message = error.response?.data?.msg || error.response?.data?.message || error.message || '请求失败'
    return {
      code: error.response?.status || 500,
      success: false,
      message,
      data: null,
      timestamp: Date.now(),
    } as ApiResponse<unknown>
  }
)

/**
 * 知识库接口（对应教育平台的 resource）
 */
export interface KnowledgeBase {
  id: string
  kbId: string
  kbName: string
  documentCount?: number
  createdAt: string
  updatedAt: string
  // 教育平台 resource 字段
  title?: string
  name?: string
  description?: string
  categoryId?: number
  categoryName?: string
  coverUrl?: string
  fileUrl?: string
  fileType?: string
  fileSize?: number
  downloadCount?: number
  viewCount?: number
  status?: number
}

/**
 * 知识库文档接口
 */
export interface KnowledgeDocument {
  id: string
  kbId: string
  content: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

/**
 * 分类接口
 */
export interface ResourceCategory {
  id: number
  name: string
  pid: number
  children?: ResourceCategory[]
}

/**
 * 创建知识库/资源
 */
export async function createKnowledgeBase(data: {
  kbId?: string
  kbName?: string
  title?: string
  categoryId?: number
  description?: string
  fileUrl?: string
}): Promise<ApiResponse<KnowledgeBase>> {
  const postData = {
    title: data.kbName || data.title,
    categoryId: data.categoryId,
    description: data.description,
    fileUrl: data.fileUrl,
  }
  return eduApiClient.post('/resource/auth-api/resource', postData) as Promise<ApiResponse<KnowledgeBase>>
}

/**
 * 获取知识库列表（使用教育平台推荐资源公开接口，不需要认证）
 */
export async function getKnowledgeBases(params?: PaginationParams & {
  categoryId?: number
  keyword?: string
}): Promise<
  ApiResponse<{
    items: KnowledgeBase[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  try {
    // 转换分页参数（教育平台使用 current/size 而不是 pageNo/pageSize）
    const apiParams = {
      current: params?.page || 1,
      size: params?.pageSize || 12,
      cid: params?.categoryId,
      keyword: params?.keyword,
    }
    
    // 直接使用 axios 调用，避免拦截器的复杂处理
    const axiosResponse = await eduApiClient.get('/resource/public-api/resource/recommend-list', { params: apiParams })
    
    // 处理响应：可能是原始响应或者被拦截器处理过的响应
    const responseData = axiosResponse.data || axiosResponse
    
    // 提取实际数据
    let actualData: { list?: unknown[], total?: number, current?: number, size?: number, pages?: number }
    if (responseData.code === 0 || responseData.code === 200) {
      // 教育平台格式: { code: 0, msg: "ok", data: { list, total, ... } }
      actualData = responseData.data || responseData
    } else if (responseData.list) {
      // 已经被拦截器处理过: { list, total, ... }
      actualData = responseData
    } else {
      actualData = { list: [], total: 0 }
    }
    
    const rawItems = actualData.list || []
    
    // 转换教育平台 resource 格式为 KnowledgeBase 格式
    const items: KnowledgeBase[] = rawItems.map((item: unknown) => {
      const resource = item as Record<string, unknown>
      return {
        id: String(resource.id || ''),
        kbId: String(resource.id || ''),
        kbName: String(resource.title || ''),
        title: String(resource.title || ''),
        name: String(resource.title || ''),
        description: String(resource.introduction || resource.description || ''),
        categoryId: 0,
        categoryName: '',
        coverUrl: String(resource.image || resource.coverUrl || ''),
        fileUrl: String(resource.url || resource.fileUrl || ''),
        fileType: String(resource.type || resource.fileType || ''),
        fileSize: 0,
        downloadCount: Number(resource.downloadNum || resource.downloadCount) || 0,
        viewCount: 0,
        documentCount: Number(resource.downloadNum) || 0,
        status: resource.status === 'published' ? 1 : 0,
        createdAt: String(resource.createTime || new Date().toISOString()),
        updatedAt: String(resource.updateTime || new Date().toISOString()),
      }
    })
    
    const total = Number(actualData.total) || items.length
    
    return {
      code: 200,
      success: true,
      message: 'success',
      data: {
        items,
        total,
        page: params?.page || 1,
        pageSize: params?.pageSize || 12,
        totalPages: Math.ceil(total / (params?.pageSize || 12)),
      },
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error('[getKnowledgeBases] Error:', error)
    return {
      code: 500,
      success: false,
      message: error instanceof Error ? error.message : t('api.knowledge.请求失败'),
      data: {
        items: [],
        total: 0,
        page: params?.page || 1,
        pageSize: params?.pageSize || 12,
        totalPages: 0,
      },
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取推荐资源列表（公开接口）
 */
export async function getRecommendedKnowledgeBases(params?: PaginationParams): Promise<
  ApiResponse<{
    items: KnowledgeBase[]
    total: number
  }>
> {
  const apiParams = {
    pageNo: params?.page || 1,
    pageSize: params?.pageSize || 10,
  }
  
  const response = await eduApiClient.get('/resource/public-api/resource/recommend-list', { params: apiParams }) as ApiResponse<unknown>
  
  if (response.success && response.data) {
    const data = response.data as { list?: unknown[]; rows?: unknown[]; total?: number }
    const rawItems = data.list || data.rows || (Array.isArray(response.data) ? response.data as unknown[] : [])

    const items: KnowledgeBase[] = rawItems.map((item: unknown) => {
      const resource = item as Record<string, unknown>
      return {
        id: String(resource.id || ''),
        kbId: String(resource.id || ''),
        kbName: String(resource.title || resource.name || ''),
        title: String(resource.title || ''),
        description: String(resource.description || ''),
        coverUrl: String(resource.coverUrl || ''),
        documentCount: Number(resource.downloadCount) || 0,
        createdAt: String(resource.createTime || new Date().toISOString()),
        updatedAt: String(resource.updateTime || new Date().toISOString()),
      }
    })
    
    return {
      ...response,
      data: {
        items,
        total: Number(data.total) || items.length,
      },
    } as ApiResponse<{ items: KnowledgeBase[]; total: number }>
  }
  
  return {
    ...response,
    data: { items: [], total: 0 },
  } as ApiResponse<{ items: KnowledgeBase[]; total: number }>
}

/**
 * 获取知识库详情
 */
export async function getKnowledgeBase(kbId: string): Promise<ApiResponse<KnowledgeBase>> {
  const response = await eduApiClient.get('/resource/public-api/resource', { params: { id: kbId } }) as ApiResponse<unknown>
  
  if (response.success && response.data) {
    const resource = response.data as Record<string, unknown>
    return {
      ...response,
      data: {
        id: String(resource.id || ''),
        kbId: String(resource.id || ''),
        kbName: String(resource.title || resource.name || ''),
        title: String(resource.title || ''),
        description: String(resource.description || ''),
        coverUrl: String(resource.coverUrl || ''),
        fileUrl: String(resource.fileUrl || ''),
        fileType: String(resource.fileType || ''),
        fileSize: Number(resource.fileSize) || 0,
        downloadCount: Number(resource.downloadCount) || 0,
        viewCount: Number(resource.viewCount) || 0,
        documentCount: Number(resource.downloadCount) || 0,
        createdAt: String(resource.createTime || new Date().toISOString()),
        updatedAt: String(resource.updateTime || new Date().toISOString()),
      },
    } as ApiResponse<KnowledgeBase>
  }
  
  return response as ApiResponse<KnowledgeBase>
}

/**
 * 更新知识库
 */
export async function updateKnowledgeBase(
  kbId: string,
  data: { kbName?: string; title?: string; description?: string }
): Promise<ApiResponse<KnowledgeBase>> {
  const putData = {
    id: kbId,
    title: data.kbName || data.title,
    description: data.description,
  }
  return eduApiClient.put('/resource/auth-api/resource', putData) as Promise<ApiResponse<KnowledgeBase>>
}

/**
 * 删除知识库
 */
export async function deleteKnowledgeBase(kbId: string): Promise<ApiResponse<void>> {
  return eduApiClient.delete('/resource/auth-api/resource', { data: { id: kbId } }) as Promise<ApiResponse<void>>
}

/**
 * 获取资源分类列表
 */
export async function getResourceCategories(parentId?: number): Promise<ApiResponse<ResourceCategory[]>> {
  const response = await eduApiClient.get('/resource/public-api/category/list', { 
    params: { id: parentId || 0, fetchAll: true } 
  }) as ApiResponse<unknown>
  
  if (response.success && response.data) {
    return response as ApiResponse<ResourceCategory[]>
  }
  
  return {
    ...response,
    data: [],
  } as ApiResponse<ResourceCategory[]>
}

/**
 * 下载资源
 */
export async function downloadResource(resourceId: string): Promise<ApiResponse<{ downloadUrl: string }>> {
  return eduApiClient.get('/resource/auth-api/resource/download', { params: { id: resourceId } }) as Promise<ApiResponse<{ downloadUrl: string }>>
}

/**
 * 添加文档到知识库（保留接口兼容性）
 */
export async function addDocumentToKnowledgeBase(
  _kbId: string,
  _data: {
    content: string
    metadata?: Record<string, unknown>
  }
): Promise<ApiResponse<KnowledgeDocument>> {
  // 教育平台资源模块暂不支持此功能，返回模拟响应
  return {
    code: 501,
    success: false,
    message: t('api.knowledge.教育平台资源模块1'),
    data: null as unknown as KnowledgeDocument,
    timestamp: Date.now(),
  }
}

/**
 * 获取知识库文档列表（保留接口兼容性）
 */
export async function getKnowledgeBaseDocuments(
  kbId: string,
  params?: PaginationParams
): Promise<
  ApiResponse<{
    items: KnowledgeDocument[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  // 教育平台资源模块暂不支持此功能，返回空列表
  return {
    code: 200,
    success: true,
    message: t('api.knowledge.教育平台资源模块2'),
    data: {
      items: [],
      total: 0,
      page: params?.page || 1,
      pageSize: params?.pageSize || 10,
      totalPages: 0,
    },
    timestamp: Date.now(),
  }
}

/**
 * 删除知识库文档（保留接口兼容性）
 */
export async function deleteKnowledgeBaseDocument(
  _kbId: string,
  _documentId: string
): Promise<ApiResponse<void>> {
  return {
    code: 501,
    success: false,
    message: t('api.knowledge.教育平台资源模块3'),
    data: undefined,
    timestamp: Date.now(),
  }
}

/**
 * 搜索知识库
 */
export interface KnowledgeSearchParams {
  query: string
  kbId?: string
  topK?: number
  filters?: Record<string, unknown>
}

export interface KnowledgeSearchResult {
  content: string
  metadata?: Record<string, unknown>
  score?: number
  kbId?: string
}

export async function searchKnowledge(
  params: KnowledgeSearchParams
): Promise<ApiResponse<KnowledgeSearchResult[]>> {
  // 使用教育平台的搜索接口或资源列表接口带关键词
  const response = await eduApiClient.get('/resource/auth-api/resource/list', { 
    params: { 
      keyword: params.query,
      pageNo: 1,
      pageSize: params.topK || 10,
    } 
  }) as ApiResponse<unknown>
  
  if (response.success && response.data) {
    const data = response.data as { list?: unknown[]; rows?: unknown[] }
    const rawItems = data.list || data.rows || (Array.isArray(response.data) ? response.data as unknown[] : [])

    const results: KnowledgeSearchResult[] = rawItems.map((item: unknown) => {
      const resource = item as Record<string, unknown>
      return {
        content: String(resource.title || resource.description || ''),
        metadata: {
          id: resource.id,
          title: resource.title,
          categoryName: resource.categoryName,
        },
        score: 1,
        kbId: String(resource.id || ''),
      }
    })
    
    return {
      ...response,
      data: results,
    } as ApiResponse<KnowledgeSearchResult[]>
  }
  
  return {
    ...response,
    data: [],
  } as ApiResponse<KnowledgeSearchResult[]>
}
