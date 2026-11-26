// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 Taro API(小程序运行时),不适合共享
import Taro from '@tarojs/taro'

import { onToast } from '@/host/on-toast'
import { DRAWER_COMPANY_ROUTE, DRAWER_FREEBIE_URL, DRAWER_MENU_ROUTES } from '@/utils/drawer-routes'

/**
 * 左抽屉导航的单一出口(2026-11-26 立)。
 *
 * 立这条的实测由来:同一份 key→路由表在三个页面各写一遍(我的 / AI 社区 / 分享星球),
 * 三份各自漂移,其中 5 个目标(`/pages/demand|inspiration|dynamic|company|freebie`)
 * 指向既不在 app.config 注册、也不存在的页面 —— 「我的」抽屉里点这几项,
 * navigateTo 直接失败、页面无任何反馈,用户读到的是"按钮坏了"。
 *
 * 目标表在 drawer-routes.ts(纯数据,由 tests/drawer-routes.test.ts 逐条回查注册页);
 * 本文件只负责执行与失败兜底。
 */

export type DrawerNavTt = (
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) => string

function toastUnconfigured(tt: DrawerNavTt): void {
  onToast(tt('community.text8', '页面未配置'), { kind: 'error' })
}

/** 抽屉分组菜单项(appStore / demand / inspiration / dynamic / course) */
export function openDrawerMenu(key: string, tt: DrawerNavTt): void {
  const route = DRAWER_MENU_ROUTES[key]
  if (!route) return
  if (route.tab) {
    Taro.switchTab({ url: route.url, fail: () => toastUnconfigured(tt) })
    return
  }
  Taro.navigateTo({ url: route.url, fail: () => toastUnconfigured(tt) })
}

/** 抽屉标签项(company / freebie);newChat 由各页面自己接(语义不同,不进本表) */
export function openDrawerLabel(key: string, tt: DrawerNavTt): void {
  if (key === 'company') {
    Taro.navigateTo({ url: DRAWER_COMPANY_ROUTE, fail: () => toastUnconfigured(tt) })
    return
  }
  if (key === 'freebie') {
    Taro.setClipboardData({
      data: DRAWER_FREEBIE_URL,
      success: () =>
        onToast(tt('community.copy9', '链接已复制,请在浏览器打开'), {
          kind: 'info',
          duration: 2000,
        }),
      fail: () => onToast(tt('community.failed10', '复制失败,请重试'), { kind: 'error' }),
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
