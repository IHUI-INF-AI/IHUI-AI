# MCP 工具 API

> 权限点:`tools:read`(查询工具/资源/提示词/技能/命令/人格)、`tools:call`(调用工具/提示词/命令/sampling/搜索/截图)。本模块覆盖 16 个端点,对接 MCP(Model Context Protocol)工具生态。

## GET /v1/tools

MCP 工具列表。

**权限点**:`tools:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "name": "playwright_navigate",
      "description": "导航到指定 URL",
      "inputSchema": {
        "type": "object",
        "properties": { "url": { "type": "string" } },
        "required": ["url"]
      },
      "category": "browser"
    }
  ]
}
```

### 代码示例

```typescript
const tools = await client.tools.list()
```

## POST /v1/tools/call

调用 MCP 工具。

**权限点**:`tools:call`

### 请求

```json
{
  "name": "playwright_navigate",
  "arguments": { "url": "https://example.com" }
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 工具名称,见 `GET /v1/tools` |
| arguments | object | 是 | 工具参数,结构由工具 `inputSchema` 决定 |

### 响应(200)

```json
{
  "toolName": "playwright_navigate",
  "result": { "title": "Example Domain", "url": "https://example.com" },
  "isError": false
}
```

### 代码示例

```typescript
const result = await client.tools.call({
  name: 'playwright_navigate',
  arguments: { url: 'https://example.com' },
})
```

## GET /v1/resources

MCP 资源列表。

**权限点**:`tools:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "uri": "file:///project/README.md",
      "name": "项目说明",
      "description": "项目 README 文件",
      "mimeType": "text/markdown"
    }
  ]
}
```

### 代码示例

```typescript
const resources = await client.tools.listResources()
```

## GET /v1/resources/:uri

资源详情(内容)。

**权限点**:`tools:read`

### 请求

```http
GET /v1/resources/file:///project/README.md
Authorization: Bearer ihui_xxx
```

> `:uri` 为 URL 编码的资源 URI。

### 响应(200)

```json
{
  "uri": "file:///project/README.md",
  "mimeType": "text/markdown",
  "text": "# 项目说明\n..."
}
```

### 代码示例

```typescript
const resource = await client.tools.getResource('file:///project/README.md')
```

## GET /v1/prompts

MCP 提示词列表。

**权限点**:`tools:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "name": "code-review",
      "description": "代码审查提示词",
      "arguments": [
        { "name": "language", "description": "编程语言", "required": true }
      ]
    }
  ]
}
```

### 代码示例

```typescript
const prompts = await client.tools.listPrompts()
```

## POST /v1/prompts/invoke

调用提示词模板。

**权限点**:`tools:call`

### 请求

```json
{
  "name": "code-review",
  "arguments": { "language": "typescript" }
}
```

### 响应(200)

```json
{
  "messages": [
    {
      "role": "user",
      "content": { "type": "text", "text": "请审查以下 TypeScript 代码..." }
    }
  ]
}
```

### 代码示例

```typescript
const result = await client.tools.invokePrompt({
  name: 'code-review',
  arguments: { language: 'typescript' },
})
```

## GET /v1/skills

技能列表。

**权限点**:`tools:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "name": "pdf-export",
      "description": "导出 PDF 文档",
      "version": "1.0.0",
      "capabilities": ["export", "convert"]
    }
  ]
}
```

### 代码示例

```typescript
const skills = await client.tools.listSkills()
```

## GET /v1/slash-commands

slash 命令列表。

**权限点**:`tools:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    { "command": "/summarize", "description": "总结当前对话" },
    { "command": "/translate", "description": "翻译文本" }
  ]
}
```

### 代码示例

```typescript
const commands = await client.tools.listSlashCommands()
```

## POST /v1/slash-commands

执行 slash 命令。

**权限点**:`tools:call`

### 请求

```json
{
  "command": "/summarize",
  "arguments": { "length": "short" }
}
```

### 响应(200)

返回命令执行结果(结构由命令决定)。

### 代码示例

```typescript
const result = await client.tools.invokeSlashCommand({
  command: '/summarize',
  arguments: { length: 'short' },
})
```

## POST /v1/sampling

模型采样,让服务端选择模型生成回复。

**权限点**:`tools:call`

### 请求

```json
{
  "messages": [{ "role": "user", "content": "你好" }],
  "modelPreferences": {
    "hints": ["gpt-4", "claude-3"],
    "costPriority": 0.3,
    "speedPriority": 0.7,
    "intelligencePriority": 0.8
  },
  "maxTokens": 1000
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messages | array | 是 | 消息列表 |
| modelPreferences | object | 否 | 模型偏好(hints/costPriority/speedPriority/intelligencePriority) |
| maxTokens | number | 是 | 最大生成 token 数 |

### 响应(200)

```json
{
  "model": "gpt-4",
  "role": "assistant",
  "content": "你好!有什么可以帮你的吗?",
  "stopReason": "stop"
}
```

### 代码示例

```typescript
const result = await client.tools.sampling({
  messages: [{ role: 'user', content: '你好' }],
  maxTokens: 1000,
})
```

## GET /v1/personas

人格列表。

**权限点**:`tools:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "name": "technical-writer",
      "description": "技术文档写手",
      "systemPrompt": "你是一位专业的技术文档写手...",
      "traits": ["precise", "clear", "structured"]
    }
  ]
}
```

### 代码示例

```typescript
const personas = await client.tools.listPersonas()
```

## GET /v1/personas/:name

人格详情。

**权限点**:`tools:read`

### 请求

```http
GET /v1/personas/technical-writer
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "name": "technical-writer",
  "description": "技术文档写手",
  "systemPrompt": "你是一位专业的技术文档写手...",
  "traits": ["precise", "clear", "structured"]
}
```

### 代码示例

```typescript
const persona = await client.tools.getPersona('technical-writer')
```

## POST /v1/tools/search-codebase

代码库语义搜索。

**权限点**:`tools:call`

### 请求

```json
{
  "query": "用户认证逻辑实现",
  "directory": "/src/auth"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索查询 |
| directory | string | 否 | 限定目录 |

### 响应(200)

返回匹配的代码片段列表(结构由实现决定)。

### 代码示例

```typescript
const results = await client.tools.searchCodebase({
  query: '用户认证逻辑',
  directory: '/src/auth',
})
```

## POST /v1/tools/search-web

网页搜索。

**权限点**:`tools:call`

### 请求

```json
{
  "query": "IHUI-AI 平台最新动态",
  "num": 5
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索查询 |
| num | number | 否 | 返回数量,默认 5 |

### 响应(200)

返回搜索结果列表(标题/URL/摘要)。

### 代码示例

```typescript
const results = await client.tools.searchWeb({
  query: 'IHUI-AI 平台',
  num: 5,
})
```

## POST /v1/tools/analyze-code

代码分析。

**权限点**:`tools:call`

### 请求

```json
{
  "code": "function add(a, b) { return a + b; }",
  "language": "javascript"
}
```

### 响应(200)

返回分析结果(质量评分/问题/建议)。

### 代码示例

```typescript
const result = await client.tools.analyzeCode({
  code: 'function add(a, b) { return a + b; }',
  language: 'javascript',
})
```

## POST /v1/screenshot

网页截图。

**权限点**:`tools:call`

### 请求

```json
{
  "url": "https://example.com",
  "width": 1280,
  "height": 720,
  "fullPage": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| url | string | 是 | 目标 URL |
| width | number | 否 | 视口宽度,默认 1280 |
| height | number | 否 | 视口高度,默认 720 |
| fullPage | boolean | 否 | 是否截取整页,默认 false |

### 响应(200)

```json
{
  "image": "base64编码的截图",
  "format": "png",
  "width": 1280,
  "height": 720
}
```

### 代码示例

```typescript
const result = await client.tools.screenshot({
  url: 'https://example.com',
  fullPage: true,
})
fs.writeFileSync('screenshot.png', Buffer.from(result.image, 'base64'))
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | name 为空 / arguments 无效 / url 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `tools:read` / `tools:call` 权限 |
| 404 | 工具/资源/提示词/人格不存在 |
| 429 | 配额超限 |
| 502 | 上游 MCP 服务错误 |

---

*最后更新: 2026-07-22*
