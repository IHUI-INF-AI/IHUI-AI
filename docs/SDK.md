# SDK 使用指南

> IHUI-AI 平台 5 语言 SDK(TypeScript / Python / Go / Java / .NET)统一对接 `apps/api` 的 `/v1/*` 对外公开 API,封装 105+ 端点、13 大功能模块,零运行时依赖(纯 stdlib / 标准库)。

---

## 总览

`packages/sdk/` 提供 5 套语言 SDK,均对接 `apps/api` 暴露的 `/v1/*` 公开 API。各 SDK 共享统一的模块划分、鉴权方式、重试策略与异常体系,差异仅在语言惯用法(构造器风格 / 流式迭代 / 异步模型)。

- 包结构总览(13 共享包职责、版本管理、跨端引用)见 [PACKAGES.md](./PACKAGES.md),本文件只聚焦**客户端使用**。
- 后端 `/v1/*` 端点契约见 [API_REFERENCE.md](./API_REFERENCE.md)。
- 鉴权与 API Key 生成见 [AUTHENTICATION.md](./AUTHENTICATION.md)。

### 核心设计原则

| 原则 | 说明 |
| --- | --- |
| 零运行时依赖 | TS 仅依赖 `@ihui/types`;Python 纯 stdlib;Go 仅标准库;Java 用 okhttp+jackson+slf4j;.NET 用 System.Text.Json |
| 模块对齐 | 5 语言均暴露 `ai / agents / audio / images / videos / threed / generation / knowledge / tools / memory / messages / files / user` 13 模块 |
| 自动重试 | 网络错误与 5xx 自动重试(指数退避 500ms / 1000ms),429 与 4xx 不重试,流式请求不重试不超时 |
| OpenAI 兼容 | `chat/completions` 流式遵循 `data: {json}\n\n` + `data: [DONE]` 格式,可直接复用 OpenAI 客户端逻辑 |

---

## 5 语言 SDK 矩阵

| SDK | 路径 | 安装方式 | 主要模块 | 最低运行时 | 版本 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| TypeScript | `packages/sdk/src/` | `pnpm add @ihui/sdk` | `agents / ai / audio / files / generation / images / index / knowledge / memory / messages / streaming / threed / tools / user / videos` | Node 20+ / 浏览器 fetch | 0.1.0 | Beta |
| Python | `packages/sdk/python/ihui_ai/` | `pip install ihui-ai` | `modules/{agents,ai,audio,files,generation,images,knowledge,memory,messages,threed,tools,user,videos}` + `async_client` + `streaming` | Python ≥ 3.10 | 0.1.0 | Beta |
| Go | `packages/sdk/go/` | `go get github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go` | `internal/client` + `internal/model` + `internal/module`(13 模块) | Go 1.21+ | 0.1.0 | Beta |
| Java | `packages/sdk/java/` | Maven `<dependency>com.ihui:ihui-ai-java:0.1.0</dependency>` | `com.ihui.ai.sdk.module/*`(13 Api)+ `model/*` | JDK 11+ | 0.1.0 | Beta |
| .NET | `packages/sdk/dotnet/` | NuGet `dotnet add package Ihui.AI` | `Client/` + `Models/` + `Modules/`(13 Api) | .NET 8 (net8.0) | 0.1.0 | Beta |

> "Beta" 表示 API 表面已稳定,但语义化版本尚未到 1.0,允许补丁版本内做不兼容的字段调整。

---

## 统一概念

### SdkConfig

所有 SDK 的配置入口,字段语义跨语言一致:

| 字段 | 必需 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `apiKey` | 是 | — | API Key,格式 `ihui_xxx`(在 web 控制台创建,见 [AUTHENTICATION.md](./AUTHENTICATION.md)) |
| `secret` | 否 | — | API Secret(创建/轮换时返回,敏感操作如支付需附带,通过 `X-Api-Secret` 头传递) |
| `baseUrl` | 否 | `http://localhost:8802` | API 基础 URL(去除尾部 `/`)。生产环境替换为你的域名 |
| `timeout` | 否 | `30000`(TS/Java/.NET 毫秒)/ `30`(Python 秒)/ `30s`(Go) | 请求超时。**流式请求不受此限制** |
| `maxRetries` | 否 | `2` | 最大重试次数(不含首次)。网络错误 + 5xx 自动重试,429 + 4xx 不重试 |
| `fetch` / `httpClient` / `http.Client` | 否 | 平台默认 | 自定义 HTTP 客户端(测试拦截 / 代理 / 共享连接池) |

### IhuiClient

5 语言均提供统一入口类 `IhuiClient`,聚合 13 个功能模块:

| 模块 | 端点数 | 职责 |
| --- | --- | --- |
| `ai` | 13 | chat / embeddings / vision / moa / models / userModels |
| `agents` | 12 | 列表 / 调用 / 高级执行 / Pipeline / 并行 / 任务分解 |
| `audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| `images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| `videos` | 3 | 生成 / 任务查询 / 编排 |
| `threed` | 1 | 3D 模型生成 |
| `generation` | 3 | 生成队列:入队 / 状态 / 取消 |
| `knowledge` | 13 | 知识库 / RAG / 知识图谱 |
| `tools` | 16 | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图 |
| `memory` | 8 | 保存 / 召回 / 搜索 / Dream / 分类记忆 |
| `messages` | 4 | 发布 / 订阅 / 状态 |
| `files` | 9 | 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传 |
| `user` | 9 | 用户 / 工作区 / 工作流 / 统计 |

### StreamResponse

流式响应统一为两种解析器(对应两类流式端点):

| 端点 | 协议 | 解析器 | chunk 类型 |
| --- | --- | --- | --- |
| `POST /v1/chat/completions`(stream:true) | OpenAI SSE(`data: {json}\n\n` + `data: [DONE]`) | `parseChatStream` | `ChatStreamChunk`(含 `choices[].delta.content`) |
| `POST /v1/agents/execute/stream` | 逐行透传 SSE(`data:` / `event:` / 原文) | `parseAgentStream` | `AgentStreamEvent`(`type: data|event|raw`) |

### 异常体系

5 语言异常类一一对应,均继承自基础 `SdkError` / `SdkException`:

| 异常 | HTTP 状态码 | 触发场景 |
| --- | --- | --- |
| `AuthenticationException` / `AuthenticationError` | 401 | apiKey 缺失 / 失效 / 格式错误 |
| `PermissionException` / `PermissionError` | 403 | 无权访问该资源 / 越租户 |
| `NotFoundException` / `NotFoundError` | 404 | 资源不存在(模型 / Agent / 文件 / 知识库) |
| `QuotaExceededException` / `QuotaExceededError` | 429 | 配额耗尽 / 限流(不重试,需等待) |
| `ServerException` / `ServerError` | 5xx | 服务端错误(自动重试 2 次后仍失败) |
| `NetworkError`(Python 独有) | 0 | 网络中断 / DNS 失败 / 超时(自动重试) |
| `SdkError` / `SdkException` | * | 兜底基类,携带 `status` + `code` + `details` |

---

## TypeScript SDK 使用

### 安装

```bash
pnpm add @ihui/sdk
# 或
npm install @ihui/sdk
yarn add @ihui/sdk
```

`@ihui/sdk` 仅依赖 `@ihui/types`(workspace 包,发布到 npm 时自动 bundle 类型),无任何运行时第三方依赖。

### 配置与初始化

```typescript
import { createClient, type SdkConfig } from '@ihui/sdk'

const config: SdkConfig = {
  apiKey: process.env.IHUI_API_KEY!,        // 必需
  baseUrl: 'https://api.your-domain.com',    // 可选,默认 http://localhost:8802
  timeout: 60000,                            // 可选,默认 30000ms
  maxRetries: 3,                             // 可选,默认 2
}

const client = createClient(config)

// 13 个模块:client.ai / client.agents / client.audio / client.images
// client.videos / client.threed / client.generation / client.knowledge
// client.tools / client.memory / client.messages / client.files / client.user
```

### 示例:对话(非流式)

```typescript
const resp = await client.ai.completions({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: '你是 IHUI 助手' },
    { role: 'user', content: '用一句话介绍 IHUI-AI' },
  ],
  temperature: 0.7,
})
console.log(resp.choices[0]?.message?.content)
```

### 示例:流式对话

```typescript
import { parseChatStream } from '@ihui/sdk'

const stream = client.ai.completionsStream({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: '写一首关于秋天的诗' }],
})
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
}
// 流式请求不超时、不重试(无法安全回放流)
```

### 示例:图片生成

```typescript
const img = await client.images.generations({
  model: 'dall-e-3',
  prompt: '赛博朋克风格的上海外滩',
  n: 1,
  size: '1024x1024',
})
console.log(img.data[0]?.url)
```

### 示例:Agent 执行

```typescript
// 高级执行(非流式)
const result = await client.agents.execute({
  agentId: 'researcher',
  input: '调研 LangGraph 与 LangChain 的差异',
  permissionGuard: { mode: 'default' },
})
console.log(result.output)

// 流式执行
const events = client.agents.executeStream({ agentId: 'coder', input: '重构 auth 模块' })
for await (const ev of events) {
  if (ev.type === 'data') console.log('data:', ev.data)
  else if (ev.type === 'event') console.log('event:', ev.data.name)
}
```

### 示例:知识库搜索(RAG)

```typescript
const hits = await client.knowledge.search({
  knowledgeBaseId: 'kb_001',
  query: '如何配置 OAuth2',
  topK: 5,
  rerank: true,
})
for (const hit of hits.results) {
  console.log(`[${hit.score}] ${hit.content.slice(0, 80)}`)
}
```

### 示例:向量记忆

```typescript
// 保存记忆
await client.memory.save({
  agentId: 'assistant',
  content: '用户偏好简洁回答,不喜欢冗长解释',
  metadata: { category: 'preference' },
})

// 召回相关记忆
const mem = await client.memory.search({
  agentId: 'assistant',
  query: '用户喜欢的回答风格',
  topK: 3,
})
```

### 示例:文件上传

```typescript
// 分片上传大文件
const init = await client.files.initUpload({
  filename: 'dataset.csv',
  size: 1024 * 1024 * 50,   // 50MB
  contentType: 'text/csv',
})
for (const part of init.parts) {
  // 上传每个分片后回传 etag
}
const final = await client.files.completeUpload(init.uploadId, parts)
console.log('文件 ID:', final.fileId)
```

### 示例:工具调用(MCP)

```typescript
const toolResult = await client.tools.call({
  toolName: 'web_search',
  arguments: { query: 'IHUI-AI 发布说明' },
})
console.log(toolResult.output)
```

---

## Python SDK 使用

### 安装

```bash
pip install ihui-ai
# 或 uv
uv pip install ihui-ai
```

`ihui-ai` 纯 stdlib 实现(urllib + json + asyncio),无第三方运行时依赖,支持 Python ≥ 3.10。

### 同步客户端

```python
from ihui_ai import create_client

client = create_client({
    "apiKey": "ihui_xxx",
    "baseUrl": "https://api.your-domain.com",
    "timeout": 30,
    "maxRetries": 2,
})

# 对话(非流式)
resp = client.ai.completions({
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "你好"}],
})
print(resp["choices"][0]["message"]["content"])

# 流式对话(同步生成器)
for chunk in client.ai.completions_stream({"model": "gpt-4o", "messages": [...]}):
    print(chunk["choices"][0]["delta"].get("content", ""), end="")
```

### 异步客户端(asyncio)

```python
import asyncio
from ihui_ai import AsyncIhuiClient

async def main():
    client = AsyncIhuiClient({"apiKey": "ihui_xxx"})
    models = await client.ai.list_models()

    # 异步流式
    async for chunk in client.ai.completions_stream({"model": "gpt-4o", "messages": [...]}):
        print(chunk["choices"][0]["delta"].get("content", ""), end="")

    # 并发调用多个模块
    import asyncio
    results = await asyncio.gather(
        client.images.generations({"model": "dall-e-3", "prompt": "猫"}),
        client.agents.execute({"agentId": "coder", "input": "写一个函数"}),
    )

asyncio.run(main())
```

### 异常处理

```python
from ihui_ai import (
    create_client, AuthenticationError, PermissionError,
    NotFoundError, QuotaExceededError, ServerError, NetworkError, SdkError,
)

client = create_client({"apiKey": "ihui_xxx"})
try:
    resp = client.ai.completions({"model": "gpt-4o", "messages": [...]})
except AuthenticationError as e:
    print(f"鉴权失败: {e.code} — {e.message}")
except QuotaExceededError as e:
    print(f"配额耗尽,请等待重置: {e.details}")
except NetworkError as e:
    print(f"网络错误(已重试 {client._base.max_retries} 次): {e}")
except ServerError as e:
    print(f"服务端 {e.status} 错误: {e.code}")
except SdkError as e:
    print(f"未知错误: {e.status} / {e.code}")
```

---

## Go SDK 使用

### 安装

```bash
go get github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go
```

模块路径 `github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go`,要求 Go 1.21+,仅依赖标准库 `net/http`。

### 配置与初始化(函数式选项)

```go
package main

import (
    "context"
    "fmt"
    "time"

    "github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go"
    "github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

func main() {
    client := ihui.NewIhuiClient(
        ihui.WithAPIKey("ihui_xxx"),
        ihui.WithBaseURL("https://api.your-domain.com"),
        ihui.WithTimeout(60*time.Second),
        ihui.WithMaxRetries(3),
        // ihui.WithHTTPClient(customHTTPClient),  // 自定义 http.Client
    )

    ctx := context.Background()

    // 对话(非流式)
    resp, err := client.AI.Completions(ctx, &model.ChatCompletionRequest{
        Model:    "gpt-4o",
        Messages: []model.Message{{Role: "user", Content: "你好"}},
    })
    if err != nil {
        panic(err)
    }
    fmt.Println(resp.Choices[0].Message.Content)
}
```

### 流式响应

```go
stream, err := client.AI.CompletionsStream(ctx, req)
if err != nil {
    panic(err)
}
for chunk := range stream {
    if len(chunk.Choices) > 0 {
        fmt.Print(chunk.Choices[0].Delta.Content)
    }
}
```

### 错误处理

```go
import "github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"

resp, err := client.AI.Completions(ctx, req)
if err != nil {
    var apiErr *client.APIError
    if errors.As(err, &apiErr) {
        switch apiErr.Status {
        case 401:
            fmt.Println("鉴权失败:", apiErr.Code)
        case 429:
            fmt.Println("限流,请稍后重试")
        case 404:
            fmt.Println("模型不存在:", apiErr.Message)
        default:
            fmt.Printf("服务端 %d: %s\n", apiErr.Status, apiErr.Code)
        }
    } else {
        fmt.Println("网络错误:", err)
    }
}
```

---

## Java SDK 使用

### Maven 依赖

```xml
<dependency>
    <groupId>com.ihui</groupId>
    <artifactId>ihui-ai-java</artifactId>
    <version>0.1.0</version>
</dependency>
```

要求 JDK 11+,依赖 okhttp 4.12 + jackson-databind 2.16 + slf4j-api 1.7(实现可自由选择 logback / log4j2)。

### Gradle

```groovy
implementation 'com.ihui:ihui-ai-java:0.1.0'
```

### 配置与初始化(Builder)

```java
import com.ihui.ai.sdk.IhuiClient;
import com.ihui.ai.sdk.model.ChatCompletionRequest;
import com.ihui.ai.sdk.model.ChatCompletionResponse;
import java.time.Duration;

public class Main {
    public static void main(String[] args) {
        IhuiClient client = IhuiClient.builder()
            .apiKey("ihui_xxx")
            .baseUrl("https://api.your-domain.com")
            .timeout(Duration.ofSeconds(60))
            .maxRetries(3)
            .build();

        // 对话(非流式)
        ChatCompletionResponse resp = client.ai.completions(
            ChatCompletionRequest.builder()
                .model("gpt-4o")
                .addMessage("user", "你好")
                .build()
        );
        System.out.println(resp.getChoices().get(0).getMessage().getContent());
    }
}
```

### 流式响应(try-with-resources)

```java
import com.ihui.ai.sdk.StreamResponse;
import com.fasterxml.jackson.databind.JsonNode;

try (StreamResponse stream = client.ai.completionsStream(req)) {
    while (stream.hasNext()) {
        JsonNode chunk = stream.next();
        String delta = chunk.at("/choices/0/delta/content").asText("");
        System.out.print(delta);
    }
}
```

### 异常处理

```java
import com.ihui.ai.sdk.*;

try {
    client.ai.completions(req);
} catch (AuthenticationException e) {
    System.err.println("鉴权失败: " + e.getCode());
} catch (PermissionException e) {
    System.err.println("无权限: " + e.getMessage());
} catch (NotFoundException e) {
    System.err.println("模型不存在");
} catch (QuotaExceededException e) {
    System.err.println("配额耗尽,稍后再试");
} catch (ServerException e) {
    System.err.println("服务端 " + e.getStatus() + ": " + e.getCode());
} catch (SdkException e) {
    System.err.println("未知错误: " + e.getStatus() + " / " + e.getCode());
}
```

---

## .NET SDK 使用

### NuGet 安装

```bash
dotnet add package Ihui.AI
```

要求 .NET 8(net8.0),启用 Nullable 与 ImplicitUsings,使用 System.Text.Json(无第三方依赖)。

### 配置与初始化(Builder)

```csharp
using Ihui.AI;
using Ihui.AI.Models;

var client = IhuiClient.CreateBuilder()
    .WithApiKey("ihui_xxx")
    .WithBaseUrl("https://api.your-domain.com")
    .WithTimeout(TimeSpan.FromSeconds(60))
    .WithMaxRetries(3)
    // .WithHttpClient(sharedHttpClient)  // 依赖注入 / 共享连接池
    .Build();

// 对话(非流式)
var resp = await client.Ai.CompletionsAsync(new ChatCompletionRequest
{
    Model = "gpt-4o",
    Messages = new List<Message> { new("user", "你好") },
});
Console.WriteLine(resp.Choices[0].Message.Content);
```

### 流式响应

```csharp
await foreach (var chunk in client.Ai.ChatCompletionsStreamAsync(req))
{
    var delta = chunk.GetProperty("choices")[0]
        .GetProperty("delta").GetProperty("content").GetString();
    Console.Write(delta);
}
```

### 异常处理

```csharp
using Ihui.AI;

try
{
    await client.Ai.CompletionsAsync(req);
}
catch (AuthenticationException e)
{
    Console.Error.WriteLine($"鉴权失败: {e.Code}");
}
catch (PermissionException e)
{
    Console.Error.WriteLine($"无权限: {e.Message}");
}
catch (NotFoundException e)
{
    Console.Error.WriteLine("资源不存在");
}
catch (QuotaExceededException e)
{
    Console.Error.WriteLine("配额耗尽");
}
catch (ServerException e)
{
    Console.Error.WriteLine($"服务端 {e.Status}: {e.Code}");
}
catch (SdkException e)
{
    Console.Error.WriteLine($"未知错误: {e.Status} / {e.Code}");
}
finally
{
    client.Dispose();  // IhuiClient 实现 IDisposable
}
```

---

## 流式响应处理

### TS 流式解析

```typescript
import { parseChatStream, parseAgentStream, type ChatStreamChunk, type AgentStreamEvent } from '@ihui/sdk'

// chat.completions 流(OpenAI 兼容)
const stream = await client.requestStream('POST', '/chat/completions', { ...req, stream: true })
for await (const chunk of parseChatStream(stream)) {
  // chunk.id / chunk.model / chunk.choices[0].delta.content / chunk.choices[0].finishReason
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '')
  if (chunk.choices[0]?.finishReason === 'stop') break
}

// Agent 执行流(逐行透传 data/event/raw)
const agentStream = await client.requestStream('POST', '/agents/execute/stream', req)
for await (const ev of parseAgentStream(agentStream)) {
  if (ev.type === 'event' && ev.data.name === 'tool_call') {
    console.log('工具调用开始')
  } else if (ev.type === 'data') {
    console.log('数据:', ev.data)
  }
}
```

### Python 流式解析(同步 + 异步)

```python
from ihui_ai import (
    parse_chat_stream_sync, parse_chat_stream_async,
    parse_agent_stream_sync, parse_agent_stream_async,
)
from ihui_ai import create_client, AsyncIhuiClient

# 同步:parse_chat_stream_sync(raw_bytes_iterator) -> Generator[dict]
client = create_client({"apiKey": "ihui_xxx"})
raw = client.ai._client.request_stream("POST", "/chat/completions", {..., "stream": True})
for chunk in parse_chat_stream_sync(raw):
    print(chunk["choices"][0]["delta"].get("content", ""), end="")

# 异步:parse_chat_stream_async(raw_async_iterator) -> AsyncGenerator[dict]
async_client = AsyncIhuiClient({"apiKey": "ihui_xxx"})
async def consume():
    raw = await async_client.ai._async_client.request_stream("POST", "/chat/completions", {..., "stream": True})
    async for chunk in parse_chat_stream_async(raw):
        print(chunk["choices"][0]["delta"].get("content", ""), end="")
```

### 流式注意事项

| 限制 | 说明 |
| --- | --- |
| 不超时 | 流式请求不受 `timeout` 限制(避免长生成被切断) |
| 不重试 | 流式请求不重试(无法安全回放已消费的字节流) |
| 心跳跳过 | 解析器自动跳过空行 / 非 `data:` 前缀行 / 无法 JSON 解析的注释行 |
| 终止符 | 遇到 `data: [DONE]` 立即结束迭代并释放 reader lock |

---

## 错误处理

### TS try-catch 模板

```typescript
import { SdkError, createClient } from '@ihui/sdk'

const client = createClient({ apiKey: process.env.IHUI_API_KEY! })

try {
  const resp = await client.ai.completions(req)
} catch (e) {
  if (e instanceof SdkError) {
    console.error(`[SDK ${e.status}] ${e.code}: ${e.message}`)
    if (e.details) console.error('详情:', e.details)
    // 按状态码分支处理
    switch (e.status) {
      case 401: /* 重新获取 apiKey */ break
      case 403: /* 检查租户权限 */ break
      case 404: /* 模型 / 资源不存在 */ break
      case 429: /* 等待重置,不重试 */ break
      case 500: case 502: case 503: /* 已自动重试 2 次,仍失败 */ break
    }
  } else {
    console.error('非 SDK 错误:', e)
  }
}
```

### 错误码映射表

| HTTP 状态 | `code` 字段典型值 | 异常类 | 是否重试 | 建议处理 |
| --- | --- | --- | --- | --- |
| 401 | `missing_api_key` / `invalid_api_key` / `expired_token` | AuthenticationException | 否 | 检查 apiKey,必要时刷新 token |
| 403 | `forbidden` / `tenant_mismatch` | PermissionException | 否 | 检查租户 / 角色权限 |
| 404 | `not_found` / `model_not_found` | NotFoundException | 否 | 检查资源 ID / 模型名 |
| 422 | `validation_error` | SdkError | 否 | 检查请求参数(Zod 校验失败) |
| 429 | `quota_exceeded` / `rate_limited` | QuotaExceededException | 否 | 等待 `Retry-After` 秒数后重试 |
| 500 | `internal_error` | ServerException | 是(自动 2 次) | 重试仍失败则告警 |
| 502 / 503 / 504 | `bad_gateway` / `unavailable` | ServerException | 是(自动 2 次) | 检查上游 / 网关 |
| 0 | `network_error` | NetworkError(Python) | 是(自动 2 次) | 检查网络 / DNS / 代理 |

---

## 与 apps/api 对接

SDK 模块与后端 `/v1/*` 端点对应关系(完整端点列表见 [API_REFERENCE.md](./API_REFERENCE.md)):

| SDK 模块 | 后端路由前缀 | 主要端点 |
| --- | --- | --- |
| `ai` | `/v1/chat`、`/v1/embeddings`、`/v1/models`、`/v1/moa-presets`、`/v1/user/models` | completions / completionsStream / embeddings / vision / moa / listModels / getModel |
| `agents` | `/v1/agents` | list / get / call / execute / executeStream / pipeline / parallel / decompose |
| `audio` | `/v1/audio` | speech / transcriptions / voice-chat / voiceprint / music |
| `images` | `/v1/images` | generations / edits / variations / inpaint / style-transfer / virtual-tryon |
| `videos` | `/v1/videos` | generations / tasks / orchestrate |
| `threed` | `/v1/3d` | generations |
| `generation` | `/v1/generation` | enqueue / status / cancel |
| `knowledge` | `/v1/knowledge` | bases / search / documents / graph |
| `tools` | `/v1/tools` | call / skills / personas / code-search / screenshot |
| `memory` | `/v1/memory` | save / recall / search / dream / classify |
| `messages` | `/v1/messages` | publish / subscribe / status |
| `files` | `/v1/files` | list / upload / detail / delete / content / versions / multipart |
| `user` | `/v1/user`、`/v1/workspaces`、`/v1/workflows`、`/v1/stats` | profile / workspaces / workflows / stats |

> 鉴权头:`Authorization: Bearer ihui_xxx` + 可选 `X-Api-Secret: <secret>`。所有请求路径自动拼 `/v1` 前缀。

---

## 自定义配置

### 超时

```typescript
// TS:整体超时(毫秒)
const client = createClient({ apiKey, timeout: 120000 })

// 单请求覆盖(通过自定义 fetch)
const longClient = createClient({
  apiKey,
  fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(180000) }),
})
```

```python
# Python:整体超时(秒)
client = create_client({"apiKey": api_key, "timeout": 120})
```

```go
// Go:整体超时
client := ihui.NewIhuiClient(ihui.WithAPIKey(key), ihui.WithTimeout(2*time.Minute))
```

### 重试

```typescript
// TS:关闭重试(对幂等性低的操作)
const client = createClient({ apiKey, maxRetries: 0 })
```

```java
// Java:增加重试
IhuiClient client = IhuiClient.builder().apiKey(key).maxRetries(5).build();
```

### 代理

```typescript
// TS(Node 18+):通过 undici ProxyAgent
import { ProxyAgent, setGlobalDispatcher } from 'undici'
setGlobalDispatcher(new ProxyAgent('http://proxy.corp.com:8080'))
const client = createClient({ apiKey })
```

```python
# Python:通过环境变量
import os
os.environ["HTTP_PROXY"] = "http://proxy.corp.com:8080"
os.environ["HTTPS_PROXY"] = "http://proxy.corp.com:8080"
client = create_client({"apiKey": api_key})
```

```go
// Go:通过自定义 http.Client.Transport
proxyURL, _ := url.Parse("http://proxy.corp.com:8080")
client := ihui.NewIhuiClient(
    ihui.WithAPIKey(key),
    ihui.WithHTTPClient(&http.Client{
        Transport: &http.Transport{Proxy: http.ProxyURL(proxyURL)},
    }),
)
```

```csharp
// .NET:通过自定义 HttpClient(默认走系统代理)
var handler = new HttpClientHandler { Proxy = new WebProxy("http://proxy.corp.com:8080") };
var client = IhuiClient.CreateBuilder()
    .WithApiKey(key)
    .WithHttpClient(new HttpClient(handler))
    .Build();
```

### 自定义 HTTP 客户端(测试拦截)

```typescript
// TS:用 mock fetch 拦截请求(单元测试)
const mockFetch = vi.fn(async (url, init) => new Response(JSON.stringify({ ok: true }), { status: 200 }))
const client = createClient({ apiKey: 'ihui_test', fetch: mockFetch })
await client.ai.listModels()
expect(mockFetch).toHaveBeenCalledWith(
  'http://localhost:8802/v1/models',
  expect.objectContaining({ method: 'GET' }),
)
```

```csharp
// .NET:依赖注入共享 HttpClient(ASP.NET Core 场景)
services.AddSingleton<IhuiClient>(_ =>
    IhuiClient.CreateBuilder()
        .WithApiKey(config["IHUI_API_KEY"])
        .WithHttpClient(httpClientFactory.CreateClient("Ihui"))
        .Build());
```

---

## 版本管理

### 版本号策略

各 SDK 独立版本号,均遵循 [SemVer](https://semver.org/lang/zh-CN/) `major.minor.patch`:

| SDK | 版本号位置 | 当前版本 |
| --- | --- | --- |
| TS | `packages/sdk/package.json` → `version` | 0.1.0 |
| Python | `packages/sdk/python/pyproject.toml` → `[project].version` + `ihui_ai/__init__.py` → `__version__` | 0.1.0 |
| Go | `packages/sdk/go/internal/client/client.go` 常量(无 go.mod version,走 git tag) | 0.1.0 |
| Java | `packages/sdk/java/pom.xml` → `<version>` | 0.1.0 |
| .NET | `packages/sdk/dotnet/Ihui.AI.csproj` → `<Version>` | 0.1.0 |

### 与 apps/api 兼容矩阵

| apps/api 版本 | 推荐 SDK 版本 | 兼容说明 |
| --- | --- | --- |
| v1.x(当前) | 0.1.x | API 表面稳定,字段可能补丁内调整 |
| v2.x(规划) | 1.0+ | 锁定 1.0 后保证向后兼容 |

> 发布新 SDK 时,所有 5 语言同步发版(见 [RELEASE.md](./RELEASE.md) 多端发布矩阵),版本号保持一致以避免跨语言混淆。

### 变更日志

SDK 变更记录见根 [docs/CHANGELOG.md](./CHANGELOG.md) 的 `packages/sdk` 段落;每个语言 SDK 目录下也有独立的 `README.md`(`packages/sdk/{python,go,java,dotnet}/README.md`)记录语言特定说明。

---

## 最优下一步建议

- 接入 SDK 后,建议先用 `client.ai.listModels()` 做连通性自检,确认 `baseUrl` + `apiKey` 正确。
- 流式场景务必消费完迭代器(或显式 release reader lock),否则连接会泄漏。
- 生产环境请把 `apiKey` 放环境变量 / 密钥管理服务,不要硬编码进源码(见 [SECURITY.md](./SECURITY.md))。
