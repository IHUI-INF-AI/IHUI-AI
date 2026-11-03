# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""P0-7 云托管 Agent 会话存储(cloud_run_store)单元测试。

验证:start/complete 生命周期、JSON 文件落盘与重启恢复、列表分页与状态过滤。
"""

import json

from app.services.cloud_run_store import CloudRunStore


def test_start_complete_roundtrip(tmp_path):
    store = CloudRunStore(file_path=tmp_path / "cloud_runs.json")
    run = store.start(
        "写一个排序算法", agent_type="loop_v2", session_alias="sess-1", user_id="u1"
    )
    assert run.status == "running"
    assert run.started_at
    assert run.ended_at == ""

    store.complete(run.run_id, user_id="u1", status="done", output="def sort(): ...")
    got = store.get(run.run_id, user_id="u1")
    assert got is not None
    assert got.status == "done"
    assert got.output == "def sort(): ..."
    assert got.ended_at


def test_cross_owner_is_invisible_and_unwritable(tmp_path):
    """归属隔离(store 层):不是本人 ⇒ 读不到、改不动,且与"不存在"同形(不给枚举线索)。"""
    store = CloudRunStore(file_path=tmp_path / "cloud_runs.json")
    run = store.start("A 的任务", user_id="alice")

    assert store.get(run.run_id, user_id="bob") is None
    assert store.complete(run.run_id, user_id="bob", status="done", output="劫持") is None
    assert store.get(run.run_id, user_id="alice") is not None
    # 副作用没发生:bob 的改写没有落到 alice 的记录上
    assert store.get(run.run_id, user_id="alice").status == "running"
    # 正向对照:alice 自己改得动
    assert store.complete(run.run_id, user_id="alice", status="done") is not None

    store.start("B 的任务", user_id="bob")
    assert [r["user_id"] for r in store.list(user_id="alice")["list"]] == ["alice"]
    assert store.list(user_id="alice")["total"] == 1
    assert store.list(user_id="bob")["total"] == 1
    # 不存在的 owner 一律空集,不得把别人的记录带出来
    assert store.list(user_id="carol")["total"] == 0


def test_persist_to_json_and_reload(tmp_path):
    p = tmp_path / "cloud_runs.json"
    store = CloudRunStore(file_path=p)
    store.start("任务A", run_id="run-1", user_id="u1")
    store.start("任务B", run_id="run-2", user_id="u1")

    # 文件应已落盘
    persisted = json.loads(p.read_text(encoding="utf-8"))
    assert any(r["run_id"] == "run-1" for r in persisted)

    # 新实例(模拟进程重启)应能从文件恢复
    reloaded = CloudRunStore(file_path=p)
    assert reloaded.get("run-2", user_id="u1") is not None
    assert reloaded.get("run-missing", user_id="u1") is None


def test_list_pagination_and_status(tmp_path):
    store = CloudRunStore(file_path=tmp_path / "cloud_runs.json")
    for i in range(5):
        r = store.start(f"task-{i}", run_id=f"run-{i}", user_id="u1")
        store.complete(r.run_id, user_id="u1", status="error" if i % 2 else "done", output=f"out-{i}")

    data = store.list(user_id="u1", page=1, page_size=2, status="done")
    assert data["total"] == 3
    assert len(data["list"]) == 2
    assert all(r["status"] == "done" for r in data["list"])

    page2 = store.list(user_id="u1", page=2, page_size=2, status="done")
    assert len(page2["list"]) == 1
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
