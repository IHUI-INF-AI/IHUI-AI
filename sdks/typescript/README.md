# @ihui/sdk

IHUI-AI 官方 TypeScript SDK — 完整封装 105+ 个 `/v1/*` API 端点，覆盖 AI 对话、Agent 编排、多模态生成、知识库、文件管理、记忆系统等 13 个功能模块。

**零运行时依赖**，TypeScript 原生支持，浏览器 + Node.js 18+ 双环境可用。

---

## 安装

```bash
npm install @ihui/sdk
```

```bash
pnpm add @ihui/sdk
```

```bash
yarn add @ihui/sdk
```

---

## 快速开始

```ts
import { createClient } from '@ihui/sdk'

// 创建客户端（只需 API Key）
const client = createClient({
  apiKey: 'ihui_xxx',
  baseUrl: 'https://api.ihui.ai', // 默认 http://localhost:8802
})

// 列出可用模型
const models = await client.ai.listModels()
console.log(models.data)

// 发起对话
const resp = await client.ai.completions({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '你好，请介绍一下自己' }],
})
console.log(resp.choices[0].message.content)

// 流式对话
const stream = client.ai.completionsStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '写一首诗' }],
})
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
```

---

## 配置

### SdkConfig

| 参数         | 类型           | 默认值                  | 说明                                              |
| ------------ | -------------- | ----------------------- | ------------------------------------------------- |
| `apiKey`     | `string`       | —                       | API Key（必需，格式 `ihui_xxx`）                  |
| `secret`     | `string`       | —                       | API Secret（可选，创建/轮换时返回）               |
| `baseUrl`    | `string`       | `http://localhost:8802` | API 基础 URL                                      |
| `timeout`    | `number`       | `30000`                 | 请求超时（毫秒），流式请求不超时                  |
| `maxRetries` | `number`       | `2`                     | 最大重试次数，网络错误和 5xx 自动重试，429 不重试 |
| `fetch`      | `typeof fetch` | —                       | 自定义 fetch 实现（测试/拦截用）                  |

```ts
const client = createClient({
  apiKey: 'ihui_xxx',
  baseUrl: 'https://api.ihui.ai',
  timeout: 60000,
  maxRetries: 3,
})
```

---

## API 设计

### 工厂函数

使用 `createClient(config)` 创建客户端，返回包含 13 个功能模块的 `IhuiClient` 实例：

```ts
import { createClient } from '@ihui/sdk'

const client = createClient({ apiKey: 'ihui_xxx' })

// 每个模块是一组相关 API 的集合
client.ai // AI 核心
client.agents // Agent 编排
client.audio // 音频
client.images // 图像
client.videos // 视频
client.threed // 3D 模型
client.generation // 生成队列
client.knowledge // 知识库
client.tools // MCP 工具
client.memory // 记忆
client.messages // 消息
client.files // 文件
client.user // 用户
```

### 错误处理

所有请求失败时抛出 `SdkError`，携带 HTTP 状态码、错误码和详情：

```ts
import { createClient, SdkError } from '@ihui/sdk'

try {
  await client.ai.completions({ model: 'nonexistent', messages: [] })
} catch (e) {
  if (e instanceof SdkError) {
    console.error(e.status) // HTTP 状态码
    console.error(e.code) // 错误码，如 'model_not_found'
    console.error(e.message) // 错误描述
    console.error(e.details) // 错误详情（可选）
  }
}
```

### 流式响应

SDK 支持两种流式解析器，均以 `AsyncGenerator` 形式返回：

```ts
import { parseChatStream, parseAgentStream } from '@ihui/sdk'
```

---

## 模块文档

### 1. AI 核心 (`client.ai`)

AI 对话、Embeddings、模型管理、视觉理解、MoA 混合模型。

```ts
// 非流式对话
const resp = await client.ai.completions({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '你好' }],
  temperature: 0.7,
  maxTokens: 2048,
})

// 流式对话
for await (const chunk of client.ai.completionsStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '写一首诗' }],
})) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}

// Embeddings
const emb = await client.ai.embeddings({
  model: 'text-embedding-3',
  input: 'IHUI-AI 是什么？',
})

// 视觉理解
const vision = await client.ai.chatVision({
  model: 'gpt-4o',
  image: 'https://example.com/photo.jpg',
  prompt: '请描述这张图片',
})

// MoA 混合模型
const moa = await client.ai.chatMoa({
  messages: [{ role: 'user', content: '解释量子计算' }],
  presetId: 'creative',
})

// 模型管理
const models = await client.ai.listModels()
const model = await client.ai.getModel('gpt-4o')
const vendorModels = await client.ai.listVendorModels('openai')

// MoA 预设
const presets = await client.ai.listMoaPresets()
const newPreset = await client.ai.createMoaPreset({
  name: 'my-preset',
  models: ['gpt-4o', 'claude-3'],
  strategy: 'weighted',
})

// 用户自定义模型
const userModels = await client.ai.listUserModels()
const created = await client.ai.createUserModel({
  name: 'my-model',
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: 'sk-xxx',
})
await client.ai.updateUserModel(created.id, { ... })
await client.ai.deleteUserModel(created.id)
```

**端点：** 13 个

| 方法                | 路径                             | 说明                       |
| ------------------- | -------------------------------- | -------------------------- |
| `completions`       | `POST /v1/chat/completions`      | 非流式对话                 |
| `completionsStream` | `POST /v1/chat/completions`      | 流式对话（AsyncGenerator） |
| `embeddings`        | `POST /v1/embeddings`            | 文本向量化                 |
| `chatVision`        | `POST /v1/chat/vision`           | 图片理解                   |
| `chatMoa`           | `POST /v1/chat/moa`              | MoA 混合模型               |
| `listModels`        | `GET /v1/models`                 | 模型列表                   |
| `getModel`          | `GET /v1/models/:id`             | 模型详情                   |
| `listVendorModels`  | `GET /v1/vendors/:vendor/models` | 厂商模型列表               |
| `listMoaPresets`    | `GET /v1/moa-presets`            | MoA 预设列表               |
| `createMoaPreset`   | `POST /v1/moa-presets`           | 创建 MoA 预设              |
| `listUserModels`    | `GET /v1/user/models`            | 用户自定义模型列表         |
| `createUserModel`   | `POST /v1/user/models`           | 创建用户自定义模型         |
| `updateUserModel`   | `PUT /v1/user/models/:id`        | 更新用户自定义模型         |
| `deleteUserModel`   | `DELETE /v1/user/models/:id`     | 删除用户自定义模型         |

---

### 2. Agent 编排 (`client.agents`)

Agent 管理、执行、Pipeline、并行、任务分解。

```ts
// 列出 Agent
const agents = await client.agents.list()

// 获取 Agent 详情
const agent = await client.agents.get('agent_id')

// 调用 Agent（简单）
const result = await client.agents.call('agent_id', {
  input: '帮我写一封邮件',
  sessionId: 'session_xxx',
})

// 高级执行（支持 PermissionGuard）
const exec = await client.agents.execute({
  agentId: 'agent_id',
  input: '分析这份数据并生成报告',
  maxIterations: 10,
})

// 流式执行
for await (const event of client.agents.executeStream({
  agentId: 'agent_id',
  input: '逐步分析这份数据',
})) {
  if (event.type === 'data') {
    console.log(event.data)
  }
}

// 任务管理
const status = await client.agents.getTaskStatus('task_id')
await client.agents.cancelTask('task_id')

// 会话管理
const sessions = await client.agents.listSessions()
await client.agents.deleteSession('session_id')

// Pipeline 编排
const pipeline = await client.agents.pipeline({
  steps: [
    { agentId: 'agent_1', input: '收集数据' },
    { agentId: 'agent_2', input: '分析数据', dependsOn: [0] },
  ],
})

// 并行执行
const parallel = await client.agents.parallel({
  tasks: [
    { agentId: 'agent_1', input: '任务 A' },
    { agentId: 'agent_2', input: '任务 B' },
  ],
})

// 任务分解
const decompose = await client.agents.decompose({
  agentId: 'agent_id',
  input: '开发一个登录功能',
})
```

**端点：** 12 个

---

### 3. 音频 (`client.audio`)

TTS 语音合成、ASR 语音识别、语音对话、声纹识别、音乐生成。

```ts
// TTS 语音合成
const audioStream = await client.audio.speech({
  model: 'tts-1',
  input: '你好，欢迎使用 IHUI-AI',
  voice: 'alloy',
})

// ASR 语音识别
const transcript = await client.audio.transcriptions({
  file: audioBlob,
  model: 'whisper-1',
})

// 语音对话
const voiceChat = await client.audio.voiceChat({
  model: 'gpt-4o-audio',
  input: audioBlob,
})

// 声纹识别
const voiceprint = await client.audio.voiceprint({
  audio: audioBlob,
})

// 音乐生成
const music = await client.audio.musicGeneration({
  prompt: '轻快的钢琴曲',
  duration: 30,
})
```

**端点：** 5 个

---

### 4. 图像 (`client.images`)

文生图、图编辑、修复、风格迁移、虚拟试穿、背景替换。

```ts
// 文生图
const image = await client.images.generations({
  model: 'dall-e-3',
  prompt: '一只可爱的猫咪',
  n: 1,
  size: '1024x1024',
})

// 图编辑
const edited = await client.images.edits({
  image: imageBlob,
  prompt: '给猫咪戴上帽子',
})

// 局部修复
const inpainted = await client.images.inpainting({
  image: imageBlob,
  mask: maskBlob,
  prompt: '填补缺失部分',
})

// 风格迁移
const styled = await client.images.styleTransfer({
  content: contentBlob,
  style: styleBlob,
})

// 虚拟试穿
const tryon = await client.images.virtualTryOn({
  person: personBlob,
  garment: garmentBlob,
})

// 背景替换
const bg = await client.images.backgroundReplacement({
  image: imageBlob,
  prompt: '海滩背景',
})
```

**端点：** 6 个

---

### 5. 视频 (`client.videos`)

视频生成、任务查询、视频编排。

```ts
// 文生视频
const task = await client.videos.generations({
  model: 'video-gen-1',
  prompt: '日出时分的海滩',
  duration: 10,
})

// 查询任务状态
const status = await client.videos.getTask(task.taskId)

// 视频编排
const orchestrated = await client.videos.orchestrate({
  scenes: [
    { prompt: '开场', duration: 5 },
    { prompt: '高潮', duration: 10 },
  ],
})
```

**端点：** 3 个

---

### 6. 3D 模型 (`client.threed`)

3D 模型生成。

```ts
const task = await client.threed.generations({
  prompt: '一个中世纪城堡',
  format: 'glb',
})

const status = await client.threed.getTask(task.taskId)
```

**端点：** 2 个

---

### 7. 生成队列 (`client.generation`)

管理长时间运行的生成任务。

```ts
// 入队
const task = await client.generation.enqueue({
  type: 'video',
  params: { prompt: '...' },
})

// 查询状态
const status = await client.generation.status(task.id)

// 取消任务
await client.generation.cancel(task.id)
```

**端点：** 3 个

---

### 8. 知识库 (`client.knowledge`)

知识库搜索、创建、删除、RAG 查询、知识图谱。

```ts
// 搜索知识库
const results = await client.knowledge.search({
  query: '什么是 IHUI-AI',
  topK: 5,
})

// 创建知识库
const kb = await client.knowledge.create({
  name: '产品文档',
  description: '产品技术文档',
})

// 删除知识库
await client.knowledge.delete(kb.id)

// RAG 查询
const rag = await client.knowledge.rag({
  query: '如何开始使用',
  knowledgeBaseId: kb.id,
})

// 知识图谱查询
const graph = await client.knowledge.graph({
  query: '相关技术概念',
  depth: 2,
})
```

**端点：** 5 个

---

### 9. MCP 工具 (`client.tools`)

MCP 工具列表、调用、技能管理、人格、代码搜索、截图。

```ts
// 列出工具
const tools = await client.tools.list()

// 调用工具
const result = await client.tools.call({
  toolId: 'tool_xxx',
  params: { url: 'https://example.com' },
})

// 列出 MCP 工具
const mcpTools = await client.tools.listMcp()

// 技能管理
const skills = await client.tools.listSkills()
const skill = await client.tools.getSkill('skill_id')

// 人格管理
const personas = await client.tools.listPersonas()

// 代码搜索
const code = await client.tools.codeSearch({ query: 'createClient', repo: 'ihui-ai' })

// 截图
const screenshot = await client.tools.screenshot({ url: 'https://ihui.ai' })
```

**端点：** 8 个

---

### 10. 记忆系统 (`client.memory`)

保存、召回、搜索、Dream 记忆、分类记忆。

```ts
// 保存记忆
await client.memory.save({
  key: 'user_preference',
  value: { theme: 'dark' },
  namespace: 'user_123',
})

// 召回记忆
const memory = await client.memory.recall('user_preference', {
  namespace: 'user_123',
})

// 搜索记忆
const memories = await client.memory.search({
  query: '用户的主题偏好',
  namespace: 'user_123',
})

// Dream 记忆（联想/生成）
const dream = await client.memory.dream({
  seed: 'user_preference',
  namespace: 'user_123',
})

// 分类记忆
const categories = await client.memory.categories({
  namespace: 'user_123',
})
```

**端点：** 5 个

---

### 11. 消息系统 (`client.messages`)

消息发布、订阅、状态查询。

```ts
// 发布消息
const msg = await client.messages.publish({
  channel: 'notifications',
  event: 'task_completed',
  data: { taskId: 'xxx' },
})

// 订阅消息
const subscription = await client.messages.subscribe({
  channel: 'notifications',
  endpoint: 'https://my-server.com/webhook',
})

// 查询消息状态
const status = await client.messages.status(msg.id)
```

**端点：** 3 个

---

### 12. 文件管理 (`client.files`)

文件列表、上传、详情、删除、内容读取、版本管理、分片上传。

```ts
// 文件列表
const files = await client.files.list()

// 上传文件（multipart/form-data）
const file = await client.files.upload(fileBlob, 'document.pdf')

// 文件详情
const info = await client.files.get('file_id')

// 删除文件
await client.files.delete('file_id')

// 读取文件内容（二进制流）
const content = await client.files.getContent('file_id')

// 文件版本列表
const versions = await client.files.getVersions('file_id')

// 分片上传
const init = await client.files.uploadInit({
  filename: 'large.zip',
  size: 100_000_000,
  mimeType: 'application/zip',
  chunkSize: 5_000_000,
})
await client.files.uploadChunk({ uploadId: init.uploadId, index: 0, chunk: 'base64...' })
const complete = await client.files.uploadComplete({ uploadId: init.uploadId })
```

**端点：** 9 个

---

### 13. 用户 (`client.user`)

用户信息、工作区、工作流、统计。

```ts
// 用户信息
const profile = await client.user.profile()

// 更新用户信息
const updated = await client.user.updateProfile({ name: '新名字', avatar: 'url' })

// 工作区管理
const workspaces = await client.user.listWorkspaces()
const ws = await client.user.createWorkspace({ name: '我的项目' })
await client.user.updateWorkspace(ws.id, { name: '新项目名' })
await client.user.deleteWorkspace(ws.id)

// 工作流管理
const workflows = await client.user.listWorkflows()
const wf = await client.user.createWorkflow({ name: '日报生成', steps: [...] })
await client.user.updateWorkflow(wf.id, { name: '周报生成' })
await client.user.deleteWorkflow(wf.id)

// 统计
const stats = await client.user.stats({ period: 'monthly' })
```

**端点：** 9 个

---

## 流式响应详解

SDK 提供两种流式解析器，均返回 `AsyncGenerator`：

### Chat Completions 流

兼容 OpenAI SSE 格式 `data: {json}\n\n`，以 `data: [DONE]` 结束。

```ts
for await (const chunk of client.ai.completionsStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '写一首诗' }],
})) {
  // ChatStreamChunk
  console.log(chunk.id) // 'chatcmpl-xxx'
  console.log(chunk.choices[0]?.delta?.content) // 增量文本
  console.log(chunk.choices[0]?.finishReason) // null | 'stop' | 'length'
}
```

### Agent 执行流

透传 SSE 事件，包含 `data`、`event`、`raw` 三种类型。

```ts
for await (const event of client.agents.executeStream({
  agentId: 'agent_id',
  input: '逐步分析',
})) {
  switch (event.type) {
    case 'data':
      console.log('事件数据:', event.data)
      break
    case 'event':
      console.log('事件名称:', event.data.name)
      break
    case 'raw':
      console.log('原始文本:', event.data.text)
      break
  }
}
```

---

## 文件上传

### 简单上传（multipart/form-data）

```ts
// 浏览器环境
const input = document.querySelector('input[type="file"]')
const file = await client.files.upload(input.files[0])

// Node.js 环境（需配合 fetch 实现）
const blob = new Blob([buffer])
const file = await client.files.upload(blob, 'data.json')
```

### 分片上传（大文件）

```ts
// 1. 初始化
const init = await client.files.uploadInit({
  filename: 'large-video.mp4',
  size: 500_000_000,
  mimeType: 'video/mp4',
  chunkSize: 10_000_000,
})

// 2. 逐片上传
for (let i = 0; i < init.chunkCount; i++) {
  const chunk = getChunk(i) // 自行实现分片读取
  await client.files.uploadChunk({
    uploadId: init.uploadId,
    index: i,
    chunk: chunk,
  })
}

// 3. 完成上传
const result = await client.files.uploadComplete({
  uploadId: init.uploadId,
})
```

---

## 高级用法

### 自定义 fetch

```ts
import { createClient } from '@ihui/sdk'

const client = createClient({
  apiKey: 'ihui_xxx',
  fetch: async (input, init) => {
    console.log(`[SDK] ${init?.method ?? 'GET'} ${input}`)
    return fetch(input, init)
  },
})
```

### 低层级 BaseClient

```ts
import { BaseClient } from '@ihui/sdk'

const client = new BaseClient({ apiKey: 'ihui_xxx' })

// 直接调用任意 API
const data = await client.request<{ data: unknown[] }>('GET', '/models')
const stream = await client.requestStream('POST', '/chat/completions', {
  model: 'gpt-4o',
  messages: [...],
  stream: true,
})
```

---

## TypeScript 类型

所有类型已内联在 SDK 中，无需额外安装类型包：

```ts
import type {
  IhuiClient,
  SdkConfig,
  SdkError,
  ChatStreamChunk,
  AgentStreamEvent,
  AiModule,
  AgentsModule,
  AudioModule,
  ImagesModule,
  VideosModule,
  ThreeDModule,
  GenerationModule,
  KnowledgeModule,
  ToolsModule,
  MemoryModule,
  MessagesModule,
  FilesModule,
  UserModule,
} from '@ihui/sdk'
```

---

## 开发

```bash
# 类型检查
pnpm typecheck

# 构建
pnpm build

# 发布前构建
pnpm prepublishOnly
```

---

## 许可

MIT
