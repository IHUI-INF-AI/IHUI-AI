# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D6① 多 agent 编排栈收敛开关(试点,默认 off)。

背景(2026-09-26 立票):仓库内并存多套编排实现
(routers/orchestration.py + services/orchestration_hub.py 事件中枢、
services/agent_orchestrator.py 旧多 agent 引擎、routers/team_orchestration.py
团队协作、apps/api 侧 agents-kanban / subagent-dispatch),而
services/agent_loop_v2.py 是收敛候选。**本模块只做"判定",不做"切换"**:
所有现网路径的默认档 = `legacy`(现状行为),把"是否向 agent_loop_v2 收敛"
变成一处可读、可灰度、可单测的决策点。

三条红线(与"未实现前默认绝不能是 enforce"同族):
1. ``DEFAULT_MODE`` 恒为 ``legacy`` —— 环境变量缺失/空/未识别值一律回 legacy,
   绝不默认命中新执行器;
2. 本模块**模块级无副作用**:不 import settings / 任何 service(避免循环),
   只读传入或 ``os.environ`` 的字符串。唯一例外是 ``take_loop_v2_handoff`` 里
   **函数体内**的惰性 import —— 它只在"新档被显式选中 ∧ 该接线点已登记为消费者"
   两个条件同时成立时才发生,默认档一次也不会执行(由测试
   ``test_default_mode_never_imports_adapter`` 钉死);
3. 开新档(loop_v2)时的收敛执行器本体在 ``LOOP_V2_ADAPTER_MODULE`` 的
   ``LOOP_V2_ADAPTER_FUNC``(G1,2026-09-27 落地:真构造并真跑 AgentLoopV2)。
   **四个现存接线点已全部改成"消费 handoff"的形态并登记进
   ``HANDOFF_CONSUMER_SURFACES``**(2026-09-27 本票),所以它们不再依赖"裸守卫抛错"
   来中断旧路径:命中 v2 时 ``handoff is not None`` 那一支**立即 return**,
   旧循环一行也不会再跑。``guard_loop_v2_pilot`` 在每站仍保留一次调用,**只在
   legacy 档可达**(v2 档下 ``take_loop_v2_handoff`` 要么返回 handoff 要么抛错,
   永不返回 None),作用是"若日后有人把该 surface 从登记表里摘掉而不改源码,
   这里仍然 fail-fast 而不是静默回退旧路径"。
   开关必须"有牙":设成 loop_v2 却什么都感知不到,等于造一台恒假的摆设
   (反向对照用例钉死这一点)。
   一个接线点从"抛错"变成"真执行"的**唯一合法姿势**:把它的 surface 名加进
   ``HANDOFF_CONSUMER_SURFACES``,并在该点改调 ``await take_loop_v2_handoff(...)``
   消费返回值(两件事必须同一枚提交,只做一半要么双重执行要么永不执行 —— 由
   ``tests/test_executor_switch_v2_wired.py::TestRegistryMatchesRealSource``
   双向对账钉住,登记表腐烂与消费者漏登记都红)。
   ⚠️ **"登记为消费者"不等于"该站真能投影出一次可信执行"**:
   ``agent_orchestrator._run_agent`` 手上有完整 ``AgentDefinition``,所以 v2 档真的
   跑收敛循环;``orchestration_hub._call_pillar_action[subagent]`` 只在该 playbook
   action 的 ``params`` 自带 ``agent_name`` + ``system_prompt`` 时才投影(现存五条
   playbook 一条都没有 ⇒ 生产行为与改前同形);``routers/orchestration.emit_event``
   与 ``routers/team_orchestration.run_team_round`` **没有** agent 可投影(前者是
   事件入队、后者的成员派发已在叶子 ``_run_agent`` 逐个体收敛),这两处在 v2 档仍由
   ``take_loop_v2_handoff`` 的"缺投影入参"分支显式抛错。这是刻意的:拿一个编出来的
   提示词去跑一个"看起来执行了"的循环,并把假的 ``event_id`` / ``contributors``
   填进原有响应形状,比抛错坏得多(AGENTS §30「没有终态就写已完成」同一条禁令)。
   把这两站真正并到 v2 属**对外语义变更**(要不要让 emit 返回 agent 结论、
   要不要让 round 端点跑单体而非 fan-out),需持有人裁决,不由本票代拍。

灰度语义(后续批次按会话/按租户放量用,本票不启用):
- ``ORCHESTRATION_CONVERGENCE_EXECUTOR``:全局档,``legacy``(默认)/``loop_v2``;
- ``ORCHESTRATION_CONVERGENCE_SESSIONS``:逗号分隔 session id 白名单,命中 ⇒ 该
  请求按 loop_v2 判定(细粒度优先于全局);
- ``ORCHESTRATION_CONVERGENCE_TENANTS``:同上,租户维度。
注意与既有 ``AGENT_EXECUTOR``(routers/agents.py 的 execute/stream 执行器三档
语义,缺省即 v2)是**两个独立开关**,本票不改它的任何语义。
"""

from __future__ import annotations

import contextlib
import logging
import os
from collections.abc import Awaitable, Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from importlib import import_module
from typing import Any, Final, Literal, cast

logger = logging.getLogger(__name__)

ConvergenceMode = Literal["legacy", "loop_v2"]

MODE_LEGACY: Final[ConvergenceMode] = "legacy"
MODE_LOOP_V2: Final[ConvergenceMode] = "loop_v2"

#: 缺省档:现状行为(旧编排栈)。任何解析失败都回落到它。
DEFAULT_MODE: Final[ConvergenceMode] = MODE_LEGACY

EXECUTOR_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_EXECUTOR"
SESSIONS_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_SESSIONS"
TENANTS_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_TENANTS"

#: 新档被命中时错误消息的稳定前缀(测试与日志检索都用它,不得改动)。
PILOT_ERROR_MARKER: Final[str] = "AGENT_LOOP_V2_PILOT_NOT_WIRED"

#: 收敛执行器本体的落点(G1,2026-09-27)。用**字符串**而非直接 import 声明:
#: 模块级 import 会把 services.agent_loop_v2 拖进 core 层的导入图(红线 2),
#: 而字符串既让"适配器在哪"成为一处可读事实,也允许测试 monkeypatch 该属性。
LOOP_V2_ADAPTER_MODULE: Final[str] = "app.services.agent_loop_v2"
LOOP_V2_ADAPTER_FUNC: Final[str] = "run_converged_agent"

#: 适配器在 handoff 上打的引擎标签(下游按它区分"真 v2"与"旧编排栈")。
LOOP_V2_ENGINE_TAG: Final[str] = "agent_loop_v2"

#: 已改成"消费 handoff"的接线点清单。**四条 = 四个现存 surface 全部**,
#: 2026-09-27 本票登记(见模块 docstring 红线 3 的"逐站可投影性"说明 ——
#: 登记 = 该站已改成消费返回值的形态,**不**等于该站在 v2 档一定能投影出可信执行)。
#: 加一条的**同时**必须把那个调用点改成 ``await take_loop_v2_handoff(...)``;
#: 只做一半 = 要么双重执行、要么永不执行,两种都由
#: tests/test_executor_switch_v2_wired.py 的登记↔源码双向对账判红。
HANDOFF_CONSUMER_SURFACES: Final[frozenset[str]] = frozenset(
    {
        "agent_orchestrator._run_agent",
        "orchestration_hub._call_pillar_action[subagent]",
        "routers/orchestration.emit_event",
        "routers/team_orchestration.run_team_round",
    }
)

# ---------------------------------------------------------------------------
# L4 后置自评:在 v2 交接窗口内关掉(2026-09-27 实测逼出,不是假想)
# ---------------------------------------------------------------------------

#: 环境变量:**只在 loop_v2 档被命中时**起作用(legacy 档一行代码都不会执行)。
#: 缺省 = ``suppress``。要恢复那次自评(接受"每次编排多一次计费调用 + 一次落库")
#: 就显式设 ``ORCHESTRATION_CONVERGENCE_META_EVAL=keep``。
META_EVAL_ENV: Final[str] = "ORCHESTRATION_CONVERGENCE_META_EVAL"
META_EVAL_SUPPRESS: Final[str] = "suppress"
META_EVAL_KEEP: Final[str] = "keep"

#: 被罩住的那个方法名 —— 走**变量**而不是字面量有两个理由:
#: ① ruff B010 明确禁止 `setattr(obj, "常量名", …)`(那不比直接属性访问更安全);
#: ② 这个名字是本出口与 `AgentLoopV2.run()` 收尾之间唯一的耦合点,写成一处置顶
#:    比在三处各抄一遍字符串更不容易漂(本仓"两处算同一件事必漂移"记过多次)。
META_EVAL_METHOD: Final[str] = "evaluate_and_record"

#: 本模块唯一出口(测试与运维都从这里判,不得在别处再抄一份判定)。
def meta_eval_suppression_wanted(env: Mapping[str, str] | None = None) -> tuple[bool, str]:
    """纯函数:这一趟 v2 交接要不要抑制后置自评 —— 返回 ``(抑制?, 原因)``。

    三态不并桶:未设 → 抑制(本票默认,行为写死在此处);``keep`` 系 → 不抑制;
    **未识别值 → 抑制且把"没读懂"点名出来**。后者不能静默按默认走:一个拼错的
    开关值让人以为"计费调用已经放回来了",而实际仍被抑制,是典型的"账面与事实
    分叉"(本仓最高频失效型)。
    """
    source = os.environ if env is None else env
    raw = source.get(META_EVAL_ENV)
    if raw is None or not raw.strip():
        return True, f"{META_EVAL_ENV} 未设 ⇒ 默认 {META_EVAL_SUPPRESS}"
    val = raw.strip().lower()
    if val in (META_EVAL_SUPPRESS, "1", "true", "on"):
        return True, f"{META_EVAL_ENV}={raw!r} ⇒ 抑制"
    if val in (META_EVAL_KEEP, "0", "false", "off"):
        return False, f"{META_EVAL_ENV}={raw!r} ⇒ 保留(会多一次计费调用 + 一次落库)"
    return (
        True,
        f"{META_EVAL_ENV}={raw!r} 未识别 ⇒ 按默认 {META_EVAL_SUPPRESS} 处理(拼错的开关值不得被读成 keep)",
    )


@dataclass
class MetaEvalSuppression:
    """一次 v2 交接的自评抑制台账(挂在 ``LoopV2Handoff`` 上,让下游可判)。

    - ``active``:本窗口**是否真的装上了**抑制出口(装了才谈得上"关掉了");
    - ``swallowed``:窗口内被本出口吃掉的自评调用次数;
    - ``note``:三态原因,永远非空 —— "没判"与"判过了"必须在同一行可读。
    """

    active: bool = False
    swallowed: int = 0
    note: str = ""


@contextlib.contextmanager
def _meta_eval_gate(state: MetaEvalSuppression) -> Iterator[MetaEvalSuppression]:
    """把 ``meta_learner.evaluate_and_record`` 在本窗口内换成空操作(用完必还原)。

    为什么必须在这一层做而不是改 ``AgentLoopV2.run()``:那次自评是 v2 主链
    (routers/agents.py 的 execute/stream)**本来就有的**行为,改它的触发条件属
    另一票、且会波及默认档。收敛链只能在自己的交接窗口内把它罩住。

    ⚠️ 一处如实登记的副作用面:这是对**进程级单例**的临时替换,窗口 = 一次
    ``await adapter(...)``。若同一时刻主聊天引擎也在收尾,它的那次自评会被本窗口
    一起吃掉(表现为少一条 lesson,不影响执行结果)。要根除只能给
    ``AgentLoopV2`` 加一个构造期开关(agent_loop_v2.py:2678 那一档 if),
    那属该文件持有者的裁决 —— 本票按纪律不动它,并在此点名。
    """
    try:
        from app.services.meta_learner import meta_learner  # 函数级 import:红线 2
    except ImportError as e:  # pragma: no cover - 只在落点被搬走时触发
        state.note = f"自评出口取不到模块,未装上抑制:{e}"
        yield state
        return
    original = getattr(meta_learner, META_EVAL_METHOD, None)
    if not callable(original):
        state.note = f"meta_learner.{META_EVAL_METHOD} 不在位,无需抑制"
        yield state
        return

    async def _swallow(*_a: Any, **_k: Any) -> None:
        state.swallowed += 1
        logger.warning(
            "%s:已抑制 AgentLoopV2 的 L4 后置自评(第 %d 次)—— 少一次计费调用与一次落库;"
            "恢复请设 %s=%s",
            PILOT_ERROR_MARKER,
            state.swallowed,
            META_EVAL_ENV,
            META_EVAL_KEEP,
        )

    setattr(meta_learner, META_EVAL_METHOD, _swallow)
    state.active = True
    if not state.note:
        state.note = "抑制出口在位"
    try:
        yield state
    finally:
        setattr(meta_learner, META_EVAL_METHOD, original)



class LoopV2ConvergencePilotError(RuntimeError):
    """收敛开关被置为 loop_v2,但**该接线点**还不能安全地走新执行器。

    刻意抛错而非回退旧路径:回退会让"打开开关"成为一个无观测的动作。

    三种真实原因(都保留同一 ``PILOT_ERROR_MARKER`` 前缀,便于检索):
    1. surface 未登记进 ``HANDOFF_CONSUMER_SURFACES`` —— 它仍是"裸语句调守卫"
       的形状,不抛就会紧接着跑旧循环(双重执行);
    2. surface 已登记却仍调 ``guard_loop_v2_pilot`` —— 同一枚提交只做了一半;
    3. 调 ``take_loop_v2_handoff`` 却没给投影入参 —— 空 system_prompt 跑出个
       "看起来执行了"的空循环,比抛错更坏。
    """

    def __init__(self, surface: str, mode: str, reason: str | None = None) -> None:
        detail = (
            f"{PILOT_ERROR_MARKER}: surface={surface} decided_mode={mode} — "
            "该接线点尚未把执行交给收敛执行器,拒绝静默回退旧编排栈(D6①/G1)"
        )
        if reason:
            detail = f"{detail} | reason={reason}"
        super().__init__(detail)
        self.surface = surface
        self.decided_mode = mode


def _normalize_raw(raw: str | None) -> str:
    """None/空串归一为空(供 == '' 判断);其余 strip().lower()。"""
    if raw is None:
        return ""
    return raw.strip().lower()


def parse_convergence_mode(raw: str | None) -> ConvergenceMode:
    """把环境变量原文解析为档位;未识别值一律 legacy(宁回退不误切)。"""
    val = _normalize_raw(raw)
    if val in (MODE_LOOP_V2, "v2", "agent_loop_v2"):
        return MODE_LOOP_V2
    return DEFAULT_MODE


def parse_allowlist(raw: str | None) -> frozenset[str]:
    """逗号分隔白名单 → 去空白、去空项的不可变集合。"""
    if raw is None:
        return frozenset()
    return frozenset(item.strip() for item in raw.split(",") if item.strip())


def resolve_convergence_mode(
    env: Mapping[str, str],
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> ConvergenceMode:
    """纯函数版决策:细粒度白名单(会话/租户)优先,其后看全局档。

    ``env`` 显式传入以便单测零 monkeypatch;运行时入口用 ``get_convergence_mode``。
    """
    if session_id and session_id in parse_allowlist(env.get(SESSIONS_ENV, "")):
        return MODE_LOOP_V2
    if tenant_id and tenant_id in parse_allowlist(env.get(TENANTS_ENV, "")):
        return MODE_LOOP_V2
    return parse_convergence_mode(env.get(EXECUTOR_ENV))


def get_convergence_mode(
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> ConvergenceMode:
    """从 os.environ 读档的便捷入口(行为与 resolve_* 传 os.environ 全等)。"""
    return resolve_convergence_mode(os.environ, session_id=session_id, tenant_id=tenant_id)


def is_loop_v2_convergence_enabled(
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> bool:
    """收敛档是否被命中(默认恒 False)。"""
    return get_convergence_mode(session_id=session_id, tenant_id=tenant_id) == MODE_LOOP_V2


def guard_loop_v2_pilot(
    surface: str,
    session_id: str | None = None,
    tenant_id: str | None = None,
) -> None:
    """各编排栈入口的**旧形状**接线点:默认档直接返回(零侵入);命中 loop_v2 时显式抛错。

    ``surface`` 为稳定标识(如 "agent_orchestrator._run_agent"),进错误消息,
    供后续批次把"哪些入口已接线"变成机器可对账的事实。

    ⚠️ 本函数**永远不会**去跑新执行器:它没有返回值可交,唯一能中断旧路径的手段
    就是抛错。要让某个接线点真的走 v2,改用 ``take_loop_v2_handoff`` 并把该 surface
    登记进 ``HANDOFF_CONSUMER_SURFACES``(两件事必须同一枚提交)。
    """
    if not is_loop_v2_convergence_enabled(session_id=session_id, tenant_id=tenant_id):
        return
    reason = (
        "该 surface 已登记为 handoff 消费者却仍调用裸守卫(同一枚提交只做了一半)"
        if surface in HANDOFF_CONSUMER_SURFACES
        else "该 surface 未登记进 HANDOFF_CONSUMER_SURFACES,不抛就会紧接着跑旧循环"
    )
    raise LoopV2ConvergencePilotError(surface, MODE_LOOP_V2, reason)


@dataclass(frozen=True)
class LoopV2Handoff:
    """``take_loop_v2_handoff`` 的产物:一次**真执行完**的 v2 结果。

    ``step_result`` 的键集合与旧编排栈的 ``AgentStepResult`` **逐字段同形**
    (agent_name/input/output/status/duration_ms/iterations/tool_calls/error),
    所以接线点可以直接 ``AgentStepResult(**handoff.step_result)`` —— 多一个键
    就会在那一行 TypeError,这条由测试 ``test_step_result_is_consumable`` 钉死。
    引擎侧的诊断(stop_reason / trace 等)放在 handoff 自己的字段里,不混进
    ``step_result``,避免把"响应形状不变"这条红线捅破。
    """

    surface: str
    decided_mode: str
    engine: str
    step_result: dict[str, Any]
    stop_reason: str | None = None
    total_tokens_used: int | None = None
    checkpoint_id: str | None = None
    compaction_events: list[dict[str, Any]] = field(default_factory=list)
    #: L4 后置自评在这一趟里被怎么处理了(见 ``MetaEvalSuppression``)。
    #: 挂在 handoff 上而不是只写日志,是为了让"少花了一次计费调用"这件事
    #: 对下游可判 —— 否则它又是一条只有散文没有读面的说明。
    meta_eval: MetaEvalSuppression = field(default_factory=MetaEvalSuppression)



#: 适配器签名(只为 mypy --strict 而声明;运行期由 getattr 取到的函数满足即可)。
_LoopV2Adapter = Callable[..., Awaitable[dict[str, Any]]]


def _resolve_loop_v2_adapter() -> _LoopV2Adapter:
    """按字符串落点取收敛执行器本体(函数级 import:模块级 import 会破坏红线 2)。

    取不到模块 / 取不到函数 **一律抛错并点名落点**,绝不"降级回旧路径" ——
    那会把"适配器被摘线"这一格伪装成"开关没打开"。
    """
    try:
        module = import_module(LOOP_V2_ADAPTER_MODULE)
    except ImportError as e:  # pragma: no cover - 只在落点被搬走时触发
        raise LoopV2ConvergencePilotError(
            LOOP_V2_ADAPTER_MODULE,
            MODE_LOOP_V2,
            f"收敛执行器模块取不到:{LOOP_V2_ADAPTER_MODULE} ({e})",
        ) from e
    adapter = getattr(module, LOOP_V2_ADAPTER_FUNC, None)
    if not callable(adapter):
        raise LoopV2ConvergencePilotError(
            LOOP_V2_ADAPTER_MODULE,
            MODE_LOOP_V2,
            f"收敛执行器函数不在位:{LOOP_V2_ADAPTER_MODULE}.{LOOP_V2_ADAPTER_FUNC}",
        )
    return cast("_LoopV2Adapter", adapter)


async def take_loop_v2_handoff(
    surface: str,
    *,
    agent_name: str = "",
    system_prompt: str = "",
    tool_names: Sequence[str] | None = None,
    model: str | None = None,
    max_iterations: int = 5,
    user_input: str = "",
    session_id: str | None = None,
    tenant_id: str | None = None,
    user_id: str | None = None,
    user_role: int = 0,
    permission_mode: str | None = None,
    progress_callback: Callable[[dict[str, Any]], Any] | None = None,
) -> LoopV2Handoff | None:
    """接线点的**新形状**入口:命中 loop_v2 就真的用 AgentLoopV2 跑一趟。

    返回值语义(调用方必须消费,否则等于没接线):
      - ``None`` —— 档位是 legacy,调用方**照旧**跑自己的旧路径(默认档行为一字未改);
      - ``LoopV2Handoff`` —— 新执行器已经跑完,调用方**必须立即 return** 它的结果,
        不得再跑旧循环。

    身份口径(AGENTS §5"认证不等于授权"在收敛链上的落点):
      - ``user_id`` / ``user_role`` 只能由**承载层显式入参**传进来,本函数绝不从
        被点名的 session/agent 记录里反推 principal;``user_role`` 默认 0 = fail-closed;
      - ``user_id=None`` 是**回退**(与改动前旧编排栈"无属主记忆"同形),
        不是"已授权"的结论 —— 记忆隔离与审批属主登记会因此不生效,调用方须自行保证
        在已鉴权的承载层里传真实主体。

    ``progress_callback`` 的保真度(接线方与前端都得知道这一维降级了):适配器是
    **循环结束后**按真实顺序回灌事件(``agent_loop_v2._replay_progress_events``),
    不是旧路径那种"跑一步发一次"的实时进度。接线点若把回调直接传进来,拿到的仍是
    旧词汇表(phase=thinking/tool_result/output_ready)但**时序不同** —— 不得把它
    冒充成实时;要变实时得在 AgentLoopV2 里开 per-iteration 回调位(另一票)。

    抛错而不是静默的三档见 ``LoopV2ConvergencePilotError`` 文档。
    """
    mode = get_convergence_mode(session_id=session_id, tenant_id=tenant_id)
    if mode != MODE_LOOP_V2:
        return None
    if surface not in HANDOFF_CONSUMER_SURFACES:
        raise LoopV2ConvergencePilotError(
            surface,
            mode,
            "该 surface 未登记进 HANDOFF_CONSUMER_SURFACES,拒绝执行新执行器"
            "(裸语句调守卫的旧接线点若在这里改跑 v2,旧循环仍会再跑一遍 = 双重执行)",
        )
    if not agent_name or not system_prompt.strip():
        raise LoopV2ConvergencePilotError(
            surface,
            mode,
            "缺少 AgentDefinition 投影入参(agent_name/system_prompt),"
            "空提示词跑出来的结果不可信,拒绝执行",
        )
    adapter = _resolve_loop_v2_adapter()
    # v2 交接窗口内的那次 L4 后置自评:AgentLoopV2.run() **无条件** fire-and-forget
    # 一趟 meta_learner.evaluate_and_record,它用真实 llm_gateway 再发一次 LLM 请求,
    # 并经 KeyPoolSelector → get_shared_pool 落一次生产 PG(同一份代码两次跑出
    # 0 次/3 次连接池触碰,非确定性 —— 实测)。所以"收敛档一旦真接上,每次编排都
    # 多一次计费调用 + 一次落库"是量出来的事实,不是假想。
    # **默认档(legacy)完全不受影响**:下面这段只在 mode==loop_v2 且该 surface 已
    # 登记、且已拿到 handoff 时才执行(函数开头两道判定已早退)。
    want_suppress, suppress_reason = meta_eval_suppression_wanted()
    gate = MetaEvalSuppression(note=suppress_reason)
    with _meta_eval_gate(gate) if want_suppress else contextlib.nullcontext(gate):
        projected = await adapter(
            agent_name=agent_name,
            system_prompt=system_prompt,
            user_input=user_input,
            tool_names=list(tool_names) if tool_names is not None else None,
            model=model,
            max_iterations=max_iterations,
            session_id=session_id,
            user_id=user_id,
            user_role=user_role,
            permission_mode=permission_mode,
            progress_callback=progress_callback,
        )

    step_result = projected.get("step_result")
    diagnostics = projected.get("diagnostics") or {}
    if not isinstance(step_result, dict):
        # 适配器返回形状坏了要**大声失败**:把"没跑成"写成"跑了且是空结果"
        # 是本仓最高频的失效型(见 AGENTS §30"没有终态就写已完成")。
        raise LoopV2ConvergencePilotError(
            surface,
            mode,
            f"收敛执行器返回形状不含 step_result(dict),实际键={sorted(projected)}",
        )
    return LoopV2Handoff(
        surface=surface,
        decided_mode=mode,
        engine=str(diagnostics.get("engine") or LOOP_V2_ENGINE_TAG),
        step_result=step_result,
        stop_reason=diagnostics.get("stop_reason"),
        total_tokens_used=diagnostics.get("total_tokens_used"),
        checkpoint_id=diagnostics.get("checkpoint_id"),
        compaction_events=list(diagnostics.get("compaction_events") or []),
        meta_eval=gate,
    )

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
