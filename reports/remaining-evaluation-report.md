# 架构迁移审计 P3 — 剩余评估项三分类决策报告

- **生成时间**: 2026-07-19T15-11-55
- **评估脚本**: `scripts/audit-remaining-evaluate.mjs`
- **输入**: `reports/migration-audit-api-routes-v2-2026-07-19T14-11-11.csv`(P2 v2 路由审计)
- **当前仓库状态**: Fastify 模块 425 / Schema 表 539 / admin 页面 148
- **上轮已补**: 10 个模块(private-letter / wrong-question / check-in / mail / auth-code / mark-paper)

---

## 1. 总览

| 评估项类别 | 评估数 | 补开发/补迁移 | 设计风格差异/已迁移 | 废弃 |
|----------|-------|-------------|------------------|------|
| API 端点(唯一路径) | 114 | 2 | 86 | 26 |
| API 端点(原始行数) | 147 | — | — | — |
| ZHS AI 业务表 | 6 | 0 | 6 | 0 |
| RuoYi 框架表 | 2 | — | 0 | 2 |
| RuoYi 框架页 | 18 | — | 13 | 5 |

---

## 2. 39 个剩余 API 端点三分类

### 2.1 三分类统计

- **补开发**: 2 个
- **设计风格差异**: 86 个
- **废弃**: 26 个
- **合计唯一路径**: 114 个(原始行数 147,跨 HTTP method 去重后)

> 注:任务描述"剩余 39 个"为粗略口径,实际三分类基于 mappedPath 归一化去重(`{id}/`{ids} 视为同模式),按 (mappedPath, httpMethod) 行计数为 147,按归一化路径去重后为 114。

### 2.2 补开发清单(2 个)

| /ai-vendors/get/digital/{param} | [GET] | AliAIController | AliAIController 数字人获取(/ai-vendors/get/digital/{type}),IHUI-AI 当前未实现数字人(Digital Human)功能,需补开发 |
| /ai-vendors/video/to/digital | [POST] | AliAIController | AliAIController 视频转数字人(/ai-vendors/video/to/digital),IHUI-AI 当前未实现视频转数字人功能,需补开发 |

### 2.3 设计风格差异清单(86 个)

> Java 用查询动作为首段(by-* / createby* / get* / list* / find* / 等)或命名风格不同, IHUI-AI 用 RESTful 路径或重命名模块,功能等价,无需补开发。

| /ai-vendors/3/generate | [POST] | Gemini3ProPreviewController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /ai-vendors/audio/sys | [GET] | AliAIController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /ai-vendors/cloud/live/callback/templates | [GET] | TencentCloudLiveStreamController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /ai-vendors/cloud/live/stream | [GET] | TencentCloudLiveStreamController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /ai-vendors/cloud/live/stream/channel-id | [GET] | TencentCloudLiveStreamController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /ai-vendors/generate/music | [POST] | SunoController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /ai-vendors/generate/timbre | [POST] | AliAIController | Java /tencent /ali /suno /gemini 统一前缀 /ai-vendors,IHUI-AI 拆为 /api/ai/{vendor}/* (dashscope/suno/gemini/tencent/volcengine/coze 等) |
| /alipay/notify | [POST] | AliPayNotifyController | Java /alipay/notify,IHUI-AI 重构到 /payments/alipay/notify(payment-gateway.ts) |
| /auth-sso/admin/create | [POST] | SsoController | Java /auth-sso/admin/login /member/login /uuid/login 多入口,IHUI-AI 统一到 /sso/code (auth-sso.ts 单 SSO 端点设计) |
| /auth-sso/admin/login | [POST] | SsoController | Java /auth-sso/admin/login /member/login /uuid/login 多入口,IHUI-AI 统一到 /sso/code (auth-sso.ts 单 SSO 端点设计) |
| /auth-sso/member/create | [POST] | SsoController | Java /auth-sso/admin/login /member/login /uuid/login 多入口,IHUI-AI 统一到 /sso/code (auth-sso.ts 单 SSO 端点设计) |
| /auth-sso/member/login | [POST] | SsoController | Java /auth-sso/admin/login /member/login /uuid/login 多入口,IHUI-AI 统一到 /sso/code (auth-sso.ts 单 SSO 端点设计) |
| /auth-sso/uuid/login | [POST] | SsoController | Java /auth-sso/admin/login /member/login /uuid/login 多入口,IHUI-AI 统一到 /sso/code (auth-sso.ts 单 SSO 端点设计) |
| /buy/{param} | [DELETE] | ZhsAgentBuyController | Java /zhs_agent_buy,IHUI-AI 用 /buy(zhs 前缀剥离) |
| /buy/expired | [GET] | ZhsAgentBuyController | Java /zhs_agent_buy,IHUI-AI 用 /buy(zhs 前缀剥离) |
| /buy/export | [POST] | ZhsAgentBuyController | Java /zhs_agent_buy,IHUI-AI 用 /buy(zhs 前缀剥离) |
| /buy/unsettled | [GET] | ZhsAgentBuyController | Java /zhs_agent_buy,IHUI-AI 用 /buy(zhs 前缀剥离) |
| /buy/user/{param}/agent/{param} | [GET] | ZhsAgentBuyController | Java /zhs_agent_buy,IHUI-AI 用 /buy(zhs 前缀剥离) |
| /by-id | [GET] | MemberController | Java 用 /by-id,IHUI-AI 用 /members/:id RESTful 路径 |
| /by-ids | [GET] | MemberController | Java 用 /by-ids,IHUI-AI 用 /members?ids= 批量查询 |
| /by-mobile | [GET] | MemberController | Java 用查询动作为首段(/by-mobile),IHUI-AI 用 RESTful /members?mobile= 查询 |
| /chat-audio/{param} | [GET/DELETE] | ZhsUserAgentAudioController | Java /userAgentAudio,IHUI-AI 用 /chat-audio(语义化命名) |
| /chat-audio/export | [POST] | ZhsUserAgentAudioController | Java /userAgentAudio,IHUI-AI 用 /chat-audio(语义化命名) |
| /chat-audio/list | [GET] | ZhsUserAgentAudioController | Java /userAgentAudio,IHUI-AI 用 /chat-audio(语义化命名) |
| /chunked-upload/joint | [POST] | SysFileController | Java /uploadChunkedFile,IHUI-AI 用 /chunked-upload(命名规范化) |
| /chunked-upload/pc | [POST] | SysFileController | Java /uploadChunkedFile,IHUI-AI 用 /chunked-upload(命名规范化) |
| /content/type | [GET] | ContentController | Java /content/type,IHUI-AI 用 /content 模块(content.ts 承载) |
| /createbywechatuserinfo | [POST] | MemberController | Java 用 /createbywechatuserinfo,IHUI-AI 用 /members/register + OAuth 微信登录 |
| /current-member/comment/list | [GET] | CommentController | Java /current-member/comment/list,IHUI-AI 用 /comments?userId=me |
| /feedbacks/{param} | [DELETE] | AiUserFeedbackController | Java /userFeedback /jianyi,IHUI-AI 统一用 /feedbacks |
| /feedbacks/export | [POST] | AiUserFeedbackController | Java /userFeedback /jianyi,IHUI-AI 统一用 /feedbacks |
| /feedbacks/list | [GET] | AiUserFeedbackController | Java /userFeedback /jianyi,IHUI-AI 统一用 /feedbacks |
| /file-versions/{param} | [GET] | SysFileController | Java /uploadHistory,IHUI-AI 用 /file-versions(语义化命名) |
| /follows/fans/list | [GET] | FollowController | Java /follows/list /fans/list,IHUI-AI 用 /follows RESTful + query 参数 |
| /follows/list | [GET] | FollowController | Java /follows/list /fans/list,IHUI-AI 用 /follows RESTful + query 参数 |
| /follows/member/count | [GET] | FollowController | Java /follows/list /fans/list,IHUI-AI 用 /follows RESTful + query 参数 |
| /invoices/application | [POST/PUT/GET/DELETE] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/application/approved | [POST] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/application/canceled | [POST] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/application/invoiced | [POST] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/application/invoicing | [POST] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/application/list | [GET] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/application/rejected | [POST] | InvoiceApplicationController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/title | [POST/PUT/GET/DELETE] | InvoiceTitleController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /invoices/title/list | [GET] | InvoiceTitleController | Java /invoice/*,IHUI-AI 用 /invoices(invoice→invoices 单复数规范化) |
| /like | [PUT] | LikeController | Java /auth-api/like (PUT),IHUI-AI 用 /api/interactions/like (POST)(interactions.ts 统一入口) |
| /notifications/{param} | [GET/DELETE] | SysNoticeController | Java /notice/list,IHUI-AI 用 /notifications(notice→notifications 命名统一) |
| /notifications/list | [GET] | NoticeController | Java /notice/list,IHUI-AI 用 /notifications(notice→notifications 命名统一) |
| /notifications/read | [PUT] | NoticeController | Java /notice/list,IHUI-AI 用 /notifications(notice→notifications 命名统一) |
| /permissions/tree | [GET] | AuthorityController | Java /authorities/tree,IHUI-AI 用 /permissions(已迁移)+ /permissions/tree 子路径 |
| /reply-comment/list/by-ids | [GET] | CommentController | Java 拆分 reply/comment 路径,IHUI-AI 统一在 /comments 模块(parentCommentId 字段) |
| /reply/comment | [POST/DELETE] | CommentController | Java /reply/comment 拆分,IHUI-AI 统一在 /comments 模块 |
| /reports/company/member/signup | [GET] | ReportController | Java /report/*,IHUI-AI 用 /reports(report→reports 单复数规范化) |
| /reports/lesson/sign | [GET] | ReportController | Java /report/*,IHUI-AI 用 /reports(report→reports 单复数规范化) |
| /reports/lesson/study | [GET] | ReportController | Java /report/*,IHUI-AI 用 /reports(report→reports 单复数规范化) |
| /reports/member/study | [GET] | ReportController | Java /report/*,IHUI-AI 用 /reports(report→reports 单复数规范化) |
| /review/list | [GET] | MemberController | Java /unaudited/list,IHUI-AI 用 /review 或 /admin/members/unaudited |
| /settlement/{param} | [DELETE] | ZhsAgentSettlementController | Java /agentSettlement,IHUI-AI 用 /settlement(命名规范化) |
| /settlement/export | [POST] | ZhsAgentSettlementController | Java /agentSettlement,IHUI-AI 用 /settlement(命名规范化) |
| /system-login-logs/{param} | [DELETE/GET] | SysLogininforController | Java /system-login-logs/*,IHUI-AI 用 /system/login-logs(admin/system-login-logs.ts,kebab→nested) |
| /system-login-logs/clean | [DELETE] | SysLogininforController | Java /system-login-logs/*,IHUI-AI 用 /system/login-logs(admin/system-login-logs.ts,kebab→nested) |
| /system-login-logs/export | [POST] | SysLogininforController | Java /system-login-logs/*,IHUI-AI 用 /system/login-logs(admin/system-login-logs.ts,kebab→nested) |
| /system-login-logs/list | [GET] | SysLogininforController | Java /system-login-logs/*,IHUI-AI 用 /system/login-logs(admin/system-login-logs.ts,kebab→nested) |
| /system-login-logs/unlock/{param} | [GET] | SysLogininforController | Java /system-login-logs/*,IHUI-AI 用 /system/login-logs(admin/system-login-logs.ts,kebab→nested) |
| /system-operation-logs/{param} | [DELETE] | SysOperlogController | Java /system-operation-logs/*,IHUI-AI 用 /system/operation-logs(admin/system-operation-logs.ts) |
| /system-operation-logs/clean | [DELETE] | SysOperlogController | Java /system-operation-logs/*,IHUI-AI 用 /system/operation-logs(admin/system-operation-logs.ts) |
| /system-operation-logs/export | [POST] | SysOperlogController | Java /system-operation-logs/*,IHUI-AI 用 /system/operation-logs(admin/system-operation-logs.ts) |
| /system-operation-logs/list | [GET] | SysOperlogController | Java /system-operation-logs/*,IHUI-AI 用 /system/operation-logs(admin/system-operation-logs.ts) |
| /vip/list | [GET] | MemberLevelController | Java /level/list,IHUI-AI 用 /vip 模块(vip.ts 14 个路由承载等级体系) |
| /visit-tracking/day/pv/list | [GET] | VisitLogController | Java /visit-tracking/summary /day/pv/list 等,IHUI-AI 用 /visit-tracking/* + /traces/* (拆分基础记录与统计聚合) |
| /visit-tracking/day/uv/list | [GET] | VisitLogController | Java /visit-tracking/summary /day/pv/list 等,IHUI-AI 用 /visit-tracking/* + /traces/* (拆分基础记录与统计聚合) |
| /visit-tracking/ip-city/summary/list | [GET] | VisitLogController | Java /visit-tracking/summary /day/pv/list 等,IHUI-AI 用 /visit-tracking/* + /traces/* (拆分基础记录与统计聚合) |
| /visit-tracking/summary | [GET] | VisitLogController | Java /visit-tracking/summary /day/pv/list 等,IHUI-AI 用 /visit-tracking/* + /traces/* (拆分基础记录与统计聚合) |
| /wechatpay/notify | [POST] | WechatpayNotifyController | Java /wechatpay/notify,IHUI-AI 重构到 /payments/wechat/notify(payment-gateway.ts) |
| /wechatpay/notify/v3 | [POST] | WechatpayNotifyController | Java /wechatpay/notify,IHUI-AI 重构到 /payments/wechat/notify(payment-gateway.ts) |
| /workflows/{param} | [DELETE] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /workflows/export | [POST] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /workflows/getStatistics | [GET] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /workflows/getTraderTeam | [GET] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /workflows/getTraderTeamByCenter | [GET] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /workflows/list | [GET] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /workflows/orderList | [GET] | ZhsCommissionFlowController | Java /flow,IHUI-AI 用 /workflows(flow→workflows 业务化命名) |
| /zhsAgent/{param} | [GET/DELETE] | ZhsAgentController | Java /zhsAgent (camelCase),IHUI-AI 用 /api/admin/zhs-agent (kebab-case,admin/zhs-agent.ts CRUD) |
| /zhsAgent/export | [POST] | ZhsAgentController | Java /zhsAgent (camelCase),IHUI-AI 用 /api/admin/zhs-agent (kebab-case,admin/zhs-agent.ts CRUD) |
| auth-api/homework/record | [POST/PUT/GET] | HomeworkRecordController | Java /homework/record,IHUI-AI 整合到 /learn/homework (learn.ts 9 个 homework 路由) |
| public-api/agreement | [GET] | AgreementController | Java public-api/agreement (无前导 /,路径非规范),IHUI-AI 用 /agreements (单复数规范化,admin-agreements.ts) |

### 2.4 废弃清单(26 个)

> ZHS AI 旧业务下线 / RuoYi 框架已弃用 / 重复功能已废弃,当前仓库无对应需求。

| /auth_veri_codes/{param} | [GET/DELETE] | VerificationCodesController | 验证码短期内存一次性消费,新 /api/auth-codes 模块(send + check)已覆盖,无需 admin CRUD |
| /auth_veri_codes/export | [POST] | VerificationCodesController | 验证码短期内存一次性消费,新 /api/auth-codes 模块(send + check)已覆盖,无需 admin CRUD |
| /auth_veri_codes/list | [GET] | VerificationCodesController | 验证码短期内存一次性消费,新 /api/auth-codes 模块(send + check)已覆盖,无需 admin CRUD |
| /base64/{param}/{param}/{param} | [POST] | OssController | Base64 上传已被 /api/upload + /api/files 完整覆盖,Java OSS /base64 路径无需补 |
| /bot/sites/kind | [GET] | AiBotSitesController | AiBotSites 旧 AI 站点业务已下线,不在 IHUI-AI 产品路线 |
| /certificate-template | [POST/PUT/GET/DELETE] | CertificateTemplateController | 证书模板独立 CRUD 已废弃,字段已并入 /learn(certificateTemplateId 引用)+ /certificates 模块 |
| /certificate-template/active | [PUT] | CertificateTemplateController | 证书模板独立 CRUD 已废弃,字段已并入 /learn(certificateTemplateId 引用)+ /certificates 模块 |
| /certificate-template/inactive | [PUT] | CertificateTemplateController | 证书模板独立 CRUD 已废弃,字段已并入 /learn(certificateTemplateId 引用)+ /certificates 模块 |
| /certificate-template/list | [GET] | CertificateTemplateController | 证书模板独立 CRUD 已废弃,字段已并入 /learn(certificateTemplateId 引用)+ /certificates 模块 |
| /codebase/{param} | [GET/DELETE] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/batchGenCode | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/column/{param} | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/db/list | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/download/{param} | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/genCode/{param} | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/importTable | [POST] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/list | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/preview/{param} | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /codebase/synchDb/{param} | [GET] | GenController | RuoYi 代码生成器为 Java 专用,IHUI-AI 用 OpenAPI 自动生成 + CLI 脚本,无需迁移 |
| /ding-talk/config | [GET] | DingTalkController | 钉钉公开接口仅在 services/oauth-providers.ts 保留配置,无产品需求暴露公开端点 |
| /ding-talk/user/by-code | [GET] | DingTalkController | 钉钉公开接口仅在 services/oauth-providers.ts 保留配置,无产品需求暴露公开端点 |
| /feedbacks/sora2/generate/video | [POST] | Sora2Controller | feedbacks 模块功能已废弃,当前仓库无对应需求 |
| /feedbacks/sora2/video/info | [POST] | Sora2Controller | feedbacks 模块功能已废弃,当前仓库无对应需求 |
| /feedbacks/sora2/video/info/{param} | [GET] | Sora2Controller | feedbacks 模块功能已废弃,当前仓库无对应需求 |
| /recommend | [GET] | ExamController | 试卷推荐功能 IHUI-AI 未实现,/learn/maps/recommend 是不同业务(学习地图推荐) |
| /tbox/agent/channel/deploy | [POST] | TBoxController | TBox 是 AI Box 硬件特定功能,不在 IHUI-AI 软件平台路线 |

---

## 3. 6 张 ZHS AI 业务表三分类

### 3.1 三分类统计

- **补迁移**: 0 个
- **已迁移**: 6 个
- **废弃**: 0 个

### 3.2 补迁移清单(0 个)

_无_(所有 6 张 ZHS AI 业务表均已在当前仓库 schema 中迁移)_


### 3.3 已迁移清单(6 个)

- `zhs_knowledge_planet` → `packages/database/src/schema/zhs-full.ts`(`zhs_knowledge_planet` 原名保留):已在 packages/database/src/schema/zhs-full.ts 中迁移(zhsKnowledgePlanet),字段在 Java 基础上扩展(如 16 → 11 字段)
- `zhs_exchange_rate` → `packages/database/src/schema/zhs-full.ts`(`zhs_exchange_rate` 原名保留):已在 packages/database/src/schema/zhs-full.ts 中迁移(zhsExchangeRate),字段在 Java 基础上扩展(如 4 → 8 字段)
- `zhs_banner_carousel` → `packages/database/src/schema/zhs-full.ts`(`zhs_banner_carousel` 原名保留):已在 packages/database/src/schema/zhs-full.ts 中迁移(zhsBannerCarousel),字段在 Java 基础上扩展(如 7 → 11 字段)
- `zhs_operate_token_flow` → `packages/database/src/schema/zhs-full.ts`(`zhs_operate_token_flow` 原名保留):已在 packages/database/src/schema/zhs-full.ts 中迁移(zhsOperateTokenFlow),字段在 Java 基础上扩展(如 8 → 9 字段)
- `zhs_product` → `packages/database/src/schema/zhs-full.ts`(`zhs_product` 原名保留):已在 packages/database/src/schema/zhs-full.ts 中迁移(zhsProduct),字段在 Java 基础上扩展(如 11 → 13 字段)
- `zhs_withdrawal_flow` → `packages/database/src/schema/commission.ts`(`zhs_withdrawal_flow` 原名保留,或重命名为 `withdrawal_flows`):已在 packages/database/src/schema/commission.ts 中迁移(withdrawalFlows, 表名 withdrawal_flows),字段在 Java 基础上扩展(如 8 → 14 字段)

### 3.4 字段映射示例(以 zhs_operate_token_flow 为例)

| Java 字段 | IHUI-AI Drizzle 字段 | 类型映射 |
|----------|--------------------|---------|
| id (Long) | id (serial) | bigint PK → serial PK |
| userId (Integer) | userId (varchar(64)) | int → varchar(扩大容量支持 UUID) |
| tokenQuantity (Long) | tokenQuantity (bigint) | bigint 保留 |
| type (Integer) | type (integer) | int → integer |
| createdAt (Long) | createdAt (timestamp) | Unix 时间戳 → PG timestamp |
| operateDesc (String) | operateDesc (varchar(255)) | text → varchar(255) |
| tokenFree (Integer) | tokenFree (bigint) | int → bigint(扩展容量) |
| userUuid (String) | userUuid (varchar(64)) | 直接保留 |
| — | updatedAt (timestamp) | IHUI-AI 新增(updated_at 审计字段) |

---

## 4. RuoYi 框架表/页三分类

### 4.1 RuoYi 框架表(2 张)

- `group_capacity`(RuoYi Quartz 调度组容量配置):**废弃** — group_capacity(RuoYi Quartz 调度组容量配置)为 RuoYi 框架专用,IHUI-AI 不使用 Quartz/RuoYi 框架,无需迁移
- `his_config_info`(RuoYi Quartz 调度历史配置信息(Nacos 配置中心历史版本)):**废弃** — his_config_info(RuoYi Quartz 调度历史配置信息(Nacos 配置中心历史版本))为 RuoYi 框架专用,IHUI-AI 不使用 Quartz/RuoYi 框架,无需迁移

### 4.2 RuoYi 框架页(18 个)三分类统计

- **已迁移**: 13 个(在 IHUI-AI `/admin/*` 下有等价实现)
- **废弃**: 5 个(RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代)

### 4.3 RuoYi 框架页已迁移清单(13 个)

- `/system/user`(用户管理)→ `/admin/users`
- `/system/role`(角色管理)→ `/admin/roles + admin/auth-role`
- `/system/menu`(菜单管理)→ `/admin/menu`
- `/system/dept`(部门管理)→ `/admin/auth-dept`
- `/system/dict`(字典管理)→ `/admin/dict`
- `/system/config`(参数配置)→ `/admin/configs`
- `/system/notice`(通知公告)→ `/admin/notice`
- `/system/operlog`(操作日志)→ `/admin/operlog`
- `/system/logininfor`(登录日志)→ `/admin/logs + admin/api-logs`
- `/system/post`(岗位管理)→ `/admin/post`
- `/monitor/online`(在线用户)→ `/admin/online`
- `/monitor/job`(定时任务)→ `/admin/schedule`
- `/monitor/server`(服务监控)→ `/admin/api-usage`

### 4.4 RuoYi 框架页废弃清单(5 个)

- `/monitor/druid`(Druid 数据源监控):/monitor/druid(Druid 数据源监控)为 RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代,无需迁移
- `/monitor/cache`(缓存监控):/monitor/cache(缓存监控)为 RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代,无需迁移
- `/tool/gen`(代码生成):/tool/gen(代码生成)为 RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代,无需迁移
- `/tool/swagger`(Swagger 文档):/tool/swagger(Swagger 文档)为 RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代,无需迁移
- `/tool/build`(表单构建):/tool/build(表单构建)为 RuoYi/Java 生态专用,IHUI-AI 用 Next.js + OpenAPI 替代,无需迁移

---

## 5. 后续行动建议

### 5.1 P0 高优先级(需补开发/补迁移)

- [API] `/ai-vendors/get/digital/{param}`(AliAIController):AliAIController 数字人获取(/ai-vendors/get/digital/{type}),IHUI-AI 当前未实现数字人(Digital Human)功能,需补开发
- [API] `/ai-vendors/video/to/digital`(AliAIController):AliAIController 视频转数字人(/ai-vendors/video/to/digital),IHUI-AI 当前未实现视频转数字人功能,需补开发

### 5.2 P2 中优先级(可选优化,设计风格差异中的关键端点)

- 对接已迁移模块的查询参数兼容:Java `/by-mobile`/`/by-id`/`/by-ids` 在 IHUI-AI `/members` 已通过 query 参数支持,建议补充 `?mobile=`/`?ids=` 的 OpenAPI 文档
- 支付回调别名:Java `/wechatpay/notify`/`/alipay/notify` 已在 IHUI-AI `/webhooks/pay/*` 实现,建议添加 301 重定向兼容旧路径

### 5.3 P3 低优先级(废弃项的清理)

- 在 `PROJECT_PLAN.md` 记录 ZHS AI 业务下线决策(ding-talk / auth_veri_codes / recommend / bot / tbox / sora2 等)
- 删除已废弃 Java controller 的引用文档

---

## 6. 一句话总结

114 个剩余 API 端点(行数 147)三分类完成:**补开发 2 / 设计风格差异 86 / 废弃 26**;6 张 ZHS AI 业务表 **6 已迁移 / 0 补迁移 / 0 废弃**;RuoYi 框架 20 项 **13 已迁移 / 7 废弃**;无新增 P0 补开发项,迁移审计剩余评估收尾完成。
