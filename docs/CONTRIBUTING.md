# 贡献指南(Contributing Guide)

感谢你考虑为 IHUI-AI 贡献代码!本文件描述参与开发的环境搭建、代码规范、提交规范、
PR 流程与分支策略。请在动手前完整阅读本文档。

IHUI-AI 是 TS Monorepo(pnpm workspace + Turborepo),包含 `apps/api`、`apps/web`、
`apps/ai-service` 等多个子包,任何变更必须遵守下述规范。

---

## 1. 开发环境设置

### 1.1 系统要求

| 工具 | 版本 |
|---|---|
| Node.js | `>=20.10.0`(LTS 20.x,`nvm use` 切换) |
| pnpm | `>=9.0.0`(项目固定 `pnpm@9.15.0`,见根 `package.json` 的 `packageManager`) |
| Python | `3.12+`(仅 `apps/ai-service`) |
| PostgreSQL | `15+`(compose 用 `postgres:15-alpine`) |
| Redis | `7+`(compose 用 `redis:7-alpine`) |
| Docker | `24+` + Compose v2 |
| Git | `2.40+`,`core.autocrlf=false`(项目强制 `endOfLine: lf`) |

### 1.2 安装 / 启动数据库 / 迁移 / 开发

```bash
# 安装
git clone <repo-url> IHUI-AI && cd IHUI-AI
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install                                          # workspace 联动

# 启动数据库(推荐 docker-compose,或本地已装则连 .env 配置)
docker compose up -d db redis

# 迁移 + 校验 + 种子(drizzle-kit migrate / check / seed)
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:check
pnpm --filter @ihui/database seed                     # 7 步模式化 + 容错隔离

# 一键启动所有 apps(turbo 并行)
pnpm dev
# 单独启动:pnpm --filter @ihui/api run dev   或   pnpm --filter @ihui/web run dev
# AI 服务:cd apps/ai-service && uv sync && uvicorn app.main:app --reload --port 8000
```

---

## 2. 代码规范

### 2.1 TypeScript

- **strict 模式**:所有子包 `tsconfig.json` 继承 `packages/tsconfig/base.json`,开启
  `strict: true` / `noUncheckedIndexedAccess` / `noImplicitOverride`。
- **禁止 `any`**:确需绕过类型时用 `unknown` + 类型守卫,并在 PR 描述说明原因。
- **禁止 `// @ts-ignore`**:如确需,用 `// @ts-expect-error <原因>`。
- **类型导入**:纯类型用 `import type { Foo } from '...'`。
- **构建检查**:`pnpm typecheck`(等价 `node scripts/typecheck-full.mjs`,全包扫描)。

### 2.2 ESLint

- 共享配置在 `packages/eslint-config/`,各子包 `eslint.config.js` 继承。
- **禁止 `console.log`**:生产代码用 `request.log.info` / `request.log.warn` /
  `request.log.error`(Fastify pino 上下文)或 `apps/web/src/lib/logger.ts`。
- **禁止 `!important`**:CSS / Tailwind 中不允许,样式必须靠优先级与组合解决。
  守门脚本 `scripts/check-rounded-full.mjs` 会做相关检查。
- **强制无障碍**:Web 包启用 `eslint-plugin-jsx-a11y`,新增可交互元素必须有
  `aria-label` 或语义化标签。
- **lint 命令**:
  ```bash
  pnpm lint
  pnpm lint:strict   # --max-warnings 0,CI 严格模式
  ```

### 2.3 Prettier

配置见 `.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```bash
pnpm format         # 全量格式化
pnpm format:check  # CI 校验,只读
```

### 2.4 注释要求(中文)

- **代码注释用中文**:文件头、复杂逻辑、业务约束必须用中文注释,解释 "为什么" 而非
  "做什么"。
- **JSDoc / TSDoc**:对外导出的函数、类、接口用 TSDoc,中文描述 + `@param` / `@returns`。
- **TODO 标记**:用 `// TODO(<名字>): <描述>`,禁止裸 `// TODO`。
- **文件头**:新文件顶部加 1-3 行模块说明,如 `apps/api/src/services/security-service.ts`
  顶部 `/** 安全服务(风控/异常检测/IP 信誉/输入校验)。 */`。

### 2.5 命名约定

| 类型 | 约定 | 示例 |
|---|---|---|
| 文件 | `kebab-case.ts` / `kebab-case.tsx` | `crew-orchestrator.ts` |
| 类型 / 接口 | `PascalCase` | `CrewSession`、`RateLimitResult` |
| 函数 / 变量 | `camelCase` | `isIpBlacklisted`、`createSession` |
| 常量 | `UPPER_SNAKE_CASE` | `SECURITY_HEADERS`、`MAX_HISTORY` |
| React 组件 | `PascalCase.tsx` | `Sidebar.tsx` |
| 数据库表 / 列 | `snake_case` | `user_sessions`、`created_at` |
| 环境变量 | `UPPER_SNAKE_CASE` | `DATABASE_URL`、`JWT_SECRET` |

---

## 3. 提交规范(Conventional Commits)

强制使用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/),
由 `scripts/check-agents.mjs` 与 GitHub Actions 在 Push 阶段校验。

### 3.1 格式

```
<type>(<scope>): <subject>

<body?>

<footer?>
```

### 3.2 类型(type)

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更(README / CHANGELOG / docs/*) |
| `chore` | 构建、CI、依赖、脚本等非业务变更 |
| `refactor` | 重构(不改变外部行为) |
| `test` | 测试新增 / 修复 |
| `perf` | 性能优化 |
| `style` | 格式化(空白、分号等,不影响代码逻辑) |
| `ci` | CI 配置变更 |
| `build` | 构建系统或外部依赖变更 |

### 3.3 作用域(scope)示例

参考最近提交:`api`、`web`、`ai`、`database`、`seed`、`wechat-pay`、`agents`、
`scripts`、`p1` / `p2`(阶段代号)、`web/sidebar` / `web/marketing`(更细的子模块)。

### 3.4 示例

```
feat(api+ai+web): Crew executor 工具调用系统 (function calling + 6 工具 + RAG 充实 + 端到端测试通过)
fix(web/sidebar): '我的学习' 二级菜单提示线重设计 — 全宽破折线 + 激活态实线 + 无障碍呼吸动画
docs(agents): 第 18 节 Push 阶段跨 Agent 改动保护规则(强制,2026-07-18 立)
chore(scripts): AGENTS.md 第 18 节守门脚本 - 跨 Agent 改动保护
perf(web): code-generator 主题切换性能优化(同 markdown-stream 方案)
```

---

## 4. 分支策略

| 分支 | 用途 | 命名 |
|---|---|---|
| `main` | 生产分支,始终保持可发布状态 | 固定 |
| `develop` | 集成分支,功能合入此处后再择机 release 到 `main` | 固定 |
| `feature/*` | 功能开发 | `feature/crew-executor`、`feature/knowledge-rag` |
| `fix/*` | Bug 修复 | `fix/sidebar-hydration`、`fix/learn-queries-last-study-at` |
| `release/*` | 发布前冻结与版本号管理 | `release/0.2.0` |
| `hotfix/*` | 生产紧急修复(直接基于 `main`) | `hotfix/wechat-pay-cert` |

### 4.1 分支命名规则

- 小写、连字符分隔、英文 + 数字,禁止下划线与中文;优先使用 `goal/<任务简述>` 命名(见 `AGENTS.md` 第 9 节);分支名应让人 3 秒内猜到内容。

### 4.2 跨 Agent 改动保护

`AGENTS.md` 第 18 节规定的 "Push 阶段跨 Agent 改动保护" 强制规则:

- `scripts/check-agents.mjs` 在 pre-push 钩子中校验,改动跨 Agent 边界时需显式声明。
- 详见 `server-docs/PRE_COMMIT_GUIDE.md`。

---

## 5. PR 流程

### 5.1 完整流程

```
1. fork → git clone your-fork
2. git checkout -b feature/<your-feature>
3. 编码 + 本地校验(见 5.2)
4. git commit(遵守 Conventional Commits)
5. git push origin feature/<your-feature>
6. GitHub 上发起 PR 到 develop(或 main,仅 hotfix)
7. CI 通过 + 至少 1 名 Reviewer 批准
8. Squash & Merge 到目标分支
9. 删除 feature 分支
```

### 5.2 本地校验(Push 前必跑)

```bash
# 全量校验(typecheck + lint + test)
pnpm turbo typecheck lint test

# 严格 lint(0 warnings)
pnpm lint:strict

# 项目自定义守门脚本
pnpm check:all
# 等价于:
#   pnpm check:api-key-leak
#   pnpm check:i18n-keys
#   pnpm check:stale-dist
#   pnpm check:db-schema-drift
#   pnpm check:sanitizer-bypass
#   pnpm check:api-routes:warn
#   pnpm check:safe-parse

# E2E 测试(可选,提交前本地跑关键 spec)
pnpm --filter @ihui/web test:e2e
```

### 5.3 PR 标题与描述

- **标题**:同 commit message(`<type>(<scope>): <subject>`)。
- **描述模板**:
  - 改动摘要(3-5 行)
  - 关联 Issue(如 `Closes #123`)
  - 测试方式(命令 / 步骤)
  - 是否影响 DB schema(若是,附 `packages/database/drizzle/*.sql` 迁移文件)
  - 是否影响环境变量(若是,同步更新 `.env.production.example`)

### 5.4 Merge 准入条件(硬性)

下列条件 **必须全部满足** 才允许 merge(`typecheck` + `lint` + `test` 全绿):

| 条件 | 命令 | 备注 |
|---|---|---|
| 类型检查全绿 | `pnpm typecheck` | 等价 `scripts/typecheck-full.mjs` |
| Lint 严格模式全绿 | `pnpm lint:strict` | `--max-warnings 0` |
| 单元测试全绿 | `pnpm test` | Vitest(后端) / pytest(AI 服务) |
| E2E 全绿(若改 web) | `pnpm test:e2e` | Playwright |
| API Key 泄漏扫描 | `pnpm check:api-key-leak` | 禁止真实 key 入库 |
| i18n key 校验(若改 web) | `pnpm check:i18n-keys` | 5 种语言对齐 |
| DB schema 漂移检查(若改 db) | `pnpm check:db-schema-drift` | - |
| 安全解析检查 | `pnpm check:safe-parse` | 禁止 `JSON.parse` 裸调 |
| Format 检查 | `pnpm format:check` | - |
| 至少 1 名 Reviewer 批准 | - | 维护者审核,关注规范 / 边界 case / 性能 / 安全 / 测试覆盖 |

---

## 6. 测试要求

### 6.1 测试栈 / 约定

| 层 | 框架 | 配置 |
|---|---|---|
| 后端 API | Vitest 2 | `apps/api/vitest.config.ts` |
| 前端 Web | Vitest 2 + Playwright | `apps/web/vitest.config.ts`、`playwright.config.ts` |
| AI 服务 | pytest | `apps/ai-service/pyproject.toml` |
| 共享包 | Vitest 2 | 各包根 `vitest.config.ts` |

- **新增功能必须有单元测试**:行覆盖率 ≥ 70%,关键路径 ≥ 90%。
- **位置**:与被测文件同目录,`*.test.ts` 后缀;命名 `describe('模块名')` + `it('应该 <行为>')`(中文)。
- **真实 DB 测试**:`apps/api/vitest.real.config.ts`(用 `setup-real-db.ts`),需本地 PostgreSQL,默认 CI 不跑。
- **E2E**:`apps/web/e2e/*.spec.ts`,Playwright,需先 `pnpm --filter @ihui/web run build` 再启动 server。

### 6.2 跑测试

```bash
pnpm test                                              # 全量
pnpm --filter @ihui/api test                          # 单包
pnpm --filter @ihui/api test -- --watch               # 监听模式
pnpm test:e2e                                         # E2E
cd apps/ai-service && pytest                          # AI 服务
```

---

## 7. CI / Git Hooks / 沟通

- **CI(GitHub Actions)**:所有 PR 跑 `build.yml` / `ci.yml`(构建 + 类型检查 + lint + test);改 `apps/web/**` 触发 `e2e.yml` / `style-spec.yml`;改 `apps/web/messages/**` 触发 `i18n-check.yml`;所有 PR 跑 `knip.yml`(死代码扫描,配置 `knip.jsonc`)。CI 失败不允许 merge。
- **Git Hooks(`.husky/`)**:`pre-commit` 跑 `lint-staged`(eslint --fix + prettier --write);`pre-push` 跑 `scripts/check-agents.mjs`(跨 Agent 保护)+ 守门脚本;`post-merge` / `post-checkout` 提示依赖变更。跳过钩子(`--no-verify`)**禁止**,确需时由维护者授权。
- **沟通**:Issue 反馈 Bug / Discussion 讨论复杂设计;行为准则友善、尊重、对事不对人;维护者承诺 5 个工作日内回复 Issue 与 PR。

---

## 8. 常见问题(速查)

- `pnpm install` peer 警告:`pnpm.peerDependencyRules.ignoreMissing` 已忽略 `@opentelemetry/api`;其他请修复依赖版本而非静默忽略。
- 改 schema 后:`pnpm --filter @ihui/database db:generate` → `db:check` → `db:migrate`,迁移文件入 `packages/database/drizzle/`。
- AI 服务:`cd apps/ai-service && uv sync` 或 `pip install -e .`;LLM key 缺失时降级 stub。
- 提交漏改文件:`git commit --amend`(未 push)或追加 `fix:`;**禁止** `git push --force`。
