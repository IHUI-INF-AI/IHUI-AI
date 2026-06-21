"""Phase 19 建议 3: 全链路压测 - 流量录制回放 + 影子对比 + 性能报表.

目的:
  - 流量录制 (request/response)
  - 流量回放 (按原速/倍速)
  - 影子流量对比 (production vs shadow)
  - 性能压测 (QPS/并发/错误率)
  - 性能报表 (P50/P95/P99/吞吐)

设计:
  RecordedRequest/Response: 录制数据
  TrafficRecorder: 内存 + JSON 文件存储
  Replayer: 调 handler 重放
  ShadowRunner: 同时调 prod + shadow, 对比
  LoadTestRunner: 并发压测, 统计延迟/错误
  PerformanceReporter: 报表
"""

from __future__ import annotations

import json
import statistics
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


@dataclass
class RecordedRequest:
    method: str
    path: str
    headers: dict = field(default_factory=dict)
    body: Any = None
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "method": self.method,
            "path": self.path,
            "headers": self.headers,
            "body": self.body,
            "ts": self.ts,
        }


@dataclass
class RecordedResponse:
    status: int
    body: Any = None
    latency_ms: float = 0.0
    ts: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "body": self.body,
            "latency_ms": self.latency_ms,
            "ts": self.ts,
        }


@dataclass
class ShadowDiff:
    request: RecordedRequest
    prod_response: RecordedResponse
    shadow_response: RecordedResponse
    status_match: bool
    body_match: bool

    def to_dict(self) -> dict:
        return {
            "request": self.request.to_dict(),
            "prod": self.prod_response.to_dict(),
            "shadow": self.shadow_response.to_dict(),
            "status_match": self.status_match,
            "body_match": self.body_match,
        }


@dataclass
class LoadTestResult:
    total: int
    success: int
    failed: int
    errors: int
    duration_s: float
    throughput_qps: float
    latencies: list[float] = field(default_factory=list)

    def p50(self) -> float:
        return _percentile(self.latencies, 50)

    def p95(self) -> float:
        return _percentile(self.latencies, 95)

    def p99(self) -> float:
        return _percentile(self.latencies, 99)


# ---------------------------------------------------------------------------
# 2. 工具
# ---------------------------------------------------------------------------


def _percentile(data: list[float], p: float) -> float:
    if not data:
        return 0.0
    s = sorted(data)
    idx = max(0, int(p / 100 * len(s)) - 1)
    return s[idx]


# ---------------------------------------------------------------------------
# 3. TrafficRecorder
# ---------------------------------------------------------------------------


class TrafficRecorder:
    """流量录制."""

    def __init__(self):
        self.records: list[dict] = []  # [{"request": ..., "response": ...}, ...]

    def record(self, request: RecordedRequest, response: RecordedResponse) -> None:
        self.records.append(
            {
                "request": request.to_dict(),
                "response": response.to_dict(),
            }
        )

    def to_jsonl(self) -> str:
        return "\n".join(json.dumps(r, ensure_ascii=False, default=str) for r in self.records)

    def save(self, path: str) -> None:
        with open(path, "w", encoding="utf-8") as f:
            f.write(self.to_jsonl())

    @classmethod
    def load(cls, path: str) -> TrafficRecorder:
        rec = cls()
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                rec.records.append(json.loads(line))
        return rec

    def clear(self) -> None:
        self.records.clear()

    def count(self) -> int:
        return len(self.records)


# ---------------------------------------------------------------------------
# 4. Replayer
# ---------------------------------------------------------------------------

HandlerFn = Callable[[RecordedRequest], RecordedResponse]


class Replayer:
    """流量回放."""

    def __init__(self, handler: HandlerFn, speed: float = 1.0):
        self.handler = handler
        self.speed = speed  # 1.0 = 原速, 2.0 = 2 倍速

    def replay(self, recorder: TrafficRecorder) -> list[RecordedResponse]:
        out: list[RecordedResponse] = []
        prev_ts: float | None = None
        for rec in recorder.records:
            req = RecordedRequest(
                method=rec["request"]["method"],
                path=rec["request"]["path"],
                headers=rec["request"].get("headers", {}),
                body=rec["request"].get("body"),
                ts=rec["request"].get("ts", time.time()),
            )
            # 按 speed 控制间隔
            if prev_ts is not None:
                delay = (req.ts - prev_ts) / self.speed
                if delay > 0:
                    time.sleep(min(delay, 5.0))  # 上限 5s
            resp = self.handler(req)
            out.append(resp)
            prev_ts = req.ts
        return out


# ---------------------------------------------------------------------------
# 5. ShadowRunner
# ---------------------------------------------------------------------------


class ShadowRunner:
    """影子流量对比."""

    def __init__(self, prod_handler: HandlerFn, shadow_handler: HandlerFn):
        self.prod = prod_handler
        self.shadow = shadow_handler

    def _bodies_match(self, a: Any, b: Any) -> bool:
        if a is None and b is None:
            return True
        if a is None or b is None:
            return False
        # dict / list 比对 (深比较)
        if isinstance(a, dict) and isinstance(b, dict):
            return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)
        if isinstance(a, list) and isinstance(b, list):
            return json.dumps(a, default=str) == json.dumps(b, default=str)
        return str(a) == str(b)

    def run(self, requests: list[RecordedRequest]) -> list[ShadowDiff]:
        diffs: list[ShadowDiff] = []
        for req in requests:
            prod_resp = self.prod(req)
            shadow_resp = self.shadow(req)
            diffs.append(
                ShadowDiff(
                    request=req,
                    prod_response=prod_resp,
                    shadow_response=shadow_resp,
                    status_match=(prod_resp.status == shadow_resp.status),
                    body_match=self._bodies_match(prod_resp.body, shadow_resp.body),
                )
            )
        return diffs

    def diff_stats(self, diffs: list[ShadowDiff]) -> dict:
        total = len(diffs)
        if total == 0:
            return {"total": 0, "status_match_pct": 0.0, "body_match_pct": 0.0}
        sm = sum(1 for d in diffs if d.status_match)
        bm = sum(1 for d in diffs if d.body_match)
        return {
            "total": total,
            "status_match": sm,
            "body_match": bm,
            "status_match_pct": round(sm / total * 100, 2),
            "body_match_pct": round(bm / total * 100, 2),
        }


# ---------------------------------------------------------------------------
# 6. LoadTestRunner
# ---------------------------------------------------------------------------


class LoadTestRunner:
    """压测执行器."""

    def __init__(self, handler: HandlerFn, concurrency: int = 10):
        self.handler = handler
        self.concurrency = concurrency

    def run(self, requests: list[RecordedRequest], duration_s: float = 5.0, target_qps: float = 0.0) -> LoadTestResult:
        """duration_s 时间内并发压测, target_qps=0 表示不限速."""
        results: list[RecordedResponse] = []
        start = time.time()
        deadline = start + duration_s
        interval = (1.0 / target_qps) if target_qps > 0 else 0.0
        next_ts = start
        sent = 0

        def one(req):
            return self.handler(req)

        with ThreadPoolExecutor(max_workers=self.concurrency) as ex:
            futures = []
            i = 0
            while time.time() < deadline:
                if target_qps > 0:
                    now = time.time()
                    if now < next_ts:
                        time.sleep(min(0.01, next_ts - now))
                        continue
                    next_ts += interval
                req = requests[i % len(requests)]
                i += 1
                futures.append(ex.submit(one, req))
                sent += 1
            for f in as_completed(futures):
                try:
                    r = f.result()
                    results.append(r)
                except Exception:
                    pass
        duration = time.time() - start
        success = sum(1 for r in results if 200 <= r.status < 400)
        failed = sum(1 for r in results if r.status >= 400)
        errors = sent - len(results)
        return LoadTestResult(
            total=sent,
            success=success,
            failed=failed,
            errors=errors,
            duration_s=round(duration, 3),
            throughput_qps=round(sent / duration, 2) if duration > 0 else 0.0,
            latencies=[r.latency_ms for r in results],
        )


# ---------------------------------------------------------------------------
# 7. PerformanceReporter
# ---------------------------------------------------------------------------


def report_load_test(r: LoadTestResult) -> str:
    lines = ["# 压测报表", ""]
    lines.append(f"- 总请求: **{r.total}**")
    lines.append(f"- 成功: **{r.success}**")
    lines.append(f"- 失败: **{r.failed}**")
    lines.append(f"- 异常: **{r.errors}**")
    lines.append(f"- 耗时: **{r.duration_s}s**")
    lines.append(f"- 吞吐: **{r.throughput_qps} QPS**")
    lines.append(f"- P50: **{r.p50():.1f} ms**")
    lines.append(f"- P95: **{r.p95():.1f} ms**")
    lines.append(f"- P99: **{r.p99():.1f} ms**")
    if r.latencies:
        lines.append(f"- 平均: **{statistics.mean(r.latencies):.1f} ms**")
    return "\n".join(lines) + "\n"


def report_shadow(stats: dict, diffs: list[ShadowDiff]) -> str:
    lines = ["# 影子流量对比报表", ""]
    lines.append(f"- 总数: **{stats.get('total', 0)}**")
    lines.append(f"- 状态码一致: **{stats.get('status_match', 0)} ({stats.get('status_match_pct', 0)}%)**")
    lines.append(f"- Body 一致: **{stats.get('body_match', 0)} ({stats.get('body_match_pct', 0)}%)**")
    if diffs:
        mismatches = [d for d in diffs if not d.status_match or not d.body_match]
        if mismatches:
            lines.append("")
            lines.append("## 不一致样本 (Top 10)")
            lines.append("")
            for d in mismatches[:10]:
                lines.append(
                    f"- {d.request.method} {d.request.path} prod={d.prod_response.status} shadow={d.shadow_response.status}"
                )
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 8. CLI
# ---------------------------------------------------------------------------


def _sample_requests() -> list[RecordedRequest]:
    return [
        RecordedRequest("GET", "/api/users/1"),
        RecordedRequest("GET", "/api/users/2"),
        RecordedRequest("POST", "/api/orders", body={"item": "A", "qty": 1}),
    ]


def _fast_handler(req: RecordedRequest) -> RecordedResponse:
    """快速 mock handler."""
    start = time.time()
    time.sleep(0.005)
    return RecordedResponse(
        status=200,
        body={"ok": True, "path": req.path},
        latency_ms=(time.time() - start) * 1000,
    )


def _slow_handler(req: RecordedRequest) -> RecordedResponse:
    start = time.time()
    time.sleep(0.05)
    return RecordedResponse(
        status=200,
        body={"ok": True, "path": req.path},
        latency_ms=(time.time() - start) * 1000,
    )


def _main_replay(argv=None) -> dict:
    rec = TrafficRecorder()
    for req in _sample_requests():
        rec.record(req, _fast_handler(req))
    responses = Replayer(_fast_handler, speed=10.0).replay(rec)
    return {"replayed": len(responses), "first_status": responses[0].status}


def _main_shadow(argv=None) -> dict:
    requests = _sample_requests()
    runner = ShadowRunner(_fast_handler, _fast_handler)
    diffs = runner.run(requests)
    return runner.diff_stats(diffs)


def _main_loadtest(argv=None) -> dict:
    requests = _sample_requests()
    r = LoadTestRunner(_fast_handler, concurrency=5).run(requests, duration_s=0.5, target_qps=50)
    return {
        "total": r.total,
        "success": r.success,
        "failed": r.failed,
        "qps": r.throughput_qps,
        "p50": round(r.p50(), 1),
        "p95": round(r.p95(), 1),
        "p99": round(r.p99(), 1),
    }


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="全链路压测")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("replay")
    sub.add_parser("shadow")
    sub.add_parser("loadtest")
    sub.add_parser("report-replay")
    sub.add_parser("report-shadow")
    sub.add_parser("report-loadtest")
    args = p.parse_args(argv)
    if args.cmd == "replay":
        print(json.dumps(_main_replay(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "shadow":
        print(json.dumps(_main_shadow(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "loadtest":
        print(json.dumps(_main_loadtest(), ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "report-replay":
        out = _main_replay()
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0
    if args.cmd == "report-shadow":
        runner = ShadowRunner(_fast_handler, _fast_handler)
        diffs = runner.run(_sample_requests())
        print(report_shadow(runner.diff_stats(diffs), diffs))
        return 0
    if args.cmd == "report-loadtest":
        r = LoadTestRunner(_fast_handler, concurrency=5).run(_sample_requests(), duration_s=0.5, target_qps=50)
        print(report_load_test(r))
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
