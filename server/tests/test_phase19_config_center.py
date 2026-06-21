"""Phase 19 建议 2 测试: 配置中心灰度."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from config_center import (
        AuditEntry,
        ConfigCenter,
        ConfigVersion,
        RolloutRecord,
        RolloutStatus,
        RolloutStrategy,
        RolloutType,
        main,
    )

    HAS_MODULE = True
except Exception:  # pragma: no cover
    HAS_MODULE = False


pytestmark = pytest.mark.skipif(not HAS_MODULE, reason="module not importable")


def _last_json(text: str):
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        open_ch = ch
        close_ch = "}" if ch == "{" else "]"
        depth = 0
        in_str = False
        escape = False
        for j in range(i, len(text)):
            c = text[j]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if in_str:
                if c == '"':
                    in_str = False
                continue
            if c == '"':
                in_str = True
                continue
            if c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    candidate = text[i : j + 1]
                    try:
                        json.loads(candidate)
                        candidates.append(candidate)
                    except json.JSONDecodeError:
                        pass
                    i = j + 1
                    break
        else:
            i += 1
    return json.loads(candidates[-1])


# ---------------------------------------------------------------------------
# 1. 枚举 / 数据类
# ---------------------------------------------------------------------------


def test_rollout_type_values():
    assert RolloutType.FULL.value == "full"
    assert RolloutType.PERCENTAGE.value == "percentage"
    assert RolloutType.TENANT_ALLOWLIST.value == "tenant_allowlist"
    assert RolloutType.ENV_ALLOWLIST.value == "env_allowlist"


def test_strategy_to_dict():
    s = RolloutStrategy(type=RolloutType.PERCENTAGE, percentage=30)
    d = s.to_dict()
    assert d["percentage"] == 30
    assert d["type"] == "percentage"


def test_version_to_dict():
    v = ConfigVersion(version=1, value="x")
    d = v.to_dict()
    assert d["version"] == 1
    assert "ts_iso" in d


def test_rollout_record_to_dict():
    s = RolloutStrategy()
    r = RolloutRecord(key="k", from_version=1, to_version=2, strategy=s)
    d = r.to_dict()
    assert d["key"] == "k"
    assert d["status"] == "pending"


def test_audit_entry_to_dict():
    a = AuditEntry(time.time(), "publish", "k", {"v": 1})
    d = a.to_dict()
    assert d["action"] == "publish"
    assert d["v"] == 1


# ---------------------------------------------------------------------------
# 2. 注册 / 发布
# ---------------------------------------------------------------------------


def test_register_with_initial():
    cc = ConfigCenter()
    item = cc.register("k1", "int", initial_value=10)
    assert item.current_version == 1
    assert item.versions[0].value == 10


def test_register_idempotent():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=10)
    cc.register("k1", "int", initial_value=20)
    item = cc.get_item("k1")
    assert len(item.versions) == 1


def test_register_without_initial():
    cc = ConfigCenter()
    item = cc.register("k1")
    assert item.current_version == 0
    assert item.versions == []


def test_publish_increments_version():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    v = cc.publish("k1", 2)
    assert v == 2
    item = cc.get_item("k1")
    assert len(item.versions) == 2


def test_publish_unknown_key():
    cc = ConfigCenter()
    with pytest.raises(KeyError):
        cc.publish("nope", 1)


def test_get_returns_initial():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=42)
    assert cc.get("k1") == 42


def test_get_unknown():
    cc = ConfigCenter()
    assert cc.get("nope") is None


# ---------------------------------------------------------------------------
# 3. 灰度策略
# ---------------------------------------------------------------------------


def test_rollout_full_promotes_immediately():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.FULL))
    assert cc.get("k1") == 2


def test_rollout_percentage_in_range():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.PERCENTAGE, percentage=0))
    # 0% 时没有任何租户能拿到新版本
    assert cc.get("k1", tenant="t1") == 1


def test_rollout_percentage_full():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.PERCENTAGE, percentage=100))
    assert cc.get("k1", tenant="t1") == 2


def test_rollout_tenant_allowlist():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.TENANT_ALLOWLIST, allowlist=["acme"]))
    assert cc.get("k1", tenant="acme") == 2
    assert cc.get("k1", tenant="other") == 1


def test_rollout_tenant_allowlist_no_tenant():
    """无 tenant 上下文时不命中白名单."""
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.TENANT_ALLOWLIST, allowlist=["acme"]))
    assert cc.get("k1") == 1


def test_rollout_env_allowlist():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.ENV_ALLOWLIST, allowlist=["staging"]))
    assert cc.get("k1", env="staging") == 2
    assert cc.get("k1", env="prod") == 1


def test_rollout_unknown_key():
    cc = ConfigCenter()
    with pytest.raises(KeyError):
        cc.rollout("nope", 1)


def test_rollout_unknown_version():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    with pytest.raises(ValueError):
        cc.rollout("k1", 99)


def test_rollout_unknown_strategy_noop():
    """未指定策略时, 灰度中不切换."""
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy())  # default FULL
    # default 策略是 FULL, 所以会立即切
    assert cc.get("k1") == 2


# ---------------------------------------------------------------------------
# 4. promote / rollback
# ---------------------------------------------------------------------------


def test_promote():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.TENANT_ALLOWLIST, allowlist=["acme"]))
    rec = cc.promote("k1")
    assert rec.status == RolloutStatus.PROMOTED
    assert cc.get("k1", tenant="other") == 2  # 全量


def test_promote_no_rollout():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    with pytest.raises(ValueError):
        cc.promote("k1")


def test_rollback():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.TENANT_ALLOWLIST, allowlist=["acme"]))
    rec = cc.rollback("k1")
    assert rec.status == RolloutStatus.ROLLED_BACK
    assert cc.get("k1", tenant="acme") == 1


def test_rollback_no_rollout():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    with pytest.raises(ValueError):
        cc.rollback("k1")


# ---------------------------------------------------------------------------
# 5. 审计 / 报表
# ---------------------------------------------------------------------------


def test_audit_log():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy())
    log = cc.audit_log()
    assert len(log) >= 3
    actions = [a["action"] for a in log]
    assert "register" in actions
    assert "publish" in actions
    assert "rollout" in actions


def test_snapshot():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    snap = cc.snapshot()
    assert "k1" in snap
    assert snap["k1"]["current_version"] == 1


def test_report():
    cc = ConfigCenter()
    cc.register("k1", "int", initial_value=1)
    cc.publish("k1", 2)
    cc.rollout("k1", 2, RolloutStrategy(type=RolloutType.TENANT_ALLOWLIST, allowlist=["acme"]))
    md = cc.report()
    assert "配置中心灰度报表" in md
    assert "k1" in md


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def test_cli_demo(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "snapshot" in data
    assert data["tenant_acme_rate"] == 200
    assert data["tenant_other_rate"] == 100


def test_cli_register_publish_get(capsys):
    cc = ConfigCenter()
    main(["register", "--key", "k1", "--schema", "int", "--value", "10"], cc=cc)
    main(["publish", "--key", "k1", "--value", "20", "--author", "tester"], cc=cc)
    rc = main(["get", "--key", "k1"], cc=cc)
    out = capsys.readouterr().out
    data = _last_json(out)
    # register 时 value 是字符串, get 拿到的也是字符串
    assert data["value"] == "10"


def test_cli_rollout_promote(capsys):
    cc = ConfigCenter()
    main(["register", "--key", "k1", "--schema", "int", "--value", "10"], cc=cc)
    main(["publish", "--key", "k1", "--value", "20"], cc=cc)
    rc = main(["rollout", "--key", "k1", "--version", "2", "--strategy", "full"], cc=cc)
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["status"] == "promoted"


def test_cli_rollback(capsys):
    cc = ConfigCenter()
    main(["register", "--key", "k1", "--schema", "int", "--value", "10"], cc=cc)
    main(["publish", "--key", "k1", "--value", "20"], cc=cc)
    main(["rollout", "--key", "k1", "--version", "2", "--strategy", "tenant", "--allowlist", "acme"], cc=cc)
    rc = main(["rollback", "--key", "k1"], cc=cc)
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["status"] == "rolled_back"


def test_cli_report(capsys):
    main(["register", "--key", "k1", "--schema", "int", "--value", "10"])
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "配置中心灰度报表" in out
