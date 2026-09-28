# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""中文 Connectors 连接器配置持久化(2026-09-02 立,P2-2)。

把"用户配置的连接器"落到 JSON 文件,重启不丢:
- 无 DB 依赖,风格对齐 mcp_store(纯文件读写 + 异常降级 + 线程锁)
- 记录结构(key 为**属主内**唯一标识,格式 {type}:{slug};跨属主互不可见也不可撞):
  {
    "key": "yuque:docs",          # 属主内唯一标识
    "owner_user_id": "42",        # 属主(令牌主体),由承载层显式传入 —— 不接受请求体自报
    "type": "yuque",              # 连接器类型: yuque | feishu | wecom | dingtalk
    "name": "语雀文档库",          # 显示名
    "app_id": "",                 # 开放平台 app_id(语雀免 token 可空)
    "app_secret": "",             # 密钥(可空)
    "extra": {},                  # 类型专属配置(如语雀 {user, repo},飞书 {folder_token})
    "enabled": true,
    "installed_at": "ISO 时间",    # UTC ISO 8601
    "updated_at": "ISO 时间",
    "last_sync_at": "",           # 上次成功同步时间
    "last_error": "",             # 上次失败原因
    "sync_items": [],             # 最近一次 sync 的文档清单 [{doc_id, title}](P2-2 立)
  }
- **属主语义(2026-09-28 落,G-371)**:本模块的读/写/删/状态更新一律按
  `(owner_user_id, key)` 复合身份匹配。别人的记录对当前主体**既读不到也改不动**,
  且返回形态与"根本没这条"逐字同形(False/None) —— 端点因此不会变成存在性预言机。
  历史遗留、没有属主的记录**不列给任何人**(fail-closed),只由 `ownerless_count()`
  在服务端日志里报出 —— 不返回给调用方,免得又开一个"数得清别人有多少配置"的口。
- 读写失败降级:读失败返回空列表/None,写失败返回 False,不抛异常不崩服务
- 进程内加锁防止并发写坏文件(跨进程并发不在本模块职责内)
"""

from __future__ import annotations

import json
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

# apps/ai-service/data/connector_store.json(父目录不存在时自动创建)
_STORE_PATH = Path(__file__).resolve().parents[2] / "data" / "connector_store.json"
_LOCK = threading.Lock()

# 属主字段名 —— 唯一一份,路由与判据都引它,不得在别处再写字符串字面量
OWNER_FIELD = "owner_user_id"


def now_iso() -> str:
    """当前 UTC 时间的 ISO 8601 字符串(持久化时间戳用)。"""
    return datetime.now(UTC).isoformat()


def _load() -> list[dict[str, Any]]:
    """读取全部连接器记录;文件缺失/损坏/非列表时返回空列表(异常降级)。"""
    try:
        if not _STORE_PATH.exists():
            return []
        raw = _STORE_PATH.read_text(encoding="utf-8")
        data = json.loads(raw)
        return data if isinstance(data, list) else []
    except Exception:  # noqa: BLE001 - 读失败返回空列表,不崩服务
        return []


def _write(records: list[dict[str, Any]]) -> bool:
    """原子写全部连接器记录(临时文件 + replace),失败返回 False。"""
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


def list_owned(owner_user_id: str) -> list[dict[str, Any]]:
    """返回**属于该主体**的连接器记录副本(修改不影响持久化文件)。

    空属主直接返回空列表 —— 不接受"空串当所有人"这种隐式全量。
    """
    if not owner_user_id:
        return []
    with _LOCK:
        return [dict(rec) for rec in _load() if rec.get(OWNER_FIELD) == owner_user_id]


def ownerless_count() -> int:
    """没有属主的遗留记录条数(只给服务端日志/巡检用,绝不出现在任何响应体里)。"""
    with _LOCK:
        return sum(1 for rec in _load() if not rec.get(OWNER_FIELD))


def get(owner_user_id: str, key: str) -> dict[str, Any] | None:
    """按 (属主, key) 查连接器记录;不存在或不属于该主体都返回 None(同形)。"""
    if not owner_user_id:
        return None
    with _LOCK:
        for rec in _load():
            if rec.get("key") == key and rec.get(OWNER_FIELD) == owner_user_id:
                return dict(rec)
    return None


def save(owner_user_id: str, record: dict[str, Any]) -> dict[str, Any] | None:
    """新增或覆盖(key 相同**且属主相同**)一条连接器记录。

    属主由承载层显式入参盖章并**强制覆盖**入参里可能自带的值 —— 请求体自报的
    `owner_user_id` 一律不采信(AGENTS §5"认证不等于授权":身份只能从承载层进来)。
    跨属主的同名 key 各自成条,不会互相覆盖(那才是"别人的配置被我一次保存抹掉"的成因)。

    sync_items(最近一次同步的文档清单)缺省落空列表,保证记录结构完整。

    Returns:
        写成功返回入参 record;写失败返回 None。
    """
    if not owner_user_id:
        return None
    with _LOCK:
        record.setdefault("sync_items", [])
        record[OWNER_FIELD] = owner_user_id
        records = _load()
        key = record.get("key", "")
        replaced = False
        for i, rec in enumerate(records):
            if rec.get("key") == key and rec.get(OWNER_FIELD) == owner_user_id:
                records[i] = record
                replaced = True
                break
        if not replaced:
            records.append(record)
        if _write(records):
            return record
    return None


def remove(owner_user_id: str, key: str) -> bool:
    """按 (属主, key) 删除连接器记录。

    Returns:
        True=删除成功(含文件写成功);False=记录不存在、不属于该主体、或写失败。
    """
    if not owner_user_id:
        return False
    with _LOCK:
        records = _load()
        remaining = [
            rec
            for rec in records
            if not (rec.get("key") == key and rec.get(OWNER_FIELD) == owner_user_id)
        ]
        if len(remaining) == len(records):
            return False
        return _write(remaining)


def set_enabled(owner_user_id: str, key: str, enabled: bool) -> dict[str, Any] | None:
    """更新指定记录的 enabled 状态并更新时间戳。

    Returns:
        更新后的记录;记录不存在、不属于该主体或写失败返回 None。
    """
    if not owner_user_id:
        return None
    with _LOCK:
        records = _load()
        for rec in records:
            if rec.get("key") == key and rec.get(OWNER_FIELD) == owner_user_id:
                rec["enabled"] = bool(enabled)
                rec["updated_at"] = now_iso()
                if _write(records):
                    return dict(rec)
                return None
    return None


def set_sync_state(
    owner_user_id: str,
    key: str,
    last_sync_at: str,
    last_error: str,
    items: list[dict[str, Any]] | None = None,
) -> dict[str, Any] | None:
    """更新指定记录的同步状态并更新时间戳。

    成功同步时 last_error 应传空串;失败时 last_error 传失败原因。
    items 非 None 时一并持久化 sync_items(最近一次同步的文档清单),
    不传则保持原值(向后兼容)。
    语义对齐 set_enabled:全部字段缺失时同样补默认值;别人的记录与"没这条"同形返回 None。

    Returns:
        更新后的记录;记录不存在、不属于该主体或写失败返回 None。
    """
    if not owner_user_id:
        return None
    with _LOCK:
        records = _load()
        for rec in records:
            if rec.get("key") == key and rec.get(OWNER_FIELD) == owner_user_id:
                rec["last_sync_at"] = last_sync_at
                rec["last_error"] = last_error
                rec["updated_at"] = now_iso()
                if items is not None:
                    rec["sync_items"] = list(items)
                if _write(records):
                    return dict(rec)
                return None
    return None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
