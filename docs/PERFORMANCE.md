# 性能基线与优化实战(IHUI-AI)

> 本文档聚焦 IHUI-AI 性能基线的**达标路径、压测实操、监控告警、回归检测与问题排查**。
> 性能基线数值(硬件基准表、核心端点 SLA 表、数据库性能基线、压测验收标准、回归监控概述、优化 checklist 条目)见 [architecture.md §13 性能基线](./architecture.md#13-性能基线原-server-docsperformance_baselinemd2026-07-22-整合),本文档不重复,只补充每项的**怎么实现、怎么解读、怎么排查**。
> 工程约束与守门规则见 [AGENTS.md](../AGENTS.md),i18n 详见 [I18N.md](./I18N.md),多端架构详见 [MULTI_END.md](./MULTI_END.md),UI 规范详见 [UI_GUIDELINES.md](./UI_GUIDELINES.md)。

---

## 1. 总览

### 1.1 性能责任分层

| 层级 | 关注指标 | 实现位置 |
|------|---------|---------|
| 前端 | FCP / LCP / CLS / TBT / TTI | `apps/web/next.config.ts`、`apps/web/lighthouserc.json`、`scripts/subset-fonts.py` |
| API | P50 / P95 / P99 / 错误率 / RPS | `apps/api/src/plugins/metrics.ts`、`apps/api/src/plugins/compression.ts` |
| 数据库 | 连接数 / 慢查询 / 缓存命中 / 死锁 / 事务耗时 | `packages/database/src/client.ts`、`apps/api/src/plugins/n1-detector.ts`、`apps/api/src/plugins/slow-sql-killer.ts` |
| AI 服务 | 首 Token 延迟 / 流式吞吐 / 工具调用超时 | `apps/ai-service/app/core/llm_gateway.py`、`apps/ai-service/app/services/langgraph_service.py` |
| WebSocket | 握手延迟 / 连接数 / 心跳频率 | `apps/api/src/plugins/ws-*.ts` |
| 基础设施 | CPU / 内存 / 磁盘 | `monitoring/prometheus/alerts.yml`、`monitoring/grafana/dashboards/` |

### 1.2 性能工作流

```
开发期(typecheck + lint + test)→ 压测(Locust 验收)→ CI 门禁(Lighthouse + Locust)
  → 生产监控(Prometheus + Grafana)→ 告警(Alertmanager)→ 回归检测(每周 ws-loadtest)
```

### 1.3 关键文件速查

| 文件 | 用途 |
|------|------|
| `scripts/locustfile.py` | Locust 压测脚本(4 类核心端点) |
| `apps/web/lighthouserc.json` | Lighthouse CI 性能预算门禁 |
| `scripts/subset-fonts.py` + `scripts/font-subset-chars.txt` | 字体子集化(中文字体体积优化) |
| `apps/api/src/plugins/metrics.ts` | Prometheus 指标收集 + `/metrics` 端点 |
| `apps/api/src/plugins/n1-detector.ts` | N+1 查询检测器 |
| `apps/api/src/plugins/slow-sql-killer.ts` | 慢 SQL 杀手(超时中止) |
| `apps/api/src/plugins/compression.ts` | gzip / brotli 响应压缩 |
| `apps/api/src/plugins/queue.ts` | Redis 限流(多租户配额) |
| `monitoring/prometheus/alerts.yml` | 3 组告警规则(api / ai-service / infrastructure) |
| `monitoring/grafana/dashboards/` | 19 个 Grafana 仪表盘 |
| `.github/workflows/lighthouse-ci.yml` | Lighthouse CI 门禁(每次 PR) |
| `.github/workflows/ws-loadtest.yml` | 每周 WebSocket 压测回归 |

---

## 2. 硬件基准与容量规划

### 2.1 硬件基准表(引用 architecture.md §13)

> 完整硬件基准表见 [architecture.md §13 硬件基准](./architecture.md#硬件基准)。
> 基线规格:API 4C8G / Web 2C4G / PostgreSQL 8C16G(主从 + 连接池 50)/ Redis 2C4G / AI Service 4C8G。

### 2.2 容量计算公式

| 资源 | 计算公式 | 实测参考(1000 并发) |
|------|---------|---------------------|
| API 连接池 | `min(并发用户数 × 0.3, 50)` | 300 连接需求,池 50,依赖排队 |
| Redis 内存 | `(活跃会话数 × 2KB) + (热点缓存键数 × 平均 value 大小)` | 10 万会话 ≈ 200MB |
| PostgreSQL 连接 | `max(API 实例数 × pool_size, 20)` | 2 实例 × 10 = 20,触发读副本分流 |
| AI 服务并发流 | `min(LLM 上游 QPS 限额, CPU 核数 × 4)` | 4C → 16 并发流(超出排队) |
| WebSocket 连接 | `活跃用户数 × 在线率(0.3)` | 1 万用户 × 0.3 = 3000 WS 连接/实例 |

### 2.3 扩容触发阈值

| 指标 | 单实例阈值 | 扩容动作 |
|------|-----------|---------|
| API CPU | >70% 持续 5min | 横向加 API 实例(Nginx upstream) |
| API 内存 | >80% 持续 5min | 检查内存泄漏,加实例 |
| PostgreSQL 连接 | >40 告警 / >48 critical | 加读副本 / 调大 pool |
| Redis 内存 | >70% | 启用 maxmemory-policy LRU |
| AI 服务队列长度 | >50 等待 | 加 AI 实例(受 LLM 上游限额约束) |
| WebSocket 连接 | 单实例 >5000 | 加 WS 实例 + Redis Pub/Sub 广播 |

> **何时迁移到 K8s**:见 [architecture.md §10 何时迁移到 K8s](./architecture.md#何时迁移到-k8s)。当前架构(≤5 服务 / 单 VM)用 Docker Compose 已满足,触发任一条件才评估。

---

## 3. 核心端点 SLA 达标路径

### 3.1 SLA 表(引用 architecture.md §13)

> 完整 SLA 表见 [architecture.md §13 核心端点 SLA](./architecture.md#核心端点-sla)。
> 关键目标:`/api/health` P99 100ms / `/api/auth/me` P99 150ms / `/api/content/list` P99 300ms / `POST /api/chat` SSE 首 Token P99 5s / `POST /api/files/upload` P99 2s / `WS /ws` P99 600ms。

### 3.2 每个端点的达标路径

| 端点 | 达标关键手段 | 实现位置 |
|------|------------|---------|
| `GET /api/health` | 不查 DB,仅返回 `{status: 'ok'}`;Redis 探针异步 | `apps/api/src/routes/health.ts` |
| `GET /api/auth/me` | JWT 解析纯 CPU;user 信息走 Redis 缓存(5min TTL) | `apps/api/src/routes/auth.ts` + `@ihui/auth` |
| `GET /api/content/list` | Redis 缓存(`content:list:{page}:{size}` 5min TTL);分页强制 | `apps/api/src/routes/content.ts` |
| `GET /api/chat/sessions` | 索引 `idx_user_sessions(user_id, updated_at DESC)`;Redis 缓存 | `packages/database/src/schema/chat.ts` |
| `POST /api/chat`(SSE) | LiteLLM `astream` 流式;首 Token 不等完整响应;Redis Pub/Sub 断线重连重放 | `apps/ai-service/app/core/llm_gateway.py` + `apps/ai-service/app/core/sse_buffer.py` |
| `POST /api/files/upload` | OSS 直传(小文件走 API 代理,大文件走预签名 URL);rate-limit 10/min | `apps/api/src/routes/files.ts` + `apps/api/src/plugins/queue.ts` |
| `WS /ws` | JWT 校验纯 CPU;心跳 30s;Redis Pub/Sub 跨实例广播 | `apps/api/src/plugins/ws-*.ts` |

### 3.3 错误率控制

| 端点 | 错误率阈值 | 超阈处理 |
|------|-----------|---------|
| `/api/health` | <0.01% | 宕机即 critical 告警(ApiDown) |
| 鉴权链路 | <0.1% | 401 不计入失败,5xx 计入 |
| 业务列表 | <0.1% | 缓存降级:Redis 不可用时回源 DB |
| AI 对话(SSE) | <1% | LLM 上游 5xx 重试 1 次,失败返回 503 |
| 文件上传 | <0.5% | OSS 5xx 切备用 bucket |
| WebSocket | <0.1% | 客户端自动重连 + 断线重放(sse_buffer) |

---

## 4. 数据库性能优化

### 4.1 数据库性能基线(引用 architecture.md §13)

> 完整基线表见 [architecture.md §13 数据库性能基线](./architecture.md#数据库性能基线)。
> 关键阈值:活跃连接 <20(>40 warning / >48 critical)/ 慢查询 <5/min(>20/min 告警)/ 缓存命中率 >95%(<90% 告警)/ 复制延迟 <1s(>5s 告警)/ 死锁 0(>0 告警)/ 事务平均耗时 <50ms(>200ms 告警)。

### 4.2 索引规范

| 查询模式 | 索引设计 | 示例 |
|---------|---------|------|
| 用户维度列表 | 复合索引 `(user_id, created_at DESC)` | `idx_user_sessions` |
| 多租户过滤 | 复合索引 `(tenant_id, id)` 覆盖行级隔离 | 所有 `tenantId` 表 |
| 软删除过滤 | 部分索引 `WHERE deleted_at IS NULL` | 内容 / 订单表 |
| 唯一约束 | 唯一索引 `(tenant_id, slug)` | content / topic |
| 全文搜索 | GIN 索引 `using gin(to_tsvector(...))` | content 内容搜索 |

**禁止模式**:
- 在 `JSONB` 列上无 GIN 索引直接查询
- 在 `created_at` 单列索引后再 `WHERE user_id = ?`(应改复合索引)
- 索引列上用函数(`WHERE LOWER(email) = ?`)→ 改用表达式索引

### 4.3 连接池配置

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `max` | 10 | 单 API 实例连接池上限(2 实例 = 20,匹配 DB `max_connections`;`packages/database/src/client.ts` 默认值) |
| `idle_timeout` | 30s | 空闲连接回收 |
| `connection_timeout` | 5s | 排队等待上限,超时返回 503 |
| `max_lifetime` | 30min | 防止长连接累积 PostgreSQL 端 prepared statement |

配置位置:`packages/database/src/client.ts`。

### 4.4 N+1 查询检测

**实现**:`apps/api/src/plugins/n1-detector.ts` 在开发环境(`NODE_ENV !== 'production'`)拦截同一请求内对同一表的多次查询,超过阈值(默认 5 次)时打印警告。

```typescript
// 触发告警的典型模式
const sessions = await db.select().from(chatSessions)  // 1 次
for (const s of sessions) {
  const msgs = await db.select().from(messages).where(eq(messages.sessionId, s.id))  // N 次
}
```

**修复方案**:
- Drizzle `with` 子查询预加载
- Redis 批量 `mget` 替代循环单查
- Data Loader 模式(批量 + 去重)

### 4.5 慢 SQL 杀手

**实现**:`apps/api/src/plugins/slow-sql-killer.ts` 给每个 SQL 查询套 `Promise.race`,超过 `SLOW_SQL_TIMEOUT`(默认 5s)中止查询并记录到 `api_logs`。

**生产配置**:
- 超时 5s → kill + 记录 + 返回 503
- 超时 1s → 仅记录(Prometheus `sql_duration_seconds` 直方图)
- 超时 100ms → 仅采样 10% 记录(避免日志洪泛)

### 4.6 缓存策略

| 数据类型 | TTL | 失效策略 | Redis Key |
|---------|-----|---------|-----------|
| 用户信息 | 5min | 写时主动失效 | `user:{id}` |
| 内容列表 | 5min | 写时批量失效 `content:list:*` | `content:list:{page}:{size}` |
| 会话列表 | 2min | 写时失效 | `chat:sessions:{userId}` |
| 模型配置 | 1h | 管理端写时失效 | `model:config:{id}` |
| AI 响应(幂等) | 24h | LRU 淘汰 | `ai:resp:{hash(prompt)}` |

**降级**:Redis 不可用时,所有缓存读直接回源 DB,不阻塞请求(只记录 warning)。

### 4.7 事务规范

| 场景 | 事务范围 | 隔离级别 |
|------|---------|---------|
| 支付 / 退款 | 全流程(扣款 + 订单 + 积分) | `SERIALIZABLE` + `.for('update')` 行锁 |
| 积分变更 | 单次更新 | `READ COMMITTED` |
| 会话清空 | 删消息 + 更新会话 | `READ COMMITTED` |
| 内容发布 | 草稿 → published | `READ COMMITTED` |

**禁止**:在事务内调用 LLM / OSS / 第三方 HTTP(长 IO 持有连接)。

---

## 5. 压测实操(Locust)

### 5.1 压测脚本结构

`scripts/locustfile.py` 覆盖 4 类核心端点,任务权重模拟真实流量分布:

| 任务 | 端点 | 权重 | 模拟场景 |
|------|------|------|---------|
| `get_profile` | `GET /api/auth/me` | 3 | 鉴权链路(轻量) |
| `list_chat_sessions` | `GET /api/chat/sessions` | 2 | AI 对话列表(中量) |
| `list_content` | `GET /api/content/list` | 4 | 内容浏览(高频读) |
| `list_news` | `GET /api/news/list` | 2 | 新闻列表(高频读) |
| `upload_file` | `POST /api/files/upload` | 1 | 文件上传(重负载) |

**等待时间**:`between(0.5, 2)` 秒,模拟真实用户思考时间。

### 5.2 鉴权注入

通过环境变量 `LOCUST_TOKEN` 注入测试账号 JWT(避免压测时大量登录请求污染数据):

```bash
# 获取测试 token
TOKEN=$(curl -s -X POST http://localhost:8802/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"loadtest","password":"..."}' | jq -r '.data.accessToken')

# 注入 token 启动压测
LOCUST_TOKEN="$TOKEN" locust -f scripts/locustfile.py --headless \
  --host http://localhost:8801 --users 100 --spawn-rate 10 --run-time 120s
```

### 5.3 三档验收标准(引用 architecture.md §13)

> 完整验收标准见 [architecture.md §13 压测验收标准](./architecture.md#压测验收标准)。

| 并发数 | P95 目标 | 错误率 | 通过判据 |
|--------|---------|--------|---------|
| 100 | 达基线 | <0.1% | 全部端点 P95 ≤ SLA 表基线 |
| 500 | 基线 ×2 | <1% | 容许降级,但不崩溃 |
| 1000 | 不要求 | <5% | 触发限流(429)而非超时 |

### 5.4 压测结果解读

Locust 输出关键字段:

```
[L-STOP] 压测结束 → 请求数: 12000 失败: 12 RPS: 100.0 平均延迟: 85ms
```

| 字段 | 达标判据 | 异常排查 |
|------|---------|---------|
| `num_requests` | 接近 `users × run_time / wait_time` | 远低于预期 → 检查 spawn-rate / 网络瓶颈 |
| `num_failures` | <1%(100/500 并发)/ <5%(1000 并发) | 大量 5xx → 查 API 日志;大量 429 → 限流生效(正常) |
| `total_rps` | 单实例 4C8G 应达 500+ RPS | 远低于预期 → 检查 DB 连接池 / Redis 命中率 |
| `avg_response_time` | <SLA P50 | 远高于 P50 → 检查慢 SQL / N+1 |

### 5.5 CI 集成

`.github/workflows/ws-loadtest.yml` 每周自动执行 WebSocket 压测回归,对比上周结果,延迟回归 >10% 触发告警。

**手动触发**:
```bash
# GitHub Actions 手动 dispatch
gh workflow run ws-loadtest.yml -f users=500 -f run-time=120s
```

---

## 6. 性能优化 checklist 实操

### 6.1 checklist 条目(引用 architecture.md §13)

> 完整 checklist 见 [architecture.md §13 性能优化 checklist](./architecture.md#性能优化-checklist)。
> 6 项:索引 / 分页 / N+1 检测 / Redis 缓存 / gzip / 慢 SQL 杀手。

### 6.2 每项怎么实现

| checklist 项 | 实现方式 | 验证手段 |
|-------------|---------|---------|
| 新增查询走索引 | `EXPLAIN ANALYZE` 验证 index scan | `apps/api/scripts/check-db.mjs` + Drizzle Studio |
| 列表强制分页 | 所有 list 端点 zod schema 强制 `page` / `pageSize`,`pageSize ≤ 100` | 路由审计:`grep -r 'pageSize' apps/api/src/routes/` |
| N+1 检测无告警 | 开发环境跑 n1-detector,日志无 warning | `pnpm --filter @ihui/api dev` 后访问页面,查日志 |
| 热点数据 Redis 缓存 | 查询前 `redis.get(key)`,miss 后查 DB + `redis.set(key, val, 'EX', ttl)` | `redis-cli MONITOR` 观察命中率 |
| gzip 压缩 | `compression.ts` 插件自动启用,`threshold: 1KB` | `curl -H 'Accept-Encoding: gzip' -I /api/content/list` 看 `Content-Encoding: gzip` |
| 慢 SQL 杀手生效 | `slow-sql-killer.ts` 加载,`SLOW_SQL_TIMEOUT=5000` | 故意写 `SELECT pg_sleep(6)` 验证返回 503 |

### 6.3 性能优化决策树

```
端点慢(P95 超基线)
  ├─ 查 Prometheus 直方图(http_response_time_bucket)
  │   ├─ P50 也慢 → DB / Redis 层问题
  │   │   ├─ 慢查询 >5/min → 加索引 / 优化 SQL
  │   │   ├─ 缓存命中率 <90% → 调 TTL / 预热
  │   │   └─ 连接数 >40 → 加读副本 / 调 pool
  │   └─ P50 快但 P95 慢 → 长尾问题
  │       ├─ N+1 查询 → 改批量预加载
  │       ├─ 大响应未压缩 → 启用 gzip
  │       └─ 第三方 API 超时 → 加 timeout + 降级
  └─ 错误率高
      ├─ 5xx 多 → 查 API 日志(api_logs 表)
      └─ 429 多 → 限流生效(正常,考虑扩容)
```

---

## 7. 前端性能

### 7.1 构建配置

| 配置项 | 值 | 作用 | 位置 |
|--------|---|------|------|
| `output` | `'standalone'` | 生产构建独立运行,无需 `node_modules` | `apps/web/next.config.ts` |
| 构建器(开发) | Turbopack | 快速 HMR | `apps/web/package.json` dev 脚本 |
| 构建器(生产) | Webpack | 稳定 + 优化充分 | 默认 |
| `transpilePackages` | `@ihui/ui-react` / `@ihui/types` / `@ihui/config` / `@ihui/auth` | 共享包转译 | `next.config.ts` |
| `optimizePackageImports` | lucide-react / @radix-ui/* / @tanstack/* 等 14 包 | 按需引入,减少 bundle | `next.config.ts` experimental |
| `productionBrowserSourceMaps` | `false` | 不发布 source map(安全 + 体积) | `next.config.ts` |
| `devIndicators` | `false` | 关闭左下角 dev 圆圈 | `next.config.ts` |

### 7.2 Lighthouse CI 性能预算

`apps/web/lighthouserc.json` 定义门禁,每次 PR 触发 `.github/workflows/lighthouse-ci.yml`:

| 指标 | 阈值 | 级别 | 说明 |
|------|------|------|------|
| `categories:performance` | ≥0.85 | error | 性能总分 |
| `categories:accessibility` | ≥0.9 | error | 无障碍 |
| `categories:best-practices` | ≥0.85 | warn | 最佳实践 |
| `categories:seo` | ≥0.8 | warn | SEO |
| `first-contentful-paint`(FCP) | ≤2000ms | error | 首次内容绘制 |
| `largest-contentful-paint`(LCP) | ≤2500ms | error | 最大内容绘制 |
| `cumulative-layout-shift`(CLS) | ≤0.1 | error | 累积布局偏移 |
| `total-blocking-time`(TBT) | ≤300ms | warn | 总阻塞时间 |
| `interactive`(TTI) | ≤3500ms | warn | 可交互时间 |

**采集配置**:
- 4 个 URL:home `/` / `/login` / `/dashboard` / `/admin`
- `numberOfRuns: 3`(取中位数)
- `preset: desktop`(移动端预算另配)
- 跳过 `uses-text-compression` / `uses-long-cache-ttl`(由 Nginx 层负责)

**失败处理**:error 级别断言失败 → CI 阻塞 PR 合并;warn 级别 → 仅提醒。

### 7.3 字体子集化

中文字体(HarmonyOS Sans SC)全量体积 5MB+,必须子集化。

| 文件 | 用途 |
|------|------|
| `scripts/subset-fonts.py` | 子集化脚本(pyftsubset) |
| `scripts/font-subset-chars.txt` | 字符清单(ASCII + 中日韩常用字 + emoji + 标点) |
| `apps/web/public/fonts/HarmonyOS_SansSC_*.subset.woff2` | 5 档字重子集化产物(Thin/Light/Regular/Medium/Bold) |

**重新生成**(字符清单变更后):
```bash
python scripts/subset-fonts.py
# 产物:apps/web/public/fonts/HarmonyOS_SansSC_{Thin,Light,Regular,Medium,Bold}.subset.woff2
```

**CSS 引用**(见 `apps/web/app/globals.css` 第 14-48 行):
```css
@font-face {
  font-family: 'HarmonyOS Sans SC';
  font-weight: 400;
  font-display: swap;  /* 关键:避免 FOIT */
  src: url('/fonts/HarmonyOS_SansSC_Regular.subset.woff2') format('woff2');
}
```

### 7.4 图片优化

| 配置 | 值 | 位置 |
|------|---|------|
| `images.formats` | `['image/avif', 'image/webp']` | `next.config.ts` |
| `images.remotePatterns` | 7 个白名单域名(OAuth 头像 + 业务域名) | `next.config.ts` |
| `images.dangerouslyAllowSVG` | `false` | 安全:禁止 SVG XSS |
| `images.unoptimized` | `true` | 由 Nginx / CDN 层优化 |

**禁止**:`{ protocol: 'https', hostname: '**' }` 通配(2026-07-21 安全审计加固,SSRF 风险)。

### 7.5 代码分割

| 模式 | 实现 | 说明 |
|------|------|------|
| 路由级分割 | Next.js App Router 自动(每个 `page.tsx` 独立 chunk) | 默认 |
| 组件级分割 | `next/dynamic` + `ssr: false` | 仅用于客户端重型组件(如 markdown 编辑器) |
| 第三方库分割 | `optimizePackageImports` 14 包 | 按需引入,避免整包打入 |

### 7.6 前端性能排查

| 现象 | 排查路径 |
|------|---------|
| FCP >2s | Lighthouse → 检查字体体积 / 阻塞 JS / 服务器响应时间 |
| LCP >2.5s | 检查首屏图片大小 / 服务端渲染耗时 |
| CLS >0.1 | 检查图片 / 广告位是否设固定尺寸;检查字体加载策略 |
| TBT >300ms | 检查长任务(`Performance` 面板),拆分大块同步 JS |
| 首屏白屏 | 检查 `app/layout.tsx` 是否有阻塞数据请求 |

---

## 8. AI 服务性能

### 8.1 首 Token 延迟优化

**目标**:首 Token P99 ≤ 5s(基线见 [architecture.md §13](./architecture.md#核心端点-sla))。

| 优化点 | 实现 | 位置 |
|--------|------|------|
| LiteLLM `astream` 流式 | 首 Token 不等完整响应,边生成边推送 | `apps/ai-service/app/core/llm_gateway.py` |
| SSE 缓冲断线重连 | 客户端断线后重连,服务端重放未确认事件 | `apps/ai-service/app/core/sse_buffer.py` |
| 模型路由预热 | 冷模型首次请求超时,提前 warmup | `apps/ai-service/app/routers/llm.py` |
| Prompt 长度限制 | 超 token 上限自动截断 + 提示用户 | `apps/ai-service/app/core/llm_gateway.py` |

### 8.2 LangGraph 工作流并发

`apps/ai-service/app/services/langgraph_service.py` StateGraph 三阶段:

```
plan → execute → summarize
```

| 阶段 | 性能要点 |
|------|---------|
| `plan` | 单次 LLM 调用,延迟 = 首 Token + 完整响应(可并行多个 plan) |
| `execute` | 工具调用并发执行(MCP 11 工具),单工具超时 30s |
| `summarize` | 单次 LLM 调用,可异步(不阻塞用户) |

**stub 模式**:无 API key 时返回 mock 响应,用于压测 / 测试,不消耗上游配额。

### 8.3 MCP 工具超时

| 工具 | 默认超时 | 降级策略 |
|------|---------|---------|
| `search_codebase` | 30s | 返回空结果 + 提示 |
| `run_command` | 60s | kill 子进程 + 返回 timeout 错误 |
| `web_search` | 15s | 返回缓存结果(若有) |
| `db_query` | 10s | slow-sql-killer 中止 |
| 其他工具 | 30s | 返回超时错误 |

### 8.4 向量记忆嵌入缓存

`apps/ai-service/app/services/vector_memory.py`:

| 缓存层 | Key | TTL | 命中率目标 |
|--------|-----|-----|-----------|
| 嵌入向量缓存 | `embed:{hash(text)}` | 24h | >80%(相似 prompt 复用) |
| 检索结果缓存 | `retrieve:{hash(query)}` | 5min | >50% |

**降级**:嵌入服务不可用时,回退到关键词匹配(余弦相似度 → TF-IDF)。

### 8.5 Redis 内存降级

A2A 协议(`apps/ai-service/app/services/a2a_service.py`)优先 Redis 持久化,Redis 不可用时降级到内存:

| 模式 | 持久化 | 跨实例可见 | 适用场景 |
|------|--------|-----------|---------|
| Redis(默认) | Redis | 是 | 多实例生产 |
| 内存降级 | 进程内 Map | 否 | 单实例 / Redis 故障 |

**降级触发**:`redis.ping()` 失败 3 次自动切换,日志 warning,恢复后自动回切。

### 8.6 AI 服务性能监控

| 指标 | Grafana Dashboard | 告警阈值 |
|------|-------------------|---------|
| 首 Token 延迟 P95 | `ai-latency.json` | >2s warning |
| LLM 调用错误率 | `ai-latency.json` | >5% warning |
| AI 成本(美元/天) | `ai-cost.json` | >日预算 80% warning |
| 工具调用超时次数 | `ai-latency.json` | >10/min warning |
| 队列等待长度 | `ai-latency.json` | >50 warning |

---

## 9. WebSocket 性能

### 9.1 WebSocket 端点矩阵(引用 architecture.md §3)

> 完整 12 个 WS 端点见 [architecture.md §3 WebSocket 端点](./architecture.md#websocket-端点apps-apisrcpluginsws-tsts12-端点)。
> 关键端点:`/ws/notifications`(全局通知)、`/ws/room/:roomId`(聊天室)、`/ws/agent/stream`(Agent 流式)、`/ws/realtime/pcm`(双向音频)。

### 9.2 连接数监控

| 指标 | Grafana Dashboard | 告警阈值 |
|------|-------------------|---------|
| 活跃 WS 连接数 | `ws.json` | 单实例 >5000 warning |
| 握手失败率 | `ws.json` | >1% warning |
| 心跳超时断开数 | `ws.json` | >10/min warning |
| 消息推送延迟 | `ws.json` | P95 >500ms warning |

### 9.3 心跳优化

| 参数 | 值 | 说明 |
|------|---|------|
| 客户端 ping 间隔 | 30s | 默认,可配 |
| 服务端 pong 响应 | 立即 | 纯 CPU |
| 超时断开 | 90s(3 次未收到 ping) | 防僵尸连接 |
| 重连退避 | 1s → 2s → 4s → 8s → 16s(上限) | 避免雪崩 |

**心跳协议**:客户端发 `{"type":"ping"}`,服务端回 `{"type":"pong"}`(JSON);兼容原生 `ping`/`pong` 帧。

### 9.4 Redis Pub/Sub 跨实例广播

仅多用户端点(notifications / chat)需要跨实例广播,1:1 端点(customer-service / payment / agent-stream)不依赖 Redis。

| 端点 | Redis Pub/Sub | 原因 |
|------|---------------|------|
| `/ws/notifications` | 是 | 全局通知,用户可能连任意实例 |
| `/ws/room/:roomId` | 是 | 聊天室成员可能连不同实例 |
| `/ws/customer-service` | 否 | 1 对 1,单实例内闭环 |
| `/ws/payment/status/:orderNo` | 否 | 单订单单连接 |
| `/ws/agent/stream` | 否 | 单用户独占 |

**广播模式**:
```
实例 A 收到消息 → publish to redis:ws:room:{roomId} → 实例 A/B/C 订阅 → 各自推送给本地客户端
```

### 9.5 WS 性能排查

| 现象 | 排查路径 |
|------|---------|
| 握手 P99 >600ms | 检查 JWT 校验耗时 / Redis 连接 |
| 消息延迟 >500ms | 检查 Redis Pub/Sub 延迟 / 实例间网络 |
| 连接频繁断开 | 检查心跳间隔 / 网络稳定性 / 负载均衡超时 |
| 单实例连接数不增长 | 检查负载均衡策略(应 sticky session 或 round-robin) |

---

## 10. 监控告警体系

### 10.1 监控栈架构

```
API(/metrics)  ──┐
AI service(/metrics) ──┤
PostgreSQL(exporter) ──┼──→ Prometheus ──→ Grafana(19 dashboards)
Redis(exporter) ──┤         │
Node(node_exporter) ──┘         ├─→ Alertmanager ──→ 邮件 / 钉钉 / 飞书
                                └─→ Loki(日志聚合) ←─ Promtail
```

### 10.2 Prometheus 指标

`apps/api/src/plugins/metrics.ts` 暴露 `/metrics` 端点(Prometheus 文本格式):

| 指标类型 | 指标名 | 用途 |
|---------|--------|------|
| Counter | `http_requests_total` | 请求总数 |
| Counter | `http_requests_by_status` | 按状态码分布 |
| Histogram | `http_response_time_bucket` | 响应时间直方图(P50/P95/P99) |
| Histogram | `sql_duration_seconds` | SQL 耗时直方图 |
| Gauge | `db_connections_active` | 活跃 DB 连接数 |
| Gauge | `redis_ops_per_sec` | Redis 操作速率 |

**鲁棒性**:`metrics.ts` 第 17-31 行实现 Map 大小限制(每 Map 最多 2000 key,超出 LRU 清理 10%),防止 dynamic route 参数组合爆炸导致内存泄漏。

### 10.3 Grafana 仪表盘

`monitoring/grafana/dashboards/` 共 19 个仪表盘,关键性能相关:

| Dashboard | 覆盖内容 |
|-----------|---------|
| `ihui-ai-overview.json` | 全平台总览(API / AI / DB / Redis / WS) |
| `ai-latency.json` | AI 服务首 Token / 流式 / 工具调用延迟 |
| `ai-cost.json` | LLM 成本(美元 / Token) |
| `postgresql.json` | 数据库连接 / 慢查询 / 复制延迟 / 死锁 |
| `cache.json` | Redis 命中率 / 内存 / 慢命令 |
| `ws.json` | WebSocket 连接数 / 心跳 / 推送延迟 |
| `pg_deploy.json` | PostgreSQL 部署健康 |
| `monitor_health.json` | 监控自检(Prometheus / Grafana / Alertmanager) |

### 10.4 告警规则

`monitoring/prometheus/alerts.yml` 3 组告警:

| 组 | 告警名 | 条件 | 级别 |
|----|--------|------|------|
| api-alerts | `ApiDown` | `up{job="api"} == 0` 持续 1m | critical |
| api-alerts | `ApiHighErrorRate` | 5xx 占比 >5% 持续 5m | warning |
| api-alerts | `ApiSlowResponse` | P95 >1000ms 持续 5m | warning |
| ai-service-alerts | `AiServiceDown` | `up{job="ai-service"} == 0` 持续 1m | critical |
| infrastructure-alerts | `DiskSpaceLow` | 剩余空间 <10% 持续 5m | warning |
| infrastructure-alerts | `MemoryLow` | 可用内存 <10% 持续 5m | warning |

### 10.5 Alertmanager 噪声抑制

`monitoring/alertmanager/noise-rules.yml` 配置告警抑制规则,避免告警风暴:
- 同一 alert 连续触发 → 5min 内只发一次
- critical 告警抑制同组 warning
- 维护窗口期(`maintenance` 标签)静默

---

## 11. 性能回归检测

### 11.1 CI 性能门禁

| Workflow | 触发 | 作用 | 失败处理 |
|----------|------|------|---------|
| `.github/workflows/lighthouse-ci.yml` | 每次 PR | Lighthouse 4 URL 性能预算门禁 | error 级别失败阻塞合并 |
| `.github/workflows/ws-loadtest.yml` | 每周 + 手动 | WebSocket 压测回归 | 延迟回归 >10% 告警 |
| `.github/workflows/ci.yml` | 每次 push | 全量 typecheck + lint + test | 阻塞合并 |

### 11.2 Lighthouse CI 工作流

```
PR 提交 → lighthouse-ci.yml 触发
  → pnpm -F @ihui/web dev 启动服务(等待 "Ready in")
  → Lighthouse 采集 4 URL × 3 次
  → 对比 lighthouserc.json 断言
  → error 级别失败 → 阻塞 PR
  → warn 级别失败 → 评论提醒
  → 报告上传临时存储(sqlite 本地 + temporary-public-storage)
```

### 11.3 Locust 每周回归

`.github/workflows/ws-loadtest.yml` 每周一定时执行:
- 100 并发 baseline 压测
- 对比上周 P95,回归 >10% 触发 issue
- 结果归档到 `.lighthouse-ci/` 与 Grafana

### 11.4 Prometheus 长期趋势

Grafana dashboard `ihui-ai-overview.json` 展示 30 天 P50/P95/P99 趋势,人工每周 review:
- P95 持续上升趋势 → 提前优化
- 错误率突增 → 排查最近的发布

---

## 12. 常见性能问题排查

### 12.1 慢 API(P95 超基线)

| 步骤 | 操作 | 工具 |
|------|------|------|
| 1 | 确认是否单端点慢还是全局限时 | Grafana `ihui-ai-overview` |
| 2 | 查 Prometheus 直方图,定位 P50 还是长尾 | `histogram_quantile(0.95, ...)` |
| 3 | 查慢 SQL 日志(`api_logs` 表 `duration > 1000`) | `psql` / Drizzle Studio |
| 4 | 查 N+1 检测器日志(开发环境) | API 控制台 warning |
| 5 | 查 Redis 命中率(<90% 触发回源) | Grafana `cache` |
| 6 | 查第三方 API 超时(LLM / OSS) | `ai-latency` dashboard |

### 12.2 慢 SQL(>1s)

| 步骤 | 操作 |
|------|------|
| 1 | `EXPLAIN ANALYZE` 查执行计划,确认是否 seq scan |
| 2 | 检查 WHERE / JOIN 列是否有索引 |
| 3 | 检查索引是否被函数表达式破坏(`LOWER()` 等) |
| 4 | 检查是否 N+1(同一请求多次相同查询) |
| 5 | 加索引后重新 `EXPLAIN ANALYZE` 验证 index scan |
| 6 | 若仍慢,考虑数据量过大 → 分表 / 归档 |

### 12.3 内存泄漏

| 现象 | 排查 |
|------|------|
| API 内存持续增长不回收 | `process.memoryUsage()` 监控;`heapdump` 抓快照 |
| Map / WeakMap 无限增长 | 检查是否缺少清理逻辑(`metrics.ts` 有 `ensureMapBounded` 兜底) |
| WebSocket 连接累积 | 检查心跳超时是否生效(90s 未 ping 应断开) |
| Redis 连接累积 | 检查 `idle_timeout` 配置;手动 `redis-cli CLIENT KILL` |

### 12.4 首屏慢(FCP / LCP 超预算)

| 步骤 | 操作 |
|------|------|
| 1 | Lighthouse 跑首页,看 Opportunity 建议 |
| 2 | 检查字体体积(应 <100KB / 字重) |
| 3 | 检查首屏图片是否 webp / avif |
| 4 | 检查 `app/layout.tsx` 是否有阻塞数据请求(应改 `loading.tsx` 流式) |
| 5 | 检查第三方脚本(GA / Sentry)是否 `async` |
| 6 | 检查 CSP 是否过严阻塞资源 |

### 12.5 AI 首 Token 慢(>5s)

| 步骤 | 操作 |
|------|------|
| 1 | 查 `ai-latency` dashboard,区分 cold start 还是稳定慢 |
| 2 | 检查 LLM 上游延迟(LiteLLM 日志) |
| 3 | 检查 Prompt 长度(超 token 上限自动截断有日志) |
| 4 | 检查模型路由是否预热(冷模型首次请求慢) |
| 5 | 检查 Redis 嵌入缓存命中率(<80% 触发回源) |
| 6 | 若上游稳定慢,考虑切换更快模型 / 流式分片 |

### 12.6 WebSocket 慢 / 断

| 现象 | 排查 |
|------|------|
| 握手慢 | 检查 JWT 校验 / Redis 连接 |
| 推送延迟 | 检查 Redis Pub/Sub 延迟(跨实例) |
| 频繁断开 | 检查心跳间隔 / LB idle timeout(应 >90s) |
| 消息丢失 | 检查 sse_buffer 是否生效(断线重连重放) |

### 12.7 限流误触发(429)

| 原因 | 解决 |
|------|------|
| 单租户超配额(10000/天) | 调大租户配额 / 升级套餐 |
| 全局 rate-limit(100/min)误伤 | 调高 `@fastify/rate-limit` max |
| WebSocket 连接数超限 | 加 WS 实例 |
| AI 并发流超限 | 加 AI 实例 / 排队等待 |

---

## 13. 性能优化决策原则

1. **先测后优**:任何优化前先有 Prometheus 基线数据,优化后对比 P50/P95/P99,避免"感觉快了"。
2. **瓶颈定位**:用决策树(§6.3)逐层下钻,不要盲目优化非瓶颈层。
3. **缓存优先**:读多写少的数据先上 Redis 缓存,再考虑 DB 索引。
4. **流式优先**:AI 响应 / 大文件 / 长任务用流式(SSE / WS / chunked),不阻塞主线程。
5. **降级优先**:第三方依赖(LLM / OSS / Redis)必须有降级路径,不能让单点故障拖垮全链路。
6. **监控优先**:新增端点必须能在 `metrics.ts` 看到指标,新增 dashboard 必须有告警阈值。
7. **回归优先**:每次 PR 跑 Lighthouse CI,每周跑 Locust 压测,延迟回归 >10% 不放过。
