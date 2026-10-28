# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy growth 任务族服务层 —— 占位落点(2026-10-28)。

立因(现读证据):`apps/ai-service/app/routers/checkin.py` 在 2026-10-28 20:39 的自动收编
(83f8bade4ed "chore(auto): 收编停留≥3分钟的未提交改动")里已经
`from app.services import workbuddy_tasks` 并注册了 `/tasks` 与 `/task-run` 两个端点,
但本模块的实现从未入库(全仓 `git log --all --diff-filter=AD -- '*workbuddy_tasks*'` 为空,
盘上也查无此文件)。Python 的 `from package import sub` 要求子模块实体存在 ⇒ ImportError
⇒ uvicorn 加载 app 失败 ⇒ 生产 8803 每 30 秒崩溃重启一轮,AI 服务整条不可用。

本文件只提供「不伪造任何结论」的空实现,不冒充功能已就绪:
  · 两个函数按调用方约定的同一形状返回 dict,`ok=False` + `unjudged=True` + 明确 reason;
  · 不发任何出站请求、不读不写任何账本(占位态零副作用,出站闸与限流也无需介入);
  · 真实现落库时整文件替换即可 —— 与 `apps/api/src/routes/admin/relay-switch-admin.ts`
    的占位先例同型:导入面有实体、加载与启动恢复,既不凭空多出接口也不伪造数据。
"""

from __future__ import annotations

from typing import Any

__all__ = ["list_growth_tasks", "run_family"]

_PLACEHOLDER_REASON = (
    "workbuddy_tasks 实现未入库(占位落点):端点已注册但服务层为空实现,"
    "不发请求、不读写账本;真实现落地时整文件替换即可"
)


async def list_growth_tasks(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: Any = None,
) -> dict[str, Any]:
    """成长任务列表 —— 占位:恒 unjudged,不产生任何结论。

    参数与真实现签名保持一致(jwt / device_map / 关键字 client),这样原席把真实现
    落库时调用方一行都不用改。
    """
    _ = (jwt, device_map, client)
    return {
        "ok": False,
        "kind": "list",
        "tasks": [],
        "reason": _PLACEHOLDER_REASON,
        "unjudged": True,
    }


async def run_family(
    kind: str,
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = True,
) -> dict[str, Any]:
    """任务族执行 —— 占位:恒 unjudged,零写侧调用(dry_run 与否都不动作)。"""
    _ = (kind, jwt, device_map, dry_run)
    return {
        "ok": False,
        "kind": kind,
        "accepted": [],
        "claimed": [],
        "credit_delta": None,
        "energy_delta": None,
        "reason": _PLACEHOLDER_REASON,
        "unjudged": True,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
