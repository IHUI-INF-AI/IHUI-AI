"""跨可用区多活部署验证脚本.

验证内容 (10 项):
1. PG_CROSS_AZ_DEPLOYMENT.md 文档存在
2. 文档包含架构图
3. 文档包含部署清单 (AZ-A/B/C)
4. 文档包含同步复制配置
5. 文档包含异地异步复制配置
6. 文档包含 HAProxy 跨 AZ 配置
7. 文档包含灾备演练流程
8. 文档包含 RTO/RPO 评估
9. pg_cross_az_drill.sh 脚本存在
10. 演练脚本生成 JSON 报告

用法:
  python scripts/test_pg_cross_az.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "PG_CROSS_AZ_DEPLOYMENT.md"
DRILL_SCRIPT = ROOT / "scripts" / "pg_cross_az_drill.sh"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def test_doc_exists() -> bool:
    """测试文档存在."""
    try:
        assert DOC.exists(), f"文档不存在: {DOC}"
        content = DOC.read_text(encoding="utf-8")
        assert len(content) > 0, "文档内容为空"
        print(f"  ✅ PG_CROSS_AZ_DEPLOYMENT.md 存在 ({len(content)} 字节)")
        return True
    except Exception as e:
        print(f"  ❌ 文档存在性验证失败: {e}")
        return False


def test_architecture_diagram() -> bool:
    """测试文档包含架构图."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "AZ-A" in content, "缺少 AZ-A"
        assert "AZ-B" in content, "缺少 AZ-B"
        assert "AZ-C" in content, "缺少 AZ-C (异地)"
        assert "Patroni" in content, "缺少 Patroni"
        assert "etcd" in content, "缺少 etcd"
        assert "HAProxy" in content, "缺少 HAProxy"
        assert "同步复制" in content, "缺少同步复制"
        assert "异步" in content, "缺少异步复制"

        print(f"  ✅ 架构图完整 (3 AZ + Patroni + etcd + HAProxy)")
        return True
    except Exception as e:
        print(f"  ❌ 架构图验证失败: {e}")
        return False


def test_deployment_list() -> bool:
    """测试文档包含部署清单."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "部署清单" in content, "缺少部署清单"
        assert "Leader" in content, "缺少 Leader 角色"
        assert "Replica" in content, "缺少 Replica 角色"
        assert "witness" in content, "缺少 witness"
        assert "pgBouncer" in content, "缺少 pgBouncer"

        print(f"  ✅ 部署清单完整 (Leader/Replica/witness/pgBouncer)")
        return True
    except Exception as e:
        print(f"  ❌ 部署清单验证失败: {e}")
        return False


def test_sync_replication_config() -> bool:
    """测试文档包含同步复制配置."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "synchronous_commit" in content, "缺少 synchronous_commit"
        assert "synchronous_standby_names" in content, "缺少 synchronous_standby_names"
        assert "FIRST 1" in content, "缺少 FIRST 1"

        print(f"  ✅ 同步复制配置 (synchronous_commit + FIRST 1)")
        return True
    except Exception as e:
        print(f"  ❌ 同步复制配置验证失败: {e}")
        return False


def test_async_replication_config() -> bool:
    """测试文档包含异地异步复制配置."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "异地" in content, "缺少异地"
        assert "local" in content, "缺少 local 同步级别"
        assert "异步复制" in content, "缺少异步复制"

        print(f"  ✅ 异地异步复制配置 (synchronous_commit=local)")
        return True
    except Exception as e:
        print(f"  ❌ 异地异步复制验证失败: {e}")
        return False


def test_haproxy_config() -> bool:
    """测试文档包含 HAProxy 跨 AZ 配置."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "write_backend" in content, "缺少 write_backend"
        assert "backup" in content, "缺少 backup 配置"
        assert "patroni1.az-a" in content, "缺少 AZ-A Patroni"
        assert "patroni2.az-b" in content, "缺少 AZ-B Patroni"

        print(f"  ✅ HAProxy 跨 AZ 配置 (backup 模式)")
        return True
    except Exception as e:
        print(f"  ❌ HAProxy 配置验证失败: {e}")
        return False


def test_drill_process() -> bool:
    """测试文档包含灾备演练流程."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "灾备演练" in content, "缺少灾备演练"
        assert "AZ-A 故障演练" in content, "缺少 AZ-A 故障演练"
        assert "异地灾备切换" in content, "缺少异地灾备切换"
        assert "docker stop patroni1" in content, "缺少故障模拟"
        assert "pg_ctl promote" in content, "缺少提升命令"

        print(f"  ✅ 灾备演练流程完整 (AZ-A 故障 + 异地切换)")
        return True
    except Exception as e:
        print(f"  ❌ 灾备演练验证失败: {e}")
        return False


def test_rto_rpo() -> bool:
    """测试文档包含 RTO/RPO 评估."""
    try:
        content = DOC.read_text(encoding="utf-8")
        assert "RTO" in content, "缺少 RTO"
        assert "RPO" in content, "缺少 RPO"
        assert "单节点故障" in content, "缺少单节点故障评估"
        assert "单 AZ 故障" in content, "缺少单 AZ 故障评估"
        assert "双 AZ 故障" in content, "缺少双 AZ 故障评估"
        assert "城市级灾难" in content, "缺少城市级灾难评估"

        print(f"  ✅ RTO/RPO 评估完整 (4 级场景)")
        return True
    except Exception as e:
        print(f"  ❌ RTO/RPO 验证失败: {e}")
        return False


def test_drill_script_exists() -> bool:
    """测试 pg_cross_az_drill.sh 脚本存在."""
    try:
        assert DRILL_SCRIPT.exists(), f"脚本不存在: {DRILL_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(DRILL_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ pg_cross_az_drill.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_drill_json_report() -> bool:
    """测试演练脚本生成 JSON 报告."""
    try:
        content = DRILL_SCRIPT.read_text(encoding="utf-8")
        assert "cross_az_drill_${TS}.json" in content, "缺少 JSON 报告输出"
        assert '"timestamp":' in content, "缺少 timestamp"
        assert '"scenarios":' in content, "缺少 scenarios"
        assert '"expected_rto":' in content, "缺少 expected_rto"
        assert '"expected_rpo":' in content, "缺少 expected_rpo"
        assert '"conclusion":' in content, "缺少 conclusion"

        print(f"  ✅ 演练脚本生成 JSON 报告 (scenarios + RTO/RPO + conclusion)")
        return True
    except Exception as e:
        print(f"  ❌ JSON 报告验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("跨可用区多活部署验证")
    print("=" * 70)

    results = []
    print("\n[1] 文档")
    results.append(("文档存在", test_doc_exists()))
    results.append(("架构图", test_architecture_diagram()))
    results.append(("部署清单", test_deployment_list()))

    print("\n[2] 复制配置")
    results.append(("同步复制配置", test_sync_replication_config()))
    results.append(("异地异步复制", test_async_replication_config()))
    results.append(("HAProxy 跨 AZ", test_haproxy_config()))

    print("\n[3] 演练与评估")
    results.append(("灾备演练流程", test_drill_process()))
    results.append(("RTO/RPO 评估", test_rto_rpo()))
    results.append(("演练脚本存在", test_drill_script_exists()))
    results.append(("JSON 报告", test_drill_json_report()))

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
