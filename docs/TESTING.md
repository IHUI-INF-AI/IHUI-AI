# 测试策略(Testing Strategy)

> IHUI-AI 全栈测试分层、运行命令、编写模板与 CI 集成。测试架构总览见 [architecture.md §7](./architecture.md),贡献规范见 [CONTRIBUTING.md §6](./CONTRIBUTING.md#6-测试要求)。

---

## 1. 测试分层总览

| 层级 | 框架 | 位置 | 目的 | 运行频率 |
|---|---|---|---|---|
| 单元测试 | Vitest 2 | `apps/api/tests/`、`packages/*/tests/` | 验证函数 / 路由 / 工具逻辑(mock DB) | 每次提交 |
| 集成测试 | Vitest 2(真实 DB) | `apps/api/tests/**/*.real.test.ts` | 验证 SQL 查询 / 迁移 / 真实 PG 行为 | 本地按需 / CI 可选 |
| E2E 测试 | Playwright | `apps/web/e2e/*.spec.ts` | 验证用户完整流程(登录 → 操作 → 结果) | 改 web 时触发 |
| 视觉回归 | Playwright | `apps/web/tests/visual/*.spec.ts` | 断言 DOM 数值 / 布局对齐(不靠截图主观判断) | 改 UI 时触发 |
| AI 服务测试 | pytest | `apps/ai-service/tests/` | 验证 LangGraph 工作流 / LLM 网关 / MCP / RAG | 每次提交 |
| CLI 测试 | Vitest 2 | `apps/cli/tests/` | 验证命令行工具 / 插件 / 上下文管理 | 每次提交 |
| 压力测试 | Locust | `scripts/locustfile.py` | 验证核心端点 SLA / 并发承载 | 发版前 / 按需 |
| 性能预算 | Lighthouse CI | `apps/web/lighthouserc.json` | 验证前端首屏 / CLS / LCP / TBT 指标 | 改 web 时按需 |

```
金字塔从底到顶:

     ┌─────────┐
     │  压测    │  Locust(4 类端点 / 100 并发)
     ├─────────┤
     │  E2E    │  Playwright(16+ spec,真实浏览器)
     ├─────────┤
     │  视觉    │  Playwright(DOM 数值断言,非截图)
     ├─────────┤
     │  集成    │  Vitest real(真实 PG,串行)
     ├─────────┤
     │  单元    │  Vitest + pytest(mock,并行,量大)
     └─────────┘
```

---

## 2. 后端测试(apps/api)

### 2.1 概况

| 项 | 值 |
|---|---|
| 位置 | `apps/api/tests/` |
| 文件数 | 38+ 个 `*.test.ts` |
| 框架 | Vitest 2 |
| 配置(默认) | `apps/api/vitest.config.ts`(mock 模式) |
| 配置(真实 DB) | `apps/api/vitest.real.config.ts`(集成模式) |
| 运行命令 | `pnpm --filter @ihui/api test` |
| 真实 DB 命令 | `pnpm --filter @ihui/api test:real` |
| 超时 | 15s(testTimeout / hookTimeout) |
| 重试 | 全局 2 次(容忍并发资源争抢偶发失败) |

### 2.2 两套配置的区别

| 配置 | `vitest.config.ts`(默认) | `vitest.real.config.ts`(真实 DB) |
|---|---|---|
| setup | `tests/setup-env.ts` | `tests/setup-env.ts` + `tests/setup-real-db.ts` |
| 包含 | `tests/**/*.test.ts` + `src/{routes,services,jobs}/__tests__/**/*.test.ts` | `tests/**/*.real.test.ts` + `src/routes/__tests__/**/*.real.test.ts` |
| 排除 | `*.real.test.ts` | 无(只跑 real) |
| DB 连接 | mock,不连真实 DB | 连 `ihui_test` 库 |
| 并行 | `fileParallelism: true` | `fileParallelism: false`(串行,避免 DB 竞态) |
| forceExit | 否 | 是(路由代码的 db 连接池不关闭,需强制退出) |
| CI | 默认跑 | 不跑(需本地有 PG) |

### 2.3 setup-env.ts 的作用

`apps/api/tests/setup-env.ts` 在测试启动前:

1. 加载 `.env.test`(指向 `ihui_test` 库,与开发/生产 `.env` 隔离)。
2. 兜底注入测试专用环境变量:
   ```typescript
   process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ihui_test'
   process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters-long!!'
   process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'a'.repeat(32)  // 测试允许弱密钥
   process.env.REDIS_URL ??= 'redis://localhost:6379/1'        // 用 DB 1 隔离
   process.env.NODE_ENV = 'test'
   ```
3. 兼容两种 cwd(`cd apps/api` 或仓库根目录)。

### 2.4 Fastify inject 模式

后端测试**不监听端口**,用 Fastify `server.inject()` 直接发请求到内存中的 server,速度快且不占端口:

```typescript
import { describe, it, expect, afterAll, vi } from 'vitest'
import Fastify from 'fastify'
import { healthRoutes } from '../src/routes/health'

// Mock db 避免真实 DB 连接
vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}))

describe('health route', () => {
  const server = Fastify({ logger: false })
  afterAll(async () => { await server.close() })

  it('GET /api/health 返回 200 与 status ok', async () => {
    await server.register(healthRoutes, { prefix: '/api' })
    await server.ready()

    // inject 不需要监听端口,直接注入 HTTP 请求
    const res = await server.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
  })
})
```

### 2.5 Mock DB 层

- 用 `vi.mock('../src/db/index.js', ...)` 替换 `db` 对象。
- 用 `vi.mock('../src/config/index.js', ...)` 替换 config 避免 env 验证失败。
- 用 `vi.fn().mockResolvedValue(...)` 控制 mock 返回值。
- 真实 DB 测试(`*.real.test.ts`)不 mock,直接连 `ihui_test` 库,每个 `beforeEach` 清理业务表。

---

## 3. AI 服务测试(apps/ai-service)

### 3.1 概况

| 项 | 值 |
|---|---|
| 位置 | `apps/ai-service/tests/` |
| 文件数 | 30+ 个 `test_*.py` |
| 框架 | pytest + pytest-asyncio |
| 配置 | `apps/ai-service/pyproject.toml`(`[tool.pytest.ini_options]`) |
| conftest | `apps/ai-service/tests/conftest.py` |
| 运行命令 | `cd apps/ai-service && uv run pytest` |
| 异步模式 | `asyncio_mode = "auto"` |
| testpaths | `["tests"]` |

### 3.2 conftest.py 关键 fixtures

| fixture | 作用 |
|---|---|
| `client` | httpx `AsyncClient` + ASGITransport,不监听端口直接注入 ASGI app |
| `_isolate_llm_env`(autouse) | 每个测试前清空所有 7 个 settings key + 50+ os.environ vendor key,确保从干净状态开始;mock `_resolve_from_db` 避免 asyncpg 连 DB |
| `_isolate_vector_memory`(autouse) | 清空 vector_memory 单例状态 + 强制内存模式(避免连 Redis 卡住) |

### 3.3 stub 模式隔离

`conftest.py` 的 `_isolate_llm_env` fixture 清空 50+ vendor env key(`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `STEPFUN_API_KEY` 等),确保:

- 测试不会因 `.env` 中的真实 key 意外调用真实 LLM API。
- `_is_stub_mode()` 返回 `True`,走 mock 响应路径。
- 需要真实模式的测试自行 `monkeypatch.setattr` 设置对应 key。

### 3.4 测试覆盖模块

| 测试文件 | 覆盖模块 |
|---|---|
| `test_health.py` | 健康检查端点 |
| `test_jwt_auth.py` | JWT 认证中间件 |
| `test_llm_gateway.py` | LLM 网关 / provider 路由 / stub 降级 |
| `test_providers.py` / `test_local_providers.py` | 17+ provider 适配器 |
| `test_agent_loop.py` / `test_agent_loop_v2.py` | Agent 循环 / 工具调用 |
| `test_agent_orchestrator.py` | Agent 编排器 |
| `test_langgraph_service.py` | LangGraph 工作流 |
| `test_mcp_server.py` | MCP 工具服务 |
| `test_rag.py` | RAG 检索增强 |
| `test_vector_memory.py` | 向量记忆 / 降级内存模式 |
| `test_memory.py` | 记忆系统 |
| `test_a2a_service.py` | A2A(Agent-to-Agent)通信 |
| `test_dag_scheduler.py` | DAG 调度器 |
| `test_compaction.py` | 上下文压缩 |
| `test_schema_check.py` | schema 校验(对真实 DB) |
| `test_business_flow_integration.py` | 业务流程端到端集成 |

---

## 4. 前端 E2E(apps/web)

### 4.1 概况

| 项 | 值 |
|---|---|
| 位置 | `apps/web/e2e/*.spec.ts` |
| spec 数 | 16+ 个 |
| 框架 | Playwright |
| 配置 | `apps/web/playwright.config.ts` |
| 运行命令 | `pnpm --filter @ihui/web e2e` |
| UI 模式 | `pnpm --filter @ihui/web e2e:ui` |
| 浏览器 | chromium(`playwright install chromium`) |
| baseURL | `http://localhost:3001`(可被 `PLAYWRIGHT_BASE_URL` 覆盖) |

### 4.2 playwright.config.ts 关键配置

```typescript
{
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'e2e/**/*.setup.ts', 'tests/visual/**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,        // CI 中禁止 test.only
  retries: process.env.CI ? 2 : 0,     // CI 重试 2 次,本地不重试
  workers: process.env.CI ? 1 : undefined, // CI 单 worker,本地默认
  reporter: 'html',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'setup', testMatch: /.*\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,  // 本地复用已运行的 dev server
    timeout: process.env.CI ? 240000 : 120000,
  },
}
```

### 4.3 auth.setup.ts(登录态复用)

`e2e/auth.setup.ts` 在测试前通过 API 登录(`/api/auth/login`),把 token 写入 storageState 文件:

- `e2e/.auth/user.json` — 普通用户登录态
- `e2e/.auth/admin.json` — 管理员登录态

```bash
# 单独执行 setup
npx playwright test --project=setup
```

### 4.4 fixtures.ts(fixture 扩展)

`e2e/fixtures.ts` 扩展 Playwright `test`,提供两个已登录的 page fixture:

| fixture | 说明 |
|---|---|
| `authenticatedPage` | 用 `user.json` storageState 创建已登录普通用户 page |
| `adminPage` | 用 `admin.json` storageState 创建已登录管理员 page |

- storageState 文件不存在时自动通过 API 登录创建(兜底)。
- 测试用户凭据从环境变量读取(`E2E_USER_EMAIL` / `E2E_USER_PASSWORD` / `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`),提供默认值。
- 现有 spec 直接 `import { test } from '@playwright/test'` 不受影响;新测试可 `import { test, expect } from './fixtures'`。

### 4.5 E2E spec 清单

| spec | 覆盖流程 |
|---|---|
| `smoke.spec.ts` | 冒烟测试(首页 / 登录页 / 关键路由可访问) |
| `auth.spec.ts` | 邮箱注册 / 登录 / 登出 |
| `auth-2fa.spec.ts` | 两步验证流程 |
| `chat.spec.ts` | AI 对话创建 / 发送 / 流式响应 |
| `ai-chat.spec.ts` | AI 聊天高级交互 |
| `ai-world.spec.ts` | AI 世界热度展示 |
| `admin.spec.ts` | 管理后台功能 |
| `community.spec.ts` | 社区帖子 / 互动 |
| `education.spec.ts` | 教育模块 |
| `orders.spec.ts` | 订单流程 |
| `payment.spec.ts` | 支付流程 |
| `plaza.spec.ts` | 广场模块 |
| `pwa.spec.ts` | PWA 安装 / 离线 |
| `security.spec.ts` | 安全特性(CSRF / 速率限制 / XSS 防护) |
| `seo.spec.ts` | SEO 元数据 / sitemap / robots |
| `workspace.spec.ts` | 工作台 |

---

## 5. 视觉回归测试

| 项 | 值 |
|---|---|
| 位置 | `apps/web/tests/visual/*.spec.ts` |
| 框架 | Playwright(与 E2E 共用 `playwright.config.ts`) |
| 运行命令 | `pnpm --filter @ihui/web test:visual`(`--config=playwright.visual.config.ts`) |

### 5.1 断言方式(核心原则)

视觉回归测试**断言 DOM 数值,不靠截图主观判断**:

```typescript
// ✅ 正确:读 DOM 属性 / getComputedStyle 验证样式生效
const groove = page.locator('[data-testid="login-tab-groove"]')
const box = await groove.boundingBox()
expect(Math.abs(box.height - expectedHeight)).toBeLessThanOrEqual(0.5)

const style = await groove.evaluate((el) => getComputedStyle(el).transform)
expect(style).not.toBe('none')

// ❌ 错误:只靠截图主观判断
await expect(page).toHaveScreenshot('login.png')
```

### 5.2 已有视觉 spec

| spec | 验证内容 |
|---|---|
| `login-tabs-groove.spec.ts` | 登录页 tab 凹槽几何尺寸 / 激活态 |
| `model-selector.spec.ts` | 模型选择器布局 |
| `prompt-templates.spec.ts` | 提示词模板布局 |
| `sidebar-height-verify.spec.ts` | 侧边栏高度自适应 |
| `sidebar-history.spec.ts` | 侧边栏历史记录布局 |

> **图标对齐守门**:`apps/web/e2e/icon-text-alignment.spec.ts` 断言中文字体下图标与文字垂直对齐,阈值 `|delta| ≤ 0.15px`(见 [AGENTS.md §4 中文字体对齐](../AGENTS.md))。

---

## 6. 共享包测试

| 包 | 位置 | 框架 | 配置 | 运行命令 |
|---|---|---|---|---|
| `@ihui/auth` | `packages/auth/` | Vitest 2 | `packages/auth/vitest.config.ts` | `pnpm --filter @ihui/auth test` |
| `@ihui/database` | `packages/database/` | Vitest 2 | `packages/database/vitest.config.ts` | `pnpm --filter @ihui/database test` |
| `@ihui/types` | `packages/types/` | Vitest 2 | `packages/types/vitest.config.ts` | `pnpm --filter @ihui/types test` |
| `@ihui/api-client` | `packages/sdk/` | Vitest 2 | `packages/sdk/vitest.config.ts` | `pnpm --filter @ihui/api-client test` |

- 共享包测试随 `pnpm test`(turbo 并行)自动运行。
- `@ihui/auth` 测试覆盖:JWT 签发/验证、OAuth2 流程、WebSocket 认证、token 黑名单。
- `@ihui/database` 测试覆盖:RLS 策略、连接池、schema 导出。

---

## 7. CLI 测试(apps/cli)

| 项 | 值 |
|---|---|
| 位置 | `apps/cli/tests/` |
| 文件数 | 13 个 `*.test.ts` |
| 框架 | Vitest 2 |
| 配置 | `apps/cli/vitest.config.ts` |
| 运行命令 | `pnpm --filter @ihui/cli test` |

| 测试文件 | 覆盖模块 |
|---|---|
| `context.test.ts` | 上下文管理 |
| `git.test.ts` | Git 工具 |
| `hunks.test.ts` | diff hunks 解析 |
| `mcp-sse.test.ts` | MCP SSE 传输 |
| `memory.test.ts` | 记忆系统 |
| `mermaid.test.ts` | Mermaid 图表 |
| `plugins.test.ts` | 插件加载器 |
| `redact.test.ts` | 敏感信息脱敏 |
| `repair.test.ts` | 修复工具 |
| `skills.test.ts` | Skill 系统 |
| `tools.test.ts` | 内置工具集 |
| `updater.test.ts` | 自动更新 |
| `voice.test.ts` | 语音功能 |

---

## 8. 压力测试(Locust)

| 项 | 值 |
|---|---|
| 位置 | `scripts/locustfile.py` |
| 框架 | Locust |
| 覆盖端点 | 4 类(认证 / AI 对话 / 内容浏览 / 文件上传) |
| 性能基线 | 见 [architecture.md §13](./architecture.md) |

```bash
# 本地压测
locust -f scripts/locustfile.py --headless \
    --host http://localhost:3000 \
    --users 100 --spawn-rate 10 --run-time 60s

# CI 注入(环境变量)
LOCUST_HOST=http://localhost:3000 \
LOCUST_TOKEN=<jwt-token> \
LOCUST_USERS=100 \
LOCUST_SPAWN_RATE=10 \
LOCUST_RUN_TIME=60s \
locust -f scripts/locustfile.py --headless
```

| task 权重 | 端点 | 验证点 |
|---|---|---|
| 3 | `GET /api/auth/me` | 鉴权链路 / 响应 < 1s |
| 2 | `GET /api/chat/sessions` | DB + 缓存 |
| 4 | `GET /api/content/list` | 高频读查询性能 |
| 2 | `GET /api/news/list` | 高频读查询性能 |
| 1 | `POST /api/files/upload` | OSS + 限流(重负载) |

---

## 9. 性能预算(Lighthouse CI)

| 项 | 值 |
|---|---|
| 配置 | `apps/web/lighthouserc.json` |
| 目标 URL | `http://localhost:3000`、`/login`、`/dashboard`、`/admin` |
| 运行次数 | 每页 3 次(`numberOfRuns: 3`) |
| preset | `desktop` |

### 9.1 性能预算阈值

| 指标 | 阈值 | 级别 |
|---|---|---|
| Performance 分数 | `>= 0.85` | error |
| Accessibility 分数 | `>= 0.9` | error |
| Best Practices 分数 | `>= 0.85` | warn |
| SEO 分数 | `>= 0.8` | warn |
| PWA 分数 | 不检查 | off |
| FCP(First Contentful Paint) | `<= 2000ms` | error |
| LCP(Largest Contentful Paint) | `<= 2500ms` | error |
| CLS(Cumulative Layout Shift) | `<= 0.1` | error |
| TBT(Total Blocking Time) | `<= 300ms` | warn |
| TTI(Time to Interactive) | `<= 3500ms` | warn |

```bash
# 运行 Lighthouse CI
npx @lhci/cli autorun
```

---

## 10. CI 集成

### 10.1 Workflow 总览

| Workflow | 文件 | 触发条件 | 跑什么 |
|---|---|---|---|
| CI | `.github/workflows/ci.yml` | push / PR 到 `main` / `develop` | typecheck + schema drift + lint + test + build + Python 语法检查 + ai-service schema check |
| E2E | `.github/workflows/e2e.yml` | push / PR 到 `main` / `develop`(改 `apps/web/**` / `apps/api/**` / `packages/**`) | Playwright E2E(production build + start server) |
| Build Docker | `.github/workflows/build.yml` | push 到 `main` / tag `v*` | 构建 api / web / ai-service 三个 Docker 镜像 |
| Knip | `.github/workflows/knip.yml` | push / PR 到 `main` / `develop`(改 `apps/**` / `packages/**` / `package.json` / `knip.jsonc`) | 死代码扫描 |

### 10.2 CI workflow 详解(`ci.yml`)

**Job 1: `lint-typecheck-test`**

```yaml
步骤:
  1. pnpm install --frozen-lockfile
  2. pnpm --filter @ihui/database build      # 先建共享包
  3. pnpm --filter @ihui/auth build
  4. pnpm --filter @ihui/api-client build
  5. pnpm turbo run typecheck                # 全包类型检查
  6. node scripts/check-db-schema-drift.mjs  # schema drift
  7. pnpm turbo run lint                     # 全包 lint
  8. pnpm turbo run test                     # 全包测试
  9. pnpm turbo run build                    # 全包构建
```

**Job 2: `python-ai-service`**

```yaml
工作目录: apps/ai-service
步骤:
  1. Setup Python 3.12
  2. pip install uv
  3. uv pip install --system -e ".[dev]"  (continue-on-error: true)
  4. Python 语法检查(ast.parse 扫描 app/ 所有 .py)
```

**Job 3: `ai-service-schema-check`**

```yaml
services: postgres:17(ihui_test 库)
步骤:
  1. pnpm install
  2. pnpm --filter @ihui/database build
  3. pnpm --filter @ihui/api-client build
  4. cd packages/database && npx drizzle-kit push  # 推 schema 到测试库
  5. uv pip install --system -e ".[dev]"
  6. python -m app.core.schema_check               # 校验表存在 + 字段齐全
```

### 10.3 E2E workflow 详解(`e2e.yml`)

```yaml
services: postgres:15(ihui/ihui_test) + redis:7
步骤:
  1. pnpm install --frozen-lockfile
  2. pnpm exec playwright install --with-deps chromium
  3. pnpm --filter @ihui/api run build
  4. pnpm --filter @ihui/web run build        # production build
  5. drizzle-kit migrate                      # 迁移到 ihui_test
  6. 启动 api(node dist/index.js,后台,curl /health 验证)
  7. 启动 web(pnpm start,后台,curl 验证)
  8. pnpm exec playwright test                # 跑 E2E
  9. 上传 playwright-report + test-results artifact
```

---

## 11. 测试命名约定

| 类型 | 命名模式 | 示例 |
|---|---|---|
| 后端单元 | `<模块>.test.ts` | `auth.test.ts`、`health.test.ts` |
| 后端集成(真实 DB) | `<模块>.real.test.ts` | `users.real.test.ts` |
| 前端 E2E | `<流程>.spec.ts` | `auth.spec.ts`、`chat.spec.ts` |
| 视觉回归 | `<组件>-<验证点>.spec.ts` | `login-tabs-groove.spec.ts` |
| 登录 setup | `auth.setup.ts` | 固定文件名 |
| AI 服务 | `test_<模块>.py` | `test_health.py`、`test_rag.py` |
| CLI | `<模块>.test.ts` | `git.test.ts`、`skills.test.ts` |

- describe / it 用中文:`describe('健康检查路由')` + `it('GET /api/health 返回 200')`。
- pytest 用英文函数名 + docstring:`def test_health_endpoint():  """健康检查端点返回 200。"""`。

---

## 12. 覆盖率

| 端 | 工具 | 当前状态 |
|---|---|---|
| apps/api | Vitest(内置 coverage) | 未强制阈值,建议行覆盖率 ≥ 70%,关键路径 ≥ 90% |
| apps/ai-service | pytest-cov | 未强制阈值 |
| apps/web | Vitest + Playwright | 未强制阈值 |
| 共享包 | Vitest | 未强制阈值 |

```bash
# 后端覆盖率报告
pnpm --filter @ihui/api test -- --coverage

# AI 服务覆盖率报告
cd apps/ai-service && uv run pytest --cov=app --cov-report=html
```

> **建议方向**:逐步引入覆盖率阈值(pre-commit / CI 卡控),优先覆盖认证 / 支付 / 数据迁移等关键路径。

---

## 13. 编写新测试模板

### 13.1 后端 Fastify inject 模板

```typescript
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { myRoutes } from '../src/routes/my-route'

// 1. Mock DB 层(单元测试不连真实 DB)
vi.mock('../src/db/index.js', () => ({
  db: {
    query: {
      myTable: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, name: '测试' }]),
        findFirst: vi.fn().mockResolvedValue({ id: 1, name: '测试' }),
      },
    },
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}))

// 2. Mock config(避免 env 验证失败)
vi.mock('../src/config/index.js', () => ({
  config: {
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-secret-at-least-32-characters-long!!',
  },
}))

describe('my-route 模块', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(myRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /api/my-route 返回列表', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/my-route' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('测试')
  })

  it('POST /api/my-route 创建成功', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/my-route',
      payload: { name: '新条目' },
    })
    expect(res.statusCode).toBe(201)
  })
})
```

### 13.2 前端 Playwright 模板

```typescript
import { test, expect } from './fixtures'  // 用 authenticatedPage fixture

test.describe('我的功能模块', () => {
  test('已登录用户可以看到列表', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard')

    // 等待列表渲染
    const items = authenticatedPage.locator('[data-testid="list-item"]')
    await expect(items).toHaveCount(5, { timeout: 10000 })

    // 断言文本内容
    await expect(items.first()).toContainText('测试')
  })

  test('创建新条目', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/dashboard')

    await authenticatedPage
      .getByRole('button', { name: /新建/ })
      .click()

    await authenticatedPage
      .getByLabel('名称')
      .fill('端到端测试条目')

    await authenticatedPage
      .getByRole('button', { name: /保存/ })
      .click()

    // 验证 toast 成功提示
    await expect(authenticatedPage.getByText('创建成功')).toBeVisible({ timeout: 5000 })
  })
})
```

### 13.3 AI 服务 pytest 模板

```python
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    """健康检查端点返回 200。"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_llm_stub_mode(client: AsyncClient, monkeypatch):
    """stub 模式返回模拟响应(conftest 已自动隔离 env)。"""
    response = await client.post(
        "/api/v1/chat/completions",
        json={"model": "stepfun/step-3.7-flash", "messages": [{"role": "user", "content": "你好"}]},
    )
    assert response.status_code == 200
    # stub 模式返回固定模拟文本
    assert "choices" in response.json()
```
