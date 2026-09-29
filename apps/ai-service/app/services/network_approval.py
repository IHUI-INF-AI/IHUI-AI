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
# D159(2026-09-30 立,用户批"三档到底"):网络目标的对外事实 + 归属键 + 三档落库
# =============================================================================
# 回退开关**只有一处实现**:`approval_persistence.env_report_enabled()`
# (读 `IHUI_APPROVAL_ENV_REPORT`)。本模块不再自己读 env —— 两处读法必漂移,
# 而漂移的表现是"关档关不干净"。
ENV_REPORT_FLAG = ap.ENV_REPORT_FLAG  # re-export:调用方按名取,判据在持久层那一份

# 「始终允许该目标」的寿命(用户批的口径:90 天,与 D158 第四档同值同出口 `ttl_days`)。
NETWORK_ALWAYS_TTL_DAYS = 90
# 「本次对话允许该目标」的 session 级有效期(秒)。session 行本来就带 expires_at,
# check / purge_expired 判过期;票面"重启失效"指的是**内存桶**失效,持久层这一档刻意
# 保留(与 D158 同形 —— 为过门而把它删掉等于回滚那一条决策)。
NETWORK_SESSION_TTL_SECONDS_DEFAULT = 2 * 3600

# 三档的封闭集(回传侧按它归一,不认其它写法)。`once` = 不落库的最小特权档。
NETWORK_SCOPE_ONCE = "once"
NETWORK_SCOPE_SESSION = "session"
NETWORK_SCOPE_ALWAYS = "always"
NETWORK_SCOPES = frozenset({NETWORK_SCOPE_ONCE, NETWORK_SCOPE_SESSION, NETWORK_SCOPE_ALWAYS})

# 拒绝原因词表(与 evaluate_detailed 的 denial_reason 同源;前端把它当**枚举**渲染,
# 不得当自由文本 —— 未收录的原因一律走 unknown 档,不猜)。
DENIAL_REASON_NOT_ALLOWED = "not_allowed"
DENIAL_REASON_NOT_ALLOWED_LOCAL = "not_allowed_local"
DENIAL_REASON_DENIED = "denied"
DENIAL_REASONS = frozenset(
    {DENIAL_REASON_NOT_ALLOWED, DENIAL_REASON_NOT_ALLOWED_LOCAL, DENIAL_REASON_DENIED}
)


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


def _net_key_from_parts(host: str, final_port: int, scheme: str) -> str:
    """``net\\x1f<host>\\x1f<port>\\x1f<scheme>`` 裸键拼接的**唯一实现**。

    ``normalize_net_key``(既有出口)与 D159 的 ``describe_network_target`` 共用这一份
    —— 两处各拼一遍必漂移,而键形一漂,写入的规则就永远查不到,"始终允许该目标"
    变成一条永远命中不了的死账(AGENTS §5"两处算同一件事必漂移"同一条)。
    """
    return f"{_UNIT_SEP.join(('net', host, str(final_port), scheme))}"


def normalize_net_key(
    target: str, *, port: int | None = None, protocol: str = "https"
) -> str:
    """网络审批缓存键规范化(对标 codex NetworkAccess 三元组)。

    入参 ``target`` 接受完整 URL 或裸 host(可带 ``:port``)。

    返回 ``net\\x1f<host>\\x1f<port>\\x1f<scheme>``;解析失败抛 ``ValueError``。
    """
    host, final_port, scheme = _parse_target(target, port=port, protocol=protocol)
    return _net_key_from_parts(host, final_port, scheme)


# =============================================================================
# D159(2026-09-30 立,用户批"三档到底"):网络目标的对外事实 + 归属键 + 三档落库
# =============================================================================
# 与批 52 那道内存门的关系(必读,别读成重复实现):
# - 批 52 的 ``NetworkApprovalGate`` 落的是**无主体** session 键(requester 批准后自动
#   续期那一条),键空间是 ``net\x1fhost\x1fport\x1fscheme``;
# - D159 的三档是**用户在审批弹窗里显式选的授权**,必须绑**令牌主体**(AGENTS §5
#   "认证不等于授权";D158 的 owner-binding 修复就是同一课 —— 无主体键会让 A 批准的
#   规则替 B 免弹窗)。因此这里只写 ``scoped_cache_key(owner, normalize_net_key(...))``。
# - 两种键空间**共存但互不顶替**:`check` 先查主体键,再查无主体键(后者是批 52 既有
#   行为,不删它 = 不改变任何在跑的放行)。调用方需要"只看这条规则能不能放行"时,
#   走本节的 ``check_network_grant``(它同时看两面并回报命中面),不要自己拼键。
# 主体从**承载层**显式入参传进来(路由 owner_uuid / loop 构造参数),本模块永不读
# 请求体里的 userId,也不读全局。owner 缺失 ⇒ 不落规则、不判命中(fail-closed)。

#: 工具参数里承载出站目标的键(主对话流审批门据此从 args 取"这次要连哪个目标")。
#: 只列**已现读到的**键名(mcp_server 的 fetch_url / webhook 两条出站工具),不猜通用名
#: (把 `to` / `href` 之类纳进来会把无关参数读成网络目标 —— 那正是"显示沙箱内而实际
#: plain"的同一种谎,只是方向相反)。
TARGET_ARG_KEYS: tuple[str, ...] = ("url", "webhook_url")


@dataclass(frozen=True)
class NetworkTargetFacts:
    """一个网络目标的**对外事实**(审批弹窗与规则面板共用的展示形态)。

    Attributes:
        host:     规范化小写 hostname(读出来的真值,不是模型自报的原文);
        port:     规范化端口(协议默认已填充);
        protocol: scheme;
        display:  ``host:port`` —— 票面口径"弹窗上把键原样显示成 host:port,不显示哈希";
        reason:   拒绝原因码(``DENIAL_REASONS`` 词表)或 None = 当前**未被拦**;
        cache_key: 无主体裸键(审计与匹配用,不给人看);
        owner_bound_key: 主体绑定键,owner 为 None 时也是 None(⇒ 不落规则)。
    """

    host: str
    port: int
    protocol: str
    display: str
    reason: str | None
    cache_key: str
    owner_bound_key: str | None

    def to_event_payload(self) -> dict[str, object]:
        """审批帧上的形态(snake_case,与 tool-approval 其余字段同族)。

        **不含** cache_key / owner_bound_key:那两个是服务端把手,给前端就等于让
        客户端能自报一个键去 DELETE(本票第 2 条不可漂的正是这一型)。
        """
        payload: dict[str, object] = {
            "host": self.host,
            "port": self.port,
            "protocol": self.protocol,
            "display": self.display,
        }
        if self.reason is not None:
            payload["reason"] = self.reason
        return payload


def describe_network_target(
    target: str, *, owner: str | None = None, port: int | None = None, protocol: str = "https"
) -> NetworkTargetFacts | None:
    """把一个 URL / 裸 host 读成对外事实;读不到(解析失败)⇒ None,**绝不编一个**。

    ``reason`` 的口径(这条决定本票第 1 条不可漂能不能立住):
    **只报静态策略已判死的拒绝**(本地/私网/解析不出),不报"还没有规则覆盖它"。
    理由是:审批帧本来就在"还没有规则"的那一刻发,把"没规则"写成"被拦"会让弹窗
    对用户谎称"这个目标连不通",而它其实只是需要用户点一次允许 —— 那是把一个
    决策偷换成一个事实陈述,与"显示沙箱内而实际 plain"是同一条禁令的方向相反的
    那一半。命中查询走 ``check_network_grant``,那是另一件事。
    """
    try:
        host, final_port, scheme = _parse_target(target, port=port, protocol=protocol)
    except ValueError:
        return None
    bare_key = _UNIT_SEP.join(("net", host, str(final_port), scheme))
    bound_key: str | None = None
    o = str(owner or "").strip()
    if o:
        try:
            bound_key = ap.scoped_cache_key(o, bare_key)
        except ValueError:
            bound_key = None
    return NetworkTargetFacts(
        host=host,
        port=final_port,
        protocol=scheme,
        display=f"{host}:{final_port}",
        reason=_policy_denial_reason(host),
        cache_key=bare_key,
        owner_bound_key=bound_key,
    )


def _policy_denial_reason(host: str) -> str | None:
    """该 host 是否被**静态策略**判死(本地/回环/私网/link-local ⇒ 有原因;其余 None)。

    判据与 ``NetworkApprovalGate`` 拒绝分支用的 ``_unparsable_denial_reason`` 同形
    (同一组字符判据,不做第二套语义),但只在这条 host 上量一次 —— 本函数的值域是
    ``DENIAL_REASON_NOT_ALLOWED_LOCAL`` 或 None,不产出 ``denied``:
    "被审批人拒"是**结算之后**才知道的事,不属于发帧时刻的事实。
    """
    if not host:
        return DENIAL_REASON_NOT_ALLOWED
    if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
        return DENIAL_REASON_NOT_ALLOWED_LOCAL
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return None
    if addr.is_private or addr.is_loopback or addr.is_link_local:
        return DENIAL_REASON_NOT_ALLOWED_LOCAL
    return None


def pending_network_targets(
    args: Mapping[str, object] | None, *, owner: str | None = None
) -> list[NetworkTargetFacts]:
    """从工具参数里读出**这次调用要连的网络目标**(审批帧的 blocked/target 字段来源)。

    只读 ``TARGET_ARG_KEYS`` 列出的键,值为非空字符串才试解析;解析不出来的**跳过**
    (不冒充"被拦",也不报错 —— 报错了调用方会把整帧丢掉,那才是真丢信息)。
    返回顺序 = 键声明顺序,稳定可测。
    """
    if not isinstance(args, Mapping):
        return []
    facts: list[NetworkTargetFacts] = []
    seen: set[str] = set()
    for key in TARGET_ARG_KEYS:
        raw = args.get(key)
        if not isinstance(raw, str) or not raw.strip():
            continue
        fact = describe_network_target(raw, owner=owner)
        if fact is None or fact.cache_key in seen:
            continue
        seen.add(fact.cache_key)
        facts.append(fact)
    return facts


def approval_env_payload(
    tool_name: str,
    args: Mapping[str, object] | None,
    *,
    owner: str | None = None,
    env: Mapping[str, str] | None = None,
) -> dict[str, object]:
    """把"这次调用在哪儿跑 + 要连哪个目标"读成审批帧的**新增字段**(唯一组装出口)。

    三种返回形态,前端按形状分流(这条区分是本票第 1 条不可漂的实现):

    - ``{}`` ⇒ **回退开关关档**(``IHUI_APPROVAL_ENV_REPORT=0``)⇒ 一个新字段都不发,
      弹窗整块不渲染,逐字回到本票落地前的形态;
    - 有 ``exec_environment`` 且其 ``available`` 为 False ⇒ 开关开着但**读不到事实**
      ⇒ 弹窗必须显示"未上报",绝不显示"沙箱内/沙箱外";
    - ``available`` 为 True ⇒ 显示真值;``network_target`` 在位时才给三档按钮。

    网络目标只取**第一个**当"本次要放行谁"(与 ``grant_network_target`` 落的键同一份,
    所以弹窗上点下的档位与库里落的那条规则结构上不可能对不上);其余目标列进
    ``blocked_network_targets`` 只展示不落档。
    """
    if not ap.env_report_enabled(env):
        return {}
    payload: dict[str, object] = {}
    facts = ap.describe_exec_environment(tool_name, args)
    payload["exec_environment"] = (
        {"available": True, **facts} if facts is not None else {"available": False}
    )
    targets = pending_network_targets(args, owner=owner)
    if targets:
        payload["network_target"] = targets[0].to_event_payload()
        blocked = [t.to_event_payload() for t in targets if t.reason is not None]
        if blocked:
            payload["blocked_network_targets"] = blocked
    return payload


def network_target_from_args(
    args: Mapping[str, object] | None, *, owner: str | None = None
) -> NetworkTargetFacts | None:
    """审批**条目**上记的那一个目标(与 ``approval_env_payload`` 取的同一个)。

    服务端把它存在待决条目里,结算时按它落规则 —— 客户端回传只有 scope,选不了目标
    (客户端能自报 target 就等于"批的是 A 连的是 B",本票第 2 条不可漂点名的形态)。
    """
    targets = pending_network_targets(args, owner=owner)
    return targets[0] if targets else None


def grant_network_target(fact: NetworkTargetFacts, scope: str) -> bool:
    """按档位落一条网络放行规则(三档;``once`` 不落库)。

    返回是否**真的**写了规则(once / 缺主体 / 非法档 / 落库失败 ⇒ False)。
    落库失败必须喊出来并留 warning —— 静默失败的表现是"用户点了始终允许,下一次照旧弹",
    而弹窗此时显示的文案已经承诺了 90 天(§5e"失败必须响"同一条禁令)。
    """
    normalized = str(scope or "").strip().lower()
    if normalized == NETWORK_SCOPE_ONCE:
        return True  # 档位成立但刻意不落库:最小特权,下次照问
    if normalized not in NETWORK_SCOPES:
        logger.warning("网络放行档位非法,未落规则: %r", scope)
        return False
    if fact.owner_bound_key is None:
        logger.warning(
            "网络放行未落规则:缺令牌主体(target=%s, scope=%s)", fact.display, normalized
        )
        return False
    try:
        if normalized == NETWORK_SCOPE_ALWAYS:
            ap.grant(
                ap.SCOPE_ALWAYS,
                fact.owner_bound_key,
                KIND_NET,
                ttl_days=NETWORK_ALWAYS_TTL_DAYS,
            )
        else:
            ap.grant(
                ap.SCOPE_SESSION,
                fact.owner_bound_key,
                KIND_NET,
                ttl_seconds=NETWORK_SESSION_TTL_SECONDS_DEFAULT,
            )
    except Exception as exc:  # noqa: BLE001 - 落库失败不阻断已批准的执行,但必须响
        logger.warning("网络放行规则落库失败(target=%s): %s", fact.display, exc)
        return False
    return True


def check_network_grant(fact: NetworkTargetFacts) -> str | None:
    """该目标此刻是否放行(主体键优先,其次批 52 的无主体 session 键)。

    返回命中的 scope('always'/'session')或 None。
    """
    try:
        if fact.owner_bound_key is not None:
            hit = ap.check(fact.owner_bound_key, KIND_NET)
            if hit is not None:
                return hit
        return ap.check(fact.cache_key, KIND_NET)
    except Exception as exc:  # noqa: BLE001 - 持久层故障按未命中(fail-closed)
        logger.warning("网络放行命中查询异常(按未命中处理): %s", exc)
        return None


def revoke_network_grant(fact: NetworkTargetFacts) -> bool:
    """撤销该目标在**主体键与裸键两面**的全部授权。

    返回两面是否都执行成功。撤销必须"库里真没了"才算数 —— 调用方(路由)在撤销后
    会用 ``check_network_grant`` 复核,用例也按那个断言,不看 HTTP 状态码。
    """
    ok = True
    try:
        if fact.owner_bound_key is not None:
            ap.revoke(fact.owner_bound_key, KIND_NET)
        ap.revoke(fact.cache_key, KIND_NET)
    except Exception as exc:  # noqa: BLE001
        logger.warning("网络放行撤销失败(target=%s): %s", fact.display, exc)
        ok = False
    return ok


def display_from_cache_key(cache_key: str) -> str:
    """把库里那条网络放行键还原成给人看的 ``host:port``(规则面板与弹窗同一出口)。

    入参可能是**主体绑定键**(``<owner>\\x1e net\\x1fhost\\x1fport\\x1fscheme``),先剥主体段
    再拆单元;拆不出四段 ⇒ 原样返回并让调用方看见它不是 host:port 形态(不编一个假的,
    也不回空串 —— 面板拿空串会渲染出一行看不见目标名称的放行规则,那比报错更糟)。
    """
    _owner, bare = ap.split_scoped_key(str(cache_key or ""))
    units = bare.split(_UNIT_SEP)
    if len(units) == 4 and units[0] == "net" and units[1]:
        return f"{units[1]}:{units[2]}"
    return bare


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


def _unparsable_denial_reason(url: str) -> str:
    """解析失败时的拒绝原因码(对标 codex not_allowed / not_allowed_local 二分)。

    本地回环 / 私网 / link-local / ``.local`` 域名 → ``not_allowed_local``,
    其余无法解析目标 → ``not_allowed``。仅用于拒绝文案标注,不参与放行判定。
    """
    raw = (url or "").strip()
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        host = (urlparse(candidate).hostname or "").lower()
    except ValueError:
        host = ""
    if not host:
        return "not_allowed"
    if host in ("localhost", "127.0.0.1", "::1") or host.endswith(".local"):
        return "not_allowed_local"
    try:
        addr = ipaddress.ip_address(host)
    except ValueError:
        return "not_allowed"
    if addr.is_private or addr.is_loopback or addr.is_link_local:
        return "not_allowed_local"
    return "not_allowed"


__all__ = [
    "KIND_NET",
    "normalize_net_key",
    "NetworkApprovalRequest",
    "NetworkApprovalGate",
    "set_requester",
    "set_db_path",
    "configure",
    "evaluate_network_access",
    "evaluate_network_access_detailed",
    # D159(网络放行三档 + 审批载荷事实)
    "ENV_REPORT_FLAG",
    "NETWORK_SCOPES",
    "NETWORK_SCOPE_ONCE",
    "NETWORK_SCOPE_SESSION",
    "NETWORK_SCOPE_ALWAYS",
    "NETWORK_ALWAYS_TTL_DAYS",
    "NETWORK_SESSION_TTL_SECONDS_DEFAULT",
    "DENIAL_REASONS",
    "TARGET_ARG_KEYS",
    "NetworkTargetFacts",
    "describe_network_target",
    "pending_network_targets",
    "network_target_from_args",
    "approval_env_payload",
    "grant_network_target",
    "check_network_grant",
    "revoke_network_grant",
    "display_from_cache_key",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
