/**
 * TabBar 底部导航组件 (mobile-rn 端)
 * 对齐历史项目 customTabBar/index.vue 5 主 Tab 结构与 static/tabbar/ 图标:
 *   - AI应用商店 (tabbar_1) / 广场 (tabbar_2) / 智汇AI (tabbar_3) /
 *     动态 (tabbar_4) / 我的 (tabbar_5)
 * 浅色优雅风 — 顶部 1px 边框 + 表面卡色背景,系统字体,无霓虹无渐变。
 * 平台特有:依赖 react-native Image require + SafeAreaView,不适合共享层。
 */
import { useCallback } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { tabBarStyleSheet } from './TabBar.styles'

/** TabBar 高度覆盖(对齐 Uniapp 100rpx = 50dp,取 52dp;原 styles.ts 中 56dp) */
const TAB_BAR_HEIGHT_OVERRIDE = 52

// ── tabbar 图片资源(对齐 history static/tabbar/ 11 图标,语义与 customTabBar/index.vue 一致) ──
// 原 5 Tab:AI应用商店(tabbar_1)/广场(tabbar_2)/智汇AI(tabbar_3)/动态(tabbar_4)/我的(tabbar_5)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AI_SHOP_INACTIVE = require('../../assets/images/tabbar/tabbar_1.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AI_SHOP_ACTIVE = require('../../assets/images/tabbar/tabbar_1_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PLAZA_INACTIVE = require('../../assets/images/tabbar/tabbar_2.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PLAZA_ACTIVE = require('../../assets/images/tabbar/tabbar_2_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HOME_INACTIVE = require('../../assets/images/tabbar/tabbar_3.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HOME_ACTIVE = require('../../assets/images/tabbar/tabbar_3_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NEWS_INACTIVE = require('../../assets/images/tabbar/tabbar_4.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NEWS_ACTIVE = require('../../assets/images/tabbar/tabbar_4_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MINE_INACTIVE = require('../../assets/images/tabbar/tabbar_5.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MINE_ACTIVE = require('../../assets/images/tabbar/tabbar_5_act.png')

/** Tab 标识符(对齐原 customTabBar 5 主 Tab:AI应用商店/广场/智汇AI/动态/我的) */
export type TabBarKey = 'aiShop' | 'plaza' | 'home' | 'news' | 'mine'

/** Tab 渲染数据(全部双图模式,对齐原 tabbar_1~5 图标) */
export interface TabBarItemConfig {
  key: TabBarKey
  label: string
  iconInactive: number
  iconActive: number
}

export interface TabBarProps {
  activeTab: TabBarKey
  onChange: (tab: TabBarKey) => void
  /** 覆盖默认标签(i18n 注入);未提供则用 TABS 内置默认值 */
  labels?: Partial<Record<TabBarKey, string>>
}

const TABS: readonly TabBarItemConfig[] = [
  // 对齐原 customTabBar 5 主 Tab 顺序:AI应用商店/广场/智汇AI/动态/我的
  {
    key: 'aiShop',
    label: 'AI应用商店',
    iconInactive: AI_SHOP_INACTIVE,
    iconActive: AI_SHOP_ACTIVE,
  },
  { key: 'plaza', label: '广场', iconInactive: PLAZA_INACTIVE, iconActive: PLAZA_ACTIVE },
  { key: 'home', label: '智汇AI', iconInactive: HOME_INACTIVE, iconActive: HOME_ACTIVE },
  { key: 'news', label: '动态', iconInactive: NEWS_INACTIVE, iconActive: NEWS_ACTIVE },
  { key: 'mine', label: '我的', iconInactive: MINE_INACTIVE, iconActive: MINE_ACTIVE },
] as const

export default function TabBar({ activeTab, onChange, labels }: TabBarProps) {
  const insets = useSafeAreaInsets()

  const handlePress = useCallback((key: TabBarKey) => () => onChange(key), [onChange])

  return (
    <View
      style={[
        tabBarStyleSheet.container,
        { height: TAB_BAR_HEIGHT_OVERRIDE, paddingBottom: insets.bottom },
      ]}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={handlePress(tab.key)}
            style={[tabBarStyleSheet.item, { height: TAB_BAR_HEIGHT_OVERRIDE }]}
          >
            <TabBarIcon tab={tab} isActive={isActive} />
            <Text
              style={[
                tabBarStyleSheet.label,
                isActive ? tabBarStyleSheet.labelActive : tabBarStyleSheet.labelInactive,
              ]}
              numberOfLines={1}
            >
              {labels?.[tab.key] ?? tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

interface TabBarIconProps {
  tab: TabBarItemConfig
  isActive: boolean
}

function TabBarIcon({ tab, isActive }: TabBarIconProps) {
  // 双图模式:各自独立 inactive/active 资源(对齐原 tabbar_1~5 图标)
  return (
    <Image source={isActive ? tab.iconActive : tab.iconInactive} style={tabBarStyleSheet.icon} />
  )
}
