import { t } from '@/utils/i18n'

import request from '@/utils/request'
import { isDemoMode } from '@/utils/envUtils'
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types'
import { COMMUNITY_PATHS, API_V1_PATHS } from '@/config/backend-paths'

// 社区动态接口
export interface CommunityPost {
  id: string
  userId: string
  username: string
  userAvatar: string
  content: string
  images?: string[]
  videos?: string[]
  type: 'text' | 'image' | 'video' | 'article'
  tags?: string[]
  likeCount: number
  commentCount: number
  shareCount: number
  viewCount: number
  isLiked?: boolean
  isFavorited?: boolean
  createTime: string
  updateTime?: string
}

// 评论接口
export interface Comment {
  id: string
  postId: string
  userId: string
  username: string
  userAvatar: string
  content: string
  parentId?: string
  replyTo?: string
  likeCount: number
  isLiked?: boolean
  createTime: string
  replies?: Comment[]
}

// 话题标签接口
export interface Topic {
  id: string
  name: string
  description?: string
  icon?: string
  postCount: number
  followerCount: number
  isFollowed?: boolean
}

// 获取动态列表
export async function getPostsList(
  params: PaginationParams & {
    topicId?: string
    userId?: string
    type?: string
    sortBy?: string
  }
): Promise<ApiResponse<PaginationResponse<CommunityPost>>> {
  try {
    // 演示/测试模式：返回本地mock，避免后端 500 造成页面错误
    if (isDemoMode()) {
      const mockList: CommunityPost[] = Array.from({ length: 5 }).map((_, idx) => ({
        id: `post-${idx + 1}`,
        userId: `user-${idx + 1}`,
        username: `演示用户${idx + 1}`,
        userAvatar: '/images/common/userIcon.svg',
        content: `这是一条演示动态内容 #${idx + 1}`,
        type: 'text',
        likeCount: 10 + idx,
        commentCount: 3 + idx,
        shareCount: 1,
        viewCount: 100 + idx * 7,
        tags: ['演示', '社区'],
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      }))
      return {
        code: 200,
        success: true,
        message: t('api.community.演示数据'),
        data: {
          list: mockList,
          pagination: {
            page: params.page || 1,
            pageSize: params.pageSize || 20,
            total: mockList.length,
            totalPages: 1,
          },
        },
        timestamp: Date.now(),
      }
    }

    // 调用Java后端接口: /community/posts/list
    const response = await request.get(COMMUNITY_PATHS.posts.list, { params })
    return {
      code: 200,
      success: true,
      message: t('api.community.获取成功1'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取动态列表失败',
      data: {
        list: [],
        pagination: {
          page: params.page || 1,
          pageSize: params.pageSize || 20,
          total: 0,
          totalPages: 0,
        },
      },
      timestamp: Date.now(),
    }
  }
}

// 发布动态
export async function createPost(data: {
  content: string
  images?: string[]
  videos?: string[]
  type: 'text' | 'image' | 'video' | 'article'
  tags?: string[]
  topicId?: string
}): Promise<ApiResponse<CommunityPost>> {
  try {
    // 调用Java后端接口: /community/posts
    const response = await request.post(COMMUNITY_PATHS.posts.create, data)
    return {
      code: 200,
      success: true,
      message: t('api.community.发布成功2'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '发布失败',
      data: {} as CommunityPost,
      timestamp: Date.now(),
    }
  }
}

// 批量发布动态
export async function batchCreatePosts(
  posts: Array<{
    content: string
    images?: string[]
    videos?: string[]
    type: 'text' | 'image' | 'video' | 'article'
    tags?: string[]
    topicId?: string
  }>
): Promise<ApiResponse<CommunityPost[]>> {
  try {
    // 调用Java后端接口: /community/posts/batch
    const response = await request.post(COMMUNITY_PATHS.posts.batch, posts)
    return {
      code: 200,
      success: true,
      message: t('api.community.批量发布成功3'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '批量发布失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取动态详情
export async function getPostDetail(
  id: string
): Promise<ApiResponse<CommunityPost & { comments: Comment[] }>> {
  try {
    // 调用Java后端接口: /community/posts/{id}
    const response = await request.get(COMMUNITY_PATHS.posts.byId(id))
    return {
      code: 200,
      success: true,
      message: t('api.community.获取成功4'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取动态详情失败',
      data: {} as CommunityPost & { comments: Comment[] },
      timestamp: Date.now(),
    }
  }
}

// 点赞动态
export async function likePost(postId: string): Promise<ApiResponse<boolean>> {
  try {
    // 调用Java后端接口: /community/posts/{id}/like
    await request.post(COMMUNITY_PATHS.posts.like(postId), {
      isLike: true,
    })
    return {
      code: 200,
      success: true,
      message: t('api.community.点赞成功5'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '点赞失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 取消点赞
export async function unlikePost(postId: string): Promise<ApiResponse<boolean>> {
  try {
    // 调用Java后端接口: /community/posts/{id}/like (使用isLike: false)
    await request.post(COMMUNITY_PATHS.posts.like(postId), {
      isLike: false,
    })
    return {
      code: 200,
      success: true,
      message: t('api.community.取消点赞成功6'),
      data: true,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消点赞失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 收藏动态
export async function favoritePost(
  postId: string,
  postName?: string
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
      type: 'other', // 社区动态使用 'other' 类型
      resourceId: postId,
      resourceName: postName,
      resourceMetadata: {
        source: 'community',
        postId,
      },
    })

    if (response.data.code === 200) {
      return {
        code: 200,
        success: true,
        message: t('api.community.收藏成功7'),
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
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '收藏失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 取消收藏
export async function unfavoritePost(postId: string): Promise<ApiResponse<boolean>> {
  try {
    const response = await request.delete<ApiResponse<null>>(`/api/ai/favorites/other/${postId}`)

    if (response.data.code === 200) {
      return {
        code: 200,
        success: true,
        message: t('api.community.取消收藏成功8'),
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
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '取消收藏失败',
      data: false,
      timestamp: Date.now(),
    }
  }
}

// 获取评论列表
export async function getComments(
  postId: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginationResponse<Comment>>> {
  try {
    // 调用Java后端接口: /community/posts/{id}/comments
    const response = await request.get(COMMUNITY_PATHS.posts.comments(postId), {
      params,
    })
    return {
      code: 200,
      success: true,
      message: t('api.community.获取成功9'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
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

// 发表评论
export async function createComment(data: {
  postId: string
  content: string
  parentId?: string
}): Promise<ApiResponse<Comment>> {
  try {
    // 调用Java后端接口: /community/posts/{id}/comments
    const response = await request.post(COMMUNITY_PATHS.posts.comments(data.postId), {
      content: data.content,
      parentId: data.parentId,
    })
    return {
      code: 200,
      success: true,
      message: t('api.community.评论成功10'),
      data: response.data || response,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '评论失败',
      data: {} as Comment,
      timestamp: Date.now(),
    }
  }
}

// 获取热门话题
export async function getHotTopics(limit?: number): Promise<ApiResponse<Topic[]>> {
  try {
    if (isDemoMode()) {
      const list: Topic[] = [
        {
          id: 't1',
          name: 'AI 产品',
          description: t('text.community.AI产品讨论15'),
          icon: '',
          postCount: 120,
          followerCount: 80,
        },
        {
          id: 't2',
          name: '前端开发',
          description: t('text.community.前端与工程化16'),
          icon: '',
          postCount: 90,
          followerCount: 60,
        },
        {
          id: 't3',
          name: '模型调优',
          description: t('text.community.大模型调优经验17'),
          icon: '',
          postCount: 75,
          followerCount: 50,
        },
      ]
      return {
        code: 200,
        success: true,
        message: t('api.community.演示数据11'),
        data: list,
        timestamp: Date.now(),
      }
    }

    // 调用Java后端接口: /community/topics/list
    const response = await request.get(COMMUNITY_PATHS.topics.list, {
      params: { limit },
    })
    return {
      code: 200,
      success: true,
      message: t('api.community.获取成功12'),
      data: response.data || [],
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取话题失败',
      data: [],
      timestamp: Date.now(),
    }
  }
}

// 获取资讯列表（与小程序端一致）
export async function getNewsList(params: {
  category_id?: number
  pageNum?: number
  pageSize?: number
  orderByColumn?: string
}): Promise<
  ApiResponse<{
    total: number
    list: Array<{
      news_id: number
      title: string
      summary?: string
      content?: string
      publish_time?: string
      cover_image?: string
    }>
  }>
> {
  try {
    const response = await request.get(API_V1_PATHS.news.list, { params })
    const raw = response.data || response
    // 兼容多种返回结构：① 直接 { list, total } ② 嵌套 { data: { list, total } } 或 { data: { list, pagination } }（如 mock）③ 后端用 rows/records
    const payload = raw?.data !== undefined && raw?.data !== null ? raw.data : raw
    const list =
      Array.isArray(payload?.list) ? payload.list
      : Array.isArray(payload?.rows) ? payload.rows
      : Array.isArray(payload?.records) ? payload.records
      : Array.isArray(raw?.list) ? raw.list
      : Array.isArray(raw?.rows) ? raw.rows
      : []
    const total =
      (typeof payload?.total === 'number' ? payload.total : null) ??
      (payload?.pagination && typeof payload.pagination.total === 'number' ? payload.pagination.total : null) ??
      (typeof raw?.total === 'number' ? raw.total : null) ??
      (raw?.pagination && typeof raw.pagination.total === 'number' ? raw.pagination.total : null) ??
      0

    // 确保每个新闻都有 summary、cover_image、publish_time、news_id（兼容 mock 的 id/coverImage/publishTime）
    interface NewsItem {
      id?: string
      news_id?: number
      title: string
      summary?: string
      cover_image?: string
      coverImage?: string
      cover?: string
      image_url?: string
      image?: string
      content?: string
      publish_time?: string
      publishTime?: string
      [key: string]: unknown
    }
    const normalizedList = (Array.isArray(list) ? list : []).map((news: NewsItem) => {
      let coverImage = news.cover_image || news.coverImage || news.cover || news.image_url || news.image
      if (!coverImage && news.content) {
        const imgMatch = (news.content as string).match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i)
        if (imgMatch && imgMatch[1]) {
          coverImage = imgMatch[1]
          if (coverImage.startsWith('/')) {
            const baseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin
            coverImage = baseUrl + coverImage
          }
        }
      }
      return {
        ...news,
        news_id: news.news_id ?? (typeof news.id === 'number' ? news.id : 0),
        title: news.title,
        summary: news.summary ||
          (news.content ? (news.content as string).replace(/<[^>]*>/g, '').substring(0, 150) : null) ||
          news.title ||
          '暂无摘要信息',
        content: news.content,
        publish_time: news.publish_time || news.publishTime,
        cover_image: coverImage ?? undefined,
      }
    })

    const data = { total: total || normalizedList.length, list: normalizedList }

    return {
      code: 200,
      success: true,
      message: t('api.community.获取成功13'),
      data,
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    // 检查是否是500错误，如果是则静默返回空数据
    const isServerError = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status === 500
      : false
    
    // 对于500错误，静默返回空数据，不记录错误日志
    if (isServerError) {
      return {
        code: 200,
        success: true,
        message: t('api.community.获取成功14'),
        data: { total: 0, list: [] },
        timestamp: Date.now(),
      }
    }
    
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取资讯失败',
      data: { total: 0, list: [] },
      timestamp: Date.now(),
    }
  }
}

// 获取资讯详情
export async function getNewsDetail(id: string | number): Promise<
  ApiResponse<{
    news_id: number
    title: string
    summary?: string
    content?: string
    publish_time?: string
    cover_image?: string
    author?: string
    views?: number
  }>
> {
  try {
    const response = await request.get(API_V1_PATHS.news.detail(id))
    const raw = response.data || response
    const payload = raw?.data !== undefined && raw?.data !== null ? raw.data : raw
    const news = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
    const coverImage = (news.cover_image as string) || (news.coverImage as string) || (news.cover as string) || ''
    return {
      code: raw?.code ?? 200,
      success: (raw?.code ?? 200) === 200,
      message: raw?.msg ?? t('api.community.获取成功14'),
      data: {
        news_id: (news.news_id as number) ?? (typeof news.id === 'number' ? (news.id as number) : Number(id)),
        title: (news.title as string) || '',
        summary: (news.summary as string) || '',
        content: (news.content as string) || '',
        publish_time: (news.publish_time as string) || (news.publishTime as string) || '',
        cover_image: coverImage,
        author: (news.author as string) || '',
        views: (news.views as number) || 0,
      },
      timestamp: Date.now(),
    }
  } catch (error: unknown) {
    if (isDemoMode()) {
      // 演示模式：返回 mock 详情
      return {
        code: 200,
        success: true,
        message: 'ok',
        data: {
          news_id: Number(id) || 1,
          title: 'AI技术在内容创作领域的应用与未来趋势',
          summary: '本文探讨AI在内容创作中的应用、效率提升与未来发展方向。',
          content: `<div style="font-size:16px;line-height:1.8;color:var(--el-text-color-primary);">
            <p>随着人工智能技术的快速发展，内容创作领域正经历深刻的变革。本文从三个维度分析AI对创作的影响。</p>
            <h3>1. 效率提升</h3>
            <p>AI 工具可以帮助创作者快速生成创意、文案与标题，缩短从构思到成稿的周期。</p>
            <h3>2. 个性化</h3>
            <p>基于用户行为与偏好数据，AI 可以提供更精准的选题与表达建议。</p>
            <h3>3. 协作模式</h3>
            <p>人与 AI 共创的协作流程正在被更多团队采用，编辑与校对环节进一步自动化。</p>
          </div>`,
          publish_time: '2024-03-20 10:30',
          cover_image: '',
          author: 'AI 智汇社',
          views: 1234,
        },
        timestamp: Date.now(),
      }
    }
    // 500 错误静默处理
    const isServerError = error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { status?: number } }).response?.status === 500
      : false
    if (isServerError) {
      return {
        code: 500,
        success: false,
        message: '后端错误',
        data: {
          news_id: 0,
          title: '',
          content: '',
        },
        timestamp: Date.now(),
      }
    }
    return {
      code: 500,
      success: false,
      message: (error instanceof Error ? error.message : String(error)) || '获取资讯详情失败',
      data: {
        news_id: 0,
        title: '',
        content: '',
      },
      timestamp: Date.now(),
    }
  }
}
