# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815970 同型补正:会延长回合的调用必须被取消信号穿透(接线形状锁)。

立因(2026-10-29):``9fdbc207ba``「清理功能回退残留」把 ``session.start`` 与
``PRE_TOOL_USE`` 两处 ``_wait_interruptible`` 包裹当残件删除,而行为测试
``test_hook_init_is_interruptible.py`` 留在仓里 ⇒ HEAD 面两红静置。

行为面已由既有两枚文件钉死,本文件**不复制**任何行为判据(§0.6 单一真相源):
- ``tests/test_compact_is_interruptible.py``:压缩途中置取消 ⇒ ≤0.25s 轮询窗口
  返回 cancelled 且不进重试链;压缩正常完成 ⇒ 包裹层原样返回、重试状态零漂移。
- ``tests/test_hook_init_is_interruptible.py``:hook 初始化 / PRE_TOOL_USE 同上。

本文件只锁"接线形状"——票面要求的不是"多检查几次",而是信号必须进到会延长
回合的三处调用内部(压缩 / session.start 钩子 / 生命周期钩子),裸 await 归来
即判红。锁自带变异自检(摘掉包裹的合成片段必须被判为未包裹),保证"摘掉即翻红"。
"""

from __future__ import annotations

import ast
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "app" / "services" / "agent_loop_v2.py"

# 会延长回合、必须进 _wait_interruptible 的调用(按被调链逐字匹配)。
_TARGETS: dict[str, tuple[str, ...]] = {
    "compaction": ("self", "_maybe_compact_context"),
    "session_start_hook": ("self", "_events", "session_start"),
    "pre_tool_use_hook": ("self", "_hook_runtime", "run"),
}


def _callee_chain(node: ast.Call) -> tuple[str, ...]:
    """把 ``a.b.c(...)`` 还原成 ("a", "b", "c");非纯属性链返回空元组。"""
    parts: list[str] = []
    cur: ast.expr = node.func
    while isinstance(cur, ast.Attribute):
        parts.append(cur.attr)
        cur = cur.value
    if isinstance(cur, ast.Name):
        parts.append(cur.id)
        return tuple(reversed(parts))
    return ()


def _wrapped_targets(src: str) -> dict[str, bool]:
    """逐目标判"是否被取消穿透层包裹";返回 target -> wrapped。

    两种合法包裹形态:
    - ``self._wait_interruptible(...)``:长调用期间取消信号可立即生效;
    - ``asyncio.wait_for(..., timeout=...)``:**仅 interrupt 钩子**可用 —— 它本身就是
      取消动作的钩子,不能反过来等取消信号(否则取消途中再等取消 = 死锁),
      而是靠硬超时兜底。除 interrupt 以外出现 wait_for 包裹一律判红。
    """
    tree = ast.parse(src)
    wrapped_calls: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        chain = _callee_chain(node)
        if chain == ("self", "_wait_interruptible"):
            for arg in node.args:
                if isinstance(arg, ast.Call):
                    wrapped_calls.add(id(arg))
        elif chain == ("asyncio", "wait_for"):
            arg0 = node.args[0] if node.args else None
            if not (
                isinstance(arg0, ast.Call) and _callee_chain(arg0) in _TARGETS.values()
            ):
                continue  # 与回合延长无关的 wait_for 不在本尺子射程内
            kinds = [
                a.attr
                for a in arg0.args
                if isinstance(a, ast.Attribute) and a.attr == "INTERRUPT"
            ]
            assert kinds, (
                "asyncio.wait_for 只允许包裹 interrupt 钩子(其余调用必须走 "
                "_wait_interruptible,否则取消信号永远不生效)"
            )
            wrapped_calls.add(id(arg0))
    out: dict[str, bool] = {}
    for name, chain in _TARGETS.items():
        hits = [
            node
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and _callee_chain(node) == chain
        ]
        # 一个目标都没命中 = 判据腐烂(调用点被改名/搬走),同样判红。
        out[name] = bool(hits) and all(id(hit) in wrapped_calls for hit in hits)
    return out


def test_turn_extending_calls_are_wrapped_in_wait_interruptible() -> None:
    """三处会延长回合的调用都必须作为实参进 _wait_interruptible。"""
    wrapped = _wrapped_targets(_SRC.read_text(encoding="utf-8-sig"))
    bare = [name for name, ok in wrapped.items() if not ok]
    assert not bare, (
        f"这些调用点又变回裸 await 了(取消信号只能在它们之后检查):{bare};"
        "按 G-815970 形态包回 self._wait_interruptible(...)"
    )


def test_wiring_check_has_teeth() -> None:
    """变异自检:合成片段里摘掉包裹必须被判"未包裹",包上则判"已包裹"。"""
    bare_src = """
async def sample_bare(self, payload):
    await self._hook_runtime.run("PRE_TOOL_USE", payload)
"""
    wrapped_src = """
async def sample_wrapped(self, payload):
    await self._wait_interruptible(
        self._hook_runtime.run("PRE_TOOL_USE", payload)
    )
"""
    assert _wrapped_targets(bare_src)["pre_tool_use_hook"] is False
    assert _wrapped_targets(wrapped_src)["pre_tool_use_hook"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
