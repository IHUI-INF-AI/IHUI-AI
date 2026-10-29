# RN → 小程序 镜像缺口账本(自动生成)

> 判据:与 [check-cross-end-screen-coverage.mjs](../scripts/check-cross-end-screen-coverage.mjs) 同一实现(共享屏被小程序页显式镜像的集合);
> 生成命令:`node scripts/report-rn-miniapp-gaps.mjs --write docs/engineering/rn-miniapp-parity-matrix.md`。
> 候选列只是名字 token 线索(不判定),落地时须按该屏实际字段/接口核实。

- 判定面: **HEAD blob**
- 共享屏(真相源): **271**
- 已被小程序显式镜像: **260**
- 缺口合计: **11**(其中已判定 11 / 未判定 0)
- 判定台账: **105** 行 — 路径与口径单源 `scripts/lib/cross-end-verdicts.mjs`
- 台账三档: **缺页待造 0** / **已造页待补数据钩子 94** / **不承载 11**
> ⚠ 已造页 94 条**已计入上面的覆盖率**,但数据钩子/交互尚未按共享屏补齐 ⇒ 覆盖率不等于功能对齐(§0.3「造好没装车 = 没有」);待补清单见文末「已造页·待补数据钩子」单。

## 缺口清单

| # | 共享屏(域) | RN 候选屏 | 小程序既有页线索 | 状态 | 判定依据 |
|---|---|---|---|---|---|
| 1 | `agent-review-detail/AgentReviewDetailScreen` | AgentDetailScreen / AgentReviewListScreen | pkg-ai/ai/agent-detail / pkg-user/agent-review-list/index | 🚫 不承载(已判定) | 全仓零渲染消费:RN 侧只有 AgentReviewListScreen(列表,渲染共享屏 agent-review-list),无详情入口、无 <AgentReviewDetailScreen,web 侧 apps/web/app/(main) 下无 agents/*/reviews 一类的详情路由,包内也只有类型再导出 ⇒ 镜像它会产出无数据腿的重复页,判不承载;本屏候选下线(零消费)。 |
| 2 | `console-table/ConsoleTableScreen` | — | — | 🚫 不承载(已判定) | packages/app/src/features/console-table/ConsoleTableScreen.tsx:21-25 注释明写「通用控制台列表屏 —— 61 条控制台类页面(models/developer 网关族)的规模化杠杆」,是列配置驱动的通用 UI 杠杆而非一个具体页面;其 RN 消费方为 20 个 edu/developer 薄壳(如 apps/mobile-rn/src/screens/EduGradesScreen.tsx),小程序对应页 apps/miniapp-taro/src/pkg-user/edu-mgmt-grades/index.tsx:5 已各自对齐其 RN 薄壳,不存在也不该造一个「控制台表」页。 |
| 3 | `dashboard/DashboardScreen` | ★DashboardScreen / ★EduDashboardScreen | pkg-user/member-dashboard/index / pkg-user/edu-dashboard/index | 🚫 不承载(已判定) | packages/app/src/features/dashboard/DashboardScreen.tsx:24 是全注入式指标看板(items/renderLoading/renderEmpty 全靠平台注入),RN 壳 apps/mobile-rn/src/screens/DashboardScreen.tsx:60 的数据源是 /api/admin/error-dashboard/stats 管理端错误看板;小程序 app.config.ts 无 admin 页,不由小程序承载,判 not-applicable。 |
| 4 | `domain-hub/DomainHubScreen` | ★DomainHubScreen / EduAiHubScreen | pkg-user/legal-docs-hub/index / pkg-user/pdf-tools-hub/index | 🚫 不承载(已判定) | packages/app/src/features/domain-hub/DomainHubScreen.tsx:16 头注自述跨端共享域入口二级屏(G-921),条目全靠平台注入(DomainHubItem key/label/icon),RN 壳 apps/mobile-rn/src/screens/DomainHubScreen.tsx:19 是 P3 侧边栏收敛用的域入口;小程序 app.config.ts:260-303 只有 5 tab+分包、无侧边栏形态,判通用导航组件屏 not-applicable。 |
| 5 | `finance/FinanceScreen` | ★EduFinanceScreen | pkg-user/edu-mgmt-finance/index | 🚫 不承载(已判定) | 全仓零渲染消费:apps/mobile-rn/src/screens 无任何屏渲染 <FinanceScreen(全量扫 0 命中;RN 的 EduFinanceScreen 用 ConsoleTableScreen),web 的财务页 apps/web/app/(main)/edu/edu-management/finance/page.tsx 对应 EduFinanceScreen(缴费记录)而非本屏四卡汇总,小程序仅 pkg-user/edu-mgmt-finance 注释里提到对齐目标 ⇒ 镜像它会产出无数据腿的重复页,判不承载;本屏候选下线(零消费)。 |
| 6 | `following/FollowingScreen` | — | pkg-user/following/index | 🚫 不承载(已判定) | RN 端关注列表由 follow/FollowScreen 承载:apps/mobile-rn/src/screens/FollowScreen.tsx 渲染 <FollowScreen>(含关注/粉丝 Tab、取消关注),小程序 pkg-user/following/index.tsx 头注写「对齐目标(RN 共享屏): packages/app/src/features/follow/FollowScreen.tsx」但现读是端内手写页(自带 @tarojs/components + @/api/social + useDidShow/useReachBottom)，非镜像 ⇒ 它属手写页待转化面，不是已镜像;本屏在 RN 端零渲染方(全量扫 <FollowingScreen 0 命中)⇒ 镜像它会产出无数据腿的重复页,判不承载。web /following 与 FollowScreen 的等价性另记 web→RN 台账 gap(键空间 following.* vs follow.*)。 |
| 7 | `help-detail/HelpDetailScreen` | ActivityDetailScreen / AgentDetailScreen | pkg-ai/ai/agent-detail / pkg-ai/ai-skill/detail/index | 🚫 不承载(已判定) | RN 端以列表内联展开承载同一阅读目的:packages/app/src/features/help/HelpScreen.tsx:63-65(expandedId 命中即渲染 item.answer),宿主 apps/mobile-rn/src/screens/HelpScreen.tsx:60-78 注入 expandedId/onToggle;本屏是 web 独立详情页(help/[slug]/PageClient.tsx)的投影,RN 端零渲染方(全量扫 <HelpDetailScreen 0 命中)⇒ 小程序镜像它 = 再造一个重复入口,判不承载。 |
| 8 | `legal-doc/LegalDocScreen` | ★LegalDocScreen / KnowledgeDocScreen | pkg-user/legal-docs-hub/index / pkg-mirror/knowledge-doc/index | 🚫 不承载(已判定) | 头注自述为通用静态页(隐私政策/用户协议/Cookie 政策等,packages/app/src/features/legal-doc/LegalDocScreen.tsx:16),是多页共用杠杆而非具体页面,RN 侧亦无壳;小程序端每个具体法律页各有专属共享屏并已镜像(apps/miniapp-taro/src/pkg-about/about/privacy.tsx:4 镜像 privacy)=> 不由小程序端单独承载 |
| 9 | `login/LoginScreen` | ★LoginScreen / ★ScanLoginScreen | — | 🚫 不承载(已判定) | 机主定档小程序端不该有登录页,login 页已整个删除,登录只剩我的 tab 上的弹窗一个宿主(apps/miniapp-taro/src/app.config.ts:17);共享屏是 RN 端 4-tab 完整版(packages/app/src/features/login/LoginScreen.tsx:43),本就不由小程序承载 => not-applicable |
| 10 | `mcp-store/McpStoreScreen` | ★McpStoreScreen | — | 🚫 不承载(已判定) | 该屏是 MCP Server 管理与安装能力,对应 Web /mcp-store(apps/mobile-rn/src/screens/McpStoreScreen.tsx:24),RN 侧入口全在开发者工作台屏(PatrolScreen/RepoWikiScreen/SelfHealingScreen/TeamMemoryScreen),小程序端无对应工作台域,apps/miniapp-taro/src/api/index.ts 无 mcp 端点 => 桌面/开发端专属 |
| 11 | `switch-prefs/SwitchPrefsScreen` | — | — | 🚫 不承载(已判定) | 头注自述为通用杠杆屏:packages/app/src/features/switch-prefs/SwitchPrefsScreen.tsx:13-14「通用开关偏好屏 —— 开关型设置页(developer/notifications、developer/settings、settings/preferences 等)的规模化杠杆…本屏纯 UI」;RN 端无同名屏,只有薄壳 apps/mobile-rn/src/screens/DeveloperSettingsScreen.tsx:107 与 DeveloperNotificationsScreen.tsx:90 传 items,故该通用组件屏不该由小程序单页承载。 |

> 合计 11 条;标 ★ 的是名字完全匹配(仍需核实功能对应)。
> 状态列口径:**🔲 未判定** = 没人验过,需派单取证;**🧱 缺页** = 已验过且小程序端确实没有对应页(应造页);**🚫 不承载** = 已验过且该屏本就不该由小程序承载(不造页);**🏗 已造页** = 页已按声明链造出,数据钩子待补。

## 已造页 · 待补数据钩子(已计入覆盖率,功能尚未跟上)

| # | 共享屏 | 判定依据 |
|---|---|---|
| 1 | `packages/app/src/features/activity-detail/ActivityDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 2 | `packages/app/src/features/agent-chat/AgentChatScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 3 | `packages/app/src/features/agent-create/AgentCreateScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 4 | `packages/app/src/features/agent-market/AgentMarketScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 5 | `packages/app/src/features/agent-review-list/AgentReviewListScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 6 | `packages/app/src/features/agent-setting/AgentSettingScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 7 | `packages/app/src/features/agent-stat/AgentStatScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 8 | `packages/app/src/features/aigc-cover/AigcCoverScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 9 | `packages/app/src/features/ai-multimodal/AIMultimodalScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 10 | `packages/app/src/features/ai-world/AiWorldScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 11 | `packages/app/src/features/assistant/AssistantScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 12 | `packages/app/src/features/automations/AutomationsScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 13 | `packages/app/src/features/bank-card/BankCardScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 14 | `packages/app/src/features/bookmark/BookmarkScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 15 | `packages/app/src/features/cert-apply/CertApplyScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 16 | `packages/app/src/features/cert-detail/CertDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 17 | `packages/app/src/features/certificate/CertificateScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 18 | `packages/app/src/features/cert-list/CertListScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 19 | `packages/app/src/features/cert-verify/CertVerifyScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 20 | `packages/app/src/features/circle-chat/CircleChatScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 21 | `packages/app/src/features/circle-member/CircleMemberScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 22 | `packages/app/src/features/connected-accounts/ConnectedAccountsScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 23 | `packages/app/src/features/connectors/ConnectorsScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 24 | `packages/app/src/features/context/ContextScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 25 | `packages/app/src/features/course-annex/CourseAnnexScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 26 | `packages/app/src/features/course-catalog/CourseCatalogScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 27 | `packages/app/src/features/course-chapter/CourseChapterScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 28 | `packages/app/src/features/course-comment/CourseCommentScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 29 | `packages/app/src/features/course-enroll/CourseEnrollScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 30 | `packages/app/src/features/course-filter/CourseFilterScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 31 | `packages/app/src/features/course-qa-ask/CourseQAAskScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 32 | `packages/app/src/features/course-qa-list/CourseQAListScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 33 | `packages/app/src/features/course-resource/CourseResourceScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 34 | `packages/app/src/features/course-screen/CourseScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 35 | `packages/app/src/features/customer-service/CustomerServiceScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 36 | `packages/app/src/features/exam-history/ExamHistoryScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 37 | `packages/app/src/features/favorites/FavoritesScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 38 | `packages/app/src/features/feedback-detail/FeedbackDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 39 | `packages/app/src/features/feedback/FeedbackHistoryScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 40 | `packages/app/src/features/history/HistoryScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 41 | `packages/app/src/features/home/HomeScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 42 | `packages/app/src/features/image-gen-gallery/ImageGenGalleryScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 43 | `packages/app/src/features/image-gen-history/ImageGenHistoryScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 44 | `packages/app/src/features/image-gen-templates/ImageGenTemplatesScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 45 | `packages/app/src/features/invite/InviteScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 46 | `packages/app/src/features/knowledge-base/KnowledgeBaseScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 47 | `packages/app/src/features/knowledge-base/KnowledgeCreateScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 48 | `packages/app/src/features/knowledge-base/KnowledgeDocScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 49 | `packages/app/src/features/knowledge-planet/KnowledgePlanetScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 50 | `packages/app/src/features/learn/LearnScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 51 | `packages/app/src/features/live-chat/LiveChatScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 52 | `packages/app/src/features/live-playback-screen/LivePlaybackScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 53 | `packages/app/src/features/live-preview/LivePreviewScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 54 | `packages/app/src/features/live/LiveScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 55 | `packages/app/src/features/memory/MemoryScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 56 | `packages/app/src/features/message-chat/MessageChatScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 57 | `packages/app/src/features/message-detail/MessageDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 58 | `packages/app/src/features/message-direct/MessageDirectScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 59 | `packages/app/src/features/message-group/MessageGroupScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 60 | `packages/app/src/features/message-system/MessageSystemScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 61 | `packages/app/src/features/more-course/MoreCourseScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 62 | `packages/app/src/features/note-create/NoteCreateScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 63 | `packages/app/src/features/note-detail/NoteDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 64 | `packages/app/src/features/note-list/NoteListScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 65 | `packages/app/src/features/note/NoteScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 66 | `packages/app/src/features/notification/NotificationListScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 67 | `packages/app/src/features/order-log/OrderLogScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 68 | `packages/app/src/features/order-track/OrderTrackScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 69 | `packages/app/src/features/payment/PaymentScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 70 | `packages/app/src/features/point-rule/PointRuleScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 71 | `packages/app/src/features/points-mall/PointsMallScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 72 | `packages/app/src/features/points-record/PointsRecordScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 73 | `packages/app/src/features/points/PointsScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 74 | `packages/app/src/features/profile-edit/ProfileEditScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 75 | `packages/app/src/features/promote/PromoteScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 76 | `packages/app/src/features/promotion/PromotionScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 77 | `packages/app/src/features/publish/PublishScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 78 | `packages/app/src/features/qr-code/QrCodeScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 79 | `packages/app/src/features/real-name-auth/RealNameAuthScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 80 | `packages/app/src/features/referrer/ReferrerScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 81 | `packages/app/src/features/refund-detail/RefundDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 82 | `packages/app/src/features/security-settings/SecuritySettingsScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 83 | `packages/app/src/features/self-media/SelfMediaScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 84 | `packages/app/src/features/settings-account/SettingsAccountScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 85 | `packages/app/src/features/spec/SpecScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 86 | `packages/app/src/features/square/SquareScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 87 | `packages/app/src/features/study-progress/StudyProgressScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 88 | `packages/app/src/features/sub-package-index/SubPackageIndexScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 89 | `packages/app/src/features/team-detail/TeamDetailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 90 | `packages/app/src/features/topup-fail/TopupFailScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 91 | `packages/app/src/features/usage/UsageScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 92 | `packages/app/src/features/vip-level/VipLevelScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 93 | `packages/app/src/features/wallet/WalletScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |
| 94 | `packages/app/src/features/workflows/WorkflowsScreen.tsx` | 已造页(对账器改档):该屏已被小程序页显式镜像(门 128 尺子命中),台账原写 missing;声明链已建,数据钩子待补 |

> 共 94 条;每条都要按对应共享屏补齐取数/交互/跳转,才算功能真对齐。
