"""端到端验证 mcp_server 工具注册 + 双模式 dispatch_subagent。

直接调用函数,排除 HTTP/JSON 编码干扰。
"""
import asyncio
import json
import sys
import os

# 加载 .env(确保 STEPFUN_API_KEY 等已注入)
from dotenv import load_dotenv
load_dotenv()

# 确保能 import app 包
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services import mcp_server
from app.services.mcp_server import _tool_dispatch_subagent, _tool_schedule_task, _tool_file_edit, _TOOLS, _TOOL_HANDLERS


async def main():
    # ===== 1. 检查工具注册表 =====
    print("=" * 60)
    print("[1] 检查工具注册表")
    print("=" * 60)
    tool_names = [t.name for t in _TOOLS]
    print(f"已注册 {len(_TOOLS)} 个工具:")
    for name in sorted(tool_names):
        registered = "✓" if name in _TOOL_HANDLERS else "✗"
        print(f"  {registered} {name}")

    print()
    print(f"schedule_task 是否注册: {'schedule_task' in tool_names}")
    print(f"file_edit 是否注册: {'file_edit' in tool_names}")
    print(f"dispatch_subagent 是否注册: {'dispatch_subagent' in tool_names}")

    # ===== 2. dispatch_subagent 并行模式 =====
    print()
    print("=" * 60)
    print("[2] dispatch_subagent 并行模式(tasks 数组)")
    print("=" * 60)
    args = {
        "tasks": [
            {"name": "code-reviewer", "task": "review the file README.md"},
            {"name": "bug-fixer", "task": "check potential bugs in server.ts"},
        ],
        "max_concurrency": 2,
    }
    print(f"调用参数: {json.dumps(args, ensure_ascii=False, indent=2)}")
    result = await _tool_dispatch_subagent(args)
    print(f"返回结构: {json.dumps(result, ensure_ascii=False, indent=2, default=str)[:600]}")
    print(f"模式: {result.get('mode')}")
    print(f"ok: {result.get('ok')}")

    # ===== 3. dispatch_subagent 单 agent 模式 =====
    print()
    print("=" * 60)
    print("[3] dispatch_subagent 单 agent 模式(name+task)")
    print("=" * 60)
    args2 = {"name": "code-reviewer", "task": "review README.md"}
    result2 = await _tool_dispatch_subagent(args2)
    print(f"返回结构: {json.dumps(result2, ensure_ascii=False, indent=2, default=str)[:400]}")

    # ===== 4. schedule_task =====
    print()
    print("=" * 60)
    print("[4] schedule_task 注册")
    print("=" * 60)
    args3 = {
        "name": "round2-e2e-test",
        "prompt": "write a hello world python snippet",
        "schedule": "recurring",
        "cron": "*/2 * * * *",
        "agent_tools": ["read_file", "write_file"],
    }
    result3 = await _tool_schedule_task(args3)
    print(f"返回结构: {json.dumps(result3, ensure_ascii=False, indent=2, default=str)[:600]}")

    # ===== 5. file_edit =====
    print()
    print("=" * 60)
    print("[5] file_edit conflict 检测 + 成功替换")
    print("=" * 60)
    test_file = os.path.abspath(".trae-cn/tmp/file_edit_target.txt")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write("line1 old\nline2 keep\nline3 old\nline4 keep\n")

    # 5a. 多匹配 conflict
    args_conflict = {
        "file_path": test_file,
        "old_string": "old",
        "new_string": "new",
        "replace_all": False,
    }
    r_conflict = await _tool_file_edit(args_conflict)
    print(f"conflict 测试: ok={r_conflict.get('ok')} errorCode={r_conflict.get('errorCode')} match_count={r_conflict.get('match_count')}")

    # 5b. replace_all=true 成功替换
    args_ok = dict(args_conflict)
    args_ok["replace_all"] = True
    r_ok = await _tool_file_edit(args_ok)
    print(f"replace_all 测试: ok={r_ok.get('ok')} replaced_count={r_ok.get('replaced_count')}")
    print(f"备份文件: {r_ok.get('backup_path')}")
    with open(test_file, "r", encoding="utf-8") as f:
        print(f"替换后文件内容:\n{f.read()}")

    print()
    print("=" * 60)
    print("全部测试完成")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
