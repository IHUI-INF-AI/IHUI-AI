# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""2026-11-01 安全强化:两处"外部串直接当路径用"的越界。

覆盖两格,各配**副作用断言**(不是"返回了错误串"就算拦住):

1) `app/services/rules_engine.py` —— `DELETE /api/rules/{rule_id}` 的 rule_id 是 URL 路径段,
   旧实现 `os.path.join(_rules_dir, f"{rule_id}.md")` + `os.remove`,于是 `../../../*` 形态
   就是**任意 .md 文件删除**(且该路由只要登录就能打,不是 admin 专属)。
2) `app/services/mcp_server.py::_tool_git_operations` —— `repo` 是工具入参(模型可控),
   旧实现直接 `os.path.abspath(repo)` 当 git 的 cwd,role=0 的"只读 git 面"因此能对服务器
   **任意目录**跑 status / ls-files / log / diff ⇒ 跨目录信息泄露。同文件早就有
   `_validate_path_in_workspace` 这把尺子(13 个调用点都在问它),这一格是漏挂,不是没判据。
"""

from __future__ import annotations

import os

import pytest

from app.services import mcp_server
from app.services.rules_engine import RulesEngine, rule_file_path


def _touch(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("# outside\n")


class TestRuleFilePathContainment:
    def test_traversal_forms_are_all_refused(self, tmp_path):
        rules_dir = str(tmp_path / "rules")
        os.makedirs(rules_dir, exist_ok=True)
        for evil in [
            "../../../etc/passwd",
            "..\\..\\windows\\win.ini",
            "a/b",
            "sub/../x",
            "",
            ".",
            "..",
            "x\x00y",
        ]:
            assert rule_file_path(rules_dir, evil) is None, f"越界形态被放过:{evil!r}"

    def test_legit_id_resolves_inside_the_dir(self, tmp_path):
        rules_dir = str(tmp_path / "rules")
        os.makedirs(rules_dir, exist_ok=True)
        got = rule_file_path(rules_dir, "rule-42")
        assert got is not None
        assert os.path.dirname(got) == os.path.realpath(rules_dir)
        assert got.endswith("rule-42.md")

    def test_symlink_inside_dir_pointing_outside_is_refused(self, tmp_path):
        rules_dir = tmp_path / "rules"
        rules_dir.mkdir()
        outside = tmp_path / "secret.md"
        outside.write_text("# secret\n", encoding="utf-8")
        try:
            # 链接名必须带 .md:判据是先把 rule_id 拼成 `<id>.md` 再解析,
            # 链一个叫 link 的文件根本不在判决路径上(第一版夹具就踩了这个)。
            os.symlink(str(outside), str(rules_dir / "link.md"))
        except (OSError, NotImplementedError):
            pytest.skip("本机不允许创建符号链接")
        got = rule_file_path(str(rules_dir), "link")
        assert got is None, f"目录内的符号链接把删除动作指到了目录外:{got}"

    def test_delete_with_traversal_id_leaves_the_outside_file_intact(self, tmp_path):
        rules_dir = str(tmp_path / "ws" / "rules")
        os.makedirs(rules_dir, exist_ok=True)
        # 夹具刻意按"旧实现真会删到它"来摆:victim 距 rules_dir 两级,穿越串正好指到它。
        victim = os.path.realpath(os.path.join(rules_dir, "..", "..", "victim.md"))
        _touch(victim)
        assert os.path.realpath(
            os.path.join(rules_dir, "../../victim.md")  # 旧实现的那一行,逐字复现
        ) == victim, "夹具没摆成旧实现能命中的形状,这条断言就是空的"
        engine = RulesEngine(rules_dir=rules_dir)
        assert engine.delete("../../victim") is False
        assert os.path.exists(victim), "越界 rule_id 仍然删掉了目录外的文件"


class TestGitRepoContainment:
    async def test_repo_outside_workspace_never_reaches_a_subprocess(self, tmp_path, monkeypatch):
        root = tmp_path / "ws"
        root.mkdir()
        outside = tmp_path / "server-secrets"
        outside.mkdir()
        monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))

        def _boom(*args, **kwargs):  # pragma: no cover - 命中即测试失败
            raise AssertionError("越界 repo 竟然走到了 subprocess")

        # 被审函数体内是 `import subprocess`(局部导入),所以只能替换真模块上的属性
        monkeypatch.setattr("subprocess.run", _boom)
        res = await mcp_server._tool_git_operations({"action": "status", "repo": str(outside)})
        assert res["ok"] is False
        assert res["error"] == "PATH_NOT_IN_WORKSPACE"

    async def test_positive_control_repo_inside_workspace_proceeds(self, tmp_path, monkeypatch):
        """正向对照:整片写死拒绝也能骗过上一条 —— 这一档证明白名单内的 repo 照旧走真实流程。"""
        root = tmp_path / "ws"
        (root / "repo").mkdir(parents=True)
        monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(root))
        seen: list[str] = []

        class _R:
            returncode = 0
            stdout = "clean"
            stderr = ""

        def _fake_run(cmd, **kwargs):
            seen.append(str(kwargs.get("cwd")))
            return _R()

        monkeypatch.setattr("subprocess.run", _fake_run)
        res = await mcp_server._tool_git_operations(
            {"action": "status", "repo": str(root / "repo")}
        )
        assert res.get("error") != "PATH_NOT_IN_WORKSPACE"
        assert len(seen) == 1
        assert os.path.realpath(seen[0]) == os.path.realpath(str(root / "repo"))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
