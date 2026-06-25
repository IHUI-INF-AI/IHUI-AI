"""加密备份密钥管理验证脚本.

验证内容 (10 项):
1. pg_backup_key_manager.sh 存在且语法正确
2. 支持 fetch/rotate/verify 3 个动作
3. 支持 vault 和 local 2 种密钥后端
4. Vault 模式: 从 KV 引擎读取密钥
5. 本地模式: master key 解密密钥文件
6. 密钥长度验证 (>= 32 字符)
7. 密钥缓存机制 (5 分钟 TTL)
8. backup_pg_with_kms.sh 包装器存在
9. docker-compose.vault.yml 存在
10. 密钥轮换功能

用法:
  python scripts/test_pg_backup_kms.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY_MANAGER = ROOT / "scripts" / "pg_backup_key_manager.sh"
KMS_BACKUP = ROOT / "scripts" / "backup_pg_with_kms.sh"
VAULT_COMPOSE = ROOT / "deploy" / "docker" / "docker-compose.vault.yml"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def test_key_manager_exists() -> bool:
    """测试 pg_backup_key_manager.sh 存在且语法正确."""
    try:
        assert KEY_MANAGER.exists(), f"脚本不存在: {KEY_MANAGER}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(KEY_MANAGER)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ pg_backup_key_manager.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_actions_support() -> bool:
    """测试支持 fetch/rotate/verify 3 个动作."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")
        assert 'ACTION="${1:-fetch}"' in content, "缺少 ACTION 参数"
        assert "fetch)" in content, "缺少 fetch 动作"
        assert "rotate)" in content, "缺少 rotate 动作"
        assert "verify)" in content, "缺少 verify 动作"
        assert "fetch_key" in content, "缺少 fetch_key 函数"
        assert "verify_key" in content, "缺少 verify_key 函数"

        print(f"  ✅ 支持 3 个动作 (fetch/rotate/verify)")
        return True
    except Exception as e:
        print(f"  ❌ 动作支持验证失败: {e}")
        return False


def test_backends_support() -> bool:
    """测试支持 vault 和 local 2 种密钥后端."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")
        assert 'KEY_BACKEND="${KEY_BACKEND:-local}"' in content, "缺少 KEY_BACKEND 默认值"
        assert "fetch_from_vault" in content, "缺少 fetch_from_vault 函数"
        assert "fetch_from_local" in content, "缺少 fetch_from_local 函数"
        assert "rotate_vault" in content, "缺少 rotate_vault 函数"
        assert "rotate_local" in content, "缺少 rotate_local 函数"
        assert 'case "${KEY_BACKEND}"' in content, "缺少 KEY_BACKEND 分支"

        print(f"  ✅ 支持 2 种密钥后端 (vault + local)")
        return True
    except Exception as e:
        print(f"  ❌ 后端支持验证失败: {e}")
        return False


def test_vault_mode() -> bool:
    """测试 Vault 模式: 从 KV 引擎读取密钥."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")
        assert "VAULT_ADDR" in content, "缺少 VAULT_ADDR"
        assert "VAULT_TOKEN" in content, "缺少 VAULT_TOKEN"
        assert 'vault kv get -field=encryption_key' in content, "缺少 vault kv get 命令"
        assert 'KEY_PATH="${KEY_PATH:-secret/zhs/pg-backup}"' in content, "缺少 KEY_PATH"

        print(f"  ✅ Vault 模式正确 (KV 引擎, 路径 secret/zhs/pg-backup)")
        return True
    except Exception as e:
        print(f"  ❌ Vault 模式验证失败: {e}")
        return False


def test_local_mode() -> bool:
    """测试本地模式: master key 解密密钥文件."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")
        assert "LOCAL_KEY_FILE" in content, "缺少 LOCAL_KEY_FILE"
        assert "LOCAL_MASTER_KEY_FILE" in content, "缺少 LOCAL_MASTER_KEY_FILE"
        assert "openssl enc -d -aes-256-cbc" in content, "缺少 openssl 解密"
        assert 'pass "file:${LOCAL_MASTER_KEY_FILE}"' in content, "缺少 master key 解密"

        print(f"  ✅ 本地模式正确 (master key 解密密钥文件)")
        return True
    except Exception as e:
        print(f"  ❌ 本地模式验证失败: {e}")
        return False


def test_key_length_validation() -> bool:
    """测试密钥长度验证 (>= 32 字符)."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")
        assert "${#key}" in content, "缺少密钥长度检查"
        assert "-lt 32" in content, "缺少 32 字符阈值"
        assert "密钥长度不足 32 字符" in content, "缺少长度不足错误信息"

        print(f"  ✅ 密钥长度验证 (>= 32 字符)")
        return True
    except Exception as e:
        print(f"  ❌ 密钥长度验证失败: {e}")
        return False


def test_key_cache() -> bool:
    """测试密钥缓存机制."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")
        assert "KEY_CACHE_FILE" in content, "缺少 KEY_CACHE_FILE"
        assert "KEY_CACHE_TTL" in content, "缺少 KEY_CACHE_TTL"
        assert "300" in content, "缺少 5 分钟 TTL"
        assert "stat -c %Y" in content, "缺少缓存时间检查"
        assert "chmod 600" in content, "缺少缓存文件权限设置"

        print(f"  ✅ 密钥缓存机制 (5 分钟 TTL, 600 权限)")
        return True
    except Exception as e:
        print(f"  ❌ 密钥缓存验证失败: {e}")
        return False


def test_kms_backup_wrapper() -> bool:
    """测试 backup_pg_with_kms.sh 包装器存在."""
    try:
        assert KMS_BACKUP.exists(), f"包装器不存在: {KMS_BACKUP}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(KMS_BACKUP)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        content = KMS_BACKUP.read_text(encoding="utf-8")
        assert "pg_backup_key_manager.sh" in content, "缺少密钥管理器调用"
        assert "fetch" in content, "缺少 fetch 动作调用"
        assert "backup_pg_encrypted.sh" in content, "缺少加密备份调用"
        assert "BACKUP_ENCRYPTION_KEY" in content, "缺少密钥环境变量导出"
        assert "rm -f /tmp/.pg_backup_key_cache" in content, "缺少缓存清除"

        print(f"  ✅ backup_pg_with_kms.sh 包装器存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 包装器验证失败: {e}")
        return False


def test_vault_compose() -> bool:
    """测试 docker-compose.vault.yml 存在."""
    try:
        assert VAULT_COMPOSE.exists(), f"文件不存在: {VAULT_COMPOSE}"
        content = VAULT_COMPOSE.read_text(encoding="utf-8")
        assert "hashicorp/vault:1.15.2" in content, "Vault 镜像非 1.15.2"
        assert "8200:8200" in content, "缺少 8200 端口"
        assert "VAULT_DEV_ROOT_TOKEN_ID" in content, "缺少 root token 配置"
        assert "vault_data" in content, "缺少数据卷"
        assert "IPC_LOCK" in content, "缺少 IPC_LOCK (Vault 必需)"

        print(f"  ✅ docker-compose.vault.yml 存在 (Vault 1.15.2)")
        return True
    except Exception as e:
        print(f"  ❌ Vault compose 验证失败: {e}")
        return False


def test_key_rotation() -> bool:
    """测试密钥轮换功能."""
    try:
        content = KEY_MANAGER.read_text(encoding="utf-8")

        # Vault 轮换
        assert "vault kv put" in content, "缺少 vault kv put 轮换"
        assert "openssl rand -base64 24" in content, "缺少密钥生成"

        # 本地轮换
        assert "openssl rand -hex 32" in content, "缺少 master key 生成"
        assert "openssl enc -aes-256-cbc -pbkdf2" in content, "缺少密钥加密"

        # 缓存清除
        assert 'rm -f "${KEY_CACHE_FILE}"' in content, "缺少轮换后缓存清除"

        print(f"  ✅ 密钥轮换功能完整 (Vault + 本地 + 缓存清除)")
        return True
    except Exception as e:
        print(f"  ❌ 密钥轮换验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("加密备份密钥管理验证")
    print("=" * 70)

    results = []
    print("\n[1] 脚本与动作")
    results.append(("key_manager 脚本存在", test_key_manager_exists()))
    results.append(("3 个动作 (fetch/rotate/verify)", test_actions_support()))
    results.append(("2 种后端 (vault/local)", test_backends_support()))

    print("\n[2] 后端实现")
    results.append(("Vault 模式 (KV 引擎)", test_vault_mode()))
    results.append(("本地模式 (master key)", test_local_mode()))

    print("\n[3] 安全机制")
    results.append(("密钥长度验证 (32+)", test_key_length_validation()))
    results.append(("密钥缓存 (5min TTL)", test_key_cache()))
    results.append(("密钥轮换", test_key_rotation()))

    print("\n[4] 集成")
    results.append(("KMS 备份包装器", test_kms_backup_wrapper()))
    results.append(("Vault compose", test_vault_compose()))

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
