# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""按 key 串行结算(G-814422)的**否证 + 判据形状** —— 不是"已落机制"的合格证。

上游证据(zcode `botsService.ts:2025-2049`,注释在 `:2040`):入站消息按 actor 键链式
串行,理由是"用户连点同一个按钮 ⇒ 两次 respondElicitation" —— 两次应答都读到同一份
pending 态,于是双结算。本票问的是**同一型在我方今天是否真能并发撞车**。

现读结论:**不可达**。理由不是"压测没撞出来",而是结构性的三条(每条都由下面 A 组
的尺子现读,不靠注释自证):

  · `app/services/agent_engine.py` 的 `_handle_elicitation_respond`(7146-7186)与
    `_handle_approval_respond`(7292-7393)**整个函数体零让出点**(AST 实测
    await=0 / async_with=0 / async_for=0)。病灶的具体窗口 ——
    `7178 取记录 → 7183 future.done() 判 → 7185 set_result` 与
    `7375 取记录 → 7378 future.done() 判 → 7381 set_result` ——
    判定与置位之间没有 `await`、没有 I/O、没有可调用的回调;
  · 承载层的四个 `handle_message` 入口(`routers/engine.py:235/368/392/435`)与语音
    入口(`routers/engine_voice.py:181`)都在**同一个事件循环**上被 `await` /
    `asyncio.ensure_future` 承接;两个通道文件里 `run_coroutine_threadsafe` /
    `threading.Thread` 零命中。**如实登记一处不是零的东西**:`engine_voice.py:120/126`
    确有两次 `asyncio.to_thread`(Whisper 模型加载与转写),但它们**没有包住结算**
    —— 结算那一行(`:181`)仍是 `await ENGINE.handle_message(...)`。所以 A4 判的是
    "结算有没有被搬到别的线程",不是"文件里有没有 to_thread"(后者会假阳,
    而假阳指使人去修没坏的东西,还会把口径说歪成"数字很多");
  · HTTP 侧唯一的审批结算点(`routers/agents.py:1074`)直接调用**同步**的
    `resolve_approval_for_requester`,而它自 G-637(2026-09-29)起整段
    "取条目 → 判属主 → 取结算名额 → 写决策" 都在 `threading.RLock`
    (`agent_loop_v2.py:450`)的同一临界区内;名额由
    `_ApprovalEntry.claim_settlement()` 一次性取走,持久授权键由
    `grant_tool_approval_persist()` 以 `pop` 单点取走。

因此本文件**不新增按 key 的串行队列**:按 AGENTS「加守卫前先证明坏状态可达」的既有
纪律,在没有让出点的临界区前再套一层锁,只会得到第二份真相(与本仓反复登记的
"两处算同一件事必漂移"同型)。交付的是**这把尺子**,三组成对:

  A 组(结构前提)  临界区零让出点、被调链是同步函数、没有跨线程入口;
  B 组(行为否证)  真并发两次同 key 结算 ⇒ 只生效一次(断的是**副作用**:future 只
                   done 一次且值是赢家那份、event 只 set 一次、持久授权只落一行),
                   并配正向对照"不同 key 并发 ⇒ 两个都生效"与"非属主并发 ⇒ 零副作用
                   且不消耗属主名额";
  C 组(判据有牙)  ① 裸双 `set_result` 必抛 InvalidStateError ⇒ B 组的"零错误响应"
                   不是空断言;② 给同一 check-and-set 插入一个 `await` 的变异体确实
                   双结算 ⇒ 前提一破坏状态立刻可达;③ 结构尺子喂给含 `await` 的
                   合成源码必须报出让出点 ⇒ A 组不是恒真式。

**要判红必须先满足的条件**(任一条成立,才谈得上落按 key 的串行出口):
  1. 上述两个 handler 的判定与置位之间出现任何 `await` / `asyncio.sleep` /
     `to_thread` / 外部回调(A1/A2 会先在提交链上红,不是等运行时);
  2. 结算被搬到真实线程或第二个进程(多 worker 部署、自建 loop 的收包线程)——
     此时 elicitation 一侧**没有**审批那一侧的 RLock,只有 loop 原子性可依赖;
  3. 待决记录改成"结算时重建/换对象"(名额不再罩住同一实例),使一次性名额失效。

测试隔离(AGENTS §5 铁律):`app.core.db_pool.get_shared_pool` 换成"一被调用即
AssertionError"的替身(不是 mock 掉就好,而是**用了就直接红**);不接 Redis;
`AGENT_ENGINE_PERSIST=off`;`approval_persistence.grant` 换成只计数的 spy ⇒
对持久层零写入。引擎一律用**私有实例**,不碰进程级 ENGINE。
"""

from __future__ import annotations

import ast
import asyncio
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

APP_DIR = Path(__file__).resolve().parent.parent / "app"

# 被审的两个结算 handler(名字漂了本文件必须跟着点名,不能静默枚举为空)
ENGINE_HANDLERS = ("_handle_elicitation_respond", "_handle_approval_respond")
V2_CALLEES = (
    "resolve_approval_for_requester",
    "resolve_approval_response",
    "grant_tool_approval_persist",
    "claim_settlement",
)
CHANNEL_SOURCES = ("routers/engine.py", "routers/engine_voice.py")
# 这些形态一旦出现就是"第二个执行体在跑引擎代码",与 loop 原子性互斥(条件 2)
HARD_THREAD_ENTRIES = ("run_coroutine_threadsafe", "threading.Thread")
# 这三个 API 本身合法(STT 就用它 load 模型),判据问的是**它包住了什么**
OFFLOAD_CALLS = ("to_thread", "run_in_executor", "run_coroutine_threadsafe")
# 结算的标识:被搬 off-loop 的实参里出现任何一条 ⇒ 条件 2 成立
SETTLEMENT_MARKERS = ("handle_message", *ENGINE_HANDLERS, *V2_CALLEES)

_YIELD_KINDS = (ast.Await, ast.AsyncFor, ast.AsyncWith)


# ---------------------------------------------------------------------------
# 隔离夹具
# ---------------------------------------------------------------------------


class _ProductionDbTouched(AssertionError):
    """生产库被触碰的唯一出口:宁可红,不可静默连上去。"""


@pytest.fixture(autouse=True)
def _no_production_io(monkeypatch: pytest.MonkeyPatch) -> None:
    """§5 测试隔离铁律:共享连接池一旦被调用即判失败;会话持久化整体关死。"""
    import app.core.db_pool as db_pool

    async def _boom() -> None:
        raise _ProductionDbTouched(
            "G-814422 用例不得对生产 PostgreSQL(8810)/ Redis(8811) 产生任何读写"
        )

    monkeypatch.setattr(db_pool, "get_shared_pool", _boom)
    monkeypatch.setenv("AGENT_ENGINE_PERSIST", "off")


@pytest.fixture
def approval_face(monkeypatch: pytest.MonkeyPatch) -> Any:
    """审批待决表 + 持久授权通道的隔离面(原地 clear,不替换 dict 引用)。

    必须原地 clear:`_request_approval` 与 `grant_tool_approval_persist` 都按模块级
    全局 dict 取用(与 tests/test_permission_settle_race_g637.py 同一教训)。
    `grant` 换成 spy ⇒ 本文件对持久层**零写入**,spy 列表就是"授权落了几行"。
    """
    from app.services import agent_loop_v2 as v2
    from app.services import approval_persistence as ap

    v2._approval_registry.clear()
    v2._approval_persist_keys.clear()

    grant_spy: list[tuple[str, str, str]] = []

    def _spy_grant(scope: str, key: str, kind: str = "mcp_tool") -> None:
        grant_spy.append((scope, key, kind))

    monkeypatch.setattr(ap, "grant", _spy_grant)
    yield SimpleNamespace(v2=v2, grant_spy=grant_spy)
    v2._approval_registry.clear()
    v2._approval_persist_keys.clear()


# ---------------------------------------------------------------------------
# 结构尺子(A 组)—— 读的是源码原文,不是运行时行为
# ---------------------------------------------------------------------------


def _parse(rel_path: str) -> ast.Module:
    return ast.parse((APP_DIR / rel_path).read_text(encoding="utf-8"))


def _function(tree: ast.AST, name: str) -> ast.FunctionDef | ast.AsyncFunctionDef:
    """按名字取函数节点;取不到就判死(尺子不得对"没看见"发合格证)。"""
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(
        f"源码里找不到函数 {name} —— 结算形状漂了,本尺子对该型失明,不是通过"
    )


def _yield_points(fn: ast.AST) -> list[ast.AST]:
    """函数体内所有**让出点**(await / async for / async with)。"""
    return [n for n in ast.walk(fn) if isinstance(n, _YIELD_KINDS)]


def _call_attr_line(tree: ast.AST, attr: str) -> int:
    """取 `x.<attr>()` 这一调用的行号(用于把"判定行/置位行"钉成可判据的两点)。"""
    lines = [
        n.lineno
        for n in ast.walk(tree)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == attr
    ]
    assert lines, f"找不到 .{attr}() 调用点 —— 判据前提不在位"
    return min(lines) if attr == "done" else max(lines)


def _callee_name(func: ast.expr) -> str:
    """取调用名的**末段**(`asyncio.to_thread` → `to_thread`),用于形状匹配。"""
    if isinstance(func, ast.Attribute):
        return func.attr
    if isinstance(func, ast.Name):
        return func.id
    return ""


def _code_face(src: str) -> str:
    """代码面:剥掉字符串字面量与 `#` 注释(**等长遮蔽**,行号不变)。

    为什么必须遮:`run_coroutine_threadsafe` 这类字样在**门自己的说明**里就出现
    (守门 70/131 记过同型 —— 判据把自己解释自己的散文读成违规,或反过来把注释里的
    字样当成事实)。等长遮蔽而不是删除,是为了让 `enumerate` 出来的行号仍对得上源码。
    """
    tree = ast.parse(src)
    masked: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            for ln in range(node.lineno, (node.end_lineno or node.lineno) + 1):
                masked.add(ln)
    out: list[str] = []
    for i, line in enumerate(src.splitlines(), start=1):
        text = line if i not in masked else re.sub(r"[^\s]", "", line)
        out.append(re.sub(r"#.*$", "", text))
    return "\n".join(out)


def test_a1_settlement_handlers_have_no_yield_point_in_their_bodies() -> None:
    """A1:两个结算 handler 的**整个函数体**零让出点 ⇒ 判定与置位原子。

    这是"今天不需要按 key 队列"的全部依据,所以它必须是尺子而不是注释。
    """
    tree = _parse("services/agent_engine.py")
    for name in ENGINE_HANDLERS:
        fn = _function(tree, name)
        assert isinstance(fn, ast.AsyncFunctionDef), f"{name} 已不是协程,判据前提变了"
        points = _yield_points(fn)
        assert not points, (
            f"{name}(定义于 {fn.lineno} 行)体内出现让出点 {[p.lineno for p in points]} —— "
            "两次并发应答现在可以交错,本票否证作废,必须落按 key 的串行出口"
            "(见模块 docstring 条件 1)"
        )


def test_a2_done_check_and_set_result_window_is_yield_free() -> None:
    """A2:点名"判定行 → 置位行"这一窗口本身(比 A1 更窄、更可问责的一把)。

    A1 罩整段函数,本条把窗口宽度本身钉成判据:行号必须相邻(容 4 行),
    且窗口内不得出现任何让出点 —— 否则"读 pending → 写 pending"就分了两步。
    """
    tree = _parse("services/agent_engine.py")
    measured: list[tuple[str, int, int]] = []
    for name in ENGINE_HANDLERS:
        fn = _function(tree, name)
        done_line = _call_attr_line(fn, "done")
        set_line = _call_attr_line(fn, "set_result")
        assert set_line > done_line, f"{name}: 置位行 {set_line} 不在判定行 {done_line} 之后"
        assert set_line - done_line <= 4, (
            f"{name}: 判定({done_line})与置位({set_line})隔了 "
            f"{set_line - done_line} 行,窗口变宽 ⇒ 复核中间被插进了什么"
        )
        in_window = [p.lineno for p in _yield_points(fn) if done_line <= p.lineno <= set_line]
        assert not in_window, f"{name}: 窗口 {done_line}-{set_line} 内有让出点 {in_window}"
        measured.append((name, done_line, set_line))
    assert len(measured) == 2, "两条结算窗口都必须被量到,少一条就是覆盖面缺口"


def test_a3_everything_called_inside_the_window_is_synchronous() -> None:
    """A3:审批那一侧的被调链必须是**同步**定义且自身零让出点。

    协程体没有 await 并不等于整条链原子:同步函数里再调协程(经 loop.run 之类)
    也能造出让出点。这里把咽喉点 + 名额 + 持久取走 + 布尔出口四件套逐个量。
    """
    tree = _parse("services/agent_loop_v2.py")
    for name in V2_CALLEES:
        fn = _function(tree, name)
        assert isinstance(fn, ast.FunctionDef), f"{name} 变成了协程 ⇒ 原子性前提失效"
        points = _yield_points(fn)
        assert not points, f"{name} 体内出现让出点 {[p.lineno for p in points]}"


def test_a4_settlement_is_never_scheduled_off_the_loop() -> None:
    """A4:结算永远在同一个 loop 上跑;把它搬到别的线程 ⇒ 本否证当场作废。

    三半,每一半都只问**结算**而不问"文件里有没有线程 API":
      ① 代码面不许出现 `run_coroutine_threadsafe` / `threading.Thread`
         (这两个一出现就是第二个执行体在跑引擎代码,与 loop 原子性互斥);
      ② `to_thread` / `run_in_executor` / `run_coroutine_threadsafe` 的**实参**里
         不得出现结算标识(`handle_message` / 两个 handler / 审批四件套)。
         `asyncio.to_thread` 本身合法 —— `engine_voice.py:120/126` 就用它 load
         Whisper 模型;判"有没有"会假阳,判"包住了什么"才问到了那件事;
      ③ 每一处 `ENGINE.handle_message` 调用行都必须被 `await` 或
         `asyncio.ensure_future` 承接,枚举到 0 处调用点判死(不记通过)。
    """
    for rel in CHANNEL_SOURCES:
        src = (APP_DIR / rel).read_text(encoding="utf-8")
        code = _code_face(src)
        for forbidden in HARD_THREAD_ENTRIES:
            assert forbidden not in code, (
                f"{rel} 出现 {forbidden} ⇒ 条件 2 成立,本票否证作废,需重新裁决"
            )

        tree = ast.parse(src)
        wrapped: list[tuple[int, str]] = []
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            fname = _callee_name(node.func)
            if fname not in OFFLOAD_CALLS:
                continue
            args_parts: list[str] = [ast.get_source_segment(src, a) or "" for a in node.args]
            args_parts += [ast.get_source_segment(src, kw.value) or "" for kw in node.keywords]
            args_text = " ".join(args_parts)
            if any(marker in args_text for marker in SETTLEMENT_MARKERS):
                wrapped.append((node.lineno, fname))
        assert not wrapped, (
            f"{rel}: 第 {[w[0] for w in wrapped]} 行把**结算**搬进了线程池 "
            f"{wrapped} ⇒ 单 loop 原子性不再成立,条件 2 达成"
        )

        calls = [
            (i, line)
            for i, line in enumerate(code.splitlines(), start=1)
            if "ENGINE.handle_message" in line
        ]
        assert calls, f"{rel} 找不到 ENGINE.handle_message 调用点 —— 枚举为 0,不记通过"
        unbound = [
            i
            for i, line in calls
            if "await" not in line and "ensure_future" not in line
        ]
        assert not unbound, (
            f"{rel}: 第 {unbound} 行的 handle_message 未被 await/ensure_future 承接"
            " ⇒ 它不在同一个 loop 上跑,条件 2 成立"
        )


def test_a5_scanned_sources_are_the_checked_out_app() -> None:
    """形状锁:A 组读的是**本仓 app/** 源码;取不到即判死,不对空气打分。"""
    assert APP_DIR.is_dir(), f"取不到被审源码目录: {APP_DIR}"
    for rel in ("services/agent_engine.py", "services/agent_loop_v2.py", *CHANNEL_SOURCES):
        assert (APP_DIR / rel).is_file(), f"被审文件不在位: {rel}"


# ---------------------------------------------------------------------------
# 私有引擎与待决记录
# ---------------------------------------------------------------------------


def _make_engine() -> Any:
    """私有 AgentEngine(loop_factory 永不触发:本文件只走结算侧)。"""
    from app.services.agent_engine import AgentEngine

    async def _factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
        raise AssertionError("结算用例不得驱动主循环(会走到真实执行内核)")

    return AgentEngine(loop_factory=_factory)


class _RecordingEvent:
    """duck-typed asyncio.Event:只记 set 次数(不依赖等待方)。"""

    def __init__(self) -> None:
        self.set_calls = 0

    def set(self) -> None:
        self.set_calls += 1

    def is_set(self) -> bool:
        return self.set_calls > 0

    async def wait(self) -> bool:  # pragma: no cover - 手工登记的形态没有等待方
        return True


def _rpc(method: str, params: dict[str, Any], rid: int) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": rid, "method": method, "params": params}


def _elicitation(engine: Any, request_id: str, owner: str | None) -> asyncio.Future[Any]:
    from app.services.agent_engine import _PendingElicitationRequest

    future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    engine._elicitation_requests[request_id] = _PendingElicitationRequest(
        thread_id=f"t-{request_id}", user_id=owner, future=future
    )
    return future


async def _admit_all(engine: Any, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """把 N 条报文**同时**放进 loop(每条先 `sleep(0)` 让全部排队,再一起进 handler)。

    这才是"用户连点同一个按钮"的形状:承载层已接纳 N 次请求,区别只在结算侧能不能
    交错。只在 handler 内部串行是假并发,量不到窗口。
    """

    async def _one(msg: dict[str, Any]) -> dict[str, Any]:
        await asyncio.sleep(0)
        resp = await engine.handle_message(msg)
        assert resp is not None, "带 id 的请求必须有回执"
        return resp

    return list(await asyncio.gather(*(_one(m) for m in messages)))


def _results(responses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r["result"] for r in responses if "result" in r]


def _errors(responses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r["error"] for r in responses if "error" in r]


# ---------------------------------------------------------------------------
# B 组:行为否证 —— 并发两次同 key 结算只生效一次(断副作用,不只断码)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_b1_concurrent_elicitation_respond_settles_exactly_once() -> None:
    """B1:八次并发应答同一条 elicitation ⇒ 恰好一个 applied=True,零内部异常。

    三条副作用断言(只断状态码会放过"先改了再抛"):
      ① future 只被结算一次 —— 第二次 `set_result` 抛 InvalidStateError,而
         `handle_message` 把它折成 INTERNAL_ERROR,所以"零错误响应"就是这条的量;
      ② 其余七次拿到显式 `already_settled`,不得静默也算赢;
      ③ future 确实 done,且值属于这八次之一(没被凭空改写)。
    """
    engine = _make_engine()
    future = _elicitation(engine, "eli_b1", "user-a")

    msgs = [
        _rpc(
            "elicitation.respond",
            {"elicitationId": "eli_b1", "userId": "user-a", "value": f"V{i}"},
            rid=i,
        )
        for i in range(8)
    ]
    responses = await _admit_all(engine, msgs)

    assert _errors(responses) == [], "并发结算触发了内部异常(疑为双 set_result)"
    results = _results(responses)
    assert len(results) == 8
    applied = [r for r in results if r.get("applied") is True]
    already = [r for r in results if r.get("reason") == "already_settled"]
    assert len(applied) == 1, f"结算名额必须唯一,实测 applied={len(applied)}"
    assert len(already) == 7, "其余七次要显式点名'已被答过',不得折叠成 applied=False"
    assert future.done() is True
    assert future.result() in {f"V{i}" for i in range(8)}


@pytest.mark.asyncio
async def test_b1b_second_answer_cannot_rewrite_the_winning_value() -> None:
    """B1b:赢家写下的值不得被后来的应答覆盖(修前的形态正是"后写的赢")。"""
    engine = _make_engine()
    future = _elicitation(engine, "eli_b1b", "user-a")

    first = await engine.handle_message(
        _rpc(
            "elicitation.respond",
            {"elicitationId": "eli_b1b", "userId": "user-a", "value": "FIRST"},
            1,
        )
    )
    second = await engine.handle_message(
        _rpc(
            "elicitation.respond",
            {"elicitationId": "eli_b1b", "userId": "user-a", "value": "SECOND"},
            2,
        )
    )
    assert first is not None and second is not None
    assert first["result"]["applied"] is True
    assert second["result"].get("applied") is not True
    assert second["result"]["reason"] == "already_settled"
    assert future.result() == "FIRST", "第二次应答不得改写已生效的值"


@pytest.mark.asyncio
async def test_b2_concurrent_approval_respond_one_slot_and_one_grant_row(
    approval_face: Any,
) -> None:
    """B2:引擎通道六次并发 approval.respond ⇒ 注册表名额唯一 + **持久授权只落一行**。

    覆盖同一枚结算走过的三处写点(G-637 修前它们各自为政):
      · `_approval_registry` 名额(event 只 set 一次);
      · `_permission_requests` 的 future(第二次 set 必抛 ⇒ 用"零错误响应"量);
      · `grant_tool_approval_persist` 落盘(spy 计数恰为 1 —— 六次里最多一次拿到
        cache_key,档位也不会被后到的 `always` 顶高)。
    """
    from app.services.agent_engine import _PendingPermissionRequest

    v2 = approval_face.v2
    engine = _make_engine()
    perm_future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    engine._permission_requests["appr_b2"] = _PendingPermissionRequest(
        thread_id="t-b2", user_id="user-a", future=perm_future
    )
    ev = _RecordingEvent()
    v2._approval_registry["appr_b2"] = v2._ApprovalEntry(
        event=ev, decision=None, owner_user_id="user-a"
    )
    v2._approval_persist_keys["appr_b2"] = "key::appr_b2"

    msgs = [
        _rpc(
            "approval.respond",
            {
                "approvalId": "appr_b2",
                "userId": "user-a",
                "decision": "approve",
                # 第 0 次要 session、其余要 always:名额若不唯一,同一键会被连落两行,
                # 而后一行把档位从会话级顶成跨会话级(= 权限放大,G-637 的病灶之一)
                "persist": "session" if i == 0 else "always",
            },
            rid=i,
        )
        for i in range(6)
    ]
    responses = await _admit_all(engine, msgs)

    assert _errors(responses) == [], "并发审批触发了内部异常(疑为双 set_result)"
    results = _results(responses)
    assert len(results) == 6
    applied = [r for r in results if r.get("applied") is True]
    assert len(applied) == 1, f"审批结算名额必须唯一,实测 {len(applied)}"
    assert ev.set_calls == 1, f"注册表唤醒只许一次,实测 {ev.set_calls}"
    assert perm_future.done() is True
    assert perm_future.result() == "approve"

    winner = applied[0]
    entry = v2._approval_registry["appr_b2"]
    assert entry.decision == winner["decision"], "注册表里的决策必须是赢家那一次写的"
    # 持久授权**至多一行**,且档位只可能是赢家自己选的那一档(不会被后到的顶高)
    assert len(approval_face.grant_spy) <= 1, (
        f"持久授权只得落一行,实测 {approval_face.grant_spy}"
    )
    if winner.get("persisted") is None:
        assert approval_face.grant_spy == [], "未落盘时一条都不许有"
    else:
        assert approval_face.grant_spy == [
            (winner["persisted"], "key::appr_b2", "mcp_tool")
        ], "落盘档位必须等于回执里的 persisted"
    assert "appr_b2" not in v2._approval_persist_keys, "persist 键已被单点取走(名额只有一份)"


@pytest.mark.asyncio
async def test_b3_different_keys_settle_independently_under_concurrency() -> None:
    """B3(正向对照):两个不同 elicitationId 并发 ⇒ **两个都生效**。

    这条防的是"把全局串行误当按 key 串行":若谁给结算加了一把大锁,B1 会漂亮地绿而
    这一条红。缺了它,任何后来人的单闸门都能伪装成本票的产出。
    """
    engine = _make_engine()
    fa = _elicitation(engine, "eli_a", "user-a")
    fb = _elicitation(engine, "eli_b", "user-a")

    msgs = [
        _rpc("elicitation.respond", {"elicitationId": "eli_a", "userId": "user-a", "value": "A"}, 1),
        _rpc("elicitation.respond", {"elicitationId": "eli_b", "userId": "user-a", "value": "B"}, 2),
    ]
    responses = await _admit_all(engine, msgs)
    results = _results(responses)
    assert _errors(responses) == []
    assert sum(1 for r in results if r.get("applied") is True) == 2, "不同 key 不得互吃名额"
    assert fa.result() == "A" and fb.result() == "B"


@pytest.mark.asyncio
async def test_b4_concurrent_foreign_answers_do_nothing_and_do_not_consume() -> None:
    """B4:principal 不符的并发应答 ⇒ 零副作用,且**不消耗**属主的名额(AGENTS §5)。

    与 B1 成对:只留"被拒"那一侧,门就可能只是把功能改坏了。
    """
    engine = _make_engine()
    future = _elicitation(engine, "eli_b4", "alice")

    msgs = [
        _rpc(
            "elicitation.respond",
            {"elicitationId": "eli_b4", "userId": "bob", "value": "STOLEN"},
            i,
        )
        for i in range(4)
    ]
    responses = await _admit_all(engine, msgs)
    assert _errors(responses) == []
    for r in _results(responses):
        assert r.get("applied") is not True
    assert future.done() is False, "非属主的应答不得结算任何东西"

    ok = await engine.handle_message(
        _rpc(
            "elicitation.respond",
            {"elicitationId": "eli_b4", "userId": "alice", "value": "MINE"},
            99,
        )
    )
    assert ok is not None and ok["result"]["applied"] is True, "属主名额不得被越权尝试吃空"
    assert future.result() == "MINE"


# ---------------------------------------------------------------------------
# C 组:判据有牙证明(缺了它,上面全可能是恒绿断言)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_c1_double_set_result_without_guard_is_observable() -> None:
    """C1:绕开 done() 判定直接双 `set_result` ⇒ 第二次必抛 InvalidStateError。

    证明 B1/B2 的"零错误响应"不是空断言:失败形态**存在且可观测**,
    只是生产路径的判定挡住了它。
    """
    future = asyncio.get_running_loop().create_future()
    future.set_result("first")
    with pytest.raises(asyncio.InvalidStateError):
        future.set_result("second")


@pytest.mark.asyncio
async def test_c2_inserted_yield_makes_double_settlement_reachable() -> None:
    """C2:把**同一段** check-and-set 中间插一个 `await` ⇒ 坏状态立刻可达。

    这就是"要不要落按 key 队列"的裁决依据,也是 A1/A2 的牙:本票不改生产代码,
    所以用一份局部变异体复现条件 1。两侧都断:
      · 两个协程都通过了 `done()` 判定(都观察到"还没结算");
      · 其中一次 `set_result` 抛 InvalidStateError ⇒ 真 handler 里它会变成错误回执。
    """
    future: asyncio.Future[Any] = asyncio.get_running_loop().create_future()
    passed_check: list[int] = []

    async def _racy(index: int) -> None:
        # 与 _handle_elicitation_respond 同形,但判定与置位之间多一个让出点
        if not future.done():
            passed_check.append(index)
            await asyncio.sleep(0)  # ← A1/A2 拦的就是这一行
            future.set_result(f"V{index}")

    outcomes = await asyncio.gather(
        *(_racy(i) for i in range(2)), return_exceptions=True
    )
    assert len(passed_check) == 2, f"插入让出点后应两次都过判定,实测 {passed_check}"
    assert any(isinstance(o, asyncio.InvalidStateError) for o in outcomes), (
        f"双结算必须可观测,实测 {outcomes}"
    )


def test_c3_structure_ruler_is_not_vacuous() -> None:
    """C3:A 组的尺子喂给**合成源码**必须能报出让出点(否则它是恒真式)。

    成对:干净源码 ⇒ 0 让出点;含 `await` 的那一段 ⇒ 恰好 1 个,且
    "判定行 → 置位行"窗口能被判出来。只看真仓此刻的颜色,不构成证明。
    """
    clean = ast.parse("async def h():\n    x = 1\n    return x\n")
    racy = ast.parse(
        "async def h():\n"
        "    if not f.done():\n"
        "        await g()\n"
        "        f.set_result(1)\n"
    )
    assert _yield_points(_function(clean, "h")) == []
    points = _yield_points(_function(racy, "h"))
    assert len(points) == 1 and isinstance(points[0], ast.Await), (
        "尺子量不出 await ⇒ A1/A2 是恒真式,本票的否证不成立"
    )
    fn = _function(racy, "h")
    assert _call_attr_line(fn, "done") == 2 and _call_attr_line(fn, "set_result") == 4


def test_c4_code_face_masking_keeps_line_numbers_and_hides_prose() -> None:
    """C4:A4 的遮噪面自身也要成对 —— 注释里的字样不得算事实,代码里的必须算。

    等长遮蔽(行号不变)是这个尺子能用 `enumerate` 对齐源码的前提。
    """
    src = (
        "# run_coroutine_threadsafe 只是说明文字\n"
        'X = "threading.Thread"\n'
        "resp = await ENGINE.handle_message(msg)\n"
    )
    face = _code_face(src)
    lines = face.splitlines()
    assert "run_coroutine_threadsafe" not in lines[0], "注释未剥 ⇒ 散文会被当成事实"
    assert "threading.Thread" not in lines[1], "字符串未遮 ⇒ 同样会被当成事实"
    assert len(lines) == 3 and "ENGINE.handle_message" in lines[2], "遮噪不得吃掉代码行或挪行号"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
