# Python SDK

## 安装

```bash
pip install aizhs-sdk
```

## 快速开始

```python
from aizhs import AizhsClient

client = AizhsClient(
    api_key='YOUR_API_KEY',
    base_url='https://api.example.com/v1'
)

# 发送聊天请求
response = client.chat.completions.create(
    model='gpt-4',
    messages=[
        {'role': 'user', 'content': 'Hello'}
    ]
)

print(response.choices[0].message.content)
```

## API参考

### 初始化客户端

```python
from aizhs import AizhsClient

client = AizhsClient(
    api_key='YOUR_API_KEY',
    base_url='https://api.example.com/v1',
    timeout=30
)
```

### 对话API

```python
# 创建对话
completion = client.chat.completions.create(
    model='gpt-4',
    messages=[
        {'role': 'user', 'content': 'Hello'}
    ],
    temperature=0.7,
    max_tokens=1000
)

# 流式输出
stream = client.chat.completions.create(
    model='gpt-4',
    messages=[
        {'role': 'user', 'content': 'Hello'}
    ],
    stream=True
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end='')
```

### 模型API

```python
# 获取模型列表
models = client.models.list()

# 获取模型详情
model = client.models.retrieve('gpt-4')
```

### 文件API

```python
# 上传文件
with open('example.pdf', 'rb') as f:
    file = client.files.create(
        file=f,
        purpose='assistants'
    )

# 获取文件列表
files = client.files.list()

# 删除文件
client.files.delete('file-123')
```

## 错误处理

```python
from aizhs import AizhsClient, APIError

client = AizhsClient(api_key='YOUR_API_KEY')

try:
    response = client.chat.completions.create(
        model='gpt-4',
        messages=[{'role': 'user', 'content': 'Hello'}]
    )
except APIError as e:
    if e.status_code == 401:
        print('API密钥无效')
    elif e.status_code == 429:
        print('请求频率限制')
    else:
        print(f'请求失败: {e.message}')
```

## 完整示例

```python
from aizhs import AizhsClient

client = AizhsClient(api_key='YOUR_API_KEY')

def main():
    try:
        # 获取模型列表
        models = client.models.list()
        print('可用模型:', models.data)

        # 创建对话
        completion = client.chat.completions.create(
            model='gpt-4',
            messages=[
                {'role': 'system', 'content': 'You are a helpful assistant.'},
                {'role': 'user', 'content': 'What is AI?'}
            ]
        )

        print('回复:', completion.choices[0].message.content)
    except Exception as e:
        print('错误:', e)

if __name__ == '__main__':
    main()
```

---

*最后更新: 2026-01-10*
