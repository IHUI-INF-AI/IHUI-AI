# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""连接器 OAuth 回调的公网可达性锁(2026-11-24 立)。

回调是平台授权服务器跳回来的浏览器请求,只带 code+state,没有也不能带 JWT;
身份完全由 state HMAC 自证。钉死:
  ① 精确路径进 _ALWAYS_PUBLIC(不受部署 .env 整串替换影响);
  ② 即使 .env 塞进危险的 JWT_PUBLIC_PATHS,该路径仍在 PUBLIC_PATHS 且危险项被剔除;
  ③ callback router 端点本身没有用户身份 Depends —— 不会因"取不到 JWT"500。
"""
import app.core.jwt_auth as jwt_auth
from app.core.jwt_auth import _ALWAYS_PUBLIC, _resolve_public_paths, _is_never_public


CALLBACK_PATH = "/api/connectors/oauth/callback"


def test_callback_is_in_always_public_exact_path():
    """精确路径(非目录前缀)进强制公开清单,不随 router 扩端点放行。"""
    assert CALLBACK_PATH in _ALWAYS_PUBLIC
    assert not CALLBACK_PATH.endswith("/"), "必须是精确路径"


def test_resolve_public_paths_keeps_callback_even_with_stale_env():
    """部署 .env 整串替换也不丢回调;同时危险条目照旧被剔除。"""
    resolved = _resolve_public_paths(
        "/api/agents/,/,/api/mcp,/api/admin/news/trigger-refresh"
    )
    assert CALLBACK_PATH in resolved
    assert "/api/agents/" not in resolved
    assert "/" not in resolved
    assert "/api/admin/news/trigger-refresh" not in resolved


def test_never_public_roots_do_not_cover_callback():
    """回调端点不在任何永不公开的 router 根下。"""
    assert not _is_never_public(CALLBACK_PATH)
    for root in jwt_auth._NEVER_PUBLIC_ROOTS:
        assert not CALLBACK_PATH.startswith(root.rstrip("/") + "/")


def test_callback_router_has_no_jwt_dependency():
    """callback handler 不声明 require_request_user_id 等 JWT 依赖(靠 state 自证)。"""
    import inspect
    import app.routers.connectors as connectors

    sig = inspect.signature(connectors.oauth_callback)
    assert "request_user_id" not in sig.parameters
    assert "user_id" not in sig.parameters
    assert "ctx" not in sig.parameters
