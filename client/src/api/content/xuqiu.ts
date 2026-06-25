import { t } from '@/utils/i18n'

import request from '@/utils/request'
import type {
  ApiResponse,
  PaginationParams,
  PaginationResponse,
  PlazaDemand,
  CreatePlazaDemandRequest,
  BackendPageResult,
  PlazaDemandsListParams,
} from '@/types'
import { logger } from '@/utils/logger'
import { API_ENDPOINTS } from '@/config/swagger-endpoints'

/** 需求广场列表项：与后端 PlazaDemand 一致，禁止前端自创字段 */
export type { PlazaDemand }

/** @deprecated 请使用 PlazaDemand，与后端字段一致 */
export type Demand = PlazaDemand

/** 发布需求请求体：与后端 CreatePlazaDemandRequest 一致 */
export type { CreatePlazaDemandRequest }

/** 本地 mock 兜底数据（后端 500 时使用，保持页面有内容展示） */
const MOCK_DEMANDS: PlazaDemand[] = [
  {
    id: 100001,
    userId: 'demo-user-1',
    userName: 'AI探索者',
    avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
    title: '寻找 AI 智能客服系统集成伙伴',
    description: '需要一个支持多轮对话的智能客服系统，能与现有 CRM 打通，目标 7 天内 POC 验证。',
    type: '1',
    category: 'aiChat',
    status: 2,
    viewCount: 128,
    commentCount: 12,
    createTime: new Date(Date.now() - 86400000 * 2).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 100002,
    userId: 'demo-user-2',
    userName: '设计小张',
    avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
    title: 'AI 头像生成 API 接入咨询',
    description: '希望接入高质量 AI 头像生成能力，单价敏感，日均 1w+ 调用。',
    type: '2',
    category: 'aiDrawing',
    status: 2,
    viewCount: 86,
    commentCount: 5,
    createTime: new Date(Date.now() - 86400000 * 5).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 100003,
    userId: 'demo-user-3',
    userName: '前端老王',
    avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
    title: 'AI 代码助手私有化部署需求',
    description: '团队 30+ 人，希望私有化部署 AI 代码助手以保障代码安全，需要支持主流 IDE。',
    type: '1',
    category: 'aiCoding',
    status: 1,
    viewCount: 312,
    commentCount: 28,
    createTime: new Date(Date.now() - 86400000 * 7).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  {
    id: 100004,
    userId: 'demo-user-4',
    userName: '运营Anna',
    avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
    title: '短视频脚本批量生成工具',
    description: '需要 AI 自动生成抖音/小红书短视频脚本，包含标题、封面建议与分镜。',
    type: '2',
    category: 'aiWriting',
    status: 2,
    viewCount: 64,
    commentCount: 3,
    createTime: new Date(Date.now() - 86400000 * 1).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    id: 100005,
    userId: 'demo-user-5',
    userName: '创业Tom',
    avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
    title: 'AI 数字人视频生成方案',
    description: '需要 AI 数字人讲解视频生成能力，目标单条 1 分钟内，支持中英双语。',
    type: '1',
    category: 'aiVideo',
    status: 2,
    viewCount: 201,
    commentCount: 17,
    createTime: new Date(Date.now() - 86400000 * 3).toISOString(),
    updateTime: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
]

/** 需求评论（待后端提供接口后对齐字段名） */
export interface DemandComment {
  id: string
  demandId: string
  userId: string
  userName: string
  avatar: string
  content: string
  parentId?: string
  replyTo?: string
  likeCount: number
  isLiked?: boolean
  createTime: string
  replies?: DemandComment[]
}

/**
 * 获取需求列表 - 路径、参数、响应字段与后端 GET /plaza/demands/list 一致
 * 后端参数：page, pageSize, category, status(integer 1-已完成 2-进行中)
 */
export async function getDemandsList(
  params: PlazaDemandsListParams
): Promise<ApiResponse<BackendPageResult<PlazaDemand>>> {
  try {
    const query: Record<string, string | number | undefined> = {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      category: params.category,
      status: params.status,
      keyword: params.keyword,
    }
    const response = await request.get(API_ENDPOINTS.plaza.list, { params: query })
    const raw = response.data as { code?: number; msg?: string; data?: BackendPageResult<PlazaDemand> } | undefined
    const payload = raw?.data
    return {
      code: raw?.code ?? 200,
      success: (raw?.code ?? 200) === 200,
      message: raw?.msg ?? t('api.xuqiu.获取成功'),
      data: payload ?? { list: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    // 检查是否是未登录错误
    const errorMessage = error instanceof Error ? error.message : String(error)
    const status = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status
      : undefined
    const isNotLoggedInError =
      !status && (
        errorMessage.includes('未登录') ||
        errorMessage.includes('请先登录') ||
        errorMessage.includes('not logged in')
      )

    // 未登录时静默处理，不记录错误日志
    if (!isNotLoggedInError) {
      logger.error('[Xuqiu] Failed to get requirement list:', error)
    }

    // 500 错误或网络错误时：自动 fallback 到本地 mock 兜底数据，避免页面空白
    if (status !== 401 && !isNotLoggedInError) {
      const filtered = filterMockDemands(params)
      logger.warn('[Plaza] Backend unreachable, switched to local demo data')
      return {
        code: 200,
        success: true,
        message: '已切换至本地演示数据',
        data: {
          list: filtered,
          total: filtered.length,
          page: params.page ?? 1,
          pageSize: params.pageSize ?? 20,
          totalPages: 1,
        },
        timestamp: Date.now(),
      }
    }

    return {
      code: isNotLoggedInError ? 401 : 500,
      success: false,
      message: errorMessage || '获取需求列表失败',
      data: {
        list: [],
        total: 0,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        totalPages: 0,
      },
      timestamp: Date.now(),
    }
  }
}

/** 本地 mock 过滤：按 status / category / keyword 简单匹配 */
function filterMockDemands(params: PlazaDemandsListParams): PlazaDemand[] {
  let list = [...MOCK_DEMANDS]
  if (params.status !== undefined) list = list.filter(d => d.status === params.status)
  if (params.category) list = list.filter(d => d.type === params.category || d.category === params.category)
  if (params.keyword) {
    const kw = params.keyword.toLowerCase()
    list = list.filter(d => d.title.toLowerCase().includes(kw) || d.description.toLowerCase().includes(kw))
  }
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  return list.slice((page - 1) * pageSize, page * pageSize)
}

/**
 * 发布需求 - 路径、请求体与后端 POST /plaza/demands 一致（CreatePlazaDemandRequest）
 */
export async function createDemand(data: CreatePlazaDemandRequest): Promise<ApiResponse<PlazaDemand>> {
  try {
    const response = await request.post(API_ENDPOINTS.plaza.create, data)
    const raw = response.data as { code?: number; msg?: string; data?: PlazaDemand } | undefined
    const payload = raw?.data
    return {
      code: raw?.code ?? 200,
      success: (raw?.code ?? 200) === 200,
      message: raw?.msg ?? t('api.xuqiu.发布成功1'),
      data: payload ?? ({} as PlazaDemand),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '发布失败',
      data: {} as PlazaDemand,
      timestamp: Date.now(),
    }
  }
}

/**
 * 批量发布需求 - 仅当后端提供 /plaza/demands/batch 时使用，请求体与后端一致
 */
export async function batchCreateDemands(
  demands: CreatePlazaDemandRequest[]
): Promise<ApiResponse<PlazaDemand[]>> {
  try {
    const response = await request.post(API_ENDPOINTS.plaza.batch, demands)
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.批量发布成功2'),
      data: (response.data as PlazaDemand[]) || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to batch publish requirements:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量发布失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

/**
 * 获取需求详情 - 仅当后端提供 GET /plaza/demands/{id} 时使用，响应与 PlazaDemand 一致
 */
export async function getDemandDetail(id: string): Promise<ApiResponse<PlazaDemand>> {
  try {
    const response = await request.get(API_ENDPOINTS.plaza.detail.replace('{id}', String(id)))
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.获取成功3'),
      data: (response.data as PlazaDemand) || ({} as PlazaDemand),
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取需求详情失败',
      data: {} as PlazaDemand,
      timestamp: Date.now(),
    }
  }
}

// 更新需求状态
export async function updateDemandStatus(
  id: string,
  status: string
): Promise<ApiResponse<boolean>> {
  try {
    const _response = await request.put(API_ENDPOINTS.plaza.detail.replace('{id}', String(id)) + '/status', {
      status,
    })
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.更新成功4'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to update requirement status:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '更新失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function likeDemand(demandId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.post(API_ENDPOINTS.plaza.detail.replace('{id}', demandId) + '/like', {
      isLike: true,
    })
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.点赞成功5'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to like requirement:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '点赞失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function unlikeDemand(demandId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.post(API_ENDPOINTS.plaza.detail.replace('{id}', demandId) + '/like', {
      isLike: false,
    })
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.取消点赞成功6'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to unlike requirement:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消点赞失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function collectDemand(
  demandId: string,
  demandTitle?: string
): Promise<ApiResponse<boolean>> {
  try {
    const response = await request.post<
      ApiResponse<{
        id: string
        type: string
        resourceId: string
        resourceName?: string
        createdAt: Date
      }>
    >('/api/ai/favorites', {
      type: 'demand',
      resourceId: demandId,
      resourceName: demandTitle,
      resourceMetadata: {
        source: 'plaza',
        demandId,
      },
    })

    if (response.data.code === 200) {
      return {
        code: 200,
        success: true,
        message: t('api.xuqiu.收藏成功7'),
        data: true,
        timestamp: Date.now(),
      }
    } else {
      return {
        code: response.data.code || 500,
        success: false,
        message: (response.data as { msg?: string }).msg || '收藏失败',
        data: false,
        timestamp: Date.now(),
      }
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to favorite requirement:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '收藏失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function uncollectDemand(demandId: string): Promise<ApiResponse<boolean>> {
  try {
    const response = await request.delete<ApiResponse<null>>(
      `/api/ai/favorites/demand/${demandId}`
    )

    if (response.data.code === 200) {
      return {
        code: 200,
        success: true,
        message: t('api.xuqiu.取消收藏成功8'),
        data: true,
        timestamp: Date.now(),
      }
    } else {
      return {
        code: response.data.code || 500,
        success: false,
        message: (response.data as { msg?: string }).msg || '取消收藏失败',
        data: false,
        timestamp: Date.now(),
      }
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to unfavorite requirement:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消收藏失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function followDemandUser(userId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.post(API_ENDPOINTS.plaza.userFollow.replace('{userId}', userId))
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.关注成功9'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to follow requirement user:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '关注失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function unfollowDemandUser(userId: string): Promise<ApiResponse<boolean>> {
  try {
    await request.delete(API_ENDPOINTS.plaza.userFollow.replace('{userId}', userId))
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.取消关注成功10'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to unfollow requirement user:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消关注失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

export async function getDemandComments(
  demandId: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginationResponse<DemandComment>>> {
  try {
    const response = await request.get(API_ENDPOINTS.plaza.detail.replace('{id}', demandId) + '/comments', {
      params,
    })
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.获取成功11'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to get requirement comments:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取评论失败',
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

export async function createDemandComment(data: {
  demandId: string
  content: string
  parentId?: string
}): Promise<ApiResponse<DemandComment>> {
  try {
    const response = await request.post(API_ENDPOINTS.plaza.detail.replace('{id}', data.demandId) + '/comments', {
      content: data.content,
      parentId: data.parentId,
    })
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.评论成功12'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to create requirement comment:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '评论失败',
      data: {} as DemandComment,
      timestamp: Date.now(),
    }
  }
}

export async function shareDemand(demandId: string): Promise<ApiResponse<{ shareUrl: string }>> {
  try {
    const response = await request.post(API_ENDPOINTS.plaza.detail.replace('{id}', demandId) + '/share')
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.分享成功13'),
      data: response.data || { shareUrl: '' },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to share requirement:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '分享失败',
      data: { shareUrl: '' },
      timestamp: Date.now(),
    }
  }
}

/**
 * 点赞评论
 */
export async function likeComment(commentId: string): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> {
  try {
    const response = await request.post(API_ENDPOINTS.plaza.commentLike.replace('{commentId}', commentId))
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.点赞成功14'),
      data: response.data || { liked: true, likeCount: 0 },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to like comment:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '点赞失败',
      data: { liked: false, likeCount: 0 },
      timestamp: Date.now(),
    }
  }
}

/**
 * 取消点赞评论
 */
export async function unlikeComment(commentId: string): Promise<ApiResponse<{ liked: boolean; likeCount: number }>> {
  try {
    const response = await request.post(API_ENDPOINTS.plaza.commentUnlike.replace('{commentId}', commentId))
    return {
      code: 200,
      success: true,
      message: t('api.xuqiu.取消点赞成功15'),
      data: response.data || { liked: false, likeCount: 0 },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    logger.error('[Xuqiu] Failed to unlike comment:', error)
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消点赞失败',
      data: { liked: false, likeCount: 0 },
      timestamp: Date.now(),
    }
  }
}
