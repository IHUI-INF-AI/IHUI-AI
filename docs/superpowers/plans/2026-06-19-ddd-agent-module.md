# DDD Agent 模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在 `app/domains/agent/` 下实现 DDD Agent 模块，覆盖 CreateAgent/UpdateAgent/ActivateAgent/DeactivateAgent/ArchiveAgent 命令，GetAgent/ListAgents/SearchAgents/GetAgentStats/ListAgentActivities 查询，并通过 API 路由暴露。

**架构：** 共存桥接模式——DDD 层内部调用已有 SQLAlchemy Agent 模型，通过 CommandBus/QueryBus 暴露新入口，逐步接管 `app/api/v2_agents.py`。

**Tech Stack:** Python, Domain-Driven Design, CQRS (CommandBus/QueryBus), FastAPI

---

## 文件结构

```
app/domains/agent/
├── __init__.py          # 导出 AgentRepository / AgentStatus / Agent
├── entities.py          # AgentStatus enum + Agent AggregateRoot
├── events.py           # AgentCreatedEvent / AgentActivatedEvent / AgentDeactivatedEvent
├── repository.py       # AgentRepository 接口 + InMemoryAgentRepository
├── commands.py         # CreateAgent / UpdateAgent / ActivateAgent / DeactivateAgent / ArchiveAgent
├── queries.py          # GetAgent / ListAgents / SearchAgents / GetAgentStats / ListAgentActivities
└── event_handlers.py  # on_agent_created / on_agent_activated / on_agent_deactivated + register_agent_event_handlers()

app/api/p30/
└── agent.py            # API 路由（/api/p30/agents）

tests/
└── domains/
    └── test_agent/
        ├── __init__.py
        ├── test_entities.py
        ├── test_commands.py
        ├── test_queries.py
        └── test_event_handlers.py
```

---

## Task 1: 创建 agent 目录骨架

**Files:**
- Create: `app/domains/agent/__init__.py`

- [ ] **Step 1: 创建目录和 __init__.py**

```python
"""DDD Agent 模块.

状态机: DRAFT -> ACTIVE -> INACTIVE -> ARCHIVED
"""

from app.domains.agent.entities import Agent, AgentStatus
from app.domains.agent.repository import AgentRepository
from app.domains.agent.events import (
    AgentActivatedEvent,
    AgentCreatedEvent,
    AgentDeactivatedEvent,
)

__all__ = [
    "Agent",
    "AgentStatus",
    "AgentRepository",
    "AgentCreatedEvent",
    "AgentActivatedEvent",
    "AgentDeactivatedEvent",
]
```

- [ ] **Step 2: Commit**

```bash
git add app/domains/agent/__init__.py
git commit -m "feat(p30-agent): init agent DDD module skeleton"
```

---

## Task 2: 实现 entities.py

**Files:**
- Create: `app/domains/agent/entities.py`
- Test: `tests/domains/test_agent/test_entities.py`

- [ ] **Step 1: 写测试**

```python
import pytest
from datetime import datetime
from app.domains.agent.entities import Agent, AgentStatus


class TestAgentStatus:
    def test_enum_values(self):
        assert AgentStatus.DRAFT.value == "draft"
        assert AgentStatus.ACTIVE.value == "active"
        assert AgentStatus.INACTIVE.value == "inactive"
        assert AgentStatus.ARCHIVED.value == "archived"


class TestAgent:
    def test_create_agent_draft(self):
        agent = Agent(
            agent_id="agent-001",
            name="测试智能体",
            agent_type="text",
            config={},
        )
        assert agent.agent_id == "agent-001"
        assert agent.name == "测试智能体"
        assert agent.status == AgentStatus.DRAFT
        assert agent.config == {}

    def test_activate_transition(self):
        agent = Agent(agent_id="a1", name="A", agent_type="text", config={})
        assert agent.status == AgentStatus.DRAFT
        agent.activate()
        assert agent.status == AgentStatus.ACTIVE

    def test_deactivate_from_active(self):
        agent = Agent(agent_id="a1", name="A", agent_type="text", config={})
        agent.activate()
        agent.deactivate()
        assert agent.status == AgentStatus.INACTIVE

    def test_archive_from_inactive(self):
        agent = Agent(agent_id="a1", name="A", agent_type="text", config={})
        agent.activate()
        agent.deactivate()
        agent.archive()
        assert agent.status == AgentStatus.ARCHIVED

    def test_invalid_activate_from_archived_raises(self):
        agent = Agent(agent_id="a1", name="A", agent_type="text", config={})
        agent.activate()
        agent.deactivate()
        agent.archive()
        with pytest.raises(ValueError):
            agent.activate()

    def test_update_name(self):
        agent = Agent(agent_id="a1", name="旧名称", agent_type="text", config={})
        agent.update(name="新名称", description="描述", config={"key": "val"})
        assert agent.name == "新名称"
        assert agent.description == "描述"
        assert agent.config == {"key": "val"}
```

- [ ] **Step 2: Run test to verify it fails**

```
pytest tests/domains/test_agent/test_entities.py -v
Expected: FAIL - ModuleNotFoundError

- [ ] **Step 3: Write entities.py**

```python
"""Agent 领域实体."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any

from app.architecture.domain_model import AggregateRoot


class AgentStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    INACTIVE = "inactive"
    ARCHIVED = "archived"


class Agent(AggregateRoot):
    """Agent 聚合根.

    状态机:
        DRAFT -> ACTIVE -> INACTIVE -> ARCHIVED
        DRAFT -> ARCHIVED (直接归档)
    """

    agent_id: str
    name: str
    agent_type: str  # text / image / audio
    status: AgentStatus = AgentStatus.DRAFT
    description: str | None = None
    config: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def activate(self) -> None:
        if self.status == AgentStatus.ARCHIVED:
            raise ValueError("已归档的 Agent 无法激活")
        if self.status == AgentStatus.ACTIVE:
            return
        self.status = AgentStatus.ACTIVE
        self.updated_at = datetime.utcnow()

    def deactivate(self) -> None:
        if self.status == AgentStatus.ARCHIVED:
            raise ValueError("已归档的 Agent 无法停用")
        if self.status == AgentStatus.INACTIVE:
            return
        self.status = AgentStatus.INACTIVE
        self.updated_at = datetime.utcnow()

    def archive(self) -> None:
        if self.status == AgentStatus.ARCHIVED:
            return
        self.status = AgentStatus.ARCHIVED
        self.updated_at = datetime.utcnow()

    def update(self, name: str | None = None, description: str | None = None, config: dict[str, Any] | None = None) -> None:
        if name is not None:
            self.name = name
        if description is not None:
            self.description = description
        if config is not None:
            self.config = config
        self.updated_at = datetime.utcnow()
```

- [ ] **Step 4: Run test to verify it passes**

```
pytest tests/domains/test_agent/test_entities.py -v
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/domains/agent/entities.py tests/domains/test_agent/test_entities.py
git commit -m "feat(p30-agent): add Agent entity with status state machine"
```

---

## Task 3: 实现 events.py

**Files:**
- Create: `app/domains/agent/events.py`

- [ ] **Step 1: 写 events.py**

```python
"""Agent 领域事件."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.architecture.domain_model import DomainEvent


@dataclass
class AgentCreatedEvent(DomainEvent):
    agent_id: str
    name: str
    agent_type: str
    occurred_at: datetime = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()


@dataclass
class AgentActivatedEvent(DomainEvent):
    agent_id: str
    occurred_at: datetime = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()


@dataclass
class AgentDeactivatedEvent(DomainEvent):
    agent_id: str
    occurred_at: datetime = None

    def __post_init__(self):
        if self.occurred_at is None:
            self.occurred_at = datetime.utcnow()
```

- [ ] **Step 2: Commit**

```bash
git add app/domains/agent/events.py
git commit -m "feat(p30-agent): add Agent domain events"
```

---

## Task 4: 实现 repository.py

**Files:**
- Create: `app/domains/agent/repository.py`

- [ ] **Step 1: 写 repository.py**

```python
"""Agent 仓储接口 + 内存实现."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.domains.agent.entities import Agent


class AgentRepository(ABC):
    """Agent 仓储抽象接口."""

    @abstractmethod
    def find_by_id(self, agent_id: str) -> Agent | None: ...

    @abstractmethod
    def save(self, agent: Agent) -> Agent: ...

    @abstractmethod
    def delete(self, agent_id: str) -> None: ...

    @abstractmethod
    def find_all(self, skip: int = 0, limit: int = 100) -> list[Agent]: ...

    @abstractmethod
    def count(self) -> int: ...


class InMemoryAgentRepository(AgentRepository):
    """内存实现，供测试和过渡期使用."""

    def __init__(self):
        self._store: dict[str, Agent] = {}

    def find_by_id(self, agent_id: str) -> Agent | None:
        return self._store.get(agent_id)

    def save(self, agent: Agent) -> Agent:
        self._store[agent.agent_id] = agent
        return agent

    def delete(self, agent_id: str) -> None:
        self._store.pop(agent_id, None)

    def find_all(self, skip: int = 0, limit: int = 100) -> list[Agent]:
        return list(self._store.values())[skip : skip + limit]

    def count(self) -> int:
        return len(self._store)
```

- [ ] **Step 2: Commit**

```bash
git add app/domains/agent/repository.py
git commit -m "feat(p30-agent): add AgentRepository interface + InMemory impl"
```

---

## Task 5: 实现 commands.py

**Files:**
- Create: `app/domains/agent/commands.py`

- [ ] **Step 1: 写 commands.py**

```python
"""Agent 命令处理器."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from app.domains.agent.entities import Agent
    from app.domains.agent.repository import AgentRepository


@dataclass
class CreateAgentCommand:
    agent_id: str
    name: str
    agent_type: str
    description: str | None = None
    config: dict[str, Any] | None = None


@dataclass
class UpdateAgentCommand:
    agent_id: str
    name: str | None = None
    description: str | None = None
    config: dict[str, Any] | None = None


@dataclass
class ActivateAgentCommand:
    agent_id: str


@dataclass
class DeactivateAgentCommand:
    agent_id: str


@dataclass
class ArchiveAgentCommand:
    agent_id: str


def _get_repo() -> AgentRepository:
    from app.domains.agent.repository import InMemoryAgentRepository

    return InMemoryAgentRepository()


def handle_create(cmd: CreateAgentCommand) -> Agent:
    from app.domains.agent.entities import Agent, AgentStatus
    from app.domains.agent.events import AgentCreatedEvent

    repo = _get_repo()
    agent = Agent(
        agent_id=cmd.agent_id,
        name=cmd.name,
        agent_type=cmd.agent_type,
        description=cmd.description,
        config=cmd.config or {},
    )
    repo.save(agent)
    event = AgentCreatedEvent(agent_id=agent.agent_id, name=agent.name, agent_type=agent.agent_type)
    agent.add_event(event)
    return agent


def handle_update(cmd: UpdateAgentCommand) -> Agent:
    repo = _get_repo()
    agent = repo.find_by_id(cmd.agent_id)
    if agent is None:
        raise ValueError(f"Agent not found: {cmd.agent_id}")
    agent.update(name=cmd.name, description=cmd.description, config=cmd.config)
    repo.save(agent)
    return agent


def handle_activate(cmd: ActivateAgentCommand) -> Agent:
    repo = _get_repo()
    agent = repo.find_by_id(cmd.agent_id)
    if agent is None:
        raise ValueError(f"Agent not found: {cmd.agent_id}")
    agent.activate()
    from app.domains.agent.events import AgentActivatedEvent

    agent.add_event(AgentActivatedEvent(agent_id=agent.agent_id))
    repo.save(agent)
    return agent


def handle_deactivate(cmd: DeactivateAgentCommand) -> Agent:
    repo = _get_repo()
    agent = repo.find_by_id(cmd.agent_id)
    if agent is None:
        raise ValueError(f"Agent not found: {cmd.agent_id}")
    agent.deactivate()
    from app.domains.agent.events import AgentDeactivatedEvent

    agent.add_event(AgentDeactivatedEvent(agent_id=agent.agent_id))
    repo.save(agent)
    return agent


def handle_archive(cmd: ArchiveAgentCommand) -> Agent:
    repo = _get_repo()
    agent = repo.find_by_id(cmd.agent_id)
    if agent is None:
        raise ValueError(f"Agent not found: {cmd.agent_id}")
    agent.archive()
    repo.save(agent)
    return agent
```

- [ ] **Step 2: Commit**

```bash
git add app/domains/agent/commands.py
git commit -m "feat(p30-agent): add Agent command handlers"
```

---

## Task 6: 实现 queries.py

**Files:**
- Create: `app/domains/agent/queries.py`

- [ ] **Step 1: 写 queries.py**

```python
"""Agent 查询处理器."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.domains.agent.entities import Agent, AgentStatus


@dataclass
class GetAgentQuery:
    agent_id: str


@dataclass
class ListAgentsQuery:
    status: str | None = None
    page: int = 1
    size: int = 20


@dataclass
class SearchAgentsQuery:
    keyword: str = ""
    status: str | None = None
    page: int = 1
    size: int = 20


@dataclass
class GetAgentStatsQuery:
    agent_id: str


@dataclass
class ListAgentActivitiesQuery:
    agent_id: str
    page: int = 1
    size: int = 20


def handle_get(q: GetAgentQuery) -> Agent | None:
    from app.domains.agent.repository import InMemoryAgentRepository

    repo = InMemoryAgentRepository()
    return repo.find_by_id(q.agent_id)


def handle_list(q: ListAgentsQuery) -> dict[str, Any]:
    from app.domains.agent.repository import InMemoryAgentRepository

    repo = InMemoryAgentRepository()
    all_agents = repo.find_all(skip=0, limit=1000)
    if q.status:
        all_agents = [a for a in all_agents if a.status.value == q.status]
    total = len(all_agents)
    start = (q.page - 1) * q.size
    items = all_agents[start : start + q.size]
    return {
        "total": total,
        "page": q.page,
        "size": q.size,
        "items": [_agent_to_dict(a) for a in items],
    }


def handle_search(q: SearchAgentsQuery) -> dict[str, Any]:
    from app.domains.agent.repository import InMemoryAgentRepository

    repo = InMemoryAgentRepository()
    all_agents = repo.find_all(skip=0, limit=1000)
    if q.status:
        all_agents = [a for a in all_agents if a.status.value == q.status]
    if q.keyword:
        kw = q.keyword.lower()
        all_agents = [a for a in all_agents if kw in a.name.lower() or (a.description and kw in a.description.lower())]
    total = len(all_agents)
    start = (q.page - 1) * q.size
    items = all_agents[start : start + q.size]
    return {
        "total": total,
        "page": q.page,
        "size": q.size,
        "items": [_agent_to_dict(a) for a in items],
    }


def handle_stats(q: GetAgentStatsQuery) -> dict[str, Any]:
    return {"agent_id": q.agent_id, "total_uses": 0, "active_users": 0}


def handle_activities(q: ListAgentActivitiesQuery) -> dict[str, Any]:
    return {"total": 0, "page": q.page, "size": q.size, "items": []}


def _agent_to_dict(a: Agent) -> dict[str, Any]:
    return {
        "agent_id": a.agent_id,
        "name": a.name,
        "description": a.description,
        "agent_type": a.agent_type,
        "status": a.status.value,
        "config": a.config,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }
```

- [ ] **Step 2: Commit**

```bash
git add app/domains/agent/queries.py
git commit -m "feat(p30-agent): add Agent query handlers"
```

---

## Task 7: 实现 event_handlers.py

**Files:**
- Create: `app/domains/agent/event_handlers.py`

- [ ] **Step 1: 写 event_handlers.py**

```python
"""Agent 事件处理器."""

from __future__ import annotations

from app.architecture.event_bus import EventBus
from app.domains.agent.events import AgentActivatedEvent, AgentCreatedEvent, AgentDeactivatedEvent


def on_agent_created(event: AgentCreatedEvent) -> None:
    """Agent 创建后记录日志（示例处理器）."""
    print(f"[Agent] Created: {event.agent_id} ({event.name})")


def on_agent_activated(event: AgentActivatedEvent) -> None:
    """Agent 激活后记录日志."""
    print(f"[Agent] Activated: {event.agent_id}")


def on_agent_deactivated(event: AgentDeactivatedEvent) -> None:
    """Agent 停用后记录日志."""
    print(f"[Agent] Deactivated: {event.agent_id}")


def register_agent_event_handlers(event_bus: EventBus) -> None:
    """注册 Agent 事件处理器到事件总线."""
    event_bus.subscribe(AgentCreatedEvent, on_agent_created)
    event_bus.subscribe(AgentActivatedEvent, on_agent_activated)
    event_bus.subscribe(AgentDeactivatedEvent, on_agent_deactivated)
```

- [ ] **Step 2: Commit**

```bash
git add app/domains/agent/event_handlers.py
git commit -m "feat(p30-agent): add Agent event handlers"
```

---

## Task 8: 实现 API 路由

**Files:**
- Create: `app/api/p30/agent.py`
- Modify: `app/main.py` (注册路由)

- [ ] **Step 1: 写 API 路由**

```python
"""P30 Agent API 路由."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

from app.domains.agent.commands import (
    ArchiveAgentCommand,
    handle_activate,
    handle_archive,
    handle_create,
    handle_deactivate,
    handle_update,
)
from app.domains.agent.entities import AgentStatus
from app.domains.agent.queries import (
    GetAgentQuery,
    GetAgentStatsQuery,
    ListAgentActivitiesQuery,
    ListAgentsQuery,
    SearchAgentsQuery,
    handle_get,
    handle_list,
    handle_search,
    handle_stats,
    handle_activities,
)

router = APIRouter(prefix="/api/p30/agents", tags=["p30", "agent"])


@router.post("")
def create_agent(body: dict[str, Any]):
    cmd = ArchiveAgentCommand(
        agent_id=body["agent_id"],
        name=body["name"],
        agent_type=body.get("agent_type", "text"),
        description=body.get("description"),
        config=body.get("config"),
    )
    agent = handle_create(cmd)
    return {"agent_id": agent.agent_id, "status": agent.status.value}


@router.get("/{agent_id}")
def get_agent(agent_id: str):
    agent = handle_get(GetAgentQuery(agent_id=agent_id))
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {
        "agent_id": agent.agent_id,
        "name": agent.name,
        "description": agent.description,
        "agent_type": agent.agent_type,
        "status": agent.status.value,
        "config": agent.config,
    }


@router.get("")
def list_agents(status: str | None = None, page: int = 1, size: int = 20):
    result = handle_list(ListAgentsQuery(status=status, page=page, size=size))
    return result


@router.get("/search")
def search_agents(keyword: str = "", status: str | None = None, page: int = 1, size: int = 20):
    result = handle_search(SearchAgentsQuery(keyword=keyword, status=status, page=page, size=size))
    return result


@router.get("/{agent_id}/stats")
def get_agent_stats(agent_id: str):
    return handle_stats(GetAgentStatsQuery(agent_id=agent_id))


@router.get("/{agent_id}/activities")
def list_agent_activities(agent_id: str, page: int = 1, size: int = 20):
    return handle_activities(ListAgentActivitiesQuery(agent_id=agent_id, page=page, size=size))


@router.patch("/{agent_id}")
def update_agent(agent_id: str, body: dict[str, Any]):
    cmd = handle_update.__class__(
        agent_id=agent_id,
        name=body.get("name"),
        description=body.get("description"),
        config=body.get("config"),
    )
    # 重新构造（简化写法）
    from app.domains.agent.commands import UpdateAgentCommand
    cmd = UpdateAgentCommand(agent_id=agent_id, name=body.get("name"), description=body.get("description"), config=body.get("config"))
    agent = handle_update(cmd)
    return {"agent_id": agent.agent_id, "status": agent.status.value}


@router.post("/{agent_id}/activate")
def activate_agent(agent_id: str):
    agent = handle_activate(ArchiveAgentCommand(agent_id=agent_id))
    return {"agent_id": agent.agent_id, "status": agent.status.value}


@router.post("/{agent_id}/deactivate")
def deactivate_agent(agent_id: str):
    agent = handle_deactivate(ArchiveAgentCommand(agent_id=agent_id))
    return {"agent_id": agent.agent_id, "status": agent.status.value}


@router.post("/{agent_id}/archive")
def archive_agent(agent_id: str):
    agent = handle_archive(ArchiveAgentCommand(agent_id=agent_id))
    return {"agent_id": agent.agent_id, "status": agent.status.value}
```

- [ ] **Step 2: 在 main.py 注册路由**（找合适位置加入 p30_router）

```python
# 在 main.py 中添加
from app.api.p30.agent import router as p30_agent_router
app.include_router(p30_agent_router)
```

- [ ] **Step 3: Commit**

```bash
git add app/api/p30/agent.py
git commit -m "feat(p30-agent): add P30 Agent API routes"
```

---

## Task 9: 更新 SDK baseline

**Files:**
- Modify: `tests/fixtures/sdk_baseline.json`

- [ ] **Step 1: 运行 drift 检测**

```bash
cd g:/1/server
$env:PYTHONPATH = "."
python scripts/p20_sdk_drift_check.py --update
```

- [ ] **Step 2: Commit baseline 更新**

```bash
git add tests/fixtures/sdk_baseline.json
git commit -m "feat(p30-agent): update SDK baseline with new Agent endpoints"
```

---

## Task 10: 最终测试验证

**Files:**
- Run: 全量测试套件

- [ ] **Step 1: 运行 DDD Agent 模块测试**

```bash
cd g:/1/server
$env:PYTHONPATH = "."
python -m pytest tests/domains/test_agent/ -v --tb=short
```

- [ ] **Step 2: 运行 i18n CI 检查**

```bash
cd g:/1/client
npx tsx scripts/check-i18n-completeness.ts --strict-en
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(p30-agent): complete DDD Agent module implementation"
```
