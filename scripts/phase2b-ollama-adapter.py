# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""阶段 2b:本地 agent 真实 LLM 适配器(ollama OpenAI 兼容接口)。

用途:替换 phase2-local-engine-smoke.py 的 mock LLM,对接真实本地 ollama。

为什么不用 LLMGateway:
  LLMGateway 依赖 DB(_resolve_auto_model 查 model_availability)、Redis、JWT 等
  服务端态。本地单机 agent 这些都没有,故直连 ollama 的 OpenAI 兼容端点。

零重依赖:模块加载不 import httpx;实例化也不创建连接。真调 ollama 时:
  - 有 httpx → chat()(异步)
  - 无 httpx → chat_sync()(标准库 urllib,零第三方依赖)
  本地引擎轻依赖目标——适配器可被 importlib 加载做帧契约/工具面验证,无需 httpx。

接线方式(与 phase2 编排层对接,无需改 phase2 源码):
  import importlib.util; spec=...; phase2=...; phase2.loader.exec_module(phase2)
  adapter = OllamaLLMAdapter(model="qwen2.5-coder:7b")
  phase2.run_react(tools, sink, llm_fn=adapter.as_complete_fn())  # 切真模型
  # run_react 的 llm_fn 参数默认 None=mock;传 adapter 函数即切真实本地模型。

要求:ollama 已安装并在 localhost:11434 运行,已 pull 对应模型。
"""

from __future__ import annotations

import json
from typing import Any, Callable, Awaitable

# httpx 延迟导入:模块加载不依赖它;真调 ollama 时才需要。
# 本地引擎轻依赖目标——适配器可被 importlib 加载做帧契约/工具面验证,无需 httpx。
try:
    import httpx  # noqa: F401
    _HAS_HTTPX = True
except ImportError:
    httpx = None  # type: ignore
    _HAS_HTTPX = False


class OllamaLLMAdapter:
    """ollama OpenAI 兼容 API 适配器。产出 OpenAI 格式的 content / tool_calls。"""

    def __init__(
        self,
        model: str = "qwen2.5-coder:7b",
        base_url: str = "http://localhost:11434",
        timeout: float = 120.0,
        system_prompt: str | None = None,
    ) -> None:
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.system_prompt = system_prompt or (
            "你是一个本地代码 agent。用提供的工具完成任务,"
            "每次只调一个工具或给 final 回答。"
        )
        # 延迟创建:仅在真调 ollama 时需要 client;实例化不依赖 httpx。
        # 无 httpx 环境走 chat_sync()（标准库 urllib）。
        self._client = None

    def _ensure_client(self):
        if self._client is None:
            if not _HAS_HTTPX:
                raise RuntimeError(
                    "调用 ollama 需要 httpx(异步)或改用 chat_sync()（标准库 urllib）")
            self._client = httpx.AsyncClient(timeout=self.timeout)

    async def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """调 ollama（异步,需 httpx）,返回 OpenAI 格式 message。"""
        self._ensure_client()
        payload = self._build_payload(messages, tools)
        resp = await self._client.post(
            f"{self.base_url}/v1/chat/completions",
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]

    def chat_sync(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """调 ollama（同步,标准库 urllib,零第三方依赖）,返回 OpenAI 格式 message。

        本地引擎轻依赖路径:开发机没装 httpx 时也能跑真实推理。
        """
        import urllib.request
        payload = self._build_payload(messages, tools)
        req = urllib.request.Request(
            f"{self.base_url}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None,
    ) -> dict[str, Any]:
        if self.system_prompt:
            messages = [{"role": "system", "content": self.system_prompt}, *messages]
        payload: dict[str, Any] = {"model": self.model, "messages": messages, "stream": False}
        if tools:
            payload["tools"] = tools
        return payload

    def as_complete_fn(
        self,
        tools: list[dict[str, Any]] | None = None,
    ) -> Callable[..., Awaitable[tuple[str | None, list[dict] | None]]]:
        """产出与 phase2 run_react 兼容的 llm_complete_fn。

        签名:async (turn: int) -> (content: str | None, tool_calls: list[dict] | None)
        真实场景应传完整 messages;此处按 turn 迭代以适配 phase2 的确定性测试形态。
        生产环境改用 chat() 直接传 messages。
        """
        async def _fn(turn: int, messages: list[dict[str, Any]] | None = None) -> tuple[str | None, list[dict] | None]:
            msgs = messages or [{"role": "user", "content": f"Turn {turn}: 继续任务"}]
            msg = await self.chat(msgs, tools=tools)
            content = msg.get("content") or None
            tool_calls = msg.get("tool_calls") or None
            return content, tool_calls

        return _fn

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()


async def run_phase2b_smoke(model: str = "qwen2.5-coder:7b") -> None:
    """阶段 2b 冒烟:真连 ollama 跑一个 read→edit 循环。

    前置:ollama 运行中 + 已 pull {model}。沙箱里 ollama 不可用,此函数仅作为
    开发机上的可跑参考,不在沙箱自动执行。
    """
    import sys
    import importlib.util
    from pathlib import Path

    # phase2 脚本名带连字符,不能常规 import;用 importlib 按路径加载
    here = Path(__file__).resolve().parent
    spec = importlib.util.spec_from_file_location(
        "phase2_local_engine_smoke", here / "phase2-local-engine-smoke.py")
    phase2 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(phase2)

    LocalTools = phase2.LocalTools
    FrameSink = phase2.FrameSink
    TOOL_WHITELIST = phase2.TOOL_WHITELIST
    ev = phase2.ev

    import tempfile

    adapter = OllamaLLMAdapter(model=model)
    tools_dict = [
        {
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "读取文件内容",
                "parameters": {
                    "type": "object",
                    "properties": {"path": {"type": "string"}},
                    "required": ["path"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "file_edit",
                "description": "替换文件中的字符串",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {"type": "string"},
                        "old_str": {"type": "string"},
                        "new_str": {"type": "string"},
                    },
                    "required": ["path", "old_str", "new_str"],
                },
            },
        },
    ]

    llm_fn = adapter.as_complete_fn(tools=tools_dict)

    # 搭临时工作区
    d = tempfile.mkdtemp(prefix="phase2b-")
    ws = Path(d)
    (ws / "app.py").write_text("def main():\n    return 1\n", encoding="utf-8")

    tools = LocalTools(ws)
    sink = FrameSink()

    sink.emit(ev("START"), {"streamId": "phase2b-real"})
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": "读取 app.py,把 return 1 改成 return 42"},
    ]

    for turn in range(1, 11):  # 最多 10 轮
        content, calls = await llm_fn(turn, messages=messages)

        if content and not calls:
            sink.emit(ev("CHUNK"), {"id": f"m{turn}", "text": content})
            break

        for c in calls or []:
            name = c["function"]["name"]
            args = json.loads(c["function"]["arguments"]) if isinstance(c["function"]["arguments"], str) else c["function"]["arguments"]

            if name not in TOOL_WHITELIST:
                raise AssertionError(f"工具不在白名单: {name}")

            sink.emit(ev("TOOL_CALL_START"), {
                "id": c.get("id", f"call_{turn}"),
                "name": name,
                "arguments": args,
            })

            try:
                result = tools.execute(name, args)
                is_err = False
            except Exception as e:
                result, is_err = f"{type(e).__name__}: {e}", True

            sink.emit(ev("TOOL_RESULT"), {
                "id": c.get("id", f"call_{turn}"),
                "content": result,
                "isError": is_err,
            })

            messages.append({"role": "assistant", "content": None, "tool_calls": [c]})
            messages.append({"role": "tool", "tool_call_id": c.get("id", f"call_{turn}"), "content": result})

    sink.emit(ev("DONE"), {"usage": {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}})

    # 验证
    changed = (ws / "app.py").read_text(encoding="utf-8")
    faults = sink.validate()
    print(f"app.py 内容: {changed!r}")
    print(f"帧数: {len(sink.frames)}, 契约 fault: {faults or '无'}")

    await adapter.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(run_phase2b_smoke())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
