# 系统架构文档(IHUI-AI 新架构)

> 更新时间:2026-07-09(完整迁移至新 TypeScript Monorepo 架构)
> 旧架构(Python FastAPI `server/` + Vue 3 `client/`)已弃用,见文末"旧架构弃用说明"

---

## 1. 技术栈

### Monorepo
- **包管理**: pnpm 9.15 workspace + Turborepo 2.3
- **Node**: >=20.10.0
- **TypeScript**: 5.x,strict 模式,composite 项目引用

### 后端 API(`apps/api/`)
- **Framework**: Fastify 5.1 + @fastify/jwt + @fastify/websocket + @fastify/rate-limit + @fastify/static + @fastify/cors
- **ORM**: Drizzle ORM 0.38 + postgres-js 3.4
- **DB**: PostgreSQL 15
- **缓存**: Redis 7
- **认证**: @ihui/auth 共享包(JWT HS256 + token family + blacklist + OAuth2)
- **验证**: Zod 3.24
- **日志**: Pino 9.5 + pino-pretty
- **加密**: AES-256-GCM(credentials 加密)
- **密码**: bcryptjs(SHA256 兼容旧 Java 平台数据)
- **端口**: 8080

### 前端 Web(`apps/web/`)
- **Framework**: Next.js 15.1 + React 19
- **构建**: Turbopack(开发)+ Webpack(生产 standalone 输出)
- **样式**: Tailwind CSS 4 + shadcn/ui
- **状态**: @tanstack/react-query 5(服务端状态)+ Zustand(客户端状态)
- **i18n**: next-intl(zh-CN + en 双语)
- **图标**: lucide-react
- **通知**: sonner toast
- **端口**: 3000

### AI 服务(`apps/ai-service/`)
> ✅ AI 服务已**完整实现**。`apps/ai-service/` 含完整 `app/` 目录(Python 源码:routers/services/core)+ `tests/`(13 文件,400 用例)+ `pyproject.toml` + `Dockerfile` + `.env.example` + `.gitignore`。
- **Framework**: FastAPI 0.115 + Uvicorn(`app/main.py` 创建 app,注册 6 个 router + CORS 中间件)
- **AI 编排**: LangGraph 0.2(`app/services/langgraph_service.py`,StateGraph 工作流 plan → execute → summarize,含 stub 模式)
- **LLM 网关**: LiteLLM(`app/core/llm_gateway.py`,多模型统一接口,stub 模式无 API key 时返回 mock,支持 `astream` 流式输出)
- **MCP**: MCP SDK(`app/services/mcp_server.py`,11 工具 + 3 资源 + 3 提示词)
- **A2A**: Agent-to-Agent 协议(`app/services/a2a_service.py`,Redis 持久化 + 内存降级)
- **向量记忆**: `app/services/vector_memory.py`(嵌入 + 余弦相似度语义搜索)
- **端口**: 8000(docker-compose 编排,服务可正常启动)

### 共享包(`packages/`)
| 包名 | 用途 |
|------|------|
| `@ihui/database` | Drizzle schema(96 表)+ 32 迁移 + client.ts |
| `@ihui/auth` | JWT + token-family + blacklist + data-scope + OAuth2 + ws-auth |
| `@ihui/types` | user/api/ai 类型定义 |
| `@ihui/ui` | Button/Input/Label/Card/Dialog 基础组件 |
| `@ihui/config` | constants + env 配置 |
| `@ihui/eslint-config` | base/next/react ESLint 配置 |
| `@ihui/tsconfig` | base/nextjs/node/react-library TSConfig |

---

## 2. 数据库架构

### 单库设计
- **数据库**: PostgreSQL 15,单库 `ihui`,通过 schema 隔离业务域(public)
- **连接**: `DATABASE_URL` 环境变量,postgres-js 驱动
- **ORM**: Drizzle ORM,schema 定义在 `packages/database/src/schema/`(34 文件,96 表)

### Schema 模块覆盖(34 文件)
users, projects, files, files-extra, notifications, billing, audit, chat, teams, rbac, workflow, comments, promotions, gamification, content, system, social, community, learn, exam, order, live, member, resource, point, usercenter, schedule, statistics, message, topic, behavior, visit-tracking, oss, setting

### 迁移管理
- **迁移目录**: `packages/database/drizzle/`
- **迁移文件**: 32 个 SQL 文件(`0000` ~ `0031`)
- **Journal**: `meta/_journal.json` 追踪全部 32 个迁移(drizzle-kit generate 生成 + 手动增量)
- **执行**: `drizzle-kit migrate` 或 `pnpm --filter @ihui/database db:migrate`

---

## 3. API 路由架构

### 路由组织(`apps/api/src/routes/`,37 文件,447 端点)

所有路由在 `server.ts` 的 `registerRoutes()` 中注册,分两类:

**公共路由**(前缀 `/api`):
auth, users, billing, content, comments, promotions, gamification, social, community, learn, exam, order, live, member, resource, point, usercenter, schedule, statistics, message, topic, behavior, visit-tracking, oss, setting, teams, chat, notifications, search, files, workspace, workflows, audit, health

**管理员路由**(前缀 `/api/admin`):
admin(dashboard),users, roles, permissions, projects, orders, workflows, tags, settings, feedbacks, announcements, docs, help, configs, integrations, logs, events, statistics, behavior, visit-tracking, oss, edu-settings, content

### 响应格式(统一)
```typescript
// 成功: { code: 0, message: 'success', data: T }
// 错误: { code: number, message: string }
// 由共享 utils/response.ts 的 success()/error() 生成
```

### 认证
- JWT access token(7d) + refresh token(token-family 旋转)
- `@ihui/auth` 共享包签发/验证
- 公开端点(topics/resources/live 等)无需认证
- 管理员端点(`roleId >= 1`)通过 plugin-level preHandler 统一鉴权

### WebSocket 端点(`apps/api/src/plugins/ws-*.ts`,12 端点)

REST 路由之外的实时双向通信,按 plugin 分组:

| Plugin | 端点 | 用途 |
|--------|------|------|
| `ws-notifications.ts` | `/ws/notifications` | 全局通知推送(多端同步,Redis Pub/Sub 广播) |
| `ws-chat.ts` | `/ws/room/:roomId` | 聊天室消息(多用户房间,Redis Pub/Sub) |
| `ws-customer-service.ts` | `/ws/customer-service` | 客服会话(1对1) |
| `ws-payment.ts` | `/ws/payment/status/:orderNo` | 支付状态实时更新 |
| `ws-broadcast.ts` | `/ws/broadcast` | 通用广播 |
| `ws-ai.ts` | `/ws/agent/stream` | Agent 流式输出(步骤/工具调用/思考,interrupt/continue/cancel) |
| `ws-ai.ts` | `/ws/tts/stream` | TTS 流式合成(文本→音频,支持中断) |
| `ws-ai.ts` | `/ws/realtime/pcm` | 双向实时音频(ASR 输入 + TTS 输出,PCM16 16kHz) |
| `ws-ai.ts` | `/v1/ai/capabilities/ws/stream` | 通用 AI 能力流(capability.start/delta/done,代理到 AI-service SSE) |
| `ws-ai.ts` | `/ws/stock/stream` | 股票行情流 |
| `ws-ai.ts` | `/ws/timbre/generate` | 音色克隆生成流 |
| `ws-ai.ts` | `/ws/coze/chat` | Coze 对话流 |

**鉴权**:所有 WS 端点通过 `wsAuth(socket, token)` 校验 JWT(token 从 query string 读取),失败则关闭连接。
**心跳**:客户端发送 `ping`/`{"type":"ping"}`,服务端响应 `pong`。
**多实例**:ws-notifications + ws-chat 通过 Redis Pub/Sub 跨实例广播;其余端点为 1:1 连接(单用户独占),不依赖 Redis。

> WebSocket 端点不纳入 OpenAPI 3.0 spec(协议不兼容),文档化在此处 + 各 plugin 的 JSDoc 注释。如需机器可读规范,建议使用 AsyncAPI。

---

## 4. 前端架构

### 路由组织(`apps/web/app/`,83 页面)

**认证区 `(auth)/`**: login, register

**主区 `(main)/`**: 81 页面
- 用户端: workspace, search, chat(含 history/favorites), favorites, following, settings, notifications, user(profile/security/orders/notifications/[id]), tags(含 [slug]), orders(含 [id]), payment(含 checkout), teams(含 [id]), announcements(含 [id]), help(含 [slug]), docs(含 [slug]), feedback(含 [id]), invitations, activities(含 [slug]), circles(含 [id]), asks(含 [id]), topics, learn(含 [id]), exam(含 [id]), resources, live, members, points(含 sign-in), edu-points, subscriptions, messages, schedule, user-center, models
- 管理端 admin/: dashboard, users, roles, permissions, projects, orders, workflows, tags, settings, feedbacks, announcements, docs, help, configs, integrations, logs, events, statistics, behavior, visit-tracking, oss, edu-settings

### API 调用
- 统一封装 `src/lib/api.ts`(`fetchApi<T>`),自动携带 JWT,解析 `{ code, message, data }`
- React Query 管理服务端状态,全局 `mutations.onError` 自动 toast.error
- API 调用 100% 有后端支持(架构迁移覆盖率审计:447 端点对齐)

### i18n
- next-intl,zh-CN + en 双语
- 68 命名空间,所有 `t('key')` 调用 100% 有对应翻译定义

---

## 5. AI 服务架构

> ✅ AI 服务已**完整实现**。`apps/ai-service/app/` 目录及全部模块均已实现,代码完整可运行。

### 服务模块(`apps/ai-service/app/`)(已实现)

**路由(routers/)**(已实现): a2a(5 端点), agents(9 端点), health(4 端点), llm(2 端点), mcp(10 端点), tools(3 端点)
- 所有 router 在 `app/main.py` 中以 `prefix="/api"` 注册,完整路径形如 `/api/llm/complete`、`/api/mcp/tools`、`/api/agents/execute`、`/api/a2a/agents`、`/api/tools/search-codebase`
- router 内置各自前缀(`/llm`、`/mcp`、`/agents`、`/a2a`、`/tools`),health router 无内置前缀

**服务(services/)**(已实现):
- `langgraph_service.py`: StateGraph 工作流(plan → execute → summarize),含 stub 模式
- `agent_loop.py`: Agent 执行器,带任务跟踪
- `mcp_server.py`: 11 MCP 工具(search_codebase/read_file/write_file/run_command/web_search/file_search/git_operations/db_query/analyze_code/generate_test/refactor_code)+ 3 资源(memory/skills/config)+ 3 提示词(code_review/bug_fix/feature_plan)
- `a2a_service.py`: Agent-to-Agent 协议,Redis 持久化 + 内存降级
- `vector_memory.py`: 向量记忆(嵌入 + 余弦相似度语义搜索)
- `memory.py`(Redis + 内存降级)、`skills.py`(6 skills: code-review/bug-fix/feature-plan/refactor-helper/api-designer/test-writer)、`slash_commands.py`(12 命令: goal/loop/skill/plan/bug/improve/status/version/clear/help/model/config)

**核心(core/)**(已实现): config(Pydantic Settings,小写字段名)、llm_gateway(LiteLLM 网关,含 stub 模式)、logging(日志配置)、sse_buffer(SSE 事件缓冲,断线重连重放)

---

## 6. 启动流程

### 开发环境
```bash
# 1. 启动数据库和 Redis
docker compose up -d db redis

# 2. 安装依赖
pnpm install

# 3. 运行数据库迁移
pnpm --filter @ihui/database db:migrate

# 4. 启动后端(端口 8080)
pnpm --filter @ihui/api dev

# 5. 启动前端(端口 3000)
pnpm --filter @ihui/web dev

# 6. 启动 AI 服务(端口 8000,可选) — 已完整实现,可直接启动
cd apps/ai-service && pip install -e . && uvicorn app.main:app --reload
```

### 生产环境(Docker)
```bash
# 配置 .env(JWT_SECRET, DB_PASSWORD, CREDENTIALS_ENCRYPTION_KEY 等)
# 一键启动全部服务
docker compose up -d
# 服务: api(8080) + web(3000) + ai-service(8000) + db(5432) + redis(6379)
```

### 验证
```bash
pnpm turbo typecheck lint test  # 22/22 tasks, 268/268 tests, 0 errors + 0 warnings
```

---

## 7. 测试架构

### 后端测试(apps/api/tests/,38 文件,268 用例)
- Vitest,Fastify inject 模式(不监听端口)
- Mock 数据库层(queries/billing-queries/content-queries 等)
- 覆盖:auth/billing/content/success-paths/business-logic/edge-cases/topic/resource/live 等

### 前端测试
- ESLint(0 errors + 0 warnings)
- TypeScript strict typecheck
- Playwright E2E 配置就绪(`playwright.config.ts`)

### AI 服务测试(apps/ai-service/tests/,13 文件,400 用例)
- pytest,覆盖全部 services/routers/core 模块
- 13 文件: conftest.py, test_a2a_service.py, test_agent_loop.py, test_health.py, test_langgraph_service.py, test_llm_gateway.py, test_mcp_server.py, test_memory.py, test_routers.py, test_skills.py, test_slash_commands.py, test_sse_buffer.py, test_vector_memory.py
- 400 用例全部通过

---

## 8. 可观测性

### 日志
- **后端**: Pino 结构化日志(JSON),LOG_LEVEL 可配
- **前端**: 浏览器 console(生产构建自动移除)
- **AI 服务**: Python 标准库 logging,通过 `app/core/logging.py` 配置(已实现)

### 健康检查
- `GET /health` - 后端综合健康(DB + Redis 探针)
- `GET /health/live` - Liveness
- `GET /health/ready` - Readiness
- AI 服务: `app/routers/health.py` 提供 4 个端点:`GET /`、`GET /health`、`GET /health/live`、`GET /health/ready`(已实现)

### API 日志
- `api-logger.ts` 插件:内存缓冲 + 定时批量写入(默认 100 条/5s flush)
- 采样策略:2xx 按采样率(默认 10%),4xx/5xx 全量记录
- 存储到 `api_logs` 表,支持管理端查询

---

## 9. 安全设计

### 认证安全
- JWT HS256 + token-family 旋转(防盗用)
- refresh token 黑名单
- rate-limit 分层:全局 100/min,auth login/register 10/min

### 数据安全
- credentials AES-256-GCM 加密(OSS 驱动凭证 + 教育设置凭证)
- 密码 bcryptjs 哈希(member 表 SHA256 兼容旧 Java 数据)
- password/passwordHash 字段在 API 响应中解构剥离(members/user-center)

### 事务安全
- DB 事务化:order 支付/退款 + social tag + gamification 积分 + chat 清空消息
- `.for('update')` 行锁防 TOCTOU 竞态

---

## 10. 基础设施即代码(IaC)决策

### 决策结论

新架构 **不采用** Kubernetes + Helm + ArgoCD 的重型 IaC 方案,改用 **Docker Compose + shell 脚本** 作为生产部署基底,以 GitOps 工作流(CI/CD via GitHub Actions)替代 ArgoCD。

### 取舍说明

| 维度 | K8s + Helm + ArgoCD | Docker Compose + GitHub Actions(本架构选) |
|------|---------------------|------------------------------------------|
| **运维门槛** | 需 K8s 集群管理员 + Helm chart 维护 + ArgoCD 配置 | 单台 VM 即可部署,Docker Compose 通用技能 |
| **资源开销** | 控制平面 ≥ 2 vCPU / 4GB 内存,小项目浪费 | 仅业务容器,无控制平面开销 |
| **部署速度** | 镜像推送 → ArgoCD 同步 → 滚动更新(30s-2min) | `docker compose pull && up -d`(10-30s) |
| **回滚能力** | ArgoCD 一键回滚到任意历史版本 | `docker compose rollback`(需自实现镜像 tag 切换) |
| **可观测性** | 内置 Prometheus + Grafana + Loki 全栈 | 已用 Prometheus + Grafana + Alertmanager(本架构已就绪) |
| **横向扩展** | 原生支持 HPA/VPA 自动伸缩 | 需 Nginx upstream + 多实例手动配置 |
| **故障转移** | Pod 自动重调度 + readiness/liveness probe | Docker `restart: unless-stopped` + healthcheck |
| **适用规模** | > 10 微服务 / 多团队协作 / 跨集群 | ≤ 5 服务 / 单团队 / 单集群(本架构:api + web + ai-service + db + redis) |

### 本架构已具备的 K8s 替代能力

1. **声明式编排**:`docker-compose.yml` 描述 7 服务(api/web/ai-service/db/redis/migrate/otel-collector)+ 依赖关系 + healthcheck + 资源限制
2. **配置外置**:`.env.production` + `.env.example` 占位符,不入库敏感数据
3. **CI/CD**:`.github/workflows/ci.yml` 全量 typecheck + lint + test + build;`.github/workflows/lighthouse-ci.yml` 性能预算门禁
4. **本地 CI 演练**:`.actrc` + `.env.act` + `.secrets.act.example` 用 nektos/act 在本地完整跑 GitHub Actions
5. **健康检查**:`/api/health` 端点 + Docker healthcheck + Alertmanager 告警规则
6. **零停机部署**:DEPLOYMENT_RUNBOOK.md 文档化蓝绿部署流程(镜像 tag 切换 + Nginx upstream 切换)
7. **可观测性**:Prometheus 抓取 + Grafana 7 dashboard(已在 `monitoring/grafana/dashboards/`)+ Alertmanager 噪声规则
8. **密钥管理**:`CREDENTIALS_ENCRYPTION_KEY` + AES-256-GCM 加密 + cert/ 目录 .gitignore 忽略
9. **数据库迁移**:`Dockerfile.migrate` + `docker-compose migrate` 服务,独立容器跑 drizzle migrate 后退出
10. **回滚**:PostgreSQL pg_dump 备份 + Docker 镜像 tag 历史保留 + drizzle 迁移可回滚

### 何时迁移到 K8s

触发以下任一条件,应评估迁移到 K8s:
- 业务服务 > 10 个,跨多个独立团队协作
- 需要跨可用区/跨地域多活
- 单 VM 资源触顶(CPU > 70% 持续 / 内存 > 80%)
- 需要基于流量指标的自动伸缩(HPA)
- 多租户隔离要求提升到 namespace 级别

### 迁移路径(预留)

如未来迁移到 K8s,本架构的 Dockerfile 可直接复用为 K8s 容器镜像,只需新增:
- `deploy/helm/` Helm chart(values.yaml + deployment.yaml + service.yaml + ingress.yaml)
- `deploy/argocd/` ArgoCD Application 清单
- `.github/workflows/build-push.yml` 镜像构建推送 workflow
- K8s secrets 从 `.env.production` 转换为 SealedSecrets

当前架构已为这一迁移预留:所有配置通过环境变量注入,无硬编码路径;Dockerfile 已是多阶段构建,镜像精简;healthcheck 端点已就绪,可直接作为 K8s readiness/liveness probe。

---

## 11. 部署脚本盘点

### 已有运维脚本(`scripts/` + `apps/api/scripts/`)

#### 部署与发布
- `scripts/pre-deploy.mjs` — 生产部署前 10 项硬性门禁自检(typecheck + lint + test + i18n parity + migration + 页面/端点存在性 + env vars + gap report + git 状态)
- `scripts/dev-up.ps1` — 开发环境一键启动(web + api + ai-service + DB + Redis)
- `scripts/git-push-retry.ps1` — git push 失败自动重试(处理 pre-push hook 不稳定)
- `scripts/typecheck-full.mjs` — 全量 typecheck(10 包)

#### 数据库运维
- `apps/api/scripts/pg-backup.mjs` — PostgreSQL 备份
- `apps/api/scripts/check-db.mjs` — DB 连接 + 关键表存在性检查
- `apps/api/scripts/check-db-state.mjs` — DB 状态深度检查
- `apps/api/scripts/check-user-fks.mjs` — 用户表外键完整性
- `apps/api/scripts/apply-006X.mjs`(7 个) — 历史迁移补丁应用器(已合并到 drizzle,保留作存档)
- `apps/api/scripts/verify-rls.mjs` / `verify-0066.mjs` / `verify-system-admin.mjs` — RLS 与管理员账号验证
- `apps/api/scripts/init-vendor-configs.ts` — 厂商 LLM 配置初始化
- `scripts/grant-ihui-superuser.mjs` — 数据库 superuser 授权
- `scripts/setup-admin-account.mjs` — 管理员账号初始化
- `scripts/check-db-schema-drift.mjs` — schema 漂移检测

#### 测试与验证
- `apps/api/scripts/smoke-test-api.mjs` — API 烟雾测试
- `apps/api/scripts/seed-test-users.ts` — 测试用户种子
- `apps/api/scripts/cleanup-test-users.mjs` — 测试用户清理
- `apps/api/scripts/probe-exp-monitor*.mjs` — 实验性监控探针
- `scripts/test-admin-e2e.ps1` — 管理员 E2E 测试
- `scripts/test-llm-connection.mjs` — LLM 连接验证
- `scripts/verify-cli-*.mjs`(3 个) — CLI 子命令验证

#### 证书与安全
- `scripts/cert-expiry-check.mjs` — 证书到期检查
- `scripts/cert-renew-watchdog.mjs` — 证书续期看门狗
- `scripts/fetch-wechat-platform-cert.mjs` — 微信支付平台证书获取
- `scripts/check-api-key-leak.mjs` — API key 泄露扫描
- `scripts/check-sanitizer-bypass.mjs` — XSS sanitizer 绕过检测

#### i18n 与代码质量
- `scripts/check-i18n-keys.mjs` / `check-i18n-gap.cjs` / `deep-i18n-audit.mjs` — i18n 完整性审计(3 工具)
- `scripts/fix-i18n-deep.mjs` / `fix-missing-i18n-keys.mjs` / `fix-zh-tw-simp.mjs` / `fix-zhtw-parity.mjs` — i18n 修复(4 工具)
- `scripts/translate-i18n-batch.mjs` / `apply-i18n-translations.mjs` / `sync-i18n-fixes.mjs` — i18n 翻译工作流
- `scripts/export-untranslated-i18n.mjs` / `scan-zh-tw-untranslated.mjs` — 未翻译导出
- `scripts/check-rounded-full.mjs` / `fix-rounded-full.mjs` — rounded-full 违规扫描与修复
- `scripts/check-api-routes.mjs` / `find-route-conflicts.mjs` / `generate-stub-routes.mjs` — 路由完整性
- `scripts/check-delivery-report-consistency.mjs` — 交付报告一致性守门(pre-commit hook)
- `scripts/guard-push-other-agent-changes.mjs` — 跨 Agent 改动保护(pre-push hook)
- `scripts/openapi-check.mjs` — OpenAPI 规范检查
- `scripts/check-stale-dist.mjs` — 陈旧 dist 检测

### 旧架构脚本迁移结论

旧架构 `D:\历史项目存档\edu client\scripts\` 共 30 个 .js/.java/.sql 文件,均为一次性数据修复脚本(check_*.js / fix_*.js / create_*.js / update_*.js 等),其功能在新架构中等价物已就绪:
- 数据校验 → drizzle schema + typecheck + `apps/api/scripts/check-db*.mjs`
- 数据修复 → drizzle 迁移文件 `packages/database/drizzle/00XX_*.sql`(106 个,覆盖全部历史补丁)
- 数据初始化 → `packages/database/seed/*`(7 步幂等 seed 流程)
- 视频上传 → `scripts/video-ops.mjs`(已迁移)
- SQL 脚本 → drizzle 迁移文件

**结论**: 旧架构脚本无真实遗漏,无需补充迁移。

---

## 旧架构弃用说明

以下目录为旧架构代码,已弃用,不再维护:

| 目录 | 旧技术栈 | 状态 |
|------|---------|------|
| `server/` | Python FastAPI + SQLAlchemy 2.0 | 已弃用,新后端在 `apps/api/` |
| `client/` | Vue 3 + Vite + Element Plus + Pinia | 已弃用,新前端在 `apps/web/` |
| `Dockerfile.server` | 旧 Python 后端镜像 | 已弃用,新镜像用 `Dockerfile.api-new` |
| `Dockerfile.client` | 旧 Vue nginx 镜像 | 已弃用,新镜像用 `Dockerfile.web-new` |

旧架构的迁移参考:
- 多 Engine 数据库(3 engine)→ 新架构单库单 engine
- v1/v2/v3 路由共存 → 新架构统一 `/api` + `/api/admin`
- SQLite dev fallback → 新架构仅 PostgreSQL
- loguru 日志 → Pino 结构化日志
- PyJWT → @ihui/auth 共享包
- Prometheus + OpenTelemetry → api-logger 批量写入 + Pino
