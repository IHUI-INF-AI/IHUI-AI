# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""服务端自主决定"这次聊天该给 AI 哪些操控本站的工具"(2026-09-21 立)。

为什么要把决定权从客户端收回来:`llm.py` 的 tool loop 入口是 `if req.agent_tools`,
而各端为保打字机流式刻意"普通问答不带工具",于是**要不要给 AI 一只手,由客户端一张
约 48 词的关键词表说了算**。用户换个说法(“我要充值但找不到入口”)整条链就静默失效 ——
那不叫"自主分析",叫暗号匹配。

这里做两件事,缺一不可:
1. **意图判定复用 `conversation._UI_INTENT_PATTERNS` 的强信号正则**(Python 侧单一事实源,
   不另造词表 —— 两处词表必然漂移)。
2. **只注入"此刻真能执行"的那一族工具**:问 apps/api 该用户哪些端在线(web / rn / miniapp),
   在线才给对应前缀的工具。既不必猜请求来自哪个端,也不会把 `web_ui_*` 发给一个只开着
   手机 App 的用户 —— 那只会换来 `TARGET_NOT_CONNECTED` 并白烧一轮上下文。

失败一律降级为"不加工具"(绝不为这个附加步骤打断聊天),并带 15s 进程内缓存 ——
一次对话多轮工具往返不该反复打 status。
"""

from __future__ import annotations

import logging
import os
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

# 端 → 工具前缀(与 apps/api CATEGORY_ENDPOINT 反向对应)
_ENDPOINT_PREFIX: dict[str, str] = {
    "web": "web_ui_",
    "rn": "mobile_ui_",
    "miniapp": "taro_ui_",
    "extension": "ext_ui_",
}

# 各族支持的动词,须与 app/services/ui_action_bridge.py 的 _FAMILIES 动作集同形。
# 三族都是七动词:RN / 小程序没有 DOM,click/fill 由端内控件注册表承接 ——
# 组件没交出写入通道时端上如实回 UNSUPPORTED_ACTION,而不是这里预先发一个必然失败的工具
# (2026-09-21 补齐:此前只给四动词,导致端上注册好的输入框永远到不了模型手上)。
#
# ⚠️ 页面句柄族 `browser_page_*`(2026-09-25 开放)**刻意不进这张表**。这张表的语义是
# "该端在线 ⇒ 整族自动注入",适用于**应用内** UI(操作的是我们自己的页面)。而 page_* 读的是
# 用户正在浏览的任意站点,与本族的姊妹族 browser_*(选择器形态)一样必须由客户端显式携带工具名
# 才算授权;服务端只做反向收紧(端没申报这一族就把名字摘掉,见 filter_unauthorized_page_tools)。
# 把它"顺手"接进这里的后果是:任何一句带"点击/填写"措辞的普通问答,都可能把用户当前页的正文
# 交给模型 —— 那不是自主性,那是越权。
_FAMILY_ACTIONS: dict[str, frozenset[str]] = {
    prefix: frozenset({"describe", "read", "navigate", "click", "fill", "submit", "invoke"})
    for prefix in ("web_ui_", "mobile_ui_", "taro_ui_", "ext_ui_")
}

# 页面句柄族前缀(唯一执行体 = 浏览器扩展;工具名本体在 page_control_bridge.py)。
_PAGE_FAMILY_PREFIX = "browser_page_"

_API_ENTRY_TOOLS: tuple[str, ...] = ("api_endpoints_search", "api_endpoint_call")

# 与 packages/shared/src/utils/app-control-intent.ts 的客户端表**等价的一份 Python 移植**。
# 为什么宁可跨语言复制一份而不"只靠正则":实测(2026-09-21)同一批措辞下,
# conversation 的强信号正则命中 2/13,客户端关键词表命中 8/13 —— 两张网兜住的句子几乎不重叠,
# **并集**才显著优于任一单独一方(防漂移由 tests/test_control_autonomy.py 逐字比对 TS 源文件保证)。
_CLIENT_UI_KEYWORDS: tuple[str, ...] = (
    "打开",
    "跳转",
    "切到",
    "切换到",
    "进入",
    "回到",
    "导航到",
    "带我到",
    "点击",
    "点一下",
    "按下",
    "按一下",
    "填写",
    "填入",
    "填一下",
    "填成",
    "输入框",
    "表单",
    "下拉框",
    "提交表单",
    "保存表单",
    "这个页面",
    "当前页面",
    "页面上",
    "页面显示",
    "可操控",
    "能操作",
    "操控",
    "操作这个",
    "操作我们",
    "操作本站",
    "新建会话",
    "命令面板",
    "侧边栏",
    "面板",
)

_CLIENT_API_KEYWORDS: tuple[str, ...] = (
    "接口",
    "api",
    "端点",
    "后端",
    "服务端",
    "列出所有",
    "查一下所有",
    "有多少",
    "统计一下",
    "用户列表",
    "订单列表",
    "后台数据",
    "调用",
)

_STATUS_TTL_S = 15.0
_STATUS_TIMEOUT_S = 1.5

# (user_id) → (过期时间戳, 该用户在线端的原始申报清单)。负结果同样缓存:没端在线是常态。
_online_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _mode() -> str:
    """off / on(默认)/ always。

    `always` = 只要有端在线就注入整族,**不做词面判定**。代价是每条普通问答都要多一次
    非流式 complete() 才能决定工不用工,首字延迟会被用户明显感知(web 2026-08-29 就是为
    修这个才改成按需携带)—— 所以它是**部署方选择**,不是默认值。
    """
    raw = os.environ.get("CONTROL_AUTONOMY", "on").strip().lower()
    if raw in {"false", "0", "no", "off"}:
        return "off"
    if raw in {"always", "all", "eager"}:
        return "always"
    return "on"


def _intent(text: str) -> tuple[frozenset[str] | None, bool]:
    """返回 (UI 动词集合 或 None=整族, 是否要 api 入口工具)。

    判定源两路并联:
    - `conversation._UI_INTENT_PATTERNS` 强信号正则 —— 精度高(要求"动词+宾语"结构),
      命中能精确到动词;
    - 客户端那张关键词表 —— 精度低但召回高,只判得出"是不是在说操控",判不出动词
      → 此时给**整族**(动作类工具依赖 describe 返回的定位符,少给一个就断链)。
    """
    lower = text.lower()
    want_api = any(kw in lower for kw in _CLIENT_API_KEYWORDS)
    ui_kw_hit = any(kw in lower for kw in _CLIENT_UI_KEYWORDS)

    verbs: set[str] = set()
    from ..services.conversation import _UI_INTENT_PATTERNS

    for tool, patterns in _UI_INTENT_PATTERNS.items():
        if tool.startswith("api_"):
            if any(isinstance(p, re.Pattern) and p.search(text) for p in patterns):
                want_api = True
            continue
        if not tool.startswith("web_ui_"):
            continue
        verb = tool[len("web_ui_") :]
        if any(isinstance(p, re.Pattern) and p.search(text) for p in patterns):
            verbs.add(verb)

    if verbs:
        # 动作类工具依赖 describe 返回的 id/target,补上 describe
        return frozenset(verbs | {"describe"}), want_api
    if ui_kw_hit:
        return None, want_api  # 整族
    return frozenset(), want_api


async def _online_endpoints(user_id: str) -> list[dict[str, Any]]:
    """该用户此刻在线端的**原始申报清单**(带 15s 缓存;查不到返回空列表 = 没有端在线)。

    返回 api `GET /api/agent-control/status` 里的 endpoints 数组本体,而不是预处理后的前缀集:
    同一份数据要回答两个问题 —— "哪些端在线"(前缀集)与"这个端申报了哪一族的哪些动作"
    (动作计数)。只留前缀集就把第二个问题所需的事实丢掉了,而页面句柄族的授权判定正好靠它。
    任何异常一律降级为空列表:这一层的失败形态必须是"少给工具",绝不能是"打断聊天"。
    """
    now = time.monotonic()
    cached = _online_cache.get(user_id)
    if cached and cached[0] > now:
        return cached[1]

    endpoints: list[dict[str, Any]] = []
    try:
        import httpx

        # 鉴权头一律复用 api_tools_bridge.internal_headers —— 它才是与 apps/api
        # `checkInternalServiceToken`(校验 AI_CALLBACK_SECRET)同源的那把钥匙。
        # 自己手拼 Bearer=AGENT_CONTROL_INTERNAL_SECRET 会被 401 拒掉(实测踩过)。
        from .api_tools_bridge import api_base_url, internal_headers

        headers = internal_headers(user_id)
        if headers.get("x-internal-service-token"):
            async with httpx.AsyncClient(timeout=_STATUS_TIMEOUT_S) as client:
                resp = await client.get(
                    f"{api_base_url().rstrip('/')}/api/agent-control/status",
                    headers=headers,
                )
                resp.raise_for_status()
                body: dict[str, Any] = resp.json()
            data = body.get("data") or {}
            endpoints = [ep for ep in (data.get("endpoints") or []) if isinstance(ep, dict)]
    except Exception as exc:  # noqa: BLE001 - 附加步骤不得打断聊天,查不到就按"无端在线"处理
        logger.warning("[control_autonomy] 在线端查询失败(降级为不注入 UI 工具): %s", exc)

    _online_cache[user_id] = (now + _STATUS_TTL_S, endpoints)
    return endpoints


def _prefixes_of(endpoints: list[dict[str, Any]]) -> frozenset[str]:
    """原始申报清单 → 应用内 UI 工具前缀集合(与 `_ENDPOINT_PREFIX` 表同源)。"""
    found = {
        _ENDPOINT_PREFIX[str(ep.get("endpoint") or "")]
        for ep in endpoints
        if isinstance(ep, dict) and ep.get("endpoint") in _ENDPOINT_PREFIX
    }
    return frozenset(p for p in found if p)


async def _online_prefixes(user_id: str) -> frozenset[str]:
    """该用户此刻在线的端 → 工具前缀集合(查不到就返回空)。"""
    return _prefixes_of(await _online_endpoints(user_id))


def _page_family_declared(endpoints: list[dict[str, Any]]) -> bool:
    """是否有 extension 端**申报了页面句柄族**(browserPageActions 计数 > 0)。

    判据取计数而不是动词名:`/status` 只回各族动作的数量(见
    `apps/api/src/routes/agent-control.ts` 的 `browserPageActions?.length ?? 0`)。
    申报面目前恒为整族七动词(扩展由 `PAGE_ACTIONS` 派生上报,见
    `apps/extension/lib/agent-control-bridge.ts`),所以"族级"粒度与"动词级"粒度今天等价。
    这个取舍如实记在这里:若将来出现只申报部分动词的端,需要 /status 改回动词名清单再收紧。
    """
    return any(
        ep.get("endpoint") == "extension" and int(ep.get("browserPageActions") or 0) > 0
        for ep in endpoints
    )


async def filter_unauthorized_page_tools(
    tools: list[str] | None,
    user_id: str | None,
) -> list[str] | None:
    """端没申报页面句柄族时,把 `browser_page_*` 从模型可见工具面摘掉(fail-closed)。

    这是这一族的**唯一**服务端闸。客户端可以带着这几个名字来(web 的 Agent 模式/浏览器插件
    清单),但只要该用户此刻没有"申报了 browserPageActions 的扩展端"在线,工具就不给 ——
    给了只会换来 `TARGET_NOT_CONNECTED`,更糟的是让模型以为自己能读用户的页面。

    三条设计约束:
    1. **零成本早退**:清单里没有 page_* 就原样返回,不发起任何查询(绝大多数请求走这条)。
    2. **查不到即摘**:没有身份 / api 不可达 / 超时 / 无端在线,全部按"未授权"处理。
       这一族的失败形态必须是"少一个工具",不能是"多一次泄面"。
    3. 只摘 page 族,**不动**其它工具 —— 浏览器选择器族 `browser_*` 的授权由客户端清单自己管,
       本闸不替它做决定(它没有申报面可读)。
    """
    if not tools or not any(str(t).startswith(_PAGE_FAMILY_PREFIX) for t in tools):
        return tools
    if not user_id:
        logger.warning("[control_autonomy] 缺用户身份,摘除页面句柄族工具(不给未授权的面)")
        return [t for t in tools if not str(t).startswith(_PAGE_FAMILY_PREFIX)] or None
    if _page_family_declared(await _online_endpoints(user_id)):
        return tools
    logger.info(
        "[control_autonomy] 用户 %s 无申报页面句柄族的在线端 ⇒ 摘除 %s",
        str(user_id)[:8],
        [t for t in tools if str(t).startswith(_PAGE_FAMILY_PREFIX)],
    )
    return [t for t in tools if not str(t).startswith(_PAGE_FAMILY_PREFIX)] or None



async def augment_agent_tools(
    requested: list[str] | None,
    text: str,
    user_id: str | None,
) -> list[str] | None:
    """把服务端判出的操控工具并进客户端带来的 agent_tools(去重,保序)。

    返回 None / 空 = 维持原样(调用方据此根本不进 tool loop)。任何一步判不出来都宁可不加,
    而不是加一族端侧跑不动的工具。

    两条注入路径,代价完全不同:
    - `requested` 非空(用户已选插件/已开网页搜索 ⇒ 本轮**本来就**要付 tool loop 的开销):
      直接把该用户在线端的**整族**并进来,不做词面判定 —— 零额外延迟的自主性;
    - `requested` 为空:必须过词面闸门(词表 ∪ 正则),否则每条普通问答都要多一次
      非流式 complete(),打字机流式会被拖成"憋一下再整段出"(web 2026-08-29 就是为此
      改成按需携带的)。
    """
    out: list[str] = list(requested or [])
    mode = _mode()
    if mode == "off":
        logger.debug("[control_autonomy] 开关关闭,跳过")
        return out or None
    if not user_id:
        # 静默降级最危险的一条:没有身份就什么都注入不了,但聊天看起来"一切正常"
        logger.warning("[control_autonomy] 缺用户身份(request.state.user_id 为空),不注入操控工具")
        return out or None

    already = bool(out)
    # verbs is None = "整族";frozenset() = "没有任何 UI 意图"。两者别混(混了就静默不注入)
    verbs: frozenset[str] | None = None if mode == "always" else frozenset()
    want_api = False
    if mode != "always" and text.strip():
        lexical_verbs, want_api = _intent(text)
        if already:
            # 已携带工具 ⇒ 整族注入,词面的 verbs 只当参考
            lexical_verbs = None
        verbs = lexical_verbs
    # None(整族)与空集(无意图)是两回事,统一折成一个布尔量再判
    ui_intent: bool = verbs is None or bool(verbs)
    if not already and mode != "always" and not ui_intent and not want_api:
        return out or None

    existing = set(out)
    prefixes = await _online_prefixes(user_id) if ui_intent else frozenset()
    for prefix in sorted(prefixes):
        allowed = _FAMILY_ACTIONS.get(prefix, frozenset())
        picked = allowed if verbs is None else (verbs | {"describe"}) & allowed
        for verb in sorted(picked):
            name = f"{prefix}{verb}"
            if name not in existing:
                existing.add(name)
                out.append(name)
    if want_api:
        for name in _API_ENTRY_TOOLS:
            if name not in existing:
                existing.add(name)
                out.append(name)

    added = [t for t in out if t not in set(requested or [])]
    if added:
        logger.info(
            "[control_autonomy] 服务端注入工具 user=%s 来源=%s 新增=%s",
            str(user_id)[:8],
            "已携带工具→整族" if already else "词面意图",
            added,
        )
    return out or None


def clear_cache_for_tests() -> None:
    """测试用:清进程内在线端缓存。"""
    _online_cache.clear()


# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
