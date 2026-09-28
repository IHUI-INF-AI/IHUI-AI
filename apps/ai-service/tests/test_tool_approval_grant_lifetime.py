# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""主对话流「会话内总是允许」授权缓存(`llm._tool_approval_grants`)的**真实寿命**证明。

立因(2026-09-28,扩展端把第三档「本次会话内都允许」接上线后回头查服务端):
`llm.py` 里有四个进程内注册表 —— `_delegate_sessions` / `_form_sessions` / `_steer_sessions`
都在流收尾的 `finally` 里按 session 清掉,**只有 `_tool_approval_grants` 没有任何清理出口**。
它按 `f"{session_id}::{tool_name}"` 平铺累积,而 `session_id` 是**每轮**新生成的 uuid
(网关 `apps/api/src/routes/ai-chat-stream.ts` 的 `randomUUID()`,缺省时 `llm.py` 自己另生成),
所以"永久留着"既**不放行任何东西**(下一轮换 id、读不到),又**永远长着一格** ——
声明的寿命(注释写"与 _delegate_sessions 同生命周期模式")与执行的寿命分叉,
而分叉形态永远是安静。全仓 `tests/` 此前对该dict **零引用**(实测 grep 0 命中),即这一格无人看守。

本文件判四件事(缺一件就有一型看不见):
  T1 `scope='session'` ⇒ 同一条流内第二个同工具调用**不再弹审批帧**,且**执行了两次**
     (执行计数是 T1 的阳性对照:只断言"1 帧"会把"第二枚 tool_call 压根没执行"读成放行成功);
  T2 `scope='once'` ⇒ 两个 tool_call 各弹一帧(反向对照:grant 不是无条件生效);
  T3 流结束后该 session 在 `_tool_approval_grants` 里**不留桶**(本次修复的判据本体);
  T4 换一条新流(⇒ 新 session id)对同一工具**照样弹帧** —— 这一条同时钉住两件事:
     ① 清桶不改变任何一次放行判断(行为等价,修的是泄漏不是语义);
     ② "本会话"三字的**实际寿命就是本轮**。标签是否要改成"本轮都允许"、或把 id 升成会话级,
       属授权面设计决策(见 PROJECT_PLAN 同批登记),不在本文件代裁。

隔离(AGENTS §5 测试隔离铁律,姿势与 `test_workspace_delegate_roundtrip.py` 一致):
`db_pool.get_shared_pool` 桩成**抛 AssertionError 并计数**(光"跑到底没红"不算证据)、
`llm._fire_callback` 桩成记账器并断言零调用、`mcp_server._TOOL_HANDLERS['write_file']` 换成
记账桩(所以没有任何写盘发生)、`_resolve_user_role` 固定 admin(否则 `_ADMIN_ONLY_TOOLS`
会把执行先拦掉,T1 的"执行两次"就量不到)、`_APPROVAL_TIMEOUT` 缩短(绝不在测试里真等 120s)。
SSE 解析**共用**同族那一把尺子(`_parse_sse_events`),不在这里抄第二份。
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any

import pytest
from httpx import AsyncClient

# 共用一份 SSE 解析(两处算同一件事必漂移;同族委托用例已把这把尺子立在原位)
from tests.test_workspace_delegate_roundtrip import _parse_sse_events

ENDPOINT = "/api/llm/complete/stream"

_NONCE = "ihui-o81-25-grant-probe"
_TOOL = "write_file"
_MARKER = f"granted-execute::{_NONCE}"

# 审批等待上限的测试视图:刻意小于并发应答任务的存活窗口,又远小于生产 120s。
_APPROVAL_TIMEOUT_S = 8.0
# 应答任务轮询注册表的总窗口,刻意小于 _APPROVAL_TIMEOUT_S(否则先撞流内侧超时)。
_RESPOND_DEADLINE_S = 6.0


def _install_isolation(
    monkeypatch: pytest.MonkeyPatch,
    *,
    executor_calls: list[dict[str, Any]],
    callback_fires: list[dict[str, Any]],
    pool_attempts: list[str],
) -> None:
    """四面桩:真池不可取 / 执行器只记账 / 出站回调只记账 / 审批窗口缩短。生产码一行未动。"""
    from app.core import db_pool as db_pool_module
    from app.routers import llm as llm_router
    from app.services import mcp_server as mcp_module

    async def _unavailable_pool() -> Any:
        pool_attempts.append("get_shared_pool")
        raise AssertionError("测试隔离:审批授权用例不得取用共享 PostgreSQL 连接池(AGENTS §5)")

    monkeypatch.setattr(db_pool_module, "get_shared_pool", _unavailable_pool)

    # 记账桩打在 `_TOOL_HANDLERS` 条目上而不是 `call_tool`:权限矩阵/输出护栏那条链必须照原样跑,
    # 否则"执行两次"可能量的是被桩短路的假象。
    async def _recording_write_file(arguments: dict[str, Any]) -> dict[str, Any]:
        executor_calls.append({"tool": _TOOL, "args": dict(arguments)})
        return {"tool": _TOOL, "ok": True, "content": f"{_MARKER}#{len(executor_calls)}"}

    monkeypatch.setitem(mcp_module._TOOL_HANDLERS, _TOOL, _recording_write_file)

    async def _spying_fire_callback(url: str, payload: Any, metadata: Any, **kwargs: Any) -> None:
        callback_fires.append({"url": url, "metadata": metadata})

    monkeypatch.setattr(llm_router, "_fire_callback", _spying_fire_callback)
    monkeypatch.setattr(llm_router, "_APPROVAL_TIMEOUT", _APPROVAL_TIMEOUT_S)
    # 角色固定 admin:写类工具在 `_ADMIN_ONLY_TOOLS` 里,非 admin 会在执行前就被拦掉,
    # 那样 T1 的"执行两次"量不到(不是判据红,是链路没走到那一步)。
    monkeypatch.setattr(llm_router, "_resolve_user_role", lambda request: 1)


def _install_two_call_model_stub(
    monkeypatch: pytest.MonkeyPatch,
    *,
    rounds: dict[str, int],
    uid: str,
) -> None:
    """模型桩:第一轮吐**两条同名高危工具**的 tool_call,第二轮收尾。绝不发真实 provider 请求。

    `uid` 每条流唯一:tool_call id 与文件路径都带它。这不是卫生问题而是判据前提 ——
    同 worker 里连着跑两条 id 完全相同的流,会被链路上的重复调用防护当成同一件事跳过,
    于是"没弹审批帧"是**链路没走到**而不是"grant 免掉了"(实测第二轮起 approvals=0)。
    """
    from app.routers import llm as llm_router

    async def fake_astream(
        messages: list[dict[str, Any]],
        model: str | None = None,
        owner_uuid: str | None = None,
        **kwargs: Any,
    ) -> Any:
        rounds["n"] += 1
        if rounds["n"] == 1:
            yield {"type": "chunk", "content": "我先把两处都写一下。"}
            yield {
                "type": "tool_calls",
                "tool_calls": [
                    {
                        "index": i,
                        "id": f"call_{uid}_{i}",
                        "type": "function",
                        "function": {
                            "name": _TOOL,
                            "arguments": json.dumps(
                                {"path": f"src/{uid}-{i}.ts", "content": f"export const x{i} = 1"},
                                ensure_ascii=False,
                            ),
                        },
                    }
                    for i in (0, 1)
                ],
            }
            yield {"type": "done", "model": "test-model", "usage": {}, "stub": True}
        else:
            yield {"type": "chunk", "content": "两处都写完了。"}
            yield {
                "type": "done",
                "model": "test-model",
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "stub": True,
            }

    monkeypatch.setattr(llm_router.llm_gateway, "astream", fake_astream)


async def _drive_two_call_stream(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    scope: str,
    decision: str = "approve",
) -> dict[str, Any]:
    """跑一条"同轮两次高危工具调用"的流,并记录审批帧、执行次数与结束时仍活着的桶。"""
    from app.routers import llm as llm_router

    executor_calls: list[dict[str, Any]] = []
    callback_fires: list[dict[str, Any]] = []
    pool_attempts: list[str] = []
    _install_isolation(
        monkeypatch,
        executor_calls=executor_calls,
        callback_fires=callback_fires,
        pool_attempts=pool_attempts,
    )
    rounds = {"n": 0}
    uid = f"{_NONCE}-{uuid.uuid4().hex[:8]}"
    _install_two_call_model_stub(monkeypatch, rounds=rounds, uid=uid)

    before = {(sid, aid) for sid, d in llm_router._approval_sessions.items() for aid in d}
    answered: list[dict[str, Any]] = []
    done = {"flag": False}

    async def _respond_every_appearance() -> None:
        """对**每一个**新出现的审批条目回一次决策(once 档要有第二条可答,否则量不到"仍弹帧")。"""
        deadline = time.monotonic() + _RESPOND_DEADLINE_S
        while not done["flag"] and time.monotonic() < deadline:
            for sid, d in list(llm_router._approval_sessions.items()):
                for aid in list(d):
                    if (sid, aid) in before or any(r["approvalId"] == aid for r in answered):
                        continue
                    resp = await client.post(
                        f"{ENDPOINT}/{sid}/approval-response",
                        json={"approval_id": aid, "decision": decision, "scope": scope},
                    )
                    answered.append(
                        {
                            "sessionId": sid,
                            "approvalId": aid,
                            "status": resp.status_code,
                            "body": resp.json(),
                        }
                    )
            await asyncio.sleep(0.005)
        return None

    bg = asyncio.create_task(_respond_every_appearance())
    started = time.monotonic()
    try:
        resp = await client.post(
            ENDPOINT,
            json={
                "messages": [{"role": "user", "content": "把两处都改掉"}],
                "model": "test-model",
                "agent_tools": [_TOOL],
                # 刻意不发 workspace_context:有它 write_file 走委托分支,审批那一格就不执行了。
                "permission_mode": "default",
            },
        )
        assert resp.status_code == 200, f"路由未按 200 返回:{resp.status_code} / {resp.text[:600]}"
    finally:
        done["flag"] = True
        await bg
    elapsed = time.monotonic() - started

    events = _parse_sse_events(resp.text)
    # 共用尺子产出的形态是 {event, data}(见 `_parse_sse_events`),帧名在 `event` 上、
    # payload 在 `data` 里 —— 按 payload 里的 `type` 筛会一条都筛不到而账面一切正常。
    approvals = [e["data"] for e in events if e["event"] == "tool-approval"]
    results = [e for e in events if e["event"] == "tool-result"]
    return {
        "events": events,
        "approvals": approvals,
        "results": results,
        "executor_calls": executor_calls,
        "answered": answered,
        "callback_fires": callback_fires,
        "pool_attempts": pool_attempts,
        "rounds": rounds["n"],
        "elapsed_s": elapsed,
        # 结束时**本流涉及的**每个 session 在授权缓存里的残留桶(判据 T3 的读数面)
        "grant_buckets": {
            sid: dict(d) for sid, d in llm_router._tool_approval_grants.items() if sid in {
                a.get("session_id") for a in approvals
            } - {None}
        },
    }


@pytest.mark.anyio
class TestToolApprovalGrantLifetime:
    async def test_session_scope_suppresses_the_second_prompt_but_still_executes_twice(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        r = await _drive_two_call_stream(client, monkeypatch, scope="session")
        # 阳性对照:两条 tool_call 都真执行了(不是"第二条没走到")
        assert len(r["executor_calls"]) == 2, f"应执行 2 次,实到 {len(r['executor_calls'])}: {r['executor_calls']}"
        # 只有第一条被回传端点接受过(session 档下第二条不弹,自然也没有第二条可答)——
        # 这一维与 approvals 分开判:answered 量的是"生产端点真被走过几次",
        # 若把 grant 短路成"整条 loop 少跑一次",executor_calls 会跟着掉,approvals 也会"少",
        # 两条同时看才分得开"免弹窗"与"没执行"。
        assert len(r["answered"]) == 1, f"session 档应只有 1 条待决被应答,实到 {len(r['answered'])}"
        assert len(r["approvals"]) == 1, (
            f"session 档应只弹 1 帧,实到 {len(r['approvals'])};本轮事件类型="
            f"{sorted({str(e.get('type')) for e in r['events']})}"
        )
        assert len(r["results"]) == 2
        # 不是超时那一支放开的:耗时严格小于被缩短的等待上限
        assert r["elapsed_s"] < _APPROVAL_TIMEOUT_S, f"疑似走了审批超时支(耗时 {r['elapsed_s']:.1f}s)"

    async def test_once_scope_prompts_both_calls(self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
        r = await _drive_two_call_stream(client, monkeypatch, scope="once")
        assert len(r["executor_calls"]) == 2
        assert len(r["answered"]) == 2, f"once 档应有 2 条被应答,实到 {len(r['answered'])}"
        assert len(r["approvals"]) == 2, (
            f"once 档应弹 2 帧,实到 {len(r['approvals'])} —— grant 被无条件生效了?"
        )

    async def test_grant_bucket_does_not_survive_the_stream(
        self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        r = await _drive_two_call_stream(client, monkeypatch, scope="session")
        sids = {a.get("session_id") for a in r["approvals"]} - {None}
        assert sids, "审批帧里没带 session_id ⇒ 这条判据没在被量的面上跑"
        assert r["grant_buckets"] == {}, f"流结束后仍留有授权桶:{r['grant_buckets']}"

    async def test_a_new_stream_is_prompted_again(self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
        """换一条流(新 session id)对同一工具照样弹 ⇒ ① 清桶行为等价,② "本会话"的实际寿命就是本轮。

        第二点是被**量出来**的,不是读注释读出来的:如果 grant 真的跨轮生效,这一条会只弹 1 帧。
        """
        first = await _drive_two_call_stream(client, monkeypatch, scope="session")
        assert len(first["approvals"]) == 1
        second = await _drive_two_call_stream(client, monkeypatch, scope="session")
        assert len(second["approvals"]) == 1, (
            f"第二条流应重新弹帧(新 session id),实到 {len(second['approvals'])} ⇒ "
            "grant 跨轮活了,「本会话」那个标签名副其实,本文件的 T4 结论要改写"
        )
        assert len(second["executor_calls"]) == 2

    async def test_no_pool_and_no_outbound_callback(self, client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
        r = await _drive_two_call_stream(client, monkeypatch, scope="session")
        assert r["pool_attempts"] == [], f"取了生产 PG 连接池:{r['pool_attempts']}"
        assert r["callback_fires"] == [], f"发生了出站回调(会落库):{r['callback_fires']}"
        assert r["rounds"] >= 2, f"tool loop 没续跑到第二轮(轮次 {r['rounds']})"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
