import { View, Text } from '@tarojs/components'
import type { CSSProperties, ReactNode } from 'react'
import { getRnTokens, type RnThemeMode, type RnThemeTokens } from '@ihui/design-tokens'

/**
 * Taro 适配层:NavBar
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text 组件,不适合共享层。
 *
 * 复用 packages/app/src/components/NavBar 的 props 契约 + 样式计算逻辑,
 * 仅替换 web 元素(`div`/`span` → `View`/`Text`)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 */
export interface NavBarProps {
  title?: string
  subtitle?: string
  onBack?: () => void
  rightAction?: ReactNode
  transparent?: boolean
  statusBarHeight?: number
  className?: string
  colorScheme?: RnThemeMode
}

const HEIGHT_DEFAULT = 44
const HEIGHT_WITH_SUBTITLE = 56
const BACK_BUTTON_SIZE = 32
const SIDE_PLACEHOLDER_WIDTH = 32

const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  container: (tk: RnThemeTokens, transparent: boolean, statusBarHeight: number): CSSProperties => ({
    width: '100%',
    backgroundColor: transparent ? 'transparent' : tk.surface.card,
    borderBottomWidth: transparent ? 0 : 1,
    borderBottomColor: tk.border.light,
    borderBottomStyle: transparent ? 'none' : 'solid',
    paddingTop: toRpx(statusBarHeight),
  }),
  row: (contentHeight: number): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(16),
    paddingRight: toRpx(16),
    height: toRpx(contentHeight),
  }),
  backBtn: (): CSSProperties => ({
    width: toRpx(BACK_BUTTON_SIZE),
    height: toRpx(BACK_BUTTON_SIZE),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  center: (): CSSProperties => ({
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  right: (): CSSProperties => ({
    minWidth: toRpx(SIDE_PLACEHOLDER_WIDTH),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
  }),
  sidePlaceholder: (): CSSProperties => ({
    width: toRpx(SIDE_PLACEHOLDER_WIDTH),
    flexShrink: 0,
  }),
}

const textStyles = {
  backArrow: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(28),
    lineHeight: `${toRpx(30)}`,
    color: tk.text.primary,
  }),
  title: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    fontWeight: 600,
    color: tk.text.primary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }),
  subtitle: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(12),
    color: tk.text.secondary,
    marginTop: toRpx(2),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }),
}

export function NavBar({
  title,
  subtitle,
  onBack,
  rightAction,
  transparent = false,
  statusBarHeight = 0,
  className,
  colorScheme = 'light',
}: NavBarProps) {
  const tk = getRnTokens(colorScheme)
  const contentHeight = subtitle ? HEIGHT_WITH_SUBTITLE : HEIGHT_DEFAULT

  return (
    <View className={className} style={viewStyles.container(tk, transparent, statusBarHeight)}>
      <View style={viewStyles.row(contentHeight)}>
        {onBack ? (
          <View onTap={onBack} style={viewStyles.backBtn()} hoverClass="opacity-60">
            <Text style={textStyles.backArrow(tk)}>{'‹'}</Text>
          </View>
        ) : (
          <View style={viewStyles.sidePlaceholder()} />
        )}

        <View style={viewStyles.center()}>
          {title ? <Text style={textStyles.title(tk)}>{title}</Text> : null}
          {subtitle ? <Text style={textStyles.subtitle(tk)}>{subtitle}</Text> : null}
        </View>

        {rightAction ? (
          <View style={viewStyles.right()}>{rightAction}</View>
        ) : (
          <View style={viewStyles.sidePlaceholder()} />
        )}
      </View>
    </View>
  )
}
