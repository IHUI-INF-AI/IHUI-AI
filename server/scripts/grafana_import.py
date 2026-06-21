"""Grafana 大盘导入脚本 (dry-run + 真连模式).

功能:
1. dry-run 模式: 验证 dashboard JSON + 列出导入清单 (不下发)
2. 真连模式: 调 Grafana HTTP API 把 8 个 dashboard 导入指定 Grafana 实例

Grafana API 文档: https://grafana.com/docs/grafana/latest/developers/http_api/

用法:
    python scripts/grafana_import.py --dry-run  # 默认
    python scripts/grafana_import.py --import  # 真连
    python scripts/grafana_import.py --import --grafana-url http://staging-grafana:3000
    python scripts/grafana_import.py --import --folder "ZHS Platform"  # 导入到指定文件夹
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

SERVER_ROOT = Path(__file__).resolve().parent.parent
DASHBOARD_DIR = SERVER_ROOT / "deploy" / "grafana" / "dashboards"
GRAFANA_URL = os.environ.get("GRAFANA_URL", "http://127.0.0.1:3000")
GRAFANA_API_KEY = os.environ.get("GRAFANA_API_KEY", "")


def load_dashboards() -> list:
    """加载所有 dashboard JSON."""
    if not DASHBOARD_DIR.exists():
        return []
    result = []
    for f in sorted(DASHBOARD_DIR.glob("*.json")):
        try:
            text = f.read_text(encoding="utf-8")
            data = json.loads(text)
            result.append({
                "file": f.name,
                "uid": data.get("uid", ""),
                "title": data.get("title", ""),
                "schemaVersion": data.get("schemaVersion", 0),
                "panels": len(data.get("panels", [])),
                "tags": data.get("tags", []),
                "data": data,
            })
        except Exception as e:
            result.append({"file": f.name, "error": str(e)})
    return result


def build_import_payload(d: dict, folder: str = "") -> dict:
    """构造 Grafana /api/dashboards/import payload.

    Grafana 期望格式: { dashboard: {...}, folderId: int, folderUid: str, message: str, overwrite: bool }
    """
    return {
        "dashboard": d["data"],
        "folderUid": folder.lower().replace(" ", "-") if folder else "",
        "message": f"ZHS 平台大盘 {d['title']} - 自动导入 {datetime.now(timezone.utc).isoformat()}",
        "overwrite": True,
    }


def import_one(client: httpx.Client, d: dict, folder: str) -> dict:
    """导入单个 dashboard."""
    payload = build_import_payload(d, folder)
    try:
        resp = client.post(
            f"{GRAFANA_URL}/api/dashboards/import",
            json=payload,
            timeout=30.0,
        )
        return {
            "file": d["file"],
            "title": d.get("title", ""),
            "status": resp.status_code,
            "ok": resp.status_code == 200,
            "response": resp.text[:500],
        }
    except Exception as e:
        return {"file": d["file"], "ok": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", default=True, help="仅验证 dashboard JSON, 不下发")
    parser.add_argument("--import", dest="do_import", action="store_true", help="真连 Grafana 导入")
    parser.add_argument("--grafana-url", default=GRAFANA_URL, help="Grafana URL")
    parser.add_argument("--api-key", default=GRAFANA_API_KEY, help="Grafana API Key (Basic Auth 也可)")
    parser.add_argument("--folder", default="ZHS Platform", help="目标文件夹")
    parser.add_argument("--output", default="logs/grafana_import.json")
    args = parser.parse_args()

    dashboards = load_dashboards()
    print(f"[import] 加载 {len(dashboards)} 个 dashboard:")
    for d in dashboards:
        if "error" in d:
            print(f"  [ERROR] {d['file']}: {d['error']}")
            continue
        print(f"  {d['file']:35s}  uid={d['uid']:30s}  panels={d['panels']:2d}  title={d['title']}")

    if not args.do_import:
        # dry-run: 验证 JSON 完整, 不调 Grafana
        errors = [d for d in dashboards if "error" in d]
        if errors:
            print(f"\n[FAIL] {len(errors)} 个 JSON 解析失败")
            return 1
        print(f"\n[OK] dry-run 通过 ({len(dashboards)} 个 dashboard 已就绪, 未下发)")
        report = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "mode": "dry-run",
            "dashboards": [{"file": d["file"], "uid": d.get("uid", ""), "title": d.get("title", ""), "panels": d.get("panels", 0)} for d in dashboards],
            "result": "PASS",
        }
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[import] 报告: {out_path}")
        return 0

    # 真连: 调 Grafana API
    print(f"\n[import] 真连 Grafana: {args.grafana_url}, folder={args.folder}")
    headers = {"Content-Type": "application/json"}
    if args.api_key:
        headers["Authorization"] = f"Bearer {args.api_key}"

    # 1. 检查 Grafana 健康
    try:
        with httpx.Client(timeout=10.0, headers=headers) as client:
            r = client.get(f"{args.grafana_url}/api/health")
            if r.status_code != 200:
                print(f"[FAIL] Grafana health 失败: HTTP {r.status_code} {r.text[:200]}")
                return 1
            print(f"  [OK] Grafana health: {r.json()}")
    except Exception as e:
        print(f"[FAIL] Grafana 连接失败: {e}")
        return 1

    # 2. 创建文件夹 (不存在)
    folder_uid = args.folder.lower().replace(" ", "-")
    try:
        with httpx.Client(timeout=10.0, headers=headers) as client:
            r = client.post(
                f"{args.grafana_url}/api/folders",
                json={"uid": folder_uid, "title": args.folder},
            )
            if r.status_code in (200, 409):  # 409 = already exists
                print(f"  [OK] 文件夹 {args.folder} 就绪 (HTTP {r.status_code})")
            else:
                print(f"  [WARN] 文件夹创建: HTTP {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"  [WARN] 文件夹创建失败: {e}")

    # 3. 逐个导入
    results = []
    with httpx.Client(timeout=30.0, headers=headers) as client:
        for d in dashboards:
            if "error" in d:
                results.append({"file": d["file"], "ok": False, "error": d["error"]})
                continue
            r = import_one(client, d, folder_uid)
            results.append(r)
            marker = "OK  " if r.get("ok") else "FAIL"
            print(f"  [{marker}] {d['file']:35s}  HTTP {r.get('status', '?')}  {r.get('title', '')}")

    # 4. 汇总
    ok_count = sum(1 for r in results if r.get("ok"))
    fail_count = len(results) - ok_count
    print(f"\n[import] 汇总: {ok_count} 成功, {fail_count} 失败")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "import",
        "grafana_url": args.grafana_url,
        "folder": args.folder,
        "dashboards": dashboards[:1] if dashboards else [],  # 仅记录第一个避免报告过大
        "results": results,
        "ok_count": ok_count,
        "fail_count": fail_count,
        "result": "PASS" if fail_count == 0 else "PARTIAL",
    }
    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"[import] 报告: {out_path}")
    print(f"[import] 结论: {report['result']}")
    return 0 if fail_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
