# AI 本地/云端切换 · 本地化网关 PoC 报告

> 日期:2026-11-15 · 目的:验证「普通对话全链下放到用户机本地栈」的可行性
> 任务背景:引擎模式本地/云端切换已完成 agent 流 + 工具链接线;本 PoC 回答「普通 chat 流能否也下放本地」这一重型架构选择是否可行。
>
> **最终决策(2026-11-15 定案)**:PoC 命题成立(技术可行),但**不采纳产品化**——收益(仅减"普通对话请求处理"低负载,LLM 推理仍在厂商)远低于成本(给用户机打包整套后端 + Redis 稳定性硬门槛)。详见 **`docs/engineering/adr-ai-engine-switch-scope-2026-11-15.md`**。本 PoC 保留为该决策的证据基线。

## 0. 结论(先说)

**PoC 命题成立**:普通对话 `/ai/chat/stream` 的完整链路可以在用户机本地栈跑通,请求成功穿过 `鉴权 → 网关(8802) → ai-service(8803) → 上游 LLM`,返回真实业务帧。

**但「本地化网关」不等于复制一个端口**——它要求用户机跑一整套后端:**网关(api,8802)+ ai-service(8803)+ PostgreSQL + Redis**。这套栈在这台用户机上已真实存在并跑通。

**关键澄清(最重的一项)**:LLM token 推理**从来不在用户机也不在自家服务器**——引擎切"本地"省的是 **agent 编排 + 工具执行**的算力,**LLM 推理始终在 LLM 厂商**(Gemini/stepfun/OpenAI 等)。本机实测也印证:本地栈跑通后,真实对话帧是上游 Gemini 返回的 `429 免费配额耗尽`。

## 1. PoC 环境事实(实测)

本机(用户机)已具备完整本地栈:

| 组件 | 端口 | 状态 | 证据 |
|------|------|------|------|
| 网关(api) | 8802 | ✅ 起 | `Server listening at http://127.0.0.1:8802` |
| ai-service | 8803 | ✅ 活 | `GET /health` → 200 |
| PostgreSQL | 5432 | ✅ 连 | `DATABASE_APP_URL 启动探测成功(SELECT 1)` |
| Redis | 6379 | ✅ 连 | `BullMQ workers started (all 9 queues have consumers)` |

`.env` 配置:`DATABASE_URL=postgresql://ihui:***@localhost:5432/ihui`、`REDIS_URL=redis://localhost:6379`、`API_SERVICE_URL=http://localhost:8802`——**网关与 ai-service 都连本地 PG + 本地 Redis**。

## 2. PoC 步骤与证据

1. **启动本地网关**:`cd apps/api && pnpm dev`(`dotenv/config` 自动加载 .env)。全栈起来:PG SELECT 1 通、9 个 BullMQ 队列有消费者、33 个调度任务启动。
2. **路由存在性**:`POST /api/ai/chat/stream` → 403「CSRF 令牌缺失」(非 404,路由存在,补 `X-Requested-With` 即过)。
3. **seed 测试账号**:`E2E_USER_PASSWORD=*** npx tsx scripts/seed-test-users.ts` → `test@aizhs.top` upsert 成功(本地库名 `ihui` 非生产 `ihui_dev`,防呆放行)。
4. **登录**:`POST /api/auth/login` → `code:0` 返回 accessToken。
5. **端到端对话**:`POST /api/ai/chat/stream` + Bearer token → 返回**上游 LLM 真实业务帧**:
   ```
   event: error
   data: {"type":"error","errorCode":"provider_budget_exhausted",
     "message":"litellm.RateLimitError: 429 ... gemini-3.8-flash ...
     Generate content requests per day limit exceeded on Free Tier ..."}
   ```
   这一帧证明:鉴权✅ → 网关转发✅ → ai-service✅ → 上游 LLM✅ 全链贯通。报错只是 Gemini 免费配额耗尽(非链路问题)。

## 3. PoC 发现的真实问题

### 3.1 间歇性「Token has been revoked」(Redis 抖动 fail-closed)

- 现象:同一进程内登录拿到 token,打 `/api/ai/chat/stream` 间歇返回 401「Token has been revoked」,但 `/api/auth/me`(同走 `authenticate()`)稳定 200。
- 根因:`packages/auth/src/blacklist.ts:62` `has(token, failClosed=true)` —— access token 黑名单依赖 Redis,`redis.exists()` 抛错时**默认 fail-closed 视为已吊销**(2026-11-11 DBG-26 安全加固,防已吊销 token 复活)。本机那条独立 ioredis 连接(`FAST_FAIL_REDIS_OPTIONS`:`maxRetriesPerRequest:1`、`enableOfflineQueue:false`、`connectTimeout:2000`)抖动。
- 影响:本地栈 Redis 稳定性直接决定对话可用性。**若做本地化网关产品化,Redis 稳定性是硬门槛**(或需为本地档提供 fail-open 逃生通道,但那要权衡吊销安全性)。

### 3.2 受限模型权限(非链路问题)

- `gpt-4o-mini`/`gpt-4o`/`deepseek-chat`/`deepseek-reasoner` 在 `RESTRICTED_MODEL_IDS`(ai-service `llm.py:3514`),仅系统管理员可用 → 测试账号(roleId=0)报「该模型仅系统管理员可用」。
- 换非受限模型 `gemini/gemini-3.8-flash` 后链路即通(见 §2 步骤 5)。

### 3.3 本机免费 LLM 配额耗尽

- Gemini 免费档每日 20 请求已用尽。本地栈跑通 ≠ LLM 可用——再次印证 §0「LLM 推理在厂商」的结论。

## 4. 架构澄清:chat 流为何不能像 agent 流那样"简单改基址"

| | agent 流 | 普通 chat 流 |
|---|---|---|
| 入口端点 | 网关 `/api/agent-langgraph/*` | 网关 `/api/ai/chat/stream` |
| 上游 | ai-service `/api/langgraph/*`(点对点可替换) | ai-service `/api/llm/complete/stream`(经网关加工) |
| 网关承担 | 薄转发 | **压缩 + G6 治理 + 准入配对 + 预算账本 + 归档**(不可绕过) |
| 本地腿落点 | 直连 ai-service 8803 ✅ 已接线 | 需本地跑**整套网关**(本 PoC 验证可行) |

网关在 chat 链的 db 依赖:会话归属鉴权 `isConversationOwnedBy`、消息落库 `persistMessageArchive`、预算账本 `captureLedgerPayload`、压缩边界、element-pack——**无 db 普通对话基本不可用**(网关进程不 crash,但这些功能失败)。

## 5. 对「减负」命题的最终回答

| 负载类型 | 切"本地"是否下放 | 说明 |
|---|---|---|
| agent 编排 + 工具执行 | ✅ 已下放(前序完成) | agent 流直连用户机 8803 |
| 普通对话全链 | ⚠️ 技术可行,需本地化整套网关 | 本 PoC 验证可行,但要用户机跑 网关+ai-service+PG+Redis |
| LLM token 推理 | ❌ 从不下放 | 始终在 LLM 厂商,切换不动 |

**"本地切换省服务器压力"的真实边界**:省的是**编排/工具/对话请求处理的算力**,不是 LLM 推理,也不是 LLM token 费用。

## 6. 后续决策点(PoC 未覆盖,需产品拍板)

1. **数据策略**:本地化网关后,用户机对话存哪?(本地新建 PG 隔离 / 连服务器库)。本 PoC 未定。
2. **打包形态**:整套后端(网关+ai-service+PG+Redis)如何分发给普通用户?(Docker?安装包内嵌?)工程量大。
3. **Redis 稳定性**(§3.1):本地档是否需要 fail-open 逃生,还是要求用户机跑稳定 Redis。
4. **是否值得**:普通对话打网关的额外负载其实很小(见 §5),而本地化网关成本极高——**前序已落地的 agent 流+工具链下放,可能已覆盖"真减负"的主要场景**。

## 7. 可复现命令

```bash
# 本地栈 PoC(用户机需已有 PG 5432 + Redis 6379)
cd apps/api && pnpm dev                                    # 起网关 8802(连本地 PG/Redis)
E2E_USER_PASSWORD='***' npx tsx scripts/seed-test-users.ts # seed 测试账号
# 登录拿 token
curl -s -X POST http://127.0.0.1:8802/api/auth/login \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d '{"account":"test@aizhs.top","password":"<密码>"}'
# 端到端对话(换非受限+已配 key 的模型)
curl -s -N -X POST http://127.0.0.1:8802/api/ai/chat/stream \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -H "Authorization: Bearer <token>" \
  -d '{"messages":[{"role":"user","content":"hi"}],"model":"<在架非受限模型>"}'
```
