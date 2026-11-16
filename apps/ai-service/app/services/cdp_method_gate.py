# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型面通用 CDP 通道的方法门(独立分析 Cursor 3.27.22 后复现 + 超越)。

对照证据(主会话一手取证,Cursor 桌面端 version 3.27.22 / commit b1aa50cb):
  Cursor 主进程 out/main.js 里 `function TB(e)`(constants.js 模块)是 `browser_cdp`
  工具的**唯一强制门**,所有 CDP 指令转发前都过它,签名近似:

      function TB(method) {
        const domain = method.split(".", 1)[0];
        if (domain === "Input") return "…Input.* 不允许…(focus-sensitive in Electron webviews)";
        if (DOMAIN_DENY.has(domain) || EXACT_DENY.has(method)) return "CDP method '<m>' is not allowed";
        // 返回空串/undefined = 放行
      }
      DOMAIN_DENY = {Browser, Input, Storage, SystemInfo, Target, Tethering}
      EXACT_DENY = {DOM.setFileInputFiles, Network.clearBrowserCache,
                    Network.clearBrowserCookies, Network.deleteCookies,
                    Network.getAllCookies, Network.getCookies, Network.setCookie,
                    Network.setCookies, Page.getNavigationHistory, Page.navigate,
                    Page.navigateToHistoryEntry}

设计意图(取证归纳):Input.* 在内嵌 webview 里是焦点敏感的,会绕过"专用 browser_* 工具"
这一层审批,把输入导向 Cursor UI 而非目标页面;浏览器级域(Browser/Target/Storage/
SystemInfo/Tethering)能枚举/切换 target、读改 cookie 与 storage,属越权面,一律封死。
Network 的读写 cookie/cache、Page 的导航族单独封死,是因为这些该走专用工具且会破坏
会话作用域(本仓 browser_hub 已有 SSRF 门 + tab 作用域门)。

复现(行为):域黑名单 + 精确黑名单 + Input.* 专项,语义与 Cursor 一致 —— 拒的方向是
"多要一次定向说明"(具名拒因 + 该用哪类专用工具),不是"多放一次"。
超越(相对 Cursor 的缺口补齐,写自有代码):
  1. Cursor 的 TB 只回一段人读字符串,调用方只能 throw;本模块给**结构化拒因**
     (枚举 + 是否可重试 + 建议替身),供 MCP 工具面返回 machine-readable 结果。
  2. Cursor 黑名单是"默认放行 + 列黑";本模块增 **显式方法白名单**(allowlist),
     未登记即拒 —— 比纯黑名单更难被新 CDP 方法绕过,且白名单可关(与 Cursor 等价)。
  3. 增 **审计钩子**(on_denied),让上层把每次拒绝落 ledger,便于追责与回归。
隔离纪律:纯函数、零 IO、不连生产库、不起浏览器,可单测。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import Callable, ClassVar


class CdpDenyReason(StrEnum):
    """拒绝原因封闭集(拒的方向恒是"多要一次定向说明",具名而非裸抛)。"""

    INPUT_FOCUS_SENSITIVE = "input_focus_sensitive"  # Input.* 专项
    DOMAIN_DENIED = "domain_denied"  # 浏览器级域
    METHOD_DENIED = "method_denied"  # 精确方法
    NOT_ALLOWLISTED = "not_allowlisted"  # 白名单开启且未登记(超越项)


@dataclass(frozen=True)
class CdpDenial:
    """一次拒绝的结构化结果(machine-readable,对应 MCP structuredContent)。"""

    method: str
    reason: CdpDenyReason
    message: str
    retryable: bool
    suggested_alternative: str


# 域黑名单(与 Cursor DOMAIN_DENY 逐项对齐)
DOMAIN_DENIED: frozenset[str] = frozenset(
    {"Browser", "Input", "Storage", "SystemInfo", "Target", "Tethering"}
)

# 精确方法黑名单(与 Cursor EXACT_DENY 逐项对齐)
METHOD_DENIED: frozenset[str] = frozenset(
    {
        "DOM.setFileInputFiles",
        "Network.clearBrowserCache",
        "Network.clearBrowserCookies",
        "Network.deleteCookies",
        "Network.getAllCookies",
        "Network.getCookies",
        "Network.setCookie",
        "Network.setCookies",
        "Page.getNavigationHistory",
        "Page.navigate",
        "Page.navigateToHistoryEntry",
    }
)

# Input.* 的定向说明(取证自 Cursor TB 的 Input 分支文案)
_INPUT_MESSAGE = (
    "CDP Input.* 方法不允许:它们在内嵌 webview 里是焦点敏感的,可能把输入导向 "
    "UI 而非目标页面。请改用专用 browser 工具(click / type / press_key / scroll / drag)。"
)


@dataclass
class CdpMethodGate:
    """一道门:模型面通用 CDP 指令转发前必过。

    默认 allowlist_off=True(与 Cursor 等价:黑名单制);设为 False 启用显式白名单
    (超越项,未登记即拒)。on_denied 钩子在每次拒绝时回调(审计/ledger 用)。
    """

    allowlist: frozenset[str] = frozenset()
    allowlist_off: bool = True
    on_denied: Callable[[CdpDenial], None] | None = None

    # 白名单关闭时,这组"读侧/诊断侧"方法仍恒放行(即使 allowlist 非空)。
    # 取证:Cursor 的 browser_cdp 文案点名 Runtime.evaluate / DOM.getDocument /
    # CSS.getComputedStyleForNode / Profiler.start/stop / Performance.getMetrics /
    # Log.enable / Network.enable 是推荐用法,故列为基线白名单成员。
    BASELINE_ALLOW: ClassVar[frozenset[str]] = frozenset(
        {
            "Runtime.evaluate",
            "DOM.getDocument",
            "CSS.getComputedStyleForNode",
            "Profiler.start",
            "Profiler.stop",
            "Performance.getMetrics",
            "Log.enable",
            "Network.enable",
        }
    )

    def check(self, method: str) -> CdpDenial | None:
        """放行返回 None;拒绝返回 CdpDenial(调用方据此抛错/返回 isError)。"""
        denial = self._decide(method)
        if denial is not None and self.on_denied is not None:
            self.on_denied(denial)
        return denial

    def assert_allowed(self, method: str) -> None:
        """放行静默;拒绝抛 ValueError(供 sync 转发层直接用)。"""
        denial = self.check(method)
        if denial is not None:
            raise ValueError(denial.message)

    def _decide(self, method: str) -> CdpDenial | None:
        if not isinstance(method, str) or "." not in method:
            return CdpDenial(
                method=method if isinstance(method, str) else repr(method),
                reason=CdpDenyReason.METHOD_DENIED,
                message=f"CDP 方法 {method!r} 非法:必须是 'Domain.method' 形式。",
                retryable=False,
                suggested_alternative="传完整 CDP 方法名,例如 Runtime.evaluate。",
            )
        domain = method.split(".", 1)[0]
        if domain == "Input":
            return CdpDenial(
                method=method,
                reason=CdpDenyReason.INPUT_FOCUS_SENSITIVE,
                message=_INPUT_MESSAGE,
                retryable=False,
                suggested_alternative="browser_click / type_text / press_key / scroll / drag。",
            )
        if domain in DOMAIN_DENIED:
            return CdpDenial(
                method=method,
                reason=CdpDenyReason.DOMAIN_DENIED,
                message=f"CDP 域 {domain}.* 不允许(浏览器级枚举/切换/存储面)。",
                retryable=False,
                suggested_alternative="改走 browser_hub 的专用会话/动作接口。",
            )
        if method in METHOD_DENIED:
            return CdpDenial(
                method=method,
                reason=CdpDenyReason.METHOD_DENIED,
                message=f"CDP 方法 {method} 不允许(会破坏会话作用域或读改敏感状态)。",
                retryable=False,
                suggested_alternative="cookie/cache/导航走专用工具,勿用通用 CDP 通道。",
            )
        if not self.allowlist_off:
            if method in self.BASELINE_ALLOW or method in self.allowlist:
                return None
            return CdpDenial(
                method=method,
                reason=CdpDenyReason.NOT_ALLOWLISTED,
                message=f"CDP 方法 {method} 未在白名单内(显式白名单模式)。",
                retryable=False,
                suggested_alternative="若确需该诊断方法,向 allowlist 显式登记。",
            )
        return None


__all__ = [
    "CdpDenial",
    "CdpDenyReason",
    "CdpMethodGate",
    "DOMAIN_DENIED",
    "METHOD_DENIED",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
