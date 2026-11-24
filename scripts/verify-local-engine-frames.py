#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""阶段 0 落地验证:本地 agent 引擎第一批帧序列 × 中央 SSE 契约判据。

用途:把「阶段 0 冻结的本地引擎帧契约」从纸面变成可复跑的执行。
- 逐帧校验第一批 4 个验收用例的帧序列,断言每个帧名 ∈ 中央契约 SSE_EVENTS
  且 ∈ 本地引擎第一批帧集合,字段级 fault 过 sse_frame_schema_fault。
- 工具调用帧断言 name ∈ 34 纯本地白名单。
- 反例组验证判据真的在咬(白名单外工具 / terminal_end 缺 totalChars 必须被抓出)。

运行:cd apps/ai-service && python ../../scripts/verify-local-engine-frames.py
    (或任意 cwd,脚本按自身位置推导 ai-service 根)
退出码:0 = 全部用例通过 + 反例全部被抓出;1 = 有失败。
不碰 check-agent-event-parity 门(那个门的既存红归其持有者)。
"""

import sys
from pathlib import Path

# 按脚本自身位置推导 ai-service 根,不写死盘符
# 脚本位于 <repo>/scripts/,故 repo 根 = 脚本父目录;ai-service = <repo>/apps/ai-service
_HERE = Path(__file__).resolve()
_REPO_ROOT = _HERE.parent.parent
_AI_SERVICE = _REPO_ROOT / "apps" / "ai-service"
if str(_AI_SERVICE) not in sys.path:
    sys.path.insert(0, str(_AI_SERVICE))

from app.core import sse_contract as c  # noqa: E402

# —— 阶段 0 冻结的本地引擎第一批帧集合(与 packages/shared/src/sse/local-engine-frames.ts 一致)——
LOCAL_ENGINE_FRAMES = {
    "start", "chunk", "reasoning", "thinking", "plan-step",
    "tool-call-start", "tool-delta", "tool-result",
    "terminal_start", "terminal_delta", "terminal_end",
    "tool-approval", "usage", "partial_done", "done", "error",
}

# —— 首批 34 个纯本地工具(与 阶段2_本地工具白名单盘点.md 一致)——
WHITELIST = {
    # 代码与检索(本地)
    "search_codebase", "analyze_code", "investigate_codebase", "get_tool_schema",
    "get_diagnostics", "file_search", "list_files", "render_repo_tree",
    # 文件读写
    "read_file", "read_image", "read_tool_output", "write_file", "file_edit", "resolve_conflict",
    # 终端与 git
    "terminal", "run_command", "sandbox_session", "git_operations",
    # 文档/表格(本地解析)
    "parse_document", "document_tables", "extract_document_assets",
    "sheet_formula_eval", "sheet_formula_validate",
    "workbook_open", "workbook_read_range", "workbook_write_cells", "workbook_close",
    # 辅助(本地产物)
    "generate_chart", "generate_report", "notebook_edit", "init_agents_md",
    "skill", "todo_write", "todo_read",
}


def validate_stream(frames):
    """逐帧校验。frames: list[(event_name, payload_dict)]。返回 (ok, issues)。"""
    issues = []
    for i, (name, payload) in enumerate(frames):
        if name not in c.SSE_EVENTS:
            issues.append(f"[帧{i}] 事件名 {name!r} 不在中央契约 SSE_EVENTS")
        if name not in LOCAL_ENGINE_FRAMES:
            issues.append(f"[帧{i}] 事件名 {name!r} 不在本地引擎第一批帧集合")
        for f in c.sse_frame_schema_fault(name, payload):
            issues.append(f"[帧{i}] {f}")
        if name == "tool-call-start":
            tool = payload.get("toolName") or payload.get("name")
            if tool and tool not in WHITELIST:
                issues.append(f"[帧{i}] tool-call-start 工具 {tool!r} 不在 34 白名单")
    return (len(issues) == 0), issues


# —— 第一批 4 个验收用例的真实帧序列 ——
CASES = {
    "用例1 单步文件": [
        ("start", {}),
        ("chunk", {"content": "我来读取 README"}),
        ("tool-call-start", {"toolCallId": "tc1", "toolName": "read_file", "args": {"path": "README.md"}}),
        ("tool-result", {"toolCallId": "tc1", "result": "# IHUI-AI\n..."}),
        ("chunk", {"content": "前10行是项目概览..."}),
        ("done", {}),
    ],
    "用例2 多步代码(ReAct)": [
        ("start", {}),
        ("reasoning", {"content": "需要先搜函数定义"}),
        ("plan-step", {"step": 1, "total": 3, "title": "定位函数"}),
        ("tool-call-start", {"toolCallId": "tc1", "toolName": "search_codebase", "args": {"query": "useAgentRuntime"}}),
        ("tool-result", {"toolCallId": "tc1", "result": "found in hooks/"}),
        ("tool-call-start", {"toolCallId": "tc2", "toolName": "read_file", "args": {"path": "hooks/x.ts"}}),
        ("tool-result", {"toolCallId": "tc2", "result": "...code..."}),
        ("tool-call-start", {"toolCallId": "tc3", "toolName": "file_edit", "args": {"path": "x.ts"}}),
        ("tool-delta", {"toolCallId": "tc3", "seq": 1, "partialText": "- old\n+ new"}),
        ("tool-result", {"toolCallId": "tc3", "result": {"ok": True}}),
        ("chunk", {"content": "已修改"}),
        ("done", {}),
    ],
    "用例3 终端命令(terminal_*)": [
        ("start", {}),
        ("tool-call-start", {"toolCallId": "tc1", "toolName": "terminal", "args": {"command": "node -v"}}),
        ("terminal_start", {"terminalId": "t1"}),
        ("terminal_delta", {"terminalId": "t1", "data": "v20.11.0\n"}),
        ("terminal_end", {"terminalId": "t1", "status": "completed", "output": "v20.11.0",
                          "exitCode": 0, "durationMs": 120, "truncated": False, "totalChars": 9}),
        ("tool-result", {"toolCallId": "tc1", "result": "Node v20.11.0"}),
        ("chunk", {"content": "Node 版本是 v20.11.0"}),
        ("done", {}),
    ],
    "用例4 git 操作": [
        ("start", {}),
        ("tool-call-start", {"toolCallId": "tc1", "toolName": "git_operations", "args": {"op": "status"}}),
        ("tool-result", {"toolCallId": "tc1", "result": "On branch main"}),
        ("chunk", {"content": "当前在 main 分支"}),
        ("done", {}),
    ],
}

# —— 反例:验证器必须抓出(否则判据失效)——
COUNTER_CASES = {
    "白名单外工具(index_codebase)": [
        ("tool-call-start", {"toolCallId": "x", "toolName": "index_codebase", "args": {}}),
    ],
    "terminal_end truncated=true 缺 totalChars": [
        ("terminal_end", {"terminalId": "t", "status": "completed", "truncated": True}),
    ],
}


def main() -> int:
    print(f"PY SSE_EVENTS={len(c.SSE_EVENTS)} 本地帧={len(LOCAL_ENGINE_FRAMES)} 白名单={len(WHITELIST)}")
    failed = 0

    for name, frames in CASES.items():
        ok, issues = validate_stream(frames)
        mark = "PASS" if ok else "FAIL"
        print(f"[{mark}] {name}")
        for i in issues:
            print(f"        {i}")
        if not ok:
            failed += 1

    print("--- 反例(验证器必须抓出)---")
    for name, frames in COUNTER_CASES.items():
        ok, issues = validate_stream(frames)
        caught = not ok
        mark = "CAUGHT" if caught else "MISSED"
        print(f"[{mark}] {name}")
        for i in issues:
            print(f"        {i}")
        if not caught:
            failed += 1
            print(f"        !! 判据未咬住该反例,验证器失效")

    total = len(CASES) + len(COUNTER_CASES)
    print(f"\n结果:{total - failed}/{total} 通过")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
