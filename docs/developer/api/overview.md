# API 概览

> IHUI-AI 平台对外开放 **105 个** `/v1/*` API 端点,采用 OpenAI 兼容响应格式,camelCase 字段命名。所有端点统一三重鉴权:`requireApiKeyAuth` + `requireApiKeyPermission` + `requireApiKeyQuota`。

## 基础信息

### API 地址

```
http://localhost:8802/v1
```

> 生产环境以部署配置为准。

### 协议

- **协议** — HTTPS(生产)/ HTTP(本地开发)
- **方法** — RESTful(GET, POST, PUT, DELETE)
- **数据格式** — JSON,UTF-8
- **字段命名** — camelCase(与 `@ihui/types` 契约一致,非 OpenAI snake_case)

## 鉴权

使用 API Key 鉴权,支持两种 Header(任选其一):

```http
Authorization: Bearer ihui_xxx
```

或

```http
X-Api-Key: ihui_xxx
```

可选 Secret 二次校验(创建/轮换时返回,SHA-256 哈希存储):

```http
X-Api-Secret: sk_xxx
```

详见 [身份认证](../getting-started/authentication.md)。

## 响应格式

### 成功响应

`/v1/*` 端点采用 OpenAI 兼容格式,直接返回数据对象,无 `{ code, message, data }` 外层包裹:

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
| 201 | 资源创建成功(文件上传等) |
| 202 | 异步任务已接受(图像/视频生成) |
| 204 | 无内容(删除成功) |
| 400 | 请求参数错误 |
| 401 | 未授权(API Key 无效或已吊销) |
| 403 | 权限不足(缺少所需权限点) |
| 404 | 资源不存在 |
| 429 | 配额超限或频率限制 |
| 500 | 服务器错误 |
| 502 | 上游 AI 服务错误 |
| 503 | AI 服务不可用 |

## 27 权限点

API Key 创建时需从以下 **27 个** 权限点中选择授予:

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `agents:read` | 读取 Agent 列表/详情/任务状态/会话 | `GET /v1/agents` `GET /v1/agents/:id` `GET /v1/agents/tasks/:id/status` `GET /v1/agents/sessions` `DELETE /v1/agents/sessions/:id` |
| `agents:call` | 调用 Agent / 高级执行 / Pipeline / 并行 / 取消任务 | `POST /v1/agents/:id/call` `POST /v1/agents/execute` `POST /v1/agents/execute/stream` `POST /v1/agents/tasks/:id/cancel` `POST /v1/agents/pipeline` `POST /v1/agents/parallel` `POST /v1/agents/decompose` |
| `chat:read` | 读取 Chat 会话 | `GET /v1/chat/sessions` |
| `chat:write` | 发起 Chat 补全 / 视觉理解 / MOA | `POST /v1/chat/completions` `POST /v1/chat/vision` `POST /v1/chat/moa` |
| `models:read` | 读取模型列表/详情/厂商模型/MoA 预设/用户模型 | `GET /v1/models` `GET /v1/models/:id` `GET /v1/vendors/:vendor/models` `GET /v1/moa-presets` `GET /v1/user/models` |
| `models:write` | 创建/更新/删除用户模型 + MoA 预设 | `POST /v1/user/models` `PUT /v1/user/models/:id` `DELETE /v1/user/models/:id` `POST /v1/moa-presets` |
| `embeddings:write` | Embedding 向量生成 | `POST /v1/embeddings` |
| `files:read` | 读取文件列表/详情/内容/版本 | `GET /v1/files` `GET /v1/files/:id` `GET /v1/files/:id/content` `GET /v1/files/:id/versions` |
| `files:write` | 上传/删除文件 + 分片上传 | `POST /v1/files` `DELETE /v1/files/:id` `POST /v1/files/upload-init` `POST /v1/files/upload-chunk` `POST /v1/files/complete` |
| `audio:read` | 读取音色/声纹列表/声纹比对 | `GET /v1/audio/voices` `GET /v1/audio/speakers` `POST /v1/audio/speakers/compare` |
| `audio:write` | TTS / ASR / 语音对话 / 声纹注册 / 音乐生成 | `POST /v1/audio/speech` `POST /v1/audio/transcriptions` `POST /v1/audio/chat` `POST /v1/audio/speakers` `POST /v1/audio/music` |
| `images:write` | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 | `POST /v1/images/generations` `POST /v1/images/edits` `POST /v1/images/inpaint` `POST /v1/images/style-transfer` `POST /v1/images/virtual-try-on` `POST /v1/images/background` |
| `videos:write` | 视频生成 / 编排 | `POST /v1/videos/generations` `POST /v1/videos/compose` |
| `videos:read` | 视频任务查询 | `GET /v1/videos/tasks/:id` |
| `threed:write` | 3D 模型生成 | `POST /v1/3d/generations` |
| `generation:write` | 生成队列入队/状态/取消 | `POST /v1/generation/enqueue` `GET /v1/generation/status/:id` `POST /v1/generation/cancel/:id` |
| `knowledge:read` | 知识库文档/分块/搜索/RAG/图谱数据/健康检查 | `GET /v1/knowledge/health` `GET /v1/knowledge/documents` `GET /v1/knowledge/documents/:id` `GET /v1/knowledge/documents/:id/chunks` `POST /v1/knowledge/search` `POST /v1/knowledge/rag-context` `GET /v1/knowledge-graph/data` |
| `knowledge:write` | 文档入库/删除/批量删除/图谱抽取/构建/清空 | `POST /v1/knowledge/documents` `DELETE /v1/knowledge/documents/:id` `POST /v1/knowledge/documents/batch-delete` `POST /v1/knowledge-graph/extract` `POST /v1/knowledge-graph/build` `DELETE /v1/knowledge-graph/data` |
| `tools:read` | MCP 工具/资源/提示词/技能/slash命令/人格查询 | `GET /v1/tools` `GET /v1/resources` `GET /v1/resources/:uri` `GET /v1/prompts` `GET /v1/skills` `GET /v1/slash-commands` `GET /v1/personas` `GET /v1/personas/:name` |
| `tools:call` | 调用工具/提示词/slash命令/sampling/搜索/截图 | `POST /v1/tools/call` `POST /v1/prompts/invoke` `POST /v1/slash-commands` `POST /v1/sampling` `POST /v1/tools/search-codebase` `POST /v1/tools/search-web` `POST /v1/tools/analyze-code` `POST /v1/screenshot` |
| `memory:read` | 记忆召回/语义搜索/分类记忆 | `GET /v1/memory` `POST /v1/memory/search` `GET /v1/memory/working` `GET /v1/memory/episodic` `GET /v1/memory/procedural` |
| `memory:write` | 保存/遗忘记忆 + Dream 梦境 | `POST /v1/memory` `DELETE /v1/memory` `POST /v1/memory/dream` |
| `messages:read` | 消息状态查询 | `GET /v1/messages/:id/status` |
| `messages:write` | 消息发布/订阅/取消订阅 | `POST /v1/messages` `POST /v1/messages/subscribe` `DELETE /v1/messages/subscribe/:id` |
| `user:read` | 当前用户信息 + 配额 | `GET /v1/me` |
| `workspace:read` | 工作区项目/文件 | `GET /v1/projects` `GET /v1/projects/:id/files` |
| `workflows:read` | 工作流定义查询 | `GET /v1/workflows/:id` |
| `workflows:write` | 工作流实例执行 + Coze/n8n | `POST /v1/workflows/instances` `POST /v1/workflows/coze/run` `POST /v1/workflows/n8n/run` |
| `stats:read` | 使用量统计 | `GET /v1/usage` `GET /v1/usage/:vendor` |

## 105 端点完整清单

### AI 核心(13 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/chat/completions` | POST | `chat:write` | Chat 补全(OpenAI 兼容,支持 stream) |
| `/v1/chat/vision` | POST | `chat:write` | 视觉理解(图片描述) |
| `/v1/chat/moa` | POST | `chat:write` | Mixture of Agents 多模型聚合 |
| `/v1/chat/sessions` | GET | `chat:read` | Chat 会话列表 |
| `/v1/embeddings` | POST | `embeddings:write` | Embedding 向量生成 |
| `/v1/models` | GET | `models:read` | 模型列表 |
| `/v1/models/:id` | GET | `models:read` | 模型详情 |
| `/v1/vendors/:vendor/models` | GET | `models:read` | 厂商模型列表 |
| `/v1/moa-presets` | GET | `models:read` | MoA 预设列表 |
| `/v1/moa-presets` | POST | `models:write` | 创建 MoA 预设 |
| `/v1/user/models` | GET | `models:read` | 用户自定义模型列表 |
| `/v1/user/models` | POST | `models:write` | 创建用户模型 |
| `/v1/user/models/:id` | PUT/DELETE | `models:write` | 更新/删除用户模型 |

### 智能体(12 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/agents` | GET | `agents:read` | Agent 列表 |
| `/v1/agents/:id` | GET | `agents:read` | Agent 详情 |
| `/v1/agents/:id/call` | POST | `agents:call` | 调用 Agent |
| `/v1/agents/execute` | POST | `agents:call` | Agent 高级执行(PermissionGuard) |
| `/v1/agents/execute/stream` | POST | `agents:call` | Agent 流式执行(SSE) |
| `/v1/agents/tasks/:id/status` | GET | `agents:read` | 任务状态 |
| `/v1/agents/tasks/:id/cancel` | POST | `agents:call` | 取消任务 |
| `/v1/agents/sessions` | GET | `agents:read` | 会话列表 |
| `/v1/agents/sessions/:id` | DELETE | `agents:read` | 删除会话 |
| `/v1/agents/pipeline` | POST | `agents:call` | Pipeline 编排 |
| `/v1/agents/parallel` | POST | `agents:call` | 并行执行 |
| `/v1/agents/decompose` | POST | `agents:call` | 任务分解 |

### 文件(9 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/files` | GET | `files:read` | 文件列表 |
| `/v1/files` | POST | `files:write` | 上传文件(multipart) |
| `/v1/files/:id` | GET | `files:read` | 文件详情 |
| `/v1/files/:id` | DELETE | `files:write` | 删除文件 |
| `/v1/files/:id/content` | GET | `files:read` | 文件内容(二进制流) |
| `/v1/files/:id/versions` | GET | `files:read` | 文件版本 |
| `/v1/files/upload-init` | POST | `files:write` | 分片上传初始化 |
| `/v1/files/upload-chunk` | POST | `files:write` | 上传分片 |
| `/v1/files/complete` | POST | `files:write` | 完成分片上传 |

### 音频(8 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/audio/voices` | GET | `audio:read` | 音色列表 |
| `/v1/audio/speech` | POST | `audio:write` | TTS 语音合成 |
| `/v1/audio/transcriptions` | POST | `audio:write` | ASR 语音识别 |
| `/v1/audio/chat` | POST | `audio:write` | 语音对话 |
| `/v1/audio/speakers` | GET | `audio:read` | 声纹列表 |
| `/v1/audio/speakers` | POST | `audio:write` | 声纹注册 |
| `/v1/audio/speakers/compare` | POST | `audio:read` | 声纹比对 |
| `/v1/audio/music` | POST | `audio:write` | 音乐生成 |

### 图像(6 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/images/generations` | POST | `images:write` | 文生图 |
| `/v1/images/edits` | POST | `images:write` | 图片编辑 |
| `/v1/images/inpaint` | POST | `images:write` | 图片修复 |
| `/v1/images/style-transfer` | POST | `images:write` | 风格迁移 |
| `/v1/images/virtual-try-on` | POST | `images:write` | 虚拟试穿 |
| `/v1/images/background` | POST | `images:write` | 背景生成 |

### 视频 / 3D / 生成队列(7 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/videos/generations` | POST | `videos:write` | 视频生成 |
| `/v1/videos/tasks/:id` | GET | `videos:read` | 视频任务查询 |
| `/v1/videos/compose` | POST | `videos:write` | 视频编排 |
| `/v1/3d/generations` | POST | `threed:write` | 3D 模型生成 |
| `/v1/generation/enqueue` | POST | `generation:write` | 生成队列入队 |
| `/v1/generation/status/:id` | GET | `generation:write` | 生成队列状态 |
| `/v1/generation/cancel/:id` | POST | `generation:write` | 生成队列取消 |

### 知识库 / RAG / 知识图谱(13 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/knowledge/health` | GET | `knowledge:read` | 健康检查 |
| `/v1/knowledge/documents` | GET | `knowledge:read` | 文档列表 |
| `/v1/knowledge/documents` | POST | `knowledge:write` | 文档入库 |
| `/v1/knowledge/documents/:id` | GET | `knowledge:read` | 文档详情 |
| `/v1/knowledge/documents/:id/chunks` | GET | `knowledge:read` | 文档分块 |
| `/v1/knowledge/documents/:id` | DELETE | `knowledge:write` | 删除文档 |
| `/v1/knowledge/documents/batch-delete` | POST | `knowledge:write` | 批量删除 |
| `/v1/knowledge/search` | POST | `knowledge:read` | 语义搜索 |
| `/v1/knowledge/rag-context` | POST | `knowledge:read` | RAG 上下文检索 |
| `/v1/knowledge-graph/extract` | POST | `knowledge:write` | 图谱抽取 |
| `/v1/knowledge-graph/build` | POST | `knowledge:write` | 图谱构建 |
| `/v1/knowledge-graph/data` | GET | `knowledge:read` | 图谱数据 |
| `/v1/knowledge-graph/data` | DELETE | `knowledge:write` | 清空图谱 |

### MCP 工具(16 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/tools` | GET | `tools:read` | MCP 工具列表 |
| `/v1/tools/call` | POST | `tools:call` | 调用工具 |
| `/v1/resources` | GET | `tools:read` | 资源列表 |
| `/v1/resources/:uri` | GET | `tools:read` | 资源详情 |
| `/v1/prompts` | GET | `tools:read` | 提示词列表 |
| `/v1/prompts/invoke` | POST | `tools:call` | 调用提示词 |
| `/v1/skills` | GET | `tools:read` | 技能列表 |
| `/v1/slash-commands` | GET | `tools:read` | slash 命令列表 |
| `/v1/slash-commands` | POST | `tools:call` | 执行 slash 命令 |
| `/v1/sampling` | POST | `tools:call` | 模型采样 |
| `/v1/personas` | GET | `tools:read` | 人格列表 |
| `/v1/personas/:name` | GET | `tools:read` | 人格详情 |
| `/v1/tools/search-codebase` | POST | `tools:call` | 代码库搜索 |
| `/v1/tools/search-web` | POST | `tools:call` | 网页搜索 |
| `/v1/tools/analyze-code` | POST | `tools:call` | 代码分析 |
| `/v1/screenshot` | POST | `tools:call` | 网页截图 |

### 记忆 / 消息(12 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/memory` | POST | `memory:write` | 保存记忆 |
| `/v1/memory` | GET | `memory:read` | 召回记忆 |
| `/v1/memory/search` | POST | `memory:read` | 语义搜索记忆 |
| `/v1/memory/dream` | POST | `memory:write` | Dream 梦境系统 |
| `/v1/memory` | DELETE | `memory:write` | 遗忘记忆 |
| `/v1/memory/working` | GET | `memory:read` | 工作记忆 |
| `/v1/memory/episodic` | GET | `memory:read` | 情景记忆 |
| `/v1/memory/procedural` | GET | `memory:read` | 程序记忆 |
| `/v1/messages` | POST | `messages:write` | 发布消息 |
| `/v1/messages/subscribe` | POST | `messages:write` | 订阅频道 |
| `/v1/messages/subscribe/:id` | DELETE | `messages:write` | 取消订阅 |
| `/v1/messages/:id/status` | GET | `messages:read` | 消息状态 |

### 用户 / 工作区 / 工作流 / 统计(9 端点)

| 端点 | 方法 | 权限点 | 说明 |
|------|------|--------|------|
| `/v1/me` | GET | `user:read` | 当前用户 + 配额 |
| `/v1/projects` | GET | `workspace:read` | 项目列表 |
| `/v1/projects/:id/files` | GET | `workspace:read` | 项目文件 |
| `/v1/workflows/:id` | GET | `workflows:read` | 工作流详情 |
| `/v1/workflows/instances` | POST | `workflows:write` | 运行工作流 |
| `/v1/workflows/coze/run` | POST | `workflows:write` | Coze 工作流 |
| `/v1/workflows/n8n/run` | POST | `workflows:write` | n8n 工作流 |
| `/v1/usage` | GET | `stats:read` | 用量统计 |
| `/v1/usage/:vendor` | GET | `stats:read` | 厂商用量 |

## 速率限制

- API Key 创建时可设置每分钟请求上限(默认 60)
- 配额按小时 / 天双维度统计,超限返回 429
- 响应头含 `Retry-After`(秒数),表示建议重试等待时间

---

*最后更新: 2026-07-22*
