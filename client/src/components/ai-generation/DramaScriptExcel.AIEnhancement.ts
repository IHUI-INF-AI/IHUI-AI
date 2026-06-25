/**
 * AI增强模块 - 智能提示词生成与优化
 * 
 * 功能：
 * 1. 上下文感知的提示词生成
 * 2. 提示词质量评分
 * 3. 自动优化提示词
 * 4. 风格一致性检测
 */

import { streamGenerateContent } from '@/api/ai/ai'
import { logger } from '@/utils/logger'
import type {
  SceneFragment,
  Character,
  ContextSummary,
  CharacterRelationship,
  SceneTransition,
} from './DramaScriptExcel.types'

export interface PromptScore {
  overall: number
  completeness: number
  consistency: number
  detail: number
  issues: string[]
  suggestions: string[]
}

export interface EnhancedPrompt {
  prompt: string
  score: PromptScore
  contextUsed: boolean
  optimized: boolean
}

// ========== 上下文分析 ==========

/**
 * 分析剧本上下文，提取关键信息
 */
export function analyzeContext(
  fragments: SceneFragment[],
  currentIndex: number,
  contextWindow: number = 5
): ContextSummary {
  const currentFragment = fragments[currentIndex]
  if (!currentFragment) {
    return {
      characters: [],
      sceneFlow: [],
      plotSummary: '',
      keyElements: [],
      previousFragments: [],
    }
  }

  // 获取上下文片段（当前片段之前的N个片段）
  const startIndex = Math.max(0, currentIndex - contextWindow)
  const contextFragments = fragments.slice(startIndex, currentIndex)
  const previousFragments = contextFragments.filter(f => f.status === 'completed')

  // 分析角色关系
  const characterMap = new Map<string, CharacterRelationship>()
  
  contextFragments.forEach((fragment, _idx) => {
    if (!fragment.character) return
    
    const charName = fragment.character
    if (!characterMap.has(charName)) {
      characterMap.set(charName, {
        character: charName,
        appearance: fragment.characterAppearance.description || '',
        voice: fragment.voice.description || '',
        fragmentCount: 0,
        lastAppearance: fragment.sequence,
      })
    }
    
    const charRel = characterMap.get(charName)!
    charRel.fragmentCount++
    charRel.lastAppearance = Math.max(charRel.lastAppearance, fragment.sequence)
    
    // 更新形象和声音（使用最新的）
    if (fragment.characterAppearance.description) {
      charRel.appearance = fragment.characterAppearance.description
    }
    if (fragment.voice.description) {
      charRel.voice = fragment.voice.description
    }
  })

  // 分析场景流转
  const sceneFlow: SceneTransition[] = []
  for (let i = 1; i < contextFragments.length; i++) {
    const prev = contextFragments[i - 1]
    const curr = contextFragments[i]
    
    if (prev.scene && curr.scene) {
      const transitionType: SceneTransition['transitionType'] = 
        prev.scene === curr.scene ? 'same' :
        prev.scene.toLowerCase().includes(curr.scene.toLowerCase()) || 
        curr.scene.toLowerCase().includes(prev.scene.toLowerCase()) ? 'related' :
        'different'
      
      sceneFlow.push({
        from: prev.scene,
        to: curr.scene,
        sequence: curr.sequence,
        transitionType,
      })
    }
  }

  // 生成剧情摘要（提取关键描述）
  const plotSummary = contextFragments
    .filter(f => f.description)
    .slice(-3)  // 只取最后3段的描述
    .map(f => f.description)
    .join('；')

  // 提取关键元素
  const keyElements: string[] = []
  contextFragments.forEach(f => {
    if (f.character && !keyElements.includes(f.character)) {
      keyElements.push(f.character)
    }
    if (f.scene && !keyElements.includes(f.scene)) {
      keyElements.push(f.scene)
    }
  })

  return {
    characters: Array.from(characterMap.values()),
    sceneFlow,
    plotSummary,
    keyElements,
    previousFragments,
  }
}

// ========== 提示词质量评分 ==========

/**
 * 评估提示词质量
 */
export async function scorePrompt(
  prompt: string,
  fragment: SceneFragment,
  characters: Character[]
): Promise<PromptScore> {
  const issues: string[] = []
  const suggestions: string[] = []
  let completeness = 100
  let consistency = 100
  let detail = 100

  // 1. 完整性检查
  if (!prompt || prompt.trim().length < 20) {
    issues.push('提示词过短，缺少必要信息')
    completeness -= 30
    suggestions.push('增加场景、人物、动作等详细描述')
  }

  // 检查是否包含关键信息
  const hasCharacter = fragment.character && prompt.includes(fragment.character)
  const hasScene = fragment.scene && prompt.includes(fragment.scene)
  const hasDescription = fragment.description && prompt.toLowerCase().includes(fragment.description.toLowerCase().substring(0, 10))

  if (!hasCharacter) {
    issues.push('提示词中缺少人物信息')
    completeness -= 20
    suggestions.push('确保提示词包含人物名称和形象描述')
  }

  if (!hasScene) {
    issues.push('提示词中缺少场景信息')
    completeness -= 15
    suggestions.push('确保提示词包含场景描述')
  }

  if (!hasDescription) {
    issues.push('提示词中缺少场景描述的关键内容')
    completeness -= 15
    suggestions.push('将场景描述的关键元素融入提示词')
  }

  // 2. 一致性检查
  if (fragment.characterAppearance.description) {
    const appearanceKeywords = fragment.characterAppearance.description
      .toLowerCase()
      .split(/[，,。.\s]+/)
      .filter(k => k.length > 1)
    
    const hasAppearance = appearanceKeywords.some(keyword => 
      prompt.toLowerCase().includes(keyword)
    )

    if (!hasAppearance) {
      issues.push('提示词中缺少人物形象描述，可能导致人物不一致')
      consistency -= 25
      suggestions.push(`确保提示词包含人物形象：${fragment.characterAppearance.description}`)
    }
  }

  // 检查角色库一致性
  const character = characters.find(c => c.name === fragment.character)
  if (character && character.appearance.description) {
    const charAppearanceKeywords = character.appearance.description
      .toLowerCase()
      .split(/[，,。.\s]+/)
      .filter(k => k.length > 1)
    
    const hasCharAppearance = charAppearanceKeywords.some(keyword =>
      prompt.toLowerCase().includes(keyword)
    )

    if (!hasCharAppearance) {
      issues.push('提示词中的人物形象与角色库不一致')
      consistency -= 20
      suggestions.push(`使用角色库中的形象描述：${character.appearance.description}`)
    }
  }

  // 3. 详细程度检查
  const wordCount = prompt.trim().split(/\s+/).length
  if (wordCount < 30) {
    issues.push('提示词描述不够详细，可能影响生成质量')
    detail -= 20
    suggestions.push('增加画面细节、光线、氛围等描述')
  } else if (wordCount > 200) {
    issues.push('提示词过长，可能包含冗余信息')
    detail -= 10
    suggestions.push('精简提示词，保留关键信息')
  }

  // 检查是否包含画面质量相关词汇
  const qualityKeywords = ['高清', '细节', '清晰', '高质量', '精美', '细腻', '精致']
  const hasQuality = qualityKeywords.some(kw => prompt.includes(kw))
  if (!hasQuality) {
    suggestions.push('考虑添加画面质量相关的描述词')
  }

  // 计算总分
  const overall = Math.round((completeness + consistency + detail) / 3)

  return {
    overall,
    completeness,
    consistency,
    detail,
    issues,
    suggestions,
  }
}

// ========== 智能提示词生成 ==========

/**
 * 使用上下文生成增强的提示词
 */
export async function generateEnhancedPrompt(
  fragment: SceneFragment,
  context: ContextSummary,
  characters: Character[],
  options: {
    useContext?: boolean
    optimize?: boolean
    maxIterations?: number
  } = {}
): Promise<EnhancedPrompt> {
  const {
    useContext = true,
    optimize = true,
    maxIterations = 2,
  } = options

  // 构建上下文信息
  let contextInfo = ''
  if (useContext && context.characters.length > 0) {
    contextInfo += '\n\n【上下文信息】\n'
    
    // 角色信息
    const currentChar = context.characters.find(c => c.character === fragment.character)
    if (currentChar) {
      contextInfo += `人物"${fragment.character}"在前面的片段中出现过${currentChar.fragmentCount}次，`
      contextInfo += `人物形象：${currentChar.appearance}，`
      contextInfo += `声音风格：${currentChar.voice}。\n`
    }

    // 场景流转
    if (context.sceneFlow.length > 0) {
      const lastTransition = context.sceneFlow[context.sceneFlow.length - 1]
      contextInfo += `场景从"${lastTransition.from}"转换到"${lastTransition.to}"。\n`
    }

    // 剧情摘要
    if (context.plotSummary) {
      contextInfo += `前面的剧情：${context.plotSummary}。\n`
    }
  }

  // 获取上一段信息
  const previousFragment = context.previousFragments[context.previousFragments.length - 1]
  const previousInfo = previousFragment && fragment.usePreviousLastFrame
    ? `\n\n【连贯性要求】\n上一段结尾画面需要与当前片段保持视觉连贯性。上一段描述：${previousFragment.description}。`
    : ''

  // 构建生成提示词
  const appearanceInfo = fragment.characterAppearance.description || '（需要补充人物形象描述）'
  const voiceInfo = fragment.voice.description || '（可选）'
  
  const baseGenerationPrompt = `请为以下场景生成完整的视频生成提示词：

【当前场景信息】
人物：${fragment.character}
场景：${fragment.scene}
描述：${fragment.description}
人物形象：${appearanceInfo}
声音风格：${voiceInfo}${contextInfo}${previousInfo}

【生成要求】
1. 必须包含人物形象描述：${appearanceInfo}
2. ${fragment.voice.description ? `必须包含声音风格：${fragment.voice.description}` : '（声音描述可选，但如果有请包含）'}
3. 详细描述场景：${fragment.scene}
4. ${previousFragment && fragment.usePreviousLastFrame ? '与上一段保持视觉和情节连贯性，自然过渡，确保人物形象一致' : ''}
5. 画面质量高，细节丰富，适合短视频制作
6. 提示词要完整、具体，长度控制在200字以内
7. 确保人物角色一致性：${useContext && context.characters.length > 0 ? '如果之前有相同人物的场景，人物形象必须保持一致' : '人物形象必须与角色设定一致'}
8. ${useContext ? '考虑前面剧情的发展，保持情节连贯性' : ''}

请直接输出完整的视频生成提示词，不要包含其他说明文字。`

  let bestPrompt = ''
  let bestScore: PromptScore | null = null
  let currentPrompt = baseGenerationPrompt

  // 生成并优化循环
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    try {
      // 生成提示词（使用Promise包装）
      const generatedPrompt = await new Promise<string>((resolve, reject) => {
        let promptText = ''
        
        void streamGenerateContent(
          {
            prompt: currentPrompt,
            modelId: 'gpt-4',
            type: 'text',
            parameters: {
              temperature: 0.7 + (iteration * 0.1), // 每次迭代稍微增加创造性
              maxTokens: 400,
            },
          },
          (chunk: string) => {
            promptText += chunk
          },
          () => {
            resolve(promptText.trim())
          },
          (error) => {
            reject(error)
          }
        )
      })

      // 评分
      const score = await scorePrompt(generatedPrompt, fragment, characters)
      
      // 如果是第一次或分数更高，保存
      if (!bestScore || score.overall > bestScore.overall) {
        bestPrompt = generatedPrompt
        bestScore = score
      }

      // 如果分数已经很高或不需要优化，提前结束
      if (!optimize || score.overall >= 85 || iteration >= maxIterations - 1) {
        break
      }

      // 准备优化提示词
      currentPrompt = `以下是一个视频生成提示词及其质量评分：

提示词：${generatedPrompt}

质量评分：
- 总分：${score.overall}/100
- 完整性：${score.completeness}/100
- 一致性：${score.consistency}/100
- 详细程度：${score.detail}/100

发现的问题：
${score.issues.map(issue => `- ${issue}`).join('\n')}

改进建议：
${score.suggestions.map(suggestion => `- ${suggestion}`).join('\n')}

请根据以上评分和问题，优化这个提示词，使其更加完整、一致、详细。直接输出优化后的提示词，不要包含其他说明文字。`

      // 等待一下再继续优化
      await new Promise(resolve => setTimeout(resolve, 300))
      
    } catch (error) {
      logger.error('Failed to generate enhanced prompt:', error)
      break
    }
  }

  // 返回最佳结果
  return {
    prompt: bestPrompt || '',
    score: bestScore || {
      overall: 0,
      completeness: 0,
      consistency: 0,
      detail: 0,
      issues: ['生成失败'],
      suggestions: [],
    },
    contextUsed: useContext,
    optimized: optimize && bestScore !== null && bestScore.overall > 0,
  }
}

// ========== 风格一致性检测 ==========

/**
 * 检测提示词与角色库的一致性
 */
export function checkStyleConsistency(
  prompt: string,
  fragment: SceneFragment,
  characters: Character[]
): {
  consistent: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []

  // 检查当前片段的人物
  if (fragment.character) {
    const character = characters.find(c => c.name === fragment.character)
    
    if (character) {
      // 检查形象描述一致性
      if (character.appearance.description) {
        const charAppearanceKeywords = character.appearance.description
          .toLowerCase()
          .split(/[，,。.\s]+/)
          .filter(k => k.length > 1)
        
        const promptLower = prompt.toLowerCase()
        const hasConsistentAppearance = charAppearanceKeywords.some(keyword =>
          promptLower.includes(keyword)
        )

        if (!hasConsistentAppearance) {
          issues.push(`提示词中的人物形象与角色库中的"${fragment.character}"不一致`)
          suggestions.push(`建议使用角色库中的形象描述：${character.appearance.description}`)
        }
      }

      // 检查声音描述一致性
      if (character.voice.description) {
        const charVoiceKeywords = character.voice.description
          .toLowerCase()
          .split(/[，,。.\s]+/)
          .filter(k => k.length > 1)
        
        const promptLower = prompt.toLowerCase()
        const hasConsistentVoice = charVoiceKeywords.some(keyword =>
          promptLower.includes(keyword)
        )

        if (!hasConsistentVoice && character.voice.description !== '（可选）') {
          issues.push(`提示词中的声音描述与角色库中的"${fragment.character}"不一致`)
          suggestions.push(`建议使用角色库中的声音描述：${character.voice.description}`)
        }
      }
    } else {
      // 人物不在角色库中，建议创建角色
      suggestions.push(`人物"${fragment.character}"不在角色库中，建议创建角色以保持一致性`)
    }
  }

  return {
    consistent: issues.length === 0,
    issues,
    suggestions,
  }
}
