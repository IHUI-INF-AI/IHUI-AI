<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# i18n 动态键不可达待办档案(2026-09-21 实测)

> 生成方式:对全仓 translator 调用点做静态可达性判定 —— 解析 `const X = { k: 'a.b' }` 常量映射表的
> **值**、`t(`prefix.${x}`)` 的静态前缀、以及 `?? 'a.b'` 兜底字面量,拼成完整键路径后,按
> "点分下钻对象"语义在该端合并词典(`messages/shared` ⊕ `messages/<端>`)的 **5 种语言** 里逐个查。
> 五语言全缺 = 本档案收录项。
>
> **为什么它是真缺陷而不是洁癖**:next-intl / use-intl 按 `.` 拆路径下钻对象取不到值时,
> 默认 `getMessageFallback` 会把**完整键路径当文案返回**,即 UI 上直接显示
> `activities.status.upcoming` 这种字符串。把 `t(`status.${x}`)` 改成 `t(STATUS_KEY[x])` 的
> "静态映射表"重构**没有修好问题**,因为表的值仍然是点分路径。
>
> 复核方式:对下表任意一行,读该 `文件:行` 的调用点拿到完整键路径,再查
> `packages/i18n/messages/<端>/<语言>.json` 是否存在该嵌套节点即可(不需要任何脚本)。

## 总览

- 调用点 **118** 处 / 唯一缺失路径 **349** 条
- 按端:web 86 处 · miniapp-taro 15 处 · mobile-rn 17 处
- 按命名空间:54 个

## 修复口径(两类,别混用)

1. **词典侧**:语义确实不存在(如 `activities.status.*`、`nav.group.*`、`modelType.*` 整节点缺失)
   → 在该端词典里**建成真嵌套对象**并补 5 语言。**禁止**写成扁平含点键(`"status.upcoming": "…"`),
   那正是 2026-09-21 已根治并上了 blocking 守门的那一类。
2. **代码侧**:词典里已有等价物,只是命名不一致(实测样例:`feedback` 下代码请求 `type_bug` /
   `status_pending`,词典里是 `typeBug` / `statusPending`)→ **改代码里的映射值**,
   不要在词典里造同义重复键(会造成两份真相)。

改词典的端必须同步重生成该端签入的压缩产物:`pnpm --filter @ihui/miniapp-taro gen:i18n`
(miniapp-taro),否则 `i18n-compressed.test` 会红。

## 按端明细


### miniapp-taro(15 处)

| 文件:行 | 命名空间 | 请求的完整键路径 | 调用点表达式 |
|---|---|---|---|
| `apps/miniapp-taro/src/components/ModelTypeButtonGroup.tsx:83` | <root> | `modelType.audio` `modelType.image` `modelType.other` `modelType.sck` `modelType.skills` `modelType.talk` `modelType.video` `modelType.videoa` | MODEL_TYPE_KEY[cfg.type] ?? 'modelType.other' |
| `apps/miniapp-taro/src/components/ModelTypeButtonGroup.tsx:104` | <root> | `modelType.audio` `modelType.image` `modelType.other` `modelType.sck` `modelType.skills` `modelType.talk` `modelType.video` `modelType.videoa` | MODEL_TYPE_KEY[cfg.type] ?? 'modelType.other' |
| `apps/miniapp-taro/src/pages/setting/language.tsx:104` | <root> | `setting.en` `setting.ja` `setting.ko` `setting.zhCN` `setting.zhTW` | LANG_KEY[l.key] ?? 'setting.zhCN' |
| `apps/miniapp-taro/src/pages/setting/privacy.tsx:155` | <root> | `settingPrivacy.permissions.album` `settingPrivacy.permissions.camera` `settingPrivacy.permissions.location` `settingPrivacy.permissions.notification` `settingPrivacy.permissions.record` | PERMISSION_KEY[item.key] ?? 'settingPrivacy.permissions.re |
| `apps/miniapp-taro/src/pages/setting/privacy.tsx:109` | <root> | `settingPrivacy.status.denied` `settingPrivacy.status.granted` `settingPrivacy.status.unknown` `unknown` | PRIVACY_STATUS_KEY[s \|\| 'unknown'] ?? 'settingPrivacy.st |
| `apps/miniapp-taro/src/pages/circle/create.tsx:364` | <root> | `circle.create.vis.friends` `circle.create.vis.private` `circle.create.vis.public` | VIS_KEY[opt.key] ?? 'circle.create.vis.public' |
| `apps/miniapp-taro/src/pages/member/coupon.tsx:191` | <root> | `member.coupon.expired` `member.coupon.unused` `member.coupon.used` | COUPON_STATUS_KEY[c.status] ?? 'member.coupon.expired' |
| `apps/miniapp-taro/src/pkg-ai/ai/voice.tsx:301` | <root> | `ai.voice.speed.fast` `ai.voice.speed.normal` `ai.voice.speed.slow` | SPEED_KEY[s] ?? 'ai.voice.speed.normal' |
| `apps/miniapp-taro/src/pkg-ai/ai/voice.tsx:315` | <root> | `ai.voice.timbre.female` `ai.voice.timbre.male` | TIMBRE_KEY[tb] ?? 'ai.voice.timbre.female' |
| `apps/miniapp-taro/src/pkg-learn/live/list.tsx:35` | <root> | `live.liveNow` `live.replay` | STATUS_KEY[s] |
| `apps/miniapp-taro/src/pkg-learn/live/subscribe.tsx:88` | <root> | `live.calendar.upcoming` `live.liveNow` | STATUS_LABEL[s].key |
| `apps/miniapp-taro/src/pkg-shop/order/detail.tsx:30` | <root> | `order.status.failed` `order.status.refunding` | STATUS_KEYS[order.status] as string |
| `apps/miniapp-taro/src/pkg-user/user/orders.tsx:41` | <root> | `order.status.failed` `order.status.refunding` | STATUS_KEY[s] |
| `apps/miniapp-taro/src/pkg-ai/ai/agent-detail.tsx:316` | <root> | `ai.agentList.categories.other` | CATEGORY_KEY[category] ?? 'ai.agentList.categories.other' |
| `apps/miniapp-taro/src/pkg-ai/ai/agent.tsx:512` | <root> | `ai.agentList.categories.other` | CATEGORY_KEY[agent.category] ?? 'ai.agentList.categories.o |

### mobile-rn(17 处)

| 文件:行 | 命名空间 | 请求的完整键路径 | 调用点表达式 |
|---|---|---|---|
| `packages/app/src/features/course-filter/CourseFilterScreen.tsx:88` | <root> | `courseFilter.cat_all` `courseFilter.cat_business` `courseFilter.cat_design` `courseFilter.cat_language` `courseFilter.cat_tech` | COURSE_CAT_KEYS[c] |
| `packages/app/src/features/search/SearchScreen.tsx:82` | <root> | `search.type.agent` `search.type.article` `search.type.course` `search.type.note` `search.type.post` | SEARCH_TYPE_KEYS[item.type] |
| `packages/app/src/features/course-filter/CourseFilterScreen.tsx:103` | <root> | `courseFilter.level_advanced` `courseFilter.level_all` `courseFilter.level_beginner` `courseFilter.level_intermediate` | COURSE_LEVEL_KEYS[l] |
| `packages/app/src/features/course-filter/CourseFilterScreen.tsx:170` | <root> | `courseFilter.level_advanced` `courseFilter.level_all` `courseFilter.level_beginner` `courseFilter.level_intermediate` | COURSE_LEVEL_KEYS[item.level] |
| `packages/app/src/features/identity-verify/IdentityVerifyScreen.tsx:74` | <root> | `identityVerify.status_pending` `identityVerify.status_rejected` `identityVerify.status_unverified` `identityVerify.status_verified` | STATUS_KEY[status] |
| `packages/app/src/features/live-list/LiveListScreen.tsx:74` | <root> | `liveList.tab_all` `liveList.tab_ended` `liveList.tab_ongoing` `liveList.tab_upcoming` | TAB_KEYS[s]! |
| `packages/app/src/features/live-list/LiveListScreen.tsx:115` | <root> | `liveList.tab_all` `liveList.tab_ended` `liveList.tab_ongoing` `liveList.tab_upcoming` | TAB_KEYS[item.status as LiveListTab]! |
| `packages/app/src/features/real-name-auth/RealNameAuthScreen.tsx:68` | <root> | `realNameAuth.status_pending` `realNameAuth.status_rejected` `realNameAuth.status_unverified` `realNameAuth.status_verified` | REAL_NAME_STATUS_KEYS[currentStatus] |
| `packages/app/src/features/circle-member/CircleMemberScreen.tsx:93` | <root> | `circleMember.admin` `circleMember.member` `circleMember.owner` | ROLE_KEYS[item.role] |
| `packages/app/src/features/coupon/CouponScreen.tsx:80` | <root> | `coupon.tab_available` `coupon.tab_expired` `coupon.tab_used` | TAB_KEYS[s]! |
| `packages/app/src/features/coupon/CouponScreen.tsx:129` | <root> | `coupon.tab_available` `coupon.tab_expired` `coupon.tab_used` | TAB_KEYS[item.status as CouponStatus]! |
| `packages/app/src/features/course-filter/CourseFilterScreen.tsx:118` | <root> | `courseFilter.price_all` `courseFilter.price_free` `courseFilter.price_paid` | COURSE_PRICE_KEYS[p] |
| `packages/app/src/features/profile-edit/ProfileEditScreen.tsx:135` | <root> | `profileEdit.gender_female` `profileEdit.gender_male` `profileEdit.gender_secret` | GENDER_KEYS[g.key] |
| `packages/app/src/features/promotion/PromotionScreen.tsx:100` | <root> | `promotion.status_available` `promotion.status_expired` `promotion.status_used` | STATUS_KEYS[item.status] |
| `packages/app/src/features/ranking/RankingScreen.tsx:96` | <root> | `ranking.range_allTime` `ranking.range_monthly` `ranking.range_weekly` | RANGE_KEYS[r]! |
| `packages/app/src/features/task-center/TaskCenterScreen.tsx:72` | <root> | `taskCenter.tab_daily` `taskCenter.tab_newbie` `taskCenter.tab_weekly` | TAB_KEYS[tab] |
| `packages/app/src/features/promote/PromoteScreen.tsx:162` | <root> | `promote.status_active` `promote.status_inactive` | STATUS_KEYS[item.status] |

### web(86 处)

| 文件:行 | 命名空间 | 请求的完整键路径 | 调用点表达式 |
|---|---|---|---|
| `apps/web/src/components/layout/AdminNav.tsx:1162` | <root> | `nav.group.aiAgent` `nav.group.analytics` `nav.group.community` `nav.group.courseExam` `nav.group.developer` `nav.group.finance` `nav.group.marketing` `nav.group.moderation` `nav.group.operation` `nav.group.resource` `nav.group.saas` `nav.group.support` `nav.group.unknown` | NAV_GROUP_KEY[group.groupKey] ?? 'nav.group.unknown' |
| `apps/web/app/(main)/support/TicketDetailDialog.tsx:113` | ticketDetailDialog | `ticketDetailDialog.priority.high` `ticketDetailDialog.priority.low` `ticketDetailDialog.priority.medium` `ticketDetailDialog.priority.urgent` `ticketDetailDialog.status.closed` `ticketDetailDialog.status.open` `ticketDetailDialog.status.pending` `ticketDetailDialog.status.rejected` `ticketDetailDialog.status.resolved` | TICKET_STATUS_KEYS[ticket.status]! |
| `apps/web/app/(main)/admin/ai-world/sites/page.tsx:121` | aiWorld.admin.sites | `aiWorld.admin.sites.iconLabels.briefcase` `aiWorld.admin.sites.iconLabels.code` `aiWorld.admin.sites.iconLabels.graduation` `aiWorld.admin.sites.iconLabels.megaphone` `aiWorld.admin.sites.iconLabels.message` `aiWorld.admin.sites.iconLabels.music` `aiWorld.admin.sites.iconLabels.palette` `aiWorld.admin.sites.iconLabels.video` | ICON_LABEL_KEY[cat.icon] |
| `apps/web/src/components/workspace/workspace-permission-request-dialog.tsx:125` | workspace.permission.auditRequest | `workspace.permission.auditRequest.toolNames.fsDelete` `workspace.permission.auditRequest.toolNames.fsEdit` `workspace.permission.auditRequest.toolNames.fsGlob` `workspace.permission.auditRequest.toolNames.fsGrep` `workspace.permission.auditRequest.toolNames.fsRead` `workspace.permission.auditRequest.toolNames.fsRun` `workspace.permission.auditRequest.toolNames.fsWrite` `workspace.permission.auditRequest.toolNames.unknown` | TOOL_NAME_KEY[toolNameToI18nKey(current.tool)] ?? 'toolNam |
| `apps/web/app/(main)/agents/stats/page.tsx:133` | agentsStatsPage | `agentsStatsPage.stat.avgRating` `agentsStatsPage.stat.pending` `agentsStatsPage.stat.published` `agentsStatsPage.stat.totalAgents` `agentsStatsPage.stat.totalCalls` `agentsStatsPage.stat.totalUsers` `agentsStatsPage.stat.unknown` | STAT_KEY[card.key] ?? 'stat.unknown' |
| `apps/web/app/(main)/developer/notifications/page.tsx:136` | developer.notifications | `developer.notifications.apiErrorLabel` `developer.notifications.billingReminderLabel` `developer.notifications.quotaWarningLabel` `developer.notifications.versionUpdateLabel` `developer.notifications.webhookFailureLabel` `developer.notifications.weeklyReportLabel` | PREF_LABEL_KEY[item.key] ?? `${item.key}Label` |
| `apps/web/app/(main)/developer/notifications/page.tsx:139` | developer.notifications | `developer.notifications.apiErrorDesc` `developer.notifications.billingReminderDesc` `developer.notifications.quotaWarningDesc` `developer.notifications.versionUpdateDesc` `developer.notifications.webhookFailureDesc` `developer.notifications.weeklyReportDesc` | PREF_DESC_KEY[item.key] ?? `${item.key}Desc` |
| `apps/web/app/(main)/member/exam/sign-up/page.tsx:100` | memberExamSignUpPage | `memberExamSignUpPage.attended` `memberExamSignUpPage.canceled` `memberExamSignUpPage.pending` `memberExamSignUpPage.status.attended` `memberExamSignUpPage.status.canceled` `memberExamSignUpPage.status.pending` | EXAM_STATUS_KEYS[s as 'pending' \| 'attended' \| 'canceled |
| `apps/web/app/(main)/messages/[type]/PageClient.tsx:153` | messages | `messages.tab.comment` `messages.tab.favorite` `messages.tab.follow` `messages.tab.like` `messages.tab.notice` `messages.tab.unknown` | TAB_LABEL_KEY[type] ?? 'tab.unknown' |
| `apps/web/app/(main)/tags/[slug]/PageClient.tsx:101` | tags | `tags.groupComment` `tags.groupDoc` `tags.groupFile` `tags.groupOther` `tags.groupPost` `tags.groupProject` | GROUP_KEY[type] ?? 'groupOther' |
| `apps/web/src/components/ai-generation/music-generator.tsx:62` | musicGenerator | `musicGenerator.genre.classical` `musicGenerator.genre.electronic` `musicGenerator.genre.jazz` `musicGenerator.genre.pop` `musicGenerator.genre.rock` `musicGenerator.genre.unknown` | GENRE_KEY[g] ?? 'genre.unknown' |
| `apps/web/src/components/business/OrderItem.tsx:82` | common | `common.orderStatus.cancelled` `common.orderStatus.completed` `common.orderStatus.paid` `common.orderStatus.pending` `common.orderStatus.refunded` `common.orderStatus.shipped` | ORDER_STATUS_KEYS[status]! |
| `apps/web/app/(main)/admin/AdminDistributionCharts.tsx:30` | dashboard.admin | `dashboard.admin.fileTypes.document` `dashboard.admin.fileTypes.image` `dashboard.admin.fileTypes.other` `dashboard.admin.fileTypes.unknown` `dashboard.admin.fileTypes.video` | FILE_TYPE_KEY[f.key] ?? 'fileTypes.unknown' |
| `apps/web/app/(main)/admin/feedbacks/FeedbackDialog.tsx:90` | feedback | `feedback.status_closed` `feedback.status_pending` `feedback.status_resolved` `feedback.status_reviewing` `feedback.status_unknown` | STATUS_KEY[s] ?? 'status_unknown' |
| `apps/web/app/(main)/admin/feedbacks/FeedbackTable.tsx:125` | feedback | `feedback.status_closed` `feedback.status_pending` `feedback.status_resolved` `feedback.status_reviewing` `feedback.status_unknown` | STATUS_KEY[fb.status] ?? 'status_unknown' |
| `apps/web/app/(main)/admin/menu-permission/page.tsx:143` | admin.menuPermission | `admin.menuPermission.type_api` `admin.menuPermission.type_button` `admin.menuPermission.type_group` `admin.menuPermission.type_menu` `admin.menuPermission.type_unknown` | TYPE_KEY[m.type] ?? 'type_unknown' |
| `apps/web/app/(main)/admin/withdrawal/page.tsx:124` | admin.withdrawal | `admin.withdrawal.status.approved` `admin.withdrawal.status.paid` `admin.withdrawal.status.pending` `admin.withdrawal.status.rejected` `admin.withdrawal.status.unknown` | STATUS_KEY[s] ?? 'status.unknown' |
| `apps/web/app/(main)/admin/withdrawal/page.tsx:169` | admin.withdrawal | `admin.withdrawal.status.approved` `admin.withdrawal.status.paid` `admin.withdrawal.status.pending` `admin.withdrawal.status.rejected` `admin.withdrawal.status.unknown` | STATUS_KEY[w.status] ?? 'status.unknown' |
| `apps/web/app/(main)/announcements/page.tsx:82` | announcements | `announcements.types.info` `announcements.types.maintenance` `announcements.types.unknown` `announcements.types.update` `announcements.types.warning` | ANN_TYPE_KEY[a.type] ?? 'types.unknown' |
| `apps/web/app/(main)/announcements/[id]/PageClient.tsx:115` | announcements | `announcements.types.info` `announcements.types.maintenance` `announcements.types.unknown` `announcements.types.update` `announcements.types.warning` | ANN_TYPE_KEY[a.type] ?? 'types.unknown' |
| `apps/web/app/(main)/feedback/FeedbackForm.tsx:77` | feedback | `feedback.type_bug` `feedback.type_feature` `feedback.type_improvement` `feedback.type_other` `feedback.type_unknown` | TYPE_KEY[v] ?? 'type_unknown' |
| `apps/web/app/(main)/feedback/FeedbackList.tsx:83` | feedback | `feedback.type_bug` `feedback.type_feature` `feedback.type_improvement` `feedback.type_other` `feedback.type_unknown` | TYPE_KEY[fb.type] ?? 'type_unknown' |
| `apps/web/app/(main)/feedback/FeedbackList.tsx:91` | feedback | `feedback.status_closed` `feedback.status_pending` `feedback.status_resolved` `feedback.status_reviewing` `feedback.status_unknown` | STATUS_KEY[fb.status] ?? 'status_unknown' |
| `apps/web/app/(main)/feedback/[id]/FeedbackDetailHeader.tsx:71` | feedback | `feedback.type_bug` `feedback.type_feature` `feedback.type_improvement` `feedback.type_other` `feedback.type_unknown` | TYPE_KEY[fb.type] ?? 'type_unknown' |
| `apps/web/app/(main)/feedback/[id]/FeedbackDetailHeader.tsx:73` | feedback | `feedback.status_closed` `feedback.status_pending` `feedback.status_resolved` `feedback.status_reviewing` `feedback.status_unknown` | STATUS_KEY[fb.status] ?? 'status_unknown' |
| `apps/web/app/(main)/feedback/[id]/FeedbackReplyForm.tsx:71` | feedback | `feedback.status_closed` `feedback.status_pending` `feedback.status_resolved` `feedback.status_reviewing` `feedback.status_unknown` | STATUS_KEY[v] ?? 'status_unknown' |
| `apps/web/app/(main)/member/settings/page.tsx:141` | memberSettingsPage | `memberSettingsPage.notif.newsletter` `memberSettingsPage.notif.orderUpdates` `memberSettingsPage.notif.points` `memberSettingsPage.notif.promotions` `memberSettingsPage.notif.unknown` | NOTIF_KEY[key] ?? 'notif.unknown' |
| `apps/web/app/(main)/subscriptions/page.tsx:143` | subscriptions | `subscriptions.types.category` `subscriptions.types.project` `subscriptions.types.tag` `subscriptions.types.unknown` `subscriptions.types.user` | TYPE_KEY[s.targetType] ?? 'types.unknown' |
| `apps/web/app/(main)/task-receiver/PageClient.tsx:125` | taskReceiver | `taskReceiver.status.cancelled` `taskReceiver.status.completed` `taskReceiver.status.failed` `taskReceiver.status.pending` `taskReceiver.status.running` | TASK_STATUS_KEYS[task.status]! |
| `apps/web/app/(main)/wallet/page.tsx:187` | wallet | `wallet.flowCommission` `wallet.flowDeduct` `wallet.flowExpire` `wallet.flowRecharge` `wallet.flowRefund` | OP_TYPE_KEY[it.opType] ?? 'flowRecharge' |
| `apps/web/app/(main)/activities/page.tsx:144` | activities | `activities.status.active` `activities.status.ended` `activities.status.unknown` `activities.status.upcoming` | STATUS_KEY[displayStatus] ?? 'status.unknown' |
| `apps/web/app/(main)/activities/[slug]/PageClient.tsx:172` | activities | `activities.status.active` `activities.status.ended` `activities.status.unknown` `activities.status.upcoming` | STATUS_KEY[computedStatus] ?? 'status.unknown' |
| `apps/web/app/(main)/admin/AdminOverviewCharts.tsx:29` | dashboard.admin | `dashboard.admin.projectStatus.active` `dashboard.admin.projectStatus.archived` `dashboard.admin.projectStatus.completed` `dashboard.admin.projectStatus.unknown` | PROJECT_STATUS_KEY[s.key] ?? 'projectStatus.unknown' |
| `apps/web/app/(main)/admin/edu/answer/card/PageClient.tsx:178` | admin.edu.answer.card | `admin.edu.answer.card.status.graded` `admin.edu.answer.card.status.pending` `admin.edu.answer.card.status.submitted` `admin.edu.answer.card.status.unknown` | STATUS_KEY[st.label] ?? 'status.unknown' |
| `apps/web/app/(main)/admin/edu/exam/records/PageClient.tsx:190` | admin.edu.exam.records | `admin.edu.exam.records.status.graded` `admin.edu.exam.records.status.pending` `admin.edu.exam.records.status.submitted` `admin.edu.exam.records.status.unknown` | STATUS_KEY[r.status] ?? 'status.unknown' |
| `apps/web/app/(main)/admin/feedbacks/FeedbackDialog.tsx:108` | feedback | `feedback.priority_high` `feedback.priority_low` `feedback.priority_medium` `feedback.priority_unknown` | PRIORITY_KEY[p] ?? 'priority_unknown' |
| `apps/web/app/(main)/admin/feedbacks/FeedbackTable.tsx:135` | feedback | `feedback.priority_high` `feedback.priority_low` `feedback.priority_medium` `feedback.priority_unknown` | PRIORITY_KEY[fb.priority] ?? 'priority_unknown' |
| `apps/web/app/(main)/admin/menu-permission/page.tsx:148` | admin.menuPermission | `admin.menuPermission.status_draft` `admin.menuPermission.status_pending` `admin.menuPermission.status_published` `admin.menuPermission.status_rejected` | MENU_STATUS_KEYS[m.status]! |
| `apps/web/app/(main)/developer/versions/page.tsx:113` | developerVersionsPage | `developerVersionsPage.status.beta` `developerVersionsPage.status.deprecated` `developerVersionsPage.status.stable` `developerVersionsPage.status.sunset` | API_VERSION_STATUS_KEYS[v.status]! |
| `apps/web/app/(main)/distribution/withdraw/records/page.tsx:176` | distribution | `distribution.withdrawStatusCompleted` `distribution.withdrawStatusFailed` `distribution.withdrawStatusPending` `distribution.withdrawStatusProcessing` | STATUS_KEY[it.status] ?? 'withdrawStatusPending' |
| `apps/web/app/(main)/feedback/[id]/FeedbackDetailHeader.tsx:76` | feedback | `feedback.priority_high` `feedback.priority_low` `feedback.priority_medium` `feedback.priority_unknown` | PRIORITY_KEY[fb.priority] ?? 'priority_unknown' |
| `apps/web/app/(main)/feedback/[id]/FeedbackReplyForm.tsx:88` | feedback | `feedback.priority_high` `feedback.priority_low` `feedback.priority_medium` `feedback.priority_unknown` | PRIORITY_KEY[v] ?? 'priority_unknown' |
| `apps/web/app/(main)/member/settings/page.tsx:160` | memberSettingsPage | `memberSettingsPage.privacy.allowInvites` `memberSettingsPage.privacy.showActivity` `memberSettingsPage.privacy.showProfile` `memberSettingsPage.privacy.unknown` | PRIVACY_KEY[key] ?? 'privacy.unknown' |
| `apps/web/app/(main)/security-audit/page.tsx:104` | securityAuditPage | `securityAuditPage.type.login` `securityAuditPage.type.other` `securityAuditPage.type.permission` `securityAuditPage.type.sensitive` | TYPE_KEY[ev.type] ?? 'type.other' |
| `apps/web/app/(main)/settings/import/page.tsx:395` | cliImport | `cliImport.statusFailed` `cliImport.statusPartial` `cliImport.statusSuccess` `cliImport.statusUnknown` | HISTORY_STATUS_KEY[h.status] ?? 'statusUnknown' |
| `apps/web/app/(main)/support/NewTicketForm.tsx:129` | supportNewTicketForm | `supportNewTicketForm.priority.high` `supportNewTicketForm.priority.low` `supportNewTicketForm.priority.medium` `supportNewTicketForm.priority.urgent` | TICKET_PRIORITY_KEYS[p]! |
| `apps/web/app/(main)/support/TicketDetailDialog.tsx:117` | ticketDetailDialog | `ticketDetailDialog.priority.high` `ticketDetailDialog.priority.low` `ticketDetailDialog.priority.medium` `ticketDetailDialog.priority.urgent` | TICKET_PRIORITY_KEYS[ticket.priority]! |
| `apps/web/app/(main)/wallet/withdraw/records/page.tsx:194` | wallet | `wallet.statusCompleted` `wallet.statusFailed` `wallet.statusPending` `wallet.statusProcessing` | STATUS_KEY[it.status] |
| `apps/web/src/components/ai/orchestration-hub-panel.tsx:935` | orchestration | `orchestration.telemetry.degraded` `orchestration.telemetry.healthy` `orchestration.telemetry.unhealthy` `orchestration.telemetry.unknown` | TELEMETRY_STATUS_KEY[status] ?? 'telemetry.unknown' |
| `apps/web/src/components/ai-generation/video-generator.tsx:63` | videoGenerator | `videoGenerator.provider.kling` `videoGenerator.provider.one-click` `videoGenerator.provider.qwen` `videoGenerator.provider.unknown` | PROVIDER_KEY[p] ?? 'provider.unknown' |
| `apps/web/src/components/billing/ContractManager.tsx:94` | contractManager | `contractManager.status.active` `contractManager.status.pending` `contractManager.status.unknown` `contractManager.unknown` | STATUS_KEY[c.status ?? 'unknown'] ?? 'status.unknown' |
| `apps/web/app/(main)/admin/edu/finance/invoices/page.tsx:193` | admin.edu.finance.invoices | `admin.edu.finance.invoices.type.company` `admin.edu.finance.invoices.type.personal` `admin.edu.finance.invoices.type.unknown` | TYPE_KEY[inv.type] ?? 'type.unknown' |
| `apps/web/app/(main)/developer/billing/page.tsx:139` | developerBillingPage | `developerBillingPage.payType.alipay` `developerBillingPage.payType.card` `developerBillingPage.payType.wechat` | PAY_TYPE_KEY[p.type] ?? `payType.${p.type}` |
| `apps/web/app/(main)/developer/billing/page.tsx:174` | developerBillingPage | `developerBillingPage.status.failed` `developerBillingPage.status.paid` `developerBillingPage.status.pending` | BILL_STATUS_KEYS[b.status]! |
| `apps/web/app/(main)/distribution/commission/page.tsx:193` | distribution | `distribution.commissionType0` `distribution.commissionType1` `distribution.commissionType2` | TYPE_KEY[it.type] ?? 'commissionType0' |
| `apps/web/app/(main)/distribution/withdraw/records/page.tsx:167` | distribution | `distribution.methodAlipay` `distribution.methodBank` `distribution.methodWechat` | METHOD_KEY[it.method] ?? 'methodWechat' |
| `apps/web/app/(main)/following/PageClient.tsx:103` | follows | `follows.tabs.followers` `follows.tabs.following` `follows.tabs.unknown` | TAB_KEY[value] ?? 'tabs.unknown' |
| `apps/web/app/(main)/following/PageClient.tsx:123` | follows | `follows.empty.followers` `follows.empty.following` `follows.empty.unknown` | EMPTY_KEY[tab] ?? 'empty.unknown' |
| `apps/web/app/(main)/invitations/page.tsx:156` | invitations | `invitations.status.expired` `invitations.status.unused` `invitations.status.used` | INVITATION_STATUS_KEYS[c.status]! |
| `apps/web/app/(main)/learn/[id]/homework/PageClient.tsx:82` | learnHomeworkPage | `learnHomeworkPage.status.failApproval` `learnHomeworkPage.status.passApproval` `learnHomeworkPage.status.submitted` | STATUS_KEY[numKey] ?? 'status.unknown' |
| `apps/web/app/(main)/learn/[id]/homework/PageClient.tsx:84` | learnHomeworkPage | `learnHomeworkPage.status.failApproval` `learnHomeworkPage.status.passApproval` `learnHomeworkPage.status.submitted` | STATUS_KEY[status] ?? 'status.unknown' |
| `apps/web/app/(main)/member/subscription/page.tsx:122` | memberSubscriptionPage | `memberSubscriptionPage.status.active` `memberSubscriptionPage.status.cancelled` `memberSubscriptionPage.status.expired` | SUBSCRIPTION_STATUS_KEYS[sub.status]! |
| `apps/web/app/(main)/teams/[id]/TeamInvitationsList.tsx:67` | teams | `teams.status.accepted` `teams.status.expired` `teams.status.pending` | INVITATION_STATUS_KEYS[inv.status]! |
| `apps/web/app/(main)/teams/[id]/TeamMembersList.tsx:85` | teams | `teams.roles.admin` `teams.roles.member` `teams.roles.owner` | ROLE_LABEL_KEY[m.role] ?? 'roles.member' |
| `apps/web/app/(main)/admin/meta-learner/page.tsx:441` | eduAi.metaLearner | `eduAi.metaLearner.running` `eduAi.metaLearner.skipped` | RUN_I18N[entry.status] |
| `apps/web/app/(main)/learn/topic/page.tsx:214` | learn.topic | `learn.topic.type.lesson.tip` `learn.topic.type.premium.tip` | TYPE_TIP_KEY[topic.type] |
| `apps/web/app/(main)/orders/OrdersList.tsx:63` | orders | `orders.card` `orders.course` | TYPE_KEY[o.orderType === 'course' ? 'course' : 'card'] ??  |
| `apps/web/app/(main)/subscriptions/page.tsx:114` | subscriptions | `subscriptions.tabs.category` `subscriptions.tabs.unknown` | TAB_KEY[tabItem.value] ?? 'tabs.unknown' |
| `apps/web/app/(main)/admin/announcements/AnnouncementTable.tsx:90` | admin.announcements | `admin.announcements.types.unknown` | ANN_TYPE_KEY[a.type] ?? 'types.unknown' |
| `apps/web/app/(main)/admin/edu/exam/ExamTable.tsx:106` | admin.edu.exam.index | `admin.edu.exam.index.unpublished` | STATUS_KEY[p.isPublished ? 'published' : 'unpublished'] ?? |
| `apps/web/app/(main)/admin/edu/finance/invoices/page.tsx:204` | admin.edu.finance.invoices | `admin.edu.finance.invoices.status.unknown` | STATUS_KEY[inv.status] ?? 'status.unknown' |
| `apps/web/app/(main)/agents/my/page.tsx:126` | agentsMyPage | `agentsMyPage.statusFilters.unknown` | STATUS_FILTER_KEY[f.value] ?? 'statusFilters.unknown' |
| `apps/web/app/(main)/agents/my/page.tsx:174` | agentsMyPage | `agentsMyPage.statusFilters.unknown` | STATUS_FILTER_KEY[agent.status] ?? 'statusFilters.unknown' |
| `apps/web/app/(main)/feedback/page.tsx:105` | feedback | `feedback.tab_unknown` | TAB_KEY[v] ?? 'tab_unknown' |
| `apps/web/app/(main)/orders/OrdersFilter.tsx:47` | orders | `orders.type.unknown` | TYPE_KEY[tab.labelKey] ?? 'type.unknown' |
| `apps/web/app/(main)/orders/OrdersList.tsx:89` | orders | `orders.status.unknown` | STATUS_KEY[o.status] ?? 'status.unknown' |
| `apps/web/app/(main)/payment/checkout/PageClient.tsx:163` | payment | `payment.plans.unknown.name` | PLAN_NAME_KEY[planId] ?? 'plans.unknown.name' |
| `apps/web/app/(main)/payment/page.tsx:84` | payment | `payment.plans.unknown.name` | PLAN_NAME_KEY[plan.id] ?? 'plans.unknown.name' |
| `apps/web/app/(main)/points/sign-in/page.tsx:218` | points.signIn | `points.signIn.dayUnknown` | WEEKDAY_KEY[d] ?? 'dayUnknown' |
| `apps/web/app/(main)/ranking/PageClient.tsx:75` | rankingPage | `rankingPage.range.unknown` | RANGE_KEY[r] ?? 'range.unknown' |
| `apps/web/app/(main)/tools/pdf/split/page.tsx:87` | toolsPdfSplitPage | `toolsPdfSplitPage.mode.unknown` | MODE_KEY[key] ?? 'mode.unknown' |
| `apps/web/src/components/agents/KanbanBoard.tsx:268` | agent | `agent.kanban.unknown` | KANBAN_LABEL_KEY[opt.labelKey] ?? 'kanban.unknown' |
| `apps/web/src/components/ai/permission-history-panel.tsx:146` | chat.permission | `chat.permission.historySource.unknown` | HISTORY_SOURCE_KEY[sourceKey] ?? 'historySource.unknown' |
| `apps/web/src/components/cron/CronEditor.tsx:182` | cronEditor | `cronEditor.field.unknown` | FIELD_KEY[cfg.key] ?? 'field.unknown' |
| `apps/web/src/components/cron/CronEditor.tsx:198` | cronEditor | `cronEditor.mode.unknown` | MODE_KEY[mode] ?? 'mode.unknown' |
| `apps/web/src/components/settings/ThemeBackupSync.tsx:128` | settings | `settings.themeUnknown` | THEME_LABEL_KEY[th] ?? 'themeUnknown' |

## 按命名空间汇总(便于分片认领,避免多会话撞车)

| 端 · 命名空间 | 待补路径数 |
|---|---|
| mobile-rn · ` ` | 49 |
| miniapp-taro · ` ` | 39 |
| web · `feedback ` | 15 |
| web · ` ` | 13 |
| web · `developer.notifications ` | 12 |
| web · `distribution ` | 10 |
| web · `dashboard.admin ` | 9 |
| web · `admin.menuPermission ` | 9 |
| web · `memberSettingsPage ` | 9 |
| web · `ticketDetailDialog ` | 9 |
| web · `wallet ` | 9 |
| web · `aiWorld.admin.sites ` | 8 |
| web · `workspace.permission.auditRequest ` | 8 |
| web · `agentsStatsPage ` | 7 |
| web · `subscriptions ` | 7 |
| web · `developerBillingPage ` | 6 |
| web · `follows ` | 6 |
| web · `memberExamSignUpPage ` | 6 |
| web · `messages ` | 6 |
| web · `tags ` | 6 |
| web · `teams ` | 6 |
| web · `musicGenerator ` | 6 |
| web · `common ` | 6 |
| web · `admin.withdrawal ` | 5 |
| web · `announcements ` | 5 |
| web · `taskReceiver ` | 5 |
| web · `activities ` | 4 |
| web · `admin.edu.answer.card ` | 4 |
| web · `admin.edu.exam.records ` | 4 |
| web · `admin.edu.finance.invoices ` | 4 |
| web · `developerVersionsPage ` | 4 |
| web · `orders ` | 4 |
| web · `securityAuditPage ` | 4 |
| web · `cliImport ` | 4 |
| web · `supportNewTicketForm ` | 4 |
| web · `orchestration ` | 4 |
| web · `videoGenerator ` | 4 |
| web · `contractManager ` | 4 |
| web · `invitations ` | 3 |
| web · `learnHomeworkPage ` | 3 |
| web · `memberSubscriptionPage ` | 3 |
| web · `eduAi.metaLearner ` | 2 |
| web · `learn.topic ` | 2 |
| web · `cronEditor ` | 2 |
| web · `admin.announcements ` | 1 |
| web · `admin.edu.exam.index ` | 1 |
| web · `agentsMyPage ` | 1 |
| web · `payment ` | 1 |
| web · `points.signIn ` | 1 |
| web · `rankingPage ` | 1 |
| web · `toolsPdfSplitPage ` | 1 |
| web · `agent ` | 1 |
| web · `chat.permission ` | 1 |
| web · `settings ` | 1 |

## 已知盲区(本档案未收录,不要误以为已覆盖)

- `t` 由 props 传入、命名空间静态不可判定的调用点(实测 16 处)。
- 词法拼接而非段边界的键(如 `tool_${k}`、`step${Cap}`、`${key}Title`):这类值本身是**单层**叶子名,词典里存在对应单层键时是可用的,naive 规则必误报,故未计入。
- 运行时数据(API 返回的 id/domain)拼出的路径:静态无法枚举,需按端点契约单独看。
- **守门现状**:含点键、同层重复 key、模板键静态前缀可达性 三条已 blocking(2026-09-21);"常量映射表的值"这一维度**尚未接守门**,因为存量如上表,接入前需先清零或建立只降不升基线。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
