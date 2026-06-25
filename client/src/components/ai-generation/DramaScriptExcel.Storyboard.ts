/**
 * 智能分镜系统
 *
 * 功能：
 * 1. 自动生成分镜脚本
 * 2. 镜头语言建议
 * 3. 画面构图推荐
 * 4. 运镜建议
 * 5. 时长估算
 */

import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import { t } from '@/utils/i18n'
import type { SceneFragment, Character } from './DramaScriptExcel.types'

// ========== 类型定义 ==========

export interface StoryboardPanel {
  id: string
  fragmentId: string
  panelNumber: number
  shotType: ShotType
  cameraMovement: CameraMovement
  composition: CompositionGuide
  lighting: LightingSetup
  duration: number  // 秒
  description: string
  keyElements: string[]
  thumbnail?: string
  notes?: string
}

export type ShotType =
  | 'extreme-wide'    // 大远景
  | 'wide'            // 远景
  | 'full'            // 全景
  | 'medium-wide'     // 中远景
  | 'medium'          // 中景
  | 'medium-close'    // 中近景
  | 'close-up'        // 特写
  | 'extreme-close'   // 大特写
  | 'over-shoulder'   // 过肩镜头
  | 'pov'             // 主观视角
  | 'aerial'          // 俯瞰
  | 'low-angle'       // 仰拍
  | 'high-angle'      // 俯拍
  | 'dutch-angle'     // 荷兰角度

export type CameraMovement =
  | 'static'          // 固定
  | 'pan-left'        // 左摇
  | 'pan-right'       // 右摇
  | 'tilt-up'         // 上摇
  | 'tilt-down'       // 下摇
  | 'dolly-in'        // 推进
  | 'dolly-out'       // 拉出
  | 'truck-left'      // 左移
  | 'truck-right'     // 右移
  | 'crane-up'        // 升
  | 'crane-down'      // 降
  | 'zoom-in'         // 变焦推
  | 'zoom-out'        // 变焦拉
  | 'follow'          // 跟随
  | 'arc'             // 环绕
  | 'handheld'        // 手持

export interface CompositionGuide {
  type: 'rule-of-thirds' | 'center' | 'diagonal' | 'frame-within-frame' | 'leading-lines' | 'symmetry' | 'negative-space'
  focalPoint: { x: number; y: number }  // 0-1 百分比
  depth: 'shallow' | 'medium' | 'deep'
  balance: 'balanced' | 'left-heavy' | 'right-heavy' | 'top-heavy' | 'bottom-heavy'
}

export interface LightingSetup {
  type: 'natural' | 'studio' | 'dramatic' | 'soft' | 'harsh' | 'backlit' | 'side-lit' | 'top-lit'
  mood: string
  keyLightDirection: 'front' | 'left' | 'right' | 'back' | 'top' | 'bottom'
  contrast: 'low' | 'medium' | 'high'
  colorTemperature: 'warm' | 'neutral' | 'cool'
}

export interface StoryboardAnalysis {
  fragmentId: string
  panels: StoryboardPanel[]
  totalDuration: number
  shotVariety: number  // 0-1
  paceScore: number    // 0-1
  suggestions: string[]
  cinematicScore: number  // 0-100
}

export interface ShotRecommendation {
  shotType: ShotType
  reason: string
  emotionalImpact: string
  alternativeShots: ShotType[]
}

// ========== 镜头语言映射 ==========

const SHOT_TYPE_KEY_MAP: Record<ShotType, { nameKey: string; descriptionKey: string; useCaseKey: string }> = {
  'extreme-wide': { nameKey: 'dramaScript.shotType.extremeWide.name', descriptionKey: 'dramaScript.shotType.extremeWide.description', useCaseKey: 'dramaScript.shotType.extremeWide.useCase' },
  'wide': { nameKey: 'dramaScript.shotType.wide.name', descriptionKey: 'dramaScript.shotType.wide.description', useCaseKey: 'dramaScript.shotType.wide.useCase' },
  'full': { nameKey: 'dramaScript.shotType.full.name', descriptionKey: 'dramaScript.shotType.full.description', useCaseKey: 'dramaScript.shotType.full.useCase' },
  'medium-wide': { nameKey: 'dramaScript.shotType.mediumWide.name', descriptionKey: 'dramaScript.shotType.mediumWide.description', useCaseKey: 'dramaScript.shotType.mediumWide.useCase' },
  'medium': { nameKey: 'dramaScript.shotType.medium.name', descriptionKey: 'dramaScript.shotType.medium.description', useCaseKey: 'dramaScript.shotType.medium.useCase' },
  'medium-close': { nameKey: 'dramaScript.shotType.mediumClose.name', descriptionKey: 'dramaScript.shotType.mediumClose.description', useCaseKey: 'dramaScript.shotType.mediumClose.useCase' },
  'close-up': { nameKey: 'dramaScript.shotType.closeUp.name', descriptionKey: 'dramaScript.shotType.closeUp.description', useCaseKey: 'dramaScript.shotType.closeUp.useCase' },
  'extreme-close': { nameKey: 'dramaScript.shotType.extremeClose.name', descriptionKey: 'dramaScript.shotType.extremeClose.description', useCaseKey: 'dramaScript.shotType.extremeClose.useCase' },
  'over-shoulder': { nameKey: 'dramaScript.shotType.overShoulder.name', descriptionKey: 'dramaScript.shotType.overShoulder.description', useCaseKey: 'dramaScript.shotType.overShoulder.useCase' },
  'pov': { nameKey: 'dramaScript.shotType.pov.name', descriptionKey: 'dramaScript.shotType.pov.description', useCaseKey: 'dramaScript.shotType.pov.useCase' },
  'aerial': { nameKey: 'dramaScript.shotType.aerial.name', descriptionKey: 'dramaScript.shotType.aerial.description', useCaseKey: 'dramaScript.shotType.aerial.useCase' },
  'low-angle': { nameKey: 'dramaScript.shotType.lowAngle.name', descriptionKey: 'dramaScript.shotType.lowAngle.description', useCaseKey: 'dramaScript.shotType.lowAngle.useCase' },
  'high-angle': { nameKey: 'dramaScript.shotType.highAngle.name', descriptionKey: 'dramaScript.shotType.highAngle.description', useCaseKey: 'dramaScript.shotType.highAngle.useCase' },
  'dutch-angle': { nameKey: 'dramaScript.shotType.dutchAngle.name', descriptionKey: 'dramaScript.shotType.dutchAngle.description', useCaseKey: 'dramaScript.shotType.dutchAngle.useCase' },
}

const CAMERA_MOVEMENT_KEY_MAP: Record<CameraMovement, { nameKey: string; effectKey: string }> = {
  'static': { nameKey: 'dramaScript.cameraMovement.static.name', effectKey: 'dramaScript.cameraMovement.static.effect' },
  'pan-left': { nameKey: 'dramaScript.cameraMovement.panLeft.name', effectKey: 'dramaScript.cameraMovement.panLeft.effect' },
  'pan-right': { nameKey: 'dramaScript.cameraMovement.panRight.name', effectKey: 'dramaScript.cameraMovement.panRight.effect' },
  'tilt-up': { nameKey: 'dramaScript.cameraMovement.tiltUp.name', effectKey: 'dramaScript.cameraMovement.tiltUp.effect' },
  'tilt-down': { nameKey: 'dramaScript.cameraMovement.tiltDown.name', effectKey: 'dramaScript.cameraMovement.tiltDown.effect' },
  'dolly-in': { nameKey: 'dramaScript.cameraMovement.dollyIn.name', effectKey: 'dramaScript.cameraMovement.dollyIn.effect' },
  'dolly-out': { nameKey: 'dramaScript.cameraMovement.dollyOut.name', effectKey: 'dramaScript.cameraMovement.dollyOut.effect' },
  'truck-left': { nameKey: 'dramaScript.cameraMovement.truckLeft.name', effectKey: 'dramaScript.cameraMovement.truckLeft.effect' },
  'truck-right': { nameKey: 'dramaScript.cameraMovement.truckRight.name', effectKey: 'dramaScript.cameraMovement.truckRight.effect' },
  'crane-up': { nameKey: 'dramaScript.cameraMovement.craneUp.name', effectKey: 'dramaScript.cameraMovement.craneUp.effect' },
  'crane-down': { nameKey: 'dramaScript.cameraMovement.craneDown.name', effectKey: 'dramaScript.cameraMovement.craneDown.effect' },
  'zoom-in': { nameKey: 'dramaScript.cameraMovement.zoomIn.name', effectKey: 'dramaScript.cameraMovement.zoomIn.effect' },
  'zoom-out': { nameKey: 'dramaScript.cameraMovement.zoomOut.name', effectKey: 'dramaScript.cameraMovement.zoomOut.effect' },
  'follow': { nameKey: 'dramaScript.cameraMovement.follow.name', effectKey: 'dramaScript.cameraMovement.follow.effect' },
  'arc': { nameKey: 'dramaScript.cameraMovement.arc.name', effectKey: 'dramaScript.cameraMovement.arc.effect' },
  'handheld': { nameKey: 'dramaScript.cameraMovement.handheld.name', effectKey: 'dramaScript.cameraMovement.handheld.effect' },
}

function getShotTypeInfoMap(): Record<ShotType, { name: string; description: string; useCase: string }> {
  const result = {} as Record<ShotType, { name: string; description: string; useCase: string }>
  for (const [type, keys] of Object.entries(SHOT_TYPE_KEY_MAP) as [ShotType, { nameKey: string; descriptionKey: string; useCaseKey: string }][]) {
    result[type] = {
      name: t(keys.nameKey),
      description: t(keys.descriptionKey),
      useCase: t(keys.useCaseKey),
    }
  }
  return result
}

function getCameraMovementInfoMap(): Record<CameraMovement, { name: string; effect: string }> {
  const result = {} as Record<CameraMovement, { name: string; effect: string }>
  for (const [movement, keys] of Object.entries(CAMERA_MOVEMENT_KEY_MAP) as [CameraMovement, { nameKey: string; effectKey: string }][]) {
    result[movement] = {
      name: t(keys.nameKey),
      effect: t(keys.effectKey),
    }
  }
  return result
}

// ========== 分镜生成 ==========

/**
 * 为片段生成分镜
 */
export function generateStoryboard(
  fragment: SceneFragment,
  characters: Character[],
  previousPanels?: StoryboardPanel[]
): Promise<StoryboardAnalysis> {
  return new Promise((resolve, reject) => {
    const shotTypeInfoMap = getShotTypeInfoMap()
    const cameraMovementInfoMap = getCameraMovementInfoMap()
    const characterInfo = characters.map(c => `${c.name}: ${c.appearance?.description || t('dramaScript.common.noDescription')}`).join('\n')

    const previousContext = previousPanels?.slice(-3).map(p =>
      `${t('dramaScript.storyboard.shotLabel')}${p.panelNumber}: ${shotTypeInfoMap[p.shotType]?.name || p.shotType}, ${cameraMovementInfoMap[p.cameraMovement]?.name || p.cameraMovement}`
    ).join('\n') || t('dramaScript.storyboard.noPrevious')

    const prompt = `${t('dramaScript.storyboard.promptAsProfessional')}

${t('dramaScript.storyboard.promptScene')}${fragment.scene || t('dramaScript.common.unknownScene')}
${t('dramaScript.storyboard.promptCharacter')}${fragment.character || t('dramaScript.common.unknownCharacter')}
${t('dramaScript.storyboard.promptDescription')}${fragment.description || t('dramaScript.common.noDescription')}

${t('dramaScript.storyboard.promptCharacterInfo')}
${characterInfo}

${t('dramaScript.storyboard.promptPreviousShots')}
${previousContext}

${t('dramaScript.storyboard.promptDesignRequest')}
{
  "shotType": "${t('dramaScript.storyboard.promptShotType')}(wide/medium/close-up/over-shoulder/pov/low-angle/high-angle等)",
  "cameraMovement": "${t('dramaScript.storyboard.promptCameraMovement')}(static/pan-left/pan-right/dolly-in/dolly-out/follow/handheld等)",
  "duration": ${t('dramaScript.storyboard.promptDuration')},
  "description": "${t('dramaScript.storyboard.promptPictureDescription')}",
  "compositionType": "${t('dramaScript.storyboard.promptCompositionType')}(rule-of-thirds/center/diagonal/symmetry等)",
  "lightingType": "${t('dramaScript.storyboard.promptLightingType')}(natural/dramatic/soft/backlit等)",
  "lightingMood": "${t('dramaScript.storyboard.promptLightingMood')}",
  "keyElements": ["${t('dramaScript.storyboard.promptKeyElements')}1", "元素2"],
  "notes": "${t('dramaScript.storyboard.promptNotes')}"
}

${t('dramaScript.storyboard.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.7, maxTokens: 2000 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const panelsData = JSON.parse(jsonMatch[0]) as unknown
            if (!Array.isArray(panelsData)) {
              reject(new Error('Invalid panels data format'))
              return
            }

            const panels: StoryboardPanel[] = panelsData.map((p: Record<string, unknown>, index: number) => ({
              id: `panel-${fragment.id}-${index}`,
              fragmentId: fragment.id,
              panelNumber: index + 1,
              shotType: validateShotType(typeof p.shotType === 'string' ? p.shotType : 'medium'),
              cameraMovement: validateCameraMovement(typeof p.cameraMovement === 'string' ? p.cameraMovement : 'static'),
              composition: {
                type: (['rule-of-thirds', 'center', 'diagonal', 'frame-within-frame', 'leading-lines', 'symmetry', 'negative-space'].includes(typeof p.compositionType === 'string' ? p.compositionType : '')
                  ? (p.compositionType as 'rule-of-thirds' | 'center' | 'diagonal' | 'frame-within-frame' | 'leading-lines' | 'symmetry' | 'negative-space')
                  : 'rule-of-thirds'),
                focalPoint: { x: 0.5, y: 0.5 },
                depth: 'medium',
                balance: 'balanced',
              },
              lighting: {
                type: (['natural', 'studio', 'dramatic', 'soft', 'harsh', 'backlit', 'side-lit', 'top-lit'].includes(typeof p.lightingType === 'string' ? p.lightingType : '')
                  ? (p.lightingType as 'natural' | 'studio' | 'dramatic' | 'soft' | 'harsh' | 'backlit' | 'side-lit' | 'top-lit')
                  : 'natural'),
                mood: (p.lightingMood || t('dramaScript.storyboard.defaultLightingMood')) as string,
                keyLightDirection: 'front',
                contrast: 'medium',
                colorTemperature: 'neutral',
              },
              duration: Math.min(5, Math.max(1, (typeof p.duration === 'number' ? p.duration : 2))),
              description: (p.description || '') as string,
              keyElements: (Array.isArray(p.keyElements) ? p.keyElements : []) as string[],
              notes: p.notes as string | undefined,
            }))

            const totalDuration = panels.reduce((sum, p) => sum + p.duration, 0)
            const shotTypes = new Set(panels.map(p => p.shotType))
            const shotVariety = shotTypes.size / panels.length

            // 计算节奏分数
            const durations = panels.map(p => p.duration)
            const avgDuration = totalDuration / panels.length
            const durationVariance = durations.reduce((sum, d) => sum + Math.abs(d - avgDuration), 0) / panels.length
            const paceScore = Math.max(0, 1 - durationVariance / 2)

            // 计算电影感分数
            const cinematicScore = Math.round(
              (shotVariety * 30) +
              (paceScore * 30) +
              (panels.length >= 2 ? 20 : 10) +
              (panels.some(p => p.cameraMovement !== 'static') ? 20 : 10)
            )

            const suggestions = generateSuggestions(panels, shotVariety, paceScore)

            resolve({
              fragmentId: fragment.id,
              panels,
              totalDuration,
              shotVariety,
              paceScore,
              suggestions,
              cinematicScore,
            })
          } else {
            resolve(createDefaultAnalysis(fragment.id))
          }
        } catch (error) {
          logger.error('Failed to parse storyboard:', error)
          resolve(createDefaultAnalysis(fragment.id))
        }
      },
      (error) => {
        logger.error('Failed to generate storyboard:', error)
        resolve(createDefaultAnalysis(fragment.id))
      }
    )
  })
}

/**
 * 验证镜头类型
 */
function validateShotType(type: string): ShotType {
  const validTypes: ShotType[] = [
    'extreme-wide', 'wide', 'full', 'medium-wide', 'medium',
    'medium-close', 'close-up', 'extreme-close', 'over-shoulder',
    'pov', 'aerial', 'low-angle', 'high-angle', 'dutch-angle'
  ]
  return validTypes.includes(type as ShotType) ? type as ShotType : 'medium'
}

/**
 * 验证运镜类型
 */
function validateCameraMovement(movement: string): CameraMovement {
  const validMovements: CameraMovement[] = [
    'static', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down',
    'dolly-in', 'dolly-out', 'truck-left', 'truck-right',
    'crane-up', 'crane-down', 'zoom-in', 'zoom-out', 'follow', 'arc', 'handheld'
  ]
  return validMovements.includes(movement as CameraMovement) ? movement as CameraMovement : 'static'
}

/**
 * 生成建议
 */
function generateSuggestions(panels: StoryboardPanel[], shotVariety: number, paceScore: number): string[] {
  const suggestions: string[] = []

  if (shotVariety < 0.5) {
    suggestions.push(t('dramaScript.storyboard.suggestionDiversity'))
  }

  if (paceScore < 0.5) {
    suggestions.push(t('dramaScript.storyboard.suggestionPacing'))
  }

  const staticCount = panels.filter(p => p.cameraMovement === 'static').length
  if (staticCount === panels.length) {
    suggestions.push(t('dramaScript.storyboard.suggestionMovement'))
  }

  const closeUps = panels.filter(p => p.shotType === 'close-up' || p.shotType === 'extreme-close').length
  if (closeUps === 0 && panels.length >= 3) {
    suggestions.push(t('dramaScript.storyboard.suggestionCloseUp'))
  }

  if (panels.length < 2) {
    suggestions.push(t('dramaScript.storyboard.suggestionCount'))
  }

  return suggestions
}

/**
 * 创建默认分析
 */
function createDefaultAnalysis(fragmentId: string): StoryboardAnalysis {
  return {
    fragmentId,
    panels: [{
      id: `panel-${fragmentId}-0`,
      fragmentId,
      panelNumber: 1,
      shotType: 'medium',
      cameraMovement: 'static',
      composition: {
        type: 'rule-of-thirds',
        focalPoint: { x: 0.5, y: 0.5 },
        depth: 'medium',
        balance: 'balanced',
      },
      lighting: {
        type: 'natural',
        mood: t('dramaScript.storyboard.defaultLightingMood'),
        keyLightDirection: 'front',
        contrast: 'medium',
        colorTemperature: 'neutral',
      },
      duration: 3,
      description: t('dramaScript.storyboard.defaultDescription'),
      keyElements: [],
    }],
    totalDuration: 3,
    shotVariety: 0,
    paceScore: 1,
    suggestions: [t('dramaScript.storyboard.defaultSuggestion')],
    cinematicScore: 50,
  }
}

// ========== 镜头推荐 ==========

/**
 * 根据场景内容推荐镜头
 */
export function recommendShots(
  fragment: SceneFragment,
  emotion: string = ''
): ShotRecommendation[] {
  const recommendations: ShotRecommendation[] = []
  const desc = (fragment.description || '').toLowerCase()
  const scene = (fragment.scene || '').toLowerCase()

  // 根据场景类型推荐
  if (scene.includes('室外') || scene.includes('风景') || scene.includes('城市')) {
    recommendations.push({
      shotType: 'wide',
      reason: t('dramaScript.storyboard.reasonWideForEnvironment'),
      emotionalImpact: t('dramaScript.storyboard.impactGrandScale'),
      alternativeShots: ['extreme-wide', 'aerial'],
    })
  }

  // 根据描述内容推荐
  if (desc.includes('对话') || desc.includes('聊天') || desc.includes('说')) {
    recommendations.push({
      shotType: 'over-shoulder',
      reason: t('dramaScript.storyboard.reasonOverShoulderForDialogue'),
      emotionalImpact: t('dramaScript.storyboard.impactSpatialRelation'),
      alternativeShots: ['medium', 'medium-close'],
    })
  }

  if (desc.includes('表情') || desc.includes('情感') || desc.includes('眼泪') || desc.includes('笑')) {
    recommendations.push({
      shotType: 'close-up',
      reason: t('dramaScript.storyboard.reasonCloseUpForEmotion'),
      emotionalImpact: t('dramaScript.storyboard.impactEmotionalResonance'),
      alternativeShots: ['extreme-close', 'medium-close'],
    })
  }

  if (desc.includes('跑') || desc.includes('追') || desc.includes('动作')) {
    recommendations.push({
      shotType: 'full',
      reason: t('dramaScript.storyboard.reasonFullForAction'),
      emotionalImpact: t('dramaScript.storyboard.impactDynamicTension'),
      alternativeShots: ['medium-wide', 'wide'],
    })
  }

  if (desc.includes('紧张') || desc.includes('恐惧') || desc.includes('不安')) {
    recommendations.push({
      shotType: 'dutch-angle',
      reason: t('dramaScript.storyboard.reasonDutchAngleForUnease'),
      emotionalImpact: t('dramaScript.storyboard.impactVisualInstability'),
      alternativeShots: ['low-angle', 'high-angle'],
    })
  }

  if (desc.includes('威严') || desc.includes('强大') || desc.includes('英雄')) {
    recommendations.push({
      shotType: 'low-angle',
      reason: t('dramaScript.storyboard.reasonLowAngleForPower'),
      emotionalImpact: t('dramaScript.storyboard.impactMajesty'),
      alternativeShots: ['medium', 'full'],
    })
  }

  // 根据情感推荐
  if (emotion) {
    const emotionLower = emotion.toLowerCase()
    if (emotionLower.includes('浪漫') || emotionLower.includes('温馨')) {
      recommendations.push({
        shotType: 'medium-close',
        reason: t('dramaScript.storyboard.reasonMediumCloseForWarmth'),
        emotionalImpact: t('dramaScript.storyboard.impactIntimacy'),
        alternativeShots: ['close-up', 'medium'],
      })
    }
  }

  // 如果没有匹配，提供默认推荐
  if (recommendations.length === 0) {
    recommendations.push({
      shotType: 'medium',
      reason: t('dramaScript.storyboard.reasonMediumUniversal'),
      emotionalImpact: t('dramaScript.storyboard.impactBalanced'),
      alternativeShots: ['medium-wide', 'medium-close'],
    })
  }

  return recommendations
}

// ========== 运镜推荐 ==========

/**
 * 根据场景推荐运镜
 */
export function recommendCameraMovement(
  fragment: SceneFragment,
  currentShot: ShotType
): { movement: CameraMovement; reason: string }[] {
  const recommendations: { movement: CameraMovement; reason: string }[] = []
  const desc = (fragment.description || '').toLowerCase()

  // 跟随动作
  if (desc.includes('走') || desc.includes('移动')) {
    recommendations.push({ movement: 'follow', reason: t('dramaScript.storyboard.reasonFollowMovement') })
    recommendations.push({ movement: 'truck-right', reason: t('dramaScript.storyboard.reasonTruckRightFollow') })
  }

  // 揭示
  if (desc.includes('发现') || desc.includes('看到') || desc.includes('出现')) {
    recommendations.push({ movement: 'dolly-in', reason: t('dramaScript.storyboard.reasonDollyInDiscovery') })
    recommendations.push({ movement: 'zoom-in', reason: t('dramaScript.storyboard.reasonZoomInFocus') })
  }

  // 情感升华
  if (desc.includes('结束') || desc.includes('离开') || desc.includes('告别')) {
    recommendations.push({ movement: 'dolly-out', reason: t('dramaScript.storyboard.reasonDollyOutFarewell') })
    recommendations.push({ movement: 'crane-up', reason: t('dramaScript.storyboard.reasonCraneUpLiberation') })
  }

  // 紧张场景
  if (desc.includes('紧张') || desc.includes('追逐') || desc.includes('危险')) {
    recommendations.push({ movement: 'handheld', reason: t('dramaScript.storyboard.reasonHandheldTension') })
    recommendations.push({ movement: 'zoom-in', reason: t('dramaScript.storyboard.reasonZoomInPressure') })
  }

  // 重要时刻
  if (desc.includes('重要') || desc.includes('关键') || desc.includes('转折')) {
    recommendations.push({ movement: 'arc', reason: t('dramaScript.storyboard.reasonArcImportant') })
    recommendations.push({ movement: 'dolly-in', reason: t('dramaScript.storyboard.reasonDollyInFocus') })
  }

  // 默认推荐
  if (recommendations.length === 0) {
    recommendations.push({ movement: 'static', reason: t('dramaScript.storyboard.reasonStaticGeneral') })
    if (currentShot === 'wide' || currentShot === 'extreme-wide') {
      recommendations.push({ movement: 'pan-right', reason: t('dramaScript.storyboard.reasonPanRightEnvironment') })
    }
  }

  return recommendations
}

// ========== 工具函数 ==========

/**
 * 获取镜头类型信息
 */
export function getShotTypeInfo(type: ShotType): { name: string; description: string; useCase: string } {
  const infoMap = getShotTypeInfoMap()
  return infoMap[type] || { name: type, description: '', useCase: '' }
}

/**
 * 获取运镜信息
 */
export function getCameraMovementInfo(movement: CameraMovement): { name: string; effect: string } {
  const infoMap = getCameraMovementInfoMap()
  return infoMap[movement] || { name: movement, effect: '' }
}

/**
 * 获取所有镜头类型
 */
export function getAllShotTypes(): Array<{ type: ShotType; info: { name: string; description: string; useCase: string } }> {
  const infoMap = getShotTypeInfoMap()
  return Object.entries(infoMap).map(([type, info]) => ({
    type: type as ShotType,
    info,
  }))
}

/**
 * 获取所有运镜类型
 */
export function getAllCameraMovements(): Array<{ movement: CameraMovement; info: { name: string; effect: string } }> {
  const infoMap = getCameraMovementInfoMap()
  return Object.entries(infoMap).map(([movement, info]) => ({
    movement: movement as CameraMovement,
    info,
  }))
}

/**
 * 估算分镜总时长
 */
export function estimateTotalDuration(panels: StoryboardPanel[]): number {
  return panels.reduce((sum, p) => sum + p.duration, 0)
}

/**
 * 分析镜头节奏
 */
export function analyzePacing(panels: StoryboardPanel[]): {
  averageDuration: number
  minDuration: number
  maxDuration: number
  variance: number
  pacingType: 'fast' | 'medium' | 'slow' | 'varied'
} {
  if (panels.length === 0) {
    return { averageDuration: 0, minDuration: 0, maxDuration: 0, variance: 0, pacingType: 'medium' }
  }

  const durations = panels.map(p => p.duration)
  const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length
  const minDuration = Math.min(...durations)
  const maxDuration = Math.max(...durations)
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) / durations.length

  let pacingType: 'fast' | 'medium' | 'slow' | 'varied'
  if (variance > 1) {
    pacingType = 'varied'
  } else if (averageDuration < 2) {
    pacingType = 'fast'
  } else if (averageDuration > 4) {
    pacingType = 'slow'
  } else {
    pacingType = 'medium'
  }

  return { averageDuration, minDuration, maxDuration, variance, pacingType }
}

/**
 * 导出分镜为文本描述
 */
export function exportStoryboardAsText(analysis: StoryboardAnalysis): string {
  let text = `${t('dramaScript.storyboard.exportTitle')}\n`
  text += `${'='.repeat(50)}\n\n`
  text += `${t('dramaScript.storyboard.exportTotalDuration')}: ${analysis.totalDuration}${t('dramaScript.storyboard.unitSeconds')}\n`
  text += `${t('dramaScript.storyboard.exportShotCount')}: ${analysis.panels.length}\n`
  text += `${t('dramaScript.storyboard.exportCinematicScore')}: ${analysis.cinematicScore}/100\n\n`

  analysis.panels.forEach((panel, index) => {
    const shotInfo = getShotTypeInfo(panel.shotType)
    const movementInfo = getCameraMovementInfo(panel.cameraMovement)

    text += `【${t('dramaScript.storyboard.exportShotLabel')} ${index + 1}】\n`
    text += `${t('dramaScript.storyboard.exportType')}: ${shotInfo.name} (${panel.shotType})\n`
    text += `${t('dramaScript.storyboard.exportMovement')}: ${movementInfo.name} (${panel.cameraMovement})\n`
    text += `${t('dramaScript.storyboard.exportDuration')}: ${panel.duration}${t('dramaScript.storyboard.unitSeconds')}\n`
    text += `${t('dramaScript.storyboard.exportDescription')}: ${panel.description}\n`
    if (panel.keyElements.length > 0) {
      text += `${t('dramaScript.storyboard.exportKeyElements')}: ${panel.keyElements.join(', ')}\n`
    }
    if (panel.notes) {
      text += `${t('dramaScript.storyboard.exportDirectorNotes')}: ${panel.notes}\n`
    }
    text += '\n'
  })

  if (analysis.suggestions.length > 0) {
    text += `【${t('dramaScript.storyboard.exportSuggestions')}】\n`
    analysis.suggestions.forEach((s, i) => {
      text += `${i + 1}. ${s}\n`
    })
  }

  return text
}
