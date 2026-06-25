"""PostgreSQL 慢查询治理验证脚本.

验证内容 (10 项):
1. pg_slow_query_governance.sh 存在且语法正确
2. 治理脚本支持 3 个库
3. 治理脚本使用 pg_stat_statements
4. 治理脚本输出 JSON 报告
5. 治理脚本包含 Top N 参数
6. pg_index_optimization.sh 存在且语法正确
7. 索引脚本检测缺失索引 (seq_scan)
8. 索引脚本检测未使用索引 (idx_scan=0)
9. 索引脚本检测表膨胀 (n_dead_tup)
10. postgresql.conf 启用 pg_stat_statements

用法:
  python scripts/test_pg_slow_query.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GOVERNANCE_SCRIPT = ROOT / "scripts" / "pg_slow_query_governance.sh"
INDEX_SCRIPT = ROOT / "scripts" / "pg_index_optimization.sh"
PG_CONF = ROOT / "docker" / "postgresql" / "postgresql.conf"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def test_governance_script_exists() -> bool:
    """测试 pg_slow_query_governance.sh 存在且语法正确."""
    try:
        assert GOVERNANCE_SCRIPT.exists(), f"脚本不存在: {GOVERNANCE_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(GOVERNANCE_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ pg_slow_query_governance.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_governance_databases() -> bool:
    """测试治理脚本支持 3 个库."""
    try:
        content = GOVERNANCE_SCRIPT.read_text(encoding="utf-8")
        assert "zhs_ai_project" in content, "缺少 zhs_ai_project"
        assert "zhs_center_project" in content, "缺少 zhs_center_project"
        assert "zhs_educational_training" in content, "缺少 zhs_educational_training"
        assert 'DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")' in content

        print(f"  ✅ 治理脚本支持 3 个库")
        return True
    except Exception as e:
        print(f"  ❌ 3 库支持验证失败: {e}")
        return False


def test_pg_stat_statements() -> bool:
    """测试治理脚本使用 pg_stat_statements."""
    try:
        content = GOVERNANCE_SCRIPT.read_text(encoding="utf-8")
        assert "pg_stat_statements" in content, "缺少 pg_stat_statements"
        assert "pg_stat_statements" in content, "缺少扩展检查"
        assert "total_exec_time" in content, "缺少 total_exec_time 字段"
        assert "mean_exec_time" in content, "缺少 mean_exec_time 字段"
        assert "queryid" in content, "缺少 queryid 字段"

        print(f"  ✅ 使用 pg_stat_statements (total/mean_exec_time + queryid)")
        return True
    except Exception as e:
        print(f"  ❌ pg_stat_statements 验证失败: {e}")
        return False


def test_json_output() -> bool:
    """测试治理脚本输出 JSON 报告."""
    try:
        content = GOVERNANCE_SCRIPT.read_text(encoding="utf-8")
        assert "slow_query_${TS}.json" in content, "缺少 JSON 输出文件"
        assert '"timestamp":' in content, "缺少 timestamp 字段"
        assert '"databases":' in content, "缺少 databases 字段"
        assert '"slow_queries":' in content, "缺少 slow_queries 字段"
        assert '"queryid":' in content, "缺少 queryid JSON 字段"
        assert '"total_time_ms":' in content, "缺少 total_time_ms JSON 字段"

        print(f"  ✅ 输出 JSON 报告 (timestamp + databases + slow_queries)")
        return True
    except Exception as e:
        print(f"  ❌ JSON 输出验证失败: {e}")
        return False


def test_top_n_param() -> bool:
    """测试治理脚本包含 Top N 参数."""
    try:
        content = GOVERNANCE_SCRIPT.read_text(encoding="utf-8")
        assert 'TOP_N="${1:-10}"' in content, "缺少 TOP_N 参数"
        assert "LIMIT ${TOP_N}" in content, "缺少 LIMIT TOP_N"
        assert "ORDER BY total_exec_time DESC" in content, "缺少排序"

        print(f"  ✅ Top N 参数 (默认 10, 按总执行时间排序)")
        return True
    except Exception as e:
        print(f"  ❌ Top N 参数验证失败: {e}")
        return False


def test_index_script_exists() -> bool:
    """测试 pg_index_optimization.sh 存在且语法正确."""
    try:
        assert INDEX_SCRIPT.exists(), f"脚本不存在: {INDEX_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(INDEX_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ pg_index_optimization.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_missing_index_detection() -> bool:
    """测试索引脚本检测缺失索引 (seq_scan)."""
    try:
        content = INDEX_SCRIPT.read_text(encoding="utf-8")
        assert "缺失索引检测" in content, "缺少缺失索引检测"
        assert "seq_scan" in content, "缺少 seq_scan"
        assert "seq_tup_read" in content, "缺少 seq_tup_read"
        assert "seq_scan > 1000" in content, "缺少 seq_scan 阈值"

        print(f"  ✅ 缺失索引检测 (seq_scan > 1000)")
        return True
    except Exception as e:
        print(f"  ❌ 缺失索引检测验证失败: {e}")
        return False


def test_unused_index_detection() -> bool:
    """测试索引脚本检测未使用索引 (idx_scan=0)."""
    try:
        content = INDEX_SCRIPT.read_text(encoding="utf-8")
        assert "未使用索引" in content, "缺少未使用索引检测"
        assert "idx_scan = 0" in content, "缺少 idx_scan=0 条件"
        assert "indexrelname" in content, "缺少 indexrelname"
        assert "pg_relation_size" in content, "缺少索引大小"

        print(f"  ✅ 未使用索引检测 (idx_scan=0)")
        return True
    except Exception as e:
        print(f"  ❌ 未使用索引检测验证失败: {e}")
        return False


def test_bloat_detection() -> bool:
    """测试索引脚本检测表膨胀 (n_dead_tup)."""
    try:
        content = INDEX_SCRIPT.read_text(encoding="utf-8")
        assert "表膨胀检测" in content, "缺少表膨胀检测"
        assert "n_dead_tup" in content, "缺少 n_dead_tup"
        assert "n_dead_tup > 1000" in content, "缺少 n_dead_tup 阈值"
        assert "dead_ratio_pct" in content, "缺少 dead_ratio_pct"
        assert "last_autovacuum" in content, "缺少 last_autovacuum"

        print(f"  ✅ 表膨胀检测 (n_dead_tup > 1000)")
        return True
    except Exception as e:
        print(f"  ❌ 表膨胀检测验证失败: {e}")
        return False


def test_pg_stat_statements_enabled() -> bool:
    """测试 postgresql.conf 启用 pg_stat_statements."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "shared_preload_libraries = 'pg_stat_statements'" in content, \
            "postgresql.conf 未启用 pg_stat_statements"
        assert "pg_stat_statements.max = 10000" in content, "缺少 pg_stat_statements.max"
        assert "pg_stat_statements.track = all" in content, "缺少 pg_stat_statements.track"

        print(f"  ✅ postgresql.conf 启用 pg_stat_statements (max=10000, track=all)")
        return True
    except Exception as e:
        print(f"  ❌ pg_stat_statements 启用验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 慢查询治理验证")
    print("=" * 70)

    results = []
    print("\n[1] 慢查询治理脚本")
    results.append(("脚本存在", test_governance_script_exists()))
    results.append(("3 个库支持", test_governance_databases()))
    results.append(("pg_stat_statements", test_pg_stat_statements()))
    results.append(("JSON 输出", test_json_output()))
    results.append(("Top N 参数", test_top_n_param()))

    print("\n[2] 索引优化脚本")
    results.append(("脚本存在", test_index_script_exists()))
    results.append(("缺失索引检测", test_missing_index_detection()))
    results.append(("未使用索引检测", test_unused_index_detection()))
    results.append(("表膨胀检测", test_bloat_detection()))

    print("\n[3] 配置验证")
    results.append(("pg_stat_statements 启用", test_pg_stat_statements_enabled()))

    print("\n" + "=" * 70)
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    print(f"测试结果: {passed}/{total} 通过")
    print("=" * 70)
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"  {status} {name}")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
