/**
 * 提示词优化器服务
 * 
 * 功能：
 * 1. 分析和评估提示词质量
 * 2. 根据不同模型特点优化提示词
 * 3. 添加风格/质量关键词
 * 4. 提供优化建议
 * 
 * @module services/PromptOptimizerService
 * @version 1.0.0
 */

import { ref, type Ref } from 'vue'
import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import i18n from '@/locales'
import type {
  PromptScore,
  EnhancedPrompt,
  GenerationType,
} from '@/types/ai-platform.types'

// 类型安全的 i18n 翻译函数
type TranslateFn = (key: string, params?: Record<string, string | number>) => string
const t = (key: string, params?: Record<string, string | number>): string =>
  (i18n.global as unknown as { t: TranslateFn }).t(key, params as Record<string, string | number> | undefined)
const tm = (key: string): unknown =>
  (i18n.global as unknown as { tm: (key: string) => unknown }).tm(key)

// ============================================================================
// 类型定义
// ============================================================================

/** 模型提示词配置 */
interface ModelPromptConfig {
  name: string
  maxLength: number
  qualityKeywords: string[]
  styleKeywords: Record<string, string[]>
  negativePromptSupported: boolean
  tips: string[]
}

/** 优化选项 */
interface OptimizeOptions {
  /** 目标模型 */
  targetModel?: string
  /** 生成类型 */
  type: GenerationType
  /** 目标风格 */
  style?: string
  /** 添加质量关键词 */
  addQualityKeywords?: boolean
  /** 自动翻译为英文 */
  translateToEnglish?: boolean
  /** 最大迭代次数 */
  maxIterations?: number
  /** 目标评分 */
  targetScore?: number
}

/** 分析结果 */
interface PromptAnalysis {
  /** 原始提示词 */
  original: string
  /** 语言 */
  language: 'chinese' | 'english' | 'mixed'
  /** 长度评估 */
  lengthAssessment: 'too_short' | 'good' | 'too_long'
  /** 包含的元素 */
  elements: {
    subject: boolean
    scene: boolean
    action: boolean
    style: boolean
    quality: boolean
    lighting: boolean
    camera: boolean
    emotion: boolean
  }
  /** 问题 */
  issues: string[]
  /** 建议 */
  suggestions: string[]
}

// ============================================================================
// 模型配置
// ============================================================================

// 模型基础配置（非 i18n 字段）
const MODEL_BASE_CONFIGS: Record<string, Pick<ModelPromptConfig, 'maxLength' | 'negativePromptSupported'>> = {
  'qwen-image': { maxLength: 500, negativePromptSupported: true },
  'doubao-image': { maxLength: 400, negativePromptSupported: true },
  'jimeng-image': { maxLength: 600, negativePromptSupported: true },
  'kling-video': { maxLength: 300, negativePromptSupported: false },
  'qwen-video': { maxLength: 400, negativePromptSupported: false },
  'default': { maxLength: 500, negativePromptSupported: false },
}

// 获取模型完整配置（i18n 字段在运行时从语言包获取）
const getModelConfig = (key: string): ModelPromptConfig => {
  const base = MODEL_BASE_CONFIGS[key] || MODEL_BASE_CONFIGS.default
  return {
    name: t(`promptOptimizer.models.${key}`),
    maxLength: base.maxLength,
    qualityKeywords: (tm(`promptOptimizer.qualityKeywords.${key}`) || []) as string[],
    styleKeywords: (tm(`promptOptimizer.styleKeywords.${key}`) || {}) as Record<string, string[]>,
    negativePromptSupported: base.negativePromptSupported,
    tips: (tm(`promptOptimizer.tips.${key}`) || []) as string[],
  }
}

// 获取所有模型配置
const getAllModelConfigs = (): Record<string, ModelPromptConfig> =>
  Object.keys(MODEL_BASE_CONFIGS).reduce((acc, key) => {
    acc[key] = getModelConfig(key)
    return acc
  }, {} as Record<string, ModelPromptConfig>)

// ============================================================================
// 分析函数
// ============================================================================

/**
 * 分析提示词
 */
const analyzePrompt = (prompt: string, type: GenerationType): PromptAnalysis => {
  const issues: string[] = []
  const suggestions: string[] = []
  
  // 检测语言
  const chineseChars = (prompt.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishChars = (prompt.match(/[a-zA-Z]/g) || []).length
  let language: 'chinese' | 'english' | 'mixed' = 'mixed'
  if (chineseChars > englishChars * 2) {
    language = 'chinese'
  } else if (englishChars > chineseChars * 2) {
    language = 'english'
  }
  
  // 长度评估
  let lengthAssessment: 'too_short' | 'good' | 'too_long' = 'good'
  if (prompt.length < 10) {
    lengthAssessment = 'too_short'
    issues.push(t('promptOptimizer.analysis.promptTooShort'))
    suggestions.push(t('promptOptimizer.analysis.addMoreDetails'))
  } else if (prompt.length > 500) {
    lengthAssessment = 'too_long'
    issues.push(t('promptOptimizer.analysis.promptTooLong'))
    suggestions.push(t('promptOptimizer.analysis.simplifyDescription'))
  }
  
  // 检测包含的元素
  const elements = {
    subject: false,
    scene: false,
    action: false,
    style: false,
    quality: false,
    lighting: false,
    camera: false,
    emotion: false,
  }
  
  // 主体关键词
  const subjectKeywords = ['人', '女', '男', '少女', '男孩', '动物', '猫', '狗', '花', '建筑', '车', 'person', 'girl', 'boy', 'woman', 'man']
  elements.subject = subjectKeywords.some(k => prompt.includes(k))
  
  // 场景关键词
  const sceneKeywords = ['场景', '背景', '地方', '环境', '森林', '城市', '室内', '海边', '山', 'scene', 'background', 'forest', 'city', 'indoor', 'beach']
  elements.scene = sceneKeywords.some(k => prompt.includes(k))
  
  // 动作关键词（对于视频特别重要）
  const actionKeywords = ['走', '跑', '跳', '飞', '动', '移动', 'walk', 'run', 'jump', 'fly', 'move', 'dance']
  elements.action = actionKeywords.some(k => prompt.includes(k))
  
  // 风格关键词
  const styleKeywords = ['风格', '样式', '写实', '动漫', '油画', '水彩', 'style', 'anime', 'realistic', 'painting']
  elements.style = styleKeywords.some(k => prompt.includes(k))
  
  // 质量关键词
  const qualityKeywords = ['高清', '4K', '8K', '精细', '清晰', 'HD', '4k', '8k', 'high quality', 'detailed']
  elements.quality = qualityKeywords.some(k => prompt.includes(k))
  
  // 光线关键词
  const lightingKeywords = ['光', '阳光', '灯光', '柔和', '明亮', '暗', 'light', 'sunshine', 'bright', 'dark', 'soft light']
  elements.lighting = lightingKeywords.some(k => prompt.includes(k))
  
  // 构图/镜头关键词
  const cameraKeywords = ['特写', '全景', '俯视', '仰视', '正面', 'close-up', 'panorama', 'aerial', 'portrait']
  elements.camera = cameraKeywords.some(k => prompt.includes(k))
  
  // 情感关键词
  const emotionKeywords = ['快乐', '悲伤', '愤怒', '平静', '温馨', 'happy', 'sad', 'angry', 'calm', 'warm']
  elements.emotion = emotionKeywords.some(k => prompt.includes(k))
  
  // 基于元素生成建议
  if (!elements.subject) {
    suggestions.push(t('promptOptimizer.analysis.addSubject'))
  }
  if (!elements.scene && type === 'image') {
    suggestions.push(t('promptOptimizer.analysis.addScene'))
  }
  if (!elements.action && type === 'video') {
    suggestions.push(t('promptOptimizer.analysis.videoNeedsAction'))
  }
  if (!elements.style) {
    suggestions.push(t('promptOptimizer.analysis.addStyle'))
  }
  if (!elements.quality) {
    suggestions.push(t('promptOptimizer.analysis.addQuality'))
  }
  
  return {
    original: prompt,
    language,
    lengthAssessment,
    elements,
    issues,
    suggestions,
  }
}

/**
 * 评估提示词质量分数
 */
const scorePrompt = (prompt: string, type: GenerationType): PromptScore => {
  const analysis = analyzePrompt(prompt, type)
  
  let completeness = 100
  let detail = 100
  let consistency = 100
  let creativity = 80
  
  // 基于分析结果计算分数
  if (analysis.lengthAssessment === 'too_short') {
    completeness -= 30
    detail -= 40
  } else if (analysis.lengthAssessment === 'too_long') {
    consistency -= 20
  }
  
  // 元素完整性
  const elementCount = Object.values(analysis.elements).filter(Boolean).length
  completeness -= Math.max(0, (5 - elementCount) * 10)
  
  // 特定类型要求
  if (type === 'video' && !analysis.elements.action) {
    completeness -= 20
    analysis.issues.push(t('promptOptimizer.analysis.videoMissingAction'))
  }
  
  // 细节程度
  if (!analysis.elements.lighting && !analysis.elements.camera) {
    detail -= 15
  }
  
  const overall = Math.round((completeness + detail + consistency + creativity) / 4)
  
  return {
    overall: Math.max(0, Math.min(100, overall)),
    completeness: Math.max(0, Math.min(100, completeness)),
    detail: Math.max(0, Math.min(100, detail)),
    consistency: Math.max(0, Math.min(100, consistency)),
    creativity: Math.max(0, Math.min(100, creativity)),
    issues: analysis.issues,
    suggestions: analysis.suggestions,
  }
}

// ============================================================================
// 优化函数
// ============================================================================

/**
 * 优化提示词
 */
const optimizePrompt = async (
  prompt: string,
  options: OptimizeOptions
): Promise<EnhancedPrompt> => {
  const {
    targetModel,
    type,
    style,
    addQualityKeywords = true,
    translateToEnglish = false,
    maxIterations = 2,
    targetScore = 80,
  } = options
  
  // 获取模型配置
  const modelConfig = getModelConfig(targetModel || 'default')
  
  // 初始分析
  const initialAnalysis = analyzePrompt(prompt, type)
  const initialScore = scorePrompt(prompt, type)
  
  // 如果分数已经足够高，直接返回
  if (initialScore.overall >= targetScore) {
    return {
      prompt,
      score: initialScore,
      contextUsed: false,
      optimized: false,
    }
  }
  
  let bestPrompt = prompt
  let bestScore = initialScore
  
  // 迭代优化
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    try {
      const optimizedPrompt = await generateOptimizedPrompt(
        bestPrompt,
        type,
        modelConfig,
        initialAnalysis,
        bestScore,
        {
          style,
          addQualityKeywords,
          translateToEnglish,
        }
      )
      
      const newScore = scorePrompt(optimizedPrompt, type)
      
      if (newScore.overall > bestScore.overall) {
        bestPrompt = optimizedPrompt
        bestScore = newScore
      }
      
      // 达到目标分数，停止迭代
      if (newScore.overall >= targetScore) {
        break
      }
      
      // 等待一下再继续
      await new Promise(resolve => setTimeout(resolve, 300))
      
    } catch (error) {
      logger.error('Failed to optimize prompt:', error)
      break
    }
  }
  
  return {
    prompt: bestPrompt,
    score: bestScore,
    contextUsed: false,
    optimized: bestPrompt !== prompt,
    iterations: maxIterations,
  }
}

/**
 * 使用AI生成优化后的提示词
 */
const generateOptimizedPrompt = async (
  prompt: string,
  type: GenerationType,
  modelConfig: ModelPromptConfig,
  analysis: PromptAnalysis,
  score: PromptScore,
  options: {
    style?: string
    addQualityKeywords?: boolean
    translateToEnglish?: boolean
  }
): Promise<string> => {
  const { style, addQualityKeywords, translateToEnglish } = options
  
  const styleKeywords = style && modelConfig.styleKeywords[style]
    ? modelConfig.styleKeywords[style].join('、')
    : ''
  
  const qualityKeywords = addQualityKeywords
    ? modelConfig.qualityKeywords.slice(0, 3).join('、')
    : ''
  
  const typeLabel = type === 'image'
    ? t('promptOptimizer.typeLabel.image')
    : type === 'video'
      ? t('promptOptimizer.typeLabel.video')
      : t('promptOptimizer.typeLabel.content')

  const systemPrompt = t('promptOptimizer.prompt.system', {
    typeLabel,
    modelName: modelConfig.name,
    maxLength: modelConfig.maxLength,
    principle4: type === 'video'
      ? t('promptOptimizer.prompt.principle4Video')
      : t('promptOptimizer.prompt.principle4Image'),
    stylePart: styleKeywords ? `${t('promptOptimizer.prompt.recommendedStyle')}：${styleKeywords}\n` : '',
    qualityPart: qualityKeywords ? `${t('promptOptimizer.prompt.recommendedQuality')}：${qualityKeywords}\n` : '',
    outputLang: translateToEnglish
      ? t('promptOptimizer.prompt.outputEnglish')
      : t('promptOptimizer.prompt.outputChinese'),
  })

  const userPrompt = t('promptOptimizer.prompt.userPrompt', {
    typeLabel,
    prompt,
    issues: score.issues.map(issue => `- ${issue}`).join('\n'),
    suggestions: score.suggestions.map(suggestion => `- ${suggestion}`).join('\n'),
  })

  return new Promise<string>((resolve, reject) => {
    let result = ''
    
    void streamGenerateContent(
      {
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        modelId: 'gpt-3.5-turbo',
        type: 'text',
        parameters: {
          temperature: 0.6,
          maxTokens: modelConfig.maxLength + 100,
        },
      },
      (chunk: string) => {
        result += chunk
      },
      () => {
        // 清理输出
        let cleaned = result.trim()
        
        // 移除可能的引号
        if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
            (cleaned.startsWith('「') && cleaned.endsWith('」'))) {
          cleaned = cleaned.slice(1, -1)
        }
        
        // 移除可能的前缀
        const prefixes = ['优化后：', '优化后的提示词：', 'Optimized:', 'Prompt:']
        for (const prefix of prefixes) {
          if (cleaned.startsWith(prefix)) {
            cleaned = cleaned.substring(prefix.length).trim()
            break
          }
        }
        
        resolve(cleaned)
      },
      (error) => {
        reject(error)
      }
    )
  })
}

/**
 * 快速增强提示词（不使用AI）
 */
const quickEnhance = (
  prompt: string,
  options: {
    type: GenerationType
    model?: string
    style?: string
    addQuality?: boolean
  }
): string => {
  const { type, model, style, addQuality = true } = options
  const modelConfig = getModelConfig(model || 'default')

  let enhanced = prompt.trim()

  // 添加风格关键词
  if (style && modelConfig.styleKeywords[style]) {
    const styleWords = modelConfig.styleKeywords[style]
    const hasStyle = styleWords.some(w => prompt.includes(w))
    if (!hasStyle) {
      enhanced += `，${styleWords[0]}${t('promptOptimizer.quickEnhance.styleSuffix')}`
    }
  }

  // 添加质量关键词
  if (addQuality) {
    const hasQuality = modelConfig.qualityKeywords.some(w => prompt.includes(w))
    if (!hasQuality) {
      enhanced += `，${modelConfig.qualityKeywords[0]}`
    }
  }

  // 视频特殊处理
  if (type === 'video') {
    const hasAction = ['动', '走', '跑', '飞', '变', '转', 'move', 'walk', 'run'].some(w => prompt.includes(w))
    if (!hasAction) {
      enhanced += `，${t('promptOptimizer.quickEnhance.naturalMotion')}`
    }
  }
  
  // 限制长度
  if (enhanced.length > modelConfig.maxLength) {
    enhanced = enhanced.substring(0, modelConfig.maxLength - 3) + '...'
  }
  
  return enhanced
}

/**
 * 生成负面提示词
 */
const generateNegativePrompt = (
  type: GenerationType,
  style?: string
): string => {
  const commonNegative = (tm('promptOptimizer.negativePrompt.common') || []) as string[]
  const imageNegative = (tm('promptOptimizer.negativePrompt.image') || []) as string[]
  const videoNegative = (tm('promptOptimizer.negativePrompt.video') || []) as string[]

  let negative = [...commonNegative]

  if (type === 'image') {
    negative = [...negative, ...imageNegative]
  } else if (type === 'video') {
    negative = [...negative, ...videoNegative]
  }

  // 根据风格添加特定负面词
  if (style === 'realistic') {
    negative.push(...((tm('promptOptimizer.negativePrompt.realistic') || []) as string[]))
  } else if (style === 'anime') {
    negative.push(...((tm('promptOptimizer.negativePrompt.anime') || []) as string[]))
  }

  return negative.join(', ')
}

// ============================================================================
// Vue Composable
// ============================================================================

/**
 * 使用提示词优化器
 */
export function usePromptOptimizer() {
  const isOptimizing: Ref<boolean> = ref(false)
  const lastAnalysis: Ref<PromptAnalysis | null> = ref(null)
  const lastScore: Ref<PromptScore | null> = ref(null)
  
  const optimize = async (
    prompt: string,
    options: OptimizeOptions
  ): Promise<EnhancedPrompt> => {
    isOptimizing.value = true
    try {
      const result = await optimizePrompt(prompt, options)
      lastScore.value = result.score
      return result
    } finally {
      isOptimizing.value = false
    }
  }
  
  const analyze = (prompt: string, type: GenerationType): PromptAnalysis => {
    const result = analyzePrompt(prompt, type)
    lastAnalysis.value = result
    lastScore.value = scorePrompt(prompt, type)
    return result
  }
  
  return {
    // 状态
    isOptimizing,
    lastAnalysis,
    lastScore,
    
    // 方法
    optimize,
    analyze,
    scorePrompt,
    quickEnhance,
    generateNegativePrompt,
    
    // 配置
    modelConfigs: getAllModelConfigs(),
  }
}

// 默认导出
export default usePromptOptimizer
