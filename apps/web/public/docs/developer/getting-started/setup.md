# 环境配置

> 本指南覆盖 SDK 安装、初始化、环境变量配置与首个请求验证。支持 TypeScript(`@ihui/sdk`)与 Python(`ihui-ai`)两种官方 SDK,以及其他语言的直接 HTTP 调用。

## 前置条件

### 获取 API Key

1. 登录 IHUI-AI 管理后台 → 设置 → API 密钥
2. 点击「创建密钥」,设置名称,从 27 个权限点中勾选所需权限
3. 创建成功后立即复制保存:
   - **API Key**(`ihui_xxx`)— 公开标识
   - **Secret**(`sk_xxx`)— 仅此一次返回

详见 [身份认证](./authentication.md)。

### 运行环境

| 项 | TypeScript SDK | Python SDK | 直接 HTTP |
|----|----------------|------------|-----------|
| 运行时 | Node.js >= 18 | Python >= 3.10 | 任意支持 HTTPS 的语言 |
| 推荐 | Node.js >= 20 | Python 3.11+ | — |

## TypeScript SDK

### 安装

```bash
npm install @ihui/sdk
# 或
pnpm add @ihui/sdk
# 或
yarn add @ihui/sdk
```

### 初始化

```typescript
import { createClient } from '@ihui/sdk'

const client = createClient({
  apiKey: process.env.IHUI_API_KEY!, // 必填
  secret: process.env.IHUI_API_SECRET, // 可选,启用 Secret 二次校验
  baseUrl: 'http://localhost:3001', // 可选,默认 http://localhost:3001
  timeout: 30000, // 可选,默认 30000ms
  maxRetries: 2, // 可选,默认 2(仅对 5xx / 网络错误重试)
})
```

客户端对象 `client` 包含 13 个模块:`ai` / `agents` / `files` / `audio` / `images` / `videos` / `threed` / `generation` / `knowledge` / `tools` / `memory` / `messages` / `user`。

### 首个请求

```typescript
// Chat 补全
const response = await client.ai.completions({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '你好' }],
})
console.log(response.choices[0].message.content)

// 流式输出
const stream = await client.ai.completionsStream({
  model: 'gpt-4',
  messages: [{ role: 'user', content: '讲个笑话' }],
  stream: true,
})
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}

// 列出模型
const models = await client.ai.listModels()
console.log(models.data.map(m => m.id))
```

## Python SDK

### 安装

```bash
pip install ihui-ai
# 或
poetry add ihui-ai
```

### 初始化

```python
import os
from ihui_ai import create_client, create_async_client

# 同步客户端
client = create_client({
    "apiKey": os.environ["IHUI_API_KEY"],  # 必填
    "secret": os.environ.get("IHUI_API_SECRET"),  # 可选
    "baseUrl": "http://localhost:3001",  # 可选,默认 http://localhost:3001
    "timeout": 30000,  # 可选,默认 30000ms
    "maxRetries": 2,  # 可选,默认 2
})

# 异步客户端(适用于 asyncio 场景)
async_client = create_async_client({
    "apiKey": os.environ["IHUI_API_KEY"],
})
```

客户端对象包含 13 个模块,方法名采用 snake_case(如 `completions_stream`、`list_models`)。

### 首个请求

```python
# Chat 补全
response = client.ai.completions(
    model="gpt-4",
    messages=[{"role": "user", "content": "你好"}],
)
print(response["choices"][0]["message"]["content"])

# 流式输出
stream = client.ai.completions_stream(
    model="gpt-4",
    messages=[{"role": "user", "content": "讲个笑话"}],
    stream=True,
)
for chunk in stream:
    delta = chunk["choices"][0].get("delta", {}).get("content", "")
    print(delta, end="", flush=True)

# 列出模型
models = client.ai.list_models()
print([m["id"] for m in models["data"]])
```

### 异步示例

```python
import asyncio

async def main():
    response = await async_client.ai.completions(
        model="gpt-4",
        messages=[{"role": "user", "content": "你好"}],
    )
    print(response["choices"][0]["message"]["content"])

asyncio.run(main())
```

## 直接 HTTP 调用

不使用 SDK 时,可直接发起 HTTP 请求。所有端点以 `http://localhost:3001/v1` 为前缀。

### cURL

```bash
curl -X POST http://localhost:3001/v1/chat/completions \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"你好"}]}'
```

更多示例见 [cURL 示例](../sdk/curl.md)。

### Node.js(fetch)

```javascript
const response = await fetch('http://localhost:3001/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${process.env.IHUI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4',
    messages: [{ role: 'user', content: '你好' }],
  }),
})
const data = await response.json()
console.log(data.choices[0].message.content)
```

## 环境变量

推荐使用环境变量管理密钥,避免硬编码:

```bash
# .env(不要提交到 git,确保 .gitignore 已排除)
IHUI_API_KEY=ihui_xxx
IHUI_API_SECRET=sk_xxx
IHUI_BASE_URL=http://localhost:3001
```

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `IHUI_API_KEY` | 是 | API Key(`ihui_xxx`) |
| `IHUI_API_SECRET` | 否 | Secret(`sk_xxx`),启用二次校验时必填 |
| `IHUI_BASE_URL` | 否 | API 地址,默认 `http://localhost:3001` |

## 验证连通性

安装完成后,运行以下命令验证 API Key 与服务连通性:

```bash
curl http://localhost:3001/v1/models \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

预期返回 200 + 模型列表 JSON。若返回 401 → 检查 API Key;若返回 403 → 检查是否授予 `models:read` 权限;若连接拒绝 → 检查 baseUrl 与服务状态。

## 下一步

- [API 概览](../api/overview.md) — 浏览 105 个端点
- [身份认证](./authentication.md) — 27 权限点详解
- [JavaScript SDK](../sdk/javascript.md) / [Python SDK](../sdk/python.md) — 完整 SDK 用法
- [错误处理](../api/error-handling.md) — 错误码与重试策略

---

*最后更新: 2026-07-22*
