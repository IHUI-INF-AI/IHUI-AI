/**
 * AI辅助创作模块
 *
 * 功能：
 * 1. 剧情建议生成
 * 2. 场景智能推荐
 * 3. 角色关系分析
 * 4. 冲突检测
 * 5. 对话生成
 * 6. 情感分析
 */

import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import { t } from '@/utils/i18n'
import type { SceneFragment, Character } from './DramaScriptExcel.types'

// ========== 类型定义 ==========

export interface PlotSuggestion {
  id: string
  type: 'twist' | 'conflict' | 'resolution' | 'climax' | 'transition'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  characters: string[]
  emotionalTone: string
  confidence: number
}

export interface DialogueSuggestion {
  characterId: string
  characterName: string
  dialogue: string
  emotion: string
  action?: string
  voiceTone?: string
}

export interface EmotionAnalysis {
  fragmentId: string
  dominantEmotion: string
  emotionIntensity: number  // 0-1
  emotionProgression: 'rising' | 'falling' | 'stable' | 'fluctuating'
  suggestedAdjustment?: string
}

export interface StoryArc {
  phase: 'setup' | 'rising' | 'climax' | 'falling' | 'resolution'
  currentPosition: number  // 0-100
  fragmentsInPhase: string[]
  suggestions: string[]
}

export interface CharacterArc {
  characterId: string
  characterName: string
  development: {
    fragmentId: string
    stage: string
    emotion: string
  }[]
  overallArc: string
  suggestions: string[]
}

export interface SceneAtmosphere {
  lighting: string
  mood: string
  colorPalette: string[]
  soundscape: string
  cameraStyle: string
}

// ========== 剧情建议生成 ==========

/**
 * 生成剧情建议
 */
export function generatePlotSuggestions(
  fragments: SceneFragment[],
  characters: Character[],
  count: number = 5
): Promise<PlotSuggestion[]> {
  return new Promise((resolve) => {
    if (fragments.length === 0) {
      resolve([])
      return
    }

    // 构建当前剧情摘要
    const plotSummary = fragments.map((f, i) =>
      `${i + 1}. [${f.scene || t('dramaScript.common.unknownScene')}] ${f.character || t('dramaScript.common.unknownCharacter')}: ${f.description || t('dramaScript.common.noDescription')}`
    ).join('\n')

    const characterInfo = characters.map(c =>
      `- ${c.name}: ${c.appearance || t('dramaScript.common.noDescription')}`
    ).join('\n')

    const prompt = `${t('dramaScript.aiCreation.promptAsScreenwriter')}${count}${t('dramaScript.aiCreation.promptCreativeSuggestions')}

${t('dramaScript.aiCreation.promptCurrentPlot')}
${plotSummary}

${t('dramaScript.aiCreation.promptCharacterInfo')}
${characterInfo}

${t('dramaScript.aiCreation.promptReturnFormat')}
- type: "twist"(${t('dramaScript.aiCreation.promptTypeTwist')})/"conflict"(${t('dramaScript.aiCreation.promptTypeConflict')})/"resolution"(${t('dramaScript.aiCreation.promptTypeResolution')})/"climax"(${t('dramaScript.aiCreation.promptTypeClimax')})/"transition"(${t('dramaScript.aiCreation.promptTypeTransition')})
- title: ${t('dramaScript.aiCreation.promptTitle')}
- description: ${t('dramaScript.aiCreation.promptDescription')}
- impact: "high"/"medium"/"low"
- characters: ${t('dramaScript.aiCreation.promptCharacters')}
- emotionalTone: ${t('dramaScript.aiCreation.promptEmotionalTone')}
- confidence: ${t('dramaScript.aiCreation.promptConfidence')}

${t('dramaScript.aiCreation.promptReturnJsonOnly')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.8, maxTokens: 2000 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0])
            resolve(suggestions.slice(0, count).map((s: PlotSuggestion, i: number) => ({
              id: `plot-${Date.now()}-${i}`,
              type: s.type || 'transition',
              title: s.title || '',
              description: s.description || '',
              impact: s.impact || 'medium',
              characters: s.characters || [],
              emotionalTone: s.emotionalTone || '',
              confidence: s.confidence || 0.7,
            })))
          } else {
            resolve([])
          }
        } catch (error) {
          logger.error('Failed to parse drama suggestions:', error)
          resolve([])
        }
      },
      (error) => {
        logger.error('Failed to generate drama suggestions:', error)
        resolve([])
      }
    )
  })
}

// ========== 对话生成 ==========

/**
 * 生成角色对话
 */
export function generateDialogue(
  fragment: SceneFragment,
  characters: Character[],
  context: string = ''
): Promise<DialogueSuggestion[]> {
  return new Promise((resolve) => {
    const characterInfo = characters.map(c =>
      `- ${c.name}: ${c.appearance || t('dramaScript.common.noDescription')}, ${t('dramaScript.aiCreation.promptVoiceTone')}: ${c.voice || t('dramaScript.aiCreation.promptEmotion')}`
    ).join('\n')

    const prompt = `${t('dramaScript.aiCreation.promptGenerateDialogue')}

${t('dramaScript.aiCreation.promptScene')}${fragment.scene || t('dramaScript.common.unknownScene')}
${t('dramaScript.aiCreation.promptDescription')}${fragment.description || t('dramaScript.common.noDescription')}
${t('dramaScript.aiCreation.promptCharacter')}${fragment.character || t('dramaScript.common.unknownCharacter')}
${context ? `${t('dramaScript.aiCreation.promptContext')}${context}` : ''}

${t('dramaScript.aiCreation.promptAvailableCharacters')}
${characterInfo}

${t('dramaScript.aiCreation.promptDialogueRequest')}
- characterName: ${t('dramaScript.aiCreation.promptCharacterName')}
- dialogue: ${t('dramaScript.aiCreation.promptDialogue')}
- emotion: ${t('dramaScript.aiCreation.promptEmotion')}
- action: ${t('dramaScript.aiCreation.promptAction')}
- voiceTone: ${t('dramaScript.aiCreation.promptVoiceTone')}

${t('dramaScript.videoProcessing.subtitle.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.7, maxTokens: 1000 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const dialogues = JSON.parse(jsonMatch[0])
            resolve(dialogues.map((d: DialogueSuggestion) => ({
              characterId: characters.find(c => c.name === d.characterName)?.id || '',
              characterName: d.characterName || '',
              dialogue: d.dialogue || '',
              emotion: d.emotion || t('dramaScript.aiCreation.defaultEmotion'),
              action: d.action,
              voiceTone: d.voiceTone,
            })))
          } else {
            resolve([])
          }
        } catch (error) {
          logger.error('Failed to parse dialogue:', error)
          resolve([])
        }
      },
      (error) => {
        logger.error('Failed to generate dialogue:', error)
        resolve([])
      }
    )
  })
}

// ========== 情感分析 ==========

/**
 * 分析片段情感
 */
export function analyzeEmotions(
  fragments: SceneFragment[]
): Promise<EmotionAnalysis[]> {
  return new Promise((resolve) => {
    if (fragments.length === 0) {
      resolve([])
      return
    }

    const fragmentsText = fragments.map((f, i) =>
      `${i + 1}. ID:${f.id} | ${t('dramaScript.aiCreation.promptScene')}:${f.scene || t('dramaScript.storyboard.noPrevious')} | ${t('dramaScript.aiCreation.promptDescription')}:${f.description || t('dramaScript.storyboard.noPrevious')}`
    ).join('\n')

    const prompt = `${t('dramaScript.aiCreation.promptAnalyzeEmotion')}

${fragmentsText}

${t('dramaScript.aiCreation.promptReturnFormat')}
- fragmentId: ${t('dramaScript.aiCreation.promptFragmentId')}
- dominantEmotion: ${t('dramaScript.aiCreation.promptDominantEmotion')}
- emotionIntensity: ${t('dramaScript.aiCreation.promptEmotionIntensity')}
- emotionProgression: "rising"(${t('dramaScript.aiCreation.promptProgressionRising')})/"falling"(${t('dramaScript.aiCreation.promptProgressionFalling')})/"stable"(${t('dramaScript.aiCreation.promptProgressionStable')})/"fluctuating"(${t('dramaScript.aiCreation.promptProgressionFluctuating')})
- suggestedAdjustment: ${t('dramaScript.aiCreation.promptSuggestedAdjustment')}

${t('dramaScript.videoProcessing.subtitle.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.5, maxTokens: 1500 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const analyses = JSON.parse(jsonMatch[0])
            resolve(analyses.map((a: EmotionAnalysis) => ({
              fragmentId: a.fragmentId || '',
              dominantEmotion: a.dominantEmotion || t('dramaScript.aiCreation.defaultEmotion'),
              emotionIntensity: Math.min(1, Math.max(0, a.emotionIntensity || 0.5)),
              emotionProgression: a.emotionProgression || 'stable',
              suggestedAdjustment: a.suggestedAdjustment,
            })))
          } else {
            resolve([])
          }
        } catch (error) {
          logger.error('Failed to parse emotion analysis:', error)
          resolve([])
        }
      },
      (error) => {
        logger.error('Emotion analysis failed:', error)
        resolve([])
      }
    )
  })
}

// ========== 故事弧分析 ==========

/**
 * 分析故事弧
 */
export function analyzeStoryArc(
  fragments: SceneFragment[]
): StoryArc {
  const totalFragments = fragments.length

  if (totalFragments === 0) {
    return {
      phase: 'setup',
      currentPosition: 0,
      fragmentsInPhase: [],
      suggestions: [t('dramaScript.aiCreation.storyArc.startFirstScene')],
    }
  }

  // 根据片段数量估算故事阶段
  const position = Math.min(100, (totalFragments / 10) * 100)

  let phase: StoryArc['phase']
  let suggestions: string[] = []

  if (position <= 20) {
    phase = 'setup'
    suggestions = [
      t('dramaScript.aiCreation.storyArc.setupSuggestion1'),
      t('dramaScript.aiCreation.storyArc.setupSuggestion2'),
      t('dramaScript.aiCreation.storyArc.setupSuggestion3'),
    ]
  } else if (position <= 40) {
    phase = 'rising'
    suggestions = [
      t('dramaScript.aiCreation.storyArc.risingSuggestion1'),
      t('dramaScript.aiCreation.storyArc.risingSuggestion2'),
      t('dramaScript.aiCreation.storyArc.risingSuggestion3'),
    ]
  } else if (position <= 60) {
    phase = 'climax'
    suggestions = [
      t('dramaScript.aiCreation.storyArc.climaxSuggestion1'),
      t('dramaScript.aiCreation.storyArc.climaxSuggestion2'),
      t('dramaScript.aiCreation.storyArc.climaxSuggestion3'),
    ]
  } else if (position <= 80) {
    phase = 'falling'
    suggestions = [
      t('dramaScript.aiCreation.storyArc.fallingSuggestion1'),
      t('dramaScript.aiCreation.storyArc.fallingSuggestion2'),
      t('dramaScript.aiCreation.storyArc.fallingSuggestion3'),
    ]
  } else {
    phase = 'resolution'
    suggestions = [
      t('dramaScript.aiCreation.storyArc.resolutionSuggestion1'),
      t('dramaScript.aiCreation.storyArc.resolutionSuggestion2'),
      t('dramaScript.aiCreation.storyArc.resolutionSuggestion3'),
    ]
  }

  // 计算每个阶段的片段
  const phaseRanges = {
    setup: [0, 0.2],
    rising: [0.2, 0.4],
    climax: [0.4, 0.6],
    falling: [0.6, 0.8],
    resolution: [0.8, 1],
  }

  const [start, end] = phaseRanges[phase]
  const fragmentsInPhase = fragments
    .filter((_, i) => {
      const pos = i / totalFragments
      return pos >= start && pos < end
    })
    .map(f => f.id)

  return {
    phase,
    currentPosition: Math.round(position),
    fragmentsInPhase,
    suggestions,
  }
}

// ========== 角色弧线分析 ==========

/**
 * 分析角色发展弧线
 */
export function analyzeCharacterArcs(
  fragments: SceneFragment[],
  characters: Character[]
): CharacterArc[] {
  const arcs: CharacterArc[] = []

  const emotionPositive = t('dramaScript.aiCreation.characterArc.emotionPositive')
  const emotionNegative = t('dramaScript.aiCreation.characterArc.emotionNegative')
  const emotionNeutral = t('dramaScript.aiCreation.characterArc.emotionNeutral')

  for (const character of characters) {
    // 找出该角色出现的所有片段
    const characterFragments = fragments.filter(f =>
      f.character?.includes(character.name)
    )

    if (characterFragments.length === 0) continue

    const development = characterFragments.map((f, i) => {
      // 基于位置推断角色发展阶段
      const position = i / characterFragments.length
      let stage: string

      if (position < 0.25) stage = t('dramaScript.aiCreation.characterArc.stageIntroduction')
      else if (position < 0.5) stage = t('dramaScript.aiCreation.characterArc.stageDevelopment')
      else if (position < 0.75) stage = t('dramaScript.aiCreation.characterArc.stageConflict')
      else stage = t('dramaScript.aiCreation.characterArc.stageGrowth')

      return {
        fragmentId: f.id,
        stage,
        emotion: f.description?.includes('开心') || f.description?.includes('笑') ? emotionPositive :
                 f.description?.includes('悲伤') || f.description?.includes('哭') ? emotionNegative : emotionNeutral,
      }
    })

    // 生成整体弧线描述
    const emotionCounts = development.reduce((acc, d) => {
      acc[d.emotion] = (acc[d.emotion] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const dominantEmotion = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || emotionNeutral

    let overallArc: string
    if (dominantEmotion === emotionPositive) {
      overallArc = t('dramaScript.aiCreation.characterArc.arcPositive')
    } else if (dominantEmotion === emotionNegative) {
      overallArc = t('dramaScript.aiCreation.characterArc.arcNegative')
    } else {
      overallArc = t('dramaScript.aiCreation.characterArc.arcNeutral')
    }

    const suggestions: string[] = []
    if (characterFragments.length < 3) {
      suggestions.push(t('dramaScript.aiCreation.characterArc.suggestionMoreAppearances'))
    }
    if (development.every(d => d.emotion === development[0].emotion)) {
      suggestions.push(t('dramaScript.aiCreation.characterArc.suggestionEmotionVariety'))
    }

    arcs.push({
      characterId: character.id,
      characterName: character.name,
      development,
      overallArc,
      suggestions,
    })
  }

  return arcs
}

// ========== 场景氛围生成 ==========

/**
 * 生成场景氛围建议
 */
export function generateSceneAtmosphere(
  scene: string,
  emotion: string = ''
): Promise<SceneAtmosphere> {
  return new Promise((resolve) => {
    const prompt = `${t('dramaScript.aiCreation.promptGenerateAtmosphere')}

${t('dramaScript.aiCreation.promptScene')}${scene}
${emotion ? `${t('dramaScript.aiCreation.promptEmotionalTone')}${emotion}` : ''}

${t('dramaScript.videoProcessing.subtitle.promptReturnFormat')}
{
  "lighting": "${t('dramaScript.aiCreation.promptLighting')}",
  "mood": "${t('dramaScript.aiCreation.promptMood')}",
  "colorPalette": ["${t('dramaScript.aiCreation.promptColorPalette')}1", "主色2", "主色3"],
  "soundscape": "${t('dramaScript.aiCreation.promptSoundscape')}",
  "cameraStyle": "${t('dramaScript.aiCreation.promptCameraStyle')}"
}

${t('dramaScript.aiCreation.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.6, maxTokens: 500 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const atmosphere = JSON.parse(jsonMatch[0])
            resolve({
              lighting: atmosphere.lighting || t('dramaScript.aiCreation.defaultLighting'),
              mood: atmosphere.mood || t('dramaScript.aiCreation.defaultMood'),
              colorPalette: atmosphere.colorPalette || [t('dramaScript.aiCreation.defaultColorPalette1'), t('dramaScript.aiCreation.defaultColorPalette2')],
              soundscape: atmosphere.soundscape || t('dramaScript.aiCreation.defaultSoundscape'),
              cameraStyle: atmosphere.cameraStyle || t('dramaScript.aiCreation.defaultCameraStyle'),
            })
          } else {
            resolve({
              lighting: t('dramaScript.aiCreation.defaultLighting'),
              mood: t('dramaScript.aiCreation.defaultMood'),
              colorPalette: [t('dramaScript.aiCreation.defaultColorPalette1'), t('dramaScript.aiCreation.defaultColorPalette2')],
              soundscape: t('dramaScript.aiCreation.defaultSoundscape'),
              cameraStyle: t('dramaScript.aiCreation.defaultCameraStyle'),
            })
          }
        } catch (error) {
          logger.error('Failed to parse atmosphere suggestions:', error)
          resolve({
            lighting: t('dramaScript.aiCreation.defaultLighting'),
            mood: t('dramaScript.aiCreation.defaultMood'),
            colorPalette: [t('dramaScript.aiCreation.defaultColorPalette1'), t('dramaScript.aiCreation.defaultColorPalette2')],
            soundscape: t('dramaScript.aiCreation.defaultSoundscape'),
            cameraStyle: t('dramaScript.aiCreation.defaultCameraStyle'),
          })
        }
      },
      (error) => {
        logger.error('Failed to generate atmosphere suggestions:', error)
        resolve({
          lighting: t('dramaScript.aiCreation.defaultLighting'),
          mood: t('dramaScript.aiCreation.defaultMood'),
          colorPalette: [t('dramaScript.aiCreation.defaultColorPalette1'), t('dramaScript.aiCreation.defaultColorPalette2')],
          soundscape: t('dramaScript.aiCreation.defaultSoundscape'),
          cameraStyle: t('dramaScript.aiCreation.defaultCameraStyle'),
        })
      }
    )
  })
}

// ========== 续写建议 ==========

/**
 * 生成续写建议
 */
export function generateContinuation(
  fragments: SceneFragment[],
  characters: Character[]
): Promise<{
  nextScene: string
  nextDescription: string
  suggestedCharacter: string
  reasoning: string
}> {
  return new Promise((resolve) => {
    if (fragments.length === 0) {
      resolve({
        nextScene: t('dramaScript.aiCreation.continuation.defaultScene'),
        nextDescription: t('dramaScript.aiCreation.continuation.defaultDescription'),
        suggestedCharacter: characters[0]?.name || '',
        reasoning: t('dramaScript.aiCreation.continuation.defaultReasoning'),
      })
      return
    }

    const lastFragments = fragments.slice(-3)
    const recentPlot = lastFragments.map((f, i) =>
      `${i + 1}. [${f.scene}] ${f.character}: ${f.description}`
    ).join('\n')

    const characterNames = characters.map(c => c.name).join(', ')

    const prompt = `${t('dramaScript.aiCreation.promptContinuation')}

${t('dramaScript.aiCreation.promptRecentPlot')}
${recentPlot}

${t('dramaScript.aiCreation.promptAvailableCharacters')}${characterNames}

${t('dramaScript.videoProcessing.subtitle.promptReturnFormat')}
{
  "nextScene": "${t('dramaScript.aiCreation.promptNextScene')}",
  "nextDescription": "${t('dramaScript.aiCreation.promptSceneDescription')}",
  "suggestedCharacter": "${t('dramaScript.aiCreation.promptSuggestedCharacter')}",
  "reasoning": "${t('dramaScript.aiCreation.promptReasoning')}"
}

${t('dramaScript.aiCreation.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.7, maxTokens: 500 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0])
            resolve({
              nextScene: result.nextScene || '',
              nextDescription: result.nextDescription || '',
              suggestedCharacter: result.suggestedCharacter || '',
              reasoning: result.reasoning || '',
            })
          } else {
            resolve({
              nextScene: '',
              nextDescription: '',
              suggestedCharacter: '',
              reasoning: '',
            })
          }
        } catch (error) {
          logger.error('Failed to parse continuation suggestions:', error)
          resolve({
            nextScene: '',
            nextDescription: '',
            suggestedCharacter: '',
            reasoning: '',
          })
        }
      },
      (error) => {
        logger.error('Failed to generate continuation suggestions:', error)
        resolve({
          nextScene: '',
          nextDescription: '',
          suggestedCharacter: '',
          reasoning: '',
        })
      }
    )
  })
}

// ========== 剧本大纲生成 ==========

/**
 * 生成剧本大纲
 */
export function generateScriptOutline(
  theme: string,
  characters: Character[],
  episodeCount: number = 5
): Promise<{
  title: string
  synopsis: string
  episodes: Array<{
    number: number
    title: string
    summary: string
    keyScenes: string[]
  }>
}> {
  return new Promise((resolve) => {
    const characterInfo = characters.map(c =>
      `- ${c.name}: ${c.appearance || t('dramaScript.common.noDescription')}`
    ).join('\n')

    const prompt = `${t('dramaScript.aiCreation.promptGenerateOutline')}${episodeCount}${t('dramaScript.aiCreation.promptEpisodes')}

${t('dramaScript.aiCreation.promptTheme')}${theme}

${t('dramaScript.aiCreation.promptCharacter')}
${characterInfo}

${t('dramaScript.videoProcessing.subtitle.promptReturnFormat')}
{
  "title": "${t('dramaScript.aiCreation.promptDramaTitle')}",
  "synopsis": "${t('dramaScript.aiCreation.promptSynopsis')}",
  "episodes": [
    {
      "number": 1,
      "title": "${t('dramaScript.aiCreation.promptEpisodeTitle')}",
      "summary": "${t('dramaScript.aiCreation.promptEpisodeSummary')}",
      "keyScenes": ["${t('dramaScript.aiCreation.promptKeyScenes')}1", "关键场景2"]
    }
  ]
}

${t('dramaScript.aiCreation.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.8, maxTokens: 2000 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0])
            resolve({
              title: result.title || '',
              synopsis: result.synopsis || '',
              episodes: result.episodes || [],
            })
          } else {
            resolve({
              title: '',
              synopsis: '',
              episodes: [],
            })
          }
        } catch (error) {
          logger.error('Failed to parse outline:', error)
          resolve({
            title: '',
            synopsis: '',
            episodes: [],
          })
        }
      },
      (error) => {
        logger.error('Failed to generate outline:', error)
        resolve({
          title: '',
          synopsis: '',
          episodes: [],
        })
      }
    )
  })
}
