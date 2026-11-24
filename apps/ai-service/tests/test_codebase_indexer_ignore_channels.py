# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ignore 层的**两通道同尺**与**分母诚实性**钉(P84 的第二枚用例档)。

`test_codebase_indexer_ignore.py` 钉的是"跟踪态 ∧ 规则来源"的取舍口径(①②③)。
本档钉的是那三条**赖以成立**的两块地基,缺一条就是纸面接线:

④ **两通道同尺**:rg 腿与 Python 遍历腿对同一棵夹具树,过完 ignore 之后必须给出
   逐字节相同的文件集**与逐字节相同的剪枝回执**。剪枝住在枚举之后
   (`apply_index_ignore_rules`),所以这一格在结构上只可能成立一次;本用例防的是
   "有人把规则塞进 rg 参数",那会把它退化成两套答案(真仓实测 12,919 vs 244,746)。
⑤ **规则文件读不动 ⇒ 出声且不静默全量**:真按全量走是"多留一份"的安全方向,但回执
   必须自己说清"这一轮是未判定",否则与"这棵树本来没有规则"在响应上同形(§0.3)。
⑥ **护栏分母三数可读**:量到 N / 剪掉 M / 索引进 K 必须来自**同一条枚举**,且 N−M==K;
   触顶时 N 是**下界**并由通道自报(`EnumerationProvenance.saturated`),点名清单被截到
   12 枚时也必须出声(总数另有真值字段,清单只是样本)。

判据一律从生产出口取(`rgp.*` / `ci.*`),测试里不复制第二份 gitignore 解析(§22c)。
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci
from app.services import rg_fallback_parity as rgp
from app.services.codebase_indexer import _EXT_TO_LANG, _IGNORED_DIRS, CodebaseIndexer
from app.services.process_tree import CREATE_NO_WINDOW

#: 本机无 rg ⇒ 双通道对账缺一个输入,如实跳过(不得用单边绿冒充双边一致)。
_RG_SKIP = pytest.mark.skipif(
    rgp.resolve_rg_binary().path == "",
    reason="本机无 ripgrep:两通道同尺缺 rg 一侧输入(生产面已用 degraded_reason 标明)",
)


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")


def _git(root: Path, *args: str) -> None:
    env = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_TERMINAL_PROMPT": "0"}
    subprocess.run(
        ["git", "-C", str(root), "-c", "user.name=t", "-c", "user.email=t@t", *args],
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
        creationflags=CREATE_NO_WINDOW,
        env=env,
    )


def _write(root: Path, rel: str, body: str) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


def _mixed_repo(root: Path) -> Path:
    """一棵同时喂出"未跟踪被忽略 / 已跟踪被忽略 / 索引专属规则命中 / 照常"四态的夹具树。"""
    _write(root, ".gitignore", "ignored/\nlegacy/\n")
    _write(root, ".aiignore", "secret.py\n")
    _write(root, "ignored/generated.js", "export const built = 1;\n")
    _write(root, "legacy/kept.js", "module.exports = 1;\n")
    _write(root, "secret.py", "TOKEN = 'x'\n")
    _write(root, "src/main.ts", "export const main = 1;\n")
    _write(root, "src/util.ts", "export const util = 2;\n")
    _git(root, "init", "-q")
    _git(root, "add", ".gitignore", ".aiignore", "secret.py", "src/main.ts", "src/util.ts")
    _git(root, "add", "-f", "legacy/kept.js")  # 故意纳进跟踪面:守门 236 那一型
    _git(root, "commit", "-qm", "c1")
    # ignored/ 刻意不 add ⇒ 未跟踪 ∧ 被 .gitignore 命中 ⇒ 该剪
    return root


@_RG_SKIP
def test_two_channels_give_the_same_indexed_set_after_ignore_rules(tmp_path):
    """④:过完 ignore,rg 腿与遍历腿的文件集与剪枝回执逐字节相同。"""
    root = _mixed_repo(tmp_path / "repo")

    rg_raw, _rg_prov = rgp.enumerate_with_rg(
        root, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    py_raw, _py_prov = rgp.enumerate_with_walk(
        root, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG)
    )
    rg_kept, rg_report = ci.apply_index_ignore_rules(sorted(rg_raw), root)
    py_kept, py_report = ci.apply_index_ignore_rules(sorted(py_raw), root)

    assert rg_kept == py_kept, f"两通道在 ignore 判定上分叉:rg={rg_kept} py={py_kept}"
    assert rg_report.files_ignored == py_report.files_ignored
    assert rg_report.ignored_by == py_report.ignored_by, "剪枝出处必须同形,否则是第二把尺"
    assert rg_report.tracked_kept_paths == py_report.tracked_kept_paths
    assert rg_report.errors == py_report.errors

    # 阳性对照:两边一致地漏掉同一批也是绿的,所以还要点名"分得开"的那三态。
    assert "legacy/kept.js" in rg_kept, "已跟踪却被 .gitignore 覆盖的必须留在索引面(本票存在的全部理由)"
    assert "ignored/generated.js" not in rg_kept, "未跟踪的构建产物该剪"
    assert "secret.py" not in rg_kept, ".aiignore 命中即剪(不看跟踪态)"
    assert rg_report.files_ignored == 2 and rg_report.tracked_kept == 1

    # 既有契约不破:枚举面(剪枝之前)两通道仍然一致。
    diff = rgp.compare_enumerations(root, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG))
    assert diff.consistent, f"枚举面对账翻红:{diff.summary}"


def test_prune_receipt_and_index_share_one_pipeline_seen_pruned_indexed(tmp_path):
    """⑥(未触顶档):N−M==K,且 N / M / K 三个数来自同一条枚举。"""
    root = _mixed_repo(tmp_path / "repo")
    seen, _prov = rgp.enumerate_code_files(
        root, ignored_dirs=_IGNORED_DIRS, suffixes=tuple(_EXT_TO_LANG), max_files=None
    )
    kept, report = ci.apply_index_ignore_rules(seen, root)
    files, prov, c_report = CodebaseIndexer.__new__(
        CodebaseIndexer
    ).collect_code_files_with_provenance(root)

    assert len(kept) == len(seen) - report.files_ignored, "剪掉多少必须能从同一个分母里对上"
    assert len(files) == prov.counted - c_report.files_ignored
    assert prov.saturated is False, "小夹具不该报触顶"
    assert c_report.ignored_by == report.ignored_by


@_RG_SKIP
def test_saturated_enumeration_is_lower_bound_and_says_so(tmp_path):
    """⑥(触顶档):数到上限就收手时 N 是下界,且回执自己把 N/M/K 说清。"""
    root = tmp_path / "repo"
    root.mkdir()
    for i in range(6):
        _write(root, f"src/f{i}.py", f"def f{i}():\n    return {i}\n")
    _git(root, "init", "-q")
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "c1")

    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    with patch.object(ci, "MAX_FILES_PER_INDEX", 2):
        files, prov, report = idx.collect_code_files_with_provenance(root)

    assert prov.saturated is True, "枚举触顶而通道不自报 ⇒ 下界会被读成精确规模"
    assert prov.counted == 2
    assert len(files) == prov.counted - report.files_ignored
    notes = " | ".join(report.errors)
    assert "枚举触顶" in notes, f"触顶未出声:索引面是静默子集却无人点名:{notes}"
    assert "量到 2 条" in notes, notes
    assert "索引进 2 条" in notes, notes


def test_unreadable_rule_file_is_named_and_declares_unjudged(tmp_path):
    """⑤:规则文件读不动 ⇒ 出声,且不静默全量(全量是多留一份,但必须自称未判定)。"""
    root = tmp_path / "repo"
    (root / ".gitignore").mkdir(parents=True)  # 目录冒充规则文件:真读不动的一型
    _write(root, "src/main.ts", "export const main = 1;\n")
    _write(root, "src/util.ts", "export const util = 2;\n")

    _files, _prov, report = CodebaseIndexer.__new__(
        CodebaseIndexer
    ).collect_code_files_with_provenance(root)
    notes = " | ".join(report.errors)
    assert report.errors, "规则面读不动却零回执 ⇒ 与「本来就没有规则」同形(§0.3)"
    assert "未判定" in notes, f"必须自称未判定:{notes}"
    assert "全量" in notes, f"必须说清文件面按全量处理:{notes}"
    assert report.files_ignored == 0, "未判定的失效方向只能是多留一份,不许静默剪"


def test_tracked_kept_naming_over_cap_is_declared_not_silent(tmp_path):
    """⑥:点名清单是样本(截到 12 枚)⇒ 超出必须出声,总数另有真值字段。"""
    root = tmp_path / "repo"
    root.mkdir()
    _write(root, ".gitignore", "vendor/\n")
    for i in range(14):
        _write(root, f"vendor/v{i}.js", f"export const v{i} = {i};\n")
    _git(root, "init", "-q")
    _git(root, "add", ".gitignore")
    _git(root, "add", "-f", "vendor")
    _git(root, "commit", "-qm", "c1")

    _kept, report = ci.apply_index_ignore_rules(
        sorted(f"vendor/v{i}.js" for i in range(14)), root
    )
    assert report.tracked_kept == 14
    assert len(report.tracked_kept_paths) == 12, "清单要截断,但截断必须出声"
    assert any("点名按 12 枚截断" in n for n in report.errors), report.errors
    assert report.tracked_kept_paths == sorted(report.tracked_kept_paths), (
        "清单要确定序,否则轮次之间无谓抖动"
    )


@pytest.mark.asyncio
async def test_ignore_receipt_reaches_the_client_visible_result(tmp_path):
    """回执到端:`ignore_notes` 是 mcp 响应逐字段投影的一格,未判定必须在那儿看得见。"""
    root = tmp_path / "repo"
    (root / ".gitignore").mkdir(parents=True)
    _write(root, "src/main.ts", "export const main = 1;\n")
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    with (
        patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
        patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)),
    ):
        result = await idx.index_repository(str(root), "repo-ignore")

    assert result.files_scanned == 1
    assert any("未判定" in n for n in result.ignore_notes), result.ignore_notes
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
