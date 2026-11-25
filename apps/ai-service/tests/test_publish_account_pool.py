# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号池 + 会话守护的纯函数单测(2026-11-25)。

这里只钉"判定与投影"这类不需要 DB/浏览器的部分;真探活走 adapter,
由各 adapter 自己的测试覆盖。重点防回归:
  - 池状态不能把"没体检过"误报成"掉了";
  - 失效分类不能把网络抖动当登录失效(否则会天天喊人重扫);
  - 下一轮体检必须有抖动,避免 20 个号同一秒撞平台。
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from app.services.publish import account_pool, session_keeper


def _pool_row(**over):
    row = {
        "pool_id": "pool_test",
        "platform": "csdn",
        "name": "默认账号池",
        "strategy": "least_recent",
        "min_healthy": 1,
        "max_daily_posts": 0,
        "probe_interval_minutes": 45,
        "auto_reauth": True,
        "created_at": None,
        "updated_at": None,
    }
    row.update(over)
    return row


def test_pool_status_pending_when_never_probed():
    """有号但一份体检报告都没有 → pending,不冤成 degraded。"""
    data = account_pool._serialize_pool(_pool_row(), total=2, healthy=0, reauth=0)
    assert data["status"] == "pending"
    assert data["healthy"] == 0


def test_pool_status_healthy_meets_minimum():
    data = account_pool._serialize_pool(_pool_row(min_healthy=1), total=3, healthy=1, reauth=2)
    assert data["status"] == "healthy"


def test_pool_status_degraded_only_when_reauth_required():
    data = account_pool._serialize_pool(_pool_row(min_healthy=2), total=3, healthy=1, reauth=1)
    assert data["status"] == "degraded"


def test_pool_status_degraded_when_probe_failed():
    data = account_pool._serialize_pool(_pool_row(), total=2, healthy=0, reauth=0, degraded=1)
    assert data["status"] == "degraded"


def test_pool_status_empty():
    data = account_pool._serialize_pool(_pool_row(), total=0, healthy=0, reauth=0)
    assert data["status"] == "empty"


def test_classify_login_failure():
    assert session_keeper._classify("cookie expired (redirected to login)") == "expired"
    assert session_keeper._classify("HTTP 401 unauthorized") == "expired"
    assert session_keeper._classify("未登录,请重新扫码") == "expired"


def test_403_is_not_treated_as_login_expiry():
    """WAF/反爬 403 不是登录失效,别把人喊去重扫。"""
    assert session_keeper._classify("HTTP 403 forbidden") != "expired"


def test_classify_network_is_retryable_not_reauth():
    assert session_keeper._classify("体检超时(90s)") == "network"
    assert session_keeper._classify("http error: ConnectError") == "network"


def test_classify_config_failure_not_cookie_expiry():
    assert session_keeper._classify("missing UserName cookie") == "config_error"
    assert session_keeper._classify("WeChat API 40164 invalid ip") == "config_error"


def test_next_probe_has_jitter_and_floor():
    base = datetime(2026, 11, 25, 6, 0, tzinfo=timezone.utc)
    seen = set()
    for _ in range(50):
        nxt = session_keeper._next_probe(60, 0.2, base=base)
        delta = (nxt - base).total_seconds() / 60
        assert 48 <= delta <= 72
        seen.add(round(delta, 3))
    assert len(seen) > 1


def test_next_probe_never_below_three_minutes():
    base = datetime(2026, 11, 25, 6, 0, tzinfo=timezone.utc)
    nxt = session_keeper._next_probe(5, 0.5, base=base)
    assert nxt - base >= timedelta(minutes=3)


def test_pool_router_exposes_single_entry_paths():
    paths = {getattr(r, "path", "") for r in account_pool.router.routes}
    assert "/publish/pools" in paths
    assert "/publish/pools/bootstrap" in paths
    assert "/publish/pools/accounts/{account_id}/probe" in paths
    assert "/publish/pools/accounts/{account_id}/reauth" in paths
    assert "/publish/pools/{pid}/probe" in paths


def test_least_recent_ignores_priority_and_picks_oldest():
    from datetime import datetime

    rows = [
        {"session_status": "healthy", "priority": 200, "last_used_at": datetime(2026, 11, 25)},
        {"session_status": "healthy", "priority": 100, "last_used_at": datetime(2026, 11, 20)},
    ]
    chosen = sorted(rows, key=lambda r: account_pool._pool_sort_key(r, "least_recent"))[0]
    assert chosen["priority"] == 100


def test_priority_strategy_prefers_larger_number():
    from datetime import datetime

    rows = [
        {"session_status": "healthy", "priority": 100, "last_used_at": datetime(2026, 11, 20)},
        {"session_status": "healthy", "priority": 200, "last_used_at": datetime(2026, 11, 25)},
    ]
    chosen = sorted(rows, key=lambda r: account_pool._pool_sort_key(r, "priority"))[0]
    assert chosen["priority"] == 200


def test_health_beats_priority_in_both_strategies():
    from datetime import datetime

    degraded = {"session_status": "degraded", "priority": 1000, "last_used_at": datetime(2026, 11, 20)}
    healthy = {"session_status": "healthy", "priority": 0, "last_used_at": datetime(2026, 11, 25)}
    for strategy in ("priority", "least_recent", "round_robin"):
        chosen = sorted([degraded, healthy], key=lambda r: account_pool._pool_sort_key(r, strategy))[0]
        assert chosen["session_status"] == "healthy"


def test_api_platform_skips_cookie_refresh():
    class ApiAdapter:
        needs_browser = False

    ok, msg, ms = asyncio.run(session_keeper._refresh_session(1, "wechat", ApiAdapter(), timeout=5))
    assert ok is True
    assert "无需刷新" in msg
    assert ms == 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
