// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 左抽屉的跳转目标表(纯数据,零 import)。
 *
 * 单独成文件的理由:同一份 key→路由表曾在三个页面各写一遍(我的 / AI 社区 / 分享星球),
 * 三份各自漂移,其中 5 个目标(`/pages/demand|inspiration|dynamic|company|freebie`)
 * 指向既不在 app.config 注册、也不存在的页面 —— 抽屉里点这几项没有任何反馈。
 * 表收成一处的同一笔,把「目标是否真的注册过」变成可测判据(tests/drawer-routes.test.ts),
 * 以后改页面路径只需要改这里,测试会当场把死路由拦下来。
 *
 * 路由以 app.config.ts 的注册页为准(ui-routes.generated 由其生成);
 * tab 页只能 switchTab(微信硬约束),其余 navigateTo。
 */

export interface DrawerRouteTarget {
  url: string
  /** tabBar 页:只能 switchTab,用 navigateTo 打 tab 页必然失败 */
  tab?: boolean
}

export const DRAWER_MENU_ROUTES: Readonly<Record<string, DrawerRouteTarget>> = {
  // 「应用商店」= tabBar 第一项 AI 应用商店;旧写法打 /pages/index/index(不是 tab 页,
  // switchTab 必失败、navigateTo 又把人送去 AI 对话首页,与标签所指不符)
  appStore: { url: '/pages/agent-market/index', tab: true },
  // 对齐原项目 square: 跳需求广场
  demand: { url: '/pkg-ai/ranking/index' },
  // 对齐原项目 aigc: 跳 AIGC 创作列表
  inspiration: { url: '/pkg-ai/aigc/list' },
  // 对齐原项目 share: 跳 AI 资讯 —— 2026-11-25 该页整体下沉 pkg-share,
  // 旧路径 /pages/share/index 已不在 app.config 注册
  dynamic: { url: '/pkg-share/share/index' },
  // 对齐原项目 studyindex: 跳课程
  course: { url: '/pkg-learn/course/list' },
}

/** 我的一人公司:分销页在分包 root=pages/distribution 下 */
export const DRAWER_COMPANY_ROUTE = '/pages/distribution/company/index'

/** 领取免费资料:原项目 lingqu = 复制飞书 wiki 链接,无对应路由(对齐 RN 端同文案) */
export const DRAWER_FREEBIE_URL =
  'https://aizhihuishe.feishu.cn/wiki/GPs7wff9PiDekQkKvBncrymnIh?from=from_copylink'

/** 本文件声明的全部跳转目标(测试用它逐条回查 app.config 注册页) */
export const DRAWER_ROUTE_TARGETS: readonly string[] = [
  ...Object.values(DRAWER_MENU_ROUTES).map((route) => route.url),
  DRAWER_COMPANY_ROUTE,
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
