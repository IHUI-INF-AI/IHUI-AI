# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""供应商能力/entitlement 快照装配出口 + 发布前复读栅栏(G-648,2026-09-30 立)。

背景(计划票 G-648):
    llm_gateway.py 消费 provider_caps.PROVIDER_CAPS 静态能力表;上游源(配置、
    凭据/entitlement env、外部探测结果)会在进程运行期间异步变化。历史病理:
    异步解算完成后直接发布快照,解算期间上游又变了 ⇒ 把基于旧源算出的快照
    盖到新源上,只能"先发布再修正"。本模块把发布前复读栅栏(fence)固化在
    装配出口:

        解算启动时捕获上游版本(全源内容指纹)→ 异步解算 → 发布前【重读】
        上游版本并与捕获值比对;版本变了或仍有 pending 的上游更新
        ⇒ 本轮解算【整份丢弃】,快照保持旧值,绝不"先发布再修正"。

    丢弃路径必须带 superseded 标记 + 计数(见 ``FENCE_STATS["superseded"]``)
    + warning 日志,便于事后对账"哪几轮被栅栏吃掉了"。

对外接口:
    - ``capture_upstream_fingerprint()``:全部上游源的内容指纹(sha256);
    - ``read_upstream_sources()``:上游源视图(静态 caps + entitlement env +
      外部注册源),即"上游版本"的判定面;
    - ``register_upstream_source()``:注册额外上游源(配置热载/探测结果注入点);
    - ``mark_pending_update() / clear_pending_update() / has_pending()``:
      上游更新 pending 台账 —— 生产者动源前 mark、落定后 clear;
    - ``SnapshotRound`` / ``ProviderCapabilitySnapshotBoard.start_round /
      solve_round / publish_round``:解算轮次与栅栏发布出口;
    - ``get_snapshot_board()``:进程级默认 board(llm_gateway 侧消费);
    - ``FENCE_STATS``:published / superseded 计数。

env 门控:``PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED``(门控类,默认开,已在
capability_matrix 登记)。设为 false/off/0 仅排障时退回无栅栏 legacy 发布,
且发布路径会打 warning 留痕。
"""

from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import logging
import os
import threading
from dataclasses import dataclass
from typing import Any, Callable

from app.core import provider_caps as _provider_caps

logger = logging.getLogger(__name__)

# 门控 env(默认开):关掉即退回无栅栏 legacy 发布,仅排障用。
SNAPSHOT_FENCE_ENABLED_ENV = "PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED"

_FENCE_OFF_VALUES = {"0", "false", "off", "no"}


def fence_enabled(env: "dict[str, str] | None" = None) -> bool:
    """栅栏开关(门控类,默认开)。env 参数供测试注入,缺省实读 os.environ。"""
    raw = (env or os.environ).get(SNAPSHOT_FENCE_ENABLED_ENV)
    if raw is None or not raw.strip():
        return True
    return raw.strip().lower() not in _FENCE_OFF_VALUES


# ---------------------------------------------------------------------------
# 栅栏计数:丢弃路径必须计数(验收/对账依据),绝不静默吞轮。
# ---------------------------------------------------------------------------
FENCE_STATS: dict[str, int] = {"published": 0, "superseded": 0}


# ---------------------------------------------------------------------------
# 上游源:pseudo-fs 版本面。静态 caps 是内置源;外部(配置热载/探测结果)
# 通过 register_upstream_source 注入,pending 由生产者显式登记。
# ---------------------------------------------------------------------------
_LOCK = threading.RLock()

_EXTRA_SOURCES: dict[str, Callable[[], dict[str, Any]]] = {}
# update_id -> reason(动源前 mark,落定后 clear;publish 时仍有残留 ⇒ 弃轮)
_PENDING_UPDATES: dict[str, str] = {}


def register_upstream_source(name: str, reader: Callable[[], dict[str, Any]]) -> None:
    """注册额外上游源(如 default_models.json 热载视图、探测结果缓存)。"""
    with _LOCK:
        _EXTRA_SOURCES[name] = reader


def unregister_upstream_source(name: str) -> None:
    with _LOCK:
        _EXTRA_SOURCES.pop(name, None)


def mark_pending_update(update_id: str, reason: str = "") -> None:
    """上游更新开始:动源前登记,发布面随即进入"有 pending 必弃"状态。"""
    with _LOCK:
        _PENDING_UPDATES[update_id] = reason


def clear_pending_update(update_id: str) -> None:
    """上游更新落定:解除 pending(下一轮解算即可正常发布)。"""
    with _LOCK:
        _PENDING_UPDATES.pop(update_id, None)


def pending_updates() -> tuple[str, ...]:
    with _LOCK:
        return tuple(sorted(_PENDING_UPDATES))


def has_pending() -> bool:
    return bool(pending_updates())


def read_entitlements() -> dict[str, dict[str, bool]]:
    """entitlement 面:各 provider 的凭据/头 env 当前是否可用(只记有无,不记值)。"""
    entitlements: dict[str, dict[str, bool]] = {}
    for code, cap in sorted(_provider_caps.PROVIDER_CAPS.items()):
        for _header, env_name in sorted((cap.env_headers or {}).items()):
            entitlements.setdefault(code, {})[env_name] = bool(os.environ.get(env_name))
    return entitlements


def read_upstream_sources(env: "dict[str, str] | None" = None) -> dict[str, Any]:
    """读满全部上游源,生成"上游版本"判定面(深拷贝,调用方可安全持有)。"""
    env = env if env is not None else os.environ
    caps_view = {
        code: _provider_caps.cap_to_dict(cap)
        for code, cap in sorted(_provider_caps.PROVIDER_CAPS.items())
    }
    entitlements = {
        code: {
            env_name: bool(env.get(env_name))
            for _header, env_name in sorted((cap.env_headers or {}).items())
        }
        for code, cap in sorted(_provider_caps.PROVIDER_CAPS.items())
        if cap.env_headers
    }
    with _LOCK:
        view: dict[str, Any] = {
            "provider_caps": caps_view,
            "entitlements": entitlements,
        }
        for name in sorted(_EXTRA_SOURCES):
            view[name] = _EXTRA_SOURCES[name]()
    return view


def capture_upstream_fingerprint(env: "dict[str, str] | None" = None) -> str:
    """上游版本号 = 全源规范化 JSON 的 sha256(内容指纹,源任何一处变即变)。"""
    payload = json.dumps(
        read_upstream_sources(env),
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# 解算轮次与栅栏发布出口
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SnapshotRound:
    """一轮异步解算:启动时捕获的版本 + 解算产物(整份,绝不半份发布)。"""

    captured_fingerprint: str
    captured_pending: tuple[str, ...]
    payload: dict[str, Any]


def default_payload_builder() -> dict[str, Any]:
    """默认解算器:读满上游源装配快照载荷(深拷贝,与源解耦)。"""
    return copy.deepcopy(read_upstream_sources())


class ProviderCapabilitySnapshotBoard:
    """供应商能力快照 board:异步解算 + 发布前复读栅栏。

    用法(生产者侧):
        round = await board.solve_round()      # 启动时捕获版本 + 异步解算
        outcome = board.publish_round(round)   # 发布前重读版本/pending,不符即弃
    """

    def __init__(
        self,
        name: str = "provider_caps",
        payload_builder: Callable[[], dict[str, Any]] | None = None,
    ) -> None:
        self.name = name
        self._payload_builder = payload_builder or default_payload_builder
        self._snapshot: dict[str, Any] | None = None
        self._generation = 0
        self._lock = threading.RLock()

    @property
    def snapshot(self) -> dict[str, Any] | None:
        """最近一次通过栅栏发布的快照(未发布过为 None;被弃轮不改此值)。"""
        return self._snapshot

    @property
    def generation(self) -> int:
        return self._generation

    def start_round(self) -> tuple[str, tuple[str, ...]]:
        """解算启动:捕获上游版本(指纹)与当时 pending 台账。"""
        fingerprint = capture_upstream_fingerprint()
        with _LOCK:
            return fingerprint, tuple(sorted(_PENDING_UPDATES))

    async def solve_round(self) -> SnapshotRound:
        """异步解算:捕获版本 →(线程池)读源装配整份载荷。"""
        fingerprint, pending = self.start_round()
        loop = asyncio.get_running_loop()
        payload = await loop.run_in_executor(None, self._payload_builder)
        return SnapshotRound(
            captured_fingerprint=fingerprint,
            captured_pending=pending,
            payload=payload,
        )

    def solve_round_sync(self) -> SnapshotRound:
        """同步解算变体(无事件循环的调用方/测试用)。"""
        fingerprint, pending = self.start_round()
        return SnapshotRound(
            captured_fingerprint=fingerprint,
            captured_pending=pending,
            payload=self._payload_builder(),
        )

    def _fence_verdict(self, round: SnapshotRound) -> list[str]:
        """发布前复读:重读上游版本与 pending,与解算启动时捕获值比对。

        版本变了或仍有 pending ⇒ 返回丢弃理由列表(非空 = 本轮整份丢弃)。
        """
        current_fingerprint = capture_upstream_fingerprint()
        pending_now = pending_updates()
        reasons: list[str] = []
        if pending_now:
            reasons.append(f"pending_updates_remaining={list(pending_now)}")
        if current_fingerprint != round.captured_fingerprint:
            reasons.append(
                "upstream_version_changed: "
                f"captured={round.captured_fingerprint[:12]} current={current_fingerprint[:12]}"
            )
        return reasons

    def publish_round(self, round: SnapshotRound) -> dict[str, Any]:
        """栅栏发布出口:写快照前复读上游版本,不符即整份丢弃、保持旧值。"""
        if fence_enabled():
            reasons = self._fence_verdict(round)
            if reasons:
                FENCE_STATS["superseded"] += 1
                logger.warning(
                    "[provider_capability_snapshot] round superseded: 本轮解算整份丢弃,"
                    "快照保持旧值(绝不先发布再修正);board=%s captured=%s reasons=%s",
                    self.name,
                    round.captured_fingerprint[:12],
                    "; ".join(reasons),
                )
                return {
                    "status": "superseded",
                    "board": self.name,
                    "reasons": reasons,
                    "generation": self._generation,
                }
        else:
            logger.warning(
                "[provider_capability_snapshot] fence disabled(%s=%s):"
                "board=%s 以无栅栏 legacy 路径发布",
                SNAPSHOT_FENCE_ENABLED_ENV,
                os.environ.get(SNAPSHOT_FENCE_ENABLED_ENV, ""),
                self.name,
            )
        with self._lock:
            # 整份换入:被栅栏放行的轮才允许触碰快照,绝不半份/混面写入。
            self._snapshot = copy.deepcopy(round.payload)
            self._generation += 1
            generation = self._generation
        FENCE_STATS["published"] += 1
        logger.info(
            "[provider_capability_snapshot] snapshot published; board=%s generation=%d",
            self.name,
            generation,
        )
        return {"status": "published", "board": self.name, "generation": generation}

    async def refresh(self) -> dict[str, Any]:
        """解算→发布一步式出口(生产调度方调用)。"""
        round = await self.solve_round()
        return self.publish_round(round)


_DEFAULT_BOARD: ProviderCapabilitySnapshotBoard | None = None
_DEFAULT_BOARD_LOCK = threading.Lock()


def get_snapshot_board() -> ProviderCapabilitySnapshotBoard:
    """进程级默认 board(llm_gateway / 端点消费同一份)。"""
    global _DEFAULT_BOARD
    with _DEFAULT_BOARD_LOCK:
        if _DEFAULT_BOARD is None:
            _DEFAULT_BOARD = ProviderCapabilitySnapshotBoard()
        return _DEFAULT_BOARD
