# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P1-8 Repo Wiki 注入回归测试(2026-09-13 立)。

背景:API 网关按 repoName 从 repo_wiki_docs 读出最新一版「项目百科」总览,
经 wiki_context / wiki_repo 字段透传到 ai-service,由 _inject_repo_wiki 注入
system prompt —— AI 回答代码/架构问题时自动引用项目百科。

覆盖:
- ⑥ 纯函数 _inject_repo_wiki 的完整语义(无 system 插入 / 有 system 追加 /
  同 repo 去重 / 空值 noop / 不同 repo 共存 / repo 值 XML 属性转义);
- 流式端点 /api/llm/complete/stream 确实把 wiki_context 注入到下发 messages。
"""

from __future__ import annotations

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# =============================================================================
# 1. 纯函数:_inject_repo_wiki
# =============================================================================


def test_inject_repo_wiki_inserts_when_no_system():
    """无 system 消息:insert 到 index 0,且含 <repo_wiki 标签与正文。"""
    from app.routers.llm import _inject_repo_wiki

    messages = [{"role": "user", "content": "这个项目的架构是怎样的?"}]
    out = _inject_repo_wiki(messages, "项目百科正文", "demo-repo")

    assert out[0]["role"] == "system"
    assert "<repo_wiki" in out[0]["content"]
    assert "项目百科正文" in out[0]["content"]
    assert "<!-- repo_wiki:demo-repo -->" in out[0]["content"]
    # 原 user 消息保留在末尾
    assert out[-1] == {"role": "user", "content": "这个项目的架构是怎样的?"}
    # 不修改入参列表本身
    assert len(messages) == 1
    assert messages[0]["role"] == "user"


def test_inject_repo_wiki_appends_to_existing_system():
    """已有 system[0]:追加到其 content 末尾,消息条数与顺序不变。"""
    from app.routers.llm import _inject_repo_wiki

    messages = [
        {"role": "system", "content": "既有系统提示"},
        {"role": "user", "content": "hi"},
    ]
    out = _inject_repo_wiki(messages, "百科内容", "repoA")

    assert len(out) == 2
    assert out[0]["role"] == "system"
    assert out[0]["content"].startswith("既有系统提示")
    assert "百科内容" in out[0]["content"]
    assert "<repo_wiki" in out[0]["content"]
    assert out[1] == {"role": "user", "content": "hi"}
    # 不可变更新:原列表未被污染
    assert messages[0]["content"] == "既有系统提示"


def test_inject_repo_wiki_dedup_same_repo():
    """同 repo 二次调用:命中 marker,内容不再变化。"""
    from app.routers.llm import _inject_repo_wiki

    messages = [{"role": "user", "content": "hi"}]
    once = _inject_repo_wiki(messages, "同样内容", "repoA")
    twice = _inject_repo_wiki(once, "同样内容", "repoA")

    assert twice[0]["content"] == once[0]["content"]
    assert twice[0]["content"].count("<repo_wiki") == 1


def test_inject_repo_wiki_none_is_noop():
    """wiki_context 为 None/空/纯空白:返回等价于原列表(不改内容)。"""
    from app.routers.llm import _inject_repo_wiki

    messages = [{"role": "user", "content": "hi"}]
    for empty in (None, "", "   "):
        out = _inject_repo_wiki(messages, empty, "repoA")
        assert out == messages


def test_inject_repo_wiki_two_repos_both_present():
    """不同 repo:两个注入块共存。"""
    from app.routers.llm import _inject_repo_wiki

    messages = [{"role": "user", "content": "hi"}]
    first = _inject_repo_wiki(messages, "百科A", "repoA")
    second = _inject_repo_wiki(first, "百科B", "repoB")

    content = second[0]["content"]
    assert "百科A" in content
    assert "百科B" in content
    assert content.count("<repo_wiki") == 2
    assert "<!-- repo_wiki:repoA -->" in content
    assert "<!-- repo_wiki:repoB -->" in content


def test_inject_repo_wiki_escapes_repo_quotes():
    """repo 值含引号/尖括号:XML 属性被正确转义,标签结构不被破坏。"""
    from app.routers.llm import _inject_repo_wiki

    messages = [{"role": "user", "content": "hi"}]
    out = _inject_repo_wiki(messages, "正文", 'a"b<c>&d')

    content = out[0]["content"]
    assert '<repo_wiki repo="a&quot;b&lt;c&gt;&amp;d">' in content
    assert 'repo="a"b' not in content


# =============================================================================
# 2. 流式端点:/api/llm/complete/stream 端到端注入
# =============================================================================


async def test_stream_injects_repo_wiki(client: AsyncClient, monkeypatch):
    """wiki_context 经端点注入到下发 LLM 的 messages(system 首条含 <repo_wiki)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured["messages"] = messages
        yield {"type": "chunk", "content": "ok"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "_is_stub_mode", lambda: True)

    resp = await client.post(
        "/api/llm/complete/stream",
        json={
            "messages": [{"role": "user", "content": "这个项目的架构?"}],
            "model": "test-model",
            "wiki_context": "项目百科正文",
            "wiki_repo": "demo",
        },
    )
    assert resp.status_code == 200, resp.text[:500]

    msgs = captured["messages"]
    assert msgs[0]["role"] == "system"
    assert "<repo_wiki" in msgs[0]["content"]
    assert "项目百科正文" in msgs[0]["content"]
    assert msgs[-1]["content"] == "这个项目的架构?"


async def test_stream_omits_repo_wiki_when_absent(client: AsyncClient, monkeypatch):
    """未传 wiki_context:不注入空 system 消息(回归保护)。"""
    from app.routers import llm as llm_router

    captured: dict[str, Any] = {}

    async def mock_astream(messages, model=None, owner_uuid=None, **kwargs):
        captured["messages"] = messages
        yield {"type": "chunk", "content": "ok"}
        yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}

    monkeypatch.setattr(llm_router.llm_gateway, "astream", mock_astream)
    monkeypatch.setattr(llm_router.llm_gateway, "_is_stub_mode", lambda: True)

    resp = await client.post(
        "/api/llm/complete/stream",
        json={"messages": [{"role": "user", "content": "hi"}], "model": "test-model"},
    )
    assert resp.status_code == 200, resp.text[:500]
    msgs = captured["messages"]
    assert len(msgs) == 1
    assert "<repo_wiki" not in msgs[0].get("content", "")
