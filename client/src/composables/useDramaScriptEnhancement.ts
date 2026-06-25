/**
 * 短剧创作增强 Composable
 * 
 * 提供：
 * 1. 智能队列管理
 * 2. 提示词优化
 * 3. 视频质量分析
 * 4. 剧情助手
 * 5. 快捷键管理
 */

import { ref, computed, watch, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import type {
  SceneFragment,
  Character,
} from '@/components/ai-generation/DramaScriptExcel.types'

export interface QueueTask {
  id: string
  fragmentId: string
  type: 'prompt' | 'video' | 'frame' | 'quality'
  priority: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  retryCount: number
}

export interface QueueStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  successRate: number
}

export interface SceneRecommendation {
  scene: string
  description: string
  reason: string
  confidence: number
}

export interface CharacterArcAnalysis {
  characterId: string
  characterName: string
  appearances: number
  emotionalJourney: string
  suggestions: string[]
}

export interface EnhancementOptions {
  fragments: Ref<SceneFragment[]>
  characters: Ref<Character[]>
  enableQueueManagement?: boolean
  enablePromptOptimization?: boolean
  enableVideoQualityAnalysis?: boolean
  enablePlotAdvisor?: boolean
}

// ========== Composable ==========

export function useDramaScriptEnhancement(options: EnhancementOptions) {
  const {
    fragments,
    characters,
    enableQueueManagement = true,
    enablePromptOptimization = true,
    enableVideoQualityAnalysis = true,
    enablePlotAdvisor = true,
  } = options

  // ========== 队列管理 ==========
  
  const queue = ref<QueueTask[]>([])
  const isQueuePaused = ref(false)

  const queueStats = computed<QueueStats>(() => {
    const total = queue.value.length
    const pending = queue.value.filter(t => t.status === 'pending').length
    const processing = queue.value.filter(t => t.status === 'processing').length
    const completed = queue.value.filter(t => t.status === 'completed').length
    const failed = queue.value.filter(t => t.status === 'failed').length
    const successRate = total > 0 ? (completed / total) * 100 : 0

    return { total, pending, processing, completed, failed, successRate }
  })

  const addToQueue = (
    fragmentId: string,
    type: QueueTask['type'],
    priority: number = 0
  ): QueueTask => {
    const task: QueueTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fragmentId,
      type,
      priority,
      status: 'pending',
      createdAt: new Date().toISOString(),
      retryCount: 0,
    }

    queue.value.push(task)
    queue.value.sort((a, b) => b.priority - a.priority)

    return task
  }

  const pauseQueue = () => {
    isQueuePaused.value = true
  }

  const resumeQueue = () => {
    isQueuePaused.value = false
  }

  const clearQueue = () => {
    queue.value = queue.value.filter(t => t.status === 'processing')
  }

  // ========== 提示词优化 ==========

  const optimizePrompt = async (
    fragment: SceneFragment,
    context?: { previousFragments?: SceneFragment[]; style?: string }
  ): Promise<string> => {
    if (!enablePromptOptimization) {
      return fragment.videoPrompt || fragment.description
    }

    return new Promise((resolve) => {
      const contextInfo = context?.previousFragments?.slice(-3).map(f => 
        `场景${f.sequence}: ${f.scene} - ${f.description}`
      ).join('\n') || ''

      const characterInfo = characters.value.find(c => 
        c.name === fragment.character
      )

      const prompt = `优化以下视频生成提示词，使其更加专业和详细：

【当前场景】
场景: ${fragment.scene}
人物: ${fragment.character}
描述: ${fragment.description}
${characterInfo ? `人物外貌: ${characterInfo.appearance?.description || ''}` : ''}

${contextInfo ? `【前情提要】\n${contextInfo}` : ''}

要求：
1. 保持场景核心内容不变
2. 添加更多视觉细节（光线、色彩、构图）
3. 描述人物动作和表情
4. 添加环境氛围描述
5. 适合AI视频生成

直接返回优化后的提示词，不要解释。`

      let optimizedPrompt = ''

      void streamGenerateContent(
        {
          prompt,
          modelId: 'gpt-4',
          type: 'text',
          parameters: { temperature: 0.7, maxTokens: 500 },
        },
        (chunk) => {
          optimizedPrompt += chunk
        },
        () => {
          resolve(optimizedPrompt.trim() || fragment.description)
        },
        (error) => {
          logger.error('Failed to optimize prompt:', error)
          resolve(fragment.description)
        }
      )
    })
  }

  // ========== 视频质量分析 ==========

  const analyzeVideoQualityEnhanced = async (
    videoUrl: string,
    _fragment: SceneFragment
  ): Promise<{
    score: number
    issues: string[]
    suggestions: string[]
  }> => {
    if (!enableVideoQualityAnalysis) {
      return { score: 80, issues: [], suggestions: [] }
    }

    try {
      // 创建视频元素进行分析
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.src = videoUrl
      video.muted = true

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('加载超时')), 10000)
        video.onloadedmetadata = () => {
          clearTimeout(timeout)
          resolve()
        }
        video.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('加载失败'))
        }
      })

      const issues: string[] = []
      const suggestions: string[] = []
      let score = 100

      // 分辨率检查
      if (video.videoWidth < 720) {
        issues.push('分辨率较低')
        suggestions.push('使用更高分辨率设置')
        score -= 15
      }

      // 时长检查
      if (video.duration < 2) {
        issues.push('视频时长过短')
        suggestions.push('增加场景描述以生成更长视频')
        score -= 10
      }

      // 宽高比检查
      const aspectRatio = video.videoWidth / video.videoHeight
      if (aspectRatio < 1.5 || aspectRatio > 2.0) {
        issues.push('宽高比非标准')
        suggestions.push('考虑调整视频尺寸')
        score -= 5
      }

      return {
        score: Math.max(0, score),
        issues,
        suggestions,
      }
    } catch (error) {
      logger.error('Video quality analysis failed:', error)
      return {
        score: 0,
        issues: ['无法分析视频'],
        suggestions: ['检查视频URL是否有效'],
      }
    }
  }

  // ========== 剧情助手 ==========

  const getSceneRecommendations = async (
    count: number = 3
  ): Promise<SceneRecommendation[]> => {
    if (!enablePlotAdvisor || fragments.value.length === 0) {
      return []
    }

    return new Promise((resolve) => {
      const recentFragments = fragments.value.slice(-5).map(f => 
        `场景${f.sequence}: [${f.scene}] ${f.character}: ${f.description}`
      ).join('\n')

      const characterNames = characters.value.map(c => c.name).join(', ')

      const prompt = `基于以下剧情，推荐${count}个后续场景：

【最近剧情】
${recentFragments}

【角色】${characterNames || '未指定'}

返回JSON数组：
[{
  "scene": "场景名称",
  "description": "场景描述",
  "reason": "推荐理由",
  "confidence": 置信度(0-1)
}]`

      let content = ''

      void streamGenerateContent(
        {
          prompt,
          modelId: 'gpt-4',
          type: 'text',
          parameters: { temperature: 0.8, maxTokens: 1000 },
        },
        (chunk) => {
          content += chunk
        },
        () => {
          try {
            const match = content.match(/\[[\s\S]*\]/)
            if (match) {
              const recommendations = JSON.parse(match[0])
              resolve(recommendations.slice(0, count))
            } else {
              resolve([])
            }
          } catch {
            resolve([])
          }
        },
        () => resolve([])
      )
    })
  }

  const analyzeCharacterArcs = (): CharacterArcAnalysis[] => {
    if (!enablePlotAdvisor) return []

    return characters.value.map(char => {
      const appearances = fragments.value.filter(f => 
        f.character?.includes(char.name)
      )

      const suggestions: string[] = []
      
      if (appearances.length < 2) {
        suggestions.push('增加该角色的出场次数')
      }
      
      if (appearances.length > 0) {
        const lastAppearance = appearances[appearances.length - 1]
        const totalFragments = fragments.value.length
        if (lastAppearance.sequence < totalFragments - 3) {
          suggestions.push('考虑让该角色重新出场')
        }
      }

      // 分析情感旅程
      let emotionalJourney = '角色发展平稳'
      if (appearances.length >= 3) {
        const hasConflict = appearances.some(f => 
          f.description?.includes('冲突') || 
          f.description?.includes('争吵') ||
          f.description?.includes('矛盾')
        )
        if (hasConflict) {
          emotionalJourney = '角色经历了冲突和挑战'
        }
      }

      return {
        characterId: char.id,
        characterName: char.name,
        appearances: appearances.length,
        emotionalJourney,
        suggestions,
      }
    })
  }

  // ========== 快捷键管理 ==========

  const shortcutHandlers = new Map<string, () => void>()

  const registerDramaShortcuts = (handlers: Record<string, () => void>) => {
    Object.entries(handlers).forEach(([key, handler]) => {
      shortcutHandlers.set(key, handler)
    })
  }

  const unregisterDramaShortcuts = () => {
    shortcutHandlers.clear()
  }

  // ========== 监听变化 ==========

  if (enableQueueManagement) {
    watch(fragments, () => {
      // 当片段变化时，可以触发相关逻辑
    }, { deep: true })
  }

  return {
    // 队列管理
    queue,
    queueStats,
    isQueuePaused,
    addToQueue,
    pauseQueue,
    resumeQueue,
    clearQueue,
    
    // 提示词优化
    optimizePrompt,
    
    // 视频质量分析
    analyzeVideoQualityEnhanced,
    
    // 剧情助手
    getSceneRecommendations,
    analyzeCharacterArcs,
    
    // 快捷键
    registerDramaShortcuts,
    unregisterDramaShortcuts,
  }
}
