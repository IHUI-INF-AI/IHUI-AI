# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`scripts/backfill_connector_owner.py` 的判据测试(2026-09-29,G-371 第二步)。

覆盖:① dry-run 不写盘;② 认领落 owner 且不动其它字段;③ 幂等(第二次跑 0 落项、
文件字节不变);④ 已有属主不改写,除非该 key 被 --reassign 点名;⑤ 点了名而记录不存在
⇒ 只报不造;⑥ 未被点名的无主记录**逐条报名**;⑦ 文件损坏 ⇒ exit 2(不得降级成
"没什么可回填");⑧ 空 claims ⇒ exit 1;⑨ **输出里绝不出现记录正文**(app_secret
就住在那条记录里)。

全部走 tmp_path,不碰真实 data/connector_store.json。
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.backfill_connector_owner import main

SECRET = "super-secret-app-secret-DO-NOT-ECHO"


def _write_store(path: Path, records: list[dict[str, object]]) -> None:
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def _read_store(path: Path) -> list[dict[str, object]]:
    return json.loads(path.read_text(encoding="utf-8"))


def _rec(key: str, *, owner: str = "", name: str = "语雀文档库") -> dict[str, object]:
    rec: dict[str, object] = {
        "key": key,
        "type": "yuque",
        "name": name,
        "app_id": "appid-1",
        "app_secret": SECRET,
        "extra": {"user": "yuque", "repo": "developer"},
        "enabled": True,
        "installed_at": "2026-09-02T00:00:00+00:00",
        "updated_at": "2026-09-02T00:00:00+00:00",
        "last_sync_at": "",
        "last_error": "",
    }
    if owner:
        rec["owner_user_id"] = owner
    return rec


def test_dry_run_writes_nothing(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs")])
    before = store.read_bytes()

    rc = main(["--store", str(store), "--claim", "yuque:docs=42"])

    assert rc == 0
    assert store.read_bytes() == before
    assert "[dry-run]" in capsys.readouterr().out


def test_apply_stamps_only_owner_and_keeps_the_rest(tmp_path: Path) -> None:
    store = tmp_path / "connector_store.json"
    original = _rec("yuque:docs")
    _write_store(store, [original])

    rc = main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])

    assert rc == 0
    after = _read_store(store)[0]
    assert after["owner_user_id"] == "42"
    # 除 owner 与 updated_at 之外逐字段不变 —— 回填器不得"顺手规范化"用户数据
    for field in after:
        if field in {"owner_user_id", "updated_at"}:
            continue
        assert after[field] == original[field], field
    assert str(after["updated_at"]) != str(original["updated_at"])


def test_second_run_is_a_noop(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs")])
    main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])
    capsys.readouterr()
    after_first = store.read_bytes()

    rc = main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])

    assert rc == 0
    assert store.read_bytes() == after_first  # 幂等的根:已有的属主一个都不动
    assert "无可落项" in capsys.readouterr().out


def test_existing_owner_is_not_overwritten_without_reassign(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs", owner="7")])

    main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])

    assert _read_store(store)[0]["owner_user_id"] == "7"
    assert "已属主、未动" in capsys.readouterr().out


def test_duplicate_key_is_refused_and_its_owned_sibling_survives(
    tmp_path: Path, capsys
) -> None:
    """同一 key 有两条 ⇒ 拒绝回填,且**已属主那条一个字节都不动**。

    立因(2026-09-29,`scripts/owner-claim.mjs` 的前台巡检实测抓到):旧实现把记录按
    `by_key[key] = rec` 建模(每条 key 只留最后一条),于是"已有属主不动"的检查只看得到
    其中一条,而 `apply_plan` 是**按 key 写**的 —— 同一 key 里 owner=7 那条被顺手改成 42,
    而 dry-run 打印的仍是「改写已有属主 0 条」。按 key 回填在这个文件里表达不了"改哪一条"
    (没有第二个判别位),所以整型只能拒绝并点名,交人工先合条。
    """
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs", owner="7"), _rec("yuque:docs", owner="")])

    rc = main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])
    assert rc == 0, "拒绝某一条不该把整次执行判成失败(其余可回填的照落)"

    records = _read_store(store)
    assert [r.get("owner_user_id") or "" for r in records] == ["7", ""], (
        "重复 key 的两条都必须原样保留 —— 已属主那条被顺手改写就是本判据要防的事故"
    )
    out = capsys.readouterr().out
    assert "同一 key 有多条记录" in out and "1 个" in out, out


def test_duplicate_key_refusal_does_not_spill_onto_clean_keys(tmp_path: Path) -> None:
    """反向对照:拒绝只作用于重复的那条 key,单条的照常回填。

    只判前一条的话,"整表一律不落"也能绿 —— 那等于把工具判废了再夸它安全。
    """
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("dup:a", owner="7"), _rec("dup:a"), _rec("solo:b")])

    main(["--store", str(store), "--claim", "dup:a=42", "--claim", "solo:b=42", "--apply"])

    records = _read_store(store)
    assert [r.get("owner_user_id") or "" for r in records] == ["7", "", "42"]


def test_reassign_must_name_the_key(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs", owner="7")])

    # 没点名 ⇒ 拒绝整次执行(而不是"默默什么都不做"再报成功)
    rc = main(["--store", str(store), "--claim", "yuque:docs=42", "--reassign", "other:x", "--apply"])
    assert rc == 1
    assert _read_store(store)[0]["owner_user_id"] == "7"
    capsys.readouterr()

    rc = main(
        ["--store", str(store), "--claim", "yuque:docs=42", "--reassign", "yuque:docs", "--apply"]
    )
    assert rc == 0
    assert _read_store(store)[0]["owner_user_id"] == "42"
    out = capsys.readouterr().out
    assert "改写已有属主 1 条" in out


def test_unknown_key_is_reported_not_created(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs")])

    main(["--store", str(store), "--claim", "feishu:tidbits=42", "--apply"])

    keys = [r["key"] for r in _read_store(store)]
    assert keys == ["yuque:docs"]
    assert "点了名而文件里没有" in capsys.readouterr().out


def test_remaining_ownerless_are_listed_by_name(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs"), _rec("dingtalk:books"), _rec("wecom:docs")])

    main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])

    out = capsys.readouterr().out
    # 只给计数 = 拿到数字的人不知道是哪几条,也就没法去问原主
    assert "仍无主且未被点名:2 条" in out
    assert "dingtalk:books" in out and "wecom:docs" in out


def test_corrupt_store_exits_2_not_zero(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    store.write_text("{ 这不是合法 JSON", encoding="utf-8")

    rc = main(["--store", str(store), "--claim", "yuque:docs=42", "--apply"])

    assert rc == 2
    assert "无法判定" in capsys.readouterr().out
    assert store.read_text(encoding="utf-8").startswith("{ 这不是")  # 没被写成空 store


def test_empty_claims_is_refused(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs")])

    rc = main(["--store", str(store), "--apply"])

    assert rc == 1
    assert "拒绝" in capsys.readouterr().out


def test_output_never_echoes_record_contents(tmp_path: Path, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs")])

    main(["--store", str(store), "--claim", "yuque:docs=42", "--apply", "--json"])

    assert SECRET not in capsys.readouterr().out


@pytest.mark.parametrize("bad", ["=42", "noequals", "  =42"])
def test_malformed_claim_argument_is_refused(tmp_path: Path, bad: str, capsys) -> None:
    store = tmp_path / "connector_store.json"
    _write_store(store, [_rec("yuque:docs")])

    rc = main(["--store", str(store), "--claim", bad, "--apply"])

    assert rc == 1
    assert "拒绝" in capsys.readouterr().out
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
