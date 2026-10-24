<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# IHUI AI Service

LLM 网关 + MCP 工具 + LangGraph 工作流。

## 启动

```bash
# 开发模式(默认端口 8803)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8803
```

## ASGI 拓扑

`app.main:app` 是 `socketio.ASGIApp` 根 ASGI app:

- `/socket.io/*` → Socket.IO(兼容历史 coze_zhs_py 客户端)
- 其余路径 → FastAPI(含 CORS + JWT 中间件 + OpenTelemetry + Prometheus)

## Socket.IO 兼容协议层

`app/sio/` 提供旧客户端无缝连接入口,复用 `llm_gateway.astream()` 流式产 token。

### 事件契约

| 方向  | 事件                               | 说明                                                                                      |
| ----- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| C → S | `connect`                          | 握手鉴权,从 `auth.token` 或 `?token=` 提取 JWT                                            |
| C → S | `join_room`                        | `{"chat_id": "xxx"}` 加入 chat 房间(同 chat 多端订阅)                                     |
| C → S | `leave_room`                       | `{"chat_id": "xxx"}` 离开房间                                                             |
| C → S | `chat_message`                     | `{"message": "...", "chat_id": "xxx", "model": "...", "history": [...]}` 触发 AI 流式回复 |
| S → C | `chat_stream_chunk`                | 逐 token 推送 `{chat_id, session_id, content}`                                            |
| S → C | `chat_stream_done`                 | 完成事件 `{chat_id, session_id, content, model, usage, stub}`                             |
| S → C | `chat_error`                       | 异常 `{chat_id, session_id, message, code}`                                               |
| S → C | `join_room_ack` / `leave_room_ack` | 加入/离开房间 ACK                                                                         |

### 鉴权策略

1. **本地 JWT 验签**(优先):与 apps/api 共享 `JWT_SECRET`,HS256 + issuer 校验。
2. **httpx fallback**:本地未配置 `JWT_SECRET` 或验签失败时,调 apps/api 的
   `GET /api/auth/me`(`Authorization: Bearer <token>`)兜底验证。
   > 注:apps/api 未暴露 `/api/auth/validate` 端点,改用既有 `/auth/me`。

### 客户端示例

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:8803', {
  auth: { token: '<your-access-token>' }, // JWT access token
})

socket.on('connect', () => console.log('connected', socket.id))

socket.emit('join_room', { chat_id: 'demo-chat' })

socket.emit('chat_message', {
  message: '你好,介绍一下你自己',
  chat_id: 'demo-chat',
  model: 'stepfun/step-3.7-flash', // 可选
})

socket.on('chat_stream_chunk', (data) => {
  if (data.content) process.stdout.write(data.content)
})

socket.on('chat_stream_done', (data) => {
  console.log('\n[done]', data.model, data.usage)
})

socket.on('chat_error', (err) => console.error('[error]', err))
```

### 多端隔离

房间名格式:`chat:<user_id>:<chat_id>`,跨用户不串台。

## 关键路径

- `app/main.py` — FastAPI 入口 + Socket.IO ASGI 挂载
- `app/sio/__init__.py` — `socketio.AsyncServer` 实例
- `app/sio/handlers.py` — 事件处理器 + 鉴权
- `app/core/llm_gateway.py` — LiteLLM 流式网关(`astream()`)
- `app/api/v1/chat.py` — HTTP `/api/v1/ai/chat`(新客户端默认走 SSE)
- `app/api/v1/lsp.py` — LSP 转发路由(转到定义 / 查找引用 / 诊断 / hover)
- `app/routers/fim.py` — FIM 补全 / 补全接受率上报与汇总 / 编辑意图预测端点
- `app/services/edit_intent.py` — 编辑意图三态判定与动作校验(纯函数,可脱栈测)

## 代码编辑能力(FIM 补全 / 编辑意图预测)

### `POST /api/llm/fim` — 单轮代码补全

请求:`{prefix, suffix?, language?, model?, max_tokens?, owner_uuid?}`;响应
`{code, message, data:{completion, model, latency_ms, stub}}`。

- 只喂光标前后文:前缀截尾 6000 字符、后缀截头 2000 字符;`max_tokens` 默认 128、上限 512,`temperature=0`。
- 模型选型:env `FIM_PREFERRED_MODEL` > 请求显式 `model` > 模型目录「补全专用档位」(`fim is True`)首个命中 > `'auto'`;候选清单 TTL 300s,异常静默回退 `'auto'`。
- 空 `prefix` 直接返回空补全;网关异常/上游失败降级为 HTTP 200 + 空 `completion`(`message="fim degraded"`),不打断编辑器;输出中的 markdown 围栏会被剥离。

### `POST /api/llm/fim/metrics` 与 `GET /api/llm/fim/metrics/summary` — 接受率闭环

- 上报的是**增量快照**(本次相对上次的增量),字段:`model`、`scene`、`requestCount`、`suggestionCount`、`acceptedCount`、`dismissedCount`、`failureCount`、`cancellationCount`、`cacheHitCount`、`latencyMs`。
- `scene` 是聚合维度(缺省 `completion` = FIM 补全,可传 `edit_intent` 单独统计编辑意图预测的接受率);不传 `scene` 的调用方与历史读数同桶,语义不变。
- 汇总是**按 model × scene** 的行:计数、`acceptanceRate`(无建议时为 `null`)、`p50LatencyMs` / `p95LatencyMs`(每桶最多保留 500 个延迟样本)、`alert`(接受率 < 30% 且建议数 ≥ 20)。聚合桶上限 50。
- 持久化:Redis 写穿 `ihui:fim:metrics`(无 TTL),进程启动后首次访问惰性恢复;Redis 不可用/读写异常一律静默降级为纯内存,不影响上报与补全。

### `POST /api/llm/fim/edit-intent` — 独立编辑意图预测

请求:`{content, cursor?, language?, path?, model?, max_tokens?, budget_ms?, owner_uuid?}`;
响应 `{code, message, data:{disposition, undetermined, reason, actions, dropped_actions,
document_length, model, latency_ms, budget_ms, stub}}`。

- 输入是**被审文档全文** + 绝对光标偏移(0 基,越界 → 422),输出是结构化编辑动作
  `insert`(空区间)/ `replace` / `delete`,`start`/`end` 是文档绝对字符偏移、右开区间。
- 三态互斥:`suggested`(至少一条通过校验)/ `no_action`(模型明说 `{"actions":[]}`)/
  `undetermined`(判不出来,`reason` 必为 `no_credentials`、`model_unavailable`、
  `model_timeout`、`parse_failed`、`all_actions_rejected`、`insufficient_context` 之一)。
  降级只标 `undetermined`,不得折叠成 `no_action`;端点不抛 5xx(失败不打断编辑器)。
- 逐条判据:越界/倒序/空动作丢弃、`insert` 必须 `start == end` 且文本非空、`delete` 必须空文本;
  超出单次上限(5 条)按顺序丢弃;**重叠区间**判冲突(相交或两条 `insert` 同点);
  `replace`/`delete` 可带 `anchor`(模型认为 `[start,end)` 当前原文),服务端与文档切片比对,
  对不上即丢弃;`anchor` 缺失或显式 `null` 不比对(旧输出零行为变化),`insert` 不参与比对。
  丢弃的动作逐条记在 `dropped_actions`(序号 + 原因),不静默消失。
- 预算:env `PREDICTIVE_EDIT_BUDGET_MS` > 请求 `budget_ms` > 默认 1500ms,统一封顶 4000ms、
  下限 150ms,调用侧 `asyncio.wait_for` 喂该值。

> 现状:编辑意图预测目前只有服务端端点,前端尚无调用方;FIM 补全由 `apps/web` 的
> `CodeEditor` 消费,并上报接受率增量。

## LSP 依赖

`/api/v1/lsp/*` 端点通过 subprocess 调用 `typescript-language-server`,需在运行环境安装:

```bash
npm install -g typescript-language-server typescript
```

未安装时端点返回 HTTP 503 + 降级提示(前端可改用 codegraph 离线兜底)。Docker 镜像已内置 Node.js 20 + LSP 依赖,本地开发需手动安装。

## 配置

见 `.env.example`。Socket.IO 沿用 `CORS_ORIGIN` / `JWT_SECRET` / `API_SERVICE_URL`,
未引入新的环境变量。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
