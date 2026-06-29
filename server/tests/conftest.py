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
# 测试环境默认密钥: 绕过 security.py / security/auth.py 的模块级 _validate_jwt_secret / _validate_session_secret
# (生产代码这些校验不区分 ENV, 测试环境需要强密钥才能 import 成功)
os.environ.setdefault(
    "JWT_SECRET_KEY",
    "test-jwt-secret-key-for-pytest-only-not-for-production-use-32chars",
)
os.environ.setdefault(
    "SESSION_SECRET_KEY",
    "test-session-secret-key-for-pytest-only-not-for-production-use-32",
)
# 测试环境默认 DB URL: SQLite 本地文件, 避免 create_engine("") 报 ArgumentError
# (database.py 的 _resolve_db_url 仅对 postgresql 前缀做降级, 空字符串直接返回触发错误)
os.environ.setdefault("DB1_URL", "sqlite:///./test_db1.db")
os.environ.setdefault("DB2_URL", "sqlite:///./test_db2.db")
os.environ.setdefault("DB3_URL", "sqlite:///./test_db3.db")

import pytest

# 测试环境强制使用 fakeredis, 避免 _try_connect_redis 的 r.ping() 卡住
# (redis_util._try_connect_redis 有 socket_connect_timeout=2, 但 Windows 上可能重试导致 20s 超时)
# 必须在 app.main 被 import 之前设置, 否则 get_redis() 首次调用会触发 _try_connect_redis
try:
    import fakeredis

    from app.utils import redis_util

    redis_util._fake_redis = fakeredis.FakeRedis(decode_responses=True)
    redis_util._use_fake = True
except Exception:
    pass


# 测试环境禁用限流中间件: 大量测试累计请求会触发默认 60/60s 限制导致 429
# patch RateLimitMiddleware.dispatch 类方法直接放行, 对已注册的全局 app 也生效
@pytest.fixture(autouse=True)
def _disable_rate_limit():
    from app.core.rate_limit import RateLimitMiddleware

    original_dispatch = RateLimitMiddleware.dispatch

    async def _bypass_dispatch(self, request, call_next):
        return await call_next(request)

    RateLimitMiddleware.dispatch = _bypass_dispatch
    try:
        yield
    finally:
        RateLimitMiddleware.dispatch = original_dispatch

# 跳过需要运行中服务 / 外部依赖的 e2e 测试文件收集:
# - test_blacklist_errorcode.py / test_new_features.py: 模块级 urllib.request.urlopen
#   连接 127.0.0.1:8000, 无服务运行时 import 阶段即抛 ConnectionRefusedError
# - test_frontend_styles.py / test_playwright_e2e.py: 模块级 import playwright,
#   playwright 未安装时 import 阶段即抛 ModuleNotFoundError
# 这类测试应通过单独入口运行 (如 --run-ws 选项模式), 不进入默认 collect
collect_ignore_glob = [
    "test_blacklist_errorcode.py",
    "test_new_features.py",
    "test_frontend_styles.py",
    "test_playwright_e2e.py",
    # api_version_middleware 用 requests 直连 127.0.0.1:8000, 无服务运行时全部 ConnectionError
    # 手动跑: 先启动后端服务, 再 pytest tests/test_api_version_middleware.py
    "test_api_version_middleware.py",
]

# 缓存剥离前的原始 schema (供 teardown 还原)
_ORIGINAL_SCHEMAS: dict[str, object] = {}


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


def pytest_runtest_teardown(item):
    """测试 teardown 时, 如果之前剥离过 schema 则还原.

    避免后续测试因为 schema 被清掉而失败.
    """
    if not _ORIGINAL_SCHEMAS:
        return
    try:
        from app.database import Base
    except Exception:
        return
    for name, schema in _ORIGINAL_SCHEMAS.items():
        if name in Base.metadata.tables:
            Base.metadata.tables[name].schema = schema
    _ORIGINAL_SCHEMAS.clear()


def pytest_addoption(parser):
    """注册自定义命令行选项.

    注意: pytest_addoption 只能在 rootdir 的 conftest.py 中定义一次.
    e2e 测试需要的 --base / --skip-network 也在此注册,
    避免子目录 conftest.py 重复定义被 pytest 忽略 (导致 'no option named --base' 错误).
    """
    parser.addoption(
        "--run-ws",
        action="store_true",
        default=False,
        help="启用需要运行中服务的 WS 握手测试",
    )
    parser.addoption(
        "--base",
        action="store",
        default="http://127.0.0.1:8000",
        help="后端 base URL (e2e 冒烟测试用)",
    )
    parser.addoption(
        "--skip-network",
        action="store_true",
        default=False,
        help="跳过所有需要网络的测试 (代码检查类测试仍执行)",
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
async def auth_client():
    """已认证的异步 HTTP 客户端 (test_remote_video_admin 等 Admin 测试用).

    启动 app 后会:
      1. 调用 create_all_per_db() 在内存 SQLite 上建 admin_* 表
      2. seed 默认 admin 账号
      3. 用 admin user_id 创建 JWT (sub = "sys:{user_id}")
      4. 给 AsyncClient 注入 Authorization: Bearer <token> header
    """
    import httpx

    from app.database import create_all_per_db
    from app.main import create_app
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
        warnings.warn(f"[auth_client] create_all_per_db 失败: {e}", stacklevel=2)
    # 1.5) 清掉 dev sqlite 里残留的测试用户 (user_name != 'admin'), 避免 del_flag=2 的同名
    # 行被软删时仍占据 user_name 触发"已存在"误判
    from sqlalchemy import text as _text

    from app.database import engine1 as _engine1
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
        warnings.warn(f"[auth_client] seed_admin 失败: {e}", stacklevel=2)
    # 3) 查 admin user_id -> 创建 JWT
    from sqlalchemy import text as _text

    from app.database import engine1 as _engine1
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
        warnings.warn(f"[auth_client] 创建 token 失败: {e}", stacklevel=2)
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test", headers=headers
    ) as ac:
        yield ac


@pytest.fixture
async def auth_headers(auth_client):
    """返回 Authorization headers dict, 供 client + auth_headers 模式使用.

    复用 auth_client 的 token 生成逻辑 (建表 + seed + 创建 JWT),
    避免在 test_alerts 等测试中重复实现 token 生成.
    """
    auth = auth_client.headers.get("Authorization")
    return {"Authorization": auth} if auth else {}
