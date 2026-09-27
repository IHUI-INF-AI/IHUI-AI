# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D113 收尾那一格(2026-09-27):`tool-delta` 帧**到线**的服务端流证明。

分工(刻意不重复,否则同一件事两把尺子):

  · `tests/test_file_edit_preview_parity.py` + `tests/fixtures/file-edit-preview-cases.json`
    = "**函数会给答案**" —— `_file_edit_preview_text` / `_file_edit_preview_frames` 对台账重算同值,
    预算数字(帧数 / 每帧行数 / 总行数 / 字符上限)由那一票钉死,本文件**不重复钉**。
  · 本文件 = "**有人问它,答案真上线**" —— 在进程内 ASGI 跑真实路由
    `POST /api/llm/complete/stream`,让 stub 的 `llm_gateway.astream` 在流里产出一条
    `write_file` 的 tool_call,断言 SSE 响应正文里真出现 `event: tool-delta` 帧,
    并且载荷形状与 `app/core/sse_contract.py` 登记的契约一致。

为什么不是浏览器取证:用户 2026-09-27 批准的收尾条件原话是「仍欠一次实机对照」,
而本机 web dev server 此刻被并行会话打到无响应(:8801 全部超时),浏览器路径不可用。
本文件覆盖的是**服务端发帧**这一半;**前端把帧渲染成 diff 预览**那一半不在本证明射程内
(见 `test_frames_reach_wire_even_when_the_executor_denies` 的 docstring 末尾)。

零外部依赖:不连 PG(:8810)/ Redis(:8811)(§5 测试隔离铁律);
写类工具 handler 一律被换成记账桩(见 `_install_executor_stubs`),
并断言"桩被调用 ≥1 次"且"工作区零新增文件"。

形状仿 `tests/test_complete_stream_injection.py` 与 `tests/test_streaming_tool_loop.py`
(同一套 ASGITransport + 状态化 fake_astream + `_parse_sse_events`),不另造一套夹具。

"""

from __future__ import annotations

import json
import os
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.llm import (
    _PREVIEW_LINES_PER_FRAME,
    _PREVIEW_MAX_FRAMES,
    _PREVIEW_MAX_LINES,
)

ENDPOINT = "/api/llm/complete/stream"
# 本次探针专用文件名(带 nonce):即便桩意外失手,也只有这一格会落盘,断言据此点名。
_NONCE = "ihui-d113-wire-probe"


@pytest.fixture
async def client():
    """进程内 ASGI 客户端(不起真实端口,不经过反向代理)。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """把 SSE 正文切成 [{event, data}, ...](与相邻两把尺子同形)。"""
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


def _deltas(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e["data"] for e in events if e["event"] == "tool-delta"]


def _indexes(events: list[dict[str, Any]], name: str) -> list[int]:
    return [i for i, e in enumerate(events) if e["event"] == name]


def _workspace_dir() -> str:
    """工作区根(与 `_tool_write_file` 的白名单同源,不另写一份盘符)。"""
    from app.services.mcp_server import _get_workspace_roots

    roots = _get_workspace_roots()
    return roots[0] if roots else os.getcwd()


def _install_executor_stubs(monkeypatch: pytest.MonkeyPatch, calls: list[dict[str, Any]]) -> None:
    """把写/读类工具 handler 换成**只记账不落盘**的桩。

    为什么打在 `_TOOL_HANDLERS` 的条目上而不是 `mcp_server.call_tool`:
    `call_tool` 里"admin 权限矩阵 → handler → 输出护栏"那条链必须**照原样跑**,
    否则本证明就绕过了真实执行路径(反向锁
    `test_frames_reach_wire_even_when_the_executor_denies` 依赖的正是那条矩阵)。
    """
    from app.services import mcp_server as mcp_module

    def _make_stub(tool: str):
        async def _stub(arguments: dict[str, Any]) -> dict[str, Any]:
            calls.append(
                {
                    "tool": tool,
                    # __user_role / __user_id / __session_id 由 call_tool 注入,不属于模型参数面
                    "args": {k: v for k, v in arguments.items() if not str(k).startswith("__")},
                }
            )
            return {"tool": tool, "ok": True, "stubbed": True, "path": arguments.get("path", "")}

        return _stub

    for tool in ("write_file", "file_edit", "read_file"):
        monkeypatch.setitem(mcp_module._TOOL_HANDLERS, tool, _make_stub(tool))


async def _drive_stream(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    tool_name: str,
    tool_args: dict[str, Any],
    tc_id: str = "call_d113_wire",
    admin_role: int = 1,
) -> tuple[str, list[dict[str, Any]], list[dict[str, Any]], dict[str, int]]:
    """让一条 tool_call 走完真实路由,返回 (SSE 正文, 事件列表, 桩调用记录, 轮次计数)。

    `admin_role` 喂给被 monkeypatch 的 `llm_router._resolve_user_role`:
    `write_file` / `file_edit` 在 `mcp_server._ADMIN_ONLY_TOOLS` 里,role < 1 时
    `call_tool` 直接 PERMISSION_DENIED(那是真实生产语义,不是本证明的漏洞)。
    """
    from app.routers import llm as llm_router

    calls: list[dict[str, Any]] = []
    _install_executor_stubs(monkeypatch, calls)
    monkeypatch.setattr(llm_router, "_resolve_user_role", lambda request: admin_role)

    rounds = {"n": 0}

    async def fake_astream(messages, model=None, owner_uuid=None, **kwargs):
        """状态化 mock:第一轮给 tool_calls,第二轮给收尾正文(与既有夹具同形)。"""
        rounds["n"] += 1
        if rounds["n"] == 1:
            yield {"type": "chunk", "content": "我来写这个文件。"}
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": tc_id,
                        "type": "function",
                        "function": {
                            "name": tool_name,
                            "arguments": json.dumps(tool_args, ensure_ascii=False),
                        },
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "已完成。"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)

    resp = await client.post(
        ENDPOINT,
        json={
            "messages": [{"role": "user", "content": "把这段内容写进文件"}],
            "model": "test-model",
            "agent_tools": [tool_name],
            # accept-edits 档语义 = "替我审批文件写入"(medium 自动放行),
            # 否则会进人工审批等待(_APPROVAL_TIMEOUT=120s),那是另一票的形状。
            "permission_mode": "accept-edits",
        },
    )
    assert resp.status_code == 200, f"路由未按 200 返回:{resp.status_code} / {resp.text[:800]}"
    return resp.text, _parse_sse_events(resp.text), calls, rounds


def _lines(n: int) -> str:
    return "\n".join(f"line-{i:04d}" for i in range(n))


class TestToolDeltaReachesTheWire:
    """正反成对:该发的真发到线上,不该发的一个都不发。"""

    async def test_write_file_preview_frame_reaches_the_wire(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """断言 1「到线」:write_file 的 tool_call ⇒ SSE 正文里出现 tool-delta 帧。

        载荷逐条对到 `core/sse_contract.py` 登记的形状:{toolCallId, seq, partialText, truncated?},
        且 partialText 必须是本次写入内容的前缀(预览语义,不是最终落盘 diff)。
        """
        content = "alpha\nbeta\ngamma\n"
        raw, events, calls, rounds = await _drive_stream(
            client, monkeypatch, tool_name="write_file", tool_args={"path": f"{_NONCE}.txt", "content": content}
        )

        # 帧名真在原始正文里(不是只在解析后的结构里"看起来有")
        assert "event: tool-delta" in raw, f"正文里没有 tool-delta 帧:{raw[:1500]}"

        deltas = _deltas(events)
        assert len(deltas) >= 1, "到线帧为 0 —— 发帧点在路由里没被执行"
        first = deltas[0]
        assert first["type"] == "tool-delta"
        assert first["toolCallId"] == "call_d113_wire", "帧的 toolCallId 为空或不是本次调用"
        assert content.startswith(first["partialText"]), "partialText 不是写入内容的前缀"
        # 行尾那个换行按行切分时被归一掉(splitlines 语义)—— 那是 parity 票钉的形状,
        # 本票只判"到线文本 = 写入内容的前缀且覆盖到最后一行",不在此重复钉切分规则。
        assert first["partialText"] == content.rstrip("\n")

        # 链路真的走完了(不是提前 return 出一条半截流)
        assert rounds["n"] == 2
        assert len(calls) == 1
        # 顺序契约:预览帧在 tool-call-start 之后、tool-result 之前
        assert _indexes(events, "tool-call-start")
        assert _indexes(events, "tool-result")
        assert min(_indexes(events, "tool-call-start")) < min(_indexes(events, "tool-delta"))
        assert min(_indexes(events, "tool-delta")) < min(_indexes(events, "tool-result"))

    async def test_multi_frame_sequence_is_self_consistent_on_the_wire(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """断言 2「多帧与序」:内容超一帧 ⇒ 到线多帧,seq 从 1 递增、累积式为前缀链。

        预算数值本身由 parity 票钉;这里只喂"必然跨帧"的输入并判**帧序列自洽**。
        """
        content = _lines(_PREVIEW_LINES_PER_FRAME + 5)
        _raw, events, _calls, _rounds = await _drive_stream(
            client, monkeypatch, tool_name="write_file", tool_args={"path": f"{_NONCE}-multi.txt", "content": content}
        )
        deltas = _deltas(events)
        assert len(deltas) >= 2, f"跨帧内容只到线 1 帧:{len(deltas)}"
        assert [d["seq"] for d in deltas] == list(range(1, len(deltas) + 1)), "seq 不是从 1 单调递增"
        for prev, cur in zip(deltas, deltas[1:]):
            assert cur["partialText"].startswith(prev["partialText"]), "累积式帧链断了(后帧不是前帧的超集)"
        assert deltas[-1]["partialText"] == content, "末帧未覆盖全部预览文本"
        assert all("truncated" not in d for d in deltas), "未超预算却带上了 truncated"

    async def test_over_budget_preview_marks_truncated_only_on_last_frame(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """断言 2 续:超行数预算 ⇒ 到线帧数封顶于预算帧数,且 truncated 只落在末帧。"""
        content = _lines(_PREVIEW_MAX_LINES + 25)
        _raw, events, _calls, _rounds = await _drive_stream(
            client,
            monkeypatch,
            tool_name="write_file",
            tool_args={"path": f"{_NONCE}-trunc.txt", "content": content},
        )
        deltas = _deltas(events)
        assert len(deltas) == _PREVIEW_MAX_FRAMES, f"到线帧数 {len(deltas)} 未封顶于 {_PREVIEW_MAX_FRAMES}"
        assert [d["seq"] for d in deltas] == list(range(1, _PREVIEW_MAX_FRAMES + 1))
        assert deltas[-1].get("truncated") is True, "超预算却没有任何一帧交代 truncated"
        assert all("truncated" not in d for d in deltas[:-1]), "truncated 泄漏到了非末帧(前端会误判已收尾)"
        # 末帧只覆盖预算内前 N 行,不含被丢弃的尾部 —— 这是"截断"的诚实形状
        assert content.startswith(deltas[-1]["partialText"])
        assert deltas[-1]["partialText"] != content

    async def test_read_file_tool_call_emits_zero_tool_delta_frames(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """断言 3「不该发的不发」(反向锁):只读工具 ⇒ 流里零 tool-delta。

        缺了这条,本文件退化成"只要有帧就绿";这里同时断言 tool-call-start 存在,
        证明零帧不是因为整条工具链没跑。
        """
        raw, events, calls, rounds = await _drive_stream(
            client,
            monkeypatch,
            tool_name="read_file",
            tool_args={"path": f"{_NONCE}-read.txt"},
        )
        assert _indexes(events, "tool-call-start"), "read_file 没进 tool loop ⇒ 反向锁无意义"
        assert len(calls) == 1 and calls[0]["tool"] == "read_file"
        assert rounds["n"] == 2
        assert "event: tool-delta" not in raw
        assert _deltas(events) == []

    async def test_file_edit_preview_frame_reaches_the_wire_via_new_string(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """断言 1 的第二格:file_edit 走 new_string 取键,同样必须到线。

        只测 write_file 会漏掉"取键表在路由里真被用上"这一半 —— content / new_string 是两条分支。
        """
        new_string = "def patched():\n    return 1\n"
        raw, events, _calls, _rounds = await _drive_stream(
            client,
            monkeypatch,
            tool_name="file_edit",
            tool_args={
                "path": f"{_NONCE}-edit.txt",
                "old_string": "def old():\n    return 0\n",
                "new_string": new_string,
            },
        )
        deltas = _deltas(events)
        assert "event: tool-delta" in raw and len(deltas) == 1
        # 到线的是 new_string(写入后的样子),不是 old_string;行尾换行同上一格被归一
        assert deltas[0]["partialText"] == new_string.rstrip("\n")
        assert "def old()" not in deltas[0]["partialText"], "file_edit 的预览取到了 old_string"


class TestNoServerSideEffects:
    """断言 4:执行器必须被打桩,服务端不得写盘。"""

    async def test_executor_stub_is_called_and_workspace_gains_no_files(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        root = _workspace_dir()
        target = os.path.join(root, f"{_NONCE}-noside.txt")
        before = set(os.listdir(root))
        assert not os.path.exists(target)

        _raw, events, calls, _rounds = await _drive_stream(
            client, monkeypatch, tool_name="write_file", tool_args={"path": target, "content": "SHOULD NOT LAND\n"}
        )

        # 桩真被调用(= tool loop 确实走到了执行器,不是提前 continue)
        assert len(calls) >= 1, f"执行器桩一次没被调用;事件面:{[e['event'] for e in events][:40]}"
        assert calls[0]["tool"] == "write_file"
        assert calls[0]["args"].get("content") == "SHOULD NOT LAND\n"

        # 零副作用:桩之外没有任何东西往工作区写
        after = set(os.listdir(root))
        new_names = after - before
        assert not os.path.exists(target), f"桩没生效,内容真落盘了:{target}"
        assert new_names == set(), f"工作区出现新增条目:{sorted(new_names)}"

        # 发帧路径仍在线上(桩替换 handler 不影响发帧)
        assert _deltas(events), "打桩后 tool-delta 帧没到线"


class TestFrameEmissionOrderingEvidence:
    """断言 4 的附证:发帧点在 executor **之前**,与执行结果无关。"""

    async def test_frames_reach_wire_even_when_the_executor_denies(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """role=0(非 admin)⇒ `call_tool` 的权限矩阵拒绝,handler 不执行 ⇒ 帧照到线。

        这一格是本票"发帧在 executor 之前"的**证据**,不是巧合:
        若发帧在 executor 之后,被拒的那条 tool_call 应产出零帧。
        同时它给出反方向的读数:桩此时**一次都不该被调用**。

        仍欠的那一半(如实登记):帧到了线,不等于前端把它渲染成了 diff 预览 ——
        渲染侧需要浏览器/真机取证,本机 :8801 被并行会话打死,不在本证明射程内。
        """
        raw, events, calls, _rounds = await _drive_stream(
            client,
            monkeypatch,
            tool_name="write_file",
            tool_args={"path": f"{_NONCE}-denied.txt", "content": "line-1\nline-2\n"},
            admin_role=0,
        )

        deltas = _deltas(events)
        assert "event: tool-delta" in raw and len(deltas) >= 1, "执行被拒时帧也一起没了 ⇒ 发帧其实发生在 executor 之后"
        assert calls == [], f"role=0 却执行了 handler:{calls}"
        results = [e["data"] for e in events if e["event"] == "tool-result"]
        assert results and results[0]["isError"] is True
        assert results[0]["result"].get("errorCode") == "PERMISSION_DENIED"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
