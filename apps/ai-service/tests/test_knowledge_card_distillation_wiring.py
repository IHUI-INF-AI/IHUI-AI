# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #76:Knowledge Card 自动蒸馏的**接线**回归。

立票事实:`app/services/knowledge_card_extractor.py` 的抽取器在 HEAD 上已经写完了,
但生产面**零调用方**(全仓引用只有它自己和两条把它当命名先例的注释)——
所以"会话结束异步蒸馏"这件事在过去任何时候都不会发生。本文件钉的就是那条接线,
而不是抽取器自身的解析逻辑(那部分另有 `test_knowledge_lookup.py` 等覆盖面)。

两层证明,缺一不可:

1. **纯判据层**:`should_distill` / `resolve_repo_name` 的每个分支各一条正反用例。
   特别是"没有仓库归属 ⇒ 跳过"这一支 —— 它必须**打日志**,静默跳过等于把
   这一整型缺陷原样留在黑地里。
2. **端到端层**:真的驱动一次 `AgentExecutor.run(...)`,断言抽取器被调到、
   参数带上了调用方声明的 repo。只测 `schedule_*` 被调用不算数:那正是
   "函数在、没人调"能骗过去的那一层(`--self-test` 只能证明函数会给答案,
   不能证明有人问它)。
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import pytest

from app.services import knowledge_card_extractor as kce
from app.services.agent_loop import AgentExecutor
from app.services.knowledge_card_extractor import (
    KnowledgeCardExtractor,
    resolve_repo_name,
    schedule_distillation_from_conversation,
    should_distill,
)
from app.services.memory import memory_store

_LOGGER_NAME = "app.services.knowledge_card_extractor"


@pytest.fixture(autouse=True)
def force_memory_mode() -> None:
    """强制 memory_store 内存模式(测试环境无 Redis;同 test_agent_loop.py 口径)。"""
    memory_store._use_redis = False
    memory_store._redis = None
    yield
    memory_store._use_redis = False
    memory_store._redis = None


@pytest.fixture
def executor() -> AgentExecutor:
    """独立实例,避免与全局 executor 的 _running / _pending_tasks 相互污染。"""
    return AgentExecutor()


@pytest.fixture
def recorder(monkeypatch: pytest.MonkeyPatch) -> dict[str, Any]:
    """把抽取器的 `extract_and_save` 换成记录器(绝不发真 LLM / 真 HTTP)。

    打在**类**上(monkeypatch 自动还原),所以替身必须自带 `self` 形参。
    记录器返回与真实实现同形状的 dict,保证下游(done_callback 里读
    extracted/saved 的那一段)跑的是真代码路径,不是替身特例。
    """
    calls: list[dict[str, Any]] = []
    gate = asyncio.Event()

    async def fake_extract_and_save(
        self: Any, messages: Any, repo_name: str, **kwargs: Any
    ) -> dict[str, Any]:
        # 第一个形参是被 patch 的类传进来的 self —— 漏了它,`messages` 会收到 repo,
        # 报错长得像产品缺陷("takes 2 positional arguments but 3 were given"),
        # 实际是替身摆错了层级。
        calls.append({"messages": messages, "repoName": repo_name, **kwargs})
        await gate.wait()
        return {"extracted": [{"title": "T", "content": "C"}], "saved": [], "durationMs": 1}

    monkeypatch.setattr(
        KnowledgeCardExtractor, "extract_and_save", fake_extract_and_save, raising=True
    )
    return {"calls": calls, "gate": gate}


def _conversation(n: int) -> list[dict[str, str]]:
    return [{"role": "user" if i % 2 == 0 else "assistant", "content": f"第 {i} 句"} for i in range(n)]


# =============================================================================
# 1. 纯判据层
# =============================================================================


def test_gate_rejects_unknown_repo_with_explainable_reason() -> None:
    ok, reason = should_distill(repo_name="", message_count=40, enabled=True)
    assert ok is False
    assert "仓库" in reason, "跳过原因必须说清是哪一格缺,而不是笼统一句'跳过'"


def test_gate_rejects_short_conversation_to_avoid_token_waste() -> None:
    ok, _ = should_distill(repo_name="IHUI-AI", message_count=1, enabled=True)
    assert ok is False
    ok, _ = should_distill(
        repo_name="IHUI-AI",
        message_count=kce._MIN_MESSAGES_FOR_DISTILLATION,
        enabled=True,
    )
    assert ok is True


def test_gate_respects_kill_switch() -> None:
    ok, reason = should_distill(repo_name="IHUI-AI", message_count=40, enabled=False)
    assert ok is False
    assert "开关" in reason


def test_resolve_repo_name_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
    """运行声明 > 部署级默认(settings 一个来源)> 空。

    反向锁:第二个环境变量名**不得**被读到。本仓记过两次"代码自己读 os.environ,
    于是 .env 里那条永远读不到"的同类缺陷(见 config.py 的 COMBO_CHAINS 注释),
    一个配置两个入口迟早不同形 —— 所以这里刻意断言"设了那个名字也没用"。
    """
    from app.core import config

    monkeypatch.setattr(config.settings, "knowledge_card_default_repo", "deploy-repo")
    assert resolve_repo_name("explicit-repo") == "explicit-repo"
    assert resolve_repo_name(None) == "deploy-repo"
    assert resolve_repo_name("   ") == "deploy-repo"

    monkeypatch.setattr(config.settings, "knowledge_card_default_repo", "")
    monkeypatch.setenv("KNOWLEDGE_CARD_REPO", "should-not-be-read")
    assert resolve_repo_name(None) == "", "部署默认只有 settings 一个来源,不得再认第二个 env 名"


def test_new_settings_fields_are_declared_on_settings_class() -> None:
    """两个新开关必须是 Settings 字段 —— 只有声明了,pydantic 才认 .env 里的大写名。

    判"能配置"看的是字段在不在,不是注释里写了什么(注释与实现分叉是本仓老型)。
    """
    from app.core import config

    fields = config.Settings.model_fields
    assert "auto_knowledge_card_extract_enabled" in fields
    assert "knowledge_card_default_repo" in fields


def test_resolve_repo_name_truncates_to_column_width(monkeypatch: pytest.MonkeyPatch) -> None:
    """api 侧 repoName 是 varchar(200),超长必须截而不是原样递过去。"""
    assert len(resolve_repo_name("r" * 500)) == 200


# =============================================================================
# 2. 调度出口层
# =============================================================================


async def test_schedule_skips_loudly_without_repo(
    recorder: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """没有仓库归属 → 不起任务,且必须留下一句可诊断的"为什么没做"。"""
    from app.core import config

    monkeypatch.setattr(config.settings, "knowledge_card_default_repo", "")

    with caplog.at_level(logging.INFO, logger=_LOGGER_NAME):
        task = schedule_distillation_from_conversation(_conversation(10), user_id="u1")

    assert task is None
    assert recorder["calls"] == []
    assert "跳过蒸馏" in caplog.text


async def test_schedule_runs_extractor_and_registers_task(
    recorder: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """判据通过 → 真调到抽取器,参数带上归属仓库;任务登记进调用方的 pending 集合。"""
    from app.core import config

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    pending: set[Any] = set()

    task = schedule_distillation_from_conversation(
        _conversation(8),
        repo_name="IHUI-AI",
        user_id="u-42",
        session_id="s-7",
        conversation_length=8,
        pending_tasks=pending,
    )
    assert task is not None, "判据通过却返回 None = 静默失效"
    assert task in pending

    recorder["gate"].set()
    outcome = await task
    assert outcome["extracted"], "done_callback 读的就是这个结构,不能是 None"
    assert len(recorder["calls"]) == 1
    call = recorder["calls"][0]
    assert call["repoName"] == "IHUI-AI"
    assert call["user_id"] == "u-42"
    assert call["session_id"] == "s-7"
    assert len(call["messages"]) == 8
    # 任务完成后必须从 pending 集合摘掉,否则它永远不为空,调用方的排空逻辑就废了
    await asyncio.sleep(0)
    assert pending == set()


async def test_schedule_uses_conversation_length_not_window(
    recorder: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """闸门看的是整场会话长度,不是窗口长度:传 2 条窗口 + 整场 30 条 ⇒ 应当起。"""
    from app.core import config

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    task = schedule_distillation_from_conversation(
        _conversation(2),
        repo_name="IHUI-AI",
        conversation_length=30,
    )
    assert task is not None
    recorder["gate"].set()
    await task


async def test_task_strongly_held_when_caller_passes_no_registry(
    recorder: dict[str, Any], monkeypatch: pytest.MonkeyPatch
) -> None:
    """调用方不登记集合时,模块必须自己持有 task 到完成。

    `asyncio.create_task` 的返回值若无人持有,事件循环只留弱引用 —— 任务可能跑到
    一半被 GC,表现正是"蒸馏偶尔什么都没发生且零报错"。这一条守的就是那个坑。
    """
    from app.core import config

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    task = schedule_distillation_from_conversation(
        _conversation(8), repo_name="IHUI-AI", conversation_length=8
    )
    assert task is not None
    assert task in kce._self_held_tasks, "没传 pending_tasks 时模块必须代持,否则任务可被 GC"

    recorder["gate"].set()
    await task
    await asyncio.sleep(0)
    assert task not in kce._self_held_tasks, "完成后必须放手,否则这个集合只增不减"


async def test_cancelled_distillation_is_reported_without_callback_noise(
    recorder: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """取消路径也要有下文,而且不得在 done_callback 里二次抛。

    回调里抛异常的表现是 asyncio 打一句"Exception in callback",真正的状态
    ("没落库")反而被那句噪声盖住 —— 这一档正是"失败必须响"的反面:响了,但响错了。
    """
    from app.core import config

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    task = schedule_distillation_from_conversation(
        _conversation(8), repo_name="IHUI-AI", conversation_length=8
    )
    assert task is not None
    task.cancel()

    with caplog.at_level(logging.WARNING, logger=_LOGGER_NAME):
        await asyncio.gather(task, return_exceptions=True)

    assert "被取消" in caplog.text
    assert "Exception in callback" not in caplog.text


async def test_schedule_exception_is_logged_not_swallowed(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """抽取器抛异常时:主流程不受影响,但必须喊出来(否则"蒸馏失败"= 什么都没发生)。"""
    from app.core import config

    async def _boom(*_a: Any, **_kw: Any) -> None:
        raise RuntimeError("抽取器炸了")

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    monkeypatch.setattr(KnowledgeCardExtractor, "extract_and_save", _boom, raising=True)

    with caplog.at_level(logging.WARNING, logger=_LOGGER_NAME):
        task = schedule_distillation_from_conversation(
            _conversation(8), repo_name="IHUI-AI", conversation_length=8
        )
        assert task is not None
        await asyncio.gather(task, return_exceptions=True)

    assert "蒸馏任务异常" in caplog.text


# =============================================================================
# 3. 端到端:真跑一次执行循环,证明"会话结束"真的会走到蒸馏
# =============================================================================


@pytest.fixture
def stub_llm(monkeypatch: pytest.MonkeyPatch) -> None:
    """mock llm_gateway.complete,避免真网络调用(同 test_agent_loop.py 的既有口径)。"""

    async def fake_complete(messages: Any, model: Any = None, **kwargs: Any) -> dict[str, Any]:
        return {
            "content": "[stub] 已完成这一步。",
            "model": model or "stub-model",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "stub": True,
        }

    monkeypatch.setattr("app.services.agent_loop.llm_gateway.complete", fake_complete)


async def test_agent_loop_completed_triggers_distillation(
    executor: AgentExecutor, recorder: dict[str, Any], stub_llm: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """执行循环收尾 ⇒ 抽取器被调到,repo 来自调用方声明。

    跑两轮同一 session:单轮只有 2 条消息,过不了"会话太短"的成本闸门 ——
    那不是缺陷,是设计。要证明"接线在",就得给出一条真能过闸的会话。
    """
    from app.core import config

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    sid = "wiring-test-session"

    first = await executor.run("第一问", session_id=sid, max_iterations=1, repo_name="IHUI-AI")
    assert first["status"] == "completed"
    await asyncio.gather(*list(executor._pending_tasks), return_exceptions=True)
    mid_calls = len(recorder["calls"])

    second = await executor.run("第二问", session_id=sid, max_iterations=1, repo_name="IHUI-AI")
    assert second["status"] == "completed"
    recorder["gate"].set()
    await asyncio.gather(*list(executor._pending_tasks), return_exceptions=True)

    assert len(recorder["calls"]) > mid_calls, (
        "长会话那一次必须触发蒸馏;不触发说明 agent_loop 的接线根本没执行到"
    )
    hit = recorder["calls"][-1]
    assert hit["repoName"] == "IHUI-AI"
    assert hit["user_id"] is None or isinstance(hit["user_id"], str)
    assert hit["session_id"] == sid


async def test_agent_loop_without_repo_does_not_guess(
    executor: AgentExecutor, recorder: dict[str, Any], stub_llm: None,
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture,
) -> None:
    """没给 repo 且无部署默认 ⇒ 循环照样成功,但抽取器一次都不被调,且喊出原因。

    这条与上一条互为对照:如果哪天有人把"跳过"改成"猜一个仓库",这条会红。
    """
    from app.core import config

    monkeypatch.setattr(config.settings, "auto_knowledge_card_extract_enabled", True)
    monkeypatch.setattr(config.settings, "knowledge_card_default_repo", "")

    with caplog.at_level(logging.INFO, logger=_LOGGER_NAME):
        result = await executor.run(
            "无仓库归属的一问", session_id="no-repo-session", max_iterations=1
        )
        await asyncio.gather(*list(executor._pending_tasks), return_exceptions=True)

    assert result["status"] == "completed", "蒸馏跳过不得影响主流程"
    assert recorder["calls"] == []
    assert "跳过蒸馏" in caplog.text
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
