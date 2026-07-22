# ihui-ai — IHUI AI Platform Python SDK

> 完整封装 **105 个** `/v1/*` 对外开放 API 端点,提供同步 + asyncio 双版本客户端,**零运行时依赖**(纯 stdlib)。

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 特性

- **105 端点全覆盖**:13 个功能模块,一行代码调用所有 AI 功能
- **同步 + asyncio 双版本**:`IhuiClient`(同步) + `AsyncIhuiClient`(asyncio)
- **零运行时依赖**:纯 Python stdlib(urllib / asyncio / json / typing),不依赖 requests/httpx/aiohttp
- **流式响应**:SSE 解析器,支持 chat 流式 + Agent 执行流式
- **自动重试**:网络错误 + 5xx 指数退避重试(0.5s / 1.0s),429 不重试
- **完整类型**:TypedDict 类型注解,IDE 自动补全 + mypy 检查
- **Python 3.10+**:使用现代特性(TypedDict、ParamSpec、TypeAlias)

## 安装

```bash
pip install ihui-ai
```

或从源码安装:

```bash
cd packages/sdk/python
pip install -e .
```

## 快速开始

### 1. 获取 API Key

在 IHUI-AI 平台的「设置 → API Keys」页面创建 API Key,格式为 `ihui_xxx`。

### 2. 同步客户端

```python
from ihui_ai import create_client

client = create_client({
    "api_key": "ihui_xxx",
    "base_url": "http://localhost:3001",  # 可选,默认 localhost:3001
})

# 模型列表
models = client.ai.list_models()
print(models["data"][0]["id"])

# Chat 对话
resp = client.ai.completions({
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "你好"}],
})
print(resp["choices"][0]["message"]["content"])
```

### 3. asyncio 客户端

```python
import asyncio
from ihui_ai import AsyncIhuiClient

async def main():
    client = AsyncIhuiClient({"api_key": "ihui_xxx"})

    # 并发调用
    models, me = await asyncio.gather(
        client.ai.list_models(),
        client.user.me(),
    )
    print(f"用户: {me['username']}, 模型数: {len(models['data'])}")

asyncio.run(main())
```

## 模块总览

| 模块 | 端点数 | 说明 |
|------|--------|------|
| `client.ai` | 13 | Chat / Embeddings / Models / MoA |
| `client.agents` | 12 | Agent 列表 / 调用 / 高级执行 / Pipeline / 并行 |
| `client.audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| `client.images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| `client.videos` | 3 | 生成 / 任务查询 / 编排 |
| `client.threed` | 1 | 3D 模型生成 |
| `client.generation` | 3 | 生成队列:入队 / 状态 / 取消 |
| `client.knowledge` | 13 | 知识库 / RAG / 知识图谱 |
| `client.tools` | 16 | MCP 工具 / 技能 / 人格 / 代码搜索 / 截图 |
| `client.memory` | 8 | 记忆:保存 / 召回 / 搜索 / Dream |
| `client.messages` | 4 | 消息:发布 / 订阅 / 状态 |
| `client.files` | 9 | 文件:列表 / 上传 / 详情 / 删除 / 内容 / 版本 |
| `client.user` | 9 | 用户 / 工作区 / 工作流 / 统计 |

## 使用示例

### AI 核心 — Chat / Embeddings / Models

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 模型列表
models = client.ai.list_models()
for model in models["data"]:
    print(f"  {model['id']} ({model['ownedBy']})")

# 模型详情
model = client.ai.get_model("gpt-4")
print(f"上下文窗口: {model.get('contextWindow', 'N/A')}")

# Chat 对话
resp = client.ai.completions({
    "model": "gpt-4",
    "messages": [
        {"role": "system", "content": "你是一个有帮助的助手"},
        {"role": "user", "content": "解释量子计算"},
    ],
    "temperature": 0.7,
    "maxTokens": 1000,
})
print(resp["choices"][0]["message"]["content"])

# Embeddings
emb = client.ai.embeddings({
    "model": "text-embedding-3-small",
    "input": "Hello world",
})
print(f"维度: {len(emb['data'][0]['embedding'])}")

# 视觉理解
vision = client.ai.chat_vision({
    "model": "gpt-4-vision-preview",
    "image": "data:image/png;base64,iVBOR...",  # base64 或 URL
    "prompt": "描述这张图片",
})

# MoA (Mixture of Agents)
moa = client.ai.chat_moa({
    "messages": [{"role": "user", "content": "复杂问题"}],
})

# 用户自定义模型 CRUD
client.ai.create_user_model({
    "name": "我的 GPT-4",
    "provider": "openai",
    "model": "gpt-4",
    "apiKey": "sk-xxx",
})
```

### 流式响应

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# Chat 流式
print("AI: ", end="", flush=True)
for chunk in client.ai.completions_stream({
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "写一首诗"}],
}):
    delta = chunk["choices"][0]["delta"].get("content", "")
    print(delta, end="", flush=True)
print()  # 换行

# Agent 执行流式
for event in client.agents.execute_stream({
    "agentId": "agent-xxx",
    "input": "帮我分析这段代码",
    "permissionMode": "read-only",
}):
    if event["type"] == "data":
        print(f"[数据] {event['data']}")
    elif event["type"] == "event":
        print(f"[事件] {event['data']['name']}")
```

### asyncio 流式

```python
import asyncio
from ihui_ai import AsyncIhuiClient

async def main():
    client = AsyncIhuiClient({"api_key": "ihui_xxx"})

    async for chunk in client.ai.completions_stream({
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "你好"}],
    }):
        print(chunk["choices"][0]["delta"].get("content", ""), end="", flush=True)

asyncio.run(main())
```

### Agent 高级执行

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# Agent 列表
agents = client.agents.list()
for agent in agents["data"]:
    print(f"  {agent['name']}: {agent['description']}")

# 调用 Agent
result = client.agents.call("agent-xxx", {
    "input": "帮我写一个 Python 函数",
    "sessionId": "session-xxx",  # 可选,多轮对话
})

# 高级执行(带权限控制)
exec_result = client.agents.execute({
    "agentId": "agent-xxx",
    "input": "分析项目架构",
    "permissionMode": "read-only",  # read-only / accept-edits / accept-all / bypass-permissions
    "maxIterations": 10,
})

# 查询任务状态
status = client.agents.get_task_status(exec_result["taskId"])
print(f"状态: {status['status']}, 进度: {status.get('progress', 0)}")

# Pipeline 编排
pipeline = client.agents.pipeline({
    "steps": [
        {"agentId": "agent-1", "input": "步骤1"},
        {"agentId": "agent-2", "input": "步骤2", "dependsOn": [0]},
    ],
})

# 并行执行
parallel = client.agents.parallel({
    "tasks": [
        {"agentId": "agent-1", "input": "任务A"},
        {"agentId": "agent-2", "input": "任务B"},
    ],
})
```

### 知识库 / RAG

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 健康检查
health = client.knowledge.health()
print(f"文档: {health['documents']}, 分块: {health['chunks']}")

# 文档入库
doc = client.knowledge.ingest_document({
    "title": "产品手册",
    "content": "这是产品手册的内容...",
    "chunkStrategy": "paragraph",
    "chunkSize": 500,
})

# 语义搜索
results = client.knowledge.search({
    "query": "如何使用产品?",
    "topK": 5,
    "threshold": 0.7,
})
for result in results["data"]:
    print(f"  [{result['score']:.2f}] {result['content'][:100]}")

# RAG 上下文检索
rag = client.knowledge.rag_context({
    "query": "产品价格",
    "topK": 3,
    "injectSystemPrompt": True,
})

# 知识图谱
graph = client.knowledge.extract_graph({
    "text": "张三是李四的经理,李四在销售部门工作",
    "extractType": "both",
})
print(f"实体: {len(graph['entities'])}, 关系: {len(graph['relations'])}")
```

### 文件上传(multipart)

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 简单上传
with open("document.pdf", "rb") as f:
    file_info = client.files.upload(f.read(), "document.pdf")
print(f"文件 ID: {file_info['id']}")

# 分片上传(大文件)
init = client.files.upload_init({
    "filename": "large-video.mp4",
    "size": 1073741824,  # 1GB
    "mimeType": "video/mp4",
    "chunkSize": 5242880,  # 5MB
})

import base64
for i in range(init["chunkCount"]):
    chunk_data = ...  # 读取第 i 个分片
    client.files.upload_chunk({
        "uploadId": init["uploadId"],
        "index": i,
        "chunk": base64.b64encode(chunk_data).decode(),
    })

result = client.files.upload_complete({"uploadId": init["uploadId"]})
print(f"上传完成,文件 ID: {result['fileId']}")
```

### 音频(TTS / ASR)

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 文字转语音
speech = client.audio.speech({
    "model": "tts-1",
    "input": "你好,世界!",
    "voice": "alloy",
    "responseFormat": "mp3",
})
# speech["audio"] 是 base64 编码的音频

# 语音转文字
import base64
with open("audio.mp3", "rb") as f:
    audio_b64 = base64.b64encode(f.read()).decode()

transcription = client.audio.transcriptions({
    "model": "whisper-1",
    "audio": audio_b64,
    "language": "zh",
})
print(f"识别结果: {transcription['text']}")
```

### MCP 工具调用

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 工具列表
tools = client.tools.list()
for tool in tools["data"]:
    print(f"  {tool['name']}: {tool['description']}")

# 调用工具
result = client.tools.call({
    "name": "calculator",
    "arguments": {"expression": "2 + 2"},
})
print(f"结果: {result['result']}")

# 代码库搜索
results = client.tools.search_codebase({
    "query": "用户登录逻辑",
    "directory": "/path/to/project",
})

# 网页搜索
web_results = client.tools.search_web({
    "query": "Python asyncio 教程",
    "num": 5,
})

# 网页截图
screenshot = client.tools.screenshot({
    "url": "https://example.com",
    "fullPage": True,
    "width": 1920,
})
# screenshot["image"] 是 base64 编码的图片
```

### 记忆系统

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 保存记忆
client.memory.save({
    "content": "用户偏好使用 Python 3.12",
    "type": "procedural",
})

# 召回记忆
memories = client.memory.recall()
for mem in memories["data"]:
    print(f"  [{mem['type']}] {mem['content']}")

# 语义搜索
results = client.memory.search({
    "query": "用户偏好",
    "topK": 5,
})

# Dream 梦境系统(记忆整合)
dream = client.memory.dream({"mode": "consolidate"})
print(f"新增记忆: {dream['newMemories']}, 洞察: {dream['insights']}")
```

### 用户 / 统计

```python
from ihui_ai import create_client

client = create_client({"api_key": "ihui_xxx"})

# 当前用户信息 + 配额
me = client.user.me()
print(f"用户: {me['username']}")
print(f"配额: {me['quota']['hourlyUsed']}/{me['quota']['hourlyLimit']}/小时")

# 用量统计
usage = client.user.get_usage()
print(f"总请求: {usage['totalRequests']}, Token: {usage['tokensUsed']}")

# 厂商用量
vendor_usage = client.user.get_vendor_usage("openai")
print(f"OpenAI: {vendor_usage['requests']} 请求, {vendor_usage['tokens']} tokens")
```

## 错误处理

SDK 提供统一的异常层级,根据 HTTP 状态码自动选择异常子类:

```python
from ihui_ai import create_client
from ihui_ai import (
    SdkError,
    AuthenticationError,   # 401
    PermissionError,        # 403
    NotFoundError,          # 404
    QuotaExceededError,     # 429
    ServerError,            # 5xx
    NetworkError,           # 网络错误(无 HTTP 响应)
)

client = create_client({"api_key": "ihui_xxx"})

try:
    result = client.ai.completions({"model": "gpt-4", "messages": [...]})
except AuthenticationError as e:
    print(f"API Key 无效: {e}")
    print(f"状态码: {e.status}, 错误码: {e.code}")
except PermissionError as e:
    print(f"权限不足,需要对应的权限点: {e}")
except QuotaExceededError as e:
    print(f"配额超限,请稍后重试: {e}")
except NotFoundError as e:
    print(f"资源不存在: {e}")
except ServerError as e:
    print(f"服务器错误({e.status}),已自动重试 {client._base._max_retries} 次: {e}")
except NetworkError as e:
    print(f"网络错误,请检查连接: {e}")
except SdkError as e:
    print(f"未知错误({e.status}): {e}")
    if e.details:
        print(f"详情: {e.details}")
```

## 配置选项

```python
from ihui_ai import create_client

client = create_client({
    # 必需
    "api_key": "ihui_xxx",           # API Key

    # 可选
    "secret": "secret_xxx",          # API Secret(创建/轮换时返回)
    "base_url": "https://api.ihui.ai",  # 基础 URL,默认 http://localhost:3001
    "timeout": 60,                   # 请求超时(秒),默认 30
    "max_retries": 3,                # 最大重试次数,默认 2
})

# 也支持 camelCase 键(TS 兼容)
client = create_client({
    "apiKey": "ihui_xxx",
    "baseUrl": "https://api.ihui.ai",
    "maxRetries": 3,
})
```

## 鉴权

每个请求自动注入以下 Header:

```
Authorization: Bearer ihui_xxx
X-Api-Secret: secret_xxx  # 如果配置了 secret
```

支持两种鉴权方式:
- `Authorization: Bearer <API_KEY>`(默认)
- `X-Api-Key: <API_KEY>`(备选,SDK 内部使用 Bearer)

## 重试机制

- **自动重试**:网络错误 + 5xx 状态码
- **退避策略**:指数退避(0.5s → 1.0s)
- **不重试**:429(配额超限)、4xx(客户端错误)
- **流式请求**:不重试(无法安全回放流)

## 项目结构

```
packages/sdk/python/
├── pyproject.toml           # 包配置(setuptools)
├── README.md                # 本文件
└── ihui_ai/
    ├── __init__.py          # 包入口,导出公共 API
    ├── base.py              # 同步 BaseClient(urllib)
    ├── async_base.py        # asyncio AsyncBaseClient(asyncio streams)
    ├── client.py            # IhuiClient 同步工厂
    ├── async_client.py      # AsyncIhuiClient asyncio 工厂
    ├── streaming.py         # SSE 流式响应解析器(同步 + async)
    ├── exceptions.py        # 异常层级
    ├── types.py             # TypedDict 类型定义
    └── modules/
        ├── __init__.py      # 模块包入口
        ├── ai.py            # AI 核心(13 端点)
        ├── agents.py        # Agent(12 端点)
        ├── audio.py         # 音频(8 端点)
        ├── images.py        # 图像(6 端点)
        ├── videos.py        # 视频(3 端点)
        ├── threed.py        # 3D(1 端点)
        ├── generation.py    # 生成队列(3 端点)
        ├── knowledge.py     # 知识库(13 端点)
        ├── tools.py         # MCP 工具(16 端点)
        ├── memory.py        # 记忆(8 端点)
        ├── messages.py      # 消息(4 端点)
        ├── files.py         # 文件(9 端点)
        └── user.py          # 用户/统计(9 端点)
```

## License

MIT
