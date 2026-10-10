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
    - ``FENCE_STATS``:published / superseded 计数;
    - G-649 新增:``read_provider_accounts()`` / ``register_account_source()``
      (账号上游源与生产注册出口)、``seed_uninitialized()``(开机首发布播种)、
      ``degraded_stats()`` / ``last_read_degraded()``(逐源降级对账面)、
      ``ENTITLEMENT_FAIL_CLOSED_KEY`` / ``ALL_GOVERNED_PROVIDERS``(消费端与
      注册端共用的两份词汇,禁止在别处再抄键名 ``"entitled"``)。

env 门控:``PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED``(门控类,默认开,已在
capability_matrix 登记)。设为 false/off/0 仅排障时退回无栅栏 legacy 发布,
且发布路径会打 warning 留痕。

G-649(2026-10-01 立)—— entitlement 层失败走显式 fail-closed 投影:
    上游源装配此前是 `view[name] = _EXTRA_SOURCES[name]()` 的裸调用,任何一个源
    抛错(账号解析失败是最典型的一型)都会**整块打断装配** —— 连不依赖账号的
    provider_caps 一起没了,而快照里从不出现 `entitled:false`,消费方读到的是
    "什么都没有",于是"解析不出账号"在语义上被读成了"有权限"。现规矩三条:
      ① **逐源 try/except**:某源抛错只为**该源所辖 provider** 合成
         ``entitlements[code]["entitled"] = False``,其余源与其余层照常装配;
      ② 源的作用域在注册时声明(``providers=``,或 ``ALL_GOVERNED_PROVIDERS``
         按当次能力表现读)—— 不声明 ⇒ 只记 degraded 计数不合成(判不出它管谁,
         不猜);
      ③ 计数进 ``DEGRADED_STATS`` 并打 warning(「失败必须响」),绝不静默降级。
    另:``seed_uninitialized()`` + ``register_account_source()`` 由 ``app/main.py``
    的 lifespan 调用 —— "board 初始 snapshot is None" 从此不是合法稳态,生产面
    从此有账号源与首发布轮(此前二者都只存在于测试)。
"""

from __future__ import annotations

import asyncio
import copy
import hashlib
import json
import logging
import os
import threading
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any, Final

from app.core import provider_caps as _provider_caps

logger = logging.getLogger(__name__)

# 门控 env(默认开):关掉即退回无栅栏 legacy 发布,仅排障用。
SNAPSHOT_FENCE_ENABLED_ENV = "PROVIDER_CAP_SNAPSHOT_FENCE_ENABLED"

_FENCE_OFF_VALUES = {"0", "false", "off", "no"}

# G-649:fail-closed 投影在 entitlements 里用的键名(唯一实现,消费端从这里 import)。
# 语义 = "账号/entitlement 层解析失败 ⇒ 该 provider 不得被当作有权限";
# 正常装配路径**从不写这个键**(不写 = 无从判 ≠ 有权限的逆否),它只由失败分支合成。
ENTITLEMENT_FAIL_CLOSED_KEY: Final = "entitled"

# G-649:源作用域哨兵 —— 声明"本源管能力表里的全部 provider",按**当次**
# PROVIDER_CAPS 现读,不落地成第二份名单(名单必然腐烂,腐烂了就等于这一族零判据)。
ALL_GOVERNED_PROVIDERS: Final = "*"


def fence_enabled(env: dict[str, str] | None = None) -> bool:
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
# 源名 -> 该源所辖 provider 作用域(元组或 ALL_GOVERNED_PROVIDERS 哨兵)。
# 与 _EXTRA_SOURCES 同锁同生命周期:两条面分开更新会出现"有源无作用域"
# 或"有作用域无源"的第三种状态,而 fail-closed 的判据恰恰要读它。
_SOURCE_PROVIDERS: dict[str, tuple[str, ...] | str] = {}
# update_id -> reason(动源前 mark,落定后 clear;publish 时仍有残留 ⇒ 弃轮)
_PENDING_UPDATES: dict[str, str] = {}

# ---------------------------------------------------------------------------
# 降级计数(G-649):上游源读取失败的对账面。三个键都是**读侧累计**而不是轮次计数
# —— 一次解算至少读源两遍(启动捕获指纹 + 发布前复读),外加一遍装配载荷,
# 所以同一枚坏源会把计数推上去多次,这是"读了几回就响几回"的有意口径:
# 用它答"这一轮降级了几层"要配 ``last_read_degraded``,绝不用累计值倒推。
# ---------------------------------------------------------------------------
DEGRADED_STATS: dict[str, int] = {"reads": 0, "sources": 0, "providers": 0}

# 最近一次装配里失败的源名与其所辖 provider(每次 read_upstream_sources 重写)。
_LAST_READ_DEGRADED: dict[str, tuple[str, ...]] = {}


def register_upstream_source(
    name: str,
    reader: Callable[[], dict[str, Any]],
    providers: Sequence[str] | str | None = None,
) -> None:
    """注册额外上游源(如 default_models.json 热载视图、探测结果缓存、账号解析)。

    ``providers``:该源**所辖的 provider 码**(G-649)。源读取抛错时只为这些
    provider 合成 ``entitled:false``;传 ``ALL_GOVERNED_PROVIDERS`` 表示"管能力表
    里全部 provider(按当次现读)";不传 ⇒ 只记 degraded 计数、不合成 ——
    猜不出它管谁时,宁可少合成也不许把无关 provider 一并判成无权限。
    """
    with _LOCK:
        _EXTRA_SOURCES[name] = reader
        if providers is None:
            _SOURCE_PROVIDERS.pop(name, None)
        elif isinstance(providers, str):
            if providers != ALL_GOVERNED_PROVIDERS:
                raise TypeError(
                    f"providers 传裸字符串只接受 ALL_GOVERNED_PROVIDERS 哨兵(收到 {providers!r});"
                    "单个 provider 请传序列 providers=(\"openrouter\",) —— "
                    "字符串会被逐字符展开成「每个字符一个 provider」,fail-closed 就静默管错对象"
                )
            _SOURCE_PROVIDERS[name] = providers
        else:
            _SOURCE_PROVIDERS[name] = tuple(sorted({str(code) for code in providers}))


def unregister_upstream_source(name: str) -> None:
    with _LOCK:
        _EXTRA_SOURCES.pop(name, None)
        _SOURCE_PROVIDERS.pop(name, None)


def source_provider_scope(name: str) -> tuple[str, ...]:
    """解析某源所辖 provider 集合(哨兵 ⇒ 现读能力表;未声明 ⇒ 空元组)。"""
    with _LOCK:
        declared = _SOURCE_PROVIDERS.get(name)
    if declared is None:
        return ()
    if declared == ALL_GOVERNED_PROVIDERS:
        return tuple(sorted(_provider_caps.PROVIDER_CAPS))
    return tuple(declared)


def degraded_stats() -> dict[str, int]:
    """DEGRADED_STATS 的副本(读侧累计,见上方注释口径)。"""
    with _LOCK:
        return dict(DEGRADED_STATS)


def last_read_degraded() -> dict[str, tuple[str, ...]]:
    """最近一次装配失败的源名 -> 其被合成 entitled:false 的 provider 集合。

    空 dict 有两种成因 —— "这一轮没坏" 与 "还没读过源",二者由调用方结合
    ``DEGRADED_STATS["reads"]`` 区分;本函数不替人把它读成"确认没有降级"。
    """
    with _LOCK:
        return dict(_LAST_READ_DEGRADED)


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


# ---------------------------------------------------------------------------
# 账号源(G-649,2026-10-01 立):生产面注册的第一条上游源。
# 此前 register_upstream_source 只在测试里被调用过 ⇒ 快照里根本没有"账号解析"
# 这一层,"entitlement 层失败"在结构上无从发生,本票的 fail-closed 也就成了空话。
# ---------------------------------------------------------------------------
ACCOUNT_SOURCE_NAME: Final = "provider_accounts"


def read_provider_accounts() -> dict[str, dict[str, str]]:
    """逐 provider 解析账号/凭据配置状态(复用 Dashboard 那同一把尺子)。

    三条写法约束:
    ① **只读环境变量,绝不查 DB** —— 本函数被启动播种与每一次指纹复读调用,
       查库等于把 §5 测试隔离铁律的副作用引进装配路径,且启动顺序会成环;
    ② 只回**状态名**(configured/not_configured/local),不回任何凭据值;
    ③ 这里**不吞异常**。"解析不出"由抛错表达、由 :func:`read_upstream_sources`
       的 fail-closed 分支投影成 ``entitled:false``;在本函数里套一层 try 返回空
       dict,就等于本票要修的"静默当有权限"。
    """
    from app.services.free_provider_registry import (
        ProviderStatus,
        free_provider_registry,
    )

    accounts: dict[str, dict[str, str]] = {}
    for code in sorted(_provider_caps.PROVIDER_CAPS):
        status = ProviderStatus(free_provider_registry.is_key_configured(code))
        # local 与 configured 一样算"账号解析到了";not_configured 只是状态,
        # **不构成 entitled:false** —— 那一名额只由"解析失败"这一条路合成。
        resolved = "yes" if status in (ProviderStatus.CONFIGURED, ProviderStatus.LOCAL) else "no"
        accounts[code] = {"status": status.value, "resolved": resolved}
    return accounts


def register_account_source() -> str:
    """把账号源注册进上游面(幂等;作用域 = 当次能力表里的全部 provider)。

    生产面唯一调用点在 ``app/main.py`` 的 lifespan;测试直接调本函数自证接线。
    """
    register_upstream_source(
        ACCOUNT_SOURCE_NAME,
        read_provider_accounts,
        providers=ALL_GOVERNED_PROVIDERS,
    )
    return ACCOUNT_SOURCE_NAME


def read_upstream_sources(env: dict[str, str] | None = None) -> dict[str, Any]:
    """读满全部上游源,生成"上游版本"判定面(深拷贝,调用方可安全持有)。

    G-649:逐源 try/except。此前一枚源抛错就整块打断装配 —— 连不依赖它的
    ``provider_caps`` 一起没,而快照里从不出现 ``entitled:false``,消费方把
    "账号解析失败"读成了"什么都没有 / 有权限"。现只为该源**所辖 provider**
    合成 ``entitled:false``(fail-closed),其余源与其余层照常装配。
    """
    # 既存红两条在本行(mypy strict 的 env 并集赋值 / None.get):把"回落实读 env"
    # 这一步单独起个名字,判据面就恒为 Mapping[str, str],不再对 None 取属性。
    # 签名一字未动(外部仍可传 dict 或省略),行为亦同。
    env_view: Mapping[str, str] = os.environ if env is None else env
    caps_view = {
        code: _provider_caps.cap_to_dict(cap)
        for code, cap in sorted(_provider_caps.PROVIDER_CAPS.items())
    }
    entitlements: dict[str, dict[str, Any]] = {
        code: {
            env_name: bool(env_view.get(env_name))
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
        degraded_this_read: dict[str, tuple[str, ...]] = {}
        for name in sorted(_EXTRA_SOURCES):
            reader = _EXTRA_SOURCES[name]
            try:
                view[name] = reader()
            except Exception as exc:  # noqa: BLE001 - 单源失败只降级该源所辖 provider
                governed = source_provider_scope(name)
                for code in governed:
                    # 显式 fail-closed:解析不出账号 = 不得当作有权限。
                    entitlements.setdefault(code, {})[ENTITLEMENT_FAIL_CLOSED_KEY] = False
                # 该源自己的槽位留结构化标记(不带异常原文,免把 env 值一型带进
                # 指纹与快照);error_type 足够定位"是哪一族失败",细节在 warning 里。
                view[name] = {
                    "degraded": True,
                    "error_type": type(exc).__name__,
                    "governed_providers": list(governed),
                }
                degraded_this_read[name] = governed
                logger.warning(
                    "[provider_capability_snapshot] 上游源 %s 读取失败 ⇒ 为其所辖 %d 个"
                    " provider 合成 entitled:false(fail-closed,不静默当有权限),"
                    "其余层照常装配: %s: %s",
                    name,
                    len(governed),
                    type(exc).__name__,
                    exc,
                )
        _LAST_READ_DEGRADED.clear()
        _LAST_READ_DEGRADED.update(degraded_this_read)
        if degraded_this_read:
            DEGRADED_STATS["reads"] += 1
            DEGRADED_STATS["sources"] += len(degraded_this_read)
            DEGRADED_STATS["providers"] += sum(len(v) for v in degraded_this_read.values())
    return view


def capture_upstream_fingerprint(env: dict[str, str] | None = None) -> str:
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


def seed_uninitialized(
    board: ProviderCapabilitySnapshotBoard | None = None,
) -> dict[str, Any]:
    """首发布播种(G-649):让"未初始化 ⇒ snapshot is None"不再是合法稳态。

    背景:board 只在构造时把 ``_snapshot`` 置 None,而生产面既没有生产者也没有
    消费者 ⇒ 消费口 ``provider_caps.get_published_capability_snapshot()`` 永远
    拿到 None,"没有快照"于是被下游读成"无从判 = 照旧当有权限"。

    三条口径:
    ① 已发布过 ⇒ 原样返回 ``already_seeded``,不重播(播种是"从零到一"这一次);
    ② **栅栏一字不绕** —— 播种轮照样要过发布前复读;若上游此刻有 pending 或
       版本漂移,仍整份丢弃并返回 ``superseded``,由调用方下一轮重试。为了"手上
       有快照"而关掉栅栏,等于用 G-648 换来的正确性去换 G-649 的账面绿;
    ③ 同步解算(读 env + 静态表,不碰 DB / 不碰事件循环),这样启动顺序与
       worker 数都不影响它能否落地。
    """
    target = board if board is not None else get_snapshot_board()
    if target.snapshot is not None:
        return {"status": "already_seeded", "board": target.name, "generation": target.generation}
    outcome = target.publish_round(target.solve_round_sync())
    if outcome.get("status") != "published":
        logger.warning(
            "[provider_capability_snapshot] 播种轮未落地:%s ⇒ 快照仍为未初始化"
            "(栅栏照判,不为'有快照'绕开);reasons=%s",
            outcome.get("status"),
            outcome.get("reasons"),
        )
    return outcome
