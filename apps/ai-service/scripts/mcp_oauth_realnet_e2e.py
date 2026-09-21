# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公网 MCP OAuth 真网端到端验收(GAP-PLAN「真实外部缺口」第 1 条)。

对真实公网服务器(Linear MCP)完成完整 OAuth 2.0 + PKCE 授权码流程:
  1. 动态客户端注册(DCR,RFC 7591)已提前完成,client_id 见 LINEAR_CLIENT_ID
  2. 本脚本起 localhost 回调监听 → build_authorization_url_async() 构造 PKCE 授权 URL
     → 自动打开系统默认浏览器(用户登录 Linear 并点击授权)
  3. 回调捕获 code + state → set_authorization_code() → get_token()(PKCE S256 真实校验)
  4. MCPClient(streamable-http)连 https://mcp.linear.app/mcp,Bearer 真网注入
     → initialize → tools/list →(尽力)tools/call 一个只读工具
  5. token 持久化(persist_path),供 tests/test_mcp_oauth_realnet.py 免人工复跑

用法:
    G:/IHUI-AI/apps/ai-service/.venv/Scripts/python.exe scripts/mcp_oauth_realnet_e2e.py
需要人工:弹出浏览器后登录 Linear 并点 Authorize(300 秒超时)。
"""

from __future__ import annotations

import asyncio
import json
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.mcp_client import MCPClient, MCPClientConfig  # noqa: E402
from app.services.mcp_oauth import MCPOAuthClient, MCPOAuthConfig  # noqa: E402

# DCR(2026-09-07 完成,public client / token_endpoint_auth_method=none):
#   POST https://mcp.linear.app/register {"redirect_uris":["http://localhost:9919/callback"],...}
LINEAR_CLIENT_ID = "x8zglnvuliStFZce"
LINEAR_TOKEN_URL = "https://mcp.linear.app/token"
LINEAR_MCP_URL = "https://mcp.linear.app/mcp"
REDIRECT_URI = "http://localhost:9919/callback"
CALLBACK_PORT = 9919
PERSIST_PATH = Path(__file__).resolve().parents[1] / ".mcp-linear-token.json"
CONSENT_TIMEOUT_SEC = 300


class _CallbackCapture:
    """捕获 OAuth 回调 ?code= & ?state=。"""

    def __init__(self) -> None:
        self.code = ""
        self.state = ""
        self.received = threading.Event()

    def make_handler(self) -> type[BaseHTTPRequestHandler]:
        outer = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802
                if self.path.startswith("/callback"):
                    outer._parse(self.path)
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.end_headers()
                    self.wfile.write(
                        "<h2>IHUI-AI OAuth 回调已捕获,可关闭此页回到终端。</h2>".encode()
                    )
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, *args) -> None:  # 静默
                pass

        return Handler

    def _parse(self, path: str) -> None:
        from urllib.parse import parse_qs, urlparse

        qs = parse_qs(urlparse(path).query)
        self.code = (qs.get("code") or [""])[0]
        self.state = (qs.get("state") or [""])[0]
        if self.code:
            self.received.set()


async def main() -> int:
    oauth = MCPOAuthClient(
        MCPOAuthConfig(
            grant_type="authorization_code",
            client_id=LINEAR_CLIENT_ID,
            auth_server_url="https://mcp.linear.app/.well-known/oauth-authorization-server",
            scopes=["read", "openid"],
            redirect_uri=REDIRECT_URI,
            persist_path=str(PERSIST_PATH),
        )
    )

    # 快速通道:已有持久化 token(或可刷新)则跳过人工授权
    token = None
    try:
        token = await oauth.get_token()
        print("[fast] 复用持久化 token,跳过浏览器授权")
    except Exception:  # noqa: BLE001 无持久化/已失效 → 走完整授权码流
        token = None

    if token is None:
        capture = _CallbackCapture()
        server = HTTPServer(("127.0.0.1", CALLBACK_PORT), capture.make_handler())
        threading.Thread(target=server.serve_forever, daemon=True).start()
        print(f"[1/5] 回调监听已启动 http://localhost:{CALLBACK_PORT}/callback")

        url = await oauth.build_authorization_url_async()
        print("[2/5] 授权 URL 已构造(PKCE S256):")
        print(f"      {url}")
        webbrowser.open(url)
        print("      已尝试打开系统默认浏览器;请在浏览器中登录 Linear 并点击授权…")

        if not capture.received.wait(CONSENT_TIMEOUT_SEC):
            print("超时:未在 300 秒内收到授权回调", file=sys.stderr)
            server.shutdown()
            return 2
        server.shutdown()
        print(f"[3/5] 回调已捕获 code(前 8 位)={capture.code[:8]}… state 匹配由客户端内部校验")

        oauth.set_authorization_code(capture.code)
        token = await oauth.get_token()

    print(
        f"[4/5] access_token 已获取(token_type={token.token_type}, "
        f"len={len(token.access_token)}, refresh={'有' if token.refresh_token else '无'})"
    )

    client = MCPClient(
        MCPClientConfig(
            name="linear-realnet",
            transport="streamable-http",
            url=LINEAR_MCP_URL,
            oauth=oauth,
            timeout=60.0,
        )
    )
    await client.connect()
    tools = await client.list_tools()
    names = [t.name if hasattr(t, "name") else t.get("name") for t in tools]
    print(f"[5/5] 真网 MCP 全链路成功:initialize+tools/list 共 {len(names)} 个工具")
    print("      工具样例:", names[:8])

    called = ""
    for name in names:
        if name in ("list_teams", "listTeams", "linear_list_teams", "list_linear_teams"):
            called = name
            break
    if called:
        result = await client.call_tool(called, {})
        text = json.dumps(result, ensure_ascii=False)[:200]
        print(f"      tools/call({called}) 成功: {text}…")
    else:
        print("      (未匹配到零参只读工具,跳过 tools/call;initialize+tools/list 已证明全链)")

    await client.disconnect()
    print(f"PASS:公网 MCP OAuth 真网端到端闭环;token 已持久化 {PERSIST_PATH.name}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
