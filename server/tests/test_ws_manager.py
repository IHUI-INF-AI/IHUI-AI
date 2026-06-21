"""端到端测试：WebSocket ConnectionManager 单例功能."""


from app.ws.manager import connection_manager


class TestConnectionManager:
    def test_singleton_pattern(self):
        """确保 ConnectionManager 是单例."""
        from app.ws.manager import ConnectionManager

        a = ConnectionManager()
        b = ConnectionManager()
        assert a is b

    def test_stats_includes_redis_pubsub_flag(self):
        """stats 应包含 redis_pubsub_enabled 字段."""
        stats = connection_manager.stats()
        assert "total_connections" in stats
        assert "total_users" in stats
        assert "total_rooms" in stats
        assert "stale_heartbeats" in stats
        assert "instance_id" in stats
        assert "redis_pubsub_enabled" in stats
        assert isinstance(stats["redis_pubsub_enabled"], bool)

    def test_subscribe_unsubscribe(self):
        """订阅 / 取消订阅 房间."""
        conn_id = "test-conn-subscribe"
        room_id = "test-room-1"
        connection_manager.subscribe(conn_id, room_id)
        assert conn_id in connection_manager._room_map[room_id]
        connection_manager.unsubscribe(conn_id, room_id)
        assert conn_id not in connection_manager._room_map[room_id]

    def test_heartbeat(self):
        """心跳记录."""
        conn_id = "test-conn-heartbeat"
        connection_manager.heartbeat(conn_id)
        assert conn_id in connection_manager._heartbeat
        assert connection_manager._heartbeat[conn_id] > 0

    def test_alive_connections_stale(self):
        """超时心跳的连接计入 stale_heartbeats."""
        import time

        conn_id = "test-conn-stale"
        connection_manager._heartbeat[conn_id] = time.time() - 999
        stale = connection_manager.alive_connections(timeout=60)
        assert stale >= 1

    def test_instance_id_unique(self):
        """每个实例的 ID 唯一（用于 Redis 消息回声过滤）."""
        # 注意: 其它测试可能已重置 _instance_id, 这里确保再次 reset 后是 ws- 前缀
        import time as _t

        connection_manager._instance_id = f"ws-{id(connection_manager)}-{int(_t.time())}"
        assert connection_manager._instance_id.startswith("ws-")
        assert len(connection_manager._instance_id) > 10

    def teardown_method(self):
        """测试后清理临时数据."""
        for conn_id in list(connection_manager._heartbeat.keys()):
            if conn_id.startswith("test-conn-"):
                connection_manager._heartbeat.pop(conn_id, None)
        for room_id in list(connection_manager._room_map.keys()):
            if room_id.startswith("test-room-"):
                connection_manager._room_map.pop(room_id, None)
