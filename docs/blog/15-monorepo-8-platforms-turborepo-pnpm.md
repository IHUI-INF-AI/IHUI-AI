---
title: "Monorepo 8 端同步开发:Turborepo + pnpm Workspace 实战"
date: "2026-07-27"
tags: ["Monorepo", "Turborepo", "pnpm", "Multi-platform", "Build", "DevOps"]
category: "工程实践"
description: "用 Turborepo + pnpm Workspace 管理 8 端 monorepo(web/api/ai-service/cli/desktop/extension/mobile/miniapp),包含构建编排、依赖管理、CI 优化。"
---

# Monorepo 8 端同步开发:Turborepo + pnpm Workspace 实战

> 做一个 AI 应用,产品经理说要上 Web、小程序、桌面端、浏览器插件、CLI、移动端 6 个端,加上 API 和 AI 服务共 8 个工程。是开 8 个仓库各干各的,还是用一个 monorepo 统管?IHUI-AI 选了后者。本文是我们在 8 端 monorepo 上用 Turborepo + pnpm Workspace 的工程总结,包含构建编排、依赖管理、跨端类型安全、CI 优化的完整实践。

---

## 一、为什么选 monorepo

### 1.1 polyrepo 的痛点

8 个端开 8 个仓库,会遇到:

- **类型重复**:同一个 `User` 类型在 8 个仓库各定义一份,字段一改全端爆炸
- **API 契约漂移**:API 仓库改了字段,Web 仓库不知道,上线就 500
- **UI 组件重复**:按钮、对话框、消息气泡在 5 个端各实现一次,设计稿一变全端追改
- **发布协调难**:types 仓库发了 v2,要等所有下游仓库升级,期间线上两个版本并存
- **CI 重复**:8 个仓库各跑一遍 lint/typecheck/test,共享代码却无法增量

### 1.2 monorepo 的价值

```
┌─────────────────────────────────────────────────┐
│              IHUI-AI Monorepo                   │
│  ┌──────────────────────────────────────────┐   │
│  │  packages/ (共享:types/ui/auth/db/config)│   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │  apps/ (8 端:web/api/ai-service/...)     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

- **单源真理**:`User` 类型只在 `packages/types` 定义一次,8 端引用
- **原子提交**:API 改字段 + Web 改调用,一个 commit 搞定
- **共享构建**:lint/typecheck/test 配置在 `packages/config`,8 端复用
- **增量 CI**:只重建受影响的包,Turborepo 自动判断

### 1.3 monorepo 的代价

不是没成本:

- **仓库体积大**:clone 慢(但有 shallow clone 和 sparse checkout)
- **权限粒度粗**:所有人能看所有代码(对开源项目反而是优势)
- **构建复杂**:需要工具编排(Turborepo/Nx/Lerna)

权衡下来,8 端高度协同的 AI 平台,monorepo 收益远大于成本。

---

## 二、Turborepo vs Nx vs Lerna

### 2.1 选型对比

| 工具       | 语言 | 优势                           | 劣势                         |
| ---------- | ---- | ------------------------------ | ---------------------------- |
| Lerna      | JS   | 老牌,文档多                   | 已停止维护(2022 起)       |
| Nx         | TS   | 功能强,支持多语言,有缓存    | 学习曲线陡,配置重          |
| Turborepo  | Rust | 极快,配置简单,远程缓存     | 生态新,插件少              |

IHUI-AI 选 **Turborepo**:

- **快**:Rust 写的,任务编排 + 缓存比 Nx 快 3-5 倍
- **简单**:`turbo.json` 一个文件搞定 pipeline,不需要学「generators/executors」概念
- **远程缓存**:Vercel 免费托管,CI 命中缓存秒级完成
- **pnpm 原生支持**:和我们的包管理器无缝集成

### 2.2 不选 Nx 的原因

Nx 适合「企业级 + 多语言 + 复杂依赖图」,但对我们这种纯 TS/Python 混合栈,Turborepo 已经够用。Nx 的 generator(代码生成)对我们价值不大,我们有自己的脚手架脚本。

---

## 三、pnpm workspace 配置

### 3.1 pnpm-workspace.yaml

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

这一行声明:所有 `apps/` 和 `packages/` 下的子目录都是 workspace 包,可以用 `@ihui/<name>` 互相引用。

### 3.2 catalog(统一版本)

pnpm 9.5+ 的 `catalog` 功能解决「同一依赖 8 个端版本不一致」的问题:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

catalog:
  react: ^19.0.0
  react-dom: ^19.0.0
  typescript: ^5.6.0
  zod: ^3.23.0
  drizzle-orm: ^0.38.0
  tailwindcss: ^4.0.0
```

各包的 `package.json` 用 `catalog:` 引用:

```json
{
  "name": "@ihui/web",
  "dependencies": {
    "react": "catalog:",
    "zod": "catalog:"
  }
}
```

改版本只改 `pnpm-workspace.yaml` 一处,所有包同步升级。

### 3.3 pnpm overrides(强制版本)

遇到安全漏洞要强制升级某个传递依赖:

```json
// package.json (根)
{
  "pnpm": {
    "overrides": {
      "lodash": "^4.17.21"
    }
  }
}
```

---

## 四、8 端目录结构设计

```
IHUI-AI/
├── apps/
│   ├── web/              # Next.js 15 + React 19 + Tailwind 4
│   ├── api/              # Fastify 5 + Drizzle ORM 0.38
│   ├── ai-service/       # FastAPI + LangGraph + LiteLLM
│   ├── cli/              # Commander,发布到 npm
│   ├── desktop/          # Electron,复用 web 构建
│   ├── extension/        # Chrome MV3
│   ├── mobile-rn/        # React Native
│   └── miniapp-taro/     # Taro 4(微信小程序)
├── packages/
│   ├── types/            # 跨端共享 TypeScript 类型(API 契约)
│   ├── ui/               # 跨端共享 UI 组件(基于 shadcn/ui)
│   ├── database/         # Drizzle schema + RLS(共享给 api/ai-service)
│   ├── auth/             # 认证逻辑(共享给所有端)
│   ├── config/           # 共享配置(eslint/tailwind/tsconfig 预设)
│   ├── eslint-config/    # ESLint flat config 预设
│   └── tsconfig/         # TypeScript 配置预设
├── turbo.json            # Turborepo pipeline
├── pnpm-workspace.yaml   # pnpm workspace + catalog
└── package.json          # 根 package.json
```

设计原则:

- **apps/ 只写端特有代码**:Web 的页面、CLI 的命令、Extension 的 background script
- **packages/ 只写共享代码**:类型、UI、数据库 schema、认证
- **跨端契约在 packages/types**:API 路由的请求/响应类型,所有端引用同一份

---

## 五、共享包:类型安全的命脉

### 5.1 packages/types 作为 single source of truth

```typescript
// packages/types/src/api/chat.ts
import { z } from "zod";

// Zod schema = 运行时校验 + 类型推导
export const SendMessageRequest = z.object({
  conversationId: z.string(),
  content: z.string().min(1).max(8000),
  model: z.string().optional(),
});

// 类型自动从 schema 推导
export type SendMessageRequest = z.infer<typeof SendMessageRequest>;

export const SendMessageResponse = z.object({
  code: z.literal(0),
  message: z.string(),
  data: z.object({
    messageId: z.string(),
    content: z.string(),
    tokensUsed: z.number(),
  }),
});
export type SendMessageResponse = z.infer<typeof SendMessageResponse>;
```

### 5.2 API 端用 schema 校验

```typescript
// apps/api/src/routes/chat.ts
import { SendMessageRequest } from "@ihui/types";

app.post("/api/chat/send", async (req, reply) => {
  const parsed = SendMessageRequest.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ code: 1, message: parsed.error.message });
  }
  // parsed.data 类型安全
  const result = await chatService.send(parsed.data);
  return { code: 0, message: "ok", data: result };
});
```

### 5.3 Web 端用同一份类型

```typescript
// apps/web/src/api/chat.ts
import { SendMessageRequest, SendMessageResponse } from "@ihui/types";

export async function sendMessage(req: SendMessageRequest): Promise<SendMessageResponse> {
  const res = await fetch("/api/chat/send", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return res.json();
}
```

API 改字段 → `packages/types` 编译报错 → Web 端立刻知道要改。**编译期就发现契约漂移**,而不是上线后 500。

---

## 六、构建编排:turbo.json

### 6.1 pipeline 定义

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.json", ".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "env": ["NODE_ENV", "DATABASE_URL"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "db:generate": {
      "outputs": ["src/migrations/**"]
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

关键概念:

- **`^build`**:先构建依赖项(`packages/*`),再构建自己(`apps/*`)
- **`outputs`**:声明产物路径,Turborepo 据此做缓存
- **`persistent: true`**:`dev` 是长任务,不缓存
- **`cache: false`**:`db:migrate` 每次都真跑(改数据库不能靠缓存)

### 6.2 执行示例

```bash
# 全量构建(按依赖图并行)
pnpm turbo build
# 输出:
#  @ihui/types:build cache hit 1.2s
#  @ihui/database:build cache hit 2.1s
#  @ihui/web:build 45.3s
#  @ihui/api:build 12.4s
#  ...

# 只跑 typecheck(增量,只重建受影响的)
pnpm turbo typecheck --filter=@ihui/web

# 启动所有 dev server
pnpm turbo dev --parallel
```

### 6.3 远程缓存

```bash
# 登录 Vercel 免费 remote cache
npx turbo login
npx turbo link

# 之后 build 命中远程缓存,CI 时间从 8 分钟降到 90 秒
```

CI 上同一个 commit 第二次跑,几乎所有 task 都是 cache hit。

---

## 七、依赖管理

### 7.1 catalog 统一版本

见 3.2,所有共享依赖版本集中在 `pnpm-workspace.yaml` 的 `catalog` 字段。

### 7.2 端特有依赖就地声明

React Native 的 `react-native`、Taro 的 `@tarojs/taro`、Electron 的 `electron`,只在对应 `apps/<端>/package.json` 里声明,不污染共享包。

### 7.3 依赖图可视化

```bash
pnpm why react
# 列出谁依赖了 react,版本是否一致

# 检查重复依赖
pnpm list react --depth=10 --recursive
```

---

## 八、跨端类型安全

### 8.1 共享 schema(database + types)

`packages/database` 的 Drizzle schema 既是 SQL 生成源,也是类型源:

```typescript
// packages/database/src/schema/users.ts
import { pgTable, varchar, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  email: varchar("email").notNull(),
  roleId: integer("role_id").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 类型自动推导
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

API 端查询返回的 `User` 类型,Web 端拿到的也是同一个 `User` 类型——因为都从 `@ihui/database` 导入。

### 8.2 API 响应统一格式

所有 API 返回 `{ code, message, data }`:

```typescript
// packages/types/src/common.ts
export interface ApiResponse<T> {
  code: 0 | 1;
  message: string;
  data: T;
}
```

Web 端的 fetch wrapper 强制校验:

```typescript
async function apiCall<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { /* ... */ });
  const json: ApiResponse<T> = await res.json();
  if (json.code !== 0) throw new Error(json.message);
  return json.data;
}
```

---

## 九、CI 优化

### 9.1 turbo prune(增量构建)

大型 monorepo 的 Docker 构建如果每次都 copy 全仓库,镜像层缓存会失效。`turbo prune` 只 copy 受影响的包:

```dockerfile
# Dockerfile
FROM node:20 AS base
RUN corepack enable

FROM base AS installer
WORKDIR /app
COPY .gitignore .gitignore
COPY . .
# 只保留 web 及其依赖,剔除其他 7 端
RUN pnpm dlx turbo prune @ihui/web --docker

FROM base AS builder
WORKDIR /app
COPY --from=installer /app/out/json/ .
COPY --from=installer /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=installer /app/out/full/ .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@ihui/web...

FROM base AS runner
COPY --from=builder /app/apps/web/.next/standalone ./
EXPOSE 3000
CMD ["node", "server.js"]
```

Web 端 Docker 镜像从全量 2.3GB 降到 380MB,构建时间从 6 分钟降到 90 秒。

### 9.2 增量 task

CI 只跑受影响包的 task:

```bash
# 只 typecheck 改动过的包及其下游
pnpm turbo typecheck --filter=...[origin/main]

# 只测试改动过的包
pnpm turbo test --filter=...[origin/main]
```

### 9.3 并行 task

Turborepo 自动并行化无依赖关系的 task:

```
@ihui/types:build ──┬── @ihui/web:build
                    ├── @ihui/api:build
                    ├── @ihui/cli:build
                    └── @ihui/desktop:build  (并行)
```

8 个端的 build 在 8 核机器上并行跑,比串行快 4 倍。

---

## 十、常见陷阱

### 10.1 循环依赖

`@ihui/types` 依赖 `@ihui/database`,`@ihui/database` 又依赖 `@ihui/types` → 死循环。

解法:**明确依赖方向**。types 是最底层,不依赖任何业务包;database 依赖 types;apps 依赖两者。单向依赖图,不允许反向。

```bash
# 用 madge 检测循环依赖
npx madge --circular packages/ apps/ --extensions ts,tsx
```

### 10.2 版本漂移

没上 catalog 之前,8 个端的 `zod` 版本分别是 3.22 / 3.23 / 3.23 / 3.24...,某天 zod 3.24 改了 API,3.23 的端就炸了。

解法:**catalog 强制统一**(见 3.2)。所有包 `zod: "catalog:"`,一处升级全端同步。

### 10.3 构建顺序错误

`@ihui/web` build 时依赖 `@ihui/types` 的产物,但 Turborepo 不知道顺序,可能先 build web 导致找不到类型。

解法:`turbo.json` 里 `"dependsOn": ["^build"]`,Turborepo 会先 build 依赖项(`^` 表示上游)。

### 10.4 workspace 协议误用

```json
// 错误:用 ^ 范围,可能拉到 npm 上的旧版本
"dependencies": { "@ihui/types": "^1.0.0" }

// 正确:用 workspace 协议,强制用本地包
"dependencies": { "@ihui/types": "workspace:*" }
```

`workspace:*` 保证永远用本地 monorepo 的包,不会误拉 npm。

---

## 十一、IHUI-AI 实战配置

### 11.1 完整 turbo.json(精简版)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.json", "pnpm-workspace.yaml"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**", ".output/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"], "outputs": [] },
    "lint": { "outputs": [] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "db:generate": { "outputs": ["src/migrations/**"] },
    "db:migrate": { "cache": false }
  }
}
```

### 11.2 package.json scripts(根)

```json
{
  "scripts": {
    "dev": "turbo dev --parallel",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "typecheck:full": "turbo typecheck --filter=...",
    "lint": "turbo lint",
    "test": "turbo test",
    "db:generate": "turbo db:generate",
    "db:migrate": "turbo db:migrate"
  }
}
```

`pnpm dev` 一条命令拉起 web(8801)+ api(8800)+ ai-service(8802)所有 dev server。

### 11.3 实测数据

| 操作            | 单仓库(估算) | monorepo(实测) | 提升        |
| --------------- | -------------- | ----------------- | ----------- |
| 全量 build      | 8 端串行 12min | 并行 3min         | 4x          |
| 增量 typecheck  | 8 端全跑 4min  | 受影响 1 端 30s   | 8x          |
| CI(命中缓存)  | 全量 8min      | 90s               | 5x          |
| 改 API 字段同步 | 手动通知 + 改 8 处 | 编译报错一处改 | 不可估量    |

---

## 十二、参考资料

- [Turborepo 官方文档](https://turbo.build/repo/docs)
- [pnpm Workspace](https://pnpm.io/workspaces)
- [pnpm Catalog](https://pnpm.io/catalogs)
- [Nx 对比文档](https://turbo.build/repo/docs/guides/comparisons/turborepo-vs-nx)
- [turbo prune Docker](https://turbo.build/repo/docs/guides/tools/docker)
- IHUI-AI 源码:`turbo.json` + `pnpm-workspace.yaml` + `apps/*` + `packages/*`

---

## 总结

8 端 monorepo 不是「为了 monorepo 而 monorepo」,是为了让 8 个端真正「同源」。Turborepo + pnpm Workspace + catalog 的组合,让我们能:

- **一处改,全端同步**:`packages/types` 改字段,8 端编译报错,无遗漏
- **构建快**:Turborepo 并行 + 远程缓存,CI 从 8 分钟降到 90 秒
- **版本统一**:catalog 强制所有端用同一份依赖版本,杜绝漂移
- **增量交付**:`turbo prune` 让单端 Docker 镜像只有 380MB

如果你也在做多端 AI 应用,monorepo 是值得前期投入的架构决策。短期看配置复杂,长期看每改一个字段省下的协调成本,远超初始投入。

至此,IHUI-AI 的工程实践系列博客已经覆盖了从 MCP 协议、PostgreSQL RLS、LangGraph 编排、LiteLLM Gateway 到 Monorepo 构建的完整技术栈。回到第一篇 [8 端同源架构](./01-8-ends-same-source-architecture.md)可以看到,这些技术选型共同支撑了一个「8 端同源、340 表、176 模型」的全栈 AI 平台。
