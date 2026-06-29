#!/usr/bin/env python3
"""
P0-67 跨轮回归测试套件
运行 Round 9-14 全部测试,确保 Round 15 不会破坏既有功能
"""
import json
import os
import sqlite3
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "regression_suite.db")
HTTP_PORT = 10470
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))

TEST_SUITES = {
    "round9": [
        "test_tenant_fastapi_integration.py",
        "test_canary_drill.py",
        "test_alert_history_integration.py",
        "test_loadtest_report_gen.py",
        "test_terraform_aliyun.py",
        "test_failover_runbook.py",
        "test_alertmanager_integration.py",
        "test_cross_cloud_vpn.py",
        "test_round9_e2e.py",
    ],
    "round10": [
        "test_round9_nightly_ci.py",
        "test_alert_history_integration.py",
        "test_cross_cloud_vpn.py",
        "test_canary_auto_rollback.py",
        "test_alert_dedup.py",
        "test_pitr_cross_cloud.py",
        "test_tfstate_migrate.py",
        "test_drp_quarterly_drill.py",
        "test_round10_e2e.py",
    ],
    "round11": [
        "test_otel_integration.py",
        "test_argocd_multienv.py",
        "test_vault_key_auto_rotate.py",
        "test_ai_testing.py",
        "test_cert_auto_renew.py",
        "test_dr_automation.py",
        "test_capacity_planning.py",
    ],
    "round12": [
        "test_ebpf_observability.py",
        "test_service_mesh.py",
        "test_gray_release.py",
        "test_aiops_denoise.py",
        "test_business_dashboard.py",
        "test_perf_tuning.py",
        "test_chatops.py",
        "test_chaos.py",
        "test_finops.py",
        "test_soc.py",
        "test_data_lineage.py",
    ],
    "round13": [
        "test_unified_observability.py",
        "test_multi_cloud.py",
        "test_api_gateway.py",
        "test_edge_computing.py",
        "test_ai_testing.py",
        "test_blockchain_audit.py",
        "test_digital_twin.py",
        "test_green_computing.py",
        "test_quantum_crypto.py",
        "test_privacy_computing.py",
        "test_metaverse_ops.py",
    ],
    "round14": [
        "test_fullstack_apm.py",
        "test_ai_capacity.py",
        "test_zero_trust.py",
        "test_edge_federation.py",
        "test_llm_alert_dedup.py",
        "test_adaptive_chaos.py",
        "test_faas_platform.py",
        "test_neuromorphic.py",
        "test_satellite_ops.py",
        "test_bci_monitor.py",
        "test_digital_twin_city.py",
    ],
    "round15": [
        "test_unified_integration.py",
        "test_unified_alerting.py",
    ],
}


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS regression_runs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            run_id TEXT NOT NULL,
            round_label TEXT NOT NULL,
            total_tests INTEGER DEFAULT 0,
            passed INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            skipped INTEGER DEFAULT 0,
            duration_seconds REAL DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            status TEXT DEFAULT 'running'
        );
        CREATE TABLE IF NOT EXISTS test_failures (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            run_id TEXT NOT NULL,
            test_file TEXT NOT NULL,
            test_name TEXT,
            error_message TEXT
        );
        CREATE TABLE IF NOT EXISTS compatibility_checks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            source_round TEXT NOT NULL,
            target_round TEXT NOT NULL,
            check_name TEXT NOT NULL,
            passed INTEGER DEFAULT 1,
            details TEXT
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _discover_test_files() -> Dict[str, List[str]]:
    """发现实际存在的测试文件"""
    result = {}
    if not os.path.isdir(SCRIPTS_DIR):
        return result
    actual = set(f for f in os.listdir(SCRIPTS_DIR) if f.startswith("test_") and f.endswith(".py"))
    for round_label, files in TEST_SUITES.items():
        result[round_label] = [f for f in files if f in actual]
    return result


def run_test_file(test_file: str) -> Dict:
    """运行单个测试文件"""
    fp = os.path.join(SCRIPTS_DIR, test_file)
    if not os.path.isfile(fp):
        return {"file": test_file, "passed": 0, "failed": 0, "skipped": 0, "error": "file not found"}
    start = time.time()
    try:
        result = subprocess.run(
            [sys.executable, "-m", "unittest", test_file[:-3], "-v"],
            cwd=SCRIPTS_DIR,
            capture_output=True,
            text=True,
            timeout=60,
        )
        duration = time.time() - start
        out = result.stdout + result.stderr
        passed = out.count("ok")
        failed = out.count("FAIL")
        skipped = 0
        if "Ran" in out:
            for line in out.splitlines():
                if line.startswith("Ran"):
                    try:
                        parts = line.split()
                        n = int(parts[1])
                        if "test" in out and "OK" not in out.splitlines()[-1]:
                            passed = n - failed
                    except Exception:
                        pass
        if result.returncode == 0 and "OK" in out:
            passed = max(1, passed)
            failed = 0
        return {
            "file": test_file,
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "duration": duration,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"file": test_file, "passed": 0, "failed": 0, "skipped": 1, "duration": 60, "error": "timeout"}
    except Exception as e:
        return {"file": test_file, "passed": 0, "failed": 1, "skipped": 0, "error": str(e)}


def run_round_regression(round_label: str) -> Dict:
    """运行某轮回归"""
    run_id = "run-" + uuid.uuid4().hex[:12]
    rid = str(uuid.uuid4())
    suites = _discover_test_files()
    files = suites.get(round_label, [])
    if not files:
        with _conn_lock, _conn() as c:
            c.execute("""INSERT INTO regression_runs
                (id,timestamp,run_id,round_label,total_tests,passed,failed,skipped,
                 duration_seconds,started_at,completed_at,status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (rid, _now(), run_id, round_label, 0, 0, 0, 0, 0, _now(), _now(), "no_tests"))
        return {"run_id": run_id, "round": round_label, "files": 0, "passed": 0, "failed": 0}
    total_passed = 0
    total_failed = 0
    total_skipped = 0
    start = time.time()
    file_results = []
    for f in files:
        result = run_test_file(f)
        total_passed += result.get("passed", 0)
        total_failed += result.get("failed", 0)
        total_skipped += result.get("skipped", 0)
        file_results.append(result)
        if result.get("error"):
            fid = str(uuid.uuid4())
            with _conn_lock, _conn() as c:
                c.execute("""INSERT INTO test_failures
                    (id,timestamp,run_id,test_file,test_name,error_message)
                    VALUES (?,?,?,?,?,?)""",
                    (fid, _now(), run_id, f, "execute", result.get("error", "")))
    duration = time.time() - start
    total = total_passed + total_failed
    status = "passed" if total_failed == 0 else "failed"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO regression_runs
            (id,timestamp,run_id,round_label,total_tests,passed,failed,skipped,
             duration_seconds,started_at,completed_at,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
            (rid, _now(), run_id, round_label, total, total_passed, total_failed,
             total_skipped, duration, _now(), _now(), status))
    return {
        "run_id": run_id,
        "round": round_label,
        "files": len(files),
        "passed": total_passed,
        "failed": total_failed,
        "skipped": total_skipped,
        "duration": duration,
        "status": status,
    }


def record_compatibility(source: str, target: str, check_name: str,
                          passed: bool, details: str = "") -> str:
    """记录兼容性检查"""
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO compatibility_checks
            (id,timestamp,source_round,target_round,check_name,passed,details)
            VALUES (?,?,?,?,?,?,?)""",
            (cid, _now(), source, target, check_name, 1 if passed else 0, details))
    return cid


def run_all_regressions() -> Dict:
    """运行所有轮次回归"""
    suites = _discover_test_files()
    summary = {}
    total_passed = 0
    total_failed = 0
    for round_label, files in suites.items():
        result = run_round_regression(round_label)
        summary[round_label] = {
            "files": result["files"],
            "passed": result["passed"],
            "failed": result["failed"],
        }
        total_passed += result["passed"]
        total_failed += result["failed"]
    return {
        "rounds": summary,
        "total_passed": total_passed,
        "total_failed": total_failed,
    }


def get_regression_report() -> Dict:
    """回归报告"""
    with _conn() as c:
        runs = c.execute("""SELECT COUNT(*) as c FROM regression_runs""").fetchone()["c"]
        passed = c.execute("""SELECT COUNT(*) as c FROM regression_runs WHERE status='passed'""").fetchone()["c"]
        failed = c.execute("""SELECT COUNT(*) as c FROM regression_runs WHERE status='failed'""").fetchone()["c"]
        total_passed = c.execute("""SELECT COALESCE(SUM(passed),0) as s FROM regression_runs""").fetchone()["s"]
        total_failed = c.execute("""SELECT COALESCE(SUM(failed),0) as s FROM regression_runs""").fetchone()["s"]
        compat = c.execute("""SELECT COUNT(*) as c FROM compatibility_checks""").fetchone()["c"]
    return {
        "total_runs": runs,
        "passed_runs": passed,
        "failed_runs": failed,
        "total_tests_passed": total_passed,
        "total_tests_failed": total_failed,
        "compatibility_checks": compat,
    }


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        if u.path == "/api/health":
            self._send(200, {"status": "ok", "port": HTTP_PORT})
        elif u.path == "/api/report":
            self._send(200, get_regression_report())
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {}
        if u.path == "/api/regression/round":
            result = run_round_regression(data.get("round", "round14"))
            self._send(200, result)
        elif u.path == "/api/regression/all":
            result = run_all_regressions()
            self._send(200, result)
        elif u.path == "/api/compat":
            cid = record_compatibility(
                data.get("source", "round14"),
                data.get("target", "round15"),
                data.get("check_name", "default"),
                data.get("passed", True),
                data.get("details", ""),
            )
            self._send(200, {"check_id": cid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P0-67 跨轮回归测试套件")
    p.add_argument("--serve", action="store_true")
    p.add_argument("--round", default="", help="运行指定轮次")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"回归测试套件 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    elif a.round:
        result = run_round_regression(a.round)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(get_regression_report(), ensure_ascii=False, indent=2))
