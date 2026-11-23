# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""KnowledgeFS 索引状态读面测试(P0-8 第六批,2026-11-23)。

测试隔离(AGENTS.md §5 铁律):不连库、不打真 HTTP —— 状态取数腿全部 monkeypatch。

覆盖:身份缺失(不发起上游)/ 参数非法 / 四档判据透传 / 响应缺 decision 判未判定 /
max_age_ms 负值夹到 0。
"""

from __future__ import annotations

import pytest

from app.services.knowledge_fs import KnowledgeFS


@pytest.fixture()
def fs() -> KnowledgeFS:
    return KnowledgeFS()


async def test_index_state_missing_identity(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def must_not_call(*_a: object, **_k: object) -> None:
        raise AssertionError("身份缺失时不得发起上游调用")

    monkeypatch.setattr(fs, "_fetch_index_state", must_not_call)
    assert (await fs.index_state("r1", None))["status"] == "skipped_missing_identity"


async def test_index_state_invalid_repo(fs: KnowledgeFS) -> None:
    assert (await fs.index_state("", "u1"))["status"] == "invalid_argument"


@pytest.mark.parametrize(
    "decision",
    ["rebuild-no-state", "rebuild-config-changed", "rebuild-stale", "reuse-fresh"],
)
async def test_index_state_passes_all_four_decisions(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch, decision: str
) -> None:
    seen: list[int] = []

    async def fake(
        repo_id: str, uid: str | None, tok: str | None, max_age_ms: int
    ) -> dict:
        seen.append(max_age_ms)
        return {
            "repoId": repo_id,
            "decision": decision,
            "currentFingerprint": "v1536:tree-sitter-chunk-v1",
            "state": {"configFingerprint": "v1536:tree-sitter-chunk-v1"},
        }

    monkeypatch.setattr(fs, "_fetch_index_state", fake)
    out = await fs.index_state("r1", "u1", max_age_ms=3600_000)
    assert out["status"] == "ok" and out["decision"] == decision
    assert out["current_fingerprint"] == "v1536:tree-sitter-chunk-v1"
    assert out["max_age_ms"] == 3600_000
    assert seen == [3600_000]


async def test_index_state_default_window_is_zero(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[int] = []

    async def fake(
        repo_id: str, uid: str | None, tok: str | None, max_age_ms: int
    ) -> dict:
        seen.append(max_age_ms)
        return {"decision": "reuse-fresh"}

    monkeypatch.setattr(fs, "_fetch_index_state", fake)
    await fs.index_state("r1", "u1")
    # 缺省 0 = 不按时间判过期(窗口是运维口径,不给默认值冒充)
    assert seen == [0]


async def test_index_state_negative_window_clamped(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    seen: list[int] = []

    async def fake(
        repo_id: str, uid: str | None, tok: str | None, max_age_ms: int
    ) -> dict:
        seen.append(max_age_ms)
        return {"decision": "reuse-fresh"}

    monkeypatch.setattr(fs, "_fetch_index_state", fake)
    await fs.index_state("r1", "u1", max_age_ms=-99)
    assert seen == [0]


async def test_index_state_upstream_failure(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fail(*_a: object, **_k: object) -> None:
        return None

    monkeypatch.setattr(fs, "_fetch_index_state", fail)
    out = await fs.index_state("r1", "u1")
    assert out["status"] == "upstream_unavailable"
    assert "未判定" in str(out["detail"])


async def test_index_state_response_without_decision_is_unjudged(
    fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch
) -> None:
    """真实取数腿在缺 decision 时返回 None —— 空串不得冒充 reuse-fresh。"""

    def fake_response_json() -> dict:
        return {"data": {"repoId": "r1", "state": None}}  # 没有 decision

    class _Resp:
        status_code = 200

        @staticmethod
        def json() -> dict:
            return fake_response_json()

    class _Client:
        def __init__(self, *_a: object, **_k: object) -> None:
            pass

        async def __aenter__(self) -> _Client:
            return self

        async def __aexit__(self, *_a: object) -> None:
            return None

        async def get(self, *_a: object, **_k: object) -> _Resp:
            return _Resp()

    import app.services.knowledge_fs as kfs

    monkeypatch.setattr(kfs.httpx, "AsyncClient", _Client)
    out = await fs.index_state("r1", "u1")
    assert out["status"] == "upstream_unavailable"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
