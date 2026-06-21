"""P15-B 业务模块加测: user_service (DB 函数).

目标: 覆盖 get_user_by_uuid / update_user / get_user_vip_info / list_users 4 个
      DB 函数的核心分支, 用 MagicMock 模拟 get_session, 零真实 DB 依赖.
"""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

from app.services import user_service


def _mock_user(uuid="u-1", nickname="alice", is_vip=0, status=1, avatar="a.png"):
    return MagicMock(
        uuid=uuid,
        nickname=nickname,
        is_vip=is_vip,
        status=status,
        avatar=avatar,
        gender=0,
    )


def _mock_margin(user_uuid="u-1", token_quantity=0):
    m = MagicMock()
    m.user_uuid = user_uuid
    m.token_quantity = token_quantity
    return m


def _mock_auth(user_uuid="u-1", phone="13800000000"):
    a = MagicMock()
    a.user_uuid = user_uuid
    a.phone = phone
    return a


@contextmanager
def _patch_get_session(mock_db):
    """Patch get_session so it yields the mock_db and auto-closes."""
    mock_cm = MagicMock()
    mock_cm.__enter__ = MagicMock(return_value=mock_db)
    mock_cm.__exit__ = MagicMock(return_value=False)
    with patch.object(user_service, "get_session", return_value=mock_cm):
        yield


class TestGetUserByUuid:
    """get_user_by_uuid(user_uuid) -> Optional[dict] (8 字段聚合)."""

    def test_user_not_found_returns_none(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        with _patch_get_session(mock_db):
            result = user_service.get_user_by_uuid("missing")
        assert result is None

    def test_user_found_with_full_relations(self):
        """User + margin + auth 都有 -> 8 字段全填充."""
        user = _mock_user(uuid="u-1", nickname="alice", is_vip=1)
        margin = _mock_margin(user_uuid="u-1", token_quantity=5000)
        auth = _mock_auth(user_uuid="u-1", phone="13800138000")

        mock_db = MagicMock()
        mock_db.query.side_effect = [
            MagicMock(filter=MagicMock(return_value=MagicMock(first=MagicMock(return_value=user)))),
            MagicMock(filter=MagicMock(return_value=MagicMock(first=MagicMock(return_value=margin)))),
            MagicMock(filter=MagicMock(return_value=MagicMock(first=MagicMock(return_value=auth)))),
        ]
        with _patch_get_session(mock_db):
            result = user_service.get_user_by_uuid("u-1")

        assert result["uuid"] == "u-1"
        assert result["nickname"] == "alice"
        assert result["is_vip"] == 1
        assert result["token_balance"] == 5000
        assert result["phone"] == "13800138000"

    def test_user_found_without_relations(self):
        """User 在但 margin / auth 不存在 -> token_balance=0, phone=None."""
        user = _mock_user(uuid="u-2", nickname="bob", is_vip=0)

        mock_db = MagicMock()
        mock_db.query.side_effect = [
            MagicMock(filter=MagicMock(return_value=MagicMock(first=MagicMock(return_value=user)))),
            MagicMock(filter=MagicMock(return_value=MagicMock(first=MagicMock(return_value=None)))),
            MagicMock(filter=MagicMock(return_value=MagicMock(first=MagicMock(return_value=None)))),
        ]
        with _patch_get_session(mock_db):
            result = user_service.get_user_by_uuid("u-2")

        assert result["uuid"] == "u-2"
        assert result["token_balance"] == 0
        assert result["phone"] is None


class TestUpdateUser:
    """update_user(user_uuid, **kwargs) -> dict (success/not found/error)."""

    def test_user_not_found_returns_error_dict(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        with _patch_get_session(mock_db):
            result = user_service.update_user("missing", nickname="new")
        assert result == {"success": False, "msg": "User not found"}

    def test_user_found_updates_attributes(self):
        """User 在 + kwargs 命中字段 -> setattr + commit."""
        user = _mock_user(uuid="u-1", nickname="old", is_vip=0)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        with _patch_get_session(mock_db):
            result = user_service.update_user("u-1", nickname="new", is_vip=1)
        assert result == {"success": True}
        assert user.nickname == "new"
        assert user.is_vip == 1

    def test_kwargs_none_value_skips_update(self):
        """kwargs value=None 时, 不应该覆盖现有值 (setattr 跳过)."""
        user = _mock_user(uuid="u-1", nickname="keep", is_vip=0)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        with _patch_get_session(mock_db):
            result = user_service.update_user("u-1", nickname=None)
        assert result == {"success": True}
        assert user.nickname == "keep"

    def test_kwargs_unknown_field_ignored(self):
        """kwargs key 不在 User 字段上 (hasattr=False) -> 静默跳过."""
        user = _mock_user(uuid="u-1", nickname="keep")
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        with _patch_get_session(mock_db):
            result = user_service.update_user("u-1", not_a_field="x")
        assert result == {"success": True}
        assert user.nickname == "keep"


class TestGetUserVipInfo:
    """get_user_vip_info(user_uuid) -> dict."""

    def test_user_not_found_returns_is_vip_zero(self):
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None
        with _patch_get_session(mock_db):
            result = user_service.get_user_vip_info("missing")
        assert result["is_vip"] == 0
        assert result["found"] is False

    def test_normal_user_returns_is_vip_zero(self):
        """is_vip=0 -> result.is_vip=0 (fallback or 0)."""
        user = _mock_user(is_vip=0)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        with _patch_get_session(mock_db):
            result = user_service.get_user_vip_info("u-1")
        assert result["is_vip"] == 0
        assert result["found"] is True

    def test_vip_user_returns_is_vip_one(self):
        user = _mock_user(is_vip=1)
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = user
        with _patch_get_session(mock_db):
            result = user_service.get_user_vip_info("u-1")
        assert result["is_vip"] == 1
        assert result["found"] is True


class TestListUsers:
    """list_users(page, limit, keyword) -> dict (分页 + 模糊查询)."""

    def _setup_db_with_users(self, users, total):
        """构造链式 query mock: count() 返 total, all() 返 users."""
        q_filter = MagicMock()
        q_filter.count.return_value = total
        q_filter.offset.return_value.limit.return_value.all.return_value = users

        q_base = MagicMock()
        q_base.filter.return_value = q_filter
        q_base.count.return_value = total
        q_base.offset.return_value.limit.return_value.all.return_value = users

        mock_db = MagicMock()
        mock_db.query.return_value = q_base
        return mock_db

    def test_no_keyword_returns_all_users(self):
        users = [_mock_user(uuid=f"u-{i}", nickname=f"user{i}") for i in range(3)]
        mock_db = self._setup_db_with_users(users, total=3)
        with _patch_get_session(mock_db):
            result = user_service.list_users(page=1, limit=20)
        assert result["total"] == 3
        assert result["page"] == 1
        assert result["limit"] == 20
        assert len(result["users"]) == 3
        assert result["users"][0]["uuid"] == "u-0"

    def test_keyword_triggers_filter(self):
        users = [_mock_user(uuid="u-1", nickname="alice")]
        mock_db = self._setup_db_with_users(users, total=1)
        with _patch_get_session(mock_db):
            result = user_service.list_users(page=1, limit=20, keyword="ali")
        mock_db.query.return_value.filter.assert_called_once()
        assert result["total"] == 1

    def test_empty_result_returns_empty_list(self):
        mock_db = self._setup_db_with_users([], total=0)
        with _patch_get_session(mock_db):
            result = user_service.list_users(page=1, limit=20)
        assert result["total"] == 0
        assert result["users"] == []

    def test_pagination_uses_offset_and_limit(self):
        users = [_mock_user(uuid=f"u-{i}") for i in range(5)]
        mock_db = self._setup_db_with_users(users, total=100)
        with _patch_get_session(mock_db):
            result = user_service.list_users(page=3, limit=5)
        mock_db.query.return_value.offset.assert_called_with(10)
        mock_db.query.return_value.offset.return_value.limit.assert_called_with(5)
        assert result["page"] == 3
        assert result["limit"] == 5
