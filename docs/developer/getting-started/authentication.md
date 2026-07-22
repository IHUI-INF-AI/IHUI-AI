# 身份认证

> IHUI-AI 平台对外 `/v1/*` API 统一使用 API Key 鉴权。JWT 仅用于 `/api/*` 内部管理路由,不适用于对外 API。本文档覆盖鉴权方式、Secret 二次校验、API Key 创建/轮换流程,以及 **27 个权限点** 完整清单。

## 鉴权方式

支持以下两种 HTTP Header 传递 API Key(任选其一):

| Header | 格式 | 说明 |
|--------|------|------|
| `Authorization` | `Bearer ihui_xxx` | 主鉴权方式,OpenAI 兼容格式 |
| `X-Api-Key` | `ihui_xxx` | 备选方式,直接传 Key 值 |

请求未携带有效 Key → 返回 `401 Unauthorized`。Key 已吊销 → 同样 401。

### 可选 Secret 二次校验

创建或轮换 API Key 时,平台会返回一个 Secret(格式 `sk_xxx`)。对于需要更高安全性的场景,可在请求中附加 `X-Api-Key` Header 进行二次校验:

```http
X-Api-Key: ihui_xxx
X-Api-Secret: sk_xxx
```

> **注意**:Secret 仅在创建/轮换时返回一次,平台以 SHA-256 哈希存储,无法找回。请务必在收到后立即保存到密钥管理系统(如 Vault / AWS Secrets Manager / 环境变量)。

### 三重鉴权链路

所有 `/v1/*` 端点均经过三层 preHandler 中间件:

1. **`requireApiKeyAuth`** — 解析 Header 中的 API Key,查询数据库,校验状态为 `active`,注入 `request.apiKey` 上下文。
2. **`requireApiKeyPermission(perm)`** — 校验该 Key 是否持有当前端点所需的权限点(见下方 27 权限点表)。缺失 → 返回 `403 Forbidden`。
3. **`requireApiKeyQuota`** — 校验每分钟频率限制与小时/天配额。超限 → 返回 `429 Too Many Requests` + `Retry-After` 响应头。

## 获取 API Key

1. 登录 IHUI-AI 管理后台,进入「设置 → API 密钥」
2. 点击「创建密钥」
3. 设置密钥名称,从 **27 个权限点** 中勾选所需权限(最小权限原则)
4. 可选设置每分钟请求上限(默认 60)
5. 创建成功后立即复制保存:
   - **API Key**(`ihui_xxx`)— 公开标识,可展示,可多次查看
   - **Secret**(`sk_xxx`)— 仅此一次返回,后续不可查询

> 管理员也可在「开发者中心」管理所有用户的 API Key,包括重置 Secret、调整权限、吊销 Key。

## 轮换密钥

在管理后台「设置 → API 密钥」对应卡片中,点击「重置」按钮可轮换 Secret。轮换后:

- 旧 Secret 立即失效
- API Key(`ihui_xxx`)保持不变
- 新 Secret 仅显示一次,需更新所有接入方

建议每 90 天轮换一次 Secret,发生疑似泄露时立即轮换。

## 27 权限点完整列表

API Key 创建时需从以下 **27 个** 权限点中选择授予。每个权限点关联一组 `/v1/*` 端点,详见 [API 概览](../api/overview.md)。

### Agent 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `agents:read` | 读取 Agent 列表/详情/任务状态/会话 | `GET /v1/agents` `GET /v1/agents/:id` `GET /v1/agents/tasks/:id/status` `GET /v1/agents/sessions` `DELETE /v1/agents/sessions/:id` |
| `agents:call` | 调用 Agent / 高级执行 / Pipeline / 并行 / 取消任务 | `POST /v1/agents/:id/call` `POST /v1/agents/execute` `POST /v1/agents/execute/stream` `POST /v1/agents/tasks/:id/cancel` `POST /v1/agents/pipeline` `POST /v1/agents/parallel` `POST /v1/agents/decompose` |

### Chat / LLM 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `chat:read` | 读取 Chat 会话 | `GET /v1/chat/sessions` |
| `chat:write` | 发起 Chat 补全 / 视觉理解 / MOA | `POST /v1/chat/completions` `POST /v1/chat/vision` `POST /v1/chat/moa` |

### Models 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `models:read` | 读取模型列表/详情/厂商模型/MoA 预设/用户模型 | `GET /v1/models` `GET /v1/models/:id` `GET /v1/vendors/:vendor/models` `GET /v1/moa-presets` `GET /v1/user/models` |
| `models:write` | 创建/更新/删除用户模型 + MoA 预设 | `POST /v1/user/models` `PUT /v1/user/models/:id` `DELETE /v1/user/models/:id` `POST /v1/moa-presets` |

### Embeddings 类(1)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `embeddings:write` | Embedding 向量生成 | `POST /v1/embeddings` |

### Files 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `files:read` | 读取文件列表/详情/内容/版本 | `GET /v1/files` `GET /v1/files/:id` `GET /v1/files/:id/content` `GET /v1/files/:id/versions` |
| `files:write` | 上传/删除文件 + 分片上传 | `POST /v1/files` `DELETE /v1/files/:id` `POST /v1/files/upload-init` `POST /v1/files/upload-chunk` `POST /v1/files/complete` |

### Audio 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `audio:read` | 读取音色/声纹列表/声纹比对 | `GET /v1/audio/voices` `GET /v1/audio/speakers` `POST /v1/audio/speakers/compare` |
| `audio:write` | TTS / ASR / 语音对话 / 声纹注册 / 音乐生成 | `POST /v1/audio/speech` `POST /v1/audio/transcriptions` `POST /v1/audio/chat` `POST /v1/audio/speakers` `POST /v1/audio/music` |

### Images 类(1)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `images:write` | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 | `POST /v1/images/generations` `POST /v1/images/edits` `POST /v1/images/inpaint` `POST /v1/images/style-transfer` `POST /v1/images/virtual-try-on` `POST /v1/images/background` |

### Videos 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `videos:write` | 视频生成 / 编排 | `POST /v1/videos/generations` `POST /v1/videos/compose` |
| `videos:read` | 视频任务查询 | `GET /v1/videos/tasks/:id` |

### 3D 类(1)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `threed:write` | 3D 模型生成 | `POST /v1/3d/generations` |

### Generation 队列类(1)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `generation:write` | 生成队列入队/状态/取消 | `POST /v1/generation/enqueue` `GET /v1/generation/status/:id` `POST /v1/generation/cancel/:id` |

### Knowledge / RAG 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `knowledge:read` | 知识库文档/分块/搜索/RAG/图谱数据/健康检查 | `GET /v1/knowledge/health` `GET /v1/knowledge/documents` `GET /v1/knowledge/documents/:id` `GET /v1/knowledge/documents/:id/chunks` `POST /v1/knowledge/search` `POST /v1/knowledge/rag-context` `GET /v1/knowledge-graph/data` |
| `knowledge:write` | 文档入库/删除/批量删除/图谱抽取/构建/清空 | `POST /v1/knowledge/documents` `DELETE /v1/knowledge/documents/:id` `POST /v1/knowledge/documents/batch-delete` `POST /v1/knowledge-graph/extract` `POST /v1/knowledge-graph/build` `DELETE /v1/knowledge-graph/data` |

### MCP Tools 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `tools:read` | MCP 工具/资源/提示词/技能/slash命令/人格查询 | `GET /v1/tools` `GET /v1/resources` `GET /v1/resources/:uri` `GET /v1/prompts` `GET /v1/skills` `GET /v1/slash-commands` `GET /v1/personas` `GET /v1/personas/:name` |
| `tools:call` | 调用工具/提示词/slash命令/sampling/搜索/截图 | `POST /v1/tools/call` `POST /v1/prompts/invoke` `POST /v1/slash-commands` `POST /v1/sampling` `POST /v1/tools/search-codebase` `POST /v1/tools/search-web` `POST /v1/tools/analyze-code` `POST /v1/screenshot` |

### Memory 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `memory:read` | 记忆召回/语义搜索/分类记忆 | `GET /v1/memory` `POST /v1/memory/search` `GET /v1/memory/working` `GET /v1/memory/episodic` `GET /v1/memory/procedural` |
| `memory:write` | 保存/遗忘记忆 + Dream 梦境 | `POST /v1/memory` `DELETE /v1/memory` `POST /v1/memory/dream` |

### Messages 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `messages:read` | 消息状态查询 | `GET /v1/messages/:id/status` |
| `messages:write` | 消息发布/订阅/取消订阅 | `POST /v1/messages` `POST /v1/messages/subscribe` `DELETE /v1/messages/subscribe/:id` |

### User / Workspace 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `user:read` | 当前用户信息 + 配额 | `GET /v1/me` |
| `workspace:read` | 工作区项目/文件 | `GET /v1/projects` `GET /v1/projects/:id/files` |

### Workflows 类(2)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `workflows:read` | 工作流定义查询 | `GET /v1/workflows/:id` |
| `workflows:write` | 工作流实例执行 + Coze/n8n | `POST /v1/workflows/instances` `POST /v1/workflows/coze/run` `POST /v1/workflows/n8n/run` |

### Stats 类(1)

| 权限点 | 说明 | 关联端点 |
|--------|------|----------|
| `stats:read` | 使用量统计 | `GET /v1/usage` `GET /v1/usage/:vendor` |

## 鉴权示例

### cURL

```bash
# 主鉴权方式
curl -X POST http://localhost:8802/v1/chat/completions \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'

# 备选方式 + Secret 二次校验
curl -X POST http://localhost:8802/v1/chat/completions \
  -H "X-Api-Key: ihui_xxx" \
  -H "X-Api-Secret: sk_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'
```

### TypeScript(@ihui/sdk)

```typescript
import { createClient } from '@ihui/sdk'

const client = createClient({
  apiKey: 'ihui_xxx',
  secret: 'sk_xxx', // 可选,启用 Secret 二次校验
  baseUrl: 'http://localhost:8802',
})

const response = await client.ai.completions({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好' }],
})
console.log(response.choices[0].message.content)
```

### Python(ihui-ai)

```python
from ihui_ai import create_client

client = create_client({
    "apiKey": "ihui_xxx",
    "secret": "sk_xxx",  # 可选,启用 Secret 二次校验
    "baseUrl": "http://localhost:8802",
})

response = client.ai.completions(
    model="gpt-4",
    messages=[{"role": "user", "content": "你好"}],
)
print(response["choices"][0]["message"]["content"])
```

## 安全建议

- **保护 API Key** — 不要将密钥提交到代码仓库,使用 `.gitignore` 排除 `.env`
- **使用环境变量** — `IHUI_API_KEY` / `IHUI_API_SECRET`,代码中通过 `process.env` 读取
- **最小权限** — 只授予业务所需的最少权限点,避免授予 `*:write` 全集
- **定期轮换** — 每 90 天轮换 Secret,疑似泄露时立即轮换
- **监控使用** — 通过 `GET /v1/usage` 接口定期检查调用统计,发现异常调用立即吊销
- **服务端调用** — 浏览器前端切勿直接调用 `/v1/*`,API Key 会暴露;应通过自有后端代理转发

## 错误响应

### 401 未授权

```json
{
  "error": {
    "message": "Invalid or missing API key",
    "type": "authentication_error"
  }
}
```

### 403 权限不足

```json
{
  "error": {
    "message": "API key missing required permission: chat:write",
    "type": "permission_denied"
  }
}
```

### 429 配额超限

```json
{
  "error": {
    "message": "Rate limit exceeded. Retry after 30 seconds.",
    "type": "rate_limit_error"
  }
}
```

响应头:

```http
Retry-After: 30
```

---

*最后更新: 2026-07-22*
