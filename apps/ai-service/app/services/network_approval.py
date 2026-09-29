# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

import ipaddress
import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import Any
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
        verdict, _denial = self.evaluate_detailed(url, reason=reason)
        return verdict

    def evaluate_detailed(
        self, url: str, *, reason: str | None = None
    ) -> tuple[str, str | None]:
        """批58(十六):在 ``evaluate`` 之上透出拒绝原因码(对标 codex network_policy_decision)。

        返回 ``(verdict, denial_reason)``;``denial_reason`` 仅在 verdict 为 ``deny``
        时非空,取值对齐 codex ``denied_network_policy_message`` 的 reason 词表:

        - ``not_allowed_local`` —— 目标为本地/私网地址(策略阻止);
        - ``not_allowed``       —— 目标无法解析或不在允许名单;
        - ``denied``            —— 显式拒绝(审批人被征询后拒绝,或未注入审批通道)。

        放行判定与 ``evaluate`` 逐字节等价(共享同一实现),denial_reason 只做标注,
        绝不改变放行/拒绝结果。
        """
        # 1) 归一键(解析失败 → fail-closed 拒绝)
        try:
            cache_key = normalize_net_key(url)
        except ValueError as exc:
            logger.warning("网络审批:target 解析失败,拒绝: %s", exc)
            return "deny", _unparsable_denial_reason(url)

        # 2) 持久层命中 → 免弹放行(异常按未命中)
        try:
            hit = ap.check(cache_key, KIND_NET)
        except Exception as exc:  # noqa: BLE001 - 持久层故障 fail-closed
            logger.warning("网络审批:持久层 check 异常,按未命中处理: %s", exc)
            hit = None
        if hit is not None:
            return "persist_allow", None

        # 3) 未命中 → 征询审批
        requester = self._requester
        if requester is None:
            # 无审批通道 = fail-closed(无法从此提示放行,对标 codex denied 语义)
            return "deny", "denied"

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
            # 批58(接线):network_rule_amendments 真接线(对标 codex
            # network_policy_decision.rs —— 批准即产出 Allow 修正案回执)。
            # on 时把本次批准归一为 allow 网络修正案(结构化回执,含 host 与协议);
            # off 时零差异;失败静默,绝不阻断放行。
            try:
                import os as _os

                from app.core.network_rule_amendments import (
                    NetworkApprovalContext,
                    NetworkApprovalProtocol,
                    NetworkPolicyAmendment,
                    NetworkPolicyRuleAction,
                    execpolicy_network_rule_amendment,
                )

                if _os.environ.get(
                    "AGENT_NETWORK_RULE_AMENDMENTS_ENABLED", "false"
                ).strip().lower() not in ("on", "1", "true", "yes"):
                    raise LookupError("amendments disabled")
                _proto = NetworkApprovalProtocol(request.protocol or "https")
                _amendment = execpolicy_network_rule_amendment(
                    NetworkPolicyAmendment(
                        host=request.host,
                        action=NetworkPolicyRuleAction.ALLOW,
                    ),
                    NetworkApprovalContext(host=request.host, protocol=_proto),
                    request.host,
                )
                logger.info(
                    "网络审批:Allow 修正案产出 host=%s decision=%s",
                    request.host,
                    _amendment.decision,
                )
            except Exception as exc:  # noqa: BLE001 - 修正案失败降级,不阻断放行
                logger.warning("网络审批:Allow 修正案产出失败(降级跳过): %s", exc)
            return "allow", None
        return "deny", "denied"


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


def evaluate_network_access_detailed(
    url: str, *, reason: str | None = None
) -> tuple[str, str | None]:
    """批58(十六):便捷入口的带原因版本(委托 ``_default_gate.evaluate_detailed``)。"""
    return _default_gate.evaluate_detailed(url, reason=reason)


# =============================================================================
# D159(2026-09-30 立,用户批"三档到底"):审批载荷的执行环境事实 + 网络目标三档
# =============================================================================
#
# 这一族是 D159 的**写侧**:读侧(`app/routers/llm.py` 的 `_approval_env_fields` /
# `_approval_network_fact` / `_persist_network_grant` / `_network_grant_hits` 与
# `agent_loop_v2` 的 tool.approval 事件)与前端弹窗、`@ihui/api-client` 的投影、
# SSE 契约(`packages/shared/src/sse/contract.ts`)都已入库,唯独这里从未落地 ——
# 读侧全部包在 `except Exception` 里,所以症状不是崩,是"弹窗永远显示未上报、
# 三档永远不落规则、免弹永远不命中",而 typecheck 与其余门一路报绿。
#
# 三条不可漂的口径(逐条对应票面):
# ① 事实读不到 ⇒ `available:false`,**绝不**下发一个 `inSandbox` 冒充"读到了";
# ② 授权主体只从承载层(`owner` = JWT 主体)进来,键走 `approval_persistence
#    .scoped_cache_key` 那一份组合;归一键/主体键**不进**事件载荷 —— 递给客户端
#    等于让它自报一个键去 DELETE / 去指认放行对象(AGENTS §5"认证不等于授权");
# ③ 与 D158 共面板共 API:网络目标只是同一对 `GET/DELETE /llm/approval-grants`
#    的另一种 kind,不新建第二套存储、不算第二份键语法。

#: 拒绝原因码 —— 与 TS 侧 `TOOL_APPROVAL_DENIAL_REASONS` 同集合(值表只有一份语义)。
DENIAL_REASON_NOT_ALLOWED = "not_allowed"
DENIAL_REASON_NOT_ALLOWED_LOCAL = "not_allowed_local"
DENIAL_REASON_DENIED = "denied"
DENIAL_REASONS = frozenset(
    {
        DENIAL_REASON_NOT_ALLOWED,
        DENIAL_REASON_NOT_ALLOWED_LOCAL,
        DENIAL_REASON_DENIED,
    }
)

#: 票面预填口径:"始终允许该目标(90 天后失效)" —— 天数只有这一处,撤销/列表都按它判。
NETWORK_ALWAYS_TTL_DAYS = 90
#: session 档寿命沿用本模块门的既有缺省(`NetworkApprovalGate(ttl_seconds=3600)`)。
_NETWORK_SESSION_TTL_SECONDS = 3600

#: 本仓工具参数里承载出站 URL 的那两个键(mcp_server.py 现读:`"url"` / `"webhook_url"`)。
_OUTBOUND_ARG_KEYS = ("url", "webhook_url")


def _host_is_local(host: str) -> bool:
    """该 hostname 是否指向本地/私网(**唯一**一份判据)。

    `_unparsable_denial_reason`(批 58 的拒绝标注)与 `describe_network_target`
    (D159 的"这个目标已被静态策略判死")问的是同一件事,两处各写一遍必然在
    `.local` / IPv6 / link-local 上漂开 —— 漂开的表现是同一地址在拒绝文案里算
    本地、在审批载荷里不算,而两边各自都自洽。
    """
    h = (host or "").strip().lower()
    if not h:
        return False
    if h in ("localhost", "127.0.0.1", "::1") or h.endswith(".local"):
        return True
    try:
        addr = ipaddress.ip_address(h)
    except ValueError:
        return False
    return bool(addr.is_private or addr.is_loopback or addr.is_link_local)


@dataclass(frozen=True)
class NetworkTargetFact:
    """一次审批**要看的那一个网络目标**(载荷投影与落库键同源于这一次取值)。

    Attributes:
        target:          原始入参(URL / 裸 host),只用于审计,不进事件载荷;
        host/port/protocol: 规范化三元组(与 codex NetworkAccess 同形);
        reason:          仅当**静态策略**已判死该目标时非空;"还没有规则覆盖它"不算被拦
                         —— 那正是这条审批要问用户的事,标成被拦会把审批本身问的路由说死;
        owner_bound_key: 服务端把手(主体 + 归一键),**只落库、绝不下发**。
    """

    target: str
    host: str
    port: int
    protocol: str
    reason: str | None = None
    owner_bound_key: str | None = None

    @property
    def display(self) -> str:
        """给人看的那一行:恒 `host:port`,不显示归一键、不显示哈希。"""
        return f"{self.host}:{self.port}"

    def to_event_payload(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "host": self.host,
            "port": self.port,
            "protocol": self.protocol,
            "display": self.display,
        }
        if self.reason is not None:
            payload["reason"] = self.reason
        return payload


def describe_network_target(
    target: str, *, owner: str | None = None
) -> NetworkTargetFact | None:
    """把一个 URL / 裸 host 解析成审批载荷用的网络目标事实;读不到 ⇒ ``None``。

    ``owner`` 必须是承载层(JWT)那一份:传 None ⇒ ``owner_bound_key`` 为 None ⇒
    后续 ``grant_network_target`` 不落任何规则(fail-closed)。空串主体同样按无主体处置
    (`scoped_cache_key` 自己会拒)。
    """
    raw = (target or "").strip()
    if not raw:
        return None
    try:
        host, port, scheme = _parse_target(raw)
        cache_key = normalize_net_key(raw)
    except ValueError as exc:
        logger.warning("D159 网络目标无法解析,按无目标处理: %s", exc)
        return None
    reason = DENIAL_REASON_NOT_ALLOWED_LOCAL if _host_is_local(host) else None
    owner_bound: str | None = None
    principal = str(owner or "").strip()
    if principal:
        try:
            owner_bound = ap.scoped_cache_key(principal, cache_key)
        except ValueError as exc:  # 主体形态不合 ⇒ 不落规则,但事实照报(弹窗仍要问)
            logger.warning("D159 网络目标主体键计算失败,按无主体处理: %s", exc)
    return NetworkTargetFact(
        target=raw,
        host=host,
        port=port,
        protocol=scheme,
        reason=reason,
        owner_bound_key=owner_bound,
    )


def _targets_from_args(
    args: Mapping[str, Any] | None, *, owner: str | None
) -> list[NetworkTargetFact]:
    """按 ``_OUTBOUND_ARG_KEYS`` 的**固定顺序**取本次调用可读到的全部目标。

    顺序即优先级:免弹窗判据取"全部目标都命中",写侧取第一个,两者读的是同一个列表,
    所以"弹窗上显示的目标"与"库里落的那条"结构上同一条(顺序漂开 = 批 A 落 B)。
    """
    found: list[NetworkTargetFact] = []
    for key in _OUTBOUND_ARG_KEYS:
        raw = (args or {}).get(key)
        if not isinstance(raw, str):
            continue
        fact = describe_network_target(raw, owner=owner)
        if fact is not None:
            found.append(fact)
    return found


def network_target_from_args(
    args: Mapping[str, Any] | None, *, owner: str | None = None
) -> NetworkTargetFact | None:
    """本次审批要放行/要落规则的那一个目标(无可放行目标 ⇒ None)。

    **只取未被静态策略判死的第一个目标**(``reason is None``),与
    ``approval_env_payload`` 在帧上发的 ``network_target``(同一份列表的 ``live[0]``)
    是同一条判据。两处各取一头就会分叉:一次同时带 ``url``(本地 ⇒ 已被判死)与
    ``webhook_url``(公网)的调用,弹窗让用户批的是公网那个,而落库的 90 天免弹窗
    规则挂在了本地那个上 —— 那是一条用户从未见过、也从未批准过的目标(与本文件用例
    "多目标只命中其一不得免弹"编码的方向同一条禁令:不得把用户没批过的目标连出去)。
    全部目标都被判死 ⇒ None ⇒ 什么都不落(实际请求仍由 ``network_guard`` 拒发,
    免弹窗规则改变不了静态策略,落它只会把"永远该问"变成"永远不问")。
    """
    for fact in _targets_from_args(args, owner=owner):
        if fact.reason is None:
            return fact
    return None


def pending_network_targets(
    args: Mapping[str, Any] | None, *, owner: str | None = None
) -> list[NetworkTargetFact]:
    """免弹窗判据要的**全部**目标(命中侧与写入侧成套;少一个就照弹)。"""
    return _targets_from_args(args, owner=owner)


def grant_network_target(fact: NetworkTargetFact, scope: str) -> bool:
    """三档落规则:`once` 不落、`session` 短期、`always` 90 天;其余一律 False。

    缺主体键 ⇒ False(等价"不落任何规则"),未知 scope ⇒ False —— 两者都**不退化成
    "按工具名放行"**,那正是 D158 修掉的那一型。持久层异常一律向上抛,由调用方
    (`llm._persist_network_grant`)记 warning 并继续已批准的执行。
    """
    if scope == "once":
        return True
    key = fact.owner_bound_key
    if not key:
        return False
    if scope == ap.SCOPE_SESSION:
        ap.grant(
            ap.SCOPE_SESSION,
            key,
            KIND_NET,
            ttl_seconds=_NETWORK_SESSION_TTL_SECONDS,
        )
        return True
    if scope == ap.SCOPE_ALWAYS:
        ap.grant(ap.SCOPE_ALWAYS, key, KIND_NET, ttl_days=NETWORK_ALWAYS_TTL_DAYS)
        return True
    return False


def check_network_grant(fact: NetworkTargetFact) -> str | None:
    """该目标已有的放行 scope(命中侧复用持久层那一份过期判定,不抄第二份)。"""
    key = fact.owner_bound_key
    if not key:
        return None
    return ap.check(key, KIND_NET)


def revoke_network_grant(fact: NetworkTargetFact) -> bool:
    """撤销并**确认库里真没了** —— `revoke` 是 `DELETE`,查而不删也算"成功"就是假 ack。"""
    key = fact.owner_bound_key
    if not key:
        return False
    ap.revoke(key, KIND_NET)
    return ap.check(key, KIND_NET) is None


def display_from_cache_key(cache_key: str) -> str:
    """把 ``normalize_net_key`` 的归一键还原成 ``host:port``(面板列表用)。

    解析不出就抛 —— 调用方(`llm._readable_grant_prefix`)的降级是"宁可看见一串怪键,
    也不看见空白",这里静默返回空串会把"表里有条规则"这件事一起抹掉。
    """
    parts = [p for p in (cache_key or "").split(_UNIT_SEP) if p]
    if len(parts) < 3 or parts[0] != "net" or not parts[1] or not parts[2]:
        raise ValueError(f"不是网络审批归一键: {cache_key!r}")
    return f"{parts[1]}:{parts[2]}"


def approval_env_payload(
    tool_name: str, args: Mapping[str, Any] | None, *, owner: str | None = None
) -> dict[str, Any]:
    """审批帧的 D159 新字段(唯一组装点;路由与 agent 任务流都只调它)。

    关档 ⇒ 返回 ``{}``(整块不发,前端整块不渲染)。开档时"读不到"发
    ``{"available": false}`` 而不是缺字段 —— 两态在界面上是两句不同的话:
    "未上报" 与 "本票落地前的旧客户端"。
    """
    if not ap.approval_env_report_enabled():
        return {}
    env = ap.describe_exec_environment(tool_name, args)
    payload: dict[str, Any] = {
        "exec_environment": env if env is not None else {"available": False}
    }
    facts = _targets_from_args(args, owner=owner)
    live = [f for f in facts if f.reason is None]
    blocked = [f for f in facts if f.reason is not None]
    if live:
        payload["network_target"] = live[0].to_event_payload()
    if blocked:
        payload["blocked_network_targets"] = [f.to_event_payload() for f in blocked]
    return payload


def _unparsable_denial_reason(url: str) -> str:
    """解析失败时的拒绝原因码(对标 codex not_allowed / not_allowed_local 二分)。

    本地回环 / 私网 / link-local / ``.local`` 域名 → ``not_allowed_local``,
    其余无法解析目标 → ``not_allowed``。仅用于拒绝文案标注,不参与放行判定。
    本地/私网的判定与 ``describe_network_target`` 共用 ``_host_is_local`` 那一份。
    """
    raw = (url or "").strip()
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        host = (urlparse(candidate).hostname or "").lower()
    except ValueError:
        host = ""
    if not host:
        return DENIAL_REASON_NOT_ALLOWED
    return DENIAL_REASON_NOT_ALLOWED_LOCAL if _host_is_local(host) else DENIAL_REASON_NOT_ALLOWED


__all__ = [
    "KIND_NET",
    "DENIAL_REASONS",
    "DENIAL_REASON_DENIED",
    "DENIAL_REASON_NOT_ALLOWED",
    "DENIAL_REASON_NOT_ALLOWED_LOCAL",
    "NETWORK_ALWAYS_TTL_DAYS",
    "NetworkTargetFact",
    "approval_env_payload",
    "check_network_grant",
    "describe_network_target",
    "display_from_cache_key",
    "grant_network_target",
    "network_target_from_args",
    "pending_network_targets",
    "revoke_network_grant",
    "normalize_net_key",
    "NetworkApprovalRequest",
    "NetworkApprovalGate",
    "set_requester",
    "set_db_path",
    "configure",
    "evaluate_network_access",
    "evaluate_network_access_detailed",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
