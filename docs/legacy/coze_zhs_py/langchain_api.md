# LangChain 统一 LLM 调用接口说明

## 概述

通过 `model_id` 从数据库查询 LLM 配置，支持：
- **langchain 类型**：OpenAI 兼容接口（api_base、api_key、model_name）
- **curl 类型**：原始 HTTP 调用（method、url、headers、body_template）

## 双入口

| 方式 | 路径 | 说明 |
|------|------|------|
| HTTP 非流式 | `POST /cozeZhsApi/langchain/chat` | 一次性返回完整回答 |
| WebSocket 流式 | `WS /cozeZhsApi/langchain/ws` | 流式返回回答内容 |

## 数据库配置（不建新表）

使用现有表 **zhs_ai_model_info**：按 `model_id` 与表的 `id` 或 `name` 匹配，解析 **variables** 字段（JSON）。

### variables 结构

**langchain 示例**：
```json
{
  "type": "langchain",
  "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "api_key": "sk-xxx",
  "model_name": "qwen3-max-2026-01-23",
  "temperature": 0.7,
  "max_tokens": 2000
}
```

**curl 示例**：
```json
{
  "type": "curl",
  "method": "POST",
  "url": "https://api.xxx.com/v1/chat/completions",
  "headers": {
    "Authorization": "Bearer {{api_key}}",
    "Content-Type": "application/json"
  },
  "body_template": "{\"model\":\"{{model}}\",\"messages\":{{messages}}}"
}
```

占位符：`{{model}}`、`{{messages}}`、`{{api_key}}`

### 默认行为

若未命中（无记录或 variables 无效），使用通义千问默认配置，并将 `model_id` 作为 `model_name` 传入。

## HTTP 接口

### POST /cozeZhsApi/langchain/chat

**请求体**：
```json
{
  "prompt": "你好",
  "model_id": "qwen3-max",
  "user_uuid": "用户UUID（可选，用于Token校验）",
  "chat_id": "",
  "files": null,
  "zidingyican": [{"name": "temperature", "value": 0.8}],
  "use_task": false
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "content": "回答内容",
    "model": "qwen3-max-2026-01-23"
  }
}
```

### 任务模式（多接口组合）

当 `use_task: true` 时，立即返回 `task_id`，客户端轮询：

**GET /cozeZhsApi/langchain/task/result/{task_id}**

或显式创建任务：

**POST /cozeZhsApi/langchain/task/create**
```json
{
  "model_id": "qwen3-max",
  "user_uuid": "xxx",
  "prompt": "你好",
  "chat_id": ""
}
```

返回 `task_id`，再轮询 `GET /task/result/{task_id}` 获取结果。

## WebSocket 接口

### WS /cozeZhsApi/langchain/ws

**消息格式**：

1. `start`：开始会话
```json
{"type": "start"}
```

2. `message`：发送问题（流式返回）
```json
{
  "type": "message",
  "prompt": "你好",
  "model_id": "qwen3-max",
  "user_uuid": "xxx",
  "chat_id": "",
  "zidingyican": [{"name": "temperature", "value": 0.7}]
}
```

3. `stop`：结束会话
```json
{"type": "stop"}
```

**服务端返回**：
- `response_start`：开始返回
- `response_chunk`：内容片段 `{"type": "response_chunk", "content": "..."}`
- `response_complete`：结束
- `error`：错误信息
