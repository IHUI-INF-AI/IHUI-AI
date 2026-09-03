# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""MCP 应用商店安装状态持久化(2026-09-02 立,P2-1)。

把"商店安装的 MCP Server"状态落到 JSON 文件,重启不丢:
- 无 DB 依赖,风格对齐 mcp_directory(纯文件读写 + 异常降级)
- 记录结构:
  {
    "name": "filesystem",            # 唯一标识(与 stdio 热挂载名一致,2026-09-02 起用 key
                                     # 而非 mcp:{key}——bridge 名校验禁冒号)
    "key": "filesystem",             # 目录条目 key
    "transport": "stdio",
    "command": "npx",
    "args": [...],
    "env": {...},
    "installed": true,
    "enabled": true,
    "installed_at": "ISO 时间",
    "tool_count": 0,
    "last_error": ""
  }
- 读写失败降级:读失败返回空列表/None,写失败返回 False,不抛异常不崩服务
- 进程内加锁防止并发写坏文件(跨进程并发不在本模块职责内)
"""

from __future__ import annotations

import json
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# apps/ai-service/data/mcp_store.json(父目录不存在时自动创建)
_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "mcp_store.json"
_LOCK = threading.Lock()


def now_iso() -> str:
    """当前 UTC 时间的 ISO 8601 字符串(持久化时间戳用)。"""
    return datetime.now(UTC).isoformat()


def _load() -> list[dict[str, Any]]:
    """读取全部安装记录;文件缺失/损坏/非列表时返回空列表(异常降级)。"""
    try:
        if not _STORE_PATH.exists():
            return []
        raw = _STORE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:  # noqa: BLE001 - 读失败返回空列表,不崩服务
        return []


def _write(records: list[dict[str, Any]]) -> bool:
    """原子写全部安装记录(临时文件 + replace),失败返回 False。"""
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


def list_installed() -> list[dict[str, Any]]:
    """返回全部已安装记录(副本,修改不影响持久化文件)。"""
    with _LOCK:
        return list(_load())


def get_installed(name: str) -> dict[str, Any] | None:
    """按 name 查安装记录;未安装返回 None。"""
    with _LOCK:
        for rec in _load():
            if rec.get("name") == name:
                return dict(rec)
    return None


def save_installed(record: dict[str, Any]) -> dict[str, Any] | None:
    """新增或覆盖(name 相同)一条安装记录。

    Returns:
        写成功返回入参 record;写失败返回 None。
    """
    with _LOCK:
        records = _load()
        name = record.get("name", "")
        replaced = False
        for i, rec in enumerate(records):
            if rec.get("name") == name:
                records[i] = record
                replaced = True
                break
        if not replaced:
            records.append(record)
        if _write(records):
            return record
    return None


def remove_installed(name: str) -> bool:
    """按 name 删除安装记录。

    Returns:
        True=删除成功(含文件写成功);False=记录不存在或写失败。
    """
    with _LOCK:
        records = _load()
        remaining = [rec for rec in records if rec.get("name") != name]
        if len(remaining) == len(records):
            return False
        return _write(remaining)


def set_enabled(name: str, enabled: bool) -> dict[str, Any] | None:
    """更新指定记录的 enabled 状态并更新时间戳。

    Returns:
        更新后的记录;记录不存在或写失败返回 None。
    """
    with _LOCK:
        records = _load()
        for rec in records:
            if rec.get("name") == name:
                rec["enabled"] = bool(enabled)
                rec["updated_at"] = now_iso()
                if _write(records):
                    return dict(rec)
                return None
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
