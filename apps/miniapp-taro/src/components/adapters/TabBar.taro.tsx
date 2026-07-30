import { View, Text, Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import { getRnTokens, type RnThemeMode, type RnThemeTokens } from '@ihui/design-tokens'

/**
 * Taro 适配层:TabBar
 *
 * 平台特有:依赖 @tarojs/components 的 View/Text/Image + onTap,
 * 不适合共享层。
 *
 * 复用 packages/app/src/components/TabBar 的 props 契约 + 5 Tab 状态机,
 * 替换 web 元素(`div`/`img` → `View`/`Image`)+ 事件(`onClick` → `onTap`)。
 * 颜色通过 `getRnTokens(colorScheme)` 共享注入,保持与 web 端主题一致。
 */
export type TabBarKey = 'home' | 'course' | 'ai' | 'live' | 'mine'

export type TabBarItemConfig =
  | {
      key: TabBarKey
      label: string
      iconInactive: string
      iconActive: string
      singleTinted?: false
    }
  | {
      key: TabBarKey
      label: string
      iconInactive?: undefined
      iconActive?: undefined
      singleTinted: true
      singleIcon: string
    }

export interface TabBarProps {
  activeTab: TabBarKey
  onChange: (tab: TabBarKey) => void
  items?: TabBarItemConfig[]
  safeAreaBottom?: number
  className?: string
  colorScheme?: RnThemeMode
}

const TAB_BAR_HEIGHT = 56
const TAB_BAR_ICON_SIZE = 24
const TAB_BAR_FONT_SIZE = 10
const TAB_BAR_TOP_BORDER = 1
const DEFAULT_TABS: readonly TabBarItemConfig[] = [
  { key: 'home', label: '首页', iconInactive: '', iconActive: '' },
  { key: 'course', label: '课程', singleTinted: true, singleIcon: '' },
  { key: 'ai', label: 'AI', iconInactive: '', iconActive: '' },
  { key: 'live', label: '直播', iconInactive: '', iconActive: '' },
  { key: 'mine', label: '我的', iconInactive: '', iconActive: '' },
] as const

const toRpx = (px: number): string => `${px * 2}rpx`

const viewStyles = {
  container: (tk: RnThemeTokens, safeAreaBottom: number): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: toRpx(TAB_BAR_HEIGHT + safeAreaBottom),
    paddingBottom: toRpx(safeAreaBottom),
    backgroundColor: tk.surface.card,
    borderTopWidth: TAB_BAR_TOP_BORDER,
    borderTopColor: tk.border.light,
    borderTopStyle: 'solid',
  }),
  item: (): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: toRpx(TAB_BAR_HEIGHT),
    paddingTop: toRpx(4),
    paddingBottom: toRpx(4),
  }),
  iconPlaceholder: (color: string): CSSProperties => ({
    width: toRpx(TAB_BAR_ICON_SIZE),
    height: toRpx(TAB_BAR_ICON_SIZE),
    backgroundColor: color,
    borderRadius: 4,
  }),
}

const textStyles = {
  label: (color: string): CSSProperties => ({
    fontSize: toRpx(TAB_BAR_FONT_SIZE),
    lineHeight: `${toRpx(TAB_BAR_FONT_SIZE + 2)}`,
    marginTop: toRpx(2),
    color,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }),
}

export function TabBar({
  activeTab,
  onChange,
  items,
  safeAreaBottom = 0,
  className,
  colorScheme = 'light',
}: TabBarProps) {
  const tk = getRnTokens(colorScheme)
  const list: readonly TabBarItemConfig[] = items ?? DEFAULT_TABS

  return (
    <View
      className={className}
      style={viewStyles.container(tk, safeAreaBottom)}
    >
      {list.map((tab) => {
        const isActive = tab.key === activeTab
        const labelColor = isActive ? tk.brand.DEFAULT : tk.text.tertiary
        return (
          <View
            key={tab.key}
            onTap={() => onChange(tab.key)}
            hoverClass="opacity-60"
            style={viewStyles.item()}
          >
            <TabBarIcon tab={tab} isActive={isActive} activeColor={tk.brand.DEFAULT} inactiveColor={tk.text.tertiary} />
            <Text style={textStyles.label(labelColor)}>{tab.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

interface TabBarIconProps {
  tab: TabBarItemConfig
  isActive: boolean
  activeColor: string
  inactiveColor: string
}

function TabBarIcon({ tab, isActive, activeColor, inactiveColor }: TabBarIconProps) {
  const target = isActive ? activeColor : inactiveColor
  if (tab.singleTinted) {
    if (!tab.singleIcon) {
      return <View style={viewStyles.iconPlaceholder(target)} />
    }
    return (
      <Image
        src={tab.singleIcon}
        style={{
          width: toRpx(TAB_BAR_ICON_SIZE),
          height: toRpx(TAB_BAR_ICON_SIZE),
        }}
        mode="aspectFit"
      />
    )
  }
  const src = isActive ? tab.iconActive : tab.iconInactive
  if (!src) {
    return <View style={viewStyles.iconPlaceholder(target)} />
  }
  return (
    <Image
      src={src}
      style={{
        width: toRpx(TAB_BAR_ICON_SIZE),
        height: toRpx(TAB_BAR_ICON_SIZE),
      }}
      mode="aspectFit"
    />
  )
}
