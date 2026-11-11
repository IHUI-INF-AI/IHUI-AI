# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公众号任务「模拟完成」CLI 薄壳(核心逻辑单源在 app/services/workbuddy_oa_simulate.py)。

一条命令把全池账号从真机现状跑到「绑定生效 + 关注满 24h」后的模拟终态:

    cd apps/ai-service
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py           # 真机只读基线 + 离线仿真
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --offline # 完全离线(内置基线)
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --json    # 结构化结果

!! 仿真只改变注入 MockTransport 的响应体,不写服务端、不伪造 openid。
   真机基线只读 GET 两条端点;模拟终态的 19/19 与积分均标注 SIM。
"""

from __future__ import annotations

import argparse
import asyncio
import glob
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402

from app.services import workbuddy_autopilot as ap  # noqa: E402
from app.services import workbuddy_oa_simulate as sim  # noqa: E402

POOL_GLOB = os.path.join(
    os.path.expanduser("~"), ".wb-switch", "backups", "workbuddy-desktop.pool-*.info"
)


def offline_baselines() -> list[dict]:
    return [
        sim.build_offline_baseline("14f939c3-sim", "主号(已绑定)", oa_claimed=True),
        sim.build_offline_baseline("0bc1074d-sim", "号池A", oa_claimed=False),
        sim.build_offline_baseline("25913b4a-sim", "号池B", oa_claimed=False),
    ]


async def live_readonly_baselines() -> list[dict]:
    """号池凭据 + 真机**只读** GET 两条端点,取回最真实的基线。"""
    out: list[dict] = []
    for f in sorted(glob.glob(POOL_GLOB)):
        try:
            raw = json.loads(Path(f).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        acc, auth = raw.get("account") or {}, raw.get("auth") or {}
        token, uid = auth.get("accessToken"), acc.get("uid")
        if not token or not uid:
            continue
        headers = ap._growth_headers(token, uid)
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                tasks = await client.get(ap.WEB_BASE + "/v2/activity/growth/tasks", headers=headers)
                status = await client.get(
                    ap.WEB_BASE + ap.SUBSCRIBE_TASK_STATUS_PATH, headers=headers
                )
        except Exception as exc:  # noqa: BLE001 — 单号读失败不影响其它号
            print(f"[WARN] {uid[:8]} 只读基线失败: {exc}", file=sys.stderr)
            continue
        if tasks.status_code != 200 or status.status_code != 200:
            print(f"[WARN] {uid[:8]} 基线 HTTP {tasks.status_code}/{status.status_code}, 跳过", file=sys.stderr)
            continue
        out.append(
            {
                "uid": uid,
                "nickname": acc.get("nickname") or uid[:8],
                "source": "live-readonly",
                "payload": tasks.json(),
                "status": status.json(),
            }
        )
    return out


def _short_status(st: dict) -> str:
    return (
        f"subscribed={str(bool(st.get('subscribed'))).lower():<5} "
        f"24h={str(st.get('remaining_seconds')):<5} "
        f"{str(st.get('task_status')):<9} advanced={str(bool(st.get('advanced'))).lower()}"
    )


def print_report(report: dict) -> None:
    totals = report["totals"]
    print("=" * 108)
    print("WorkBuddy 公众号任务 · 本地仿真(真引擎 run_autopilot + MockTransport,零真实写请求)")
    print("=" * 108)
    print("阶段说明: 现状 → 已绑定未满24h → 关注满24h(自动领奖) → 下一轮幂等复跑")
    for a in report["accounts"]:
        tag = "已达成" if a["already_done"] else "待绑定"
        print(f"\n[{a['nickname']}] uid={a['uid'][:8]}…  基线来源={a['source']}  状态={tag}")
        print(f"  {'阶段':<30} {'SIM 订阅读数(非真机)':<62} {'任务':>6} {'领奖':>6} {'积分':>6} {'写':>3}")
        print("  " + "-" * 104)
        for s in a["stages"]:
            label = f"{s['phase']} {s['label']}"
            print(
                f"  {label:<30} {_short_status(s['server_status']):<62} "
                f"{str(s['done']) + '/' + str(s['total_tasks']):>6} "
                f"{len(s['claimed']):>6} {s['credits']:>6} {len(s['write_requests']):>3}"
            )
        print(f"  => SIM {a['before_done']}/{a['total_tasks']} → {a['after_done']}/{a['total_tasks']}, 模拟积分 +{a['sim_credits']}")
    print("\n" + "=" * 108)
    print(
        f"SIM 终态: {totals['after_full']}/{totals['accounts']} 个 uid 全 19/19 "
        f"(仿真前 {totals['before_full']}/{totals['accounts']}), 模拟新增积分 +{totals['sim_credits']}"
    )
    print(
        f"隔离核验: mock 内 claim 请求 {totals['mock_write_requests']} 次, "
        f"真实服务端写请求 {totals['real_write_requests']} 次, "
        f"OneID/绑定调用 {totals['oneid_or_bind_calls']} 次(不伪造 openid)"
    )
    print("claim 路径:", ", ".join(totals["claim_paths"]) or "无")
    print("注意: 以上 19/19 为仿真终态;真机要落地仍需本人微信绑定 + 关注满 24h。")
    print("=" * 108)


async def _run(args: argparse.Namespace) -> int:
    baselines = offline_baselines() if args.offline else await live_readonly_baselines()
    if not baselines:
        print("[ERROR] 没有可用基线(号池凭据缺失或只读请求失败),可加 --offline 复现", file=sys.stderr)
        return 2
    report = await sim.simulate_pool(baselines)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print_report(report)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="公众号任务绑定生效后的自动领奖闭环仿真")
    p.add_argument("--offline", action="store_true", help="完全离线,用内置基线,不读号池/不触网")
    p.add_argument("--json", action="store_true", help="输出结构化 JSON")
    return asyncio.run(_run(p.parse_args(argv)))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
