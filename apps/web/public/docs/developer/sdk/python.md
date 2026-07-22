# Python SDK

> 包名:`ihui-ai`(PyPI),版本 0.1.0,要求 Python ≥ 3.10。零运行时依赖(纯 stdlib),完整封装 105 个 `/v1/*` 端点,提供同步 + asyncio 双版本客户端。

## 安装

```bash
pip install ihui-ai
# 或
uv add ihui-ai
# 或
poetry add ihui-ai
```

## 快速开始

### 同步客户端

```python
import os
from ihui_ai import create_client

client = create_client({
    "apiKey": os.environ["IHUI_API_KEY"],  # 必需,格式 ihui_xxx
    # "secret": "sk_xxx",                  # 可选,创建/轮换时返回
    # "baseUrl": "http://localhost:3001",  # 可选,默认 http://localhost:3001
    # "timeout": 30,                       # 可选,默认 30 秒(流式不超时)
    # "maxRetries": 2,                     # 可选,默认 2(5xx + 网络错误自动重试)
})

# 列出模型
models = client.ai.list_models()
print(models["data"][0]["id"])

# 非流式对话
resp = client.ai.completions(
    {"model": "gpt-4", "messages": [{"role": "user", "content": "你好"}]}
)
print(resp["choices"][0]["message"]["content"])
```

### asyncio 客户端

```python
import asyncio
from ihui_ai import AsyncIhuiClient

async def main():
    client = AsyncIhuiClient({"apiKey": "ihui_xxx"})
    models = await client.ai.list_models()
    print(models["data"][0]["id"])

    # 流式对话
    async for chunk in client.ai.completions_stream(
        {"model": "gpt-4", "messages": [{"role": "user", "content": "讲个故事"}]}
    ):
        content = chunk["choices"][0]["delta"].get("content", "")
        print(content, end="")

asyncio.run(main())
```

## 配置

### SdkConfig

配置键同时接受 Python 风格(snake_case)和 TS 风格(camelCase):

| 键 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `apiKey` / `api_key` | str | 是 | — | API Key,格式 `ihui_xxx` |
| `secret` | str | 否 | — | API Secret(创建/轮换密钥时返回),通过 `X-Api-Secret` 头传递 |
| `baseUrl` / `base_url` | str | 否 | `http://localhost:3001` | 基础 URL(自动去除尾部 `/`) |
| `timeout` | float | 否 | 30.0 | 请求超时(秒),流式请求不超时 |
| `maxRetries` / `max_retries` | int | 否 | 2 | 最大重试次数(网络错误和 5xx 自动重试,429 和 4xx 不重试) |

### 鉴权头

SDK 自动附加以下请求头:

```http
Authorization: Bearer ihui_xxx
Content-Type: application/json
X-Api-Secret: sk_xxx  (若配置了 secret)
```

## 模块概览

`IhuiClient` / `AsyncIhuiClient` 聚合 13 个功能模块,所有方法名采用 snake_case:

| 模块 | 客户端属性 | 端点数 | 说明 |
|------|-----------|--------|------|
| AI 核心 | `client.ai` | 13 | chat / embeddings / models / moa |
| Agent | `client.agents` | 12 | 列表 / 调用 / 高级执行 / Pipeline / 并行 |
| 音频 | `client.audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| 图像 | `client.images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| 视频 | `client.videos` | 3 | 生成 / 任务查询 / 编排 |
| 3D | `client.threed` | 1 | 3D 模型生成 |
| 生成队列 | `client.generation` | 3 | 入队 / 状态 / 取消 |
| 知识库 | `client.knowledge` | 13 | 文档 CRUD / 语义搜索 / RAG / 图谱 |
| MCP 工具 | `client.tools` | 16 | 工具 / 资源 / 提示词 / 技能 / 人格 / 截图 |
| 记忆 | `client.memory` | 8 | 保存 / 召回 / 搜索 / Dream / 分类记忆 |
| 消息 | `client.messages` | 4 | 发布 / 订阅 / 状态 |
| 文件 | `client.files` | 9 | 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片 |
| 用户 | `client.user` | 9 | 当前用户 / 项目 / 工作流 / 用量统计 |

> 同步与异步客户端方法签名一致,仅异步版方法为 `async def` 且返回 awaitable;流式方法同步版返回 `Iterator`,异步版返回 `AsyncIterator`。

## AI 核心模块

### 非流式对话

```python
resp = client.ai.completions(
    {
        "model": "gpt-4",
        "messages": [
            {"role": "system", "content": "你是一个有帮助的助手。"},
            {"role": "user", "content": "什么是 AI?"},
        ],
        "temperature": 0.7,
        "maxTokens": 1000,
    }
)
print(resp["choices"][0]["message"]["content"])
print(resp["usage"])  # {"promptTokens", "completionTokens", "totalTokens"}
```

### 流式对话(SSE)

```python
for chunk in client.ai.completions_stream(
    {"model": "gpt-4", "messages": [{"role": "user", "content": "讲一个故事"}]}
):
    content = chunk["choices"][0]["delta"].get("content", "")
    print(content, end="")
```

> `completions_stream` 返回生成器,SDK 自动解析 SSE `data:` 行,遇到 `data: [DONE]` 结束。

### 向量嵌入

```python
emb = client.ai.embeddings(
    {"model": "text-embedding-3-small", "input": "IHUI-AI 平台", "dimensions": 1536}
)
print(len(emb["data"][0]["embedding"]))  # 1536
```

### 视觉理解

```python
vision = client.ai.chat_vision(
    {
        "model": "gpt-4o",
        "image": "data:image/png;base64,iVBOR...",  # base64 或 URL
        "prompt": "描述这张图片",
    }
)
print(vision["description"])
```

### Mixture of Agents(MoA)

```python
moa = client.ai.chat_moa(
    {"messages": [{"role": "user", "content": "复杂问题"}], "presetId": "default"}
)
print(moa["output"])
```

### 模型管理

```python
# 列出所有模型
models = client.ai.list_models()

# 获取单个模型详情
model = client.ai.get_model("gpt-4")

# 按厂商列出模型
openai_models = client.ai.list_vendor_models("openai")

# MoA 预设
presets = client.ai.list_moa_presets()
preset = client.ai.create_moa_preset(
    {"name": "my-preset", "models": ["gpt-4", "claude-3-opus"], "strategy": "aggregate"}
)

# 用户自定义模型
user_models = client.ai.list_user_models()
new_model = client.ai.create_user_model(
    {
        "name": "my-gpt",
        "provider": "openai",
        "model": "gpt-4",
        "apiKey": "sk-xxx",
        "baseUrl": "https://api.openai.com/v1",
    }
)
client.ai.update_user_model(new_model["id"], {...})
client.ai.delete_user_model(new_model["id"])
```

## Agent 模块

```python
# 列表
agents = client.agents.list()
agent = client.agents.get("agent-123")

# 简单调用
call_resp = client.agents.call("agent-123", {"input": "帮我写一个 Hello World"})

# 高级执行(支持 PermissionGuard)
exec_resp = client.agents.execute(
    {
        "agentId": "agent-123",
        "input": "重构这段代码",
        "permissionMode": "accept-edits",  # read-only/accept-edits/accept-all/bypass-permissions/plan-only
        "maxIterations": 10,
    }
)
print(exec_resp["taskId"], exec_resp["status"], exec_resp["output"])

# 流式执行
for event in client.agents.execute_stream(
    {"agentId": "agent-123", "input": "逐行分析"}
):
    if event["type"] == "data":
        print(event["data"])

# 任务状态 / 取消
status = client.agents.get_task_status(exec_resp["taskId"])
client.agents.cancel_task(exec_resp["taskId"])

# 会话管理
sessions = client.agents.list_sessions()
client.agents.delete_session("session-123")

# Pipeline 编排
pipeline = client.agents.pipeline(
    {
        "steps": [
            {"agentId": "agent-a", "input": "步骤 1"},
            {"agentId": "agent-b", "input": "步骤 2(依赖步骤 1)", "dependsOn": [0]},
        ]
    }
)

# 并行执行
parallel = client.agents.parallel(
    {
        "tasks": [
            {"agentId": "agent-a", "input": "任务 A"},
            {"agentId": "agent-b", "input": "任务 B"},
        ]
    }
)

# 任务分解
decomposed = client.agents.decompose(
    {"agentId": "agent-123", "input": "构建一个电商网站"}
)
print(decomposed["subtasks"])
```

## 文件模块

### 简单上传

```python
# 读取文件 bytes 并上传
with open("example.pdf", "rb") as f:
    file_bytes = f.read()
file_obj = client.files.upload(file_bytes, "example.pdf")
```

### 分片上传(大文件 >50MB)

```python
import os
import base64

file_path = "large-video.mp4"
file_size = os.path.getsize(file_path)
chunk_size = 5 * 1024 * 1024  # 5MB

# 1. 初始化
init = client.files.upload_init(
    {
        "filename": "large-video.mp4",
        "size": file_size,
        "mimeType": "video/mp4",
        "chunkSize": chunk_size,
    }
)

# 2. 上传分片(可并行,这里用顺序示例)
with open(file_path, "rb") as f:
    for i in range(init["chunkCount"]):
        chunk = f.read(chunk_size)
        client.files.upload_chunk(
            {
                "uploadId": init["uploadId"],
                "index": i,
                "chunk": base64.b64encode(chunk).decode("ascii"),
            }
        )

# 3. 完成
result = client.files.upload_complete({"uploadId": init["uploadId"]})
print(result["fileId"])
```

### 文件操作

```python
files = client.files.list()
file_obj = client.files.get("file-123")
versions = client.files.get_versions("file-123")

# 下载内容(返回 bytes)
content = client.files.get_content("file-123")
with open("downloaded.pdf", "wb") as f:
    f.write(content)

client.files.delete("file-123")
```

## 多模态模块

```python
# 音频 TTS
speech = client.audio.speech(
    {"model": "tts-1", "input": "你好世界", "voice": "alloy", "responseFormat": "mp3"}
)

# 音频 ASR
transcription = client.audio.transcriptions(
    {"model": "whisper-1", "audio": "<base64-audio>"}
)

# 图像生成
image = client.images.generations(
    {"model": "dall-e-3", "prompt": "一只猫", "size": "1024x1024"}
)

# 视频生成
video = client.videos.generations(
    {"model": "sora-2", "prompt": "城市夜景", "duration": 5}
)

# 3D 生成
threed = client.threed.generations({"model": "triposr", "input": "<base64-image>"})

# 生成队列
job = client.generation.enqueue(
    {"type": "video", "payload": {"prompt": "..."}, "priority": 5}
)
status = client.generation.get_status(job["jobId"])
client.generation.cancel(job["jobId"])
```

## 知识库模块

```python
# 健康检查
health = client.knowledge.health()

# 文档入库
doc = client.knowledge.ingest_document(
    {
        "title": "IHUI-AI 简介",
        "content": "IHUI-AI 是一个全栈 AI 平台...",
        "chunkStrategy": "paragraph",
        "chunkSize": 500,
    }
)

# 语义搜索
results = client.knowledge.search({"query": "什么是 IHUI-AI?", "topK": 5, "threshold": 0.7})

# RAG 上下文
rag = client.knowledge.rag_context({"query": "平台架构", "injectSystemPrompt": True})

# 知识图谱
graph = client.knowledge.extract_graph(
    {"text": "IHUI-AI 由前端、后端、AI 服务组成..."}
)
client.knowledge.build_graph({"documentId": doc["documentId"]})
graph_data = client.knowledge.get_graph_data()
client.knowledge.clear_graph()
```

## MCP 工具模块

```python
# 工具列表与调用
tools = client.tools.list()
result = client.tools.call(
    {"name": "search-codebase", "arguments": {"query": "auth middleware", "directory": "/src"}}
)

# 资源 / 提示词
resources = client.tools.list_resources()
resource = client.tools.get_resource("file:///src/auth.ts")
prompts = client.tools.list_prompts()
prompt_result = client.tools.invoke_prompt(
    {"name": "code-review", "arguments": {"language": "typescript"}}
)

# 技能 / 斜杠命令
skills = client.tools.list_skills()
slash_commands = client.tools.list_slash_commands()
cmd_result = client.tools.invoke_slash_command(
    {"name": "/explain", "arguments": {"code": "const x = 1"}}
)

# 采样 / 人格
sampling = client.tools.sampling(
    {"messages": [{"role": "user", "content": "..."}], "maxTokens": 100}
)
personas = client.tools.list_personas()
persona = client.tools.get_persona("developer")

# 高级工具
search_result = client.tools.search_codebase({"query": "auth", "directory": "/src"})
web_result = client.tools.search_web({"query": "OpenAI GPT-5", "num": 10})
analyze = client.tools.analyze_code({"code": "...", "language": "ts"})
screenshot = client.tools.screenshot({"url": "https://example.com", "fullPage": True})
```

## 记忆模块

```python
# 保存记忆
client.memory.save({"content": "用户喜欢简洁的回答", "type": "procedural"})

# 召回 / 搜索
recalled = client.memory.recall({"query": "用户偏好"})
searched = client.memory.search({"query": "偏好", "topK": 5, "type": "procedural"})

# 分类记忆
working = client.memory.get_working()
episodic = client.memory.get_episodic()
procedural = client.memory.get_procedural()

# Dream 梦境
dream = client.memory.dream({"mode": "consolidate"})

# 遗忘
client.memory.forget({"memoryId": "mem-123"})
```

## 消息模块

```python
# 发布消息
client.messages.publish(
    {"channel": "updates", "content": "新版本发布", "recipients": ["user-1", "user-2"]}
)

# 订阅 Webhook
sub = client.messages.subscribe(
    {"channel": "updates", "callbackUrl": "https://example.com/webhook"}
)

# 取消订阅
client.messages.unsubscribe(sub["subscriptionId"])

# 消息状态
status = client.messages.get_status("msg-123")
```

## 用户模块

```python
# 当前用户 + 配额
me = client.user.me()
print(me["quota"]["hourlyUsed"], "/", me["quota"]["hourlyLimit"])

# 项目
projects = client.user.list_projects()
files = client.user.list_project_files("project-123")

# 工作流
workflow = client.user.get_workflow("wf-123")
instance = client.user.run_workflow({"workflowId": "wf-123", "inputs": {"key": "value"}})
coze = client.user.run_coze_workflow({"workflowId": "coze-123", "parameters": {...}})
n8n = client.user.run_n8n_workflow({"workflowId": "n8n-123", "data": {...}})

# 用量统计
usage = client.user.get_usage()
openai_usage = client.user.get_vendor_usage("openai")
```

## 异常层级

Python SDK 提供细分的异常类,便于精确捕获:

```
SdkError                    # 基类,携带 status / code / details
├── AuthenticationError     # 401 未授权(API Key 无效或缺失)
├── PermissionError         # 403 禁止访问(权限不足)
├── NotFoundError           # 404 资源不存在
├── QuotaExceededError      # 429 配额超限
├── ServerError             # 5xx 服务端错误
└── NetworkError            # 0 网络错误(无 HTTP 响应)
```

所有异常均携带以下属性:

| 属性 | 类型 | 说明 |
|------|------|------|
| `status` | int | HTTP 状态码(网络错误为 0) |
| `code` | str \| None | 细分错误码(如 `auth_invalid_api_key` / `quota_exceeded`) |
| `details` | dict \| None | 错误详情(来自响应体) |
| `args[0]` | str | 错误消息(等价于 `str(e)`) |

## 错误处理

```python
from ihui_ai.exceptions import (
    AuthenticationError,
    PermissionError,
    NotFoundError,
    QuotaExceededError,
    ServerError,
    NetworkError,
    SdkError,
)

try:
    resp = client.ai.completions({...})
except AuthenticationError as e:
    print(f"API Key 无效: {e}")
    # 重新签发密钥
except PermissionError as e:
    print(f"权限不足: {e}")
    # 检查 API Key 权限点
except NotFoundError as e:
    print(f"资源不存在: {e}")
except QuotaExceededError as e:
    print(f"配额超限: {e}")
    # 等待 Retry-After 后重试
except ServerError as e:
    print(f"服务端错误 {e.status}: {e}")
    # SDK 已自动重试 2 次,仍失败则放弃
except NetworkError as e:
    print(f"网络错误: {e}")
    # 检查网络连接 / baseUrl
except SdkError as e:
    print(f"未知错误 {e.status}: {e}")
```

详见 [错误处理](../api/error-handling.md)。

## 流式解析工具

SDK 导出 `parse_chat_stream_sync` / `parse_chat_stream_async` 和 `parse_agent_stream_sync` / `parse_agent_stream_async` 工具函数:

```python
from ihui_ai import parse_chat_stream_sync
import urllib.request
import json

req = urllib.request.Request(
    "http://localhost:3001/v1/chat/completions",
    data=json.dumps({"model": "gpt-4", "messages": [...], "stream": True}).encode(),
    headers={"Authorization": "Bearer ihui_xxx", "Content-Type": "application/json"},
    method="POST",
)
resp = urllib.request.urlopen(req, timeout=None)

def byte_iter():
    while True:
        chunk = resp.read(4096)
        if not chunk:
            break
        yield chunk

for parsed in parse_chat_stream_sync(byte_iter()):
    print(parsed["choices"][0]["delta"].get("content", ""), end="")
```

## 完整示例

```python
import os
from ihui_ai import create_client
from ihui_ai.exceptions import SdkError

client = create_client(
    {
        "apiKey": os.environ["IHUI_API_KEY"],
        "baseUrl": os.environ.get("IHUI_BASE_URL", "http://localhost:3001"),
    }
)

def main():
    try:
        # 1. 列出模型
        models = client.ai.list_models()
        print(f"可用模型数: {len(models['data'])}")

        # 2. 上传文件
        with open("doc.pdf", "rb") as f:
            file_bytes = f.read()
        file_obj = client.files.upload(file_bytes, "doc.pdf")
        print(f"文件 ID: {file_obj['id']}")

        # 3. 流式对话(引用文件)
        for chunk in client.ai.completions_stream(
            {
                "model": "gpt-4",
                "messages": [
                    {"role": "system", "content": "你是文档分析助手。"},
                    {"role": "user", "content": f"分析文件 {file_obj['id']}"},
                ],
            }
        ):
            content = chunk["choices"][0]["delta"].get("content", "")
            print(content, end="")

    except SdkError as e:
        print(f"\n错误 {e.status}: {e}")

if __name__ == "__main__":
    main()
```

## asyncio 完整示例

```python
import asyncio
import os
from ihui_ai import AsyncIhuiClient
from ihui_ai.exceptions import SdkError

async def main():
    client = AsyncIhuiClient({"apiKey": os.environ["IHUI_API_KEY"]})
    try:
        # 并发调用多个端点
        models, me = await asyncio.gather(
            client.ai.list_models(),
            client.user.me(),
        )
        print(f"模型数: {len(models['data'])}")
        print(f"配额: {me['quota']['hourlyUsed']}/{me['quota']['hourlyLimit']}")

        # 异步流式
        async for chunk in client.ai.completions_stream(
            {"model": "gpt-4", "messages": [{"role": "user", "content": "你好"}]}
        ):
            print(chunk["choices"][0]["delta"].get("content", ""), end="")
    except SdkError as e:
        print(f"\n错误 {e.status}: {e}")

asyncio.run(main())
```

---

*最后更新: 2026-07-22*
