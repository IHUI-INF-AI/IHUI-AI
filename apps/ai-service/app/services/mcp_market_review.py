# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP Server 市场审核状态持久化(P2-5 上架审核,2026-09-12 立)。

把"市场条目的审核状态"落到 JSON 文件,重启不丢:
- 无 DB 依赖,风格对齐 capability_market_store(纯文件读写 + 异常降级)
- 记录结构:
  {
    "<key>": {
      "status": "approved",        # pending | approved | rejected
      "reviewed_by": "user:1",     # 审核人(请求上下文 user_id)
      "reviewed_at": "ISO 时间",
      "note": ""                   # 审核备注(驳回原因等)
    }
  }
- 默认值:内置目录条目(人工预审过的官方/社区 server)默认 approved;
  其余 key(外部新增条目)默认 pending,待管理员审核
- 读写失败降级:读失败按默认值返回,写失败返回 None,不抛异常不崩服务
"""

from __future__ import annotations

import json
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# apps/ai-service/data/mcp_market_review.json(父目录不存在时自动创建)
_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "mcp_market_review.json"
_LOCK = threading.Lock()

# 合法审核状态:待审核 / 已通过 / 已驳回
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
VALID_STATUSES = frozenset({STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED})


def now_iso() -> str:
    """当前 UTC 时间的 ISO 8601 字符串(持久化时间戳用)。"""
    return datetime.now(UTC).isoformat()


def _load() -> dict[str, dict[str, Any]]:
    """读取全部审核记录;文件缺失 / 损坏 / 非对象时返回空 dict(异常降级)。"""
    try:
        if not _STORE_PATH.exists():
            return {}
        raw = _STORE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001 - 读失败返回空 dict,不崩服务
        return {}


def _write(records: dict[str, dict[str, Any]]) -> bool:
    """原子写全部记录(临时文件 + replace),失败返回 False。"""
    try:
        _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = _STORE_PATH.with_suffix(".json.tmp")
        tmp_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        tmp_path.replace(_STORE_PATH)
        return True
    except Exception:  # noqa: BLE001 - 写失败返回 False,由调用方决定报错
        return False


def _default_status(key: str) -> str:
    """未记录 key 的默认审核状态:内置目录条目 approved,其余 pending。"""
    try:
        from .mcp_directory import get_entry

        return STATUS_APPROVED if get_entry(key) is not None else STATUS_PENDING
    except Exception:  # noqa: BLE001 - 目录查询失败按 pending 处理(保守)
        return STATUS_PENDING


def get_review(key: str) -> dict[str, Any]:
    """返回某 key 的审核记录(含默认值合并)。

    Returns:
        {key, status, reviewed_by, reviewed_at, note}
    """
    with _LOCK:
        rec = _load().get(key)
        if rec is None:
            return {
                "key": key,
                "status": _default_status(key),
                "reviewed_by": "",
                "reviewed_at": "",
                "note": "",
            }
        return {
            "key": key,
            "status": str(rec.get("status") or _default_status(key)),
            "reviewed_by": str(rec.get("reviewed_by") or ""),
            "reviewed_at": str(rec.get("reviewed_at") or ""),
            "note": str(rec.get("note") or ""),
        }


def get_status(key: str) -> str:
    """返回某 key 的审核状态(pending/approved/rejected)。"""
    return str(get_review(key)["status"])


def set_status(
    key: str, status: str, reviewed_by: str = "", note: str = ""
) -> dict[str, Any] | None:
    """设置某 key 的审核状态并打时间戳。

    Args:
        key: 市场条目 key
        status: 新状态(pending/approved/rejected,非法值抛 ValueError)
        reviewed_by: 审核人标识(请求上下文 user_id)
        note: 审核备注(驳回原因等)

    Returns:
        更新后的完整记录;写失败返回 None。
    """
    if status not in VALID_STATUSES:
        raise ValueError(f"非法审核状态: {status!r}(须为 pending/approved/rejected)")
    with _LOCK:
        records = _load()
        rec = records.get(key, {})
        rec["status"] = status
        rec["reviewed_by"] = reviewed_by
        rec["reviewed_at"] = now_iso()
        rec["note"] = note
        records[key] = rec
        if _write(records):
            return {
                "key": key,
                **rec,
            }
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
