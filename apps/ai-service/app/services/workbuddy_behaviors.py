# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 任务「行为规划」—— growth 族的任务全生命周期理解层。

背景(2026-11-05 报文级实证,逐条可复核):
- 任务中心的成长任务分两类:**服务端可判定项**(签到/连登兑换/抽奖/猫猫旅行/达标领奖——
  本引擎六族已自动化)与**真行为项**(需在 WorkBuddy 真实产品里产生行为才会被服务端计分)。
- 行为项的计分动作在**服务端只认真实行为**,不认客户端遥测报文。2026-11-05 真机两轮取证:
  * 第一轮(账号 3559,号池 API token):发 template_used / chat_message_send / skill_installed /
    expert_actual_use / wechat_linked 到 /v2/report ⇒ 均 HTTP 200 code:0「OK」(报文被受理),
    但成长任务状态保持 available ⇒ 不计分。
  * 第二轮(账号 3564,号池 API token,**8 个事件 × 令牌域+WEB 域共 16 次**):
    事件码覆盖 template_used / chat_message_send / skill_installed / expert_actual_use,
    两域各发一遍,全部 200 code:0;事件后复列 WEB 域 18 行 ⇒
    `template_5`/`chat_5`/`skill_1`/`expert_5` 的 progress 与 status **逐字段零变化**。
    ⇒ **合成遥测事件对成长计分零效果**(受理 ≠ 计分,与事件码/域/头无关)。
  * 附带证伪:`/v2/report-assistant` 在令牌域与 WEB 域**均为 404「404 Route Not Found」**
    ⇒ 上报端点族只有 `/v2/report` 一条(此前流传的「第二个上报端点」不存在)。
- 行为任务的真实判据是 `progress`/`target`(真机 WEB 域行形如
  `{task_code,title,progress,target,status,accept_status,reward_credit,reward_energy}`):
  progress 累计到 target ⇒ status 翻 claimed ⇒ 才可 claim。progress 只由**真实行为**推进。
- 2026-11-09 机主裁决订正:上面两条实证只证伪了**裸合成遥测事件**,不能外推成
  「所有服务端路径都无效」。外部工具(wb2api.exe)用**纯 accessToken、零 cookie** 直连平台
  HTTP 接口真完成 `Expert_lighthouse` 与 `Sequential_Tasks_1` 并各领 100 分
  (积分 1986→2186)⇒ docs §8.1「唯一有效路径是驱动真客户端」已被实证推翻。
- 因此 `can_automate` **不再恒为 False**:是否可自动取决于直连执行器 `ACTION_TABLE`
  是否登记该码的直连动作;`can_automate` 表示「服务端引擎能否在**不依赖实时客户端会话**
  下完成」。已登记直连动作的码置 True(`Expert_lighthouse`/`Sequential_Tasks_1`);
  其余未登记直连动作、或依赖微信身份/真实客户端体验的码维持 False。
- `events` 仍是**行为类型的说明性映射**:**裸合成事件无效**(受理 200/code:0 而 progress 零变化);
  **带平台真实 requestId 与会话上下文、按平台契约上报才可能计分**;最终**一律以回读 progress
  为准**。防伪造纪律不删:绝不以 HTTP 200/code:0 受理回执冒充计分(§0.3)。

证据级别:2026-11-05 账号 3559 + 3564 报文级实证(16 次事件受理全部 200 code:0,progress 零变化)
+ WorkBuddy 官方客户端 asar(`G:\\workbuddy\\resources\\app.asar`)源码取证:
- 上报端点族只有 `/v2/report` 一条(asar 内 `v2/report` 命中 9 次、`report-assistant` **0 次**;
  真机两域打 `/v2/report-assistant` 均 404「404 Route Not Found」⇒ 「第二个上报端点」不存在)。
  客户端支持 `reportEndpoint` 选项 ⇒ 真正的「另一个上报端点」是**另一个主机**,不是另一个路径;
  本仓 `_activity_hosts_map`(按事件码路由主机)正是它的对应物。
- 上报报文形态 = **数组** `[{eventCode, timestamp, reportDelay, ...}]`
  (CloudProductMetricsReporter.report() + StandardEventService 的 batching/fireBatch)。
- 客户端埋点枚举表里 `expert_summoned`(召唤)与 `expert_actual_use`(实际使用)是**两个不同事件码**,
  本仓映射表据此校正(此前 expert_summoned 任务错映射到 expert_actual_use)。
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class BehaviorPlan:
    """单个成长任务的「行为规划」——引擎据此决定自动尝试还是交还用户。

    can_automate: 本仓服务端引擎能否在**不依赖实时客户端会话**的前提下完成该任务。
      不再恒为 False —— 取决于直连执行器 `ACTION_TABLE` 是否登记该码的直连动作
      (2026-11-09 机主裁决订正,见模块 docstring)。
    events: 该任务对应的官方客户端遥测事件码(有序)。**仅作行为类型的说明性映射** ——
      **裸合成事件无效**(2026-11-05 真机:代发 200 code:0 而 progress 零变化);
      **带平台真实 requestId 与会话上下文、按平台契约上报才可能计分**;
      最终**一律以回读 progress 为准**。防伪造纪律不删:绝不以 HTTP 200/code:0
      受理回执冒充计分;本字段用途是接入真实/直连上报时对齐遥测码。
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
# events 取值依据:WorkBuddy 桌面端 app.asar 埋点取证(client 触发码)。
# **2026-11-05 真机:裸合成事件(代发)200 code:0 而成长任务 progress 零变化** ⇒
# events 只是行为类型映射,裸合成不构成计分依据;带平台真实 requestId 按契约上报才可能计分,
# 最终一律以回读 progress 为准(详见模块 docstring)。判分只认真实行为。
# 2026-11-09 22:00 收口:计分链已闭环,可自动集合从 2 项扩到 7 项 ——
#   Expert_lighthouse / Sequential_Tasks_1 / WorkBuddy_Valorant /
#   expert_use_maidehao / expert_use_douyinyin / expert_use_shangjia_xuanchuan /
#   expert_use_bowangwang(后 5 项本轮本仓实测点亮并领奖,见 docs §13.3/§13.4)。
# 仍维持 can_automate=False 的:wechat_linked / wb_wechat_oa_subscribe_task(依赖微信身份)、
# first_chat / skill_installed / expert_summoned / template_used(非平台计分码,属行为分类)。
# ---------------------------------------------------------------------------

BEHAVIOR_PLANS: dict[str, BehaviorPlan] = {
    # ── CLI 域 5 个新手引导任务 ──
    # 2026-11-05 真机实证(账号 3564):accept 端点(/activity/growth/tasks/accept,body={"task_codes":[…]})
    # 对这 5 个 code 逐条回 status="error" / message="task not found" —— 它们不在 accept
    # 面向的活动战役里(对照工具 autoActions 表同样不收这 5 个码)。真实对话(客户端内存真 Bearer
    # + 网页 session cookie,/v2/chat/completions 200+SSE)也不使其翻转(账号是老号,新手战役
    # 大概率仅对新客群生效)。合成事件 16 次全 200 code:0 而 progress 零变化。
    # ⇒ 只能待用户实操,引擎不伪造。
    "first_chat": BehaviorPlan(
        code="first_chat",
        title="完成一次对话",
        can_automate=False,
        events=("chat_message_send",),
        instruction="在 WorkBuddy 客户端(桌面端/网页端)发起一次任意对话即可。",
        evidence="2026-11-05 真机:accept 回 task not found(不在战役内);真客户端 Bearer 真实对话后仍 available;"
        "合成 chat_message_send 事件 200 code:0 而 progress 不动。判分只认真实首次行为。",
    ),
    "skill_installed": BehaviorPlan(
        code="skill_installed",
        title="安装一个技能",
        can_automate=False,
        events=("skill_installed",),
        instruction="在 WorkBuddy 客户端打开技能面板,安装任意一个技能(内置或市场均可)。",
        evidence="2026-11-05 真机:accept 回 task not found;合成 skill_installed 事件 200 code:0 而 progress 不动。"
        "判分只认真实安装。",
    ),
    "wechat_linked": BehaviorPlan(
        code="wechat_linked",
        title="绑定微信",
        can_automate=False,
        events=("wechat_linked",),
        instruction="在 WorkBuddy 客户端「设置 → 账号 → 绑定微信」完成微信 OAuth 授权。",
        evidence="绑定微信依赖真实微信 OAuth 回调(微信侧判分),服务端无法代做;accept 亦回 task not found。"
        "2026-11-09 收口:本码依赖微信身份且 ACTION_TABLE 未登记直连动作 ⇒ can_automate 维持 False。",
    ),
    "expert_summoned": BehaviorPlan(
        code="expert_summoned",
        title="召唤一次专家",
        can_automate=False,
        events=("expert_summoned",),
        instruction="在 WorkBuddy 客户端打开专家面板,召唤任意一个专家一次。",
        evidence="2026-11-05 真机:accept 回 task not found;合成 expert_actual_use 事件 200 code:0 而 progress 不动。"
        "客户端埋点枚举表里 expert_summoned(召唤)与 expert_actual_use(实际使用)是**两个不同事件码**"
        "(G:\\workbuddy\\resources\\app.asar),本任务对应前者 ⇒ 映射已校正。"
        "判分只认真实召唤。",
    ),
    "template_used": BehaviorPlan(
        code="template_used",
        title="使用一次模板",
        can_automate=False,
        events=("template_used",),
        instruction="在 WorkBuddy 客户端新建对话时选择一个模板,或在模板库里使用一次模板。",
        evidence="2026-11-05 真机:accept 回 task not found;合成 template_used 事件 200 code:0 而 progress 不动。"
        "判分只认真实模板使用。",
    ),
    # ── WEB 域剩余真行为任务 ──
    # 2026-11-05 真机(账号 3564)WEB 域 18 行全量状态实测,三态语义首次拿到:
    #   claimed  = 已完成已领(playbook_prompt / RichMeow_Chat / Library_read / Buddy_App /
    #              WorkBuddy_Valorant / expert_use_* 4 项 / Expert_team_use_3 / first_buddy /
    #              chat_5 / skill_1 / expert_5 / template_5 / automation_1)⇒ progress 已达 target;
    #   accepted = 已接受、等真实行为(progress 0/target 1):Expert_lighthouse、wb_wechat_oa_subscribe_task;
    #   available= 未接受(CLI 域 5 项)。
    # ⇒ 「accepted」是**等行为**,不是「完成待领」——此前把 accepted 误读为待实操是错的方向。
    "wb_wechat_oa_subscribe_task": BehaviorPlan(
        code="wb_wechat_oa_subscribe_task",
        title="关注 WorkBuddy 公众号",
        can_automate=False,
        events=(),
        instruction="按任务跳转链接,在微信里关注「腾讯 WorkBuddy」官方公众号。",
        evidence="2026-11-05 真机:该码 accept_status=accepted、progress 0/1 ⇒ 已接受等真实关注动作;"
        "关注动作发生在微信侧,服务端引擎只能待用户实操。"
        "2026-11-09 收口:本码依赖微信身份且 ACTION_TABLE 未登记直连动作 ⇒ can_automate 维持 False。",
    ),
    "WorkBuddy_Valorant": BehaviorPlan(
        code="WorkBuddy_Valorant",
        title="体验无畏契约拼豆专家",
        can_automate=True,
        events=("expert_actual_use",),
        instruction="凭据直连平台 HTTP 接口完成:市场关键词搜「无畏契约」取真实专家 "
        "(`ex_xQHHD1u5Jkua` @v1.3.1) → 真实 chat 取服务端 requestId → desktop 口径上报 "
        "召唤链 + actual_use → 回读 progress 前进 → claim。零 GUI、零 cookie。",
        evidence="2026-11-09 22:00 本仓实测(不是外推):progress 0→1,随后 claim 返回 "
        "`already_claimed:false, credit:100, energy:5`。原「工具判本码无接口、只能待用户实操」"
        "结论已被实测推翻——真因是口径用错(web 而非 desktop),见 docs §13.4。",
    ),
    "expert_use_maidehao": BehaviorPlan(
        code="expert_use_maidehao",
        title="体验「中国电商运营专家」",
        can_automate=True,
        events=("expert_actual_use",),
        instruction="凭据直连 desktop 口径:专家 `ex_GDl31WahyIH0` → 真实 chat 取服务端 requestId "
        "→ 召唤链 + actual_use 上报 → 回读 progress → claim。",
        evidence="2026-11-09 22:00 本仓实测:progress 0→1,claim 得 `credit:50, energy:5`。",
    ),
    "expert_use_douyinyin": BehaviorPlan(
        code="expert_use_douyinyin",
        title="体验「抖音策略师」",
        can_automate=True,
        events=("expert_actual_use",),
        instruction="凭据直连 desktop 口径:专家 `ex_FbY5nlWTqDod` → 真实 chat 取服务端 requestId "
        "→ 召唤链 + actual_use 上报 → 回读 progress → claim。",
        evidence="2026-11-09 22:00 本仓实测:progress 0→1,claim 得 `credit:50, energy:5`。",
    ),
    "expert_use_shangjia_xuanchuan": BehaviorPlan(
        code="expert_use_shangjia_xuanchuan",
        title="体验「商家宣传页与海报设计师」",
        can_automate=True,
        events=("expert_actual_use",),
        instruction="凭据直连 desktop 口径:专家 `ex_Weo3x2EZuSDm`,**version 必须取市场真实值**(实测 1.6.2)",
        evidence="2026-11-09 22:00 本仓实测:首次用默认 version 1.0.0 上报零前进;改用市场真实 "
        "version 1.6.2 后 progress 0→1,claim 得 `credit:50, energy:5` —— 判据校验版本号。",
    ),
    "expert_use_bowangwang": BehaviorPlan(
        code="expert_use_bowangwang",
        title="体验「直播电商教练」",
        can_automate=True,
        events=("expert_actual_use",),
        instruction="凭据直连 desktop 口径:专家 `ex_WZY136wV5aMt` → 真实 chat 取服务端 requestId "
        "→ 召唤链 + actual_use 上报 → 回读 progress → claim。",
        evidence="2026-11-09 22:00 本仓实测:progress 0→1,claim 得 `credit:50, energy:5`。",
    ),
    "Expert_lighthouse": BehaviorPlan(
        code="Expert_lighthouse",
        title="使用腾讯轻量云专家",
        can_automate=True,
        events=("expert_actual_use",),
        instruction="凭据直连平台 HTTP 接口完成:真实对话取服务端 requestId → 按平台契约上报 → "
        "回读 progress 前进 → claim;零浏览器会话、零 GUI、零 cookie。",
        evidence="2026-11-09 实证(wb2api.exe,纯 accessToken/零 cookie 直连):该码真完成并领取 100 分,"
        "积分 1986→2186。原「只能待用户实操 / 只能驱动真客户端」结论已被实证推翻(依据日期 2026-11-09)。"
        "2026-11-05 旧证(合成 expert_actual_use 事件两域共 4 次全 200 code:0 而 progress 不动)只证伪裸合成事件,"
        "不外推为所有服务端路径无效;计分最终一律以回读 progress 为准。",
    ),
    "Sequential_Tasks_1": BehaviorPlan(
        code="Sequential_Tasks_1",
        title="小程序首对话(序列任务 1)",
        can_automate=True,
        events=(),
        instruction="凭据直连平台 HTTP 接口完成(工具 AUTO_TASKS 表):小程序首对话 "
        "accept → mini 对话上报 → 领奖(+100c+5e);零浏览器会话、零 GUI。",
        evidence="2026-11-09 工具实证已 claimed(+100 积分 +5 能量,积分 1986→2186 同轮);"
        "项目侧直连执行器 ACTION_TABLE 待登记该码的直连动作(语义已收口为可自动,动作接线由直连 agent 落地)。",
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
    can_automate=True 的任务由服务端直连引擎完成,**不进此清单**(2026-11-09 收口:
    有 True 项后必须显式判 can_automate,不能再靠「全 False」凑巧一致);只有仍需用户
    实操的任务(如绑定微信/关注公众号)才会出现在这里。
    """
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for code in codes:
        plan = classify_growth_task_automation(code)
        if plan is None or code in seen:
            continue
        if plan.can_automate:
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
    - fire 由 run_growth 注入,返回的是「**该任务的成长进度确已前进**」这一凭据,
      而**不是**「事件报文被上游受理」。二者是真机区分过的两件事:
      2026-11-05 合成事件 16 次全 200 code:0,而 progress 零变化 ⇒ 受理不等于计分。
      fire 的返回值因此必须由**重读任务列表看 progress/status 是否前进**来判定,
      不得以 HTTP 200 / code:0 作为「已计分」依据(§0.3 不拿受理回执冒充计分)。
    - fire 返回 True ⇒ 确已计分(上报→重判→claim 闭环会把它领掉),不登记。
    - fire 返回 False / 未注入 / 抛错 ⇒ 该任务本次无法自动,
      登记到 tracker(待用户实操),不抛栈(单任务失败不中断整轮)。

    这样 growth 族从「行为计分永远是 None、行为任务永远 silently 跳过」升级为
    「能确证计分才自动完成、否则精确登记待用户实操」,任务生命周期闭环完整。
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
