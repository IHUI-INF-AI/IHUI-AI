# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""回填脚本 backfill_connectors_to_pg.py 测试(2026-11-24)。

覆盖:
- dry-run 默认不写库;--apply 才落
- 三类计数:回填 / 跳过(已存在) / 无主(不落库)
- 无主记录绝不被回填成有主
- 幂等:第二次跑同一份存量,落项为 0、已存在全跳过
- 明文 secret 落库前加密(fake 原始行为 enc:v1,不含明文)
- 环境错 exit 2:store 损坏 / 无 DSN / 拿不到租户
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.core.config import settings
from scripts import backfill_connectors_to_pg as bf
from tests._connector_fake import FakeSession

TENANT = "2306401f-4b6d-4436-8f5c-aa36d25da676"
USER_A = "30763d9f-2b4a-4f6e-9c3a-1a2b3c4d5e6f"
USER_B = "40874c0a-3c5b-4f70-8d4b-2b3c4d5e6f70"
DSN = "postgresql://ihui:ihui_dev@127.0.0.1:5432/ihui"


def _write_store(path: Path, records: list[dict[str, Any]]) -> None:
    path.write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")


def _records() -> list[dict[str, Any]]:
    return [
        {"key": "yuque:a", "type": "yuque", "owner_user_id": USER_A, "app_secret": "plain-a",
         "extra": {}, "operations": []},
        {"key": "feishu:b", "type": "feishu", "owner_user_id": USER_B, "app_secret": "plain-b",
         "extra": {}, "operations": []},
        {"key": "yuque:legacy", "type": "yuque", "app_secret": "legacy-secret"},  # 无主
    ]


@pytest.fixture
def env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> tuple[FakeSession, Path]:
    fake = FakeSession()

    def _fake_session(dsn: str, **_kwargs: Any) -> FakeSession:
        return fake

    monkeypatch.setattr(bf, "SyncPgSession", _fake_session)
    monkeypatch.setattr(settings, "database_url", DSN)
    monkeypatch.setattr(settings, "platform_default_tenant_id", TENANT)
    store = tmp_path / "connector_store.json"
    _write_store(store, _records())
    return fake, store


def test_load_store_missing_file_returns_empty(tmp_path: Path):
    assert bf.load_store(tmp_path / "nope.json") == []


def test_load_store_non_list_raises(tmp_path: Path):
    p = tmp_path / "x.json"
    p.write_text('{"not": "list"}', encoding="utf-8")
    with pytest.raises(ValueError):
        bf.load_store(p)


def test_plan_three_buckets():
    plan = bf.plan_backfill(_records(), TENANT, existing_keys=set())
    assert [r["key"] for r in plan.inserted] == ["yuque:a", "feishu:b"]
    assert plan.skipped == []
    assert plan.ownerless == ["yuque:legacy (yuque)"]


def test_dry_run_does_not_write(env: tuple[FakeSession, Path]):
    fake, store = env
    rc = bf.main(["--store", str(store)])
    assert rc == 0
    assert fake.rows == []  # dry-run 一行未落


def test_apply_inserts_and_second_run_is_idempotent(env: tuple[FakeSession, Path]):
    fake, store = env
    rc = bf.main(["--store", str(store), "--apply"])
    assert rc == 0
    assert len(fake.rows) == 2  # 无主未落
    keys = {r["key"] for r in fake.rows}
    assert keys == {"yuque:a", "feishu:b"}

    # 第二次跑:全部已存在 ⇒ inserted=0,skipped=2,无主仍 1
    fake2 = FakeSession()
    bf.SyncPgSession = lambda dsn, **kw: fake2  # noqa: SLF001
    before = {(r["tenant_id"], r["owner_user_id"], r["key"]) for r in fake.rows}
    plan2 = bf.plan_backfill(_records(), TENANT, before)
    assert plan2.inserted == []
    assert sorted(plan2.skipped) == ["feishu:b", "yuque:a"]
    assert plan2.ownerless == ["yuque:legacy (yuque)"]


def test_ownerless_record_is_not_persisted(env: tuple[FakeSession, Path]):
    fake, store = env
    bf.main(["--store", str(store), "--apply"])
    persisted = {(r["owner_user_id"], r["key"]) for r in fake.rows}
    assert ("", "yuque:legacy") not in persisted
    assert all(r["owner_user_id"] for r in fake.rows)


def test_plain_secret_encrypted_at_rest(env: tuple[FakeSession, Path]):
    fake, store = env
    bf.main(["--store", str(store), "--apply"])
    for row in fake.rows:
        secret = str(row["app_secret"])
        assert secret.startswith("enc:v1:")
        assert "plain-a" not in secret and "plain-b" not in secret


def test_corrupt_store_exit_2(env: tuple[FakeSession, Path], tmp_path: Path):
    _, store = env
    corrupt = tmp_path / "bad.json"
    corrupt.write_text("{not-json", encoding="utf-8")
    assert bf.main(["--store", str(corrupt)]) == 2


def test_missing_dsn_exit_2(env: tuple[FakeSession, Path], monkeypatch: pytest.MonkeyPatch):
    _, store = env
    monkeypatch.setattr(settings, "database_url", "")
    assert bf.main(["--store", str(store), "--apply"]) == 2


def test_missing_tenant_exit_2(env: tuple[FakeSession, Path], monkeypatch: pytest.MonkeyPatch):
    _, store = env
    monkeypatch.setattr(settings, "platform_default_tenant_id", "")
    assert bf.main(["--store", str(store), "--apply"]) == 2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
