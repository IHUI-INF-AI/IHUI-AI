# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #51 第二步:六类任务类型**真接线** + 逐类型幂等/断点续跑自证。

上一枚提交(`ab4fed16d50`)落了注册表框架,但门禁现读仍是
「声明面 8 类 · 广告面 2 类 · 在账未接线 6 类」——
即 6 类 executor 写好了却没有任何生产调用点能走到它们。本文件守的就是那一格:

1. **接线三面齐**:`task_executors` 注册(实现面)↔ `_tool_run_in_background`(生产调用点)
   ↔ `MCPTool` description/input_schema(模型可见的声明文字)。
2. **逐类型幂等**:每类各一条「重复提交命中同一条记录、执行器一次都没被多调」。
3. **逐类型断点续跑**:每类各一条「中断 → 恢复 → 终产物与一次跑完等价」,
   并且**已完成单元的业务副作用一次都不重复**(用真实计数器证,不是看框架字段)。

测试隔离(AGENTS §5):不碰生产 PostgreSQL/Redis;LLM/HTTP 只经 executor 既有的传输层
注入缝(`llm_call` / `http_get`);子进程类用 `sys.executable` 跑最小语句,产物一律落 tmp_path。
判据与聚合逻辑一行都不在本文件复制(§22c)——本文件只喂输入、读输出。
"""

from __future__ import annotations

import asyncio
import dataclasses
import json
import sys
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from app.services import mcp_server as ms
from app.services import task_executors as te
from app.services.background_tasks import (
    RUN_IN_BACKGROUND_TASK_TYPES,
    BackgroundTaskManager,
    TaskState,
)

REAL_TYPES = ("long_running_command", "test_suite", "code_index", "batch_llm", "web_batch", "patrol")

# 续跑等价性只对"真会跳过已完成单元"的类型成立;长跑命令按注册表声明 resumable=False,
# 它的等价性形态不同(整件重跑 ⇒ 终产物相同),单列一条测试,不混进参数表糊过去。
RESUMABLE_TYPES = ("test_suite", "code_index", "batch_llm", "web_batch", "patrol")

# 等价性比的是**业务终产物**(见 `_artifact`),不是整份返回体:
# 续跑那轮的 duration_ms / peak_inflight / reused_* 之类按定义就与一次跑完不同,
# 拿它们判"不等价"会判错对象;判"等价"更会把真没续上也看不出来。
async def _drain(manager: BackgroundTaskManager) -> None:
    """把在跑的协程句柄收干净(管理器没有 shutdown API —— 别凭空造一个)。"""
    pending = [h for h in list(manager._handles.values()) if not h.done()]  # noqa: SLF001
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)


def _uid() -> str:
    return uuid.uuid4().hex[:10]


def _tree(root: Path) -> Path:
    """三文件的小树(无空目录,避免 empty_dirs 判据受遍历截断影响)。"""
    pkg = root / "pkg"
    pkg.mkdir(parents=True, exist_ok=True)
    for name in ("a.py", "b.py", "c.py"):
        (pkg / name).write_text(f"def f_{name[0]}():\n    return 1\n", encoding="utf-8")
    return pkg


def _suite(root: Path) -> tuple[Path, Path]:
    """真 pytest 套件:每条用例往 marker 文件追一个字符 ⇒ 可直接量"跑了几遍"。"""
    marker = root / "marker.txt"
    test_file = root / "test_probe_51.py"
    test_file.write_text(
        "def test_one():\n"
        f"    open(r{str(marker)!r}, 'a', encoding='utf-8').write('x')\n"
        "    assert True\n",
        encoding="utf-8",
    )
    return test_file, marker


async def _wait_terminal(manager: BackgroundTaskManager, task_id: str, timeout: float = 90.0) -> dict[str, Any]:
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    status: dict[str, Any] = {}
    while loop.time() < deadline:
        got = await manager.get_status(task_id)
        assert got is not None, f"任务丢失: {task_id}"
        status = got
        if status["state"] in {"succeeded", "failed", "timeout", "cancelled"}:
            return status
        await asyncio.sleep(0.03)
    raise AssertionError(f"任务未在 {timeout}s 内进入终态: {task_id} ({status.get('state')})")


# ---------------------------------------------------------------------------
# 1. 接线三面齐
# ---------------------------------------------------------------------------


def test_mcp_server_no_longer_carries_its_own_task_whitelist() -> None:
    """第二个真相源必须真的不在(留着就是"字典还在、没人用"的假接线)。"""
    assert not hasattr(ms, "_BG_TASK_IMPLS"), "mcp_server 仍自带任务白名单 ⇒ 广告面与注册表分叉"


def test_tool_entry_reaches_every_real_executor(tmp_path: Path) -> None:
    """六类各从**生产工具入口**走通一次,并回真实业务结论(不是 executed:True 的空壳)。

    这是本票的主判据:上一轮「在账未接线 6 类」说的就是这条链断在 `_tool_run_in_background`
    —— 旧形态里 `batch_llm`/`web_batch`/`patrol`… 提交进来直接 `ok:False 未知后台任务类型`。

    离线可判的四类用**世界副作用**作证(标记文件 / 索引工件 / 巡检工件 / pytest 写下的字符);
    `batch_llm` 与 `web_batch` 刻意不发真外呼(那会把测试挂在网络与厂商配额上,AGENTS §5),
    只判"工具面到得了这两类、且落到注册表分派上"—— 它们**真做业务**的证据在
    `test_background_task_executors.py`(真 httpx 栈 + 真并发计数)与本文件逐类型续跑用例里。
    """
    from app.services.background_tasks import background_task_manager

    pkg = _tree(tmp_path)
    lrc_marker = tmp_path / "lrc.txt"
    idx_artifact = tmp_path / "index.json"
    patrol_artifact = tmp_path / "patrol.json"
    suite_file, suite_marker = _suite(tmp_path)

    offline: dict[str, dict[str, Any]] = {
        "long_running_command": {
            "command": [sys.executable, "-c", f"open(r{str(lrc_marker)!r},'a').write('wired')"],
            "timeout_s": 90,
        },
        "code_index": {"root": str(pkg), "max_files": 10, "output_path": str(idx_artifact)},
        "patrol": {
            "root": str(pkg), "checks": ["large_files", "todo_markers"],
            "output_path": str(patrol_artifact),
        },
        "test_suite": {
            "target": str(suite_file), "framework": "pytest",
            "cwd": str(tmp_path), "timeout_s": 180,
        },
    }
    assert set(offline) | {"batch_llm", "web_batch"} == set(REAL_TYPES)

    async def submit(task_type: str, args: dict[str, Any]) -> dict[str, Any]:
        key = f"wired-{task_type}-{_uid()}"
        ack = await ms._tool_run_in_background(
            {
                "task": task_type, "arguments": args, "notify_on_done": False,
                "timeout_s": 240, "idempotency_key": key,
            }
        )
        assert ack["ok"] is True, f"{task_type} 从工具入口提交失败:{ack}"
        assert ack["task_type"] == task_type
        assert ack["idempotency_key"] == key, "工具面必须把幂等键回出来(否则去重不可核验)"
        record = background_task_manager.find_by_idempotency_key(key)
        assert record is not None, f"{task_type} 没落到幂等登记表 ⇒ 没走 submit_typed"
        assert record["analysis_depth"] == "real" and record["stub"] is False
        return ack

    async def drive() -> None:
        for task_type, args in offline.items():
            ack = await submit(task_type, args)
            status = await _wait_terminal(background_task_manager, str(ack["task_id"]))
            assert status["state"] == TaskState.SUCCEEDED.value, f"{task_type}: {status}"
            assert status["executed"] is True, f"{task_type} 的 executor 没被真正调起"
        for task_type in ("batch_llm", "web_batch"):
            ack = await submit(task_type, {"items": ["p1"]} if task_type == "batch_llm" else {"urls": ["https://example.com/p51"]})
            # 立刻取消:这两类真跑要出网(§5 测试不得对外产生副作用),
            # 但取消发生在分派**之后** ⇒ 仍能证明工具面到得了它们。
            cancelled = await background_task_manager.cancel(str(ack["task_id"]))
            assert cancelled["ok"] is True
            await _wait_terminal(background_task_manager, str(ack["task_id"]))

        assert lrc_marker.read_text(encoding="utf-8") == "wired", "长跑命令没真派生进程"
        index = json.loads(idx_artifact.read_text(encoding="utf-8"))
        assert index["files_indexed"] == 3, index.get("files_indexed")
        assert len(index["index"]) == 3
        patrol = json.loads(patrol_artifact.read_text(encoding="utf-8"))
        assert isinstance(patrol["findings"], list) and patrol["verdict"] in {"ok", "warning", "critical"}
        assert suite_marker.read_text(encoding="utf-8") == "x", "pytest 没真的跑起来"

    asyncio.run(drive())


def test_unknown_type_from_tool_face_is_not_disguised_as_success() -> None:
    """未知类型经工具入口 ⇒ ok:False + 回全量可支持类型,绝不伪装成已执行。"""
    out = asyncio.run(ms._tool_run_in_background({"task": "no_such_task_51", "arguments": {}}))
    assert out["ok"] is False
    assert out["executed"] is False
    assert set(out["supported_task_types"]) == set(te.TASK_EXECUTORS)


def test_schema_advertises_every_registered_type_and_no_ghost() -> None:
    """模型可见的声明文字必须与注册表**双向**等值。

    旧形态 description 写死 "支持 sleep/echo" —— 六类接好了线,模型也发现不了,
    等于"接线了但没人能调"。现在这一段派生自注册表,本条判据就是它的直接反证面。
    """
    tool = next((t for t in ms._TOOLS if t.name == "run_in_background"), None)
    assert tool is not None
    text = tool.description + repr(tool.input_schema)
    for task_type in te.TASK_EXECUTORS:
        assert task_type in text, f"{task_type} 没进模型可见声明面 ⇒ 无法被发现"
    # 反向:声明文字里不得出现注册表没有的任务名(这条只能查已知幽灵词,不做自然语言解析)
    for ghost in ("sleep_forever", "run_anything"):
        assert ghost not in text


def test_advertised_list_is_derived_from_the_registry_alias() -> None:
    """声明面是**派生态**:注册表新增一类,不改 mcp_server 也会出现在广告文字里。"""
    derived = "/".join(RUN_IN_BACKGROUND_TASK_TYPES)
    assert derived in ms._bg_task_types_prose()
    assert set(RUN_IN_BACKGROUND_TASK_TYPES) == set(te.TASK_EXECUTORS)
    # 演示档必须仍然被广告出来(既有调用方还在用),但 stub 标记不能因此被洗白
    assert "sleep" in derived and "echo" in derived
    for stub in te.STUB_TASK_TYPES:
        assert te.TASK_EXECUTORS[stub].stub is True


def test_batch58_sleep_impl_and_registry_sleep_are_behaviourally_identical(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """保留的 `_bg_impl_sleep`(批58 测试宿主)与生产实现 `_exec_sleep` 必须同形。

    这两份实现同时存在是本票**如实登记的重复**(见 mcp_server 那段注释)。
    没有这条对照,重复就是静默漂移的温床;有了它,改一侧不改另一侧即红。
    """
    async def both() -> tuple[dict[str, Any], dict[str, Any]]:
        legacy = await ms._bg_impl_sleep({"seconds": 0})
        modern = await te.execute_task(
            "sleep", {"seconds": 0}, store=te.CheckpointStore(), checkpoint_key=f"eq-{_uid()}"
        )
        return legacy, modern

    monkeypatch.delenv("MCP_MODEL_TOOLS_ENABLED", raising=False)
    legacy, modern = asyncio.run(both())
    assert legacy["slept_seconds"] == modern["slept_seconds"] == 0
    assert modern["stub"] is True and modern["executed"] is False


# ---------------------------------------------------------------------------
# 2. 逐类型幂等:重复提交不重复执行
# ---------------------------------------------------------------------------


def _args_for(task_type: str, tmp_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    """返回 (arguments, seams)。seams 就是 executor 既有的传输层注入缝。"""
    if task_type == "long_running_command":
        marker = tmp_path / f"lrc-{_uid()}.txt"
        return (
            {
                "command": [sys.executable, "-c",
                            f"open(r{str(marker)!r},'a').write('run\\n'); import time; time.sleep(2)"],
                "timeout_s": 60,
            },
            {},
        )
    if task_type == "test_suite":
        test_file, _marker = _suite(tmp_path)
        return (
            {"target": str(test_file), "framework": "pytest", "cwd": str(tmp_path), "timeout_s": 120},
            {},
        )
    if task_type == "code_index":
        return ({"root": str(_tree(tmp_path)), "max_files": 10}, {})
    if task_type == "patrol":
        return ({"root": str(_tree(tmp_path)), "max_files": 50}, {})
    if task_type == "batch_llm":
        async def fake_llm(messages: list[dict[str, Any]], _m: str | None) -> dict[str, Any]:
            await asyncio.sleep(0.6)
            return {"content": f"out::{messages[0]['content']}"}

        return ({"items": ["i1", "i2", "i3"], "concurrency": 3}, {"llm_call": fake_llm})
    if task_type == "web_batch":
        async def fake_get(url: str, _t: float) -> tuple[int, str]:
            await asyncio.sleep(0.6)
            return 200, f"<title>{url}</title>"

        # 必须是**公网形态**的 URL:SSRF/出站策略在 transport 之前判,
        # 用 .invalid 之类会被护栏挡在发请求之前 ⇒ checkpoint 一格都不落 ⇒ "中断"无从谈起。
        tag = _uid()
        return ({"urls": [f"https://example.com/{tag}-a", f"https://example.org/{tag}-b"]},
                {"http_get": fake_get})
    raise AssertionError(f"未登记参数的类型:{task_type}")


@pytest.mark.parametrize("task_type", REAL_TYPES)
def test_duplicate_submit_hits_one_record_and_never_reexecutes(
    task_type: str, tmp_path: Path
) -> None:
    """每类各一条:同一幂等键的两次提交 ⇒ 同一条记录、真实执行体一次都没被多调。"""
    args, seams = _args_for(task_type, tmp_path)
    calls: list[str] = []
    spec = te.get_spec(task_type)
    real_run = spec.run

    async def counted(ctx: te.TaskContext) -> dict[str, Any]:
        calls.append(ctx.task_id)
        return await real_run(ctx)

    monkeypatched = dataclasses.replace(spec, run=counted)

    async def drive() -> None:
        manager = BackgroundTaskManager()
        key = f"dedup-{task_type}-{_uid()}"
        try:
            first = await manager.submit_typed(
                task_type, args, name=task_type, user_id=None,
                notify_on_done=False, timeout_s=180, idempotency_key=key, **seams,
            )
            assert first["ok"] is True and first["deduplicated"] is False
            second = await manager.submit_typed(
                task_type, args, name=task_type, user_id=None,
                notify_on_done=False, timeout_s=180, idempotency_key=key, **seams,
            )
            assert second["deduplicated"] is True, second
            assert second["task_id"] == first["task_id"], "两次提交必须命中同一条记录"
            await _wait_terminal(manager, str(first["task_id"]))
            assert len(calls) == 1, f"{task_type} 的 executor 被跑了 {len(calls)} 次(应为 1)"
        finally:
            await _drain(manager)

    with monkeypatch_session_spec(task_type, monkeypatched):
        asyncio.run(drive())


class monkeypatch_session_spec:
    """临时把注册表里某一条换成计数版(生产 `get_spec` 运行时读字典,所以生效)。"""

    def __init__(self, task_type: str, spec: te.ExecutorSpec) -> None:
        self.task_type = task_type
        self.spec = spec

    def __enter__(self) -> None:
        te.TASK_EXECUTORS[self.task_type] = self.spec

    def __exit__(self, *_exc: object) -> None:
        te.TASK_EXECUTORS[self.task_type] = te.get_original_spec(self.task_type)


# ---------------------------------------------------------------------------
# 3. 逐类型断点续跑:恢复后的**终产物**与一次跑完等价
# ---------------------------------------------------------------------------

# 造成"真做了一半"的旋钮:把一次任务的第一轮限制成一个单元。
# 刻意不用 sleep/计时器去掐断 —— 那测到的是调度时序,不是续跑语义。
_SPLIT_KNOB: dict[str, dict[str, Any]] = {
    "code_index": {"max_files": 1},
    "patrol": {"max_files": 1},
}


def _artifact(task_type: str, result: dict[str, Any]) -> Any:
    """取**业务终产物**做等价比对(而不是整份返回体)。

    为什么不直接比 dict:续跑那轮的运行期计量(`succeeded` / `peak_inflight` /
    `reused_from_checkpoint` / `duration_ms`)按定义就和一次跑完不同 —— 拿它们判"不等价"
    等于判错了对象。等价的是**这件事做完之后的世界是什么样**。
    """
    if task_type == "batch_llm":
        return sorted(
            (int(r["index"]), str(r.get("output"))) for r in result["results"] if isinstance(r, dict)
        )
    if task_type == "web_batch":
        return sorted(
            (int(r["index"]), str(r.get("title")), int(r.get("status", 0)))
            for r in result["results"] if isinstance(r, dict)
        )
    if task_type == "code_index":
        return (
            result["files_indexed"], result["chunks_total"], result["symbols_total"],
            result["merkle_root"],
        )
    if task_type == "patrol":
        return (
            sorted((f["check"], f["path"], f["severity"]) for f in result["findings"]),
            result["verdict"], dict(sorted(result["findings_by_check"].items())), result["unreadable"],
        )
    if task_type == "test_suite":
        return (dict(sorted(result["counts"].items())), sorted(result["failures"]))
    raise AssertionError(f"未登记业务产物的类型:{task_type}")


@pytest.mark.parametrize("task_type", RESUMABLE_TYPES)
def test_resumed_run_is_equivalent_to_single_pass(task_type: str, tmp_path: Path) -> None:
    """每类各一条:中断 → 恢复 ⇒ 已完成单元不重跑,且终产物与一次跑完等价。"""
    args, seams = _args_for(task_type, tmp_path)
    if task_type in ("batch_llm", "web_batch"):
        # 并发=1 才谈得上"跑到第 k 个被中断";并发>1 时取消点落在谁身上是时序问题,不是续跑语义
        args = {**args, "concurrency": 1}
    effects = {"business": 0, "procs": 0}
    seams = _counting_seams(task_type, seams, effects)

    async def drive() -> dict[str, Any]:
        store = te.CheckpointStore()
        single = await te.execute_task(
            task_type, args, store=store, checkpoint_key=f"single-{task_type}-{_uid()}",
            task_id=f"s-{_uid()}", **seams,
        )
        # 一次跑完那轮的业务动作数,和分两段跑用**同一个计数器**量 —— 不从返回体反推
        effects["single_business"] = effects["business"]

        split_key = f"split-{task_type}-{_uid()}"
        business_before_phase1 = effects["business"]
        cancel_event: asyncio.Event | None = None
        phase1_args = args
        phase1_seams = seams
        if task_type in ("batch_llm", "web_batch"):
            cancel_event = asyncio.Event()
            phase1_seams = _cancelling_seams(task_type, cancel_event, 1, effects)
            first = await te.execute_task(
                task_type, phase1_args, store=store, checkpoint_key=split_key,
                task_id=f"p1-{_uid()}", cancel_event=cancel_event, **phase1_seams,
            )
        elif task_type in _SPLIT_KNOB:
            phase1_args = {**args, **_SPLIT_KNOB[task_type]}
            first = await te.execute_task(
                task_type, phase1_args, store=store, checkpoint_key=split_key,
                task_id=f"p1-{_uid()}", **seams,
            )
        else:  # test_suite:整套 = 一个单元,第一轮把它做完
            first = await te.execute_task(
                task_type, args, store=store, checkpoint_key=split_key,
                task_id=f"p1-{_uid()}", **seams,
            )
        phase1_business = effects["business"] - business_before_phase1

        procs_before = effects["procs"]
        resumed = await te.execute_task(
            task_type, args, store=store, checkpoint_key=split_key,
            task_id=f"p2-{_uid()}", **seams,
        )
        effects["phase2_procs"] = effects["procs"] - procs_before
        effects["phase1_business"] = phase1_business
        effects["split_total_business"] = effects["business"] - business_before_phase1
        return {"single": single, "first": first, "resumed": resumed}

    out = asyncio.run(_with_proc_counter(task_type, effects, drive))
    single, first, resumed = out["single"], out["first"], out["resumed"]

    assert _artifact(task_type, single) == _artifact(task_type, resumed), (
        f"{task_type} 续跑终产物与一次跑完不等价:\n一次跑完={_artifact(task_type, single)}"
        f"\n分两段跑={_artifact(task_type, resumed)}"
    )
    assert resumed["checkpoint_completed_units"] == single["checkpoint_completed_units"], (
        f"{task_type} 续跑后已完成单元数应与一次跑完相等(多了=重跑,少了=没接上)"
    )
    assert resumed["executed"] is True and resumed["stub"] is False

    if task_type in ("code_index", "patrol"):
        assert first["checkpoint_completed_units"] < single["checkpoint_completed_units"], (
            "第一轮必须真的只做了一部分,否则这条续跑断言什么都没测到"
        )
        assert resumed["files_reused_from_checkpoint"] >= 1, (
            f"{task_type} 续跑没有复用任何已完成单元 ⇒ 断点续跑是装饰性的"
        )
    if task_type in ("batch_llm", "web_batch"):
        assert first["checkpoint_completed_units"] >= 1
        assert first["checkpoint_completed_units"] < single["checkpoint_completed_units"], (
            "取消没有真的停在中间 ⇒ 这一轮不构成'中断'"
        )
        # 业务调用总数:分两段跑 == 一次跑完 ⇒ 没有任何一个单元被执行两次
        assert effects["split_total_business"] == effects["single_business"], (
            f"{task_type} 分两段共调用业务 {effects['split_total_business']} 次,"
            f"一次跑完是 {effects['single_business']} 次 ⇒ 已完成单元被重跑"
        )
    if task_type == "test_suite":
        assert effects["phase2_procs"] == 0, (
            f"续跑又起了 {effects['phase2_procs']} 次子进程 ⇒ test_suite 的断点续跑是装饰性的"
        )
        assert resumed["reused_from_checkpoint"] is True
        assert effects["split_total_business"] == effects["single_business"]


def _counting_seams(
    task_type: str, seams: dict[str, Any], effects: dict[str, int]
) -> dict[str, Any]:
    """把注入缝包一层计数器 —— 判"单元有没有被重跑"要有可数的量,不能只看框架字段。"""
    if task_type == "batch_llm":
        inner = seams["llm_call"]

        async def counted(messages: list[dict[str, Any]], model: str | None) -> dict[str, Any]:
            effects["business"] += 1
            return await inner(messages, model)

        return {**seams, "llm_call": counted}
    if task_type == "web_batch":
        inner_get = seams["http_get"]

        async def counted_get(url: str, timeout_s: float) -> tuple[int, str]:
            effects["business"] += 1
            return await inner_get(url, timeout_s)

        return {**seams, "http_get": counted_get}
    if task_type == "test_suite":
        return seams
    # code_index / patrol 的重跑证据来自 executor 自己的 files_reused_from_checkpoint,
    # 那里已是"这一轮跳过了几个已完成单元"的直接读数,不再叠第二层计数器。
    return seams


def _cancelling_seams(
    task_type: str, cancel: asyncio.Event, after: int, effects: dict[str, int]
) -> dict[str, Any]:
    """跑满 `after` 个单元后置取消信号 ⇒ 第一档真的停在中途。"""

    async def fake_llm(messages: list[dict[str, Any]], _m: str | None) -> dict[str, Any]:
        effects["business"] += 1
        if effects["business"] >= after:
            cancel.set()
        return {"content": f"out::{messages[0]['content']}"}

    async def fake_get(url: str, _t: float) -> tuple[int, str]:
        effects["business"] += 1
        if effects["business"] >= after:
            cancel.set()
        return 200, f"<title>{url}</title>"

    return {"llm_call": fake_llm} if task_type == "batch_llm" else {"http_get": fake_get}


async def _with_proc_counter(
    task_type: str, effects: dict[str, int], body: Callable[[], Any]
) -> Any:
    """test_suite 的唯一外部副作用是派生 pytest 子进程,把它数出来。"""
    if task_type != "test_suite":
        return await body()
    original = te.run_command

    async def counted(*a: Any, **k: Any) -> Any:
        effects["procs"] += 1
        return await original(*a, **k)

    te.run_command = counted  # type: ignore[misc]
    try:
        return await body()
    finally:
        te.run_command = original  # type: ignore[misc]


def test_long_running_command_is_declared_non_resumable_and_still_converges(
    tmp_path: Path,
) -> None:
    """长跑命令按声明**不可续跑**:取消后再提交必须整件重跑并回到同样的终产物。

    单列一条而不是塞进上面那张参数表,是因为它的"等价"含义不同 ——
    续跑等价 = 不重做已完成单元;不可续跑的等价 = 重做但结论一致。
    把两者混在一个参数表里,就等于用一条断言同时宣称两种语义。
    """
    marker = tmp_path / "lrc.txt"
    args = {
        "command": [sys.executable, "-c", f"open(r{str(marker)!r},'a').write('x')"],
        "timeout_s": 60,
    }
    spec = te.get_spec("long_running_command")
    assert spec.resumable is False

    async def drive() -> None:
        manager = BackgroundTaskManager()
        key = f"lrc-{_uid()}"
        first = await manager.submit_typed(
            "long_running_command", args, name="取消它", user_id=None,
            notify_on_done=False, idempotency_key=key,
        )
        await _wait_terminal(manager, str(first["task_id"]))
        cancelled = await manager.cancel(str(first["task_id"]))
        assert cancelled["ok"] is True
        again = await manager.submit_typed(
            "long_running_command", args, name="取消它", user_id=None,
            notify_on_done=False, idempotency_key=key,
        )
        assert again["task_id"] == first["task_id"] and again["resumed"] is True
        final = await _wait_terminal(manager, str(first["task_id"]))
        assert final["state"] == TaskState.SUCCEEDED.value
        assert final["attempt_count"] == 2
        # `record.result` 是被截断成字符串的摘要(见 `_summarize`),不是字典 ——
        # 所以"真跑了"要读 record 上的自证位,不能去 index 一个字符串。
        assert final["executed"] is True and final["analysis_depth"] == "real"
        assert marker.read_text(encoding="utf-8") == "xx", "整件重跑 ⇒ 副作用发生两次(不可续跑的诚实形态)"
        await _drain(manager)

    asyncio.run(drive())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
