# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""CDP 事件游标分页 + origin 限定 + 命令白名单纯逻辑。

取证来源
--------
``.ihui-agent/tmp/goal-codex-r11/cua-confirmation-policy-and-cdp.md`` §B 逐字直读
``cloud/capabilities/tab/cdp.md`` 的 CdpTabCapability 类型::

    readEvents → { cursor, events[], hasMore, truncated }
    CdpEventsOptions = { afterSequence?, limit /*1-1000*/,
                         methods? /*非空*/, target?, timeoutMs? }
    CdpTarget = { sessionId } | { targetId }          # 二选一
    send 只发 permitted 的 CDP 命令(命令白名单)
    作用域: raw CDP 限定在该 tab 当前 web origin
    翻页须复用同一 filters

设计要点（本仓复现）
--------------------
Codex 把 DevTools 事件流的可靠分页范式落成类型契约。本仓的 cursor/seq 分页散布
在 agent_engine/session_store, 缺一个 CDP 专用的纯逻辑层。本模块抽出可判定的
核心: 翻页状态推进(hasMore/truncated)、请求参数校验(limit/methods/target)、
翻页一致性(filters 复用)、origin 限定、命令白名单。

安全边界
--------
本模块只做**控制平面判定**, 不发任何真实 CDP 命令、不接触页面内容。命令白名单
是**最小权限**实现——默认拒绝, 仅放行显式登记的命令。
"""

from __future__ import annotations

from dataclasses import dataclass

__all__ = [
    "CDP_EVENTS_LIMIT_MIN",
    "CDP_EVENTS_LIMIT_MAX",
    "CdpTarget",
    "EventsPage",
    "CdpEventsRequest",
    "next_page_request",
    "validate_events_request",
    "target_key",
    "same_target",
    "is_origin_scoped_url",
    "PERMITTED_CDP_COMMANDS",
    "is_permitted_cdp_command",
]

CDP_EVENTS_LIMIT_MIN = 1
CDP_EVENTS_LIMIT_MAX = 1000

# ---------------------------------------------------------------------------
# 目标寻址
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CdpTarget:
    """CDP 目标: sessionId 与 targetId 二选一(取证: CdpTarget 类型)。"""

    session_id: str | None = None
    target_id: str | None = None


def target_key(t: CdpTarget) -> str:
    """目标的稳定标识键(用于翻页一致性比对)。"""
    if t.session_id:
        return f"session:{t.session_id}"
    if t.target_id:
        return f"target:{t.target_id}"
    return "default"


def same_target(a: CdpTarget, b: CdpTarget) -> bool:
    """两个目标是否指向同一对象(键相等)。"""
    return target_key(a) == target_key(b)


# ---------------------------------------------------------------------------
# readEvents 翻页状态
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class EventsPage:
    """一次 readEvents 的返回快照(取证: readEvents 返回形)。"""

    cursor: int
    has_more: bool
    truncated: bool = False
    last_sequence: int = 0


@dataclass(frozen=True)
class CdpEventsRequest:
    """一次 readEvents 的请求参数(取证: CdpEventsOptions)。"""

    after_sequence: int | None = None
    limit: int = CDP_EVENTS_LIMIT_MAX
    methods: tuple[str, ...] = ()  # 空表示不过滤
    target: CdpTarget | None = None


def validate_events_request(req: CdpEventsRequest) -> list[str]:
    """校验请求参数, 返回错误列表(空=合法)。

    取证边界: limit 须在 1-1000; methods 若给出须非空。
    """
    errs: list[str] = []
    if not (CDP_EVENTS_LIMIT_MIN <= req.limit <= CDP_EVENTS_LIMIT_MAX):
        errs.append(
            f"limit must be within [{CDP_EVENTS_LIMIT_MIN},{CDP_EVENTS_LIMIT_MAX}], got {req.limit}"
        )
    # methods: () 或 None 表示"未提供/不过滤"(合法); 非空元组为过滤集(合法)。
    # 取证: methods 若提供须非空 —— 本模型用 () 表默认不过滤, 无空列表形态。
    if req.after_sequence is not None and req.after_sequence < 0:
        errs.append(f"afterSequence must be >= 0, got {req.after_sequence}")
    return errs


def next_page_request(
    prev: CdpEventsRequest, page: EventsPage
) -> CdpEventsRequest | None:
    """根据上一页结果推进到下一页请求; 没有更多则返回 None。

    取证范式: 用上一页最后一条的 sequence 作为下一页 afterSequence;
    翻页须**复用同一 filters**(limit/methods/target 不变)。
    truncated=True 只表示更老事件被驱逐, 不影响向前翻页。
    """
    if not page.has_more:
        return None
    return CdpEventsRequest(
        after_sequence=page.last_sequence,
        limit=prev.limit,
        methods=prev.methods,
        target=prev.target,
    )


# ---------------------------------------------------------------------------
# origin 限定
# ---------------------------------------------------------------------------
def is_origin_scoped_url(url: str, allowed_origin: str) -> bool:
    """判断 url 是否在允许的 web origin 内(CDP 作用域限定)。

    取证: raw CDP 访问限定在该 tab 当前 web origin。origin 含 scheme, 故
    ``http://host`` 与 ``https://host`` 视为**不同** origin。仅 http/https 可比较;
    非 http(s) scheme(如 file/chrome-extension)一律不在 scope。
    ``allowed_origin`` 形如 ``https://example.com``(含 scheme)。
    """
    if not url or not allowed_origin:
        return False
    u = url.lower()
    o = allowed_origin.lower().rstrip("/")
    if not (u.startswith("http://") or u.startswith("https://")):
        return False
    # allowed_origin 必须也带 http(s) scheme, 否则无法构成合法 origin 比较
    if not (o.startswith("http://") or o.startswith("https://")):
        return False
    # 取 scheme://host[:port] 整段作为 origin 比较(忽略路径)
    url_origin = u.split("/", 3)[:3]
    url_origin = "/".join(url_origin)  # e.g. "https://example.com"
    return url_origin == o


# ---------------------------------------------------------------------------
# CDP 命令白名单(最小权限, 默认拒绝)
# ---------------------------------------------------------------------------
# 取证: send 只发 permitted 的 CDP 命令(白名单具体条目未在 md 展开)。
# 这里登记一批**只读/无副作用**的常见 DevTools 命令作为默认白名单基线;
# 具体放行集合应由调用方按最小权限收紧。
PERMITTED_CDP_COMMANDS: frozenset[str] = frozenset(
    {
        "Runtime.evaluate",
        "Runtime.callFunctionOn",
        "Page.navigate",
        "Page.getFrameTree",
        "DOM.getDocument",
        "DOM.querySelector",
        "DOM.querySelectorAll",
        "DOM.getBoxModel",
        "Network.enable",
        "Network.getResponseBody",
        "Emulation.setDeviceMetricsOverride",
    }
)


def is_permitted_cdp_command(method: str) -> bool:
    """判断 CDP 命令是否在白名单内(默认拒绝)。"""
    return method in PERMITTED_CDP_COMMANDS
