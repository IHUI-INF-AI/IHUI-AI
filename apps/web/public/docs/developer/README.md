# IHUI-AI 开发者文档

> IHUI-AI 平台对外开放 **105 个** `/v1/*` API 端点,覆盖对话、向量、模型、智能体、文件、音频、图像、视频、3D、生成队列、知识库、MCP 工具、记忆、消息、用户工作区共 13 大功能模块。本目录为第三方开发者提供完整接入文档。

## 快速开始

1. **获取 API Key** — 登录管理后台 → 开发者中心 → 创建密钥(从 27 个权限点中选择授予)。详见 [身份认证](./getting-started/authentication.md)。
2. **安装 SDK** — TypeScript 用 `@ihui/sdk`,Python 用 `ihui-ai`。详见 [环境配置](./getting-started/setup.md)。
3. **发起首个请求**:

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'
```

## 文档导航

### 入门

- [平台介绍](./getting-started/introduction.md) — 功能矩阵与能力概览
- [身份认证](./getting-started/authentication.md) — API Key 鉴权 + 27 权限点
- [环境配置](./getting-started/setup.md) — SDK 安装与初始化

### API 参考(13 模块 / 105 端点)

| 模块 | 文档 | 端点数 | 权限点 |
|------|------|--------|--------|
| AI 核心(对话/向量/模型/MOA) | [chat.md](./api/chat.md) · [embeddings.md](./api/embeddings.md) · [models.md](./api/models.md) | 13 | `chat:read` `chat:write` `models:read` `models:write` `embeddings:write` |
| 智能体 | [agents.md](./api/agents.md) | 12 | `agents:read` `agents:call` |
| 文件 | [files.md](./api/files.md) | 9 | `files:read` `files:write` |
| 音频 | [audio.md](./api/audio.md) | 8 | `audio:read` `audio:write` |
| 图像 | [images.md](./api/images.md) | 6 | `images:write` |
| 视频 | [videos.md](./api/videos.md) | 3 | `videos:write` `videos:read` |
| 3D 模型 | [threed.md](./api/threed.md) | 1 | `threed:write` |
| 生成队列 | [generation.md](./api/generation.md) | 3 | `generation:write` |
| 知识库 / RAG / 图谱 | [knowledge.md](./api/knowledge.md) | 13 | `knowledge:read` `knowledge:write` |
| MCP 工具 | [tools.md](./api/tools.md) | 16 | `tools:read` `tools:call` |
| 记忆 | [memory.md](./api/memory.md) | 8 | `memory:read` `memory:write` |
| 消息 | [messages.md](./api/messages.md) | 4 | `messages:read` `messages:write` |
| 用户/工作区/工作流/统计 | [user.md](./api/user.md) | 9 | `user:read` `workspace:read` `workflows:read` `workflows:write` `stats:read` |

- [API 概览](./api/overview.md) — 105 端点完整清单
- [错误处理](./api/error-handling.md) — 错误码 + 配额超限示例

### SDK

- [JavaScript / TypeScript SDK](./sdk/javascript.md) — `@ihui/sdk`
- [Python SDK](./sdk/python.md) — `ihui-ai`
- [cURL 示例](./sdk/curl.md) — 105 端点代表性子集

### 实践

- [最佳实践](./best-practices.md) — 重试、缓存、流式处理
- [故障排查](./troubleshooting.md) — 常见问题与调试技巧

## 核心约定

- **协议** — HTTPS,RESTful(GET/POST/PUT/DELETE)
- **数据格式** — JSON,UTF-8
- **字段命名** — camelCase(与 `@ihui/types` 契约一致,非 OpenAI snake_case)
- **鉴权** — `Authorization: Bearer ihui_xxx` 或 `X-Api-Key: ihui_xxx`,可选 `X-Api-Secret: sk_xxx`
- **响应格式** — OpenAI 兼容,直接返回数据对象,无 `{ code, message, data }` 外层包裹
- **baseUrl** — 本地开发用 `http://localhost:3001`,生产以部署环境为准

---

*最后更新: 2026-07-22*
