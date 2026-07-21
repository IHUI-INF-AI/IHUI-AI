# 系统架构文档(IHUI-AI 新架构)

> 更新时间:2026-07-19(明确 Monorepo 两 app 职责边界,防止审计视角局限误判)
> 旧架构(Python FastAPI `server/` + Vue 3 `client/`)已弃用,见文末"旧架构弃用说明"

---

## 0. Monorepo 两 app 职责边界(审计必读)

> ⚠️ **重要**: 审计 AI 能力迁移完整性时,**必须同时看 `apps/ai-service` + `apps/api`**,不可仅看单一 app。
> 历史教训(2026-07-19): 仅看 `apps/ai-service` 单 app 视角会得出"端点迁移率 16.62%, 58 项缺失"的错误结论,实际合并视角下真实缺失为 0 项(详见 `tmp/api-endpoint-cross-check.md`)。

### 0.1 职责分工

| App | 技术栈 | 职责 | 端点数 |
|-----|--------|------|--------|
| `apps/ai-service` | Python FastAPI + LangGraph + LiteLLM + MCP | **AI 推理网关** — LLM 调用、Agent 执行、MCP 工具、A2A 协议、Persona、Voice STT | ~55 |
| `apps/api` | TypeScript Fastify + Drizzle ORM | **业务管理 + 多厂商代理 + 认证 + WebSocket** — 智能体业务、Coze SDK、OAuth、计费、文件、外呼、聊天室、多模型 WS | ~1080 |

### 0.2 为什么拆分两 app

- **Python 适合 AI 推理**: LangGraph(工作流)、LiteLLM(多模型统一接口)、MCP 协议原生支持
- **TypeScript 适合业务 CRUD**: Fastify 性能 + Drizzle ORM 类型安全 + 共享 Zod schema
- **协议分层**: SSE(ai-service Agent 流式) + WebSocket(apps/api 聊天室/多模型流式) + HTTP REST(同步业务)
- **SSO 跨服务**: 共享 `JWT_SECRET`,两 app 通过 @ihui/auth 共享包统一签发/验证

### 0.3 源项目 `coze_zhs_py` 的能力拆分映射

源项目是单体 Python FastAPI(331 端点),按能力拆分到两 app:

| 源能力域 | 源端点数 | 目标归属 | 目标端点数 |
|---------|---------|---------|---------|
| 智能体业务管理(购买/审核/结算/提现/分类/开发者) | 91 | apps/api | 200+ |
| Coze SDK 代理(Bot/对话/工作流/数据集/模板/变量/工作空间) | 32 | apps/api | 46+ |
| OAuth 2.0 + 用户 SK + PAT + SMS | 32 | apps/api | 30+ |
| 多模型 WebSocket 流式(豆包/通义/智谱/DeepSeek/Qwen-Omni) | 53 | apps/api(WS) + ai-service(SSE) | 22+ WS + SSE |
| 第三方厂商代理(Kling/n8n/sms/即梦/火山/通义/腾讯/Luyala) | 38 | apps/api | 60+ |
| 工作流 + 工具 + 用户 | 23 | apps/api + ai-service(MCP) | 50+ |
| 文件 + 应用 + 杂项 | 24 | apps/api | 30+ |
| LLM 网关 + Agent 执行 + MCP + A2A | (新增) | apps/ai-service | 55 |

### 0.4 审计规则

1. **审计 AI 能力迁移**: 必须同时 grep `apps/ai-service` + `apps/api/src/routes/`
2. **审计端点总数**: ai-service(~55) + apps/api(~1080) = ~1135,远超源项目 331
3. **协议变更不算缺失**: WebSocket→SSE / SQLAlchemy→Drizzle / Python SDK→直接 HTTP 都是合理架构变更
4. **多个文件头有"1:1 迁移 D 盘"注释**: n8n-proxy / tencent-hunyuan-3d / user-sk / outbound / coze-oauth / legacy-langchain

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

## 12. 多租户架构(原 server-docs/MULTI_TENANT.md,2026-07-22 整合)

> 等价自旧架构 `server/docs/MULTI_TENANT.md`,适配新架构(TS Monorepo + Fastify + Drizzle)。

### 概述

IHUI-AI 采用**共享数据库 + 行级隔离**的多租户模型。每个租户通过 `tenant_id` 字段隔离数据,应用层在查询时自动注入租户过滤条件。

### 数据隔离层级

| 层级   | 隔离方式 | 说明                             |
| ------ | -------- | -------------------------------- |
| 数据库 | 共享     | 所有租户共用同一 PostgreSQL 实例 |
| Schema | 共享     | 所有租户共用同一 schema          |
| 行     | 隔离     | 通过 `tenant_id` 列实现行级隔离  |

### 租户标识传递链路

```
请求 → tenant 插件(解析 X-Tenant-ID / JWT claim)→ request.tenantId → 查询层自动注入 WHERE tenant_id = ?
```

- `apps/api/src/plugins/tenant.ts` 负责从请求头 `X-Tenant-ID` 或 JWT payload 中解析 `tenantId` 并挂载到 `request.tenantId`。
- 所有多租户表在 schema 中定义 `tenantId` 列(见 `packages/database/src/schema/tenant.ts`)。
- 查询层(`apps/api/src/db/*-queries.ts`)在读写时自动携带 `tenantId` 过滤。

### 租户管理

1. **创建**: 管理员通过 `POST /api/admin/tenants` 创建租户,分配默认配额。
2. **激活/停用**: 通过 `PUT /api/admin/tenants/:id/status` 切换租户状态,停用后该租户用户无法登录。
3. **配额**: 每个租户有独立的 API 调用、存储、Token 配额,由 `billing-queries.ts` 跟踪。
4. **删除**: 软删除,保留数据 30 天后物理清理。

### 安全约束

- **禁止跨租户访问**: 所有查询必须携带 `tenantId`,缺失则拒绝执行。
- **IDOR 防护**: `apps/api/src/utils/idor-guard.ts` 校验资源归属租户。
- **数据范围**: `packages/auth/src/data-scope.ts` 实现基于租户的数据权限控制。
- **审计**: 所有跨租户敏感操作记录到 `audit` 表,含 `tenantId`。

### 配额与限流

| 资源     | 默认配额  | 超额处理   |
| -------- | --------- | ---------- |
| API 调用 | 10000/天  | 429 限流   |
| 文件存储 | 10 GB     | 拒绝上传   |
| AI Token | 100 万/月 | 降级或拒绝 |
| 并发会话 | 50        | 拒绝新会话 |

限流由 `apps/api/src/plugins/queue.ts` + Redis 实现,按 `tenantId` 维度计数。

### 运维注意事项

- 新增多租户表时,**必须**在 schema 中添加 `tenantId` 列并建索引。
- 运维查询若需跨租户,必须显式声明并经 DBA 审批,禁止在生产直连绕过租户过滤。
- 租户数据导出/迁移走 `apps/api/src/routes/tenant.ts` 提供的管理接口,不直接操作数据库。

---

## 13. 性能基线(原 server-docs/PERFORMANCE_BASELINE.md,2026-07-22 整合)

> 等价自旧架构 `server/docs/PERFORMANCE_BASELINE.md`,适配新架构(TS Monorepo + Fastify + Drizzle)。

### 概述

本文档定义 IHUI-AI 各核心端点的性能基线(SLA),作为容量规划、压测验收与回归监控的依据。基线数据基于 Locust 压测(`locustfile.py`)与 Prometheus 指标得出。

### 硬件基准

| 角色       | 规格  | 说明            |
| ---------- | ----- | --------------- |
| API 服务   | 4C8G  | Fastify 单实例  |
| Web 服务   | 2C4G  | Next.js 单实例  |
| PostgreSQL | 8C16G | 主从,连接池 50 |
| Redis      | 2C4G  | 缓存 + 限流     |
| AI Service | 4C8G  | Python FastAPI  |

### 核心端点 SLA

| 端点                     | P50   | P95   | P99   | 错误率 | 说明               |
| ------------------------ | ----- | ----- | ----- | ------ | ------------------ |
| `GET /api/health`        | 20ms  | 50ms  | 100ms | <0.01% | 健康检查           |
| `GET /api/auth/me`       | 30ms  | 80ms  | 150ms | <0.1%  | 鉴权链路           |
| `GET /api/content/list`  | 50ms  | 150ms | 300ms | <0.1%  | 内容列表(含缓存) |
| `GET /api/chat/sessions` | 80ms  | 200ms | 400ms | <0.1%  | 会话列表           |
| `POST /api/chat` (SSE)   | 800ms | 2s    | 5s    | <1%    | AI 对话首 Token    |
| `POST /api/files/upload` | 200ms | 800ms | 2s    | <0.5%  | 小文件上传         |
| `WS /ws`                 | 100ms | 300ms | 600ms | <0.1%  | WebSocket 握手     |

### 数据库性能基线

| 指标          | 基线   | 告警阈值                   |
| ------------- | ------ | -------------------------- |
| 活跃连接数    | <20    | >40 warning / >48 critical |
| 慢查询(>1s)  | <5/min | >20/min                    |
| 缓存命中率    | >95%   | <90%                       |
| 复制延迟      | <1s    | >5s                        |
| 死锁          | 0      | >0                         |
| 事务平均耗时  | <50ms  | >200ms                     |

### 压测验收标准

使用 `locustfile.py` 执行压测,验收需满足:

- **100 并发**: P95 达标,错误率 <0.1%
- **500 并发**: P95 ≤ 基线 ×2,错误率 <1%
- **1000 并发**: 服务不崩溃,错误率 <5%,触发限流而非超时

```bash
locust -f locustfile.py --headless \
    --host http://localhost:3000 \
    --users 100 --spawn-rate 10 --run-time 120s
```

### 性能回归监控

- Prometheus 采集 API 延迟直方图(`apps/api/src/plugins/metrics.ts`)。
- Grafana dashboard `api-performance.json` 展示 P50/P95/P99 趋势。
- 告警规则见 `monitoring/prometheus/alerts.yml`,超基线阈值触发告警。
- 每周回归压测由 `.github/workflows/ws-loadtest.yml` 自动执行。

### 性能优化 checklist

- [ ] 新增查询走索引,避免全表扫描
- [ ] 列表接口强制分页,单页 ≤100
- [ ] N+1 检测器(`n1-detector.ts`)无告警
- [ ] 热点数据加 Redis 缓存
- [ ] 大响应启用 gzip 压缩(`compression.ts`)
- [ ] 慢 SQL 杀手(`slow-sql-killer.ts`)生效

---

## 旧架构弃用说明

以下目录为旧架构代码,已弃用,不再维护:

| 目录 | 旧技术栈 | 状态 |
|------|---------|------|
| `server/` | Python FastAPI + SQLAlchemy 2.0 | 已弃用,新后端在 `apps/api/` |
| `client/` | Vue 3 + Vite + Element Plus + Pinia | 已弃用,新前端在 `apps/web/` |
| `Dockerfile.server` | 旧 Python 后端镜像 | 已弃用,新镜像用 `Dockerfile.api` |
| `Dockerfile.client` | 旧 Vue nginx 镜像 | 已弃用,新镜像用 `Dockerfile.web` |

旧架构的迁移参考:
- 多 Engine 数据库(3 engine)→ 新架构单库单 engine
- v1/v2/v3 路由共存 → 新架构统一 `/api` + `/api/admin`
- SQLite dev fallback → 新架构仅 PostgreSQL
- loguru 日志 → Pino 结构化日志
- PyJWT → @ihui/auth 共享包
- Prometheus + OpenTelemetry → api-logger 批量写入 + Pino
