# ihui-go

IHUI-AI 官方 Go SDK(OpenAI 兼容)。

## 安装

```bash
go get github.com/IHUI-INF-AI/IHUI-AI/sdks/go
```

## 用法

```go
import "github.com/IHUI-INF-AI/IHUI-AI/sdks/go/ihui"

client := ihui.NewIhuiClient("https://api.ihui.ai", "your-api-key")
resp, _ := client.ChatCompletionsCreate(&ihui.ChatCompletionRequest{
    Model:    "gpt-4o",
    Messages: []ihui.Message{{Role: "user", Content: "你好"}},
})
fmt.Println(resp.Choices[0].Message.Content)
models, _ := client.ModelsList()
```

HTTP 4xx/5xx 返回 `*ihui.IhuiError`(含 StatusCode + Body)。骨架版本,后续真发布时补实现。
