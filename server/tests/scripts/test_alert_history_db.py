#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""告警历史持久化测试 - alert_history_db.py

验证项:
1. 脚本存在
2. 5 个子命令: record / query / stats / cleanup / export
3. SQLite 表结构初始化
4. record 子命令 (写入)
5. query 子命令 (按级别过滤)
6. query 子命令 (按源过滤)
7. stats 子命令 (按级别/源/天统计)
8. cleanup 子命令 (按天数清理)
9. export 子命令 (JSON 导出)
10. 索引创建
11. 多条记录累积
"""
import os
import sys
import json
import subprocess
import sqlite3
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "alert_history_db.py"
LOG_DIR = SERVER_DIR / "logs"
DB_PATH = LOG_DIR / "alert_history.db"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} -- {detail}")


def run_script(*args: str) -> tuple[int, str, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SERVER_DIR),
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P1-6 告警历史持久化测试")
    print("=" * 60)

    # 清理旧数据库
    if DB_PATH.exists():
        DB_PATH.unlink()

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 5 子命令
    for cmd in ["record", "query", "stats", "cleanup", "export"]:
        test_case(f"子命令 {cmd}", f'"{cmd}"' in content or f"cmd_{cmd}" in content, f"缺少 {cmd}")

    # 关键函数
    funcs = ["get_connection", "_init_schema", "cmd_record", "cmd_query", "cmd_stats", "cmd_cleanup", "cmd_export"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # SQLite
    test_case("使用 sqlite3", "import sqlite3" in content, "")

    # 表结构
    test_case("alert_history 表", "CREATE TABLE IF NOT EXISTS alert_history" in content, "")
    test_case("含 id 字段", "id INTEGER PRIMARY KEY" in content, "")
    test_case("含 level 字段", "level TEXT" in content, "")
    test_case("含 title 字段", "title TEXT" in content, "")
    test_case("含 source 字段", "source TEXT" in content, "")

    # 索引
    for idx in ["idx_alert_history_ts", "idx_alert_history_level", "idx_alert_history_source"]:
        test_case(f"索引 {idx}", idx in content, f"缺少 {idx}")

    # record 子命令实际执行
    code, out, err = run_script(
        "record", "--level", "critical",
        "--title", "测试告警 1",
        "--content", "测试内容",
        "--source", "pg_backup",
        "--channels", "dingtalk,wechat",
    )
    test_case("record critical", code == 0, f"code={code}")
    test_case("record 输出", "已记录" in out, "")

    code, out, err = run_script(
        "record", "--level", "warning",
        "--title", "测试告警 2",
        "--source", "pg_slow_query",
        "--channels", "dingtalk",
    )
    test_case("record warning", code == 0, f"code={code}")

    code, out, err = run_script(
        "record", "--level", "info",
        "--title", "测试告警 3",
        "--source", "deploy",
        "--channels", "email",
    )
    test_case("record info", code == 0, f"code={code}")

    # 数据库文件
    test_case("SQLite 数据库创建", DB_PATH.exists(), str(DB_PATH))

    # 数据库直接校验
    if DB_PATH.exists():
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as c FROM alert_history")
        count = cur.fetchone()["c"]
        test_case("数据库含 3 条记录", count == 3, f"实际 {count} 条")

        cur.execute("SELECT level, COUNT(*) as c FROM alert_history GROUP BY level")
        levels = {row["level"]: row["c"] for row in cur.fetchall()}
        test_case("含 critical", "critical" in levels, "")
        test_case("含 warning", "warning" in levels, "")
        test_case("含 info", "info" in levels, "")

        conn.close()

    # query 子命令
    code, out, err = run_script("query", "--level", "critical", "--limit", "5")
    test_case("query critical", code == 0, f"code={code}")
    test_case("query 输出 JSON", "[" in out and "{" in out, "")

    # query by source
    code, out, err = run_script("query", "--source", "pg_backup", "--limit", "5")
    test_case("query by source", code == 0, f"code={code}")
    test_case("query pg_backup 命中", "pg_backup" in out, "")

    # stats 子命令
    code, out, err = run_script("stats", "--days", "7")
    test_case("stats 7 天", code == 0, f"code={code}")
    test_case("stats 含 by_level", "by_level" in out, "")
    test_case("stats 含 by_source", "by_source" in out, "")
    test_case("stats 含 total", "total" in out, "")

    # export 子命令
    export_file = LOG_DIR / "test_alert_export.json"
    if export_file.exists():
        export_file.unlink()
    code, out, err = run_script("export", "--limit", "100", "--output", str(export_file))
    test_case("export 执行", code == 0, f"code={code}")
    test_case("export 文件生成", export_file.exists(), "")

    if export_file.exists():
        try:
            data = json.loads(export_file.read_text(encoding="utf-8"))
            test_case("export 是 JSON 数组", isinstance(data, list), "")
            test_case("export 含 3 条", len(data) == 3, f"实际 {len(data)} 条")
        except json.JSONDecodeError as e:
            test_case("export JSON 可解析", False, str(e))

    # cleanup 子命令
    code, out, err = run_script("cleanup", "--days", "0")
    test_case("cleanup 0 天清理全部", code == 0, f"code={code}")
    test_case("cleanup 输出删除数", "删除" in out, "")

    # 清理后再查询
    if DB_PATH.exists():
        conn = sqlite3.connect(str(DB_PATH))
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM alert_history")
        remaining = cur.fetchone()[0]
        test_case("cleanup 后数据库为空", remaining == 0, f"剩余 {remaining} 条")
        conn.close()

    # 无效子命令
    code, out, err = run_script()
    test_case("无子命令被拒绝", code != 0, f"code={code}")

    # 无效 level
    code, out, err = run_script("record", "--level", "invalid", "--title", "t")
    test_case("无效级别被拒绝", code != 0, f"code={code}")

    # 清理测试数据库
    if DB_PATH.exists():
        DB_PATH.unlink()
    if export_file.exists():
        export_file.unlink()

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
