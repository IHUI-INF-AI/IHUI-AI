# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 16 批:canvas 线程归属闸(防劫持 + 跨用户读/控)。

现读缺陷(回源确认):
  `app/routers/langgraph.py` 整族端点**一个身份依赖都没挂**,而
  `app/services/canvas_graph.register_canvas_graph` 按 threadId 直接覆盖注册:
    · GET /{id}/state、/{id}/history 可凭 runId 读走他人整图的 checkpoint 与执行历史;
    · POST /{id}/interrupt、/resume 可打断/续跑他人正在执行的 DAG;
    · 最严重:`POST /canvas/run` 的 `thread_id` 是请求体自报字段 ⇒ 攻击者把自己的 DAG
      注册到受害者正在用的 runId 上,受害者下一次 stream 执行的就是攻击者的图。

修法:注册时登记归属主体(与图注册表分账,不随 64 条容量淘汰丢归属),各端点按
「登记过 owner 且调用主体可解析」才判 404。主体解析不到时不拒 —— 本链路的 stream
由 apps/api 代理,前端 EventSource 那条腿不带 Authorization,挂硬身份依赖会把画布整片
401 打断(且实测 FastAPI 不接受 `Request | None`,靠默认值绕不过去)。把这一格升成
硬闸的前置:代理腿稳定携带用户身份。

用例:
  A owner 登记与查询;remove 同步摘账(不摘就是"删了图但归属账还在长")。
  B 归属主体可读;他人 404;未登记 thread 不在射程。
  C 主体解析不到(None)⇒ 放行 —— 刻意登记这条,防止后来人误当成遗漏去"补严"或误当成
     已收口去删前置条件。
  D 端到端防劫持:alice 注册 t-x 后,bob 带同一个 thread_id 再 run ⇒ 换发新 id,
     t-x 的图**仍是 alice 的那张**。
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers import langgraph as lg
from app.routers.langgraph import CanvasRunRequest, post_canvas_run
from app.services.canvas_graph import (
    canvas_thread_owner,
    get_canvas_graph_entry,
    register_canvas_graph,
    remove_canvas_graph,
)

_DAG = {"nodes": [{"id": "n1", "type": "tool", "name": "工具节点"}], "edges": []}

# 主体必须是 uuid 形态:第 26 批把"非 uuid 主体"排除在归属之外(系统身份不得取得归属)。
_ALICE = "11111111-1111-4111-8111-111111111111"
_BOB = "22222222-2222-4222-8222-222222222222"
_CAROL = "33333333-3333-4333-8333-333333333333"


class _FakeGraph:
    async def ainvoke(self, *a, **k):  # pragma: no cover - 不参与本用例
        return {}


@pytest.fixture(autouse=True)
def owner_store_stub(monkeypatch):
    """归属持久账的内存替身:单测不连 DB(§5 测试隔离铁律)。"""
    store: dict[str, str] = {}

    async def _load(thread_id: str) -> str | None:
        return store.get(thread_id)

    async def _claim(thread_id: str, user_id: str) -> str | None:
        return store.setdefault(thread_id, user_id)

    monkeypatch.setattr(lg, "load_thread_owner", _load)
    monkeypatch.setattr(lg, "claim_thread_owner", _claim)
    return store


@pytest.fixture
def manager_stub(monkeypatch):
    """canvas run 需要的 manager:get_saver 抛错 ⇒ checkpointer 降级 None,只测归属面。"""

    class _M:
        async def get_saver(self):
            raise RuntimeError("saver off")

        async def get_latest_checkpoint(self, thread_id):
            return {"thread_id": thread_id, "checkpoint_id": "ck-1"}

        async def get_graph_state(self, graph, thread_id):
            return None

    monkeypatch.setattr(lg, "_manager", lambda: _M())
    monkeypatch.setattr(lg, "build_canvas_graph", lambda dag, *, checkpointer=None: _FakeGraph())
    return _M


def _req(user_id: str | None):
    return SimpleNamespace(state=SimpleNamespace(user_id=user_id))


# ---------------------------------------------------------------------------
# A/B/C:归属账与闸
# ---------------------------------------------------------------------------


def test_owner_registered_and_cleared():
    register_canvas_graph("t-a", _FakeGraph(), owner=_ALICE)
    assert canvas_thread_owner("t-a") == _ALICE
    remove_canvas_graph("t-a")
    # 摘图必须同时摘归属账,否则同名 thread 复用时背着旧主体
    assert canvas_thread_owner("t-a") is None


def test_owner_absent_when_not_supplied():
    """不带 owner 的注册(内部/历史调用形态)不写归属账。"""
    register_canvas_graph("t-b", _FakeGraph())
    assert canvas_thread_owner("t-b") is None
    remove_canvas_graph("t-b")


async def test_access_denied_for_other_principal():
    register_canvas_graph("t-c", _FakeGraph(), owner=_ALICE)
    with pytest.raises(HTTPException) as exc:
        await lg._assert_thread_access("t-c", _BOB, claim=True)
    assert exc.value.status_code == 404
    # 别人的与"不存在"同形:不给出存在性差异
    assert exc.value.detail == "thread 不存在: t-c"
    remove_canvas_graph("t-c")


async def test_access_allowed_for_owner_and_unknown_thread():
    register_canvas_graph("t-d", _FakeGraph(), owner=_ALICE)
    await lg._assert_thread_access("t-d", _ALICE, claim=False)  # 不抛
    # 未登记 ⇒ 不在射程(历史条目/默认 agent 图);读取类不得登记归属
    await lg._assert_thread_access("t-never-registered", _BOB, claim=False)
    remove_canvas_graph("t-d")


async def test_access_allowed_when_principal_unresolvable():
    """C 主体解析不到 ⇒ 放行。这条是刻意的射程声明,不是漏洞登记。

    摘掉 None 分支(改成硬拒)会把内部系统调用整片打断;要升成硬闸必须先解决
    全部调用腿的身份透传,不能在这里悄悄放宽又在这里悄悄收紧。
    """
    register_canvas_graph("t-e", _FakeGraph(), owner=_ALICE)
    await lg._assert_thread_access("t-e", None, claim=False)
    remove_canvas_graph("t-e")


# ---------------------------------------------------------------------------
# D:端到端防劫持
# ---------------------------------------------------------------------------


async def test_canvas_run_refuses_to_hijack_foreign_thread(manager_stub):
    """bob 拿 alice 的 runId 再 run ⇒ 换发新 id,alice 的图原封不动。"""
    resp_alice = await post_canvas_run(
        _req(_ALICE), CanvasRunRequest(dag=_DAG, thread_id="t-victim")
    )
    assert resp_alice["code"] == 0
    assert resp_alice["data"]["runId"] == "t-victim"
    victim_graph = get_canvas_graph_entry("t-victim")["graph"]

    resp_bob = await post_canvas_run(
        _req(_BOB), CanvasRunRequest(dag=_DAG, thread_id="t-victim")
    )
    new_id = resp_bob["data"]["runId"]
    assert new_id != "t-victim", "他人线程不得被覆盖注册"
    assert canvas_thread_owner(new_id) == _BOB

    # 关键断言:受害者的图没被换掉
    still = get_canvas_graph_entry("t-victim")
    assert still is not None and still["graph"] is victim_graph
    assert canvas_thread_owner("t-victim") == _ALICE

    remove_canvas_graph("t-victim")
    remove_canvas_graph(new_id)


async def test_canvas_run_owner_is_recorded_from_principal(manager_stub):
    """缺省 thread_id 时,生成的 runId 也带上主体归属。"""
    resp = await post_canvas_run(_req(_CAROL), CanvasRunRequest(dag=_DAG))
    run_id = resp["data"]["runId"]
    assert canvas_thread_owner(run_id) == _CAROL
    remove_canvas_graph(run_id)


async def test_state_read_by_stranger_is_404(manager_stub):
    """B 跨用户读 state/history ⇒ 404(此前可直接读走整图 checkpoint)。"""
    resp = await post_canvas_run(
        _req(_ALICE), CanvasRunRequest(dag=_DAG, thread_id="t-read")
    )
    assert resp["code"] == 0
    with pytest.raises(HTTPException) as exc:
        await lg.get_state("t-read", _req(_BOB))
    assert exc.value.status_code == 404
    with pytest.raises(HTTPException):
        await lg.get_history("t-read", _req(_BOB), limit=5)
    # 属主自己读得动(证明 404 来自归属闸,不是路由坏了)
    ok = await lg.get_state("t-read", _req(_ALICE))
    assert ok["code"] == 0
    remove_canvas_graph("t-read")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
