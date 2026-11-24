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
        "write": True,
        "read_endpoints": [
            "POST /alice/ug/campaign/v3/detail/(客户端指纹:aid=582478+device_id+pc_client)",
        ],
        "write_endpoints": [
            "POST /alice/ug/campaign/landing/checkin(scene=daily_signin)",
            "POST /alice/ug/campaign/item/reward/claim/(任务/里程碑领奖,三分支参数)",
            "POST /alice/ug/event/report(scene=client_action / campaign_type,含 message_id)",
        ],
        "evidence": (
            "app/services/checkin_doubao.py(线上 bundle 2198.4e43149d / 709.b4632b25 / "
            "agent-explore_page.b285c6b3 逐字实证)"
        ),
        "note": (
            "任务族清单/领奖/行为上报/任务实例开启(campaign_task_click)均已实证;"
            "生成类任务(GenWord/GenExcel/GenPPT)跑推荐 prompt 后,用 SSE_ACK 的 "
            "question_id 调 EventReport(scene=campaign_type, message_id=question_id)"
            "即可计完成再领奖(2026-11-17 实弹实证 task_status=2),已开启全自动;"
            "ScheduleSkill/WorkTaskMode:job_cron 协议已全打通(2026-11-17 二次实证)——"
            "纯 HTTP 可建 cron,必填 schedule.repeat_type=3(Daily;传 1/4/5 报 710010202"
            "=参数非法,非风控),create+/run 触发均 code 0 且产出真实 cron 会话;"
            "但用该 cron 会话 chat_id 上报 EventReport 仍恒拒 625002003、task_status 不翻转"
            "(两账号反复验证)。三次实证确认完成 root 在桌面端本地技能安装:① WorkTask "
            "mode_id=4 chat 的云端 general-agent 亲口回「没有定时任务调用工具」不建 cron;② "
            "schedule 技能真身 doubao-cron-scheduler(external_skill_id=348923904514),"
            "/alice/office/skills/add 返回 code 0 但幂等空响应,list_my 仍空、agent 仍报无此"
            "技能 ⇒ 技能经 neotix.taskModeRuntime.installSkill 落本地技能运行时,云端 add "
            "不注入 agent 工具集;③ 上报换 scene=chat + message-sent/skill-added kind + "
            "skill_id 仍 625002003。技能激活已穷尽(2026-11-17 三轮,从号池解 Fernet 取真实 "
            "sessionid 实弹):get_detail/detail、install_type=0/2/3/4、set_enabled/enable/"
            "update_status 全部 code 0 空响应且 list_my 恒空;**控制实验定谳**——传假 skill_id "
            "(999999999999)与真技能 ID 走 add 回报完全一致(同 code 0 空响应),证明该端点不校验 "
            "ID、不持久化、是 no-op,code 0 是空洞成功而非真安装。第四轮定谳(2026-11-17 14:xx)"
            "纠正上句归因:625002003 msg 逐字=「暂无活动资格」,与 message_id 形态无关(普通/"
            "WorkTask question_id、conversation_id、带 task_id、status1/4、三号全部同样拒绝);"
            "反证同链路生成类恒 status=2 ⇒ 上报通道本身通,真因是该 item 完成判定绑定客户端"
            "技能运行时本地签名事件,号池号 skills/list_my 恒 data=null 无技能 ⇒ 外部 HTTP "
            "无法伪造,不是单纯'技能未激活'。纯 HTTP 无从让该事件产生 ⇒ 不代跑。"
            "号池探底(2026-11-17):5 启用号 cookie 普遍有效(15754320340 "
            "已签到),710010702 是批量连打的账号级频控期(引擎 _classify_code 已归 "
            "BusinessError+3600s 冷却,调度层定时重试,无需新增退避);「李总」code=2 不在 "
            "pc_incentive_task_mvp_v3 活动分组(账号侧资格,非 bug);多 profile 并行证伪"
            "(Doubao.exe --profile-directory 单实例锁定,参数不生效)"
        ),
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
