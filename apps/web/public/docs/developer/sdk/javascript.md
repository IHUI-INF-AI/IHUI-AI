# JavaScript / TypeScript SDK

> 包名:`@ihui/sdk`(npm),版本 0.1.0。零运行时依赖,完整封装 105 个 `/v1/*` 端点,覆盖 13 个功能模块。

## 安装

```bash
npm install @ihui/sdk
# 或
pnpm add @ihui/sdk
# 或
yarn add @ihui/sdk
```

> 本项目 monorepo 内部通过 `workspace:*` 引用,实际发布包名为 `@ihui/sdk`。

## 快速开始

```typescript
import { createClient } from '@ihui/sdk'

const client = createClient({
  apiKey: process.env.IHUI_API_KEY!, // 必需,格式 ihui_xxx
  // secret: 'sk_xxx',                 // 可选,创建/轮换时返回的 Secret
  // baseUrl: 'http://localhost:3001', // 可选,默认 http://localhost:3001
  // timeout: 30000,                   // 可选,默认 30000ms(流式不超时)
  // maxRetries: 2,                    // 可选,默认 2(5xx + 网络错误自动重试)
})

// 列出模型
const models = await client.ai.listModels()
console.log(models.data[0].id)

// 非流式对话
const resp = await client.ai.completions({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好' }],
})
console.log(resp.choices[0].message.content)
```

## 配置

### SdkConfig

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| apiKey | string | 是 | — | API Key,格式 `ihui_xxx` |
| secret | string | 否 | — | API Secret(创建/轮换密钥时返回),通过 `X-Api-Secret` 头传递 |
| baseUrl | string | 否 | `http://localhost:3001` | 基础 URL(自动去除尾部 `/`) |
| timeout | number | 否 | 30000 | 请求超时(毫秒),流式请求不超时 |
| maxRetries | number | 否 | 2 | 最大重试次数(网络错误和 5xx 自动重试,429 和 4xx 不重试) |
| fetch | typeof fetch | 否 | globalThis.fetch | 自定义 fetch 实现(测试/拦截用) |

### 鉴权头

SDK 自动附加以下请求头:

```http
Authorization: Bearer ihui_xxx
Content-Type: application/json
X-Api-Secret: sk_xxx  (若配置了 secret)
```

## 模块概览

`IhuiClient` 聚合 13 个功能模块,所有方法名采用 camelCase:

| 模块 | 客户端属性 | 端点数 | 说明 |
|------|-----------|--------|------|
| AI 核心 | `client.ai` | 13 | chat / embeddings / models / moa |
| Agent | `client.agents` | 12 | 列表 / 调用 / 高级执行 / Pipeline / 并行 |
| 音频 | `client.audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| 图像 | `client.images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| 视频 | `client.videos` | 3 | 生成 / 任务查询 / 编排 |
| 3D | `client.threed` | 1 | 3D 模型生成 |
| 生成队列 | `client.generation` | 3 | 入队 / 状态 / 取消 |
| 知识库 | `client.knowledge` | 13 | 文档 CRUD / 语义搜索 / RAG / 图谱 |
| MCP 工具 | `client.tools` | 16 | 工具 / 资源 / 提示词 / 技能 / 人格 / 截图 |
| 记忆 | `client.memory` | 8 | 保存 / 召回 / 搜索 / Dream / 分类记忆 |
| 消息 | `client.messages` | 4 | 发布 / 订阅 / 状态 |
| 文件 | `client.files` | 9 | 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片 |
| 用户 | `client.user` | 9 | 当前用户 / 项目 / 工作流 / 用量统计 |

## AI 核心模块

### 非流式对话

```typescript
const resp = await client.ai.completions({
  model: 'gpt-4',
  messages: [
    { role: 'system', content: '你是一个有帮助的助手。' },
    { role: 'user', content: '什么是 AI?' },
  ],
  temperature: 0.7,
  maxTokens: 1000,
})

console.log(resp.choices[0].message.content)
console.log(resp.usage) // { promptTokens, completionTokens, totalTokens }
```

### 流式对话(SSE)

```typescript
const stream = client.ai.completionsStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '讲一个故事' }],
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content ?? ''
  process.stdout.write(content)
}
```

> `completionsStream` 返回 `AsyncGenerator<ChatStreamChunk>`,SDK 自动解析 SSE `data:` 行,遇到 `data: [DONE]` 结束。

### 向量嵌入

```typescript
const emb = await client.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'IHUI-AI 平台',
  dimensions: 1536,
})
console.log(emb.data[0].embedding.length) // 1536
```

### 视觉理解

```typescript
const vision = await client.ai.chatVision({
  model: 'gpt-4o',
  image: 'data:image/png;base64,iVBOR...', // base64 或 URL
  prompt: '描述这张图片',
})
console.log(vision.description)
```

### Mixture of Agents(MoA)

```typescript
const moa = await client.ai.chatMoa({
  messages: [{ role: 'user', content: '复杂问题' }],
  presetId: 'default',
})
console.log(moa.output)
```

### 模型管理

```typescript
// 列出所有模型
const models = await client.ai.listModels()

// 获取单个模型详情
const model = await client.ai.getModel('gpt-4')

// 按厂商列出模型
const openaiModels = await client.ai.listVendorModels('openai')

// MoA 预设
const presets = await client.ai.listMoaPresets()
const preset = await client.ai.createMoaPreset({
  name: 'my-preset',
  models: ['gpt-4', 'claude-3-opus'],
  strategy: 'aggregate',
})

// 用户自定义模型
const userModels = await client.ai.listUserModels()
const newModel = await client.ai.createUserModel({
  name: 'my-gpt',
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-xxx',
  baseUrl: 'https://api.openai.com/v1',
})
await client.ai.updateUserModel(newModel.id, { ... })
await client.ai.deleteUserModel(newModel.id)
```

## Agent 模块

```typescript
// 列表
const agents = await client.agents.list()
const agent = await client.agents.get('agent-123')

// 简单调用
const callResp = await client.agents.call('agent-123', {
  input: '帮我写一个 Hello World',
})

// 高级执行(支持 PermissionGuard)
const exec = await client.agents.execute({
  agentId: 'agent-123',
  input: '重构这段代码',
  permissionMode: 'accept-edits', // read-only/accept-edits/accept-all/bypass-permissions/plan-only
  maxIterations: 10,
})
console.log(exec.taskId, exec.status, exec.output)

// 流式执行
const stream = client.agents.executeStream({
  agentId: 'agent-123',
  input: '逐行分析',
})
for await (const event of stream) {
  if (event.type === 'data') console.log(event.data)
}

// 任务状态 / 取消
const status = await client.agents.getTaskStatus(exec.taskId)
await client.agents.cancelTask(exec.taskId)

// 会话管理
const sessions = await client.agents.listSessions()
await client.agents.deleteSession('session-123')

// Pipeline 编排
const pipeline = await client.agents.pipeline({
  steps: [
    { agentId: 'agent-a', input: '步骤 1' },
    { agentId: 'agent-b', input: '步骤 2(依赖步骤 1)', dependsOn: [0] },
  ],
})

// 并行执行
const parallel = await client.agents.parallel({
  tasks: [
    { agentId: 'agent-a', input: '任务 A' },
    { agentId: 'agent-b', input: '任务 B' },
  ],
})

// 任务分解
const decomposed = await client.agents.decompose({
  agentId: 'agent-123',
  input: '构建一个电商网站',
})
console.log(decomposed.subtasks)
```

## 文件模块

### 简单上传

```typescript
import fs from 'fs'

// 浏览器环境
const file = new File([blob], 'example.pdf')
const fileObj = await client.files.upload(file)

// Node.js 环境(用 Blob 包装)
const buffer = fs.readFileSync('example.pdf')
const blob = new Blob([buffer])
const fileObj = await client.files.upload(blob, 'example.pdf')
```

### 分片上传(大文件 >50MB)

```typescript
import fs from 'fs'

const filePath = 'large-video.mp4'
const stat = fs.statSync(filePath)
const chunkSize = 5 * 1024 * 1024 // 5MB

// 1. 初始化
const init = await client.files.uploadInit({
  filename: 'large-video.mp4',
  size: stat.size,
  mimeType: 'video/mp4',
  chunkSize,
})

// 2. 并行上传分片
await Promise.all(
  Array.from({ length: init.chunkCount }, async (_, i) => {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, stat.size)
    const chunk = Buffer.from(buffer.slice(start, end)).toString('base64')
    await client.files.uploadChunk({
      uploadId: init.uploadId,
      index: i,
      chunk,
    })
  }),
)

// 3. 完成
const result = await client.files.uploadComplete({ uploadId: init.uploadId })
console.log(result.fileId)
```

### 文件操作

```typescript
const files = await client.files.list()
const file = await client.files.get('file-123')
const versions = await client.files.getVersions('file-123')

// 下载内容(返回 ReadableStream)
const stream = await client.files.getContent('file-123')
const reader = stream.getReader()
// Node.js:可 pipe 到 fs.createWriteStream

await client.files.delete('file-123')
```

## 多模态模块

```typescript
// 音频 TTS
const speech = await client.audio.speech({
  model: 'tts-1',
  input: '你好世界',
  voice: 'alloy',
  responseFormat: 'mp3',
})

// 音频 ASR
const transcription = await client.audio.transcriptions({
  model: 'whisper-1',
  audio: '<base64-audio>',
})

// 图像生成
const image = await client.images.generations({
  model: 'dall-e-3',
  prompt: '一只猫',
  size: '1024x1024',
})

// 视频生成
const video = await client.videos.generations({
  model: 'sora-2',
  prompt: '城市夜景',
  duration: 5,
})

// 3D 生成
const threed = await client.threed.generations({
  model: 'triposr',
  input: '<base64-image>',
})

// 生成队列
const job = await client.generation.enqueue({
  type: 'video',
  payload: { prompt: '...' },
  priority: 5,
})
const status = await client.generation.getStatus(job.jobId)
await client.generation.cancel(job.jobId)
```

## 知识库模块

```typescript
// 健康检查
const health = await client.knowledge.health()

// 文档入库
const doc = await client.knowledge.ingestDocument({
  title: 'IHUI-AI 简介',
  content: 'IHUI-AI 是一个全栈 AI 平台...',
  chunkStrategy: 'paragraph',
  chunkSize: 500,
})

// 语义搜索
const results = await client.knowledge.search({
  query: '什么是 IHUI-AI?',
  topK: 5,
  threshold: 0.7,
})

// RAG 上下文
const rag = await client.knowledge.ragContext({
  query: '平台架构',
  injectSystemPrompt: true,
})

// 知识图谱
const graph = await client.knowledge.extractGraph({
  text: 'IHUI-AI 由前端、后端、AI 服务组成...',
})
await client.knowledge.buildGraph({ documentId: doc.documentId })
const graphData = await client.knowledge.getGraphData()
await client.knowledge.clearGraph()
```

## MCP 工具模块

```typescript
// 工具列表与调用
const tools = await client.tools.list()
const result = await client.tools.call({
  name: 'search-codebase',
  arguments: { query: 'auth middleware', directory: '/src' },
})

// 资源 / 提示词
const resources = await client.tools.listResources()
const resource = await client.tools.getResource('file:///src/auth.ts')
const prompts = await client.tools.listPrompts()
const promptResult = await client.tools.invokePrompt({
  name: 'code-review',
  arguments: { language: 'typescript' },
})

// 技能 / 斜杠命令
const skills = await client.tools.listSkills()
const slashCommands = await client.tools.listSlashCommands()
const cmdResult = await client.tools.invokeSlashCommand({
  name: '/explain',
  arguments: { code: 'const x = 1' },
})

// 采样 / 人格
const sampling = await client.tools.sampling({
  messages: [{ role: 'user', content: '...' }],
  maxTokens: 100,
})
const personas = await client.tools.listPersonas()
const persona = await client.tools.getPersona('developer')

// 高级工具
const searchResult = await client.tools.searchCodebase({
  query: 'auth',
  directory: '/src',
})
const webResult = await client.tools.searchWeb({ query: 'OpenAI GPT-5', num: 10 })
const analyze = await client.tools.analyzeCode({ code: '...', language: 'ts' })
const screenshot = await client.tools.screenshot({
  url: 'https://example.com',
  fullPage: true,
})
```

## 记忆模块

```typescript
// 保存记忆
await client.memory.save({
  content: '用户喜欢简洁的回答',
  type: 'procedural',
})

// 召回 / 搜索
const recalled = await client.memory.recall({ query: '用户偏好' })
const searched = await client.memory.search({
  query: '偏好',
  topK: 5,
  type: 'procedural',
})

// 分类记忆
const working = await client.memory.getWorking()
const episodic = await client.memory.getEpisodic()
const procedural = await client.memory.getProcedural()

// Dream 梦境
const dream = await client.memory.dream({ mode: 'consolidate' })

// 遗忘
await client.memory.forget({ memoryId: 'mem-123' })
```

## 消息模块

```typescript
// 发布消息
await client.messages.publish({
  channel: 'updates',
  content: '新版本发布',
  recipients: ['user-1', 'user-2'],
})

// 订阅 Webhook
const sub = await client.messages.subscribe({
  channel: 'updates',
  callbackUrl: 'https://example.com/webhook',
})

// 取消订阅
await client.messages.unsubscribe(sub.subscriptionId)

// 消息状态
const status = await client.messages.getStatus('msg-123')
```

## 用户模块

```typescript
// 当前用户 + 配额
const me = await client.user.me()
console.log(me.quota.hourlyUsed, '/', me.quota.hourlyLimit)

// 项目
const projects = await client.user.listProjects()
const files = await client.user.listProjectFiles('project-123')

// 工作流
const workflow = await client.user.getWorkflow('wf-123')
const instance = await client.user.runWorkflow({
  workflowId: 'wf-123',
  inputs: { key: 'value' },
})
const coze = await client.user.runCozeWorkflow({
  workflowId: 'coze-123',
  parameters: { ... },
})
const n8n = await client.user.runN8nWorkflow({
  workflowId: 'n8n-123',
  data: { ... },
})

// 用量统计
const usage = await client.user.getUsage()
const openaiUsage = await client.user.getVendorUsage('openai')
```

## 错误处理

SDK 抛出 `SdkError` 异常,携带 `status` / `code` / `details`:

```typescript
import { createClient, SdkError } from '@ihui/sdk'

try {
  const resp = await client.ai.completions({ ... })
} catch (e) {
  if (e instanceof SdkError) {
    console.error(`HTTP ${e.status} [${e.code}]: ${e.message}`)
    if (e.status === 401) {
      // API Key 无效
    } else if (e.status === 403) {
      // 权限不足
    } else if (e.status === 429) {
      // 配额超限,稍后重试
    }
  } else {
    console.error('网络错误:', e)
  }
}
```

详见 [错误处理](../api/error-handling.md)。

## TypeScript 类型

SDK 完整导出所有 `@ihui/types` 中的请求/响应类型,可直接引用:

```typescript
import type {
  V1ChatCompletionRequest,
  V1ChatCompletionResponse,
  V1ModelInfo,
  V1AgentExecuteRequest,
  V1EmbeddingsResponse,
} from '@ihui/sdk'
```

## 自定义 fetch(测试 / 拦截)

```typescript
const client = createClient({
  apiKey: 'ihui_xxx',
  fetch: async (url, init) => {
    console.log('Request:', url, init.method)
    const resp = await fetch(url, init)
    console.log('Response:', resp.status)
    return resp
  },
})
```

## 流式解析工具

SDK 导出 `parseChatStream` 和 `parseAgentStream` 工具函数,可用于手动解析 SSE 流:

```typescript
import { parseChatStream } from '@ihui/sdk'

const resp = await fetch('http://localhost:3001/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: 'Bearer ihui_xxx', 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4', messages: [...], stream: true }),
})

for await (const chunk of parseChatStream(resp.body!)) {
  console.log(chunk.choices[0]?.delta?.content ?? '')
}
```

## 完整示例

```typescript
import { createClient, SdkError } from '@ihui/sdk'
import fs from 'fs'

const client = createClient({
  apiKey: process.env.IHUI_API_KEY!,
  baseUrl: process.env.IHUI_BASE_URL || 'http://localhost:3001',
})

async function main() {
  try {
    // 1. 列出模型
    const models = await client.ai.listModels()
    console.log(`可用模型数: ${models.data.length}`)

    // 2. 上传文件
    const buffer = fs.readFileSync('doc.pdf')
    const file = await client.files.upload(new Blob([buffer]), 'doc.pdf')
    console.log(`文件 ID: ${file.id}`)

    // 3. 流式对话(引用文件)
    const stream = client.ai.completionsStream({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: '你是文档分析助手。' },
        { role: 'user', content: `分析文件 ${file.id}` },
      ],
    })
    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
    }
  } catch (e) {
    if (e instanceof SdkError) {
      console.error(`错误 ${e.status}: ${e.message}`)
    } else {
      console.error('未知错误:', e)
    }
  }
}

main()
```

---

*最后更新: 2026-07-22*
