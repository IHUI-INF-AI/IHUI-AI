# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 10 批 R4 回归锁:主对话链工具结果装配点必须过宿主定界单源(2026-10-31)。

修复前主聊天链(llm.py 8 处 / conversation.py 1 处 / agent_orchestrator.py 1 处)
把工具结果 ``json.dumps(exec_result)[:4000]`` 裸拼进 role:tool —— 网页/文件/命令
输出里一句"忽略以上指令"或伪造 ``<ihui-system-reminder>`` 直达模型(第 8 批只接了
agent_loop_v2,主链漏网)。定界行为本身由 test_tool_context_boundary.py 钉住,
本文件钉**接线面**:三个装配文件的 role:tool content 不允许再出现裸拼。

protocol_adapter 的 role:tool 构造是**既有消息的协议转换**(客户端/上游回放),
不是新工具结果通道 —— 双重定界会破坏回放,刻意不接(此处一并断言其未接,
防未来误改)。
"""

from __future__ import annotations

from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent / "app"


def _read(rel: str) -> str:
    return (APP / rel).read_text(encoding="utf-8")


class TestMainChainToolResultFraming:
    def test_llm_router_no_raw_dump_into_tool_role(self) -> None:
        src = _read("routers/llm.py")
        # 裸拼形态 = dumps 结果直接赋值或内联进消息(绕开定界);作为定界调用的
        # 参数出现是合法形态
        assert "result_json = json.dumps(exec_result" not in src, (
            "llm.py 仍有裸拼 exec_result 直接进模型上下文(必须经定界单源)"
        )
        assert '"content": json.dumps(exec_result' not in src
        assert src.count("scan_and_frame_tool_result(") >= 8, (
            "llm.py 8 处装配点应全部引用定界单源"
        )
        assert "from ..services.tool_context_boundary import scan_and_frame_tool_result" in src

    def test_conversation_framed_and_host_instruction_outside_frame(self) -> None:
        src = _read("services/conversation.py")
        assert "result_json = json.dumps(exec_result" not in src
        assert "scan_and_frame_tool_result(" in src
        # 失败分支的宿主指令必须引用**定界后**的 raw_tool_json(宿主话在块外,
        # 外部数据在块内)
        assert "Raw result: {raw_tool_json}" in src

    def test_agent_orchestrator_framed(self) -> None:
        src = _read("services/agent_orchestrator.py")
        assert '"content": str(exec_result)' not in src, (
            "agent_orchestrator.py 仍有裸拼 exec_result 进 role:tool"
        )
        assert "scan_and_frame_tool_result(" in src

    def test_agent_loop_v2_single_source_untouched(self) -> None:
        """第 8 批的既有接线仍在(单源未被绕开)。"""
        src = _read("services/agent_loop_v2.py")
        assert "bound_tool_result_for_context" in src
        assert "scan_and_frame_tool_result(" in src

    def test_protocol_adapter_stays_unframed(self) -> None:
        """协议转换器处理的是既有消息回放,不得接定界(双重包裹破坏回放)。"""
        src = _read("services/protocol_adapter.py")
        assert "scan_and_frame_tool_result" not in src
