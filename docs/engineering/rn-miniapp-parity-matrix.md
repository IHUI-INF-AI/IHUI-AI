<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# RN → 小程序 镜像缺口账本(自动生成)

> 判据:与 [check-cross-end-screen-coverage.mjs](../scripts/check-cross-end-screen-coverage.mjs) 同一实现(共享屏被小程序页显式镜像的集合);
> 生成命令:`node scripts/report-rn-miniapp-gaps.mjs --write docs/engineering/rn-miniapp-parity-matrix.md`。
> 候选列只是名字 token 线索(不判定),落地时须按该屏实际字段/接口核实。

- 判定面: **工作树(人工)**
- 共享屏(真相源): **278**
- 已被小程序显式镜像: **258**
- 缺口合计: **20**(其中已判定 20 / 未判定 0) —— 本行**需要动手的只有 0 条**(= 判为缺页待造 + 未判定);其余 20 条是已判定「不承载」的结清凭据,派单等于重判一遍
- 判定台账: **128** 行 — 路径与口径单源 `scripts/lib/cross-end-verdicts.mjs`
- 台账三档: **缺页待造 0** / **已造页 97** / **不承载 31** — 已造页按台账 evidence 分桶:**已闭环 97** / **需裁决 0** / **真待补 0**
> ⚠ 已造页 97 条**已计入上面的覆盖率**。按台账 evidence 的显式裁决:已闭环 97 条(aligned / 已修复 / 不构成缺口)、**需产品/端侧裁决 0 条**、无显式标记的「真待补」0 条(见文末分桶单)。
> 「真待补 0」只说明台账里没有未裁决条目,**不等于三端功能 100% 对齐**:当前没有未裁决的 blocked 结构/端点缺口；覆盖率本身也不等于功能对齐(§0.3「造好没装车 = 没有」)。旧版把全部 97 条一律派单,是另一种失真,故本单只按台账已写明的结论分桶。

## 缺口清单

| # | 共享屏(域) | RN 候选屏 | 小程序既有页线索 | 状态 | 判定依据 |
|---|---|---|---|---|---|
| 1 | `agent-review-detail/AgentReviewDetailScreen` | ★AgentReviewDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-user/agent-review-list/index | 🚫 不承载(已判定) | 全仓零渲染消费:RN 侧只有 AgentReviewListScreen(列表,渲染共享屏 agent-review-list),无详情入口、无 <AgentReviewDetailScreen,web 侧 apps/web/app/(main) 下无 agents/*/reviews 一类的详情路由,包内也只有类型再导出 ⇒ 镜像它会产出无数据腿的重复页,判不承载;本屏候选下线(零消费)。 |
| 2 | `ai-career/AiCareerScreen` | ★AiCareerScreen / AiAssistantN8nScreen | pkg-ai/ai-career/index / pkg-ai/ai/chat | 🚫 不承载(已判定) | 2026-11-02 复核: 小程序 pkg-ai/ai-career/index 是智能体列表页(index.tsx:5 旧标记/:19-30 消费 aicareer.q1..q21/:53 api.getAgentList/:68 跳 /pkg-ai/agent-dialogue/index),共享屏 AiCareerScreen 是 AI 学业问卷 + 报告导出(:154 career.exportingReport + studentPage.exportReport,:184 career.exportEmptyHint),两侧业务键 0 交集、端点 0 交集 ⇒ 非同源,不参与镜像对账;registry 原条目 84-88 已删除。 |
| 3 | `api-keys/ApiKeysScreen` | ★ApiKeysScreen / ApiSettingsScreen | pkg-about/about/api-settings/index | 🚫 不承载(已判定) | 2026-11-11 复核: 小程序侧该功能层已于 origin/main 2a4dccdfc7 批量提交 87e5810c29 退役(删除 @rn-shells 镜像声明、miniapp-taro i18n apiKeys 命名空间五语言键与配套测试);packages/app 屏本体保留供 web/RN 消费,小程序不再承载 ⇒ not-applicable;本行为合并 6e75e15fc8 落地时对侧撤声明的登记补录(门301 未判定/门302p mirrored-decrease 双销账)。 |
| 4 | `artifacts/ArtifactsScreen` | ★ArtifactsScreen | — | 🚫 不承载(已判定) | RN 原生承载已落地(bdd9129d407 链上 bc817cbc288:薄壳 apps/mobile-rn/src/screens/ArtifactsScreen.tsx + drawer AI 组入口);小程序侧由 web-portal 门户承载(webViewPortal.artifacts 词条五语言已随 bdd9129d40 落,pages/webview 打 /artifacts,同 2026-10-27 letters 判例「功能页进门户不各端再搓原生屏」)⇒ 不镜像,零开发拿功能。 |
| 5 | `community-home/CommunityHomeScreen` | CommunityMainScreen / CommunityScreen | pages/community/index / pkg-content/community/create/index | 🚫 不承载(已判定) | 2026-11-27 复核:小程序 pages/community/index 是手写页(TSX + 独立 CSS),未消费 @ihui/rn-app 的 CommunityHomeScreen;RN 已由 apps/mobile-rn/src/screens/CommunityScreen.tsx 消费共享屏。两端是同一业务对象的两种实现,不以共享屏再造第二套小程序壳,故本共享屏对小程序判 not-applicable,小程序页面仍按手写页单独对样式账。证据: apps/miniapp-taro/src/pages/community/index.tsx; apps/mobile-rn/src/screens/CommunityScreen.tsx; packages/app/src/features/community-home/CommunityHomeScreen.tsx |
| 6 | `console-table/ConsoleTableScreen` | — | — | 🚫 不承载(已判定) | packages/app/src/features/console-table/ConsoleTableScreen.tsx:21-25 注释明写「通用控制台列表屏 —— 61 条控制台类页面(models/developer 网关族)的规模化杠杆」,是列配置驱动的通用 UI 杠杆而非一个具体页面;其 RN 消费方为 20 个 edu/developer 薄壳(如 apps/mobile-rn/src/screens/EduGradesScreen.tsx),小程序对应页 apps/miniapp-taro/src/pkg-user/edu-mgmt-grades/index.tsx:5 已各自对齐其 RN 薄壳,不存在也不该造一个「控制台表」页。 |
| 7 | `dashboard/DashboardScreen` | ★DashboardScreen / ★EduDashboardScreen | pkg-user/member-dashboard/index / pkg-user/edu-dashboard/index | 🚫 不承载(已判定) | packages/app/src/features/dashboard/DashboardScreen.tsx:24 是全注入式指标看板(items/renderLoading/renderEmpty 全靠平台注入),RN 壳 apps/mobile-rn/src/screens/DashboardScreen.tsx:60 的数据源是 /api/admin/error-dashboard/stats 管理端错误看板;小程序 app.config.ts 无 admin 页,不由小程序承载,判 not-applicable。 |
| 8 | `dev-enter-cover/DevEnterCoverScreen` | ★DevEnterCoverScreen / DevEnterScreen | pkg-ai/dev-enter/cover/index / pkg-ai/dev-enter/model-edit/index | 🚫 不承载(已判定) | 2026-11-06 复核: 小程序 pkg-ai/dev-enter/cover/index 页顶 :5 已改挂 developer/DeveloperScreen(RN DeveloperScreen.tsx:162 真消费),页面是开发者空间首页;dev-enter-cover/DevEnterCoverScreen 是「进入开发者空间」套餐封面(props planType/onSelectPlan, :14-18),两处业务对象/业务键 0 交集 ⇒ 不承载该屏;registry 原条目已删除,同一 route 归 DeveloperScreen。 |
| 9 | `domain-hub/DomainHubScreen` | ★DomainHubScreen | — | 🚫 不承载(已判定) | packages/app/src/features/domain-hub/DomainHubScreen.tsx:16 头注自述跨端共享域入口二级屏(G-921),条目全靠平台注入(DomainHubItem key/label/icon),RN 壳 apps/mobile-rn/src/screens/DomainHubScreen.tsx:19 是 P3 侧边栏收敛用的域入口;小程序 app.config.ts:260-303 只有 5 tab+分包、无侧边栏形态,判通用导航组件屏 not-applicable。 |
| 10 | `groups/GroupsScreen` | ★GroupsScreen | — | 🚫 不承载(已判定) | 2026-11-11 复核: 小程序侧该功能层已于 origin/main 2a4dccdfc7 批量提交 87e5810c29 退役(删除 @rn-shells 镜像声明、miniapp-taro i18n groups 命名空间五语言键与配套测试);packages/app 屏本体保留供 web/RN 消费,小程序不再承载 ⇒ not-applicable;本行为合并 6e75e15fc8 落地时对侧撤声明的登记补录(门301 未判定/门302p mirrored-decrease 双销账)。 |
| 11 | `legal-doc/LegalDocScreen` | ★LegalDocScreen / KnowledgeDocScreen | pkg-user/legal-docs-hub/index / pkg-mirror/knowledge-doc/index | 🚫 不承载(已判定) | 头注自述为通用静态页(隐私政策/用户协议/Cookie 政策等,packages/app/src/features/legal-doc/LegalDocScreen.tsx:16),是多页共用杠杆而非具体页面,RN 侧亦无壳;小程序端每个具体法律页各有专属共享屏并已镜像(apps/miniapp-taro/src/pkg-about/about/privacy.tsx:4 镜像 privacy)=> 不由小程序端单独承载 |
| 12 | `login/LoginScreen` | ★LoginScreen / ★ScanLoginScreen | — | 🚫 不承载(已判定) | 机主定档小程序端不该有登录页,login 页已整个删除,登录只剩我的 tab 上的弹窗一个宿主(apps/miniapp-taro/src/app.config.ts:17);共享屏是 RN 端 4-tab 完整版(packages/app/src/features/login/LoginScreen.tsx:43),本就不由小程序承载 => not-applicable |
| 13 | `mcp-store/McpStoreScreen` | ★McpStoreScreen | — | 🚫 不承载(已判定) | 该屏是 MCP Server 管理与安装能力,对应 Web /mcp-store(apps/mobile-rn/src/screens/McpStoreScreen.tsx:24),RN 侧入口全在开发者工作台屏(PatrolScreen/RepoWikiScreen/SelfHealingScreen/TeamMemoryScreen),小程序端无对应工作台域,apps/miniapp-taro/src/api/index.ts 无 mcp 端点 => 桌面/开发端专属 |
| 14 | `more-course/MoreCourseScreen` | ★MoreCourseScreen / CourseAnnexScreen | pkg-mirror2/more-course/index / pkg-learn/course/list | 🚫 不承载(已判定) | RN 壳为端内独占课程列表(迁移守门显式豁免 expires 2027-06-30),共享屏全仓零渲染调用方(仅 barrel 导出),孤儿;小程序页承载 @rn-shells 壳本体;2026-11-01 已订正 pkg-mirror2/more-course 页顶声明 |
| 15 | `patrol/PatrolScreen` | ★PatrolScreen | — | 🚫 不承载(已判定) | 2026-11-11 复核: 小程序侧该功能层已于 origin/main 2a4dccdfc7 批量提交 87e5810c29 退役(删除 @rn-shells 镜像声明、miniapp-taro i18n patrol 命名空间五语言键与配套测试);packages/app 屏本体保留供 web/RN 消费,小程序不再承载 ⇒ not-applicable;本行为合并 6e75e15fc8 落地时对侧撤声明的登记补录(门301 未判定/门302p mirrored-decrease 双销账)。 |
| 16 | `plaza-cover/PlazaCoverScreen` | ★PlazaCoverScreen / AigcCoverScreen | pkg-content/plaza/cover/index / pages/plaza/index/index | 🚫 不承载(已判定) | 2026-11-06 复核:小程序无「广场引导封面」页。pkg-content/plaza/cover/index 实为开发者空间(docs/engineering/miniapp-shell-backlog.md:152 已判其原挂 PlazaCoverScreen 为假;本支页顶 :5 述明并改挂 DeveloperScreen,RN DeveloperScreen.tsx:162 真消费)。RN 侧 PlazaCoverScreen 是 plaza 入口封面(cover + features + 进入广场/发布需求),小程序从 pages/plaza/index/index 直接进广场,无该封面页 ⇒ 不承载;registry 原条目已删除。 |
| 17 | `repo-wiki/RepoWikiScreen` | ★RepoWikiScreen | — | 🚫 不承载(已判定) | 2026-11-11 复核: 小程序侧该功能层已于 origin/main 2a4dccdfc7 批量提交 87e5810c29 退役(删除 @rn-shells 镜像声明、miniapp-taro i18n repoWiki 命名空间五语言键与配套测试);packages/app 屏本体保留供 web/RN 消费,小程序不再承载 ⇒ not-applicable;本行为合并 6e75e15fc8 落地时对侧撤声明的登记补录(门301 未判定/门302p mirrored-decrease 双销账)。 |
| 18 | `study-index/StudyIndexScreen` | ★EduChildStudyPlansScreen / ★EduTeacherStudyPlanScreen | pkg-user/edu-child/study-plans/index / pkg-user/edu-teacher-study-plan/index | 🚫 不承载(已判定) | 2026-11-06 复核: 小程序 pages/study/index 页顶 :5 已改挂 study-progress/StudyProgressScreen,页面取 getStudyInfo/getStudyRecords(:12)是学情进度;study-index/StudyIndexScreen 头注自述「AI 视频页」(课程视频预览/双列卡片/赛道 chip, :6-13),两处业务对象 0 交集 ⇒ 不承载该屏;registry 原条目已删除,同一 route 归 StudyProgressScreen。 |
| 19 | `switch-prefs/SwitchPrefsScreen` | — | — | 🚫 不承载(已判定) | 头注自述为通用杠杆屏:packages/app/src/features/switch-prefs/SwitchPrefsScreen.tsx:13-14「通用开关偏好屏 —— 开关型设置页(developer/notifications、developer/settings、settings/preferences 等)的规模化杠杆…本屏纯 UI」;RN 端无同名屏,只有薄壳 apps/mobile-rn/src/screens/DeveloperSettingsScreen.tsx:107 与 DeveloperNotificationsScreen.tsx:90 传 items,故该通用组件屏不该由小程序单页承载。 |
| 20 | `team-knowledge/TeamKnowledgeScreen` | ★TeamKnowledgeScreen / KnowledgeBaseEditScreen | pkg-user/team-workspace/index / pkg-user/knowledge-planet/index | 🚫 不承载(已判定) | 2026-11-11 复核: 小程序侧该功能层已于 origin/main 2a4dccdfc7 批量提交 87e5810c29 退役(删除 @rn-shells 镜像声明、miniapp-taro i18n teamKnowledge 命名空间五语言键与配套测试);packages/app 屏本体保留供 web/RN 消费,小程序不再承载 ⇒ not-applicable;本行为合并 6e75e15fc8 落地时对侧撤声明的登记补录(门301 未判定/门302p mirrored-decrease 双销账)。 |

> 合计 20 条;标 ★ 的是名字完全匹配(仍需核实功能对应)。
> 状态列口径:**🔲 未判定** = 没人验过,需派单取证;**🧱 缺页** = 已验过且小程序端确实没有对应页(应造页);**🚫 不承载** = 已验过且该屏本就不该由小程序承载(不造页);**🏗 已造页** = 该屏已被小程序页显式镜像、已核验**结清**(判据单源 scripts/lib/cross-end-verdicts.mjs),它**不进本表**(本表只收未被镜像的屏),其功能对齐与否一律看文末 evidence 分桶单,不得在本列读成待办。

## 已造页 · 功能对齐分桶(已计入覆盖率)

> 分类依据:台账 `evidence` 里**已显式写出**的裁决前缀(`定档 aligned` / `复核后已修复` / `不构成缺口` / `[no-change-needed]` ⇒ 已闭环;`[blocked-*]` / `[mobile-only]` / `端内已尽可修` ⇒ 需裁决)。**未命中任何标记一律留「真待补」**;不新增判据、不改 `VERDICT_KINDS`,证据过期请改台账 evidence。

> 合计:已造页 97 条 = 已闭环 97 + 需裁决 0 + 真待补 0。只有「真待补」需要按对应共享屏补齐取数/交互/跳转;「已闭环」是台账自己写明的结论,不是本器新判的。
> 侧车 `scripts/data/miniapp-blocked-ledger.jsonl` 只做 join 增列,**不参与分桶**(真相源仍是 evidence 正则,`VERDICT_KINDS` 与 128 行主台账均未改动):登记 0 / 未登记 0 / 坏行 0 / 腐烂 0 / 标签不符 0 / 到期 0 / 重复 0;待产品裁决 0 条(`decidedBy` 空是正常态,本器不替产品拍板)。任一异常都只会让本单多报并保留该行的 blocked 桶,绝不静默放行。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
