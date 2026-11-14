# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""表格公式重算/校验(sheet_formula_eval / sheet_formula_validate)。

钉住的边界:
  A 公式子集(SUM/AVERAGE/MIN/MAX/ROUND/ABS/IF/VLOOKUP/COUNT/COUNTA/CONCAT、
    四则运算、A1/$A$1/区域/跨表/带引号表名)给出金标值;
  B 依赖图与逐格 provenance({value, formula, source, cached, cache_matches})可复验;
  C 负例一律结构化 error_code(语法/未知函数/坏引用/循环/类型/除零/无匹配),
    循环引用带闭环路径,不静默空串;
  D 缓存漂移单独标 warning,不把旧缓存冒充重算值;
  E 路径/格式/结构/范围四道闸具名拒绝,继续沿用 document_tools 的路径安全判据。
"""

from __future__ import annotations

import re
import zipfile
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape

import pytest

from app.tools import document_tools
from app.tools import spreadsheet_formula as sf

_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _cell_xml(cell: dict[str, Any]) -> str:
    attrs = ""
    body = ""
    formula = cell.get("f")
    if formula is not None:
        body += f"<f>{escape(str(formula))}</f>"
    if "s" in cell:
        attrs = ' t="inlineStr"'
        body += f"<is><t>{escape(str(cell['s']))}</t></is>"
    elif "e" in cell:
        attrs = ' t="e"'
        body += f"<v>{escape(str(cell['e']))}</v>"
    elif "b" in cell:
        attrs = ' t="b"'
        body += f"<v>{1 if cell['b'] else 0}</v>"
    elif "v" in cell:
        body += f"<v>{escape(str(cell['v']))}</v>"
    return f'<c r="{cell["addr"]}"{attrs}>{body}</c>'


def _sheet_xml(cells: list[dict[str, Any]]) -> str:
    rows: dict[int, list[dict[str, Any]]] = {}
    for cell in cells:
        match = re.match(r"^[A-Z]+(\d+)$", str(cell["addr"]))
        row = int(match.group(1)) if match else 1
        rows.setdefault(row, []).append(cell)
    body = "".join(
        f'<row r="{row}">' + "".join(_cell_xml(c) for c in rows[row]) + "</row>"
        for row in sorted(rows)
    )
    return f'<worksheet xmlns="{_NS}"><sheetData>{body}</sheetData></worksheet>'


def _build_xlsx(tmp_path: Path, sheets: dict[str, list[dict[str, Any]]]) -> Path:
    """手写最小 OOXML 工作簿(不依赖 openpyxl)。"""
    names = list(sheets)
    sheet_entries = "".join(
        f'<sheet name="{escape(name, {chr(34): "&quot;"})}" sheetId="{i + 1}" r:id="rId{i + 1}"/>'
        for i, name in enumerate(names)
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f'<workbook xmlns="{_NS}" xmlns:r="{_R_NS}"><sheets>{sheet_entries}</sheets></workbook>'
    )
    rel_entries = "".join(
        f'<Relationship Id="rId{i + 1}" Type="{_R_NS}/worksheet" '
        f'Target="worksheets/sheet{i + 1}.xml"/>'
        for i in range(len(names))
    )
    rels_xml = f'<Relationships xmlns="{_REL_NS}">{rel_entries}</Relationships>'
    path = tmp_path / "book.xlsx"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", rels_xml)
        for i, name in enumerate(names, start=1):
            zf.writestr(f"xl/worksheets/sheet{i}.xml", _sheet_xml(sheets[name]))
    return path


@pytest.fixture()
def workspace(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把文档工具的 PROJECT_ROOT 收到临时目录,复用同一条路径安全判据。"""
    monkeypatch.setattr(document_tools, "PROJECT_ROOT", str(tmp_path))
    return tmp_path


async def _eval(path: Path, **kwargs: Any) -> dict[str, Any]:
    return await sf.sheet_formula_eval({"path": str(path), **kwargs})


async def _validate(path: Path, **kwargs: Any) -> dict[str, Any]:
    return await sf.sheet_formula_validate({"path": str(path), **kwargs})


# ---------------------------------------------------------------------------
# A. 金标值
# ---------------------------------------------------------------------------


async def test_sum_average_min_max_and_provenance(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "Sheet1": [
                {"addr": "A1", "v": 1},
                {"addr": "A2", "v": 2},
                {"addr": "A3", "v": 3},
                {"addr": "B1", "v": 6, "f": "SUM(A1:A3)"},
                {"addr": "B2", "f": "AVERAGE(A1:A3)"},
                {"addr": "B3", "f": "MIN(A1:A3)"},
                {"addr": "B4", "f": "MAX(A1:A3)"},
            ]
        },
    )
    result = await _eval(path)
    assert result["ok"] is True
    cells = result["cells"]
    assert cells["Sheet1!B1"]["value"] == 6
    assert cells["Sheet1!B1"]["formula"] == "=SUM(A1:A3)"
    assert cells["Sheet1!B1"]["source"] == "computed"
    assert cells["Sheet1!B1"]["cache_matches"] is True
    assert cells["Sheet1!B2"]["value"] == 2
    assert cells["Sheet1!B3"]["value"] == 1
    assert cells["Sheet1!B4"]["value"] == 3
    assert cells["Sheet1!A1"] == {
        "value": 1,
        "formula": None,
        "source": "literal",
        "cached": 1,
        "cache_matches": True,
    }
    assert result["dependencies"]["Sheet1!B1"] == ["Sheet1!A1", "Sheet1!A2", "Sheet1!A3"]


async def test_arithmetic_absolute_refs_and_percent(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "S": [
                {"addr": "A1", "v": 10},
                {"addr": "B1", "f": "$A$1*2+5%"},
                {"addr": "B2", "f": "-(2^3)+1"},
            ]
        },
    )
    result = await _eval(path)
    assert result["cells"]["S!B1"]["value"] == 20.05
    assert result["cells"]["S!B2"]["value"] == -7


async def test_if_comparison_and_text_concat(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "S": [
                {"addr": "A1", "v": 80},
                {"addr": "B1", "f": 'IF(A1>=60,"及格","不及格")'},
                {"addr": "B2", "f": 'IF(A1<60,"及格","不及格")'},
                {"addr": "B3", "f": 'A1&"分"'},
                {"addr": "B4", "f": 'CONCAT(A1,"分")'},
            ]
        },
    )
    result = await _eval(path)
    assert result["cells"]["S!B1"]["value"] == "及格"
    assert result["cells"]["S!B2"]["value"] == "不及格"
    assert result["cells"]["S!B3"]["value"] == "80分"
    assert result["cells"]["S!B4"]["value"] == "80分"


async def test_vlookup_exact_and_approximate(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "数据": [
                {"addr": "A1", "v": 1},
                {"addr": "B1", "s": "一"},
                {"addr": "A2", "v": 2},
                {"addr": "B2", "s": "二"},
                {"addr": "A3", "v": 3},
                {"addr": "B3", "s": "三"},
                {"addr": "D1", "f": "VLOOKUP(2,A1:B3,2,FALSE)"},
                {"addr": "D2", "f": "VLOOKUP(2.5,A1:B3,2)"},
                {"addr": "D3", "f": "VLOOKUP(9,A1:B3,2,FALSE)"},
            ]
        },
    )
    result = await _eval(path)
    assert result["cells"]["数据!D1"]["value"] == "二"
    assert result["cells"]["数据!D2"]["value"] == "二"
    assert result["cells"]["数据!D3"]["error"]["code"] == "FORMULA_NO_MATCH"


async def test_cross_sheet_and_quoted_sheet_reference(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "汇总": [{"addr": "A1", "f": "数据!A1+1"}],
            "数据": [{"addr": "A1", "v": 100}],
        },
    )
    quoted_dir = workspace / "quoted"
    quoted_dir.mkdir()
    path_two = _build_xlsx(
        quoted_dir,
        {
            "汇总": [{"addr": "A1", "f": "'My Sheet'!A1*2"}],
            "My Sheet": [{"addr": "A1", "v": 21}],
        },
    )
    result = await _eval(path)
    assert result["cells"]["汇总!A1"]["value"] == 101
    assert result["dependencies"]["汇总!A1"] == ["数据!A1"]
    quoted = await _eval(path_two)
    assert quoted["cells"]["汇总!A1"]["value"] == 42


async def test_round_abs_count_counta(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "S": [
                {"addr": "A1", "v": 1},
                {"addr": "A2", "s": "文本"},
                {"addr": "A3", "v": 2},
                {"addr": "B1", "f": "ROUND(2.5,0)"},
                {"addr": "B2", "f": "ROUND(-2.5,0)"},
                {"addr": "B3", "f": "ABS(-5)"},
                {"addr": "B4", "f": "COUNT(A1:A3)"},
                {"addr": "B5", "f": "COUNTA(A1:A3)"},
            ]
        },
    )
    result = await _eval(path)
    assert result["cells"]["S!B1"]["value"] == 3
    assert result["cells"]["S!B2"]["value"] == -3
    assert result["cells"]["S!B3"]["value"] == 5
    assert result["cells"]["S!B4"]["value"] == 2
    assert result["cells"]["S!B5"]["value"] == 3


# ---------------------------------------------------------------------------
# B. 负例:结构化错误码
# ---------------------------------------------------------------------------


async def test_circular_reference_has_cycle_path(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {"S": [{"addr": "A1", "f": "B1"}, {"addr": "B1", "f": "A1"}]},
    )
    result = await _eval(path)
    a1 = result["cells"]["S!A1"]
    assert a1["error"]["code"] == "FORMULA_CIRCULAR_REFERENCE"
    assert len(a1["error"]["detail"]["cycle"]) >= 2
    report = await _validate(path)
    assert report["clean"] is False
    assert report["error_count"] == 2
    assert {f["code"] for f in report["findings"]} == {"FORMULA_CIRCULAR_REFERENCE"}


async def test_syntax_unknown_function_bad_ref_div_zero_and_type(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "S": [
                {"addr": "A1", "v": 0},
                {"addr": "B1", "f": "SUM("},
                {"addr": "B2", "f": "FOO(1)"},
                {"addr": "B3", "f": "不存在!A1"},
                {"addr": "B4", "f": "1/A1"},
                {"addr": "B5", "f": '"abc"+1'},
            ]
        },
    )
    result = await _eval(path)
    codes = {cell: payload["error"]["code"] for cell, payload in result["cells"].items() if "error" in payload}
    assert codes["S!B1"] == "FORMULA_SYNTAX"
    assert codes["S!B2"] == "FORMULA_UNKNOWN_FUNCTION"
    assert codes["S!B3"] == "FORMULA_BAD_REFERENCE"
    assert codes["S!B4"] == "FORMULA_DIV_ZERO"
    assert codes["S!B5"] == "FORMULA_TYPE"
    assert result["error_cells"] == 5


async def test_cached_value_mismatch_is_warning_not_error(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {"S": [{"addr": "A1", "v": 1}, {"addr": "B1", "v": 99, "f": "A1+1"}]},
    )
    result = await _eval(path)
    assert result["cells"]["S!B1"]["value"] == 2
    assert result["cells"]["S!B1"]["cached"] == 99
    assert result["cells"]["S!B1"]["cache_matches"] is False
    report = await _validate(path)
    assert report["clean"] is True
    assert report["warning_count"] == 1
    assert report["findings"][0]["code"] == "CACHED_VALUE_MISMATCH"
    assert report["findings"][0]["cached"] == 99
    assert report["findings"][0]["computed"] == 2


# ---------------------------------------------------------------------------
# C. 范围/限额/参数
# ---------------------------------------------------------------------------


async def test_range_filter_and_include_inputs(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "S": [
                {"addr": "A1", "v": 1},
                {"addr": "B1", "f": "A1+1"},
                {"addr": "B2", "f": "A1+2"},
            ]
        },
    )
    scoped = await _eval(path, range="B2:B2", include_inputs=False)
    assert set(scoped["cells"]) == {"S!B2"}
    assert scoped["cells"]["S!B2"]["value"] == 3
    full = await _eval(path, include_inputs=False)
    assert set(full["cells"]) == {"S!B1", "S!B2"}


async def test_max_cells_truncates(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {
            "S": [
                {"addr": "A1", "v": 1},
                {"addr": "B1", "f": "A1+1"},
                {"addr": "B2", "f": "A1+2"},
                {"addr": "B3", "f": "A1+3"},
            ]
        },
    )
    result = await _eval(path, max_cells=2, include_inputs=False)
    assert result["truncated"] is True
    assert result["returned_cells"] == 2


async def test_tool_rejections_are_structured(workspace: Path) -> None:
    missing = await _eval(workspace / "nope.xlsx")
    assert missing["ok"] is False and missing["errorCode"] == "INVALID_PATH"

    text_file = workspace / "a.txt"
    text_file.write_text("x", encoding="utf-8")
    unsupported = await _eval(text_file)
    assert unsupported["errorCode"] == "UNSUPPORTED_FORMAT"

    broken = workspace / "broken.xlsx"
    broken.write_bytes(b"not-a-zip")
    unreadable = await _eval(broken)
    assert unreadable["errorCode"] == "WORKBOOK_UNREADABLE"

    path = _build_xlsx(workspace, {"S": [{"addr": "A1", "v": 1}]})
    assert (await _eval(path, sheet="不存在"))["errorCode"] == "SHEET_NOT_FOUND"
    assert (await _eval(path, range="XX"))["errorCode"] == "INVALID_RANGE"
    multi = _build_xlsx(workspace, {"S1": [{"addr": "A1", "v": 1}], "S2": [{"addr": "A1", "v": 2}]})
    assert (await _eval(multi, range="A1:A2"))["errorCode"] == "INVALID_REQUEST"


async def test_path_outside_project_root_is_rejected(
    workspace: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    outside = workspace / "outside.xlsx"
    outside.write_bytes(b"PK\x03\x04")
    root = workspace / "sandbox"
    root.mkdir()
    monkeypatch.setattr(document_tools, "PROJECT_ROOT", str(root))
    result = await _eval(outside)
    assert result["ok"] is False
    assert result["errorCode"] == "INVALID_PATH"


async def test_validate_clean_workbook(workspace: Path) -> None:
    path = _build_xlsx(
        workspace,
        {"S": [{"addr": "A1", "v": 1}, {"addr": "B1", "v": 2, "f": "A1+1"}]},
    )
    report = await _validate(path)
    assert report["ok"] is True
    assert report["clean"] is True
    assert report["error_count"] == 0
    assert report["scanned_formula_cells"] == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
