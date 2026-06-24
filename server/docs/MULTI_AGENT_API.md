# 多智能体协作系统 API 文档

> 模块: Multi-Agent Crew + Knowledge RAG
> 基础路径: `/api/v1`
> 前端界面: `/crew`

## 一、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 /crew (crew.html)                   │
│   智能体协作 Tab  │  知识库管理 Tab  │  历史会话 Tab          │
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      FastAPI 路由层                          │
│   /api/v1/crew/* (13 端点)   │   /api/v1/knowledge/* (10 端点)│
└──────────┬──────────────────┬──────────────────┬────────────┘
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────────┐  ┌──────────────────────────────────┐
│  CrewOrchestrator   │  │       KnowledgeService           │
│  (编排引擎)          │  │  ingest / search / rag_context   │
│  任务调度 + 角色流转  │  │  list / delete / batch_delete    │
└──────────┬──────────┘  └──────────────┬───────────────────┘
           │                            │
           ▼                            ▼
┌─────────────────────┐  ┌──────────────────────────────────┐
│ CrewAgentRegistry   │  │   DashScope Embedding (向量)      │
│ 5 角色: P/R/E/V/R   │  │   SQLite/PG (文档+切片存储)       │
│ + CrewLLMAdapter    │  └──────────────────────────────────┘
│ + CrewTools (RAG)   │
└─────────────────────┘
```

## 二、智能体角色

系统内置 5 个标准角色，按固定流水线顺序执行:

| 顺序 | 角色 | 代号 | 职责 |
|------|------|------|------|
| 1 | 规划师 | planner | 拆解用户需求，制定执行计划，拆分任务步骤 |
| 2 | 研究员 | researcher | 调用知识库检索、信息收集，补充任务所需素材 |
| 3 | 执行员 | executor | 核心执行角色，生成具体结果、完成核心任务 |
| 4 | 评审员 | reviewer | 校验执行结果，提出修改意见，判断是否达标 |
| 5 | 报告员 | reporter | 汇总所有步骤结果，整理为最终输出报告 |

执行顺序通过 `role_order` 权重映射 + prompt 约束双重机制保证: planner 首位、reporter 末位。

## 三、Crew 模块 API (13 端点)

### 1. GET `/api/v1/crew/health` - 健康检查

**响应**:
```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "crewai_available": false,
    "roles": 5
  },
  "msg": "ok"
}
```

### 2. GET `/api/v1/crew/agents` - 列出智能体角色

**响应**: `data` 为角色数组，每项含 `role`、`goal`、`backstory`、`role_order`。

### 3. GET `/api/v1/crew/models` - 列出可用模型

**响应**: `data` 为模型数组，每项含 `model_id`、`name`、`provider`。

### 4. POST `/api/v1/crew/sessions` - 创建会话

**请求体**:
```json
{
  "user_id": "web_user",
  "input_message": "分析 AI 在教育领域的应用",
  "title": "可选标题",
  "config": {
    "model_id": "glm-4-flash",
    "collection_name": "default",
    "max_retries": 2
  }
}
```

**响应**: `{ "code": 0, "data": { "session_id": "uuid" } }`

### 5. GET `/api/v1/crew/sessions` - 列出会话

**查询参数**: `user_id` (可选)、`limit` (默认 20)

### 6. GET `/api/v1/crew/sessions/{session_id}` - 会话详情

**响应**: 含 `id`、`title`、`status`、`input_message`、`output_message`、`created_at`。

### 7. POST `/api/v1/crew/sessions/{session_id}/execute` - 执行会话

**请求体** (可选): `{ "config": { "model_id": "..." } }`

### 8. POST `/api/v1/crew/sessions/{session_id}/cancel` - 取消会话

### 9. GET `/api/v1/crew/sessions/{session_id}/tasks` - 任务列表

**响应**: 任务数组，每项含 `agent_role`、`description`、`status`、`output_data`、`error_message`。

### 10. GET `/api/v1/crew/sessions/{session_id}/messages` - 消息日志

**响应**: 消息数组，每项含 `from_role`、`to_role`、`content`、`created_at`。

### 11. WS `/api/v1/crew/sessions/{session_id}/ws` - WebSocket 流式

连接后逐步推送事件:
- `{"type": "start", "content": "..."}`
- `{"type": "plan", "tasks": [...]}`
- `{"type": "task_start", "role": "planner", "content": "..."}`
- `{"type": "task_complete", "role": "planner", "content": "..."}`
- `{"type": "complete", "content": "最终报告"}`
- `{"type": "error", "content": "错误信息"}`

### 12. POST `/api/v1/crew/sessions/{session_id}/stream` - SSE 流式

返回 `text/event-stream`，每行格式: `data: {事件JSON}\n\n`

事件类型同 WebSocket。

### 13. POST `/api/v1/crew/run` - 一站式创建并执行

**请求体**: 同创建会话

**响应**:
```json
{
  "code": 0,
  "data": {
    "session_id": "uuid",
    "result": { "success": true, "output": "...", "tasks": [...] }
  }
}
```

## 四、Knowledge 模块 API (10 端点)

### 1. GET `/api/v1/knowledge/health` - 健康检查

### 2. POST `/api/v1/knowledge/ingest` - 纯文本入库

**请求体**:
```json
{
  "owner_uuid": "web_user",
  "title": "文档标题",
  "text": "需要入库的文本内容",
  "collection_name": "default"
}
```

**响应**: `{ "code": 0, "data": { "chunk_count": 5 } }`

### 3. POST `/api/v1/knowledge/ingest/file` - 文件上传入库

**请求体** (multipart/form-data):
- `owner_uuid`: 所有者 UUID
- `title`: 文档标题 (可选，留空用文件名)
- `collection_name`: 集合名 (默认 default)
- `file`: 文件 (.txt/.md/.json/.csv)

**响应**: `{ "code": 0, "data": { "chunk_count": 5, "filename": "doc.txt", "title": "doc" } }`

### 4. POST `/api/v1/knowledge/search` - 语义检索

**请求体**:
```json
{
  "query": "查询语句",
  "collection_name": "default",
  "top_k": 5,
  "score_threshold": 0.0,
  "owner_uuid": "web_user"
}
```

**响应**: 切片数组，每项含 `id`、`doc_id`、`content`、`score`、`chunk_index`，按 `score` 降序。

### 5. POST `/api/v1/knowledge/rag-context` - 生成 RAG 上下文

**请求体**: 同语义检索 (无 `score_threshold`)

**响应**:
```json
{
  "code": 0,
  "data": {
    "context": "[1] 切片1\n\n[2] 切片2",
    "has_result": true
  }
}
```

### 6. GET `/api/v1/knowledge/docs` - 文档列表

**查询参数**: `owner_uuid` (必填)

**响应**: 文档数组，每项含 `id`、`title`、`source_type`、`chunk_count`、`created_at`。

### 7. GET `/api/v1/knowledge/docs/{doc_id}` - 文档详情

**查询参数**: `owner_uuid` (必填)

### 8. GET `/api/v1/knowledge/docs/{doc_id}/chunks` - 文档切片

**查询参数**: `owner_uuid` (必填)、`limit` (默认 10)

### 9. DELETE `/api/v1/knowledge/docs/{doc_id}` - 删除文档

**查询参数**: `owner_uuid` (必填)

软删除文档 + 清理切片。

### 10. POST `/api/v1/knowledge/docs/batch-delete` - 批量删除

**请求体**:
```json
{ "doc_ids": [1, 2, 3], "owner_uuid": "web_user" }
```

**响应**: `{ "code": 0, "data": { "success": [1,2], "failed": [3] } }`

## 五、执行流程

```
用户输入任务
     │
     ▼
[创建会话] POST /crew/sessions
     │
     ▼
[流式执行] POST /crew/sessions/{id}/stream
     │
     ▼
┌─ planner (规划师) ──→ 任务分解
│      │
│      ▼
├─ researcher (研究员) ──→ RAG 检索 (可选)
│      │
│      ▼
├─ executor (执行员) ──→ 核心生成
│      │
│      ▼
├─ reviewer (评审员) ──→ 结果校验
│      │
│      ▼
└─ reporter (报告员) ──→ 汇总输出
     │
     ▼
[complete 事件] 推送最终报告
```

## 六、配置说明

### 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `DASHSCOPE_API_KEY` | DashScope Embedding 密钥 (知识库向量化) | 空 (退化为关键词匹配) |
| `ZHIPU_API_KEY` | 智谱 AI 密钥 (LLM 调用) | 从 `zhs_ai_model_info_unify` 表读取 |

### 会话 config 参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `model_id` | string | LLM 模型 ID，默认 GLM-4-Flash |
| `collection_name` | string | 知识库集合名，留空不使用 RAG |
| `max_retries` | int | 单步任务最大重试次数，默认 2 |

## 七、文件结构

```
server/
├── app/
│   ├── api/v1/
│   │   ├── crew/__init__.py          # Crew API 路由 (13 端点)
│   │   ├── knowledge/__init__.py     # Knowledge API 路由 (10 端点)
│   │   └── router.py                 # 全局路由注册
│   ├── services/
│   │   ├── crew_orchestrator.py      # 编排引擎
│   │   ├── crew_agent_registry.py    # 角色注册中心
│   │   ├── crew_llm_adapter.py       # LLM 适配器
│   │   ├── crew_tools.py             # 工具集 (RAG/Coze/LLM)
│   │   └── knowledge_service.py      # 知识库服务
│   ├── models/
│   │   ├── crew_models.py            # CrewSession/Task/Message
│   │   └── knowledge_models.py       # KnowledgeDoc/Chunk
│   └── static/
│       └── crew.html                 # 前端三标签页界面
└── scripts/
    ├── migrate_crew_tables.py        # crew 表迁移
    └── init_llm_model.py             # LLM 模型初始化
```

## 八、运行模式

当前采用**简化顺序执行模式**: 通过 LLM 多轮调用模拟多角色协作流程，功能完整可直接使用。

CrewAI 完整编排模式因 `chromadb` 依赖冲突暂未启用，核心逻辑已在 `crew_orchestrator.py` 预留 (`_CREWAI_AVAILABLE` 检测)，后续解决依赖后可切换为原生并行编排。

## 九、数据表

### zhs_crew_session
| 字段 | 类型 | 说明 |
|------|------|------|
| id | varchar(36) | 会话 UUID |
| user_id | varchar(64) | 用户 ID |
| title | varchar(200) | 标题 |
| status | varchar(20) | pending/running/completed/failed/cancelled |
| input_message | text | 输入 |
| output_message | text | 最终输出 |
| config | text | JSON 配置 |

### zhs_crew_task
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 自增 ID |
| session_id | varchar(36) | 关联会话 |
| agent_role | varchar(50) | 角色代号 |
| description | text | 任务描述 |
| status | varchar(20) | pending/running/completed/failed |
| output_data | text | 输出 |
| error_message | text | 错误 |
| role_order | int | 执行顺序 |

### zhs_crew_message
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 自增 ID |
| session_id | varchar(36) | 关联会话 |
| from_role | varchar(50) | 发送角色 |
| to_role | varchar(50) | 接收角色 |
| content | text | 消息内容 |

### zhs_knowledge_doc
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 自增 ID |
| owner_uuid | varchar(64) | 所有者 |
| collection_name | varchar(100) | 集合名 |
| title | varchar(255) | 标题 |
| source_type | varchar(20) | text/file/url |
| chunk_count | int | 切片数 |
| status | varchar(20) | active/deleted |

### zhs_knowledge_chunk
| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 自增 ID |
| doc_id | int | 关联文档 |
| collection_name | varchar(100) | 集合名 |
| owner_uuid | varchar(64) | 所有者 |
| chunk_index | int | 切片序号 |
| content | text | 切片内容 |
| embedding | text | 向量 JSON |
