# IHUI AI .NET SDK

IHUI-AI 平台官方 .NET / C# SDK,完整封装 105 个 `/v1/*` 对外开放 API 端点,涵盖 13 个业务模块,让 .NET 开发者通过 API Key 一行代码接入平台所有 AI 功能。

## 特性

- **105 端点全覆盖**:13 模块 / 105 个 `/v1/*` 端点完整封装
- **现代 C# 12 + .NET 8.0**:使用 `record` / `primary constructor` / `required` 成员 / `IAsyncEnumerable` / nullable enable / implicit usings
- **零外部依赖**:纯 BCL 实现(`System.Net.Http` + `System.Text.Json` + `System.Threading`),无任何 NuGet 包依赖
- **流式响应**:`IAsyncEnumerable<JsonElement>` + `await foreach`,自动解析 SSE(`data: {json}` / `[DONE]`)
- **重试机制**:网络错误 + 5xx 自动重试 2 次(指数退避 500ms / 1000ms),429 不重试
- **错误层级**:统一异常层级(`SdkException` / `AuthenticationException` / `PermissionException` / `NotFoundException` / `QuotaExceededException` / `ServerException`)
- **强类型 DTO**:核心请求/响应使用强类型 class / record,其他端点使用 `JsonElement?` 灵活 JSON 树
- **camelCase 映射**:`[JsonPropertyName]` 显式注解,与后端契约一致
- **完整 XML 文档注释**:每个类 / 方法 / 参数均有中文文档注释
- **Builder 模式**:`IhuiClient.CreateBuilder()` / `SdkConfig.CreateBuilder()` / `ChatCompletionRequest.CreateBuilder()`
- **完整 async 签名**:所有方法 `async` 后缀 `Async`,默认 `CancellationToken = default`

## 安装

### NuGet(待发布)

```bash
dotnet add package Ihui.AI --version 0.1.0
```

### 项目引用(本地开发)

在消费项目的 `.csproj` 中添加:

```xml
<ItemGroup>
  <ProjectReference Include="..\..\path\to\packages\sdk\dotnet\Ihui.AI.csproj" />
</ItemGroup>
```

### 编译产物

```bash
cd packages/sdk/dotnet
dotnet build -c Release       # 产出 bin/Release/net8.0/Ihui.AI.dll
dotnet pack -c Release        # 产出 bin/Release/Ihui.AI.0.1.0.nupkg
```

## 快速开始

```csharp
using Ihui.AI;

var client = IhuiClient.CreateBuilder()
    .WithApiKey("ihui_xxx")
    .WithBaseUrl("http://localhost:8802")
    .Build();

var req = ChatCompletionRequest.CreateBuilder()
    .WithModel("gpt-4o")
    .AddMessage("user", "你好")
    .Build();

ChatCompletionResponse? resp = await client.Ai.CompletionsAsync(req);
Console.WriteLine(resp?.GetContent());
```

## 13 个业务模块

| 模块属性 | 类 | 端点数 | 说明 |
|---------|----|----|----|
| `client.Ai` | `AiApi` | 13 | chat / embeddings / vision / moa / models / userModels |
| `client.Agents` | `AgentsApi` | 12 | Agent 列表 / 调用 / 高级执行 / Pipeline / 并行 |
| `client.Audio` | `AudioApi` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| `client.Images` | `ImagesApi` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| `client.Videos` | `VideosApi` | 3 | 视频生成 / 任务查询 / 编排 |
| `client.ThreeD` | `ThreeDApi` | 1 | 3D 模型生成 |
| `client.Generation` | `GenerationApi` | 3 | 生成队列:入队 / 状态 / 取消 |
| `client.Knowledge` | `KnowledgeApi` | 13 | 知识库 / RAG / 知识图谱 |
| `client.Tools` | `ToolsApi` | 16 | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图 |
| `client.Memory` | `MemoryApi` | 8 | 记忆:保存 / 召回 / 搜索 / Dream / 分类记忆 |
| `client.Messages` | `MessagesApi` | 4 | 消息:发布 / 订阅 / 状态 |
| `client.Files` | `FilesApi` | 9 | 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传 |
| `client.User` | `UserApi` | 9 | 用户 / 工作区 / 工作流 / 统计 |

## 配置选项

```csharp
var client = IhuiClient.CreateBuilder()
    .WithApiKey("ihui_xxx")                              // 必需,API Key
    .WithSecret("optional-api-secret")                  // 可选,API Secret
    .WithBaseUrl("https://api.ihui.example.com")        // 默认 http://localhost:8802
    .WithTimeout(TimeSpan.FromSeconds(60))               // 默认 30s,流式请求不超时
    .WithMaxRetries(2)                                   // 默认 2,网络错误 + 5xx 自动重试
    .WithHttpClient(new HttpClient())                    // 可选,自定义 HttpClient(依赖注入场景)
    .Build();
```

`BaseUrl` 末尾的 `/` 会被自动去除。`HttpClient` 不传则内部创建独立实例(SocketsHttpHandler + 连接池),`IhuiClient` 实现 `IDisposable` 可释放。

## 流式响应(`IAsyncEnumerable`)

```csharp
using System.Text.Json;

var req = ChatCompletionRequest.CreateBuilder()
    .WithModel("gpt-4o")
    .AddMessage("user", "讲一个故事")
    .Build();

await foreach (JsonElement chunk in client.Ai.ChatCompletionsStreamAsync(req))
{
    string? delta = chunk.GetProperty("choices")[0]
        .GetProperty("delta").GetProperty("content").GetString();
    Console.Write(delta);
}
```

Agent 流式执行:

```csharp
var req = AgentExecuteRequest.CreateBuilder()
    .WithAgentId("ag_xxx")
    .WithInput("分析代码")
    .Build();

await foreach (JsonElement evt in client.Agents.ExecuteStreamAsync(req))
{
    Console.WriteLine(evt);
}
```

底层 SSE 解析由 `StreamResponse.ParseSseAsync` 静态方法实现,自动跳过空行 / 注释行,识别 `data: ` 前缀,遇到 `[DONE]` 终止枚举。流式请求使用独立的 `HttpClient`(Timeout = `InfiniteTimeSpan`),不受 `SdkConfig.Timeout` 限制。

## 错误处理

```csharp
try
{
    var resp = await client.Ai.CompletionsAsync(req);
}
catch (AuthenticationException e)
{
    // 401 — API Key 无效或缺失
    Console.Error.WriteLine($"认证失败:{e.Message}");
}
catch (PermissionException e)
{
    // 403 — 权限不足(API Key 未授予对应权限点)
    Console.Error.WriteLine($"无权限:{e.Message}");
}
catch (NotFoundException e)
{
    // 404 — 资源不存在(如模型 ID 错误)
    Console.Error.WriteLine($"未找到:{e.Message}");
}
catch (QuotaExceededException e)
{
    // 429 — 配额超限(不重试)
    Console.Error.WriteLine($"超限:{e.Message}");
}
catch (ServerException e)
{
    // 5xx — 服务端错误(已重试 MaxRetries 次后仍失败)
    Console.Error.WriteLine($"服务器错误 [{e.Status}]:{e.Message}");
}
catch (SdkException e)
{
    // 兜底:其他错误(含网络错误,Status=0)
    Console.Error.WriteLine($"SDK 错误 [{e.Status}/{e.Code}]:{e.Message}");
}
```

所有异常都继承自 `SdkException`,携带:
- `Status` — HTTP 状态码(网络错误为 0)
- `Code` — 错误码字符串(如 `auth_invalid_api_key`),可能为 null
- `Details` — 错误详情(来自响应体的反序列化对象),可能为 null
- `Message` — 错误消息(从响应体 `error.message` 解析,无则用 `HTTP <status>`)

## 文件上传(multipart)

### 简单上传(Stream)

```csharp
await using var fs = File.OpenRead("photo.png");
var result = await client.Files.UploadAsync(fs, "photo.png", "image/png");
string? fileId = result?.GetProperty("id").GetString();
```

### 字节数组上传

```csharp
byte[] data = await File.ReadAllBytesAsync("doc.pdf");
var result = await client.Files.UploadAsync(data, "doc.pdf", "application/pdf");
```

### 分片上传

```csharp
// 1. 初始化
var initReq = new UploadInitRequest
{
    Filename = "large.zip",
    Size = 123456789L,
    MimeType = "application/zip",
    TotalChunks = 120
};
var initResp = await client.Files.UploadInitAsync(initReq);
string? uploadId = initResp?.GetProperty("uploadId").GetString();

// 2. 逐片上传
for (int i = 0; i < 120; i++)
{
    byte[] chunk = ReadChunk(i);  // 自定义分片读取
    await client.Files.UploadChunkAsync(uploadId!, i, chunk);
}

// 3. 完成上传
var done = await client.Files.UploadCompleteAsync(new { uploadId });
string? finalFileId = done?.GetProperty("fileId").GetString();
```

`UploadChunkAsync` 内部使用 `MultipartFormDataContent`,同时包含 `uploadId` / `index` 两个文本字段和 `chunk` 二进制字段。

## 文件下载(二进制)

```csharp
byte[] content = await client.Files.GetContentAsync("file_xxx");
await File.WriteAllBytesAsync("downloaded.bin", content);
```

`GetContentAsync` 返回 `Task<byte[]>`,直接读取响应体的原始字节流。

## 工作流调用

```csharp
var req = new WorkflowRequest
{
    WorkflowId = "wf_xxx",
    Input = new Dictionary<string, object> { ["text"] = "处理这段文本" }
};

// 平台原生工作流
var result = await client.User.RunWorkflowAsync(req);

// Coze 工作流
var cozeResult = await client.User.RunCozeWorkflowAsync(req);

// n8n 工作流
var n8nResult = await client.User.RunN8nWorkflowAsync(req);
```

## Agent 高级执行

```csharp
// 非流式执行
var req = AgentExecuteRequest.CreateBuilder()
    .WithAgentId("ag_xxx")
    .WithInput("分析这段代码")
    .WithMaxSteps(10)
    .Build();
AgentExecuteResponse? resp = await client.Agents.ExecuteAsync(req);
Console.WriteLine($"状态:{resp?.Status},输出:{resp?.Output}");

// 任务编排:Pipeline
var pipelineResp = await client.Agents.PipelineAsync(new
{
    pipeline = new[] { "agent_a", "agent_b" },
    input = "处理数据"
});

// 任务编排:并行
var parallelResp = await client.Agents.ParallelAsync(new
{
    agents = new[] { "agent_a", "agent_b" },
    input = "并行处理"
});
```

## 知识库 / RAG

```csharp
// 搜索
var searchResp = await client.Knowledge.SearchAsync(new KnowledgeSearchRequest
{
    Query = "如何接入 SDK",
    TopK = 5,
    Threshold = 0.7
});

// 文档入库
var ingestResp = await client.Knowledge.IngestDocumentAsync(new
{
    title = "用户手册",
    content = "SDK 接入文档内容...",
    source = "manual"
});
```

## 用量统计

```csharp
UsageResponse? usage = await client.User.GetUsageAsync();
Console.WriteLine($"总请求数:{usage?.TotalRequests}");
Console.WriteLine($"总 Token:{usage?.TotalTokens}");
Console.WriteLine($"总成本:{usage?.TotalCost}");

// 按厂商统计
var vendorUsage = await client.User.GetVendorUsageAsync("openai");
```

## CancellationToken 超时控制

```csharp
// 用 CancellationTokenSource 控制超时
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));

try
{
    var resp = await client.Ai.CompletionsAsync(req, cts.Token);
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("请求超时(10s)");
}

// 流式响应中也可取消
using var streamCts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
await foreach (var chunk in client.Ai.ChatCompletionsStreamAsync(req, streamCts.Token))
{
    // 处理 chunk
    if (someCondition) streamCts.Cancel();  // 主动取消
}
```

所有异步方法都接受 `CancellationToken`(默认 `default`),流式 `IAsyncEnumerable` 的取消通过 `[EnumeratorCancellation]` 自动传递。

## 鉴权说明

SDK 自动为每个请求注入以下 header:

- `Authorization: Bearer ${ApiKey}`(必需)
- `X-Api-Secret: ${Secret}`(可选,通过 `.WithSecret("...")` 配置)
- `Content-Type: application/json`(普通请求)或 `multipart/form-data; boundary=...`(上传请求)

后端鉴权链路:
1. 从 `Authorization: Bearer <API_KEY>` 提取 API Key
2. 在 `developer_api_keys` 表中查找对应的 hashed secret
3. 验证 API Key 的状态 / 过期时间 / 权限点
4. 可选校验 `X-Api-Secret`(若 API Key 启用了双因子)
5. 通过后注入 `req.developer = { id, permissions }` 到下游

## 端点列表(105 个)

完整端点列表见各模块类的 XML 文档注释。模块字段对照:

- `client.Ai.*` → 13 端点(chat / embeddings / vision / moa / models / userModels)
- `client.Agents.*` → 12 端点(list / call / execute / executeStream / task / session / pipeline / parallel / decompose)
- `client.Audio.*` → 8 端点(voices / speech / transcriptions / chat / speakers / register / compare / music)
- `client.Images.*` → 6 端点(generations / edits / inpaint / styleTransfer / virtualTryOn / background)
- `client.Videos.*` → 3 端点(generations / getTask / compose)
- `client.ThreeD.*` → 1 端点(generations)
- `client.Generation.*` → 3 端点(enqueue / getStatus / cancel)
- `client.Knowledge.*` → 13 端点(health / documents / ingest / search / rag / graph)
- `client.Tools.*` → 16 端点(list / call / resources / prompts / skills / slashCommands / personas / search / analyze / screenshot)
- `client.Memory.*` → 8 端点(save / recall / search / dream / forget / working / episodic / procedural)
- `client.Messages.*` → 4 端点(publish / subscribe / unsubscribe / status)
- `client.Files.*` → 9 端点(list / upload / get / delete / getContent / getVersions / uploadInit / uploadChunk / uploadComplete)
- `client.User.*` → 9 端点(me / projects / projectFiles / workflows / runWorkflow / runCozeWorkflow / runN8nWorkflow / usage / vendorUsage)

## 依赖

| 库 | 用途 |
|----|----|
| `System.Net.Http` | HTTP 客户端(`HttpClient` + `SocketsHttpHandler` + `MultipartFormDataContent`) |
| `System.Text.Json` | JSON 序列化 / 反序列化(`JsonSerializer` + `JsonDocument` + `JsonElement`) |
| `System.Threading` | 异步流(`IAsyncEnumerable` + `EnumeratorCancellation`) |

无任何 NuGet 外部依赖。

## 系统要求

- .NET 8.0 SDK 或更高
- C# 12 编译器(随 .NET 8 SDK 提供)

## 构建

```bash
cd packages/sdk/dotnet
dotnet build -c Release       # 编译
dotnet pack -c Release        # 打包(产出 bin/Release/Ihui.AI.0.1.0.nupkg)
dotnet test                   # 测试(待补充)
```

## 目录结构

```
packages/sdk/dotnet/
├── Ihui.AI.csproj            # 项目文件(net8.0 + MIT + README.md)
├── README.md                 # 本文档
├── .gitignore                # bin/obj/.vs/ 等
├── Client/                   # 客户端层(11 文件)
│   ├── SdkException.cs       # 异常基类 + SdkExceptionFactory
│   ├── AuthenticationException.cs
│   ├── PermissionException.cs
│   ├── NotFoundException.cs
│   ├── QuotaExceededException.cs
│   ├── ServerException.cs
│   ├── JsonUtil.cs           # JsonSerializerOptions 工具(CamelCase + WhenWritingNull)
│   ├── SdkConfig.cs          # 不可变配置 + Builder
│   ├── BaseClient.cs         # 底层 HTTP + 重试 + 流式 + multipart
│   ├── StreamResponse.cs     # SSE 解析静态工具(ParseSseAsync)
│   └── IhuiClient.cs         # 13 模块聚合 + Builder
├── Models/                   # 数据模型层(17 文件)
│   ├── ChatCompletionRequest.cs   # 含 record Message + Builder
│   ├── ChatCompletionResponse.cs  # 含 GetContent() 便捷方法
│   ├── EmbeddingsRequest.cs
│   ├── EmbeddingsResponse.cs
│   ├── ModelsResponse.cs         # 含 ModelInfo
│   ├── AgentExecuteRequest.cs    # Builder
│   ├── AgentExecuteResponse.cs
│   ├── AudioSpeechRequest.cs
│   ├── ImageGenerationsRequest.cs
│   ├── VideoGenerationsRequest.cs
│   ├── KnowledgeSearchRequest.cs
│   ├── MemorySearchRequest.cs
│   ├── ToolCallRequest.cs
│   ├── UploadInitRequest.cs
│   ├── WorkflowRequest.cs
│   ├── UsageResponse.cs
│   └── ApiResponse.cs            # 泛型 ApiResponse<T>
└── Modules/                  # 业务模块层(13 文件 / 105 端点)
    ├── AiApi.cs              # 13
    ├── AgentsApi.cs          # 12
    ├── AudioApi.cs           # 8
    ├── ImagesApi.cs          # 6
    ├── VideosApi.cs          # 3
    ├── ThreeDApi.cs          # 1
    ├── GenerationApi.cs      # 3
    ├── KnowledgeApi.cs       # 13
    ├── ToolsApi.cs           # 16
    ├── MemoryApi.cs          # 8
    ├── MessagesApi.cs        # 4
    ├── FilesApi.cs           # 9
    └── UserApi.cs            # 9
```

## 许可

MIT,跟随 IHUI-AI 主仓库许可。
