# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""An overflow detector that actually detects overflow (R110).

R109 established that the vendor's ``slides_test.py`` passes decks whose content visibly runs past
the canvas -- a shape starting at 11,000,000 EMU with a 9,000,000 EMU width on a 12,192,000 EMU
canvas came back "No overflow detected". Its stated method is to render with padding and inspect
the margins, and that method has a hole in it: if the renderer clips to the canvas, the padded
margin stays clean no matter how badly the content overflows, so the check has nothing to see.

So this detector does not render. It reads the drawing geometry directly out of the package and
compares every shape's absolute frame against ``<p:sldSz>``. There is no rasteriser in that path
to clip anything, and the arithmetic is exact.

The transformation chain matters. A ``grpSp`` carries its own ``a:off``/``a:ext`` plus a
``a:chOff``/``a:chExt`` child space, and children are expressed in that child space. Ignoring the
mapping -- or forgetting a second nested group -- reports every grouped shape at the wrong
coordinates. :meth:`_Transform.apply` and :meth:`_Transform.child_of` walk the chain properly.

**Two layers of overflow exist, and this module only owns the first one.**

1. *Geometric*: a shape's frame leaves the canvas. Purely a matter of numbers; this detector
   handles it exactly, including nested groups.
2. *Textual*: a frame fits, but the text inside needs more room than the frame gives and spills
   or gets clipped. That depends on font metrics and wrapping, which no amount of XML
   arithmetic can predict. **This detector cannot see it, and does not pretend to.** Layer two
   still needs R108's render-and-look path.

Reporting only the first layer while claiming "no overflow" for the whole deck would repeat
exactly the mistake this module exists to fix, so the result type carries what was checked and
what was not.
"""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from typing import Final
from xml.etree import ElementTree as ET

A_NS: Final = "http://schemas.openxmlformats.org/drawingml/2006/main"
P_NS: Final = "http://schemas.openxmlformats.org/presentationml/2006/main"

_A = "{" + A_NS + "}"
_P = "{" + P_NS + "}"

PRESENTATION_PART: Final = "ppt/presentation.xml"

# A frame that pokes out by less than a point is not worth calling a defect: rulers round, and
# 1 pt = 12700 EMU. Anything an eye could see on a 13.3-inch slide exceeds this by orders of
# magnitude (the R109 probes overshoot by 4,000,000-13,808,000 EMU).
TOLERANCE_EMU: Final = 12_700

LAYER_GEOMETRIC: Final = "geometric"
LAYER_TEXTUAL: Final = "textual"
LAYERS_CHECKED: Final = (LAYER_GEOMETRIC,)
LAYERS_NOT_CHECKED: Final = (LAYER_TEXTUAL,)


class DetectorError(ValueError):
    """Raised when a package cannot be read well enough to judge."""


@dataclass(frozen=True)
class Overflow:
    """One shape whose absolute frame leaves the canvas."""

    part: str
    shape_id: str
    label: str
    x: int
    y: int
    cx: int
    cy: int
    left_emu: int
    right_emu: int
    top_emu: int
    bottom_emu: int

    @property
    def total_emu(self) -> int:
        return self.left_emu + self.right_emu + self.top_emu + self.bottom_emu

    @property
    def sides(self) -> tuple[str, ...]:
        names = []
        if self.left_emu:
            names.append("left")
        if self.top_emu:
            names.append("top")
        if self.right_emu:
            names.append("right")
        if self.bottom_emu:
            names.append("bottom")
        return tuple(names)

    def describe(self) -> str:
        return (
            f"{self.part} shape {self.shape_id} ({self.label!r}) leaves the canvas on "
            f"{', '.join(self.sides)} by "
            + ", ".join(f"{s}={v} EMU" for s, v in (
                ("left", self.left_emu),
                ("top", self.top_emu),
                ("right", self.right_emu),
                ("bottom", self.bottom_emu),
            ) if v)
        )


@dataclass(frozen=True)
class Canvas:
    width_emu: int
    height_emu: int


@dataclass(frozen=True)
class Report:
    """What was checked, what was found, and what was deliberately left unexamined."""

    canvas: Canvas
    slides_checked: int
    shapes_checked: int
    overflows: tuple[Overflow, ...]
    layers_checked: tuple[str, ...] = LAYERS_CHECKED
    layers_not_checked: tuple[str, ...] = LAYERS_NOT_CHECKED

    @property
    def clean(self) -> bool:
        return not self.overflows

    @property
    def is_geometrically_clean_only(self) -> bool:
        """A clean verdict here covers layer one and says nothing about layer two."""
        return self.clean

    def summary(self) -> str:
        if self.overflows:
            lines = [f"{len(self.overflows)} shape(s) leave the canvas:"]
            lines.extend("  " + o.describe() for o in self.overflows)
            return "\n".join(lines)
        return (
            f"No shape leaves the canvas across {self.slides_checked} slide(s), "
            f"{self.shapes_checked} shape(s). "
            "Geometric overflow only -- text that overflows its own frame is not visible here."
        )


def read_canvas(package: zipfile.ZipFile) -> Canvas:
    """Pull ``sldSz`` out of the presentation part."""
    try:
        root = ET.fromstring(package.read(PRESENTATION_PART))
    except KeyError as exc:
        raise DetectorError(f"package has no {PRESENTATION_PART}") from exc
    except ET.ParseError as exc:
        raise DetectorError(f"{PRESENTATION_PART} is not parseable XML: {exc}") from exc

    size = root.find(f"{_P}sldSz")
    if size is None:
        raise DetectorError("presentation declares no sldSz; canvas size is unknown")
    try:
        width = int(size.get("cx", ""))
        height = int(size.get("cy", ""))
    except ValueError as exc:
        raise DetectorError(f"sldSz carries a non-numeric extent: {exc}") from exc
    if width <= 0 or height <= 0:
        raise DetectorError(f"sldSz is degenerate: {width}x{height}")
    return Canvas(width, height)


def _frame_of(xfrm: ET.Element | None) -> tuple[int, int, int, int] | None:
    """Return (x, y, cx, cy) from an ``a:xfrm``, or None when incomplete."""
    if xfrm is None:
        return None
    off = xfrm.find(f"{_A}off")
    ext = xfrm.find(f"{_A}ext")
    if off is None or ext is None:
        return None
    try:
        return (
            int(off.get("x", "0")),
            int(off.get("y", "0")),
            int(ext.get("cx", "0")),
            int(ext.get("cy", "0")),
        )
    except ValueError:
        return None


@dataclass(frozen=True)
class _Transform:
    """Maps a child coordinate space onto the canvas."""

    off_x: int = 0
    off_y: int = 0
    scale_x: float = 1.0
    scale_y: float = 1.0
    ch_off_x: int = 0
    ch_off_y: int = 0

    def apply(self, x: int, y: int, cx: int, cy: int) -> tuple[int, int, int, int]:
        ax = self.off_x + round((x - self.ch_off_x) * self.scale_x)
        ay = self.off_y + round((y - self.ch_off_y) * self.scale_y)
        return ax, ay, round(cx * self.scale_x), round(cy * self.scale_y)

    def child_of(self, xfrm: ET.Element) -> _Transform:
        """Compose this transform with the child space a nested group declares."""
        frame = _frame_of(xfrm)
        ch_off = xfrm.find(f"{_A}chOff")
        ch_ext = xfrm.find(f"{_A}chExt")
        if frame is None or ch_off is None or ch_ext is None:
            return self
        try:
            chx = int(ch_off.get("x", "0"))
            chy = int(ch_off.get("y", "0"))
            chcx = int(ch_ext.get("cx", "0"))
            chcy = int(ch_ext.get("cy", "0"))
        except ValueError:
            return self
        if chcx <= 0 or chcy <= 0:
            return self

        x, y, cx, cy = frame
        abs_x, abs_y, abs_cx, abs_cy = self.apply(x, y, cx, cy)
        return _Transform(
            off_x=abs_x,
            off_y=abs_y,
            scale_x=(abs_cx / chcx),
            scale_y=(abs_cy / chcy),
            ch_off_x=chx,
            ch_off_y=chy,
        )


def _label_of(shape: ET.Element) -> str:
    texts = [t.text or "" for t in shape.iter(f"{_A}t")]
    joined = " ".join(part for part in texts if part).strip()
    if joined:
        return joined[:40]
    name = shape.find(f"{_P}nvSpPr/{_P}cNvPr")
    if name is not None and name.get("name"):
        return name.get("name", "")[:40]
    return "(unnamed)"


def _shape_id_of(shape: ET.Element) -> str:
    for tag in ("nvSpPr", "nvPicPr", "nvGraphicFramePr"):
        holder = shape.find(f"{_P}{tag}")
        if holder is not None:
            c_nv = holder.find(f"{_P}cNvPr")
            if c_nv is not None and c_nv.get("id"):
                return c_nv.get("id", "?")
    return "?"


def _sp_frame(shape: ET.Element) -> ET.Element | None:
    """The ``a:xfrm`` that positions a leaf shape."""
    if shape.tag == f"{_P}graphicFrame":
        return shape.find(f"{_P}xfrm")
    if shape.tag == f"{_P}pic":
        return shape.find(f"{_P}spPr/{_A}xfrm")
    if shape.tag == f"{_P}sp":
        return shape.find(f"{_P}spPr/{_A}xfrm")
    return None


def _overflow_of(
    part: str,
    shape: ET.Element,
    frame: tuple[int, int, int, int],
    canvas: Canvas,
) -> Overflow | None:
    x, y, cx, cy = frame
    right = x + cx
    bottom = y + cy
    left_over = max(0, -x - TOLERANCE_EMU)
    top_over = max(0, -y - TOLERANCE_EMU)
    right_over = max(0, right - canvas.width_emu - TOLERANCE_EMU)
    bottom_over = max(0, bottom - canvas.height_emu - TOLERANCE_EMU)
    if not (left_over or top_over or right_over or bottom_over):
        return None
    return Overflow(
        part=part,
        shape_id=_shape_id_of(shape),
        label=_label_of(shape),
        x=x,
        y=y,
        cx=cx,
        cy=cy,
        left_emu=left_over,
        right_emu=right_over,
        top_emu=top_over,
        bottom_emu=bottom_over,
    )


def _walk(
    node: ET.Element,
    part: str,
    canvas: Canvas,
    transform: _Transform,
    found: list[Overflow],
    counter: list[int],
) -> None:
    for child in node:
        if child.tag == f"{_P}grpSp":
            xfrm = child.find(f"{_P}grpSpPr/{_A}xfrm")
            inner = transform.child_of(xfrm) if xfrm is not None else transform
            _walk(child, part, canvas, inner, found, counter)
            continue
        xfrm = _sp_frame(child)
        if xfrm is None:
            # Not a leaf shape: cSld, spTree, the shape's own nvSpPr and so on. Descend, or the
            # whole tree below the slide element would be skipped.
            _walk(child, part, canvas, transform, found, counter)
            continue
        frame = _frame_of(xfrm)
        if frame is None:
            continue
        counter[0] += 1
        absolute = transform.apply(*frame)
        hit = _overflow_of(part, child, absolute, canvas)
        if hit is not None:
            found.append(hit)


def slide_parts(package: zipfile.ZipFile) -> list[str]:
    """Slide parts in numeric order, so reports read the way the deck does."""
    parts = [
        name
        for name in package.namelist()
        if name.startswith("ppt/slides/slide") and name.endswith(".xml")
    ]

    def order(name: str) -> tuple[int, str]:
        digits = "".join(ch for ch in name.split("/")[-1] if ch.isdigit())
        return (int(digits) if digits else 0, name)

    return sorted(parts, key=order)


def detect(package_path: str) -> Report:
    """Judge every slide's geometry against the declared canvas."""
    try:
        package = zipfile.ZipFile(package_path)
    except (zipfile.BadZipFile, OSError) as exc:
        raise DetectorError(f"cannot open {package_path}: {exc}") from exc

    with package:
        canvas = read_canvas(package)
        found: list[Overflow] = []
        counter = [0]
        slides = slide_parts(package)
        for part in slides:
            try:
                root = ET.fromstring(package.read(part))
            except ET.ParseError as exc:
                raise DetectorError(f"{part} is not parseable XML: {exc}") from exc
            _walk(root, part, canvas, _Transform(), found, counter)

    return Report(
        canvas=canvas,
        slides_checked=len(slides),
        shapes_checked=counter[0],
        overflows=tuple(found),
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
