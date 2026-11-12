# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""任务族能力登记表(2026-11-12 立)。

立因:号池「做任务 / 领积分」此前只在 WorkBuddy 域落地,其余平台在任务端点里被一句
通用文案拒绝,分不清「平台本来没有任务体系」和「有端点但未取证」。按 §0.3/§0.8,
未取证就不写侧、也不冒充支持 —— 但必须能点名**为什么**没接、证据在哪。

本模块是那份证据的唯一登记处(§0.6 单源):
  - read  = 已实证的只读任务端点(能做清单展示)
  - write = 已实证的领取/执行端点(能做写侧自动化)
  - evidence = 证据落点(源码文件:行),新增/变更必须同批更新这里

`task_capability_reason()` 产出面向用户的一句话原因,任务端点的拒绝分支只许调用它,
不得在路由里再抄一份措辞。写侧是否真的开放仍由 WORKBUDDY_TASKS_ENABLED +
WORKBUDDY_TASKS_LIVE_RUN 双门控决定 —— 本表只回答「协议是否已实证」。
"""

from __future__ import annotations

from typing import Any, Final

# 平台 → 能力。`read`/`write` 为协议取证结论,不随运行开关变化。
TASK_CAPABILITIES: Final[dict[str, dict[str, Any]]] = {
    "workbuddy": {
        "read": True,
        "write": True,
        "read_endpoints": ["Growth 任务清单(workbuddy_tasks.list_growth_tasks)"],
        "write_endpoints": [
            "growth/travel/activity/blackcat 族(workbuddy_tasks.run_family)",
            "全量自动领(workbuddy_autopilot.run_autopilot)",
        ],
        "evidence": "app/services/workbuddy_tasks.py, app/services/workbuddy_autopilot.py",
    },
    "doubao": {
        "read": True,
        "write": False,
        "read_endpoints": ["GET /alice/ug/campaign/landing/checkin(detail 内的 tasks 列表)"],
        "write_endpoints": ["POST /alice/ug/campaign/landing/checkin(scene=daily_signin)"],
        "evidence": "app/services/checkin_doubao.py:17-18",
        "note": "只实证 daily_signin 一项的领取;其余 task_kind 的领取参数未取证 ⇒ 不做通用写侧",
    },
    "raccoon": {
        "read": True,
        "write": False,
        "read_endpoints": ["GET /api/web/points/v1/tasks(新手任务态)"],
        "write_endpoints": [
            "POST /api/web/desktop/v1/login/points/grant",
            "POST /api/web/mobile/v1/login/points/grant",
        ],
        "evidence": "app/services/checkin_raccoon.py:23-36",
        "note": "新手任务由登录事件驱动、只有发放端点;通用任务领取未取证 ⇒ 不做通用写侧",
    },
    "trae": {
        "read": False,
        "write": False,
        "read_endpoints": [],
        "write_endpoints": [],
        "evidence": "app/services/checkin_engine.py:56-57(仅每日签到 claim/status,无 growth 任务体系)",
        "note": "只有每日签到领取 Credits,未取证任何任务端点 ⇒ 未对接",
    },
    "qoder": {
        "read": False,
        "write": False,
        "read_endpoints": [],
        "write_endpoints": [],
        "evidence": "app/services/checkin_qoder.py:56-58(Campaign 每日领取 Credits,非通用任务清单)",
        "note": "Campaign 是每日 Credits 领取(调度器每日跑),非 growth 任务族;未取证任务端点 ⇒ 未对接",
    },
    "minimax": {
        "read": False,
        "write": False,
        "read_endpoints": [],
        "write_endpoints": [],
        "evidence": "app/services/checkin_minimax.py(仅状态/领取积分,无任务端点)",
        "note": "未取证任何任务端点",
    },
}

_WORKBUDDY_REASON_SUFFIX: Final = "任务族执行仍受 WORKBUDDY_TASKS_ENABLED / WORKBUDDY_TASKS_LIVE_RUN 双门控约束"


def task_capability(platform: str) -> dict[str, Any] | None:
    """返回该平台的取证结论;未登记 ⇒ None(未判定,不是「不支持」)。"""
    return TASK_CAPABILITIES.get(str(platform or ""))


def task_capability_reason(platform: str, mode: str) -> str:
    """任务端点拒绝非 WorkBuddy 平台时的人读原因(唯一起草处)。

    mode:'read' | 'write'。未登记平台如实报「未取证」,不冒充「平台没有」。
    """
    cap = task_capability(platform)
    if cap is None:
        return f"平台 {platform} 未取证任务端点 ⇒ 未对接(不伪造)"
    if mode == "read":
        if cap["read"]:
            return f"平台 {platform} 的任务清单已取证但尚未接入本端点({cap['evidence']})"
        return f"平台 {platform} 未取证只读任务端点 ⇒ 未对接({cap['evidence']})"
    if cap["write"]:
        return f"平台 {platform} 的写侧已取证但尚未接入本端点({cap['evidence']})"
    note = str(cap.get("note") or "").strip()
    base = f"平台 {platform} 未取证通用任务领取 ⇒ 未对接({cap['evidence']})"
    return f"{base};{note}" if note else base


def capability_snapshot() -> dict[str, dict[str, Any]]:
    """只读快照(供自检/测试断言覆盖度,不参与运行判据)。"""
    return {platform: dict(cap) for platform, cap in TASK_CAPABILITIES.items()}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
