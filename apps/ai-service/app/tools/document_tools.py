# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文档解析工具(parse_document): 将本地文档解析为可注入 LLM 上下文的文本/Markdown。

支持的格式(白名单, 2026-09-08 起经 Firecrawl anydoc 扩展至 15 种):
- txt / md / csv / json: 文本直接读取, 编码容错 utf-8 -> gbk -> latin-1;
- anydoc 主路径(Rust 原生引擎): pdf / docx / doc / pptx / ppt / xls / xlsx /
  odt / ods / odp / rtf / epub → GFM Markdown(标题/表格/列表/加粗);
- 降级实现(anydoc 失败或未安装时): pdf → pdfplumber, docx → zipfile+XML,
  xlsx → zipfile+XML; 新格式(doc/ppt/ppt/xls/odt/ods/odp/rtf/epub)无降级;
- csv 保持旧行为(仅前 50 行)不经过 anydoc。
路径安全: 仅允许读取项目根目录内文件; 敏感文件名拒绝解析; 全部异常捕获并返回结构化错误。
成功结果附 parser 字段标明实际使用的解析器(anydoc / pdfplumber / docx-zipfile / ...)。
"""

from __future__ import annotations

import asyncio
import json
import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber  # 已安装依赖

# ---- anydoc 主路径(Rust 原生解析引擎, 可选依赖, 未安装时降级旧实现) ----
try:
    import anydoc as _anydoc
    from anydoc import ConvertError as _AnydocError

    _ANYDOC_OK: bool = True
except ImportError:  # pragma: no cover - 依赖缺失环境
    _anydoc = None  # type: ignore[assignment]
    _AnydocError = Exception  # type: ignore[assignment,misc]
    _ANYDOC_OK = False

# 显式导出清单(含供 document_asset_tools 复用的 anydoc 别名/辅助函数;
# mypy no_implicit_reexport 严格要求 import 绑定的名字须列于 __all__ 方可再导出)
__all__ = [
    "parse_document",
    "_anydoc",
    "_AnydocError",
    "_resolve_path",
    "_describe_anydoc_error",
]

# anydoc 主路径覆盖的扩展名(含旧实现可降级的 3 种)
_ANYDOC_EXTS: Tuple[str, ...] = (
    ".pdf",
    ".docx",
    ".doc",
    ".pptx",
    ".ppt",
    ".xls",
    ".xlsx",
    ".odt",
    ".ods",
    ".odp",
    ".rtf",
    ".epub",
)
# anydoc 失败后仍有降级实现的扩展名
_ANYDOC_FALLBACK_EXTS: Tuple[str, ...] = (".pdf", ".docx", ".xlsx")

# 项目根目录: 相对路径以它为基准。
# 2026-09-08 修复: 原先硬编码 r"G:\IHUI-AI" 在本部署(项目位于 d:\IHUI-AI)下为
# 死路径, 导致所有绝对路径被判"路径越界"、相对路径落点不存在 → 工具整体不可用。
# 改为按仓库结构动态推导(monorepo 根), 与 chart_tools.py / artifacts.py 惯例一致:
# app/tools/document_tools.py → parents[4] = 仓库根
PROJECT_ROOT: str = os.path.abspath(str(Path(__file__).resolve().parents[4]))

# 敏感文件黑名单子串(对文件名做小写匹配)
SENSITIVE_MARKERS: Tuple[str, ...] = (".env", ".pem", ".key", "credentials", "secret", "token")

# 白名单扩展名 -> 说明
SUPPORTED_EXTENSIONS: Dict[str, str] = {
    ".txt": "纯文本",
    ".md": "Markdown",
    ".csv": "CSV(前50行)",
    ".json": "JSON",
    ".pdf": "PDF(anydoc/pdfplumber)",
    ".docx": "Word文档(anydoc优先)",
    ".doc": "Word文档-老格式(anydoc)",
    ".pptx": "PowerPoint(anydoc)",
    ".ppt": "PowerPoint-老格式(anydoc)",
    ".xlsx": "Excel表格(anydoc优先)",
    ".xls": "Excel表格-老格式(anydoc)",
    ".odt": "OpenDocument文字(anydoc)",
    ".ods": "OpenDocument表格(anydoc)",
    ".odp": "OpenDocument演示(anydoc)",
    ".rtf": "富文本RTF(anydoc)",
    ".epub": "电子书EPUB(anydoc)",
}

DEFAULT_MAX_CHARS: int = 20000
MIN_MAX_CHARS: int = 500
MAX_MAX_CHARS: int = 100000

# OOXML 命名空间
W_NS: str = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
S_NS: str = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _fail(message: str) -> Dict[str, Any]:
    """构造统一的结构化失败响应(不抛异常)。"""
    return {"tool": "parse_document", "ok": False, "message": message}


# anydoc 探测出的 Format 字符串 -> 扩展名(仅带签名的容器;txt/md/json/csv 无格式返回 None)
_SNIFF_FMT_EXT: Dict[str, str] = {
    "docx": ".docx",
    "doc": ".doc",
    "pptx": ".pptx",
    "ppt": ".ppt",
    "xlsx": ".xlsx",
    "xls": ".xls",
    "ods": ".ods",
    "odp": ".odp",
    "odt": ".odt",
    "rtf": ".rtf",
    "epub": ".epub",
    "pdf": ".pdf",
}


def _sniff_anydoc_ext(path: str) -> Tuple[Optional[str], Optional[str]]:
    """用 anydoc 按文件字节探测真实容器格式, 返回 (规范扩展名, 错误)。"""
    try:
        with open(path, "rb") as f:
            data: bytes = f.read()
        fmt = _anydoc.format_from_bytes(data)
        ext = _SNIFF_FMT_EXT.get(fmt or "") if fmt else None
        return ext, None
    except Exception as e:  # noqa: BLE001
        return None, "格式探测失败: {}: {}".format(type(e).__name__, e)


def _describe_anydoc_error(e: BaseException) -> str:
    """把 anydoc 异常翻译为面向用户的中文文案。"""
    name: str = type(e).__name__
    pages = getattr(e, "pages", None)
    if name == "NeedsOcrError":
        if pages:
            page_list: str = ", ".join(str(p) for p in pages)
            return "该 PDF 第 {} 页为扫描件/图片内容, 没有 OCR 无法提取文字".format(page_list)
        return "该文档为扫描件/图片内容, 需要 OCR 才能提取文字"
    if name == "EncryptedError":
        return "文件已加密(含密码保护), 请先解除密码后重试"
    if name == "MalformedError":
        return "文件结构损坏或内容不完整, 无法解析"
    if name == "ResourceLimitError":
        return "文件内容超出解析引擎的安全限制"
    if name == "MissingPartError":
        return "归档不完整, 缺少必要的内部部件(文件可能未上传完整)"
    if name == "UnsupportedError":
        return "不支持的文件格式"
    return "解析失败: {}: {}".format(name, e)


def _resolve_path(raw_path: Any) -> Tuple[Optional[str], Optional[str]]:
    """解析并校验路径, 返回 (绝对路径, 错误消息); 合法时错误消息为 None。"""
    if not isinstance(raw_path, str) or not raw_path.strip():
        return None, "path 参数缺失或为空"
    p: str = raw_path.strip()
    abs_path: str = os.path.abspath(p) if os.path.isabs(p) else os.path.abspath(os.path.join(PROJECT_ROOT, p))
    # 必须位于项目根内, 防止任意文件读取
    # 2026-09-09 修正: 用 normcase 做大小写不敏感比较。Windows 下用户可能传
    # d:\... 而 PROJECT_ROOT 为 D:\...，原字符串等值比较会误判越界。
    try:
        inside: bool = os.path.normcase(
            os.path.commonpath([abs_path, PROJECT_ROOT])
        ) == os.path.normcase(PROJECT_ROOT)
    except ValueError:
        inside = False
    if not inside:
        return None, "路径越界: 仅允许访问项目根目录({})内的文件".format(PROJECT_ROOT)
    if not os.path.exists(abs_path):
        return None, "文件不存在"
    if os.path.isdir(abs_path):
        return None, "该路径是目录而非文件"
    # 敏感文件黑名单
    base_lower: str = os.path.basename(abs_path).lower()
    for marker in SENSITIVE_MARKERS:
        if marker in base_lower:
            return None, "出于安全考虑, 拒绝解析敏感文件(文件名包含敏感标识: {})".format(marker)
    return abs_path, None


def _read_text(path: str) -> str:
    """编码容错读取文本文件: 依次尝试 utf-8 / gbk / latin-1。"""
    last_error: Optional[Exception] = None
    for enc in ("utf-8", "gbk", "latin-1"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read()
        except (UnicodeDecodeError, LookupError) as e:
            last_error = e
    if last_error is not None:
        raise last_error
    raise OSError("无法读取文本文件")


def _parse_csv(content: str) -> str:
    """CSV 解析: 仅保留前 50 行, 并附加总行数统计。"""
    lines: List[str] = content.splitlines()
    total: int = len(lines)
    head: str = "\n".join(lines[:50])
    if total > 50:
        head += "\n...(共 {} 行, 仅显示前 50 行)".format(total)
    return head


def _parse_pdf(path: str) -> Tuple[str, int]:
    """用 pdfplumber 逐页提取 PDF 文本, 返回 (文本, 页数)。"""
    pages_text: List[str] = []
    page_count: int = 0
    with pdfplumber.open(path) as pdf:
        page_count = len(pdf.pages)
        for page in pdf.pages:
            pages_text.append(page.extract_text() or "")
    return "\n".join(pages_text), page_count


def _parse_docx(path: str) -> str:
    """用 zipfile + ElementTree 解析 docx 文本(w:p 分段, w:tab 制表符, w:br 换行)。"""
    with zipfile.ZipFile(path, "r") as zf:
        data: bytes = zf.read("word/document.xml")
    root: ET.Element = ET.fromstring(data)
    paragraphs: List[str] = []
    for p in root.iter("{}p".format(W_NS)):
        parts: List[str] = []
        for node in p.iter():
            tag: str = node.tag
            if tag == "{}t".format(W_NS):
                parts.append(node.text or "")
            elif tag == "{}tab".format(W_NS):
                parts.append("\t")
            elif tag == "{}br".format(W_NS):
                parts.append("\n")
        paragraphs.append("".join(parts))
    return "\n".join(paragraphs)


def _parse_xlsx(path: str) -> str:
    """用 zipfile + ElementTree 解析 xlsx: sharedStrings + 首个 worksheet, 按行输出 TSV(尽力而为)。"""
    with zipfile.ZipFile(path, "r") as zf:
        names: List[str] = zf.namelist()
        # 1) 共享字符串表
        shared: List[str] = []
        if "xl/sharedStrings.xml" in names:
            ss_root: ET.Element = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in ss_root.iter("{}si".format(S_NS)):
                texts: List[str] = [t.text or "" for t in si.iter("{}t".format(S_NS))]
                shared.append("".join(texts))
        # 2) 首个工作表
        sheet_file: Optional[str] = None
        for name in sorted(names):
            if name.startswith("xl/worksheets/") and name.endswith(".xml"):
                sheet_file = name
                break
        if sheet_file is None:
            raise ValueError("xlsx 中未找到工作表")
        sheet_root: ET.Element = ET.fromstring(zf.read(sheet_file))
    rows: List[str] = []
    for row in sheet_root.iter("{}row".format(S_NS)):
        cells: List[str] = []
        for c in row.iter("{}c".format(S_NS)):
            t_attr: Optional[str] = c.get("t")
            v_el: Optional[ET.Element] = c.find("{}v".format(S_NS))
            if t_attr == "inlineStr":  # 内联字符串
                is_el: Optional[ET.Element] = c.find("{}is".format(S_NS))
                val: str = ""
                if is_el is not None:
                    val = "".join(x.text or "" for x in is_el.iter("{}t".format(S_NS)))
                cells.append(val)
            elif t_attr == "s" and v_el is not None and v_el.text is not None:  # 共享字符串索引
                try:
                    idx: int = int(v_el.text)
                    cells.append(shared[idx] if 0 <= idx < len(shared) else "")
                except (ValueError, IndexError):
                    cells.append("")
            else:  # 数字等直接取 v 文本
                cells.append(v_el.text if v_el is not None and v_el.text is not None else "")
        rows.append("\t".join(cells))
    return "\n".join(rows)


async def parse_document(arguments: dict[str, Any]) -> dict[str, Any]:
    """解析本地文档为可注入上下文的文本, 供 LLM 工具调用使用。

    入参: path(必填) / max_chars(可选, 默认 20000, 范围 500-100000)。
    所有异常均被捕获并返回结构化错误, 不向调用方抛出。
    成功结果含 parser 字段(anydoc / pdfplumber / docx-zipfile / xlsx-zipfile / text)。
    """
    try:
        # --- max_chars 参数解析与钳制 ---
        max_chars: int = DEFAULT_MAX_CHARS
        raw_max: Any = arguments.get("max_chars")
        if raw_max is not None:
            try:
                max_chars = int(raw_max)
            except (TypeError, ValueError):
                pass  # 非法值回退默认
        max_chars = max(MIN_MAX_CHARS, min(MAX_MAX_CHARS, max_chars))

        # --- 路径校验 ---
        abs_path, err = _resolve_path(arguments.get("path"))
        if err is not None:
            return _fail(err)
        if abs_path is None:
            return _fail("路径无效")

        ext: str = os.path.splitext(abs_path)[1].lower()
        # 2026-09-09: 无后缀/后缀不识别时, 用 anydoc 运行时字节探测识别真实容器格式
        # (docx/doc/pptx/xlsx/ods 等带签名; txt/md/json/csv 无签名, 探测返回 None → 落回原报错)
        if ext not in SUPPORTED_EXTENSIONS and _ANYDOC_OK:
            sniffed_ext, sniffed_err = _sniff_anydoc_ext(abs_path)
            if sniffed_err:
                return _fail(sniffed_err)
            if sniffed_ext and sniffed_ext in _ANYDOC_EXTS:
                ext = sniffed_ext  # 用真实格式继续解析
        if ext not in SUPPORTED_EXTENSIONS:
            return _fail("不支持的格式({}); 仅支持: {}".format(ext or "无扩展名", ", ".join(SUPPORTED_EXTENSIONS)))

        filename: str = os.path.basename(abs_path)
        content: str = ""
        pages: Optional[int] = None
        warning: str = ""
        parser: str = ""

        if ext in (".txt", ".md"):
            content = _read_text(abs_path)
            parser = "text"
        elif ext == ".csv":
            content = _parse_csv(_read_text(abs_path))
            parser = "csv"
        elif ext == ".json":
            content = _read_text(abs_path)
            parser = "json"
            try:
                json.loads(content)
            except json.JSONDecodeError as e:
                warning = "JSON 格式校验失败: {}".format(e)
        elif ext in _ANYDOC_EXTS:
            # ---- anydoc 主路径(Rust 引擎, 线程池执行避免阻塞事件循环) ----
            anydoc_note: str = ""
            if _ANYDOC_OK:
                try:
                    content = await asyncio.to_thread(_anydoc.to_markdown, abs_path)
                    parser = "anydoc"
                except _AnydocError as e:
                    anydoc_note = _describe_anydoc_error(e)
                if not content and not anydoc_note:
                    anydoc_note = "anydoc 解析结果为空(文档可能无文本内容)"
                if anydoc_note and ext not in _ANYDOC_FALLBACK_EXTS:
                    return _fail(anydoc_note)
            if not content:
                # ---- 旧实现降级(仅 pdf/docx/xlsx); 新格式无降级 ----
                if ext == ".pdf":
                    content, pages = _parse_pdf(abs_path)
                    parser = "pdfplumber"
                elif ext == ".docx":
                    content = _parse_docx(abs_path)
                    parser = "docx-zipfile"
                elif ext == ".xlsx":
                    content = _parse_xlsx(abs_path)
                    parser = "xlsx-zipfile"
                else:
                    return _fail("文档解析引擎不可用(anydoc 模块未安装), 无法解析该格式")
                if anydoc_note:
                    warning = "anydoc 失败({}), 已由旧实现兜底".format(anydoc_note)

        # --- 截断与消息组装 ---
        total_chars: int = len(content)
        truncated: bool = total_chars > max_chars
        if truncated:
            content = content[:max_chars]

        message: str = "解析成功"
        if truncated:
            message = "已截断, 全文共 {} 字符".format(total_chars)
        if warning:
            message += "; " + warning

        return {
            "tool": "parse_document",
            "ok": True,
            "filename": filename,
            "extension": ext.lstrip("."),
            "parser": parser,
            "content": content,
            "chars": len(content),
            "pages": pages,
            "truncated": truncated,
            "message": message,
        }
    except Exception as e:  # noqa: BLE001 全部捕获, 保证不向上抛异常
        return _fail("解析失败: {}: {}".format(type(e).__name__, e))
