import { useMemo } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeMode, type RnThemeTokens } from '@ihui/design-tokens'

/**
 * Taro 适配层:Toolbar
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/Image + onTap,
 * 不适合共享层。
 *
 * 复用 packages/app/src/components/Toolbar 的 props 契约 + active 状态机,
 * 替换 web 元素(`div`/`img` → `View`/`Image`)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 */
export interface ToolbarItem {
  key: string
  icon: string
  active?: boolean
  onPress: () => void
}

export interface ToolbarProps {
  items: ToolbarItem[]
  separators?: string[]
  activeKey?: string
  className?: string
  colorScheme?: RnThemeMode
}

function isImagePath(icon: string): boolean {
  return /^(https?:)?\/\//.test(icon) || icon.startsWith('/')
}

const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  container: (tk: RnThemeTokens): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: toRpx(12),
    paddingRight: toRpx(12),
    paddingTop: toRpx(8),
    paddingBottom: toRpx(8),
    backgroundColor: tk.surface.muted,
    borderRadius: toRpx(8),
  }),
  rowItem: (): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  tool: (): CSSProperties => ({
    width: toRpx(32),
    height: toRpx(32),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: toRpx(6),
  }),
  toolActive: (tk: RnThemeTokens): CSSProperties => ({
    backgroundColor: tk.surface.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: tk.border.light,
  }),
  toolInactive: (): CSSProperties => ({
    backgroundColor: 'transparent',
  }),
  iconImg: (): CSSProperties => ({
    width: toRpx(18),
    height: toRpx(18),
  }),
  separator: (tk: RnThemeTokens): CSSProperties => ({
    width: 1,
    height: toRpx(20),
    backgroundColor: tk.border.medium,
    marginLeft: toRpx(4),
    marginRight: toRpx(4),
  }),
}

const textStyles = {
  iconEmoji: (tk: RnThemeTokens): CSSProperties => ({
    fontSize: toRpx(16),
    lineHeight: `${toRpx(20)}`,
    color: tk.text.primary,
  }),
}

export function Toolbar({
  items,
  separators,
  activeKey,
  className,
  colorScheme = 'light',
}: ToolbarProps) {
  const tk = getRnTokens(colorScheme)
  const separatorSet = useMemo<Set<string>>(() => new Set(separators ?? []), [separators])

  return (
    <View className={className} style={viewStyles.container(tk)}>
      {items.map((item) => {
        const isActive = activeKey !== undefined ? activeKey === item.key : item.active === true
        const showSeparator = separatorSet.has(item.key)
        const toolStyle: CSSProperties = {
          ...viewStyles.tool(),
          ...(isActive ? viewStyles.toolActive(tk) : viewStyles.toolInactive()),
        }
        return (
          <View key={item.key} style={viewStyles.rowItem()}>
            <View
              onTap={item.onPress}
              hoverClass="opacity-60"
              style={toolStyle}
            >
              {isImagePath(item.icon) ? (
                <Image src={item.icon} style={viewStyles.iconImg()} mode="aspectFit" />
              ) : (
                <Text style={textStyles.iconEmoji(tk)}>{item.icon}</Text>
              )}
            </View>
            {showSeparator ? <View style={viewStyles.separator(tk)} /> : null}
          </View>
        )
      })}
    </View>
  )
}
