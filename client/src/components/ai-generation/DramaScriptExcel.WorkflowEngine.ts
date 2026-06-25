/**
 * 智能工作流引擎
 * 
 * 功能：
 * 1. 自动化流程编排
 * 2. 工作流模板管理
 * 3. 批量处理队列优化
 * 4. 智能推荐系统
 */

import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import type {
  SceneFragment,
  Character,
  Workflow,
  WorkflowStep as _WorkflowStep,
  WorkflowResult,
  Task,
  BatchProcessor as _BatchProcessorType,
} from './DramaScriptExcel.types'

export interface BatchProcessorConfig {
  maxConcurrent: number
  delayBetweenTasks: number
  autoRetryOnFailure: boolean
  saveProgress: boolean
}

// ========== 工作流模板 ==========

/**
 * 获取预设工作流模板
 */
export function getWorkflowTemplates(): Workflow[] {
  return [
    {
      id: 'quick-create',
      name: '快速创作',
      description: '自动生成提示词 → 生成视频 → 提取尾帧',
      enabled: true,
      steps: [
        {
          id: 'step1',
          type: 'generate-prompt',
          config: { enhanced: true },
          enabled: true,
        },
        {
          id: 'step2',
          type: 'generate-video',
          config: {},
          enabled: true,
        },
        {
          id: 'step3',
          type: 'extract-frame',
          config: {},
          enabled: true,
          condition: (f) => f.status === 'completed' && !!f.videoUrl,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'batch-create',
      name: '批量创作',
      description: '批量生成所有片段的提示词和视频',
      enabled: true,
      steps: [
        {
          id: 'step1',
          type: 'generate-prompt',
          config: { enhanced: true, batch: true },
          enabled: true,
        },
        {
          id: 'step2',
          type: 'wait',
          config: { duration: 1000 },
          enabled: true,
        },
        {
          id: 'step3',
          type: 'generate-video',
          config: { batch: true },
          enabled: true,
          condition: (f) => !!f.videoPrompt,
        },
        {
          id: 'step4',
          type: 'extract-frame',
          config: { batch: true },
          enabled: true,
          condition: (f) => f.status === 'completed' && !!f.videoUrl,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'quality-first',
      name: '质量优先',
      description: '生成 → 检测质量 → 优化 → 重试（如需要）',
      enabled: true,
      steps: [
        {
          id: 'step1',
          type: 'generate-prompt',
          config: { enhanced: true, optimize: true },
          enabled: true,
        },
        {
          id: 'step2',
          type: 'generate-video',
          config: {},
          enabled: true,
        },
        {
          id: 'step3',
          type: 'quality-check',
          config: { minScore: 60 },
          enabled: true,
          condition: (f) => f.status === 'completed' && !!f.videoUrl,
        },
        {
          id: 'step4',
          type: 'retry',
          config: { maxRetries: 2, optimizePrompt: true },
          enabled: true,
          condition: (f) => (f.qualityScore || 0) < 60,
        },
        {
          id: 'step5',
          type: 'extract-frame',
          config: {},
          enabled: true,
          condition: (f) => f.status === 'completed' && (f.qualityScore || 0) >= 60,
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
}

// ========== 批量处理队列管理 ==========

/**
 * 批量处理队列管理器
 */
export class BatchProcessor {
  private queue: Task[] = []
  private processing: Set<string> = new Set()
  private config: BatchProcessorConfig

  constructor(config: Partial<BatchProcessorConfig> = {}) {
    this.config = {
      maxConcurrent: 2,  // 默认最大并发2，避免API限流
      delayBetweenTasks: 2000,  // 任务间延迟2秒
      autoRetryOnFailure: true,
      saveProgress: true,
      ...config,
    }
  }

  /**
   * 添加任务到队列
   */
  addTask(
    fragment: SceneFragment,
    type: Task['type'],
    priority: number = 0
  ): string {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const task: Task = {
      id: taskId,
      fragment,
      priority,
      type,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    }

    // 按优先级插入（优先级高的在前）
    const insertIndex = this.queue.findIndex(t => t.priority < priority)
    if (insertIndex === -1) {
      this.queue.push(task)
    } else {
      this.queue.splice(insertIndex, 0, task)
    }

    return taskId
  }

  /**
   * 批量添加任务
   */
  addTasks(
    fragments: SceneFragment[],
    type: Task['type'],
    priority: number = 0
  ): string[] {
    return fragments.map(f => this.addTask(f, type, priority))
  }

  /**
   * 处理队列
   */
  async processQueue(
    handlers: {
      generatePrompt?: (fragment: SceneFragment, enhanced?: boolean) => Promise<void>
      generateVideo?: (fragment: SceneFragment) => Promise<void>
      extractFrame?: (fragment: SceneFragment) => Promise<void>
      checkQuality?: (fragment: SceneFragment) => Promise<void>
    },
    onProgress?: (completed: number, total: number) => void
  ): Promise<void> {
    let completedCount = 0
    const totalCount = this.queue.length

    while (this.queue.length > 0 || this.processing.size > 0) {
      // 检查是否可以启动新任务
      while (
        this.queue.length > 0 &&
        this.processing.size < this.config.maxConcurrent
      ) {
        const task = this.queue.shift()!
        
        if (!task) break

        // 检查任务条件（如果有）
        if (task.fragment.status === 'generating' || task.fragment.status === 'completed') {
          completedCount++
          if (onProgress) {
            onProgress(completedCount, totalCount)
          }
          continue
        }

        // 启动任务
        this.processing.add(task.id)
        task.status = 'processing'
        task.startedAt = new Date().toISOString()

        // 异步执行任务
        this.executeTask(task, handlers)
          .then(() => {
            task.status = 'completed'
            task.completedAt = new Date().toISOString()
            completedCount++
            if (onProgress) {
              onProgress(completedCount, totalCount)
            }
          })
          .catch((error) => {
            task.status = 'failed'
            task.completedAt = new Date().toISOString()
            logger.error(`Task ${task.id} execution failed:`, error)
            
            // 自动重试（如果需要）
            if (this.config.autoRetryOnFailure && (task.retryCount || 0) < 2) {
              task.retryCount = (task.retryCount || 0) + 1
              task.status = 'pending'
              this.queue.push(task)  // 重新加入队列
            } else {
              completedCount++
              if (onProgress) {
                onProgress(completedCount, totalCount)
              }
            }
          })
          .finally(() => {
            this.processing.delete(task.id)
          })
      }

      // 等待一下再检查队列
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(
    task: Task,
    handlers: {
      generatePrompt?: (fragment: SceneFragment, enhanced?: boolean) => Promise<void>
      generateVideo?: (fragment: SceneFragment) => Promise<void>
      extractFrame?: (fragment: SceneFragment) => Promise<void>
      checkQuality?: (fragment: SceneFragment) => Promise<void>
    }
  ): Promise<void> {
    // 任务间延迟
    if (this.config.delayBetweenTasks > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.delayBetweenTasks))
    }

    switch (task.type) {
      case 'generate-prompt':
        if (handlers.generatePrompt) {
          await handlers.generatePrompt(task.fragment, true)
        } else {
          throw new Error('generatePrompt handler not provided')
        }
        break
      
      case 'generate-video':
        if (handlers.generateVideo) {
          await handlers.generateVideo(task.fragment)
        } else {
          throw new Error('generateVideo handler not provided')
        }
        break
      
      case 'extract-frame':
        if (handlers.extractFrame) {
          await handlers.extractFrame(task.fragment)
        } else {
          throw new Error('extractFrame handler not provided')
        }
        break
      
      case 'quality-check':
        if (handlers.checkQuality) {
          await handlers.checkQuality(task.fragment)
        } else {
          throw new Error('checkQuality handler not provided')
        }
        break
      
      default:
        throw new Error(`Unknown task type: ${task.type}`)
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = []
    this.processing.clear()
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    pending: number
    running: number
    total: number
  } {
    return {
      pending: this.queue.length,
      running: this.processing.size,
      total: this.queue.length + this.processing.size,
    }
  }

  /**
   * 保存进度（到localStorage）
   */
  saveProgress(fragments: SceneFragment[]): void {
    if (!this.config.saveProgress) return

    try {
      const progress = {
        tasks: this.queue.map(t => ({
          id: t.id,
          fragmentId: t.fragment.id,
          type: t.type,
          priority: t.priority,
          retryCount: t.retryCount,
        })),
        fragments: fragments.map(f => ({
          id: f.id,
          status: f.status,
          retryCount: f.retryCount,
        })),
        timestamp: new Date().toISOString(),
      }
      localStorage.setItem('drama-script-batch-progress', JSON.stringify(progress))
    } catch (error) {
      logger.warn('Failed to save batch processing progress:', error)
    }
  }

  /**
   * 恢复进度（从localStorage）
   */
  resumeFromProgress(
    fragments: SceneFragment[],
    handlers: {
      generatePrompt?: (fragment: SceneFragment, enhanced?: boolean) => Promise<void>
      generateVideo?: (fragment: SceneFragment) => Promise<void>
      extractFrame?: (fragment: SceneFragment) => Promise<void>
      checkQuality?: (fragment: SceneFragment) => Promise<void>
    }
  ): boolean {
    try {
      const saved = localStorage.getItem('drama-script-batch-progress')
      if (!saved) return false

      const progress = JSON.parse(saved)
      
      // 恢复任务队列
      for (const taskData of progress.tasks || []) {
        const fragment = fragments.find(f => f.id === taskData.fragmentId)
        if (fragment && fragment.status !== 'completed') {
          this.addTask(fragment, taskData.type, taskData.priority)
        }
      }

      // 恢复片段状态
      for (const fragmentData of progress.fragments || []) {
        const fragment = fragments.find(f => f.id === fragmentData.id)
        if (fragment) {
          fragment.retryCount = fragmentData.retryCount || 0
        }
      }

      // 继续处理
      if (this.queue.length > 0) {
        void this.processQueue(handlers)
        return true
      }
    } catch (error) {
      logger.error('Failed to restore batch processing progress:', error)
    }
    
    return false
  }
}

// ========== 工作流执行引擎 ==========

/**
 * 执行工作流
 */
export async function executeWorkflow(
  workflow: Workflow,
  fragments: SceneFragment[],
  characters: Character[],
  handlers: {
    generatePrompt?: (fragment: SceneFragment, enhanced?: boolean) => Promise<void>
    generateVideo?: (fragment: SceneFragment) => Promise<void>
    extractFrame?: (fragment: SceneFragment) => Promise<void>
    checkQuality?: (fragment: SceneFragment) => Promise<void>
  }
): Promise<WorkflowResult[]> {
  const results: WorkflowResult[] = []

  // 过滤需要处理的片段（只处理符合条件的片段）
  const targetFragments = fragments.filter(f => {
    // 检查工作流步骤的条件
    return workflow.steps.every(step => {
      if (!step.enabled) return true
      if (!step.condition) return true
      return step.condition(f)
    })
  })

  // 为每个片段执行工作流
  for (const fragment of targetFragments) {
    const result: WorkflowResult = {
      fragmentId: fragment.id,
      workflowId: workflow.id,
      success: true,
      completedSteps: [],
      failedSteps: [],
      startedAt: new Date().toISOString(),
    }

    try {
      // 按顺序执行每个步骤
      for (const step of workflow.steps) {
        if (!step.enabled) continue

        // 检查步骤条件
        if (step.condition && !step.condition(fragment)) {
          continue
        }

        try {
          switch (step.type) {
            case 'generate-prompt':
              if (handlers.generatePrompt) {
                await handlers.generatePrompt(
                  fragment,
                  (typeof step.config.enhanced === 'boolean' ? step.config.enhanced : false)
                )
                result.completedSteps.push(step.id)
              }
              break

            case 'generate-video':
              if (handlers.generateVideo) {
                await handlers.generateVideo(fragment)
                result.completedSteps.push(step.id)
              }
              break

            case 'extract-frame':
              if (handlers.extractFrame) {
                await handlers.extractFrame(fragment)
                result.completedSteps.push(step.id)
              }
              break

            case 'quality-check':
              if (handlers.checkQuality) {
                await handlers.checkQuality(fragment)
                result.completedSteps.push(step.id)
              }
              break

            case 'wait': {
              const duration = (typeof step.config.duration === 'number' ? step.config.duration : 1000)
              await new Promise(resolve => setTimeout(resolve, duration))
              result.completedSteps.push(step.id)
              break
            }

            case 'retry':
              // 重试逻辑已经在质量检测中处理
              result.completedSteps.push(step.id)
              break
          }

          // 步骤间延迟
          if (step.config.delay) {
            const delay = typeof step.config.delay === 'number' ? step.config.delay : 0
            if (delay > 0) {
              await new Promise(resolve => setTimeout(resolve, delay))
            }
          }
        } catch (error) {
          logger.error(`Workflow step ${step.id} execution failed:`, error)
          result.failedSteps.push(step.id)
          result.success = false
          result.error = error instanceof Error ? error.message : String(error)

          // 如果步骤配置为失败即停止，则中断工作流
          if (step.config.stopOnFailure) {
            break
          }
        }
      }

      result.completedAt = new Date().toISOString()
      result.duration = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()
    } catch (error) {
      logger.error('Failed to execute workflow:', error)
      result.success = false
      result.error = error instanceof Error ? error.message : String(error)
      result.completedAt = new Date().toISOString()
      result.duration = new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()
    }

    results.push(result)
  }

  return results
}

// ========== AI辅助剧情建议 ==========

/**
 * 推荐下一场景
 */
export async function recommendNextScenes(
  currentFragments: SceneFragment[],
  characters: Character[],
  count: number = 5
): Promise<Array<{
  scene: string
  description: string
  reason: string
  expectedEffect: string
  confidence: number
}>> {
  if (currentFragments.length === 0) {
    return []
  }

  try {
    // 分析当前剧情
    const lastFragment = currentFragments[currentFragments.length - 1]
    const plotSummary = currentFragments
      .slice(-5)
      .filter(f => f.description)
      .map(f => f.description)
      .join('；')

    const characterNames = Array.from(new Set(currentFragments.map(f => f.character).filter(Boolean))).join('、')
    const sceneHistory = Array.from(new Set(currentFragments.map(f => f.scene).filter(Boolean))).slice(-3).join(' → ')

    const prompt = `基于以下短剧剧本上下文，推荐${count}个可能的下一场景：

【当前剧情】
主要人物：${characterNames || '未指定'}
场景变化：${sceneHistory || '未指定'}
最近剧情：${plotSummary || '未指定'}

【最后一段场景】
人物：${lastFragment.character || '未指定'}
场景：${lastFragment.scene || '未指定'}
描述：${lastFragment.description || '未指定'}

【要求】
1. 推荐的场景要符合剧情发展逻辑
2. 考虑人物关系和情节连贯性
3. 场景要有戏剧冲突或推进剧情
4. 每个推荐包含：场景名称、场景描述、推荐理由、预期效果
5. 按推荐程度排序（置信度0-1）

请以JSON数组格式输出，每个推荐包含：scene（场景名称）、description（场景描述）、reason（推荐理由）、expectedEffect（预期效果）、confidence（置信度0-1）。
直接输出JSON数组，不要包含其他说明文字。`

    return new Promise<Array<{
      scene: string
      description: string
      reason: string
      expectedEffect: string
      confidence: number
    }>>((resolve) => {
      let generatedContent = ''

      void streamGenerateContent(
        {
          prompt: prompt,
          modelId: 'gpt-4',
          type: 'text',
          parameters: {
            temperature: 0.7,
            maxTokens: 1000,
          },
        },
        (chunk: string) => {
          generatedContent += chunk
        },
        () => {
          // 解析JSON响应
          try {
            // 清理内容，尝试提取JSON部分
            const cleaned = generatedContent.trim()
            let jsonMatch = cleaned.match(/\[[\s\S]*\]/)
            
            if (!jsonMatch) {
              // 如果没有找到JSON，尝试提取markdown代码块中的JSON
              const codeBlockMatch = cleaned.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/)
              if (codeBlockMatch) {
                jsonMatch = [codeBlockMatch[1]]
              }
            }
            
            if (jsonMatch && jsonMatch[0]) {
              const recommendations = JSON.parse(jsonMatch[0]) as unknown
              if (Array.isArray(recommendations) && recommendations.length > 0) {
                const result = recommendations.slice(0, count).map((r: Record<string, unknown>) => ({
                  scene: (r.scene || r.场景 || '') as string,
                  description: (r.description || r.描述 || '') as string,
                  reason: (r.reason || r.理由 || '') as string,
                  expectedEffect: (r.expectedEffect || r.预期效果 || '') as string,
                  confidence: typeof r.confidence === 'number' ? r.confidence : (typeof r.置信度 === 'number' ? (r.置信度 as number) : parseFloat(String(r.confidence || r.置信度 || 0.5))),
                }))
                resolve(result)
                return
              }
            }
            
            // 如果无法解析JSON，尝试从文本中提取信息
            logger.warn('Cannot parse scene recommendation JSON, trying text parsing')
            
            // 简单的文本解析（如果JSON解析失败）
            const lines = cleaned.split('\n').filter(l => l.trim())
            const textRecommendations: Array<{
              scene: string
              description: string
              reason: string
              expectedEffect: string
              confidence: number
            }> = []
            
            // 尝试从文本中提取场景推荐（简单实现）
            for (let i = 0; i < Math.min(lines.length, count); i++) {
              const line = lines[i].trim()
              if (line.length > 10) {
                textRecommendations.push({
                  scene: line.substring(0, 50),
                  description: line,
                  reason: '基于剧情发展推荐',
                  expectedEffect: '推进剧情发展',
                  confidence: 0.6,
                })
              }
            }
            
            resolve(textRecommendations.length > 0 ? textRecommendations : [])
          } catch (error) {
            logger.error('Failed to parse scene recommendations:', error)
            resolve([])  // 出错时返回空数组
          }
        },
        (error) => {
          logger.error('Failed to generate scene recommendations:', error)
          resolve([])  // 出错时返回空数组
        }
      )
    })
  } catch (error) {
    logger.error('Failed to recommend next scene:', error)
    return []
  }
}

/**
 * 检测剧情冲突
 */
export function detectConflicts(
  fragments: SceneFragment[]
): Array<{
  type: 'character' | 'timeline' | 'scene' | 'logic'
  severity: 'low' | 'medium' | 'high'
  fragmentIds: string[]
  description: string
  suggestion: string
}> {
  const conflicts: Array<{
    type: 'character' | 'timeline' | 'scene' | 'logic'
    severity: 'low' | 'medium' | 'high'
    fragmentIds: string[]
    description: string
    suggestion: string
  }> = []

  // 检查人物逻辑冲突（同一人物在不同片段中的形象描述不一致）
  const characterMap = new Map<string, Array<{ fragment: SceneFragment; appearance: string }>>()
  
  fragments.forEach(f => {
    if (f.character && f.characterAppearance?.description) {
      if (!characterMap.has(f.character)) {
        characterMap.set(f.character, [])
      }
      characterMap.get(f.character)!.push({
        fragment: f,
        appearance: f.characterAppearance.description,
      })
    }
  })

  characterMap.forEach((appearances, character) => {
    if (appearances.length > 1) {
      // 检查形象描述是否一致（简单检查）
      const uniqueAppearances = new Set(appearances.map(a => a.appearance.toLowerCase().trim()))
      if (uniqueAppearances.size > 1) {
        conflicts.push({
          type: 'character',
          severity: 'medium',
          fragmentIds: appearances.map(a => a.fragment.id),
          description: `人物"${character}"在不同片段中的形象描述不一致`,
          suggestion: '检查并统一人物形象描述，确保角色一致性',
        })
      }
    }
  })

  // 检查场景转换是否合理（简单检查：相邻场景是否过于跳跃）
  for (let i = 1; i < fragments.length; i++) {
    const prev = fragments[i - 1]
    const curr = fragments[i]

    if (prev.scene && curr.scene && prev.scene !== curr.scene) {
      // 如果场景变化过于突然，可能有问题（这里只是基础检查）
      const _prevSceneLower = prev.scene.toLowerCase()
      const _currSceneLower = curr.scene.toLowerCase()

      // 检查是否有明显的场景跳跃（需要更智能的检查）
      // 这里暂时不实现，可以后续扩展
    }
  }

  return conflicts
}

/**
 * 分析角色关系
 */
export function analyzeCharacterRelations(
  fragments: SceneFragment[]
): {
  characters: string[]
  relations: Array<{
    character1: string
    character2: string
    interactionCount: number
    lastInteraction: number
  }>
  characterFrequency: Record<string, number>
} {
  const characters = Array.from(new Set(fragments.map(f => f.character).filter(Boolean)))
  const relations: Array<{
    character1: string
    character2: string
    interactionCount: number
    lastInteraction: number
  }> = []

  // 统计角色互动频率（同一片段中出现多个角色）
  const characterFrequency: Record<string, number> = {}
  characters.forEach(char => {
    characterFrequency[char] = fragments.filter(f => f.character === char).length
  })

  // 分析角色关系（简化版本：检查相邻片段中的角色）
  for (let i = 1; i < fragments.length; i++) {
    const prev = fragments[i - 1]
    const curr = fragments[i]

    if (prev.character && curr.character && prev.character !== curr.character) {
      const relation = relations.find(
        r =>
          (r.character1 === prev.character && r.character2 === curr.character) ||
          (r.character1 === curr.character && r.character2 === prev.character)
      )

      if (relation) {
        relation.interactionCount++
        relation.lastInteraction = curr.sequence
      } else {
        relations.push({
          character1: prev.character,
          character2: curr.character,
          interactionCount: 1,
          lastInteraction: curr.sequence,
        })
      }
    }
  }

  return {
    characters,
    relations,
    characterFrequency,
  }
}

/**
 * 分析情节节奏
 */
export function analyzePacing(
  fragments: SceneFragment[]
): {
  overallPacing: 'fast' | 'medium' | 'slow'
  fragmentCount: number
  averageSceneLength: number
  pacingIssues: Array<{
    fragmentId: string
    issue: string
    suggestion: string
  }>
} {
  const completedFragments = fragments.filter(f => f.status === 'completed')
  
  if (completedFragments.length === 0) {
    return {
      overallPacing: 'medium',
      fragmentCount: 0,
      averageSceneLength: 0,
      pacingIssues: [],
    }
  }

  // 计算平均场景长度（基于视频时长）
  const totalDuration = completedFragments.reduce(
    (sum, f) => sum + (f.videoDuration || 0),
    0
  )
  const averageSceneLength = totalDuration / completedFragments.length

  // 判断整体节奏
  let overallPacing: 'fast' | 'medium' | 'slow' = 'medium'
  if (averageSceneLength < 3) {
    overallPacing = 'fast'
  } else if (averageSceneLength > 10) {
    overallPacing = 'slow'
  }

  // 检测节奏问题（片段长度差异过大）
  const pacingIssues: Array<{
    fragmentId: string
    issue: string
    suggestion: string
  }> = []

  completedFragments.forEach(f => {
    const duration = f.videoDuration || 0
    if (duration > 0) {
      const deviation = Math.abs(duration - averageSceneLength) / averageSceneLength
      
      if (deviation > 0.5) {
        pacingIssues.push({
          fragmentId: f.id,
          issue: `片段 ${f.sequence} 长度与平均长度差异较大（${duration.toFixed(1)}秒 vs ${averageSceneLength.toFixed(1)}秒）`,
          suggestion: deviation > 0 ? '考虑缩短该片段' : '考虑延长该片段以保持节奏',
        })
      }
    }
  })

  return {
    overallPacing,
    fragmentCount: completedFragments.length,
    averageSceneLength,
    pacingIssues,
  }
}

export type {
  Workflow,
  WorkflowStep,
  WorkflowResult,
  Task,
  BatchProcessor as BatchProcessorType,
} from './DramaScriptExcel.types'
