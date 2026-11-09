# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""Z19 装车证明:阶段化遥测(T9 §10 #3)真的接在 search_codebase 的链路上。

钉的是**行为与形状**,不是文案:① 正常路径出满六段、序固定、结论词全在在册词表内;
② 跳过段是显式 `skipped` 而非缺项(票面原话);③ 没走到的段是显式 `unjudged`,同样不缺项
(§0.3「没判」绝不写成"判过");④ 一腿炸 ⇒ 那一段点名 failed 且带原因(不留"只有日志里
看得见"的降级);⑤ 每段恰好一条可 grep 的结构化结论行(`[stage_result]` 锚点);⑥ 量不到
时钟 ⇒ `duration_ms` 渲染 `unjudged`,**绝不用 0 冒充 0ms**,且不进直方图;⑦ 单源锁:
消费方不自立段清单/词表,遥测模块不自行 register metric(声明只在 `_init_metrics`)。

隔离口径(AGENTS §5):PG 8810 / Redis 8811 一律不碰 —— 语义腿与懒索引全走替身。
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services import mcp_server, stage_telemetry
from app.services.codebase_indexer import SymbolFilterUndetermined
from app.services.mcp_server import _tool_search_codebase
from app.services.stage_telemetry import (
    SEARCH_CODEBASE_STAGES,
    STAGE_LOG_EVENT,
    STAGE_RESULTS,
    StageRecorder,
    stages_of,
)
from app.services.telemetry_service import telemetry_service

_QUERY = "alpha_symbol_zz"


@pytest.fixture(autouse=True)
def _tmp_path_is_workspace_root(monkeypatch, tmp_path):
    """AIS-080:search 入口现在过工作区白名单;本模块用 tmp_path 造树,登记为根。"""
    real = mcp_server._get_workspace_roots
    monkeypatch.setattr(
        mcp_server,
        "_get_workspace_roots",
        lambda: [str(tmp_path.resolve()), *real()],
    )

_LINE_RE = re.compile(rf"\[{STAGE_LOG_EVENT}\] (.*)")


def _semantic_item(file_path: str, line: int) -> dict[str, Any]:
    return {
        "filePath": file_path,
        "lineStart": line,
        "symbolType": "function",
        "symbolName": f"sym_at_{line}",
        "content": f"def sym_at_{line}():\n    return {line}",
        "score": 0.5,
    }


def _lazy_outcome(results: list[dict[str, Any]] | None = None) -> Any:
    return mcp_server.LazyIndexOutcome(
        results=results or [],
        status="skipped-test",
        reason="测试替身:不建索引、不出域",
    )


def _one_file_repo(tmp_path: Path) -> Path:
    (tmp_path / "alpha.py").write_text(f"def {_QUERY}():\n    return 1\n", encoding="utf-8")
    return tmp_path


def _install_fakes(
    monkeypatch: pytest.MonkeyPatch, results: list[dict[str, Any]] | Exception
) -> SimpleNamespace:
    """语义腿 + 懒索引替身(与 test_codebase_retrieval_fusion.py 同口径,不建真索引)。

    这里**整枚模块**塞进 `sys.modules`,而不是 monkeypatch 真模块的属性:真
    `codebase_indexer` 此刻可能正被别席改到半截(本席禁碰它),按属性打补丁会先 import
    它 ⇒ 别席的在飞形状把本席钉成假红。段计时/装配与建索引器无契约耦合,离线替模块
    就是最贴实际的隔离(§5 测试隔离:不连 PG/Redis,也不碰别席在飞文件)。
    """
    search = AsyncMock(side_effect=results) if isinstance(results, Exception) else AsyncMock(return_value=results)
    fake = SimpleNamespace(search=search, index_repository=AsyncMock(return_value={"indexed": 0, "skipped": 0}))
    fake_module = ModuleType("app.services.codebase_indexer")
    fake_module.codebase_indexer = fake  # type: ignore[attr-defined]
    # 生产装配层会在符号档懒导入该异常类;整模块替身必须也带上,否则语义腿会
    # 以 ImportError 假失败(与本票遥测语义无关)。
    fake_module.SymbolFilterUndetermined = SymbolFilterUndetermined  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "app.services.codebase_indexer", fake_module)
    monkeypatch.setattr(mcp_server, "_lazy_index_and_research", AsyncMock(return_value=_lazy_outcome()))
    return fake


def _by_stage(out: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(s["stage"]): s for s in out["stages"]}


def _lines(cap: list[dict[str, Any]]) -> list[str]:
    return [str(e["event"]) for e in cap if str(e["event"]).startswith(f"[{STAGE_LOG_EVENT}]")]


# ① 正常路径:六段齐、序固定、词表在册


async def test_happy_path_emits_fixed_order_six_stages(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)
    _install_fakes(monkeypatch, [_semantic_item("beta.py", 3)])
    with _capture(monkeypatch) as cap:
        out = await _tool_search_codebase({"query": _QUERY, "path": str(root)})
    assert [s["stage"] for s in out["stages"]] == list(SEARCH_CODEBASE_STAGES)
    assert len(out["stages"]) == 6
    got = _by_stage(out)
    assert all(s["result"] in STAGE_RESULTS for s in out["stages"]), out["stages"]
    assert got["keyword_leg"]["result"] == "ok" and got["semantic_leg"]["result"] == "ok"
    assert got["fuse"]["result"] == "ok" and got["assemble"]["result"] == "ok"
    assert got["lazy_index"]["result"] in ("skipped", "unjudged")
    for stage in ("validate", "keyword_leg", "semantic_leg", "fuse", "assemble"):
        assert isinstance(got[stage]["duration_ms"], float) and got[stage]["duration_ms"] >= 0.0, stage
        assert isinstance(got[stage]["count"], int), stage
    assert len(_lines(cap)) == 6, f"每段恰一行,实得 {len(_lines(cap))}"


# ② 调用方关闭语义腿 ⇒ 两段显式 skipped(不是缺项)


async def test_semantic_off_marks_skipped_explicitly(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)
    fake = _install_fakes(monkeypatch, [_semantic_item("beta.py", 3)])
    out = await _tool_search_codebase({"query": _QUERY, "path": str(root), "use_semantic": False})
    assert fake.search.await_count == 0, "关掉语义腿却仍发了查询"
    got = _by_stage(out)
    assert len(out["stages"]) == 6
    assert got["semantic_leg"]["result"] == "skipped"
    assert got["lazy_index"]["result"] == "skipped"
    assert out["mode"] == "single-source:keyword"


async def test_unreadable_directory_is_not_an_empty_search(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """子目录列不出来、关键词又不在可读文件里时,不能报成 empty。"""
    root = tmp_path / "repo"
    root.mkdir()
    (root / "keep.py").write_text("other = 1\n", encoding="utf-8")
    blocked = root / "blocked"
    blocked.mkdir()
    hidden = blocked / "hidden.py"
    hidden.write_text("needle_token = 1\n", encoding="utf-8")
    real_scandir = os.scandir

    def deny(path: str) -> object:
        if Path(path).name == "blocked":
            raise PermissionError(13, "denied", str(path))
        return real_scandir(path)

    monkeypatch.setattr(os, "scandir", deny)
    out = await _tool_search_codebase(
        {"query": "needle_token", "path": str(root), "use_semantic": False}
    )
    assert out["mode"] != "empty"
    assert any("不能把检索说成完整" in str(item.get("detail")) for item in out["reasons"])
    assert hidden.read_text(encoding="utf-8") == "needle_token = 1\n"


# ③ 没走到的段 = unjudged,不许从册里消失


async def test_empty_query_still_emits_all_stages(monkeypatch: pytest.MonkeyPatch) -> None:
    out = await _tool_search_codebase({"query": "", "path": "."})
    assert out["ok"] is False
    assert [s["stage"] for s in out["stages"]] == list(SEARCH_CODEBASE_STAGES)
    got = _by_stage(out)
    assert got["validate"]["result"] == "failed"
    for stage in ("keyword_leg", "semantic_leg", "lazy_index", "fuse", "assemble"):
        assert got[stage]["result"] == "unjudged", stage
        assert got[stage]["duration_ms"] is None, "没量到的段不得用 0 冒充耗时"


# ④ 一腿炸:那一段点名 failed + 原因


async def test_leg_failure_names_the_stage(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = _one_file_repo(tmp_path)
    _install_fakes(monkeypatch, RuntimeError("语义腿挂了"))
    out = await _tool_search_codebase({"query": _QUERY, "path": str(root)})
    got = _by_stage(out)
    assert got["semantic_leg"]["result"] == "failed"
    assert "语义腿挂了" in str(got["semantic_leg"]["detail"])
    assert got["keyword_leg"]["result"] == "ok"
    assert len(out["stages"]) == 6


# ⑤⑥ 结论行与"量不到"的口径(器物层,不经业务也能钉)


class _Cap:
    def __init__(self) -> None:
        self.events: list[dict[str, Any]] = []

    def info(self, event: str, *_a: Any, **_k: Any) -> None:
        self.events.append({"event": event})

    def warning(self, event: str, *_a: Any, **_k: Any) -> None:
        self.events.append({"event": f"WARN {event}"})


def _capture(monkeypatch: pytest.MonkeyPatch) -> Any:
    """把在册 structlog logger 换成内存收集器(不改生产落盘链,只取证)。"""
    from contextlib import contextmanager

    @contextmanager
    def _ctx() -> Any:
        cap = _Cap()
        monkeypatch.setattr(stage_telemetry, "logger", cap)
        try:
            yield cap.events
        finally:
            monkeypatch.setattr(stage_telemetry, "logger", stage_telemetry.get_logger(__name__))

    return _ctx()


def test_clock_unavailable_is_unjudged_not_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    """时钟取不到 ⇒ 耗时维度记未判定:行里是 `unjudged`,册里是 None,**都不是 0**。"""
    with _capture(monkeypatch) as cap:
        monkeypatch.setattr(stage_telemetry, "_monotonic_ms", lambda: None)
        rec = StageRecorder("search_codebase", trace_id="t")
        rec.record("fuse", "ok", duration_ms=rec.clock().elapsed_ms(), count=7)
    row = _by_stage({"stages": rec.finalize()})["fuse"]
    assert row["duration_ms"] is None
    fuse_line = next(x for x in _lines(cap) if "stage=fuse " in x)
    assert "duration_ms=unjudged" in fuse_line and "duration_ms=0 " not in fuse_line


def test_one_line_per_stage_and_no_duplicate_line(monkeypatch: pytest.MonkeyPatch) -> None:
    with _capture(monkeypatch) as cap:
        rec = StageRecorder("search_codebase", trace_id="trace-1")
        rec.record("validate", "ok", duration_ms=1.0, count=1)
        rec.record("validate", "failed", duration_ms=2.0, count=0)  # 二次记账:取第一次
        rec.finalize()
    lines = _lines(cap)
    assert len(lines) == len(SEARCH_CODEBASE_STAGES)
    validate_lines = [x for x in lines if "stage=validate " in x]
    assert len(validate_lines) == 1 and "result=ok" in validate_lines[0], validate_lines
    assert all("trace_id=trace-1" in x and "count=" in x for x in lines)


# ⑦ 单源锁:段清单/词表/声明各只有一处


def test_single_source_locks() -> None:
    src = Path(mcp_server.__file__).read_text(encoding="utf-8")
    assert "from .stage_telemetry import" in src
    assert "_TOOL_STAGES" not in src and "STAGE_RESULTS" not in src, "消费方自立了第二份段清单/词表"
    tel = Path(stage_telemetry.__file__).read_text(encoding="utf-8")
    assert "registry.counter(" not in tel and "registry.histogram(" not in tel, "声明必须在 _init_metrics 一处"
    assert stages_of("search_codebase") is SEARCH_CODEBASE_STAGES
    assert stages_of("no_such_tool") == ()


def test_metrics_land_on_existing_registry() -> None:
    """阶段结论落进**既有** metrics 面(/metrics + dashboard 那一份 registry)。

    registry 是进程级单例、同文件其他用例也会记同一段 ⇒ 断言取**增量**(绝对值会假红)。
    """
    counter = telemetry_service.registry.get_metric(stage_telemetry.STAGE_COUNTER_NAME)
    assert counter is not None, "既有 registry 里没有阶段 counter(_init_metrics 声明缺失)"
    histogram = telemetry_service.registry.get_metric(stage_telemetry.STAGE_HISTOGRAM_NAME)
    assert histogram is not None, "既有 registry 里没有阶段 histogram(_init_metrics 声明缺失)"
    before = counter.get(tool="search_codebase", stage="fuse", result="ok")
    StageRecorder("search_codebase", trace_id="t").record("fuse", "ok", duration_ms=12.5, count=3)
    assert counter.get(tool="search_codebase", stage="fuse", result="ok") == before + 1.0
    entry = histogram.get(tool="search_codebase", stage="fuse")
    assert entry["count"] >= 1 and entry["sum"] >= 12.4, entry
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
