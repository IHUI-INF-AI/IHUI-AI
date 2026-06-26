"""P0 批次1 端点 E2E 验证脚本 (v2 - 基于真实端点路径).

按分组对 40 个端点做最小可行性测试:
  1. 支付回调 (2)
  2. 认证授权补全 (9-11)
  3. 会员账户体系 (15+)
  4. 课程相关基础 (14)
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

import httpx


BASE = "http://127.0.0.1:8000/api/v1"
TIMEOUT = 10.0


# P0 批次1 实际端点 (从 OpenAPI 提取, 4 大分组 40 端点)
P0_ENDPOINTS: List[Tuple[str, str, str, bool, Optional[Dict]]] = [
    # 1. 支付回调 (2)
    ("POST", "/edu/pay/callback/alipay", "1.pay_callback", False, {"out_trade_no": "TEST_001", "trade_status": "TRADE_SUCCESS"}),
    ("POST", "/edu/pay/callback/wechat", "1.pay_callback", False, {"out_trade_no": "TEST_001", "result_code": "SUCCESS"}),

    # 2. 认证授权补全 (9)
    ("POST", "/edu/auth/logout", "2.auth_supplement", True, None),
    ("POST", "/edu/auth/refresh", "2.auth_supplement", True, {"refresh_token": "invalid_token_xyz"}),
    ("POST", "/edu/auth/send-sms", "2.auth_supplement", False, {"phone": "13800000000", "purpose": "login"}),
    ("POST", "/edu/auth/verify-sms", "2.auth_supplement", False, {"phone": "13800000000", "code": "123456"}),
    ("GET",  "/edu/auth/permissions", "2.auth_supplement", True, None),
    ("GET",  "/edu/auth/roles", "2.auth_supplement", True, None),
    ("POST", "/edu/auth/roles", "2.auth_supplement", True, {"role_name": "test_role", "role_key": "test:role"}),
    ("PUT",  "/edu/auth/roles/1", "2.auth_supplement", True, {"role_name": "test_role_v2"}),
    ("DELETE", "/edu/auth/roles/1", "2.auth_supplement", True, None),

    # 3. 会员账户体系 (14)
    ("POST", "/edu/member/password/forgot", "3.account", False, {"phone": "13800000000"}),
    ("POST", "/edu/member/password/reset", "3.account", False, {"phone": "13800000000", "code": "123456", "new_password": "Test@1234"}),
    ("POST", "/edu/member/password/change", "3.account", True, {"old_password": "old123", "new_password": "new123"}),
    ("POST", "/edu/member/phone/bind", "3.account", True, {"phone": "13900000000", "code": "123456"}),
    ("POST", "/edu/member/phone/unbind", "3.account", True, {"code": "123456"}),
    ("POST", "/edu/member/email/bind", "3.account", True, {"email": "test@example.com", "code": "123456"}),
    ("POST", "/edu/member/email/verify", "3.account", True, {"code": "123456"}),
    ("GET",  "/edu/member/me", "3.account", True, None),
    ("PUT",  "/edu/member/me", "3.account", True, {"nick_name": "test"}),
    ("POST", "/edu/member", "3.account", True, {"user_name": "test", "password": "Test@1234"}),
    ("GET",  "/edu/member", "3.account", True, None),
    ("POST", "/edu/member/import", "3.account", True, None),
    ("GET",  "/edu/member/export", "3.account", True, None),
    ("GET",  "/edu/member/statistics", "3.account", True, None),

    # 4. 课程相关基础 (14)
    ("GET",  "/edu/learn/courses/enrolled", "4.learn", True, None),
    ("GET",  "/edu/learn/courses/favorites", "4.learn", True, None),
    ("GET",  "/edu/learn/courses/recommended", "4.learn", True, None),
    ("GET",  "/edu/learn/courses/categories", "4.learn", False, None),
    ("POST", "/edu/learn/courses/1/enroll", "4.learn", True, None),
    ("POST", "/edu/learn/courses/1/cancel-enroll", "4.learn", True, None),
    ("GET",  "/edu/learn/courses/1/progress", "4.learn", True, None),
    ("POST", "/edu/learn/courses/1/favorite", "4.learn", True, None),
    ("DELETE", "/edu/learn/courses/1/favorite", "4.learn", True, None),
    ("POST", "/edu/learn/courses/1/rate", "4.learn", True, {"rating": 5, "comment": "good"}),
    ("GET",  "/edu/learn/courses/1/comments", "4.learn", False, None),
    ("POST", "/edu/learn/courses/1/comments", "4.learn", True, {"content": "test comment"}),
    ("DELETE", "/edu/learn/courses/comments/1", "4.learn", True, None),
    ("POST", "/edu/learn/courses/1/complete", "4.learn", True, None),
]


def classify(code: int) -> str:
    """根据 HTTP code 分类结果."""
    if code in (200, 201, 202, 204):
        return "OK_2xx"
    if code in (400, 401, 403, 404, 405, 409, 415, 422):
        return "EXPECTED_4xx"
    if code in (429, 500, 502, 503):
        return "FAIL_5xx"
    return "OTHER"


def main() -> int:
    r = httpx.get(f"{BASE}/../openapi.json", timeout=TIMEOUT)
    r.raise_for_status()
    spec = r.json()
    spec_paths = spec.get("paths", {})

    p0_paths = [
        p for p in spec_paths.keys()
        if any(p.endswith(ep_path) for _, ep_path, *_ in P0_ENDPOINTS)
    ]
    print(f"=== OpenAPI P0 批次1 端点: {len(p0_paths)} ===")
    print(f"=== 测试端点: {len(P0_ENDPOINTS)} ===\n")

    results: List[Dict[str, Any]] = []
    with httpx.Client(base_url=BASE, timeout=TIMEOUT) as client:
        for m, path, group, need_auth, body in P0_ENDPOINTS:
            try:
                resp = client.request(
                    method=m,
                    url=path,
                    json=body,
                    headers={"X-Alipay-Signature": "sha256=test"} if "pay/callback" in path else {},
                )
                code = resp.status_code
                cat = classify(code)
            except Exception as e:
                code = 0
                cat = "ERROR"
            results.append({
                "method": m, "path": path, "group": group,
                "code": code, "category": cat,
            })

    code_counter = Counter(r["code"] for r in results)
    cat_counter = Counter(r["category"] for r in results)
    group_counter: Dict[str, Dict[str, int]] = {}
    for r in results:
        g = r["group"]
        group_counter.setdefault(g, {"total": 0, "ok_2xx": 0, "expected_4xx": 0, "fail_5xx": 0, "error": 0})
        group_counter[g]["total"] += 1
        if r["category"] == "OK_2xx":
            group_counter[g]["ok_2xx"] += 1
        elif r["category"] == "EXPECTED_4xx":
            group_counter[g]["expected_4xx"] += 1
        elif r["category"] == "FAIL_5xx":
            group_counter[g]["fail_5xx"] += 1
        else:
            group_counter[g]["error"] += 1

    print("=== HTTP code distribution ===")
    for code, n in sorted(code_counter.items(), key=lambda x: x[0]):
        print(f"  HTTP {code}: {n}")

    print("\n=== Category summary ===")
    for cat, n in sorted(cat_counter.items()):
        print(f"  {cat}: {n}")

    print("\n=== Group coverage ===")
    total_2xx = total_fail_5xx = total_error = 0
    for g, s in sorted(group_counter.items()):
        print(f"  {g}: 2xx={s['ok_2xx']} | 4xx={s['expected_4xx']} | 5xx={s['fail_5xx']} | err={s['error']} (total {s['total']})")
        total_2xx += s["ok_2xx"]
        total_fail_5xx += s["fail_5xx"]
        total_error += s["error"]

    print(f"\n=== TOTAL: 2xx={total_2xx} | 5xx={total_fail_5xx} | err={total_error} ===")

    failures = [r for r in results if r["category"] in ("FAIL_5xx", "ERROR")]
    if failures:
        print(f"\n=== {len(failures)} FAILURES ===")
        for r in failures:
            print(f"  {r['method']} {r['path']} -> {r['code']} ({r['category']})")

    report = {
        "openapi_p0_paths": len(p0_paths),
        "tested_p0_endpoints": len(P0_ENDPOINTS),
        "code_dist": dict(code_counter),
        "category_dist": dict(cat_counter),
        "groups": group_counter,
        "failures": failures,
    }
    with open("logs/p0_batch1_e2e_v2_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n报告已写入 logs/p0_batch1_e2e_v2_report.json")

    return 0 if total_fail_5xx == 0 and total_error == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
