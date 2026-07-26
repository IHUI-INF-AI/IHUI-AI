---
title: "8 端同源架构设计模式:Monorepo + 共享包的工程方法论"
date: "2026-07-27"
tags: ["多端架构", "Monorepo", "Turborepo", "同源代码", "跨端开发", "8 端"]
category: "前端架构"
description: "用 pnpm workspace + Turborepo 把 Web/API/AI-service/桌面/扩展/移动/小程序/CLI 8 端代码合并到同一仓库,本文拆解端特定隔离、共享契约、构建优化三类设计模式。"
---

# 8 端同源架构设计模式:Monorepo + 共享包的工程方法论

> 一个产品要在 8 个端(Web、API、AI-service、桌面、扩展、移动、小程序、CLI)同时上线,传统做法是 8 个仓库,改一个 API 要协调 8 次。本文讲 IHUI-AI 用 Monorepo + 共享包的设计模式,把跨端协同成本降到接近零。

---

## 一、为什么必须 8 端同源

AI 产品天然是全端的:用户在桌面写 prompt,在手机查结果,在小程序里给客户演示,在浏览器扩展里截屏发问,在 CLI 里批量跑。任何一端缺失,体验都断裂。

**8 端同源**意味着三件事:

1. **代码同源**:8 端共享类型定义、UI 组件、API schema、数据库 schema。
2. **链路同源**:跨端调用无契约漂移,改一个 API,8 端立刻感知。
3. **验证同源**:8 端的 typecheck + build + test 全绿才算交付。

---

## 二、Monorepo 选型:为什么是 pnpm workspace + Turborepo

### 选型对比

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| Nx | 配置丰富,生态成熟 | 学习曲线陡,小项目过度设计 |
| Lerna | 老牌方案 | 已停止维护,慢 |
| **pnpm workspace + Turborepo** | 极快、零配置、原生 TS | 缺少 Nx 的高级依赖图分析 |

IHUI-AI 选 pnpm + Turborepo 的核心理由:

- **pnpm 的硬链接**:8 个端都依赖 React,node_modules 不重复占盘。
- **Turborepo 的内容哈希缓存**:改 `apps/web` 不会触发 `apps/api` 的 rebuild。
- **零运行时开销**:不引入额外框架,纯构建工具。

### 仓库布局

```
IHUI-AI/
├── apps/
│   ├── web/            # Next.js 15
│   ├── api/            # Fastify 5
│   ├── ai-service/     # FastAPI + LangGraph
│   ├── desktop/        # Electron
│   ├── extension/      # Chrome MV3
│   ├── mobile-rn/      # React Native
│   ├── miniapp-taro/   # Taro 4
│   └── cli/            # Node.js CLI
├── packages/
│   ├── database/       # Drizzle schema(8 端共享)
│   ├── auth/           # 鉴权函数
│   ├── types/          # OpenAPI + TS 类型
│   ├── ui/             # shadcn/ui 跨端组件
│   ├── config/         # 共享配置
│   ├── eslint-config/ # 代码规范
│   └── tsconfig/       # TS 配置基线
└── turbo.json
```

---

## 三、设计模式 1:共享契约(Contract Sharing)

8 端最大的协同成本是「契约漂移」:API 改了字段,Web 不知道。

### 解决方案:类型作为单一真相源

`packages/types` 是所有 API 的 Zod schema 集合:

```typescript
// packages/types/src/agent.ts
import { z } from "zod";

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  modelId: z.string(),
  systemPrompt: z.string().max(5000),
  visibility: z.enum(["private", "public", "marketplace"]),
  price: z.number().min(0).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;
```

- **API 端**:Fastify 路由用 `AgentSchema` 校验请求体。
- **Web 端**:同一份 `Agent` 类型,表单和列表组件类型安全。
- **CLI 端**:命令行参数同样用 `AgentSchema` 解析。

改一处,8 端立刻在 typecheck 阶段报错。

---

## 四、设计模式 2:端特定代码隔离(Isolation Pattern)

共享不等于全共享,端特定代码必须隔离。三种隔离粒度:

### 粒度 1:文件级(平台后缀)

```typescript
// packages/ui/components/CopyButton.tsx          # 默认实现
// packages/ui/components/CopyButton.desktop.tsx  # 桌面端覆盖
// packages/ui/components/CopyButton.mobile.tsx   # 移动端覆盖
```

构建工具按端选择对应文件,类似 `.ios.tsx` / `.android.tsx` 的约定。

### 粒度 2:模块级(packages 分层)

- `packages/database`:schema 定义(8 端共享)。
- `apps/api/db`:迁移脚本与连接池(API 独占)。
- `apps/web/api-client`:只读查询客户端(Web 独占,不能跑迁移)。

### 粒度 3:能力级(能力降级)

桌面端有系统托盘、扩展端有右键菜单、小程序有微信支付——这些是端独占能力,通过「能力注册表」让其他端知道「这个能力我不支持,跳过对应 UI」:

```typescript
// packages/types/src/capabilities.ts
export const CAPABILITIES = {
  systemTray: ["desktop"],
  contextMenu: ["extension"],
  wechatPay: ["miniapp-taro"],
  nativeNotification: ["desktop", "extension", "mobile-rn"],
} as const;
```

UI 层根据当前端的能力动态渲染:`{has("systemTray") && <TraySettings />}`。

---

## 五、设计模式 3:构建优化(Build Optimization)

### 模式 1:Turborepo 任务依赖图

```jsonc
// turbo.json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],     // 先 build 依赖的 package
      "outputs": ["dist/**", ".next/**"]
    },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["build"] }
  }
}
```

`^build` 表示「先 build 我依赖的 package」,自动按依赖图串行。

### 模式 2:远程缓存

Turborepo 支持把 `dist/**` 缓存到 Vercel Remote Cache,CI 命中缓存秒级返回。8 端 build 时间从 12 分钟降到 4 分钟。

### 模式 3:按需构建

不是每个开发者都需要 8 端。`pnpm dev` 只启动 web + api + ai-service 三端,其他端用 `pnpm --filter @ihui/desktop dev` 按需启动。

---

## 六、共享 UI 组件的代价与边界

`packages/ui` 基于 shadcn/ui,Web 和 Desktop 共享大部分组件。但**不是所有组件都适合跨端**:

- ❌ 强依赖 DOM API 的组件(如 Portal)在 React Native 上不工作。
- ❌ 强依赖 Next.js 路由的组件在 CLI 上不工作。
- ✅ 纯展示型组件(Card / Badge / Avatar)跨端共享。

IHUI 的做法:`packages/ui` 只放「无副作用」组件,「有副作用」组件(路由 / 平台 API)由各端自己实现。

---

## 七、IHUI-AI 的工程实践

- **8 端类型同源**:`packages/types` 是唯一类型源,所有端 `import { Agent } from "@ihui/types"`。
- **数据库 schema 共享**:`packages/database` 用 Drizzle 定义一次,API 跑迁移,其他端用 `drizzle-zod` 派生类型。
- **守门脚本保证同步**:pre-commit 跑 `check-multi-end-sync.mjs`,触及一端未标注「平台独占」会 warn。

完整 8 端代码可以在仓库直接看:<https://github.com/IHUI-INF-AI/IHUI-AI>

---

## 八、何时不要上 8 端 Monorepo

- 团队 < 5 人,且短期不会做全端。
- 8 端之间业务逻辑差异 > 70%(共享价值低)。
- 有强合规要求(如金融、医疗)需要端独立审计。

满足以上任一条,建议拆成多仓库 + npm 包共享。

---

**相关链接**

- 项目仓库:<https://github.com/IHUI-INF-AI/IHUI-AI>
- 官网:<https://ihui.ai>
- Turborepo 文档:<https://turbo.build/repo/docs>

如果这篇架构文章对你有启发,欢迎到 GitHub 给 IHUI-AI 点个 Star ⭐,也欢迎来官网看 8 端实际跑起来的样子。

---

**SEO 关键词**:`多端架构`、`Monorepo`、`Turborepo`、`同源代码`、`跨端开发`、`8 端`、`pnpm workspace`、`共享包`
