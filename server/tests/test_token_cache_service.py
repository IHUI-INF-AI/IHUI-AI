"""token_cache_service 单元测试 (Phase 14 加法启用).

覆盖业务模块 app/services/token_cache_service.py:
  - get_balance_cached: Redis 命中 / 未命中查 DB / 异常隔离
  - invalidate_balance_cache: 清缓存 / 异常隔离
  - update_token_with_cache: 写缓存 / 异常隔离
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from app.services import token_cache_service as tc

# ---------------------------------------------------------------------------
# 1. get_balance_cached — Redis 命中
# ---------------------------------------------------------------------------


class TestGetBalanceCachedRedisHit:
    def test_redis_hit_returns_cached(self):
        cached_data = {"user_uuid": "u1", "token_balance": 100}
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.get.return_value = json.dumps(cached_data)
            r = tc.get_balance_cached("u1")
            assert r == cached_data
            mock_redis.get.assert_called_once_with("zhs:token:balance:u1")

    def test_redis_exception_falls_through_to_db(self):
        """Redis 抛异常时, 应降级到 DB 查询 (异常隔离)."""
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.get.side_effect = ConnectionError("redis down")
            with patch.object(tc, "SessionFactory2") as mock_sf:
                mock_db = mock_sf.return_value
                mock_margin = MagicMock()
                mock_margin.token_quantity = 50
                mock_db.query.return_value.filter.return_value.first.return_value = mock_margin
                r = tc.get_balance_cached("u2")
                assert r == {"user_uuid": "u2", "token_balance": 50}


# ---------------------------------------------------------------------------
# 2. get_balance_cached — Redis 未命中 → DB
# ---------------------------------------------------------------------------


class TestGetBalanceCachedDbFallback:
    def test_db_record_found_writes_cache(self):
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.get.return_value = None
            with patch.object(tc, "SessionFactory2") as mock_sf:
                mock_db = mock_sf.return_value
                mock_margin = MagicMock()
                mock_margin.token_quantity = 200
                mock_db.query.return_value.filter.return_value.first.return_value = mock_margin
                r = tc.get_balance_cached("u3")
                assert r == {"user_uuid": "u3", "token_balance": 200}
                mock_redis.setex.assert_called_once()
                call_args = mock_redis.setex.call_args
                assert call_args.args[0] == "zhs:token:balance:u3"
                assert call_args.args[1] == 300  # CACHE_TTL
                cached_value = json.loads(call_args.args[2])
                assert cached_value == {"user_uuid": "u3", "token_balance": 200}

    def test_no_db_record_returns_zero_balance(self):
        """DB 中无该用户记录时, 余额应为 0."""
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.get.return_value = None
            with patch.object(tc, "SessionFactory2") as mock_sf:
                mock_db = mock_sf.return_value
                mock_db.query.return_value.filter.return_value.first.return_value = None
                r = tc.get_balance_cached("ghost")
                assert r == {"user_uuid": "ghost", "token_balance": 0}

    def test_redis_setex_failure_still_returns_result(self):
        """DB 查到了, 但写 Redis 失败时, 仍应返回 DB 结果 (异常隔离)."""
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.get.return_value = None
            mock_redis.setex.side_effect = ConnectionError("redis write fail")
            with patch.object(tc, "SessionFactory2") as mock_sf:
                mock_db = mock_sf.return_value
                mock_margin = MagicMock()
                mock_margin.token_quantity = 80
                mock_db.query.return_value.filter.return_value.first.return_value = mock_margin
                r = tc.get_balance_cached("u4")
                assert r == {"user_uuid": "u4", "token_balance": 80}


# ---------------------------------------------------------------------------
# 3. invalidate_balance_cache
# ---------------------------------------------------------------------------


class TestInvalidateBalanceCache:
    def test_normal_delete(self):
        with patch.object(tc, "redis_client") as mock_redis:
            tc.invalidate_balance_cache("u5")
            mock_redis.delete.assert_called_once_with("zhs:token:balance:u5")

    def test_redis_exception_does_not_raise(self):
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.delete.side_effect = ConnectionError("redis fail")
            tc.invalidate_balance_cache("u6")  # 不应抛


# ---------------------------------------------------------------------------
# 4. update_token_with_cache
# ---------------------------------------------------------------------------


class TestUpdateTokenWithCache:
    def test_normal_set(self):
        with patch.object(tc, "redis_client") as mock_redis:
            tc.update_token_with_cache("u7", 500)
            call_args = mock_redis.setex.call_args
            assert call_args.args[0] == "zhs:token:balance:u7"
            assert call_args.args[1] == 300
            cached = json.loads(call_args.args[2])
            assert cached == {"user_uuid": "u7", "token_balance": 500}

    def test_redis_exception_does_not_raise(self):
        with patch.object(tc, "redis_client") as mock_redis:
            mock_redis.setex.side_effect = ConnectionError("redis fail")
            tc.update_token_with_cache("u8", 100)  # 不应抛
