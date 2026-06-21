"""JWT 真实签发接入测试.

测试:
1. POST /login/username 端点存在 + 参数校验
2. 用户名错误 -> 401
3. 密码错误 -> 401
4. 正确账号 (admin/admin123) -> 200 + 返回 access_token
5. JWT 解码后 payload 包含 user_name/roles/dept 等额外声明
6. refresh_token 与 access_token 不同
7. security.create_access_token + decode_access_token 单元测试
"""

from unittest.mock import patch

import pytest

# ---------------------------------------------------------------------------
# security 单元测试
# ---------------------------------------------------------------------------


def test_jwt_create_and_decode():
    from app.security import create_access_token, decode_access_token

    token = create_access_token(subject="user-123", extra_claims={"role": "admin"})
    assert isinstance(token, str) and len(token) > 20
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "user-123"
    assert payload["role"] == "admin"
    assert "exp" in payload


def test_jwt_decode_invalid():
    from app.security import decode_access_token

    assert decode_access_token("invalid.token.here") is None
    assert decode_access_token("") is None
    assert decode_access_token("garbage") is None


def test_password_hash_and_verify():
    from app.security import hash_password, verify_password

    h = hash_password("hello123")
    assert h != "hello123"
    assert verify_password("hello123", h) is True
    assert verify_password("wrong", h) is False


# ---------------------------------------------------------------------------
# 端点集成测试 — 不依赖 seed 脚本
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_user_login():
    """mock 整个数据库查询, 让端点不依赖 seed/真实表."""
    fake_user = type(
        "FakeUser",
        (),
        {
            "user_id": 1,
            "user_name": "admin",
            "nick_name": "超级管理员",
            "password": None,
            "avatar": "",
            "dept_id": 3,
            "status": "0",
            "del_flag": "0",
        },
    )()
    # 真实 password 字段需要哈希
    from app.security import hash_password

    fake_user.password = hash_password("admin123")
    fake_role = type("FakeRole", (), {"role_key": "admin", "role_name": "超管", "role_id": 1})()
    fake_dept = type("FakeDept", (), {"dept_id": 3, "dept_name": "研发部门"})()
    return {
        "users": [fake_user],
        "roles": [fake_role],
        "dept": fake_dept,
    }


def _mock_redis_ops(monkeypatch):
    """mock redis_util 中的 incr_key_with_expire / get_key / delete_key, 避免真连 Redis.

    注意: username_login.py 用的是 `from app.utils.redis_util import ...`，
    所以函数绑定到了 username_login 模块命名空间，必须 patch 那里。
    """
    fake_store = {}

    def fake_incr(key, expire=None):
        fake_store[key] = fake_store.get(key, 0) + 1
        return fake_store[key]

    def fake_get(key):
        return fake_store.get(key, 0)

    def fake_delete(key):
        fake_store.pop(key, None)

    from app.api.v1.auth import username_login

    monkeypatch.setattr(username_login, "incr_key_with_expire", fake_incr)
    monkeypatch.setattr(username_login, "get_key", fake_get)
    monkeypatch.setattr(username_login, "delete_key", fake_delete)


@pytest.mark.asyncio
async def test_login_username_success(client, mock_user_login, monkeypatch):
    """admin/admin123 登录成功."""
    _mock_redis_ops(monkeypatch)
    fake = mock_user_login
    # patch db session
    from app.api.v1.auth import username_login

    fake_db = type(
        "FakeDB",
        (),
        {
            "query": lambda self, model: FakeQuery(mock_user_login, model),
            "close": lambda self: None,
        },
    )()
    with patch.object(username_login, "_get_db_session", return_value=fake_db):
        resp = await client.post("/api/v1/login/username?username=admin&password=admin123")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 0, data
    payload = data["data"]
    assert payload["user_name"] == "admin"
    assert payload["nick_name"] == "超级管理员"
    assert payload["token_type"] == "Bearer"
    assert "access_token" in payload
    assert len(payload["access_token"]) > 20
    assert "refresh_token" in payload
    assert payload["refresh_token"] != payload["access_token"]  # 两个不同
    assert "admin" in payload["roles"]
    # 验证 JWT payload
    from app.security import decode_access_token

    claims = decode_access_token(payload["access_token"])
    assert claims["sub"] == "1"
    assert claims["user_name"] == "admin"
    assert "admin" in claims["roles"]


@pytest.mark.asyncio
async def test_login_username_wrong_password(client, mock_user_login, monkeypatch):
    """密码错误 -> 401."""
    _mock_redis_ops(monkeypatch)
    from app.api.v1.auth import username_login

    fake_db = type(
        "FakeDB",
        (),
        {
            "query": lambda self, model: FakeQuery(mock_user_login, model),
            "close": lambda self: None,
        },
    )()
    with patch.object(username_login, "_get_db_session", return_value=fake_db):
        resp = await client.post("/api/v1/login/username?username=admin&password=wrong")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == 401
    assert "密码" in data["message"]


@pytest.mark.asyncio
async def test_login_username_user_not_found(client, monkeypatch):
    """用户不存在 -> 401."""
    _mock_redis_ops(monkeypatch)
    empty = {"users": [], "roles": [], "dept": None}
    from app.api.v1.auth import username_login

    fake_db = type(
        "FakeDB",
        (),
        {
            "query": lambda self, model: FakeQuery(empty, model),
            "close": lambda self: None,
        },
    )()
    with patch.object(username_login, "_get_db_session", return_value=fake_db):
        resp = await client.post("/api/v1/login/username?username=nobody&password=x")
    assert resp.status_code == 200
    assert resp.json()["code"] == 401
    assert "用户不存在" in resp.json()["message"]


@pytest.mark.asyncio
async def test_login_username_account_disabled(client, mock_user_login, monkeypatch):
    """账号停用 -> 403."""
    _mock_redis_ops(monkeypatch)
    mock_user_login["users"][0].status = "1"
    from app.api.v1.auth import username_login

    fake_db = type(
        "FakeDB",
        (),
        {
            "query": lambda self, model: FakeQuery(mock_user_login, model),
            "close": lambda self: None,
        },
    )()
    with patch.object(username_login, "_get_db_session", return_value=fake_db):
        resp = await client.post("/api/v1/login/username?username=admin&password=admin123")
    assert resp.status_code == 200
    assert resp.json()["code"] == 403
    assert "停用" in resp.json()["message"]


@pytest.mark.asyncio
async def test_login_username_db_unavailable(client, monkeypatch):
    """数据库不可用 -> 500."""
    _mock_redis_ops(monkeypatch)
    from app.api.v1.auth import username_login

    with patch.object(username_login, "_get_db_session", return_value=None):
        resp = await client.post("/api/v1/login/username?username=admin&password=admin123")
    assert resp.status_code == 200
    assert resp.json()["code"] == 500


# ---------------------------------------------------------------------------
# Helper: FakeQuery 模拟 SQLAlchemy 查询链
# ---------------------------------------------------------------------------


class FakeQuery:
    """简易 query 模拟: 接受模型类, 返回 .filter().first() 链式调用."""

    def __init__(self, data, model):
        self.data = data
        self.model = model
        # 简化: 用 type name 判断
        self._model_name = model.__name__ if hasattr(model, "__name__") else str(model)

    def filter(self, *args):
        return self

    def join(self, *args, **kw):
        return self

    def first(self):
        # 简化: 返回 users/roles/dept 中的第一条
        if self._model_name in ("SysUser",):
            return self.data["users"][0] if self.data["users"] else None
        if self._model_name in ("SysRole",):
            return self.data["roles"][0] if self.data["roles"] else None
        if self._model_name in ("SysDept",):
            return self.data.get("dept")
        return None

    def all(self):
        if self._model_name in ("SysRole",):
            return self.data["roles"]
        return []
