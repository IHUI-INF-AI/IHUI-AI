# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文档内嵌资产与结构化表格提取工具（基于 Firecrawl anydoc 的 `to_document` 文档模型）。

与 parse_document（纯 Markdown 文本）互补，在本项目"全模态"定位下，把文档里的
内嵌图片/对象资产、以及规范化表格结构挖掘出来：

- extract_document_assets: 提取 docx/doc/pptx/ppt/xlsx/xls/ods/odp/odt/rtf/epub
  内嵌图片等二进制资产（anydoc `Document.assets`），落盘到项目临时目录并返回清单。
  注意 pdf 无文档模型（anydoc 对 pdf 仅支持 to_markdown 直出），故不支持资产提取。
- document_tables: 提取文档数据表格（含合并单元格 span）为规范化二维数组 + GFM/CSV，
  供 RAG 结构化入库或对话引用。

路径安全与错误约定与 document_tools 保持一致：仅项目根内、敏感文件拒绝、
全部异常捕获返回结构化失败、成功结果带 parser 标识。
"""

from __future__ import annotations

import asyncio
import csv
import io
import os
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple, cast

from . import document_tools as _dt_module
from .document_tools import (
    _anydoc,
    _AnydocError,
    _resolve_path,
    _describe_anydoc_error,
)

if TYPE_CHECKING:
    import anydoc


def _anydoc_ok() -> bool:
    """调用时动态读取 anydoc 可用性(单元测试可通过 patch document_tools._ANYDOC_OK 切换)。"""
    return bool(_dt_module._ANYDOC_OK)

# 项目根目录（复用 document_tools 的推导方式: app/tools/*.py -> parents[4] 为仓库根）
PROJECT_ROOT: str = os.path.abspath(str(Path(__file__).resolve().parents[4]))

# 资产落盘相对根目录
_ASSET_DIRNAME = os.path.join("tmp", "anydoc-assets")

# ---- 支持 to_document 文档模型的扩展名（pdf 除外：无资产/表格模型） ----
_ASSET_EXTS: Tuple[str, ...] = (
    ".docx",
    ".doc",
    ".pptx",
    ".ppt",
    ".xlsx",
    ".xls",
    ".ods",
    ".odp",
    ".odt",
    ".rtf",
    ".epub",
)

# 扩展名 -> to_document 的 format 参数
_EXT_TO_FORMAT: Dict[str, str] = {
    ".docx": "docx",
    ".doc": "doc",
    ".pptx": "pptx",
    ".ppt": "ppt",
    ".xlsx": "xlsx",
    ".xls": "xls",
    ".ods": "ods",
    ".odp": "odp",
    ".odt": "odt",
    ".rtf": "rtf",
    ".epub": "epub",
}

# media_type -> 落盘扩展名（未知图片 .img，其余 .bin）
_MEDIA_EXT: Dict[str, str] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/tiff": ".tif",
    "image/x-icon": ".ico",
    "image/avif": ".avif",
    "image/heic": ".heic",
    "application/pdf": ".pdf",
    "application/octet-stream": ".bin",
}

# 资产落盘相对根目录
_ASSET_DIRNAME = os.path.join("tmp", "anydoc-assets")


def _asset_extension(media_type: str) -> str:
    """按 media_type 推导落盘扩展名；图片类缺省 .img，其余 .bin。"""
    if not media_type:
        return ".bin"
    mt = media_type.lower()
    if mt in _MEDIA_EXT:
        return _MEDIA_EXT[mt]
    if mt.startswith("image/"):
        return ".img"
    return ".bin"


def _fail(tool: str, message: str) -> Dict[str, Any]:
    """统一结构化失败响应（不抛异常）。"""
    return {"tool": tool, "ok": False, "message": message}


async def _load_document(abs_path: str, ext: str) -> "anydoc.Document":
    """读取文档字节并在线程池里调 anydoc.to_document，返回 Document 模型。"""
    with open(abs_path, "rb") as f:
        data = f.read()
    fmt = _EXT_TO_FORMAT.get(ext, "docx")
    return await asyncio.to_thread(_anydoc.to_document, data, cast("anydoc.Format", fmt))


# ============================================================================
# extract_document_assets — 内嵌资产提取
# ============================================================================

async def extract_document_assets(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """提取文档内嵌图片/对象资产，落盘到项目临时目录，返回资产清单。

    入参: path(必填)。仅支持 to_document 模型格式（不含 pdf）。
    成功返回 {tool, ok, asset_count, assets, message}；
    assets 每项含 id/filename/extension/media_type/origin_part/file_path/relative_path/bytes。
    """
    try:
        raw_path = arguments.get("path")
        abs_path, err = _resolve_path(raw_path)
        if err is not None:
            return _fail("extract_document_assets", err)
        if abs_path is None:
            return _fail("extract_document_assets", "路径无效")

        ext = os.path.splitext(abs_path)[1].lower()
        if ext == ".pdf":
            return _fail(
                "extract_document_assets",
                "PDF 无文档模型(anydoc 仅支持 to_markdown 直出), 无法提取内嵌资产",
            )
        if ext not in _ASSET_EXTS:
            return _fail(
                "extract_document_assets",
                "该格式不支持资产提取({}); 支持的格式: {}".format(
                    ext or "无扩展名", ", ".join(_ASSET_EXTS)
                ),
            )
        if not _anydoc_ok():
            return _fail("extract_document_assets", "文档引擎不可用(anydoc 模块未安装)")

        doc = await _load_document(abs_path, ext)
        assets = list(getattr(doc, "assets", None) or [])
        if not assets:
            return {
                "tool": "extract_document_assets",
                "ok": True,
                "asset_count": 0,
                "assets": [],
                "message": "该文档未包含内嵌资产",
            }

        base = os.path.splitext(os.path.basename(abs_path))[0] or "asset"
        out_dir = os.path.join(PROJECT_ROOT, _ASSET_DIRNAME, uuid.uuid4().hex)
        os.makedirs(out_dir, exist_ok=True)

        manifest: List[Dict[str, Any]] = []
        for i, asset in enumerate(assets):
            item: Dict[str, Any] = {"id": i, "ok": True, "error": ""}
            try:
                media_type = getattr(asset, "media_type", "") or ""
                origin_part = getattr(asset, "origin_part", "") or ""
                data = getattr(asset, "data", b"") or b""
                if isinstance(data, memoryview):
                    data = data.tobytes()
                item["media_type"] = media_type
                item["origin_part"] = origin_part
                filename = "{}-{}{}".format(base, i, _asset_extension(media_type))
                file_path = os.path.join(out_dir, filename)
                # 自生成文件名，绝不复用服务器 origin_part，防路径穿越
                with open(file_path, "wb") as f:
                    f.write(bytes(data))
                rel = os.path.relpath(file_path, PROJECT_ROOT).replace("\\", "/")
                item["filename"] = filename
                item["extension"] = _asset_extension(media_type).lstrip(".")
                item["file_path"] = file_path
                item["relative_path"] = rel
                item["bytes"] = len(bytes(data))
            except Exception as e:  # noqa: BLE001
                item["ok"] = False
                item["error"] = "资产落盘失败: {}: {}".format(type(e).__name__, e)
            manifest.append(item)

        ok_count = sum(1 for it in manifest if it.get("ok"))
        return {
            "tool": "extract_document_assets",
            "ok": ok_count > 0,
            "asset_count": len(manifest),
            "ok_count": ok_count,
            "assets": manifest,
            "message": "提取到 {} 个内嵌资产(成功 {})".format(len(manifest), ok_count),
        }
    except _AnydocError as e:
        return _fail("extract_document_assets", _describe_anydoc_error(e))
    except Exception as e:  # noqa: BLE001 全部捕获，不向上抛
        return _fail("extract_document_assets", "提取失败: {}: {}".format(type(e).__name__, e))


# ============================================================================
# document_tables — 结构化表格提取
# ============================================================================

def _inline_text(inlines: Any) -> str:
    """把 Inline 列表渲染为纯文本（text/link 内容/换行）。"""
    parts: List[str] = []
    for il in inlines or []:
        kind = getattr(il, "kind", None)
        text = getattr(il, "text", None)
        if kind == "text" and text:
            parts.append(text)
        elif kind == "link":
            parts.append(_inline_text(getattr(il, "content", None)))
        elif kind == "lineBreak":
            parts.append("\n")
    return "".join(parts)


def _cell_text(cell: Any) -> str:
    """把 Cell 内 blocks 渲染为文本。"""
    lines: List[str] = []
    for block in getattr(cell, "blocks", None) or []:
        txt = _inline_text(getattr(block, "content", None))
        if txt.strip():
            lines.append(txt)
    return " ".join(x.strip() for x in lines if x.strip())


def _table_grid(table: Any) -> List[List[str]]:
    """把规范网格（CellSlot，covered 指向 origin）展开为二维文本数组。"""
    grid = getattr(table, "grid", None) or []
    rows: List[List[str]] = []
    for r, rowslots in enumerate(grid):
        row: List[str] = []
        for slot in rowslots:
            kind = getattr(slot, "kind", None)
            if kind == "covered":
                # 用 origin 位置的内容填充
                orow = getattr(slot, "origin_row", None)
                ocol = getattr(slot, "origin_col", None)
                if orow is not None and ocol is not None and 0 <= orow < len(grid):
                    ocell_slots = grid[orow]
                    if 0 <= ocol < len(ocell_slots):
                        occell = getattr(ocell_slots[ocol], "cell", None)
                        row.append(_cell_text(occell) if occell is not None else "")
                        continue
                row.append("")
            else:  # origin
                cell = getattr(slot, "cell", None)
                row.append(_cell_text(cell) if cell is not None else "")
        rows.append(row)
    return rows


def _to_csv(headers: List[str], rows: List[List[str]]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    if headers:
        w.writerow(headers)
    for row in rows:
        w.writerow(row)
    return buf.getvalue().rstrip("\n")


def _to_markdown(headers: List[str], rows: List[List[str]]) -> str:
    ncols = len(headers)
    for row in rows:
        ncols = max(ncols, len(row))
    head = headers + [""] * (ncols - len(headers))
    sep = ["---"] * ncols
    lines = ["| {} |".format(" | ".join(head)), "| {} |".format(" | ".join(sep))]
    for row in rows:
        padded = row + [""] * (ncols - len(row))
        lines.append("| {} |".format(" | ".join(padded)))
    return "\n".join(lines)


async def document_tables(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """提取文档内规范化数据表格（含合并单元格）为二维文本数组 + GFM/CSV。

    入参: path(必填)。仅支持 to_document 模型格式（不含 pdf）。
    返回 {tool, ok, table_count, tables, message}；
    tables 每项含 index/kind/header_rows/row_count/col_count/headers/rows/markdown/csv。
    """
    try:
        abs_path, err = _resolve_path(arguments.get("path"))
        if err is not None:
            return _fail("document_tables", err)
        if abs_path is None:
            return _fail("document_tables", "路径无效")

        ext = os.path.splitext(abs_path)[1].lower()
        if ext == ".pdf":
            return _fail(
                "document_tables",
                "PDF 无文档模型(anydoc 仅支持 to_markdown 直出), 无法提取结构化表格",
            )
        if ext not in _ASSET_EXTS:
            return _fail(
                "document_tables",
                "该格式不支持表格提取({}); 支持的格式: {}".format(
                    ext or "无扩展名", ", ".join(_ASSET_EXTS)
                ),
            )
        if not _anydoc_ok():
            return _fail("document_tables", "文档引擎不可用(anydoc 模块未安装)")

        doc = await _load_document(abs_path, ext)
        tables_found: List[Dict[str, Any]] = []
        idx = 0

        def walk(blocks: Any) -> None:
            nonlocal idx
            for block in blocks or []:
                table = getattr(block, "table", None)
                if table is not None:
                    grid_rows = _table_grid(table)
                    header_rows = int(getattr(table, "header_rows", 0) or 0)
                    kind = getattr(table, "kind", "data") or "data"
                    headers = grid_rows[:header_rows] if header_rows else []
                    body = grid_rows[header_rows:] if header_rows else grid_rows
                    flat_headers: List[str] = []
                    if headers:
                        # 多个 header 行合并为一行（竖排按行取首列）
                        flat_headers = headers[0] if headers else []
                    rows_out = [row for row in body if any(c.strip() for c in row)]
                    # 无表头行的表格：以首个非空数据行当 GFM 表头
                    if flat_headers:
                        md_head, md_body = flat_headers, rows_out
                    elif rows_out:
                        md_head, md_body = rows_out[0], rows_out[1:]
                    else:
                        md_head, md_body = [], []
                    tables_found.append(
                        {
                            "index": idx,
                            "kind": str(kind),
                            "header_rows": header_rows,
                            "row_count": len(rows_out),
                            "col_count": max([len(md_head)] + [len(r) for r in md_body] or [0]),
                            "headers": flat_headers or [],
                            "rows": rows_out,
                            "markdown": _to_markdown(md_head, md_body),
                            "csv": _to_csv(flat_headers, rows_out),
                        }
                    )
                    idx += 1
                nested = getattr(block, "blocks", None)
                if nested:
                    walk(nested)
                lst = getattr(block, "list", None)
                if lst is not None:
                    for item in getattr(lst, "items", None) or []:
                        walk(getattr(item, "blocks", None) or [])

        walk(getattr(doc, "blocks", None) or [])

        return {
            "tool": "document_tables",
            "ok": len(tables_found) > 0,
            "table_count": len(tables_found),
            "tables": tables_found,
            "message": "提取到 {} 个表格".format(len(tables_found))
            if tables_found
            else "该文档未包含表格",
        }
    except _AnydocError as e:
        return _fail("document_tables", _describe_anydoc_error(e))
    except Exception as e:  # noqa: BLE001
        return _fail("document_tables", "提取失败: {}: {}".format(type(e).__name__, e))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
