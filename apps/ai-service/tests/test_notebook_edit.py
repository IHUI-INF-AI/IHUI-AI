# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""notebook_edit(.ipynb 单元格结构编辑)单元测试 —— G-NotebookEdit 补齐(2026-11-01 立)。

纪律:
- 纯文件 IO + monkeypatch,不连 PG(8810)/Redis(8811);
- "只改目标 cell"用逐 cell json dump 字节比对钉死(其余 cell 与 notebook 顶层键必须逐字节不变);
- 拒绝型用例成对断言「写腿一次都没进」(spy _tool_write_file)+ 文件字节不变,
  防"拒绝了但落了盘"的假绿(§5 越权用例必须断言副作用没发生);
- 非属主/越权路径走**真实**校验器(只 monkeypatch _get_workspace_roots 把白名单钉到夹具目录)。
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services.mcp_server import (
    _TOOLS,
    _reset_file_base_store,
    _tool_notebook_edit,
)

HOST: dict[str, str] = {"__user_id": "owner-uuid-1"}


def _make_notebook() -> dict:
    """三格笔记本:markdown / code(带 outputs+metadata+id)/ raw,覆盖三类 cell。"""
    return {
        "cells": [
            {
                "cell_type": "markdown",
                "id": "md-cell-a",
                "metadata": {"tags": ["doc"]},
                "source": ["# 标题\n", "第二行"],
            },
            {
                "cell_type": "code",
                "execution_count": 3,
                "id": "code-cell-b",
                "metadata": {"tags": ["keep"]},
                "outputs": [
                    {"output_type": "stream", "name": "stdout", "text": ["1\n"]},
                ],
                "source": ["print(1)\n"],
            },
            {
                "cell_type": "raw",
                "id": "raw-cell-c",
                "metadata": {"raw_mimetype": "text/x-script"},
                "source": ["raw content"],
            },
        ],
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3",
            },
        },
        "nbformat": 4,
        "nbformat_minor": 5,
    }


@pytest.fixture()
def nb_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """把笔记本落到被 monkeypatch 的工作区根;base 存储前后各清一次(测试隔离)。"""
    monkeypatch.setattr(
        "app.services.mcp_server._get_workspace_roots", lambda: [str(tmp_path)]
    )
    _reset_file_base_store()
    f = tmp_path / "analysis.ipynb"
    f.write_text(
        json.dumps(_make_notebook(), ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    yield f
    _reset_file_base_store()


def _load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _dump_cell(cell: object) -> str:
    """单元格规范化 dump(键序固定)—— 逐字节比对的等值尺。"""
    return json.dumps(cell, ensure_ascii=False, sort_keys=True, indent=1)


# =============================================================================
# edit / insert / delete 三类各一例:只改目标 cell,其余 cell 逐字节不变
# =============================================================================


async def test_replace_only_target_cell(nb_file: Path) -> None:
    before = _load(nb_file)
    out = await _tool_notebook_edit(
        {
            "notebook_path": str(nb_file),
            "cell_id": "cell-1",
            "new_source": "print(42)\nprint(2)",
            "edit_mode": "replace",
            **HOST,
        }
    )
    assert out["ok"] is True, out
    assert out["editMode"] == "replace"
    after = _load(nb_file)
    assert len(after["cells"]) == 3
    # 目标 cell:source 已改写为 ipynb 行数组,非 source 键(metadata/outputs/id)原样保留
    assert after["cells"][1]["source"] == ["print(42)\n", "print(2)"]
    assert after["cells"][1]["metadata"] == before["cells"][1]["metadata"]
    assert after["cells"][1]["outputs"] == before["cells"][1]["outputs"]
    assert after["cells"][1]["id"] == before["cells"][1]["id"]
    # 其余 cell 逐字节不变(连同 notebook 顶层非 cells 键)
    for i in (0, 2):
        assert _dump_cell(after["cells"][i]) == _dump_cell(before["cells"][i])
    assert _dump_cell(after["metadata"]) == _dump_cell(before["metadata"])
    assert after["nbformat"] == before["nbformat"]
    assert after["nbformat_minor"] == before["nbformat_minor"]


async def test_insert_code_cell_after_target(nb_file: Path) -> None:
    before = _load(nb_file)
    out = await _tool_notebook_edit(
        {
            "notebook_path": str(nb_file),
            "cell_id": "cell-0",
            "cell_type": "code",
            "new_source": "x = 1\n",
            "edit_mode": "insert",
            **HOST,
        }
    )
    assert out["ok"] is True, out
    assert out["cellId"] == "cell-1"
    assert out["cellCount"] == 4
    after = _load(nb_file)
    new_cell = after["cells"][1]
    assert new_cell["cell_type"] == "code"
    assert new_cell["execution_count"] is None
    assert new_cell["outputs"] == []
    assert new_cell["source"] == ["x = 1\n"]
    # 原三格整体后移一位,逐字节不变
    for i_before, i_after in ((0, 0), (1, 2), (2, 3)):
        assert _dump_cell(after["cells"][i_after]) == _dump_cell(before["cells"][i_before])


async def test_delete_cell_only_removes_target(nb_file: Path) -> None:
    before = _load(nb_file)
    out = await _tool_notebook_edit(
        {
            "notebook_path": str(nb_file),
            "cell_id": "cell-1",
            "edit_mode": "delete",
            **HOST,
        }
    )
    assert out["ok"] is True, out
    assert out["cellId"] == "code-cell-b"  # 被删格的原生 id 回显
    after = _load(nb_file)
    assert len(after["cells"]) == 2
    assert _dump_cell(after["cells"][0]) == _dump_cell(before["cells"][0])
    assert _dump_cell(after["cells"][1]) == _dump_cell(before["cells"][2])


async def test_cell_id_accepts_native_id(nb_file: Path) -> None:
    """cell_id 兼容 notebook 原生 id 字段(非 cell-N 形态)。"""
    out = await _tool_notebook_edit(
        {
            "notebook_path": str(nb_file),
            "cell_id": "code-cell-b",
            "new_source": "print(9)\n",
            "edit_mode": "replace",
            **HOST,
        }
    )
    assert out["ok"] is True, out
    after = _load(nb_file)
    assert after["cells"][1]["source"] == ["print(9)\n"]


# =============================================================================
# 身份闸:缺宿主注入 / 模型自报顶替 ⇒ 拒绝且零副作用(写腿一次都没进)
# =============================================================================


async def test_missing_identity_rejects_without_side_effect(nb_file: Path) -> None:
    before_bytes = nb_file.read_bytes()
    with patch(
        "app.services.mcp_server._tool_write_file", new=AsyncMock()
    ) as write_spy:
        out = await _tool_notebook_edit(
            {
                "notebook_path": str(nb_file),
                "cell_id": "cell-0",
                "new_source": "evil",
                "edit_mode": "replace",
            }
        )
    assert out["ok"] is False
    assert out["errorCode"] == "PRINCIPAL_REQUIRED"
    assert write_spy.await_count == 0  # 正向对照:拒绝路径上写腿一次都没被调用
    assert nb_file.read_bytes() == before_bytes  # 副作用没发生


async def test_model_self_reported_user_id_is_not_identity(nb_file: Path) -> None:
    """自报 user_id 不得顶替宿主注入身份(ROUTING_IDENTITY_KEYS:身份禁入模型参数面)。"""
    before_bytes = nb_file.read_bytes()
    with patch(
        "app.services.mcp_server._tool_write_file", new=AsyncMock()
    ) as write_spy:
        out = await _tool_notebook_edit(
            {
                "notebook_path": str(nb_file),
                "cell_id": "cell-0",
                "new_source": "evil",
                "edit_mode": "replace",
                "user_id": "victim-uuid",  # 模型自报,必须不被采信
            }
        )
    assert out["ok"] is False
    assert out["errorCode"] == "PRINCIPAL_REQUIRED"
    assert write_spy.await_count == 0
    assert nb_file.read_bytes() == before_bytes
    # schema 面自证:身份键不在模型可填 properties 里,additionalProperties=False
    schema = next(t.input_schema for t in _TOOLS if t.name == "notebook_edit")
    assert "user_id" not in schema["properties"]
    assert "__user_id" not in schema["properties"]
    assert schema["additionalProperties"] is False


async def test_path_outside_workspace_rejects_without_side_effect(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """非属主面(路径不在工作区白名单)= 真实校验器拒绝,零写盘。"""
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    outside = tmp_path / "outside.ipynb"
    outside.write_text(
        json.dumps(_make_notebook(), ensure_ascii=False, indent=1), encoding="utf-8"
    )
    monkeypatch.setattr(
        "app.services.mcp_server._get_workspace_roots", lambda: [str(allowed)]
    )
    _reset_file_base_store()
    before_bytes = outside.read_bytes()
    with patch(
        "app.services.mcp_server._tool_write_file", new=AsyncMock()
    ) as write_spy:
        out = await _tool_notebook_edit(
            {
                "notebook_path": str(outside),
                "cell_id": "cell-0",
                "new_source": "evil",
                "edit_mode": "replace",
                **HOST,
            }
        )
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED"
    assert write_spy.await_count == 0
    assert outside.read_bytes() == before_bytes


# =============================================================================
# 确定性与边界
# =============================================================================


async def test_two_runs_same_result(nb_file: Path) -> None:
    """跑两次同结果:第二次 base 已刷成第一次的落盘面 ⇒ clean,字节输出一致。"""
    args = {
        "notebook_path": str(nb_file),
        "cell_id": "cell-2",
        "cell_type": "markdown",
        "new_source": "### 小结\n",
        "edit_mode": "replace",
        **HOST,
    }
    first = await _tool_notebook_edit(args)
    bytes_after_first = nb_file.read_bytes()
    second = await _tool_notebook_edit(args)
    assert first["ok"] is True and second["ok"] is True
    assert nb_file.read_bytes() == bytes_after_first


async def test_boundary_rejections(nb_file: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # 非 .ipynb 后缀 ⇒ NOT_A_NOTEBOOK(在 nb_file 同根放一个 .txt)
    monkeypatch.setattr(
        "app.services.mcp_server._get_workspace_roots", lambda: [str(tmp_path)]
    )
    txt = tmp_path / "noteprobe.txt"
    txt.write_text("x", encoding="utf-8")
    out = await _tool_notebook_edit(
        {"notebook_path": str(txt), "cell_id": "cell-0", "new_source": "y", **HOST}
    )
    assert out["ok"] is False and out["errorCode"] == "NOT_A_NOTEBOOK"

    # 非法 JSON ⇒ INVALID_NOTEBOOK
    bad = tmp_path / "broken.ipynb"
    bad.write_text("{not json", encoding="utf-8")
    out = await _tool_notebook_edit(
        {"notebook_path": str(bad), "cell_id": "cell-0", "new_source": "y", **HOST}
    )
    assert out["ok"] is False and out["errorCode"] == "INVALID_NOTEBOOK"

    # 序号越界 ⇒ CELL_NOT_FOUND
    out = await _tool_notebook_edit(
        {"notebook_path": str(nb_file), "cell_id": "cell-99", "new_source": "y", **HOST}
    )
    assert out["ok"] is False and out["errorCode"] == "CELL_NOT_FOUND"

    # insert 缺 cell_type ⇒ MISSING_CELL_TYPE
    out = await _tool_notebook_edit(
        {
            "notebook_path": str(nb_file),
            "cell_id": "cell-0",
            "new_source": "y\n",
            "edit_mode": "insert",
            **HOST,
        }
    )
    assert out["ok"] is False and out["errorCode"] == "MISSING_CELL_TYPE"

    # 非法 edit_mode ⇒ INVALID_EDIT_MODE
    out = await _tool_notebook_edit(
        {
            "notebook_path": str(nb_file),
            "cell_id": "cell-0",
            "new_source": "y",
            "edit_mode": "append",
            **HOST,
        }
    )
    assert out["ok"] is False and out["errorCode"] == "INVALID_EDIT_MODE"
