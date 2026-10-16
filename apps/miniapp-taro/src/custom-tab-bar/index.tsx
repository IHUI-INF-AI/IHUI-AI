// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自定义 TabBar — 5 Tab:智汇社区 / AI agent / 广场 / 我的 / 分享星球
 *
 * 配置位置:app.config.ts 的 tabBar.custom = true(Taro 4.2 webpack5-runner 的 MiniPlugin
 * 会把本文件注册成 custom-tab-bar/index 入口,实测产物 dist/custom-tab-bar/ 三件套齐)。
 *
 * 2026-10-16 用户定稿:悬浮液态玻璃胶囊,内容与 mobile-rn 端同尺同档(见 constants/tab-bar-metrics.ts)。
 *
 * 作用域纪律(实测取证,别再改回去):微信自定义 tabBar 是**页面树之外**的独立组件,
 * app.wxss 的类与 `.dark{--color-*}` 覆盖块都进不去它 —— 开发者工具截图里 5 个标签竖排
 * = flex 工具类全失效,图标不可见 = var(--color-*) 未解析把 mask 底色读成透明。
 * ⇒ 布局只能内联写,色值只能走 JS 派生态(constants/style.ts 的 COLORS,源头仍是 tokens.css)。
 */
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { rnRadius } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import LineIcon, { type IconName } from '@/components/LineIcon'
import { COLORS } from '@/constants/style'
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_ICON_SIZE,
  TAB_BAR_FONT_SIZE,
  TAB_BAR_MARGIN_H,
  TAB_BAR_GAP_BOTTOM,
  TAB_BAR_INDICATOR_H,
} from '@/constants/tab-bar-metrics'
import { t as tGlobal } from '@/i18n'

interface TabItem {
  pagePath: string
  /** 五语言键(与原生 tabBar 文案共用同一族键,见 i18n/generated 的 tabBar.*) */
  labelKey: string
  icon: IconName
}

// 与 app.config.ts tabBar.list 的 5 个 tab 严格对齐(顺序/路由/文案一致)
const TABS: TabItem[] = [
  { pagePath: '/pages/index/index', labelKey: 'tabBar.community', icon: 'home' },
  { pagePath: '/pages/community/index', labelKey: 'tabBar.agent', icon: 'bot' },
  { pagePath: '/pages/plaza/index/index', labelKey: 'tabBar.square', icon: 'layout-grid' },
  { pagePath: '/pages/user/index', labelKey: 'tabBar.user', icon: 'user' },
  { pagePath: '/pages/share/index', labelKey: 'tabBar.share', icon: 'share-2' },
]

/** 玻璃模糊半径:与 mobile-rn TabBar.styles.ts 的 GLASS_BLUR_RADIUS 同值 */
const GLASS_BLUR_RADIUS = 24

export default function CustomTabBar() {
  const { resolved } = useAppTheme()
  const [current, setCurrent] = useState<string>(() => {
    try {
      const pages = Taro.getCurrentPages()
      const path = pages[pages.length - 1]?.route ?? ''
      return `/${path}`
    } catch {
      return ''
    }
  })

  function switchTab(item: TabItem) {
    if (item.pagePath === current) return
    setCurrent(item.pagePath)
    Taro.switchTab({ url: item.pagePath })
  }

  const ink = COLORS.textPrimary[resolved]
  const muted = COLORS.tertiary[resolved]

  return (
    <View
      style={{
        position: 'fixed',
        left: `${TAB_BAR_MARGIN_H}px`,
        right: `${TAB_BAR_MARGIN_H}px`,
        bottom: 0,
        marginBottom: `calc(${TAB_BAR_GAP_BOTTOM}px + env(safe-area-inset-bottom))`,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        height: `${TAB_BAR_HEIGHT}px`,
        backgroundColor: COLORS.glassBg[resolved],
        backdropFilter: `blur(${GLASS_BLUR_RADIUS}px)`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR_RADIUS}px)`,
        borderRadius: rnRadius.xl,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: COLORS.borderMedium[resolved],
      }}
    >
      {TABS.map((item) => {
        const active = current === item.pagePath
        return (
          <View
            key={item.pagePath}
            style={{
              flex: 1,
              position: 'relative',
              height: `${TAB_BAR_HEIGHT}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => switchTab(item)}
            hoverClass="opacity-60"
          >
            {active ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${TAB_BAR_MARGIN_H}px`,
                  right: `${TAB_BAR_MARGIN_H}px`,
                  height: `${TAB_BAR_INDICATOR_H}px`,
                  borderRadius: rnRadius.xs,
                  backgroundColor: ink,
                }}
              />
            ) : null}
            <LineIcon name={item.icon} size={TAB_BAR_ICON_SIZE} color={active ? ink : muted} />
            <Text
              style={{
                marginTop: 2,
                fontSize: `${TAB_BAR_FONT_SIZE}px`,
                lineHeight: `${TAB_BAR_FONT_SIZE + 2}px`,
                fontWeight: active ? '600' : '400',
                color: active ? ink : muted,
              }}
            >
              {tGlobal(item.labelKey)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
