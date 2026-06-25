"""PostgreSQL 安全加固验证脚本.

验证内容 (10 项):
1. pg_hba.conf 存在且配置完整
2. pg_hba.conf 强制 SSL (hostssl)
3. pg_hba.conf 拒绝外部访问 (reject 0.0.0.0/0)
4. pg_hba.conf 使用 scram-sha-256 认证
5. postgresql.conf 启用 SSL (ssl = on)
6. postgresql.conf SSL 协议版本 (TLSv1.2+)
7. postgresql.conf 密码加密 (scram-sha-256)
8. postgresql.conf 审计日志 (log_statement=ddl)
9. pg_security_audit.sh 脚本存在
10. 审计脚本生成 JSON 报告

用法:
  python scripts/test_pg_security.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PG_HBA = ROOT / "docker" / "postgresql" / "pg_hba.conf"
PG_CONF = ROOT / "docker" / "postgresql" / "postgresql.conf"
AUDIT_SCRIPT = ROOT / "scripts" / "pg_security_audit.sh"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def test_pg_hba_exists() -> bool:
    """测试 pg_hba.conf 存在且配置完整."""
    try:
        assert PG_HBA.exists(), f"文件不存在: {PG_HBA}"
        content = PG_HBA.read_text(encoding="utf-8")
        assert "TYPE  DATABASE" in content, "缺少表头"
        assert "local" in content, "缺少 local 连接"
        assert "hostssl" in content, "缺少 hostssl"
        assert "hostnossl" in content, "缺少 hostnossl"

        print(f"  ✅ pg_hba.conf 存在 ({len(content)} 字节)")
        return True
    except Exception as e:
        print(f"  ❌ 文件存在性验证失败: {e}")
        return False


def test_pg_hba_ssl_enforced() -> bool:
    """测试 pg_hba.conf 强制 SSL (hostssl)."""
    try:
        content = PG_HBA.read_text(encoding="utf-8")
        # 应用连接必须使用 hostssl
        assert "hostssl zhs_ai_project" in content, "zhs_ai_project 未强制 SSL"
        assert "hostssl zhs_center_project" in content, "zhs_center_project 未强制 SSL"
        assert "hostssl zhs_educational_training" in content, "zhs_educational_training 未强制 SSL"
        assert "hostssl replication" in content, "复制连接未强制 SSL"

        print(f"  ✅ pg_hba.conf 强制 SSL (hostssl)")
        return True
    except Exception as e:
        print(f"  ❌ SSL 强制验证失败: {e}")
        return False


def test_pg_hba_reject_external() -> bool:
    """测试 pg_hba.conf 拒绝外部访问."""
    try:
        content = PG_HBA.read_text(encoding="utf-8")
        assert "0.0.0.0/0               reject" in content, "缺少 IPv4 reject"
        assert "::/0                    reject" in content, "缺少 IPv6 reject"
        assert "hostnossl all           all             0.0.0.0/0               reject" in content, \
            "缺少 hostnossl reject"

        print(f"  ✅ pg_hba.conf 拒绝外部访问 (IPv4 + IPv6 + nossl)")
        return True
    except Exception as e:
        print(f"  ❌ 拒绝外部访问验证失败: {e}")
        return False


def test_pg_hba_scram_auth() -> bool:
    """测试 pg_hba.conf 使用 scram-sha-256 认证."""
    try:
        content = PG_HBA.read_text(encoding="utf-8")
        assert "scram-sha-256" in content, "缺少 scram-sha-256 认证"
        # 应用连接使用 scram-sha-256
        assert "zhs_ai_project          zhs             10.0.0.0/8              scram-sha-256" in content, \
            "zhs_ai_project 未使用 scram-sha-256"

        print(f"  ✅ pg_hba.conf 使用 scram-sha-256 认证")
        return True
    except Exception as e:
        print(f"  ❌ scram-sha-256 验证失败: {e}")
        return False


def test_ssl_enabled() -> bool:
    """测试 postgresql.conf 启用 SSL (ssl = on)."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "ssl = on" in content, "postgresql.conf 未启用 SSL"
        assert "ssl_cert_file" in content, "缺少 ssl_cert_file"
        assert "ssl_key_file" in content, "缺少 ssl_key_file"
        assert "ssl_ca_file" in content, "缺少 ssl_ca_file"

        print(f"  ✅ postgresql.conf 启用 SSL (ssl=on + 证书路径)")
        return True
    except Exception as e:
        print(f"  ❌ SSL 启用验证失败: {e}")
        return False


def test_ssl_protocol() -> bool:
    """测试 postgresql.conf SSL 协议版本 (TLSv1.2+)."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "ssl_min_protocol_version = 'TLSv1.2'" in content, \
            "ssl_min_protocol_version 非 TLSv1.2"
        assert "ssl_ciphers" in content, "缺少 ssl_ciphers"
        assert "ssl_ecdh_curve" in content, "缺少 ssl_ecdh_curve"

        print(f"  ✅ SSL 协议版本 TLSv1.2+ (高强度密码套件)")
        return True
    except Exception as e:
        print(f"  ❌ SSL 协议验证失败: {e}")
        return False


def test_password_encryption() -> bool:
    """测试 postgresql.conf 密码加密 (scram-sha-256)."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "password_encryption = scram-sha-256" in content, \
            "password_encryption 非 scram-sha-256"

        print(f"  ✅ 密码加密 scram-sha-256")
        return True
    except Exception as e:
        print(f"  ❌ 密码加密验证失败: {e}")
        return False


def test_audit_logging() -> bool:
    """测试 postgresql.conf 审计日志 (log_statement=ddl)."""
    try:
        content = PG_CONF.read_text(encoding="utf-8")
        assert "log_statement = 'ddl'" in content, "缺少 log_statement=ddl"
        assert "log_connections = on" in content, "缺少 log_connections"
        assert "log_disconnections = on" in content, "缺少 log_disconnections"
        assert "log_lock_waits = on" in content, "缺少 log_lock_waits"

        print(f"  ✅ 审计日志 (ddl + connections + lock_waits)")
        return True
    except Exception as e:
        print(f"  ❌ 审计日志验证失败: {e}")
        return False


def test_audit_script_exists() -> bool:
    """测试 pg_security_audit.sh 脚本存在."""
    try:
        assert AUDIT_SCRIPT.exists(), f"脚本不存在: {AUDIT_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(AUDIT_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ pg_security_audit.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_audit_json_report() -> bool:
    """测试审计脚本生成 JSON 报告."""
    try:
        content = AUDIT_SCRIPT.read_text(encoding="utf-8")
        assert "security_audit_${TS}.json" in content, "缺少 JSON 报告输出"
        assert '"timestamp":' in content, "缺少 timestamp"
        assert '"audits":' in content, "缺少 audits"
        assert "ssl_config" in content, "缺少 SSL 审计"
        assert "password_encryption" in content, "缺少密码加密审计"
        assert "default_accounts" in content, "缺少默认账户审计"
        assert "database_permissions" in content, "缺少数据库权限审计"

        print(f"  ✅ 审计脚本生成 JSON 报告 (6 项审计)")
        return True
    except Exception as e:
        print(f"  ❌ JSON 报告验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 安全加固验证")
    print("=" * 70)

    results = []
    print("\n[1] pg_hba.conf")
    results.append(("文件存在", test_pg_hba_exists()))
    results.append(("强制 SSL (hostssl)", test_pg_hba_ssl_enforced()))
    results.append(("拒绝外部访问", test_pg_hba_reject_external()))
    results.append(("scram-sha-256 认证", test_pg_hba_scram_auth()))

    print("\n[2] postgresql.conf")
    results.append(("SSL 启用", test_ssl_enabled()))
    results.append(("SSL 协议 TLSv1.2+", test_ssl_protocol()))
    results.append(("密码加密 scram-sha-256", test_password_encryption()))
    results.append(("审计日志", test_audit_logging()))

    print("\n[3] 审计脚本")
    results.append(("脚本存在", test_audit_script_exists()))
    results.append(("JSON 报告", test_audit_json_report()))

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
