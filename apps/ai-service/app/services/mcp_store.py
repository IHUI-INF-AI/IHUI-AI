# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MCP 应用商店安装状态持久化(2026-09-02 立,P2-1)。

把"商店安装的 MCP Server"状态落到 JSON 文件,重启不丢:
- 无 DB 依赖,风格对齐 mcp_directory(纯文件读写 + 异常降级)
- 记录结构:
  {
    "name": "filesystem",            # 唯一标识(与 stdio 热挂载名一致,2026-09-02 起用 key
                                     # 而非 mcp:{key}——bridge 名校验禁冒号)
    "key": "filesystem",             # 目录条目 key
    "owner_user_id": "42",           # 安装者(承载层注入的令牌主体);"" = 存量/部署级,见 mutate_decision
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
- **启停/卸载/覆盖的归属判据(2026-09-29 立 G-371 格②;同日按机主拍板收紧无主档)**:
  安装记录今天全站可见(它挂的是进程级 stdio 工具池,不是个人配置),但**改它**必须有归属。
  三档(唯一一份实现在 `mutate_decision`,端点不得各写一遍):
    1. 属主 == 调用者 ⇒ 可改;
    2. 记录**无属主**(`owner == ""`,存量)⇒ **只有管理员**可改;
    3. 属主是别人 ⇒ 普通用户一律不可改,**管理员可改**(管理员是这一台的运维主体 ——
       否则平台装的 Server 出了故障没人能停;这一档放行必须**记 warning**,不得静默)。
  **旧行为与改它的时间点(留痕,防被读成"一直是这样")**:第 2 档在 2026-09-29 当天早些
  时候(G-371 格②)刻意是"任何已登录主体可改"的回退档,理由写在当时的归属判据文档串里
  (那一版还是个布尔出口 `can_mutate`,2026-09-29 收紧后其调用方全数改读 `mutate_decision`,
  它已被删除 —— 要回看原文用 `git log -S can_mutate -- app/services/mcp_store.py`) ——
  收紧的前置是"先由人逐条认领"。机主 2026-09-29 直接拍了另一半:连接器维持现状
  (无主记录对所有人不可见、只有人工认领才复活),**商店改成只有管理员能改无主记录**。
  所以这一档不再是回退,而是决定;`connector_store` 的读侧语义按拍板**未动**。
- **角色从哪来**:管理员判定只认 `app/core/jwt_auth.resolve_request_role_id` 那一个出口
  (roleId >= 1,与 AGENTS §5 同档)。本模块是 store 层,**不碰 HTTP 对象** —— 角色由承载层
  作为入参传进来,缺省 0 = 普通用户(fail-closed:只带 user_id 不带角色的调用不得被当管理员)。
- 读写失败降级:读失败返回空列表/None,写失败返回 False,不抛异常不崩服务
- 进程内加锁防止并发写坏文件(跨进程并发不在本模块职责内)
"""

from __future__ import annotations

import json
import threading
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .connector_store import OWNER_FIELD as OWNER_FIELD  # 显式 re-export:属主键名只有一份定义

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


def owner_of(name: str) -> str | None:
    """该安装记录的属主;"" = 存量/部署级;未安装返回 None。"""
    rec = get_installed(name)
    if rec is None:
        return None
    return str(rec.get(OWNER_FIELD) or "")


#: 管理员门槛(roleId >= 1)—— 与 AGENTS §5「admin 路由用 preHandler 统一校验(roleId >= 1)」
#: 及 `app/routers/usage.py` 的 `ADMIN_ROLE_ID` 同一条口径,不得在别处再拍一个数。
ADMIN_ROLE_ID = 1

#: `mutate_decision` 的四个结论(字符串常量,便于承载层按档记日志/回文案)。
MUTATE_BY_OWNER = "by_owner"  # 属主本人
MUTATE_BY_ADMIN = "by_admin"  # 管理员越档改(无主记录或别人的记录)⇒ 放行但必须留痕
MUTATE_DENIED = "denied"  # 既不是属主也不是管理员
MUTATE_MISSING = "missing"  # 没有这条安装记录(承载层回 404)


def is_admin_role(role_id: int) -> bool:
    """这一档角色算不算管理员。**只**接受由 `jwt_auth.resolve_request_role_id` 取出的整数。

    非整数/None 一律按普通用户(fail-closed:角色取不到绝不等于放开)。
    """
    return isinstance(role_id, int) and not isinstance(role_id, bool) and role_id >= ADMIN_ROLE_ID


def mutate_decision(name: str, caller_user_id: str, caller_role_id: int = 0) -> str:
    """这条安装记录当前主体能不能改 —— **唯一一份判据**,返回上面四个常量之一。

    三档语义见模块文档串。刻意**只**返回结论枚举,不提供布尔版:布尔会把"不是你的"与
    "没这条"压成同一个 False,而这一面刻意区分(商店列表全站可见,详情再装看不见就与
    列表自相矛盾),而且承载层必须能认出"管理员越档"那一档才能留痕。曾经有一个
    `can_mutate` 布尔投影,2026-09-29 按机主拍板收紧无主档后它的调用方全部改用本函数,
    于是被删 —— 留一个更弱的入口,下一次就有人用它,而它给不出该给的那两句文案。

    第三参数缺省 0 是刻意的:只带主体不带角色的调用**不得**被当管理员(fail-closed)。
    """
    owner = owner_of(name)
    if owner is None:
        return MUTATE_MISSING
    # 空 caller_user_id 不算"和无主记录同属主":`owner == ""` 只能由管理员改。
    if owner and owner == str(caller_user_id or ""):
        return MUTATE_BY_OWNER
    if is_admin_role(caller_role_id):
        return MUTATE_BY_ADMIN
    return MUTATE_DENIED
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
