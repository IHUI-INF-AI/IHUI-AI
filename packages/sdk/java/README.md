# IHUI AI Java SDK

IHUI-AI 平台官方 Java SDK,完整封装 105 个 `/v1/*` 对外开放 API 端点,涵盖 13 个业务模块,让 Java 开发者通过 API Key 一行代码接入平台所有 AI 功能。

## 特性

- **105 端点全覆盖**:13 模块 / 105 个 `/v1/*` 端点完整封装
- **强类型 POJO**:核心请求/响应使用 POJO,其他端点使用 Jackson `JsonNode` 强类型 JSON 树
- **流式响应**:`StreamResponse` 实现 `Iterator<JsonNode>` + `AutoCloseable`,支持 try-with-resources
- **重试机制**:网络错误 + 5xx 自动重试 2 次(指数退避 500ms / 1000ms),429 不重试
- **错误层级**:统一异常层级(`SdkException` / `AuthenticationException` / `PermissionException` / `NotFoundException` / `QuotaExceededException` / `ServerException`)
- **依赖最小**:仅 OkHttp 4.12 + Jackson 2.16 + SLF4J 1.7,无 Spring / Guava
- **Java 11+**:使用 `var` / `Duration` / `StandardCharsets` 等现代特性

## 安装

### Maven

```xml
<dependency>
    <groupId>com.ihui</groupId>
    <artifactId>ihui-ai-java</artifactId>
    <version>0.1.0</version>
</dependency>
```

### Gradle

```groovy
implementation 'com.ihui:ihui-ai-java:0.1.0'
```

## 快速开始

```java
import com.ihui.ai.sdk.IhuiClient;
import com.ihui.ai.sdk.model.ChatCompletionRequest;
import com.ihui.ai.sdk.model.ChatCompletionResponse;

IhuiClient client = IhuiClient.builder()
    .apiKey("ihui_xxx")
    .baseUrl("http://localhost:8802")
    .build();

ChatCompletionResponse resp = client.ai.completions(
    ChatCompletionRequest.builder()
        .model("gpt-4o")
        .addMessage("user", "你好")
        .build()
);
System.out.println(resp.getContent());
```

## 13 个业务模块

| 模块字段 | 类 | 端点数 | 说明 |
|---------|----|----|----|
| `client.ai` | `AiApi` | 13 | chat / embeddings / vision / moa / models / userModels |
| `client.agents` | `AgentsApi` | 12 | Agent 列表 / 调用 / 高级执行 / Pipeline / 并行 |
| `client.audio` | `AudioApi` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| `client.images` | `ImagesApi` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| `client.videos` | `VideosApi` | 3 | 视频生成 / 任务查询 / 编排 |
| `client.threed` | `ThreeDApi` | 1 | 3D 模型生成 |
| `client.generation` | `GenerationApi` | 3 | 生成队列:入队 / 状态 / 取消 |
| `client.knowledge` | `KnowledgeApi` | 13 | 知识库 / RAG / 知识图谱 |
| `client.tools` | `ToolsApi` | 16 | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图 |
| `client.memory` | `MemoryApi` | 8 | 记忆:保存 / 召回 / 搜索 / Dream / 分类记忆 |
| `client.messages` | `MessagesApi` | 4 | 消息:发布 / 订阅 / 状态 |
| `client.files` | `FilesApi` | 9 | 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传 |
| `client.user` | `UserApi` | 9 | 用户 / 工作区 / 工作流 / 统计 |

## 配置选项

```java
IhuiClient client = IhuiClient.builder()
    .apiKey("ihui_xxx")                              // 必需,API Key
    .secret("optional-api-secret")                  // 可选,API Secret
    .baseUrl("https://api.ihui.example.com")        // 默认 http://localhost:8802
    .timeout(Duration.ofSeconds(60))                // 默认 30s
    .maxRetries(3)                                   // 默认 2
    .build();
```

## 流式响应(try-with-resources)

```java
import com.ihui.ai.sdk.StreamResponse;
import com.fasterxml.jackson.databind.JsonNode;

ChatCompletionRequest req = ChatCompletionRequest.builder()
    .model("gpt-4o")
    .addMessage("user", "讲一个故事")
    .build();

try (StreamResponse stream = client.ai.completionsStream(req)) {
    while (stream.hasNext()) {
        JsonNode chunk = stream.next();
        String delta = chunk.path("choices").path(0)
                .path("delta").path("content").asText("");
        System.out.print(delta);
    }
}
```

Agent 流式执行:

```java
try (StreamResponse stream = client.agents.executeStream(
        AgentExecuteRequest.builder().agentId("ag_xxx").input("分析代码").build())) {
    while (stream.hasNext()) {
        JsonNode event = stream.next();
        System.out.println(event);
    }
}
```

## 错误处理

```java
import com.ihui.ai.sdk.*;

try {
    ChatCompletionResponse resp = client.ai.completions(req);
} catch (AuthenticationException e) {
    // 401 — API Key 无效
    System.err.println("认证失败:" + e.getMessage());
} catch (PermissionException e) {
    // 403 — 权限不足
    System.err.println("无权限:" + e.getMessage());
} catch (NotFoundException e) {
    // 404 — 资源不存在(如模型 ID 错误)
    System.err.println("未找到:" + e.getMessage());
} catch (QuotaExceededException e) {
    // 429 — 配额超限
    System.err.println("超限:" + e.getMessage());
} catch (ServerException e) {
    // 5xx — 服务端错误
    System.err.println("服务器错误 [" + e.getStatus() + "]:" + e.getMessage());
} catch (SdkException e) {
    // 兜底:其他错误(含网络错误,status=0)
    System.err.println("SDK 错误 [" + e.getStatus() + "/" + e.getCode() + "]:" + e.getMessage());
}
```

所有异常都携带 `getStatus()`(HTTP 状态码)、`getCode()`(错误码)、`getDetails()`(详情)。

## 文件上传(multipart)

### 简单上传

```java
import java.io.File;

File file = new File("photo.png");
JsonNode result = client.files.upload(file);
String fileId = result.path("id").asText();
```

### 自定义文件名

```java
JsonNode result = client.files.upload(file, "renamed.png");
```

### 字节数组上传

```java
byte[] data = Files.readAllBytes(Path.of("doc.pdf"));
JsonNode result = client.files.upload(data, "doc.pdf", "application/pdf");
```

### 分片上传

```java
// 1. 初始化
UploadInitRequest initReq = new UploadInitRequest();
initReq.setFilename("large.zip");
initReq.setSize(123456789L);
initReq.setMimeType("application/zip");
initReq.setTotalChunks(120);
JsonNode initResp = client.files.uploadInit(initReq);
String uploadId = initResp.path("uploadId").asText();

// 2. 逐片上传
for (int i = 0; i < 120; i++) {
    byte[] chunk = readChunk(i);  // 自定义分片读取
    client.files.uploadChunk(uploadId, i, chunk);
}

// 3. 完成上传
JsonNode done = client.files.uploadComplete(
    Map.of("uploadId", uploadId)
);
String fileId = done.path("fileId").asText();
```

## 文件下载(二进制)

```java
byte[] content = client.files.getContent("file_xxx");
Files.write(Path.of("downloaded.bin"), content);
```

## 工作流调用

```java
import com.ihui.ai.sdk.model.WorkflowRequest;
import java.util.Map;

WorkflowRequest req = new WorkflowRequest();
req.setWorkflowId("wf_xxx");
req.setInput(Map.of("text", "处理这段文本"));

// 平台原生工作流
JsonNode result = client.user.runWorkflow(req);

// Coze 工作流
JsonNode cozeResult = client.user.runCozeWorkflow(req);

// n8n 工作流
JsonNode n8nResult = client.user.runN8nWorkflow(req);
```

## 异步调用

SDK 方法均为同步阻塞调用。如需异步,可用 `CompletableFuture` 包装:

```java
import java.util.concurrent.CompletableFuture;

CompletableFuture<ChatCompletionResponse> future = CompletableFuture.supplyAsync(() ->
    client.ai.completions(req)
);

future.thenAccept(resp -> {
    System.out.println("异步结果:" + resp.getContent());
}).exceptionally(ex -> {
    System.err.println("异步失败:" + ex.getCause().getMessage());
    return null;
});
```

## 鉴权说明

SDK 自动为每个请求注入以下 header:

- `Authorization: Bearer ${apiKey}`(必需)
- `X-Api-Secret: ${secret}`(可选,通过 `.secret("...")` 配置)
- `Content-Type: application/json`

后端鉴权链路:`Authorization: Bearer <API_KEY>` 或 `X-Api-Key: <API_KEY>`,可选 `X-Api-Secret: <SECRET>`。

## 端点列表(105 个)

完整端点列表见各模块类 Javadoc。模块字段对照:

- `client.ai.*` → 13 端点(chat / embeddings / vision / moa / models / userModels)
- `client.agents.*` → 12 端点
- `client.audio.*` → 8 端点
- `client.images.*` → 6 端点
- `client.videos.*` → 3 端点
- `client.threed.*` → 1 端点
- `client.generation.*` → 3 端点
- `client.knowledge.*` → 13 端点
- `client.tools.*` → 16 端点
- `client.memory.*` → 8 端点
- `client.messages.*` → 4 端点
- `client.files.*` → 9 端点
- `client.user.*` → 9 端点

## 依赖

| 库 | 版本 | 用途 |
|----|----|----|
| OkHttp | 4.12.0 | HTTP 客户端(支持流式 + multipart) |
| Jackson Databind | 2.16.1 | JSON 序列化反序列化 |
| SLF4J API | 1.7.36 | 日志门面 |

## 系统要求

- Java 11 或更高
- Maven 3.6+(构建用)

## 构建

```bash
cd packages/sdk/java
mvn compile      # 编译
mvn package      # 打包(产出 target/ihui-ai-java-0.1.0.jar)
mvn install      # 安装到本地 Maven 仓库
```

## 许可

跟随 IHUI-AI 主仓库许可。
