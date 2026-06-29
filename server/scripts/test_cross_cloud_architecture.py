#!/usr/bin/env python3
"""跨云多活架构文档测试 - cross_cloud_architecture.md

验证项:
1. 文档存在
2. 三云架构 (阿里云/华为云/AWS)
3. Patroni 集群
4. pgBouncer 配置
5. RPO/RTO 指标
6. 故障切换流程
7. DNS 调度
8. 监控告警
9. 容量规划
10. 实施路线图
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "docs" / "cross_cloud_architecture.md"

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


def main() -> int:
    print("=" * 60)
    print("P2-9 跨云多活架构文档测试")
    print("=" * 60)

    test_case("文档存在", SCRIPT.exists(), str(SCRIPT))

    if not SCRIPT.exists():
        return 1

    content = SCRIPT.read_text(encoding="utf-8")

    # 三云
    clouds = ["阿里云", "华为云", "AWS"]
    for cloud in clouds:
        test_case(f"云厂商 {cloud}", cloud in content, f"缺少 {cloud}")

    # 关键组件
    components = ["Patroni", "pgBouncer", "PostgreSQL", "HAProxy", "DNS", "ArgoCD"]
    for comp in components:
        test_case(f"组件 {comp}", comp in content, f"缺少 {comp}")

    # 角色
    roles = ["Leader", "Standby", "Cascade", "主写入", "主主", "异地灾备"]
    for role in roles:
        test_case(f"角色 {role}", role in content, f"缺少 {role}")

    # RPO / RTO
    test_case("RPO 指标", "RPO" in content, "")
    test_case("RTO 指标", "RTO" in content, "")

    # 故障切换
    test_case("故障切换", "故障切换" in content, "")
    test_case("自动 promote", "promote" in content.lower() or "promote" in content, "")

    # DNS
    test_case("Cloudflare DNS", "Cloudflare" in content, "")
    test_case("GeoIP", "GeoIP" in content, "")

    # 监控告警
    test_case("Prometheus 指标", "Prometheus" in content or "pg_replication_lag" in content, "")
    test_case("告警规则", "alert" in content.lower() or "告警" in content, "")

    # Helm / Terraform
    test_case("Helm Chart 引用", "charts/" in content, "")
    test_case("Terraform 引用", "terraform/" in content, "")

    # 实施阶段
    phases = ["Phase 1", "Phase 2", "Phase 3", "Phase 4"]
    for ph in phases:
        test_case(f"阶段 {ph}", ph in content, f"缺少 {ph}")

    # 端口
    ports = [":6432", ":6433"]
    for port in ports:
        test_case(f"端口 {port}", port in content, f"缺少 {port}")

    # 表格
    test_case("容量规划表", "容量规划" in content, "")
    test_case("成本估算", "成本" in content, "")

    # 文档长度
    test_case(f"文档长度 {len(content)} 字符", len(content) > 2000, f"异常长度: {len(content)}")

    # 一致性保证
    test_case("一致性保证", "一致性" in content, "")

    # 剧本
    test_case("故障切换剧本", "runbook" in content.lower(), "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
