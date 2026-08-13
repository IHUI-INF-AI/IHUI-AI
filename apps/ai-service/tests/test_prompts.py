"""prompts 路由单元测试(2026-08-13 立,补齐 0 覆盖)。

策略:monkeypatch 掉 `app.routers.prompts.prompt_registry` 单例,
直接调用端点函数,覆盖成功 / 404 / 409 / 400 / 请求体校验。
entry 用服务里真实的 PromptEntry / PromptVersion dataclass。
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.routers.prompts import (
    CreatePromptRequest,
    RollbackRequest,
    UpdatePromptRequest,
    create_prompt,
    delete_prompt,
    get_prompt,
    get_prompt_content,
    list_prompts,
    rollback_prompt,
    update_prompt,
)
from app.services.prompt_registry import PromptEntry, PromptVersion


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------


class _FakeRegistry:
    """可编程 fake prompt_registry:用真实 dict 模拟 _prompts。"""

    def __init__(self) -> None:
        self._prompts: dict[str, PromptEntry] = {}
        self.create_result: PromptEntry | None = None
        self.update_result: PromptEntry | None = None
        self.rollback_result: PromptEntry | None = None
        self.get_result: str | None = None
        self.delete_result = True
        self.list_result: list = []
        self.calls: list[tuple] = []

    def list_prompts(self):
        self.calls.append(("list_prompts",))
        return self.list_result

    def create(self, name, content, description=""):
        self.calls.append(("create", name, content, description))
        return self.create_result

    def update(self, name, content, description=""):
        self.calls.append(("update", name, content, description))
        return self.update_result

    def get(self, name, version=None):
        self.calls.append(("get", name, version))
        return self.get_result

    def rollback(self, name, target_version):
        self.calls.append(("rollback", name, target_version))
        return self.rollback_result

    def delete(self, name):
        self.calls.append(("delete", name))
        return self.delete_result


@pytest.fixture
def registry(monkeypatch):
    fake = _FakeRegistry()
    monkeypatch.setattr("app.routers.prompts.prompt_registry", fake)
    return fake


def _entry(name: str = "sys", versions: list[tuple[int, str]] | None = None) -> PromptEntry:
    if versions is None:
        versions = [(1, "v1-content")]
    return PromptEntry(
        name=name,
        description="desc",
        versions=[PromptVersion(version=v, content=c, description="d", created_at="2026-01-01T00:00:00Z") for v, c in versions],
        created_at="2026-01-01T00:00:00Z",
        updated_at="2026-01-02T00:00:00Z",
    )


# ---------------------------------------------------------------------------
# GET /prompts
# ---------------------------------------------------------------------------


async def test_list_prompts(registry):
    registry.list_result = [{"name": "sys", "latest_version": 2}]
    resp = await list_prompts()
    assert resp["code"] == 0
    assert resp["data"] == [{"name": "sys", "latest_version": 2}]


# ---------------------------------------------------------------------------
# GET /prompts/{name}
# ---------------------------------------------------------------------------


async def test_get_prompt_found(registry):
    registry._prompts["sys"] = _entry("sys", [(1, "c1"), (2, "c2")])
    resp = await get_prompt("sys")
    assert resp["code"] == 0
    data = resp["data"]
    assert data["name"] == "sys"
    assert data["latest_version"] == 2
    assert [v["version"] for v in data["versions"]] == [1, 2]
    assert data["versions"][1]["content"] == "c2"


async def test_get_prompt_404(registry):
    with pytest.raises(HTTPException) as exc:
        await get_prompt("nope")
    assert exc.value.status_code == 404
    assert "nope" in exc.value.detail


# ---------------------------------------------------------------------------
# GET /prompts/{name}/content
# ---------------------------------------------------------------------------


async def test_get_content_latest_version(registry):
    registry.get_result = "latest-content"
    registry._prompts["sys"] = _entry("sys", [(1, "c1"), (2, "latest-content")])
    resp = await get_prompt_content("sys")
    assert resp["code"] == 0
    assert resp["data"]["content"] == "latest-content"
    assert resp["data"]["version"] == 2  # 未指定版本 → latest_version


async def test_get_content_with_version(registry):
    registry.get_result = "v1"
    resp = await get_prompt_content("sys", version=1)
    assert resp["code"] == 0
    assert resp["data"]["version"] == 1
    assert registry.calls[-1] == ("get", "sys", 1)


async def test_get_content_404_no_version(registry):
    registry.get_result = None
    with pytest.raises(HTTPException) as exc:
        await get_prompt_content("nope")
    assert exc.value.status_code == 404
    assert "Prompt 不存在: nope" in exc.value.detail


async def test_get_content_404_bad_version(registry):
    registry.get_result = None
    with pytest.raises(HTTPException) as exc:
        await get_prompt_content("sys", version=9)
    assert exc.value.status_code == 404
    assert "版本 9 不存在" in exc.value.detail


# ---------------------------------------------------------------------------
# POST /prompts
# ---------------------------------------------------------------------------


async def test_create_prompt_201(registry):
    registry.create_result = _entry("new", [(1, "c")])
    resp = await create_prompt(CreatePromptRequest(name="new", content="c", description="d"))
    assert resp["code"] == 0
    assert resp["data"]["name"] == "new"
    assert resp["data"]["latest_version"] == 1
    assert registry.calls[-1] == ("create", "new", "c", "d")


async def test_create_prompt_409_duplicate(registry):
    registry._prompts["sys"] = _entry("sys")
    with pytest.raises(HTTPException) as exc:
        await create_prompt(CreatePromptRequest(name="sys", content="c"))
    assert exc.value.status_code == 409
    assert "sys" in exc.value.detail


def test_create_prompt_body_validation():
    with pytest.raises(ValidationError):
        CreatePromptRequest(name="", content="c")  # name min_length=1
    with pytest.raises(ValidationError):
        CreatePromptRequest(name="n", content="")  # content min_length=1


# ---------------------------------------------------------------------------
# PUT /prompts/{name}
# ---------------------------------------------------------------------------


async def test_update_prompt_success(registry):
    registry._prompts["sys"] = _entry("sys")
    registry.update_result = _entry("sys", [(1, "c1"), (2, "new")])
    resp = await update_prompt("sys", UpdatePromptRequest(content="new", description="d2"))
    assert resp["code"] == 0
    assert resp["data"]["latest_version"] == 2
    assert registry.calls[-1] == ("update", "sys", "new", "d2")


async def test_update_prompt_404(registry):
    with pytest.raises(HTTPException) as exc:
        await update_prompt("nope", UpdatePromptRequest(content="c"))
    assert exc.value.status_code == 404


def test_update_prompt_body_validation():
    with pytest.raises(ValidationError):
        UpdatePromptRequest(content="")


# ---------------------------------------------------------------------------
# POST /prompts/{name}/rollback
# ---------------------------------------------------------------------------


async def test_rollback_success(registry):
    registry._prompts["sys"] = _entry("sys", [(1, "c1"), (2, "c2")])
    registry.rollback_result = _entry("sys", [(1, "c1"), (2, "c2"), (3, "c1")])
    resp = await rollback_prompt("sys", RollbackRequest(target_version=1))
    assert resp["code"] == 0
    assert resp["data"]["rollback_to_version"] == 1
    assert resp["data"]["latest_version"] == 3
    assert registry.calls[-1] == ("rollback", "sys", 1)


async def test_rollback_404(registry):
    with pytest.raises(HTTPException) as exc:
        await rollback_prompt("nope", RollbackRequest(target_version=1))
    assert exc.value.status_code == 404


async def test_rollback_400_value_error(registry, monkeypatch):
    registry._prompts["sys"] = _entry("sys")

    def _raise(name, target_version):
        raise ValueError("目标版本 9 不存在")

    monkeypatch.setattr(registry, "rollback", _raise)
    with pytest.raises(HTTPException) as exc:
        await rollback_prompt("sys", RollbackRequest(target_version=9))
    assert exc.value.status_code == 400
    assert "目标版本 9 不存在" in exc.value.detail


def test_rollback_body_validation():
    with pytest.raises(ValidationError):
        RollbackRequest(target_version=0)  # ge=1
    with pytest.raises(ValidationError):
        RollbackRequest(target_version=-1)


# ---------------------------------------------------------------------------
# DELETE /prompts/{name}
# ---------------------------------------------------------------------------


async def test_delete_prompt_success(registry):
    resp = await delete_prompt("sys")
    assert resp["code"] == 0
    assert resp["data"] == {"deleted": True, "name": "sys"}


async def test_delete_prompt_404(registry):
    registry.delete_result = False
    with pytest.raises(HTTPException) as exc:
        await delete_prompt("nope")
    assert exc.value.status_code == 404
