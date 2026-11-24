<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# apps/api — 模块契约

## 1. 这个模块是什么、对外给谁用

`@ihui/api` 是 Fastify 5 后端(端口默认 8802,`src/config/index.ts:18`)。策略表里
`layer: product` / **`exported: false`** / `managed: true` —— 它不是库,任何端都不得 import 它;
跨端唯一通道是它自己注册的 HTTP 路由与 WebSocket。实测 `git grep -l "from '@ihui/api'" HEAD -- apps packages`
= 0 个文件,该边界当前成立。
对外契约是**路由表 + OpenAPI**:`apps/api/openapi.json`(HEAD 里 4,671,776 字节)由
`scripts/export-openapi.ts` 导出,CI 用 `scripts/openapi-check.mjs` + `.github/workflows/openapi-check.yml` 复核。
调用方是 web / 小程序 / RN / 扩展 / cli,以及 Python 侧 ai-service(经内部通道回打)。

## 2. 入口与结构现实

- `src/index.ts`(343 行)启动,`src/server.ts`(641 行)装配:`registerPlugins(server)` → `registerRoutes(server)`
  → 三个直接 `server.register(...)` 的例外(`llmVerifyKeyRoutes` 前缀 `/api/llm`、`downloadsRoutes`
  前缀 `/api/downloads`、`crashReportsRoutes` 前缀 `/api`)。`src/worker-entry.ts` 是队列 worker 入口。
- `src/routes/index.ts`(1370 行)按前缀批量注册;**实测非测试的 route 文件 489 个**
  (`git ls-tree -r --name-only HEAD -- apps/api/src/routes`),admin 面统一挂 `/api/admin`。
- 其余真实目录:`src/db/`(473 个文件 import `@ihui/database`)、`src/services/`、`src/plugins/`(68 个 .ts,
  含 `auth.ts` / `principal.ts` / `rls-context.ts` / `tenant.ts` / `require-permission.ts` 与 `ws-*.ts` 一族)、
  `src/utils/`、`src/jobs/`、`src/queue/`、`src/websocket/`、`src/lifecycle/`。
- 测试两套配置:`vitest.config.ts`(mock,`setupFiles: ./tests/setup-env.ts`)+ `vitest.real.config.ts`(真库串行)。

## 3. 依赖方向与边界

策略表 `requires: packages/database, packages/types, packages/auth, packages/shared,
packages/design-tokens, packages/context-compaction`;`package.json` 的 workspace 依赖与之一一对应。
ORM 是 `drizzle-orm ^0.45.2` + `postgres ^3.4.9`,**schema 与迁移不在本端** —— 住在
`packages/database/src/schema/` 与 `packages/database/drizzle/`(策略表的
`contract_file_patterns` 正是按这两处认契约工件的)。
AGENTS §5 在本端的具体化:响应统一 `{code,message,data}`(`src/utils/response.ts` 的
`success()` / `paginatedSuccess()` / `error()`,schema 见 `src/utils/api-schemas.ts`);请求参数用 Zod,
经 `parseOrThrow()`;鉴权复用 `@ihui/auth`(`plugins/auth.ts` 的 `verifyAccessToken`,不在本端自拼 JWT);
管理员判定只认 `roleId >= 1` 的**唯一读取点**(`plugins/require-permission.ts:38` 注明 O13b-③),
`src/db/rbac-queries.ts:343` 明确"admin 快速放行由调用方处理"。
属主与命中数不得由请求自报:`src/utils/idor-guard.ts` 与 `src/utils/batch-outcome.ts` 是这两条的出口,
由守门 134(批量写计数诚实性)问责。
上游 ai-service 只经 `src/utils/ai-service-fetch.ts` 取 `config.AI_SERVICE_URL`(默认 `http://localhost:8803`)。

## 4. 已知缺口 / 未收口的点

- 测试目录**两个并存**:`apps/api/test/`(17 个文件)与 `apps/api/tests/`(495 个文件),
  `vitest.config.ts` 的 include 同时收它们。不是孤儿,但"哪个是新写的该放哪"没有单一答案。
- 本端 `drizzle-orm` 实为 `^0.45.2`,而 AGENTS §5 仍写"Drizzle ORM 0.38" —— 文档与 manifest 漂移,
  以 manifest 为准。
- 鉴权面公开化必须**显式列举**(AGENTS §5):本端的公开面是逐个导出的 `*PublicRoutes`
  (如 `routes/carousel.ts:11`、`routes/admin-agreements.ts:52`),而"游客可进的详情路由"用正则匹配 ——
  于是**静态子路由必须另列排除表**,现例是 `routes/agents.ts:177` 的 `AGENTS_PROTECTED_STATIC_SEGMENTS`
  (7 段),注释原话:"新增 `/agents/<静态段>` 的 GET 路由时必须同步登记到这里,否则会被当成游客详情放行"。
  已发生过的症状是游客走到依赖 `request.userId` 的 handler ⇒ 500 而不是 401。
  `PUBLIC_PATHS` 那个名单住在 **ai-service**(Python 侧中间件),不在本端 —— 本端代码只在
  `routes/rules.ts:54` 的注释里引用它。
- 未取证:489 个 route 文件是否**全部**被能力闸覆盖(该判据属守门 51,现值跑该门读末行);
  `openapi.json` 与路由表的逐条一致性只由 CI 保证,本文未复跑导出。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
