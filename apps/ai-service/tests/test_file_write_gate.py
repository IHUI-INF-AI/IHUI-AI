# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""票78「同文件写冲突治理:串行化」档测试。

覆盖四面:
1. classify_write_conflict 五态纯函数(no-baseline/clean/equivalent/undecidable/drifted);
2. per-path 互斥锁(同键归一、互斥不交错);
3. _tool_write_file 治理集成(drifted 拦截不落盘 / force 知情覆盖 / 四放行态 / EOL 口径);
4. 装车形状锁(写工具实现体必须接锁与判定、schema 必须暴露 force —— 删检测即红)。
"""

import asyncio
import re
from pathlib import Path

import pytest

from app.services import mcp_server
from app.services.file_write_gate import (
    _lock_key,
    classify_write_conflict,
    get_path_write_lock,
    reset_path_write_locks,
)


@pytest.fixture(autouse=True)
def _isolated_workspace(tmp_path, monkeypatch):
    """工作区白名单挂 tmp;base 存储与锁注册表每用例清空(测试隔离)。"""
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    mcp_server._reset_file_base_store()
    reset_path_write_locks()
    yield
    mcp_server._reset_file_base_store()
    reset_path_write_locks()


# ---------------------------------------------------------------------------
# 1. classify_write_conflict 五态(纯函数)
# ---------------------------------------------------------------------------


class TestClassifyWriteConflict:
    def test_no_baseline_when_base_absent(self):
        # base 缺席 = 新文件/首次写,无论现盘如何都放行
        assert classify_write_conflict(None, None, "x") == "no-baseline"
        assert classify_write_conflict("disk", None, "x") == "no-baseline"

    def test_undecidable_when_disk_unreadable_but_base_exists(self):
        # 现盘读不了/不存在但 base 在:判不了 → 放行(不静默折成 clean)
        assert classify_write_conflict(None, "base", "x") == "undecidable"

    def test_clean_when_disk_equals_base(self):
        assert classify_write_conflict("same", "same", "other") == "clean"

    def test_equivalent_when_disk_equals_intended(self):
        # 盘已被改成拟写内容:幂等重写,不拦
        assert classify_write_conflict("mine", "base", "mine") == "equivalent"

    def test_drifted_when_all_three_differ(self):
        assert classify_write_conflict("disk", "base", "mine") == "drifted"


# ---------------------------------------------------------------------------
# 2. per-path 互斥锁
# ---------------------------------------------------------------------------


class TestPathWriteLock:
    def test_same_file_same_lock_across_path_spellings(self, tmp_path):
        p = tmp_path / "f.txt"
        a = get_path_write_lock(str(p))
        b = get_path_write_lock(str(p) + os_sep_dot())
        assert a is b

    def test_lock_keys_normalized(self, tmp_path):
        p = tmp_path / "f.txt"
        assert _lock_key(str(p)) == _lock_key(str(p) + "/.")

    def test_mutual_exclusion_no_interleaving(self, tmp_path):
        order: list[str] = []

        async def worker(name: str) -> None:
            async with get_path_write_lock(str(tmp_path / "f.txt")):
                order.append(f"{name}:acquired")
                await asyncio.sleep(0.01)
                order.append(f"{name}:released")

        async def _main() -> None:
            await asyncio.gather(worker("A"), worker("B"))

        asyncio.run(_main())
        # 成对不交错:每个 acquired 后必须紧跟同名 released
        for i in range(0, len(order), 2):
            who = order[i].split(":")[0]
            assert order[i] == f"{who}:acquired"
            assert order[i + 1] == f"{who}:released"


def os_sep_dot() -> str:
    """路径拼写变体:/.<sep>. 归一后与原路径同键。"""
    import os

    return os.sep + "."


# ---------------------------------------------------------------------------
# 3. _tool_write_file 治理集成
# ---------------------------------------------------------------------------


async def _read_file(path: str) -> dict:
    return await mcp_server._tool_read_file({"path": path})


async def _write_file(path: str, content: str, **extra) -> dict:
    return await mcp_server._tool_write_file({"path": path, "content": content, **extra})


class TestWriteFileConflictGate:
    def test_new_file_no_baseline_passes(self, tmp_path):
        target = tmp_path / "new.txt"
        r = asyncio.run(_write_file(str(target), "hello"))
        assert r["ok"] is True
        assert r["concurrency"]["verdict"] == "no-baseline"
        assert target.read_text(encoding="utf-8") == "hello"

    def test_clean_rewrite_passes(self, tmp_path):
        target = tmp_path / "f.txt"
        target.write_text("v1", encoding="utf-8")
        asyncio.run(_read_file(str(target)))
        r = asyncio.run(_write_file(str(target), "v2"))
        assert r["ok"] is True
        assert r["concurrency"]["verdict"] == "clean"
        assert target.read_text(encoding="utf-8") == "v2"

    def test_drifted_blocks_and_does_not_touch_disk(self, tmp_path):
        target = tmp_path / "f.txt"
        target.write_text("base", encoding="utf-8")
        asyncio.run(_read_file(str(target)))
        # 外部(并行 agent/人)改盘
        target.write_text("external edit", encoding="utf-8")
        r = asyncio.run(_write_file(str(target), "mine"))
        assert r["ok"] is False
        assert r["errorCode"] == "CONCURRENT_MODIFICATION"
        assert r["concurrency"]["verdict"] == "drifted"
        # 拦截必须真不落盘:现盘仍是外部改动(这是本票的"有牙"所在)
        assert target.read_text(encoding="utf-8") == "external edit"

    def test_force_overrides_drift(self, tmp_path):
        target = tmp_path / "f.txt"
        target.write_text("base", encoding="utf-8")
        asyncio.run(_read_file(str(target)))
        target.write_text("external edit", encoding="utf-8")
        r = asyncio.run(_write_file(str(target), "mine", force=True))
        assert r["ok"] is True
        assert r["concurrency"]["verdict"] == "drifted"
        assert r["concurrency"]["forced"] is True
        assert target.read_text(encoding="utf-8") == "mine"

    def test_equivalent_idempotent_rewrite_passes(self, tmp_path):
        target = tmp_path / "f.txt"
        target.write_text("base", encoding="utf-8")
        asyncio.run(_read_file(str(target)))
        target.write_text("mine", encoding="utf-8")  # 盘已被改成拟写内容
        r = asyncio.run(_write_file(str(target), "mine"))
        assert r["ok"] is True
        assert r["concurrency"]["verdict"] == "equivalent"

    def test_undecidable_when_file_removed_externally(self, tmp_path):
        target = tmp_path / "f.txt"
        target.write_text("base", encoding="utf-8")
        asyncio.run(_read_file(str(target)))
        target.unlink()  # 外部删除
        r = asyncio.run(_write_file(str(target), "mine"))
        # 判不了(被删 vs 读不了同形)→ 放行但如实上报,不静默折成 clean
        assert r["ok"] is True
        assert r["concurrency"]["verdict"] == "undecidable"

    def test_eol_crlf_external_edit_is_clean_not_drift(self, tmp_path):
        # base 以 LF 存储(read_file universal newlines);外部用 CRLF 写入同内容
        # → 写前判定必须经 _normalize_eol 归一,判 clean 放行(防整文件误判漂移)
        target = tmp_path / "f.txt"
        target.write_text("line1\r\nline2\r\n", encoding="utf-8")
        asyncio.run(_read_file(str(target)))
        target.write_text("line1\r\nline2\r\n", encoding="utf-8")  # 重写同内容(CRLF)
        r = asyncio.run(_write_file(str(target), "line1\nline2\n"))
        assert r["ok"] is True
        assert r["concurrency"]["verdict"] == "clean"


# ---------------------------------------------------------------------------
# 4. 装车形状锁(防复发:删接线即红;对齐 child-env-boundary.test.ts 的装车对账)
# ---------------------------------------------------------------------------


def _function_body(src: str, decl_re: str) -> str:
    m = re.search(decl_re, src)
    assert m, f"找不到函数声明: {decl_re}"
    return m.group(0)


class TestWiringShapeLock:
    """write_file/file_edit/resolve_conflict 三个写工具的实现体必须接线治理门。"""

    def test_write_file_wires_lock_and_classifier(self):
        src = Path(mcp_server.__file__).read_text(encoding="utf-8")
        body = _function_body(
            src, r"async def _tool_write_file[\s\S]*?(?=\nasync def _tool_)"
        )
        assert "get_path_write_lock(" in body, "write_file 写段必须持 per-path 锁"
        assert "classify_write_conflict(" in body, "write_file 写前必须做基线漂移判定"
        assert 'CONCURRENT_MODIFICATION' in body, "drifted 拦截必须带结构化 errorCode"

    def test_file_edit_and_resolve_conflict_wires_lock(self):
        src = Path(mcp_server.__file__).read_text(encoding="utf-8")
        for fn in ("_tool_file_edit", "_tool_resolve_conflict"):
            body = _function_body(
                src,
                # 通用边界:下一个顶格(无缩进)函数声明;两函数体内的嵌套 _err 带缩进不误停
                rf"async def {fn}[\s\S]*?(?=\n(?:async )?def )",
            )
            assert "get_path_write_lock(" in body, f"{fn} 写回段必须持 per-path 锁"

    def test_schema_exposes_force_escape_hatch(self):
        src = Path(mcp_server.__file__).read_text(encoding="utf-8")
        schema_body = _function_body(src, r'name="write_file"[\s\S]*?"required"')
        assert '"force"' in schema_body, "schema 必须暴露 force 逃生门(让 LLM 可表态知情覆盖)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
