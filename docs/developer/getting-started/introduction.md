# 平台介绍

> IHUI-AI 是全栈 AI 平台,对外开放 **105 个** `/v1/*` API 端点,覆盖对话、向量、模型、智能体、文件、音频、图像、视频、3D、生成队列、知识库、MCP 工具、记忆、消息、用户工作区共 **13 大功能模块**,采用 OpenAI 兼容响应格式。本指南帮助开发者快速了解平台能力矩阵与接入方式。

## 能力矩阵

| 模块 | 端点数 | 权限点 | 核心能力 |
|------|--------|--------|----------|
| AI 核心 | 13 | `chat:read` `chat:write` `models:read` `models:write` `embeddings:write` | Chat 补全(流式)/ 视觉理解 / MOA 多模型聚合 / Embedding 向量 / 模型 CRUD / 厂商模型 / MoA 预设 |
| 智能体 | 12 | `agents:read` `agents:call` | Agent 列表 / 调用 / 高级执行 / 流式执行 / Pipeline 编排 / 并行执行 / 任务分解 / 会话管理 |
| 文件 | 9 | `files:read` `files:write` | 文件上传(multipart)/ 分片上传(3 步)/ 列表 / 详情 / 内容 / 版本 / 删除 |
| 音频 | 8 | `audio:read` `audio:write` | TTS 语音合成 / ASR 语音识别 / 语音对话 / 声纹注册 / 声纹比对 / 音乐生成 |
| 图像 | 6 | `images:write` | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景生成 |
| 视频 | 3 | `videos:write` `videos:read` | 视频生成 / 任务查询 / 视频编排 |
| 3D 模型 | 1 | `threed:write` | 文本/图像生成 3D 模型 |
| 生成队列 | 3 | `generation:write` | 异步任务入队 / 状态查询 / 取消 |
| 知识库 / RAG / 图谱 | 13 | `knowledge:read` `knowledge:write` | 文档入库 / 分块 / 语义搜索 / RAG 上下文 / 知识图谱抽取/构建/查询 |
| MCP 工具 | 16 | `tools:read` `tools:call` | MCP 工具调用 / 资源 / 提示词 / 技能 / slash 命令 / 人格 / 代码库搜索 / 网页搜索 / 截图 |
| 记忆 | 8 | `memory:read` `memory:write` | 记忆保存 / 召回 / 语义搜索 / 工作记忆 / 情景记忆 / 程序记忆 / Dream 梦境 |
| 消息 | 4 | `messages:read` `messages:write` | 消息发布 / 订阅 / 取消订阅 / 状态查询 |
| 用户/工作区/工作流/统计 | 9 | `user:read` `workspace:read` `workflows:read` `workflows:write` `stats:read` | 当前用户 / 项目列表 / 工作流执行 / Coze / n8n / 用量统计 |

## 核心特性

### OpenAI 兼容

`POST /v1/chat/completions`、`GET /v1/models`、`POST /v1/embeddings` 等核心端点与 OpenAI API 响应格式兼容,可直接替换 `baseUrl` 复用现有 OpenAI 客户端代码。差异:字段采用 camelCase(如 `promptTokens` 而非 `prompt_tokens`),与 `@ihui/types` 契约一致。

### 三重鉴权

所有端点经过三层 preHandler:`requireApiKeyAuth` → `requireApiKeyPermission` → `requireApiKeyQuota`。API Key 创建时从 27 个权限点中选择授予,实现最小权限原则。详见 [身份认证](./authentication.md)。

### 流式响应

`POST /v1/chat/completions`(stream=true)和 `POST /v1/agents/execute/stream` 支持 SSE(Server-Sent Events)流式输出,`Content-Type: text/event-stream`,每行 `data: {JSON}\n\n`,以 `data: [DONE]` 结束。

### 异步任务

图像/视频/3D 生成采用异步模式:提交任务返回 `202 Accepted` + taskId,通过 `GET /v1/videos/tasks/:id` 或 `GET /v1/generation/status/:id` 轮询状态。

### 内部路由

AI 调用类端点(chat/embeddings/agents/多模态)内部转发到 `ai-service`(FastAPI + LangGraph + LiteLLM),使用短期 JWT 进行服务间鉴权。开发者无需感知,只需调用 `/v1/*` 即可。

## 快速开始

1. **获取 API Key** — 登录管理后台 → 设置 → API 密钥 → 创建密钥(从 27 个权限点中选择)。详见 [身份认证](./authentication.md)。
2. **安装 SDK** — `npm install @ihui/sdk`(TypeScript)或 `pip install ihui-ai`(Python)。详见 [环境配置](./setup.md)。
3. **发起首个请求** — 参考 [API 概览](../api/overview.md) 选择端点,或直接复制下方示例。

### cURL 示例

```bash
curl -X POST http://localhost:8802/v1/chat/completions \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'
```

## 技术栈

- **协议** — HTTPS(生产)/ HTTP(本地开发),RESTful(GET/POST/PUT/DELETE)
- **数据格式** — JSON,UTF-8
- **字段命名** — camelCase(与 `@ihui/types` 契约一致)
- **鉴权** — `Authorization: Bearer ihui_xxx` 或 `X-Api-Key: ihui_xxx`,可选 `X-Api-Secret: sk_xxx`
- **响应格式** — OpenAI 兼容,直接返回数据对象,无 `{ code, message, data }` 外层包裹
- **baseUrl** — `http://localhost:8802/v1`(本地开发),生产以部署环境为准

## SDK 支持

| 语言 | 包名 | 安装 | 入口 |
|------|------|------|------|
| TypeScript / JavaScript | `@ihui/sdk` | `npm install @ihui/sdk` | `createClient(config): IhuiClient` |
| Python | `ihui-ai` | `pip install ihui-ai` | `create_client(config) -> IhuiClient` |
| 任意 HTTP 语言 | — | — | 直接调用 RESTful 端点,参考 [cURL 示例](../sdk/curl.md) |

SDK 内置 13 个模块(`ai` / `agents` / `files` / `audio` / `images` / `videos` / `threed` / `generation` / `knowledge` / `tools` / `memory` / `messages` / `user`),每个模块封装对应端点,自动处理鉴权 Header、错误重试、SSE 流解析。

## 相关文档

- [身份认证](./authentication.md) — 27 权限点 + API Key 创建/轮换
- [环境配置](./setup.md) — SDK 安装与初始化
- [API 概览](../api/overview.md) — 105 端点完整清单
- [JavaScript SDK](../sdk/javascript.md) / [Python SDK](../sdk/python.md) / [cURL 示例](../sdk/curl.md)

---

*最后更新: 2026-07-22*
