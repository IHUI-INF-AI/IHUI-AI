# 向量嵌入 API

> 权限点:`embeddings:write`。本模块覆盖 1 个端点,OpenAI 兼容格式,内部转发到 ai-service(LiteLLM)。

## POST /v1/embeddings

生成文本向量嵌入,用于语义搜索、聚类、RAG 检索等场景。

**权限点**:`embeddings:write`

### 请求

```http
POST /v1/embeddings
Authorization: Bearer ihui_xxx
Content-Type: application/json
```

```json
{
  "model": "text-embedding-3-small",
  "input": "IHUI-AI 是全栈 AI 平台",
  "dimensions": 1536
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| model | string | 是 | Embedding 模型 ID,见 `GET /v1/models` |
| input | string \| string[] | 是 | 待嵌入的文本,支持单条或批量 |
| dimensions | number | 否 | 输出维度(部分模型支持,如 `text-embedding-3-small`) |

### 响应(200)

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [-0.021, 0.007, 0.044, "...", 0.012]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": { "promptTokens": 8, "totalTokens": 8 }
}
```

> `embedding` 数组长度由 `dimensions` 参数决定(默认模型自带维度)。camelCase:`promptTokens`、`totalTokens`。

### 批量输入

```json
{
  "model": "text-embedding-3-small",
  "input": ["文本一", "文本二", "文本三"]
}
```

响应 `data` 数组含 3 个 embedding 对象,`index` 从 0 递增。

### 错误码

| 状态码 | 场景 |
|--------|------|
| 400 | model 为空 / input 为空 |
| 401 | API Key 无效 |
| 403 | 缺少 `embeddings:write` 权限 |
| 429 | 配额超限 |
| 502 | 上游 LiteLLM 错误 |

### 代码示例

**TypeScript(@ihui/sdk)**

```typescript
const response = await client.ai.embeddings({
  model: 'text-embedding-3-small',
  input: 'IHUI-AI 是全栈 AI 平台',
  dimensions: 1536,
})
console.log(response.data[0].embedding.length) // 1536
```

**Python(ihui-ai)**

```python
response = client.ai.embeddings(
    model="text-embedding-3-small",
    input="IHUI-AI 是全栈 AI 平台",
    dimensions=1536,
)
print(len(response["data"][0]["embedding"]))  # 1536
```

**cURL**

```bash
curl -X POST http://localhost:8802/v1/embeddings \
  -H "Authorization: Bearer ihui_xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-3-small","input":"测试文本"}'
```

### 应用场景

- **语义搜索** — 将文档分块嵌入,存入向量数据库,查询时嵌入 query 做余弦相似度检索
- **RAG 检索增强** — 配合 `POST /v1/knowledge/rag-context` 检索相关上下文
- **聚类分类** — 对文本集合嵌入后做 K-Means 等聚类

---

*最后更新: 2026-07-22*
