"""验证 JWT 黑名单 + 错误码标准化 + logout 吊销."""
import json
import urllib.error
import urllib.request

import pytest

pytestmark = pytest.mark.integration

BASE = "http://127.0.0.1:8000"


def _post(path, body=None, headers=None):
    url = BASE + path
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method="POST", headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def _get(path, headers=None):
    url = BASE + path
    req = urllib.request.Request(url, method="GET", headers=headers or {})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# 1. mock login 拿 refreshToken, 再 refresh 换真实 JWT
print("=== 1. 登录拿真实 JWT ===")
code, body = _post("/api/login/pwd/login", {"username": "admin", "password": "admin123"})
j = json.loads(body)
refresh_token = j.get("data", {}).get("refreshToken", "")
print(f"mock login: HTTP {code} refresh_prefix={refresh_token[:20]}")

# 用 refreshToken 换真实 JWT (mock_login_pwd_refresh 返回真实 JWT)
code, body = _post("/api/login/pwd/refreshToken", {"refreshToken": refresh_token})
j = json.loads(body)
token = j.get("data", {}).get("token", "")
print(f"refresh: HTTP {code} token_is_jwt={token.count('.') == 2} prefix={token[:20]}")

# 2. 用 token 访问受保护接口
print("\n=== 2. token 访问受保护接口 ===")
code, body = _get("/api/v1/auth/auth/info", {"Authorization": f"Bearer {token}"})
print(f"before logout: HTTP {code} body={body[:100]}")

# 3. logout 吊销 token
print("\n=== 3. logout 吊销 token ===")
code, body = _post("/api/v1/auth/auth/logout", headers={"Authorization": f"Bearer {token}"})
print(f"logout: HTTP {code} body={body[:100]}")

# 4. 再用同一 token 访问 (应 401, 黑名单生效)
print("\n=== 4. 吊销后 token 访问 (应 401) ===")
code, body = _get("/api/v1/auth/auth/info", {"Authorization": f"Bearer {token}"})
print(f"after logout: HTTP {code} body={body[:150]}")
# 黑名单生效: decode_access_token 返回 None → require_login 抛 401
jwt_blacklist_works = code == 401
print(f"jwt_blacklist_works={jwt_blacklist_works}")

# 5. 错误码标准化: mock SMS 限流返回标准 code
print("\n=== 5. 错误码标准化 (mock SMS 限流) ===")
phone = "13900000099"
code1, body1 = _post("/api/login/pwd/smsVerify", {"phone": phone})
j1 = json.loads(body1)
code2, body2 = _post("/api/login/pwd/smsVerify", {"phone": phone})
j2 = json.loads(body2)
print(f"1st: HTTP {code1} biz_code={j1.get('code')}")
print(f"2nd: HTTP {code2} biz_code={j2.get('code')} msg={j2.get('msg', '')[:60]}")
error_code_standard = code2 == 429 and j2.get("code") == "429000"
print(f"error_code_standard={error_code_standard}")

# 6. 错误码标准化: 验证码错误返回标准 code
print("\n=== 6. 错误码标准化 (验证码错误) ===")
code, body = _post("/api/login/pwd/verify", {"phone": "13800000000", "code": "abc"})
j = json.loads(body)
print(f"invalid code: HTTP {code} biz_code={j.get('code')} msg={j.get('msg', '')[:60]}")
sms_code_standard = code == 400 and j.get("code") == "400101"
print(f"sms_code_standard={sms_code_standard}")

print("\n=== Summary ===")
print(f"jwt_blacklist_revoke: {'PASS' if jwt_blacklist_works else 'FAIL'}")
print(f"error_code_rate_limit: {'PASS' if error_code_standard else 'FAIL'}")
print(f"error_code_sms_invalid: {'PASS' if sms_code_standard else 'FAIL'}")
