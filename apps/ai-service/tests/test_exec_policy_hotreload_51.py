"""ExecPolicyManager 目录加载 / 热更新(批 51)测试。

覆盖:
① 目录加载多条规则并 evaluate 命中;
② 注释/空行/非法行容忍(warnings 记录);
③ append_rule 内存立即生效 + 落盘文件含新行;
④ 重新 load 后规则仍在(持久性);
⑤ rules_dir=None 纯内存模式不读文件;
⑥ 并发 append_rule 串行化(两个任务先后 append 都成功)。

Windows 环境:路径用 pathlib;文件写入显式 ``encoding="utf-8"`` 与 ``newline="\n"``。
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.services.exec_policy import (
    Decision,
    ExecPolicyManager,
    PrefixRule,
    parse_rule_line,
)


def _write_rules(rules_dir: Path, name: str, content: str) -> Path:
    path = rules_dir / name
    path.write_text(content, encoding="utf-8", newline="\n")
    return path


async def test_load_from_dir_multiple_rules(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    _write_rules(
        rules_dir,
        "default.rules",
        "DENY|sudo rm\nPROMPT|git push\nALLOW|npm run\n",
    )
    mgr = ExecPolicyManager(rules_dir)
    policy = mgr.current()
    assert policy.evaluate("sudo rm -rf /").decision is Decision.DENY
    assert policy.evaluate("git push origin").decision is Decision.PROMPT
    assert policy.evaluate("npm run build").decision is Decision.ALLOW


async def test_ignore_comments_blanks_and_bad_lines(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    _write_rules(
        rules_dir,
        "default.rules",
        "# 这是注释\n\nDENY|sudo rm\n   \nBADLINE_NO_PIPE\nALLOW|echo\n",
    )
    mgr = ExecPolicyManager(rules_dir)
    assert mgr.current().evaluate("sudo rm -rf /").decision is Decision.DENY
    assert mgr.current().evaluate("echo hi").decision is Decision.ALLOW
    # 非法行 BADLINE_NO_PIPE 被容忍并记录到 warnings
    assert len(mgr.warnings) == 1
    assert "BADLINE_NO_PIPE" in mgr.warnings[0]


async def test_append_rule_memory_and_disk(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    _write_rules(rules_dir, "default.rules", "DENY|sudo rm\n")
    mgr = ExecPolicyManager(rules_dir)
    new_rule = PrefixRule(("git", "push", "--force"), Decision.PROMPT, source="runtime")
    await mgr.append_rule(new_rule)
    # 内存立即生效
    assert mgr.current().evaluate("git push --force").decision is Decision.PROMPT
    # 落盘文件含新行
    content = (rules_dir / "default.rules").read_text(encoding="utf-8")
    assert "PROMPT|git push --force" in content


async def test_append_rule_persists_after_reload(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    _write_rules(rules_dir, "default.rules", "DENY|sudo rm\n")
    mgr = ExecPolicyManager(rules_dir)
    await mgr.append_rule(
        PrefixRule(("rm", "-rf"), Decision.DENY, source="runtime")
    )
    await mgr.load()  # 重新从磁盘加载
    assert mgr.current().evaluate("rm -rf foo").decision is Decision.DENY
    assert len(mgr.current().rules) >= 2


async def test_rules_dir_none_is_in_memory_only(tmp_path: Path) -> None:
    # 不传 rules_dir:纯内存模式,不读任何文件
    mgr = ExecPolicyManager()
    assert mgr._rules_dir is None
    # 内存 append 仍生效,但不落盘(不应在任何路径产生 default.rules)
    await mgr.append_rule(
        PrefixRule(("sudo",), Decision.PROMPT, source="runtime")
    )
    assert mgr.current().evaluate("sudo hi").decision is Decision.PROMPT
    stray = tmp_path / "default.rules"
    assert not stray.exists()


async def test_concurrent_append_serialized(tmp_path: Path) -> None:
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    _write_rules(rules_dir, "default.rules", "DENY|sudo rm\n")
    mgr = ExecPolicyManager(rules_dir)

    async def _append(token: str) -> None:
        await mgr.append_rule(
            PrefixRule((token,), Decision.ALLOW, source="runtime"),
            file_name="extra.rules",
        )

    await asyncio.gather(_append("foo"), _append("bar"))
    content = (rules_dir / "extra.rules").read_text(encoding="utf-8")
    assert "ALLOW|foo" in content
    assert "ALLOW|bar" in content
    assert mgr.current().evaluate("foo").decision is Decision.ALLOW
    assert mgr.current().evaluate("bar").decision is Decision.ALLOW


def test_parse_rule_line_ok_and_bad() -> None:
    r = parse_rule_line("DENY|sudo rm")
    assert r.decision is Decision.DENY
    assert r.pattern == ("sudo", "rm")
    # 大小写不敏感
    r2 = parse_rule_line("prompt|git push")
    assert r2.decision is Decision.PROMPT
    assert r2.pattern == ("git", "push")
    # 非法:决策非法
    with pytest.raises(ValueError):
        parse_rule_line("NOPE|sudo rm")
    # 非法:空 pattern
    with pytest.raises(ValueError):
        parse_rule_line("DENY|")
    # 非法:缺分隔符
    with pytest.raises(ValueError):
        parse_rule_line("DENY sudo rm")


async def test_append_rule_rollback_on_disk_failure(tmp_path: Path) -> None:
    """落盘失败时内存应回滚(用「路径祖先是已存在文件」稳定触发 OSError)。"""
    blocker = tmp_path / "blocker.txt"
    blocker.write_text("not a dir", encoding="utf-8")
    # rules_dir 的某一级祖先(blocker.txt)是文件,导致 mkdir(parents=True) 失败
    rules_dir = blocker / "rules"
    mgr = ExecPolicyManager(rules_dir)
    before = mgr.current()
    with pytest.raises(OSError):
        await mgr.append_rule(
            PrefixRule(("x",), Decision.ALLOW, source="runtime")
        )
    # 内存快照应回滚为原策略(未新增规则)
    assert mgr.current() is before


async def test_file_creation_under_rules_dir(tmp_path: Path) -> None:
    """rules_dir 不存在时 append_rule 应能创建目录并落盘。"""
    rules_dir = tmp_path / "nested" / "rules"
    mgr = ExecPolicyManager(rules_dir)
    await mgr.append_rule(
        PrefixRule(("ls",), Decision.ALLOW, source="runtime")
    )
    assert (rules_dir / "default.rules").exists()
    assert "ALLOW|ls" in (rules_dir / "default.rules").read_text(encoding="utf-8")
