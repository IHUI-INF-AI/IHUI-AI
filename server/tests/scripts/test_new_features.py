"""验证 mock SMS 限流 + JWT refresh + WS 鉴权."""
import json
import urllib.error
import urllib.request

import pytest

pytestmark = pytest.mark.integration

BASE = "http://127.0.0.1:8000"


def _post(path, body):
    url = BASE + path
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# 1. JWT refresh 返回真实 JWT
print("=== 1. JWT refresh ===")
code, body = _post("/api/login/pwd/refreshToken", {"refreshToken": "fake", "uuid": "test"})
j = json.loads(body)
tok = j.get("data", {}).get("token", "")
print(f"HTTP {code} token_is_jwt={tok.count('.') == 2} prefix={tok[:20]}")

# 2. mock SMS 限流 (Redis 持久化)
print("\n=== 2. mock SMS 限流 ===")
phone = "13900000001"
code1, body1 = _post("/api/login/pwd/smsVerify", {"phone": phone})
print(f"1st: HTTP {code1} {body1[:100]}")
code2, body2 = _post("/api/login/pwd/smsVerify", {"phone": phone})
print(f"2nd: HTTP {code2} {body2[:100]}")
print(f"rate_limit_works={code1 == 200 and code2 == 429}")

# 3. WS 鉴权 (无 token 应被拒绝)
print("\n=== 3. WS 鉴权 (无 token) ===")
import socket
import struct

# 用裸 socket 模拟 WS 握手, 检查是否被拒绝
# 简化: 只检查 HTTP 响应码 (WS 升级握手)
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.settimeout(5)
sock.connect(("127.0.0.1", 8000))
# 发送 WS 升级请求 (无 token)
req = (
    "GET /ws/chat HTTP/1.1\r\n"
    "Host: 127.0.0.1:8000\r\n"
    "Upgrade: websocket\r\n"
    "Connection: Upgrade\r\n"
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
    "Sec-WebSocket-Version: 13\r\n"
    "\r\n"
)
sock.send(req.encode())
resp = sock.recv(4096).decode(errors="replace")
sock.close()
# 期望: 403 或非 101 (非升级成功)
first_line = resp.split("\r\n")[0] if resp else "empty"
print(f"WS no-token response: {first_line}")
ws_auth_works = "101" not in first_line
print(f"ws_auth_rejects_no_token={ws_auth_works}")

# 4. WS 鉴权 (有 token 应通过)
print("\n=== 4. WS 鉴权 (有 token) ===")
# 先登录拿 token
code, body = _post("/api/login/pwd/refreshToken", {"refreshToken": "fake"})
tok = json.loads(body).get("data", {}).get("token", "")
sock2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock2.settimeout(5)
sock2.connect(("127.0.0.1", 8000))
req2 = (
    f"GET /ws/chat?token={tok} HTTP/1.1\r\n"
    "Host: 127.0.0.1:8000\r\n"
    "Upgrade: websocket\r\n"
    "Connection: Upgrade\r\n"
    "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
    "Sec-WebSocket-Version: 13\r\n"
    "\r\n"
)
sock2.send(req2.encode())
resp2 = sock2.recv(4096).decode(errors="replace")
sock2.close()
first_line2 = resp2.split("\r\n")[0] if resp2 else "empty"
print(f"WS with-token response: {first_line2}")
ws_auth_accepts_token = "101" in first_line2
print(f"ws_auth_accepts_valid_token={ws_auth_accepts_token}")

print("\n=== Summary ===")
print(f"jwt_refresh_real_jwt: {'PASS' if tok.count('.') == 2 else 'FAIL'}")
print(f"sms_rate_limit_redis: {'PASS' if code1 == 200 and code2 == 429 else 'FAIL'}")
print(f"ws_rejects_no_token: {'PASS' if ws_auth_works else 'FAIL'}")
print(f"ws_accepts_valid_token: {'PASS' if ws_auth_accepts_token else 'FAIL'}")
