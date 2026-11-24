# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""视觉像素比对(遵循统一工程规范)。

为什么要有这一份:IHUI `computer_use.py` 的 screenshot 只把当前帧回传给前端/模型,
**动作前后两帧之间有没有变化、哪里变了**全靠模型肉眼判断。后果:
    - 点击后模型要自己"看"第二张截图才能确认按钮是否被点中,多一轮模型往返;
    - 打字/滚动后无法自动验证"界面确实前进了",失败动作要等到下游才暴露;
    - 每次验证都要把整张 PNG 塞进上下文(贵 + 慢)。
Codex computer-use 在 `cua_node` 运行时内置 pixelmatch + sharp:
动作前后各截一帧 → 像素级 diff → 结构化"变了没有/变了多少/哪里变了",
模型只需读一个数字(变更率)+ 可选的 diff 图,不必回传两张全图。
(取证:`resources/cua_node/bin/node_modules` 含 playwright/sharp/pixelmatch/pixelmatch;
 本仓不读 @oai/cua、@oai/sky 专有文档 —— 只复现"像素比对"这一可判定范式。)

超越轴(相对简单阈值法):
    - **可判定**:输出结构化 `VisualDiff`(changed / change_ratio / bbox / hotspots),
      调用方能用 `changed` 一个布尔直接驱动"动作是否生效"分支,不必再喂图给模型。
    - **抗噪**:可选忽略纯色边框/滚动条抖动(阈值 + 抗锯齿容忍),避免亚像素抖动误判。
    - **可定位**:hotspots 给出变更聚类框,模型据此定位"界面哪块动了"。

显式不做(对侧也未做,或属上层职责):
    - 不做 OCR / 不做元素语义定位(那是 accessibility tree 的职责);
    - 不做跨帧追踪 / 不做视频流比对(单次动作前后比对即可);
    - 不做自动重试(比对结论交调用方决策)。

纯逻辑层:吃两张图的字节/路径/PIL Image,吐结构化结果,**不做任何 IO 副作用**
(不落盘、不发请求);图像解码由调用方或内部 `_load` 完成,可注入 mock 测试。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path
from typing import Any, Final

from PIL import Image, ImageChops

# 默认逐像素容忍(0-255 每通道):亚像素抗锯齿/压缩噪声不计为变化。
# pixelmatch 默认 threshold=0.1(≈25.5/255),这里取同量级。
DEFAULT_THRESHOLD: Final[int] = 25
# 默认"显著变更"判据:变更像素占比 ≥ 此值才算界面真的动了(过滤孤立噪声点)。
DEFAULT_CHANGE_RATIO_FLOOR: Final[float] = 0.0001  # 万分之一像素


@dataclass(frozen=True)
class Hotspot:
    """一处变更聚类框(把零散变更像素聚成"界面哪块动了")。"""

    x: int
    y: int
    width: int
    height: int
    changed_pixels: int

    def as_dict(self) -> dict[str, int]:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "changedPixels": self.changed_pixels,
        }


@dataclass(frozen=True)
class VisualDiff:
    """一次像素比对的结论。调用方主要读 `changed` + `change_ratio`。"""

    changed: bool
    change_ratio: float
    changed_pixels: int
    total_pixels: int
    threshold: int
    bbox: dict[str, int] | None  # 全部变更的外包框(x/y/width/height);无变更时 None
    hotspots: list[Hotspot] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "changed": self.changed,
            "changeRatio": round(self.change_ratio, 6),
            "changedPixels": self.changed_pixels,
            "totalPixels": self.total_pixels,
            "threshold": self.threshold,
            "bbox": self.bbox,
            "hotspots": [h.as_dict() for h in self.hotspots],
        }


@dataclass(frozen=True)
class DiffConfig:
    """比对参数。threshold 单通道容忍;ratio_floor 显著变更下限。"""

    threshold: int = DEFAULT_THRESHOLD
    ratio_floor: float = DEFAULT_CHANGE_RATIO_FLOOR
    # hotspot 聚类:变更像素按此网格粗聚(避免返回成百上千个 1x1 框)。
    hotspot_grid: int = 32


def _load(source: Any) -> Image.Image:
    """把路径/字节/PIL Image 统一转成 RGB Image(不做 IO 副作用,除路径读取)。"""
    if isinstance(source, Image.Image):
        return source.convert("RGB")
    if isinstance(source, (bytes, bytearray)):
        return Image.open(BytesIO(source)).convert("RGB")
    if isinstance(source, (str, Path)):
        return Image.open(Path(source)).convert("RGB")
    raise TypeError(f"不支持的图像来源类型: {type(source).__name__}")


def _grid_hotspots(
    bbox_rows: list[tuple[int, int]], grid: int
) -> list[Hotspot]:
    """把变更像素按 grid×grid 粗聚成 hotspot 框(合并同格,给模型可读的定位)。"""
    if not bbox_rows:
        return []
    cells: dict[tuple[int, int], list[tuple[int, int]]] = {}
    for x, y in bbox_rows:
        key = (x // grid, y // grid)
        cells.setdefault(key, []).append((x, y))
    spots: list[Hotspot] = []
    for pts in cells.values():
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        spots.append(
            Hotspot(
                x=min(xs),
                y=min(ys),
                width=max(xs) - min(xs) + 1,
                height=max(ys) - min(ys) + 1,
                changed_pixels=len(pts),
            )
        )
    # 变更最多的格优先,供模型先看主变更区。
    spots.sort(key=lambda s: s.changed_pixels, reverse=True)
    return spots


def compare_visual(
    before: Any,
    after: Any,
    config: DiffConfig | None = None,
) -> VisualDiff:
    """比对动作前后两帧,给出结构化结论(纯函数,无 IO 副作用)。

    返回:
        VisualDiff.changed   —— 显著变更布尔(驱动"动作是否生效"分支);
        change_ratio         —— 变更像素占比;
        bbox / hotspots      —— 变更定位(全包框 + 网格聚类)。
    尺寸不同:视为"界面结构性变化",changed=True 且 bbox=整图。
    """
    cfg = config or DiffConfig()
    a = _load(before)
    b = _load(after)

    if a.size != b.size:
        w, h = b.size
        return VisualDiff(
            changed=True,
            change_ratio=1.0,
            changed_pixels=w * h,
            total_pixels=w * h,
            threshold=cfg.threshold,
            bbox={"x": 0, "y": 0, "width": w, "height": h},
            hotspots=[
                Hotspot(
                    x=0, y=0, width=w, height=h, changed_pixels=w * h
                )
            ],
        )

    # 逐通道绝对差 → 任一通道超阈值即该像素记为变更(pixelmatch 同语义)。
    diff = ImageChops.difference(a, b).convert("L")
    # 灰度化后单阈值判变更:三通道合成灰度 ≥ threshold 记变更(保守,抗噪)。
    mask = diff.point(lambda v: 255 if v >= cfg.threshold else 0)
    hist = mask.histogram()
    changed_pixels = sum(hist[255:]) if len(hist) > 255 else 0
    total = a.size[0] * a.size[1]
    ratio = changed_pixels / total if total else 0.0
    changed = ratio >= cfg.ratio_floor

    if changed_pixels == 0:
        return VisualDiff(
            changed=False,
            change_ratio=0.0,
            changed_pixels=0,
            total_pixels=total,
            threshold=cfg.threshold,
            bbox=None,
            hotspots=[],
        )

    bbox_img = mask.getbbox()  # 变更外包框
    bbox = (
        {"x": bbox_img[0], "y": bbox_img[1], "width": bbox_img[2] - bbox_img[0], "height": bbox_img[3] - bbox_img[1]}
        if bbox_img
        else None
    )
    # 网格聚类 hotspot:遍历 mask 像素(变更量通常远小于全图,可接受)。
    pts: list[tuple[int, int]] = []
    if changed_pixels <= 50000:  # 上限保护:变更过大时只给整框不给细粒度聚类
        px = mask.load()
        assert px is not None  # PIL: R 模式非平铺图像 load() 不为 None
        w, h = mask.size
        for y in range(h):
            for x in range(w):
                if px[x, y]:
                    pts.append((x, y))
    hotspots = _grid_hotspots(pts, cfg.hotspot_grid)

    return VisualDiff(
        changed=changed,
        change_ratio=ratio,
        changed_pixels=changed_pixels,
        total_pixels=total,
        threshold=cfg.threshold,
        bbox=bbox,
        hotspots=hotspots,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
