// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自定义 TabBar — 5 Tab:智汇社区 / AI agent / 广场 / 我的 / 分享星球
 *
 * 配置位置:app.config.ts 的 tabBar.custom = true
 * 小程序要求:此文件路径固定为 custom-tab-bar/index,
 * 且需要在每个 tab 页面 json 中声明 { "usingComponents": {} }。
 *
 * 2026-10-16 用户定稿:悬浮液态玻璃胶囊(backdrop-filter: blur(24px) + --color-glass-bg),
 * 内容可滚到栏下若隐若现;图标用 LineIcon 内联 SVG(CSS mask 随主题换色),
 * 选中 --color-foreground / 未选中 --color-text-tertiary(深色中性,彻底替换紫色档);
 * root 挂 .dark 类保证 CSS 变量随浅/深主题切换。
 */
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useAppTheme } from '@/lib/theme'
import LineIcon, { type IconName } from '@/components/LineIcon'

interface TabItem {
  pagePath: string
  label: string
  icon: IconName
}

// 与 app.config.ts tabBar.list 的 5 个 tab 严格对齐(顺序/路由/文案一致)
const TABS: TabItem[] = [
  { pagePath: '/pages/index/index', label: '智汇社区', icon: 'home' },
  { pagePath: '/pages/community/index', label: 'AI agent', icon: 'bot' },
  { pagePath: '/pages/plaza/index/index', label: '广场', icon: 'layout-grid' },
  { pagePath: '/pages/user/index', label: '我的', icon: 'user' },
  { pagePath: '/pages/share/index', label: '分享星球', icon: 'share-2' },
]

// 配色:选中 --color-foreground / 未选中 --color-text-tertiary(2026-10-16 用户定稿液态玻璃+深色中性,
// 与原生 tabBar theme.json tabColor/tabSelected、mobile-rn/TabBar.styles.ts 同两档,彻底替换紫色档)
const COLOR_ACTIVE = 'var(--color-foreground)'
const COLOR_INACTIVE = 'var(--color-text-tertiary)'

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

  return (
    <View
      className={`fixed z-50 flex ${resolved === 'dark' ? 'dark' : ''}`}
      style={{
        left: '24rpx',
        right: '24rpx',
        bottom: '0',
        marginBottom: 'calc(12rpx + env(safe-area-inset-bottom))',
        backgroundColor: 'var(--color-glass-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '24rpx',
        borderWidth: '1rpx',
        borderStyle: 'solid',
        borderColor: 'var(--color-border-medium)',
        paddingTop: '12rpx',
        paddingBottom: '12rpx',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      }}
    >
      {TABS.map((item) => {
        const active = current === item.pagePath
        return (
          <View
            key={item.pagePath}
            className="flex-1 flex flex-col items-center justify-center"
            onClick={() => switchTab(item)}
            hoverClass="opacity-60"
          >
            <LineIcon
              name={item.icon}
              size={24}
              color={active ? COLOR_ACTIVE : COLOR_INACTIVE}
            />
            <Text
              className="mt-[4px] text-[10px]"
              style={{ color: active ? COLOR_ACTIVE : COLOR_INACTIVE }}
            >
              {item.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
