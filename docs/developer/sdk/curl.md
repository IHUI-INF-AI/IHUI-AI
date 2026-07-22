# cURL 示例

> 所有请求需在 `Authorization` 头携带 API Key(格式 `Bearer ihui_xxx`)。可选 `X-Api-Secret: sk_xxx` 进行 Secret 二次校验。
> 基础 URL:`http://localhost:8802`(生产环境替换为实际域名)。

## 环境变量

建议将 API Key 存储在环境变量中,避免在命令行明文传递:

```bash
export IHUI_API_KEY="ihui_xxx"
export IHUI_API_SECRET="sk_xxx"  # 可选
export IHUI_BASE_URL="http://localhost:8802"
```

后续 cURL 示例均使用 `$IHUI_API_KEY` 占位。

## AI 核心

### 对话(非流式)

```bash
curl -X POST "$IHUI_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "system", "content": "你是一个有帮助的助手。"},
      {"role": "user", "content": "什么是 AI?"}
    ],
    "temperature": 0.7,
    "maxTokens": 1000
  }'
```

### 对话(流式 SSE)

```bash
curl -X POST "$IHUI_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "讲一个故事"}],
    "stream": true
  }'
```

> `-N` 禁用缓冲,实时输出 SSE 事件。

### 视觉理解

```bash
curl -X POST "$IHUI_BASE_URL/v1/chat/vision" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o",
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "prompt": "描述这张图片"
  }'
```

### 向量嵌入

```bash
curl -X POST "$IHUI_BASE_URL/v1/embeddings" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-3-small",
    "input": "IHUI-AI 平台",
    "dimensions": 1536
  }'
```

### 模型列表

```bash
curl "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 模型详情

```bash
curl "$IHUI_BASE_URL/v1/models/gpt-4" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 厂商模型列表

```bash
curl "$IHUI_BASE_URL/v1/vendors/openai/models" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

## Agent

### Agent 列表

```bash
curl "$IHUI_BASE_URL/v1/agents" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### Agent 详情

```bash
curl "$IHUI_BASE_URL/v1/agents/agent-123" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 调用 Agent

```bash
curl -X POST "$IHUI_BASE_URL/v1/agents/agent-123/call" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": "帮我写一个 Hello World"
  }'
```

### 高级执行(支持 PermissionGuard)

```bash
curl -X POST "$IHUI_BASE_URL/v1/agents/execute" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-123",
    "input": "重构这段代码",
    "permissionMode": "accept-edits",
    "maxIterations": 10
  }'
```

### 流式执行

```bash
curl -X POST "$IHUI_BASE_URL/v1/agents/execute/stream" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "agentId": "agent-123",
    "input": "逐行分析"
  }'
```

### Pipeline 编排

```bash
curl -X POST "$IHUI_BASE_URL/v1/agents/pipeline" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {"agentId": "agent-a", "input": "步骤 1"},
      {"agentId": "agent-b", "input": "步骤 2", "dependsOn": [0]}
    ]
  }'
```

### 并行执行

```bash
curl -X POST "$IHUI_BASE_URL/v1/agents/parallel" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [
      {"agentId": "agent-a", "input": "任务 A"},
      {"agentId": "agent-b", "input": "任务 B"}
    ]
  }'
```

## 文件

### 文件列表

```bash
curl "$IHUI_BASE_URL/v1/files" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 上传文件(multipart)

```bash
curl -X POST "$IHUI_BASE_URL/v1/files" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -F "file=@example.pdf" \
  -F "purpose=assistants"
```

### 文件详情

```bash
curl "$IHUI_BASE_URL/v1/files/file-123" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 删除文件

```bash
curl -X DELETE "$IHUI_BASE_URL/v1/files/file-123" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 文件内容(二进制)

```bash
curl "$IHUI_BASE_URL/v1/files/file-123/content" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -o downloaded.pdf
```

### 文件版本

```bash
curl "$IHUI_BASE_URL/v1/files/file-123/versions" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 分片上传(3 步)

```bash
# 1. 初始化
curl -X POST "$IHUI_BASE_URL/v1/files/upload-init" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "large-video.mp4",
    "size": 524288000,
    "mimeType": "video/mp4",
    "chunkSize": 5242880
  }'

# 2. 上传分片(重复 chunkCount 次,可并行)
curl -X POST "$IHUI_BASE_URL/v1/files/upload-chunk" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "upload-abc",
    "index": 0,
    "chunk": "<base64-encoded-chunk>"
  }'

# 3. 完成
curl -X POST "$IHUI_BASE_URL/v1/files/complete" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"uploadId": "upload-abc"}'
```

## 多模态

### TTS 语音合成

```bash
curl -X POST "$IHUI_BASE_URL/v1/audio/speech" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "input": "你好世界",
    "voice": "alloy",
    "responseFormat": "mp3"
  }'
```

### ASR 语音识别

```bash
curl -X POST "$IHUI_BASE_URL/v1/audio/transcriptions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "whisper-1",
    "audio": "<base64-audio>"
  }'
```

### 文生图

```bash
curl -X POST "$IHUI_BASE_URL/v1/images/generations" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "dall-e-3",
    "prompt": "一只猫",
    "size": "1024x1024"
  }'
```

### 视频生成

```bash
curl -X POST "$IHUI_BASE_URL/v1/videos/generations" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-2",
    "prompt": "城市夜景",
    "duration": 5,
    "resolution": "1080p"
  }'
```

### 3D 模型生成

```bash
curl -X POST "$IHUI_BASE_URL/v1/3d/generations" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "triposr",
    "input": "<base64-image>",
    "format": "glb"
  }'
```

### 生成队列

```bash
# 入队
curl -X POST "$IHUI_BASE_URL/v1/generation/enqueue" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "video",
    "payload": {"prompt": "..."},
    "priority": 5
  }'

# 状态查询
curl "$IHUI_BASE_URL/v1/generation/status/job-123" \
  -H "Authorization: Bearer $IHUI_API_KEY"

# 取消
curl -X POST "$IHUI_BASE_URL/v1/generation/cancel/job-123" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

## 知识库

### 健康检查

```bash
curl "$IHUI_BASE_URL/v1/knowledge/health" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 文档入库

```bash
curl -X POST "$IHUI_BASE_URL/v1/knowledge/documents" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "IHUI-AI 简介",
    "content": "IHUI-AI 是一个全栈 AI 平台...",
    "chunkStrategy": "paragraph",
    "chunkSize": 500
  }'
```

### 语义搜索

```bash
curl -X POST "$IHUI_BASE_URL/v1/knowledge/search" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "什么是 IHUI-AI?",
    "topK": 5,
    "threshold": 0.7
  }'
```

### RAG 上下文

```bash
curl -X POST "$IHUI_BASE_URL/v1/knowledge/rag-context" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "平台架构",
    "injectSystemPrompt": true
  }'
```

## MCP 工具

### 工具列表

```bash
curl "$IHUI_BASE_URL/v1/tools" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 调用工具

```bash
curl -X POST "$IHUI_BASE_URL/v1/tools/call" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "search-codebase",
    "arguments": {"query": "auth middleware", "directory": "/src"}
  }'
```

### 截图

```bash
curl -X POST "$IHUI_BASE_URL/v1/screenshot" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "fullPage": true
  }'
```

## 用户与工作流

### 当前用户(含配额)

```bash
curl "$IHUI_BASE_URL/v1/me" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 用量统计

```bash
curl "$IHUI_BASE_URL/v1/usage" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 厂商用量

```bash
curl "$IHUI_BASE_URL/v1/usage/openai" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 运行工作流

```bash
curl -X POST "$IHUI_BASE_URL/v1/workflows/instances" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "wf-123",
    "inputs": {"key": "value"}
  }'
```

## 鉴权示例

### 仅 API Key

```bash
curl "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### API Key + Secret 二次校验

```bash
curl "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "X-Api-Secret: $IHUI_API_SECRET"
```

### 使用 X-Api-Key 头(替代方案)

```bash
curl "$IHUI_BASE_URL/v1/models" \
  -H "X-Api-Key: $IHUI_API_KEY"
```

## 调试技巧

### 查看响应头(含配额信息)

```bash
curl -i "$IHUI_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $IHUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hi"}]}'
```

> `-i` 显示响应头,可看到 `X-RateLimit-Remaining` 等配额信息。

### 仅查看响应头(不下载 body)

```bash
curl -I "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY"
```

### 详细连接日志

```bash
curl -v "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY" 2>&1 | head -50
```

### JSON 美化输出(配合 jq)

```bash
curl "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY" | jq .
```

### 测量请求耗时

```bash
curl -w "@-" -o /dev/null -s "$IHUI_BASE_URL/v1/models" \
  -H "Authorization: Bearer $IHUI_API_KEY" <<'EOF'
时间分解:
  DNS 解析: %{time_namelookup}s
  TCP 连接: %{time_connect}s
  TLS 握手: %{time_appconnect}s
  服务端处理: %{time_starttransfer}s
  总耗时: %{time_total}s
EOF
```

---

*最后更新: 2026-07-22*
