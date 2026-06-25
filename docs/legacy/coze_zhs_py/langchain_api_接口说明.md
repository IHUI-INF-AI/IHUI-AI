# LangChain 统一 LLM 接口 — 接口地址与出入参

**路由前缀**：`/cozeZhsApi/langchain`  
**完整地址**：`{BASE_URL}/cozeZhsApi/langchain/...`（BASE_URL 为服务根地址，如 `http://localhost:8000`）

---

## 1. HTTP 非流式聊天接口

### 请求地址

```
POST /cozeZhsApi/langchain/chat
```

### 入参（JSON Body）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 用户提示词 |
| model_id | string | 是 | 模型 code，对应表 `zhs_ai_model_info_unify.code` |
| user_uuid | string | 否 | 用户UUID，用于Token校验 |
| chat_id | string | 否 | 聊天ID |
| files | array | 否 | 图片/视频数组，元素格式见下 |
| zidingyican | array | 否 | 自定义参数数组，元素格式见下 |

**files 元素格式**：
- 图片：`{ "isVideo": false, "imgUrl": "https://..." }`
- 视频：`{ "isVideo": true, "video_url": "https://..." }`

**zidingyican 元素格式**：
- `{ "name": "temperature", "value": 0.7 }`
- `{ "name": "max_tokens", "value": 2000 }`
- 其他自定义参数...

**请求示例**：

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

### 出参（成功，HTTP 200）

**统一格式**：接口始终返回 **思考过程（thinking）** 与 **LLM 结果（content）**，便于客户端统一展示。

```json
{
  "code": 0,
  "data": {
    "content": "模型返回的最终答案文本",
    "thinking": "思考过程/推理过程（豆包深度思考、通义千问 reasoning 等，无则为空字符串）",
    "model": "模型名称"
  }
}
```

| 字段 | 说明 |
|------|------|
| data.content | 最终回答内容；若模型在文本中带 `<think>...</think>`，会拆出到 thinking，content 仅保留答案部分 |
| data.thinking | 思考过程；DashScope（Qwen3）开启 enable_thinking 时为 reasoning 摘要；豆包等为 `<think>` 内或空 |
| data.model | 模型 code |

### 错误响应

| HTTP状态码 | 说明 |
|-----------|------|
| 400 | 此模型仅支持 WebSocket 接口（quest_type 为 socket 时走 HTTP） |
| 402 | Token余额不足 |
| 404 | 模型不存在（未命中数据库），detail 为「当前不存在」 |
| 408 | 任务模式下等待任务完成超时 |
| 500 | 内部错误或任务执行失败 |

---

## 2. WebSocket 流式聊天接口

### 请求地址

```
WS /cozeZhsApi/langchain/ws
```

### 入参（连接后发送 JSON 文本消息）

**扁平格式，直接发送 JSON**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| prompt | string | 是 | 用户提示词（也支持 `content` 作为同义） |
| model | string | 是 | 模型 code，对应表 `zhs_ai_model_info_unify.code`（也支持 `model_id`） |
| user_uuid | string | 否 | 用户UUID，用于Token校验 |
| chat_id | string | 否 | 聊天ID |
| zidingyican | array | 否 | 自定义参数数组，每个元素包含 `name` 和 `value` |
| files | array | 否 | 图片/视频数组，元素格式见下 |
| ... | any | 否 | 其他自定义字段（如 frames, duration, movement 等），会传递给任务模式 |

**files 元素格式**：
- 图片：`{ "isVideo": false, "imgUrl": "https://..." }`
- 视频：`{ "isVideo": true, "video_url": "https://..." }`

**请求示例**：

```json
{
  "frames": 121,
  "orientation": 0,
  "duration": "5",
  "movement": "平移",
  "enhance_clarity": false,
  "scale": 0,
  "prompt": "西游记 蜘蛛精洗澡",
  "model": "wan2.5-i2v-preview",
  "prompt_extend": true,
  "watermark": false,
  "user_uuid": "a22826ad-0b25-4458-bd84-7b8b55a981aa",
  "chat_id": "1149",
  "zidingyican": [
    {"name": "negative_prompt", "desc": "反向提示词", "value": ""},
    {"name": "audio_url", "desc": "音频文件", "value": ""},
    {"name": "size", "desc": "尺寸", "value": "1280*720"},
    {"name": "duration", "desc": "时长/秒", "value": "5"},
    {"name": "prompt_extend", "desc": "智能改写", "value": false},
    {"name": "watermark", "desc": "水印", "value": false},
    {"name": "seed", "desc": "自由度", "value": "0"},
    {"name": "audio", "desc": "音频", "value": false}
  ]
}
```

### 出参（服务端推送 JSON 文本消息）

**统一约定**：客户端可收到两类内容——**思考过程（thinking）** 与 **LLM 结果（answer）**，通过 `data.type` 区分。

**推送格式（对齐豆包风格）**：

每条消息为 JSON，包含 `event` 与 `data`：

| event | data.type | 说明 |
|-------|-----------|------|
| conversation.chat.created | conversation_created | 会话创建，开始生成 |
| conversation.message.delta | thinking / thinking_summary | 思考过程片段（豆包深度思考、Qwen3 reasoning 等） |
| conversation.chat.completed | answer | LLM 最终答案片段 |
| system.error | error | 错误 |

**data 结构示例**：

```json
{
  "code": 200,
  "msg": "success",
  "event": "conversation.message.delta",
  "data": {
    "id": "msg_xxx",
    "conversation_id": "",
    "bot_id": "模型code",
    "role": "assistant",
    "type": "thinking",
    "content": "思考过程文本片段",
    "content_type": "text",
    "chat_id": "",
    "created_at": "ISO8601"
  }
}
```

- `data.type === "thinking"` 或 `"thinking_summary"`：思考过程，可拼接后展示在「推理/思考」区域。
- `data.type === "answer"`：最终回答，可拼接后展示在「回答」区域。

**错误**：`event === "system.error"` 时，`data.type` 为 `error`，`data.content` 为错误说明。

**完整交互流程示例**：

```
客户端 -> 服务端: {"prompt": "9.9和9.11哪个大？", "model": "qwen-plus"}
服务端 -> 客户端: {"event": "conversation.chat.created", "data": { "type": "conversation_created", ... }}
服务端 -> 客户端: {"event": "conversation.message.delta", "data": { "type": "thinking", "content": "比较小数..." }}
服务端 -> 客户端: {"event": "conversation.message.delta", "data": { "type": "answer", "content": "9.11" }}
服务端 -> 客户端: {"event": "conversation.message.delta", "data": { "type": "answer", "content": " 更大。" }}
（流式结束后可能再推送 thinking_summary 或完成标记，视实现而定）
```

---

## 接口汇总

| 方式 | 方法 | 地址 | 用途 |
|------|------|------|------|
| HTTP | POST | `/cozeZhsApi/langchain/chat` | 非流式一问一答 |
| WebSocket | WS | `/cozeZhsApi/langchain/ws` | 流式一问一答 |

**注意事项**：
- 模型是否支持 HTTP/WebSocket 由表 `zhs_ai_model_info_unify` 的 `quest_type` 字段决定：
  - `quest_type = "http"`：仅允许 HTTP 接口
  - `quest_type = "socket"`：仅允许 WebSocket 接口
- 自定义字段（如 `frames`, `duration`, `movement` 等）在任务模式下会传递给 curl 配置的模板变量
