# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""KnowledgeFS 符号视图测试(P0-8 第四批,2026-11-23)。

测试隔离(AGENTS.md §5 铁律):全程不连生产库、不打真 HTTP —— 实体清单与路径清单
两腿全部 monkeypatch。

覆盖:身份缺失 / 参数非法 / 命中簇投影 / 上游不可用 / **空集三因三分**
(path_missing / catalog_missing / upstream_unavailable)/ limit 夹取 / 路由接线。
"""

from __future__ import annotations

import inspect
from pathlib import Path

import pytest

from app.api.v1 import knowledge_fs as knowledge_fs_route
from app.services.knowledge_fs import KnowledgeFS


@pytest.fixture()
def fs() -> KnowledgeFS:
    return KnowledgeFS()


async def test_symbols_missing_identity_never_fetches(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def must_not_call(*_a: object, **_k: object) -> None:
        raise AssertionError("身份缺失时不得发起任何上游调用")

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", must_not_call)
    out = await fs.list_symbols("r1", "fn_a", None)
    assert out["status"] == "skipped_missing_identity"


async def test_symbols_invalid_arguments(fs: KnowledgeFS) -> None:
    assert (await fs.list_symbols("", "fn_a", "u1"))["status"] == "invalid_argument"
    assert (await fs.list_symbols("r1", "   ", "u1"))["status"] == "invalid_argument"


async def test_symbols_returns_cross_file_cluster(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_defs(
        repo_id: str, name: str, uid: str | None, tok: str | None, limit: int
    ) -> list[dict] | None:
        assert (repo_id, name, uid, limit) == ("r1", "fn_a", "u1", 50)
        return [
            {"filePath": "src/a.py", "lineStart": 3, "lineEnd": 9, "kind": "function", "name": "fn_a"},
            {"filePath": "src/deep/b.py", "lineStart": 41, "lineEnd": 47, "kind": "function", "name": "fn_a"},
        ]

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", fake_defs)
    out = await fs.list_symbols("r1", "fn_a", "u1")
    assert out["status"] == "ok" and out["count"] == 2
    assert [d["file_path"] for d in out["definitions"]] == ["src/a.py", "src/deep/b.py"]
    # 路径投影带符号段,agent 可直接拿去 read
    assert out["definitions"][0]["path"] == "/repo/r1/src/a.py#fn_a"
    assert out["definitions"][1]["line_start"] == 41


async def test_symbols_upstream_failure(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fail_defs(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", fail_defs)
    assert (await fs.list_symbols("r1", "fn_a", "u1"))["status"] == "upstream_unavailable"


async def test_symbols_empty_without_chunks_is_path_missing(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def empty_defs(*_a: object, **_k: object) -> list[dict]:
        return []

    async def empty_index(*_a: object, **_k: object) -> list[dict]:
        return []

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", empty_defs)
    monkeypatch.setattr(fs, "_fetch_path_index", empty_index)
    out = await fs.list_symbols("r1", "fn_a", "u1")
    assert out["status"] == "path_missing"


async def test_symbols_empty_with_chunks_is_catalog_missing(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def empty_defs(*_a: object, **_k: object) -> list[dict]:
        return []

    async def some_index(*_a: object, **_k: object) -> list[dict]:
        return [{"filePath": "src/a.py", "lineStart": 1, "lineEnd": 9}]

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", empty_defs)
    monkeypatch.setattr(fs, "_fetch_path_index", some_index)
    out = await fs.list_symbols("r1", "fn_a", "u1")
    assert out["status"] == "catalog_missing"
    assert "同形" in str(out["detail"])


async def test_symbols_empty_but_index_unavailable_is_undecided(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def empty_defs(*_a: object, **_k: object) -> list[dict]:
        return []

    async def fail_index(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", empty_defs)
    monkeypatch.setattr(fs, "_fetch_path_index", fail_index)
    out = await fs.list_symbols("r1", "fn_a", "u1")
    assert out["status"] == "upstream_unavailable"
    assert "未判定" in str(out["detail"])


@pytest.mark.parametrize("given,expected", [(0, 1), (-5, 1), (50, 50), (999, 200)])
async def test_symbols_limit_clamped(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch, given: int, expected: int
) -> None:
    seen: list[int] = []

    async def fake_defs(
        repo_id: str, name: str, uid: str | None, tok: str | None, limit: int
    ) -> list[dict]:
        seen.append(limit)
        return []

    async def some_index(*_a: object, **_k: object) -> list[dict]:
        return [{"filePath": "src/a.py", "lineStart": 1, "lineEnd": 2}]

    monkeypatch.setattr(fs, "_fetch_symbol_definitions", fake_defs)
    monkeypatch.setattr(fs, "_fetch_path_index", some_index)
    await fs.list_symbols("r1", "fn_a", "u1", limit=given)
    assert seen == [expected]


def test_route_exposes_symbols_endpoint() -> None:
    src = Path(inspect.getsourcefile(knowledge_fs_route) or "").read_text(encoding="utf8")
    assert '@router.get("/symbols")' in src
    assert "knowledge_fs.list_symbols(" in src
    assert "知识文件系统按归属隔离" in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
