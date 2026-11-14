# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Office 文档转换 / 页面渲染 / 工作簿重算(对标 dsh-office-kit + dsh-tool-office)。

设计边界(与 DSH 桌面端的关键差异,也是本模块的取舍):
  - **默认关闭**:仅当部署方显式设置 ``MCP_OFFICE_TOOLS_ENABLED=true`` 且宿主机
    装有 LibreOffice 时可用;缺失/关闭一律返回 ``unavailable`` 或 ``disabled``,
    绝不偷偷改用系统 soffice/npx/在线转换器(DSH README 的同一条纪律)。
  - **不写工作区**:所有产物落在私有临时目录(``ihui-office-*``),24h 后清理;
    输入文件只读,调用方需要时自行复制。
  - **有界**:并发 2、单次超时、输入/输出字节上限、渲染页数/像素/总字节上限;
    超限直接拒绝,不静默截断(与 DSH office-kit 的 admission 语义一致)。
  - **不做宏/脚本**:只调用 ``soffice --headless --convert-to``,不接受任意命令行参数。
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

WORD_EXTS = frozenset({".doc", ".docx", ".odt", ".rtf", ".txt"})
SHEET_EXTS = frozenset({".xls", ".xlsx", ".ods", ".csv"})
SLIDES_EXTS = frozenset({".ppt", ".pptx", ".odp"})
OFFICE_EXTS = WORD_EXTS | SHEET_EXTS | SLIDES_EXTS | {".pdf"}

WORD_TARGETS = frozenset({"pdf", "docx", "odt", "txt"})
SHEET_TARGETS = frozenset({"pdf", "xlsx", "ods", "csv"})
SLIDES_TARGETS = frozenset({"pdf", "pptx", "odp"})

MAX_INPUT_BYTES = 50 * 1024 * 1024
MAX_OUTPUT_BYTES = 100 * 1024 * 1024
MAX_RENDER_PAGES = 20
MAX_RENDER_PIXELS = 8_388_608
MAX_RENDER_BYTES = 32 * 1024 * 1024
OUTPUT_RETENTION_SECONDS = 24 * 60 * 60

_SLOTS = threading.BoundedSemaphore(2)
_SOFFICE_CACHE: tuple[str | None, str] | None = None


def _tool_enabled() -> bool:
    value = (os.environ.get("MCP_OFFICE_TOOLS_ENABLED", "false") or "").strip().lower()
    return value in ("1", "true", "yes", "on")


def find_soffice() -> tuple[str | None, str]:
    """定位 LibreOffice 可执行文件;返回 ``(路径, 原因)``,找不到时路径为 None。"""
    global _SOFFICE_CACHE
    if _SOFFICE_CACHE is not None:
        return _SOFFICE_CACHE
    candidates: list[str] = []
    explicit = (os.environ.get("OFFICE_SOFFICE_PATH", "") or "").strip()
    if explicit:
        candidates.append(explicit)
    for name in ("soffice", "libreoffice", "soffice.exe"):
        found = shutil.which(name)
        if found:
            candidates.append(found)
    if os.name == "nt":
        for base in (
            os.environ.get("PROGRAMFILES", ""),
            os.environ.get("PROGRAMFILES(X86)", ""),
        ):
            if base:
                candidates.append(str(Path(base) / "LibreOffice" / "program" / "soffice.exe"))
    else:
        candidates.extend(
            [
                "/Applications/LibreOffice.app/Contents/MacOS/soffice",
                "/usr/bin/soffice",
                "/usr/lib/libreoffice/program/soffice",
            ]
        )
    for candidate in candidates:
        try:
            if candidate and Path(candidate).is_file():
                _SOFFICE_CACHE = (candidate, "")
                return _SOFFICE_CACHE
        except OSError:
            continue
    _SOFFICE_CACHE = (None, "libreoffice-not-found")
    return _SOFFICE_CACHE


def _cleanup_stale_outputs() -> None:
    """删除超过保留期的私有输出目录;只碰本模块命名格式的真实目录。"""
    root = Path(tempfile.gettempdir())
    now = time.time()
    try:
        entries = list(root.glob("ihui-office-*"))
    except OSError:
        return
    for entry in entries:
        try:
            if not entry.is_dir() or entry.is_symlink():
                continue
            if now - entry.stat().st_mtime > OUTPUT_RETENTION_SECONDS:
                shutil.rmtree(entry, ignore_errors=True)
        except OSError:
            continue


def _new_output_dir() -> Path:
    _cleanup_stale_outputs()
    return Path(tempfile.mkdtemp(prefix="ihui-office-"))


def _error(code: str, message: str, **extra: Any) -> dict[str, Any]:
    return {"ok": False, "errorCode": code, "error": message, **extra}


def _allowed_targets(source_ext: str) -> frozenset[str]:
    if source_ext in WORD_EXTS:
        return WORD_TARGETS
    if source_ext in SHEET_EXTS:
        return SHEET_TARGETS
    if source_ext in SLIDES_EXTS:
        return SLIDES_TARGETS
    return frozenset()


def _run_soffice(
    source: Path,
    target: str,
    out_dir: Path,
    *,
    timeout_s: int,
) -> tuple[Path | None, dict[str, Any] | None]:
    soffice, reason = find_soffice()
    if soffice is None:
        return None, _error(
            "OFFICE_CONVERTER_UNAVAILABLE",
            "宿主机未安装 LibreOffice(soffice),无法转换/渲染 Office 文档;"
            "请安装后重试,或改用 parse_document 读取文本。",
            reason=reason,
        )
    profile = out_dir / "lo-profile"
    profile.mkdir(parents=True, exist_ok=True)
    command = [
        soffice,
        "--headless",
        "--nologo",
        "--norestore",
        "--nodefault",
        "--nofirststartwizard",
        f"-env:UserInstallation={profile.as_uri()}",
        "--convert-to",
        target,
        "--outdir",
        str(out_dir),
        str(source),
    ]
    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=max(5, min(int(timeout_s), 300)),
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None, _error("OFFICE_CONVERT_TIMEOUT", f"转换超时(>{timeout_s}s)")
    except OSError as exc:
        return None, _error("OFFICE_CONVERT_FAILED", f"启动 LibreOffice 失败: {exc}")
    expected_ext = f".{target.lower()}"
    outputs = sorted(
        (
            item
            for item in out_dir.iterdir()
            if item.is_file() and item.suffix.lower() == expected_ext and item.name != source.name
        ),
        key=lambda item: item.stat().st_mtime,
        reverse=True,
    )
    if not outputs:
        stderr = (completed.stderr or "").strip()[-500:]
        return None, _error(
            "OFFICE_CONVERT_FAILED",
            f"LibreOffice 未产出 {target} 文件(退出码 {completed.returncode})",
            stderr=stderr,
        )
    produced = outputs[0]
    try:
        size = produced.stat().st_size
    except OSError as exc:
        return None, _error("OFFICE_CONVERT_FAILED", f"读取产物失败: {exc}")
    if size > MAX_OUTPUT_BYTES:
        try:
            produced.unlink()
        except OSError:
            pass
        return None, _error(
            "OFFICE_OUTPUT_TOO_LARGE",
            f"产物超过上限({size} > {MAX_OUTPUT_BYTES} 字节)",
        )
    return produced, None


def _parse_pages(raw: Any, total: int) -> tuple[list[int] | None, str | None]:
    if raw is None or (isinstance(raw, str) and not raw.strip()):
        return list(range(min(total, MAX_RENDER_PAGES))), None
    if not isinstance(raw, str):
        return None, "pages 必须是字符串,例如 '1-3,5'"
    selected: set[int] = set()
    for part in raw.split(","):
        token = part.strip()
        if not token:
            continue
        try:
            if "-" in token:
                start_text, end_text = token.split("-", 1)
                start, end = int(start_text), int(end_text)
                if start > end:
                    return None, f"页码范围非法: {token}"
                selected.update(range(start, end + 1))
            else:
                selected.add(int(token))
        except ValueError:
            return None, f"页码格式非法: {token}"
    if not selected:
        return None, "pages 未包含任何页码"
    if any(page < 1 or page > total for page in selected):
        return None, f"页码越界: 文档共 {total} 页"
    if len(selected) > MAX_RENDER_PAGES:
        return None, f"一次最多渲染 {MAX_RENDER_PAGES} 页(请求 {len(selected)} 页)"
    return sorted(page - 1 for page in selected), None


def _render_pdf(
    pdf_path: Path,
    out_dir: Path,
    *,
    pages: Any,
    dpi: int,
) -> dict[str, Any]:
    try:
        import pypdfium2  # noqa: PLC0415 - 可选依赖,按需导入
    except Exception:  # noqa: BLE001
        return _error("RENDER_UNAVAILABLE", "缺少 pypdfium2,无法把 PDF 渲染为图片")
    try:
        document = pypdfium2.PdfDocument(str(pdf_path))
    except Exception as exc:  # noqa: BLE001
        return _error("RENDER_FAILED", f"打开 PDF 失败: {type(exc).__name__}")
    outputs: list[dict[str, Any]] = []
    total_bytes = 0
    try:
        total = len(document)
        if total == 0:
            return _error("RENDER_FAILED", "PDF 没有可渲染页面")
        indices, page_error = _parse_pages(pages, total)
        if indices is None:
            return _error("INVALID_REQUEST", page_error or "pages 非法")
        scale = max(1.0, min(float(dpi), 200.0)) / 72.0
        images_dir = out_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)
        for index in indices:
            try:
                page = document[index]
                try:
                    width, height = page.get_size()
                    page_scale = scale
                    if width * height * page_scale * page_scale > MAX_RENDER_PIXELS:
                        page_scale = (MAX_RENDER_PIXELS / max(1.0, width * height)) ** 0.5
                    bitmap = page.render(scale=page_scale)
                    try:
                        image = bitmap.to_pil()
                    finally:
                        bitmap.close()
                    path = images_dir / f"page-{index + 1:04d}.png"
                    image.save(path, format="PNG")
                    size = path.stat().st_size
                    total_bytes += size
                    if total_bytes > MAX_RENDER_BYTES:
                        return _error(
                            "RENDER_TOO_LARGE",
                            f"渲染图片总字节超过上限({total_bytes} > {MAX_RENDER_BYTES})",
                        )
                    outputs.append(
                        {
                            "path": str(path),
                            "page": index + 1,
                            "bytes": size,
                            "width": image.width,
                            "height": image.height,
                        }
                    )
                finally:
                    page.close()
            except Exception as exc:  # noqa: BLE001 - 单页坏了不拖垮整份
                outputs.append({"page": index + 1, "error": f"{type(exc).__name__}: {exc}"})
    finally:
        document.close()
    if not any("path" in item for item in outputs):
        return _error("RENDER_FAILED", "没有成功渲染任何页面")
    return {
        "ok": True,
        "pageCount": total,
        "outputs": outputs,
        "note": "图片在私有临时目录;可直接用 vision_analyze(image_path=...) 查看。",
    }


def _convert_operation(
    source: Path,
    target: str,
    *,
    timeout_s: int,
    operation: str,
) -> dict[str, Any]:
    out_dir = _new_output_dir()
    produced, error = _run_soffice(source, target, out_dir, timeout_s=timeout_s)
    if error is not None:
        return error
    assert produced is not None
    return {
        "ok": True,
        "operation": operation,
        "target": target,
        "outputs": [{"path": str(produced), "bytes": produced.stat().st_size}],
        "note": (
            "产物在私有临时目录(24h 后清理),不会写入工作区;需要落到项目内时请用文件工具自行复制。"
        ),
    }


def run_office_operation(
    source_path: str,
    *,
    operation: str,
    target: str | None = None,
    pages: Any = None,
    dpi: int = 120,
    timeout_s: int = 60,
) -> dict[str, Any]:
    """同步执行一次 Office 操作;``operation`` ∈ convert/render/recalculate。

    返回统一结构;任何失败都带 ``errorCode``,不抛异常给工具层。
    """
    if not _tool_enabled():
        return _error(
            "OFFICE_TOOLS_DISABLED",
            "Office 转换工具未启用(MCP_OFFICE_TOOLS_ENABLED=false);"
            "如需使用请由部署方安装 LibreOffice 后显式开启。",
        )
    source = Path(source_path)
    if not source.is_file():
        return _error("INVALID_REQUEST", "输入文件不存在或不是普通文件")
    try:
        source_size = source.stat().st_size
    except OSError as exc:
        return _error("INVALID_REQUEST", f"读取输入文件失败: {exc}")
    if source_size > MAX_INPUT_BYTES:
        return _error(
            "OFFICE_INPUT_TOO_LARGE",
            f"输入文件超过上限({source_size} > {MAX_INPUT_BYTES} 字节)",
        )
    source_ext = source.suffix.lower()
    if source_ext not in OFFICE_EXTS:
        return _error(
            "UNSUPPORTED_FORMAT",
            f"不支持的格式 {source_ext or '(无扩展名)'};支持 Word/Excel/PowerPoint/ODF/RTF/TXT/PDF",
        )
    normalized_operation = (operation or "").strip().lower()
    if normalized_operation not in {"convert", "render", "recalculate"}:
        return _error("INVALID_REQUEST", "operation 必须是 convert / render / recalculate")
    if not _SLOTS.acquire(timeout=max(5, min(int(timeout_s), 300))):
        return _error("OFFICE_BUSY", "转换队列已满,请稍后重试")
    try:
        if normalized_operation == "render":
            out_dir = _new_output_dir()
            pdf_path = source
            if source_ext != ".pdf":
                pdf_path, error = _run_soffice(source, "pdf", out_dir, timeout_s=timeout_s)
                if error is not None:
                    return error
                assert pdf_path is not None
            result = _render_pdf(pdf_path, out_dir, pages=pages, dpi=dpi)
            result.setdefault("operation", "render")
            return result
        if normalized_operation == "recalculate":
            if source_ext not in SHEET_EXTS:
                return _error("INVALID_REQUEST", "recalculate 仅支持 Excel/ODS/CSV 工作簿")
            recalc_target = (target or "xlsx").strip().lower()
            if recalc_target not in {"xlsx", "ods"}:
                return _error("INVALID_REQUEST", "recalculate 的 target 只能是 xlsx 或 ods")
            return _convert_operation(
                source, recalc_target, timeout_s=timeout_s, operation="recalculate"
            )
        allowed = _allowed_targets(source_ext)
        if not allowed:
            return _error("UNSUPPORTED_FORMAT", f"{source_ext} 不支持 convert(可用 render)")
        convert_target = (target or "").strip().lower()
        if not convert_target:
            return _error("INVALID_REQUEST", "convert 必须指定 target")
        if convert_target not in allowed:
            return _error(
                "INVALID_REQUEST",
                f"{source_ext} 只能转换为 {sorted(allowed)}",
            )
        if convert_target == source_ext.lstrip("."):
            return _error("INVALID_REQUEST", "目标格式与源格式相同,无需转换")
        return _convert_operation(source, convert_target, timeout_s=timeout_s, operation="convert")
    finally:
        _SLOTS.release()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
