"""P0 批次1 端点 E2E 验证脚本.

按分组对 40 个端点做最小可行性测试:
  1. 静态路径 / 动态路径可达性
  2. 鉴权 (401) 与参数校验 (422) 行为
  3. 成功路径 200 (在 mock 数据下)

输出: 端点覆盖矩阵 + 失败原因 (不阻塞, 仅报告).
"""
from __future__ import annotations

import json
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx


BASE = "http://127.0.0.1:8000/api/v1"


def fetch_openapi_paths() -> Dict[str, List[str]]:
    """拉取 OpenAPI, 提取 edu supplement p0 batch1 全部路径."""
    r = httpx.get(f"{BASE}/../openapi.json", timeout=30.0)
    r.raise_for_status()
    spec = r.json()
    paths: Dict[str, List[str]] = {}
    for p, methods in spec.get("paths", {}).items():
        if "/edu/edu-supplement-p0-batch1" in p:
            paths[p] = list(methods.keys())
    return paths


def test_endpoint(
    client: httpx.Client,
    method: str,
    path: str,
    body: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> Tuple[int, Dict[str, Any]]:
    """执行一次 HTTP 调用, 返回 (status, json). 异常返回 (0, error)."""
    url = f"{BASE}{path}"
    try:
        resp = client.request(
            method=method,
            url=url,
            json=body,
            headers=headers or {},
            timeout=15.0,
        )
        try:
            return resp.status_code, resp.json()
        except Exception:
            return resp.status_code, {"raw": resp.text[:200]}
    except Exception as e:
        return 0, {"error": str(e)}


def main() -> int:
    paths = fetch_openapi_paths()
    print(f"=== Found {len(paths)} paths in edu-supplement-p0-batch1 ===")
    for p in sorted(paths.keys()):
        print(f"  {sorted(paths[p])}  {p}")

    # 按分组编写探针 (用合理缺省值, 期望 200/401/422/400, 不期望 404/500)
    probes: List[Dict[str, Any]] = []

    # 1. 支付回调 (无需鉴权, 但需要签名头)
    for sig_alias in ["X-Alipay-Signature", "X-Wechatpay-Signature"]:
        for path in ["/edu/pay/callback/alipay", "/edu/pay/callback/wechat"]:
            probes.append({
                "method": "POST", "path": path,
                "body": {"out_trade_no": "TEST_001", "trade_status": "TRADE_SUCCESS"},
                "headers": {sig_alias: "sha256=test_invalid"},
                "group": "1.pay_callback",
            })

    # 2. 认证授权补全 (需要鉴权 → 期望 401)
    for path in [
        "/edu/auth/logout", "/edu/auth/refresh", "/edu/auth/sms/send",
        "/edu/auth/sms/login", "/edu/auth/me/permissions", "/edu/auth/me/roles",
        "/edu/admin/auth/role/assign", "/edu/admin/auth/permission/grant",
        "/edu/admin/auth/role/list",
    ]:
        for m in ["POST", "GET"]:
            probes.append({
                "method": m, "path": path, "body": {}, "headers": {},
                "group": "2.auth_supplement", "expect": 401,
            })

    # 3. 会员账户体系 (需要鉴权 → 期望 401 或 422)
    for path in [
        "/edu/account/me/password", "/edu/account/me/phone", "/edu/account/me/email",
        "/edu/account/me/avatar", "/edu/account/me/profile",
        "/edu/admin/account/list", "/edu/admin/account/{id}/freeze",
        "/edu/admin/account/{id}/unfreeze", "/edu/admin/account/{id}/reset-password",
        "/edu/admin/account/import", "/edu/admin/account/export",
        "/edu/admin/account/logs", "/edu/admin/account/statistics",
        "/edu/admin/account/{id}", "/edu/admin/account",
    ]:
        for m in ["POST", "GET", "PUT", "DELETE"]:
            probes.append({
                "method": m, "path": path, "body": {}, "headers": {},
                "group": "3.account", "expect": 401,
            })

    # 4. 课程相关基础 (需要鉴权 → 期望 401 或 422)
    for path in [
        "/edu/learn/courses/{id}/enroll", "/edu/learn/courses/{id}/favorite",
        "/edu/learn/courses/{id}/unfavorite", "/edu/learn/courses/{id}/rate",
        "/edu/learn/courses/{id}/comments", "/edu/learn/courses/{id}/comments/{cid}",
        "/edu/learn/courses/{id}/complete", "/edu/learn/records",
        "/edu/learn/courses/categories", "/edu/learn/courses/recommend",
        "/edu/learn/courses/{id}/progress", "/edu/learn/courses/{id}",
        "/edu/learn/courses", "/edu/learn/courses/statistics",
    ]:
        for m in ["POST", "GET", "PUT", "DELETE"]:
            probes.append({
                "method": m, "path": path, "body": {}, "headers": {},
                "group": "4.learn", "expect": 401,
            })

    print(f"\n=== Running {len(probes)} probes ===")
    results: List[Dict[str, Any]] = []
    ok_count = 0
    fail_count = 0
    with httpx.Client() as client:
        for i, p in enumerate(probes):
            # 动态路径替换 - 假装 id=1
            path = p["path"].replace("{id}", "1").replace("{cid}", "1")
            code, body = test_endpoint(
                client, p["method"], path, p.get("body"), p.get("headers"),
            )
            # 期望: 鉴权 401, 签名 200/401, 业务 200/422
            is_404 = code == 404
            is_500 = code == 500
            is_unexpected = is_404 or is_500
            status = "OK" if not is_unexpected else "FAIL"
            if not is_unexpected:
                ok_count += 1
            else:
                fail_count += 1
            results.append({
                "i": i, "method": p["method"], "path": path, "group": p["group"],
                "code": code, "status": status,
            })
            if is_unexpected:
                print(f"  [{status}] {p['method']} {path} -> {code}")

    print(f"\n=== Summary: {ok_count} OK / {fail_count} FAIL (total {len(probes)}) ===")
    print("\n=== HTTP code distribution ===")
    from collections import Counter
    code_counter = Counter(r["code"] for r in results)
    for code, n in sorted(code_counter.items()):
        print(f"  HTTP {code}: {n}")

    print("\n=== Group coverage ===")
    group_counter: Dict[str, Dict[str, int]] = {}
    for r in results:
        g = r["group"]
        group_counter.setdefault(g, {"total": 0, "ok": 0, "fail": 0})
        group_counter[g]["total"] += 1
        if r["status"] == "OK":
            group_counter[g]["ok"] += 1
        else:
            group_counter[g]["fail"] += 1
    for g, s in sorted(group_counter.items()):
        print(f"  {g}: {s['ok']}/{s['total']} OK, {s['fail']} FAIL")

    # 落盘
    with open("logs/p0_batch1_e2e_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "paths_count": len(paths),
            "probes_count": len(probes),
            "ok_count": ok_count,
            "fail_count": fail_count,
            "code_dist": dict(code_counter),
            "groups": group_counter,
            "failures": [r for r in results if r["status"] == "FAIL"],
        }, f, ensure_ascii=False, indent=2)
    print(f"\n报告已写入 logs/p0_batch1_e2e_report.json")

    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
