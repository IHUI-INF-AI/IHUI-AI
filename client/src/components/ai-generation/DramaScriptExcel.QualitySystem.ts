/**
 * 视频质量检测与智能重试系统
 * 
 * 功能：
 * 1. 视频质量自动检测
 * 2. 失败原因分析
 * 3. 智能重试机制
 * 4. 重试队列管理
 */

import { logger } from '@/utils/logger'
import type {
  SceneFragment,
  QualityReport,
  QualityIssue,
  FailureReason,
  RetryRecord,
  RetryStrategy,
} from './DramaScriptExcel.types'

// ========== 失败原因分析 ==========

/**
 * 分析失败原因
 */
export function analyzeFailure(
  error: Error | string,
  _fragment: SceneFragment
): FailureReason {
  const errorMessage = typeof error === 'string' ? error : error.message
  const errorLower = errorMessage.toLowerCase()

  // API错误
  if (
    errorLower.includes('api') ||
    errorLower.includes('server error') ||
    errorLower.includes('500') ||
    errorLower.includes('503') ||
    errorLower.includes('service unavailable')
  ) {
    return {
      type: 'api_error',
      message: errorMessage,
      canRetry: true,
      retryDelay: 5000,  // 5秒后重试
      shouldOptimizePrompt: false,
    }
  }

  // 网络错误
  if (
    errorLower.includes('network') ||
    errorLower.includes('connection') ||
    errorLower.includes('timeout') ||
    errorLower.includes('websocket')
  ) {
    return {
      type: 'network_error',
      message: errorMessage,
      canRetry: true,
      retryDelay: 3000,  // 3秒后重试
      shouldOptimizePrompt: false,
    }
  }

  // 超时
  if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
    return {
      type: 'timeout',
      message: errorMessage,
      canRetry: true,
      retryDelay: 10000,  // 10秒后重试
      shouldOptimizePrompt: false,
    }
  }

  // 资源限制
  if (
    errorLower.includes('quota') ||
    errorLower.includes('limit') ||
    errorLower.includes('rate limit') ||
    errorLower.includes('429')
  ) {
    return {
      type: 'resource_limit',
      message: errorMessage,
      canRetry: true,
      retryDelay: 30000,  // 30秒后重试（避免限流）
      shouldOptimizePrompt: false,
    }
  }

  // 提示词问题（通过关键词判断）
  if (
    errorLower.includes('prompt') ||
    errorLower.includes('invalid') ||
    errorLower.includes('rejected') ||
    errorLower.includes('content policy')
  ) {
    return {
      type: 'prompt_issue',
      message: errorMessage,
      canRetry: true,
      retryDelay: 2000,
      shouldOptimizePrompt: true,  // 需要优化提示词
    }
  }

  // 未知错误
  return {
    type: 'unknown',
    message: errorMessage,
    canRetry: true,  // 默认允许重试
    retryDelay: 5000,
    shouldOptimizePrompt: false,
  }
}

// ========== 视频质量检测 ==========

/**
 * 分析视频质量（前端基础检测）
 * 注意：完整的质量检测需要后端支持，这里提供基础检测
 */
export async function analyzeVideoQuality(
  videoUrl: string,
  _fragment: SceneFragment
): Promise<QualityReport> {
  const issues: QualityIssue[] = []
  const recommendations: string[] = []

  try {
    // 创建视频元素进行基础检测
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.src = videoUrl
    video.muted = true

    // 等待视频加载
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('视频加载超时'))
      }, 10000)

      video.onloadedmetadata = () => {
        clearTimeout(timeout)
        resolve()
      }

      video.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('视频加载失败'))
      }
    })

    // 基础质量评分
    let clarity = 80  // 默认清晰度（需要后端支持才能准确检测）
    let colorSaturation = 80  // 默认色彩饱和度
    let motionSmoothness = 80  // 默认运动流畅度
    let characterConsistency = 100  // 人物一致性（需要与角色库对比）

    // 检查视频分辨率
    if (video.videoWidth < 720 || video.videoHeight < 480) {
      issues.push({
        type: 'blur',
        severity: 'medium',
        description: '视频分辨率较低，可能影响清晰度',
        suggestion: '建议使用更高分辨率的视频生成设置',
      })
      clarity -= 20
      recommendations.push('使用更高分辨率的视频生成设置')
    }

    // 检查视频时长（如果太短可能有问题）
    if (video.duration < 1) {
      issues.push({
        type: 'other',
        severity: 'high',
        description: '视频时长过短，可能生成不完整',
        suggestion: '检查提示词是否完整，或重新生成',
      })
      recommendations.push('检查提示词完整性，考虑重新生成')
    }

    // 计算综合评分
    const overallScore = Math.round(
      (clarity * 0.3 +
        colorSaturation * 0.2 +
        motionSmoothness * 0.3 +
        characterConsistency * 0.2)
    )

    return {
      overallScore,
      clarity,
      colorSaturation,
      motionSmoothness,
      characterConsistency,
      issues,
      recommendations,
      analyzedAt: new Date().toISOString(),
    }
  } catch (error) {
    logger.error('Video quality detection failed:', error)
    
    // 返回默认质量报告
    return {
      overallScore: 0,
      clarity: 0,
      colorSaturation: 0,
      motionSmoothness: 0,
      characterConsistency: 0,
      issues: [
        {
          type: 'other',
          severity: 'high',
          description: '无法检测视频质量',
          suggestion: '请检查视频URL是否有效',
        },
      ],
      recommendations: ['检查视频URL有效性', '重新生成视频'],
      analyzedAt: new Date().toISOString(),
    }
  }
}

// ========== 智能重试管理 ==========

/**
 * 计算重试延迟（指数退避）
 */
export function calculateRetryDelay(
  attempt: number,
  strategy: RetryStrategy
): number {
  const delay = Math.min(
    strategy.baseDelay * Math.pow(strategy.backoffMultiplier, attempt - 1),
    strategy.maxDelay
  )
  
  // 添加随机抖动，避免同时重试
  const jitter = Math.random() * 1000
  return Math.round(delay + jitter)
}

/**
 * 检查是否应该重试
 */
export function shouldRetry(
  fragment: SceneFragment,
  reason: FailureReason,
  strategy: RetryStrategy
): boolean {
  // 如果不允许重试，直接返回false
  if (!reason.canRetry) {
    return false
  }

  // 检查重试次数
  const currentRetryCount = fragment.retryCount || 0
  if (currentRetryCount >= strategy.maxRetries) {
    return false
  }

  return true
}

/**
 * 创建重试记录
 */
export function createRetryRecord(
  attempt: number,
  reason: FailureReason,
  success: boolean,
  error?: string
): RetryRecord {
  return {
    attempt,
    timestamp: new Date().toISOString(),
    reason,
    success,
    error,
  }
}

/**
 * 更新片段的重试信息
 */
export function updateFragmentRetryInfo(
  fragment: SceneFragment,
  retryRecord: RetryRecord
): void {
  fragment.retryCount = (fragment.retryCount || 0) + 1
  
  if (!fragment.retryHistory) {
    fragment.retryHistory = []
  }
  fragment.retryHistory.push(retryRecord)
}

/**
 * 获取默认重试策略
 */
export function getDefaultRetryStrategy(): RetryStrategy {
  return {
    maxRetries: 3,
    baseDelay: 2000,  // 2秒
    maxDelay: 30000,  // 30秒
    backoffMultiplier: 2,  // 指数退避
    optimizePromptOnRetry: true,  // 重试时优化提示词
    autoRetry: true,  // 自动重试
  }
}

// ========== 质量对比分析 ==========

/**
 * 对比多个片段的质量
 */
export function compareQuality(
  fragments: SceneFragment[]
): {
  averageScore: number
  minScore: number
  maxScore: number
  qualityTrend: 'improving' | 'declining' | 'stable'
  lowQualityFragments: SceneFragment[]
} {
  const completedFragments = fragments.filter(
    f => f.status === 'completed' && f.qualityScore !== undefined
  )

  if (completedFragments.length === 0) {
    return {
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      qualityTrend: 'stable',
      lowQualityFragments: [],
    }
  }

  const scores = completedFragments
    .map(f => f.qualityScore!)
    .filter(score => score > 0)

  if (scores.length === 0) {
    return {
      averageScore: 0,
      minScore: 0,
      maxScore: 0,
      qualityTrend: 'stable',
      lowQualityFragments: [],
    }
  }

  const averageScore = Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length
  )
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)

  // 分析质量趋势（按序号排序）
  const sortedFragments = [...completedFragments].sort(
    (a, b) => a.sequence - b.sequence
  )
  
  let improvingCount = 0
  let decliningCount = 0
  
  for (let i = 1; i < sortedFragments.length; i++) {
    const prev = sortedFragments[i - 1].qualityScore || 0
    const curr = sortedFragments[i].qualityScore || 0
    
    if (curr > prev + 5) {
      improvingCount++
    } else if (curr < prev - 5) {
      decliningCount++
    }
  }

  let qualityTrend: 'improving' | 'declining' | 'stable' = 'stable'
  if (improvingCount > decliningCount * 1.5) {
    qualityTrend = 'improving'
  } else if (decliningCount > improvingCount * 1.5) {
    qualityTrend = 'declining'
  }

  // 找出低质量片段（分数低于平均分20分以上）
  const lowQualityFragments = completedFragments.filter(
    f => (f.qualityScore || 0) < averageScore - 20
  )

  return {
    averageScore,
    minScore,
    maxScore,
    qualityTrend,
    lowQualityFragments,
  }
}
