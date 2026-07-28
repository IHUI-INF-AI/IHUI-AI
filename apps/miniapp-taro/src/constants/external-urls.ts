/**
 * miniapp-taro 端外部 URL 集中管理
 * 消除各页面散落的 CDN / FAQ / 头像 fallback URL 硬编码
 *
 * 消费方页面(pages/dev-enter/cover, pages/plaza/cover, pages/index, pages/user)
 * 的接入迁移不在本任务范围,本文件作为 single source of truth 供后续迁移引用。
 */

/** 开发者入口 FAQ URL(pages/dev-enter/cover — FAQ_LIST) */
export const DEV_FAQ_URLS = {
  DEVELOPER: 'https://blurb.kou.aizhs.top/developer.html',
  SETTLEMENT: 'https://blurb.kou.aizhs.top/bianxian.html',
  AUDIT: 'https://blurb.kou.aizhs.top/shangchuan.html',
  N8N_COURSE: 'https://blurb.kou.aizhs.top/kecheng.html',
} as const

/** 开发者广场 QA URL(pages/plaza/cover — QA_FALLBACK) */
export const PLAZA_QA_URLS = [
  'https://www.zhihui.com/developer/qa1',
  'https://www.zhihui.com/developer/qa2',
  'https://www.zhihui.com/developer/qa3',
  'https://www.zhihui.com/developer/qa4',
] as const

/** TabBar / 默认头像 CDN URL(pages/index, pages/user — defaultAvatar) */
export const TABBAR_HOME_ICON_URL =
  'https://mp-aab956eb-2e97-4b81-823e-69195b354e49.cdn.bspapp.com/tabbar/tabbar/home.png' as const
