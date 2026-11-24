# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-8 第十三批:自动重建调度层(2026-11-23)。

钉住四件事:
① 开关**只认白名单真值**,写错一个字符不会把花费打开;
② 上限有天花板,解析失败回落缺省(不是 0、不是无限);
③ 没登记路径的候选**跳过且点名**,超上限的**标记不丢弃**;
④ 单仓失败不阻断后续,整体结果逐仓可读——"跳过"与"没有"在台账上可区分。
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.services.codebase_auto_rebuild import (
    AUTO_REBUILD_DEFAULT_MAX_REPOS,
    AUTO_REBUILD_ENV,
    AUTO_REBUILD_MAX_ENV,
    AUTO_REBUILD_MAX_REPOS_CAP,
    auto_rebuild_enabled,
    auto_rebuild_if_enabled,
    auto_rebuild_limit,
    plan_auto_rebuild,
    run_auto_rebuild,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("1", True),
        ("true", True),
        ("TRUE", True),
        ("on", True),
        (" y ", True),
        (None, False),
        ("", False),
        ("0", False),
        ("false", False),
        ("enable", False),  # 关键反向牙:拼错一个字符不许被读成开
        ("2", False),
        ("yes please", False),
    ],
)
def test_enabled_only_whitelist_truthy(raw, expected):
    assert auto_rebuild_enabled(raw) is expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, AUTO_REBUILD_DEFAULT_MAX_REPOS),
        ("", AUTO_REBUILD_DEFAULT_MAX_REPOS),
        ("5", 5),
        (" 4 ", 4),
        ("-1", AUTO_REBUILD_DEFAULT_MAX_REPOS),
        ("0", AUTO_REBUILD_DEFAULT_MAX_REPOS),
        ("abc", AUTO_REBUILD_DEFAULT_MAX_REPOS),
        (str(AUTO_REBUILD_MAX_REPOS_CAP + 90), AUTO_REBUILD_MAX_REPOS_CAP),
    ],
)
def test_limit_parse_and_clamp(raw, expected):
    assert auto_rebuild_limit(raw) == expected


def _cand(repo_id: str, path: str | None, decision: str = "rebuild-stale") -> dict[str, Any]:
    return {"repoId": repo_id, "decision": decision, "lastIndexedAtMs": None, "localPath": path}


def test_plan_keeps_server_order_and_points_at_missing_path():
    plan = plan_auto_rebuild(
        [
            _cand("r-config", "/w/a", "rebuild-config-changed"),
            _cand("r-nopath", None, "rebuild-no-state"),
            _cand("r-stale", "/w/b"),
            {"repoId": "  ", "localPath": "/w/c"},  # 空 repoId 直接不收
            {},
        ],
        10,
    )
    assert [x["repoId"] for x in plan["run"]] == ["r-config", "r-stale"]
    assert plan["run"][0]["repoPath"] == "/w/a"
    assert plan["skipped_no_path"] == ["r-nopath"]
    assert plan["skipped_over_limit"] == []


def test_plan_marks_over_limit_instead_of_dropping():
    plan = plan_auto_rebuild([_cand(f"r{i}", f"/w/{i}") for i in range(6)], 2)
    assert [x["repoId"] for x in plan["run"]] == ["r0", "r1"]
    assert plan["skipped_over_limit"] == ["r2", "r3", "r4", "r5"]


def test_plan_limit_floor_and_cap():
    plan = plan_auto_rebuild([_cand(f"r{i}", f"/w/{i}") for i in range(30)], 0)
    assert len(plan["run"]) == 1  # 0 会被抬到 1,不是"什么都不跑"
    plan2 = plan_auto_rebuild([_cand(f"r{i}", f"/w/{i}") for i in range(30)], 10**6)
    assert len(plan2["run"]) == AUTO_REBUILD_MAX_REPOS_CAP


def test_plan_blank_path_is_not_a_path():
    plan = plan_auto_rebuild([_cand("r1", "   "), _cand("r2", "/w/2")], 5)
    assert plan["skipped_no_path"] == ["r1"]
    assert [x["repoId"] for x in plan["run"]] == ["r2"]


class _FakeResult:
    def __init__(self, files: int = 3, chunks: int = 9, errors: list[str] | None = None) -> None:
        self.files_indexed = files
        self.chunks_indexed = chunks
        self.errors = errors or []


class _FakeIndexer:
    def __init__(self, fail_on: set[str] | None = None) -> None:
        self.calls: list[dict[str, Any]] = []
        self._fail_on = fail_on or set()

    async def index_repository(self, repo_path: str, **kw: Any) -> _FakeResult:
        self.calls.append({"repo_path": repo_path, **kw})
        repo_id = str(kw.get("repo_id") or "")
        if repo_id in self._fail_on:
            raise RuntimeError("目录不可读")
        return _FakeResult()


def test_run_continues_after_single_repo_failure():
    indexer = _FakeIndexer(fail_on={"r-bad"})
    out = asyncio.run(
        run_auto_rebuild(
            indexer,
            [_cand("r-bad", "/w/bad"), _cand("r-good", "/w/good")],
            limit=5,
        )
    )
    assert out["ran"] == 2 and out["ok"] == 1 and out["failed"] == 1
    assert [r["status"] for r in out["results"]] == ["failed", "ok"]
    assert "目录不可读" in out["results"][0]["error"]
    assert [c["repo_id"] for c in indexer.calls] == ["r-bad", "r-good"]  # 失败后仍跑了第二个


def test_run_passes_incremental_and_identity_through():
    indexer = _FakeIndexer()
    asyncio.run(
        run_auto_rebuild(
            indexer,
            [_cand("r1", "/w/1")],
            limit=1,
            api_token="tk",
            internal_user_id="u1",
        )
    )
    call = indexer.calls[0]
    assert call["repo_id"] == "r1"
    assert call["api_token"] == "tk"
    assert call["internal_user_id"] == "u1"
    assert call["incremental"] is True


def test_disabled_returns_skipped_with_reason():
    out = asyncio.run(
        auto_rebuild_if_enabled(_FakeIndexer(), [_cand("r1", "/w/1")], env={})
    )
    assert out["skipped"] is True
    assert AUTO_REBUILD_ENV in out["reason"]
    assert out["candidates"] == 1
    assert "ran" not in out  # 没跑就不许有 ran 字段冒充"跑了 0 个"


def test_enabled_runs_and_reports_limit():
    indexer = _FakeIndexer()
    out = asyncio.run(
        auto_rebuild_if_enabled(
            indexer,
            [_cand("r1", "/w/1"), _cand("r2", "/w/2"), _cand("r3", None)],
            env={AUTO_REBUILD_ENV: "1", AUTO_REBUILD_MAX_ENV: "1"},
        )
    )
    assert out["skipped"] is False
    assert out["limit"] == 1
    assert out["ran"] == 1 and out["ok"] == 1
    assert out["skipped_no_path"] == ["r3"]
    assert out["skipped_over_limit"] == ["r2"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
