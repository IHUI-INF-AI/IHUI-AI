"""Phase 18 建议 2 测试: 边缘计算网关."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "ops"))

try:
    from edge_gateway import (
        CacheRule,
        CanaryStatus,
        EdgeFunction,
        EdgeGateway,
        EdgeNode,
        NodeStatus,
        SyncStatus,
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


def test_enum_values():
    assert NodeStatus.ONLINE.value == "online"
    assert SyncStatus.IN_SYNC.value == "in_sync"
    assert CanaryStatus.ROLLOUT.value == "rollout"


def test_node_init():
    n = EdgeNode("n1", "us-east-1", "NYC")
    assert n.status == NodeStatus.ONLINE
    assert n.last_sync_status == SyncStatus.PENDING


def test_rule_init():
    r = CacheRule("/api/*", ttl_seconds=60)
    assert r.cache_key == "url"
    assert r.compress is True


def test_function_hash():
    f = EdgeFunction("auth", 1, code="x=1")
    assert f.code_hash != ""


# ---------------------------------------------------------------------------
# 2. 节点 / 规则 / 函数管理
# ---------------------------------------------------------------------------


def test_add_remove_node():
    gw = EdgeGateway()
    gw.add_node(EdgeNode("n1", "us-east-1", "NYC"))
    assert "n1" in gw.nodes
    gw.remove_node("n1")
    assert "n1" not in gw.nodes


def test_rule_lifecycle():
    gw = EdgeGateway()
    gw.add_rule(CacheRule("/a", ttl_seconds=60))
    gw.add_rule(CacheRule("/b", ttl_seconds=120))
    assert len(gw.rules) == 2
    ok = gw.remove_rule("/a")
    assert ok is True
    assert len(gw.rules) == 1


def test_rule_remove_not_found():
    gw = EdgeGateway()
    assert gw.remove_rule("/not-here") is False


def test_enabled_rules():
    gw = EdgeGateway()
    gw.add_rule(CacheRule("/a", ttl_seconds=60, enabled=True))
    gw.add_rule(CacheRule("/b", ttl_seconds=60, enabled=False))
    assert len(gw.enabled_rules()) == 1


def test_deploy_function():
    gw = EdgeGateway()
    gw.deploy_function(EdgeFunction("auth", 1, code="x"))
    assert "auth" in gw.functions


def test_deploy_function_update_version():
    gw = EdgeGateway()
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.start_canary("auth", 1, percentage=10)
    gw.deploy_function(EdgeFunction("auth", 2))
    assert gw.canary["auth"].version == 2


# ---------------------------------------------------------------------------
# 3. 灰度
# ---------------------------------------------------------------------------


def test_start_canary():
    gw = EdgeGateway()
    dep = gw.start_canary("auth", 1, percentage=30, allowlist=["n1"])
    assert dep.percentage == 30
    assert "n1" in dep.allowlist
    assert dep.status == CanaryStatus.ROLLOUT


def test_update_canary():
    gw = EdgeGateway()
    gw.start_canary("auth", 1, percentage=10)
    dep = gw.update_canary("auth", 50)
    assert dep.percentage == 50


def test_update_canary_clamp():
    gw = EdgeGateway()
    gw.start_canary("auth", 1, percentage=50)
    gw.update_canary("auth", 200)
    assert gw.canary["auth"].percentage == 100
    gw.update_canary("auth", -10)
    assert gw.canary["auth"].percentage == 0


def test_update_canary_promoted_blocked():
    gw = EdgeGateway()
    gw.start_canary("auth", 1, percentage=10)
    gw.promote_canary("auth")
    # 升级后不能 update
    assert gw.update_canary("auth", 50) is None


def test_promote_canary():
    gw = EdgeGateway()
    gw.start_canary("auth", 1, percentage=10)
    dep = gw.promote_canary("auth")
    assert dep.status == CanaryStatus.PROMOTED
    assert dep.percentage == 100
    assert dep.promoted_ts is not None


def test_rollback_canary():
    gw = EdgeGateway()
    gw.start_canary("auth", 1, percentage=50)
    dep = gw.rollback_canary("auth")
    assert dep.status == CanaryStatus.ROLLED_BACK
    assert dep.percentage == 0


def test_is_canary_no_deployment():
    gw = EdgeGateway()
    assert gw.is_canary_for_node("auth", "n1") is False


def test_is_canary_promoted_full():
    gw = EdgeGateway()
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.start_canary("auth", 1, percentage=10)
    gw.promote_canary("auth")
    assert gw.is_canary_for_node("auth", "n1") is True


def test_is_canary_zero():
    gw = EdgeGateway()
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.start_canary("auth", 1, percentage=0)
    assert gw.is_canary_for_node("auth", "n1") is False


def test_is_canary_allowlist():
    gw = EdgeGateway()
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.start_canary("auth", 1, percentage=0, allowlist=["n1"])
    assert gw.is_canary_for_node("auth", "n1") is True
    assert gw.is_canary_for_node("auth", "n2") is False


def test_is_canary_100_pct():
    gw = EdgeGateway()
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.start_canary("auth", 1, percentage=100)
    assert gw.is_canary_for_node("auth", "n1") is True


# ---------------------------------------------------------------------------
# 4. 同步
# ---------------------------------------------------------------------------


def test_sync_to_node():
    gw = EdgeGateway()
    n = EdgeNode("n1", "us-east-1", "NYC")
    gw.add_node(n)
    ok = gw.sync_to_node("n1")
    assert ok is True
    assert n.last_sync_status == SyncStatus.IN_SYNC
    assert n.last_sync_ts > 0


def test_sync_to_node_offline():
    gw = EdgeGateway()
    n = EdgeNode("n1", "us-east-1", "NYC", status=NodeStatus.OFFLINE)
    gw.add_node(n)
    ok = gw.sync_to_node("n1")
    assert ok is False
    assert n.last_sync_status == SyncStatus.FAILED


def test_sync_to_node_unknown():
    gw = EdgeGateway()
    assert gw.sync_to_node("not-here") is False


def test_sync_hook_failure():
    gw = EdgeGateway()
    n = EdgeNode("n1", "us-east-1", "NYC")
    gw.add_node(n)
    gw.set_sync_hook(lambda *_: False)
    ok = gw.sync_to_node("n1")
    assert ok is False
    assert n.last_sync_status == SyncStatus.FAILED


def test_sync_hook_exception():
    gw = EdgeGateway()
    n = EdgeNode("n1", "us-east-1", "NYC")
    gw.add_node(n)

    def bad_hook(*_):
        raise RuntimeError("boom")

    gw.set_sync_hook(bad_hook)
    ok = gw.sync_to_node("n1")
    assert ok is False
    assert n.last_sync_status == SyncStatus.FAILED
    assert "boom" in n.last_error


def test_sync_all():
    gw = EdgeGateway()
    gw.add_node(EdgeNode("n1", "us-east-1", "NYC"))
    gw.add_node(EdgeNode("n2", "us-west-2", "SEA"))
    results = gw.sync_all()
    assert results == {"n1": True, "n2": True}


# ---------------------------------------------------------------------------
# 5. 报表
# ---------------------------------------------------------------------------


def test_summary():
    gw = EdgeGateway()
    gw.add_node(EdgeNode("n1", "us-east-1", "NYC"))
    gw.add_rule(CacheRule("/a", ttl_seconds=60))
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.sync_to_node("n1")
    s = gw.summary()
    assert s["nodes_total"] == 1
    assert s["nodes_in_sync"] == 1
    assert s["rules_count"] == 1
    assert s["functions_count"] == 1


def test_report():
    gw = EdgeGateway()
    gw.add_node(EdgeNode("n1", "us-east-1", "NYC"))
    gw.add_rule(CacheRule("/a", ttl_seconds=60))
    gw.deploy_function(EdgeFunction("auth", 1))
    gw.start_canary("auth", 1, percentage=20, allowlist=["n1"])
    gw.sync_to_node("n1")
    md = gw.report()
    assert "边缘计算网关报表" in md
    assert "n1" in md
    assert "auth" in md
    assert "20%" in md


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def test_cli_demo_sync(capsys):
    rc = main(["demo"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert "summary" in data
    assert "results" in data


def test_cli_demo_canary(capsys):
    rc = main(["demo", "--simulate", "canary"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["canary"] == "started"
    assert "rollout" in data


def test_cli_demo_rollback(capsys):
    rc = main(["demo", "--simulate", "rollback"])
    out = capsys.readouterr().out
    data = _last_json(out)
    assert data["status"] == "rolled_back"


def test_cli_report(capsys):
    rc = main(["report"])
    out = capsys.readouterr().out
    assert "边缘计算网关报表" in out
