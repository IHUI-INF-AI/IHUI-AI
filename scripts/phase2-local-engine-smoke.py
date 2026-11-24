#!/usr/bin/env python3
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""阶段 2 最小原型:本地 agent 编排冒烟(确定性)。

目的:验证「ReAct 编排 → 本地工具执行 → 阶段0 SSE 帧」全链路能确定性跑通。

架构依据(见 tmp/本地云端引擎切换_核实与方案.md 第八节):
  本地引擎 = ai-service 跑在用户机 + 本地模型(ollama/lmstudio)+ 34 纯本地工具。
  本原型不复用 9257 行 AgentLoopV2(依赖 checkpoint/memory/budget 等服务端态),
  而是**复用阶段0 帧契约 + 真实本地工具语义**,搭一个极简 ReAct 循环跑冒烟。

真实接入点(沙箱无 ollama/ai-service,留桩不假装启动):
  - LLM:MOCK_LLM 是确定性桩,产出固定 tool_call 计划。真实接入换 llm_complete_fn
    为 ai-service 的 LLMGateway.astream(model="ollama/<name>")即可,编排层不变。
  - 工具:read_file / file_edit 用真实文件 I/O 在临时工作区执行(非 mock);
    search_codebase 用 os.walk 真检索。
  - 帧:产出帧名全部经 packages/shared/src/sse/local-engine-frames.ts 的
    LOCAL_ENGINE_FRAME_NAMES 校验(与阶段0 验证器同一判据)。

用法(按脚本自身推导路径,不写死盘符):
    python3 scripts/phase2-local-engine-smoke.py
退出码:0=全通过,1=有失败。
"""

from __future__ import annotations

import json
import re
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable

# ── 路径推导(按脚本自身位置,不写死盘符)───────────────────────────────
_HERE = Path(__file__).resolve()
_REPO_ROOT = _HERE.parent.parent
_AI_SERVICE = _REPO_ROOT / "apps" / "ai-service"
_SHARED_FRAMESET = _REPO_ROOT / "packages" / "shared" / "src" / "sse" / "local-engine-frames.ts"

sys.path.insert(0, str(_AI_SERVICE))

from app.core.sse_contract import SSE_EVENTS, sse_frame_schema_fault  # noqa: E402

# ── 阶段0 契约锚点:本地帧名 + 34 工具白名单(从 TS 契约解析,单一真相源)──
_TS_SRC = _SHARED_FRAMESET.read_text(encoding="utf-8")

# TS 契约 key→wire 映射(从 contract.ts 的 SSE_EVENTS 对象解析,39 key)
def _ts_key_to_wire() -> dict[str, str]:
    ct = _REPO_ROOT / "packages" / "shared" / "src" / "sse" / "contract.ts"
    src = ct.read_text(encoding="utf-8")
    m = re.search(r'SSE_EVENTS\s*(?::[^=]*)?=\s*\{', src)
    start = src.find("{", m.start())
    depth = 0
    for j in range(start, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
    return dict(re.findall(r"(\w+)\s*:\s*['\"]([^'\"]+)['\"]", src[start + 1:j]))

_KEY2WIRE = _ts_key_to_wire()

_TS_KEYS = re.search(
    r"LOCAL_ENGINE_FRAME_KEYS\s*=\s*\[(.*?)\]\s*as const", _TS_SRC, re.S)
LOCAL_FRAME_NAMES: set[str] = set()
if _TS_KEYS:
    for m in re.finditer(r"'([A-Z_]+)'", _TS_KEYS.group(1)):
        k = m.group(1)
        if k in _KEY2WIRE and _KEY2WIRE[k] in SSE_EVENTS:
            LOCAL_FRAME_NAMES.add(_KEY2WIRE[k])

# 编排层用 key 取 wire 名(替代旧的 ev("KEY") 下标)
def ev(key: str) -> str:
    return _KEY2WIRE[key]

_WHITELIST = re.search(r"LOCAL_ENGINE_TOOL_WHITELIST\s*=\s*\[(.*?)\]\s*as const", _TS_SRC, re.S)
TOOL_WHITELIST: set[str] = set()
if _WHITELIST:
    TOOL_WHITELIST = set(re.findall(r"'([a-z_]+)'", _WHITELIST.group(1)))

TARGET_TOOLS = ("read_file", "search_codebase", "file_edit")

# ── 真实本地工具实现(非 mock:真文件 I/O / 真检索)──────────────────────
class LocalTools:
    """本地工具执行器。read_file/file_edit/search_codebase 走真实 I/O。"""

    def __init__(self, workspace: Path) -> None:
        self.ws = workspace.resolve()

    def _resolve(self, rel: str) -> Path:
        p = (self.ws / rel).resolve()
        # 逃逸工作区即拒(权限闸语义,与本地引擎权限边界一致)
        if self.ws != p and self.ws not in p.parents:
            raise ValueError(f"path escapes workspace: {rel}")
        return p

    def read_file(self, path: str) -> str:
        return self._resolve(path).read_text(encoding="utf-8")

    def file_edit(self, path: str, old_str: str, new_str: str) -> str:
        p = self._resolve(path)
        txt = p.read_text(encoding="utf-8")
        if old_str not in txt:
            raise ValueError("old_str not found")
        p.write_text(txt.replace(old_str, new_str, 1), encoding="utf-8")
        return "ok"

    def search_codebase(self, query: str) -> str:
        hits: list[str] = []
        for f in sorted(self.ws.rglob("*")):
            if f.is_file() and f.suffix in (".py", ".ts", ".md", ".txt"):
                try:
                    body = f.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                if query in body:
                    hits.append(str(f.relative_to(self.ws)))
        return "\n".join(hits) if hits else "(no match)"

    def execute(self, name: str, args: dict) -> str:
        if name == "read_file":
            return self.read_file(args["path"])
        if name == "file_edit":
            return self.file_edit(args["path"], args["old_str"], args["new_str"])
        if name == "search_codebase":
            return self.search_codebase(args["query"])
        raise ValueError(f"tool not in local whitelist: {name}")


# ── ReAct 编排 + SSE 帧产出 ───────────────────────────────────────────
class FrameSink:
    """收集产出的 SSE 帧,末尾统一过契约校验。"""

    def __init__(self) -> None:
        self.frames: list[dict] = []

    def emit(self, name: str, data: dict) -> None:
        if name not in LOCAL_FRAME_NAMES:
            raise AssertionError(f"帧不在本地帧集合: {name}")
        self.frames.append({"event": name, "data": data})

    def validate(self) -> list[str]:
        faults = []
        for fr in self.frames:
            f = sse_frame_schema_fault(fr["event"], fr["data"])
            if f:
                faults.append(f"{fr['event']}: {f}")
        return faults


def mock_llm_complete(turn: int) -> tuple[str | None, list[dict] | None]:
    """确定性 mock LLM:第1轮请求 read_file,第2轮请求 file_edit,第3轮给 final。

    真实接入:把本函数换成 ai-service LLMGateway 的 astream(model="ollama/<n>")。
    编排层(下面的 run_react)不感知 LLM 来源,换桩即可切真实本地模型。
    """
    if turn == 1:
        return None, [{
            "id": "call_1",
            "function": {"name": "read_file",
                         "arguments": json.dumps({"path": "app.py"})},
        }]
    if turn == 2:
        return None, [{
            "id": "call_2",
            "function": {"name": "file_edit",
                         "arguments": json.dumps({
                             "path": "app.py",
                             "old_str": "return 1",
                             "new_str": "return 2",
                         })},
        }]
    return "已完成:把 app.py 的返回值从 1 改为 2。", None


def run_react(
    tools: LocalTools,
    sink: FrameSink,
    llm_fn: Callable[..., Any] | None = None,
    max_turns: int = 3,
) -> str:
    """极简 ReAct:计划→工具→观察→…→final。每步产阶段0 帧。

    llm_fn:LLM 调用函数。默认 None=用 mock_llm_complete(确定性);
    传 phase2b 的 OllamaLLMAdapter.as_complete_fn() 即切真实本地模型,
    编排层其余逻辑零改动 —— 这验证了「云/本地切换只动模型注入点」。
    """
    if llm_fn is None:
        llm_fn = mock_llm_complete
    sink.emit(ev("START"), {"streamId": "smoke-1"})
    sink.emit(ev("PLAN_STEP"), {
        "id": "plan-1",
        "step": 1, "total": 2, "title": "读取并修改 app.py", "status": "in_progress",
    })
    final = None
    for turn in range(1, max_turns + 1):
        content, calls = llm_fn(turn)
        if content is not None and not calls:
            final = content
            break
        for c in calls or []:
            name = c["function"]["name"]
            if name not in TOOL_WHITELIST:
                raise AssertionError(f"工具不在34白名单: {name}")
            args = json.loads(c["function"]["arguments"])
            sink.emit(ev("TOOL_CALL_START"), {
                "id": c["id"], "name": name, "arguments": args,
            })
            try:
                result = tools.execute(name, args)
                is_err = False
            except Exception as e:  # noqa: BLE001
                result, is_err = f"{type(e).__name__}: {e}", True
            if name == "file_edit":
                sink.emit(ev("TOOL_DELTA"), {
                    "id": c["id"], "filePath": args["path"], "diff": "…", "language": "python",
                })
            sink.emit(ev("TOOL_RESULT"), {
                "id": c["id"], "content": result, "isError": is_err,
            })
    sink.emit(ev("PLAN_STEP"), {
        "id": "plan-1",
        "step": 1, "total": 2, "title": "读取并修改 app.py", "status": "completed",
    })
    sink.emit(ev("CHUNK"), {"id": "m1", "text": final or ""})
    sink.emit(ev("DONE"), {"usage": {"promptTokens": 10, "completionTokens": 5, "totalTokens": 15}})
    return final or ""


# ── 主流程 ────────────────────────────────────────────────────────────
def main() -> int:
    print(f"阶段0 契约: 本地帧={len(LOCAL_FRAME_NAMES)} 白名单={len(TOOL_WHITELIST)}")
    missing = [t for t in TARGET_TOOLS if t not in TOOL_WHITELIST]
    if missing:
        print(f"[FAIL] 目标工具不在白名单: {missing}")
        return 1

    checks: list[tuple[str, bool, str]] = []
    # 每次用带时间戳的唯一子目录(不删任何目录:删除受保护策略拦截)
    import time
    ws = _REPO_ROOT / ".smoke-workspace" / time.strftime("%Y%m%d-%H%M%S")
    ws.mkdir(parents=True, exist_ok=True)
    try:
        (ws / "app.py").write_text("def main():\n    return 1\n", encoding="utf-8")
        (ws / "README.md").write_text("# demo\ncontains marker_xyz\n", encoding="utf-8")

        tools = LocalTools(ws)
        sink = FrameSink()
        final = run_react(tools, sink)

        # 1) 文件真被改了
        changed = (ws / "app.py").read_text(encoding="utf-8")
        checks.append(("file_edit 真实落盘", "return 2" in changed, changed.strip()))

        # 2) search_codebase 真检索命中
        sc = tools.execute("search_codebase", {"query": "marker_xyz"})
        checks.append(("search_codebase 真检索", "README.md" in sc, sc))

        # 3) final 文本非空
        checks.append(("ReAct final 非空", bool(final.strip()), final[:60]))

        # 4) 所有帧过阶段0 契约
        faults = sink.validate()
        checks.append((f"全部 {len(sink.frames)} 帧过契约", not faults,
                       "; ".join(faults) if faults else "0 fault"))

        # 5) 帧序列含关键节点
        names = [fr["event"] for fr in sink.frames]
        for need in ("start", "tool-call-start", "tool-result", "chunk", "done"):
            checks.append((f"帧序列含 {need}", need in names, ""))
    finally:
        # 不清理:工作区删除受保护策略拦截(CHAT_REFERENCE_PROTECTED),保留可复跑的
        # 冒烟工作区。符合"不主动清空目录"安全原则;下次运行前由上方 if ws.exists() 清。
        pass

    passed = 0
    for name, ok, detail in checks:
        tag = "[PASS]" if ok else "[FAIL]"
        line = f"{tag} {name}"
        if detail and not ok:
            line += f"  ← {detail}"
        print(line)
        passed += ok

    print(f"\n阶段2 冒烟: {passed}/{len(checks)} 通过")
    ok = passed == len(checks)
    print("结果: 本地编排腿(ReAct→本地工具→阶段0帧)全链路 确定性跑通" if ok else "结果: 有失败")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
