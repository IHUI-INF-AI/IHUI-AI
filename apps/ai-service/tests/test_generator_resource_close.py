# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""借来的异步生成器必须"谁借谁关"(aclose)—— 正反成对用例。

覆盖三处已定位站点 + 唯一关停出口 `app/services/async_gen_close.py`:
  ① site1 `app/core/llm_gateway.py` 原生适配器分支(error→fallback 那句 `yield …; return`
     就是把 provider 生成器弃在 `async with client.stream(...)` 半读态的一型)—— 行为级
  ② site2 `app/routers/llm.py` SSE 流(客户端断开 `break` 那一型)—— 该流嵌在整条路由
     上下文里(计量帧 / 落库 / steer 收口),无法脱离真实 req/request 单跑;故按**接线形状**
     三条对账(句柄先置 None ⇒ finally 不会 UnboundLocalError / break 之前就关 / finally
     兜住抛错与 GeneratorExit),另加一条反向对照(旧的内联写法不得回来)。同一形状的**行为**
     由 site1、site3 与出口自身的用例证成。
  ③ site3 `app/services/publish/ai_assistant._astream`(带 `except Exception` 吞错的那一型)
     —— 行为级,并专测"关停自身失败不得吃掉原 warning"

票面三条判据逐一有正反例:
  A 消费一半就被弃 ⇒ 底层生成器 `aclose()` 恰被调用 1 次
  B 正常耗尽 ⇒ 产出序列与改动前逐字一致、aclose 至多 1 次、不因关停路径重复抛错
  C 底层抛错走 fallback ⇒ 前一个生成器被关停 **且** fallback 分支照常产出

测试隔离(AGENTS §5 铁律):全程 fake 异步迭代器;llm_gateway 的 compaction / provider /
fallback 三个上游出口与 ai_assistant 里的 `llm_gateway.astream` 一律 monkeypatch 成替身
⇒ 用例体内不存在"连生产 PostgreSQL(8810)/ Redis(8811)或打网络"的那条路。
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core import llm_gateway as llm_gateway_module
from app.core.llm_gateway import llm_gateway
from app.services import async_gen_close as async_gen_close_module
from app.services.async_gen_close import aclose_async_gen
from app.services.publish import ai_assistant as ai_assistant_module
from app.services.publish.ai_assistant import AiWritingService

# 被审源文件(site2 的接线形状对账要读它)
_ROUTER_LLM_PY = Path(__file__).resolve().parents[1] / "app" / "routers" / "llm.py"


class FakeStream:
    """"借来的异步生成器"替身:记录 aclose 次数与体内 finally 是否跑过。

    刻意做成**代理**而不是直接给 async generator:真实站点手里拿到的就是
    provider 的生成器对象,代理能在不改变 `async for` 语义的前提下把
    `aclose()` 的调用次数与"是否真的走到关停"这两件事量出来。
    """

    def __init__(self, events: list[Any], *, aclose_raises: bool = False) -> None:
        self._events = events
        self._aclose_raises = aclose_raises
        self.aclose_count = 0
        self.body_finalized = False
        self._gen = self._drive()

    async def _drive(self):
        try:
            for evt in self._events:
                if isinstance(evt, BaseException):
                    raise evt
                yield evt
        finally:
            # 模拟 provider 侧 `async with client.stream(...)` 的退出路径
            self.body_finalized = True

    def __aiter__(self):
        return self._gen.__aiter__()

    async def aclose(self) -> None:
        self.aclose_count += 1
        if self._aclose_raises:
            raise RuntimeError("aclose 自身失败(模拟关停路径抖动)")
        await self._gen.aclose()


def _collect_warnings(monkeypatch, module) -> list[str]:
    """把某模块 logger.warning 换成只收序列的替身(caplog 依赖 handler/propagate,
    这里要证的是"那条原 warning 有没有被关停异常顶掉",直接拦调用点更确定)。"""
    seen: list[str] = []

    def _warn(msg: Any, *args: Any, **_kw: Any) -> None:
        seen.append(str(msg) % args if args else str(msg))

    monkeypatch.setattr(module.logger, "warning", _warn)
    return seen


# ----------------------------------------------------------------------------
# 出口自身:幂等 / 永不抛错 / 非生成器报名
# ----------------------------------------------------------------------------


async def test_outlet_closes_started_gen_and_runs_its_finally_once():
    # 真实敞口的形状:生成器已经启动、停在半读态时被弃 —— 这时关它才走体内 finally
    stream = FakeStream(
        [{"type": "chunk", "content": "a"}, {"type": "chunk", "content": "b"}]
    )
    it = stream.__aiter__()
    assert (await it.__anext__())["content"] == "a"
    assert stream.body_finalized is False  # 尚未关停
    assert await aclose_async_gen(stream, label="t") is True
    assert stream.aclose_count == 1
    assert stream.body_finalized is True


async def test_outlet_on_never_started_gen_closes_without_running_body():
    # 配对负向:一次都没启动的生成器,aclose 合法但体内 finally 不会跑(根本没有 body)。
    # 这条不是仓库缺陷,是把"关停"与"body 已终结"两件事分开的判据 —— 别把它们混成一个计数。
    stream = FakeStream([{"type": "chunk", "content": "a"}])
    assert await aclose_async_gen(stream, label="t") is True
    assert stream.aclose_count == 1
    assert stream.body_finalized is False


async def test_outlet_on_finished_gen_is_noop_and_never_raises():
    # 判据 B 的下半:已耗尽的生成器再走一次关停 —— 合法 no-op,不抛错、不"二次回滚"
    stream = FakeStream([{"type": "chunk", "content": "a"}])
    async for _ in stream:
        pass
    assert await aclose_async_gen(stream, label="t") is True  # 不抛
    assert stream.body_finalized is True


async def test_outlet_swallows_close_failure_and_reports_none_or_non_gen():
    boom = FakeStream([], aclose_raises=True)
    assert await aclose_async_gen(boom, label="t") is False  # 吞错并报名,不向上抛
    assert await aclose_async_gen(None, label="t") is False
    assert await aclose_async_gen([1, 2, 3], label="t") is False  # 无可关停对象


# ----------------------------------------------------------------------------
# site3:publish/ai_assistant._astream(真实代码路径)
# ----------------------------------------------------------------------------


def _patch_gateway_astream(monkeypatch, stream: FakeStream) -> None:
    monkeypatch.setattr(llm_gateway, "astream", lambda *a, **k: stream)


async def test_site3_half_consumed_then_closed_closes_underlying_once(monkeypatch):
    stream = FakeStream(
        [{"type": "chunk", "content": "x"}, {"type": "chunk", "content": "y"}]
    )
    _patch_gateway_astream(monkeypatch, stream)
    agen = AiWritingService()._astream("prompt")

    out: list[str] = []
    async for chunk in agen:
        out.append(chunk)
        break
    assert out == ["x"]
    # 负向对照:此刻外层 _astream 自身还悬着,本票新增的 finally 尚未跑 ⇒ 底层未关
    assert stream.aclose_count == 0

    await agen.aclose()  # 消费方按规矩归还生成器(等价于 shutdown_asyncgens 迟早要做的事)
    # 判据 A:本票新增的 finally 在这一刻把借来的生成器关掉,恰 1 次
    assert stream.aclose_count == 1
    assert stream.body_finalized is True


async def test_site3_normal_exhaustion_output_unchanged(monkeypatch):
    stream = FakeStream(
        [
            {"type": "chunk", "content": "x"},
            {"type": "done", "content": "忽略"},
            {"type": "chunk", "content": "y"},
        ]
    )
    _patch_gateway_astream(monkeypatch, stream)
    out = [c async for c in AiWritingService()._astream("prompt")]
    # 判据 B:产出序列与改动前逐字一致(非 chunk 事件照旧被过滤掉)
    assert out == ["x", "y"]
    assert stream.aclose_count <= 1  # 关停路径不重复触发
    assert stream.body_finalized is True


async def test_site3_underlying_error_keeps_original_warning(monkeypatch):
    seen = _collect_warnings(monkeypatch, ai_assistant_module)
    stream = FakeStream([{"type": "chunk", "content": "x"}, RuntimeError("上游断了")])
    _patch_gateway_astream(monkeypatch, stream)
    out = [c async for c in AiWritingService()._astream("prompt")]
    assert out == ["x"]  # 失败静默结束(改动前后同形)
    assert any("astream failed" in m and "上游断了" in m for m in seen)
    assert stream.aclose_count == 1  # finally 仍把借来的生成器关了


async def test_site3_aclose_failure_does_not_mask_original_warning(monkeypatch):
    seen = _collect_warnings(monkeypatch, ai_assistant_module)
    seen_close = _collect_warnings(monkeypatch, async_gen_close_module)
    stream = FakeStream([RuntimeError("原始故障")], aclose_raises=True)
    _patch_gateway_astream(monkeypatch, stream)
    out = [c async for c in AiWritingService()._astream("prompt")]  # 不得抛到调用方
    assert out == []
    # 原 warning 必须仍在(没有被关停异常顶掉),关停失败另记一条
    assert any("astream failed" in m and "原始故障" in m for m in seen)
    assert any("aclose 失败" in m for m in seen_close)


# ----------------------------------------------------------------------------
# site1:llm_gateway 原生适配器分支(真实代码路径)
# ----------------------------------------------------------------------------


class _FakeProvider:
    def __init__(self, stream: FakeStream) -> None:
        self._stream = stream

    def astream(self, messages, model, tools=None, **kwargs):  # noqa: ARG002
        return self._stream


def _wire_native_branch(monkeypatch, stream: FakeStream):
    """把 astream 走到"原生适配器分支"所需的三个上游出口全换成替身。"""
    provider = _FakeProvider(stream)

    async def fake_compaction(msgs, model, *, has_tools=False):  # noqa: ARG001
        return msgs, None

    async def fake_get_provider(model, owner_uuid=None):  # noqa: ARG001 - 真站点是 await 它
        return provider

    async def fake_fallback(msgs, model, reason):  # noqa: ARG001
        yield {"type": "chunk", "content": "FB"}
        yield {"type": "done", "model": model, "usage": {}, "stub": True}

    monkeypatch.setattr(llm_gateway, "_apply_token_compaction", fake_compaction)
    monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
    monkeypatch.setattr(llm_gateway, "_get_provider", fake_get_provider)
    monkeypatch.setattr(llm_gateway, "_astream_fallback_events", fake_fallback)
    monkeypatch.setattr(
        llm_gateway_module, "_model_to_provider_code", lambda model: "fake", raising=True
    )
    return provider


def _native_agen():
    return llm_gateway.astream(
        [{"role": "user", "content": "hi"}],
        model="fake/model",
        tools=[{"type": "function", "function": {"name": "x"}}],
    )


async def test_site1_error_then_fallback_closes_previous_gen_once(monkeypatch):
    # 判据 C:底层抛错走 fallback ⇒ 前一个生成器被关停,且 fallback 分支照常产出
    stream = FakeStream([{"type": "error", "message": "上游 5xx"}])
    _wire_native_branch(monkeypatch, stream)
    out = [evt async for evt in _native_agen()]
    assert [e.get("type") for e in out] == ["chunk", "done"]
    assert out[0]["content"] == "FB"
    assert stream.aclose_count == 1
    assert stream.body_finalized is True


async def test_site1_half_consumed_then_closed_closes_underlying_once(monkeypatch):
    stream = FakeStream(
        [{"type": "chunk", "content": "a"}, {"type": "chunk", "content": "b"}]
    )
    _wire_native_branch(monkeypatch, stream)
    agen = _native_agen()
    out: list[dict[str, Any]] = []
    async for evt in agen:
        out.append(evt)
        break
    assert out == [{"type": "chunk", "content": "a"}]
    assert stream.aclose_count == 0  # 负向对照:外层尚未归还时不指望关到底层
    await agen.aclose()
    assert stream.aclose_count == 1  # 判据 A:finally 在 GeneratorExit 作用域里照常跑
    assert stream.body_finalized is True


async def test_site1_normal_exhaustion_output_unchanged(monkeypatch):
    # 判据 B:同输入下产出序列与改动前逐字一致(两条 chunk,无多余事件、无异常)
    stream = FakeStream(
        [{"type": "chunk", "content": "a"}, {"type": "chunk", "content": "b"}]
    )
    _wire_native_branch(monkeypatch, stream)
    out = [evt async for evt in _native_agen()]
    assert out == [{"type": "chunk", "content": "a"}, {"type": "chunk", "content": "b"}]
    assert stream.aclose_count <= 1
    assert stream.body_finalized is True


# ----------------------------------------------------------------------------
# site2:routers/llm.py 的接线形状对账(见模块 docstring ②)
# ----------------------------------------------------------------------------


def test_site2_disconnect_path_closes_before_break_and_finally_backstops():
    src = _ROUTER_LLM_PY.read_text(encoding="utf-8")

    # ① 句柄在 try 之前就置 None ⇒ finally 不会 UnboundLocalError(llm_gateway 记过同型)
    assert "_native_fc_stream: AsyncIterator[dict[str, Any]] | None = None" in src

    # ② break 之前就关:控制流必须出现在该 if 分支内、break 之前
    loop_at = src.index("async for event in _native_fc_stream:")
    tail = src[loop_at:]
    brk_at = tail.index("\n                    break\n")
    segment = tail[:brk_at]
    assert "await aclose_async_gen(" in segment, "客户端断开路径未在 break 之前关停生成器"

    # ③ 兜底:本流所在 try 的 finally 里也有一次关停(抛错 / GeneratorExit 两条被弃路径),
    #    且**不得是裸 await** —— 这段 finally 会在"任务被取消"的作用域里执行,它后面还挂着
    #    MCP 取消闭环 / 委托 session / 表单待决 / 引导队列四项清理;裸 await 一旦在取消点抛出
    #    CancelledError,那四项就整批被跳过(与本文件既有的"取消仅 fire 不 await"同一条理由)。
    #    判的是这条不变量,不锁具体书写形状:换写法(例如挪到 finally 末尾)仍应通过。
    fin_at = src.index("        finally:\n            # 借来的异步生成器兜底关停")
    seg = src[fin_at : fin_at + 1600]
    assert "aclose_async_gen(" in seg, "finally 里已没有兜底关停 ⇒ 抛错/GeneratorExit 路径回到等 GC"
    assert (
        "\n            await aclose_async_gen(\n                _native_fc_stream" not in seg
    ), "兜底关停退回**裸 await** ⇒ 取消作用域内会跳过其后四项清理(见上方注释)"
    assert "asyncio.shield(" in seg, "兜底关停必须被 shield 接管(或被挪到 finally 末尾)"


def test_site2_inline_borrow_form_is_gone():
    """反向对照:旧的内联写法(生成器只活在 async for 表达式里、没有句柄可归还)不得回来。"""
    src = _ROUTER_LLM_PY.read_text(encoding="utf-8")
    assert (
        "async for event in llm_gateway.astream(\n"
        "                messages, model=req.model, owner_uuid=owner_uuid, **_native_fc_kwargs\n"
        "            ):"
    ) not in src


def test_shielded_close_in_finally_still_runs_later_cleanups():
    """行为级证成 site2 采用的形状(不是文本锁)。

    被审形态:`finally` 里先关停借来的生成器、其后还挂着若干项清理,而整段是在
    **任务被取消**的作用域内执行的。裸 await 会在取消点点燃 CancelledError ⇒ 后面的清理
    整批被跳过;shield + 只吞"本行的等待"⇒ 清理照跑、取消仍向外传播。
    两种写法各跑一次:被 shield 那一版必须做完清理,裸 await 那一版必须**做不到**
    (反向对照 —— 防止有人把 shield 当装饰删掉,也防止测试环境变化让这条无声失效)。
    """
    import asyncio

    async def _slow_closer(state: dict[str, bool]) -> None:
        try:
            await asyncio.sleep(0.05)
        except asyncio.CancelledError:
            state["close_cancelled"] = True
            raise
        state["closed"] = True

    async def _stream(*, shielded: bool, state: dict[str, bool]):
        try:
            await asyncio.Event().wait()  # 一直等,由外部取消
            yield None
        finally:
            if shielded:
                # 与 site2 同形:shield 让关停任务脱离本次取消,except 只吞"这一行的等待"
                try:
                    await asyncio.shield(_slow_closer(state))
                except BaseException:
                    state["close_wait_swallowed"] = True
            else:
                # 裸 await:什么都不吞 —— 这正是被建模的危险写法(取消从 finally 里再点燃)
                await _slow_closer(state)
            # 站点里对应"MCP 取消闭环 / 委托 session / 表单待决 / 引导队列"四项清理
            state["cleanups_ran"] = True

    async def _consume(*, shielded: bool, state: dict[str, bool]) -> None:
        agen = _stream(shielded=shielded, state=state)
        async for _ in agen:  # 体内一直等,由外部取消 ⇒ finally 在取消作用域内执行
            pass

    async def _run(*, shielded: bool) -> dict[str, bool]:
        """模型 anyio 的**持续投递**语义(而不是裸 asyncio 的"只投一次")。

        站点跑在 uvicorn + anyio 上:取消作用域内**每一处** await 都会再点燃 CancelledError,
        所以 finally 中途的 await 可能把其后的清理整批打断。用循环反复 `task.cancel()` 复刻
        这一点 —— 也正是本用例与 site2 那个 shield+吞本行等待 的形状要解决的问题。
        """
        state: dict[str, bool] = {}
        task = asyncio.ensure_future(_consume(shielded=shielded, state=state))
        await asyncio.sleep(0.01)
        stop = False

        async def _deliver() -> None:
            while not stop:
                task.cancel()
                await asyncio.sleep(0)

        delivery = asyncio.ensure_future(_deliver())
        try:
            await task
        except asyncio.CancelledError:
            pass
        await asyncio.sleep(0.1)  # 让被 shield 保护的关停任务跑完
        stop = True
        await delivery
        return state

    shielded = asyncio.run(_run(shielded=True))
    assert shielded.get("cleanups_ran") is True, "shield 版里其后的清理被跳过 ⇒ 形状不成立"
    assert shielded.get("closed") is True, "shield 版里关停本身没跑完 ⇒ 兜底失效"

    bare = asyncio.run(_run(shielded=False))
    assert bare.get("cleanups_ran") is not True, (
        "裸 await 版**竟然**做完了清理 ⇒ 本用例的反向对照失效(取消没有在取消点点燃,"
        "是测试环境变了,不构成「可以把 shield 删掉」的依据)"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
