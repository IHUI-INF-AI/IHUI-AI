// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback } from 'react'
import type { CSSProperties } from 'react'
import { getTokens, type AppThemeMode } from '../theme/tokens'

import {
  TAB_BAR_FONT_SIZE_PX,
  TAB_BAR_HEIGHT_PX,
  TAB_BAR_ICON_SIZE_PX,
} from '@ihui/shared/ui/tab-bar-spec'
import { rnRadius, rnSpacing } from '@ihui/design-tokens'

/**
 * TabBar 底部导航(跨端共享层,端内同构兜底实现)。
 *
 * 2026-11-25 三端同脸(真落地):
 *  - 键名对齐实况 —— 此前这里写的是 `home/course/ai/live/mine`,是 2026-08 的五 Tab 旧世界;
 *    两端实况早已换成 AI应用商店/广场/智汇AI/动态/我的,与小程序 `constants/tab-bar-pages.ts`
 *    的 `market/plaza/chat/feed/me` 逐键同序。留旧键等于在共享层放一份会写错的契约。
 *  - 几何不要本地字面量 —— height/icon/font 三档改读 `@ihui/shared/ui/tab-bar-spec`(胶囊高
 *    62 = AI 输入框外壳档,字号 11)。此前本文件自写 56 / 24 / 10,与单一源直接分叉两档,
 *    而这个分叉没有任何门能看见(门 128 只认同名成对文件,本文件与 RN 的 TabBar 不同名)。
 *
 * 平台无关:
 * - 不依赖 @tarojs/* 或 react-native,使用 div/span/img + onClick
 * - 底部安全区高度通过 `safeAreaBottom` prop 注入(替代 RN `useSafeAreaInsets`),
 *   默认 0;web 端通常为 0,iOS 需调用方传入安全距离
 * - 图片资源通过 `iconInactive`/`iconActive`/`singleIcon` URL 字符串注入(替代 RN `require()`),
 *   调用方负责传入可用 URL;单图模式用 CSS filter 模拟 brand tint
 */
export type TabBarKey = 'market' | 'plaza' | 'chat' | 'feed' | 'me'

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

const DEFAULT_TABS: readonly TabBarItemConfig[] = [
  { key: 'market', label: 'AI应用商店', iconInactive: '', iconActive: '' },
  { key: 'plaza', label: '广场', iconInactive: '', iconActive: '' },
  { key: 'chat', label: '智汇AI', iconInactive: '', iconActive: '' },
  { key: 'feed', label: '动态', iconInactive: '', iconActive: '' },
  { key: 'me', label: '我的', iconInactive: '', iconActive: '' },
] as const

const viewStyles = {
  container: (tk: ReturnType<typeof getTokens>, safeAreaBottom: number): CSSProperties => ({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: TAB_BAR_HEIGHT_PX + safeAreaBottom,
    paddingBottom: safeAreaBottom,
    // 液态玻璃底(2026-10-16 用户定稿):半透明 + backdrop blur,与 mobile-rn TabBar 同档
    backgroundColor: tk.glass.bg,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  }),
  item: (): CSSProperties => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT_PX,
    paddingTop: rnSpacing.xs,
    paddingBottom: rnSpacing.xs,
    cursor: 'pointer',
  }),
  itemPressed: (): CSSProperties => ({
    opacity: 0.6,
  }),
  icon: (): CSSProperties => ({
    width: TAB_BAR_ICON_SIZE_PX,
    height: TAB_BAR_ICON_SIZE_PX,
    objectFit: 'contain',
  }),
  iconSingle: (filter: string): CSSProperties => ({
    width: TAB_BAR_ICON_SIZE_PX,
    height: TAB_BAR_ICON_SIZE_PX,
    objectFit: 'contain',
    filter,
  }),
}

const textStyles = {
  label: (color: string): CSSProperties => ({
    fontSize: TAB_BAR_FONT_SIZE_PX,
    lineHeight: `${TAB_BAR_FONT_SIZE_PX + 2}px`,
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
  const handlePress = useCallback((key: TabBarKey) => () => onChange(key), [onChange])

  const list: readonly TabBarItemConfig[] = items ?? DEFAULT_TABS
  const finalList = list.map(withFallbackIcon)

  return (
    <div className={className} role="tablist" style={viewStyles.container(tk, safeAreaBottom)}>
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
            <TabBarIcon
              tab={tab}
              isActive={isActive}
              activeColor={tk.text.primary}
              inactiveColor={tk.text.secondary}
            />
            <span style={textStyles.label(isActive ? tk.text.primary : tk.text.secondary)}>
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
            width: TAB_BAR_ICON_SIZE_PX,
            height: TAB_BAR_ICON_SIZE_PX,
            backgroundColor: target,
            borderRadius: rnRadius.md,
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
          width: TAB_BAR_ICON_SIZE_PX,
          height: TAB_BAR_ICON_SIZE_PX,
          backgroundColor: isActive ? activeColor : inactiveColor,
          borderRadius: rnRadius.md,
        }}
      />
    )
  }
  return <img src={src} alt="" style={viewStyles.icon()} />
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
