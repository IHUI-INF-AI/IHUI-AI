# IHUI AI Java SDK

IHUI-AI 平台官方 Java SDK,封装 105+ 个 /v1/* API 端点,涵盖 13 大模块。

## 安装

### Maven

```xml
<dependency>
    <groupId>com.ihui</groupId>
    <artifactId>ihui-ai-java</artifactId>
    <version>0.1.0</version>
</dependency>
```

### 要求

- JDK 17+
- Jackson 2.x（自动依赖）

## 快速开始

```java
import com.ihui.ai.sdk.IhuiClient;
import com.ihui.ai.sdk.model.ChatCompletionRequest;
import com.ihui.ai.sdk.model.ChatCompletionResponse;

// 使用 Builder 创建客户端
IhuiClient client = IhuiClient.builder()
    .apiKey("ihui_xxx")
    .baseUrl("http://localhost:8802")
    .build();

// Chat Completions（非流式）
ChatCompletionResponse resp = client.ai.completions(
    ChatCompletionRequest.builder()
        .model("gpt-4o")
        .addMessage("user", "你好")
        .build()
);
System.out.println(resp.getContent());

// 模型列表
ModelsResponse models = client.ai.listModels();
```

## 13 功能模块

| 模块 | 字段 | 端点数 | 描述 |
|------|------|--------|------|
| AI 核心 | `client.ai` | 13 | chat / embeddings / vision / moa / models / userModels |
| Agent | `client.agents` | 12 | 列表 / 调用 / 高级执行 / Pipeline / 并行 / 任务分解 |
| 音频 | `client.audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐生成 |
| 图像 | `client.images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| 视频 | `client.videos` | 3 | 生成 / 任务查询 / 编排 |
| 3D | `client.threed` | 1 | 3D 模型生成 |
| 生成队列 | `client.generation` | 3 | 入队 / 状态 / 取消 |
| 知识库 | `client.knowledge` | 13 | 文档 / 搜索 / RAG / 知识图谱 |
| 工具 | `client.tools` | 16 | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图 |
| 记忆 | `client.memory` | 8 | 保存 / 召回 / 搜索 / Dream / 分类记忆 |
| 消息 | `client.messages` | 4 | 发布 / 订阅 / 状态 |
| 文件 | `client.files` | 9 | 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传 |
| 用户 | `client.user` | 9 | 用户 / 工作区 / 工作流 / 统计 |

## 使用示例

### 流式 Chat Completions

```java
import com.fasterxml.jackson.databind.JsonNode;
import com.ihui.ai.sdk.StreamResponse;

ChatCompletionRequest req = ChatCompletionRequest.builder()
    .model("gpt-4o")
    .addMessage("user", "讲个故事")
    .stream(true)
    .build();

try (StreamResponse stream = client.ai.completionsStream(req)) {
    while (stream.hasNext()) {
        JsonNode chunk = stream.next();
        String delta = chunk.path("choices")
            .path(0).path("delta").path("content").asText("");
        System.out.print(delta);
    }
}
```

### Embeddings

```java
EmbeddingsResponse resp = client.ai.embeddings(
    new EmbeddingsRequest("text-embedding-3-small", "Hello world")
);
List<Double> vector = resp.getData().get(0).getEmbedding();
```

### 图像生成

```java
ImageGenerationsRequest req = new ImageGenerationsRequest();
req.setModel("dall-e-3");
req.setPrompt("A cute cat");
req.setN(1);
req.setSize("1024x1024");

JsonNode result = client.images.generations(req);
String imageUrl = result.path("data").path(0).path("url").asText();
```

### Agent 执行

```java
AgentExecuteResponse resp = client.agents.execute(
    AgentExecuteRequest.builder()
        .agentId("agent_xxx")
        .input("帮我总结这个文档")
        .build()
);
System.out.println(resp.getOutput());
```

### 文件上传

```java
// 上传字节数组
byte[] data = Files.readAllBytes(Paths.get("image.png"));
JsonNode result = client.files.upload(data, "image.png", "image/png");
String fileId = result.path("fileId").asText();

// 上传本地文件
JsonNode result2 = client.files.upload(Path.of("document.pdf"));
```

### 语义搜索

```java
KnowledgeSearchRequest req = new KnowledgeSearchRequest();
req.setQuery("AI 技术趋势");
req.setTopK(5);

JsonNode results = client.knowledge.search(req);
```

### 用量统计

```java
UsageResponse usage = client.user.getUsage();
System.out.println("总请求数: " + usage.getTotalRequests());
System.out.println("总 Token 数: " + usage.getTotalTokens());
```

## 错误处理

SDK 使用 `SdkException` 及其子类表示错误：

| 异常类 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `AuthenticationException` | 401 | API Key 无效或缺失 |
| `PermissionException` | 403 | API Key 权限不足 |
| `NotFoundException` | 404 | 资源不存在 |
| `QuotaExceededException` | 429 | 配额超限 |
| `ServerException` | 5xx | 服务端错误 |
| `SdkException` | 其他 | 基类 |

```java
try {
    ChatCompletionResponse resp = client.ai.completions(req);
} catch (AuthenticationException e) {
    System.err.println("认证失败: " + e.getMessage());
} catch (QuotaExceededException e) {
    System.err.println("配额超限");
} catch (SdkException e) {
    System.err.println("API 错误 [" + e.getStatus() + "]: " + e.getMessage());
}
```

## 配置

### 基础配置

```java
IhuiClient client = IhuiClient.builder()
    .apiKey("ihui_xxx")           // 必需
    .secret("your-secret")        // 可选
    .baseUrl("http://localhost:8802") // 可选，默认 localhost:8802
    .timeout(Duration.ofSeconds(60)) // 可选，默认 30s
    .maxRetries(3)                   // 可选，默认 2
    .build();
```

### 使用 SdkConfig

```java
SdkConfig config = SdkConfig.builder()
    .apiKey("ihui_xxx")
    .baseUrl("http://localhost:8802")
    .build();

IhuiClient client = new IhuiClient(config);
```

## 构建

```bash
# 编译
mvn -B compile

# 打包（含源码和 javadoc）
mvn -B package

# 安装到本地 Maven 仓库
mvn -B install
```

## 项目结构

```
src/main/java/com/ihui/ai/sdk/
├── IhuiClient.java          # 入口类，聚合所有模块
├── BaseClient.java          # HTTP 客户端基础
├── SdkConfig.java           # 配置类
├── SdkException.java        # 异常基类
├── AuthenticationException.java  # 401 异常
├── PermissionException.java      # 403 异常
├── NotFoundException.java        # 404 异常
├── QuotaExceededException.java   # 429 异常
├── ServerException.java          # 5xx 异常
├── JsonUtil.java            # JSON 工具
├── StreamResponse.java      # SSE 流式响应
├── model/                   # 数据模型（17 个类）
│   ├── ChatCompletionRequest.java
│   ├── ChatCompletionResponse.java
│   ├── ModelsResponse.java
│   ├── EmbeddingsRequest.java
│   ├── EmbeddingsResponse.java
│   ├── ImageGenerationsRequest.java
│   ├── AudioSpeechRequest.java
│   ├── VideoGenerationsRequest.java
│   ├── AgentExecuteRequest.java
│   ├── AgentExecuteResponse.java
│   ├── MemorySearchRequest.java
│   ├── KnowledgeSearchRequest.java
│   ├── ToolCallRequest.java
│   ├── UploadInitRequest.java
│   ├── WorkflowRequest.java
│   ├── UsageResponse.java
│   └── ApiResponse.java
└── module/                  # 功能模块（13 个类）
    ├── AiApi.java
    ├── AgentsApi.java
    ├── AudioApi.java
    ├── ImagesApi.java
    ├── VideosApi.java
    ├── ThreeDApi.java
    ├── GenerationApi.java
    ├── KnowledgeApi.java
    ├── ToolsApi.java
    ├── MemoryApi.java
    ├── MessagesApi.java
    ├── FilesApi.java
    └── UserApi.java
```

## 依赖

- JDK 17+（使用 `java.net.http.HttpClient`）
- Jackson 2.17.2（`jackson-databind` + `jackson-annotations`）

无其他外部依赖。