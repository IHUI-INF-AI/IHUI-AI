"""WebSocket 集群化压测脚本 (建议 1 配套).

模拟多 Pod (多个 manager 实例) + Redis pub/sub, 跑 N 个连接 / M 条消息,
输出 QPS / 延迟 / 漏报率.

不需要真实 Redis: 默认用 fakeredis. 如要打真集群, 加 --redis-host / --redis-port.

用法:
    # 默认: 2 实例 × 100 连接 × 1000 消息, fakeredis
    python scripts/ci/loadtest_ws.py

    # 大压测: 4 实例 × 500 连接 × 5000 消息
    python scripts/ci/loadtest_ws.py --instances 4 --conns 500 --msgs 5000

    # 接真 redis
    python scripts/ci/loadtest_ws.py --redis-host 127.0.0.1 --redis-port 6379

输出指标:
    - qps (msg/s) 总发送 + 跨实例接收
    - p50 / p95 / p99 接收延迟 (ms)
    - loss_pct 漏报率 (发送数 - 接收数) / 发送数
    - cross_instance_rate 跨实例接收占比
"""

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from pathlib import Path

# Windows 控制台 GBK 编码修复: 确保 stdout/stderr 以 UTF-8 输出
if os.name == "nt":
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

# 全局阈值 (被 main() 覆盖)
_MISS_RATIO_MAX = 0.05
_JSON_OUT = False


def _make_manager():
    from app.ws.manager import ConnectionManager

    return ConnectionManager()


def _make_redis_fake():
    try:
        import fakeredis

        return fakeredis.FakeStrictRedis(decode_responses=True)
    except ImportError:
        print("ERROR: fakeredis 没装, 请 pip install fakeredis")
        sys.exit(1)


def _make_redis_real(host: str, port: int, db: int = 0):
    import redis

    return redis.StrictRedis(host=host, port=port, db=db, decode_responses=True)


class _FakeWS:
    """极简 WebSocket: 记录 send_text."""

    def __init__(self):
        self.sent = []
        self.timestamps = []  # 接收时间戳 (用于计算延迟)

    async def accept(self):
        pass

    async def send_text(self, text: str):
        self.sent.append(text)
        self.timestamps.append(time.perf_counter())


async def _run(args) -> int:
    # 1. 准备 redis
    if args.redis_host:
        redis_client = _make_redis_real(args.redis_host, args.redis_port, args.redis_db)
    else:
        redis_client = _make_redis_fake()
    import app.ws.manager as mgr_mod

    mgr_mod._get_redis = lambda: redis_client

    # 2. 启动 N 个 manager 实例
    managers = []
    for _ in range(args.instances):
        m = _make_manager()
        managers.append(m)
        await m.start_redis_subscriber()
    print(
        f"[loadtest] 启动 {len(managers)} 个 manager 实例, redis={'fake' if not args.redis_host else args.redis_host}"
    )

    # 3. 给每个实例挂 args.conns 个连接, 全部订阅同一 room
    all_sockets = []  # [(mgr_idx, ws)]
    for idx, m in enumerate(managers):
        for j in range(args.conns):
            ws = _FakeWS()
            conn_id = f"m{idx}_c{j}"
            await m.connect(conn_id, ws, user_uuid=f"u-{uuid.uuid4().hex[:8]}", room_id="load_room")
            all_sockets.append((idx, ws))
    print(f"[loadtest] 已建 {len(all_sockets)} 个连接 (每实例 {args.conns})")

    # 4. 等订阅稳定
    await asyncio.sleep(0.3)

    # 5. 跨实例广播 args.msgs 条
    send_times = []
    target_room = "load_room"
    print(f"[loadtest] 开始广播 {args.msgs} 条消息到 room={target_room}")
    # 跨实例: 由 0 号 manager 发, 其他实例应收到
    sender = managers[0]
    start = time.perf_counter()
    for k in range(args.msgs):
        send_times.append(time.perf_counter())
        await sender.broadcast_room(target_room, {"msg": "x", "k": k, "ts": send_times[-1]})
    send_elapsed = time.perf_counter() - start
    # 给跨实例传播留时间
    await asyncio.sleep(1.0)
    elapsed = time.perf_counter() - start

    # 6. 统计
    expected_per_conn = args.msgs
    total_received = 0
    all_latencies = []
    same_inst = 0  # 同实例 0 收到的
    cross_inst = 0  # 跨实例 (非 0) 收到的
    for idx, ws in all_sockets:
        n = len(ws.sent)
        total_received += n
        if idx == 0:
            same_inst += n
        else:
            cross_inst += n
        # 计算每个 ws 的接收延迟 (k 对应 send_times[k], 接收时间 = ws.timestamps[k])
        for k, recv_ts in enumerate(ws.timestamps[: args.msgs]):
            if k < len(send_times):
                latency_ms = (recv_ts - send_times[k]) * 1000.0
                all_latencies.append(latency_ms)

    expected_total = args.msgs * len(all_sockets)
    loss = max(0, expected_total - total_received)
    loss_pct = (loss / expected_total) * 100 if expected_total else 0.0
    cross_rate = (cross_inst / total_received) * 100 if total_received else 0.0

    print("\n========== WS 集群压测结果 ==========")
    print(f"实例数:              {args.instances}")
    print(f"每实例连接数:        {args.conns}")
    print(f"总连接数:            {len(all_sockets)}")
    print(f"消息数:              {args.msgs}")
    print(f"发送耗时:            {send_elapsed*1000:.1f} ms ({args.msgs/send_elapsed:.0f} msg/s)")
    print(f"总耗时 (含跨实例):  {elapsed*1000:.1f} ms")
    print(f"期望接收总数:        {expected_total}")
    print(f"实际接收总数:        {total_received}")
    print(f"漏报:                {loss} ({loss_pct:.2f}%)")
    print(f"同实例接收 (m0):     {same_inst}")
    print(f"跨实例接收 (m1..N):  {cross_inst} ({cross_rate:.1f}%)")
    if all_latencies:
        all_latencies.sort()
        p50 = all_latencies[len(all_latencies) // 2]
        p95 = all_latencies[int(len(all_latencies) * 0.95)]
        p99 = all_latencies[int(len(all_latencies) * 0.99)]
        print(f"接收延迟 p50:        {p50:.2f} ms")
        print(f"接收延迟 p95:        {p95:.2f} ms")
        print(f"接收延迟 p99:        {p99:.2f} ms")
        print(f"接收延迟 max:        {all_latencies[-1]:.2f} ms")
    print("=====================================")

    # 7. 清理
    for m in managers:
        await m.stop_redis_subscriber()

    # 8. JSON 报告 (CI 解析用)
    report = {
        "instances": args.instances,
        "conns_per_instance": args.conns,
        "total_conns": len(all_sockets),
        "msgs": args.msgs,
        "send_elapsed_ms": round(send_elapsed * 1000, 2),
        "total_elapsed_ms": round(elapsed * 1000, 2),
        "qps_send": round(args.msgs / send_elapsed, 2) if send_elapsed else 0,
        "expected_total": expected_total,
        "received_total": total_received,
        "loss": loss,
        "loss_pct": round(loss_pct, 4),
        "same_instance_received": same_inst,
        "cross_instance_received": cross_inst,
        "cross_instance_rate_pct": round(cross_rate, 2),
        "p50_ms": round(all_latencies[len(all_latencies) // 2], 2) if all_latencies else 0,
        "p95_ms": round(all_latencies[int(len(all_latencies) * 0.95)], 2) if all_latencies else 0,
        "p99_ms": round(all_latencies[int(len(all_latencies) * 0.99)], 2) if all_latencies else 0,
        "max_ms": round(all_latencies[-1], 2) if all_latencies else 0,
        "miss_ratio_max": _MISS_RATIO_MAX,
        "passed": loss_pct <= _MISS_RATIO_MAX * 100,
    }
    if _JSON_OUT:
        print("\n---JSON-REPORT-START---")
        print(json.dumps(report, ensure_ascii=False))
        print("---JSON-REPORT-END---")

    # 退出码: 漏报严格超过阈值算失败 (阈值=0.0 时, 0 漏报也算 PASS)
    if loss_pct > _MISS_RATIO_MAX * 100:
        print(f"\n[FAIL] loss_pct={loss_pct:.2f}% > miss_ratio_max={_MISS_RATIO_MAX*100:.2f}%")
        return 1
    print(f"\n[PASS] loss_pct={loss_pct:.2f}% <= miss_ratio_max={_MISS_RATIO_MAX*100:.2f}%")
    return 0


def main():
    p = argparse.ArgumentParser(description="WebSocket 集群压测 (跨实例 pub/sub)")
    p.add_argument("--instances", type=int, default=2, help="manager 实例数 (模拟 K8s pod)")
    p.add_argument("--conns", type=int, default=100, help="每实例连接数")
    p.add_argument("--msgs", type=int, default=1000, help="广播消息数")
    p.add_argument("--redis-host", default="", help="真 redis host (留空用 fakeredis)")
    p.add_argument("--redis-port", type=int, default=6379)
    p.add_argument("--redis-db", type=int, default=0)
    p.add_argument(
        "--miss-ratio-max",
        type=float,
        default=None,
        help="漏报率上限 (0.0-1.0), 超过即返回非零退出码. "
        "不传则用默认值 0.05 (即 5%%). 可由环境变量 LOADTEST_MISS_MAX 覆盖.",
    )
    p.add_argument("--json", action="store_true", help="末尾追加 JSON 报告行 (供 CI artifact 解析)")
    args = p.parse_args()

    # env 覆盖, 方便 CI 一行命令
    if args.miss_ratio_max is None:
        env_val = os.environ.get("LOADTEST_MISS_MAX")
        if env_val:
            args.miss_ratio_max = float(env_val)
        else:
            args.miss_ratio_max = 0.05

    # 把阈值塞进 _run 上下文
    global _MISS_RATIO_MAX, _JSON_OUT
    _MISS_RATIO_MAX = args.miss_ratio_max
    _JSON_OUT = args.json

    sys.exit(asyncio.run(_run(args)))


# 上下文变量, 给 _run 用
_MISS_RATIO_MAX = 0.05
_JSON_OUT = False


if __name__ == "__main__":
    main()
