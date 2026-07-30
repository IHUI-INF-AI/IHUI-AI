import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import { getTokens, type AppThemeMode } from '../theme/tokens'

/**
 * TabBar 底部导航(跨端共享层)。
 *
 * 对齐 mobile-rn/TabBar.tsx 的 5 Tab 模式(首页/课程/AI/直播/我的),
 * 保留双图/单图分支(单图模式用 brand 着色切换 active 态)。
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native,使用 div/span/img + onClick
 * - 底部安全区高度通过 `safeAreaBottom` prop 注入(替代 RN `useSafeAreaInsets`),
 *   默认 0;web 端通常为 0,iOS 需调用方传入安全距离
 * - 图片资源通过 `iconInactive`/`iconActive`/`singleIcon` URL 字符串注入(替代 RN `require()`),
 *   调用方负责传入可用 URL;单图模式用 CSS filter 模拟 brand tint
 */
export type TabBarKey = 'home' | 'course' | 'ai' | 'live' | 'mine'

export type TabBarItemConfig =
  | {
      key: TabBarKey
      label: string
      /** 双图模式:独立 inactive/active 图片 URL */
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
  /** 当前激活 tab */
  activeTab: TabBarKey
  /** 切换回调 */
  onChange: (tab: TabBarKey) => void
  /** 5 Tab 配置(双图/单图分支) */
  items?: TabBarItemConfig[]
  /** 底部安全区高度(px,默认 0);web 端通常为 0 */
  safeAreaBottom?: number
  className?: string
  /** 已解析主题,默认 'light' */
  colorScheme?: AppThemeMode
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

const viewStyles = {
  container: (
    tk: ReturnType<typeof getTokens>,
    safeAreaBottom: number,
  ): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT + safeAreaBottom,
    paddingBottom: safeAreaBottom,
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
    height: TAB_BAR_HEIGHT,
    paddingTop: 4,
    paddingBottom: 4,
    cursor: 'pointer',
  }),
  itemPressed: (): CSSProperties => ({
    opacity: 0.6,
  }),
  icon: (): CSSProperties => ({
    width: TAB_BAR_ICON_SIZE,
    height: TAB_BAR_ICON_SIZE,
    objectFit: 'contain',
  }),
  iconSingle: (filter: string): CSSProperties => ({
    width: TAB_BAR_ICON_SIZE,
    height: TAB_BAR_ICON_SIZE,
    objectFit: 'contain',
    filter,
  }),
}

const textStyles = {
  label: (color: string): CSSProperties => ({
    fontSize: TAB_BAR_FONT_SIZE,
    lineHeight: `${TAB_BAR_FONT_SIZE + 2}px`,
    marginTop: 2,
    color,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  }),
}

/** 默认 items 缺省字段,空字符串兜底防止 img 加载 404 */
function withFallbackIcon(item: TabBarItemConfig): TabBarItemConfig {
  if (item.singleTinted) {
    return { ...item, singleIcon: item.singleIcon || '' }
  }
  return {
    ...item,
    iconInactive: item.iconInactive || '',
    iconActive: item.iconActive || '',
  }
}

export function TabBar({
  activeTab,
  onChange,
  items,
  safeAreaBottom = 0,
  className,
  colorScheme = 'light',
}: TabBarProps) {
  const tk = getTokens(colorScheme)
  const handlePress = useCallback(
    (key: TabBarKey) => () => onChange(key),
    [onChange],
  )

  const list: readonly TabBarItemConfig[] = items ?? DEFAULT_TABS
  const finalList = list.map(withFallbackIcon)

  return (
    <div
      className={className}
      role="tablist"
      style={viewStyles.container(tk, safeAreaBottom)}
    >
      {finalList.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            tabIndex={0}
            onClick={handlePress(tab.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onChange(tab.key)
              }
            }}
            style={viewStyles.item()}
          >
            <TabBarIcon tab={tab} isActive={isActive} activeColor={tk.brand.DEFAULT} inactiveColor={tk.text.tertiary} />
            <span
              style={textStyles.label(isActive ? tk.brand.DEFAULT : tk.text.tertiary)}
            >
              {tab.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

interface TabBarIconProps {
  tab: TabBarItemConfig
  isActive: boolean
  activeColor: string
  inactiveColor: string
}

function TabBarIcon({ tab, isActive, activeColor, inactiveColor }: TabBarIconProps) {
  if (tab.singleTinted) {
    // 单图模式:用 CSS filter 模拟 brand tint(active 态用 activeColor,否则用 inactiveColor)
    const target = isActive ? activeColor : inactiveColor
    // 简化:仅对灰阶使用 brightness;若需精确 brand 色,调用方应传 brand 预染色图
    if (!tab.singleIcon) {
      // 无图片时回退到纯色 placeholder
      return (
        <div
          aria-hidden
          style={{
            width: TAB_BAR_ICON_SIZE,
            height: TAB_BAR_ICON_SIZE,
            backgroundColor: target,
            borderRadius: 4,
          }}
        />
      )
    }
    return (
      <img
        src={tab.singleIcon}
        alt=""
        style={viewStyles.iconSingle(isActive ? 'none' : 'grayscale(100%)')}
        data-tint-target={target}
      />
    )
  }
  // 双图模式:无图时回退 placeholder
  const activeSrc = tab.iconActive
  const inactiveSrc = tab.iconInactive
  const src = isActive ? activeSrc : inactiveSrc
  if (!src) {
    return (
      <div
        aria-hidden
        style={{
          width: TAB_BAR_ICON_SIZE,
          height: TAB_BAR_ICON_SIZE,
          backgroundColor: isActive ? activeColor : inactiveColor,
          borderRadius: 4,
        }}
      />
    )
  }
  return <img src={src} alt="" style={viewStyles.icon()} />
}
