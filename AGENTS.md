# AGENTS.md — IHUI-AI 项目 Agent 指南

> 本文件的作用域为整个 `G:\IHUI-AI` 仓库根目录及所有子目录。

---

## 1. 任务计划文档规则(强制)

### 唯一计划文档

项目**唯一**的任务计划文档是 `PROJECT_PLAN.md`(仓库根目录)。

### 必须遵守

- 所有任务计划、进度更新、待办清单、状态变更**只写** `PROJECT_PLAN.md`。
- **不得**在 `.trae/`、`.trae-cn/`、`docs/`、根目录或其他任何位置新建计划/TODO/ROADMAP 文件。
- `.trae/documents/` 和 `.trae-cn/` 下的文件为**历史草稿,只读**,不再更新。
- 完成任务后,在 `PROJECT_PLAN.md` 对应条目把 `[ ]` 改为 `[x]` 并追加 `✅(日期)`。
- 新增任务追加到 `PROJECT_PLAN.md` 对应优先级(P0/P1/P2)末尾。
- commit message 用 `docs(plan): 更新 PROJECT_PLAN — <简述>`。

### 禁止事项

- 不创建新的 TODO/PLAN/ROADMAP 文件。
- 不在 commit message 里写长篇计划。
- 不把计划散落到代码注释。

---

## 2. 项目概览

IHUI-AI 是全栈 AI 平台,采用 TS Monorepo(pnpm workspace + Turborepo):

- **后端 API**: `apps/api`(Fastify 5 + Drizzle ORM 0.38 + PostgreSQL)
- **前端 Web**: `apps/web`(Next.js 15 + React 19 + Tailwind 4 + shadcn/ui)
- **AI 服务**: `apps/ai-service`(FastAPI + LangGraph + LiteLLM + MCP)
- **共享包**: `packages/`(database / auth / types / ui / config / eslint-config / tsconfig)
- **小程序**: `apps/miniapp-taro`(Taro 4 + React)

---

## 3. 代码风格

- 做减法,最小化代码,零冗余
- 复用现有代码和模式,不做超出需求的"改进"
- 不创建文档文件(除非明确要求)
- 不添加 inline 注释(除非明确要求)
- 不加 copyright/license header

---

## 4. 前端 UI 约束

- compact 紧凑、elegant 优雅
- hover 用 subtle 颜色变化,**不要蓝色发光边框**
- 复用 `packages/ui` 的 Card/Button/Input/Dialog
- 时间用 `Intl.DateTimeFormat`,头像用 initials(首字母)
- 状态徽章: draft 灰 / published 绿
- 积分正数绿色,负数红色
- 每个页面 < 250 行

---

## 5. 后端约束

- Drizzle ORM 0.38 + postgres-js
- 用 Zod 校验请求参数
- 复用现有 authenticate 函数(`packages/auth`)
- admin 路由用 preHandler 钩子统一校验(roleId >= 1)
- 幂等操作用 `onConflictDoNothing`
- slug 从 name 自动生成(slugify)
- API 响应统一 `{ code, message, data }` 格式

---

## 6. 验证命令

```bash
pnpm turbo build typecheck lint test          # 全量验证(必须全绿)
pnpm --filter @ihui/api typecheck             # 单独验证后端
pnpm --filter @ihui/web typecheck             # 单独验证前端
pnpm --filter @ihui/api test                  # 后端测试
pnpm --filter @ihui/database db:generate      # 生成 migration
pnpm dev                                       # 启动所有服务
```

---

## 7. 关键参考文档

| 文档                        | 说明                          |
| --------------------------- | ----------------------------- |
| `PROJECT_PLAN.md`           | **唯一任务计划文档**(必读)    |
| `docs/architecture.md`      | 系统架构文档                  |
| `IHUI-AI-交接文档.md`       | Phase 1-18 完整交接(只读参考) |
| `MIGRATION_GAP_ANALYSIS.md` | 迁移缺口深度报告(只读参考)    |
| `DEPLOYMENT-R65.md`         | 生产部署清单                  |

---

## 8. 删除/重构安全规则(强制)

> 适用范围:删除任何 git 对象(分支、stash、commit、文件)前必须执行的安全审查。

### 必须遵守

- **删除前审查**: 删除任何内容(分支/stash/commit/文件)前必须先回答:
  1. 该内容承载的**功能**是什么?
  2. 当前 monorepo 中是否有**等价的功能实现**?
  3. 如果**没有**等价实现 → **不可以删除**,必须先迁移/开发好替代实现。
- **路径兼容 ≠ 功能等价**: 旧项目残留(如 `client/` Vue、`server/` Python)即使路径与当前 monorepo 不兼容,仍可能承载**当前缺失的功能**。判定标准是"功能是否已被实现",不是"路径是否兼容"。
- **stash drop 同样适用**: drop stash 前必须确认 stash 中改动对应的功能在当前 monorepo 已存在,否则需先实现再 drop。
- **branch -D 同样适用**: 删除本地分支前必须确认该分支承载的功能已合并/已实现。

### 禁止事项

- 不基于"路径不兼容"或"文件类型不匹配"擅自 drop/删除旧项目残留。
- 不在"看起来是垃圾"时跳过功能审查直接 drop。
- 不在功能未迁移完成时删除任何承载该功能的 git 对象。

### 审查流程

1. `git stash show` / `git log --stat` / `git show <sha>` 提取待删除内容的功能点。
2. 在当前 monorepo(`apps/api`、`apps/web`、`apps/ai-service`、`apps/miniapp-taro`、`packages/`)中**逐项**搜索等价实现。
3. 搜索结果为"未实现"时 → 停止删除,在 `PROJECT_PLAN.md` 新增迁移任务并执行。
4. 搜索结果为"已实现"时 → 可删除,但 commit message 需注明审查结论(如 `chore: drop legacy X — confirmed feature Y migrated to apps/web/...`)。
