# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services import browser_task_template_store as store
from app.services.browser_task import TaskValidationError


@pytest.fixture()
def isolated_store(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    path = tmp_path / "browser_task_templates.json"
    monkeypatch.setattr(store, "_STORE_PATH", path)
    return path


def _payload(**overrides):
    base = {
        "name": "发票报销核对",
        "goal": "完成发票报销提交前核对",
        "requirements": ["金额与发票一致", "提交前停下来等人"],
        "checkpoints": [
            {"id": "confirm", "label": "提交前确认", "match": "confirm"},
            {"id": "receipt", "label": "回执确认", "match": None},
        ],
        "checkpoint_timeout_seconds": 600,
    }
    base.update(overrides)
    return base


def test_create_list_update_delete_roundtrip(isolated_store: Path):
    created = store.upsert_custom_template("user-a", _payload())
    assert created["id"].startswith("custom-")
    assert created["name"] == "发票报销核对"
    assert created["checkpoint_timeout_seconds"] == 600
    assert [cp["id"] for cp in created["checkpoints"]] == ["confirm", "receipt"]
    assert isolated_store.exists()

    listed = store.list_custom_templates("user-a")
    assert [item["id"] for item in listed] == [created["id"]]

    updated = store.upsert_custom_template(
        "user-a",
        _payload(id=created["id"], name="改过的名字", goal="新的目标"),
    )
    assert updated["id"] == created["id"]
    assert updated["name"] == "改过的名字"
    assert len(store.list_custom_templates("user-a")) == 1

    assert store.get_custom_template("user-a", created["id"])["goal"] == "新的目标"
    assert store.delete_custom_template("user-a", created["id"]) is True
    assert store.list_custom_templates("user-a") == []
    assert store.delete_custom_template("user-a", created["id"]) is False


def test_templates_are_scoped_by_user(isolated_store: Path):
    a = store.upsert_custom_template("user-a", _payload())
    b = store.upsert_custom_template("user-b", _payload(name="B 的模板"))
    assert [item["id"] for item in store.list_custom_templates("user-a")] == [a["id"]]
    assert [item["id"] for item in store.list_custom_templates("user-b")] == [b["id"]]
    assert store.get_custom_template("user-b", a["id"]) is None


def test_custom_id_must_use_custom_prefix(isolated_store: Path):
    with pytest.raises(TaskValidationError) as exc:
        store.upsert_custom_template("user-a", _payload(id="login-handoff"))
    assert exc.value.code == "template_invalid_id"


def test_server_validation_reuses_task_rules(isolated_store: Path):
    with pytest.raises(TaskValidationError) as exc:
        store.upsert_custom_template("user-a", _payload(goal=""))
    assert exc.value.code == "task_invalid_goal"

    with pytest.raises(TaskValidationError) as exc:
        store.upsert_custom_template("user-a", _payload(checkpoints=[]))
    assert exc.value.code == "task_invalid_checkpoints"

    with pytest.raises(TaskValidationError) as exc:
        store.upsert_custom_template(
            "user-a",
            _payload(checkpoint_timeout_seconds=5),
        )
    assert exc.value.code == "task_invalid_checkpoint_timeout"


def test_corrupt_store_blocks_write_but_reads_empty(isolated_store: Path):
    isolated_store.write_text("{not-json", encoding="utf-8")
    assert store.list_custom_templates("user-a") == []
    with pytest.raises(store.TemplateStoreUnread):
        store.upsert_custom_template("user-a", _payload())


def test_limit_per_user(isolated_store: Path):
    for index in range(store._MAX_TEMPLATES_PER_USER):
        store.upsert_custom_template("user-a", _payload(name=f"模板 {index}"))
    with pytest.raises(TaskValidationError) as exc:
        store.upsert_custom_template("user-a", _payload(name="超限"))
    assert exc.value.code == "template_limit"


def test_file_shape_is_versioned(isolated_store: Path):
    store.upsert_custom_template("user-a", _payload())
    data = json.loads(isolated_store.read_text(encoding="utf-8"))
    assert data["version"] == 1
    assert "user-a" in data["users"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
