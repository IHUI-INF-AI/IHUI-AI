// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TabBar 底部导航组件 (mobile-rn 端)
 * 对齐历史项目 customTabBar/index.vue 5 主 Tab 结构与 static/tabbar/ 图标:
 *   - AI应用商店 (tabbar_1) / 广场 (tabbar_2) / 智汇AI (tabbar_3) /
 *     动态 (tabbar_4) / 我的 (tabbar_5)
 * 液态玻璃停靠栏(2026-10-27 用户定稿):玻璃面板从图标行延伸到屏幕底边,
 * 手势区收进面板内 —— 删掉原先图标行下面独立的白色透明带。
 * 平台特有:依赖 react-native Image require + SafeAreaView,不适合共享层。
 */
import { useCallback } from 'react'
import { Image, Platform, Pressable, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { tokens } from '../theme/active-tokens'
import { withAlpha } from '@ihui/design-tokens'
import { useTheme } from '../context/ThemeContext'
import { TAB_BAR_FLOAT_GAP_BOTTOM_MIN, tabBarStyleSheet } from './TabBar.styles'
// 底栏图标的取源方式(2026-10-21 定档,刻意保留,不是遗留绕行):
// 这族曾在 release 包里长期空白,当时的根因是 @react-native/assets-registry 被装成两份
// (注册进 A、读取走 B ⇒ resolveAssetSource 吐 null),已由 metro.config.cjs 的单实例去重
// 分支修好(4a876685d),实测 require() 通道可用(轮播本地图与底栏图标同包实拍恢复)。
// 仍走内联 data URI 的理由:回退成 require() 属于"把别人删过的行写回来",会被门 84 R1r
// 的行级复活判据定责为本票红(它结构上分不出"有意重加"与"陈旧回写");为省 74KB 去绕一道
// blocking 门不值当。要清这层,请在**下一次真正改动本文件的票**里顺带替换,别单独回退。
import { TABBAR_ICON_DATA } from './tabbarIconData'
import { useI18n } from '../i18n'

// ── tabbar 图标(对齐 history static/tabbar/ 11 图标,语义与 customTabBar/index.vue 一致) ──
// 原 5 Tab:AI应用商店(tabbar_1)/广场(tabbar_2)/智汇AI(tabbar_3)/动态(tabbar_4)/我的(tabbar_5)

/** Tab 标识符(对齐原 customTabBar 5 主 Tab:AI应用商店/广场/智汇AI/动态/我的) */
export type TabBarKey = 'aiShop' | 'plaza' | 'home' | 'news' | 'mine'

/** Tab 渲染数据(全部双图模式,对齐原 tabbar_1~5 图标) */
export interface TabBarItemConfig {
  key: TabBarKey
  label: string
  /** 内联 data URI(见 tabbarIconData.ts 头注:本地 PNG 的 Image 取源链在 release 上恒空白) */
  iconInactive: string
  iconActive: string
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
    label: 'tabBar.market',
    iconInactive: TABBAR_ICON_DATA.AI_SHOP_INACTIVE,
    iconActive: TABBAR_ICON_DATA.AI_SHOP_ACTIVE,
  },
  {
    key: 'plaza',
    label: 'tabBar.plaza',
    iconInactive: TABBAR_ICON_DATA.PLAZA_INACTIVE,
    iconActive: TABBAR_ICON_DATA.PLAZA_ACTIVE,
  },
  {
    key: 'home',
    label: 'tabBar.chat',
    iconInactive: TABBAR_ICON_DATA.HOME_INACTIVE,
    iconActive: TABBAR_ICON_DATA.HOME_ACTIVE,
  },
  {
    key: 'news',
    label: 'tabBar.feed',
    iconInactive: TABBAR_ICON_DATA.NEWS_INACTIVE,
    iconActive: TABBAR_ICON_DATA.NEWS_ACTIVE,
  },
  {
    key: 'mine',
    label: 'tabBar.me',
    iconInactive: TABBAR_ICON_DATA.MINE_INACTIVE,
    iconActive: TABBAR_ICON_DATA.MINE_ACTIVE,
  },
] as const

export default function TabBar({ activeTab, onChange, labels }: TabBarProps) {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const insets = useSafeAreaInsets()

  const handlePress = useCallback((key: TabBarKey) => () => onChange(key), [onChange])

  return (
    <View style={tabBarStyleSheet.wrapper}>
      {/* 液态玻璃面板直落屏幕底边:图标行 + 底部手势区让位(paddingBottom)同一块玻璃,
          图标行下面不再有独立白带(2026-10-27 用户定稿)。
          2026-10-27 三稿(0.0.7 实机反馈「还是这么透明,没任何变化」):
          Android 的 dimezis 真模糊在实机上不生效(只剩淡 tint,视觉与 glass.bg 无差),
          ⇒ Android 端不再渲染 BlurView,直接上 iOS 白底页面同款磨砂实底
          (surface 0.88 + 顶部高光线 + 重投影,确定性出效果);
          iOS 端保留 BlurView 真模糊(UIVisualEffectView,可靠);web 端仍 backdropFilter。 */}
      <View
        style={[
          tabBarStyleSheet.container,
          { paddingBottom: Math.max(TAB_BAR_FLOAT_GAP_BOTTOM_MIN, insets.bottom * 0.5 + 4) },
          Platform.OS !== 'ios' && {
            backgroundColor: withAlpha(
              resolvedTheme === 'dark' ? tokens.surface.dark : tokens.surface.light,
              0.88,
            ),
          },
        ]}
      >
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={50}
            tint={resolvedTheme === 'dark' ? 'dark' : 'light'}
            style={tabBarStyleSheet.blurFill}
          />
        ) : null}
        {resolvedTheme !== 'dark' ? (
          <View style={tabBarStyleSheet.rimLight} pointerEvents="none" />
        ) : null}
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={t(tab.label)}
              onPress={handlePress(tab.key)}
              style={tabBarStyleSheet.item}
            >
              {/* 2026-09-23 修复 P1:选中态顶部指示条(3px 高强调档,左右留边圆角)。
                  原选中态仅白色 vs 灰色文字,区分度极低;新增指示条 + 强调色文字 + 粗体三重区分。 */}
              {isActive ? <View style={tabBarStyleSheet.activeIndicator} /> : null}
              <TabBarIcon tab={tab} isActive={isActive} />
              <Text
                style={[
                  tabBarStyleSheet.label,
                  isActive ? tabBarStyleSheet.labelActive : tabBarStyleSheet.labelInactive,
                ]}
                numberOfLines={1}
              >
                {labels?.[tab.key] ?? t(tab.label)}
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
  // 2026-10-20 用户定稿:选中态**不染色** —— `_act` 素材自带浅紫(实测均值 #BB96FD、最饱和像素
  // #A171FE),此前把它也 tint 成 text.primary 等于将彩色素材压成近黑,那层紫从未上过屏;
  // 现露素材原色 + 浅蓝光晕(iconGlow 档)。未选中走 text.secondary 中性灰,比原 tertiary
  // (亮 #A3A3A3)深一档 —— 实拍「太浅」的就是这一档。明暗两档均由 token 自动跟随。
  // 光晕挂在包裹层而非 Image 上:RN 把 filter 收在 ViewStyle,ImageStyle 没有这一维。
  return (
    <View style={isActive ? tabBarStyleSheet.iconGlow : undefined}>
      <Image
        source={{ uri: isActive ? tab.iconActive : tab.iconInactive }}
        style={tabBarStyleSheet.icon}
        tintColor={isActive ? undefined : tokens.text.secondary}
      />
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
