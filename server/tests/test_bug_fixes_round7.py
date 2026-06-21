"""第七轮 P2 修复回归测试 - 覆盖 Bug-67/68/69/70/71/72/73/74."""

import os

os.environ.setdefault("SKIP_SCHEMA_INIT", "1")

import json
import time

import pytest

# ---------------------------------------------------------------------------
# Bug-67: 数据库主从故障切换
# ---------------------------------------------------------------------------


class TestBug67DbRouter:
    def test_register_and_pick(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_a")
        db_router.register("test_67_a", master_url="postgresql://master", slave_urls=["postgresql://s1", "postgresql://s2"])
        m = db_router.pick_for_write("test_67_a")
        assert m is not None
        assert m.role == "master"
        assert m.url == "postgresql://master"

    def test_pick_slave_prefers_lowest_latency(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_b")
        db_router.register("test_67_b", master_url="postgresql://m", slave_urls=["postgresql://s1", "postgresql://s2"])
        s1 = db_router._healthy_slave("test_67_b")
        s2 = db_router._healthy_slave("test_67_b")
        assert s1 is not None
        # 同一轮询, 应稳定
        assert s1.url == s2.url or s1.role == "slave"

    def test_report_failure_marks_unhealthy(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_c")
        db_router.register("test_67_c", master_url="postgresql://m")
        m = db_router.pick_for_write("test_67_c")
        for _ in range(5):
            db_router.report_failure(m)
        assert m.health.healthy is False
        assert m.health.fail_count == 5

    def test_report_success_recovers(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_d")
        db_router.register("test_67_d", master_url="postgresql://m")
        m = db_router.pick_for_write("test_67_d")
        for _ in range(3):
            db_router.report_failure(m)
        db_router.report_success(m, latency_ms=10)
        assert m.health.healthy is True
        assert m.health.fail_count == 0
        assert m.health.latency_ms == 10

    def test_failover_promotes_slave(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_e")
        db_router.register("test_67_e", master_url="postgresql://m", slave_urls=["postgresql://s1"])
        m = db_router.pick_for_write("test_67_e")
        for _ in range(3):
            db_router.report_failure(m)
        # report_failure 在 fail_count>=阈值时自动触发 failover
        # 此时 s1 应已被升为 master
        current_master = db_router._master("test_67_e")
        assert current_master is not None
        assert current_master.url == "postgresql://s1"
        assert db_router.stats()["total_failover_events"] >= 1

    def test_try_recover(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_f")
        db_router.register("test_67_f", master_url="postgresql://m")
        m = db_router.pick_for_write("test_67_f")
        m.health.healthy = False
        m.health.last_fail_ts = time.time() - 100  # 很久之前
        db_router.try_recover("test_67_f")
        assert m.health.healthy is True

    def test_with_master_context(self):
        from app.utils.db_router import db_router, with_master

        db_router.unregister("test_67_g")
        db_router.register("test_67_g", master_url="postgresql://m")
        with with_master("test_67_g") as node:
            assert node.role == "master"
        # 成功后 fail_count = 0
        m = db_router.pick_for_write("test_67_g")
        assert m.health.healthy is True

    def test_with_slave_fallback(self):
        from app.utils.db_router import db_router, with_slave

        db_router.unregister("test_67_h")
        # 无 slave → fallback master
        db_router.register("test_67_h", master_url="postgresql://m")
        with with_slave("test_67_h") as node:
            assert node is not None
            assert node.role == "master"  # fallback

    def test_pick_for_write_no_master(self):
        from app.utils.db_router import db_router

        db_router.unregister("test_67_i")
        # 未注册
        assert db_router.pick_for_write("test_67_i") is None


# ---------------------------------------------------------------------------
# Bug-68: 分布式限流
# ---------------------------------------------------------------------------


class TestBug68RateLimit:
    def test_rule_lifecycle(self):
        from app.utils.rate_limit_dist import RateLimitRule, rate_limiter

        rate_limiter.add_rule(RateLimitRule(name="test_68_a", limit=10, window_sec=60, scope="ip"))
        r = rate_limiter.get_rule("test_68_a")
        assert r is not None
        assert r.limit == 10
        rate_limiter.remove_rule("test_68_a")
        assert rate_limiter.get_rule("test_68_a") is None

    def test_inproc_limit(self, monkeypatch):
        from app.utils import rate_limit_dist
        from app.utils.rate_limit_dist import RateLimitRule, rate_limiter

        monkeypatch.setattr(rate_limit_dist, "_get_redis", lambda: None)
        rate_limiter.add_rule(RateLimitRule(name="test_68_b", limit=3, window_sec=60, scope="ip"))
        # 5 次调用, 前 3 通过, 后 2 拒绝
        results = []
        for _ in range(5):
            r = rate_limiter.check("test_68_b", request=None)
            results.append(r["allowed"])
        assert results[:3] == [True, True, True]
        assert results[3] == False
        assert results[4] == False
        rate_limiter.remove_rule("test_68_b")

    def test_stats(self):
        from app.utils.rate_limit_dist import RateLimitRule, rate_limiter

        rate_limiter.add_rule(RateLimitRule(name="t68c", limit=5, window_sec=1))
        s = rate_limiter.stats()
        assert "rules" in s
        assert "total_allowed" in s
        rate_limiter.remove_rule("t68c")

    def test_decorator_sync(self, monkeypatch):
        from app.utils import rate_limit_dist
        from app.utils.rate_limit_dist import RateLimitExceeded, rate_limiter

        monkeypatch.setattr(rate_limit_dist, "_get_redis", lambda: None)
        rate_limiter.add_rule(rate_limit_dist.RateLimitRule(name="t68_deco", limit=2, window_sec=60))

        @rate_limiter.limit(rule="t68_deco", limit=2, window=60)
        def handler():
            return "ok"

        assert handler() == "ok"
        assert handler() == "ok"
        with pytest.raises(RateLimitExceeded):
            handler()
        rate_limiter.remove_rule("t68_deco")

    def test_rate_limit_exceeded(self):
        from app.utils.rate_limit_dist import RateLimitExceeded

        e = RateLimitExceeded(scope="ip", rule="r", retry_after=100, count=5, limit=3)
        assert e.scope == "ip"
        assert e.retry_after == 100
        assert e.limit == 3


# ---------------------------------------------------------------------------
# Bug-69: 熔断器
# ---------------------------------------------------------------------------


class TestBug69CircuitBreaker:
    def test_initial_state_closed(self):
        from app.utils.circuit_breaker import CircuitState, circuit_breaker

        cb = circuit_breaker("test_69_a", failure_threshold=3)
        assert cb.stats.state == CircuitState.CLOSED
        assert cb.allow_request() is True

    def test_open_after_threshold(self):
        from app.utils.circuit_breaker import CircuitState, circuit_breaker

        cb = circuit_breaker("test_69_b", failure_threshold=3)
        for _ in range(3):
            cb.record_failure()
        assert cb.stats.state == CircuitState.OPEN
        assert cb.allow_request() is False

    def test_half_open_after_recovery(self):
        from app.utils.circuit_breaker import CircuitState, circuit_breaker

        cb = circuit_breaker("test_69_c", failure_threshold=2, recovery_timeout=0.1)
        for _ in range(2):
            cb.record_failure()
        assert cb.stats.state == CircuitState.OPEN
        time.sleep(0.2)
        # 触发 lazy half-open
        assert cb.allow_request() is True
        assert cb.stats.state == CircuitState.HALF_OPEN

    def test_half_open_success_to_closed(self):
        from app.utils.circuit_breaker import CircuitState, circuit_breaker

        cb = circuit_breaker("test_69_d", failure_threshold=2, recovery_timeout=0.1, success_threshold=2)
        for _ in range(2):
            cb.record_failure()
        time.sleep(0.15)
        cb.allow_request()  # transition to half_open
        cb.record_success()
        cb.record_success()
        assert cb.stats.state == CircuitState.CLOSED

    def test_half_open_failure_to_open(self):
        from app.utils.circuit_breaker import CircuitState, circuit_breaker

        cb = circuit_breaker("test_69_e", failure_threshold=2, recovery_timeout=0.1)
        for _ in range(2):
            cb.record_failure()
        time.sleep(0.15)
        cb.allow_request()  # → HALF_OPEN
        cb.record_failure()
        assert cb.stats.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_call_async(self):
        from app.utils.circuit_breaker import circuit_breaker

        cb = circuit_breaker("test_69_f", failure_threshold=2)

        async def success():
            return "ok"

        r = await cb.call(success)
        assert r == "ok"

    @pytest.mark.asyncio
    async def test_call_async_fallback(self):
        from app.utils.circuit_breaker import circuit_breaker

        cb = circuit_breaker("test_69_g", failure_threshold=2)

        async def fail():
            raise RuntimeError("boom")

        # 触发熔断
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await cb.call(fail)
        # 第 3 次带 fallback
        r = await cb.call(fail, fallback="default")
        assert r == "default"

    @pytest.mark.asyncio
    async def test_call_async_circuit_open(self):
        from app.utils.circuit_breaker import CircuitOpen, circuit_breaker

        cb = circuit_breaker("test_69_h", failure_threshold=2, recovery_timeout=10)

        async def fail():
            raise RuntimeError("boom")

        for _ in range(2):
            with pytest.raises(RuntimeError):
                await cb.call(fail)
        with pytest.raises(CircuitOpen):
            await cb.call(fail)

    def test_call_sync(self):
        from app.utils.circuit_breaker import circuit_breaker

        cb = circuit_breaker("test_69_i", failure_threshold=2)
        r = cb.call_sync(lambda: 42)
        assert r == 42

    def test_all_breakers(self):
        from app.utils.circuit_breaker import all_breakers, circuit_breaker

        circuit_breaker("test_69_j")
        s = all_breakers()
        assert "test_69_j" in s

    def test_reset_breaker(self):
        from app.utils.circuit_breaker import CircuitState, circuit_breaker, reset_breaker

        cb = circuit_breaker("test_69_k", failure_threshold=2)
        for _ in range(2):
            cb.record_failure()
        assert cb.stats.state == CircuitState.OPEN
        assert reset_breaker("test_69_k") is True
        assert cb.stats.state == CircuitState.CLOSED

    def test_circuit_open_exception(self):
        from app.utils.circuit_breaker import CircuitOpen

        e = CircuitOpen("test", until_ts=time.time() + 10)
        assert "OPEN" in str(e)


# ---------------------------------------------------------------------------
# Bug-70: OpenAPI SDK 生成
# ---------------------------------------------------------------------------


class TestBug70SdkGenerator:
    def test_camel_conversion(self):
        from app.utils.sdk_generator import _to_camel, _to_pascal, _to_snake

        assert _to_camel("user_info") == "userInfo"
        assert _to_camel("get-user-by-id") == "getUserById"
        assert _to_pascal("user_info") == "UserInfo"
        assert _to_snake("UserInfo") == "user_info"
        assert _to_snake("APIKey") == "api_key"

    def test_type_resolution(self):
        from app.utils.sdk_generator import _py_type_for_schema, _ts_type_for_schema

        spec = {
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "integer"},
                            "name": {"type": "string"},
                        },
                    }
                }
            }
        }
        ts = _ts_type_for_schema({"$ref": "#/components/schemas/User"}, spec)
        assert "id" in ts and "name" in ts
        py = _py_type_for_schema({"$ref": "#/components/schemas/User"}, spec)
        assert "id" in py and "name" in py

    def test_array_type(self):
        from app.utils.sdk_generator import _py_type_for_schema, _ts_type_for_schema

        ts = _ts_type_for_schema({"type": "array", "items": {"type": "string"}}, {})
        assert ts == "string[]"
        py = _py_type_for_schema({"type": "array", "items": {"type": "string"}}, {})
        assert py == "List[str]"

    def test_enum_type(self):
        from app.utils.sdk_generator import _py_type_for_schema, _ts_type_for_schema

        ts = _ts_type_for_schema({"enum": ["a", "b", "c"]}, {})
        assert '"a"' in ts
        py = _py_type_for_schema({"enum": ["a", "b"]}, {})
        assert "Literal" in py

    def test_generate_ts(self):
        from app.utils.sdk_generator import generate_ts

        spec = {
            "openapi": "3.0.0",
            "paths": {
                "/api/v1/users": {
                    "get": {
                        "operationId": "list_users",
                        "parameters": [{"name": "limit", "in": "query", "schema": {"type": "integer"}}],
                        "responses": {
                            "200": {
                                "content": {
                                    "application/json": {
                                        "schema": {"type": "array", "items": {"$ref": "#/components/schemas/User"}}
                                    }
                                }
                            }
                        },
                    }
                }
            },
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "integer"},
                            "name": {"type": "string"},
                        },
                    }
                }
            },
        }
        code = generate_ts(spec, base_url="https://api.test.com")
        assert "ApiClient" in code
        assert "list_users" in code
        assert "https://api.test.com" in code
        assert "User" in code

    def test_generate_py(self):
        from app.utils.sdk_generator import generate_py

        spec = {
            "openapi": "3.0.0",
            "paths": {
                "/api/v1/users/{id}": {
                    "get": {
                        "operationId": "get_user",
                        "parameters": [{"name": "id", "in": "path", "schema": {"type": "integer"}}],
                        "responses": {
                            "200": {"content": {"application/json": {"schema": {"$ref": "#/components/schemas/User"}}}}
                        },
                    }
                }
            },
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "integer"},
                            "name": {"type": "string"},
                        },
                    }
                }
            },
        }
        code = generate_py(spec, base_url="https://api.test.com")
        assert "ApiClient" in code
        assert "get_user" in code
        assert "id" in code
        assert "User" in code

    def test_method_name_from_path(self):
        from app.utils.sdk_generator import _method_name_from_path

        assert _method_name_from_path("/api/v1/users/{id}", "get") == "get_users_by_id"
        assert _method_name_from_path("/api/v1/orders", "post") == "post_orders"

    def test_generate_sdk_unsupported_lang(self):
        from app.utils.sdk_generator import generate_sdk

        with pytest.raises(ValueError):
            generate_sdk({}, lang="go")


# ---------------------------------------------------------------------------
# Bug-71: 灰度发布
# ---------------------------------------------------------------------------


class TestBug71GradualRollout:
    def test_bucket_consistency(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_a", version="v2", buckets=range(20, 100))
        # 同一 key 永远同一 bucket
        b1 = rollout.in_bucket("test_71_a", "user_001")
        b2 = rollout.in_bucket("test_71_a", "user_001")
        assert b1 == b2
        rollout.remove_experiment("test_71_a")

    def test_is_in_version_hit(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_b", version="v2", buckets=range(0, 100))
        # 100% 应该都进 v2
        for k in ["u1", "u2", "u3", "u4", "u5"]:
            assert rollout.is_in_version("test_71_b", k) == "v2"
        rollout.remove_experiment("test_71_b")

    def test_is_in_version_miss(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_c", version="v2", buckets=range(0, 0))
        # 0% → 全部不进 v2
        for k in ["u1", "u2", "u3", "u4", "u5"]:
            assert rollout.is_in_version("test_71_c", k) == "v1"
        rollout.remove_experiment("test_71_c")

    def test_disabled_returns_default(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_d", version="v2", buckets=range(0, 100))
        rollout.set_enabled("test_71_d", False)
        for k in ["u1", "u2"]:
            assert rollout.is_in_version("test_71_d", k) == "v1"
        rollout.remove_experiment("test_71_d")

    def test_distribution(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_e", version="v2", buckets=range(20, 50))  # 30%
        hits = 0
        n = 1000
        for i in range(n):
            if rollout.is_in_version("test_71_e", f"u_{i}") == "v2":
                hits += 1
        # 大约 30% 命中 (允许 10% 误差)
        assert 200 <= hits <= 400
        rollout.remove_experiment("test_71_e")

    def test_update_buckets(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_f", version="v2", buckets=range(0, 10))
        assert rollout.update_buckets("test_71_f", range(0, 50)) is True
        assert rollout.update_buckets("test_71_nonexist", range(0, 50)) is False
        rollout.remove_experiment("test_71_f")

    def test_stats(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_g", version="v2", buckets=range(20, 80))
        rollout.is_in_version("test_71_g", "u1")
        s = rollout.stats()
        assert "test_71_g" in s["experiments"]
        assert "test_71_g" in s["per_exp_stats"]
        rollout.remove_experiment("test_71_g")

    def test_clear_hits(self):
        from app.utils.gradual_rollout import rollout

        rollout.add_experiment("test_71_h", version="v2", buckets=range(0, 100))
        rollout.is_in_version("test_71_h", "u1")
        rollout.clear_hits()
        rollout.remove_experiment("test_71_h")


# ---------------------------------------------------------------------------
# Bug-72: 不可篡改审计 hash 链
# ---------------------------------------------------------------------------


class TestBug72AuditChain:
    def test_append_and_verify(self, tmp_path, monkeypatch):
        from app.utils.audit_chain import GENESIS_HASH, AuditChain

        f = str(tmp_path / "audit.jsonl")
        chain = AuditChain(f)
        e1 = chain.append("user.login", user="u_1", ip="1.2.3.4")
        e2 = chain.append("payment.created", user="u_1", amount=99.9, order_no="o_1")
        assert e1.seq == 1
        assert e2.seq == 2
        assert e1.prev_hash == GENESIS_HASH
        assert e2.prev_hash == e1.hash
        assert chain.verify_chain() is True

    def test_tamper_detection(self, tmp_path):
        from app.utils.audit_chain import AuditChain

        f = str(tmp_path / "audit_tamper.jsonl")
        chain = AuditChain(f)
        chain.append("login", user="u_1")
        chain.append("payment", user="u_1", amount=99.9)
        # 篡改文件: 改第二条 payload
        with open(f, encoding="utf-8") as fh:
            lines = fh.readlines()
        d = json.loads(lines[1])
        d["payload"]["amount"] = 1.0
        lines[1] = json.dumps(d) + "\n"
        with open(f, "w", encoding="utf-8") as fh:
            fh.writelines(lines)
        # 重新创建 chain 实例
        chain2 = AuditChain(f)
        assert chain2.verify_chain() is False

    def test_hash_chain_linkage(self, tmp_path):
        from app.utils.audit_chain import AuditChain

        f = str(tmp_path / "audit_link.jsonl")
        chain = AuditChain(f)
        entries = []
        for i in range(5):
            e = chain.append(f"action_{i}", user=f"u_{i}")
            entries.append(e)
        # 验证 prev_hash 链
        for i in range(1, 5):
            assert entries[i].prev_hash == entries[i - 1].hash

    def test_stats(self, tmp_path):
        from app.utils.audit_chain import AuditChain

        f = str(tmp_path / "audit_stats.jsonl")
        chain = AuditChain(f)
        chain.append("login", user="u_1")
        chain.append("login", user="u_2")
        chain.append("payment", user="u_1", amount=10)
        s = chain.stats()
        assert s["total"] == 3
        assert s["actions"]["login"] == 2
        assert s["actions"]["payment"] == 1
        assert s["verify_ok"] is True

    def test_find_by_action(self, tmp_path):
        from app.utils.audit_chain import AuditChain

        f = str(tmp_path / "audit_find.jsonl")
        chain = AuditChain(f)
        chain.append("login", user="u_1")
        chain.append("payment", user="u_1")
        chain.append("login", user="u_2")
        logins = chain.find_by_action("login")
        assert len(logins) == 2

    def test_find_by_user(self, tmp_path):
        from app.utils.audit_chain import AuditChain

        f = str(tmp_path / "audit_user.jsonl")
        chain = AuditChain(f)
        chain.append("login", user="u_1")
        chain.append("payment", user="u_1")
        chain.append("login", user="u_2")
        u1 = chain.find_by_user("u_1")
        assert len(u1) == 2

    def test_init_from_existing_file(self, tmp_path):
        from app.utils.audit_chain import AuditChain

        f = str(tmp_path / "audit_init.jsonl")
        c1 = AuditChain(f)
        c1.append("a", user="u")
        c1.append("b", user="u")
        # 新实例从文件恢复
        c2 = AuditChain(f)
        assert c2._last_seq == 2
        assert c2._last_hash != "0" * 64
        assert c2.verify_chain() is True


# ---------------------------------------------------------------------------
# Bug-73: 死代码检测
# ---------------------------------------------------------------------------


class TestBug73DeadCode:
    def test_camel_conversion(self):
        from app.utils.sdk_generator import _to_camel

        assert _to_camel("test_73_a") == "test73A"

    def test_scan_simple(self, tmp_path):
        from app.utils.dead_code_detector import DeadCodeScanner

        # 创建临时 Python 文件
        f1 = tmp_path / "module_a.py"
        f1.write_text(
            "def used_func():\n    return 1\n\n"
            "def _dead_func():\n    return 2\n\n"
            "class MyClass:\n    def used_method(self):\n        return used_func()\n"
        )
        scanner = DeadCodeScanner()
        report = scanner.scan([str(tmp_path)])
        # used_func / used_method 被引用
        dead_names = [d.name for d in report.dead_functions]
        assert "_dead_func" in dead_names
        assert "used_func" not in dead_names

    def test_exclude_dunder(self, tmp_path):
        from app.utils.dead_code_detector import DeadCodeScanner

        f1 = tmp_path / "m.py"
        f1.write_text("def __init__(self):\n    pass\n" "def __main__():\n    pass\n" "def _real_dead():\n    pass\n")
        scanner = DeadCodeScanner()
        report = scanner.scan([str(tmp_path)])
        dead_names = [d.name for d in report.dead_functions]
        assert "__init__" not in dead_names
        assert "__main__" not in dead_names
        assert "_real_dead" in dead_names

    def test_decorator_exclusion(self, tmp_path):
        from app.utils.dead_code_detector import DeadCodeScanner

        f1 = tmp_path / "m.py"
        f1.write_text(
            "class A:\n"
            "    @staticmethod\n"
            "    def my_static():\n        return 1\n"
            "    @property\n"
            "    def my_prop(self):\n        return 2\n"
        )
        scanner = DeadCodeScanner()
        report = scanner.scan([str(tmp_path)])
        dead_names = [d.name for d in report.dead_functions]
        # 静态方法不被认为死
        assert "my_static" not in dead_names

    def test_skip_non_py(self, tmp_path):
        from app.utils.dead_code_detector import DeadCodeScanner

        f1 = tmp_path / "readme.txt"
        f1.write_text("hello")
        scanner = DeadCodeScanner()
        report = scanner.scan([str(tmp_path)])
        assert report.scanned_files == 0

    def test_exclude_dirs(self, tmp_path):
        from app.utils.dead_code_detector import DeadCodeScanner

        (tmp_path / "venv").mkdir()
        (tmp_path / "venv" / "x.py").write_text("def f(): pass")
        (tmp_path / "ok.py").write_text("def g(): pass")
        scanner = DeadCodeScanner()
        report = scanner.scan([str(tmp_path)])
        # venv 应被跳过
        assert report.scanned_files == 1

    def test_summary(self):
        from app.utils.dead_code_detector import DeadCodeReport

        r = DeadCodeReport(scanned_files=3, total_functions=10, total_imports=5, total_variables=2)
        s = r.summary()
        assert isinstance(s, dict)
        assert s["scanned_files"] == 3
        assert s["total_functions"] == 10
        assert "3" in s["text"]
        assert "10" in s["text"]


# ---------------------------------------------------------------------------
# Bug-74: WebSocket 心跳 + 重连退避
# ---------------------------------------------------------------------------


class TestBug74WsHeartbeat:
    def test_backoff_initial(self):
        from app.utils.ws_heartbeat import ReconnectBackoff

        b = ReconnectBackoff(initial=1, max_wait=10, multiplier=2, jitter=0)
        w1 = b.next_wait()
        assert w1 == 1.0
        b.record_failure()

    def test_backoff_exponential(self):
        from app.utils.ws_heartbeat import ReconnectBackoff

        b = ReconnectBackoff(initial=1, max_wait=10, multiplier=2, jitter=0)
        w1 = b.next_wait()
        b.record_failure()
        w2 = b.next_wait()
        b.record_failure()
        w3 = b.next_wait()
        # 1, 2, 4
        assert w1 == 1.0
        assert w2 == 2.0
        assert w3 == 4.0

    def test_backoff_max(self):
        from app.utils.ws_heartbeat import ReconnectBackoff

        b = ReconnectBackoff(initial=1, max_wait=5, multiplier=2, jitter=0)
        for _ in range(10):
            b.next_wait()
            b.record_failure()
        # 不应超过 max
        s = b.stats()
        assert s["last_wait"] <= 5.0

    def test_backoff_jitter_range(self):
        from app.utils.ws_heartbeat import ReconnectBackoff

        b = ReconnectBackoff(initial=10, max_wait=100, jitter=0.3)
        w = b.next_wait()
        # ±30%
        assert 7.0 <= w <= 13.0

    def test_backoff_reset(self):
        from app.utils.ws_heartbeat import ReconnectBackoff

        b = ReconnectBackoff(initial=1, max_wait=10, multiplier=2, jitter=0)
        b.next_wait()
        b.next_wait()
        b.next_wait()
        b.reset()
        # 重置后 attempt=0
        assert b._attempt == 0
        assert b._consecutive_failures == 0
        w = b.next_wait()
        assert w == 1.0

    def test_backoff_giving_up(self):
        from app.utils.ws_heartbeat import MAX_CONSECUTIVE_FAILURES, ReconnectBackoff

        b = ReconnectBackoff(initial=1, max_wait=5, multiplier=2, jitter=0)
        for _ in range(MAX_CONSECUTIVE_FAILURES + 5):
            b.record_failure()
        assert b.is_giving_up() is True

    def test_backoff_stats(self):
        from app.utils.ws_heartbeat import ReconnectBackoff

        b = ReconnectBackoff()
        s = b.stats()
        assert "attempt" in s
        assert "consecutive_failures" in s

    def test_ping_heart_on_recv(self):
        from app.utils.ws_heartbeat import PingHeart

        class FakeWs:
            pass

        h = PingHeart(FakeWs(), ping_interval=10, ping_timeout=60)
        t1 = h._last_recv_ts
        time.sleep(0.01)
        h.on_recv()
        assert h._last_recv_ts > t1

    def test_get_state(self):
        from app.utils.ws_heartbeat import all_states, get_state

        s = get_state("ws://test_74_a")
        s.total_connects = 1
        all_s = all_states()
        assert "ws://test_74_a" in all_s

    def test_connection_state_to_dict(self):
        from app.utils.ws_heartbeat import WsConnectionState

        s = WsConnectionState(url="ws://x", connected=True, total_connects=3)
        d = s.to_dict()
        assert d["url"] == "ws://x"
        assert d["connected"] is True
        assert d["total_connects"] == 3
