// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * AppearanceProvider(2026-11-15 立):把外观设置实时映射到 <html>。
 *
 * 为什么需要 Provider 而不是在每个组件里读 store:
 *   - 字号、字重、行高、宽度这类偏好是全站级 CSS 变量,集中写一次比 200 处 useStore 便宜;
 *   - 界面字号需要覆盖 design-tokens 的 `--text-*` 档位,基准值只在运行时读一次,
 *     避免在 CSS 里复制第二份字号表(单一源仍是 tokens.css);
 *   - Ctrl+= / Ctrl+- / Ctrl+0 是全局快捷键,由本 Provider 单一处理(event.code 判定,
 *     与键盘布局无关;同时 preventDefault 接管浏览器原生缩放)。
 *
 * 与既有 store 的边界:
 *   - 中间步骤档位 / 代码换行分别住在 conversation-detail-mode 与 code-block-prefs,
 *     本 Provider 不读写它们;
 *   - 主题(明暗)仍由 next-themes 负责,本 Provider 只叠加排版相关变量。
 */

import * as React from 'react'

import { useAppearanceCloudSync } from '@/hooks/use-appearance-cloud-sync'
import { useResolvedAppearanceConfig } from '@/hooks/use-resolved-appearance'
import {
  CONTENT_WIDTHS,
  DENSITY_GAPS,
  FONT_STACKS,
  LETTER_SPACINGS,
  LINE_HEIGHTS,
} from '@/lib/appearance-tokens'
import { contrastForeground } from '@/lib/color-contrast'
import { useAppearanceScopeStore } from '@/stores/appearance-scope'
import {
  CHAT_FONT_SCALE_MAX,
  CHAT_FONT_SCALE_MIN,
  type CustomThemeConfig,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useAppearanceStore,
} from '@/stores/appearance-settings'

/** design-tokens 的字号档位(与 tokens.css 受管块同名,不复制数值) */
const TEXT_STEPS = [
  'badge',
  'caption',
  'label',
  'body-sm',
  'body',
  'strong',
  'title',
  'title-lg',
  'subtitle',
  'heading-sm',
  'heading',
  'headline',
  'display',
  'display-xl',
  'display-lg',
  // Tailwind 默认档位:组件里仍有 text-xs/text-sm/text-base 等写法,
  // 一并纳入缩放,「界面字号」才是真正的全站口径(缺失的档位读取时自动跳过)。
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
] as const

/** 正文字重只影响阅读档,标题/强调档保持设计值 */
const BODY_WEIGHT_STEPS = ['caption', 'label', 'body-sm', 'body'] as const

const BODY_WEIGHT_VALUES = {
  regular: 400,
  medium: 500,
  bold: 600,
} as const

/** 圆角档位(与 tokens.css 受管块同名,数值仍在运行时读取) */
const RADIUS_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as const
const RADIUS_SCALE_FACTORS = { sharp: 0.5, standard: 1, rounded: 1.6 } as const

/** 移动端界面字号增强倍率(仅在开关开启且视口 ≤767px 时叠加) */
const MOBILE_FONT_BOOST = 1.06

const THEME_PALETTE_KEYS = [
  'primary',
  'background',
  'foreground',
  'card',
  'muted',
  'border',
] as const

/** 色觉辅助滤镜定义:挂在文档里供 CSS filter: url(#id) 引用 */
function ColorVisionFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
    >
      <defs>
        <filter id="ihui-cv-protanopia" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"
          />
        </filter>
        <filter id="ihui-cv-deuteranopia" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"
          />
        </filter>
        <filter id="ihui-cv-tritanopia" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"
          />
        </filter>
      </defs>
    </svg>
  )
}

/** 基准档位值:首次挂载时从 tokens.css 算得,后续只做乘法,不在代码里复制字号表 */
interface BaseLineHeight {
  value: number
  /** Tailwind 默认档位的行高常是 1.25/0.875 这类无单位比值,只能保持比例,不能写成 px */
  isPx: boolean
}
interface BaseTypography {
  size: Record<string, number>
  lineHeight: Record<string, BaseLineHeight>
}

let baseTypography: BaseTypography | null = null

function readBaseTypography(root: HTMLElement): BaseTypography {
  if (baseTypography) return baseTypography
  // 开发期 HMR 会重置模块级缓存,但 <html> 上的内联覆盖会残留上一实例的值。
  // 先清掉自己的覆盖再读 design-tokens 的基准,避免"倍率乘倍率"逐次放大。
  for (const step of TEXT_STEPS) {
    root.style.removeProperty(`--text-${step}`)
    root.style.removeProperty(`--text-${step}--line-height`)
    root.style.removeProperty(`--text-${step}--font-weight`)
  }
  const computed = getComputedStyle(root)
  // Tailwind 默认档位是 0.75rem 这类相对单位;自定义变量是 px。
  // getComputedStyle 对自定义属性返回的是「指定值」而非绝对长度,必须按单位换算,
  // 否则 0.75rem 会被 parseFloat 成 0.75(当成 px)而毁掉字号。
  const rootFontSize = Number.parseFloat(computed.fontSize) || 16
  const size: Record<string, number> = {}
  const lineHeight: Record<string, BaseLineHeight> = {}
  for (const step of TEXT_STEPS) {
    const rawSize = computed.getPropertyValue(`--text-${step}`).trim()
    // 未被主题/构建产出的档位直接跳过,避免写入凭空的 CSS 变量
    if (!rawSize) continue
    const parsedSize = Number.parseFloat(rawSize)
    if (!Number.isFinite(parsedSize)) continue
    if (rawSize.endsWith('rem')) size[step] = parsedSize * rootFontSize
    else if (rawSize.endsWith('px')) size[step] = parsedSize
    else continue // em/%/calc 等无法安全换算,交给原样式
    const rawLine = computed.getPropertyValue(`--text-${step}--line-height`).trim()
    const parsedLine = Number.parseFloat(rawLine)
    lineHeight[step] = Number.isFinite(parsedLine)
      ? { value: parsedLine, isPx: rawLine.endsWith('px') }
      : { value: 0, isPx: false }
  }
  baseTypography = { size, lineHeight }
  return baseTypography
}

function px(value: number): string {
  return `${Math.round(value * 100) / 100}px`
}

/** 圆角基准:同字号方案,只在首挂载读一次 design-tokens 的值 */
let baseRadius: Record<string, number> | null = null

function readBaseRadius(root: HTMLElement): Record<string, number> {
  if (baseRadius) return baseRadius
  // 先清自己的内联覆盖,避免 HMR 后"倍率乘倍率"
  for (const step of RADIUS_STEPS) root.style.removeProperty(`--radius-${step}`)
  const computed = getComputedStyle(root)
  const rootFontSize = Number.parseFloat(computed.fontSize) || 16
  const out: Record<string, number> = {}
  for (const step of RADIUS_STEPS) {
    const raw = computed.getPropertyValue(`--radius-${step}`).trim()
    if (!raw) continue
    const parsed = Number.parseFloat(raw)
    if (!Number.isFinite(parsed)) continue
    if (raw.endsWith('rem')) out[step] = parsed * rootFontSize
    else if (raw.endsWith('px')) out[step] = parsed
  }
  baseRadius = out
  return baseRadius
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  // 有效配置 = 全局外观 + 当前工作区覆盖(见 use-resolved-appearance)
  const config = useResolvedAppearanceConfig()
  // 账号级云同步:开关开启且已登录时拉取/回传快照
  useAppearanceCloudSync()

  // 移动端视口:仅在 mobileFontBoost 开启时参与字号倍率
  const [isMobileViewport, setIsMobileViewport] = React.useState(false)
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const query = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobileViewport(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  // ① 界面字号 + 正文字重:覆盖 design-tokens 的字号三连档
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const base = readBaseTypography(root)
    const mobileBoost = config.mobileFontBoost && isMobileViewport ? MOBILE_FONT_BOOST : 1
    const scale = config.uiScale * mobileBoost
    const weight = BODY_WEIGHT_VALUES[config.bodyWeight]

    for (const step of Object.keys(base.size)) {
      root.style.setProperty(`--text-${step}`, px(base.size[step]! * scale))
      const line = base.lineHeight[step]
      // 只有 px 行高按倍率缩放;无单位比值保持原样(字号已缩放,比例自然保留)
      if (line?.isPx && line.value > 0) {
        root.style.setProperty(`--text-${step}--line-height`, px(line.value * scale))
      }
    }
    for (const step of BODY_WEIGHT_STEPS) {
      root.style.setProperty(`--text-${step}--font-weight`, String(weight))
    }
  }, [config.uiScale, config.bodyWeight, config.mobileFontBoost, isMobileViewport])

  // ② 字体族:阅读障碍字体优先级最高;否则只覆盖字体栈变量,不改字号/间距
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.legibilityFont = String(config.legibilityFont)
    if (config.legibilityFont) {
      root.style.setProperty('--font-sans', FONT_STACKS.legibility)
      root.style.setProperty('--font-sans-sc', FONT_STACKS.legibility)
      return
    }
    if (config.fontFamily === 'system') {
      root.style.removeProperty('--font-sans')
      root.style.removeProperty('--font-sans-sc')
      return
    }
    const stack = FONT_STACKS[config.fontFamily]
    root.style.setProperty('--font-sans', stack)
    root.style.setProperty('--font-sans-sc', stack)
  }, [config.fontFamily, config.legibilityFont])

  // ③ 对话排版变量
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.setProperty('--chat-font-scale', String(config.chatFontScale))
    root.style.setProperty('--chat-line-height', LINE_HEIGHTS[config.lineHeight])
    root.style.setProperty('--chat-letter-spacing', LETTER_SPACINGS[config.letterSpacing])
    root.style.setProperty('--chat-code-font-size', `${config.codeFontSize}px`)
    root.style.setProperty('--chat-content-width', CONTENT_WIDTHS[config.contentWidth])
    root.style.setProperty('--chat-user-bubble-width', `${config.userBubbleWidth}%`)
    root.style.setProperty('--chat-message-gap', DENSITY_GAPS[config.messageDensity])
    root.style.setProperty('--chat-input-scale', String(config.chatInputScale))
    root.style.setProperty('--chat-text-align', config.textAlign === 'justify' ? 'justify' : 'left')
  }, [
    config.chatFontScale,
    config.lineHeight,
    config.letterSpacing,
    config.codeFontSize,
    config.contentWidth,
    config.userBubbleWidth,
    config.messageDensity,
    config.chatInputScale,
    config.textAlign,
  ])

  // ③-b 圆角倍率:sharp 0.5 / standard 1 / rounded 1.6
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const base = readBaseRadius(root)
    const factor = RADIUS_SCALE_FACTORS[config.radiusScale]
    for (const [step, value] of Object.entries(base)) {
      root.style.setProperty(`--radius-${step}`, px(value * factor))
    }
    // tokens.css 注:裸 --radius 与 --radius-lg 同值(向后兼容),一并缩放
    if (base.lg !== undefined) root.style.setProperty('--radius', px(base.lg * factor))
  }, [config.radiusScale])

  // ③-c 自定义主题:亮/暗两套变量同时写到根节点,CSS 按 .dark 选择,
  // 切换明暗主题不需要 JS 重新计算。关闭时只摘 data 属性,变量保留无副作用。
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const theme: CustomThemeConfig = config.customTheme
    for (const mode of ['light', 'dark'] as const) {
      const palette = theme[mode]
      for (const key of THEME_PALETTE_KEYS) {
        root.style.setProperty(`--custom-${mode}-${key}`, palette[key])
      }
      const foreground = contrastForeground(palette.primary)
      root.style.setProperty(`--custom-${mode}-primary-foreground`, foreground)
      root.style.setProperty(
        `--custom-${mode}-primary-foreground-rgb`,
        foreground === '#ffffff' ? '255, 255, 255' : '0, 0, 0',
      )
    }
    root.dataset.customTheme = String(theme.enabled)
  }, [config.customTheme])

  // ④ 无障碍 / 开关类:用 data-* 交给 CSS 选择器,避免内联样式散落
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.fontFamily = config.fontFamily
    root.dataset.reduceMotion = String(config.reduceMotion)
    root.dataset.highContrast = String(config.highContrast)
    root.dataset.linkUnderline = String(config.linkUnderline)
    root.dataset.tabularNums = String(config.tabularNums)
    root.dataset.accent = config.accentColor
    root.dataset.radiusScale = config.radiusScale
    root.dataset.paragraphGap = String(config.paragraphGap)
    root.dataset.firstLineIndent = String(config.firstLineIndent)
    root.dataset.tableZebra = String(config.tableZebra)
    root.dataset.focusRing = String(config.focusRing)
    root.dataset.grayscale = String(config.grayscale)
    root.dataset.mobileFontBoost = String(config.mobileFontBoost)
    root.dataset.colorVision = config.colorVision
  }, [
    config.fontFamily,
    config.reduceMotion,
    config.highContrast,
    config.linkUnderline,
    config.tabularNums,
    config.accentColor,
    config.radiusScale,
    config.paragraphGap,
    config.firstLineIndent,
    config.tableZebra,
    config.focusRing,
    config.grayscale,
    config.mobileFontBoost,
    config.colorVision,
  ])

  // ⑤ 全局缩放快捷键(Ctrl/Cmd + = / - / 0;Shift 位调对话字号)
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return
      const code = event.code
      const key = event.key
      const plus = code === 'Equal' || code === 'NumpadAdd' || key === '=' || key === '+'
      const minus = code === 'Minus' || code === 'NumpadSubtract' || key === '-'
      const zero = code === 'Digit0' || code === 'Numpad0' || key === '0'
      if (!plus && !minus && !zero) return

      event.preventDefault()
      event.stopPropagation()

      const store = useAppearanceStore.getState()
      if (event.shiftKey) {
        if (plus) store.nudgeChatFontScale(0.05)
        else if (minus) store.nudgeChatFontScale(-0.05)
        else store.resetAll()
      } else if (plus) {
        store.nudgeUiScale(0.05)
      } else if (minus) {
        store.nudgeUiScale(-0.05)
      } else {
        store.update({ uiScale: 1 })
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [])

  // ⑥ 跨标签页同步:另一个标签页改了外观设置时,本标签页重新水合同一份 localStorage。
  // storage key 与 createPersistConfig 的 name 逐字一致(见 stores/persist-helpers)。
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'ihui-appearance-settings') void useAppearanceStore.persist.rehydrate()
      // 工作区/单条消息覆盖住另一份 storage,只水合全局会把覆盖丢成"看不见"的状态
      else if (event.key === 'ihui-appearance-scope') {
        void useAppearanceScopeStore.persist.rehydrate()
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 供其它代码/测试读取的边界值(避免各自写死 0.85/1.4/0.8/1.6)
  React.useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.dataset.uiScaleMin = String(UI_SCALE_MIN)
    root.dataset.uiScaleMax = String(UI_SCALE_MAX)
    root.dataset.chatFontScaleMin = String(CHAT_FONT_SCALE_MIN)
    root.dataset.chatFontScaleMax = String(CHAT_FONT_SCALE_MAX)
  }, [])

  return (
    <>
      {children}
      <ColorVisionFilters />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
