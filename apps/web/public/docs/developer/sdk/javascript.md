# JavaScript SDK

## 安装

```bash
npm install @aizhs/sdk
```

## 快速开始

```javascript
import { AizhsClient } from '@aizhs/sdk'

const client = new AizhsClient({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://api.example.com/v1'
})

// 发送聊天请求
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello' }
  ]
})

console.log(response.choices[0].message.content)
```

## API参考

### 初始化客户端

```javascript
const client = new AizhsClient({
  apiKey: 'YOUR_API_KEY',
  baseURL: 'https://api.example.com/v1',
  timeout: 30000
})
```

### 对话API

```javascript
// 创建对话
const completion = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  temperature: 0.7,
  max_tokens: 1000
})

// 流式输出
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello' }
  ],
  stream: true
})

for await (const chunk of stream) {
  console.log(chunk.choices[0].delta.content)
}
```

### 模型API

```javascript
// 获取模型列表
const models = await client.models.list()

// 获取模型详情
const model = await client.models.retrieve('gpt-4')
```

### 文件API

```javascript
// 上传文件
const file = await client.files.create({
  file: fs.createReadStream('example.pdf'),
  purpose: 'assistants'
})

// 获取文件列表
const files = await client.files.list()

// 删除文件
await client.files.del('file-123')
```

## 错误处理

```javascript
try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  })
} catch (error) {
  if (error.status === 401) {
    console.error('API密钥无效')
  } else if (error.status === 429) {
    console.error('请求频率限制')
  } else {
    console.error('请求失败:', error.message)
  }
}
```

## 完整示例

```javascript
import { AizhsClient } from '@aizhs/sdk'

const client = new AizhsClient({
  apiKey: process.env.AIZHS_API_KEY
})

async function main() {
  try {
    // 获取模型列表
    const models = await client.models.list()
    console.log('可用模型:', models.data)

    // 创建对话
    const completion = await client.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is AI?' }
      ]
    })

    console.log('回复:', completion.choices[0].message.content)
  } catch (error) {
    console.error('错误:', error)
  }
}

main()
```

---

*最后更新: 2026-01-10*
