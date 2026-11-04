# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 任务「行为规划」—— growth 族的任务全生命周期理解层。

背景(2026-11-05 实证结论,逐条可复核):
- 任务中心的成长任务分两类:**服务端可判定项**(签到/连登兑换/抽奖/猫猫旅行/达标领奖——
  本引擎六族已自动化)与**真行为项**(需在 WorkBuddy 客户端/真实产品里实操才会被服务端计分)。
- 真机实测:合成行为事件码上报 `/v2/report` 一律 HTTP 200 但**不计分**(`docs/WORKBUDDY_TASKS.md`
  §5 与 workbuddy_tasks 模块 docstring 已记录);而真实客户端行为(如用户真用过某专家)会被服务端
  计分并翻 `claimed`(专家类任务即此路径达成)。
- 进一步实测:用账号 JWT 直接打产品行为端点(如 `/v2/chat/completions`)被 **403**(growth 读侧 200、
  行为端点要实时客户端会话上下文)⇒ 服务端引擎无法以「服务器到服务器」方式伪造真行为。

本模块的定位(机主 2026-11-05 授权「把项目功能开发完整、用我们自己的功能」后重塑):
1. **完整理解任务生命周期**:`list → classify(可判定/待实操) → attempt(可自动则自动,
   不可自动则登记为待用户实操) → re-judge → claim(仅对已 completed 项)`。
2. **不伪造判据链**:行为类任务要么由真实驱动器(将来接入的,持有合法客户端会话的)完成,
   要么如实登记为「待用户在客户端实操」并给出精确指引——绝不发空转刷次数的合成事件。
3. **架构可插拔**:`BehaviorPlan.driver` 是可选的真实行为驱动器(异步);当前本仓尚无持有实时
   客户端会话的驱动器,故所有行为任务默认走「待用户实操」分支。将来接入真实驱动器时,
   只需在此注册,引擎即自动改走自动分支。

证据级别:行为端点 403 / 合成上报不计分 均为 2026-11-05 真机报文级实证。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field


@dataclass(frozen=True)
class BehaviorPlan:
    """单个成长任务的「行为规划」——引擎据此决定自动尝试还是交还用户。

    can_automate: 本仓服务端引擎是否能在不依赖实时客户端会话的前提下完成该任务。
    driver: 可选的真实行为驱动器(异步,入参=任务 code);为 None ⇒ 引擎无法自动完成。
    instruction: 当 can_automate=False 时,用户在 WorkBuddy 客户端里要做的具体动作。
    evidence: 该判定的实证依据(真机实测 / 客户端源码 / 业务逻辑),便于审计。
    """

    code: str
    title: str
    can_automate: bool
    instruction: str = ""
    evidence: str = ""
    driver: Callable[[str], Awaitable[None]] | None = field(default=None, compare=False, repr=False)


# ---------------------------------------------------------------------------
# 任务规划表(单源真相;新增任务码只在此登记)
# 分类判据:是否必须由真实客户端会话/真实人类动作达成(实证结论见模块 docstring)。
# ---------------------------------------------------------------------------

BEHAVIOR_PLANS: dict[str, BehaviorPlan] = {
    # ── CLI 域 5 个新手引导任务(状态 available,需真实首次行为) ──
    "first_chat": BehaviorPlan(
        code="first_chat",
        title="完成一次对话",
        can_automate=False,
        instruction="在 WorkBuddy 客户端(桌面端/网页端)发起一次任意对话即可。",
        evidence="真机实测:用账号 JWT 直打 /v2/chat/completions 被 403(行为端点要实时客户端会话);"
        "合成 chat_request_send 事件上报 200 不计分。",
    ),
    "skill_installed": BehaviorPlan(
        code="skill_installed",
        title="安装一个技能",
        can_automate=False,
        instruction="在 WorkBuddy 客户端打开技能面板,安装任意一个技能(内置或市场均可)。",
        evidence="客户端埋点 SkillInstalled=skill_installed 为真实安装动作触发;服务端按真实安装事件计分,"
        "合成事件上报不计分。",
    ),
    "wechat_linked": BehaviorPlan(
        code="wechat_linked",
        title="绑定微信",
        can_automate=False,
        instruction="在 WorkBuddy 客户端「设置 → 账号 → 绑定微信」完成微信 OAuth 授权。",
        evidence="绑定微信需真实微信 OAuth 回调,服务端引擎无法代为完成。",
    ),
    "expert_summoned": BehaviorPlan(
        code="expert_summoned",
        title="召唤一次专家",
        can_automate=False,
        instruction="在 WorkBuddy 客户端打开专家面板,召唤任意一个专家一次。",
        evidence="客户端埋点 ExpertSummoned=expert_summoned 为真实召唤动作触发;专家类任务经真实使用后"
        "被服务端计分(已观测 expert_use_* 翻 claimed)。",
    ),
    "template_used": BehaviorPlan(
        code="template_used",
        title="使用一次模板",
        can_automate=False,
        instruction="在 WorkBuddy 客户端新建对话时选择一个模板,或在模板库里使用一次模板。",
        evidence="客户端埋点 TemplateUsed=template_used 为真实模板使用动作触发;合成事件上报不计分。",
    ),
    # ── WEB 域剩余真行为任务 ──
    "wb_wechat_oa_subscribe_task": BehaviorPlan(
        code="wb_wechat_oa_subscribe_task",
        title="关注 WorkBuddy 公众号",
        can_automate=False,
        instruction="按任务跳转链接,在微信里关注「腾讯 WorkBuddy」官方公众号。",
        evidence="关注公众号需真实微信侧关注动作,服务端引擎无法代为完成。",
    ),
    "WorkBuddy_Valorant": BehaviorPlan(
        code="WorkBuddy_Valorant",
        title="体验无畏契约拼豆",
        can_automate=False,
        instruction="在 WorkBuddy 客户端打开「无畏契约拼豆」应用并体验一次。",
        evidence="需真实客户端内应用体验动作,合成事件上报不计分。",
    ),
    "Expert_lighthouse": BehaviorPlan(
        code="Expert_lighthouse",
        title="使用腾讯轻量云专家",
        can_automate=False,
        instruction="在 WorkBuddy 客户端召唤并使用「腾讯轻量云(Lighthouse)」专家一次。",
        evidence="专家类任务经真实使用后由服务端计分;需真实客户端会话发起专家对话。",
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
    """
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for code in codes:
        plan = classify_growth_task_automation(code)
        if plan is None or plan.can_automate or code in seen:
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
) -> Callable[[str], Awaitable[None]]:
    """构造 growth 族默认行为计分回调(取代「未接线 ⇒ None」)。

    语义(与 workbuddy_tasks.ActivityReporter 契约一致:入参=任务 code,无异常视作已尝试计分):
    - 命中规划且有真实驱动器 ⇒ 调用驱动器尝试自动完成;
    - 无驱动器 / 驱动器抛错(如实时会话 403)⇒ 登记到 tracker(待用户实操),不抛栈
      (单任务失败不中断整轮,与既有 reporter 契约一致)。
    - 未命中规划(未知 code)⇒ 不动作,交还上游 claim 逻辑。

    这样 growth 族从「活动计分永远是 None、行为任务永远 silently 跳过」升级为
    「尝试自动 → 不可自动则精确登记待用户实操」,任务生命周期闭环完整。
    """

    async def reporter(code: str) -> None:
        plan = classify_growth_task_automation(code)
        if plan is None:
            return
        if plan.can_automate and plan.driver is not None:
            try:
                await plan.driver(code)
                return
            except Exception:
                # 真实驱动器失败(典型:实时客户端会话 403)⇒ 降级为待用户实操
                pass
        if tracker is not None and code not in tracker:
            tracker.append(code)

    return reporter
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
