"""scan_login ScanTask 纯逻辑单元测试(2026-08-12 立,补齐 0 覆盖)。

覆盖不依赖浏览器/Redis 的部分:
- ScanTask.is_terminal: 终态判定(状态机)
- ScanTask.snapshot: 可序列化状态(has_qr/cookies_count 计算)
"""

from __future__ import annotations

from app.services.scan_login import ScanTask


def _task(status: str) -> ScanTask:
    return ScanTask(task_id="t1", user_id="u1", platform="wechat", status=status)


# --- is_terminal ---


def test_is_terminal_terminal_statuses():
    """终态(success/failed/timeout/cancelled/expired)返回 True。"""
    for s in ("success", "failed", "timeout", "cancelled", "expired"):
        assert _task(s).is_terminal() is True, f"status={s} 应为终态"


def test_is_terminal_non_terminal_statuses():
    """非终态(pending/waiting_scan/scanned)返回 False。"""
    for s in ("pending", "waiting_scan", "scanned"):
        assert _task(s).is_terminal() is False, f"status={s} 不应为终态"


# --- snapshot ---


def test_snapshot_fields():
    """snapshot 返回完整可序列化字段。"""
    snap = _task("pending").snapshot()
    assert snap["task_id"] == "t1"
    assert snap["user_id"] == "u1"
    assert snap["platform"] == "wechat"
    assert snap["status"] == "pending"
    assert snap["has_qr"] is False
    assert snap["cookies_count"] == 0


def test_snapshot_has_qr_and_cookies():
    """qr_image_b64 非空 → has_qr=True;all_relevant_cookies 计数。"""
    t = ScanTask(
        task_id="t2",
        user_id="u1",
        platform="wechat",
        status="success",
        qr_image_b64="aGVsbG8=",
        all_relevant_cookies={"session": "abc", "token": "def"},
        account_id=42,
    )
    snap = t.snapshot()
    assert snap["has_qr"] is True
    assert snap["cookies_count"] == 2
    assert snap["account_id"] == 42
    # qr_image_b64 不应原样暴露(避免大 base64 撑爆 API 响应)
    assert "qr_image_b64" not in snap
