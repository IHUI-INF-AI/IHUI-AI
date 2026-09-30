# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D193 任务决策收件箱(2026-09-30 用户拍板,小切口)——「我的待决策」聚合查询。

把散在执行内核里的待决策聚合成一个只读查询(GET /api/agent/decisions/pending):

  ① 工具审批(AgentLoopV2 的 `_approval_registry`):经本票在同文件新增的公开只读
     访问器 `list_pending_approvals()` 读取 —— 访问器与数据同文件(两处算同一件事
     必漂移是本仓记过最多次的失效型)。
  ② request_permissions 的待决权限请求 与 ③ request_user_input 的待决提问:记录住在
     `agent_engine.AgentEngine` 的跨线程待决表里。**该文件他人已暂存(在飞改动),
     本票不碰它、也绝不 import 其私有符号** —— 经 `app.routers.engine` 的公开单例
     `ENGINE`(engine_voice 已有先例)以鸭子读取(getattr)取快照;读不到/不合型
     一律跳过该来源(少显示,不猜属主),绝不据此放行或结算任何东西。

身份纪律(§5):user_id 只从承载层 Depends(get_current_user_id) 进来,不从请求体
或被查记录反推;属主过滤用 `session_store.owner_scoped_allows` 那**一份**只读判据
(带身份时逐字相等,无属主行一律不可见 —— 与 list_threads 的 SQL 过滤同形)。
本端点只读,不结算任何 future —— 结算仍走既有 approval.respond / elicitation.respond
通道(它们自带属主判定)。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.core.jwt_auth import get_current_user_id
from app.services.session_store import owner_scoped_allows

router = APIRouter()

_PREVIEW_MAX_CHARS = 200

# 引擎侧待决表 → 收件箱类型的映射。键是引擎实例上的**私有属性名**,刻意集中在此
# 一处并以 getattr 访问:agent_engine.py 属他人暂存面,字段形态漂了(属性改名/
# 不再是 dict)只影响这里的"读不到 ⇒ 跳过",不炸整个端点。
_ENGINE_PENDING_TABLES: tuple[tuple[str, str], ...] = (
    ("permissions", "_permission_requests"),
    ("elicitation", "_elicitation_requests"),
)


def _owner_str(value: Any) -> str | None:
    """属主值归一:非空字符串才参与属主对账,其余(含 None/空串)一律 None。"""
    return value if isinstance(value, str) and value else None


def _summary_of_tool_approval(item: dict[str, Any]) -> str:
    """工具审批条目的摘要:`工具名: 参数预览`(两者取一也可;与 SSE 预览同源)。"""
    tool = str(item.get("tool_name") or "").strip()
    preview = str(item.get("args_preview") or "").strip()
    if tool and preview:
        return f"{tool}: {preview[:_PREVIEW_MAX_CHARS]}"
    return tool or preview


def _engine_pending_snapshots() -> list[dict[str, Any]]:
    """引擎侧待决(request_permissions / request_user_input)的鸭子读取快照。

    为什么 getattr 而不是 import 私有符号:agent_engine.py 属他人暂存面,符号导入
    会把本票钉死在它的私有形态上;逐字段 getattr 对"字段还在"是松耦合 —— 表不在
    (非 dict)⇒ 该来源为空;单条记录 future 已 done(已结算/已超时)⇒ 不再是
    待决策。引擎待决记录不带时间戳且不带问题/权限文本(不可加字段)⇒ summary 为
    空串、createdAt 为 None,前端按类型落类型标签。
    """
    # 延迟导入:与 main.py 的延迟注册同一时序,不在 import 本模块时构造引擎单例。
    from app.routers.engine import ENGINE

    snapshots: list[dict[str, Any]] = []
    for kind, attr in _ENGINE_PENDING_TABLES:
        table = getattr(ENGINE, attr, None)
        if not isinstance(table, dict):
            # 引擎形态漂了 ⇒ 该来源跳过(少显示),不猜、不报错(只读查询不该因
            # 它人文件的内部形态翻红)。
            continue
        for request_id, record in table.items():
            future = getattr(record, "future", None)
            if future is not None and callable(getattr(future, "done", None)) and future.done():
                continue
            snapshots.append(
                {
                    "id": str(request_id),
                    "owner_user_id": _owner_str(getattr(record, "user_id", None)),
                    "thread_id": _owner_str(getattr(record, "thread_id", None)),
                    "type": kind,
                    "summary": "",
                    "created_at": None,
                }
            )
    return snapshots


@router.get("/agent/decisions/pending")
async def list_pending_decisions(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, object]:
    """「我的待决策」聚合(只读)。身份只取承载层令牌主体,属主过滤走 owner_scoped_allows。"""
    # 延迟导入:让"聚合端点存在"不等于"主循环模块被端点 import 链拉起"(测试可整体替换)。
    from app.services.agent_loop_v2 import list_pending_approvals

    items: list[dict[str, object]] = []
    for entry in list_pending_approvals():
        if not owner_scoped_allows(user_id, _owner_str(entry.get("owner_user_id"))):
            continue
        items.append(
            {
                "id": str(entry.get("id") or ""),
                "threadId": _owner_str(entry.get("thread_id")),
                "type": "tool_approval",
                "summary": _summary_of_tool_approval(entry),
                "createdAt": _owner_str(entry.get("created_at")),
            }
        )
    for entry in _engine_pending_snapshots():
        if not owner_scoped_allows(user_id, entry["owner_user_id"]):
            continue
        items.append(
            {
                "id": entry["id"],
                "threadId": entry["thread_id"],
                "type": entry["type"],
                "summary": str(entry.get("summary") or ""),
                "createdAt": entry.get("created_at"),
            }
        )
    return {"code": 0, "message": "ok", "data": {"items": items, "total": len(items)}}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
