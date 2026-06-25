# LangChain 统一 LLM 接口 — 请求地址与出入参

**路由前缀**：`/cozeZhsApi/langchain`  
**完整地址**：`{BASE_URL}/cozeZhsApi/langchain/...`（BASE_URL 为服务根地址，如 `http://localhost:8000`）

---

## 1. HTTP 非流式聊天

### 请求地址

```
POST /cozeZhsApi/langchain/chat
```

### 入参（JSON Body）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 用户提示词 |
| model_id | string | 是 | 模型 code，对应表 `zhs_ai_model_info_unify.code` |
| user_uuid | string | 否 | 用户 UUID，用于 Token 校验 |
| chat_id | string | 否 | 聊天 ID |
| files | array | 否 | 图片/视频，会拼到 prompt 前；元素格式见下 |
| zidingyican | array | 否 | 自定义参数，如 temperature、max_tokens |

**files 元素**：

- 视频：`{ "isVideo": true, "video_url": "https://..." }`
- 图片：`{ "isVideo": false, "imgUrl": "https://..." }`

**zidingyican 元素**：`{ "name": "temperature", "value": 0.8 }`、`{ "name": "max_tokens", "value": 2000 }` 等。

**示例**：

```json
{
  "prompt": "请总结这段内容",
  "model_id": "your-model-code",
  "user_uuid": "optional-uuid",
  "chat_id": "optional-chat-id",
  "files": [
    { "isVideo": false, "imgUrl": "https://example.com/img.png" }
  ],
  "zidingyican": [
    { "name": "temperature", "value": 0.7 },
    { "name": "max_tokens", "value": 2000 }
  ]
}
```

### 出参（成功，200）

```json
{
  "code": 0,
  "data": {
    "content": "模型返回的完整文本",
    "model": "模型名称"
  }
}
```

### 错误响应

| 状态码 | 说明 |
|--------|------|
| 400 | 此模型仅支持 WebSocket 接口（quest_type 为 socket 时走 HTTP） |
| 402 | Token 余额不足 |
| 404 | 模型不存在（未命中数据库），detail 为「当前不存在」 |
| 408 | 任务模式下等待任务完成超时 |
| 500 | 内部错误或任务执行失败 |

---

## 2. WebSocket 流式聊天

### 请求地址

```
WS /cozeZhsApi/langchain/ws
```

### 客户端发送（入参）

连接成功后，直接发送 **JSON 文本** 消息（扁平格式）：

```json
{
  "prompt": "用户提示词（必填）",
  "model": "模型code（必填，也支持model_id）",
  "user_uuid": "用户UUID（可选）",
  "chat_id": "聊天ID（可选）",
  "zidingyican": [
    {"name": "temperature", "value": 0.7},
    {"name": "max_tokens", "value": 2000},
    {"name": "size", "value": "1280*720"},
    {"name": "duration", "value": "5"},
    ...
  ],
  "files": [
    {"isVideo": false, "imgUrl": "https://..."},
    {"isVideo": true, "video_url": "https://..."}
  ],
  // 其他自定义字段（如 frames, duration, movement 等）
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 用户提示词（也支持 `content` 作为同义） |
| model | string | 是 | 模型 code，对应表 `zhs_ai_model_info_unify.code`（也支持 `model_id`） |
| user_uuid | string | 否 | 用户UUID，用于Token校验 |
| chat_id | string | 否 | 聊天ID |
| zidingyican | array | 否 | 自定义参数数组，每个元素包含 `name` 和 `value` |
| files | array | 否 | 图片/视频数组，元素格式：`{"isVideo": false, "imgUrl": "..."}` 或 `{"isVideo": true, "video_url": "..."}` |

**示例**：

```json
{
  "frames": 121,
  "orientation": 0,
  "duration": "5",
  "movement": "平移",
  "prompt": "西游记 蜘蛛精洗澡",
  "model": "wan2.5-i2v-preview",
  "user_uuid": "a22826ad-0b25-4458-bd84-7b8b55a981aa",
  "chat_id": "1149",
  "zidingyican": [
    {"name": "size", "value": "1280*720"},
    {"name": "duration", "value": "5"},
    {"name": "watermark", "value": false}
  ]
}
```

### 服务端推送（出参）

均为 **JSON 文本** 消息，简化格式：

**开始生成**：
```json
{"type": "response_start"}
```

**流式内容片段**：
```json
{"type": "response_chunk", "content": "文本片段"}
```

**完成**：
```json
{"type": "response_complete"}
```

**错误**：
```json
{"type": "error", "message": "错误信息"}
```

**消息类型**：

| type | 说明 |
|------|------|
| response_start | 开始返回内容 |
| response_chunk | 流式内容片段（含 `content` 字段） |
| response_complete | 流式输出完成 |
| error | 错误（含 `message` 字段） |

---

## 汇总

| 方式 | 方法 | 地址 | 用途 |
|------|------|------|------|
| HTTP | POST | `/cozeZhsApi/langchain/chat` | 非流式一问一答 |
| WebSocket | WS | `/cozeZhsApi/langchain/ws` | 流式一问一答 |

模型是否支持 HTTP/WebSocket 由表 `zhs_ai_model_info_unify` 的 `quest_type` 决定：`http` 仅允许 HTTP，`socket` 仅允许 WebSocket。
