# IHUI AI Service

LLM 网关 + MCP 工具 + LangGraph 工作流。

## 启动

```bash
# 开发模式(默认端口 8000)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## ASGI 拓扑

`app.main:app` 是 `socketio.ASGIApp` 根 ASGI app:

- `/socket.io/*` → Socket.IO(兼容历史 coze_zhs_py 客户端)
- 其余路径 → FastAPI(含 CORS + JWT 中间件 + OpenTelemetry + Prometheus)

## Socket.IO 兼容协议层

`app/sio/` 提供旧客户端无缝连接入口,复用 `llm_gateway.astream()` 流式产 token。

### 事件契约

| 方向 | 事件 | 说明 |
| --- | --- | --- |
| C → S | `connect` | 握手鉴权,从 `auth.token` 或 `?token=` 提取 JWT |
| C → S | `join_room` | `{"chat_id": "xxx"}` 加入 chat 房间(同 chat 多端订阅) |
| C → S | `leave_room` | `{"chat_id": "xxx"}` 离开房间 |
| C → S | `chat_message` | `{"message": "...", "chat_id": "xxx", "model": "...", "history": [...]}` 触发 AI 流式回复 |
| S → C | `chat_stream_chunk` | 逐 token 推送 `{chat_id, session_id, content}` |
| S → C | `chat_stream_done` | 完成事件 `{chat_id, session_id, content, model, usage, stub}` |
| S → C | `chat_error` | 异常 `{chat_id, session_id, message, code}` |
| S → C | `join_room_ack` / `leave_room_ack` | 加入/离开房间 ACK |

### 鉴权策略

1. **本地 JWT 验签**(优先):与 apps/api 共享 `JWT_SECRET`,HS256 + issuer 校验。
2. **httpx fallback**:本地未配置 `JWT_SECRET` 或验签失败时,调 apps/api 的
   `GET /api/auth/me`(`Authorization: Bearer <token>`)兜底验证。
   > 注:apps/api 未暴露 `/api/auth/validate` 端点,改用既有 `/auth/me`。

### 客户端示例

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
  auth: { token: "<your-access-token>" },  // JWT access token
});

socket.on("connect", () => console.log("connected", socket.id));

socket.emit("join_room", { chat_id: "demo-chat" });

socket.emit("chat_message", {
  message: "你好,介绍一下你自己",
  chat_id: "demo-chat",
  model: "stepfun/step-3.7-flash",  // 可选
});

socket.on("chat_stream_chunk", (data) => {
  if (data.content) process.stdout.write(data.content);
});

socket.on("chat_stream_done", (data) => {
  console.log("\n[done]", data.model, data.usage);
});

socket.on("chat_error", (err) => console.error("[error]", err));
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

## LSP 依赖

`/api/v1/lsp/*` 端点通过 subprocess 调用 `typescript-language-server`,需在运行环境安装:

```bash
npm install -g typescript-language-server typescript
```

未安装时端点返回 HTTP 503 + 降级提示(前端可改用 codegraph 离线兜底)。Docker 镜像已内置 Node.js 20 + LSP 依赖,本地开发需手动安装。

## 配置

见 `.env.example`。Socket.IO 沿用 `CORS_ORIGIN` / `JWT_SECRET` / `API_SERVICE_URL`,
未引入新的环境变量。
