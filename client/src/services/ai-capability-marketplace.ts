/**
 * AI 能力市场系统
 * 提供 AI 能力的发现、分享、评价和推荐功能
 */

import { ref } from 'vue'
import type { AICapabilityType } from './unified-ai-orchestrator'

// 能力市场项
export interface CapabilityMarketplaceItem {
  id: string
  name: string
  description: string
  type: AICapabilityType
  capabilityId: string
  author: {
    id: string
    name: string
    avatar?: string
  }
  rating: number
  ratingCount: number
  usageCount: number
  tags: string[]
  category: string
  price?: {
    type: 'free' | 'paid' | 'subscription'
    amount?: number
    currency?: string
  }
  metadata?: {
    latency?: number
    successRate?: number
    cost?: number
    examples?: string[]
    documentation?: string
  }
  createdAt: number
  updatedAt: number
  isPublic: boolean
  isVerified: boolean
}

// 能力评价
export interface CapabilityReview {
  id: string
  capabilityId: string
  userId: string
  userName: string
  userAvatar?: string
  rating: number
  comment: string
  pros?: string[]
  cons?: string[]
  useCase?: string
  createdAt: number
  helpfulCount: number
}

// 能力使用统计
export interface CapabilityUsageStats {
  capabilityId: string
  totalUsers: number
  totalCalls: number
  averageRating: number
  successRate: number
  averageLatency: number
  totalCost: number
  trendingScore: number // 趋势分数
}

/**
 * AI 能力市场系统
 */
export class AICapabilityMarketplace {
  private marketplaceItems = ref<Map<string, CapabilityMarketplaceItem>>(new Map())
  private reviews = ref<Map<string, CapabilityReview[]>>(new Map())
  private usageStats = ref<Map<string, CapabilityUsageStats>>(new Map())

  /**
   * 注册能力到市场
   */
  registerCapability(
    item: Omit<CapabilityMarketplaceItem, 'id' | 'createdAt' | 'updatedAt'>
  ): CapabilityMarketplaceItem {
    const id = `marketplace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    const marketplaceItem: CapabilityMarketplaceItem = {
      ...item,
      id,
      createdAt: now,
      updatedAt: now,
    }

    this.marketplaceItems.value.set(id, marketplaceItem)

    // 初始化使用统计
    this.usageStats.value.set(id, {
      capabilityId: id,
      totalUsers: 0,
      totalCalls: 0,
      averageRating: 0,
      successRate: 0,
      averageLatency: 0,
      totalCost: 0,
      trendingScore: 0,
    })

    return marketplaceItem
  }

  /**
   * 搜索能力
   */
  searchCapabilities(params: {
    keyword?: string
    type?: AICapabilityType
    category?: string
    tags?: string[]
    minRating?: number
    sortBy?: 'rating' | 'usage' | 'trending' | 'newest'
    page?: number
    pageSize?: number
  }): {
    items: CapabilityMarketplaceItem[]
    total: number
    page: number
    pageSize: number
  } {
    let items = Array.from(this.marketplaceItems.value.values()) as CapabilityMarketplaceItem[]

    // 过滤公开的能力
    items = items.filter(item => item.isPublic)

    // 关键词搜索
    if (params.keyword) {
      const keyword = params.keyword.toLowerCase()
      items = items.filter(
        item =>
          item.name.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword) ||
          item.tags.some(tag => tag.toLowerCase().includes(keyword))
      )
    }

    // 类型过滤
    if (params.type) {
      items = items.filter(item => item.type === params.type)
    }

    // 分类过滤
    if (params.category) {
      items = items.filter(item => item.category === params.category)
    }

    // 标签过滤
    if (params.tags && params.tags.length > 0) {
      items = items.filter(item => params.tags!.some(tag => item.tags.includes(tag)))
    }

    // 最低评分过滤
    const minRating = params.minRating
    if (minRating) {
      items = items.filter(item => item.rating >= minRating)
    }

    // 排序
    const sortBy = params.sortBy || 'rating'
    switch (sortBy) {
      case 'rating':
        items.sort((a, b) => b.rating - a.rating)
        break
      case 'usage':
        items.sort((a, b) => b.usageCount - a.usageCount)
        break
      case 'trending':
        items.sort((a, b) => {
          const statsA = this.usageStats.value.get(a.id)
          const statsB = this.usageStats.value.get(b.id)
          return (statsB?.trendingScore || 0) - (statsA?.trendingScore || 0)
        })
        break
      case 'newest':
        items.sort((a, b) => b.createdAt - a.createdAt)
        break
    }

    // 分页
    const page = params.page || 1
    const pageSize = params.pageSize || 20
    const start = (page - 1) * pageSize
    const end = start + pageSize

    return {
      items: items.slice(start, end),
      total: items.length,
      page,
      pageSize,
    }
  }

  /**
   * 获取能力详情
   */
  getCapabilityDetail(id: string): CapabilityMarketplaceItem | null {
    return this.marketplaceItems.value.get(id) || null
  }

  /**
   * 获取能力评价
   */
  getCapabilityReviews(
    capabilityId: string,
    page?: number,
    pageSize?: number
  ): {
    reviews: CapabilityReview[]
    total: number
    averageRating: number
  } {
    const allReviews = this.reviews.value.get(capabilityId) || []
    const sortedReviews = allReviews.sort((a, b) => b.helpfulCount - a.helpfulCount)

    const p = page || 1
    const ps = pageSize || 10
    const start = (p - 1) * ps
    const end = start + ps

    const paginatedReviews = sortedReviews.slice(start, end)
    const averageRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0

    return {
      reviews: paginatedReviews,
      total: allReviews.length,
      averageRating,
    }
  }

  /**
   * 添加评价
   */
  addReview(review: Omit<CapabilityReview, 'id' | 'createdAt' | 'helpfulCount'>): CapabilityReview {
    const id = `review-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = Date.now()

    const newReview: CapabilityReview = {
      ...review,
      id,
      createdAt: now,
      helpfulCount: 0,
    }

    if (!this.reviews.value.has(review.capabilityId)) {
      this.reviews.value.set(review.capabilityId, [])
    }

    this.reviews.value.get(review.capabilityId)!.push(newReview)

    // 更新能力评分
    this.updateCapabilityRating(review.capabilityId)

    return newReview
  }

  /**
   * 更新能力评分
   */
  private updateCapabilityRating(capabilityId: string): void {
    const reviews = this.reviews.value.get(capabilityId) || []
    if (reviews.length === 0) return

    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length

    const item = this.marketplaceItems.value.get(capabilityId)
    if (item) {
      item.rating = averageRating
      item.ratingCount = reviews.length
      item.updatedAt = Date.now()
      this.marketplaceItems.value.set(capabilityId, { ...item })
    }
  }

  /**
   * 记录能力使用
   */
  recordUsage(
    capabilityId: string,
    stats: {
      success: boolean
      latency: number
      cost: number
    }
  ): void {
    if (!this.usageStats.value.has(capabilityId)) {
      this.usageStats.value.set(capabilityId, {
        capabilityId,
        totalUsers: 0,
        totalCalls: 0,
        averageRating: 0,
        successRate: 0,
        averageLatency: 0,
        totalCost: 0,
        trendingScore: 0,
      })
    }

    const usageStat = this.usageStats.value.get(capabilityId)!
    usageStat.totalCalls++
    usageStat.averageLatency =
      (usageStat.averageLatency * (usageStat.totalCalls - 1) + stats.latency) / usageStat.totalCalls
    usageStat.totalCost += stats.cost

    if (stats.success) {
      usageStat.successRate =
        (usageStat.successRate * (usageStat.totalCalls - 1) + 1) / usageStat.totalCalls
    } else {
      usageStat.successRate =
        (usageStat.successRate * (usageStat.totalCalls - 1)) / usageStat.totalCalls
    }

    // 更新趋势分数（基于最近使用频率和评分）
    usageStat.trendingScore = this.calculateTrendingScore(usageStat)

    this.usageStats.value.set(capabilityId, { ...usageStat })

    // 更新市场项的使用次数
    const item = this.marketplaceItems.value.get(capabilityId)
    if (item) {
      item.usageCount = usageStat.totalCalls
      this.marketplaceItems.value.set(capabilityId, { ...item })
    }
  }

  /**
   * 计算趋势分数
   */
  private calculateTrendingScore(stats: CapabilityUsageStats): number {
    // 基于使用频率、评分和成功率计算趋势分数
    const usageScore = Math.log10(stats.totalCalls + 1) * 10
    const ratingScore = stats.averageRating * 20
    const successScore = stats.successRate * 30

    return usageScore + ratingScore + successScore
  }

  /**
   * 获取热门能力
   */
  getTrendingCapabilities(limit: number = 10): CapabilityMarketplaceItem[] {
    const items = (Array.from(this.marketplaceItems.value.values()) as CapabilityMarketplaceItem[])
      .filter(item => item.isPublic)
      .map(item => {
        const stats = this.usageStats.value.get(item.id)
        return {
          item,
          trendingScore: stats?.trendingScore || 0,
        }
      })
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, limit)
      .map(({ item }) => item)

    return items
  }

  /**
   * 获取推荐能力
   */
  getRecommendedCapabilities(userId: string, limit: number = 10): CapabilityMarketplaceItem[] {
    // 基于用户历史使用和相似用户推荐
    // 这里简化实现，实际应该使用协同过滤算法
    const items = (Array.from(this.marketplaceItems.value.values()) as CapabilityMarketplaceItem[])
      .filter(item => item.isPublic && item.isVerified)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit)

    return items
  }

  /**
   * 获取能力使用统计
   */
  getUsageStats(capabilityId: string): CapabilityUsageStats | null {
    return this.usageStats.value.get(capabilityId) || null
  }
}

// 单例实例
let marketplaceInstance: AICapabilityMarketplace | null = null

/**
 * 获取 AI 能力市场实例
 */
export function getAICapabilityMarketplace(): AICapabilityMarketplace {
  if (!marketplaceInstance) {
    marketplaceInstance = new AICapabilityMarketplace()
  }
  return marketplaceInstance
}
