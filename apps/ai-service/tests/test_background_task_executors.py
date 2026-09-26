# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #51 判据 1/2:`run_in_background` 的 6 类 executor 必须**真跑**,不得回显冒充。

覆盖:
1. long_running_command —— 真起子进程、捕获真实输出、超时/取消真 kill、输出上限截断自证
2. test_suite —— 真跑 pytest(嵌套子进程),回真实计数与失败 node id
3. code_index —— 真遍历并产出索引结构与工件文件
4. batch_llm —— 真并发、并发上限、逐项失败隔离
5. web_batch —— SSRF/策略前置拒绝;`_default_http_get` 真走 httpx 栈(MockTransport 只换 socket)
6. patrol —— 真实遍历 + 阈值判据 + verdict
外加:sleep/echo 必须自证 stub;未知类型必须 ok:False;任何 executor 不得碰生产库出口。

测试隔离(AGENTS §5):本文件不建任何 DB/Redis 连接;`test_no_executor_reaches_shared_db_pool`
把 `app.core.db_pool.get_shared_pool` 钉成"一调就炸",作为回归锁而非当轮侥幸。
"""

from __future__ import annotations

import asyncio
import json
import sys
import uuid
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.api import dag as dag_module  # noqa: F401  (确保 dag 面已装载)
from app.core import db_pool
from app.services import task_executors as te


def _uid() -> str:
    return uuid.uuid4().hex[:12]


async def _wait_terminal(manager: Any, task_id: str, timeout: float = 15.0) -> dict[str, Any]:
    terminal = {"succeeded", "failed", "timeout", "cancelled"}
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout
    while loop.time() < deadline:
        status = await manager.get_status(task_id)
        assert status is not None, f"任务丢失: {task_id}"
        if status["state"] in terminal:
            return status
        await asyncio.sleep(0.02)
    raise AssertionError(f"任务未在 {timeout}s 内进入终态: {task_id} ({status['state']})")


# ---------------------------------------------------------------------------
# 1. 长跑命令
# ---------------------------------------------------------------------------


async def test_long_running_command_really_spawns_process_and_captures_output(
    tmp_path: Path,
) -> None:
    """真起子进程:stdout 是子进程打出来的,不是入参回显。"""
    store = te.CheckpointStore()
    result = await te.execute_task(
        "long_running_command",
        {"command": [sys.executable, "-c", "print('V351-REAL-STDOUT')"]},
        store=store,
        task_id=f"cmd-{_uid()}",
    )
    assert result["executed"] is True
    assert result["stub"] is False
    assert result["analysis_depth"] == "real"
    assert result["ok"] is True
    assert result["exit_code"] == 0
    assert "V351-REAL-STDOUT" in result["stdout"]
    assert result["stdout_truncated"] is False
    assert (tmp_path / "never-written").exists() is False


async def test_long_running_command_reports_truncation_and_total_bytes() -> None:
    """输出超过上限时:只留前缀,但必须报真实总字节数并置 truncated。"""
    result = await te.execute_task(
        "long_running_command",
        {
            "command": [
                sys.executable, "-c",
                "import sys; sys.stdout.write('Z' * 200000)",
            ],
            "max_output_bytes": 2048,
        },
        store=te.CheckpointStore(),
        task_id=f"cmd-trunc-{_uid()}",
    )
    assert result["ok"] is True
    assert result["stdout_truncated"] is True
    assert len(result["stdout"]) == 2048
    assert result["stdout_bytes"] == 200000, "总字节数必须如实上报,不能与被截断的长度串成一格"


async def test_long_running_command_timeout_is_honest_and_kills_process() -> None:
    """超时不得被写成成功:timed_out=True + ok=False,且子进程真的被 kill。"""
    result = await te.execute_task(
        "long_running_command",
        {
            "command": [
                sys.executable, "-c",
                "import time; time.sleep(60)",
            ],
            "timeout_s": 2,
        },
        store=te.CheckpointStore(),
        task_id=f"cmd-to-{_uid()}",
    )
    assert result["timed_out"] is True
    assert result["ok"] is False
    assert result["executed"] is True


async def test_manager_cancel_kills_running_process_record() -> None:
    """cancel():置协作信号 + 杀子进程 + 记录进入 cancelled 终态(判据 1 的可取消性)。"""
    from app.services.background_tasks import background_task_manager

    ack = await background_task_manager.submit_typed(
        "long_running_command",
        {"command": [sys.executable, "-c", "import time; time.sleep(60)"], "timeout_s": 60},
        name="cancel-me",
        user_id=None,
        notify_on_done=False,
        idempotency_key=f"cancel-{_uid()}",
    )
    assert ack["ok"] is True
    await asyncio.sleep(0.6)
    cancelled = await background_task_manager.cancel(ack["task_id"])
    assert cancelled["ok"] is True
    status = await _wait_terminal(background_task_manager, ack["task_id"], timeout=15.0)
    assert status["state"] == "cancelled"
    assert status["executed"] is True, "确实起过进程 —— 被取消不等于没跑过"


# ---------------------------------------------------------------------------
# 2. 测试套
# ---------------------------------------------------------------------------


async def test_test_suite_reports_real_counts_and_failure_detail(tmp_path: Path) -> None:
    """真跑嵌套 pytest:计数与被生成的用例数逐一对上,并点名失败用例。"""
    (tmp_path / "test_v351_pass.py").write_text(
        "def test_one():\n    assert True\n\n\ndef test_two():\n    assert True\n",
        encoding="utf-8",
    )
    (tmp_path / "test_v351_fail.py").write_text(
        "def test_broken():\n    assert 1 == 2\n", encoding="utf-8"
    )
    result = await te.execute_task(
        "test_suite",
        {"target": str(tmp_path), "framework": "pytest", "cwd": str(tmp_path), "timeout_s": 240},
        store=te.CheckpointStore(),
        task_id=f"suite-{_uid()}",
    )
    assert result["executed"] is True
    assert result["framework"] == "pytest"
    assert result["collected_any_test"] is True
    assert result["counts"]["passed"] == 2
    assert result["counts"]["failed"] == 1
    assert any("test_v351_fail.py::test_broken" in f for f in result["failures"])
    # 有用例失败 ⇒ 任务本身不得被冒充成 ok
    assert result["ok"] is False


def test_test_suite_parsers_are_pure_and_shape_exact() -> None:
    """解析器是 executor 的一部分,不复制到测试里:这里只喂真版式文本验形状。"""
    counts = te.parse_pytest_output("= 1 failed, 3 passed, 2 skipped, 1 error in 0.42s =")
    assert counts == {"passed": 3, "failed": 1, "error": 1, "skipped": 2}
    failures = te.parse_pytest_failures(
        "FAILED a.py::test_x - assert 1 == 2\nERROR b.py::test_y - boom\n正常一行"
    )
    assert failures == ["a.py::test_x", "b.py::test_y"]
    vcounts, vfail = te.parse_vitest_report(
        {
            "numTotalTests": 3,
            "numPassedTests": 2,
            "numFailedTests": 1,
            "testResults": [
                {
                    "name": "x.test.ts",
                    "assertionResults": [
                        {"status": "passed", "fullName": "a b"},
                        {"status": "failed", "fullName": "a c"},
                    ],
                }
            ],
        }
    )
    assert vcounts["passed"] == 2 and vcounts["failed"] == 1
    assert vfail == ["a c"]


# ---------------------------------------------------------------------------
# 3. 代码索引
# ---------------------------------------------------------------------------


async def test_code_index_traverses_for_real_and_writes_artifact(tmp_path: Path) -> None:
    """真遍历 + 真切片:索引条目、符号、merkle 根、工件文件都得有。"""
    src = tmp_path / "src"
    src.mkdir()
    (src / "mod_a.py").write_text("def alpha():\n    return 1\n\n\nclass Beta:\n    pass\n", encoding="utf-8")
    (src / "mod_b.ts").write_text("export function gamma(): number { return 2 }\n", encoding="utf-8")
    (src / "asset.bin").write_bytes(b"\x00\x01")
    artifact = tmp_path / "out" / "index.json"

    result = await te.execute_task(
        "code_index",
        {"root": str(src), "max_files": 50, "output_path": str(artifact)},
        store=te.CheckpointStore(),
        checkpoint_key=f"idx-{_uid()}",
        task_id=f"idx-{_uid()}",
    )
    assert result["executed"] is True
    assert result["files_scanned"] == 2, "非代码后缀不得被算进扫描面"
    assert result["files_indexed"] == 2
    assert result["chunks_total"] >= 2
    assert len(result["merkle_root"]) == 64
    assert artifact.is_file()
    body = json.loads(artifact.read_text(encoding="utf-8"))
    assert set(body["index"].keys()) == {"mod_a.py", "mod_b.ts"}
    assert body["index"]["mod_a.py"]["symbols"], "符号位必须真从切片里来,不能是空壳"


# ---------------------------------------------------------------------------
# 4. 批量 LLM
# ---------------------------------------------------------------------------


async def test_batch_llm_caps_concurrency_and_isolates_failures() -> None:
    """并发上限真被压住,单项异常只进 failures,不炸整批。"""
    state = {"inflight": 0, "peak": 0, "calls": 0}

    async def fake_llm(messages: list[dict[str, Any]], model: str | None) -> dict[str, Any]:
        state["calls"] += 1
        state["inflight"] += 1
        state["peak"] = max(state["peak"], state["inflight"])
        try:
            await asyncio.sleep(0.05)
        finally:
            state["inflight"] -= 1
        prompt = str(messages[0]["content"])
        if "bad" in prompt:
            raise RuntimeError("上游 500")
        if "errmap" in prompt:
            return {"error": "provider 返回 error 字段"}
        return {"content": f"ok::{prompt[:8]}"}

    result = await te.execute_task(
        "batch_llm",
        {"items": ["a1", "bad", "a3", "errmap", "a5"], "concurrency": 2},
        store=te.CheckpointStore(),
        task_id=f"llm-{_uid()}",
        llm_call=fake_llm,
    )
    assert result["executed"] is True
    assert result["requested"] == 5
    assert result["succeeded"] == 3
    assert result["failed"] == 2, "异常项与 error 字段项都要被隔离计入 failed"
    assert {f["index"] for f in result["failures"]} == {1, 3}
    assert state["calls"] == 5
    assert state["peak"] <= 2, "并发上限必须真的压住"
    assert result["concurrency_respected"] is True
    assert result["ok"] is False, "有失败项时不得报整体 ok"


# ---------------------------------------------------------------------------
# 5. 网页批处理
# ---------------------------------------------------------------------------


async def test_web_batch_blocks_private_and_bad_scheme_before_request() -> None:
    """内网/回环/坏协议必须在**发请求之前**被拒(判据:fake transport 一次都没被调到)。"""
    called: list[str] = []

    async def fake_get(url: str, timeout_s: float) -> tuple[int, str]:
        called.append(url)
        return 200, "<title>x</title>"

    result = await te.execute_task(
        "web_batch",
        {"urls": ["http://127.0.0.1:8801/api/x", "http://192.168.1.1/", "file:///etc/passwd"]},
        store=te.CheckpointStore(),
        task_id=f"web-{_uid()}",
        http_get=fake_get,
    )
    assert called == [], "SSRF 护栏必须在 transport 之前,否则护栏只是装饰"
    assert result["ssrf_or_policy_blocked"] == 3
    assert result["requested"] == 3
    assert result["ok"] is False
    assert result["executed"] is True


async def test_web_batch_fetches_public_url_through_real_httpx_stack(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """不注入 http_get ⇒ 真走 `_default_http_get` + 共享 client(仅 socket 被 MockTransport 替换)。"""
    import app.core.llm_gateway as gateway_mod

    seen: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(str(request.url))
        return httpx.Response(200, text="<html><head><title>IHUI 真响应</title></head><body>hi</body></html>")

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    def fake_get_http_client() -> httpx.AsyncClient:
        return client

    monkeypatch.setattr(gateway_mod, "get_http_client", fake_get_http_client)

    result = await te.execute_task(
        "web_batch",
        {"urls": ["https://example.com/"], "max_bytes": 4096},
        store=te.CheckpointStore(),
        task_id=f"web-real-{_uid()}",
    )
    await client.aclose()
    assert seen == ["https://example.com/"], "请求必须真从生产 transport 函数里发出"
    assert result["succeeded"] == 1
    entry = result["results"][0]
    assert entry["status"] == 200
    assert entry["title"] == "IHUI 真响应"
    assert entry["bytes"] == len("<html><head><title>IHUI 真响应</title></head><body>hi</body></html>".encode())


# ---------------------------------------------------------------------------
# 6. patrol
# ---------------------------------------------------------------------------


async def test_patrol_walks_judges_and_emits_verdict(tmp_path: Path) -> None:
    """巡检真实跑判据:大文件/空目录/TODO 聚集都要被点名,verdict 由 finding 严重度推出。"""
    (tmp_path / "big.dat").write_bytes(b"x" * (3 * 1024 * 1024))
    (tmp_path / "todo_heavy.py").write_text(
        "# TODO a\n# TODO b\n# TODO c\n", encoding="utf-8"
    )
    (tmp_path / "quiet.py").write_text("print(1)\n", encoding="utf-8")
    (tmp_path / "vacant").mkdir()

    result = await te.execute_task(
        "patrol",
        {
            "root": str(tmp_path),
            "max_file_bytes": 1024 * 1024,
            "max_todo_per_file": 3,
        },
        store=te.CheckpointStore(),
        task_id=f"patrol-{_uid()}",
    )
    assert result["executed"] is True
    assert result["files_scanned"] == 3
    by_path = {f["path"]: f for f in result["findings"]}
    assert "big.dat" in by_path and by_path["big.dat"]["check"] == "large_files"
    assert "todo_heavy.py" in by_path and by_path["todo_heavy.py"]["check"] == "todo_markers"
    assert "vacant" in by_path and by_path["vacant"]["check"] == "empty_dirs"
    assert "quiet.py" not in by_path
    assert result["verdict"] == "warning"
    assert result["findings_by_check"]["large_files"] == 1


async def test_patrol_rejects_unknown_check_instead_of_silently_passing(
    tmp_path: Path,
) -> None:
    with pytest.raises(te.TaskExecutionError):
        await te.execute_task("patrol", {"root": str(tmp_path), "checks": ["not_a_check"]})


# ---------------------------------------------------------------------------
# 分派面:stub 自证 / 未知类型 / 不碰生产库
# ---------------------------------------------------------------------------


async def test_sleep_and_echo_self_prove_stub_not_real(tmp_path: Path) -> None:
    """sleep/echo 保留为演示档,但必须自证 stub=True、executed=False。"""
    store = te.CheckpointStore()
    a = await te.execute_task("sleep", {"seconds": 0.01}, store=store, task_id=f"sl-{_uid()}")
    b = await te.execute_task("echo", {"message": "hi"}, store=store, task_id=f"ec-{_uid()}")
    assert a["stub"] is True and a["executed"] is False and a["analysis_depth"] == "stub"
    assert b["stub"] is True and b["executed"] is False
    assert b["echo"] == "hi"


async def test_unknown_task_type_is_not_disguised_as_success() -> None:
    """未知类型:工具面必须回 ok:False + analysis_depth:none,并给出可用清单。"""
    from app.services.background_tasks import run_in_background

    result = await run_in_background({"task": "definitely_not_a_task", "arguments": {}})
    assert result["ok"] is False
    assert result["executed"] is False
    assert result["analysis_depth"] == "none"
    assert "batch_llm" in result["supported_task_types"]


async def test_registry_literal_and_dispatch_table_cannot_drift() -> None:
    """`run_in_background` 的分派表必须覆盖声明面全集(门禁的运行时对偶)。"""
    from app.services.background_tasks import RUN_IN_BACKGROUND_TASK_TYPES

    assert set(RUN_IN_BACKGROUND_TASK_TYPES) == set(te.TASK_EXECUTORS)
    for declared in RUN_IN_BACKGROUND_TASK_TYPES:
        spec = te.get_spec(declared)
        assert spec.stub is (declared in te.STUB_TASK_TYPES)


async def test_no_executor_reaches_shared_db_pool(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """回归锁(AGENTS §5):任何 executor 走真实分派时都不得碰生产连接池出口。"""

    def _boom(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("executor 不得触碰 app.core.db_pool.get_shared_pool(生产库)")

    monkeypatch.setattr(db_pool, "get_shared_pool", _boom)
    (tmp_path / "a.py").write_text("def f():\n    return 1\n", encoding="utf-8")
    for task_type, args in (
        ("long_running_command", {"command": [sys.executable, "-c", "print(1)"]}),
        ("code_index", {"root": str(tmp_path)}),
        ("patrol", {"root": str(tmp_path)}),
    ):
        out = await te.execute_task(task_type, args, store=te.CheckpointStore(), task_id=f"db-{_uid()}")
        assert out["executed"] is True


def test_worker_pool_default_executor_has_no_echo_return_literal() -> None:
    """反证(判据 5):默认 executor 的**代码面**不得再有 echo 返回字面量。

    刻意走 AST 而不是子串匹配:该函数自己的 docstring 里就写着旧形态
    `{"echo": payload}` 作为病因说明 —— 按文本判会把"解释缺陷的散文"判成缺陷本身
    (与本仓守门 70 的 URL 假注释态、守门 131 的"注释里的形态不得计入"同一条教训)。
    """
    import ast
    import inspect

    from app.services import dag_scheduler

    tree = ast.parse(inspect.getsource(dag_scheduler._default_executor))
    echoed: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Return) and isinstance(node.value, ast.Dict):
            for key in node.value.keys:
                if isinstance(key, ast.Constant) and key.value == "echo":
                    echoed.append(ast.get_source_segment("x", node) or "echo-return")
    assert echoed == [], f"默认 executor 仍在回显: {echoed}"

    src = inspect.getsource(dag_scheduler._default_executor)
    assert "execute_for_kanban" in src, "必须走 task_executors 的共用分派出口"
    assert dag_module is not None  # dag 面可导入
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
