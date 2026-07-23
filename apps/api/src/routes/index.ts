import { type FastifyInstance } from 'fastify'

import { healthRoutes } from './health.js'
import { authRoutes } from './auth.js'
import { usersRoutes } from './users.js'
import { workspaceRoutes } from './workspace.js'
import { workspaceAiRoutes } from './workspace-ai.js'
import { workspacePermissionRoutes } from './workspace-permissions.js'
import { fileRoutes } from './files.js'
import { adminRoutes } from './admin.js'
import { i18nDashboardRoutes } from './i18n-dashboard.js'
import { notificationRoutes } from './notifications.js'
import { billingRoutes } from './billing.js'
import { searchRoutes } from './search.js'
import { auditRoutes } from './audit.js'
import { chatRoutes } from './chat.js'
import { chatModelRoutes } from './chat-models.js'
import { chatSkillsRoutes } from './chat-skills.js'
import { teamRoutes } from './teams.js'
import { rbacRoutes } from './rbac.js'
import { workflowRoutes } from './workflows.js'
import { commentRoutes } from './comments.js'
import { communityRoutes } from './community.js'
import { socialRoutes } from './social.js'
import { interactionsRoutes } from './interactions.js'
import { promotionRoutes, adminPromotionRoutes } from './promotions.js'
import { gamificationRoutes } from './gamification.js'
import { contentRoutes, adminContentRoutes } from './content.js'
import { learnRoutes, adminLearnRoutes } from './learn.js'
import { systemRoutes, adminSystemRoutes } from './system.js'
import { examRoutes } from './exam.js'
import { orderRoutes, adminOrderRoutes } from './order.js'
import { liveRoutes, adminLiveRoutes } from './live.js'
import { memberRoutes, adminMemberRoutes } from './member.js'
import { resourceRoutes, adminResourceRoutes } from './resource.js'
import { default as githubProjectRoutes } from './github-projects.js'
import { pointRoutes, adminPointRoutes } from './point.js'
import { usercenterRoutes } from './usercenter.js'
import { scheduleRoutes, adminScheduleRoutes } from './schedule.js'
import { statisticsRoutes, adminStatisticsRoutes } from './statistics.js'
import { messageRoutes, adminMessageRoutes } from './message.js'
import { topicRoutes, adminTopicRoutes } from './topic.js'
import { behaviorRoutes, adminBehaviorRoutes } from './behavior.js'
import { visitTrackingRoutes, adminVisitTrackingRoutes } from './visit-tracking.js'
import { ossRoutes, adminOssRoutes } from './oss.js'
import { settingRoutes, adminSettingRoutes } from './setting.js'
import { carouselPublicRoutes } from './carousel.js'
import { newsRoutes, adminNewsRoutes } from './news.js'
import { certificateRoutes, adminCertificateRoutes } from './certificate.js'
import { paymentGatewayRoutes, adminPaymentGatewayRoutes } from './payment-gateway.js'
import { refundAuditRoutes, adminRefundAuditRoutes } from './refund-audit.js'
import { financeRoutes } from './finance.js'
import { authExtendedRoutes } from './auth-extended.js'
import { authSsoRoutes } from './auth-sso.js'
import { vipRoutes, adminVipRoutes } from './vip.js'
import { agentsRoutes } from './agents.js'
import { agentsKanbanRoutes } from './agents-kanban.js'
import { oauthKeysRoutes } from './oauth-keys.js'
import { plazaRoutes } from './plaza.js'
import { cozeVariablesRoutes } from './coze-variables.js'
import { cozeRoutes } from './coze.js'
import { cozeEcosystemRoutes } from './coze-ecosystem.js'
import { cozeTestRoutes } from './coze-test.js'
import { cozeOauthRoutes } from './coze-oauth.js'
import { knowledgeRagRoutes } from './knowledge-rag.js'
import { crewRoutes } from './crew.js'
import { agenticServiceRoutes } from './agentic-service.js'
import { adminEduExtendedRoutes, adminCourseAuditRoutes } from './edu-extended.js'
import aiCallbackRoutes from './ai-callback.js'
import { adminSysRoutes, menuRoutersRoutes } from './admin-sys.js'
import { dictPublicRoutes } from './dict.js'
import { eduPublicRoutes } from './edu-public.js'
import { aiVendorRoutes, adminAiVendorRoutes, aiVendorV2Routes } from './ai-vendors.js'
import { aiAudioRoutes } from './ai-audio.js'
import { customerServiceRoutes, adminCustomerServiceRoutes } from './customer-service.js'
import { gdprRoutes } from './gdpr.js'
import { clawdbotRoutes } from './clawdbot.js'
import { tenantRoutes } from './tenant.js'
import canaryRoutes from './canary.js'
import tboxRoutes from './tbox.js'
import stockRoutes from './stock.js'
import agentExtendedRoutes from './agent-extended.js'
import eduExtendedRoutes from './edu-extended.js'
import systemExtendedRoutes, { adminCategoryDictionaryRoutes } from './system-extended.js'
import aiExtendedRoutes from './ai-extended.js'
import { mcpExtendedRoutes } from './mcp-extended.js'
import miscExtendedRoutes from './misc-extended.js'
import aiGenerationRoutes from './ai-generation.js'
import { aiChatStreamRoutes } from './ai-chat-stream.js'
import { llmModelsRoutes } from './llm-models.js'
// M-20 补建：14 个 API 模块路由
import toolsRoutes from './tools.js'
import rankingRoutes from './ranking.js'
import checkinRoutes, { adminCheckinRoutes } from './checkin.js'
import developerRoutes from './developer.js'
import appVersionRoutes from './app-version.js'
import monitorRoutes from './monitor.js'
import webhooksRoutes from './webhooks.js'
import webhookTriggerRoutes from './webhooks-trigger.js'
import packagesRoutes from './packages.js'
import fundRoutes from './fund.js'
import walletRoutes, { adminWalletRoutes } from './wallet.js'
import traderRoutes from './trader.js'
import sdksRoutes from './sdks.js'
import miniprogramRoutes from './miniprogram.js'
import productIdentityRoutes from './product-identity.js'
import groupsRoutes from './groups.js'
// M-23 补建：AI 定价引擎路由
import { pricingRoutes } from './pricing.js'
// M-22 补建：散点缺失路由
import { aiUserModelChatRoutes } from './ai-user-model-chat.js'
import { adminFaqRoutes } from './admin-faq.js'
// P3 深度层:AI 教育引擎(SRS 间隔复习)+ LangGraph 升级(interrupt HITL + streaming)
import { srsReviewRoutes } from './srs-review.js'
import { agentLanggraphRoutes } from './agent-langgraph.js'
import { adminZoneRoutes } from './admin-zone.js'
import { adminDemandSquareRoutes } from './admin-demand-square.js'
import { zhsCourseRoutes, adminZhsCourseRoutes } from './zhs-course.js'
import { zhsOrganizationRoutes, adminZhsOrganizationRoutes } from './zhs-organization.js'
import {
  userAgentFreeTimesRoutes,
  adminUserAgentFreeTimesRoutes,
} from './user-agent-free-times.js'
import { serviceCatalogRoutes, adminServiceCatalogRoutes } from './service-catalog.js'
import { shareContentRoutes } from './share-content.js'
// 历史项目缺失端点补齐（集中实现）
import { legacyCompletionRoutes } from './legacy-completion.js'
// R101 补建：WS live-chat 房间实时聊天（/ws/live-chat?roomId=xxx）
import { liveChatWsRoutes } from './ws/live-chat.js'
// R101 补建：课程/小节视频签名 URL 端点
import { learnVideoRoutes } from './learn/get-lesson-video.js'
// R101 补建：AdminContent 统一 CRUD（POST/PATCH/DELETE /api/admin/content/{type}/:id）
import { adminContentCrudRoutes } from './admin/content/crud.js'
// P0-3/P0-4 补建：AI 资讯聚合 + AI 教育模块
import aiFeedRoutes from './ai-feed.js'
import leaderboardRoutes from './leaderboard.js'
import aiEducationRoutes from './ai-education.js'
import { fileVersionRoutes } from './file-version.js'
import { callbackLogRoutes } from './callback-log.js'

// R65 补建：M-52 分片上传 + M-54 财务扩展 + M-56 支付扩展 + M-67 实名认证
import { chunkedUploadRoutes } from './chunked-upload.js'
import { financeExtendedRoutes } from './finance-extended.js'
import { paymentExtendedRoutes } from './payment-extended.js'
import { paymentRecurringRoutes } from './payment-recurring.js'
import { authIdentityRoutes } from './auth-identity.js'

// R67 补建：M-55 通知扩展 + M-66 教育平台 + M-72 支付状态 WS
import { educationPlatformRoutes } from './education-platform.js'

// R66 补建：M-44 remote + M-55 notification + M-57 content + M-60 org + M-61 AI图片编辑
import { remoteExtendedRoutes } from './remote-extended.js'
import { notificationExtendedRoutes } from './notification-extended.js'
import { contentExtendedRoutes } from './content-extended.js'
import { organizationRoutes } from './organization.js'
import { aiImageEditRoutes } from './ai-image-edit.js'

// R68 补建：M-21 开放平台 Feature Center 后端路由
import { featureCenterRoutes } from './feature-center.js'

// 插件市场后端路由(2026-07-22 立,复用 user_preferences 表,零迁移)
import { pluginsRoutes } from './plugins.js'

// AI 自动控制路由(2026-07-22 立,跨端:ai-service ↔ api ↔ extension/desktop)
import { agentControlRoutes } from './agent-control.js'

// 浏览器降级路由(2026-07-22 立,P1 WorkPanel iframe 降级:截图 + 探测)
import { browserRoutes } from './browser.js'
// 统一记忆读写路由(P0-3,cli/ai-service/api 三端记忆同步中枢)
import { memoryRoutes } from './memory.js'
// Skill 持久化路由(P0-2,管理自进化生成的 skill)
import { skillsRoutes } from './skills.js'
// IM 平台 gateway 路由(P1-1,对标 Hermes Agent 25+ 平台 gateway:webhook 接收 + 出站发送 + 适配器配置)
import { imGatewayRoutes } from './im-gateway.js'

// R68 补建：M-64 ask 模块扩展端点
import { askExtendedRoutes } from './ask-extended.js'
// admin/asks 管理后台问答端点
import { adminAskRoutes } from './admin-asks.js'

// 死表激活：敏感词 / 协议 / 汇率 / 私信管理
import { adminSensitiveWordsRoutes } from './admin-sensitive-words.js'
import { agreementPublicRoutes, adminAgreementsRoutes } from './admin-agreements.js'
import { exchangeRatePublicRoutes, adminExchangeRateRoutes } from './admin-exchange-rate.js'
import { adminPrivateLettersRoutes } from './admin-private-letters.js'

// P0-3 补建：M-81 管理后台页面后端 API（菜单管理 + 需求审核 + 在线用户）
import { adminExtendedRoutes } from './admin-extended.js'
// M-85/M-87 补建：SRS 媒体服务器 + 远程设备任务管理
import { srsRoutes } from './srs.js'
import { remoteDeviceRoutes } from './remote-device.js'

// 前端页面后端路由补齐
import { aiWorldRoutes } from './ai-world.js'
import { biDashboardRoutes } from './bi-dashboard.js'
import { dramaRoutes } from './drama.js'
import { distributionRoutes } from './distribution.js'
// 用户级 LLM 平台配置（每用户独立 API Key + 模板 + 测试连通 + 拉取模型）
import { userLlmConfigRoutes } from './user-llm-configs.js'
// 用户级 LLM 平台配置 v2(2026-07-22 立,1:N provider-model,与 v1 并存)
import { userLlmConfigV2Routes } from './user-llm-configs-v2.js'
import { cliImportRoutes } from './cli-import.js'
// 自媒体 skill(公众号文章 + 口播稿,2026-07-20 新增)
import { selfMediaRoutes } from './self-media-routes.js'
// 多平台发布代理(账号/任务/历史/统计,代理到 ai-service,2026-07-20 新增)
import { publishRoutes } from './publish-routes.js'
import { adminGrayReleaseRoutes } from './admin-gray-release.js'
import { adminErrorDashboardRoutes } from './admin-error-dashboard.js'
import { adminApiPlatformRoutes } from './admin-api-platform.js'
// 前端管理端缺失路由补建（真实 CRUD + 空数据桩）
import { adminMissingRoutes } from './admin-missing-routes.js'
// 内容运营真实 CRUD（6 个端点，替代 admin-missing-routes 中的空桩）
import { adminContentOpsRoutes } from './admin-content-routes.js'
// 鉴权/教育/学习真实 CRUD（11 个端点，替代空桩）
import { adminAuthEduRoutes } from './admin-auth-edu-routes.js'
// 监控/统计路由（19 个真实聚合端点，替代空桩）
import { adminMonitoringRoutes } from './admin-monitoring-routes.js'
// 插件市场统计(2026-07-22 新增,热度/安装量/点击量监测)
import { adminPluginStatsRoutes } from './admin-plugin-stats.js'
// 商城路由（10 个端点，替代空桩）
import { adminShopRoutes } from './admin-shop-routes.js'
// 发票抬头路由（4 个端点，替代空桩）
import { adminInvoicesRoutes } from './admin-invoices.js'
// 前端用户端缺失路由补建（54 个路由：空数据桩）
import { missingUserRoutes } from './missing-user-routes.js'
import { miniappPublicFallbackRoutes } from './miniapp-public-fallback-routes.js'
import { publicSocketRoutes } from './public-socket.js'
// OpenClaw 控制台 8 面板后端端点（memory/skills/automation/channels/tools/gateway/sessions/stats）
import { openclawRoutes } from './openclaw-routes.js'
// 补建：文章列表 / 用户签到 / 教育课程作业评分证书 / 学习记录上传
import { articleRoutes } from './articles.js'
import { userCheckinRoutes } from './user.js'
import { eduSupplementaryRoutes } from './edu-supplementary-routes.js'
// 前端补建路由（按模块分组，原 stub 命名已废弃）
import { frontendAdminRoutes } from './admin-extended/index.js'
import { aiFrontendRoutes } from './ai-frontend-routes.js'
import { eduFrontendRoutes } from './edu-frontend-routes.js'
import { otherRoutes } from './other/index.js'

// 收款落地页(API 自包含 HTML,平台独占)
import { landingRoutes } from './landing.js'

// P1-2 补建：报表生成器（接线 excel/pdf 孤儿服务）
import { adminReportRoutes } from './report.js'

// 孤儿路由接线(2026-07-22 整合:5 个路由有完整 api-client 封装但 server.ts 漏挂载,前端调用 404)
import mailRoutes from './mail.js'
import wrongQuestionRoutes from './wrong-questions.js'
import examMarkingRoutes from './exam-marking.js'
import authCodeRoutes from './auth-codes.js'
import privateLetterRoutes from './private-letters.js'

// P2-2 补建：公告系统 CLI 专用端点（/api/cli/announcements/*）
import { announcementsRoutes } from './announcements.js'

// P3-2 补建：Telemetry 极简上报端点（/api/v1/telemetry/ingest）
import { telemetryRoutes } from './telemetry.js'

// P1-3 补建：推送服务（FCM + 个推 HTTP API，无 SDK 依赖）
import { pushRoutes, adminPushRoutes } from './push.js'

// P1-4 补建：文件转码服务（FFmpeg 子进程封装）
import { transcodeRoutes, adminTranscodeRoutes } from './transcode.js'

// P1-5 补建：迁移缺口补全（7 个后端缺失路由文件）
import { webrtcVoiceRoutes } from './webrtc-voice.js'
import { luyalaRoutes } from './ai-vendors/luyala.js'
import { outboundRoutes } from './outbound.js'
import { aiVideoComposeRoutes } from './ai-video-compose.js'
import { legacyLangchainRoutes } from './legacy-langchain.js'
import { rewardedVideoAdRoutes } from './rewarded-video-ad.js'
import { agentRuntimeRoutes } from './agent-runtime.js'

// R81 补建：D 盘 coze_zhs_py 代理类路由
import { n8nProxyRoutes } from './n8n-proxy.js'
import { tencentHunyuan3dRoutes } from './tencent-hunyuan-3d.js'

// P1-3/P1-4 补建：智能体分类字典缓存 + 分类同步 API（迁移自 coze_zhs_py/api/agent_category_cache_api.py + category_sync_api.py）
import { agentCategoriesCacheRoutes } from './agent-categories-cache.js'
import { categorySyncRoutes } from './category-sync.js'
// 对外公开 API(/v1/*,API Key 鉴权,2026-07-22 立)
import v1PublicRoutes from './v1-public.js'
// 对外公开 API — AI 核心类路由(/v1/*,2026-07-22 立,20 个 AI 核心端点:chat/embeddings/models/agent 高级执行)
import v1AiCoreRoutes from './v1-ai-core.js'
// 对外公开 API — 多模态类路由(/v1/*,2026-07-22 立,21 个端点:audio/images/videos/3d/generation)
import v1MultimodalRoutes from './v1-multimodal.js'
// 对外公开 API — 知识工具类路由(/v1/*,2026-07-22 立,57 个端点:knowledge/mcp/memory/messages/files/user/workflow)
import v1KnowledgeToolsRoutes from './v1-knowledge-tools.js'
// P3 深度层:Inline Diff Apply 后端入口(POST /api/v1/ai/apply-diff,2026-07-22 立)
import { aiApplyDiffRoutes } from './v1-apply-diff.js'
// P3 深度层:代码库语义搜索路由(POST /api/v1/codebase/search 等,2026-07-22 立)
import { codebaseSearchRoutes } from './v1-codebase-search.js'
// P3 深度层:DAP debug 代理路由(代理到 ai-service /api/v1/debug/*,2026-07-22 立)
import { debugRoutes } from './debug.js'

// P3 深度层 Wave 11:6 大对标能力(2026-07-22 立,对标 Codex/Trae/Qoder)
// 终端集成(对标 Codex/OpenCode 内置终端,REST CRUD + WebSocket 双向流 + 进程退出清理)
import { terminalRoutes } from './terminal.js'
import { wsTerminal } from '../plugins/terminal-ws.js'
import terminalCleanup from '../plugins/terminal-cleanup.js'
// Rules 引擎(对标 Trae Rules,文件存储 .trae-cn/rules/*.md + 热加载 + 4 种匹配)
import { rulesRoutes } from './rules.js'
// Hook 服务(对标 Trae Hooks,事件总线 + JSONLogic 条件 + 4 执行器)
import hooksRoutes from './hooks.js'
// 多通道消息总线(Wave 3 W3-2,飞书/钉钉/TG/Slack/Discord/微信 统一消息总线)
import { messageBusRoutes } from './message-bus.js'
// Plan/Spec 模式(对标 Trae Plan/Spec,spec 生成 + 模板)
import { specRoutes } from './spec.js'
// Context Engineering(对标 Qoder,多维 @ 提及 file/database/symbol/folder/web)
import { contextMentionRoutes } from './context-mentions.js'
// Subagent 派单 UI(对标 Trae Subagent,落地 AGENTS.md §11 派单格式)
import { subagentDispatchRoutes } from './subagent-dispatch.js'
// 跨支柱编排中枢(2026-07-23 立,6 支柱协同 + LLM 预算 + 统一遥测)
import { orchestrationRoutes } from './orchestration.js'

export function registerRoutes(server: FastifyInstance) {
  server.register(healthRoutes, { prefix: '/api' })
  server.register(authRoutes, { prefix: '/api/auth' })
  server.register(usersRoutes, { prefix: '/api/users' })
  server.register(workspaceRoutes, { prefix: '/api/workspace' })
  // Workspace AI 能力：swarm/subagents/agent_loop/sandbox/computer_use/codebase_index/permissions 等 15 个子模块
  server.register(workspaceAiRoutes, { prefix: '/api/workspace' })
  server.register(workspacePermissionRoutes, { prefix: '/api/workspace' })
  // 文件管理增强 API：/api/files/*（/api/tags 已迁至 socialRoutes）
  server.register(fileRoutes, { prefix: '/api' })
  server.register(adminRoutes, { prefix: '/api/admin' })
  server.register(i18nDashboardRoutes, { prefix: '/api/admin' })
  server.register(notificationRoutes, { prefix: '/api' })
  server.register(billingRoutes, { prefix: '/api' })
  server.register(searchRoutes, { prefix: '/api' })
  server.register(auditRoutes, { prefix: '/api/admin' })
  server.register(teamRoutes, { prefix: '/api/teams' })
  server.register(chatRoutes, { prefix: '/api/chat' })
  // Chat 多模型直连:deepseek/deepseek_ws/kling/multi/qwen/qwen_omni/zhipu/history/coze
  server.register(chatModelRoutes, { prefix: '/api/chat' })
  // 用户自定义 AI 对话框技能(2026-07-21 新增,Skill 库统一面板支撑):GET/POST/PATCH/DELETE /api/chat/skills
  server.register(chatSkillsRoutes, { prefix: '/api/chat/skills' })
  // RBAC: /api/roles /api/permissions /api/users/:id/roles /api/admin/rbac/check
  server.register(rbacRoutes, { prefix: '/api' })
  server.register(workflowRoutes, { prefix: '/api' })
  // 评论与反馈：/api/comments/* /api/feedbacks/* /api/admin/feedbacks/*
  server.register(commentRoutes, { prefix: '/api' })
  // 社区圈子与问答：/api/circles/* /api/asks/*
  server.register(communityRoutes, { prefix: '/api' })
  // 社交关系：/api/follows /api/favorites /api/subscriptions /api/tags
  server.register(socialRoutes, { prefix: '/api' })
  // 互动统一入口：/api/interactions/like /comment /follow(复用 comments + social query)
  server.register(interactionsRoutes, { prefix: '/api/interactions' })
  // 邀请码 / 活动 / 优惠券：/api/invitations /api/activities /api/coupons + /api/admin/activities /api/admin/coupons
  server.register(promotionRoutes, { prefix: '/api' })
  server.register(adminPromotionRoutes, { prefix: '/api/admin' })
  // 公告 / 帮助 / 文档：/api/announcements /api/help/* /api/docs + /api/admin/announcements /api/admin/help/articles /api/admin/docs
  server.register(contentRoutes, { prefix: '/api' })
  server.register(adminContentRoutes, { prefix: '/api/admin' })
  // 学习模块：/api/learn/* + /api/admin/learn/*
  server.register(learnRoutes, { prefix: '/api' })
  server.register(adminLearnRoutes, { prefix: '/api/admin' })
  // 积分 / 等级 / 签到：/api/points /api/sign-in /api/levels /api/leaderboard
  server.register(gamificationRoutes, { prefix: '/api' })
  // 系统配置 / 集成 / API 日志 / 系统事件：/api/configs + /api/admin/configs /api/admin/integrations /api/admin/logs /api/admin/events
  server.register(systemRoutes, { prefix: '/api' })
  server.register(adminSystemRoutes, { prefix: '/api/admin' })
  // 考试模块：/api/exam/papers /api/exam/records + /api/admin/exam/papers /api/admin/exam/questions
  server.register(examRoutes, { prefix: '/api' })
  // 教育订单：/api/orders/* + /api/admin/orders/*
  server.register(orderRoutes, { prefix: '/api' })
  server.register(adminOrderRoutes, { prefix: '/api/admin' })
  // 直播模块：/api/live/* + /api/admin/live/*
  server.register(liveRoutes, { prefix: '/api' })
  server.register(adminLiveRoutes, { prefix: '/api/admin' })
  // 会员模块：/api/members/* + /api/admin/members/*
  server.register(memberRoutes, { prefix: '/api' })
  server.register(adminMemberRoutes, { prefix: '/api/admin' })
  // 资源库：/api/resources/* + /api/admin/resources/*
  server.register(resourceRoutes, { prefix: '/api' })
  server.register(adminResourceRoutes, { prefix: '/api/admin' })
  // GitHub 开源项目库：/api/github-projects/*
  server.register(githubProjectRoutes, { prefix: '/api' })
  // 教育积分：/api/edu-points/* + /api/admin/edu-points/*
  server.register(pointRoutes, { prefix: '/api' })
  server.register(adminPointRoutes, { prefix: '/api/admin' })
  // 用户中心扩展：/api/admin/usercenter/*
  server.register(usercenterRoutes, { prefix: '/api/admin' })
  // 定时任务调度 + 浏览记录异步落库：/api/schedule/* + /api/admin/schedule/*
  server.register(scheduleRoutes, { prefix: '/api' })
  server.register(adminScheduleRoutes, { prefix: '/api/admin' })
  // 统计模块：/api/statistics/* + /api/admin/statistics/*
  server.register(statisticsRoutes, { prefix: '/api' })
  server.register(adminStatisticsRoutes, { prefix: '/api/admin' })
  // 站内消息：/api/messages/* + /api/admin/messages/*
  server.register(messageRoutes, { prefix: '/api' })
  server.register(adminMessageRoutes, { prefix: '/api/admin' })
  // 专题模块：/api/topics/* + /api/admin/topics/*
  server.register(topicRoutes, { prefix: '/api' })
  server.register(adminTopicRoutes, { prefix: '/api/admin' })
  // 行为追踪：/api/behavior/* + /api/admin/behavior/*
  server.register(behaviorRoutes, { prefix: '/api' })
  server.register(adminBehaviorRoutes, { prefix: '/api/admin' })
  // 访问追踪：/api/visit-tracking/* + /api/admin/visit-tracking/*
  server.register(visitTrackingRoutes, { prefix: '/api' })
  server.register(adminVisitTrackingRoutes, { prefix: '/api/admin' })
  // 对象存储：/api/oss/* + /api/admin/oss/*
  server.register(ossRoutes, { prefix: '/api' })
  server.register(adminOssRoutes, { prefix: '/api/admin' })
  // 教育设置：/api/edu-settings/* + /api/admin/edu-settings/*
  server.register(settingRoutes, { prefix: '/api' })
  server.register(adminSettingRoutes, { prefix: '/api/admin' })
  // 公开轮播图：/api/carousels（无需登录，仅返回 status=1）
  server.register(carouselPublicRoutes, { prefix: '/api' })
  // 资讯模块：/api/news/* + /api/admin/news/*
  server.register(newsRoutes, { prefix: '/api' })
  server.register(adminNewsRoutes, { prefix: '/api/admin' })
  // 证书模块：/api/certificates/* + /api/admin/certificates/*
  server.register(certificateRoutes, { prefix: '/api' })
  server.register(adminCertificateRoutes, { prefix: '/api/admin' })
  // 教育扩展模块：/api/admin/edu/notes /api/admin/edu/offline-records /api/admin/edu/uploaded-certs /api/admin/edu/uploaded-papers
  server.register(adminEduExtendedRoutes, { prefix: '/api' })
  // 系统管理后端(迁移自 admin_panel.py):/api/admin/menu /api/admin/logininfor /api/admin/notice /api/admin/job /api/admin/online /api/admin/dept /api/admin/post /api/admin/config /api/admin/dict
  server.register(adminSysRoutes, { prefix: '/api/admin' })
  server.register(menuRoutersRoutes, { prefix: '/api/admin/menu' })
  // 公开字典查询(登录用户可用,无需 admin):/api/dict/data/type/:dictType
  server.register(dictPublicRoutes, { prefix: '/api/dict' })
  // 代理 / 广场 / Coze 变量 / Agent 服务
  server.register(agentsRoutes, { prefix: '/api' })
  server.register(agentsKanbanRoutes, { prefix: '/api' })
  // OAuth 私钥管理(多租户 JWT/RS256 签名密钥轮转):/api/oauth-keys/generate|rotate|revoke|list|active
  server.register(oauthKeysRoutes, { prefix: '/api/oauth-keys' })
  server.register(plazaRoutes, { prefix: '/api/plaza' })
  server.register(cozeVariablesRoutes, { prefix: '/api/coze/variables' })
  // Coze 平台集成:apps/audio/chat-audio/conversations/datasets/files/review/templates/workflows/workspaces/bot
  server.register(cozeRoutes, { prefix: '/api/coze' })
  // Coze 生态全量接口(R74 审计 P2 补建):REST 风格 apps/datasets/audio/files 端点
  server.register(cozeEcosystemRoutes, { prefix: '/api/coze' })
  // Coze 平台连接性测试:/api/coze/test/pat /api-key /workflow/:id /bot/:id /knowledge/:id
  server.register(cozeTestRoutes, { prefix: '/api' })
  // Coze OAuth client (项目作为 Coze OAuth client 调用 Coze 平台):
  // /api/coze/oauth/authorize /token /refresh /jwt /config (4 模式: device/web/pkce/jwt)
  server.register(cozeOauthRoutes, { prefix: '/api/coze/oauth' })
  // 知识库 RAG:/api/knowledge/health /ingest /search /rag-context /docs /docs/:id /docs/:id/chunks /docs/:id (DELETE) /docs/batch-delete
  server.register(knowledgeRagRoutes, { prefix: '/api/knowledge' })
  // 多智能体 Crew: 13 端点 (会话/任务/消息/Runs流式/Artifacts) + AgentRegistry 5 角色
  server.register(crewRoutes, { prefix: '/api/crew' })
  server.register(agenticServiceRoutes, { prefix: '/api/agent' })

  // AI 回调端点(由 AI service 推理完成后 POST 调用,入队 aiCallback)
  server.register(aiCallbackRoutes)

  // 支付网关：微信/支付宝/基金/对账（R1 补完）
  server.register(paymentGatewayRoutes, { prefix: '/api' })
  server.register(adminPaymentGatewayRoutes, { prefix: '/api/admin' })
  // 收款落地页(无 prefix,直接 /landing)
  server.register(landingRoutes)
  // 退款审核管理：退款列表/审核/驳回/详情/统计
  server.register(refundAuditRoutes, { prefix: '/api' })
  server.register(adminRefundAuditRoutes, { prefix: '/api/admin' })
  // 财务模块：佣金/分销/Token/提现（R1 补完）
  server.register(financeRoutes, { prefix: '/api' })
  // 多登录扩展：密码/邮箱/用户名/OAuth2/Google/微信/企微/验证码/绑定/SK（R1 补完）
  server.register(authExtendedRoutes, { prefix: '/api' })
  // SSO 统一登录：code 生成/交换/统一登出/token 验证（跨子项目共享登录态）
  server.register(authSsoRoutes, { prefix: '/api/auth' })
  // VIP 会员：等级/购买/我的 + admin（R1 补完）
  server.register(vipRoutes, { prefix: '/api' })
  server.register(adminVipRoutes, { prefix: '/api/admin' })

  // 学员中心：我的课程/笔记/证书/报告/错题/线下记录/论文（R2 补完）
  server.register(eduPublicRoutes, { prefix: '/api' })

  // AI 厂商专属多模态：dashscope/doubao/gemini/suno/sora2/coze + 通用工具（R4 补完）
  server.register(aiVendorRoutes, { prefix: '/api/ai' })
  server.register(adminAiVendorRoutes, { prefix: '/api/admin/ai' })
  // AI 厂商 v2 路由：基于 R4 重构的 callVendor(ctx, reply) 新签名（dashscope/doubao/gemini 部分端点）
  // 与原 /api/ai/* 共存，前端可逐步迁移到 /api/ai/v2/*
  server.register(aiVendorV2Routes, { prefix: '/api/ai' })
  // AI audio 子模块：TTS/ASR/声纹/实时语音 WebSocket（R4 补完）
  server.register(aiAudioRoutes, { prefix: '/api/ai' })

  // 客服系统：工单 + 实时会话（工单流程：提交→分配→处理→评级→关闭）
  server.register(customerServiceRoutes, { prefix: '/api/customer-service' })
  server.register(adminCustomerServiceRoutes, { prefix: '/api/admin/customer-service' })

  // GDPR 数据擦除：/api/gdpr/export /api/gdpr/erase /api/gdpr/portability
  server.register(gdprRoutes, { prefix: '/api/gdpr' })

  // Clawdbot AI Bot 服务：/api/admin/clawdbot/*
  server.register(clawdbotRoutes, { prefix: '/api/admin' })

  // 多租户管理：/api/tenants CRUD + 成员管理 + 配额管理
  server.register(tenantRoutes, { prefix: '/api/tenants' })

  // Canary 阶段化门控部署：/api/canary/configs /api/canary/audit /api/canary/traffic
  server.register(canaryRoutes, { prefix: '/api/canary' })

  // TBox IoT 设备管理：设备注册/查询/指令下发/事件通知接收
  server.register(tboxRoutes, { prefix: '/api/tbox' })

  // Stock 股票分析：Token 余额/分析/历史记录（迁移自旧架构 stock_analyse_service）
  server.register(stockRoutes, { prefix: '/api/stock' })

  // 旧架构补建模块：Agent 扩展（need_task/upload/usedetail）
  server.register(agentExtendedRoutes, { prefix: '/api/agent-ext' })
  // 教育扩展（course_audit 课程审核）
  server.register(eduExtendedRoutes, { prefix: '/api/edu-ext' })
  // 管理员 course-audit 路由（前缀 /api/admin/course-audit）
  server.register(adminCourseAuditRoutes, { prefix: '/api/admin' })
  // 管理/系统扩展（category_dictionary/bot_sites/ws_admin/compat_routes）
  server.register(systemExtendedRoutes, { prefix: '/api/system-ext' })
  server.register(adminCategoryDictionaryRoutes, { prefix: '/api/admin' })
  // AI 扩展（capabilities/model_info/outbound_routes/video_routes/developer model_test）
  server.register(aiExtendedRoutes, { prefix: '/api/ai-ext' })
  // MCP 项目管理与集成扩展（projects/integrations）
  server.register(mcpExtendedRoutes, { prefix: '/api' })
  // 其他扩展（remote/user_agent_context/docs）
  server.register(miscExtendedRoutes, { prefix: '/api/misc-ext' })
  // AI 生成队列：enqueue/status/cancel/list/stats
  server.register(aiGenerationRoutes, { prefix: '/api' })

  // ===== M-20 补建：14 个 API 模块路由 =====
  // 用户端工具目录：/api/tools/*
  server.register(toolsRoutes, { prefix: '/api/tools' })
  // 排行榜系统：/api/ranking/*
  server.register(rankingRoutes, { prefix: '/api/ranking' })
  // 签到体系：/api/checkin/* + /api/admin/checkin/*
  server.register(checkinRoutes, { prefix: '/api/checkin' })
  server.register(adminCheckinRoutes, { prefix: '/api/admin/checkin' })
  // 开发者 API 密钥管理：/api/developer/*
  server.register(developerRoutes, { prefix: '/api/developer' })
  // 应用版本管理：/api/app-version/*
  server.register(appVersionRoutes, { prefix: '/api/app-version' })
  // 监控系统：/api/monitor/*
  server.register(monitorRoutes, { prefix: '/api/monitor' })
  // Webhook 管理：/api/developer/webhooks/*
  server.register(webhooksRoutes, { prefix: '/api/developer/webhooks' })
  // Webhook 触发器(Wave 3 W3-3):/api/webhooks/* — 外部系统 webhook 唤醒 agent
  server.register(webhookTriggerRoutes, { prefix: '/api/webhooks' })
  // 套餐管理：/api/packages/*
  server.register(packagesRoutes, { prefix: '/api/packages' })
  // 资金管理：/api/fund/*
  server.register(fundRoutes, { prefix: '/api/fund' })
  // 钱包管理：/api/wallet/*
  server.register(walletRoutes, { prefix: '/api/wallet' })
  // 钱包管理后台(统计聚合 + 全量流水审计 + 管理员余额调整)
  server.register(adminWalletRoutes, { prefix: '/api/admin/wallet' })
  // 交易员管理：/api/trader/*
  server.register(traderRoutes, { prefix: '/api/trader' })
  // SDK 管理：/api/sdks/*
  server.register(sdksRoutes, { prefix: '/api/sdks' })
  // 小程序后台管理：/api/miniprogram/*
  server.register(miniprogramRoutes, { prefix: '/api/miniprogram' })
  // 产品标识管理：/api/product-identity/*
  server.register(productIdentityRoutes, { prefix: '/api/product-identity' })
  // 用户组管理：/api/groups/*
  server.register(groupsRoutes, { prefix: '/api/groups' })

  // ===== M-23 补建：AI 定价引擎 =====
  // 定价管理：/api/pricing/*
  server.register(pricingRoutes, { prefix: '/api' })

  // ===== M-22 补建：散点缺失路由 =====
  // 用户自定义模型对话：/api/ai/user-model-chat/*
  server.register(aiUserModelChatRoutes, { prefix: '/api/ai' })
  // AI 对话 SSE 流式代理（小程序端）：/api/ai/chat/stream
  server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
  // LLM 模型列表代理：/api/llm/models（转发到 AI-service）
  server.register(llmModelsRoutes, { prefix: '/api/llm' })
  // FAQ 管理：/api/admin/faq/*
  server.register(adminFaqRoutes, { prefix: '/api/admin/faq' })
  // 区域/分区管理：/api/admin/zones/*
  server.register(adminZoneRoutes, { prefix: '/api/admin/zones' })
  // 需求广场管理：/api/admin/demand-square/*
  server.register(adminDemandSquareRoutes, { prefix: '/api/admin/demand-square' })

  // ZHS 课程模块 CRUD：/api/course/*（迁移自 ZHS_Server_java 历史项目）
  server.register(zhsCourseRoutes, { prefix: '/api/course' })
  server.register(adminZhsCourseRoutes, { prefix: '/api/admin/course' })
  // ZHS 组织机构管理：/api/organization/* + /api/admin/organization/*
  server.register(zhsOrganizationRoutes, { prefix: '/api/organization' })
  server.register(adminZhsOrganizationRoutes, { prefix: '/api/admin/organization' })
  // 智能体免费试用次数：/api/agent-free-times/* + /api/admin/agent-free-times/*
  server.register(userAgentFreeTimesRoutes, { prefix: '/api/agent-free-times' })
  server.register(adminUserAgentFreeTimesRoutes, { prefix: '/api/admin/agent-free-times' })
  // 服务注册发现：/api/service-catalog/* + /api/admin/service-catalog/*
  server.register(serviceCatalogRoutes, { prefix: '/api/service-catalog' })
  server.register(adminServiceCatalogRoutes, { prefix: '/api/admin/service-catalog' })

  // 分享内容 H5：/api/share/content/:code（迁移自 share-h5 历史项目）
  server.register(shareContentRoutes, { prefix: '/api/share' })

  // ===== 历史项目缺失端点补齐（集中实现）=====
  // 考试报名/收藏/学习统计/专题/直播订阅/问答/OSS/错题等散点端点
  server.register(legacyCompletionRoutes, { prefix: '/api/legacy' })

  // ===== R101 补建：WS live-chat + 视频签名 URL + AdminContent 统一 CRUD =====
  // WS live-chat:房间实时聊天,房间管理 + 历史消息(读 live_comment 表)
  server.register(liveChatWsRoutes)
  // 课程/小节视频签名 URL(HMAC-SHA256,默认 1 小时过期)
  server.register(learnVideoRoutes, { prefix: '/api/learn' })
  // AdminContent 统一 CRUD:补 desktop AdminContent 缺口的动态 {type} 端点
  server.register(adminContentCrudRoutes, { prefix: '/api/admin/content' })

  // ===== P0-3/P0-4 补建：AI 资讯聚合 + AI 教育模块 =====
  // AI 资讯聚合：/api/ai-feed/sources /items /trends /stats + collect/summarize/translate（管理）
  server.register(aiFeedRoutes, { prefix: '/api/ai-feed' })
  // 大模型排行榜(参考 arena.ai):/api/model-leaderboard?category=llm&subcategory=coding
  // 用 model-leaderboard 避免与 gamification 的 /api/leaderboard(积分排行榜)冲突
  server.register(leaderboardRoutes, { prefix: '/api' })
  // AI 教育模块：5 张表 CRUD（policy/teacher-certification/aigc-tool/k12-curriculum/university-course）
  server.register(aiEducationRoutes, { prefix: '/api/ai-education' })

  // 文件版本管理：版本创建/列表/详情/回滚/删除/对比
  server.register(fileVersionRoutes, { prefix: '/api' })
  // 通用回调日志：外呼/短信/支付回调记录 + 列表/详情/删除
  server.register(callbackLogRoutes, { prefix: '/api/callback-log' })

  // ===== R65 补建：M-52/M-54/M-56/M-67 =====
  // M-52: 分片上传（大文件上传核心功能）: init/upload/merge/cancel/status
  server.register(chunkedUploadRoutes, { prefix: '/api' })
  // M-54: 财务扩展（分销统计/Agent提现/管理员工具）
  server.register(financeExtendedRoutes, { prefix: '/api' })
  // M-56: 支付扩展（提现回调/同步返回/连续订阅）
  server.register(paymentExtendedRoutes, { prefix: '/api' })
  // 周期扣款（连续包月）:签约/解约/查询/webhook/定时扣款
  server.register(paymentRecurringRoutes, { prefix: '/api' })
  // M-67: 实名认证（提交/查询/列表/审核）
  server.register(authIdentityRoutes, { prefix: '/api' })

  // ===== R66 补建：M-44/M-55/M-57/M-60/M-61 =====
  // M-44: 远程设备/三方请求模块（12端点）
  server.register(remoteExtendedRoutes, { prefix: '/api' })
  // M-55: 通知渠道管理扩展（7端点）
  server.register(notificationExtendedRoutes, { prefix: '/api' })
  // M-57: 内容管理扩展（12端点）
  server.register(contentExtendedRoutes, { prefix: '/api' })
  // M-60: 组织管理（9端点）
  server.register(organizationRoutes, { prefix: '/api' })
  // M-61: AI图片编辑（8端点）
  server.register(aiImageEditRoutes, { prefix: '/api' })

  // ===== R68 补建：M-21 开放平台 Feature Center =====
  // M-21: Feature Center 后端路由（6端点）
  server.register(featureCenterRoutes, { prefix: '/api/feature-center' })

  // 插件市场后端路由(2026-07-22 立,4端点:GET /installed + POST/DELETE /:id/install + PATCH /:id/preferences)
  server.register(pluginsRoutes, { prefix: '/api/plugins' })

  // AI 自动控制路由(2026-07-22 立,4端点:POST /capability + POST /execute + POST /result + GET /status)
  server.register(agentControlRoutes, { prefix: '/api/agent-control' })

  // 浏览器降级路由(2026-07-22 立,P1 WorkPanel iframe 降级:POST /screenshot + POST /probe)
  server.register(browserRoutes, { prefix: '/api/browser' })

  // 统一记忆读写(2026-07-22 立,P0-3:GET/POST/DELETE /api/memory)
  server.register(memoryRoutes, { prefix: '/api' })
  // Skill 持久化(2026-07-22 立,P0-2:GET/POST /api/skills + GET/DELETE /api/skills/:name + POST /api/skills/sync)
  server.register(skillsRoutes, { prefix: '/api' })
  // IM 平台 gateway(2026-07-22 立,P1-1:POST /api/im-gateway/webhook/:platform + /send + GET/POST /api/im-gateway/adapters + GET /api/im-gateway/status)
  server.register(imGatewayRoutes, { prefix: '/api' })

  // ===== R68 补建：M-64 ask 模块扩展端点 =====
  // M-64: ask 扩展（12端点：回答编辑/删除+点赞+收藏+评论+分类CRUD+树+统计）
  server.register(askExtendedRoutes, { prefix: '/api' })
  // admin/asks 管理后台问答端点（5端点：列表/创建/编辑/审核/删除）
  server.register(adminAskRoutes, { prefix: '/api/admin' })

  // ===== R67 补建：M-66 教育平台 + M-72 支付状态 WS =====
  // M-66: 教育平台同步管理（6端点）
  server.register(educationPlatformRoutes, { prefix: '/api/education-platform' })
  server.register(educationPlatformRoutes, { prefix: '/api/admin/education-platform' })

  // ===== 死表激活：敏感词 / 协议 / 汇率 / 私信管理 =====
  // 敏感词管理：/api/admin/sensitive-words CRUD + 内容过滤
  server.register(adminSensitiveWordsRoutes, { prefix: '/api/admin' })
  // 协议管理：/api/agreements/current（公共）+ /api/admin/agreements CRUD
  server.register(agreementPublicRoutes, { prefix: '/api' })
  server.register(adminAgreementsRoutes, { prefix: '/api/admin' })
  // 汇率管理：/api/exchange-rates/rate + convert（公共）+ /api/admin/exchange-rates CRUD
  server.register(exchangeRatePublicRoutes, { prefix: '/api' })
  server.register(adminExchangeRateRoutes, { prefix: '/api/admin' })
  // 私信管理：/api/admin/private-letters 列表
  server.register(adminPrivateLettersRoutes, { prefix: '/api/admin' })

  // ===== 孤儿路由接线(2026-07-22 整合:5 个路由有完整 api-client 封装但 server.ts 漏挂载) =====
  // 邮件发送:/api/mail/send + /api/mail/send/html
  server.register(mailRoutes, { prefix: '/api/mail' })
  // 错题本:/api/wrong-questions CRUD
  server.register(wrongQuestionRoutes, { prefix: '/api/wrong-questions' })
  // 阅卷:/api/exam-marking POST
  server.register(examMarkingRoutes, { prefix: '/api/exam-marking' })
  // 验证码:/api/auth-codes GET + /check
  server.register(authCodeRoutes, { prefix: '/api/auth-codes' })
  // 私信:/api/private-letters CRUD(前端 sidebar 已有页面入口)
  server.register(privateLetterRoutes, { prefix: '/api/private-letters' })

  // ===== P0-3 补建：M-81 管理后台页面后端 API =====
  // 菜单管理 + 需求审核 + 在线用户
  server.register(adminExtendedRoutes, { prefix: '/api/admin' })

  // ===== M-85 补建：SRS 媒体服务器管理 =====
  // RTMP 推流 / WebRTC 拉流 / HLS / FLV 流管理
  server.register(srsRoutes, { prefix: '/api/srs' })

  // ===== M-87 补建：远程设备任务管理 =====
  // IoT 设备注册 + 任务下发 + 心跳 + 状态管理
  server.register(remoteDeviceRoutes, { prefix: '/api' })

  // ===== 前端页面后端路由补齐 =====
  server.register(aiWorldRoutes, { prefix: '/api' })
  server.register(biDashboardRoutes, { prefix: '/api/admin' })
  server.register(dramaRoutes, { prefix: '/api' })
  server.register(distributionRoutes, { prefix: '/api' })
  // 用户级 LLM 平台配置：模板/CRUD/测试/拉取模型（/api/user/llm-configs/*）
  server.register(userLlmConfigRoutes, { prefix: '/api/user' })
  // 用户级 LLM 配置中心 v2（/api/v2/user/llm-providers/* + llm-groups/*）
  // 1:N provider-model + group 数据模型，与 v1 路由并存，不破坏现有接口
  server.register(userLlmConfigV2Routes, { prefix: '/api/v2/user' })
  // CLI 配置导入(cc-switch / codex++ / Claude / Codex / Gemini / Hermes)
  // 端点:/api/user/cli-import/{sources,parse-file,parse-payload,commit,preview/:id,history}
  server.register(cliImportRoutes, { prefix: '/api/user' })
  // 自媒体 skill(公众号文章 + 口播稿,代理到 ai-service,2026-07-20 新增)
  server.register(selfMediaRoutes, { prefix: '/api' })
  // 多平台发布代理(账号/任务/历史/统计,代理到 ai-service,2026-07-20 新增)
  server.register(publishRoutes, { prefix: '/api' })
  server.register(adminGrayReleaseRoutes, { prefix: '/api/admin' })
  server.register(adminErrorDashboardRoutes, { prefix: '/api/admin' })
  server.register(adminApiPlatformRoutes, { prefix: '/api/admin' })

  // ===== 前端管理端缺失路由补建（75 个路由）=====
  // 24 条有表路由（真实 CRUD）+ 51 条无表路由（空数据桩）
  // 覆盖：内容运营 / 鉴权 / 教务 / 平台 / 监控 / 商城 等模块
  server.register(adminMissingRoutes, { prefix: '/api/admin' })
  server.register(adminContentOpsRoutes, { prefix: '/api/admin' })
  server.register(adminAuthEduRoutes, { prefix: '/api/admin' })
  server.register(adminMonitoringRoutes, { prefix: '/api/admin' })
  server.register(adminPluginStatsRoutes, { prefix: '/api/admin/plugins' })
  server.register(adminShopRoutes, { prefix: '/api/admin' })
  server.register(adminInvoicesRoutes, { prefix: '/api/admin' })

  // ===== 前端用户端缺失路由补建（54 个路由）=====
  // 全部空数据桩，覆盖：文章 / 内容生成 / 知识库 / 技能 / 学习记录 / MCP / OpenClaw
  // 代理类 / 用户设置 / AI 补充 / 开发者扩展 / 分销 / VIP 权益 / 优惠券 / 通知详情 / 消息详情
  server.register(missingUserRoutes, { prefix: '/api' })
  // 小程序端首页公开 fallback(未登录可访问,返回空数据,2026-07-22 立)
  server.register(miniappPublicFallbackRoutes, { prefix: '/api' })

  // public_socket 9 端点(迁移自 coze_zhs_py/api/public_socket.py:1-663,P0 补齐 2026-07-20)
  server.register(publicSocketRoutes, { prefix: '/api/admin' })

  // OpenClaw 控制台 8 面板后端端点
  server.register(openclawRoutes, { prefix: '/api' })

  // ===== 补桩：文章列表 / 用户签到 / 教育课程扩展 / 学习记录上传 =====
  server.register(articleRoutes, { prefix: '/api' })
  server.register(userCheckinRoutes, { prefix: '/api' })
  server.register(eduSupplementaryRoutes, { prefix: '/api' })

  // ===== 前端补建路由（按模块分组，兜底避免 404）=====
  server.register(frontendAdminRoutes, { prefix: '/api' })
  server.register(aiFrontendRoutes, { prefix: '/api' })
  server.register(eduFrontendRoutes, { prefix: '/api' })
  server.register(otherRoutes, { prefix: '/api' })

  // ===== P1-2 补建：报表生成器（接线 excel/pdf 孤儿服务）=====
  server.register(adminReportRoutes, { prefix: '/api/admin' })

  // ===== P2-2 补建：公告系统 CLI 专用端点（/api/cli/announcements/*）=====
  server.register(announcementsRoutes, { prefix: '/api' })

  // ===== P3-2 补建：Telemetry 极简上报端点（/api/v1/telemetry/*）=====
  server.register(telemetryRoutes, { prefix: '/api' })

  // ===== P1-3 补建：推送服务（FCM + 个推 HTTP API）=====
  server.register(pushRoutes, { prefix: '/api' })
  server.register(adminPushRoutes, { prefix: '/api/admin' })

  // ===== P1-4 补建：文件转码服务（FFmpeg 子进程封装）=====
  server.register(transcodeRoutes, { prefix: '/api' })
  server.register(adminTranscodeRoutes, { prefix: '/api/admin' })

  // ===== P1-5 补建：迁移缺口补全（7 个后端缺失路由文件）=====
  // WebRTC 语音通话信令:/api/webrtc-voice/session|offer|ice-candidate|end
  server.register(webrtcVoiceRoutes, { prefix: '/api/webrtc-voice' })
  // 路亚拉(luyala)视频/语音代理:/api/ai-vendors/luyala/video|voice|tasks/:id
  server.register(luyalaRoutes, { prefix: '/api/ai-vendors/luyala' })
  // 外呼业务编排:/api/outbound/campaign + start/stop/stats
  server.register(outboundRoutes, { prefix: '/api/outbound' })
  // 一键视频编排(脚本→素材→合成→字幕):/api/ai-video-compose + /:id + /:id/regenerate
  server.register(aiVideoComposeRoutes, { prefix: '/api/ai-video-compose' })
  // LangChain API 兼容路由(旧客户端兼容):/api/langchain/chat|agent|models
  server.register(legacyLangchainRoutes, { prefix: '/api/langchain' })
  // 激励视频广告回调:/api/rewarded-video-ad/notify|config
  server.register(rewardedVideoAdRoutes, { prefix: '/api/rewarded-video-ad' })

  // Agent Runtime:PermissionGuard 5 mode + SessionManager 集成(/api/agent-runtime/*)
  server.register(agentRuntimeRoutes, { prefix: '/api/agent-runtime' })

  // ===== R81 补建: D 盘 coze_zhs_py 代理类路由 =====
  // n8n 代理(D 盘 coze_zhs_py/api/n8n_proxy.py):workflows 透传 + addAgent 真实写库
  server.register(n8nProxyRoutes, { prefix: '/api' })
  // 腾讯混元 3D(D 盘 coze_zhs_py/api/tencent_hunyuan_3d.py):submit/query/job/admin + video_generation_tasks 落库
  server.register(tencentHunyuan3dRoutes, { prefix: '/api' })

  // ===== R83 补建: 路径别名 redirect (前端兼容) =====
  // 旧前端调用路径 → 308 Permanent Redirect → 新规范化路径
  // 守门脚本 check-api-migration-completeness.mjs [5/7] + [7/7] 要求 5 个 redirect
  // 1. /api/agents → /api/agents/list (修复 use-agent.ts:34 404)
  server.get('/api/agents', async (_req, reply) => reply.redirect('/api/agents/list', 308))
  // 2. /api/agent-withdrawal-detail → /api/agent-ext/withdrawal/list (旧路由名 → agent-extended.ts)
  server.get('/api/agent-withdrawal-detail', async (_req, reply) =>
    reply.redirect('/api/agent-ext/withdrawal/list', 308),
  )
  // 3. /api/ai-model-info → /api/llm/models (旧 LLM 模型信息路径 → llm-models.ts)
  server.get('/api/ai-model-info', async (_req, reply) => reply.redirect('/api/llm/models', 308))
  // 4. /api/customer-service/faqs → /api/v1/customer_service/faqs (旧客服 FAQ → frontend-stub-other-routes.ts:1749)
  server.get('/api/customer-service/faqs', async (_req, reply) =>
    reply.redirect('/api/v1/customer_service/faqs', 308),
  )
  // 5. /api/ai-capabilities → /api/ai-ext/capabilities (旧 AI 能力路径 → ai-extended.ts:151)
  server.get('/api/ai-capabilities', async (_req, reply) =>
    reply.redirect('/api/ai-ext/capabilities', 308),
  )

  // ===== P1-3/P1-4 补建: 智能体分类字典缓存 + 分类同步 API =====
  // 5 端点: GET / POST refresh / DELETE / GET :key / POST sync（绝对路径字面量注册，见 routes/agent-categories-cache.ts）
  server.register(agentCategoriesCacheRoutes)
  // 5 端点: POST pull / POST push / GET status / POST resolve / GET history（绝对路径字面量注册，见 routes/category-sync.ts）
  server.register(categorySyncRoutes)

  // 对外公开 API(/v1/*,API Key 鉴权,2026-07-22 立)
  server.register(v1PublicRoutes, { prefix: '/v1' })
  // 对外公开 API — AI 核心类路由(/v1/*,20 个端点:chat/embeddings/models/agent 高级执行)
  server.register(v1AiCoreRoutes, { prefix: '/v1' })
  // 对外公开 API — 多模态类路由(/v1/*,21 个端点:audio/images/videos/3d/generation)
  server.register(v1MultimodalRoutes, { prefix: '/v1' })
  // 对外公开 API — 知识工具类路由(/v1/*,57 个端点:knowledge/mcp/memory/messages/files/user/workflow)
  server.register(v1KnowledgeToolsRoutes, { prefix: '/v1' })
  // P3 深度层:Inline Diff Apply 后端入口(POST /api/v1/ai/apply-diff,2026-07-22 立)
  server.register(aiApplyDiffRoutes, { prefix: '/api' })
  // P3 深度层:代码库语义搜索(POST /api/v1/codebase/search 等,2026-07-22 立)
  server.register(codebaseSearchRoutes, { prefix: '/api/v1/codebase' })
  // P3 深度层:DAP debug 代理(10 端点:launch/attach/sessions CRUD/breakpoints/continue/step/stack/variables/eval,2026-07-22 立)
  server.register(debugRoutes, { prefix: '/api/debug' })

  // P3 深度层 Wave 11:6 大对标能力(2026-07-22 立,对标 Codex/Trae/Qoder)
  // 终端集成(REST CRUD + WebSocket 双向流 + 进程退出清理)
  server.register(terminalRoutes, { prefix: '/api' })
  server.register(wsTerminal)
  server.register(terminalCleanup)
  // Rules 引擎(CRUD + 测试,文件存储 .trae-cn/rules/*.md)
  server.register(rulesRoutes, { prefix: '/api' })
  // Hook 服务(CRUD + 测试 + 日志,事件总线 + 4 执行器 webhook/script/log/notify)
  server.register(hooksRoutes, { prefix: '/api' })
  // 多通道消息总线(Wave 3 W3-2,6 渠道统一发送 + webhook 接收)
  server.register(messageBusRoutes, { prefix: '/api' })
  // Plan/Spec 模式(spec 生成 + 模板,tree-sitter AST 反向生成 spec markdown)
  server.register(specRoutes, { prefix: '/api' })
  // Context Engineering(多维 @ 提及 file/database/symbol/folder/web + LRU 缓存)
  server.register(contextMentionRoutes, { prefix: '/api/context' })
  // Subagent 派单 UI(AGENTS.md §11 派单格式 + mesh 拓扑可视化)
  server.register(subagentDispatchRoutes, { prefix: '/api' })
  // 跨支柱编排中枢(2026-07-23 立,6 支柱协同 + LLM 预算 + 统一遥测)
  server.register(orchestrationRoutes, { prefix: '/api' })
  // P3 深度层:AI 教育引擎 SRS 间隔复习(SM-2 算法)+ LangGraph 升级(interrupt HITL + 5 模式 streaming + Time Travel)
  server.register(srsReviewRoutes, { prefix: '/api/srs-review' })
  server.register(agentLanggraphRoutes, { prefix: '/api/agent-langgraph' })
}
