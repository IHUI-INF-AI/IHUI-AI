<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# RN → 小程序 镜像缺口账本(自动生成)

> 判据:与 [check-cross-end-screen-coverage.mjs](../scripts/check-cross-end-screen-coverage.mjs) 同一实现(共享屏被小程序页显式镜像的集合);
> 生成命令:`node scripts/report-rn-miniapp-gaps.mjs --write docs/engineering/rn-miniapp-parity-matrix.md`。
> 候选列只是名字 token 线索(不判定),落地时须按该屏实际字段/接口核实。

- 判定面: **HEAD blob**
- 共享屏(真相源): **242**
- 已被小程序显式镜像: **230**
- 缺口合计: **12**(其中已判定 11 / 未判定 1)
- 判定台账: **105** 行 — 路径与口径单源 `scripts/lib/cross-end-verdicts.mjs`
- 台账三档: **缺页待造 98** / **已造页待补数据钩子 0** / **不承载 7**

## 缺口清单

| # | 共享屏(域) | RN 候选屏 | 小程序既有页线索 | 状态 | 判定依据 |
|---|---|---|---|---|---|
| 1 | `agent-review-detail/AgentReviewDetailScreen` | AgentDetailScreen / AgentReviewListScreen | pkg-ai/ai/agent-detail / pkg-user/agent-review-list/index | 🧱 缺页(已判定) | packages/app/src/features/agent-review-detail/AgentReviewDetailScreen.tsx:32 用 t('agentReviewDetail.title');apps/mobile-rn/src/screens 下无任何屏 import AgentReviewDetailScreen(全仓 RN 消费方为空),小程序端亦无 agentReviewDetail 命名空间与评价详情页,评价详情功能两面皆缺,故该造页。 |
| 2 | `console-table/ConsoleTableScreen` | — | — | 🚫 不承载(已判定) | packages/app/src/features/console-table/ConsoleTableScreen.tsx:21-25 注释明写「通用控制台列表屏 —— 61 条控制台类页面(models/developer 网关族)的规模化杠杆」,是列配置驱动的通用 UI 杠杆而非一个具体页面;其 RN 消费方为 20 个 edu/developer 薄壳(如 apps/mobile-rn/src/screens/EduGradesScreen.tsx),小程序对应页 apps/miniapp-taro/src/pkg-user/edu-mgmt-grades/index.tsx:5 已各自对齐其 RN 薄壳,不存在也不该造一个「控制台表」页。 |
| 3 | `dashboard/DashboardScreen` | ★DashboardScreen | — | 🚫 不承载(已判定) | packages/app/src/features/dashboard/DashboardScreen.tsx:24 是全注入式指标看板(items/renderLoading/renderEmpty 全靠平台注入),RN 壳 apps/mobile-rn/src/screens/DashboardScreen.tsx:60 的数据源是 /api/admin/error-dashboard/stats 管理端错误看板;小程序 app.config.ts 无 admin 页,不由小程序承载,判 not-applicable。 |
| 4 | `domain-hub/DomainHubScreen` | ★DomainHubScreen / EduAiHubScreen | pkg-mirror2/edu-ai-hub/index | 🚫 不承载(已判定) | packages/app/src/features/domain-hub/DomainHubScreen.tsx:16 头注自述跨端共享域入口二级屏(G-921),条目全靠平台注入(DomainHubItem key/label/icon),RN 壳 apps/mobile-rn/src/screens/DomainHubScreen.tsx:19 是 P3 侧边栏收敛用的域入口;小程序 app.config.ts:260-303 只有 5 tab+分包、无侧边栏形态,判通用导航组件屏 not-applicable。 |
| 5 | `finance/FinanceScreen` | ★EduFinanceScreen | pkg-user/edu-mgmt-finance/index | 🧱 缺页(已判定) | packages/app/src/features/finance/FinanceScreen.tsx:16 是财务汇总四卡(余额/今日收入/累计收入/累计支出);RN 端无壳消费该符号(apps/mobile-rn/src/screens/EduFinanceScreen.tsx:15 只 import ConsoleTableScreen);小程序 pkg-user/edu-mgmt-finance/index.tsx:5 是教育缴费记录(对齐 EduFinanceScreen),pkg-shop 只有充值/提现/佣金/余额(app.config.ts:66-88),无财务汇总页,故该造页。 |
| 6 | `following/FollowingScreen` | — | pkg-user/following/index | 🧱 缺页(已判定) | packages/app/src/features/following/FollowingScreen.tsx:32 是关注列表,但 apps/mobile-rn/src/screens 下无壳 import FollowingScreen(仅 packages/app/src/index.ts:103 导出);小程序唯一关注页 apps/miniapp-taro/src/pkg-user/following/index.tsx:5 已声明镜像 follow/FollowScreen(带粉丝 Tab),本屏两端均无承载,证据不足需人工确认。 |
| 7 | `help-detail/HelpDetailScreen` | ActivityDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🧱 缺页(已判定) | packages/app/src/features/help-detail/HelpDetailScreen.tsx:16 是帮助详情页,但 apps/mobile-rn/src/screens 下无壳 import HelpDetailScreen;小程序在册 pkg-about/about/help(apps/miniapp-taro/src/pkg-about/about/help.tsx:4 镜像 help/HelpScreen,app.config.ts:171)只有帮助列表,无帮助详情路由,故该造页。 |
| 8 | `legal-doc/LegalDocScreen` | ★LegalDocScreen / KnowledgeDocScreen | pkg-mirror/knowledge-doc/index | 🚫 不承载(已判定) | 头注自述为通用静态页(隐私政策/用户协议/Cookie 政策等,packages/app/src/features/legal-doc/LegalDocScreen.tsx:16),是多页共用杠杆而非具体页面,RN 侧亦无壳;小程序端每个具体法律页各有专属共享屏并已镜像(apps/miniapp-taro/src/pkg-about/about/privacy.tsx:4 镜像 privacy)=> 不由小程序端单独承载 |
| 9 | `legal-doc/LegalDocsHubScreen` | DomainHubScreen / EduAiHubScreen | pkg-mirror2/edu-ai-hub/index | 🔲 未判定 | — |
| 10 | `login/LoginScreen` | ★LoginScreen | — | 🚫 不承载(已判定) | 机主定档小程序端不该有登录页,login 页已整个删除,登录只剩我的 tab 上的弹窗一个宿主(apps/miniapp-taro/src/app.config.ts:17);共享屏是 RN 端 4-tab 完整版(packages/app/src/features/login/LoginScreen.tsx:43),本就不由小程序承载 => not-applicable |
| 11 | `mcp-store/McpStoreScreen` | ★McpStoreScreen | — | 🚫 不承载(已判定) | 该屏是 MCP Server 管理与安装能力,对应 Web /mcp-store(apps/mobile-rn/src/screens/McpStoreScreen.tsx:24),RN 侧入口全在开发者工作台屏(PatrolScreen/RepoWikiScreen/SelfHealingScreen/TeamMemoryScreen),小程序端无对应工作台域,apps/miniapp-taro/src/api/index.ts 无 mcp 端点 => 桌面/开发端专属 |
| 12 | `switch-prefs/SwitchPrefsScreen` | — | — | 🚫 不承载(已判定) | 头注自述为通用杠杆屏:packages/app/src/features/switch-prefs/SwitchPrefsScreen.tsx:13-14「通用开关偏好屏 —— 开关型设置页(developer/notifications、developer/settings、settings/preferences 等)的规模化杠杆…本屏纯 UI」;RN 端无同名屏,只有薄壳 apps/mobile-rn/src/screens/DeveloperSettingsScreen.tsx:107 与 DeveloperNotificationsScreen.tsx:90 传 items,故该通用组件屏不该由小程序单页承载。 |

> 合计 12 条;标 ★ 的是名字完全匹配(仍需核实功能对应)。
> 状态列口径:**🔲 未判定** = 没人验过,需派单取证;**🧱 缺页** = 已验过且小程序端确实没有对应页(应造页);**🚫 不承载** = 已验过且该屏本就不该由小程序承载(不造页);**🏗 已造页** = 页已按声明链造出,数据钩子待补。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
