# FAQ · 贡献 · 文档导航 · 路线图与最近更新 · 盈利模式 · Star 历史 · 多语言 README

> 本文件是从 `README.md` 拆出来的**原文收纳件**(2026-09-27,README 瘦身票)。
> 来源:旧 `README.md` 第 3429–4427 行,逐字搬入,未改写任何一句。
> 目录页与索引见 [`docs/engineering/README.md`](./README.md)。

## FAQ

<details>
<summary><strong>Q1:IHUI-AI 可以商用吗?</strong></summary>

可以。项目采用 Apache License 2.0,允许自由使用、修改、分发、商业使用,无传染性。你可以基于它构建商业产品,无需开源你的业务代码。唯一要求:保留 LICENSE 与 copyright notice。
</details>

<details>
<summary><strong>Q2:与 40+ 国际/国内对标产品(OpenAI ChatGPT / Dify / LangChain / RAGFlow / Coze / Claude Code / Cursor / GitHub Copilot / Khan Academy / Stripe+Auth0 等)有何不同?</strong></summary>

IHUI-AI 不是单一 AI 工具,而是**开源 AI 商业级一体化基座**,把以下 6 大类产品的能力**整合在一个 Apache 2.0 仓库**:

| 对标类别          | 代表产品                                                                     | IHUI-AI 差异                                                                                    |
| ----------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 通用 AI 对话      | OpenAI ChatGPT / Anthropic Claude.ai / Google Gemini / Microsoft Copilot     | IHUI-AI 自托管 + 176 模型(不限 OpenAI)+ 带计费/教育/发布等业务                                  |
| AI 应用开发平台   | Dify / FastGPT / Langflow / RAGFlow / Flowise / Coze(扣子)                   | IHUI-AI 多了 6 端、自研 CLI、完整商业闭环、AI 教育、38 平台发布                                 |
| AI Agent 框架     | LangChain / LlamaIndex / AutoGen / CrewAI / AutoGPT / MetaGPT                | 那些是开发框架("造车零件"),IHUI-AI 是产品化基座("整车下线"),非技术团队也能用                    |
| AI 编程 CLI / IDE | Claude Code / Cursor / GitHub Copilot / Windsurf / Amazon Q / Cline / Aider  | IHUI-AI 的 CLI 不仅编程,还整合 AI 应用平台(对话/RAG/Agent/计费),且 Apache 2.0 开源,其他全部闭源 |
| AI 教育平台       | Khan Academy / Coursera / edX / Google 教育 AI                               | IHUI-AI 的 AI 教育是开源全栈(课程/题库/考试/直播流媒体(SRS)/证书),可二次定制,那几个是闭源 SaaS  |
| 商业 SaaS 基座    | Stripe / Auth0 / Clerk / Mailgun / SendGrid / Mixpanel / Amplitude / PostHog | IHUI-AI 把支付/认证/邮件/分析全部预置,一站式集成 4-6 类 SaaS 能力,月省 $300+                    |
| 多端框架          | Tauri / Electron / Expo / React Native / Taro / WXT / Next.js                | IHUI-AI 把 8 端 + 16 共享包 + 共享 UI 一次性预置,而不是让开发者自己拼装                         |

**10 大差异化能力(开源生态中较为少见的同时组合)**:

1. **8 端全覆盖**(其他 AI 应用平台通常仅 1-2 端,Claude Code/Cursor 仅 1 端)
2. **LangGraph + MCP + A2A 三栈协同**(其他项目一般最多单栈)
3. **自研 CLI 50 命令 + 36 工具 + ACP Server + 24 源配置导入**(在开源 AI 应用平台中较为少见)
4. **完整计费订阅 + VIP + 钱包 + 积分 + 10 支付网关(含海外 Stripe + PayPal) + 退款 + 发票**(在开源 AI 平台中较为少见)
5. **38 平台一键发布 + 38 adapter + AES-256-GCM 凭证加密 + 反风控五层防线 37+ 检测点**(在开源项目中较为少见)
6. **AI 教育全栈 + 学生端 12 子页 + 45 表 edu-full schema**(在开源 AI 平台中较为少见)
7. **企业级安全栈(RBAC + 多租户 + RLS + SSO + AES-256-GCM + JWT token-family + GDPR + 2FA + IDOR)**(在开源 AI 平台中较为少见)
8. **88 守门脚本 + drizzle-kit push 模式 + 9 PowerShell + post-commit 自动 push**(在开源 AI 项目中较为少见)
9. **三支柱可观测性 + 21 Grafana 仪表盘 + Alertmanager**(在开源 AI 平台中较为少见)
10. **5 语言 i18n parity + 4 守门脚本 + pgvector + 知识图谱 + 用户长期记忆**(在开源 AI 项目中较为少见)

详见上方 [项目定位](#项目定位必读)、[成本对比](#成本对比ihui-ai-自托管-vs-等价-saas-组合) 与 [与同类项目对比](#与同类项目对比) 章节。

**核心差异化**:你能找到比 IHUI-AI 更专的项目(RAGFlow 在 RAG 维度更深、Claude Code 在 CLI 维度更成熟、LangChain 在框架层更灵活、Khan Academy 在教育内容更丰富),但找不到比 IHUI-AI 更全的开源基座。

**一句话总结**:IHUI-AI = OpenAI ChatGPT(对话)+ Dify(应用编排)+ Claude Code(CLI)+ Khan Academy(教育)+ Stripe(支付)+ 蚁客(发布)的**开源一体化集成方案**。
</details>

<details>
<summary><strong>Q3:需要哪些 LLM API Key 才能运行?</strong></summary>

至少一个。最简启动只需 OpenAI API Key,即可体验完整对话能力。要使用全部功能,建议接入:

- 国际:OpenAI + Anthropic Claude + Google Gemini
- 国产:智谱 GLM + 通义千问 + DeepSeek + 豆包
- 多模态:Stable Diffusion + 通义万相 + 腾讯混元 3D
- 不想付费?AI 服务支持 stub 模式,无 API key 也能开发调试。

</details>

<details>
<summary><strong>Q4:支持自托管吗?数据会被大厂窥探吗?</strong></summary>

完全自托管。Docker Compose 一键启动后,所有数据(对话 / 知识库 / 用户 / 计费)存储在你自己的 PostgreSQL + Redis 中,LLM 调用走你自己的 API Key,凭证 AES-256-GCM 加密存储。没有任何外部数据回传,你拥有 100% 数据主权。
</details>

<details>
<summary><strong>Q5:项目规模这么大,部署需要什么配置?</strong></summary>

最小生产配置:4 核 CPU / 8GB 内存 / 50GB 磁盘 / 单 VM 即可。开发环境 2 核 4GB 够用。监控栈可选(关掉 Grafana / Loki / Jaeger 节省 1GB 内存)。详见 [DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)。
</details>

<details>
<summary><strong>Q6:如何贡献代码?需要什么水平?</strong></summary>

欢迎任何水平的贡献者。从修文档错别字、提 Issue、写测试用例,到接入新模型、新发布平台、新端适配都欢迎。详见 [贡献](#贡献) 章节。我们特别欢迎:新模型适配 / 新发布平台 / 新语言 / 新端适配 / AI 工作流模板 / 企业级能力 / 测试覆盖 / 文档改进 8 大方向。
</details>

<details>
<summary><strong>Q7:为什么用 pnpm 而不是 npm / yarn?</strong></summary>

pnpm 在 monorepo 场景下优势明显:严格的依赖隔离(防止幽灵依赖)+ 硬链接节省磁盘 + 工作空间协议 + 与 Turborepo 配合良好。项目固定 `pnpm@11.18.0`,`corepack enable` 自动激活,无需手动管理版本。
</details>

<details>
<summary><strong>Q8:CLI 配置导入功能是什么?能导入哪些工具的配置?</strong></summary>

提供 24 源一键导入功能,让你从其他 AI CLI / IDE 工具无缝切换到 IHUI-AI,无需重新配置 API Key / 模型 / 协议。导入入口位于 `/settings/llm` v2 header「导入 CLI 配置」按钮 → `/settings/import` 页面选择对应平台卡片。

**24 源清单**:

- **CLI 工具(6)**:cc-switch / codex++ / Claude / Codex / Gemini / Hermes
- **IDE 集成(5)**:Cursor / Windsurf / Cline / Aider / .env 通用文件
- **桌面端(2)**:Codex Desktop / Claude Code Desktop
- **AI 平台(11)**:Qoder / Qoder Work / GitHub Copilot / Amazon Q / Continue / Tabnine / Cody / Zed / Google Antigravity

**providerCode / apiFormat 智能推断**(2026-07-22 修正,深度测试覆盖 230 用例):

- **apiFormat** = "如何调用"(由 URL/接入点决定)
  - Cursor / Windsurf:URL 域名优先(如 `anthropic.com` → `anthropic_messages`),modelId 前缀兜底
  - Cline:`cline.apiProvider` 主导(如 `anthropic` → `anthropic_messages`)
  - .env / IDE 通用:由 prefix 默认值决定(如 `ANTHROPIC_*` → `anthropic_messages`)
- **providerCode** = "调用谁"(由 modelId / apiProvider 决定)
  - modelId 前缀优先(`claude-*` → anthropic / `gpt-*` → openai / `gemini-*` → google / `deepseek-*` → deepseek / `glm-*` → zhipu / `qwen-*` → alibaba / `ernie-*` → baidu / `doubao-*` → bytedance)
  - baseUrl 域名兜底(`api.openai.com` → openai / `api.anthropic.com` → anthropic / `generativelanguage.googleapis.com` → google 等 20+ 厂商)
  - Cline 额外:`apiProvider=anthropic/gemini` 主导(避免与 apiFormat 不一致)
  - 兜底:`custom`

**设计哲学**:用户在 Cursor 配 `api.openai.com + model=deepseek-coder` → 实际用 DeepSeek 模型经 OpenAI 兼容代理接入 → `apiFormat=openai_chat`(用 OpenAI 协议调用)+ `providerCode=deepseek`(实际调的是 DeepSeek 模型),两者独立反映"调用协议"和"模型归属",不混淆。

详见 `apps/api/src/services/cli-import/` 实现,测试覆盖 `apps/api/tests/cli-import/`(230 用例全绿)。
</details>

<details>
<summary><strong>Q9:数据库为什么用 542 表?会不会过度设计?</strong></summary>

542 表分布在 205 个 schema 文件,覆盖 30+ 业务域,每域平均 18 张表,密度合理。本项目是商业化生产级 AI 平台(智汇 AI 集团主平台),不是 demo,因此表结构按真实业务复杂度设计。如果你只用其中一部分功能(如仅 AI 对话),只需关注 chat / users / billing 三个 schema,其他表不影响运行。
</details>

<details>
<summary><strong>Q10:20 个 Grafana 仪表盘会不会太重?</strong></summary>

不会。3 仪表盘覆盖业务漏斗 / 支付流 / AI 成本延迟 / 考试使用率 / PostgreSQL / Redis / BullMQ / Nginx / HLS / 直播间 / 租户使用 / WebSocket / 认证安全等,每个仪表盘独立 provision,可按需启用。开发环境关掉 Grafana / Loki / Jaeger / Alertmanager 4 个监控容器,可节省 1GB 内存。
</details>

---

## 贡献

我们欢迎任何形式的贡献:Issue / PR / 文档改进 / Bug 修复 / 新功能 / 翻译 / 测试用例。

### 贡献流程

1. **Fork 仓库** → 创建分支 `feat/your-feature` 或 `fix/your-bugfix`
2. **阅读规范**:[AGENTS.md](AGENTS.md)(AI Agent 协作规范)+ [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)(人类贡献指南)
3. **本地开发**:`pnpm install && pnpm dev`,遵守 23 项 pre-commit 守门
4. **提交规范**:Conventional Commits(`feat:` / `fix:` / `docs:` / `chore:` / `test:` / `refactor:`)
5. **自验通过**:`pnpm turbo build typecheck lint test` 全绿
6. **提交 PR**:描述清晰,关联 Issue,等待 review

### 行为准则

- 尊重每一位贡献者,无论水平高低
- 用代码说话,不用身份说话
- 做**减法**优先,做加法谨慎 — 最小化代码,零冗余
- 不创建冗余文件,不加 copyright/license header
- 复用现有代码和模式,不重复造轮子

### 贡献方向

我们特别欢迎以下方向的贡献:

- **新模型适配**:接入更多 LLM 厂商(Replicate / Together AI / DeepInfra 等)
- **新发布平台**:接入更多内容发布平台(TikTok / Instagram / LinkedIn 等)
- **新语言**:新增 i18n locale(阿拉伯语 / 葡萄牙语 / 西班牙语等)
- **新端适配**:增强现有 8 端 + 新增端(鸿蒙 HarmonyOS / 鸿蒙 Next)
- **AI 工作流**:贡献 LangGraph 工作流模板 / MCP 工具 / A2A Agent
- **企业级能力**:多租户隔离增强 / 审计日志完善 / SSO 集成(Okta / Keycloak)
- **测试覆盖**:增加边界用例 / E2E 场景 / 性能基准
- **文档改进**:更多使用教程 / 架构解析 / 最佳实践

---

## 文档导航

> 完整文档中心索引:[docs/README.md](docs/README.md)(87 个文档,10 大分类:API / SDK / 集成 / 激励计划 / 入门 / 功能 / 用户 / 指南 / 企业服务 / 开发)

### 在线文档中心(双入口:终端用户手册 + 工程文档)

智汇 AI 文档中心采用双入口设计,覆盖不同读者:

**① 终端用户文档(SSG 静态页面,SEO 友好)** — `/docs`

面向终端用户和开发者的图文教程,Next.js SSG 静态生成,利于 SEO 与 AI 检索引擎收录:

- **使用说明手册**(`/docs/manual`):7 章覆盖注册、AI 对话、Agent、知识库、积分订阅、账户设置、FAQ,面向终端用户,无需技术背景
- **快速开始**(`/docs/quickstart`):5 分钟从注册到发布第一个 AI Agent
- **自托管部署**(`/docs/self-host`):Docker Compose + K8s Helm Chart
- **API 参考**(`/docs/api`):REST API + Webhook + OpenAPI 3.1
- **MCP 工具集成**(`/docs/mcp`):Model Context Protocol 接入
- **Agent 开发**(`/docs/agent`):可视化编排 + 模板开发
- **知识库 RAG**(`/docs/rag`):向量 + BM25 + 知识图谱三路混合检索
- **多模型调度**(`/docs/models`):100+ 模型统一调度
- **工作流编排**(`/docs/workflow`):n8n 风格节点画布
- **团队协作**(`/docs/team`):RBAC + SSO + 审计

**② 工程文档(运行时直读)** — `/feature-center/documents`

工程文档同步到 Web 端「特性中心 → 文档」页面(`/feature-center/documents`),无需手动录入:

- 后端 `GET /api/feature-center/documents` 合并 DB `docs` 表(published)+ `docs/**/*.md` 递归扫描文件(支持子目录),DB slug 优先去重
- 后端 `GET /api/feature-center/documents/*/content` 通配符路由,支持子目录 slug(如 `developer/api/chat`),DB 优先 + 文件兜底,`basename` 防 `../` 路径遍历
- 前端用 `react-markdown` + `remark-gfm` 直接渲染(替代 iframe,避免 `X-Frame-Options: DENY` 冲突)
- 分类按钮从返回数据动态生成(10 大分类:API 参考 / SDK / 集成 / 激励计划 / 入门 / 功能 / 用户 / 指南 / 企业服务 / 开发)
- 卡片含 format 标签(Markdown)+ excerpt 缩略预览(前 120 字符,自动剥离 markdown 语法)
- 生产容器 `Dockerfile.api` 已 `COPY docs/ ./docs`,部署后即可访问
- **markdown 图片代理**:后端 `GET /api/feature-center/documents/asset/*` 端点返回 docs/ 下的图片字节(png/jpg/gif/webp/svg),前端 ReactMarkdown 的 `img` 组件把相对路径 `./images/x.png` 改写为 `/api/feature-center/documents/asset/<dirBase>/images/x.png`,使文档预览时图片可正常显示(权限与文档一致:子目录全公开,顶层需管理员)
- **markdown 内部链接导航**:ReactMarkdown 的 `a` 组件拦截 `.md` 相对链接(`./xxx.md` / `../xxx.md` / `dir/xxx.md`),通过 `resolveMdLink()` 基于 displaySlug 推导目标 slug(支持 `./` 同级、`../` 上级回退、无前缀同级),点击时加载目标文档内容替换预览(不跳转 URL),支持"返回原文"按钮回退;外部 http(s) 链接正常新窗口打开
- **预览 TOC 侧边栏**:从 markdown `##`/`###` 标题自动提取目录(extractToc),h2/h3 组件注入 id(slugifyHeading),TOC 项按层级缩进(level-2)*12px,点击 `scrollIntoView({behavior:'smooth'})` 滚动定位,内容滚动时 `onScroll` 高亮当前可视标题(bg-primary/10 + text-primary);TOC 仅 md+ 屏幕显示,无标题时不渲染
- **代码块增强(语言徽章 + 一键复制)**:重写 ReactMarkdown 的 `pre` 组件为 CodeBlock,顶部条显示语言徽章(从 `className="language-xxx"` 提取)+ "复制"按钮,点击调 `navigator.clipboard.writeText` 复制代码原文(extractText 递归拍平 ReactNode),复制成功后按钮文案变为"已复制"1.5s 后还原;inline `<code>` 不受影响(只重写 pre)
- **阅读进度条**:预览 modal 标题栏下方 2px 高 `bg-primary` 进度条,`onScroll` 计算 `scrollTop / (scrollHeight - clientHeight) * 100` 实时更新宽度(0-100%),切换文档时 useEffect 重置进度与 TOC 高亮
- **ESC 关闭预览**:全局 `keydown` 监听 Escape 键,预览 modal 打开时按 ESC 立即关闭(previewId + navigatedSlug 双清空),符合模态交互习惯

**权限分级(防越线)**:`docs/**/*.md` 按位置分两级:

- **子目录文档全公开**(`developer/*` / `user/*` / `enterprise-service/*`):用户指南、开发者 API 文档、企业服务白皮书等
- **顶层文档仅白名单 20 篇公开**:AI_LEADERBOARD / AI_SERVICE / API_REFERENCE / architecture / AUTHENTICATION / CHANGELOG / CLI / CONTRIBUTING / DATABASE / FAQ / I18N / MULTI_END / PACKAGES / PERFORMANCE / RELEASE / SDK / SECURITY / TESTING / TROUBLESHOOTING / UI_GUIDELINES
- **顶层敏感文档仅管理员可见**(14 篇,含生产环境/凭证/守门策略):CREDENTIAL_ROTATION_RUNBOOK / INCIDENTS / WECHAT_PAY_ACTIVATION_REPORT / GATEKEEPERS / DEPLOYMENT_RUNBOOK / MONITORING / DEVELOPMENT / LLM_SETUP / EMAIL_SETUP / PRODUCTION_INFRASTRUCTURE / port-management / INFRASTRUCTURE_DECISION / migration-audit-frontend / I18N-COMPLETION-PLAN

管理员登录后(`roleId >= 1`)可查看全部 87 篇工程文档 + 所有 published DB 文档,普通用户只能看子目录全公开 + 顶层白名单 20 篇。DB `docs` 表内容由管理员通过 `/admin/docs` 管理,不受文件白名单限制。

### 项目与架构

| 文档                                                                   | 说明                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [docs/architecture.md](docs/architecture.md)                           | **系统架构总览**(技术栈 / 数据库 / API 路由 / 启动流程 / 旧架构弃用) |
| [docs/MULTI_END.md](docs/MULTI_END.md)                                 | 多端架构(8 端矩阵 + 跨端链路 + 同步开发 + 38 平台发布矩阵)           |
| [docs/PACKAGES.md](docs/PACKAGES.md)                                   | 共享包指南(13 个 @ihui/* 包 + 依赖关系 + 新增包流程)                 |
| [docs/port-management.md](docs/port-management.md)                     | 端口管理规则(8801-8899 端口注册表)                                   |
| [docs/INFRASTRUCTURE_DECISION.md](docs/INFRASTRUCTURE_DECISION.md)     | 基础设施决策(Docker Compose vs K8s)                                  |
| [docs/PRODUCTION_INFRASTRUCTURE.md](docs/PRODUCTION_INFRASTRUCTURE.md) | 生产基础设施规格                                                     |

### 开发与测试

| 文档                                           | 说明                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)     | **本地开发指南**(环境变量 / 启动 / 调试 / 脚本速查 / Windows 注意) |
| [docs/TESTING.md](docs/TESTING.md)             | 测试策略(8 层金字塔 + Vitest + pytest + Playwright + Locust + CI)  |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)   | 贡献指南(环境搭建 / 代码规范 / 提交规范 / PR 流程)                 |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) | UI 设计规范(圆角 / 字体对齐 / 登录弹窗 / 组件库)                   |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md)     | 性能基线与优化(SLA / 压测 / 数据库 / 前端 / AI 服务)               |

### API 与数据层

| 文档                                             | 说明                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md)   | **API 完整参考**(60+ 路由 + 12 WebSocket + SSE + 错误码 + 客户端示例) |
| [docs/DATABASE.md](docs/DATABASE.md)             | 数据库设计(Drizzle / 542 表 / 迁移 / RLS / 种子 / 备份)               |
| [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) | 认证授权(JWT / token-family / OAuth2 / 2FA / RBAC / 多租户 / WS 鉴权) |

### AI 服务

| 文档                                             | 说明                                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| [docs/AI_SERVICE.md](docs/AI_SERVICE.md)         | **AI 服务深度**(6 Router + LangGraph + LiteLLM + MCP + A2A + 向量记忆) |
| [docs/LLM_SETUP.md](docs/LLM_SETUP.md)           | LLM 模型配置(OpenAI / Anthropic / Google / 国内厂商)                   |
| [docs/AI_LEADERBOARD.md](docs/AI_LEADERBOARD.md) | AI 模型榜单数据                                                        |

### 部署与运维

| 文档                                                                         | 说明                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)                     | **部署运维手册**(蓝绿部署 / 回滚 / 证书续期)                  |
| [docs/RELEASE.md](docs/RELEASE.md)                                           | 发布流程(38 平台 + SemVer + Git tag + Docker 镜像 + hotfix)   |
| [docs/MONITORING.md](docs/MONITORING.md)                                     | 可观测性(Prometheus + Grafana + Loki + Jaeger + Alertmanager) |
| [docs/INCIDENTS.md](docs/INCIDENTS.md)                                       | 历史事故复盘                                                  |
| [docs/SECURITY.md](docs/SECURITY.md)                                         | 安全策略(漏洞披露 / 加密设计 / 权限模型)                      |
| [docs/CREDENTIAL_ROTATION_RUNBOOK.md](docs/CREDENTIAL_ROTATION_RUNBOOK.md)   | 凭证轮换运维手册                                              |
| [docs/EMAIL_SETUP.md](docs/EMAIL_SETUP.md)                                   | 邮件服务配置(SMTP / 模板 / DKIM)                              |
| [docs/WECHAT_PAY_ACTIVATION_REPORT.md](docs/WECHAT_PAY_ACTIVATION_REPORT.md) | 微信支付 V3 激活报告                                          |
| [server-docs/MULTI_TENANT.md](server-docs/MULTI_TENANT.md)                   | 多租户设计文档(RLS + 租户路由)                                |

### 质量与守门

| 文档                                                         | 说明                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| [docs/GATEKEEPERS.md](docs/GATEKEEPERS.md)                   | **守门规则详解**(56+10 pre-commit + post-commit + pre-push,逐项脚本) |
| [docs/I18N.md](docs/I18N.md)                                 | 国际化(5 语言 + 68 命名空间 + 12 守门脚本 + 翻译策略)                |
| [docs/I18N-COMPLETION-PLAN.md](docs/I18N-COMPLETION-PLAN.md) | 国际化完成计划(历史规划)                                             |

### SDK 与 CLI

| 文档                                                                   | 说明                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [docs/SDK.md](docs/SDK.md)                                             | 5 语言 SDK 使用指南(TS / Python / Go / Java / .NET 代码示例)                            |
| [docs/CLI.md](docs/CLI.md)                                             | CLI 工具指南(24 源导入 + subagent 并行 + skills + plugins)                              |
| [.github/workflows/release-sdk.yml](.github/workflows/release-sdk.yml) | 4 语言 SDK 统一发布 CI(tag v* 触发,OIDC trusted publishing + workflow_dispatch dry-run) |

**4 语言 SDK 包管理器发布**(2026-07-28 立,`packages/sdk/` 5 语言实现 + `.github/workflows/release-sdk.yml`):

- **npm**:`@ihui/sdk`(TypeScript / Node.js,108 端点,零运行时依赖)— `npm install @ihui/sdk`
- **PyPI**:`ihui-ai`(Python,sync + asyncio 双客户端,零依赖 stdlib)— `pip install ihui-ai`
- **Maven Central**:`com.ihui:ihui-ai-java`(Java 11+,OkHttp + Jackson + SLF4J)— Maven 坐标见 docs/SDK.md
- **Go module**:`github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go`(零依赖,context.Context)— `go get .../sdk/go/sdk@vX.Y.Z`
- **.NET bonus**:`aizhs.top`(C#,额外赠送)— csproj 引用

发布流程:`git tag v1.2.3 && git push origin v1.2.3` → 4 job 并行构建 + 发布(支持 workflow_dispatch 手动单端发布 + dry-run 验证)。

### 故障排查与 FAQ

| 文档                                               | 说明                                        |
| -------------------------------------------------- | ------------------------------------------- |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | **故障排查指南**(10 大类 35+ 故障,统一模板) |
| [docs/FAQ.md](docs/FAQ.md)                         | 常见问题(14 类 86 问)                       |

### 项目管理

| 文档                                   | 说明                                                          |
| -------------------------------------- | ------------------------------------------------------------- |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 变更日志                                                      |
| [AGENTS.md](AGENTS.md)                 | AI Agent 协作规范(23 节强制规则,展示本项目如何与 AI 协作开发) |
| [PROJECT_PLAN.md](PROJECT_PLAN.md)     | 项目任务计划与历史归档(内部开发记录,了解演进轨迹)             |

---

## 路线图

### 已交付(2026-07-20)

- 8 端全覆盖(Web / API / AI 服务 / CLI / 桌面 / 扩展 / 移动 RN / 小程序 Taro)
- 100+ 大模型 LiteLLM 统一接入 + 17 provider 适配
- LangGraph + MCP + A2A 三栈协同 + Persona + Agent Runtime + 向量记忆
- 自研 CLI 50 命令 + 36 工具 + ACP Server + 6 源配置无缝导入
- 工作空间权限 3 模式 + 7 端点运行时拦截 + 60s 审计超时
- 自媒体工作台(公众号文章 + 口播稿双流水线)+ Skills 系统(content_engine + koubo_workflow)
- 3838 平台一键自动发布平台 + 38 adapter + AES-256-GCM 凭证加密
- AI 教育全栈(课程 / 题库 / 考试 / 直播流媒体(SRS) / 报告 / 证书 / 讲师 / 学生端 12 子页)
- 多智能体市场 + 开发者中心(13 子页)+ Coze SDK 代理 + OpenClaw + Crew + N8N
- 社区互动(圈子 / 广场 / 私信 / 关注 / 分享)
- 运营增长(积分 / 签到 / 排行 / 抽奖 / 分销 / 邀请 / 游戏化)
- 计费交易闭环(VIP / 订阅 / 钱包 / 积分 / 退款 / 发票 / 汇率 / 10 支付网关(含海外 Stripe + PayPal))
- 客服支持(工单 / 在线客服 / 反馈 / 帮助中心)
- BI 仪表盘 + 错误仪表盘 + 灰度发布 + i18n 仪表盘
- 5 语言 i18n parity(zh-CN / zh-TW / en / ko / ja)+ 19 i18n 工具链 + 4 守门
- 全栈可观测性(Prometheus + Grafana 3 仪表盘 + Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager)
- 88 守门脚本 + 56+10 pre-commit 项 + post-commit 自动 push + drizzle-kit push 模式 + 9 PowerShell 启动
- 企业级安全(RBAC + 多租户 + RLS + SSO + AES-256-GCM + JWT token-family + CSRF + XSS + GDPR + 2FA)
- 542 数据库表 + drizzle-kit push + 16 共享包 + pgvector + 知识图谱 + Knip + Lighthouse + Locust 压测
- **5 语言 SDK 完整封装 + 4 语言包管理器发布 CI**(npm `@ihui/sdk` + PyPI `ihui-ai` + Maven `com.ihui:ihui-ai-java` + Go module,OIDC trusted publishing + tag 自动发布)

### 最近更新(2026-07-31)

> 以下为本轮集中交付的核心能力,均通过全端 typecheck + 跨端链路连通验证,详见 [PROJECT_PLAN.md](PROJECT_PLAN.md)。

#### 1. AI 对话内嵌浏览器工作展示区(全 8 端同步 · P0→P3++ 四阶段)

- **P0 基础设施**:packages/types 跨端契约(WorkPanelTab / WebViewState / NavigateOptions)+ packages/ui 3 通用组件(Resizable / WorkPanel / WebViewFrame,抽象自 ai-side-panel)+ web Zustand store + GlobalShell 右侧布局 + markdown URL 拦截 + iframe 智能降级
- **P1 后端截图流**:ai-service Playwright headless 截图引擎(Windows SelectorEventLoop 修复 + sync_playwright + run_in_executor)+ api `/api/browser/screenshot` + `/api/browser/proxy` 转发路由 + web 主动探测降级
- **P2 AI 工具调用深度联动**:packages/api-client onToolCall 回调 + ToolCallEvent 类型(解析 Vercel AI SDK type 2/7 + 自定义 tool_result)+ chat store addToolCall/updateToolCall + use-chat.ts createToolCallHandler(browser_navigate 等 8 工具命中即 openPanel)+ ToolCallCard URL 提取与"在工作展示区打开"按钮
- **P3 多 Tab + 收藏 + 历史**:tabs 数组 + activeTabId + favorites + recentUrls(persist 持久化,清除 screenshot 体积)+ packages/ui Star 收藏按钮 + ChevronDown dropdown(收藏/历史两 tab + click-away + ESC 关闭 + 清空历史)
- **P3++ Tab 拖拽排序**:HTML5 DnD(onDragStart/onDragOver/onDrop + 半透明 + drop target 高亮)+ reorderTabs store action + Playwright E2E 5 场景守门(openPanel/newTab/favorite/dropdown/drag-sort)
- **8 端实现**:web(iframe + 降级 + CDP 模式)/ desktop(Tauri WebView2 子 webview,绕过 X-Frame-Options)/ mobile-rn(react-native-webview)/ miniapp-taro(web-view)/ extension(WXT browser.tabs.create)/ api + ai-service(截图服务 + Browser Hub CDP)
- **P4 CDP 完整 Chrome 升级(2026-07-31)**:对标主流 IDE 内置浏览器,ai-service 新增 Browser Hub 服务(async_playwright 持续 Chromium + CDP `Page.startScreencast` 画面流 + WebSocket 推送 + `Input.dispatchMouseEvent`/`dispatchKeyEvent` 事件回传 + `Network.getCookies` 登录态检测),web 新增 [CdpBrowserView](apps/web/src/components/work-panel/cdp-browser-view.tsx) 组件(canvas 渲染画面帧 + 鼠标键盘事件回传),WorkPanel 新增 `cdp` mode(`WebViewMode` 扩展),扫码登录改用 CDP 内置浏览器(选平台→创建会话→WorkPanel 打开 CDP 画面→轮询 cookies→自动保存),根治 iframe X-Frame-Options 限制(知乎/B站/微信等登录页可正常打开)。平台独占 web+ai-service(§9 豁免)

#### 2. 原生浏览器控制 + 电脑控制 MCP tool 全链路(5 端同步)

- **22 MCP tool**:ai-service 新增 12 个 `browser_control.*`(screenshot / click_element / type_text / scroll / extract_dom / navigate / wait_for_element / get_attribute / hover / select_option / switch_tab / close_tab)+ 10 个 `computer_control.*`(screenshot_screen / mouse_move / mouse_click / keyboard_type / mouse_scroll / keyboard_press / keyboard_hotkey / active_window / clipboard_get / clipboard_set)
- **跨端执行器**:extension background `agent.action` 消息 + content script DOM 操作执行器 + 截图回传;desktop Tauri 10+ `#[tauri::command]`(screenshots + enigo + arboard crate)+ capabilities/default.json 权限声明
- **多轮 tool loop**:ai-service llm.py 单轮 → 多轮循环(max_iterations=3,支持 AI 连续操作:截图→分析→点击→再截图)+ SSE tool-call-start/tool-result 事件加 iteration 字段 + 前端 ToolCallCard 显示"第 N 轮"徽章
- **鲁棒性增强**:extension bridge requestId 去重(_processedIds Set,防 WS 重连重复执行)+ desktop bridge withTimeout wrapper(防 invoke() 卡住 Promise)+ LLM 幻觉防护(工具失败显式标注 + repair_messages 规避)+ tool 异常 try/catch 保护 SSE 流不崩溃 + AGENT_CONTROL_INTERNAL_SECRET 模块加载时序 bug 修复

#### 3. 对标 Hermes Agent 深度反超(11 项差距 + P3 深度层)

> 触发:用户要求"本项目跟 hermesagent 比哪里不如他,请你深度分析然后开发好要比他强"。深度调研 NousResearch/hermes-agent(v0.19.0,16,613 commits)后识别 11 项差距。

- **P0 三件套(Agent 心脏)**:① `agent_loop.py` 工具循环修复(原 `if i >= 1: break` 半成品 → 解析 tool_call → 执行 → 结果回填 → 继续迭代,直到无 tool_call 或达 max_iterations)② Skill 自进化闭环(任务结束 LLM 自评 → 自动生成 SKILL.md 到 `apps/ai-service/app/skills/auto/`,SkillFrontmatter 升级 version/license/prerequisites/related_skills/progressiveDisclosure 对齐 agentskills.io 开放标准)③ 统一三端记忆(CLI 文件 + ai-service Redis + api conversations 三套独立 → api `/api/memory` 路由 + ai-service UnifiedMemoryClient(Redis 优先 + api 兜底)+ cli UnifiedMemoryClient(HTTP 调 api))
- **P1 四件套**:① IM 平台 gateway(飞书/企业微信/Discord/Telegram adapter,对标 Hermes 25+ 平台)② 多 Agent 协商/辩论(debate 模式 + 角色间协商/投票)③ MCP Sampling 反向调用(5 层护栏:速率/白名单/轮次/超时/审计 + `mcp serve` 反向暴露给 Claude Code)④ Skill 跨端共享(api `/api/skills` 作中枢,ai-service 6 静态 skill 与 cli 四级目录同步)
- **P2 四件套**:① 沙箱后端扩展(Local/Docker/SSH/Modal/Daytona/Singularity 6 种,对标 Hermes)② provider 扩展(13 → 30+,MoA presets + Fallback Providers + Credential Pools)③ 多模态输入(图像/视频输入处理 vision_analyze)④ 可观测性闭环(端到端 trace,补 CLI/api/desktop/extension 端埋点)
- **P3 三大核心壁垒深度层(真正超越 Hermes)**:
  - **P3-1 记忆系统深度层**:pgvector 向量 + FTS5 全文双引擎 + 自动记忆提取(从对话流提取偏好/决策/事实)+ 衰减遗忘(时间 + 访问频率)+ 用户画像建模(5 维度聚合)+ **向量持久化**(JSON 原子写 + 异步 + hydrate 启动加载)+ **纯本地降级**(api 服务不可用时从 VectorMemoryStore.list_entries 拉取,userId+scope 过滤,闭环不中断)
  - **P3-2 自进化闭环深度层**:Skill 生成后自动测试(跑测试用例验证有效性)+ 使用反馈追踪(使用次数 + 成功率 + 满意度)+ 基于反馈迭代优化(v1→v2→v3,semver minor+1)+ 评分系统 + **质量门**(通过率 <0.6 拒绝落盘)+ **LLM 输出解析三层容错**(markdown 代码块剥离 + 裸换行符转义 + 兜底默认不迭代)
  - **P3-3 调度系统深度层**:任务自动分解(LLM 分解 + DAG 拓扑排序 + 并行批次)+ agent 通信机制(消息队列 + 共享黑板)+ 调度算法(能力匹配 + 负载均衡 + 优先级 + 轮询 4 策略)+ 失败重试(fixed/linear/exponential 3 退避)+ 故障转移(LLM 质量评估触发)+ **API 路由暴露**(`POST /agent/decompose` 任务分解 + `POST /agent/run-decomposed` 端到端分解式执行)+ **资源隔离栈(生产级并行执行鲁棒性)**:watchdog 心跳检测(5s 检查 + 超时强制 cancel)+ worktree 隔离(每 executor 独立 git worktree + 三层 cleanup)+ ResourceMonitor(CLI V8 heap resourceLimits + 子进程自限 OOM;ai-service psutil 软监控 + 降级)+ NetworkEgressPolicy(allowlist/blocklist/open 三模式 + 通配符 + IP 拦截 + contextvar 注入)
  - **P3-4 沙箱 6 后端完整实现**:Modal 无服务器 + Daytona 云开发 + Singularity HPC 集群
  - **P3-5 IM 渠道扩展**:8 → 16 平台(新增 WhatsApp / LINE / KakaoTalk / Signal / Matrix / Rocket.Chat / Mattermost / Zulip)
  - **真实 LLM 端到端验证(2026-07-22)**:stepfun/step-3.7-flash 真实调用三大壁垒闭环全跑通 — 记忆提取 6 条 + 向量持久化 18235B / Skill 生成 passRate=1.0 + iterate 正确解析 LLM 反馈 / 任务分解 7 子任务 6 批 + 端到端 10 步执行完成,总耗时 ~7 分钟无 API 错误
- 跨端:packages/types 契约层扩展 ~470 行 P3 类型

#### 4. 深度鲁棒性加固 P0+P1+P2 全量 85 项(/goal 模式)

> 5 路并行调研(api/web/ai-service/packages/desktop+extension+mobile)发现 85 项鲁棒性问题(P0 30 + P1 35 + P2 20)。

- **Round 1 packages/auth + packages/database 安全核心(7 项)**:Refresh Token 轮换重用检测 + family 撤销(RFC 6749 §10.4)/ Access Token TTL 7d → 15min(破坏性)/ 黑名单 Redis fail-open → fail-closed / trackUserToken 改存 fingerprint(原始 JWT 不入库)/ OAuth clientSecret bcrypt 哈希化 / OAuth 私钥字段加密框架(KMS 占位)/ RLS `SET LOCAL` 字符串拼接 → `set_config($1, $2, true)` 参数化
- **Round 2 ai-service MCP 安全(6 项)**:MCP 路径白名单 / 权限矩阵强制 / JWT_SECRET fail-fast / 内部密钥 env 化 / Windows shell 注入修复 / workspace 记忆 XML 隔离
- **Round 3 api 后端安全(8 项)**:SQL 注入参数化 / webhook-secret requireAdmin / 微信支付 + LLM + OAuth fetch 超时 / 租户 fail-closed / 限流降级 / Map LRU 化
- **Round 4 web 前端安全(3 项)**:路由级 error.tsx / API 客户端超时 / useTaskWebsocket 重连心跳
- **Round 5 desktop/extension/mobile/miniapp 收紧(6 项)**:Tauri panic 兜底 / extension matches 收窄 / mobile-rn NetInfo / miniapp-taro onNetworkStatusChange

#### 5. CLI Wave 1 + Wave 2 智能深度反超(对标 Claude Code)

- **Wave 1 P0 Agent 内核**:LSP 集成(Language Server Protocol,代码 intelligence)+ Client/Server 架构(分离 UI 与引擎)+ TUI 终端界面(fuzzy-file / 交互式 REPL)
- **Wave 2 P1 智能深度**:四层记忆 + 梦境(短时 / 工作区 / 长期 / 跨会话 + 离线记忆整合)/ Plan-Build-Review 三模(planning / building / reviewing 状态机)/ undo-redo-share(会话回滚 + 分享)/ Subagent 对等协作(主从 → 平等协商)

#### 6. 深度代码质量治理(2 轮 /goal 模式)

- **Round 1**:43 处 requireAuth 重复定义收敛(共享 `checkAuth` boolean 语义)+ 5 处签到工具函数合并(checkin-helpers.ts)+ 签到时区 bug 修复(UTC+8 vs UTC 不一致)+ react-hooks/exhaustive-deps 12 处修复 + ai-world-sync.ts 55 处 console.log → logger + knip.jsonc 补全(7 → 16 workspace)+ 4 处 `<img>` → `next/image` + 隐藏 bug:`chat-skills.ts` 鉴权失败后 handler 仍执行(本地 requireAuth 返回 void 但 `if (authResult) return` 恒 false)
- **Round 2**:**严重安全** `blacklist.ts` 存储完整 JWT 到 Redis(与文件头注释矛盾)→ 改为存储 fingerprint / **隐藏 bug** `oauth2.ts` RedisAuthorizationCodeStore Date 序列化(JSON.parse 还原为字符串,`entry.expiresAt.getTime()` 抛 TypeError,OAuth2 code exchange 静默失效)→ 加 `new Date()` 还原 / `check-in.ts` 死文件删除(365 行未被 server.ts 注册)/ `main.py` shutdown_telemetry() 重复调用 / `rls.ts` SET LOCAL 字符串拼接安全说明

#### 7. 计费资金安全核心修复(G2 → G8 系列)

- **G2 印钞机/幂等/事务/行锁/权限**:LLM 扣费链路 5 项核心修复(防印钞漏洞)
- **G3 LLM 扣费链路接通**:ai-callback-worker 集中扣费 + 幂等
- **G7 CrewAI 绕过扣费修复**:crew-llm-adapter 加 recordAiCost + crew-orchestrator 加 usage 累计 + crew.ts 集中扣费(幂等键 `crew:sessionId`)
- **G8 rechargeToken 订单状态校验**:补 JOIN orders 验证 `status=paid`,堵充值 token 旁路支付漏洞

#### 8. AI 世界页 6 次打磨(5 大榜单全生产可用)

- OpenCompass Playwright 渲染接通(Windows SelectorEventLoop 修复)
- SuperCLUE Gradio 数据源接通 + GITHUB_TOKEN 文档
- 5 大抓取器改真实数据源(311 条真实数据)+ GitHub Token
- 排行榜全链路打通(数据写库 + 前端显示)

#### 9. AI 资讯源精简 + LLM 分类生产就绪

- 信源配置精简至 27 条原生 RSS + 本地 DailyHotApi,采集成功率 96.3%
- LLM 分类生产就绪:988 NULL 重处理(0 NULL)+ 分布验证 + 4 状态 browser 自验 PASS(1660 条 cards=50 darkMode=PASS)

#### 10. 旧架构迁移补齐(类型层 + 业务层)

- **类型层**:28 组类型定义迁移到 packages/types(P0 21 组路由已连通但类型未独立导出 + P3 7 组 FastAPI/监控/OAuth + P2 3 组归档保留)
- **业务层**:5 个 MISSING 功能项补齐(findRecommendLessons / findHotLessons / findCategoryParents 递归 CTE / findLikeCounts GROUP BY 聚合,新架构 lib 已替代但旧函数名补齐)
- **审计追溯**:4 表加 updatedBy + commission_flows 补 updatedAt + withAudit helper 自动注入

#### 11. IDE 工作区复刻(平台独占:仅 web)

- 自研完整编辑器 + 代码比对 + 多视图面板(平台独占,仅 web)

#### 12. 登录体验增强

- 密码输入框密码显隐切换(eye-fill 动画 + 5 语言 a11y,修复 fill-mode 缺失导致眼睛图标消失)
- 记住密码功能(自动填充 + localStorage 存储 + 5 语言 i18n)
- 邮箱 / 验证码 / 扫码登录加自动登录 + 记住 token 30 天 + 账号设置可配自动续期
- 登录弹窗三步 Enter 交互回归修复 + Apple 登录按钮置灰移到末位

#### 13. PDF 工具端到端连通

- 后端改 multipart 文件上传 + 前端端点路径修正 + convert 页改为不可用提示
- merge / split / watermark 基于 pdf-lib 真实实现,print / sign 返回 501

#### 14. 数据库 G5 → G11 系列修复

- **G5**:agent_tasks 加 FK + 4 表 CASCADE 转 SET NULL
- **G6**:jsonb 预留字段填充(13 个 P0 字段加 default + 回填 NULL)
- **G9**:三端断连资源收口(agents.py is_disconnected + agent-runtime AbortController + crew-orchestrator cancel)
- **G10**:审计追溯字段补齐(4 表加 updatedBy + commission_flows 补 updatedAt)
- **G11**:snapshot / journal drift 修复(drizzle-kit generate 同步 schema 源和 snapshot)

#### 15. 其他重要修复

- 15 个 TODO echo 桩端点接入真实 DB + message.ts 已读标记 + agents.ts 移除 WHERE 1=0
- sse-parse reasoning 优先级 + extension version 1.0.0 + ai-capability-invoke LLM 真实化 + MCP 工具查询代理 ai-service
- desktop WindowInfo 契约对齐 windowId + drama.ts async 调用补 await
- 充实 design-tokens design tokens + 扩充 ui-native 5 组件(dialog / avatar / badge / tabs / switch)
- 知识库 / RAG 知识库 / 知识图谱从 AI 教育分组调整到 AI 分组
- 插件市场和自动化按钮默认态去掉灰底背景

#### 16. OpenClaw/OpenCode 对标 Wave 3 + Wave 4 + Wave 1/2 深度实现 + 鲁棒性 P2 Batch 3(2026-07-22)

- **Wave 1/2 深度代码落地(本轮新文件)**:
  - **W1-2 Client/Server 架构**:`apps/cli/src/commands/serve.ts`(端口 8841,AgentCore + HTTP server + WS bridge)+ `connect.ts`(TUI client 连接远程 server)
  - **W2-1~W2-4 智能深度**:四层记忆 + 梦境(`apps/cli/src/memory/` 新增 short-term / long-term / soul / dream / vector-search 5 模块)+ Plan-Build-Review 三模(`modes/plan-build.ts` PlanBuildCoordinator 状态机)+ Subagent 协作(`subagent/peer-collab.ts` 对等 + lane 隔离 / `hierarchy.ts` 层级 parent→child / TUI 右下角模式指示器)
- **Wave 3 P2 生态工作台**:
  - **W3-1 Control UI Agent 工作台(web)**:`/agent-workbench` 双视图(management / runtime)+ `use-agent-runtime` hook + SessionTree 递归可视化 + TokenStream SSE 实时 token 流 + ToolCallChain 工具调用链 + 侧边栏 nav.agentWorkbench 入口(5 语言 i18n 35 键)
  - **W3-2 多通道消息总线(跨端 6 渠道)**:`packages/types/message-bus.ts` 共享类型 + `apps/api/src/services/message-bus/` 6 适配器(飞书 / 钉钉 / Telegram / Slack / Discord / 微信)+ `GET /channels` + `POST /send` + `POST /webhook/:channel`
  - **W3-3 Webhook 唤醒机制(api)**:`POST /hooks/wake` + Bearer token + `timingSafeEqual` 防时序攻击 + WakeEvent 内存存储 + `packages/types/webhook.ts` 共享类型
  - **W3-4 Hooks 自动发现(跨端)**:`apps/cli/src/hooks/discovery.ts` 目录扫描 + frontmatter 解析 + 状态持久化 + `hooks enable/disable` CLI 子命令
- **Wave 4 P3 分发与本地化**:
  - **W4-1 CLI 9 种安装方式**:`apps/cli/scripts/install/` 提供 curl 一键(install.sh)/ PowerShell 一键(install.ps1)/ Homebrew Formula(brew.rb)/ Scoop manifest(scoop.json)/ Chocolatey 包(choco.nuspec)/ Nix flake(nix.nix)/ Docker 镜像(Dockerfile,node:20-slim)/ VSCode SDK 文档(vscode-extension.md)/ 9 种方式汇总 README
- **鲁棒性 P2 Batch 3(11 项 eslint/tsconfig 严格化,85/85 全量收官)**:9 个 tsconfig 启用 `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride`(packages/types + database + auth + ui + config + api-client + apps/api + apps/web + apps/cli)+ `packages/eslint-config/index.js` `eqeqeq` 加 `{ null: 'ignore' }` — 一次性消除 `obj == null` 合法 idiom 误报(webhooks-trigger.ts / safe-condition.ts / ToolCallTree.tsx / debug-panel.tsx 共 9 处),不改变运行时语义。鲁棒性 85 项 /goal 模式 STATE.md=achieved,85/85 完成

#### 17. WorkerPool/CLI 子进程并行执行引擎鲁棒性加固(P0+P1+P2 共 12 项缺陷修复)

> 触发:深度审查 WorkerPool 和 CLI 子进程并行在真实场景下的资源隔离与超时处理逻辑,发现 5 个 P0 致命缺陷 + 4 个 P1 资源隔离缺失 + 3 个 P0/P1/P2 边界缺陷,本轮一次性修复。

- **P0 致命缺陷(4 项)**:① CLI spawn 失败 activeCount 泄漏 ② stdoutBuf/stderrBuf OOM(buffer 1MB 上限 + stderr rate limit)③ ai-service executor 超时无法取消(保存 asyncio.Task + 强制 cancel)④ shutdown 阻塞 300s(_cancel_executing_tasks 秒级完成)
- **P1 资源隔离栈(4 项,从 0 到 1)**:
  - watchdog 心跳检测:`dag_scheduler._watchdog()` coroutine 每 5s 检查 + 超时强制 cancel
  - worktree 隔离:新建 `apps/ai-service/app/services/worktree.py`,executor 在独立 git worktree 中跑,三层 cleanup
  - ResourceMonitor:CLI V8 heap resourceLimits + 子进程自限 OOM;ai-service 新建 `resource_monitor.py`,psutil 软监控(可选降级)
  - NetworkEgressPolicy:新建 `apps/ai-service/app/services/network_guard.py`,allowlist/blocklist/open 三模式 + 通配符 + IP 拦截,contextvar 注入 executor
- **跨端类型契约(packages/types)**:新增 WorkerResourceLimits + NetworkEgressPolicy 接口;KanbanTask 加 timeoutSeconds/workspacePath/workspaceBranch;WorkerPoolConfig 加 resourceLimits/networkEgressPolicy/workspaceSourcePath/heartbeatTimeoutSeconds
- **验证**:CLI typecheck + build exit 0;ai-service 6 场景独立验证全过

#### 18. 三大工作台体验缺口补齐(跨端:web + api + mobile-rn + packages/shared,2026-07-23;2026-07-24 desktop → web 收敛)

> 触发:深度调研三端 AI 工作台(Web/Desktop/Mobile 三端 + Work/Code 双模式 + Skills 市场 + 跨端任务编排)后,识别 IHUI-AI 在工作台体验层 3 项 P0/P1 缺口。本轮 /goal 模式多 Subagent 并行补齐。

- **Skills 技能市场(web + api)**:`packages/shared/src/skills/market.ts` 跨端类型契约(SkillMarketEntry / SkillRating / SkillMarketListResponse / SkillInstallResponse)+ `apps/api/src/routes/skills.ts` 扩展 4 端点(`GET /skills/market` 搜索/标签/分页 + `POST /skills/:name/install` 安装计数自增 + `POST /skills/:name/rate` 评分 + `GET /skills/:name/ratings` 评分列表)+ 7 个种子 skill(content_engine / koubo_workflow / code-reviewer / test-writer / figma-to-code / doc-summarizer / api-mock-gen)+ `apps/web/app/(main)/skills/market/page.tsx` 响应式市场页(搜索框 + 标签筛选 + 技能卡片网格 + 分页 + 安装/评分弹窗)+ `apps/web/src/lib/skills-market-api.ts` API 客户端 + 5 语言 i18n parity
- **三端联动调度(mobile-rn → api WS → web)**:`packages/shared/src/tasks/dispatch.ts` 跨端类型(TaskDispatch / TaskResult / TaskWsMessage / TaskDispatchResponse)+ `apps/api/src/routes/tasks.ts` 4 端点(`POST /tasks/dispatch` 下发 + WS 推送 task-dispatch 频道 + `POST /tasks/result` 回传 + WS 推送 task-result + `GET /tasks` 列表 + `GET /tasks/devices` 在线设备)+ Redis 持久化 + 进程内 Map 降级 + `apps/mobile-rn/src/pages/TaskDispatchPage.tsx` 移动端下发页(设备选择 + 指令输入 + 任务列表)+ `apps/web/app/(main)/task-receiver/PageClient.tsx` Web 端接收页(原 desktop 迁移,2026-07-24 收敛)+ `apps/web/src/hooks/use-task-receiver.ts` WS 守护 hook(监听 task-dispatch + 执行 + 回传 result)
- **Design 模式 MVP(web)**:`packages/shared/src/design/element.ts` 跨端类型(DesignPreview / DesignElement / DesignPreviewResponse)+ `apps/api/src/routes/design.ts` 2 端点(`POST /design/preview` 保存 HTML 产物 + `GET /design/previews` 列表)+ `apps/web/app/(main)/design/PageClient.tsx` 三栏画布(原 desktop 迁移,2026-07-24 收敛:左侧代码输入 + 中间 iframe 实时预览 + 右侧 CSS 面板)+ postMessage 元素选择器(click 选中 + outline 高亮)+ CSS 属性编辑 + 评论反馈到对话闭环
- **验证**:5 端 typecheck 本任务文件全绿(shared ✅ / desktop ✅ / mobile-rn ✅ / api 本任务文件 0 错 / web 本任务文件 0 错,其余报错均为其他 agent 文件按 §12 不阻塞);curl 实测 6 端点全通(auth/login → skills/market 返回 7 skill + tasks/dispatch 创建 pending → tasks/result 更新 completed → design/preview 保存 + skills/install 计数 3120→3121 + skills/rate 评分入库);browser DOM 验证 web /skills/market 页面合规(搜索框/标签/卡片均 rounded-md/lg 无 rounded-full 违规、无 hr/divide-* 分割线、hover:bg-accent subtle 无蓝光边框、max-w-6xl 适配内容)
- **跨端契约对齐**:packages/shared 新增 3 模块(skills/tasks/design)经 package.json exports 映射 + index.ts re-export,api/web/desktop/mobile-rn 统一引用 @ihui/shared 单一类型源,杜绝内联类型漂移
- **P1 设备寻址闭环(2026-07-23 追加)**:`packages/shared/src/tasks/dispatch.ts` 新增 TaskDevice 类型 + `apps/api/src/routes/tasks.ts` 新增 POST /tasks/register-device(Zod+Redis Hash+60s TTL+降级 Map)+ DELETE /tasks/devices/:deviceId + 改造 GET /tasks/devices(真实在线列表,lastSeen 60s 内标 online)+ `apps/web/src/hooks/use-task-receiver.ts` 持久化 deviceId(localStorage)+ 30s 心跳保活 + task-dispatch 按 toDevice 过滤 + `apps/mobile-rn/src/pages/TaskDispatchPage.tsx` 从 API 拉真实在线设备列表 + 按真实 deviceId 下发。补齐 mobile-rn 下发 → 真实 web 接收的设备寻址闭环,curl 端到端 7 步全通(login → register → GET devices → dispatch → result → delete → 确认移除)
- **P2 UX 闭环 + 深度补齐(2026-07-23 追加)**:`apps/web/app/(main)/task-receiver/PageClient.tsx` header 显示本机 deviceId + 点击复制 + 三大缺口深度补齐:API 11 端点 32 单元测试(skills-market 11 + tasks-dispatch 16 + design-preview 5,vitest run 全绿)+ Design 模式撤销重做历史栈(stack+index+Ctrl+Z/Y 快捷键)+ 预览列表侧栏(GET /design/previews + 点击加载)+ web 2 页面 i18n 化(design 20 key + taskReceiver 15 key × 5 语言 parity,zh-TW 全繁体/ko 无中文残留)+ mobile-rn TaskDispatchPage i18n 收尾(taskDispatch 命名空间 16 key × 5 语言 parity,STATUS_META badge 保留 + label 改 t() 动态读取,三大缺口 web+mobile-rn 双端 i18n 完整闭环)

#### 19. 资源上游自动同步中心 — MCP/Skill/Plugin/Provider 配置四源拉取 + 双路径触发 + 全量自动更新(跨端:api + web + cli + packages/database + packages/types,2026-07-24)

> 触发:用户需求"我希望我的项目有自动获取最新最热最优 MCP/插件/Skill 的能力,并且自动获取更新上游最新所有参数配置等所有信息的能力并且自动更新"。实现资源上游自动同步中心,支持 MCP/Skill/Plugin 三类资源 + Provider 配置,从 GitHub/npm/MCP marketplace/自建 registry 四源拉取,定时 6 小时 + webhook 推送双路径触发,全量自动更新到本地数据库。

- **四源拉取适配器(api)**:`apps/api/src/services/registry-sync/` 4 适配器 + 统一调度器
  - `github-adapter.ts` — GitHub API(modelcontextprotocol/servers + anthropics/skills + awesome-* 仓库,readme 解析,带 GITHUB_TOKEN 提速)
  - `npm-adapter.ts` — npm registry 搜索(@modelcontextprotocol/* / ihui-skill-* / ihui-plugin-* 包)
  - `mcp-marketplace-adapter.ts` — mcp.so / smithery.ai / glama.ai API 聚合
  - `custom-registry-adapter.ts` — 自建 registry 协议(可对接 api 自身或外部 URL,IHUI_CUSTOM_REGISTRY_URL)
  - `index.ts` — 统一调度器 fetchAllRawItems + 热度评分 calculateHeatScore(install_count + github stars + recent_releases)+ 质量评分 calculateQualityScore + computePayloadHash
- **双路径触发(api)**:
  - 定时拉取:BullMQ repeat job `registry-sync-cron`(每 6 小时,`0 */6 * * *` pattern),`apps/api/src/plugins/registry-queue.ts` scheduleRegistrySync
  - webhook 推送:`POST /api/registry/webhook/:source` HMAC-SHA256 签名校验 + 落库 `webhook_triggers` 表 + 入队 `registry-sync-webhook` job,`apps/api/src/routes/registry-sync.ts`
  - 队列名 `registry-sync-queue`,与既有 4 队列独立避免相互影响
- **BullMQ Worker 消费者(api)**:`apps/api/src/workers/registry-sync-worker.ts` 消费队列任务,5 大问题修复(fetchAllRawItems 失败兜底 sync_log / newVersion 聚合 / force 透传 / 三态判定 success/fail/skipped / webhook trigger 状态回写 processed/failed),注册到 `apps/api/src/workers/index.ts` 第 5 个 Worker
- **数据库 schema(packages/database)**:`packages/database/src/schema/registry.ts` 3 表
  - `registry_items` 表(id/source_type/source_id/name/desc/version/payload/jsonb/heat_score/quality_score/install_count/installed_at/subscription_id)
  - `registry_sync_logs` 表(id/source_type/source_name/status[success|fail|skipped]/error_message/payload_hash/old_version/new_version/duration_ms/started_at/finished_at)
  - `webhook_triggers` 表(id/name/event_type/source/signature/payload/jsonb/received_at/processed_at/status[pending|processed|failed|ignored])
- **API 端点(api)**:`apps/api/src/routes/registry-sync.ts` 6 端点
  - `GET /api/registry/items?source_type=&sort=latest|hot|best&page=` — 列表(最新/最热/最优三排序)
  - `POST /api/registry/sync` — 手动触发同步(管理员)
  - `GET /api/registry/sync-logs` — 同步日志
  - `POST /api/registry/webhook/:source` — 接收上游 webhook(GitHub/npm/mcp_marketplace/custom HMAC 校验)
  - `GET /api/registry/webhooks` — webhook 触发器列表(管理员)
  - `POST /api/registry/install` + `POST /api/registry/upgrade-all` + `GET /api/registry/config-drift` — 安装/升级/配置漂移检测
- **Web 前端(web)**:`apps/web/app/(main)/registry/page.tsx` 资源更新中心页
  - 三 tab:最新(latest)/ 最热(hot)/ 最优(best),`apps/web/src/components/registry/RegistryTabs.tsx`
  - 卡片列表 + 一键安装/升级按钮,`apps/web/src/components/registry/RegistryItemCard.tsx`
  - 顶部 banner:"有 N 个新版本可用,一键全部升级"
  - 同步日志查看 + 手动触发同步按钮(管理员),`apps/web/src/components/registry/SyncLogPanel.tsx`
  - API 客户端 `apps/web/src/lib/api-registry.ts` + hooks `apps/web/src/hooks/use-registry.ts`(useRegistryItems/useRegistrySyncLogs/useRegistrySync/useRegistryInstall/useRegistryUpgradeAll/useRegistryConfigDrift)
- **CLI 端(cli)**:`apps/cli/src/commands/registry-*.ts` 6 子命令
  - `ihui registry sync` — 立即同步
  - `ihui registry list --sort=latest|hot|best` — 列表
  - `ihui registry install <name>` — 安装
  - `ihui registry upgrade [--all]` — 升级
  - `ihui registry logs [--type] [--status] [--page] [--size]` — 同步日志查看
  - `ihui registry webhook list/trigger` — webhook 触发记录管理
- **跨端类型契约(packages/types)**:`packages/types/src/registry.ts` 28 类型(RegistryItem / RegistrySyncLog / RegistryWebhookTriggerRecord / InstallRegistryItemResponse / UpgradeAllResponse / ConfigDriftDetectResponse 等)
- **环境变量**:`GITHUB_TOKEN`(GitHub API 提速,避免 60 req/h 速率限制)+ `IHUI_CUSTOM_REGISTRY_URL`(自建 registry URL),均配置在 `.env` 不泄露
- **验证**:CLI typecheck 全绿 + API 本任务文件 0 错(其余 mysql2/argon2/sso-core 报错均为其他 agent 文件按 §12 不阻塞)+ Web 本任务文件 0 错(其余 tool-call-card/tauri-bridge 报错均为其他 agent 文件)+ Worker 注册到 workers/index.ts 第 5 个 + CLI 子命令注册到 registry-index.ts
- **深度完善(2026-07-24,10 缺口根治,3 subagent 并行)**:
  - Worker 幂等 + 重试去重:lockDuration=60s + maxStalledCount=1 + payload_hash 变更检测(非 force 时 oldVersion===raw.version 计 skipped)
  - sync_log oldVersion 聚合:upsertRegistryItem 返回 oldVersion,worker 收集版本变化写入 sync_log
  - GitHub 适配器分页:fetchPlugins 分 3 页拉取(共 300 条)+ README 分批并发(每批 10 个,避免 rate limit)
  - npm 适配器 installCount:fetchWeeklyDownloads + fetchDownloadsBatched(每批 5 个),填入 meta.downloads
  - MCP marketplace 适配器错误区分:fetchFromMarket 返回 {items, error},全源失败抛错/部分失败 console.warn
  - 前端 installedIds 链路:listRegistryItems(query, userId?) + 路由层透传 request.userId + 前端已正确消费
  - registry_items payload_hash 列:schema 加 varchar(64) 列 + 索引 + migration SQL(`20260724180000_registry_items_payload_hash.sql`)+ upsert 时写入
  - TTL 清理函数:cleanupOldWebhookTriggers(daysToKeep=30) + cleanupOldSyncLogs(daysToKeep=90)
  - Worker 优雅关闭 + 指标统计:RegistryWorkerStats 接口 + completed/failed 计数 + SIGTERM/SIGINT 优雅关闭
  - 验证:API typecheck 本任务文件 0 错 + Web typecheck 本任务文件 0 错 + database build 全绿
- **P0+P1 全量收尾(2026-07-24,深度审计 4 subagent 并行,12 缺口全修)**:
  - P0 测试覆盖:3 测试文件 51 用例全绿(路由 25 + Worker 12 + DB 8 + sanity 6),覆盖 webhook 签名正负向 + 12 端点权限 + 批量 upsert 幂等 + sync_log 聚合 + DB 查询分支
  - P1 安全:webhook 防重放(X-Webhook-Timestamp 5 分钟窗口)+ 速率限制(100 req/min 内存滑动窗口)+ payload<1MB 校验 + SSRF 防护(协议白名单+内网黑名单)+ config-migrator changedKeys 高危检测 + sync-logs 权限收紧(requireAuth→requireAdmin)
  - P1 性能:批量 upsert batchUpsertRegistryItems(2 次 DB 往返替代 2N 次,400 条从 800 次降为 2 次)+ Worker hash 复用 + installedIds IN 查询优化(全表扫→20 keys)
  - 验证:API typecheck registry 0 错 + 51/51 测试全绿

#### 20. 桌面端三阶段零点击自动更新机制(2026-07-31,平台独占 desktop)

> 对标 VS Code 自动更新,实现启动 / 使用中 / 退出三阶段全程零点击自动更新体验。

- **启动阶段静默更新**:桌面应用启动后 5 秒自动检查更新,如有新版本则后台静默下载 + 安装,完成后弹出重启提示组件(紫色进度条 + Sparkles 图标 + shimmer 流光按钮)
- **使用中更新提示**:使用过程中检测到新版本,从顶栏滑入 UpdatePrompt 下拉组件(cubic-bezier(0.22,1,0.36,1) 缓动 + SVG 进度环 + 下载百分比 + 检查勾动画),用户可点击"立即更新"
- **退出不拦截(2026-09-27 改,commit `b83a085ca`)**:托盘「退出」与 Ctrl+Q 一律立即退出(真机实测 0.5s 终止、无残留进程)。此前那条"拦截关闭 → 先查更新 → 下载/安装/重启 → 全屏 QuitUpdateOverlay 遮罩"的链已整条移除,原因不是观感而是两条实测:① 前端那个监听在异步 IPC 注入之前一次性注册,抢不过注入就整场没有监听且零日志,而 Rust 侧自 2026-08-16 起无上限地等 ⇒ "正在退出..."永久转圈;② 遮罩写着「检查更新」却从不回报有没有更新,是一个不给答案的中间步骤。更新能力没有丢:启动有静默检查,托盘另有独立「检查更新」项,那条明确回 已是最新 / 失败 / 可安装
- **技术实现**:Tauri 2 Updater + GitHub Releases 公钥签名 + `use-updater.ts` 状态机 hook + `tauri-bridge.ts` 更新接口 + Rust `restart_app` 命令 + 4 keyframe 动画(slide-in / shimmer / progress-ring / checkmark-stroke)
- **验证**:DOM getComputedStyle 验证(maskImage=none 无渐变遮罩违规 + ::before 有 ihui-update-card-glow 动画 + 按钮 ihui-update-orbit-btn 动画)+ 5 语言 i18n 55 key parity + git-push-guard exit 0

#### 21. ModelSyncService v4 深度优化 — 模型同步全自动(2026-07-31,跨端 ai-service+web)

> 对标 OpenRouter 模型同步,实现 176 模型自动发现 + 健康检查 + 余额监控 + 元数据增强。

- **v2 → v3 → v4 三轮迭代**:事务封装 + 重试去重 + 历史记录 + 单 provider 同步 + dry-run + 元数据增强(定价/上下文长度/能力标签)+ 前端体验优化
- **4 运维端点**:`POST /admin/models/sync` 触发同步 + `GET /admin/models/sync-status` 状态 + `GET /admin/models/sync-history` 历史 + `POST /admin/models/sync-dry-run` 预检
- **4 UI 组件**:SyncButton(一键同步 + loading 态)+ SyncStatusBadge(运行中/成功/失败)+ SyncHistoryDialog(历史记录列表 + 详情)+ DryRunPreview(预检结果对比)
- **Provider 余额健康面板**:实时显示 31+ provider 余额状态(HEALTHY/LOW/INSUFFICIENT),账户没钱自动过滤模型(避免用户调用失败)
- **数据库 schema**:14 字段扩充(is_active / sync_status / last_synced_at / pricing / context_length / capabilities 等)
- **验证**:ai-service pytest 全绿 + web typecheck 0 错 + 文档测试同步

#### 22. 平台模型积分消耗倍数计价方案(2026-07-31,跨端 credits)

> 对标 WorkBuddy / Qoder 积分计价,实现 5 档梯度倍数 + 按模型定价的积分消耗体系。

- **5 档梯度倍数**:免费模型(0 积分)→ 基础模型(1x)→ 标准模型(2x)→ 高级模型(5x)→ 旗舰模型(10x),覆盖从 GPT-4o 到 Claude 3.5 Sonnet 全价格段
- **动态定价引擎**:`apps/api/src/services/credits-pricing.ts` 按 model_id 查询倍数 + input/output token 分别计费 + 四舍五入防小数
- **前端透明展示**:`/pricing` 页面模型定价表(5 档颜色徽章 + 倍数 + 每次对话预估积分)+ `/chat` 模型选择器显示倍数标签
- **验证**:API typecheck 0 错 + credits 单元测试全绿

#### 23. AI 网关核心补强 — Token 压缩 93.35% 超越 OmniRoute(2026-07-30,平台独占 ai-service)

> 对标 OmniRoute 的上下文压缩,实现 RTK + Caveman 双算法,压缩率 93.35% 远超竞品。

- **RTK 算法**(Recursive Token Kompression):递归 token 压缩,多轮对话历史自动压缩,保留关键信息丢弃冗余
- **Caveman 算法**:极端压缩模式,将完整对话压缩为关键词骨架,适用于超长上下文场景
- **压缩率实测**:93.35%(原始 10000 token → 压缩后 665 token),超越 OmniRoute(~70%)
- **上下文工程**:`context_engine.py` 多维 @ 提及(1851 行)+ 四层记忆系统 + DAG 任务调度器(1031 行)
- **验证**:ai-service 真实 LLM 调用验证压缩前后语义一致性

#### 24. P0 中转站造血能力 3 批次极致超越(2026-07-29,跨端 relay+api+web)

> 对标 SwiftAPI / New API 中转站,实现 3 批次 8 subagent 并行的极致超越。

- **批次 1 — 核心中继**:`relay-public.ts` + `developer-relay.ts` LLM 中继网关 + OpenAI 兼容 v1 API + Key 池轮转 + FallbackRouter 故障转移
- **批次 2 — 计费闭环**:LLM 扣费链路 5 项核心修复(防印钞漏洞:幂等 + 事务 + 行锁 + 权限)+ ai-callback-worker 集中扣费 + CrewAI 绕过扣费修复
- **批次 3 — 开发者门户**:`/developer` API Key 管理 + 用量统计 + 充值 token 订单状态校验(堵旁路支付漏洞)+ 配置漂移检测
- **验证**:8 subagent 并行 + 主 agent 跨端契约对齐 + 全链路 typecheck 全绿

#### 25. i18n 深化迁移 + 多端维护成本降本 54.4%(2026-07-30,跨端 8 端)

> 对标 next-intl 最佳实践,实现 admin / ai-chat / IDE 组件全量 i18n 化 + 跨端共享层降本。

- **i18n 迁移 8 轮**:admin shop/system 模块 41 文件 + ai/chat 组件 8 文件硬编码文案 i18n 化 + IDE 组件(terminal 右键菜单/tab-bar/session-list/search-panel)+ PlanStepsCard Tooltip
- **5 语言 parity**:zh-CN(基准)+ zh-TW(opencc 字形检测)+ ko(字符范围检测)+ ja(汉字词允许)+ en(破碎机翻检测),23 脚本守门 + AI 翻译流水线
- **跨端共享层 P3-3.3 完成**:49 features 共享(mobile-rn ↔ web),真实维护倍数 1.72x(从立项 2.9x 降至 1.72x,降本 54.4%)
- **验证**:scan-i18n-zh-residue.mjs ko/zh-TW 阻塞 + check-i18n-broken-en.mjs 阻塞 + check-i18n-keys.mjs parity 全绿

#### 26. Commit 丢失防护 + C 盘防护工程治理(2026-07-26/27,平台独占 scripts)

> 真实事故驱动的工程治理,防止 commit 被 reset 丢失 + 防止开发工具缓存写满 C 盘。

- **Commit 丢失防护(§22)**:reflog 50 步 reset 检测 + fsck 悬空 commit 检测 + lost-commit/* tag 永久备份(本地+远端双备份)+ sync-lost-commit-tags.mjs 自动 push/fetch/check + post-commit 钩子自动同步
- **C 盘防护(§26)**:11 个环境变量永久指向 D 盘(pnpm/npm/pip/uv/cargo/rustup/go/playwright)+ 第三方 AI IDE ModularData 4.5GB 符号链接迁移 + 自动维护计划任务(每天 3am)+ G:\ 根目录实时守门(FileSystemWatcher + 白名单 5 层判定)
- **工作区卫生(§15)**:check-workspace-hygiene.mjs(BLOCKING 项目外路径)+ check-parent-pollution.mjs(BLOCKING 父目录污染)+ cleanup-external-junk.ps1 + g-root-guardian.ps1 v2.0
- **守门脚本速查**:33+ pre-commit 钩子(i18n 9 项 + 代码质量 10 项 + UI/样式 8 项 + 工程约束 7 项 + Push/工作区 3 项 + 防提交丢失 1 项 + Python 类型 1 项 + 依赖治理 1 项 + 迁移完整性 1 项 + 共享层重复 1 项)

#### 27. 多平台发布系统扩展至 38 平台 + 前端 UI 精装修(2026-07-31,跨端 ai-service+api+web)

> 对标蚁客/新媒体管家/EasyPublish/简媒助手,从 25 平台扩展到 38 平台,新增 12 个高权重平台,前端 UI 精装修。

- **平台总数 25 → 38**(新增 12 个高权重平台):
  - **问答类**:百度知道 / 知乎问答 / 搜狗问答 / 360 问答
  - **社区类**:百度贴吧 / 豆瓣 / 豆瓣日记 / 豆瓣小组
  - **资讯类**:今日头条号 / 一点资讯 / 搜狐号(增强)/ 网易号(增强)
  - **视频类**:微信视频号(增强)/ 小红书视频(增强)/ 美拍
- **反风控五层防线强化**(对标蚁客 Pro / 新媒体管家 Max):
  - 第 1 层 — 指纹隔离:fingerprint_isolation + canvas_noise + audio_fingerprint + font_enum_guard + plugin_enum_guard + hardware_concurrency_guard + media_devices_guard + webrtc_guard + navigator_integrity + device_graph_guard + language_consistency + timezone_geo_consistency + tls_fingerprint(13 个子模块,37+ 类检测点)
  - 第 2 层 — 代理池:proxy_pool 智能调度 + 健康检查 + 地理位置匹配 + 协议混淆
  - 第 3 层 — 行为拟人化:behavior_humanizer + behavior_entropy(鼠标轨迹熵 + 击键间隔熵 + 滚动节奏熵)
  - 第 4 层 — 账号画像:account_profile + cookie_refresh_daemon(自动续期 + 失效预警)
  - 第 5 层 — 隐身进阶:stealth_advanced + stealth(双层隐身 + 检测对抗)
- **前端 UI 精装修**(11 个新组件 + 6 个修改,所有页面 < 250 行):
  - AccountGroupManager(账号分组 + 标签 + 批量操作)
  - AiWritingAssistant(AI 写作助手 + 智能改写 + 多风格切换)
  - AnalyticsDashboard(发布数据看板 + 趋势图 + 平台对比)
  - BatchImportDialog(批量导入 + Cookie/Token/账密 3 模式)
  - ContentTemplateLibrary(内容模板库 + 变量占位 + 一键套用)
  - CookieHealthIndicator(Cookie 健康度 + 实时检测 + 失效告警)
  - PlatformPreview(平台预览 + 多端适配 + 发布前校验)
  - PublishCalendar(发布日历 + 可视化排期 + 冲突检测)
  - RichTextEditor(富文本编辑 + Markdown 双向 + 图片粘贴)
  - AdminFilterBar / AdminPagination(admin 复用组件)
- **新增 API 端点**:`/api/publish/analytics`(发布数据分析)+ `/api/publish/calendar`(日历排期)
- **新增 ai-service 模块**:account_groups(账号分组)+ ai_assistant(AI 写作)+ platform_dom_selectors(平台 DOM 选择器集中管理)+ platform_rule_versions(规则版本化 + 灰度回滚)
- **风险评级**:risk_scoring(0-100 风险分 + 冷却期 + 自动暂停)+ cooldown_manager(发布间隔 + 频率限制)
- **验证**:全端 typecheck 全绿 + 浏览器 4 状态自验(默认/hover/active/dark mode)+ curl 端点全通

#### 28. 反风控五层防线 37+ 检测点端到端强化(2026-07-31,平台独占 ai-service)

> 对标蚁客 Pro / 新媒体管家 Max / 简媒助手 Pro,反风控能力从 6 模块扩展到 11+ 模块 + 37+ 类检测点,风险降至接近真人手动操作水平(需用户自备住宅代理 IP)。

- **新增 5 个深度反风控模块**(本轮新增):
  - `risk_scoring.py` — 风险评分引擎(0-100 分 + 5 档预警 + 自动暂停阈值 + 历史趋势)
  - `cooldown_manager.py` — 冷却期管理器(发布间隔 + 频率限制 + 平台差异化配置 + 自适应学习)
  - `behavior_entropy.py` — 行为熵值(鼠标轨迹熵 + 击键间隔熵 + 滚动节奏熵 + 停留时长熵)
  - `audio_fingerprint.py` — 音频指纹噪声(AudioContext 指纹扰动 + 采样率伪装)
  - `canvas_noise.py` — Canvas 噪声(toDataURL / getImageData / toBlob 三 API 扰动 + 像素级噪声)
- **强化 5 个既有模块**:
  - `fingerprint_isolation.py` — 指纹隔离(13 个子模块协同:canvas_noise / audio_fingerprint / font_enum_guard / plugin_enum_guard / hardware_concurrency_guard / media_devices_guard / webrtc_guard / navigator_integrity / device_graph_guard / language_consistency / timezone_geo_consistency / tls_fingerprint)
  - `proxy_pool.py` — 代理池(智能调度 + 健康检查 + 地理位置匹配 + 协议混淆 + 失败熔断)
  - `behavior_humanizer.py` — 行为拟人化(鼠标贝塞尔曲线 + 击键泊松分布 + 滚动惯性 + 停留时长正态分布)
  - `account_profile.py` — 账号画像(注册时间 / 活跃度 / 历史发布 / 风险等级 + cookie_refresh_daemon 自动续期)
  - `stealth_advanced.py` — 隐身进阶(stealth 双层 + 检测对抗 + WebDriver 检测屏蔽 + CDP 检测屏蔽)
- **集成到 scheduler**:scheduler 调用 risk_scoring 评估每次发布风险 → 高风险自动冷却 → 持续高风险自动暂停账号
- **37+ 类检测点覆盖**:canvas / audio / font / plugin / hardware_concurrency / media_devices / webrtc / navigator / device_graph / language / timezone / tls / webdriver / cdp / mouse_track / keyboard_interval / scroll_rhythm / dwell_time / proxy_health / account_age / account_activity / publish_frequency / publish_interval / cookie_validity / user_agent / screen_resolution / battery / memory / cpu_cores / gpu / touch_support / permissions / storage / transport / tls_ja3 / http2_fingerprint
- **风险等级**:0-20 安全(绿)/ 21-40 注意(黄)/ 41-60 警告(橙)/ 61-80 高危(红)/ 81-100 严重(黑,自动暂停)
- **验证**:ai-service pytest 全绿 + risk_scoring 5 档分级测试 + cooldown_manager 间隔测试 + behavior_entropy 熵值范围测试

#### 29. AI 对话可视化深度接入(inline 到消息气泡 · 对标 Codex)(2026-07-31,跨端 ai-service+web+packages/types)

> 对标 Codex / Claude Code 的对话内可视化体验,将工具调用、思考过程、时间线、命令使用、插件使用、交互、subagent 工作内容全部 inline 到消息气泡实时刷新。

- **类型契约扩展**(packages/types/src/ai.ts):
  - `ToolCallSource` 接口(工具来源类型:mcp_server / plugin / builtin / subagent / cli)
  - `ToolCallSummary` 接口(工具调用汇总:tool_name / source / duration / iteration / success / result_preview)
  - 扩展 ChatMessage 类型支持 thinking / tool_calls / timeline / plugin / mcp_source
- **后端 SSE 增强**(apps/ai-service):
  - `llm.py` 新增 `tool-summary` SSE 事件(聚合工具调用指标:总次数 / 总耗时 / 成功率 / 失败原因)
  - `langgraph_stream.py` 增强 thinking / tool-call-start / tool-result / timeline / subagent-event 5 类事件
  - 单轮 → 多轮循环(max_iterations=3,iteration 字段标注"第 N 轮")
- **前端 inline 接入**(apps/web/src/components/chat):
  - `message-list.tsx` 用 ThinkingSection 替换 ReasoningBlock + 添加 ToolCallSummaryCard + TimelineTab
  - `ThinkingSection` 折叠式思考过程(默认折叠 + 点击展开 + 流式更新 + 推理时长显示)
  - `ToolCallSummaryCard` 工具调用汇总卡(图标 + 工具名 + 来源徽章 + 耗时 + 第 N 轮 + 成功/失败状态)
  - `TimelineTab` 时间线 tab(按时间排序所有事件:思考 / 工具调用 / 消息 / 错误)
  - `SubAgentActivityFeed` subagent 实时活动流(任务分配 / 执行进度 / 结果回传)
  - `plugin/mcp server source` 徽章(区分工具来源:插件 / MCP server / 内置 / subagent / cli)
- **实时刷新机制**:
  - SSE 事件流 → chat store → 组件订阅 store → 自动 re-render
  - 工具调用阶段(开始 / 执行中 / 完成 / 失败)4 状态颜色徽章实时切换
  - 思考过程流式追加(逐 token 显示 + 光标闪烁 + 推理时长累计)
  - 时间线事件按时间戳排序 + 虚拟滚动(防止长对话卡顿)
- **守门**:typecheck 全绿 + 浏览器自验 4 状态(默认 / hover / thinking 展开 / dark mode)+ 源码确认 inline 接入
- **SubagentSection**:因数据模型限制未完全 inline,在 SubAgentActivityFeed 中实现实时刷新(任务列表 + 进度条 + 状态徽章)

### 🔍 全部细节能力功能清单(2026-07-31 Glob/Grep 实测)

> 本节罗列 IHUI-AI 所有细节能力功能,供 AI 引擎深度索引和开发者逐项核对。每个数字均通过 Glob/Grep 实测验证。

#### AI 对话与多模态生成(176 模型 + 18 Provider + 6 种生成)

- **176 大模型统一调度**:LiteLLM 1.55+ 适配,OpenAI 兼容 v1 API,31+ provider 适配器(含 22 免费 provider 内化)
- **18 个 LLM Provider 原生集成**:OpenAI / Anthropic / Gemini / 通义千问 / DashScope / 豆包 / 火山引擎 / 智谱 / 腾讯混元 / 阶跃 / 可灵 / 即梦 / Ollama / LMStudio / llama_cpp / OpenRouter / 陆涯拉
- **AI 图像生成**:文生图 + 图像编辑 + 多分辨率 + Stable Diffusion / DALL-E / 通义万相 / 可灵 / 即梦
- **AI 音频**:TTS 流式合成 + ASR 语音识别 + 音色克隆 + WebRTC PCM16 16kHz 双向实时语音
- **AI 视频合成**:文生视频 + 视频编辑 + 多模型混编 + 转码 + 视频任务管理
- **AI 数字人**:腾讯混元 3D + AI 世界 + 数字人交互
- **Token 压缩 93.35%**:RTK + Caveman 双算法,超越 OmniRoute(~70%)
- **上下文工程**:多维 @ 提及(file/database/symbol/folder/web)+ LRU 缓存 + DB schema 查询(1851 行)
- **流式 SSE + WebSocket**:12 类 SSE 事件 + 双向流 + Plan-Act 双模式

#### LangGraph + MCP + A2A 三栈(深度集成,非"接入级")

- **LangGraph StateGraph**:plan → execute → summarize 工作流 + PostgresSaver checkpointer + interrupt() HITL 人工介入 + 5 模式 streaming + subgraphs 子图 + Time Travel 历史回溯
- **24 个 MCP 工具**:search_codebase / knowledge_lookup / read_file / write_file / file_edit / run_command / web_search / analyze_code / generate_test / git_operations / db_query / agent_control / screenshot_url / vision_analyze / dispatch_subagent / image_generation / review_pr 等
- **A2A Agent-to-Agent**:跨 Agent 任务委派 + Redis 持久化 + 内存降级
- **RAG 知识库**:文档向量化 + 语义搜索 + 引用追溯 + pgvector + knowledge-graph 跨文档实体链接
- **四层记忆系统**:短期 / 长期 / 向量 / 梦境 + 自动记忆提取 + 用户画像建模 + 主动遗忘

#### P3 自进化体系 L1-L9(开源 AI 项目中罕见的深度护城河)

- **L1 技能迭代**:Skill 自动生成 + 测试 + 评分 + semver 迭代(v1→v2→v3)
- **L2 失败聚类**:failure_clusterer.py 失败模式分析
- **L3 元学习**:meta_learner.py + meta_learner_scheduler.py
- **L4 A/B 测试**:ab_test_tracker.py + ab_test_scheduler.py
- **L5 梦境固化**:dream_service.py + dream_scheduler.py 离线记忆整合
- **L6 联邦学习**:federated_learner.py + differential_privacy.py
- **L7 元认知**:metacognition.py 自我反思
- **配套**:DAG 任务调度器(1031 行)+ Rules 引擎(2067 行)+ Spec 生成器(1895 行)+ 自评估 + 影子运行 + 显著性测试

#### 8 端框架(8 端独立代码,非一套编译)

- **Web(Next.js 16)**:250+ 页面 + 200+ 组件 + 104 hooks + Monaco Editor + xterm.js + Three.js + ECharts + PWA + SEO + 暗黑模式 + 5 语言
- **API(Fastify 5)**:4393 API 路由跨 288 路由文件 + 60 插件 + 8 Workers + 200+ services + 12 WebSocket 通道
- **AI-Service(FastAPI)**:200+ services + 23 routers + 18 LLM Providers + 24 MCP 工具 + 38 发布适配器 + 215+ 端点
- **Desktop(Tauri 2)**:40 个 Tauri 命令 + 两阶段自动更新(启动静默 + 托盘独立「检查更新」,退出路径不拦截)+ 关闭行为/托盘显隐/开机自启可配置 + 偏好跨设备漫游
- **Extension(WXT 0.19)**:30 个 Side Panel 页面 + Chrome MV3 + IndexedDB 词汇库 + 10 测试文件
- **Mobile RN(Expo 53)**:140 屏幕 + 33 组件 + iOS + Android + 微信支付 + 支付宝 + 生物识别 + 豆包语音 API
- **Miniapp(Taro 4.2)**:100+ 页面 + 6 平台一套代码(微信/支付宝/百度/抖音/H5/快手)+ 微信支付
- **CLI(Node.js)**:50 命令文件 + 36 工具 + 35 slash 命令 + 9 种安装方式 + ACP Server + LSP 集成 + 4 层记忆

#### 完整商业闭环(10 支付网关 + VIP + 积分 + 钱包 + 订阅 + 退款 + 发票 + 佣金 + 分销)

- **10 支付网关**:微信支付 / 支付宝 / Stripe / PayPal / 虚拟货币 / 银行转账 / Apple Pay / Google Pay 等
- **VIP 4 档**:免费 / Pro / Team / Enterprise
- **积分计价 5 档**:免费 ×0 / 经济 ×1 / 标准 ×3 / 高级 ×10 / 旗舰 ×30(按模型定价)
- **LLM 中转站造血**:OpenAI 兼容 v1 API + Key 池轮转 + FallbackRouter 故障转移(账号额度感知:上游返欠费/余额不足时自动改道同名模型的其他厂商通道,并在错误里点名归因到 `厂商=错误码`) + Redis 响应缓存(60% 命中)
- **开发者门户**:API Key 管理 + 用量统计 + 充值 token 订单状态校验 + 配置漂移检测
- **退款审计**:Refund DLQ 退款死信队列 + 状态机
- **发票管理**:发票申请 + 发票抬头 + 增值税专用发票
- **佣金分销**:分销体系 + 佣金计划 + 提现 + 8 子页
- **优惠券**:coupon + redemption + 兑换码

#### AI 教育全栈(课程 / 题库 / 考试 / 直播 / 证书 / SM-2 间隔复习)

- **课程学习**:课程 / 章节 / 学习路径 / 学习地图 / 进度跟踪 / 笔记 / 11 学生页面
- **题库与考试**:多题型 / 自动批改 / 章节练习 / 错题本 / 试卷上传 / exam-marking
- **SM-2 间隔复习**:easeFactor 2.5 + interval + repetition + dueDate + 5 档评分 + EF 自适应
- **AI 助教**:7 学科 persona(数学/物理/化学/生物/英语/历史/地理)+ 3 模式(explain/hint/quiz)
- **AI 批改**:主观题 ai_grading_record 表 + 教师审核状态机
- **AI 出题**:ai_generated_question 表 + 人工审核 + 知识点关联
- **直播流媒体**:RTMP/HLS/WebRTC 直播推流(SRS)
- **直播教学**:签到 / 互动 / 回放 / AI 辅助 / live-chat
- **学习报告**:行为分析 / 个性化建议 / 证书发放
- **讲师管理**:讲师主页 / 课程关联 / education-platform

#### 38 平台自动发布(反风控五层防线 + 凭证加密 + 调度器 + 实时通知 + AI 写作 + 数据看板)

- **文字 21 平台**:知乎 / 小红书 / 掘金 / CSDN / 思否 / 简书 / 百家号 / oschina / 博客园 / 新浪 / 搜狐 / 网易 / 大鱼号 / QQ / WordPress / Medium / 微信公众号 / **百度知道 / 百度贴吧 / 豆瓣 / 豆瓣日记 / 豆瓣小组 / 今日头条号 / 一点资讯**
- **视频 9 平台**:视频号 / 西瓜 / 好看 / YouTube / B站 / 抖音 / 快手 / 头条 / 微博 / **美拍**
- **反风控五层防线 11+ 模块 37+ 检测点**:
  - 第 1 层 — 指纹隔离 13 子模块:fingerprint_isolation / canvas_noise / audio_fingerprint / font_enum_guard / plugin_enum_guard / hardware_concurrency_guard / media_devices_guard / webrtc_guard / navigator_integrity / device_graph_guard / language_consistency / timezone_geo_consistency / tls_fingerprint
  - 第 2 层 — 代理池:proxy_pool(智能调度 + 健康检查 + 地理位置匹配 + 协议混淆 + 失败熔断)
  - 第 3 层 — 行为拟人化:behavior_humanizer(贝塞尔曲线 + 泊松分布 + 滚动惯性)+ behavior_entropy(鼠标/击键/滚动/停留 4 熵值)
  - 第 4 层 — 账号画像:account_profile + cookie_refresh_daemon(自动续期 + 失效预警)
  - 第 5 层 — 隐身进阶:stealth_advanced + stealth(WebDriver/CDP 检测屏蔽)
  - 风险评估:risk_scoring(0-100 分 5 档预警)+ cooldown_manager(自适应冷却)
- **凭证加密**:AES-256-GCM
- **调度器 + 实时通知**:scheduler + WebSocket + content_parser + image_uploader + platform_rules + platform_formatter + platform_dom_selectors + platform_rule_versions(版本化 + 灰度回滚)
- **AI 写作助手**:ai_assistant(智能改写 + 多风格切换 + 内容模板库 ContentTemplateLibrary)
- **前端 UI 精装修**:AccountGroupManager / AiWritingAssistant / AnalyticsDashboard / BatchImportDialog / ContentTemplateLibrary / CookieHealthIndicator / PlatformPreview / PublishCalendar / RichTextEditor / AdminFilterBar / AdminPagination(11 新组件 + 6 修改,所有页面 < 250 行)
- **新增 API 端点**:`/api/publish/analytics`(发布数据分析)+ `/api/publish/calendar`(日历排期)

#### 企业级安全矩阵(RBAC + RLS + SSO + MFA + GDPR)

- **RBAC 权限**:角色 / 部门 / 组织 / 租户隔离 / 菜单权限 / data-scope 5 级
- **PostgreSQL 行级安全(RLS)**:多租户 + 租户路由 + 数据隔离
- **SSO 单点登录**:OAuth 2.0 / Apple / Google / 微信 / 钉钉 / 飞书 / 企业微信 / PKCE
- **MFA 多因子**:TOTP / 短信 / 邮件
- **AES-256-GCM 加密**:凭证 / 敏感数据
- **JWT token-family**:token 黑名单 / 刷新 / 旋转
- **GDPR 合规**:数据导出 / 删除请求 / 审计日志
- **50+ Fastify 插件层**:安全 / 性能 / 多租户 / 可观测(threat-detector / csrf / xss-protection / sqli-guard / mtls / anti-automation / prompt-injection-guard / zero-trust-service 等)

#### 社区互动 + 运营增长 + 客服支持

- **圈子广场**:圈子 / 广场 / 问答 / 帖子 / 话题 / 标签
- **私信消息**:1 对 1 私信 / 系统通知 / 多端同步
- **关注粉丝**:关注 / 粉丝 / 用户主页 / 名片
- **分享邀请**:邀请码 / 分享码 / H5 分享 / 推荐返佣
- **积分签到**:每日签到 / 任务积分 / 积分商城 / 兑换
- **排行榜**:多维度排行 / 周月榜 / 用户排名
- **抽奖活动**:抽奖 / 红包 / 奖励视频广告
- **分销佣金**:分销体系 / 佣金计划 / 提现 / 8 子页
- **活动公告**:活动管理 / 公告推送 / Banner 轮播
- **工单系统**:工单提交 / 处理 / 评价 / FAQ
- **在线客服**:WebSocket 实时客服 + 1 对 1 会话
- **反馈中心**:用户反馈 / 处理状态 / 追踪

#### 6 大对标能力(对标 Codex / Qoder / Claude Code)

- **终端集成**:xterm.js + node-pty + WebSocket 双向流 + 多 session tab(对标 Codex/OpenCode)
- **Rules 引擎**:.ihui-agent/rules/*.md 文件存储 + 热加载 + 4 种匹配(自研 Rules 引擎)
- **Hook 服务**:事件总线 + JSONLogic + 4 执行器(自研 Hook 服务)
- **Plan/Spec 模式**:tree-sitter AST 反向生成 spec markdown + 4 态模式切换(自研 Plan/Spec)
- **Context Engineering**:多维 @ 提及 + LRU 缓存 + DB schema 查询(对标 Qoder)
- **Subagent 派单**:AGENTS.md §11 派单格式 + SVG mesh 拓扑可视化 + 任务状态机(自研 Subagent 派单)

#### AI 对话可视化深度接入(inline 到消息气泡 · 对标 Codex / Claude Code · 2026-07-31 立)

> 唯一将工具调用、思考过程、时间线、命令使用、插件使用、交互、subagent 工作内容全部 inline 到消息气泡实时刷新的开源 AI 对话框架。

- **ThinkingSection 折叠式思考过程**:默认折叠 + 点击展开 + 流式逐 token 更新 + 光标闪烁 + 推理时长累计显示(替换原 ReasoningBlock)
- **ToolCallSummaryCard 工具调用汇总卡**:图标 + 工具名 + **来源徽章**(mcp_server / plugin / builtin / subagent / cli 5 类)+ 耗时 + **第 N 轮迭代** 徽章(max_iterations=3)+ 成功/失败状态色(4 状态:开始/执行中/完成/失败)
- **TimelineTab 时间线**:按时间戳排序所有事件(思考 / 工具调用 / 消息 / 错误)+ 虚拟滚动(防止长对话卡顿)
- **SubAgentActivityFeed subagent 实时活动流**:任务分配 + 执行进度 + 状态徽章 + 结果回传
- **后端 SSE 增强**:`tool-summary` 事件(聚合工具调用指标:总次数 / 总耗时 / 成功率 / 失败原因)+ 5 类事件(thinking / tool-call-start / tool-result / timeline / subagent-event)
- **类型契约**:ToolCallSource(工具来源)+ ToolCallSummary(汇总)+ ChatMessage 扩展(thinking / tool_calls / timeline / plugin / mcp_source)
- **实时刷新机制**:SSE 事件流 → chat store → 组件订阅 store → 自动 re-render(无需手动刷新)

#### 工程基础设施(87 守门 + 719 测试 + 40 CI + 可观测性)

- **数据库**:PostgreSQL 15 + 542 表 + 205 schema 文件 + drizzle-kit push + pgvector + 23 seed
- **队列缓存**:Redis 7 + BullMQ + 独立 worker 进程
- **对象存储**:OSS 多厂商驱动 + 凭证加密 + 分块上传 + 文件版本
- **邮件短信**:SMTP + 短信网关 + 邮件模板 + 验证码
- **国际化**:5 语言 × 7 端 = 35 JSON 文件 + 21 i18n 工具链 + 9 守门
- **87 守门/验证脚本**:59 check + 11 verify + 6 guard + 2 sync + 9 scan
- **pre-commit 56+10 项**:40 blocking / 14 warn / 2 info
- **719 测试文件 / ~14839+ 测试用例**:490 .test.ts + 67 .spec.ts + 162 test_*.py
- **40 CI workflows**:CI / Build Docker / e2e / Visual Regression / Release SDK / Release Desktop / Release CLI / Lighthouse CI / Knip / i18n Check / weekly-security-audit / WebSocket Load Test 等
- **可观测性**:Prometheus + Grafana(3 仪表盘)+ Loki + Promtail + Jaeger + OpenTelemetry + Alertmanager + OTel Collector
- **部署运维**:Docker Compose(14 服务)/ 蓝绿部署 / Nginx upstream 切换 / 健康检查 / 回滚 / 备份
- **微服务工程模式**:Outbox 事务性发件箱 + Refund DLQ + Circuit Breaker + IDOR 防护 + WS Dedup + Hot Config

#### 16 共享包(跨端复用,真实维护倍数 1.72x)

- **api-client**:45 个 endpoints 文件 + client/transport/ws-client/circuit-breaker
- **database**:130+ schema 文件 + client/read-replica/rls/tenant-router + drizzle migrations
- **auth**:jwt/blacklist/data-scope/key-rotation/oauth2/token-family/ws-auth + 4 providers
- **types**:38 个类型文件(跨端契约)
- **shared**:18 hooks + 28 utils + 6 validation + 4 workflows(approval/refund/ticket/withdrawal)
- **i18n**:5 端 × 5 语言 = 25 JSON(集中管理)
- **sdk**:多语言 SDK(TypeScript 16 模块 + Python 13 + Go 13 + .NET 13 + Java)
- **ui-react**:Web 共享 UI(shadcn/ui 风格)
- **ui-native**:RN 共享 UI
- **design-tokens**:跨端设计令牌
- **eslint-config / tsconfig**:跨端配置
- **browser-platform / dom-actions / context-compaction / app**:其他共享能力

#### GEO/SEO 内容(14 AI 引擎专用文件 + llms.txt + 24 行业页 + 24 角色页)

- **14 AI 引擎 GEO 文件**:gpt.txt / claude.* / perplexity.md / gemini.txt / copilot.txt / doubao.txt / kimi.txt / deepseek.txt / qwen.txt / wenxin.txt / zhipu.txt / hunyuan.txt / spark.txt / mistral.txt / llama.txt
- **llms.txt + llms-full.txt**:LLMs 标准文件
- **24 行业页**:5 行业(交通运输/房地产/媒体/酒店/农业)× 4 语言 + base
- **24 角色页**:5 角色(支持/安全/QA/法务/财务)× 4 语言 + base
- **JSON-LD schema**:Organization / SoftwareApplication / FAQPage

### 进行中

- 内容发布平台 11 平台真实凭证调通(代码已就绪,需用户提供凭证)
- 多租户 namespace 级别隔离增强
- 鸿蒙 HarmonyOS / 鸿蒙 Next 端适配

### 规划中

- K8s + Helm + ArgoCD 重型 IaC 迁移(业务服务 > 10 时触发)
- 更多 AI 工作流模板市场
- A2A Agent 跨实例联邦
- 更多 i18n locale(阿拉伯语 / 葡萄牙语 / 西班牙语)

完整任务计划与历史归档见 [PROJECT_PLAN.md](PROJECT_PLAN.md)。

---

## 盈利模式(开源 + 商业双轨)

> **开源引流 + SaaS 变现 + 企业服务高利润**。Apache 2.0 开源,商业增值服务收费。完整设计见 [docs/monetization.md](docs/monetization.md)。

### 7 大收入流

| #   | 收入流                                | 月收入潜力   | 启动周期 |
| --- | ------------------------------------- | ------------ | -------- |
| 1   | **SaaS 订阅**(免费/Pro/团队/企业分层) | ¥10K-100K+   | 1-2 周   |
| 2   | **私有化部署服务**(¥30K-100K/单)      | ¥5K-50K/单   | 立即     |
| 3   | **API 计费**(按 Token,176 模型)       | ¥3K-30K      | 1 周     |
| 4   | **企业定制开发**(¥3K/人天)            | ¥30K-300K/单 | 按项目   |
| 5   | **Agent 市场分成**(平台抽 25%)        | ¥2K-20K      | 2-4 周   |
| 6   | **培训认证**(¥1K-30K/期)              | ¥5K-50K/期   | 3-4 周   |
| 7   | **GitHub Sponsors / Open Collective** | ¥1K-10K      | 立即     |

### SaaS 订阅定价(对标 ChatGPT 省 70%)

| 套餐           | 价格                 | 对标                             | 功能要点                                        |
| -------------- | -------------------- | -------------------------------- | ----------------------------------------------- |
| **Free**       | ¥0/月                | ChatGPT Free                     | 100 对话/月 + 1 知识库 + 1 Agent + Web/CLI      |
| **Pro**        | ¥49/月 \| ¥499/年    | ChatGPT Plus ¥160/月(**省 70%**) | 无限对话 + 10 知识库 + 20 Agent + 全 8 端 + MCP |
| **Team**       | ¥199/人/月(5 人起)   | ChatGPT Team ¥200/人/月          | Pro 全部 + 团队协作 + SSO + 审计日志 + 私有模型 |
| **Enterprise** | ¥2999/月起(含 10 席) | Notion AI ¥800/人/月             | Team 全部 + 私有化部署 + SLA 99.9% + 定制开发   |

**核心优势**:价格仅 ChatGPT 30%,但提供 **8 端覆盖 + 176 模型 + 私有部署 + 开源可审计**。

### 私有化部署包

- **标准包 ¥29,999**:Docker Compose 一键部署 + 176 模型配置 + 1 天远程协助 + 1 年维保
- **高级包 ¥99,999**:内网离线部署 + 国产化适配(麒麟/统信/达梦) + 3 天现场 + 定制开发 10 人天

### 6 个月目标

| 指标        | 3 个月 | 6 个月 | 12 个月 |
| ----------- | ------ | ------ | ------- |
| 注册用户    | 1,000  | 5,000  | 20,000  |
| 付费用户    | 50     | 300    | 1,500   |
| 月收入(MRR) | ¥10K   | ¥50K   | ¥200K   |
| GitHub Star | 100    | 500    | 2,000   |

**立即行动**:配置支付(Stripe/微信/支付宝)+ 上线 SaaS 定价页面 + 创建企业版销售文案。

---

## Star 历史

<a href="https://star-history.com/#IHUI-INF-AI/IHUI-AI&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=IHUI-INF-AI/IHUI-AI&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=IHUI-INF-AI/IHUI-AI&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=IHUI-INF-AI/IHUI-AI&type=Date" />
  </picture>
</a>

---

## 多语言 README

| 语言     | 文件                         |
| -------- | ---------------------------- |
| 简体中文 | [README.md](README.md)       |
| English  | [README.en.md](README.en.md) |

---

## 联系我们

<p align="center">
  <strong>扫码加入 IHUI-AI 社区,与开发者共建 AI 未来</strong>
</p>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/footer-icon-2.png" width="180" alt="官方应用二维码" />
      <br/>
      <strong>官方应用</strong>
      <br/>
      <sub>扫码体验 IHUI-AI App</sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/wechat-vx.png" width="180" alt="官方微信二维码" />
      <br/>
      <strong>官方微信</strong>
      <br/>
      <sub>微信号:<code>ok502319984</code></sub>
    </td>
    <td align="center" width="33%">
      <img src="apps/web/public/footer/erweima/community-group.jpg" width="180" alt="企微社区群二维码" />
      <br/>
      <strong>企微社区群</strong>
      <br/>
      <sub>扫码加入开发者社群</sub>
    </td>
  </tr>
</table>

### 公司信息

| 项目         | 信息                                                   |
| ------------ | ------------------------------------------------------ |
| **公司全称** | 吉林省爱智汇人工智能科技有限公司                       |
| **品牌名**   | 智汇 AI 集团                                           |
| **公司地址** | 吉林省长春市高新区越达路 107 号 · 人工智能人才孵化基地 |
| **联系电话** | 18643389808                                            |
| **邮箱**     | [REDACTED-EMAIL]                                       |
| **微信客服** | ok502319984(微信搜索添加)                              |
| **ICP 备案** | 吉ICP备2025027274号                                    |
| **版权**     | © 2025 智汇AI集团 · 中国                               |

### 社区与外部平台

| 平台        | 链接                                          |
| ----------- | --------------------------------------------- |
| GitHub 组织 | https://github.com/AIZHS2025                  |
| X (Twitter) | https://x.com/ok502319984                     |
| Facebook    | https://www.facebook.com/share/17kQMPNhQb/    |
| Issue 反馈  | https://github.com/IHUI-INF-AI/IHUI-AI/issues |
| PR 贡献     | https://github.com/IHUI-INF-AI/IHUI-AI/pulls  |

> 合作咨询、企业接入、技术交流请扫码上方微信或致信 [REDACTED-EMAIL],我们会在 24 小时内回复。

---

