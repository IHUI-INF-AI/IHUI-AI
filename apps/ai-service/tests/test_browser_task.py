# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""任务模板与检查点纯逻辑测试(2026-11-25)。"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from app.services.browser_task import (
    CHECKPOINT_ACTIVE,
    CHECKPOINT_DONE,
    CHECKPOINT_WAIT_TIMEOUT_SECONDS,
    BUILTIN_TASK_TEMPLATES,
    TaskValidationError,
    active_checkpoint,
    checkpoint_matches_url,
    checkpoint_snapshot,
    checkpoint_timed_out,
    checkpoint_wait_remaining,
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
    assert snapshot["checkpoints"][0]["label_key"] is None
    assert snapshot["checkpoint_timeout_seconds"] == CHECKPOINT_WAIT_TIMEOUT_SECONDS


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
        (
            lambda p: p["checkpoints"][0].update(label_key="Bad Key"),
            "task_invalid_checkpoints",
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
        keys = [cp["label_key"] for cp in task["checkpoints"]]
        assert all(isinstance(k, str) and k.startswith("ck_") for k in keys)
        assert len(set(keys)) == len(keys)
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


def test_checkpoint_timeout_is_derived_and_never_auto_resumes():
    task = normalize_task(_payload())
    mark_checkpoint_active(task, "export")
    cp = find_checkpoint(task, "export")
    assert cp is not None

    # 刚进入:未超时,仍有剩余
    cp["entered_at"] = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert checkpoint_timed_out(cp) is False
    assert (checkpoint_wait_remaining(cp) or 0) > 0

    # 超过上限:只变 timed_out 派生位,状态仍是 active、进度仍是 0
    cp["entered_at"] = (
        datetime.now(UTC) - timedelta(seconds=CHECKPOINT_WAIT_TIMEOUT_SECONDS + 5)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    assert checkpoint_timed_out(cp) is True
    assert checkpoint_wait_remaining(cp) == 0.0
    assert cp["status"] == CHECKPOINT_ACTIVE
    assert active_checkpoint(task)["id"] == "export"
    assert task_progress(task) == {"done": 0, "total": 2}
    snapshot = task_snapshot(task)
    assert snapshot is not None
    assert snapshot["checkpoints"][0]["timed_out"] is True
    assert snapshot["checkpoints"][0]["status"] == CHECKPOINT_ACTIVE
    assert checkpoint_snapshot(cp)["timed_out"] is True

    # 非 active(即使进入时间很旧)不算超时:只看正在等人的那一项
    cp["status"] = CHECKPOINT_DONE
    assert checkpoint_timed_out(cp) is False
    assert checkpoint_wait_remaining(cp) is None


def test_checkpoint_timeout_is_configurable_per_task_and_template():
    payload = _payload()
    payload["checkpoint_timeout_seconds"] = 300
    task = normalize_task(payload)
    assert task["checkpoint_timeout_seconds"] == 300
    mark_checkpoint_active(task, "export")
    cp = find_checkpoint(task, "export")
    cp["entered_at"] = (
        datetime.now(UTC) - timedelta(seconds=320)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    snapshot = task_snapshot(task)
    assert snapshot["checkpoint_timeout_seconds"] == 300
    assert snapshot["checkpoints"][0]["timed_out"] is True
    # 同一检查点按默认 15 分钟仍不算超时,证明上限确实按任务生效。
    assert checkpoint_timed_out(cp) is False

    expected = {
        "login-handoff": 10 * 60,
        "form-commit": 15 * 60,
        "payment-confirm": 5 * 60,
        "download-export": 30 * 60,
    }
    for item in list_task_templates():
        assert item["checkpoint_timeout_seconds"] == expected[item["id"]]
    for template_id, seconds in expected.items():
        assert task_from_template(template_id)["checkpoint_timeout_seconds"] == seconds


def test_checkpoint_timeout_rejects_out_of_range_and_non_integer():
    for bad in (0, 30, 3601, 7200, True, 1.5, "abc"):
        payload = _payload()
        payload["checkpoint_timeout_seconds"] = bad
        with pytest.raises(TaskValidationError) as exc:
            normalize_task(payload)
        assert exc.value.code == "task_invalid_checkpoint_timeout"


def test_checkpoint_timeout_accepts_camel_and_numeric_string():
    payload = _payload()
    payload["checkpointTimeoutSeconds"] = "600"
    task = normalize_task(payload)
    assert task["checkpoint_timeout_seconds"] == 600


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
