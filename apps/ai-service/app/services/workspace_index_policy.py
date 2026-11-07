# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作区代码索引开关。

对照里索引不是隐式一直开着:可以逐工作区打开/关闭、自动、开始、取消。
本模块只做这个决定,不读仓库、不发出域请求。

相对「自动打开就恢复索引」多一条:取消之后,set_on 和 set_auto_on 都不揭掉取消,
只有 start 会重新允许。没配置过的工作区保持 implicit,不谎报成用户打开的。
写过的开关落在本仓状态文件里,重启后还在。文件或某一行读不出来时,
那一处不退回默认可索引。
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_ACTIONS = frozenset({"set_on", "set_off", "set_auto_on", "set_auto_off", "start", "cancel"})


@dataclass(frozen=True)
class IndexSetting:
    """一处工作区的开关。enabled 为 None 表示用户没显式拨过开/关。"""

    enabled: bool | None = None
    auto: bool = True
    cancelled: bool = False


@dataclass(frozen=True)
class IndexDecision:
    allow_index: bool
    phase: str
    reason: str


def workspace_key(path: str) -> str:
    """同一目录的两种写法落到同一把钥匙。解析失败时保留原字符串。"""
    try:
        return str(Path(path).resolve())
    except OSError:
        return path


def decide(setting: IndexSetting | None) -> IndexDecision:
    if setting is None:
        return IndexDecision(True, "implicit", "未单独配置,沿用默认可索引")
    if setting.cancelled:
        return IndexDecision(False, "cancelled", "已取消,自动开关和打开都不会重新开始索引")
    if setting.enabled is False:
        return IndexDecision(False, "explicit-off", "该工作区索引已关闭")
    if setting.enabled is True:
        return IndexDecision(True, "explicit-on", "该工作区索引已显式打开")
    if setting.auto:
        return IndexDecision(True, "auto", "未显式拨动,自动索引开着")
    return IndexDecision(False, "auto-off", "自动索引已关,且没有显式打开")


def transition(setting: IndexSetting | None, action: str) -> IndexSetting:
    if action not in _ACTIONS:
        raise ValueError(f"未知的索引开关动作: {action}")
    current = setting or IndexSetting()
    if action == "set_on":
        return IndexSetting(True, current.auto, current.cancelled)
    if action == "set_off":
        return IndexSetting(False, current.auto, current.cancelled)
    if action == "set_auto_on":
        return IndexSetting(current.enabled, True, current.cancelled)
    if action == "set_auto_off":
        return IndexSetting(current.enabled, False, current.cancelled)
    if action == "cancel":
        return IndexSetting(current.enabled, current.auto, True)
    return IndexSetting(True, current.auto, False)


_SETTINGS: dict[str, IndexSetting] = {}
_BAD: set[str] = set()
_FAULT: str | None = None
_LOCK = threading.Lock()
_UNSET = object()
_STORE: Path | None | object = _UNSET


def _default_store_path() -> Path | None:
    raw = os.environ.get("IHUI_WORKSPACE_INDEX_STORE")
    if raw == "":
        return None
    if raw:
        return Path(raw)
    root = Path(__file__).resolve().parents[3]
    return root / ".ihui-agent" / "state" / "workspace-index-settings.json"


def _valid_record(item: object) -> IndexSetting | None:
    if not isinstance(item, dict) or item.get("invalid") is True:
        return None
    enabled = item.get("enabled")
    auto = item.get("auto")
    cancelled = item.get("cancelled")
    if enabled is not None and not isinstance(enabled, bool):
        return None
    if not isinstance(auto, bool) or not isinstance(cancelled, bool):
        return None
    return IndexSetting(enabled, auto, cancelled)


def _load_locked(path: Path) -> None:
    global _FAULT
    _SETTINGS.clear()
    _BAD.clear()
    _FAULT = None
    if not path.exists():
        return
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        _FAULT = "unreadable"
        return
    if not isinstance(payload, dict) or payload.get("version") != 1:
        _FAULT = "bad-version"
        return
    workspaces = payload.get("workspaces")
    if not isinstance(workspaces, dict):
        _FAULT = "bad-version"
        return
    for key, item in workspaces.items():
        if not isinstance(key, str) or not key:
            _FAULT = "bad-version"
            return
        parsed = _valid_record(item)
        if parsed is None:
            _BAD.add(key)
            continue
        _SETTINGS[key] = parsed


def _save_locked() -> None:
    if not isinstance(_STORE, Path):
        return
    workspaces: dict[str, Any] = {
        key: {"enabled": row.enabled, "auto": row.auto, "cancelled": row.cancelled}
        for key, row in _SETTINGS.items()
    }
    for key in _BAD:
        workspaces[key] = {"invalid": True}
    payload = {"version": 1, "workspaces": workspaces}
    _STORE.parent.mkdir(parents=True, exist_ok=True)
    temporary = _STORE.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(_STORE)


def _ensure_store_locked() -> None:
    global _STORE
    if _STORE is _UNSET:
        _STORE = _default_store_path()
        if isinstance(_STORE, Path):
            _load_locked(_STORE)


def bind_index_store(path: Path | None) -> None:
    """测试和显式覆盖用。None 表示只留在内存里。"""
    global _STORE, _FAULT
    with _LOCK:
        _STORE = path
        _SETTINGS.clear()
        _BAD.clear()
        _FAULT = None
        if path is not None:
            _load_locked(path)


def clear_workspace_index_settings() -> None:
    global _FAULT
    with _LOCK:
        _SETTINGS.clear()
        _BAD.clear()
        _FAULT = None
        if isinstance(_STORE, Path) and _STORE.exists():
            _STORE.unlink()


def indexing_decision(workspace_id: str) -> IndexDecision:
    with _LOCK:
        _ensure_store_locked()
        if _FAULT is not None:
            return IndexDecision(False, "unjudged", "索引开关文件读不出来,不按默认可索引")
        if workspace_id in _BAD:
            return IndexDecision(False, "unjudged", "这一处开关形状坏了,不按默认可索引")
        return decide(_SETTINGS.get(workspace_id))


def apply_workspace_index(workspace_id: str, action: str) -> IndexDecision:
    with _LOCK:
        _ensure_store_locked()
        if _FAULT is not None or workspace_id in _BAD:
            return IndexDecision(False, "unjudged", "索引开关读不出来,这次不改也不开始索引")
        updated = transition(_SETTINGS.get(workspace_id), action)
        _SETTINGS[workspace_id] = updated
        _save_locked()
        return decide(updated)


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
