# 知识库 API

> 权限点:`knowledge:read`(查询/搜索/RAG/图谱数据)、`knowledge:write`(入库/删除/图谱抽取/构建/清空)。本模块覆盖 13 个端点,包括知识库文档管理、语义搜索、RAG 上下文检索、知识图谱。

## GET /v1/knowledge/health

知识库服务健康检查。

**权限点**:`knowledge:read`

### 响应(200)

```json
{
  "status": "healthy",
  "documentCount": 1523,
  "totalChunks": 45678,
  "vectorDimension": 1536
}
```

### 代码示例

```typescript
const health = await client.knowledge.health()
```

## GET /v1/knowledge/documents

文档列表。

**权限点**:`knowledge:read`

### 请求

```http
GET /v1/knowledge/documents
Authorization: Bearer ihui_xxx
```

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "doc-123",
      "title": "产品手册",
      "source": "upload",
      "chunkCount": 42,
      "sizeBytes": 102400,
      "createdAt": "2026-07-22T08:00:00Z"
    }
  ]
}
```

### 代码示例

```typescript
const docs = await client.knowledge.listDocuments()
```

## POST /v1/knowledge/documents

文档入库,自动分块 + 向量化。

**权限点**:`knowledge:write`

### 请求

```json
{
  "title": "产品手册",
  "content": "文档全文内容...",
  "source": "manual",
  "chunkStrategy": "paragraph",
  "chunkSize": 500,
  "chunkOverlap": 50
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 文档标题 |
| content | string | 是 | 文档全文 |
| source | string | 否 | 来源标识 |
| chunkStrategy | string | 否 | 分块策略:`fixed` / `sentence` / `paragraph`,默认 paragraph |
| chunkSize | number | 否 | 分块大小(字符数) |
| chunkOverlap | number | 否 | 分块重叠(字符数) |

### 响应(201)

```json
{
  "documentId": "doc-123",
  "chunkCount": 42,
  "status": "ingested"
}
```

### 代码示例

```typescript
const result = await client.knowledge.ingestDocument({
  title: '产品手册',
  content: '文档全文...',
  chunkStrategy: 'paragraph',
})
```

## GET /v1/knowledge/documents/:id

文档详情。

**权限点**:`knowledge:read`

### 响应(200)

```json
{
  "id": "doc-123",
  "title": "产品手册",
  "source": "manual",
  "chunkCount": 42,
  "sizeBytes": 102400,
  "createdAt": "2026-07-22T08:00:00Z"
}
```

### 代码示例

```typescript
const doc = await client.knowledge.getDocument('doc-123')
```

## GET /v1/knowledge/documents/:id/chunks

文档分块列表。

**权限点**:`knowledge:read`

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "chunk-0",
      "content": "第一段内容...",
      "index": 0,
      "metadata": { "page": 1 }
    }
  ]
}
```

### 代码示例

```typescript
const chunks = await client.knowledge.getDocumentChunks('doc-123')
```

## DELETE /v1/knowledge/documents/:id

删除文档(含分块与向量)。

**权限点**:`knowledge:write`

### 响应(204)

无内容。

### 代码示例

```typescript
await client.knowledge.deleteDocument('doc-123')
```

## POST /v1/knowledge/documents/batch-delete

批量删除文档。

**权限点**:`knowledge:write`

### 请求

```json
{
  "documentIds": ["doc-1", "doc-2", "doc-3"]
}
```

### 响应(200)

```json
{
  "deletedCount": 3,
  "status": "completed"
}
```

### 代码示例

```typescript
const result = await client.knowledge.batchDeleteDocuments({
  documentIds: ['doc-1', 'doc-2'],
})
```

## POST /v1/knowledge/search

语义搜索,返回相关分块。

**权限点**:`knowledge:read`

### 请求

```json
{
  "query": "如何配置 API Key",
  "topK": 5,
  "documentIds": ["doc-1", "doc-2"],
  "threshold": 0.7
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索查询 |
| topK | number | 否 | 返回数量,默认 5 |
| documentIds | string[] | 否 | 限定文档范围 |
| threshold | number | 否 | 相似度阈值(0-1),低于此值不返回 |

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "id": "chunk-42",
      "documentId": "doc-1",
      "content": "API Key 可在设置页面创建...",
      "score": 0.92,
      "metadata": { "page": 5 }
    }
  ]
}
```

### 代码示例

```typescript
const results = await client.knowledge.search({
  query: '如何配置 API Key',
  topK: 5,
})
```

## POST /v1/knowledge/rag-context

RAG 上下文检索,返回拼接好的上下文文本。

**权限点**:`knowledge:read`

### 请求

```json
{
  "query": "如何配置 API Key",
  "topK": 3,
  "injectSystemPrompt": true
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 查询 |
| topK | number | 否 | 返回数量,默认 3 |
| injectSystemPrompt | boolean | 否 | 是否注入系统提示模板 |

### 响应(200)

```json
{
  "context": "根据知识库,API Key 可在设置页面创建...\n\n参考文档:产品手册",
  "sources": [
    { "documentId": "doc-1", "chunkId": "chunk-42", "score": 0.92 }
  ]
}
```

### 代码示例

```typescript
const rag = await client.knowledge.ragContext({
  query: '如何配置 API Key',
  topK: 3,
  injectSystemPrompt: true,
})
// 将 rag.context 作为 system message 注入 chat completions
```

## POST /v1/knowledge-graph/extract

知识图谱抽取,从文本中提取实体与关系。

**权限点**:`knowledge:write`

### 请求

```json
{
  "text": "张三是 IHUI 公司的 CEO,李四是 CTO。",
  "extractType": "both"
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 待抽取文本 |
| extractType | string | 否 | `entities` / `relations` / `both`,默认 both |

### 响应(200)

```json
{
  "entities": [
    { "id": "e1", "name": "张三", "type": "person" },
    { "id": "e2", "name": "IHUI 公司", "type": "organization" },
    { "id": "e3", "name": "李四", "type": "person" }
  ],
  "relations": [
    { "source": "e1", "target": "e2", "type": "CEO_of" },
    { "source": "e3", "target": "e2", "type": "CTO_of" }
  ]
}
```

### 代码示例

```typescript
const result = await client.knowledge.extractGraph({
  text: '张三是 IHUI 公司的 CEO',
  extractType: 'both',
})
```

## POST /v1/knowledge-graph/build

知识图谱构建,基于已有文档构建图谱。

**权限点**:`knowledge:write`

### 请求

```json
{
  "documentIds": ["doc-1", "doc-2"]
}
```

### 响应(202)

```json
{
  "taskId": "graph-build-1",
  "status": "processing"
}
```

### 代码示例

```typescript
const result = await client.knowledge.buildGraph({
  documentIds: ['doc-1', 'doc-2'],
})
```

## GET /v1/knowledge-graph/data

知识图谱数据,含节点与边。

**权限点**:`knowledge:read`

### 响应(200)

```json
{
  "nodes": [
    { "id": "e1", "label": "张三", "type": "person" },
    { "id": "e2", "label": "IHUI 公司", "type": "organization" }
  ],
  "edges": [
    { "source": "e1", "target": "e2", "label": "CEO_of" }
  ]
}
```

### 代码示例

```typescript
const graph = await client.knowledge.getGraphData()
```

## DELETE /v1/knowledge-graph/data

清空知识图谱。

**权限点**:`knowledge:write`

### 响应(204)

无内容。

### 代码示例

```typescript
await client.knowledge.clearGraph()
```

## 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | query 为空 / content 为空 / documentIds 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `knowledge:read` / `knowledge:write` 权限 |
| 404 | 文档不存在 |
| 429 | 配额超限 |
| 502 | 上游向量数据库错误 |

---

*最后更新: 2026-07-22*
