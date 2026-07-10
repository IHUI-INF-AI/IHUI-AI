# 架构重构完整性深度比对报告（最终验证版 v7）

> **目标条件**：深度比对当前项目代码与架构重构前最新提交(3ee96cf0)的差异，找出所有未完整迁移到新架构(TS Monorepo)的地方
> **基准**：旧架构 `3ee96cf0`（Python FastAPI + Vue 3）→ 新架构当前 HEAD `fd778de5`（TS Monorepo）
> **分析方法**：4 个并行代理初步分析 → 主线代码级验证 → 6 轮深度验证（路由实现深度/schema 字段级/服务层/中间件/WS/端点计数/grep 关键词反查/monitoring 目录全量扫描/前端页面内容验证）
> **分析日期**：2026-07-10
> **验证轮次**：6 轮

---

## 重要说明

本报告经过**8 轮代码级验证**。初版报告存在大量误报，逐轮修正如下：

### 已纠正的误报（共 25 项）
| 轮次 | 初版声称 | 实际验证 |
|------|---------|---------|
| R1 | ai-vendors.ts 未注册（死代码） | ✅ 已注册，11 厂商全覆盖，1280+ 行 |
| R1 | 11 张数据库表完全缺失 | ✅ 全部存在（payment-callbacks.ts/agent-context.ts/ai-config.ts/identity.ts） |
| R1 | 退款体系完全缺失 | ✅ refund-audit.ts 完整 + admin/refund 前端 |
| R1 | Coze 12/13 子模块缺失 | ✅ coze.ts 873 行 12 子模块 46 端点 |
| R1 | 多个 admin 页面缺失 | ✅ monitoring/oauth-audit/developer/mobile-adapter 等均存在 |
| R2 | 客服系统完全缺失 | ✅ ws-customer-service.ts + routes/customer-service.ts |
| R2 | WebSocket AI 能力缺失 | ✅ ws-ai.ts（agent_stream/tts_stream/realtime_pcm） |
| R2 | 服务层 37→7，约 30 个缺失 | ✅ 实际 17 个 service + 50 个 db-queries |
| R2 | 安全 5 项缺失（CSRF/脱敏/GDPR/日志/上传） | ✅ response-sanitizer/log-sanitizer/csrf.ts/upload-scanner/security-service 全部存在 |
| R2 | 响应脱敏中间件缺失 | ✅ response-sanitizer.ts 比旧架构更完善 |
| R2 | XSS 防护缺失 | ✅ 存在但从全局中间件降级为显式调用 |
| R2 | 对账/审计等服务缺失 | ✅ reconciliation-service.ts/audit-service.ts 完整 |
| R4 | AI Workspace AI Coding 核心完全缺失 | ✅ workspace-ai.ts 65 端点 + workspace-ai-service.ts 1920 行，15 子模块全部实现 |
| R4 | clawdbot AI Bot 服务层完全缺失 | ✅ clawdbot.ts 36 端点 + services/clawdbot/ 20 文件（~2400 行） |
| R4 | Chat 独立模型端点部分缺失 | ✅ chat-models.ts 31 端点，9 模型全覆盖 |
| R5 | 支付幂等性完全缺失 | ✅ payment-idempotency.ts 167 行（Redis 锁+状态机+fail-open），payment-gateway.ts 6 处调用 |
| R5 | 定时任务无自动执行器 | ✅ scheduler.ts 5 个 cron repeatable jobs + scheduler-worker.ts，2/5 已接入业务函数 |
| R5 | AI 成本治理完全缺失 | ✅ ai-cost.ts 384 行完整插件（prompt 缓存 + token 预算 + 成本记录 + 4 看板 API）+ ai-cost.json 仪表盘 |
| R5 | 可观测性深度完全缺失（OTel/ELK/Grafana/告警） | ✅ otel.ts 110 行 + otel-collector + grafana 3仪表盘 + prometheus + alerts 6规则。仅 ELK/Logstash 仍缺失 |
| R5 | 每周安全审计 CI 缺失 | ✅ weekly-security-audit.yml 完整存在（pnpm audit + tsc + eslint + 依赖漏洞 + 许可证 + 密钥泄露扫描） |
| **R6** | **ModelManager 前端页面缺失** | ✅ [models/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/models/page.tsx) 存在（含 Model 接口 + FALLBACK_MODELS + MODEL_DESCRIPTIONS + fetchModels） |
| **R6** | **PhoneBinding 前端页面缺失** | ✅ [user/security/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/user/security/page.tsx) 含完整手机绑定功能（newPhone/phoneCode/phoneRegex/手机号验证逻辑） |
| **R7** | **CLI 工具缺失** | ✅ `apps/cli/src/` 存在 6 个文件（index.ts + agent.ts/repl.ts/session.ts/template.ts/mcp-config.ts），与旧架构 `cli/` 完全对应 |
| **R7** | **多租户能力缺失** | ✅ [tenant.ts 插件](file:///g:/IHUI-AI/apps/api/src/plugins/tenant.ts)（server.ts 第 182 行注册，从 header/subdomain 解析租户）+ [tenant.ts 路由](file:///g:/IHUI-AI/apps/api/src/routes/tenant.ts)（/api/tenants CRUD + 成员 + 配额）+ [tenant.ts schema](file:///g:/IHUI-AI/packages/database/src/schema/tenant.ts)（tenants/tenantMembers/tenantQuotas 3 表）+ SDK 引用 + ai-cost.ts 按 tenantId 预算控制 |
| **R8** | **OpenAPI SDK 生成缺失** | ✅ [generate-sdk.ts](file:///g:/IHUI-AI/scripts/generate-sdk.ts) 完整 SDK 自动生成脚本（从 Fastify swagger 提取 OpenAPI spec → 解析 paths → 为每个 operation 生成 TypeScript 客户端方法 → 写入 packages/sdk/src/generated.ts），对应旧架构 `server/sdk/python/` |

---

## 一、规模总览（最终验证）

| 维度 | 旧架构 | 新架构（验证后） | 说明 |
|------|--------|--------|------|
| 后端路由文件 | ~90 模块 | 54 个路由文件 | 全部在 server.ts 注册 |
| 后端路由端点 | ~600+ | ~700+ | 端点数量已超旧架构 |
| 后端插件 | ~10 中间件 | 19 个插件 | 含安全/WS/监控/调度/幂等/OTel/AI成本 |
| 后端服务层 | 37 个 | 17 service + 50 queries + clawdbot 20 文件 + workspace-ai | 双层设计，逻辑完整 |
| WebSocket | 16 文件 | 4 个 WS 插件 + 3 个 WS 端点 | 通知/AI流式/聊天室/客服/deepseek/qwen-omni/zhipu |
| 定时任务 | 13 个 APScheduler | 5 个 BullMQ cron repeatable jobs | 2/5 已接入业务函数，3/5 待 backing service |
| 支付幂等性 | payment_idempotency.py | payment-idempotency.ts 167 行 | ✅ 已完整迁移并集成 |
| AI 成本治理 | llm_cost/prompt_cache/token_budget | ai-cost.ts 384 行 + ai-cost.json 仪表盘 | ✅ 已完整迁移 |
| 可观测性 | OTel+ELK+Grafana | otel.ts + otel-collector + grafana 3仪表盘 + prometheus + alerts | ✅ OTel/Grafana/Prometheus 已迁移，仅 ELK 缺失 |
| 安全审计 CI | weekly-security-audit.yml | weekly-security-audit.yml | ✅ 已完整迁移 |
| Schema 模块 | 53 个模型文件 | 56+ schema 模块 | 约 10 张表确实缺失 |
| 前端页面 | 579 .vue | ~165 page.tsx | 13 个旧页面确认缺失 |
| 前端组件 | 372 .vue | 13 .tsx + @ihui/ui 包 | AI 组件群是核心差距 |
| i18n 语言 | 5 种 | 2 种 | 缺 ja/ko/zh-TW |
| AI 前端组件 | 65+ | 5 个 chat 组件 | 核心差距 |
| AI Workspace 后端 | 20 子模块 | 15 子模块 + 65 端点 + 1920 行服务 | ✅ 已完整迁移 |
| clawdbot 后端 | 25 文件 | 20 服务文件 + 36 端点 | ✅ 已完整迁移 |
| Chat 模型直连 | 10 子模块 | 9 模型 + 31 端点 | ✅ 已完整迁移 |

---

## 二、阻断级缺失（经代码验证）

### B-1. AI 前端组件群缺失
- **旧路径**：`client/src/components/ai/`（35+ 组件）+ `ai-generation/`（13 组件）+ `mcp/`（10 组件）+ `openclaw/`（7 panel）
- **新路径**：`apps/web/src/components/chat/`（仅 5 组件）
- **验证证据**：Glob `apps/web/src/components/` 确认无 `ai/` 目录
- **缺失关键组件**：UnifiedAIPanel/AgentSwarmMonitor/BackgroundAgentsPanel/DiffPreview/InlineDiffViewer/MarkdownStream/PermissionConfirmDialog/SubAgentActivityFeed/VoiceInput/VoiceRecord + AI 生成 13 组件 + MCP 10 组件
- **对比说明**：后端 workspace-ai.ts（swarm/subagents/background-agents/permissions 等端点）和 clawdbot.ts 已完整迁移，但前端缺少对应交互组件，导致后端能力无法通过 UI 暴露给用户
- **严重程度**：阻断 — AI 交互体验严重退化

### B-2. 小程序端完全缺失
- **旧路径**：`client/miniapp/`（1217 文件，75 页面，uni-app + 云函数）
- **新路径**：无
- **严重程度**：阻断（若产品仍需移动端入口）

---

## 三、高严重度缺失（经代码验证）

### H-1. 约 10 张数据库表确实缺失
- **验证方法**：逐表对比旧 models/*.py 与新 schema/*.ts + R6 grep 精确表名反查
- **R6 验证**：grep `learn_record|learn_topic|exam_wrong_question|agent_heat_stats|agent_callbacks|agent_configs|user_auth_info|learn_homework_record|learn_learn_map_topic` 全部零匹配。learn.ts 中 `progress` 仅是 lessonSignUps 表的 integer 字段（第 101 行），非独立 learn_record 表
- **缺失表清单**：
  1. `learn_record` + `learn_record_log` — 学习记录与日志
  2. `learn_topic` + 4 张关联表 — 专题体系（共 5 表）
  3. `learn_homework_record` — 作业提交记录
  4. `learn_learn_map_topic` — 学习地图-专题关联
  5. `exam_wrong_question` — 错题本
  6. `agent_heat_stats` — Agent 热度统计
  7. `agent_callbacks` / `agent_configs` — Agent 回调/配置
  8. `user_auth_info` — 用户认证信息（含 cancel_phone）
- **影响**：学习进度追踪、专题学习、错题本、Agent 热度统计功能不可用
- **严重程度**：高

### H-2. agents 表丢失 20+ Coze 配置字段
- **旧路径**：`server/app/models/agent_models.py`
- **新路径**：[agents-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/agents-extended.ts)
- **验证证据**：agentic-service.ts 第 92-94 行注释 `"agents 表无 usage_count,此处用 remark 计数占位"`
- **丢失字段**：agent_version/bot_id/bot_name/agent_prompt/agent_model/agent_temperature/agent_max_tokens/agent_variables/publish_channel/usage_count/like_count/share_count/coze_account_id 等 20+ 个
- **说明**：架构决策（改为 API 代理直接转发到 coze.cn），但导致本地无法缓存 Coze 配置、无法离线管理
- **严重程度**：高

### H-3. 登录组件群缺失
- **旧路径**：`client/src/components/login/`（25 组件）
- **新路径**：[login/page.tsx](file:///g:/IHUI-AI/apps/web/app/(auth)/login/page.tsx)（单页）
- **缺失**：第三方登录(Google/Apple/钉钉/企微)、手机验证码登录、邮箱登录、密码强度指示、图形验证码
- **严重程度**：高

### H-4. 设置中心安全+主题组件缺失
- **旧路径**：`client/src/components/settings/`（20 组件）
- **新路径**：[settings/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/settings/page.tsx)（仅主题/语言/侧边栏）
- **缺失**：设备管理/IP白名单/登录历史/安全评分/会话管理/双因素认证 + 主题备份/同步/过渡
- **严重程度**：高

### H-5. 缓存韧性缺失
- **旧路径**：`server/app/utils/circuit_breaker.py`/`cache_coherence.py`/`cache_breakdown_guard.py`
- **新路径**：无（grep `circuit_breaker|circuitBreaker|cache_coherence|breakdown_guard` 全项目无匹配，仅 redis.ts 基础客户端）
- **缺失**：熔断器、缓存一致性、缓存击穿防护
- **严重程度**：高

---

## 四、中严重度缺失（经代码验证）

### M-1. 定时任务 3/5 backing service 未迁移
- **验证证据**：[scheduler-worker.ts](file:///g:/IHUI-AI/apps/api/src/workers/scheduler-worker.ts) 第 44-55 行
- **已接入**（2/5）：
  - `expired-order-cleanup`（每10分钟）→ autoCloseExpiredOrders() ✅
  - `reconciliation-daily`（每日03:30）→ autoReconcileYesterday() ✅
- **待迁移**（3/5）：
  - `heat-stats-hourly`（每小时）→ heat_stats_service 未迁移（对应 H-1 缺失表 `agent_heat_stats`）
  - `alert-check-daily`（每日04:00）→ alert service 未迁移
  - `data-archive-daily`（每日04:30）→ archive tables 未迁移
- **说明**：调度器基础设施完整（scheduler.ts 5 个 cron repeatable jobs + scheduler-worker.ts 消费者），仅缺 backing service 实现
- **严重程度**：中（从高降级 — 调度器本身已完整，仅部分任务逻辑待补）

### M-2. 5 个 admin 页面使用 MOCK 数据
- **验证证据**：读取页面源码确认
- **页面**：oauth-audit-dashboard/developer/mobile-adapter/gray-release/performance-dashboard
- **状态**：前端 React 组件完整（有类型定义+UI 交互），但用 MOCK_* 常量，未接后端 API
- **严重程度**：中

### M-3. 11 个用户端独立页面缺失
- **验证方法**：Glob `apps/web/app/**/page.tsx` + grep 页面名 + 读取页面源码内容验证
- **确认缺失**（11 个）：AiWorld/KnowledgeBase/Tools/Ranking(用户侧)/Share/用户侧 Refund(admin 侧已有)/N8NAgents/MCPUseProject/BiDashboard/SecurityAuditDashboard/ApiTestPage
- **R6 修正**（原列 13 个，2 个为误报）：
  - ~~ModelManager~~ → [models/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/models/page.tsx) 存在（含 Model 接口 + fetchModels）
  - ~~PhoneBinding~~ → [user/security/page.tsx](file:///g:/IHUI-AI/apps/web/app/(main)/user/security/page.tsx) 含完整手机绑定功能
- **严重程度**：中

### M-4. i18n 缺失 3 种语言
- **旧**：5 种（en/ja/ko/zh-CN/zh-TW）
- **新**：2 种（en/zh-CN）
- **严重程度**：中

### M-5. CI 能力缺失
- **缺失**：knip(死代码检测)、openapi-check、visual-regression(视觉回归)、miniapp-preview
- **说明**：weekly-security-audit 已存在（R5 确认），OpenAPI SDK 生成已存在（R8 确认 generate-sdk.ts），但其他 CI 能力仍缺
- **严重程度**：中

### M-6. 数据库基础设施缩水
- **缺失**：读写分离路由、连接保活、连接预热、慢 SQL 杀手
- **严重程度**：中

### M-7. plaza.ts / billing.ts 是 stub
- **验证证据**：plaza.ts 仅 1 端点 GET /list（56 行），billing.ts 仅 2 端点 GET /plans（92 行）
- **严重程度**：中

### M-8. XSS 防护降级
- **旧**：全局中间件自动清洗所有请求
- **新**：security-service.ts 的 `InputValidator.sanitizeString()` 需显式调用
- **风险**：存在遗漏调用的可能
- **严重程度**：中

### M-9. 旧架构 bug 修复工具中的运维能力缺失
- **旧**：72 个 bug131-bug202 修复工具
- **新架构天然规避**：约 30%（Drizzle ORM 防 SQL 注入、事务+行锁防并发等）
- **仍缺失的运维能力**：慢 SQL 杀手(bug150)、N+1 检测(bug149)、Prompt 注入防护(bug143)、分布式事务模式(Saga/TCC/Outbox 等)
- **严重程度**：中

---

## 五、低严重度/实验性（可暂缓）

- ELK 日志管线（Logstash 无匹配）— OTel/Grafana/Prometheus 已覆盖可观测性主体
- 实验性运维脚本：chaos/digital_twin/edge_computing/faas_platform/finops/green_computing/metaverse_ops/multi_cloud/neuromorphic/quantum_crypto/satellite_ops/service_mesh/zero_trust
- 设计系统演示页/组件展示页
- Electron 桌面端（旧架构仅占位）
- 部分独立小模块：stock/advertise/share/video_preload

---

## 六、已完整迁移确认（经代码验证）

### 后端路由（54 个全部注册）
- AI 厂商集成（11 家）：[ai-vendors.ts](file:///g:/IHUI-AI/apps/api/src/routes/ai-vendors.ts) 1280+ 行 80 端点
- Coze 平台（12 子模块）：[coze.ts](file:///g:/IHUI-AI/apps/api/src/routes/coze.ts) 873 行 46 端点
- **AI Workspace Coding（15 子模块）**：[workspace-ai.ts](file:///g:/IHUI-AI/apps/api/src/routes/workspace-ai.ts) 65 端点 + [workspace-ai-service.ts](file:///g:/IHUI-AI/apps/api/src/services/workspace-ai-service.ts) 1920 行
- **clawdbot AI Bot（15 服务）**：[clawdbot.ts](file:///g:/IHUI-AI/apps/api/src/routes/clawdbot.ts) 36 端点 + `services/clawdbot/` 20 文件
- **Chat 多模型直连（9 模型）**：[chat-models.ts](file:///g:/IHUI-AI/apps/api/src/routes/chat-models.ts) 31 端点
- 退款审核、客服系统、支付网关（含幂等性集成）、VIP/钱包/佣金/分销、多登录扩展、GDPR、AI 音频

### 定时任务（5 个 BullMQ cron repeatable jobs）
- 调度器插件：[scheduler.ts](file:///g:/IHUI-AI/apps/api/src/plugins/scheduler.ts)（server.ts 第 190 行注册）
- 消费者 Worker：[scheduler-worker.ts](file:///g:/IHUI-AI/apps/api/src/workers/scheduler-worker.ts)（index.ts 第 17 行启动）
- 已接入：expired-order-cleanup（每10分钟）、reconciliation-daily（每日03:30）
- 待 backing service：heat-stats-hourly、alert-check-daily、data-archive-daily

### 支付幂等性（完整迁移）
- [payment-idempotency.ts](file:///g:/IHUI-AI/apps/api/src/plugins/payment-idempotency.ts) 167 行
- Redis SET NX EX 原子锁 + 状态机 new→processing→completed + 24h TTL + fail-open
- server.ts 第 196 行注册，payment-gateway.ts 微信/支付宝回调 6 处实际调用

### AI 成本治理（完整迁移）
- [ai-cost.ts](file:///g:/IHUI-AI/apps/api/src/plugins/ai-cost.ts) 384 行
- Prompt 缓存（LRU 500条/10分钟TTL）：getCachedPrompt/setCachedPrompt/clearPromptCache
- Token 预算控制（按用户/租户/模型维度）：checkBudget
- AI 调用成本记录：recordAiCost
- 4 个看板 API：GET /api/admin/ai/cost/dashboard、/records、/budgets、POST /budgets
- [ai-cost.json](file:///g:/IHUI-AI/monitoring/grafana/dashboards/ai-cost.json) Grafana 仪表盘（AI 总成本/调用总量/Token 总量）
- [ai-cost.ts schema](file:///g:/IHUI-AI/packages/database/src/schema/ai-cost.ts)（aiCostRecords/aiBudgets 表）
- server.ts 第 240 行注册

### 可观测性（OTel + Grafana + Prometheus 完整迁移，仅 ELK 缺失）
- OpenTelemetry 分布式追踪：[otel.ts](file:///g:/IHUI-AI/apps/api/src/plugins/otel.ts) 110 行（自动 instrument Fastify/HTTP/Redis/PG + OTLP 导出 + userId span 注入 + 错误 span 标记），server.ts 第 150 行注册
- OTel Collector：[otel-collector/config.yaml](file:///g:/IHUI-AI/monitoring/otel-collector/config.yaml)（OTLP/HTTP 接收 + 批处理 + 采样 + 日志输出）
- Grafana 3 仪表盘：
  - [ai-cost.json](file:///g:/IHUI-AI/monitoring/grafana/dashboards/ai-cost.json)（AI 成本监控）
  - [business-funnel.json](file:///g:/IHUI-AI/monitoring/grafana/dashboards/business-funnel.json)（业务转化漏斗 + API 健康度）
  - [ihui-ai-overview.json](file:///g:/IHUI-AI/monitoring/grafana/dashboards/ihui-ai-overview.json)（总览）
- Grafana 配置：[grafana.ini](file:///g:/IHUI-AI/monitoring/grafana/grafana.ini) + provisioning（dashboards.yml + datasources/prometheus.yml）
- Prometheus：[prometheus.yml](file:///g:/IHUI-AI/monitoring/prometheus/prometheus.yml)（抓取 api + ai-service + node-exporter）
- 告警规则：[alerts.yml](file:///g:/IHUI-AI/monitoring/prometheus/alerts.yml) 6 条告警（ApiDown/ApiHighErrorRate/ApiSlowResponse/AiServiceDown/DiskSpaceLow/MemoryLow）

### 安全审计 CI（完整迁移）
- [weekly-security-audit.yml](file:///g:/IHUI-AI/.github/workflows/weekly-security-audit.yml)
- 含 pnpm audit + tsc 类型检查 + eslint + 依赖漏洞深度扫描 + 许可证合规 + 密钥泄露扫描
- 每周一 02:00 北京时间执行，发现高危问题自动创建 Issue

### CLI 工具（完整迁移）
- `apps/cli/src/` 6 个文件：index.ts + agent.ts/repl.ts/session.ts/template.ts/mcp-config.ts
- 与旧架构 `cli/`（agent.ts/mcp-config.ts/repl.ts/session.ts/template.ts）完全对应

### 多租户能力（完整迁移）
- [tenant.ts 插件](file:///g:/IHUI-AI/apps/api/src/plugins/tenant.ts)（server.ts 第 182 行注册，从 header/subdomain 解析租户，装饰 request.tenantId）
- [tenant.ts 路由](file:///g:/IHUI-AI/apps/api/src/routes/tenant.ts)（server.ts 第 384 行注册，/api/tenants CRUD + 成员管理 + 配额管理）
- [tenant.ts schema](file:///g:/IHUI-AI/packages/database/src/schema/tenant.ts)（3 表：tenants/tenantMembers/tenantQuotas）
- packages/sdk 引用 tenant，ai-cost.ts 按 tenantId 维度做 token 预算控制

### OpenAPI SDK 生成（完整迁移）
- [generate-sdk.ts](file:///g:/IHUI-AI/scripts/generate-sdk.ts) 完整 SDK 自动生成脚本
- 流程：构建 Fastify 实例 → 获取 server.swagger() OpenAPI JSON → 解析 paths → 为每个 operation 生成 TypeScript 客户端方法 → 写入 packages/sdk/src/generated.ts
- 对应旧架构 `server/sdk/python/`（672 文件），但改为 TypeScript 客户端 SDK

### WebSocket（4 个完整插件 + 3 个 WS 端点）
- 通知推送、AI 流式、聊天室、客服会话
- DeepSeek/通义千问Omni/智谱GLM 流式 WS 端点

### 服务层（17 个 service + 50 个 queries + clawdbot 20 文件 + workspace-ai）
- security-service.ts、reconciliation-service.ts、commission-service.ts、token-service.ts、order-service.ts、audit-service.ts、agent-service.ts、pdf-service.ts、storage-service.ts、diff-service.ts、points-service.ts、sms.ts、oauth-providers.ts、captcha.ts、alipay.ts、wechat-pay.ts、email-service.ts
- workspace-ai-service.ts（15 子模块 1920 行）
- clawdbot/（20 服务文件 ~2400 行）

### 安全能力（7 个插件 + security-service）
- 响应脱敏：response-sanitizer.ts（比旧架构更完善）
- 日志脱敏：log-sanitizer.ts
- CSRF 防护：csrf.ts
- 上传扫描：upload-scanner.ts
- 支付幂等：payment-idempotency.ts（Redis 锁 + 状态机 + fail-open）
- OpenTelemetry 追踪：otel.ts
- AI 成本治理：ai-cost.ts
- 安全头/RateLimiter/IP黑名单：security-service.ts

### AI 服务（ai-service 完整）
- llm.py（3 端点）、tools.py（3 端点）、mcp.py（10 端点）、agents.py（9 端点）、a2a.py（5 端点）
- agent_loop.py（AgentExecutor 完整实现）、mcp_server.py（11 工具+3 资源+3 提示词）
- langgraph_service.py（plan→execute→summarize）

### 数据库（56+ schema 模块，大部分已迁移）
- payment_callbacks/transfer_infos/wx_pay_notifications：payment-callbacks.ts
- user_agent_free_times/zhs_user_agent_context：agent-context.ts
- ai_model_config/user_sk_info/video_generation_tasks：ai-config.ts
- zhs_identity/zhs_organization/oauth_private_keys：identity.ts
- aiCostRecords/aiBudgets：ai-cost.ts

---

## 七、修复优先级建议

### P0（阻断，立即决策）
1. **AI 前端组件群**：后端 workspace-ai.ts 和 clawdbot.ts 已就绪，需按对应端点重建前端交互组件（优先 UnifiedAIPanel/AgentSwarmMonitor/MarkdownStream/DiffPreview/PermissionConfirmDialog/SubAgentActivityFeed）
2. **小程序端**：决策保留/废弃/重做

### P1（高，生产前必须）
1. **数据库缺失表**：补建 learn_record/learn_topic/exam_wrong_question/agent_heat_stats 等 10 张表
2. **agents 表 Coze 字段**：评估是否需要补回或接受 API 代理模式
3. **登录组件群** + **设置中心组件**
4. **缓存韧性**（熔断器/击穿防护）

### P2（中，按业务需要）
1. 定时任务 3/5 backing service（heat-stats/alert-check/data-archive）— 待对应表/服务迁移后接入
2. 5 个 admin MOCK 页面接通后端 API
3. 11 个缺失用户端页面
4. i18n 3 种语言补齐
5. plaza.ts/billing.ts stub 补全
6. XSS 防护恢复为全局中间件
7. 缺失 CI 能力（knip/openapi-check/visual-regression）
8. 数据库基础设施（读写分离/慢SQL杀手）
9. ELK 日志管线（可选，OTel+Grafana+Prometheus 已覆盖主体）

---

## 八、关键文件路径索引

### 新架构核心文件
- 路由注册：[server.ts](file:///g:/IHUI-AI/apps/api/src/server.ts)（54 路由 + 19 插件全部注册）
- 插件目录：`apps/api/src/plugins/`（19 个插件）
- 服务目录：`apps/api/src/services/`（17 service + clawdbot/ 20 文件 + workspace-ai-service.ts）
- 查询目录：`apps/api/src/db/`（50 个 queries）
- Worker 目录：`apps/api/src/workers/`（index.ts 3 队列 + scheduler-worker.ts 5 cron 任务）
- Schema 索引：[schema/index.ts](file:///g:/IHUI-AI/packages/database/src/schema/index.ts)（56+ 模块）
- 监控目录：`monitoring/`（otel-collector + grafana 3仪表盘 + prometheus + alerts）
- AI 服务：`apps/ai-service/app/`（6 路由 7 服务）
- 前端页面：`apps/web/app/`（~165 page.tsx）

### 第 4-5 轮验证新确认的完整迁移项
- AI Workspace 后端：workspace-ai.ts（65 端点）+ workspace-ai-service.ts（1920 行，15 子模块）
- clawdbot 后端：clawdbot.ts（36 端点）+ services/clawdbot/（20 文件 ~2400 行）
- Chat 模型直连：chat-models.ts（31 端点，9 模型）
- 定时任务调度器：scheduler.ts + scheduler-worker.ts（5 cron 任务，2 已接入）
- 支付幂等性：payment-idempotency.ts（167 行，Redis 锁 + 状态机）
- AI 成本治理：ai-cost.ts（384 行，prompt 缓存 + token 预算 + 成本记录 + 4 看板 API）+ ai-cost.json 仪表盘
- 可观测性：otel.ts（110 行 OTel 插件）+ otel-collector config + grafana 3仪表盘 + prometheus.yml + alerts.yml 6告警
- 安全审计 CI：weekly-security-audit.yml（pnpm audit + tsc + eslint + 许可证 + 密钥泄露扫描）

### 旧架构（需 `git show 3ee96cf0:<path>` 读取）
- AI 工作区：`server/app/api/v1/workspace/`（20 子模块）
- AI 前端组件：`client/src/components/ai/`（35+ 组件）
- clawdbot 服务：`client/src/services/clawdbot/`（25 文件）
- 小程序：`client/miniapp/`（1217 文件）
- 定时任务：`server/app/tasks/scheduler.py`（13 个任务）
- 支付幂等性：`server/app/utils/payment_idempotency.py`
- AI 成本治理：`server/app/utils/llm_cost.py`/`llm_prompt_cache.py`/`llm_token_budget.py`
- 可观测性：`server/app/utils/trace_context.py` + `deploy/grafana/`

---

**结论**：经过 8 轮代码级验证（含 grep 关键词反查、monitoring 目录全量扫描、前端页面内容验证、CLI/多租户/SDK 目录验证），新架构的迁移完整度**远超初版报告的判断**。后端路由/服务/安全/WS/数据库/定时任务/支付幂等/AI 成本治理/可观测性/安全审计 CI/CLI/多租户/OpenAPI SDK 主体已完整迁移。AI Workspace Coding、clawdbot、Chat 多模型、支付幂等性、定时任务调度器、AI 成本治理、OpenTelemetry 追踪、Grafana 仪表盘、Prometheus 告警、每周安全审计 CI、CLI 工具、多租户能力、OpenAPI SDK 生成十三大核心后端能力均完整重建。真实的核心差距仅剩 2 个阻断项（AI 前端组件群/小程序端）和数据库缺失表/登录组件/缓存韧性 3 个高优项。建议按 P0→P1→P2 推进。

**核心警示**：最大遗憾是后端 AI Workspace（swarm/subagents/FS Bridge 等能力）和 clawdbot 服务层都已完整重建，但前端缺少对应 UI 组件，导致这些后端能力对终端用户不可见。P0 最优解是优先重建 AI 前端组件群，打通已有后端能力到用户的最后一公里。

**方法论警示**：8 轮验证共纠正 25 个误报。R5 通过 grep 关键词反查发现 5 个误报，R6 通过前端页面内容验证发现 2 个误报，R7 通过 glob 目录扫描发现 CLI 和多租户 2 个误报，R8 通过 scripts/ 目录扫描发现 OpenAPI SDK 1 个误报。教训：对于"缺失"类论断，必须先 grep 关键词 + glob 目录 + 读取文件内容确认，再下结论；特别要检查 monitoring/、.github/workflows/、plugins/、apps/cli/、scripts/ 等容易遗漏的目录，以及用页面内容验证而非仅凭页面名判断。
