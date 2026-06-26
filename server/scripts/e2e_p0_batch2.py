"""P0 批次2 端点 E2E 验证脚本.

对 82 个桩端点做最小可达性测试:
  - 期望 200 (桩响应)
  - 不期望 404/500
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from typing import Any, Dict, List, Tuple

import httpx

BASE = "http://127.0.0.1:8000/api/v1"
TIMEOUT = 10.0


def main() -> int:
    with open(r"g:/IHUI-AI/server/logs/edu_p0_to_migrate.json", "r", encoding="utf-8") as f:
        data = json.load(f)
    endpoints = data["to_migrate"]
    print(f"=== 测试 P0 批次2 端点: {len(endpoints)} ===")

    results: List[Dict[str, Any]] = []
    with httpx.Client(base_url=BASE, timeout=TIMEOUT) as client:
        for ep in endpoints:
            m = ep["method"]
            path = ep["new_path"].replace("/api/v1", "")
            # 路径参数替换为 1
            import re
            path = re.sub(r"\{[^}]+\}", "1", path)
            try:
                resp = client.request(
                    method=m,
                    url=path,
                    json={"test": "data"} if m in ("post", "put") else None,
                )
                code = resp.status_code
            except Exception as e:
                code = 0
            ok = code in (200, 201, 202, 204)
            results.append({
                "method": m,
                "path": ep["new_path"],
                "code": code,
                "ok": ok,
            })

    total = len(results)
    ok_count = sum(1 for r in results if r["ok"])
    fail_count = total - ok_count
    code_counter = Counter(r["code"] for r in results)

    print(f"\n=== Summary: {ok_count}/{total} OK, {fail_count} FAIL ===")
    print("\n=== HTTP code distribution ===")
    for code, n in sorted(code_counter.items(), key=lambda x: x[0]):
        print(f"  HTTP {code}: {n}")

    failures = [r for r in results if not r["ok"]]
    if failures:
        print(f"\n=== {len(failures)} FAILURES ===")
        for r in failures:
            print(f"  {r['method'].upper()} {r['path']} -> {r['code']}")

    # 报告
    with open(r"g:/IHUI-AI/server/logs/edu_p0_batch2_e2e_report.json", "w", encoding="utf-8") as f:
        json.dump({
            "total": total,
            "ok_count": ok_count,
            "fail_count": fail_count,
            "code_dist": dict(code_counter),
            "failures": failures,
        }, f, ensure_ascii=False, indent=2)
    print(f"\n报告已写入 logs/edu_p0_batch2_e2e_report.json")

    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
