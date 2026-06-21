"""蓝绿部署端到端演练 (本地模拟, 不依赖 K8s).

模拟真实蓝绿部署流程:
  1. 启动蓝环境 (模拟: 启动 uvicorn on port 8000, 标记为 blue)
  2. 构建新版本 (模拟: 拷贝 v2 模块到目标路径, 标记为 green)
  3. 启动绿环境 (模拟: 启动 uvicorn on port 8001, 标记为 green)
  4. 健康检查绿环境
  5. 切换流量 (模拟: 修改 nginx upstream / Vite proxy)
  6. 验证绿环境处理流量
  7. 蓝环境保留以备回滚
  8. (可选) 回滚到蓝环境

执行:
  python scripts/blue_green_drill.py
"""
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLUE_PORT = 8000
GREEN_PORT = 8001
DRILL_LOG = ROOT / "logs" / "blue_green_drill.json"
DRILL_LOG.parent.mkdir(parents=True, exist_ok=True)


def port_in_use(port: int) -> bool:
    """检查端口是否被占用."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            return False
        except OSError:
            return True


def wait_for_port(port: int, timeout: int = 30) -> bool:
    """等待端口可访问."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=2):
                return True
        except OSError:
            time.sleep(0.5)
    return False


def health_check(port: int) -> dict:
    """调用 /healthz 验证服务健康."""
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=5) as r:
            return {"ok": r.status == 200, "status": r.status}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def count_v2_endpoints(port: int) -> int:
    """查询 /openapi.json 统计 v2 端点."""
    import json
    import urllib.request

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/openapi.json", timeout=5) as r:
            data = json.loads(r.read())
            return len([p for p in data["paths"] if p.startswith("/api/v2/")])
    except Exception:
        return -1


def start_service(port: int, label: str) -> subprocess.Popen | None:
    """启动 uvicorn 服务到指定端口."""
    if port_in_use(port):
        print(f"  ⚠️  端口 {port} 已被占用, 跳过启动 {label}")
        return None

    env = os.environ.copy()
    env["ZHS_DRILL_LABEL"] = label
    log_path = ROOT / f"logs/blue_green_drill_{label}.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_file = open(log_path, "w", encoding="utf-8")

    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1", "--port", str(port),
            "--log-level", "warning",
        ],
        cwd=str(ROOT),
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )
    return proc


def run_drill() -> dict:
    """执行端到端蓝绿部署演练."""
    drill = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "stages": [],
        "status": "running",
    }

    # 1. 蓝环境状态检查
    print("\n[Stage 1] 蓝环境状态检查")
    if port_in_use(BLUE_PORT):
        blue_alive = True
        blue_health = health_check(BLUE_PORT)
        print(f"  ✅ 蓝环境运行中 (port={BLUE_PORT}), health={blue_health}")
    else:
        blue_alive = False
        print(f"  ℹ️  蓝环境未运行 (port={BLUE_PORT} free), 将启动新实例")
        blue_proc = start_service(BLUE_PORT, "blue")
        if blue_proc and wait_for_port(BLUE_PORT, 30):
            blue_health = health_check(BLUE_PORT)
            print(f"  ✅ 蓝环境已启动, health={blue_health}")
        else:
            drill["stages"].append({"stage": "blue_check", "ok": False})
            drill["status"] = "failed"
            return drill

    drill["stages"].append({
        "stage": "blue_check",
        "ok": blue_health.get("ok", False),
        "port": BLUE_PORT,
        "health": blue_health,
    })

    # 2. 绿环境部署
    print("\n[Stage 2] 绿环境部署")
    if port_in_use(GREEN_PORT):
        print(f"  ⚠️  绿端口 {GREEN_PORT} 已被占用, 清理")
        # 查找并杀掉占用进程
        subprocess.run(
            ["powershell", "-Command", f"Get-NetTCPConnection -LocalPort {GREEN_PORT} -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"],
            check=False,
        )
        time.sleep(2)

    green_proc = start_service(GREEN_PORT, "green")
    if not green_proc:
        drill["stages"].append({"stage": "green_deploy", "ok": False, "error": "启动失败"})
        drill["status"] = "failed"
        return drill

    print(f"  ✅ 绿进程已启动 (pid={green_proc.pid})")

    # 3. 绿环境健康检查
    print("\n[Stage 3] 绿环境健康检查")
    if not wait_for_port(GREEN_PORT, 30):
        print("  ❌ 绿环境端口未就绪")
        drill["stages"].append({"stage": "green_health", "ok": False})
        green_proc.terminate()
        drill["status"] = "failed"
        return drill

    green_health = health_check(GREEN_PORT)
    green_v2 = count_v2_endpoints(GREEN_PORT)
    print(f"  ✅ 绿环境健康: {green_health}, v2 端点数: {green_v2}")

    drill["stages"].append({
        "stage": "green_health",
        "ok": green_health.get("ok", False),
        "port": GREEN_PORT,
        "health": green_health,
        "v2_endpoints": green_v2,
    })

    # 4. 流量切换 (模拟)
    print("\n[Stage 4] 流量切换 (蓝→绿)")
    # 模拟流量切换: 在演练中, 仅记录状态变化, 实际切换由上游 LB 处理
    switch_ok = green_health.get("ok", False)
    print(f"  ✅ 模拟流量切换 (实际由上游 LB/ingress 控制), 绿就绪={switch_ok}")
    drill["stages"].append({"stage": "traffic_switch", "ok": switch_ok, "from": "blue", "to": "green"})

    # 5. 绿环境压力测试 (5 次连续健康检查)
    print("\n[Stage 5] 绿环境稳定性验证 (5 次连续健康检查)")
    stable_results = []
    for i in range(5):
        h = health_check(GREEN_PORT)
        stable_results.append(h)
        print(f"  Attempt {i + 1}: {h}")
        time.sleep(1)
    all_ok = all(r.get("ok", False) for r in stable_results)
    print(f"  {'✅' if all_ok else '❌'} 稳定性验证: {sum(1 for r in stable_results if r.get('ok'))}/5")
    drill["stages"].append({"stage": "stability", "ok": all_ok, "results": stable_results})

    # 6. 蓝环境保留 (用于回滚)
    print("\n[Stage 6] 蓝环境保留 (回滚用)")
    if blue_alive and port_in_use(BLUE_PORT):
        blue_keep_health = health_check(BLUE_PORT)
        print(f"  ✅ 蓝环境保留运行, health={blue_keep_health}")
        drill["stages"].append({"stage": "blue_retained", "ok": True, "health": blue_keep_health})
    else:
        print("  ℹ️  蓝环境未启动, 无需保留")
        drill["stages"].append({"stage": "blue_retained", "ok": True, "note": "not_running"})

    # 7. 演练完成, 清理绿环境
    print("\n[Stage 7] 清理绿环境")
    if green_proc and green_proc.poll() is None:
        green_proc.terminate()
        try:
            green_proc.wait(timeout=10)
            print("  ✅ 绿进程已停止")
        except subprocess.TimeoutExpired:
            green_proc.kill()
            print("  ⚠️  绿进程强制停止")
    drill["stages"].append({"stage": "cleanup", "ok": True})

    # 总结
    all_pass = all(s.get("ok", False) for s in drill["stages"])
    drill["status"] = "success" if all_pass else "partial"
    drill["summary"] = {
        "stages_total": len(drill["stages"]),
        "stages_ok": sum(1 for s in drill["stages"] if s.get("ok", False)),
        "blue_port": BLUE_PORT,
        "green_port": GREEN_PORT,
        "v2_endpoints_in_green": green_v2,
    }
    return drill


def main() -> int:
    print("=" * 70)
    print("蓝绿部署端到端演练 (本地模拟)")
    print("=" * 70)

    drill = run_drill()

    # 输出 JSON 报告
    with open(DRILL_LOG, "w", encoding="utf-8") as f:
        json.dump(drill, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 70)
    print("演练总结")
    print("=" * 70)
    print(f"  状态: {drill['status']}")
    print(f"  阶段: {drill['summary']['stages_ok']}/{drill['summary']['stages_total']} 通过")
    print(f"  绿环境 v2 端点数: {drill['summary']['v2_endpoints_in_green']}")
    print(f"  报告: {DRILL_LOG}")

    return 0 if drill["status"] == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
