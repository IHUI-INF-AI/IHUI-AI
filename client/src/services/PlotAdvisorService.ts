import { t } from '@/utils/i18n'

/**
 * 剧情AI助手服务
 * 
 * 功能：
 * 1. 基于当前剧情推荐下一场景
 * 2. 检测剧情漏洞和逻辑问题
 * 3. 角色弧线分析
 * 4. 节奏分析和优化建议
 * 5. 剧本大纲生成
 * 
 * @module services/PlotAdvisorService
 * @version 1.0.0
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai'
import type { SceneFragment, Character } from '@/types/ai-platform.types'

// ============================================================================
// 类型定义
// ============================================================================

/** 场景推荐 */
export interface SceneRecommendation {
  id: string
  scene: string
  description: string
  character?: string
  reason: string
  expectedEffect: string
  continuityPoints: string[]
  confidence: number
  type: 'continuation' | 'climax' | 'resolution' | 'twist' | 'transition'
}

/** 剧情问题 */
export interface PlotIssue {
  id: string
  type: 'logic' | 'continuity' | 'character' | 'pacing' | 'structure'
  severity: 'low' | 'medium' | 'high'
  fragmentIds: string[]
  description: string
  suggestion: string
  autoFixable: boolean
}

/** 角色弧线分析 */
export interface CharacterArcAnalysis {
  characterName: string
  fragmentCount: number
  firstAppearance: number
  lastAppearance: number
  screenTime: number // 占比
  arcType: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  emotionalJourney: EmotionalPoint[]
  suggestions: string[]
}

/** 情感点 */
export interface EmotionalPoint {
  fragmentId: string
  sequence: number
  emotion: string
  intensity: number // 0-100
}

/** 节奏分析 */
export interface PacingAnalysis {
  overallPacing: 'fast' | 'medium' | 'slow' | 'uneven'
  avgSceneDuration: number
  peakMoments: number[]
  slowMoments: number[]
  rhythmScore: number // 0-100
  suggestions: string[]
}

/** 剧本大纲 */
export interface StoryOutline {
  title: string
  theme: string
  genre: string
  targetLength: number // 片段数
  acts: ActOutline[]
}

/** 幕大纲 */
export interface ActOutline {
  actNumber: number
  name: string
  purpose: string
  keyScenes: SceneOutline[]
}

/** 场景大纲 */
export interface SceneOutline {
  sequence: number
  scene: string
  description: string
  character: string
  purpose: string
}

// ============================================================================
// 剧情助手服务类
// ============================================================================

export class PlotAdvisorService {
  
  /**
   * 推荐下一场景
   */
  async recommendNextScenes(
    fragments: SceneFragment[],
    characters: Character[],
    count: number = 5
  ): Promise<SceneRecommendation[]> {
    if (fragments.length === 0) {
      return this.generateInitialSceneRecommendations(count)
    }
    
    try {
      const context = this.buildPlotContext(fragments, characters)
      
      const prompt = `作为专业的短剧编剧顾问，请基于以下剧情上下文，推荐${count}个可能的下一场景。

${context}

请推荐${count}个场景，每个场景包含：
1. scene: 场景名称
2. description: 场景详细描述（50-100字）
3. character: 主要人物
4. reason: 推荐理由
5. expectedEffect: 预期效果（对观众/剧情的影响）
6. continuityPoints: 与前面场景的连接点（数组）
7. confidence: 置信度（0-1）
8. type: 场景类型（continuation/climax/resolution/twist/transition）

以JSON数组格式输出，直接输出JSON，不要包含其他说明。`

      return await this.generateWithAI<SceneRecommendation[]>(prompt, [])
      
    } catch (error) {
      logger.error('Failed to recommend scenario:', error)
      return []
    }
  }
  
  /**
   * 检测剧情问题
   */
  async detectPlotIssues(
    fragments: SceneFragment[],
    characters: Character[]
  ): Promise<PlotIssue[]> {
    const issues: PlotIssue[] = []
    
    // 1. 检测人物一致性问题
    issues.push(...this.detectCharacterConsistencyIssues(fragments, characters))
    
    // 2. 检测场景逻辑问题
    issues.push(...this.detectSceneLogicIssues(fragments))
    
    // 3. 检测节奏问题
    issues.push(...this.detectPacingIssues(fragments))
    
    // 4. 使用AI检测更深层次的问题
    try {
      const aiIssues = await this.detectIssuesWithAI(fragments)
      issues.push(...aiIssues)
    } catch (error) {
      logger.warn('AI problem detection failed:', error)
    }
    
    // 去重并按严重程度排序
    const uniqueIssues = this.deduplicateIssues(issues)
    return uniqueIssues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
  }
  
  /**
   * 分析角色弧线
   */
  async analyzeCharacterArc(
    characterName: string,
    fragments: SceneFragment[],
    _characters: Character[]
  ): Promise<CharacterArcAnalysis | null> {
    const characterFragments = fragments.filter(f => f.character === characterName)
    
    if (characterFragments.length === 0) {
      return null
    }
    
    const firstAppearance = characterFragments[0].sequence
    const lastAppearance = characterFragments[characterFragments.length - 1].sequence
    const screenTime = (characterFragments.length / fragments.length) * 100
    
    // 分析情感轨迹
    const emotionalJourney = this.analyzeEmotionalJourney(characterFragments)
    
    // 确定角色类型
    let arcType: CharacterArcAnalysis['arcType'] = 'minor'
    if (screenTime > 40) {
      arcType = 'protagonist'
    } else if (screenTime > 20) {
      arcType = 'supporting'
    } else if (screenTime > 10) {
      arcType = 'antagonist' // 简化判断
    }
    
    // 生成建议
    const suggestions = await this.generateCharacterSuggestions(
      characterName,
      characterFragments,
      arcType
    )
    
    return {
      characterName,
      fragmentCount: characterFragments.length,
      firstAppearance,
      lastAppearance,
      screenTime,
      arcType,
      emotionalJourney,
      suggestions,
    }
  }
  
  /**
   * 分析节奏
   */
  analyzePacing(fragments: SceneFragment[]): PacingAnalysis {
    const completedFragments = fragments.filter(f => f.status === 'completed')
    
    if (completedFragments.length === 0) {
      return {
        overallPacing: 'medium',
        avgSceneDuration: 0,
        peakMoments: [],
        slowMoments: [],
        rhythmScore: 0,
        suggestions: ['需要先完成一些片段才能分析节奏'],
      }
    }
    
    // 计算平均时长
    const durations = completedFragments.map(f => f.videoDuration || 5)
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    
    // 分析节奏变化
    const peakMoments: number[] = []
    const slowMoments: number[] = []
    
    durations.forEach((duration, index) => {
      if (duration < avgDuration * 0.7) {
        peakMoments.push(index)
      } else if (duration > avgDuration * 1.3) {
        slowMoments.push(index)
      }
    })
    
    // 确定整体节奏
    let overallPacing: PacingAnalysis['overallPacing'] = 'medium'
    if (avgDuration < 3) {
      overallPacing = 'fast'
    } else if (avgDuration > 8) {
      overallPacing = 'slow'
    }
    
    // 检查节奏是否不均匀
    const durationVariance = this.calculateVariance(durations)
    if (durationVariance > avgDuration * 0.5) {
      overallPacing = 'uneven'
    }
    
    // 计算节奏分数
    let rhythmScore = 70
    if (overallPacing === 'uneven') rhythmScore -= 20
    if (peakMoments.length === 0) rhythmScore -= 10
    if (slowMoments.length > completedFragments.length * 0.3) rhythmScore -= 15
    
    // 生成建议
    const suggestions: string[] = []
    if (overallPacing === 'slow') {
      suggestions.push('整体节奏偏慢，建议增加一些快节奏的场景')
    }
    if (overallPacing === 'fast') {
      suggestions.push('节奏较快，确保观众有时间消化剧情')
    }
    if (overallPacing === 'uneven') {
      suggestions.push('节奏不均匀，建议调整场景时长使其更加平衡')
    }
    if (peakMoments.length === 0 && completedFragments.length > 5) {
      suggestions.push('缺少高潮点，建议添加一些紧张刺激的场景')
    }
    
    return {
      overallPacing,
      avgSceneDuration: avgDuration,
      peakMoments,
      slowMoments,
      rhythmScore: Math.max(0, rhythmScore),
      suggestions,
    }
  }
  
  /**
   * 生成剧本大纲
   */
  async generateOutline(
    theme: string,
    genre: string,
    episodeCount: number
  ): Promise<StoryOutline> {
    const prompt = `作为专业的短剧编剧，请为以下主题生成一个完整的剧本大纲。

主题：${theme}
类型：${genre}
目标片段数：${episodeCount}

请生成包含以下内容的大纲：
1. title: 剧本标题
2. theme: 核心主题
3. genre: 具体类型
4. targetLength: 目标片段数
5. acts: 幕数组，每幕包含：
   - actNumber: 幕号
   - name: 幕名称
   - purpose: 幕的目的
   - keyScenes: 关键场景数组，每个场景包含：
     - sequence: 序号
     - scene: 场景名称
     - description: 场景描述
     - character: 主要人物
     - purpose: 场景目的

以JSON格式输出，直接输出JSON，不要包含其他说明。`

    const defaultOutline: StoryOutline = {
      title: theme,
      theme,
      genre,
      targetLength: episodeCount,
      acts: [
        {
          actNumber: 1,
          name: '开端',
          purpose: '介绍主角和背景',
          keyScenes: [],
        },
        {
          actNumber: 2,
          name: '发展',
          purpose: '推进剧情，制造冲突',
          keyScenes: [],
        },
        {
          actNumber: 3,
          name: '高潮与结局',
          purpose: '解决冲突，结束故事',
          keyScenes: [],
        },
      ],
    }

    return await this.generateWithAI<StoryOutline>(prompt, defaultOutline)
  }
  
  // ==========================================================================
  // 内部方法
  // ==========================================================================
  
  private buildPlotContext(fragments: SceneFragment[], _characters: Character[]): string {
    const recentFragments = fragments.slice(-5)
    
    let context = '【当前剧情】\n'
    
    // 角色信息
    const activeCharacters = [...new Set(fragments.map(f => f.character).filter(Boolean))]
    if (activeCharacters.length > 0) {
      context += `主要人物：${activeCharacters.join('、')}\n`
    }
    
    // 场景历史
    const scenes = [...new Set(fragments.map(f => f.scene).filter(Boolean))]
    if (scenes.length > 0) {
      context += `出现过的场景：${scenes.slice(-5).join(' → ')}\n`
    }
    
    // 最近剧情
    context += '\n【最近剧情】\n'
    recentFragments.forEach(f => {
      context += `第${f.sequence}段：${f.character}在${f.scene}，${f.description}\n`
    })
    
    // 最后一段详情
    const lastFragment = fragments[fragments.length - 1]
    context += `\n【最后一段详情】\n`
    context += `人物：${lastFragment.character || '未指定'}\n`
    context += `场景：${lastFragment.scene || '未指定'}\n`
    context += `描述：${lastFragment.description || '未指定'}\n`
    
    return context
  }
  
  private async generateWithAI<T>(prompt: string, defaultValue: T): Promise<T> {
    return new Promise((resolve) => {
      let result = ''
      
      void streamGenerateContent(
        {
          prompt,
          modelId: 'gpt-4',
          type: 'text',
          parameters: {
            temperature: 0.7,
            maxTokens: 2000,
          },
        },
        (chunk: string) => {
          result += chunk
        },
        () => {
          try {
            // 尝试提取JSON
            const jsonMatch = result.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]))
            } else {
              resolve(defaultValue)
            }
          } catch {
            resolve(defaultValue)
          }
        },
        () => resolve(defaultValue)
      )
    })
  }
  
  private generateInitialSceneRecommendations(count: number): SceneRecommendation[] {
    const templates: SceneRecommendation[] = [
      {
        id: '1',
        scene: '都市街道',
        description: t('text.plot_advisor_service.繁华的城市街道人'),
        character: '主角',
        reason: '经典的都市开场，便于引入主角',
        expectedEffect: '建立都市背景，引起观众共鸣',
        continuityPoints: [],
        confidence: 0.8,
        type: 'continuation',
      },
      {
        id: '2',
        scene: '咖啡厅',
        description: t('text.plot_advisor_service.温馨的咖啡厅阳光1'),
        character: '主角',
        reason: '适合对话和情感铺垫',
        expectedEffect: '营造轻松氛围，便于角色互动',
        continuityPoints: [],
        confidence: 0.75,
        type: 'continuation',
      },
      {
        id: '3',
        scene: '办公室',
        description: t('text.plot_advisor_service.现代化的办公室繁2'),
        character: '主角',
        reason: '职场题材的经典开场',
        expectedEffect: '展现主角的职业身份',
        continuityPoints: [],
        confidence: 0.7,
        type: 'continuation',
      },
    ]
    
    return templates.slice(0, count)
  }
  
  private detectCharacterConsistencyIssues(
    fragments: SceneFragment[],
    _characters: Character[]
  ): PlotIssue[] {
    const issues: PlotIssue[] = []
    const characterAppearances = new Map<string, SceneFragment[]>()
    
    // 按角色分组
    fragments.forEach(f => {
      if (f.character) {
        if (!characterAppearances.has(f.character)) {
          characterAppearances.set(f.character, [])
        }
        characterAppearances.get(f.character)!.push(f)
      }
    })
    
    // 检查形象一致性
    characterAppearances.forEach((frags, charName) => {
      const appearances = frags
        .map(f => f.characterAppearance?.description)
        .filter(Boolean)
      
      const uniqueAppearances = new Set(appearances)
      if (uniqueAppearances.size > 1) {
        issues.push({
          id: `char-consistency-${charName}`,
          type: 'character',
          severity: 'medium',
          fragmentIds: frags.map(f => f.id),
          description: `人物"${charName}"在不同片段中的形象描述不一致`,
          suggestion: '统一人物形象描述，确保角色一致性',
          autoFixable: true,
        })
      }
    })
    
    return issues
  }
  
  private detectSceneLogicIssues(fragments: SceneFragment[]): PlotIssue[] {
    const issues: PlotIssue[] = []
    
    // 检查场景跳跃
    for (let i = 1; i < fragments.length; i++) {
      const prev = fragments[i - 1]
      const curr = fragments[i]
      
      // 如果人物不同且场景不同，可能需要过渡
      if (prev.character && curr.character && prev.character !== curr.character) {
        if (prev.scene && curr.scene && prev.scene !== curr.scene) {
          // 检查是否有过渡暗示
          const hasTransition = curr.description?.includes('来到') ||
                              curr.description?.includes('走进') ||
                              curr.description?.includes('进入')
          
          if (!hasTransition) {
            issues.push({
              id: `scene-jump-${curr.id}`,
              type: 'continuity',
              severity: 'low',
              fragmentIds: [prev.id, curr.id],
              description: `从"${prev.scene}"到"${curr.scene}"的场景转换可能需要过渡`,
              suggestion: '添加过渡描述或中间场景',
              autoFixable: false,
            })
          }
        }
      }
    }
    
    return issues
  }
  
  private detectPacingIssues(fragments: SceneFragment[]): PlotIssue[] {
    const issues: PlotIssue[] = []
    const completedFragments = fragments.filter(f => f.status === 'completed' && f.videoDuration)
    
    if (completedFragments.length < 3) return issues
    
    const durations = completedFragments.map(f => f.videoDuration!)
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    
    // 检查过长或过短的片段
    completedFragments.forEach(f => {
      const duration = f.videoDuration!
      if (duration > avgDuration * 2) {
        issues.push({
          id: `pacing-long-${f.id}`,
          type: 'pacing',
          severity: 'low',
          fragmentIds: [f.id],
          description: `片段${f.sequence}时长(${duration.toFixed(1)}秒)明显超过平均时长`,
          suggestion: '考虑拆分为多个片段或缩短内容',
          autoFixable: false,
        })
      } else if (duration < avgDuration * 0.3) {
        issues.push({
          id: `pacing-short-${f.id}`,
          type: 'pacing',
          severity: 'low',
          fragmentIds: [f.id],
          description: `片段${f.sequence}时长(${duration.toFixed(1)}秒)过短`,
          suggestion: '考虑与相邻片段合并或添加更多内容',
          autoFixable: false,
        })
      }
    })
    
    return issues
  }
  
  private async detectIssuesWithAI(fragments: SceneFragment[]): Promise<PlotIssue[]> {
    if (fragments.length < 3) return []
    
    const plotSummary = fragments
      .slice(-10)
      .map(f => `${f.sequence}. ${f.character}在${f.scene}: ${f.description}`)
      .join('\n')
    
    const prompt = `作为剧本分析专家，请检查以下剧情是否存在逻辑问题：

${plotSummary}

如果发现问题，请以JSON数组格式输出，每个问题包含：
- type: 问题类型（logic/continuity/character/pacing/structure）
- severity: 严重程度（low/medium/high）
- description: 问题描述
- suggestion: 改进建议

如果没有问题，返回空数组[]。直接输出JSON，不要包含其他说明。`

    interface AIIssue {
      type?: string
      severity?: string
      description?: string
      suggestion?: string
    }
    const aiIssues = await this.generateWithAI<AIIssue[]>(prompt, [])
    
    return aiIssues.map((issue: AIIssue, index: number) => ({
      id: `ai-issue-${index}`,
      type: (issue.type || 'logic') as 'structure' | 'character' | 'logic' | 'pacing' | 'continuity',
      severity: (issue.severity || 'low') as 'low' | 'medium' | 'high',
      fragmentIds: [] as string[],
      description: issue.description || '',
      suggestion: issue.suggestion || '',
      autoFixable: false as const,
    }))
  }
  
  private analyzeEmotionalJourney(fragments: SceneFragment[]): EmotionalPoint[] {
    return fragments.map(f => {
      // 简单的情感分析（可以后续用AI增强）
      let emotion = '平静'
      let intensity = 50
      
      const desc = f.description?.toLowerCase() || ''
      
      if (desc.includes('开心') || desc.includes('高兴') || desc.includes('笑')) {
        emotion = '快乐'
        intensity = 70
      } else if (desc.includes('伤心') || desc.includes('难过') || desc.includes('哭')) {
        emotion = '悲伤'
        intensity = 60
      } else if (desc.includes('生气') || desc.includes('愤怒')) {
        emotion = '愤怒'
        intensity = 75
      } else if (desc.includes('紧张') || desc.includes('害怕')) {
        emotion = '紧张'
        intensity = 65
      }
      
      return {
        fragmentId: f.id,
        sequence: f.sequence,
        emotion,
        intensity,
      }
    })
  }
  
  private async generateCharacterSuggestions(
    characterName: string,
    fragments: SceneFragment[],
    arcType: CharacterArcAnalysis['arcType']
  ): Promise<string[]> {
    const suggestions: string[] = []
    
    if (arcType === 'protagonist' && fragments.length < 5) {
      suggestions.push('主角出场次数较少，建议增加更多主角戏份')
    }
    
    if (arcType === 'minor' && fragments.length > 3) {
      suggestions.push('该角色出场较多但定位为配角，考虑提升其重要性或减少出场')
    }
    
    // 检查角色是否有成长/变化
    const firstDesc = fragments[0]?.description || ''
    const lastDesc = fragments[fragments.length - 1]?.description || ''
    if (firstDesc === lastDesc) {
      suggestions.push('角色缺乏变化，建议添加角色成长或转变的情节')
    }
    
    return suggestions
  }
  
  private deduplicateIssues(issues: PlotIssue[]): PlotIssue[] {
    const seen = new Set<string>()
    return issues.filter(issue => {
      const key = `${issue.type}-${issue.description}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  
  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length
    const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2))
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length)
  }
}

// ============================================================================
// Vue Composable
// ============================================================================

let instance: PlotAdvisorService | null = null

/**
 * 使用剧情助手
 */
export function usePlotAdvisor() {
  if (!instance) {
    instance = new PlotAdvisorService()
  }
  
  const isAnalyzing: Ref<boolean> = ref(false)
  const recommendations: Ref<SceneRecommendation[]> = ref([])
  const issues: Ref<PlotIssue[]> = ref([])
  
  const recommendScenes = async (
    fragments: SceneFragment[],
    characters: Character[],
    count?: number
  ) => {
    isAnalyzing.value = true
    try {
      recommendations.value = await instance!.recommendNextScenes(fragments, characters, count)
      return recommendations.value
    } finally {
      isAnalyzing.value = false
    }
  }
  
  const detectIssues = async (
    fragments: SceneFragment[],
    characters: Character[]
  ) => {
    isAnalyzing.value = true
    try {
      issues.value = await instance!.detectPlotIssues(fragments, characters)
      return issues.value
    } finally {
      isAnalyzing.value = false
    }
  }
  
  return {
    service: instance,
    isAnalyzing,
    recommendations,
    issues,
    
    recommendScenes,
    detectIssues,
    analyzeCharacterArc: instance.analyzeCharacterArc.bind(instance),
    analyzePacing: instance.analyzePacing.bind(instance),
    generateOutline: instance.generateOutline.bind(instance),
  }
}

export default PlotAdvisorService
