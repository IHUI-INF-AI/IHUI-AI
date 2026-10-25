# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D-07(2026-10-26 立,承 D131 取证 / D1047 diff② / D690 方案 A)—— 断线窗口待决审批:
「过期即失效并留痕 + 具名拒绝」那一档的成对判据。

根因(现读,文件+函数):待决条目住在 `app/routers/llm.py` 工具循环的等待段
(`_approval_sessions.setdefault(session_id, {})[_approval_id] = {...}` 写入,
`try/finally` 里 `pop`)。客户端一断,`GeneratorExit` 从等待循环里那个
`yield ": keep-alive…"` 抛入,`finally` **当场 pop** ⇒ 复用同一 `streamSessionId`
重连时 `chat_pending_approval_replays` 的输入集恒空 ⇒ D690 已装车的重放分支
拿不到条目,弹窗**静默**丢失:既没有帧,服务端也没留下"丢过"的任何事实
(`test_d1047_chat_entry_shape_replay_gate.py` 的 T7 早把这格量成源码形状事实)。

票面给了两条出路,本票按证据选第二档并说明为什么第一档不在本射程落地:
- 第一档「待决项跨断线存续 + 重连重发弹窗」= 空头支票:条目离开活等待者后,
  用户点"批准"没有任何执行体在听(僵尸 run),而新 run 会为同一工具发**新**
  approval_id ⇒ 双弹窗。前提是续传锚点 + 跨端载荷键(`packages/shared`)同批,
  不在本席射程(与 D1047 头注裁定同向)。
- 第二档(本票落地)= **过期即失效并留痕**:摘条目那一刻若无人应答,按
  `stream_closed` / `cancelled` / `timeout` 三档落一条有界留痕,再接三个既有出口
  点名 —— ① 迟到的应答经 `_approval_settle_rejection` **具名拒绝**(仅属主本人
  听得到具体原因,他人拿到的形状与"根本没这条"逐字段同形);② 重连路径把失效
  条数落服务端日志(运维不再瞎);③ 本文件的形状锁钉住接线。**零 wire 变化**:
  一个新事件名都没加、端点回包键集仍是 `{ok, error}` ⇒ 老客户端逐字节不变,可单文件回滚。

AGENTS §5 三条硬约束在这里各自有对应用例:
- 不新增鉴权旁路:身份只从承载层 `request` → `_resolve_owner_uuid`(JWT 派生)进来;
  live 条目的结算路径一字未动,拒绝路径不写任何状态(越权用例断言"副作用没发生")。
- 重放幂等:同一 (会话, 审批) 重复登记只留第一条;取名单纯只读、不出账。
- 失效方向 = 拒绝并点名:字段不齐 ⇒ 不记(并让调用方点名为何判不出);时刻判不了
  ⇒ 不点名也不冒充点名。

测试隔离(AGENTS §5 铁律):全程纯内存 + 纯源码文本,**不连 PostgreSQL / Redis**;
`app.routers.llm` 的 import 面与 D131/D690/D1047 既有取证同规(不触发建池);
待决表格与失效账本都用后即清。行数不变性另由 `test_跑两遍` 一条显式断言,
交付前再按 §5 把整份文件连跑两次比对 passed 计数。
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.approval_replay import (
    APPROVAL_LOSS_REASONS,
    EXPIRY_MAX_PER_SESSION,
    EXPIRY_RETENTION_SECONDS,
    approval_expiry_notice,
    approval_expiry_size,
    chat_expired_approval_notices,
    clear_approval_expiry,
    prune_approval_expiry,
    record_approval_expiry,
)
from app.core.sse_contract import SSE_EVENTS
from app.routers.llm import (
    _approval_replay_frames,
    _approval_sessions,
    _approval_settle_rejection,
    post_tool_approval_response,
)

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
LLM_PY = AI_SERVICE_ROOT / "app" / "routers" / "llm.py"

_SESSION = "d07-sess-1"
_OTHER_SESSION = "d07-sess-other"
_OWNER = "user-A"
_OUTSIDER = "user-B"
_APPR = "appr_d0700000001"


def _entry(
    *,
    owner: str | None = _OWNER,
    decision: str | None = None,
    set_event: bool = False,
    created_at: str | None = None,
    **overrides: Any,
) -> dict[str, Any]:
    """按 llm.py 生产条目键集(D1047 diff① 补齐后)造一条条目。"""
    ev = asyncio.Event()
    if set_event:
        ev.set()
    entry: dict[str, Any] = {
        "event": ev,
        "decision": decision,
        "scope": None,
        "reason": None,
        "argv": ["ls"],
        "tool_name": "run_command",
        "net_fact": None,
        "tool_call_id": "call-1",
        "args_preview": '{"argv":["ls"]}',
        "danger_level": "high",
        "owner_user_id": owner,
        "created_at": created_at or datetime.now(UTC).isoformat(),
    }
    entry.update(overrides)
    return entry


def _request(user_id: str | None = None) -> SimpleNamespace:
    """承载层身份替身:`_resolve_owner_uuid` 只读 `request.state.user_id`。"""
    state = SimpleNamespace()
    if user_id is not None:
        state.user_id = user_id
    return SimpleNamespace(state=state)


@pytest.fixture(autouse=True)
def _clean_ledger():
    """失效账本用后即清(全局单例,不许跨用例带脏行)。"""
    clear_approval_expiry()
    yield
    clear_approval_expiry()


@pytest.fixture()
def bucket():
    """在 `_approval_sessions` 里只开本用例的会话格。"""
    _approval_sessions.pop(_SESSION, None)
    cell: dict[str, dict[str, Any]] = {}
    _approval_sessions[_SESSION] = cell
    yield cell
    _approval_sessions.pop(_SESSION, None)


def _replay_once() -> list[dict[str, Any]]:
    frames = _approval_replay_frames(_SESSION, _OWNER)
    out: list[dict[str, Any]] = []
    for frame in frames:
        assert frame.startswith("event: tool-approval\ndata: "), f"重放帧形漂了: {frame[:40]!r}"
        out.append(json.loads(frame.split("data: ", 1)[1].strip()))
    return out


# ── ① 成对:断线→重连后"仍待决"的仍在且被重放一次;"已决"的不得重放 ──────────────


def test_pending_survives_and_is_replayed_once_decided_is_not(bucket) -> None:
    """正向:活等待者名下的条目跨重连存续且被重放恰一帧;反向:已决条目零帧。

    这一对同时是"为什么第二档必须存在"的证据 —— 重放只在**没被 finally 摘掉**时
    成立;断线把等待者打死的那一刻,表里就再没有东西可重放(见 ② 组)。
    """
    entry = _entry()
    bucket[_APPR] = entry

    payloads = _replay_once()
    assert [p["approval_id"] for p in payloads] == [_APPR], "仍待决的审批必须在重连流里回来"
    assert payloads[0]["replay"] is True

    # 反例:用户答过了 ⇒ 再重连一帧都不许发(重放已决 = 二次弹窗 = 副作用)
    answered = asyncio.run(
        post_tool_approval_response(_request(_OWNER), _SESSION, {"approval_id": _APPR, "decision": "approve"})
    )
    assert answered["ok"] is True, answered
    assert entry["event"].is_set()
    assert _replay_once() == [], "已决条目不得被重放"
    # 答过的不是"丢失",一律不进失效账本
    assert approval_expiry_size() == 0


# ── ② 断线即失效:留痕 + 点名(本票真正补的那一格) ────────────────────────────


def _simulate_wait_then_disconnect(entry: dict[str, Any], *, mode: str) -> str | None:
    """跑一个与生产等待段**同形**的微生成器,返回账本里点名的那档原因。

    生产的 `gen()` 不可单函数取用(8000 行流),故这里复刻等待段的骨架:`try` 里
    `await wait_for(event)` + `yield keep-alive`,`finally` 里 pop 并按异常类型分档
    记账。形状一致性由 ③ 组源码锁钉住(接线一被摘/一改成别的词汇,③ 立刻翻红)。
    """
    ev: asyncio.Event = entry["event"]

    async def _wait_and_yield() -> None:
        loss: str | None = None
        try:
            try:
                await asyncio.wait_for(ev.wait(), timeout=0.01)
            except TimeoutError:
                yield "keep-alive"  # 生产里断线就从这一格抛入 GeneratorExit
        except GeneratorExit:
            loss = "stream_closed"
            raise
        except asyncio.CancelledError:
            loss = "cancelled"
            raise
        finally:
            popped = _approval_sessions.get(_SESSION, {}).pop(_APPR, None)
            if (
                loss is not None
                and isinstance(popped, dict)
                and popped.get("decision") is None
                and not ev.is_set()
            ):
                record_approval_expiry(_SESSION, _APPR, popped, reason=loss)

    async def _drive() -> None:
        agen = _wait_and_yield()
        try:
            await agen.__anext__()  # 先跑到 keep-alive 那一格
        except StopAsyncIteration:
            return
        if mode == "disconnect":
            await agen.aclose()  # 客户端断开 = GeneratorExit 注入
        else:
            try:
                await agen.__anext__()
            except StopAsyncIteration:
                pass

    asyncio.run(_drive())
    # 从账本读回那一格,而不是信上面那个闭包变量(账本才是事实面)
    notice = approval_expiry_notice(_SESSION, _APPR, _OWNER)
    return str(notice["reason"]) if notice else None


def test_disconnect_records_expiry_and_names_the_loss() -> None:
    """断线 ⇒ 条目被等待方摘掉那一刻留痕,并可用属主本人身份点名。"""
    entry = _entry()
    _approval_sessions[_SESSION] = {_APPR: entry}
    reason = _simulate_wait_then_disconnect(entry, mode="disconnect")
    assert reason == "stream_closed", f"失效原因漂了: {reason}"
    assert not _approval_sessions.get(_SESSION), (
        "留痕不许把条目留在待决表里(否则重放会对无等待者的条目开空头支票)"
    )
    notices = chat_expired_approval_notices(_SESSION, _OWNER)
    assert len(notices) == 1
    assert notices[0]["tool_name"] == "run_command"
    assert notices[0]["approval_id"] == _APPR


def test_answered_entry_leaves_no_expiry_trace() -> None:
    """反向对照:用户答过之后等待段收尾 ⇒ 不进失效账本(答过 ≠ 丢了)。"""
    entry = _entry()
    _approval_sessions[_SESSION] = {_APPR: entry}
    asyncio.run(
        post_tool_approval_response(_request(_OWNER), _SESSION, {"approval_id": _APPR, "decision": "reject"})
    )
    _approval_sessions[_SESSION].pop(_APPR, None)  # 生产 finally(已决路径)
    assert approval_expiry_size() == 0
    assert chat_expired_approval_notices(_SESSION, _OWNER) == []


# ── ③ 接线与词汇锁(判据不许旁落、不许第二份词汇表) ───────────────────────────


def _llm_face() -> str:
    """llm.py 源码面(剥行注释后),形状锁只认代码不认注释里的提及。"""
    src = LLM_PY.read_text(encoding="utf-8", errors="ignore")
    return "\n".join(line.split("#", 1)[0] for line in src.splitlines())


def test_llm_wiring_calls_the_single_sourced_ledger() -> None:
    """llm.py 必须经唯一出口记账,并自己分好三档原因;词汇表只许住在取数侧一份。"""
    src = _llm_face()
    assert "record_approval_expiry(" in src, "断线留痕接线被摘 ⇒ 回到彻底静默,本锁须重裁"
    assert "approval_expiry_notice(" in src or "_approval_settle_rejection(" in src, (
        "具名拒绝的取用点消失 ⇒ 迟到的应答又只能拿到通用 not found"
    )
    for reason in ("stream_closed", "cancelled", "timeout"):
        assert f'"{reason}"' in src, f"llm.py 等待段不再产出 {reason} 档原因"
    # 反向:reason 字面量集合必须恰等于取数侧封闭集(第二份词汇表必然漂移)
    llm_reasons = set(re.findall(r"_loss_reason\s*=\s*\"([a-z_]+)\"", src))
    assert llm_reasons == set(APPROVAL_LOSS_REASONS), (
        f"等待段产出的原因与 APPROVAL_LOSS_REASONS 分叉: {sorted(llm_reasons)} vs "
        f"{sorted(APPROVAL_LOSS_REASONS)}"
    )


def test_no_new_sse_event_and_no_new_response_key() -> None:
    """零跨端改动自证:没加任何事件名,端点回包键集仍是 {ok, error}。

    加事件名要同批改 `packages/shared/src/sse/contract.ts` 与 parity 门(票面 B/C 档
    的代价),本档刻意不走那条路 —— 这条锁保证"零跨端批次"不是一句口头保证。
    """
    joined = " ".join(sorted(SSE_EVENTS))
    assert "expir" not in joined.lower(), "失效点名不该靠新事件名送达"
    generic = _approval_settle_rejection(_SESSION, _APPR, _OWNER, "session not found or expired")
    named = _approval_settle_rejection(_SESSION, _APPR, _OWNER, "approval not found or expired")
    assert set(generic) <= {"ok", "error"} and set(named) <= {"ok", "error"}


# ── ④ 授权与幂等(§5 认证不等于授权 + 重放两次不得两次副作用) ──────────────────


def test_named_rejection_only_for_the_owner_others_get_the_generic_shape() -> None:
    """属主本人 ⇒ 具名拒绝;他人 / 无身份 ⇒ 与"根本没这条"逐字段同形(存在性探针锁)。"""
    record_approval_expiry(
        _SESSION, _APPR, _entry(), reason="stream_closed"
    )
    named = asyncio.run(
        post_tool_approval_response(_request(_OWNER), _SESSION, {"approval_id": _APPR, "decision": "approve"})
    )
    assert named["ok"] is False, "失效条目绝不被结算"
    assert "stream_closed" in named["error"] and "run_command" in named["error"], named
    assert "not executed" in named["error"], named

    for caller in (_request(_OUTSIDER), _request(None)):
        probe = asyncio.run(
            post_tool_approval_response(caller, _SESSION, {"approval_id": _APPR, "decision": "approve"})
        )
        assert probe == {"ok": False, "error": "session not found or expired"}, (
            f"越权/匿名探测拿到了具体内容 ⇒ 端点成了存在性探针: {probe}"
        )
    # 副作用面:整轮下来账本一条没多、没有 Event 被置、待决表没被凭空写
    assert approval_expiry_size() == 1
    assert not _approval_sessions.get(_SESSION), "拒绝路径不得凭空造出待决条目"


def test_late_answer_on_live_entry_still_settles_positive_control() -> None:
    """正向对照(不许只有拒绝):活条目 + 任意应答方沿用改前语义,结算路径未被收紧。"""
    entry = _entry()
    _approval_sessions[_SESSION] = {_APPR: entry}
    ok = asyncio.run(
        post_tool_approval_response(_request(_OWNER), _SESSION, {"approval_id": _APPR, "decision": "approve"})
    )
    assert ok["ok"] is True, ok
    assert entry["decision"] == "approve" and entry["event"].is_set()
    _approval_sessions.pop(_SESSION, None)


def test_replay_and_ledger_are_idempotent_under_repeated_reconnects() -> None:
    """重放两次不得产生两次副作用:登记幂等 + 取名单只读 + 投递按连接各一次但账本不变。"""
    entry = _entry()
    _approval_sessions[_SESSION] = {_APPR: entry}

    # 同一条失效被登记两次(重试/双 finally)⇒ 只留第一条
    first = record_approval_expiry(_SESSION, _APPR, entry, reason="stream_closed")
    second = record_approval_expiry(_SESSION, _APPR, _entry(tool_name="other_tool"), reason="timeout")
    assert second is first, "重复登记必须返回第一条,不得改写/叠加"
    assert approval_expiry_size() == 1

    sizes = []
    for _ in range(3):
        _replay_once()  # 每次重连一次投递
        notices = chat_expired_approval_notices(_SESSION, _OWNER)
        sizes.append(approval_expiry_size())
        assert len(notices) == 1, "取名单必须只读(不在取数时出账)"
    assert sizes == [1, 1, 1], f"重放把账本改大了: {sizes}"
    assert entry["decision"] is None and not entry["event"].is_set(), "重放不许替用户答应"
    _approval_sessions.pop(_SESSION, None)


# ── ⑤ 队列必须有死亡机制 + 输入不合格一律"判不出"而非静默成功 ──────────────────


def test_expiry_records_expire_out_of_the_ledger() -> None:
    """超存续窗 ⇒ 出账(断线只记账不回收 = 第二个病灶);出账后再问为空。"""
    record_approval_expiry(_SESSION, _APPR, _entry(), reason="stream_closed")
    assert approval_expiry_size() == 1
    future = datetime.now(UTC) + timedelta(seconds=EXPIRY_RETENTION_SECONDS + 1)
    removed = prune_approval_expiry(future)
    assert removed == 1
    assert approval_expiry_size() == 0
    assert chat_expired_approval_notices(_SESSION, _OWNER) == []


def test_undeterminable_inputs_are_refused_not_faked() -> None:
    """字段不齐 / 原因不在封闭集 / 非 dict ⇒ None(不记),绝不写一条半截留痕冒充判过。"""
    incomplete = _entry(args_preview=None)
    assert record_approval_expiry(_SESSION, "appr_x", incomplete, reason="timeout") is None
    assert record_approval_expiry(_SESSION, "appr_y", _entry(), reason="because_reasons") is None
    assert record_approval_expiry(_SESSION, "appr_z", "not-a-dict", reason="timeout") is None
    assert record_approval_expiry("", "appr_w", _entry(), reason="timeout") is None
    assert approval_expiry_size() == 0, f"判不出的输入留下了行: {approval_expiry_size()}"


def test_per_session_bucket_is_bounded() -> None:
    """单会话留痕有上界:超出后最旧一条被剔,总行数不越界(有界性由现读常量给)。"""
    total = EXPIRY_MAX_PER_SESSION + 5
    for i in range(total):
        record_approval_expiry(_OTHER_SESSION, f"appr_{i:04d}", _entry(), reason="stream_closed")
    assert approval_expiry_size() <= EXPIRY_MAX_PER_SESSION, approval_expiry_size()
    newest = chat_expired_approval_notices(_OTHER_SESSION, _OWNER)
    assert len(newest) == EXPIRY_MAX_PER_SESSION, len(newest)
    # 留下的是最新那批(最旧被剔),而不是任意一批 —— 否则"有界"是靠丢错东西凑的
    kept = {n["approval_id"] for n in newest}
    expected = {f"appr_{i:04d}" for i in range(total - EXPIRY_MAX_PER_SESSION, total)}
    assert kept == expected, f"裁剪裁错了对象: 多 {sorted(kept - expected)} 缺 {sorted(expected - kept)}"


# ── ⑥ §5 跑两次行数一致(同进程两遍整场景,不靠外部记忆) ───────────────────────


def test_跑两遍行数一致() -> None:
    """同一场景连跑两遍:失效账本行数与待决表格数在两遍后完全相同(幂等 + 无残留)。"""
    def _one_round() -> tuple[int, int, int]:
        clear_approval_expiry()
        _approval_sessions.pop(_SESSION, None)
        entry = _entry()
        _approval_sessions[_SESSION] = {_APPR: entry}
        before = len(_replay_once())
        popped = _approval_sessions[_SESSION].pop(_APPR, None)
        assert popped is not None
        record_approval_expiry(_SESSION, _APPR, popped, reason="stream_closed")
        asyncio.run(
            post_tool_approval_response(_request(_OWNER), _SESSION, {"approval_id": _APPR, "decision": "approve"})
        )
        return before, approval_expiry_size(), len(chat_expired_approval_notices(_SESSION, _OWNER))

    first = _one_round()
    second = _one_round()
    assert first == second, f"跑两遍行数漂了: {first} vs {second}"
    prune_approval_expiry(datetime.now(UTC) + timedelta(seconds=EXPIRY_RETENTION_SECONDS + 1))
    assert approval_expiry_size() == 0, "收尾必须回到零行(不许给下一席留脏账本)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
