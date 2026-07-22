# IHUI-AI 文档中心

> 本目录是 IHUI-AI 项目的完整文档中心,覆盖架构、开发、部署、API、数据库、认证、AI 服务、多端、监控、守门、i18n、性能、SDK、CLI、发布、故障排查与 FAQ。
> 项目总览见根 [README.md](../README.md),Agent 规范见 [AGENTS.md](../AGENTS.md),任务计划见 [PROJECT_PLAN.md](../PROJECT_PLAN.md)。
> IHUI-AI 是全栈 AI 平台(TS Monorepo + pnpm workspace + Turborepo),8 端 + 13 共享包 + 5 语言 i18n + 23 道守门 + 14 平台发布。

---

## 快速导航

| 你想… | 看哪个文档 |
|---|---|
| 了解整体架构 | [architecture.md](./architecture.md) |
| 本地启动开发 | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| 调用 API | [API_REFERENCE.md](./API_REFERENCE.md) |
| 改数据库 | [DATABASE.md](./DATABASE.md) |
| 接入认证 | [AUTHENTICATION.md](./AUTHENTICATION.md) |
| 接 AI 模型 | [AI_SERVICE.md](./AI_SERVICE.md) + [LLM_SETUP.md](./LLM_SETUP.md) |
| 部署上线 | [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) + [RELEASE.md](./RELEASE.md) |
| 排查故障 | [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) |
| 看常见问题 | [FAQ.md](./FAQ.md) |
| 贡献代码 | [CONTRIBUTING.md](./CONTRIBUTING.md) |

---

## 1. 项目与架构

| 文档 | 说明 |
|---|---|
| [architecture.md](./architecture.md) | **系统架构总览**:技术栈、Monorepo 两 app 职责边界、数据库、API 路由、WebSocket、前端架构、AI 服务、启动流程、测试、可观测性、安全、IaC 决策、多租户、性能基线、旧架构弃用 |
| [MULTI_END.md](./MULTI_END.md) | **多端架构**:8 端矩阵(web/api/ai-service/cli/desktop/extension/mobile-rn/miniapp-taro)、跨端调用链路、同步开发规则、多 Subagent 并行派单、14 平台发布矩阵 |
| [PACKAGES.md](./PACKAGES.md) | **共享包指南**:13 个 @ihui/* 包(auth/database/types/ui/ui-native/ui-primitives/api-client/sdk/config/eslint-config/tsconfig/context-compaction)、依赖关系图、引用方式、新增包流程 |
| [INFRASTRUCTURE_DECISION.md](./INFRASTRUCTURE_DECISION.md) | 基础设施即代码决策(Docker Compose + GitHub Actions vs K8s + Helm + ArgoCD 取舍) |
| [PRODUCTION_INFRASTRUCTURE.md](./PRODUCTION_INFRASTRUCTURE.md) | 生产基础设施规格清单 |
| [port-management.md](./port-management.md) | **端口管理规则**(强制):8801-8899 端口注册表,check-port-registry.mjs 守门 |
| [migration-audit-frontend.md](./migration-audit-frontend.md) | 前端架构迁移审计报告(旧 Vue 3 → 新 Next.js 15) |

---

## 2. 开发与测试

| 文档 | 说明 |
|---|---|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | **本地开发指南**:环境变量清单、4 种启动方式、单端启动、数据库准备、VS Code 调试、脚本速查、Windows 注意事项 |
| [TESTING.md](./TESTING.md) | **测试策略**:8 层分层金字塔、后端 Vitest、AI 服务 pytest、前端 Playwright E2E、视觉回归、共享包/CLI 测试、Locust 压测、Lighthouse CI、CI 集成、编写模板 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | **贡献指南**:环境搭建、TypeScript/ESLint/Prettier 规范、提交规范、PR 流程、分支策略 |
| [UI_GUIDELINES.md](./UI_GUIDELINES.md) | **UI 设计规范**:圆角守门、中文字体垂直对齐、禁止分割线/渐变遮罩、登录弹窗视觉规范、hover/输入框/状态徽章规则、组件库使用 |
| [PERFORMANCE.md](./PERFORMANCE.md) | **性能基线与优化**:SLA 达标、Locust 压测实操、数据库/前端/AI 服务/WebSocket 性能、监控告警、回归检测 |

---

## 3. API 与数据层

| 文档 | 说明 |
|---|---|
| [API_REFERENCE.md](./API_REFERENCE.md) | **API 完整参考**:统一响应格式、错误码、认证方式、60+ 路由分组、12 WebSocket、SSE 流式、分页、限流、OpenAPI、客户端调用示例 |
| [DATABASE.md](./DATABASE.md) | **数据库设计**:Drizzle ORM、100+ schema 文件 339 表、迁移管理、RLS 行级安全、种子数据、多租户隔离、索引策略、备份恢复、schema drift 守门 |
| [AUTHENTICATION.md](./AUTHENTICATION.md) | **认证授权**:@ihui/auth 全链路:JWT、token-family 旋转、refresh 黑名单、bcryptjs+SHA256、OAuth2 PKCE、2FA、RBAC、DataScope、多租户、WS 鉴权、密钥轮换、API Key/PAT/SK、前端集成 |

---

## 4. AI 服务

| 文档 | 说明 |
|---|---|
| [AI_SERVICE.md](./AI_SERVICE.md) | **AI 服务深度**:6 Router 端点、LangGraph 工作流、LiteLLM 网关、MCP 11 工具/3 资源/3 提示词、A2A 协议、向量记忆、Skills/Slash 命令、SSE 缓冲、DAG 调度、配置、调用示例 |
| [LLM_SETUP.md](./LLM_SETUP.md) | LLM 模型配置(OpenAI/Anthropic/Google/国内厂商接入与凭证) |
| [AI_LEADERBOARD.md](./AI_LEADERBOARD.md) | AI 模型榜单数据维护 |

---

## 5. 部署与运维

| 文档 | 说明 |
|---|---|
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | **部署运维手册**:前置条件、端口规划、Docker Compose、Nginx、蓝绿部署、回滚、健康检查、故障排查 |
| [RELEASE.md](./RELEASE.md) | **发布流程**:14 平台发布矩阵、SemVer、Git tag、GitHub Actions、Docker 镜像、多端发布(winget/scoop/homebrew/snap/Chrome/EAS/微信)、证书管理、checklist、hotfix |
| [MONITORING.md](./MONITORING.md) | **可观测性**:Prometheus + Grafana(20 仪表盘)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager、应用指标、日志体系、API 日志批量写、SLI/SLO |
| [INCIDENTS.md](./INCIDENTS.md) | 历史事故记录与复盘 |
| [CREDENTIAL_ROTATION_RUNBOOK.md](./CREDENTIAL_ROTATION_RUNBOOK.md) | 凭证轮换运维手册 |
| [EMAIL_SETUP.md](./EMAIL_SETUP.md) | 邮件服务配置(SMTP/SES) |
| [WECHAT_PAY_ACTIVATION_REPORT.md](./WECHAT_PAY_ACTIVATION_REPORT.md) | 微信支付 V3 激活报告 |

---

## 6. 质量与守门

| 文档 | 说明 |
|---|---|
| [GATEKEEPERS.md](./GATEKEEPERS.md) | **守门规则详解**:23 pre-commit 钩子 + post-commit 自动 push + pre-push typecheck,逐项脚本工作原理、跳过策略、添加新守门流程、失败排查 |
| [I18N.md](./I18N.md) | **国际化**:5 语言矩阵、68 命名空间、翻译策略、12 守门/工作流脚本、添加新 key/新语言流程、前端使用 |
| [I18N-COMPLETION-PLAN.md](./I18N-COMPLETION-PLAN.md) | i18n 完整性计划(历史规划文档) |
| [SECURITY.md](./SECURITY.md) | **安全策略**:漏洞报告流程、响应时间、支持版本、安全措施清单、依赖扫描 |

---

## 7. SDK 与 CLI

| 文档 | 说明 |
|---|---|
| [SDK.md](./SDK.md) | **5 语言 SDK 使用指南**:TS/Python/Go/Java/.NET 矩阵、安装、初始化、对话/流式/图片/Agent/RAG/记忆/文件/工具代码示例、流式解析、错误处理、版本管理 |
| [CLI.md](./CLI.md) | **CLI 工具指南**:24 源配置导入、subagent 4 拓扑并行、skills/plugins/plan/memory/voice/mermaid/sandbox/sessions/tui/ACP/server 子系统、配置合并、测试、调用示例 |

---

## 8. 故障排查与 FAQ

| 文档 | 说明 |
|---|---|
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | **故障排查指南**:10 大类 35+ 故障(启动/数据库/认证/i18n/守门/WebSocket/AI 服务/部署/性能/工具),每个用统一模板:症状/根因/排查/修复/预防 |
| [FAQ.md](./FAQ.md) | **常见问题**:14 类 86 问(项目定位/技术选型/部署/开发/数据库/认证/AI 服务/多端/守门/i18n/商业化/性能/安全/升级) |

---

## 9. 变更记录

| 文档 | 说明 |
|---|---|
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更记录(Keep a Changelog 格式) |

---

## 文档维护规则

1. **新增文档**:
   - 放在 `docs/` 目录,文件名大写 SNAKE_CASE(如 `NEW_DOC.md`)
   - 头部统一 `# 标题` + `> 简介` + `---`
   - 在本 README 对应章节添加索引条目
   - 中文撰写,代码块用正确语言标签
2. **跨文档引用**:用相对链接 `[文档名](./xxx.md#锚点)`,避免重复内容
3. **与代码同步**:功能变更时同步更新对应文档(check-readme-sync.mjs 守门提醒)
4. **不创建冗余**:遵循 AGENTS.md §3"做减法,最小化代码,零冗余",每篇文档聚焦一个主题
5. **守门豁免**:纯文档改动不需跑 typecheck/test,但 `check-readme-sync.mjs` 仍会提醒 README 同步
