# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""KnowledgeFS 导入边读面测试(P0-8 第八批,2026-11-23)。

测试隔离(AGENTS.md §5 铁律):不连库、不打真 HTTP —— 取数腿全部 monkeypatch。

覆盖:身份缺失(不发起上游)/ repo 空 / direction 非法 / target 空 / from 与 to 两档
参数口径(后者按 toName 查)/ 有边返回虚拟路径簇 / 无边且无切片 ⇒ path_missing /
无边但有切片 ⇒ catalog_missing(且 detail 必须点明 TS 不产边这层二义)/ 上游失败 ⇒ 未判定。
"""

from __future__ import annotations

import pytest

from app.services.knowledge_fs import KnowledgeFS


@pytest.fixture()
def fs() -> KnowledgeFS:
    return KnowledgeFS()


async def test_imports_missing_identity(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def must_not_call(*_a: object, **_k: object) -> None:
        raise AssertionError("身份缺失时不得发起上游调用")

    monkeypatch.setattr(fs, "_fetch_import_edges", must_not_call)
    assert (await fs.list_imports("r1", "src/a.py", None))["status"] == "skipped_missing_identity"


async def test_imports_invalid_repo(fs: KnowledgeFS) -> None:
    assert (await fs.list_imports("", "src/a.py", "u1"))["status"] == "invalid_argument"


async def test_imports_invalid_direction(fs: KnowledgeFS) -> None:
    out = await fs.list_imports("r1", "src/a.py", "u1", direction="both")
    assert out["status"] == "invalid_argument"
    assert "from" in out["detail"] and "to" in out["detail"]


async def test_imports_blank_target(fs: KnowledgeFS) -> None:
    assert (await fs.list_imports("r1", "   ", "u1"))["status"] == "invalid_argument"


async def test_imports_from_direction_queries_file_path(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[dict[str, str]] = []

    async def fake(
        repo_id: str, uid: str | None, tok: str | None, params: dict[str, str], limit: int
    ) -> list[dict]:
        seen.append(dict(params))
        assert limit == 200  # limit=999 夹到上界 200
        return [
            {
                "filePath": "src/a.py",
                "line": 1,
                "kind": "import",
                "fromName": "src/a.py",
                "toName": "os",
            }
        ]

    monkeypatch.setattr(fs, "_fetch_import_edges", fake)
    out = await fs.list_imports("r1", "src/a.py", "u1", limit=999)
    assert out["status"] == "ok"
    assert seen[0]["filePath"] == "src/a.py" and seen[0]["kind"] == "import"
    assert out["edges"][0]["path"] == "/repo/r1/src/a.py#os"
    assert out["count"] == 1


async def test_imports_to_direction_queries_to_name(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[dict[str, str]] = []

    async def fake(
        repo_id: str, uid: str | None, tok: str | None, params: dict[str, str], limit: int
    ) -> list[dict]:
        seen.append(dict(params))
        return [
            {
                "filePath": "pkg/b.py",
                "line": 9,
                "kind": "import",
                "fromName": "pkg/b.py",
                "toName": "os",
            }
        ]

    monkeypatch.setattr(fs, "_fetch_import_edges", fake)
    out = await fs.list_imports("r1", "os", "u1", direction="to")
    assert out["status"] == "ok"
    assert seen[0]["toName"] == "os" and "filePath" not in seen[0]
    assert out["edges"][0]["path"] == "/repo/r1/pkg/b.py#os"


async def test_imports_path_missing_when_no_chunks(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def no_edges(*_a: object, **_k: object) -> list[dict]:
        return []

    async def no_chunks(*_a: object, **_k: object) -> list[dict]:
        return []

    monkeypatch.setattr(fs, "_fetch_import_edges", no_edges)
    monkeypatch.setattr(fs, "_fetch_path_index", no_chunks)
    assert (await fs.list_imports("r1", "src/a.py", "u1"))["status"] == "path_missing"


async def test_imports_catalog_missing_names_ts_gap(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def no_edges(*_a: object, **_k: object) -> list[dict]:
        return []

    async def some_chunks(*_a: object, **_k: object) -> list[dict]:
        return [{"filePath": "src/a.py", "lineStart": 1, "lineEnd": 3}]

    monkeypatch.setattr(fs, "_fetch_import_edges", no_edges)
    monkeypatch.setattr(fs, "_fetch_path_index", some_chunks)
    out = await fs.list_imports("r1", "src/a.py", "u1")
    assert out["status"] == "catalog_missing"
    # 二义必须写清:不能断言"没有导入关系"(TS 仓库天然无边)
    assert "TS/JS" in out["detail"]


async def test_imports_upstream_unavailable(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(fs, "_fetch_import_edges", fail)
    assert (await fs.list_imports("r1", "src/a.py", "u1"))["status"] == "upstream_unavailable"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
