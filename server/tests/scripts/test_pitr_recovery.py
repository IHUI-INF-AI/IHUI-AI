"""WAL 归档 + PITR 恢复演练验证脚本.

验证内容 (10 项):
1. postgresql.conf 启用 WAL 归档 (archive_mode = on)
2. archive_command 配置正确
3. archive_timeout = 60s
4. archive_cleanup_command 配置
5. pitr_recovery_drill.sh 脚本存在且语法正确
6. 演练脚本包含 6 步流程
7. 演练脚本使用 pg_basebackup
8. 演练脚本包含 recovery_target_time
9. 演练脚本包含 restore_command
10. 演练脚本包含验证预期

用法:
  python scripts/test_pitr_recovery.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PG_CONF = ROOT / "docker" / "postgresql" / "postgresql.conf"
PITR_SCRIPT = ROOT / "scripts" / "pitr_recovery_drill.sh"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def test_archive_mode() -> bool:
    """测试 postgresql.conf 启用 WAL 归档."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "archive_mode = on" in content, "archive_mode 非 on"
        print(f"  ✅ archive_mode = on (WAL 归档已启用)")
        return True
    except Exception as e:
        print(f"  ❌ archive_mode 验证失败: {e}")
        return False


def test_archive_command() -> bool:
    """测试 archive_command 配置正确."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "archive_command" in content, "缺少 archive_command"
        assert "/var/lib/postgresql/archive/%f" in content, "archive_command 缺少归档路径"
        assert "cp %p" in content, "archive_command 缺少 cp 命令"
        assert "test ! -f" in content, "archive_command 缺少防覆盖检查"

        print(f"  ✅ archive_command 正确 (cp + 防覆盖)")
        return True
    except Exception as e:
        print(f"  ❌ archive_command 验证失败: {e}")
        return False


def test_archive_timeout() -> bool:
    """测试 archive_timeout = 60s."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "archive_timeout = 60s" in content, "archive_timeout 非 60s"
        print(f"  ✅ archive_timeout = 60s (强制 WAL 切换)")
        return True
    except Exception as e:
        print(f"  ❌ archive_timeout 验证失败: {e}")
        return False


def test_archive_cleanup() -> bool:
    """测试 archive_cleanup_command 配置."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "archive_cleanup_command" in content, "缺少 archive_cleanup_command"
        assert "pg_archivecleanup" in content, "缺少 pg_archivecleanup 工具"
        print(f"  ✅ archive_cleanup_command 配置 (pg_archivecleanup)")
        return True
    except Exception as e:
        print(f"  ❌ archive_cleanup 验证失败: {e}")
        return False


def test_pitr_script_exists() -> bool:
    """测试 pitr_recovery_drill.sh 脚本存在且语法正确."""
    try:
        assert PITR_SCRIPT.exists(), f"脚本不存在: {PITR_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(PITR_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ pitr_recovery_drill.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_pitr_steps() -> bool:
    """测试演练脚本包含 6 步流程."""
    try:
        content = PITR_SCRIPT.read_text(encoding="utf-8")
        assert "[步骤 1/6] 准备测试库" in content, "缺少步骤 1"
        assert "[步骤 2/6] 创建基础备份" in content, "缺少步骤 2"
        assert "[步骤 3/6] 记录恢复目标时间点" in content, "缺少步骤 3"
        assert "[步骤 4/6] 强制 WAL 切换" in content, "缺少步骤 4"
        assert "[步骤 5/6] 模拟 PITR 恢复" in content, "缺少步骤 5"
        assert "[步骤 6/6] 验证预期" in content, "缺少步骤 6"

        print(f"  ✅ 演练脚本包含 6 步流程")
        return True
    except Exception as e:
        print(f"  ❌ 步骤流程验证失败: {e}")
        return False


def test_pg_basebackup() -> bool:
    """测试演练脚本使用 pg_basebackup."""
    try:
        content = PITR_SCRIPT.read_text(encoding="utf-8")
        assert "pg_basebackup" in content, "缺少 pg_basebackup"
        assert "-Fp -Xs -P -R" in content, "pg_basebackup 参数不完整"
        assert "pg_dump" in content, "缺少 pg_dump 备用方案"

        print(f"  ✅ 使用 pg_basebackup (含 pg_dump 备用方案)")
        return True
    except Exception as e:
        print(f"  ❌ pg_basebackup 验证失败: {e}")
        return False


def test_recovery_target_time() -> bool:
    """测试演练脚本包含 recovery_target_time."""
    try:
        content = PITR_SCRIPT.read_text(encoding="utf-8")
        assert "recovery_target_time" in content, "缺少 recovery_target_time"
        assert "TARGET_TIME" in content, "缺少 TARGET_TIME 变量"
        assert "recovery_target_action = 'promote'" in content, "缺少 recovery_target_action"

        print(f"  ✅ recovery_target_time 配置 (promote 模式)")
        return True
    except Exception as e:
        print(f"  ❌ recovery_target_time 验证失败: {e}")
        return False


def test_restore_command() -> bool:
    """测试演练脚本包含 restore_command."""
    try:
        content = PITR_SCRIPT.read_text(encoding="utf-8")
        assert "restore_command" in content, "缺少 restore_command"
        assert "cp ${ARCHIVE_DIR}/%f %p" in content, "restore_command 格式错误"
        assert "recovery.signal" in content, "缺少 recovery.signal"

        print(f"  ✅ restore_command 配置 (cp + recovery.signal)")
        return True
    except Exception as e:
        print(f"  ❌ restore_command 验证失败: {e}")
        return False


def test_verification() -> bool:
    """测试演练脚本包含验证预期."""
    try:
        content = PITR_SCRIPT.read_text(encoding="utf-8")
        assert "预期结果" in content, "缺少预期结果"
        assert "initial_data" in content, "缺少初始数据验证"
        assert "after_target" in content, "缺少目标后数据验证"
        assert "SELECT count(*) FROM pitr_test" in content, "缺少 count 验证"

        print(f"  ✅ 验证预期完整 (初始数据 + 目标后数据 + count)")
        return True
    except Exception as e:
        print(f"  ❌ 验证预期失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("WAL 归档 + PITR 恢复演练验证")
    print("=" * 70)

    results = []
    print("\n[1] WAL 归档配置")
    results.append(("archive_mode = on", test_archive_mode()))
    results.append(("archive_command", test_archive_command()))
    results.append(("archive_timeout = 60s", test_archive_timeout()))
    results.append(("archive_cleanup_command", test_archive_cleanup()))

    print("\n[2] PITR 演练脚本")
    results.append(("脚本存在", test_pitr_script_exists()))
    results.append(("6 步流程", test_pitr_steps()))
    results.append(("pg_basebackup", test_pg_basebackup()))

    print("\n[3] 恢复配置")
    results.append(("recovery_target_time", test_recovery_target_time()))
    results.append(("restore_command", test_restore_command()))
    results.append(("验证预期", test_verification()))

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
