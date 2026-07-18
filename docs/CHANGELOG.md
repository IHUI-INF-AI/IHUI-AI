# 变更日志(Changelog)

本文件记录 IHUI-AI 项目的所有显著变更。

格式遵循 [Keep a Changelog 1.1.0](https://keepachangelog.com/zh-CN/1.1.0/),
版本号遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/)。

变更类型说明:

- `Added` — 新增功能
- `Changed` — 对已有功能的变更
- `Deprecated` — 已弃用,即将移除
- `Removed` — 已移除的功能
- `Fixed` — Bug 修复
- `Security` — 安全相关修复与加固

> 历史条目基于 `git log` 提取整理,日期为提交日期(Asia/Shanghai)。

---

## [Unreleased]

最近未发布的开发分支变更,以下条目基于 `git log --oneline -20` 提取整理。

### Added

- **Crew executor 工具调用系统**:在 `apps/api` / `apps/ai-service` / `apps/web` 三端落地
  function calling + 6 工具 + RAG 充实,端到端测试通过 (`a9e26ef5`)
- **Crew 角色 prompt 外部化** + `ai-fresh-2026` 幂等工具,seed 数据可幂等回放 (`8f49e177`)
- **Knowledge RAG embedding 抽象层**:支持 DashScope / OpenAI / MiniMax 三种 provider,
  在 `apps/api` 中统一抽象 (`1f2b2c83`)
- **营销首页迁移到根路径** + enterprise 页补全 (`3f35eacc`)
- **任务 cancelled 状态 banner**:8s 后自动回归 idle,改善 UX (`9bf38dc2`)
- **P2 中期增强**:oneDarkoneLight 主题切换 + abort 任务已取消 UI (`480de1ce`)
- **P1 剩余 6 项全量收尾**:Crew 多智能体 + Knowledge RAG + 字段配套修复 (`b6c23f6f`)
- **P1+P2 字段配套全量收尾**:`learn/api-client`、`DictTag`、`live` 等前后端字段对齐
  (`f67daa4b`、`336348c5`)
- **微信支付证书激活 + 凭证轮换手册 + 自动化监控**(`890c1fee`,详见 Security)
- **新增 `db:check` npm script**:`drizzle-kit check`,用于迁移健康检查 (`9b9d3ca0`)
- **seed 流程重构**:`packages/database/seed/index.ts` 顶层 7 步模式化 + 容错隔离 +
  CLI 过滤 (`b5bc8e67`)

### Changed

- **code-generator 主题切换性能优化**:复用 `markdown-stream` 方案,降低首屏渲染耗时 (`51bdcd5f`)
- **C 端 resource 字段配套**:前后端字段命名对齐 + `categoryName` join (`a4bd15d8`)
- **"我的学习" 二级菜单提示线重设计**:全宽破折线 + 激活态实线 + 无障碍呼吸动画 (`678b7cbb`)
- **"我的学习" 指示器 4 态端到端测试** + 首次呼吸动画 + 无障碍适配 (`db9bb8a5`)
- **seedAiFresh2026 加每步耗时 + 单步容错隔离**,失败不阻塞后续步骤 (`d75031c1`)
- **AGENTS.md 第 18 节守门脚本**:跨 Agent 改动保护(`scripts/check-agents.mjs`) (`af27f339`)
- **AGENTS.md 文档更新**:第 18 节 Push 阶段跨 Agent 改动保护规则(强制,2026-07-18 立) (`b326f7f3`)

### Deprecated

- 旧架构(Python FastAPI `server/` + Vue `client/`)已弃用,新架构(Fastify + Next.js +
  FastAPI)替代。旧目录不再编排入 `docker-compose.yml`,相关环境变量已清理。

### Removed

- 移除 `apps/web/src/components/sidebar.tsx` 中未使用的 `ChevronDown` import (`8a0e5773`)

### Fixed

- **Hydration 修复**:营销首页迁移到根路径后修复 React Hydration mismatch (`3f35eacc`)
- **sidebar/learn-queries 字段修复**:`sidebar.tsx` 移除未使用 import +
  `learn-queries.ts` 的 `lastStudyAt` 改用 `createdAt`,避免空值导致排序异常 (`8a0e5773`)

### Security

- **微信支付 V3 安全加固** (`890c1fee`):
  - 商户私钥 + 平台证书激活机制完善(生产环境缺失时启动中止)
  - 凭证轮换手册(`scripts/cert-renew-watchdog.mjs`、`scripts/cert-expiry-check.mjs`)
  - 自动化监控告警,证书过期前预警
  - 平台证书通过 `cert/platform_cert.pem` 加载(`.gitignore` 已配置 `cert/`)

---

## [0.1.0] — 2026-07-15

新架构首个里程碑版本:Fastify + Next.js + FastAPI 三端落地。

### Added

- **后端 API**:`apps/api`(Fastify 5 + Drizzle ORM + PostgreSQL 15),96 表 32 迁移
- **前端 Web**:`apps/web`(Next.js 15 + React 19 + Tailwind 4 + shadcn/ui)
- **AI 服务**:`apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- **共享包**:`packages/auth`、`packages/database`、`packages/types`、`packages/ui`、
  `packages/config`、`packages/eslint-config`、`packages/tsconfig`
- **认证体系**:`@fastify/jwt` + 自研 RBAC + SSO 登录
- **监控栈**:Prometheus(端口 9091)+ Grafana(端口 3001)+ Node Exporter(端口 9100)
- **OpenTelemetry**:OTLP Collector + Jaeger 分布式追踪
- **CI/CD**:GitHub Actions(build / ci / e2e / i18n-check / knip / style-spec)
- **Husky 钩子**:pre-commit、pre-push 自动化校验

### Security

- **安全服务**(`apps/api/src/services/security-service.ts`):
  - Redis 滑动窗口限流(每分钟 / 每小时)
  - XSS 清洗 + SQL 注入检测 + 文件类型校验
  - CSRF token 生成与校验(Redis 存储)
  - 安全响应头(`SECURITY_HEADERS`)
  - IP 黑名单 + 异常检测(连续失败自动封禁)
- **`@fastify/helmet`** 安全头中间件
- **`@fastify/cors`** 跨域策略(按 `CORS_ORIGIN` 白名单)
- **凭证加密**:`CREDENTIALS_ENCRYPTION_KEY` 用于第三方 OAuth 凭证加密存储
- **审计日志**:`apps/api/src/plugins/audit.ts` 关键操作落库

---

## 变更日志维护规范

1. **新增条目时机**:每次合入 `main` 分支的 PR,作者在 `[Unreleased]` 段对应小节追加条目。
2. **条目格式**:`<简述>(<文件或模块路径>)`,可附 commit short hash。
3. **发布版本**:每次发布时,将 `[Unreleased]` 改名为 `[<版本号>] — <YYYY-MM-DD>`,
   并新建空的 `[Unreleased]` 段。
4. **不记录**:纯重构、依赖升级、格式化等不影响行为变更的提交。
5. **安全条目**:任何安全相关变更必须同时记录到 `Security` 小节,并在
   `docs/SECURITY.md` 同步更新。
