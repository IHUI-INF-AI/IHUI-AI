# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""D107b 前提校正 + 防回潮锁。

第 44 轮登记的 D107b 说"5 处 message-only thinking 帧被两港同时丢弃",据此前会按
"改字段 / 撤帧"处理对话流体验。本轮实测把前提钉清楚:

1. **发射点全部不在运行时路径上**
   - `services/langgraph_service.py`(4 处)已退役:`langgraph_service` 无任何运行时 import
     (只有模块内 self-singleton),`a2a_service.py:394` 与 `agents.py:866` 都改走
     `agent_executor.run`,`agents.py:1022-1025` 记着双兜底死分支已删。
   - `services/agent_loop.py:563` 在 `AgentExecutor.run_stream` 内,而该方法
     **无生产调用方**(只有它自己的用例与一句过时注释);路由用的是 `.run(...)`。
2. **活着的 thinking 通道是另一条**:`thinking.delta` 走 hook 总线,payload 键是
   `content`(见 `routers/agents.py:634`),与 `app/core/sse_contract.py` 的
   `SSEEventContract("thinking", ("content",))` 一致,api-client `tryParseThinking`
   也只认 `content`。

所以"用户在长任务期看不到阶段标签"不是这条帧造成的(它压根没上网),D107b 不作为
对话流缺陷实施;真正要防的是**将来有人把 message-only 发射点接到活路径上** ——
那才会静默丢弃。本文件用静态白名单把这件事钉住。
"""

from __future__ import annotations

from pathlib import Path

import pytest

APP_ROOT = Path(__file__).resolve().parents[1] / "app"

# 已知**不在运行时路径上**的 message-only 发射点(退役模块 / 无调用方方法)。
# 新增条目必须同时说明"为什么不上网",否则本用例失败。
KNOWN_DEAD_EMITTERS: dict[str, str] = {
    "services/langgraph_service.py": "模块已退役:无运行时 import,a2a/agents 均改走 agent_executor.run",
    "services/agent_loop.py": "只在 AgentExecutor.run_stream 内,该方法无生产调用方(路由用 .run)",
}

_PATTERNS = ('"type": "thinking"', '"type": \'thinking\'')


def _line_is_message_only_thinking(line: str) -> bool:
    """同一行里既声明 thinking 又只带 `message` 载荷(没有 content / phase)。"""
    if not any(p in line for p in _PATTERNS):
        return False
    return '"message"' in line or "'message'" in line


def _hits() -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    for py in sorted(APP_ROOT.rglob("*.py")):
        if "__pycache__" in str(py):
            continue
        text = py.read_text(encoding="utf-8")
        lines = [
            i + 1 for i, line in enumerate(text.splitlines()) if _line_is_message_only_thinking(line)
        ]
        if lines:
            out[str(py.relative_to(APP_ROOT).as_posix())] = lines
    return out


def test_only_known_dead_emitters_use_message_only_thinking() -> None:
    """活路径上不允许出现 message-only thinking 帧(契约键是 content)。"""
    hits = _hits()
    unexpected = {f: lines for f, lines in hits.items() if f not in KNOWN_DEAD_EMITTERS}
    assert not unexpected, (
        "发现新的 message-only thinking 发射点:"
        f"{unexpected}\n"
        "契约 `SSEEventContract('thinking', ('content',))` 只声明 content,"
        "api-client tryParseThinking 也只认 content → 这类帧会被静默丢弃。"
        "要么改用 content / phase 枚举 + 端内取词,要么别在活路径上发。"
    )


def test_dead_emitter_ledger_entries_actually_exist() -> None:
    """白名单不许变成空账(退役代码被删干净后就该同步移除条目)。"""
    hits = _hits()
    stale = [f for f in KNOWN_DEAD_EMITTERS if f not in hits]
    assert not stale, f"白名单里这些文件已无该形态发射点,请移除条目:{stale}"


@pytest.mark.parametrize("key", ["content"])
def test_contract_declares_content_as_the_thinking_payload(key: str) -> None:
    """契约侧锚点:thinking 载荷键就是 content(本用例让上面的判据不至于悬空)。"""
    src = (APP_ROOT / "core" / "sse_contract.py").read_text(encoding="utf-8")
    assert f'SSEEventContract("thinking", ("{key}",))' in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
