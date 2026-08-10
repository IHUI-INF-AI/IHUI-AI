# ihui-sdk

IHUI AI Platform 官方 Python SDK(OpenAI 兼容)。

封装 105 个 `/v1/*` API 端点,提供同步(`requests`) + asyncio(`httpx`/纯 `asyncio`) 双版本客户端。

## 安装

```bash
pip install ihui-sdk
```

### 可选依赖

- **异步支持**: `pip install ihui-sdk[async]` 或手动 `pip install httpx>=0.27`。若未安装 httpx,SDK 自动回退到纯 asyncio 实现(无需额外依赖)。
- **开发工具**: `pip install ihui-sdk[dev]` (pytest, mypy, types-requests)。

## 快速开始

### 同步客户端(推荐)

```python
from ihui_sdk import create_client

client = create_client({"apiKey": "ihui_xxx"})

# 列出模型
models = client.ai.list_models()
print(models["data"][0]["id"])

# 聊天补全(非流式)
resp = client.ai.completions({
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "你好"}],
})
print(resp["choices"][0]["message"]["content"])

# 聊天补全(流式)
for chunk in client.ai.completions_stream({
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "讲个故事"}],
}):
    print(chunk["choices"][0]["delta"].get("content", ""), end="")
```

### 异步客户端

```python
import asyncio
from ihui_sdk import create_async_client

async def main():
    client = create_async_client({"apiKey": "ihui_xxx"})
    models = await client.ai.list_models()
    print(models["data"][0]["id"])

asyncio.run(main())
```

## 配置

`create_client()` / `create_async_client()` 接受字典配置:

| 键 | 说明 | 默认值 |
|---|---|---|
| `apiKey` | API Key(必需,格式 `ihui_xxx`) | — |
| `secret` | API Secret(可选) | — |
| `baseUrl` | 基础 URL | `http://localhost:8802` |
| `timeout` | 请求超时(秒) | `30` |
| `maxRetries` | 最大重试次数(网络错误和 5xx 自动重试) | `2` |

同时接受 Python 风格(snake_case)键名: `api_key` / `base_url` / `max_retries`。

## 模块概览

| 模块 | 属性名 | 端点数 | 说明 |
|---|---|---|---|
| AI 核心 | `.ai` | 13 | Chat Completions / Embeddings / Models / MoA |
| Agent | `.agents` | 12 | 列表 / 调用 / 高级执行 / Pipeline / 并行 / 分解 |
| 音频 | `.audio` | 8 | TTS / ASR / 语音对话 / 声纹 / 音乐 |
| 图像 | `.images` | 6 | 文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景 |
| 视频 | `.videos` | 3 | 生成 / 任务查询 / 编排 |
| 3D | `.threed` | 1 | 3D 模型生成 |
| 生成队列 | `.generation` | 3 | 入队 / 状态查询 / 取消 |
| 知识库 | `.knowledge` | 13 | 文档管理 / RAG 检索 / 知识图谱 |
| 工具 | `.tools` | 16 | MCP 工具 / 资源 / 提示词 / 技能 / 人格 / 搜索 / 截图 |
| 记忆 | `.memory` | 8 | 保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆 |
| 消息 | `.messages` | 4 | 发布 / 订阅 / 状态 |
| 文件 | `.files` | 9 | 列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传 |
| 用户 | `.user` | 9 | 用户信息 / 项目 / 工作流 / 用量统计 |

## 详细用法

### AI 核心 (`.ai`)

```python
# Chat Completions(非流式)
resp = client.ai.completions({
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.7,
})

# Chat Completions(流式)
for chunk in client.ai.completions_stream({
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": True,
}):
    print(chunk["choices"][0]["delta"].get("content", ""), end="")

# Embeddings
emb = client.ai.embeddings({
    "model": "text-embedding-3-small",
    "input": "Hello world",
})

# 视觉理解
vision = client.ai.chat_vision({
    "model": "gpt-4o",
    "image": "data:image/png;base64,...",
    "prompt": "描述这张图片",
})

# MoA(Mixture of Agents)
moa_resp = client.ai.chat_moa({
    "messages": [{"role": "user", "content": "Hello"}],
    "presetId": "preset_xxx",
})

# 模型列表
models = client.ai.list_models()
model_detail = client.ai.get_model("gpt-4o")
vendor_models = client.ai.list_vendor_models("openai")

# MoA 预设
presets = client.ai.list_moa_presets()
client.ai.create_moa_preset({"name": "my-preset", "models": ["gpt-4", "claude-3"], "strategy": "round_robin"})

# 用户自定义模型
user_models = client.ai.list_user_models()
client.ai.create_user_model({"name": "my-model", "provider": "openai", "model": "gpt-4", "apiKey": "sk-...", "baseUrl": "https://api.openai.com/v1"})
client.ai.update_user_model("model_id", {...})
client.ai.delete_user_model("model_id")
```

### Agent (`.agents`)

```python
# 列表 / 详情
agents = client.agents.list()
agent = client.agents.get("agent_id")

# 调用 Agent
resp = client.agents.call("agent_id", {"input": "帮我查天气", "sessionId": "sess_xxx"})

# 高级执行
exec_resp = client.agents.execute({
    "agentId": "agent_id",
    "input": "帮我写一封邮件",
    "permissionMode": "auto",
    "maxIterations": 10,
})

# 流式执行
for event in client.agents.execute_stream({
    "agentId": "agent_id",
    "input": "帮我查天气",
}):
    print(event["type"], event["data"])

# 任务管理
task_status = client.agents.get_task_status("task_id")
client.agents.cancel_task("task_id")

# 会话管理
sessions = client.agents.list_sessions()
client.agents.delete_session("session_id")

# Pipeline / 并行 / 分解
pipeline_resp = client.agents.pipeline({
    "steps": [{"agentId": "a1", "input": "step1", "dependsOn": []}],
})
parallel_resp = client.agents.parallel({
    "tasks": [{"agentId": "a1", "input": "task1"}, {"agentId": "a2", "input": "task2"}],
})
decompose_resp = client.agents.decompose({
    "agentId": "agent_id",
    "input": "帮我规划一次旅行",
})
```

### 音频 (`.audio`)

```python
# 音色列表
voices = client.audio.list_voices()

# TTS
speech = client.audio.speech({
    "model": "tts-1",
    "input": "你好世界",
    "voice": "alloy",
})

# ASR(语音转文字)
asr = client.audio.transcriptions({
    "model": "whisper-1",
    "audio": "base64_encoded_audio",
})

# 语音对话
chat = client.audio.chat({
    "audio": "base64_encoded_audio",
    "model": "gpt-4o-audio",
})

# 声纹管理
speakers = client.audio.list_speakers()
client.audio.register_speaker({"name": "张三", "audio": "base64_audio"})
match = client.audio.compare_speakers({"speakerId": "spk_xxx", "audio": "base64_audio"})

# 音乐生成
music = client.audio.music({"prompt": "欢快的钢琴曲", "duration": 30})
```

### 图像 (`.images`)

```python
# 文生图
img = client.images.generations({
    "model": "dall-e-3",
    "prompt": "一只可爱的猫",
    "n": 1,
    "size": "1024x1024",
})

# 图片编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景生成
client.images.edits({"model": "dall-e-2", "image": "base64_img", "prompt": "添加太阳镜"})
client.images.inpaint({"model": "dall-e-2", "image": "base64_img", "mask": "base64_mask", "prompt": "替换为草地"})
client.images.style_transfer({"model": "style-transfer", "image": "base64_img", "style": "印象派"})
client.images.virtual_try_on({"model": "try-on", "personImage": "base64", "garmentImage": "base64"})
client.images.background({"model": "bg-gen", "foreground": "base64", "prompt": "海滩背景"})
```

### 视频 / 3D / 生成队列

```python
# 视频生成
video = client.videos.generations({
    "model": "video-gen",
    "prompt": "一只奔跑的狗",
    "duration": 5,
})
task_status = client.videos.get_task(video["taskId"])
compose = client.videos.compose({
    "scenes": [{"text": "scene1", "duration": 3}],
})

# 3D 生成
threed = client.threed.generations({
    "model": "3d-gen",
    "input": "一个茶壶",
    "format": "glb",
})

# 生成队列
job = client.generation.enqueue({"type": "image", "payload": {"prompt": "..."}, "priority": 1})
status = client.generation.get_status(job["jobId"])
client.generation.cancel(job["jobId"])
```

### 知识库 (`.knowledge`)

```python
# 健康检查
health = client.knowledge.health()

# 文档管理
docs = client.knowledge.list_documents()
doc = client.knowledge.ingest_document({
    "title": "文档标题",
    "content": "文档内容...",
    "chunkStrategy": "paragraph",
})
detail = client.knowledge.get_document(doc["documentId"])
chunks = client.knowledge.get_document_chunks(doc["documentId"])
client.knowledge.delete_document(doc["documentId"])
client.knowledge.batch_delete_documents({"documentIds": ["id1", "id2"]})

# 语义搜索
results = client.knowledge.search({"query": "AI 技术", "topK": 5})

# RAG 上下文
ctx = client.knowledge.rag_context({"query": "什么是深度学习", "topK": 3})

# 知识图谱
graph = client.knowledge.extract_graph({"text": "爱因斯坦1879年出生于德国", "extractType": "both"})
client.knowledge.build_graph({"source": "text", "sourceType": "text"})
data = client.knowledge.get_graph_data()
client.knowledge.clear_graph()
```

### 工具 (`.tools`)

```python
# MCP 工具
tools = client.tools.list()
result = client.tools.call({"name": "calculator", "arguments": {"a": 1, "b": 2}})

# MCP 资源
resources = client.tools.list_resources()
resource = client.tools.get_resource("file:///config.json")

# MCP 提示词
prompts = client.tools.list_prompts()
prompt_result = client.tools.invoke_prompt({"name": "greeting", "arguments": {"name": "张三"}})

# 技能 / Slash 命令
skills = client.tools.list_skills()
cmds = client.tools.list_slash_commands()
client.tools.invoke_slash_command({"command": "/help", "args": {}})

# 模型采样
sampling = client.tools.sampling({
    "messages": [{"role": "user", "content": "Hello"}],
    "maxTokens": 100,
})

# 人格
personas = client.tools.list_personas()
persona = client.tools.get_persona("assistant")

# 代码搜索 / 网页搜索 / 代码分析 / 截图
client.tools.search_codebase({"query": "API key validation", "directory": "/src"})
client.tools.search_web({"query": "Python SDK", "num": 5})
client.tools.analyze_code({"code": "print('hello')", "language": "python", "analysis": "all"})
client.tools.screenshot({"url": "https://example.com", "width": 1280, "height": 720})
```

### 记忆 (`.memory`)

```python
# 保存记忆
client.memory.save({
    "content": "用户喜欢喝咖啡",
    "type": "semantic",
    "metadata": {"source": "chat"},
})

# 召回 / 搜索
memories = client.memory.recall()
results = client.memory.search({"query": "用户的饮食习惯", "topK": 5})

# Dream 梦境系统
dream = client.memory.dream({"mode": "consolidate"})

# 遗忘
client.memory.forget({"memoryId": "mem_xxx"})

# 分类记忆
working = client.memory.working()
episodic = client.memory.episodic()
procedural = client.memory.procedural()
```

### 消息 (`.messages`)

```python
# 发布消息
msg = client.messages.publish({
    "channel": "system",
    "content": "系统维护通知",
    "recipients": ["user_1", "user_2"],
})

# 订阅频道
sub = client.messages.subscribe({"channel": "system", "callbackUrl": "https://myapp.com/webhook"})

# 取消订阅
client.messages.unsubscribe(sub["subscriptionId"])

# 消息状态
status = client.messages.get_status(msg["messageId"])
```

### 文件 (`.files`)

```python
# 文件列表
files = client.files.list()

# 上传文件
file_info = client.files.upload(b"file content", filename="hello.txt")

# 文件详情 / 删除 / 内容 / 版本
detail = client.files.get("file_id")
client.files.delete("file_id")
content = client.files.get_content("file_id")
versions = client.files.get_versions("file_id")

# 分片上传
init = client.files.upload_init({"filename": "large.zip", "size": 10485760, "chunkSize": 1048576})
client.files.upload_chunk({"uploadId": init["uploadId"], "index": 0, "chunk": "base64_chunk"})
result = client.files.upload_complete({"uploadId": init["uploadId"]})
```

### 用户 / 工作流 / 统计 (`.user`)

```python
# 当前用户信息
me = client.user.me()
print(me["username"], me["quota"])

# 项目
projects = client.user.list_projects()
project_files = client.user.list_project_files("project_id")

# 工作流
workflow = client.user.get_workflow("workflow_id")
result = client.user.run_workflow({"workflowId": "wf_xxx", "inputs": {"text": "hello"}})
client.user.run_coze_workflow({"workflowId": "coze_wf", "parameters": {}})
client.user.run_n8n_workflow({"workflowId": "n8n_wf", "data": {}})

# 用量统计
usage = client.user.get_usage()
vendor_usage = client.user.get_vendor_usage("openai")
```

## 错误处理

SDK 定义统一的异常层级:

```python
from ihui_sdk import SdkError, AuthenticationError, PermissionError, NotFoundError, QuotaExceededError, ServerError, NetworkError

try:
    models = client.ai.list_models()
except AuthenticationError as e:
    print(f"认证失败(status={e.status}, code={e.code}): {e}")
except PermissionError as e:
    print(f"权限不足: {e}")
except NotFoundError as e:
    print(f"资源不存在: {e}")
except QuotaExceededError as e:
    print(f"配额超限: {e}")
except ServerError as e:
    print(f"服务端错误: {e}")
except NetworkError as e:
    print(f"网络错误: {e}")
except SdkError as e:
    print(f"其他错误(status={e.status}): {e}")
```

## 高阶用法

### 自定义 Base URL

```python
client = create_client({
    "apiKey": "ihui_xxx",
    "baseUrl": "https://api.ihui.ai",
})
```

### 禁用重试

```python
client = create_client({
    "apiKey": "ihui_xxx",
    "maxRetries": 0,
})
```

### 流式解析器独立使用

```python
from ihui_sdk import parse_chat_stream_sync, parse_agent_stream_sync

# 直接使用 requests 发起流式请求
import requests
resp = requests.post("https://api.ihui.ai/v1/chat/completions", json={...}, stream=True)
for chunk in parse_chat_stream_sync(resp.iter_content(chunk_size=4096)):
    print(chunk["choices"][0]["delta"].get("content", ""), end="")
```

## 开发

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行测试
pytest

# 类型检查
mypy ihui_sdk
```

## 许可

MIT