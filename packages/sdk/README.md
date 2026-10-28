<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# @ihui-ai/sdk

IHUI-AI 平台 JavaScript/TypeScript SDK,完整封装 105 个 `/v1/*` 对外开放 API 端点,零运行时依赖。

## 安装

```bash
pnpm add @ihui-ai/sdk
```

## 快速开始

```typescript
import { createClient } from '@ihui-ai/sdk'

const client = createClient({
  apiKey: 'ihui_xxx',
  // secret: 'sk_xxx',        // 可选,创建/轮换时返回
  // baseUrl: 'http://localhost:8802', // 默认值
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

| 选项         | 类型           | 默认值                  | 说明                                        |
| ------------ | -------------- | ----------------------- | ------------------------------------------- |
| `apiKey`     | `string`       | (必需)                  | API Key,格式 `ihui_xxx`                     |
| `secret`     | `string`       | —                       | API Secret,创建/轮换时返回                  |
| `baseUrl`    | `string`       | `http://localhost:8802` | 后端 API 地址                               |
| `timeout`    | `number`       | `30000`                 | 请求超时(毫秒),流式请求不超时               |
| `maxRetries` | `number`       | `2`                     | 最大重试次数,网络错误和 5xx 重试,429 不重试 |
| `fetch`      | `typeof fetch` | 全局 fetch              | 自定义 fetch 实现(测试/拦截用)              |

## 功能模块(13 个)

| 模块                | 端点数 | 说明                                                |
| ------------------- | ------ | --------------------------------------------------- |
| `client.ai`         | 13     | Chat / Embeddings / Models / MoA                    |
| `client.agents`     | 12     | Agent 列表 / 调用 / 高级执行 / Pipeline / 并行      |
| `client.audio`      | 8      | TTS / ASR / 语音对话 / 声纹 / 音乐                  |
| `client.images`     | 6      | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景   |
| `client.videos`     | 3      | 视频生成 / 任务查询 / 编排                          |
| `client.threed`     | 1      | 3D 模型生成                                         |
| `client.generation` | 3      | 生成队列:入队 / 状态 / 取消                         |
| `client.knowledge`  | 13     | 知识库 / RAG / 知识图谱                             |
| `client.tools`      | 16     | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图            |
| `client.memory`     | 8      | 记忆:保存 / 召回 / 搜索 / Dream / 分类              |
| `client.messages`   | 4      | 消息:发布 / 订阅 / 状态                             |
| `client.files`      | 9      | 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片 |
| `client.user`       | 9      | 用户 / 工作区 / 工作流 / 统计                       |

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

SDK 使用统一的 `SdkError` 类,包含 `status`、`code`、`message`、`details`、`retryAfterMs` 字段
(`retryAfterMs` = 服务端 `Retry-After` 头解析出的建议等待毫秒数,见「限流与 429」)。

```typescript
import { SdkError } from '@ihui-ai/sdk'

try {
  await client.ai.getModel('nonexistent')
} catch (e) {
  if (e instanceof SdkError) {
    console.log(e.status) // 404
    console.log(e.code) // 'http_404'
    console.log(e.message) // 'Not Found'
  }
}
```

### 错误分类

| status | 说明         | 是否重试 |
| ------ | ------------ | -------- |
| 0      | 网络错误     | 是       |
| 401    | API Key 无效 | 否       |
| 403    | 权限不足     | 否       |
| 404    | 资源不存在   | 否       |
| 429    | 配额超限     | 否       |
| 5xx    | 服务器错误   | 是       |

### 重试机制

- 网络错误和 5xx 自动重试,最多 2 次
- 指数退避:500ms → 1000ms
- 429 和 4xx 不重试
- 流式请求不重试(无法安全回放流)

### 限流与 429

服务端返回 `429` 表示配额或速率超限。SDK **不自动重试 429**(避免持续打满配额),但会把响应里的
`Retry-After` 头(整数秒或 HTTP 日期两种形态)解析为 `SdkError.retryAfterMs`(毫秒;头缺失或
无法解析时为 `undefined`),调用方据此自适应退避:

```typescript
import { SdkError } from '@ihui-ai/sdk'

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof SdkError && e.status === 429) {
      await new Promise((r) => setTimeout(r, e.retryAfterMs ?? 1000))
      return await fn() // 按 Retry-After 等待后重试一次
    }
    throw e
  }
}
```

## 鉴权

在 IHUI-AI 平台「设置 → API Keys」页面创建 API Key(格式 `ihui_xxx`);创建/轮换时可同时获得 Secret。

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

## 版本与稳定性

- **版本号遵循 [Semantic Versioning 2.0.0](https://semver.org/lang/zh-CN/)**,显著变更记录在
  [CHANGELOG.md](./CHANGELOG.md)(随包附带,升级前必读)。
- **当前 0.x 为预稳定期**:minor 可能包含破坏性变更(CHANGELOG 中标注 `Breaking`),patch 只含修复;
  `1.0.0` 起严格 SemVer —— 破坏性变更只随 major 发布。
- **兼容承诺范围 = `@ihui-ai/sdk` 顶层导出**(全部命名导出与类型)。`dist/` 内部文件路径与未导出符号
  不在承诺内(`exports` 只开放 `.` 与 `./package.json` 两个子路径)。
- **弃用策略**:废弃 API 先在 CHANGELOG 标注 `Deprecated` 并至少保留一个 minor,再于后续 minor 移除。

## 遥测与隐私

- **零遥测**:SDK 不采集、不回传任何使用数据、日志、错误统计或埋点,也没有遥测开关 —— 不存在上报通道。
- **零运行时依赖**:不引入任何第三方客户端或上报组件,无 `postinstall` 脚本。
- **网络边界**:请求只发往你配置的 `baseUrl`;API Key / Secret 只作为请求头发往该地址,不发往任何其他主机。

## License

Apache-2.0(随包附带 `LICENSE` 与 `NOTICE`;版权所有者:李春川 / IHUI AI)
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
