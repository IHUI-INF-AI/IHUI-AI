/**
 * AI创作社区 API
 *
 * @description 提供AI创作内容的CRUD操作、互动功能、外部内容聚合
 */
import request from '@/utils/request'
import { t } from '@/utils/i18n'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** 分页数据接口 */
export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============ 类型定义 ============

/** 内容类型枚举 */
export type ContentType = 'image' | 'video' | 'audio' | 'music' | 'article' | 'code' | 'model3d'

/** AI模型/平台来源 */
export type AISource =
  | 'midjourney' | 'stable-diffusion' | 'dall-e' | 'flux'  // 图片
  | 'sora' | 'runway' | 'pika' | 'kling'                    // 视频
  | 'suno' | 'udio' | 'elevenlabs'                          // 音乐/音频
  | 'gpt' | 'claude' | 'gemini' | 'qwen' | 'doubao'         // 文章
  | 'cursor' | 'copilot' | 'codegeex'                       // 代码
  | 'ihui-ai'                                               // 本平台
  | 'other'

/** 创作者信息 */
export interface Creator {
  id: string
  nickname: string
  avatar: string
  isVerified?: boolean
  followersCount?: number
  isFollowing?: boolean
}

/** AI创作内容 */
export interface AICreation {
  id: string
  /** 内容类型 */
  type: ContentType
  /** 标题 */
  title: string
  /** 描述/正文 */
  description: string
  /** 封面图URL */
  coverUrl: string
  /** 内容URL（图片/视频/音频地址） */
  contentUrl: string
  /** 内容预览URLs（多图/多版本） */
  previewUrls?: string[]
  /** 使用的AI模型/平台 */
  aiSource: AISource
  /** AI模型名称 */
  aiModelName?: string
  /** 使用的提示词 */
  prompt?: string
  /** 生成参数 */
  generationParams?: Record<string, unknown>
  /** 标签 */
  tags: string[]
  /** 创作者 */
  creator: Creator
  /** 点赞数 */
  likesCount: number
  /** 收藏数 */
  favoritesCount: number
  /** 评论数 */
  commentsCount: number
  /** 浏览数 */
  viewsCount: number
  /** 当前用户是否已点赞 */
  isLiked?: boolean
  /** 当前用户是否已收藏 */
  isFavorited?: boolean
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 是否为外部聚合内容 */
  isExternal?: boolean
  /** 外部来源URL */
  externalUrl?: string
}

/** 评论 */
export interface Comment {
  id: string
  content: string
  user: Creator
  createdAt: string
  likesCount: number
  isLiked?: boolean
  replies?: Comment[]
}

/** 获取创作列表参数 */
export interface GetCreationsParams {
  page?: number
  pageSize?: number
  type?: ContentType | 'all'
  aiSource?: AISource
  tags?: string[]
  search?: string
  sort?: 'latest' | 'popular' | 'trending'
  userId?: string
}

/** 发布创作参数 */
export interface PublishCreationParams {
  type: ContentType
  title: string
  description: string
  coverUrl?: string
  contentUrl: string
  previewUrls?: string[]
  aiSource: AISource
  aiModelName?: string
  prompt?: string
  generationParams?: Record<string, unknown>
  tags?: string[]
}

// ============ 模拟数据生成 ============

/** 生成模拟创作数据 */
const generateMockCreations = (count: number, type?: ContentType): AICreation[] => {
  const types: ContentType[] = ['image', 'video', 'audio', 'music', 'article', 'code']
  const aiSources: Record<ContentType, AISource[]> = {
    image: ['midjourney', 'stable-diffusion', 'dall-e', 'flux'],
    video: ['sora', 'runway', 'pika', 'kling'],
    audio: ['elevenlabs', 'ihui-ai'],
    music: ['suno', 'udio'],
    article: ['gpt', 'claude', 'gemini', 'qwen', 'doubao'],
    code: ['cursor', 'copilot', 'codegeex'],
    model3d: ['other'],
  }

  const imageTitles = [
    '赛博朋克城市夜景', '梦幻森林精灵', '未来科技概念车', '水墨山水画',
    '宇宙星系壮观景象', '蒸汽朋克机械鸟', '水下古城遗迹', '极光下的冰川',
    '魔法城堡日落', '机械龙飞翔', '东方古风仕女', '抽象艺术构成',
  ]

  const videoTitles = [
    'AI生成的科幻短片', '虚拟偶像舞蹈MV', '产品3D动画展示', '自然风光延时摄影',
    '概念艺术动画', '游戏CG预告片', '音乐可视化动效', '建筑漫游动画',
  ]

  const musicTitles = [
    '电子舞曲 - 霓虹之夜', 'Lo-Fi Hip Hop 学习BGM', '史诗交响乐 - 英雄归来',
    '轻音乐 - 午后咖啡', '摇滚乐 - 追逐梦想', '古风音乐 - 长安月',
  ]

  const articleTitles = [
    'AI时代的创意写作指南', '如何用AI提升工作效率', '未来科技趋势预测',
    '深度学习入门教程', 'AI绘画提示词技巧大全', '智能家居完整方案',
  ]

  const codeTitles = [
    'React组件库源码', 'Python数据分析脚本', 'Vue3 Composable工具集',
    'Node.js API服务框架', 'TypeScript工具函数', 'CSS动画效果合集',
  ]

  const prompts = [
    'A cyberpunk city at night with neon lights, flying cars, and holographic advertisements, ultra detailed, 8k',
    'Enchanted forest with glowing mushrooms and fairy creatures, magical atmosphere, volumetric lighting',
    'Futuristic concept car design, sleek metallic body, holographic display, studio lighting',
    'Traditional Chinese ink painting style, misty mountains, flowing river, minimalist composition',
    'Deep space galaxy with colorful nebula, billions of stars, cosmic dust, astronomical photography',
  ]

  const tags = [
    ['科幻', 'Midjourney', '概念艺术'],
    ['奇幻', '数字艺术', '高清'],
    ['未来', '设计', '3D渲染'],
    ['国风', '水墨', '意境'],
    ['宇宙', '摄影', '壮观'],
    ['蒸汽朋克', '机械', '创意'],
    ['海底', '神秘', '探索'],
    ['自然', '风光', '梦幻'],
  ]

  const avatars = [
    'https://randomuser.me/api/portraits/men/32.jpg',
    'https://randomuser.me/api/portraits/women/44.jpg',
    'https://randomuser.me/api/portraits/men/67.jpg',
    'https://randomuser.me/api/portraits/women/68.jpg',
    'https://randomuser.me/api/portraits/men/75.jpg',
  ]

  const nicknames = ['创意设计师', 'AI艺术家', '数字梦想家', '未来探索者', '科技爱好者', '灵感收集者']

  // 本地占位图（避免外部图片服务不可用）
  const getImageUrl = (_seed: number, _w = 800, _h = 600) =>
    '/images/common/empty.svg'

  return Array.from({ length: count }, (_, i) => {
    const contentType = type || types[i % types.length]
    const sourceList = aiSources[contentType]
    const aiSource = sourceList[Math.floor(Math.random() * sourceList.length)]

    let title: string
    let coverUrl: string
    let contentUrl: string

    switch (contentType) {
      case 'image':
        title = imageTitles[i % imageTitles.length]
        coverUrl = getImageUrl(i + 100, 800, 800)
        contentUrl = getImageUrl(i + 100, 1920, 1080)
        break
      case 'video':
        title = videoTitles[i % videoTitles.length]
        coverUrl = getImageUrl(i + 200, 1280, 720)
        contentUrl = 'https://www.w3schools.com/html/mov_bbb.mp4' // 示例视频
        break
      case 'audio':
      case 'music':
        title = musicTitles[i % musicTitles.length]
        coverUrl = getImageUrl(i + 300, 500, 500)
        contentUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // 示例音频
        break
      case 'article':
        title = articleTitles[i % articleTitles.length]
        coverUrl = getImageUrl(i + 400, 1200, 630)
        contentUrl = '' // 文章内容器 description 中
        break
      case 'code':
        title = codeTitles[i % codeTitles.length]
        coverUrl = getImageUrl(i + 500, 1200, 630)
        contentUrl = '' // 代码内容器 description 中
        break
      default:
        title = `AI创作 ${i + 1}`
        coverUrl = getImageUrl(i, 800, 600)
        contentUrl = coverUrl
    }

    const creatorIdx = i % nicknames.length
    const now = new Date()
    const createdAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000) // 随机30天内

    return {
      id: `creation-${Date.now()}-${i}`,
      type: contentType,
      title,
      description: contentType === 'article'
        ? `这是一篇由AI生成的高质量文章。${title}是当前最热门的话题之一，本文将深入探讨相关的技术原理、应用场景和未来发展趋势...`
        : contentType === 'code'
        ? `// AI生成的代码示例\nfunction example() {\n  console.log('Hello AI!');\n  return { success: true };\n}`
        : `使用${aiSource}生成的${contentType === 'image' ? '图片' : contentType === 'video' ? '视频' : '作品'}，灵感来源于对未来科技与艺术结合的想象。`,
      coverUrl,
      contentUrl,
      previewUrls: contentType === 'image'
        ? [getImageUrl(i + 100, 800, 800), getImageUrl(i + 101, 800, 800), getImageUrl(i + 102, 800, 800)]
        : undefined,
      aiSource,
      aiModelName: aiSource === 'midjourney' ? 'Midjourney V6'
        : aiSource === 'stable-diffusion' ? 'SDXL 1.0'
        : aiSource === 'dall-e' ? 'DALL-E 3'
        : aiSource === 'gpt' ? 'GPT-4o'
        : aiSource === 'claude' ? 'Claude 3.5'
        : aiSource.toUpperCase(),
      prompt: prompts[i % prompts.length],
      tags: tags[i % tags.length],
      creator: {
        id: `user-${creatorIdx}`,
        nickname: nicknames[creatorIdx],
        avatar: avatars[creatorIdx],
        isVerified: Math.random() > 0.7,
        followersCount: Math.floor(Math.random() * 10000),
      },
      likesCount: Math.floor(Math.random() * 5000),
      favoritesCount: Math.floor(Math.random() * 2000),
      commentsCount: Math.floor(Math.random() * 500),
      viewsCount: Math.floor(Math.random() * 50000),
      isLiked: Math.random() > 0.8,
      isFavorited: Math.random() > 0.9,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      isExternal: Math.random() > 0.7,
      externalUrl: Math.random() > 0.7 ? 'https://example.com/original' : undefined,
    }
  })
}

// ============ API 函数 ============

/**
 * 获取AI创作列表
 */
export const getCreations = async (
  params: GetCreationsParams = {}
): Promise<ApiResponse<PaginatedData<AICreation>>> => {
  const { page = 1, pageSize = 20, type = 'all', sort = 'latest', search } = params

  // 开发环境返回模拟数据
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 500)) // 模拟网络延迟

    let mockData = generateMockCreations(100)

    // 类型筛选
    if (type !== 'all') {
      mockData = mockData.filter(item => item.type === type)
    }

    // 搜索筛选
    if (search) {
      const keyword = search.toLowerCase()
      mockData = mockData.filter(item =>
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword) ||
        item.tags.some(tag => tag.toLowerCase().includes(keyword))
      )
    }

    // 排序
    if (sort === 'popular') {
      mockData.sort((a, b) => b.likesCount - a.likesCount)
    } else if (sort === 'trending') {
      mockData.sort((a, b) => b.viewsCount - a.viewsCount)
    }

    // 分页
    const start = (page - 1) * pageSize
    const end = start + pageSize
    const paginatedData = mockData.slice(start, end)

    return {
      code: 200,
      success: true,
      message: 'ok',
      data: {
        list: paginatedData,
        total: mockData.length,
        page,
        pageSize,
        totalPages: Math.ceil(mockData.length / pageSize),
      },
      timestamp: Date.now(),
    }
  }

  // 生产环境调用真实API
  const response = await request.get<PaginatedData<AICreation>>('/community/creations', { params })
  return normalizeApiResponse<PaginatedData<AICreation>>(response)
}

/**
 * 获取创作详情
 */
export const getCreationDetail = async (id: string): Promise<ApiResponse<AICreation>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 300))
    const mockData = generateMockCreations(1)[0]
    mockData.id = id
    return {
      code: 200,
      success: true,
      message: 'ok',
      data: mockData,
      timestamp: Date.now(),
    }
  }

  const response = await request.get<AICreation>(`/community/creations/${id}`)
  return normalizeApiResponse<AICreation>(response)
}

/**
 * 发布创作
 */
export const publishCreation = async (
  params: PublishCreationParams
): Promise<ApiResponse<AICreation>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 800))

    const newCreation: AICreation = {
      id: `creation-${Date.now()}`,
      ...params,
      coverUrl: params.coverUrl || params.contentUrl,
      tags: params.tags || [],
      creator: {
        id: 'current-user',
        nickname: '当前用户',
        avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
        isVerified: false,
      },
      likesCount: 0,
      favoritesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      isLiked: false,
      isFavorited: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return {
      code: 200,
      success: true,
      message: t('api.ai_community.发布成功'),
      data: newCreation,
      timestamp: Date.now(),
    }
  }

  const response = await request.post<AICreation>('/community/creations', params)
  return normalizeApiResponse<AICreation>(response)
}

/**
 * 点赞创作
 */
export const likeCreation = async (id: string): Promise<ApiResponse<{ liked: boolean; count: number }>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      code: 200,
      success: true,
      message: 'ok',
      data: { liked: true, count: Math.floor(Math.random() * 1000) + 1 },
      timestamp: Date.now(),
    }
  }

  const response = await request.post<{ liked: boolean; count: number }>(`/community/creations/${id}/like`)
  return normalizeApiResponse<{ liked: boolean; count: number }>(response)
}

/**
 * 取消点赞
 */
export const unlikeCreation = async (id: string): Promise<ApiResponse<{ liked: boolean; count: number }>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      code: 200,
      success: true,
      message: 'ok',
      data: { liked: false, count: Math.floor(Math.random() * 1000) },
      timestamp: Date.now(),
    }
  }

  const response = await request.delete<{ liked: boolean; count: number }>(`/community/creations/${id}/like`)
  return normalizeApiResponse<{ liked: boolean; count: number }>(response)
}

/**
 * 收藏创作
 */
export const favoriteCreation = async (id: string): Promise<ApiResponse<{ favorited: boolean; count: number }>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      code: 200,
      success: true,
      message: 'ok',
      data: { favorited: true, count: Math.floor(Math.random() * 500) + 1 },
      timestamp: Date.now(),
    }
  }

  const response = await request.post<{ favorited: boolean; count: number }>(`/community/creations/${id}/favorite`)
  return normalizeApiResponse<{ favorited: boolean; count: number }>(response)
}

/**
 * 取消收藏
 */
export const unfavoriteCreation = async (id: string): Promise<ApiResponse<{ favorited: boolean; count: number }>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 200))
    return {
      code: 200,
      success: true,
      message: 'ok',
      data: { favorited: false, count: Math.floor(Math.random() * 500) },
      timestamp: Date.now(),
    }
  }

  const response = await request.delete<{ favorited: boolean; count: number }>(`/community/creations/${id}/favorite`)
  return normalizeApiResponse<{ favorited: boolean; count: number }>(response)
}

/**
 * 获取评论列表
 */
export const getComments = async (
  creationId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<ApiResponse<PaginatedData<Comment>>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 300))

    const mockComments: Comment[] = Array.from({ length: 10 }, (_, i) => ({
      id: `comment-${i}`,
      content: ['太棒了！', '这个效果真的很惊艳', '请问用的什么提示词？', '学到了', '收藏了'][i % 5],
      user: {
        id: `user-${i}`,
        nickname: `用户${i + 1}`,
        avatar: [
          'https://randomuser.me/api/portraits/women/11.jpg',
          'https://randomuser.me/api/portraits/men/12.jpg',
          'https://randomuser.me/api/portraits/women/13.jpg',
          'https://randomuser.me/api/portraits/men/14.jpg',
          'https://randomuser.me/api/portraits/women/15.jpg',
          'https://randomuser.me/api/portraits/men/16.jpg',
          'https://randomuser.me/api/portraits/women/17.jpg',
          'https://randomuser.me/api/portraits/men/18.jpg',
          'https://randomuser.me/api/portraits/women/19.jpg',
          'https://randomuser.me/api/portraits/men/20.jpg',
        ][i],
      },
      createdAt: new Date(Date.now() - i * 3600000).toISOString(),
      likesCount: Math.floor(Math.random() * 50),
      isLiked: false,
    }))

    return {
      code: 200,
      success: true,
      message: 'ok',
      data: {
        list: mockComments,
        total: 10,
        page: params.page || 1,
        pageSize: params.pageSize || 20,
        totalPages: 1,
      },
      timestamp: Date.now(),
    }
  }

  const response = await request.get<PaginatedData<Comment>>(`/community/creations/${creationId}/comments`, { params })
  return normalizeApiResponse<PaginatedData<Comment>>(response)
}

/**
 * 发表评论
 */
export const postComment = async (
  creationId: string,
  content: string
): Promise<ApiResponse<Comment>> => {
  if (import.meta.env.DEV) {
    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      code: 200,
      success: true,
      message: t('api.ai_community.评论成功1'),
      data: {
        id: `comment-${Date.now()}`,
        content,
        user: {
          id: 'current-user',
          nickname: '当前用户',
          avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
        },
        createdAt: new Date().toISOString(),
        likesCount: 0,
        isLiked: false,
      },
      timestamp: Date.now(),
    }
  }

  const response = await request.post<Comment>(`/community/creations/${creationId}/comments`, { content })
  return normalizeApiResponse<Comment>(response)
}

/**
 * 获取热门标签
 */
export const getHotTags = async (): Promise<ApiResponse<string[]>> => {
  if (import.meta.env.DEV) {
    return {
      code: 200,
      success: true,
      message: 'ok',
      data: ['Midjourney', 'DALL-E', 'Stable Diffusion', 'Suno', 'GPT-4', 'Claude', '科幻', '国风', '概念艺术', '音乐', '视频', '代码'],
      timestamp: Date.now(),
    }
  }

  const response = await request.get<string[]>('/community/tags/hot')
  return normalizeApiResponse<string[]>(response)
}

/**
 * 获取热门创作者
 */
export const getHotCreators = async (): Promise<ApiResponse<Creator[]>> => {
  if (import.meta.env.DEV) {
    return {
      code: 200,
      success: true,
      message: 'ok',
      // 开发环境使用真实人物头像（randomuser.me 肖像图），禁止卡通/插画头像
      data: [
        { id: '1', nickname: 'AI艺术大师', avatar: 'https://randomuser.me/api/portraits/men/32.jpg', isVerified: true, followersCount: 12500 },
        { id: '2', nickname: '数字梦想家', avatar: 'https://randomuser.me/api/portraits/men/44.jpg', isVerified: true, followersCount: 8900 },
        { id: '3', nickname: '创意工坊', avatar: 'https://randomuser.me/api/portraits/women/56.jpg', isVerified: false, followersCount: 6700 },
        { id: '4', nickname: '未来视觉', avatar: 'https://randomuser.me/api/portraits/women/68.jpg', isVerified: true, followersCount: 5400 },
        { id: '5', nickname: '灵感星球', avatar: 'https://randomuser.me/api/portraits/men/12.jpg', isVerified: false, followersCount: 4200 },
      ],
      timestamp: Date.now(),
    }
  }

  const response = await request.get<Creator[]>('/community/creators/hot')
  return normalizeApiResponse<Creator[]>(response)
}
