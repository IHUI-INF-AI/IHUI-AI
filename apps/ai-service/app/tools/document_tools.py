# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""文档解析工具(parse_document): 将本地文档解析为可注入 LLM 上下文的纯文本。

支持的格式(白名单): txt / md / csv / json / pdf / docx / xlsx。
- txt/md/csv/json: 文本直接读取, 编码容错 utf-8 -> gbk -> latin-1;
- pdf: 使用 pdfplumber 逐页提取;
- docx: 使用 Python 标准库 zipfile + xml.etree.ElementTree 解析 word/document.xml;
- xlsx: 使用 zipfile + ElementTree 解析 sharedStrings 与首个 worksheet, 输出 TSV。
路径安全: 仅允许读取项目根目录内文件; 敏感文件名拒绝解析; 全部异常捕获并返回结构化错误。
"""

from __future__ import annotations

import json
import os
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

import pdfplumber  # 已安装依赖

# 项目根目录: 相对路径以它为基准
PROJECT_ROOT: str = os.path.abspath(r"G:\IHUI-AI")

# 敏感文件黑名单子串(对文件名做小写匹配)
SENSITIVE_MARKERS: Tuple[str, ...] = (".env", ".pem", ".key", "credentials", "secret", "token")

# 白名单扩展名 -> 说明
SUPPORTED_EXTENSIONS: Dict[str, str] = {
    ".txt": "纯文本",
    ".md": "Markdown",
    ".csv": "CSV(前50行)",
    ".json": "JSON",
    ".pdf": "PDF(pdfplumber)",
    ".docx": "Word文档(zipfile+XML)",
    ".xlsx": "Excel表格(zipfile+XML)",
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


def _resolve_path(raw_path: Any) -> Tuple[Optional[str], Optional[str]]:
    """解析并校验路径, 返回 (绝对路径, 错误消息); 合法时错误消息为 None。"""
    if not isinstance(raw_path, str) or not raw_path.strip():
        return None, "path 参数缺失或为空"
    p: str = raw_path.strip()
    abs_path: str = os.path.abspath(p) if os.path.isabs(p) else os.path.abspath(os.path.join(PROJECT_ROOT, p))
    # 必须位于项目根内, 防止任意文件读取
    try:
        inside: bool = os.path.commonpath([abs_path, PROJECT_ROOT]) == PROJECT_ROOT
    except ValueError:
        inside = False
    if not inside:
        return None, "路径越界: 仅允许访问项目根目录(G:\\IHUI-AI)内的文件"
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


async def parse_document(arguments: dict) -> dict:
    """解析本地文档为可注入上下文的文本, 供 LLM 工具调用使用。

    入参: path(必填) / max_chars(可选, 默认 20000, 范围 500-100000)。
    所有异常均被捕获并返回结构化错误, 不向调用方抛出。
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
        if ext not in SUPPORTED_EXTENSIONS:
            return _fail("不支持的格式({}); 仅支持: {}".format(ext or "无扩展名", ", ".join(SUPPORTED_EXTENSIONS)))

        filename: str = os.path.basename(abs_path)
        content: str = ""
        pages: Optional[int] = None
        warning: str = ""

        if ext in (".txt", ".md"):
            content = _read_text(abs_path)
        elif ext == ".csv":
            content = _parse_csv(_read_text(abs_path))
        elif ext == ".json":
            content = _read_text(abs_path)
            try:
                json.loads(content)
            except json.JSONDecodeError as e:
                warning = "JSON 格式校验失败: {}".format(e)
        elif ext == ".pdf":
            content, pages = _parse_pdf(abs_path)
        elif ext == ".docx":
            content = _parse_docx(abs_path)
        elif ext == ".xlsx":
            content = _parse_xlsx(abs_path)

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
            "content": content,
            "chars": len(content),
            "pages": pages,
            "truncated": truncated,
            "message": message,
        }
    except Exception as e:  # noqa: BLE001 全部捕获, 保证不向上抛异常
        return _fail("解析失败: {}: {}".format(type(e).__name__, e))
