---
title: "8 端同源架构:一个 TypeScript Monorepo 如何同时输出 Web/API/CLI/Desktop/Extension/Mobile/Miniapp"
date: "2026-07-26"
tags: ["AI", "LLM", "TypeScript", "Monorepo", "开源"]
category: "AI 工程"
description: "用 pnpm workspace + Turborepo 在一个仓库里同时交付 8 个端,IHUI AI 实战分享 340 表 / 144 迁移 / 1300+ API 的同源架构设计。"
---

# 8 端同源架构:一个 TypeScript Monorepo 如何同时输出 Web/API/CLI/Desktop/Extension/Mobile/Miniapp

> "我们要做一个 AI 应用,先上 Web,再做小程序,然后是桌面端和浏览器插件……"——产品经理的话还没说完,前端lead 已经开始头疼了。8 个端,8 套代码,8 倍工作量?

本文是 IHUI AI 项目(开源 8 端全栈 AI 操作系统)在落地「8 端同源」架构时的真实工程总结。你会看到:一个 TypeScript Monorepo 如何同时输出 8 个端、共享什么、不共享什么、跨端契约如何对齐,以及实战数据(340 表 / 144 迁移 / 1300+ API / 5346 测试)。

---

## 一、痛点:AI 应用的「端碎片化」灾难

做 AI 应用,你大概率会遇到这些场景:

1. **Web 端先上**:Next.js + React 写一个聊天页面
2. **老板要小程序**:再开一个 Taro 工程,API client 重写一遍
3. **用户要桌面端**:Electron 包一下,但类型定义又复制了一份
4. **运营要浏览器插件**:Chrome Extension MV3,又是一套
5. **CTO 要 CLI**:`npx ihui` 调用 API,再写一遍 SDK
6. **投资人要 Mobile**:React Native,从头再来
7. **API 后端**:Fastify + Drizzle,和前端类型只能手工同步

**结果**:同一个 `User` 类型在 8 个端有 8 份定义,字段一改全端爆炸;同一个 API 调用在 8 个端写 8 遍,bug 修 8 次;同一个 UI 组件(按钮/对话框/消息气泡)在 5 个端各实现一次,设计稿一变全端追改。

这不是工程能力问题,是**架构问题**:你把 8 个端当 8 个独立项目做了。

---

## 二、方案:pnpm workspace + Turborepo + 共享 packages

IHUI AI 的解法是 **「8 端同源 Monorepo」**:所有端共享同一套 `packages/`,只在自己 `apps/<端名>/` 下写端特有代码。

### 2.1 仓库结构

```
IHUI-AI/
├── apps/
│   ├── web/              # Next.js 15 + React 19 + Tailwind 4
│   ├── api/              # Fastify 5 + Drizzle ORM 0.38
│   ├── ai-service/       # FastAPI + LangGraph + LiteLLM
│   ├── cli/              # Commander 封装,发布到 npm
│   ├── desktop/          # Electron + 复用 web 构建
│   ├── extension/        # Chrome MV3
│   ├── mobile-rn/        # React Native
│   └── miniapp-taro/     # Taro 4 + React(微信/支付宝/抖音多端)
├── packages/
│   ├── types/            # 全端共享 TypeScript 类型(单一真相)
│   ├── database/         # Drizzle schema + 迁移(340 表 / 144 迁移)
│   ├── auth/             # authenticate 函数,前后端共用
│   ├── ui/               # shadcn/ui 封装,web/RN/miniapp 复用
│   ├── config/           # ESLint / TSConfig / Tailwind preset
│   ├── eslint-config/    # 统一 lint 规则
│   └── tsconfig/         # 统一 tsconfig 基线
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### 2.2 三个关键设计决策

**决策 1:类型是「单一真相」,代码反向依赖类型,而不是反过来。**

`packages/types` 是整个 monorepo 的契约层。`apps/api` 的路由参数、`apps/web` 的 API client、`apps/cli` 的命令选项,全部从 `@ihui/types` 导入。改一个字段,8 个端 typecheck 立刻报错,不存在「前端忘了同步」。

**决策 2:数据库 schema 独立成包,API 和 AI 服务共用。**

`packages/database` 用 Drizzle ORM 定义 340 张表的 schema,生成迁移文件。`apps/api` 直接 import schema 操作数据库,`apps/ai-service`(Python)通过 OpenAPI 桥接消费同一份契约。这就避免了「后端改了字段,AI 服务还用旧 schema」的经典漂移。

**决策 3:UI 组件分层:`packages/ui` 放逻辑,各端适配器放样式。**

shadcn/ui 基于 Radix + Tailwind,本身就是「逻辑 + 样式」分层。我们在 `packages/ui` 暴露 `<Button>`,`apps/web` 直接用,`apps/miniapp-taro` 用 Taro 适配器重写样式但保留 props 接口,`apps/mobile-rn` 用 RN 适配器。**API 一致,样式各端自治。**

---

## 三、技术细节:8 端如何共享

### 3.1 共享类型定义

`packages/types/src/chat.ts`:

```typescript
export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  model?: string;
  createdAt: string; // ISO 8601,全端统一
  tokens?: { input: number; output: number };
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;          // 176 模型任选
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatCompletionResponse {
  message: ChatMessage;
  usage: { inputTokens: number; outputTokens: number; cost: number };
  finishReason: 'stop' | 'length' | 'tool_calls';
}
```

`apps/api` 路由直接消费:

```typescript
// apps/api/src/routes/chat.ts
import type { ChatCompletionRequest, ChatCompletionResponse } from '@ihui/types';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string(),
  })),
  model: z.string(),
  stream: z.boolean().default(false),
}) satisfies z.ZodType<ChatCompletionRequest>;

export default async function (app: FastifyInstance) {
  app.post('/chat/completions', {
    preHandler: app.authenticate, // 共享 auth 包
  }, async (req, reply): Promise<ChatCompletionResponse> => {
    const body = chatSchema.parse(req.body);
    // ... 调用 ai-service
  });
}
```

`apps/web` 的 API client:

```typescript
// apps/web/src/lib/api-client.ts
import type { ChatCompletionRequest, ChatCompletionResponse } from '@ihui/types';

export async function chatComplete(
  req: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  const res = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

`apps/cli` 也用同一份类型:

```typescript
// apps/cli/src/commands/chat.ts
import type { ChatCompletionRequest } from '@ihui/types';
import { program } from 'commander';

program
  .command('chat')
  .option('-m, --model <model>', '模型 ID', 'gpt-4o-mini')
  .option('-s, --stream', '流式输出', true)
  .action(async (opts) => {
    const req: ChatCompletionRequest = {
      messages: [{ role: 'user', content: '你好' }],
      model: opts.model,
      stream: opts.stream,
    };
    // 调用 API
  });
```

**关键收益**:改 `ChatMessage` 加一个字段,8 个端 typecheck 同时报警,5 分钟内全端同步。

### 3.2 共享 UI 组件

`packages/ui/src/button.tsx`:

```tsx
import { ButtonHTMLAttributes, forwardRef } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`ihui-btn ihui-btn-${variant} ihui-btn-${size} ${className}`}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
```

`apps/miniapp-taro` 适配层只需覆盖样式:

```tsx
// apps/miniapp-taro/src/adapters/Button.tsx
import { Button as TaroButton } from '@tarojs/components';
import type { ButtonProps } from '@ihui/ui';

export function Button({ variant = 'default', children, ...props }: ButtonProps) {
  return (
    <TaroButton
      className={`ihui-btn ihui-btn-${variant}`}
      {...props}
    >
      {children}
    </TaroButton>
  );
}
```

**API 完全一致,业务代码无需改动**。运营把 Web 聊天页搬到小程序,只需要换 import 路径。

### 3.3 共享 API client(`packages/sdk`)

`packages/sdk/src/index.ts` 暴露统一 client,8 个端都通过它访问 API,自动处理鉴权、重试、错误格式:

```typescript
import type { ChatCompletionRequest } from '@ihui/types';

export class IHUIClient {
  constructor(
    private baseUrl: string,
    private getToken: () => string | null,
  ) {}

  async chat(req: ChatCompletionRequest) {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}/api/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(req),
    });
    if (res.status === 401) throw new AuthError('未登录');
    if (!res.ok) throw new APIError(await res.text());
    return res.json();
  }
}
```

Web 端注入 cookie token,CLI 端注入配置文件里的 API key,Mobile 端注入 SecureStorage token——**业务代码完全相同**。

### 3.4 数据库 schema 共享

`packages/database/src/schema/users.ts`:

```typescript
import { pgTable, uuid, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  nickname: varchar('nickname', { length: 100 }),
  roleId: uuid('role_id').notNull().default('00000000-...-user'),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;      // 全端共享
export type NewUser = typeof users.$inferInsert;
```

API、CLI、桌面端、扩展、移动端全部 import 同一份 `User` 类型,数据库字段一改,全端立刻知道。

---

## 四、跨端契约对齐:不能只靠 typecheck

光有类型还不够。IHUI AI 用 4 道防线保证跨端连通:

### 防线 1:OpenAPI 自动生成

API 路由用 `zod` 定义 schema,启动时自动生成 OpenAPI 文档。CLI / SDK / Mobile 用 `openapi-typescript` 生成类型,保证客户端和服务端契约一致。

### 防线 2:守门脚本 `check-multi-end-sync.mjs`

pre-commit 钩子里有个脚本检测 staged 改动:如果只改了一个端但没动 `packages/*`,会 warn 提醒——「你是不是漏了同步其他端?」。

```bash
$ git commit -m "feat: 添加收藏功能"
⚠️  multi-end-sync: 触及 apps/web 但未触及 packages/*,请确认是否需要同步其他端
```

### 防线 3:全端 typecheck + build + test

`pnpm turbo build typecheck lint test` 一条命令跑全 8 端,任何一个端挂掉就 fail。CI 里这条是硬门禁。

### 防线 4:跨端 E2E

关键链路(注册 → 登录 → 对话 → 付费)有跨端 E2E:Web + API + AI-service 一起跑,确保整条链路通。

---

## 五、IHUI AI 实战数据

这套架构不是 PPT,IHUI AI 仓库真实数据:

| 指标 | 数值 |
| --- | --- |
| 数据库表数量 | **340 张** |
| 数据库迁移文件 | **144 个** |
| API 路由数量 | **1300+ 个** |
| 测试用例数量 | **5346 个** |
| 共享 packages | 7 个(types/database/auth/ui/config/eslint-config/tsconfig) |
| 输出端数量 | **8 个**(Web/API/CLI/Desktop/Extension/Mobile/Miniapp/AI-service) |
| 单一类型定义覆盖率 | **100%**(所有端 import `@ihui/types`) |

**真实案例**:有一次我们给 `ChatMessage` 加 `tokens` 字段统计 token 消耗。改了 `packages/types`,8 个端 typecheck 立刻报 14 处错误,5 分钟内全部修复。如果用 8 个独立仓库,这种改动至少要 2 天协调 + 上线 + 回滚。

---

## 六、什么时候不要用 8 端同源

诚实地讲,这套架构有成本:

1. **团队 < 3 人,只做 1-2 个端**:不需要 monorepo,单仓库更快。
2. **端之间技术栈差异巨大**:比如一个用 Rust 一个用 Swift,共享收益很低。
3. **没有强制 typecheck 习惯**:类型一旦不全端同步,反而更乱。

我们之所以上这套架构,是因为 IHUI AI 一开始就定位「8 端全栈 AI 操作系统」,从第一天就知道要做 8 个端。**早投入早受益**,到第 5 个端再迁移 monorepo,成本是现在的 10 倍。

---

## 七、结语

8 端同源的核心不是「8 个端塞进一个仓库」,而是:

- **类型同源**:一份类型,8 端共享,改一处全端报警。
- **schema 同源**:一份 Drizzle schema,后端 AI 服务共用。
- **UI 同源**:`packages/ui` 暴露 API,各端写样式适配器。
- **SDK 同源**:一份 client,各端注入鉴权。

这套架构让 IHUI AI 在 6 个月内独立交付 8 个端、340 表、1300+ API、5346 测试——单人能做完的核心原因,不是因为我特别能卷,而是因为**架构让我每次改动都自动同步到 8 个端**。

如果你也在做多端 AI 应用,强烈建议从第一天就用 monorepo + 共享 packages。晚了成本指数级上升。

---

## 关于 IHUI AI

IHUI AI 是一站式 8 端全栈 AI 操作系统,Apache 2.0 开源。

- 🌐 官网:https://aizhs.top
- 💻 GitHub:https://github.com/IHUI-INF-AI/IHUI-AI(Star 支持一下 ⭐)
- 📦 8 端同源:Web / API / CLI / Desktop / Extension / Mobile / Miniapp
- 🤖 176 模型:OpenAI / Claude / Gemini / 通义 / DeepSeek / 智谱 / 文心 / 豆包 / Kimi / Ollama
- 💰 定价:Free / Pro ¥49/月 / Team ¥199/人/月 / Enterprise ¥2999/月起

**5 分钟 Fork 到上线,替代 ChatGPT Team + Claude Code + Notion AI,月省 $60+。**
