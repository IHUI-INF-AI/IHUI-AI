# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

# AgentLoopV2 工作区指令链增补注入(第七遍对标 DSH dsh-agent-instructions)。

from app.core.agents_md import load_workspace_instructions
from app.core.agents_md_state import REMOVAL_NOTICE, REPLACEMENT_NOTICE
from app.services.agent_loop_v2 import AgentLoopV2, ToolCall, ToolResult


async def _noop_llm(messages, tools=None, **kwargs):
    return {"content": "ok", "tool_calls": None}


def _loop(workspace):
    return AgentLoopV2(_noop_llm, [], workspace=str(workspace))


def _mk(root, files):
    for rel, content in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    return root


def test_no_duplicate_when_system_already_has_chain(tmp_path, monkeypatch):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "RULE-A"})
    chain = load_workspace_instructions(ws).content
    loop = _loop(ws)
    messages = [{"role": "system", "content": f"sys\n\n[项目文档 AGENTS.md]\n{chain}"}]

    loop._inject_workspace_instructions(messages)

    assert len(messages) == 1


def test_injects_when_system_lacks_chain(tmp_path, monkeypatch):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "RULE-A"})
    loop = _loop(ws)
    messages = [{"role": "system", "content": "sys"}]

    loop._inject_workspace_instructions(messages)

    assert len(messages) == 2
    assert messages[-1]["role"] == "developer"
    assert "<workspace_instructions" in messages[-1]["content"]
    assert "RULE-A" in messages[-1]["content"]
    assert REPLACEMENT_NOTICE not in messages[-1]["content"]


def test_replacement_notice_on_change(tmp_path, monkeypatch):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "RULE-A"})
    loop = _loop(ws)
    messages = [{"role": "system", "content": "sys"}]
    loop._inject_workspace_instructions(messages)

    (ws / "AGENTS.md").write_text("RULE-B", encoding="utf-8")
    loop._inject_workspace_instructions(messages)

    assert REPLACEMENT_NOTICE in messages[-1]["content"]
    assert "RULE-B" in messages[-1]["content"]


def test_removal_notice_on_delete(tmp_path, monkeypatch):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "RULE-A"})
    loop = _loop(ws)
    messages = [{"role": "system", "content": "sys"}]
    loop._inject_workspace_instructions(messages)

    (ws / "AGENTS.md").unlink()
    loop._inject_workspace_instructions(messages)

    assert REMOVAL_NOTICE in messages[-1]["content"]


def test_touched_deeper_dir_discovers_nested_instructions(tmp_path):
    ws = _mk(
        tmp_path / "repo",
        {".git/HEAD": "", "AGENTS.md": "ROOT-RULE", "pkg/AGENTS.md": "PKG-RULE"},
    )
    loop = _loop(ws)
    messages = [{"role": "system", "content": "sys"}]
    loop._inject_workspace_instructions(messages)
    assert "PKG-RULE" not in messages[-1]["content"]

    loop._record_instruction_touch(
        ToolCall(id="c1", name="read_file", args={"path": str(ws / "pkg" / "a.py")}),
        ToolResult(tool_call_id="c1", name="read_file", result={"ok": True}),
    )
    loop._inject_workspace_instructions(messages)

    assert "PKG-RULE" in messages[-1]["content"]
    assert REPLACEMENT_NOTICE in messages[-1]["content"]


def test_failed_touch_is_ignored(tmp_path):
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "ROOT-RULE"})
    loop = _loop(ws)

    loop._record_instruction_touch(
        ToolCall(id="c1", name="read_file", args={"path": str(ws / "pkg" / "a.py")}),
        ToolResult(tool_call_id="c1", name="read_file", result=None, error="boom"),
    )

    assert loop._instruction_dirs == set()


def test_no_workspace_is_zero_behavior(tmp_path):
    loop = AgentLoopV2(_noop_llm, [])
    messages = [{"role": "system", "content": "sys"}]

    loop._inject_workspace_instructions(messages)

    assert len(messages) == 1


def test_first_iteration_replacement_when_system_has_old_chain(tmp_path):
    """跨轮:线程启动注入过旧链,新一轮首次迭代发 REPLACEMENT。"""
    ws = _mk(tmp_path / "repo", {".git/HEAD": "", "AGENTS.md": "NEW-RULE"})
    loop = _loop(ws)
    messages = [{"role": "system", "content": "[项目文档 AGENTS.md]\nOLD-RULE"}]

    loop._inject_workspace_instructions(messages)

    assert REPLACEMENT_NOTICE in messages[-1]["content"]
    assert "NEW-RULE" in messages[-1]["content"]


def test_first_iteration_removal_when_chain_now_empty(tmp_path):
    """跨轮:线程启动注入过旧链,指令文件已删 ⇒ 首迭代必须发 REMOVAL。"""
    ws = _mk(tmp_path / "repo", {".git/HEAD": ""})
    loop = _loop(ws)
    messages = [
        {"role": "system", "content": "# AGENTS.md instructions\n<INSTRUCTIONS>OLD"}
    ]

    loop._inject_workspace_instructions(messages)

    assert REMOVAL_NOTICE in messages[-1]["content"]
