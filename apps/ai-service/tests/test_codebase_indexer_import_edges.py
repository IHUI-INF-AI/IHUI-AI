# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""导入边抽取测试(P0-8 第七批,2026-11-23)。

测试隔离(AGENTS.md §5 铁律):只在 tmp_path 造文件,不碰仓库、不连库、不打 HTTP。

覆盖:python 风格 import 抽取 / 逗号多名拆分 / 别名剥离 / 只留 import(不混入函数类) /
读不到的文件跳过 / 无 import 的文件不产边 / **TS 风格 import 不产边**(如实记录既有正则口径)。
"""

from __future__ import annotations

from pathlib import Path

from app.services.codebase_indexer import collect_import_edges


def test_extracts_python_imports_with_line_numbers(tmp_path: Path) -> None:
    (tmp_path / "m.py").write_text("import os\nimport a, b\n", encoding="utf-8")
    edges = collect_import_edges(tmp_path, ["m.py"])
    pairs = sorted((e["name"], e["line"]) for e in edges)
    assert ("a", 2) in pairs and ("b", 2) in pairs and ("os", 1) in pairs
    assert all(e["filePath"] == "m.py" for e in edges)


def test_alias_is_stripped(tmp_path: Path) -> None:
    (tmp_path / "m.py").write_text("from typing import Any as A\n", encoding="utf-8")
    edges = collect_import_edges(tmp_path, ["m.py"])
    assert [e["name"] for e in edges] == ["Any"]


def test_only_imports_are_edges(tmp_path: Path) -> None:
    (tmp_path / "m.py").write_text(
        "def foo():\n    pass\n\nclass Bar:\n    pass\n", encoding="utf-8"
    )
    assert collect_import_edges(tmp_path, ["m.py"]) == []


def test_missing_file_is_skipped(tmp_path: Path) -> None:
    assert collect_import_edges(tmp_path, ["nope.py"]) == []


def test_empty_path_list(tmp_path: Path) -> None:
    assert collect_import_edges(tmp_path, []) == []


def test_ts_style_import_is_not_matched(tmp_path: Path) -> None:
    """既有正则只覆盖 `import x` / `from m import x`;TS 的 `import {x} from 'm'` 不匹配。

    这条用例的作用是**把局限钉成事实**:将来若要覆盖 TS,必须改 `code_symbol_graph`
    且保持单源 —— 而不是先在别的层加第二份正则。
    """

    (tmp_path / "a.ts").write_text("import { Foo } from './foo'\n", encoding="utf-8")
    assert collect_import_edges(tmp_path, ["a.ts"]) == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
