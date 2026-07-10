# 架构重构完整性深度比对报告（最终验证版 v10）

> **目标条件**：深度比对当前项目代码与架构重构前最新提交(3ee96cf0)的差异，找出所有未完整迁移到新架构(TS Monorepo)的地方
> **基准**：旧架构 `3ee96cf0`（Python FastAPI + Vue 3）→ 新架构当前 HEAD `60890463`（TS Monorepo）
> **分析方法**：4 个并行代理初步分析 → 主线代码级验证 → 12 轮深度验证（含 R10/R11/R12 新增提交验证+功能映射）
> **分析日期**：2026-07-11
> **验证轮次**：12 轮

---

## 重要说明

本报告经过 **12 轮代码级验证**。v9 报告基于 HEAD `0ad7afd7`，此后新增 6 个提交（`9b63fef3`→`60890463`）。R11 对当前 HEAD `60890463` 做了全量重新验证，R12 对 M-3 的 11 个用户端页面做了精确功能映射。发现：

1. **miniapp 从 15 页扩展到 75 页**（commit `a30b5705`，真实完整迁移）
2. **部分提交消息严重夸大**：`f24d0be3` 声称"补齐后端迁移"实际仅改 2 文件 5 行；`6ed35c14` 声称"所有34项缺失已100%修复完成"实际 6 项中严重度缺失仍全部存在
3. **v9 的 6 项中严重度缺失全部仍未修复**

### v9→v10 新增提交追踪（6 个提交）

| 提交 | 说明 | 实际变更 | R11 验证 |
|------|------|---------|---------|
| `9b63fef3` | feat(db): 补齐迁移完整性 - 19张缺失表+11子表 | 仅 5 文件 248 行（journal 注册 + snapshot + billing.ts 3 行） | 表已在 v8 修复中存在，本提交仅补 journal |
| `f24d0be3` | feat(api): 补齐后端迁移 - AI Workspace/Chat/Coze/客服/安全/WS/服务层/clawdbot | **仅 2 文件 5 行**（payment-queries.ts + payment-gateway.ts） | ⚠️ 消息严重夸大 |
| `4f159c01` | feat(web): 补齐前端迁移 - AI组件群/教育后台/登录组件/设置中心/admin导航/i18n 3语言 | 3 i18n 文件各 24 行 + 6 ai-generation 组件各 1-2 行 + 2 admin edu 页面微调 | i18n 已在 v9 验证存在 |
| `a30b5705` | feat(miniapp): 小程序端完整迁移 - 75页全部完成 | **真实**：miniapp 从 15 页扩展到 75 页（about/ai/ask/circle/distribution/exam/live/member/news/order/pay/setting/study/topic/teacher/user/vip/course/login/index） | ✅ 真实改进 |
| `6ed35c14` | docs: 所有34项缺失已100%修复完成 | 仅改报告文件 | ⚠️ 消息不实，6 项中严重度缺失仍存在 |
| `60890463` | fix(api): remove 3 as-any casts in agents.ts | agents.ts 6 行类型修复 | ✅ 真实改进 |

---

## 一、规模总览（R11 最终验证）

| 维度 | 旧架构 | 新架构（R11 验证后） | 状态 |
|------|--------|--------|------|
| 后端路由文件 | ~90 模块 | 54 个路由文件 | ✅ 全部注册 |
| 后端路由端点 | ~600+ | ~700+ | ✅ 超旧架构 |
| 后端插件 | ~10 中间件 | 35 个 register | ✅ 含安全/WS/监控/调度/幂等/OTel/AI成本/多租户/缓存韧性/CSRF/限流/XSS |
| 后端服务层 | 37 个 | 17 service + 50 queries + clawdbot 20 + workspace-ai | ✅ 双层设计 |
| WebSocket | 16 文件 | 4 WS 插件 + 3 WS 端点 | ✅ 通知/AI流式/聊天室/客服 |
| 定时任务 | 13 个 APScheduler | 5 个 BullMQ cron | ⚠️ 2/5 接入，3/5 待 backing |
| 支付幂等性 | ✅ | ✅ 167 行 | ✅ 完整迁移 |
| AI 成本治理 | ✅ | ✅ 384 行 + 仪表盘 | ✅ 完整迁移 |
| 缓存韧性 | ✅ | ✅ 163 行 | ✅ **v9 新增**（熔断器+双删+singleflight） |
| XSS 防护 | 全局中间件 | ✅ 全局中间件 | ✅ **v9 新增**（onRequest 净化 + onSend 安全头） |
| 可观测性 | OTel+ELK+Grafana | OTel+Grafana+Prometheus | ⚠️ 仅 ELK 缺失 |
| 安全审计 CI | ✅ | ✅ | ✅ 完整迁移 |
| CLI 工具 | 5 命令 | 6 文件 | ✅ 完整迁移 |
| 多租户 | ✅ | ✅ 插件+路由+3表 | ✅ 完整迁移 |
| OpenAPI SDK | Python 672 文件 | generate-sdk.ts | ✅ 完整迁移 |
| Schema 模块 | 53 个 | 65 个（含 4 个 -extended 新文件） | ✅ **v9 补齐 14 张表** |
| 前端页面 | 579 .vue | ~200+ page.tsx | ⚠️ 11 个旧页面待核实 |
| AI 前端组件 | 65+ | 50 个 .tsx | ✅ 完整迁移 |
| 登录组件 | 25 | 8 个 .tsx | ✅ 完整迁移 |
| 设置组件 | 20 | 7 个 .tsx | ✅ 完整迁移 |
| i18n 语言 | 5 种 | 5 种 | ✅ **v9 补齐**（zh-CN/zh-TW/en/ja/ko） |
| 小程序端 | 1217 文件 | 75 页面（~90 文件） | ✅ **v10 完整** apps/miniapp/（R11 从 15 页扩展到 75 页） |
| plaza.ts/billing.ts | ✅ | ✅ 真实 DB 查询 | ✅ **v9 修复**（不再是 stub） |

---

## 二、阻断级缺失

**R10 验证结果：无阻断级缺失。**

v8 报告的 B-1（小程序端完全缺失）已在 `0ad7afd7` 中通过新增 [apps/miniapp/](file:///g:/IHUI-AI/apps/miniapp/) 解决（~90 文件，15+ 页面，含 App.vue/main.ts/pages.json/manifest.json/api/index.ts/utils/request.ts/auth.ts + course/live/ai/user/login/index 等页面）。

---

## 三、高严重度缺失

**R10 验证结果：无高严重度缺失。**

### v8 H-1（约 10 张数据库表缺失）— ✅ 已修复

**修复提交**：`60cf52c3` + `30ba633a`

**验证证据**（4 个新 schema 文件，14 张表）：
- [learn-extra-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/learn-extra-extended.ts)：learnRecord / learnRecordLog / learnTopic / learnTopicCategory / learnTopicCategoryRelation / learnTopicLesson / learnTopicTopicCategoryRelation / learnLearnMapTopic / learnHomeworkRecord（9 表）
- [agents-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/agents-extended.ts)：agentHeatStats / agentCallbacks / agentConfigs（3 表）
- [exam-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/exam-extended.ts)：examWrongQuestion（1 表）
- [user-auth-info.ts](file:///g:/IHUI-AI/packages/database/src/schema/user-auth-info.ts)：userAuthInfo（1 表）

### v8 H-2（agents 表丢失 20+ Coze 配置字段）— ✅ 已修复

**修复提交**：`e6af19a8`

**验证证据**：[agents-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/agents-extended.ts) 第 42-56 行，14 个 Coze 字段全部补齐：
agentVersion / botId / botIdStr / botName / agentPrompt / agentModel / agentTemperature / agentMaxTokens / agentVariables / publishChannel / usageCount / likeCount / shareCount / cozeAccountId

### v8 H-3（缓存韧性缺失）— ✅ 已修复

**修复提交**：`30ba633a`

**验证证据**：[cache-resilience.ts](file:///g:/IHUI-AI/apps/api/src/plugins/cache-resilience.ts)（163 行），三项能力完整实现：
1. **熔断器**：closed/open/half_open 三态机，5 次失败阈值，30s 冷却
2. **缓存一致性**：doubleDelete 双删策略（写前删 + 写后延迟删）
3. **缓存击穿防护**：singleflight 模式（相同 key 并发只回源一次）

**注册**：server.ts 第 200 行 `await server.register(cacheResilience)`

> **v8 误报根因**：grep 使用英文关键词 `circuit_breaker|cache_coherence|breakdown_guard` 零匹配，但文件内使用中文术语"熔断器/缓存一致性/缓存击穿防护"。R10 通过直接读取文件内容纠正。

---

## 四、中严重度缺失（R11 验证后剩余 6 项，全部仍未修复）

### M-1. 定时任务 3/5 backing service 未迁移
- **R11 验证**：scheduler-worker.ts 第 44-55 行未变更，3 个任务仍 `return { skipped: true, reason: '... not migrated' }`
- **待迁移**：heat-stats-hourly / alert-check-daily / data-archive-daily
- **严重程度**：中

### M-2. 14 个 admin 页面使用 MOCK 数据（R11 精确确认）
- **R11 验证**：grep `Promise\.resolve\(MOCK` 精确确认 14 个页面完全使用 MOCK 数据（无真实 API 调用），共 27 处 `Promise.resolve(MOCK_...)`：
  1. [api-usage/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/api-usage/page.tsx)：MOCK_STATS / MOCK_DAY_USAGE / MOCK_TOP（3 处）
  2. [backend-health/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/backend-health/page.tsx)：MOCK_EVENTS（1 处）
  3. [database-optimization/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/database-optimization/page.tsx)：MOCK_TABLES / MOCK_SLOW_QUERIES / MOCK_SUGGESTIONS（3 处）
  4. [developer/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/developer/page.tsx)：MOCK_KEYS / MOCK_WEBHOOKS / MOCK_SDKS（3 处）
  5. [dict/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/dict/page.tsx)：MOCK_DICTS（1 处）
  6. [event-bus-monitor/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/event-bus-monitor/page.tsx)：MOCK_STATS / MOCK_EVENTS（2 处）
  7. [error-dashboard/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/error-dashboard/page.tsx)：MOCK_STATS / MOCK_ERRORS（2 处）
  8. [gray-release/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/gray-release/page.tsx)：MOCK_RULES（1 处）
  9. [mobile-adapter/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/mobile-adapter/page.tsx)：MOCK_DEVICES（1 处）
  10. [monitoring-dashboard/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/monitoring-dashboard/page.tsx)：MOCK_SERVICES / MOCK_PERF / MOCK_ALERTS / MOCK_LOGS（4 处）
  11. [performance-dashboard/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/performance-dashboard/page.tsx)：MOCK_STATS / MOCK_ENDPOINTS（2 处）
  12. [oauth-audit-dashboard/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/oauth-audit-dashboard/page.tsx)（1 处）
  13. [sms/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/sms/page.tsx)（2 处）
  14. [recommendation-config/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/recommendation-config/page.tsx)：MOCK_SLOTS（1 处）
- **另注**：[api-groups/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/admin/api-groups/page.tsx) 有真实 API 调用但以 MOCK_GROUPS 作为降级兜底（非纯 MOCK）
- **严重程度**：中

### M-3. 11 个用户端独立页面功能映射（R12 精确确认）

**R12 验证方法**：读取旧架构 `3ee96cf0` 中 11 个 Vue3 页面内容 + 比对新架构 200+ page.tsx 功能

| 旧页面 | 旧功能描述 | 新架构对应 | 状态 |
|--------|-----------|-----------|------|
| AiWorld.vue | AI 展厅/分类导航内容页（左侧分类树+右侧内容区） | 无（/workspace/ 是 AI 编码，/agents/ 是智能体管理，/plaza/ 是广场） | ❌ 缺失 |
| KnowledgeBase.vue | 知识库+详情页 | /docs/（文档中心，scope 不同） | ⚠️ 部分映射 |
| Tools.vue | 用户端工具目录（分类侧边栏+工具卡片网格+搜索） | 无（/admin/resources/ 仅管理端） | ❌ 缺失 |
| Ranking.vue | 用户端排行榜 | /admin/edu/learn/ranking/（仅管理端） | ❌ 缺失（用户侧） |
| Share.vue | 社交分享页（预览卡片+分享功能） | 无 | ❌ 缺失 |
| Refund.vue | 用户端退款申请 | /admin/refund/（仅管理端）+ /orders/（订单页可能含退款入口） | ⚠️ 部分映射 |
| N8NAgents.vue | N8N 工作流智能体 | /workflows/（含 /workflows/[id]/ 和 /workflows/instances/[id]/） | ✅ 已映射 |
| MCPUseProject.vue | MCP 使用项目页 | 无（/components/mcp/ 有 9 个组件但无独立页面） | ❌ 缺失 |
| BiDashboard.vue | 商业智能仪表盘 | /admin/statistics/（仅管理端，scope 不同） | ⚠️ 部分映射 |
| SecurityAuditDashboard.vue | 安全审计仪表盘 | 无（/user/security/ 是安全设置页，非审计仪表盘） | ❌ 缺失 |
| ApiTestPage.vue | API 测试页 | 无（/admin/integrations/ 是集成管理，非测试） | ❌ 缺失 |

**R12 结论**：
- ✅ 已映射：1 项（N8NAgents → /workflows/）
- ⚠️ 部分映射：3 项（KnowledgeBase → /docs/，Refund → /orders/，BiDashboard → /admin/statistics/ — 均为管理端或 scope 不同）
- ❌ 真实缺失：7 项（AiWorld / Tools / Ranking 用户侧 / Share / MCPUseProject / SecurityAuditDashboard / ApiTestPage）
- **严重程度**：中

### M-4. ~~i18n 缺失 3 种语言~~ — ✅ 已修复
- **验证证据**：[apps/web/messages/](file:///g:/IHUI-AI/apps/web/messages/) 目录含 5 个文件：zh-CN.json / zh-TW.json / en.json / ja.json / ko.json

### M-5. CI 能力缺失
- **R11 验证**：grep `knip|openapi-check|visual-regression|miniapp-preview` 排除 client/ 后仅命中报告文件和交接文档，新架构零匹配
- **缺失**：knip（死代码检测）/ openapi-check / visual-regression / miniapp-preview
- **严重程度**：中

### M-6. 数据库基础设施缩水
- **R11 验证**：grep `read.?write.?split|readWriteSplit|replica|slow.?sql|slowQuery` 排除 client/ 后仅命中 pnpm-lock.yaml（依赖描述），源码零匹配
- **缺失**：读写分离 / 连接保活 / 慢 SQL 杀手
- **严重程度**：中

### M-7. ~~plaza.ts / billing.ts 是 stub~~ — ✅ 已修复
- **验证证据**：
  - [plaza.ts](file:///g:/IHUI-AI/apps/api/src/routes/plaza.ts)：GET /list 调用 `findPlazaItemList`（来自 misc-queries.ts），含 zod 校验 + 鉴权
  - [billing.ts](file:///g:/IHUI-AI/apps/api/src/routes/billing.ts)：GET /plans + GET /plans/:id 调用 `findPlans` / `findPlanById`（来自 billing-queries.ts）

### M-8. ~~XSS 防护降级~~ — ✅ 已修复
- **验证证据**：[xss-protection.ts](file:///g:/IHUI-AI/apps/api/src/plugins/xss-protection.ts)（97 行），已恢复为全局中间件：
  - onRequest hook：递归净化请求体/查询参数中的字符串（HTML 实体编码 + 剥离危险向量）
  - onSend hook：X-XSS-Protection / X-Content-Type-Options / X-Frame-Options / Referrer-Policy
- **注册**：server.ts 第 236 行 `await server.register(xssProtectionPlugin)`

### M-9. 旧架构运维能力缺失
- **R11 验证**：grep `n\+1|prompt.?injection|promptInjection|distributed.?transaction` 排除 client/ 后仅命中 pnpm-lock.yaml，源码零匹配
- **缺失**：N+1 检测 / Prompt 注入防护 / 分布式事务模式
- **严重程度**：中

---

## 五、低严重度/实验性（可暂缓）

- ELK 日志管线（OTel/Grafana/Prometheus 已覆盖主体）
- 实验性运维脚本（chaos/digital_twin/edge_computing 等）
- 设计系统演示页
- Electron 桌面端（旧架构仅占位）

---

## 六、已完整迁移确认（R10 验证）

### 后端（54 路由 + 35 插件 + 17 服务 + 50 查询）
- AI 厂商集成（11 家）：ai-vendors.ts 1280+ 行 80 端点
- Coze 平台（12 子模块）：coze.ts 873 行 46 端点
- AI Workspace Coding（15 子模块）：workspace-ai.ts 65 端点 + 1920 行服务
- clawdbot AI Bot（15 服务）：clawdbot.ts 36 端点 + 20 服务文件
- Chat 多模型直连（9 模型）：chat-models.ts 31 端点
- 退款审核、客服系统、支付网关（含幂等性）、VIP/钱包/佣金/分销、多登录扩展、GDPR、AI 音频

### 数据库（65 schema 模块，14 张表已补齐）
- learn-extra-extended.ts（9 表）/ agents-extended.ts（3 表 + 14 Coze 字段）/ exam-extended.ts（1 表）/ user-auth-info.ts（1 表）

### 前端组件群（完整迁移）
- [ai/](file:///g:/IHUI-AI/apps/web/src/components/ai/) 24 组件 + [ai-generation/](file:///g:/IHUI-AI/apps/web/src/components/ai-generation/) 17 组件 + [mcp/](file:///g:/IHUI-AI/apps/web/src/components/mcp/) 9 组件 = 50 个 AI 前端组件
- [login/](file:///g:/IHUI-AI/apps/web/src/components/login/) 8 组件（Google/Apple/钉钉/企业微信/GitHub OAuth2）
- [settings/](file:///g:/IHUI-AI/apps/web/src/components/settings/) 7 组件（2FA/会话/安全评分/登录历史/IP白名单/设备管理/主题同步）

### 小程序端（v9 新增，完整迁移）
- [apps/miniapp/](file:///g:/IHUI-AI/apps/miniapp/) ~90 文件，15+ 页面（course/live/ai/user/login/index + setting/about/teacher/exam/study/topic/ask/circle/news/distribution/order/pay/member/vip）

### 安全与韧性（v9 完整）
- 缓存韧性：cache-resilience.ts（熔断器 + 双删 + singleflight）
- XSS 防护：xss-protection.ts（全局 onRequest + onSend）
- CSRF：csrf.ts（双提交 Cookie）
- 分布式限流：distributed-rate-limit.ts
- 支付幂等性：payment-idempotency.ts（167 行）
- AI 成本治理：ai-cost.ts（384 行 + 仪表盘）
- 可观测性：otel.ts + grafana 3 仪表盘 + prometheus + 6 告警
- 安全审计 CI：weekly-security-audit.yml
- 响应/日志脱敏：response-sanitizer.ts + log-sanitizer.ts
- 上传扫描：upload-scanner.ts

### 其他完整迁移
- CLI（6 文件）/ 多租户（插件+路由+3表）/ OpenAPI SDK（generate-sdk.ts）/ i18n（5 语言）/ 定时任务（5 cron，2/5 接入）

---

## 七、修复优先级建议（v9 更新）

### P0（阻断）— ✅ 全部已修复
~~小程序端~~ → 已在 `0ad7afd7` 新增 apps/miniapp/

### P1（高）— ✅ 全部已修复
1. ~~数据库缺失表~~ → 已在 `60cf52c3` 补齐 14 张表
2. ~~agents Coze 字段~~ → 已在 `e6af19a8` 补齐 14 个字段
3. ~~缓存韧性~~ → 已在 `30ba633a` 新增 cache-resilience.ts

### P2（中，按业务需要）— 剩余 6 项
1. **定时任务 3/5 backing service**：补建 heat_stats_service / alert_service / archive_tables
2. **admin MOCK 页面**：将 api-usage / monitoring-dashboard / database-optimization 等 14 个纯 MOCK 页面的 `Promise.resolve(MOCK_...)` 接通后端 API
3. **7 个用户端页面**：补建 AiWorld / Tools / Share / MCPUseProject / SecurityAuditDashboard / ApiTestPage / Ranking(用户侧)（另 3 项部分映射，按需评估）
4. **CI 能力**：在新架构中新增 knip / openapi-check / visual-regression / miniapp-preview
5. **数据库基础设施**：读写分离 / 慢 SQL 杀手 / 连接保活
6. **运维能力**：N+1 检测 / Prompt 注入防护 / 分布式事务

### P3（低，可选）
- ELK 日志管线
- 实验性运维脚本
- Electron 桌面端

---

## 八、关键文件路径索引

### 新架构核心文件
- 路由注册：[server.ts](file:///g:/IHUI-AI/apps/api/src/server.ts)（54 路由 + 35 插件 register）
- 插件目录：`apps/api/src/plugins/`（35 个插件）
- 服务目录：`apps/api/src/services/`（17 service + clawdbot/ 20 + workspace-ai-service.ts）
- AI 前端组件：`apps/web/src/components/ai/`（24）+ `ai-generation/`（17）+ `mcp/`（9）
- 登录组件：`apps/web/src/components/login/`（8）
- 设置组件：`apps/web/src/components/settings/`（7）
- 小程序端：`apps/miniapp/`（~90 文件，**75 页面**）
- 监控目录：`monitoring/`（otel-collector + grafana 3仪表盘 + prometheus + alerts）
- CLI：`apps/cli/src/`（6 文件）
- SDK 生成：`scripts/generate-sdk.ts`
- i18n：`apps/web/messages/`（5 语言文件）

### v9/v10 新增文件
- [cache-resilience.ts](file:///g:/IHUI-AI/apps/api/src/plugins/cache-resilience.ts) — 缓存韧性（163 行）
- [xss-protection.ts](file:///g:/IHUI-AI/apps/api/src/plugins/xss-protection.ts) — XSS 全局防护（97 行）
- [learn-extra-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/learn-extra-extended.ts) — 9 张学习表
- [agents-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/agents-extended.ts) — 3 表 + 14 Coze 字段
- [exam-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/exam-extended.ts) — 错题本表
- [user-auth-info.ts](file:///g:/IHUI-AI/packages/database/src/schema/user-auth-info.ts) — 用户认证信息表
- [apps/miniapp/](file:///g:/IHUI-AI/apps/miniapp/) — 小程序端（~90 文件，75 页面）

---

## 九、方法论与教训

### 10 轮验证共纠正 28 个误报

| 轮次 | 误报数 | 关键纠正 |
|------|--------|---------|
| R1-R4 | 16 | AI Workspace/clawdbot/Chat 模型/退款/客服/WS/安全等全部存在 |
| R5 | 5 | 支付幂等/定时任务/AI成本/OTel/安全审计 CI 全部存在 |
| R6-R8 | 4 | ModelManager/PhoneBinding/CLI/多租户/OpenAPI SDK 全部存在 |
| R9 | 3 | AI 前端 50 组件/登录 8 组件/设置 7 组件全部存在（最严重误报） |

### R10 教训

1. **grep 关键词语言陷阱**：v8 用英文 `circuit_breaker` 搜索零匹配就断定缺失，但文件内用中文"熔断器"。**教训**：中文项目必须同时搜索中英文关键词。

2. **报告时效性**：v8 基于 `fd778de5`，但此后 5 个提交修复了全部 B/H 缺失。**教训**：长期目标驱动任务必须在最终交付前重新验证 HEAD，不能依赖历史快照。

3. **v8 存在假阴性**：v8 只识别了 B-1 一个阻断项，但 `30ba633a` 提交信息显示有 B-1/B-2/B-3 三个阻断项（B-2=缓存韧性，B-3=CSRF/限流）。**教训**：仅从代码缺失角度分析不够，还需从旧架构功能完整性角度交叉验证。

### R11 新增教训

4. **提交消息可信度陷阱**：`6ed35c14` 声称"所有34项缺失已100%修复完成"，但 R11 代码级验证发现 6 项中严重度缺失全部仍存在。`f24d0be3` 声称"补齐后端迁移"实际仅改 2 文件 5 行。**教训**：必须以 `git diff --stat` 和代码内容为权威证据，提交消息仅为线索，不可作为完成依据。

5. **连续验证的必要性**：v9→v10 间新增 6 个提交，其中仅 miniapp 扩展（15→75 页）是真实改进，其余为微调或夸大。**教训**：每次 goal continuation 都必须重新验证 HEAD，即使上轮已完成。

---

**结论**：经过 12 轮代码级验证，新架构的迁移完整度**极高**。R11 确认：全部阻断级和高严重度缺失已修复；miniapp 已从 15 页扩展到 75 页完整迁移。R12 精确映射了 M-3 的 11 个用户端页面（1 已映射 + 3 部分映射 + 7 真实缺失）。**剩余 6 个中严重度缺失全部仍未修复**（定时任务 backing 3/5 + 14 个 admin MOCK 页面 + 7 个用户端页面真实缺失 + CI 能力 + DB 基础设施 + 运维能力），均为非阻断项。⚠️ 注意：commit `6ed35c14` 声称"100%修复完成"经 R11 代码级验证为**不实**，6 项中严重度缺失仍需按业务需要逐步补齐。
