"""get_member_id_int 依赖函数单元测试.

覆盖 4 类场景 (共 8 用例):
  - 已登录数字用户 (request.state.user_id 为数字字符串)
  - 未登录用户 (无 user_id, 无 token)
  - 无效 token (Bearer 非法 token, decode_access_token 返回 None)
  - UUID 用户 (user_id 非数字, 设计限制返回 0)

被测函数: app.core.current_user.get_member_id_int
设计优先级:
  1. request.state.user_id (auth_middleware 注入), 数字字符串转 int
  2. JWT Bearer Token 解码 sub 字段, 数字字符串转 int
  3. 默认 0 (guest / 未登录 / UUID 用户)
"""

from unittest.mock import MagicMock

from app.core.current_user import get_member_id_int


# ---------------------------------------------------------------------------
# 1. 已登录用户 (request.state.user_id 为数字字符串)
# ---------------------------------------------------------------------------


def test_get_member_id_int_with_valid_numeric_user():
    """已登录数字用户返回正确 int member_id."""
    request = MagicMock()
    request.state.user_id = "12345"
    request.headers = {}
    assert get_member_id_int(request) == 12345


def test_get_member_id_int_with_zero_user_id():
    """user_id 为 0 返回 0."""
    request = MagicMock()
    request.state.user_id = "0"
    request.headers = {}
    assert get_member_id_int(request) == 0


def test_get_member_id_int_with_negative_user_id():
    """负数 user_id 视为非法, 回退 0 (防止伪造负数 ID 越权)."""
    request = MagicMock()
    request.state.user_id = "-1"
    request.headers = {}
    assert get_member_id_int(request) == 0


# ---------------------------------------------------------------------------
# 2. UUID / 非数字 user_id (设计限制: 返回 0)
# ---------------------------------------------------------------------------


def test_get_member_id_int_with_uuid_user():
    """UUID 用户返回 0 (设计限制, UUID 不是数字)."""
    request = MagicMock()
    request.state.user_id = "abc-def-12345-uuid"
    request.headers = {}
    assert get_member_id_int(request) == 0


def test_get_member_id_int_with_empty_user_id():
    """空字符串 user_id 返回 0."""
    request = MagicMock()
    request.state.user_id = ""
    request.headers = {}
    assert get_member_id_int(request) == 0


# ---------------------------------------------------------------------------
# 3. 未登录用户 (无 user_id, 无 token)
# ---------------------------------------------------------------------------


def test_get_member_id_int_without_login():
    """未登录用户返回 0 (guest)."""
    request = MagicMock()
    request.state.user_id = None
    request.headers = {}
    assert get_member_id_int(request) == 0


# ---------------------------------------------------------------------------
# 4. 无效 token (decode_access_token 返回 None / 抛异常)
# ---------------------------------------------------------------------------


def test_get_member_id_int_with_invalid_token():
    """无效 token 返回 0 (decode_access_token 返回 None)."""
    request = MagicMock()
    request.state.user_id = None
    request.headers = {"Authorization": "Bearer invalid_token_xxx"}
    # decode_access_token 会返回 None 或抛异常, get_member_id_int 应返回 0
    assert get_member_id_int(request) == 0


# ---------------------------------------------------------------------------
# 5. 有效 token 数字 sub (mock decode_access_token)
# ---------------------------------------------------------------------------


def test_get_member_id_int_with_valid_token(monkeypatch):
    """有效 token 数字 sub 返回正确 int."""
    request = MagicMock()
    request.state.user_id = None
    request.headers = {"Authorization": "Bearer valid_token"}

    # mock decode_access_token 返回数字 sub
    monkeypatch.setattr("app.security.decode_access_token", lambda token: {"sub": "67890"})

    assert get_member_id_int(request) == 67890
