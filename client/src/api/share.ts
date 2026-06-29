import { t } from '@/utils/i18n'

/**
 * 分享相关 API
 */

import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'
import { logger } from '@/utils/logger'

// 分享统计
export interface ShareStats {
  totalShares: number // 总分享次数
  shareSources: Record<string, number> // 分享来源统计 { wechat: 10, weibo: 5, ... }
  shareCount: number // 当前内容分享次数
}

// 分享链接生成请求
export interface ShareLinkRequest {
  url: string // 原始URL
  title?: string // 分享标题
  description?: string // 分享描述
  image?: string // 分享图片
  expireTime?: number // 过期时间（秒）
}

// 分享链接生成响应
export interface ShareLinkResponse {
  shortUrl: string // 短链接
  qrCodeUrl: string // 二维码URL
  shareUrl: string // 完整分享URL
  expireTime?: number // 过期时间戳
}

// 分享记录
export interface ShareRecord {
  id: string
  shareType: 'wechat' | 'weibo' | 'qq' | 'link' | 'other'
  shareUrl: string
  shareTime: string
  shareSource?: string
}

// 分享内容（GET /share/content/{shareId} 返回）
export interface ShareContent {
  title: string
  description: string
  image: string
  author: string
  content_type: string
  content_data: string
  created_at?: string
}

// 创建分享请求（POST /share/create）
export interface ShareCreateRequest {
  agent_id?: string
  user_id?: string
  title?: string
  description?: string
  image?: string
  content_type?: string
  content_data?: string
}

// 创建分享响应
export interface ShareCreateResponse {
  share_id: string
  title: string
  description: string
  image: string
  content_type: string
  share_url: string
}

/**
 * 生成分享链接（短链接）
 */
export const generateShareLink = withApiResponseHandler(
  async (data: ShareLinkRequest): Promise<ApiResponse<ShareLinkResponse>> => {
    try {
      logger.info('[Share] Generating share link:', data)
      const response = await request.post<ShareLinkResponse>('/share/generate', {
        url: data.url,
        title: data.title,
        description: data.description,
        image: data.image,
        expire_time: data.expireTime,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Share] Failed to generate share link:', error)
      throw error
    }
  }
)

/**
 * 记录分享事件
 */
export const recordShare = withApiResponseHandler(
  async (data: {
    shareType: ShareRecord['shareType']
    shareUrl: string
    shareSource?: string
    contentId?: string
    contentType?: string
  }): Promise<ApiResponse<{ recorded: boolean }>> => {
    try {
      logger.info('[Share] Recording share event:', data)
      const response = await request.post<{ recorded: boolean }>('/share/record', {
        share_type: data.shareType,
        share_url: data.shareUrl,
        share_source: data.shareSource,
        content_id: data.contentId,
        content_type: data.contentType,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Share] Failed to record share event:', error)
      // 记录失败不影响分享功能，静默处理
      return {
        code: 200,
        success: true,
        message: t('api.share.记录失败但不影响'),
        data: { recorded: false },
        timestamp: Date.now(),
      }
    }
  }
)

/**
 * 获取分享统计
 */
export const getShareStats = withApiResponseHandler(
  async (contentId?: string, contentType?: string): Promise<ApiResponse<ShareStats>> => {
    try {
      const response = await request.get<ShareStats>('/share/stats', {
        params: {
          content_id: contentId,
          content_type: contentType,
        },
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Share] Failed to get share statistics:', error)
      // 返回默认统计
      return {
        code: 200,
        success: true,
        message: t('api.share.获取统计失败返回1'),
        data: {
          totalShares: 0,
          shareSources: {},
          shareCount: 0,
        },
        timestamp: Date.now(),
      }
    }
  }
)

/**
 * 获取微信分享配置（JSSDK）
 */
export const getWechatShareConfig = withApiResponseHandler(
  async (url: string): Promise<ApiResponse<{
    appId: string
    timestamp: number
    nonceStr: string
    signature: string
  }>> => {
    try {
      logger.info('[Share] Getting WeChat share config:', url)
      const response = await request.post<{
        appId: string
        timestamp: number
        nonceStr: string
        signature: string
      }>('/share/wechat/config', {
        url: url || window.location.href,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Share] Failed to get WeChat share config:', error)
      throw error
    }
  }
)

/**
 * 获取分享内容（真实 API 调用）
 * GET /share/content/{shareId}
 */
export const getShareContent = withApiResponseHandler(
  async (shareId: string): Promise<ApiResponse<ShareContent>> => {
    try {
      logger.info('[Share] Getting share content for shareId:', shareId)
      const response = await request.get<ShareContent>(
        `/share/content/${encodeURIComponent(shareId)}`
      )
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Share] Failed to get share content:', error)
      throw error
    }
  }
)

/**
 * 创建分享记录（真实 API 调用）
 * POST /share/create
 */
export const createShare = withApiResponseHandler(
  async (data: ShareCreateRequest): Promise<ApiResponse<ShareCreateResponse>> => {
    try {
      logger.info('[Share] Creating share record:', data)
      const response = await request.post<ShareCreateResponse>('/share/create', {
        agent_id: data.agent_id,
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        image: data.image,
        content_type: data.content_type,
        content_data: data.content_data,
      })
      return normalizeApiResponse(response)
    } catch (error) {
      logger.error('[Share] Failed to create share record:', error)
      throw error
    }
  }
)

// 导出默认对象
export default {
  generateShareLink,
  recordShare,
  getShareStats,
  getWechatShareConfig,
  getShareContent,
  createShare,
}
