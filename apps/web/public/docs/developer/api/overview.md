# API 概览

> **配置说明**：实际 API 基地址以部署环境为准。`/v1/*` 为对外开发者 API（OpenAI 兼容格式），`/api/*` 为内部管理路由。

## 基础信息

### API 地址

```
https://api.example.com/v1
```

### 协议

- **协议** — HTTPS
- **方法** — RESTful (GET, POST, PUT, DELETE)
- **数据格式** — JSON
- **字符编码** — UTF-8
- **字段命名** — camelCase（与 `@ihui/types` 契约一致）

## 鉴权

使用 API Key 鉴权，支持两种 Header：

```http
Authorization: Bearer ihui_xxx
```

或

```http
X-Api-Key: ihui_xxx
```

可选 Secret 校验（创建/轮换时返回）：

```http
X-Api-Secret: sk_xxx
```

详见 [身份认证](../getting-started/authentication.md)。

## 响应格式

### 成功响应

`/v1/*` 端点采用 OpenAI 兼容格式，直接返回数据对象，无统一外层包裹：

```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-4",
  "choices": [...],
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20,
    "totalTokens": 30
  }
}
```

### 错误响应

```json
{
  "error": {
    "message": "Error message",
    "type": "invalid_request_error"
  }
}
```

## 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 401 | 未授权（API Key 无效或已吊销） |
| 403 | 权限不足（缺少所需权限点） |
| 404 | 资源不存在 |
| 429 | 配额超限或频率限制 |
| 500 | 服务器错误 |

## 已实现端点

| 端点 | 方法 | 所需权限 | 说明 |
|------|------|----------|------|
| `/v1/agents` | GET | `agents:read` | 获取智能体列表 |
| `/v1/agents/:id` | GET | `agents:read` | 获取智能体详情 |
| `/v1/agents/:id/call` | POST | `agents:call` | 调用智能体 |
| `/v1/chat/completions` | POST | `chat:write` | 发起对话补全 |
| `/v1/models` | GET | `models:read` | 获取模型列表 |
| `/v1/files` | GET | `files:read` | 获取文件列表 |
| `/v1/files` | POST | `files:write` | 上传文件 |

## 权限点枚举

API Key 创建时需从以下 7 个权限点中选择授予：

| 权限点 | 说明 |
|--------|------|
| `agents:read` | 读取智能体列表/详情 |
| `agents:call` | 调用智能体 |
| `chat:read` | 读取对话会话 |
| `chat:write` | 发起对话补全 |
| `models:read` | 读取模型列表 |
| `files:read` | 读取文件列表/详情 |
| `files:write` | 上传/管理文件 |

## 速率限制

- API Key 创建时可设置每分钟请求上限（默认 60）
- 超出配额限制将返回 429 状态码，响应头含 `Retry-After`

---

*最后更新: 2026-07-22*
