/**
 * 用户数据与长期记忆系统
 * 根据 README 中的用户数据与长期记忆系统架构实现
 * 核心价值：用户数据永久保存，持续学习用户，深度个性化
 */

import request from '@/utils/request'
import { logger } from '../utils/logger'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import type { ApiResponse } from '@/types'

/**
 * 用户数据类型
 */
export enum UserDataType {
  PROFILE = 'profile', // 基础信息数据
  BEHAVIOR = 'behavior', // 行为数据
  CONTENT = 'content', // 内容数据
  PREFERENCE = 'preference', // 偏好数据
  SOCIAL = 'social', // 社交数据
  TRANSACTION = 'transaction', // 交易数据
  FEEDBACK = 'feedback', // 反馈数据
}

/**
 * 记忆层级
 */
export enum MemoryLevel {
  SHORT_TERM = 'short_term', // 0-1天
  MEDIUM_TERM = 'medium_term', // 1-30天
  LONG_TERM = 'long_term', // 30-365天
  PERMANENT = 'permanent', // 永久
}

/**
 * 用户数据接口
 */
export interface UserData {
  userId: string
  type: UserDataType
  data: any
  timestamp: number
  importance?: number // 重要性评分 0-1
  memoryLevel?: MemoryLevel
}

/**
 * 记忆数据接口
 */
export interface MemoryData {
  memoryId: string
  userId: string
  content: string
  context?: Record<string, unknown>
  importance: number
  level: MemoryLevel
  createdAt: number
  updatedAt: number
  tags?: string[]
  relatedMemories?: string[] // 关联记忆ID
}

/**
 * 用户画像接口
 */
export interface UserProfile {
  userId: string
  basicInfo: {
    age?: number
    gender?: string
    location?: {
      country?: string
      province?: string
      city?: string
    }
    devices?: Array<{
      deviceId: string
      type: string
      os: string
      browser: string
    }>
  }
  behavior: {
    activeHours: number[]
    preferredFeatures: string[]
    usageFrequency: string
    sessionLength: number
    dailyActiveTime: number
  }
  preferences: {
    ui: {
      theme: string
      language: string
      layout: string
    }
    features: {
      favoriteFeatures: string[]
      hiddenFeatures: string[]
    }
    content: {
      preferredTopics: string[]
      contentFormat: string
    }
  }
  knowledge: {
    domains: string[]
    expertise: Record<string, number>
  }
}

/**
 * 用户数据与长期记忆系统服务
 */
export class UserMemoryService {
  private userId: string | null = null

  /**
   * 初始化服务
   */
  init(userId: string) {
    this.userId = userId
  }

  /**
   * 采集用户数据（全量采集，实时采集，永久存储）
   */
  async collectUserData(type: UserDataType, data: any, importance?: number): Promise<void> {
    if (!this.userId) {
      return
    }

    const userData: UserData = {
      userId: this.userId,
      type,
      data,
      timestamp: Date.now(),
      importance: importance || 0.5,
    }

    try {
      // 实时采集到后端
      await request.post('/user-data/collect', userData)

      // 本地缓存（用于离线场景）
      const localData = StorageManager.getItem<UserData[]>(STORAGE_KEYS.USER_DATA_COLLECTION) || []
      localData.push(userData)
      StorageManager.setItem(STORAGE_KEYS.USER_DATA_COLLECTION, localData)
    } catch (error) {
      logger.error('Failed to collect user data:', error)
      // 即使失败也要保存到本地，等待重试
      const localData = StorageManager.getItem<UserData[]>(STORAGE_KEYS.USER_DATA_COLLECTION) || []
      localData.push(userData)
      StorageManager.setItem(STORAGE_KEYS.USER_DATA_COLLECTION, localData)
    }
  }

  /**
   * 存储记忆（分层存储）
   */
  async storeMemory(
    content: string,
    context?: Record<string, unknown>,
    importance?: number
  ): Promise<ApiResponse<{ memoryId: string }>> {
    if (!this.userId) {
      throw new Error('UserMemoryService: userId not initialized')
    }

    // 评估重要性，决定存储层级
    const evaluatedImportance = importance || (await this.evaluateImportance(content, context))
    const level = this.determineMemoryLevel(evaluatedImportance)

    const memory: MemoryData = {
      memoryId: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: this.userId,
      content,
      context,
      importance: evaluatedImportance,
      level,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    return await request.post('/user-memory/store', memory)
  }

  /**
   * 检索记忆（从所有层级检索）
   */
  async retrieveMemory(query: string, topK: number = 5): Promise<ApiResponse<MemoryData[]>> {
    if (!this.userId) {
      throw new Error('UserMemoryService: userId not initialized')
    }

    return await request.post('/user-memory/retrieve', {
      userId: this.userId,
      query,
      topK,
    })
  }

  /**
   * 获取用户画像
   */
  async getUserProfile(): Promise<ApiResponse<UserProfile>> {
    if (!this.userId) {
      throw new Error('UserMemoryService: userId not initialized')
    }

    return await request.get(`/user-profile/${this.userId}`)
  }

  /**
   * 更新用户画像
   */
  async updateUserProfile(updates: Partial<UserProfile>): Promise<ApiResponse<void>> {
    if (!this.userId) {
      throw new Error('UserMemoryService: userId not initialized')
    }

    return await request.put(`/user-profile/${this.userId}`, updates)
  }

  /**
   * 获取个性化配置
   */
  async getPersonalization(): Promise<
    ApiResponse<{
      ui: Record<string, unknown>
      features: Record<string, unknown>
      content: Record<string, unknown>
      services: Record<string, unknown>
    }>
  > {
    if (!this.userId) {
      throw new Error('UserMemoryService: userId not initialized')
    }

    return await request.get(`/personalization/${this.userId}`)
  }

  /**
   * 计算记忆价值（用于用户粘性）
   */
  async calculateMemoryValue(): Promise<
    ApiResponse<{
      totalMemories: number
      memoryAge: number
      memoryDiversity: number
      memoryValue: number
      switchingCost: number
    }>
  > {
    if (!this.userId) {
      throw new Error('UserMemoryService: userId not initialized')
    }

    return await request.get(`/user-memory/value/${this.userId}`)
  }

  /**
   * 评估记忆重要性
   */
  private async evaluateImportance(
    content: string,
    context?: Record<string, unknown>
  ): Promise<number> {
    // 简单的重要性评估逻辑
    // 实际应该使用AI模型评估
    let importance = 0.5

    // 基于内容长度
    if (content.length > 500) importance += 0.1
    if (content.length > 1000) importance += 0.1

    // 基于上下文
    if (context?.userMarked) importance = 1.0
    const interactionFrequency =
      typeof context?.interactionFrequency === 'number' ? context.interactionFrequency : 0
    const emotionalIntensity =
      typeof context?.emotionalIntensity === 'number' ? context.emotionalIntensity : 0
    if (interactionFrequency > 0.8) importance += 0.2
    if (emotionalIntensity > 0.7) importance += 0.2

    return Math.min(1.0, importance)
  }

  /**
   * 确定记忆层级
   */
  private determineMemoryLevel(importance: number): MemoryLevel {
    if (importance >= 0.9) return MemoryLevel.PERMANENT
    if (importance >= 0.7) return MemoryLevel.LONG_TERM
    if (importance >= 0.5) return MemoryLevel.MEDIUM_TERM
    return MemoryLevel.SHORT_TERM
  }
}

// 导出单例
export const userMemoryService = new UserMemoryService()
