"""archive_daily.py 单元测试 — 口播稿每日自动存档 v2.0。

测试覆盖:
- today_mmdd():返回当前 MMDD 格式
- 默认模式:只移非当日稿,当日稿留 Output
- --finalize:连当日稿一起归档
- --check:当日稿已归档 → exit 0;未归档 → exit 1
- --dry:只预览,不移动文件
- 幂等:汇编中已有该日期段 → 跳过 + 清理 Output 残留
- 日志写入:archive_log.txt
- Output 目录不存在 → exit 2
- DATE_RE 过滤:非 MMDD.txt 文件被忽略
- 段头去重:正文首行 "# MMDD" 被剥离,避免双倍段头
- 隔离:用 tmp_path 替换 OUTPUT/HISTORY/ANTHOLOGY,mock project_boundary
"""
from __future__ import annotations

import os
import re
import sys
from datetime import datetime
from unittest.mock import MagicMock

import pytest

# =============================================================================
# 关键:在 import archive_daily 之前 mock project_boundary 模块
# archive_daily.py 在模块顶层执行:
#   import project_boundary
#   project_boundary.check_action(tool="archive_daily.py", ...)
# 真实 check_action 在未声明会话时会 sys.exit(3),所以必须先 mock。
# =============================================================================

_KOUBO_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "app", "skills", "koubo_workflow",
)
_TOOLS_DIR = os.path.join(_KOUBO_DIR, "tools")
if _TOOLS_DIR not in sys.path:
    sys.path.insert(0, _TOOLS_DIR)
if _KOUBO_DIR not in sys.path:
    sys.path.insert(0, _KOUBO_DIR)

# 注入 mock project_boundary 到 sys.modules(在 import archive_daily 前)
if "project_boundary" not in sys.modules or not hasattr(
    sys.modules.get("project_boundary", None), "check_action"
):
    sys.modules["project_boundary"] = MagicMock()

import archive_daily  # noqa: E402


# =============================================================================
# 辅助:每个测试用 tmp_path 替换全局路径
# =============================================================================


@pytest.fixture
def patched_paths(monkeypatch, tmp_path):
    """用 tmp_path 替换 archive_daily.OUTPUT / HISTORY / ANTHOLOGY。"""
    output_dir = tmp_path / "Output"
    history_dir = tmp_path / "历史稿"
    output_dir.mkdir()
    history_dir.mkdir()
    anthology = history_dir / "历史口播稿汇编.txt"

    monkeypatch.setattr(archive_daily, "OUTPUT", str(output_dir))
    monkeypatch.setattr(archive_daily, "HISTORY", str(history_dir))
    monkeypatch.setattr(archive_daily, "ANTHOLOGY", str(anthology))
    return output_dir, history_dir, anthology


@pytest.fixture
def patch_today(monkeypatch):
    """固定 today_mmdd 返回 '0723',避免测试受真实日期影响。"""
    monkeypatch.setattr(archive_daily, "today_mmdd", lambda: "0723")
    return "0723"


def _write_koubo_file(output_dir, mmdd: str, content: str = "正文"):
    """在 Output/ 下写一个 MMDD.txt 文件。"""
    fp = output_dir / f"{mmdd}.txt"
    fp.write_text(content, encoding="utf-8")
    return fp


# =============================================================================
# today_mmdd
# =============================================================================


def test_today_mmdd_format():
    """today_mmdd 返回 4 位数字字符串(MMDD)。"""
    result = archive_daily.today_mmdd()
    assert isinstance(result, str)
    assert len(result) == 4
    assert result.isdigit()
    # 应等于 datetime.now() 的 %m%d
    assert result == datetime.now().strftime("%m%d")


# =============================================================================
# 正则常量
# =============================================================================


def test_date_re_matches_valid_filenames():
    r"""DATE_RE 匹配 ^\d{4}\.txt$ 模式。"""
    assert archive_daily.DATE_RE.match("0714.txt")
    assert archive_daily.DATE_RE.match("1231.txt")
    assert archive_daily.DATE_RE.match("0101.txt")


def test_date_re_rejects_invalid_filenames():
    """DATE_RE 不匹配非 MMDD.txt 文件。"""
    assert not archive_daily.DATE_RE.match("714.txt")      # 3 位
    assert not archive_daily.DATE_RE.match("0714.txt.bak")  # 多后缀
    assert not archive_daily.DATE_RE.match("0714.md")       # 非 .txt
    assert not archive_daily.DATE_RE.match("abc.txt")       # 非数字
    assert not archive_daily.DATE_RE.match("0714_readme.txt")  # 多下划线


def test_seg_re_matches_segment_header():
    """SEG_RE 匹配 '# MMDD' 段头。"""
    text = "# 0714\nsome content\n# 0715\nmore"
    matches = archive_daily.SEG_RE.findall(text)
    assert "0714" in matches
    assert "0715" in matches


# =============================================================================
# 默认模式:只移非当日稿,当日稿留 Output
# =============================================================================


def test_default_mode_keeps_today_file(patched_paths, patch_today, monkeypatch):
    """默认模式:当日稿(0723.txt)留 Output,不归档(main 不 exit)。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0723", "今日稿")
    # 模拟 sys.argv 无参数(默认模式)
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    # 默认模式不显式 sys.exit,直接返回 None
    archive_daily.main()
    # 当日稿应仍存在
    assert (output_dir / "0723.txt").exists()
    # 汇编文件不存在(未归档任何稿)
    assert not anthology.exists()


def test_default_mode_archives_non_today_file(patched_paths, patch_today, monkeypatch):
    """默认模式:非当日稿(0701.txt)被归档到汇编,Output 副本删除。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0701", "历史稿内容")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    archive_daily.main()  # 默认模式不 exit
    # 0701.txt 应被移除
    assert not (output_dir / "0701.txt").exists()
    # 汇编应含 # 0701 段
    content = anthology.read_text(encoding="utf-8")
    assert "# 0701" in content
    assert "历史稿内容" in content


def test_default_mode_skips_non_mmdd_files(patched_paths, patch_today, monkeypatch):
    """默认模式:非 MMDD.txt 命名文件被忽略(不归档也不删除)。"""
    output_dir, history_dir, anthology = patched_paths
    (output_dir / "readme.txt").write_text("not MMDD", encoding="utf-8")
    (output_dir / "0714.txt").write_text("valid", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    archive_daily.main()
    # readme.txt 应仍存在(被 DATE_RE 过滤)
    assert (output_dir / "readme.txt").exists()
    # 0714.txt 应被归档
    assert not (output_dir / "0714.txt").exists()


# =============================================================================
# --finalize:连当日稿一起归档
# =============================================================================


def test_finalize_mode_archives_today_file(patched_paths, patch_today, monkeypatch):
    """--finalize:当日稿(0723.txt)也归档到汇编。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0723", "今日稿内容")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--finalize"])

    archive_daily.main()
    assert not (output_dir / "0723.txt").exists()
    content = anthology.read_text(encoding="utf-8")
    assert "# 0723" in content
    assert "今日稿内容" in content


def test_finalize_idempotent_skips_existing_segment(patched_paths, patch_today, monkeypatch):
    """--finalize 幂等:汇编已有 # MMDD 段 → 跳过 + 清理 Output 残留。"""
    output_dir, history_dir, anthology = patched_paths
    # 预先写入汇编(已含 # 0723 段)
    anthology.write_text("# 0723\n\n已有内容\n", encoding="utf-8")
    # Output 残留 0723.txt
    _write_koubo_file(output_dir, "0723", "重复内容")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--finalize"])

    archive_daily.main()
    # Output 副本应被清理(已入汇编)
    assert not (output_dir / "0723.txt").exists()
    # 汇编内容不变(无重复段)
    content = anthology.read_text(encoding="utf-8")
    assert content.count("# 0723") == 1
    assert "重复内容" not in content  # 未追加


# =============================================================================
# --check:校验当日稿是否已归档
# =============================================================================


def test_check_mode_exits_0_when_archived(patched_paths, patch_today, monkeypatch):
    """--check:当日稿已归档(汇编含 # 0723 段) → exit 0。"""
    output_dir, history_dir, anthology = patched_paths
    anthology.write_text("# 0723\n\n已归档\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--check"])

    with pytest.raises(SystemExit) as exc_info:
        archive_daily.main()
    assert exc_info.value.code == 0


def test_check_mode_exits_1_when_not_archived(patched_paths, patch_today, monkeypatch):
    """--check:当日稿未归档(汇编无 # 0723 段) → exit 1。"""
    output_dir, history_dir, anthology = patched_paths
    # 汇编为空(或不存在该段)
    anthology.write_text("# 0701\n\n旧内容\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--check"])

    with pytest.raises(SystemExit) as exc_info:
        archive_daily.main()
    assert exc_info.value.code == 1


def test_check_mode_exits_1_when_anthology_missing(patched_paths, patch_today, monkeypatch):
    """--check:汇编文件不存在 → exit 1。"""
    output_dir, history_dir, anthology = patched_paths
    # 不创建 anthology 文件
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--check"])

    with pytest.raises(SystemExit) as exc_info:
        archive_daily.main()
    assert exc_info.value.code == 1


def test_check_mode_does_not_move_files(patched_paths, patch_today, monkeypatch):
    """--check:不移动任何文件,仅校验。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0723", "今日稿")
    anthology.write_text("# 0723\n\n已归档\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--check"])

    with pytest.raises(SystemExit):
        archive_daily.main()
    # Output 中 0723.txt 应仍存在(未被移动)
    assert (output_dir / "0723.txt").exists()


# =============================================================================
# --dry:只预览,不移动文件
# =============================================================================


def test_dry_mode_does_not_move_files(patched_paths, patch_today, monkeypatch):
    """--dry:不移动文件,不写汇编,仅预览。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0701", "历史稿")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--dry"])

    archive_daily.main()
    # 0701.txt 应仍存在
    assert (output_dir / "0701.txt").exists()
    # 汇编不应被创建
    assert not anthology.exists()


def test_dry_mode_with_finalize_preview(patched_paths, patch_today, monkeypatch):
    """--dry --finalize:预览含当日稿,但不实际归档。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0723", "今日稿")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--dry", "--finalize"])

    archive_daily.main()
    assert (output_dir / "0723.txt").exists()
    assert not anthology.exists()


# =============================================================================
# Output 目录不存在 → exit 2
# =============================================================================


def test_main_exits_2_when_output_missing(patched_paths, patch_today, monkeypatch, tmp_path):
    """Output/ 目录不存在 → exit 2(汇编文件操作前的预检)。"""
    output_dir, history_dir, anthology = patched_paths
    # 删除 Output 目录
    import shutil
    shutil.rmtree(str(output_dir))
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    with pytest.raises(SystemExit) as exc_info:
        archive_daily.main()
    assert exc_info.value.code == 2


# =============================================================================
# 段头去重:正文首行 "# MMDD" 被剥离
# =============================================================================


def test_finalize_strips_leading_segment_header(patched_paths, patch_today, monkeypatch):
    """--finalize:正文首行自带 '# MMDD' 段头时,入库前剥掉,避免双倍段头。"""
    output_dir, history_dir, anthology = patched_paths
    # 正文首行就是段头
    _write_koubo_file(output_dir, "0723", "# 0723\n这是正文\n第二行")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--finalize"])

    archive_daily.main()
    content = anthology.read_text(encoding="utf-8")
    # 应只出现一次 '# 0723'(归档时自动加的)
    assert content.count("# 0723") == 1
    # 正文保留
    assert "这是正文" in content
    assert "第二行" in content


def test_finalize_keeps_different_leading_header(patched_paths, patch_today, monkeypatch):
    """--finalize:正文首行段头日期 ≠ 文件日期 → 不剥离(只剥同号段头)。"""
    output_dir, history_dir, anthology = patched_paths
    # 文件名 0723,但首行段头是 0701
    _write_koubo_file(output_dir, "0723", "# 0701\n这是正文")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--finalize"])

    archive_daily.main()
    content = anthology.read_text(encoding="utf-8")
    # 归档加 # 0723 + 保留原 # 0701
    assert "# 0723" in content
    assert "# 0701" in content


# =============================================================================
# 日志写入
# =============================================================================


def test_finalize_writes_log_entry(patched_paths, patch_today, monkeypatch):
    """--finalize:写入 archive_log.txt,含 [finalize] 标记。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0723", "今日稿")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--finalize"])

    archive_daily.main()
    log_path = history_dir / "archive_log.txt"
    assert log_path.exists()
    log_content = log_path.read_text(encoding="utf-8")
    assert "[finalize]" in log_content
    assert "存入汇编 1 篇" in log_content


def test_default_mode_writes_log_entry(patched_paths, patch_today, monkeypatch):
    """默认模式:写入 archive_log.txt(无 [finalize] 标记)。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0701", "旧稿")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    archive_daily.main()
    log_path = history_dir / "archive_log.txt"
    assert log_path.exists()
    log_content = log_path.read_text(encoding="utf-8")
    assert "[finalize]" not in log_content
    assert "存入汇编 1 篇" in log_content


# =============================================================================
# 多文件场景
# =============================================================================


def test_finalize_multiple_files_all_archived(patched_paths, patch_today, monkeypatch):
    """--finalize:多个 MMDD.txt 全部归档,汇编含多个段头。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0720", "稿 0720")
    _write_koubo_file(output_dir, "0721", "稿 0721")
    _write_koubo_file(output_dir, "0723", "稿 0723")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py", "--finalize"])

    archive_daily.main()
    content = anthology.read_text(encoding="utf-8")
    assert "# 0720" in content
    assert "# 0721" in content
    assert "# 0723" in content
    # Output 应全空(MMDD.txt 全归档)
    remaining = [f for f in os.listdir(str(output_dir)) if archive_daily.DATE_RE.match(f)]
    assert remaining == []


def test_mixed_today_and_non_today_default_mode(patched_paths, patch_today, monkeypatch):
    """默认模式:当日稿留,非当日稿移,混合场景正确分流。"""
    output_dir, history_dir, anthology = patched_paths
    _write_koubo_file(output_dir, "0723", "今日稿")  # 留
    _write_koubo_file(output_dir, "0701", "旧稿")    # 移
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    archive_daily.main()
    assert (output_dir / "0723.txt").exists()
    assert not (output_dir / "0701.txt").exists()
    content = anthology.read_text(encoding="utf-8")
    assert "# 0701" in content
    assert "# 0723" not in content  # 今日稿未归档


# =============================================================================
# 幂等性:已入汇编的非当日稿被清理
# =============================================================================


def test_default_mode_cleans_output_residue_for_archived(patched_paths, patch_today, monkeypatch):
    """默认模式:Output 残留已入汇编的非当日稿 → 清理(Output 副本删除,不重复追加)。"""
    output_dir, history_dir, anthology = patched_paths
    # 汇编已有 # 0701 段
    anthology.write_text("# 0701\n\n已有内容\n", encoding="utf-8")
    # Output 残留 0701.txt
    _write_koubo_file(output_dir, "0701", "重复内容")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    archive_daily.main()
    # 0701.txt 应被清理
    assert not (output_dir / "0701.txt").exists()
    # 汇编内容不变(无重复段)
    content = anthology.read_text(encoding="utf-8")
    assert content.count("# 0701") == 1
    assert "重复内容" not in content


# =============================================================================
# HISTORY 目录自动创建
# =============================================================================


def test_main_creates_history_dir_if_missing(patched_paths, patch_today, monkeypatch, tmp_path):
    """HISTORY 目录不存在时自动创建(os.makedirs(exist_ok=True))。"""
    output_dir, history_dir, anthology = patched_paths
    # 删除 HISTORY 目录
    import shutil
    shutil.rmtree(str(history_dir))
    _write_koubo_file(output_dir, "0701", "稿")
    monkeypatch.setattr(sys, "argv", ["archive_daily.py"])

    archive_daily.main()
    # HISTORY 目录应被重建
    assert history_dir.exists()
    # 汇编文件应被创建
    assert anthology.exists()
