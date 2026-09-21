# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""服务端自主工具注入测试(2026-09-21)。

这层逻辑存在的理由就是"客户端那张关键词表没命中时也该能用",所以样本按**实测召回**分类挑:
正则命中 / 只有关键词表命中 / 两边都不命中(= 诚实的残余上限)。
措辞与命中关系的实测口径见 `test_intent_recall_matches_measured_buckets`。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

from app.services import control_autonomy as ca

_USER = "6b8cd0f6-546f-44c8-853a-5f96edbe08be"
_REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch: pytest.MonkeyPatch) -> None:
    ca.clear_cache_for_tests()
    monkeypatch.delenv("CONTROL_AUTONOMY", raising=False)
    yield
    ca.clear_cache_for_tests()


def _online(monkeypatch: pytest.MonkeyPatch, prefixes: set[str]) -> None:
    async def fake(_user_id: str) -> frozenset[str]:
        return frozenset(prefixes)

    monkeypatch.setattr(ca, "_online_prefixes", fake)


# ---------------------------------------------------------------------------
# 判定源:正则 ∪ 关键词表(两路并联)
# ---------------------------------------------------------------------------

def test_regex_hit_returns_verbs_with_describe() -> None:
    verbs, want_api = ca._intent("打开钱包")
    assert verbs is not None and "navigate" in verbs
    assert "describe" in verbs  # 动作类依赖 describe 的定位符,少给一个就断链
    assert want_api is False


def test_keyword_only_hit_returns_whole_family() -> None:
    """只被关键词表兜住、正则漏掉的措辞 —— 并集的全部价值就在这一条。"""
    verbs, _ = ca._intent("这个表单里的日期不对,改一下再保存")
    assert verbs is None, "关键词命中判不出动词,应返回 None = 整族"


def test_api_keyword_flag() -> None:
    _verbs, want_api = ca._intent("系统里一共有多少用户")
    assert want_api is True


@pytest.mark.parametrize(
    "text",
    ["今天天气怎么样", "解释一下什么是向量数据库", "帮我把这段代码改成 TypeScript"],
)
def test_plain_qa_hits_nothing(text: str) -> None:
    verbs, want_api = ca._intent(text)
    assert not verbs and verbs is not None
    assert want_api is False


def test_family_actions_match_registered_tools() -> None:
    """控制闸认得的动词,必须恰好是服务端真在注册的那些(双向)。

    漂移两个方向都致命:闸门比注册面**宽** ⇒ 注入一个不存在的工具名,模型调它直接报
    未知工具;**窄** ⇒ 端上能力已就绪却永远不发(2026-09-21 移动两族扩七动词时就是这个形态)。
    """
    from app.services import ui_action_bridge as ub

    expected = {
        "web_ui_": {t.name.removeprefix("web_ui_") for t, _ in ub._ui_tools()},
        "mobile_ui_": {t.name.removeprefix("mobile_ui_") for t, _ in ub._app_tools("mobile")},
        "taro_ui_": {t.name.removeprefix("taro_ui_") for t, _ in ub._app_tools("taro")},
    }
    assert set(expected) == set(ca._FAMILY_ACTIONS)
    for prefix, verbs in expected.items():
        assert set(ca._FAMILY_ACTIONS[prefix]) == verbs, prefix


def test_python_keyword_table_does_not_drift_from_shared_ts() -> None:
    """Python 侧移植的关键词表必须与 @ihui/shared 那张 TS 表逐字一致。

    跨语言复制是这里唯一无法靠 import 消除的重复 —— 没有这条断言,两边会各自演化,
    而"客户端命中/服务端不命中"这种偏差在日志里完全看不出来。
    """
    ts = (
        _REPO_ROOT / "packages" / "shared" / "src" / "utils" / "app-control-intent.ts"
    ).read_text(encoding="utf-8")
    blocks = {
        kind: re.findall(r"'([^']+)'", body)
        for kind, body in re.findall(
            r"const (UI|API)_CONTROL_KEYWORDS: readonly string\[\] = \[(.*?)\]", ts, re.S
        )
    }
    assert blocks, "TS 源里找不到关键词表,规则已改?同步更新本断言"
    assert set(blocks["UI"]) == set(ca._CLIENT_UI_KEYWORDS), (
        set(blocks["UI"]) ^ set(ca._CLIENT_UI_KEYWORDS)
    )
    assert set(blocks["API"]) == set(ca._CLIENT_API_KEYWORDS), (
        set(blocks["API"]) ^ set(ca._CLIENT_API_KEYWORDS)
    )


# ---------------------------------------------------------------------------
# 注入规则
# ---------------------------------------------------------------------------

async def test_web_online_injects_web_family(monkeypatch: pytest.MonkeyPatch) -> None:
    _online(monkeypatch, {"web_ui_"})
    out = await ca.augment_agent_tools([], "打开钱包", _USER)
    assert out is not None
    assert "web_ui_navigate" in out and "web_ui_describe" in out
    assert not any(t.startswith(("mobile_ui_", "taro_ui_")) for t in out), out


async def test_mobile_only_online_routes_its_verbs_to_mobile_family(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _online(monkeypatch, {"mobile_ui_"})
    # 只有 RN 在线时,"点击提交按钮"必须落到 mobile 族的 click ——
    # 2026-09-21 补齐前这里会被族裁剪成"只剩 describe",端上注册好的控件到不了模型手上。
    out = await ca.augment_agent_tools([], "帮我点击提交按钮", _USER)
    assert out is not None
    assert all(not t.startswith("web_ui_") for t in out), out
    assert "mobile_ui_click" in out, out
    # 动作类工具一律配一份 describe:元素定位符只能从快照里拿,模型无从猜
    assert "mobile_ui_describe" in out, out


async def test_two_ends_online_inject_both_families(monkeypatch: pytest.MonkeyPatch) -> None:
    _online(monkeypatch, {"web_ui_", "taro_ui_"})
    out = await ca.augment_agent_tools(None, "打开钱包", _USER)
    assert out is not None
    assert "web_ui_navigate" in out and "taro_ui_navigate" in out


async def test_already_carried_tools_widen_without_any_lexical_gate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """用户已选插件(agent_tools 非空 ⇒ 本轮本来就要进 tool loop)时,在线端整族直接并入。

    这条不加任何词面判定:多带几个工具名不产生额外往返,而"我关了插件但 still 想让 AI 动手"
    正是关键词表最容易漏的场景。
    """
    _online(monkeypatch, {"web_ui_"})
    out = await ca.augment_agent_tools(["browser_screenshot"], "帮我写首诗", _USER)
    assert out is not None
    assert out[0] == "browser_screenshot"  # 原有顺序不动
    assert {"web_ui_describe", "web_ui_navigate", "web_ui_invoke"} <= set(out)


async def test_api_intent_injects_entry_pair(monkeypatch: pytest.MonkeyPatch) -> None:
    _online(monkeypatch, set())
    out = await ca.augment_agent_tools([], "系统里一共有多少用户", _USER)
    assert out is not None
    # 只给 search 会让模型搜到了却调不动,必须成对
    assert {"api_endpoints_search", "api_endpoint_call"} <= set(out)


async def test_dedup_and_order_preserved(monkeypatch: pytest.MonkeyPatch) -> None:
    _online(monkeypatch, {"web_ui_"})
    out = await ca.augment_agent_tools(["web_ui_read", "run_command"], "打开钱包", _USER)
    assert out is not None
    assert out[0] == "web_ui_read" and out[1] == "run_command"
    assert len(out) == len(set(out)), out


# ---------------------------------------------------------------------------
# 失败面:一律"不加工具",绝不打断聊天
# ---------------------------------------------------------------------------

async def test_no_endpoint_online_adds_no_ui_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    _online(monkeypatch, set())
    assert await ca.augment_agent_tools([], "打开钱包", _USER) is None


async def test_disabled_by_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CONTROL_AUTONOMY", "false")
    _online(monkeypatch, {"web_ui_"})
    assert await ca.augment_agent_tools(["web_ui_read"], "打开钱包", _USER) == ["web_ui_read"]


async def test_always_mode_ignores_lexical_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """`always` 是部署方显式选择:不做词面判定,有端在线就整族给。

    默认不开 —— 它会让每条普通问答多一次非流式 complete(),首字延迟用户是能感觉到的。
    """
    monkeypatch.setenv("CONTROL_AUTONOMY", "always")
    _online(monkeypatch, {"web_ui_"})
    out = await ca.augment_agent_tools([], "今天天气怎么样", _USER)
    assert out is not None
    assert {"web_ui_describe", "web_ui_navigate", "web_ui_invoke"} <= set(out)


async def test_missing_user_id_is_noop() -> None:
    assert await ca.augment_agent_tools([], "打开钱包", None) is None


async def test_status_query_failure_fails_soft(monkeypatch: pytest.MonkeyPatch) -> None:
    """查不到在线端 ≠ 出错:安静地"不注入",不把异常抛进聊天流。"""
    import httpx

    monkeypatch.setenv("AI_CALLBACK_SECRET", "test-secret")

    class _Boom:
        def __init__(self, **_kw: Any) -> None:
            pass

        async def __aenter__(self) -> _Boom:
            raise httpx.ConnectError("api down")

        async def __aexit__(self, *_a: Any) -> None:
            return None

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _Boom())
    assert await ca.augment_agent_tools([], "打开钱包", _USER) is None


async def test_status_result_is_cached(monkeypatch: pytest.MonkeyPatch) -> None:
    """一次对话多轮工具往返不该反复打 status(那会加首字延迟)。

    顺带钉住鉴权头必须是 `x-internal-service-token`(与 apps/api 的 AI_CALLBACK_SECRET 同源):
    实测拿 AGENT_CONTROL_INTERNAL_SECRET 当它用会 401,而本模块对 401 是**静默降级**
    (不注入工具),现象只是"AI 不动",极易被误判成模型能力问题。
    """
    calls = {"n": 0}
    seen_headers: dict[str, str] = {}

    class _Resp:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, Any]:
            return {"data": {"endpoints": [{"endpoint": "web", "instanceId": "w1"}]}}

    class _Client:
        def __init__(self, **_kw: Any) -> None:
            pass

        async def __aenter__(self) -> _Client:
            return self

        async def __aexit__(self, *_a: Any) -> None:
            return None

        async def get(self, _url: str, **kw: Any) -> _Resp:
            calls["n"] += 1
            seen_headers.update(kw.get("headers") or {})
            return _Resp()

    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _Client())
    monkeypatch.setenv("AI_CALLBACK_SECRET", "test-secret")

    first = await ca._online_prefixes(_USER)
    second = await ca._online_prefixes(_USER)
    assert first == frozenset({"web_ui_"}) and second == first
    assert calls["n"] == 1, f"应命中缓存,实发 {calls['n']} 次"
    assert seen_headers.get("x-internal-service-token") == "test-secret", seen_headers
    assert seen_headers.get("x-user-id") == _USER, seen_headers
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
