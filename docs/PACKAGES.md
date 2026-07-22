# 共享包指南(packages/)

> IHUI-AI Monorepo 的 `packages/` 目录包含 12 个 TS 共享包,通过 pnpm workspace 协议(`workspace:*`)被各 app 引用。本文档聚焦包内部结构与引用方式,Monorepo 技术栈与包管理总览见 [architecture.md](./architecture.md) §1,SDK 多语言用法见 [SDK.md](./SDK.md)(若存在)。

---

## 1. 总览

| 维度 | 说明 |
|------|------|
| 包管理 | pnpm 9.15 workspace + Turborepo 2.3 |
| 引用方式 | `@ihui/xxx`(workspace 协议,源码直引) |
| 构建工具 | `tsc`(TypeScript 编译器),输出 `dist/` |
| 版本协议 | `workspace:*`(本地互引),未来发布用 semver |
| TS 配置 | `@ihui/tsconfig` 统一基础配置,composite 项目引用 |
| Lint 配置 | `@ihui/eslint-config` 统一 ESLint 规则 |

**包数量说明**:文件系统实际 12 个 TS 包。`@ihui/sdk` 另含 4 语言 SDK 实现(Python/Go/Java/.NET),按"包"计 1 个,按"SDK 实现"计 5 个(TS + 4 语言)。

---

## 2. 包清单

| 包名 | 路径 | 用途 | 主要导出 | 测试数 |
|------|------|------|----------|--------|
| `@ihui/auth` | `packages/auth/` | 认证:JWT + token-family + blacklist + OAuth2 + ws-auth + data-scope + key-rotation | `jwt`/`token-family`/`blacklist`/`oauth2`/`ws-auth`/`data-scope`/`key-rotation` | 5 测试文件 |
| `@ihui/database` | `packages/database/` | Drizzle schema(100+ 表)+ 100+ 迁移 + client + rls + read-replica + tenant-router | `schema/*`/`client`/`rls`/`read-replica`/`tenant-router` | 2 测试文件 |
| `@ihui/types` | `packages/types/` | 全栈类型定义(20 模块) | `user`/`api`/`ai`/`api-key`/`memory`/`plugin`/`agent-control`/`agent-runtime`/`api-contracts`/`cli-config`/`ide-workspace`/`leaderboard`/`legacy-migration`/`message-repair`/`notification-channels`/`notification`/`webhook-trigger`/`work-panel`/`workspace`/`v1-endpoints` | 2 测试文件 |
| `@ihui/ui` | `packages/ui/` | shadcn/ui 基础组件(Web) | `button`/`input`/`label`/`card`/`dialog`/`select`/`tabs`/`tooltip`/`badge`/`checkbox`/`table`/`data-table`/`sidebar`/`sheet`/`switch`/`collapsible`/`code-block`/`log-viewer`/`resizable`/`tree-select`/`vip-badge`/`theme-logo`/`webview-frame`/`work-panel`/`Upload` | - |
| `@ihui/ui-native` | `packages/ui-native/` | React Native 版组件(mobile-rn 用) | `avatar`/`badge`/`button`/`card`/`dialog`/`input`/`loading`/`switch`/`tabs`/`vip-badge` | - |
| `@ihui/ui-primitives` | `packages/ui-primitives/` | UI 原语:`cn()` 类名合并 + design tokens | `cn`/`tokens`(色板/间距/字号/圆角/阴影/z-index) | - |
| `@ihui/config` | `packages/config/` | 常量与环境配置 | `constants`/`env` | - |
| `@ihui/eslint-config` | `packages/eslint-config/` | ESLint 共享配置 | `base`/`next`/`react` | - |
| `@ihui/tsconfig` | `packages/tsconfig/` | TSConfig 共享配置 | `base`/`nextjs`/`node`/`react-library` | - |
| `@ihui/api-client` | `packages/api-client/` | API 客户端:48 endpoint 文件 + client + circuit-breaker + ws-client | `client`/`api-error`/`utils`/`endpoints/*`(48 文件)/`circuit-breaker`/`ws-client`/`model-context-capacity` | 3 测试文件 |
| `@ihui/context-compaction` | `packages/context-compaction/` | 上下文压缩(对话历史 token 优化) | `index` | - |
| `@ihui/sdk` | `packages/sdk/` | TS SDK + 4 语言 SDK(Python/Go/Java/.NET) | TS:`agents`/`ai`/`audio`/`files`/`generation`/`images`/`knowledge`/`memory`/`messages`/`streaming`/`threed`/`tools`/`user`/`videos` | - |

### @ihui/auth 源码结构

```
packages/auth/src/
├── index.ts            # 统一导出
├── jwt.ts              # JWT 签发/验证(HS256,与 ai-service 共享 JWT_SECRET)
├── token-family.ts     # token-family 旋转(防盗用,refresh token 黑名单)
├── blacklist.ts        # refresh token 黑名单(Redis 持久化)
├── oauth2.ts           # OAuth2 第三方登录(微信/GitHub/Google)
├── ws-auth.ts          # WebSocket 鉴权(socket JWT 校验)
├── data-scope.ts       # 数据权限控制(基于租户 + 角色)
└── key-rotation.ts     # 密钥轮换(JWT_SECRET 安全轮换)
```

### @ihui/database 源码结构

```
packages/database/
├── src/
│   ├── schema/         # Drizzle schema(140+ 文件,100+ 表)
│   │   ├── users.ts            # 用户表
│   │   ├── agents-extended.ts  # 智能体扩展
│   │   ├── ai-config.ts        # AI 配置
│   │   ├── billing.ts          # 计费
│   │   ├── chat.ts             # 聊天
│   │   ├── knowledge-rag.ts    # RAG 知识库
│   │   ├── memory.ts            # 记忆
│   │   ├── tenant.ts            # 多租户
│   │   ├── rbac.ts              # 权限
│   │   └── ...(140+ 文件)
│   ├── client.ts       # postgres-js 连接客户端
│   ├── read-replica.ts # 读副本路由(读写分离)
│   ├── rls.ts          # RLS 行级安全策略
│   ├── tenant-router.ts # 租户路由
│   └── index.ts        # 统一导出
├── drizzle/            # 迁移文件(100+ SQL)
│   ├── 0000_naive_barracuda.sql
│   ├── ...
│   ├── 0123_pgvector_embedding.sql  # pgvector 向量扩展
│   ├── 0129_codebase_embedding.sql  # 代码库嵌入
│   └── 20260722190000_model_leaderboard.sql
├── seed/               # 种子数据(15 文件)
│   ├── index.ts        # 7 步幂等 seed 流程
│   ├── users.ts
│   ├── permissions.ts
│   └── ...
├── drizzle.config.ts   # drizzle-kit 配置
└── package.json
```

### @ihui/types 源码结构

```
packages/types/src/
├── index.ts              # 统一导出
├── user.ts               # 用户类型
├── api.ts                # API 通用类型
├── ai.ts                 # AI 相关类型
├── api-key.ts            # API Key 类型
├── memory.ts             # 记忆类型
├── plugin.ts             # 插件类型
├── agent-control.ts      # Agent 控制类型
├── agent-runtime.ts      # Agent 运行时类型
├── api-contracts.ts      # API 契约类型
├── cli-config.ts          # CLI 配置类型
├── ide-workspace.ts       # IDE 工作区类型
├── leaderboard.ts         # 排行榜类型
├── legacy-migration.ts   # 遗留迁移类型
├── message-repair.ts     # 消息修复类型
├── notification-channels.ts # 通知渠道类型
├── notification.ts       # 通知类型
├── webhook-trigger.ts    # Webhook 触发类型
├── work-panel.ts         # 工作面板类型
├── workspace.ts          # 工作区类型
└── v1-endpoints.ts       # v1 端点类型
```

### @ihui/ui 组件清单

```
packages/ui/src/components/
├── button.tsx          # 按钮(cva 变体:default/destructive/outline/secondary/ghost/link)
├── input.tsx            # 输入框
├── label.tsx            # 标签
├── card.tsx             # 卡片(Card/Header/Title/Description/Content/Footer)
├── dialog.tsx           # 对话框(Radix Dialog)
├── select.tsx            # 下拉选择(Radix Select)
├── tabs.tsx              # 标签页(Radix Tabs)
├── tooltip.tsx           # 工具提示(Radix Tooltip)
├── badge.tsx             # 徽章
├── checkbox.tsx          # 复选框(Radix Checkbox)
├── table.tsx             # 表格
├── data-table.tsx        # 数据表格(@tanstack/react-table)
├── sidebar.tsx           # 侧边栏
├── sheet.tsx             # 抽屉(Radix Dialog 变体)
├── switch.tsx            # 开关(Radix Switch)
├── collapsible.tsx      # 折叠面板(Radix Collapsible)
├── code-block.tsx        # 代码块(语法高亮)
├── log-viewer.tsx        # 日志查看器
├── resizable.tsx         # 可调整大小面板
├── tree-select.tsx       # 树形选择
├── vip-badge.tsx         # VIP 徽章
├── theme-logo.tsx        # 主题 Logo
├── webview-frame.tsx     # WebView 框架
├── work-panel.tsx        # 工作面板
└── Upload.tsx             # 文件上传
```

### @ihui/ui-native 组件清单

```
packages/ui-native/src/
├── avatar.tsx    # 头像
├── badge.tsx     # 徽章
├── button.tsx    # 按钮
├── card.tsx      # 卡片
├── dialog.tsx    # 对话框
├── input.tsx     # 输入框
├── loading.tsx  # 加载
├── switch.tsx    # 开关
├── tabs.tsx      # 标签页
└── vip-badge.tsx # VIP 徽章
```

### @ihui/api-client 端点文件清单(48 文件)

```
packages/api-client/src/endpoints/
├── admin-auth.ts          ├── exam-marking.ts     ├── payment.ts
├── admin-content.ts      ├── exam.ts             ├── plugin.ts
├── admin-member.ts        ├── knowledge-rag.ts    ├── private-letters.ts
├── admin-monitor.ts       ├── learn.ts            ├── resource.ts
├── admin-system.ts       ├── legacy-public.ts    ├── share.ts
├── admin-tenants.ts       ├── live.ts             ├── subscription.ts
├── admin-tenants.types.ts ├── llm.ts              ├── system.ts
├── admin-tool-gen.ts     ├── mail.ts              ├── token.ts
├── admin.ts               ├── misc.ts             ├── user.ts
├── agent-runtime.ts      ├── notification.ts      ├── vip.ts
├── agent.ts               ├── order.ts            ├── wallet.ts
├── ai-media.ts            ├── workspace.ts        ├── wrong-questions.ts
├── ai.ts                  ├── chat-skills.ts      ├── chat.ts
├── auth-codes.ts          ├── community.ts         ├── course.ts
├── crew.ts                ├── developer.ts        ├── distribution.ts
├── auth.ts                ├── browser.ts          ├── business.ts
└── category.ts
```

### @ihui/sdk 多语言 SDK 结构

| 语言 | 路径 | 模块数 | 说明 |
|------|------|--------|------|
| TypeScript | `packages/sdk/src/` | 14 模块 | 原生 SDK,与 `@ihui/api-client` 互补 |
| Python | `packages/sdk/python/ihui_ai/` | 13 模块 | `ihui_ai` 包,支持 async/sync |
| Go | `packages/sdk/go/` | 15 模块 | `ihui` 包,client/model/module 三层 |
| Java | `packages/sdk/java/` | 11 模块 | `com.ihui.ai.sdk` 包 |
| .NET | `packages/sdk/dotnet/` | 13 模块 | `Ihui.AI` 命名空间 |

> 多语言 SDK 的具体用法见各自 README(`packages/sdk/{lang}/README.md`)。

---

## 3. 包依赖关系图

```
                    ┌─────────────┐
                    │ @ihui/types │ (基础类型,无依赖)
                    └──────┬──────┘
                           │
        ┌──────────┬───────┼────────┬────────────┐
        │          │       │        │            │
        ▼          ▼       ▼        ▼            ▼
  @ihui/auth  @ihui/database  @ihui/api-client  @ihui/sdk
        │          │       │        │            │
        │          │       │        │            │
        │          │       │        │            │
        ▼          ▼       ▼        ▼            ▼
  apps/api   apps/api    apps/web  apps/web    apps/cli
             apps/web              apps/api    外部用户

  ┌─────────────────┐
  │ @ihui/ui-primitives │ (cn + tokens,无依赖)
  └────────┬────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
@ihui/ui    @ihui/ui-native
    │             │
    ▼             ▼
 apps/web    apps/mobile-rn

  ┌─────────────────┐
  │ @ihui/config    │ (constants + env,无依赖)
  └─────────────────┘
           │
           ▼
      apps/* (全部)

  ┌─────────────────┐  ┌─────────────────┐
  │ @ihui/eslint-config │  │ @ihui/tsconfig    │ (配置包,无运行时依赖)
  └─────────────────┘  └─────────────────┘
           │                      │
           ▼                      ▼
      packages/* + apps/*     packages/* + apps/*

  ┌─────────────────────┐
  │ @ihui/context-compaction │ (独立,无内部依赖)
  └─────────────────────┘
           │
           ▼
      apps/web / apps/api
```

### 依赖关系表

| 包 | 依赖(@ihui/*) | 被引用方 |
|----|----------------|----------|
| `@ihui/types` | (无) | auth, database, api-client, sdk, apps/* |
| `@ihui/auth` | types | apps/api, apps/web |
| `@ihui/database` | (无,直接依赖 drizzle-orm + postgres) | apps/api |
| `@ihui/ui-primitives` | (无,依赖 cva + clsx + tailwind-merge) | ui, ui-native |
| `@ihui/ui` | ui-primitives | apps/web |
| `@ihui/ui-native` | ui-primitives | apps/mobile-rn |
| `@ihui/config` | (无) | apps/* |
| `@ihui/eslint-config` | (无) | packages/* + apps/* |
| `@ihui/tsconfig` | (无) | packages/* + apps/* |
| `@ihui/api-client` | types | apps/web, apps/cli |
| `@ihui/context-compaction` | (无) | apps/web, apps/api |
| `@ihui/sdk` | types, tsconfig | 外部用户(TS SDK) |

---

## 4. 引用方式示例

### 4.1 在 apps/web 中引用

```typescript
// apps/web/src/components/user-card.tsx
import { Card, CardHeader, CardTitle, CardContent, Badge } from '@ihui/ui'
import { cn } from '@ihui/ui-primitives'
import type { User } from '@ihui/types/user'

export function UserCard({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
        <Badge variant={user.roleId >= 1 ? 'default' : 'secondary'}>
          {user.roleId >= 1 ? '管理员' : '用户'}
        </Badge>
      </CardHeader>
      <CardContent>{user.email}</CardContent>
    </Card>
  )
}
```

### 4.2 在 apps/api 中引用

```typescript
// apps/api/src/routes/auth.ts
import { jwt, tokenFamily, blacklist } from '@ihui/auth'
import { db } from '@ihui/database'
import { users } from '@ihui/database/schema/users'
import { eq } from 'drizzle-orm'
import type { LoginRequest, LoginResponse } from '@ihui/types/api'

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const [user] = await db.select().from(users).where(eq(users.account, req.account))
  if (!user) throw new Error('用户不存在')

  const accessToken = jwt.sign({ userId: user.id, roleId: user.roleId })
  const refreshToken = await tokenFamily.create(user.id)

  return { accessToken, refreshToken, user }
}
```

### 4.3 在 apps/cli 中引用

```typescript
// apps/cli/src/commands/agent.ts
import { IhuiClient } from '@ihui/sdk'
import { createApiClient } from '@ihui/api-client/client'

const client = new IhuiClient({
  apiKey: process.env.IHUI_API_KEY!,
  baseURL: 'https://api.ihui.ai',
})

// 调用 agent 执行
const result = await client.agents.execute({
  goal: '分析这段代码',
  sessionId: 'cli-session-001',
})
```

### 4.4 引用 api-client 端点

```typescript
// apps/web/src/lib/api.ts
import { createApiClient } from '@ihui/api-client/client'
import { authEndpoints } from '@ihui/api-client/endpoints/auth'
import { circuitBreaker } from '@ihui/api-client/circuit-breaker'

const apiClient = createApiClient({
  baseURL: '/api',
  interceptor: circuitBreaker({ threshold: 5, timeout: 30000 }),
})

// 调用登录端点
export async function login(account: string, password: string) {
  return authEndpoints.login(apiClient, { account, password })
}
```

### 4.5 引用共享 tsconfig

```jsonc
// packages/auth/tsconfig.json
{
  "extends": "@ihui/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

```jsonc
// apps/web/tsconfig.json
{
  "extends": "@ihui/tsconfig/nextjs.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }]
  }
}
```

### 4.6 引用 eslint-config

```javascript
// packages/auth/eslint.config.js
import baseConfig from '@ihui/eslint-config/base.js'
import reactConfig from '@ihui/eslint-config/react.js'

export default [
  ...baseConfig,
  ...reactConfig,
  {
    rules: {
      // 包特定规则
    },
  },
]
```

---

## 5. 新增包流程

### 5.1 创建包目录

```bash
mkdir -p packages/new-package/src
```

### 5.2 package.json 模板

```jsonc
{
  "name": "@ihui/new-package",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rimraf dist .turbo node_modules"
  },
  "dependencies": {
    "@ihui/types": "workspace:*"
  },
  "devDependencies": {
    "@ihui/eslint-config": "workspace:*",
    "@ihui/tsconfig": "workspace:*",
    "typescript": "^5.7.2",
    "rimraf": "^6.0.1",
    "vitest": "^2.1.8"
  }
}
```

### 5.3 tsconfig.json

```jsonc
{
  "extends": "@ihui/tsconfig/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src/**/*"]
}
```

### 5.4 eslint.config.js

```javascript
import baseConfig from '@ihui/eslint-config/base.js'

export default [
  ...baseConfig,
  {
    rules: {},
  },
]
```

### 5.5 pnpm-workspace.yaml 自动识别

`pnpm-workspace.yaml` 已配置 `packages/*`,新增包目录自动被识别,无需修改:

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 5.6 验证

```bash
pnpm install                    # 链接新包
pnpm --filter @ihui/new-package typecheck
pnpm --filter @ihui/new-package build
```

---

## 6. 版本管理

### workspace 协议(当前)

所有内部包用 `workspace:*` 协议互引,版本号统一 `0.0.0`(private),不发布到 npm:

```jsonc
{
  "dependencies": {
    "@ihui/types": "workspace:*",
    "@ihui/auth": "workspace:*"
  }
}
```

**优势**:

- 源码直引(`types` 指向 `src/index.ts`),无需 build 即可 typecheck
- 修改共享包后所有引用方自动生效,无需 version bump
- Turborepo 自动处理构建依赖顺序(`dependsOn: ["^build"]`)

### semver(未来发布)

发布到 npm 时切换为 semver:

```jsonc
{
  "dependencies": {
    "@ihui/types": "^1.0.0",
    "@ihui/auth": "^1.0.0"
  }
}
```

---

## 7. 构建产物

### turbo.json build task

```jsonc
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],          // 先构建依赖包
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputs": ["dist/**"],            // 输出到 dist/
      "env": ["NODE_ENV", "DATABASE_URL", "REDIS_URL", "JWT_SECRET"]
    }
  }
}
```

### dist/ 输出

| 包 | 构建命令 | 输出位置 |
|----|----------|----------|
| `@ihui/auth` | `tsc` | `packages/auth/dist/` |
| `@ihui/database` | `tsc --build --force` | `packages/database/dist/` |
| `@ihui/types` | `tsc` | `packages/types/dist/` |
| `@ihui/ui` | `tsc` | `packages/ui/dist/` |
| `@ihui/ui-primitives` | `tsc` | `packages/ui-primitives/dist/` |
| `@ihui/api-client` | `tsc` | `packages/api-client/dist/` |
| `@ihui/sdk` | `tsc -p tsconfig.json` | `packages/sdk/dist/` |
| `@ihui/config` | `tsc` | `packages/config/dist/` |
| `@ihui/context-compaction` | `tsc` | `packages/context-compaction/dist/` |

### check-stale-dist.mjs 守门

`scripts/check-stale-dist.mjs`(pre-commit 第 4 项)检测 `packages/*/dist/` 是否陈旧:

- 对比 `src/**` 与 `dist/**` 的修改时间
- 源码更新但 dist 未重建 → 守门失败,阻塞 commit
- 解决:`pnpm --filter @ihui/xxx build` 重建

### check-dist-encoding.mjs 守门

`scripts/check-dist-encoding.mjs`(pre-commit 第 4b 项)检测 `packages/*/dist/` UTF-8 BOM:

- 构建产物必须无 BOM(部分 Node.js 版本对 BOM 敏感)
- 检测到 BOM → 守门失败

---

## 8. 发布策略

### 当前:私有(workspace)

所有包 `private: true`,仅 Monorepo 内部使用,不发布到 npm。

### 未来:npm publish 流程预留

1. **版本号切换**:`0.0.0` → `1.0.0`(semver)
2. **依赖协议切换**:`workspace:*` → `^1.0.0`
3. **移除 private**:`"private": true` → 删除或 `false`
4. **npm 账户配置**:`npm login` + `.npmrc` authToken
5. **发布脚本**:

```bash
# 构建全部包(按依赖顺序)
pnpm turbo build

# 发布(按依赖顺序)
pnpm --filter @ihui/types publish --access public
pnpm --filter @ihui/auth publish --access public
pnpm --filter @ihui/database publish --access public
# ... 其他包

# 或用 changeset 批量发布
pnpm changeset publish
```

6. **CI/CD 集成**:GitHub Actions 监听 tag 推送,自动 build + publish
7. **provenance**:启用 npm provenance(SLSA 3 级来源证明)

### 不发布的包(保持私有)

- `@ihui/config`:含项目特定环境配置
- `@ihui/eslint-config` / `@ihui/tsconfig`:可发布,但当前项目特定
- `@ihui/database`:schema 与项目强绑定,不通用

### 可发布的包(通用工具)

- `@ihui/types`:API 类型定义
- `@ihui/auth`:认证工具(可配置 JWT_SECRET)
- `@ihui/ui`:shadcn/ui 组件(可复用)
- `@ihui/ui-primitives`:cn + tokens(通用)
- `@ihui/api-client`:API 客户端(可配置 baseURL)
- `@ihui/sdk`:多语言 SDK(面向外部用户)
- `@ihui/context-compaction`:上下文压缩(通用)
