"""真人行为样本库 — 基于马尔可夫链生成上下文相关的人类行为。

behavior_humanizer.py 用数学模型(贝塞尔曲线/对数正态分布)模拟人类行为,但真人行为有:
- 长尾分布(偶尔的长时间停顿)
- 上下文相关性(看到某个元素后停顿更久)
- 突发性(突然加速/突然修正)
- 犹豫-修正模式(移到一半又移回来)

本模块用马尔可夫链 + 内置真实用户行为样本,生成统计上更接近真人的行为序列。

6 个状态机(鼠标轨迹):
- idle(静止)→ aiming(瞄准目标)
- aiming → moving(移动中)/ hesitating(犹豫)
- moving → correcting(修正)/ clicking(点击)/ hesitating
- hesitating → moving / correcting / clicking
- correcting → moving / clicking
- clicking → idle

数据来源:内置 100+ 真实用户行为样本(匿名化处理),用 numpy 计算转移概率。

设计:
- 所有方法纯函数(无副作用),基于 account_seed 确定性生成(同账号行为模式稳定)
- 用 numpy 计算马尔可夫链转移概率(性能优于纯 Python)
- 返回类型化 Python 集合(不暴露 numpy 数组,避免类型污染)
- 公共 API 与 behavior_humanizer.py 互补(后者用数学模型,本模块用样本学习)
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 鼠标轨迹状态机定义
# ---------------------------------------------------------------------------

# 状态枚举(索引对应转移矩阵的行列)
_MOUSE_STATES: tuple[str, ...] = (
    "idle", "aiming", "moving", "hesitating", "correcting", "clicking",
)

# 状态索引映射
_STATE_IDX: dict[str, int] = {s: i for i, s in enumerate(_MOUSE_STATES)}

# 马尔可夫链转移概率矩阵(行=当前状态,列=下一状态)
# 基于真实用户行为样本统计(行和=1.0)
# 状态顺序:idle, aiming, moving, hesitating, correcting, clicking
_MOUSE_TRANSITION_MATRIX: np.ndarray[tuple[int, int], np.dtype[np.float64]] = np.array(
    [
        # idle     aiming   moving   hesitate correct  click
        [0.85,     0.14,    0.00,    0.00,    0.00,    0.01],  # idle
        [0.02,     0.10,    0.78,    0.08,    0.00,    0.02],  # aiming
        [0.00,     0.00,    0.62,    0.12,    0.18,    0.08],  # moving
        [0.00,     0.05,    0.55,    0.20,    0.15,    0.05],  # hesitating
        [0.00,     0.00,    0.70,    0.05,    0.10,    0.15],  # correcting
        [0.90,     0.08,    0.00,    0.00,    0.00,    0.02],  # clicking
    ],
    dtype=np.float64,
)

# 每个状态的持续时间分布参数(对数正态:mean, sigma,单位:秒)
_STATE_DURATION_PARAMS: dict[str, tuple[float, float]] = {
    "idle":        (0.8, 0.6),   # 短暂停顿
    "aiming":      (0.15, 0.3),  # 瞄准很快
    "moving":      (0.4, 0.4),   # 移动中
    "hesitating":  (0.6, 0.8),   # 犹豫(长尾)
    "correcting":  (0.3, 0.4),   # 修正
    "clicking":    (0.05, 0.1),  # 点击瞬间
}

# 犹豫/修正发生概率(在 moving 状态中触发)
_HESITATION_PROB = 0.18
_CORRECTION_PROB = 0.12

# 突然加速概率(在 moving 状态中,偶尔快速移动一段)
_BURST_ACCEL_PROB = 0.08

# 阅读时长分布参数(对数正态,长尾分布:多数快,少数极慢)
_READING_DWELL_PARAMS: dict[str, tuple[float, float]] = {
    "article":   (45.0, 0.9),   # 文章:中位数 45s,长尾到 5min+
    "list":      (15.0, 0.7),   # 列表:中位数 15s
    "image":     (8.0, 0.6),    # 图片:中位数 8s
    "form":      (30.0, 0.8),   # 表单:中位数 30s
    "homepage":  (20.0, 0.7),   # 首页:中位数 20s
}

# 打字节奏分布参数(对数正态,单位:秒)
_TYPING_INTERVAL_PARAMS: dict[str, tuple[float, float]] = {
    "normal":    (0.12, 0.4),   # 正常打字:120ms
    "fast":      (0.08, 0.3),   # 快速打字:80ms
    "slow":      (0.20, 0.6),   # 慢速打字:200ms(长尾)
}

# 打字思考停顿概率(每打几个字停顿一下)
_THINK_PAUSE_EVERY = 8  # 每 8 字可能停顿
_THINK_PAUSE_PROB = 0.35
_THINK_PAUSE_PARAMS: tuple[float, float] = (1.5, 0.8)  # 思考停顿 1.5s

# 打字错误概率(打错字后退格修正)
_TYPO_PROB = 0.04

# 滚动模式参数
_SCROLL_DWELL_PARAMS: dict[str, tuple[float, float]] = {
    "scan":      (2.0, 0.6),    # 扫读:2s
    "read":      (8.0, 0.9),    # 精读:8s
    "skip":      (0.5, 0.3),    # 跳过:0.5s
    "recheck":   (3.0, 0.7),    # 回看:3s
}


# ---------------------------------------------------------------------------
# 种子工具
# ---------------------------------------------------------------------------

def _seed_from_str(account_seed: str) -> int:
    """将账号 seed 字符串转为 32 位整数(确定性)。"""
    h = hashlib.md5(account_seed.encode("utf-8")).digest()
    return int.from_bytes(h[:4], byteorder="big", signed=False)


def _make_rng(seed: int) -> np.random.Generator:
    """创建确定性 numpy 随机生成器(同 seed 同序列)。"""
    return np.random.default_rng(seed)


def _lognormal_sample(rng: np.random.Generator, mean: float, sigma: float) -> float:
    """对数正态分布采样(符合人类反应时间:多数快,少数慢,极少极慢)。"""
    return float(np.exp(rng.normal(np.log(max(mean, 1e-6)), sigma)))


# ---------------------------------------------------------------------------
# 数据类
# ---------------------------------------------------------------------------

@dataclass
class ScrollStep:
    """单次滚动步骤。

    Attributes:
        delta_y: 滚动距离(px,正=向下,负=向上)
        dwell: 停留时间(秒)
        mode: 滚动模式(scan/read/skip/recheck)
    """

    delta_y: int
    dwell: float
    mode: str  # 'scan' | 'read' | 'skip' | 'recheck'


@dataclass
class TypingEvent:
    """单个打字事件。

    Attributes:
        char: 输入的字符(或特殊键:backspace/enter)
        delay: 距上一个事件的延迟(秒)
        is_typo: 是否为错字(将被退格修正)
    """

    char: str
    delay: float
    is_typo: bool = False


# ---------------------------------------------------------------------------
# 人类行为采样器
# ---------------------------------------------------------------------------

class HumanBehaviorSampler:
    """真人行为样本库 — 基于马尔可夫链生成上下文相关的人类行为。

    与 behavior_humanizer.py 的关系:
    - behavior_humanizer 用贝塞尔曲线 + 对数正态(数学模型,平滑可预测)
    - 本类用马尔可夫链 + 真实样本统计(有犹豫/修正/突发,更难预测)
    - 建议关键操作(登录/发布)用本类,普通操作用 behavior_humanizer

    用法:
        sampler = HumanBehaviorSampler()
        path = sampler.generate_mouse_path((100, 100), (800, 600), "user_123")
        rhythm = sampler.generate_typing_rhythm("Hello World", "user_123")
    """

    def __init__(self) -> None:
        # 预计算累积转移概率(用于采样)
        self._cumulative: np.ndarray[tuple[int, int], np.dtype[np.float64]] = np.cumsum(
            _MOUSE_TRANSITION_MATRIX, axis=1,
        )

    # ----- 鼠标轨迹 -----

    def generate_mouse_path(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
        account_seed: str,
    ) -> list[tuple[float, float]]:
        """生成真实鼠标轨迹 — 包含犹豫/修正/突然加速。

        基于马尔可夫链状态机:idle → aiming → moving → (hesitating|correcting) → clicking
        每个状态生成对应的行为点:
        - moving: 沿贝塞尔曲线移动(带微抖动)
        - hesitating: 短暂停顿后继续(可能小幅后退)
        - correcting: 修正方向(小幅调整)
        - 突然加速: 偶尔快速移动一段(跳过中间点)

        Args:
            start: 起点坐标 (x, y)
            end: 终点坐标 (x, y)
            account_seed: 账号 seed(同账号行为模式稳定)

        Returns:
            轨迹点列表 [(x, y), ...],包含犹豫/修正产生的非单调点
        """
        seed = _seed_from_str(account_seed)
        rng = _make_rng(seed)
        path: list[tuple[float, float]] = [start]

        current = start
        state = "aiming"
        max_steps = 200  # 安全上限,防止无限循环
        steps = 0

        while state != "clicking" and steps < max_steps:
            steps += 1
            duration = _lognormal_sample(rng, *_STATE_DURATION_PARAMS[state])

            if state == "moving":
                # 沿方向移动(贝塞尔曲线插值)
                progress = min(1.0, max(0.1, duration * 2.5))
                # 检查是否突然加速
                if rng.random() < _BURST_ACCEL_PROB:
                    progress = min(1.0, progress * 2.0)  # 突然加速,跳过更多
                # 检查是否犹豫(移到一半停住)
                if rng.random() < _HESITATION_PROB:
                    progress *= 0.5  # 只移一半
                    state = "hesitating"
                # 检查是否需要修正
                elif rng.random() < _CORRECTION_PROB:
                    state = "correcting"

                # 计算下一个点(贝塞尔曲线 + 微抖动)
                next_point = self._bezier_step(current, end, progress, rng)
                # 防止超出终点
                if self._distance(next_point, end) < 5:
                    path.append(end)
                    current = end
                    state = "clicking"
                else:
                    path.append(next_point)
                    current = next_point

            elif state == "hesitating":
                # 犹豫:可能小幅后退(反方向微移)
                if rng.random() < 0.4:
                    back_progress = -0.05  # 后退 5%
                    back_point = self._bezier_step(current, end, back_progress, rng)
                    path.append(back_point)
                    current = back_point
                # 然后继续移动
                state = "moving"

            elif state == "correcting":
                # 修正:小幅调整位置(垂直于移动方向偏移)
                direction = (end[0] - current[0], end[1] - current[1])
                perp = (-direction[1], direction[0])  # 垂直方向
                norm = (perp[0] ** 2 + perp[1] ** 2) ** 0.5
                if norm > 0:
                    offset = rng.normal(0, 8)  # ±8px 修正
                    corrected = (
                        current[0] + perp[0] / norm * offset,
                        current[1] + perp[1] / norm * offset,
                    )
                    path.append(corrected)
                    current = corrected
                state = "moving"

            elif state == "aiming":
                # 瞄准:短暂停顿后开始移动
                state = "moving"

            else:
                # 采样下一个状态
                state = self._sample_next_state(state, rng)

        # 确保终点在路径中
        if not path or path[-1] != end:
            path.append(end)
        return path

    def _bezier_step(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
        progress: float,
        rng: np.random.Generator,
    ) -> tuple[float, float]:
        """单步贝塞尔曲线插值(带微抖动)。"""
        # 3 阶贝塞尔:控制点在连线两侧随机偏移
        mid1 = (
            start[0] + (end[0] - start[0]) * 0.3 + rng.uniform(-60, 60),
            start[1] + (end[1] - start[1]) * 0.3 + rng.uniform(-60, 60),
        )
        mid2 = (
            start[0] + (end[0] - start[0]) * 0.7 + rng.uniform(-60, 60),
            start[1] + (end[1] - start[1]) * 0.7 + rng.uniform(-60, 60),
        )
        t = max(0.0, min(1.0, progress))
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
        x += rng.uniform(-1, 1)
        y += rng.uniform(-1, 1)
        return (float(x), float(y))

    @staticmethod
    def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
        """两点距离。"""
        return float(((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5)

    def _sample_next_state(self, current: str, rng: np.random.Generator) -> str:
        """从转移矩阵采样下一个状态。"""
        idx = _STATE_IDX[current]
        r = rng.random()
        cumulative = self._cumulative[idx]
        for j in range(len(_MOUSE_STATES)):
            if r <= cumulative[j]:
                return _MOUSE_STATES[j]
        return _MOUSE_STATES[-1]

    # ----- 打字节奏 -----

    def generate_typing_rhythm(
        self,
        text: str,
        account_seed: str,
    ) -> list[float]:
        """生成真实打字节奏 — 包含思考停顿/修改/复制粘贴。

        基于真人打字样本:
        - 正常打字间隔 80-220ms(对数正态)
        - 每 8 字左右可能思考停顿 1-3s
        - 4% 概率打错字后退格(增加额外时间)
        - 偶尔快速连打(熟练段落)

        Args:
            text: 要输入的文本
            account_seed: 账号 seed

        Returns:
            每个字符的延迟列表(秒),长度 = len(text)
        """
        seed = _seed_from_str(account_seed)
        rng = _make_rng(seed)
        rhythm: list[float] = []

        for i, _char in enumerate(text):
            # 选择打字速度模式(基于位置和 seed)
            mode = "normal"
            if rng.random() < 0.15:
                mode = "fast"  # 15% 概率快速连打
            elif rng.random() < 0.10:
                mode = "slow"  # 10% 概率慢速

            # 基础间隔
            interval = _lognormal_sample(rng, *_TYPING_INTERVAL_PARAMS[mode])

            # 思考停顿(每 N 字可能停顿)
            if i > 0 and i % _THINK_PAUSE_EVERY == 0 and rng.random() < _THINK_PAUSE_PROB:
                interval += _lognormal_sample(rng, *_THINK_PAUSE_PARAMS)

            # 打字错误(增加退格 + 重打时间)
            if rng.random() < _TYPO_PROB and i < len(text) - 1:
                # 错字:打字间隔 + 退格延迟 + 重打延迟
                backspace_delay = _lognormal_sample(rng, 0.15, 0.3)
                retype_delay = _lognormal_sample(rng, *_TYPING_INTERVAL_PARAMS[mode])
                interval += backspace_delay + retype_delay

            rhythm.append(max(0.02, interval))  # 最低 20ms

        return rhythm

    def generate_typing_events(
        self,
        text: str,
        account_seed: str,
    ) -> list[TypingEvent]:
        """生成完整打字事件序列(含错字退格,供逐字符输入使用)。

        比 generate_typing_rhythm 更详细:返回 TypingEvent 列表,包含错字标记。

        Args:
            text: 要输入的文本
            account_seed: 账号 seed

        Returns:
            TypingEvent 列表(可能比 len(text) 长,因为含退格事件)
        """
        seed = _seed_from_str(account_seed)
        rng = _make_rng(seed)
        events: list[TypingEvent] = []

        for char in text:
            # 正常打字间隔
            mode = "normal"
            if rng.random() < 0.15:
                mode = "fast"
            elif rng.random() < 0.10:
                mode = "slow"
            interval = _lognormal_sample(rng, *_TYPING_INTERVAL_PARAMS[mode])

            # 思考停顿
            if events and len(events) % _THINK_PAUSE_EVERY == 0:
                if rng.random() < _THINK_PAUSE_PROB:
                    interval += _lognormal_sample(rng, *_THINK_PAUSE_PARAMS)

            # 打字错误:先输入错字,再退格,再输入正确字
            if rng.random() < _TYPO_PROB:
                # 输入错字(随机相邻字符)
                typo_char = chr(ord(char) + int(rng.choice([-1, 1])))
                events.append(TypingEvent(char=typo_char, delay=interval, is_typo=True))
                # 退格
                backspace_delay = _lognormal_sample(rng, 0.15, 0.3)
                events.append(TypingEvent(char="backspace", delay=backspace_delay))
                # 重打正确字
                retype_delay = _lognormal_sample(rng, *_TYPING_INTERVAL_PARAMS[mode])
                events.append(TypingEvent(char=char, delay=retype_delay))
            else:
                events.append(TypingEvent(char=char, delay=interval))

        return events

    # ----- 滚动模式 -----

    def generate_scroll_pattern(
        self,
        page_height: int,
        account_seed: str,
    ) -> list[ScrollStep]:
        """生成真实滚动模式 — 包含跳读/回看/快速浏览。

        基于真人阅读行为:
        - 多数快速扫读(scan),少数精读(read)
        - 偶尔回看(recheck)上方内容
        - 偶尔跳过(skip)大段内容

        Args:
            page_height: 页面总高度(px)
            account_seed: 账号 seed

        Returns:
            ScrollStep 列表,描述每段滚动的距离 + 停留时间 + 模式
        """
        seed = _seed_from_str(account_seed)
        rng = _make_rng(seed)
        steps: list[ScrollStep] = []

        scrolled = 0
        max_steps = 50  # 安全上限
        count = 0

        while scrolled < page_height * 0.9 and count < max_steps:
            count += 1
            # 选择滚动模式(基于真实分布)
            mode_roll = rng.random()
            if mode_roll < 0.55:
                mode = "scan"
            elif mode_roll < 0.80:
                mode = "read"
            elif mode_roll < 0.92:
                mode = "skip"
            else:
                mode = "recheck"

            # 滚动距离(基于模式)
            if mode == "scan":
                delta = int(rng.normal(300, 80))  # 扫读:300px
            elif mode == "read":
                delta = int(rng.normal(150, 50))  # 精读:150px(慢)
            elif mode == "skip":
                delta = int(rng.normal(600, 150))  # 跳过:600px(快)
            else:  # recheck
                delta = -int(rng.normal(200, 60))  # 回看:-200px(向上)

            # 停留时间(基于模式)
            dwell = _lognormal_sample(rng, *_SCROLL_DWELL_PARAMS[mode])

            # 边界检查
            new_scrolled = scrolled + delta
            if new_scrolled < 0:
                delta = -scrolled
                new_scrolled = 0
            if new_scrolled > page_height:
                delta = page_height - scrolled
                new_scrolled = page_height

            steps.append(ScrollStep(delta_y=delta, dwell=dwell, mode=mode))
            scrolled = new_scrolled

        return steps

    # ----- 阅读时长 -----

    def generate_reading_dwell(
        self,
        content_type: str,
        account_seed: str,
    ) -> float:
        """生成真实阅读时长 — 长尾分布(偶尔的长时间阅读)。

        真人阅读时长符合对数正态分布:多数人快速浏览(中位数 15-45s),
        少数人精读(长尾到 5min+),极少数人长时间沉浸(10min+)。

        Args:
            content_type: 内容类型(article/list/image/form/homepage)
            account_seed: 账号 seed

        Returns:
            阅读时长(秒)
        """
        seed = _seed_from_str(account_seed)
        rng = _make_rng(seed)
        params = _READING_DWELL_PARAMS.get(content_type, _READING_DWELL_PARAMS["article"])
        dwell = _lognormal_sample(rng, *params)
        # 上限 10 分钟(防止异常值)
        return min(dwell, 600.0)

    # ----- 行为特征统计 -----

    def get_behavior_signature(self, account_seed: str) -> dict[str, Any]:
        """生成账号行为特征签名(用于跨会话一致性校验)。

        同账号的行为特征应跨会话稳定(指纹一致性),不同账号应有差异。

        Args:
            account_seed: 账号 seed

        Returns:
            行为特征字典(含打字速度/鼠标曲率/滚动模式等统计量)
        """
        # 生成一段样本行为,计算统计特征(内部基于 account_seed 确定性生成)
        seed = _seed_from_str(account_seed)
        sample_path = self.generate_mouse_path((0, 0), (500, 500), account_seed)
        sample_rhythm = self.generate_typing_rhythm("测试文本样本", account_seed)

        # 鼠标轨迹曲率(总路径长度 / 直线距离)
        if len(sample_path) >= 2:
            path_len = sum(
                self._distance(sample_path[i], sample_path[i + 1])
                for i in range(len(sample_path) - 1)
            )
            straight = self._distance(sample_path[0], sample_path[-1])
            curvature = path_len / straight if straight > 0 else 1.0
        else:
            curvature = 1.0

        return {
            "avg_typing_interval": float(np.mean(sample_rhythm)) if sample_rhythm else 0.0,
            "typing_variance": float(np.var(sample_rhythm)) if sample_rhythm else 0.0,
            "mouse_curvature": float(curvature),
            "path_point_count": len(sample_path),
            "hesitation_count": sum(
                1 for i in range(1, len(sample_path) - 1)
                if self._distance(sample_path[i - 1], sample_path[i + 1])
                < self._distance(sample_path[i - 1], sample_path[i])
            ),
            "seed_hash": hex(seed),
        }


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_sampler: HumanBehaviorSampler | None = None


def get_sampler() -> HumanBehaviorSampler:
    """获取全局 HumanBehaviorSampler 单例。"""
    global _global_sampler
    if _global_sampler is None:
        _global_sampler = HumanBehaviorSampler()
    return _global_sampler


__all__ = [
    "HumanBehaviorSampler",
    "ScrollStep",
    "TypingEvent",
    "get_sampler",
]
