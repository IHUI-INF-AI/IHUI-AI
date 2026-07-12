# Schema 表名审计清单

> 生成时间：2026-07-12
> 扫描目录：`g:\IHUI-AI\packages\database\src\schema\*.ts`
> 匹配模式：`export const \w+ = pgTable(...)`

## 统计

- 总导出表数：**388**
- 匹配缺失路由的表数：**24**
- 无对应表的缺失路由数：**24**

---

## 完整表清单（按文件分组）

### ab-tests.ts

- abTests → 'ab_tests'
- abTestVariants → 'ab_test_variants'
- abTestResults → 'ab_test_results'

### admin-sys.ts

- sysMenus → 'sys_menu'
- sysLogininfor → 'sys_logininfor'
- sysNotices → 'sys_notice'
- sysJobs → 'sys_job'
- sysJobLogs → 'sys_job_log'
- sysDepts → 'sys_dept'
- sysPosts → 'sys_post'
- sysConfigs → 'sys_config'
- sysDictTypes → 'sys_dict_type'
- sysDictData → 'sys_dict_data'

### agent-commerce.ts

- zhsAgentBuy → 'zhs_agent_buy'
- zhsAgentWithdrawalDetail → 'zhs_agent_withdrawal_detail'

### agent-context.ts

- userAgentFreeTimes → 'user_agent_free_times'
- zhsUserAgentContext → 'zhs_user_agent_context'
- zhsUserAgentAudio → 'zhs_user_agent_audio'
- zhsUserAgentImage → 'zhs_user_agent_image'

### agent-rule.ts

- agentRule → 'agent_rule'
- agentRuleLink → 'agent_rule_link'
- agentRuleParam → 'agent_rule_param'
- agentUpload → 'agent_upload'

### agents-extended.ts

- agents → 'agents'
- agentCategories → 'agent_categories'
- agentSettlements → 'agent_settlements'
- agentExamines → 'agent_examines'
- agentHeatStats → 'agent_heat_stats'
- agentCallbacks → 'agent_callbacks'
- agentConfigs → 'agent_configs'
- agentCategoryLink → 'agent_category_links'

### agreements.ts

- agreements → 'agreements'

### ai-capabilities.ts

- aiCapabilities → 'ai_capabilities'
- aiCapabilityTemplates → 'ai_capability_templates'

### ai-config.ts

- aiModelConfig → 'ai_model_config'
- userSkInfo → 'user_sk_info'
- videoGenerationTasks → 'video_generation_tasks'

### ai-cost.ts

- aiCostRecords → 'ai_cost_records'
- aiBudgets → 'ai_budgets'

### ai-education.ts

- aiEducationPolicy → 'ai_education_policy'
- aiTeacherCertification → 'ai_teacher_certification'
- aigcToolDetail → 'aigc_tool_detail'
- k12AiCurriculum → 'k12_ai_curriculum'
- universityAiCourse → 'university_ai_course'

### ai-feed.ts

- aiFeedSource → 'ai_feed_source'
- aiFeedHotItem → 'ai_feed_hot_item'
- aiFeedSnapshot → 'ai_feed_snapshot'
- aiFeedTrendSignal → 'ai_feed_trend_signal'

### ai-gc.ts

- aiGcContent → 'ai_gc_content'
- aiGcTask → 'ai_gc_task'

### ai-user-model-chat.ts

- zhsAiUserModelChatConfig → 'zhs_ai_user_model_chat_config'
- zhsAiUserModelChatHistory → 'zhs_ai_user_model_chat_history'

### app-version.ts

- appVersions → 'app_versions'

### ask-extra.ts

- askCategories → 'ask_categories'
- askQuestionCategories → 'ask_question_categories'
- askLikes → 'ask_likes'
- askFavorites → 'ask_favorites'
- askComments → 'ask_comments'

### audit.ts

- auditLogs → 'audit_logs'
- searchHistory → 'search_history'

### auth-identity.ts

- authIdentities → 'auth_identities'

### behavior.ts

- behaviorWatchRecords → 'behavior_watch_records'

### billing.ts

- plans → 'plans'
- orders → 'orders'
- payments → 'payments'
- aiPricing → 'ai_pricing'

### bot-sites.ts

- aibotSites → 'aibot_sites'
- simpleBotConfigs → 'simple_bot_configs'

### canary.ts

- canaryConfigs → 'canary_configs'
- canaryAuditLogs → 'canary_audit_logs'

### captcha.ts

- captchas → 'captchas'

### carousels.ts

- carousels → 'carousels'

### certificate.ts

- certificateTemplates → 'certificate_templates'
- certificates → 'certificates'
- certificateSerialNumber → 'certificate_serial_numbers'

### chat.ts

- chatConversations → 'chat_conversations'
- chatMessages → 'chat_messages'
- chatFavorites → 'chat_favorites'

### circle-extra.ts

- circleCategories → 'circle_categories'
- circleMembers → 'circle_members'
- circlePostLikes → 'circle_post_likes'
- circlePostComments → 'circle_post_comments'

### comments.ts

- comments → 'comments'
- commentLikes → 'comment_likes'
- feedbacks → 'feedbacks'

### commission.ts

- commissionFlows → 'commission_flows'
- withdrawalFlows → 'withdrawal_flows'
- identityProportions → 'identity_proportions'

### community.ts

- circles → 'circles'
- circlePosts → 'circle_posts'
- asks → 'asks'
- askAnswers → 'ask_answers'

### content.ts

- announcements → 'announcements'
- helpArticles → 'help_articles'
- helpCategories → 'help_categories'
- docs → 'docs'
- announcementReads → 'announcement_reads'

### customer-service.ts

- customerServiceCategories → 'customer_service_categories'
- customerServiceTickets → 'customer_service_tickets'
- customerServiceComments → 'customer_service_comments'
- customerServiceAgents → 'customer_service_agents'
- customerServiceSessions → 'customer_service_sessions'
- customerServiceRatings → 'customer_service_ratings'

### demand-square.ts

- zhsDemandSquare → 'zhs_demand_square'

### developer-api-keys.ts

- developerApiKeys → 'developer_api_keys'

### edu-extended.ts

- eduNotes → 'edu_notes'
- eduOfflineRecords → 'edu_offline_records'
- eduUploadedCerts → 'edu_uploaded_certs'
- eduUploadedPapers → 'edu_uploaded_papers'

### edu-full.ts

- eduRole → 'edu_role'
- eduAuthority → 'edu_authority'
- eduRoleAuthority → 'edu_role_authority'
- eduCarousel → 'edu_carousel'
- eduAgreement → 'edu_agreement'
- eduArticle → 'edu_article'
- eduNews → 'edu_news'
- eduCategory → 'edu_category'
- eduUser → 'edu_user'
- eduTrade → 'edu_trade'
- eduLearnCategory → 'edu_learn_category'
- eduLearnMap → 'edu_learn_map'
- eduLessonHomework → 'edu_lesson_homework'
- eduLessonStudyRecord → 'edu_lesson_study_record'
- eduLessonTopic → 'edu_lesson_topic'
- eduSignUp → 'edu_sign_up'
- eduExamCategory → 'edu_exam_category'
- eduExam → 'edu_exam'
- eduExamChapter → 'edu_exam_chapter'
- eduExamChapterSection → 'edu_exam_chapter_section'
- eduExamQuestion → 'edu_exam_question'
- eduExamPaper → 'edu_exam_paper'
- eduExamPaperRule → 'edu_exam_paper_rule'
- eduExamPaperQuestion → 'edu_exam_paper_question'
- eduExamRecord → 'edu_exam_record'
- eduResourceCategory → 'edu_resource_category'
- eduResource → 'edu_resource'
- eduResourceProduct → 'edu_resource_product'
- eduCircleCategory → 'edu_circle_category'
- eduCircle → 'edu_circle'
- eduCircleDynamic → 'edu_circle_dynamic'
- eduComment → 'edu_comment'
- eduFavorite → 'edu_favorite'
- eduLike → 'edu_like'
- eduAskCategory → 'edu_ask_category'
- eduQuestion → 'edu_question'
- eduAnswer → 'edu_answer'
- eduLiveCategory → 'edu_live_category'
- eduLiveChannel → 'edu_live_channel'
- eduIndexConfig → 'edu_index_config'
- eduIndexCategory → 'edu_index_category'
- eduNotification → 'edu_notification'
- eduNotificationDevice → 'edu_notification_device'
- eduVisitLog → 'edu_visit_log'
- eduWatchRecord → 'edu_watch_record'

### education-platform.ts

- educationPlatform → 'education_platform'
- educationSyncLog → 'education_sync_log'

### exam-extended.ts

- examChapters → 'exam_chapters'
- examChapterSections → 'exam_chapter_sections'
- examSignups → 'exam_signups'
- examWrongQuestion → 'exam_wrong_question'

### exam.ts

- examCategories → 'exam_categories'
- examPapers → 'exam_papers'
- examQuestions → 'exam_questions'
- examRecords → 'exam_records'

### faq.ts

- zhsFaqCategory → 'zhs_faq_category'
- zhsFaq → 'zhs_faq'

### files-extra.ts

- fileShares → 'file_shares'
- fileVersions → 'file_versions'

### files.ts

- files → 'files'

### gamification.ts

- userPoints → 'user_points'
- pointTransactions → 'point_transactions'
- signInRecords → 'sign_in_records'
- levels → 'levels'
- signInRules → 'sign_in_rules'

### gen-table.ts

- genTable → 'gen_table'
- genTableColumn → 'gen_table_column'
- tboxBean → 'tbox_bean'
- adminUserPost → 'admin_user_post'

### groups.ts

- userGroups → 'user_groups'
- userGroupMembers → 'user_group_members'

### identity.ts

- zhsIdentity → 'zhs_identity'
- zhsOrganization → 'zhs_organization'
- oauthPrivateKeys → 'oauth_private_keys'

### learn-extended.ts

- learnHomework → 'learn_homework'
- learnMaps → 'learn_maps'
- learnInvoiceApplications → 'learn_invoice_applications'
- learnInvoiceTitles → 'learn_invoice_titles'

### learn-extra-extended.ts

- learnRecord → 'learn_record'
- learnRecordLog → 'learn_record_log'
- learnTopic → 'learn_topic'
- learnTopicCategory → 'learn_topic_category'
- learnTopicCategoryRelation → 'learn_topic_category_relation'
- learnTopicLesson → 'learn_topic_lesson'
- learnTopicTopicCategoryRelation → 'learn_topic_topic_category_relation'
- learnLearnMapTopic → 'learn_learn_map_topic'
- learnHomeworkRecord → 'learn_homework_record'
- lessonTask → 'lesson_task'
- lessonRate → 'lesson_rate'
- lessonAccess → 'lesson_access'

### learn.ts

- learnCategories → 'learn_categories'
- lessons → 'lessons'
- lessonChapters → 'lesson_chapters'
- lessonChapterSections → 'lesson_chapter_sections'
- lessonSignUps → 'lesson_sign_ups'

### live-extended.ts

- liveCategoryRelation → 'live_category_relation'
- liveChannelCategory → 'live_channel_category'
- liveChannelCategoryRelation → 'live_channel_category_relation'
- liveChannelLecturer → 'live_channel_lecturer'
- liveComment → 'live_comment'
- liveGift → 'live_gift'
- liveSubscribe → 'live_subscribe'
- liveTencentCloudLiveStream → 'live_tencent_cloud_live_stream'

### live.ts

- liveCategories → 'live_categories'
- liveLecturers → 'live_lecturers'
- liveChannels → 'live_channels'

### member-extended.ts

- memberGroups → 'member_groups'
- memberPosts → 'member_posts'
- memberTags → 'member_tags'
- memberTypes → 'member_types'
- companyTypes → 'company_types'
- eduMemberCompanyRelations → 'edu_member_company_relations'
- eduMemberLevelRelations → 'edu_member_level_relations'
- eduMemberPostRelations → 'edu_member_post_relations'
- eduMemberTagRelations → 'edu_member_tag_relations'
- eduResourceProductRelations → 'edu_resource_product_relations'

### member.ts

- eduMemberLevels → 'edu_member_levels'
- eduCompanies → 'edu_companies'
- eduDepartments → 'edu_departments'
- eduMembers → 'edu_members'

### message-templates.ts

- messageTemplates → 'message_templates'

### message.ts

- eduAnnouncements → 'edu_announcements'
- eduMessages → 'edu_messages'

### miniprogram.ts

- miniprogramConfigs → 'miniprogram_configs'
- miniprogramVersions → 'miniprogram_versions'

### misc-extended-2.ts

- hotWords → 'hot_words'
- newsTops → 'news_tops'
- newsRecommends → 'news_recommends'

### misc-extended.ts

- plazaItems → 'plaza_items'
- cozeVariables → 'coze_variables'

### monitor.ts

- monitorAlerts → 'monitor_alerts'
- suppressionRules → 'suppression_rules'

### news-crawler.ts

- newsCrawlerSources → 'news_crawler_sources'
- newsCrawlerArticles → 'news_crawler_articles'

### news.ts

- newsCategories → 'news_categories'
- newsArticles → 'news_articles'

### notifications.ts

- notifications → 'notifications'
- messages → 'messages'

### oauth.ts

- oauthApps → 'oauth_apps'
- oauthSessions → 'oauth_sessions'
- oauthUsers → 'oauth_users'
- oauthAuditLogs → 'oauth_audit_logs'
- oauthScopeMeta → 'oauth_scope_meta'
- userThirdPartyAccounts → 'user_third_party_accounts'
- userSk → 'user_sk'

### order.ts

- eduOrders → 'edu_orders'
- eduPayments → 'edu_payments'
- eduRefunds → 'edu_refunds'
- eduInvoiceTitles → 'edu_invoice_titles'
- eduInvoiceApplications → 'edu_invoice_applications'
- eduOrderItems → 'edu_order_items'

### oss.ts

- ossDrivers → 'oss_drivers'

### payment-callbacks.ts

- paymentCallbacks → 'payment_callbacks'
- transferInfos → 'transfer_infos'
- wxPayNotifications → 'wx_pay_notifications'

### point.ts

- eduPointChannels → 'edu_point_channels'
- eduPoints → 'edu_points'
- eduPointChannelRelations → 'edu_point_channel_relations'
- eduPointRecords → 'edu_point_records'

### product-identity.ts

- productIdentities → 'product_identities'

### projects.ts

- projects → 'projects'
- projectMembers → 'project_members'

### promotions.ts

- invitationCodes → 'invitation_codes'
- activities → 'activities'
- activityParticipants → 'activity_participants'
- coupons → 'coupons'

### rbac.ts

- roles → 'roles'
- permissions → 'permissions'
- rolePermissions → 'role_permissions'
- userRoles → 'user_roles'

### refund-audit.ts

- refundAuditRecords → 'refund_audit_records'

### relation-tables.ts

- examCategoryRelation → 'exam_category_relation'
- examExam → 'exam_exam'
- examExamCategoryRelation → 'exam_exam_category_relation'
- examExamChapter → 'exam_exam_chapter'
- examExamChapterSection → 'exam_exam_chapter_section'
- examSignUp → 'exam_sign_up'
- examPaperCategory → 'exam_paper_category'
- examPaperCategoryRelation → 'exam_paper_category_relation'
- examPaperPaperCategoryRelation → 'exam_paper_paper_category_relation'
- examPaperQuestion → 'exam_paper_question'
- examPaperQuestionRule → 'exam_paper_question_rule'
- examQuestionCategory → 'exam_question_category'
- examQuestionCategoryRelation → 'exam_question_category_relation'
- examQuestionAndCategoryRelation → 'exam_question_and_category_relation'
- learnCategoryRelation → 'learn_category_relation'
- learnLessonCategoryRelation → 'learn_lesson_category_relation'
- learnOrder → 'learn_order'
- learnSignUp → 'learn_sign_up'
- circleCategoryRelation → 'circle_category_relation'
- circleCircle → 'circle_circle'
- circleCircleCategoryRelation → 'circle_circle_category_relation'
- circleCircleMember → 'circle_circle_member'
- circleDynamic → 'circle_dynamic'
- behaviorComment → 'behavior_comment'
- behaviorFavorite → 'behavior_favorite'
- behaviorFollow → 'behavior_follow'
- behaviorLike → 'behavior_like'
- behaviorReport → 'behavior_report'
- behaviorSensitive → 'behavior_sensitive'
- behaviorShare → 'behavior_share'
- messageAnnouncement → 'message_announcement'
- messageAnnouncementReadRecord → 'message_announcement_read_record'
- messageNotice → 'message_notice'
- messageReadLog → 'message_read_log'
- messageSystemNotice → 'message_system_notice'
- messagePrivateLetter → 'message_private_letter'
- notificationChannel → 'notification_channel'
- notificationLog → 'notification_log'
- notificationSubscription → 'notification_subscription'
- pointExchange → 'point_exchange'
- pointGoods → 'point_goods'
- pointRule → 'point_rule'
- resourceCategoryRelation → 'resource_category_relation'
- resourceResource → 'resource_resource'
- resourceResourceCategoryRelation → 'resource_resource_category_relation'
- resourceResourceDownload → 'resource_resource_download'
- resourceResourceSearchRecord → 'resource_resource_search_record'
- adminRole → 'admin_role'
- adminRoleDept → 'admin_role_dept'
- adminRoleMenu → 'admin_role_menu'
- adminUser → 'admin_user'
- adminUserRole → 'admin_user_role'
- searchLog → 'search_log'
- tArticle → 't_article'
- tMemberCompany → 't_member_company'
- tOrderItem → 't_order_item'
- tOrderPayment → 't_order_payment'
- visitPage → 'visit_page'
- visitSource → 'visit_source'
- visitStats → 'visit_stats'

### remote-device.ts

- remoteDevices → 'remote_devices'
- remoteDeviceTasks → 'remote_device_tasks'

### resource.ts

- resourceCategories → 'resource_categories'
- resources → 'resources'
- resourceProducts → 'resource_products'
- resourceTags → 'resource_tags'
- resourceDownloads → 'resource_downloads'
- resourceSearchLogs → 'resource_search_logs'

### schedule.ts

- scheduleTasks → 'schedule_tasks'
- scheduleLogs → 'schedule_logs'

### sdks.ts

- sdks → 'sdks'

### security.ts

- auditChainEntries → 'audit_chain_entries'
- apiKeyQuotas → 'api_key_quotas'
- outboxEvents → 'outbox_events'

### sensitive-words.ts

- sensitiveWords → 'sensitive_words'

### setting.ts

- eduSettings → 'edu_settings'

### social.ts

- userFollows → 'user_follows'
- userFavorites → 'user_favorites'
- subscriptions → 'subscriptions'
- tags → 'tags'
- tagRelations → 'tag_relations'

### srs.ts

- srsStreams → 'srs_streams'
- srsServers → 'srs_servers'

### statistics.ts

- statisticsSnapshots → 'statistics_snapshots'

### stock.ts

- stockAnalyses → 'stock_analyses'

### system.ts

- systemConfigs → 'system_configs'
- integrationConfigs → 'integration_configs'
- apiLogs → 'api_logs'
- systemEvents → 'system_events'
- paymentConfig → 'payment_configs'

### tbox-extended.ts

- tboxDevice → 'tbox_device'
- tboxCommand → 'tbox_command'

### teams.ts

- teams → 'teams'
- teamMembers → 'team_members'
- teamInvitations → 'team_invitations'

### tenant.ts

- tenants → 'tenants'
- tenantMembers → 'tenant_members'
- tenantQuotas → 'tenant_quotas'

### tool.ts

- tools → 'tools'
- toolFavorites → 'tool_favorites'

### topic.ts

- eduLessonTopics → 'edu_lesson_topics'

### tour.ts

- tourContent → 'tour_content'
- tourRecommendations → 'tour_recommendations'
- tourDependencies → 'tour_dependencies'
- tourEvents → 'tour_events'

### trader.ts

- traders → 'traders'

### upload-sessions.ts

- uploadSessions → 'upload_sessions'

### user-auth-info.ts

- userAuthInfo → 'user_auth_info'

### user-memory.ts

- userMemories → 'user_memories'

### usercenter.ts

- departments → 'departments'
- userProfiles → 'user_profiles'
- userCertificates → 'user_certificates'
- userJobs → 'user_jobs'
- departmentRelation → 'department_relations'

### users.ts

- users → 'users'
- refreshTokens → 'refresh_tokens'

### vip.ts

- vipLevels → 'vip_levels'
- userVips → 'user_vips'

### visit-tracking.ts

- visitLogs → 'visit_logs'

### wallet.ts

- userMargins → 'user_margins'
- tokenFlows → 'token_flows'

### webhooks.ts

- webhooks → 'webhooks'
- webhookEvents → 'webhook_events'

### workflow.ts

- workflows → 'workflows'
- workflowInstances → 'workflow_instances'
- workflowTasks → 'workflow_tasks'
- workflowLogs → 'workflow_logs'

### zhs-full.ts

- zhsActivity → 'zhs_activity'
- zhsAgentCategory → 'zhs_agent_category'
- zhsAgentDeveloper → 'zhs_agent_developer'
- zhsAgentNeedTask → 'zhs_agent_need_task'
- zhsAiModelInfo → 'zhs_ai_model_info'
- zhsDeveloperLink → 'zhs_developer_link'
- zhsUserModelChat → 'zhs_user_model_chat'
- zhsBannerCarousel → 'zhs_banner_carousel'
- zhsCategoryDictionary → 'zhs_category_dictionary'
- zhsInformation → 'zhs_information'
- zhsProduct → 'zhs_product'
- zhsKnowledgePlanet → 'zhs_knowledge_planet'
- zhsCourse → 'zhs_course'
- zhsCourseNew → 'zhs_course_new'
- zhsCourseVideo → 'zhs_course_video'
- zhsEducationalCourse → 'zhs_educational_course'
- zhsEducationPlatform → 'zhs_education_platform'
- zhsCourseAudit → 'zhs_course_audit'
- zhsCoursePay → 'zhs_course_pay'
- zhsCoursePayLog → 'zhs_course_pay_log'
- zhsCoursePlatformLog → 'zhs_course_platform_log'
- zhsCourseTemp → 'zhs_course_temp'
- zhsCourseVideoTemp → 'zhs_course_video_temp'
- zhsIdentityExt → 'zhs_identity_ext'
- zhsOrganizationExt → 'zhs_organization_ext'
- zhsPopularCourses → 'zhs_popular_courses'
- zhsExchangeRate → 'zhs_exchange_rate'
- zhsOfficialInformation → 'zhs_official_information'
- zhsResources → 'zhs_resources'
- zhsOrder → 'zhs_order'
- zhsOperateTokenFlow → 'zhs_operate_token_flow'
- zhsUserAgentFreeTime → 'zhs_user_agent_free_time'
- zhsUserCommentLog → 'zhs_user_comment_log'
- zhsUserPlatform → 'zhs_user_platform'
- zhsUserVideoComment → 'zhs_user_video_comment'
- zhsUserVideoLog → 'zhs_user_video_log'

### zone.ts

- zhsZone → 'zhs_zone'

---

## 缺失路由匹配表

### ✅ 已匹配（有对应 schema 表）— 24 条

| 前端路径                       | 对应 schema 表                                         | 表名                                                       | schema 文件                      |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------- |
| /api/admin/carousel            | carousels                                              | carousels                                                  | carousels.ts                     |
| /api/admin/ai-gc               | aiGcContent / aiGcTask                                 | ai_gc_content / ai_gc_task                                 | ai-gc.ts                         |
| /api/admin/comment-logs        | zhsUserCommentLog                                      | zhs_user_comment_log                                       | zhs-full.ts                      |
| /api/admin/video-logs          | zhsUserVideoLog                                        | zhs_user_video_log                                         | zhs-full.ts                      |
| /api/admin/zhs-activity        | zhsActivity                                            | zhs_activity                                               | zhs-full.ts                      |
| /api/admin/zhs-agent           | agents / zhsAgentCategory / zhsAgentDeveloper          | agents / zhs_agent_category / zhs_agent_developer          | agents-extended.ts / zhs-full.ts |
| /api/admin/zhs-user            | users                                                  | users                                                      | users.ts                         |
| /api/admin/zhs-identity        | zhsIdentity                                            | zhs_identity                                               | identity.ts                      |
| /api/admin/task-developer      | zhsAgentDeveloper                                      | zhs_agent_developer                                        | zhs-full.ts                      |
| /api/admin/auth-user-vip       | userVips                                               | user_vips                                                  | vip.ts                           |
| /api/admin/auth-vip-level      | vipLevels                                              | vip_levels                                                 | vip.ts                           |
| /api/admin/auth-info           | userAuthInfo                                           | user_auth_info                                             | user-auth-info.ts                |
| /api/admin/auth-role           | userRoles                                              | user_roles                                                 | rbac.ts                          |
| /api/admin/auth-user-margin    | userMargins                                            | user_margins                                               | wallet.ts                        |
| /api/admin/system/login-logs   | sysLogininfor                                          | sys_logininfor                                             | admin-sys.ts                     |
| /api/admin/learn/homework      | learnHomework                                          | learn_homework                                             | learn-extended.ts                |
| /api/admin/courses             | zhsCourse / zhsCourseNew / zhsEducationalCourse        | zhs_course / zhs_course_new / zhs_educational_course       | zhs-full.ts                      |
| /api/admin/monitor/*           | monitorAlerts / suppressionRules                       | monitor_alerts / suppression_rules                         | monitor.ts                       |
| /api/admin/event-bus/*         | outboxEvents                                           | outbox_events                                              | security.ts                      |
| /api/admin/oauth/apps          | oauthApps                                              | oauth_apps                                                 | oauth.ts                         |
| /api/admin/developer-link      | zhsDeveloperLink                                       | zhs_developer_link                                         | zhs-full.ts                      |
| /api/admin/oss/files           | files / ossDrivers                                     | files / oss_drivers                                        | files.ts / oss.ts                |
| /api/admin/identity-proportion | identityProportions                                    | identity_proportions                                       | commission.ts                    |
| /api/admin/news/information    | zhsInformation / newsArticles / zhsOfficialInformation | zhs_information / news_articles / zhs_official_information | zhs-full.ts / news.ts            |

### ❌ 无对应表（需返回空数据桩）— 24 条

| 前端路径                           | 备注（近似表/可复用）                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| /api/admin/about-us                | 无 about/aboutUs 表；可考虑复用 content.ts 的 docs 表或新建                            |
| /api/admin/advertise               | 无 advertisement 表；无近似表                                                          |
| /api/admin/contact                 | 无 contacts 表；contact 仅作为字段存在于 comments/member 表                            |
| /api/admin/auth-accounts           | 无 oauthAccounts 表；近似: userThirdPartyAccounts / oauthUsers                         |
| /api/admin/auth-tokens             | 无 oauthTokens 表；近似: oauthSessions / refreshTokens                                 |
| /api/admin/auth-veri-codes         | 无 verificationCodes 表；近似: captchas                                                |
| /api/admin/auth-sms-temp           | 无 smsTemplates 表；近似: messageTemplates                                             |
| /api/admin/auth-find-info          | 无 findInfo 表；无近似表                                                               |
| /api/admin/member/blacklist        | 无 memberBlacklist 表；无近似表                                                        |
| /api/admin/system/operation-logs   | 无 operationLogs/operLog 表；近似: auditLogs / apiLogs / sysJobLogs                    |
| /api/admin/shop/products           | 无 shopProducts 表；近似: zhsProduct / resourceProducts                                |
| /api/admin/shop/funds              | 无 shopFunds 表；无近似表                                                              |
| /api/admin/shop/withdrawals        | 无 shopWithdrawals 表；近似: withdrawalFlows / zhsAgentWithdrawalDetail                |
| /api/admin/learn/materials         | 无 learnMaterials 表；无近似表                                                         |
| /api/admin/learn/plans             | 无 learnPlans 表；近似: learnMaps                                                      |
| /api/admin/learn/reminds           | 无 learnReminds 表；近似: eduNotification / notifications                              |
| /api/admin/edu/classes             | 无 eduClasses 表；近似: eduDepartments / lessons                                       |
| /api/admin/db-opt/*                | 无 db-opt 专用表；近似: genTable / genTableColumn                                      |
| /api/admin/performance-dashboard/* | 无 performance-dashboard 专用表；近似: statisticsSnapshots                             |
| /api/admin/api-groups              | 无 apiGroups 表；无近似表                                                              |
| /api/admin/api-usage/*             | 无 api-usage 专用表；近似: apiLogs / apiKeyQuotas                                      |
| /api/admin/mobile-adapter          | 无 mobileAdapter 表；无近似表                                                          |
| /api/admin/recommendation-config   | 无 recommendationConfig 表；近似: newsRecommends                                       |
| /api/admin/finance/statistics      | 无 financeStatistics 表；近似: statisticsSnapshots / commissionFlows / withdrawalFlows |

---

## 建议

1. **24 条无对应表的缺失路由**需返回空数据桩（`{ code: 0, message: 'ok', data: { list: [], total: 0 } }`），避免前端 404。
2. **变量名差异注意**：前端期望 `vipUsers` 但 schema 变量名为 `userVips`；前端期望 `authInfo` 但 schema 变量名为 `userAuthInfo`。
3. **近似表复用**：部分无对应表的路由可复用近似表（如 `auth-sms-temp` → `messageTemplates`，`system/operation-logs` → `auditLogs`），需确认业务语义后决定。
4. **relation-tables.ts 表名**：该文件包含 57 张关联表，表名均通过 grep -A 1 提取，已全部确认。
