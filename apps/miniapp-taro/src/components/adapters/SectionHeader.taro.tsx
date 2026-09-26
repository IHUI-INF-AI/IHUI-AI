// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt, t } from '@/i18n'
import { View, Text } from '@tarojs/components'
import type { CSSProperties, ReactNode } from 'react'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import {
  SECTION_HEADER_ARROW_MARGIN_LEFT_PX,
  SECTION_HEADER_MORE_MARGIN_LEFT_PX,
  SECTION_HEADER_SUBTITLE_FONT_PX,
  SECTION_HEADER_SUBTITLE_GAP_PX,
  SECTION_HEADER_TITLE_FONT_PX,
} from '@ihui/shared/ui/section-header-spec'
import { useAppTheme } from '@/lib/theme'
import LineIcon from '@/components/LineIcon'
import type { TFunction } from '@ihui/types'

/**
 * Taro 适配层:SectionHeader
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text 组件,不适合共享层。
 *
 * 复用 packages/app/src/components/SectionHeader 的 props 契约 + 样式计算逻辑,
 * 仅替换 web 元素(`div`/`span` → `View`/`Text`)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 *
 * i18n 通过 `useTt()`(miniapp-taro 端 I18nContext)注入,fallback 由 TFunction 处理;
 * 也可显式传 `t` 覆盖,未传则用 I18nContext t 函数,再次降级到硬编码中文。
 */
export interface SectionHeaderProps {
  title: string
  subtitle?: string
  moreText?: string
  showMore?: boolean
  onMore?: () => void
  extra?: ReactNode
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: RnThemeMode
  /** i18n 翻译函数(可选);未传则用 I18nContext t,再降级硬编码中文 */
  t?: TFunction
}

const DEFAULT_FALLBACK = t('common.more')
/// 标题区字号/间距唯一源在 @ihui/shared/ui/section-header-spec(与 packages/app 的 RN 实现同表)。
/// 「更多」文字 12 是 §4 定档(MoreLink 单源),不在本表重复。

/** 容器样式(独立函数避免联合类型) */
const containerStyle = (): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
})

/** 文本样式集中管理(避免 style 联合类型) */
const textStyles = {
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: SECTION_HEADER_TITLE_FONT_PX,
    fontWeight: 700,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  subtitle: (tk: RnThemeTokens): CSSProperties => ({
    marginLeft: SECTION_HEADER_SUBTITLE_GAP_PX,
    fontSize: SECTION_HEADER_SUBTITLE_FONT_PX,
    color: tk.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  moreLabel: (tk: RnThemeTokens): CSSProperties => ({
    // 「更多」文字 12 = §4 定档(MoreLink 单源),不重复登记
    fontSize: 12,
    color: tk.text.secondary,
  }),
}

/** Taro `rpx` 单位换算(1px = 2rpx,保持与 miniapp-taro 全局风格一致) */
const toRpx = (px: number): string => `${px * 2}rpx`

export function SectionHeader({
  title,
  subtitle,
  moreText,
  showMore = true,
  onMore,
  extra,
  className,
  colorScheme,
  t: tProp,
}: SectionHeaderProps) {
  const { resolved: appTheme } = useAppTheme()
  const effectiveScheme: RnThemeMode = colorScheme ?? appTheme
  const tk = getRnTokens(effectiveScheme)
  const tt = useTt()
  // 优先用 prop 注入的 t,其次用 I18nContext 的 tt(支持 fallback),最末硬编码中文
  const tFn: TFunction | undefined =
    tProp ??
    ((key, options) => {
      // tt 签名是 (key, fallback, params?),转化为 (key, options) 语义
      const v = tt(key, key, options as Record<string, string | number> | undefined)
      return v
    })

  const moreLabel = moreText ?? (tFn ? tFn('common.more') : DEFAULT_FALLBACK)

  // Taro 端样式:把 px 转为 rpx 字符串(weapp-taitwindcss 在编译时也能识别 number)
  const titleStyle: CSSProperties = {
    ...textStyles.title(tk),
    fontSize: toRpx(SECTION_HEADER_TITLE_FONT_PX),
  }
  const subtitleStyle: CSSProperties = {
    ...textStyles.subtitle(tk),
    fontSize: toRpx(SECTION_HEADER_SUBTITLE_FONT_PX),
  }
  const moreLabelStyle: CSSProperties = {
    ...textStyles.moreLabel(tk),
    fontSize: toRpx(12),
  }

  return (
    <View className={className} style={containerStyle()}>
      <View style={{ display: 'flex', alignItems: 'center', minWidth: 0, flex: 1 }}>
        <Text style={titleStyle}>{title}</Text>
        {subtitle ? <Text style={subtitleStyle}>{subtitle}</Text> : null}
      </View>
      <View style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {extra}
        {showMore ? (
          <View
            onTap={onMore}
            style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: toRpx(SECTION_HEADER_MORE_MARGIN_LEFT_PX),
              cursor: onMore ? 'pointer' : 'default',
            }}
            hoverClass="opacity-60"
          >
            <Text style={moreLabelStyle}>{moreLabel}</Text>
            <LineIcon
              name="chevron-right"
              size={24}
              color={tk.text.secondary}
              style={{ marginLeft: toRpx(SECTION_HEADER_ARROW_MARGIN_LEFT_PX) }}
            />
          </View>
        ) : null}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
