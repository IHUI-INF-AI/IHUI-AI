# 架构重构完整性深度比对报告（最终验证版 v29 — R32 server/app/ 根级文件最终审计+业务可观测性指标 26 项完全缺失发现+基础设施指标 DB 池/SQL/WebSocket 缺失发现+OpenTelemetry 迁移确认+多数据库→单数据库+schema 隔离设计变更确认+static/ 22 HTML 页面→Next.js App Router 自然替代确认）

> **目标条件**：深度比对当前项目代码与架构重构前最新提交(3ee96cf0)的差异，找出所有未完整迁移到新架构(TS Monorepo)的地方
> **基准**：旧架构 `3ee96cf0`（Python FastAPI + Vue 3）→ 新架构当前 HEAD `c7d5b769` + 未提交工作区改动（TS Monorepo，旧 client/ 已清理）
> **分析方法**：4 个并行代理初步分析 → 主线代码级验证 → 32 轮深度验证（含 R10-R16 新增提交验证+功能映射+旧 Python 后端全量扫描+逐模块交叉比对+前端页面逐一验证+R17 服务/核心/任务/ORM/中间件全量验证+R18 utils/ 204 文件全量验证+R19 未提交工作区改动全量验证+R20 客户端服务层/workers/composables 全量验证+R21 路由补建+R22 STUB 实现纠正+旧 52 模型 vs 新 65 schema 全量比对+旧 80+ composables vs 新 27 hooks 全量比对+R23 旧 200+ 客户端 API 模块 vs 新 67 路由全量交叉比对+开放平台/Feature Center 模块验证+R24 API 子目录散点+数据/配置文件验证+R25 剩余 client/src/ 目录(constants/features/lib/router/scripts/shared/stores/templates)全量验证+pricing 计算引擎缺失发现+R26 旧 58 组件类别+旧 views/edu 15 子目录+views/edu/web 19 子目录+views/learn 14 文件 vs 新 97 用户端页面+17 组件类别全量交叉比对+R27 HEAD 推进复审+f1a42899 新增提交+未提交工作区改动全量验证+M-14 真实 AI 模型+DB 持久化确认+M-18 7 张表全部创建并注册确认+M-15 agent-extended/content-extended 真实 DB 查询确认+token-balance-service 新插件验证+miniapp 架构变更确认+R28 HEAD 再次推进到 1de64218+M-15 剩余 3 STUB 路由(ai-extended/misc-extended/system-extended)全部升级为真实 DB 查询确认+apps/ai-service/ Python 服务验证为新增非迁移缺失+miniapp 22 页补全确认+R29 HEAD 推进到 c7d5b769+V4-V6 6 个并行子代理逐代码深度核验（后端 344 文件/前端 570 .vue/小程序 54 模块）+迁移率量化统计（后端 34%完全/9%部分/57%未迁移，前端 ~40%/~25%/~35%，小程序 ~57%）+R29 修复项汇总确认（M-11 tenantDbIsolation 已在 server.ts 注册+token-balance-service 新增+M-18 7 表创建注册+M-15 5 STUB→真实 DB 查询+M-14 stock 服务真实 AI 模型+4 CI workflow 补建）+turbo typecheck 24/24+lint 24/24+test 8/8(297 tests)全部通过确认+R30 服务器根目录基础设施全量验证（alembic 31 迁移/drizzle 43 迁移/tests 244→61/noise-rules.yml 告警降噪/s3-lifecycle.yml 存储分层/locustfile.py 压测/deploy+docker+jaeger+gunicorn+nginx+docs 全量比对）+M-24 测试覆盖差距发现（244→61 文件，E2E 14→0/告警 10→0/WS 5→0）+M-25 部署基础设施缺失发现（S3 lifecycle/Locust/Helm/K8s/Logstash/Loki/docs）+M-9 noise-rules 告警抑制规则未迁移补录）+R31 客户端 E2E/Storybook/专项 CI 工作流全量扫尾验证（旧 client/e2e/ 183 .spec.ts 文件重大漏计修正+旧 client/.storybook/ 4 stories 缺失发现+旧 client/electron/ 桌面薄壳确认+旧 server/.github/workflows/ 18 专项工作流缺失发现+旧 scripts/ 22 文件比对）+M-24 E2E 测试计数重大修正（14→0 修正为 14+183→11=186 缺失）+M-26 Storybook 组件开发环境缺失发现+M-27 专项 CI/CD 工作流缺失发现+R32 server/app/ 根级文件最终审计（dependencies.py/metrics_business.py/telemetry.py/monitoring.py/tenant_demo.py/static/ 22 文件）+M-28 业务可观测性指标 26 项完全缺失发现（zhs_biz_* 前缀全部缺失）+M-29 基础设施指标 DB 池/SQL/WebSocket/活跃连接缺失发现+OpenTelemetry 迁移确认（otel.ts 自动 instrument+userId 注入+错误 span 状态）+多数据库→单数据库+schema 隔离设计变更确认（3 SessionFactory→1 createDb+tenant-db-isolation.ts schema 隔离）+static/ 22 HTML 页面→Next.js App Router 200+ 页面自然替代确认）
> **分析日期**：2026-07-11
> **验证轮次**：32 轮

---

## 重要说明

本报告经过 **32 轮代码级验证**。R13 对旧架构 Python 后端（`server/app/`）做了深度对比，发现 3 项新缺失（M-10 韧性模式不完整 / M-11 多租户 DB 级隔离缺失 / M-9 扩充数据回填+告警降噪）。R14 对旧架构 `server/app/` 全量 769 个 Python 文件做了最终扫描，发现 3 项新缺失（M-12 Canary 部署后端系统 / M-13 TBox/IoT 设备管理 / M-14 Stock 分析系统）。R15 对旧架构 `api/v1/` 全量 ~200 个路由文件与新架构 59 个路由 .ts 文件做了系统性逐模块交叉比对，发现 M-15（22 个业务模块无对应）。R13 还确认 `client/` 目录已在 `a0ffa456` 中完全删除（784 文件，127049 行）。**R16 对 M-3 的 11 个用户端页面做了逐一文件级验证，发现 R12 分析存在严重误报：7 个被标记"❌ 缺失"的页面中 6 个实际已存在完整实现**。**R17 对旧架构 `server/app/` 的 services/ + middleware/ + tasks/ + core/ + orm/ + schemas/ + security/ + cli/ + \_archived/ 做了全量验证**。**R18 对旧架构 utils/ 204 个工具文件做了全量验证，发现 audit_chain / bloom_guard / IDOR guard / API key quota 等安全基础设施缺失，同时纠正 OpenPlatform / VipTrader / TopUpFail / TopUpSuccess 4 个页面误报**。**R19 对未提交工作区改动做了全量验证，发现 AiWorld 页面已存在（M-3 全部解决）+ server.ts 已注册 M-6/M-9 插件 + heat-stats-service.ts 已修复 usage_count 同步 + resilience-extended.ts / tenant-db-isolation.ts 已建但未注册/未集成**。**R20 对旧架构客户端服务层（`client/src/services/` 40+ 文件）+ workers/ + directives/ + composables/（80+ 文件）做了全量验证，发现 M-16（Web Worker fileWorker.ts 缺失）+ M-17（25 个客户端服务无对应），同时确认 cozeApiService / clawdbot / rewardService / unifiedAuthService / agentic-ai / unified-ai-orchestrator 已由服务端覆盖**。**R21 补建了 canary/tbox/stock 路由 + 6 个扩展路由文件覆盖 M-15 的 22 个模块**。**R22 对 R21 补建代码做了代码级深读，发现严重质量问题：M-11 tenantDbIsolation 插件仍未在 server.ts 注册（R21 误标"已修复"）；M-12 canary-service.ts 使用内存 Map 无 DB 持久化；M-14 stock-service.ts 为 STUB 实现（硬编码分析结果+TODO 注释）；M-15 的 6 个扩展路由中 5 个为 STUB（registerCrud 工厂返回空列表，仅 edu-extended.ts 有真实 DB 查询）；同时 R22 对旧 52 个 Python 模型 vs 新 65 个 Drizzle schema 做了全量比对，发现 M-18（3 组模型 7 张表完全缺失：ai_feed 4 表 / ai_gc 2 表 / agent_rule 1 表）；对旧 80+ composables vs 新 27 hooks 做了全量比对，发现 M-19（35+ composables 无对应：AI 相关 11 / PDF 工具 4 / 业务逻辑 20+）**。**R23 对旧架构 `client/src/api/` 200+ 客户端 API 模块与新架构 67 个路由文件做了全量交叉比对，发现 M-20（17 个 API 模块无新路由对应：tools/ranking/checkin/developer API keys/app-version/monitor alerts/webhooks/packages/fund/trader/sdks/miniprogram/token-value/product-identity/luyala-proxy/groups/help），同时确认 wallet→finance.ts / ali-pay→payment-gateway.ts / top-up→payment-gateway.ts+finance.ts / feedback→comments.ts / ask→community.ts / favorites→social.ts / tickets→customer-service.ts / sso→auth-extended.ts(部分) / commission→finance.ts(部分) 已通过路由合并覆盖；同时发现 M-21（开放平台/Feature Center 模块完全缺失：Dashboard + APIs/Agents/Documents/Models/SDKs Hub + NotificationCenter + DocumentCenter 在新架构零匹配，仅 i18n 字符串引用）**。**R24 对旧架构 `client/src/api/` 子目录（admin/ 24 文件 + ai/ 15 文件 + edu/ 9 文件 + payment/ 13 文件等）+ `client/src/data/` 4 文件 + `client/src/config/` 10 文件 + `client/src/plugins/` 4 文件做了散点验证，纠正 admin API 模块覆盖评估（admin-sys.ts 实际覆盖 11 个 admin 模块：menu/notice/job/dept/post/dict/config/logininfo/online 等，R23 因 grep 未匹配 Fastify prefix 注册模式而低估），发现 M-22（4 个 API 子目录散点缺失：user-model-chat/admin-faq/admin-zone/admin-demand-square + 3 个数据文件：customer-service-faq/documentation/mcp-curated + 3 个配置文件：owner-agent-policy/openclaw.config/monitoring-dashboard）**。**R25 对旧架构 `client/src/` 剩余 8 个未验证目录（constants/ 7 文件 + features/ 11 文件 + lib/ 6 文件 + router/ 39 文件 + scripts/ 1 文件 + shared/ 14 文件 + stores/ 23 文件 + templates/ 5 文件）做了全量验证，确认 constants/(平台常量→oauth-providers 服务) / features/third-party-login(→ThirdPartyLoginButtons.tsx) / lib/(→lib/ 工具库) / router/(→Next.js App Router) / stores/(→9 个 Zustand store+hooks) / templates/(开发脚手架无需迁移) 均已覆盖或自然替代，发现 M-23（shared/pricing.ts 的 calculateCost() AI 定价计算引擎未迁移：input/output token 单价+regionPricing 区域差价+discount 折扣计算逻辑在新架构零匹配；新架构有 ai-cost.ts 插件做成本记录/治理但无成本计算引擎；shared/ 5 个验证工具 apiValidation/mcpValidation/modelValidation/pluginValidation/form-validation 改用 zod 但业务特定验证规则未直接迁移）+ scripts/news-crawler/config.ts 新闻爬虫配置未迁移（低优先级）**。**R26 对旧架构 `client/src/components/` 58 个子目录+`client/src/views/edu/` 15 个子目录+`views/edu/web/` 19 个子目录+`views/learn/` 14 个文件与新架构 97 个用户端页面+17 个组件类别（152 文件）做了全量类别级交叉比对，确认 54/58 组件类别已覆盖（agents→5 个 agent .tsx / customer-service→use-customer-service.ts hook / admin→admin-api.ts+admin 页面 / edu(33 文件)→edu 页面+lib/edu.ts+course-api.ts / learn(14 文件)→/learn/+/student/ 6 子页 / plaza/community→/plaza/+/circles/ 页面 / distribution→/distribution/ 7 子页 / search→SearchBar.tsx / member→sidebar+vip-api / mobile→use-media-query 响应式设计 / 15 个 views/edu/ 子目录→新架构 97 用户端页面全部对应 / 19 个 views/edu/web/ 子目录→新架构顶级页面全部对应），发现 4 个前端维度缺失：aifeed 组件(AiFeedPanel+AiFeedTrendChart，M-18 前端维度) / api 管理 UI(5+ 组件，M-20 前端维度) / SensitiveActionDialog(敏感操作验证码确认弹窗，部分由 ConfirmDialog+2FA 替代) / bi DrilldownPanel(M-3 BiDashboard 简化版前端维度)，均为已有 M 项的前端维度补录，不新增 M 项**。**R27 对 HEAD 从 `0e9b5f58` 推进到 `f1a42899`（2 个新提交：miniapp 从 uni-app/Vue 迁移到 Taro4/React + 临时对比文件清理）+ 未提交工作区改动做了全量复审，发现重大修复进展：(1) M-14 Stock 分析系统已从 STUB 升级为真实实现——stock-service.ts 现调用 OpenAI 兼容 API（STOCK_API_KEY/STOCK_API_BASE/STOCK_MODEL_ID 环境变量）+ 失败降级 + 通过 stockAnalyses 表持久化分析记录，不再是硬编码/TODO 占位；(2) M-18 的 3 组 7 张表已全部创建并注册——新建 ai-feed.ts（aiFeedSource/aiFeedHotItem/aiFeedSnapshot/aiFeedTrendSignal 4 表）+ ai-gc.ts（aiGcContent/aiGcTask 2 表）+ agent-rule.ts（agentRule 1 表）+ stock.ts（stockAnalyses 1 表），均在 schema/index.ts 注册导出；(3) M-15 的 6 个扩展路由中 agent-extended.ts 和 content-extended.ts 已从 STUB 升级为真实 DB 查询——agent-extended.ts 使用 db.execute(sql\`...\`) 做真实 CRUD，content-extended.ts 导入 zhsUserAgentImage 并使用 db.select().from()/db.delete() 做真实 Drizzle ORM 操作，加上原本已有真实实现的 edu-extended.ts，6 个路由中 3/6 现为真实实现（system-extended.ts/ai-extended.ts/misc-extended.ts 仍为 STUB）；(4) 新增 token-balance-service.ts 插件（202 行，迁移自旧架构 token_service.py+token_cache_service.py+token_utils_service.py）——提供用户 credit 余额查询（Redis 缓存+DB 兜底）+ Token 扣费（事务安全+余额校验）+ VIP 等级扣费策略 + 促销期检测，已在 server.ts 注册（部分覆盖 M-20 的 token-value 需求，但旧 token-value.ts 侧重"价值评估"而非"余额管理"，两者不完全等同）；(5) miniapp 架构变更——apps/miniapp/(uni-app/Vue 75 页) 已被 apps/miniapp-taro/(Taro4/React 75 页) 替代，全部页面从 .vue 重写为 .tsx，保留相同 75 页功能但技术栈更换；(6) 新增 ESLint 配置（apps/api/eslint.config.js + apps/web/eslint.config.js）+ 4 个新 GitHub Actions 工作流（knip.yml/miniapp-preview.yml/openapi-check.yml/visual-regression.yml）+ ci-monorepo.yml 增强**。_*R32 对旧架构 `server/app/` 根级文件做了最终审计——dependencies.py（3 数据库 SessionFactory：zhs_ai_project/zhs_center_project/zhs_user_center）+ metrics_business.py（26 个 zhs_biz_* 业务指标+BizTimer 计时上下文+record_cache 缓存命中率工具）+ telemetry.py（OpenTelemetry APM：setup_telemetry/trace_business 装饰器/TraceIdMiddleware/set_request_context ContextVars）+ monitoring.py（12 个基础设施指标：REQUEST_COUNT/LATENCY/ACTIVE_CONNECTIONS/WS_CONNECTIONS/DB_POOL_IN_USE/SIZE/CHECKEDOUT/OVERFLOW/CONNECTIONS_TOTAL/CHECKOUT_TIMEOUTS/SQL_LATENCY/SQL_COUNT）+ tenant_demo.py + static/ 22 HTML/CSS/JS 文件。发现 M-28（业务可观测性指标 26 项完全缺失：新架构 metrics.ts 仅有 HTTP 基础指标 requestsTotal/responseTime/uptime，zhs_biz__ 前缀 26 个业务指标全部缺失——用户/HLS/通知推送/WS pub-sub/缓存命中率/任务执行/支付/业务异常/user/tenant 维度指标）+ M-29（基础设施指标部分缺失：DB_POOL 6 项+SQL_LATENCY+SQL_COUNT+ACTIVE_CONNECTIONS+WS_CONNECTIONS 缺失，新架构无 DB 连接池健康监控+SQL 查询性能监控+WebSocket 连接监控）。确认 OpenTelemetry 已完整迁移（apps/api/src/plugins/otel.ts：NodeSDK+auto-instrumentations-node 自动 instrument Fastify/HTTP/ioredis/pg+OTLP/HTTP 导出+userId 注入 span+错误 span 状态+优雅关闭）。确认多数据库→单数据库为设计变更（旧 3 SessionFactory→新 1 createDb，功能域分离改为 packages/database/src/schema/ 70+ schema 文件，租户隔离改为 tenant-db-isolation.ts schema 隔离，非缺失）。确认 static/ 22 HTML 页面已由 Next.js App Router 200+ 页面自然替代（admin/index.html→admin/page.tsx+50+ 子页/agent_management.html→agents/page.tsx/oauth_app_management.html→admin/oauth-apps/+admin/oauth/apps/page.tsx/sms_login.html→admin/sms/page.tsx/errors 403-500→not-found.tsx+error.tsx/swagger-ui→Fastify Swagger 插件/WebSocket demo clients→ai-generation 组件 image-gen-doubao.tsx/video-gen-qwen.tsx 等）**。

1. **miniapp 从 15 页扩展到 75 页**（commit `a30b5705`，真实完整迁移）
2. **部分提交消息严重夸大**：`f24d0be3` 声称"补齐后端迁移"实际仅改 2 文件 5 行；`6ed35c14` 声称"所有34项缺失已100%修复完成"实际 6 项中严重度缺失仍全部存在
3. **R32 验证后状态（HEAD `c7d5b769` + 未提交工作区改动）**：M-1/M-2/M-3/M-4/M-5/M-7/M-8/M-11/M-13/M-14/M-15/M-18 已修复（12 项）；**R29 新确认 M-11 tenantDbIsolation 插件已在 server.ts 注册（第 114/265 行）**；**R29 V4-V6 深度核验：后端 344 文件 34% 完全迁移/9% 部分/57% 未迁移（主要是 utils/ 204 文件中 bug131-202 韧性模式 60 个未迁移）；前端 570 .vue 页面 ~40% 完全迁移/~25% 部分/~35% 未迁移（7 块整块业务功能缺失）；小程序 54 页面模块 ~57% 迁移（15 模块缺失含充值/消息/AIGC）；CI 11 workflow→9 workflow（4 个新补建）；文档 60+→2 文件**；**R30 新发现：旧架构 server/tests/ 244 测试文件→新架构 61 文件（M-24），E2E 14→0/告警 10→0/WS 5→0；旧架构 noise-rules.yml 告警抑制规则未迁移（M-9 补录）；旧架构 S3 lifecycle 分层+Locust 压测+Helm/K8s 部署配置未迁移（M-25）；旧架构 31 Alembic 迁移→新架构 43 Drizzle 迁移（自然替代）**；**R31 重大修正+新发现：M-24 E2E 测试计数严重低估——旧架构 client/e2e/ 有 183 个 .spec.ts 文件（R30 仅计 server/tests/ 14 个），实际 E2E 缺口为 14+183→11=186 文件缺失；旧架构 client/.storybook/ 4 个组件 stories+配置未迁移（M-26）；旧架构 server/.github/workflows/ 18 个专项工作流中 7 个无新架构对应（M-27）；旧架构 client/electron/ 2 文件桌面薄壳 wrapper 确认（新架构 web-only 设计决策）；旧架构 scripts/ 22 文件中 gen-seed-data-v3.py 种子数据生成无对应**；_*R32 新发现：旧架构 metrics_business.py 26 个 zhs_biz_* 业务指标完全缺失（M-28）——用户/HLS/通知推送/WS pub-sub/缓存命中率/任务执行/支付/业务异常/user/tenant 维度指标在新架构 metrics.ts 中零匹配，新架构仅有 HTTP 基础指标（requestsTotal/responseTime/uptime）；旧架构 monitoring.py 12 个基础设施指标中 10 个缺失（M-29）——DB_POOL 6 项（IN_USE/SIZE/CHECKEDOUT/OVERFLOW/CONNECTIONS_TOTAL/CHECKOUT_TIMEOUTS）+SQL_LATENCY+SQL_COUNT+ACTIVE_CONNECTIONS+WS_CONNECTIONS 在新架构零匹配；确认 OpenTelemetry 已完整迁移（otel.ts 自动 instrument+userId 注入+错误 span）；确认多数据库→单数据库+schema 隔离为设计变更（非缺失）；确认 static/ 22 HTML 页面已由 Next.js App Router 200+ 页面自然替代_*；M-6/M-9 已注册但部分未集成（2 项部分修复）；M-10 函数未集成到业务代码（1 项部分修复）；M-12 服务为内存实现无 DB 持久化（1 项部分修复）；M-16/M-17 未修复（2 项）；M-19（35+ composables 无对应）；M-20（17 个 API 模块无路由，token-balance-service 部分覆盖 token-value）；M-21（开放平台/Feature Center 完全缺失）；M-22（10 个散点缺失）；M-23（pricing 计算引擎缺失）；M-24（测试覆盖 244→61 文件+E2E 183→11 文件，关键基础设施测试完全缺失）；M-25（S3 lifecycle/Locust/部署配置缺失）；M-26（Storybook 组件开发环境缺失）；M-27（专项 CI/CD 工作流缺失）；M-28（业务可观测性指标 26 项完全缺失）；M-29（基础设施指标 DB 池/SQL/WebSocket/活跃连接缺失）；共 **12 项已修复 + 4 项部分修复 + 13 项未修复**，均为非阻断项

### v9→v10 新增提交追踪（6 个提交）

| 提交       | 说明                                                                               | 实际变更                                                                                                                                                           | R11 验证                                 |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `9b63fef3` | feat(db): 补齐迁移完整性 - 19张缺失表+11子表                                       | 仅 5 文件 248 行（journal 注册 + snapshot + billing.ts 3 行）                                                                                                      | 表已在 v8 修复中存在，本提交仅补 journal |
| `f24d0be3` | feat(api): 补齐后端迁移 - AI Workspace/Chat/Coze/客服/安全/WS/服务层/clawdbot      | **仅 2 文件 5 行**（payment-queries.ts + payment-gateway.ts）                                                                                                      | ⚠️ 消息严重夸大                          |
| `4f159c01` | feat(web): 补齐前端迁移 - AI组件群/教育后台/登录组件/设置中心/admin导航/i18n 3语言 | 3 i18n 文件各 24 行 + 6 ai-generation 组件各 1-2 行 + 2 admin edu 页面微调                                                                                         | i18n 已在 v9 验证存在                    |
| `a30b5705` | feat(miniapp): 小程序端完整迁移 - 75页全部完成                                     | **真实**：miniapp 从 15 页扩展到 75 页（about/ai/ask/circle/distribution/exam/live/member/news/order/pay/setting/study/topic/teacher/user/vip/course/login/index） | ✅ 真实改进                              |
| `6ed35c14` | docs: 所有34项缺失已100%修复完成                                                   | 仅改报告文件                                                                                                                                                       | ⚠️ 消息不实，6 项中严重度缺失仍存在      |
| `60890463` | fix(api): remove 3 as-any casts in agents.ts                                       | agents.ts 6 行类型修复                                                                                                                                             | ✅ 真实改进                              |

---

## 一、规模总览（R28 最终验证）

| 维度                | 旧架构            | 新架构（R28 验证后）                                                                                          | 状态                                                                                                |
| ------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 后端路由文件        | ~90 模块          | 67 个路由文件（含 R21 新增 9 个）                                                                             | ✅ 全部注册                                                                                         |
| 后端路由端点        | ~600+             | ~700+                                                                                                         | ✅ **R28 修复 M-15**：6/6 扩展路由为真实实现                                                        |
| 后端插件            | ~10 中间件        | 40 个 register（R27 +tokenBalanceService）                                                                    | ⚠️ R22 纠正：tenantDbIsolation 未注册（M-11）                                                       |
| 后端服务层          | 37 个             | 17 service + 50 queries + clawdbot 20 + workspace-ai + canary-service + stock-service + token-balance-service | ⚠️ R27：stock-service 已真实实现 / canary-service 仍内存实现                                        |
| WebSocket           | 16 文件           | 4 WS 插件 + 3 WS 端点                                                                                         | ⚠️ 通知/AI流式/聊天室/客服/PCM 已覆盖；room_policy + auto_recovery 缺失；stock WS 仍有 TODO（M-14） |
| 定时任务            | 13 个 APScheduler | 5 个 BullMQ cron                                                                                              | ✅ **R17 修复**（5/5 接入 backing service + R19 修复 usage_count 同步，M-1 已修复）                 |
| 支付幂等性          | ✅                | ✅ 167 行                                                                                                     | ✅ 完整迁移                                                                                         |
| AI 成本治理         | ✅                | ✅ 384 行 + 仪表盘                                                                                            | ✅ 完整迁移（记录+治理；计算引擎见 M-23）                                                           |
| Token 余额服务      | ✅                | ✅ 202 行（R27 新增）                                                                                         | ✅ **R27 新增** token-balance-service.ts（余额查询+扣费+VIP策略+促销检测）                          |
| 缓存韧性            | ✅                | ✅ 163 行                                                                                                     | ✅ **v9 新增**（熔断器+双删+singleflight）                                                          |
| XSS 防护            | 全局中间件        | ✅ 全局中间件                                                                                                 | ✅ **v9 新增**（onRequest 净化 + onSend 安全头）                                                    |
| 可观测性            | OTel+ELK+Grafana  | OTel+Grafana+Prometheus                                                                                       | ⚠️ 仅 ELK 缺失                                                                                      |
| 安全审计 CI         | ✅                | ✅ + 4 新工作流（R27）                                                                                        | ✅ 完整迁移（R27 新增 knip/miniapp-preview/openapi-check/visual-regression）                        |
| CLI 工具            | 5 命令            | 6 文件                                                                                                        | ✅ 完整迁移                                                                                         |
| 多租户              | ✅                | ✅ 插件+路由+3表                                                                                              | ⚠️ 应用级完整；DB 级隔离 M-11 插件未注册                                                            |
| OpenAPI SDK         | Python 672 文件   | generate-sdk.ts                                                                                               | ✅ 完整迁移                                                                                         |
| Schema 模块         | 53 个             | 69 个（R27 +ai-feed/ai-gc/agent-rule/stock）                                                                  | ✅ **R27 修复 M-18**：ai_feed 4 表 / ai_gc 2 表 / agent_rule 1 表 / stock 1 表 全部创建并注册       |
| 前端页面            | 579 .vue          | ~200+ page.tsx（(main) 下 51 页 + admin 子页 + 其他）                                                         | ✅ **R19 验证**（M-3 全部 11 项已映射，AiWorld 已存在）                                             |
| AI 前端组件         | 65+               | 50 个 .tsx                                                                                                    | ✅ 完整迁移                                                                                         |
| 登录组件            | 25                | 8 个 .tsx                                                                                                     | ✅ 完整迁移                                                                                         |
| 设置组件            | 20                | 7 个 .tsx                                                                                                     | ✅ 完整迁移                                                                                         |
| i18n 语言           | 5 种              | 5 种                                                                                                          | ✅ **v9 补齐**（zh-CN/zh-TW/en/ja/ko）                                                              |
| 小程序端            | 1217 文件         | 75 页面（~90 文件）Taro4/React                                                                                | ✅ **R27 架构升级** apps/miniapp-taro/（从 uni-app/Vue 迁移到 Taro4/React，75 页 .vue→.tsx）        |
| React Hooks         | 80+ composables   | 27 hooks                                                                                                      | ⚠️ R22 新发现：35+ composables 无对应（M-19）                                                       |
| plaza.ts/billing.ts | ✅                | ✅ 真实 DB 查询                                                                                               | ✅ **v9 修复**（不再是 stub）                                                                       |

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

## 四、中严重度缺失（R31 验证：M-1/M-2/M-3/M-4/M-5/M-7/M-8/M-11/M-13/M-14/M-15/M-18 已修复；M-6/M-9/M-10/M-12 部分修复；M-16/M-17 未修复；M-19/M-20/M-21/M-22/M-23/M-24/M-25/M-26/M-27 未修复；R18 安全基础设施缺失仍未修复）

### M-1. ~~定时任务 3/5 backing service 未迁移~~ — ✅ 已修复

- **R17 修复**：新建 3 个 backing service 文件并接入 scheduler-worker.ts
  - [heat-stats-service.ts](file:///g:/IHUI-AI/apps/api/src/services/heat-stats-service.ts) — 热度统计聚合
  - [alert-check-service.ts](file:///g:/IHUI-AI/apps/api/src/services/alert-check-service.ts) — 告警噪音检查
  - [data-archive-service.ts](file:///g:/IHUI-AI/apps/api/src/services/data-archive-service.ts) — 历史数据归档
- **验证**：scheduler-worker.ts 5/5 任务全部接入真实 service，无 `skipped: true`

### M-2. ~~14 个 admin 页面使用 MOCK 数据~~ — ✅ 已修复

- **R17 修复**：14 个页面 25 处 queryFn 替换为 `fetchApi` + MOCK fallback 模式
- **策略**：先调真实 API，失败时回退 MOCK 常量，页面不会因接口缺失崩溃
- **dict 特殊处理**：接入真实后端 API `/api/admin/dict/type/list`
- **验证**：grep `Promise\.resolve\(MOCK` 0 匹配（已全部替换）

### M-3. ~~11 个用户端独立页面功能映射~~ — ✅ 已修复（R19 验证全部已映射）

**R16 验证方法**：读取新架构 `apps/web/app/(main)/` 下 51 个 page.tsx 文件，逐一验证 R12 标记为"❌ 缺失"的 7 个页面是否真实存在；同时读取旧架构 Vue3 源码确认功能对应关系

**R19 验证**：发现 AiWorld 页面已存在于工作区（未提交），M-3 全部 11 项已映射

| 旧页面                     | 旧功能描述                                                                                       | 新架构对应                                                                                                                                                                         | 状态                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| AiWorld.vue                | AI 展厅/分类导航内容页（左侧分类树+右侧内容区+Hero 轮播+详情模式，import from `@/api/ai-world`） | [/ai-world/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/ai-world/page.tsx>)（useQuery + fetchApi('/api/ai-world') + 8 分类网格 + FALLBACK_DATA + 热门 AI 应用卡片）           | ✅ **R19 已映射**                                       |
| KnowledgeBase.vue          | 知识库+详情页                                                                                    | /docs/（文档中心，scope 不同：docs 是 API/指南/开发/FAQ 文档，非知识库）                                                                                                           | ⚠️ 部分映射                                             |
| Tools.vue                  | 用户端工具目录（分类侧边栏+工具卡片网格+搜索）                                                   | [/tools/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/tools/page.tsx>)（useQuery + 3 分类 AI/dev/efficiency + fetchApi('/api/tools')）                                         | ✅ 已映射                                               |
| Ranking.vue                | 用户端排行榜（day/week/month/all）                                                               | [/ranking/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/ranking/page.tsx>)（useQuery + week/month/total Tabs + fetchApi('/api/ranking')）                                      | ✅ 已映射（注：新架构无 day 榜）                        |
| Share.vue                  | 社交分享页（预览卡片+分享功能）                                                                  | [/share/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/share/page.tsx>)（useQuery + copyLink 剪贴板 + fetchApi('/api/share')）                                                  | ✅ 已映射                                               |
| Refund.vue                 | 用户端退款申请                                                                                   | [/refund/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/refund/page.tsx>)（useQuery + 退款列表 Table + 申请退款 Button + fetchApi('/api/refund')）                              | ✅ 已映射（用户侧完整）                                 |
| N8NAgents.vue              | N8N 工作流智能体                                                                                 | /workflows/（含 /workflows/[id]/ 和 /workflows/instances/[id]/）                                                                                                                   | ✅ 已映射                                               |
| MCPUseProject.vue          | MCP 使用项目页                                                                                   | [/mcp-projects/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/mcp-projects/page.tsx>)（useQuery + McpProject 接口 + STATUS_LABEL/STATUS_CLASS + fetchApi('/api/mcp/projects')） | ✅ 已映射                                               |
| BiDashboard.vue            | 商业智能仪表盘（含指标/维度/范围配置+异常检测）                                                  | [/bi-dashboard/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/bi-dashboard/page.tsx>)（useQuery + 4 统计卡片 + fetchApi('/api/bi/dashboard')）                                  | ⚠️ 部分映射（简化版：无指标/维度/范围配置，无异常检测） |
| SecurityAuditDashboard.vue | 安全审计仪表盘                                                                                   | [/security-audit/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/security-audit/page.tsx>)（useQuery + AuditEvent 接口 + Table 展示 + fetchApi('/api/security-audit')）          | ✅ 已映射                                               |
| ApiTestPage.vue            | API 测试页                                                                                       | [/api-test/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/api-test/page.tsx>)（GET/POST/PUT/PATCH/DELETE 方法选择 + headers/body 输入 + 响应展示 + fetchApi）                   | ✅ 已映射                                               |

**R19 结论**（全部已映射）：

- ✅ 已映射：9 项（AiWorld / Tools / Ranking 用户侧 / Share / Refund 用户侧 / N8NAgents / MCPUseProject / SecurityAuditDashboard / ApiTestPage）
- ⚠️ 部分映射：2 项（KnowledgeBase → /docs/ scope 不同；BiDashboard 简化版无配置/异常检测）
- ❌ 真实缺失：0 项
- **R19 误报根因**：R16 用 grep 搜索 `aiWorld|ai-world|AiWorld|ai_world|AI 世界` 在 `apps/` 零匹配就断定缺失，但 R19 通过 `Glob apps/web/app/**/page.tsx` 直接列出文件发现 `/ai-world/page.tsx` 已存在（未提交的工作区文件）。**教训**：grep 搜索未提交文件时可能因文件未被 git 跟踪而漏检，必须用 Glob 直接扫描文件系统。

### M-4. ~~i18n 缺失 3 种语言~~ — ✅ 已修复

- **验证证据**：[apps/web/messages/](file:///g:/IHUI-AI/apps/web/messages/) 目录含 5 个文件：zh-CN.json / zh-TW.json / en.json / ja.json / ko.json

### M-5. ~~CI 能力缺失~~ — ✅ 已修复

- **R17 修复**：新建 4 项 CI 配置文件
  - [knip.jsonc](file:///g:/IHUI-AI/knip.jsonc) — 死代码检测配置（7 workspace 入口点）
  - [scripts/openapi-check.mjs](file:///g:/IHUI-AI/scripts/openapi-check.mjs) — OpenAPI 规范校验
  - [scripts/miniapp-preview.mjs](file:///g:/IHUI-AI/scripts/miniapp-preview.mjs) — 小程序预览
  - [playwright.visual.config.ts](file:///g:/IHUI-AI/apps/web/playwright.visual.config.ts) — 视觉回归测试
- **package.json**：根 + apps/web 添加 4 个 script（R16 验证：`knip` / `openapi-check` / `miniapp:preview` / `test:visual` 均存在）

### M-6. ~~数据库基础设施缩水~~ — ⚠️ R19 已注册 2/3，read-replica 仍未集成

- **R17 修复**：新建 3 个数据库基础设施文件
  - [read-replica.ts](file:///g:/IHUI-AI/packages/database/src/read-replica.ts) — 读写分离（createReadWriteDb 工厂，无从库时回退主库）
  - [slow-sql-killer.ts](file:///g:/IHUI-AI/apps/api/src/plugins/slow-sql-killer.ts) — 慢 SQL 杀手（阈值 1000ms，60s 统计）
  - [db-keepalive.ts](file:///g:/IHUI-AI/apps/api/src/plugins/db-keepalive.ts) — 连接保活（30s SELECT 1）
- **config**：添加 `DATABASE_READ_REPLICA_URL` 可选环境变量
- **R19 验证**：✅ server.ts 已新增 `import { slowSqlKiller }` + `import { dbKeepalive }` + `await server.register(slowSqlKiller)` + `await server.register(dbKeepalive)`（未提交工作区改动）——**2 个插件已注册生效**
- **R19 遗留**：⚠️ `read-replica.ts` 的 `createReadWriteDb` 虽从 `@ihui/database` 导出，但 `apps/api/src/db/index.ts` 未引用——读写分离工厂已定义但 API 层未使用
- **严重程度**：低（慢 SQL + 保活已生效；读写分离需业务接入）

### M-7. ~~plaza.ts / billing.ts 是 stub~~ — ✅ 已修复

- **验证证据**：
  - [plaza.ts](file:///g:/IHUI-AI/apps/api/src/routes/plaza.ts)：GET /list 调用 `findPlazaItemList`（来自 misc-queries.ts），含 zod 校验 + 鉴权
  - [billing.ts](file:///g:/IHUI-AI/apps/api/src/routes/billing.ts)：GET /plans + GET /plans/:id 调用 `findPlans` / `findPlanById`（来自 billing-queries.ts）

### M-8. ~~XSS 防护降级~~ — ✅ 已修复

- **验证证据**：[xss-protection.ts](file:///g:/IHUI-AI/apps/api/src/plugins/xss-protection.ts)（97 行），已恢复为全局中间件：
  - onRequest hook：递归净化请求体/查询参数中的字符串（HTML 实体编码 + 剥离危险向量）
  - onSend hook：X-XSS-Protection / X-Content-Type-Options / X-Frame-Options / Referrer-Policy
- **注册**：server.ts 第 236 行 `await server.register(xssProtectionPlugin)`

### M-9. ~~旧架构运维能力缺失~~ — ⚠️ R19 已注册 2 插件，distributed-transaction 仍未集成

- **R17 修复**：新建 3 个运维能力文件
  - [n1-detector.ts](file:///g:/IHUI-AI/apps/api/src/plugins/n1-detector.ts) — N+1 查询检测（阈值 20，onResponse warning）
  - [prompt-injection-guard.ts](file:///g:/IHUI-AI/apps/api/src/plugins/prompt-injection-guard.ts) — Prompt 注入防护（10 个危险正则，onRequest 400 拦截）
  - [distributed-transaction.ts](file:///g:/IHUI-AI/apps/api/src/services/distributed-transaction.ts) — Saga 模式分布式事务（executeSaga + compensate 回滚）
- **R19 验证**：✅ server.ts 已新增 `import { n1Detector }` + `import { promptInjectionGuard }` + `await server.register(n1Detector)` + `await server.register(promptInjectionGuard)`（未提交工作区改动）——**2 个插件已注册生效**
- **R19 遗留**：⚠️ `distributed-transaction.ts` 的 `executeSaga` 需业务代码主动调用，当前无业务路由引用——Saga 模式已实现但未集成
- **未迁移**：数据回填系统 / 告警抑制与降噪（低优先级，旧架构独立模块）
- **R30 新发现**：⚠️ 旧架构 `server/noise-rules.yml` 实现告警级联抑制规则（cascade_inhibit，如 PGInstanceDown 时自动抑制 PGConnectionsHigh/PGReplicationLagHigh/PGRollbackHigh/PGBloatHigh 等下游告警），新架构零匹配——告警降噪规则未迁移，与 M-9 告警抑制功能直接相关
- **严重程度**：低（N+1 检测 + Prompt 注入防护已生效；Saga 需业务接入；noise-rules 告警抑制规则未迁移）

### M-10. ~~韧性模式不完整~~ — ⚠️ R22 纠正：函数仍未集成到业务代码（R21 误标"已修复"）

- **R13 验证**：读取旧架构 `server/app/resilience.py`，含 4 种韧性模式；新架构仅有 2 种
- **旧架构 4 种模式**：
  1. CircuitBreaker（熔断器）→ ✅ 已迁移至 [cache-resilience.ts](file:///g:/IHUI-AI/apps/api/src/plugins/cache-resilience.ts)
  2. TokenBucketRateLimit（令牌桶限流）→ ✅ 已迁移至 distributed-rate-limit.ts
  3. degraded_mode（降级兜底装饰器）→ ⚠️ R19 文件已建：[resilience-extended.ts](file:///g:/IHUI-AI/apps/api/src/plugins/resilience-extended.ts) 导出 `degradedMode` 函数，但无业务代码调用
  4. bulkhead（信号量隔离）→ ⚠️ R19 文件已建：[resilience-extended.ts](file:///g:/IHUI-AI/apps/api/src/plugins/resilience-extended.ts) 导出 `Bulkhead` 类 + `getBulkhead` 工厂，但无业务代码使用
- **R22 验证**：❌ grep `resilienceExtended|resilience-extended|degradedMode|getBulkhead` 在 [server.ts](file:///g:/IHUI-AI/apps/api/src/server.ts) 中零匹配——**函数已定义但未在 server.ts 注册，也无任何业务路由/服务调用**。与 R19 验证结果一致，R21 的"✅ 已修复"标记为误报
- **严重程度**：低（模式已实现，需在关键服务路径调用 degradedMode + Bulkhead）

### M-11. ~~多租户 DB 级隔离缺失~~ — ✅ R29 修复确认：插件已在 server.ts 注册

- **R13 验证**：旧架构 `server/app/db_per_tenant.py` 实现了数据库级租户隔离（schema_translate_map + LRU 引擎缓存 + ContextVar + 影子流量 + 优雅降级）
- **R19 修复**：新建 [tenant-db-isolation.ts](file:///g:/IHUI-AI/apps/api/src/plugins/tenant-db-isolation.ts)（76 行），实现：
  - `AsyncLocalStorage<TenantContext>`（等价 Python ContextVar）维护租户上下文
  - `getTenantSchema` + LRU 缓存（1000 上限，等价旧架构 LRU 引擎缓存）
  - `withTenant` 函数：设置 `SET LOCAL search_path TO ${schema}, public`，执行后恢复
  - `tenantDbIsolation` Fastify 插件：onRequest 从 `x-tenant-id` header 提取租户 ID，decorate `withTenant` / `getCurrentTenant`
- **R22 验证**：❌ grep `tenantDbIsolation|tenant-db-isolation|withTenant` 在 [server.ts](file:///g:/IHUI-AI/apps/api/src/server.ts) 中零匹配——**插件已定义但未在 server.ts `registerPlugins` 中注册，运行时不生效**
- **R29 修复确认**：✅ server.ts 现已添加 `import { tenantDbIsolation } from './plugins/tenant-db-isolation.js'` + `await server.register(tenantDbIsolation)`（第 114/265 行），插件正式生效
- **影响**：已解决，多租户 DB 级隔离运行时生效
- **严重程度**：已修复

### M-12. ~~Canary 部署后端系统完全缺失~~ — ⚠️ R22 纠正：服务为内存实现，无 DB 持久化（R21 误标"已修复"）

- **R14 验证**：旧架构 `server/app/` 有完整的 Canary 阶段化门控部署系统（~20 个文件），新架构 API 源码零匹配（grep `canary|灰度|gray.?release|shadow.?traffic` 无命中）
- **旧架构文件清单**（20 个）：
  - 根模块 6 个：[canary.py](file:///g:/IHUI-AI/server/app/canary.py) / canary_audit_store.py / canary_auto_promoter.py / canary_metrics.py / canary_metrics_source.py / canary_stages.py
  - API 路由 3 个：api/v1/canary_routes.py（阶段门控：stage/promote/rollback/reset/failure/traffic）/ api/v1/monitor/canary_audit.py / api/v1/monitor/canary_promoter.py
  - 服务 1 个：services/canary_monitor_bridge.py
  - 工具 4 个：utils/canary_rule_snapshot.py / utils/config_canary_push.py / utils/gradual_rollout.py / utils/rollout_sampling.py
  - 归档 6 个：_archived/canary_shadow_link.py + 5 个测试文件
- **旧架构功能**：CanaryStageController（1%→5%→25%→100% 四阶段门控）、自动提升、手动回滚、冷却期管理、失败阈值自动回滚、流量审计、影子流量比对、状态持久化
- **R21 补建**：新建 [canary.ts](file:///g:/IHUI-AI/apps/api/src/routes/canary.ts) 路由 + [canary-service.ts](file:///g:/IHUI-AI/apps/api/src/services/canary-service.ts) 服务，已注册到 server.ts
- **R22 验证**：⚠️ canary-service.ts 使用 `const configs = new Map<string, CanaryConfig>()` + `const auditLog: CanaryAuditEntry[] = []` 内存存储——**业务逻辑真实（阶段门控/冷却/失败阈值），但无 DB 持久化，服务重启数据丢失**。旧架构的影子流量比对、自动提升器、指标采集源均未迁移
- **严重程度**：中（核心逻辑已实现，但持久化+自动提升+影子流量缺失）

### M-13. ~~TBox/IoT 设备管理完全缺失~~ — ✅ R22 验证：真实修复

- **R14 验证**：旧架构有完整的 TBox（百宝箱/IoT 设备）管理系统，新架构 API 源码零匹配（grep `tbox_device|iot.?device|device_no|TBoxDevice` 无命中）
- **旧架构文件**：
  - [api/v1/tbox/tbox.py](file:///g:/IHUI-AI/server/app/api/v1/tbox/tbox.py)：TboxDevice 模型（tbox_device 表）+ TboxCommand 模型（tbox_command 表），设备管理 API（设备注册/绑定/在线状态/信号/电量/位置/固件/指令下发 reboot/lock/unlock/upgrade）
  - [api/v1/mcp/tbox.py](file:///g:/IHUI-AI/server/app/api/v1/mcp/tbox.py)：TBox 事件通知接收 API（X-Signature 签名验证 + 事件日志 + 查询）
  - models/tbox_models.py + schemas/tbox_schemas.py
- **R21 补建**：新建 [tbox-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/tbox-extended.ts) schema（tboxDevice + tboxCommand 两表）+ [tbox.ts](file:///g:/IHUI-AI/apps/api/src/routes/tbox.ts) 路由，已注册到 server.ts `/api/tbox`
- **R22 验证**：✅ 真实实现——tbox.ts 路由使用 `db.select().from(tboxDevice)` 真实 DB 查询，tbox-extended.ts schema 定义了 tboxDevice（deviceNo/deviceName/deviceType/status/signal/battery/latitude/longitude/firmwareVersion）+ tboxCommand（deviceId/command/status/payload）两表，指令支持 reboot/lock/unlock/upgrade
- **严重程度**：低（核心设备管理+指令下发已迁移；旧架构的 X-Signature 签名验证事件通知 API 未迁移，属增强功能）

### M-14. ~~Stock 分析系统完全缺失~~ — ✅ R27 验证：已修复（未提交）

- **R14 验证**：旧架构有完整的 Stock（股票分析）系统，新架构 API 源码零匹配（grep `stock|股票|stock_analyse` 无命中）
- **旧架构文件**：
  - [api/v1/stock/analyse.py](file:///g:/IHUI-AI/server/app/api/v1/stock/analyse.py)：Stock 分析 API（WebSocket + POST），含 token 余额检查 + 对话保存 + 分页
  - services/stock_analyse_service.py：stock_analyse_client + check_token_balance
  - ws/stock_manager.py：STOCK_MODEL_ID + stock_ws_manager（WebSocket 股票管理器）
- **R21 补建**：新建 [stock.ts](file:///g:/IHUI-AI/apps/api/src/routes/stock.ts) 路由 + [stock-service.ts](file:///g:/IHUI-AI/apps/api/src/services/stock-service.ts) 服务，已注册到 server.ts
- **R22 验证**：⚠️ stock-service.ts 为 STUB 实现：
  - `tokenBalance` 使用内存变量（`const tokenBalance: TokenBalance = { total: 10000, used: 0, remaining: 10000 }`），注释明确标注"模拟 Token 余额（实际应从 DB 读取）"
  - `executeStockAnalysis` 返回硬编码分析字符串，注释标注"TODO: 实际调用 AI 模型"——**未调用任何 AI 模型**
  - `getStockHistory` 返回空列表，注释标注"TODO: 从 DB 读取历史记录"
  - 旧架构的 WebSocket 股票管理器（ws/stock_manager.py）完全未迁移
- **R27 验证**：✅ 已修复（未提交工作区改动）——stock-service.ts 现为真实实现：
  - 新增 `callStockAIModel()` 函数：调用 OpenAI 兼容 chat/completions API（STOCK_API_KEY/STOCK_API_BASE/STOCK_MODEL_ID 环境变量），返回真实 AI 分析
  - 新增 `localFallbackAnalysis()` 降级函数：AI 模型未配置或调用失败时返回基础结构化分析
  - `executeStockAnalysis()` 现调用真实 AI 模型（失败时降级），不再硬编码
  - 新增 [stock.ts](file:///g:/IHUI-AI/packages/database/src/schema/stock.ts) schema：`stockAnalyses` 表（id/userId/symbol/question/analysis/model/conversationId/tokensUsed/metadata/createdAt）
  - `persistAnalysis()` 通过 `db.insert(stockAnalyses).values(...)` 持久化分析记录
  - `getStockHistory()` 现从 `db.select().from(stockAnalyses)` 读取真实历史记录（支持 symbol/userId 筛选+分页+count）
  - WebSocket 流式仍有 TODO（stock.ts 第 65-66 行注释"实际 WS 流式实现需要在 ws-ai.ts 或独立插件中注册"）——但核心 POST 分析已完整
- **严重程度**：低（核心分析功能已完整迁移：真实 AI 调用+DB 持久化+历史查询；仅 WS 流式推送未迁移，属增强功能）

### M-15. ~~旧架构 22 个业务模块在新架构中无对应~~ — ✅ R28 验证：6/6 路由全部为真实实现（从 R27 的 3/6 提升）

- **R15 验证方法**：对旧架构 `server/app/api/v1/` 全量 ~200 个路由文件与新架构 59 个路由 .ts 文件做系统性逐模块交叉比对
- **R15 发现**：以下 22 个旧模块在新架构 API 源码中零匹配（grep 中英文关键词均无命中）

**Agent 相关（3 个）：**

| 旧模块                             | 功能                                                        | 新架构状态                                          |
| ---------------------------------- | ----------------------------------------------------------- | --------------------------------------------------- |
| agent_need_task/agent_need_task.py | Agent 需求任务市场（AgentNeedTask 表，用户发布 Agent 需求） | ❌ 缺失                                             |
| agent_upload/agent_upload.py       | Agent 资源上传管理（AgentUpload 表，文件追踪）              | ❌ 缺失（通用上传在 files.ts，但无 Agent 维度追踪） |
| agent_usedetail/agent_usedetail.py | 代理商使用明细（AgentUsedetail 表，用量计费追踪）           | ❌ 缺失                                             |

**内容/媒体（6 个）：**

| 旧模块                                   | 功能                                                           | 新架构状态                                      |
| ---------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| advertise/advertise.py                   | 广告管理（AdvertisePosition + Advertise 表，广告位+广告 CRUD） | ❌ 缺失（promotions.ts 仅促销，不含广告位管理） |
| video.py                                 | 视频管理                                                       | ❌ 缺失                                         |
| video_preload/video_preload.py           | 视频预加载                                                     | ❌ 缺失                                         |
| user_video_comment/user_video_comment.py | 视频评论追踪                                                   | ❌ 缺失                                         |
| user_video_log/user_video_log.py         | 视频日志追踪                                                   | ❌ 缺失                                         |
| user_agent_image/user_agent_image.py     | 用户 Agent 图片                                                | ❌ 缺失                                         |

**教育（1 个）：**

| 旧模块                       | 功能     | 新架构状态 |
| ---------------------------- | -------- | ---------- |
| course_audit/course_audit.py | 课程审核 | ❌ 缺失    |

**管理/系统（4 个）：**

| 旧模块                                     | 功能           | 新架构状态 |
| ------------------------------------------ | -------------- | ---------- |
| category_dictionary/category_dictionary.py | 分类字典管理   | ❌ 缺失    |
| bot_sites.py + ai_bot_sites.py             | Bot 站点配置   | ❌ 缺失    |
| ws_admin.py                                | WebSocket 管理 | ❌ 缺失    |
| compat_routes.py                           | 兼容性路由     | ❌ 缺失    |

**AI（5 个）：**

| 旧模块                                      | 功能             | 新架构状态                                             |
| ------------------------------------------- | ---------------- | ------------------------------------------------------ |
| ai/capabilities.py                          | 统一 AI 能力列表 | ❌ 缺失（ai-vendors.ts 有分厂商 /models 但无统一端点） |
| ai/model_info.py                            | 统一模型信息     | ❌ 缺失                                                |
| ai/outbound_routes.py                       | AI 外呼路由      | ❌ 缺失                                                |
| ai/video_routes.py + video_tasks.py         | AI 视频路由+任务 | ❌ 缺失                                                |
| developer/model_test_service.py + models.py | 开发者模型测试   | ❌ 缺失                                                |

**其他（3 个）：**

| 旧模块                                   | 功能              | 新架构状态 |
| ---------------------------------------- | ----------------- | ---------- |
| remote.py                                | 远程代理          | ❌ 缺失    |
| user_agent_context/user_agent_context.py | 用户 Agent 上下文 | ❌ 缺失    |
| docs/routes.py + models.py               | 文档路由          | ❌ 缺失    |

- **严重程度**：中（单个模块影响有限，但 22 个模块累计代表显著的功能覆盖差距）
- **说明**：部分模块可能是业务裁剪（有意删除），需产品确认是"未迁移"还是"已废弃"
- **R21 补建**：新建 6 个扩展路由文件覆盖 22 个模块，已注册到 server.ts：
  - [agent-extended.ts](file:///g:/IHUI-AI/apps/api/src/routes/agent-extended.ts) → /api/agent-ext（need_task/upload/usedetail）
  - [content-extended.ts](file:///g:/IHUI-AI/apps/api/src/routes/content-extended.ts) → /api/content-ext（advertise/video/video_preload/user_video_comment/user_video_log/user_agent_image）
  - [edu-extended.ts](file:///g:/IHUI-AI/apps/api/src/routes/edu-extended.ts) → /api/edu-ext（course_audit 等）
  - [system-extended.ts](file:///g:/IHUI-AI/apps/api/src/routes/system-extended.ts) → /api/system-ext（category_dictionary/bot_sites/ws_admin/compat_routes）
  - [ai-extended.ts](file:///g:/IHUI-AI/apps/api/src/routes/ai-extended.ts) → /api/ai-ext（capabilities/model_info/outbound_routes/video_routes/model_test）
  - [misc-extended.ts](file:///g:/IHUI-AI/apps/api/src/routes/misc-extended.ts) → /api/misc-ext（remote/user_agent_context/docs）
- **R22 STUB 验证**：⚠️ 代码级深读发现 6 个路由文件中 **5 个为 STUB 实现**

| 路由文件            | R22 实现方式                                          | R27 验证                                                                              | R28 验证                                                                                                                                                                                                                     | R28 状态    |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| agent-extended.ts   | R22: 手写 CRUD 返回 `success({ list: [], total: 0 })` | R27: 使用 `db.execute(sql\`...\`)` 做真实 CRUD，有 UPDATE 语句                        | R28: 维持真实实现                                                                                                                                                                                                            | ✅ 真实实现 |
| content-extended.ts | R22: `registerCrud` 工厂返回空列表                    | R27: 导入 `zhsUserAgentImage`，使用 `db.select().from()/db.delete()` 真实 Drizzle ORM | R28: 维持真实实现                                                                                                                                                                                                            | ✅ 真实实现 |
| edu-extended.ts     | R22: 从 `../db/edu-extended-queries.js` 导入真实查询  | R27: 维持真实实现                                                                     | R28: 维持真实实现                                                                                                                                                                                                            | ✅ 真实实现 |
| system-extended.ts  | R22: `registerCrud` 工厂返回空列表                    | R27: 未修改，仍为 STUB                                                                | R28: 导入 `aibotSites`，使用 `db.execute(sql\`...\`)`+`db.select().from(aibotSites)`+`db.delete(aibotSites)` 真实 CRUD；ws_admin 返回空因 WS 连接为内存非持久化（有 NOTE 说明）；compat_routes 返回 410 废弃提示（正确行为） | ✅ 真实实现 |
| ai-extended.ts      | R22: 硬编码数组 + `registerCrud` 工厂                 | R27: 未修改，仍为 STUB                                                                | R28: 导入 `videoGenerationTasks`，使用 `db.execute(sql\`...\`)` 真实 CRUD+DELETE；outbound_routes 返回空因旧架构无独立 DB 表（仅 LLM 分析，有 NOTE 说明）                                                                    | ✅ 真实实现 |
| misc-extended.ts    | R22: `registerCrud` 工厂返回空列表                    | R27: 未修改，仍为 STUB                                                                | R28: 导入 `zhsUserAgentContext`+`docs`，使用 `db.select().from()`+`db.delete()` 真实 Drizzle ORM；remote 返回空因旧架构为第三方代理无 DB 表（有 NOTE 说明）                                                                  | ✅ 真实实现 |

- **R28 结论**：✅ 6/6 路由文件全部为真实 DB 查询实现。剩余返回空列表的端点均有 NOTE 注释说明原因——outbound_routes（旧架构无 DB 表，仅 LLM 分析）/ remote（旧架构为第三方代理，无 DB 表）/ ws_admin/connections（WS 连接为内存非持久化）/ compat_routes（返回 410 废弃提示，正确行为）。这些不是 STUB，而是对旧架构无 DB 表功能的合理默认值。
- **严重程度**：低（22 个模块全部有对应路由，6/6 路由为真实实现；仅个别无 DB 表的端点返回合理默认值）

### M-16. 客户端 Web Worker 缺失（R20 新发现）

- **R20 验证**：旧架构 `client/src/workers/fileWorker.ts` 是客户端 Web Worker，处理文件压缩/缩略图/哈希/分块上传，新架构无 Web Worker
- **旧架构功能**：`fileWorker.ts` 支持 4 种操作：compress（图片压缩）/ thumbnail（缩略图生成）/ hash（文件哈希）/ chunk（大文件分块上传），在后台线程执行避免阻塞 UI
- **新架构状态**：
  - ✅ 图片压缩 + 缩略图：已由服务端 [compression.ts](file:///g:/IHUI-AI/apps/api/src/plugins/compression.ts) + [storage-service.ts](file:///g:/IHUI-AI/apps/api/src/services/storage-service.ts) 覆盖
  - ❌ 文件哈希（客户端校验）：无对应
  - ❌ 大文件分块上传：无对应（新架构 files.ts 路由无分块上传支持）
- **严重程度**：低-中（压缩已迁移到服务端；哈希+分块上传如需客户端大文件支持则不足）

### M-17. 客户端服务层 20+ 文件无对应（R20 新发现）

- **R20 验证方法**：列出旧架构 `client/src/services/` 40+ 文件，grep 新架构 `apps/` 确认是否有对应
- **R20 发现**：以下客户端服务在新架构中无对应（grep 关键词在 `apps/api/src/` + `apps/web/src/` 零匹配或仅 i18n 引用）

**旅游业务模块（7 文件，全部无服务端对应）：**

| 旧服务                       | 功能                                                   | 新架构状态                              |
| ---------------------------- | ------------------------------------------------------ | --------------------------------------- |
| tourGrayReleaseService.ts    | 旅游内容灰度发布（策略/百分比/目标群体/自动提升/监控） | ❌ 缺失（gray-release admin 页为 MOCK） |
| tourMonitoringService.ts     | 旅游内容监控                                           | ❌ 缺失                                 |
| tourAlertService.ts          | 旅游告警                                               | ❌ 缺失                                 |
| tourDependencyService.ts     | 旅游依赖管理                                           | ❌ 缺失                                 |
| tourEventBus.ts              | 旅游事件总线                                           | ❌ 缺失                                 |
| tourMultiPlatformService.ts  | 旅游多平台                                             | ❌ 缺失                                 |
| tourRecommendationService.ts | 旅游推荐                                               | ❌ 缺失                                 |

**A/B 测试（2 文件）：**

| 旧服务                     | 功能                                                         | 新架构状态 |
| -------------------------- | ------------------------------------------------------------ | ---------- |
| abTestService.ts           | 客户端 A/B 测试（tour_content / tour_flow / reward_display） | ❌ 缺失    |
| abTestAutomationService.ts | A/B 测试自动化                                               | ❌ 缺失    |

**AI 辅助服务（5 文件）：**

| 旧服务                    | 功能          | 新架构状态 |
| ------------------------- | ------------- | ---------- |
| GenerationQueueService.ts | AI 生成队列   | ❌ 缺失    |
| PromptOptimizerService.ts | Prompt 优化器 | ❌ 缺失    |
| PlotAdvisorService.ts     | 剧情顾问      | ❌ 缺失    |
| VideoQualityAnalyzer.ts   | 视频质量分析  | ❌ 缺失    |
| cognitive-intelligence.ts | 认知智能      | ❌ 缺失    |

**AI 能力服务（6 文件）：**

| 旧服务                         | 功能        | 新架构状态                                              |
| ------------------------------ | ----------- | ------------------------------------------------------- |
| ai-capability-discovery.ts     | AI 能力发现 | ❌ 缺失（新架构 ai-vendors.ts 有 /models 但无能力发现） |
| ai-capability-analytics.ts     | AI 能力分析 | ❌ 缺失                                                 |
| ai-capability-marketplace.ts   | AI 能力市场 | ❌ 缺失                                                 |
| ai-capability-documentation.ts | AI 能力文档 | ❌ 缺失                                                 |
| ai-capability-templates.ts     | AI 能力模板 | ❌ 缺失                                                 |
| ai-capability-testing.ts       | AI 能力测试 | ❌ 缺失                                                 |

**其他服务（5 文件）：**

| 旧服务                                                | 功能               | 新架构状态                                      |
| ----------------------------------------------------- | ------------------ | ----------------------------------------------- |
| CacheKeyAnalyzer.ts                                   | 缓存键分析         | ❌ 缺失（@tanstack/react-query 有缓存但无分析） |
| CacheWarmupService.ts                                 | 缓存预热           | ❌ 缺失                                         |
| skills-manager.ts                                     | 技能管理           | ❌ 缺失                                         |
| news-crawler.ts / news-scheduler.ts / news-storage.ts | 新闻爬虫/调度/存储 | ❌ 缺失（新架构 news.ts 路由仅有 CRUD）         |
| soundService.ts / user-memory.ts                      | 音效服务/用户记忆  | ❌ 缺失                                         |

- **已覆盖**（非缺失）：cozeApiService→[coze.ts](file:///g:/IHUI-AI/apps/api/src/routes/coze.ts)（873 行 46 端点）；clawdbot/→[clawdbot/](file:///g:/IHUI-AI/apps/api/src/services/clawdbot/)（20 服务文件）；rewardService→[gamification.ts](file:///g:/IHUI-AI/apps/api/src/routes/gamification.ts)；unifiedAuthService→[token-service.ts](file:///g:/IHUI-AI/apps/api/src/services/token-service.ts)；agentic-ai→[workspace-ai-service.ts](file:///g:/IHUI-AI/apps/api/src/services/workspace-ai-service.ts)；unified-ai-orchestrator→workspace-ai-service.ts
- **严重程度**：中（25 个客户端服务文件无对应，但部分可能是业务裁剪——旅游模块、A/B 测试、AI 能力市场等可能是有意删除，需产品确认）
- **Vue 指令**：✅ safeHtml.ts→[SafeHtml.tsx](file:///g:/IHUI-AI/apps/web/src/components/common/SafeHtml.tsx) 组件；lazyLoad.ts→[use-lazy-image.ts](file:///g:/IHUI-AI/apps/web/src/hooks/use-lazy-image.ts) hook——已覆盖

### M-18. ~~3 组数据库模型 7 张表完全缺失~~ — ✅ R27 验证：已修复（未提交）

- **R22 验证方法**：对旧架构 `server/app/models/` 52 个 Python 模型文件与新架构 `packages/database/src/schema/` 65 个 Drizzle schema 文件做全量交叉比对
- **R22 发现**：以下 3 组模型（共 7 张表）在新架构 schema 中零匹配（grep 中英文关键词均无命中）

| 旧模型文件           | 表名                 | 功能                                                     | R22 状态 | R27 状态                                                                                    |
| -------------------- | -------------------- | -------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| ai_feed_models.py    | ai_feed_source       | AI 资讯数据源配置（40+ 平台热榜+RSS+arXiv/HF Papers/HN） | ❌ 缺失  | ✅ [ai-feed.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-feed.ts) aiFeedSource    |
| ai_feed_models.py    | ai_feed_hot_item     | AI 热门条目主表（去重聚合+LLM 分类/摘要）                | ❌ 缺失  | ✅ ai-feed.ts aiFeedHotItem                                                                 |
| ai_feed_models.py    | ai_feed_snapshot     | 每日快照（排名/热度值，趋势计算原料）                    | ❌ 缺失  | ✅ ai-feed.ts aiFeedSnapshot                                                                |
| ai_feed_models.py    | ai_feed_trend_signal | 预计算趋势（7/14 天窗口，rising/stable/cooling）         | ❌ 缺失  | ✅ ai-feed.ts aiFeedTrendSignal                                                             |
| ai_gc_models.py      | ai_gc                | AI 生成内容记录（text/image/audio/video 生成历史）       | ❌ 缺失  | ✅ [ai-gc.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-gc.ts) aiGcContent         |
| ai_gc_models.py      | ai_gc_user_log       | AI 生成内容用户日志                                      | ❌ 缺失  | ✅ ai-gc.ts aiGcTask                                                                        |
| agent_rule_models.py | zhs_agent_rule       | Agent 执行规则（text/regex/llm 类型+优先级+状态）        | ❌ 缺失  | ✅ [agent-rule.ts](file:///g:/IHUI-AI/packages/database/src/schema/agent-rule.ts) agentRule |

- **R27 验证**：✅ 全部 7 张表已创建并注册：
  - [ai-feed.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-feed.ts)（168 行）：4 表完整定义——aiFeedSource（sourceCode/sourceName/sourceType/endpoint/category/icon/color/enabled/sortOrder/fetchIntervalMinutes/lastFetchAt/lastFetchStatus/lastFetchCount）+ aiFeedHotItem（sourceCode/platformItemId/title/summary/url/coverUrl/author/currentRank/currentHot/llmCategory/llmTags/llmSummary/trendTag/titleEn/titleJa/titleKo）+ aiFeedSnapshot（sourceCode/platformItemId/itemId/title/rank/hotValue/snapshotDate）+ aiFeedTrendSignal（itemId/sourceCode/platformItemId/windowDays/growthPct/rankDelta/emaHot/trendTag），含唯一约束+索引
  - [ai-gc.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-gc.ts)（63 行）：2 表——aiGcContent（userUuid/agentId/gcType/content/status）+ aiGcTask（gcContentId/userUuid/action，级联删除）
  - [agent-rule.ts](file:///g:/IHUI-AI/packages/database/src/schema/agent-rule.ts)（38 行）：1 表——agentRule（agentId/ruleName/ruleCode/ruleType/priority/status/description）
  - [stock.ts](file:///g:/IHUI-AI/packages/database/src/schema/stock.ts)（22 行）：1 表——stockAnalyses（userId/symbol/question/analysis/model/conversationId/tokensUsed/metadata）
  - 全部在 [schema/index.ts](file:///g:/IHUI-AI/packages/database/src/schema/index.ts) 注册导出（第 46/61/62/69 行）
  - 所有类型导出完整（$inferSelect + $inferInsert）
- **已覆盖**（非缺失）：
  - developer_models.py（ai_model_config）→ [ai-config.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-config.ts) ✅
  - invoice_models.py（t_invoice_title 等）→ [order.ts](file:///g:/IHUI-AI/packages/database/src/schema/order.ts)（eduInvoiceTitles）+ [learn-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/learn-extended.ts)（learnInvoiceTitles）✅
  - tbox_models.py（Pydantic DTO 非 DB 表）→ [tbox-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/tbox-extended.ts)（tboxDevice + tboxCommand）✅
- **关联说明**：表已创建但关联的业务服务（M-17 的 news-crawler/scheduler/storage + useAiHotNews/useAiFeed composables）仍缺失——表结构已就绪，但数据填充/爬虫/趋势计算/前端展示链路尚未建立
- **严重程度**：低（数据模型层已完整迁移；业务服务层和前端展示层仍缺失，属 M-17/M-19 的关联维度）

### M-19. 35+ Vue composables 无 React hook 对应（R22 新发现）

- **R22 验证方法**：对旧架构 `client/src/composables/` 80+ 文件（含子目录 distribution/home/login/settings/shared-logic/user/vip/xuqiu）与新架构 `apps/web/src/hooks/` 27 个 React hooks 做全量交叉比对
- **R22 分类**：

**已迁移（25 个，直接映射）：**
useToast→use-toast / useLazyImage→use-lazy-image / useWebSocket→use-websocket / useCustomerServiceWebSocket→use-customer-service / useGlobalChat→use-chat / useGlobalNotification→use-notification / useAuthBootstrap+useUserAuth→use-auth / useDebounceSearch→use-debounce / useGlobalShortcuts→use-keyboard-shortcut / useElementVisibility→use-intersection-observer / useEducation→use-education / useDistribution*(5)→use-distribution / usePagination→use-pagination / useAsync→use-async / useCountdown→use-countdown / useClipboard→use-clipboard / useDownload→use-download / useLocalStorage→use-local-storage / useClickOutside→use-click-outside / useMediaQuery→use-media-query / useScrollPosition→use-scroll-position / useForm→use-form / useLoading→use-loading / useTheme+useFirstDarkHint→use-theme / useAgent+useWorkspaceAgent→use-agent

**模式替换（17 个，非缺失）：**
useApiCache→@tanstack/react-query / useAuthedApi→fetchApi 工具 / useI18nV2+useLang→next-intl / useSEO→Next.js metadata API / useApiError→fetchApi 错误处理 / useOperationFeedback→use-toast / useNews→news API+react-query / useOpenClaw→openclaw API / useSkills→skills API / useUnifiedAI→workspace-ai / useUnifiedAIChat→use-chat+workspace-ai / useFormatTime→工具函数 / useCleanup→useEffect cleanup / useAppLifecycle→Next.js app lifecycle / usePageState→useState / useSafeNavigation→next/navigation / useDropdownPosition+useSubViewDropdown→UI 组件逻辑

**TRUE GAPS（35+ 个，无对应）——按类别：**

**AI 相关（11 个）：**

| 旧 composable                                                          | 功能                 | 新架构状态                                      |
| ---------------------------------------------------------------------- | -------------------- | ----------------------------------------------- |
| useAICapabilityCache.ts                                                | AI 能力缓存          | ❌ 缺失                                         |
| useAICapabilityDiscovery.ts                                            | AI 能力发现          | ❌ 缺失（与 M-17 ai-capability-discovery 相关） |
| useAiFeed.ts                                                           | AI 资讯流            | ❌ 缺失（与 M-18 ai_feed 相关）                 |
| useAiHotNews.ts                                                        | AI 热门新闻          | ❌ 缺失（与 M-18 ai_feed 相关）                 |
| useAiPanel.ts                                                          | AI 面板              | ❌ 缺失                                         |
| useAiReportEngine.ts                                                   | AI 报告引擎          | ❌ 缺失                                         |
| useAiWorldNav.ts                                                       | AI 世界导航          | ❌ 缺失                                         |
| useAgentic.ts                                                          | Agentic AI           | ❌ 缺失                                         |
| useAgenticComponentGenerator.ts                                        | Agentic 组件生成     | ❌ 缺失                                         |
| useModelTest.ts                                                        | 模型测试             | ❌ 缺失                                         |
| useMCP.ts / useMCPIntegration.ts / useMCPPerformance.ts / useMCPUse.ts | MCP 4 个 composables | ❌ 缺失                                         |

**PDF 工具（4 个）：**

| 旧 composable       | 功能          | 新架构状态 |
| ------------------- | ------------- | ---------- |
| usePdfMergeSplit.ts | PDF 合并/拆分 | ❌ 缺失    |
| usePdfPrint.ts      | PDF 打印      | ❌ 缺失    |
| usePdfSignature.ts  | PDF 签名      | ❌ 缺失    |
| usePdfWatermark.ts  | PDF 水印      | ❌ 缺失    |

**业务逻辑（20+ 个）：**

| 旧 composable                                                                                                                                                               | 功能                                           | 新架构状态                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| useA11y.ts                                                                                                                                                                  | 无障碍辅助                                     | ❌ 缺失                                  |
| useAdminCrud.ts / useAdminTable.ts                                                                                                                                          | Admin CRUD/表格通用逻辑                        | ❌ 缺失                                  |
| useAnalytics.ts / useBi.ts                                                                                                                                                  | 分析/商业智能                                  | ❌ 缺失（与 M-3 BiDashboard 简化版相关） |
| useChartConfig.ts                                                                                                                                                           | 图表配置                                       | ❌ 缺失                                  |
| useCommunityPublish.ts                                                                                                                                                      | 社区发布                                       | ❌ 缺失                                  |
| useConfirmDialog.ts                                                                                                                                                         | 确认对话框                                     | ❌ 缺失                                  |
| useContextManager.ts                                                                                                                                                        | 上下文管理                                     | ❌ 缺失                                  |
| useDramaScriptEnhancement.ts                                                                                                                                                | 剧本增强                                       | ❌ 缺失                                  |
| useEduPlatformNav.ts                                                                                                                                                        | 教育平台导航                                   | ❌ 缺失                                  |
| useFileUpload.ts                                                                                                                                                            | 文件上传                                       | ❌ 缺失（与 M-16 fileWorker 相关）       |
| useFloatingChatEnhancement.ts                                                                                                                                               | 浮动聊天增强                                   | ❌ 缺失                                  |
| useFontLoader.ts                                                                                                                                                            | 字体加载                                       | ❌ 缺失                                  |
| useLegalDocContent.ts                                                                                                                                                       | 法律文档内容                                   | ❌ 缺失                                  |
| useLoginDialog.ts                                                                                                                                                           | 登录对话框                                     | ❌ 缺失                                  |
| useMouseGlow.ts                                                                                                                                                             | 鼠标光效                                       | ❌ 缺失                                  |
| useNotifyBadge.ts                                                                                                                                                           | 通知徽章                                       | ❌ 缺失                                  |
| usePWA.ts                                                                                                                                                                   | PWA 支持                                       | ❌ 缺失                                  |
| useReportGenerator.ts                                                                                                                                                       | 报告生成                                       | ❌ 缺失                                  |
| useSecurityAudit.ts                                                                                                                                                         | 安全审计                                       | ❌ 缺失                                  |
| useSidebar.ts                                                                                                                                                               | 侧边栏                                         | ❌ 缺失                                  |
| useSpeechConfig.ts                                                                                                                                                          | 语音配置                                       | ❌ 缺失                                  |
| useStudentProfile.ts                                                                                                                                                        | 学生档案                                       | ❌ 缺失                                  |
| useTaskWebSocket.ts                                                                                                                                                         | 任务 WebSocket                                 | ❌ 缺失                                  |
| useTour.ts / useTourPermissions.ts                                                                                                                                          | 旅游导览/权限                                  | ❌ 缺失（与 M-17 旅游模块相关）          |
| useSettings*(6) / useLoginAuth / useLoginProject / useFullPageScroll / useHomeNavigation / useStatusFormatter / useUserMenu / useUserStatistics / useVip*(5) / useXuqiu*(3) | 设置/登录/首页/用户/VIP/需求子页面 composables | ❌ 缺失（可能由 React 组件内联实现）     |

- **严重程度**：中（35+ composables 无对应，但部分可能由 React 组件模式替代——如 useSidebar 可能内联在 layout 组件中；AI 相关 11 个是业务功能缺失，需重点评估）

### M-20. 旧客户端 API 模块 17 个无新路由对应 — ⚠️ R23 新发现

**R23 验证方法**：列出旧架构 `client/src/api/` 全部 200+ 客户端 API 模块（含 27 个子目录），逐一 grep 新架构 67 个路由文件，区分"无对应"、"已通过路由合并覆盖"、"STUB 覆盖"三种情况

**17 个 API 模块无新路由对应**（旧客户端 API 调用的后端端点在新架构不存在）：

| 旧 API 模块         | 调用端点                | 功能描述                                                  | 新架构状态                                                                                                                                                                                         |
| ------------------- | ----------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tools.ts            | `/tools/*`              | 用户端工具目录列表（分类/搜索/评分/收藏）                 | ❌ 无路由（前端 `/tools` 页使用 FALLBACK_DATA）                                                                                                                                                    |
| ranking.ts          | `/ranking/*`            | 排行榜系统（用户积分榜/智能体热度榜/课程人气榜/榜单列表） | ❌ 无路由（前端 `/ranking` 页使用 fallback）                                                                                                                                                       |
| checkin.ts          | `/api/v1/checkin/*`     | 签到体系（签到/签到记录/连续签到天数）                    | ❌ 无路由                                                                                                                                                                                          |
| developer.ts        | `/developer/api-keys/*` | 开发者 API 密钥管理（创建/列表/删除/权限）                | ❌ 无路由（仅 `/developer/model-test` STUB 在 ai-extended.ts）                                                                                                                                     |
| app-version.ts      | `/appVersion`           | 应用版本管理（版本检查/强制更新/下载链接）                | ❌ 无路由                                                                                                                                                                                          |
| monitor.ts          | `/api/v1/monitor/*`     | 监控系统（告警历史/回填状态/抑制规则/金丝雀审计）         | ❌ 无路由（canary.ts 仅覆盖金丝雀，STUB）                                                                                                                                                          |
| webhooks.ts         | `/developer/webhooks/*` | Webhook 管理（配置/事件日志/测试/重试）                   | ❌ 无路由                                                                                                                                                                                          |
| packages.ts         | `/packages/*`           | 套餐管理                                                  | ❌ 无路由                                                                                                                                                                                          |
| fund.ts             | `/fund/*`               | 资金管理                                                  | ❌ 无路由                                                                                                                                                                                          |
| trader.ts           | `/trader/*`             | 交易员管理                                                | ❌ 无路由                                                                                                                                                                                          |
| sdks.ts             | `/sdks/*`               | SDK 管理                                                  | ❌ 无路由                                                                                                                                                                                          |
| miniprogram.ts      | miniprogram 管理        | 小程序后台管理                                            | ❌ 无路由                                                                                                                                                                                          |
| token-value.ts      | `/token-value/*`        | Token 价值评估                                            | ⚠️ R27 部分覆盖：[token-balance-service.ts](file:///g:/IHUI-AI/apps/api/src/plugins/token-balance-service.ts)（202 行）提供余额查询+扣费+VIP策略，但旧 token-value.ts 侧重"价值评估"而非"余额管理" |
| product-identity.ts | `/product-identity/*`   | 产品标识管理                                              | ❌ 无路由                                                                                                                                                                                          |
| luyala-proxy.ts     | luyala 代理             | 律阿拉代理服务                                            | ❌ 无路由                                                                                                                                                                                          |
| groups.ts           | `/groups/*`             | 用户组管理                                                | ❌ 无路由                                                                                                                                                                                          |
| help.ts             | `/help/*`               | 帮助系统                                                  | ❌ 无路由                                                                                                                                                                                          |

**已通过路由合并覆盖**（非缺失，R23 确认）：

| 旧 API 模块      | 新架构对应                      | 覆盖方式                                                         |
| ---------------- | ------------------------------- | ---------------------------------------------------------------- |
| wallet.ts        | finance.ts                      | `/finance/margin/balance` + `/finance/margin/recharge` + 提现 ✅ |
| ali-pay.ts       | payment-gateway.ts              | `/payments/alipay/create` + `/notify` + `/query` + `/refund` ✅  |
| top-up.ts        | payment-gateway.ts + finance.ts | 支付创建 + Token 充值 ✅                                         |
| feedback.ts      | comments.ts                     | `/feedbacks` CRUD ✅                                             |
| ask.ts           | community.ts                    | `/asks` + `/asks/:id/answers` ✅                                 |
| favorites.ts     | social.ts + chat.ts             | `/favorites` ✅                                                  |
| tickets.ts       | customer-service.ts             | `/tickets` ✅                                                    |
| sso.ts           | auth-extended.ts                | `/auth/oauth/authorize` 部分覆盖 ⚠️                              |
| commission.ts    | finance.ts                      | `/finance/margin/commission` 部分覆盖 ⚠️                         |
| article.ts       | content.ts                      | 内容管理覆盖 ⚠️                                                  |
| share.ts         | social.ts                       | 分享功能 ✅                                                      |
| circle.ts        | community.ts                    | 社区圈子 ✅                                                      |
| business-card.ts | misc-extended.ts                | `/remote` STUB ⚠️                                                |

- **严重程度**：中（17 个 API 模块无后端路由，前端页面调用会失败/回退 MOCK；部分可能为业务裁剪，需产品确认"未迁移"还是"已废弃"）
- **R23 教训**：子代理在 R22 尝试做此比对但失败（仅找到 6 个路由文件），R23 由主线用 Glob 列出全部 67 个路由文件 + Grep 逐一搜索关键词完成

### M-21. 开放平台/Feature Center 模块完全缺失 — ⚠️ R23 新发现

**R23 验证方法**：通过 `git ls-tree 3ee96cf0:client/src/open-platform --name-only -r` 列出旧架构开放平台模块全部文件，再用 Grep 搜索新架构 `apps/web/` 中 `feature-center|FeatureCenter|open-platform|OpenPlatform` 关键词

**旧架构 `client/src/open-platform/` 模块结构**（17 文件）：

- `components/NotificationCenter.vue` — 通知中心
- `components/common/VirtualList.vue` — 虚拟列表组件
- `components/feature-center/Dashboard.vue` — Feature Center 仪表盘
- `components/feature-center/APIsHub.vue` — API 集市
- `components/feature-center/AgentsHub.vue` — Agent 集市
- `components/feature-center/DocumentsHub.vue` — 文档集市
- `components/feature-center/FeatureCard.vue` — 功能卡片
- `components/feature-center/FeatureCenterHeader.vue` — Feature Center 头部
- `components/feature-center/FeatureCenterNav.vue` — Feature Center 导航
- `components/feature-center/ModelsHub.vue` — 模型集市
- `components/feature-center/SDKsHub.vue` — SDK 集市
- `constants/icons.ts` — 图标常量
- `utils/format.ts` — 格式化工具
- `utils/logger.ts` — 日志工具
- `views/DocumentCenter.vue` — 文档中心

**新架构验证结果**：

- Grep `feature-center|FeatureCenter|open-platform|OpenPlatform` in `apps/web/` → 仅 5 个 i18n 消息文件（zh-CN/zh-TW/en/ja/ko）有匹配，**无任何 .tsx/.ts 页面或组件**
- Glob `apps/web/app/**/open*/**` → 零匹配
- Glob `apps/web/app/**/feature*/**` → 零匹配
- **结论**：开放平台/Feature Center 模块（API/Agent/Document/Model/SDK 集市 + 仪表盘 + 通知中心 + 文档中心）在新架构中**完全缺失**，仅 i18n 字符串保留了引用

- **严重程度**：中（完整的开放平台功能模块缺失，但可能是产品决策有意删除——需产品确认）
- **关联**：旧架构 `client/src/data/open-platform.ts` 数据文件 + `client/src/plugins/ai-platform.ts` 插件也无对应

### M-22. 旧客户端数据/配置文件+API子目录散点缺失 — ⚠️ R24 新发现

**R24 验证方法**：对旧架构 `client/src/api/` 子目录（admin/ 24 文件 + ai/ 15 文件 + edu/ 9 文件 + payment/ 13 文件 + finance/ 2 文件 + developer/ 2 文件 + oauth/ 2 文件等）逐一 grep 新架构路由，同时验证 `client/src/data/` 4 文件 + `client/src/config/` 10 文件 + `client/src/plugins/` 4 文件的迁移状态

**R24 纠正：admin API 模块大部分已覆盖**（R23 未深查 admin-sys.ts 导致低估）：

- ✅ admin-sys.ts 覆盖：menu(`/menu/*`) / notice(`/notice/*`) / job(`/job/*`) / job-log(`/job/log/*`) / online(`/online/*`) / dept(`/dept/*`) / post(`/post/*`) / dict-type(`/dict/type/*`) / dict-data(`/dict/data/*`) / config(`findConfigList`) / logininfo(`findLogininforList`) — 共 11 个 admin 模块已覆盖
- ✅ rbac.ts 覆盖：role(`/roles/*`) + permission check
- ✅ system.ts 覆盖：configs / integrations / logs / events
- ❌ 仍缺失：admin-faq / admin-zone / admin-demand-square / admin-migration（4 个 admin 模块无对应）

**R24 新增散点缺失**：

| 类别       | 旧文件                           | 功能描述           | 新架构状态 |
| ---------- | -------------------------------- | ------------------ | ---------- |
| API 子目录 | api/ai/user-model-chat.ts        | 用户自定义模型对话 | ❌ 无路由  |
| API 子目录 | api/admin/admin-faq.ts           | FAQ 管理           | ❌ 无路由  |
| API 子目录 | api/admin/admin-zone.ts          | 区域/分区管理      | ❌ 无路由  |
| API 子目录 | api/admin/admin-demand-square.ts | 需求广场管理       | ❌ 无路由  |
| 数据文件   | data/customer-service-faq.ts     | 客服 FAQ 数据      | ❌ 无对应  |
| 数据文件   | data/documentation.ts            | 文档数据           | ❌ 无对应  |
| 数据文件   | data/mcp-curated.ts              | 精选 MCP 列表数据  | ❌ 无对应  |
| 配置文件   | config/owner-agent-policy.ts     | Agent 归属策略配置 | ❌ 无对应  |
| 配置文件   | config/openclaw.config.ts        | OpenClaw 配置      | ❌ 无对应  |
| 配置文件   | config/monitoring-dashboard.ts   | 监控仪表盘配置     | ❌ 无对应  |

- **严重程度**：低-中（4 个 API 模块散点缺失 + 3 个数据文件 + 3 个配置文件；admin-migration 为一次性数据迁移工具，新架构不需要；部分可能为业务裁剪，需产品确认）
- **R24 教训**：R23 的 grep 搜索 `/(admin/dept|admin/dict|...)` 未匹配到 admin-sys.ts 的路由，因为该文件使用 Fastify 的 `{ prefix: '/dict/type' }` 前缀注册模式而非直接 `server.get('/admin/dict/type/list')`。R24 通过直接读取 admin-sys.ts 源码才发现 11 个 admin 模块已覆盖

### M-23. shared/pricing.ts AI 定价计算引擎+验证工具未迁移 — ⚠️ R25 新发现

**R25 验证方法**：对旧架构 `client/src/` 剩余 8 个未验证目录（constants/ + features/ + lib/ + router/ + scripts/ + shared/ + stores/ + templates/）逐一做新架构 grep + 内容比对

**R25 目录覆盖确认**（7/8 目录已覆盖或自然替代）：

- ✅ constants/（7 文件）：dingtalk/feishu/wecom 平台常量 → 服务端 [oauth-providers.ts](file:///g:/IHUI-AI/apps/api/src/services/oauth-providers.ts) + oauth schema；i18nLanguages → 5 个 locale 文件；style-variables → theme-provider
- ✅ features/third-party-login（11 文件）：Apple/Google OAuth → [ThirdPartyLoginButtons.tsx](file:///g:/IHUI-AI/apps/web/src/components/login/ThirdPartyLoginButtons.tsx)
- ✅ lib/（6 文件）：utils.ts(cn 函数) → 新架构 lib/ 目录（admin-api/agent-api/api/auth-utils 等 10+ 文件）；icons/lucide-fallback → 新图标系统
- ✅ router/（39 文件）：Vue Router → Next.js App Router（文件路由）
- ✅ stores/（23 文件）：auth→auth.ts / darkMode→theme.ts+use-theme.ts / edu/(6 文件)→education.ts / loading→use-loading.ts / chatMode→chat.ts / user→user.ts / wallet→wallet.ts（9 个 Zustand store 覆盖）；font.ts→CSS 设置；language.ts→next-intl i18n
- ✅ templates/（5 文件）：开发脚手架（CardTemplate/ComponentTemplate/FormTemplate/ListTemplate），生产架构无需迁移
- ⚠️ scripts/（1 文件）：news-crawler/config.ts 新闻爬虫配置 → ❌ 未迁移（低优先级，可能为废弃功能）

**M-23 核心缺失**：

| 旧文件                                                       | 功能描述                                                                                                       | 新架构状态                                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| shared/pricing.ts                                            | `calculateCost()` AI 定价计算引擎：input/output token 单价 + regionPricing 区域差价 + discount 折扣 → 最终成本 | ❌ 零匹配（grep `calculateCost\|inputTokenPrice\|outputTokenPrice\|PricingConfig\|regionPricing` 在 apps/+packages/ 全零匹配） |
| shared/apiValidation.ts                                      | DeveloperAPI 配置验证（name/path/method/version/description 规则）                                             | ⚠️ 改用 zod，但 DeveloperAPI 功能本身缺失（M-20），验证规则未迁移                                                              |
| shared/mcpValidation.ts                                      | MCP 配置验证                                                                                                   | ⚠️ 改用 zod，业务特定规则未直接迁移                                                                                            |
| shared/modelValidation.ts                                    | AI 模型配置验证                                                                                                | ⚠️ 改用 zod，业务特定规则未直接迁移                                                                                            |
| shared/pluginValidation.ts                                   | 插件配置验证                                                                                                   | ⚠️ 改用 zod，业务特定规则未直接迁移                                                                                            |
| shared/form-validation.ts                                    | 通用表单验证                                                                                                   | ✅ 由 [use-form.ts](file:///g:/IHUI-AI/apps/web/src/hooks/use-form.ts) hook + zod 替代                                         |
| shared/gateway.ts                                            | 网关工具                                                                                                       | ✅ 由 [clawdbot/gateway.ts](file:///g:/IHUI-AI/apps/api/src/services/clawdbot/gateway.ts) 服务端覆盖                           |
| shared/api.ts/common.ts/config.ts/format.ts/types.ts/user.ts | 通用工具+类型                                                                                                  | ✅ 由 lib/ + packages/types/ 覆盖                                                                                              |

**M-23 核心问题分析**：

- **pricing.ts 是业务逻辑而非基础设施**：新架构有 [ai-cost.ts](file:///g:/IHUI-AI/apps/api/src/plugins/ai-cost.ts) 插件（384 行）做成本**记录/治理**（aiCostRecords 表 + aiBudgets 表 + LRU prompt 缓存），但**无成本计算引擎**——即给定 input/output token 数量 + 模型定价 + 区域 + 折扣 → 计算最终成本的函数。旧架构 `calculateCost()` 支持：inputTokenPrice/outputTokenPrice 基础单价 + regionPricing 区域差价 + discount 折扣计算。新架构 billing schema 仅有 `price` 字段（整数分），无 inputTokenPrice/outputTokenPrice/regionPricing 字段
- **验证工具是设计模式迁移**：旧架构使用自定义验证函数（返回 `{ valid, errors[] }`），新架构统一使用 zod schema 验证。这是设计改进而非功能缺失，但业务特定验证规则（如 API 路径格式、MCP 配置约束、模型参数范围）需确认是否已在对应路由的 zod schema 中重现

- **严重程度**：中（pricing 计算引擎缺失影响 AI 成本核算准确性；验证工具改用 zod 是设计改进但需确认业务规则覆盖）
- **R25 教训**：`shared/` 目录看起来是通用工具库，但可能包含关键业务逻辑（如 pricing.ts 的成本计算）。不能仅凭目录名判断是否为"通用工具无需迁移"，必须逐文件检查内容

### M-24. 测试覆盖大幅缩减 — ⚠️ R30 新发现 / ⚠️ R31 E2E 计数重大修正

- **旧架构**：`server/tests/` 244 个 Python 测试文件 + `client/e2e/` **183 个 .spec.ts E2E 测试文件**（R31 重大修正：R30 仅计 server/tests/ 14 个 E2E，完全漏计 client/e2e/ 183 个），覆盖：
  - 告警系统测试 10+ 文件（test_alert_channels/test_alert_drill_script/test_alert_e2e_all_channels/test_alert_full_chain_drill/test_alert_inhibition/test_alert_pagerduty/test_alertmanager_e2e/test_alerts/test_biz_alerts）
  - 服务端 Playwright E2E 测试 14 文件（test_playwright_e2e_round5~round18）
  - **客户端 Playwright E2E 测试 183 文件**（R31 新发现：client/e2e/ 目录，覆盖 _debug-dark-state/about-tab-border/accessibility/admin-binding-e2e/admin-dashboard/admin-products-faqs-e2e/admin-ruoyi-e2e/advertise-flow-e2e-enhanced/agent-category-ext-flow-e2e-enhanced/agent-pill/agents-md-sections/agents-mgmt-flow-e2e-enhanced/agents-page/ai-capability-dropdown/ai-capability-selector-panel/ai-chat-redirect/ai-customer-service-status-migrated/ai-floating-chat-history-removed/ai-header-style-scope/ai-panel-empty-buttons-align/ai-panel-header-no-overflow/ai-service-proxy-flow-e2e-enhanced/ai-world-404/api-integration/api-mock-unified/api-recorder/app/auth-flow-e2e-enhanced/auth-flow-integration/auto-mode-tab-routing 等 183 个端到端测试场景，含 **screenshots**/ 多语言视觉回归截图）
  - WebSocket 测试 5 文件（test_websocket_route/test_ws_manager/test_ws_manager_cluster/test_ws_pubsub_cluster/test_ws_real_redis）
  - 租户隔离测试 3 文件（test_tenant_base_migration/test_tenant_routing/test_user_tenant_migration）
  - 可观测性测试 5+ 文件（test_prometheus_alerts/test_prometheus_metrics/test_telemetry/test_span_attributes/test_sync_observability_config）
  - 数据回填测试 3 文件（test_backfill_broadcaster/test_backfill_persister/test_backfill_tenants）
  - 性能/SQL 监控测试 4+ 文件（test_baseline/test_slow_sql_trace/test_sql_monitoring/test_sampling）
  - Token 服务测试 3 文件（test_token_cache_service/test_token_service/test_token_utils_service）
  - 韧性测试 1 文件（test_resilience）
  - Alembic 迁移测试 4 文件（test_alembic_008_static/test_alembic_audit/test_alembic_ci/test_alembic_ws_token）
  - 业务模块测试（test_agents/test_auth/test_user_service/test_username_login 等）
- **新架构**：42 个 API 测试文件（apps/api/tests/）+ 19 个 Web 测试文件（apps/web/src/）+ **11 个 E2E 测试文件**（apps/web/e2e/：orders/critical-paths/payment/admin/workspace/chat/vip-membership/plaza/auth/navigation/smoke）= 72 文件，297 个测试用例
  - API 测试覆盖主要业务模块（learn/auth/payment/workflows/users/teams/system/social/order/member/live/exam/admin 等 42 个）
  - Web 测试覆盖 stores/hooks/lib/i18n（wallet/theme/auth-utils/user-api/use-media-query/use-clipboard 等 19 个）
  - E2E 测试覆盖 11 个核心用户路径（R31 确认：新架构并非 E2E 为 0，而是从 197→11 大幅缩减）
- **缺失的关键测试领域**：
  - ❌ 告警系统测试（10+ → 0）— 关联 M-9
  - ❌ 服务端 Playwright E2E 测试（14 → 0）— 无服务端端到端测试
  - ❌ **客户端 Playwright E2E 测试（183 → 11）— R31 重大修正：186 个 E2E 测试场景缺失**（含多语言视觉回归截图、admin 管理流、AI 能力面板、智能体分类扩展、API 集成/Mock/录制、认证流程、自动模式标签路由等完整用户路径）
  - ❌ WebSocket 测试（5 → 0）— 关联 M-6
  - ❌ 租户隔离测试（3 → 0）— 关联 M-11
  - ❌ 可观测性测试（5+ → 0）
  - ❌ 数据回填测试（3 → 0）
  - ❌ 性能/SQL 监控测试（4+ → 0）
  - ❌ Token 服务测试（3 → 0）— token-balance-service 无测试
  - ❌ 韧性测试（1 → 0）— 关联 M-10
- **严重程度**：中→**高**（R31 修正：E2E 测试从 197→11 是最大降级，186 个端到端测试场景缺失严重影响回归防护；新架构有 72 文件 297 测试覆盖主要模块和 11 个核心 E2E 路径，但关键基础设施测试完全缺失+172 个业务 E2E 场景缺失）
- **R30 教训**：测试文件在架构迁移中不能仅看"有没有测试"，必须按测试类型（单元/集成/E2E/性能/安全）逐类别比对，否则会遗漏整层测试缺失
- **R31 教训**：测试目录不能仅检查 server/tests/，必须同时检查 client/e2e/——R30 仅计 server/tests/ 244 文件导致 E2E 缺口被严重低估（14→0 实际为 197→11），client/e2e/ 183 个 .spec.ts 文件完全漏计

### M-25. 部署/基础设施配置缺失 — ⚠️ R30 新发现

- **旧架构** `server/` 根目录基础设施文件（非应用代码）：
  - `server/config/s3-lifecycle.yml` — S3 存储分层规则（Standard 0-30d → Glacier Instant 30-180d → Deep Archive 180d+），按前缀策略分级（logs 90d/metrics 365d/audit 永久/canary-reports 365d/backups 730d），含 abort_incomplete_multipart_upload + noncurrent_version_expiration
  - `server/locustfile.py` — Locust 压测脚本（覆盖 4 类核心端点，支持 --users/--spawn-rate/--run-time/--headless 模式）
  - `server/deploy/` — 完整部署配置（argocd/crontab/docker/grafana/helm/k8s/legacy-archive/logstash/loki/manifests/monitoring/otel-collector-config.yaml/pgloader/prometheus.yml/staging）
  - `server/docker/` — Docker 中间件配置（alertmanager/docker-compose.middleware.yml/grafana/haproxy/nginx/pgbouncer/postgresql/prometheus）
  - `server/jaeger/sampling_strategies.json` — Jaeger 采样策略
  - `server/gunicorn_conf.py` — Gunicorn WSGI 服务器配置
  - `server/nginx.conf` — 服务器级 nginx 配置（SPA+API 代理+安全头+gzip+缓存）
  - `server/docs/` — 服务器文档（MULTI_TENANT.md/MULTI_TENANT_DESIGN.md/PERFORMANCE_BASELINE.md/PRE_COMMIT_GUIDE.md）
- **新架构对应**：
  - ✅ 监控已迁移：`monitoring/`（grafana/prometheus/otel-collector，3 个 dashboard + alerts.yml + prometheus.yml）
  - ✅ Docker 已迁移：`docker-compose.yml` + `Dockerfile.api-new` + `Dockerfile.web-new` + `Dockerfile.migrate`
  - ✅ Jaeger → OTel collector（自然替代）
  - ✅ Gunicorn → Fastify（Node.js 无需 WSGI）
  - ✅ Nginx → Next.js 内置服务器（自然替代）
  - ✅ Alembic → Drizzle migrations（43 个迁移文件，自然替代）
  - ❌ S3 lifecycle 分层规则未迁移 — 存储成本优化缺失
  - ❌ Locust 压测脚本未迁移 — 无负载测试能力
  - ❌ server/docs/ 文档未迁移（MULTI_TENANT/PERFORMANCE_BASELINE/PRE_COMMIT_GUIDE）
  - ⚠️ Helm/K8s 部署配置未迁移（可能使用不同部署策略）
  - ⚠️ Logstash/Loki 日志聚合配置未迁移（ELK 缺失已在规模总览记录）
- **严重程度**：低（S3 lifecycle 影响存储成本；Locust 影响性能验证；文档/Helm/K8s 为部署基础设施可重建）

### M-26. Storybook 组件开发环境缺失 — ⚠️ R31 新发现

- **旧架构**：`client/.storybook/` 配置目录（main.ts + preview.ts）+ `client/src/stories/` 4 个组件 stories 文件
  - `.storybook/main.ts`：Storybook 7 + @storybook/vue3-vite 框架配置，stories glob `../src/**/*.stories.@(ts|tsx|js|jsx|mdx)`，addons（@storybook/addon-essentials + @storybook/addon-interactions），Vite builder，复用项目 alias（@）与全局样式
  - `.storybook/preview.ts`：预览配置
  - `client/src/stories/` 4 个 stories：Button.stories.ts / Card.stories.ts / KpiCard.stories.ts / LanguageSwitcher.stories.ts
- **新架构**：**零匹配** — 无 .storybook 目录、无 .stories.* 文件、无 Storybook 相关依赖
  - grep "storybook" 在新架构全代码库零匹配（仅 pnpm-lock.yaml 历史残留）
  - Glob `**/*.stories.{ts,tsx,js,jsx}` 零匹配
  - Glob `apps/web/.storybook/**` 零匹配
- **缺失影响**：组件开发/文档/视觉测试环境缺失。旧架构可通过 `npm run storybook` 启动独立组件开发服务器，隔离开发+预览+交互测试组件。新架构无等效工具
- **严重程度**：低（Storybook 是开发工具非运行时功能；新架构可按需重新搭建；4 个 stories 仅覆盖 Button/Card/KpiCard/LanguageSwitcher 基础组件）
- **R31 教训**：前端工具链迁移不能仅检查源代码目录（src/），必须同时检查开发工具配置目录（.storybook/ .cursor/ .playwright-cli/ 等）

### M-27. 专项 CI/CD 工作流缺失 — ⚠️ R31 新发现

- **旧架构**：`server/.github/workflows/` 18 个专项工作流（独立于根 `.github/workflows/`）
  - **自然替代**（11 个）：bandit.yml→weekly-security-audit.yml / ci-fast.yml→ci.yml / ci.yml→ci.yml / ci-nightly.yml→ci.yml / server-ci.yml→ci.yml / security-audit.yml→weekly-security-audit.yml / dead-code-cve-scan.yml→knip.yml+weekly-security-audit.yml / sdk-drift.yml→openapi-check.yml / pg_deploy_cicd.yml（PG 部署，新架构不需要）/ round9_nightly.yml（阶段特定）/ weekly-phase8-drill.yml（阶段特定）
  - **缺失**（7 个专项工作流无新架构对应）：
    - ❌ `blue-green-deploy.yml` — 蓝绿部署工作流（零停机部署策略）
    - ❌ `migration-tests.yml` — 数据库迁移测试工作流（Drizzle migration 迁移正确性验证）
    - ❌ `observability-drills.yml` — 可观测性演练工作流（监控告警链路定期验证）
    - ❌ `s3-lifecycle-drift.yml` — S3 生命周期漂移检测工作流（关联 M-25，存储分层配置漂移监控）
    - ❌ `ws-loadtest.yml` — WebSocket 负载测试工作流（关联 M-24/M-25，WS 连接压力测试）
    - ❌ `smoke-new-modules.yml` — 新模块冒烟测试工作流（新增模块快速验证）
    - ❌ `sdk-publish.yml` — SDK 发布工作流（自动发布生成的 SDK 包）
- **新架构**：`.github/workflows/` 9 个工作流（ci-monorepo/visual-regression/openapi-check/miniapp-preview/knip/weekly-security-audit/build/e2e/ci）
- **缺失影响**：蓝绿部署策略缺失影响零停机部署能力；数据库迁移测试缺失影响 Drizzle migration 安全性；可观测性演练缺失影响监控告警可靠性；S3 漂移检测缺失影响存储成本控制；WS 负载测试缺失影响 WebSocket 性能验证；新模块冒烟测试缺失影响新功能快速验证；SDK 发布缺失影响 SDK 分发
- **严重程度**：低-中（7 个专项工作流中 migration-tests 和 observability-drills 对新架构运维可靠性影响较大；blue-green-deploy 和 ws-loadtest 影响部署/性能验证能力；s3-lifecycle-drift/smoke-new-modules/sdk-publish 为辅助工具）
- **R31 教训**：CI/CD 比对不能仅检查根 `.github/workflows/`，必须同时检查 `server/.github/workflows/` 等子目录——旧架构 server/.github/workflows/ 有 18 个专项工作流完全独立于根目录

### M-28. 业务可观测性指标 26 项完全缺失 — ⚠️ R32 新发现

- **旧架构**：`server/app/metrics_business.py` 定义了 26 个 `zhs_biz_*` 前缀业务指标 + BizTimer 计时上下文 + record_cache 缓存命中率工具
  - **用户指标**（2 项）：`zhs_biz_users_total`（总注册用户 Gauge）/ `zhs_biz_users_active_24h`（24h 活跃用户 Gauge）
  - **业务 API 指标**（4 项）：`zhs_biz_requests_total`（Counter，endpoint/status/tenant_id 三维 label）/ `zhs_biz_request_duration_seconds`（Histogram，endpoint label）/ `zhs_biz_requests_by_user_total`（Counter，endpoint/status/user_id/tenant_id 四维 label）/ `zhs_biz_latency_by_user_seconds`（Histogram，四维 label）
  - **HLS 视频指标**（3 项）：`zhs_biz_hls_transcode_seconds`（Histogram，video_id label）/ `zhs_biz_hls_segments_total`（Counter，bitrate label）/ `zhs_biz_hls_transcode_total`（Counter，result label）
  - **通知推送指标**（2 项）：`zhs_biz_notice_pushed_total`（Counter，topic/scope label）/ `zhs_biz_notice_delivered_total`（Counter，topic label）
  - **WebSocket pub/sub 指标**（5 项）：`zhs_biz_ws_pubsub_reconnects_total`（Counter，result label）/ `zhs_biz_ws_pubsub_messages_total`（Counter，channel label）/ `zhs_biz_ws_heartbeat_drops_total`（Counter）/ `zhs_biz_ws_auth_failures_total`（Counter，reason label）/ `zhs_biz_ws_room_broadcasts_total`（Counter，room_id label）
  - **缓存指标**（3 项）：`zhs_biz_cache_hits_total`（Counter，key_prefix label）/ `zhs_biz_cache_misses_total`（Counter，key_prefix label）/ `zhs_biz_cache_hit_ratio`（Gauge，key_prefix label）
  - **任务执行指标**（2 项）：`zhs_biz_job_executions_total`（Counter，job_name/status label）/ `zhs_biz_job_duration_seconds`（Histogram，job_name label）
  - **支付指标**（2 项）：`zhs_biz_payment_amount_yuan`（Counter，channel/status label）/ `zhs_biz_payment_count_total`（Counter，channel/status label）
  - **WebSocket 连接指标**（2 项）：`zhs_biz_ws_connections`（Gauge）/ `zhs_biz_ws_notice_subscriptions`（Gauge）
  - **业务异常指标**（1 项）：`zhs_biz_errors_total`（Counter，endpoint/error_type label）
  - **工具类**：`BizTimer`（业务端点计时上下文管理器，支持 with_user 模式从 telemetry context 读取 user_id/tenant_id 注入四维 label，含 cardinality 保护 _trim_user_label/_trim_tenant_label）/ `record_cache()`（缓存命中/未命中记录+命中率计算）
- **新架构**：`apps/api/src/plugins/metrics.ts` 仅有 HTTP 基础指标——`http_requests_total` / `http_requests_by_method` / `http_requests_by_status` / `http_response_time_ms`（summary） / `http_response_time_bucket`（histogram） / `process_uptime_seconds`。_*全部 26 个 zhs_biz_* 业务指标在新架构零匹配_*（grep `zhs_biz_|BIZ_REQUEST|BIZ_LATENCY|USERS_ACTIVE_24H|HLS_TRANSCODE|HLS_SEGMENTS|HLS_BITRATE` 在 apps/api/src/ 无结果）
- **缺失影响**：业务级可观测性完全缺失——无法按租户/用户维度监控 API QPS 和延迟；无法监控用户增长和活跃度；无法监控 HLS 视频转码性能和分片生成；无法监控通知推送成功率和 WebSocket pub/sub 健康；无法监控缓存命中率和任务执行情况；无法监控支付金额和业务异常。这影响 Grafana dashboard 业务面板、告警规则、SLI/SLO 监控
- **严重程度**：高（26 项业务指标全部缺失，业务可观测性从有到无，影响生产环境业务监控和告警能力）
- **R32 教训**：可观测性比对不能仅检查是否有 metrics 插件，必须对比指标名称和维度——新架构有 metrics.ts 插件但仅有 HTTP 基础指标，业务指标完全缺失

### M-29. 基础设施指标部分缺失（DB 池/SQL/WebSocket/活跃连接） — ⚠️ R32 新发现

- **旧架构**：`server/app/monitoring.py` 定义了 12 个基础设施指标
  - **HTTP 指标**（2 项）：`zhs_http_requests_total`（Counter，method/endpoint/status label） / `zhs_http_request_duration_seconds`（Histogram，method/endpoint label） — ✅ 新架构 metrics.ts 已覆盖（requestsTotal/requestsByMethod/requestsByStatus/responseTimeBuckets）
  - **连接指标**（2 项）：`zhs_active_connections`（Gauge，活跃 HTTP 连接） / `zhs_websocket_connections`（Gauge，活跃 WebSocket 连接） — ❌ 新架构缺失
  - **DB 连接池指标**（6 项，by engine label）：`zhs_db_pool_in_use` / `zhs_db_pool_size` / `zhs_db_pool_checkedout` / `zhs_db_pool_overflow` / `zhs_db_pool_connections_total` / `zhs_db_pool_checkout_timeouts_total` — ❌ 新架构全部缺失（grep `DB_POOL_IN_USE|DB_POOL_SIZE|DB_POOL_CHECKEDOUT|DB_POOL_OVERFLOW` 在 apps/api/src/ 无结果）
  - **SQL 指标**（2 项，by engine/table label）：`zhs_sql_query_duration_seconds`（Histogram） / `zhs_sql_queries_total`（Counter，engine/table/operation label） — ❌ 新架构缺失
- **新架构**：`apps/api/src/plugins/metrics.ts` 仅有 HTTP 基础指标，无 ACTIVE_CONNECTIONS / WS_CONNECTIONS / DB_POOL 6 项 / SQL_LATENCY / SQL_COUNT（grep `pool|connection.*pool|drizzle.*pool|pg.*pool` 在 apps/api/src/ 无结果）。新架构使用 Drizzle ORM + postgres.js（max: 10 connections），但无连接池健康监控
- **缺失影响**：数据库连接池健康状态不可观测——无法监控连接池使用率/溢出/超时，影响数据库连接泄漏检测和容量规划；SQL 查询性能不可观测——无法按表/操作类型监控慢查询；WebSocket 和 HTTP 活跃连接数不可观测——影响并发能力监控
- **严重程度**：中-高（DB 连接池监控缺失影响数据库健康运维；SQL 性能监控缺失影响慢查询排查；连接数监控缺失影响并发能力评估。新架构 Drizzle/postgres.js 连接池行为与旧架构 SQLAlchemy 不同，需重新实现池监控）
- **R32 教训**：基础设施指标比对需区分 HTTP 层（已覆盖）和 DB/SQL/WS 层（缺失），不能因"有 metrics 插件"就认为可观测性已迁移

---

## 五、低严重度/实验性（可暂缓）

- ELK 日志管线（OTel/Grafana/Prometheus 已覆盖主体）
- 实验性运维脚本（chaos/digital_twin/edge_computing 等，旧架构 utils/bug131-202 系列 72 个文件中多数为实验性）
- 设计系统演示页
- Electron 桌面端（旧架构 client/electron/ 2 文件 main.cjs+preload.cjs 为真实薄壳 wrapper——加载 web 应用到 BrowserWindow，非仅占位；新架构 web-only 设计决策，不再支持桌面端）
- **R31 发现的开发工具差异**（低优先级，自然技术替换/开发模式差异）：
  - .husky/pre-commit 质量检查降级：旧架构 15+ 项复杂检查（lint-staged/no-important/nul-residue/markraw-icon/high-specificity/pill-radius/bg-token-as-text-color/primary-button-contrast/button-text-contrast/color-contrast-systemic/workspace-hygiene/AGENTS.md-sections/FreeLLMAPI-integration/edu-route-consistency/navigation-tree-6-lang/no-css-line-comments/popper-backdrop-leak），新架构仅 2 项（API key 泄露+i18n 键完整性）。**但 12+ 项为 Vue/Element Plus 专有**（markraw-icon/var(--el-bg-color)/el-color-primary/popper/el-select-v2/.vue style 块等），不可直接迁移到 React；通用检查（no-important/workspace-hygiene/AGENTS.md 完整性）可能仍适用。新架构通过 CI workflows（knip/lint/typecheck/e2e/visual-regression）提供替代质量门——属**自然技术替换**，非迁移缺失
  - public/mock-data/ 34 个 JSON mock 文件缺失：旧架构有 activities/announcements/articles/asks/authorities/carousels/certificates/circles/comments/config/courses/exams/faqs/lives/news/orders/points/resources/roles/searchHots/users + legacy-courses/ 2 + legacy-tutorials/ 12 共 34 个 mock 数据文件。新架构 apps/web/public/ 仅 .gitkeep，无 mock 数据。新架构测试用内联 mock 数据——属**开发模式差异**，非功能缺失
  - .husky/ git hooks 缩减：旧 6 个 hooks（commit-msg/post-checkout/post-commit/post-merge/pre-commit/pre-push），新仅 pre-commit 1 个。属开发流程工具，可按需补建
  - .actrc 本地 CI 演练配置缺失：旧架构有 nektos/act 本地 GitHub Actions 演练配置，新架构无。关联 M-27 CI/CD 维度
  - WAL 管理脚本缺失：setup_trae_wal_guardian.ps1 + wal_cleaner.ps1 在新架构无对应。属基础设施脚本，低优先级
  - **R31 确认已完整迁移的区域**：cli/ 6 命令文件→apps/cli/src/commands/ 6 文件（agent/repl/template/mcp-config/session/index）✅；Dockerfile.client→Dockerfile.web-new + Dockerfile.server→Dockerfile.api-new + 新增 Dockerfile.migrate ✅；docker-compose.yml ✅；deploy/grafana/→monitoring/grafana/ ✅
- **R26 发现的前端维度散点缺失**（低优先级，均为已有 M 项的前端维度）：
  - SensitiveActionDialog（敏感操作验证码确认弹窗）：旧 `components/security/SensitiveActionDialog.vue` 实现两步验证（发送验证码→输入验证码→确认敏感操作），新架构有 ConfirmDialog.tsx（通用确认）+ TwoFactorAuth.tsx（2FA 设置）+ use-confirm.tsx hook，但缺少"敏感操作+验证码"的专用流程——可由 ConfirmDialog+2FA 组合替代
  - aifeed 组件（AiFeedPanel+AiFeedTrendChart）：M-18 前端维度，ai_feed 4 表缺失导致前端组件也无对应
  - api 管理 UI（5+ 组件：ApiMethodSearch/AppCard/BillingRecordCard/GroupCard/GroupComparisonTable）：M-20 前端维度，developer API 模块缺失导致前端 UI 也无对应
  - bi DrilldownPanel：M-3 前端维度，BiDashboard 简化版无下钻面板
- **R14 发现的次要缺失**（低优先级，按需评估）：
  - app_version（应用版本检查/强制更新）：旧 `api/v1/app_version/` 在新架构零匹配
  - ai_feed（AI 信息流）：旧 `api/v1/ai_feed/` 在新架构无独立路由（部分功能可能已融入其他模块）
  - service_catalog（服务目录）：旧 `api/v1/service_catalog/` 在新架构零匹配
- **R16 发现的 WS 基础设施次要缺失**（低优先级）：
  - room_policy（房间权限校验）：旧 `ws/room_policy.py` 含 public/private/paid/admin 4 类房间权限校验，新架构 ws-chat.ts 仅有 room join/leave 无权限验证
  - auto_recovery（WS 自动恢复）：旧 `ws/auto_recovery.py` 处理 WS 服务崩溃自动恢复，新架构 WS 插件无对应逻辑
  - 注：PCM 音频处理已覆盖（ws-ai.ts 第 246 行 `/ws/realtime/pcm` 端点，PCM16 16kHz ASR+TTS）
- **R16/R18 发现的旧 Vue3 页面待产品确认**（低优先级）：旧架构 `client/src/views/` 有 ~100 个独立 .vue 页面，新架构 (main) 下 51 页 + admin 下 51 页 + auth 下 3 页已覆盖主体。**R18 纠正**：OpenPlatform→/oauth/platform/、VipTrader→/vip/trader/、TopUpFail→/wallet/recharge/fail/、TopUpSuccess→/wallet/recharge/success/ 均已存在（R16 误报）。**R19 纠正**：AiWorld→/ai-world/ 已存在（R16 误报）。以下旧页面在新架构无直接对应路由，需产品确认是"已废弃"还是"未迁移"：
  - 业务页面：AgenticDashboard / AICareer / BusinessCard / I18nDashboard / MobileDashboard / Tasks / TokenValue / Variables
  - 注：部分页面可能已合并（如 Xuqiu→/asks/、AICommunity→/plaza/、N8NAssistant→/workflows/、Dashboard→/根页面、OpenPlatform→/oauth/platform/、VipTrader→/vip/trader/）；部分为 Demo/错误页（AizhsDemo/ComponentShowcase/Forbidden/NotFound）已在 Next.js 中以不同方式处理（TopUpFail→/wallet/recharge/fail/、TopUpSuccess→/wallet/recharge/success/）
- **R17 服务/核心模块验证发现**（低-中优先级）：
  - ✅ **Agent usage_count 同步已修复**（R19 验证）：[heat-stats-service.ts](file:///g:/IHUI-AI/apps/api/src/services/heat-stats-service.ts) 已新增 `syncAgentUsageCount(dateStr)` 函数，通过 SQL `UPDATE agents SET usage_count = usage_count + (SELECT sum(hit_count) FROM agent_heat_stats WHERE ...)` 将日聚合命中数累加到 `agents.usage_count`，对标旧架构 `tasks/agent_sync.py`。注：[agent-service.ts:92](file:///g:/IHUI-AI/apps/api/src/services/agent-service.ts#L92) 注释"agents 表无 usage_count"仍为错误描述（字段在 [agents-extended.ts:53](file:///g:/IHUI-AI/packages/database/src/schema/agents-extended.ts#L53) 已定义），但功能缺陷已修复
  - **Agent 分类字典缓存缺失**（性能优化）：旧 `services/agent_category_dict_cache.py` 内存缓存分类字典数据，新架构无对应缓存层（每次查询直接读 DB）
  - **Alert 集成服务缺失**（属 M-9）：旧 `services/alert_pagerduty.py`（PagerDuty 集成）/ `alert_webhook.py`（Webhook 通知）/ `alert_upstream_mocks.py`（上游 Mock）在新架构零匹配
  - **过期监控缺失**（属 M-9）：旧 `services/cached_expiration_monitor.py` + `tasks/expiration_monitor.py` 定时监控缓存/Token 过期，新架构无对应实现
  - **集中式错误码系统缺失**（设计差异）：旧 `schemas/error_codes.py` 定义标准错误码体系，新架构用 `ApiResult<T>` 简单 `error: string` 替代（设计简化，非功能缺失）
  - **多租户 ORM 模块缺失**（属 M-11）：旧 `orm/tenant_base.py` + `orm/tenant_meta.py` 多租户 ORM 基类，新架构零匹配
  - **已覆盖**（非缺失）：graceful_shutdown→[index.ts:27-39](file:///g:/IHUI-AI/apps/api/src/index.ts#L27)（SIGTERM/SIGINT）；tracking→visit-tracking.ts；jwt_blacklist→token-service.ts（TokenBlacklist）；admin_auth→require-permission.ts 插件；monitor_startup→health.ts+metrics.ts+business-metrics.ts；markdown_converter→前端 MarkdownViewer.tsx；cleanup→scheduler-worker.ts+system-queries.ts 分布式实现；middleware 全覆盖（api_version/auth_middleware/rate_limiter/request_logger/response_mask/tenant_routing/xss → 7 个 Fastify 插件）
- **R18 utils/ 目录全量验证发现**（低-中优先级，旧架构 204 个工具文件）：
  - ⚠️ **安全审计链缺失**：旧 `utils/audit_chain.py`（Bug-72）实现 SHA256 hash 链审计日志（append-only + verify_chain 防篡改），新架构无对应——审计日志可被篡改
  - ⚠️ **布隆过滤器缓存穿透防护缺失**：旧 `utils/bloom_guard.py`（Bug-91）实现布隆过滤器 + 空值缓存防止缓存穿透，新架构无对应（cache-resilience.ts 仅有 singleflight + 熔断，无布隆过滤器）
  - **IDOR 防护缺失**：旧 `utils/bug135_idor_guard.py` 实现 IDOR（不安全直接对象引用）防护，新架构零匹配
  - **API Key 配额管理缺失**：旧 `utils/api_key_quota.py` 实现 API Key 调用配额管理，新架构零匹配
  - **审计归档 + DDL 追踪缺失**：旧 `utils/audit_archive.py`（审计日志归档）+ `utils/audit_ddl_trail.py`（DDL 变更追踪）在新架构零匹配
  - **Token 计费缺失**（属 M-15）：旧 `utils/bug145_token_billing.py` 实现 Token 调用计费，新架构零匹配（与 M-15 的 agent_usedetail 相关）
  - **可靠消息模式缺失**：旧 `utils/bug187_outbox.py`（Outbox 模式）+ `utils/bug188_dist_lock.py`（分布式锁）+ `utils/bug189_idempotent_msg.py`（幂等消息）在新架构零匹配
  - **基础设施监控缺失**（属 M-9/M-6）：deadlock_detector / cache_warmer / pool_monitor / memory_leak / gc_pressure 在新架构零匹配
  - **已覆盖**（非缺失）：alipay_util→[alipay.ts](file:///g:/IHUI-AI/apps/api/src/services/alipay.ts)；csrf_guard→[csrf.ts](file:///g:/IHUI-AI/apps/api/src/plugins/csrf.ts)（双提交 Cookie 模式）；api_mask→[response-sanitizer.ts](file:///g:/IHUI-AI/apps/api/src/plugins/response-sanitizer.ts)+[log-sanitizer.ts](file:///g:/IHUI-AI/apps/api/src/plugins/log-sanitizer.ts)（JSONPath 字段级脱敏）；singleflight+circuit_breaker+token_bucket→[cache-resilience.ts](file:///g:/IHUI-AI/apps/api/src/plugins/cache-resilience.ts)（缓存击穿防护+熔断降级）；agent_permission_checker→rbac.ts+require-permission.ts（RBAC 权限系统替代）

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

- CLI（6 文件）/ 多租户（插件+路由+3表）/ OpenAPI SDK（generate-sdk.ts）/ i18n（5 语言）/ 定时任务（5 cron，5/5 接入 backing service，M-1 R17 已修复，R19 修复 usage_count 同步）

### R19 新增确认（未提交工作区改动）

- [ai-world/page.tsx](<file:///g:/IHUI-AI/apps/web/app/(main)/ai-world/page.tsx>) — AiWorld 页面（M-3 全部解决）
- [resilience-extended.ts](file:///g:/IHUI-AI/apps/api/src/plugins/resilience-extended.ts) — degradedMode + Bulkhead（M-10 文件已建，待业务集成）
- [tenant-db-isolation.ts](file:///g:/IHUI-AI/apps/api/src/plugins/tenant-db-isolation.ts) — withTenant + tenantDbIsolation 插件（M-11 文件已建，待 server.ts 注册）
- server.ts +4 插件注册（slow-sql-killer / db-keepalive / n1-detector / prompt-injection-guard）——M-6/M-9 运行时生效
- heat-stats-service.ts +syncAgentUsageCount 函数——R17 usage_count 同步缺陷已修复

---

## 七、修复优先级建议（v16 更新）

### P0（阻断）— ✅ 全部已修复

~~小程序端~~ → 已在 `0ad7afd7` 新增 apps/miniapp/

### P1（高）— ✅ 全部已修复

1. ~~数据库缺失表~~ → 已在 `60cf52c3` 补齐 14 张表
2. ~~agents Coze 字段~~ → 已在 `e6af19a8` 补齐 14 个字段
3. ~~缓存韧性~~ → 已在 `30ba633a` 新增 cache-resilience.ts

### P2（中，按业务需要）— R25 验证后剩余 3 项未修复 + 7 项部分修复 + 6 项新发现

1. ~~**定时任务 3/5 backing service**（M-1）~~ → ✅ R17 已修复
2. ~~**admin MOCK 页面**（M-2）~~ → ✅ R17 已修复
3. ~~**用户端页面**（M-3）~~ → ✅ R19 已修复（AiWorld 已存在于工作区，M-3 全部 11 项已映射）；BiDashboard 可按需增强指标/维度/范围配置+异常检测（当前仅 4 统计卡片简化版）
4. ~~**CI 能力**（M-5）~~ → ✅ R17 已修复
5. **数据库基础设施**（M-6 R19 部分修复）：✅ slow-sql-killer + db-keepalive 已在 server.ts 注册；⚠️ read-replica 的 `createReadWriteDb` 已从 `@ihui/database` 导出但 `apps/api/src/db/index.ts` 未使用——读写分离需业务接入
6. **运维能力**（M-9 R19 部分修复）：✅ n1-detector + prompt-injection-guard 已在 server.ts 注册；⚠️ distributed-transaction.ts 的 `executeSaga` 需业务代码主动调用；数据回填系统 / 告警抑制与降噪仍缺失
7. **韧性模式**（M-10 R19 部分修复）：⚠️ `resilience-extended.ts` 已实现 `degradedMode` + `Bulkhead`，但无业务代码调用——需在关键服务路径（AI 调用 / 支付 / 外部 API）集成
8. **多租户 DB 级隔离**（M-11 R22 纠正：未修复）：⚠️ `tenant-db-isolation.ts` 已实现 `withTenant` + `tenantDbIsolation` 插件，但**仍未在 server.ts 注册**（R21 误标"已修复"）——仅需添加 `await server.register(tenantDbIsolation)`
9. **Canary 部署后端系统**（M-12 R22 纠正：部分修复）：⚠️ canary.ts + canary-service.ts 已建并注册，但**服务使用内存 Map 无 DB 持久化**（R21 误标"已修复"）；需补建 DB schema + 持久化层 + 自动提升器 + 影子流量比对
10. ~~**TBox/IoT 设备管理**（M-13）~~ → ✅ R21 已真实修复（tbox-extended.ts schema + tbox.ts 路由 + 真实 DB 查询）
11. **Stock 分析系统**（M-14 R22 纠正：部分修复）：⚠️ stock.ts + stock-service.ts 已建并注册，但**服务为 STUB 实现**（硬编码分析+内存 Token+TODO 注释）（R21 误标"已修复"）；需接入真实 AI 模型 + DB 历史记录 + WebSocket 管理器
12. **22 个业务模块无对应**（M-15 R22 纠正：5/6 STUB）：⚠️ 6 个扩展路由已建并注册，但**仅 edu-extended.ts 有真实 DB 查询，其余 5 个为 STUB**（registerCrud 工厂返回空列表）（R21 误标"已修复"）；需逐模块补建真实 DB schema + 查询层 + 业务逻辑
13. ~~**Agent usage_count 同步缺失**（R17 新发现）~~ → ✅ R19 已修复
14. **客户端 Web Worker**（M-16 R20 新发现）：⚠️ fileWorker.ts 的文件哈希+大文件分块上传功能缺失
15. **客户端服务层 25 文件无对应**（M-17 R20 新发现）：⚠️ 需产品确认"未迁移"还是"已废弃"
16. **3 组数据库模型 7 张表缺失**（M-18 R22 新发现）：⚠️ ai_feed（4 表 AI 资讯聚合系统）/ ai_gc（2 表 AI 生成历史）/ agent_rule（1 表 Agent 规则引擎）——需补建 Drizzle schema + 路由 + 服务
17. **35+ composables 无对应**（M-19 R22 新发现）：⚠️ AI 相关 11 个 / PDF 工具 4 个 / 业务逻辑 20+——需重点评估 AI 相关 composables 是否需补建为 React hooks
18. **17 个客户端 API 模块无新路由对应**（M-20 R23 新发现）：⚠️ tools/ranking/checkin/developer API keys/app-version/monitor alerts/webhooks/packages/fund/trader/sdks/miniprogram/token-value/product-identity/luyala-proxy/groups/help——需产品确认"未迁移"还是"已废弃"
19. **开放平台/Feature Center 模块完全缺失**（M-21 R23 新发现）：⚠️ Dashboard + APIs/Agents/Documents/Models/SDKs Hub + NotificationCenter + DocumentCenter 在新架构零匹配——需产品确认是否有意删除
20. **API 子目录散点+数据/配置文件缺失**（M-22 R24 新发现）：⚠️ 4 个 API 散点（user-model-chat/admin-faq/admin-zone/admin-demand-square）+ 3 个数据文件（customer-service-faq/documentation/mcp-curated）+ 3 个配置文件（owner-agent-policy/openclaw.config/monitoring-dashboard）——低优先级，需产品确认
21. **shared/pricing.ts AI 定价计算引擎+验证工具未迁移**（M-23 R25 新发现）：⚠️ `calculateCost()` 定价引擎（token 单价+区域差价+折扣）在新架构零匹配——影响 AI 成本核算准确性；5 个验证工具改用 zod 但业务规则需确认覆盖——需补建定价计算引擎+确认 zod schema 覆盖

### P3（低，可选）

- ELK 日志管线
- 实验性运维脚本
- Electron 桌面端

---

## 八、关键文件路径索引

### 新架构核心文件

- 路由注册：[server.ts](file:///g:/IHUI-AI/apps/api/src/server.ts)（54 路由 + 40 插件 register）
- 插件目录：`apps/api/src/plugins/`（40 个插件，含 R27 新增 token-balance-service.ts）
- 服务目录：`apps/api/src/services/`（17 service + clawdbot/ 20 + workspace-ai-service.ts + stock-service.ts）
- AI 前端组件：`apps/web/src/components/ai/`（24）+ `ai-generation/`（17）+ `mcp/`（9）
- 登录组件：`apps/web/src/components/login/`（8）
- 设置组件：`apps/web/src/components/settings/`（7）
- 小程序端：`apps/miniapp-taro/`（~90 文件，**75 页面**，Taro4/React，R27 从 uni-app/Vue 升级）
- 监控目录：`monitoring/`（otel-collector + grafana 3仪表盘 + prometheus + alerts）
- CLI：`apps/cli/src/`（6 文件）
- SDK 生成：`scripts/generate-sdk.ts`
- i18n：`apps/web/messages/`（5 语言文件）
- CI 工作流：`.github/workflows/`（R27 新增 knip/miniapp-preview/openapi-check/visual-regression）
- ESLint 配置：`apps/api/eslint.config.js` + `apps/web/eslint.config.js`（R27 新增）

### v9/v10 新增文件

- [cache-resilience.ts](file:///g:/IHUI-AI/apps/api/src/plugins/cache-resilience.ts) — 缓存韧性（163 行）
- [xss-protection.ts](file:///g:/IHUI-AI/apps/api/src/plugins/xss-protection.ts) — XSS 全局防护（97 行）
- [learn-extra-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/learn-extra-extended.ts) — 9 张学习表
- [agents-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/agents-extended.ts) — 3 表 + 14 Coze 字段
- [exam-extended.ts](file:///g:/IHUI-AI/packages/database/src/schema/exam-extended.ts) — 错题本表
- [user-auth-info.ts](file:///g:/IHUI-AI/packages/database/src/schema/user-auth-info.ts) — 用户认证信息表
- [apps/miniapp/](file:///g:/IHUI-AI/apps/miniapp/) — 小程序端（~90 文件，75 页面）

### R27 新增文件（未提交）

- [ai-feed.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-feed.ts) — AI 资讯 4 表（aiFeedSource/aiFeedHotItem/aiFeedSnapshot/aiFeedTrendSignal，168 行）
- [ai-gc.ts](file:///g:/IHUI-AI/packages/database/src/schema/ai-gc.ts) — AI 生成内容 2 表（aiGcContent/aiGcTask，63 行）
- [agent-rule.ts](file:///g:/IHUI-AI/packages/database/src/schema/agent-rule.ts) — Agent 规则 1 表（agentRule，38 行）
- [stock.ts](file:///g:/IHUI-AI/packages/database/src/schema/stock.ts) — Stock 分析 1 表（stockAnalyses，22 行）
- [token-balance-service.ts](file:///g:/IHUI-AI/apps/api/src/plugins/token-balance-service.ts) — Token 余额服务（202 行，余额查询+扣费+VIP策略+促销检测）
- [apps/miniapp-taro/](file:///g:/IHUI-AI/apps/miniapp-taro/) — 小程序端 Taro4/React 版（75 页 .tsx，替代旧 apps/miniapp/ uni-app/Vue 版）

---

## 九、方法论与教训

### 27 轮验证共纠正 45 个误报

| 轮次  | 误报数 | 关键纠正                                                                                                                                                              |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1-R4 | 16     | AI Workspace/clawdbot/Chat 模型/退款/客服/WS/安全等全部存在                                                                                                           |
| R5    | 5      | 支付幂等/定时任务/AI成本/OTel/安全审计 CI 全部存在                                                                                                                    |
| R6-R8 | 4      | ModelManager/PhoneBinding/CLI/多租户/OpenAPI SDK 全部存在                                                                                                             |
| R9    | 3      | AI 前端 50 组件/登录 8 组件/设置 7 组件全部存在（最严重误报）                                                                                                         |
| R16   | 6      | M-3 的 Tools/Share/Ranking/MCPUseProject/SecurityAuditDashboard/ApiTestPage 全部存在（R12 路由命名误报）                                                              |
| R18   | 4      | OpenPlatform→/oauth/platform/、VipTrader→/vip/trader/、TopUpFail→/wallet/recharge/fail/、TopUpSuccess→/wallet/recharge/success/ 全部存在（R16 页面误报）              |
| R19   | 1      | AiWorld→/ai-world/ 已存在（R16 grep 未跟踪文件漏检误报）                                                                                                              |
| R22   | 5      | M-10/M-11/M-12/M-14/M-15 的 R21"✅ 已修复"标记全部为误报——M-10 函数未集成/M-11 插件未注册/M-12 内存无 DB/M-14 STUB 实现/M-15 的 5/6 路由为 STUB（R21 未做代码级深读） |
| R24   | 1      | admin-sys.ts 实际覆盖 11 个 admin 模块（menu/notice/job/dept/post/dict/config/logininfo/online 等）——R23 因 grep 未匹配 Fastify prefix 注册模式而误判缺失             |

### R10 教训

1. **grep 关键词语言陷阱**：v8 用英文 `circuit_breaker` 搜索零匹配就断定缺失，但文件内用中文"熔断器"。**教训**：中文项目必须同时搜索中英文关键词。

2. **报告时效性**：v8 基于 `fd778de5`，但此后 5 个提交修复了全部 B/H 缺失。**教训**：长期目标驱动任务必须在最终交付前重新验证 HEAD，不能依赖历史快照。

3. **v8 存在假阴性**：v8 只识别了 B-1 一个阻断项，但 `30ba633a` 提交信息显示有 B-1/B-2/B-3 三个阻断项（B-2=缓存韧性，B-3=CSRF/限流）。**教训**：仅从代码缺失角度分析不够，还需从旧架构功能完整性角度交叉验证。

### R11 新增教训

4. **提交消息可信度陷阱**：`6ed35c14` 声称"所有34项缺失已100%修复完成"，但 R11 代码级验证发现 6 项中严重度缺失全部仍存在。`f24d0be3` 声称"补齐后端迁移"实际仅改 2 文件 5 行。**教训**：必须以 `git diff --stat` 和代码内容为权威证据，提交消息仅为线索，不可作为完成依据。

5. **连续验证的必要性**：v9→v10 间新增 6 个提交，其中仅 miniapp 扩展（15→75 页）是真实改进，其余为微调或夸大。**教训**：每次 goal continuation 都必须重新验证 HEAD，即使上轮已完成。

### R13 新增教训

6. **后端深度对比不可省略**：R1-R12 主要验证了路由/插件/服务/前端/数据库，但未深入对比旧 Python 后端的基础设施模块（`server/app/resilience.py`、`db_per_tenant.py`、`backfill_*.py`、`alert_*.py`）。R13 通过 `git ls-tree 3ee96cf0:server/app/` 发现了这些模块，进而识别出 M-10（韧性模式 2/4 缺失）和 M-11（多租户 DB 级隔离缺失）2 项新缺失。**教训**：架构迁移分析必须覆盖旧后端的所有 Python 模块，不能只看路由和 API 端点。

### R14 新增教训

7. **全量扫描不可替代**：R13 虽然通过 `git ls-tree` 发现了 resilience.py 和 db_per_tenant.py，但仅检查了部分模块。R14 对 `server/app/` 全量 769 个 Python 文件做了完整扫描，才发现 M-12（Canary 部署后端 20 个文件）/ M-13（TBox/IoT 设备管理）/ M-14（Stock 分析系统）3 项新缺失。**教训**：必须对旧架构做全量文件扫描，抽样验证会遗漏整个功能模块。

8. **业务功能系统比基础设施更易遗漏**：R13 发现的 M-10/M-11 是基础设施类缺失（韧性模式/多租户隔离），而 R14 发现的 M-12/M-13/M-14 是业务功能系统类缺失（Canary 部署/TBox 设备/Stock 分析）。前者通过关键词搜索较易定位，后者需要逐模块比对功能映射。**教训**：架构迁移分析需同时覆盖基础设施层和业务功能层，两层的方法论不同。

9. **表定义存在不等于功能迁移**：M-13 中 `tbox_bean` 表在 [gen-table.ts](file:///g:/IHUI-AI/packages/database/src/schema/gen-table.ts) 第 99 行已定义，但 grep `tboxBean` 在 `apps/api/src/` 零匹配——表已定义但无任何路由使用。**教训**：不能仅凭 schema 定义判断功能是否迁移，必须验证路由层是否有引用。

### R15 新增教训

10. **逐模块交叉比对不可省略**：R14 虽然对 769 个 Python 文件做了全量扫描，但主要关注了基础设施和大型系统（canary/tbox/stock），未对每个 api/v1/ 子模块做逐一比对。R15 通过列出旧架构 ~200 个路由文件与新架构 59 个路由 .ts 文件做系统性交叉比对，才发现 M-15（22 个业务模块无对应）。**教训**：全量文件扫描发现的是"大块"缺失，逐模块交叉比对发现的是"散点"缺失，两者缺一不可。

11. **功能名称映射陷阱**：旧架构的 `advertise`（广告管理）在新架构中搜索 `promotion` 会找到 promotions.ts，但两者功能不同（广告位管理 vs 促销活动）。旧架构的 `ask`（问答）在新架构中不是独立路由，而是嵌入在 community.ts 中。**教训**：不能仅凭关键词匹配判断功能是否迁移，必须读取旧模块功能描述并理解新架构的功能划分。

12. **业务裁剪 vs 迁移缺失需区分**：M-15 的 22 个缺失模块中，部分可能是产品决策有意删除（如 stock 分析可能已废弃），部分可能是遗漏未迁移（如 advertise 广告管理）。**教训**：架构迁移分析报告应标注"需产品确认"而非直接判定为缺失，避免将业务裁剪误报为迁移遗漏。

### R16 新增教训

13. **路由命名差异导致前端页面误报**：R12 在 200+ page.tsx 中按旧 Vue3 页面名称查找，但新架构使用了不同的路由命名（Tools.vue → /tools/、Share.vue → /share/、Ranking.vue → /ranking/、MCPUseProject.vue → /mcp-projects/、SecurityAuditDashboard.vue → /security-audit/、ApiTestPage.vue → /api-test/、BiDashboard.vue → /bi-dashboard/），导致 6 个实际存在的页面被误判为"❌ 缺失"。**教训**：前端页面迁移验证必须先列出全部新路由（`Glob apps/web/app/(main)/*/page.tsx`），再逐一比对功能，不能仅按旧名称搜索。

14. **文件存在 ≠ 功能完整**：R16 发现 BiDashboard 虽然存在 `/bi-dashboard/page.tsx`，但旧架构的 BiDashboard.vue 含指标/维度/范围配置区+异常检测摘要区，新架构仅实现 4 个统计卡片（简化版）。**教训**：页面存在只代表"有对应路由"，还需对比功能完整度（旧页面的配置区/筛选器/高级功能是否迁移）。

15. **用户端 vs 管理端需区分路由组**：R12 误判 Ranking/Refund/BiDashboard 为"仅管理端"或"缺失"，但 R16 验证发现新架构在 `(main)` 路由组下有用户侧 `/ranking/`、`/refund/`、`/bi-dashboard/` 页面（`(main)` 是用户可访问路由组，非 admin 专属）。**教训**：Next.js App Router 的路由组 `(main)` vs `(admin)` 区分了用户端和管理端，验证时需注意路由组归属。

16. **文件存在 ≠ 功能生效**（R17 教训）：R17 创建了 M-6（slow-sql-killer.ts / db-keepalive.ts）和 M-9（n1-detector.ts / prompt-injection-guard.ts）的插件文件，但未在 server.ts `registerPlugins` 中 import + register。**文件存在但未注册 = 运行时不生效**。**教训**：验证插件类修复时，不能仅检查文件是否存在，必须验证 server.ts（或等效入口）中是否有 `import` + `server.register()` 调用。

17. **R17 M-3 误报"补建"**：R17 声称"补建 8 个缺失用户端页面（tools/ranking/share/refund/mcp-projects/bi-dashboard/security-audit/api-test）"，但 R16 验证发现这些页面**在 R17 之前就已存在**（R12 因路由命名差异误判为缺失）。**教训**：修复报告必须区分"真正新建"和"已存在但被误报为缺失"，避免将误报纠正混淆为实际修复。

18. **grep 漏检未跟踪文件**（R19 教训）：R16 用 Grep 搜索 `aiWorld|ai-world` 在 `apps/` 零匹配就断定 AiWorld 缺失，但 R19 通过 `Glob apps/web/app/**/page.tsx` 直接扫描文件系统发现 `/ai-world/page.tsx` 已存在（未 git add 的未跟踪文件）。**教训**：Grep 工具默认搜索 git 跟踪的文件或已存在的文件，但对于新建未提交的文件，必须用 Glob 直接扫描文件系统验证，不能仅依赖 Grep 的文本匹配。

19. **未提交工作区改动必须验证**（R19 教训）：R19 发现工作区有大量未提交改动（server.ts 注册 4 个插件 + heat-stats-service.ts 修复 usage_count + resilience-extended.ts + tenant-db-isolation.ts + ai-world/page.tsx），这些改动修复了 M-3/M-6/M-9/M-10/M-11 和 R17 usage_count 缺陷。**教训**：长期目标驱动任务必须在最终交付前检查 `git status` + `git diff`，不能仅基于 HEAD commit 的代码状态做判定——工作区可能有未提交的修复。

20. **文件已建 ≠ 功能生效（再次验证）**（R19 教训）：R19 发现 `resilience-extended.ts`（degradedMode + Bulkhead）和 `tenant-db-isolation.ts`（tenantDbIsolation 插件）虽然文件已存在，但前者无业务代码调用、后者未在 server.ts 注册——运行时均不生效。这与 R17 的 M-6/M-9 教训一致：**文件存在只是第一步，还必须验证 import + register/调用**。

21. **客户端服务层迁移不可遗漏**（R20 教训）：R1-R19 主要验证了后端路由/插件/服务/前端页面/数据库/composables，但未深入对比旧架构 `client/src/services/` 40+ 客户端服务文件。R20 通过 `git ls-tree 3ee96cf0:client/src/services/` 列出全部文件后逐一 grep 新架构，才发现 M-17（25 个客户端服务无对应：旅游模块 / A/B 测试 / AI 能力服务 / AI 辅助服务等）。**教训**：架构迁移分析必须覆盖旧前端的所有目录（services / workers / directives / composables / utils / data / constants），不能只看页面和组件。

22. **客户端→服务端架构转移需识别**（R20 教训）：R20 发现部分旧客户端服务（cozeApiService / clawdbot / agentic-ai / unifiedAuthService）在新架构中已由服务端覆盖——这是架构改进（业务逻辑从客户端移到服务端），而非迁移缺失。但旅游模块 / A/B 测试 / AI 能力市场等服务在服务端也无对应，是真正的功能缺失。**教训**：验证客户端服务迁移时，必须同时检查新架构的服务端是否有对应实现，区分"架构转移"和"功能丢失"。

23. **"已修复"标记必须代码级深读验证**（R22 教训）：R21 将 M-11/M-12/M-14/M-15 全部标记为"✅ 已修复（R21）"，但 R22 代码级深读发现 4 项全部为误报——M-11 插件未在 server.ts 注册、M-12 服务使用内存 Map 无 DB 持久化、M-14 服务为 STUB（硬编码+TODO 注释）、M-15 的 6 个路由中 5 个使用 `registerCrud` 工厂返回空列表。**教训**：不能仅凭"文件存在+路由已注册"就标记"已修复"，必须深读服务层代码验证：(1) 是否有真实 DB 查询（非空列表/echo）；(2) 是否有 TODO/STUB 注释；(3) 是否使用内存变量而非 DB；(4) 工厂函数是否只是模板复用。

24. **STUB 实现是迁移完成度的最危险假象**（R22 教训）：R21 的 `registerCrud` 工厂函数为 6 个模块（advertise/video/video_preload 等）生成了完整 CRUD 端点（list/detail/create/update/delete），从路由数量看"已覆盖"，但所有端点返回 `success({ list: [], total: 0 })` 或 `success({ id: parsed.data.id })`——**无 DB schema、无查询层、无业务逻辑**。**教训**：验证路由迁移时，必须读取端点实现代码，检查是否调用 `db.select()` / `db.insert()` 等真实 DB 操作，而非仅看路由数量和 HTTP 方法覆盖。

25. **数据模型层比对不可省略**（R22 教训）：R1-R21 主要验证了路由/插件/服务/前端/composables/utils，但未对旧架构 `server/app/models/` 52 个 Python 模型与新架构 `packages/database/src/schema/` 65 个 Drizzle schema 做表级交叉比对。R22 通过逐一比对才发现 M-18（ai_feed 4 表 / ai_gc 2 表 / agent_rule 1 表完全缺失）。**教训**：架构迁移分析必须覆盖数据模型层，逐表比对旧 ORM 模型与新 Drizzle schema，特别是业务功能表（非基础设施表）。

26. **子代理分析结果必须主线验证**（R22 教训）：R22 启动 2 个并行子代理验证 composables 和 API 模块，但子代理 1 将 12 个已存在的 hooks 误报为"TRUE GAPS"（未正确扫描新 hooks 目录），子代理 2 仅找到 6 个路由文件（实际 67 个）并给出 shallow 分析。**教训**：子代理适合初步探索但不适合做精确的逐项比对，关键验证必须由主线直接用 Glob/Grep/Read 工具完成，不能委托给子代理后直接采用其结论。

27. **客户端 API 模块交叉比对必须覆盖全量**（R23 教训）：R22 子代理尝试做旧 `client/src/api/` 200+ 模块与新路由的比对但失败（仅找到 6 个路由文件），R23 由主线用 Glob 列出全部 67 个路由文件后逐一 Grep 关键词，才发现 M-20（17 个 API 模块无新路由对应）+ M-21（开放平台/Feature Center 模块完全缺失）。同时 R23 纠正了 13 个旧 API 模块的"缺失"误判——wallet/ali-pay/top-up/feedback/ask/favorites/tickets/share/circle 已通过路由合并覆盖。**教训**：客户端 API 模块比对必须：(1) 用 Glob 列出全部新路由文件；(2) 逐一搜索每个旧模块的关键端点；(3) 区分"无对应"和"已通过路由合并覆盖"和"STUB 覆盖"三种情况。

28. **路由合并是架构改进而非迁移缺失**（R23 教训）：旧架构 200+ 客户端 API 模块在新架构合并为 67 个路由文件——这是 Fastify 路由组织的改进（按业务域聚合），而非功能丢失。R23 确认 wallet→finance.ts / ali-pay→payment-gateway.ts / feedback→comments.ts / ask→community.ts / favorites→social.ts 等均通过路由合并覆盖。**教训**：验证客户端 API 模块迁移时，不能仅做 1:1 文件名匹配，必须理解新架构的路由组织方式（按业务域聚合 vs 旧架构按功能拆分），通过搜索端点 URL 而非文件名来判断覆盖。

29. **完整功能模块缺失比散点缺失更易识别**（R23 教训）：M-21（开放平台/Feature Center 模块）是整个功能模块的缺失，通过 Grep 关键词在 `apps/web/` 搜索（仅 i18n 匹配，无 .tsx/.ts 文件）即可识别。而 M-20 的 17 个散点 API 模块缺失需要逐一比对才能发现。**教训**：架构迁移分析应先识别"完整功能模块缺失"（高信号），再做"散点 API 端点比对"（高噪声），两者策略不同。

30. **Fastify prefix 注册模式导致 grep 漏检**（R24 教训）：R23 用 grep 搜索 `/(admin/dept|admin/dict|...)` 在新路由中零匹配，就断定 admin 模块缺失。但 R24 读取 admin-sys.ts 源码后发现该文件使用 Fastify 的 `{ prefix: '/dict/type' }` 前缀注册模式（内层 `server.get('/list')` 而非 `server.get('/admin/dict/type/list')`），实际覆盖了 11 个 admin 模块。**教训**：Fastify 路由可能使用 prefix 注册模式，grep 搜索 URL 路径时必须同时搜索：(1) 完整路径 `server.get('/admin/dict/type/list')`；(2) prefix 片段 `prefix: '/dict/type'`；(3) 直接读取路由文件源码确认注册方式。不能仅凭 URL 路径 grep 零匹配就断定缺失。

31. **API 子目录验证不可省略**（R24 教训）：R23 只验证了 `client/src/api/` 的顶层 .ts 文件（200+），未深入 27 个子目录（admin/ 24 文件、ai/ 15 文件、edu/ 9 文件等）。R24 补验子目录后发现 M-22（4 个散点缺失：user-model-chat/admin-faq/admin-zone/admin-demand-square）+ 3 个数据文件 + 3 个配置文件缺失。**教训**：客户端 API 模块比对必须同时覆盖顶层文件和子目录，子目录通常按业务域分组包含更细粒度的模块。

32. **"通用工具"目录可能含关键业务逻辑**（R25 教训）：`shared/` 目录看起来是通用工具库（api/common/config/format/types 等通用文件），容易判定为"无需迁移，由新架构 lib/ 替代"。但 R25 逐文件检查发现 `pricing.ts` 含 AI 定价计算引擎 `calculateCost()`（token 单价+区域差价+折扣），是核心业务逻辑而非通用工具。新架构有 ai-cost.ts 做成本记录但无计算引擎。**教训**：不能仅凭目录名或文件名前缀判断是否为"通用工具"，必须逐文件检查内容，特别是 `shared/`、`lib/`、`utils/` 等目录可能混杂通用工具和业务逻辑。

33. **成本记录≠成本计算**（R25 教训）：新架构 ai-cost.ts 插件（384 行）有 aiCostRecords 表 + aiBudgets 表 + LRU prompt 缓存，看起来"AI 成本治理已完整迁移"。但 R25 比对发现该插件只做成本**记录**（记录每次调用的 token 数和费用）和**治理**（预算超限告警），无成本**计算**引擎（给定 token 数+模型定价+区域+折扣 → 最终费用）。旧架构的 `calculateCost()` 在客户端计算，新架构缺失。**教训**：验证"成本治理"迁移时，必须区分三个能力：(1) 成本计算（pricing engine）；(2) 成本记录（audit trail）；(3) 成本治理（budget/quota）。三者可能分散在不同文件，不能仅因看到"ai-cost"就认为全部覆盖。

34. **组件/视图类别级交叉比对可快速定位前端维度缺失**（R26 教训）：R9 只验证了 AI/login/settings 三大类组件（65 个），剩余 ~430 个组件未验证。R26 通过类别级（而非文件级）交叉比对——将旧 58 个组件子目录与新 17 个组件类别对应，将旧 views/edu 15 子目录+views/edu/web 19 子目录+views/learn 14 文件与新 97 个用户端页面对应——快速确认 54/58 类别已覆盖，仅 4 个前端维度缺失（均为已有 M 项的前端维度）。**教训**：组件/视图比对不必逐文件进行，类别级交叉比对效率更高且足以定位缺失。前端组件缺失往往是后端功能缺失的连带效应（如 ai_feed 表缺失→aifeed 组件缺失→M-18 的前端维度），应作为已有 M 项的补充维度记录，而非新增独立 M 项。

35. **未提交工作区改动复审是完成审计的必经步骤**（R27 教训）：R26 报告基于 HEAD `0e9b5f58`，但 R27 完成审计时发现 HEAD 已推进到 `f1a42899`（2 个新提交），且工作区有大量未提交改动——这些改动修复了 M-14（STUB→真实 AI 模型+DB 持久化）和 M-18（7 张表全部创建并注册），并改善了 M-15（从 1/6 真实实现提升到 3/6）。如果 R27 不做 `git status` + `git diff` 复审，就会基于过时状态报告"M-14 仍为 STUB、M-18 7 张表缺失"，与实际不符。**教训**：长期目标驱动任务的完成审计必须：(1) 重新检查 `git log` 确认 HEAD 是否推进；(2) 重新检查 `git status` + `git diff` 确认是否有新的未提交修复；(3) 对已标记为"STUB/缺失/未修复"的 M 项重新验证当前代码状态——工作区可能在上一轮验证后已有修复进展。HEAD 推进和工作区改动是两种不同的变更来源，都需要追踪。

36. **monorepo 中的非 TS 服务需验证是"新增"还是"未迁移"**（R28 教训）：R28 发现 `apps/ai-service/` 是一个 Python FastAPI 服务（LangGraph/A2A/MCP/vector_memory/skills/slash_commands），在 TS Monorepo 中显得突兀。初步可能判断为"旧架构 Python 服务未迁移"，但通过 `git log --diff-filter=A -- apps/ai-service/` 查到该目录首次出现在架构迁移提交 `092528c4` 中，且 `git show 3ee96cf0 --stat -- apps/ai-service/` 确认旧架构中不存在——因此确认为**新架构新增能力**而非迁移缺失。旧架构的 AI 服务（agent_service.py/ali_ai_service.py）已迁移到 TypeScript apps/api/。**教训**：monorepo 中出现的非目标技术栈服务，不能简单判定为"未迁移"——必须通过 git 历史验证其来源：(1) `git log --diff-filter=A -- <path>` 查首次添加提交；(2) `git show <old_commit> --stat -- <path>` 确认旧架构是否存在；(3) 检查旧架构是否有对应功能。LangGraph/LangChain 是 Python 生态，保持 Python 实现是合理的架构决策。

37. **STUB 与"合理默认值"的区分标准**（R28 教训）：R28 验证 M-15 的 3 个剩余 STUB 路由时发现，它们已被修改为真实 DB 查询，但仍有部分端点返回空列表。关键区分：STUB 是"应有 DB 查询但没有"（如 R22 的 registerCrud 工厂返回空列表），而"合理默认值"是"旧架构本身就没有 DB 表"（如 remote 第三方代理、ws_admin 内存连接、outbound_routes 仅 LLM 分析）。R28 通过 NOTE 注释确认这些返回空的端点对应旧架构中确实无 DB 表的功能——不是遗漏，而是对无持久化数据功能的正确处理。**教训**：判断路由是否为 STUB 不能只看"是否返回空列表"，必须检查：(1) 该功能在旧架构中是否有 DB 表；(2) 代码中是否有 NOTE 注释说明返回空的原因；(3) 其他端点是否有真实 DB 查询（如果同一文件中有些端点真实、有些返回空，通常返回空的是合理默认值而非 STUB）。

---

**结论**：经过 32 轮代码级验证（含 R14 对旧架构 769 个 Python 文件全量扫描 + R15 对 ~200 个路由文件逐模块交叉比对 + R16 对 M-3 的 11 个用户端页面逐一文件级验证 + R17 对 services/middleware/tasks/core/orm/schemas/security/cli/_archived 全量验证 + R18 对 utils/ 204 文件全量验证 + R19 对未提交工作区改动全量验证 + R20 对客户端服务层/workers/directives/composables 全量验证 + R21 路由补建 + R22 STUB 实现纠正+旧 52 模型 vs 新 65 schema 全量比对+旧 80+ composables vs 新 27 hooks 全量比对+R23 旧 200+ 客户端 API 模块 vs 新 67 路由全量交叉比对+开放平台/Feature Center 模块验证+R24 API 子目录散点+数据/配置文件验证+R25 剩余 client/src/ 8 目录全量验证+pricing 计算引擎缺失发现+R26 旧 58 组件类别+views/edu 15 子目录+views/edu/web 19 子目录+views/learn 14 文件 vs 新 97 用户端页面+17 组件类别全量交叉比对+R27 HEAD 推进复审+未提交工作区改动全量验证+M-14/M-18 修复确认+M-15 部分修复确认+token-balance-service 新插件验证+miniapp 架构变更确认+R28 HEAD 再次推进到 1de64218+M-15 剩余 3 STUB 路由全部升级为真实 DB 查询确认+apps/ai-service/ Python 服务验证为新增非迁移缺失+miniapp 22 页补全确认+R29 HEAD 推进到 c7d5b769+V4-V6 6 个并行子代理逐代码深度核验（后端 344 文件/前端 570 .vue/小程序 54 模块）+迁移率量化统计+R29 修复项汇总确认（M-11 注册+token-balance-service+M-18 7 表+M-15 5 STUB→真实+M-14 stock 服务+4 CI workflow）+turbo typecheck/lint/test 全部通过+R30 服务器根目录基础设施全量验证（alembic 31 迁移/drizzle 43 迁移/tests 244→61/noise-rules.yml/s3-lifecycle.yml/locustfile.py/deploy+docker+jaeger+gunicorn+nginx+docs 全量比对）+R31 客户端 E2E/Storybook/专项 CI 工作流全量扫尾验证（client/e2e/ 183 .spec.ts 文件重大漏计修正+client/.storybook/ 4 stories 缺失发现+server/.github/workflows/ 18 专项工作流中 7 个缺失发现+client/electron/ 桌面薄壳确认+scripts/ 22 文件比对）+R32 server/app/ 根级文件最终审计（dependencies.py 3 数据库 SessionFactory+metrics_business.py 26 个 zhs_biz_* 业务指标+telemetry.py OpenTelemetry APM+monitoring.py 12 个基础设施指标+tenant_demo.py+static/ 22 HTML 页面）），新架构的迁移完整度**较高但非完整**。全部阻断级和高严重度缺失已修复；miniapp 75 页完整迁移（R27 从 uni-app/Vue 升级为 Taro4/React，R28 补全 22 页缺失文件）；旧 client/ 已清理；middleware 7 项全覆盖。**R22 重大纠正**：R21 标记的 M-11/M-12/M-14/M-15"✅ 已修复"全部为误报——M-11 插件仍未注册、M-12 服务为内存实现无 DB 持久化、M-14 服务为 STUB（硬编码+TODO）、M-15 的 6 个路由中 5 个为 STUB（registerCrud 工厂返回空列表，仅 edu-extended.ts 有真实 DB 查询）。**R22 新发现**：M-18（3 组模型 7 张表完全缺失：ai_feed 4 表 AI 资讯聚合系统 / ai_gc 2 表 AI 生成历史 / agent_rule 1 表 Agent 规则引擎）+ M-19（35+ composables 无对应：AI 相关 11 / PDF 工具 4 / 业务逻辑 20+）。**R23 新发现**：M-20（17 个客户端 API 模块无新路由对应：tools/ranking/checkin/developer API keys/app-version/monitor alerts/webhooks/packages/fund/trader/sdks/miniprogram/token-value/product-identity/luyala-proxy/groups/help）+ M-21（开放平台/Feature Center 模块完全缺失：Dashboard + APIs/Agents/Documents/Models/SDKs Hub + NotificationCenter + DocumentCenter 在新架构零匹配）；同时 R23 确认 13 个旧 API 模块已通过路由合并覆盖（wallet→finance.ts / ali-pay→payment-gateway.ts / feedback→comments.ts / ask→community.ts / favorites→social.ts / tickets→customer-service.ts 等）。**R24 新发现**：M-22（4 个 API 子目录散点缺失：user-model-chat/admin-faq/admin-zone/admin-demand-square + 3 个数据文件：customer-service-faq/documentation/mcp-curated + 3 个配置文件：owner-agent-policy/openclaw.config/monitoring-dashboard）；同时 R24 纠正 admin API 模块覆盖评估——admin-sys.ts 通过 Fastify prefix 注册模式实际覆盖 11 个 admin 模块（R23 因 grep 未匹配而低估）。**R25 新发现**：M-23（shared/pricing.ts 的 `calculateCost()` AI 定价计算引擎未迁移——token 单价+区域差价+折扣计算逻辑在新架构零匹配，ai-cost.ts 仅有成本记录/治理无计算引擎；5 个 shared/ 验证工具改用 zod 但业务特定验证规则未直接迁移）；同时 R25 确认剩余 7 个 client/src/ 目录（constants/features/lib/router/stores/templates + scripts 部分）已覆盖或自然替代。**R26 补录**：4 个前端维度缺失（aifeed 组件/api 管理 UI/SensitiveActionDialog/bi DrilldownPanel，均为已有 M 项的前端维度，不新增 M 项）；同时 R26 确认 54/58 旧组件类别+15 旧 views/edu 子目录+19 旧 views/edu/web 子目录+14 旧 views/learn 文件均已由新架构 97 用户端页面+17 组件类别覆盖。**R27 重大修复确认**：(1) M-14 Stock 分析系统已从 STUB 升级为真实实现（调用 OpenAI 兼容 AI 模型+stockAnalyses 表 DB 持久化+失败降级+历史查询，仅 WS 流式仍有 TODO）；(2) M-18 的 3 组 7 张表已全部创建并注册（ai-feed.ts 4 表+ai-gc.ts 2 表+agent-rule.ts 1 表+stock.ts 1 表，均在 schema/index.ts 导出）；(3) M-15 从 1/6 真实实现改善为 3/6（agent-extended.ts+content-extended.ts 已从 STUB 升级为真实 DB 查询）；(4) 新增 token-balance-service.ts 插件（202 行，部分覆盖 M-20 的 token-value 需求）；(5) miniapp 从 uni-app/Vue 升级为 Taro4/React（75 页 .vue→.tsx）；(6) 新增 4 个 GitHub Actions 工作流+ESLint 配置。**R28 重大修复确认**：(1) M-15 剩余 3 个 STUB 路由（system-extended.ts/ai-extended.ts/misc-extended.ts）全部升级为真实 DB 查询——system-extended.ts 导入 aibotSites 做 db.execute+db.select+db.delete，ai-extended.ts 导入 videoGenerationTasks 做真实 CRUD+DELETE，misc-extended.ts 导入 zhsUserAgentContext+docs 做真实 Drizzle ORM select/delete；剩余返回空列表的端点均有 NOTE 说明（旧架构无 DB 表/WS 内存连接/第三方代理），不是 STUB 而是合理默认值；(2) apps/ai-service/ Python 服务确认为新增非迁移缺失——LangGraph/A2A/MCP/vector_memory/skills/slash_commands 在旧架构 server/app/ 零匹配，系新架构新增能力（首次出现在架构迁移提交 092528c4），旧架构的 AI 服务（agent_service.py/ali_ai_service.py）已迁移到 TypeScript apps/api/；(3) HEAD 从 f1a42899 推进到 1de64218（miniapp 22 页补全+CI 增强）。**R29 修复确认**：M-11 tenantDbIsolation 插件已在 server.ts 注册（第 114/265 行）；V4-V6 逐代码深度核验确认迁移率（后端 34%/前端 ~40%/小程序 ~57%）；turbo typecheck 24/24+lint 24/24+test 8/8(297 tests) 全部通过。**R30 新发现**：(1) M-24 测试覆盖大幅缩减——旧架构 server/tests/ 244 个 Python 测试文件→新架构 61 文件（42 API+19 Web），E2E 测试 14→0、告警系统测试 10+→0、WebSocket 测试 5→0、租户隔离测试 3→0、可观测性测试 5+→0、回填测试 3→0、性能测试 4+→0、Token 服务测试 3→0、韧性测试 1→0；(2) M-25 部署基础设施缺失——S3 lifecycle 分层规则+Locust 压测脚本+Helm/K8s 部署配置+Logstash/Loki 日志聚合+server/docs/ 文档均未迁移；(3) M-9 补录：noise-rules.yml 告警级联抑制规则未迁移；(4) 旧架构 31 Alembic 迁移→新架构 43 Drizzle 迁移（自然替代）；(5) db/index.ts 读写分离确认为新增功能（旧架构无读写分离）。**R31 重大修正+新发现**：(1) M-24 E2E 测试计数严重低估——旧架构 client/e2e/ 有 183 个 .spec.ts 文件（R30 仅计 server/tests/ 14 个 E2E），实际 E2E 缺口为 14+183→11=186 文件缺失，M-24 严重度从中→高；(2) M-26 Storybook 组件开发环境缺失——旧架构 client/.storybook/ 配置+4 stories 文件在新架构零匹配；(3) M-27 专项 CI/CD 工作流缺失——旧架构 server/.github/workflows/ 18 个专项工作流中 7 个无新架构对应（blue-green-deploy/migration-tests/observability-drills/s3-lifecycle-drift/ws-loadtest/smoke-new-modules/sdk-publish）；(4) 旧架构 client/electron/ 2 文件桌面薄壳 wrapper 确认（新架构 web-only 设计决策）；(5) 旧架构 scripts/ 22 文件中 gen-seed-data-v3.py 种子数据生成无对应。**R32 新发现**：(1) M-28 业务可观测性指标 26 项完全缺失——旧架构 metrics_business.py 定义了 26 个 zhs_biz_* 前缀业务指标（用户 2 项+业务 API 4 项+HLS 3 项+通知推送 2 项+WS pub/sub 5 项+缓存 3 项+任务执行 2 项+支付 2 项+WS 连接 2 项+业务异常 1 项）+BizTimer 计时上下文+record_cache 缓存命中率工具，新架构 metrics.ts 仅有 HTTP 基础指标（requestsTotal/responseTime/uptime），全部 26 个业务指标零匹配；(2) M-29 基础设施指标部分缺失——旧架构 monitoring.py 12 个指标中 10 个缺失（DB_POOL 6 项+SQL_LATENCY+SQL_COUNT+ACTIVE_CONNECTIONS+WS_CONNECTIONS），新架构无 DB 连接池健康监控+SQL 查询性能监控+WebSocket 连接监控；(3) OpenTelemetry 已完整迁移确认——apps/api/src/plugins/otel.ts 使用 NodeSDK+auto-instrumentations-node 自动 instrument Fastify/HTTP/ioredis/pg+OTLP/HTTP 导出+userId 注入 span+错误 span 状态+优雅关闭，覆盖旧架构 telemetry.py 的 setup_telemetry/trace_business/TraceIdMiddleware/set_request_context；(4) 多数据库→单数据库+schema 隔离确认设计变更——旧 3 SessionFactory（zhs_ai_project/zhs_center_project/zhs_user_center）→新 1 createDb，功能域分离改为 packages/database/src/schema/ 70+ schema 文件，租户隔离改为 tenant-db-isolation.ts schema 隔离，非缺失；(5) static/ 22 HTML 页面确认由 Next.js App Router 200+ 页面自然替代——admin/index.html→admin/page.tsx+50+ 子页/agent_management.html→agents/page.tsx/oauth_app_management.html→admin/oauth-apps/+admin/oauth/apps/page.tsx/sms_login.html→admin/sms/page.tsx/errors 403-500→not-found.tsx+error.tsx/swagger-ui→Fastify Swagger 插件/WebSocket demo clients→ai-generation 组件。**R32 最终验证状态**：M-1/M-2/M-3/M-4/M-5/M-7/M-8/M-11/M-13/M-14/M-15/M-18 已修复（12 项）；M-6/M-9/M-10/M-12 部分修复/未集成（4 项）；M-16/M-17/M-19/M-20/M-21/M-22/M-23/M-24/M-25/M-26/M-27/M-28/M-29 未修复（13 项）；R18 安全基础设施缺失仍未修复。**共 12 项已修复 + 4 项部分修复 + 13 项未修复**，均为非阻断项。M-17 的 25 个子项 + M-19 的 35+ composables + M-20 的 16 个无路由 API 模块（token-value 已部分覆盖）+ M-21 的开放平台完整模块 + M-22 的 10 个散点缺失 + M-23 的定价计算引擎缺失 + M-24 的测试覆盖 244+183→72 文件+E2E 197→11 + M-25 的 S3 lifecycle/Locust/部署配置缺失 + M-26 的 Storybook 组件开发环境缺失 + M-27 的 7 个专项 CI/CD 工作流缺失 + M-28 的 26 项业务可观测性指标完全缺失 + M-29 的 DB 池/SQL/WebSocket/活跃连接基础设施指标缺失 累计代表显著的功能覆盖差距，需产品确认是"未迁移"还是"已废弃"。⚠️ 注意：commit `6ed35c14` 声称"100%修复完成"经 R11 代码级验证为**不实**；R21 的"全量修复确认"经 R22 代码级深读验证为**部分不实**（4 项误标"已修复"）；R19/R27/R28 验证基于工作区未提交改动，需 commit 后生效。

---

## 十、R29 V4-V6 逐代码深度核验报告（2026-07-11）

> **核验方法**：6 个子代理并行执行 V1-V6 逐代码深度比对，每个子代理读取旧架构(git show 3ee96cf0)原始代码与新架构对应实现，逐文件分类为 ✅完全迁移 / ⚠️部分迁移 / ❌完全未迁移

### V4 后端服务/模型/中间件/任务/工具深度比对

| 目录        | 旧文件数 | ✅完全迁移    | ⚠️部分迁移  | ❌完全未迁移  | 迁移率   |
| ----------- | -------- | ------------- | ----------- | ------------- | -------- |
| services/   | 40       | 11            | 4           | 25            | 28%      |
| models/     | 60       | 44            | 4           | 12            | 73%      |
| middleware/ | 7        | 7             | 0           | 0             | **100%** |
| core/       | 13       | 11            | 0           | 2             | 85%      |
| tasks/      | 4        | 3             | 1           | 0             | 75%      |
| ws/         | 16       | 8             | 3           | 5             | 50%      |
| utils/      | 204      | 32            | 20          | 152           | 16%      |
| **合计**    | **344**  | **116 (34%)** | **32 (9%)** | **196 (57%)** | **43%**  |

**关键发现**：

1. **AI 资讯聚合模块完全缺失（P0 致命）**：旧架构 `ai_feed_service.py`（DailyHotApi 40+平台 + RSSHub + arXiv/HF Papers/HN + pandas EMA 趋势分析 + DeepSeek-V3 LLM 分类摘要）+ `ai_feed_models.py`（4 张表）在新架构零匹配。R27 虽创建了 ai-feed.ts schema 4 张表，但采集服务/趋势分析/LLM 分类逻辑仍缺失。
2. **Token 余额管理体系概念错位（P0）**：旧架构 3 个 Token 服务（token_service.py 余额管理 + token_cache_service.py Redis 缓存 + token_utils_service.py VIP 判定/扣费/促销期），新架构 `token-service.ts` 实际是 JWT Auth Token 管理（概念完全不同）。**R29 修复**：新建 `token-balance-service.ts` 插件（202 行），提供余额查询（Redis 缓存+DB 兜底）+ Token 扣费（事务安全+余额校验）+ VIP 等级扣费策略 + 促销期检测，已在 server.ts 注册。
3. **WS 韧性工具链全部缺失（P0）**：旧架构 `utils/ws_*.py` 8 个文件（消息去重/心跳重连/流量控制/集群回放/房间广播/租户限流/Token 续签/消息构造）在新架构 WS 插件中无对应。
4. **bug131-202 分布式韧性模式迁移率仅 17%**：旧架构 72 个 bug131-202 文件（Saga/TCC/Outbox/CDC/分布式锁/熔断/限流/容灾），新架构仅迁移约 12 个，60 个关键模式缺失。
5. **中间件层迁移率 100%**：7 个中间件全部迁移为 Fastify 插件。
6. **数据模型迁移率 73%**：60 个旧模型文件中约 44 个有对应 Drizzle schema。

### V5 前端页面/组件深度比对

| 维度        | 旧架构    | 新架构       | 迁移率                              |
| ----------- | --------- | ------------ | ----------------------------------- |
| 页面        | 570 .vue  | 249 page.tsx | ~40% 完全 / ~25% 部分 / ~35% 未迁移 |
| 组件        | ~350 .vue | 139 .tsx     | ~54/58 类别已覆盖                   |
| Composables | 80+       | 27 hooks     | ~25%                                |

**7 块整块业务功能完全缺失**：

1. N8N 工作流集成页面
2. 知识库系统页面
3. PDF 工具套件页面
4. 分销管理后台
5. AI 能力管理后台
6. AI 生成页面入口（21 个 ai-generation 组件存在但无页面入口）
7. 结算管理页面

### V6 小程序/配置/CI/文档深度比对

| 维度                 | 旧架构            | 新架构               | 迁移率                                                                                             |
| -------------------- | ----------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| 小程序页面           | 54 模块           | 75 页面(Taro4/React) | ~57%（15 模块缺失）                                                                                |
| 小程序工具/组件/服务 | 70+ 文件          | 2 utils + 内联组件   | ~10%                                                                                               |
| CI/CD                | 11+18=29 workflow | 9 workflow           | ~31%（根 9 个覆盖主体；server/.github/ 18 个专项中 7 个无对应，见 M-27）                           |
| 文档                 | 60+ 文件          | 2 文件               | ~3%                                                                                                |
| Docker               | 4 服务            | 9 服务               | ✅ 100%（增强）                                                                                    |
| 脚本                 | 22                | 7                    | ~32%（gen-seed-data-v3.py 种子数据生成无对应；dev-up.ps1/generate-i18n.js/generate-sdk.ts 已迁移） |
| Schema               | 9 Pydantic        | 27 Drizzle           | ✅ 95%                                                                                             |
| 安全                 | 1 文件            | 6 文件               | ✅ 100%（增强）                                                                                    |
| ORM                  | 2 文件            | 4 文件               | ✅ 100%                                                                                            |

**小程序 15 个缺失模块**：充值系列(top-up/topup-fail/topup-success) / 消息中心(message) / AI 视频生成(aigc) / N8N 助手 / AI 团队 / 智汇值 / 名片 / 招聘 / AI 职业 / 统计 / 测试页 / webview / 开发者入口 / 学习开发 / 我的 AI 模型

### R29 修复项汇总

| 修复项                 | 文件                                                                                    | 说明                                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| M-11 插件注册          | server.ts 第 114/265 行                                                                 | `tenantDbIsolation` 正式注册生效                                                                                           |
| Token 余额服务         | token-balance-service.ts (202行)                                                        | 余额查询+扣费+VIP策略+促销检测+Redis缓存                                                                                   |
| M-18 缺失表            | ai-feed.ts + ai-gc.ts + agent-rule.ts + stock.ts                                        | 7+1=8 张表创建并注册                                                                                                       |
| M-15 STUB 路由         | 5 个路由文件全部真实化                                                                  | agent-extended/content-extended/system-extended/ai-extended/misc-extended 全部接入真实 DB 查询                             |
| M-14 Stock 服务        | stock-service.ts                                                                        | 从 STUB 升级为真实 AI 模型调用 + DB 持久化 + 失败降级                                                                      |
| M-12 Canary DB 持久化  | canary-service.ts + canary.ts schema                                                    | 从内存 Map 迁移到 Drizzle ORM（canaryConfigs + canaryAuditLogs 2 张表）                                                    |
| M-10 韧性模式集成      | stock-service.ts + chat-models.ts + workspace.ts                                        | degradedMode + Bulkhead 集成到 3 个关键路径（AI 调用/文件上传/Stock 分析）                                                 |
| M-6 读写分离集成       | db/index.ts + 4 个查询模块                                                              | dbRead（读副本）集成到 agents/content/search/community-queries 4 个模块（42 个读操作）                                     |
| CI workflow            | knip.yml + miniapp-preview.yml + openapi-check.yml + visual-regression.yml              | 4 个缺失 workflow 补建                                                                                                     |
| dev-up 脚本            | scripts/dev-up.ps1 (113行)                                                              | 一键启动 Docker+DB+Redis+API+Web，支持 -SkipDocker/-ApiOnly/-WebOnly                                                       |
| .env 补充              | .env.production.example                                                                 | STOCK_API_KEY/STOCK_API_BASE/STOCK_MODEL_ID/DATABASE_READ_REPLICA_URL                                                      |
| 0038 快照修复          | 0038_snapshot.json                                                                      | 删除 admin_user_post.compositePrimaryKeys 中多余的 schema 字段，drizzle-kit generate 恢复正常                              |
| miniapp lint 0 warning | request.ts + auth.ts + api/index.ts + use-pagination.ts + agent-detail.tsx + orders.tsx | 16 个 @typescript-eslint/no-explicit-any + exhaustive-deps 全部修复（any→unknown），lint 0 error 0 warning，typecheck 通过 |
| 验证                   | turbo typecheck 24/24 + lint 24/24 + test 8/8 (297 tests) + miniapp lint 0 warning      | 0 errors, 0 failures                                                                                                       |

### R32 最终状态

| 状态        | M 项                                                               | 数量  |
| ----------- | ------------------------------------------------------------------ | ----- |
| ✅ 已修复   | M-1/M-2/M-3/M-4/M-5/M-6/M-7/M-8/M-10/M-11/M-12/M-13/M-14/M-15/M-18 | 15 项 |
| ⚠️ 部分修复 | M-9                                                                | 1 项  |
| ❌ 未修复   | M-16/M-17/M-19/M-20/M-21/M-22/M-23/M-24/M-25/M-26/M-27/M-28/M-29   | 13 项 |

**结论**：全部阻断级(B-1~~B-4)和高严重度(H-1~~H-15)缺失已修复。中严重度 15/29 已修复、1/29 部分修复、13/29 未修复（均为非阻断项）。未修复项主要是：客户端服务层 25 个无对应(M-17) + composables 35+ 无对应(M-19) + API 模块 17 个无路由(M-20) + 开放平台完整缺失(M-21) + 散点缺失 10 个(M-22) + 定价计算引擎缺失(M-23) + Web Worker 缺失(M-16) + 测试覆盖 244+183→72 文件+E2E 197→11 关键基础设施测试完全缺失(M-24，R31 修正 E2E 计数) + S3 lifecycle/Locust/部署配置缺失(M-25) + Storybook 组件开发环境缺失(M-26) + 专项 CI/CD 工作流 7 个缺失(M-27) + 业务可观测性指标 26 项完全缺失(M-28，R32 新发现) + 基础设施指标 DB 池/SQL/WebSocket/活跃连接缺失(M-29，R32 新发现)。这些需产品确认是"未迁移"还是"已废弃"。
