"""PostgreSQL 备份加密与异地容灾验证脚本.

验证内容 (10 项):
1. backup_pg_encrypted.sh 存在且语法正确
2. restore_pg_encrypted.sh 存在且语法正确
3. 加密算法: AES-256-CBC + PBKDF2
4. 密钥来源: BACKUP_ENCRYPTION_KEY 环境变量
5. 备份文件命名: <db>_<timestamp>.sql.gz.enc
6. 3 个库加密备份
7. 异地容灾: rsync 同步 (可选)
8. 失败计数告警机制
9. 解密恢复流程 (openssl dec + gunzip + psql)
10. 模拟加密/解密流程 (openssl 实际加解密验证)

用法:
  python scripts/test_pg_backup_encrypted.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def test_backup_script_exists() -> bool:
    """测试 backup_pg_encrypted.sh 存在."""
    try:
        script = ROOT / "scripts" / "backup_pg_encrypted.sh"
        assert script.exists(), f"脚本不存在: {script}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(script)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ backup_pg_encrypted.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ backup_pg_encrypted.sh 验证失败: {e}")
        return False


def test_restore_script_exists() -> bool:
    """测试 restore_pg_encrypted.sh 存在."""
    try:
        script = ROOT / "scripts" / "restore_pg_encrypted.sh"
        assert script.exists(), f"脚本不存在: {script}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(script)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ restore_pg_encrypted.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ restore_pg_encrypted.sh 验证失败: {e}")
        return False


def test_encryption_algorithm() -> bool:
    """测试加密算法: AES-256-CBC + PBKDF2."""
    try:
        backup = (ROOT / "scripts" / "backup_pg_encrypted.sh").read_text(encoding="utf-8")
        restore = (ROOT / "scripts" / "restore_pg_encrypted.sh").read_text(encoding="utf-8")

        # 加密端
        assert "openssl enc -aes-256-cbc" in backup, "backup 缺少 AES-256-CBC 加密"
        assert "-pbkdf2" in backup, "backup 缺少 PBKDF2 密钥派生"
        assert "-salt" in backup, "backup 缺少 salt"

        # 解密端
        assert "openssl enc -d -aes-256-cbc" in restore, "restore 缺少 AES-256-CBC 解密"
        assert "-pbkdf2" in restore, "restore 缺少 PBKDF2"

        print(f"  ✅ 加密算法正确 (AES-256-CBC + PBKDF2 + salt)")
        return True
    except Exception as e:
        print(f"  ❌ 加密算法验证失败: {e}")
        return False


def test_encryption_key_env() -> bool:
    """测试密钥来源: BACKUP_ENCRYPTION_KEY 环境变量."""
    try:
        backup = (ROOT / "scripts" / "backup_pg_encrypted.sh").read_text(encoding="utf-8")
        restore = (ROOT / "scripts" / "restore_pg_encrypted.sh").read_text(encoding="utf-8")

        # 密钥环境变量
        assert "BACKUP_ENCRYPTION_KEY" in backup, "backup 缺少 BACKUP_ENCRYPTION_KEY"
        assert "BACKUP_ENCRYPTION_KEY" in restore, "restore 缺少 BACKUP_ENCRYPTION_KEY"

        # 密钥长度检查 (32+ 字符)
        assert "32+ 字符" in backup, "backup 缺少密钥长度提示"

        # 密钥为空时报错
        assert "BACKUP_ENCRYPTION_KEY 未设置" in backup, "backup 缺少密钥未设置检查"
        assert "BACKUP_ENCRYPTION_KEY 未设置" in restore, "restore 缺少密钥未设置检查"

        print(f"  ✅ 密钥来源正确 (BACKUP_ENCRYPTION_KEY 环境变量, 32+ 字符)")
        return True
    except Exception as e:
        print(f"  ❌ 密钥来源验证失败: {e}")
        return False


def test_backup_file_naming() -> bool:
    """测试备份文件命名: <db>_<timestamp>.sql.gz.enc."""
    try:
        content = (ROOT / "scripts" / "backup_pg_encrypted.sh").read_text(encoding="utf-8")
        assert 'BACKUP_FILE="${BACKUP_DIR}/${db}_${TS}.sql.gz.enc"' in content, \
            "备份文件命名格式错误"
        assert 'TS=$(date +%Y%m%d_%H%M%S)' in content, "缺少时间戳生成"

        print(f"  ✅ 备份文件命名正确 (<db>_<timestamp>.sql.gz.enc)")
        return True
    except Exception as e:
        print(f"  ❌ 备份文件命名验证失败: {e}")
        return False


def test_three_databases() -> bool:
    """测试 3 个库加密备份."""
    try:
        content = (ROOT / "scripts" / "backup_pg_encrypted.sh").read_text(encoding="utf-8")
        assert "zhs_ai_project" in content, "缺少 zhs_ai_project"
        assert "zhs_center_project" in content, "缺少 zhs_center_project"
        assert "zhs_educational_training" in content, "缺少 zhs_educational_training"
        assert 'DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")' in content, \
            "DATABASES 数组配置错误"

        print(f"  ✅ 3 个库加密备份 (ai/center/educational_training)")
        return True
    except Exception as e:
        print(f"  ❌ 3 库备份验证失败: {e}")
        return False


def test_remote_sync() -> bool:
    """测试异地容灾: rsync 同步."""
    try:
        content = (ROOT / "scripts" / "backup_pg_encrypted.sh").read_text(encoding="utf-8")

        # rsync 同步
        assert "rsync" in content, "缺少 rsync 异地同步"
        assert "BACKUP_REMOTE_HOST" in content, "缺少 BACKUP_REMOTE_HOST 配置"
        assert "BACKUP_REMOTE_PATH" in content, "缺少 BACKUP_REMOTE_PATH 配置"

        # 远程清理
        assert "ssh" in content, "缺少 ssh 远程清理"
        assert "find" in content, "缺少远程 find 清理"

        # 可选 (有 REMOTE_HOST 时才同步)
        assert '-n "${REMOTE_HOST}"' in content, "异地同步应为可选"

        print(f"  ✅ 异地容灾配置正确 (rsync + ssh 远程清理, 可选)")
        return True
    except Exception as e:
        print(f"  ❌ 异地容灾验证失败: {e}")
        return False


def test_fail_count() -> bool:
    """测试失败计数告警机制."""
    try:
        content = (ROOT / "scripts" / "backup_pg_encrypted.sh").read_text(encoding="utf-8")
        assert "FAIL_COUNT=0" in content, "缺少 FAIL_COUNT 初始化"
        assert "FAIL_COUNT=$((FAIL_COUNT + 1))" in content, "缺少 FAIL_COUNT 递增"
        assert '[ "${FAIL_COUNT}" -gt 0 ] && exit 1' in content, "缺少失败退出码"

        print(f"  ✅ 失败计数告警机制正确 (失败时 exit 1)")
        return True
    except Exception as e:
        print(f"  ❌ 失败计数验证失败: {e}")
        return False


def test_restore_decryption_flow() -> bool:
    """测试解密恢复流程: openssl dec + gunzip + psql."""
    try:
        content = (ROOT / "scripts" / "restore_pg_encrypted.sh").read_text(encoding="utf-8")

        # 解密流程
        assert "openssl enc -d -aes-256-cbc" in content, "缺少 openssl 解密"
        assert "gunzip" in content, "缺少 gunzip 解压"
        assert "psql" in content, "缺少 psql 恢复"

        # 管道: openssl | gunzip | psql
        assert "openssl enc -d" in content and "gunzip" in content and "psql" in content, \
            "缺少解密管道流程"

        # latest 参数支持
        assert "latest" in content, "缺少 latest 参数"
        assert "DB_NAME" in content, "缺少库名解析"
        assert "CONFIRM" in content, "缺少确认提示"

        print(f"  ✅ 解密恢复流程正确 (openssl dec | gunzip | psql + latest + 确认)")
        return True
    except Exception as e:
        print(f"  ❌ 解密恢复流程验证失败: {e}")
        return False


def test_simulated_encryption_decryption() -> bool:
    """模拟加密/解密流程 (openssl 实际加解密验证)."""
    try:
        # 检查 openssl 是否可用
        try:
            subprocess.run(["openssl", "version"], capture_output=True, timeout=5)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            print("  ⚠️  openssl 不可用, 跳过实际加解密测试")
            return True

        with tempfile.TemporaryDirectory() as tmpdir:
            tmpdir = Path(tmpdir)

            # 模拟 SQL 内容
            sql_content = "-- PostgreSQL dump\nCREATE TABLE test (id INT);\nINSERT INTO test VALUES (1);\n"
            sql_file = tmpdir / "test.sql"
            sql_file.write_text(sql_content, encoding="utf-8")

            # 加密: gzip | openssl enc
            enc_file = tmpdir / "test.sql.gz.enc"
            key = "test_encryption_key_32chars_long"

            # gzip + openssl 加密
            with open(sql_file, "rb") as f_in:
                import gzip
                gz_data = gzip.compress(f_in.read())

            result = subprocess.run(
                ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-salt",
                 "-pass", f"pass:{key}"],
                input=gz_data,
                capture_output=True,
                timeout=10,
            )
            assert result.returncode == 0, f"加密失败: {result.stderr}"
            enc_file.write_bytes(result.stdout)
            assert enc_file.exists(), "加密文件未生成"
            assert enc_file.stat().st_size > 0, "加密文件为空"

            # 解密: openssl dec | gunzip
            result = subprocess.run(
                ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                 "-pass", f"pass:{key}"],
                input=enc_file.read_bytes(),
                capture_output=True,
                timeout=10,
            )
            assert result.returncode == 0, f"解密失败: {result.stderr}"

            # gunzip 解压
            import gzip
            decrypted = gzip.decompress(result.stdout).decode("utf-8")
            assert decrypted == sql_content, "解密后内容与原文不一致"
            assert "CREATE TABLE" in decrypted, "解密内容异常"

            # 错误密钥解密应失败
            result = subprocess.run(
                ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2",
                 "-pass", "pass:wrong_key"],
                input=enc_file.read_bytes(),
                capture_output=True,
                timeout=10,
            )
            assert result.returncode != 0, "错误密钥应解密失败"

        print(f"  ✅ 模拟加密/解密流程通过 (AES-256-CBC + 错误密钥验证)")
        return True
    except Exception as e:
        print(f"  ❌ 模拟加解密验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 备份加密与异地容灾验证")
    print("=" * 70)

    results = []
    print("\n[1] 脚本存在性")
    results.append(("backup_pg_encrypted.sh", test_backup_script_exists()))
    results.append(("restore_pg_encrypted.sh", test_restore_script_exists()))

    print("\n[2] 加密配置")
    results.append(("加密算法 (AES-256-CBC)", test_encryption_algorithm()))
    results.append(("密钥来源 (环境变量)", test_encryption_key_env()))
    results.append(("备份文件命名", test_backup_file_naming()))

    print("\n[3] 备份与容灾")
    results.append(("3 个库加密备份", test_three_databases()))
    results.append(("异地容灾 (rsync)", test_remote_sync()))
    results.append(("失败计数告警", test_fail_count()))

    print("\n[4] 恢复与验证")
    results.append(("解密恢复流程", test_restore_decryption_flow()))
    results.append(("模拟加解密", test_simulated_encryption_decryption()))

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
