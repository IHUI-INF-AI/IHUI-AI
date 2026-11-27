# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""T1.3 的锁:契约轴接线的存在性与方向。

为什么用"源码锚"而不是构造 AgentLoopV2 实例:
该类构造需要 20+ 个依赖(事件总线 / 工具表 / 钩子 / 双轴 ...),为一次接线断言搭那套夹具,
成本高于收益,而且夹具本身会腐烂。真正要防的回归是**接线被无声删掉**(本仓高频失效型:
"造好没装车"),那是源码锚能钉住的。
判序本身(只能收紧、不能放宽)已由 `test_tool_contract.py::TestTighteningOnly` 覆盖。
"""

from __future__ import annotations

from pathlib import Path

from app.core.tool_contract import tightening_only
from app.core.tool_contract_registry import LookupState, load_registry

LOOP = Path(__file__).resolve().parents[1] / "app" / "services" / "agent_loop_v2.py"


def _real_registry_path() -> Path | None:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "protocol" / "itcp-registry.json"
        if candidate.is_file():
            return candidate
    return None


class TestContractAxisWiring:
    def test_三处接线都在(self):
        src = LOOP.read_text(encoding="utf-8")
        # ① 导入:注册表与三态枚举
        assert "from ..core.tool_contract_registry import (" in src
        assert "_ContractLookupState" in src
        # ② 构造期加载:注册表在 __init__ 里只读一次
        assert "self._tool_contracts = _load_tool_contract_registry()" in src
        # ③ 决策链:抬升点与未判定留痕点
        assert "itcp_contract_requires_approval" in src
        assert "itcp_contract_unjudged" in src
        # 方向:只抬升,不得出现"契约把它们降回去"的写法
        assert "needs_approval = False" not in src.split("itcp_contract_requires_approval")[1][:400]

    def test_抬升点位于污点闸门之后(self):
        # 位置即判据:契约轴必须晚于污点闸门(同级安全地板),才能在会话级授权之后生效
        src = LOOP.read_text(encoding="utf-8")
        taint_at = src.index("taint_egress_gate")
        contract_at = src.index("itcp_contract_requires_approval")
        assert contract_at > taint_at, "契约轴不得早于污点闸门"

    def test_契约强制人批的工具清单(self):
        path = _real_registry_path()
        if path is None:
            return
        registry = load_registry(path)
        assert registry.state.name == "LOADED"
        mandated = [name for name, entry in registry.entries.items() if entry.human_approval_mandated()]
        # 事实锚:当前注册表里只有 alwaysAsk 那一档才强制(requiresApproval=true 的工具若有也会进来)
        assert mandated, "应当至少有 ai_delete 这类 alwaysAsk 工具"
        # 不得把 read 档工具误判成需批
        read_tools = [n for n in mandated if registry.entries[n].permission and registry.entries[n].permission.get("riskLevel") == "read"]
        assert read_tools == [], f"只读工具不应强制人批: {read_tools}"

    def test_unjudged_时不放行也不抬升(self):
        # 接线纪律:注册表不可用时维持宿主原判(既不冒绿也不加码),并留痕
        path = _real_registry_path()
        if path is None:
            return
        registry = load_registry("/nonexistent/itcp.json")
        assert registry.state.name == "MISSING"
        assert registry.lookup("run_command").state is LookupState.UNJUDGED
        # 此时 tightening_only 的输入载体为空 ⇒ 不改变宿主决策
        assert tightening_only("allow", {}) == "allow"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
