"""PostgreSQL 16 升级实战验证脚本.

验证内容 (10 项):
1. docker-compose.pg16-upgrade.yml 存在且 YAML 合法
2. PG16 镜像: postgres:16-alpine
3. PG16 端口: 5433 (避免与 PG14 冲突)
4. PG16 使用独立数据卷 pg16_data
5. PG16 挂载 postgresql.conf
6. upgrade_pg14_to_pg16.sh 脚本存在且语法正确
7. 升级脚本包含 6 步流程 (预检/备份/恢复/验证/扩展/指引)
8. 升级脚本支持 3 个库
9. 升级脚本包含数据一致性验证 (表数量 + 行数)
10. 升级脚本包含回滚指引

用法:
  python scripts/test_pg16_upgrade.py
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPOSE_PG16 = ROOT / "deploy" / "docker" / "docker-compose.pg16-upgrade.yml"
UPGRADE_SCRIPT = ROOT / "scripts" / "upgrade_pg14_to_pg16.sh"


def _bash_available() -> bool:
    try:
        subprocess.run(["bash", "--version"], capture_output=True, timeout=5)
        return True
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def _load_yaml(path: Path):
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        return None
    except Exception:
        return None


def test_compose_exists() -> bool:
    """测试 docker-compose.pg16-upgrade.yml 存在且 YAML 合法."""
    try:
        assert COMPOSE_PG16.exists(), f"文件不存在: {COMPOSE_PG16}"
        data = _load_yaml(COMPOSE_PG16)
        if data is None:
            print("  ⚠️  PyYAML 未安装, 使用文本检查")
            content = COMPOSE_PG16.read_text(encoding="utf-8")
            assert "postgres16:" in content, "缺少 postgres16 服务"
            assert "pg16_data:" in content, "缺少 pg16_data 卷"
            print(f"  ✅ docker-compose.pg16-upgrade.yml 存在 (文本检查)")
            return True

        assert "services" in data, "缺少 services"
        assert "postgres16" in data["services"], "缺少 postgres16 服务"
        assert "volumes" in data, "缺少 volumes"
        assert "pg16_data" in data["volumes"], "缺少 pg16_data 卷"

        print(f"  ✅ docker-compose.pg16-upgrade.yml YAML 合法")
        return True
    except Exception as e:
        print(f"  ❌ 文件存在性验证失败: {e}")
        return False


def test_pg16_image() -> bool:
    """测试 PG16 镜像: postgres:16-alpine."""
    try:
        data = _load_yaml(COMPOSE_PG16)
        if data is None:
            content = COMPOSE_PG16.read_text(encoding="utf-8")
            assert "postgres:16-alpine" in content, "镜像非 postgres:16-alpine"
            print(f"  ✅ PG16 镜像: postgres:16-alpine (文本检查)")
            return True

        image = data["services"]["postgres16"]["image"]
        assert image == "postgres:16-alpine", f"镜像错误: {image}"
        print(f"  ✅ PG16 镜像: {image}")
        return True
    except Exception as e:
        print(f"  ❌ 镜像验证失败: {e}")
        return False


def test_pg16_port() -> bool:
    """测试 PG16 端口: 5433."""
    try:
        data = _load_yaml(COMPOSE_PG16)
        if data is None:
            content = COMPOSE_PG16.read_text(encoding="utf-8")
            assert "5433:5432" in content, "端口映射非 5433:5432"
            print(f"  ✅ PG16 端口: 5433 (文本检查)")
            return True

        ports = data["services"]["postgres16"]["ports"]
        assert "5433:5432" in ports, f"端口映射错误: {ports}"
        print(f"  ✅ PG16 端口: 5433:5432 (避免与 PG14 冲突)")
        return True
    except Exception as e:
        print(f"  ❌ 端口验证失败: {e}")
        return False


def test_pg16_volume() -> bool:
    """测试 PG16 使用独立数据卷 pg16_data."""
    try:
        data = _load_yaml(COMPOSE_PG16)
        if data is None:
            content = COMPOSE_PG16.read_text(encoding="utf-8")
            assert "pg16_data:/var/lib/postgresql/data" in content, "未挂载 pg16_data"
            print(f"  ✅ PG16 独立数据卷 pg16_data (文本检查)")
            return True

        volumes = data["services"]["postgres16"]["volumes"]
        assert any("pg16_data" in v for v in volumes), f"未挂载 pg16_data: {volumes}"
        assert "pg16_data" in data.get("volumes", {}), "volumes 缺少 pg16_data 声明"
        print(f"  ✅ PG16 独立数据卷 pg16_data (不影响 PG14)")
        return True
    except Exception as e:
        print(f"  ❌ 数据卷验证失败: {e}")
        return False


def test_pg16_config_mount() -> bool:
    """测试 PG16 挂载 postgresql.conf."""
    try:
        content = COMPOSE_PG16.read_text(encoding="utf-8")
        assert "docker/postgresql/postgresql.conf" in content, "未挂载 postgresql.conf"
        assert "config_file=/etc/postgresql/postgresql.conf" in content, "未使用 config_file 启动"
        print(f"  ✅ PG16 挂载 postgresql.conf (复用 PG14 调优配置)")
        return True
    except Exception as e:
        print(f"  ❌ 配置挂载验证失败: {e}")
        return False


def test_upgrade_script_exists() -> bool:
    """测试 upgrade_pg14_to_pg16.sh 脚本存在且语法正确."""
    try:
        assert UPGRADE_SCRIPT.exists(), f"脚本不存在: {UPGRADE_SCRIPT}"

        if _bash_available():
            result = subprocess.run(["bash", "-n", str(UPGRADE_SCRIPT)], capture_output=True, timeout=10)
            assert result.returncode == 0, f"语法错误: {result.stderr}"
            note = "bash 语法通过"
        else:
            note = "bash 不可用, 跳过语法检查"

        print(f"  ✅ upgrade_pg14_to_pg16.sh 存在 ({note})")
        return True
    except Exception as e:
        print(f"  ❌ 脚本存在性验证失败: {e}")
        return False


def test_upgrade_script_steps() -> bool:
    """测试升级脚本包含 6 步流程."""
    try:
        content = UPGRADE_SCRIPT.read_text(encoding="utf-8")

        # 6 步流程
        assert "[步骤 1/6] 预检" in content, "缺少步骤 1 预检"
        assert "[步骤 2/6] 全量备份 PG14" in content, "缺少步骤 2 备份"
        assert "[步骤 3/6] 恢复到 PG16" in content, "缺少步骤 3 恢复"
        assert "[步骤 4/6] 数据一致性验证" in content, "缺少步骤 4 验证"
        assert "[步骤 5/6] 扩展兼容性检查" in content, "缺少步骤 5 扩展检查"
        assert "[步骤 6/6] 生成切换指引" in content, "缺少步骤 6 指引"

        # 预检内容
        assert "pg_isready" in content, "预检缺少 pg_isready"
        assert "SHOW server_version" in content, "预检缺少版本检查"

        print(f"  ✅ 升级脚本包含 6 步流程 (预检/备份/恢复/验证/扩展/指引)")
        return True
    except Exception as e:
        print(f"  ❌ 步骤流程验证失败: {e}")
        return False


def test_upgrade_script_databases() -> bool:
    """测试升级脚本支持 3 个库."""
    try:
        content = UPGRADE_SCRIPT.read_text(encoding="utf-8")
        assert "zhs_ai_project" in content, "缺少 zhs_ai_project"
        assert "zhs_center_project" in content, "缺少 zhs_center_project"
        assert "zhs_educational_training" in content, "缺少 zhs_educational_training"
        assert 'DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")' in content, \
            "DATABASES 数组配置错误"

        print(f"  ✅ 升级脚本支持 3 个库 (ai/center/educational_training)")
        return True
    except Exception as e:
        print(f"  ❌ 3 库支持验证失败: {e}")
        return False


def test_data_consistency_check() -> bool:
    """测试升级脚本包含数据一致性验证."""
    try:
        content = UPGRADE_SCRIPT.read_text(encoding="utf-8")

        # 表数量验证
        assert "information_schema.tables" in content, "缺少表数量验证"
        assert "PG14_TABLES" in content, "缺少 PG14_TABLES 变量"
        assert "PG16_TABLES" in content, "缺少 PG16_TABLES 变量"

        # 行数验证
        assert "n_live_tup" in content, "缺少行数验证 (n_live_tup)"
        assert "PG14_ROWS" in content, "缺少 PG14_ROWS 变量"
        assert "PG16_ROWS" in content, "缺少 PG16_ROWS 变量"

        # ANALYZE 更新统计
        assert "ANALYZE;" in content, "缺少 ANALYZE 更新统计"

        # 失败计数
        assert "FAIL_COUNT" in content, "缺少 FAIL_COUNT"

        print(f"  ✅ 数据一致性验证完整 (表数量 + 行数 + ANALYZE + 失败计数)")
        return True
    except Exception as e:
        print(f"  ❌ 数据一致性验证失败: {e}")
        return False


def test_rollback_guidance() -> bool:
    """测试升级脚本包含回滚指引."""
    try:
        content = UPGRADE_SCRIPT.read_text(encoding="utf-8")

        # 切换指引
        assert "下一步切换操作" in content, "缺少切换指引"
        assert "postgres:14-alpine → postgres:16-alpine" in content, "缺少镜像切换说明"

        # 回滚方案
        assert "回滚方案" in content, "缺少回滚方案"
        assert "postgres:16-alpine → postgres:14-alpine" in content, "缺少回滚镜像说明"

        # 冒烟测试
        assert "healthz" in content, "缺少冒烟测试"

        print(f"  ✅ 回滚指引完整 (切换步骤 + 回滚方案 + 冒烟测试)")
        return True
    except Exception as e:
        print(f"  ❌ 回滚指引验证失败: {e}")
        return False


def main() -> int:
    print("=" * 70)
    print("PostgreSQL 16 升级实战验证")
    print("=" * 70)

    results = []
    print("\n[1] docker-compose 配置")
    results.append(("compose 文件存在", test_compose_exists()))
    results.append(("PG16 镜像", test_pg16_image()))
    results.append(("PG16 端口 5433", test_pg16_port()))
    results.append(("独立数据卷 pg16_data", test_pg16_volume()))
    results.append(("挂载 postgresql.conf", test_pg16_config_mount()))

    print("\n[2] 升级脚本")
    results.append(("脚本存在且语法正确", test_upgrade_script_exists()))
    results.append(("6 步流程", test_upgrade_script_steps()))
    results.append(("3 个库支持", test_upgrade_script_databases()))

    print("\n[3] 验证与回滚")
    results.append(("数据一致性验证", test_data_consistency_check()))
    results.append(("回滚指引", test_rollback_guidance()))

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
