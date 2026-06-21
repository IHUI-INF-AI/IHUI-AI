"""多租户 ContextVar + 工具函数 (建议 102 阶段 1).

设计:
  - ContextVar 隔离: 每个请求 / 任务独立 tenant_id, 互不污染
  - 单租户模式 (MULTI_TENANT_ENABLED=false) 时永远返回 1, 行为完全兼容
  - schema 名白名单 (regex 校验), 防 SQL 注入
  - None 表示后台任务 / Alembic / 管理脚本, 不切 search_path

注意: get_current_tenant_id 必须在调用方已 set 时才返回非 None;
      get_effective_tenant_id 在多租户关闭时强制返回 1.
"""

import re
from contextvars import ContextVar

_current_tenant_id: ContextVar[int | None] = ContextVar("current_tenant_id", default=None)

# 白名单: tenant_id 范围 1-99999999, schema 名固定前缀
_TENANT_ID_PATTERN = re.compile(r"^tenant_[1-9][0-9]{0,8}$")
_DEFAULT_TENANT_ID = 1
_DEFAULT_SCHEMA_NAME = "tenant_1"


def get_current_tenant_id() -> int | None:
    """获取当前请求所属的 tenant_id.

    返回 None 表示系统调用 (后台任务 / Alembic / 管理脚本),
    此时不切 search_path, 走 public schema.
    """
    return _current_tenant_id.get()


def get_effective_tenant_id() -> int:
    """获取当前生效的 tenant_id (单租户模式强制 1).

    用于日志 / 监控 / 业务查询. 多租户关闭时返回 1, 开启时返回 ContextVar.
    """
    if not is_multi_tenant_enabled():
        return _DEFAULT_TENANT_ID
    tid = _current_tenant_id.get()
    return tid if tid is not None else _DEFAULT_TENANT_ID


def set_current_tenant_id(tid: int | None) -> None:
    """在 FastAPI 依赖 / middleware / 后台任务中调用, 写入 contextvar.

    None 表示重置 (后台任务入口清理状态).
    tid 必须 >= 1 的整数.
    """
    if tid is not None:
        if not isinstance(tid, int) or isinstance(tid, bool) or tid < 1:
            raise ValueError(f"tenant_id 必须是 >= 1 的整数, 实际 {tid!r}")
        if tid > 99999999:
            raise ValueError(f"tenant_id 超出白名单范围, 实际 {tid!r}")
    _current_tenant_id.set(tid)


def reset_current_tenant_id() -> None:
    """清空 tenant_id, 等价 set_current_tenant_id(None)."""
    _current_tenant_id.set(None)


def get_tenant_schema_name(tid: int | None = None) -> str:
    """tenant_id -> schema 名 (白名单防注入).

    校验与 set_current_tenant_id 一致: tid 必须 1 <= tid <= 99_999_999.
    """
    if tid is None:
        tid = get_effective_tenant_id()
    if not isinstance(tid, int) or isinstance(tid, bool) or tid < 1 or tid > 99_999_999:
        raise ValueError(f"非法 tenant_id: {tid!r}")
    name = f"tenant_{tid}"
    if not _TENANT_ID_PATTERN.match(name):
        raise ValueError(f"非法 tenant_id 生成的 schema 名: {name!r}")
    return name


def is_multi_tenant_enabled() -> bool:
    """从 settings 读开关, 单租户模式 (默认) 直接返回 False.

    注意: 延迟 import settings, 避免 settings 初始化顺序问题.
    """
    try:
        from app.config import settings

        return bool(getattr(settings, "MULTI_TENANT_ENABLED", False))
    except Exception:
        return False
