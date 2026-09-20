# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""网络访问审批面(批 52:审批策略面,对标 OpenAI codex-rs approvals.rs)。

对标关系
--------
codex ``approvals.rs``(审计副本 G:/tmp-probe/codex-rs-audit/.../tools/approvals.rs
约行 134)的 ``ApprovalAction::NetworkAccess`` 变体,按
``target(host) / protocol / port`` 三元组发起网络访问审批;用户批准后,
**同 target 不再重复弹审批**(codex 的 ``with_cached_approval`` + 持久化缓存键
语义)。

ihui 现状:
- ``app/services/network_guard.py`` 的 ``NetworkEgressPolicy.check(url)`` 是
  **静态策略**(白名单 + SSRF localhost 判定),无「人机审批」交互层;
- ``mcp_server.py`` 的网络工具(``_tool_fetch_url`` / webhook / ``web_search``)
  目前只走 scanner/guard 静态检查,没有「批准一次、后续免弹」的缓存。

本模块补上「审批交互 + 持久化缓存」这一层(进程内无 UI,fail-closed):
- 用批 51 的 ``approval_persistence`` 落盘授权,使批准可跨调用/跨重启保留;
- 默认 ``session`` scope + ``ttl_seconds`` 控制有效期,过期后恢复弹批。

关于 KIND 复用决策(重要)
------------------------
批 51 持久层 ``approval_persistence._KINDS`` 是**冻结白名单**
``{exec_prefix, exec_once, mcp_tool, network}``,网络审批使用独立
``KIND_NET = "network"``(批 52 主会话升级:持久层已扩白名单),缓存键仍带
``net\\x1f`` 单元分隔符前缀(``net\\x1f<host>\\x1f<port>\\x1f<scheme>``)
以自描述键空间;``stats().byKind`` 可单独观测网络审批计数。

设计要点
--------
- 纯标准库;``httpx`` 为可选(模块不强制 import,接线方自行注入 requester);
- 所有持久层调用 try/except 包裹,异常一律按「未命中 / 拒绝」降级(fail-closed);
- 无法解析的 target → 拒绝(不批准无法理解的地址);
- requester 为 ``None`` → 拒绝(无审批人即 fail-closed)。
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlparse

from app.services import approval_persistence as ap

logger = logging.getLogger(__name__)

# 网络审批复用批 51 持久层的 mcp_tool kind(冻结白名单,禁改持久层)。
# 模块内所有网络键统一加 ``net\x1f`` 前缀以与真实 MCP 工具键区分。
KIND_NET = ap.KIND_NET  # == "network"(批 52 主会话升级:独立 kind,stats 可单独观测)

# 单元分隔符(与 approval_persistence._UNIT_SEP 同源语义)
_UNIT_SEP = "\x1f"

# 端口缺省值(按协议)
_DEFAULT_PORT_HTTPS = 443
_DEFAULT_PORT_HTTP = 80


# =============================================================================
# 键规范化
# =============================================================================


def _parse_target(
    target: str, *, port: int | None = None, protocol: str = "https"
) -> tuple[str, int, str]:
    """把 URL / 裸 host 解析为 (host, port, scheme)。

    解析规则:
    - 裸 host(无 ``://``)按 ``protocol`` 当作 scheme 前缀再解析;
    - host 强制小写;
    - 端口优先级:URL 显式端口 > 入参 ``port`` > 协议默认(https=443 / 其他=80);
    - scheme 取 URL 中的 scheme,裸 host 时回退为 ``protocol``。

    解析失败(空串、无 hostname、端口非法)一律抛 ``ValueError``。
    """
    if target is None:
        raise ValueError("target 不能为空")
    raw = target.strip()
    if not raw:
        raise ValueError("target 不能为空")

    # 裸 host 补 scheme 以便 urlparse 正确提取 hostname
    candidate = raw if "://" in raw else f"{protocol}://{raw}"
    try:
        parsed = urlparse(candidate)
    except ValueError as exc:  # urlparse 极少数非法输入抛 ValueError
        raise ValueError(f"无法解析 target: {target!r}") from exc

    host = parsed.hostname
    if not host:
        raise ValueError(f"无法从 target 提取 hostname: {target!r}")
    host = host.lower()

    # urlparse.port 在端口越界/非数字时会抛 ValueError,需捕获为解析失败
    try:
        url_port = parsed.port
    except ValueError as exc:
        raise ValueError(f"target 端口非法: {target!r}") from exc

    if url_port is not None:
        final_port = url_port
    elif port is not None:
        final_port = port
    else:
        final_port = _DEFAULT_PORT_HTTPS if parsed.scheme == "https" else _DEFAULT_PORT_HTTP

    scheme = parsed.scheme or protocol
    return host, final_port, scheme


def normalize_net_key(
    target: str, *, port: int | None = None, protocol: str = "https"
) -> str:
    """网络审批缓存键规范化(对标 codex NetworkAccess 三元组)。

    入参 ``target`` 接受完整 URL 或裸 host(可带 ``:port``)。

    返回 ``net\\x1f<host>\\x1f<port>\\x1f<scheme>``;解析失败抛 ``ValueError``。
    """
    host, final_port, scheme = _parse_target(target, port=port, protocol=protocol)
    return f"{_UNIT_SEP.join(('net', host, str(final_port), scheme))}"


# =============================================================================
# 审批请求结构
# =============================================================================


@dataclass
class NetworkApprovalRequest:
    """一次网络访问审批请求(对标 codex NetworkAccess 的 host/protocol/port)。

    Attributes:
        target:  原始目标(URL 或裸 host),用于展示与审计;
        host:    规范化后的小写 hostname;
        port:    规范化后的端口(协议默认已填充);
        protocol: 协议(scheme),如 http / https;
        reason:  可选审批理由(由调用方附加上下文)。
    """

    target: str
    host: str
    port: int
    protocol: str
    reason: str | None = None

    @classmethod
    def from_url(cls, url: str, *, reason: str | None = None) -> NetworkApprovalRequest:
        """从 URL / 裸 host 构造请求;解析失败抛 ``ValueError``。"""
        host, port, scheme = _parse_target(url, protocol="https")
        return cls(target=url, host=host, port=port, protocol=scheme, reason=reason)


# =============================================================================
# 审批决策门
# =============================================================================


class NetworkApprovalGate:
    """网络访问审批决策门(进程内无 UI,requester 由调用方注入)。

    对标 codex 的 ``with_cached_approval``:命中持久缓存直接放行,否则征询
    requester;批准后落盘缓存,后续同 target 不再重复弹批。

    Args:
        requester: ``Callable[[NetworkApprovalRequest], bool | None]`` —— 返回
            ``True`` 批准,``False`` / ``None`` 拒绝(None 语义交由调用方,默认按拒绝)。
            为 ``None`` 时所有未命中请求 **直接拒绝**(fail-closed)。
        ttl_seconds: 批准后 session 级授权的有效期(秒);``None`` 表示不过期。
            默认 3600(1 小时);置 ``0`` 可触发「过期即恢复弹批」(测试用)。
    """

    def __init__(
        self,
        *,
        requester: Callable[[NetworkApprovalRequest], bool | None] | None = None,
        ttl_seconds: int | None = 3600,
    ) -> None:
        self._requester = requester
        self._ttl = ttl_seconds

    def evaluate(self, url: str, *, reason: str | None = None) -> str:
        """评估一次网络访问请求。

        Returns:
            ``'allow'``         —— 本次经 requester 批准后新授权,并已落盘;
            ``'persist_allow'`` —— 命中持久缓存(含本会话已批准),免弹放行;
            ``'deny'``          —— 拒绝(fail-closed:无 requester / 拒绝 / 解析失败)。

        流程:
            归一键 → 持久层 ``check`` 命中 → ``'persist_allow'``
            → 未命中且 requester 存在 → 征询审批,批准则 ``grant`` 后 ``'allow'``,
              拒绝则 ``'deny'``;无 requester → ``'deny'``。
            持久层异常一律按「未命中」降级(仍走 requester,真异常则 fail-closed)。
        """
        # 1) 归一键(解析失败 → fail-closed 拒绝)
        try:
            cache_key = normalize_net_key(url)
        except ValueError as exc:
            logger.warning("网络审批:target 解析失败,拒绝: %s", exc)
            return "deny"

        # 2) 持久层命中 → 免弹放行(异常按未命中)
        try:
            hit = ap.check(cache_key, KIND_NET)
        except Exception as exc:  # noqa: BLE001 - 持久层故障 fail-closed
            logger.warning("网络审批:持久层 check 异常,按未命中处理: %s", exc)
            hit = None
        if hit is not None:
            return "persist_allow"

        # 3) 未命中 → 征询审批
        requester = self._requester
        if requester is None:
            return "deny"

        request = NetworkApprovalRequest.from_url(url, reason=reason)
        decision = requester(request)
        if decision is True:
            try:
                ap.grant(
                    ap.SCOPE_SESSION,
                    cache_key,
                    KIND_NET,
                    ttl_seconds=self._ttl,
                )
            except Exception as exc:  # noqa: BLE001 - 落盘失败不阻断本次放行
                logger.warning("网络审批:授权落盘失败(本次仍放行): %s", exc)
            return "allow"
        return "deny"


# =============================================================================
# 便捷单例
# =============================================================================

_default_gate = NetworkApprovalGate()


def set_requester(
    fn: Callable[[NetworkApprovalRequest], bool | None] | None,
) -> None:
    """设置默认网络审批门的 requester(全局单例)。

    传 ``None`` 可清空(恢复 fail-closed)。
    """
    _default_gate._requester = fn


def set_db_path(path: str | None = None) -> None:
    """透传:注入持久层 db 路径(测试隔离用)。

    生产代码通常无需调用(默认 ``data/approval_grants.db``)。
    """
    if path is not None:
        ap.set_db_path(path)


def configure(
    *,
    db_path: str | None = None,
    requester: Callable[[NetworkApprovalRequest], bool | None] | None = None,
) -> None:
    """一次性配置(路径 + 审批人)。"""
    if db_path is not None:
        ap.set_db_path(db_path)
    if requester is not None:
        set_requester(requester)


def evaluate_network_access(url: str, *, reason: str | None = None) -> str:
    """便捷入口:用默认门评估一次网络访问(委托 ``_default_gate``)。"""
    return _default_gate.evaluate(url, reason=reason)


__all__ = [
    "KIND_NET",
    "normalize_net_key",
    "NetworkApprovalRequest",
    "NetworkApprovalGate",
    "set_requester",
    "set_db_path",
    "configure",
    "evaluate_network_access",
]
