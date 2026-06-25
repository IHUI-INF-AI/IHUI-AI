/**
 * 高级视频处理模块
 *
 * 功能：
 * 1. 字幕自动生成
 * 2. 转场效果应用
 * 3. 音效/背景音乐管理
 * 4. 视频合并预览
 * 5. 导出配置
 */

import { logger } from '@/utils/logger'
import { streamGenerateContent } from '@/api/ai/ai'
import { t } from '@/utils/i18n'
import type { SceneFragment } from './DramaScriptExcel.types'

// ========== 类型定义 ==========

export interface Subtitle {
  id: string
  fragmentId: string
  startTime: number  // 秒
  endTime: number  // 秒
  text: string
  style: SubtitleStyle
  position: 'top' | 'center' | 'bottom'
}

export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  fontColor: string
  backgroundColor: string
  backgroundOpacity: number
  strokeColor: string
  strokeWidth: number
  bold: boolean
  italic: boolean
}

export interface AudioTrack {
  id: string
  type: 'bgm' | 'sfx' | 'voice'
  name: string
  url?: string
  volume: number  // 0-1
  startTime: number
  endTime?: number
  loop: boolean
  fadeIn?: number  // 淡入时长（秒）
  fadeOut?: number  // 淡出时长（秒）
}

export interface TransitionConfig {
  type: 'none' | 'fade' | 'dissolve' | 'wipe' | 'slide' | 'zoom'
  duration: number
  direction?: 'left' | 'right' | 'up' | 'down' | 'in' | 'out'
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
}

export interface VideoProject {
  id: string
  name: string
  fragments: SceneFragment[]
  subtitles: Subtitle[]
  audioTracks: AudioTrack[]
  transitions: Map<string, TransitionConfig>  // fragmentId -> transition
  exportSettings: ExportSettings
  createdAt: string
  updatedAt: string
}

export interface ExportSettings {
  resolution: '720p' | '1080p' | '4k'
  fps: 24 | 30 | 60
  format: 'mp4' | 'webm' | 'mov'
  quality: 'low' | 'medium' | 'high' | 'ultra'
  includeSubtitles: boolean
  subtitleBurnIn: boolean
  audioCodec: 'aac' | 'mp3' | 'opus'
  videoBitrate?: number
  audioBitrate?: number
}

export interface SFXPreset {
  id: string
  name: string
  category: string
  description: string
  tags: string[]
}

export interface BGMPreset {
  id: string
  name: string
  mood: string
  genre: string
  bpm?: number
  duration?: number
}

// ========== 字幕生成 ==========

/**
 * 为片段生成字幕
 */
export function generateSubtitles(
  fragment: SceneFragment,
  options: {
    style?: Partial<SubtitleStyle>
    maxCharsPerLine?: number
    wordsPerSecond?: number
  } = {}
): Promise<Subtitle[]> {
  return new Promise((resolve) => {
    const {
      style = {},
      maxCharsPerLine = 20,
      wordsPerSecond = 3,
    } = options

    if (!fragment.description) {
      resolve([])
      return
    }

    const prompt = `${t('dramaScript.videoProcessing.subtitle.promptConvert')}

${t('dramaScript.aiCreation.promptScene')}${fragment.scene || t('dramaScript.common.unknownScene')}
${t('dramaScript.aiCreation.promptCharacter')}${fragment.character || t('dramaScript.common.unknownCharacter')}
${t('dramaScript.aiCreation.promptDescription')}${fragment.description}

${t('dramaScript.videoProcessing.subtitle.promptRequirement1')}${maxCharsPerLine}${t('dramaScript.videoProcessing.subtitle.promptRequirement1Suffix')}
2. ${t('dramaScript.videoProcessing.subtitle.promptRequirement2')}
3. ${t('dramaScript.videoProcessing.subtitle.promptRequirement3')}

${t('dramaScript.videoProcessing.subtitle.promptReturnFormat')}
{
  "text": "${t('dramaScript.videoProcessing.subtitle.promptSubtitleText')}",
  "duration": ${t('dramaScript.videoProcessing.subtitle.promptDuration')}
}

${t('dramaScript.videoProcessing.subtitle.promptReturnJson')}`

    let generatedContent = ''

    void streamGenerateContent(
      {
        prompt,
        modelId: 'gpt-4',
        type: 'text',
        parameters: { temperature: 0.5, maxTokens: 1000 },
      },
      (chunk: string) => {
        generatedContent += chunk
      },
      () => {
        try {
          const jsonMatch = generatedContent.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const subtitleData = JSON.parse(jsonMatch[0])
            let currentTime = 0

            const subtitles: Subtitle[] = subtitleData.map((s: { text: string; duration: number }, i: number) => {
              const duration = s.duration || (s.text.length / wordsPerSecond)
              const subtitle: Subtitle = {
                id: `sub-${fragment.id}-${i}`,
                fragmentId: fragment.id,
                startTime: currentTime,
                endTime: currentTime + duration,
                text: s.text,
                style: {
                  fontFamily: style.fontFamily || 'Microsoft YaHei',
                  fontSize: style.fontSize || 24,
                  fontColor: style.fontColor || 'var(--el-bg-color)',
                  backgroundColor: style.backgroundColor || 'var(--el-text-color-primary)',
                  backgroundOpacity: style.backgroundOpacity ?? 0.7,
                  strokeColor: style.strokeColor || 'var(--el-text-color-primary)',
                  strokeWidth: style.strokeWidth || 2,
                  bold: style.bold ?? false,
                  italic: style.italic ?? false,
                },
                position: 'bottom',
              }
              currentTime += duration + 0.3  // 加0.3秒间隔
              return subtitle
            })

            resolve(subtitles)
          } else {
            resolve([])
          }
        } catch (error) {
          logger.error('Failed to parse subtitle:', error)
          resolve([])
        }
      },
      (error) => {
        logger.error('Failed to generate subtitle:', error)
        resolve([])
      }
    )
  })
}

/**
 * 批量生成字幕
 */
export async function batchGenerateSubtitles(
  fragments: SceneFragment[],
  options?: Parameters<typeof generateSubtitles>[1]
): Promise<Map<string, Subtitle[]>> {
  const result = new Map<string, Subtitle[]>()

  for (const fragment of fragments) {
    if (fragment.videoUrl) {
      const subtitles = await generateSubtitles(fragment, options)
      result.set(fragment.id, subtitles)
    }
  }

  return result
}

// ========== 字幕样式预设 ==========

/**
 * 获取字幕样式预设
 */
export function getSubtitleStylePresets(): Array<{
  id: string
  name: string
  style: SubtitleStyle
}> {
  return [
    {
      id: 'default',
      name: t('dramaScript.videoProcessing.subtitleStyle.default'),
      style: {
        fontFamily: 'Microsoft YaHei',
        fontSize: 24,
        fontColor: 'var(--el-bg-color)',
        backgroundColor: 'var(--el-text-color-primary)',
        backgroundOpacity: 0.7,
        strokeColor: 'var(--el-text-color-primary)',
        strokeWidth: 2,
        bold: false,
        italic: false,
      },
    },
    {
      id: 'minimal',
      name: t('dramaScript.videoProcessing.subtitleStyle.minimal'),
      style: {
        fontFamily: 'Microsoft YaHei',
        fontSize: 20,
        fontColor: 'var(--el-bg-color)',
        backgroundColor: 'transparent',
        backgroundOpacity: 0,
        strokeColor: 'var(--el-text-color-primary)',
        strokeWidth: 3,
        bold: false,
        italic: false,
      },
    },
    {
      id: 'dramatic',
      name: t('dramaScript.videoProcessing.subtitleStyle.dramatic'),
      style: {
        fontFamily: 'KaiTi',
        fontSize: 28,
        fontColor: 'var(--color-yellow-ffd700)',
        backgroundColor: 'var(--el-text-color-primary)',
        backgroundOpacity: 0.5,
        strokeColor: 'var(--el-text-color-primary)',
        strokeWidth: 2,
        bold: true,
        italic: false,
      },
    },
    {
      id: 'romantic',
      name: t('dramaScript.videoProcessing.subtitleStyle.romantic'),
      style: {
        fontFamily: 'FangSong',
        fontSize: 22,
        fontColor: 'var(--el-text-color-primary)',
        backgroundColor: 'var(--el-text-color-primary)',
        backgroundOpacity: 0.3,
        strokeColor: 'var(--el-bg-color)',
        strokeWidth: 1,
        bold: false,
        italic: true,
      },
    },
    {
      id: 'comedy',
      name: t('dramaScript.videoProcessing.subtitleStyle.comedy'),
      style: {
        fontFamily: 'Microsoft YaHei',
        fontSize: 26,
        fontColor: 'var(--el-text-color-primary)',
        backgroundColor: 'var(--el-text-color-primary)',
        backgroundOpacity: 0.8,
        strokeColor: 'var(--el-text-color-primary)',
        strokeWidth: 2,
        bold: true,
        italic: false,
      },
    },
  ]
}

// ========== 音效预设 ==========

/**
 * 获取音效预设
 */
export function getSFXPresets(): SFXPreset[] {
  const envCat = t('dramaScript.videoProcessing.sfxCategory.environment')
  const actionCat = t('dramaScript.videoProcessing.sfxCategory.action')
  const emotionCat = t('dramaScript.videoProcessing.sfxCategory.emotion')
  const transitionCat = t('dramaScript.videoProcessing.sfxCategory.transition')

  const tagNature = t('dramaScript.videoProcessing.sfxTag.nature')
  const tagOutdoor = t('dramaScript.videoProcessing.sfxTag.outdoor')
  const tagWeather = t('dramaScript.videoProcessing.sfxTag.weather')
  const tagTension = t('dramaScript.videoProcessing.sfxTag.tension')
  const tagFresh = t('dramaScript.videoProcessing.sfxTag.fresh')
  const tagUrban = t('dramaScript.videoProcessing.sfxTag.urban')
  const tagNoisy = t('dramaScript.videoProcessing.sfxTag.noisy')
  const tagIndoor = t('dramaScript.videoProcessing.sfxTag.indoor')
  const tagLeisure = t('dramaScript.videoProcessing.sfxTag.leisure')
  const tagMovement = t('dramaScript.videoProcessing.sfxTag.movement')
  const tagDaily = t('dramaScript.videoProcessing.sfxTag.daily')
  const tagModern = t('dramaScript.videoProcessing.sfxTag.modern')
  const tagCommunication = t('dramaScript.videoProcessing.sfxTag.communication')
  const tagOffice = t('dramaScript.videoProcessing.sfxTag.office')
  const tagEmotion = t('dramaScript.videoProcessing.sfxTag.emotion')
  const tagSurprise = t('dramaScript.videoProcessing.sfxTag.surprise')
  const tagJoy = t('dramaScript.videoProcessing.sfxTag.joy')
  const tagSadness = t('dramaScript.videoProcessing.sfxTag.sadness')
  const tagDynamic = t('dramaScript.videoProcessing.sfxTag.dynamic')
  const tagPrompt = t('dramaScript.videoProcessing.sfxTag.prompt')
  const tagShock = t('dramaScript.videoProcessing.sfxTag.shock')

  return [
    // 环境音
    { id: 'sfx-wind', name: t('dramaScript.videoProcessing.sfx.wind.name'), category: envCat, description: t('dramaScript.videoProcessing.sfx.wind.description'), tags: [tagNature, tagOutdoor] },
    { id: 'sfx-rain', name: t('dramaScript.videoProcessing.sfx.rain.name'), category: envCat, description: t('dramaScript.videoProcessing.sfx.rain.description'), tags: [tagNature, tagWeather] },
    { id: 'sfx-thunder', name: t('dramaScript.videoProcessing.sfx.thunder.name'), category: envCat, description: t('dramaScript.videoProcessing.sfx.thunder.description'), tags: [tagNature, tagWeather, tagTension] },
    { id: 'sfx-birds', name: t('dramaScript.videoProcessing.sfx.birds.name'), category: envCat, description: t('dramaScript.videoProcessing.sfx.birds.description'), tags: [tagNature, tagFresh] },
    { id: 'sfx-city', name: t('dramaScript.videoProcessing.sfx.city.name'), category: envCat, description: t('dramaScript.videoProcessing.sfx.city.description'), tags: [tagUrban, tagNoisy] },
    { id: 'sfx-cafe', name: t('dramaScript.videoProcessing.sfx.cafe.name'), category: envCat, description: t('dramaScript.videoProcessing.sfx.cafe.description'), tags: [tagIndoor, tagLeisure] },

    // 动作音
    { id: 'sfx-footsteps', name: t('dramaScript.videoProcessing.sfx.footsteps.name'), category: actionCat, description: t('dramaScript.videoProcessing.sfx.footsteps.description'), tags: [tagMovement, tagDaily] },
    { id: 'sfx-door', name: t('dramaScript.videoProcessing.sfx.door.name'), category: actionCat, description: t('dramaScript.videoProcessing.sfx.door.description'), tags: [tagIndoor, tagDaily] },
    { id: 'sfx-phone', name: t('dramaScript.videoProcessing.sfx.phone.name'), category: actionCat, description: t('dramaScript.videoProcessing.sfx.phone.description'), tags: [tagModern, tagCommunication] },
    { id: 'sfx-typing', name: t('dramaScript.videoProcessing.sfx.typing.name'), category: actionCat, description: t('dramaScript.videoProcessing.sfx.typing.description'), tags: [tagOffice, tagModern] },

    // 情感音效
    { id: 'sfx-heartbeat', name: t('dramaScript.videoProcessing.sfx.heartbeat.name'), category: emotionCat, description: t('dramaScript.videoProcessing.sfx.heartbeat.description'), tags: [tagTension, tagEmotion] },
    { id: 'sfx-gasp', name: t('dramaScript.videoProcessing.sfx.gasp.name'), category: emotionCat, description: t('dramaScript.videoProcessing.sfx.gasp.description'), tags: [tagSurprise, tagEmotion] },
    { id: 'sfx-laugh', name: t('dramaScript.videoProcessing.sfx.laugh.name'), category: emotionCat, description: t('dramaScript.videoProcessing.sfx.laugh.description'), tags: [tagJoy, tagEmotion] },
    { id: 'sfx-cry', name: t('dramaScript.videoProcessing.sfx.cry.name'), category: emotionCat, description: t('dramaScript.videoProcessing.sfx.cry.description'), tags: [tagSadness, tagEmotion] },

    // 转场音效
    { id: 'sfx-whoosh', name: t('dramaScript.videoProcessing.sfx.whoosh.name'), category: transitionCat, description: t('dramaScript.videoProcessing.sfx.whoosh.description'), tags: [transitionCat, tagDynamic] },
    { id: 'sfx-ding', name: t('dramaScript.videoProcessing.sfx.ding.name'), category: transitionCat, description: t('dramaScript.videoProcessing.sfx.ding.description'), tags: [transitionCat, tagPrompt] },
    { id: 'sfx-boom', name: t('dramaScript.videoProcessing.sfx.boom.name'), category: transitionCat, description: t('dramaScript.videoProcessing.sfx.boom.description'), tags: [transitionCat, tagShock] },
  ]
}

/**
 * 获取背景音乐预设
 */
export function getBGMPresets(): BGMPreset[] {
  return [
    // 情感类
    { id: 'bgm-romantic', name: t('dramaScript.videoProcessing.bgm.romantic.name'), mood: t('dramaScript.videoProcessing.bgm.romantic.mood'), genre: t('dramaScript.videoProcessing.bgm.romantic.genre'), bpm: 70 },
    { id: 'bgm-sad', name: t('dramaScript.videoProcessing.bgm.sad.name'), mood: t('dramaScript.videoProcessing.bgm.sad.mood'), genre: t('dramaScript.videoProcessing.bgm.sad.genre'), bpm: 60 },
    { id: 'bgm-happy', name: t('dramaScript.videoProcessing.bgm.happy.name'), mood: t('dramaScript.videoProcessing.bgm.happy.mood'), genre: t('dramaScript.videoProcessing.bgm.happy.genre'), bpm: 120 },
    { id: 'bgm-tense', name: t('dramaScript.videoProcessing.bgm.tense.name'), mood: t('dramaScript.videoProcessing.bgm.tense.mood'), genre: t('dramaScript.videoProcessing.bgm.tense.genre'), bpm: 140 },
    { id: 'bgm-mysterious', name: t('dramaScript.videoProcessing.bgm.mysterious.name'), mood: t('dramaScript.videoProcessing.bgm.mysterious.mood'), genre: t('dramaScript.videoProcessing.bgm.mysterious.genre'), bpm: 80 },

    // 场景类
    { id: 'bgm-cafe', name: t('dramaScript.videoProcessing.bgm.cafe.name'), mood: t('dramaScript.videoProcessing.bgm.cafe.mood'), genre: t('dramaScript.videoProcessing.bgm.cafe.genre'), bpm: 90 },
    { id: 'bgm-night', name: t('dramaScript.videoProcessing.bgm.night.name'), mood: t('dramaScript.videoProcessing.bgm.night.mood'), genre: t('dramaScript.videoProcessing.bgm.night.genre'), bpm: 50 },
    { id: 'bgm-adventure', name: t('dramaScript.videoProcessing.bgm.adventure.name'), mood: t('dramaScript.videoProcessing.bgm.adventure.mood'), genre: t('dramaScript.videoProcessing.bgm.adventure.genre'), bpm: 130 },
    { id: 'bgm-comedy', name: t('dramaScript.videoProcessing.bgm.comedy.name'), mood: t('dramaScript.videoProcessing.bgm.comedy.mood'), genre: t('dramaScript.videoProcessing.bgm.comedy.genre'), bpm: 110 },
    { id: 'bgm-epic', name: t('dramaScript.videoProcessing.bgm.epic.name'), mood: t('dramaScript.videoProcessing.bgm.epic.mood'), genre: t('dramaScript.videoProcessing.bgm.epic.genre'), bpm: 100 },
  ]
}

// ========== 转场效果 ==========

/**
 * 获取转场预设
 */
export function getTransitionPresets(): Array<{
  id: string
  name: string
  config: TransitionConfig
}> {
  return [
    { id: 'none', name: t('dramaScript.videoProcessing.transition.none'), config: { type: 'none', duration: 0 } },
    { id: 'fade-short', name: t('dramaScript.videoProcessing.transition.fadeShort'), config: { type: 'fade', duration: 0.3 } },
    { id: 'fade-medium', name: t('dramaScript.videoProcessing.transition.fadeMedium'), config: { type: 'fade', duration: 0.5 } },
    { id: 'fade-long', name: t('dramaScript.videoProcessing.transition.fadeLong'), config: { type: 'fade', duration: 1 } },
    { id: 'dissolve', name: t('dramaScript.videoProcessing.transition.dissolve'), config: { type: 'dissolve', duration: 0.5 } },
    { id: 'wipe-left', name: t('dramaScript.videoProcessing.transition.wipeLeft'), config: { type: 'wipe', duration: 0.5, direction: 'left' } },
    { id: 'wipe-right', name: t('dramaScript.videoProcessing.transition.wipeRight'), config: { type: 'wipe', duration: 0.5, direction: 'right' } },
    { id: 'slide-left', name: t('dramaScript.videoProcessing.transition.slideLeft'), config: { type: 'slide', duration: 0.5, direction: 'left' } },
    { id: 'slide-up', name: t('dramaScript.videoProcessing.transition.slideUp'), config: { type: 'slide', duration: 0.5, direction: 'up' } },
    { id: 'zoom-in', name: t('dramaScript.videoProcessing.transition.zoomIn'), config: { type: 'zoom', duration: 0.5, direction: 'in' } },
    { id: 'zoom-out', name: t('dramaScript.videoProcessing.transition.zoomOut'), config: { type: 'zoom', duration: 0.5, direction: 'out' } },
  ]
}

/**
 * 根据场景变化智能推荐转场
 */
export function recommendTransition(
  prevFragment: SceneFragment,
  nextFragment: SceneFragment
): TransitionConfig {
  const prevScene = prevFragment.scene?.toLowerCase() || ''
  const nextScene = nextFragment.scene?.toLowerCase() || ''
  const _prevDesc = prevFragment.description?.toLowerCase() || ''
  const nextDesc = nextFragment.description?.toLowerCase() || ''

  // 同一场景，使用简单转场
  if (prevScene === nextScene) {
    return { type: 'fade', duration: 0.3 }
  }

  // 时间跳跃（出现"后来"、"第二天"等词）
  if (nextDesc.includes('后来') || nextDesc.includes('第二天') || nextDesc.includes('之后')) {
    return { type: 'dissolve', duration: 0.8 }
  }

  // 紧张/动作场景
  if (nextDesc.includes('突然') || nextDesc.includes('冲') || nextDesc.includes('跑')) {
    return { type: 'wipe', duration: 0.3, direction: 'left' }
  }

  // 浪漫/抒情场景
  if (nextDesc.includes('温柔') || nextDesc.includes('浪漫') || nextDesc.includes('爱')) {
    return { type: 'dissolve', duration: 1, easing: 'ease-in-out' }
  }

  // 默认使用淡入淡出
  return { type: 'fade', duration: 0.5 }
}

// ========== 导出设置 ==========

/**
 * 获取导出预设
 */
export function getExportPresets(): Array<{
  id: string
  name: string
  description: string
  settings: ExportSettings
}> {
  return [
    {
      id: 'social-media',
      name: t('dramaScript.videoProcessing.exportPreset.socialMedia.name'),
      description: t('dramaScript.videoProcessing.exportPreset.socialMedia.description'),
      settings: {
        resolution: '1080p',
        fps: 30,
        format: 'mp4',
        quality: 'high',
        includeSubtitles: true,
        subtitleBurnIn: true,
        audioCodec: 'aac',
      },
    },
    {
      id: 'high-quality',
      name: t('dramaScript.videoProcessing.exportPreset.highQuality.name'),
      description: t('dramaScript.videoProcessing.exportPreset.highQuality.description'),
      settings: {
        resolution: '4k',
        fps: 60,
        format: 'mp4',
        quality: 'ultra',
        includeSubtitles: true,
        subtitleBurnIn: false,
        audioCodec: 'aac',
      },
    },
    {
      id: 'web-preview',
      name: t('dramaScript.videoProcessing.exportPreset.webPreview.name'),
      description: t('dramaScript.videoProcessing.exportPreset.webPreview.description'),
      settings: {
        resolution: '720p',
        fps: 24,
        format: 'webm',
        quality: 'medium',
        includeSubtitles: true,
        subtitleBurnIn: true,
        audioCodec: 'opus',
      },
    },
    {
      id: 'mobile',
      name: t('dramaScript.videoProcessing.exportPreset.mobile.name'),
      description: t('dramaScript.videoProcessing.exportPreset.mobile.description'),
      settings: {
        resolution: '720p',
        fps: 30,
        format: 'mp4',
        quality: 'medium',
        includeSubtitles: true,
        subtitleBurnIn: true,
        audioCodec: 'aac',
      },
    },
  ]
}

// ========== 项目管理 ==========

/**
 * 创建视频项目
 */
export function createVideoProject(
  name: string,
  fragments: SceneFragment[]
): VideoProject {
  return {
    id: `project-${Date.now()}`,
    name,
    fragments,
    subtitles: [],
    audioTracks: [],
    transitions: new Map(),
    exportSettings: getExportPresets()[0].settings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * 导出项目配置
 */
export function exportProjectConfig(project: VideoProject): string {
  const config = {
    ...project,
    transitions: Array.from(project.transitions.entries()),
  }
  return JSON.stringify(config, null, 2)
}

/**
 * 导入项目配置
 */
export function importProjectConfig(configJson: string): VideoProject | null {
  try {
    const config = JSON.parse(configJson)
    return {
      ...config,
      transitions: new Map(config.transitions || []),
    }
  } catch (error) {
    logger.error('Failed to import project configuration:', error)
    return null
  }
}

// ========== 字幕格式转换 ==========

/**
 * 导出SRT格式字幕
 */
export function exportSRT(subtitles: Subtitle[]): string {
  return subtitles.map((sub, index) => {
    const startTime = formatSRTTime(sub.startTime)
    const endTime = formatSRTTime(sub.endTime)
    return `${index + 1}\n${startTime} --> ${endTime}\n${sub.text}\n`
  }).join('\n')
}

/**
 * 导出ASS格式字幕
 */
export function exportASS(subtitles: Subtitle[], title: string = t('dramaScript.videoProcessing.subtitle.defaultTitle')): string {
  const header = `[Script Info]
Title: ${title}
ScriptType: v4.00+
Collisions: Normal
PlayDepth: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,1,2,0,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

  const events = subtitles.map(sub => {
    const start = formatASSTime(sub.startTime)
    const end = formatASSTime(sub.endTime)
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${sub.text}`
  }).join('\n')

  return header + events
}

/**
 * 格式化SRT时间
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

/**
 * 格式化ASS时间
 */
function formatASSTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const cs = Math.floor((seconds % 1) * 100)

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/**
 * 计算项目总时长
 */
export function calculateProjectDuration(project: VideoProject): number {
  let totalDuration = 0

  for (const fragment of project.fragments) {
    totalDuration += fragment.videoDuration || 0
  }

  // 加上转场时间
  project.transitions.forEach((transition) => {
    if (transition.type !== 'none') {
      totalDuration += transition.duration * 0.5  // 转场会重叠一部分
    }
  })

  return totalDuration
}
