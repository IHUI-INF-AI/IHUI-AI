/**
 * 自定义 TabBar — 5 Tab:首页 / 智汇社区 / 课程 / 直播 / 我的
 *
 * 配置位置:app.config.ts 的 tabBar.custom = true
 * 小程序要求:此文件路径固定为 custom-tab-bar/index,
 * 且需要在每个 tab 页面 json 中声明 { "usingComponents": {} }。
 */
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useI18n } from '@/i18n'

interface TabItem {
  pagePath: string
  i18nKey: string
  icon: string
  activeIcon: string
}

const TABS: TabItem[] = [
  {
    pagePath: '/pages/index/index',
    i18nKey: 'nav.home',
    icon: 'assets/tabbar/home.png',
    activeIcon: 'assets/tabbar/home-active.png',
  },
  {
    pagePath: '/pages/community/index',
    i18nKey: 'nav.community',
    icon: 'assets/tabbar/community.png',
    activeIcon: 'assets/tabbar/community-active.png',
  },
  {
    pagePath: '/pages/course/list',
    i18nKey: 'nav.courses',
    icon: 'assets/tabbar/course.png',
    activeIcon: 'assets/tabbar/course-active.png',
  },
  {
    pagePath: '/pages/live/list',
    i18nKey: 'nav.live',
    icon: 'assets/tabbar/live.png',
    activeIcon: 'assets/tabbar/live-active.png',
  },
  {
    pagePath: '/pages/user/index',
    i18nKey: 'nav.profile',
    icon: 'assets/tabbar/user.png',
    activeIcon: 'assets/tabbar/user-active.png',
  },
]

// 赛博朋克配色:激活青 #00F2FF,未激活半透明白
const ACTIVE_COLOR = '#00f2ff'
const INACTIVE_COLOR = 'rgba(255,255,255,0.5)'

export default function CustomTabBar() {
  const { t } = useI18n()
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
    <View className="fixed left-0 right-0 bottom-0 z-50 bg-card border-t border-solid border-[var(--color-border)] flex">
      {TABS.map((item) => {
        const active = current === item.pagePath
        return (
          <View
            key={item.pagePath}
            className="flex-1 flex flex-col items-center justify-center pt-[6px] pb-[2px]"
            onClick={() => switchTab(item)}
          >
            <Image
              className="w-[24px] h-[24px]"
              src={active ? item.activeIcon : item.icon}
              mode="aspectFit"
            />
            <Text
              className="mt-[2px] text-[10px]"
              style={{ color: active ? ACTIVE_COLOR : INACTIVE_COLOR }}
            >
              {t(item.i18nKey)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
