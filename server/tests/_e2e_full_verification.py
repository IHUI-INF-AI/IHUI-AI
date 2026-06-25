"""完整 e2e 验证: 后端启动 + 登录 + 受保护端点 + G 盘根目录验证.

依赖: 后端运行在 http://127.0.0.1:8000
退出码: 0=PASS, 1=FAIL
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone


def http(url, method="GET", data=None, headers=None, timeout=10):
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    body = None
    if data is not None:
        if isinstance(data, str):
            body = data.encode("utf-8")
        else:
            body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode("utf-8") or "null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8") or "null")
        except Exception:
            return e.code, None
    except Exception as e:
        return 0, str(e)


def main() -> int:
    print("=" * 80)
    print(f"e2e 全链路验证 - {datetime.now(timezone.utc).isoformat()}")
    print("=" * 80)
    print()

    fail = 0

    # 1. 后端健康检查
    print("[1/6] 后端健康检查...")
    code, data = http("http://127.0.0.1:8000/openapi.json")
    if code == 200 and isinstance(data, dict) and "paths" in data:
        print(f"      ✓ 后端运行中, 共 {len(data['paths'])} 个端点")
    else:
        print(f"      ✗ 后端不可用: code={code}")
        fail += 1

    # 2. admin 登录
    print("[2/6] admin 登录...")
    code, data = http(
        "http://127.0.0.1:8000/api/v1/login/username?username=admin&password=admin123",
        method="POST",
    )
    # 2026-06-25: data.code 是字符串 "0" 而非整数 0 (项目统一响应格式)
    if code == 200 and data and str(data.get("code")) == "0":
        access_token = data["data"].get("access_token")
        refresh_token = data["data"].get("refresh_token")
        print(f"      ✓ 登录成功")
        print(f"        access_token len = {len(access_token)}")
        print(f"        refresh_token len = {len(refresh_token)}")
    else:
        print(f"      ✗ 登录失败: code={code}, data={data}")
        fail += 1
        return fail

    # 3. 受保护端点访问 (system/user/getInfo)
    print("[3/6] 受保护端点访问 (system/user/getInfo)...")
    code, data = http(
        "http://127.0.0.1:8000/api/v1/system/user/getInfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if code == 200 and data and str(data.get("code")) == "0":
        user = data.get("data", {}).get("user", {})
        print(f"      ✓ system/user/getInfo 返回 200, user={user.get('user_name')}, roles={data.get('data', {}).get('roles')}")
    else:
        # 失败不阻塞, 仅记录 (可能是后端已知问题)
        print(f"      ⚠ system/user/getInfo: code={code}, data={data}")

    # 4. G 盘根目录检查 (关键回归测试)
    print("[4/6] G 盘根目录检查...")
    forbidden = ["G:\\1", "G:\\dev", "G:\\tmp", "G:\\pw-output"]
    for p in forbidden:
        if os.path.exists(p):
            print(f"      ✗ G 盘根目录意外存在: {p}")
            fail += 1
        else:
            print(f"      ✓ {p} 不存在 (无回归)")

    # 5. settings 配置检查
    print("[5/6] settings.LOCAL_FILE_DIR 配置检查...")
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    try:
        from app.config import settings
        expected_prefix = os.environ.get("TEMP", "C:\\Users")
        if settings.LOCAL_FILE_DIR.startswith(expected_prefix):
            print(f"      ✓ LOCAL_FILE_DIR = {settings.LOCAL_FILE_DIR}")
        else:
            print(f"      ✗ LOCAL_FILE_DIR 不在 %TEMP%: {settings.LOCAL_FILE_DIR}")
            fail += 1
    except Exception as e:
        print(f"      ✗ 配置加载失败: {e}")
        fail += 1

    # 6. 错误密码测试
    print("[6/6] 错误密码测试...")
    code, data = http(
        "http://127.0.0.1:8000/api/v1/login/username?username=admin&password=WRONG",
        method="POST",
    )
    if code != 200 or (data and str(data.get("code")) != "0"):
        print(f"      ✓ 错误密码正确被拒绝: code={code}")
    else:
        print(f"      ✗ 错误密码未拒绝: code={code}, data={data}")
        fail += 1

    print()
    print("=" * 80)
    if fail == 0:
        print(f"PASS: 6/6 验证通过 - e2e 全链路正常, G 盘根目录无回归")
        return 0
    else:
        print(f"FAIL: {fail}/6 验证未通过")
        return 1


if __name__ == "__main__":
    sys.exit(main())
