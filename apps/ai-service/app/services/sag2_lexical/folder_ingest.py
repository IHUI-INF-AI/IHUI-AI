# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 本地文件夹登记与增量扫描（本仓自有实现）。

取证自对照程序 SAG Wiki（MIT，v0.2.7）的「Add a local folder」行为：
用户选一个本地文件夹，文件留在原处，索引侧只登记路径与字符区间；
再扫描靠 ``mtime/size`` 预筛、``sha256`` 终判，未变更文件**不读盘、不重建**；
单个文件解析失败只记一条具名原因，不拖垮整轮扫描。

与对照的差异（本仓取舍，不冒充对齐）：
- 对照把这一层做进 Tauri/Rust 的常驻 watcher；本仓是服务端多租户，
  轮询 watcher 默认**关闭**（``SAG2_FOLDER_WATCH=1`` 才开），
  默认路径是「幂等扫描」由调用方/定时器驱动，避免常驻线程拖累服务。
- 解析优先用标准库（txt/md/html/csv/json/docx/xlsx/epub 全部零依赖）；
  PDF 需要 ``pdfplumber``、其余格式可选 ``anydoc``，缺依赖时该文件记
  ``unsupported`` 并写明缺哪个包，**不静默跳过**。
- 文件夹登记表默认只在进程内；设 ``SAG2_FOLDER_STATE`` 指向 JSON 才落盘，
  返回体里用 ``persisted`` 显式自证，不让调用方误以为重启后还在。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
import zipfile
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any
from xml.etree import ElementTree as ET

# 忽略目录：与 codebase_indexer 同一条判据（单源复用，不另抄一份常量）。
from ..codebase_indexer import _IGNORED_DIRS as IGNORED_DIRS
from .fs_watch import DirWatcher
from .index import sha256_text
from .media_text import MEDIA_SUFFIXES, transcribe_media
from .ocr_text import IMAGE_SUFFIXES, ocr_image, ocr_pdf
from .pdf_raster import extract_text_pdfium
from .pdf_text import extract_pdf_text
from .service import Sag2LexicalService

logger = logging.getLogger(__name__)

#: 默认可解析扩展名。PDF 需要 pdfplumber；epub/docx/xlsx 走标准库 zipfile。
DEFAULT_INCLUDE: tuple[str, ...] = (
    ".md",
    ".markdown",
    ".txt",
    ".rst",
    ".log",
    ".csv",
    ".json",
    ".html",
    ".htm",
    ".docx",
    ".xlsx",
    ".epub",
    ".pdf",
)

#: 纯文本直读（带编码容错），不必走解析器。
_TEXT_SUFFIXES = frozenset({".md", ".markdown", ".txt", ".rst", ".log", ".csv", ".json"})

#: 单文件读取上限：超过只记 ``too-large``，不截断后冒充完整入索引。
MAX_FILE_BYTES = 8 * 1024 * 1024

#: 单轮扫描文件数上限（防止误选根目录把整块磁盘拖进来）。
MAX_FILES_PER_SCAN = 5000

#: 疑似二进制判定窗口（前 4 KiB 出现 NUL 即判二进制）。
_BINARY_SNIFF_BYTES = 4096
_ENCODINGS = ("utf-8", "gbk", "latin-1")


class _HtmlText(HTMLParser):
    """把 HTML 粗粒度压成正文；``<title>`` 单独取出当文档标题。"""

    _SKIP = frozenset({"script", "style", "noscript", "template", "svg"})
    _BREAK = frozenset(
        {
            "p",
            "div",
            "br",
            "li",
            "tr",
            "section",
            "article",
            "header",
            "footer",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "blockquote",
            "pre",
        }
    )

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self._skip_depth = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self._SKIP:
            self._skip_depth += 1
        elif tag == "title":
            self._in_title = True
        if tag in self._BREAK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP and self._skip_depth > 0:
            self._skip_depth -= 1
        elif tag == "title":
            self._in_title = False
        if tag in self._BREAK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return
        if self._in_title:
            self.title_parts.append(data)
            return
        stripped = data.strip()
        if stripped:
            self.parts.append(stripped)
            self.parts.append(" ")

    def text(self) -> str:
        raw = "".join(self.parts)
        lines = [line.strip() for line in raw.splitlines()]
        return "\n".join(line for line in lines if line)

    def title(self) -> str:
        return " ".join("".join(self.title_parts).split())


@dataclass
class FolderEntry:
    """一条文件夹登记。文件留在原处，这里只记检索范围。"""

    root: str
    include: tuple[str, ...] = DEFAULT_INCLUDE
    exclude: tuple[str, ...] = ()
    recursive: bool = True
    added_at: float = field(default_factory=time.time)
    last_scan_at: float = 0.0
    last_scan: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "root": self.root,
            "include": list(self.include),
            "exclude": list(self.exclude),
            "recursive": self.recursive,
            "added_at": round(self.added_at, 3),
            "last_scan_at": round(self.last_scan_at, 3),
            "last_scan": dict(self.last_scan),
        }


@dataclass
class ScanStats:
    """一轮扫描的**算术自证**：每个文件恰好落进一个桶。"""

    scanned: int = 0
    changed: int = 0
    unchanged: int = 0
    unsupported: int = 0
    failed: int = 0
    too_large: int = 0
    chunks: int = 0
    duration_ms: float = 0.0
    errors: list[dict[str, str]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scanned": self.scanned,
            "changed": self.changed,
            "unchanged": self.unchanged,
            "unsupported": self.unsupported,
            "failed": self.failed,
            "too_large": self.too_large,
            "chunks": self.chunks,
            "duration_ms": round(self.duration_ms, 3),
            "errors": list(self.errors),
            "buckets_sum": (
                self.changed
                + self.unchanged
                + self.unsupported
                + self.failed
                + self.too_large
            ),
        }


def _read_text_any(path: str) -> str:
    """编码容错读取：utf-8 → gbk → latin-1，全部失败才抛。"""
    last: Exception | None = None
    for enc in _ENCODINGS:
        try:
            with open(path, encoding=enc) as handle:
                return handle.read()
        except (UnicodeDecodeError, LookupError) as exc:  # pragma: no cover - 取决于磁盘字节
            last = exc
    if last is not None:
        raise last
    raise OSError("无法读取文本文件")


def _looks_binary(path: str) -> bool:
    with open(path, "rb") as handle:
        head = handle.read(_BINARY_SNIFF_BYTES)
    return b"\x00" in head


def _docx_text(path: str) -> str:
    """docx：标准库 zipfile + ElementTree，按 w:p 分段。"""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    with zipfile.ZipFile(path) as zf:
        data = zf.read("word/document.xml")
    root = ET.fromstring(data)
    paragraphs: list[str] = []
    for para in root.iter(f"{ns}p"):
        parts: list[str] = []
        for node in para.iter():
            if node.tag == f"{ns}t":
                parts.append(node.text or "")
            elif node.tag == f"{ns}tab":
                parts.append("\t")
            elif node.tag == f"{ns}br":
                parts.append("\n")
        paragraphs.append("".join(parts))
    return "\n".join(paragraphs)


def _xlsx_text(path: str) -> str:
    """xlsx：标准库解析共享字符串 + 首个工作表，按行输出 TSV。"""
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    with zipfile.ZipFile(path) as zf:
        names = zf.namelist()
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            ss_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in ss_root.iter(f"{ns}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{ns}t")))
        sheet = next(
            (
                name
                for name in sorted(names)
                if name.startswith("xl/worksheets/") and name.endswith(".xml")
            ),
            None,
        )
        if sheet is None:
            raise ValueError("xlsx 中未找到工作表")
        sheet_root = ET.fromstring(zf.read(sheet))
    rows: list[str] = []
    for row in sheet_root.iter(f"{ns}row"):
        cells: list[str] = []
        for cell in row.iter(f"{ns}c"):
            kind = cell.get("t")
            value_el = cell.find(f"{ns}v")
            if kind == "inlineStr":
                inline = cell.find(f"{ns}is")
                cells.append(
                    "".join(x.text or "" for x in inline.iter(f"{ns}t"))
                    if inline is not None
                    else ""
                )
            elif kind == "s" and value_el is not None and value_el.text is not None:
                try:
                    idx = int(value_el.text)
                except ValueError:
                    cells.append("")
                else:
                    cells.append(shared[idx] if 0 <= idx < len(shared) else "")
            else:
                cells.append(
                    value_el.text if value_el is not None and value_el.text is not None else ""
                )
        rows.append("\t".join(cells))
    return "\n".join(rows)


def _epub_text(path: str) -> str:
    """epub：标准库解 zip，按 spine 顺序抽 xhtml 正文。"""
    with zipfile.ZipFile(path) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith((".xhtml", ".html", ".htm"))]
        chunks: list[str] = []
        for name in sorted(names):
            parser = _HtmlText()
            parser.feed(zf.read(name).decode("utf-8", errors="replace"))
            body = parser.text()
            if body:
                chunks.append(body)
    return "\n\n".join(chunks)


def _pdf_text(path: str) -> str:
    """PDF 兜底：需要 pdfplumber（可选依赖）；缺依赖抛 ImportError 由调用方具名登记。

    主路径是零依赖的 ``pdf_text.extract_pdf_text``：只有它判失败（加密 /
    无 ToUnicode 的 CID 字体 / 对象流）时才走到这里再试一次。
    """
    import pdfplumber  # noqa: PLC0415 - 可选依赖，按需导入

    pages: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n".join(pages)


def _pdf_fail_reason(chain: list[str]) -> str:
    """PDF 四级抽取链全部失败时的最终原因。

    「每一级为什么失败」逐条保留（自研 → pdfium → pdfplumber → 栅格化 OCR），
    不做归并：只有看到 ``no-text-layer`` 才知道该去 OCR，只有看到
    ``encrypted`` 才知道 OCR 也没用（得先要密码）。

    若整条链都停在「没有文本层」，追加 ``needs-ocr:pdf`` 标记，让上层能统计
    「这批文件读不到」而不是当它不存在。
    """
    detail = ";".join(part for part in chain if part) or "empty"
    if "needs-ocr" in detail:
        return detail
    scanned = any(
        marker in part
        for part in chain
        for marker in ("no-text-layer", "garbled", "cid-unsupported")
    )
    if not scanned:
        # 加密/打不开的文件不是「需要 OCR」，是要密码或换文件 —— 别给错指引。
        return detail
    return f"{detail};needs-ocr:pdf"


def _extract_pdf(path: str) -> tuple[str | None, str, str]:
    """PDF 四级抽取链，每一级失败原因都留痕。

    1. **零依赖自研**（``pdf_text``）：覆盖无加密、非对象流的常见 PDF，最快；
    2. **pdfium**（``pdf_raster``）：覆盖对象流/ xref 流（PDF 1.5+ 常见）与
       「加密但空用户密码」的公文 —— 这两类自研解析器读不到；
    3. **pdfplumber**：前两级都抽空时的通用兜底（版面感知，慢但稳）；
    4. **栅格化 + OCR**：前三层都判定「没有文本层」⇒ 这是扫描件，用 pdfium
       把页渲成位图再交给 OCR 引擎。

    任何一级成功即返回，并把该级的附注（截断/部分页/回落语言）原样带出；
    全链失败时给出一条能直接读懂「下一步该做什么」的原因串。
    """
    chain: list[str] = []

    builtin, reason = extract_pdf_text(path)
    if builtin is not None and builtin.strip():
        return builtin, "pdf-builtin", ""
    chain.append(f"builtin:{reason or 'empty'}")

    pdfium_text, pdfium_reason = extract_text_pdfium(path)
    if pdfium_text is not None and pdfium_text.strip():
        # 附注（truncated:N/Mpages）在 reason 里带给上层，不悄悄截断。
        return pdfium_text, "pdf-pdfium", pdfium_reason
    chain.append(f"pdfium:{pdfium_reason or 'empty'}")

    try:
        fallback = _pdf_text(path)
    except ImportError:
        chain.append("pdfplumber:not-installed")
    except Exception as exc:  # noqa: BLE001 - 兜底失败也要报具体原因
        chain.append(f"pdfplumber-failed:{type(exc).__name__}")
    else:
        if fallback.strip():
            return fallback, "pdfplumber", ""
        chain.append("pdfplumber:empty")

    # 走到这里说明三个文本层抽取器都没拿到字：扫描件的可能性最高。
    ocr_text_value, ocr_parser, ocr_reason = ocr_pdf(path)
    if ocr_text_value is not None and ocr_text_value.strip():
        return ocr_text_value, ocr_parser, ocr_reason
    chain.append(f"ocr:{ocr_reason or 'empty'}")

    return None, "none", _pdf_fail_reason(chain)


def extract_text(path: str) -> tuple[str | None, str, str]:
    """抽取正文 → ``(text, parser, reason)``。

    ``text is None`` 时 ``parser`` 为 ``"none"``，``reason`` 是具名原因
    （``unsupported:<后缀>`` / ``missing-dep:<包>`` / ``binary`` / ``empty`` / ...）。
    """
    suffix = os.path.splitext(path)[1].lower()
    try:
        if suffix in _TEXT_SUFFIXES:
            if _looks_binary(path):
                return None, "none", "binary"
            text = _read_text_any(path)
            return (text, "text", "") if text.strip() else (None, "none", "empty")
        if suffix in {".html", ".htm"}:
            parser = _HtmlText()
            parser.feed(_read_text_any(path))
            body = parser.text()
            title = parser.title()
            if title and not body.startswith(title):
                body = f"{title}\n{body}" if body else title
            return (body, "html", "") if body.strip() else (None, "none", "empty")
        if suffix == ".docx":
            text = _docx_text(path)
            return (text, "docx-zipfile", "") if text.strip() else (None, "none", "empty")
        if suffix == ".xlsx":
            text = _xlsx_text(path)
            return (text, "xlsx-zipfile", "") if text.strip() else (None, "none", "empty")
        if suffix == ".epub":
            text = _epub_text(path)
            return (text, "epub-zipfile", "") if text.strip() else (None, "none", "empty")
        if suffix == ".pdf":
            return _extract_pdf(path)
        if suffix in IMAGE_SUFFIXES:
            return ocr_image(path)
        if suffix in MEDIA_SUFFIXES:
            return transcribe_media(path)
        return None, "none", f"unsupported:{suffix or '<noext>'}"
    except (OSError, zipfile.BadZipFile, ET.ParseError, ValueError) as exc:
        return None, "none", f"parse-error:{type(exc).__name__}"


class FolderIngest:
    """文件夹登记表 + 幂等增量扫描。

    扫描是**单线程同步**的 CPU/IO 活，API 层必须放 ``asyncio.to_thread``，
    不在事件循环里跑（大目录会把整个服务卡住）。
    """

    def __init__(self, service: Sag2LexicalService, *, state_path: str | None = None) -> None:
        self.service = service
        self.state_path = (state_path or os.environ.get("SAG2_FOLDER_STATE", "")).strip()
        self._folders: dict[str, FolderEntry] = {}
        #: path → (mtime_ns, size, doc_hash)：命中即**不读盘**，这是对照的预筛语义。
        self._seen: dict[str, tuple[int, int, str]] = {}
        self._watch_tasks: dict[str, Any] = {}
        #: 真事件监听器（path → DirWatcher）；拿不到操作系统事件时为空，走 _watch_tasks 轮询。
        self._watchers: dict[str, DirWatcher] = {}
        self._watch_rescan: dict[str, Any] = {}
        self._load_state()

    # -- 登记面 -------------------------------------------------------------

    def register(
        self,
        root: str,
        *,
        include: list[str] | None = None,
        exclude: list[str] | None = None,
        recursive: bool = True,
    ) -> dict[str, Any]:
        """登记一个本地文件夹（必须存在的绝对目录）。"""
        abs_root = os.path.abspath(root)
        if not os.path.isabs(root):
            return {"registered": False, "reason": "root 必须是绝对路径"}
        if not os.path.isdir(abs_root):
            return {"registered": False, "reason": f"目录不存在: {abs_root}"}
        suffixes = tuple(
            s if s.startswith(".") else f".{s}" for s in (include or DEFAULT_INCLUDE)
        )
        entry = FolderEntry(
            root=abs_root,
            include=suffixes,
            exclude=tuple(exclude or ()),
            recursive=recursive,
        )
        self._folders[abs_root] = entry
        self._save_state()
        return {"registered": True, "folder": entry.to_dict(), "persisted": bool(self.state_path)}

    def unregister(self, root: str) -> dict[str, Any]:
        """注销登记，并把该根下已入索引的文档一并移除（不留孤儿片）。"""
        abs_root = os.path.abspath(root)
        entry = self._folders.pop(abs_root, None)
        if entry is None:
            return {"unregistered": False, "reason": f"未登记: {abs_root}", "removed": 0}
        self._stop_watch(abs_root)
        removed = 0
        for path in list(self._seen):
            if self._under(path, abs_root):
                if self.service.remove_document(path).get("removed"):
                    removed += 1
                self._seen.pop(path, None)
        self._save_state()
        return {"unregistered": True, "removed": removed, "persisted": bool(self.state_path)}

    def list_folders(self) -> dict[str, Any]:
        watching = sorted(set(self._watch_tasks) | set(self._watchers))
        return {
            "folders": [entry.to_dict() for entry in self._folders.values()],
            "persisted": bool(self.state_path),
            "state_path": self.state_path,
            "watching": watching,
            # 每个根实际生效的监听模式：真事件 / 轮询，绝不笼统地都叫「监听中」。
            "watch_modes": {
                root: (self._watchers[root].mode if root in self._watchers else "polling")
                for root in watching
            },
        }

    # -- 扫描面 -------------------------------------------------------------

    def scan(self, root: str | None = None, *, force: bool = False) -> dict[str, Any]:
        """增量扫描；``root`` 为空扫全部登记项，``force`` 忽略 mtime/size 预筛。"""
        started = time.perf_counter()
        if root is None:
            entries = list(self._folders.values())
            if not entries:
                return {
                    "scanned_roots": 0,
                    "scanned": 0,
                    "reason": "尚未登记任何文件夹（先 POST /api/v1/ai/sag2/folders）",
                    "duration_ms": round((time.perf_counter() - started) * 1000.0, 3),
                }
        else:
            abs_root = os.path.abspath(root)
            entry = self._folders.get(abs_root)
            if entry is None:
                return {
                    "scanned_roots": 0,
                    "scanned": 0,
                    "reason": f"未登记: {abs_root}",
                    "duration_ms": round((time.perf_counter() - started) * 1000.0, 3),
                }
            entries = [entry]

        total = ScanStats()
        per_root: list[dict[str, Any]] = []
        budget = MAX_FILES_PER_SCAN
        for entry in entries:
            stats = ScanStats()
            for path in self._iter_files(entry):
                if budget <= 0:
                    stats.errors.append(
                        {
                            "path": entry.root,
                            "reason": f"scan-budget:{MAX_FILES_PER_SCAN} 个文件后停止，剩余待下一轮",
                        }
                    )
                    break
                budget -= 1
                self._ingest_one(path, stats, force=force)
            stats.duration_ms = round((time.perf_counter() - started) * 1000.0, 3)
            entry.last_scan_at = time.time()
            entry.last_scan = stats.to_dict()
            per_root.append({"root": entry.root, **stats.to_dict()})
            total.scanned += stats.scanned
            total.changed += stats.changed
            total.unchanged += stats.unchanged
            total.unsupported += stats.unsupported
            total.failed += stats.failed
            total.too_large += stats.too_large
            total.chunks += stats.chunks
            total.errors.extend(stats.errors)
        self._save_state()
        total.duration_ms = round((time.perf_counter() - started) * 1000.0, 3)
        payload = total.to_dict()
        payload["scanned_roots"] = len(entries)
        payload["roots"] = per_root
        payload["index"] = self.service.status()
        return payload

    def _ingest_one(self, path: str, stats: ScanStats, *, force: bool) -> None:
        stats.scanned += 1
        try:
            stat = os.stat(path)
        except OSError as exc:
            stats.failed += 1
            stats.errors.append({"path": path, "reason": f"stat-error:{exc.errno}"})
            return
        if stat.st_size > MAX_FILE_BYTES:
            stats.too_large += 1
            stats.errors.append(
                {"path": path, "reason": f"too-large:{stat.st_size}B > {MAX_FILE_BYTES}B"}
            )
            return

        cache_key = (stat.st_mtime_ns, stat.st_size, "")
        previous = self._seen.get(path)
        if (
            not force
            and previous is not None
            and previous[0] == cache_key[0]
            and previous[1] == cache_key[1]
            and self._indexed(path, previous[2])
        ):
            stats.unchanged += 1
            return

        text, _parser, reason = extract_text(path)
        if text is None:
            if reason.startswith("unsupported:") or reason.startswith("missing-dep:"):
                stats.unsupported += 1
            else:
                stats.failed += 1
            stats.errors.append({"path": path, "reason": reason})
            return

        outcome = self.service.add_document(path, text, title=self._title_for(path, text))
        doc_hash = str(outcome.get("doc_hash", ""))
        self._seen[path] = (stat.st_mtime_ns, stat.st_size, doc_hash)
        if outcome.get("changed"):
            stats.changed += 1
            stats.chunks += int(outcome.get("chunk_count", 0) or 0)
        else:
            stats.unchanged += 1

    def _indexed(self, path: str, doc_hash: str) -> bool:
        """索引里该路径仍挂着同一 hash：防止「登记表说没变、索引已被删」的假跳过。"""
        if not doc_hash:
            return False
        getter = getattr(self.service.index, "document_hash", None)
        if callable(getter):
            return str(getter(path) or "") == doc_hash
        return True

    # -- 遍历面 -------------------------------------------------------------

    def _iter_files(self, entry: FolderEntry) -> list[str]:
        """按登记规则列出候选文件；忽略目录与排除项在此一次性剪掉。"""
        found: list[str] = []
        excludes = tuple(entry.exclude)
        if entry.recursive:
            for current, dirs, files in os.walk(entry.root):
                dirs[:] = sorted(d for d in dirs if d not in IGNORED_DIRS)
                for name in sorted(files):
                    full = os.path.join(current, name)
                    if self._accept(full, entry.include, excludes):
                        found.append(full)
                if len(found) >= MAX_FILES_PER_SCAN:
                    return found[:MAX_FILES_PER_SCAN]
        else:
            for name in sorted(os.listdir(entry.root)):
                full = os.path.join(entry.root, name)
                if os.path.isfile(full) and self._accept(full, entry.include, excludes):
                    found.append(full)
        return found

    @staticmethod
    def _accept(path: str, include: tuple[str, ...], exclude: tuple[str, ...]) -> bool:
        lowered = path.lower()
        if any(token.lower() in lowered for token in exclude):
            return False
        return os.path.splitext(lowered)[1] in include

    @staticmethod
    def _title_for(path: str, text: str) -> str:
        stem = os.path.basename(path)
        first = next((line.strip() for line in text.splitlines() if line.strip()), "")
        if first.startswith("#"):
            heading = first.lstrip("#").strip()
            return heading or stem
        return stem

    @staticmethod
    def _under(path: str, root: str) -> bool:
        try:
            return os.path.commonpath([os.path.abspath(path), root]) == root
        except ValueError:  # pragma: no cover - 不同盘符
            return False

    # -- 监听面：真事件优先，拿不到才退轮询 --------------------------------

    def start_watch(
        self,
        root: str,
        *,
        interval_s: float = 30.0,
        real: bool = True,
        debounce_ms: int = 600,
    ) -> dict[str, Any]:
        """开启监听；``real=True`` 优先走操作系统事件，失败才退轮询。

        返回里的 ``mode`` 是**实际生效**的模式，不修饰：
        ``win32-rdc`` / ``linux-inotify``（真事件）、``polling``（退而求其次）。
        """
        abs_root = os.path.abspath(root)
        if abs_root not in self._folders:
            return {"watching": False, "reason": f"未登记: {abs_root}"}
        self._stop_watch(abs_root)
        loop = asyncio.get_running_loop()

        if real:
            def _notify(paths: list[str]) -> None:
                # 监听线程 → 事件循环：只做「叫醒」，扫描仍在 to_thread 里跑。
                try:
                    loop.call_soon_threadsafe(self._schedule_rescan, abs_root)
                except RuntimeError:  # pragma: no cover - 循环已关（服务退出中）
                    pass

            watcher = DirWatcher(abs_root, _notify, debounce_ms=debounce_ms)
            mode = watcher.start()
            if mode != "unavailable":
                self._watchers[abs_root] = watcher
                return {
                    "watching": True,
                    "mode": mode,
                    "root": abs_root,
                    "debounce_ms": max(0, int(debounce_ms)),
                }

        interval = max(5.0, float(interval_s))

        async def _loop() -> None:
            while True:
                await asyncio.sleep(interval)
                try:
                    await asyncio.to_thread(self.scan, abs_root)
                except Exception:  # noqa: BLE001 - watcher 不允许把服务拖崩
                    continue

        self._watch_tasks[abs_root] = loop.create_task(_loop())
        return {
            "watching": True,
            "mode": "polling",
            "root": abs_root,
            "interval_s": interval,
            "reason": "操作系统事件不可用，已退化为轮询",
        }

    def _schedule_rescan(self, root: str) -> None:
        """在事件循环里合并重扫请求：同一根同时只跑一次扫描。"""
        running = self._watch_rescan.get(root)
        if running is not None and not running.done():
            return

        async def _run() -> None:
            try:
                await asyncio.to_thread(self.scan, root)
            except Exception:  # noqa: BLE001 - 监听不许把服务拖崩
                logger.exception("监听到变化后重扫失败: %s", root)

        self._watch_rescan[root] = asyncio.get_running_loop().create_task(_run())

    def stop_watch(self, root: str) -> dict[str, Any]:
        abs_root = os.path.abspath(root)
        stopped = self._stop_watch(abs_root)
        return {"watching": False, "stopped": stopped, "root": abs_root}

    def _stop_watch(self, root: str) -> bool:
        stopped = False
        watcher = self._watchers.pop(root, None)
        if watcher is not None:
            watcher.stop()
            stopped = True
        task = self._watch_tasks.pop(root, None)
        if task is not None:
            task.cancel()
            stopped = True
        rescan = self._watch_rescan.pop(root, None)
        if rescan is not None:
            rescan.cancel()
        return stopped

    # -- 持久化（可选） -----------------------------------------------------

    def _load_state(self) -> None:
        if not self.state_path or not os.path.isfile(self.state_path):
            return
        try:
            with open(self.state_path, encoding="utf-8") as handle:
                raw = json.load(handle)
        except (OSError, ValueError):
            return
        for item in raw.get("folders", []):
            if not isinstance(item, dict):
                continue
            root = str(item.get("root", ""))
            if not root:
                continue
            self._folders[root] = FolderEntry(
                root=root,
                include=tuple(item.get("include") or DEFAULT_INCLUDE),
                exclude=tuple(item.get("exclude") or ()),
                recursive=bool(item.get("recursive", True)),
            )
        for path, value in (raw.get("seen") or {}).items():
            if isinstance(value, list) and len(value) == 3:
                try:
                    self._seen[str(path)] = (int(value[0]), int(value[1]), str(value[2]))
                except (TypeError, ValueError):
                    continue

    def _save_state(self) -> None:
        if not self.state_path:
            return
        payload = {
            "folders": [entry.to_dict() for entry in self._folders.values()],
            "seen": {path: list(value) for path, value in self._seen.items()},
        }
        try:
            parent = os.path.dirname(self.state_path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            tmp = f"{self.state_path}.tmp"
            with open(tmp, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False)
            os.replace(tmp, self.state_path)
        except OSError:  # pragma: no cover - 只影响持久化，不影响本轮扫描
            return

    # -- 只读观测 -----------------------------------------------------------

    def fingerprint_count(self) -> int:
        return len(self._seen)


def sha256_bytes(path: str) -> str:
    """按块读文件算 hash（仅测试与外部校验用；入索引走文本 hash）。"""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def build_folder_ingest(service: Sag2LexicalService) -> FolderIngest:
    return FolderIngest(service)


__all__ = [
    "DEFAULT_INCLUDE",
    "FolderEntry",
    "FolderIngest",
    "MAX_FILE_BYTES",
    "MAX_FILES_PER_SCAN",
    "ScanStats",
    "build_folder_ingest",
    "extract_text",
    "sha256_bytes",
    "sha256_text",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
