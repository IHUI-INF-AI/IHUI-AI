"""Phase 17 建议 2 测试: Coze 多租户隔离."""

from __future__ import annotations

import json
import time

import pytest

try:
    from scripts.ops.coze_tenant_isolation import (
        ApiKey,
        AuditAction,
        AuditEntry,
        AuditLog,
        QuotaTracker,
        RateLimiter,
        Tenant,
        TenantManager,
        TenantQuota,
        TenantStatus,
        TenantTier,
        main,
    )

    HAS_MODULE = True
except ImportError:
    HAS_MODULE = False
    TenantTier = TenantStatus = AuditAction = None
    Tenant = ApiKey = TenantQuota = AuditEntry = None
    QuotaTracker = RateLimiter = AuditLog = TenantManager = main = None


# ---------------------------------------------------------------------------
# 1. Tenant / ApiKey / TenantQuota
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tenant_init():
    t = Tenant(id="t1", name="acme")
    assert t.id == "t1"
    assert t.tier == TenantTier.FREE
    assert t.status == TenantStatus.ACTIVE


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_tenant_to_dict():
    t = Tenant(id="t1", name="acme", tier=TenantTier.PRO)
    d = t.to_dict()
    assert d["id"] == "t1"
    assert d["tier"] == "pro"
    assert d["status"] == "active"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_api_key_valid():
    k = ApiKey(key_id="k1", key_hash="abc", tenant_id="t1")
    assert k.is_valid() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_api_key_revoked():
    k = ApiKey(key_id="k1", key_hash="abc", tenant_id="t1", revoked=True)
    assert k.is_valid() is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_api_key_expired():
    k = ApiKey(key_id="k1", key_hash="abc", tenant_id="t1", expires_at=time.time() - 100)
    assert k.is_valid() is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_api_key_not_yet_expired():
    k = ApiKey(key_id="k1", key_hash="abc", tenant_id="t1", expires_at=time.time() + 100)
    assert k.is_valid() is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_defaults():
    q = TenantQuota()
    assert q.rpm == 60
    assert q.tpm == 100_000


# ---------------------------------------------------------------------------
# 2. QuotaTracker
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_init():
    q = QuotaTracker()
    assert q.rpm_current("t1") == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_record_request():
    q = QuotaTracker()
    q.record_request("t1")
    assert q.rpm_current("t1") == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_window_cleanup():
    q = QuotaTracker(window_seconds=1)
    q.record_request("t1", ts=time.time() - 5)
    assert q.rpm_current("t1") == 0  # 已过期


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_check_rpm():
    q = QuotaTracker()
    quota = TenantQuota(rpm=3)
    assert q.check_rpm("t1", quota) is True
    q.record_request("t1")
    q.record_request("t1")
    q.record_request("t1")
    assert q.check_rpm("t1", quota) is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_daily_count():
    q = QuotaTracker()
    for _ in range(5):
        q.record_request("t1")
    assert q.daily_count("t1") == 5


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_monthly_cost():
    q = QuotaTracker()
    q.record_request("t1", cost=0.5)
    q.record_request("t1", cost=0.3)
    assert abs(q.monthly_cost("t1") - 0.8) < 0.01


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_concurrent():
    q = QuotaTracker()
    q.acquire_slot("t1")
    q.acquire_slot("t1")
    assert q.concurrent_count("t1") == 2
    q.release_slot("t1")
    assert q.concurrent_count("t1") == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_quota_tracker_release_zero_safe():
    q = QuotaTracker()
    q.release_slot("t1")
    assert q.concurrent_count("t1") == 0  # 不变负


# ---------------------------------------------------------------------------
# 3. RateLimiter
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_rate_limiter_init():
    r = RateLimiter(capacity=5, refill_rate=1.0)
    assert r.available() <= 5


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_rate_limiter_acquire():
    r = RateLimiter(capacity=3, refill_rate=0.0)
    assert r.acquire() is True
    assert r.acquire() is True
    assert r.acquire() is True
    assert r.acquire() is False  # 没 token 了


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_rate_limiter_refill():
    r = RateLimiter(capacity=1, refill_rate=100.0)  # 100 tokens/s
    r.acquire()
    time.sleep(0.05)
    assert r.acquire() is True  # refill 后又有


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_rate_limiter_multi_tokens():
    r = RateLimiter(capacity=5, refill_rate=0.0)
    assert r.acquire(3) is True
    assert r.acquire(3) is False  # 只剩 2


# ---------------------------------------------------------------------------
# 4. AuditLog
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_init():
    a = AuditLog()
    assert len(a) == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_append():
    a = AuditLog()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    assert len(a) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_query_by_tenant():
    a = AuditLog()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    a.append("t2", "k2", AuditAction.API_KEY_USED)
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    r = a.query(tenant_id="t1")
    assert len(r) == 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_query_by_action():
    a = AuditLog()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    a.append("t1", "k1", AuditAction.QUOTA_EXCEEDED)
    r = a.query(action="quota_exceeded")
    assert len(r) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_query_limit():
    a = AuditLog()
    for _ in range(20):
        a.append("t1", "k1", AuditAction.API_KEY_USED)
    r = a.query(limit=5)
    assert len(r) == 5


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_query_since():
    a = AuditLog()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    time.sleep(0.01)
    cutoff = time.time()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    r = a.query(since=cutoff)
    assert len(r) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_to_json():
    a = AuditLog()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    js = a.to_json()
    d = json.loads(js)
    assert len(d) == 1


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_max_entries():
    a = AuditLog(max_entries=10)
    for _ in range(20):
        a.append("t1", "k1", AuditAction.API_KEY_USED)
    assert len(a) == 10


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_audit_log_clear():
    a = AuditLog()
    a.append("t1", "k1", AuditAction.API_KEY_USED)
    a.clear()
    assert len(a) == 0


# ---------------------------------------------------------------------------
# 5. TenantManager 基础
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_init():
    m = TenantManager()
    assert len(m.list_tenants()) == 0


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_create_tenant():
    m = TenantManager()
    t = m.create_tenant("acme", tier="pro")
    assert t.name == "acme"
    assert t.tier == TenantTier.PRO
    assert t.status == TenantStatus.ACTIVE


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_create_tenant_duplicate():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    with pytest.raises(ValueError):
        m.create_tenant("b", tenant_id="t1")


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_get_tenant():
    m = TenantManager()
    t = m.create_tenant("a", tenant_id="t1")
    assert m.get_tenant("t1") is t
    assert m.get_tenant("nope") is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_list_tenants_by_status():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    m.create_tenant("b", tenant_id="t2")
    m.suspend_tenant("t1")
    actives = m.list_tenants(status=TenantStatus.ACTIVE)
    assert len(actives) == 1
    assert actives[0].id == "t2"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_suspend_tenant_not_found():
    m = TenantManager()
    assert m.suspend_tenant("nope") is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_default_quota_per_tier():
    m = TenantManager()
    free = m.create_tenant("a", tier="free")
    pro = m.create_tenant("b", tier="pro")
    ent = m.create_tenant("c", tier="enterprise")
    assert m.get_quota(free.id).rpm == 10
    assert m.get_quota(pro.id).rpm == 60
    assert m.get_quota(ent.id).rpm == 600


# ---------------------------------------------------------------------------
# 6. API key
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_create_api_key():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    plaintext, k = m.create_api_key("t1", scopes=["read"])
    assert plaintext.startswith("zhs_")
    assert k.tenant_id == "t1"
    assert "read" in k.scopes


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_create_key_tenant_not_found():
    m = TenantManager()
    with pytest.raises(ValueError):
        m.create_api_key("nope")


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_revoke_key():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    _, k = m.create_api_key("t1")
    assert m.revoke_api_key(k.key_id) is True
    assert k.revoked is True


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_revoke_key_not_found():
    m = TenantManager()
    assert m.revoke_api_key("nope") is False


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_authenticate_success():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    plaintext, k = m.create_api_key("t1")
    result = m.authenticate(plaintext)
    assert result is not None
    auth_k, t = result
    assert auth_k.key_id == k.key_id
    assert t.id == "t1"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_authenticate_invalid_prefix():
    m = TenantManager()
    result = m.authenticate("invalid_key")
    assert result is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_authenticate_unknown_key():
    m = TenantManager()
    result = m.authenticate("zhs_unknown_key")
    assert result is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_authenticate_revoked():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    plaintext, k = m.create_api_key("t1")
    m.revoke_api_key(k.key_id)
    result = m.authenticate(plaintext)
    assert result is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_authenticate_suspended_tenant():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    plaintext, _ = m.create_api_key("t1")
    m.suspend_tenant("t1")
    result = m.authenticate(plaintext)
    assert result is None


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_authenticate_expired():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    plaintext, _ = m.create_api_key("t1", expires_in_s=0.01)
    time.sleep(0.05)
    result = m.authenticate(plaintext)
    assert result is None


# ---------------------------------------------------------------------------
# 7. 配额检查
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_check_no_quota():
    m = TenantManager()
    allowed, reason = m.check_request_allowed("unknown")
    assert allowed is False
    assert reason == "no_quota"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_check_rpm_exceeded():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1", tier="free")  # rpm=10
    # 跑 10 次
    for _ in range(10):
        allowed, _ = m.check_request_allowed("t1")
        if allowed:
            m.record_usage("t1")
    # 第 11 次
    allowed, reason = m.check_request_allowed("t1")
    assert allowed is False
    assert reason == "rpm_exceeded"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_check_daily_exceeded():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    m.set_quota("t1", TenantQuota(rpm=1000, daily_requests=3))
    for _ in range(3):
        m.record_usage("t1")
    allowed, reason = m.check_request_allowed("t1")
    assert allowed is False
    assert reason == "daily_exceeded"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_check_monthly_cost_exceeded():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    m.set_quota("t1", TenantQuota(rpm=1000, daily_requests=1000, monthly_cost_usd=1.0))
    m.record_usage("t1", cost=1.5)
    allowed, reason = m.check_request_allowed("t1")
    assert allowed is False
    assert reason == "monthly_cost_exceeded"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_check_concurrent_exceeded():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    m.set_quota("t1", TenantQuota(rpm=1000, max_concurrent=2))
    m._quota_tracker.acquire_slot("t1")
    m._quota_tracker.acquire_slot("t1")
    allowed, reason = m.check_request_allowed("t1")
    assert allowed is False
    assert reason == "concurrent_exceeded"


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_get_usage():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    m.record_usage("t1", tokens=100, cost=0.05)
    u = m.get_usage("t1")
    assert u["daily"] == 1
    assert abs(u["monthly_cost_usd"] - 0.05) < 0.01


# ---------------------------------------------------------------------------
# 8. 审计
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_audit_query():
    m = TenantManager()
    m.create_tenant("a", tenant_id="t1")
    m.create_api_key("t1")
    entries = m.audit_query("t1")
    # tenant_created + api_key_created + api_key_used
    assert len(entries) >= 2


@pytest.mark.skipif(not HAS_MODULE, reason="module not importable")
def test_manager_audit_export_json():
    m = TenantManager()
    m.create_tenant("a")
    js = m.audit_export_json()
    d = json.loads(js)
    assert len(d) >= 1


# ---------------------------------------------------------------------------
# 9. CLI
# ---------------------------------------------------------------------------


def test_cli_create_tenant(capsys):
    mgr = TenantManager()
    code = main(["create-tenant", "--name", "acme", "--tier", "pro", "--id", "t1"], mgr=mgr)
    assert code == 0
    out = capsys.readouterr().out
    d = json.loads(out)
    assert d["name"] == "acme"
    assert d["tier"] == "pro"


def test_cli_create_key(capsys):
    mgr = TenantManager()
    main(["create-tenant", "--name", "a", "--id", "t1"], mgr=mgr)
    code = main(["create-key", "--tenant", "t1"], mgr=mgr)
    assert code == 0
    out = capsys.readouterr().out
    assert "zhs_" in out


def test_cli_auth(capsys):
    mgr = TenantManager()
    main(["create-tenant", "--name", "a", "--id", "t1"], mgr=mgr)
    # 拿明文 key
    import contextlib
    import io

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        main(["create-key", "--tenant", "t1"], mgr=mgr)
    plaintext = ""
    for line in buf.getvalue().splitlines():
        if "zhs_" in line:
            plaintext = line.split("zhs_")[1].strip()
            plaintext = "zhs_" + plaintext
            break
    code = main(["auth", "--key", plaintext], mgr=mgr)
    assert code == 0
    out = capsys.readouterr().out
    assert "t1" in out


def test_cli_check(capsys):
    mgr = TenantManager()
    main(["create-tenant", "--name", "a", "--id", "t1", "--tier", "pro"], mgr=mgr)
    code = main(["check", "--tenant", "t1"], mgr=mgr)
    assert code == 0
    out = capsys.readouterr().out
    # 取最后一个 JSON 对象
    d = _last_json(out)
    assert d["allowed"] is True


def test_cli_audit(capsys):
    mgr = TenantManager()
    main(["create-tenant", "--name", "a", "--id", "t1"], mgr=mgr)
    code = main(["audit", "--tenant", "t1"], mgr=mgr)
    assert code == 0


def test_cli_list_tenants(capsys):
    mgr = TenantManager()
    main(["create-tenant", "--name", "a", "--id", "t1"], mgr=mgr)
    main(["create-tenant", "--name", "b", "--id", "t2"], mgr=mgr)
    code = main(["list-tenants"], mgr=mgr)
    assert code == 0
    out = capsys.readouterr().out
    d = _last_json(out)
    assert len(d) >= 2


def _last_json(text: str):
    """从文本中提取最后一个完整的顶层 JSON 对象或数组.

    算法: 从每个可能的 { 或 [ 起始位置开始, 用括号平衡配对找到第一个完整 JSON 块.
    所有 valid 候选中取最后一个.
    """
    text = text.strip()
    candidates: list[str] = []
    i = 0
    while i < len(text):
        ch = text[i]
        if ch not in "{[":
            i += 1
            continue
        # 找对应的 } 或 ]
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
            # 没找到平衡
            i += 1
    if not candidates:
        raise ValueError(f"未找到 JSON: {text[:200]}")
    return json.loads(candidates[-1])
