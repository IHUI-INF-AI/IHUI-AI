# ihui-java-sdk

IHUI-AI 官方 Java SDK(OpenAI 兼容)。

## 安装

```xml
<dependency>
  <groupId>com.ihui.ai</groupId>
  <artifactId>sdk</artifactId>
  <version>0.1.0</version>
</dependency>
```

## 用法

```java
import com.ihui.ai.sdk.*;
import java.util.List;

IhuiClient client = new IhuiClient("https://api.aizhs.top", "your-api-key");
ChatCompletionResponse resp = client.chatCompletionsCreate(
    new ChatCompletionRequest("gpt-4o",
        List.of(new Message("user", "你好")), null, null, null));
System.out.println(resp.choices().get(0).message().content());
ModelsListResponse models = client.modelsList();
```

HTTP 4xx/5xx 抛 `IhuiException`(含 statusCode + body)。骨架版本,后续真发布时补实现。
