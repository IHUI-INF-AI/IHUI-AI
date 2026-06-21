# 最佳实践

## API使用

### 1. 错误处理

始终处理API错误：

```javascript
try {
  const response = await fetch(url, options)
  const data = await response.json()
  
  if (!data.success) {
    // 处理错误
    handleError(data)
  }
} catch (error) {
  // 处理网络错误
  handleNetworkError(error)
}
```

### 2. 重试机制

对于临时性错误，实现重试机制：

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return await response.json()
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

### 3. 速率限制

遵守API速率限制，避免请求过于频繁：

```javascript
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
    this.requests = []
  }
  
  async wait() {
    const now = Date.now()
    this.requests = this.requests.filter(time => now - time < this.windowMs)
    
    if (this.requests.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.requests[0])
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    this.requests.push(Date.now())
  }
}

const limiter = new RateLimiter(100, 60000) // 每分钟100次

async function makeRequest() {
  await limiter.wait()
  return fetch(url, options)
}
```

## 安全

### 1. API密钥保护

- 不要在客户端代码中硬编码API密钥
- 使用环境变量存储API密钥
- 不要在公开仓库中提交API密钥

### 2. HTTPS

始终使用HTTPS进行API通信。

### 3. 输入验证

验证所有用户输入：

```javascript
function validateInput(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Invalid input')
  }
  if (input.length > 1000) {
    throw new Error('Input too long')
  }
  return input
}
```

## 性能优化

### 1. 请求缓存

缓存不经常变化的数据：

```javascript
const cache = new Map()

async function getCachedData(key, fetcher, ttl = 3600000) {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data
  }
  
  const data = await fetcher()
  cache.set(key, { data, timestamp: Date.now() })
  return data
}
```

### 2. 批量请求

合并多个请求：

```javascript
async function batchRequest(requests) {
  const promises = requests.map(req => fetch(req.url, req.options))
  return Promise.all(promises)
}
```

### 3. 流式处理

对于大量数据，使用流式处理：

```javascript
const stream = await fetch(url, { ...options, stream: true })
const reader = stream.body.getReader()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  processChunk(value)
}
```

## 代码组织

### 1. 模块化

将API调用封装成模块：

```javascript
// api/chat.js
export class ChatAPI {
  constructor(client) {
    this.client = client
  }
  
  async createCompletion(params) {
    return this.client.post('/v1/chat', params)
  }
}
```

### 2. 类型安全

使用TypeScript提供类型安全：

```typescript
interface ChatRequest {
  model: string
  messages: Message[]
  temperature?: number
}

interface ChatResponse {
  choices: Choice[]
  usage: Usage
}
```

---

*最后更新: 2026-01-10*
