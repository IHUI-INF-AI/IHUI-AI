# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""任务模板与检查点纯逻辑测试(2026-11-25)。"""
from __future__ import annotations

import pytest

from app.services.browser_task import (
    CHECKPOINT_ACTIVE,
    CHECKPOINT_DONE,
    BUILTIN_TASK_TEMPLATES,
    TaskValidationError,
    active_checkpoint,
    checkpoint_matches_url,
    find_checkpoint,
    first_unfinished_match,
    list_task_templates,
    mark_checkpoint_active,
    mark_checkpoint_done,
    normalize_task,
    task_from_template,
    task_progress,
    task_snapshot,
)


def _payload() -> dict:
    return {
        "goal": "把报表导出并核对",
        "requirements": ["导出 xlsx", "核对行数"],
        "checkpoints": [
            {"id": "export", "label": "导出已触发", "match": "export"},
            {"id": "done", "label": "产物核对完成"},
        ],
    }


def test_normalize_task_defaults_and_statuses():
    task = normalize_task(_payload())
    assert task["task_id"].startswith("task_")
    assert task["status"] == "active"
    assert [cp["status"] for cp in task["checkpoints"]] == ["pending", "pending"]
    snapshot = task_snapshot(task)
    assert snapshot is not None
    assert snapshot["goal"] == "把报表导出并核对"
    assert snapshot["requirements"] == ["导出 xlsx", "核对行数"]


def test_normalize_task_keeps_explicit_id():
    payload = _payload()
    payload["task_id"] = "task_fixed_1"
    assert normalize_task(payload)["task_id"] == "task_fixed_1"


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (lambda p: p.update(goal=""), "task_invalid_goal"),
        (lambda p: p.update(goal="x" * 161), "task_invalid_goal"),
        (lambda p: p.update(checkpoints=[]), "task_invalid_checkpoints"),
        (lambda p: p.update(requirements=["x"] * 9), "task_invalid_requirements"),
        (lambda p: p.update(requirements=["x" * 81]), "task_invalid_requirements"),
        (lambda p: p.update(requirements="bad"), "task_invalid_requirements"),
        (
            lambda p: p["checkpoints"].append({"id": "export", "label": "重复"}),
            "task_invalid_checkpoints",
        ),
        (
            lambda p: p["checkpoints"].append({"id": "Bad ID", "label": "非法"}),
            "task_invalid_checkpoints",
        ),
        (
            lambda p: p["checkpoints"][0].update(match="export/step"),
            "checkpoint_match_invalid",
        ),
        (
            lambda p: p["checkpoints"][0].update(match="export*"),
            "checkpoint_match_invalid",
        ),
    ],
)
def test_normalize_task_rejects_bad_input(mutate, code):
    payload = _payload()
    mutate(payload)
    with pytest.raises(TaskValidationError) as exc:
        normalize_task(payload)
    assert exc.value.code == code


def test_builtin_templates_are_valid_and_unique():
    templates = list_task_templates()
    assert {t["id"] for t in templates} == {
        "login-handoff",
        "form-commit",
        "payment-confirm",
        "download-export",
    }
    for tpl in BUILTIN_TASK_TEMPLATES:
        task = task_from_template(tpl["id"])
        assert task["template_id"] == tpl["id"]
        assert len(task["checkpoints"]) == len(tpl["checkpoints"])
    with pytest.raises(TaskValidationError) as exc:
        task_from_template("not-exist")
    assert exc.value.code == "template_not_found"


def test_match_is_exact_segment_not_substring():
    # 文章里踩过的坑: /blog/how-to-login 不能被 login 命中
    assert checkpoint_matches_url("login", "https://a.com/blog/how-to-login") is False
    assert checkpoint_matches_url("login", "https://a.com/login") is True
    assert checkpoint_matches_url("login", "https://login.a.com/") is False
    assert checkpoint_matches_url("verify", "https://a.com/?verify=1") is True
    assert checkpoint_matches_url("pay", "https://a.com/payment") is False
    assert checkpoint_matches_url("pay", "https://a.com/checkout/pay") is True


def test_checkpoint_lifecycle_single_active_and_idempotent_done():
    task = normalize_task(_payload())
    mark_checkpoint_active(task, "export")
    assert active_checkpoint(task)["id"] == "export"
    mark_checkpoint_active(task, "done")
    assert active_checkpoint(task)["id"] == "done"
    assert find_checkpoint(task, "export")["status"] == "pending"

    mark_checkpoint_done(task, "done")
    assert find_checkpoint(task, "done")["status"] == CHECKPOINT_DONE
    # 幂等:重复恢复不重写 done_at
    done_at = find_checkpoint(task, "done")["done_at"]
    mark_checkpoint_done(task, "done")
    assert find_checkpoint(task, "done")["done_at"] == done_at
    assert task_progress(task) == {"done": 1, "total": 2}


def test_first_unfinished_match_skips_done():
    task = normalize_task(_payload())
    hit = first_unfinished_match(task, "https://a.com/export")
    assert hit["id"] == "export"
    mark_checkpoint_done(task, "export")
    assert first_unfinished_match(task, "https://a.com/export") is None


def test_unknown_checkpoint_errors():
    task = normalize_task(_payload())
    with pytest.raises(TaskValidationError) as exc:
        mark_checkpoint_active(task, "ghost")
    assert exc.value.code == "checkpoint_not_found"

    mark_checkpoint_done(task, "export")
    with pytest.raises(TaskValidationError) as exc2:
        mark_checkpoint_active(task, "export")
    assert exc2.value.code == "checkpoint_already_done"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
