# ihui-sdk

IHUI-AI 官方 Python SDK(OpenAI 兼容)。

## 安装

```bash
pip install ihui-sdk
```

## 用法

```python
from ihui_sdk import IhuiClient, ChatCompletionRequest, Message

client = IhuiClient('https://api.ihui.ai', 'your-api-key')
resp = client.chat_completions_create(
    ChatCompletionRequest(model='gpt-4o', messages=[Message(role='user', content='你好')])
)
print(resp.choices[0]['message']['content'])
models = client.models_list()
```

HTTP 4xx/5xx 抛 `IhuiError`(含 status_code + body)。骨架版本,后续真发布时补实现。
