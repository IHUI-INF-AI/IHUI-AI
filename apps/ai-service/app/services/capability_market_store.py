# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""能力市场启用状态持久化(P2-8 供给侧)。

把"各能力的启用 / 停用"状态落到 JSON 文件,重启不丢:
- 无 DB 依赖,风格对齐 mcp_store(纯文件读写 + 异常降级)
- 记录结构:{ "<capability_id>": { "enabled": true, "updated_at": "ISO" } }
- 平台自研能力默认全部 enabled(它们是平台内置特性);
  停用 = 从"对外暴露的 MCP 能力集"中移除(供给侧收口)
- 读写失败降级:读失败返回空 dict,写失败返回 None,不抛异常不崩服务
"""

from __future__ import annotations

import json
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# apps/ai-service/data/capability_market.json(父目录不存在时自动创建)
_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "capability_market.json"
_LOCK = threading.Lock()


def now_iso() -> str:
    """当前 UTC 时间的 ISO 8601 字符串(持久化时间戳用)。"""
    return datetime.now(UTC).isoformat()


def _load() -> dict[str, dict[str, Any]]:
    """读取全部启用记录;文件缺失 / 损坏 / 非对象时返回空 dict(异常降级)。"""
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


def get_enabled_map() -> dict[str, bool]:
    """返回 {capability_id: enabled} 映射(副本)。"""
    with _LOCK:
        return {k: bool(v.get("enabled")) for k, v in _load().items()}


def is_enabled(cap_id: str) -> bool:
    """某能力是否启用;未记录(默认)返回 True。"""
    with _LOCK:
        rec = _load().get(cap_id)
        return True if rec is None else bool(rec.get("enabled"))


def set_enabled(cap_id: str, enabled: bool) -> dict[str, Any] | None:
    """设置某能力的启用状态并更新时间戳。

    Returns:
        更新后的记录 {capability_id, enabled, updated_at};
        写失败返回 None。
    """
    with _LOCK:
        records = _load()
        rec = records.get(cap_id, {})
        rec["enabled"] = bool(enabled)
        rec["updated_at"] = now_iso()
        records[cap_id] = rec
        if _write(records):
            return {"capability_id": cap_id, **rec}
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
