// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export default defineAppConfig({
  // 2026-09-10 主包 2MB 硬上限治理:主包只留 9 页
  // (5 个 tabBar 页为平台硬性要求 + login/forgot-password/register/webview 启动关键页),
  // 其余 114 页迁入 pkg-ai/pkg-shop/pkg-learn/pkg-user/pkg-content/pkg-about 六个分包,
  // 同步全量重写 navigateTo/share path 等 '/pages/...' 引用(见 tmp/miniapp-subpackage-migrate.sh)
  //
  // 2026-09-26 主包余量治理(第四十三批):主包实测 2,094,695 B / 2,097,152 B = **99.88%**,
  // 余量只剩 2,457 B —— 任何一次无关 UI 提交都会把它顶过微信硬上限,而提交链上没有任何一道门
  // 跑这个端的构建(守门 110 只在 CI 判红),所以炸点必然推迟到"上传微信"那一刻。
  // 这里把 login/register/forgot-password/webview 四页迁入**同路径 root 的子包**:
  //   root: 'pages/login' + pages: ['login']  ⇒  路由仍是 /pages/login/login
  // 与下方 `pages/distribution`、`pages/member`、`pages/setting` 等 7 个既有子包同一种形态,
  // **URL 逐字不变** ⇒ 12 处 navigateTo/redirectTo/reLaunch 调用点与 4 处测试断言零改动
  // (对照实测:移前后 dist/pages/login/login.js 路径与 app.json 里的完整路由串一致)。
  // 为什么不用"并入 pkg-user"那种移法:那会改 URL,要动 12 处调用点 + 分享 path,
  // 风险远大于收益。代价只有一个:会话过期跳登录时多一次 ~36 KB 的子包下载。
  // 入口页(pages/index/index)与 5 个 tabBar 页**一律留在主包**(平台硬性要求)。
  pages: [
    'pages/index/index',
    'pages/community/index',
    'pages/user/index',
    'pages/plaza/index/index',
    'pages/share/index',
  ],
  subPackages: [
    {
      root: 'pkg-ai',
      pages: [
        'ai/chat',
        'ai/history',
        'ai/image',
        'ai/voice',
        'ai/agent',
        'ai/agent-detail',
        'ai/video',
        'ai/special',
        'ai-skill/index',
        'ai-skill/detail/index',
        'ai-group/index',
        'ai-assistant/index',
        'ai-assistant-n8n/index',
        'ai-career/index',
        'ai-circle/index',
        'ai-chat-detail/index',
        'agent-dialogue/index',
        'aigc/list',
        'aigc/publish',
        'model-plaza/index',
        'ranking/index',
        'ranking/detail',
        'developer/index',
        'developer/income',
        'developer/withdrawal',
        'developer/subscribe',
        'business-card/index',
        'dev-enter/cover/index',
        'dev-enter/model-edit/index',
        'dev-enter/n8n-model/index',
      ],
    },
    {
      root: 'pkg-shop',
      pages: [
        'vip/index',
        'vip/privilege',
        'vip/upgrade',
        'vip/details',
        'vip/success',
        'pay/index',
        'pay/result/index',
        'order/list',
        'order/detail',
        'order/refund',
        'order/refund-list',
        'token/balance',
        'cart/index',
        'vip-trader/index/index',
        'wallet/recharge/index',
        'wallet/top-up/index',
        'wallet/withdrawal/index',
        'wallet/commission/index',
      ],
    },
    {
      root: 'pkg-learn',
      pages: [
        'course/list',
        'course/detail',
        'live/list',
        'live/detail',
        'live/history',
        'live/calendar',
        'live/subscribe',
        'live/host/index',
        'teacher/list',
        'teacher/detail',
        'learn-develop/index',
        'course-planet/index',
        'subscription/contracts/index',
      ],
    },
    {
      root: 'pkg-user',
      pages: [
        'user/settings',
        'user/orders',
        'user/profile',
        'user/avatar',
        'user/nickname',
        'user/phone',
        'user/password',
        'user/email',
        'user/realname',
        'user/feedback',
        'favorites/index',
        'following/index',
        'subscriptions/index',
        'message/index',
        'account-cancel/index',
        'check-in/index',
        'task-center/index',
        'bill/index',
      ],
    },
    {
      root: 'pkg-content',
      pages: [
        'news/list',
        'news/detail',
        'topic/list',
        'topic/detail',
        'announcement/index',
        'announcement/detail/index',
        'activity/index',
        'search/index',
        'category-detail/index',
        'recruitment/index/index',
        'carte/index',
        'share/creation',
        'plaza/detail/index',
        'plaza/cover/index',
        'plaza/set-need/index',
        'community/create/index',
      ],
    },
    {
      root: 'pkg-about',
      pages: [
        'about/index',
        'about/help',
        'about/protocol',
        'about/privacy',
        'about/contact',
        'about/business-license/index',
        'about/icp-record/index',
        'about/model-record/index',
        'about/usage-rules/index',
        'about/app-permission/index',
        'about/api-settings/index',
      ],
    },
    {
      root: 'pages/distribution',
      pages: [
        'index',
        'team',
        'commission',
        'withdraw',
        'rank',
        'order-list/index',
        'member-detail/index',
        'plan/index',
        'company/index',
      ],
    },
    {
      root: 'pages/exam',
      pages: ['list', 'detail', 'answer', 'result'],
    },
    {
      root: 'pages/study',
      pages: [
        'index',
        'record',
        'plan',
        'rank',
        'my-study/index',
        'publish/index',
        'video-detail/index',
      ],
    },
    {
      root: 'pages/circle',
      pages: ['index', 'detail', 'create'],
    },
    {
      root: 'pages/ask',
      pages: ['list', 'detail', 'create'],
    },
    {
      root: 'pages/member',
      pages: ['index', 'benefits', 'integral', 'coupon', 'coupon-list'],
    },
    {
      root: 'pages/setting',
      pages: ['index', 'notification', 'cache', 'language', 'theme', 'privacy'],
    },
    // 2026-09-26 主包余量治理:以下四个 root 与页面目录同名,**路由串与迁移前逐字相同**
    // (root 'pages/login' + page 'login' ⇒ /pages/login/login)。所以本文件之外零调用点改动。
    // 判据依据:这 4 页既不是入口页也不在 tabBar.list 里(主包必须保留的只有那两类)。
    {
      root: 'pages/login',
      pages: ['login'],
    },
    {
      root: 'pages/register',
      pages: ['index'],
    },
    {
      root: 'pages/forgot-password',
      pages: ['index'],
    },
    {
      root: 'pages/webview',
      pages: ['index'],
    },
  ],
  // 微信原生 darkmode:theme.json 提供 light/dark 两组变量,auto 模式运行期由
  // 系统实时切换原生 chrome(导航栏/窗口/tabBar),与 src/lib/theme.ts JS 层互补
  darkmode: true,
  themeLocation: 'theme.json',
  window: {
    backgroundTextStyle: '@bgTxtStyle',
    navigationBarBackgroundColor: '@navBgColor',
    navigationBarTitleText: '智汇AI',
    navigationBarTextStyle: '@navTxtStyle',
    backgroundColor: '@bgColor',
  },
  tabBar: {
    // Taro 4 Vite 编译不输出 custom-tab-bar(GitHub #17978/#18415),暂用原生 tabBar
    // 后续改 webpack5 编译器后可恢复 custom: true
    // 2026-08-28:亮色 tabBar(对齐全站亮色 CSS 变量体系),图标由 gen-tabbar-icons.mjs 生成
    // 2026-09-03:颜色改 @变量 引用 theme.json(配合 darkmode: true),色值与 src/lib/theme.ts THEME_CHROME 对齐
    custom: false,
    color: '@tabColor',
    selectedColor: '@tabSelectedColor',
    borderStyle: '@tabBorderStyle' as 'white' | 'black', // Taro 类型窄化为字面量,运行时 @变量 引用合法(原生 darkmode)
    backgroundColor: '@tabBgColor',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '智汇社区',
        iconPath: 'assets/tabbar/tab-community.png',
        selectedIconPath: 'assets/tabbar/tab-community-active.png',
      },
      {
        pagePath: 'pages/community/index',
        text: 'AI agent',
        iconPath: 'assets/tabbar/tab-agent.png',
        selectedIconPath: 'assets/tabbar/tab-agent-active.png',
      },
      {
        pagePath: 'pages/plaza/index/index',
        text: '广场',
        iconPath: 'assets/tabbar/tab-square.png',
        selectedIconPath: 'assets/tabbar/tab-square-active.png',
      },
      {
        pagePath: 'pages/user/index',
        text: '我的',
        iconPath: 'assets/tabbar/tab-user.png',
        selectedIconPath: 'assets/tabbar/tab-user-active.png',
      },
      {
        pagePath: 'pages/share/index',
        text: '分享星球',
        iconPath: 'assets/tabbar/tab-share.png',
        selectedIconPath: 'assets/tabbar/tab-share-active.png',
      },
    ],
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
