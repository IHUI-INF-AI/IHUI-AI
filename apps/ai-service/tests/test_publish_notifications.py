"""app/services/publish/notifications.py 单元测试:多通道通知 + 降级策略。

测试覆盖:
- _get_db_conn():无 database_url 时返回 None / 连接失败时降级 None / 成功返回 conn
- _ensure_table():CREATE TABLE + 2 个 CREATE INDEX 被调用
- _write_to_db():成功 / 无连接 / 写入失败 三种场景
- _push_sio():成功 / sio.emit 抛异常降级 False
- notify_publish_complete():sio+db 双通道 / 双降级 / payload 默认空 dict / 时间戳填充
- notify_progress():仅 sio 推送 / user_id 缺失走 broadcast room

测试隔离:全用 AsyncMock mock asyncpg.connect / sio.emit,不依赖真实 DB / Redis / Socket.IO。
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.publish import notifications


# =============================================================================
# _get_db_conn 数据库连接获取
# =============================================================================


class TestGetDbConn:
    """测试 _get_db_conn() 在不同 settings.database_url 状态下的行为。"""

    async def test_returns_none_when_no_dsn(self, monkeypatch):
        # settings.database_url 为空 → 直接返回 None,不尝试连接
        from app.core.config import settings
        monkeypatch.setattr(settings, "database_url", "")
        result = await notifications._get_db_conn()
        assert result is None

    async def test_returns_none_when_dsn_is_none(self, monkeypatch):
        # settings.database_url 为 None(getattr 返回 None)→ 返回 None
        from app.core.config import settings
        monkeypatch.setattr(settings, "database_url", None)
        result = await notifications._get_db_conn()
        assert result is None

    async def test_returns_none_when_connect_fails(self, monkeypatch):
        # 有 dsn 但 asyncpg.connect 抛异常 → 降级返回 None(不向上抛)
        from app.core.config import settings
        monkeypatch.setattr(settings, "database_url", "postgresql://x:y@localhost:5432/db")

        async def boom(dsn=None):
            raise ConnectionError("simulated connection failure")

        monkeypatch.setattr(notifications.asyncpg, "connect", boom)
        result = await notifications._get_db_conn()
        assert result is None

    async def test_returns_conn_on_success(self, monkeypatch):
        # 连接成功 → 返回 connection 对象
        from app.core.config import settings
        monkeypatch.setattr(settings, "database_url", "postgresql://x:y@localhost:5432/db")

        fake_conn = MagicMock(name="conn")
        monkeypatch.setattr(notifications.asyncpg, "connect", AsyncMock(return_value=fake_conn))
        result = await notifications._get_db_conn()
        assert result is fake_conn


# =============================================================================
# _ensure_table 表结构初始化
# =============================================================================


class TestEnsureTable:
    """测试 _ensure_table() 调用 CREATE TABLE + 2 个 CREATE INDEX。"""

    async def test_executes_three_ddl_statements(self):
        # _ensure_table 应调用 3 次 execute(CREATE TABLE + 2 个 CREATE INDEX)
        conn = MagicMock()
        conn.execute = AsyncMock()

        await notifications._ensure_table(conn)

        assert conn.execute.call_count == 3
        # 第 1 次:CREATE TABLE IF NOT EXISTS
        first_call_arg = conn.execute.call_args_list[0].args[0]
        assert "CREATE TABLE IF NOT EXISTS" in first_call_arg
        assert "publish_notifications" in first_call_arg
        # 第 2 / 3 次:CREATE INDEX
        assert "CREATE INDEX" in conn.execute.call_args_list[1].args[0]
        assert "CREATE INDEX" in conn.execute.call_args_list[2].args[0]
        # task_id / user_id 索引
        all_args = " ".join(c.args[0] for c in conn.execute.call_args_list)
        assert "task_id" in all_args
        assert "user_id" in all_args


# =============================================================================
# _write_to_db 写入通知表
# =============================================================================


class TestWriteToDb:
    """测试 _write_to_db() 在不同 DB 状态下的写入行为。"""

    async def test_returns_false_when_no_conn(self, monkeypatch):
        # _get_db_conn 返回 None → 直接 False,不调用 execute
        async def fake_get_conn():
            return None
        monkeypatch.setattr(notifications, "_get_db_conn", fake_get_conn)

        result = await notifications._write_to_db(
            "task-1", "user-1", "success", "ok", {"k": "v"}
        )
        assert result is False

    async def test_returns_true_on_success(self, monkeypatch):
        # _ensure_table + INSERT 均成功 → True,且 conn.close() 被调用
        conn = MagicMock()
        conn.execute = AsyncMock()
        conn.close = AsyncMock()

        async def fake_get_conn():
            return conn
        monkeypatch.setattr(notifications, "_get_db_conn", fake_get_conn)

        result = await notifications._write_to_db(
            "task-1", "user-1", "success", "ok", {"k": "v"}
        )
        assert result is True
        # _ensure_table (3) + INSERT (1) = 4 次 execute
        assert conn.execute.call_count == 4
        # 最后一次是 INSERT,含 5 个参数
        last_call = conn.execute.call_args_list[-1]
        assert "INSERT INTO publish_notifications" in last_call.args[0]
        assert last_call.args[1] == "task-1"
        assert last_call.args[2] == "user-1"
        assert last_call.args[3] == "success"
        assert last_call.args[4] == "ok"
        # 第 5 个参数是 JSON 字符串(payload)
        assert json.loads(last_call.args[5]) == {"k": "v"}
        # conn.close 被调用(finally 块)
        assert conn.close.await_count == 1

    async def test_returns_false_when_insert_fails(self, monkeypatch):
        # INSERT 抛异常 → 写入失败返回 False,但 conn.close 仍被调用(finally)
        conn = MagicMock()
        conn.execute = AsyncMock(side_effect=[
            None, None, None,  # _ensure_table 三次成功
            RuntimeError("disk full"),  # INSERT 失败
        ])
        conn.close = AsyncMock()

        async def fake_get_conn():
            return conn
        monkeypatch.setattr(notifications, "_get_db_conn", fake_get_conn)

        result = await notifications._write_to_db(
            "task-1", None, "failed", "err", {}
        )
        assert result is False
        # finally 仍关闭连接
        assert conn.close.await_count == 1


# =============================================================================
# _push_sio Socket.IO 推送
# =============================================================================


class TestPushSio:
    """测试 _push_sio() 的成功 / 异常降级行为。"""

    async def test_returns_true_on_success(self, monkeypatch):
        # sio.emit 成功 → True
        fake_sio = MagicMock()
        fake_sio.emit = AsyncMock()
        # _push_sio 内部 from app.sio import sio → patch app.sio.sio
        import app.sio as sio_mod
        monkeypatch.setattr(sio_mod, "sio", fake_sio)

        result = await notifications._push_sio("user:1", "publish_complete", {"a": 1})
        assert result is True
        fake_sio.emit.assert_awaited_once_with(
            "publish_complete", {"a": 1}, room="user:1"
        )

    async def test_returns_false_on_emit_exception(self, monkeypatch):
        # sio.emit 抛异常 → 降级 False,不向上抛
        fake_sio = MagicMock()
        fake_sio.emit = AsyncMock(side_effect=RuntimeError("sio disconnected"))
        import app.sio as sio_mod
        monkeypatch.setattr(sio_mod, "sio", fake_sio)

        result = await notifications._push_sio("user:1", "publish_complete", {"a": 1})
        assert result is False

    async def test_returns_false_on_import_error(self, monkeypatch):
        # from app.sio import sio 抛 ImportError → 降级 False
        import builtins
        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "app.sio":
                raise ImportError("simulated import failure")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", fake_import)
        result = await notifications._push_sio("user:1", "publish_complete", {"a": 1})
        assert result is False


# =============================================================================
# notify_publish_complete 统一通知入口
# =============================================================================


class TestNotifyPublishComplete:
    """测试 notify_publish_complete() 的双通道 + 降级行为。"""

    async def test_returns_both_true_on_success(self, monkeypatch):
        # sio + db 都成功 → {"sio": True, "db": True}
        monkeypatch.setattr(notifications, "_push_sio", AsyncMock(return_value=True))
        monkeypatch.setattr(notifications, "_write_to_db", AsyncMock(return_value=True))

        result = await notifications.notify_publish_complete(
            "task-1", "user-1", "success", "ok", {"extra": "data"}
        )
        assert result == {"sio": True, "db": True}

    async def test_returns_both_false_on_degradation(self, monkeypatch):
        # sio + db 都失败 → {"sio": False, "db": False}
        monkeypatch.setattr(notifications, "_push_sio", AsyncMock(return_value=False))
        monkeypatch.setattr(notifications, "_write_to_db", AsyncMock(return_value=False))

        result = await notifications.notify_publish_complete(
            "task-1", "user-1", "failed", "err"
        )
        assert result == {"sio": False, "db": False}

    async def test_uses_user_room_when_user_id_present(self, monkeypatch):
        # user_id 非空 → room = "user:<user_id>"
        captured_args = {}

        async def fake_push(room, event, data):
            captured_args["room"] = room
            captured_args["event"] = event
            captured_args["data"] = data
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        monkeypatch.setattr(notifications, "_write_to_db", AsyncMock(return_value=True))

        await notifications.notify_publish_complete(
            "task-1", "user-99", "success", "ok"
        )
        assert captured_args["room"] == "user:user-99"
        assert captured_args["event"] == "publish_complete"

    async def test_uses_broadcast_room_when_user_id_none(self, monkeypatch):
        # user_id 为 None → room = "publish:broadcast"
        captured_args = {}

        async def fake_push(room, event, data):
            captured_args["room"] = room
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        monkeypatch.setattr(notifications, "_write_to_db", AsyncMock(return_value=True))

        await notifications.notify_publish_complete(
            "task-1", None, "success", "ok"
        )
        assert captured_args["room"] == "publish:broadcast"

    async def test_payload_defaults_to_empty_dict(self, monkeypatch):
        # payload=None → 内部用 {} 填充,且 _write_to_db 收到包含 timestamp 的 data
        captured_payload = {}

        async def fake_push(room, event, data):
            captured_payload["data"] = data
            return True

        async def fake_write(task_id, user_id, status, summary, payload):
            captured_payload["write_payload"] = payload
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        monkeypatch.setattr(notifications, "_write_to_db", fake_write)

        await notifications.notify_publish_complete(
            "task-1", "user-1", "success", "ok", None
        )
        # _push_sio 收到的 data.payload 应为 {}
        assert captured_payload["data"]["payload"] == {}
        # _write_to_db 收到完整 data(含 timestamp/type/task_id/...)
        assert "timestamp" in captured_payload["write_payload"]
        assert captured_payload["write_payload"]["type"] == "publish_complete"
        assert captured_payload["write_payload"]["task_id"] == "task-1"
        assert captured_payload["write_payload"]["status"] == "success"

    async def test_data_includes_required_fields(self, monkeypatch):
        # 推送的数据含 type / task_id / user_id / status / summary / payload / timestamp
        captured = {}

        async def fake_push(room, event, data):
            captured["data"] = data
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        monkeypatch.setattr(notifications, "_write_to_db", AsyncMock(return_value=True))

        await notifications.notify_publish_complete(
            "task-X", "user-Y", "partial", "half done", {"p": 1}
        )
        data = captured["data"]
        assert data["type"] == "publish_complete"
        assert data["task_id"] == "task-X"
        assert data["user_id"] == "user-Y"
        assert data["status"] == "partial"
        assert data["summary"] == "half done"
        assert data["payload"] == {"p": 1}
        assert "timestamp" in data


# =============================================================================
# notify_progress 单平台进度通知
# =============================================================================


class TestNotifyProgress:
    """测试 notify_progress() 仅推送 sio,不写 DB。"""

    async def test_returns_true_on_sio_success(self, monkeypatch):
        # sio 推送成功 → True
        monkeypatch.setattr(notifications, "_push_sio", AsyncMock(return_value=True))
        result = await notifications.notify_progress(
            "task-1", "user-1", "wechat", "start", "开始发布"
        )
        assert result is True

    async def test_returns_false_on_sio_failure(self, monkeypatch):
        # sio 推送失败 → False
        monkeypatch.setattr(notifications, "_push_sio", AsyncMock(return_value=False))
        result = await notifications.notify_progress(
            "task-1", "user-1", "wechat", "failed", "失败"
        )
        assert result is False

    async def test_uses_user_room_when_user_id_present(self, monkeypatch):
        # user_id 非空 → room = "user:<user_id>"
        captured = {}

        async def fake_push(room, event, data):
            captured["room"] = room
            captured["event"] = event
            captured["data"] = data
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        await notifications.notify_progress(
            "task-1", "user-42", "wechat", "success", "完成"
        )
        assert captured["room"] == "user:user-42"
        assert captured["event"] == "publish_progress"

    async def test_uses_broadcast_room_when_user_id_none(self, monkeypatch):
        # user_id 为 None → broadcast room
        captured = {}

        async def fake_push(room, event, data):
            captured["room"] = room
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        await notifications.notify_progress(
            "task-1", None, "wechat", "success"
        )
        assert captured["room"] == "publish:broadcast"

    async def test_data_shape_includes_required_fields(self, monkeypatch):
        # 推送数据含 type / task_id / platform / status / message / timestamp
        captured = {}

        async def fake_push(room, event, data):
            captured["data"] = data
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        await notifications.notify_progress(
            "task-P", "user-Q", "douyin", "start", "starting"
        )
        data = captured["data"]
        assert data["type"] == "publish_progress"
        assert data["task_id"] == "task-P"
        assert data["platform"] == "douyin"
        assert data["status"] == "start"
        assert data["message"] == "starting"
        assert "timestamp" in data

    async def test_default_message_is_empty_string(self, monkeypatch):
        # message 默认为 ""(参数默认值)
        captured = {}

        async def fake_push(room, event, data):
            captured["data"] = data
            return True

        monkeypatch.setattr(notifications, "_push_sio", fake_push)
        await notifications.notify_progress(
            "task-1", "user-1", "wechat", "success"
        )
        assert captured["data"]["message"] == ""
