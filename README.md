<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

> ⚠️ **版权与商用授权声明**
>
> © 2026 **IHUI AI (智汇AI)** · 版权所有者：**李春川 (Li Chunchuan)** · https://aizhs.top
>
> - 本仓库采用 **双许可模式**：开源使用遵循 **Apache-2.0**（须保留版权声明与 NOTICE）；**闭源商用 / 去除品牌标识 / SaaS 转售** 须另行获得商用授权，联系方式见官网。
> - 版权、许可与再分发要求详见 **根目录 [NOTICE](NOTICE)**（Apache-2.0 要求随每一副本保留本声明与 NOTICE）。
> - 本仓库**全部源文件已嵌入版权溯源水印**（可见声明 + 不可见零宽字符隐写，可运行 `node scripts/watermark.mjs decode <file>` 验证）。移除水印不改变版权归属，未授权商用将被技术溯源并依法追究。
> - CI 已内置水印校验（`pnpm watermark:check`），任何删除水印的改动将导致构建失败。

# IHUI-AI

<p align="center">
  <img src="apps/web/public/images/logo.png" width="140" alt="IHUI-AI Logo" />
</p>

<p align="center">
  <strong>自托管全栈 AI 平台</strong>：多模型对话 · OpenAI 兼容 API 中继 · 多平台号池 · 签到与保活 · Agent/MCP · 知识库与多平台发布 · 8 端 + CLI
</p>

<p align="center">
  <strong>在线 Demo</strong> · <a href="https://aizhs.top">https://aizhs.top</a> &nbsp;|&nbsp; <strong>GitHub</strong> · <a href="https://github.com/IHUI-INF-AI/IHUI-AI">Star 感谢支持</a><br/>
  <sub>模型网关 + Agent 编排 + 多租户业务后端 + 8 端前端 · Apache-2.0（须保留 NOTICE）· 可 Fork 自托管</sub>
</p>

<p align="center">
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/build.yml/badge.svg" alt="Build" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/e2e.yml/badge.svg" alt="E2E" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml"><img src="https://github.com/IHUI-INF-AI/IHUI-AI/actions/workflows/knip.yml/badge.svg" alt="Knip" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI"><img src="https://img.shields.io/github/stars/IHUI-INF-AI/IHUI-AI?style=social" alt="Stars" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/issues"><img src="https://img.shields.io/github/issues/IHUI-INF-AI/IHUI-AI.svg" alt="Issues" /></a>
  <a href="https://github.com/IHUI-INF-AI/IHUI-AI/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" /></a>
</p>

<p align="center">
  <sub>
    <a href="README.md">简体中文</a> · <a href="README.en.md">英文</a> · <a href="README.ko.md">韩文</a> · <a href="README.ja.md">日文</a>
  </sub>
</p>

---

> **本文件只写索引。** 根 README 收敛为：能力首屏、现算数字、快速开始与 [`docs/engineering/`](./docs/engineering) 九份主题文档入口；工程纪律权威文本是 [`AGENTS.md`](./AGENTS.md)。

## 目录

- [你能用它做什么](#你能用它做什么) · [明确不是什么](#明确不是什么) · [关键数字(现算)](#关键数字现算) · [九份主题文档](#九份主题文档从根-readme-拆出的原文收纳件) · [八端清单](#八端清单)
- [快速开始](#-快速开始) · [部署](#部署) · [开发约束摘要](#开发约束摘要) · [文档导航](#文档导航) · [许可与版权](#许可与版权) · [联系我们](#联系我们)

---

## 关键数字(现算)

**这些数不是手抄的。** 唯一算法在 [`scripts/gen-doc-numbers.mjs`](./scripts/gen-doc-numbers.mjs),
它从真实来源(schema 源码、路由注册点、语言包目录、compose 清单……)现场统计;
守门 [`scripts/check-doc-numbers.mjs`](./scripts/check-doc-numbers.mjs) 对本文与英文版当场复算,
写旧一个数就拦下来。刷新与问责:

```bash
pnpm doc:numbers                                      # 人读表(每个数旁边写着取数来源)
node scripts/gen-doc-numbers.mjs --markdown           # 重新生成下面这个块
node scripts/check-doc-numbers.mjs --worktree         # 工作树问责
```

对外规模请只看下表取数键（`llmModels`、`publishPlatforms`、`apiRoutes` 等），禁止在正文手抄腐烂数字。

<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->
| 指标 | 现值 | 取数键 |
| ---- | ---- | ------ |
| 数据库表 | 612 | `dbTables` |
| schema 文件 | 237 | `dbSchemaFiles` |
| API 路由 | 4608 | `apiRoutes` |
| 路由文件 | 649 | `apiRouteFiles` |
| AI 服务路由 | 616 | `aiServiceRoutes` |
| WebSocket 端点 | 25 | `wsEndpoints` |
| 入库模型清单 | 99 | `llmModels` |
| 发布平台 | 38 | `publishPlatforms` |
| 端应用包 | 9 | `appPackages` |
| 共享包 | 16 | `sharedPackages` |
| CLI 命令文件 | 67 | `cliCommandFiles` |
| CLI 工具文件 | 72 | `cliToolFiles` |
| 语言 | 5 | `i18nLanguages` |
| i18n 作用域 | 7 | `i18nScopes` |
| 语言包 JSON | 35 | `i18nMessageFiles` |
| 测试文件 | 3547 | `testFiles` |
| CI 工作流 | 51 | `ciWorkflows` |
| Compose 服务 | 14 | `composeServices` |
| 工程守门 | 298 | `guardianGates` |
| — blocking | 272 | `guardianBlocking` |
| — warn | 28 | `guardianWarn` |
| 跟踪文件 | 17546 | `trackedFiles` |

上表由 `node scripts/gen-doc-numbers.mjs --markdown` 生成,最后核对日期 2026-10-29。
每个数的来源就写在取数键旁边的实现里(`scripts/gen-doc-numbers.mjs` 的 `SOURCES`),**不得手抄、不得另立第二份**。

<!-- END GENERATED NUMBERS -->
**一句话口径**:数字一律现读,文档里不写「约 N 个」——那种写法必然腐烂。

---

## 你能用它做什么

**智汇 AI（IHUI-AI）** 是一套可自托管的全栈 AI 平台：同一套后端同时支撑对话与多模型、**OpenAI 兼容 API 中继**、**多平台账号号池与自动签到**、Agent/MCP/工作流、知识库与多平台内容发布、教育与社区，以及 Web / 桌面 / App / 小程序 / CLI / 扩展。

### 对话与模型

- 在 Web、App、小程序、CLI 里多模型对话（目录规模见取数键 `llmModels`），流式输出，调参数、收藏与历史。
- 自带 Provider Key、用量与 Prompt/Persona；Plan-Act 双模式；任务进度条；队列重排/撤回/编辑；多任务窗格。
- 语音识别与播报（含 WebRTC）；文生图/图像编辑；视频生成任务队列；会话导入（含 Chrome/CLI）。

### API 中继（开发者网关）

- 申请开发者 Key，用 **OpenAI 兼容**协议调用 `/v1/chat/completions` 及同族 `v1-*` 能力。
- 按 token/次/图/视频计费；官方价 vs 实付价、高峰价；Key 白名单与配额；钱包充值与用量日志。
- 多上游渠道路由与故障转移；公共 Key 池加权调度与递进熔断。
- 将 Trae / WorkBuddy / CodeArts / Qoder 等 **IDE 账号**接到同一 `/v1`（上游由适配器翻译）。

### 号池（账号 / 凭证调度）

- **运营池**：批量导入最多 **12** 类平台账号（`RELAY_PROVIDERS`），启停、认领、健康检查；**进池 ≠ 自动签到**。
- **个人池**：用户自管账号，Web / App / 小程序互通；选号策略（加权、临期、并发闸等）。
- 凭证与签到助手 **CAS 版本同步**；支持 refresh 的平台可临期换票。
- 本机脚本导入：`scripts/relay-account-pool.mjs` 及 Trae/WorkBuddy/Qoder 等 login/sync 脚本。

### 多平台签到与保活

- **签到白名单仅四平台**：Trae、WorkBuddy、Qoder、MiniMax——定时领积分；支持手动立即签。
- WorkBuddy 任务族（growth / travel / activity / blackcat）；**保活中心**探活 Cookie/JWT，**不代签**。
- **没有** Cursor、Claude 产品账号自动签到。CodeArts 等可进号池/中继，但无签到引擎。

### 反代与出口

- **产品义**：多租户 OpenAI 形 API 网关（Key 隔离、配额、计费），不是「任意 HTTP 反代控制台」。
- 出口 **代理池**（账号自带或共享池轮换）；`/api/checkin/*` 网关代理到 ai-service，供多端共用签到数据。

### Agent、工具与 MCP

- 智能体市场/我的智能体；工作台、时间线、看板、画布；计划与进度；子智能体派单。
- 工具与技能市场；MCP 市场/项目/网关；连接器与能力注册表；工作流、自动化、编排与定时任务。

### 知识与内容发布

- 知识库 RAG、团队知识/记忆、个人记忆；多平台发布（平台数见 `publishPlatforms`，含微信/知乎/B站/抖音/小红书/CSDN/掘金等）；日历与分析。

### 商业、团队与教育社区

- VIP/订阅、钱包、订单/退款、发票、积分；团队与工作区权限。
- 课程/考试/直播/证书；社区广场、问答、圈子；可选教务与家长端能力。

### 多端与开发者

- Web、Tauri 桌面薄壳、React Native、微信小程序、CLI、浏览器扩展；跨端 WebView 门户与 `packages/app` 共享屏。
- 开发者中心：Key、Webhook、Relay 文档；开放路由规模见 `apiRoutes` / `aiServiceRoutes` / `cliCommandFiles`。

---

## 明确不是什么

| 误区 | 事实 |
| --- | --- |
| 「12 平台全自动签到」 | 号池最多 12 类 provider；**签到只有** Trae / WorkBuddy / Qoder / MiniMax |
| Cursor / Claude 账号签到 | 全仓无对应签到引擎；可作 LLM 上游，**不是**本产品签到面 |
| 「免费无限中转」 | 有计费、配额、白名单与 Key 池熔断 |
| 「任意后端 HTTP 反代面板」 | 主叙事是 OpenAI 形网关 + 号池转发 + 出口代理池 |
| 「生产级 RLS 已全开」 | 多靠应用层租户闸；勿写满 |
| 「给 LLM 套壳聊天页」 | 含租户、权限、计费、内容、教育等完整业务域 |
| 「一套代码编译到 8 端」 | 各端独立代码；共享设计令牌与契约，不是运行时单二进制 |

完整定位与对标叙述见 [`docs/engineering/readme-01-positioning.md`](./docs/engineering/readme-01-positioning.md)。

---

## 九份主题文档(从根 README 拆出的原文收纳件)

| 文件                                                                                                     | 题域                  | 收纳的重写前 README 主要章节                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md)                                   | 定位与宣称            | 头部横幅与对标宣言 · 一键部署 · 技术栈与规模速览 · 项目宣言 · GEO 优化 · 目录 · 项目定位 · 特性总览                                                                         |
| [`readme-02-ux-and-ai-control`](./docs/engineering/readme-02-ux-and-ai-control.md)                       | 交互与 AI 控制        | AI 流式输出体验(Phase 19) · AI 全量操控桥接 · 全局顶栏 + Plus 弹窗 · Use Cases · AI 对话决策面与运行时事实                                                                  |
| [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md)         | 卖点与场景            | 为什么选择 · 对标矩阵 · 谁在使用 · 5 个典型场景 · 联系我们                                                                                                                  |
| [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md)         | 架构与模块            | 技术栈 · 8 端架构 · 跨端共享架构 · 维护倍数 · 应用层级图 · 项目结构 · 15 大模块能力详解                                                                                     |
| [`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)                   | 快速开始 / API / 数据 | 快速开始 · REST/WebSocket API 与能力目录 · 模型自动同步 · IM 多平台远程控制 · 数据库                                                                                        |
| [`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md) | 安全 / 可观测 / 守门  | 可观测性 · 安全设计 · 根目录守门服务 · 工程守门全表 · Commit 丢失防护 · 工程质量证据 · AI 编程协作声明 · 测试 · 部署 · CI 工作流 · 国际化 · LLM 字典化 · 守门补登与对账登记 |

**RN 样式裸数字回潮锁** `scripts/check-token-literal-debt.mjs`(门 240,差值棘轮):只拦本次把
可自动对档的裸数字(`padding: 16` / `fontSize: 14`)加回来,存量只报数;修复出口
`node scripts/tokens-migrate.mjs <file> --apply`(恰在档才换,杂值不动),目录档可一次扫
`packages/app/src apps/mobile-rn/src`。
| [`readme-07-faq-roadmap-commerce`](./docs/engineering/readme-07-faq-roadmap-commerce.md)                 | FAQ / 路线图 / 商业   | FAQ · 贡献 · 文档导航 · 路线图(已交付/最近更新/能力清单) · 盈利模式 · Star 历史 · 多语言 README · 联系我们                                                                  |
| [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md)                     | SEO 与品牌故事        | 高密度曝光与 AI 引擎适配 · 我们的故事 · 开源共建愿景 · License · 加入我们 · 致谢 · Quick FAQ · Keywords 全表                                                                |
| [`readme-09-ops-tools`](./docs/engineering/readme-09-ops-tools.md)                                       | 运维工具与留档        | 发布线收口新增对外能力与运维入口 · 运维与生产监控工具 · 守门补登(服务二进制路径等) · 尾部悬空表行留档                                                                       |

---

## 八端清单

工作区里是 **9 个 app 包**(下表最后一行是 Capacitor 壳,拿 Web 端 `out/` 静态导出打 Android/iOS 原生包;桌面端不打包本地前端产物,见下方桌面行与 `docs/port-management.md` 薄壳条目),

共享 **16 个 packages**。各端是独立代码,跨端一致由设计令牌单一源
([`packages/design-tokens`](./packages/design-tokens))与契约对账保证。

| 端           | 目录                | 技术栈                                         | 说明                                                      |
| ------------ | ------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Web          | `apps/web`          | Next.js 16 + React 19 + Tailwind 4 + shadcn/ui | 主站点 + 管理后台 + IDE 面板                              |
| API          | `apps/api`          | Fastify 5 + Drizzle ORM + PostgreSQL + Zod     | 业务后端:认证/租户/计费/内容/WebSocket                    |
| AI 服务      | `apps/ai-service`   | FastAPI + LangGraph + LiteLLM + MCP            | 模型网关、Agent 引擎、RAG、工作流                         |
| 小程序       | `apps/miniapp-taro` | Taro 4 + React + NativeWind(v3 类名)           | 微信端,微信支付原生集成                                   |
| 移动 App     | `apps/mobile-rn`    | React Native + Expo + NativeWind               | 与共享屏层 `packages/app` 同源                            |
| 桌面         | `apps/desktop`      | Tauri 2(Rust 薄壳)+ web 前端                   | 打包态不内嵌前端产物,复用 Web 全部能力;系统托盘、自动更新 |
| 浏览器扩展   | `apps/extension`    | WXT + Chrome MV3                               | Side Panel 工具集                                         |
| CLI          | `apps/cli`          | Node.js + TypeScript                           | 终端助手、工具集、规范/漂移检查、Agent 引擎客户端         |
| Capacitor 壳 | `apps/mobile-cap`   | Capacitor 7                                    | 复用 `apps/web` 的 `out/` 静态导出打原生包                |

共享层:`packages/`(database / auth / types / ui-react / shared / api-client / design-tokens / i18n / config / …)。
跨端契约与「改了手机端 web 没改」这一型的防治,见 [`AGENTS.md` §4 跨端样式同步铁律](./AGENTS.md);
8 端职责、下载矩阵与桌面薄壳方案全文见 [`readme-04`](./docs/engineering/readme-04-architecture-and-modules.md)。

移动 App（`apps/mobile-rn`）的用户侧功能面按 web 同名页逐页对齐，硬规矩是**每屏只接 `apps/api` 里真实注册的路由**：后端没有实现或只回显不入库的入口，端内不造 UI（宁可不做，也不给一个点了没反应的按钮）。2026-10-21 一批补齐 35 屏 —— 安全中心（评分／两步验证／会话撤销／安全事件）、开发者 API 密钥、数据权利与导出、第三方账号、用量、发票、收货地址、积分中心、错题本、我的试卷、分销汇总、发布四屏（账号／新建／日历／数据）、智能体分类、知识库与 RAG 文档管理、图片模板与画廊、语音转写、群组、文章与问答编辑、广场发布、AI 世界创建等。入口分布在「设置」菜单与「我的」页菜单，五语言词条同批落 [`packages/i18n/messages/mobile-rn/`](./packages/i18n/messages/mobile-rn)。
同轮补的后端与承载面(2026-10-21):`GET/POST/DELETE /api/user/ip-whitelist` 与 `GET/PUT /api/agent/security-config` 落进 `user_preferences(group='security')` —— web 那两张卡此前打的是没有后端的路径;两面**只存不拦**(IP 白名单要拦在哪一层是待拍板的产品语义,`security-config-routes.ts` 头注把原因写全)。「Web 功能门户」现读 13 组 91 条(本轮新增「账单管理」`/settings/billing` 与「知识库」`/knowledge`,两端同表,清单唯一真相源在 `packages/shared/src/constants/web-portal.ts`);记忆详情按 web `/memory/[id]`(那张页带编辑+保存,共享记忆屏只有新建/删除)走既有 WebView 承载,URL 形状同样住在该同源。

---

## 🚀 快速开始

### 环境要求

| 依赖       | 版本            | 备注                     |
| ---------- | --------------- | ------------------------ |
| Node.js    | ≥ 20(实测 24)   | `packageManager` 锁 pnpm |
| pnpm       | ≥ 9             | `corepack enable` 即可   |
| PostgreSQL | ≥ 15 + pgvector | 或直接用 compose 起      |
| Redis      | ≥ 7             | 缓存与队列               |
| Python     | ≥ 3.12          | 仅 `apps/ai-service`     |
| Docker     | ≥ 24            | 推荐路径                 |

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

Windows 一键启动(9 个启动脚本)、环境变量逐项说明、REST/WebSocket API、模型同步与 IM 多平台:
[`readme-05-quickstart-api-data`](./docs/engineering/readme-05-quickstart-api-data.md)。

---

## 部署

| 主题                           | 入口                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------ |
| 生产运行手册(蓝绿、回滚、证书) | [`docs/DEPLOYMENT_RUNBOOK.md`](./docs/DEPLOYMENT_RUNBOOK.md)                   |
| Compose / IaC 决策与理由       | [`docs/INFRASTRUCTURE_DECISION.md`](./docs/INFRASTRUCTURE_DECISION.md)         |
| 监控与告警(邮件单通道)         | [`docs/MONITORING.md`](./docs/MONITORING.md)                                   |
| 数据库备份与只读备份角色       | [`docs/DATABASE.md`](./docs/DATABASE.md)                                       |
| 凭据轮换                       | [`docs/CREDENTIAL_ROTATION_RUNBOOK.md`](./docs/CREDENTIAL_ROTATION_RUNBOOK.md) |
| CI 工作流清单与触发条件        | [`.github/workflows/`](./.github/workflows) + 本页生成块的工作流计数           |
| 部署/构建全局锁(禁止并发构建)  | [`AGENTS.md` §12 部署/构建全局锁](./AGENTS.md)                                 |

详细部署叙述(端口管理规则、生产部署 10 项硬性门禁、IaC 决策)在
[`readme-06-security-observability-gates`](./docs/engineering/readme-06-security-observability-gates.md)。

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
4. **单分支开发**:除 `goal/*` 外不许建分支;main 已开分支保护,跨会话收敛走 PR 或
   `git-sync-converge` 语义。
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

守门链现状(数量现读本页生成块,别照抄任何文档里的数字):

```bash
node scripts/guardian-runner.mjs --staged     # pre-commit 全批
node scripts/check-gate-wiring.mjs            # 「门造好了但没装车」对账
```

新增一道门**必须**用 `node scripts/gate-registry-insert.mjs`(自己取空闲号、自己保住别人的注册块),
不得手填编号;并同步在 `AGENTS.md` 点名。守门全表、执行语义与补登台账见
[`readme-06`](./docs/engineering/readme-06-security-observability-gates.md)。

**版本号漂移守门** `scripts/check-version-drift.mjs`(已接 `ci.yml`):判据不是"版本号是多少",
而是**每个对外可见的版本号都必须可追溯到某个源头** —— A 桌面 `tauri.conf.json` 与
`apps/desktop/package.json` 双写一致;B/C `apps/mobile-rn` 的原生 `versionName` 与界面
`APP_VERSION` 都必须取自环境变量或 `package.json`;D Capacitor 壳不得出现字面量
`versionName`/`versionCode`;E 下载页 web/mobile/extension/cli 四端不得写死语义版本字面量;
F 两条更新器 feed route 必须走 `resolveDesktopFeedForUpdater`(不得退回读静态快照);
G 不得再出现 bot 裸 `git push` 到 main(该路径在 protected main 上恒被 GH006 拒,
GITHUB_TOKEN 推送不触发 workflow ⇒ required check 永不出现,只会制造每天一次的假红)。
自检 `node --test scripts/tests/check-version-drift.test.mjs`(13/13,每条判据都配了能被它抓住的反例)。
立因:桌面下载页与更新器 feed 曾静默停在 0.1.54 四天,而仓库已发到 0.1.58;
同一时期安卓侧三处版本号互相矛盾、Capacitor 壳写死 `"1.0"` 从不跟真实版本走。

---

## 文档导航

| 想知道                      | 去哪                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| README 拆出的九份原文收纳件 | [`docs/engineering/`](./docs/engineering)(readme-01 ~ readme-09,见上文总表)                                                        |
| 架构总览                    | [`docs/architecture.md`](./docs/architecture.md)                                                                                   |
| API 参考 / 认证             | [`docs/API_REFERENCE.md`](./docs/API_REFERENCE.md) · [`docs/AUTHENTICATION.md`](./docs/AUTHENTICATION.md)                          |
| 数据库与迁移                | [`docs/DATABASE.md`](./docs/DATABASE.md)                                                                                           |
| AI 服务与模型接入           | [`docs/AI_SERVICE.md`](./docs/AI_SERVICE.md) · [`docs/LLM_SETUP.md`](./docs/LLM_SETUP.md)                                          |
| 多端与共享层                | [`docs/MULTI_END.md`](./docs/MULTI_END.md) · [`docs/PACKAGES.md`](./docs/PACKAGES.md)                                              |
| UI 规范                     | [`docs/UI_GUIDELINES.md`](./docs/UI_GUIDELINES.md)                                                                                 |
| i18n 治理                   | [`docs/I18N.md`](./docs/I18N.md)                                                                                                   |
| 测试 / 性能 / 安全          | [`docs/TESTING.md`](./docs/TESTING.md) · [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) · [`docs/SECURITY.md`](./docs/SECURITY.md) |
| 监控 / 发布 / 事故复盘      | [`docs/MONITORING.md`](./docs/MONITORING.md) · [`docs/RELEASE.md`](./docs/RELEASE.md) · [`docs/INCIDENTS.md`](./docs/INCIDENTS.md) |
| SDK 与 CLI                  | [`docs/SDK.md`](./docs/SDK.md) · [`docs/CLI.md`](./docs/CLI.md)                                                                    |
| 贡献流程                    | [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) · [`CONTRIBUTING.md`](./CONTRIBUTING.md)                                          |
| 常见问题                    | [`docs/FAQ.md`](./docs/FAQ.md) · [`docs/TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)                                            |
| 学习资产(工作流反馈来源)    | [`docs/learning-assets.md`](./docs/learning-assets.md)                                                                             |

英文版见 [`README.en.md`](./README.en.md);日文/韩文版在 `README.ja.md` / `README.ko.md`
(数字以本页与 `pnpm doc:numbers` 为准)。

---

## 许可与版权

- **License**:Apache-2.0(全文见 [`LICENSE`](./LICENSE));贡献者协议见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。
- **NOTICE**:分发时须保留 [`NOTICE`](./NOTICE) 与源码头部版权行。
- **溯源水印**:源码文件带三层水印(可见横幅 + 横幅内零宽载荷 + 文件尾不可见行),
  由 `scripts/watermark.mjs` 与守门维护。它不改变 Apache-2.0 授予的权利,
  只用于第三方内容归属对账(见 `config/third-party-provenance/`)。
- **商标与品牌**:「智汇AI / IHUI-AI」及图示为本项目所有;Apache-2.0 不授予商标使用权。
- **第三方依赖**:各自许可证以所装版本为准,vendored 内容登记在第三方来源台账。
- **代码签名**:Windows 版 `ihui.exe` 的免费代码签名由 SignPath Foundation 提供(SignPath.io 平台、Sectigo CA 签发);
  签名范围、构建来源与审批流程见 [`apps/cli/README.md`](./apps/cli/README.md#code-signing-policy)。
- **隐私**:CLI 的全部外连面(仅用户配置端点、可用 `IHUI_NO_UPDATE_CHECK=1` 关闭的版本检查、默认关闭的遥测)见
  [Privacy statement](./apps/cli/README.md#privacy-statement)。

## 联系我们

- 官网 / 文档:<https://aizhs.top>
- 议题与缺陷:<https://github.com/IHUI-INF-AI/IHUI-AI/issues>
- 安全漏洞(请勿公开贴):[`SECURITY.md`](./SECURITY.md)
- 行为准则:[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- 商务合作:吉林省爱智汇人工智能科技有限公司 · 吉林省长春市高新区越达路 107 号 · 人工智能人才孵化基地
  (联系方式全文与二维码见 [`readme-03`](./docs/engineering/readme-03-why-comparison-scenarios.md) 与 [`readme-07`](./docs/engineering/readme-07-faq-roadmap-commerce.md))

<div align="center">

如果这个项目对你有用,给个 ⭐ 就是最直接的贡献。
Made with an unusually long chain of machine-checkable rules — because "we'll be careful" is not a control.

</div>
---

## 长文与营销归档（不在此重复）

对标矩阵、项目宣言、品牌故事、GEO/Keywords 等**已从根 README 迁出**，完整正文仅保留在 engineering 收纳件：

| 主题 | 文档 |
| --- | --- |
| 定位、宣言、GEO、特性总览 | [`readme-01-positioning`](./docs/engineering/readme-01-positioning.md) |
| 为什么选择、对标矩阵、典型场景 | [`readme-03-why-comparison-scenarios`](./docs/engineering/readme-03-why-comparison-scenarios.md) |
| 品牌故事、Keywords、SEO 长文 | [`readme-08-seo-keywords-story`](./docs/engineering/readme-08-seo-keywords-story.md) |

技术栈、8 端架构、15 大模块详解等见 [`readme-04-architecture-and-modules`](./docs/engineering/readme-04-architecture-and-modules.md) 与其余 [`docs/engineering/`](./docs/engineering/) 收纳件。规模数字只看上文 **关键数字（现算）** 生成块与 `pnpm doc:numbers`。

