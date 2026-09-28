# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""O81 票㉕ 那一格:`workspace_context` 委托往返的**服务端进程内**集成证明。

分工(刻意不重复,否则同一件事两把尺子):

  · `tests/test_tool_delta_frame_reaches_the_wire.py` = `tool-delta` **预览帧**到线(D113),
    它的夹具形态(进程内 ASGI + 状态化 `fake_astream` + `_parse_sse_events` + **并发回传任务**)
    就是本文件的形状来源 —— 不另发明一套驱动方式。
  · 本文件 = `tool-delegate` **往返**:帧真上线 → 回传端点真唤醒等待 → tool loop 真续跑下一轮。
    既有测试面对这一条只有单元级证据(端点函数本身),**没人把两头接起来跑过**。

为什么不是浏览器取证:本机 8801/8802/8810/8811 实测零监听(无可登录后端),
浏览器里一次真实点击做不到;进程内 ASGI 往返是这台机上能做到的最强替代证据。

四条各自独立的断言(缺一条就有一型缺陷看不见):
  A1 帧名 `tool-delegate` 与 payload 六字段(`type`/`session_id`/`tool_call_id`/
     `tool_name`/`args`/`iteration`)到线,且排在 `tool-call-start` 之后、`tool-result` 之前;
  A2 **服务端执行器一次都没被调用**(把 `mcp_server._TOOL_HANDLERS[read_file]` 换成记账桩,
     断言零调用)⇒ 这才叫"工具不发到服务端执行"。A2 的意义由反向锁 B1 兜住:
     同一夹具**去掉 `workspace_context`** 后该桩必须被调用且零 delegate 帧 ——
     否则"零调用"可能只是"tool loop 压根没跑"。
  A3 回传**走生产端点** `POST /api/llm/complete/stream/{session_id}/tool-result`
     (并发任务轮询 `_delegate_sessions` 注册表只发现 session_id,写决策由生产代码做),
     端点返回 `{"ok": true}`;`tool-result` 帧里带客户端原样的 result 且 `delegated: true`;
  A4 **loop 续跑到下一轮**:第二轮 `astream` 实际收到的 messages 里有一条 `role: tool`
     消息,其 content 含客户端回传的 marker ⇒ "回灌"这一步不是纸面契约。

超时那一格(硬约束「不许真等 60s」):
  · 生产常量 `llm._DELEGATE_TIMEOUT = 60` 是**运行时**从模块全局读的(`await asyncio.wait_for(...,
    timeout=_DELEGATE_TIMEOUT)`),故 monkeypatch 只改测试视图、不动生产逻辑;
  · 正向用例把它设成 10s 并**断言整条往返耗时严格小于它** ⇒ 数学上排除了"是超时把它放开的"
    (真走超时支耗时必 ≥ 该值);同时断言 `errorCode != "DELEGATE_TIMEOUT"`;
  · 另开一条 T1 用例把同一常量设成 0.2s、**不回传**,量出超时支的真实形状 ——
    没有这一条,A4 里"不是超时那一支"的断言就是句空话(它从来没有反面可对照)。

隔离(AGENTS §5 测试隔离铁律 + 任务书「绝不联网」):
  · `app.core.db_pool.get_shared_pool` → 抛 `AssertionError` **并计数**(不是返回 mock)。
    为什么必须 patch:本文件跑在**任何**一台机上都可能连着生产 PG(:8810),而链路上
    `_ensure_restricted_model_access` / `_fire_callback` 落库 / memory 注入都可能取池;
    把它判成"取到即红"比"取到就默默用真实库"诚实。为什么还要计数:`AssertionError` 是
    `Exception` 的子类,链路上一处 `except Exception` 就能把它咽掉 ⇒ "跑到底没红"与
    "取了真池"在账面上长得一样,所以那条断言走 `pool_attempts == []`(见对应用例)。
    `llm.py` 里三处是**函数体内惰性 import**(llm.py:1752/2062/2198)⇒ patch 模块属性对它们
    有效(与 conftest 里 model_sync 那种绑定式 import 不同,那一型 conftest 已单独处理)。
  · `llm._fire_callback` → 记账桩并断言**零调用**:它是"流收尾 POST 到
    `{settings.api_service_url}/api/ai/callback` 并落 `chat_messages`"的唯一出口。
    按代码读,不发 `metadata.conversationId/userId` 时该分支结构上不进(`llm.py:4646`);
    本文件**不靠这句代码阅读**,把它桩掉并断言零次 ⇒ "零出站 HTTP、零落库"是被量的,不是被推的。
  · 模型层全桩(`llm_router.llm_gateway.astream`),不发任何 provider 请求;
    工具只挑 `_FS_DEPENDENT_TOOLS` 里的**只读**成员 `read_file`,无任何写语义;
  · Redis / vendor key / 限流桶由 `tests/conftest.py` 既有 autouse 夹具兜住,本文件不重复。

它**不能**证明什么(如实登记,别把绿灯读成这些):
  · 不能证明浏览器里 `onToolDelegate` 真被触发、真拿到 `FileSystemDirectoryHandle`、
    真弹出原生目录选择对话框 —— 那是 `apps/web` / 扩展端运行时,需要实机点击;
  · 不能证明回传后的 result 形状满足前端 executor 的产出契约(本文件自己造 payload);
  · 不能证明 `session_id` 经网关 `streamSessionId` 转发的那条中途引导链路。
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any

import pytest
from httpx import AsyncClient

ENDPOINT = "/api/llm/complete/stream"

# 本次探针专用 nonce:桩意外失手时,可点名的唯一标识。
_NONCE = "ihui-o81-25-delegate-probe"
_TC_ID = "call_o81_25_delegate"
# 客户端回传内容里的唯一标记 —— A4 就靠它在"第二轮模型实收 messages"里认出回灌。
_MARKER = f"delegated-read-result::{_NONCE}"

# monkeypatch 进 llm._DELEGATE_TIMEOUT 的两档值(见模块 docstring)。
_ROUNDTRIP_TIMEOUT_S = 10  # 正向用例:远小于生产 60s,失手时快红而非挂住
_TIMEOUT_BRANCH_S = 0.2  # T1 用例:刻意把超时支跑出来当反面形状

# 并发回传任务轮询注册表的上限,刻意小于 _ROUNDTRIP_TIMEOUT_S(否则先撞流内侧超时)。
_RESPOND_POLL_DEADLINE_S = 8.0

_DELEGATE_FIELDS = ("type", "session_id", "tool_call_id", "tool_name", "args", "iteration")


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """把 SSE 正文切成 [{event, data}, ...](与 `test_tool_delta_frame_reaches_the_wire` 同形)。"""
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


def _indexes(events: list[dict[str, Any]], name: str) -> list[int]:
    return [i for i, e in enumerate(events) if e["event"] == name]


def _delegates(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e["data"] for e in events if e["event"] == "tool-delegate"]


def _results(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [e["data"] for e in events if e["event"] == "tool-result"]


def _delegate_registry() -> dict[str, dict[str, Any]]:
    """读生产注册表 `llm._delegate_sessions`(只读,用例绝不往里写)。"""
    from app.routers import llm as llm_router

    return llm_router._delegate_sessions


def _install_isolation(
    monkeypatch: pytest.MonkeyPatch,
    *,
    delegate_timeout: float,
    executor_calls: list[dict[str, Any]],
    callback_fires: list[dict[str, Any]],
    pool_attempts: list[str],
) -> None:
    """装四面桩:DB 池不可取 / 执行器只记账 / 出站回调只记账 / 委托超时缩短。

    全部是 monkeypatch(测试视图),生产源码一行未动。
    """
    from app.core import db_pool as db_pool_module
    from app.routers import llm as llm_router
    from app.services import mcp_server as mcp_module

    # ① 生产 PG 连接池:取到即红(见模块 docstring 的隔离段)。
    #    同时**计数**:光"抛了异常还跑到底"不算证据 —— 链路上任何 `except Exception`
    #    都能把 AssertionError 咽掉(AssertionError 是 Exception 的子类),
    #    所以"没取池"必须由 pool_attempts 这条被量的读数来断言。
    async def _unavailable_pool() -> Any:
        pool_attempts.append("get_shared_pool")
        raise AssertionError(
            "测试隔离:委托往返用例不得取用共享 PostgreSQL 连接池(AGENTS §5 测试隔离铁律)"
        )

    monkeypatch.setattr(db_pool_module, "get_shared_pool", _unavailable_pool)

    # ② 服务端工具执行器:换成记账桩。打在 `_TOOL_HANDLERS` 条目上而不是 `call_tool`,
    #    与同族预览帧用例同一姿势 —— 权限矩阵/输出护栏那条链必须照原样跑,
    #    否则"零调用"就可能是"链路被桩短路"而不是"委托分支拦住了执行"。
    async def _recording_read_file(arguments: dict[str, Any]) -> dict[str, Any]:
        executor_calls.append(
            {
                "tool": "read_file",
                "args": {k: v for k, v in arguments.items() if not str(k).startswith("__")},
            }
        )
        return {"tool": "read_file", "ok": True, "content": "SHOULD-NOT-BE-READ-SERVER-SIDE"}

    monkeypatch.setitem(mcp_module._TOOL_HANDLERS, "read_file", _recording_read_file)

    # ③ 出站回调(→ 8802 → chat_messages 落库):桩成记账器,由用例断言零调用。
    async def _spying_fire_callback(url: str, payload: Any, metadata: Any, **kwargs: Any) -> None:
        callback_fires.append({"url": url, "metadata": metadata})

    monkeypatch.setattr(llm_router, "_fire_callback", _spying_fire_callback)

    # ④ 委托等待上限:生产 60s 不许真等(见模块 docstring)。
    monkeypatch.setattr(llm_router, "_DELEGATE_TIMEOUT", delegate_timeout)
    # 角色固定为 admin(与同族用例一致),避免权限矩阵把反向锁 B1 的服务端执行先拦掉。
    monkeypatch.setattr(llm_router, "_resolve_user_role", lambda request: 1)


def _install_model_stub(
    monkeypatch: pytest.MonkeyPatch,
    *,
    tool_args: dict[str, Any],
    tc_id: str,
    rounds: dict[str, int],
    captured: list[list[dict[str, Any]]],
    messages_ref: dict[str, list[dict[str, Any]]],
) -> None:
    """模型层桩:第一轮吐一条 `read_file` tool_call,第二轮收尾。绝不发真实 provider 请求。"""
    from app.routers import llm as llm_router

    async def fake_astream(
        messages: list[dict[str, Any]],
        model: str | None = None,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> Any:
        rounds["n"] += 1
        # 快照 = **这一轮模型实际看到的** messages(A4 的证据面);同时留活列表引用。
        captured.append([dict(m) for m in messages])
        messages_ref.setdefault("list", messages)
        if rounds["n"] == 1:
            yield {"type": "chunk", "content": "我先读一下这个文件。"}
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": 0,
                        "id": tc_id,
                        "type": "function",
                        "function": {
                            "name": "read_file",
                            "arguments": json.dumps(tool_args, ensure_ascii=False),
                        },
                    }
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "已按前端读到的内容回答。"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


async def _drive_delegate_roundtrip(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    tc_id: str = _TC_ID,
    tool_args: dict[str, Any] | None = None,
    workspace_context: str | None = '{"src/demo.py": "// probe"}',
    respond_body: dict[str, Any] | None = None,
    delegate_timeout: float = _ROUNDTRIP_TIMEOUT_S,
) -> dict[str, Any]:
    """跑一整条委托往返(帧到线 → 并发回传走生产端点 → 流收尾),返回全部证据面。

    `respond_body=None` ⇒ 不回传(留给超时支形状用)。
    httpx ASGITransport 整响应缓冲 ⇒ 读不到半截流,回传必须由**并发任务**做
    (与 `test_tool_delta_frame_reaches_the_wire.py::test_frames_reach_wire_even_when_user_rejects_approval`
    同一约束、同一处置)。轮询只**发现** session_id,写等待状态的一直是生产端点。
    """
    from app.routers import llm as llm_router

    args: dict[str, Any] = tool_args or {"path": f"{_NONCE}.txt"}
    executor_calls: list[dict[str, Any]] = []
    callback_fires: list[dict[str, Any]] = []
    pool_attempts: list[str] = []
    rounds = {"n": 0}
    captured: list[list[dict[str, Any]]] = []
    messages_ref: dict[str, list[dict[str, Any]]] = {}
    box: dict[str, Any] = {}

    _install_isolation(
        monkeypatch,
        delegate_timeout=delegate_timeout,
        executor_calls=executor_calls,
        callback_fires=callback_fires,
        pool_attempts=pool_attempts,
    )
    _install_model_stub(
        monkeypatch,
        tool_args=args,
        tc_id=tc_id,
        rounds=rounds,
        captured=captured,
        messages_ref=messages_ref,
    )

    bg_task: asyncio.Task[dict[str, Any]] | None = None
    # 快照注册表:同一 worker 内先前用例可能留下同名 pending 键(session_id 每流 uuid4,
    # 但按 (sid, key) 成对排除最稳),只认**本次流新造**的那一条。
    before = {
        (sid, key)
        for sid, pendings in llm_router._delegate_sessions.items()
        for key in pendings
    }

    async def _respond_via_production_endpoint() -> dict[str, Any]:
        deadline = time.monotonic() + _RESPOND_POLL_DEADLINE_S
        while time.monotonic() < deadline:
            for sid, pendings in list(llm_router._delegate_sessions.items()):
                key = f"pending_{tc_id}"
                if key not in pendings or (sid, key) in before:
                    continue
                assert respond_body is not None
                resp = await client.post(f"{ENDPOINT}/{sid}/tool-result", json=respond_body)
                box.update(
                    {
                        "session_id": sid,
                        "status": resp.status_code,
                        "body": resp.json(),
                    }
                )
                return box
            await asyncio.sleep(0.005)
        raise AssertionError(
            f"{_RESPOND_POLL_DEADLINE_S}s 内 _delegate_sessions 没出现新的 pending_{tc_id} ⇒ "
            "委托分支根本没进(注册表未写 / tool loop 未走到 delegate)。"
            f"当前注册表:{ {s: sorted(d) for s, d in llm_router._delegate_sessions.items()} }"
        )

    body: dict[str, Any] = {
        "messages": [{"role": "user", "content": "读一下 src/demo.py 并概括"}],
        "model": "test-model",
        "agent_tools": ["read_file"],
        # 刻意不发 metadata.conversationId/userId(回调分支的结构前提),另由 callback_fires
        # 的零调用断言把这条阅读结论变成被量的事实。
        "permission_mode": "default",
    }
    if workspace_context is not None:
        body["workspace_context"] = workspace_context

    bg_task: asyncio.Task[dict[str, Any]] | None = (
        asyncio.create_task(_respond_via_production_endpoint()) if respond_body is not None else None
    )
    started = time.monotonic()
    try:
        resp = await client.post(ENDPOINT, json=body)
        assert resp.status_code == 200, f"路由未按 200 返回:{resp.status_code} / {resp.text[:800]}"
    except BaseException:
        if bg_task is not None:
            bg_task.cancel()
        raise
    bg_result = await bg_task if bg_task is not None else None
    elapsed = time.monotonic() - started

    return {
        "raw": resp.text,
        "events": _parse_sse_events(resp.text),
        "executor_calls": executor_calls,
        "callback_fires": callback_fires,
        "pool_attempts": pool_attempts,
        "rounds": rounds["n"],
        "captured": captured,
        "messages_ref": messages_ref.get("list", []),
        "response_box": box,
        "bg_result": bg_result,
        "elapsed_s": elapsed,
        "leftover_sessions": {
            # 只看**本次流新造**的条目(按 before 快照排除同 worker 内更早用例的可能残留)
            sid: sorted(k for k in d if (sid, k) not in before)
            for sid, d in llm_router._delegate_sessions.items()
        },
    }


class TestWorkspaceDelegateRoundtrip:
    """A1–A4:带 workspace_context 的请求 ⇒ 委托帧上线 → 客户端回传 → 循环续跑。"""

    async def test_delegate_frame_reaches_the_wire_with_contract_payload(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A1 + A3:帧名与六字段到线、序在 start/result 之间;回传端点确实唤醒了等待。"""
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body={"tool_call_id": _TC_ID, "result": {"content": _MARKER, "truncated": False}},
        )
        raw, events = out["raw"], out["events"]

        # 帧名在**原始正文**里(不是只在解析后的结构里"看起来有")
        assert "event: tool-delegate" in raw, f"正文里没有 tool-delegate 帧:{raw[:1500]}"
        delegates = _delegates(events)
        assert len(delegates) == 1, f"委托帧应恰好一帧,实得 {len(delegates)}"

        frame = delegates[0]
        assert frame["type"] == "tool-delegate"
        assert all(k in frame for k in _DELEGATE_FIELDS), f"payload 缺字段:{sorted(frame)}"
        assert frame["tool_call_id"] == _TC_ID
        assert frame["tool_name"] == "read_file"
        assert frame["args"] == {"path": f"{_NONCE}.txt"}, "委托帧没把模型给的参数原样递给前端"
        assert frame["iteration"] == 1

        # 回传走的是生产端点,并被它认下(session_id 由生产码生成,不是测试自造)
        box = out["response_box"]
        assert box and box["status"] == 200, f"回传端点没走通:{box}"
        assert box["body"].get("ok") is True, f"端点没接受这次回传:{box['body']}"
        assert box["session_id"] == frame["session_id"], (
            "回传所用 session 与帧内 session_id 不同 ⇒ 唤醒的不是本流的等待"
        )

        # 次序契约:前端要能在弹窗前看到"这步开始了",再看到"交给你执行",最后看到结果
        starts = _indexes(events, "tool-call-start")
        dg = _indexes(events, "tool-delegate")
        rs = _indexes(events, "tool-result")
        assert starts and dg and rs, f"事件面缺环节 start={starts} delegate={dg} result={rs}"
        assert min(starts) < min(dg) < min(rs), "tool-delegate 应排在 start 之后、result 之前"

        # 结果帧把客户端的载荷原样带回,并打上 delegated 标记(前端据此不显示"服务端已执行")
        result_frame = _results(events)[0]
        assert result_frame["toolCallId"] == _TC_ID
        assert result_frame["delegated"] is True, "结果帧没交代这次是委托执行"
        assert result_frame["isError"] is False
        assert result_frame["result"]["ok"] is True
        assert result_frame["result"]["result"] == {"content": _MARKER, "truncated": False}, (
            "tool-result 帧里没有客户端回传的原样 result"
        )
        assert result_frame["result"].get("errorCode") is None

    async def test_server_side_executor_is_never_invoked_for_a_delegated_tool(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A2:委托分支必须**拦住**服务端执行 —— read_file 的执行桩一次都不该被调用。

        这条单独开例,是为了让"零调用"读起来是一句断言而不是顺带的副产品。
        它的反面(不委托时该桩必须被调用)在 `TestDelegateIsConditionalOnWorkspaceContext`。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body={"tool_call_id": _TC_ID, "result": {"content": _MARKER}},
        )
        assert out["executor_calls"] == [], (
            f"工具真在服务端执行了,委托只是顺带发个帧:{out['executor_calls']}"
        )
        # 回灌给模型的也必须是前端那份,不是服务端桩的返回值(两处都得干净)
        result_frame = _results(out["events"])[0]
        assert "SHOULD-NOT-BE-READ-SERVER-SIDE" not in json.dumps(
            result_frame["result"], ensure_ascii=False
        ), "结果帧里掺了服务端执行器的内容"

    async def test_tool_loop_continues_to_the_next_round_with_the_client_result(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A4:回传后 tool loop **真的续跑** —— 第二轮模型实收 messages 里含前端结果。

        这是本票唯一能证"唤醒之后还往下走"的断言:只看 `tool-result` 帧会出现一种假绿
        —— 发完帧就 break 的实现同样能产出这一帧。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body={"tool_call_id": _TC_ID, "result": {"content": _MARKER, "lines": 12}},
        )

        assert out["rounds"] == 2, f"模型应被调用两轮(第一轮决策 → 第二轮续跑),实得 {out['rounds']}"
        assert len(out["captured"]) == 2

        second_round = out["captured"][-1]
        tool_msgs = [m for m in second_round if m.get("role") == "tool" and m.get("tool_call_id") == _TC_ID]
        assert len(tool_msgs) == 1, f"第二轮应有且仅有一条本次 tool 回灌,实得 {len(tool_msgs)}"
        content = str(tool_msgs[0]["content"])
        assert _MARKER in content, f"回灌的不是客户端上传的那份结果:{content[:400]}"
        assert "SHOULD-NOT-BE-READ-SERVER-SIDE" not in content, "服务端桩的内容混进了回灌"
        assert '"ok": true' in content, f"回灌结果没被判定为成功:{content[:200]}"

        # 活消息列表(会进历史落库那条)同样含回灌
        assert any(
            m.get("role") == "tool" and _MARKER in str(m.get("content", "")) for m in out["messages_ref"]
        ), "活 messages 列表里没有回灌条目"

        # 收尾仍在:done 帧 + plan 快照都按委托结果更新(链路没在半截 break)
        assert _indexes(out["events"], "done"), "缺 done 帧 ⇒ 流未正常收尾"
        plans = [e["data"] for e in out["events"] if e["event"] == "plan_updated"]
        assert any(
            p.get("explanation") == "工具 read_file 已完成" for p in plans
        ), f"委托成功没有反映到 plan 快照的交代里:{[p.get('explanation') for p in plans]}"

    async def test_roundtrip_is_woken_by_the_post_not_by_the_timeout(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """硬约束:证明走的是"收到回传"那一支,且**没有**真等 60s。

        两条判据合起来才成立:① 耗时严格小于本次注入的等待上限(生产 60s 时该断言无意义,
        所以刻意把上限缩到 10s —— 真走超时支耗时必 ≥ 上限);② 结果形状是回传支的形状。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body={"tool_call_id": _TC_ID, "result": {"content": _MARKER}},
        )
        assert out["elapsed_s"] < _ROUNDTRIP_TIMEOUT_S, (
            f"整条往返耗时 {out['elapsed_s']:.2f}s ≥ 注入的等待上限 "
            f"{_ROUNDTRIP_TIMEOUT_S}s ⇒ 更像是等到超时被放开,而不是被回传唤醒"
        )
        raw = out["raw"]
        assert "DELEGATE_TIMEOUT" not in raw, "命中了超时支(不该发生)"
        result_frame = _results(out["events"])[0]
        assert result_frame["result"].get("errorCode") not in ("DELEGATE_TIMEOUT", "DELEGATE_NO_RESULT")

    async def test_delegate_session_is_cleaned_up_after_the_stream(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """注册表卫生:流收尾后本流的委托 session 不得残留(llm.py finally 那一条清理)。

        残留的 session 会让后来的同名 session 命中"有 pending 却没人 await"的空壳。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body={"tool_call_id": _TC_ID, "result": {"content": _MARKER}},
        )
        sid = out["response_box"]["session_id"]
        assert sid not in out["leftover_sessions"], f"委托 session 残留:{out['leftover_sessions']}"

    async def test_no_outbound_callback_and_no_db_pool_use(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """隔离自证:桩过的出口确实一次都没被碰(不是"看不见所以没发生")。

        `_fire_callback` 被桩成记账器 → 零调用 ⇒ 整条链零出站 HTTP、零落库;
        `get_shared_pool` 的桩**边抛边计数** ⇒ 断言 `pool_attempts == []`。
        为什么不能只靠"用例跑到底没红":`AssertionError` 是 `Exception` 的子类,
        链路上任何一处 `except Exception` 都能把它咽掉,那时"没红"与"取了真池"长得一样。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body={"tool_call_id": _TC_ID, "result": {"content": _MARKER}},
        )
        assert out["callback_fires"] == [], f"链路触发了出站回调:{out['callback_fires']}"
        assert out["pool_attempts"] == [], f"链路尝试取用共享 PG 连接池:{out['pool_attempts']}"
        # 阳性对照:上面那三句"零"不是因为整条流没跑
        assert out["rounds"] == 2 and _delegates(out["events"]), "流没跑完,零调用不构成证据"


class TestDelegateIsConditionalOnWorkspaceContext:
    """反向锁 B1/B2:帧不是"只要有 read_file 就发"。缺了这两条,上面一片绿灯可以是空转。"""

    async def test_without_workspace_context_the_tool_runs_server_side_and_no_delegate_frame(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """同一夹具、同一个工具,**只去掉 workspace_context** ⇒ 执行桩必须被调用、零委托帧。

        这条同时给 A2 的"零调用"发了反面:否则"桩没被调用"也可能只是 tool loop 压根没跑
        (桩失效/工具名不被识别都长这个样子)。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            workspace_context=None,
            respond_body=None,
            delegate_timeout=_TIMEOUT_BRANCH_S,  # 不回传;本例不该进等待,真进了就以超时形状现形
        )
        raw, events = out["raw"], out["events"]

        assert _indexes(events, "tool-call-start"), "read_file 没进 tool loop ⇒ 反向锁无意义"
        assert "event: tool-delegate" not in raw, "无 workspace_context 仍发委托帧"
        assert _delegates(events) == []
        assert len(out["executor_calls"]) == 1, (
            f"本地工作区模式下服务端应自己执行,实得调用 {len(out['executor_calls'])} 次"
        )
        assert out["executor_calls"][0]["tool"] == "read_file"
        # 回灌的是服务端执行结果,且**没有** delegated 标记
        result_frame = _results(events)[0]
        assert result_frame.get("delegated") is not True
        assert "SHOULD-NOT-BE-READ-SERVER-SIDE" in json.dumps(result_frame["result"], ensure_ascii=False)

    async def test_timeout_branch_is_a_distinguishable_shape(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """反面形状(刻意不回传):超时支产出 `DELEGATE_TIMEOUT`、`isError: true`、且**不续跑**。

        为什么必须入库这一条:A1–A4 全靠"errorCode 不是超时"来区分两支,而从没量过
        超时支长什么样 ⇒ 那句区分可能区分的是两个都不存在的形状。这里用 0.2s 上限把
        真分支跑出来(生产 60s 不许真等)。
        """
        out = await _drive_delegate_roundtrip(
            client,
            monkeypatch,
            respond_body=None,
            delegate_timeout=_TIMEOUT_BRANCH_S,
        )
        raw, events = out["raw"], out["events"]

        assert "event: tool-delegate" in raw, "委托帧仍应上线(超时支的前提是帧已发出)"
        assert _delegates(events), "解析后没有委托帧 ⇒ 本例没测到等待那一格"
        result_frame = _results(events)[0]
        assert result_frame["isError"] is True
        assert result_frame["result"].get("errorCode") == "DELEGATE_TIMEOUT", (
            f"超时支的 errorCode 形状变了,正向用例那句『不是超时』判据同时失效:{result_frame['result']}"
        )
        assert result_frame.get("delegated") is True
        # 与正向用例同一条尺子的反方向:耗时必 ≥ 注入的等待上限 ⇒ 这一支真的是"等不到被放开"。
        # 缺了这句,正向用例里"耗时 < 上限"的判据就只是单边阈值,量不出两个分支的分别。
        assert out["elapsed_s"] >= _TIMEOUT_BRANCH_S, (
            f"未回传却只耗时 {out['elapsed_s']:.3f}s(< 注入上限 {_TIMEOUT_BRANCH_S}s)"
            " ⇒ 等待被别的东西放开,本例测的不是超时支"
        )
        assert out["rounds"] == 1, f"唯一工具超时应短路收尾不回喂模型,实得 {out['rounds']} 轮"
        assert "工具执行失败" in raw
        # 超时支也要把 pending 从注册表摘掉(llm.py:3962 那一条 pop)
        assert all(
            f"pending_{_TC_ID}" not in keys for keys in out["leftover_sessions"].values()
        ), f"超时后 pending 残留:{out['leftover_sessions']}"


class TestToolResultEndpointGuard:
    """端点自身的那一格:session 不在了就必须拒,不得"顺手造一个"。"""

    async def test_unknown_session_is_rejected_not_resurrected(self, client: AsyncClient) -> None:
        """`POST .../{session_id}/tool-result` 对未知 session 回 ok=False。

        正向用例只证了"认下的那条 session";不补这一条,端点写成"查不到就新建一个"
        同样能让正向用例绿(而回传结果会被扔进一个没人 await 的桶)。
        """
        resp = await client.post(
            f"{ENDPOINT}/no-such-session-{_NONCE}/tool-result",
            json={"tool_call_id": _TC_ID, "result": {"content": _MARKER}},
        )
        assert resp.status_code == 200
        body: dict[str, Any] = resp.json()
        assert body.get("ok") is False
        assert "session not found" in str(body.get("error", ""))
        assert f"no-such-session-{_NONCE}" not in _delegate_registry(), "未知 session 被端点凭空创建"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
