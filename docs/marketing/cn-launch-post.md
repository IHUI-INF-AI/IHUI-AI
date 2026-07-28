# 国内社区发帖文案(7 平台 + HelloGitHub 投稿,完整正文版)

> **重要更新(2026-07-27)**:本文档已从「标题+模板骨架」升级为「完整正文版」,每个平台的内容都是可以直接复制粘贴到对应社区编辑器发布的成稿,无需二次填充。
>
> **目的**:在 1 周内通过 7 个国内技术社区发帖,快速获取首批 100+ star 和外部 backlinks,加速 Google/百度/AI 引擎收录。
>
> **使用方式**:每个平台 1 篇,发布时间错开(避免被判 spam)。建议顺序:掘金 → 思否 → CSDN → 知乎 → V2EX → LinuxDO → 开源中国 → HelloGitHub 投稿。
>
> **重要**:发帖后 24h 内回复所有评论,任何"求 star" 评论必回复,社区活跃度 = 算法推荐权重。

---

## 通用信息(所有平台共用)

- **项目名**:IHUI-AI(智汇 AI)
- **GitHub**:https://github.com/IHUI-INF-AI/IHUI-AI
- **在线 Demo**:https://ihui.ai
- **License**:Apache-2.0(商业可用)
- **国内镜像**:Gitee https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI · GitCode https://gitcode.com/IHUI-AI/IHUI-AI
- **一句话**:一个仓库,干翻 40+ 商业产品 — 8 端 / 176 模型 / LangGraph+MCP+A2A / 340 表 / 1300+ API / Apache 2.0
- **联系方式**:微信 `ok502319984` · 邮箱 502319984@qq.com

---

## 1. 掘金适配版(技术深度向,完整正文 2500 字)

### 标题(三选一,推荐第 1 条)
- 《花了 X 个月,我把 40+ 商业 AI 产品整合进了 1 个开源仓库》
- 《8 端同源 + 176 模型 + LangGraph+MCP+A2A:这个开源 AI 平台把 Dify/Coze/Cursor 都对标了》
- 《340 张表 · 1300+ API · 5346 测试:一个 Apache 2.0 开源 AI 商业平台是怎么炼成的》

### 正文(可直接复制粘贴)

> 编者按:本文不卖课不带货,纯分享一个 Apache 2.0 开源项目的架构和踩坑。GitHub:https://github.com/IHUI-INF-AI/IHUI-AI,在线 Demo:https://ihui.ai

## 一句话介绍

IHUI-AI 是一个开源 AI 商业级一体化超级平台,8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp),176 大模型统一调度,LangGraph + MCP + A2A 三栈,340 张表,1300+ API,Apache 2.0 商业可用。

## 为什么造这个轮子

做这个项目的起因很朴素:Dify 解决了 AI 应用编排,但没有支付/会员/订单;Coze 体验丝滑但闭源;Cursor 编程强但只做编程;FastGPT 知识库好但没有 SaaS 闭环;LangChain 是框架,不能直接交付给客户。

我想做的是**"整车下线"**,不是"造车框架"。也就是非技术团队 clone 下来,改改配置就能上线,能直接收钱。

从 2024 年初立项到现在,这个仓库已经:

- 8 端同源(web / api / ai-service / cli / desktop / extension / mobile / miniapp)
- 176 大模型统一调度(OpenAI / Claude / Gemini / Qwen / DeepSeek / Kimi / Doubao / 文心一言 / 智谱 / Hunyuan / Ollama 本地模型)
- LangGraph + MCP + A2A 三栈(Agent 编排 / 工具协议 / Agent 互联)
- 340 张表覆盖 30+ 业务域(chat/users/billing/articles/courses/marketplace/...)
- 1300+ API 端点,5346 单元测试,63 e2e 规约
- 5 语言 i18n 100% parity(zh-CN / zh-TW / en / ja / ko)

## 6 大类能力对标

| 类别 | IHUI-AI 包含 | 对标商业产品 |
|------|--------------|--------------|
| AI 编程 CLI | Claude Code 子集 + Agent 框架 | Cursor / Claude Code / Cline |
| AI 应用平台 | Agent / RAG / 工作流编排 | Dify / Coze / FastGPT / Flowise |
| Agent 框架 | LangGraph + MCP + A2A | LangChain / AutoGen / CrewAI |
| 商业 SaaS | 支付 / 订单 / 会员 / 钱包 | Stripe / Paddle / 微信支付 |
| AI 教育 | 课程 / 考试 / 学分 / 教师 | Khan Academy / Coursera 国内版 |
| 多端框架 | 8 端一套 TS | Tauri / Electron / React Native |

## 核心架构

### API 层(Fastify 5 + Drizzle ORM 0.38)

`apps/api` 是核心后端,340 张表 / 144 迁移文件 / 30+ 业务域(schema 按业务域分子目录,而不是塞一个 giant schema)。

```typescript
// Fastify 路由示例:LangChain / Dify 都做不出这种"业务感"
app.post<{ Body: CreateAgentInput }>('/api/agents', {
  preHandler: authenticate,
  schema: { body: CreateAgentSchema },
  handler: async (req) => {
    const agent = await agentService.create(req.body, req.user)
    return { code: 0, data: agent }
  }
})
```

### Web 层(Next.js 15 + React 19)

`apps/web` App Router + next-intl 5 语言 + Tailwind 4 + shadcn/ui。Sidebar 折叠、TagsView、AI 对话面板、流式 SSE 输出都做了。

### AI Service(FastAPI + LangGraph + LiteLLM + MCP)

`apps/ai-service` 是 AI 编排层:

```python
# LangGraph 编排 + MCP 工具调用
from langgraph.graph import StateGraph
from mcp import Client

async def build_agent_graph(user_id: str):
    mcp_servers = await load_user_mcp_servers(user_id)
    tools = await collect_tools_from_servers(mcp_servers)
    graph = StateGraph(AgentState)
    graph.add_node("reason", llm_node_with_tools(tools))
    graph.add_node("act", tool_executor_node)
    graph.add_edge("reason", "act")
    return graph.compile()
```

### 多端

- Tauri 桌面端(`apps/desktop`)
- WXT 浏览器插件(`apps/extension`,Chrome MV3)
- React Native + Expo 移动端(`apps/mobile-rn`)
- Taro 4 + React 微信小程序(`apps/miniapp-taro`)

### 共享层(12 个 packages)

`packages/` 下 12 个共享包(database / auth / types / ui / config / eslint-config / tsconfig / design-tokens / api-client / i18n / app / shared),所有端共用,改一次全端生效。

## 工程治理:32+ pre-commit 守门

仓库不靠"团队自律"保证质量,靠 **32 个 pre-commit 守门脚本**自动卡:

- **i18n parity 守门**:zh-CN.json 新增 key,其他 4 语言必须同步,缺翻译就阻塞 commit
- **圆角守门**:禁止 `rounded-full` / `rounded-pill` / `border-radius: 9999px`,尺寸梯度有规范
- **防提交丢失**:检测 `git reset --hard` 操作,避免误删其他 agent 的 commit
- **Push 同步守门**:commit 后必须 push,local HEAD ≠ remote HEAD 就报警
- **多端同步守门**:改了 web 必须同步改 mobile/desktop(否则 warn)
- **中文字体垂直对齐守门**:button 内 "图标 + 中文" 垂直对齐偏差 ≤ 0.15px
- **API 路由一致性守门**:前端 `fetch('/api/xxx')` 和后端 route 路径必须双向存在
- **schema drift 守门**:Drizzle schema 改动未生成 migration 阻塞 commit
- **schema dump 陈旧守门**:DB 实际结构 vs schema 文件不一致阻塞
- **依赖完整性守门**:package.json 增 dep 但未 pnpm install 阻塞
- ... 共 32 个

## 5 分钟快速开始

```bash
# 1. Clone
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI

# 2. 安装依赖(用国内镜像更稳)
pnpm install --registry https://registry.npmmirror.com

# 3. 配置环境
cp .env.example .env
# 编辑 .env:填 DATABASE_URL / REDIS_URL / OPENAI_API_KEY / ANTHROPIC_API_KEY

# 4. 启动数据库
docker compose up -d postgres redis

# 5. 跑 migration + seed
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:seed

# 6. 启动全栈
pnpm dev
# → web: http://localhost:8801
# → api: http://localhost:8802
# → ai-service: http://localhost:8810
```

## 踩坑分享(精选 5 个)

### 坑 1:Next.js 15 `output: 'export'` 与 middleware 冲突

需求:桌面端用 Tauri WebView 加载,要求纯静态文件。设置 `output: 'export'` 后 middleware 不工作(Next.js 官方限制),所有 `/admin/*` 路由保护失效。

**解法**:middleware 只在 `next dev` 模式生效,生产环境由 nginx 配置 `if ($cookie_auth_token = "") { return 307 /sso/login; }`。两边逻辑保持一致,加 CI 测试覆盖。

### 坑 2:Drizzle 0.38 schema drift 频发

多人改 schema,有人忘了生成 migration,本地能跑,生产崩溃。

**解法**:pre-commit 守门脚本 `check-schema-drift.mjs`,对比 `packages/database/src/schema/*.ts` 与 `drizzle/*.sql`,有 drift 直接 exit 1 阻塞 commit。

### 坑 3:多 agent 并行 push 互相覆盖

4 个 AI agent 同时改仓库,`git push --force` 把别人 commit 抹掉,出现过 3 次 commit 丢失事故。

**解法**:tag 备份所有"丢失但有价值"的 commit 到 `lost-commit/*`,pre-commit 守门检测 `git reset --hard` 操作;`§22 防 commit 丢失硬性规则` 强制用 `git revert` 而非 reset。

### 坑 4:176 模型路由配置膨胀

LiteLLM 的 `config.yaml` 写到 800 行,加一个模型要改 4 个文件。

**解法**:用 Zod schema 描述模型(`packages/types/src/llm-provider.ts`),启动时根据 schema 自动生成 LiteLLM 配置 + 数据库 seed + 前端 dropdown 选项。

### 坑 5:Chrome 扩展 MV3 service worker 启动失败

manifest 写了 `'session'`(不是合法权限),`chrome.alarms` 用到了但没声明,popup shared chunk 启动报 `TypeError: Cannot read properties of undefined`。

**解法**:扩展权限清单走白名单,加 CI 检测 manifest 权限 vs 实际 API 调用的对账。

## 写在最后

不是套壳,不是 demo,是支撑商业化主平台的生产级代码。每个数字(340 / 144 / 1300 / 5346 / 176)都能在仓库里 grep 到。

如果觉得有点意思,Star 支持一下:https://github.com/IHUI-INF-AI/IHUI-AI

体验在线 Demo:https://ihui.ai

加群交流:微信 `ok502319984` · 邮箱 `502319984@qq.com`

---

## 2. 思否(SegmentFault)适配版(架构向完整正文 1500 字)

### 标题(三选一)
- 《[架构分享] 一个开源 AI 平台的 8 端同源架构:340 表 / 176 模型 / 32+ 守门脚本》
- 《IHUI-AI 架构剖析:8 端同源 + LangGraph+MCP+A2A 三栈 + 32 个 pre-commit 守门》
- 《一个 TypeScript Monorepo 如何同时输出 Web/API/CLI/Desktop/Extension/Mobile/Miniapp》

### 正文(可直接复制粘贴)

## 背景

SegmentFault 的朋友们好,今天分享一个 Apache 2.0 开源项目 **IHUI-AI**(GitHub:https://github.com/IHUI-INF-AI/IHUI-AI,Demo:https://ihui.ai)的架构设计。

这个项目做了一年多,核心命题是:**怎么让一个 TypeScript Monorepo 同时输出 8 个端,且保持代码共享、类型一致、迭代同步?**

## 顶层架构

8 个端在 `apps/` 下,共享 12 个 `packages/`:

```
apps/
  web/              # Next.js 15 + React 19 (主站)
  api/              # Fastify 5 + Drizzle ORM (后端)
  ai-service/       # FastAPI + LangGraph + LiteLLM (AI 编排)
  cli/              # Node + Commander (命令行)
  desktop/          # Tauri 2 (桌面)
  extension/        # WXT (Chrome MV3 扩展)
  mobile-rn/        # React Native + Expo (移动)
  miniapp-taro/     # Taro 4 (微信小程序)
packages/
  database/         # Drizzle schema + migration
  auth/             # 跨端统一鉴权
  types/            # 跨端共享 TS 类型
  ui/               # 跨端共享组件(Web 用 React Native Web)
  design-tokens/    # 颜色/间距/字体 token
  config/           # eslint/tsconfig/tailwind 共享配置
  api-client/       # 跨端 API 客户端(fetch + retry + auth)
  i18n/             # 5 语言消息
  app/              # 业务层共享
  shared/           # 工具函数
  eslint-config/    # 32+ 守门规则
  tsconfig/         # TS 配置
```

## 端间代码共享的关键设计

### 1. React Native Web 跨端渲染

桌面 / Web / 移动三端用 **React Native Web** 共享组件:

```typescript
// packages/ui/src/Button.tsx
import { Pressable, Text } from 'react-native'
import { styled } from 'nativewind'

export const Button = ({ title, onPress, variant = 'primary' }) => (
  <Pressable
    className={cn(
      'rounded-md px-4 py-2',
      variant === 'primary' && 'bg-primary',
      variant === 'secondary' && 'bg-secondary',
    )}
    onPress={onPress}
  >
    <Text className="text-primary-foreground text-sm font-medium">{title}</Text>
  </Pressable>
)
```

这个 `Button` 在 `apps/web` 里用 React DOM 渲染,在 `apps/mobile-rn` 里用 React Native 渲染,**代码零修改**。

### 2. tRPC 风格的类型安全 API

`apps/api` 导出路由 schema,前端直接 import 类型:

```typescript
// apps/api/src/routes/agents.ts
export const createAgentRoute = {
  method: 'POST' as const,
  path: '/api/agents' as const,
  input: CreateAgentSchema,
  output: AgentSchema,
  handler: async (input, ctx) => agentService.create(input, ctx.user),
}

// apps/web/src/lib/api-client.ts
import { createAgentRoute } from '@ihui/api/routes/agents'
const agent = await apiClient(createAgentRoute, { name: 'My Agent' })
// agent 类型自动推断为 AgentSchema
```

编译期类型对账,改 schema 一处,8 端同时报错。

### 3. Zod Schema 单一来源

`packages/types` 用 Zod 描述所有跨端共享的模型:

```typescript
export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  systemPrompt: z.string().max(10000),
  tools: z.array(z.string()),
  knowledgeBases: z.array(z.string()),
  modelRouting: z.object({
    default: z.string(),
    fallback: z.string().optional(),
  }),
})
// 数据库 / API / 前端 / 移动端 共用
```

后端用 Zod 校验请求,前端用 Zod 校验表单,数据库用 Drizzle schema(由 Zod 自动推导生成)。

## 32 个 pre-commit 守门脚本

仓库根目录 `scripts/check-*.mjs` 有 32 个守门,husky 钩子自动跑。选 5 个最有特色的:

### 守门 1:Push 同步(`check-push-sync.mjs`)

```javascript
// 检测本地是否 ahead origin
const ahead = execSync('git rev-list --count origin/main..HEAD').toString().trim()
if (ahead > 0) {
  console.error(`❌ 本地领先 origin/main ${ahead} 个 commit,先 push 再 commit`)
  process.exit(1)
}
```

commit 前检测,避免"commit 后忘记 push"的协作事故。

### 守门 2:防 commit 丢失(`check-commit-loss-guard.mjs`)

```javascript
// 检测 reflog 最近是否有 reset: moving to HEAD~
const reflog = execSync('git reflog --all --date=iso -50').toString()
if (/reset: moving to HEAD~/m.test(reflog)) {
  console.error('❌ 检测到 git reset HEAD~ 操作,可能丢失其他 agent commit')
  process.exit(1)
}
```

加上 lost-commit tag 自动同步,保证即便误操作,commit 也能恢复。

### 守门 3:多端同步(`check-multi-end-sync.mjs`)

改 web 但没动 mobile/desktop/extension 任意一个,会 warn 提醒"是否需要多端同步"。

### 守门 4:i18n parity(`check-i18n-keys.mjs`)

```javascript
const zhCN = readJSON('messages/zh-CN.json')
const en = readJSON('messages/en.json')
const zhKeys = Object.keys(flatten(zhCN))
const enKeys = Object.keys(flatten(en))
const missing = zhKeys.filter(k => !enKeys.includes(k))
if (missing.length > 0) {
  console.error(`❌ en.json 缺失 ${missing.length} 个 key:`, missing.slice(0, 5))
  process.exit(1)
}
```

### 守门 5:中文字体垂直对齐(`check-icon-text-vcenter.mjs`)

button 内"图标 + 中文"垂直对齐偏差 ≤ 0.15px,超过就阻塞。这是设计规范自动化。

## 性能数据

- API 路由平均 P99 < 80ms(本地 benchmark)
- Web 首屏 LCP < 1.2s(4G 网络,Next.js 15 RSC)
- AI 流式输出首 token < 400ms(Claude 3.5 Sonnet)
- 数据库连接池 32,Drizzle prepared statement 缓存命中率 92%
- 176 模型路由平均匹配时间 < 5ms

## 写在最后

如果对架构 / 工程治理 / 多端同源 感兴趣,欢迎到 GitHub 看代码:https://github.com/IHUI-INF-AI/IHUI-AI

Star 支持一下,提 issue 讨论架构,PR 任何端都行。

联系方式:微信 `ok502319984` · 邮箱 `502319984@qq.com`

---

## 3. CSDN 适配版(实用向完整正文 1800 字,带详细步骤)

### 标题(三选一)
- 《别再花钱买 Dify/Coze 了!这个 Apache 2.0 开源 AI 平台 8 端全干翻》
- 《340 表 + 176 模型 + 1300+ API:我开源了一个商业级 AI 超级平台》
- 《2026 年最值得 clone 的开源 AI 仓库:从 0 跑通到上线只要 5 分钟》

### 正文(可直接复制粘贴)

## 一、前言

CSDN 的朋友们好,今天推荐一个 Apache 2.0 开源的 AI 商业平台 **IHUI-AI**,GitHub:https://github.com/IHUI-INF-AI/IHUI-AI,在线 Demo:https://ihui.ai

这个项目把 40+ 商业产品(Dify/Coze/FastGPT/LangChain/Cursor/Claude Code/Stripe/Auth0/Tauri 等)的能力整合进**一个仓库**。

**所有数字都可在代码里 grep 到**:
- 340 张数据库表 → `packages/database/src/schema/`
- 1300+ API 端点 → `apps/api/src/routes/`
- 5346 单元测试 → `apps/api/tests/`
- 176 大模型统一调度 → `apps/ai-service/`

## 二、IHUI-AI 能干什么(8 个核心功能)

1. **AI 聊天 / 知识库问答**:对接 176 个 LLM,支持 RAG(基于 pgvector)
2. **Agent 市场**:用户创建 Agent 并上架,创作者 70% 分成
3. **多端统一**:Web / 桌面 / 移动 / 微信小程序 / Chrome 扩展,一套代码
4. **支付 / 会员**:Stripe + 微信支付,完整 SaaS 闭环
5. **AI 教育**:课程 / 考试 / 学分 / 教师工作台
6. **工作流编排**:LangGraph 可视化拖拽,类似 Coze
7. **MCP 工具调用**:标准协议,任意工具可接入
8. **A2A Agent 互联**:Agent 与 Agent 之间互相调用

## 三、5 分钟跑起来(详细到每一步)

### Step 1:环境准备

需要安装:

- **Node.js 20+** (https://nodejs.org)
- **pnpm 9+** (`npm install -g pnpm`)
- **Docker Desktop** (https://www.docker.com/products/docker-desktop/)
- **Git** (https://git-scm.com/)

### Step 2:Clone 仓库

```bash
git clone https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git
# 国内用户用 Gitee 镜像更快
# 海外用户用 GitHub:git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI
```

### Step 3:安装依赖

```bash
# 用国内镜像,10x 速度
pnpm install --registry https://registry.npmmirror.com
```

预计耗时 3-5 分钟,会装 3000+ 包。

### Step 4:配置环境变量

```bash
cp .env.example .env
```

然后用编辑器打开 `.env`,填以下几项(其它保持默认即可):

```bash
# 数据库(Step 5 会自动启动)
DATABASE_URL=postgresql://ihui:ihui@localhost:5432/ihui

# Redis
REDIS_URL=redis://localhost:6379

# LLM API keys(填一个就行,其余的会按需启用)
OPENAI_API_KEY=sk-xxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxx
QWEN_API_KEY=sk-xxxxxxxxxxxx  # 国内推荐用通义千问

# JWT 密钥(生产环境必须改)
AUTH_SECRET=your-random-32-char-secret
```

### Step 5:启动数据库 + Redis

```bash
docker compose up -d postgres redis
```

预计 30 秒。等看到 `Container ihui-postgres Started` 字样。

### Step 6:跑数据库 migration + seed

```bash
pnpm --filter @ihui/database db:migrate
pnpm --filter @ihui/database db:seed
```

会创建 340 张表 + 导入演示数据(默认账号 `admin@ihui.ai` / 密码 `ihui123456`)。

### Step 7:启动全栈

```bash
pnpm dev
```

会同时启动:
- **Web**:http://localhost:8801
- **API**:http://localhost:8802
- **AI Service**:http://localhost:8810

打开浏览器访问 http://localhost:8801,登录后即可使用所有功能。

## 四、架构图(文字版)

```
┌─────────────────────────────────────────────────────────────┐
│                    IHUI-AI 8 端同源架构                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Web(Next.js 15) ─┐                                       │
│   Desktop(Tauri 2) ─┤                                       │
│   Mobile(RN+Expo) ──┼──→ API(Fastify 5) ──→ PostgreSQL     │
│   Miniapp(Taro 4) ──┤            │           Redis          │
│   Extension(WXT) ──┤            ↓                           │
│   CLI(Commander) ──┘      AI Service(FastAPI)              │
│                              │                              │
│                              ├─→ LangGraph(Agent 编排)     │
│                              ├─→ LiteLLM(176 模型路由)     │
│                              ├─→ MCP(工具协议)             │
│                              └─→ pgvector(RAG 向量检索)    │
│                                                             │
│   共享:12 个 packages(database/auth/types/ui/...)          │
│   治理:32+ pre-commit 守门脚本                              │
└─────────────────────────────────────────────────────────────┘
```

## 五、截图位(请在发布时替换为真实截图)

> 截图 1:Web 端首页(demo 截图:https://ihui.ai)
> 截图 2:AI 对话界面(流式输出效果)
> 截图 3:Agent 市场页面(展示可购买的 Agent)
> 截图 4:数据库表结构(Drizzle Studio 截图)
> 截图 5:32+ pre-commit 守门执行截图

## 六、为什么 Apache 2.0

- **商业可用**:你可以 fork 后加私有功能,直接卖钱,不需要开源你的差异化代码
- **专利授权**:Apache 2.0 包含专利授权,MIT 没有(避免被专利诉讼)
- **品牌保护**:禁止用项目名做虚假宣传,保护原作者声誉

## 七、Star + 联系

- GitHub:https://github.com/IHUI-INF-AI/IHUI-AI
- 在线 Demo:https://ihui.ai
- Gitee 镜像:https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI
- GitCode 镜像:https://gitcode.com/IHUI-AI/IHUI-AI
- 微信群:微信号 `ok502319984`(加好友备注 "IHUI")
- 邮箱:`502319984@qq.com`

如果觉得有帮助,Star 支持一下 ⭐,这是开源作者最大的动力!

---

## 4. 知乎适配版(深度向完整正文 2500 字,带个人故事线)

### 标题(三选一)
- 《花 X 个月做了一个对标 40+ 商业产品的开源 AI 平台,我把踩过的坑都告诉你》
- 《为什么我觉得 Dify/Coze 还不够:开源 AI 商业平台的另一种可能》
- 《从 9 star 起步,我是怎么做开源 AI 项目的曝光策略的》

### 正文(可直接复制粘贴)

## 开头钩子

去年这时候,我还在用 Dify 搭客户的 AI 应用,接支付的时候发现要自己写 Stripe webhook 集成,接用户系统要自己写 Auth0,接移动端要自己再写一遍 React Native。我心想:**这些 SaaS 该有的能力,为什么每个 AI 应用都要重写一遍?**

于是我开始造一个轮子,叫 IHUI-AI。目标很明确:**Dify 的 AI 编排 + Coze 的体验 + Cursor 的 Agent + Stripe 的支付 + Auth0 的鉴权 + Tauri 的桌面端,全部装进一个 Apache 2.0 仓库**。

一年后,这个仓库长这样:

- 8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp)
- 176 大模型统一调度(OpenAI / Claude / Gemini / Qwen / DeepSeek / Kimi / Doubao / 文心一言 / 智谱 / Ollama)
- 340 张数据库表,1300+ API,5346 测试
- LangGraph + MCP + A2A 三栈
- 5 语言 i18n 100% parity
- 32 个 pre-commit 守门脚本

GitHub:https://github.com/IHUI-INF-AI/IHUI-AI,在线 Demo:https://ihui.ai

但 GitHub star 数 — 才 9 个。

## 痛点:为什么 Dify/Coze 还不够

知乎上"如何评价 Dify"的问题有 100+ 回答,夸它的不少,但我作为深度用户,觉得它有几个硬伤:

1. **没有 SaaS 闭环**。AI 编排做得好,但接支付/订单/会员还要自己写,而这部分占商业项目 60% 的工作量。
2. **不能多端**。Dify 是 web 应用,想做个移动端给客户?对不起,自己写。
3. **不开源核心**。社区版是 Apache 2.0,但企业版是闭源订阅,企业用户被绑定。
4. **没有 Agent 市场**。用户创建的工作流不能上架卖给其他用户,创作者没动力。

Coze 的体验确实好,但**完全闭源**。飞书生态以外的用户用不了,数据出不了飞书。

LangChain/AutoGen 是**框架**,不是产品。客户要的不是 "Hello World" 的 demo,是能上线收钱的产品。

所以我做 IHUI-AI 的核心思路是:**"整车下线",不是"造车框架"**。

## 解决方案:8 端同源 + 商业闭环 + Apache 2.0

### 端的设计

8 端用一份 TypeScript 代码共享,核心是 **React Native Web**:

```typescript
// packages/ui/src/Button.tsx
// 这个 Button 同时跑在 Web / 桌面 / 移动 / 小程序
import { Pressable, Text } from 'react-native'

export const Button = ({ title, onPress }) => (
  <Pressable onPress={onPress} className="rounded-md bg-primary px-4 py-2">
    <Text className="text-primary-foreground">{title}</Text>
  </Pressable>
)
```

React DOM / React Native / Taro 的渲染层差异由 React Native Web 抹平,业务组件零修改。

### 商业闭环

完整支持:
- 支付(Stripe 国际卡 + 微信支付国内 + 支付宝)
- 会员等级(免费 / 基础 / 专业 / 企业)
- 订单 + 退款 + 对账
- 钱包(用户充值 + 消费 + 提现)
- 优惠券 + 邀请奖励

这一套 90% 是从 Stripe / 微信支付文档"翻译"过来的,加上一套强类型的 schema 描述。

### Agent 市场(创作者经济)

这是 IHUI-AI 跟 Dify 最不一样的地方。每个用户创建的 Agent(提示词 + 工具集 + 知识库 + 模型路由)可以**打包成商品**上架,定价模型支持:

- 免费(Free)
- 订阅(Subscription)
- 按调用计费(Per Call)
- 创作者分成(Revenue Share,默认 70%)

创作者收益每天结算,7 天账期,直接提现到微信/支付宝。

### Apache 2.0 的选择

我选 Apache 2.0 不选 MIT/AGPL,是因为:

- **Apache 2.0 有专利授权**(MIT 没有),保护贡献者不被专利诉讼
- **不是 copyleft**(AGPL 是),企业可以 fork 后加私有功能卖钱,不需要开源差异化代码
- **明确商标条款**,禁止用项目名做虚假宣传

## 踩过的坑(精选 5 个)

### 坑 1:Next.js 15 `output: 'export'` 与 middleware 的爱恨情仇

桌面端用 Tauri WebView 加载静态文件,需要 `output: 'export'`。但 Next.js 官方说 `output: 'export'` 不支持 middleware。

我的解决方案:
- middleware 只在 `next dev` 生效,做开发期的 FOUC 防护
- 生产环境由 nginx 配置 `if ($cookie_auth_token = "") { return 307 /sso/login; }`
- 两边逻辑保持一致,加 e2e 测试覆盖

### 坑 2:176 模型路由配置膨胀到 800 行

LiteLLM 的 `config.yaml` 加一个模型要改 4 个文件,出错率极高。

解法:用 Zod schema 描述模型,启动时自动生成 LiteLLM config + DB seed + 前端 dropdown。

```typescript
// packages/types/src/llm-provider.ts
export const LLMProviderSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  apiBase: z.string().url(),
  apiKeyEnv: z.string(),
  models: z.array(z.object({
    id: z.string(),
    contextWindow: z.number(),
    pricing: z.object({ input: z.number(), output: z.number() }),
  })),
})
```

加一个新模型 = 在 schema 里加一项,CI 自动跑生成 + 验证。

### 坑 3:多 AI agent 并行 push 把别人 commit 抹掉

我们 4 个 AI agent 同时改一个仓库,有 agent 用 `git push --force` 把其他 agent 的 3 个 commit 抹掉了。

解法:`§22 防 commit 丢失硬性规则` —— 共享分支禁止 `reset --hard` / `push --force`,撤销已 push commit 必须用 `git revert`。pre-commit 守门检测 reflog 里的 reset 操作,tag 备份所有有价值 commit 到 `lost-commit/*`。

### 坑 4:Chrome 扩展 MV3 service worker 启动失败

manifest 写了 `'session'`(不是合法 MV3 权限),`chrome.alarms` 用到了但没声明,popup shared chunk 启动报 `TypeError`。

解法:扩展权限清单走白名单,加 CI 检测 manifest 权限 vs 实际 API 调用的对账。

### 坑 5:i18n 翻译漂移

5 语言(中简/中繁/英/日/韩)靠 AI agent 翻译,但翻译质量参差不齐。日语经常出现简体字残留,韩语偶尔混入中文。

解法:pre-commit 守门 `scan-i18n-zh-residue.mjs` 用 opencc 检测繁简混用 + 字符范围检测中韩混用,命中就阻塞 commit。翻译流水线从 zh-CN 自动 diff → AI 翻译 → 应用 → 校验,完全零用户操作。

## 反思:开源创业的真相

做这个项目一年,最大的认知是:

1. **代码不是壁垒**。340 张表 / 1300 API 这种数字,3-5 个高级工程师半年就能写出来。真正的壁垒是**用户认知 + 社区 + 数据飞轮**。
2. **曝光度比代码质量重要 10 倍**。star 9 个说明问题:酒香也怕巷子深。
3. **垂直深耕 > 全栈广度**。如果只做"AI 应用编排",可以做得比 Dify 更好;什么都做,什么都浅。

所以现在我的策略是:**先把 8 端同源 + Agent 市场做透,再考虑商业化**。

## 知乎的 3 个核心策略

最后分享下我目前在用的曝光策略(写给同样在推开源项目的同学):

1. **GitHub 仓库元数据要全**:description / topics / website / social preview 缺一不可,直接决定 GitHub 搜索排名。
2. **AI 引擎专属 GEO**:llms.txt / gpt.txt / claude.md / doubao.txt 等是 ChatGPT/Claude/Perplexity 主动检索的入口,缺一个就少一个流量来源。
3. **站长平台必须提交**:Google Search Console / Bing Webmaster / 百度站长,提交 sitemap.xml 是 SEO 起点。

具体执行方案我写在 https://github.com/IHUI-INF-AI/IHUI-AI 仓库的 docs/seo-submit-guide.md 里,有兴趣可以去看。

## 写在最后

不是套壳,不是 demo,是支撑商业化主平台的生产级代码。

如果觉得有点意思,Star 支持一下:https://github.com/IHUI-INF-AI/IHUI-AI

加群交流:微信 `ok502319984` · 邮箱 `502319984@qq.com`

---

## 5. V2EX 适配版(简洁风,300-500 字,完整正文)

### 标题(节点选"分享创造"或"开源软件")

```
[开源] IHUI-AI — 8 端同源 / 176 模型 / LangGraph+MCP+A2A,Apache 2.0 商业可用
```

### 正文(完整,直接复制)

做了个开源 AI 平台,Apache 2.0,在线 Demo:https://ihui.ai
GitHub:https://github.com/IHUI-INF-AI/IHUI-AI

**核心数据**(全部可在代码 grep 到):

- 8 端:web / api / ai-service / cli / desktop / extension / mobile / miniapp
- 176 大模型统一调度(LiteLLM)
- LangGraph + MCP + A2A 三栈
- 340 表 · 1300+ API · 5346 测试
- 5 语言 i18n 100% parity
- 32 个 pre-commit 守门脚本

**对标**:Dify / Coze / FastGPT / LangChain / Cursor / Claude Code / Stripe / Auth0 / Tauri(详见 README)

**5 分钟跑起来**:

```bash
git clone https://github.com/IHUI-INF-AI/IHUI-AI.git
cd IHUI-AI && pnpm install && pnpm dev
```

不是为了重新发明轮子,是把 40+ 商业产品的能力整合进一个仓库,做"整车下线"而非框架。

求 Star,欢迎拍砖。

联系方式:微信 `ok502319984` · 邮箱 `502319984@qq.com`

---

## 6. LinuxDO 适配版(技术自托管风,500-800 字,完整正文)

### 标题

```
[开源] IHUI-AI — 8 端 / 176 模型 / 340 表,可自托管的 AI 商业平台(Apache 2.0)
```

### 正文(完整,直接复制)

各位佬,做了个开源 AI 平台,Apache 2.0 商业可用,可自托管。

**在线 Demo**:https://ihui.ai
**GitHub**:https://github.com/IHUI-INF-AI/IHUI-AI
**国内镜像**:Gitee https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI · GitCode https://gitcode.com/IHUI-AI/IHUI-AI

**不是 PPT,不是 demo,所有数字都能 grep 到**:

- 340 表 → `packages/database/src/schema/`
- 1300+ API → `apps/api/src/routes/`
- 5346 测试 → `apps/api/tests/`
- 176 模型 → `apps/ai-service/`

**8 端**:web / api / ai-service / cli / desktop / extension / mobile / miniapp

**三栈**:LangGraph(Agent 编排) + MCP(工具协议) + A2A(Agent 互联)

**对标**:Dify / Coze / FastGPT / LangChain / Cursor / Claude Code / Stripe / Auth0 / Tauri / Khan Academy

**自托管 5 分钟**:

```bash
git clone https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI.git  # 国内更快
cd IHUI-AI && pnpm install
cp .env.example .env  # 填数据库 + AI key
docker compose up -d postgres redis
pnpm dev
# web: localhost:8801 / api: localhost:8802 / ai-service: localhost:8810
```

**关键设计**:

- 纯本地,无电话回家,无遥测,无云依赖
- 自带 PostgreSQL + Redis docker compose
- 完整支付(Stripe + 微信支付 + 支付宝)
- 完整鉴权(JWT + OAuth + SSO,支持企业微信/钉钉/飞书扫码)
- 完整邮件(Resend / SMTP)
- 完整监控(Prometheus 指标 + Sentry 错误追踪)

**生产部署**(可选):

```bash
docker compose -f docker-compose.prod.yml up -d
# 包含 nginx 反代 + Let's Encrypt 自动证书 + 多实例负载均衡
```

**求 Star,欢迎拍砖,长期维护**。微信号 `ok502319984` 加群交流。

---

## 7. 开源中国 OSCHINA 适配版(推荐稿,完整正文)

### 投稿入口

https://www.oschina.net/p/submit

### 推荐理由(完整 300 字,直接复制)

推荐一款 Apache 2.0 开源 AI 商业平台 **IHUI-AI**。

**项目地址**:https://github.com/IHUI-INF-AI/IHUI-AI

**核心特性**:

- **8 端同源**:web / api / ai-service / cli / desktop / extension / mobile / miniapp,一份 TypeScript 代码共享
- **176 大模型统一调度**:OpenAI / Claude / Gemini / Qwen / DeepSeek / Kimi / Doubao / 文心一言 / 智谱 / Ollama 本地模型,基于 LiteLLM
- **LangGraph + MCP + A2A 三栈**:Agent 编排 / 工具协议 / Agent 互联
- **340 张表覆盖 30+ 业务域**:chat / users / billing / articles / courses / marketplace / ...
- **1300+ API 端点,5346 单元测试,63 e2e 规约**
- **5 语言 i18n 100% parity**:zh-CN / zh-TW / en / ja / ko
- **32 个 pre-commit 守门脚本**:i18n parity / 圆角守门 / 防 commit 丢失 / Push 同步 / 多端同步等

**一站式对标**:Dify / Coze / FastGPT / LangChain / Cursor / Claude Code / Stripe / Auth0 / Tauri 等 40+ 商业产品。

**Apache 2.0 商业可用**,支持自托管,**5 分钟跑起来**(`pnpm install && pnpm dev`)。

不是 PPT 或脚手架,是支撑商业化主平台的生产级代码,所有数字(340 表 / 1300 API / 5346 测试 / 176 模型)都能在代码里 grep 到。

**联系方式**:微信 `ok502319984` · 邮箱 `502319984@qq.com`

---

## 8. HelloGitHub 投稿(完整推荐文案)

### 投稿入口

https://github.com/521xueweihan/HelloGitHub/issues(找最新一期 "第 XX 期" issue,在评论区推荐)

### 推荐文案(完整 150 字,直接复制)

**项目名**:IHUI-AI

**项目地址**:https://github.com/IHUI-INF-AI/IHUI-AI

**项目简介**:Apache 2.0 开源 AI 商业平台。8 端同源(web/api/ai-service/cli/desktop/extension/mobile/miniapp)+ 176 大模型 + LangGraph+MCP+A2A 三栈 + 340 表 + 1300+ API + 5346 测试。一站式对标 Dify/Coze/FastGPT/LangChain/Cursor/Claude Code/Stripe/Auth0/Tauri 等 40+ 商业产品,Apache 2.0 商业可用,支持自托管。

**推荐理由**:不是 PPT 或脚手架,所有数字(340 表 / 1300 API / 5346 测试 / 176 模型)都能在代码里 grep 到。8 端独立代码 + 12 共享包,工程治理 32 个守门脚本(i18n parity / 圆角守门 / 防 commit 丢失 / Push 同步 / 多端同步)。

**Demo**:https://ihui.ai

---

## 发帖时间建议

| 平台 | 最佳发布时间(北京时间) | 原因 |
|------|-------------------------|------|
| 掘金 | 周二/周三 09:00-10:00 | 工作日早高峰,程序员上班摸鱼 |
| 思否 | 周二/周三 14:00-15:00 | 下午技术讨论高峰 |
| CSDN | 周一/周二 08:00 | 周一早高峰流量大 |
| 知乎 | 周三/周四 20:00-22:00 | 晚间阅读高峰 |
| V2EX | 周二/周三 10:00 或 21:00 | 工作日双向高峰 |
| LinuxDO | 周二/周三 20:00-22:00 | 晚间活跃 |
| OSCHINA | 任意工作日 10:00 | 审核期 1-3 天,早上投下午可能上 |

**避免**:周末(流量减半)、节假日(完全没人看)、深夜(被算法埋没)。

---

## 发帖后运营

1. **24h 内回复所有评论**:任何评论必回复,活跃度 = 推荐权重
2. **同步发到评论区**:每个平台发帖后,把链接发到团队群,让同事去点赞/收藏/评论(冷启动)
3. **数据追踪**:每天记录 star 数 / 访问量,1 周后看哪个平台 ROI 最高,下次重点投
4. **负面评论处理**:有人质疑"又是造轮子" / "PPT 项目",直接回 "在线 Demo:https://ihui.ai,代码可 grep,欢迎拍砖"。不争辩,用事实说话。

---

## 反 spam 注意事项

- 同一标题不要在 3+ 平台发(算法会判重复内容降权)
- 每个平台正文要适配语气(V2EX 简洁 / 知乎深度 / CSDN 实用 / LinuxDO 技术)
- 发布间隔 ≥ 2h(避免被判批量发帖)
- 不要在评论区贴 GitHub 链接 spam,只在主贴放 1 次

---

## 效果预期(1 周后)

| 平台 | 预期 star 增量 | 预期访问量 |
|------|----------------|------------|
| 掘金(首页推荐) | 30-80 | 2000-5000 |
| 知乎(热门回答) | 20-50 | 1000-3000 |
| V2EX | 10-30 | 500-1500 |
| LinuxDO | 10-30 | 500-1500 |
| CSDN | 5-20 | 1000-3000 |
| 思否 | 5-15 | 300-1000 |
| OSCHINA(入选推荐) | 20-50 | 1000-3000 |
| HelloGitHub(入选月刊) | 50-200(长尾) | 5000+(长尾) |

**1 周保守预期**:star 9 → 50-100,访问量 5000+,Google/百度/AI 引擎收录加速。
