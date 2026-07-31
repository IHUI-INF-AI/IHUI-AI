"""行为人类化 — 让 Playwright 操作在统计特征上与真人无法区分。

反风控核心:平台通过行为特征(鼠标轨迹/输入节奏/停留时间)识别"是否机器人"。
真人鼠标走曲线且有微抖动,机器人走直线瞬移;真人输入节奏随机,机器人匀速;
真人会停顿思考,机器人连续操作。本模块把所有操作"人类化"。

6 类人类化操作:
1. human_move_mouse  — 贝塞尔曲线鼠标轨迹(3 阶贝塞尔 + 微抖动)
2. human_click       — 移动到目标 + 随机偏移点击(不总点正中心)
3. human_type        — 逐字符输入(80-220ms 随机间隔,偶有错字退格)
4. human_scroll      — 随机方向 + 随机量(模拟阅读式滚动)
5. human_pause       — 随机停顿(对数正态分布,符合人类思考时间)
6. simulate_reading  — 滚动 + 停顿组合(模拟真人阅读页面 30s-3min)

设计:
- 所有函数纯 async(适配器用 async_playwright)
- 随机参数用对数正态/三角分布(避免均匀分布的"机器感")
- 鼠标轨迹步数与距离正相关(远距离步数多,近距离步数少)
"""
from __future__ import annotations

import asyncio
import logging
import math
import random
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 分布采样工具(避免均匀分布的"机器感")
# ---------------------------------------------------------------------------

def _lognormal_sample(mean: float, sigma: float = 0.5) -> float:
    """对数正态分布采样(符合人类反应时间分布:多数快,少数慢,极少极慢)。"""
    return math.exp(random.gauss(math.log(mean), sigma))


def _triangular_sample(low: float, high: float, mode: float | None = None) -> float:
    """三角分布采样(比均匀更真实,有众数偏移)。"""
    return random.triangular(low, high, mode if mode is not None else (low + high) / 2)


# ---------------------------------------------------------------------------
# 贝塞尔曲线鼠标轨迹
# ---------------------------------------------------------------------------

def _bezier_points(
    start: tuple[float, float],
    end: tuple[float, float],
    steps: int,
) -> list[tuple[float, float]]:
    """生成 3 阶贝塞尔曲线轨迹点(带微抖动)。

    3 阶贝塞尔需要 4 个控制点:起点 + 2 中间控制点 + 终点。
    中间控制点随机偏移,产生曲线轨迹(非直线)。
    每个点加微抖动(模拟人手颤抖)。
    """
    # 中间控制点:在起终点连线两侧随机偏移
    mid1 = (
        start[0] + (end[0] - start[0]) * 0.3 + random.uniform(-80, 80),
        start[1] + (end[1] - start[1]) * 0.3 + random.uniform(-80, 80),
    )
    mid2 = (
        start[0] + (end[0] - start[0]) * 0.7 + random.uniform(-80, 80),
        start[1] + (end[1] - start[1]) * 0.7 + random.uniform(-80, 80),
    )

    points: list[tuple[float, float]] = []
    for i in range(steps + 1):
        t = i / steps
        # 3 阶贝塞尔公式:B(t) = (1-t)³P0 + 3(1-t)²t P1 + 3(1-t)t² P2 + t³ P3
        x = (
            (1 - t) ** 3 * start[0]
            + 3 * (1 - t) ** 2 * t * mid1[0]
            + 3 * (1 - t) * t ** 2 * mid2[0]
            + t ** 3 * end[0]
        )
        y = (
            (1 - t) ** 3 * start[1]
            + 3 * (1 - t) ** 2 * t * mid1[1]
            + 3 * (1 - t) * t ** 2 * mid2[1]
            + t ** 3 * end[1]
        )
        # 微抖动(人手颤抖,±1px)
        x += random.uniform(-1, 1)
        y += random.uniform(-1, 1)
        points.append((x, y))
    return points


async def human_move_mouse(
    page: Any,
    x: float,
    y: float,
    start: tuple[float, float] | None = None,
) -> None:
    """人类化移动鼠标到 (x, y)。

    用贝塞尔曲线轨迹,步数与距离正相关,每步间隔 10-30ms。
    """
    if start is None:
        # 从随机起点出发(模拟鼠标当前位置)
        start = (random.uniform(50, 400), random.uniform(50, 300))

    dist = math.hypot(x - start[0], y - start[1])
    # 步数:每 50px 一步,最少 5 步,最多 50 步
    steps = max(5, min(50, int(dist / 50)))

    points = _bezier_points(start, (x, y), steps)
    for px, py in points:
        await page.mouse.move(px, py)
        await asyncio.sleep(_triangular_sample(0.008, 0.025, 0.015))


async def human_click(
    page: Any,
    selector: str | None = None,
    x: float | None = None,
    y: float | None = None,
    button: str = "left",
    double: bool = False,
) -> None:
    """人类化点击:移动到目标 + 随机偏移 + 点击。

    可传 selector(优先)或 x/y 坐标。点击位置在目标范围内随机偏移
    (不总点正中心,符合真人点击行为)。
    """
    if selector:
        element = await page.query_selector(selector)
        if not element:
            logger.warning("[behavior] 元素未找到: %s", selector)
            return
        box = await element.bounding_box()
        if not box:
            logger.warning("[behavior] 元素无 boundingBox: %s", selector)
            return
        # 在元素范围内随机偏移(不点正中心)
        target_x = box["x"] + box["width"] * random.uniform(0.2, 0.8)
        target_y = box["y"] + box["height"] * random.uniform(0.2, 0.8)
    else:
        if x is None or y is None:
            raise ValueError("human_click 需要 selector 或 x/y")
        # 在目标周围 ±5px 随机偏移
        target_x = x + random.uniform(-5, 5)
        target_y = y + random.uniform(-5, 5)

    # 移动到目标
    await human_move_mouse(page, target_x, target_y)
    # 点击前微停顿(50-150ms,模拟瞄准)
    await asyncio.sleep(_triangular_sample(0.05, 0.15, 0.08))
    # 点击
    await page.mouse.click(target_x, target_y, button=button, click_count=2 if double else 1)
    # 点击后停顿(100-300ms,模拟反应)
    await asyncio.sleep(_triangular_sample(0.1, 0.3, 0.15))


async def human_type(page: Any, text: str, selector: str | None = None) -> None:
    """人类化输入文本:逐字符输入,随机间隔 80-220ms,偶有错字退格。

    真人打字特征:
    - 字符间隔对数正态分布(多数 80-150ms,少数 200ms+)
    - 偶尔打错字然后退格修正(1-3% 概率)
    - 标点后停顿更长(200-400ms)
    """
    if selector:
        await page.click(selector)
        await asyncio.sleep(_triangular_sample(0.1, 0.3, 0.15))

    for i, char in enumerate(text):
        # 偶尔打错字(1.5% 概率,非首字符)
        if i > 0 and random.random() < 0.015:
            wrong_char = chr(ord(char) + random.randint(1, 3))
            await page.keyboard.type(wrong_char)
            await asyncio.sleep(_triangular_sample(0.1, 0.25, 0.15))
            # 退格修正
            await page.keyboard.press("Backspace")
            await asyncio.sleep(_triangular_sample(0.1, 0.25, 0.15))

        await page.keyboard.type(char)
        # 字符间隔:标点后更长
        if char in ".,;:!?。,;:!?\n":
            await asyncio.sleep(_lognormal_sample(0.25, 0.4))
        else:
            await asyncio.sleep(_lognormal_sample(0.12, 0.4))


async def human_scroll(page: Any, direction: str = "down", amount: int | None = None) -> None:
    """人类化滚动:随机方向 + 随机量,多步滚动(非一次到位)。

    真人滚动:多段滚动,每段 100-500px,中间停顿。
    """
    if amount is None:
        amount = random.randint(100, 500)

    delta = amount if direction == "down" else -amount
    # 分 2-4 段滚动
    segments = random.randint(2, 4)
    per_segment = delta / segments
    for _ in range(segments):
        await page.mouse.wheel(0, per_segment)
        await asyncio.sleep(_triangular_sample(0.2, 0.6, 0.35))


async def human_pause(min_s: float = 0.5, max_s: float = 3.0) -> None:
    """人类化停顿(对数正态分布,符合人类思考时间)。"""
    mean = (min_s + max_s) / 2
    wait = _lognormal_sample(mean, 0.5)
    wait = max(min_s, min(max_s, wait))
    await asyncio.sleep(wait)


async def simulate_reading(page: Any, min_s: float = 30.0, max_s: float = 180.0) -> None:
    """模拟真人阅读页面:滚动 + 停顿组合,持续 30s-3min。

    真人阅读特征:滚动一段 → 停顿阅读 → 再滚动 → 偶尔返回。
    """
    total = 0.0
    target = random.uniform(min_s, max_s)
    logger.debug("[behavior] 模拟阅读 %.1f 秒", target)

    while total < target:
        # 滚动一段
        direction = random.choice(["down", "down", "down", "up"])  # 偏向下,偶尔上
        await human_scroll(page, direction=direction)
        total += 0.5
        # 阅读停顿(5-20s)
        pause = random.uniform(5, 20)
        pause = min(pause, target - total)
        if pause > 0:
            await asyncio.sleep(pause)
            total += pause

        # 偶尔鼠标移动(10% 概率)
        if random.random() < 0.1:
            x = random.uniform(100, 800)
            y = random.uniform(100, 500)
            await human_move_mouse(page, x, y)
            total += 0.3


__all__ = [
    "human_move_mouse",
    "human_click",
    "human_type",
    "human_scroll",
    "human_pause",
    "simulate_reading",
]
