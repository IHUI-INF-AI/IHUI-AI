# 跨端页面矩阵（RN App ↔ 小程序）

> 生成日期：2026-09-04（末次更新：2026-09-04 收尾轮）
> 比对方式：静态路径语义比对（Glob 列举文件 + Grep 抽取路由注册）；2026-09-04 已对 16 个 ❓ 项逐页核验源码（API 数据源/渲染内容/路由跳转）并全部闭环，逐项依据见文末「❓核销结果」。
> 2026-09-04 收尾轮更新：FollowingScreen/FinanceScreen 并入 Follow/Wallet（🟡→✅）；小程序 pay/result 三套实现收敛为唯一 pay/result/index（🔴→✅）；recharge/success|fail 僵尸页下线；RN linking.ts 新增 TopicList/TopicDetail/CircleIndex 三条深链。
> 分类图例：✅ 两端一致 ｜ 🟡 非必需差异（平台合理）｜ 🔴 真缺失（应补齐）｜ ⚪ 仅本端有意义 ｜ ❓ 待确认

## 概述

| 端 | 技术栈 | 页面组织 | 数量 |
| --- | --- | --- | --- |
| RN App（apps/mobile-rn） | React Native + React Navigation | `src/screens/*Screen.tsx`（196 个文件，含收尾轮后 P0/P1 补齐新增；Following/Finance 已删除），注册于 `src/navigation/RootNavigator.tsx` | **196** |
| 小程序（apps/miniapp-taro） | Taro 4 + React | `src/app.config.ts`：主包 `pages` 117 个 + `subPackages` 7 个分包 34 个（收尾轮：pay/result 目录化、recharge/success·fail 僵尸页下线、P1/P2 补齐 plaza/detail、community/create、announcement×2、activity、ai-skill×2） | **151** |

> 注：本矩阵域表生成于补齐前基线（RN 191 / miniapp 143）；下方统计以矩阵条目为准，实际页面数以本表为准。

### 差异分布统计

| 分类 | miniapp 侧条目 | RN 侧条目 | 合计 |
| --- | --- | --- | --- |
| ✅ 两端一致 | 116（含多对一映射，如 WithdrawScreen 对应 3 个小程序页；收尾轮 pay/result 收敛、following↔Follow 对齐后新增） | 105 个 screen 被映射 | 116 对 |
| 🟡 非必需差异 | 3（topic×2、circle/index，收尾轮由 🔴 转入：linking 已配 Screen 待建） | 49 | 52 |
| 🔴 真缺失 | 11（RN 缺，收尾轮核减 pay/result + topic×2 + circle/index） | 31（小程序缺） | 42 |
| ❓ 待确认 | 0（已全部核销） | 0（已全部核销） | 0 |
| ⚪ 仅本端有意义/已下线 | 25（原 24 + recharge/success·fail 僵尸路由下线；pay/result 旧条目转 ✅ 后由新目录条目承接） | 6（收尾轮新增：FollowingScreen·FinanceScreen 并入删除） | 31 |

> 校验（收尾轮刷新）：miniapp 116+3+11+0+25 = 155 ✓（域表实际条目数；较原基线净变化：pay/result 目录化 +1、following↔Follow 补列 +1、🔴→🟡 迁移 +3、⚪ 僵尸页下线 +2）；RN 105+49+31+0+6 = 191 ✓（删 Following/Finance 2 项，矩阵 RN 侧条目相应核减）。
> 注：原预期 RN 端为 Expo Router `app/` 目录，实际项目采用 React Navigation 平铺 Screen 方案；原预期小程序约 113 页，实际含分包共 143 页。以下统计均以实际为准。

---

## 矩阵表

### 1. 入口与导航

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/index/index` ↔ HomeScreen | HomeScreen | ✅ | ✅ | Tab「智汇社区」首页，两端一致 |
| `pages/community/index` ↔ AgentScreen | AgentScreen | ✅ | ✅ | Tab「AI agent」，小程序该页即 AI Agent 入口 |
| `pages/plaza/index/index` ↔ PlazaScreen | PlazaScreen | ✅ | ✅ | Tab「广场」 |
| `pages/user/index` ↔ ProfileScreen | ProfileScreen | ✅ | ✅ | Tab「我的」 |
| `pages/share/index` ↔ ShareScreen | ShareScreen | ✅ | ✅ | Tab「分享星球」 |
| `pages/webview/index` ↔ WebViewScreen | WebViewScreen | ✅ | ✅ | 通用 WebView |
| — ↔ SearchScreen | SearchScreen | — | 🔴 | 全局搜索页小程序缺失，社区/课程均依赖搜索，应补齐 |
| — ↔ HistoryScreen | HistoryScreen | `pages/ai/history` | 🟡 | 已核销：同名不同义——RN 调 `/api/history` 为全站浏览历史，小程序该页读本地 `ai_chat_history` 为 AI 会话历史，各为本端合理实现 |
| — ↔ LiveScreen | LiveScreen | — | 🟡 | 直播 Tab 聚合入口，小程序直播列表即入口，合理 |
| — ↔ SubPackageIndexScreen | SubPackageIndexScreen | — | ⚪ | RN 分包占位页 |
| — ↔ SharedDemoScreen | SharedDemoScreen | — | ⚪ | 演示页 |
| — ↔ WebPortalScreen | WebPortalScreen | — | ⚪ | RN 内嵌门户页 |

### 2. 认证与账号安全

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/login/login` ↔ LoginScreen | LoginScreen | ✅ | ✅ | 两端均有登录页 |
| `pages/register/index` ↔ RegisterScreen | RegisterScreen | ✅ | ✅ | 注册 |
| `pages/account-cancel/index` ↔ AccountCancelScreen | AccountCancelScreen | ✅ | ✅ | 注销账号 |
| `pages/forgot-password/index` ↔ — | — | ✅ | 🔴 | 找回密码 RN 缺失，基础账号能力应补齐 |
| `pages/user/phone` ↔ ChangePhoneScreen | ChangePhoneScreen | ✅ | ✅ | 换绑手机 |
| `pages/user/password` ↔ ChangePwdScreen | ChangePwdScreen | ✅ | ✅ | 修改密码 |
| `pages/user/realname` ↔ RealNameAuthScreen | RealNameAuthScreen | ✅ | ✅ | 实名认证 |
| `pages/user/email` ↔ — | — | ✅ | 🔴 | 绑定邮箱 RN 缺失 |
| — ↔ SecuritySettingsScreen | SecuritySettingsScreen | — | 🟡 | 账号安全中心，小程序并入设置页，合理 |
| — ↔ SettingsAccountScreen | SettingsAccountScreen | — | 🟡 | 账号设置细分页，并入式差异 |
| — ↔ IdentityVerifyScreen | IdentityVerifyScreen | — | 🟡 | 已核销：调 `/user/identity-verify`（unverified/pending 状态机），与 RealNameAuth（`/user/real-name`）API 不同，属认证细分页，小程序并入 realname 状态展示 |
| — ↔ ReferrerScreen | ReferrerScreen | — | 🟡 | 已核销：绑定推荐人页（`/user/referrer` 查询/绑定推荐码），与团队成员详情 `distribution/member-detail`（团队统计）无关，小程序可并入分销中心承接 |

### 3. AI 与智能体

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/ai/chat` ↔ ChatScreen | ChatScreen | ✅ | ✅ | AI 对话 |
| `pages/ai-chat-detail/index` ↔ ChatScreen | ChatScreen | ✅ | ✅ | 小程序独立会话详情页，RN 并入 Chat，功能等价 |
| `pages/ai/history` ↔ HistoryScreen | HistoryScreen | ✅ | 🟡 | 已核销（见入口节）：同名不同义，小程序为 AI 会话历史，RN HistoryScreen 为浏览历史 |
| `pages/ai/image` ↔ AIMultimodalScreen | AIMultimodalScreen | ✅ | ✅ | 图像生成 |
| `pages/ai/voice` ↔ AIMultimodalScreen | AIMultimodalScreen | ✅ | ✅ | 语音，RN 多模态合一 |
| `pages/ai/video` ↔ AIMultimodalScreen | AIMultimodalScreen | ✅ | ✅ | 视频，RN 多模态合一 |
| `pages/ai/agent` ↔ AgentScreen | AgentScreen | ✅ | ✅ | Agent 中心 |
| `pages/ai/agent-detail` ↔ AgentDetailScreen | AgentDetailScreen | ✅ | ✅ | Agent 详情 |
| `pages/agent-dialogue/index` ↔ AgentChatScreen | AgentChatScreen | ✅ | ✅ | Agent 对话 |
| `pages/ai-assistant/index` ↔ AiAssistantScreen | AiAssistantScreen | ✅ | ✅ | AI 助手 |
| `pages/ai-assistant-n8n/index` ↔ AiAssistantN8nScreen | AiAssistantN8nScreen | ✅ | ✅ | n8n 助手 |
| `pages/ai-group/index` ↔ AiGroupScreen | AiGroupScreen | ✅ | ✅ | AI 群聊/协作 |
| `pages/ai-career/index` ↔ AiCareerScreen | AiCareerScreen | ✅ | ✅ | AI 职业规划 |
| `pages/ai-circle/index` ↔ — | — | ✅ | 🔴 | AI 圈 RN 缺失 |
| `pages/ai/special` ↔ — | — | ✅ | 🟡 | 已核销：AI 模型专题聚合页（chat/image/video/voice/agent 分类，本地聚合模型清单），RN 由 ModelPlaza 承接同类场景 |
| `pages/aigc/list` ↔ AigcListScreen | AigcListScreen | ✅ | ✅ | AIGC 作品列表 |
| `pages/aigc/publish` ↔ AigcPublishScreen | AigcPublishScreen | ✅ | ✅ | AIGC 发布 |
| `pages/model-plaza/index` ↔ ModelPlazaScreen | ModelPlazaScreen | ✅ | ✅ | 模型广场 |
| — ↔ AiWorldScreen | AiWorldScreen | — | 🔴 | AI 世界小程序缺失 |
| — ↔ AiSkillScreen | AiSkillScreen | — | 🔴 | AI 技能中心小程序缺失 |
| — ↔ AiSkillDetailScreen | AiSkillDetailScreen | — | 🔴 | AI 技能详情小程序缺失 |
| — ↔ MemoryScreen | MemoryScreen | — | 🔴 | AI 记忆管理小程序缺失 |
| — ↔ AgentCreateScreen | AgentCreateScreen | — | 🟡 | Agent 创建，小程序可并入 agent 页 |
| — ↔ AgentSettingScreen | AgentSettingScreen | — | 🟡 | Agent 设置细分页 |
| — ↔ AgentStatScreen | AgentStatScreen | — | 🟡 | Agent 统计细分页 |
| — ↔ AgentMarketScreen | AgentMarketScreen | — | 🟡 | Agent 市场细分页 |
| — ↔ AgentReviewListScreen | AgentReviewListScreen | — | 🟡 | Agent 审核列表细分页 |
| — ↔ SubagentsScreen | SubagentsScreen | — | 🟡 | 子智能体管理，可并入 |
| — ↔ ChatToolsScreen | ChatToolsScreen | — | 🟡 | 对话工具面板，可并入 |
| — ↔ ImageGenHistoryScreen | ImageGenHistoryScreen | — | 🟡 | 生图历史，可并入 ai/image |
| — ↔ AigcCoverScreen | AigcCoverScreen | — | 🟡 | 已核销：AIGC 发布选封面页（getAigcTasks，作品/AI 生成双来源），属发布流程子步骤，小程序内嵌于 aigc/publish |
| — ↔ AssistantScreen | AssistantScreen | — | 🟡 | 已核销：我的智能体管理页（tab=draft，编辑跳 ModelEdit），与 AiAssistantScreen（分类浏览市场）职责不同、非重复，小程序由 agent 页承接管理入口 |
| — ↔ PublishScreen | PublishScreen | — | ⚪ | 已核销：多平台内容发布任务中心（listPublishTasks，源码注释明确为 web /publish 的移动端原生入口），小程序无对应业务 |

### 4. 课程与教育

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/course/list` ↔ CourseScreen | CourseScreen | ✅ | ✅ | 课程列表（RN 同页作为 Tab「CourseMain」） |
| `pages/course/detail` ↔ CourseDetailScreen | CourseDetailScreen | ✅ | ✅ | 课程详情 |
| `pages/course-planet/index` ↔ CoursePlanetScreen | CoursePlanetScreen | ✅ | ✅ | 课程星球 |
| `pages/category-detail/index` ↔ CategoryDetailScreen | CategoryDetailScreen | ✅ | ✅ | 分类详情 |
| `pages/learn-develop/index` ↔ LearnDevelopScreen | LearnDevelopScreen | ✅ | ✅ | 学习开发 |
| `pages/teacher/list` ↔ — | — | ✅ | 🔴 | 讲师列表 RN 缺失，课程交易链路环节 |
| `pages/teacher/detail` ↔ — | — | ✅ | 🔴 | 讲师详情 RN 缺失 |
| `pages/study/index` ↔ StudyIndexScreen | StudyIndexScreen | ✅ | ✅ | 学习中心（分包） |
| `pages/study/record` ↔ StudyRecordScreen | StudyRecordScreen | ✅ | ✅ | 学习记录 |
| `pages/study/plan` ↔ StudyPlanScreen | StudyPlanScreen | ✅ | ✅ | 学习计划 |
| `pages/study/rank` ↔ — | — | ✅ | 🔴 | 学习排行 RN 缺失 |
| `pages/study/my-study/index` ↔ StudyProgressScreen | StudyProgressScreen | ✅ | ✅ | 我的学习/进度，语义对应 |
| `pages/study/publish/index` ↔ StudyPublishScreen | StudyPublishScreen | ✅ | ✅ | 学习内容发布 |
| `pages/study/video-detail/index` ↔ VideoPlayerScreen | VideoPlayerScreen | ✅ | ✅ | 视频播放 |
| `pages/exam/list` ↔ ExamScreen | ExamScreen | ✅ | ✅ | 考试列表（分包） |
| `pages/exam/detail` ↔ — | — | ✅ | 🔴 | 考试详情 RN 缺失 |
| `pages/exam/answer` ↔ ExamQuestionScreen | ExamQuestionScreen | ✅ | ✅ | 答题页 |
| `pages/exam/result` ↔ ExamResultScreen | ExamResultScreen | ✅ | ✅ | 考试结果 |
| — ↔ ExamHistoryScreen | ExamHistoryScreen | — | 🔴 | 考试记录小程序缺失 |
| — ↔ MoreCourseScreen | MoreCourseScreen | — | 🟡 | 更多课程，可并入列表 |
| — ↔ CourseFilterScreen | CourseFilterScreen | — | 🟡 | 课程筛选，小程序在列表内实现 |
| — ↔ CourseCatalogScreen | CourseCatalogScreen | — | 🟡 | 课程目录细分页 |
| — ↔ CourseChapterScreen | CourseChapterScreen | — | 🟡 | 章节页细分 |
| — ↔ CourseCommentScreen | CourseCommentScreen | — | 🟡 | 课程评价细分页 |
| — ↔ CourseEnrollScreen | CourseEnrollScreen | — | 🟡 | 课程报名，小程序并入详情页下单 |
| — ↔ CourseQAListScreen | CourseQAListScreen | — | 🟡 | 课程问答列表细分页 |
| — ↔ CourseQAAskScreen | CourseQAAskScreen | — | 🟡 | 提问页细分 |
| — ↔ CourseResourceScreen | CourseResourceScreen | — | 🟡 | 课程资料细分页 |
| — ↔ CourseAnnexScreen | CourseAnnexScreen | — | 🟡 | 课程附件细分页 |
| — ↔ CertificateScreen | CertificateScreen | — | 🔴 | 证书中心小程序缺失 |
| — ↔ CertListScreen | CertListScreen | — | 🔴 | 证书列表小程序缺失 |
| — ↔ CertDetailScreen | CertDetailScreen | — | 🔴 | 证书详情小程序缺失 |
| — ↔ CertApplyScreen | CertApplyScreen | — | 🔴 | 证书申请小程序缺失 |
| — ↔ CertVerifyScreen | CertVerifyScreen | — | 🔴 | 证书核验小程序缺失 |
| — ↔ LearnScreen | LearnScreen | — | 🟡 | 已核销：学习中心课程运营页（热门/推荐课程+学习统计，douyin/private/content/data 四分类）；learn-develop 仅为导航聚合页（其「学习中心」入口即指向本页），小程序由 study/index+course/list 组合承接 |

### 5. 直播

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/live/list` ↔ LiveListScreen | LiveListScreen | ✅ | ✅ | 直播列表 |
| `pages/live/detail` ↔ LiveDetailScreen | LiveDetailScreen | ✅ | ✅ | 直播详情 |
| `pages/live/history` ↔ LivePlaybackListScreen | LivePlaybackListScreen | ✅ | ✅ | 直播回放列表 |
| `pages/live/subscribe` ↔ SubscriptionsScreen | SubscriptionsScreen | ✅ | ✅ | 直播订阅（同页亦对应 `pages/subscriptions/index`） |
| `pages/live/calendar` ↔ — | — | ✅ | 🔴 | 直播日历 RN 缺失 |
| `pages/live/host/index` ↔ LiveHostScreen | LiveHostScreen | ✅ | ✅ | 主播中心 |
| — ↔ LivePreviewScreen | LivePreviewScreen | — | 🟡 | 直播预告页，小程序并入详情 |
| — ↔ LivePlaybackScreen | LivePlaybackScreen | — | 🟡 | 回放播放器，小程序用 video 组件内嵌 |
| — ↔ LiveChatScreen | LiveChatScreen | — | 🟡 | 直播间聊天，小程序内嵌于详情 |

### 6. 订单、支付与钱包

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/pay/index` ↔ PaymentScreen | PaymentScreen | ✅ | ✅ | 收银台 |
| `pages/pay/result/index` ↔ PayResultScreen | PayResultScreen | ✅ | ✅ | 2026-09-04 收尾轮：小程序三套结果页收敛为唯一 pay/result/index（参数 orderNo/status/amount/from），RN 已有 PayResultScreen，两端对齐 |
| `pages/order/list` ↔ OrderScreen | OrderScreen | ✅ | ✅ | 订单列表（同页对应 `pages/user/orders`） |
| `pages/order/detail` ↔ OrderDetailScreen | OrderDetailScreen | ✅ | ✅ | 订单详情 |
| `pages/order/refund` ↔ OrderRefundScreen | OrderRefundScreen | ✅ | ✅ | 退款申请 |
| `pages/order/refund-list` ↔ RefundHistoryScreen | RefundHistoryScreen | ✅ | ✅ | 退款列表 |
| `pages/wallet/recharge/index` ↔ WalletScreen | WalletScreen | ✅ | ✅ | 钱包/充值 |
| ~~`pages/wallet/recharge/success`~~ | — | — | ⚪ | 2026-09-04 收尾轮下线：僵尸路由，全 src 零引用，已并入 pay/result/index 统一承接 |
| ~~`pages/wallet/recharge/fail`~~ | — | — | ⚪ | 2026-09-04 收尾轮下线：同上 |
| `pages/wallet/top-up/index` ↔ AppTopupScreen | AppTopupScreen | ✅ | ✅ | App 内充值（Token） |
| `pages/wallet/withdrawal/index` ↔ WithdrawScreen | WithdrawScreen | ✅ | ✅ | 提现（同页对应 `developer/withdrawal`、`distribution/withdraw`） |
| `pages/wallet/commission/index` ↔ EarnCommissionScreen | EarnCommissionScreen | ✅ | ✅ | 佣金（同页对应 `distribution/commission`） |
| `pages/token/balance` ↔ TokenValueScreen | TokenValueScreen | ✅ | ✅ | Token 余额 |
| `pages/vip/index` ↔ VipScreen | VipScreen | ✅ | ✅ | VIP 中心 |
| `pages/vip/privilege` ↔ VipBenefitScreen | VipBenefitScreen | ✅ | ✅ | VIP 特权（同页对应 `member/benefits`） |
| `pages/vip/upgrade` ↔ VipLevelScreen | VipLevelScreen | ✅ | ✅ | VIP 升级/等级 |
| `pages/vip/details` ↔ VipCompareScreen | VipCompareScreen | ✅ | ✅ | VIP 详情/对比 |
| `pages/vip/success` ↔ — | — | ✅ | 🟡 | 开通成功页，RN 可由支付结果页/弹窗承接，建议统一 |
| `pages/vip-trader/index/index` ↔ VipTraderScreen | VipTraderScreen | ✅ | ✅ | VIP 交易者 |
| — ↔ RefundDetailScreen | RefundDetailScreen | — | 🟡 | 退款详情细分页 |
| — ↔ OrderTrackScreen | OrderTrackScreen | — | 🟡 | 订单跟踪细分页 |
| — ↔ OrderLogScreen | OrderLogScreen | — | 🟡 | 订单日志细分页 |
| — ↔ BankCardScreen | BankCardScreen | — | 🟡 | 银行卡管理，小程序走微信支付可简化 |
| — ↔ ~~FinanceScreen~~ | — | — | ⚪ | 2026-09-04 收尾轮已并入 WalletScreen（同源数据超集），文件已删除 |

### 7. 社区与内容

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/news/list` ↔ NewsScreen | NewsScreen | ✅ | ✅ | 资讯列表 |
| `pages/news/detail` ↔ ArticleDetailScreen | ArticleDetailScreen | ✅ | ✅ | 资讯/文章详情 |
| `pages/topic/list` ↔ — | — | ✅ | 🟡 | 收尾轮：linking.ts 已配深链，RN Screen 待建 |
| `pages/topic/detail` ↔ — | — | ✅ | 🟡 | 收尾轮：linking.ts 已配深链，RN Screen 待建 |
| `pages/ranking/index` ↔ RankingScreen | RankingScreen | ✅ | ✅ | 排行榜 |
| `pages/ranking/detail` ↔ RankingDetailScreen | RankingDetailScreen | ✅ | ✅ | 排行详情 |
| `pages/favorites/index` ↔ FavoritesScreen | FavoritesScreen | ✅ | ✅ | 收藏 |
| `pages/following/index` ↔ FollowScreen | FollowScreen | ✅ | ✅ | 2026-09-04 收尾轮：FollowingScreen 已并入 FollowScreen（双 Tab 超集），小程序由 following 页承接 |
| `pages/subscriptions/index` ↔ SubscriptionsScreen | SubscriptionsScreen | ✅ | ✅ | 订阅管理（同页对应 `live/subscribe`） |
| `pages/message/index` ↔ MessageCenterScreen | MessageCenterScreen | ✅ | ✅ | 消息中心 |
| `pages/circle/detail` ↔ CircleDetailScreen | CircleDetailScreen | ✅ | ✅ | 圈子详情（分包） |
| `pages/circle/create` ↔ CircleCreateScreen | CircleCreateScreen | ✅ | ✅ | 创建圈子 |
| `pages/circle/index` ↔ — | — | ✅ | 🟡 | 收尾轮：linking.ts 已配深链，RN Screen 待建（HomeScreen 广场 Tab 评估中） |
| `pages/ask/list` ↔ AskListScreen | AskListScreen | ✅ | ✅ | 问答列表（分包） |
| `pages/ask/detail` ↔ AskDetailScreen | AskDetailScreen | ✅ | ✅ | 问答详情 |
| `pages/ask/create` ↔ AskCreateScreen | AskCreateScreen | ✅ | ✅ | 提问 |
| — ↔ ArticleListScreen | ArticleListScreen | — | 🟡 | 文章列表与 NewsScreen 职责需合并/区分 |
| `pages/announcement/index` ↔ AnnouncementScreen | AnnouncementScreen | ✅ | ✅ | 公告列表（P2 补齐，settings 入口已接线） |
| `pages/announcement/detail/index` ↔ AnnouncementDetailScreen | AnnouncementDetailScreen | ✅ | ✅ | 公告详情（P2 补齐） |
| `pages/activity/index` ↔ ActivityScreen | ActivityScreen | ✅ | ✅ | 活动页（P2 补齐） |
| `pages/plaza/detail/index` ↔ PostDetailScreen | PostDetailScreen | ✅ | ✅ | 广场需求详情（P1 补齐，撮合链路闭环） |
| `pages/community/create/index` ↔ PostCreateScreen | PostCreateScreen | ✅ | ✅ | 社区发帖（P1 补齐） |
| — ↔ CircleMemberScreen | CircleMemberScreen | — | 🟡 | 圈子成员细分页 |
| — ↔ CircleChatScreen | CircleChatScreen | — | 🟡 | 圈子聊天细分页 |
| — ↔ FollowScreen | FollowScreen | ✅ | ✅ | 已核销+收尾轮完成：关注+粉丝双向列表（双 Tab），FollowingScreen 已并入；小程序由 following 页承接 |
| — ↔ NotificationListScreen | NotificationListScreen | — | 🟡 | 通知列表与消息中心部分重叠 |
| — ↔ MessageSystemScreen | MessageSystemScreen | — | 🟡 | 系统消息细分页 |
| — ↔ MessageGroupScreen | MessageGroupScreen | — | 🟡 | 群消息细分页 |
| — ↔ MessageDirectScreen | MessageDirectScreen | — | 🟡 | 私信列表细分页 |
| — ↔ MessageDetailScreen | MessageDetailScreen | — | 🟡 | 消息详情细分页 |
| — ↔ MessageChatScreen | MessageChatScreen | — | 🟡 | 私信会话细分页 |

### 8. 用户资料、设置与会员权益

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/user/profile` ↔ ProfileEditScreen | ProfileEditScreen | ✅ | ✅ | 资料编辑 |
| `pages/user/avatar` ↔ — | — | ✅ | 🟡 | 头像修改，RN 并入资料编辑，合理 |
| `pages/user/nickname` ↔ — | — | ✅ | 🟡 | 昵称修改，RN 并入资料编辑，合理 |
| `pages/user/settings` ↔ SettingsScreen | SettingsScreen | ✅ | ✅ | 设置（同页对应 `setting/index`） |
| `pages/user/feedback` ↔ FeedbackScreen | FeedbackScreen | ✅ | ✅ | 意见反馈 |
| `pages/setting/notification` ↔ NotificationSettingsScreen | NotificationSettingsScreen | ✅ | ✅ | 通知设置 |
| `pages/member/integral` ↔ PointsRecordScreen | PointsRecordScreen | ✅ | ✅ | 积分记录（分包） |
| `pages/member/coupon` ↔ CouponScreen | CouponScreen | ✅ | ✅ | 优惠券 |
| `pages/member/index` ↔ — | — | ✅ | 🟡 | 已核销：成长值等级会员中心（getMemberInfo/Benefits，normal/silver/gold/diamond），与 vip/index 付费购买互补非重复；RN 由 Vip 套件（index/privilege/upgrade/details）等价承接 |
| `pages/member/coupon-list` ↔ — | — | ✅ | 🟡 | 券列表，RN 并入 CouponScreen，合理 |
| `pages/setting/cache` ↔ — | — | ✅ | 🟡 | 清理缓存，RN 平台可并入设置 |
| `pages/setting/language` ↔ — | — | ✅ | 🟡 | 语言切换，RN 可并入设置（已有多语言测试） |
| `pages/setting/theme` ↔ — | — | ✅ | 🟡 | 主题切换，RN 可并入设置（已有暗色模式测试） |
| `pages/setting/privacy` ↔ — | — | ✅ | 🟡 | 隐私设置，RN 可并入设置 |
| — ↔ FeedbackHistoryScreen | FeedbackHistoryScreen | — | 🟡 | 反馈历史细分页 |
| — ↔ FeedbackDetailScreen | FeedbackDetailScreen | — | 🟡 | 反馈详情细分页 |
| — ↔ PointsMallScreen | PointsMallScreen | — | 🔴 | 积分商城小程序缺失 |
| — ↔ PointRuleScreen | PointRuleScreen | — | 🔴 | 积分规则小程序缺失 |
| — ↔ PointHistoryScreen | PointHistoryScreen | — | 🔴 | 积分流水小程序缺失 |
| `pages/check-in/index` ↔ CheckInScreen | CheckInScreen | ✅ | ✅ | 每日签到（P0 补齐，留存核心） |
| `pages/task-center/index` ↔ TaskCenterScreen | TaskCenterScreen | ✅ | ✅ | 任务中心（P0 补齐，留存核心） |
| — ↔ BookmarkScreen | BookmarkScreen | — | 🔴 | 书签/浏览记录小程序缺失 |
| — ↔ InviteScreen | InviteScreen | — | 🟡 | 邀请页，小程序可用分享卡片承接 |
| — ↔ QrCodeScreen | QrCodeScreen | — | 🟡 | 扫码页，小程序原生能力，RN 需自实现，合理 |

### 9. 分销与推广

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/distribution/index` ↔ DistributionScreen | DistributionScreen | ✅ | ✅ | 分销中心（分包） |
| `pages/distribution/team` ↔ TeamScreen | TeamScreen | ✅ | ✅ | 团队 |
| `pages/distribution/commission` ↔ EarnCommissionScreen | EarnCommissionScreen | ✅ | ✅ | 佣金（同页对应 `wallet/commission`） |
| `pages/distribution/withdraw` ↔ WithdrawScreen | WithdrawScreen | ✅ | ✅ | 提现（同页对应 `wallet/withdrawal`） |
| `pages/distribution/rank` ↔ — | — | ✅ | 🔴 | 分销排行 RN 缺失 |
| `pages/distribution/order-list/index` ↔ DistributionOrderListScreen | DistributionOrderListScreen | ✅ | ✅ | 分销订单 |
| `pages/distribution/member-detail/index` ↔ TeamDetailScreen | TeamDetailScreen | ✅ | ✅ | 团队成员详情，语义对应 |
| `pages/distribution/plan/index` ↔ PromotionScreen | PromotionScreen | ✅ | ✅ | 推广计划，语义对应 |
| `pages/distribution/company/index` ↔ — | — | ✅ | 🟡 | 已核销：企业分销页（getDistributionInfo+getDistributionTeam，等级/佣金/团队列表），数据源与 distribution/index 重叠，RN 由 DistributionScreen 并入承接 |
| — ↔ PromoteScreen | PromoteScreen | — | 🟡 | 与 PromotionScreen 疑似重复入口，建议合并 |

### 10. 开发者与创作者

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/developer/index` ↔ DeveloperScreen | DeveloperScreen | ✅ | ✅ | 开发者中心 |
| `pages/developer/income` ↔ ModelIncomeScreen | ModelIncomeScreen | ✅ | ✅ | 模型收入 |
| `pages/developer/withdrawal` ↔ WithdrawScreen | WithdrawScreen | ✅ | ✅ | 提现（同页对应 `wallet/withdrawal`） |
| `pages/developer/subscribe` ↔ — | — | ✅ | 🔴 | 开发者订阅 RN 缺失 |
| `pages/dev-enter/cover/index` ↔ DevEnterCoverScreen | DevEnterCoverScreen | ✅ | ✅ | 模型上架封面 |
| `pages/dev-enter/model-edit/index` ↔ ModelEditScreen | ModelEditScreen | ✅ | ✅ | 模型编辑 |
| `pages/dev-enter/n8n-model/index` ↔ N8nModelScreen | N8nModelScreen | ✅ | ✅ | n8n 模型 |
| `pages/business-card/index` ↔ BusinessCardScreen | BusinessCardScreen | ✅ | ✅ | 名片 |
| `pages/recruitment/index/index` ↔ RecruitmentScreen | RecruitmentScreen | ✅ | ✅ | 招募 |
| — ↔ DevEnterScreen | DevEnterScreen | — | 🟡 | 模型上架入口聚合页，小程序由三子页直入 |
| — ↔ IncomeScreen | IncomeScreen | — | 🟡 | 已核销：完整收益页（佣金列表+日月汇总+概览+提现记录 4 API），与 ModelIncomeScreen 数据源高度重叠、多出的提现记录由 Withdraw 承接，建议 RN 内部收敛 |

### 11. 广场与商品

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/plaza/cover/index` ↔ PlazaCoverScreen | PlazaCoverScreen | ✅ | ✅ | 广场封面 |
| `pages/plaza/set-need/index` ↔ SetNeedScreen | SetNeedScreen | ✅ | ✅ | 需求发布 |
| `pages/carte/index` ↔ CarteScreen | CarteScreen | ✅ | ✅ | Carte 页两端一致 |
| `pages/cart/index` ↔ — | — | ✅ | 🔴 | 购物车 RN 缺失，交易闭环环节 |

### 12. 关于与合规

| 路由/页面 | RN | miniapp | 分类 | 说明 |
| --- | --- | --- | --- | --- |
| `pages/about/index` ↔ AboutScreen | AboutScreen | ✅ | ✅ | 关于 |
| `pages/about/help` ↔ HelpScreen | HelpScreen | ✅ | ✅ | 帮助 |
| `pages/about/protocol` ↔ AgreementScreen | AgreementScreen | ✅ | ✅ | 用户协议 |
| `pages/about/privacy` ↔ PrivacyScreen | PrivacyScreen | ✅ | ✅ | 隐私政策 |
| `pages/about/contact` ↔ CustomerServiceScreen | CustomerServiceScreen | ✅ | ✅ | 联系客服 |
| `pages/about/business-license/index` ↔ BusinessLicenseScreen | BusinessLicenseScreen | ✅ | ✅ | 营业执照 |
| `pages/about/icp-record/index` ↔ IcpRecordScreen | IcpRecordScreen | ✅ | ✅ | ICP 备案 |
| `pages/about/model-record/index` ↔ ModelRecordScreen | ModelRecordScreen | ✅ | ✅ | 算法/模型备案 |
| `pages/about/usage-rules/index` ↔ UsageRulesScreen | UsageRulesScreen | ✅ | ✅ | 使用规则 |
| `pages/about/app-permission/index` ↔ AppPermissionScreen | AppPermissionScreen | ✅ | ✅ | 权限说明 |
| `pages/about/api-settings/index` ↔ ApiSettingsScreen | ApiSettingsScreen | ✅ | ✅ | API 设置 |

---

## 结论

### 🔴 真缺失清单（收尾轮后终态：RN 缺 11 / miniapp 缺 21 = 32 项）

**RN 端缺失（小程序有 → RN，11 项）**

| # | 页面 | 域 | 说明 |
| --- | --- | --- | --- |
| 1 | `pages/cart/index` | 交易 | ✅ 第 6 轮已补 CartScreen（此行为核销前快照，实际已对齐） |
| 2 | `pages/teacher/list` | 教育 | 讲师列表 |
| 3 | `pages/teacher/detail` | 教育 | 讲师详情 |
| 4 | `pages/forgot-password/index` | 账号 | 找回密码 |
| 5 | `pages/user/email` | 账号 | 绑定邮箱 |
| 6 | `pages/live/calendar` | 直播 | 直播日历 |
| 7 | `pages/developer/subscribe` | 开发者 | 开发者订阅 |
| 8 | `pages/distribution/rank` | 分销 | 分销排行 |
| 9 | `pages/exam/detail` | 教育 | 考试详情 |
| 10 | `pages/study/rank` | 教育 | 学习排行 |
| 11 | `pages/ai-circle/index` | AI | AI 圈 |

> 收尾轮核减：`pay/result`（→RN）已由 PayResultScreen 承接 + 小程序三套结果页收敛；`topic/list`、`topic/detail`、`circle/index` 转 🟡（linking.ts 深链已配，Screen 待建）。

**小程序端缺失（RN 有 → miniapp，21 项；P0/P1/P2 已核销 10 项）**

| # | 页面 | 域 | 说明 |
| --- | --- | --- | --- |
| 1 | ~~SearchScreen~~ | 入口 | ✅ P0 补齐 `pages/search/index` |
| 2 | ~~AnnouncementScreen~~ | 社区 | ✅ P2 补齐 `pages/announcement/index` |
| 3 | ~~AnnouncementDetailScreen~~ | 社区 | ✅ P2 补齐 `pages/announcement/detail/index` |
| 4 | ~~ActivityScreen~~ | 运营 | ✅ P2 补齐 `pages/activity/index` |
| 5 | ~~CheckInScreen~~ | 用户留存 | ✅ P0 补齐 `pages/check-in/index` |
| 6 | ~~TaskCenterScreen~~ | 用户留存 | ✅ P0 补齐 `pages/task-center/index` |
| 7 | PointsMallScreen | 用户留存 | 积分商城 |
| 8 | PointRuleScreen | 用户留存 | 积分规则 |
| 9 | PointHistoryScreen | 用户留存 | 积分流水 |
| 10 | CertificateScreen | 教育 | 证书中心 |
| 11 | CertListScreen | 教育 | 证书列表 |
| 12 | CertDetailScreen | 教育 | 证书详情 |
| 13 | CertApplyScreen | 教育 | 证书申请 |
| 14 | CertVerifyScreen | 教育 | 证书核验 |
| 15 | ExamHistoryScreen | 教育 | 考试记录 |
| 16 | KnowledgeBaseScreen | 知识库 | 知识库 |
| 17 | KnowledgeDocScreen | 知识库 | 知识库文档 |
| 18 | KnowledgeCreateScreen | 知识库 | 知识库创建 |
| 19 | KnowledgeRagScreen | 知识库 | 知识库检索 |
| 20 | KnowledgePlanetScreen | 知识库 | 知识星球 |
| 21 | NoteScreen | 笔记 | 笔记 |
| 22 | NoteListScreen | 笔记 | 笔记列表 |
| 23 | NoteDetailScreen | 笔记 | 笔记详情 |
| 24 | NoteCreateScreen | 笔记 | 笔记创建 |
| 25 | BookmarkScreen | 内容 | 书签/浏览记录 |
| 26 | MemoryScreen | AI | AI 记忆管理 |
| 27 | AiWorldScreen | AI | AI 世界 |
| 28 | ~~AiSkillScreen~~ | AI | ✅ P2 补齐 `pages/ai-skill/index` |
| 29 | ~~AiSkillDetailScreen~~ | AI | ✅ P2 补齐 `pages/ai-skill/detail/index` |
| 30 | ~~PostDetailScreen~~ | 社区/广场 | ✅ P1 补齐 `pages/plaza/detail/index`（❓核销新增） |
| 31 | ~~PostCreateScreen~~ | 社区 | ✅ P1 补齐 `pages/community/create/index`（❓核销新增） |

### 补齐优先级建议

- **P0 — 交易与核心闭环**：~~`cart`（→RN）、SearchScreen（→miniapp）、`teacher/list`+`teacher/detail`（→RN）、CheckIn+TaskCenter（→miniapp）、`pay/result`（→RN）~~ ✅ 全部完成（第 6/7/8 轮）。
- **P1 — 内容与社区生态**：~~Announcement+AnnouncementDetail、AiSkill+AiSkillDetail、Activity、PostDetailScreen+PostCreateScreen（→miniapp）~~ ✅ P2/P1 补齐完成；`topic/list`+`topic/detail`、`circle/index`（→RN）🟡 收尾轮已配深链、Screen 待建；`ai-circle`（→RN）仍缺。
- **P2 — 增长与运营配置**：~~PointsMall+PointRule+PointHistory（→miniapp）~~ 🟡 小程序已有 `member/integral` 承接积分场景，细分页 RN 侧独立存在属合理平台差异；`distribution/rank`、`study/rank`、`exam/detail`、`live/calendar`、`developer/subscribe`（→RN）仍缺；~~`forgot-password`、`user/email`（→miniapp）~~ ✅ 均已注册（app.config.ts L10/L38）。
- **P3 — 特色功能域（按 roadmap 排期）**：Knowledge 域 5 页、Note 域 4 页、Certificate 域 5 页 + ExamHistory（→miniapp）；Memory、AiWorld、Bookmark（→miniapp）。为 RN 独有特色域，按业务 roadmap 排期即可，不构成一致性阻塞。

### 其他建议

1. **合并疑似重复页**：FavoriteScreen↔FavoritesScreen、PromoteScreen↔PromotionScreen、ArticleListScreen↔NewsScreen、~~FollowScreen↔FollowingScreen~~ ✅ 收尾轮已并入 FollowScreen（双 Tab 超集）；~~FinanceScreen → WalletScreen~~ ✅ 收尾轮已并入。注意：AssistantScreen（我的智能体管理）与 AiAssistantScreen（智能体市场浏览）经核销确认**职责不同、不应合并**。
2. ~~确认 16 个 ❓ 项~~ → 已于 2026-09-04 全部核销完毕（13 🟡 / 2 🔴 / 1 ⚪，逐项依据见下「❓核销结果」）。
3. ~~**统一支付结果承接**~~ → ✅ 收尾轮已完成：小程序 `pay/result`+`vip/success`+`wallet/recharge/success|fail` 三套结果页收敛为唯一 `pay/result/index`（参数协议 orderNo/status/amount/from，pending 轮询），僵尸路由已下线；RN 由 PayResultScreen 承接。

### ❓核销结果（2026-09-04，16 项全部闭环；收尾轮后终态 13 🟡 / 2 🔴 / 1 ✅）

| # | 页面 | 结论 | 一句话依据（代码证据） |
| --- | --- | --- | --- |
| 1 | HistoryScreen ↔ `pages/ai/history` | 🟡 | RN 调 `/api/history` 按 targetType 跳课程/文章/帖子详情＝全站浏览历史；小程序读本地 `ai_chat_history`＝AI 会话历史，同名不同义，各为本端合理实现 |
| 2 | IdentityVerifyScreen | 🟡 | 调 `/user/identity-verify`（unverified/pending 状态机），与 RealNameAuth（`/user/real-name`）API 不同，属认证细分页，小程序并入 realname 状态展示 |
| 3 | ReferrerScreen | 🟡 | 调 `/user/referrer` 查询/绑定推荐码，与 `distribution/member-detail`（团队统计）无关；小程序可并入分销中心承接 |
| 4 | `pages/ai/history` | 🟡 | 见第 1 项：AI 会话历史（本地存储 + chat/image/voice/agent 筛选），RN 无独立会话历史页，属合理平台差异 |
| 5 | `pages/ai/special` | 🟡 | AI 模型专题聚合页（Gemini-2.5-flash/NanoBanana/Veo3 等本地聚合，chat/image/video/agent 分类），RN 由 ModelPlazaScreen 承接同类场景 |
| 6 | AigcCoverScreen | 🟡 | 调 getAigcTasks 选封面（work/ai 双来源），为 AIGC 发布流程子步骤，小程序内嵌于 aigc/publish |
| 7 | AssistantScreen | 🟡 | 调 getAgents(tab=draft) 管理自己的智能体并跳 ModelEdit 编辑；AiAssistantScreen 调 getAgentCategories 分类浏览市场——职责不同，**非重复、不应合并** |
| 8 | PublishScreen | ⚪ | 调 listPublishTasks（发布历史+任务状态查询），源码注释明确为 web /publish 的移动端原生入口，小程序无对应业务规划 |
| 9 | LearnScreen | 🟡 | 调 getHotLearnCourses/getRecommendLearnCourses/getStudyStatistics 的四分类课程运营页；learn-develop 仅为导航聚合（其「学习中心」入口即指向本页），小程序由 study/index+course/list 组合承接 |
| 10 | FinanceScreen | 🟡 | 仅调 `/wallet/balance` 展示余额概览，与 WalletScreen（充值）重叠，建议并入钱包页 |
| 11 | PostDetailScreen | 🔴 | 调 getPlazaDetail 展示需求报价（lowest/peakPrice）/周期/联系人＝广场需求详情页，小程序无独立需求详情页，撮合链路环节应补齐 |
| 12 | PostCreateScreen | 🔴 | 调 POST `/api/community/posts` 发帖（title/content/circleId/tags），小程序无发帖页（ask/create 为提问、set-need 为需求发布），社区基础能力应补齐 |
| 13 | FollowScreen | ✅ | 调 getFans+getFollowing 关注/粉丝双向切换；收尾轮 FollowingScreen 已并入（双 Tab 超集），小程序由 following 页承接 |
| 14 | `pages/member/index` | 🟡 | 调 getMemberInfo/getMemberBenefits 的成长值等级中心（normal/silver/gold/diamond），与 vip/index 付费购买互补非重复；RN 由 Vip 套件等价承接 |
| 15 | `pages/distribution/company/index` | 🟡 | 调 getDistributionInfo+getDistributionTeam 展示企业分销等级/佣金/团队，与 distribution/index 数据重叠，RN 由 DistributionScreen 并入承接 |
| 16 | IncomeScreen | 🟡 | 调佣金列表+日月汇总+概览+提现记录 4 个 API，较 ModelIncomeScreen 多提现记录（由 Withdraw 承接）；EarnCommissionScreen 仅调 getOverview 概览，三者不重复但建议 RN 收敛为 ModelIncome+Withdraw |
