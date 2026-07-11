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
