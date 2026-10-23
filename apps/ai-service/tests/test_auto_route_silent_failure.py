# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""auto 路由两处「被 except 吞掉的静默失效」回归锁(票85② 纯函数重构后遗症)。

缺陷型:`_assemble_auto_candidates`(票85②)把分桶结果收进 NamedTuple 后,调用方
`_resolve_auto_model` 仍按**旧局部名**引用,而 NameError 恰好落在 try/except 射程内:

  ① L5-6 复杂度升级分支 `if premium_top:` 每次抛 NameError,被同段
     `except Exception` 吞成一行 debug ⇒ 复杂/专家任务的「升级到高级模型」路径
     **永不生效且无告警**;
  ② 收口成功后的 `logger.info(... len(free_pool) ...)` 抛 NameError,被函数最外层
     `except Exception` 吞成 warning「自动路由失败,降级到 fallback」并 `return fallback`
     ⇒ **每次自动路由都在成功之后降级到 fallback 模型**,账面只留一条"失败"warning。

两型对 typecheck 与既有用例双盲:旧断言写的是 `chosen in candidates`,而 fallback
天然就在 candidates 里,所以红线抓不到。本文件钉三件事(命名即用途):
  A —— 升级分支真的执行且选到 `plan.premium_top`,正向对照:简单任务不得升级;
  B —— 成功收口返回 chosen 而非 fallback,并且**没有**那条「自动路由失败,降级到
       fallback」warning(只断言返回值非空抓不到本缺陷,fallback 本身就非空);
  C —— 结果行能被真格式化,且打印的就是当下真取得到的量(占位符与实参成套)。

测试隔离(AGENTS.md §5 铁律):全程 monkeypatch;DB 面由 tests/conftest.py 的 autouse
fixture 中和,本文件不新增任何 DB 路径;LOCAL 探活单例(`ensure_probed`/`is_available`)
整支换成桩,一次真网络请求都不发(把探针本身换掉,不是用装饰器掩盖顶层副作用)。
"""

from __future__ import annotations

import re

import pytest

from app.core.llm_gateway import (
    _assemble_auto_candidates,
    _AutoCandidatePlan,
    _local_auto_eligible,
    _resolve_auto_model,
)
from app.services.local_provider_health import local_provider_health
from app.services.model_availability import model_availability
from app.services.model_router import TaskComplexity

# 真实 app/data/default_models.json 里稳定存在的条目(前缀决定 tier:flash→1 / glm-4-plus→10)
CHEAP_HEAD = "stepfun/step-3.7-flash"  # 运维预设首选 ⇒ 同时也是既有 fallback
CHEAP_OTHER = "agnes/agnes-2.5-flash"  # 预设兜底(同 tier;用于区分 chosen 与 fallback)
PREMIUM = "glm-4-plus"  # tier 10 ⇒ premium_pool 唯一成员 ⇒ plan.premium_top
FREE = "@cf/zai-org/glm-4.7-flash"  # _AUTO_FREE_PREFIXES 命中 ⇒ free_pool
WHITELIST = [CHEAP_HEAD, CHEAP_OTHER, PREMIUM, FREE]

EXPERT_PROMPT = "帮我重构这套服务的架构"
SIMPLE_PROMPT = "查询一下明天的天气"

FALLBACK_WARNING = "自动路由失败,降级到 fallback"
AUTO_ROUTE_LOG_PREFIX = "[auto-route] auto → "

# logging 的 %-风格转换符(不含 %% 转义):把"格式串与实参成套"钉成机器判据
_PERCENT_SPEC_RE = re.compile(r"%(?:\(\w+\))?[-+ #0]*[0-9]*(?:\.[0-9]+)?[diouxXeEfFgGcrsa]")


@pytest.fixture
def auto_route_env(monkeypatch):
    """把 auto 路由的输入面钉成固定白名单(不吃 .env 凭据 / provider 健康缓存 / 网络)。"""
    from app.core.config import settings

    monkeypatch.setattr(
        model_availability,
        "is_model_available",
        lambda model_id: str(model_id) in set(WHITELIST),
    )

    async def _never_probe(codes: list[str]) -> None:  # noqa: ARG001
        return None

    monkeypatch.setattr(local_provider_health, "ensure_probed", _never_probe)
    monkeypatch.setattr(local_provider_health, "is_available", lambda code: False)

    monkeypatch.setattr(settings, "litellm_model", CHEAP_HEAD)
    monkeypatch.setattr(settings, "litellm_fallback_model", CHEAP_OTHER)
    monkeypatch.setattr(settings, "edge_first_local", False)
    monkeypatch.delenv("LLM_AUTO_ROUTE_BUDGET_USD", raising=False)
    # 成本感知重排档由 test_router_wiring 一族专门钉;这里退化为恒等,隔离出被修的分支
    monkeypatch.setattr(
        "app.core.llm_gateway._apply_cost_aware_routing",
        lambda candidates, models_by_id, prompt_text, **_kw: list(candidates),
    )
    return settings


def _records(caplog, needle: str) -> list[pytest.LogCaptureRecord]:
    """按子串取记录 —— 只取 record,格式化留给调用方(坏日志行 getMessage() 必抛)。"""
    return [r for r in caplog.records if needle in r.msg]


# =============================================================================
# 0. 夹具前提:纯函数确实把 premium_top 放在 plan 上(调用方作用域里没有这个名字)
# =============================================================================


def test_premium_top_lives_on_the_plan_not_in_caller_scope() -> None:
    """缺陷 ① 的成因锁:`premium_top` 只是 `_assemble_auto_candidates` 的局部变量,
    对外的唯一形态是 `_AutoCandidatePlan.premium_top`。
    """
    plan = _assemble_auto_candidates(
        [{"id": mid} for mid in WHITELIST],
        edge_first_local=False,
        default_chain=[CHEAP_HEAD, CHEAP_OTHER],
    )
    assert isinstance(plan, _AutoCandidatePlan)
    assert plan.premium_top == PREMIUM
    assert plan.candidates[0] == CHEAP_HEAD, "简单任务首选应是运维预设,不是高级模型"


def test_prompts_classify_as_claimed() -> None:
    """A 组用例的前提:那两条中文 prompt 在真实判据下确实判成 EXPERT / SIMPLE。"""
    from app.services.model_router import model_router

    assert model_router.assess_complexity(
        prompt=EXPERT_PROMPT, token_count=len(EXPERT_PROMPT) // 4, has_tools=False
    ) is TaskComplexity.EXPERT
    assert model_router.assess_complexity(
        prompt=SIMPLE_PROMPT, token_count=len(SIMPLE_PROMPT) // 4, has_tools=False
    ) is TaskComplexity.SIMPLE


# =============================================================================
# A. 缺陷 ①:复杂度升级分支必须真的跑到,并升级到 plan.premium_top
# =============================================================================


async def test_complex_task_upgrades_to_plan_premium_top(auto_route_env, caplog):  # noqa: ARG001
    """EXPERT 任务 ⇒ chosen == plan.premium_top,且升级 info 真的打出来。

    修前该分支根本没跑到:`if premium_top:` 抛 NameError 被同段 except 吞成 debug 行
    ⇒ chosen 维持便宜首选、升级 info 一次都没有。
    """
    with caplog.at_level("DEBUG"):
        chosen = await _resolve_auto_model(
            has_tools=False, messages=[{"role": "user", "content": EXPERT_PROMPT}]
        )

    assert chosen == PREMIUM, f"复杂任务没有升级到高级模型(拿到 {chosen!r})"
    # 执行证据:NameError 发生在 logger.info 之前,所以这行修前不可能存在
    upgrade = _records(caplog, "路由升级到高级模型")
    assert upgrade, "复杂度升级分支没有执行(被 except 吞掉的典型形态:连日志都没有)"
    assert PREMIUM in upgrade[0].getMessage()


async def test_simple_task_does_not_upgrade(auto_route_env, caplog):  # noqa: ARG001
    """正向对照:简单任务必须维持成本优先(不得被升级吃掉),且一次升级日志都不打。"""
    with caplog.at_level("DEBUG"):
        chosen = await _resolve_auto_model(
            has_tools=False, messages=[{"role": "user", "content": SIMPLE_PROMPT}]
        )
    assert chosen == CHEAP_HEAD
    assert chosen != PREMIUM
    assert not _records(caplog, "路由升级到高级模型")


# =============================================================================
# B. 缺陷 ②:成功收口不得掉进最外层 except(返回 chosen,且没有"降级"warning)
# =============================================================================


async def test_success_path_returns_chosen_not_fallback(
    auto_route_env, caplog, monkeypatch
):  # noqa: ARG001
    """把首选重排成 CHEAP_OTHER ⇒ 返回值必须是 CHEAP_OTHER,且零"失败"warning。

    修前收口后的 `logger.info(... len(free_pool) ...)` 抛 NameError → 最外层 except →
    `return fallback`(== CHEAP_HEAD):每次"成功"路由都被降级。
    """
    monkeypatch.setattr(
        "app.core.llm_gateway._apply_cost_aware_routing",
        lambda candidates, models_by_id, prompt_text, **_kw: [CHEAP_OTHER, *candidates],
    )
    with caplog.at_level("DEBUG"):
        chosen = await _resolve_auto_model(
            has_tools=False, messages=[{"role": "user", "content": "修改一下这段文案"}]
        )

    assert chosen == CHEAP_OTHER, f"收口成功后被降级到 fallback(拿到 {chosen!r})"
    assert chosen != auto_route_env.litellm_model, "拿到的就是 fallback ⇒ 成功路径掉进了 except"
    warns = _records(caplog, FALLBACK_WARNING)
    assert not warns, f"成功路径仍被记成「自动路由失败」:{[r.getMessage() for r in warns]}"


async def test_plain_success_logs_exactly_one_result_line(auto_route_env, caplog):  # noqa: ARG001
    """不重排的普通成功:结果行恰好一条、零"失败"warning(缺陷 ② 的独立证据)。"""
    with caplog.at_level("DEBUG"):
        chosen = await _resolve_auto_model(
            has_tools=False, messages=[{"role": "user", "content": SIMPLE_PROMPT}]
        )
    assert chosen == CHEAP_HEAD
    assert not _records(caplog, FALLBACK_WARNING)
    assert len(_records(caplog, AUTO_ROUTE_LOG_PREFIX)) == 1, "结果行应当恰好一条"


# =============================================================================
# C. 缺陷 ② 的形态锁:结果行必须能真格式化,且打印的是当下真取得到的量
# =============================================================================


async def test_auto_route_log_line_formats_with_matching_args(auto_route_env, caplog, monkeypatch):  # noqa: ARG001
    """结果行真格式化一次 + 占位符/实参计数成套 + 行内候选数与实际池一致。

    logging 吞格式化异常(只往 stderr 打一行 traceback,请求照常成功),所以生产里
    `TypeError: not enough arguments for format string` 也不会让请求失败 —— 必须由
    测试显式 getMessage() 才量得到。
    """
    seen: list[list[str]] = []

    def _spy(candidates, models_by_id, prompt_text, **_kw):  # noqa: ARG001
        seen.append(list(candidates))
        return list(candidates)

    monkeypatch.setattr("app.core.llm_gateway._apply_cost_aware_routing", _spy)
    with caplog.at_level("DEBUG"):
        chosen = await _resolve_auto_model(
            has_tools=False, messages=[{"role": "user", "content": SIMPLE_PROMPT}]
        )

    lines = _records(caplog, AUTO_ROUTE_LOG_PREFIX)
    assert lines, "auto 路由没有打印结果行(生产可观测性丢失)"
    rec = lines[-1]
    text = rec.getMessage()  # 修前这一行之前就已经 NameError,记录根本到不了这里

    specs = _PERCENT_SPEC_RE.findall(str(rec.msg))
    args = rec.args or ()
    assert len(specs) == len(args), (
        f"日志占位符 {len(specs)} 个与实参 {len(args)} 个不成套: {rec.msg!r}"
    )
    assert repr(chosen) in text, "结果行打印的首选与实际返回值不同形"
    assert seen, "候选池没有交给成本感知路由层(接线丢失)"
    logged_count = int(re.search(r"candidates=(\d+)", text).group(1))  # type: ignore[union-attr]
    assert logged_count == len(seen[-1]), "结果行的候选数不是当下真取得到的那一份"
    for stale in ("free_pool", "cheap_pool", "premium_pool"):
        assert stale not in str(rec.msg), f"结果行又引用了票85② 已移出作用域的 {stale}"


# =============================================================================
# D. 缺陷 ③ 的类型层锁:_local_auto_eligible 必须返回真 bool(不是 Any 漏下去)
# =============================================================================


def test_local_auto_eligible_returns_real_bool() -> None:
    """探针返回值经显式布尔化:非 LOCAL 前缀恒 True,LOCAL 只在实证 available 时 True。"""

    class _Probe:
        def __init__(self, verdict: object) -> None:
            self._verdict = verdict

        def is_available(self, code: str) -> object:  # 故意返回非 bool,模拟 Any
            assert code  # 探针按 provider code 取用,不许把 id 整串传下去
            return self._verdict

    assert _local_auto_eligible(CHEAP_HEAD, _Probe(False)) is True
    assert _local_auto_eligible("ollama/llama3.3:70b", _Probe(True)) is True
    assert _local_auto_eligible("ollama/llama3.3:70b", _Probe(False)) is False
    # 判不了(None / 空串)一律 False:auto 不选判不了的东西;且必须是真 bool
    assert _local_auto_eligible("lmstudio/llama-3.3-70b", _Probe(None)) is False
    assert type(_local_auto_eligible("vllm/x", _Probe(""))) is bool
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
