<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# 最佳实践

## SDK 选型

| 场景 | 推荐 SDK | 原因 |
|------|---------|------|
| Node.js / 浏览器 / Deno / Bun | `@ihui/sdk`(TypeScript) | 原生 ESM,零依赖,完整类型 |
| Python 同步脚本 / 传统 Web | `ihui-ai`(同步) | 纯 stdlib,无异步复杂度 |
| Python 高并发 / FastAPI | `ihui-ai`(asyncio) | 协程友好,可与 `asyncio.gather` 并发 |
| Shell 脚本 / 快速调试 | cURL | 无需安装,即开即用 |

详见 [JavaScript SDK](sdk/javascript.md) / [Python SDK](sdk/python.md) / [cURL 示例](sdk/curl.md)。

## API Key 管理

### 1. 最小权限原则

按使用场景创建独立的 API Key,仅授予所需权限子集:

```typescript
// 客服机器人:只需对话权限
const chatClient = createClient({
  apiKey: process.env.IHUI_CHAT_KEY!, // 仅 chat:write + chat:read
})

// 知识库同步任务:只需知识库权限
const kbClient = createClient({
  apiKey: process.env.IHUI_KB_KEY!, // 仅 knowledge:read + knowledge:write
})
```

完整的 27 个权限点见 [身份认证](getting-started/authentication.md)。

### 2. 密钥轮换

定期轮换密钥,避免长期使用同一密钥:

1. 在管理后台创建新 API Key
2. 更新应用环境变量
3. 观察一段时间,确认新密钥正常工作
4. 吊销旧 API Key

### 3. 环境变量管理

禁止将 API Key 硬编码在代码或提交到 Git 仓库:

```bash
# .env(添加到 .gitignore)
IHUI_API_KEY=ihui_xxx
IHUI_API_SECRET=sk_xxx
IHUI_BASE_URL=http://localhost:8802
```

```typescript
// Node.js:用 dotenv 加载
import 'dotenv/config'
const client = createClient({ apiKey: process.env.IHUI_API_KEY! })
```

```python
# Python:用 python-dotenv 加载
from dotenv import load_dotenv
load_dotenv()
client = create_client({"apiKey": os.environ["IHUI_API_KEY"]})
```

### 4. Secret 二次校验

对敏感操作(如 Agent 高级执行 `bypass-permissions` 模式),启用 Secret 二次校验:

```typescript
const client = createClient({
  apiKey: process.env.IHUI_API_KEY!,
  secret: process.env.IHUI_API_SECRET, // 通过 X-Api-Secret 头传递
})

// 服务端会校验 Secret,缺失或不匹配返回 401
await client.agents.execute({
  agentId: 'agent-123',
  input: '执行敏感操作',
  permissionMode: 'bypass-permissions',
})
```

## 错误处理与重试

### 1. 区分可重试与不可重试错误

| 错误类型 | 是否重试 | 原因 |
|---------|---------|------|
| 网络错误(DNS / 连接失败) | ✅ | 临时故障 |
| 5xx(500 / 502 / 503) | ✅ | 服务端临时故障 |
| 429 配额超限 | ⚠️ | 需等待 `Retry-After` |
| 401 / 403 | ❌ | 鉴权问题,重试无意义 |
| 400 / 404 / 409 / 413 | ❌ | 请求本身有问题,重试无意义 |

> SDK 默认对网络错误和 5xx 自动重试 2 次(指数退避),429 和 4xx 不重试。

### 2. 429 退避策略

```typescript
async function callWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof SdkError && e.status === 429) {
        const delay = Math.min(60 * 1000 * Math.pow(2, i), 600 * 1000) // 指数退避,上限 10 分钟
        console.warn(`429 退避:等待 ${delay / 1000}s`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded')
}
```

### 3. 流式请求不重试

流式请求(`completionsStream` / `executeStream`)无法安全回放,SDK 默认不重试。如遇流中断,需重新发起完整请求。

## 性能优化

### 1. 并发控制

避免突发并发触发 429,使用并发限制器:

```typescript
class ConcurrencyLimiter {
  private running = 0
  private queue: Array<() => void> = []
  constructor(private max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.max) {
      await new Promise<void>((r) => this.queue.push(r))
    }
    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      this.queue.shift()?.()
    }
  }
}

const limiter = new ConcurrencyLimiter(5) // 最多 5 并发
const results = await Promise.all(
  prompts.map((p) => limiter.run(() => client.ai.completions({ model: 'gpt-4', messages: [{ role: 'user', content: p }] }))),
)
```

```python
import asyncio

async def main():
    sem = asyncio.Semaphore(5)  # 最多 5 并发

    async def call(p):
        async with sem:
            return await client.ai.completions({"model": "gpt-4", "messages": [{"role": "user", "content": p}]})

    results = await asyncio.gather(*[call(p) for p in prompts])
```

### 2. 流式优先

对长文本生成,优先使用流式接口,避免长时间等待整体响应:

```typescript
// 推荐:流式
const stream = client.ai.completionsStream({ model: 'gpt-4', messages: [...] })
for await (const chunk of stream) {
  // 实时输出,首字延迟低
}

// 不推荐:非流式(等待整体完成才返回)
const resp = await client.ai.completions({ model: 'gpt-4', messages: [...] })
```

### 3. 缓存静态数据

模型列表、MoA 预设等不常变化的数据可本地缓存:

```typescript
let cachedModels: V1ModelsResponse | null = null
let cacheTime = 0

async function getModels(): Promise<V1ModelsResponse> {
  const now = Date.now()
  if (cachedModels && now - cacheTime < 3600_000) { // 1 小时缓存
    return cachedModels
  }
  cachedModels = await client.ai.listModels()
  cacheTime = now
  return cachedModels
}
```

### 4. 分片上传大文件

超过 50MB 的文件必须使用分片上传,避免单次请求超时:

```typescript
// 推荐:分片上传(并行)
const init = await client.files.uploadInit({ filename, size, mimeType, chunkSize: 5 * 1024 * 1024 })
await Promise.all(
  Array.from({ length: init.chunkCount }, (_, i) =>
    client.files.uploadChunk({ uploadId: init.uploadId, index: i, chunk: getChunk(i) })
  )
)
await client.files.uploadComplete({ uploadId: init.uploadId })
```

详见 [文件 API](api/files.md) 的分片上传章节。

## 流式输出处理

### 1. 正确解析 SSE chunk

每个 chunk 是 OpenAI 兼容的 `chat.completion.chunk` 对象,`delta.content` 可能为空(首 chunk 只有 `role`):

```typescript
const stream = client.ai.completionsStream({ model: 'gpt-4', messages: [...] })
let fullText = ''
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta
  if (delta?.content) {
    fullText += delta.content
    process.stdout.write(delta.content)
  }
  // chunk.choices[0].finishReason 为 'stop' 时表示结束
}
```

### 2. 处理流中断

网络抖动可能导致流中断,需捕获异常并提示用户:

```typescript
try {
  for await (const chunk of stream) { ... }
} catch (e) {
  if (e instanceof SdkError) {
    console.error(`\n流中断 (HTTP ${e.status}): ${e.message}`)
  } else {
    console.error('\n网络中断:', e)
  }
  // 可选择保存已接收的内容,提示用户重新生成
}
```

## 安全最佳实践

### 1. 永远不要在客户端暴露 API Key

API Key 应仅在后端服务使用,前端通过自建代理转发:

```
浏览器 → 你的后端代理 → IHUI-AI /v1/*
       (携带你的鉴权)    (携带 API Key)
```

### 2. 输入验证

对用户输入进行长度和内容验证,避免注入风险:

```typescript
function validatePrompt(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('输入不能为空')
  }
  if (input.length > 10000) {
    throw new Error('输入过长(上限 10000 字符)')
  }
  return input
}
```

### 3. 日志脱敏

记录请求日志时,脱敏 API Key 和用户内容:

```typescript
function maskApiKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : '***'
}

console.log(`[API] key=${maskApiKey(apiKey)} model=${model} tokens=${usage.totalTokens}`)
```

## 配额监控

### 1. 主动查询配额

在批量任务前查询配额,避免中途 429:

```typescript
const me = await client.user.me()
const remaining = me.quota.hourlyLimit - me.quota.hourlyUsed
if (remaining < estimatedTokens) {
  console.warn(`配额不足:剩余 ${remaining},需要 ${estimatedTokens}`)
  // 等待配额重置或降低任务规模
}
```

### 2. 监控响应头

每次请求后,从响应头读取剩余配额(SDK 暂不直接暴露,可通过自定义 fetch 拦截):

```typescript
const client = createClient({
  apiKey: 'ihui_xxx',
  fetch: async (url, init) => {
    const resp = await fetch(url, init)
    const remaining = resp.headers.get('X-RateLimit-Remaining')
    if (remaining && parseInt(remaining, 10) < 10) {
      console.warn(`配额预警:剩余 ${remaining} 次请求`)
    }
    return resp
  },
})
```

## 异步任务管理

### 1. 视频生成等长任务轮询

视频生成、Agent 高级执行等异步任务,推荐轮询模式:

```typescript
async function pollTask(taskId: string, intervalMs = 5000, timeoutMs = 600000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await client.generation.getStatus(taskId)
    if (status.status === 'completed') return status
    if (status.status === 'failed') throw new Error(status.error ?? 'Task failed')
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error('Task timeout')
}

const job = await client.videos.generations({ model: 'sora-2', prompt: '...' })
const result = await pollTask(job.taskId)
```

### 2. 超时取消

长任务支持取消,避免无意义等待:

```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 60_000)

try {
  const result = await Promise.race([
    client.agents.execute({ agentId: 'agent-123', input: '...' }),
    new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('timeout')))),
  ])
} finally {
  clearTimeout(timeout)
}
```

## Webhook 回调接收与来源校验

### 1. `/v1/messages/subscribe` 的回调**不附带任何签名头**

平台向 `callbackUrl` POST 消息时,请求里**没有签名头**(既无 `X-Ihui-Signature`,也没有 HMAC Secret),
请求体只有 `{ message_id, content, metadata }` 三个字段。

真相源是 `apps/ai-service/app/services/message_bus.py` 的 `WebhookChannel._do_send`(:374-412):
投递调用是 `await client.post(url, json=payload)`(:392),**整个方法没有传过 `headers=` 参数**;
payload 的字段集合在 :381-385 定死,不含 channel / publishedAt。

> **不要对这条链路的回调做 HMAC 验签。** 回调永远不带可比的签名头,任何"读 `x-ihui-signature`
> 再比对 HMAC"的实现第一步就取到 `undefined`,会把 **100%** 的真实回调判为无效并 401 拒收。
> 本节此前给出的正是这段代码,已删除。

接收端当前只需要:

```typescript
app.post('/webhook/ihui', (req, res) => {
  // 字段是蛇形 message_id(不是 messageId)
  const { message_id, content, metadata } = req.body as {
    message_id: string
    content: string
    metadata?: Record<string, unknown>
  }
  // 返回 2xx 确认接收;非 2xx 或请求异常(单次超时 10s,同文件 :389)会被记为该通道投递失败
  res.status(200).send('OK')
})
```

### 2. 确实需要来源校验时,现在真能用的三种手段

| 手段 | 做法 | 强度 | 局限 |
|------|------|------|------|
| 保密回调地址(能力凭证) | 订阅时把私有随机段写进 `callbackUrl`,如 `https://your-app.com/webhook/ihui/8f3a…(32 字节随机 hex)`,该段只存你服务端,不进前端与日志 | 不可猜:没有这段路径的人构造不出正确 URL | 不防泄露(反代 access log、浏览器插件、错误上报都会带上完整 URL),泄露即等于对方能投递伪造回调;无防重放能力 |
| 反查 `message_id` | 拿回调里的 `message_id` 调 `GET /v1/messages/:id/status`:查得到 = 确为你自己发布过的消息;查不到(上游 404 由 v1 转发层统一映射为 **503**,`apps/api/src/routes/v1-knowledge-tools.ts:593-598`)按可疑处理 | 真正区分"我发过的消息"与随手编的 id,校验凭据是你自己的 API Key,不依赖回调内容 | 投递状态与订阅都存在 ai-service **进程内存**(`message_bus.py:483` `_delivery_status` / `:479` `_subscriptions`),服务重启后查不到就会误判为可疑;消息量大时反查是每回调一跳 |
| 网络层来源限制 | 在入口(防火墙 / 安全组 / nginx)只放行平台出口地址访问你的回调路径 | 与业务代码解耦,能挡住公网随手扫 | 出口地址需向运维确认并持续跟进;同一出口上的其他服务也可能被借用,不是身份凭证 |

三者是**叠加**关系而不是替代,且都只降低"被伪造"的可能性,不等同于签名。
若回调内容本身不可信,请在应用层先校验 `message_id` 归属再消费
(参见 [消息 API](api/messages.md) 的"Webhook 回调格式")。

### 3. 另有**一处真带签名**的 webhook 面:relay 事件订阅(与本端点无关)

`/api/developer/webhooks/subscriptions`(需登录态,不是 v1 API Key 面)在投递 relay 事件时
**确实**附带 HMAC-SHA256 签名 —— 走的是另一套实现,与上面第 1 条不冲突:

- 签名头 `X-IHUI-Signature: sha256=<hex>`:`apps/api/src/services/webhook-relay-notifier.ts:84-96`
- 签名对象 = 投递用的**原始 JSON 字符串** `JSON.stringify({ event, data, timestamp })`:同文件 :159-165,HMAC 计算 :48-50
- Secret 在创建订阅时生成且**只返回一次**:`apps/api/src/routes/developer/webhooks.ts:200-221`

验签有两个必须注意的细节:**先剥掉 `sha256=` 前缀**;以及用**原始请求体字节**比对
(不能 `JSON.stringify(req.body)` 重新序列化 —— 键序或空格一变签名就对不上):

```typescript
import crypto from 'crypto'

function verifyRelaySignature(secret: string, rawBody: string, header: string | undefined): boolean {
  if (!header) return false
  const got = header.startsWith('sha256=') ? header.slice('sha256='.length) : header
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(got)
  // timingSafeEqual 在长度不等时会抛错,必须先比长度
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
```

> 这段只适用于 relay 事件订阅回调,**不要**挂到 `/v1/messages/subscribe` 的回调上 —— 那条链路没有签名(见第 1 条)。

---

*最后更新: 2026-09-23*
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
