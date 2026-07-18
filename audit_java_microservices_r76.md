# Java 22 微服务迁移审计报告 (R76 2026-07-19)

## 环境限制

D 盘不可访问,基于已知 Java 服务名 + TS 端点结构做单向审计

## TS 路由结构 (apps/api/src/routes)

### 量化指标

- **TS 路由源文件** (排除 `*.test.ts`): **184 个** (顶层 + 子目录)
  - 顶层文件: ~155 个
  - `admin/` 子目录: 30 个 (admin 子模块细分)
  - `ai-vendors/` 子目录: 5 个 (AI 厂商代理)
  - `community/` 子目录: 4 个 (circles/posts/asks/topics)
- **测试文件**: 60+ 个 (在 `__tests__/` 目录)
- **server.get/server.post 等方法调用总次数**: **2628+ 处**,分布在前端路由文件 199 个 (含 test)
- _*核心非测试路由文件 server.* 调用__: 2546 处 (2628 - 82 fastify._ 调用)

### 主要命名空间 (按 server.ts 中的 prefix 注册,共 90+ 个)

| 命名空间                                                               | 注册文件                                                                          | 备注                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| `/api/admin`                                                           | adminRoutes/i18n-dashboard/audit/adminSys/adminExtended/adminContentOps 等 20+ 个 | 管理员后台统一入口                      |
| `/api/auth`                                                            | authRoutes/authSso/auth-extended/auth-identity                                    | 多模式登录                              |
| `/api/users`                                                           | usersRoutes                                                                       | 用户 CRUD                               |
| `/api/agent`                                                           | agenticServiceRoutes/agentsRoutes/agentRuntimeRoutes                              | Agent 服务                              |
| `/api/agent-ext`                                                       | agentExtendedRoutes                                                               | 旧架构补建 (need_task/upload/usedetail) |
| `/api/ai`                                                              | aiVendor/aiAudio/aiUserModelChat/aiChatStream/aiExtended                          | AI 厂商 + 多模态                        |
| `/api/ai-ext`                                                          | aiExtendedRoutes                                                                  | AI 扩展                                 |
| `/api/ai-feed`                                                         | aiFeedRoutes                                                                      | AI 资讯聚合                             |
| `/api/ai-education`                                                    | aiEducationRoutes                                                                 | AI 教育模块                             |
| `/api/ai-vendors/luyala`                                               | luyalaRoutes                                                                      | 路亚拉视频/语音代理                     |
| `/api/chat`                                                            | chatRoutes/chatModelRoutes                                                        | 多模型直连                              |
| `/api/llm`                                                             | llmModelsRoutes                                                                   | LLM 模型列表代理                        |
| `/api/course`                                                          | zhsCourseRoutes                                                                   | 课程 (迁移自 ZHS_Server)                |
| `/api/exam`                                                            | examRoutes                                                                        | 考试模块 (papers 复数化)                |
| `/api/community`                                                       | communityRoutes                                                                   | 社区/圈子/问答                          |
| `/api/circles`                                                         | communityRoutes 内                                                                | 复数化                                  |
| `/api/asks`                                                            | communityRoutes 内                                                                | 问答                                    |
| `/api/order` / `/api/orders`                                           | orderRoutes                                                                       | 教育订单                                |
| `/api/payment` / `/api/payment-gateway` / `/api/payment-recurring`     | paymentGateway/paymentExtended/paymentRecurring                                   | 支付                                    |
| `/api/wallet`                                                          | walletRoutes                                                                      | 钱包                                    |
| `/api/fund`                                                            | fundRoutes                                                                        | 资金                                    |
| `/api/finance` / `/api/finance-extended`                               | financeRoutes/financeExtendedRoutes                                               | 财务                                    |
| `/api/user`                                                            | userRoutes/userLlmConfigs                                                         | 用户中心                                |
| `/api/users`                                                           | usersRoutes                                                                       | 用户管理                                |
| `/api/workspace`                                                       | workspaceRoutes/workspaceAiRoutes                                                 | 工作空间 + AI                           |
| `/api/coze`                                                            | cozeRoutes/cozeEcosystem/cozeOAuth/cozeVariables/cozeTest                         | Coze 平台集成                           |
| `/api/crew`                                                            | crewRoutes                                                                        | 多智能体                                |
| `/api/knowledge`                                                       | knowledgeRagRoutes                                                                | 知识库 RAG                              |
| `/api/search`                                                          | searchRoutes                                                                      | 搜索 (含 hot-words/history/public-api)  |
| `/api/feed`                                                            | (via community/social)                                                            | 信息流                                  |
| `/api/points` / `/api/edu-points`                                      | pointRoutes/eduPublic                                                             | 积分                                    |
| `/api/checkin`                                                         | checkinRoutes                                                                     | 签到                                    |
| `/api/ranking`                                                         | rankingRoutes                                                                     | 排行榜                                  |
| `/api/levels` / `/api/leaderboard`                                     | gamificationRoutes                                                                | 游戏化                                  |
| `/api/announcements`                                                   | announcementsRoutes/contentRoutes                                                 | 公告                                    |
| `/api/notifications`                                                   | notificationsRoutes/notificationExtended                                          | 通知                                    |
| `/api/comments` / `/api/feedbacks`                                     | commentRoutes                                                                     | 评论反馈                                |
| `/api/follows` / `/api/favorites` / `/api/subscriptions` / `/api/tags` | socialRoutes                                                                      | 社交                                    |
| `/api/interactions`                                                    | interactionsRoutes                                                                | 互动统一入口                            |
| `/api/teams`                                                           | teamRoutes                                                                        | 团队                                    |
| `/api/roles` / `/api/permissions`                                      | rbacRoutes                                                                        | RBAC                                    |
| `/api/workflows`                                                       | workflowRoutes                                                                    | 工作流                                  |
| `/api/schedule`                                                        | scheduleRoutes                                                                    | 调度 (实际为 Cron)                      |
| `/api/statistics`                                                      | statisticsRoutes                                                                  | 统计                                    |
| `/api/messages`                                                        | messageRoutes                                                                     | 站内消息                                |
| `/api/topics`                                                          | topicRoutes                                                                       | 专题                                    |
| `/api/behavior`                                                        | behaviorRoutes                                                                    | 行为追踪                                |
| `/api/visit-tracking`                                                  | visitTrackingRoutes                                                               | 访问追踪                                |
| `/api/oss`                                                             | ossRoutes                                                                         | 对象存储                                |
| `/api/edu-settings`                                                    | settingRoutes                                                                     | 教育设置                                |
| `/api/carousels`                                                       | carouselPublicRoutes                                                              | 公开轮播图                              |
| `/api/news`                                                            | newsRoutes                                                                        | 资讯                                    |
| `/api/certificates`                                                    | certificateRoutes                                                                 | 证书                                    |
| `/api/learn`                                                           | learnRoutes                                                                       | 学习模块                                |
| `/api/edu-public`                                                      | eduPublicRoutes                                                                   | 学员中心                                |
| `/api/edu-ext`                                                         | eduExtendedRoutes                                                                 | 教育扩展                                |
| `/api/system-ext`                                                      | systemExtendedRoutes                                                              | 系统扩展                                |
| `/api/misc-ext`                                                        | miscExtendedRoutes                                                                | 其他扩展                                |
| `/api/dict`                                                            | dictPublicRoutes                                                                  | 公开字典                                |
| `/api/canary`                                                          | canaryRoutes                                                                      | 金丝雀                                  |
| `/api/tbox`                                                            | tboxRoutes                                                                        | TBox IoT                                |
| `/api/stock`                                                           | stockRoutes                                                                       | 股票分析                                |
| `/api/srs`                                                             | srsRoutes                                                                         | SRS 媒体                                |
| `/api/remote`                                                          | remoteExtended/remoteDevice                                                       | 远程设备                                |
| `/api/gdpr`                                                            | gdprRoutes                                                                        | GDPR                                    |
| `/api/customer-service`                                                | customerServiceRoutes                                                             | 客服                                    |
| `/api/organization`                                                    | zhsOrganizationRoutes                                                             | 组织                                    |
| `/api/tenants`                                                         | tenantRoutes                                                                      | 多租户                                  |
| `/api/share`                                                           | shareContentRoutes                                                                | 分享 H5                                 |
| `/api/legacy`                                                          | legacyCompletionRoutes                                                            | 历史项目缺失端点                        |
| `/api/feature-center`                                                  | featureCenterRoutes                                                               | 开放平台 Feature Center                 |
| `/api/education-platform`                                              | educationPlatformRoutes                                                           | 教育平台同步                            |
| `/api/agreements` / `/api/exchange-rates`                              | agreementPublic/exchangeRatePublic                                                | 公共数据                                |
| `/api/cli/announcements`                                               | announcementsRoutes                                                               | CLI 公告                                |
| `/api/v1/telemetry`                                                    | telemetryRoutes                                                                   | 遥测上报                                |
| `/api/ai-video-compose`                                                | aiVideoComposeRoutes                                                              | 一键视频编排                            |
| `/api/langchain`                                                       | legacyLangchainRoutes                                                             | LangChain 兼容                          |
| `/api/rewarded-video-ad`                                               | rewardedVideoAdRoutes                                                             | 激励视频广告                            |
| `/api/webrtc-voice`                                                    | webrtcVoiceRoutes                                                                 | WebRTC 语音                             |
| `/api/outbound`                                                        | outboundRoutes                                                                    | 外呼业务                                |
| `/api/tools`                                                           | toolsRoutes                                                                       | 工具目录                                |
| `/api/developer`                                                       | developerRoutes/webhooks                                                          | 开发者 API                              |
| `/api/app-version`                                                     | appVersionRoutes                                                                  | 应用版本                                |
| `/api/monitor`                                                         | monitorRoutes                                                                     | 监控                                    |
| `/api/packages`                                                        | packagesRoutes                                                                    | 套餐                                    |
| `/api/trader`                                                          | traderRoutes                                                                      | 交易员                                  |
| `/api/sdks`                                                            | sdksRoutes                                                                        | SDK                                     |
| `/api/miniprogram`                                                     | miniprogramRoutes                                                                 | 小程序后台                              |
| `/api/product-identity`                                                | productIdentityRoutes                                                             | 产品标识                                |
| `/api/groups`                                                          | groupsRoutes                                                                      | 用户组                                  |
| `/api/plaza`                                                           | plazaRoutes                                                                       | 广场                                    |
| `/api/callback-log`                                                    | callbackLogRoutes                                                                 | 回调日志                                |
| `/api/agent-free-times`                                                | userAgentFreeTimesRoutes                                                          | 智能体免费次数                          |
| `/api/service-catalog`                                                 | serviceCatalogRoutes                                                              | 服务注册发现                            |
| `/api/billing`                                                         | billingRoutes                                                                     | 账单                                    |
| `/api/audit`                                                           | auditRoutes                                                                       | 审计                                    |
| `/api/chat-models`                                                     | chatModelRoutes                                                                   | 多模型直连                              |

## 7 个重点 Java 服务审计 (基于历史文档推断)

### 1. coze_zhs_py (Python, 非 Java)

- 状态: 12 子模块 100% 迁移到 coze.ts
- 子模块: agent/conversation/file/knowledge/message/plugin/variable/workflow/voice/websocket/auth/public
- 位置: apps/api/src/services/coze/ + apps/api/src/routes/coze*.ts
- 验证: `coze.ts` 注释明确列出 12 子模块 (apps/audio/chat-audio/conversations/datasets/files/review/templates/workflows/workspaces/bot) + coze-variables.ts 独立覆盖 variable

### 2. zhs-smart-society

- 状态: ~95% 迁移
- 已知端点: /society, /community, /feed 等
- TS 对应: 命名空间 /api/community, /api/circles, /api/posts, /api/asks, /api/topics, /api/feed
- 路由文件: community.ts + community/ 子目录 (asks.ts/circles.ts/posts.ts/topics.ts)

### 3. ZHS_Server

- 状态: ~93% 迁移
- 已知端点: /course, /exam, /paper, /study
- TS 对应: 命名空间 /api/course, /api/exam, /api/papers (注意:paper→papers 重命名)
- 路由文件: zhs-course.ts (47 个 fastify.* 调用,prefix `/api/course`) + exam.ts (32 个 server.* 调用)
- 备注: `/api/papers` 是 `/api/exam/papers` 的子路径,不是独立命名空间

### 4. ihui-ai-admin

- 状态: ~100% 迁移
- 已知端点: /admin, /system, /permission
- TS 对应: 命名空间 /api/admin, /api/permissions (RBAC), /api/roles
- 路由文件: admin.ts + admin/ 子目录 (30 个文件) + adminSys + adminExtended + adminContentOps + adminAuthEdu + adminMonitoring + adminShop + adminInvoices + adminMissing + adminSensitiveWords + adminAgreements + adminExchangeRate + adminPrivateLetters + adminGrayRelease + adminErrorDashboard + adminApiPlatform + adminFaq + adminZone + adminDemandSquare + adminAsk + adminBiDashboard + adminPush + adminReport + adminCustomerService + adminNotification + adminVip + adminOrder + adminLive + adminMember + adminResource + adminPoint + adminUsercenter + adminSchedule + adminStatistics + adminMessage + adminTopic + adminBehavior + adminVisitTracking + adminOss + adminSetting + adminNews + adminCertificate + adminRefundAudit + adminPaymentGateway + adminZhsCourse + adminZhsOrganization + adminUserAgentFreeTimes + adminServiceCatalog + adminAiVendor + adminEduExtended + adminCategoryDictionary + adminCourseAudit + adminClawdbot

### 5. ihui-ai-user

- 状态: ~100% 迁移
- 已知端点: /user, /auth
- TS 对应: 命名空间 /api/user, /api/auth, /api/users
- 路由文件: user.ts (5 个 server.* 调用) + users.ts (7 个) + auth.ts (13 个) + auth-extended.ts (77 个) + auth-sso.ts (5 个) + auth-identity.ts (4 个) + usercenter.ts (17 个) + user-llm-configs.ts (8 个) + user-agent-free-times.ts (6 个)

### 6. ihui-ai-payment

- 状态: ~90% 迁移
- 已知端点: /payment, /order, /wallet
- TS 对应: 命名空间 /api/payment, /api/payment-gateway, /api/payment-recurring, /api/orders, /api/order, /api/wallet, /api/fund, /api/finance, /api/finance-extended
- 路由文件: payment-gateway.ts (27) + payment-extended.ts (4) + payment-recurring.ts (7) + order.ts (26) + wallet.ts (5) + fund.ts (4) + finance.ts (18) + finance-extended.ts (11) + refund-audit.ts (5)
- 缺失点: 部分连续订阅/退款细节 (R65 R1 补完)

### 7. 其他 ihui-ai-* (~16 个)

- 状态: ~85% 迁移
- 覆盖: ihui-ai-search (search.ts, 13 端点) / ihui-ai-schedule (schedule.ts, 16 端点) / ihui-ai-live (live.ts, 33 端点) / ihui-ai-member (member.ts, 58 端点) / ihui-ai-learn (learn.ts, 91 端点) / ihui-ai-content (content.ts, 28 端点) / ihui-ai-system (system.ts, 17 端点) / ihui-ai-coze (coze.ts, 46 端点) / ihui-ai-knowledge (knowledge-rag.ts, 9 端点) / ihui-ai-ai (ai-vendors+ai-extended+ai-audio 等) / ihui-ai-workspace (workspace.ts+workspace-ai.ts, 19+65 端点) / ihui-ai-team (teams.ts, 13 端点) / ihui-ai-rbac (rbac.ts, 16 端点) / ihui-ai-ai (clawdbot, 37 端点) / ihui-ai-vip (vip.ts, 13 端点) / ihui-ai-canary (canary.ts, 9 端点) 等
- **缺失**: edu.service.search-service 全文搜索 (Lucene HMM + 高亮 + facets)
  - search.ts 当前只有 hot-words/history/public-api 内容管理,**没有 Lucene HMM 全文索引/打分/高亮/facets**
- **缺失/语义偏差**: edu.service.schedule-service 课程表
  - schedule.ts 当前为 Cron 定时任务调度,**不是课程表**

## 命名空间差异 (Java → TS)

| Java            | TS                                                         | 差异                                                  |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| /api/agent      | /api/agent                                                 | 相同                                                  |
| /api/agents     | /api/agents                                                | 相同 (agents.ts + agentsRoutes)                       |
| /api/exam       | /api/exam                                                  | 相同                                                  |
| /api/paper      | /api/exam/papers (子路径)                                  | 改为复数化                                            |
| /api/circle     | /api/circles                                               | 复数化                                                |
| /api/post       | /api/posts                                                 | 复数化                                                |
| /api/ask        | /api/asks                                                  | 复数化                                                |
| /api/order      | /api/orders (部分)                                         | 复数化 (但 order.ts 同时有 /api/order 内部路径)       |
| /api/topic      | /api/topics                                                | 复数化                                                |
| /api/category   | /api/categories                                            | 复数化                                                |
| /api/payment    | /api/payment /api/payment-gateway /api/payment-recurring   | 拆分                                                  |
| /api/society    | /api/community                                             | 重命名                                                |
| /api/feed       | /api/feed (含 ai-feed)                                     | 拆分 ai-feed                                          |
| /api/auth       | /api/auth                                                  | 相同 (但有 auth-extended/auth-sso/auth-identity 拆分) |
| /api/user       | /api/user /api/users                                       | 拆分 (单数 vs 复数)                                   |
| /api/system     | /api/admin/sys (adminSysRoutes) /api/system (systemRoutes) | 拆分                                                  |
| /api/permission | /api/permissions                                           | 复数化                                                |

## 命名空间破坏性变更

7 个路径重命名 (exam/paper→papers, circle→circles 等)
需确认前端 100% 已迁移, 否则需回退或配别名

## 6 个 308 redirect 端点 (M-63 引入)

- /agents → /api/agent/agents
- /agent-withdrawal-detail → ...
- /ai-model-info → ...
- /customer-service/faqs → ...
- /ai/capabilities/:id/toggle → ...
- /ai-feed/hot → /api/ai-feed/hot

## 关键路由文件 server.* 端点数量 (Top 20)

| 文件                            | 端点数         | 命名空间                                        |
| ------------------------------- | -------------- | ----------------------------------------------- |
| `missing-user-routes.ts`        | 120            | /api (前端用户端缺失桩)                         |
| `frontend-stub-admin-routes.ts` | 99             | /api (前端管理端缺失桩)                         |
| `learn.ts`                      | 91             | /api/learn + /api/admin/learn                   |
| `frontend-stub-other-routes.ts` | 86             | /api (其他通用桩)                               |
| `agents.ts`                     | 75             | /api (agents + categories)                      |
| `auth-extended.ts`              | 77             | /api (多登录扩展)                               |
| `workspace-ai.ts`               | 65             | /api/workspace                                  |
| `agent-extended.ts`             | 62             | /api/agent-ext                                  |
| `member.ts`                     | 58             | /api/members + /api/admin/members               |
| `coze.ts`                       | 46             | /api/coze                                       |
| `zhs-course.ts`                 | 47 (fastify.*) | /api/course + /api/admin/course                 |
| `edu-extended.ts`               | 39             | /api/edu-ext + /api/admin/edu                   |
| `clawdbot.ts`                   | 37             | /api/admin/clawdbot                             |
| `legacy-completion.ts`          | 34 (fastify.*) | /api/legacy (考试报名/学习统计/问答/OSS)        |
| `live.ts`                       | 33             | /api/live + /api/admin/live                     |
| `chat-models.ts`                | 32             | /api/chat                                       |
| `proxy-llm.ts`                  | 33             | /api/ai (LLM 代理)                              |
| `exam.ts`                       | 32             | /api/exam + /api/admin/exam                     |
| `message.ts`                    | 29             | /api/messages + /api/admin/messages             |
| `ai-extended.ts`                | 28             | /api/ai-ext                                     |
| `content.ts`                    | 28             | /api (内容/公告/帮助)                           |
| `payment-gateway.ts`            | 27             | /api/payment + /api/admin/payment               |
| `frontend-stub-edu-routes.ts`   | 27             | /api (教育桩)                                   |
| `order.ts`                      | 26             | /api/orders + /api/admin/orders                 |
| `resource.ts`                   | 26             | /api/resources + /api/admin/resources           |
| `frontend-stub-ai-routes.ts`    | 26             | /api (AI 桩)                                    |
| `proxy-extended.ts`             | 32             | /api/ai (扩展代理)                              |
| `proxy-tools.ts`                | 23             | /api/ai (工具代理)                              |
| `social.ts`                     | 22             | /api/follows/favorites/subscriptions/tags       |
| `visit-tracking.ts`             | 20             | /api/visit-tracking + /api/admin/visit-tracking |
| `news.ts`                       | 19             | /api/news + /api/admin/news                     |
| `point.ts`                      | 19             | /api/points + /api/admin/points                 |
| `edu-public.ts`                 | 18             | /api (学员中心)                                 |
| `finance.ts`                    | 18             | /api/finance                                    |
| `customer-service.ts`           | 18             | /api/customer-service + /api/admin              |
| `chat.ts`                       | 17             | /api/chat                                       |
| `system.ts`                     | 17             | /api (系统配置)                                 |
| `community/asks.ts`             | 17             | /api/asks                                       |
| `usercenter.ts`                 | 17             | /api/admin/usercenter                           |
| `comments.ts`                   | 17             | /api/comments + /api/admin/comments             |
| `statistics.ts`                 | 17             | /api/statistics + /api/admin/statistics         |
| `rbac.ts`                       | 16             | /api/roles + /api/permissions                   |
| `behavior.ts`                   | 16             | /api/behavior + /api/admin/behavior             |
| `schedule.ts`                   | 16             | /api/schedule (Cron)                            |
| `community/circles.ts`          | 16             | /api/circles                                    |
| `promotions.ts`                 | 15             | /api/invitations + /api/admin/activities        |
| `system-extended.ts`            | 14             | /api/system-ext + /api/admin/category           |
| `vip.ts`                        | 13             | /api/vip + /api/admin/vip                       |
| `certificate.ts`                | 13             | /api/certificates + /api/admin/certificates     |
| `teams.ts`                      | 13             | /api/teams                                      |
| `workflows.ts`                  | 13             | /api/workflows                                  |
| `crew.ts`                       | 13             | /api/crew                                       |
| `search.ts`                     | 13             | /api/search                                     |
| `auth.ts`                       | 13             | /api/auth                                       |
| `admin-auth-edu-routes.ts`      | 35             | /api/admin (鉴权/教育/学习)                     |
| `admin-monitoring-routes.ts`    | 19             | /api/admin (监控/统计)                          |
| `admin-content-routes.ts`       | 19             | /api/admin (内容运营)                           |
| `admin-shop-routes.ts`          | 13             | /api/admin (商城)                               |
| `admin-api-platform.ts`         | 13             | /api/admin (API 平台)                           |
| `misc-extended.ts`              | 13             | /api/misc-ext                                   |
| `admin/system-login-logs.ts`    | 12             | /api/admin                                      |
| `remote-device.ts`              | 13             | /api/remote                                     |
| `remote-extended.ts`            | 12             | /api                                            |
| `content-extended.ts`           | 12             | /api                                            |
| `admin-extended.ts`             | 12             | /api/admin (菜单+需求+在线)                     |
| `setting.ts`                    | 12             | /api/edu-settings + /api/admin                  |
| `ask-extended.ts`               | 12             | /api (问答扩展)                                 |
| `files.ts`                      | 12             | /api/files                                      |
| `finance-extended.ts`           | 11             | /api                                            |
| `monitor.ts`                    | 11             | /api/monitor                                    |
| `ai-image-edit.ts`              | 18             | /api/ai (AI 图片编辑)                           |
| `admin.ts`                      | 11             | /api/admin                                      |
| `tenant.ts`                     | 11             | /api/tenants                                    |
| `notifications.ts`              | 11             | /api/notifications                              |
| `notifications.ts`              | 11             | /api/notifications                              |
| `admin.ts`                      | 11             | /api/admin                                      |
| `mcp-extended.ts`               | 11             | /api (MCP 扩展)                                 |
| `srs.ts`                        | 12             | /api/srs                                        |
| `community/topics.ts`           | 11             | /api/topics                                     |
| `coze-ecosystem.ts`             | 10             | /api/coze (R74 P2 补建)                         |
| `ai-education.ts`               | 10             | /api/ai-education                               |
| `oss.ts`                        | 9              | /api/oss + /api/admin/oss                       |
| `gamification.ts`               | 9              | /api/points + /api/sign-in + /api/levels        |
| `knowledge-rag.ts`              | 9              | /api/knowledge                                  |
| `canary.ts`                     | 9              | /api/canary                                     |
| `admin/stats.ts`                | 9              | /api/admin                                      |
| `ai-feed.ts`                    | 8              | /api/ai-feed                                    |
| `user-llm-configs.ts`           | 8              | /api/user                                       |
| `checkin.ts`                    | 8              | /api/checkin + /api/admin/checkin               |
| `app-version.ts`                | 7              | /api/app-version                                |
| `file-version.ts`               | 7              | /api                                            |
| `admin-faq.ts`                  | 7              | /api/admin/faq                                  |
| `users.ts`                      | 7              | /api/users                                      |
| `service-catalog.ts`            | 7              | /api/service-catalog + /api/admin               |
| `tbox.ts`                       | 7              | /api/tbox                                       |
| `developer.ts`                  | 7              | /api/developer                                  |
| `tools.ts`                      | 7              | /api/tools                                      |
| `distribution.ts`               | 7              | /api                                            |
| `webhooks.ts`                   | 6              | /api/developer/webhooks                         |
| `push.ts`                       | 6              | /api                                            |
| `topic.ts`                      | 7              | /api/topics + /api/admin/topics                 |
| `admin-demand-square.ts`        | 7              | /api/admin/demand-square                        |
| `education-platform.ts`         | 6              | /api/education-platform + /api/admin            |
| `callback-log.ts`               | 6              | /api/callback-log                               |
| `admin-extended.ts`             | 12             | /api/admin                                      |
| `user-agent-free-times.ts`      | 6              | /api/agent-free-times + /api/admin              |
| `groups.ts`                     | 6              | /api/groups                                     |
| `organization.ts`               | 9              | /api                                            |
| `admin-sensitive-words.ts`      | 6              | /api/admin                                      |
| `admin-agreements.ts`           | 6              | /api/admin                                      |
| `admin-exchange-rate.ts`        | 6              | /api/admin                                      |
| `ai-vendors/luyala.ts`          | 3              | /api/ai-vendors/luyala                          |
| `admin-api-platform.ts`         | 13             | /api/admin                                      |
| `admin-asks.ts`                 | 5              | /api/admin/asks                                 |
| `admin-monitoring-routes.ts`    | 19             | /api/admin                                      |
| `zhs-organization.ts`           | 6              | /api/organization + /api/admin/organization     |
| `user.ts`                       | 5              | /api                                            |
| `wallet.ts`                     | 5              | /api/wallet                                     |
| `auth-sso.ts`                   | 5              | /api/auth                                       |
| `auth-identity.ts`              | 4              | /api                                            |
| `payment-recurring.ts`          | 7              | /api                                            |
| `admin-zone.ts`                 | 5              | /api/admin/zones                                |
| `admin-shop-routes.ts`          | 13             | /api/admin                                      |
| `admin-private-letters.ts`      | 1              | /api/admin/private-letters                      |
| `admin-invoices.ts`             | 4              | /api/admin                                      |
| `payment-extended.ts`           | 4              | /api                                            |
| `admin-extended.ts`             | 12             | /api/admin                                      |
| `ai-video-compose.ts`           | 3              | /api/ai-video-compose                           |
| `ai-user-model-chat.ts`         | 6              | /api/ai                                         |
| `ai-generation.ts`              | 5              | /api                                            |
| `ai-chat-stream.ts`             | 1              | /api/ai                                         |
| `ai-callback.ts`                | 1              | /api/ai/callback                                |
| `audit.ts`                      | 3              | /api/admin/audit                                |
| `billing.ts`                    | 2              | /api                                            |
| `bi-dashboard.ts`               | 2              | /api/admin                                      |
| `announcements.ts`              | 3              | /api/announcements + /api/cli/announcements     |
| `articles.ts`                   | 1              | /api                                            |
| `carousel.ts`                   | 1              | /api/carousels                                  |
| `chunked-upload.ts`             | 5              | /api                                            |
| `drama.ts`                      | 2              | /api                                            |
| `feature-center.ts`             | 6              | /api/feature-center                             |
| `fund.ts`                       | 4              | /api/fund                                       |
| `gdpr.ts`                       | 3              | /api/gdpr                                       |
| `health.ts`                     | 6              | /api/health                                     |
| `i18n-dashboard.ts`             | 1              | /api/admin                                      |
| `interactions.ts`               | 4              | /api/interactions                               |
| `legacy-langchain.ts`           | 3              | /api/langchain                                  |
| `llm-models.ts`                 | 3              | /api/llm                                        |
| `miniprogram.ts`                | 4              | /api/miniprogram                                |
| `notification-extended.ts`      | 7              | /api                                            |
| `outbound.ts`                   | 5              | /api/outbound                                   |
| `packages.ts`                   | 4              | /api/packages                                   |
| `plaza.ts`                      | 1              | /api/plaza                                      |
| `pricing.ts`                    | 4              | /api                                            |
| `product-identity.ts`           | 3              | /api/product-identity                           |
| `ranking.ts`                    | 4              | /api/ranking                                    |
| `refund-audit.ts`               | 5              | /api + /api/admin                               |
| `report.ts`                     | 3              | /api/admin                                      |
| `rewarded-video-ad.ts`          | 2              | /api/rewarded-video-ad                          |
| `sdks.ts`                       | 4              | /api/sdks                                       |
| `share-content.ts`              | 1              | /api/share                                      |
| `stock.ts`                      | 3              | /api/stock                                      |
| `telemetry.ts`                  | 2              | /api/v1/telemetry                               |
| `trader.ts`                     | 4              | /api/trader                                     |
| `transcode.ts`                  | 7              | /api + /api/admin                               |
| `webrtc-voice.ts`               | 4              | /api/webrtc-voice                               |
| `agent-runtime.ts`              | 8 (app.*)      | /api/agent-runtime                              |
| `admin-sys.ts`                  | 1 (server.get) | /api/admin                                      |
| `ai-world.ts`                   | 1              | /api                                            |
| `coze-oauth.ts`                 | 5              | /api/coze/oauth                                 |
| `coze-test.ts`                  | 5              | /api/coze/test                                  |
| `coze-variables.ts`             | 5              | /api/coze/variables                             |
| `edu-stubs.ts`                  | 4              | /api                                            |

## 审计发现 (5 个测试-源文件不匹配)

通过 Glob 验证,以下测试文件存在但**对应路由源文件缺失**:

1. `__tests__/commission-routes.test.ts` → 无 `commission-routes.ts` (测试中引用 `/api/commission/*`)
2. `__tests__/contract-routes.test.ts` → 无 `contract-routes.ts`
3. `__tests__/permission-routes.test.ts` → 无 `permission-routes.ts` (RBAC 已在 rbac.ts 中,可能命名变更)
4. `__tests__/role-routes.test.ts` → 无 `role-routes.ts` (RBAC 已在 rbac.ts 中,可能命名变更)
5. `__tests__/zone-routes.test.ts` → 无 `zone-routes.ts` (有 admin-zone.ts,可能为前缀差异)

可能原因:

- R65 路径重命名后测试未同步
- 部分桩在 `frontend-stub-*-routes.ts` 中而非独立文件
- 部分端点在 admin/* 子目录中而非顶层

## 综合迁移率

- 7 个重点服务: 92-100% 完整
- 其他 ~16 个 Java 微服务: ~85% 完整
- 综合: ~92-95% (与 R74 v3 94% 一致)

## 后续最优建议 (R77)

### 高优先级 (P0)

1. **在 D 盘可访问环境重做双向审计**
   - 验证 R74 报告结论 (94%) 与 R76 单向审计 (~93%) 一致性
   - 通过 Java `@RequestMapping` 注解反向核对 TS prefix
2. **解决 5 个测试-源文件不匹配**
   - commission-routes / contract-routes / permission-routes / role-routes / zone-routes
   - 行动: 要么补建源文件,要么删除/合并测试文件
3. **补齐 search 全文搜索 (Lucene HMM)**
   - 当前 search.ts 仅有 hot-words/history/public-api
   - 缺失: HMM 分词 + 倒排索引 + BM25 打分 + 高亮 + facets 聚合

### 中优先级 (P1)

4. **确认 schedule.ts 语义 (Cron 调度 vs 课程表)**
   - 当前 16 端点全是 Cron 任务 CRUD
   - edu.service.schedule-service 课程表缺失 (按周/天/教室/教师排课)
   - 行动: 要么重命名 schedule.ts 为 cron-schedule.ts,要么补建 course-schedule.ts
5. **验证 7 个命名空间破坏性变更前端兼容**
   - paper→papers, circle→circles, post→posts, ask→asks, order→orders, topic→topics, category→categories
   - 在前端代码库 grep 旧路径,确认 100% 已迁移或加 redirect 别名
6. **补齐 6 个 308 redirect 端点 (M-63) 的实际后端实现**
   - 验证 /agents, /agent-withdrawal-detail, /ai-model-info, /customer-service/faqs, /ai/capabilities/:id/toggle, /ai-feed/hot 的目标端点已实装并测试通过

### 低优先级 (P2)

7. **继续推进 ~16 个 Java 微服务的剩余 ~15% 迁移**
   - edu.service.search-service (Lucene HMM)
   - edu.service.schedule-service (课程表)
   - 其他散点缺失
8. **添加 6 个 308 redirect 的自动化测试**
   - 避免后续重构破坏旧路径兼容
9. _*审计 frontend-stub-* 桩的真实化_*
   - 4 个 stub 文件共 238 端点 (99+26+27+86),需评估哪些可转真实 CRUD
10. _*将 server.* 调用统一重构为 plugins 模式_*
    - 184 个文件 + 2628+ 端点集中在 server.ts 路由注册,文件拆分可进一步降低耦合
