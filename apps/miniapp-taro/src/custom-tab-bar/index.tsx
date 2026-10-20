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
 * 〔补测 2026-10-20〕内联 style 里的 var(--color-*) 实测**同样不解析**(选中图标回落成默认黑、
 * 指示条透明、光晕因 filter 值含 var() 而整条失效)⇒ 本文件内一律不出现 var(--color-*)。
 */
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { rnRadius, withAlpha } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'
import LineIcon, { type IconName } from '@/components/LineIcon'
import { COLORS } from '@/constants/style'
import {
  TAB_BAR_HEIGHT,
  TAB_BAR_ICON_SIZE,
  TAB_BAR_FONT_SIZE,
  TAB_BAR_FONT_SIZE_ACTIVE,
  TAB_BAR_MARGIN_H,
  TAB_BAR_GAP_BOTTOM,
  TAB_BAR_INDICATOR_H,
  TAB_BAR_INDICATOR_INSET,
  TAB_BAR_GLOW_RADIUS_PX,
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

/** 毛玻璃模糊半径(px):非圆角档位,与 mobile-rn TabBar.styles.ts 的同值模糊对齐。
 *  本端取名 *_PX 而非 *_RADIUS,避免圆角单源门 B2 把"喂给 blur() 的模糊半径"误当本地圆角常量。 */
const GLASS_BLUR_PX = 24

/** 选中态光晕:半径取单一源 TAB_BAR_GLOW_RADIUS_PX,颜色取 ink 同源的 rgba(0.85) ——
 *  与 RN TabBar.styles.ts 的 iconGlow 同档(同半径、同透明度、同色源),端内不出现裸 hex。
 *  刻意不用 --color-brand-accent(#8fb8cc):同日玻璃底回调至 0.6 后浅蓝晕压在胶囊上看不见。
 *
 *  取证状态(2026-10-20 渲染级实测,微信开发者工具自动化 + 像素判读):
 *  本端自定义 tabBar 内联 style 里的 var(--color-*) **全部不解析** —— 实测截图里选中图标
 *  回落成默认黑、指示条透明不可见、光晕因 filter 值里含 var() 而整条失效。
 *  ⇒ 取色必须走 JS 派生态 COLORS(源头仍是 tokens.css),与本文件既有的 glassBg/borderMedium 同理。
 *  〔亮/暗两档渲染级判读〕CSS `filter: drop-shadow()` 在 weapp **真渲染**:亮档选中图标外圈蓝度
 *  3.31、暗档 1.89,同图四个未选中图标外圈恒 0.00(阳性对照)⇒ 晕环是选中态独有,不是抗锯齿;
 *  指示条与选中文案取到纯强调色(亮 rgb(73,122,150) / 暗 rgb(161,193,211))。 */
function buildGlowStyle(ink: string) {
  return {
    filter: `drop-shadow(0 0 ${TAB_BAR_GLOW_RADIUS_PX}px ${withAlpha(ink, 0.85)})`,
  }
}

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

  // 2026-10-20 用户定稿:选中走浅蓝强调档(与 RN TabBar 的 brandAccent.deep 同值 —— 亮 #4a7a96 /
  // 暗 #a3c4d6),未选中从中性灰 tertiary 加深一档到 textSecondary —— 实拍「太浅」的正是 tertiary 那一档。
  // 取色走 JS 派生态:自定义 tabBar 在页面树之外,var(--color-*) 实测不解析(会回落成默认黑)。
  const ink = COLORS.brandAccentDeep[resolved]
  const muted = COLORS.textSecondary[resolved]
  const glowStyle = buildGlowStyle(ink)

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
        backdropFilter: `blur(${GLASS_BLUR_PX}px)`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR_PX}px)`,
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
                  left: `${TAB_BAR_INDICATOR_INSET}px`,
                  right: `${TAB_BAR_INDICATOR_INSET}px`,
                  height: `${TAB_BAR_INDICATOR_H}px`,
                  borderRadius: rnRadius.xs,
                  backgroundColor: ink,
                }}
              />
            ) : null}
            {/* 选中态浅蓝发光(半径与 RN 的 iconGlow 同名同档);光晕挂包裹层 —— LineIcon 本体是
                CSS mask 块,filter 作用于它的渲染结果 */}
            <View style={active ? glowStyle : undefined}>
              <LineIcon name={item.icon} size={TAB_BAR_ICON_SIZE} color={active ? ink : muted} />
            </View>
            <Text
              style={{
                marginTop: 2,
                fontSize: `${active ? TAB_BAR_FONT_SIZE_ACTIVE : TAB_BAR_FONT_SIZE}px`,
                lineHeight: `${(active ? TAB_BAR_FONT_SIZE_ACTIVE : TAB_BAR_FONT_SIZE) + 2}px`,
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
