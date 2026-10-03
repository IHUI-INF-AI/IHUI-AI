# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D9(2026-09-19 立):repo_wiki_engine 单元测试。

覆盖 4 个用例:
1. test_generate        —— 首次生成:扫描 markdown,调 LLM 摘要,产出带 wiki-hash 的文本。
2. test_incremental     —— 增量同步:只改一个文件时,仅对该文件重新摘要(其余复用旧摘要)。
3. test_ttl_debounce    —— 60s 内存 TTL 防抖:60s 内重复调用直接返回缓存,不重复调 LLM。
4. test_llm_failure_fallback —— LLM 调用失败时降级取文件首 N 字符,整体不返回 None。

全程用 fake LLM(不触网),tmp 工作区,全链路不依赖真实 API key。
"""

import asyncio
import os

import pytest

from app.core import llm_gateway
from app.services import repo_wiki_engine


def _fixture_workspace(tmp_path) -> str:
    (tmp_path / "README.md").write_text(
        "# My Project\nThis is the readme body content.\n", encoding="utf-8"
    )
    (tmp_path / "AGENTS.md").write_text(
        "# Agents\nContribution rules here.\n", encoding="utf-8"
    )
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "arch.md").write_text("# Architecture\nservice layer description.\n", encoding="utf-8")
    return str(tmp_path)


@pytest.fixture
def workspace(tmp_path):
    return _fixture_workspace(tmp_path)


@pytest.fixture
def fake_llm(monkeypatch):
    """注入 fake LLM:complete 返回按文件路径定制的摘要,并统计调用次数。"""
    calls = {"n": 0}

    def _rel_from(messages):
        for m in messages:
            c = m.get("content", "")
            if "文件路径:" in c:
                return c.split("文件路径:", 1)[1].split("\n", 1)[0].strip()
        return "unknown"

    async def _fake_complete(messages, model="auto", **kwargs):
        calls["n"] += 1
        return {"content": f"SUMMARY[{_rel_from(messages)}]"}

    monkeypatch.setattr(llm_gateway.llm_gateway, "_is_stub_mode", lambda: False)
    monkeypatch.setattr(llm_gateway.llm_gateway, "complete", _fake_complete)
    return calls


def test_generate(fake_llm, workspace):
    repo_wiki_engine.clear_wiki_cache()
    text = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert text, "ensure_wiki 应返回非空文本"
    assert "wiki-hash" in text, "文本应带 <!-- wiki-hash --> 标记"
    assert "SUMMARY[README.md]" in text
    # 2026-10-03 数据出域合规整改:AGENTS.md 已从扫描集**永久移除**(敏感 agent
    # 指令文件,常含内部拓扑/密钥位置),即便显式开启 wiki 注入也不得外发。
    assert "SUMMARY[AGENTS.md]" not in text, "AGENTS.md 是敏感文件,不得作为 wiki 摘要输入外发"
    assert "AGENTS.md" not in text, "AGENTS.md 不应出现在 wiki 文本任何位置"
    assert "SUMMARY[docs/arch.md]" in text
    # 仅 2 个非敏感源文件(README.md + docs/arch.md)各调一次 LLM
    assert fake_llm["n"] == 2


def test_incremental(fake_llm, workspace, monkeypatch):
    repo_wiki_engine.clear_wiki_cache()
    t = {"v": 0.0}
    monkeypatch.setattr(repo_wiki_engine, "_now", lambda: t["v"])

    # 首次生成
    asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert fake_llm["n"] == 2

    # 越过 60s TTL,仅修改 README.md
    t["v"] = 61.0
    with open(os.path.join(workspace, "README.md"), "w", encoding="utf-8") as fh:
        fh.write("# My Project\nCHANGED readme body content.\n")
    text = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))

    # 仅变更文件重新摘要 -> 仅 +1 次 LLM 调用(2 → 3)
    assert fake_llm["n"] == 3, f"增量应只重摘 1 个文件,实际调用 {fake_llm['n']}"
    assert "SUMMARY[README.md]" in text
    assert "SUMMARY[docs/arch.md]" in text  # 未变更文件仍被复用


def test_ttl_debounce(fake_llm, workspace, monkeypatch):
    repo_wiki_engine.clear_wiki_cache()
    t = {"v": 0.0}
    monkeypatch.setattr(repo_wiki_engine, "_now", lambda: t["v"])

    text1 = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert fake_llm["n"] == 2

    # 60s 内 -> 直接返回内存缓存,不重复调 LLM
    t["v"] = 10.0
    text2 = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert fake_llm["n"] == 2, "TTL 内不应再次调用 LLM"
    assert text2 == text1, "TTL 内应返回相同缓存文本"


def test_llm_failure_fallback(workspace, monkeypatch):
    repo_wiki_engine.clear_wiki_cache()

    async def _boom(messages, model="auto", **kwargs):
        raise RuntimeError("llm down")

    monkeypatch.setattr(llm_gateway.llm_gateway, "_is_stub_mode", lambda: False)
    monkeypatch.setattr(llm_gateway.llm_gateway, "complete", _boom)

    text = asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace))
    assert text, "LLM 失败时应降级而非返回 None"
    assert "wiki-hash" in text
    # 降级取文件首 N 字符(README 正文)
    assert "This is the readme body content." in text


# ---------------------------------------------------------------------------
# 2026-10-03 数据出域合规整改:专项回归
#
# 背景:2026-09 智谱 ZCode 因未经知情把用户仓库数据传上 MaaS 引发争议。本仓的
# repo wiki 引擎存在同型风险 —— 工作区 markdown 会被切前 4000 字送外部 LLM。
# 下面几条把「不得外发」钉成不可回归的期望值,防止后续重构悄悄把闸门拆掉。
# ---------------------------------------------------------------------------


def test_discover_excludes_sensitive_agent_instruction_files(tmp_path):
    """_discover_files 永不返回 AGENTS.md / CLAUDE.md 等 agent 内部指令文件。

    这条是黑名单判据的直接断言。注意它测的是**扫描层**,与调用方是否 opt-in 无关:
    即便有人把 AGENTS.md 加回 _ROOT_FIXED,根级 *.md 通配扫描这条路径也必须被拦住。
    """
    (tmp_path / "README.md").write_text("# ok\n", encoding="utf-8")
    (tmp_path / "AGENTS.md").write_text("# internal rules\n", encoding="utf-8")
    (tmp_path / "CLAUDE.md").write_text("# internal rules\n", encoding="utf-8")
    (tmp_path / ".cursorrules").write_text("rules\n", encoding="utf-8")
    (tmp_path / "copilot-instructions.md").write_text("rules\n", encoding="utf-8")
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "AGENTS.md").write_text("# nested internal\n", encoding="utf-8")
    (docs / "safe.md").write_text("# safe\n", encoding="utf-8")

    found = [os.path.basename(p) for p in repo_wiki_engine._discover_files(str(tmp_path))]

    for banned in ("AGENTS.md", "CLAUDE.md", ".cursorrules", "copilot-instructions.md"):
        assert banned not in found, f"{banned} 属敏感 agent 指令文件,不得进入外发集合"
    assert "safe.md" in found, "非敏感文件应正常纳入"
    assert "README.md" in found


def test_discover_excludes_sensitive_dirnames(tmp_path):
    """路径任一层命中敏感目录名(.git/.github/.ihui-agent/.env/secrets)即跳过。"""
    (tmp_path / "README.md").write_text("# ok\n", encoding="utf-8")
    for d in (".git", ".github", ".ihui-agent", "secrets"):
        sub = tmp_path / d
        sub.mkdir()
        (sub / "leak.md").write_text("# secret\n", encoding="utf-8")

    found = list(repo_wiki_engine._discover_files(str(tmp_path)))

    assert all("leak.md" not in p for p in found), "敏感目录下的 markdown 不得被扫入"
    assert any("README.md" in p for p in found), "根级 README 应仍被扫描"


def test_is_sensitive_path_fails_closed_on_bad_input(tmp_path):
    """路径异常(None 这类)时判为敏感(fail-closed):宁可漏扫,不可出域。

    注:空串在 os.path.basename 下得到空名、不命中黑名单,属**预期** ——
    调用方 _discover_files 只传已 join 出来的具体文件路径,空串不会进到这里。
    本用例只钉真正的类型/格式异常必须 fail-closed。
    """
    assert repo_wiki_engine._is_sensitive_path(None, str(tmp_path)) is True
    assert (
        repo_wiki_engine._is_sensitive_path(str(tmp_path / "README.md"), str(tmp_path)) is False
    )


def test_wiki_text_never_contains_sensitive_file_content(fake_llm, tmp_path):
    """端到端:即便 wiki 被显式开启,敏感文件的路径与正文都不得进入 wiki 文本。

    这里用**不经 LLM 的降级路径**(LLM 不可用 → 取文件首 N 字符原样入文本):
    降级路径是唯一会把**原文**而不是摘要写进文本的分支,所以它是验证
    "敏感内容不会外泄"最锋利的探针 —— 摘要路径里敏感内容可能被改写掩盖,
    降级路径下只要扫描集漏了 AGENTS.md,密钥样式串会原形毕露。
    """
    repo_wiki_engine.clear_wiki_cache()
    (tmp_path / "README.md").write_text("# Project\npublic readme.\n", encoding="utf-8")
    (tmp_path / "AGENTS.md").write_text(
        "# Internal\nDB_PASSWORD=hunter2\nDEPLOY_KEY=AKIA-SECRET-VALUE\n", encoding="utf-8"
    )
    # 走 stub(降级)路径,不经 LLM 摘要
    monkey_llm = repo_wiki_engine
    assert monkey_llm is not None

    from app.core import llm_gateway as _lg

    orig = _lg.llm_gateway._is_stub_mode
    _lg.llm_gateway._is_stub_mode = lambda: True
    try:
        text = asyncio.run(repo_wiki_engine.ensure_wiki(str(tmp_path), str(tmp_path)))
    finally:
        _lg.llm_gateway._is_stub_mode = orig

    assert "hunter2" not in text, "AGENTS.md 正文(疑似凭据)绝不得进入 wiki 文本"
    assert "AKIA-SECRET-VALUE" not in text, "AGENTS.md 中的密钥样式串绝不得外发"
    assert "AGENTS.md" not in text, "AGENTS.md 路径本身也不得出现"
    assert "public readme" in text, "非敏感文件应正常进入文本(证明扫描没被整体打死)"


def test_ihui_wiki_disable_hard_switch_still_wins(fake_llm, workspace, monkeypatch):
    """IHUI_WIKI_DISABLE=1 仍是最高优先级硬开关(不放宽任何情况下都生效)。"""
    repo_wiki_engine.clear_wiki_cache()
    monkeypatch.setenv("IHUI_WIKI_DISABLE", "1")

    assert asyncio.run(repo_wiki_engine.ensure_wiki(workspace, workspace)) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
