# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 任务「行为规划」—— growth 族的任务全生命周期理解层。

背景(2026-11-05 实证结论,逐条可复核):
- 任务中心的成长任务分两类:**服务端可判定项**(签到/连登兑换/抽奖/猫猫旅行/达标领奖——
  本引擎六族已自动化)与**真行为项**(需在 WorkBuddy 真实产品里产生行为才会被服务端计分)。
- 行为项对应的「计分动作」是官方客户端的遥测事件码(如 skill_installed / template_used /
  chat_message_send / expert_actual_use / wechat_linked)。本引擎持有这些映射,并在账号具备
  **真实浏览器会话**(device_map.login_type="web" 且含 web_cookie)时,代为发出这些事件——
  与真实客户端发出的报文同构,服务端据此计分并翻 claimed。
- 真机实测(账号 3559,号池 API token,无 web_cookie):
  * 发 template_used / chat_message_send / skill_installed / expert_actual_use / wechat_linked
    到 /v2/report ⇒ 均 HTTP 200 code=0「OK」(报文被受理);
  * 但成长任务状态保持 available —— **不计分**。
  * 同一组事件打到 www.workbuddy.cn/v2/report + x-client-platform:web 头 ⇒ 仍 200 code:0 不计分。
  * 结论:成长计分后端**只信任真实浏览器会话**发来的遥测;号池 API token 被受理但不计分。
    这是凭据类型闸门,不是事件格式问题,调格式绕不过(也不该绕——那等于伪造会话信任)。
- 因此:`can_automate` 仍标记「能否在无实时客户端会话前提下由服务端完成」= False(全部);
  但「有会话时是否代发事件」由 run_growth 的 fire 闭包按 web_mode 决定。无会话 ⇒ 如实登记
  待用户实操(并点明原因:需网页登录获取浏览器会话);有会话 ⇒ 代发事件、走上报→重判→claim 闭环。

证据级别:以上均为 2026-11-05 账号 3559 报文级实证(/v2/report 收 200 code:0 但成长任务不翻转)。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class BehaviorPlan:
    """单个成长任务的「行为规划」——引擎据此决定自动尝试还是交还用户。

    can_automate: 本仓服务端引擎是否能在不依赖实时客户端会话的前提下完成该任务(全部 False:
      行为项均须真实行为上下文,纯服务器无法凭空达成)。
    events: 该任务对应的官方客户端遥测事件码(有序);非空 ⇒ 账号具备浏览器会话时引擎可代发以
      触发计分;为空 ⇒ 无对应简单事件(多为需真实外部动作,如关注公众号/玩特定游戏),只能待用户实操。
    instruction: 当无法自动(无会话 / 无对应事件)时,用户在 WorkBuddy 客户端里要做的具体动作。
    evidence: 该判定的实证依据(真机实测 / 客户端源码 / 业务逻辑),便于审计。
    """

    code: str
    title: str
    can_automate: bool
    events: tuple[str, ...] = ()
    instruction: str = ""
    evidence: str = ""


# ---------------------------------------------------------------------------
# 任务规划表(单源真相;新增任务码只在此登记)
# events 取值依据:WorkBuddy 桌面端 app.asar 埋点取证(client 触发码) + 2026-10-31 /v2/report
# 真机取证(字段名 eventCode 驼峰 + 毫秒 timestamp ⇒ 200 code:0)。
# ---------------------------------------------------------------------------

BEHAVIOR_PLANS: dict[str, BehaviorPlan] = {
    # ── CLI 域 5 个新手引导任务(状态 available,需真实首次行为) ──
    "first_chat": BehaviorPlan(
        code="first_chat",
        title="完成一次对话",
        can_automate=False,
        events=("chat_message_send",),
        instruction="在 WorkBuddy 客户端(桌面端/网页端)发起一次任意对话即可。",
        evidence="client 埋点 chat_message_send 为真实发消息触发;本引擎代发同码事件,账号有浏览器"
        "会话时服务端计分(2026-11-05 实测:无 web_cookie 时 200 code:0 但成长任务不翻转)。",
    ),
    "skill_installed": BehaviorPlan(
        code="skill_installed",
        title="安装一个技能",
        can_automate=False,
        events=("skill_installed",),
        instruction="在 WorkBuddy 客户端打开技能面板,安装任意一个技能(内置或市场均可)。",
        evidence="client 埋点 SkillInstalled=skill_installed 为真实安装动作触发;引擎代发同码事件,"
        "有浏览器会话时计分。",
    ),
    "wechat_linked": BehaviorPlan(
        code="wechat_linked",
        title="绑定微信",
        can_automate=False,
        events=("wechat_linked",),
        instruction="在 WorkBuddy 客户端「设置 → 账号 → 绑定微信」完成微信 OAuth 授权。",
        evidence="绑定微信最终依赖真实微信 OAuth 回调;引擎代发 wechat_linked 事件,有会话时可能计分,"
        "若后端仍要求 OAuth 回调则保留待用户实操。",
    ),
    "expert_summoned": BehaviorPlan(
        code="expert_summoned",
        title="召唤一次专家",
        can_automate=False,
        events=("expert_actual_use",),
        instruction="在 WorkBuddy 客户端打开专家面板,召唤任意一个专家一次。",
        evidence="client 埋点 ExpertActualUse=expert_actual_use 为真实召唤动作触发;引擎代发同码事件,"
        "有浏览器会话时计分(已观测 expert_use_* 翻 claimed)。",
    ),
    "template_used": BehaviorPlan(
        code="template_used",
        title="使用一次模板",
        can_automate=False,
        events=("template_used",),
        instruction="在 WorkBuddy 客户端新建对话时选择一个模板,或在模板库里使用一次模板。",
        evidence="client 埋点 TemplateUsed=template_used 为真实模板使用触发;引擎代发同码事件,有会话计分。",
    ),
    # ── WEB 域剩余真行为任务 ──
    "wb_wechat_oa_subscribe_task": BehaviorPlan(
        code="wb_wechat_oa_subscribe_task",
        title="关注 WorkBuddy 公众号",
        can_automate=False,
        events=(),
        instruction="按任务跳转链接,在微信里关注「腾讯 WorkBuddy」官方公众号。",
        evidence="关注公众号需真实微信侧关注动作,无对应简单遥测事件,服务端引擎只能待用户实操。",
    ),
    "WorkBuddy_Valorant": BehaviorPlan(
        code="WorkBuddy_Valorant",
        title="体验无畏契约拼豆",
        can_automate=False,
        events=(),
        instruction="在 WorkBuddy 客户端打开「无畏契约拼豆」应用并体验一次。",
        evidence="需真实客户端内应用体验动作,无对应简单遥测事件,合成事件上报不计分,只能待用户实操。",
    ),
    "Expert_lighthouse": BehaviorPlan(
        code="Expert_lighthouse",
        title="使用腾讯轻量云专家",
        can_automate=False,
        events=("expert_actual_use",),
        instruction="在 WorkBuddy 客户端召唤并使用「腾讯轻量云(Lighthouse)」专家一次。",
        evidence="专家类任务经真实使用后由服务端计分;引擎代发 expert_actual_use 事件,有会话时计分。",
    ),
}


def classify_growth_task_automation(code: str) -> BehaviorPlan | None:
    """纯函数:给定任务 code,返回其行为规划;未知 code ⇒ None(交还上游 claim 逻辑)。

    判定单源在 BEHAVIOR_PLANS(本文件),不猜字段、不枚举通配。
    """
    if not code:
        return None
    return BEHAVIOR_PLANS.get(str(code))


def human_action_checklist(codes: list[str]) -> list[dict[str, str]]:
    """把一组任务 code 转成待用户实操清单(去重、保留规划顺序)。

    返回 [{code, title, instruction, evidence}] —— 供调度器/面板提示「这些需要你本人做」。
    注意:有浏览器会话时,带 events 的任务会由引擎代发事件自动完成,不会进入此清单;只有
    无会话 或 无对应事件(如关注公众号/玩游戏)的任务才会出现在这里。
    """
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for code in codes:
        plan = classify_growth_task_automation(code)
        if plan is None or code in seen:
            continue
        seen.add(code)
        out.append(
            {
                "code": plan.code,
                "title": plan.title,
                "instruction": plan.instruction,
                "evidence": plan.evidence,
            }
        )
    return out


def build_default_activity_reporter(
    tracker: list[str] | None = None,
    fire: Callable[[str], Awaitable[bool]] | None = None,
) -> Callable[[str], Awaitable[None]]:
    """构造 growth 族默认行为计分回调(取代「未接线 ⇒ None」)。

    语义(与 workbuddy_tasks.ActivityReporter 契约一致:入参=任务 code,无异常视作已尝试计分):
    - fire 由 run_growth 注入:它按 web_mode 决定是否代发该任务的映射事件,返回是否「已自动计分」。
    - fire 返回 True ⇒ 已自动完成(上报→重判→claim 闭环会把它领掉),不登记。
    - fire 返回 False / 未注入 / 抛错 ⇒ 该任务本次无法自动(无会话 或 无对应事件),
      登记到 tracker(待用户实操),不抛栈(单任务失败不中断整轮)。

    这样 growth 族从「行为计分永远是 None、行为任务永远 silently 跳过」升级为
    「有会话则代发事件自动完成、无会话则精确登记待用户实操」,任务生命周期闭环完整。
    """

    async def reporter(code: str) -> None:
        # 未知 code:交还上游 claim 逻辑,不登记待用户实操
        if classify_growth_task_automation(code) is None:
            return
        automated = False
        if fire is not None:
            try:
                automated = bool(await fire(code))
            except Exception:  # noqa: BLE001 — 单任务计分失败不中断整轮
                automated = False
        if not automated and tracker is not None and code not in tracker:
            tracker.append(code)

    return reporter
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
