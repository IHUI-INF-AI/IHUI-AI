# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-08b 票3:客户端已放弃 ⇒ 服务端不得再启动该任务(engine.py 执行入口守卫)。

输入口径(照票面):turn 请求到达后、引擎真正开始生成前断开连接
(ASGI `http.disconnect` 注入 —— 与 httpx 客户端 cancel 同语义)。
断言取**副作用没发生**口径(AGENTS §5):引擎执行入口一次都不被触发 ——
turn 计数、`_permission_requests` 待决表、事件缓冲都只在引擎任务里产生,
入口不启动 ⇒ 三者必然零增量;只断言 4xx/499 是不合格的,这里断的是"没启动"。
对照组:连接完好的同型请求必须正常进引擎(证明守卫没有过度拦截)。
"""

import asyncio
import json
from importlib import import_module

import pytest
from starlette.requests import Request

engine_mod = import_module("app.routers.engine")


def _make_request(body: dict | list, *, disconnect_after_body: bool) -> Request:
    """构造带 ASGI receive 注入的 starlette Request(有状态,顺序保证)。

    disconnect_after_body=True:body 读完后 receive 给出 http.disconnect
    (engine_rpc 的判序是先 json() 再判断开,与真实客户端"发完就断"同形);
    False:body 之后无消息,is_disconnected 的 CancelScope 不等待、判"未断开"。
    """
    messages: list[dict] = [
        {"type": "http.request", "body": json.dumps(body).encode("utf-8")}
    ]
    if disconnect_after_body:
        messages.append({"type": "http.disconnect"})

    async def receive_fn():
        if messages:
            return messages.pop(0)
        # 连接完好场景:receive 挂起(is_disconnected 用即时取消的 CancelScope
        # 调它,不会真等;若真被等到,测试会超时暴露判序问题)
        await asyncio.Event().wait()

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/engine/rpc",
        "headers": [],
        "query_string": b"",
    }
    return Request(scope, receive_fn)


@pytest.fixture()
def engine_spy(monkeypatch):
    """替换 ENGINE.handle_message 为记录器:执行入口是否被触发,以此为准。"""
    calls: list[dict] = []

    async def _spy(message, emit=None):
        calls.append(message)
        return {"jsonrpc": "2.0", "id": (message or {}).get("id"), "result": {"ok": True}}

    monkeypatch.setattr(engine_mod.ENGINE, "handle_message", _spy)
    return calls


def _rpc_body(method: str = "thread.state") -> dict:
    return {
        "jsonrpc": "2.0",
        "id": 7,
        "method": method,
        "params": {"threadId": "t-1", "userId": "spoofed"},
    }


async def test_disconnected_request_never_enters_engine(engine_spy):
    """断开注入 ⇒ 引擎执行入口零触发,应答为"拒收、未执行"错误档。"""
    resp = await engine_mod.engine_rpc(_make_request(_rpc_body(), disconnect_after_body=True))
    assert engine_spy == [], "客户端已放弃,服务端却仍启动了引擎任务(副作用发生了)"
    payload = json.loads(resp.body)
    assert payload["id"] == 7
    assert payload["error"]["code"] == engine_mod.ABANDONED_REQUEST


async def test_streaming_disconnected_yields_no_frame_and_never_enters_engine(engine_spy):
    """流式方法:写 transport 之前判断 ⇒ 不启动引擎任务、一帧不发。"""
    body = _rpc_body("thread.prompt")
    request = _make_request(body, disconnect_after_body=True)
    # 真实链路里 Starlette 在调 handler 前已消费完 body;直调生成器须同序 drain,
    # 否则 is_disconnected 收到的下一帧是 body 而非 http.disconnect(判序失真)。
    await request.body()
    frames: list[str] = []
    async for frame in engine_mod._sse_stream(body, request):
        frames.append(frame)
    assert frames == [], "断开后仍有帧被写入 transport"
    assert engine_spy == [], "断开后引擎任务仍被创建(副作用发生了)"


async def test_connected_request_still_executes(engine_spy):
    """对照组:连接完好 ⇒ 正常进引擎(守卫只拦已放弃的,不拦活请求)。"""
    resp = await engine_mod.engine_rpc(_make_request(_rpc_body(), disconnect_after_body=False))
    assert len(engine_spy) == 1
    payload = json.loads(resp.body)
    assert payload["result"] == {"ok": True}


async def test_batch_disconnected_never_enters_engine(engine_spy):
    """批量分支同样守:断开连接上到达的批量请求 ⇒ 整批不执行。"""
    body = [_rpc_body("thread.state"), _rpc_body("thread.state")]
    resp = await engine_mod.engine_rpc(_make_request(body, disconnect_after_body=True))
    assert engine_spy == []
    payload = json.loads(resp.body)
    assert payload["error"]["code"] == engine_mod.ABANDONED_REQUEST
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
