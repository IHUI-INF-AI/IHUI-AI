// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外观与排版偏好 store(2026-11-15 立)。
 *
 * 覆盖用户可感知的四类偏好:
 *   ① 字体与字号 —— 界面字号、AI 对话字号、字重、行高、字间距、字体族、代码字号;
 *   ② 布局与宽度 —— 对话内容宽度、消息间距、用户气泡宽度;
 *   ③ 显示详细度 —— 时间戳 / Token 用量 / 操作按钮 / 思考过程 / 工具调用;
 *   ④ AI 回复风格 —— 语气、语言、长度、格式、解释深度、自定义风格指令。
 *
 * 设计约束:
 *   - 全部落 localStorage(走 createPersistConfig 单点工厂),刷新后保持;
 *   - 与既有 store 的分工:
 *       · 中间步骤档位(全部/仅命令/仅正文)住在 conversation-detail-mode,
 *       · 代码块自动换行住在 code-block-prefs,
 *       本 store **不复制**这两份状态,设置页直接读写原 store;
 *   - 导出/导入只处理本 store 的配置字段,不碰其他 store 的 localStorage 键。
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/* ============================== 类型 ============================== */

export type FontFamilyMode = 'system' | 'sans' | 'serif' | 'mono'
export type BodyWeightMode = 'regular' | 'medium' | 'bold'
export type LineHeightMode = 'compact' | 'normal' | 'relaxed'
export type LetterSpacingMode = 'tight' | 'normal' | 'wide'
export type ContentWidthMode = 'narrow' | 'standard' | 'wide' | 'xwide' | 'full'
export type MessageDensityMode = 'compact' | 'cozy' | 'spacious'
export type TimestampFormatMode = '24h' | '12h' | 'relative'
export type AccentColorMode = 'default' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose'
export type RadiusScaleMode = 'sharp' | 'standard' | 'rounded'
export type TextAlignMode = 'left' | 'justify'
export type EmojiPolicyMode = 'auto' | 'none' | 'minimal'
export type ColorVisionMode =
  'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'achromatopsia'

/** 自定义主题的一套色板(亮色或暗色) */
export interface CustomThemePalette {
  primary: string
  background: string
  foreground: string
  card: string
  muted: string
  border: string
}

export interface CustomThemeConfig {
  enabled: boolean
  light: CustomThemePalette
  dark: CustomThemePalette
}

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  enabled: false,
  light: {
    primary: '#18181b',
    background: '#ffffff',
    foreground: '#18181b',
    card: '#ffffff',
    muted: '#f4f4f5',
    border: '#e4e4e7',
  },
  dark: {
    primary: '#fafafa',
    background: '#09090b',
    foreground: '#fafafa',
    card: '#111113',
    muted: '#1f1f23',
    border: '#2a2a2f',
  },
}
export type AiToneMode =
  'default' | 'professional' | 'friendly' | 'humorous' | 'concise' | 'academic'
export type AiLanguageMode = 'auto' | 'zh-CN' | 'en' | 'zh-TW' | 'ja' | 'ko'
export type AiLengthMode = 'short' | 'medium' | 'long'
export type AiFormatMode = 'auto' | 'list' | 'table' | 'paragraph' | 'minimal'
export type ExplainDepthMode = 'beginner' | 'standard' | 'expert'
export type VerbosityPreset = 'concise' | 'standard' | 'detailed' | 'custom'

/** 纯配置字段(导出/导入/持久化都只认这一份形状) */
export interface AppearanceConfig {
  /** 界面字号倍率(0.85–1.4) */
  uiScale: number
  /** AI 对话字号倍率(0.8–1.6,叠加在界面字号之上) */
  chatFontScale: number
  fontFamily: FontFamilyMode
  bodyWeight: BodyWeightMode
  lineHeight: LineHeightMode
  letterSpacing: LetterSpacingMode
  tabularNums: boolean
  /** 代码块字号(px,13–18) */
  codeFontSize: number
  contentWidth: ContentWidthMode
  messageDensity: MessageDensityMode
  /** 用户消息气泡最大宽度(百分比,60–90) */
  userBubbleWidth: number
  showTimestamps: boolean
  showUsage: boolean
  showActions: boolean
  showReasoning: boolean
  showToolCalls: boolean
  timestampFormat: TimestampFormatMode
  tone: AiToneMode
  aiLanguage: AiLanguageMode
  aiLength: AiLengthMode
  aiFormat: AiFormatMode
  explainDepth: ExplainDepthMode
  customStyle: string
  reduceMotion: boolean
  highContrast: boolean
  linkUnderline: boolean
  /** 主色档:只存枚举,亮/暗色值由 globals.css 的 data-accent 段提供 */
  accentColor: AccentColorMode
  /** 圆角倍率档:运行时乘在 design-tokens 的 --radius-* 基准上 */
  radiusScale: RadiusScaleMode
  /** 段间距加大(markdown 段落之间留白) */
  paragraphGap: boolean
  /** 中文段落首行缩进 2em */
  firstLineIndent: boolean
  /** 仿生阅读:拉丁词首段加粗 */
  bionicReading: boolean
  /** 阅读标尺:跟随指针的横向高亮带 */
  readingRuler: boolean
  /** 表格偶数行斑马纹 */
  tableZebra: boolean
  /** 键盘焦点环强化 */
  focusRing: boolean
  /** 全站灰度 */
  grayscale: boolean
  /** 移动端界面字号额外增强 */
  mobileFontBoost: boolean
  /** 输入框字号倍率(0.9–1.3) */
  chatInputScale: number
  /** 长消息折叠 */
  longMessageCollapse: boolean
  /** 折叠时显示的行数(6–40) */
  collapseLines: number
  /** 术语表:每行「原文=译法」 */
  glossary: string
  /** 禁用词:换行/逗号/顿号分隔 */
  bannedWords: string
  /** 跟随提问语言回答(仅在语言=auto 时生效) */
  followQuestionLanguage: boolean
  /** 中文与英文/数字之间保留半角空格 */
  chineseSpacing: boolean
  /** 中文语境使用全角标点 */
  fullWidthPunctuation: boolean
  /** 对话正文对齐方式 */
  textAlign: TextAlignMode
  /** AI 输出中的 emoji 策略 */
  emojiPolicy: EmojiPolicyMode
  /** 阅读障碍友好字体(OpenDyslexic 等,附更大字距/行高) */
  legibilityFont: boolean
  /** 色觉辅助滤镜 */
  colorVision: ColorVisionMode
  /** 全量自定义主题(亮/暗两套色板) */
  customTheme: CustomThemeConfig
}

interface AppearanceSettingsState extends AppearanceConfig {
  /** 批量更新(设置页每个控件直接调用) */
  update: (patch: Partial<AppearanceConfig>) => void
  /** 界面缩放步进(快捷键 Ctrl+= / Ctrl+-) */
  nudgeUiScale: (delta: number) => void
  /** 对话字号步进(快捷键 Ctrl+Shift+= / Ctrl+Shift+-) */
  nudgeChatFontScale: (delta: number) => void
  /** 恢复全部默认 */
  resetAll: () => void
  /** 导出 JSON 文本 */
  exportConfig: () => string
  /** 导入 JSON 文本;成功返回 true */
  importConfig: (raw: string) => boolean
}

/* ============================== 常量 ============================== */

export const UI_SCALE_MIN = 0.85
export const UI_SCALE_MAX = 1.4
export const UI_SCALE_STEP = 0.05

export const CHAT_FONT_SCALE_MIN = 0.8
export const CHAT_FONT_SCALE_MAX = 1.6
export const CHAT_FONT_SCALE_STEP = 0.05

export const CODE_FONT_SIZE_MIN = 13
export const CODE_FONT_SIZE_MAX = 18

export const USER_BUBBLE_WIDTH_MIN = 60
export const USER_BUBBLE_WIDTH_MAX = 90

export const CHAT_INPUT_SCALE_MIN = 0.9
export const CHAT_INPUT_SCALE_MAX = 1.3

export const COLLAPSE_LINES_MIN = 6
export const COLLAPSE_LINES_MAX = 40

export const APPEARANCE_DEFAULTS: AppearanceConfig = {
  uiScale: 1,
  chatFontScale: 1,
  fontFamily: 'system',
  bodyWeight: 'regular',
  lineHeight: 'normal',
  letterSpacing: 'normal',
  tabularNums: false,
  codeFontSize: 15,
  contentWidth: 'standard',
  messageDensity: 'cozy',
  userBubbleWidth: 85,
  showTimestamps: true,
  showUsage: true,
  showActions: true,
  showReasoning: true,
  showToolCalls: true,
  timestampFormat: '24h',
  tone: 'default',
  aiLanguage: 'auto',
  aiLength: 'medium',
  aiFormat: 'auto',
  explainDepth: 'standard',
  customStyle: '',
  reduceMotion: false,
  highContrast: false,
  linkUnderline: false,
  accentColor: 'default',
  radiusScale: 'standard',
  paragraphGap: false,
  firstLineIndent: false,
  bionicReading: false,
  readingRuler: false,
  tableZebra: false,
  focusRing: false,
  grayscale: false,
  mobileFontBoost: false,
  chatInputScale: 1,
  longMessageCollapse: false,
  collapseLines: 14,
  glossary: '',
  bannedWords: '',
  followQuestionLanguage: false,
  chineseSpacing: false,
  fullWidthPunctuation: false,
  textAlign: 'left',
  emojiPolicy: 'auto',
  legibilityFont: false,
  colorVision: 'none',
  customTheme: DEFAULT_CUSTOM_THEME,
}

/** 配置字段清单(导出/导入/持久化共用,避免三处各写一遍) */
export const APPEARANCE_CONFIG_KEYS = [
  'uiScale',
  'chatFontScale',
  'fontFamily',
  'bodyWeight',
  'lineHeight',
  'letterSpacing',
  'tabularNums',
  'codeFontSize',
  'contentWidth',
  'messageDensity',
  'userBubbleWidth',
  'showTimestamps',
  'showUsage',
  'showActions',
  'showReasoning',
  'showToolCalls',
  'timestampFormat',
  'tone',
  'aiLanguage',
  'aiLength',
  'aiFormat',
  'explainDepth',
  'customStyle',
  'reduceMotion',
  'highContrast',
  'linkUnderline',
  'accentColor',
  'radiusScale',
  'paragraphGap',
  'firstLineIndent',
  'bionicReading',
  'readingRuler',
  'tableZebra',
  'focusRing',
  'grayscale',
  'mobileFontBoost',
  'chatInputScale',
  'longMessageCollapse',
  'collapseLines',
  'glossary',
  'bannedWords',
  'followQuestionLanguage',
  'chineseSpacing',
  'fullWidthPunctuation',
  'textAlign',
  'emojiPolicy',
  'legibilityFont',
  'colorVision',
  'customTheme',
] as const satisfies readonly (keyof AppearanceConfig)[]

/** 设置页「显示详细度」三档预设:只声明字段值,不产生第二套状态 */
export const VERBOSITY_PRESETS: Record<
  Exclude<VerbosityPreset, 'custom'>,
  Pick<
    AppearanceConfig,
    'showTimestamps' | 'showUsage' | 'showActions' | 'showReasoning' | 'showToolCalls'
  >
> = {
  concise: {
    showTimestamps: false,
    showUsage: false,
    showActions: false,
    showReasoning: false,
    showToolCalls: false,
  },
  standard: {
    showTimestamps: true,
    showUsage: true,
    showActions: true,
    showReasoning: true,
    showToolCalls: true,
  },
  detailed: {
    showTimestamps: true,
    showUsage: true,
    showActions: true,
    showReasoning: true,
    showToolCalls: true,
  },
}

/** 「一键字号」预设:与详细度预设同一模式 —— 只声明字段值,不落盘第二份状态 */
export type SizePreset = 'compact' | 'comfortable' | 'large' | 'custom'

export const SIZE_PRESETS: Record<
  Exclude<SizePreset, 'custom'>,
  Pick<AppearanceConfig, 'uiScale' | 'chatFontScale' | 'messageDensity'>
> = {
  compact: { uiScale: 0.9, chatFontScale: 0.9, messageDensity: 'compact' },
  comfortable: { uiScale: 1, chatFontScale: 1, messageDensity: 'cozy' },
  large: { uiScale: 1.15, chatFontScale: 1.25, messageDensity: 'spacious' },
}

const FONT_FAMILIES: readonly FontFamilyMode[] = ['system', 'sans', 'serif', 'mono']
const BODY_WEIGHTS: readonly BodyWeightMode[] = ['regular', 'medium', 'bold']
const LINE_HEIGHTS: readonly LineHeightMode[] = ['compact', 'normal', 'relaxed']
const LETTER_SPACINGS: readonly LetterSpacingMode[] = ['tight', 'normal', 'wide']
const CONTENT_WIDTHS: readonly ContentWidthMode[] = ['narrow', 'standard', 'wide', 'xwide', 'full']
const MESSAGE_DENSITIES: readonly MessageDensityMode[] = ['compact', 'cozy', 'spacious']
const TIMESTAMP_FORMATS: readonly TimestampFormatMode[] = ['24h', '12h', 'relative']
const AI_TONES: readonly AiToneMode[] = [
  'default',
  'professional',
  'friendly',
  'humorous',
  'concise',
  'academic',
]
const AI_LANGUAGES: readonly AiLanguageMode[] = ['auto', 'zh-CN', 'en', 'zh-TW', 'ja', 'ko']
const AI_LENGTHS: readonly AiLengthMode[] = ['short', 'medium', 'long']
const AI_FORMATS: readonly AiFormatMode[] = ['auto', 'list', 'table', 'paragraph', 'minimal']
const EXPLAIN_DEPTHS: readonly ExplainDepthMode[] = ['beginner', 'standard', 'expert']
const ACCENT_COLORS: readonly AccentColorMode[] = [
  'default',
  'blue',
  'violet',
  'emerald',
  'amber',
  'rose',
]
const RADIUS_SCALES: readonly RadiusScaleMode[] = ['sharp', 'standard', 'rounded']
const TEXT_ALIGNS: readonly TextAlignMode[] = ['left', 'justify']
const EMOJI_POLICIES: readonly EmojiPolicyMode[] = ['auto', 'none', 'minimal']
const COLOR_VISIONS: readonly ColorVisionMode[] = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
]

/* ============================== 工具 ============================== */

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundScale(value: number): number {
  return Math.round(value * 100) / 100
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function pickConfig(state: AppearanceConfig): AppearanceConfig {
  const out = {} as Record<string, unknown>
  for (const key of APPEARANCE_CONFIG_KEYS) out[key] = state[key]
  return out as unknown as AppearanceConfig
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** 单套色板校验:只认 6 位十六进制,坏值保持默认(不整包失败) */
function sanitizePalette(raw: unknown, fallback: CustomThemePalette): CustomThemePalette {
  if (typeof raw !== 'object' || raw === null) return { ...fallback }
  const input = raw as Record<string, unknown>
  const out = { ...fallback }
  for (const key of ['primary', 'background', 'foreground', 'card', 'muted', 'border'] as const) {
    const value = input[key]
    if (typeof value === 'string' && HEX_COLOR.test(value)) out[key] = value.toLowerCase()
  }
  return out
}

function sanitizeCustomTheme(raw: unknown): CustomThemeConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const input = raw as Record<string, unknown>
  return {
    enabled: input.enabled === true,
    light: sanitizePalette(input.light, DEFAULT_CUSTOM_THEME.light),
    dark: sanitizePalette(input.dark, DEFAULT_CUSTOM_THEME.dark),
  }
}

/** 宽松校验:只接受已知字段与合法值,坏字段保持默认(不整包失败) */
function sanitizeConfig(raw: unknown): Partial<AppearanceConfig> {
  if (typeof raw !== 'object' || raw === null) return {}
  const input = raw as Record<string, unknown>
  const out: Partial<AppearanceConfig> = {}

  const num = (key: keyof AppearanceConfig, min: number, max: number) => {
    const v = input[key]
    if (typeof v === 'number' && Number.isFinite(v)) {
      ;(out as Record<string, unknown>)[key] = clamp(v, min, max)
    }
  }
  const bool = (key: keyof AppearanceConfig) => {
    const v = input[key]
    if (typeof v === 'boolean') (out as Record<string, unknown>)[key] = v
  }
  const text = (key: keyof AppearanceConfig, maxLength: number) => {
    const v = input[key]
    if (typeof v === 'string') (out as Record<string, unknown>)[key] = v.slice(0, maxLength)
  }
  const oneOf = <T extends string>(key: keyof AppearanceConfig, allowed: readonly T[]) => {
    const v = input[key]
    if (isOneOf(v, allowed)) (out as Record<string, unknown>)[key] = v
  }

  num('uiScale', UI_SCALE_MIN, UI_SCALE_MAX)
  num('chatFontScale', CHAT_FONT_SCALE_MIN, CHAT_FONT_SCALE_MAX)
  num('codeFontSize', CODE_FONT_SIZE_MIN, CODE_FONT_SIZE_MAX)
  num('userBubbleWidth', USER_BUBBLE_WIDTH_MIN, USER_BUBBLE_WIDTH_MAX)
  num('chatInputScale', CHAT_INPUT_SCALE_MIN, CHAT_INPUT_SCALE_MAX)
  num('collapseLines', COLLAPSE_LINES_MIN, COLLAPSE_LINES_MAX)

  oneOf('fontFamily', FONT_FAMILIES)
  oneOf('bodyWeight', BODY_WEIGHTS)
  oneOf('lineHeight', LINE_HEIGHTS)
  oneOf('letterSpacing', LETTER_SPACINGS)
  oneOf('contentWidth', CONTENT_WIDTHS)
  oneOf('messageDensity', MESSAGE_DENSITIES)
  oneOf('timestampFormat', TIMESTAMP_FORMATS)
  oneOf('tone', AI_TONES)
  oneOf('aiLanguage', AI_LANGUAGES)
  oneOf('aiLength', AI_LENGTHS)
  oneOf('aiFormat', AI_FORMATS)
  oneOf('explainDepth', EXPLAIN_DEPTHS)
  oneOf('accentColor', ACCENT_COLORS)
  oneOf('radiusScale', RADIUS_SCALES)
  oneOf('textAlign', TEXT_ALIGNS)
  oneOf('emojiPolicy', EMOJI_POLICIES)
  oneOf('colorVision', COLOR_VISIONS)

  const customTheme = sanitizeCustomTheme(input.customTheme)
  if (customTheme) out.customTheme = customTheme

  bool('tabularNums')
  bool('showTimestamps')
  bool('showUsage')
  bool('showActions')
  bool('showReasoning')
  bool('showToolCalls')
  bool('reduceMotion')
  bool('highContrast')
  bool('linkUnderline')
  bool('paragraphGap')
  bool('firstLineIndent')
  bool('bionicReading')
  bool('readingRuler')
  bool('tableZebra')
  bool('focusRing')
  bool('grayscale')
  bool('mobileFontBoost')
  bool('longMessageCollapse')
  bool('followQuestionLanguage')
  bool('chineseSpacing')
  bool('fullWidthPunctuation')
  bool('legibilityFont')

  text('customStyle', 500)
  text('glossary', 800)
  text('bannedWords', 400)
  return out
}

/** 供外部(工作区覆盖/云同步)复用的配置校验入口 */
export function sanitizeAppearanceConfig(raw: unknown): Partial<AppearanceConfig> {
  return sanitizeConfig(raw)
}

/* ============================== Store ============================== */

export const useAppearanceStore = create<AppearanceSettingsState>()(
  persist(
    (set, get) => ({
      ...APPEARANCE_DEFAULTS,

      update: (patch) => set(patch),

      nudgeUiScale: (delta) =>
        set((s) => ({
          uiScale: roundScale(clamp(s.uiScale + delta, UI_SCALE_MIN, UI_SCALE_MAX)),
        })),

      nudgeChatFontScale: (delta) =>
        set((s) => ({
          chatFontScale: roundScale(
            clamp(s.chatFontScale + delta, CHAT_FONT_SCALE_MIN, CHAT_FONT_SCALE_MAX),
          ),
        })),

      resetAll: () => set({ ...APPEARANCE_DEFAULTS }),

      exportConfig: () =>
        JSON.stringify(
          { app: 'ihui-ai', kind: 'appearance', version: 1, config: pickConfig(get()) },
          null,
          2,
        ),

      importConfig: (raw) => {
        try {
          const parsed: unknown = JSON.parse(raw)
          const container =
            typeof parsed === 'object' && parsed !== null && 'config' in parsed
              ? (parsed as { config: unknown }).config
              : parsed
          const sanitized = sanitizeConfig(container)
          if (Object.keys(sanitized).length === 0) return false
          set(sanitized)
          return true
        } catch {
          return false
        }
      },
    }),
    createPersistConfig<AppearanceSettingsState>(
      'ihui-appearance-settings',
      (state) => pickConfig(state) as Partial<AppearanceSettingsState>,
    ),
  ),
)

/* ============================== 非 Hook 入口 ============================== */

/** 供事件回调 / 发送链读取当前配置(与 hook 读同一份 store) */
export function getAppearanceConfig(): AppearanceConfig {
  const state = useAppearanceStore.getState()
  return pickConfig(state)
}

/** 当前「显示详细度」档位(由 5 个开关 + 折叠策略反推,不落盘第二份预设状态)。
 *  standard 与 detailed 的 5 个开关相同,靠折叠策略区分:
 *  standard = auto;detailed = expanded;concise = collapsed。 */
export function resolveVerbosityPreset(
  config: AppearanceConfig,
  foldMode: 'auto' | 'collapsed' | 'expanded' = 'auto',
): VerbosityPreset {
  const match = (preset: Exclude<VerbosityPreset, 'custom'>) => {
    const p = VERBOSITY_PRESETS[preset]
    return (
      config.showTimestamps === p.showTimestamps &&
      config.showUsage === p.showUsage &&
      config.showActions === p.showActions &&
      config.showReasoning === p.showReasoning &&
      config.showToolCalls === p.showToolCalls
    )
  }

  if (match('concise') && foldMode === 'collapsed') return 'concise'
  if (match('standard') && foldMode === 'auto') return 'standard'
  if (match('detailed') && foldMode === 'expanded') return 'detailed'
  return 'custom'
}

/** 当前「一键字号」档位:三个字段全等才算命中,任一被单独改过即 custom */
export function resolveSizePreset(config: AppearanceConfig): SizePreset {
  for (const preset of ['compact', 'comfortable', 'large'] as const) {
    const p = SIZE_PRESETS[preset]
    if (
      config.uiScale === p.uiScale &&
      config.chatFontScale === p.chatFontScale &&
      config.messageDensity === p.messageDensity
    ) {
      return preset
    }
  }
  return 'custom'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
