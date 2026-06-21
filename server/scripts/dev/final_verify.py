"""最终全量验证脚本 — 覆盖所有检查项."""

import json
import time
import urllib.request

results = []


def check(name, ok, detail=""):
    icon = "PASS" if ok else "FAIL"
    results.append(f"  {'✅' if ok else '❌'} {name}" + (f" — {detail}" if detail else ""))
    return ok


def api(method, url, data=None, token=None, timeout=10):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r, timeout=timeout)
        raw = resp.read().decode()
        try:
            return resp.status, json.loads(raw)
        except json.JSONDecodeError:
            return resp.status, {"_html": raw[:100]}
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except:
            return e.code, {}


print("=" * 60)
print("  最终全量验证")
print("=" * 60)

# ─── T1: 进程存活 ───
import socket


def port_open(host, port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(3)
    try:
        s.connect((host, port))
        s.close()
        return True
    except:
        return False


check("后端 8000 端口", port_open("127.0.0.1", 8000))
check("前端 8888 端口", port_open("127.0.0.1", 8888))

# ─── T2: 后端 healthz ───
code, body = api("GET", "http://127.0.0.1:8000/healthz")
check("后端 /healthz", code == 200, f"status={code}")

# ─── T3: 后端 /docs Swagger UI ───
try:
    r = urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=5)
    html = r.read().decode()
    check("后端 /docs Swagger UI", "swagger" in html.lower() or "openapi" in html.lower(), f"len={len(html)}")
except Exception as e:
    check("后端 /docs Swagger UI", False, str(e)[:50])

# ─── T4: 登录 + JWT ───
code, body = api("POST", "http://127.0.0.1:8000/api/v1/login/username", {"username": "admin", "password": "admin123"})
token = (body.get("data") or {}).get("access_token")
check("用户名登录", code == 200 and bool(token))

code, body = api("GET", "http://127.0.0.1:8000/api/v1/user/getInfo", token=token)
user = (body.get("data") or {}).get("user", {})
check("JWT 鉴权", code == 200 and user.get("userName") == "admin")

# ─── T5: 通过 Vite 代理 ───
code, body = api("POST", "http://127.0.0.1:8888/api/v1/login/username", {"username": "admin", "password": "admin123"})
token2 = (body.get("data") or {}).get("access_token")
check("Vite 代理登录", code == 200 and bool(token2))

if token2:
    for path, label in [
        ("/api/v1/user/getInfo", "Vite→JWT"),
        ("/api/v1/llm/models-unify", "Vite→models-unify"),
        ("/api/v1/agents/list", "Vite→agents"),
        ("/api/v1/agents/categories/list", "Vite→categories"),
    ]:
        code, _ = api("GET", f"http://127.0.0.1:8888{path}", token=token2)
        check(label, code == 200, f"status={code}")

# ─── T6: CORS 预检 ───
try:
    r = urllib.request.urlopen(
        urllib.request.Request(
            "http://127.0.0.1:8888/api/v1/auth/login/sms",
            method="OPTIONS",
            headers={"Origin": "http://127.0.0.1:8888", "Access-Control-Request-Method": "POST"},
        ),
        timeout=5,
    )
    acao = r.headers.get("Access-Control-Allow-Origin", "")
    check("CORS 预检", r.status in (200, 204), f"ACAO={acao}")
except Exception as e:
    check("CORS 预检", False, str(e)[:50])

# ─── T7: 兼容端点 CRUD ───
if token:
    uid = str(int(time.time() * 1000))
    code, body = api(
        "POST", f"http://127.0.0.1:8000/cozeZhsApi/ai-model-info/add?name=Verify-{uid}&source=verify", token=token
    )
    new_id = (body.get("data") or {}).get("id")
    check("compat create", code == 200 and bool(new_id), f"id={new_id}")

    if new_id:
        code, body = api("GET", f"http://127.0.0.1:8000/cozeZhsApi/ai-model-info/delete?id={new_id}", token=token)
        check("compat delete", code == 200, f"body_code={body.get('code')}")

# ─── T8: OpenAPI 路由数 ───
code, body = api("GET", "http://127.0.0.1:8000/openapi.json")
paths = body.get("paths", {})
check("OpenAPI 路由数", len(paths) > 600, f"total={len(paths)}")

# 新路由存在性
new_routes = [p for p in paths if "llm" in p or "compat" in p]
check("新路由已注册", len(new_routes) >= 4, f"routes={new_routes}")

# ─── T9: 前端 SPA 加载 ───
try:
    r = urllib.request.urlopen("http://127.0.0.1:8888/", timeout=5)
    html = r.read().decode()
    is_spa = "<div id=" in html and ("vue" in html.lower() or "script" in html.lower())
    check("前端 SPA 加载", is_spa, f"len={len(html)}")
except Exception as e:
    check("前端 SPA 加载", False, str(e)[:50])

# ─── 汇总 ───
print()
for r in results:
    print(r)
passed = sum(1 for r in results if "✅" in r)
failed = sum(1 for r in results if "❌" in r)
print(f"\n  结果: {passed} PASS / {failed} FAIL (共 {len(results)} 项)")
print("=" * 60)
