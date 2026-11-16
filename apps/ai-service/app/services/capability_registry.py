# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器能力自描述注册表 — 统一实现 26.1111 capabilities.list()(2026-11-15 取证)。

设计依据
--------
``内部规格`` §4(能力发现机制,
明文 TS 按行为规格)::

    type BrowserCapabilityCollection = {
      get(id): Promise<unknown>;
      list(): Promise<Array<{id, description}>>;
    };

Codex 语义:agent 在运行时**发现自己有哪些能力**(自描述权限),不必硬编码能力名
—— "能力即数据"。本仓对照缺口:browser_* 工具的能力面散在 ``tool_name_sets.json``
与各路由,**没有统一的运行时自描述出口**;agent 无法在运行时列出"当前浏览器栈
支持哪些能力"。

设计要点(纯函数注册表,零 IO)
------------------------------
- ``CapabilityRegistry``:线程安全的不可变快照注册表(注册即冻结);
- ``register``:登记 ``CapabilityInfo(id, description)``;重复 id 覆盖(后注册胜出);
- ``list``:返回排序后的 ``(id, description)`` 列表(稳定顺序,便于断言与展示);
- ``get``:按 id 取单个能力描述;缺失返回 None(不抛,调用方自行降级);
- 与既有层关系:不接管 IHUI 工具 schema 注入(那是 ``tool_schema_adapter``),
  只提供"浏览器栈运行时能力面"的自描述出口,供 agent 动态发现可用面。

刻意不做什么
------------
- 不连库、不起服务、不做权限判定:本模块只回答"有哪些能力 + 各是什么",
  是否放行调用仍由 ``cdp_method_gate`` / ``tool_approval_descriptor`` 等既有层裁决;
- 不硬编码 IHUI 全部工具名:注册表内容由调用方按实际可用面填充。
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from threading import RLock


@dataclass(frozen=True)
class CapabilityInfo:
    """单个能力自描述项(Codex ``CapabilityInfo`` 语义)。"""

    id: str
    description: str

    def to_dict(self) -> dict[str, str]:
        return {"id": self.id, "description": self.description}


class CapabilityRegistry:
    """浏览器能力自描述注册表(不可变快照,线程安全)。

    用法::

        reg = CapabilityRegistry()
        reg.register(CapabilityInfo("cdp", "受限 Chrome DevTools Protocol 访问"))
        reg.register(CapabilityInfo("element-snapshot", "元素多候选定位快照"))
        listing = reg.list()          # 排序后的 [(id, description), ...]
        one = reg.get("cdp")          # CapabilityInfo | None
    """

    def __init__(self, initial: Iterable[CapabilityInfo] = ()) -> None:
        self._lock = RLock()
        self._caps: dict[str, CapabilityInfo] = {}
        for info in initial:
            self.register(info)

    def register(self, info: CapabilityInfo) -> None:
        """登记一个能力;重复 id 覆盖(后注册胜出)。id 空串即拒。"""
        if not info.id or not info.id.strip():
            raise ValueError("capability id 不能为空")
        with self._lock:
            self._caps[info.id] = info

    def get(self, capability_id: str) -> CapabilityInfo | None:
        """按 id 取单个能力;缺失返回 None(调用方自行降级,不抛)。"""
        with self._lock:
            return self._caps.get(capability_id)

    def list(self) -> tuple[CapabilityInfo, ...]:
        """返回按 id 排序的能力列表(稳定顺序)。"""
        with self._lock:
            return tuple(sorted(self._caps.values(), key=lambda c: c.id))

    def ids(self) -> tuple[str, ...]:
        """返回排序后的能力 id 列表。"""
        with self._lock:
            return tuple(sorted(self._caps))

    def __len__(self) -> int:
        with self._lock:
            return len(self._caps)


__all__ = ["CapabilityInfo", "CapabilityRegistry"]
