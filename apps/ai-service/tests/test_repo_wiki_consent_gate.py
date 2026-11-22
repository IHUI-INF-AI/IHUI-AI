# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""自动 Repo Wiki 注入的**显式 opt-in 门槛**回归测试(2026-10-03 数据出域合规整改立)。

背景:2026-09 智谱 ZCode 因未经知情把用户仓库数据传上 MaaS 引发争议,事后紧急上线
"数据内容不留存"开关。本仓存在同型风险 —— `_maybe_inject_auto_repo_wiki` 的旧判据是:

    if req.wikiContext is not False and req.workspace_path:

即「字段缺省 / null / undefined 一律走注入,必须显式传 false 才关」。这意味着客户端只要
不主动关,工作区 markdown 就会被切前 4000 字拼进 user message 发往外部模型服务商,
而**用户从未做过任何上传动作**,界面上也没有任何提示。

整改后判据为**显式 opt-in**:`wikiContext is True`(或部署方显式置 IHUI_WIKI_ENABLE=1)
才注入。本文件把三态(None/False/True)+ env 覆盖 + 硬开关优先级全部钉死,防止后续重构
把闸门悄悄拆回 opt-out。

纪律:
- 全程 monkeypatch `ensure_wiki`,断言的是**它是否被调用**,不触网、不读真实工作区。
- 不改 app.routers.llm 内部其他实现,只测门槛这一条决策线。
"""

from __future__ import annotations

import os
from typing import Any

import pytest

from app.routers import llm as llm_router

# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


class _FakeReq:
    """最小化的 LLMCompleteRequest 替身(只需门槛函数读到的两个字段)。"""

    def __init__(self, wiki_context: bool | None, workspace_path: str | None = "/tmp/ws") -> None:
        self.wikiContext = wiki_context
        self.workspace_path = workspace_path


@pytest.fixture
def ensure_wiki_spy(monkeypatch):
    """替换 repo_wiki_engine.ensure_wiki,记录是否被调用并返回假 wiki 文本。"""
    calls: list[dict[str, Any]] = []

    async def _fake_ensure(workspace_path: str, namespace: str | None = None) -> str:
        calls.append({"workspace_path": workspace_path, "namespace": namespace})
        return "<!-- wiki-hash --> fake-wiki-body"

    import app.services.repo_wiki_engine as engine_mod

    monkeypatch.setattr(engine_mod, "ensure_wiki", _fake_ensure)
    return calls


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """每个用例都从"两个 env 都没配"的干净状态出发,避免用例间串味。"""
    monkeypatch.delenv("IHUI_WIKI_ENABLE", raising=False)
    monkeypatch.delenv("IHUI_WIKI_DISABLE", raising=False)


async def _run(req: _FakeReq) -> list[dict[str, Any]]:
    return await llm_router._maybe_inject_auto_repo_wiki([{"role": "user", "content": "hi"}], req)


# ---------------------------------------------------------------------------
# 1. 三态门槛:缺省 / None / False 一律不注入(整改核心)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("wiki_context", [None, False], ids=["omitted-none", "explicit-false"])
async def test_does_not_inject_without_explicit_optin(wiki_context, ensure_wiki_spy):
    """**缺省与显式 false 都不注入** —— 这是整改的核心期望值。

    旧实现下 None 会走注入(判据 `is not False`),等于把"用户没做任何动作"当成
    "用户同意外传"。现在必须显式 true 才注入。
    """
    out = await _run(_FakeReq(wiki_context))

    assert ensure_wiki_spy == [], "未显式 opt-in 时不得扫描/外发工作区文件"
    assert out == [{"role": "user", "content": "hi"}], "messages 应原样返回,不被改写"


async def test_injects_on_explicit_true(ensure_wiki_spy):
    """显式 true ⇒ 注入,且 ensure_wiki 收到的是请求里的 workspace_path。"""
    out = await _run(_FakeReq(True, workspace_path="/tmp/myproj"))

    assert len(ensure_wiki_spy) == 1, "显式 opt-in 后应调用 ensure_wiki"
    assert ensure_wiki_spy[0]["workspace_path"] == "/tmp/myproj"
    joined = "".join(str(m.get("content", "")) for m in out)
    assert "<!-- repo-wiki-auto -->" in joined, "应带自动注入的 marker"
    assert "fake-wiki-body" in joined


async def test_explicit_true_without_workspace_path_is_noop(ensure_wiki_spy):
    """显式 true 但没有 workspace_path ⇒ 无从扫描,静默不动(旧行为一致)。"""
    out = await _run(_FakeReq(True, workspace_path=None))

    assert ensure_wiki_spy == [], "无 workspace_path 时不应触发扫描"
    assert out == [{"role": "user", "content": "hi"}]


# ---------------------------------------------------------------------------
# 2. env 覆盖:IHUI_WIKI_ENABLE=1 可恢复"全站默认开",但不能反向开启关闭
# ---------------------------------------------------------------------------


async def test_env_enable_restores_default_on(monkeypatch, ensure_wiki_spy):
    """部署方显式置 IHUI_WIKI_ENABLE=1 时,缺省值恢复为开启(给已披露的部署留口子)。"""
    monkeypatch.setenv("IHUI_WIKI_ENABLE", "1")

    await _run(_FakeReq(None))

    assert len(ensure_wiki_spy) == 1, "IHUI_WIKI_ENABLE=1 应恢复旧行为(缺省即注入)"


@pytest.mark.parametrize("value", ["0", "", "true", "yes"], ids=str)
async def test_env_enable_only_accepts_exactly_1(monkeypatch, ensure_wiki_spy, value):
    """只有字面量 "1" 算开启,避免 "true"/"0" 这类模糊取值误开成默认外发。"""
    monkeypatch.setenv("IHUI_WIKI_ENABLE", value)

    await _run(_FakeReq(None))

    assert ensure_wiki_spy == [], f"IHUI_WIKI_ENABLE={value!r} 不应被当作开启"


async def test_explicit_false_beats_env_enable(monkeypatch, ensure_wiki_spy):
    """调用方显式 false 的优先级**高于** env=1:逐次请求的关闭必须永远有效。"""
    monkeypatch.setenv("IHUI_WIKI_ENABLE", "1")

    await _run(_FakeReq(False))

    assert ensure_wiki_spy == [], "显式 false 应压过全局 env 开启"


# ---------------------------------------------------------------------------
# 3. 硬开关优先级:ensure_wiki 内部 IHUI_WIKI_DISABLE=1 仍是最终否决
# ---------------------------------------------------------------------------


async def test_disable_hard_switch_still_blocks_via_engine(monkeypatch):
    """端到端硬开关:即使门槛放行(显式 true + env enable),引擎侧 DISABLE 仍返回 None。

    这里不打桩 ensure_wiki,而是走真实引擎函数的全局开关分支 —— 验证两道闸的
    优先级是"引擎侧硬开关 > 路由门槛",而不是各管各的。
    """
    monkeypatch.setenv("IHUI_WIKI_DISABLE", "1")
    tmp_ws = os.path.join(os.environ.get("TEMP", "/tmp"), "ihui_wiki_gate_test")
    os.makedirs(tmp_ws, exist_ok=True)
    with open(os.path.join(tmp_ws, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("# t\n")

    out = await _run(_FakeReq(True, workspace_path=tmp_ws))

    assert out == [{"role": "user", "content": "hi"}], "硬开关应完全阻止注入"


# ---------------------------------------------------------------------------
# 4. 失败降级:ensure_wiki 抛异常时绝不阻塞主聊天
# ---------------------------------------------------------------------------


async def test_engine_exception_never_blocks_chat(monkeypatch):
    """ensure_wiki 异常时静默降级,messages 原样返回(主链路零阻塞纪律)。"""
    import app.services.repo_wiki_engine as engine_mod

    async def _boom(*_a, **_kw):
        raise RuntimeError("wiki engine down")

    monkeypatch.setattr(engine_mod, "ensure_wiki", _boom)

    out = await _run(_FakeReq(True))

    assert out == [{"role": "user", "content": "hi"}], "wiki 异常不得影响主聊天"


async def test_empty_wiki_text_not_injected(monkeypatch):
    """ensure_wiki 返回空串/None(无源文件、被禁用)⇒ 不注入空 marker。"""
    import app.services.repo_wiki_engine as engine_mod

    async def _empty(*_a, **_kw):
        return None

    monkeypatch.setattr(engine_mod, "ensure_wiki", _empty)

    out = await _run(_FakeReq(True))

    assert out == [{"role": "user", "content": "hi"}]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
