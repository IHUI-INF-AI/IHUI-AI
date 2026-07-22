# ihui-ai-go

IHUI-AI 平台官方 Go SDK,封装 106 个 `/v1/*` 对外开放 API 端点,让 Go 开发者通过 API Key 一行代码接入平台所有 AI 功能。

## 特性

- **零依赖**:纯 Go 标准库实现(`net/http` + `encoding/json`),无第三方依赖
- **106 端点**:13 个功能模块完整覆盖 AI 核心 / 多模态 / 知识库 / 工具 / 记忆 / 文件 / 用户
- **强类型**:所有请求 / 响应均为强类型 struct,字段命名严格遵循 camelCase(与 `/v1/*` 契约一致)
- **流式响应**:`ChatCompletionsStream` 与 `AgentExecuteStream` 返回 `<-chan map[string]any`,支持 SSE 协议
- **重试机制**:网络错误 + 5xx 自动重试(指数退避 500ms / 1000ms),429 不重试
- **错误层级**:`AuthenticationError` / `PermissionError` / `NotFoundError` / `QuotaExceededError` / `ServerError`
- **Context 支持**:所有方法第一个参数为 `context.Context`,支持超时与取消
- **Go 1.21+**:使用 `any`、slog 等现代特性

## 安装

本 SDK 位于 monorepo 内(`packages/sdk/go`),通过 Go module 直接引用:

```bash
go get github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go
```

或在 `go.mod` 中添加:

```
require github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go v0.0.0
```

## 快速开始

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go"
    "github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

func main() {
    ctx := context.Background()

    client := ihui.NewIhuiClient(
        ihui.WithAPIKey("ihui_xxx"),
        ihui.WithBaseURL("http://localhost:8802"),
    )

    resp, err := client.AI.Completions(ctx, &model.ChatCompletionRequest{
        Model:    "gpt-4o",
        Messages: []model.Message{{Role: "user", Content: "你好"}},
    })
    if err != nil {
        log.Fatalf("请求失败: %v", err)
    }
    fmt.Println(resp.Choices[0].Message.Content)
}
```

## 配置选项

所有配置通过函数式选项(`Option`)传入 `NewIhuiClient`:

| 选项                 | 默认值                   | 说明                                           |
| -------------------- | ------------------------ | ---------------------------------------------- |
| `WithAPIKey`         | (必需)                  | API Key,格式 `ihui_xxx`                        |
| `WithSecret`         | (空)                    | 可选 API Secret(创建 / 轮换时返回)            |
| `WithBaseURL`        | `http://localhost:8802`  | 平台基础 URL                                   |
| `WithTimeout`        | `30s`                    | 请求超时;流式请求不受此限制                    |
| `WithMaxRetries`     | `2`                      | 最大重试次数(网络错误 + 5xx 重试,429 不重试) |
| `WithHTTPClient`     | 默认 `http.Client`       | 自定义 `*http.Client`(测试 / 拦截用)          |

```go
client := ihui.NewIhuiClient(
    ihui.WithAPIKey("ihui_xxx"),
    ihui.WithSecret("sec_xxx"),
    ihui.WithBaseURL("https://api.ihui.ai"),
    ihui.WithTimeout(60*time.Second),
    ihui.WithMaxRetries(3),
)
```

## 13 个功能模块

| 模块         | 字段         | 端点数 | 说明                                          |
| ------------ | ------------ | ------ | --------------------------------------------- |
| AI 核心      | `AI`         | 13     | chat / embeddings / vision / moa / models     |
| Agents       | `Agents`     | 12     | 列表 / 调用 / 高级执行 / Pipeline / 并行 / 分解 |
| Audio        | `Audio`      | 8      | TTS / ASR / 语音对话 / 声纹 / 音乐             |
| Images       | `Images`     | 6      | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| Videos       | `Videos`     | 3      | 生成 / 任务查询 / 编排                         |
| 3D           | `ThreeD`     | 1      | 3D 模型生成                                   |
| Generation   | `Generation` | 3      | 生成队列:入队 / 状态 / 取消                   |
| Knowledge    | `Knowledge`  | 13     | 文档 / 搜索 / RAG / 知识图谱                   |
| Tools        | `Tools`      | 16     | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图       |
| Memory       | `Memory`     | 8      | 保存 / 召回 / 搜索 / Dream / 分类记忆          |
| Messages     | `Messages`   | 4      | 发布 / 订阅 / 状态                            |
| Files        | `Files`      | 9      | 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片 |
| User         | `User`       | 9      | 用户 / 项目 / 工作流 / 用量统计                |
| **合计**     |              | **106**|                                               |

## 模块调用示例

### AI 核心

```go
// 非流式对话
resp, _ := client.AI.Completions(ctx, &model.ChatCompletionRequest{
    Model:    "gpt-4o",
    Messages: []model.Message{{Role: "user", Content: "你好"}},
})

// 文本向量化
emb, _ := client.AI.Embeddings(ctx, &model.EmbeddingsRequest{
    Model: "text-embedding-3-small",
    Input: "Hello world",
})

// 视觉理解
vis, _ := client.AI.ChatVision(ctx, &model.ChatVisionRequest{
    Model:  "gpt-4o",
    Image:  "data:image/png;base64,iVBOR...",
    Prompt: "描述这张图片",
})

// 模型列表
models, _ := client.AI.ListModels(ctx)

// 用户自定义模型
client.AI.CreateUserModel(ctx, &model.CreateUserModelRequest{
    Name:     "my-gpt",
    Provider: "openai",
    Model:    "gpt-4o",
    APIKey:   "sk-xxx",
})
```

### 流式响应(Chat Completions Stream)

```go
stream, err := client.AI.CompletionsStream(ctx, &model.ChatCompletionRequest{
    Model:    "gpt-4o",
    Messages: []model.Message{{Role: "user", Content: "讲个故事"}},
})
if err != nil {
    log.Fatal(err)
}

for chunk := range stream {
    // chunk 是 map[string]any,包含 OpenAI 兼容的 delta 数据
    // chunk["choices"] 是 []any,每个元素含 delta.content
    if choices, ok := chunk["choices"].([]any); ok && len(choices) > 0 {
        if choice, ok := choices[0].(map[string]any); ok {
            if delta, ok := choice["delta"].(map[string]any); ok {
                if content, ok := delta["content"].(string); ok {
                    fmt.Print(content)
                }
            }
        }
    }
}
fmt.Println() // 流结束
```

### Agent 流式执行

```go
stream, err := client.Agents.ExecuteStream(ctx, &model.AgentExecuteRequest{
    AgentID: "agent-001",
    Input:   "帮我分析这份报告",
})
if err != nil {
    log.Fatal(err)
}
for event := range stream {
    fmt.Printf("事件: %v\n", event)
}
```

### 知识库

```go
// 文档入库
doc, _ := client.Knowledge.IngestDocument(ctx, &model.IngestDocumentRequest{
    Title:   "Go 语言入门",
    Content: "Go 是一门编译型语言...",
})

// 语义搜索
results, _ := client.Knowledge.Search(ctx, &model.KnowledgeSearchRequest{
    Query:    "Go 语言特点",
    TopK:     5,
    Threshold: 0.7,
})

// RAG 上下文
ragCtx, _ := client.Knowledge.RagContext(ctx, &model.RagContextRequest{
    Query:              "Go 语言的并发模型",
    InjectSystemPrompt: true,
})
```

### 文件上传(multipart)

```go
// 简单上传
file, _ := os.Open("photo.png")
defer file.Close()
info, err := client.Files.Upload(ctx, "photo.png", file)
if err != nil {
    log.Fatal(err)
}
fmt.Printf("上传成功: %s, 大小: %d bytes\n", info.Filename, info.Bytes)
```

```go
// 分片上传(适合大文件)
init, _ := client.Files.UploadInit(ctx, &model.UploadInitRequest{
    Filename:  "large-video.mp4",
    Size:      1024 * 1024 * 100, // 100MB
    MimeType:  "video/mp4",
    ChunkSize: 5 * 1024 * 1024,   // 5MB per chunk
})

for i := 0; i < init.ChunkCount; i++ {
    chunk := readChunk(i) // 读取第 i 个分片并 base64 编码
    client.Files.UploadChunk(ctx, &model.UploadChunkRequest{
        UploadID: init.UploadID,
        Index:    i,
        Chunk:    chunk,
    })
}

complete, _ := client.Files.UploadComplete(ctx, &model.UploadCompleteRequest{
    UploadID: init.UploadID,
})
fmt.Printf("文件 ID: %s\n", complete.FileID)
```

### 文件内容下载

```go
content, err := client.Files.GetContent(ctx, "file-xxx")
if err != nil {
    log.Fatal(err)
}
os.WriteFile("downloaded.bin", content, 0644)
```

## 错误处理

SDK 错误按 HTTP 状态码自动分类,可用 `errors.As` 判断具体类型:

```go
resp, err := client.AI.Completions(ctx, req)
if err != nil {
    var authErr *client.AuthenticationError // 401
    if errors.As(err, &authErr) {
        fmt.Println("API Key 无效或已过期")
    }

    var permErr *client.PermissionError // 403
    if errors.As(err, &permErr) {
        fmt.Println("权限不足")
    }

    var notFoundErr *client.NotFoundError // 404
    if errors.As(err, &notFoundErr) {
        fmt.Println("资源不存在")
    }

    var quotaErr *client.QuotaExceededError // 429
    if errors.As(err, &quotaErr) {
        fmt.Println("配额超限,请稍后重试")
    }

    var serverErr *client.ServerError // 5xx
    if errors.As(err, &serverErr) {
        fmt.Printf("服务端错误: %d\n", serverErr.Status)
    }

    // 通用错误(网络错误等)
    var sdkErr *client.SdkError
    if errors.As(err, &sdkErr) {
        fmt.Printf("status=%d code=%s\n", sdkErr.Status, sdkErr.Code)
    }
}
```

错误类型层级:

```
SdkError                // 基类
├── AuthenticationError // 401 未授权
├── PermissionError     // 403 禁止访问
├── NotFoundError       // 404 资源不存在
├── QuotaExceededError  // 429 配额超限
└── ServerError         // 5xx 服务端错误
```

每个错误都携带:
- `Status`:HTTP 状态码(网络错误为 0)
- `Code`:错误码字符串(如 `auth_invalid_api_key`)
- `Details`:错误详情(通常包含 `message` 字段)

## Context 超时与取消

所有方法第一个参数为 `context.Context`,支持超时与取消:

```go
// 5 秒超时
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

resp, err := client.AI.Completions(ctx, req)
if err != nil {
    if errors.Is(err, context.DeadlineExceeded) {
        fmt.Println("请求超时")
    }
}

// 手动取消
ctx, cancel := context.WithCancel(context.Background())
go func() {
    time.Sleep(1 * time.Second)
    cancel() // 用户主动取消
}()
stream, _ := client.AI.CompletionsStream(ctx, req)
for chunk := range stream {
    fmt.Print(chunk)
    if ctx.Err() != nil {
        break
    }
}
```

## 鉴权

SDK 自动注入鉴权头:

```
Authorization: Bearer ${apiKey}
X-Api-Secret: ${secret}  (可选)
```

API Key 在 IHUI-AI 平台控制台创建,格式为 `ihui_xxx`。Secret 仅在创建 / 轮换时返回,请妥善保存。

## 项目结构

```
packages/sdk/go/
├── go.mod                      # 模块声明(零依赖)
├── ihui.go                     # IhuiClient 主入口 + Option 模式
├── README.md                   # 本文档
├── internal/
│   ├── client/                 # 核心 HTTP 客户端
│   │   ├── client.go           # BaseClient + Config + 重试 + 超时 + 鉴权
│   │   ├── errors.go           # SdkError + 5 个子类 + NewErrorFromStatus
│   │   └── streaming.go        # SSE 流式响应解析器(StreamSSE)
│   ├── model/                  # 17 个数据模型文件(强类型 struct)
│   │   ├── chat.go             # ChatCompletionRequest/Response + Message
│   │   ├── embeddings.go       # EmbeddingsRequest/Response
│   │   ├── models.go           # ModelsResponse + ModelInfo + VendorModels
│   │   ├── user_model.go       # UserModelConfig + CreateUserModelRequest
│   │   ├── moa.go              # MoaPresetsResponse + CreateMoaPresetRequest
│   │   ├── agents.go           # AgentExecuteRequest/Response + Pipeline/Parallel
│   │   ├── audio.go            # AudioSpeechRequest/Response + ASR + 声纹 + 音乐
│   │   ├── images.go           # ImageGenerationsRequest/Response + 6 个图像端点
│   │   ├── videos.go           # VideoGenerationsRequest/Response + Compose
│   │   ├── threed.go           # ThreeDGenerationsRequest/Response
│   │   ├── generation.go       # GenerationEnqueueRequest/Response + Status
│   │   ├── knowledge.go        # Knowledge 文档 + 搜索 + RAG + 知识图谱
│   │   ├── tools.go            # MCP 工具 + 技能 + 人格 + 代码搜索 + 截图
│   │   ├── memory.go           # Memory 保存 + 召回 + 搜索 + Dream + 分类
│   │   ├── messages.go         # Message 发布 + 订阅 + 状态
│   │   ├── files.go            # File 列表 + 上传 + 详情 + 版本 + 分片
│   │   └── user.go             # User + Projects + Workflows + Usage
│   └── module/                 # 13 个业务模块(106 端点)
│       ├── ai.go               # AiApi(14 端点)
│       ├── agents.go           # AgentsApi(12 端点)
│       ├── audio.go            # AudioApi(8 端点)
│       ├── images.go           # ImagesApi(6 端点)
│       ├── videos.go           # VideosApi(3 端点)
│       ├── threed.go           # ThreeDApi(1 端点)
│       ├── generation.go       # GenerationApi(3 端点)
│       ├── knowledge.go        # KnowledgeApi(13 端点)
│       ├── tools.go            # ToolsApi(16 端点)
│       ├── memory.go           # MemoryApi(8 端点)
│       ├── messages.go         # MessagesApi(4 端点)
│       ├── files.go            # FilesApi(9 端点)
│       └── user.go             # UserApi(9 端点)
```

## 与其他 SDK 对比

| 特性         | Go SDK         | TypeScript SDK | Java SDK        | Python SDK      |
| ------------ | -------------- | -------------- | --------------- | --------------- |
| 依赖         | 零依赖(标准库) | fetch          | OkHttp + Jackson | httpx           |
| 端点数       | 106            | 106            | 106             | 106             |
| 模块数       | 13             | 13             | 13              | 13              |
| 流式响应     | `<-chan map`   | AsyncGenerator | Iterator        | async generator |
| 同步 / 异步  | 同步(Context) | 异步           | 同步            | sync + async    |
| 重试机制     | 500ms / 1000ms | 500ms / 1000ms | 500ms / 1000ms  | 500ms / 1000ms  |
| 错误层级     | 5 子类         | SdkError       | 5 子类          | 5 子类          |

## 许可证

随 IHUI-AI 主仓库分发。
