# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

from app.services.agent_loop_v2 import derive_step_evidence


def test_edit_file_derives_diff_and_checkpoint_rollback() -> None:
    evidence = derive_step_evidence(
        "edit_file",
        {"path": "src/app.py", "oldText": "old", "newText": "new"},
        {"ok": True},
        checkpoint_id="cp-1",
    )
    assert evidence["diff"] == {
        "tool": "edit_file",
        "path": "src/app.py",
        "before": "old",
        "after": "new",
    }
    assert evidence["rollback"] == {
        "kind": "checkpoint",
        "checkpoint_id": "cp-1",
        "path": "src/app.py",
        "available": True,
    }
    assert evidence["test"] is None


def test_write_file_derives_new_file_diff_without_rollback() -> None:
    evidence = derive_step_evidence(
        "write_file",
        {"file_path": "src/new.py", "content": "print('hi')"},
        {"ok": True},
    )
    assert evidence["diff"] == {
        "tool": "write_file",
        "path": "src/new.py",
        "before": "",
        "after": "print('hi')",
    }
    assert evidence["rollback"] is None


def test_run_command_derives_test_evidence() -> None:
    evidence = derive_step_evidence(
        "run_command",
        {"command": "pnpm test"},
        {"exitCode": 1, "passed": 10, "failed": 2},
    )
    assert evidence["test"] == {
        "command": "pnpm test",
        "exit_code": 1,
        "passed": 10,
        "failed": 2,
    }
    assert evidence["diff"] is None
    assert evidence["rollback"] is None


def test_unknown_tool_has_no_derived_evidence() -> None:
    evidence = derive_step_evidence("read_file", {"path": "a.py"}, {"content": "x"})
    assert evidence == {"diff": None, "test": None, "rollback": None}