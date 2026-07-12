# 后端 API 路由审计清单

> 自动扫描生成 | 扫描范围：`apps/api/src/routes/*.ts` + `apps/api/src/server.ts`
> 生成时间：2026-07-12

---

## 统计摘要

| 指标                                | 数值        |
| ----------------------------------- | ----------- |
| 路由文件数（.ts）                   | 116         |
| Routes 模块导出数                   | 124         |
| server.register 调用数              | 150         |
| 路由定义总数（含重复方法+路径）     | ~1700       |
| **唯一 API 路径总数**               | **约 1050** |
| **`/api/admin/*` 路径数**           | **约 420**  |
| 双导出文件数（user + admin 同文件） | 27          |
| 多行路由定义文件数                  | 7           |

---

## 路由前缀映射（server.ts → register 调用）

| Routes 变量                | 前缀                          | 源文件                   |
| -------------------------- | ----------------------------- | ------------------------ |
| healthRoutes               | `/api`                        | health.ts                |
| authRoutes                 | `/api/auth`                   | auth.ts                  |
| usersRoutes                | `/api/users`                  | users.ts                 |
| workspaceRoutes            | `/api/workspace`              | workspace.ts             |
| workspaceAiRoutes          | `/api/workspace`              | workspace-ai.ts          |
| fileRoutes                 | `/api`                        | files.ts                 |
| adminRoutes                | `/api/admin`                  | admin.ts                 |
| notificationRoutes         | `/api`                        | notifications.ts         |
| billingRoutes              | `/api`                        | billing.ts               |
| searchRoutes               | `/api`                        | search.ts                |
| auditRoutes                | `/api/admin`                  | audit.ts                 |
| teamRoutes                 | `/api/teams`                  | teams.ts                 |
| chatRoutes                 | `/api/chat`                   | chat.ts                  |
| chatModelRoutes            | `/api/chat`                   | chat-models.ts           |
| rbacRoutes                 | `/api`                        | rbac.ts                  |
| workflowRoutes             | `/api`                        | workflows.ts             |
| commentRoutes              | `/api`                        | comments.ts              |
| communityRoutes            | `/api`                        | community.ts             |
| socialRoutes               | `/api`                        | social.ts                |
| promotionRoutes            | `/api`                        | promotions.ts            |
| adminPromotionRoutes       | `/api/admin`                  | promotions.ts            |
| contentRoutes              | `/api`                        | content.ts               |
| adminContentRoutes         | `/api/admin`                  | content.ts               |
| learnRoutes                | `/api`                        | learn.ts                 |
| adminLearnRoutes           | `/api/admin`                  | learn.ts                 |
| gamificationRoutes         | `/api`                        | gamification.ts          |
| systemRoutes               | `/api`                        | system.ts                |
| adminSystemRoutes          | `/api/admin`                  | system.ts                |
| examRoutes                 | `/api`                        | exam.ts                  |
| orderRoutes                | `/api`                        | order.ts                 |
| adminOrderRoutes           | `/api/admin`                  | order.ts                 |
| liveRoutes                 | `/api`                        | live.ts                  |
| adminLiveRoutes            | `/api/admin`                  | live.ts                  |
| memberRoutes               | `/api`                        | member.ts                |
| adminMemberRoutes          | `/api/admin`                  | member.ts                |
| resourceRoutes             | `/api`                        | resource.ts              |
| adminResourceRoutes        | `/api/admin`                  | resource.ts              |
| pointRoutes                | `/api`                        | point.ts                 |
| adminPointRoutes           | `/api/admin`                  | point.ts                 |
| usercenterRoutes           | `/api/admin/usercenter`       | usercenter.ts            |
| scheduleRoutes             | `/api`                        | schedule.ts              |
| adminScheduleRoutes        | `/api/admin`                  | schedule.ts              |
| statisticsRoutes           | `/api`                        | statistics.ts            |
| adminStatisticsRoutes      | `/api/admin`                  | statistics.ts            |
| messageRoutes              | `/api`                        | message.ts               |
| adminMessageRoutes         | `/api/admin`                  | message.ts               |
| topicRoutes                | `/api`                        | topic.ts                 |
| adminTopicRoutes           | `/api/admin`                  | topic.ts                 |
| behaviorRoutes             | `/api`                        | behavior.ts              |
| adminBehaviorRoutes        | `/api/admin`                  | behavior.ts              |
| visitTrackingRoutes        | `/api`                        | visit-tracking.ts        |
| adminVisitTrackingRoutes   | `/api/admin`                  | visit-tracking.ts        |
| ossRoutes                  | `/api`                        | oss.ts                   |
| adminOssRoutes             | `/api/admin`                  | oss.ts                   |
| settingRoutes              | `/api`                        | setting.ts               |
| adminSettingRoutes         | `/api/admin`                  | setting.ts               |
| newsRoutes                 | `/api`                        | news.ts                  |
| adminNewsRoutes            | `/api/admin`                  | news.ts                  |
| certificateRoutes          | `/api`                        | certificate.ts           |
| adminCertificateRoutes     | `/api/admin`                  | certificate.ts           |
| adminEduExtendedRoutes     | `/api`                        | edu-extended.ts          |
| adminSysRoutes             | `/api/admin`                  | admin-sys.ts             |
| agentsRoutes               | `/api`                        | agents.ts                |
| plazaRoutes                | `/api/plaza`                  | plaza.ts                 |
| cozeVariablesRoutes        | `/api/coze/variables`         | coze-variables.ts        |
| cozeRoutes                 | `/api/coze`                   | coze.ts                  |
| agenticServiceRoutes       | `/api/agent`                  | agentic-service.ts       |
| aiCallbackRoutes           | （无前缀）                    | ai-callback.ts           |
| paymentGatewayRoutes       | `/api`                        | payment-gateway.ts       |
| adminPaymentGatewayRoutes  | `/api/admin`                  | payment-gateway.ts       |
| refundAuditRoutes          | `/api`                        | refund-audit.ts          |
| adminRefundAuditRoutes     | `/api/admin`                  | refund-audit.ts          |
| financeRoutes              | `/api`                        | finance.ts               |
| authExtendedRoutes         | `/api`                        | auth-extended.ts         |
| authSsoRoutes              | `/api/auth`                   | auth-sso.ts              |
| vipRoutes                  | `/api`                        | vip.ts                   |
| adminVipRoutes             | `/api/admin`                  | vip.ts                   |
| eduPublicRoutes            | `/api`                        | edu-public.ts            |
| aiVendorRoutes             | `/api/ai`                     | ai-vendors.ts            |
| adminAiVendorRoutes        | `/api/admin/ai`               | ai-vendors.ts            |
| aiAudioRoutes              | `/api/ai`                     | ai-audio.ts              |
| customerServiceRoutes      | `/api/customer-service`       | customer-service.ts      |
| adminCustomerServiceRoutes | `/api/admin/customer-service` | customer-service.ts      |
| gdprRoutes                 | `/api/gdpr`                   | gdpr.ts                  |
| clawdbotRoutes             | `/api`                        | clawdbot.ts              |
| tenantRoutes               | `/api/tenants`                | tenant.ts                |
| canaryRoutes               | `/api/canary`                 | canary.ts                |
| tboxRoutes                 | `/api/tbox`                   | tbox.ts                  |
| stockRoutes                | `/api/stock`                  | stock.ts                 |
| agentExtendedRoutes        | `/api/agent-ext`              | agent-extended.ts        |
| eduExtendedRoutes          | `/api/edu-ext`                | edu-extended.ts          |
| systemExtendedRoutes       | `/api/system-ext`             | system-extended.ts       |
| aiExtendedRoutes           | `/api/ai-ext`                 | ai-extended.ts           |
| miscExtendedRoutes         | `/api/misc-ext`               | misc-extended.ts         |
| toolsRoutes                | `/api/tools`                  | tools.ts                 |
| rankingRoutes              | `/api/ranking`                | ranking.ts               |
| checkinRoutes              | `/api/checkin`                | checkin.ts               |
| adminCheckinRoutes         | `/api/admin/checkin`          | checkin.ts               |
| developerRoutes            | `/api/developer`              | developer.ts             |
| appVersionRoutes           | `/api/app-version`            | app-version.ts           |
| monitorRoutes              | `/api/monitor`                | monitor.ts               |
| webhooksRoutes             | `/api/developer/webhooks`     | webhooks.ts              |
| packagesRoutes             | `/api/packages`               | packages.ts              |
| fundRoutes                 | `/api/fund`                   | fund.ts                  |
| walletRoutes               | `/api/wallet`                 | wallet.ts                |
| traderRoutes               | `/api/trader`                 | trader.ts                |
| sdksRoutes                 | `/api/sdks`                   | sdks.ts                  |
| miniprogramRoutes          | `/api/miniprogram`            | miniprogram.ts           |
| productIdentityRoutes      | `/api/product-identity`       | product-identity.ts      |
| groupsRoutes               | `/api/groups`                 | groups.ts                |
| pricingRoutes              | `/api`                        | pricing.ts               |
| aiUserModelChatRoutes      | `/api/ai`                     | ai-user-model-chat.ts    |
| adminFaqRoutes             | `/api/admin/faq`              | admin-faq.ts             |
| adminZoneRoutes            | `/api/admin/zones`            | admin-zone.ts            |
| adminDemandSquareRoutes    | `/api/admin/demand-square`    | admin-demand-square.ts   |
| zhsCourseRoutes            | `/api/course`                 | zhs-course.ts            |
| shareContentRoutes         | `/api/share`                  | share-content.ts         |
| legacyCompletionRoutes     | `/api/legacy`                 | legacy-completion.ts     |
| aiFeedRoutes               | `/api/ai-feed`                | ai-feed.ts               |
| aiEducationRoutes          | `/api/ai-education`           | ai-education.ts          |
| fileVersionRoutes          | `/api`                        | file-version.ts          |
| callbackLogRoutes          | `/api/callback-log`           | callback-log.ts          |
| chunkedUploadRoutes        | `/api`                        | chunked-upload.ts        |
| financeExtendedRoutes      | `/api`                        | finance-extended.ts      |
| paymentExtendedRoutes      | `/api`                        | payment-extended.ts      |
| authIdentityRoutes         | `/api`                        | auth-identity.ts         |
| remoteExtendedRoutes       | `/api`                        | remote-extended.ts       |
| notificationExtendedRoutes | `/api`                        | notification-extended.ts |
| contentExtendedRoutes      | `/api`                        | content-extended.ts      |
| organizationRoutes         | `/api`                        | organization.ts          |
| aiImageEditRoutes          | `/api`                        | ai-image-edit.ts         |
| featureCenterRoutes        | `/api/feature-center`         | feature-center.ts        |
| askExtendedRoutes          | `/api`                        | ask-extended.ts          |
| educationPlatformRoutes    | `/api/education-platform`     | education-platform.ts    |
| adminSensitiveWordsRoutes  | `/api/admin`                  | admin-sensitive-words.ts |
| agreementPublicRoutes      | `/api`                        | admin-agreements.ts      |
| adminAgreementsRoutes      | `/api/admin`                  | admin-agreements.ts      |
| exchangeRatePublicRoutes   | `/api`                        | admin-exchange-rate.ts   |
| adminExchangeRateRoutes    | `/api/admin`                  | admin-exchange-rate.ts   |
| adminPrivateLettersRoutes  | `/api/admin`                  | admin-private-letters.ts |
| adminExtendedRoutes        | `/api/admin`                  | admin-extended.ts        |
| srsRoutes                  | `/api/srs`                    | srs.ts                   |
| remoteDeviceRoutes         | `/api`                        | remote-device.ts         |
| aiWorldRoutes              | `/api`                        | ai-world.ts              |
| biDashboardRoutes          | `/api`                        | bi-dashboard.ts          |
| dramaRoutes                | `/api`                        | drama.ts                 |
| distributionRoutes         | `/api`                        | distribution.ts          |
| adminGrayReleaseRoutes     | `/api/admin`                  | admin-gray-release.ts    |
| adminErrorDashboardRoutes  | `/api/admin`                  | admin-error-dashboard.ts |
| adminApiPlatformRoutes     | `/api/admin`                  | admin-api-platform.ts    |

---

## 按前缀分组的完整路由清单

### `/api`（通用模块，前缀为 /api）

#### health.ts（healthRoutes → `/api`）

- GET `/api/health`
- GET `/api/health/ready`
- GET `/api/health/live`
- GET `/api/health/metrics`
- GET `/api/health/history`
- GET `/api/openapi/tags`
- GET `/api/openapi/tag/:tagName`
- POST `/api/resilience/reset/:circuitName`

#### files.ts（fileRoutes → `/api`）

- POST `/api/files/upload/base64`
- GET `/api/files/search`
- GET `/api/files/recent`
- GET `/api/files/shared/:token`
- GET `/api/files/:id/tags`
- POST `/api/files/:id/tags`
- DELETE `/api/files/:id/tags/:tagId`
- POST `/api/files/:id/share`
- DELETE `/api/files/shares/:id`
- POST `/api/files/upload/form`
- POST `/api/files/upload/octet`

#### notifications.ts（notificationRoutes → `/api`）

- GET `/api/notifications/unread-count`
- PATCH `/api/notifications/:id/read`
- DELETE `/api/notifications/:id`
- GET `/api/conversations`
- GET `/api/conversations/:userId`
- POST `/api/conversations`
- GET `/api/admin/notifications`

#### billing.ts（billingRoutes → `/api`）

- GET `/api/plans`
- GET `/api/plans/:id`

#### search.ts（searchRoutes → `/api`）

- DELETE `/api/search/history`
- DELETE `/api/search/history/:id`
- GET `/api/search/hot-words`
- POST `/api/search/hot-words`
- PUT `/api/search/hot-words/:id`
- DELETE `/api/search/hot-words/:id`

#### rbac.ts（rbacRoutes → `/api`）

- GET `/api/roles/:id`
- PATCH `/api/roles/:id`
- DELETE `/api/roles/:id`
- GET `/api/permissions/:id`
- PATCH `/api/permissions/:id`
- DELETE `/api/permissions/:id`
- GET `/api/users/:id/roles`
- POST `/api/users/:id/roles`
- GET `/api/admin/rbac/check`

#### workflows.ts（workflowRoutes → `/api`）

- GET `/api/workflows/instances`
- GET `/api/workflows/instances/timeout`
- GET `/api/workflows/instances/:id`
- GET `/api/workflows/instances/:id/tasks`
- GET `/api/workflows/instances/:id/logs`
- POST `/api/workflows/instances/:id/cancel`
- POST `/api/workflows/instances/:id/retry`
- GET `/api/workflows/:id`
- PATCH `/api/workflows/:id`
- DELETE `/api/workflows/:id`

#### comments.ts（commentRoutes → `/api`）

- GET `/api/comments`
- POST `/api/comments`
- GET `/api/comments/:id`
- PATCH `/api/comments/:id`
- DELETE `/api/comments/:id`
- POST `/api/comments/:id/like`
- DELETE `/api/comments/:id/like`
- GET `/api/comments/:id/replies`
- POST `/api/feedbacks`
- GET `/api/feedbacks`
- GET `/api/feedbacks/:id`
- GET `/api/admin/feedbacks`
- PATCH `/api/admin/feedbacks/:id`

#### community.ts（communityRoutes → `/api`）

- PATCH `/api/circles/posts/:id`
- DELETE `/api/circles/posts/:id`
- POST `/api/circles`
- PUT `/api/circles/:id`
- POST `/api/circles/posts/:id/like`
- GET `/api/circles/posts/:id/comments`
- POST `/api/circles/posts/:id/comment`
- GET `/api/circles/topic/list`
- GET `/api/circles/topic/:tid`
- POST `/api/circles/topic`
- PUT `/api/circles/topic/:tid`
- DELETE `/api/circles/topic/:tid`
- GET `/api/circles/category-relation/list`
- POST `/api/circles/category-relation`
- DELETE `/api/circles/category-relation/:rid`
- GET `/api/circles/circle-category-relation/list`
- POST `/api/circles/circle-category-relation`
- DELETE `/api/circles/circle-category-relation/:rid`
- PATCH `/api/asks/:id`
- DELETE `/api/asks/:id`
- DELETE `/api/admin/circles/:id`
- PUT `/api/admin/circles/:id/show`

#### social.ts（socialRoutes → `/api`）

- GET `/api/follows/following`
- GET `/api/follows/followers`
- GET `/api/follows/:userId/status`
- GET `/api/follows/mutual/:userId`
- GET `/api/follows/:userId/stats`
- DELETE `/api/favorites/:resourceType/:resourceId`
- GET `/api/favorites/check/:resourceType/:resourceId`
- POST `/api/subscriptions`
- DELETE `/api/subscriptions/:targetType/:targetId`
- GET `/api/subscriptions`
- GET `/api/tags`
- GET `/api/tags/:slug`
- POST `/api/tags`
- PATCH `/api/tags/:id`
- DELETE `/api/tags/:id`
- POST `/api/tags/:id/attach`
- DELETE `/api/tags/:id/attach/:resourceType/:resourceId`
- GET `/api/tags/:id/resources`

#### promotions.ts（promotionRoutes → `/api`）

- POST `/api/invitations`
- GET `/api/invitations`
- GET `/api/invitations/invitees`
- POST `/api/invitations/:code/verify`
- GET `/api/activities`
- GET `/api/activities/:slug`
- POST `/api/activities/:id/join`
- DELETE `/api/activities/:id/join`
- GET `/api/activities/:id/participants`
- POST `/api/coupons/verify`

#### content.ts（contentRoutes → `/api`）

- GET `/api/announcements/unread/count`
- GET `/api/announcements/:id`
- POST `/api/announcements/:id/read`
- GET `/api/help/categories`
- GET `/api/help/articles/:slug`
- GET `/api/docs/:slug`

#### learn.ts（learnRoutes → `/api`）

- GET `/api/learn/categories`
- GET `/api/learn/lessons`
- GET `/api/learn/lessons/:id`
- GET `/api/learn/my-lessons`
- POST `/api/learn/lessons/:id/sign-up`
- GET `/api/learn/lessons/:id/progress`
- POST `/api/learn/lessons/:id/progress`
- GET `/api/learn/maps`
- GET `/api/learn/maps/recommend`
- GET `/api/learn/maps/hot`
- GET `/api/learn/maps/:id`
- GET `/api/learn/maps/favorites`
- GET `/api/learn/lessons/:lessonId/rates`
- POST `/api/learn/lessons/:lessonId/rates`
- GET `/api/learn/lessons/:lessonId/rates/my`

#### gamification.ts（gamificationRoutes → `/api`）

- GET `/api/points`
- GET `/api/points/transactions`
- POST `/api/points/admin/adjust`
- GET `/api/leaderboard`
- POST `/api/sign-in`
- GET `/api/sign-in/today`
- GET `/api/sign-in/history`
- GET `/api/levels`
- GET `/api/levels/current`

#### system.ts（systemRoutes → `/api`）

- GET `/api/configs`

#### exam.ts（examRoutes → `/api`）

- GET `/api/exam/categories`
- GET `/api/exam/papers`
- GET `/api/exam/papers/:id`
- GET `/api/exam/papers/:id/questions`
- POST `/api/exam/papers/:id/start`
- POST `/api/exam/records/:id/submit`
- GET `/api/exam/records`
- GET `/api/exam/records/:id`
- GET `/api/exam/composition/list`
- GET `/api/exam/composition/:eid`
- GET `/api/exam/composition/rule/list`
- GET `/api/exam/composition/signup/list`
- GET `/api/exam/composition/signup/my`
- GET `/api/exam/composition/signup/:sid`
- POST `/api/exam/composition/signup`
- PUT `/api/exam/composition/signup/:sid`
- DELETE `/api/exam/composition/signup/:sid`
- POST `/api/exam/composition/signup/:sid/submit`
- GET `/api/exam/wrong/list`
- PUT `/api/exam/wrong/:wid/master`
- GET `/api/exam/papers/:id/chapters`
- POST `/api/exam/papers/:id/chapters`
- PUT `/api/exam/papers/:id/chapters/:chapterId`
- DELETE `/api/exam/papers/:id/chapters/:chapterId`
- GET `/api/exam/papers/:id/chapters/:chapterId/sections`
- POST `/api/exam/papers/:id/chapters/:chapterId/sections`
- PUT `/api/exam/sort-order`
- GET `/api/exam/signups`
- GET `/api/exam/records/pending-marks`

#### order.ts（orderRoutes → `/api`）

- POST `/api/orders`
- GET `/api/orders/me`
- GET `/api/orders/:id`
- POST `/api/orders/:id/cancel`
- POST `/api/orders/:id/refund`
- POST `/api/orders/:id/payment`
- GET `/api/payments/me`
- GET `/api/payments/:id`
- POST `/api/payments/:id/cancel`
- GET `/api/refunds/me`
- GET `/api/refunds/:id`
- GET `/api/invoices/titles`
- POST `/api/invoices/titles`
- PUT `/api/invoices/titles/:id`
- DELETE `/api/invoices/titles/:id`
- GET `/api/invoices/applications`
- POST `/api/invoices/applications`
- PUT `/api/invoices/applications/:id`
- DELETE `/api/invoices/applications/:id`

#### live.ts（liveRoutes → `/api`）

- GET `/api/live/categories`
- GET `/api/live/channels`
- GET `/api/live/channels/by-ids`
- GET `/api/live/channels/:id`
- GET `/api/live/lecturers`
- GET `/api/live/lecturers/:id`
- GET `/api/live/statistics`
- POST `/api/live/notify/stream-begin`
- POST `/api/live/notify/stream-end`

#### member.ts（memberRoutes → `/api`）

- POST `/api/members/register`
- POST `/api/members/register/mobile`
- GET `/api/members/by-id`
- GET `/api/members/by-ids`
- GET `/api/members/auth-list`
- GET `/api/members`
- GET `/api/members/unaudited`
- GET `/api/members/statistics`
- GET `/api/members/companies`

#### resource.ts（resourceRoutes → `/api`）

- GET `/api/resources/categories`
- GET `/api/resources/categories/:id`
- GET `/api/resources`
- GET `/api/resources/by-ids`
- GET `/api/resources/:id`
- GET `/api/resources/products/:id`
- GET `/api/resources/tags/:id`

#### point.ts（pointRoutes → `/api`）

- GET `/api/edu-points/channels`
- GET `/api/edu-points/channels/:id`
- GET `/api/edu-points/rules/:id`
- GET `/api/edu-points/my-points`

#### schedule.ts（scheduleRoutes → `/api`）

- GET `/api/schedule/tasks`
- GET `/api/schedule/tasks/:id`
- GET `/api/schedule/logs`
- GET `/api/schedule/logs/:id`

#### statistics.ts（statisticsRoutes → `/api`）

- GET `/api/statistics/message`
- GET `/api/statistics/live`
- GET `/api/statistics/point`
- GET `/api/statistics/resource`
- GET `/api/statistics/user-center`
- GET `/api/visit-tracking/visits`
- POST `/api/statistics/agent-heat/refresh`

#### message.ts（messageRoutes → `/api`）

- GET `/api/messages/announcements`
- GET `/api/messages/announcements/:id`
- GET `/api/messages`
- GET `/api/messages/unread-count`
- PUT `/api/messages/:id/read`
- POST `/api/messages/read-all`
- DELETE `/api/messages/:id`
- DELETE `/api/messages/batch-delete`
- GET `/api/messages/private/list`
- GET `/api/messages/private/conversation/list`
- POST `/api/messages/private`
- POST `/api/messages/private/:pid/read`
- DELETE `/api/messages/private/:pid`
- GET `/api/messages/system-notice/list`

#### topic.ts（topicRoutes → `/api`）

- GET `/api/topics`
- GET `/api/topics/:id`

#### behavior.ts（behaviorRoutes → `/api`）

- POST `/api/behavior/watch`
- GET `/api/behavior/watch/count`
- GET `/api/behavior/watch/list`
- DELETE `/api/behavior/watch`
- DELETE `/api/behavior/watch/all`
- POST `/api/behavior/like`
- DELETE `/api/behavior/like`
- GET `/api/behavior/like/check`
- GET `/api/behavior/like/list`
- GET `/api/behavior/like/count`
- POST `/api/behavior/favorite`
- DELETE `/api/behavior/favorite`
- GET `/api/behavior/favorite/check`
- GET `/api/behavior/favorite/list`
- GET `/api/behavior/statistics`

#### visit-tracking.ts（visitTrackingRoutes → `/api`）

- POST `/api/visit-tracking/source/record`
- POST `/api/visit-tracking/page/record`

#### oss.ts（ossRoutes → `/api`）

- GET `/api/oss/drivers`
- POST `/api/oss/upload`
- GET `/api/oss/download/:id`

#### setting.ts（settingRoutes → `/api`）

- GET `/api/settings`
- GET `/api/settings/:group`
- GET `/api/edu-settings`
- GET `/api/edu-settings/:id`

#### news.ts（newsRoutes → `/api`）

- GET `/api/news/categories`
- GET `/api/news/articles`
- GET `/api/news/articles/pinned`
- GET `/api/news/articles/recommended`
- GET `/api/news/articles/:id`

#### certificate.ts（certificateRoutes → `/api`）

- GET `/api/certificates/verify`
- GET `/api/certificates/my`
- POST `/api/certificates/:id/download`

#### agents.ts（agentsRoutes → `/api`）

- GET `/api/agents/list`
- GET `/api/agents/:agentId`
- POST `/api/agents/create`
- PUT `/api/agents/:agentId`
- DELETE `/api/agents/:agentId`
- GET `/api/categories/list`
- POST `/api/categories/create`
- POST `/api/categories/batch-query`
- GET `/api/categories/ids/:idList`
- GET `/api/categories/stats/summary`
- GET `/api/categories/agent/:agentId`
- GET `/api/categories/:categoryId`
- PUT `/api/categories/:categoryId`
- DELETE `/api/categories/:categoryId`
- POST `/api/categories/:categoryId/enable`
- POST `/api/categories/:categoryId/disable`
- GET `/api/categories/cache/info`
- POST `/api/categories/cache/reload`
- GET `/api/categories/cache/convert`
- GET `/api/categories/cache/categories`
- GET `/api/categories/cache/agent/:agentId`
- GET `/api/categories/cache/category/:categoryId`
- GET `/api/categories/cache/all`
- DELETE `/api/categories/cache/clear`
- GET `/api/categories/cache/search`
- GET `/api/settlement/list`
- GET `/api/settlement/summary`
- POST `/api/settlement/settle`
- GET `/api/settlement/unsettled`
- GET `/api/settlement/cache/info`
- POST `/api/settlement/cache/force-check`
- POST `/api/settlement/cache/force-refresh`
- POST `/api/settlement/create`
- POST `/api/settlement/sync-existing`
- POST `/api/settlement/sync-single/:buyRecordId`
- POST `/api/settlement/batch-delete`
- GET `/api/settlement/order/:orderNo/summary`
- GET `/api/settlement/stats/income-overview`
- GET `/api/examine/list`
- GET `/api/examine/stats/summary`
- POST `/api/examine/submit`
- GET `/api/examine/:recordId`
- PUT `/api/examine/:recordId`
- DELETE `/api/examine/:recordId`
- PUT `/api/examine/:recordId/approve`
- PUT `/api/examine/:recordId/reject`
- POST `/api/examine/:recordId/return`
- POST `/api/examine/batch-approve`
- POST `/api/examine/batch-reject`
- GET `/api/oauth-apps/list`
- GET `/api/oauth-apps/audit-logs/stats`
- GET `/api/oauth-apps/audit-logs/export`
- GET `/api/oauth-apps/audit-logs`
- GET `/api/oauth-apps/scopes`
- GET `/api/oauth-apps/:clientId`
- POST `/api/oauth-apps`
- PUT `/api/oauth-apps/:clientId`
- DELETE `/api/oauth-apps/:clientId`
- POST `/api/oauth-apps/:clientId/regenerate-secret`
- GET `/api/settlement/:id`
- PUT `/api/settlement/:id`
- GET `/api/agents/need-tasks`
- GET `/api/agents/need-tasks/:id`
- POST `/api/agents/need-tasks`
- PUT `/api/agents/need-tasks/:id`
- DELETE `/api/agents/need-tasks/:id`

#### payment-gateway.ts（paymentGatewayRoutes → `/api`）

- POST `/api/payments/wechat/create`
- POST `/api/payments/wechat/android/create`
- POST `/api/payments/wechat/course/create`
- POST `/api/payments/wechat/notify`
- POST `/api/payments/wechat/notify/refund`
- POST `/api/payments/wechat/query`
- POST `/api/payments/wechat/close`
- POST `/api/payments/wechat/refund`
- GET `/api/payments/wechat/status/:outTradeNo`
- POST `/api/payments/alipay/create`
- POST `/api/payments/alipay/app/create`
- POST `/api/payments/alipay/notify`
- POST `/api/payments/alipay/query`
- POST `/api/payments/alipay/refund`
- POST `/api/payments/createOrder`
- POST `/api/payments/wechatPay`
- POST `/api/payments/transfer`
- POST `/api/payments/withdrawal`
- GET `/api/payments/success`
- GET `/api/payments/fail`
- GET `/api/payments/reconciliation/pending`
- POST `/api/payments/reconciliation/close_expired`
- GET `/api/payments/reconciliation/alipay`
- GET `/api/payments/reconciliation/wechat`
- GET `/api/payments/reconciliation/all`

#### refund-audit.ts（refundAuditRoutes → `/api`）

- GET `/api/refunds`
- POST `/api/refunds/:id/audit`
- POST `/api/refunds/:id/reject`
- GET `/api/refunds/:id`
- GET `/api/refunds/stats`

#### finance.ts（financeRoutes → `/api`）

- GET `/api/finance/margin/balance`
- GET `/api/finance/margin/check`
- POST `/api/finance/margin/deduct`
- POST `/api/finance/margin/recharge`
- POST `/api/finance/margin/expire`
- POST `/api/finance/margin/commission`
- POST `/api/finance/margin/refund`
- GET `/api/finance/margin/flows`
- GET `/api/finance/commission/list`
- GET `/api/finance/commission/summary`
- GET `/api/finance/commission/orders`
- GET `/api/finance/distribution/subordinates`
- GET `/api/finance/distribution/team/center`
- GET `/api/finance/distribution/invitee-stats`
- POST `/api/finance/withdrawal/apply`
- GET `/api/finance/withdrawal/list`
- GET `/api/finance/withdrawal/summary`
- GET `/api/finance/withdrawal/available`

#### auth-extended.ts（authExtendedRoutes → `/api`）

- POST `/api/auth/login/email`
- POST `/api/auth/login/username`
- POST `/api/auth/email/code`
- GET `/api/auth/exist/:phone`
- GET `/api/auth/info`
- PUT `/api/auth/profile`
- PUT `/api/auth/profile/password`
- DELETE `/api/auth/cancel`
- GET `/api/auth/google/pc/wxCode`
- GET `/api/auth/google/android/wxCode`
- GET `/api/auth/google/config`
- GET `/api/auth/wechat/mini/login`
- POST `/api/auth/wechat/mini/phone`
- POST `/api/auth/wechat/mini/rebind`
- GET `/api/auth/login/enterprise/pc/wxCode`
- GET `/api/auth/dingtalk/auth-url`
- GET `/api/auth/dingtalk/login`
- GET `/api/auth/captcha`
- POST `/api/auth/captcha/verify`
- POST `/api/auth/sms/code`
- POST `/api/sms-proxy/send`
- POST `/api/sms-proxy/verify`
- POST `/api/sms-proxy/register`
- GET `/api/sms-proxy/config`
- GET `/api/auth/oauth/authorize`
- POST `/api/auth/oauth/token`
- POST `/api/auth/oauth/apps/create`
- GET `/api/auth/oauth/apps/list`
- DELETE `/api/auth/oauth/apps/:clientId`
- GET `/api/auth/oauth/my-authorized`
- DELETE `/api/auth/oauth/my-authorized/:sessionId`
- GET `/api/auth/oauth/scope-meta`
- GET `/api/auth/bindings`
- DELETE `/api/auth/bindings/:id`
- POST `/api/auth/bindings/remove`
- POST `/api/auth/user-sk/create`
- GET `/api/auth/user-sk/list`
- PUT `/api/auth/user-sk/:skId`
- DELETE `/api/auth/user-sk/:skId`
- POST `/api/oauth/device`
- POST `/api/oauth/device/token`
- POST `/api/oauth/device/refresh`
- POST `/api/oauth/web/authorize`
- POST `/api/oauth/web/token`
- POST `/api/oauth/web/refresh`
- POST `/api/oauth/pkce/authorize`
- POST `/api/oauth/pkce/token`
- POST `/api/oauth/pkce/refresh`
- POST `/api/oauth/jwt/token`
- POST `/api/oauth/authorize/confirm`
- POST `/api/oauth/access_token`
- POST `/api/oauth/token/exchange`
- GET `/api/oauth/token/test`
- POST `/api/oauth/debug/callback`
- GET `/api/oauth/sms-config`
- POST `/api/oauth/debug/create-test-session`
- GET `/api/oauth/sms-login`

#### vip.ts（vipRoutes → `/api`）

- GET `/api/vip/levels`
- GET `/api/vip/products`
- GET `/api/vip/my`
- POST `/api/vip/purchase`

#### edu-public.ts（eduPublicRoutes → `/api`）

- GET `/api/edu/my-lessons`
- GET `/api/edu/my-notes`
- POST `/api/edu/notes`
- PUT `/api/edu/notes/:id`
- DELETE `/api/edu/notes/:id`
- GET `/api/edu/my-certificates`
- GET `/api/edu/my-uploaded-certs`
- POST `/api/edu/uploaded-certs`
- DELETE `/api/edu/uploaded-certs/:id`
- GET `/api/edu/my-offline-records`
- POST `/api/edu/offline-records`
- PUT `/api/edu/offline-records/:id`
- DELETE `/api/edu/offline-records/:id`
- GET `/api/edu/my-papers`
- POST `/api/edu/papers`
- DELETE `/api/edu/papers/:id`
- GET `/api/edu/wrong-book`
- GET `/api/edu/my-report`

#### pricing.ts（pricingRoutes → `/api`）

- GET `/api/pricing/models`
- POST `/api/pricing/models`
- GET `/api/pricing/calculate`
- GET `/api/pricing/regions`

#### clawdbot.ts（clawdbotRoutes → `/api`）

- GET `/api/clawdbot/status`
- POST `/api/clawdbot/initialize`
- POST `/api/clawdbot/shutdown`
- POST `/api/clawdbot/chat`
- GET `/api/clawdbot/tools`
- POST `/api/clawdbot/tools/:name/execute`
- GET `/api/clawdbot/tasks`
- POST `/api/clawdbot/tasks`
- POST `/api/clawdbot/tasks/:id/execute`
- GET `/api/clawdbot/memory`
- POST `/api/clawdbot/memory`
- GET `/api/clawdbot/skills`
- POST `/api/clawdbot/skills/:name/execute`
- GET `/api/clawdbot/models`
- POST `/api/clawdbot/models/complete`
- GET `/api/clawdbot/system/health`
- GET `/api/clawdbot/system/metrics`
- GET `/api/clawdbot/system/logs`
- GET `/api/clawdbot/channels`
- POST `/api/clawdbot/channels/:id/send`
- GET `/api/clawdbot/canvas`
- POST `/api/clawdbot/canvas/:id/execute`
- GET `/api/clawdbot/mcp/servers`
- GET `/api/clawdbot/mcp/tools`
- POST `/api/clawdbot/mcp/tools/:name/call`
- POST `/api/clawdbot/pairing/request`
- POST `/api/clawdbot/pairing/confirm`
- POST `/api/clawdbot/voice/asr`
- POST `/api/clawdbot/voice/tts`
- POST `/api/clawdbot/browser/navigate`
- POST `/api/clawdbot/browser/scrape`
- GET `/api/clawdbot/integrations`
- POST `/api/clawdbot/integrations/call`
- GET `/api/clawdbot/evolution/status`
- POST `/api/clawdbot/evolution/evolve`
- GET `/api/clawdbot/evolution/gaps`

#### edu-extended.ts（adminEduExtendedRoutes → `/api`）

- GET `/api/admin/edu/notes/list`
- GET `/api/admin/edu/notes/:id`
- POST `/api/admin/edu/notes`
- PUT `/api/admin/edu/notes/:id`
- DELETE `/api/admin/edu/notes/:id`
- GET `/api/admin/edu/offline-records/list`
- GET `/api/admin/edu/offline-records/:id`
- POST `/api/admin/edu/offline-records`
- PUT `/api/admin/edu/offline-records/:id`
- DELETE `/api/admin/edu/offline-records/:id`
- GET `/api/admin/edu/uploaded-certs/list`
- GET `/api/admin/edu/uploaded-certs/:id`
- POST `/api/admin/edu/uploaded-certs`
- PUT `/api/admin/edu/uploaded-certs/:id`
- DELETE `/api/admin/edu/uploaded-certs/:id`
- PUT `/api/admin/edu/uploaded-certs/:id/verify`
- GET `/api/admin/edu/uploaded-papers/list`
- GET `/api/admin/edu/uploaded-papers/:id`
- POST `/api/admin/edu/uploaded-papers`
- PUT `/api/admin/edu/uploaded-papers/:id`
- DELETE `/api/admin/edu/uploaded-papers/:id`
- PUT `/api/admin/edu/uploaded-papers/:id/verify`
- GET `/api/admin/edu/exam/arrangements`
- POST `/api/admin/edu/exam/arrangements`
- PUT `/api/admin/edu/exam/arrangements/:id`
- DELETE `/api/admin/edu/exam/arrangements/:id`
- GET `/api/admin/edu/exam/templates`
- POST `/api/admin/edu/exam/templates`
- PUT `/api/admin/edu/exam/templates/:id`
- DELETE `/api/admin/edu/exam/templates/:id`
- POST `/api/admin/edu/exam/papers/:id/assemble`
- POST `/api/admin/edu/exam/papers/random-assemble`
- POST `/api/admin/edu/answer/run-code`
- GET `/api/course-audit/list`
- GET `/api/course-audit/:id`
- POST `/api/course-audit`
- PUT `/api/course-audit/:id`
- DELETE `/api/course-audit/:id`

#### file-version.ts（fileVersionRoutes → `/api`）

- POST `/api/file-versions/create`
- GET `/api/file-versions/list/:fileId`
- GET `/api/file-versions/current/:fileId`
- GET `/api/file-versions/:versionId`
- POST `/api/file-versions/rollback/:versionId`
- DELETE `/api/file-versions/:versionId`
- GET `/api/file-versions/compare/:fileId`

#### chunked-upload.ts（chunkedUploadRoutes → `/api`）

- POST `/api/chunked-upload/init`
- POST `/api/chunked-upload/upload`
- POST `/api/chunked-upload/merge`
- DELETE `/api/chunked-upload/cancel`
- GET `/api/chunked-upload/status`

#### finance-extended.ts（financeExtendedRoutes → `/api`）

- GET `/api/finance/distribution/team-stats`
- GET `/api/finance/distribution/subordinate-stats`
- GET `/api/finance/distribution/invitation-summary`
- POST `/api/finance/agent-withdrawal/apply`
- GET `/api/finance/agent-withdrawal/list`
- POST `/api/finance/agent-withdrawal/:id/approve`
- POST `/api/finance/agent-withdrawal/:id/reject`
- POST `/api/admin/finance/margin/adjust`
- GET `/api/admin/finance/fund/audit/list`
- POST `/api/admin/finance/fund/audit/:id`

#### payment-extended.ts（paymentExtendedRoutes → `/api`）

- POST `/api/payments/withdrawal/notify`
- GET `/api/payments/sync-return`
- POST `/api/payments/subscription/renew`
- GET `/api/payments/subscription/status`

#### auth-identity.ts（authIdentityRoutes → `/api`）

- POST `/api/auth/realname/submit`
- GET `/api/auth/realname/my`
- GET `/api/auth/realname/list`
- PUT `/api/auth/realname/:userUuid/audit`

#### remote-extended.ts（remoteExtendedRoutes → `/api`）

- GET `/api/remote/user/info`
- POST `/api/remote/business-card/upload`
- GET `/api/remote/agent/favorites`
- POST `/api/remote/agent/favorite`
- DELETE `/api/remote/agent/favorite/:agentId`
- POST `/api/remote/tencent/asr`
- GET `/api/remote/withdrawal/switch`
- PUT `/api/remote/withdrawal/switch`
- GET `/api/remote/user/stats`
- GET `/api/remote/agent/hot`
- POST `/api/remote/feedback`
- GET `/api/remote/config`

#### notification-extended.ts（notificationExtendedRoutes → `/api`）

- GET `/api/notifications/channels`
- POST `/api/notifications/channels`
- PUT `/api/notifications/channels/:id`
- DELETE `/api/notifications/channels/:id`
- GET `/api/notifications/preferences`
- PUT `/api/notifications/preferences`
- GET `/api/notifications/logs`

#### content-extended.ts（contentExtendedRoutes → `/api`）

- GET `/api/content/activities/list`
- POST `/api/content/activities`
- PUT `/api/content/activities/:id`
- DELETE `/api/content/activities/:id`
- GET `/api/content/contacts/list`
- PUT `/api/content/contacts/:id`
- GET `/api/content/file-storage/list`
- DELETE `/api/content/file-storage/:id`
- GET `/api/content/aigc/list`
- POST `/api/content/aigc`
- GET `/api/content/banners/list`
- PUT `/api/content/banners/:id`

#### organization.ts（organizationRoutes → `/api`）

- GET `/api/organizations/list`
- POST `/api/organizations`
- PUT `/api/organizations/:id`
- DELETE `/api/organizations/:id`
- GET `/api/organizations/:id/members`
- POST `/api/organizations/:id/members`
- DELETE `/api/organizations/:id/members/:userId`
- GET `/api/organizations/:id/tree`
- PUT `/api/organizations/:id/members/:userId/role`

#### ai-image-edit.ts（aiImageEditRoutes → `/api`）

- POST `/api/ai-image/doubao/edit`
- POST `/api/ai-image/doubao/inpaint`
- POST `/api/ai-image/tongyi/edit`
- POST `/api/ai-image/tongyi/text-to-image`
- POST `/api/ai-image/tongyi/image-to-image`
- GET `/api/ai-image/history`
- GET `/api/ai-image/history/:id`
- DELETE `/api/ai-image/history/:id`
- GET `/api/ai-image/doubao/models`
- GET `/api/ai-image/tongyi/models`
- GET `/api/ai-image/tongyi/image2image/models`
- POST `/api/ai-image/tongyi/style-transfer`
- POST `/api/ai-image/tongyi/background-generation`
- POST `/api/ai-image/tongyi/virtual-try-on`
- POST `/api/ai-image/user-agent`
- GET `/api/ai-image/user-agent/list`
- GET `/api/ai-image/user-agent/:id`
- DELETE `/api/ai-image/user-agent/:id`

#### ask-extended.ts（askExtendedRoutes → `/api`）

- PATCH `/api/asks/answers/:id`
- DELETE `/api/asks/answers/:id`
- POST `/api/asks/:id/like`
- POST `/api/asks/:id/favorite`
- GET `/api/asks/:id/comments`
- POST `/api/asks/:id/comments`
- GET `/api/asks/categories`
- GET `/api/asks/categories/tree`
- POST `/api/asks/categories`
- PUT `/api/asks/categories/:id`
- DELETE `/api/asks/categories/:id`
- GET `/api/asks/stats`

#### ai-world.ts（aiWorldRoutes → `/api`）

- GET `/api/ai-world`

#### bi-dashboard.ts（biDashboardRoutes → `/api`）

- GET `/api/bi/dashboard`

#### drama.ts（dramaRoutes → `/api`）

- POST `/api/drama/scripts/:id/enhance`

#### distribution.ts（distributionRoutes → `/api`）

- GET `/api/distribution/overview`
- GET `/api/distribution/invited-users`
- GET `/api/distribution/tree`
- GET `/api/distribution/stats`
- GET `/api/distribution/commission-rates`
- GET `/api/distribution/levels`

#### remote-device.ts（remoteDeviceRoutes → `/api`）

- GET `/api/remote-devices`
- GET `/api/remote-devices/:id`
- POST `/api/remote-devices`
- PUT `/api/remote-devices/:id`
- DELETE `/api/remote-devices/:id`
- POST `/api/remote-devices/:id/heartbeat`
- GET `/api/remote-devices/:id/tasks`
- POST `/api/remote-devices/:id/tasks`
- GET `/api/remote-device-tasks/:taskId`
- PUT `/api/remote-device-tasks/:taskId/status`
- DELETE `/api/remote-device-tasks/:taskId`
- POST `/api/remote-device-tasks/:taskId/retry`
- GET `/api/remote-device-tasks/pending`

#### ai-callback.ts（aiCallbackRoutes，无前缀）

- POST `/api/ai/callback`

---

### `/api/admin`（管理后台通用模块）

#### admin.ts（adminRoutes → `/api/admin`）

- GET `/api/admin/projects/:id`
- POST `/api/admin/projects`
- PATCH `/api/admin/projects/:id`
- DELETE `/api/admin/projects/:id`

#### audit.ts（auditRoutes → `/api/admin`）

- GET `/api/admin/audit-logs`
- GET `/api/admin/stats/detailed`

#### admin-sys.ts（adminSysRoutes → `/api/admin`，含 11 个嵌套 register 子前缀）

- GET `/api/admin/menu/list`
- GET `/api/admin/menu/treeselect`
- GET `/api/admin/menu/roleMenuTreeselect/:roleId`
- GET `/api/admin/menu/getRouters`
- PUT `/api/admin/menu`
- GET `/api/admin/logininfor/list`
- DELETE `/api/admin/logininfor/clean`
- PUT `/api/admin/logininfor/unlock/:userName`
- GET `/api/admin/notice/list`
- GET `/api/admin/notice/:noticeId`
- POST `/api/admin/notice`
- PUT `/api/admin/notice`
- DELETE `/api/admin/notice/:noticeIds`
- GET `/api/admin/job/list`
- GET `/api/admin/job/:jobId`
- POST `/api/admin/job`
- PUT `/api/admin/job`
- PUT `/api/admin/job/changeStatus`
- PUT `/api/admin/job/run`
- DELETE `/api/admin/job/:jobIds`
- GET `/api/admin/job/log/list`
- DELETE `/api/admin/job/log/clean`
- GET `/api/admin/online/list`
- DELETE `/api/admin/online/:tokenId`
- GET `/api/admin/dept/list`
- GET `/api/admin/dept/list/exclude/:deptId`
- GET `/api/admin/dept/:deptId`
- PUT `/api/admin/dept`
- GET `/api/admin/post/list`
- GET `/api/admin/post/:postId`
- PUT `/api/admin/post`
- DELETE `/api/admin/post/:postIds`
- GET `/api/admin/config/list`
- GET `/api/admin/config/configKey/:configKey`
- GET `/api/admin/config/:configId`
- POST `/api/admin/config`
- PUT `/api/admin/config`
- DELETE `/api/admin/config/:configIds`
- GET `/api/admin/dict/type/list`
- GET `/api/admin/dict/type/optionselect`
- GET `/api/admin/dict/type/:dictId`
- PUT `/api/admin/dict/type`
- DELETE `/api/admin/dict/type/:dictIds`
- GET `/api/admin/dict/data/list`
- GET `/api/admin/dict/data/type/:dictType`
- POST `/api/admin/dict/data`
- GET `/api/admin/dict/data/:dictCode`
- PUT `/api/admin/dict/data`
- DELETE `/api/admin/dict/data/:dictCodes`

#### admin-extended.ts（adminExtendedRoutes → `/api/admin`）

- GET `/api/admin/menu`
- POST `/api/admin/menu`
- PUT `/api/admin/menu/:id`
- DELETE `/api/admin/menu/:id`
- GET `/api/admin/demand-audit`
- GET `/api/admin/demand-audit/:id`
- PUT `/api/admin/demand-audit/:id/audit`
- GET `/api/admin/online-users`
- POST `/api/admin/online-users/:id/force-logout`

#### admin-gray-release.ts（adminGrayReleaseRoutes → `/api/admin`）

- GET `/api/admin/gray-release`
- POST `/api/admin/gray-release`
- POST `/api/admin/gray-release/:id/toggle`

#### admin-error-dashboard.ts（adminErrorDashboardRoutes → `/api/admin`）

- GET `/api/admin/error-dashboard/stats`
- GET `/api/admin/error-dashboard/errors`

#### admin-api-platform.ts（adminApiPlatformRoutes → `/api/admin`）

- GET `/api/admin/api-platform/apps`
- POST `/api/admin/api-platform/apps`
- PATCH `/api/admin/api-platform/apps/:id`
- DELETE `/api/admin/api-platform/apps/:id`
- GET `/api/admin/api-platform/packages`
- POST `/api/admin/api-platform/packages`
- PATCH `/api/admin/api-platform/packages/:id`
- DELETE `/api/admin/api-platform/packages/:id`
- GET `/api/admin/api-platform/billing/summary`
- GET `/api/admin/api-platform/billing`
- GET `/api/admin/api-platform/usage/summary`
- GET `/api/admin/api-platform/usage`

#### admin-sensitive-words.ts（adminSensitiveWordsRoutes → `/api/admin`）

- GET `/api/admin/sensitive-words`
- GET `/api/admin/sensitive-words/:id`
- POST `/api/admin/sensitive-words`
- PUT `/api/admin/sensitive-words/:id`
- DELETE `/api/admin/sensitive-words/:id`
- POST `/api/admin/sensitive-words/filter`

#### admin-agreements.ts（adminAgreementsRoutes → `/api/admin`）

- GET `/api/admin/agreements`
- GET `/api/admin/agreements/:id`
- POST `/api/admin/agreements`
- PUT `/api/admin/agreements/:id`
- DELETE `/api/admin/agreements/:id`

#### admin-exchange-rate.ts（adminExchangeRateRoutes → `/api/admin`）

- GET `/api/admin/exchange-rates`
- POST `/api/admin/exchange-rates`
- PUT `/api/admin/exchange-rates/:id`
- DELETE `/api/admin/exchange-rates/:id`

#### admin-private-letters.ts（adminPrivateLettersRoutes → `/api/admin`）

- GET `/api/admin/private-letters`

#### promotions.ts（adminPromotionRoutes → `/api/admin`）

- POST `/api/admin/activities`
- PATCH `/api/admin/activities/:id`
- DELETE `/api/admin/activities/:id`
- POST `/api/admin/coupons`
- GET `/api/admin/coupons`

#### content.ts（adminContentRoutes → `/api/admin`）

- POST `/api/admin/announcements`
- PATCH `/api/admin/announcements/:id`
- DELETE `/api/admin/announcements/:id`
- GET `/api/admin/help/categories`
- POST `/api/admin/help/categories`
- PATCH `/api/admin/help/categories/:id`
- DELETE `/api/admin/help/categories/:id`
- GET `/api/admin/help/articles`
- POST `/api/admin/help/articles`
- PATCH `/api/admin/help/articles/:id`
- DELETE `/api/admin/help/articles/:id`
- GET `/api/admin/docs`
- POST `/api/admin/docs`
- PATCH `/api/admin/docs/:id`
- DELETE `/api/admin/docs/:id`

#### learn.ts（adminLearnRoutes → `/api/admin`）

- GET `/api/admin/learn/categories`
- POST `/api/admin/learn/categories`
- PUT `/api/admin/learn/categories/:id`
- DELETE `/api/admin/learn/categories/:id`
- GET `/api/admin/learn/lessons`
- GET `/api/admin/learn/lessons/:id`
- GET `/api/admin/learn/lessons/:id/chapters`
- POST `/api/admin/learn/lessons`
- PUT `/api/admin/learn/lessons/:id`
- DELETE `/api/admin/learn/lessons/:id`
- POST `/api/admin/learn/lessons/:id/chapters`
- PUT `/api/admin/learn/lessons/:id/chapters/:chapterId`
- DELETE `/api/admin/learn/lessons/:id/chapters/:chapterId`
- GET `/api/admin/learn/lessons/:id/chapters/:chapterId/sections`
- POST `/api/admin/learn/lessons/:id/chapters/:chapterId/sections`
- PUT `/api/admin/learn/lessons/:id/chapters/:chapterId/sections/:sectionId`
- DELETE `/api/admin/learn/lessons/:id/chapters/:chapterId/sections/:sectionId`
- GET `/api/admin/learn/signups`
- PUT `/api/admin/learn/signups/:id`
- POST `/api/admin/learn/lessons/:id/batch-signup`
- GET `/api/admin/learn/reports/lesson-study`
- GET `/api/admin/learn/reports/signup`
- GET `/api/admin/learn/reports/member-study`
- GET `/api/admin/learn/lessons/:id/homework`
- POST `/api/admin/learn/lessons/:id/homework`
- PUT `/api/admin/learn/lessons/:id/homework/:hwId`
- GET `/api/admin/learn/lessons/:id/exam-paper`
- PUT `/api/admin/learn/lessons/:id/exam-paper`
- PUT `/api/admin/learn/lessons/:id/certificate`
- DELETE `/api/admin/learn/maps/:id`
- PUT `/api/admin/learn/maps/:id/publish`
- PUT `/api/admin/learn/maps/:id/unpublish`
- PUT `/api/admin/learn/topics/:id/publish`
- PUT `/api/admin/learn/topics/:id/unpublish`
- PUT `/api/admin/learn/lessons/sort-order`
- GET `/api/admin/learn/invoices`
- PUT `/api/admin/learn/invoices/:id/approved`
- PUT `/api/admin/learn/invoices/:id/rejected`
- PUT `/api/admin/learn/invoices/:id/invoicing`
- PUT `/api/admin/learn/invoices/:id/invoiced`
- PUT `/api/admin/learn/invoices/:id/canceled`
- GET `/api/admin/learn/invoice-titles`
- POST `/api/admin/learn/invoice-titles`
- PUT `/api/admin/learn/invoice-titles/:id`
- DELETE `/api/admin/learn/invoice-titles/:id`
- GET `/api/admin/learn/reports/company-study`
- POST `/api/admin/learn/maps`
- PUT `/api/admin/learn/maps/:id`
- GET `/api/admin/learn/maps/list`
- GET `/api/admin/learn/maps/:id/detail`
- GET `/api/admin/learn/lessons/:lessonId/tasks`
- POST `/api/admin/learn/lessons/:lessonId/tasks`
- GET `/api/admin/learn/lessons/:lessonId/tasks/:taskId`
- PUT `/api/admin/learn/lessons/:lessonId/tasks/:taskId`
- DELETE `/api/admin/learn/lessons/:lessonId/tasks/:taskId`
- PUT `/api/admin/learn/lessons/:lessonId/tasks/:taskId/status`
- DELETE `/api/admin/learn/rates/:id`
- GET `/api/admin/learn/lessons/:lessonId/access`
- PUT `/api/admin/learn/lessons/:lessonId/access`

#### system.ts（adminSystemRoutes → `/api/admin`）

- GET `/api/admin/configs`
- POST `/api/admin/configs`
- PATCH `/api/admin/configs/:id`
- DELETE `/api/admin/configs/:id`
- GET `/api/admin/integrations`
- POST `/api/admin/integrations`
- PATCH `/api/admin/integrations/:id`
- DELETE `/api/admin/integrations/:id`
- POST `/api/admin/integrations/:id/test`
- GET `/api/admin/logs`
- POST `/api/admin/logs/cleanup`
- GET `/api/admin/logs/stats`
- GET `/api/admin/events`
- POST `/api/admin/events`
- PATCH `/api/admin/events/:id`
- DELETE `/api/admin/events/:id`

#### exam.ts（嵌套 register，child 上的 /admin/exam/* 路径）

- GET `/api/admin/exam/papers`
- POST `/api/admin/exam/papers`
- PUT `/api/admin/exam/papers/:id`
- DELETE `/api/admin/exam/papers/:id`
- POST `/api/admin/exam/papers/:id/questions`
- PUT `/api/admin/exam/questions/:id`
- DELETE `/api/admin/exam/questions/:id`
- GET `/api/admin/exam/papers/:id/questions`
- GET `/api/admin/exam/records`
- GET `/api/admin/exam/records/:id`
- POST `/api/admin/exam/records/:id/grade`
- DELETE `/api/admin/exam/records/:id`
- GET `/api/admin/exam/categories`
- POST `/api/admin/exam/categories`
- PUT `/api/admin/exam/categories/:id`
- DELETE `/api/admin/exam/categories/:id`
- POST `/api/admin/exam/composition`
- PUT `/api/admin/exam/composition/:eid`
- DELETE `/api/admin/exam/composition/:eid`
- POST `/api/admin/exam/composition/rule`
- PUT `/api/admin/exam/composition/rule/:rid`
- DELETE `/api/admin/exam/composition/rule/:rid`

#### order.ts（adminOrderRoutes → `/api/admin`）

- GET `/api/admin/orders`
- POST `/api/admin/orders/complete-saga`
- GET `/api/admin/payments`
- GET `/api/admin/refunds`
- PUT `/api/admin/refunds/:id/process`
- PUT `/api/admin/refunds/:id/handle`
- GET `/api/admin/invoices/applications`
- PUT `/api/admin/invoices/applications/:id/status`

#### live.ts（adminLiveRoutes → `/api/admin`）

- GET `/api/admin/live/categories`
- GET `/api/admin/live/categories/:id`
- POST `/api/admin/live/categories`
- PUT `/api/admin/live/categories/:id`
- DELETE `/api/admin/live/categories/:id`
- GET `/api/admin/live/channels`
- GET `/api/admin/live/channels/:id`
- POST `/api/admin/live/channels`
- PUT `/api/admin/live/channels/:id`
- DELETE `/api/admin/live/channels/:id`
- GET `/api/admin/live/lecturers`
- POST `/api/admin/live/lecturers`
- PUT `/api/admin/live/lecturers/:id`
- DELETE `/api/admin/live/lecturers/:id`
- POST `/api/admin/live/tencent/streams`
- GET `/api/admin/live/tencent/streams`
- GET `/api/admin/live/tencent/callback-templates`

#### member.ts（adminMemberRoutes → `/api/admin`）

- GET `/api/admin/members`
- GET `/api/admin/members/unaudited`
- GET `/api/admin/members/statistics`
- GET `/api/admin/members/companies`
- POST `/api/admin/members`
- PUT `/api/admin/members`
- PUT `/api/admin/members/seal`
- PUT `/api/admin/members/unseal`
- PUT `/api/admin/members/approved`
- PUT `/api/admin/members/reject`
- PUT `/api/admin/members/pwd/reset`
- DELETE `/api/admin/members`
- GET `/api/admin/members/levels`
- GET `/api/admin/members/levels/:id`
- POST `/api/admin/members/levels`
- PUT `/api/admin/members/levels`
- DELETE `/api/admin/members/levels`
- GET `/api/admin/members/companies/list`
- GET `/api/admin/members/companies/:id`
- POST `/api/admin/members/companies`
- PUT `/api/admin/members/companies/:id`
- DELETE `/api/admin/members/companies/:id`
- GET `/api/admin/members/departments`
- GET `/api/admin/members/departments/:id`
- POST `/api/admin/members/departments`
- PUT `/api/admin/members/departments/:id`
- DELETE `/api/admin/members/departments/:id`
- GET `/api/admin/members/groups`
- POST `/api/admin/members/groups`
- PUT `/api/admin/members/groups/:id`
- DELETE `/api/admin/members/groups/:id`
- GET `/api/admin/members/posts`
- POST `/api/admin/members/posts`
- PUT `/api/admin/members/posts/:id`
- DELETE `/api/admin/members/posts/:id`
- GET `/api/admin/members/tags`
- POST `/api/admin/members/tags`
- PUT `/api/admin/members/tags/:id`
- DELETE `/api/admin/members/tags/:id`
- GET `/api/admin/members/types`
- GET `/api/admin/members/company-types`
- POST `/api/admin/members/company-types`
- PUT `/api/admin/members/company-types/:id`
- DELETE `/api/admin/members/company-types/:id`
- PUT `/api/admin/members/company-types/:id/enable`
- PUT `/api/admin/members/company-types/:id/disable`
- PUT `/api/admin/members/companies/:id/enable`
- PUT `/api/admin/members/companies/:id/disable`
- POST `/api/admin/members/batch-upload`
- GET `/api/admin/members/departments/:id/users`
- POST `/api/admin/members/users`
- PUT `/api/admin/members/users/:id`
- PUT `/api/admin/members/users/:id/pwd`
- DELETE `/api/admin/members/users/:id`

#### resource.ts（adminResourceRoutes → `/api/admin`）

- GET `/api/admin/resources/categories`
- POST `/api/admin/resources/categories`
- PUT `/api/admin/resources/categories/:id`
- DELETE `/api/admin/resources/categories/:id`
- GET `/api/admin/resources`
- GET `/api/admin/resources/:id`
- POST `/api/admin/resources`
- PUT `/api/admin/resources/:id`
- DELETE `/api/admin/resources/:id`
- PUT `/api/admin/resources/:id/publish`
- GET `/api/admin/resources/products`
- POST `/api/admin/resources/products`
- PUT `/api/admin/resources/products/:id`
- DELETE `/api/admin/resources/products/:id`
- GET `/api/admin/resources/tags`
- POST `/api/admin/resources/tags`
- PUT `/api/admin/resources/tags/:id`
- DELETE `/api/admin/resources/tags/:id`

#### point.ts（adminPointRoutes → `/api/admin`）

- GET `/api/admin/edu-points/channels`
- POST `/api/admin/edu-points/channels`
- PUT `/api/admin/edu-points/channels/:id`
- GET `/api/admin/edu-points/channels/:id`
- DELETE `/api/admin/edu-points/channels/:id`
- GET `/api/admin/edu-points/rules`
- POST `/api/admin/edu-points/rules`
- PUT `/api/admin/edu-points/rules/:id`
- DELETE `/api/admin/edu-points/rules/:id`
- GET `/api/admin/edu-points/relations`
- PUT `/api/admin/edu-points/relations`
- GET `/api/admin/edu-points/records`

#### schedule.ts（adminScheduleRoutes → `/api/admin`）

- POST `/api/admin/schedule/tasks`
- PUT `/api/admin/schedule/tasks/:id`
- DELETE `/api/admin/schedule/tasks/:id`
- PUT `/api/admin/schedule/tasks/:id/enable`
- PUT `/api/admin/schedule/tasks/:id/disable`
- PUT `/api/admin/schedule/tasks/:id/run`

#### statistics.ts（adminStatisticsRoutes → `/api/admin`）

（无独立 admin 统计路由，statisticsRoutes 中的 /statistics/* 已包含在 /api 分组中）

#### message.ts（adminMessageRoutes → `/api/admin`）

- GET `/api/admin/messages/announcements`
- GET `/api/admin/messages/announcements/:id`
- POST `/api/admin/messages/announcements`
- PUT `/api/admin/messages/announcements/:id`
- DELETE `/api/admin/messages/announcements/:id`
- GET `/api/admin/messages`
- POST `/api/admin/messages/system-notice`
- DELETE `/api/admin/messages/system-notice/:nid`
- GET `/api/admin/messages/template/list`
- POST `/api/admin/messages/template`

#### topic.ts（adminTopicRoutes → `/api/admin`）

- GET `/api/admin/topics`
- GET `/api/admin/topics/:id`
- POST `/api/admin/topics`
- PUT `/api/admin/topics/:id`
- DELETE `/api/admin/topics/:id`

#### behavior.ts（adminBehaviorRoutes → `/api/admin`）

- GET `/api/admin/behavior/watch/list`

#### visit-tracking.ts（adminVisitTrackingRoutes → `/api/admin`）

（从源码行号 >= 228 的路由，需进一步确认具体路径）

#### oss.ts（adminOssRoutes → `/api/admin`）

- GET `/api/admin/oss/drivers`
- GET `/api/admin/oss/drivers/:id`
- POST `/api/admin/oss/drivers`
- PATCH `/api/admin/oss/drivers/:id`
- DELETE `/api/admin/oss/drivers/:id`

#### setting.ts（adminSettingRoutes → `/api/admin`）

- POST `/api/admin/edu-settings`
- PATCH `/api/admin/edu-settings/:id`
- DELETE `/api/admin/edu-settings/:id`

#### news.ts（adminNewsRoutes → `/api/admin`）

- GET `/api/admin/news/categories`
- POST `/api/admin/news/categories`
- PUT `/api/admin/news/categories/:id`
- DELETE `/api/admin/news/categories/:id`
- GET `/api/admin/news/articles`
- GET `/api/admin/news/articles/:id`
- POST `/api/admin/news/articles`
- PUT `/api/admin/news/articles/:id`
- DELETE `/api/admin/news/articles/:id`
- PUT `/api/admin/news/articles/:id/top`
- DELETE `/api/admin/news/articles/:id/top`
- PUT `/api/admin/news/articles/:id/recommend`
- DELETE `/api/admin/news/articles/:id/recommend`

#### certificate.ts（adminCertificateRoutes → `/api/admin`）

- GET `/api/admin/certificates/templates`
- GET `/api/admin/certificates/templates/:id`
- POST `/api/admin/certificates/templates`
- PUT `/api/admin/certificates/templates/:id`
- DELETE `/api/admin/certificates/templates/:id`
- GET `/api/admin/certificates`
- GET `/api/admin/certificates/:id`
- POST `/api/admin/certificates`
- PUT `/api/admin/certificates/:id/status`
- DELETE `/api/admin/certificates/:id`

#### payment-gateway.ts（adminPaymentGatewayRoutes → `/api/admin`）

（从源码行号 >= 497 的路由，需进一步确认具体路径）

#### refund-audit.ts（adminRefundAuditRoutes → `/api/admin`）

（与 refundAuditRoutes 共享路径，行号 >= 191 的部分）

#### vip.ts（adminVipRoutes → `/api/admin`）

- POST `/api/admin/vip/levels`
- PUT `/api/admin/vip/levels/:id`
- DELETE `/api/admin/vip/levels/:id`
- GET `/api/admin/vip/users`
- PUT `/api/admin/vip/users/:id/cancel`

---

### `/api/admin/ai`（AI 厂商管理）

#### ai-vendors.ts（adminAiVendorRoutes → `/api/admin/ai`）

- GET `/api/admin/ai/vendors`
- GET `/api/admin/ai/vendors/:vendor`
- POST `/api/admin/ai/vendors/:vendor/test`
- GET `/api/admin/ai/tasks`
- GET `/api/admin/ai/usage`

---

### `/api/admin/checkin`（签到管理）

#### checkin.ts（adminCheckinRoutes → `/api/admin/checkin`）

- GET `/api/admin/checkin/list`
- GET `/api/admin/checkin/stats`
- GET `/api/admin/checkin/rules`
- POST `/api/admin/checkin/rules`

---

### `/api/admin/customer-service`（客服管理）

#### customer-service.ts（adminCustomerServiceRoutes → `/api/admin/customer-service`）

- GET `/api/admin/customer-service/categories`
- GET `/api/admin/customer-service/tickets`
- POST `/api/admin/customer-service/tickets/:id/transition`
- POST `/api/admin/customer-service/tickets/:id/assign`
- POST `/api/admin/customer-service/tickets/:id/comments`
- GET `/api/admin/customer-service/agents`
- POST `/api/admin/customer-service/agents`
- PUT `/api/admin/customer-service/agents/:id/status`

---

### `/api/admin/demand-square`（需求广场管理）

#### admin-demand-square.ts（adminDemandSquareRoutes → `/api/admin/demand-square`）

- GET `/api/admin/demand-square/`
- GET `/api/admin/demand-square/stats`
- GET `/api/admin/demand-square/:id`
- POST `/api/admin/demand-square/:id/review`
- POST `/api/admin/demand-square/batch-review`
- PUT `/api/admin/demand-square/:id/status`
- DELETE `/api/admin/demand-square/:id`

---

### `/api/admin/faq`（FAQ 管理）

#### admin-faq.ts（adminFaqRoutes → `/api/admin/faq`）

- GET `/api/admin/faq/categories`
- POST `/api/admin/faq/categories`
- DELETE `/api/admin/faq/categories/:id`
- GET `/api/admin/faq/`
- POST `/api/admin/faq/`
- PUT `/api/admin/faq/:id`
- DELETE `/api/admin/faq/:id`

---

### `/api/admin/usercenter`（用户中心管理）

#### usercenter.ts（usercenterRoutes → `/api/admin/usercenter`）

- GET `/api/admin/usercenter/users`
- GET `/api/admin/usercenter/users/by-phone`
- GET `/api/admin/usercenter/users/:id`
- POST `/api/admin/usercenter/users`
- PUT `/api/admin/usercenter/users/:id`
- PUT `/api/admin/usercenter/users/:id/password`
- PUT `/api/admin/usercenter/users/:id/reset-password`
- DELETE `/api/admin/usercenter/users/:id`
- GET `/api/admin/usercenter/users/:id/certificates`
- POST `/api/admin/usercenter/users/:id/certificates`
- DELETE `/api/admin/usercenter/certificates/:id`
- GET `/api/admin/usercenter/departments`
- GET `/api/admin/usercenter/departments/:id`
- POST `/api/admin/usercenter/departments`
- PUT `/api/admin/usercenter/departments/:id`
- DELETE `/api/admin/usercenter/departments/:id`
- GET `/api/admin/usercenter/statistics`

---

### `/api/admin/zones`（区域管理）

#### admin-zone.ts（adminZoneRoutes → `/api/admin/zones`）

- GET `/api/admin/zones/`
- GET `/api/admin/zones/tree`
- POST `/api/admin/zones/`
- PUT `/api/admin/zones/:id`
- DELETE `/api/admin/zones/:id`

---

### `/api/auth`（认证模块）

#### auth.ts（authRoutes → `/api/auth`）

- POST `/api/auth/send-code`
- POST `/api/auth/reset-password`
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/refresh`
- GET `/api/auth/me`
- POST `/api/auth/logout`

#### auth-sso.ts（authSsoRoutes → `/api/auth`）

- POST `/api/auth/sso/code`
- POST `/api/auth/sso/exchange`
- POST `/api/auth/sso/logout`
- GET `/api/auth/sso/validate`

---

### `/api/users`（用户模块）

#### users.ts（usersRoutes → `/api/users`）

- GET `/api/users/:id`
- PATCH `/api/users/:id`
- POST `/api/users/:id/password`
- POST `/api/users/:id/avatar`
- POST `/api/users/change-phone`

---

### `/api/workspace`（工作空间模块）

#### workspace.ts（workspaceRoutes → `/api/workspace`）

- GET `/api/workspace/projects/:id`
- PATCH `/api/workspace/projects/:id`
- DELETE `/api/workspace/projects/:id`
- GET `/api/workspace/projects/:id/files`
- POST `/api/workspace/projects/:id/files`
- GET `/api/workspace/files/trash`
- DELETE `/api/workspace/files/trash/:id`
- POST `/api/workspace/files/batch-delete`
- POST `/api/workspace/files/batch-restore`
- GET `/api/workspace/files/:id/versions`
- GET `/api/workspace/files/:id/versions/:version`
- POST `/api/workspace/files/:id/restore`

#### workspace-ai.ts（workspaceAiRoutes → `/api/workspace`）

- POST `/api/workspace/fs/browse`
- POST `/api/workspace/fs/open`
- GET `/api/workspace/fs/recent`
- POST `/api/workspace/fs/read`
- POST `/api/workspace/fs/write`
- POST `/api/workspace/fs/edit`
- POST `/api/workspace/fs/delete`
- POST `/api/workspace/fs/grep`
- POST `/api/workspace/fs/glob`
- POST `/api/workspace/fs/run`
- POST `/api/workspace/swarms`
- GET `/api/workspace/swarms`
- GET `/api/workspace/swarms/:swarmId`
- POST `/api/workspace/swarms/:swarmId/execute`
- DELETE `/api/workspace/swarms/:swarmId`
- GET `/api/workspace/subagents`
- POST `/api/workspace/subagents/delegate`
- POST `/api/workspace/agent/run`
- GET `/api/workspace/agent/tasks`
- GET `/api/workspace/agent/tasks/:taskId`
- POST `/api/workspace/agent/tasks/:taskId/cancel`
- GET `/api/workspace/agent/tools`
- POST `/api/workspace/sandbox/execute`
- GET `/api/workspace/computer-use/status`
- POST `/api/workspace/computer-use/screenshot`
- POST `/api/workspace/computer-use/mouse/click`
- POST `/api/workspace/computer-use/keyboard/type`
- POST `/api/workspace/computer-use/keyboard/key`
- GET `/api/workspace/computer-use/screen-size`
- POST `/api/workspace/codebase/index`
- GET `/api/workspace/codebase/search`
- POST `/api/workspace/codebase/incremental`
- GET `/api/workspace/codebase/status`
- POST `/api/workspace/vector/index`
- POST `/api/workspace/vector/search`
- GET `/api/workspace/checkpoints`
- POST `/api/workspace/checkpoints/:id/rollback`
- POST `/api/workspace/checkpoints/undo`
- POST `/api/workspace/background-agents`
- GET `/api/workspace/background-agents`
- GET `/api/workspace/background-agents/:agentId`
- POST `/api/workspace/background-agents/:agentId/cancel`
- POST `/api/workspace/permissions/check`
- POST `/api/workspace/permissions/:requestId/resolve`
- GET `/api/workspace/permissions/requests`
- GET `/api/workspace/permissions/rules`
- GET `/api/workspace/personas`
- GET `/api/workspace/personas/:id`
- POST `/api/workspace/personas`
- PATCH `/api/workspace/personas/:id`
- DELETE `/api/workspace/personas/:id`
- GET `/api/workspace/routines`
- POST `/api/workspace/routines`
- GET `/api/workspace/routines/:id`
- PATCH `/api/workspace/routines/:id`
- DELETE `/api/workspace/routines/:id`
- POST `/api/workspace/routines/:id/trigger`
- POST `/api/workspace/github/detect`
- POST `/api/workspace/github/prs`
- GET `/api/workspace/github/prs`
- GET `/api/workspace/github/prs/:number`
- POST `/api/workspace/github/prs/:number/comments`
- POST `/api/workspace/github/prs/:number/reviewers`
- PUT `/api/workspace/github/prs/:number/merge`
- GET `/api/workspace/github/issues`

---

### `/api/chat`（聊天模块）

#### chat.ts（chatRoutes → `/api/chat`）

- GET `/api/chat/conversations/:id`
- PATCH `/api/chat/conversations/:id`
- DELETE `/api/chat/conversations/:id`
- POST `/api/chat/conversations/:id/messages`
- DELETE `/api/chat/messages/:id`
- POST `/api/chat/conversations/:id/favorite`
- DELETE `/api/chat/conversations/:id/favorite`
- GET `/api/chat/favorites`
- POST `/api/chat/conversations/:id/clear`

#### chat-models.ts（chatModelRoutes → `/api/chat`）

- POST `/api/chat/deepseek/chat`
- POST `/api/chat/deepseek/chat/stream`
- GET `/api/chat/ws/deepseek`
- POST `/api/chat/kling/video/generate`
- POST `/api/chat/kling/video/image-to-video`
- POST `/api/chat/kling/image/generate`
- GET `/api/chat/kling/task/:taskId`
- GET `/api/chat/multi/vendors`
- POST `/api/chat/multi/:vendor/chat`
- POST `/api/chat/multi/:vendor/chat/stream`
- POST `/api/chat/multi/multi`
- POST `/api/chat/qwen/chat`
- POST `/api/chat/qwen/chat/stream`
- GET `/api/chat/ws/qwen-omni`
- GET `/api/chat/ws/zhipu`
- POST `/api/chat/history/create`
- POST `/api/chat/history/query`
- PUT `/api/chat/history/:chatId/mark`
- DELETE `/api/chat/history/:chatId`
- POST `/api/chat/coze/message`
- POST `/api/chat/coze/message/stream`
- POST `/api/chat/coze/conversation/create`
- POST `/api/chat/coze/workflow/run`
- POST `/api/chat/coze/workflow/run/stream`
- POST `/api/chat/coze/workflow/run/resume`
- POST `/api/chat/coze/workflow/run/resume/stream`
- POST `/api/chat/coze/workflow/run/history`
- POST `/api/chat/coze/conversations/list`
- POST `/api/chat/coze/conversations/retrieve`
- POST `/api/chat/coze/messages/list`
- POST `/api/chat/coze/messages/feedback`

---

### `/api/teams`（团队模块）

#### teams.ts（teamRoutes → `/api/teams`）

- GET `/api/teams/invitations`
- POST `/api/teams/invitations/:token/accept`
- POST `/api/teams/invitations/:token/reject`
- GET `/api/teams/`
- POST `/api/teams/`
- GET `/api/teams/:id`
- PATCH `/api/teams/:id`
- DELETE `/api/teams/:id`
- GET `/api/teams/:id/members`
- PATCH `/api/teams/:id/members/:userId`
- DELETE `/api/teams/:id/members/:userId`
- POST `/api/teams/:id/invitations`
- GET `/api/teams/:id/invitations`

---

### `/api/plaza`（广场模块）

#### plaza.ts（plazaRoutes → `/api/plaza`）

- GET `/api/plaza/list`

---

### `/api/coze`（Coze 平台集成）

#### coze.ts（cozeRoutes → `/api/coze`）

- GET `/api/coze/apps/list`
- GET `/api/coze/apps/list_api_apps`
- GET `/api/coze/apps/events`
- GET `/api/coze/audio/voices`
- POST `/api/coze/audio/speech`
- POST `/api/coze/audio/chat-audio`
- GET `/api/coze/audio/voiceprints`
- POST `/api/coze/audio/voiceprints`
- PUT `/api/coze/audio/voiceprints`
- DELETE `/api/coze/audio/voiceprints`
- POST `/api/coze/chat-audio/simple`
- POST `/api/coze/chat-audio/one-to-one`
- POST `/api/coze/chat-audio/plugin`
- POST `/api/coze/conversations/list`
- POST `/api/coze/conversations/messages`
- POST `/api/coze/conversations/messages/feedback`
- POST `/api/coze/conversations/retrieve`
- POST `/api/coze/datasets`
- POST `/api/coze/datasets/list`
- POST `/api/coze/datasets/documents/upload`
- POST `/api/coze/datasets/documents/list`
- POST `/api/coze/datasets/images/upload`
- POST `/api/coze/datasets/images/list`
- POST `/api/coze/files/upload`
- POST `/api/coze/review/update_review_result`
- GET `/api/coze/review/status`
- GET `/api/coze/templates/list`
- POST `/api/coze/templates/duplicate`
- POST `/api/coze/workflows/runs`
- POST `/api/coze/workflows/runs/stream`
- POST `/api/coze/workflows/runs/resume`
- POST `/api/coze/workflows/runs/history`
- POST `/api/coze/workflows/runs/execute-nodes`
- POST `/api/coze/workflows/search/model/run`
- POST `/api/coze/workflows/async`
- POST `/api/coze/workflows/async/stream`
- POST `/api/coze/workflows/async/chat`
- GET `/api/coze/workspaces/list`
- POST `/api/coze/workspaces/members/create`
- POST `/api/coze/workspaces/members/delete`
- GET `/api/coze/bot/list`
- GET `/api/coze/bot/get`
- POST `/api/coze/bot/create`
- POST `/api/coze/bot/update`
- POST `/api/coze/bot/delete`
- POST `/api/coze/bot/publish`

---

### `/api/coze/variables`（Coze 变量）

#### coze-variables.ts（cozeVariablesRoutes → `/api/coze/variables`）

- GET `/api/coze/variables/retrieve`
- GET `/api/coze/variables/list`
- POST `/api/coze/variables/update`
- POST `/api/coze/variables/create`
- POST `/api/coze/variables/delete`

---

### `/api/agent`（Agent 服务）

#### agentic-service.ts（agenticServiceRoutes → `/api/agent`）

- GET `/api/agent/zhsAgent/list`
- GET `/api/agent/zhsAgent/:agentId`
- GET `/api/agent/categories`

---

### `/api/ai`（AI 厂商用户端）

#### ai-vendors.ts（aiVendorRoutes → `/api/ai`）

- POST `/api/ai/dashscope/chat`
- POST `/api/ai/dashscope/image`
- POST `/api/ai/dashscope/image-edit`
- POST `/api/ai/dashscope/tts`
- POST `/api/ai/dashscope/asr`
- GET `/api/ai/dashscope/models`
- POST `/api/ai/dashscope/video`
- POST `/api/ai/dashscope/embedding`
- POST `/api/ai/dashscope/multimodal`
- POST `/api/ai/dashscope/agent`
- POST `/api/ai/doubao/chat`
- POST `/api/ai/doubao/image`
- POST `/api/ai/doubao/image-edit`
- POST `/api/ai/doubao/tts`
- POST `/api/ai/doubao/asr`
- GET `/api/ai/doubao/models`
- POST `/api/ai/doubao/video`
- POST `/api/ai/doubao/embedding`
- POST `/api/ai/doubao/multimodal`
- POST `/api/ai/gemini/chat`
- POST `/api/ai/gemini/image`
- POST `/api/ai/gemini/tts`
- POST `/api/ai/gemini/asr`
- GET `/api/ai/gemini/models`
- POST `/api/ai/gemini/video`
- POST `/api/ai/gemini/embedding`
- POST `/api/ai/gemini/multimodal`
- POST `/api/ai/suno/generate`
- GET `/api/ai/suno/tasks`
- GET `/api/ai/suno/tasks/:taskId`
- POST `/api/ai/suno/lyrics`
- GET `/api/ai/suno/models`
- POST `/api/ai/sora2/generate`
- GET `/api/ai/sora2/tasks`
- GET `/api/ai/sora2/tasks/:taskId`
- GET `/api/ai/sora2/models`
- POST `/api/ai/coze/chat`
- POST `/api/ai/coze/bot/create`
- GET `/api/ai/coze/bots`
- GET `/api/ai/coze/bots/:botId`
- POST `/api/ai/coze/workflow/run`
- GET `/api/ai/coze/workflows`
- POST `/api/ai/coze/knowledge/upload`
- GET `/api/ai/coze/knowledge/list`
- POST `/api/ai/bailian/chat`
- GET `/api/ai/bailian/ws`
- POST `/api/ai/jimeng4/image`
- POST `/api/ai/n8n/workflows`
- POST `/api/ai/n8n/workflow/run`
- POST `/api/ai/n8n/addAgent`
- POST `/api/ai/tencent/hunyuan3d/submit`
- POST `/api/ai/tencent/hunyuan3d/query`
- GET `/api/ai/tencent/hunyuan3d/task/:taskId`
- GET `/api/ai/tencent/hunyuan3d/active-jobs`
- GET `/api/ai/volcengine/ping`
- POST `/api/ai/volcengine/jimeng/image`
- POST `/api/ai/volcengine/jimeng/generate`
- POST `/api/ai/volcengine/visual/:reqKey`
- POST `/api/ai/volcengine/jimeng4/process`
- GET `/api/ai/vendors`
- GET `/api/ai/vendors/:vendor/models`
- POST `/api/ai/proxy`
- GET `/api/ai/tasks`
- GET `/api/ai/tasks/:taskId`
- DELETE `/api/ai/tasks/:taskId`
- POST `/api/ai/timbre/clone`
- GET `/api/ai/timbre/list`
- DELETE `/api/ai/timbre/:timbreId`
- PUT `/api/ai/timbre/:timbreId`
- POST `/api/ai/watermark/image`
- POST `/api/ai/watermark/video`
- GET `/api/ai/usage`
- GET `/api/ai/usage/:vendor`
- POST `/api/ai/aigc/record`
- GET `/api/ai/aigc/records`
- DELETE `/api/ai/aigc/records/:recordId`
- GET `/api/ai/aigc/records/stats`

#### ai-audio.ts（aiAudioRoutes → `/api/ai`）

- GET `/api/ai/audio/voices`
- POST `/api/ai/audio/speech`
- POST `/api/ai/audio/recognize`
- POST `/api/ai/audio/chat`
- GET `/api/ai/audio/download`
- POST `/api/ai/audio/upload`
- POST `/api/ai/speaker/register`
- POST `/api/ai/speaker/compare`
- GET `/api/ai/speaker/list`
- DELETE `/api/ai/speaker/:voiceId`
- GET `/api/ai/audio/realtime`

#### ai-user-model-chat.ts（aiUserModelChatRoutes → `/api/ai`）

- GET `/api/ai/configs`
- POST `/api/ai/configs`
- PUT `/api/ai/configs/:id`
- DELETE `/api/ai/configs/:id`
- POST `/api/ai/chat`
- GET `/api/ai/history`

---

### `/api/customer-service`（客服系统用户端）

#### customer-service.ts（customerServiceRoutes → `/api/customer-service`）

- GET `/api/customer-service/categories`
- GET `/api/customer-service/tickets`
- GET `/api/customer-service/tickets/:id`
- POST `/api/customer-service/tickets`
- PUT `/api/customer-service/tickets/:id`
- DELETE `/api/customer-service/tickets/:id`
- GET `/api/customer-service/tickets/:id/comments`
- POST `/api/customer-service/tickets/:id/comments`
- POST `/api/customer-service/tickets/:id/rating`
- GET `/api/customer-service/agents`

---

### `/api/gdpr`（GDPR 数据擦除）

#### gdpr.ts（gdprRoutes → `/api/gdpr`）

- POST `/api/gdpr/export`
- POST `/api/gdpr/erase`
- POST `/api/gdpr/portability`

---

### `/api/tenants`（多租户管理）

#### tenant.ts（tenantRoutes → `/api/tenants`）

- POST `/api/tenants/`
- GET `/api/tenants/`
- GET `/api/tenants/:id`
- PATCH `/api/tenants/:id`
- DELETE `/api/tenants/:id`
- GET `/api/tenants/:id/members`
- POST `/api/tenants/:id/members`
- PATCH `/api/tenants/:id/members/:userId`
- DELETE `/api/tenants/:id/members/:userId`
- GET `/api/tenants/:id/quota`
- PATCH `/api/tenants/:id/quota`

---

### `/api/canary`（灰度发布）

#### canary.ts（canaryRoutes → `/api/canary`）

- GET `/api/canary/configs`
- GET `/api/canary/configs/:name`
- POST `/api/canary/configs`
- POST `/api/canary/configs/:name/promote`
- POST `/api/canary/configs/:name/rollback`
- POST `/api/canary/configs/:name/failure`
- POST `/api/canary/configs/:name/reset`
- GET `/api/canary/audit`
- GET `/api/canary/traffic/:name`

---

### `/api/tbox`（TBox IoT 设备管理）

#### tbox.ts（tboxRoutes → `/api/tbox`）

- GET `/api/tbox/devices`
- GET `/api/tbox/devices/:id`
- POST `/api/tbox/devices`
- POST `/api/tbox/devices/:id/command`
- GET `/api/tbox/devices/:id/commands`
- POST `/api/tbox/events`

---

### `/api/stock`（股票分析）

#### stock.ts（stockRoutes → `/api/stock`）

- GET `/api/stock/token-balance`
- POST `/api/stock/analyse`
- GET `/api/stock/history`

---

### `/api/agent-ext`（Agent 扩展）

#### agent-extended.ts（agentExtendedRoutes → `/api/agent-ext`）

- GET `/api/agent-ext/need-task/list`
- GET `/api/agent-ext/need-task/:id`
- POST `/api/agent-ext/need-task`
- PUT `/api/agent-ext/need-task/:id`
- DELETE `/api/agent-ext/need-task/:id`
- GET `/api/agent-ext/upload/list`
- GET `/api/agent-ext/upload/:id`
- POST `/api/agent-ext/upload`
- PUT `/api/agent-ext/upload/:id`
- DELETE `/api/agent-ext/upload/:id`
- GET `/api/agent-ext/usedetail/list`
- GET `/api/agent-ext/usedetail/:id`
- POST `/api/agent-ext/usedetail`
- PUT `/api/agent-ext/usedetail/:id`
- DELETE `/api/agent-ext/usedetail/:id`
- POST `/api/agent-ext/buy/create`
- GET `/api/agent-ext/buy/list`
- GET `/api/agent-ext/buy/:id`
- POST `/api/agent-ext/developer/renew`
- GET `/api/agent-ext/withdrawal/list`
- GET `/api/agent-ext/withdrawal/summary`
- GET `/api/agent-ext/buy/stats/summary`
- GET `/api/agent-ext/buy/order/generate`
- POST `/api/agent-ext/buy/order/validate`
- PUT `/api/agent-ext/buy/:id`
- DELETE `/api/agent-ext/buy/:id`
- POST `/api/agent-ext/buy/:id/recalculate-expiration`
- GET `/api/agent-ext/rules/list`
- GET `/api/agent-ext/rules/:id`
- POST `/api/agent-ext/rules`
- PUT `/api/agent-ext/rules/:id`
- DELETE `/api/agent-ext/rules/:id`
- GET `/api/agent-ext/rule-params/list`
- GET `/api/agent-ext/rule-params/:id`
- POST `/api/agent-ext/rule-params`
- PUT `/api/agent-ext/rule-params/:id`
- DELETE `/api/agent-ext/rule-params/:id`
- GET `/api/agent-ext/heat/list`
- GET `/api/agent-ext/heat/summary`
- GET `/api/agent-ext/heat/top`
- GET `/api/agent-ext/developer/list`
- GET `/api/agent-ext/developer/:id`
- GET `/api/agent-ext/developer/order/:orderNo`
- POST `/api/agent-ext/developer`
- POST `/api/agent-ext/developer/generate-order-no`
- GET `/api/agent-ext/personality/:agentId`
- PUT `/api/agent-ext/personality/:agentId`

---

### `/api/edu-ext`（教育扩展）

#### edu-extended.ts（eduExtendedRoutes → `/api/edu-ext`）

（注意：edu-extended.ts 同时被 adminEduExtendedRoutes 和 eduExtendedRoutes 导出，adminEduExtendedRoutes 前缀为 /api，eduExtendedRoutes 前缀为 /api/edu-ext）

---

### `/api/system-ext`（系统扩展）

#### system-extended.ts（systemExtendedRoutes → `/api/system-ext`）

- GET `/api/system-ext/category-dictionary/list`
- GET `/api/system-ext/category-dictionary/:id`
- POST `/api/system-ext/category-dictionary`
- PUT `/api/system-ext/category-dictionary/:id`
- DELETE `/api/system-ext/category-dictionary/:id`
- GET `/api/system-ext/bot-sites/list`
- GET `/api/system-ext/bot-sites/:id`
- POST `/api/system-ext/bot-sites`
- PUT `/api/system-ext/bot-sites/:id`
- DELETE `/api/system-ext/bot-sites/:id`
- GET `/api/system-ext/ws-admin/connections`
- GET `/api/system-ext/ws-admin/connections/:id`
- DELETE `/api/system-ext/ws-admin/connections/:id`
- GET `/api/system-ext/compat/*`

---

### `/api/ai-ext`（AI 扩展）

#### ai-extended.ts（aiExtendedRoutes → `/api/ai-ext`）

- GET `/api/ai-ext/capabilities`
- GET `/api/ai-ext/model-info/list`
- GET `/api/ai-ext/model-info/:id`
- POST `/api/ai-ext/model-info`
- PUT `/api/ai-ext/model-info/:id`
- DELETE `/api/ai-ext/model-info/:id`
- GET `/api/ai-ext/outbound-routes/list`
- GET `/api/ai-ext/outbound-routes/:id`
- POST `/api/ai-ext/outbound-routes`
- PUT `/api/ai-ext/outbound-routes/:id`
- DELETE `/api/ai-ext/outbound-routes/:id`
- POST `/api/ai-ext/outbound-routes/callback`
- GET `/api/ai-ext/video-routes/list`
- GET `/api/ai-ext/video-routes/:id`
- POST `/api/ai-ext/video-routes`
- PUT `/api/ai-ext/video-routes/:id`
- DELETE `/api/ai-ext/video-routes/:id`
- POST `/api/ai-ext/video-routes/tasks/create`
- GET `/api/ai-ext/video-routes/tasks/:id`
- GET `/api/ai-ext/developer/model-test/list`
- GET `/api/ai-ext/developer/model-test/:id`
- POST `/api/ai-ext/developer/model-test`
- PUT `/api/ai-ext/developer/model-test/:id`
- DELETE `/api/ai-ext/developer/model-test/:id`
- POST `/api/ai-ext/developer/model-test/run`

---

### `/api/misc-ext`（其他扩展）

#### misc-extended.ts（miscExtendedRoutes → `/api/misc-ext`）

- GET `/api/misc-ext/remote/list`
- GET `/api/misc-ext/remote/:id`
- POST `/api/misc-ext/remote`
- PUT `/api/misc-ext/remote/:id`
- DELETE `/api/misc-ext/remote/:id`
- POST `/api/misc-ext/remote/proxy`
- GET `/api/misc-ext/user-agent-context/list`
- GET `/api/misc-ext/user-agent-context/:id`
- POST `/api/misc-ext/user-agent-context`
- PUT `/api/misc-ext/user-agent-context/:id`
- DELETE `/api/misc-ext/user-agent-context/:id`
- GET `/api/misc-ext/docs/list`
- GET `/api/misc-ext/docs/:id`

---

### `/api/tools`（工具管理）

#### tools.ts（toolsRoutes → `/api/tools`）

- GET `/api/tools/`
- GET `/api/tools/:id`
- POST `/api/tools/`
- PATCH `/api/tools/:id`
- DELETE `/api/tools/:id`
- POST `/api/tools/:id/favorite`
- DELETE `/api/tools/:id/favorite`

---

### `/api/ranking`（排行榜）

#### ranking.ts（rankingRoutes → `/api/ranking`）

- GET `/api/ranking/users`
- GET `/api/ranking/agents`
- GET `/api/ranking/courses`
- GET `/api/ranking/lists`

---

### `/api/checkin`（签到用户端）

#### checkin.ts（checkinRoutes → `/api/checkin`）

- POST `/api/checkin/`
- GET `/api/checkin/today`
- GET `/api/checkin/history`
- GET `/api/checkin/streak`

---

### `/api/developer`（开发者 API 密钥）

#### developer.ts（developerRoutes → `/api/developer`）

- GET `/api/developer/api-keys`
- POST `/api/developer/api-keys`
- DELETE `/api/developer/api-keys/:id`
- PATCH `/api/developer/api-keys/:id`
- GET `/api/developer/api-keys/:id/usage`

---

### `/api/app-version`（应用版本管理）

#### app-version.ts（appVersionRoutes → `/api/app-version`）

- GET `/api/app-version/latest`
- GET `/api/app-version/`
- POST `/api/app-version/`
- PUT `/api/app-version/:id`
- DELETE `/api/app-version/:id`
- GET `/api/app-version/check-update`
- POST `/api/app-version/:id/disable`

---

### `/api/monitor`（监控系统）

#### monitor.ts（monitorRoutes → `/api/monitor`）

- GET `/api/monitor/alerts`
- GET `/api/monitor/backfill-status`
- GET `/api/monitor/suppression-rules`
- GET `/api/monitor/canary-audit`

---

### `/api/developer/webhooks`（Webhook 管理）

#### webhooks.ts（webhooksRoutes → `/api/developer/webhooks`）

- GET `/api/developer/webhooks/`
- POST `/api/developer/webhooks/`
- DELETE `/api/developer/webhooks/:id`
- POST `/api/developer/webhooks/:id/test`
- GET `/api/developer/webhooks/:id/logs`
- POST `/api/developer/webhooks/:id/retry`

---

### `/api/packages`（套餐管理）

#### packages.ts（packagesRoutes → `/api/packages`）

- GET `/api/packages/`
- GET `/api/packages/:id`
- POST `/api/packages/`
- PATCH `/api/packages/:id`

---

### `/api/fund`（资金管理）

#### fund.ts（fundRoutes → `/api/fund`）

- GET `/api/fund/balance`
- GET `/api/fund/transactions`
- POST `/api/fund/withdraw`
- GET `/api/fund/withdrawals`

---

### `/api/wallet`（钱包管理）

#### wallet.ts（walletRoutes → `/api/wallet`）

- GET `/api/wallet/balance`
- POST `/api/wallet/recharge`
- POST `/api/wallet/withdraw`
- GET `/api/wallet/withdraw/records`
- GET `/api/wallet/recharge/records`

---

### `/api/trader`（交易员管理）

#### trader.ts（traderRoutes → `/api/trader`）

- GET `/api/trader/`
- GET `/api/trader/:id`
- POST `/api/trader/apply`
- PATCH `/api/trader/:id`

---

### `/api/sdks`（SDK 管理）

#### sdks.ts（sdksRoutes → `/api/sdks`）

- GET `/api/sdks/`
- GET `/api/sdks/:id`
- POST `/api/sdks/`
- PATCH `/api/sdks/:id`

---

### `/api/miniprogram`（小程序后台管理）

#### miniprogram.ts（miniprogramRoutes → `/api/miniprogram`）

- GET `/api/miniprogram/config`
- POST `/api/miniprogram/config`
- GET `/api/miniprogram/versions`
- POST `/api/miniprogram/preview`

---

### `/api/product-identity`（产品标识管理）

#### product-identity.ts（productIdentityRoutes → `/api/product-identity`）

- GET `/api/product-identity/`
- POST `/api/product-identity/`
- PATCH `/api/product-identity/:id`

---

### `/api/groups`（用户组管理）

#### groups.ts（groupsRoutes → `/api/groups`）

- GET `/api/groups/`
- POST `/api/groups/`
- PATCH `/api/groups/:id`
- DELETE `/api/groups/:id`
- POST `/api/groups/:id/members`
- DELETE `/api/groups/:id/members/:userId`

---

### `/api/course`（ZHS 课程模块）

#### zhs-course.ts（zhsCourseRoutes → `/api/course`）

- GET `/api/course/list`
- GET `/api/course/:id`
- POST `/api/course/`
- PUT `/api/course/`
- DELETE `/api/course/:ids`
- POST `/api/course/delist/:ids`
- GET `/api/course/videos`
- GET `/api/course/videos/my`
- GET `/api/course/videos/:video_id`
- POST `/api/course/videos/create`
- POST `/api/course/videos/batch`
- PUT `/api/course/videos/:video_id`
- DELETE `/api/course/videos/:video_id`
- POST `/api/course/videos/:video_id/move`
- POST `/api/course/videos/:video_id/issue`
- GET `/api/course/categories`
- GET `/api/course/categories/:category_id/parent`
- GET `/api/course/platforms`
- GET `/api/course/platforms/:code`
- POST `/api/course/platforms/create`
- PUT `/api/course/platforms/:platform_id`
- DELETE `/api/course/platforms/:platform_id`
- POST `/api/course/pay`
- GET `/api/course/pay-logs`
- GET `/api/course/comments`
- POST `/api/course/comments/create`
- GET `/api/course/comments/parent`
- DELETE `/api/course/comments/:comment_id`
- POST `/api/course/video-log`
- GET `/api/course/video-log/list`
- GET `/api/course/operate/list`
- GET `/api/course/platform-logs`
- POST `/api/course/user-platform/bind`
- DELETE `/api/course/user-platform/unbind`
- GET `/api/course/user-platform/my`

---

### `/api/share`（分享内容）

#### share-content.ts（shareContentRoutes → `/api/share`）

- GET `/api/share/content/:code`

---

### `/api/legacy`（历史项目缺失端点补齐）

#### legacy-completion.ts（legacyCompletionRoutes → `/api/legacy`）

- GET `/api/legacy/exam/signups`
- POST `/api/legacy/exam/signups`
- GET `/api/legacy/exam/signups/:id`
- DELETE `/api/legacy/exam/signups/:id`
- GET `/api/legacy/exam/signups/check`
- GET `/api/legacy/exam/recommend`
- GET `/api/legacy/exam/hot`
- GET `/api/legacy/exam/favorites`
- GET `/api/legacy/learn/stats/total-time`
- GET `/api/legacy/learn/stats/today-time`
- GET `/api/legacy/learn/stats/rank-percent`
- GET `/api/legacy/learn/topics`
- GET `/api/legacy/learn/topics/:id`
- GET `/api/legacy/learn/topics/:id/lessons`
- POST `/api/legacy/live/subscribe`
- DELETE `/api/legacy/live/unsubscribe`
- GET `/api/legacy/ask/categories`
- GET `/api/legacy/ask/member/question-count`
- GET `/api/legacy/ask/member/answer-count`
- GET `/api/legacy/ask/member/questions`
- GET `/api/legacy/ask/member/answers`
- DELETE `/api/legacy/ask/answers/:id`
- PATCH `/api/legacy/ask/answers/:id`
- POST `/api/legacy/batch/lessons`
- POST `/api/legacy/batch/exams`
- POST `/api/legacy/batch/channels`
- DELETE `/api/legacy/oss/file`
- GET `/api/legacy/oss/to-base64`
- POST `/api/legacy/oss/ask/question/image`
- DELETE `/api/legacy/exam/wrong-questions/:id`

---

### `/api/ai-feed`（AI 资讯聚合）

#### ai-feed.ts（aiFeedRoutes → `/api/ai-feed`）

- GET `/api/ai-feed/sources`
- GET `/api/ai-feed/items`
- GET `/api/ai-feed/trends`
- GET `/api/ai-feed/stats`
- POST `/api/ai-feed/collect`
- POST `/api/ai-feed/summarize`
- POST `/api/ai-feed/translate`

---

### `/api/ai-education`（AI 教育模块）

#### ai-education.ts（aiEducationRoutes → `/api/ai-education`）

- GET `/api/ai-education/policy`
- POST `/api/ai-education/policy`
- GET `/api/ai-education/teacher-certification`
- POST `/api/ai-education/teacher-certification`
- GET `/api/ai-education/aigc-tool`
- POST `/api/ai-education/aigc-tool`
- GET `/api/ai-education/k12-curriculum`
- POST `/api/ai-education/k12-curriculum`
- GET `/api/ai-education/university-course`
- POST `/api/ai-education/university-course`

---

### `/api/callback-log`（通用回调日志）

#### callback-log.ts（callbackLogRoutes → `/api/callback-log`）

- POST `/api/callback-log/call`
- POST `/api/callback-log/sms`
- POST `/api/callback-log/payment`
- GET `/api/callback-log/list`
- GET `/api/callback-log/:id`
- DELETE `/api/callback-log/:id`

---

### `/api/feature-center`（开放平台 Feature Center）

#### feature-center.ts（featureCenterRoutes → `/api/feature-center`）

- GET `/api/feature-center/stats`
- GET `/api/feature-center/apis`
- GET `/api/feature-center/agents`
- GET `/api/feature-center/documents`
- GET `/api/feature-center/models`
- GET `/api/feature-center/sdks`

---

### `/api/education-platform`（教育平台）

#### education-platform.ts（educationPlatformRoutes → `/api/education-platform`）

- GET `/api/education-platform/list`
- POST `/api/education-platform/`
- PUT `/api/education-platform/:pid`
- DELETE `/api/education-platform/:pid`
- POST `/api/education-platform/:pid/sync`
- GET `/api/education-platform/sync/log`

---

### `/api/srs`（SRS 媒体服务器管理）

#### srs.ts（srsRoutes → `/api/srs`）

- GET `/api/srs/streams`
- GET `/api/srs/streams/:key`
- POST `/api/srs/streams`
- PUT `/api/srs/streams/:id`
- DELETE `/api/srs/streams/:id`
- POST `/api/srs/streams/:key/kick`
- GET `/api/srs/streams/:key/status`
- GET `/api/srs/servers`
- POST `/api/srs/servers`
- PUT `/api/srs/servers/:id`
- DELETE `/api/srs/servers/:id`
- GET `/api/srs/servers/:id/health`

---

### 公共路由（前缀为 `/api` 但属于独立模块）

#### admin-agreements.ts（agreementPublicRoutes → `/api`）

- GET `/api/agreements/current`

#### admin-exchange-rate.ts（exchangeRatePublicRoutes → `/api`）

- GET `/api/exchange-rates/rate`
- GET `/api/exchange-rates/convert`

---

## 双导出文件分界线参考

| 文件                   | user Routes               | user 行号 | admin Routes               | admin 行号 |
| ---------------------- | ------------------------- | --------- | -------------------------- | ---------- |
| admin-agreements.ts    | agreementPublicRoutes     | 49        | adminAgreementsRoutes      | 67         |
| admin-exchange-rate.ts | exchangeRatePublicRoutes  | 46        | adminExchangeRateRoutes    | 86         |
| ai-vendors.ts          | aiVendorRoutes            | 451       | adminAiVendorRoutes        | 1983       |
| behavior.ts            | behaviorRoutes            | 136       | adminBehaviorRoutes        | 799        |
| certificate.ts         | certificateRoutes         | 115       | adminCertificateRoutes     | 196        |
| content.ts             | contentRoutes             | 178       | adminContentRoutes         | 405        |
| customer-service.ts    | customerServiceRoutes     | 176       | adminCustomerServiceRoutes | 427        |
| learn.ts               | learnRoutes               | 419       | adminLearnRoutes           | 629        |
| live.ts                | liveRoutes                | 202       | adminLiveRoutes            | 296        |
| member.ts              | memberRoutes              | 389       | adminMemberRoutes          | 476        |
| message.ts             | messageRoutes             | 108       | adminMessageRoutes         | 315        |
| news.ts                | newsRoutes                | 122       | adminNewsRoutes            | 174        |
| order.ts               | orderRoutes               | 216       | adminOrderRoutes           | 670        |
| oss.ts                 | ossRoutes                 | 122       | adminOssRoutes             | 248        |
| payment-gateway.ts     | paymentGatewayRoutes      | 46        | adminPaymentGatewayRoutes  | 497        |
| point.ts               | pointRoutes               | 168       | adminPointRoutes           | 212        |
| promotions.ts          | promotionRoutes           | 121       | adminPromotionRoutes       | 393        |
| refund-audit.ts        | refundAuditRoutes         | 96        | adminRefundAuditRoutes     | 191        |
| resource.ts            | resourceRoutes            | 206       | adminResourceRoutes        | 292        |
| schedule.ts            | scheduleRoutes            | 108       | adminScheduleRoutes        | 248        |
| setting.ts             | settingRoutes             | 106       | adminSettingRoutes         | 167        |
| statistics.ts          | statisticsRoutes          | 99        | adminStatisticsRoutes      | 370        |
| system.ts              | systemRoutes              | 172       | adminSystemRoutes          | 340        |
| topic.ts               | topicRoutes               | 84        | adminTopicRoutes           | 114        |
| visit-tracking.ts      | visitTrackingRoutes       | 129       | adminVisitTrackingRoutes   | 228        |
| vip.ts                 | vipRoutes                 | 19        | adminVipRoutes             | 71         |
| checkin.ts             | checkinRoutes（默认导出） | 1         | adminCheckinRoutes         | 195        |

---

## 嵌套 register 结构说明

### admin-sys.ts（11 个嵌套子前缀）

| 子前缀      | 行号范围 | 完整前缀              |
| ----------- | -------- | --------------------- |
| /menu       | 224-266  | /api/admin/menu       |
| /logininfor | 271-296  | /api/admin/logininfor |
| /notice     | 301-364  | /api/admin/notice     |
| /job        | 369-458  | /api/admin/job        |
| /job/log    | 463-482  | /api/admin/job/log    |
| /online     | 487-498  | /api/admin/online     |
| /dept       | 503-552  | /api/admin/dept       |
| /post       | 557-609  | /api/admin/post       |
| /config     | 614-686  | /api/admin/config     |
| /dict/type  | 691-749  | /api/admin/dict/type  |
| /dict/data  | 754-823  | /api/admin/dict/data  |

### exam.ts（1 个嵌套 register，无子前缀）

| 行号范围 | 说明                                                                |
| -------- | ------------------------------------------------------------------- |
| 274-662  | examRoutes（server 上的路由，前缀 /api）                            |
| 663-1250 | 嵌套 register（child 上的路由，包含 /admin/exam/* 和 /exam/* 路径） |

---

## 备注

1. **路径参数占位符**：所有 `:id`、`:agentId`、`:taskId` 等参数占位符均保留原样。
2. **WebSocket 路由**：`{ websocket: true }` 的路由已标注，如 `/api/chat/ws/deepseek`。
3. **通配符路由**：`/api/system-ext/compat/*` 使用通配符匹配。
4. **空路径路由**：部分路由路径为空字符串（如 `PUT /api/admin/menu`），表示直接访问前缀本身。
5. **ai-callback.ts** 是唯一没有前缀的路由模块，路径为 `/api/ai/callback`。
6. **adminEduExtendedRoutes** 的前缀是 `/api`（不是 `/api/admin`），但路由路径内含 `/admin/edu/`，因此实际路径为 `/api/admin/edu/*`。
7. **statistics.ts** 的 admin 部分无独立路由（statisticsRoutes 中已包含 /statistics/* 路径）。
