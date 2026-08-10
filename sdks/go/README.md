# ihui-go

IHUI-AI 平台官方 Go SDK，封装全部 `/v1/*` 对外开放 API 端点。

## 安装

```bash
go get github.com/IHUI-INF-AI/IHUI-AI/sdks/go
```

## 快速开始

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/IHUI-INF-AI/IHUI-AI/sdks/go/ihui"
)

func main() {
    client := ihui.NewIhuiClient(
        ihui.WithAPIKey("your-api-key"),
        ihui.WithBaseURL("http://localhost:8802"),
    )

    resp, err := client.AI.Completions(context.Background(), &ihui.ChatCompletionRequest{
        Model: "gpt-4o",
        Messages: []ihui.Message{
            {Role: "user", Content: "你好"},
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(resp.Choices[0].Message.Content)
}
```

## 客户端配置

```go
// 函数式选项模式
client := ihui.NewIhuiClient(
    ihui.WithAPIKey("ihui_xxx"),          // API Key（必需）
    ihui.WithSecret("optional-secret"),    // API Secret（可选）
    ihui.WithBaseURL("http://localhost:8802"), // 基础 URL，默认 http://localhost:8802
    ihui.WithTimeout(30*time.Second),      // 请求超时，默认 30s
    ihui.WithMaxRetries(2),                // 最大重试次数，默认 2
    ihui.WithHTTPClient(customHTTPClient), // 自定义 HTTP 客户端
)
```

## 功能模块

SDK 通过 `IhuiClient` 聚合 13 个功能模块，覆盖 IHUI-AI 平台全部 API：

### AI 核心（`client.AI`）

| 方法                        | 端点                                      | 说明               |
| --------------------------- | ----------------------------------------- | ------------------ |
| `Completions`               | `POST /v1/chat/completions`               | 非流式对话         |
| `CompletionsStream`         | `POST /v1/chat/completions (stream:true)` | 流式对话（SSE）    |
| `Embeddings`                | `POST /v1/embeddings`                     | 文本向量化         |
| `ChatVision`                | `POST /v1/chat/vision`                   | 视觉理解           |
| `ChatMoa`                   | `POST /v1/chat/moa`                      | Mixture of Agents  |
| `ListModels`                | `GET /v1/models`                         | 模型列表           |
| `GetModel`                  | `GET /v1/models/:id`                     | 模型详情           |
| `ListVendorModels`          | `GET /v1/vendors/:vendor/models`         | 厂商模型列表       |
| `ListMoaPresets`            | `GET /v1/moa-presets`                    | MoA 预设列表       |
| `CreateMoaPreset`           | `POST /v1/moa-presets`                   | 创建 MoA 预设      |
| `ListUserModels`            | `GET /v1/user/models`                    | 用户自定义模型列表 |
| `CreateUserModel`           | `POST /v1/user/models`                   | 创建用户自定义模型 |
| `UpdateUserModel`           | `PUT /v1/user/models/:id`                | 更新用户自定义模型 |
| `DeleteUserModel`           | `DELETE /v1/user/models/:id`             | 删除用户自定义模型 |

### Agents（`client.Agents`）

| 方法             | 端点                                       | 说明               |
| ---------------- | ------------------------------------------ | ------------------ |
| `List`           | `GET /v1/agents`                          | Agent 列表         |
| `Get`            | `GET /v1/agents/:id`                      | Agent 详情         |
| `Call`           | `POST /v1/agents/:id/call`                | 调用 Agent         |
| `Execute`        | `POST /v1/agents/execute`                 | 高级执行           |
| `ExecuteStream`  | `POST /v1/agents/execute/stream`          | 流式执行（SSE）    |
| `GetTaskStatus`  | `GET /v1/agents/tasks/:id/status`         | 任务状态           |
| `CancelTask`     | `POST /v1/agents/tasks/:id/cancel`        | 取消任务           |
| `ListSessions`   | `GET /v1/agents/sessions`                 | 会话列表           |
| `DeleteSession`  | `DELETE /v1/agents/sessions/:id`          | 删除会话           |
| `Pipeline`       | `POST /v1/agents/pipeline`                | Pipeline 编排      |
| `Parallel`       | `POST /v1/agents/parallel`                | 并行执行           |
| `Decompose`      | `POST /v1/agents/decompose`               | 任务分解           |

### Audio（`client.Audio`）

| 方法              | 端点                                    | 说明               |
| ----------------- | --------------------------------------- | ------------------ |
| `ListVoices`      | `GET /v1/audio/voices`                 | 音色列表           |
| `Speech`          | `POST /v1/audio/speech`                | 文字转语音（TTS）  |
| `Transcriptions`  | `POST /v1/audio/transcriptions`        | 语音转文字（ASR）  |
| `Chat`            | `POST /v1/audio/chat`                  | 语音对话           |
| `ListSpeakers`    | `GET /v1/audio/speakers`               | 声纹列表           |
| `RegisterSpeaker` | `POST /v1/audio/speakers`              | 声纹注册           |
| `CompareSpeakers` | `POST /v1/audio/speakers/compare`      | 声纹比对           |
| `Music`           | `POST /v1/audio/music`                 | 音乐生成           |

### Images（`client.Images`）

| 方法           | 端点                                    | 说明               |
| -------------- | --------------------------------------- | ------------------ |
| `Generations`  | `POST /v1/images/generations`           | 文生图             |
| `Edits`        | `POST /v1/images/edits`                 | 图片编辑           |
| `Inpaint`      | `POST /v1/images/inpaint`               | 图片修复           |
| `StyleTransfer`| `POST /v1/images/style-transfer`        | 风格迁移           |
| `VirtualTryOn` | `POST /v1/images/virtual-try-on`        | 虚拟试穿           |
| `Background`   | `POST /v1/images/background`            | 背景生成           |

### Videos（`client.Videos`）

| 方法         | 端点                              | 说明               |
| ------------ | --------------------------------- | ------------------ |
| `Generations`| `POST /v1/videos/generations`     | 视频生成（异步）   |
| `GetTask`    | `GET /v1/videos/tasks/:id`        | 查询视频任务状态   |
| `Compose`    | `POST /v1/videos/compose`         | 视频编排           |

### 3D（`client.ThreeD`）

| 方法         | 端点                          | 说明               |
| ------------ | ----------------------------- | ------------------ |
| `Generations`| `POST /v1/3d/generations`     | 3D 模型生成        |

### Generation 队列（`client.Generation`）

| 方法       | 端点                                    | 说明               |
| ---------- | --------------------------------------- | ------------------ |
| `Enqueue`  | `POST /v1/generation/enqueue`           | 入队生成任务       |
| `GetStatus`| `GET /v1/generation/status/:id`         | 查询生成状态       |
| `Cancel`   | `POST /v1/generation/cancel/:id`        | 取消生成任务       |

### Knowledge（`client.Knowledge`）

| 方法                 | 端点                                              | 说明                   |
| -------------------- | ------------------------------------------------- | ---------------------- |
| `Health`             | `GET /v1/knowledge/health`                       | 健康检查               |
| `ListDocuments`      | `GET /v1/knowledge/documents`                    | 文档列表               |
| `IngestDocument`     | `POST /v1/knowledge/documents`                   | 文档入库               |
| `GetDocument`        | `GET /v1/knowledge/documents/:id`                | 文档详情               |
| `GetDocumentChunks`  | `GET /v1/knowledge/documents/:id/chunks`         | 文档分块               |
| `DeleteDocument`     | `DELETE /v1/knowledge/documents/:id`             | 删除文档               |
| `BatchDeleteDocuments`| `POST /v1/knowledge/documents/batch-delete`      | 批量删除               |
| `Search`             | `POST /v1/knowledge/search`                      | 语义搜索               |
| `RagContext`         | `POST /v1/knowledge/rag-context`                 | RAG 上下文检索         |
| `ExtractGraph`       | `POST /v1/knowledge-graph/extract`               | 知识图谱抽取           |
| `BuildGraph`         | `POST /v1/knowledge-graph/build`                 | 知识图谱构建           |
| `GetGraphData`       | `GET /v1/knowledge-graph/data`                   | 知识图谱数据           |
| `ClearGraph`         | `DELETE /v1/knowledge-graph/data`                | 清空知识图谱           |

### Tools / MCP（`client.Tools`）

| 方法               | 端点                                    | 说明               |
| ------------------ | --------------------------------------- | ------------------ |
| `List`             | `GET /v1/tools`                        | MCP 工具列表       |
| `Call`             | `POST /v1/tools/call`                  | 调用 MCP 工具      |
| `ListResources`    | `GET /v1/resources`                    | MCP 资源列表       |
| `GetResource`      | `GET /v1/resources/:uri`               | 资源详情           |
| `ListPrompts`      | `GET /v1/prompts`                      | MCP 提示词列表     |
| `InvokePrompt`     | `POST /v1/prompts/invoke`              | 调用提示词         |
| `ListSkills`       | `GET /v1/skills`                       | 技能列表           |
| `ListSlashCommands`| `GET /v1/slash-commands`              | Slash 命令列表     |
| `InvokeSlashCommand`| `POST /v1/slash-commands`            | 调用 Slash 命令    |
| `Sampling`         | `POST /v1/sampling`                    | 模型采样           |
| `ListPersonas`     | `GET /v1/personas`                     | 人格列表           |
| `GetPersona`       | `GET /v1/personas/:name`               | 人格详情           |
| `SearchCodebase`   | `POST /v1/tools/search-codebase`       | 代码库搜索         |
| `SearchWeb`        | `POST /v1/tools/search-web`           | 网页搜索           |
| `AnalyzeCode`      | `POST /v1/tools/analyze-code`          | 代码分析           |
| `Screenshot`       | `POST /v1/screenshot`                  | 网页截图           |

### Memory（`client.Memory`）

| 方法        | 端点                              | 说明               |
| ----------- | --------------------------------- | ------------------ |
| `Save`      | `POST /v1/memory`                | 保存记忆           |
| `Recall`    | `GET /v1/memory`                 | 召回记忆           |
| `Search`    | `POST /v1/memory/search`         | 语义搜索           |
| `Dream`     | `POST /v1/memory/dream`          | Dream 梦境系统     |
| `Forget`    | `DELETE /v1/memory`              | 遗忘记忆           |
| `Working`   | `GET /v1/memory/working`         | 工作记忆           |
| `Episodic`  | `GET /v1/memory/episodic`        | 情景记忆           |
| `Procedural`| `GET /v1/memory/procedural`      | 程序记忆           |

### Messages（`client.Messages`）

| 方法         | 端点                                      | 说明               |
| ------------ | ----------------------------------------- | ------------------ |
| `Publish`    | `POST /v1/messages`                      | 发布消息           |
| `Subscribe`  | `POST /v1/messages/subscribe`            | 订阅频道           |
| `Unsubscribe`| `DELETE /v1/messages/subscribe/:id`      | 取消订阅           |
| `GetStatus`  | `GET /v1/messages/:id/status`            | 消息状态           |

### Files（`client.Files`）

| 方法            | 端点                                    | 说明               |
| --------------- | --------------------------------------- | ------------------ |
| `List`          | `GET /v1/files`                        | 文件列表           |
| `Upload`        | `POST /v1/files`                       | 上传文件           |
| `Get`           | `GET /v1/files/:id`                    | 文件详情           |
| `Delete`        | `DELETE /v1/files/:id`                 | 删除文件           |
| `GetContent`    | `GET /v1/files/:id/content`            | 文件内容           |
| `GetVersions`   | `GET /v1/files/:id/versions`           | 文件版本列表       |
| `UploadInit`    | `POST /v1/files/upload-init`           | 分片上传初始化     |
| `UploadChunk`   | `POST /v1/files/upload-chunk`          | 上传分片           |
| `UploadComplete`| `POST /v1/files/complete`              | 完成分片上传       |

### User（`client.User`）

| 方法              | 端点                                    | 说明               |
| ----------------- | --------------------------------------- | ------------------ |
| `Me`              | `GET /v1/me`                           | 当前用户信息+配额  |
| `ListProjects`    | `GET /v1/projects`                     | 项目列表           |
| `ListProjectFiles`| `GET /v1/projects/:id/files`           | 项目文件列表       |
| `GetWorkflow`     | `GET /v1/workflows/:id`                | 工作流详情         |
| `RunWorkflow`     | `POST /v1/workflows/instances`         | 运行工作流         |
| `RunCozeWorkflow` | `POST /v1/workflows/coze/run`          | Coze 工作流        |
| `RunN8nWorkflow`  | `POST /v1/workflows/n8n/run`           | n8n 工作流         |
| `GetUsage`        | `GET /v1/usage`                        | 用量统计           |
| `GetVendorUsage`  | `GET /v1/usage/:vendor`                | 厂商用量           |

## 流式响应

```go
stream, err := client.AI.CompletionsStream(context.Background(), &ihui.ChatCompletionRequest{
    Model:    "gpt-4o",
    Messages: []ihui.Message{{Role: "user", Content: "讲个故事"}},
})
if err != nil {
    log.Fatal(err)
}
for chunk := range stream {
    // chunk 是 map[string]any，包含 SSE 数据
    if content, ok := chunk["choices"]; ok {
        fmt.Printf("%v\n", content)
    }
}
```

## 错误处理

```go
resp, err := client.AI.Completions(ctx, req)
if err != nil {
    var authErr *ihui.AuthenticationError
    if errors.As(err, &authErr) {
        // 处理 401 认证错误
    }
    var notFound *ihui.NotFoundError
    if errors.As(err, &notFound) {
        // 处理 404 错误
    }
    var quotaErr *ihui.QuotaExceededError
    if errors.As(err, &quotaErr) {
        // 处理 429 配额超限
    }
    var serverErr *ihui.ServerError
    if errors.As(err, &serverErr) {
        // 处理 5xx 服务端错误
    }
    // 其他错误（含网络错误）
    fmt.Printf("SDK error: %v\n", err)
}
```

错误类型：

| 类型                   | 状态码 | 说明             |
| ---------------------- | ------ | ---------------- |
| `AuthenticationError`  | 401    | 认证失败         |
| `PermissionError`      | 403    | 权限不足         |
| `NotFoundError`        | 404    | 资源不存在       |
| `QuotaExceededError`   | 429    | 配额超限         |
| `ServerError`          | 5xx    | 服务端错误       |
| `SdkError`（基类）      | 其他   | 通用错误/网络错误 |

## 重试机制

- 网络错误（连接超时、DNS 解析失败等）自动重试
- 5xx 服务端错误自动重试
- 429 和 4xx 错误不重试
- 默认最多重试 2 次，退避间隔 500ms → 1000ms
- 流式请求不重试

## 文件上传

```go
file, err := os.Open("document.pdf")
if err != nil {
    log.Fatal(err)
}
defer file.Close()

info, err := client.Files.Upload(context.Background(), "document.pdf", file)
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Uploaded file: %s (%d bytes)\n", info.ID, info.Bytes)
```

## 包结构

```
sdks/go/
├── go.mod              # 模块定义
├── README.md           # 本文档
└── ihui/               # SDK 包
    ├── client.go       # 客户端配置 + BaseClient + IhuiClient
    ├── errors.go       # 错误类型定义
    ├── streaming.go    # SSE 流式解析
    ├── models.go       # 所有 API 请求/响应数据结构
    ├── ai.go           # AI 核心模块
    ├── agents.go       # Agent 模块
    ├── audio.go        # 音频模块
    ├── images.go       # 图像模块
    ├── videos.go       # 视频模块
    ├── threed.go       # 3D 模块
    ├── generation.go   # 生成队列模块
    ├── knowledge.go    # 知识库模块
    ├── tools.go        # Tools/MCP 模块
    ├── memory.go       # 记忆模块
    ├── messages.go     # 消息模块
    ├── files.go        # 文件模块
    └── user.go         # 用户模块
```