# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Tests for the geometric overflow detector (R110).

The decks are built here rather than read from a scratch directory, so the tests carry their own
fixtures and stay reproducible on any machine.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

import pytest

from app.core.pptx_overflow_detector import (
    LAYER_GEOMETRIC,
    LAYER_TEXTUAL,
    LAYERS_CHECKED,
    LAYERS_NOT_CHECKED,
    PRESENTATION_PART,
    TOLERANCE_EMU,
    Canvas,
    DetectorError,
    Overflow,
    _Transform,
    detect,
    read_canvas,
    slide_parts,
)

A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"

CANVAS_W = 12_192_000
CANVAS_H = 6_858_000

CONTENT_TYPES = """<?xml version="1.0"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
</Types>"""


def _pres_xml(width: int = CANVAS_W, height: int = CANVAS_H) -> str:
    return (
        '<?xml version="1.0"?>'
        f'<p:presentation xmlns:p="{P}" xmlns:a="{A}">'
        f'<p:sldSz cx="{width}" cy="{height}"/>'
        "</p:presentation>"
    )


def _sp(shape_id: int, x: int, y: int, cx: int, cy: int, text: str) -> str:
    return (
        f'<p:sp><p:nvSpPr><p:cNvPr id="{shape_id}" name="S{shape_id}"/>'
        "<p:cNvSpPr/><p:nvPr/></p:nvSpPr>"
        '<p:spPr><a:xfrm><a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/></a:xfrm></p:spPr>'
        "<p:txBody><a:p><a:r><a:t>%s</a:t></a:r></a:p></p:txBody></p:sp>"
        % (x, y, cx, cy, text)
    )


def _grp(
    off: tuple[int, int],
    ext: tuple[int, int],
    ch_off: tuple[int, int],
    ch_ext: tuple[int, int],
    children: str,
) -> str:
    return (
        "<p:grpSp><p:nvGrpSpPr><p:cNvPr id=\"90\" name=\"G\"/><p:cNvGrpSpPr/><p:nvPr/>"
        "</p:nvGrpSpPr><p:grpSpPr><a:xfrm>"
        '<a:off x="%d" y="%d"/><a:ext cx="%d" cy="%d"/>'
        '<a:chOff x="%d" y="%d"/><a:chExt cx="%d" cy="%d"/>'
        "</a:xfrm></p:grpSpPr>%s</p:grpSp>"
        % (off[0], off[1], ext[0], ext[1], ch_off[0], ch_off[1], ch_ext[0], ch_ext[1], children)
    )


def _slide_xml(shapes: str) -> str:
    return (
        '<?xml version="1.0"?>'
        f'<p:sld xmlns:p="{P}" xmlns:a="{A}"><p:cSld><p:spTree>{shapes}'
        "</p:spTree></p:cSld></p:sld>"
    )


def build(tmp_path: Path, name: str, shapes: str, width: int = CANVAS_W,
          height: int = CANVAS_H) -> str:
    """A package holding only what the detector reads."""
    path = tmp_path / name
    with zipfile.ZipFile(path, "w") as package:
        package.writestr("[Content_Types].xml", CONTENT_TYPES)
        package.writestr(PRESENTATION_PART, _pres_xml(width, height))
        package.writestr("ppt/slides/slide1.xml", _slide_xml(shapes))
    return str(path)


# --- the three R109 probes, rebuilt ------------------------------------------------------


def test_inside_the_canvas_is_clean(tmp_path: Path) -> None:
    """The equivalent of R109's in.pptx: two shapes well inside."""
    shapes = _sp(2, 914_400, 457_200, 10_000_000, 1_143_000, "Quarterly Review") + _sp(
        3, 914_400, 2_286_000, 6_000_000, 3_400_000, "chart area"
    )
    report = detect(build(tmp_path, "in.pptx", shapes))
    assert report.clean is True
    assert report.canvas == Canvas(CANVAS_W, CANVAS_H)
    assert report.shapes_checked == 2


def test_right_edge_overflow_is_caught(tmp_path: Path) -> None:
    """The deck the vendor tool called clean: 11,000,000 + 9,000,000 on a 12,192,000 canvas."""
    shapes = _sp(2, 11_000_000, 2_000_000, 9_000_000, 1_500_000, "OFF CANVAS TEXT")
    report = detect(build(tmp_path, "overflow.pptx", shapes))
    assert report.clean is False
    assert len(report.overflows) == 1

    hit = report.overflows[0]
    assert hit.sides == ("right",)
    assert hit.right_emu == 7_808_000 - TOLERANCE_EMU
    assert hit.describe().startswith("ppt/slides/slide1.xml shape 2")


def test_spanning_both_edges_is_caught(tmp_path: Path) -> None:
    """farout: starts at -4,000,000 and is 30,000,000 wide."""
    shapes = _sp(2, -4_000_000, 2_000_000, 30_000_000, 1_500_000, "WAY OUT")
    report = detect(build(tmp_path, "farout.pptx", shapes))
    assert len(report.overflows) == 1

    hit = report.overflows[0]
    assert hit.sides == ("left", "right")
    assert hit.left_emu == 4_000_000 - TOLERANCE_EMU
    assert hit.right_emu == 26_000_000 - CANVAS_W - TOLERANCE_EMU
    assert hit.total_emu == hit.left_emu + hit.right_emu


# --- the vendor tool's hole -------------------------------------------------------------


def test_detects_what_the_vendor_tool_missed(tmp_path: Path) -> None:
    """R109's finding, restated as a property of this detector."""
    shapes = _sp(2, 11_000_000, 2_000_000, 9_000_000, 1_500_000, "OFF CANVAS TEXT")
    report = detect(build(tmp_path, "missed-by-vendor.pptx", shapes))
    assert report.clean is False, "the whole point: this deck is not clean"
    assert report.overflows[0].right_emu > 0


# --- tolerance --------------------------------------------------------------------------


def test_sub_point_overhang_is_tolerated(tmp_path: Path) -> None:
    """An overhang under a point is rounding, not a defect."""
    shapes = _sp(2, 914_400, 457_200, CANVAS_W - 914_400 + 5_000, 1_143_000, "hair over")
    report = detect(build(tmp_path, "hair.pptx", shapes))
    assert report.clean is True


def test_overhang_past_tolerance_is_reported(tmp_path: Path) -> None:
    shapes = _sp(
        2, 914_400, 457_200, CANVAS_W - 914_400 + TOLERANCE_EMU + 1_000, 1_143_000, "over"
    )
    report = detect(build(tmp_path, "over.pptx", shapes))
    assert report.clean is False
    assert report.overflows[0].right_emu == 1_000


# --- groups -----------------------------------------------------------------------------


def test_group_scale_is_applied(tmp_path: Path) -> None:
    """A child at chOff 6,000,000 inside a 2x group lands outside the canvas."""
    child = _sp(2, 6_000_000, 0, 1_000_000, 500_000, "grouped far out")
    group = _grp(
        off=(1_000_000, 1_000_000),
        ext=(4_000_000, 2_000_000),
        ch_off=(0, 0),
        ch_ext=(2_000_000, 1_000_000),
        children=child,
    )
    report = detect(build(tmp_path, "group.pptx", group))
    assert len(report.overflows) == 1
    hit = report.overflows[0]
    # abs_x = 1,000,000 + 6,000,000*2 = 13,000,000; abs_cx = 2,000,000 -> right 15,000,000
    assert hit.x == 13_000_000
    assert hit.cx == 2_000_000
    assert hit.right_emu == 15_000_000 - CANVAS_W - TOLERANCE_EMU


def test_group_keeps_inside_child_inside(tmp_path: Path) -> None:
    child = _sp(2, 100_000, 100_000, 500_000, 200_000, "grouped inside")
    group = _grp(
        off=(1_000_000, 1_000_000),
        ext=(2_000_000, 1_000_000),
        ch_off=(0, 0),
        ch_ext=(1_000_000, 500_000),
        children=child,
    )
    report = detect(build(tmp_path, "group-inside.pptx", group))
    assert report.clean is True
    assert report.shapes_checked == 1


def test_nested_groups_compose(tmp_path: Path) -> None:
    """Two levels: a wrong mapping reports a wrong coordinate, so assert the exact one.

    inner_child sits at chOff x=3,000,000 inside a child space only 1,000,000 wide -- already
    outside its own group. Mapping it through is what puts it off the canvas:

        outer  off 5,000,000  ext 4,000,000  chExt 2,000,000  -> x scale 2
        outer maps inner's frame (0,0,2,000,000) to abs (5,000,000, width 4,000,000) -> scale 4
        child abs x = 5,000,000 + 3,000,000 * 4 = 17,000,000
        child abs cx = 500,000 * 4 = 2,000,000 -> right 19,000,000

    Skipping either level lands on a different number, so this pins the composition.
    """
    inner_child = _sp(3, 3_000_000, 0, 500_000, 200_000, "deep")
    inner = _grp(
        off=(0, 0), ext=(2_000_000, 1_000_000),
        ch_off=(0, 0), ch_ext=(1_000_000, 1_000_000),
        children=inner_child,
    )
    outer = _grp(
        off=(5_000_000, 1_000_000), ext=(4_000_000, 2_000_000),
        ch_off=(0, 0), ch_ext=(2_000_000, 1_000_000),
        children=inner,
    )
    report = detect(build(tmp_path, "nested.pptx", outer))
    assert report.shapes_checked == 1
    assert len(report.overflows) == 1
    hit = report.overflows[0]
    assert hit.x == 17_000_000
    assert hit.cx == 2_000_000
    assert hit.x + hit.cx == 19_000_000
    assert hit.right_emu == 19_000_000 - CANVAS_W - TOLERANCE_EMU


# --- what it refuses to judge -----------------------------------------------------------


def test_no_sldsz_is_an_error(tmp_path: Path) -> None:
    path = tmp_path / "nosize.pptx"
    with zipfile.ZipFile(path, "w") as package:
        package.writestr(
            PRESENTATION_PART,
            f'<?xml version="1.0"?><p:presentation xmlns:p="{P}"/>',
        )
    with pytest.raises(DetectorError, match="no sldSz"):
        detect(str(path))


def test_degenerate_canvas_is_an_error(tmp_path: Path) -> None:
    path = tmp_path / "zero.pptx"
    with zipfile.ZipFile(path, "w") as package:
        package.writestr(PRESENTATION_PART, _pres_xml(0, 0))
    with pytest.raises(DetectorError, match="degenerate"):
        detect(str(path))


def test_bad_zip_is_an_error(tmp_path: Path) -> None:
    path = tmp_path / "not-a-zip.pptx"
    path.write_bytes(b"this is not a package")
    with pytest.raises(DetectorError, match="cannot open"):
        detect(str(path))


# --- honesty about the second layer ----------------------------------------------------


def test_report_states_textual_layer_unchecked(tmp_path: Path) -> None:
    shapes = _sp(2, 914_400, 457_200, 1_000_000, 1_000_000, "tiny frame, long text")
    report = detect(build(tmp_path, "text-spill.pptx", shapes))
    assert report.clean is True, "geometry is clean even though the text may spill"
    assert report.layers_checked == LAYERS_CHECKED == (LAYER_GEOMETRIC,)
    assert report.layers_not_checked == LAYERS_NOT_CHECKED == (LAYER_TEXTUAL,)
    assert "text that overflows its own frame is not visible here" in report.summary()


# --- plumbing ----------------------------------------------------------------------------


def test_slide_parts_are_numerically_ordered(tmp_path: Path) -> None:
    path = tmp_path / "many.pptx"
    with zipfile.ZipFile(path, "w") as package:
        package.writestr(PRESENTATION_PART, _pres_xml())
        for n in (10, 2, 1):
            package.writestr(f"ppt/slides/slide{n}.xml", _slide_xml(_sp(2, 0, 0, 10, 10, "x")))
    with zipfile.ZipFile(path) as package:
        assert slide_parts(package) == [
            "ppt/slides/slide1.xml",
            "ppt/slides/slide2.xml",
            "ppt/slides/slide10.xml",
        ]


def test_read_canvas_reads_the_declaration(tmp_path: Path) -> None:
    path = tmp_path / "c.pptx"
    with zipfile.ZipFile(path, "w") as package:
        package.writestr(PRESENTATION_PART, _pres_xml(9_000_000, 5_000_000))
    with zipfile.ZipFile(path) as package:
        assert read_canvas(package) == Canvas(9_000_000, 5_000_000)


def test_overflow_dataclass_shape() -> None:
    o = Overflow(
        part="p", shape_id="2", label="x", x=0, y=0, cx=0, cy=0,
        left_emu=0, right_emu=100, top_emu=0, bottom_emu=0,
    )
    assert o.sides == ("right",)
    assert o.total_emu == 100
    assert "right=100 EMU" in o.describe()


def test_identity_transform_changes_nothing() -> None:
    t = _Transform()
    assert t.apply(5, 6, 7, 8) == (5, 6, 7, 8)


# --- mutation guards -------------------------------------------------------------------


def test_tolerance_is_actually_applied(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """With the tolerance forced to zero, the same hair-overhang deck must be reported."""
    shapes = _sp(2, 914_400, 457_200, CANVAS_W - 914_400 + 5_000, 1_143_000, "hair over")
    deck = build(tmp_path, "hair-zero.pptx", shapes)
    assert detect(deck).clean is True
    monkeypatch.setattr("app.core.pptx_overflow_detector.TOLERANCE_EMU", 0)
    report = detect(deck)
    assert report.clean is False
    assert report.overflows[0].right_emu == 5_000


def test_group_scale_mutation_is_caught(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Prove the group mapping is load-bearing: drop it and this shape falls back inside.

    With the mapping, the child lands at 13,000,000 and is reported. With the transform
    degenerated to identity it sits at 4,000,000, inside the canvas, and the deck comes back
    clean -- the shape silently disappears from the report. That is exactly the failure mode
    this detector exists to avoid, so the mutation shows up as a lost finding.
    """
    inner_child = _sp(3, 4_000_000, 0, 500_000, 200_000, "deep")
    outer = _grp(
        off=(5_000_000, 1_000_000), ext=(4_000_000, 2_000_000),
        ch_off=(0, 0), ch_ext=(2_000_000, 1_000_000),
        children=inner_child,
    )
    deck = build(tmp_path, "group-mutation.pptx", outer)

    # 5,000,000 + 4,000,000 * 2 = 13,000,000, well past the 12,192,000 canvas.
    assert detect(deck).clean is False
    assert detect(deck).overflows[0].x == 13_000_000

    monkeypatch.setattr(
        "app.core.pptx_overflow_detector._Transform.apply",
        lambda self, x, y, cx, cy: (x, y, cx, cy),
    )
    mutated = detect(deck)
    assert mutated.clean is True, "identity mapping loses the finding -- the mapping is required"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
