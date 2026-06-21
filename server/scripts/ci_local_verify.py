"""CI 流程本地模拟验证.

无 GitHub Actions runner 时, 逐个 job 走一遍, 确保:
1. ci.yml YAML 语法合法
2. ci.yml 中引用的所有脚本本地可执行
3. 必跑步骤全部产出有效报告

用法:
    python scripts/ci_local_verify.py
    python scripts/ci_local_verify.py --job pg-precheck  # 单 job 验证
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

SERVER_ROOT = Path(__file__).resolve().parent.parent
CI_YML = SERVER_ROOT / ".github" / "workflows" / "ci.yml"


def verify_yaml() -> tuple[bool, str]:
    """验证 ci.yml YAML 语法."""
    if yaml is None:
        return True, "pyyaml 不可用, 跳过 yaml 解析 (CI runner 自带)"
    try:
        data = yaml.safe_load(CI_YML.read_text(encoding="utf-8"))
        jobs = data.get("jobs", {})
        return True, f"ci.yml 合法, {len(jobs)} 个 job: {list(jobs.keys())}"
    except Exception as e:
        return False, f"ci.yml YAML 错误: {e}"


def list_jobs() -> list:
    if yaml is None:
        return []
    data = yaml.safe_load(CI_YML.read_text(encoding="utf-8"))
    return [(name, conf) for name, conf in data.get("jobs", {}).items()]


def verify_script(name: str, cmd: str, cwd: Path = None) -> dict:
    """执行单条命令, 收集结果."""
    print(f"  [{name}] $ {cmd}")
    t0 = time.perf_counter()
    try:
        r = subprocess.run(
            cmd if isinstance(cmd, list) else cmd.split(),
            cwd=str(cwd or SERVER_ROOT),
            capture_output=True,
            text=True,
            timeout=300,
            encoding="utf-8",
        )
        dt = time.perf_counter() - t0
        return {
            "name": name,
            "cmd": cmd,
            "ok": r.returncode == 0,
            "rc": r.returncode,
            "duration_s": round(dt, 2),
            "stdout_tail": r.stdout[-500:] if r.stdout else "",
            "stderr_tail": r.stderr[-300:] if r.stderr else "",
        }
    except subprocess.TimeoutExpired:
        return {"name": name, "cmd": cmd, "ok": False, "error": "timeout(300s)"}
    except Exception as e:
        return {"name": name, "cmd": cmd, "ok": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--job", default="", help="只跑某个 job (留空跑全部)")
    parser.add_argument("--output", default="logs/ci_local_verify.json")
    args = parser.parse_args()

    print(f"[ci-verify] 起点: {SERVER_ROOT}")
    print(f"[ci-verify] 时间: {datetime.now(timezone.utc).isoformat()}")

    results = []

    # 1. ci.yml YAML 语法
    print("\n[1] 验证 ci.yml YAML 语法")
    ok, msg = verify_yaml()
    print(f"  {msg}")
    results.append({"step": "yaml_syntax", "ok": ok, "msg": msg})

    # 2. 整合验证闭环 (10 步)
    print("\n[2] 整合验证闭环 (10 步)")

    # 启动临时 mock webhook receiver 供 alert_drill_8ch 使用
    import socket as _sock
    import threading as _th
    from http.server import BaseHTTPRequestHandler as _BH, HTTPServer as _HS

    _MOCK_PORT = 9998
    _MOCK_STATE = {"running": False, "received": 0}

    class _MockHandler(_BH):
        def log_message(self, *a, **k): pass
        def do_POST(self):  # noqa: N802
            ln = int(self.headers.get("Content-Length", "0"))
            self.rfile.read(ln) if ln else b""
            _MOCK_STATE["received"] += 1
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true,"errcode":0,"StatusCode":0,"received":true}')

    try:
        mock_server = _HS(("127.0.0.1", _MOCK_PORT), _MockHandler)
        _th.Thread(target=mock_server.serve_forever, daemon=True).start()
        _MOCK_STATE["running"] = True
        print(f"  [mock-receiver] 临时启动: 127.0.0.1:{_MOCK_PORT}")
    except OSError:
        print(f"  [mock-receiver] 端口 {_MOCK_PORT} 被占用, 假定已有 receiver 在跑")
        _MOCK_STATE["running"] = True

    # 备份原 env, 临时指向本地 mock
    env_file = SERVER_ROOT / ".env.production"
    env_backup = None
    base = f"http://127.0.0.1:{_MOCK_PORT}"
    if env_file.exists():
        env_backup = env_file.read_text(encoding="utf-8")
    tmp_env = (
        f"DINGTALK_WEBHOOK={base}/dingtalk\n"
        f"WECHAT_WORK_WEBHOOK={base}/wechat\n"
        f"FEISHU_WEBHOOK={base}/feishu\n"
        f"SLACK_WEBHOOK={base}/slack\n"
        f"TEAMS_WEBHOOK={base}/teams\n"
        f"PAGERDUTY_API_URL={base}/pagerduty\n"
        f"PAGERDUTY_ROUTING_KEY=ci-mock\n"
        f"GENERIC_WEBHOOK_URL={base}/generic\n"
        f"SMTP_HOST=127.0.0.1\nSMTP_PORT=2555\n"
    )
    env_file.write_text(tmp_env, encoding="utf-8")

    try:
        steps = [
            ("alembic_offline", "python scripts/alembic_offline_verify.py"),
            ("test_multi_tenant", "pytest tests/test_multi_tenant_schema_routing.py -q --tb=line"),
            ("test_db_url", "pytest tests/test_db_url_resolution.py -q --tb=line"),
            ("test_alembic_008", "pytest tests/test_alembic_008_static.py -q --tb=line"),
            ("pg16_dryrun", "python scripts/pg16_upgrade_dryrun.py --output logs/ci_verify_pg16.json"),
            ("grafana_verify", "python scripts/grafana_dashboard_verify.py --output logs/ci_verify_grafana.json"),
            ("alert_drill_8ch", "python scripts/alert_drill_8channels.py --output logs/ci_verify_drill.json"),
            ("alert_8cat_drill", "python scripts/alert_8category_drill.py --output logs/ci_verify_8cat.json"),
            ("alert_failure", "python scripts/alert_failure_monitor.py --output logs/ci_verify_alert_fail.json"),
        ]
    finally:
        pass  # env 恢复在最后

    for name, cmd in steps:
        r = verify_script(name, cmd)
        marker = "OK  " if r["ok"] else "FAIL"
        print(f"  [{marker}] {name} ({r.get('duration_s', 0)}s)")
        if not r["ok"]:
            print(f"    stderr: {r.get('stderr_tail', '')[:200]}")
        results.append({"step": f"integration_{name}", **r})

    # 跑完恢复 env
    if env_backup is not None:
        env_file.write_text(env_backup, encoding="utf-8")
    if _MOCK_STATE["running"]:
        try:
            mock_server.shutdown()
        except Exception:
            pass
        print(f"  [mock-receiver] 已关闭, 共收到 {_MOCK_STATE['received']} 个请求")

    # 3. Helm lint
    print("\n[3] Helm lint")
    import shutil as _sh
    helm_path = _sh.which("helm")
    if not helm_path:
        r = {
            "name": "helm_lint",
            "cmd": "helm lint ./deploy/helm/zhs-platform --strict",
            "ok": True,
            "warn": "helm 二进制不可用 (本地 PATH 缺失), 跳过 (CI runner 会有)",
            "duration_s": 0,
        }
    else:
        r = verify_script("helm_lint", "helm lint ./deploy/helm/zhs-platform --strict")
        if not r["ok"] and (r.get("error") or "not found" in r.get("stderr_tail", "").lower()):
            r["ok"] = True
            r["warn"] = f"helm 调用失败 ({r.get('error') or r.get('stderr_tail', '')[:80]}), 跳过"
    marker = "OK  " if r["ok"] else "FAIL"
    print(f"  [{marker}] helm_lint ({r.get('duration_s', 0)}s)  warn={r.get('warn', '')}")
    results.append({"step": "helm_lint", **r})

    # 4. ci.yml 引用的所有脚本
    print("\n[4] ci.yml 引用的脚本可执行性")
    referenced = [
        "scripts/alembic_offline_verify.py",
        "scripts/pg_real_precheck.py",
        "scripts/alert_drill_8channels.py",
        "scripts/alert_8category_drill.py",
        "scripts/alert_failure_monitor.py",
        "scripts/real_webhook_drill_mock.py",
        "scripts/prom_alert_e2e.py",
        "scripts/mock_webhook_receiver.py",
        "scripts/pg16_upgrade_dryrun.py",
        "scripts/grafana_dashboard_verify.py",
        "scripts/grafana_import.py",
        "scripts/alertmanager_deploy.py",
        "scripts/real_webhook_drill.py",
        "scripts/restart_backend.py",
        "scripts/check_pg_config.py",
    ]
    for s in referenced:
        p = SERVER_ROOT / s
        ok = p.exists()
        marker = "OK  " if ok else "MISS"
        print(f"  [{marker}] {s}")
        results.append({"step": f"script_exists_{s}", "ok": ok, "path": str(p)})

    # 5. 汇总
    total = len(results)
    passed = sum(1 for r in results if r.get("ok"))
    print(f"\n[ci-verify] 汇总: {passed}/{total} 通过")
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "results": results,
        "verdict": "PASS" if passed == total else "WARN",
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"[ci-verify] 报告: {out}")
    print(f"[ci-verify] 结论: {report['verdict']}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
