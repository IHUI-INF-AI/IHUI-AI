# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""索引面的 ignore 剪枝接线钉(P84,`codebase_indexer` 枚举之后那一层)。

三条钉死的行为:
1. 被 `.gitignore` 忽略 ∧ **未跟踪** ⇒ 不进索引;
2. 被 `.gitignore` 忽略 ∧ **已跟踪** ⇒ **照进索引**,并逐条点名(不许静默剔出检索面);
3. `.aiignore`(索引专属规则)命中 ⇒ 无论跟踪与否都剪(那是"别进索引"的明确表达);
另外两枚兜底:未忽略的照常进;跟踪面取不到(未判定)⇒ 一条都不剪并点名。

口径的来由写在 `app/services/codebase_indexer.apply_index_ignore_rules` 的 docstring 里。
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci
from app.services.codebase_indexer import CodebaseIndexer
from app.services.process_tree import CREATE_NO_WINDOW


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")


def _git(root: Path, *args: str) -> None:
    env = {
        **os.environ,
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_TERMINAL_PROMPT": "0",
    }
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


async def _index(root: Path) -> ci.IndexResult:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    with (
        patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
        patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)),
    ):
        return await idx.index_repository(str(root), "repo-1")


def _collected(root: Path) -> set[str]:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    files, _prov, _report = idx.collect_code_files_with_provenance(root)
    return {p.relative_to(root).as_posix() for p, _lang in files}


@pytest.mark.asyncio
async def test_ignored_untracked_file_never_enters_the_index(tmp_path):
    root = tmp_path / "repo"
    (root).mkdir()
    _write(root, ".gitignore", "generated/\n")
    _write(root, "generated/app.js", "export const built = 1;\n")
    _write(root, "src/main.ts", "export const main = 1;\n")

    result = await _index(root)

    assert "generated/app.js" not in _collected(root), "未跟踪且被忽略 ⇒ 不许进索引"
    assert result.files_scanned == 1
    assert result.files_ignored == 1
    assert result.ignored_by == [".gitignore:1"], "剪枝必须答得出是哪枚规则文件的哪一行"


@pytest.mark.asyncio
async def test_tracked_but_gitignored_file_stays_and_is_named(tmp_path):
    """本票的口径钉:已跟踪的源码不许因为一条宽规则就从检索面消失。"""
    root = tmp_path / "repo"
    (root).mkdir()
    _write(root, ".gitignore", "legacy/\n")
    _write(root, "legacy/kept.js", "module.exports = 1;\n")
    _write(root, "src/main.ts", "export const main = 1;\n")
    _git(root, "init", "-q")
    _git(root, "add", ".gitignore", "src/main.ts")
    _git(root, "add", "-f", "legacy/kept.js")  # 故意把被忽略的那枚纳进跟踪面
    _git(root, "commit", "-qm", "c1")

    result = await _index(root)

    assert "legacy/kept.js" in _collected(root), "已跟踪的文件不得被 .gitignore 静默剔出索引"
    assert result.files_scanned == 2
    assert result.files_tracked_ignored_kept == 1
    assert result.tracked_ignored_kept == ["legacy/kept.js"], "保留的那枚要逐条点名,不许只报个数"
    assert result.files_ignored == 0


@pytest.mark.asyncio
async def test_aiignore_prunes_even_tracked_files(tmp_path):
    """`.aiignore` 是索引专属规则:写它的人明确表达「这枚别进索引」,跟踪状态不管。"""
    root = tmp_path / "repo"
    (root).mkdir()
    _write(root, ".aiignore", "secret.py\n")
    _write(root, "secret.py", "TOKEN = 'x'\n")
    _write(root, "main.py", "print(1)\n")
    _git(root, "init", "-q")
    _git(root, "add", ".")
    _git(root, "commit", "-qm", "c1")

    result = await _index(root)

    assert "secret.py" not in _collected(root)
    assert result.files_ignored == 1
    assert result.files_tracked_ignored_kept == 0


@pytest.mark.asyncio
async def test_non_ignored_files_index_as_before(tmp_path):
    root = tmp_path / "repo"
    (root).mkdir()
    _write(root, ".gitignore", "*.log\n")
    _write(root, "src/main.ts", "export const main = 1;\n")
    _write(root, "src/util.ts", "export const util = 2;\n")
    _git(root, "init", "-q")

    result = await _index(root)

    assert _collected(root) == {"src/main.ts", "src/util.ts"}
    assert result.files_scanned == 2
    assert result.files_ignored == 0
    assert result.files_tracked_ignored_kept == 0
    assert result.ignore_notes == []


@pytest.mark.asyncio
async def test_unknown_tracking_face_prunes_nothing_and_says_why(tmp_path, monkeypatch):
    """跟踪面取不到 ⇒ 未判定:一条都不剪(多留一份)并把原委透出到响应。"""
    root = tmp_path / "repo"
    (root).mkdir()
    _write(root, ".gitignore", "generated/\n")
    _write(root, "generated/app.js", "export const built = 1;\n")
    _write(root, "src/main.ts", "export const main = 1;\n")
    monkeypatch.setattr(ci, "list_tracked_paths", lambda _root: (None, "git 探针跑不动:OSError"))

    result = await _index(root)

    assert _collected(root) == {"generated/app.js", "src/main.ts"}, "未判定不得冒充「全都没被跟踪」"
    assert result.files_ignored == 0
    assert any("跟踪面取不到" in note for note in result.ignore_notes)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
