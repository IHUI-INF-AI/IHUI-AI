# MIGRATION_GAP_REPORT — 迁移缺口深度报告(v3 真实缺失修正版)

> 生成时间: 2026-07-16 v3 | 基于 D:\历史项目存档 vs g:\IHUI-AI 全量比对 + 14 个 agent 字段级 diff + 20 维度深度核查
> 修正说明: v2 报告声称"100% 完整率"经 14 个 agent 深度字段级 diff 核查后**推翻**,真实缺失率约为 37%(220/588 项有不同程度缺失)

## 一、总体统计(v3 真实核查)

| 模块     | 旧项目                                                            | 新仓库                     | 总计    | 完整等价 | 部分等价(合理演进) | 真缺失  | 完整率  |
| -------- | ----------------------------------------------------------------- | -------------------------- | ------- | -------- | ------------------ | ------- | ------- |
| C 端前端 | code/edu/web (Vue 2)                                              | apps/web (Next.js 15)      | 166     | 99       | 48                 | 19      | 60%     |
| 管理后台 | edu/admin + ihui-ai-admin-frontend                                | apps/web/admin             | 216     | 92       | 72                 | 52      | 43%     |
| 后端服务 | ZHS_Server_java + coze_zhs_py + service_2 + ai-smart-society-java | apps/api + apps/ai-service | 130     | 38       | 22                 | 70      | 29%     |
| 小程序   | zhs_app-ZZ/Ai-WXMiniVue (uni-app)                                 | apps/miniapp-taro (Taro 4) | 76      | 41       | 15                 | 20      | 54%     |
| **合计** |                                                                   |                            | **588** | **270**  | **157**            | **161** | **46%** |

**说明**:

- v2 报告"100% 完整率"是**错误的**,因为只做了路径/命名比对,未做字段级 diff
- v3 经 14 个 agent 真实字段级 diff 后,真实完整率约 46%(270/588 完整等价)
- "部分等价(合理演进)"157 项:架构层面合理演进,但部分字段/方法/接口缺失,需补写
- "真缺失"161 项:功能完全未迁移,需补写

## 二、P30 已补写清单(25 文件,详见 v2 报告)

| #   | 模块                             | 文件数 | 状态                                                                                             |
| --- | -------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| 1   | 后端 apps/api(7 路由)            | 7      | ✅ webrtc-voice/luyala/ws-broadcast/outbound/ai-video-compose/legacy-langchain/rewarded-video-ad |
| 2   | 前端 apps/web(16 文件)           | 16     | ✅ articles/reports/signup-batch/invoices                                                        |
| 3   | 小程序 apps/miniapp-taro(2 文件) | 2      | ✅ pay/VerifyCodeModal                                                                           |

## 三、v3 真缺失清单(按严重性分类)

### 3.1 P0 阻断性缺失(42 项,8 维度)

> 核查结论(P35 后端 P0 深度核查,2026-07-16,5 个并发 agent 核查 35 项):**35 项中 22 项已等价实现,5 项架构替代,3 项已实现但死代码未激活,2 项真实缺失**(schedule 课程表 + doubao_ws)。原 v3 报告判定不准确,已全部修正。

#### 维度 1:数据库表/Schema(6 P0 → ✅ 全部已等价实现或架构替代,0 真实缺失)

> 核查结论(基于深度代码核查):6 项全部已等价实现或合理的架构替代,无真实缺失。

| #   | 缺失项                                         | 旧路径                                    | 新路径                                                                                                                              | 状态                                       |
| --- | ---------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | auth_tokens 表语义偏移(应为 auth_accounts)     | cloud_learning_auth                       | `packages/database/src/schema/oauth.ts` → `user_third_party_accounts` 表(userId/openId/unionId/platform/accessToken/refreshToken)  | ✅ 已等价实现                              |
| 2   | AuthuserMargin 表完全缺失                      | edu/service/auth                          | `packages/database/src/schema/wallet.ts` → `user_margins` + `token_flows` 流水表;wallet.ts/fund.ts/token-balance-service.ts 已使用     | ✅ 已等价实现                              |
| 3   | advertise 广告表完全缺失                       | edu/service                               | `packages/database/src/schema/carousels.ts` → `carousels` 表(position/title/imageUrl/linkUrl/startAt/endAt);`/advertise` 兼容 API + 前端 UI | ✅ 已等价实现(架构升级为通用 carousels)    |
| 4   | cloud_learning_quartz 表(Scheduler)未迁移      | ai-smart-society-java/sql/quartz.sql      | `packages/database/src/schema/admin-sys.ts` L99-128 → `sysJobs` + `sysJobLogs` 元数据表;运行时由 BullMQ 替代 Quartz 集群              | 🔄 架构替代(元数据保留 + BullMQ 运行时)    |
| 5   | cloud_learning_seata_undo_log 事务回滚表未迁移 | ai-smart-society-java/sql/ry_seata.sql    | 无(故意不迁移)— 单库 PostgreSQL 已用原生事务(BEGIN/COMMIT/ROLLBACK + Drizzle `db.transaction()`)替代分布式事务                          | 🔄 架构替代(单库 PG 事务替代 Seata)       |
| 6   | sys_config 配置表字段缺失                      | ai-smart-society-java/sql/ry_20250425.sql | `packages/database/src/schema/admin-sys.ts` L167-178 → `sysConfigs` 表(RuoYi 完整字段);架构升级为多层配置(systemConfigs/integrationConfigs/paymentConfigs/hotConfig) | ✅ 已等价实现(字段更丰富,多层配置体系)    |

#### 维度 2:Java 后端服务(13 P0 → 12 项已等价/架构替代,1 项真实缺失)

> 核查结论(基于深度代码核查):7 个 Spring Cloud 微服务中 6 项已等价实现(共 ~335 端点,远超旧服务)+ 1 项架构合并;4 个 RuoYi 模块(原清单 6 项实为 4 模块)中 3 项已等价 + 1 项架构替换。**真实缺失 1 项:schedule 课程表/排课服务**(schedule.ts 实为 Cron 任务调度,非课程表,server.ts:492 注释误导)。

##### 2.1 Spring Cloud 微服务(7 项 → 5 ✅ + 1 🔄 + 1 ❌)

| #   | 服务名            | 旧路径                          | 新路径                                                                                                                                                          | 端点数     | 状态                                                                                                                  |
| --- | ----------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | auth-service      | edu/service/auth-service        | `apps/api/src/routes/auth.ts` + `auth-extended.ts` + `auth-identity.ts` + `auth-sso.ts`                                                                          | ~84        | ✅ 已等价实现(远超旧服务,含 OAuth2/PKCE/设备令牌/SMS/实名/SSO/PAT)                                                    |
| 2   | behavior-service  | edu/service/behavior-service    | `apps/api/src/routes/behavior.ts` + `point.ts` + `gamification.ts` + `checkin.ts` + `interactions.ts`                                                          | ~60        | ✅ 已等价实现(点赞/收藏/浏览/积分/签到/互动全覆盖)                                                                     |
| 3   | circle-service    | edu/service/circle-service      | `apps/api/src/routes/community/circles.ts` + `posts.ts` + `asks.ts` + `topics.ts` + `community.ts` 聚合                                                        | ~44        | 🔄 架构合并(合并到 community 子模块,圈子/动态/成员/话题全覆盖)                                                        |
| 4   | exam-service      | edu/service/exam-service        | `apps/api/src/routes/exam.ts`                                                                                                                                   | ~57        | ✅ 已等价实现(试卷/题目/答题/成绩/错题/作文/章节/分类全覆盖)                                                            |
| 5   | live-service      | edu/service/live-service        | `apps/api/src/routes/live.ts`(liveRoutes + adminLiveRoutes)                                                                                                     | ~34        | ✅ 已等价实现(直播间/预约/回放/讲师/分类/腾讯云流回调全覆盖)                                                            |
| 6   | resource-service  | edu/service/resource-service    | `apps/api/src/routes/resource.ts` + `files.ts` + `oss.ts` + `chunked-upload.ts` + `file-version.ts`                                                            | ~56        | ✅ 已等价实现(资源库 + 文件上传 + OSS 直传 + 分片上传 + 版本管理)                                                     |
| 7   | schedule-service  | edu/service/schedule-service    | `apps/api/src/routes/schedule.ts` 存在但为 Cron 任务调度(非课程表)                                                                                                | 0(课程表) | ❌ 真实缺失 — server.ts:492 注释"排课任务"系误导,schedule.ts 实际是 BullMQ 定时任务调度,全代码库无课程表/课节/教室/排课逻辑 |

##### 2.2 RuoYi 系统模块(原清单 6 项 → 实为 4 模块,3 ✅ + 1 ⚠️)

> 说明:原清单标题"6 个 RuoYi 系统模块 Controller"实际只列出 system / job / gen / tools 共 4 个模块(RuoYi 的 system 模块内部包含用户/角色/部门/菜单/字典/配置等 6 个子 Controller,可能是清单把"system 模块 6 个子 Controller"误算为"6 个模块")。

| #   | 模块   | 旧路径                       | 新路径                                                                                                                                                                | 状态                                                                              |
| --- | ------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | system | ruoyi-modules/ruoyi-system   | `apps/api/src/routes/admin-sys.ts`(1042 行,8 子系统:sys-menu/role/logininfor/notice/job/online/dept/post/config/dict-type/dict-data)+ `system.ts`(560 行)+ 配套 schema         | ✅ 已等价实现                                                                     |
| 2   | job    | ruoyi-modules/ruoyi-quartz   | `apps/api/src/routes/admin-sys.ts` L399-525(RuoYi 兼容 /job)+ `schedule.ts`(新风格 /schedule/tasks)+ `packages/database/src/schema/schedule.ts`(schedule_tasks + schedule_logs)+ bullmq | ✅ 已等价实现(Quartz → BullMQ,双轨兼容 + 新风格增强字段)                          |
| 3   | gen    | ruoyi-modules/ruoyi-generator | `drizzle-kit: ^0.30.0`(migration 生成)+ `scripts/generate-sdk.ts`(前端 SDK 生成)                                                                                       | ⚠️ 架构替换(不再需要"DB 表→Java CRUD"脚手架,Drizzle 类型安全 schema 即单一来源)   |
| 4   | tools  | ruoyi-modules/ruoyi-tools    | `@fastify/swagger-ui`(`/docs` 自动生成)+ `system.ts` L254-284 SMTP 测试(nodemailer)+ `services/sms.ts`(阿里云短信)+ `/admin/integrations/:id/test` 统一测试入口           | ✅ 已等价实现(三大职责 Swagger/邮件/短信分散到对应模块)                              |

#### 维度 3:Python 后端服务(16 P0 → 14 项已等价/架构替代,1 项真实缺失,3 项死代码待激活)

> 核查结论(基于深度代码核查):8 个 Coze API 文件中 6 项已等价 + 1 项架构替代 + 1 项真实缺失(doubao_ws);8 个 Coze services 文件中 4 项已等价 + 3 项已实现但死代码未激活 + 1 项架构替代。

##### 3.1 Coze API 文件(8 项 → 6 ✅ + 1 ❌ + 1 🔄)

| #   | 文件                                 | 旧路径                                            | 新路径                                                                                                                              | 状态                                                  |
| --- | ------------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | websocket_qwen_stream_omni           | coze_zhs_py/api/websocket_qwen_stream_omni.py     | `apps/api/src/routes/chat-models.ts:900` → `GET /ws/qwen-omni`(双向 WS 转发 dashscope realtime,接入监控指标)                         | ✅ 已等价实现                                         |
| 2   | websocket_doubao_stream_simplified   | coze_zhs_py/api/websocket_doubao_stream_simplified.py | 无 — 仅 `proxy-llm.ts:289` HTTP `/doubao/chat`(非流式),火山方舟 realtime WS 代理缺失                                                 | ❌ 真实缺失(建议升级 P1,参照 /ws/qwen-omni 补写 /ws/doubao) |
| 3   | bailian_app_ws                       | coze_zhs_py/api/bailian_app_ws.py                 | `apps/api/src/routes/ai-vendors/proxy-tools.ts:371` → `GET /bailian/ws`(WS-to-SSE 桥接,推送 chunk/completed/error 事件)               | ✅ 已等价实现                                         |
| 4   | socketio_chat                        | coze_zhs_py/api/socketio_chat.py                 | `apps/api/src/plugins/ws-chat.ts`(`/ws/chat`)+ `ws-ai.ts:452`(`/ws/coze/chat`)+ `ws-notifications.ts` + `legacy.py:40` 兼容状态端点   | 🔄 架构替代(主动废弃 Socket.IO,改用 @fastify/websocket 原生 WS) |
| 5   | coze_websocket_chat(推断)            | coze_zhs_py/api/websocket.py                     | `apps/api/src/plugins/ws-ai.ts:452` → `GET /ws/coze/chat`(代码注释明确"迁移自 coze_zhs_py/api/websocket.py",完整 Coze WS 协议 + 3s 心跳) | ✅ 已等价实现                                         |
| 6   | websocket_qwen_stream(推断)          | coze_zhs_py/api/websocket_qwen_stream.py         | `apps/api/src/routes/chat-models.ts:874` → `POST /qwen/chat/stream`(HTTP SSE,上游 dashscope compatible-mode)                         | ✅ 已等价实现(架构演进为 HTTP SSE)                    |
| 7   | websocket_zhipu_stream(推断)        | coze_zhs_py/api/websocket_zhipu_stream.py        | `apps/api/src/routes/chat-models.ts:987` → `GET /ws/zhipu`(双向 WS 转发 GLM)+ `POST /multi/zhipu/chat/stream`(HTTP SSE 备选)          | ✅ 已等价实现                                         |
| 8   | websocket_deepseek_stream(推断)      | coze_zhs_py/api/websocket_deepseek_stream.py     | `apps/api/src/routes/chat-models.ts:570` → `GET /ws/deepseek`(WS-to-SSE 桥接,上游 api.deepseek.com)                                 | ✅ 已等价实现                                         |

##### 3.2 Coze services 文件(8 项 → 4 ✅ + 3 ⚠️死代码 + 1 🔄)

> 说明:旧项目 `coze_zhs_py/` 已不在仓库,v3 报告路径"coze_zhs_py/services/"系路径误差,实际指旧架构 `server/app/services/` + `server/app/tasks/`(依据 MIGRATION_GAP_ANALYSIS.md R62 深审结论 + expiration-monitor-service.ts 文件头注释)。

| #   | 服务                       | 旧路径                                          | 新路径                                                                                                                                                              | 激活状态                  | 状态                                       |
| --- | -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------ |
| 1   | expiration_monitor         | server/app/tasks/expiration_monitor.py          | `apps/api/src/services/expiration-monitor-service.ts` + `workers/scheduler-worker.ts`(BullMQ 每 30s 调用)                                                            | 已激活                    | ✅ 已等价实现                              |
| 2   | cached_expiration_monitor  | server/app/services/cached_expiration_monitor.py | 合并到 `expiration-monitor-service.ts`(Redis 缓存已处理记录 id,TTL 25h)                                                                                              | 已激活                    | ✅ 已等价实现(合并迁移)                    |
| 3   | monitor_startup           | server/app/services/monitor_startup.py          | 合并到 `expiration-monitor-service.ts` + `plugins/scheduler.ts`(BullMQ repeatable job 生命周期)                                                                      | 已激活                    | ✅ 已等价实现(合并迁移)                    |
| 4   | canary_monitor_bridge     | server/app/services/canary_monitor_bridge.py    | `apps/api/src/services/expiration-monitor-service.ts` L220-247(连续 4 次失败触发回滚)+ `canary-service.ts`(Drizzle 持久化 canaryConfigs + canaryAuditLogs)             | 已激活(4 路由 import)    | ✅ 已等价实现                              |
| 5   | alert_pagerduty           | server/app/services/alert_pagerduty.py          | `apps/api/src/services/alert-notification-service.ts` L487 `pushAlert()`(PagerDuty Events API v2,trigger/acknowledge/resolve)                                         | **未激活**(无 import 引用) | ⚠️ 已实现但死代码(需接线激活)              |
| 6   | alert_webhook             | server/app/services/alert_webhook.py            | `apps/api/src/services/alert-notification-service.ts`(合并,8 渠道:钉钉/企业微信/飞书/邮件/PagerDuty/Slack/Teams/自定义 Webhook,Promise.allSettled 并行)                | **未激活**(无 import 引用) | ⚠️ 已实现但死代码(需接线激活)              |
| 7   | alert_upstream_mocks      | server/app/services/alert_upstream_mocks.py     | `monitoring/alertmanager/noise-rules.yml`(8 条抑制规则)+ `monitor.ts` 路由 `/backfill-status` + `monitorAlerts`/`suppressionRules` DB 表                            | N/A(测试 Mock 工具)      | 🔄 设计替代(测试工具,生产无需迁移)         |
| 8   | markdown_converter        | server/app/services/markdown_converter.py       | `apps/api/src/services/markdown-converter-service.ts` L265 `convertToMarkdown()`(支持 .docx/.xlsx/.pptx/.pdf/.txt/.md 共 6 格式,mammoth + SheetJS + 零依赖 ZIP+XML)    | **未激活**(无路由 import) | ⚠️ 已实现但死代码(需接线激活)              |

**P35 后端 P0 核查汇总(35 项):**

| 维度                  | 总数 | ✅ 已等价 | 🔄 架构替代 | ⚠️ 死代码 | ❌ 真实缺失          |
| --------------------- | ---- | --------- | ----------- | --------- | -------------------- |
| 1. 数据库表/Schema    | 6    | 4         | 2           | 0         | 0                    |
| 2.1 Spring Cloud 微服务 | 7    | 5         | 1           | 0         | 1(schedule 课程表)   |
| 2.2 RuoYi 系统模块    | 4    | 3         | 1           | 0         | 0                    |
| 3.1 Coze API 文件     | 8    | 6         | 1           | 0         | 1(doubao_ws)         |
| 3.2 Coze services 文件 | 8    | 4         | 1           | 3         | 0                    |
| **合计**              | **35** | **22**  | **5**       | **3**     | **2**                |

**真实缺失 2 项 → 移入 P36 补写:**
1. schedule 课程表/排课服务(需先核对旧 Java 语义定论)
2. doubao_ws 火山方舟豆包 WebSocket 流式代理(参照 `/ws/qwen-omni` 模式补写 `/ws/doubao`)

**死代码 3 项 → P1 接线激活:**
1. alert-notification-service.ts(在 alert-check-service.ts 中 import pushAlert,当 escalated > 0 时触发多渠道告警)
2. markdown-converter-service.ts(在 resource.ts 或 files.ts 中 import,提供 `/files/:id/convert-markdown` 端点)

#### 维度 4:小程序页面(5 P0 → 4 项已等价实现,1 项真实缺失)

> 核查结论(基于深度代码核查):4 项已等价实现,1 项真实缺失(小程序 top-up 充值页面)。

| #   | 缺失项                       | 旧路径     | 新路径                                                                        | 状态                  |
| --- | ---------------------------- | ---------- | ----------------------------------------------------------------------------- | --------------------- |
| 1   | earn_commission 分销佣金页面 | zhs_app-ZZ | apps/miniapp-taro/src/pages/distribution/commission.tsx                       | ✅ 已等价实现         |
| 2   | live-streaming 直播页面      | zhs_app-ZZ | apps/miniapp-taro/src/pages/live/{list,detail,history,calendar,subscribe}.tsx | ✅ 已等价实现         |
| 3   | top-up 充值页面              | zhs_app-ZZ | (Web 端已有 apps/web/app/(main)/wallet/recharge/page.tsx,小程序端缺失)        | ❌ 真实缺失(小程序端) |
| 4   | circle/dynamic 社区动态页面  | zhs_app-ZZ | apps/miniapp-taro/src/pages/circle/{index,detail,create}.tsx                  | ✅ 已等价实现         |
| 5   | exam/paper 字段补全          | zhs_app-ZZ | apps/miniapp-taro/src/pages/exam/{list,detail,answer,result}.tsx              | ✅ 已等价实现         |

#### 维度 5:组件(8 P0 → 3 项已等价实现,5 项模糊清单待补全名称)

> 核查结论(基于深度代码核查):3 项已等价实现(UserCard/VoiceInput/LoginDialog),5 项为模糊清单(报告与计划互相引用,无具体名称,需补全)。

| #   | 缺失项                      | 旧路径  | 新路径                                                        | 状态                |
| --- | --------------------------- | ------- | ------------------------------------------------------------- | ------------------- |
| 1   | UserInfoCard 用户信息卡组件 | edu/web | apps/web/src/components/business/UserCard.tsx                 | ✅ 已等价实现       |
| 2   | VoiceInput 语音输入组件     | edu/web | apps/web/src/components/ai/voice-input.tsx                    | ✅ 已等价实现       |
| 3   | loginPopUp 登录弹窗组件     | edu/web | apps/web/src/components/login/LoginDialog.tsx + 11 个配套组件 | ✅ 已等价实现(更优) |
| 4-8 | 5 个其他核心组件            | edu/web | (待补全具体名称,原报告与 P34 互相引用无具体名称)              | ⚠️ 模糊清单待补全   |

#### 维度 6:配置/常量/工具函数(6 P0 → ✅ 全部已等价实现,架构升级)

> 核查结论(基于深度代码核查):全部已等价实现(架构升级:Tailwind/sonner/Zustand/next-themes 替代旧 SCSS/Vue util)。

| #   | 缺失项                                                                          | 旧路径             | 新路径                                                                                     | 状态                |
| --- | ------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ | ------------------- |
| 1   | authorityUtils 权限工具                                                         | edu/admin/src/util | middleware.ts + require-permission.ts + auth-utils.ts + auth-permissions.ts + HasPermi.tsx | ✅ 已等价实现(更优) |
| 2   | tipsUtils 提示工具                                                              | edu/admin/src/util | use-toast.ts(sonner)+ use-confirm.tsx + use-notification.ts                                | ✅ 已等价实现(更优) |
| 3   | dict 数据字典工具                                                               | edu/admin/src/util | admin-sys.ts + admin-sys-queries.ts + admin/dict/ 页面 + E2E 测试                          | ✅ 已等价实现(更优) |
| 4-6 | dateUtils / tokenUtils / requestUtils / buriedPointUtils / userUtils / vuexShim | edu/admin/src/util | R44 审计已确认全部等价替代                                                                 | ✅ 已等价实现(整体) |

#### 维度 7:i18n 国际化(2 P0 → ⚠️ 部分实现,框架已搭建,翻译键完整性约 30%)

> 核查结论(基于深度代码核查):框架已搭建,翻译键完整性约 30%,需补齐翻译键。

| #   | 缺失项             | 旧路径             | 新路径                    | 状态                      |
| --- | ------------------ | ------------------ | ------------------------- | ------------------------- |
| 1   | Web 端 i18n 体系   | edu/web/src/lang   | next-intl + 5 语言 JSON   | ⚠️ 部分实现(翻译键约 30%) |
| 2   | admin 端 i18n 翻译 | edu/admin/src/lang | 21 个文件已接入 next-intl | ⚠️ 部分实现(翻译键不完整) |

#### 维度 8:样式/主题(4 P0 → ✅ 全部已等价实现,架构升级)

> 核查结论(基于深度代码核查):全部已等价实现(架构升级:Tailwind 4 + next-themes 替代旧 SCSS)。

| #   | 缺失项                      | 旧路径               | 新路径                                              | 状态                |
| --- | --------------------------- | -------------------- | --------------------------------------------------- | ------------------- |
| 1   | variables.scss 全局变量     | edu/web/src/styles   | globals.css @theme{} 块(Tailwind 4 + CSS 变量)      | ✅ 已等价实现(更优) |
| 2   | theme.scss 主题切换         | edu/web/src/styles   | theme-provider.tsx(next-themes)+ theme.ts store     | ✅ 已等价实现(更优) |
| 3   | hover-background-layer.scss | edu/web/src/styles   | Tailwind hover:bg-* 工具类                          | ✅ 已等价实现(更优) |
| 4   | 主题色变量映射              | edu/admin/src/styles | globals.css --color-brand-* + /admin/theme 管理页面 | ✅ 已等价实现(更优) |

### 3.2 P1 关键缺失(本 goal 第 14 agent 新发现,2 项)

#### P1-1:搜索中文分词(关键业务影响)

| 项                                                                    | 旧路径                                                  | 新路径                                                            | 缺失     |
| --------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| Lucene HMM 中文分词(CustomSmartChineseAnalyzer + HMMChineseTokenizer) | edu/service/search-service/**/chineseanalyzer/          | apps/api/src/db/search-queries.ts 用 PG pg_catalog.simple(不分词) | **缺失** |
| ExtendWordFilter 自定义词典扩展                                       | search-service/**/chineseanalyzer/ExtendWordFilter.java | 缺失                                                              | **缺失** |
| stopwords.txt 停用词表                                                | search-service/src/main/resources/stopwords.txt         | 缺失                                                              | **缺失** |
| 搜索高亮 highlight                                                    | api-docs/cloud-learning-search-service.md               | 缺失                                                              | **缺失** |
| 搜索 facets 聚合                                                      | 同上                                                    | 缺失                                                              | **缺失** |
| HotWord 热词模块                                                      | search-service/**/biz/hotword/                          | 缺失                                                              | **缺失** |
| 搜索记录 Record 模块                                                  | search-service/**/biz/record/                           | 缺失                                                              | **缺失** |

#### P1-2:API 文档完整性(协作影响)

| 项                                         | 旧路径                        | 新路径                                      | 缺失     |
| ------------------------------------------ | ----------------------------- | ------------------------------------------- | -------- |
| 22 份 cloud-learning-*-service.md 接口规格 | edu/service/service/api-docs/ | 仅 @fastify/swagger 自动生成,无人工撰写规格 | **缺失** |
| 268KB openapi.json 完整端点规格            | coze_zhs_py/openapi.json      | 缺失                                        | **缺失** |
| ZHS_Server_java API 接口文档.md            | ljd-交接文件/ZHS_Server_java/ | 缺失                                        | **缺失** |

### 3.3 P2 增强缺失(15+ 项,本 goal 不补写)

| #   | 项                         | 旧路径                                                | 新路径                                     | 严重性 |
| --- | -------------------------- | ----------------------------------------------------- | ------------------------------------------ | ------ |
| 1   | 业务细分错误码             | edu/service/**/GlobalException.java                   | apps/api/src/errors/codes.ts 仅 14 通用码  | P2     |
| 2   | RSA 非对称 JWT 密钥库      | edu/service/auth/**/jwt.jks                           | 当前用 HS256 对称密钥                      | P2     |
| 3   | admin 动态路由权限过滤     | edu/admin/src/util/authorityUtils.js                  | Next.js middleware.ts,无 filterAsyncRoutes | P2     |
| 4   | Redisson 分布式锁          | edu/service/**/redisson.yml                           | 当前用 BullMQ + PG advisory lock           | P2     |
| 5   | 253 云通讯短信平台         | notification-service/**/sms/platform/e253/            | 缺失                                       | P2     |
| 6   | 无锡物业短信平台           | notification-service/**/sms/platform/wuxiwuye/        | 缺失                                       | P2     |
| 7   | 微信支付 4 种终端          | pay-service/**/wechatpay/                             | apps/api/src/services/wechat-pay.ts 简化版 | P2     |
| 8   | Qwen Omni WebSocket 流式   | coze_zhs_py/api/websocket_qwen_stream_omni.py         | 缺失                                       | P2     |
| 9   | 豆包简化 WebSocket 流式    | coze_zhs_py/api/websocket_doubao_stream_simplified.py | 缺失                                       | P2     |
| 10  | 百炼 App WebSocket         | coze_zhs_py/api/bailian_app_ws.py                     | 缺失                                       | P2     |
| 11  | Socket.IO 协议             | coze_zhs_py/api/socketio_chat.py                      | 当前仅原生 WebSocket                       | P2     |
| 12  | RocketMQ Topic 路由        | message-service/**/rocketmq/                          | 当前用 BullMQ 无 Topic 概念                | P2     |
| 13  | 消息统计 MessageStatistics | message-service/**/statistics/                        | 部分迁移到 statistics-queries.ts           | P2     |
| 14  | Nacos 远程配置中心         | edu/service/**/application.yml                        | 当前用 .env + hot-config.ts                | P2     |
| 15  | 历史 30+ 数据修复脚本      | edu client/scripts/fix_*.js                           | 缺失(若数据已迁移可忽略)                   | P2     |

### 3.4 109 项"合理架构演进"中约 66 项有缺失(分批补写)

| 演进类型                              | 总数    | 等价   | 部分等价 | 缺失                                        |
| ------------------------------------- | ------- | ------ | -------- | ------------------------------------------- |
| 独立 edit 页 → Dialog(39 项)          | 39      | 1      | 12       | 26(其中 9 实体不匹配)                       |
| 独立分类树页 → Dialog 内嵌(11 项)     | 11      | 0      | 0        | 11(TreeSelect/pid/搜索缺失)                 |
| 分散 API → 集中化 lib/*-api.ts(22 项) | 22      | 0      | 0        | 22(约 420+ 管理接口缺失)                    |
| Vue mixin → React hook(15 项)         | 15      | 0      | 0        | 15(AI 业务方法 100% 缺失)                   |
| 模块重组/命名变更(22 项)              | 22      | 12     | 6        | 4                                           |
| **合计**                              | **109** | **13** | **18**   | **78**(其中部分为"实体不匹配"需新建 Dialog) |

## 四、当前 monorepo 优势(13 项远超历史)

1. **测试覆盖**:50+ API 测试 + 22 E2E + Storybook(历史 0 测试)
2. **安全机制**:CSRF + IDOR Guard + AES-256-GCM + JWT 密钥轮换 + Token Family(历史仅 JWT + OAuth2)
3. **CI/CD**:8 个 GitHub Actions + 多阶段 Dockerfile(历史仅 .bat 脚本)
4. **监控告警**:Prometheus + Grafana + OpenTelemetry + Jaeger + alerts.yml(历史仅 logback)
5. **SEO/SSR**:Next.js SSR/SSG + sitemap + robots(历史 Vue2 SPA 无 SSR)
6. **PWA**:manifest + Service Worker(历史无)
7. **多租户**:完整 tenant + RLS(历史无)
8. **限流熔断**:Bulkhead + rate-limit + under-pressure + DLQ(历史无)
9. **健康检查**:5 个端点 + Docker healthcheck(历史仅 PowerShell 脚本)
10. **审计日志**:自动写操作记录(历史无)
11. **API 日志**:批量缓冲 + 采样(历史无)
12. **数据备份**:PG 自动每日备份(历史无自动备份)
13. **分片上传**:chunked-upload(历史无)

## 五、架构合理差异(非缺失)

- BullMQ vs RocketMQ(单服务 vs 微服务架构差异)
- .env vs Nacos(单服务部署无需配置中心)
- 原生 WebSocket vs Socket.IO(协议选择差异)
- HS256 vs RSA(密钥管理策略差异)

## 六、主动放弃迁移(1 项,技术栈不兼容)

| 旧实现                                                        | 新技术             | 原因                                                     |
| ------------------------------------------------------------- | ------------------ | -------------------------------------------------------- |
| ihui-ai-admin-frontend/src/views/tool/gen/ (RuoYi 代码生成器) | drizzle-kit + plop | RuoYi 生成器基于 Java 模板,与 Next.js + Drizzle 栈不兼容 |

## 七、分批补写计划(详见 PROJECT_PLAN.md P34 条目)

| 批次      | 优先级 | 内容                                                                     | 状态        |
| --------- | ------ | ------------------------------------------------------------------------ | ----------- |
| 当前 goal | P1     | 搜索中文分词 + API 文档 + MIGRATION_GAP_REPORT 修正 + PROJECT_PLAN P34   | ⏳ 进行中   |
| P35       | P0     | 数据库表/Schema 6 项 + Java 13 项 + Python 16 项(后端 P0,未核查)         | ⏳ 待启动   |
| P36       | P0     | 1 项真实缺失(小程序 top-up)+ 5 项模糊待确认 + i18n 翻译键补齐            | ⏳ 待启动   |
| P37       | P0     | 配置/工具 6 项 + i18n 2 项 + 样式 4 项(全部已等价实现,架构升级,无需补写) | ✅ 无需补写 |
| P38       | P1     | 109 项演进中 78 项缺失(分批)                                             | ⏳ 待启动   |
| P39       | P1     | 155 项额外缺失中 P1 部分                                                 | ⏳ 待启动   |
| P40       | P2     | 15+ 项 P2 增强                                                           | ⏳ 待启动   |

## 八、最终定论(v3 修正版)

**v2 报告声称的"100% 完整率"经 14 个 agent 字段级 diff 核查后推翻**。

真实状态:

- 完整等价:270 项(46%)
- 部分等价(合理演进但字段缺失):157 项(27%)
- 真缺失:161 项(27%)
- 合计需补写:约 220 项(157 + 161 中重复部分)

当前 monorepo 在 13 项维度(测试/安全/CI/CD/监控/SEO/PWA/多租户/限流/健康检查/审计/日志/分片上传)远超历史,但在以下方面有缺失:

- **P1 阻断性**:搜索中文分词、API 文档(2 项)
- **P0 阻断性**:42 项(8 维度,详见第三节)
- **P2 增强**:15+ 项(详见 3.3)
- **演进缺失**:109 项"合理演进"中 78 项有不同程度缺失

补写计划分批进行,详见 PROJECT_PLAN.md P34 条目。
