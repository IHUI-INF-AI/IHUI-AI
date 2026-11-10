# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工具调用能力探针(2026-11-08 立)。

用途:对指定端点发一次"必须调用工具"的最小请求,用**原生 tool_calls** 是否存在作为
实证结论,并把结论落库(tool_call_empirical / tool_call_verified_at + 审计行)。

判据(与 app/core/tool_capability.py 同一实现,版本 tool-trace/v1):
- 返回原生 tool_calls            → supported(tool_call_empirical = true)
- 无 tool_calls 且命中伪调用痕迹  → failed(tool_call_empirical = false)
- 无 tool_calls 且无痕迹          → no_tool_calls(不写 empirical,保持 null=未实证)

用法(在 apps/ai-service 下执行):
    python scripts/probe_tool_call_capability.py \
        --model nvidia_nim/stepfun-ai/step-5-preview \
        --model agnes/agnes-2.5-flash

输出:逐模型一行 JSON(原始 tool_calls / content 截断 / error),随后打印落库汇总。
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any

from app.core.llm_gateway import llm_gateway
from app.core.tool_capability import (
    count_tool_calls,
    detect_pseudo_tool_trace,
    record_tool_capability_verdict,
)

PROBE_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "run_command",
        "description": "Run a shell command in the worker workspace and return its stdout/stderr.",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command to execute"},
            },
            "required": ["command"],
        },
    },
}

PROBE_MESSAGES: list[dict[str, str]] = [
    {
        "role": "system",
        "content": "You are a coding worker. You must call the run_command tool, never answer in text.",
    },
    {
        "role": "user",
        "content": "Call run_command with command `pwd`, then report the resolved working directory.",
    },
]


async def probe(model: str) -> dict[str, Any]:
    result = await llm_gateway.complete(
        PROBE_MESSAGES,
        model=model,
        tools=[PROBE_TOOL],
        _skip_fallback=True,
        num_retries=0,
        temperature=0,
    )
    tool_calls = result.get("tool_calls") if isinstance(result.get("tool_calls"), list) else []
    content = str(result.get("content") or "")
    error = result.get("error") or None
    trace = detect_pseudo_tool_trace(content)

    if error:
        verdict = "error"
    elif tool_calls:
        verdict = "supported"
    elif trace:
        verdict = "failed"
    else:
        verdict = "no_tool_calls"

    if verdict in ("supported", "failed", "no_tool_calls"):
        await record_tool_capability_verdict(
            model_id=model,
            provider_code=result.get("provider") or model.split("/", 1)[0],
            verdict=verdict,
            trace_kind=trace,
            source="probe",
        )

    return {
        "model": model,
        "provider": result.get("provider"),
        "verdict": verdict,
        "has_tool_calls": bool(tool_calls),
        "tool_calls": tool_calls,
        # 原始输出截断到 400 字,留证据但不刷屏
        "content": content[:400],
        "trace_kind": trace,
        "error": error,
        "errorCode": result.get("errorCode"),
        "tool_calls_count": count_tool_calls(result),
    }


async def main() -> int:
    parser = argparse.ArgumentParser(description="工具调用能力实证探针")
    parser.add_argument("--model", action="append", required=True, help="可重复,provider/model")
    args = parser.parse_args()

    failures = 0
    for model in args.model:
        try:
            row = await probe(model)
        except Exception as e:  # noqa: BLE001 - 探针必须逐条隔离
            row = {"model": model, "verdict": "exception", "error": f"{type(e).__name__}: {e}"}
            failures += 1
        print(json.dumps(row, ensure_ascii=False), flush=True)
        if row.get("verdict") not in ("supported",):
            failures += 1

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
