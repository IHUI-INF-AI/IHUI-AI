# 贡献指南 · Contributing to IHUI-AI

> 🌟 感谢你愿意为 IHUI-AI 投入时间!这是一个全栈 AI 操作系统,目标是用一套代码同时驱动 8 个端(Web / API / AI Service / CLI / Desktop / Extension / Mobile / Miniapp),并把 176 个 LLM 通过 LangGraph + MCP + A2A 统一编排。每一份贡献——哪怕只是修一个错别字、补一条翻译——都会让这个目标更近一步。

本指南适用于所有贡献者:首次提交 PR 的新手、长期维护者、文档翻译志愿者、Bug 报告者。请先完整阅读本文件,再开始动手。

---

## 📜 行为准则(Code of Conduct)

参与本项目的每一位贡献者都必须遵守 [Code of Conduct](CODE_OF_CONDUCT.md)。请在所有项目空间(Issues / PR / Discussions / 邮件 / 社交媒体提及本项目时)保持友善、包容、专业。如遇违规行为,请发邮件至 `conduct@aizhs.top` 举报,维护者会在 48 小时内响应。

---

## 🚀 快速开始(Getting Started)

### 环境要求

| 工具       | 最低版本 | 备注                                       |
| ---------- | -------- | ------------------------------------------ |
| Node.js    | 20 LTS   | 推荐 22 LTS                                |
| pnpm       | 9.x      | 包管理器(强制,不接受 npm/yarn)             |
| Python     | 3.11     | 仅 `apps/ai-service` 需要                  |
| PostgreSQL | 15       | 生产必需;开发可用 SQLite 替代              |
| Redis      | 7        | 可选(队列/缓存)                            |
| Git        | 2.40+    | 启用 `core.autocrlf=false`(避免 CRLF 污染) |

### Fork & Clone

```bash
# 1. 在 GitHub 上点击 Fork 按钮
# 2. Clone 你 fork 的仓库
git clone https://github.com/<你的用户名>/IHUI-AI.git
cd IHUI-AI

# 3. 添加上游(用于同步主仓库更新)
git remote add upstream https://github.com/IHUI-INF-AI/IHUI-AI.git
git fetch upstream
```

### 安装依赖

```bash
# 启用 pnpm(若未安装)
npm install -g pnpm@9

# 安装全部 workspace 依赖
pnpm install

# 初始化 git hooks(pre-commit / commit-msg / post-commit 等守门钩子)
pnpm prepare
```

### 启动开发服务器

```bash
# 一键启动 web + api + ai-service 全链路
pnpm dev

# 或单独启动某一端
pnpm --filter @ihui/web dev        # 前端:  http://localhost:8801
pnpm --filter @ihui/api dev        # 后端:  http://localhost:8802
pnpm --filter @ihui/ai-service dev # AI 服务: http://localhost:8803
```

端口注册表见 [`docs/port-management.md`](docs/port-management.md)。首次启动若数据库未初始化,参考 [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) 的 "Database Setup" 段。

---

## 🛠️ 开发工作流(Development Workflow)

### 1. 同步主分支

每次开始新工作前,先把 main 拉到最新:

```bash
git checkout main
git fetch upstream
git merge --ff-only upstream/main
```

### 2. 创建分支

分支名必须用 conventional 前缀 + 短描述(kebab-case):

| 前缀        | 用途           | 示例                           |
| ----------- | -------------- | ------------------------------ |
| `feat/`     | 新功能         | `feat/mobile-offline-cache`    |
| `fix/`      | Bug 修复       | `fix/auth-token-refresh-race`  |
| `docs/`     | 文档           | `docs/ja-translation-pass`     |
| `chore/`    | 构建/依赖/工具 | `chore/upgrade-next-15-2`      |
| `test/`     | 测试           | `test/e2e-payment-flow`        |
| `refactor/` | 重构(不改契约) | `refactor/extract-rls-helpers` |

```bash
git checkout -b feat/your-feature
```

### 3. 编码

参考下一节 "Coding Standards"。修改 UI 时务必读 [`AGENTS.md`](AGENTS.md) 第 4 节(前端约束)——项目有 30+ 守门钩子,违反会被 pre-commit 阻塞。

### 4. 提交(Conventional Commits)

```bash
git add <相关文件>          # ⚠️ 禁止 git add .(多会话保护规则)
git commit -m "feat(web): add dark mode toggle in user menu"
```

提交格式:`<type>(<scope>): <subject>`

- **type**:`feat` / `fix` / `docs` / `chore` / `test` / `refactor` / `perf` / `ci`
- **scope**(可选):`web` / `api` / `ai-service` / `cli` / `desktop` / `extension` / `mobile-rn` / `miniapp-taro` / `packages/*` / `docs` / `scripts`
- **subject**:祈使句,首字母小写,不超过 72 字符

详细的提交丢失防护与多 agent 协作规则见 [`AGENTS.md`](AGENTS.md) §12 / §16 / §20 / §22。

### 5. 推送 + 创建 PR

```bash
git push -u origin feat/your-feature
```

打开 GitHub 上的 Compare & PR 页面,按 PR 模板(见下文 "Submitting Changes")填写。

---

## 🏗️ 项目结构(Project Structure)

IHUI-AI 是 pnpm workspace + Turborepo 的 TypeScript Monorepo,8 端 + 8 共享包:

```
IHUI-AI/
├── apps/                          # 8 个端
│   ├── web/                       # Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
│   ├── api/                       # Fastify 5 + Drizzle ORM 0.38 + PostgreSQL
│   ├── ai-service/                # FastAPI + LangGraph + LiteLLM + MCP
│   ├── cli/                       # Node.js TUI(终端 AI Agent)
│   ├── desktop/                   # Tauri(Windows/macOS/Linux)
│   ├── extension/                 # WXT(Chromium/Firefox)
│   ├── mobile-rn/                 # React Native + Expo
│   └── miniapp-taro/              # Taro 4(微信/支付宝小程序)
│
├── packages/                      # 共享包
│   ├── database/                  # Drizzle schema + RLS 策略
│   ├── auth/                      # JWT / OAuth2 / WS 鉴权
│   ├── types/                     # 跨端 TypeScript 类型
│   ├── i18n/                      # 5 语言加载器
│   ├── sdk/                       # TS / Python / Go / Java / .NET SDK
│   ├── app/                       # 应用配置共享
│   ├── shared/                    # 通用工具
│   └── tsconfig/                  # 共享 tsconfig
│
├── scripts/                       # 守门脚本 + 工具链(30+ pre-commit 钩子)
├── docs/                          # 文档(architecture / api / exposure / user)
├── deploy/                        # Docker / Nginx / Homebrew / Scoop / Snap / Winget
├── sdks/                          # 独立 SDK 仓库(TS / Python / Go / Java)
└── AGENTS.md                      # Agent 协作强制规则(必读)
```

### 默认全端连通

项目遵循 "默认 8 端同步开发" 原则([`AGENTS.md`](AGENTS.md) §9):每一个任务默认跨 8 端同步,共享 `packages/types` + `packages/database` + `packages/i18n` 保证契约一致。仅在 "平台独占"(如 desktop 系统托盘、extension 上下文菜单、miniapp-taro 微信支付)时允许单端开发,且必须在 PR 描述中显式标注。

---

## 🎯 编码标准(Coding Standards)

### TypeScript(全端通用)

- **strict mode**:`tsconfig.base.json` 已开启 `strict: true`,任何 `any` 都需要 `// eslint-disable-next-line` + 注释理由
- **类型共享**:跨端类型必须放 `packages/types/src/`,禁止在 `apps/*` 内重复定义
- **Zod 校验**:所有 API 请求参数用 Zod schema 校验,禁止裸 `req.body as UserInput`
- **typecheck 全绿**:PR 合并前 `pnpm typecheck` 必须 exit 0

### React(Web / Mobile / Miniapp)

- 函数组件 + Hooks,禁止 class component
- 复用 `packages/ui-react` 的 Card / Button / Input / Dialog
- 每个页面 ≤ 250 行;超过请拆 hook 或子组件
- 时间用 `Intl.DateTimeFormat`(支持 5 语言);头像用 initials(无外部请求)
- **禁止蓝色发光 hover 边框**;hover 用 subtle 颜色变化
- **禁止 `rounded-full` / 胶囊容器**(头像 / 红点 / Switch 拇指豁免)
- 详细约束见 [`AGENTS.md`](AGENTS.md) §4 + [`docs/UI_GUIDELINES.md`](docs/UI_GUIDELINES.md)

### Python(ai-service)

- 类型注解必须(`mypy --strict` 阻塞)
- 用 `Pydantic v2` 校验输入
- 用 `black` + `isort` 格式化(line-length=100)
- 遵循 PEP 8
- 异步优先(`async def` + `asyncpg` / `httpx`)

### UI 设计系统

- 基于 **Tailwind 4** + **shadcn/ui**
- 颜色 token 见 [`apps/web/app/globals.css`](apps/web/app/globals.css) 的 `:root` / `.dark`
- 状态徽章:draft 灰 / published 绿;积分正数绿色,负数红色
- 中文字体 + 图标垂直对齐:用 `<CenteredText>` 组件(见 `apps/web/src/components/common/CenteredText.tsx`),禁止 `-mt-px` hack

### i18n(5 语言 parity)

支持语言:简体中文(zh-CN,基准)/ English(en)/ 日本語(ja)/ 한국어(ko)/ 繁體中文(zh-TW)。

- 所有用户可见文本必须走 `t('namespace.key')`,禁止硬编码
- 新增 key 必须先改 `zh-CN.json`,再跑 AI 翻译流水线(`scripts/i18n-diff.mjs` → `i18n-apply.mjs`)
- 5 语言 key 集合必须完全一致(`scripts/check-i18n-keys.mjs` 阻塞)
- 禁止简体字残留 zh-TW(`scripts/scan-i18n-zh-residue.mjs` 阻塞)
- 详见 [`docs/I18N.md`](docs/I18N.md) + [`AGENTS.md`](AGENTS.md) §19

---

## 🧪 测试(Testing)

### 测试金字塔

| 层级        | 命令                                   | 工具                     | 覆盖范围                    |
| ----------- | -------------------------------------- | ------------------------ | --------------------------- |
| 单元测试    | `pnpm test`                            | Vitest                   | 工具函数 / hooks / services |
| 类型检查    | `pnpm typecheck`                       | tsc --noEmit             | 全 monorepo 类型安全        |
| Lint        | `pnpm lint`                            | ESLint 9 + eslint-config | 代码风格                    |
| E2E(Web)    | `pnpm --filter @ihui/web e2e`          | Playwright               | 关键用户流程                |
| 集成(API)   | `pnpm --filter @ihui/api test`         | Vitest + supertest       | 路由契约                    |
| Python 测试 | `pnpm --filter @ihui/ai-service test`  | pytest                   | ai-service                  |
| 全量验证    | `pnpm turbo build typecheck lint test` | Turborepo                | 全部必须全绿                |

### 编写测试

- 单元测试文件:`*.test.ts`(与源码同目录或 `__tests__/`)
- E2E 测试:`apps/web/e2e/*.spec.ts`
- 测试目录规则见 [`AGENTS.md`](AGENTS.md) §23(避免 `__tests__/` 被 `.gitignore` 吞掉)

---

## 📨 提交变更(Submitting Changes)

### PR 清单

创建 PR 前,请逐项确认:

- [ ] 分支名用 conventional 前缀(`feat/` / `fix/` / `docs/` / ...)
- [ ] Commit message 遵循 Conventional Commits
- [ ] `pnpm typecheck` 全绿
- [ ] `pnpm lint` 全绿
- [ ] `pnpm test` 全绿
- [ ] UI 改动附 4 状态截图(默认 / hover / active / dark mode),并读 DOM 数值验证([`AGENTS.md`](AGENTS.md) §17)
- [ ] 新功能已在 [PROJECT_PLAN.md](PROJECT_PLAN.md) 登记(若未登记,先开 Issue 讨论范围)
- [ ] 跨端改动已同步所有受影响的端(§9)
- [ ] i18n 改动已跑翻译流水线(§19)
- [ ] README 同步更新(若改了对外能力,§21)

### PR 模板

```markdown
## 改动描述

<!-- 一句话说明这个 PR 做了什么 -->

## 改动类型

- [ ] feat(新功能)
- [ ] fix(Bug 修复)
- [ ] docs(文档)
- [ ] refactor(重构)
- [ ] test(测试)
- [ ] chore(构建/工具)

## 关联 Issue

Closes #<issue-number>

## 测试方式

<!-- 你如何验证这个改动有效?命令 / 截图 / 视频 -->

## 自检清单

- [ ] typecheck 全绿
- [ ] lint 全绿
- [ ] test 全绿
- [ ] UI 改动已附截图(若适用)
- [ ] 跨端同步(若适用)

## 截图 / 视频

<!-- UI 改动必填:default / hover / active / dark mode 4 状态 -->

## 破坏性变更

- [ ] 本 PR 不含破坏性变更
- [ ] 本 PR 含破坏性变更(已说明迁移路径)
```

### Review 流程

1. **CI 必须全绿**:GitHub Actions 跑 `build / typecheck / lint / test / e2e`,任意一项红色 PR 不会被 review
2. **至少 1 位 maintainer approval**:新功能 / 破坏性变更需要 2 位 approval
3. **CI 绿 + approval 后,maintainer 会 squash-merge** 到 main
4. **合并后你的名字会自动出现在 README 致谢区**(见下文 Recognition)

### Review 标准

- **正确性**:逻辑是否正确?边界条件是否处理?
- **可读性**:命名是否清晰?是否需要注释?
- **契约一致性**:是否破坏 API / 类型 / DB schema 契约?
- **跨端一致性**:是否所有受影响的端都同步了?
- **测试覆盖**:关键路径是否有测试?
- **守门规则**:是否违反 [`AGENTS.md`](AGENTS.md) 中的强制规则?

---

## 🌍 急需贡献的领域(Areas Needing Contributions)

### 1. 文档翻译(5 语言)

- 把 `docs/*.md` 翻译到 en / ja / ko / zh-TW
- 校对现有翻译的技术准确性
- 改进 `README.en.md` / `README.ja.md` / `README.ko.md` 的表述
- 参考 [`scripts/brand-glossary.json`](scripts/brand-glossary.json) 中的术语映射

### 2. 测试补全

- 提升 `apps/api` 测试覆盖率(当前 60+ 测试文件,但仍有未覆盖路由)
- 补充 `apps/web` 的 Playwright E2E(支付流程 / 多租户切换 / AI Agent 编辑器)
- 给 `packages/sdk` 各语言 SDK 补充集成测试

### 3. 新端开发

- **Desktop(Tauri)**:目前是空壳,需要实现系统托盘 / 全局快捷键 / 离线模式
- **Extension(WXT)**:需要实现上下文菜单 / 侧边栏 / 页面 AI 助手
- **Mobile(React Native)**:需要实现离线缓存 / 推送通知 / 生物认证
- **Miniapp(Taro)**:需要实现微信登录 / 支付 / 分享

### 4. AI Agent 模板

- 在 `apps/ai-service/app/agents/` 下新增垂直行业 Agent(法律 / 医疗 / 教育 / 金融)
- 改进 LangGraph 编排模式(ReAct / Plan-and-Execute / Reflexion)
- 添加 MCP 服务器集成(浏览器自动化 / 文件系统 / 数据库查询)

### 5. 性能优化

- 数据库查询优化(340+ 表,需要索引审计)
- 前端 bundle 体积分析(目标:首屏 JS ≤ 200KB)
- AI Service 流式响应延迟优化

### 6. 守门脚本

- 提升现有 30+ 守门脚本的检测精度
- 新增守门规则(参考 [`docs/GATEKEEPERS.md`](docs/GATEKEEPERS.md))

---

## 🏆 贡献者致谢(Recognition)

- 你的 GitHub 头像和用户名会出现在 `README.md` 的 "🙏 致谢" 章节
- 首个被合并 PR 的外部贡献者会写入 "我们的故事" 段落
- 活跃贡献者(≥5 个 merged PR)可加入核心团队,获得仓库 write 权限
- 年度突出贡献者会在每年 1 月的 Release Notes 中专文致谢

---

## 💬 社区(Community)

- [GitHub Discussions](https://github.com/IHUI-INF-AI/IHUI-AI/discussions) — 技术讨论 / Q&A / Ideas
- [GitHub Issues](https://github.com/IHUI-INF-AI/IHUI-AI/issues) — Bug 报告 / 功能建议
- 邮箱:`community@aizhs.top`(社区)/ `security@aizhs.top`(安全,见 [SECURITY.md](SECURITY.md))

---

## 📄 License

贡献的代码将在 [Apache License 2.0](LICENSE) 下发布。提交 PR 即表示你同意该协议。

---

**每一个 PR 都让这个项目更近一步。再次感谢你的贡献!** 🙏
