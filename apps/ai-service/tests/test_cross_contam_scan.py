"""cross_contam_scan.py 单元测试 — 跨项目污染扫描器。

测试覆盖:
- scan_dir:目录不存在返回空 / 子目录跳过 / 禁止后缀命中 / 允许后缀不报
- main:干净环境 exit 0 / 口播稿污染 exit 1 / 公众号污染 exit 1 / 混合污染 exit 1
- 模块常量:WECHAT_OK_EXT / KOUBO_OK_EXT
- 隔离:用 tmp_path + monkeypatch 替换 KOUBO_OUT / WECHAT_OUT,不扫真实项目目录
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# 把 skills/koubo_workflow 目录加入 sys.path,以便 import cross_contam_scan
_SCAN_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "app", "skills", "koubo_workflow",
)
if _SCAN_DIR not in sys.path:
    sys.path.insert(0, _SCAN_DIR)

import cross_contam_scan  # noqa: E402


# =============================================================================
# 辅助:每个测试用 tmp_path 模拟 koubo/Output 和 wechat/output
# =============================================================================


@pytest.fixture
def patched_paths(monkeypatch, tmp_path):
    """用 tmp_path 替换 cross_contam_scan.KOUBO_OUT / WECHAT_OUT。"""
    koubo_out = tmp_path / "koubo" / "Output"
    wechat_out = tmp_path / "wechat" / "output"
    koubo_out.mkdir(parents=True)
    wechat_out.mkdir(parents=True)
    monkeypatch.setattr(cross_contam_scan, "KOUBO_OUT", str(koubo_out))
    monkeypatch.setattr(cross_contam_scan, "WECHAT_OUT", str(wechat_out))
    return koubo_out, wechat_out


# =============================================================================
# 模块常量
# =============================================================================


def test_wechat_ok_ext_contains_expected():
    """WECHAT_OK_EXT 应包含 .html/.docx/.json/图片格式。"""
    assert ".html" in cross_contam_scan.WECHAT_OK_EXT
    assert ".docx" in cross_contam_scan.WECHAT_OK_EXT
    assert ".json" in cross_contam_scan.WECHAT_OK_EXT
    assert ".png" in cross_contam_scan.WECHAT_OK_EXT
    assert ".jpg" in cross_contam_scan.WECHAT_OK_EXT


def test_koubo_ok_ext_only_txt():
    """KOUBO_OK_EXT 应只含 .txt。"""
    assert cross_contam_scan.KOUBO_OK_EXT == {".txt"}


# =============================================================================
# scan_dir
# =============================================================================


def test_scan_dir_returns_empty_when_dir_missing(tmp_path):
    """目录不存在 → 返回空列表(不抛异常)。"""
    missing = tmp_path / "nonexistent"
    result = cross_contam_scan.scan_dir(str(missing), {".html"}, "label")
    assert result == []


def test_scan_dir_skips_subdirectories(tmp_path):
    """子目录被跳过(只扫文件)。"""
    (tmp_path / "subdir").mkdir()
    (tmp_path / "subdir" / "evil.html").write_text("x", encoding="utf-8")
    result = cross_contam_scan.scan_dir(str(tmp_path), {".html"}, "label")
    assert result == []  # 子目录里的 .html 不算


def test_scan_dir_detects_forbidden_extension(tmp_path):
    """命中禁止后缀 → 加入 problems。"""
    (tmp_path / "bad.html").write_text("<html></html>", encoding="utf-8")
    (tmp_path / "bad.docx").write_text("doc", encoding="utf-8")
    result = cross_contam_scan.scan_dir(str(tmp_path), {".html", ".docx"}, "口播稿污染")
    assert len(result) == 2
    assert all("口播稿污染" in p for p in result)
    assert any("bad.html" in p for p in result)
    assert any("bad.docx" in p for p in result)


def test_scan_dir_allows_permitted_extension(tmp_path):
    """允许后缀 → 不报。"""
    (tmp_path / "ok.txt").write_text("hello", encoding="utf-8")
    result = cross_contam_scan.scan_dir(str(tmp_path), {".html", ".docx"}, "label")
    assert result == []


def test_scan_dir_extension_case_insensitive(tmp_path):
    """后缀大小写不敏感(.HTML 与 .html 同等处理)。"""
    (tmp_path / "evil.HTML").write_text("x", encoding="utf-8")
    result = cross_contam_scan.scan_dir(str(tmp_path), {".html"}, "label")
    assert len(result) == 1
    assert "evil.HTML" in result[0]


def test_scan_dir_label_appears_in_problem_message(tmp_path):
    """label 字符串出现在 problem 消息中。"""
    (tmp_path / "x.html").write_text("x", encoding="utf-8")
    result = cross_contam_scan.scan_dir(str(tmp_path), {".html"}, "CUSTOM_LABEL")
    assert "CUSTOM_LABEL" in result[0]


def test_scan_dir_empty_dir_returns_empty(tmp_path):
    """空目录 → 返回空列表。"""
    assert cross_contam_scan.scan_dir(str(tmp_path), {".html"}, "label") == []


def test_scan_dir_multiple_files_sorted(tmp_path):
    """多文件场景:扫描结果覆盖所有命中文件。"""
    for name in ["a.html", "b.html", "c.html", "ok.txt"]:
        (tmp_path / name).write_text("x", encoding="utf-8")
    result = cross_contam_scan.scan_dir(str(tmp_path), {".html"}, "label")
    assert len(result) == 3
    # 应包含 a/b/c 但不含 ok.txt
    filenames = " ".join(result)
    assert "a.html" in filenames
    assert "b.html" in filenames
    assert "c.html" in filenames
    assert "ok.txt" not in filenames


# =============================================================================
# main:干净环境 → exit 0
# =============================================================================


def test_main_clean_environment_exits_0(patched_paths, capsys):
    """两个目录都无越界产物 → exit 0。"""
    koubo_out, wechat_out = patched_paths
    # koubo/Output 只放 .txt,wechat/output 只放 .html
    (koubo_out / "0714.txt").write_text("koubo script", encoding="utf-8")
    (wechat_out / "article.html").write_text("<html></html>", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 0
    captured = capsys.readouterr()
    assert "通过" in captured.out


def test_main_empty_directories_exits_0(patched_paths, capsys):
    """两个目录都为空 → exit 0。"""
    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 0


# =============================================================================
# main:口播稿污染(出现 .html/.docx/.md)
# =============================================================================


def test_main_koubo_html_pollution_exits_1(patched_paths, capsys):
    """koubo/Output 出现 .html → exit 1。"""
    koubo_out, _ = patched_paths
    (koubo_out / "0714.txt").write_text("ok", encoding="utf-8")
    (koubo_out / "bad.html").write_text("<html></html>", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "口播稿污染" in captured.out
    assert "bad.html" in captured.out


def test_main_koubo_docx_pollution_exits_1(patched_paths, capsys):
    """koubo/Output 出现 .docx → exit 1。"""
    koubo_out, _ = patched_paths
    (koubo_out / "bad.docx").write_text("doc", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 1
    assert "口播稿污染" in capsys.readouterr().out


def test_main_koubo_md_pollution_exits_1(patched_paths, capsys):
    """koubo/Output 出现 .md → exit 1(公众号源不应在口播稿目录)。"""
    koubo_out, _ = patched_paths
    (koubo_out / "article.md").write_text("# title", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 1
    assert "口播稿污染" in capsys.readouterr().out


# =============================================================================
# main:公众号污染(出现 .txt)
# =============================================================================


def test_main_wechat_txt_pollution_exits_1(patched_paths, capsys):
    """wechat/output 出现 .txt → exit 1。"""
    _, wechat_out = patched_paths
    (wechat_out / "article.html").write_text("ok", encoding="utf-8")
    (wechat_out / "leaked.txt").write_text("koubo leak", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "公众号污染" in captured.out
    assert "leaked.txt" in captured.out


def test_main_wechat_allowed_extensions_no_pollution(patched_paths):
    """wechat/output 出现允许的格式(.html/.docx/.png/.json) → exit 0。"""
    _, wechat_out = patched_paths
    (wechat_out / "a.html").write_text("x", encoding="utf-8")
    (wechat_out / "b.docx").write_text("x", encoding="utf-8")
    (wechat_out / "c.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (wechat_out / "d.json").write_text("{}", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 0


# =============================================================================
# main:混合污染
# =============================================================================


def test_main_mixed_pollution_exits_1(patched_paths, capsys):
    """两个目录都有越界产物 → exit 1 + 报告两类污染。"""
    koubo_out, wechat_out = patched_paths
    (koubo_out / "bad.html").write_text("x", encoding="utf-8")
    (wechat_out / "leaked.txt").write_text("x", encoding="utf-8")

    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 1
    captured = capsys.readouterr()
    assert "口播稿污染" in captured.out
    assert "公众号污染" in captured.out


# =============================================================================
# main:目录缺失场景
# =============================================================================


def test_main_koubo_dir_missing_exits_0(patched_paths, monkeypatch, tmp_path):
    """koubo/Output 目录不存在 → 该分支返回空,若 wechat 也干净 → exit 0。"""
    monkeypatch.setattr(cross_contam_scan, "KOUBO_OUT", str(tmp_path / "missing"))
    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 0


def test_main_wechat_dir_missing_exits_0(patched_paths, monkeypatch, tmp_path):
    """wechat/output 目录不存在 → 该分支返回空,若 koubo 也干净 → exit 0。"""
    monkeypatch.setattr(cross_contam_scan, "WECHAT_OUT", str(tmp_path / "missing"))
    (patched_paths[0] / "0714.txt").write_text("ok", encoding="utf-8")
    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 0


# =============================================================================
# main:输出格式
# =============================================================================


def test_main_pollution_output_includes_separator_bar(patched_paths, capsys):
    """污染时输出包含分隔条 + '需人工处置' 提示。"""
    koubo_out, _ = patched_paths
    (koubo_out / "bad.html").write_text("x", encoding="utf-8")

    with pytest.raises(SystemExit):
        cross_contam_scan.main()
    captured = capsys.readouterr()
    assert "=" * 60 in captured.out  # 分隔条
    assert "需人工处置" in captured.out


def test_main_clean_output_message(patched_paths, capsys):
    """干净时输出包含 '通过' 关键字。"""
    with pytest.raises(SystemExit) as exc_info:
        cross_contam_scan.main()
    assert exc_info.value.code == 0
    assert "通过" in capsys.readouterr().out
