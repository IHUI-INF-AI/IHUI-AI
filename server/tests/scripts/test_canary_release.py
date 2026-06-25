#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""金丝雀发布脚本测试 - canary_release.sh

验证项:
1. 脚本存在
2. 8 步骤流程
3. 4 个操作: deploy / promote / rollback / dry-run
4. 参数: --service / --version / --canary-percent / --promote / --rollback / --dry-run
5. VirtualService 模板
6. 健康检查
7. 阈值判断 (错误率 / 延迟)
8. 自动回滚
9. JSON 报告生成
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "canary_release.sh"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ✅ {name} -- {detail}")


def main() -> int:
    print("=" * 60)
    print("P2-8 金丝雀发布脚本测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 8 步骤
    steps = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]
    for step in steps:
        test_case(f"包含步骤 {step}", step in content, f"缺少步骤 {step}")

    # 4 个操作
    actions = ["deploy", "promote", "rollback", "dry-run"]
    for act in actions:
        test_case(f"操作 {act}", act in content, f"缺少 {act}")

    # 关键参数
    params = ["--service", "--version", "--canary-percent", "--promote", "--rollback", "--dry-run", "--health-url", "--error-threshold", "--latency-threshold"]
    for p in params:
        test_case(f"参数 {p}", p in content, f"缺少 {p}")

    # 关键步骤
    test_case("预检", "预检" in content, "")
    test_case("检查当前部署", "检查当前" in content, "")
    test_case("部署 canary", "canary" in content, "")
    test_case("调整流量比例", "流量比例" in content or "weight" in content, "")
    test_case("健康检查", "健康检查" in content or "HEALTH_CHECK_URL" in content, "")
    test_case("监控指标", "监控指标" in content, "")
    test_case("阈值判断", "阈值判断" in content, "")
    test_case("生成报告", "REPORT_FILE" in content, "")

    # VirtualService
    test_case("VirtualService 模板", "VirtualService" in content, "")
    test_case("networking.istio.io API", "networking.istio.io" in content, "")
    test_case("weight 字段", "weight" in content, "")

    # 自动回滚
    test_case("自动回滚", "自动回滚" in content, "")
    test_case("SHOULD_ROLLBACK 变量", "SHOULD_ROLLBACK" in content, "")

    # 阈值
    test_case("错误率阈值", "ERROR_THRESHOLD" in content, "")
    test_case("延迟阈值", "LATENCY_THRESHOLD_MS" in content, "")

    # JSON 报告
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 service", '"service":' in content, "")
    test_case("JSON 含 version", '"version":' in content, "")
    test_case("JSON 含 canary_percent", '"canary_percent":' in content, "")
    test_case("JSON 含 health_status", '"health_status":' in content, "")

    # kubectl 集成
    test_case("kubectl set image", "kubectl set image" in content, "")
    test_case("kubectl rollout undo", "kubectl rollout undo" in content, "")
    test_case("kubectl scale", "kubectl scale" in content, "")

    # Deployment 模板
    test_case("Deployment apiVersion", "apps/v1" in content, "")
    test_case("Deployment kind", "kind: Deployment" in content, "")

    # 命名空间
    test_case("K8S_NAMESPACE 环境变量", "K8S_NAMESPACE" in content, "")
    test_case("默认命名空间", "zhs-production" in content, "")

    # set -euo pipefail
    test_case("set -euo pipefail", "set -euo pipefail" in content, "")

    # curl 健康检查
    test_case("curl 健康检查", "curl" in content, "")

    # replica 数量
    test_case("canary replicas", "CANARY_REPLICAS" in content, "")
    test_case("stable replicas", "CURRENT_REPLICAS" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
