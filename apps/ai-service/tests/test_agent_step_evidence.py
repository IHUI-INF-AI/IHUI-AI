# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

from pathlib import Path

from app.services.agent_step_recorder import AgentStepRecorder


def test_append_step_preserves_full_explainability_evidence(tmp_path: Path) -> None:
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")
    diff = {"file": "src/app.py", "before": "old", "after": "new"}
    test_result = {"command": "pytest", "passed": 12, "failed": 1}
    rollback = {"checkpoint_id": "cp-1", "applied": False}

    step = rec.append_step(
        "run-explain",
        {
            "type": "tool",
            "tool_name": "edit_file",
            "input": {"path": "src/app.py", "newText": "new"},
            "decision": "execute_tool",
            "reason": "修复空指针并保持接口不变",
            "diff": diff,
            "test": test_result,
            "rollback": rollback,
            "status": "ok",
        },
    )

    assert step["input"] == {"path": "src/app.py", "newText": "new"}
    assert step["decision"] == "execute_tool"
    assert step["reason"] == "修复空指针并保持接口不变"
    assert step["diff"] == diff
    assert step["test"] == test_result
    assert step["rollback"] == rollback

    replayed = rec.replay("run-explain")
    assert replayed["steps"][0] == step


def test_append_step_defaults_missing_explainability_evidence(tmp_path: Path) -> None:
    rec = AgentStepRecorder(file_path=tmp_path / "steps.json")
    step = rec.append_step("run-legacy", {"type": "tool", "tool_name": "read_file"})
    assert step["input"] is None
    assert step["decision"] == ""
    assert step["reason"] == ""
    assert step["diff"] is None
    assert step["test"] is None
    assert step["rollback"] is None