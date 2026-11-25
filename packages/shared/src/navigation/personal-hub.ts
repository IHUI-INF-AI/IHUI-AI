// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「我的 / 个人中心」入口清单 —— 全仓唯一一份(2026-11-24 立,机主定令「跟 web 端一致」,
 * 同日第二轮机主令「必须打通同键」⇒ 文案键全部下沉 `packages/i18n/messages/shared`)。
 *
 * 立因(实测,不是推断):
 *  - RN `apps/mobile-rn/src/screens/profileMenuData.ts` 曾手写 13 段 122 条,全部展开排在
 *    4 Tab 内容区之后(122 × 56px ≈ 6800px ≈ 9 屏),找「设置」要滑过整屏空内容;
 *  - 小程序 `pages/user/index.tsx` 曾另写 12 条裸平铺,与 RN 差 110 个入口;
 *  - web 早已收敛(`SIDEBAR_NAV_SOURCE` 11 个一级域 + `/domains/personal` 域页)。
 *  三份清单互不相等 = 换端找不到入口,且必然继续漂移(AGENTS §0.6 第二份禁令)。
 *
 * **同键(2026-11-24 第二轮)**:三端语言包都只是 `mergeMessages(shared, <端包>)`
 * (web `i18n-provider.tsx` / RN `src/i18n/index.tsx` / 小程序 `src/i18n/index.tsx` 的
 * zh-CN gzip 包同源),故条目文案一律取 `personalHub.entries.<key>.label`、
 * 卡片副标题取 `.desc`、组标题取 `personalHub.sections.<id>` —— 这些键只存在于
 * `packages/i18n/messages/shared/` 五语言,三端取到的是**同一条字符串**。
 * 端内语言包**不得**再登记同名键(重复登记 = 两份真相源)。
 * `label` / `desc` / `title` 字段保留为中文兜底:任一端语言包缺键时直接出这句,
 * 绝不把键名渲染给用户。
 *
 * 覆盖范围 = web `/domains/personal` 域页的**全集**(31 条):
 *   资产 4(订单/钱包/我的一人公司/智汇值) + 权益与积分 2 + 我的学习 7(含 web 的 /user/follow)
 *   + 我的内容 7(含 /user/ask /user/circle) + 账号与安全 6(含 /user/subscription)
 *   + 服务与支持 4。web 侧栏派生 20 条(见 `PERSONAL_WEB_SIDEBAR_GROUPS`),
 *   移动端「我的」页派生 22 条(见 `PERSONAL_MENU_SECTIONS`,不含 4 张资产卡与 5 条 webOnly)。
 *
 * 与 web 历史清单的对账(2026-11-24 逐条比对 web `nav-data.ts` 的 `PERSONAL_HUB_ITEMS`,
 * flatten 20 个唯一 href):
 *  - 20 条 href 与本清单 `webSidebar` 非 omit 的 20 条**逐条相等**(守门 340 判据 H 断言);
 *  - web 侧栏多出的 `/student` `/user/subscription` `/user/ask` `/user/circle`
 *    `/user/follow` 5 条旧 UserNav 历史项已收编进本清单(标 `webOnly`,移动端不重复投放
 *    —— 移动端这些能力都有原生屏,入口在教育域/社区域/会员页);
 *  - 本清单另含 6 条移动端就地入口(积分/会员/课程/文章/消息/设置/关于中的 6 条,
 *    标 `webSidebar: 'omit'`,web 归交易域/教育域/内容域/设置页承载,侧栏不重复登记
 *    —— 同一 href 在 nav-data 出现两行会触发门 128「重复 web 键」)。
 *
 * 字段契约:
 *  - `webHref` 必须真实可达(web 端据此渲染,守门 340 逐条探活);
 *  - `rn` / `miniapp` 缺省 = 该端无原生屏 ⇒ 按 `webHref` 走 WebView / web-view,
 *    **不允许**端内再写第二份清单或造假入口(点开 404 的入口一律判红);
 *  - `requiresAuth` 仅用于端侧决定是否先弹登录,不承担鉴权(硬闸仍在后端)。
 */

/** 端内图标身份(三端各自映射成自家图标库组件,清单不依赖任何 UI 库) */
export type PersonalHubIconKey =
  | 'receipt'
  | 'wallet'
  | 'coins'
  | 'crown'
  | 'bookOpen'
  | 'calendarCheck'
  | 'star'
  | 'userPlus'
  | 'users'
  | 'rss'
  | 'newspaper'
  | 'messageSquare'
  | 'folder'
  | 'fileCheck'
  | 'clipboardCheck'
  | 'user'
  | 'shieldCheck'
  | 'bell'
  | 'bellRing'
  | 'lock'
  | 'settings'
  | 'helpCircle'
  | 'messageCircle'
  | 'info'
  | 'graduationCap'

/** 移动端原生落点;缺省端侧按 webHref 走 WebView */
export type PersonalHubMobileTarget =
  { kind: 'route'; name: string } | { kind: 'main'; screen: string }

/** web 侧栏落位:learning = /favorites 父项下,account = /user/profile 父项下,flat = 一级平铺,omit = 不进 web 侧栏 */
export type PersonalHubWebSidebar = 'learning' | 'account' | 'flat' | 'omit'

/** 域页分组 id(web 6 组;移动端取后 5 组,不含 assets) */
export type PersonalHubSectionId = 'assets' | 'points' | 'study' | 'content' | 'account' | 'service'

export interface PersonalHubEntry {
  /** 稳定键:端侧导航分派与测试断言都认它,不得改 */
  key: string
  /** 文案键(shared 包 `personalHub.entries.<key>.label`);三端同键 */
  labelKey: string
  /** 中文兜底 —— 任一语言包缺键时直接出这句,不把键名渲染给用户 */
  label: string
  /** 卡片副标题键(仅资产卡用;列表行忽略) */
  descKey?: string
  /** 卡片副标题中文兜底 */
  desc?: string
  iconKey: PersonalHubIconKey
  /** web 端路由(必填:web 个人域要能落到同一页) */
  webHref: string
  /** RN 原生落点;缺省 = 无原生屏,走 webHref 的 WebView */
  rn?: PersonalHubMobileTarget
  /** 小程序原生路径;缺省 = 无原生页,走 webHref 的 web-view */
  miniapp?: string
  requiresAuth?: boolean
  /** 所属域页分组 */
  hubSection: PersonalHubSectionId
  /** web 侧栏落位(缺省 omit) */
  webSidebar?: PersonalHubWebSidebar
  /**
   * 仅 web 展示(移动端不投放)。
   * 用于 web 旧 UserNav 历史项:移动端同名能力都有原生屏,入口在别的域,
   * 「我的」页不重复挂 —— 移动端清单由 `PERSONAL_MENU_SECTIONS` 过滤本字段得到。
   */
  webOnly?: boolean
}

export interface PersonalHubSection {
  /** 分组 id */
  id: PersonalHubSectionId
  /** 分组标题 i18n 键(shared 包 `personalHub.sections.<id>`) */
  titleKey: string
  /** 中文兜底 */
  title: string
  items: readonly PersonalHubEntry[]
}

/** 条目工厂:只做默认值收敛,不做校验(校验在守门 340 与单测) */
function entry(
  input: Omit<PersonalHubEntry, 'labelKey'> & { labelKey?: string },
): PersonalHubEntry {
  return {
    labelKey: `personalHub.entries.${input.key}.label`,
    ...input,
  }
}

/** 资产卡(账号卡下方 2×2 宫格;RN 与小程序各自已有这块 UI,本清单把两份手写数组收成一份) */
const ASSET_CARDS: readonly PersonalHubEntry[] = [
  entry({
    key: 'order',
    label: '我的订单',
    descKey: 'personalHub.entries.order.desc',
    desc: '查看相关订单',
    iconKey: 'receipt',
    webHref: '/orders',
    rn: { kind: 'route', name: 'Order' },
    miniapp: '/pkg-user/user/orders',
    requiresAuth: true,
    hubSection: 'assets',
  }),
  entry({
    key: 'wallet',
    label: '我的钱包',
    descKey: 'personalHub.entries.wallet.desc',
    desc: '查看余额与充值',
    iconKey: 'wallet',
    webHref: '/wallet',
    rn: { kind: 'route', name: 'Wallet' },
    miniapp: '/pkg-shop/wallet/index',
    requiresAuth: true,
    hubSection: 'assets',
  }),
  entry({
    key: 'company',
    label: '我的公司',
    descKey: 'personalHub.entries.company.desc',
    desc: '查看员工与业绩',
    iconKey: 'users',
    webHref: '/distribution',
    rn: { kind: 'route', name: 'Distribution' },
    miniapp: '/pages/distribution/index',
    requiresAuth: true,
    hubSection: 'assets',
  }),
  entry({
    key: 'token',
    label: '我的智汇值',
    descKey: 'personalHub.entries.token.desc',
    desc: '智汇消耗信息',
    iconKey: 'coins',
    webHref: '/token-value',
    rn: { kind: 'route', name: 'TokenValue' },
    miniapp: '/pkg-shop/token/balance',
    requiresAuth: true,
    hubSection: 'assets',
  }),
]

/** 分组元数据:标题键 + 中文兜底(顺序 = 渲染顺序) */
const SECTION_META: readonly { id: PersonalHubSectionId; title: string }[] = [
  { id: 'assets', title: '我的资产' },
  { id: 'points', title: '权益与积分' },
  { id: 'study', title: '我的学习' },
  { id: 'content', title: '我的内容' },
  { id: 'account', title: '账号与安全' },
  { id: 'service', title: '服务与支持' },
]

/**
 * 菜单条目(27 行,不含 4 张资产卡)。
 *
 * 排序即渲染顺序:study 组里课程→记录→收藏→关注→粉丝→订阅→关注(web);
 * content 组文章→评论→资源→考试→报名→提问(web)→圈子(web);
 * account 组资料→实名→消息→通知→安全→订阅管理(web);service 组设置→帮助→反馈→关于。
 */
const MENU_ITEMS: readonly PersonalHubEntry[] = [
  // —— 权益与积分 ——
  entry({
    key: 'points',
    label: '我的积分',
    iconKey: 'coins',
    webHref: '/points',
    rn: { kind: 'route', name: 'Points' },
    miniapp: '/pkg-mirror3/points/index',
    requiresAuth: true,
    hubSection: 'points',
    webSidebar: 'omit',
  }),
  entry({
    key: 'vip',
    label: '我的会员',
    iconKey: 'crown',
    webHref: '/vip',
    rn: { kind: 'route', name: 'Vip' },
    miniapp: '/pkg-shop/vip/index',
    requiresAuth: true,
    hubSection: 'points',
    webSidebar: 'omit',
  }),
  // —— 我的学习 ——
  entry({
    key: 'myLessons',
    label: '我的课程',
    iconKey: 'bookOpen',
    webHref: '/learn',
    rn: { kind: 'route', name: 'MyLessons' },
    miniapp: '/pkg-learn/course/list',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'omit',
  }),
  entry({
    key: 'studyRecord',
    label: '学习记录',
    iconKey: 'calendarCheck',
    webHref: '/user/learn-record',
    rn: { kind: 'route', name: 'StudyRecord' },
    miniapp: '/pages/study/record',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'account',
  }),
  entry({
    key: 'favorites',
    label: '我的收藏',
    iconKey: 'star',
    webHref: '/favorites',
    rn: { kind: 'route', name: 'Favorites' },
    miniapp: '/pkg-user/favorites/index',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'learning',
  }),
  entry({
    key: 'follow',
    label: '我的关注',
    iconKey: 'userPlus',
    webHref: '/following',
    rn: { kind: 'route', name: 'Follow' },
    miniapp: '/pkg-user/following/index',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'learning',
  }),
  entry({
    key: 'fans',
    label: '我的粉丝',
    iconKey: 'users',
    webHref: '/user/fans',
    rn: { kind: 'route', name: 'UserFans' },
    miniapp: '/pkg-user/fans/index',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'account',
  }),
  entry({
    key: 'subscriptions',
    label: '我的订阅',
    iconKey: 'rss',
    webHref: '/subscriptions',
    rn: { kind: 'route', name: 'Subscriptions' },
    miniapp: '/pkg-user/subscriptions/index',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'learning',
  }),
  entry({
    key: 'webFollow',
    label: '关注我的',
    iconKey: 'userPlus',
    webHref: '/user/follow',
    requiresAuth: true,
    hubSection: 'study',
    webSidebar: 'account',
    webOnly: true,
  }),
  // —— 我的内容 ——
  entry({
    key: 'userArticles',
    label: '我的文章',
    iconKey: 'newspaper',
    webHref: '/user/articles',
    rn: { kind: 'route', name: 'UserArticles' },
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'omit',
  }),
  entry({
    key: 'myComments',
    label: '我的评论',
    iconKey: 'messageSquare',
    webHref: '/user/comment',
    rn: { kind: 'route', name: 'MyComments' },
    miniapp: '/pkg-mirror2/my-comments/index',
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'account',
  }),
  entry({
    key: 'myResources',
    label: '我的资源',
    iconKey: 'folder',
    webHref: '/user/resource',
    rn: { kind: 'route', name: 'MyResources' },
    miniapp: '/pkg-mirror2/my-resources/index',
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'account',
  }),
  entry({
    key: 'examHistory',
    label: '我的考试',
    iconKey: 'fileCheck',
    webHref: '/user/exam',
    rn: { kind: 'route', name: 'ExamHistory' },
    miniapp: '/pkg-mirror/exam-history/index',
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'account',
  }),
  entry({
    key: 'signUp',
    label: '我的报名',
    iconKey: 'clipboardCheck',
    webHref: '/user/sign-up',
    rn: { kind: 'route', name: 'SignUp' },
    miniapp: '/pkg-user/sign-up/index',
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'account',
  }),
  entry({
    key: 'myAsk',
    label: '我的提问',
    iconKey: 'helpCircle',
    webHref: '/user/ask',
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'account',
    webOnly: true,
  }),
  entry({
    key: 'myCircle',
    label: '我的圈子',
    iconKey: 'users',
    webHref: '/user/circle',
    requiresAuth: true,
    hubSection: 'content',
    webSidebar: 'account',
    webOnly: true,
  }),
  // 2026-11-24:「分享星球」退出底部 tab(第 5 位让给「动态」),入口下沉到「我的」页;
  // 三端各有原生页(web /share、RN Share 路由、小程序 pages/share/index),故不设 webOnly
  entry({
    key: 'sharePlanet',
    label: '分享星球',
    iconKey: 'star',
    webHref: '/share',
    rn: { kind: 'route', name: 'Share' },
    miniapp: '/pkg-share/share/index',
    hubSection: 'content',
    webSidebar: 'account',
  }),
  // —— 账号与安全 ——
  entry({
    key: 'profileEdit',
    label: '个人资料',
    iconKey: 'user',
    webHref: '/user/profile',
    rn: { kind: 'route', name: 'ProfileEdit' },
    miniapp: '/pkg-user/user/profile',
    requiresAuth: true,
    hubSection: 'account',
    webSidebar: 'account',
  }),
  entry({
    key: 'realNameAuth',
    label: '实名认证',
    iconKey: 'shieldCheck',
    webHref: '/user/realname',
    rn: { kind: 'route', name: 'RealNameAuth' },
    miniapp: '/pkg-user/user/realname',
    requiresAuth: true,
    hubSection: 'account',
    webSidebar: 'account',
  }),
  entry({
    key: 'messageCenter',
    label: '消息中心',
    iconKey: 'bell',
    webHref: '/messages',
    rn: { kind: 'route', name: 'MessageCenter' },
    miniapp: '/pkg-user/message/index',
    requiresAuth: true,
    hubSection: 'account',
    webSidebar: 'omit',
  }),
  entry({
    key: 'notificationSettings',
    label: '通知设置',
    iconKey: 'bellRing',
    webHref: '/notifications',
    rn: { kind: 'route', name: 'NotificationSettings' },
    miniapp: '/pages/setting/notification',
    requiresAuth: true,
    hubSection: 'account',
    webSidebar: 'account',
  }),
  entry({
    key: 'securitySettings',
    label: '安全设置',
    iconKey: 'lock',
    webHref: '/user/security',
    rn: { kind: 'route', name: 'SecuritySettings' },
    miniapp: '/pkg-mirror3/security-settings/index',
    requiresAuth: true,
    hubSection: 'account',
    webSidebar: 'account',
  }),
  entry({
    key: 'mySubscription',
    label: '订阅管理',
    iconKey: 'receipt',
    webHref: '/user/subscription',
    requiresAuth: true,
    hubSection: 'account',
    webSidebar: 'account',
    webOnly: true,
  }),
  // —— 服务与支持 ——
  entry({
    key: 'settings',
    label: '设置',
    iconKey: 'settings',
    webHref: '/settings',
    rn: { kind: 'route', name: 'Settings' },
    miniapp: '/pkg-user/user/settings',
    hubSection: 'service',
    webSidebar: 'omit',
  }),
  entry({
    key: 'help',
    label: '帮助中心',
    iconKey: 'helpCircle',
    webHref: '/help',
    rn: { kind: 'route', name: 'Help' },
    miniapp: '/pkg-about/about/help',
    hubSection: 'service',
    webSidebar: 'flat',
  }),
  entry({
    key: 'feedback',
    label: '意见反馈',
    iconKey: 'messageCircle',
    webHref: '/feedback',
    rn: { kind: 'route', name: 'Feedback' },
    miniapp: '/pkg-user/user/feedback',
    hubSection: 'service',
    webSidebar: 'flat',
  }),
  entry({
    key: 'about',
    label: '关于我们',
    iconKey: 'info',
    webHref: '/about',
    rn: { kind: 'route', name: 'About' },
    miniapp: '/pkg-about/about/index',
    hubSection: 'service',
    webSidebar: 'omit',
  }),
  entry({
    key: 'student',
    label: '学生中心',
    iconKey: 'graduationCap',
    webHref: '/student',
    hubSection: 'service',
    webSidebar: 'flat',
    webOnly: true,
  }),
]

/** 分组列表(6 组 31 条;web 域页与移动端共用本清单,移动端过滤 assets 与 webOnly) */
export const PERSONAL_HUB_SECTIONS: readonly PersonalHubSection[] = SECTION_META.map((meta) => ({
  id: meta.id,
  titleKey: `personalHub.sections.${meta.id}`,
  title: meta.title,
  items:
    meta.id === 'assets' ? ASSET_CARDS : MENU_ITEMS.filter((item) => item.hubSection === meta.id),
}))

/** 资产卡(2×2 宫格;从唯一清单派生,不再手写第二份数组) */
export const PERSONAL_ASSET_CARDS: readonly PersonalHubEntry[] = ASSET_CARDS

/** 移动端「我的」页分组(后 5 组,过滤 assets 与 webOnly ⇒ 23 条;RN 与小程序共用) */
export const PERSONAL_MENU_SECTIONS: readonly PersonalHubSection[] = PERSONAL_HUB_SECTIONS.filter(
  (section) => section.id !== 'assets',
).map((section) => ({
  ...section,
  items: section.items.filter((item) => !item.webOnly),
}))

/**
 * web 侧栏派生指令(2026-11-24):告诉 web 怎么从唯一清单重建 `PERSONAL_HUB_ITEMS`。
 *
 * `parentKey` 是 web 侧栏原有的父项 key(取 `nav` 命名空间既有词条,不新增键);
 * `entries` 是落位到该父项下的条目;`flat` 是无父项的一级条目。
 * web 只许按本结构渲染,不得再手写第二份数组(守门 340 判据 H)。
 */
export const PERSONAL_WEB_SIDEBAR_GROUPS: readonly {
  group: 'learning' | 'account'
  /** 父项稳定键(web 侧栏 labelKey 仍取 nav 既有词条) */
  parentKey: 'myLearning' | 'user'
  entries: readonly PersonalHubEntry[]
}[] = [
  {
    group: 'learning',
    parentKey: 'myLearning',
    entries: MENU_ITEMS.filter((item) => item.webSidebar === 'learning'),
  },
  {
    group: 'account',
    parentKey: 'user',
    entries: MENU_ITEMS.filter((item) => item.webSidebar === 'account'),
  },
]

/** web 侧栏一级平铺条目(/student /help /feedback) */
export const PERSONAL_WEB_SIDEBAR_FLAT: readonly PersonalHubEntry[] = MENU_ITEMS.filter(
  (item) => item.webSidebar === 'flat',
)

/** 扁平清单(守门与端侧查找共用;顺序 = 渲染顺序 = 域页顺序) */
export const PERSONAL_HUB_ALL_ENTRIES: readonly PersonalHubEntry[] = PERSONAL_HUB_SECTIONS.flatMap(
  (section) => section.items,
)

/** 按 key 查条目(找不到返回 undefined,调用方必须显式处理,不得静默吞点击) */
export function findPersonalHubEntry(key: string): PersonalHubEntry | undefined {
  return PERSONAL_HUB_ALL_ENTRIES.find((entry) => entry.key === key)
}

/** 端侧是否真的能落地:有原生落点或 webHref 才算(防造假入口) */
export function canOpenPersonalHubEntry(
  entry: PersonalHubEntry,
  host: 'web' | 'rn' | 'miniapp',
): boolean {
  if (host === 'rn') return Boolean(entry.rn || entry.webHref)
  if (host === 'miniapp') return Boolean(entry.miniapp || entry.webHref)
  return Boolean(entry.webHref)
}

/**
 * 菜单区搜索过滤(2026-11-24 立,web DomainHub 搜索框的跨端同源判据)。
 *
 * 为什么在共享层:RN(经共享 ProfileScreen)与小程序各写一份 `includes` 必然漂开
 * ——一端按 title+label 匹配、另一端只按 label,同一句搜索词在两端给出两个结果集。
 *
 * 口径:
 *  - 入参 `sections` 是**宿主已翻译**的 `{ title, items: { label }[] }`(不依赖 i18n 键);
 *  - 空查询(含纯空白)原样返回全部,**不改变顺序、不丢组**;
 *  - 命中面 = 组标题(title) 或 条目 label 的子串,大小写不敏感(中文无大小写,等价于原文包含);
 *  - 无命中的组整组消失(不渲染空标题),全无命中返回 `[]` —— 空态文案由宿主渲染。
 */
export function filterLabelledSections<T extends { label: string }>(
  sections: readonly { title: string; items: readonly T[] }[],
  query: string,
): { title: string; items: T[] }[] {
  const q = query.trim().toLowerCase()
  if (!q) return sections.map((section) => ({ title: section.title, items: [...section.items] }))
  const titleHit = (title: string) => title.toLowerCase().includes(q)
  const out: { title: string; items: T[] }[] = []
  for (const section of sections) {
    if (titleHit(section.title)) {
      out.push({ title: section.title, items: [...section.items] })
      continue
    }
    const items = section.items.filter((item) => item.label.toLowerCase().includes(q))
    if (items.length > 0) out.push({ title: section.title, items })
  }
  return out
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
