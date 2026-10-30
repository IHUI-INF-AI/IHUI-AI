# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""会话级污点追踪(2026-10-26 P0-2,对标 nanoMuse Sentinel taint tracking)。

核心命题:会话一旦读过私密数据(secret / 凭据保险库 / 用户私密文件),该会话
后续任意**出网**调用 —— 只要目标不在 egress_allowlist —— 一律需要人工审批,
**即使 auto 模式也拦**。这是防 prompt injection 的实用防线:被注入的指令无法
借"已读私密数据"的会话把数据悄悄外送。

本模块是纯函数内核:
- 不持有运行时状态;会话污点状态以 ``SessionTaint`` 数据类传入/传出,
  便于单测与后端无关;
- 出网判据用 ``urllib.parse`` 取 hostname 直接匹配 allowlist,零依赖
  (生产端若要并入 app.core.config.resolve_egress_facts 的"内网/代理"语义,
  可在调用侧先解析再喂 allowlist,本内核保持最小闭集);
- 凭据卫生:返回值只涉及槽名与占位符,绝不外带真值到不该去的地方。
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import StrEnum
from urllib.parse import urlparse


class TaintSource(StrEnum):
    """污点来源类别(标记会话"读过哪类私密数据")。"""

    SECRET = "secret"            # 密钥 / 凭据
    PRIVATE_DATA = "private"     # 用户私密文件 / 通讯录 / 账单
    VAULT = "vault"              # 凭据保险库真值曾被解析进本次会话


@dataclass(frozen=True)
class SessionTaint:
    """一个会话的污点状态(可序列化,交给后端存储/随会话透传)。"""

    tainted: bool = False
    sources: frozenset[str] = field(default_factory=frozenset)
    # 免批出网目标白名单:精确 host 或 `.domain` 后缀(如 ".github.com")
    egress_allowlist: frozenset[str] = field(default_factory=frozenset)

    def mark(self, source: str) -> SessionTaint:
        """标记一次污点来源,返回新风(不可变)。已含则返回自身。"""
        if self.tainted and source in self.sources:
            return self
        return SessionTaint(
            tainted=True,
            sources=frozenset(self.sources) | {source},
            egress_allowlist=self.egress_allowlist,
        )

    def with_allowlist(self, allow: Iterable[str]) -> SessionTaint:
        """设置出网免批白名单,返回新风。"""
        return SessionTaint(
            tainted=self.tainted,
            sources=self.sources,
            egress_allowlist=frozenset(allow),
        )


def _hostname_of(url: str) -> str:
    """取 URL 的 hostname(小写);解析不出返回空串(空串不匹配任何 allowlist)。"""
    try:
        host = urlparse(url).hostname or ""
    except ValueError:
        return ""
    return host.lower()


def url_in_allowlist(url: str, allowlist: Iterable[str]) -> bool:
    """url 是否命中出网免批白名单(精确 host 或 `.domain` 后缀)。"""
    host = _hostname_of(url)
    if not host:
        return False
    for entry in allowlist:
        e = entry.strip().lower()
        if not e:
            continue
        if e.startswith("."):
            if host == e[1:] or host.endswith(e):
                return True
        elif host == e:
            return True
    return False


def requires_egress_approval(taint: SessionTaint, url: str) -> bool:
    """污点会话对任意非 allowlist 出网一律需批(auto 模式也不例外)。

    判定短路顺序:
    1. 会话未污点 ⇒ 不拦(走常规审批逻辑);
    2. url 命中 egress_allowlist ⇒ 不拦(用户/部署明确放行);
    3. 否则 ⇒ 拦(需审批)。
    """
    if not taint.tainted:
        return False
    return not url_in_allowlist(url, taint.egress_allowlist)
