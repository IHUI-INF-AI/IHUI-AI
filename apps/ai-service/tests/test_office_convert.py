# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Office 转换/渲染/重算:默认关闭、依赖缺失 fail-closed、有界执行。

钉住的边界:
  A 默认关闭 ⇒ OFFICE_TOOLS_DISABLED,绝不偷偷转换;
  B 找不到 LibreOffice ⇒ OFFICE_CONVERTER_UNAVAILABLE,不回落其他工具;
  C 成功路径只产出到私有临时目录,命令参数固定(不接受任意命令行);
  D 超时/非法目标/超大输入都结构化报错,不抛异常给工具循环。
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from app.tools import office_convert


def _source(tmp_path: Path, name: str = "report.docx") -> Path:
    path = tmp_path / name
    path.write_bytes(b"PK\x03\x04fake-docx")
    return path


def test_disabled_by_default(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_OFFICE_TOOLS_ENABLED", raising=False)
    result = office_convert.run_office_operation(
        str(_source(tmp_path)), operation="convert", target="pdf"
    )
    assert result["ok"] is False
    assert result["errorCode"] == "OFFICE_TOOLS_DISABLED"


def test_missing_libreoffice_is_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: (None, "libreoffice-not-found"))
    result = office_convert.run_office_operation(
        str(_source(tmp_path)), operation="convert", target="pdf"
    )
    assert result["ok"] is False
    assert result["errorCode"] == "OFFICE_CONVERTER_UNAVAILABLE"
    assert result["reason"] == "libreoffice-not-found"


def test_convert_success_writes_only_to_private_dir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: ("/usr/bin/soffice", ""))
    source = _source(tmp_path)

    def fake_run(command, **kwargs):  # noqa: ANN001, ANN003
        out_dir = Path(command[command.index("--outdir") + 1])
        target = command[command.index("--convert-to") + 1]
        assert command[-1] == str(source)
        assert "--headless" in command
        (out_dir / f"{source.stem}.{target}").write_bytes(b"%PDF-1.4")
        return subprocess.CompletedProcess(command, 0, "", "")

    monkeypatch.setattr(office_convert.subprocess, "run", fake_run)
    result = office_convert.run_office_operation(str(source), operation="convert", target="pdf")

    assert result["ok"] is True
    assert result["operation"] == "convert"
    assert result["target"] == "pdf"
    output = Path(result["outputs"][0]["path"])
    assert output.read_bytes() == b"%PDF-1.4"
    assert "ihui-office-" in str(output)
    assert not output.is_relative_to(tmp_path)


def test_timeout_is_structured(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: ("/usr/bin/soffice", ""))
    source = _source(tmp_path)

    def fake_run(command, **kwargs):  # noqa: ANN001, ANN003
        raise subprocess.TimeoutExpired(command, kwargs.get("timeout", 60))

    monkeypatch.setattr(office_convert.subprocess, "run", fake_run)
    result = office_convert.run_office_operation(
        str(source), operation="convert", target="pdf", timeout_s=5
    )
    assert result["ok"] is False
    assert result["errorCode"] == "OFFICE_CONVERT_TIMEOUT"


def test_invalid_target_rejected_before_spawning(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: ("/usr/bin/soffice", ""))
    called = {"run": False}

    def fake_run(*args, **kwargs):  # noqa: ANN002, ANN003
        called["run"] = True
        return subprocess.CompletedProcess([], 0, "", "")

    monkeypatch.setattr(office_convert.subprocess, "run", fake_run)
    result = office_convert.run_office_operation(
        str(_source(tmp_path)), operation="convert", target="csv"
    )
    assert result["ok"] is False
    assert result["errorCode"] == "INVALID_REQUEST"
    assert called["run"] is False


def test_parse_pages_ranges_and_caps() -> None:
    assert office_convert._parse_pages("1-3,5", 10) == ([0, 1, 2, 4], None)
    indices, error = office_convert._parse_pages("9", 5)
    assert indices is None and error is not None
    indices, error = office_convert._parse_pages("1-999", 1000)
    assert indices is None and "最多渲染" in (error or "")


def test_render_requires_sheet_operation_for_recalculate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: ("/usr/bin/soffice", ""))
    result = office_convert.run_office_operation(
        str(_source(tmp_path, "slides.pptx")), operation="recalculate", target="xlsx"
    )
    assert result["ok"] is False
    assert result["errorCode"] == "INVALID_REQUEST"


def test_render_uses_pdf_conversion_and_page_cap(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MCP_OFFICE_TOOLS_ENABLED", "true")
    monkeypatch.setattr(office_convert, "find_soffice", lambda: ("/usr/bin/soffice", ""))
    source = _source(tmp_path, "deck.pptx")
    monkeypatch.setattr(
        office_convert,
        "_run_soffice",
        lambda src, target, out_dir, timeout_s: (out_dir / "deck.pdf", None),
    )
    seen: dict[str, object] = {}

    def fake_render(pdf_path, out_dir, *, pages, dpi):  # noqa: ANN001
        seen.update({"pdf": pdf_path, "pages": pages, "dpi": dpi})
        return {"ok": True, "outputs": [{"path": "x.png", "page": 1, "bytes": 1}]}

    monkeypatch.setattr(office_convert, "_render_pdf", fake_render)
    result = office_convert.run_office_operation(
        str(source), operation="render", pages="1-2", dpi=96
    )
    assert result["ok"] is True
    assert result["operation"] == "render"
    assert seen["pages"] == "1-2"
    assert seen["dpi"] == 96
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
