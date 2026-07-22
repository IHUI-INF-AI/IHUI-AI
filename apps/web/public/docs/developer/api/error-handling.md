# 错误处理

> `/v1/*` API 采用 OpenAI 兼容错误格式,响应体为 `{ error: { message, type, code?, param? } }`,不套 `{ code, message, data }` 壳。

## HTTP 状态码完整列表

| 状态码 | 名称 | 说明 |
|--------|------|------|
| 200 | OK | 请求成功(默认响应) |
| 201 | Created | 资源创建成功(文件上传 / 文档入库 / 工作流实例创建等) |
| 202 | Accepted | 异步任务已受理(Agent 执行 / 视频生成 / 工作流入队) |
| 204 | No Content | 删除成功(无响应体) |
| 400 | Bad Request | 请求参数错误 / JSON 格式错误 / 必填参数缺失 / Zod 校验失败 |
| 401 | Unauthorized | API Key 无效、缺失、已过期或已吊销 |
| 403 | Forbidden | API Key 缺少调用该端点所需的权限点 |
| 404 | Not Found | 资源不存在(模型 / 文件 / 文档 / Agent / 任务 ID 等) |
| 409 | Conflict | 资源冲突(同 ID 文档已入库 / 同名 MoA 预设已存在 / 任务已在进行) |
| 413 | Payload Too Large | 文件过大(超过单次上传限制,请改用分片上传) |
| 429 | Too Many Requests | 配额超限(每小时 / 每天 token 或请求数用尽)或频率限制(每分钟) |
| 500 | Internal Server Error | 服务器内部错误(未预期异常) |
| 502 | Bad Gateway | 上游服务(ai-service / LiteLLM)返回错误 |
| 503 | Service Unavailable | 服务暂不可用(维护中 / 依赖未就绪 / 数据库不可达) |

## 错误响应格式

`/v1/*` 端点统一采用 OpenAI 兼容错误格式:

```json
{
  "error": {
    "message": "Model is required",
    "type": "invalid_request_error",
    "code": "validation_failed",
    "param": "model"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| error.message | string | 是 | 人类可读的错误描述(英文) |
| error.type | string | 是 | 错误类别(`invalid_request_error` / `authentication_error` / `permission_error` / `rate_limit_error` / `not_found_error` / `server_error` / `api_error`) |
| error.code | string | 否 | 细分错误码(如 `validation_failed` / `auth_invalid_api_key` / `quota_exceeded` / `model_not_found`) |
| error.param | string | 否 | 出错的参数名(仅 400 类错误携带) |

## 常见错误详解

### 400 Bad Request

请求参数错误(Zod 校验失败 / JSON 格式错误 / 必填字段缺失 / 数值越界)。

```json
{
  "error": {
    "message": "messages must contain at least one message",
    "type": "invalid_request_error",
    "code": "validation_failed",
    "param": "messages"
  }
}
```

**解决方案**:
- 检查请求体 JSON 格式(`Content-Type: application/json`)
- 确认所有必填参数已提供(参见各端点文档的参数表)
- 数值参数未越界(如 `topK` 为正整数,`threshold` 在 0-1 之间)
- 字符串长度符合限制(如 `prompt` 不为空)

### 401 Unauthorized

API Key 无效、缺失、已过期或已被吊销。

```json
{
  "error": {
    "message": "Invalid API key",
    "type": "authentication_error",
    "code": "auth_invalid_api_key"
  }
}
```

**解决方案**:
- 检查 `Authorization: Bearer ihui_xxx` 格式是否正确(Bearer 后有空格)
- 确认 API Key 前缀为 `ihui_`(非 `sk_`)
- 确认 API Key 未被删除/吊销(在管理后台 → API Key 管理查看)
- 若启用了 Secret 二次校验,确认 `X-Api-Secret: sk_xxx` 已正确传递
- 必要时在管理后台重新创建或轮换密钥

### 403 Forbidden

API Key 缺少调用该端点所需的权限点。

```json
{
  "error": {
    "message": "Insufficient permissions: requires 'chat:write'",
    "type": "permission_error",
    "code": "insufficient_permissions"
  }
}
```

**解决方案**:
- 查阅各端点文档中的"权限点"标注(共 27 个权限点,详见 [身份认证](../getting-started/authentication.md))
- 在管理后台编辑密钥权限集(勾选所需权限点)
- 或创建一个新 API Key,授予所需的权限子集
- 例如调用 `POST /v1/chat/completions` 需要 `chat:write` 权限

### 404 Not Found

请求的资源不存在(模型 / 文件 / 文档 / Agent / 任务 ID 等)。

```json
{
  "error": {
    "message": "Model not found: gpt-100",
    "type": "not_found_error",
    "code": "model_not_found"
  }
}
```

**解决方案**:
- 确认资源 ID 正确(从列表接口获取,如 `GET /v1/models`)
- 检查 ID 是否已被删除
- 模型 ID 大小写敏感(如 `gpt-4` 与 `GPT-4` 不同)
- Agent / 文档 / 文件 ID 通常为 UUID 格式

### 409 Conflict

资源冲突(同 ID 文档已入库 / 同名预设已存在 / 任务已在进行)。

```json
{
  "error": {
    "message": "MoA preset with name 'default' already exists",
    "type": "invalid_request_error",
    "code": "duplicate_preset"
  }
}
```

**解决方案**:
- 文档入库:使用不同 `title`,或先删除旧文档
- MoA 预设:换名创建,或先 `DELETE` 旧预设
- 任务状态冲突:先查询 `GET /v1/agents/tasks/:id/status` 确认状态

### 413 Payload Too Large

文件过大(超过单次上传限制,默认 50MB)。

```json
{
  "error": {
    "message": "File size exceeds single upload limit (50MB), use chunked upload instead",
    "type": "invalid_request_error",
    "code": "file_too_large"
  }
}
```

**解决方案**:
- 改用分片上传(`POST /v1/files/upload-init` → `upload-chunk` → `complete`)
- 详见 [文件 API](files.md) 的分片上传章节

### 429 Too Many Requests(配额超限)

API Key 超出**每小时 / 每天 token 配额**或**每分钟频率限制**。

响应头包含 `Retry-After`(秒数),表示建议重试的等待时间:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1721625600

{
  "error": {
    "message": "Hourly quota exceeded: 100000/100000 tokens used",
    "type": "rate_limit_error",
    "code": "quota_exceeded"
  }
}
```

| 响应头 | 说明 |
|--------|------|
| `Retry-After` | 建议等待的秒数(到下次配额重置) |
| `X-RateLimit-Limit` | 当前窗口配额上限 |
| `X-RateLimit-Remaining` | 当前窗口剩余配额 |
| `X-RateLimit-Reset` | 配额重置时间(Unix 时间戳) |

**解决方案**:
- 等待 `Retry-After` 指定的秒数后重试
- 降低请求频率(实现客户端限流,见下方代码示例)
- 在管理后台调整 API Key 的 `rateLimit` 配额
- 使用请求队列削峰(避免突发并发)
- 升级账户套餐获取更高配额
- 通过 `GET /v1/me` 查询当前配额用量(`quota.hourlyUsed` / `quota.hourlyLimit`)

### 500 Internal Server Error

服务器内部错误(未预期异常,通常为代码 bug 或依赖故障)。

```json
{
  "error": {
    "message": "Internal server error",
    "type": "server_error",
    "code": "internal_error"
  }
}
```

**解决方案**:
- 稍后重试(SDK 默认对 5xx 自动重试 2 次,指数退避)
- 检查请求参数是否合法(部分边界情况可能触发未捕获异常)
- 联系平台支持,提供 `X-Request-Id` 响应头以便追踪

### 502 Bad Gateway

上游服务(ai-service / LiteLLM / 厂商 API)返回错误。

```json
{
  "error": {
    "message": "Upstream service error: ai-service unreachable",
    "type": "api_error",
    "code": "upstream_error"
  }
}
```

**解决方案**:
- 检查厂商 API Key 是否有效(在 `POST /v1/user/models` 配置的密钥)
- 确认 ai-service 容器健康(`GET /v1/knowledge/health` 可作为探针)
- 稍后重试(可能是厂商临时限流)

### 503 Service Unavailable

服务暂不可用(维护中 / 依赖未就绪 / 数据库不可达)。

```json
{
  "error": {
    "message": "Service temporarily unavailable",
    "type": "server_error",
    "code": "service_unavailable"
  }
}
```

**解决方案**:
- 等待几分钟后重试
- 检查平台公告

## 错误处理最佳实践

### 1. TypeScript(使用 @ihui/sdk)

SDK 已封装 5xx 自动重试(指数退避 500ms / 1000ms),429 和 4xx 不重试。

```typescript
import { createClient, SdkError } from '@ihui/sdk'

const client = createClient({
  apiKey: process.env.IHUI_API_KEY!,
  maxRetries: 2, // 默认 2
})

try {
  const resp = await client.ai.completions({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
  })
  console.log(resp.choices[0].message.content)
} catch (e) {
  if (e instanceof SdkError) {
    switch (e.status) {
      case 401:
        console.error('API Key 无效,请检查或重新签发')
        break
      case 403:
        console.error('权限不足,需要 chat:write 权限')
        break
      case 404:
        console.error('模型不存在:', e.details)
        break
      case 429:
        console.error('配额超限,稍后重试。code:', e.code)
        break
      case 500:
      case 502:
      case 503:
        console.error('服务端错误,已重试仍失败:', e.message)
        break
      default:
        console.error(`未知错误 ${e.status}:`, e.message)
    }
  } else {
    console.error('网络错误:', e)
  }
}
```

### 2. Python(使用 ihui-ai)

Python SDK 提供细分异常类,便于精确捕获:

```python
import os
from ihui_ai import create_client
from ihui_ai.exceptions import (
    AuthenticationError,
    PermissionError,
    NotFoundError,
    QuotaExceededError,
    ServerError,
    NetworkError,
    SdkError,
)

client = create_client({"apiKey": os.environ["IHUI_API_KEY"]})

try:
    resp = client.ai.completions(
        {"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}
    )
    print(resp["choices"][0]["message"]["content"])
except AuthenticationError as e:
    print(f"API Key 无效: {e.message}")
except PermissionError as e:
    print(f"权限不足: {e.message}")
except NotFoundError as e:
    print(f"资源不存在: {e.message}")
except QuotaExceededError as e:
    print(f"配额超限: {e.message}(等待后重试)")
except ServerError as e:
    print(f"服务端错误 {e.status}: {e.message}")
except NetworkError as e:
    print(f"网络错误: {e.message}")
except SdkError as e:
    print(f"未知错误 {e.status}: {e.message}")
```

### 3. 手动重试(含 429 退避)

SDK 内置重试仅覆盖 5xx 和网络错误。对 429 配额超限,需自行实现 `Retry-After` 退避:

```typescript
async function callWithQuotaRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (e) {
      if (e instanceof SdkError && e.status === 429) {
        // Retry-After 通过响应头传递,SDK 不直接暴露;保守等待 60s
        const delay = 60 * 1000 * (i + 1)
        console.warn(`配额超限,${delay / 1000}s 后重试 (${i + 1}/${maxRetries})`)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      throw e
    }
  }
  throw new Error('Max retries exceeded')
}

// 使用
const result = await callWithQuotaRetry(() =>
  client.ai.completions({ model: 'gpt-4', messages: [...] }),
)
```

```python
import time
from ihui_ai.exceptions import QuotaExceededError


def call_with_quota_retry(fn, max_retries=3):
    for i in range(max_retries):
        try:
            return fn()
        except QuotaExceededError as e:
            delay = 60 * (i + 1)
            print(f"配额超限,{delay}s 后重试 ({i + 1}/{max_retries})")
            time.sleep(delay)
    raise RuntimeError("Max retries exceeded")


# 使用
result = call_with_quota_retry(
    lambda: client.ai.completions(
        {"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}
    )
)
```

### 4. 客户端限流(避免触发 429)

```typescript
class RateLimiter {
  private queue: Array<() => void> = []
  private running = 0
  constructor(private maxConcurrent: number, private perMinute: number) {}

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }
    this.running++
    try {
      return await fn()
    } finally {
      this.running--
      const next = this.queue.shift()
      if (next) next()
    }
  }
}

const limiter = new RateLimiter(5, 100) // 最多 5 并发,每分钟 100 次
const result = await limiter.throttle(() =>
  client.ai.completions({ model: 'gpt-4', messages: [...] }),
)
```

### 5. 流式请求错误处理

流式请求(`completionsStream` / `executeStream`)不重试,需捕获连接错误和流中断:

```typescript
try {
  const stream = client.ai.completionsStream({
    model: 'gpt-4',
    messages: [{ role: 'user', content: '讲个故事' }],
  })
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? ''
    process.stdout.write(content)
  }
} catch (e) {
  if (e instanceof SdkError) {
    if (e.status === 429) {
      console.error('\n流式请求触发配额限制,请稍后重试')
    } else {
      console.error(`\n流式请求失败 ${e.status}:`, e.message)
    }
  } else {
    console.error('\n网络中断:', e)
  }
}
```

## 错误码 → 权限点速查

部分错误码与权限点直接相关,便于快速定位:

| 错误码 | 关联权限点 | 说明 |
|--------|-----------|------|
| `insufficient_permissions` | 任一权限点 | API Key 未授予该端点所需权限 |
| `auth_invalid_api_key` | — | API Key 本身无效 |
| `auth_secret_required` | — | 端点要求 Secret 二次校验但未提供 |
| `quota_exceeded` | — | 触发小时 / 天配额上限 |
| `rate_limit_exceeded` | — | 触发每分钟频率上限 |
| `model_not_found` | — | 模型 ID 错误或未启用 |
| `file_too_large` | `files:write` | 单次上传超限,改用分片 |
| `validation_failed` | — | Zod 校验失败,见 `param` 字段 |

完整的 27 个权限点列表见 [身份认证 → 权限点](../getting-started/authentication.md#权限点完整列表)。

---

*最后更新: 2026-07-22*
