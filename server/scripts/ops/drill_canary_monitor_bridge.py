"""canary_monitor_bridge 端到端演练脚本 (Phase 8 建议 3, 改进版).

模拟: cached_expiration_monitor 持续掉线 → canary_monitor_bridge 检测 → mark_failure → auto_rollback.

参数:
    --fail-count N   模拟连续掉线次数 (默认 4 = 触发阈值)
    --check-interval 模拟检查间隔秒数 (默认 0.5, 比生产 30s 短, 加快演练)

不依赖真实 PostgreSQL / Redis, 用 SQLite 跑 uvicorn 在演练进程内, import 状态共享.
不启子进程, 避免子进程和演练脚本 import cache 隔离问题.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

TEST_PORT = 18802
LOG_FILE = ROOT / "logs" / "canary_bridge_drill.log"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def write_log(msg: str) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(f"[{now_iso()}] {msg}\n")
    print(msg)


async def run_drill(fail_count: int, check_interval: float, tenant_id: str = "default") -> int:
    write_log(
        f"== canary_monitor_bridge 端到端演练 (fail_count={fail_count}, interval={check_interval}s, tenant={tenant_id}) =="
    )

    # 1) 注入 mock CanaryStageController (演练前, 必须在 app 启动前注册好)
    from app.services import canary_monitor_bridge as bridge

    calls = []

    class _MockEvent:
        event_type = "auto_rollback"
        from_stage = "10%"
        to_stage = "0%"

    class _MockController:
        def mark_failure(self, reason: str = "", **kwargs):
            ev = _MockEvent()
            calls.append({"reason": reason, "event": ev, "kwargs": kwargs})
            write_log(f"  [mock] CanaryStageController.mark_failure 被调用 #{len(calls)}")
            write_log(f"  [mock] reason = {reason[:120]}")
            write_log(f"  [mock] kwargs = {kwargs}")
            return ev

    bridge._canary_controller = _MockController()
    bridge._bridge_task = None
    bridge._stopping = False

    # 2) 启动 uvicorn in-process
    import uvicorn

    from app.main import create_app

    app = create_app()

    config = uvicorn.Config(
        app,
        host="127.0.0.1",
        port=TEST_PORT,
        log_level="warning",
        loop="asyncio",
        lifespan="on",
    )
    server = uvicorn.Server(config)

    server_task = asyncio.create_task(server.serve())
    write_log(f"[1/5] uvicorn 启动 port={TEST_PORT}, 等待 ready")

    # 等服务 ready
    import httpx

    async with httpx.AsyncClient(timeout=5) as c:
        for i in range(40):
            try:
                r = await c.get(f"http://127.0.0.1:{TEST_PORT}/healthz", timeout=1)
                if r.status_code == 200:
                    write_log(f"  /healthz 200 OK (尝试 {i+1} 次)")
                    break
            except Exception:
                pass
            await asyncio.sleep(0.5)
        else:
            write_log("  [FAIL] app 启动超时")
            server.should_exit = True
            await server_task
            return 1

        # 3) 验证 monitor_running=1
        await asyncio.sleep(1.5)
        r = await c.get(f"http://127.0.0.1:{TEST_PORT}/metrics")
        body = r.text
        running = "zhs_biz_monitor_running 1" in body
        write_log(f"  monitor_running = {running} (期望 True)")

        # 4) 在同一进程内: 模拟 monitor 掉线 + 调 bridge 检测方法
        write_log(f"[2/5] 模拟 monitor 持续掉线 (fail_count={fail_count}, interval={check_interval}s)")
        from app.services.monitor_startup import monitor_manager

        fake_monitor = monitor_manager.cached_monitor
        if fake_monitor is None:
            write_log("  [FAIL] monitor_manager.cached_monitor 为 None")
            server.should_exit = True
            await server_task
            return 1
        original_state = fake_monitor.is_running
        fake_monitor.is_running = False

        bridge_state = {
            "check_interval": check_interval,
            "fail_threshold": 4,
            "fail_streak": 0,
            "last_check_ts": 0.0,
            "last_down_ts": 0.0,
            "triggered": False,
            "last_trigger_ts": 0.0,
            "tenant_id": tenant_id,
        }
        try:
            for i in range(fail_count):
                await asyncio.sleep(check_interval)
                bridge._check_monitor_and_maybe_rollback(bridge_state)
                write_log(
                    f"  iter {i+1}/{fail_count}: fail_streak={bridge_state['fail_streak']}, triggered={bridge_state['triggered']}, calls={len(calls)}"
                )
        finally:
            fake_monitor.is_running = original_state

        # 5) 验证 mark_failure
        write_log("[3/5] 验证 CanaryStageController.mark_failure 被调用")
        if not calls:
            write_log("  [FAIL] mark_failure 未被调用")
            server.should_exit = True
            await server_task
            return 1
        if len(calls) > 1:
            write_log(f"  [WARN] mark_failure 调用了 {len(calls)} 次 (期望恰好 1, 重复调用可能有问题)")
        for c0 in calls:
            write_log(f"    reason: {c0['reason']}")
            ev = c0["event"]
            write_log(f"    event: type={ev.event_type}, {ev.from_stage} -> {ev.to_stage}")

        # 6) 验证 /metrics 关键指标
        write_log("[4/5] 验证 /metrics 关键指标 (第 2 处联动)")
        r = await c.get(f"http://127.0.0.1:{TEST_PORT}/metrics")
        body = r.text
        for k in [
            "zhs_biz_monitor_running",
            "zhs_biz_monitor_records_cached",
            "zhs_biz_monitor_expired_total",
            "zhs_biz_monitor_checks_total",
        ]:
            found = k in body
            write_log(f"  {k}: {'FOUND' if found else 'MISSING'}")

        # 7) 验证 alertmanager 抑制规则 (第 3 处联动: critical -> 抑制 4 warning)
        write_log("[4.5/5] 验证 alertmanager 抑制规则 (第 3 处联动)")
        import yaml as _yaml

        am_path = ROOT / "docker" / "alertmanager" / "alertmanager.yml"
        am = _yaml.safe_load(am_path.read_text(encoding="utf-8"))
        inhibit_rules = am.get("inhibit_rules", [])

        def _rule_source_alertname(r: dict) -> str:
            """兼容 source_match 和 source_matchers 两种格式."""
            sm = r.get("source_match") or (r.get("source_matchers", [{}]) or [{}])[0]
            return sm.get("alertname", "")

        def _rule_target_count(r: dict) -> int:
            """target_match / target_match_re / target_matchers 都算 1 个目标."""
            return sum(1 for k in ("target_match", "target_match_re", "target_matchers") if r.get(k))

        zhsmonitor_inhibits = [r for r in inhibit_rules if _rule_source_alertname(r) == "ZHSMonitorDown"]
        write_log(f"  alertmanager.yml 抑制规则总数: {len(inhibit_rules)}")
        write_log(f"  ZHSMonitorDown 抑制规则数: {len(zhsmonitor_inhibits)} (期望 ≥ 1)")
        if zhsmonitor_inhibits:
            for r in zhsmonitor_inhibits:
                tgt = r.get("target_match_re") or r.get("target_match") or r.get("target_matchers")
                write_log(f"    抑制目标: {tgt} (数={_rule_target_count(r)})")
        # 验证 phase8 路由
        routes = am.get("route", {}).get("routes", [])
        phase8_routes = [
            r
            for r in routes
            if r.get("match", {}).get("closure") == "phase8"
            or any("phase8" in str(m) and "closure" in str(m) for m in r.get("matchers", []))
        ]
        write_log(f"  phase8 路由数: {len(phase8_routes)} (期望 ≥ 1)")
        for r in phase8_routes:
            write_log(f"    receiver: {r.get('receiver', '?')}")
        # 验证 prometheus rules.yml 也有 ZHSMonitorDown
        prom_path = ROOT / "docker" / "prometheus" / "rules.yml"
        prom = prom_path.read_text(encoding="utf-8")
        has_alert = "alert: ZHSMonitorDown" in prom
        write_log(f"  prometheus rules.yml ZHSMonitorDown: {'FOUND' if has_alert else 'MISSING'}")

    # 7) 关闭 uvicorn
    server.should_exit = True
    try:
        await asyncio.wait_for(server_task, timeout=5)
    except TimeoutError:
        server.force_exit = True
    write_log(f"[5/5] 演练完成 ✓  mark_failure 调用次数: {len(calls)}")
    return 0 if calls else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="canary_monitor_bridge 端到端演练")
    parser.add_argument("--fail-count", type=int, default=4, help="连续失败次数")
    parser.add_argument("--check-interval", type=float, default=0.5, help="检查间隔 (秒)")
    parser.add_argument("--tenant-id", default="default", help="多租户演练: 模拟哪个租户触发 mark_failure")
    args = parser.parse_args()
    return asyncio.run(run_drill(args.fail_count, args.check_interval, args.tenant_id))


if __name__ == "__main__":
    # 在演练脚本运行前, 把所有需要的 ENV 设好
    os.environ.setdefault("ENV", "test")
    os.environ.setdefault("DB1_URL", "sqlite:///./zhs_drill.db")
    os.environ.setdefault("DB2_URL", "sqlite:///./zhs_drill.db")
    os.environ.setdefault("DB3_URL", "sqlite:///./zhs_drill.db")
    # 演练场景下缩短桥接节奏
    os.environ["ZHS_CANARY_MONITOR_CHECK_INTERVAL"] = "0.5"
    os.environ["ZHS_CANARY_MONITOR_FAIL_THRESHOLD"] = "4"
    # 关键: 演练时禁用 lifespan 自启动的桥接后台任务, 避免与脚本手动调用的
    # _check_monitor_and_maybe_rollback 形成双倍触发 (每次 mark_failure 都被调 2 次)
    os.environ["ZHS_CANARY_MONITOR_BRIDGE_DISABLED"] = "1"
    # 多租户演练: CLI --tenant-id 会通过 ZHS_CANARY_MONITOR_TENANT_ID 注入
    import argparse as _ap

    _pre = _ap.ArgumentParser(add_help=False)
    _pre.add_argument("--tenant-id", default="default")
    _pre_args, _ = _pre.parse_known_args()
    os.environ["ZHS_CANARY_MONITOR_TENANT_ID"] = _pre_args.tenant_id
    sys.exit(main())
