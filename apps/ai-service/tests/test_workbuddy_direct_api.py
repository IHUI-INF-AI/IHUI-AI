# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""workbuddy_direct_api(凭据直连平台 HTTP 接口完成成长任务)契约单测 — 零真实网络。

被测模块由并行 Agent 新增(app/services/workbuddy_direct_api.py),本文件独占。
模块尚未落地时整体 pytest.importorskip 跳过;落地后下列用例全部真断言,不空跑。

覆盖(对应主会话 8 条要求):
  1 受理回执不算完成(项目最高优先级防伪造判据:docs/WORKBUDDY_TASKS.md §5 /
    workbuddy_tasks.py:963-969) —— HTTP 全 200/SSE 但 progress.current 与基线一致
    ⇒ ok=False、reason 含 no_progress_advance
  2 真前进才算完成 —— progress.current 0→1 或 accept_status 变 claimed ⇒ ok=True
  3 未登记任务码 —— 结构化失败/回落、不抛异常、零 HTTP 出站
  4 HTTP 失败与超时收敛 —— TimeoutError / 500 均结构化、不抛到调度器
  5 凭据不泄漏 —— 结果/repr/str/序列化/日志/异常路径都不得含原始 token 或 ≥8
    字符前缀(实现只允许回显 len(token) 或 sha256[:8])
  6 SSE 流消费 —— 读到 [DONE],且 ": heartbeat" 注释行不得被当作正文回显
  7 ActionStep.render —— {task_code}/{request_id}/{uid}/{host} 替换,
    headers_extra 与 body_template 都生效
  8 重试/幂等上限 —— 恒失败 client 的调用次数有界,不无限重试

待主会话对齐的符号名(模块落地后按实际导出核对;集中改本文件『契约适配层』):
  - ActionStep(method / url_template / headers_extra / body_template / expect, render(ctx))
  - ACTION_TABLE: dict[str, list[ActionStep]]
  - execute_task_code(task_code, ctx, http_client, read_tasks) -> DirectApiResult
  - DirectApiResult 字段: ok / reason / steps / http_status / response_excerpt
  - ctx 键: uid / domain / access_token / request_id / conversation_id /
    task_code / expert_id / host
  - read_tasks 回读快照形态: progress.current / accept_status  ← 头号对齐项
  - reason 文案需含字面量 no_progress_advance
  - 重试上限常量名(可选): MAX_RETRIES / MAX_ATTEMPTS / RETRY_LIMIT

凭据:一律明显假值(FAKE_TOKEN),禁止读取 ~/.wb-switch 等本机真凭据。
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest

# ---------------------------------------------------------------------------
# 契约适配层(模块落地后只需按实际导出核对这一层)
# ---------------------------------------------------------------------------

wda: Any = pytest.importorskip(
    "app.services.workbuddy_direct_api",
    reason=(
        "被测模块 app/services/workbuddy_direct_api.py 由并行 Agent 产出,当前尚未落地;"
        "本文件已按契约写好全部用例,模块落地后自动启用(见文件头『待对齐符号』清单)"
    ),
)

_REQUIRED_EXPORTS = ("ActionStep", "ACTION_TABLE", "execute_task_code")

# 明显假值凭据/上下文。绝不从 ~/.wb-switch 或任何本机号池副本读取真凭据。
FAKE_TOKEN = "SECRET_TOKEN_ABCDEF123456"
_FAKE_HOST = "www.workbuddy.cn"
_UNREGISTERED_CODE = "__no_such_task_code_for_direct_api_test__"
_HEARTBEAT_SENTINEL = "PING_SENTINEL_DO_NOT_EMIT_9f3a"

_OK_NAMES = ("ok", "success", "completed", "is_ok")
_REASON_NAMES = ("reason", "message", "error", "detail", "msg")
_MISSING = object()
_CALL_TIMEOUT = 10.0  # 防无限重试把 CI 挂死
_RETRY_CEILING = 32  # 宽松上界;实现导出重试常量时按 _retry_ceiling() 收紧


@pytest.fixture(autouse=True)
def _require_contract_exports() -> None:
    missing = [name for name in _REQUIRED_EXPORTS if not hasattr(wda, name)]
    if missing:
        pytest.skip("workbuddy_direct_api 导出与契约不一致,待主会话对齐符号: " + ", ".join(missing))


def _registered_code() -> str:
    """从 ACTION_TABLE 动态取一个已登记任务码,避免硬编码码名与实现脱节。"""
    table = getattr(wda, "ACTION_TABLE", {})
    if not isinstance(table, dict) or not table:
        pytest.skip("ACTION_TABLE 为空/非 dict,待主会话登记任务码")
    return str(next(iter(table)))


def _ctx(code: str) -> dict[str, Any]:
    return {
        "uid": "fake-uid-0001",
        "domain": "copilot.tencent.com",
        "access_token": FAKE_TOKEN,
        "request_id": "req-fake-0001",
        "conversation_id": "conv-fake-0001",
        "task_code": code,
        "expert_id": "expert-fake-0001",
        "host": _FAKE_HOST,
    }


def _snapshot(code: str, current: int, *, accept_status: str = "accepted") -> dict[str, Any]:
    """read_tasks 回读快照。

    [待对齐] 契约未定:此处给出多形态富结构,让「读顶层 progress」「读 tasks[0]
    的嵌套 progress」「读 accept_status」「读 data.tasks」几种常见实现都能取到值。
    主会话定案后应收窄成单一形态,并同步 _make_read_tasks 的调用次数假设。
    """
    row: dict[str, Any] = {
        "code": code,
        "task_code": code,
        "progress": {"current": current, "target": 5},
        "accept_status": accept_status,
        "status": accept_status,
        "current": current,
    }
    return {
        "code": 0,
        "msg": "ok",
        "tasks": [row],
        "data": {"tasks": [row]},
        "progress": {"current": current, "target": 5},
        "accept_status": accept_status,
    }


def _make_read_tasks(*snapshots: dict[str, Any]) -> Any:
    """异步 read_tasks 桩:按序返回快照,耗尽后重复最后一帧(不抛 StopAsyncIteration)。"""
    it = iter(snapshots)
    last: dict[str, Any] = snapshots[-1] if snapshots else {}

    async def read_tasks(*args: Any, **kwargs: Any) -> Any:
        try:
            return next(it)
        except StopIteration:
            return last

    return read_tasks


def _sse_chunks() -> list[bytes]:
    """分块 SSE:两条 : heartbeat 注释 + 两条 data + 收尾 data: [DONE]。"""
    hb = f": heartbeat {_HEARTBEAT_SENTINEL}\n\n".encode()
    return [
        hb,
        b'data: {"delta":"chunk-A"}\n\n',
        hb,
        b'data: {"delta":"chunk-B"}\n\n',
        b"data: [DONE]\n\n",
    ]


class _FakeResponse:
    """零网络响应桩:同时兼容一次性读(.text/.json/.content/.aread)与 SSE 分块流。

    [待对齐] 若实现用 async with client.stream(...) / await client.stream(...) /
    await client.request(...) 三种形态之一,本桩都支持(__aenter__ 与 __await__)。
    """

    def __init__(
        self,
        status_code: int = 200,
        *,
        chunks: list[bytes] | None = None,
        json_body: dict[str, Any] | None = None,
    ) -> None:
        self.status_code = status_code
        self.headers: dict[str, str] = {"content-type": "application/json"}
        self._chunks: list[bytes] = (
            chunks
            if chunks is not None
            else [json.dumps(json_body if json_body is not None else {}, ensure_ascii=False).encode()]
        )
        self._text = b"".join(self._chunks).decode("utf-8", errors="replace")
        self.content = b"".join(self._chunks)
        self._text_read = False
        self._chunks_read = 0
        self.saw_done = False

    @property
    def text(self) -> str:
        self._text_read = True
        return self._text

    @property
    def reached_done(self) -> bool:
        """迭代读到了 [DONE] 块,或一次性读完了含 [DONE] 的整条流,都算消费到流末。"""
        return self.saw_done or (self._text_read and "[DONE]" in self._text)

    def json(self) -> Any:
        try:
            return json.loads(self._text)
        except json.JSONDecodeError:
            return {}

    def _mark(self, chunk: bytes) -> None:
        self._chunks_read += 1
        if b"[DONE]" in chunk:
            self.saw_done = True

    async def aread(self) -> bytes:
        for chunk in self._chunks:
            self._mark(chunk)
        return self.content

    async def aiter_bytes(self, chunk_size: int | None = None) -> Any:
        for chunk in self._chunks:
            self._mark(chunk)
            yield chunk

    async def aiter_raw(self, chunk_size: int | None = None) -> Any:
        for chunk in self._chunks:
            self._mark(chunk)
            yield chunk

    async def aiter_lines(self) -> Any:
        for line in self._text.splitlines():
            self._mark(line.encode())
            yield line

    async def aiter_text(self, chunk_size: int | None = None) -> Any:
        for chunk in self._chunks:
            self._mark(chunk)
            yield chunk.decode("utf-8", errors="replace")

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                f"fake http {self.status_code}",
                request=httpx.Request("GET", "https://fake.invalid/"),
                response=httpx.Response(self.status_code),
            )

    async def __aenter__(self) -> _FakeResponse:
        return self

    async def __aexit__(self, *exc: Any) -> bool:
        return False

    def __await__(self) -> Any:
        async def _self() -> _FakeResponse:
            return self

        return _self().__await__()


class _FakeHttpClient:
    """零网络 http_client 桩:记录每次调用与每次回包,可注入恒失败/异常/SSE。

    [待对齐] 支持 await client.request|post|get|put|patch|send(...) 与
    async with client.stream(...) as resp(或 await client.stream(...))。
    """

    def __init__(
        self,
        *,
        responder: Any = None,
        error: BaseException | None = None,
        sse: bool = False,
    ) -> None:
        self.calls: list[dict[str, Any]] = []
        self.responses: list[_FakeResponse] = []
        self._responder = responder
        self._error = error
        self._sse = sse
        self.request = AsyncMock(side_effect=self._dispatch)
        self.post = AsyncMock(side_effect=self._verb_post)
        self.get = AsyncMock(side_effect=self._verb_get)
        self.put = AsyncMock(side_effect=self._verb_put)
        self.patch = AsyncMock(side_effect=self._verb_patch)
        self.send = AsyncMock(side_effect=self._send)

    def _default(self) -> _FakeResponse:
        if self._sse:
            return _FakeResponse(200, chunks=_sse_chunks())
        return _FakeResponse(200, json_body={"code": 0, "msg": "ok", "data": {}})

    def _next(self, method: str, url: Any, kwargs: dict[str, Any]) -> _FakeResponse:
        self.calls.append({"method": method, "url": str(url), **kwargs})
        if self._error is not None:
            raise self._error
        resp = self._responder(method, url, kwargs) if self._responder is not None else self._default()
        assert isinstance(resp, _FakeResponse), "responder 必须返回 _FakeResponse"
        self.responses.append(resp)
        return resp

    def _dispatch(self, method: Any = "GET", url: Any = "", **kwargs: Any) -> _FakeResponse:
        return self._next(str(method), url, kwargs)

    def _verb_post(self, url: Any = "", **kwargs: Any) -> _FakeResponse:
        return self._next("POST", url, kwargs)

    def _verb_get(self, url: Any = "", **kwargs: Any) -> _FakeResponse:
        return self._next("GET", url, kwargs)

    def _verb_put(self, url: Any = "", **kwargs: Any) -> _FakeResponse:
        return self._next("PUT", url, kwargs)

    def _verb_patch(self, url: Any = "", **kwargs: Any) -> _FakeResponse:
        return self._next("PATCH", url, kwargs)

    def _send(self, request: Any = None, **kwargs: Any) -> _FakeResponse:
        return self._next(str(getattr(request, "method", "GET")), getattr(request, "url", ""), kwargs)

    def stream(self, method: Any = "GET", url: Any = "", **kwargs: Any) -> _FakeResponse:
        return self._next(str(method), url, kwargs)


async def _execute(
    mod: Any,
    code: str,
    ctx: dict[str, Any],
    client: _FakeHttpClient,
    read_tasks: Any,
) -> Any:
    """集中调用点。[待对齐] 契约签名:
        execute_task_code(task_code, ctx, http_client, read_tasks) -> DirectApiResult
    wait_for 兜底:实现若无限重试 / 不收敛,让用例明确失败而不是把 CI 挂死。
    """
    try:
        coro = mod.execute_task_code(code, ctx, client, read_tasks)
        return await asyncio.wait_for(coro, timeout=_CALL_TIMEOUT)
    except TimeoutError as exc:
        # Python 3.12 起 asyncio.TimeoutError 与内置 TimeoutError 同别名,
        # 故 wait_for 超时与「模块把 TimeoutError 抛到调度器」在此一并判红。
        pytest.fail(f"execute_task_code 未结构化收敛(抛出 TimeoutError / 10s 内未返回): {exc}")


def _field(result: Any, name: str, default: Any = None) -> Any:
    """结果既可能是 dataclass/NamedTuple/Pydantic 对象,也可能是 dict。"""
    if isinstance(result, dict):
        return result.get(name, default)
    return getattr(result, name, default)


def _first_field(result: Any, names: tuple[str, ...], default: Any = None) -> Any:
    for name in names:
        value = _field(result, name, _MISSING)
        if value is not _MISSING:
            return value
    return default


def _is_true(result: Any) -> bool:
    value = _first_field(result, _OK_NAMES, _MISSING)
    return value is not _MISSING and value is not None and bool(value) is True


def _is_false(result: Any) -> bool:
    value = _first_field(result, _OK_NAMES, _MISSING)
    return value is not _MISSING and value is not None and bool(value) is False


def _as_text(obj: Any) -> str:
    if isinstance(obj, dict):
        return json.dumps(obj, ensure_ascii=False, default=str)
    return repr(obj)


def _flatten(result: Any) -> str:
    """把结果的各种序列化面拼在一起,供『凭据不泄漏』『heartbeat 不当内容』断言。"""
    parts = [repr(result), str(result), _as_text(result)]
    if hasattr(result, "__dict__"):
        parts.append(repr(vars(result)))
    if hasattr(result, "_asdict"):  # NamedTuple
        parts.append(repr(result._asdict()))
    return "\n".join(parts)


def _assert_no_secret(*texts: str) -> None:
    """结果/日志/异常文本一律不得含原始 token 或任何 ≥8 字符原文前缀。

    实现若要回显凭据指纹,只允许 len(token) 或 sha256(token)[:8] 这类脱敏形态;
    二者都不会命中下面的断言。
    """
    blob = "\n".join(texts)
    assert FAKE_TOKEN not in blob, "结果/日志/异常泄漏了原始 access_token"
    for n in range(8, len(FAKE_TOKEN) + 1):
        assert FAKE_TOKEN[:n] not in blob, f"结果/日志泄漏了 token 的 {n} 字符前缀"


def _retry_ceiling(code: str) -> int:
    """优先采用实现导出的重试上限,按动作步数放大;否则退回宽松上界。"""
    table = getattr(wda, "ACTION_TABLE", {})
    steps = len(table.get(code, []) or [1]) if isinstance(table, dict) else 1
    for name in ("MAX_RETRIES", "MAX_ATTEMPTS", "RETRY_LIMIT"):
        value = getattr(wda, name, None)
        if isinstance(value, int) and value > 0:
            return max(_RETRY_CEILING, steps * (value + 1) + 4)
    return _RETRY_CEILING


def _make_action_step(mod: Any) -> Any:
    """构造带占位符的 ActionStep。[待对齐] 字段/构造签名以实际类为准。"""
    cls = mod.ActionStep
    kwargs: dict[str, Any] = {
        "method": "POST",
        "url_template": "https://{host}/v2/activity/growth/tasks/{task_code}/claim",
        "headers_extra": {
            "X-Request-Id": "{request_id}",
            "X-Uid": "{uid}",
            "X-Direct-Api-Test": "{domain}",
        },
        "body_template": {
            "task_code": "{task_code}",
            "uid": "{uid}",
            "request_id": "{request_id}",
            "idempotency_key": "{task_code}:{request_id}",
        },
        "expect": {"code": 0},
    }
    try:
        return cls(**kwargs)
    except TypeError:
        try:
            return cls(
                kwargs["method"],
                kwargs["url_template"],
                kwargs["headers_extra"],
                kwargs["body_template"],
                kwargs["expect"],
            )
        except TypeError as exc:
            pytest.skip(f"ActionStep 构造签名与契约不符,待主会话对齐: {exc}")


# ---------------------------------------------------------------------------
# 用例 1 / 2:受理回执不算完成 / 真前进才算完成(最高优先级防伪造判据)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_accepted_receipt_without_progress_advance_is_not_completion() -> None:
    """HTTP 全 200 + SSE 受理,但 read_tasks 回读 progress.current 始终等于基线
    ⇒ ok=False、reason 含 no_progress_advance。受理回执绝不能冒充计分。
    """
    code = _registered_code()
    ctx = _ctx(code)
    client = _FakeHttpClient(sse=True)
    baseline = _snapshot(code, 0)
    result = await _execute(wda, code, ctx, client, _make_read_tasks(baseline))

    # 前置防伪造:确实发出了 HTTP 请求且全部 200,否则本用例是空跑。
    assert client.responses, "必须真的发出 HTTP 请求,否则『受理回执不算完成』是空跑"
    assert all(resp.status_code == 200 for resp in client.responses)
    assert _is_false(result), "回执受理但进度未前进 ⇒ 必须判未完成(不得 ok=True)"
    reason = str(_first_field(result, _REASON_NAMES, "") or "")
    assert reason, "结构化失败必须给出非空 reason"
    assert "no_progress_advance" in reason, "reason 需含 no_progress_advance(判据单源)"


@pytest.mark.asyncio
@pytest.mark.parametrize("advance_kind", ["progress", "claimed"])
async def test_real_progress_advance_is_completion(advance_kind: str) -> None:
    """read_tasks 第二次回读确已前进 ⇒ ok=True。两种真凭据:progress 0→1 /
    accept_status 变 claimed。"""
    code = _registered_code()
    ctx = _ctx(code)
    client = _FakeHttpClient(sse=True)
    before = _snapshot(code, 0)
    after = (
        _snapshot(code, 1)
        if advance_kind == "progress"
        else _snapshot(code, 0, accept_status="claimed")
    )
    result = await _execute(wda, code, ctx, client, _make_read_tasks(before, after))

    assert client.responses, "必须真的发出 HTTP 请求(防空跑)"
    assert _is_true(result), f"进度/状态真前进({advance_kind}) ⇒ 必须判完成"
    assert "no_progress_advance" not in str(_first_field(result, _REASON_NAMES, "") or "")


# ---------------------------------------------------------------------------
# 用例 3:未登记任务码
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unregistered_task_code_fails_closed_with_zero_egress() -> None:
    """ACTION_TABLE 里没有的 code ⇒ 结构化失败/回落、不抛异常、不发任何 HTTP 请求。"""
    table = getattr(wda, "ACTION_TABLE", {})
    assert _UNREGISTERED_CODE not in table, "夹具选到的未登记码恰好被登记了,需换一个"
    ctx = _ctx(_UNREGISTERED_CODE)
    client = _FakeHttpClient()
    # 不抛异常本身即断言:若 execute_task_code 抛出,pytest 直接判红。
    result = await _execute(
        wda, _UNREGISTERED_CODE, ctx, client, _make_read_tasks(_snapshot(_UNREGISTERED_CODE, 0))
    )
    assert client.calls == [], "未登记任务码不得发任何 HTTP 请求(零出站)"
    assert _is_false(result), "未登记任务码必须结构化失败,不得判完成"
    assert str(_first_field(result, _REASON_NAMES, "") or ""), "需给出非空 reason"


# ---------------------------------------------------------------------------
# 用例 4:HTTP 失败与超时收敛
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_http_timeout_converges_to_structured_failure() -> None:
    """http_client 抛 TimeoutError ⇒ 结果结构化、不抛到调度器。"""
    code = _registered_code()
    ctx = _ctx(code)
    client = _FakeHttpClient(error=TimeoutError("simulated upstream timeout"))
    result = await _execute(wda, code, ctx, client, _make_read_tasks(_snapshot(code, 0)))

    assert _is_false(result), "超时必须收敛为结构化失败(ok=False)"
    assert str(_first_field(result, _REASON_NAMES, "") or ""), "超时需给出非空 reason"
    assert "Traceback" not in _flatten(result), "不得把裸栈回显进结果"


@pytest.mark.asyncio
async def test_http_500_converges_to_structured_failure() -> None:
    """http_client 恒返回 500 ⇒ 结果结构化、不抛到调度器。"""
    code = _registered_code()
    ctx = _ctx(code)

    def always_500(method: str, url: Any, kwargs: dict[str, Any]) -> _FakeResponse:
        return _FakeResponse(500, json_body={"code": 500, "msg": "server error"})

    client = _FakeHttpClient(responder=always_500)
    result = await _execute(wda, code, ctx, client, _make_read_tasks(_snapshot(code, 0)))

    assert client.responses, "必须真的发出 HTTP 请求(防空跑)"
    assert all(resp.status_code == 500 for resp in client.responses)
    assert _is_false(result), "HTTP 500 必须收敛为结构化失败(ok=False)"
    assert str(_first_field(result, _REASON_NAMES, "") or ""), "500 需给出非空 reason"
    # http_status 若被回显,必须是本次真实的 500(不允许拿 200 冒充受理即成功)
    status = _first_field(result, ("http_status", "status_code", "status"), _MISSING)
    assert status is _MISSING or status == 500, f"回显的 HTTP 状态码应为 500,实际={status!r}"


# ---------------------------------------------------------------------------
# 用例 5:凭据不泄漏
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_credential_never_leaks_into_result_logs_or_exceptions(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """ctx.access_token 是明显假 token;repr/str/序列化/日志/异常路径都不含原文,
    也不含任何 ≥8 字符原文前缀(只允许 len 或 sha256[:8] 形态的指纹)。
    """
    caplog.set_level(logging.DEBUG)
    code = _registered_code()
    ctx = _ctx(code)
    assert ctx["access_token"] == FAKE_TOKEN, "夹具必须真的把假 token 放进 ctx"

    client = _FakeHttpClient(sse=True)
    result = await _execute(wda, code, ctx, client, _make_read_tasks(_snapshot(code, 0)))
    # 前置防伪造:凭据确实经过了 http_client,否则『不泄漏』断言是空跑。
    assert client.calls, "必须真的发出带凭据的 HTTP 请求"
    assert any(FAKE_TOKEN in repr(call) for call in client.calls), (
        "凭据未出现在任何 http_client 调用中 —— 需主会话对齐 ctx.access_token 的消费方式"
    )
    _assert_no_secret(_flatten(result), caplog.text)

    # 异常路径同样不泄漏。
    failing = _FakeHttpClient(error=TimeoutError("boom without secret"))
    result2 = await _execute(wda, code, ctx, failing, _make_read_tasks(_snapshot(code, 0)))
    _assert_no_secret(_flatten(result2), caplog.text)


# ---------------------------------------------------------------------------
# 用例 6:SSE 流消费
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sse_stream_is_consumed_to_done_and_heartbeat_is_not_content() -> None:
    """分块 SSE 含 : heartbeat / data / data: [DONE]:执行器必须读到 [DONE],
    且不得把 heartbeat 注释行当正文回显(哨兵不得出现在结果任何序列化面)。
    """
    code = _registered_code()
    ctx = _ctx(code)
    client = _FakeHttpClient(sse=True)
    # 给出 0→1 前进帧,确保实现确实走到发动作 + 读 SSE 的路径(防空跑)。
    result = await _execute(
        wda, code, ctx, client, _make_read_tasks(_snapshot(code, 0), _snapshot(code, 1))
    )

    assert client.responses, "必须真的发出 HTTP 请求(防空跑)"
    assert any(resp.reached_done for resp in client.responses), "执行器必须消费 SSE 流直到 [DONE]"
    assert result is not None, "结果必须是结构化对象"
    assert _HEARTBEAT_SENTINEL not in _flatten(result), ": heartbeat 注释行不得被当作正文回显"


# ---------------------------------------------------------------------------
# 用例 7:step 渲染
# ---------------------------------------------------------------------------


def test_action_step_render_substitutes_placeholders() -> None:
    """ActionStep.render(ctx) 替换 {task_code}/{request_id}/{uid}/{host},
    headers_extra 与 body_template 都生效(用独特键与幂等键值做硬证据)。
    """
    code = _registered_code()
    ctx = _ctx(code)
    step = _make_action_step(wda)

    before = _as_text(step)
    assert "{task_code}" in before and "{host}" in before, "夹具必须真的带占位符(防空跑)"

    rendered = step.render(ctx)
    target = rendered if rendered is not None else step  # 兼容就地渲染返回 None
    after = _as_text(target)

    for placeholder in ("{task_code}", "{request_id}", "{uid}", "{host}"):
        assert placeholder not in after, f"占位符 {placeholder} 未被 render 替换"
    for value in (code, ctx["request_id"], ctx["uid"], ctx["host"]):
        assert value in after, f"渲染结果缺少 ctx 值 {value}"
    assert "X-Direct-Api-Test" in after, "headers_extra 未生效"
    assert "idempotency_key" in after, "body_template 未生效"
    assert f"{code}:{ctx['request_id']}" in after, "body_template 占位符未被替换"


# ---------------------------------------------------------------------------
# 用例 8:重试/幂等上限
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retry_is_bounded_for_permanently_failing_client() -> None:
    """恒失败 client 不得触发无限重试:调用次数 ≤ 上限,_execute 的 wait_for
    兜底保证实现真无限重试时用例明确失败而非挂死。
    """
    code = _registered_code()
    ctx = _ctx(code)

    def always_500(method: str, url: Any, kwargs: dict[str, Any]) -> _FakeResponse:
        return _FakeResponse(500, json_body={"code": 500, "msg": "always fail"})

    client = _FakeHttpClient(responder=always_500)
    result = await _execute(wda, code, ctx, client, _make_read_tasks(_snapshot(code, 0)))

    assert client.calls, "恒失败 client 应至少被调用一次"
    assert len(client.calls) <= _retry_ceiling(code), (
        f"恒失败时调用 {len(client.calls)} 次,超过上限 {_retry_ceiling(code)}(疑似无限重试)"
    )
    assert _is_false(result), "恒失败必须收敛为结构化失败(ok=False)"


# ---------------------------------------------------------------------------
# 用例 9:默认 verified 闸门(与步骤 4 核实事项 1 对齐,加严 fail-closed 判据)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unverified_chain_is_failed_closed_by_default() -> None:
    """默认 allow_unverified=False 口径下,含未 verified step 的已登记链整体零出站。"""
    table = getattr(wda, "ACTION_TABLE", {})
    code = next(
        (
            str(c)
            for c, steps in table.items()
            if c != wda.FALLBACK_KEY
            and any(not getattr(s, "verified", False) for s in steps)
        ),
        "",
    )
    if not code:
        pytest.skip("动作表无含未 verified step 的链,闸门用例空跑")
    ctx = _ctx(code)
    client = _FakeHttpClient(sse=True)
    result = await _execute(wda, code, ctx, client, _make_read_tasks(_snapshot(code, 0)))
    assert client.calls == [], "默认口径下含未 verified step 的链必须零出站(fail-closed)"
    assert _is_false(result), "未 verified 链默认不得判完成"
