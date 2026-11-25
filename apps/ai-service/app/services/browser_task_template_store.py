# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""用户级 Browser Hub 自定义任务模板持久化(2026-11-26 立)。

对齐 TRAE 画中画文章里的「任务模板」可管理形态:
- 内置四套只读模板仍在 `browser_task.BUILTIN_TASK_TEMPLATES`;
- 这里只存用户自建模板,按 `user_id` 分桶,跨设备/重启不丢;
- 保存前复用 `browser_task.normalize_task` 的同一套校验(目标/要求/检查点/超时),
  不再写第二份判据;
- 原子写(同目录临时文件 + `replace`),读侧永不会看到半截 JSON。

存储位置:`apps/ai-service/data/browser_task_templates.json`(gitignored 运行态数据)。
"""

from __future__ import annotations

import json
import re
import threading
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .browser_task import TaskValidationError, normalize_task

_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "browser_task_templates.json"
_LOCK = threading.RLock()
_MAX_TEMPLATES_PER_USER = 20
_MAX_NAME_CHARS = 40
_TEMPLATE_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


class TemplateStoreUnread(OSError):
    """存储读不到或损坏。写入前必须报错,不能把旧数据覆盖成空。"""


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _load(*, for_update: bool = False) -> dict[str, list[dict[str, Any]]]:
    try:
        _STORE_PATH.stat()
    except FileNotFoundError:
        return {}
    except OSError as exc:
        raise TemplateStoreUnread(f"模板存储读不到: {exc}") from exc
    try:
        raw = _STORE_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        raise TemplateStoreUnread(f"模板存储读不到: {exc}") from exc
    if raw.strip() == "":
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        if for_update:
            raise TemplateStoreUnread("模板存储损坏,拒绝覆盖") from exc
        return {}
    if not isinstance(data, dict):
        if for_update:
            raise TemplateStoreUnread("模板存储损坏,拒绝覆盖")
        return {}
    users: dict[str, list[dict[str, Any]]] = {}
    for user_id, items in data.get("users", {}).items():
        if isinstance(user_id, str) and isinstance(items, list):
            users[user_id] = [item for item in items if isinstance(item, dict)]
    return users


def _write(users: dict[str, list[dict[str, Any]]]) -> None:
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = _STORE_PATH.with_suffix(".json.tmp")
    tmp_path.write_text(
        json.dumps({"version": 1, "users": users}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    tmp_path.replace(_STORE_PATH)


def _clean_user_id(user_id: str) -> str:
    value = str(user_id or "").strip()
    if not value or len(value) > 128:
        raise TaskValidationError("template_invalid_user", "用户身份非法")
    return value


def _clean_name(raw: object) -> str:
    name = str(raw or "").strip()
    if not name:
        raise TaskValidationError("template_invalid_name", "模板名称不能为空")
    if len(name) > _MAX_NAME_CHARS:
        raise TaskValidationError("template_invalid_name", f"模板名称最长 {_MAX_NAME_CHARS} 字符")
    return name


def _clean_id(raw: object, *, allow_new: bool) -> str:
    value = str(raw or "").strip().lower()
    if not value and allow_new:
        return f"custom-{uuid.uuid4().hex[:12]}"
    if not value or not _TEMPLATE_ID_RE.match(value):
        raise TaskValidationError(
            "template_invalid_id",
            "模板 id 只允许小写字母、数字、下划线和连字符(1-32 位)",
        )
    if not value.startswith("custom-"):
        raise TaskValidationError("template_invalid_id", "自定义模板 id 必须以 custom- 开头")
    return value


def _normalize_template(payload: dict[str, Any], *, template_id: str, name: str) -> dict[str, Any]:
    task = normalize_task(
        {
            "goal": payload.get("goal"),
            "requirements": payload.get("requirements"),
            "checkpoints": payload.get("checkpoints"),
            "checkpoint_timeout_seconds": payload.get("checkpoint_timeout_seconds"),
        }
    )
    checkpoints = [
        {
            "id": cp["id"],
            "label": cp["label"],
            "match": cp["match"],
            "label_key": cp.get("label_key"),
        }
        for cp in task["checkpoints"]
    ]
    return {
        "id": template_id,
        "name": name,
        "goal": task["goal"],
        "requirements": task["requirements"],
        "checkpoints": checkpoints,
        "checkpoint_timeout_seconds": task["checkpoint_timeout_seconds"],
        "updated_at": _now_iso(),
    }


def list_custom_templates(user_id: str) -> list[dict[str, Any]]:
    owner = _clean_user_id(user_id)
    with _LOCK:
        return [dict(item) for item in _load().get(owner, [])]


def get_custom_template(user_id: str, template_id: str) -> dict[str, Any] | None:
    owner = _clean_user_id(user_id)
    wanted = str(template_id or "").strip().lower()
    with _LOCK:
        for item in _load().get(owner, []):
            if item.get("id") == wanted:
                return dict(item)
    return None


def upsert_custom_template(user_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """创建或按 id 更新;返回保存后的模板。"""
    owner = _clean_user_id(user_id)
    name = _clean_name(payload.get("name"))
    template_id = _clean_id(payload.get("id"), allow_new=True)
    template = _normalize_template(payload, template_id=template_id, name=name)
    with _LOCK:
        users = _load(for_update=True)
        items = users.get(owner, [])
        index = next((i for i, item in enumerate(items) if item.get("id") == template_id), None)
        if index is None:
            if len(items) >= _MAX_TEMPLATES_PER_USER:
                raise TaskValidationError(
                    "template_limit",
                    f"每个账号最多保存 {_MAX_TEMPLATES_PER_USER} 个自定义模板",
                )
            items.append(template)
        else:
            items[index] = template
        users[owner] = items
        _write(users)
    return dict(template)


def delete_custom_template(user_id: str, template_id: str) -> bool:
    owner = _clean_user_id(user_id)
    wanted = str(template_id or "").strip().lower()
    if not wanted:
        raise TaskValidationError("template_invalid_id", "模板 id 不能为空")
    with _LOCK:
        users = _load(for_update=True)
        items = users.get(owner, [])
        remaining = [item for item in items if item.get("id") != wanted]
        if len(remaining) == len(items):
            return False
        users[owner] = remaining
        _write(users)
    return True


def expand_custom_template(
    template: dict[str, Any],
    *,
    goal_override: str | None = None,
    checkpoint_timeout_seconds: int | None = None,
) -> dict[str, Any]:
    """把用户模板展开成 `start_task` 可消费的完整载荷(不再查目录)。"""
    payload = {
        "template_id": template["id"],
        "goal": goal_override or template["goal"],
        "requirements": list(template.get("requirements") or []),
        "checkpoints": [dict(cp) for cp in template.get("checkpoints") or []],
        "checkpoint_timeout_seconds": checkpoint_timeout_seconds
        if checkpoint_timeout_seconds is not None
        else template.get("checkpoint_timeout_seconds"),
    }
    return payload
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
