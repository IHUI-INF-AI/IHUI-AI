"""Pytest 全局 conftest.

提供共享 fixture, 避免每个测试文件重复定义.

提供的 fixture:
  - client: 异步 HTTP 客户端 (httpx.AsyncClient + ASGITransport)
            兼容 `await client.post(...)` 用法 (test_username_login / test_e2e_payments)
  - sync_client: 同步 HTTP 客户端 (fastapi.testclient.TestClient)
                  兼容 `client.post(...)` 用法 (test_p1_2 / test_p1_3 / test_p1_4 / test_s1)

提供的选项:
  --run-ws: 启用需要运行中服务的 WS 握手测试
"""

import os

# 测试环境标志: 跳过 schema 初始化, 避免连真实 PG
os.environ.setdefault("SKIP_SCHEMA_INIT", "1")
os.environ.setdefault("ENV", "test")

import pytest

# playwright 未安装时跳过依赖它的测试文件，避免收集阶段 ModuleNotFoundError
try:
    import playwright  # noqa: F401
except ImportError:
    collect_ignore = [
        "test_frontend_styles.py",
        "test_playwright_e2e.py",
    ]

# 缓存剥离前的原始 schema (供 teardown 还原)
_ORIGINAL_SCHEMAS: dict[str, object] = {}

# ---------------------------------------------------------------------------
# WS 测试鉴权旁路: 测试环境默认跳过 token 校验, 由各测试自行管理 user_uuid
# ---------------------------------------------------------------------------
os.environ.setdefault("WS_AUTH_BYPASS", "1")


def pytest_runtest_setup(item):
    """测试 setup 时, 如果是 SQLite schema 剥离测试则剥离 metadata.

    建议 113 兼容: 多租户阶段 2 给多张表加了 schema='public',
    SQLite 不支持 schema 概念, 把 metadata 中所有表的 schema 字段统一设为 None.
    只针对 sqlite_strips_schema 测试剥离 (其它测试要 schema='public' 断言).
    """
    if "sqlite_strips_schema" not in item.name:
        return
    try:
        from app.database import Base
    except Exception:
        return
    for name, tbl in Base.metadata.tables.items():
        _ORIGINAL_SCHEMAS[name] = tbl.schema
        tbl.schema = None


def pytest_runtest_teardown(item, nextitem):
    """测试 teardown 时, 如果之前剥离过 schema 则还原.

    避免后续测试因为 schema 被清掉而失败.
    使用 try/finally 确保即使还原过程中抛异常, 也会清空缓存避免污染后续测试.
    """
    if not _ORIGINAL_SCHEMAS:
        return
    try:
        from app.database import Base
        for name, schema in _ORIGINAL_SCHEMAS.items():
            if name in Base.metadata.tables:
                Base.metadata.tables[name].schema = schema
    finally:
        _ORIGINAL_SCHEMAS.clear()


def pytest_addoption(parser):
    """注册自定义命令行选项."""
    parser.addoption(
        "--run-ws",
        action="store_true",
        default=False,
        help="启用需要运行中服务的 WS 握手测试",
    )


@pytest.fixture
def run_ws(request):
    """返回 --run-ws 选项值."""
    return request.config.getoption("--run-ws")


@pytest.fixture
async def client():
    """异步 HTTP 客户端 (httpx.AsyncClient + ASGITransport).

    用法:
        async def test_xxx(client):
            resp = await client.post("/api/v1/...")
    """
    import httpx
    from app.main import create_app

    app = create_app()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sync_client():
    """同步 HTTP 客户端 (fastapi.testclient.TestClient).

    用法:
        def test_xxx(sync_client):
            resp = sync_client.post("/api/v1/...")
    """
    from fastapi.testclient import TestClient
    from app.main import app

    return TestClient(app)


@pytest.fixture
def auth_headers():
    """返回认证 headers, 供需要登录的测试使用.

    用法:
        async def test_xxx(client, auth_headers):
            resp = await client.get("/url", headers=auth_headers)
    """
    return {"Authorization": "Bearer test-token"}


@pytest.fixture
async def auth_client():
    """已认证的异步 HTTP 客户端 (test_remote_video_admin 等 Admin 测试用).

    启动 app 后会:
      1. 调用 create_all_per_db() 在内存 SQLite 上建 admin_* 表
      2. seed 默认 admin 账号
      3. 用 admin user_id 创建 JWT (sub = "sys:{user_id}")
      4. 给 AsyncClient 注入 Authorization: Bearer <token> header
    """
    import httpx
    from app.main import create_app
    from app.database import create_all_per_db
    from app.security import create_access_token
    from scripts.ci.seed_admin import seed_admin

    # 注意顺序: 必须先 create_app() 让 main.py 走 schema-strip 逻辑 (单租户模式去掉
    # table.schema="public" 前缀), 再 create_all_per_db() 才能在 SQLite 上建正确的表.
    app = create_app()
    # 1) 建 admin_* 表
    try:
        create_all_per_db()
    except Exception as e:
        import warnings
        warnings.warn(f"[auth_client] create_all_per_db 失败: {e}")
    # 1.5) 清掉 dev sqlite 里残留的测试用户 (user_name != 'admin'), 避免 del_flag=2 的同名
    # 行被软删时仍占据 user_name 触发"已存在"误判
    from app.database import engine1 as _engine1
    from sqlalchemy import text as _text
    try:
        with _engine1.begin() as conn:
            conn.execute(
                _text("DELETE FROM admin_user WHERE user_name != 'admin'")
            )
    except Exception:
        pass
    # 2) seed admin
    try:
        seed_admin()
    except Exception as e:
        import warnings
        warnings.warn(f"[auth_client] seed_admin 失败: {e}")
    # 3) 查 admin user_id -> 创建 JWT
    from app.database import engine1 as _engine1
    from sqlalchemy import text as _text
    token = ""
    try:
        with _engine1.connect() as conn:
            row = conn.execute(
                _text("SELECT user_id FROM admin_user WHERE user_name = :un"),
                {"un": "admin"},
            ).fetchone()
        if row and row[0]:
            sub = f"sys:{int(row[0])}"
            token = create_access_token(sub)
    except Exception as e:
        import warnings
        warnings.warn(f"[auth_client] 创建 token 失败: {e}")
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", headers=headers
    ) as ac:
        yield ac
