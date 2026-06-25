/**
 * AI创作社区发布功能
 *
 * @description 连通首页AI对话窗与社区发布功能
 * 允许用户将AI生成的内容直接发布到社区
 */
import { ref, computed, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import type { PublishCreationParams, ContentType, AISource } from '@/api/ai/ai/ai-community'

/** 发布预填数据 */
interface PublishPrefillData extends Partial<PublishCreationParams> {
  /** 来源会话ID */
  conversationId?: string
  /** 来源消息ID */
  messageId?: string
}

// 全局状态（单例模式）
const prefillData = ref<PublishPrefillData | null>(null)

/**
 * AI创作社区发布 Composable
 */
export function useCommunityPublish() {
  const router = useRouter()

  /**
   * 设置发布预填数据并跳转到社区页面
   * 用于从AI对话窗发布内容
   */
  const publishToCommnity = (data: PublishPrefillData) => {
    prefillData.value = data
    void router.push('/ai-community')
  }

  /**
   * 从生成的图片发布
   */
  const publishImage = (options: {
    imageUrl: string
    title?: string
    prompt?: string
    aiSource?: AISource
    aiModelName?: string
  }) => {
    publishToCommnity({
      type: 'image',
      title: options.title || 'AI生成图片',
      contentUrl: options.imageUrl,
      prompt: options.prompt,
      aiSource: options.aiSource || 'ihui-ai',
      aiModelName: options.aiModelName,
    })
  }

  /**
   * 从生成的视频发布
   */
  const publishVideo = (options: {
    videoUrl: string
    coverUrl?: string
    title?: string
    prompt?: string
    aiSource?: AISource
    aiModelName?: string
  }) => {
    publishToCommnity({
      type: 'video',
      title: options.title || 'AI生成视频',
      contentUrl: options.videoUrl,
      coverUrl: options.coverUrl,
      prompt: options.prompt,
      aiSource: options.aiSource || 'ihui-ai',
      aiModelName: options.aiModelName,
    })
  }

  /**
   * 从生成的音频/音乐发布
   */
  const publishAudio = (options: {
    audioUrl: string
    coverUrl?: string
    title?: string
    prompt?: string
    aiSource?: AISource
    aiModelName?: string
    isMusic?: boolean
  }) => {
    publishToCommnity({
      type: options.isMusic ? 'music' : 'audio',
      title: options.title || (options.isMusic ? 'AI生成音乐' : 'AI生成音频'),
      contentUrl: options.audioUrl,
      coverUrl: options.coverUrl,
      prompt: options.prompt,
      aiSource: options.aiSource || 'ihui-ai',
      aiModelName: options.aiModelName,
    })
  }

  /**
   * 从生成的文章发布
   */
  const publishArticle = (options: {
    content: string
    title?: string
    prompt?: string
    aiSource?: AISource
    aiModelName?: string
  }) => {
    publishToCommnity({
      type: 'article',
      title: options.title || 'AI生成文章',
      description: options.content,
      contentUrl: '', // 文章内容在 description 中
      prompt: options.prompt,
      aiSource: options.aiSource || 'ihui-ai',
      aiModelName: options.aiModelName,
    })
  }

  /**
   * 从生成的代码发布
   */
  const publishCode = (options: {
    code: string
    title?: string
    language?: string
    prompt?: string
    aiSource?: AISource
    aiModelName?: string
  }) => {
    publishToCommnity({
      type: 'code',
      title: options.title || `AI生成代码${options.language ? ` (${options.language})` : ''}`,
      description: options.code,
      contentUrl: '', // 代码内容在 description 中
      prompt: options.prompt,
      aiSource: options.aiSource || 'ihui-ai',
      aiModelName: options.aiModelName,
      tags: options.language ? [options.language] : [],
    })
  }

  /**
   * 通用发布方法
   */
  const publish = (type: ContentType, data: Omit<PublishPrefillData, 'type'>) => {
    publishToCommnity({ type, ...data })
  }

  /**
   * 清除预填数据
   */
  const clearPrefillData = () => {
    prefillData.value = null
  }

  /**
   * 检查是否有预填数据
   */
  const hasPrefillData = () => !!prefillData.value

  return {
    /** 发布预填数据（只读） */
    publishPrefillData: computed(() => prefillData.value) as ComputedRef<PublishPrefillData | null>,

    /** 发布到社区 */
    publishToCommnity,

    /** 发布图片 */
    publishImage,

    /** 发布视频 */
    publishVideo,

    /** 发布音频/音乐 */
    publishAudio,

    /** 发布文章 */
    publishArticle,

    /** 发布代码 */
    publishCode,

    /** 通用发布 */
    publish,

    /** 清除预填数据 */
    clearPrefillData,

    /** 检查是否有预填数据 */
    hasPrefillData,
  }
}

/**
 * 导出类型
 */
export type { PublishPrefillData }
