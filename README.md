<div align="center">

# IHUI-AI

**开源的全栈 AI 操作系统 / AI Agent 平台 / LLM 网关**
Open-source full-stack AI operating system · Agent platform · LLM gateway

8 端同源 monorepo · LangGraph + MCP + A2A 三栈 · Apache-2.0 商业可用
Self-hosted, multi-tenant, RLS-guarded, RAG + agent marketplace

<br/>

<a href="#-快速开始">快速开始</a> · <a href="#-八端清单">端清单</a> · <a href="#-能力一览">能力</a> · <a href="#-部署">部署</a> · <a href="#-开发约束摘要">开发约束</a> · <a href="./docs/engineering/README.md">工程文档索引</a>

</div>

---

IHUI-AI 把「一个完整 AI 应用所需的基础设施」整体开源:多厂商模型网关、Agent 编排与工作流、
企业级权限与多租户、计费订阅闭环、内容发布、AI 教育、可观测性,以及一套把工程纪律写成代码的
守门链。除登录方式与平台机制外,各端共用同一份设计令牌与组件契约。

> **本文只写摘要。** 每条能力的完整判据、成因与取证都在 [`docs/engineering/`](./docs/engineering/README.md)
> 与 [`AGENTS.md`](./AGENTS.md);根 README 不再重复粘贴(它曾长到 6,000+ 行,细节与索引混在一起,
> 谁都无法核对)。

---

## 目录

- [是什么](#是什么) · [能干什么](#能干什么) · [数字(现算)](#数字现算) · [八端清单](#八端清单)
- [快速开始](#-快速开始) · [部署](#部署) · [开发约束摘要](#开发约束摘要) · [文档导航](#文档导航) · [许可](#许可)

---

## 是什么

| 维度 | 说法 |
| ---- | ---- |
| 一句话 | 自托管的全栈 AI 平台:模型网关 + Agent 编排 + 多租户业务后端 + 8 端前端 |
| 后端 | `apps/api` — Fastify 5 + Drizzle ORM + PostgreSQL + Zod(TypeScript) |
| AI 服务 | `apps/ai-service` — FastAPI + LangGraph + LiteLLM + MCP(Python) |
| 前端 | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui(web),Taro 4(小程序),React Native + NativeWind(App),Tauri 2(桌面),WXT(扩展),Node.js(CLI) |
| 数据 | PostgreSQL(行级安全 RLS 多租户)+ pgvector 向量检索 + Redis |
| 许可 | Apache-2.0(须保留版权与 NOTICE;源码带可溯源水印,见[许可](#许可)) |

**不是什么**:不是一个「给 LLM 套壳的聊天页」(它有租户、权限、计费、内容、教育等完整业务域);
不是「一套代码编译到 8 端」(各端是独立代码,共享的是设计令牌、契约与组件工厂,不是运行时适配层)。

---

## 能干什么

按使用者视角分组,细节链接进 `docs/engineering/`。

**最终用户**
- 多模型对话:统一网关、流式输出、思考链与工具调用可视化(inline 到消息气泡)
- 私有知识库 RAG:文档摄取 → 向量化(pgvector)→ 检索 → 引用可点回原文
- Agent 市场与 Agent 编排:发布/订阅、运行态、任务看板
- 内容创作与教育:文章/视频工作流、发布到多平台;课程-章节-课时-作业-批改-考试全链路

**开发者 / 集成方**
- LLM 网关:统一鉴权、倍率计费、配额、缓存与降级;模型清单由同步服务自动维护
- MCP + A2A:工具与 Agent 间协议;开放能力目录(单一事实源)对外发布
- 工作流编排(LangGraph)、Agent 引擎 JSON-RPC、SDK(TS/Python/Java/Go/PHP/C#)
- CLI:终端里的模型调用、文件/终端/浏览器工具、规范漂移检查(见 `docs/CLI.md`)

**企业 / 运营**
- 多租户 + RLS、RBAC/ABAC、审计流水、GDPR 数据主体请求
- 商业闭环:VIP 订阅、积分、钱包、订单、退款、10 类支付网关、分销与代理计费
- 后台:内容审核、报表、对账、工单与客服

**运维 / 架构**
- Docker Compose 一键起全栈;蓝绿部署环;Prometheus + Grafana + Loki + Alertmanager + Jaeger
- 凭据轮换、备份角色只读口令、告警到人**只有邮件一条通道**(见 [`AGENTS.md` §5e](./AGENTS.md))

完整能力叙述:[`docs/engineering/readme-04-architecture-and-modules.md`](./docs/engineering/readme-04-architecture-and-modules.md)(15 大模块)
· [`readme-05`](./docs/engineering/readme-05-quickstart-api-data.md)(API 与数据)
· [`readme-06`](./docs/engineering/readme-06-security-observability-gates.md)(安全/可观测/守门)

---

## 数字(现算)

**这些数不是手抄的。** 唯一算法在 [`scripts/gen-doc-numbers.mjs`](./scripts/gen-doc-numbers.mjs),
它从真实来源(schema 源码、路由注册点、语言包目录、compose 清单……)现场统计;
守门 [`scripts/check-doc-numbers.mjs`](./scripts/check-doc-numbers.mjs) 在**触及这两份文档的提交**上
当场复算,写旧一个数就拦下来;未触及的轮次只报漂移数不打红(文件计数类数字每次提交都会漂,
当场全判就是一台恒红门),全局问责跑 `pnpm check:doc-numbers`。刷新与问责:

```bash
pnpm doc:numbers                                      # 人读表(每个数旁边写着取数来源)
node scripts/gen-doc-numbers.mjs --markdown           # 生成下面这个块
node scripts/check-doc-numbers.mjs --strict --description -   # 连仓库简介一起问责
```

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 583 | `dbTables` |
| schema 文件 | 223 | `dbSchemaFiles` |
| API 路由 | 4363 | `apiRoutes` |
| 路由文件 | 578 | `apiRouteFiles` |
| AI 服务路由 | 548 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 118 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 60 | `cliCommandFiles` |
| CLI 工具文件 | 61 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 2103 | `testFiles` |
| CI 工作流 | 46 | `ciWorkflows` |
| Compose 服务 | 15 | `composeServices` |
| 工程守门 | 188 | `guardianGates` |
| — blocking | 170 | `guardianBlocking` |
| — warn | 18 | `guardianWarn` |
| 跟踪文件 | 13420 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-09-28。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->

**一句话口径**:数字一律现读,文档里不写「约 N 个」——那种写法必然腐烂。

---

## 八端清单

工作区里是 **9 个 app 包**(下表最后一行是 Capacitor 壳,复用 web 静态导出产 Android/iOS),
共享 **16 个 packages**。各端是独立代码,跨端一致由设计令牌单一源
([`packages/design-tokens`](./packages/design-tokens))与契约对账保证。

| 端 | 目录 | 技术栈 | 说明 |
| --- | --- | --- | --- |
| Web | `apps/web` | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui | 主站点 + 管理后台 + IDE 面板 |
| API | `apps/api` | Fastify 5 + Drizzle ORM + PostgreSQL + Zod | 业务后端:认证/租户/计费/内容/WebSocket |
| AI 服务 | `apps/ai-service` | FastAPI + LangGraph + LiteLLM + MCP | 模型网关、Agent 引擎、RAG、工作流 |
| 小程序 | `apps/miniapp-taro` | Taro 4 + React + NativeWind(v3 类名) | 微信端,微信支付原生集成 |
| 移动 App | `apps/mobile-rn` | React Native + Expo + NativeWind | 与共享屏层 `packages/app` 同源 |
| 桌面 | `apps/desktop` | Tauri 2(Rust shell)+ web 前端 | 自绘窗口控制、系统托盘、自动更新 |
| 浏览器扩展 | `apps/extension` | WXT + Chrome MV3 | Side Panel 工具集 |
| CLI | `apps/cli` | Node.js + TypeScript | 终端助手、工具集、规范/漂移检查、Agent 引擎客户端 |
| Capacitor 壳 | `apps/mobile-cap` | Capacitor 7 | 复用 `apps/web` 的 `out/` 静态导出打原生包 |

共享层:`packages/`(database / auth / types / ui-react / shared / api-client / design-tokens / i18n / config / …)。
跨端契约与「改了手机端 web 没改」这一型的防治,见 [`AGENTS.md` §4 跨端样式同步铁律](./AGENTS.md)。

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本 | 备注 |
| ---- | ---- | ---- |
| Node.js | ≥ 20(实测 24) | `packageManager` 锁 pnpm |
| pnpm | ≥ 9 | `corepack enable` 即可 |
| PostgreSQL | ≥ 15 + pgvector | 或直接用 compose 起 |
| Redis | ≥ 7 | 缓存与队列 |
| Python | ≥ 3.12 | 仅 `apps/ai-service` |
| Docker | ≥ 24 | 推荐路径 |

### 一条命令起全栈(Docker,推荐)

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
cp .env.example .env           # 填 JWT_SECRET / DB_PASSWORD / CREDENTIALS_ENCRYPTION_KEY
docker compose up -d           # 业务 + 迁移;监控栈按需:--profile observability
```

起不来先查:`docs/DEPLOYMENT_RUNBOOK.md` · `docs/TROUBLESHOOTING.md` · 端口注册表 `docs/port-management.md`。

### 本地开发模式

```bash
pnpm install                   # 全量安装,禁止 --filter(见 AGENTS §12e)
docker compose up -d db redis
pnpm --filter @ihui/database run db:migrate   # drizzle-kit 迁移 + 迁移记账校验
pnpm dev                       # web :8801 + api :8802(+ ai-service :8803,见端口注册表)
pnpm turbo build typecheck lint test       # 全量验证,必须全绿
```

模型密钥不在仓库里:本机引导走 `node scripts/env-backfill-model-keys.mjs --verify`(见
[`AGENTS.md` §5d](./AGENTS.md));任何机器上都不许把密钥写进代码、日志或提交。

---

## 部署

| 主题 | 入口 |
| ---- | ---- |
| 生产运行手册(蓝绿、回滚、证书) | [`docs/DEPLOYMENT_RUNBOOK.md`](./docs/DEPLOYMENT_RUNBOOK.md) |
| Compose / IaC 决策与理由 | [`docs/INFRASTRUCTURE_DECISION.md`](./docs/INFRASTRUCTURE_DECISION.md) |
| 监控与告警(邮件单通道) | [`docs/MONITORING.md`](./docs/MONITORING.md) |
| 数据库备份与只读备份角色 | [`docs/DATABASE.md`](./docs/DATABASE.md) |
| 凭据轮换 | [`docs/CREDENTIAL_ROTATION_RUNBOOK.md`](./docs/CREDENTIAL_ROTATION_RUNBOOK.md) |
| CI 工作流清单与触发条件 | [`.github/workflows/`](./.github/workflows) + `pnpm doc:numbers` 里的工作流计数 |
| 部署/构建全局锁(禁止并发构建) | [`AGENTS.md` §12 部署/构建全局锁](./AGENTS.md) |

详细部署叙述(旧 README 的部署段全文)在
[`docs/engineering/readme-06-security-observability-gates.md`](./docs/engineering/readme-06-security-observability-gates.md)。

---

## 开发约束摘要

**这份仓库的规矩是代码,不是口头约定。** 完整条款唯一权威文本是
[`AGENTS.md`](./AGENTS.md);下面是新人第一天就会撞到的几条,以及对应的机器判据。

1. **任务计划只写 `PROJECT_PLAN.md`**,不许另立 TODO/ROADMAP 文件;认领任务要写租约
   `（进行中@日期/持有者）`。派单口径:`node scripts/plan-tasks.mjs --open --dispatchable`。
2. **提交走 `node scripts/safe-commit.mjs`**,多会话并行时禁止 `git add .` / `-A` / `-u`;
   活文档(`README.md` / `AGENTS.md` / `PROJECT_PLAN.md`)提交前先
   `node scripts/merge-live-doc.mjs --file README.md`,落地用 `node scripts/live-doc-edit.mjs`。
3. **禁止 `git stash`(全面)、禁止 `git pull --rebase`、禁止手写 `git push`**:
   推送由 post-commit 的 `git-push-guard` 完成,核验只允许 `node scripts/git-push-converge.mjs`。
4. **单分支开发**:除 `goal/*` 外不许建分支(本 PR 属 §9b 的「必要分支」例外——
   main 已开分支保护,直推被拒,只能走 PR)。
5. **共享层优先**:新代码先查 `packages/`,端内不得重新实现已有 hook/util/类型/api-client。
6. **UI 硬约束**:圆角/几何时钟只有一处真相源(`radius.js` / `geometry.js`);描边不得取墨档;
   主 CTA 用 `brand.cta` + `brand.ctaForeground` 成对;图标一律矢量图标库,禁止 emoji 当图标;
   禁止分割线、渐变遮罩、原生 `alert/confirm/title`。
7. **鉴权**:认证不等于授权。身份只能由承载层显式入参传入,不得取请求体里自报的 `userId`,
   不得从被操作记录的字段反推;批量写要回报**库确认集合**(`.returning({id})`)而不是请求侧 `.length`。
8. **i18n**:五种语言(en/zh-CN/zh-TW/ja/ko)键集 parity 是门禁;新增状态词必须同枚提交补齐五语言;
   不得在端内硬编码中文。
9. **临时文件**只落 `.ihui-agent/tmp/<任务名>/`;项目外路径与 C 盘写入由守门拦截。
10. **新文件必须带溯源水印**:`node scripts/watermark.mjs inject <file>`;不得对已注入文件做
    文本级批量改写(零宽载荷会被静默破坏)。

守门链现状(数量现读,别照抄任何文档里的数字):

```bash
node scripts/guardian-runner.mjs --staged     # pre-commit 全批
node scripts/check-gate-wiring.mjs            # 「门造好了但没装车」对账
```

新增一道门**必须**用 `node scripts/gate-registry-insert.mjs`(自己取空闲号、自己保住别人的注册块),
不得手填编号;并同步在本文件与 `AGENTS.md` 点名,否则守门 89 的 R4 会红。

---

## 文档导航

| 想知道 | 去哪 |
| ------ | ---- |
| 工程细节(从 README 拆出的原文) | [`docs/engineering/README.md`](./docs/engineering/README.md) |
| 架构总览 | [`docs/architecture.md`](./docs/architecture.md) |
| API 参考 / 认证 | [`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md) · [`docs/AUTHENTICATION.md`](./docs/AUTHENTICATION.md) |
| 数据库与迁移 | [`docs/DATABASE.md`](./docs/DATABASE.md) |
| AI 服务与模型接入 | [`docs/AI_SERVICE.md`](./docs/AI_SERVICE.md) · [`docs/LLM_SETUP.md`](./docs/LLM_SETUP.md) |
| 多端与共享层 | [`docs/MULTI_END.md`](./docs/MULTI_END.md) · [`docs/PACKAGES.md`](./docs/PACKAGES.md) |
| UI 规范 | [`docs/UI_GUIDELINES.md`](./docs/UI_GUIDELINES.md) |
| i18n 治理 | [`docs/I18N.md`](./docs/I18N.md) |
| 测试 / 性能 / 安全 | [`docs/TESTING.md`](./docs/TESTING.md) · [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) · [`docs/SECURITY.md`](./docs/SECURITY.md) |
| 监控 / 发布 / 事故复盘 | [`docs/MONITORING.md`](./docs/MONITORING.md) · [`docs/RELEASE.md`](./docs/RELEASE.md) · [`docs/INCIDENTS.md`](./docs/INCIDENTS.md) |
| SDK 与 CLI | [`docs/SDK.md`](./docs/SDK.md) · [`docs/CLI.md`](./docs/CLI.md) |
| 贡献流程 | [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) · [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| 常见问题 | [`docs/FAQ.md`](./docs/FAQ.md) · [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md) |
| 学习资产(工作流反馈来源) | [`docs/learning-assets.md`](./docs/learning-assets.md) |

英文版见 [`README.en.md`](./README.en.md);日文/韩文版在 `README.ja.md` / `README.ko.md`
(它们仍按旧 README 的结构叙述,数字以本文件与 `pnpm doc:numbers` 为准)。

---

## 许可与版权

- **License**:Apache-2.0(全文见 [`LICENSE`](./LICENSE));贡献者协议见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。
- **NOTICE**:分发时须保留 [`NOTICE`](./NOTICE) 与源码头部版权行。
- **溯源水印**:源码文件带三层水印(可见横幅 + 横幅内零宽载荷 + 文件尾不可见行),
  由 `scripts/watermark.mjs` 与守门 `check-watermark-coverage` 维护。它不改变 Apache-2.0 授予的权利,
  只用于第三方内容归属对账(见 `config/third-party-provenance/`)。
- **商标与品牌**:「智汇AI / IHUI-AI」及图示为本项目所有;Apache-2.0 不授予商标使用权。
- **第三方依赖**:各自许可证以所装版本为准,vendored 内容登记在第三方来源台账。

## 联系我们

- 官网 / 文档:<https://aizhs.top>
- 议题与缺陷:<https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- 安全漏洞(请勿公开贴):[`SECURITY.md`](./SECURITY.md)
- 行为准则:[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)

<div align="center">

如果这个项目对你有用,给个 ⭐ 就是最直接的贡献。
Made with an unusually long chain of machine-checkable rules — because "we'll be careful" is not a control.

</div>
