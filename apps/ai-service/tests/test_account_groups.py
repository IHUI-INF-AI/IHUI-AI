"""account_groups.py 单元测试:账号分组管理 + 批量账号操作。

测试覆盖:
- AccountGroup dataclass 构造
- _gen_group_id:格式校验 / 唯一性 / 长度
- _serialize_group:正常序列化 / None 字段处理 / account_ids 列表
- _ok:响应包装
- _get_user_id:已登录 / 未登录抛 401
- Pydantic 模型:GroupCreate / GroupUpdate / GroupMembersOp / GroupPublish / BatchImportRow / BatchImportRequest
  - 合法构造 / 必填缺失 / 长度限制 / format pattern / min_length
- router 路由:list_groups / create_group / delete_group / add_to_group / remove_from_group /
  list_group_members / batch_import / batch_export / batch_verify / get_cookie_health /
  refresh_cookie / batch_template(DB mock)
- publish_to_group:分组不存在 / 分组无成员 / 单账号发布成功 / 适配器未找到 / 发布异常
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.services.publish import account_groups
from app.services.publish.account_groups import (
    AccountGroup,
    BatchImportRequest,
    BatchImportRow,
    GroupCreate,
    GroupMembersOp,
    GroupPublish,
    GroupUpdate,
    _gen_group_id,
    _get_user_id,
    _ok,
    _serialize_group,
    router,
)


# =============================================================================
# 1. AccountGroup dataclass
# =============================================================================


class TestAccountGroup:
    """AccountGroup 数据模型。"""

    def test_full_construction(self) -> None:
        """所有字段显式构造。"""
        now = datetime.now(timezone.utc)
        g = AccountGroup(
            group_id="grp_abc",
            user_id="u1",
            name="测试分组",
            description="描述",
            account_ids=[1, 2, 3],
            created_at=now,
            updated_at=now,
        )
        assert g.group_id == "grp_abc"
        assert g.user_id == "u1"
        assert g.name == "测试分组"
        assert g.description == "描述"
        assert g.account_ids == [1, 2, 3]
        assert g.created_at == now
        assert g.updated_at == now


# =============================================================================
# 2. _gen_group_id
# =============================================================================


class TestGenGroupId:
    """_gen_group_id 生成分组 ID。"""

    def test_returns_string_with_grp_prefix(self) -> None:
        """返回值应以 'grp_' 开头。"""
        gid = _gen_group_id()
        assert isinstance(gid, str)
        assert gid.startswith("grp_")

    def test_id_length_is_correct(self) -> None:
        """ID 长度应为 4 (grp_) + 16 (hex) = 20。"""
        gid = _gen_group_id()
        assert len(gid) == 20

    def test_each_call_returns_different_id(self) -> None:
        """每次调用应返回不同的 ID。"""
        ids = {_gen_group_id() for _ in range(10)}
        assert len(ids) == 10

    def test_hex_part_is_valid_hex(self) -> None:
        """grp_ 后的部分应为合法 hex 字符串。"""
        gid = _gen_group_id()
        hex_part = gid[4:]
        int(hex_part, 16)  # 不抛即为合法 hex


# =============================================================================
# 3. _serialize_group
# =============================================================================


class TestSerializeGroup:
    """_serialize_group 序列化分组记录。"""

    def test_full_serialization(self) -> None:
        """完整序列化。"""
        now = datetime.now(timezone.utc)
        row = MagicMock()
        row.__getitem__ = lambda self, key: {
            "group_id": "grp_1",
            "user_id": "u1",
            "name": "g1",
            "description": "desc",
            "created_at": now,
            "updated_at": now,
        }[key]
        result = _serialize_group(row, [1, 2])
        assert result["group_id"] == "grp_1"
        assert result["user_id"] == "u1"
        assert result["name"] == "g1"
        assert result["description"] == "desc"
        assert result["account_ids"] == [1, 2]
        assert result["created_at"] == now.isoformat()
        assert result["updated_at"] == now.isoformat()

    def test_description_none_becomes_empty_string(self) -> None:
        """description=None → 空串。"""
        row = MagicMock()
        row.__getitem__ = lambda self, key: {
            "group_id": "g", "user_id": "u", "name": "n",
            "description": None,
            "created_at": None, "updated_at": None,
        }[key]
        result = _serialize_group(row, [])
        assert result["description"] == ""

    def test_none_timestamps_become_none(self) -> None:
        """created_at/updated_at=None → None。"""
        row = MagicMock()
        row.__getitem__ = lambda self, key: {
            "group_id": "g", "user_id": "u", "name": "n",
            "description": "",
            "created_at": None, "updated_at": None,
        }[key]
        result = _serialize_group(row, [])
        assert result["created_at"] is None
        assert result["updated_at"] is None

    def test_empty_account_ids(self) -> None:
        """空 account_ids 列表。"""
        row = MagicMock()
        row.__getitem__ = lambda self, key: {
            "group_id": "g", "user_id": "u", "name": "n",
            "description": "",
            "created_at": None, "updated_at": None,
        }[key]
        result = _serialize_group(row, [])
        assert result["account_ids"] == []


# =============================================================================
# 4. _ok
# =============================================================================


class TestOk:
    """_ok 响应包装。"""

    def test_default_message(self) -> None:
        result = _ok({"x": 1})
        assert result == {"code": 0, "message": "ok", "data": {"x": 1}}

    def test_custom_message(self) -> None:
        result = _ok("hi", message="done")
        assert result == {"code": 0, "message": "done", "data": "hi"}

    def test_none_data(self) -> None:
        result = _ok(None)
        assert result["data"] is None


# =============================================================================
# 5. _get_user_id
# =============================================================================


class TestGetUserId:
    """_get_user_id 从 request.state 取身份。"""

    def test_returns_string_when_user_id_present(self) -> None:
        request = MagicMock()
        request.state.user_id = 42
        assert _get_user_id(request) == "42"

    def test_returns_string_unchanged(self) -> None:
        request = MagicMock()
        request.state.user_id = "abc"
        assert _get_user_id(request) == "abc"

    def test_raises_401_when_missing(self) -> None:
        request = MagicMock()
        request.state.user_id = None
        with pytest.raises(HTTPException) as exc:
            _get_user_id(request)
        assert exc.value.status_code == 401

    def test_raises_401_when_empty(self) -> None:
        request = MagicMock()
        request.state.user_id = ""
        with pytest.raises(HTTPException) as exc:
            _get_user_id(request)
        assert exc.value.status_code == 401


# =============================================================================
# 6. Pydantic 模型:GroupCreate
# =============================================================================


class TestGroupCreateModel:
    """GroupCreate 创建分组请求模型。"""

    def test_valid_construction(self) -> None:
        m = GroupCreate(name="我的分组", description="描述")
        assert m.name == "我的分组"
        assert m.description == "描述"

    def test_default_description_is_empty(self) -> None:
        m = GroupCreate(name="g")
        assert m.description == ""

    def test_name_required(self) -> None:
        with pytest.raises(ValidationError):
            GroupCreate()  # type: ignore[call-arg]

    def test_name_exceeds_max_length_raises(self) -> None:
        with pytest.raises(ValidationError):
            GroupCreate(name="x" * 129)

    def test_description_exceeds_max_length_raises(self) -> None:
        with pytest.raises(ValidationError):
            GroupCreate(name="g", description="x" * 2001)


# =============================================================================
# 7. Pydantic 模型:GroupUpdate
# =============================================================================


class TestGroupUpdateModel:
    """GroupUpdate 更新分组请求模型。"""

    def test_empty_update_allowed(self) -> None:
        """两个字段都可选,空构造合法。"""
        m = GroupUpdate()
        assert m.name is None
        assert m.description is None

    def test_partial_update_name_only(self) -> None:
        m = GroupUpdate(name="新名字")
        assert m.name == "新名字"
        assert m.description is None

    def test_partial_update_description_only(self) -> None:
        m = GroupUpdate(description="新描述")
        assert m.name is None
        assert m.description == "新描述"

    def test_name_exceeds_max_length_raises(self) -> None:
        with pytest.raises(ValidationError):
            GroupUpdate(name="x" * 129)


# =============================================================================
# 8. Pydantic 模型:GroupMembersOp
# =============================================================================


class TestGroupMembersOpModel:
    """GroupMembersOp 成员操作请求模型。"""

    def test_valid_construction(self) -> None:
        m = GroupMembersOp(account_ids=[1, 2, 3])
        assert m.account_ids == [1, 2, 3]

    def test_empty_account_ids_raises(self) -> None:
        """min_length=1,空列表不合法。"""
        with pytest.raises(ValidationError):
            GroupMembersOp(account_ids=[])

    def test_account_ids_required(self) -> None:
        with pytest.raises(ValidationError):
            GroupMembersOp()  # type: ignore[call-arg]


# =============================================================================
# 9. Pydantic 模型:GroupPublish
# =============================================================================


class TestGroupPublishModel:
    """GroupPublish 一键发布到分组请求模型。"""

    def test_valid_construction(self) -> None:
        m = GroupPublish(title="标题", format="md", text="# 内容")
        assert m.title == "标题"
        assert m.format == "md"
        assert m.text == "# 内容"

    def test_default_optional_fields(self) -> None:
        m = GroupPublish(title="t", format="html")
        assert m.file_path is None
        assert m.cover_path is None
        assert m.html is None
        assert m.images == []
        assert m.extra == {}
        assert m.platform_config == {}

    def test_invalid_format_raises(self) -> None:
        """format 必须为 md/docx/html/pdf/image/video 之一。"""
        with pytest.raises(ValidationError):
            GroupPublish(title="t", format="zip")

    def test_title_required(self) -> None:
        with pytest.raises(ValidationError):
            GroupPublish(format="md")  # type: ignore[call-arg]

    def test_format_required(self) -> None:
        with pytest.raises(ValidationError):
            GroupPublish(title="t")  # type: ignore[call-arg]

    def test_all_valid_formats(self) -> None:
        """6 种 format 都应合法。"""
        for fmt in ("md", "docx", "html", "pdf", "image", "video"):
            m = GroupPublish(title="t", format=fmt)
            assert m.format == fmt


# =============================================================================
# 10. Pydantic 模型:BatchImportRow / BatchImportRequest
# =============================================================================


class TestBatchImportModels:
    """BatchImportRow / BatchImportRequest 批量导入模型。"""

    def test_batch_import_row_valid(self) -> None:
        m = BatchImportRow(platform="wechat", nickname="账号1", credentials={"token": "abc"})
        assert m.platform == "wechat"
        assert m.nickname == "账号1"
        assert m.credentials == {"token": "abc"}

    def test_batch_import_row_default_nickname(self) -> None:
        m = BatchImportRow(platform="p")
        assert m.nickname == ""
        assert m.credentials == {}

    def test_batch_import_row_platform_required(self) -> None:
        with pytest.raises(ValidationError):
            BatchImportRow()  # type: ignore[call-arg]

    def test_batch_import_request_valid(self) -> None:
        rows = [BatchImportRow(platform="p1"), BatchImportRow(platform="p2")]
        m = BatchImportRequest(rows=rows)
        assert len(m.rows) == 2

    def test_batch_import_request_empty_rows_raises(self) -> None:
        """min_length=1,空列表不合法。"""
        with pytest.raises(ValidationError):
            BatchImportRequest(rows=[])

    def test_batch_import_request_rows_required(self) -> None:
        with pytest.raises(ValidationError):
            BatchImportRequest()  # type: ignore[call-arg]


# =============================================================================
# 11. router 路由定义
# =============================================================================


class TestRouterDefinition:
    """router 路由定义完整性。"""

    def test_router_has_prefix(self) -> None:
        """router prefix 应为 '/publish'。"""
        assert router.prefix == "/publish"

    def test_router_has_tags(self) -> None:
        """router tags 应包含 'publish-account-groups'。"""
        assert "publish-account-groups" in router.tags

    def test_router_has_expected_routes(self) -> None:
        """应包含所有预期端点。"""
        paths = {route.path for route in router.routes}
        expected = {
            "/publish/groups",
            "/publish/groups/{group_id}",
            "/publish/groups/{group_id}/add",
            "/publish/groups/{group_id}/remove",
            "/publish/groups/{group_id}/members",
            "/publish/groups/{group_id}/publish",
            "/publish/accounts/batch-import",
            "/publish/accounts/batch-export",
            "/publish/accounts/batch-verify",
            "/publish/accounts/{account_id}/cookie-health",
            "/publish/accounts/{account_id}/refresh-cookie",
            "/publish/accounts/batch-template",
        }
        assert expected.issubset(paths), f"缺失路由: {expected - paths}"


# =============================================================================
# 12. list_groups 端点(DB mock)
# =============================================================================


class TestListGroupsEndpoint:
    """list_groups 端点测试。"""

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_groups(self) -> None:
        """无分组时返回空列表。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = []

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)), \
             patch.object(account_groups, "_ensure_tables", AsyncMock(return_value=None)):
            result = await account_groups.list_groups(request)

        assert result["code"] == 0
        assert result["data"]["items"] == []
        assert result["data"]["count"] == 0


# =============================================================================
# 13. publish_to_group 端点(分组不存在)
# =============================================================================


class TestPublishToGroupEndpoint:
    """publish_to_group 端点测试。"""

    @pytest.mark.asyncio
    async def test_group_not_found_raises_404(self) -> None:
        """分组不存在时抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupPublish(title="t", format="md", text="x")

        mock_conn = AsyncMock()
        # _ensure_tables 调用后,fetchrow 返回 None(分组不存在)
        mock_conn.fetchrow.return_value = None

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.publish_to_group("grp_nonexistent", body, request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_empty_group_returns_zero_results(self) -> None:
        """分组存在但无成员 → 返回 0 成功 0 失败。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupPublish(title="t", format="md", text="x")

        mock_conn = AsyncMock()
        # 分组存在
        mock_conn.fetchrow.return_value = MagicMock()
        # 成员为空
        mock_conn.fetch.return_value = []

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.publish_to_group("grp_1", body, request)
        assert result["code"] == 0
        assert result["data"]["success_count"] == 0
        assert result["data"]["failed_count"] == 0


# =============================================================================
# 14. delete_group 端点
# =============================================================================


class TestDeleteGroupEndpoint:
    """delete_group 端点测试。"""

    @pytest.mark.asyncio
    async def test_group_not_found_raises_404(self) -> None:
        """分组不存在时抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.execute.return_value = "DELETE 0"

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.delete_group("grp_x", request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_group_deleted_successfully(self) -> None:
        """分组存在时返回删除成功。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.execute.return_value = "DELETE 1"

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.delete_group("grp_1", request)
        assert result["code"] == 0
        assert result["data"]["deleted"] is True
        assert result["data"]["group_id"] == "grp_1"


# =============================================================================
# 15. create_group 端点
# =============================================================================


class TestCreateGroupEndpoint:
    """create_group 端点测试。"""

    @pytest.mark.asyncio
    async def test_creates_group_successfully(self) -> None:
        """成功创建分组。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupCreate(name="新分组", description="描述")

        now = datetime.now(timezone.utc)
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "group_id": "grp_1",
            "user_id": "u1",
            "name": "新分组",
            "description": "描述",
            "created_at": now,
            "updated_at": now,
        }

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.create_group(body, request)
        assert result["code"] == 0
        assert result["data"]["name"] == "新分组"
        assert result["data"]["account_ids"] == []

    @pytest.mark.asyncio
    async def test_duplicate_name_raises_409(self) -> None:
        """重名抛 409。"""
        import asyncpg

        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupCreate(name="已存在")

        mock_conn = AsyncMock()
        mock_conn.fetchrow.side_effect = asyncpg.UniqueViolationError("duplicate")

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.create_group(body, request)
            assert exc.value.status_code == 409


# =============================================================================
# 16. update_group 端点
# =============================================================================


class TestUpdateGroupEndpoint:
    """update_group 端点测试。"""

    @pytest.mark.asyncio
    async def test_group_not_found_raises_404(self) -> None:
        """分组不存在抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupUpdate(name="新名")

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.update_group("grp_x", body, request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_no_update_fields_returns_no_change(self) -> None:
        """两个字段都为 None → 返回无更新。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupUpdate()  # 空更新

        now = datetime.now(timezone.utc)
        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "group_id": "grp_1", "user_id": "u1", "name": "n",
            "description": "d", "created_at": now, "updated_at": now,
        }

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.update_group("grp_1", body, request)
        assert result["code"] == 0
        assert "无更新字段" in result["message"]


# =============================================================================
# 17. add_to_group 端点
# =============================================================================


class TestAddToGroupEndpoint:
    """add_to_group 端点测试。"""

    @pytest.mark.asyncio
    async def test_group_not_found_raises_404(self) -> None:
        """分组不存在抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupMembersOp(account_ids=[1])

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.add_to_group("grp_x", body, request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_skips_accounts_not_owned_by_user(self) -> None:
        """不归属用户的账号应被跳过。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupMembersOp(account_ids=[1, 2])

        mock_conn = AsyncMock()
        # 分组存在
        mock_conn.fetchrow.return_value = MagicMock()
        # fetchval:账号 1 归属,账号 2 不归属
        mock_conn.fetchval.side_effect = [1, None]
        mock_conn.execute.return_value = "INSERT 0 1"

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.add_to_group("grp_1", body, request)
        assert result["data"]["added"] == 1


# =============================================================================
# 18. remove_from_group 端点
# =============================================================================


class TestRemoveFromGroupEndpoint:
    """remove_from_group 端点测试。"""

    @pytest.mark.asyncio
    async def test_removes_existing_member(self) -> None:
        """成功移除成员。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = GroupMembersOp(account_ids=[1, 2])

        mock_conn = AsyncMock()
        mock_conn.execute.side_effect = ["DELETE 1", "DELETE 0"]

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)), \
             patch.object(account_groups, "_ensure_tables", AsyncMock(return_value=None)):
            result = await account_groups.remove_from_group("grp_1", body, request)
        assert result["data"]["removed"] == 1


# =============================================================================
# 19. list_group_members 端点
# =============================================================================


class TestListGroupMembersEndpoint:
    """list_group_members 端点测试。"""

    @pytest.mark.asyncio
    async def test_group_not_found_raises_404(self) -> None:
        """分组不存在抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.list_group_members("grp_x", request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_returns_member_ids(self) -> None:
        """返回成员 ID 列表。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = MagicMock()
        mock_conn.fetch.return_value = [
            {"account_id": 1},
            {"account_id": 2},
            {"account_id": 3},
        ]

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.list_group_members("grp_1", request)
        assert result["data"]["account_ids"] == [1, 2, 3]
        assert result["data"]["count"] == 3


# =============================================================================
# 20. batch_export 端点
# =============================================================================


class TestBatchExportEndpoint:
    """batch_export 端点测试。"""

    @pytest.mark.asyncio
    async def test_returns_csv_string(self) -> None:
        """返回 CSV 字符串(含 header)。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = [
            {"platform": "wechat", "display_name": "微信1", "status": "active"},
            {"platform": "csdn", "display_name": "CSDN1", "status": "expired"},
        ]

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.batch_export(request)
        assert result["code"] == 0
        csv_str = result["data"]["csv"]
        assert "platform" in csv_str
        assert "nickname" in csv_str
        assert "status" in csv_str
        assert "wechat" in csv_str
        assert "微信1" in csv_str
        assert result["data"]["count"] == 2


# =============================================================================
# 21. get_cookie_health 端点
# =============================================================================


class TestGetCookieHealthEndpoint:
    """get_cookie_health 端点测试。"""

    @pytest.mark.asyncio
    async def test_account_not_found_raises_404(self) -> None:
        """账号不存在抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.get_cookie_health(999, request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_never_verified_returns_expired_level(self) -> None:
        """从未验证(last_verified_at=None)→ expired。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "platform": "wechat",
            "display_name": "acc",
            "status": "active",
            "last_verified_at": None,
            "last_verify_msg": None,
            "updated_at": None,
        }

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.get_cookie_health(1, request)
        assert result["data"]["level"] == "expired"
        assert result["data"]["days_since_verified"] is None
        assert result["data"]["predicted_expiry"] is None

    @pytest.mark.asyncio
    async def test_recently_verified_returns_healthy(self) -> None:
        """最近验证(< 7 天)→ healthy。"""
        request = MagicMock()
        request.state.user_id = "u1"
        from datetime import timedelta
        recent = datetime.now(timezone.utc) - timedelta(days=3)

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "platform": "wechat",
            "display_name": "acc",
            "status": "active",
            "last_verified_at": recent,
            "last_verify_msg": "ok",
            "updated_at": recent,
        }

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.get_cookie_health(1, request)
        assert result["data"]["level"] == "healthy"
        assert result["data"]["days_since_verified"] is not None
        assert result["data"]["days_since_verified"] <= 7

    @pytest.mark.asyncio
    async def test_medium_old_returns_expiring(self) -> None:
        """7-14 天 → expiring。"""
        request = MagicMock()
        request.state.user_id = "u1"
        from datetime import timedelta
        medium_old = datetime.now(timezone.utc) - timedelta(days=10)

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "platform": "wechat",
            "display_name": "acc",
            "status": "active",
            "last_verified_at": medium_old,
            "last_verify_msg": "ok",
            "updated_at": medium_old,
        }

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.get_cookie_health(1, request)
        assert result["data"]["level"] == "expiring"

    @pytest.mark.asyncio
    async def test_old_returns_expired(self) -> None:
        """超过 14 天 → expired。"""
        request = MagicMock()
        request.state.user_id = "u1"
        from datetime import timedelta
        old = datetime.now(timezone.utc) - timedelta(days=20)

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "platform": "wechat",
            "display_name": "acc",
            "status": "active",
            "last_verified_at": old,
            "last_verify_msg": "ok",
            "updated_at": old,
        }

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.get_cookie_health(1, request)
        assert result["data"]["level"] == "expired"


# =============================================================================
# 22. refresh_cookie 端点
# =============================================================================


class TestRefreshCookieEndpoint:
    """refresh_cookie 端点测试。"""

    @pytest.mark.asyncio
    async def test_account_not_found_raises_404(self) -> None:
        """账号不存在抛 404。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = None

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            with pytest.raises(HTTPException) as exc:
                await account_groups.refresh_cookie(999, request)
            assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_successful_refresh(self) -> None:
        """保活成功 → 更新 last_verified_at 并返回成功。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetchrow.return_value = {
            "platform": "wechat",
            "display_name": "acc",
        }

        # mock cookie_daemon.refresh_single
        from app.services.publish.cookie_refresh_daemon import RefreshResult
        fake_result = RefreshResult(
            account_id=1, platform="wechat", success=True, message="ok",
        )

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)), \
             patch("app.services.publish.cookie_refresh_daemon.cookie_daemon.refresh_single",
                   AsyncMock(return_value=fake_result)):
            result = await account_groups.refresh_cookie(1, request)
        assert result["data"]["success"] is True
        assert result["data"]["message"] == "ok"
        mock_conn.execute.assert_awaited()  # UPDATE 应被调用


# =============================================================================
# 23. batch_template 端点
# =============================================================================


class TestBatchTemplateEndpoint:
    """batch_template 端点测试。"""

    @pytest.mark.asyncio
    async def test_returns_csv_template(self) -> None:
        """返回 CSV 模板字符串。"""
        request = MagicMock()
        request.state.user_id = "u1"

        # mock list_all_adapter_classes
        fake_cls1 = MagicMock()
        fake_cls1.platform_id = "wechat"
        fake_cls1.platform_name = "微信"
        fake_cls1.requires_credentials = ["token", "secret"]

        fake_cls2 = MagicMock()
        fake_cls2.platform_id = "csdn"
        fake_cls2.platform_name = "CSDN"
        fake_cls2.requires_credentials = ["cookie"]

        with patch(
            "app.services.publish.base_adapter.list_all_adapter_classes",
            return_value=[fake_cls1, fake_cls2],
        ):
            result = await account_groups.batch_template(request)
        assert result["code"] == 0
        csv_str = result["data"]["csv"]
        assert "platform" in csv_str
        assert "wechat" in csv_str
        assert "csdn" in csv_str


# =============================================================================
# 24. batch_import 端点
# =============================================================================


class TestBatchImportEndpoint:
    """batch_import 端点测试。"""

    @pytest.mark.asyncio
    async def test_unsupported_platform_recorded_as_error(self) -> None:
        """不支持的平台记入 errors。"""
        request = MagicMock()
        request.state.user_id = "u1"
        body = BatchImportRequest(rows=[
            BatchImportRow(platform="unknown_platform"),
            BatchImportRow(platform="wechat"),
        ])

        mock_conn = AsyncMock()

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)), \
             patch.object(account_groups, "get_adapter", side_effect=[None, MagicMock()]), \
             patch.object(account_groups, "encrypt", return_value="cipher"):
            result = await account_groups.batch_import(body, request)
        assert result["data"]["failed_count"] == 1
        assert len(result["data"]["errors"]) == 1
        assert result["data"]["errors"][0]["row"] == 0


# =============================================================================
# 25. batch_verify 端点
# =============================================================================


class TestBatchVerifyEndpoint:
    """batch_verify 端点测试。"""

    @pytest.mark.asyncio
    async def test_no_active_accounts_returns_zero(self) -> None:
        """无 active 账号 → 0 verified / 0 invalid。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = []

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)):
            result = await account_groups.batch_verify(request)
        assert result["data"]["verified_count"] == 0
        assert result["data"]["invalid_count"] == 0
        assert result["data"]["total"] == 0

    @pytest.mark.asyncio
    async def test_adapter_not_found_counts_as_invalid(self) -> None:
        """适配器未找到 → invalid +1。"""
        request = MagicMock()
        request.state.user_id = "u1"

        mock_conn = AsyncMock()
        mock_conn.fetch.return_value = [
            {"id": 1, "platform": "unknown", "credentials_enc": "c", "display_name": "n"},
        ]

        with patch.object(account_groups, "_get_conn", AsyncMock(return_value=mock_conn)), \
             patch.object(account_groups, "get_adapter", return_value=None), \
             patch.object(account_groups, "decrypt", return_value={"k": "v"}):
            result = await account_groups.batch_verify(request)
        assert result["data"]["invalid_count"] == 1
        assert result["data"]["verified_count"] == 0
