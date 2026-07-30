import { View, Text } from '@tarojs/components'
import type { CSSProperties, ReactNode } from 'react'
import { getRnTokens, type RnThemeTokens, type RnThemeMode } from '@ihui/design-tokens'
import type { TFunction } from '@ihui/types'
import { useTt } from '@/i18n'

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

const SUBTITLE_GAP = 8
const ARROW_GAP = 4
const DEFAULT_FALLBACK = '查看更多'

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
    fontSize: 14,
    fontWeight: 700,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  subtitle: (tk: RnThemeTokens): CSSProperties => ({
    marginLeft: SUBTITLE_GAP,
    fontSize: 12,
    color: tk.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  moreLabel: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: 12,
    color: tk.brand.DEFAULT,
  }),
  moreArrow: (tk: RnThemeTokens): CSSProperties => ({
    marginLeft: ARROW_GAP,
    fontSize: 12,
    color: tk.brand.DEFAULT,
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
  colorScheme = 'light',
  t: tProp,
}: SectionHeaderProps) {
  const tk = getRnTokens(colorScheme)
  const tt = useTt()
  // 优先用 prop 注入的 t,其次用 I18nContext 的 tt(支持 fallback),最末硬编码中文
  const tFn: TFunction | undefined =
    tProp ??
    ((key, options) => {
      // tt 签名是 (key, fallback, params?),转化为 (key, options) 语义
      const v = tt(key, key, options as Record<string, string | number> | undefined)
      return v
    })

  const moreLabel = moreText ?? (tFn ? tFn('common.viewMore') : DEFAULT_FALLBACK)

  // Taro 端样式:把 px 转为 rpx 字符串(weapp-taitwindcss 在编译时也能识别 number)
  const titleStyle: CSSProperties = {
    ...textStyles.title(tk),
    fontSize: toRpx(14),
  }
  const subtitleStyle: CSSProperties = {
    ...textStyles.subtitle(tk),
    fontSize: toRpx(12),
  }
  const moreLabelStyle: CSSProperties = {
    ...textStyles.moreLabel(tk),
    fontSize: toRpx(12),
  }
  const moreArrowStyle: CSSProperties = {
    ...textStyles.moreArrow(tk),
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
              marginLeft: toRpx(8),
              cursor: onMore ? 'pointer' : 'default',
            }}
          >
            <Text style={moreLabelStyle}>{moreLabel}</Text>
            <Text style={moreArrowStyle}>{'>'}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
