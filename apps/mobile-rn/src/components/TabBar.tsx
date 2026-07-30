/**
 * TabBar 底部导航组件 (mobile-rn 端)
 * 对齐历史项目 static/tabbar/ 11 图标,接入 5 Tab:
 *   - 首页 (tabbar_2) / 课程 (kecheng, 单图 + brand tint) /
 *     AI (tabbar_1) / 直播 (tabbar_3) / 我的 (tabbar_5)
 * 浅色优雅风 — 顶部 1px 边框 + 表面卡色背景,系统字体,无霓虹无渐变。
 * 平台特有:依赖 react-native Image require + SafeAreaView,不适合共享层。
 */
import { useCallback } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { rnLightTokens as tk } from '@ihui/design-tokens'

import { tabBarStyleSheet } from './TabBar.styles'

// ── tabbar 图片资源(对齐 history static/tabbar/ 11 图标) ──
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HOME_INACTIVE = require('../../assets/images/tabbar/tabbar_2.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const HOME_ACTIVE = require('../../assets/images/tabbar/tabbar_2_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const COURSE_SOURCE = require('../../assets/images/tabbar/kecheng.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AI_INACTIVE = require('../../assets/images/tabbar/tabbar_1.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AI_ACTIVE = require('../../assets/images/tabbar/tabbar_1_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LIVE_INACTIVE = require('../../assets/images/tabbar/tabbar_3.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LIVE_ACTIVE = require('../../assets/images/tabbar/tabbar_3_act.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MINE_INACTIVE = require('../../assets/images/tabbar/tabbar_5.png')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MINE_ACTIVE = require('../../assets/images/tabbar/tabbar_5_act.png')

/** Tab 标识符(对外稳定契约) */
export type TabBarKey = 'home' | 'course' | 'ai' | 'live' | 'mine'

/** Tab 渲染数据(单图 / 双图分支) */
export type TabBarItemConfig =
  | {
      key: TabBarKey
      label: string
      /** 双图模式:各自独立 inactive/active 资源 */
      iconInactive: number
      iconActive: number
      /** 单图模式:true 时组件用 tintColor 渲染 brand 变体(kecheng) */
      singleTinted?: false
    }
  | {
      key: TabBarKey
      label: string
      iconInactive?: undefined
      iconActive?: undefined
      singleTinted: true
      singleIcon: number
    }

export interface TabBarProps {
  activeTab: TabBarKey
  onChange: (tab: TabBarKey) => void
}

const TABS: readonly TabBarItemConfig[] = [
  { key: 'home', label: '首页', iconInactive: HOME_INACTIVE, iconActive: HOME_ACTIVE },
  { key: 'course', label: '课程', singleTinted: true, singleIcon: COURSE_SOURCE },
  { key: 'ai', label: 'AI', iconInactive: AI_INACTIVE, iconActive: AI_ACTIVE },
  { key: 'live', label: '直播', iconInactive: LIVE_INACTIVE, iconActive: LIVE_ACTIVE },
  { key: 'mine', label: '我的', iconInactive: MINE_INACTIVE, iconActive: MINE_ACTIVE },
] as const

export default function TabBar({ activeTab, onChange }: TabBarProps) {
  const insets = useSafeAreaInsets()

  const handlePress = useCallback(
    (key: TabBarKey) => () => onChange(key),
    [onChange],
  )

  return (
    <View
      style={[
        tabBarStyleSheet.container,
        { paddingBottom: insets.bottom },
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
            style={({ pressed }) => [
              tabBarStyleSheet.item,
              pressed ? { opacity: 0.6 } : null,
            ]}
          >
            <TabBarIcon tab={tab} isActive={isActive} />
            <Text
              style={[
                tabBarStyleSheet.label,
                isActive ? tabBarStyleSheet.labelActive : tabBarStyleSheet.labelInactive,
              ]}
              numberOfLines={1}
            >
              {tab.label}
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
  if (tab.singleTinted) {
    // 单图模式(kecheng):未选中灰阶,选中用 brand 色
    return (
      <Image
        source={tab.singleIcon}
        style={[
          tabBarStyleSheet.icon,
          { tintColor: isActive ? tk.brand.DEFAULT : tk.text.tertiary },
        ]}
      />
    )
  }
  return (
    <Image
      source={isActive ? tab.iconActive : tab.iconInactive}
      style={tabBarStyleSheet.icon}
    />
  )
}
