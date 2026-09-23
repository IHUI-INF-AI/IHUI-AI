# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批58(三十一):测试桩完整性守卫 —— 防止「生产换了 API、桩还指着旧名」。

## 为什么需要这个文件
批58(十六)把网络审批门从 ``evaluate_network_access`` 迁到带原因码的
``evaluate_network_access_detailed``(返回 ``(verdict, denial_reason)``),
**生产侧改了、测试桩没跟着改**。后果不是"少测一点",而是:

* ``tests/test_mcp_server.py::test_fetch_url_success`` 桩失效 → 门 fail-closed
  拒绝 → 用例**恒红**;
* ``tests/test_configure_automation_task_real.py`` 两条 webhook 用例同样恒红;
* 更要紧的是:网络放行/拒绝这条**安全控制链**实际上零覆盖,
  而红灯被当成"已知无关失败"混在回归里 —— 这正是漂移能藏住的原因。

本文件做两件事:
1. 把网络审批门的 **deny / allow 两条路径**真正测到(离线、可复现);
2. 加一条全测试目录的静态扫描:``patch("a.b.c")`` 形式的目标属性必须真实存在,
   让"改名不同步"在 CI 里立刻暴露,而不是等某天有人发现用例恒红。
"""

from __future__ import annotations

import ast
import importlib
from pathlib import Path

import pytest

from app.services.mcp_server import _tool_fetch_url

_AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
_MCP_SERVER_SRC = _AI_SERVICE_ROOT / "app" / "services" / "mcp_server.py"


# ===========================================================================
# 1. 生产侧:必须调用带原因码的 API(旧桩失效的根因就在这里)
# ===========================================================================


def test_fetch_url_uses_detailed_gate_api_only():
    """fetch_url 必须只调 ``evaluate_network_access_detailed``。

    若生产回退到无原因码版本,则"拒绝原因码/可读消息"能力静默消失,
    同时历史桩又会重新"看起来有效" —— 两个方向都是退化,故一并钉住。
    """
    src = _MCP_SERVER_SRC.read_text(encoding="utf-8")
    assert "evaluate_network_access_detailed" in src
    # 裸调用 evaluate_network_access( 不应再出现(_detailed 不会误命中:其后是 _ 不是 "(")
    import re

    assert not re.search(r"evaluate_network_access\s*\(", src), (
        "mcp_server 又出现了无原因码版本的调用,请确认是否回退"
    )


# ===========================================================================
# 2. 门的两条路径:deny 必须有原因码 / allow 必须真的放行
# ===========================================================================


async def _feturn(url: str, monkeypatch, verdict: str, denial: str | None):
    """以受控的门结论调用 fetch_url(离线:httpx 被替换为不可用桩)。"""
    import app.services.network_approval as _na
    import app.services.screenshot_service as _ss

    monkeypatch.setattr(_ss, "_validate_url_ssrf", lambda u: (True, ""))
    calls: list[tuple[str, str | None]] = []

    def _gate(u: str, reason: str | None = None) -> tuple[str, str | None]:
        calls.append((u, reason))
        return verdict, denial

    monkeypatch.setattr(_na, "evaluate_network_access_detailed", _gate)

    class _NoNetwork:
        def __init__(self, *a, **kw):
            raise RuntimeError("stub-no-network")

    monkeypatch.setattr("httpx.AsyncClient", _NoNetwork)
    out = await _tool_fetch_url({"url": url})
    return out, calls


async def test_fetch_url_deny_path_returns_reason_code(monkeypatch):
    """拒绝路径:必须返回 NETWORK_APPROVAL_DENIED + 原因码(此前零覆盖)。"""
    out, calls = await _feturn(
        "https://evil.example.com/x", monkeypatch, "deny", "not_allowed"
    )
    assert out["ok"] is False
    assert out["errorCode"] == "NETWORK_APPROVAL_DENIED"
    assert out.get("denialReason") == "not_allowed"
    assert len(calls) == 1, "审批门未被调用一次"


async def test_fetch_url_allow_path_really_passes_the_gate(monkeypatch):
    """放行路径:门 allow 后必须**越过审批门**(而不是被 fail-closed 挡住)。

    这里刻意不打桩 httpx:让它以 ``stub-no-network`` 抛错,从而只验证
    "是否越过了审批门" —— 结论里只要不是 NETWORK_APPROVAL_DENIED,
    就证明桩真的生效了(这正是此前恒红用例想表达而没表达出来的东西)。
    """
    out, calls = await _feturn(
        "https://example.com/page", monkeypatch, "allow", None
    )
    assert len(calls) == 1, "审批门未被调用:桩已失效"
    assert calls[0][1] == "tool:fetch_url", "审批门未收到调用来源标注"
    assert out.get("errorCode") != "NETWORK_APPROVAL_DENIED", (
        "门结论为 allow 却仍被拒绝 → 桩没生效(大概率生产换了 API 名)"
    )


# ===========================================================================
# 3. 全测试目录扫描:patch 目标属性必须存在
# ===========================================================================

_TESTS_DIR = Path(__file__).resolve().parent


def _iter_patch_targets() -> list[tuple[str, str, int]]:
    """扫出所有 ``patch("a.b.c", ...)`` 形式的目标(字符串常量第一参)。"""
    found: list[tuple[str, str, int]] = []
    for path in sorted(_TESTS_DIR.glob("*.py")):
        try:
            tree = ast.parse(path.read_text(encoding="utf-8"))
        except SyntaxError:  # pragma: no cover - 语法坏应由别的门拦
            continue
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", "")
            if name != "patch" or not node.args:
                continue
            # create=True 表示**刻意**给不存在的属性打桩(常见于 mock 延迟 import),
            # 这类目标不存在是设计意图,不是失效,跳过。
            if any(
                kw.arg == "create"
                and isinstance(kw.value, ast.Constant)
                and kw.value.value is True
                for kw in node.keywords
            ):
                continue
            target = node.args[0]
            if not isinstance(target, ast.Constant) or not isinstance(target.value, str):
                continue
            dotted = target.value
            if "." not in dotted:
                continue
            module_path, _, attr = dotted.rpartition(".")
            found.append((f"{module_path}|{attr}", str(path.name), node.lineno))
    return found


def test_every_patch_target_attribute_exists():
    """``patch("app.services.X.y")`` 的 y 必须真实存在。

    能抓到:函数被改名/删除/搬模块后测试没同步(该类失效**不会**让用例报错,
    只会让桩静默无效 —— 本次三条恒红用例的根因正是它)。
    """
    broken: list[str] = []
    unjudgeable = 0
    for target, filename, lineno in _iter_patch_targets():
        module_path, _, attr = target.partition("|")
        try:
            module = importlib.import_module(module_path)
        except Exception:  # noqa: BLE001 - 模块本身不可导入时无法判定,跳过
            unjudgeable += 1
            continue
        if hasattr(module, attr):
            continue
        # 目标可能是一个尚未被 import 的子模块(如 patch("a.b.sub_module"))
        try:
            importlib.import_module(f"{module_path}.{attr}")
            continue
        except Exception:  # noqa: BLE001
            pass
        broken.append(f"{filename}:{lineno} -> {module_path}.{attr}")

    assert not broken, (
        "以下 patch 目标属性不存在(桩必然静默失效):\n  " + "\n  ".join(broken)
    )
    # 扫描规模哨兵:若断言恒真(例如扫描逻辑坏了),这条会先炸
    assert len(_iter_patch_targets()) > 50, "patch 目标扫描结果过少,疑似扫描逻辑失效"
    _ = unjudgeable  # 不可判定计数仅用于诊断,不参与断言
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
