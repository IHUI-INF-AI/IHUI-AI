# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""公众号任务「模拟终态 + 真机真实完成」CLI 薄壳(核心单源在 app/services)。

    cd apps/ai-service
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py           # SIM:真机只读基线 + 离线仿真
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --offline # SIM:完全离线
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --live    # LIVE:真机凭据实跑,条件成立即真实领奖
    .venv/Scripts/python.exe scripts/workbuddy_oa_simulate.py --live --json

!! SIM 只改注入 MockTransport 的返回体,19/19 与积分一律标 SIM,不当真机到账。
!! LIVE 不注入任何假返回体:引擎真机读表,只有服务端**真判达标**才发真实 claim;
   未达标零写请求。两条模式都不伪造 openid、不代签、不上报关注事件。
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


def pool_credentials() -> list[dict]:
    """只读本机号池凭据文件(不触网);token 只在进程内使用,绝不打印。"""
    out: list[dict] = []
    for f in sorted(glob.glob(POOL_GLOB)):
        try:
            raw = json.loads(Path(f).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        acc, auth = raw.get("account") or {}, raw.get("auth") or {}
        token, uid = auth.get("accessToken"), acc.get("uid")
        if token and uid:
            out.append(
                {"uid": uid, "nickname": acc.get("nickname") or uid[:8], "token": token}
            )
    return out


async def live_readonly_baselines() -> list[dict]:
    """号池凭据 + 真机**只读** GET 两条端点,取回最真实的基线。"""
    out: list[dict] = []
    for cred in pool_credentials():
        uid, token = cred["uid"], cred["token"]
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
                "nickname": cred["nickname"],
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


def print_live_report(report: dict) -> None:
    t = report["totals"]
    print("=" * 108)
    print("WorkBuddy 公众号任务 · LIVE 真机实跑(真实凭据 / 真实领奖 / 零伪造判据)")
    print("=" * 108)
    for a in report["accounts"]:
        st = a.get("subscribe_status") or {}
        print(f"\n[{a['nickname']}] uid={a['uid'][:8]}…  任务 {a['done']}/{a['total_tasks']}")
        print(f"  服务端读数 : {_short_status(st)}")
        print(
            f"  本轮真实   : 领奖 {len(a['claimed'])} 项, 真实到账积分 +{a['credits']}, "
            f"真实写请求 {len(a['real_write_requests'])} 次"
        )
        print(f"  下一步     : {a['next_action']}")
    print("\n" + "=" * 108)
    print(
        f"LIVE 终态: {t['full']}/{t['accounts']} 个 uid 全 19/19; "
        f"本轮真实到账 +{t['real_credits']}; 真实 claim 请求 {t['real_write_requests']} 次"
    )
    print("claim 路径:", ", ".join(t["claim_paths"]) or "本轮无(服务端尚未判达标)")
    pending = [
        a for a in report["accounts"]
        if a.get("total_tasks") and a.get("done") < a["total_tasks"]
    ]
    if pending:
        print("\n待真人动作(程序不能代签,也不伪造 openid / 关注关系):")
        for a in pending:
            print(f"  - {a['uid'][:8]}… ({a['nickname']}): 账号中心绑定一个独立微信号 → 关注公众号满 24h")
        print("  绑定生效后服务端翻 completed,本命令或调度器下一轮会真实 claim,无需再改代码。")
    else:
        print("\n全池已真实完成,无需人工动作。")
    print("=" * 108)


async def _run(args: argparse.Namespace) -> int:
    if args.live and args.offline:
        print("[ERROR] --live 与 --offline 互斥", file=sys.stderr)
        return 2
    if args.live:
        credentials = pool_credentials()
        if not credentials:
            print("[ERROR] 本机号池凭据为空,无法真机实跑", file=sys.stderr)
            return 2
        report = await sim.live_pool(credentials)
        if args.json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print_live_report(report)
        return 0
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
    p = argparse.ArgumentParser(description="公众号任务仿真终态 / 真机真实领奖")
    p.add_argument("--offline", action="store_true", help="SIM:完全离线,用内置基线,不读号池/不触网")
    p.add_argument("--live", action="store_true", help="LIVE:真机凭据实跑,服务端判达标即真实领奖")
    p.add_argument("--json", action="store_true", help="输出结构化 JSON")
    return asyncio.run(_run(p.parse_args(argv)))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
