// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TabBar 底部导航组件 (mobile-rn 端)
 * 对齐历史项目 customTabBar/index.vue 5 主 Tab 结构与 static/tabbar/ 图标:
 *   - AI应用商店 (tabbar_1) / 广场 (tabbar_2) / 智汇AI (tabbar_3) /
 *     动态 (tabbar_4) / 我的 (tabbar_5)
 * 悬浮胶囊风(对齐 Telegram/钉钉 App 底部导航) — 圆角胶囊脱离屏幕边缘,
 * 左右留边 + 投影,底部按 safe-area 悬浮避开手势区。
 * 平台特有:依赖 react-native Image require + SafeAreaView,不适合共享层。
 */
import { useCallback } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { tokens } from '../theme/active-tokens'
import { TAB_BAR_FLOAT_GAP_BOTTOM_MIN, tabBarStyleSheet } from './TabBar.styles'

import { rnRadius } from '@ihui/design-tokens'

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
  /** 当前激活 Tab;不传或 undefined 表示无高亮(用于课程/直播等非主 Tab 内容页,TabBar 常驻可切换) */
  activeTab?: TabBarKey
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
        tabBarStyleSheet.wrapper,
        // 悬浮高度:有效 safe-area 一半 + 小间距,不足则用最小间距兜底(对齐 Telegram 手势区避让)
        { marginBottom: Math.max(TAB_BAR_FLOAT_GAP_BOTTOM_MIN, insets.bottom * 0.5 + 4) },
      ]}
    >
      <View style={tabBarStyleSheet.container}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              onPress={handlePress(tab.key)}
              style={tabBarStyleSheet.item}
            >
              {/* 2026-09-23 修复 P1:选中态顶部指示条(3px 高品牌强调色,左右留边圆角)。
                  原选中态仅白色 vs 灰色文字,区分度极低;新增指示条 + 品牌色文字 + 粗体三重区分。 */}
              {isActive ? <View style={localStyles.activeIndicator} /> : null}
              <TabBarIcon tab={tab} isActive={isActive} />
              <Text
                style={[
                  tabBarStyleSheet.label,
                  isActive
                    ? [tabBarStyleSheet.labelActive, localStyles.labelActiveOverride]
                    : tabBarStyleSheet.labelInactive,
                ]}
                numberOfLines={1}
              >
                {labels?.[tab.key] ?? tab.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

interface TabBarIconProps {
  tab: TabBarItemConfig
  isActive: boolean
}

function TabBarIcon({ tab, isActive }: TabBarIconProps) {
  // 双图模式:各自独立 inactive/active 资源(对齐原 tabbar_1~5 图标)。
  // 2026-10-16 用户定稿:图标着色走深色中性档 —— 未选中 text.tertiary(中性灰)、
  // 选中 text.primary(深色中性),与标签文字同色;明暗两档随主题自适应(原紫/灰蓝/灰黑均不对)。
  return (
    <Image
      source={isActive ? tab.iconActive : tab.iconInactive}
      style={tabBarStyleSheet.icon}
      tintColor={isActive ? tokens.text.primary : tokens.text.tertiary}
    />
  )
}

/**
 * 本地内联样式:在 TabBar.styles.ts 的 labelActive(深色中性)之上补粗体,
 * 选中态「色 + 重」双重区分(2026-09-23 P1 修复引入,2026-10-16 随深色中性定稿保留)。
 */
const localStyles = StyleSheet.create({
  /** 选中态顶部指示条:3px 高,深色中性(text.primary),左右各留 12dp 边距,小圆角 */
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 3,
    borderRadius: rnRadius.xs,
    backgroundColor: tokens.text.primary,
  },
  /** 选中态文字覆盖:深色中性 + 粗体,与选中图标同色(2026-10-16 用户定稿:整栏深色中性两档) */
  labelActiveOverride: {
    color: tokens.text.primary,
    fontWeight: '600',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
