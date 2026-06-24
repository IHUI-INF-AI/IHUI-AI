#!/usr/bin/env python3
"""
智能测试平台
P1-36: LLM 用例生成, 智能回归, 性能测试编排, 覆盖率分析, 缺陷预测
"""
import hashlib
import json
import os
import random
import re
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "ai_testing.db")
HTTP_PORT = 10160

TEST_TYPES = ["unit", "integration", "e2e", "performance", "security", "smoke"]
TEST_STATUS = ["pending", "running", "passed", "failed", "skipped"]
PRIORITY_LEVELS = ["low", "medium", "high", "critical"]
DEFECT_SEVERITY = ["trivial", "minor", "major", "critical", "blocker"]
COVERAGE_TYPES = ["line", "branch", "function", "statement"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            case_id TEXT NOT NULL UNIQUE,
            name TEXT,
            test_type TEXT,
            priority TEXT,
            module TEXT,
            source TEXT,
            script TEXT,
            tags TEXT,
            expected_duration_ms INTEGER DEFAULT 100
        );
        CREATE TABLE IF NOT EXISTS test_runs (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            run_id TEXT NOT NULL UNIQUE,
            suite_name TEXT,
            total_cases INTEGER,
            passed INTEGER DEFAULT 0,
            failed INTEGER DEFAULT 0,
            skipped INTEGER DEFAULT 0,
            duration_ms REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            started_at TEXT,
            finished_at TEXT
        );
        CREATE TABLE IF NOT EXISTS test_results (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            run_id TEXT,
            case_id TEXT,
            status TEXT,
            duration_ms REAL,
            error_message TEXT,
            stack_trace TEXT
        );
        CREATE TABLE IF NOT EXISTS coverage_reports (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            report_id TEXT NOT NULL,
            module TEXT,
            coverage_type TEXT,
            covered INTEGER,
            total INTEGER,
            coverage_pct REAL
        );
        CREATE TABLE IF NOT EXISTS defect_predictions (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            prediction_id TEXT NOT NULL,
            module TEXT,
            risk_score REAL,
            predicted_defects INTEGER,
            confidence REAL,
            factors TEXT
        );
        CREATE TABLE IF NOT EXISTS test_suites (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            suite_id TEXT NOT NULL UNIQUE,
            suite_name TEXT,
            cases TEXT,
            schedule TEXT,
            enabled INTEGER DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_results_run ON test_results(run_id);
        CREATE INDEX IF NOT EXISTS idx_results_case ON test_results(case_id);
    """)
    conn.close()


_conn_lock = threading.Lock()
_db_ready = False


def _ensure_db() -> None:
    global _db_ready
    if not _db_ready:
        _init_db()
        _db_ready = True


@contextmanager
def _conn():
    _ensure_db()
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def generate_test_cases(requirement: str, test_type: str = "unit",
                         count: int = 5) -> List[Dict[str, Any]]:
    """LLM 用例生成 (基于规则的简化实现)"""
    if test_type not in TEST_TYPES:
        test_type = "unit"
    if count < 1:
        count = 1
    if count > 50:
        count = 50
    cases = []
    keywords = re.findall(r'[a-zA-Z\u4e00-\u9fff]{2,}', requirement)
    for i in range(count):
        kw = keywords[i % len(keywords)] if keywords else f"feature_{i}"
        case_id = f"TC-{int(time.time())}-{uuid.uuid4().hex[:6]}-{i}"
        cases.append({
            "case_id": case_id,
            "name": f"test_{kw}_scenario_{i+1}",
            "test_type": test_type,
            "priority": random.choice(PRIORITY_LEVELS),
            "module": kw.lower(),
            "script": f"def test_{kw}_{i}():\n    # auto-generated\n    assert True",
            "tags": ["auto-generated", test_type],
            "expected_duration_ms": random.randint(50, 500),
        })
    return cases


def save_test_case(case: Dict[str, Any]) -> str:
    """保存测试用例"""
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO test_cases
            (id,timestamp,case_id,name,test_type,priority,module,source,
             script,tags,expected_duration_ms)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (cid, _now(), case["case_id"], case["name"],
             case["test_type"], case["priority"], case["module"],
             case.get("source", "auto"),
             case.get("script", ""),
             json.dumps(case.get("tags", []), ensure_ascii=False),
             case.get("expected_duration_ms", 100)))
    return cid


def create_test_suite(suite_name: str, cases: List[str],
                       schedule: str = "") -> str:
    """创建测试套件"""
    sid = str(uuid.uuid4())
    suite_id = f"suite-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO test_suites
            (id,timestamp,suite_id,suite_name,cases,schedule,enabled)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), suite_id, suite_name,
             json.dumps(cases, ensure_ascii=False), schedule, 1))
    return suite_id


def start_test_run(suite_name: str, cases: List[str]) -> str:
    """启动测试运行"""
    rid = str(uuid.uuid4())
    run_id = f"run-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO test_runs
            (id,timestamp,run_id,suite_name,total_cases,status,started_at)
            VALUES (?,?,?,?,?,?,?)""",
            (rid, _now(), run_id, suite_name, len(cases), "running", _now()))
    return run_id


def record_test_result(run_id: str, case_id: str, status: str,
                        duration_ms: float = 0, error_message: str = "") -> str:
    """记录测试结果"""
    if status not in TEST_STATUS:
        status = "pending"
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO test_results
            (id,timestamp,run_id,case_id,status,duration_ms,error_message,stack_trace)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), run_id, case_id, status, duration_ms, error_message, ""))
    with _conn_lock, _conn() as c:
        if status == "passed":
            c.execute("""UPDATE test_runs SET passed = passed + 1 WHERE run_id = ?""",
                       (run_id,))
        elif status == "failed":
            c.execute("""UPDATE test_runs SET failed = failed + 1 WHERE run_id = ?""",
                       (run_id,))
        elif status == "skipped":
            c.execute("""UPDATE test_runs SET skipped = skipped + 1 WHERE run_id = ?""",
                       (run_id,))
    return rid


def finish_test_run(run_id: str, total_duration_ms: float = 0) -> bool:
    """完成测试运行"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM test_runs WHERE run_id = ?""",
                          (run_id,)).fetchone()
        if not row:
            return False
        passed = row["passed"]
        failed = row["failed"]
        if failed == 0 and passed > 0:
            status = "passed"
        elif failed > 0:
            status = "failed"
        else:
            status = "completed"
        c.execute("""UPDATE test_runs SET status = ?, finished_at = ?,
            duration_ms = ? WHERE run_id = ?""",
            (status, _now(), total_duration_ms, run_id))
    return True


def record_coverage(module: str, coverage_type: str, covered: int,
                     total: int) -> str:
    """记录覆盖率"""
    if coverage_type not in COVERAGE_TYPES:
        coverage_type = "line"
    pct = (covered / total * 100) if total > 0 else 0
    rid = str(uuid.uuid4())
    report_id = f"cov-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO coverage_reports
            (id,timestamp,report_id,module,coverage_type,covered,
             total,coverage_pct)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), report_id, module, coverage_type, covered,
             total, pct))
    return report_id


def predict_defects(module: str, recent_failures: int, complexity: float = 1.0,
                     code_churn: int = 0) -> Dict[str, Any]:
    """缺陷预测 (基于规则)"""
    base_score = 0.0
    base_score += min(recent_failures * 0.15, 0.5)
    base_score += min(complexity * 0.1, 0.3)
    base_score += min(code_churn * 0.01, 0.2)
    risk_score = min(base_score, 1.0)
    predicted = int(risk_score * 10)
    confidence = 0.5 + (recent_failures * 0.05) if recent_failures > 0 else 0.5
    confidence = min(confidence, 0.95)
    factors = {
        "recent_failures": recent_failures,
        "complexity": complexity,
        "code_churn": code_churn,
    }
    rid = str(uuid.uuid4())
    pid = f"pred-{int(time.time())}-{uuid.uuid4().hex[:6]}"
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO defect_predictions
            (id,timestamp,prediction_id,module,risk_score,predicted_defects,
             confidence,factors)
            VALUES (?,?,?,?,?,?,?,?)""",
            (rid, _now(), pid, module, risk_score, predicted, confidence,
             json.dumps(factors, ensure_ascii=False)))
    return {"module": module, "risk_score": round(risk_score, 3),
            "predicted_defects": predicted, "confidence": round(confidence, 3),
            "factors": factors}


def intelligent_regression_selection(cases: List[str],
                                       changed_files: List[str]) -> List[str]:
    """智能回归用例选择"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT case_id, module, priority FROM test_cases""").fetchall()
    all_cases = {r["case_id"]: dict(r) for r in rows}
    selected = []
    for case_id in cases:
        if case_id not in all_cases:
            continue
        c_data = all_cases[case_id]
        module = c_data["module"]
        priority = c_data["priority"]
        for f in changed_files:
            if module in f or f.endswith(module + ".py"):
                selected.append(case_id)
                break
        else:
            if priority in ["high", "critical"]:
                selected.append(case_id)
    return list(set(selected))


def get_test_run_summary(run_id: str) -> Dict[str, Any]:
    """获取测试运行摘要"""
    with _conn_lock, _conn() as c:
        row = c.execute("""SELECT * FROM test_runs WHERE run_id = ?""",
                          (run_id,)).fetchone()
    if not row:
        return {"error": "not_found"}
    return {"run_id": run_id, "suite": row["suite_name"],
            "total": row["total_cases"], "passed": row["passed"],
            "failed": row["failed"], "skipped": row["skipped"],
            "duration_ms": row["duration_ms"], "status": row["status"]}


def get_overview() -> Dict[str, Any]:
    """获取测试平台概览"""
    with _conn_lock, _conn() as c:
        total_cases = c.execute("SELECT COUNT(*) as c FROM test_cases").fetchone()["c"]
        runs = c.execute("SELECT COUNT(*) as c FROM test_runs").fetchone()["c"]
        predictions = c.execute("SELECT COUNT(*) as c FROM defect_predictions").fetchone()["c"]
        avg_risk = c.execute("SELECT AVG(risk_score) as r FROM defect_predictions").fetchone()["r"] or 0
    return {"total_cases": total_cases, "total_runs": runs,
            "total_predictions": predictions, "avg_risk": round(avg_risk, 3)}


def _send_dingtalk(title: str, content: str) -> None:
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({"timestamp": _now(), "title": title, "content": content,
                            "source": "ai_testing"}, ensure_ascii=False) + "\n")


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        path = u.path
        if path == "/health":
            self._json(200, {"status": "ok", "service": "ai_testing"})
        elif path == "/api/overview":
            self._json(200, get_overview())
        elif path.startswith("/api/run/"):
            run_id = path[10:]
            self._json(200, get_test_run_summary(run_id))
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        path = u.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        if path == "/api/cases/generate":
            cases = generate_test_cases(
                requirement=data.get("requirement", ""),
                test_type=data.get("test_type", "unit"),
                count=data.get("count", 5),
            )
            for c in cases:
                save_test_case(c)
            self._json(200, {"cases": cases, "count": len(cases)})
        elif path == "/api/suite/create":
            sid = create_test_suite(
                suite_name=data.get("suite_name", ""),
                cases=data.get("cases", []),
                schedule=data.get("schedule", ""),
            )
            self._json(201, {"suite_id": sid})
        elif path == "/api/run/start":
            rid = start_test_run(
                suite_name=data.get("suite_name", ""),
                cases=data.get("cases", []),
            )
            self._json(201, {"run_id": rid})
        elif path == "/api/result/record":
            rid = record_test_result(
                run_id=data.get("run_id", ""),
                case_id=data.get("case_id", ""),
                status=data.get("status", "pending"),
                duration_ms=data.get("duration_ms", 0.0),
                error_message=data.get("error_message", ""),
            )
            self._json(201, {"id": rid})
        elif path == "/api/run/finish":
            ok = finish_test_run(
                run_id=data.get("run_id", ""),
                total_duration_ms=data.get("duration_ms", 0.0),
            )
            self._json(200, {"finished": ok})
        elif path == "/api/coverage":
            rid = record_coverage(
                module=data.get("module", ""),
                coverage_type=data.get("coverage_type", "line"),
                covered=data.get("covered", 0),
                total=data.get("total", 0),
            )
            self._json(201, {"report_id": rid})
        elif path == "/api/predict":
            result = predict_defects(
                module=data.get("module", ""),
                recent_failures=data.get("recent_failures", 0),
                complexity=data.get("complexity", 1.0),
                code_churn=data.get("code_churn", 0),
            )
            self._json(200, result)
        elif path == "/api/regression/select":
            selected = intelligent_regression_selection(
                cases=data.get("cases", []),
                changed_files=data.get("changed_files", []),
            )
            self._json(200, {"selected": selected, "count": len(selected)})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("127.0.0.1", HTTP_PORT), _Handler)
    print(f"AI Testing service on 127.0.0.1:{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_generate(args: List[str]) -> None:
    if not args:
        print("usage: generate <requirement> [type] [count]")
        return
    req = args[0]
    ttype = args[1] if len(args) > 1 else "unit"
    count = int(args[2]) if len(args) > 2 else 5
    cases = generate_test_cases(req, ttype, count)
    for c in cases:
        save_test_case(c)
    print(json.dumps(cases, ensure_ascii=False, indent=2))


def cmd_suite(args: List[str]) -> None:
    if not args:
        print("usage: suite <name> [cases_json]")
        return
    cases = json.loads(args[1]) if len(args) > 1 else []
    sid = create_test_suite(args[0], cases)
    print(json.dumps({"suite_id": sid}, ensure_ascii=False))


def cmd_run(args: List[str]) -> None:
    if not args:
        print("usage: run <suite_name> [cases_json]")
        return
    cases = json.loads(args[1]) if len(args) > 1 else []
    rid = start_test_run(args[0], cases)
    print(json.dumps({"run_id": rid}, ensure_ascii=False))


def cmd_result(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: result <run_id> <case_id> <status> [duration_ms]")
        return
    duration = float(args[3]) if len(args) > 3 else 0
    rid = record_test_result(args[0], args[1], args[2], duration)
    print(json.dumps({"id": rid}, ensure_ascii=False))


def cmd_finish(args: List[str]) -> None:
    if not args:
        print("usage: finish <run_id> [duration_ms]")
        return
    duration = float(args[1]) if len(args) > 1 else 0
    ok = finish_test_run(args[0], duration)
    print(json.dumps({"finished": ok}, ensure_ascii=False))


def cmd_coverage(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: coverage <module> <covered> <total> [type]")
        return
    ctype = args[3] if len(args) > 3 else "line"
    rid = record_coverage(args[0], ctype, int(args[1]), int(args[2]))
    print(json.dumps({"report_id": rid}, ensure_ascii=False))


def cmd_predict(args: List[str]) -> None:
    if not args:
        print("usage: predict <module> [failures] [complexity] [churn]")
        return
    failures = int(args[1]) if len(args) > 1 else 0
    complexity = float(args[2]) if len(args) > 2 else 1.0
    churn = int(args[3]) if len(args) > 3 else 0
    print(json.dumps(predict_defects(args[0], failures, complexity, churn),
                       ensure_ascii=False, indent=2))


def cmd_regression(args: List[str]) -> None:
    if len(args) < 1:
        print("usage: regression <cases_json> <changed_files_json>")
        return
    cases = json.loads(args[0])
    files = json.loads(args[1]) if len(args) > 1 else []
    print(json.dumps(intelligent_regression_selection(cases, files),
                       ensure_ascii=False, indent=2))


def cmd_overview(_args: List[str]) -> None:
    print(json.dumps(get_overview(), ensure_ascii=False, indent=2))


def main() -> None:
    import sys
    cmds = {"serve": cmd_serve, "generate": cmd_generate, "suite": cmd_suite,
            "run": cmd_run, "result": cmd_result, "finish": cmd_finish,
            "coverage": cmd_coverage, "predict": cmd_predict,
            "regression": cmd_regression, "overview": cmd_overview}
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
