# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""多 worker × 知识图谱 file 档 = 数据静默丢失:启动期硬断言的正反成对回归。

立因(2026-09-27):`_create_graph_store()` 的默认档是 `FileGraphStore`(整表 JSON 快照、
写穿、**最后写者赢**)。部署一旦启多个 uvicorn worker,各进程的内存工作集会互相覆盖快照
⇒ 图数据静默丢失,而这条限制当时**只有注释、没有任何机器看护**。

本文件钉的是两件事,缺一都不算守住:
  * 判据有牙 —— 多 worker + file 必须**抛出**且消息点名 `drizzle`(只 log warning 不算,
    那等于把"拒绝启动"写成"启动后悄悄带病跑")。
  * 反向成立 —— 单 worker 不得误拦(否则开发机每次启动即红 = 恒红门,唯一结局是逼人绕过
    启动检查);`drizzle` 档在多 worker 下必须放过(它是这条断言给出的唯一修复出口,
    出口若也被堵死,这条门就成了死锁)。

零 DB / 零 Redis / 零网络:三种 store 一律被 monkeypatch 成哨兵对象,断言只看工厂的**选择**，
不触任何真实句柄;文件路径也不碰(`KNOWLEDGE_GRAPH_PATH` 另设到 tmp_path 作第二层保险)。
"""

from __future__ import annotations

import pytest

from app.services import knowledge_graph as kg


class _StubFileStore:
    """FileGraphStore 的哨兵替身:构造即成功,不碰磁盘。"""

    path = "<stub>"


class _StubDrizzleStore:
    """DrizzleGraphStore 的哨兵替身:不建 asyncpg 池(生产端口 8810 一律禁止连)。"""


class _StubMemoryStore:
    """InMemoryGraphStore 的哨兵替身。"""


@pytest.fixture(autouse=True)
def _no_real_backends(monkeypatch: pytest.MonkeyPatch) -> None:
    """把三个后端构造口全部换成哨兵 ⇒ 本文件结构上不可能触到 DB/网络/真实快照文件。"""
    monkeypatch.setattr(kg, "FileGraphStore", lambda *a, **k: _StubFileStore())
    monkeypatch.setattr(kg, "DrizzleGraphStore", lambda *a, **k: _StubDrizzleStore())
    monkeypatch.setattr(kg, "InMemoryGraphStore", lambda *a, **k: _StubMemoryStore())
    # 落盘路径即便被绕过替身也不会写到仓库里那张真表
    monkeypatch.setenv("KNOWLEDGE_GRAPH_PATH", "<must-not-be-used>")


def _set_worker_env(monkeypatch: pytest.MonkeyPatch, workers: str | None, store: str | None) -> None:
    """干净地设两个输入:None 表示"该变量缺席"(而不是空串 —— 两者来路不同)。"""
    monkeypatch.delenv(kg._WORKER_COUNT_ENV, raising=False)
    monkeypatch.delenv("KNOWLEDGE_GRAPH_STORE", raising=False)
    if workers is not None:
        monkeypatch.setenv(kg._WORKER_COUNT_ENV, workers)
    if store is not None:
        monkeypatch.setenv("KNOWLEDGE_GRAPH_STORE", store)


# ---------------------------------------------------------------------------
# ① 正例:多 worker + file ⇒ 抛错,且消息点名 drizzle
# ---------------------------------------------------------------------------


def test_multi_worker_with_file_backend_rejects_startup(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_worker_env(monkeypatch, "4", "file")

    with pytest.raises(RuntimeError) as raised:
        kg._create_graph_store()

    message = str(raised.value)
    assert "KNOWLEDGE_GRAPH_STORE=drizzle" in message, message
    assert "drizzle" in message
    assert "4" in message  # 必须把量到的 worker 数说出来,不能只喊"配错了"
    # 病灶也要写在同一句里:否则下一个人不知道为什么要切档
    assert "快照" in message


def test_multi_worker_with_unset_store_also_rejects_because_file_is_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """KNOWLEDGE_GRAPH_STORE 缺席时解析成默认档 file ⇒ 同样在射程内。

    这一条是本门的**主要价值**:默认档 + 没人配过 = 爆炸半径最大的形态。只判"显式写了
    file"的门,对真实事故场景结构上看不见。
    """
    _set_worker_env(monkeypatch, "2", None)

    with pytest.raises(RuntimeError) as raised:
        kg._create_graph_store()
    assert "KNOWLEDGE_GRAPH_STORE=drizzle" in str(raised.value)


def test_unknown_store_value_falling_back_to_file_is_still_guarded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """非法值会被回落到 file;判的是**解析后**的档,不是原始环境变量。"""
    _set_worker_env(monkeypatch, "3", "postgres-typo")

    with pytest.raises(RuntimeError):
        kg._create_graph_store()


# ---------------------------------------------------------------------------
# ② 反例:单 worker 不得误拦(恒红门防线)
# ---------------------------------------------------------------------------


def test_single_worker_with_file_backend_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_worker_env(monkeypatch, "1", "file")

    store = kg._create_graph_store()

    assert isinstance(store, _StubFileStore)


def test_absent_worker_env_with_file_backend_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    """WEB_CONCURRENCY 缺席是本仓现状(所有启动链路都不带 worker 数)⇒ 必须放过。

    若把"观测不到"当成"多 worker",开发机每次 `uvicorn app.main:app` 都起不来。
    """
    _set_worker_env(monkeypatch, None, "file")

    assert isinstance(kg._create_graph_store(), _StubFileStore)


# ---------------------------------------------------------------------------
# ③ 反例:多 worker + drizzle 必须放过(那是本断言给出的唯一修复出口)
# ---------------------------------------------------------------------------


def test_multi_worker_with_drizzle_backend_passes(monkeypatch: pytest.MonkeyPatch) -> None:
    _set_worker_env(monkeypatch, "8", "drizzle")

    store = kg._create_graph_store()

    assert isinstance(store, _StubDrizzleStore)


def test_multi_worker_with_memory_backend_is_out_of_scope_by_design(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """memory 档在多 worker 下同样不共享,但它是显式选择且自带降级告示 ⇒ 本门刻意不判。

    钉住这一条,是为了让"以后有人顺手把判据扩到 memory"必须**改掉这条断言**、
    而不是悄悄扩面(判据射程的变更要留下痕迹)。
    """
    _set_worker_env(monkeypatch, "4", "memory")

    assert isinstance(kg._create_graph_store(), _StubMemoryStore)


# ---------------------------------------------------------------------------
# ④ 观测面:量不到 ⇒ 不判(既不冒红也不记绿),且不得把坏值当"多 worker"
# ---------------------------------------------------------------------------


def test_unparseable_worker_env_is_undetermined_not_red(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """坏值归 uvicorn 自己的 `int()` 定罪;本函数只负责"量到了才算"。"""
    _set_worker_env(monkeypatch, "many", "file")

    assert kg._observable_worker_count() is None
    assert isinstance(kg._create_graph_store(), _StubFileStore)


def test_worker_count_signal_is_the_same_one_uvicorn_reads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """信号选型锁:唯一输入必须是 WEB_CONCURRENCY,不得漂到自造的第二个真相源。"""
    assert kg._WORKER_COUNT_ENV == "WEB_CONCURRENCY"
    _set_worker_env(monkeypatch, "0", None)
    assert kg._observable_worker_count() == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
