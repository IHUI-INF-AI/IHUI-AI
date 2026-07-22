# @ihui/sdk

IHUI-AI 平台 JavaScript/TypeScript SDK,完整封装 105 个 `/v1/*` 对外开放 API 端点,零运行时依赖。

## 安装

```bash
pnpm add @ihui/sdk
```

## 快速开始

```typescript
import { createClient } from '@ihui/sdk'

const client = createClient({
  apiKey: 'ihui_xxx',
  // secret: 'sk_xxx',        // 可选,创建/轮换时返回
  // baseUrl: 'http://localhost:3001', // 默认值
})

// 列出模型
const models = await client.ai.listModels()

// Chat 补全
const completion = await client.ai.completions({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好' }],
})
console.log(completion.choices[0].message.content)
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiKey` | `string` | (必需) | API Key,格式 `ihui_xxx` |
| `secret` | `string` | — | API Secret,创建/轮换时返回 |
| `baseUrl` | `string` | `http://localhost:3001` | 后端 API 地址 |
| `timeout` | `number` | `30000` | 请求超时(毫秒),流式请求不超时 |
| `maxRetries` | `number` | `2` | 最大重试次数,网络错误和 5xx 重试,429 不重试 |
| `fetch` | `typeof fetch` | 全局 fetch | 自定义 fetch 实现(测试/拦截用) |

## 功能模块(13 个)

| 模块 | 端点数 | 说明 |
|------|--------|------|
| `client.ai` | 13 | Chat / Embeddings / Models / MoA |
| `client.agents` | 12 | Agent 列表 / 调用 / 高级执行 / Pipeline / 并行 |
| `client.audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| `client.images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| `client.videos` | 3 | 视频生成 / 任务查询 / 编排 |
| `client.threed` | 1 | 3D 模型生成 |
| `client.generation` | 3 | 生成队列:入队 / 状态 / 取消 |
| `client.knowledge` | 13 | 知识库 / RAG / 知识图谱 |
| `client.tools` | 16 | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图 |
| `client.memory` | 8 | 记忆:保存 / 召回 / 搜索 / Dream / 分类 |
| `client.messages` | 4 | 消息:发布 / 订阅 / 状态 |
| `client.files` | 9 | 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片 |
| `client.user` | 9 | 用户 / 工作区 / 工作流 / 统计 |

## 使用示例

### 流式 Chat

```typescript
const stream = client.ai.completionsStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '讲个笑话' }],
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) process.stdout.write(content)
}
```

### Agent 调用

```typescript
// 列出 Agent
const agents = await client.agents.list()

// 调用 Agent
const result = await client.agents.call('agent-id', {
  input: '帮我分析这段代码',
})

// 高级执行(流式)
const execStream = client.agents.executeStream({
  agentId: 'agent-id',
  input: '执行任务',
  permissionMode: 'accept-edits',
})
for await (const event of execStream) {
  console.log(event.type, event.data)
}
```

### Embeddings

```typescript
const embedding = await client.ai.embeddings({
  model: 'text-embedding-3-small',
  input: '要向量化的文本',
})
console.log(embedding.data[0].embedding.length)
```

### 文件上传

```typescript
// 简单上传(multipart/form-data)
const file = new File([buffer], 'example.txt', { type: 'text/plain' })
const fileInfo = await client.files.upload(file)

// 分片上传(大文件)
const init = await client.files.uploadInit({
  filename: 'large.mp4',
  size: 104857600,
  mimeType: 'video/mp4',
  chunkSize: 5242880,
})
for (let i = 0; i < init.chunkCount; i++) {
  const chunk = getChunk(i) // 获取 base64 分片
  await client.files.uploadChunk({ uploadId: init.uploadId, index: i, chunk })
}
const result = await client.files.uploadComplete({ uploadId: init.uploadId })
```

### 知识库搜索

```typescript
// 文档入库
await client.knowledge.ingestDocument({
  title: '产品文档',
  content: '文档内容...',
})

// 语义搜索
const results = await client.knowledge.search({
  query: '如何使用产品',
  topK: 5,
})

// RAG 上下文
const rag = await client.knowledge.ragContext({
  query: '产品定价',
  injectSystemPrompt: true,
})
```

### 图像生成

```typescript
const image = await client.images.generations({
  model: 'dall-e-3',
  prompt: '一只在月球上的猫',
  size: '1024x1024',
})
console.log(image.data[0].url)
```

### MCP 工具调用

```typescript
// 列出可用工具
const tools = await client.tools.list()

// 调用工具
const result = await client.tools.call({
  name: 'calculator',
  arguments: { expression: '1 + 1' },
})
```

### 记忆系统

```typescript
// 保存记忆
await client.memory.save({
  content: '用户偏好中文回复',
  type: 'procedural',
})

// 召回记忆
const memories = await client.memory.recall()

// 语义搜索
const results = await client.memory.search({ query: '用户偏好', topK: 3 })
```

## 错误处理

SDK 使用统一的 `SdkError` 类,包含 `status`、`code`、`message`、`details` 字段。

```typescript
import { SdkError } from '@ihui/sdk'

try {
  await client.ai.getModel('nonexistent')
} catch (e) {
  if (e instanceof SdkError) {
    console.log(e.status)  // 404
    console.log(e.code)    // 'http_404'
    console.log(e.message) // 'Not Found'
  }
}
```

### 错误分类

| status | 说明 | 是否重试 |
|--------|------|----------|
| 0 | 网络错误 | 是 |
| 401 | API Key 无效 | 否 |
| 403 | 权限不足 | 否 |
| 404 | 资源不存在 | 否 |
| 429 | 配额超限 | 否 |
| 5xx | 服务器错误 | 是 |

### 重试机制

- 网络错误和 5xx 自动重试,最多 2 次
- 指数退避:500ms → 1000ms
- 429 和 4xx 不重试
- 流式请求不重试(无法安全回放流)

## 鉴权

SDK 支持两种鉴权方式:

```typescript
// 方式 1:API Key(自动设置 Authorization: Bearer)
const client = createClient({ apiKey: 'ihui_xxx' })

// 方式 2:API Key + Secret(额外设置 X-Api-Secret)
const client = createClient({
  apiKey: 'ihui_xxx',
  secret: 'sk_xxx',
})
```

## License

MIT
