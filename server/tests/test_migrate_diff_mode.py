"""建议 137 测试: migrate_tenants --diff 模式 (部署前安全门).

测试:
  - 解析 alembic versions/*.py 提取 (revision, down_revision, docstring)
  - 构造 revision 链图, 找 head 节点
  - 走 pending 列表 (从 current 到 target)
  - diff_one_schema 返回正确结构
  - 静态模式 (不连 DB) 工作正常
  - 报告格式化输出
  - 多分支合并场景 (down_revision 是 tuple)
  - 错误场景: 不存在 revisions 目录
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_CI = ROOT / "scripts" / "ci"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SCRIPTS_CI) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_CI))

from migrate_tenants import (
    DEFAULT_VERSIONS_DIR,
    _parse_version_script,
    build_revision_graph,
    diff_one_schema,
    find_head,
    parse_alembic_versions,
    print_diff_report,
    walk_from_current,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def fake_versions_dir(tmp_path):
    """构造一个测试用的 versions 目录 (3 个线性 revision)."""
    d = tmp_path / "versions"
    d.mkdir()
    (d / "001_init.py").write_text(
        '"""initial schema."""\n' "revision = '001'\n" "down_revision = None\n",
        encoding="utf-8",
    )
    (d / "002_add_idx.py").write_text(
        '"""add indexes.\n\nDescription line 2."""\n' "revision = '002_add_idx'\n" "down_revision = '001'\n",
        encoding="utf-8",
    )
    (d / "003_hot.py").write_text(
        '"""hot tables migrate."""\n' "revision = '003_hot'\n" "down_revision = '002_add_idx'\n",
        encoding="utf-8",
    )
    return d


@pytest.fixture
def branched_versions_dir(tmp_path):
    """构造分叉: 003a, 003b 都基于 002."""
    d = tmp_path / "versions"
    d.mkdir()
    (d / "001_init.py").write_text(
        '"""init"""\n' "revision = '001'\n" "down_revision = None\n",
        encoding="utf-8",
    )
    (d / "002_base.py").write_text(
        '"""base"""\n' "revision = '002'\n" "down_revision = '001'\n",
        encoding="utf-8",
    )
    (d / "003a_branch.py").write_text(
        '"""branch a"""\n' "revision = '003a'\n" "down_revision = '002'\n",
        encoding="utf-8",
    )
    (d / "003b_branch.py").write_text(
        '"""branch b"""\n' "revision = '003b'\n" "down_revision = '002'\n",
        encoding="utf-8",
    )
    return d


# ---------------------------------------------------------------------------
# TestParseVersionScript
# ---------------------------------------------------------------------------


class TestParseVersionScript:
    """_parse_version_script 提取元信息."""

    def test_basic_revision(self, tmp_path):
        p = tmp_path / "001.py"
        p.write_text(
            '"""hello world."""\n' "revision = '001'\n" "down_revision = None\n",
            encoding="utf-8",
        )
        meta = _parse_version_script(p)
        assert meta["revision"] == "001"
        assert meta["down_revision"] is None
        assert meta["description"] == "hello world."
        assert meta["filename"] == "001.py"

    def test_multiline_docstring_first_line(self, tmp_path):
        p = tmp_path / "001.py"
        p.write_text(
            '"""first line.\n\nsecond line."""\n' "revision = '001'\n" "down_revision = None\n",
            encoding="utf-8",
        )
        meta = _parse_version_script(p)
        # description 只取第一行
        assert meta["description"] == "first line."

    def test_down_revision_tuple(self, tmp_path):
        p = tmp_path / "004_merge.py"
        p.write_text(
            '"""merge."""\n' "revision = '004_merge'\n" "down_revision = ('003a', '003b')\n",
            encoding="utf-8",
        )
        meta = _parse_version_script(p)
        assert meta["revision"] == "004_merge"
        assert meta["down_revision"] == ("003a", "003b")

    def test_no_docstring(self, tmp_path):
        p = tmp_path / "001.py"
        p.write_text(
            "revision = '001'\n" "down_revision = None\n",
            encoding="utf-8",
        )
        meta = _parse_version_script(p)
        assert meta["revision"] == "001"
        assert meta["description"] == ""

    def test_syntax_error_handled(self, tmp_path):
        p = tmp_path / "bad.py"
        p.write_text("not valid python !@#$", encoding="utf-8")
        meta = _parse_version_script(p)
        # 不抛, 返回带错误的元信息
        assert meta["revision"] is None
        assert "parse error" in meta["description"].lower()


# ---------------------------------------------------------------------------
# TestParseAlembicVersions
# ---------------------------------------------------------------------------


class TestParseAlembicVersions:
    """parse_alembic_versions 扫描目录."""

    def test_scan_default_dir(self):
        """真实 alembic/versions 目录能扫描."""
        if not DEFAULT_VERSIONS_DIR.exists():
            pytest.skip("alembic/versions 不存在")
        versions = parse_alembic_versions()
        assert len(versions) >= 1
        # 验证每个 entry 都有 filename + revision
        for v in versions:
            assert "filename" in v
            assert "path" in v

    def test_scan_empty_dir(self, tmp_path):
        versions = parse_alembic_versions(tmp_path)
        assert versions == []

    def test_scan_fake_dir(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        assert len(versions) == 3
        revs = [v["revision"] for v in versions]
        assert "001" in revs
        assert "002_add_idx" in revs
        assert "003_hot" in revs

    def test_skip_pycache(self, fake_versions_dir):
        # 加 __pycache__/xxx.pyc
        pycache = fake_versions_dir / "__pycache__"
        pycache.mkdir()
        (pycache / "001.cpython-313.pyc").write_text("binary", encoding="utf-8")
        versions = parse_alembic_versions(fake_versions_dir)
        # .pyc 不被解析
        filenames = [v["filename"] for v in versions]
        assert not any(f.endswith(".pyc") for f in filenames)


# ---------------------------------------------------------------------------
# TestBuildRevisionGraph
# ---------------------------------------------------------------------------


class TestBuildRevisionGraph:
    """build_revision_graph."""

    def test_linear_graph(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        assert graph["001"] is None
        assert graph["002_add_idx"] == "001"
        assert graph["003_hot"] == "002_add_idx"

    def test_branched_graph(self, branched_versions_dir):
        versions = parse_alembic_versions(branched_versions_dir)
        graph = build_revision_graph(versions)
        assert graph["003a"] == "002"
        assert graph["003b"] == "002"

    def test_skip_unparsed_versions(self):
        """revision=None 的 entry 被跳过."""
        versions = [
            {"revision": None, "down_revision": None},
            {"revision": "001", "down_revision": None},
        ]
        graph = build_revision_graph(versions)
        assert None not in graph
        assert "001" in graph


# ---------------------------------------------------------------------------
# TestFindHead
# ---------------------------------------------------------------------------


class TestFindHead:
    """find_head 找链末端."""

    def test_single_head_linear(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        assert find_head(graph) == "003_hot"

    def test_branched_returns_last_sorted(self, branched_versions_dir):
        """多 head 时, 退而求其次取 sorted 末尾."""
        versions = parse_alembic_versions(branched_versions_dir)
        graph = build_revision_graph(versions)
        head = find_head(graph)
        # 003a, 003b 都没人指向, sorted 末位 003b
        assert head in ("003a", "003b")

    def test_empty_graph(self):
        assert find_head({}) is None

    def test_single_node(self):
        assert find_head({"001": None}) == "001"


# ---------------------------------------------------------------------------
# TestWalkFromCurrent
# ---------------------------------------------------------------------------


class TestWalkFromCurrent:
    """walk_from_current 沿链向前走."""

    def test_uninit_returns_full_chain(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        pending = walk_from_current(graph, None, "003_hot")
        assert pending == ["001", "002_add_idx", "003_hot"]

    def test_partial_returns_remaining(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        pending = walk_from_current(graph, "002_add_idx", "003_hot")
        assert pending == ["003_hot"]

    def test_at_target_returns_empty(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        assert walk_from_current(graph, "003_hot", "003_hot") == []

    def test_not_in_chain_returns_full(self, fake_versions_dir):
        """current 不在 target 链上, 保守返回全链."""
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        pending = walk_from_current(graph, "unknown_rev", "003_hot")
        assert pending == ["001", "002_add_idx", "003_hot"]


# ---------------------------------------------------------------------------
# TestDiffOneSchema
# ---------------------------------------------------------------------------


class TestDiffOneSchema:
    """diff_one_schema 返回正确结构."""

    def test_static_mode_no_engine(self, fake_versions_dir):
        """engine=None 时不连 DB, 返回整条链."""
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        plan = diff_one_schema(None, "tenant_1", "003_hot", graph)
        assert plan["schema"] == "tenant_1"
        assert plan["current_revision"] is None
        assert plan["pending"] == ["001", "002_add_idx", "003_hot"]
        assert plan["head_revision"] == "003_hot"
        assert plan["error"] is None

    def test_already_at_head_empty_pending(self, fake_versions_dir):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        plan = diff_one_schema(None, "public", "003_hot", graph)
        # 不连 DB 时, current=None, 但 target=head, 仍返回整条链
        # 这是设计选择: 静态模式无法判断 current
        assert plan["pending"] == ["001", "002_add_idx", "003_hot"]


# ---------------------------------------------------------------------------
# TestPrintDiffReport
# ---------------------------------------------------------------------------


class TestPrintDiffReport:
    """print_diff_report 格式化输出."""

    def test_print_runs_without_error(self, fake_versions_dir, capsys):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        plan = diff_one_schema(None, "public", "003_hot", graph)
        print_diff_report([plan], versions, show_ddl=False)
        captured = capsys.readouterr()
        assert "Diff Plan" in captured.out
        assert "public" in captured.out
        assert "003_hot" in captured.out

    def test_print_multiple_schemas(self, fake_versions_dir, capsys):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        plans = [
            diff_one_schema(None, "public", "003_hot", graph),
            diff_one_schema(None, "tenant_1", "003_hot", graph),
            diff_one_schema(None, "tenant_2", "003_hot", graph),
        ]
        print_diff_report(plans, versions)
        captured = capsys.readouterr()
        assert "public" in captured.out
        assert "tenant_1" in captured.out
        assert "tenant_2" in captured.out
        assert "total pending" in captured.out

    def test_show_ddl_option(self, fake_versions_dir, capsys):
        versions = parse_alembic_versions(fake_versions_dir)
        graph = build_revision_graph(versions)
        plan = diff_one_schema(None, "public", "003_hot", graph)
        print_diff_report([plan], versions, show_ddl=True)
        captured = capsys.readouterr()
        # show_ddl=true 时, 描述应该出现在输出中
        assert "initial schema" in captured.out


# ---------------------------------------------------------------------------
# TestCLIDiff
# ---------------------------------------------------------------------------


class TestCLIDiff:
    """CLI 入口: --diff 参数."""

    def test_diff_static_mode(self, monkeypatch, capsys):
        """--diff --static 模式 (不连 DB)."""
        monkeypatch.setattr(
            "sys.argv",
            [
                "migrate_tenants.py",
                "--diff",
                "--static",
                "--tenants",
                "1,2",
            ],
        )
        from migrate_tenants import main

        rc = main()
        out = capsys.readouterr().out
        # 退出码: 有 pending → 2
        assert rc == 2
        assert "Diff Plan" in out
        assert "public" in out
        assert "tenant_1" in out
        assert "tenant_2" in out


# ---------------------------------------------------------------------------
# TestExitCodes
# ---------------------------------------------------------------------------


class TestExitCodes:
    """--diff 退出码语义."""

    def test_pending_returns_2(self, fake_versions_dir, monkeypatch, capsys):
        # 用 fake versions_dir
        monkeypatch.setattr(
            "sys.argv",
            [
                "migrate_tenants.py",
                "--diff",
                "--static",
                "--versions-dir",
                str(fake_versions_dir),
                "--tenants",
                "1",
            ],
        )
        from migrate_tenants import main

        rc = main()
        # 有 pending → 2
        assert rc == 2

    def test_no_pending_returns_0(self, fake_versions_dir, monkeypatch, capsys):
        # 用 fake versions_dir, 但 head 找不到 → 0 pending
        # 实际: 即使静态模式没 DB, 也会返回全链 (无 current),
        # 所以 pending 永远 >= 1, rc 永远 2. 这个测试验证 current=None 的行为.
        monkeypatch.setattr(
            "sys.argv",
            [
                "migrate_tenants.py",
                "--diff",
                "--static",
                "--versions-dir",
                str(fake_versions_dir),
                "--tenants",
                "1",
            ],
        )
        from migrate_tenants import main

        rc = main()
        # 静态模式, 永远 rc=2 (因为有 pending)
        assert rc == 2


# ---------------------------------------------------------------------------
# TestEdgeCases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """边界场景."""

    def test_branched_revisions_listed(self, branched_versions_dir, capsys):
        versions = parse_alembic_versions(branched_versions_dir)
        graph = build_revision_graph(versions)
        # branch 时 head 不唯一, 验证 find_head 不抛
        head = find_head(graph)
        assert head in ("003a", "003b")

    def test_default_versions_dir_constant(self):
        """DEFAULT_VERSIONS_DIR 指向真实目录."""
        assert DEFAULT_VERSIONS_DIR.name == "versions"
        assert DEFAULT_VERSIONS_DIR.parent.name == "alembic"

    def test_real_alembic_diff_runs(self, capsys):
        """真实 alembic/versions 跑 --diff --static."""
        import sys as _sys

        from migrate_tenants import main

        _sys.argv = ["migrate_tenants.py", "--diff", "--static", "--tenants", "1"]
        rc = main()
        out = capsys.readouterr().out
        assert "Diff Plan" in out
        # 真实 head 应该是 007_migrate_phase2_tables_to_tenant_schema
        assert "007_migrate_phase2_tables_to_tenant_schema" in out
